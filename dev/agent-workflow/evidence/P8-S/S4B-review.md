# P8-S4B Review — Mutation -> Actual Agent Closure (independent task-level review)

VERDICT: APPROVE

## 1. Scope and worktree

- Review worktree (only work area): `D:/AgentDev/dsh-plugins/dsh-agent-team/.worktrees/P8S4B-R`, **detached** at evidence HEAD `93f86f318c67b709d0e06ff834fabe28969c03e5` (impl commit `eaf87bb`, base `b33642e22a56088d46931cb015aeb9c567ac07dc`).
- Mandated first step done: read `docs/ROUTER_RULES.md` and `docs/TEST_METHODS.md` before any task action; `dev/agent-workflow/evidence/P8-S/S4B-result.md` treated as **claims to verify, disk is truth**. Every claim below was re-derived from disk, the diff, and my own runs.
- Scope honored: verified only the acceptance checklist M1–M6, chosen-facet legitimacy, full test chain, tsc, frozen regions, and zero-core; full diff `b33642e..HEAD` reviewed hunk-by-hunk; sanctioned toolchain only (`node scripts/run-tests.mjs`, `tsc -p` ×8, `node --check` ×2, the one mandated live command). No `pnpm run/exec`, no vitest CLI/tsx/esbuild/vite, no other live scenarios. I edited **no** file other than this report and the mandated live report dir; nothing was committed.

## 2. Diff inventory and hunk coverage

`git diff b33642e22a56088d46931cb015aeb9c567ac07dc..93f86f318c67b709d0e06ff834fabe28969c03e5`: **31 files changed, +6718 / −47**. Composition (verified by full per-file `--stat`/`--numstat`):

| Group | Files | Lines |
| --- | --- | --- |
| Evidence (additions only) | 17 (`S4B-live/*` 16 + `S4B-result.md`) | +3794 |
| New runtime modules | 4: `mutation/override-admission.ts` (413), `mutation/cell-provenance.ts` (238), `agent-setup/model/durable-consumption.ts` (191), `agent-setup/capability/mcp-facet.ts` (155) | +997 |
| New tests | 4: `p8s4b-override-admission.test.ts` (449), `p8s4b-cell-provenance.test.ts` (233), `p8s4b-mcp-facet.test.ts` (227), `p8s4b-model-consumption.test.ts` (208) | +1117 |
| Modified runtime `.ts` (additive) | `mutation/errors.ts` (+27/−1: 3 new codes `OVERRIDE_IDENTITY_CONFLICT`, `OVERRIDE_GENERATION_CONFLICT`, `UNAUTHORIZED_MUTATION` added to `MUTATION_ERROR_CODE_VALUES`), barrels `mutation/index.ts` (+42), `model/index.ts` (+13), `capability/index.ts` (+13) | +95/−1 |
| Modified harness `.mjs` (wiring) | `tools/harness/plugin.mjs` (+408/−13), `tools/harness/run.mjs` (+307/−33) | +715/−46 |

**Hunk coverage: 100%.** Fully read: all 4 new runtime modules line-by-line; all 4 test files line-by-line; the entire 567-line `plugin.mjs` diff and the entire 472-line `run.mjs` diff (paginated in full, no hunks skipped); the 4 modified runtime `.ts` files in full; all 17 evidence files enumerated and spot-checked (incl. worker `summary.json`, per-scenario JSONs, `run.log`). All 47 deletions are confined to the 3 modified implementation files (1+13+33) — i.e., in-place edits of existing code that the hunk review covered.

## 3. PASS/FAIL table

