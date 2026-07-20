# Readiness, lease, and handoff

`verification-readiness.yaml` contains strict JSON syntax, which is valid YAML 1.2. This keeps it dependency-free and deterministic: parse it with `JSON.parse`; do not add comments, anchors, tags, or YAML-only syntax.

## Contract source

- Edit readiness and `proof/proof-plan.md` only.
- Run `render-goal.ts` after each edit. Never hand-edit `GOAL.md`.
- Keep every ID stable: `SC-*` criterion, `CL-*` claim, `CP-*` capability, `RISK-*` material risk, `V-*` verifier, `S-*` scenario, `AR-*` artifact.
- Maintain bidirectional links. Validators reject missing, duplicate, orphaned, stale, failed, or contradictory links.
- Before Verified, require complete Exa sources, repository-vault status, verifier source/version/install/auth/smoke receipts, no blockers, no unresolved questions, exact source hashes, and a released authoring lease.

## Lease

One writer owns a goal at a time. Every mutation compares the current workflow revision, exact readiness SHA-256, owner, and run ID. Use the hash printed by the generator, checkpoint, or validator.

```bash
# Existing owner checkpoint
node <skill-dir>/scripts/checkpoint-readiness.ts goals/<slug> \
  --expected-revision <N> --expected-sha256 <HASH> \
  --owner <alias> --run-id <id> --action checkpoint

# Clean release / later acquire
node <skill-dir>/scripts/checkpoint-readiness.ts goals/<slug> \
  --expected-revision <N> --expected-sha256 <HASH> \
  --owner <alias> --run-id <id> --action release
node <skill-dir>/scripts/checkpoint-readiness.ts goals/<slug> \
  --expected-revision <N+1> --expected-sha256 <NEW-HASH> \
  --owner <successor> --run-id <new-id> --action acquire

# Crashed-owner takeover
node <skill-dir>/scripts/checkpoint-readiness.ts goals/<slug> \
  --expected-revision <N> --expected-sha256 <HASH> \
  --owner <successor> --run-id <new-id> \
  --action takeover --reason "<auditable reason>"
```

Stale revision means stop, reload, compare source hashes, reconcile, then retry. Never overwrite newer readiness state.

## Human/agent handoff

1. Stop mutations and checkpoint exact frontier, blockers, next action, branch, and safe receipts.
2. Run validators and privacy scan.
3. Release the lease.
4. Run `list-sanitized-commit-files.ts`; stage only its explicit paths.
5. Commit the scoped sanitized package. Push or create a Draft PR only with explicit repository authorization.
6. The successor checks out the checkpoint, validates hashes/revision, claims the lease, authenticates to the repository vault under their own identity, and reruns capability checks.

Never transfer tokens, raw secrets, CLI auth files, cookies, keychain data, or machine-local paths. Handoff carries only safe vault references and receipts.

## Lifecycle states

- `authoring`: Draft; active author lease.
- `ready`: Verified; released lease; safe to start through `/goal`.
- `executing`: Verified; active executor lease.
- `awaiting_merge`: proof passed and uploaded; active executor monitors PR; local MP4 remains.
- `complete`: PR merged when applicable, remote hash rechecked, local MP4 deleted, lease released.
- `blocked`: exact blocker recorded, only evidence retained, lease released.

For no-PR delivery, keep final MP4 locally indefinitely. Disk preflight must include this permanent retention.
