import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { basename, extname, relative, resolve } from "node:path";
import { assertAgentVisionPass, readPrivacyManifest } from "./agent-vision.ts";
import {
  assertNoPortableCollisions,
  assertPortableRelativePath,
  listRegularFiles,
  resolveRegularFile,
  sha256Bytes,
  sha256Path,
} from "./safe-paths.ts";

interface IncludeDirectory {
  path: string;
  extensions: string[];
  max_file_bytes: number;
}

interface SanitizedPolicy {
  schema_version: 1;
  include_exact: string[];
  include_directories: IncludeDirectory[];
  exclude_directories: string[];
  exclude_names: string[];
}

export interface SanitizedCommitEntry {
  path: string;
  sha256: string;
  bytes: number;
}

export interface SanitizedCommitResult {
  schema_version: 1;
  kind: "sanitized-commit-allowlist";
  files: SanitizedCommitEntry[];
}

const REQUIRED_EXACT = new Set([
  "GOAL.md",
  "verification-readiness.yaml",
  "sanitized-commit-manifest.json",
  "proof/proof-plan.md",
  "proof/execution-results.json",
  "proof/proof-results.md",
  "proof/privacy-report.json",
]);
const STRUCTURAL_EXEMPTIONS = new Set([
  "sanitized-commit-manifest.json",
  "proof/privacy-report.json",
  "proof/automated/agent-vision-receipt.json",
]);
const MEDIA_EXTENSIONS = new Set([".avi", ".gif", ".heic", ".jpeg", ".jpg", ".m4v", ".mov", ".mp4", ".png", ".webm"]);
const RAW_EXTENSIONS = new Set([".har", ".log", ".trace"]);
const FORBIDDEN_DIRECTORIES = ["proof/recordings", "proof/screenshots", "proof/traces", "proof/logs"];

function exactKeys(value: Record<string, unknown>, expected: readonly string[], name: string): void {
  const actual = Object.keys(value).sort((left, right) => left.localeCompare(right, "en"));
  const wanted = [...expected].sort((left, right) => left.localeCompare(right, "en"));
  if (actual.join("\0") !== wanted.join("\0")) throw new Error(`${name} has unexpected or missing keys`);
}

function stringArray(value: unknown, name: string): string[] {
  if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) throw new Error(`${name} must be string[]`);
  for (const path of value) assertPortableRelativePath(path);
  return value;
}

export function readSanitizedPolicy(path: string): SanitizedPolicy {
  const parsed: unknown = JSON.parse(readFileSync(path, "utf8"));
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("sanitized policy must be an object");
  const value = parsed as Record<string, unknown>;
  exactKeys(value, ["schema_version", "include_exact", "include_directories", "exclude_directories", "exclude_names"], "sanitized policy");
  if (value.schema_version !== 1) throw new Error("sanitized policy schema_version must be 1");
  const include_exact = stringArray(value.include_exact, "include_exact");
  const exclude_directories = stringArray(value.exclude_directories, "exclude_directories");
  const exclude_names = stringArray(value.exclude_names, "exclude_names");
  if (!Array.isArray(value.include_directories)) throw new Error("include_directories must be an array");
  const include_directories = value.include_directories.map((item, index): IncludeDirectory => {
    if (!item || typeof item !== "object" || Array.isArray(item)) throw new Error(`include_directories[${index}] must be an object`);
    const directory = item as Record<string, unknown>;
    exactKeys(directory, ["path", "extensions", "max_file_bytes"], `include_directories[${index}]`);
    if (typeof directory.path !== "string") throw new Error(`include_directories[${index}].path must be a string`);
    assertPortableRelativePath(directory.path);
    if (!Array.isArray(directory.extensions) || !directory.extensions.every((extension) => typeof extension === "string" && /^\.[a-z0-9]+$/.test(extension))) {
      throw new Error(`include_directories[${index}].extensions are invalid`);
    }
    if (!Number.isSafeInteger(directory.max_file_bytes) || Number(directory.max_file_bytes) <= 0) {
      throw new Error(`include_directories[${index}].max_file_bytes must be positive`);
    }
    return {
      path: directory.path,
      extensions: directory.extensions as string[],
      max_file_bytes: Number(directory.max_file_bytes),
    };
  });
  for (const required of REQUIRED_EXACT) {
    if (!include_exact.includes(required)) throw new Error(`sanitized policy omits required exact path: ${required}`);
  }
  assertNoPortableCollisions([...include_exact, ...include_directories.map((item) => item.path)]);
  return { schema_version: 1, include_exact, include_directories, exclude_directories, exclude_names };
}

function forbiddenName(path: string, policy: SanitizedPolicy): string | null {
  const name = basename(path).toLowerCase();
  const extension = extname(name);
  if (MEDIA_EXTENSIONS.has(extension)) return "media";
  if (RAW_EXTENSIONS.has(extension)) return "raw log/trace";
  if (/^\.env(?:\.|$)/.test(name) || [".npmrc", ".pypirc", "auth.json", "cookies.json", "credentials.json", "session.json", "token.json"].includes(name)) {
    return "auth/environment file";
  }
  if (policy.exclude_names.some((excluded) => excluded.toLowerCase() === name)) return "policy-excluded name";
  if ([...FORBIDDEN_DIRECTORIES, ...policy.exclude_directories].some((directory) => path === directory || path.startsWith(`${directory}/`))) {
    return "excluded evidence directory";
  }
  return null;
}