| # | Check | Result | Evidence |
| --- | --- | --- | --- |
| M1 | Live: real worker turn assembles baseline model A | **PASS** | My live run M1 5/5 (`S4B-live-review/M1.json`): real `team_follow_up` turn on seeded worker `inst-p6t6seedw1`/`session-child-p6t6seedw1` assembles baseline A, `source.layer=unspecified`, token in durable member log. |
| M2 | Live: operator mutation → human-override gen1; boundary semantics | **PASS** | My live run M2 7/7: `pendingNextBoundary=["p8s4b-ovr-model"]` **before any request**; next real turn assembles B `{provider:"p6t6-static",model:"p6t6-model-v2"}` with `source {layer:"humanOverride",origin:"human",recordId:"p8s4b-ovr-model"}`. |
| M3 | Live: fresh process (boot2 resume) — next real request still assembles B; log carries M1+M2+M3 tokens | **PASS** | My live run M3 5/5 (`S4B-live-review/M3.json`); deps M3:[M1,M2] enforced by driver. |
| M4 | Live: MCP facet — baseline tool absent (never silently allowed) → allow → real round-trip → deny absent again | **PASS** | My live run M4 9/9: baseline `ToolNotFoundError`/`UNKNOWN_TOOL` for `mcp__p8s4bmini__ping`; allow gen2 (cumulative re-issue preserving model grant via `supersededRecordId`) → **real** `pong:p8s4b-m4-allow` over streamable-http mini-MCP :3493; deny gen3 → tool absent again, `deniedBy {by:"team",reason:"teamDeny"}`. |
| M5 | Live: fresh process — still B; MCP still absent (restart-effective deny); all 3 override records durable | **PASS** | My live run M5 6/6: model still B, mcp absent, 3 durable records (`p8s4b-ovr-model`, allow, `p8s4b-ovr-mcp-deny`) survive restart, `mcp.source.recordId=p8s4b-ovr-mcp-deny`. |
| M6 | Unit-level: 60 new tests (28+10+11+11) | **PASS** | All 60 pass in my own chain run (part of 1880 passing; baseline 1821 + 60 = 1881 total). Drives the **real frozen stack** (`resolveActivationPolicy` + `parseGovernanceOverride` + `selectPolicyOverrides` slot rule), not reimplementations. Includes D4 in-flight capture immutability (request N keeps A while concurrent select(B) happens; N+1 uses B) at `p8s4b-model-consumption.test.ts` L200–207. |
| 7 | Chosen-facet legitimacy (`mcp` via G2/P5-T5) | **PASS** | `mcp` is in the closed capability vocab `CAPABILITY_NAMES` (`packages/domain/policy/src/types.ts` L70/L82, `MCP: 'mcp'`) — not an invented facet. G2 review `G2-R1-SUMMARY.log`: VERDICT 投机通过 (speculative pass), all six DevPlan §15.4 criteria PASS. P5-T5 precedent: `public-surfaces.md` L44/L63 (`agent.ctx.plugin(mcpClient, cfg)` → `mcp__p5t5mini__ping`, JSON-RPC ping→pong) with `run-log.txt` PASS EXIT=0. My live M4 reproduced a real ping/pong round-trip on the same seam. No private/upstream API, no workaround. |
| 8 | Full sanctioned chain (my own run) | **PASS (with sanctioned exception)** | `node scripts/run-tests.mjs` → **1880 passed / 1 failed / 1881 total** (7981 ms). Sole failure = `packages/testkit/test/p4t6-session-event-scan.test.ts` (1/10) "expected 490 — actual: 498" — see pin ruling (§4). |
| 9 | tsc (my own runs) | **PASS** | `node node_modules/typescript/bin/tsc -p packages/<pkg>/tsconfig.json` ×8: client, contracts, domain, remote, runtime, storage, testkit, tools — all exit 0. |
| 10 | `node --check` on both harness `.mjs` | **PASS** | `packages/tools/harness/plugin.mjs` and `run.mjs` — both exit 0. |
| 11 | Frozen regions | **PASS** | `git diff b33642e..HEAD -- packages/contracts packages/remote` → **empty**; `packages/domain`, `packages/testkit`, `packages/client`, `packages/legacy`, `packages/tools/src` **untouched** (only `packages/tools/harness/*.mjs` modified, the driver-owned surface). |
| 12 | Zero-core pre | **PASS** | `references/deepseek-harness-test-use` HEAD = pinned `cd5ef8148158c3a752a658978873241fdf8e2bbc`, `git status` clean, checked before my live run. |
| 13 | Zero-core post | **PASS** | Same HEAD + clean status after my live run and teardown; `:3080` returned **200 both before and after**; stable instance and `D:/deepseek-harness/` never touched. |
| 14 | Wiring-only, `plugin.mjs` | **PASS** | Hunk-reviewed: `consumptionState` Map is per-process and cleared at row stop; `resolveConsumptionViews(sessionId)` re-reads `domain.repositories.overrides.list(rootSid)` **fresh on every call** (per-request boundary re-resolution); `makeAgentSetup` installs the row-owned `{current,assembled}` ref via public `installModelSelection(agentCtx, ref)` and fail-closed `DENIED_SELECTION={provider:'p8s4b-denied',model:'p8s4b-denied'}` when no selection; `prepareAgentForRequest` runs before submitAttributedInput / workDelivery.deliver / tool route (in-flight turns keep their own assembly snapshot — consistent with seam semantics); `reconcileMcp` mounts/disposes the fiber via public `agentCtx.plugin(mcpClient,{transport:'streamable-http',serverName:'p8s4bmini',url:http://127.0.0.1:<port>/mcp,...})` and fails closed on activation error; `POST /__p6t6/governance/mutate` derives authority **server-side** (`as===rootSid`→operator; bound member child via `memberInstances.list`→member; else 403) and calls the owned `admitGovernanceOverride` (error map MALFORMED→400, UNAUTHORIZED→403, conflict→409). **No second Team authority, no client-side truth re-derivation, no bypass of the owned admission module.** |
| 15 | Wiring-only, `run.mjs` | **PASS** | Hunk-reviewed: M1–M5 scenario fns + `mutateGovernance` helper (hits the row route only) + `--mcp-ports` parse/validate → `startMiniMcpServer`; `eWorldUsed = selected.some(sc=>sc.startsWith('E'))` gates ports C/D check, E-home creation, boots 3–4, and `VERDICT_BOOTS` (M-only run: boot1/boot2 only — my run booted exactly :3183/:3184 + mini :3493); skipped-UNSELECTED scenarios no longer fail the verdict; `SCENARIO_DEPS` M3:[M1,M2], M4:[M2], M5:[M4]. **No hunk inside any existing `runE*`/`runW*` function; no shared behavior altered.** |
| 16 | Invariant: frozen policy stack consumed, not modified | **PASS** | Activation-layer files (`resolveActivationPolicy`, `selectPolicyOverrides`, v1 empty-envelope rule) are in frozen/untouched regions (#11) and the new modules only **call** them; slot-rule winner selection (highest generation, tie → smallest recordId) is exercised by 28+10 tests against the real stack. |
| 17 | Invariant: v1 empty-envelope fail-closed + invariant 34 (human layer outranks autonomy layers) | **PASS** | `cell-provenance.ts` derives the six §18.3 provenance fields (`effective/source/suppressed/unavailable/deniedBy/pendingNextBoundary`) purely from frozen `EffectivePolicy` + durable records; autonomy-overlay GRANTS fail closed, only DENYs + human overrides grant cells; proven by P1–P7 tests and live M2/M4 (`deniedBy {by:"team"}` vs humanOverride source). |
| 18 | Invariant: closed capability vocab / closed error codes | **PASS** | Facet keys come from `CAPABILITY_NAMES` (closed set, #7); new mutation errors appended to `MUTATION_ERROR_CODE_VALUES` additively (`errors.ts` L114–116), no existing code touched. |
| 19 | Invariant: no module-level state in new runtime modules | **PASS** | `durable-consumption.ts` / `mcp-facet.ts` / `cell-provenance.ts` verified stateless (pure fns); the only state in the harness is `consumptionState`, correctly scoped per-process and cleared at row stop. |
| 20 | No out-of-scope changes | **PASS** | Entire diff = the 31 files in §2; nothing else modified, added, or deleted; no commits by reviewer; no temp files beyond this report + mandated live report dir. |
| 21 | No private/upstream workaround | **PASS** | Only public DSH seams used (`installModelSelection`, `agentCtx.plugin` MCP fiber, storage `overrides` repository port); zero-core pre+post (#12/#13); CORE PATCH BUDGET = 0 held. |

## 4. Pin ruling (gate ruling R66) — verified, not failed

Mandated three-point verification of the expected p4t6 chain failure, all confirmed:

1. **Sole chain failure:** my own chain run produced exactly one failure — `packages/testkit/test/p4t6-session-event-scan.test.ts` (1/10, "actual toBe 490 — actual: 498"); 1880/1881 otherwise green.
2. **Zero worker edits to `packages/testkit`:** `git diff b33642e..HEAD -- packages/testkit` is **empty** (also covered by frozen-region check #11).
3. **Count 498 matches disk:** full disk scan of `packages/` (excl. `node_modules`) = 500 `.ts/.mts/.mjs`; minus the scanner's 2 self-exclusions (`session-event-scan.mjs` + its test) = **498** = pinned 490 + exactly the 8 new `.ts` files added by this diff (4 modules + 4 tests), 0 deleted.

Per R66 the worker-owned paths excluded `packages/testkit`, so the stale pin is the **sanctioned expected exception**, deferred to integration. It is NOT a task failure; the pin consolidation (bump 490→498 or re-scope) belongs to the integration step.

## 5. My own authoritative live re-run (mandatory)

Command (from worktree root, exactly as mandated):

```
node packages/tools/harness/run.mjs --scenarios M1,M2,M3,M4,M5 --port 3183 \
  --report-dir dev/agent-workflow/evidence/P8-S/S4B-live-review \
  --dsh-home .dsh-test-p8s4b-r --lock-file references/.dsh-test-p8s4b-r.lock --mcp-ports 3493
```

- **Result: PASS, exit 0** (runStamp `p8s3-1788244942999`). boot1=**:3183**, boot2=**:3184**, mini-MCP=**:3493** — only these ports; home+lock landed under MAIN-tree `references/` as expected (E-world home `.dsh-test-p8s4b-r-e` was **not** created — M-only gating confirmed live).
- Assertions: **M1 5/5, M2 7/7, M3 5/5, M4 9/9, M5 6/6 = 32/32**.
- Key closure evidence captured in `dev/agent-workflow/evidence/P8-S/S4B-live-review/` (`run.log`, `summary.json`, `M1.json`–`M5.json`, `dump-config-boot1/2.txt`, `logs/`): M2 `pendingNextBoundary=["p8s4b-ovr-model"]` **before** any request, next real turn assembles B with `source {layer:"humanOverride",origin:"human",recordId:"p8s4b-ovr-model"}`; M4 baseline `ToolNotFoundError`/`UNKNOWN_TOOL` → allow gen2 real `pong:p8s4b-m4-allow` round-trip → deny gen3 absent again with `deniedBy {by:"team",reason:"teamDeny"}`; M5 all three durable override records survive restart.
- Hygiene: preflight `GET :3080` = 200 **before** the run; **200 after**; ports 3183/3184/3493 free post-run; lock released by driver on own-marker match (no `.lock` under `references/`); reviewer then removed the leftover live home `references/.dsh-test-p8s4b-r` (git-ignored test infra, see §7) — no `p8s4b-r` artifacts remain in the MAIN tree.

## 6. Comparison with workers' live run

Workers' `S4B-live/` (ports 3185/3186 + 3493, home `.dsh-test-p8s4b`): PASS, 32/32, per-scenario **M1 5/5, M2 7/7, M3 5/5, M4 9/9, M5 6/6** — **identical** to my independent run. Only port/home names differ (mandated different values). The two runs agree on every assertion, proving the closure behavior is deterministic, not run-specific.

## 7. Non-blocking concerns

1. **Stale p4t6 pin (490 vs 498).** Integration must bump/consolidate the session-event-scan pin when S4B lands; workers flagged `ARCHITECTURE_DECISION_REQUIRED` and gate ruling R66 covers it. Deferred by ruling, not by choice.
2. **Driver leaves `DSH_HOME` behind on success** (observed: my `.dsh-test-p8s4b-r` persisted after a PASS run; historical homes `.dsh-test-p5t5`, `.dsh-test-p6t6`, `.dsh-test-p8s4b`, … all remain under `references/`). Pre-existing driver behavior, not introduced or worsened by S4B (no hunk touches home cleanup on the success path). Reviewer manually removed its own home to satisfy the mandated final state. Consider a driver-side `--clean-home` later.
3. **Cosmetic:** boot `instance-port*.log` files are single-line markers and the run.log boot-log section shows garbled UTF-8 on this console; the `task:` summary string wording in the harness changed slightly. None affects verdicts or assertions.

## 8. Final worktree state

`git -C .worktrees/P8S4B-R status --porcelain` (reviewer's worktree, detached at `93f86f318c67b709d0e06ff834fabe28969c03e5`):

```
?? dev/agent-workflow/evidence/P8-S/S4B-live-review/
?? dev/agent-workflow/evidence/P8-S/S4B-review.md
```

Only the two mandated untracked entries (this report + my mandated live report dir). No modified files, no staged files, no commits, no branches. MAIN tree: zero `p8s4b-r` artifacts under `references/`; `references/deepseek-harness-test-use` pristine at pin `cd5ef8148158c3a752a658978873241fdf8e2bbc` with clean status; stable instance `:3080` untouched (200 throughout).
