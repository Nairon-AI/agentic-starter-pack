import { readFileSync } from "node:fs";
import { extname } from "node:path";
import { resolveRegularFile, sha256Bytes, sha256Path } from "./safe-paths.ts";

export type PrivacyInputKind = "dom_snapshot_json" | "url" | "log" | "generated_text";

export interface PrivacyInput {
  path: string;
  kind: PrivacyInputKind;
}

export interface PrivacyFinding {
  id: string;
  artifact_path: string;
  rule_id: string;
  category: "secret" | "pii" | "sensitive_url" | "invalid_input";
  location: string;
  fingerprint_sha256: string;
}

export interface ScannedArtifact {
  path: string;
  kind: PrivacyInputKind | "video" | "image";
  sha256: string;
  bytes: number;
  finding_ids: string[];
}

interface RawFinding {
  rule_id: string;
  category: PrivacyFinding["category"];
  location: string;
  matched: string;
}

const SAFE_REDACTIONS = new Set(["", "redacted", "masked", "none", "null", "n/a", "__required__", "***"]);
const SENSITIVE_KEYS = /^(?:api[-_]?key|access[-_]?token|auth[-_]?token|bearer|client[-_]?secret|cookie|password|private[-_]?key|refresh[-_]?token|secret|session(?:id|_id)?|token)$/i;
const URL_SENSITIVE_KEYS = /^(?:api[-_]?key|access[-_]?token|auth|authorization|client[-_]?secret|code|cookie|credential|jwt|password|refresh[-_]?token|secret|session|signature|sig|token)$/i;

function lineAndColumn(text: string, index: number): string {
  const prefix = text.slice(0, index);
  const lines = prefix.split("\n");
  return `line:${lines.length}:column:${(lines.at(-1)?.length ?? 0) + 1}`;
}

function addMatches(
  output: RawFinding[],
  text: string,
  pattern: RegExp,
  rule_id: string,
  category: RawFinding["category"],
  locationPrefix = "",
): void {
  for (const match of text.matchAll(pattern)) {
    const matched = match[0];
    if (!matched) continue;
    output.push({
      rule_id,
      category,
      location: `${locationPrefix}${lineAndColumn(text, match.index)}`,
      matched,
    });
  }
}

function luhnValid(value: string): boolean {
  const digits = value.replaceAll(/[^0-9]/g, "");
  if (digits.length < 13 || digits.length > 19 || /^(\d)\1+$/.test(digits)) return false;
  let sum = 0;
  let double = false;
  for (let index = digits.length - 1; index >= 0; index -= 1) {
    const character = digits[index];
    if (character === undefined) return false;
    let digit = Number(character);
    if (double) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    double = !double;
  }
  return sum % 10 === 0;
}