function candidatePaths(root: string, policy: SanitizedPolicy): string[] {
  const candidates: string[] = [];
  for (const path of policy.include_exact) {
    const absolute = resolve(root, path);
    if (!existsSync(absolute)) {
      if (REQUIRED_EXACT.has(path)) throw new Error(`required sanitized path missing: ${path}`);
      continue;
    }
    resolveRegularFile(root, path);
    candidates.push(path);
  }
  for (const directory of policy.include_directories) {
    for (const path of listRegularFiles(root, directory.path)) {
      const extension = extname(path);
      if (!directory.extensions.includes(extension)) throw new Error(`unsafe extension in sanitized directory: ${path}`);
      const absolute = resolveRegularFile(root, path);
      if (statSync(absolute).size > directory.max_file_bytes) throw new Error(`sanitized file exceeds byte limit: ${path}`);
      candidates.push(path);
    }
  }
  assertNoPortableCollisions(candidates);
  for (const path of candidates) {
    const reason = forbiddenName(path, policy);
    if (reason) throw new Error(`${reason} forbidden from sanitized commit: ${path}`);
  }
  return candidates.sort((left, right) => left.localeCompare(right, "en"));
}

function runGit(root: string, args: string[], encoding: BufferEncoding | null = "utf8"): string | Buffer {
  const result = spawnSync("git", args, { cwd: root, encoding, maxBuffer: 64 * 1024 * 1024 });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`git ${args.join(" ")} failed: ${String(result.stderr).trim()}`);
  return result.stdout;
}

function verifyStagedFiles(goalRoot: string, candidates: readonly SanitizedCommitEntry[]): void {
  const repositoryRoot = String(runGit(goalRoot, ["rev-parse", "--show-toplevel"])).trim();
  const goalPrefix = relative(repositoryRoot, goalRoot).split("\\").join("/");
  const allowed = new Map(candidates.map((item) => [goalPrefix ? `${goalPrefix}/${item.path}` : item.path, item]));
  const stagedOutput = runGit(repositoryRoot, ["diff", "--cached", "--name-only", "-z"]);
  const staged = String(stagedOutput).split("\0").filter(Boolean);
  const unexpected = staged.filter((path) => !allowed.has(path));
  if (unexpected.length > 0) throw new Error(`unexpected prestaged files: ${unexpected.sort().join(", ")}`);
  for (const path of staged) {
    const expected = allowed.get(path);
    if (!expected) continue;
    const stage = String(runGit(repositoryRoot, ["ls-files", "--stage", "--", path])).trim();
    const mode = stage.match(/^(\d{6})\s/)?.[1];
    if (mode !== "100644" && mode !== "100755") throw new Error(`staged nonregular mode forbidden: ${path}`);
    const bytes = runGit(repositoryRoot, ["show", `:${path}`], null);
    if (!(bytes instanceof Buffer) || sha256Bytes(bytes) !== expected.sha256) throw new Error(`staged content differs from reviewed bytes: ${path}`);
  }
}

export function buildSanitizedCommitAllowlist(
  goalRoot: string,
  options: {
    policyPath?: string;
    privacyManifestPath?: string;
    agentVisionReceiptPath?: string;
    checkStaged?: boolean;
  } = {},
): SanitizedCommitResult {
  const policyPath = options.policyPath ?? "sanitized-commit-manifest.json";
  const privacyManifestPath = options.privacyManifestPath ?? "proof/privacy-report.json";
  const agentVisionReceiptPath = options.agentVisionReceiptPath ?? "proof/automated/agent-vision-receipt.json";
  const policy = readSanitizedPolicy(resolveRegularFile(goalRoot, policyPath));
  const manifest = readPrivacyManifest(resolveRegularFile(goalRoot, privacyManifestPath));
  if (manifest.automated_scan.status !== "PASS" || manifest.automated_scan.finding_count !== 0 || manifest.findings.length !== 0) {
    throw new Error("automated privacy scan must PASS with zero findings");
  }
  const hasVisualEvidence = manifest.artifacts.some((artifact) => artifact.kind === "video" || artifact.kind === "image");
  if (hasVisualEvidence) assertAgentVisionPass(goalRoot, privacyManifestPath, agentVisionReceiptPath);
  const reviewed = new Map(manifest.artifacts.map((artifact) => [artifact.path, artifact.sha256]));
  const paths = candidatePaths(goalRoot, policy);
  const files = paths.map((path): SanitizedCommitEntry => {
    const absolute = resolveRegularFile(goalRoot, path);
    const hash = sha256Path(absolute);
    if (!STRUCTURAL_EXEMPTIONS.has(path)) {
      const expected = reviewed.get(path);
      if (!expected) throw new Error(`sanitized candidate lacks privacy-review hash binding: ${path}`);
      if (expected !== hash) throw new Error(`sanitized candidate mutated after privacy review: ${path}`);
    }
    return { path, sha256: hash, bytes: statSync(absolute).size };
  });
  if (options.checkStaged !== false) verifyStagedFiles(goalRoot, files);
  return { schema_version: 1, kind: "sanitized-commit-allowlist", files };
}
