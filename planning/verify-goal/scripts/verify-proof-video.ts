#!/usr/bin/env node

import { buildProofVideoReceipt, writeJsonAtomic } from "./lib/video-proof.ts";

const [videoPath, ...flags] = process.argv.slice(2);
if (!videoPath) {
  console.error("Usage: verify-proof-video.ts <video.mp4> [--receipt <video-receipt.json>]");
  process.exit(2);
}

let receiptPath: string | undefined;
for (let index = 0; index < flags.length; index += 2) {
  if (flags[index] !== "--receipt" || !flags[index + 1]) {
    console.error("Usage: verify-proof-video.ts <video.mp4> [--receipt <video-receipt.json>]");
    process.exit(2);
  }
  receiptPath = flags[index + 1];
}

const receipt = await buildProofVideoReceipt(videoPath);
if (receiptPath) await writeJsonAtomic(receiptPath, receipt);
if (!receipt.valid) {
  console.error(`Proof video validation failed:\n- ${receipt.failures.join("\n- ")}`);
  process.exit(1);
}
console.log(JSON.stringify(receipt));
