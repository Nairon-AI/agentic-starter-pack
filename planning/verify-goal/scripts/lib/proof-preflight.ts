const MIB = 1024n * 1024n;
const GIB = 1024n * MIB;

export const MINIMUM_NODE = [22, 18, 0] as const;

export function nodeVersionSupported(version: string): boolean {
  const match = /^v?(\d+)\.(\d+)\.(\d+)/.exec(version);
  if (!match) return false;
  const actual = match.slice(1).map(Number);
  for (let index = 0; index < MINIMUM_NODE.length; index += 1) {
    if (actual[index]! > MINIMUM_NODE[index]!) return true;
    if (actual[index]! < MINIMUM_NODE[index]!) return false;
  }
  return true;
}

export function requiredProofBytes(durationSeconds: number): bigint {
  if (!Number.isSafeInteger(durationSeconds) || durationSeconds <= 0 || durationSeconds > 300) throw new Error("duration must be an integer from 1 to 300 seconds");
  return GIB + BigInt(durationSeconds) * 24n * MIB;
}
