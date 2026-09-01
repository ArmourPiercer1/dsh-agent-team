# P8-S4B TaskResult — Mutation → Actual Agent Closure (plan §18)

- task: P8-S4B (attempt 1/3) · branch `task/P8-S4B-mutation-agent` · worktree `.worktrees/P8S4B`
- base_sha `b33642e22a56088d46931cb015aeb9c567ac07dc` (baseline 1821/1821 + tsc 8/8)
- commits: `eaf87bb` implementation → evidence commit = HEAD at review (this file + `S4B-live/` + run.mjs label)

## Verdict
All owned-scope work complete and green; one out-of-scope testkit count pin blocks the all-PASS chain → **ARCHITECTURE_DECISION_REQUIRED** (Blockers).

## Implementation (owned paths only)
- `runtime/mutation/cell-provenance.ts` — per-cell §18.3 provenance derived on read from backend truth: `source` {layer,origin,recordId} always; `deniedBy` only when effective deny (external reason first, else team layer/origin/recordId); `unavailable` = external capabilityMissing; `pendingNextBoundary` = admitted-not-yet-applied records (no scope filter).
- `runtime/mutation/override-admission.ts` — `admitGovernanceOverride(args, store)`: server-side authority (leader/member/operator; member bound to own instance, team scope leader/operator only); closed cell vocab (model/mcp) with strict PolicyEntry; frozen slot winner (highest generation, tie → smallest recordId); optimistic `expectedGeneration`; cumulative re-issue (winner.values ∪ cells, NEW recordId, gen+1, `supersededRecordId`); storage RECORD_DUPLICATE → `OVERRIDE_IDENTITY_CONFLICT`.
- `runtime/agent-setup/model/durable-consumption.ts` — durable model selection: allow → first item; unspecified → baseline (world default, Team did not speak); explicit deny/external/malformed → no selection (row installs a deliberately-unroutable selection — never silently allowed).
- `runtime/agent-setup/capability/mcp-facet.ts` — **chosen G2-passed facet: `mcp`** (G2 proved streamable-http mount + real tool round-trip via the P5-T5 precedent; deny ⇒ dispose the mounted fiber ⇒ operation absent). allowed = effective allow ∧ ¬unavailable ∧ items ∋ (`*` or serverName), else fail-closed false.
- `runtime/mutation/errors.ts` (+3 codes) and barrels.
- Row wiring `tools/harness/plugin.mjs` (wiring only): per-session consumption state; boundary re-resolution on EVERY real request (submit/deliver/tool routes + makeAgentSetup); public model-selection seam (`installModelSelection`) with `{current,assembled}` ref; mini-MCP fiber mount/dispose per facet; `POST /__p6t6/governance/mutate` (authority derived server-side: root→operator, bound member→member; admission via the owned module, never repository-direct — §20.4); state route exposes backend truth: `governance.overrides` fresh from the store + per-session model/mcp views re-resolved on each read.
- Driver `tools/harness/run.mjs`: M1-M5 scenarios, `mutateGovernance` helper, `--mcp-ports`, `eWorldUsed` gating (M-only runs never create the E-world home, never touch boots 3-4/ports 3187-3188), skipEntry selected-gate.

## Tests (sanctioned toolchain only)
- `node scripts/run-tests.mjs` → **1880/1881** (baseline 1821 + 60 new; the single failure = out-of-scope testkit pin, see Blockers). New: p8s4b-override-admission 28/28, p8s4b-cell-provenance 10/10, p8s4b-model-consumption 11/11 (incl. D4 in-flight capture immutability), p8s4b-mcp-facet 11/11. **M6 (unit-level) = these 60.**
- `tsc -p packages/runtime/tsconfig.json` → exit 0. Tools tsconfig does not cover harness `.mjs`; `node --check` on plugin.mjs + run.mjs = 0.

## Live E2E (two independent runs, both PASS, 32 assertions)
`node packages/tools/harness/run.mjs --scenarios M1,M2,M3,M4,M5 --port 3185 --report-dir dev/agent-workflow/evidence/P8-S/S4B-live --dsh-home .dsh-test-p8s4b --lock-file references/.dsh-test-p8s4b.lock --mcp-ports 3493`
boot1 :3185 (fresh W-world DSH_HOME) → boot2 :3186 (same home, new host process); mini-MCP :3493 only.
- **M1 PASS(5)** real worker turn assembles baseline A; source `layer=unspecified`; token in durable member log.
- **M2 PASS(7)** operator mutation → human-override gen1; `pendingNextBoundary=[p8s4b-ovr-model]` BEFORE any request; next real request assembles B; source `{humanOverride,human,p8s4b-ovr-model}`.
- **M4 PASS(9)** baseline tool ABSENT (`ToolNotFoundError`, never silently allowed); allow → gen2 re-issue preserves model grant (`supersededRecordId`); pending before the operation; ping round-trips `pong:` against the real mini-MCP; `mounted=true`; deny → gen3; tool ABSENT again; `deniedBy={by:team,reason:teamDeny,layer:humanOverride,origin:human,recordId:p8s4b-ovr-mcp-deny}`.
- **M3 PASS(5)** fresh process: next real request still assembles B; log carries M1+M2+M3 tokens.
- **M5 PASS(6)** fresh process: still B; mcp STILL absent (restart-effective deny); all 3 override records durable; `mcp.source.recordId=p8s4b-ovr-mcp-deny`.
- Hygiene: stable :3080 = 200 before/after; test-use pristine before/after (HEAD `cd5ef81481…`, status empty); ports + lock released; bypass scan 0 violations; toolCount = 10.

## Acceptance mapping
- Model: in-flight stays A — unit-proven (seam snapshot order + D4 capture immutability); live proves boundary semantics (turn N assembles A, turn N+1 assembles B, still B after restart — M1/M2/M3).
- Capability: one G2-passed facet (mcp) → durable tighten/deny → next actual operation absent, never allowed (M4/M5); restart remains effective (M5).
- Provenance (§18.3): backend truth durably carries/derives-on-read source / suppressed / unavailable / deniedBy / pendingNextBoundary (state route + every evidence JSON). No projection surface (S6 scope).

## Blockers
- **ARCHITECTURE_DECISION_REQUIRED** — `packages/testkit/test/p4t6-session-event-scan.test.ts` pins `filesScanned === 490`. The 8 S4B-owned new files (4 modules + 4 suites) are correctly INCLUDED in that scanner's denylist scan (all 9 other suite tests pass over them) and merely raise the mechanical count to 498 → sanctioned chain is 1880/1881. testkit is outside §18.4 owned_paths (plan: "edit files outside owned_paths" FORBIDDEN), and parallel S4A will need the same pin update for its own files. Decision needed: (a) expand S4B/S4A scope so each updates pin + ledger line (the file's established per-task pattern), or (b) router applies one consolidated pin update at S4A/S4B integration. No S4B code change required under either option.

## Limitations
- No real LLM: turns settle at the model-call boundary; model evidence = row-managed selection ref (`current`/`assembled`) + durable session log.
- In-flight mid-turn A→B window is live-unobservable in the static world (milliseconds) → unit-proven only.
- MCP characterized over streamable-http only (sandbox denies piped stdio; matches G2/mini-MCP precedent).

## No-core assertion
CORE PATCH BUDGET = 0: zero upstream edits; behavior only via public seams (model-selection, plugin fiber, tool execution, storage repository port, route registration). Frozen-region diff vs base: `git diff b33642e..HEAD -- packages/contracts packages/remote` = empty; packages/domain, testkit, client, legacy, tools/src untouched.
