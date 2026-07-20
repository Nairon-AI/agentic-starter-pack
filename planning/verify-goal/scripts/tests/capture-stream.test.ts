import assert from "node:assert/strict";
import { execFile, execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { promisify } from "node:util";
import type { Duplex } from "node:stream";
import type { CaptureReceipt } from "../lib/capture-receipt.ts";
import { probeProofVideo } from "../lib/video-proof.ts";

const execFileAsync = promisify(execFile);

function webSocketFrame(payload: Buffer): Buffer {
  if (payload.length <= 125) return Buffer.concat([Buffer.from([0x81, payload.length]), payload]);
  if (payload.length <= 65_535) {
    const header = Buffer.alloc(4);
    header[0] = 0x81;
    header[1] = 126;
    header.writeUInt16BE(payload.length, 2);
    return Buffer.concat([header, payload]);
  }
  const header = Buffer.alloc(10);
  header[0] = 0x81;
  header[1] = 127;
  header.writeBigUInt64BE(BigInt(payload.length), 2);
  return Buffer.concat([header, payload]);
}

async function startFrameServer(jpeg: Buffer): Promise<{ url: string; close: () => Promise<void> }> {
  const sockets = new Set<Duplex>();
  const server = createServer();
  server.on("upgrade", (request, socket) => {
    const key = request.headers["sec-websocket-key"];
    assert.equal(typeof key, "string");
    const accept = createHash("sha1").update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`).digest("base64");
    socket.write(
      "HTTP/1.1 101 Switching Protocols\r\n" +
      "Upgrade: websocket\r\n" +
      "Connection: Upgrade\r\n" +
      `Sec-WebSocket-Accept: ${accept}\r\n\r\n`,
    );
    sockets.add(socket);
    const payload = webSocketFrame(Buffer.from(JSON.stringify({ type: "frame", data: jpeg.toString("base64") })));
    socket.write(payload);
    const timer = setInterval(() => socket.write(payload), 5);
    socket.on("close", () => {
      clearInterval(timer);
      sockets.delete(socket);
    });
    socket.on("error", () => clearInterval(timer));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("fixture server did not bind TCP");
  return {
    url: `ws://127.0.0.1:${address.port}`,
    close: async () => {
      for (const socket of sockets) socket.destroy();
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    },
  };
}

test("capture writes deadline/source hash timing receipt and strict CFR60 MP4", async (t) => {
  const directory = mkdtempSync(join(tmpdir(), "verify-goal-capture-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const jpegPath = join(directory, "frame.jpg");
  execFileSync("ffmpeg", [
    "-hide_banner", "-loglevel", "error",
    "-f", "lavfi", "-i", "color=c=blue:size=640x360",
    "-frames:v", "1", jpegPath,
  ]);
  const fixture = await startFrameServer(readFileSync(jpegPath));
  t.after(fixture.close);
  const videoPath = join(directory, "capture.mp4");
  const receiptPath = join(directory, "capture.json");
  await execFileAsync(process.execPath, [
    "scripts/capture-stream-60fps.ts",
    fixture.url,
    videoPath,
    "0.1",
    "--receipt", receiptPath,
  ], { cwd: new URL("../..", import.meta.url) });

  const receipt = JSON.parse(readFileSync(receiptPath, "utf8")) as CaptureReceipt;
  assert.equal(receipt.status, "passed");
  assert.equal(receipt.targetFrameCount, 6);
  assert.equal(receipt.outputSlots.length, 6);
  assert.ok(receipt.sourceFrames.length >= 1);
  assert.match(receipt.outputSha256, /^[a-f0-9]{64}$/);
  for (const slot of receipt.outputSlots) {
    assert.match(slot.sourceSha256, /^[a-f0-9]{64}$/);
    assert.match(slot.latenessNs, /^\d+$/);
  }
  const validation = probeProofVideo(videoPath);
  assert.equal(validation.valid, true, validation.failures.join("\n"));
});
