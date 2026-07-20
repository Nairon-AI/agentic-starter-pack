# Browser proof standard

Apply only when user-facing browser behavior materially helps prove completion.

## Plan and scenarios

- Run automated assertions first, reset state, then record a clean replay.
- Record one independent MP4 per planned scenario. A causal multi-user scenario may switch among clearly labeled isolated pre-authenticated users.
- Preload authentication unless login is under test. Never record credentials.
- Default to 90 seconds or less. Extend only as needed, up to five minutes. Beyond five minutes, stop and report progress, stall cause, evidence, and requested extension.

## Capture

- Before browser work, run `preflight-browser-proof.ts <goal-dir> <planned-seconds>`. It fails on unsupported Node, missing `agent-browser`/ffmpeg/ffprobe, unwritable evidence directories, headed configuration, or insufficient duration-shaped disk reserve. Separately confirm the planned environment and identity aliases are reachable.
- Force `AGENT_BROWSER_HEADED=false` for every `agent-browser` command and never pass `--headed`; that flag enables a visible browser. Never use OS screen capture.
- Exercise visible controls as a user would. Re-snapshot after navigation or DOM changes.
- Use 1920x1080 unless criteria require another viewport.
- Register [../assets/human-cursor.js](../assets/human-cursor.js) as an init script before navigation. Move its DOM cursor and the browser mouse to target centers; show click feedback.
- Scroll through `window.__proofSmoothScrollTo(...)`; avoid coarse jumps.
- Capture `agent-browser stream` through [../scripts/capture-stream-60fps.ts](../scripts/capture-stream-60fps.ts). Keep capture and interactions in one uninterrupted orchestration to avoid dead air.
- Do not use native `agent-browser record` unless `ffprobe` proves its output is exact 60fps.
- Render H.264 MP4, `yuv420p`, 1920x1080, constant `60/1` FPS, and `+faststart`.
- During planned cursor, scroll, and zoom motion, allow rare one-frame or two-frame timing hiccups. Fail any three-frame repeated/stalled run or broadly choppy motion. Exclude intentional static holds.
- Apply only plan-marked shallow zooms through [../scripts/apply-shallow-zoom.ts](../scripts/apply-shallow-zoom.ts): normally 1.15x–1.30x, eased, centered on a meaningful control/result, then return to 1x. Never zoom every action.
- Validate final files with [../scripts/verify-proof-video.ts](../scripts/verify-proof-video.ts).
- Scan DOM, URLs, logs, and generated text with automated secret/PII rules. Use agent vision—not OCR—to watch the full video at normal speed, inspect screenshots, inspect scene changes and action boundaries, sample moving sections densely, and sample static holds less often. Remove secrets, personal data, long waits, setup noise, accidental UI, raw footage, and failed footage. Unresolved findings block upload.
- Allow the initial scenario attempt plus two clean automatic retries. After three total failures, record the repeated cause and block.

## Privacy review input

Before upload, write a goal-relative JSON spec with exact schema:

```json
{
  "schema_version": 1,
  "inputs": [
    { "path": "proof/automated/dom.json", "kind": "dom_snapshot_json" },
    { "path": "proof/automated/final-url.txt", "kind": "url" }
  ],
  "videos": [
    { "path": "proof/recordings/01-happy-path.mp4", "action_boundaries_seconds": [2.4, 5.1] }
  ],
  "screenshots": ["proof/screenshots/01-result.png"],
  "frame_output_directory": "proof/privacy-frames"
}
```

Run `prepare-privacy-review.ts <goal-dir> <spec-relative-path>`, inspect every listed screenshot and extracted video frame with agent vision, then write the exact receipt requested by the generated manifest. Upload and commit commands remain blocked until `validate-agent-vision-receipt.ts <goal-dir>` passes. Nonvisual packages still need the automated text scan, but no visual receipt.

## Per-recording recipe

1. Validate `proof-plan.md`; confirm exact steps, identity, expected results, and filename. Run the browser-proof preflight for this recording's duration.
2. Create a unique session. First browser command: `AGENT_BROWSER_HEADED=false agent-browser --session <name> --init-script <skill-dir>/assets/human-cursor.js open <url>`.
3. Set viewport 1920x1080. Get the stream port from `AGENT_BROWSER_HEADED=false agent-browser --session <name> --json stream status`.
4. Start `capture-stream-60fps.ts ws://127.0.0.1:<port> <raw.mp4> <seconds>`, immediately execute planned actions, then wait for capture.
5. Before clicks, read the target box; call `window.__proofCursorTo(x, y, duration, "MW-CURSOR-<N>")`, move the browser mouse to the same point, and click. Pass equally stable IDs to `__proofSmoothScrollTo`.
6. Assert visible and underlying outcomes while executing. Save `window.__proofTakeMotionEvents()` as JSON and record meaningful action times and target centers.
7. Run `apply-shallow-zoom.ts <raw.mp4> <final.mp4> '<x,y,startFrame,focusedFrame,releaseFrame,endFrameExclusive,maxZoom>' [...]`. Use integer output-frame positions only.
8. Run `build-motion-plan.ts <capture.json> <browser-motion-events.json> <motion-plan.json> --zoom-receipt <zoom.json> --video-path <final.mp4>`, then `verify-motion-quality.ts <final.mp4> <motion-plan.json> --capture-receipt <capture.json>` and `verify-proof-video.ts <final.mp4>`.
9. Prepare the privacy report, use agent vision to watch the full video and inspect every selected frame, write the exact-hash PASS receipt, then run `validate-agent-vision-receipt.ts`.
10. Delete raw footage only after all final validation passes. Close the headless session and perform planned reset before the next scenario.

A polished video supports the evidence; it never replaces assertions, logs, or data checks.
