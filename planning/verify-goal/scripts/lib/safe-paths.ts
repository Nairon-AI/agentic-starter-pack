import { createHash } from "node:crypto";
import {
  lstatSync,
  readFileSync,
  readdirSync,
  realpathSync,
  statSync,
} from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";

export function sha256Bytes(value: Uint8Array | string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function sha256Path(path: string): string {
  return sha256Bytes(readFileSync(path));
}

export function assertPortableRelativePath(path: string): void {
  if (typeof path !== "string" || path.length === 0) throw new Error("path must be non-empty");
  if (path.includes("\0")) throw new Error(`path contains NUL: ${JSON.stringify(path)}`);
  if (path.includes("\\")) throw new Error(`path contains backslash: ${path}`);
  if (path.normalize("NFC") !== path) throw new Error(`path is not NFC-normalized: ${path}`);
  if (isAbsolute(path) || path.startsWith("/") || path.startsWith("~") || /^[A-Za-z]:/.test(path)) {
    throw new Error(`path must be relative: ${path}`);
  }
  const parts = path.split("/");
  if (parts.some((part) => part === "" || part === "." || part === "..")) {
    throw new Error(`path contains empty, dot, or traversal segment: ${path}`);
  }
}

function isInside(root: string, target: string): boolean {
  const rel = relative(root, target);
  return rel === "" || (!rel.startsWith(`..${sep}`) && rel !== ".." && !rel.startsWith(sep));
}

export function resolveRegularFile(root: string, relativePath: string): string {
  assertPortableRelativePath(relativePath);
  const canonicalRoot = realpathSync(root);
  let cursor = canonicalRoot;
  for (const segment of relativePath.split("/")) {
    cursor = resolve(cursor, segment);
    const metadata = lstatSync(cursor);
    if (metadata.isSymbolicLink()) throw new Error(`symlink forbidden: ${relativePath}`);
  }
  const canonicalTarget = realpathSync(cursor);
  if (!isInside(canonicalRoot, canonicalTarget)) throw new Error(`path escapes root: ${relativePath}`);
  if (!statSync(canonicalTarget).isFile()) throw new Error(`nonregular file forbidden: ${relativePath}`);
  return canonicalTarget;
}

export function resolveDirectory(root: string, relativePath: string): string {
  assertPortableRelativePath(relativePath);
  const canonicalRoot = realpathSync(root);
  let cursor = canonicalRoot;
  for (const segment of relativePath.split("/")) {
    cursor = resolve(cursor, segment);
    const metadata = lstatSync(cursor);
    if (metadata.isSymbolicLink()) throw new Error(`symlink forbidden: ${relativePath}`);
  }
  const canonicalTarget = realpathSync(cursor);
  if (!isInside(canonicalRoot, canonicalTarget)) throw new Error(`path escapes root: ${relativePath}`);
  if (!statSync(canonicalTarget).isDirectory()) throw new Error(`not a directory: ${relativePath}`);
  return canonicalTarget;
}

export function listRegularFiles(root: string, relativeDirectory: string): string[] {
  const start = resolveDirectory(root, relativeDirectory);
  const output: string[] = [];
  const visit = (directory: string, prefix: string): void => {
    for (const name of readdirSync(directory).sort((left, right) => left.localeCompare(right, "en"))) {
      if (name.normalize("NFC") !== name) throw new Error(`path is not NFC-normalized: ${prefix}${name}`);
      const absolute = resolve(directory, name);
      const relativePath = `${prefix}${name}`;
      const metadata = lstatSync(absolute);
      if (metadata.isSymbolicLink()) throw new Error(`symlink forbidden: ${relativeDirectory}/${relativePath}`);
      if (metadata.isDirectory()) {
        visit(absolute, `${relativePath}/`);
      } else if (metadata.isFile()) {
        output.push(`${relativeDirectory}/${relativePath}`);
      } else {
        throw new Error(`nonregular file forbidden: ${relativeDirectory}/${relativePath}`);
      }
    }
  };
  visit(start, "");
  return output;
}

export function assertNoPortableCollisions(paths: readonly string[]): void {
  const exact = new Set<string>();
  const folded = new Map<string, string>();
  const normalized = new Map<string, string>();
  for (const path of paths) {
    assertPortableRelativePath(path);
    if (exact.has(path)) throw new Error(`duplicate path: ${path}`);
    exact.add(path);
    const nfc = path.normalize("NFC");
    const existingNfc = normalized.get(nfc);
    if (existingNfc && existingNfc !== path) throw new Error(`NFC path collision: ${existingNfc} and ${path}`);
    normalized.set(nfc, path);
    const key = nfc.toLowerCase();
    const existingFolded = folded.get(key);
    if (existingFolded && existingFolded !== path) throw new Error(`case path collision: ${existingFolded} and ${path}`);
    folded.set(key, path);
  }
}