function scanUrls(text: string, locationPrefix: string): RawFinding[] {
  const output: RawFinding[] = [];
  for (const match of text.matchAll(/https?:\/\/[^\s"'<>\])}]+/gi)) {
    const raw = match[0].replace(/[.,;:!?]+$/, "");
    let url: URL;
    try {
      url = new URL(raw);
    } catch {
      output.push({
        rule_id: "URL_INVALID",
        category: "invalid_input",
        location: `${locationPrefix}${lineAndColumn(text, match.index)}`,
        matched: raw,
      });
      continue;
    }
    const location = `${locationPrefix}${lineAndColumn(text, match.index)}`;
    if (url.username || url.password) {
      output.push({ rule_id: "URL_USERINFO", category: "secret", location, matched: raw });
    }
    const host = url.hostname.toLowerCase();
    if (
      host === "localhost"
      || host.endsWith(".localhost")
      || host.endsWith(".internal")
      || host.endsWith(".local")
      || /^127\./.test(host)
      || /^10\./.test(host)
      || /^192\.168\./.test(host)
      || /^172\.(?:1[6-9]|2\d|3[01])\./.test(host)
    ) {
      output.push({ rule_id: "URL_PRIVATE_HOST", category: "sensitive_url", location, matched: host });
    }
    for (const [name, value] of url.searchParams) {
      if (URL_SENSITIVE_KEYS.test(name) && !SAFE_REDACTIONS.has(value.trim().toLowerCase())) {
        output.push({ rule_id: "URL_SENSITIVE_QUERY", category: "secret", location, matched: `${name}=${value}` });
      }
    }
  }
  return output;
}

export function scanPrivacyText(text: string, locationPrefix = ""): RawFinding[] {
  const output: RawFinding[] = [];
  addMatches(output, text, /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g, "PRIVATE_KEY", "secret", locationPrefix);
  addMatches(output, text, /\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-(?:proj-)?[A-Za-z0-9_-]{20,}|xox[baprs]-[A-Za-z0-9-]{10,})\b/g, "PROVIDER_TOKEN", "secret", locationPrefix);
  addMatches(output, text, /\bAKIA[0-9A-Z]{16}\b/g, "AWS_ACCESS_KEY", "secret", locationPrefix);
  addMatches(output, text, /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g, "JWT", "secret", locationPrefix);
  addMatches(output, text, /\b(?:Authorization\s*:\s*)?(?:Bearer|Basic)\s+[A-Za-z0-9._~+/=-]{8,}/gi, "AUTH_HEADER", "secret", locationPrefix);
  addMatches(output, text, /\b(?:Set-)?Cookie\s*:\s*[^\s;,=]+=[^\s;,]{6,}/gi, "COOKIE", "secret", locationPrefix);
  addMatches(
    output,
    text,
    /\b(?:api[-_]?key|access[-_]?token|auth[-_]?token|client[-_]?secret|password|private[-_]?key|refresh[-_]?token|secret|session(?:id|_id)?|token)\b\s*["']?\s*[:=]\s*["']?([^\s,"'}\]]{6,})/gi,
    "SECRET_ASSIGNMENT",
    "secret",
    locationPrefix,
  );
  addMatches(output, text, /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "EMAIL", "pii", locationPrefix);
  addMatches(output, text, /\b\d{3}-\d{2}-\d{4}\b/g, "US_SSN", "pii", locationPrefix);
  addMatches(output, text, /(?:\+\d{1,3}[-.\s]?)?(?:\(\d{3}\)|\d{3})[-.\s]\d{3}[-.\s]\d{4}\b/g, "PHONE", "pii", locationPrefix);
  for (const match of text.matchAll(/\b(?:\d[ -]*?){13,19}\b/g)) {
    if (!luhnValid(match[0])) continue;
    output.push({
      rule_id: "PAYMENT_CARD",
      category: "pii",
      location: `${locationPrefix}${lineAndColumn(text, match.index)}`,
      matched: match[0],
    });
  }
  output.push(...scanUrls(text, locationPrefix));
  return output;
}

function escapePointer(value: string): string {
  return value.replaceAll("~", "~0").replaceAll("/", "~1");
}

function scanDomValue(value: unknown, pointer: string, output: RawFinding[]): void {
  if (typeof value === "string") {
    output.push(...scanPrivacyText(value, `${pointer}:`));
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => scanDomValue(item, `${pointer}/${index}`, output));
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, item] of Object.entries(value)) {
    const itemPointer = `${pointer}/${escapePointer(key)}`;
    if (SENSITIVE_KEYS.test(key) && typeof item === "string" && !SAFE_REDACTIONS.has(item.trim().toLowerCase())) {
      output.push({ rule_id: "SENSITIVE_DOM_FIELD", category: "secret", location: itemPointer, matched: item });
    }
    scanDomValue(item, itemPointer, output);
  }
}

function rawFindingsFor(kind: PrivacyInputKind, text: string): RawFinding[] {
  if (kind !== "dom_snapshot_json") return scanPrivacyText(text);
  try {
    const parsed: unknown = JSON.parse(text);
    const output: RawFinding[] = [];
    scanDomValue(parsed, "#", output);
    return output;
  } catch (error) {
    return [{
      rule_id: "DOM_INVALID_JSON",
      category: "invalid_input",
      location: "#",
      matched: error instanceof Error ? error.message : String(error),
    }];
  }
}

