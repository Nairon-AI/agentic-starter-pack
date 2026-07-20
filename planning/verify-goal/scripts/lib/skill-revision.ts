import { createHash } from "node:crypto";
import { lstatSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

const EXCLUDED_PATHS = new Set([
  "assets/current-client-evaluation.json",
]);
const EXCLUDED_NAMES = new Set(["node_modules", ".DS_Store"]);

export function computeSkillRevision(skillRoot: string): string {
  const files: string[] = [];
  const visit = (directory: string): void => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (EXCLUDED_NAMES.has(entry.name)) continue;
      const absolute = join(directory, entry.name);
      const path = relative(skillRoot, absolute).replaceAll("\\", "/");
      if (EXCLUDED_PATHS.has(path)) continue;
      if (entry.isDirectory()) visit(absolute);
      else if (entry.isFile()) files.push(path);
      else if (entry.isSymbolicLink()) throw new Error(`skill revision rejects symlink: ${path}`);
    }
  };
  visit(skillRoot);
  files.sort((left, right) => left.localeCompare(right));
  const hash = createHash("sha256");
  for (const path of files) {
    const absolute = join(skillRoot, path);
    const stat = lstatSync(absolute);
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`skill revision requires regular file: ${path}`);
    hash.update(path, "utf8");
    hash.update("\0", "utf8");
    hash.update(readFileSync(absolute).toString("hex"), "hex");
    hash.update("\0", "utf8");
  }
  return hash.digest("hex");
}
