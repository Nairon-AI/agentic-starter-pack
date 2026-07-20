import assert from "node:assert/strict";
import test from "node:test";
import { nodeVersionSupported, requiredProofBytes } from "../lib/proof-preflight.ts";

test("proof preflight enforces Node 22.18 and duration-shaped disk reserve", () => {
  assert.equal(nodeVersionSupported("v22.17.9"), false);
  assert.equal(nodeVersionSupported("v22.18.0"), true);
  assert.equal(nodeVersionSupported("v26.5.0"), true);
  assert.ok(requiredProofBytes(300) > requiredProofBytes(90));
  assert.throws(() => requiredProofBytes(301), /1 to 300/);
});
