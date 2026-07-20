#!/usr/bin/env node

import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { computeSkillRevision } from "./lib/skill-revision.ts";

const skillRoot = dirname(dirname(fileURLToPath(import.meta.url)));
console.log(JSON.stringify({ skill_root: skillRoot, skill_revision_sha256: computeSkillRevision(skillRoot) }, null, 2));