function findingKey(finding: RawFinding, artifactPath: string): string {
  return `${artifactPath}\0${finding.rule_id}\0${finding.location}\0${sha256Bytes(finding.matched)}`;
}

export function scanPrivacyInputs(root: string, inputs: readonly PrivacyInput[]): {
  artifacts: ScannedArtifact[];
  findings: PrivacyFinding[];
} {
  const artifacts: ScannedArtifact[] = [];
  const raw: Array<{ artifact_path: string; finding: RawFinding }> = [];
  for (const input of [...inputs].sort((left, right) => left.path.localeCompare(right.path, "en"))) {
    const absolute = resolveRegularFile(root, input.path);
    if (input.kind === "dom_snapshot_json" && extname(input.path).toLowerCase() !== ".json") {
      throw new Error(`DOM snapshot must be JSON: ${input.path}`);
    }
    const bytes = readFileSync(absolute);
    let text: string;
    try {
      text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch {
      throw new Error(`privacy input is not valid UTF-8 text: ${input.path}`);
    }
    for (const finding of rawFindingsFor(input.kind, text)) raw.push({ artifact_path: input.path, finding });
    artifacts.push({
      path: input.path,
      kind: input.kind,
      sha256: sha256Bytes(bytes),
      bytes: bytes.byteLength,
      finding_ids: [],
    });
  }
  const deduplicated = new Map<string, { artifact_path: string; finding: RawFinding }>();
  for (const item of raw) deduplicated.set(findingKey(item.finding, item.artifact_path), item);
  const ordered = [...deduplicated.values()].sort((left, right) => {
    const leftKey = `${left.artifact_path}\0${left.finding.location}\0${left.finding.rule_id}\0${sha256Bytes(left.finding.matched)}`;
    const rightKey = `${right.artifact_path}\0${right.finding.location}\0${right.finding.rule_id}\0${sha256Bytes(right.finding.matched)}`;
    return leftKey.localeCompare(rightKey, "en");
  });
  const findings = ordered.map(({ artifact_path, finding }, index): PrivacyFinding => ({
    id: `PF-${String(index + 1).padStart(4, "0")}`,
    artifact_path,
    rule_id: finding.rule_id,
    category: finding.category,
    location: finding.location,
    fingerprint_sha256: sha256Bytes(finding.matched),
  }));
  const idsByArtifact = new Map<string, string[]>();
  for (const finding of findings) {
    const ids = idsByArtifact.get(finding.artifact_path) ?? [];
    ids.push(finding.id);
    idsByArtifact.set(finding.artifact_path, ids);
  }
  for (const artifact of artifacts) artifact.finding_ids = idsByArtifact.get(artifact.path) ?? [];
  return { artifacts, findings };
}

export function videoArtifact(root: string, path: string): ScannedArtifact {
  const absolute = resolveRegularFile(root, path);
  const bytes = readFileSync(absolute).byteLength;
  return { path, kind: "video", sha256: sha256Path(absolute), bytes, finding_ids: [] };
}

export function imageArtifact(root: string, path: string): ScannedArtifact {
  const extension = extname(path).toLowerCase();
  if (!new Set([".png", ".jpg", ".jpeg", ".webp"]).has(extension)) throw new Error(`unsupported proof image: ${path}`);
  const absolute = resolveRegularFile(root, path);
  const content = readFileSync(absolute);
  const validPng = extension === ".png" && content.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const validJpeg = (extension === ".jpg" || extension === ".jpeg") && content[0] === 0xff && content[1] === 0xd8 && content.at(-2) === 0xff && content.at(-1) === 0xd9;
  const validWebp = extension === ".webp" && content.subarray(0, 4).toString("ascii") === "RIFF" && content.subarray(8, 12).toString("ascii") === "WEBP";
  if (!validPng && !validJpeg && !validWebp) throw new Error(`proof image signature does not match extension: ${path}`);
  return { path, kind: "image", sha256: sha256Path(absolute), bytes: content.byteLength, finding_ids: [] };
}
