#!/usr/bin/env node

import { resolve } from "node:path";
import { assertAgentVisionPass } from "./lib/agent-vision.ts";

const [goalDirectory, privacyManifestPath = "proof/privacy-report.json", receiptPath = "proof/automated/agent-vision-receipt.json"] = process.argv.slice(2);
if (!goalDirectory) {
  console.error("Usage: validate-agent-vision-receipt.ts <goal-dir> [privacy-report-relative-path] [agent-vision-receipt-relative-path]");
  process.exit(2);
}

const { manifest, receipt } = assertAgentVisionPass(resolve(goalDirectory), privacyManifestPath, receiptPath);
console.log(JSON.stringify({
  valid: true,
  status: receipt.status,
  artifacts: manifest.artifacts.length,
  frames: manifest.video_reviews.reduce((total, review) => total + review.frames.length, 0),
  reviewer_alias: receipt.reviewer_alias,
  reviewed_at: receipt.reviewed_at,
}, null, 2));
