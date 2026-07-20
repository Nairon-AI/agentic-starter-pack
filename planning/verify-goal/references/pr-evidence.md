# PR evidence and local cleanup

Apply to code goals delivered through an authorized GitHub pull request. This release does not support proof upload to other PR providers.

Recheck GitHub's current [file-attachment guidance](https://docs.github.com/en/get-started/writing-on-github/working-with-advanced-formatting/attaching-files) before upload. The documented REST issue-comment endpoint accepts comment text, not a binary upload field; never infer a private attachment API from it.

After mandatory privacy checks pass, upload sanitized proof without a separate link-visibility prompt. GitHub anonymized attachment URLs may work for anyone who receives the link, even when the repository is private. Never upload evidence that still contains secrets, personal data, or unapproved sensitive material.

## Preflight

- Confirm the PR exists, tested commit SHA matches, comment/upload authority exists, repository visibility is understood, and repository PR rules permit the action.
- Inspect every artifact for secrets, credentials, personal data, internal URLs, unrelated accounts, and accidental UI. Mask or recreate unsafe evidence.
- Check the provider's current attachment types and size limits before rendering. For GitHub, H.264 MP4 is preferred; historically images allow 10 MB and video allows 10 MB on free plans or 100 MB on paid plans. Treat these as research leads, not timeless limits.
- Compress or split only at coherent scenario boundaries. Do not degrade evidence below legibility.

## Publish proof

Post one additive, labeled verification-evidence PR comment containing:

- tested commit SHA and environment;
- scenario/result matrix;
- every final planned MP4;
- every planned screenshot;
- links or concise summaries for automated/data/log evidence;
- deviations and residual risks.

Preserve the repository PR template, bot-owned content, and self-heal workflow. Never overwrite unrelated PR text.

Use authenticated headless browser automation with GitHub's documented web comment file picker or drag/drop flow. Force `AGENT_BROWSER_HEADED=false` and omit `--headed`. If safe automation cannot upload, ask the user to attach the exact files, then resume verification. Never use a private or undocumented upload endpoint.

## Verify and retain through review

1. Re-open the posted comment.
2. Verify every remote image/video attachment resolves and matches its scenario.
3. Record comment URL, attachment URLs, tested commit SHA, and timestamp in `proof-results.md`.
4. Keep every local final MP4 while the PR is open. Set workflow phase to `awaiting_merge`.

## Finalize after merge

1. Require the PR to be merged and its tested head SHA to match the recorded proof commit.
2. Re-download every attachment and require exact byte size and SHA-256 equality with the retained local file.
3. Atomically record PR, comment, attachment URL, tested head SHA, merge SHA, local/remote sizes and hashes, timestamp, and cleanup state.
4. Delete only the exact verified local MP4, confirm absence, then mark cleanup complete.
5. Retain `GOAL.md`, plan/results, safe automated evidence, and remote receipts. Screenshots and videos remain PR attachments, not committed binaries.

Run `finalize-pr-evidence.ts proof/execution-results.json` for the authoritative GitHub/head/comment/download/hash check and crash-safe deletion. Supply `GITHUB_TOKEN` through the repository vault without writing it into the goal package. A failed command must leave the MP4 local and the results BLOCKED.

If the PR is absent, closed without merge, changed after proof, inaccessible, missing its evidence comment, or fails upload/download/hash/size verification, retain every local MP4 and report BLOCKED. Never delete unverified evidence. GitHub's anonymized attachment URLs may be accessible without repository authentication; textual evidence must make results understandable without video.
