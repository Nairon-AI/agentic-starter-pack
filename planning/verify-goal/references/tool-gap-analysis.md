# Verification capability gap analysis

Run this after local research and before a goal can become Verified.

Use the repository's documented approved secrets vault first. Do not install, configure, recommend, or use Treg. If the vault cannot authenticate the required safe provider test account, pause for user-assisted direct CLI login; failed login keeps the contract Draft. Production access always requires separate explicit approval.

## 1. Model claims, not brands

For every success criterion, list the facts that must be observed. Include relevant UI, API, persisted data, async jobs, vendor state, telemetry, rollback, permissions, and failure handling. A recognizable vendor does not automatically determine the verifier.

Build this matrix in `GOAL.md`:

| Claim | Required evidence | Capability needed | Selected verifier | Local status/version | Setup/auth owner | Source/date | Fallback or blocker |
| --- | --- | --- | --- | --- | --- | --- | --- |

No cell may be hand-waved. “Manual check” must name the exact interface, action, observation, and identity.

## 2. Inventory locally first

Inspect repo tests, scripts, dependencies, configuration, runbooks, MCP servers, installed CLIs, approved test environments, fixtures, identities, and observability. Use read-only discovery such as `command -v <tool>`, `<tool> --version`, client MCP listings, and repository search. Do not expose secret values.

Prefer, in order:

1. Existing repo-native verifier.
2. Official vendor CLI, sandbox API, MCP, or test harness.
3. Smallest reputable reversible addition that proves the missing claim.

## 3. Require Exa MCP

Run one scoped Exa discovery pass after local inventory to confirm current verifier choices and find material gaps. Use `web_search_exa`, then `web_fetch_exa` for promising primary sources. Prefer official vendor docs, source repositories, standards, and first-party release notes. Record URLs, access dates, version applicability, conflicts, uncertainty, and facts vs inference.

Use Context7 first for exact current library/SDK/API documentation when available. Use Exa for verifier/tool discovery and broader ecosystem research; validate the selected tool against authoritative vendor documentation.

Before the first Exa query, check whether Exa tools are loaded. If absent, inspect the client's MCP server list. Do not duplicate an existing registration.

If Exa is not registered, install the hosted server at user scope:

```bash
# Codex
codex mcp add exa --url https://mcp.exa.ai/mcp

# Claude Code
claude mcp add --scope user --transport http exa https://mcp.exa.ai/mcp
```

For other MCP clients, add `https://mcp.exa.ai/mcp` to user-level configuration. The hosted endpoint needs no API key. Never put API keys in URLs or project files.

After installation, verify the server appears in the client list. Save the Draft contract, current capability matrix, frontier, and restart reason. Tell the user to restart the client and invoke `verify-goal` again, then stop. Do not claim Exa tools work before restart.

If installation fails, report the exact command and blocker. Continue only work independent of Exa; defer Exa-required conclusions. Never silently substitute weaker web research unless the user requests it.

## 4. Select and install a verifier

Choose the least powerful tool that can independently prove the required claim. Before installing, verify official source, package identity, supported OS/runtime, current version, license/cost, required privileges, data access, and cleanup.

Install automatically only when all are true:

- official or clearly authoritative distribution;
- user-scoped, reversible, non-privileged installation;
- no project dependency or lockfile mutation;
- no paid service, account creation, production access, or new credential;
- permitted by repository and user instructions.

Otherwise request approval. Never use unknown `curl | sh`, guess a package name, invoke `sudo`, or alter application dependencies merely to verify work.

After install, record the authoritative source, exact version applicability, checked time, freshness limit, and safe receipt path. Run a version/health check and a sandbox/test-mode capability smoke test proving the verifier can produce the needed evidence. Tool presence without useful output does not close the gap.

Treat authorization separately from installation. Name approved environment, identity, credential source, and owner without recording secret material. Missing access leaves the contract Draft/BLOCKED.

Keep goal-installed verifier tools and their safe test login after completion. Preserve pre-existing tools and authentication unchanged. A successor authenticates through the repository vault under their own identity and reruns the capability smoke test; never transfer credentials or CLI auth files.

## Stripe example

For billing work, first identify actual claims: event emitted, webhook delivered and signature-checked, retry/idempotency behavior, Stripe test-state transition, local database state, UI result, telemetry, and rollback.

Inventory repo webhook tests, Stripe SDK helpers, fixtures, logs, configured MCPs, and `stripe --version`. Use Exa to find current official verification options, then validate them in Stripe documentation. Stripe CLI may be best for test-mode event triggers and webhook forwarding; Stripe test clocks, sandbox APIs, or repo integration tests may better prove other claims.

If Stripe CLI is the smallest missing verifier, install it from Stripe's official supported channel under the safe-install rules. Use approved test-mode access only. Health-check it, exercise the smallest harmless test flow, and record what it can and cannot prove. Never assume CLI availability proves end-to-end billing correctness.
