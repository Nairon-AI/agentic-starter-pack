import { createHash } from "node:crypto";
import { constants, existsSync, lstatSync, openSync, closeSync, readFileSync, unlinkSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import {
  assertAllowedAttachmentUrl,
  readExecutionResults,
  renderProofResults,
  resolveResultsReadiness,
  stringifyExecutionResults,
  validateExecutionResults,
  writeFileAtomic,
} from "./execution-results.ts";
import type { AttachmentReceipt, ExecutionResults, Receipt } from "./execution-results.ts";
import { isSafeRelativePath, resolveInside, sha256File } from "./readiness.ts";

const MAX_REDIRECTS = 5;
const MAX_GITHUB_JSON_BYTES = 2 * 1024 * 1024;
const REQUEST_TIMEOUT_MS = 30_000;

interface GithubPull {
  number: number;
  html_url: string;
  merged: boolean;
  merged_at: string | null;
  head: { sha: string };
  merge_commit_sha: string | null;
}

interface GithubComment {
  html_url: string;
  body: string | null;
}

interface FixtureDownload {
  source_path: string;
  redirects?: string[];
}

interface FinalizerFixture {
  schema_version: 1;
  now: string;
  github: {
    repository: string;
    pull: GithubPull;
    comment: GithubComment;
  };
  downloads: Record<string, FixtureDownload>;
  stop_after_verified_pending_cleanup?: boolean;
}

export interface FinalizeOptions {
  resultsPath: string;
  markdownPath?: string;
  fixturePath?: string;
  token?: string;
  fetchImpl?: typeof fetch;
}

interface LocalIdentity {
  size: number;
  sha256: string;
  device: bigint;
  inode: bigint;
}

interface RemoteIdentity {
  size: number;
  sha256: string;
}

function validDate(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function parseCommentId(url: string, repository: string, prNumber: number): string {
  const match = url.match(new RegExp(`^https://github\\.com/${escapeRegExp(repository)}/pull/${prNumber}#issuecomment-(\\d+)$`));
  if (!match?.[1]) throw new Error("evidence comment URL is not a canonical comment on the configured PR");
  return match[1];
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function readFixture(path: string): FinalizerFixture {
  const fixture = JSON.parse(readFileSync(path, "utf8")) as FinalizerFixture;
  if (fixture.schema_version !== 1 || !validDate(fixture.now)) throw new Error("fixture needs schema_version=1 and deterministic now timestamp");
  if (!fixture.github || !fixture.downloads) throw new Error("fixture needs github and downloads objects");
  return fixture;
}

function hashLocalRegularFile(path: string): LocalIdentity {
  const before = lstatSync(path, { bigint: true });
  if (!before.isFile() || before.isSymbolicLink()) throw new Error(`local evidence must be a regular non-symlink file: ${path}`);
  const descriptor = openSync(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
  try {
    const sha256 = sha256File(path);
    const after = lstatSync(path, { bigint: true });
    if (!after.isFile() || after.isSymbolicLink() || before.dev !== after.dev || before.ino !== after.ino || before.size !== after.size) {
      throw new Error(`local evidence changed while hashing: ${path}`);
    }
    return { size: Number(after.size), sha256, device: after.dev, inode: after.ino };
  } finally {
    closeSync(descriptor);
  }
}

function assertExpectedLocal(path: string, attachment: AttachmentReceipt): LocalIdentity {
  const identity = hashLocalRegularFile(path);
  if (identity.size !== attachment.local_byte_size) throw new Error(`local byte size changed for ${attachment.artifact_id}`);
  if (identity.sha256 !== attachment.local_sha256) throw new Error(`local SHA-256 changed for ${attachment.artifact_id}`);
  return identity;
}

async function boundedResponseBytes(response: Response, maximum: number): Promise<Uint8Array> {
  const contentLength = response.headers.get("content-length");
  if (contentLength !== null && (!/^\d+$/.test(contentLength) || Number(contentLength) > maximum)) throw new Error("response exceeds bounded size");
  if (!response.body) return new Uint8Array();
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maximum) {
      await reader.cancel();
      throw new Error("response exceeds bounded size");
    }
    chunks.push(value);
  }
  const output = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return output;
}

async function fetchGithubJson<T>(url: string, token: string | undefined, fetchImpl: typeof fetch): Promise<T> {
  const response = await fetchImpl(url, {
    method: "GET",
    redirect: "error",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    headers: {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "verify-goal-evidence-finalizer",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!response.ok) throw new Error(`GitHub API GET failed with HTTP ${response.status}`);
  const bytes = await boundedResponseBytes(response, MAX_GITHUB_JSON_BYTES);
  return JSON.parse(new TextDecoder().decode(bytes)) as T;
}

async function downloadLive(urlValue: string, expectedSize: number, fetchImpl: typeof fetch): Promise<RemoteIdentity> {
  let url = assertAllowedAttachmentUrl(urlValue);
  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
    const response = await fetchImpl(url, {
      method: "GET",
      redirect: "manual",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      headers: { Accept: "application/octet-stream", "User-Agent": "verify-goal-evidence-finalizer" },
    });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      if (redirects === MAX_REDIRECTS) throw new Error(`attachment exceeded ${MAX_REDIRECTS} redirects`);
      const location = response.headers.get("location");
      if (!location) throw new Error("attachment redirect omitted Location");
      url = assertAllowedAttachmentUrl(new URL(location, url).href);
      continue;
    }
    if (!response.ok) throw new Error(`attachment download failed with HTTP ${response.status}`);
    const bytes = await boundedResponseBytes(response, expectedSize + 1);
    return { size: bytes.byteLength, sha256: createHash("sha256").update(bytes).digest("hex") };
  }
  throw new Error(`attachment exceeded ${MAX_REDIRECTS} redirects`);
}

function downloadFixture(
  url: string,
  expectedSize: number,
  fixture: FinalizerFixture,
  fixturePath: string,
): RemoteIdentity {
  assertAllowedAttachmentUrl(url);
  const entry = fixture.downloads[url];
  if (!entry) throw new Error(`fixture has no download for ${url}`);
  const redirects = entry.redirects ?? [];
  if (redirects.length > MAX_REDIRECTS) throw new Error(`fixture attachment exceeded ${MAX_REDIRECTS} redirects`);
  for (const redirect of redirects) assertAllowedAttachmentUrl(redirect);
  if (!isSafeRelativePath(entry.source_path)) throw new Error("fixture download source_path must be safe and relative");
  const source = resolveInside(dirname(fixturePath), entry.source_path);
  const identity = hashLocalRegularFile(source);
  if (identity.size > expectedSize + 1) throw new Error("fixture attachment exceeds bounded size");
  return { size: identity.size, sha256: identity.sha256 };
}

function validateAuthoritativeState(
  results: ExecutionResults,
  pull: GithubPull,
  comment: GithubComment,
): { mergeSha: string; nowEvidence: NonNullable<ExecutionResults["pr_evidence"]> } {
  const evidence = results.pr_evidence;
  if (!evidence || evidence.pr_number === null || !evidence.pr_url || !evidence.comment_url) throw new Error("GitHub PR evidence receipt is incomplete");
  if (pull.number !== evidence.pr_number || pull.html_url !== evidence.pr_url) throw new Error("authoritative PR identity differs from receipt");
  if (!pull.merged || !validDate(pull.merged_at)) throw new Error("authoritative PR is not merged");
  if (pull.head?.sha !== results.goal.tested_commit || pull.head.sha !== evidence.tested_head_sha) throw new Error("PR tested head changed after proof");
  if (!pull.merge_commit_sha || !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(pull.merge_commit_sha)) throw new Error("merged PR lacks authoritative merge commit SHA");
  if (comment.html_url !== evidence.comment_url) throw new Error("authoritative evidence comment URL differs from receipt");
  const body = comment.body ?? "";
  if (!body.includes(results.goal.tested_commit)) throw new Error("evidence comment does not name the tested commit");
  for (const attachment of evidence.attachments) {
    if (!body.includes(attachment.remote_url)) throw new Error(`evidence comment omits attachment ${attachment.artifact_id}`);
  }
  return { mergeSha: pull.merge_commit_sha, nowEvidence: evidence };
}

function addMergeReceipt(results: ExecutionResults, now: string): void {
  const evidence = results.pr_evidence;
  if (!evidence) return;
  let receipt = results.receipts.find((item) => item.kind === "github_merge");
  if (!receipt) {
    const highest = results.receipts.reduce((max, item) => Math.max(max, Number(item.id.match(/^R-(\d+)$/)?.[1] ?? 0)), 0);
    const artifactIds = evidence.attachments.map((item) => item.artifact_id);
    const linkedScenarios = artifactIds.length > 0
      ? results.scenario_results.filter((item) => item.artifact_ids.some((id) => artifactIds.includes(id))).map((item) => item.id)
      : results.scenario_results.map((item) => item.id);
    const linkedCriteria = artifactIds.length > 0
      ? results.criterion_results.filter((item) => item.artifact_ids.some((id) => artifactIds.includes(id))).map((item) => item.id)
      : results.criterion_results.map((item) => item.id);
    receipt = {
      id: `R-${String(highest + 1).padStart(2, "0")}`,
      kind: "github_merge",
      status: "valid",
      checked_at: now,
      summary: "Authoritative merged PR, evidence comment, remote bytes, size, and SHA-256 verified.",
      criterion_ids: linkedCriteria,
      scenario_ids: linkedScenarios,
      verifier_ids: [],
      artifact_ids: artifactIds,
      path: null,
      byte_size: null,
      sha256: null,
    };
    results.receipts.push(receipt);
    for (const item of results.criterion_results) if (linkedCriteria.includes(item.id) && !item.receipt_ids.includes(receipt.id)) item.receipt_ids.push(receipt.id);
    for (const item of results.scenario_results) if (linkedScenarios.includes(item.id) && !item.receipt_ids.includes(receipt.id)) item.receipt_ids.push(receipt.id);
    for (const item of results.artifact_results) if (artifactIds.includes(item.id) && !item.receipt_ids.includes(receipt.id)) item.receipt_ids.push(receipt.id);
  } else {
    receipt.checked_at = now;
  }
}

function persist(resultsPath: string, markdownPath: string, results: ExecutionResults): void {
  writeFileAtomic(resultsPath, stringifyExecutionResults(results));
  writeFileAtomic(markdownPath, renderProofResults(results));
}

function block(results: ExecutionResults, reason: string, now: string): void {
  results.overall_result = "BLOCKED";
  results.workflow_phase = "blocked";
  results.goal.completed_at = null;
  if (results.pr_evidence) {
    results.pr_evidence.state = "blocked";
    results.pr_evidence.checked_at = now;
    results.pr_evidence.blocker = reason;
  }
}

function deleteExact(path: string, expected: AttachmentReceipt): void {
  const identity = assertExpectedLocal(path, expected);
  const immediatelyBefore = lstatSync(path, { bigint: true });
  if (!immediatelyBefore.isFile() || immediatelyBefore.isSymbolicLink() || immediatelyBefore.dev !== identity.device || immediatelyBefore.ino !== identity.inode) {
    throw new Error(`refusing cleanup because local evidence identity changed: ${expected.artifact_id}`);
  }
  unlinkSync(path);
  if (existsSync(path)) throw new Error(`local evidence still exists after cleanup: ${expected.artifact_id}`);
}

export async function finalizePrEvidence(options: FinalizeOptions): Promise<ExecutionResults> {
  const resultsPath = resolve(options.resultsPath);
  const markdownPath = resolve(options.markdownPath ?? resolve(dirname(resultsPath), "proof-results.md"));
  const results = readExecutionResults(resultsPath);
  let now = new Date().toISOString();
  try {
    const resultStat = lstatSync(resultsPath);
    if (!resultStat.isFile() || resultStat.isSymbolicLink() || basename(resultsPath) !== "execution-results.json" || basename(dirname(resultsPath)) !== "proof") {
      throw new Error("execution results must be a regular non-symlink file under proof/");
    }
    const { readiness } = resolveResultsReadiness(resultsPath, results);
    const fixturePath = options.fixturePath ? resolve(options.fixturePath) : null;
    const fixture = fixturePath ? readFixture(fixturePath) : null;
    now = fixture?.now ?? now;
    const failures = validateExecutionResults(results, readiness, resultsPath);
    if (failures.length > 0) throw new Error(`preflight validation failed: ${failures.join("; ")}`);
    const evidence = results.pr_evidence;
    if (!evidence || evidence.provider !== "github") throw new Error("only GitHub PR evidence can be finalized");
    if (!["awaiting_merge", "verified_pending_cleanup"].includes(evidence.state)) throw new Error("PR evidence must be awaiting_merge or verified_pending_cleanup");
    if (evidence.pr_number === null || !evidence.comment_url) throw new Error("PR number and evidence comment are required");
    const commentId = parseCommentId(evidence.comment_url, evidence.repository, evidence.pr_number);
    const fetchImpl = options.fetchImpl ?? fetch;
    const pull = fixture
      ? fixture.github.pull
      : await fetchGithubJson<GithubPull>(`https://api.github.com/repos/${evidence.repository}/pulls/${evidence.pr_number}`, options.token, fetchImpl);
    const comment = fixture
      ? fixture.github.comment
      : await fetchGithubJson<GithubComment>(`https://api.github.com/repos/${evidence.repository}/issues/comments/${commentId}`, options.token, fetchImpl);
    if (fixture && fixture.github.repository !== evidence.repository) throw new Error("fixture repository differs from receipt");
    const { mergeSha } = validateAuthoritativeState(results, pull, comment);

    const root = resolve(dirname(dirname(resultsPath)));
    const alreadyMissing = new Set<string>();
    for (const attachment of evidence.attachments) {
      const localPath = resolveInside(root, attachment.local_path);
      if (!existsSync(localPath)) {
        if (evidence.state !== "verified_pending_cleanup" || attachment.cleanup_state !== "verified_pending_cleanup") {
          throw new Error(`retained local evidence is missing: ${attachment.artifact_id}`);
        }
        alreadyMissing.add(attachment.artifact_id);
      } else {
        assertExpectedLocal(localPath, attachment);
      }
      const remote = fixture && fixturePath
        ? downloadFixture(attachment.remote_url, attachment.local_byte_size, fixture, fixturePath)
        : await downloadLive(attachment.remote_url, attachment.local_byte_size, fetchImpl);
      if (remote.size !== attachment.local_byte_size) throw new Error(`remote/local byte size mismatch for ${attachment.artifact_id}`);
      if (remote.sha256 !== attachment.local_sha256) throw new Error(`remote/local SHA-256 mismatch for ${attachment.artifact_id}`);
      attachment.remote_byte_size = remote.size;
      attachment.remote_sha256 = remote.sha256;
      attachment.verified_at = now;
      const artifact = readiness.artifacts.find((item) => item.id === attachment.artifact_id);
      attachment.cleanup_state = artifact?.type === "video" ? "verified_pending_cleanup" : "not_applicable";
      attachment.cleaned_at = null;
    }

    evidence.state = "verified_pending_cleanup";
    evidence.merge_sha = mergeSha;
    evidence.checked_at = now;
    evidence.blocker = null;
    addMergeReceipt(results, now);
    const pendingFailures = validateExecutionResults(results, readiness, resultsPath);
    if (pendingFailures.length > 0) throw new Error(`verified-pending-cleanup receipt is invalid: ${pendingFailures.join("; ")}`);
    persist(resultsPath, markdownPath, results);
    if (fixture?.stop_after_verified_pending_cleanup) return results;

    for (const attachment of evidence.attachments) {
      const artifact = readiness.artifacts.find((item) => item.id === attachment.artifact_id);
      if (artifact?.type !== "video") {
        attachment.cleanup_state = "not_applicable";
        attachment.cleaned_at = null;
        continue;
      }
      const localPath = resolveInside(root, attachment.local_path);
      if (!alreadyMissing.has(attachment.artifact_id)) deleteExact(localPath, attachment);
      attachment.cleanup_state = "deleted";
      attachment.cleaned_at = now;
    }

    evidence.state = "complete";
    results.workflow_phase = "complete";
    results.overall_result = "PASS";
    results.goal.completed_at = now;
    persist(resultsPath, markdownPath, results);
    return results;
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    block(results, reason, now);
    persist(resultsPath, markdownPath, results);
    throw new Error(reason);
  }
}

export function readFinalizerFixture(path: string): FinalizerFixture {
  return readFixture(path);
}
