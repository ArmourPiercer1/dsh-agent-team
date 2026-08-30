# G5 Gate (Round 2) — Blind Review Report, Reviewer 2

- **Gate target:** `int/P5` @ `9f5bd12647e4ba8da35f19c31782e5e21384848c` (Phase 5: Agent Binding / Member Lifecycle Substrate; six integrated tasks P5-T1…P5-T6)
- **Base:** `602590db1bb79ca45f505af636b13e331a209be4` (master after G4) — verified as ancestor of HEAD
- **Worktree (mine):** `D:\AgentDev\dsh-plugins\dsh-agent-team\.worktrees\G5-R2` (detached @ 9f5bd12, clean except sanctioned untracked `g5-review-harness-output/`)
- **Frozen-doc integrity:** **4/4 MATCH** — all four docs in the MAIN worktree re-hashed (SHA-256, bytes as-is) in phase 3 and equal the expected SHAs; phase 2 additionally matched all four against the permitted `dev/agent-workflow/evidence/provenance/file-manifest.json` `frozen_docs` section. `frozenDocCheck=match`.
- **Reviewer:** BLIND gate reviewer 2 (independent; leaf agent)
- **Date basis:** phase 2 runStamp `1788096812163`; phase 3 self-checks performed after.

## Verdict: 投机通过 (speculative pass)

All 8 G5 criteria (DevPlan §18.6 C1–C8) PASS on my own evidence; the sanctioned chain is fully green (leg2 929/0, tsc 0 diagnostics on all 4 type-checked packages, real-instance harness 9/9 scenarios green with I1B expected-fail-by-design); zero-core, private-import, and owned-boundary checks are clean; invariants compose. The verdict is 投机通过 rather than 通过 solely because of concrete minor findings (F1–F5) that do not threaten any invariant — none is structural.

## Criterion → evidence → PASS/FAIL

| # | Criterion (DevPlan §18.6) | Evidence (mine) | Result |
|---|---|---|---|
| C1 | Root fresh bind | Code (phase 3 re-verified): `root-binding/fresh-root.ts` — generation defaults to 1 + positive-integer validation (:107-114); kind mismatch → `ROOT_BINDING_SESSION_KIND_CONFLICT` (:122); absent TeamSession → durable put else exact `sameBlueprintRef`+generation match or `ROOT_BINDING_TEAM_SESSION_CONFLICT` (:138-165); binding put idempotent via `wrote` flag (:131-180); then `binder.bindFreshRoot` (:195). Unit: `test/p5t5-fresh-root.test.ts` (green in leg2). Harness S1 (boot1 :3180, row `p5t5-root-binding`): **15 assertions, pass, 0 failing** (disk `summary.json`) — durable writes, model assembled, tools===intersection, MCP tool `mcp__p5t5mini__ping` visible. | **PASS** |
| C2 | Root cold bind | Code: `root-binding/cold-root.ts` — `rehydrateColdTeamRoot` delegates to `binder.rehydrateColdRoot`; non-ordinary result requires the durable state to exist (else contract violation); `wrote:false` always (restore-only, zero-write read-only contract). Unit: `test/p5t5-cold-root.test.ts` (green). Harness S2 (boot2 :3181, cold boot with `resumeSessionId` + admission guard): **11 assertions, pass, 0 failing**. | **PASS** |
| C3 | Member fresh create setup | Code (phase 3 re-verified): `member-residency/fresh-member.ts` — root must be a bound team-root **with** a TeamSession record; I1A durability barrier `ports.sessionDurability.ensureDurable(childSessionId)` at **:186**, ordered BEFORE `putMemberInstance` (:235) and `putSessionBinding` (:273) — fail-closed with zero writes on rejection; `CREATED` record only if absent; spec mismatch → `MEMBER_RESIDENCY_RECORD_CONFLICT` ("an existing record can never be re-pointed"); `DISPOSED` → terminal lifecycle conflict; then `binder.bindFreshMember`. Unit: `test/p5t6-fresh-member.test.ts` (M1: derived identity, exactly `[putMemberInstance, putSessionBinding]` in order, artifact durable synchronously, persona = blueprint MEMBER persona; green). Harness M1 (boot3 :3180): **11 assertions, pass, 0 failing**; I1A (same boot, kill inside write window): **5 assertions, pass** — armed, windowObserved, stateAtKill `recordWritten=true, bindingWritten=false` (disk). | **PASS** |
| C4 | Member cold resume setup | Code: `member-residency/cold-member.ts` — absent → noop 'absent'; inconsistent binding → `RECORD_CONFLICT`; resumes the **same** `childSessionId`; `wrote:false`. Unit: `test/p5t6-cold-member.test.ts` (M2: zero durable writes this boot, durable model/selection survives restart via projection re-seed, events exactly `[scope-restored(member), admission-decided]`; green). Harness M2 (boot4 :3181): **9 assertions, pass, 0 failing**. | **PASS** |
| C5 | ordinary Agent unaffected | Code (phase 3 re-verified): `agent-setup/binder/binder.ts:251-260` — shared orchestration Step 1: `getSessionBinding` `undefined` or `'ordinary'` → immediate return `{bound:false, installed:false, noopReason:'ordinary', emittedEvents:[]}` **before** any record load, slot, guard, or surface call (zero-effect is structural). Unit: `test/p5t1-ordinary-noop.test.ts` (zero-write proof via seam write-log invariance; green). Harness: S4 ordinary no-op + M5 probe (boot3, `followup(rootAgent, memberChildId)` → `SubagentError UNAUTHORIZED`): **6 assertions, pass, 0 failing**. | **PASS** |
| C6 | persona semantics correct | Code: `agent-setup/persona/adapter.ts` — absent substrate → silent return; compatibility `team-persona-composition` (requirement `complete:true` vs env `available=(kind==='standard')`); non-PASS: only `TEAM_PERSONA_COMPLETE_PRESET_CONFLICT` allowed → `TeamPersonaOverlayError` FATAL before any work; other reasons → engine-contract TypeError; PASS → scoped identity (member text via `getMemberPersona`, root via `getLeaderPersona`); `templateId` is a content-lookup key only, never identity. Unit: `test/p5t2-persona-complete-fatal.test.ts` (cause-chain code, identical retry, member inheritance; green) + compatible/no-persona/cold-bind suites. Harness: S1/S2/M1/M2 all assert the assembled persona text is the blueprint MEMBER persona (real preset probed via `agents.create({meta:{agentPreset}})` + `systemPrompt.assemble`). | **PASS** |
| C7 | model future-boundary mutation correct | Code (phase 3 re-verified): `agent-setup/model/overlay.ts:152-155` — `beginRequest` captures `{...source.current()}` **per request** (copy; immutable for the request's lifetime); a concurrent `select(next)` source mutation takes effect from the NEXT `beginRequest` only; `undefined` carried losslessly, never defaulted. Unit: `test/p5t3-future-boundary.test.ts` (DevPlan §18.4 frozen sequence: request N = A; concurrent override → B; N remains A; N+1 uses B; plus member variant, in-flight convergence, double-bind no-op; green) + `p5t3-restart.test.ts`. Harness: S1 select + M2 durable model/selection survives restart. | **PASS** |
| C8 | runtime residency can be dropped without deleting Member | Code (phase 3 re-verified): `member-residency/evict.ts` — member must exist; lifecycle gate requires **SETTLED** (`MEMBER_RESIDENCY_LIFECYCLE_CONFLICT` otherwise, :100-108); child-session binding consistency check (`RECORD_CONFLICT` on corrupt world); `residencyPort.dropResidency(childSessionId)` — LIVE handle may be ABSENT (no-op, `residencyDropped:false`, not an error); **durable record + binding SURVIVE** — eviction removes only the in-process handle. Unit: `test/p5t6-evict-readmit.test.ts` (M3 record survives with lifecycle SETTLED, handle-absent evict succeeds, M4 exactly one team-member row never re-pointed, re-admit zero writes; green). Harness: M3 **8 assertions pass**, M4 **6 assertions pass**, re-admit via cold path (boot4). | **PASS** |

## Harness rerun summary (phase 2, independent execution — disk `g5-review-harness-output/summary.json` is truth)

Single serial run: `node packages/runtime/member-residency/harness/run.mjs --report-dir g5-review-harness-output` from my worktree root; job exit 0; wall ~17.3 s. Ports verified free before run; DSH_HOME `references/.dsh-test-p5t6` wiped+recreated by the harness.

Top level: `pass=true`, `failures=[]`, 77 assertions total, 0 failing.

| Boot | Port | Row mounted | Scenarios (assertions, result) | Health / stop |
|---|---|---|---|---|
| 1 | 3180 | p5t5-root-binding | S1 (15, PASS) | ok before+after; killed, portFree |
| 2 | 3181 | p5t5-root-binding | S2 (11, PASS) | ok before+after; killed, portFree |
| 3 | 3180 | p5t6-member-residency | M1 (11, PASS), M5 (6, PASS); I1A crash kill (5, PASS; armed, window observed, stateAtKill recordWritten=true/bindingWritten=false) | killed (by-design crash), portFree |
| 4 | 3181 | p5t6-member-residency | M2 (9, PASS), M3 (8, PASS), M4 (6, PASS) | ok (setupError null); killed, portFree |
| 5 | 3180 | p5t6-member-residency | I1C (6, PASS) — record-loss replay: writes exactly `[putMemberInstance]`, session exists exactly once (resumed, not recreated) | ok; killed, portFree |
| 6 | 3181 | p5t6-member-residency | none (by design) — I1B expected setup failure: `setupFailure.code = SCHEMA_VERSION_MISMATCH` == `expectedCode` (corrupted `team_domain` unit version 999), `fileUnchangedAfterFailedBoot=true` (no silent migration) | healthBefore/After null (boot failed by design); killed, portFree |

`run.log` (47 lines) corroborates every scenario line; no EPERM/warnings/retries/real errors (only matches are literal `"setupError":null` health keys).

**Chain legs:**
1. **leg2** `node scripts/run-tests.mjs`: **929 passed / 0 failed / 929 total** (1344 ms) — every package line PASS (contracts 107, domain 288, runtime incl. all 19 `p5t*` suites, storage, testkit, client, remote, tools).
2. **tsc** direct (`node node_modules/typescript/bin/tsc -p <pkg>/tsconfig.json`): storage=0, domain=0, contracts=0, runtime=0 diagnostics.
3. **harness**: as above — 9/9 scenarios green, I1B expected-fail by design.

Tooling compliance: sanctioned chain only (no pnpm run/exec, no vitest CLI/tsx/esbuild/vite); no `node:` builtin imports in any `.ts`; unit matcher surface limited to `toBe/toEqual/toBeGreaterThan/toThrow` (+`.not`).

## Phase-3 cross-checks and re-verifications (disk is truth)

- Read my on-disk `g5-review-harness-output/summary.json` in full (513 lines, via targeted extraction) and cross-checked against the embedded phase-2 JSON: **no disagreement** — top-level pass/failures, all 9 scenario results with exact assertion counts (15/11/11/6/9/5/8/6/6 = 77), boot6 `setupFailure` (code `SCHEMA_VERSION_MISMATCH` == expected, `corruptedVersion=999`, file unchanged), I1A/I1C detail blocks, `rowMounted` all six boots, `ports.released` all true, `stable3080` 200 before/after, `pristine` before/after (`cd5ef814…`, status+diff empty) all match.
- Frozen docs re-hashed independently in phase 3 (4/4 MATCH against the expected SHAs).
- Re-verified load-bearing phase-1 code pointers myself in phase 3: `binder.ts:251-260` (C5 early-return), `fresh-member.ts:186/235/273` (C3 barrier ordering), `model/overlay.ts:152-155` (C7 per-request capture), `evict.ts` SETTLED gate + dropResidency (C8), `fresh-root.ts:107-197` (C1 four-way semantics + idempotency), `capability/resolve.ts` (effective = available ∩ teamResolved ∩ externalHard, order-preserving, fail-closed `effective:[]` when seam not G2).
- Confirmed all 19 `p5t*.test.ts` suites present under `packages/runtime/test/`, including the four criterion-critical ones (`p5t1-ordinary-noop`, `p5t2-persona-complete-fatal`, `p5t3-future-boundary`, `p5t6-evict-readmit`).
- Worktree state at ruling time: HEAD `9f5bd12…`, base `602590db` is ancestor (`merge-base --is-ancestor` exit 0), `git status --porcelain` shows only the sanctioned untracked `g5-review-harness-output/`.

Phase-1 findings carried into this ruling (all re-checked where load-bearing): zero-core (upstream pristine at `cd5ef814…`, no patch-package/pnpm patch/postinstall, no package.json changes in delta); private imports (all 6 real `@deepseek-ai/dsh-*` import sources verified as public entry exports; production `.ts` and unit tests have zero upstream imports; remaining specifiers comments-only); owned boundaries (68/68 P5 source files inside owning task dirs; two cross-task touches both acceptable — `runtime/tsconfig.json` rootDir build glue; `testkit` p4t6 scan coverage 190→258 with independently verified arithmetic 189+68+1=258); invariants 18/19/21/23/24/30/31/33/41/42/46/48 code-verified, legacy-vocabulary negative control executed (258 files, 15 hits, all in the 2 quarantine files, 0 non-quarantine).

## Findings (severity)

- **F1 — minor (cosmetic, delivered code).** The human-readable `SCHEMA_VERSION_MISMATCH` message at `packages/storage/repositories/team-domain.ts:103` renders "team_domain is persisted at schema version **null**" instead of the corrupted version (999). Root cause verified in phase 3: the upstream seam's `version-mismatch` `StorageError` carries the version only in its free-form message text (e.g. `storage-sqlite/src/index.ts:106-109` in the pristine test-use tree) with no structured `details.found` for `seamErrorDetail()` to read, so the storage layer's `found` falls back to `null`. The stable error **code** (correctly classified from the seam's `version-mismatch`), the `details` payload shape, and fail-loud behavior are all correct; the I1B harness asserts the code, not the message. No invariant impact; purely cosmetic.
- **F2 — minor (my own phase-1 pointer precision, not a code defect).** Phase 1 cited "I1A durability barrier at `fresh-member.ts:48`"; line 48 lies in the module doc comment. The actual `ensureDurable` call site is `fresh-member.ts:186`, correctly ordered before both durable writes (:235, :273) — re-verified in phase 3. Semantics unchanged.
- **F3 — observation (harness).** Real-instance harness wall time ~17.3 s, well under the brief's 2–4 min estimate. Every boot/scenario/stop assertion is present in `summary.json` with no failure indicators (each DSH host boot ~2 s; scenario checks are HTTP-based). Recorded for completeness only.
- **F4 — cosmetic.** Final `run.log` line shows UTF-8 mojibake for an em dash in console encoding; no functional impact.
- **F5 — cosmetic (history).** An R35 commit note records a worker prose miscount (257) while the committed p4t6 scan assertion is 258; the committed value matches the actual 258-file scan. Prose only, no functional impact.

None of F1–F5 is structural, none threatens an invariant, and none changes any criterion ruling.

## Self-checks

- `frozenDocCheck`: **match** (4/4, phase-3 independent re-hash + phase-2 manifest cross-check).
- Upstream test-use pristine: HEAD `cd5ef8148158c3a752a658978873241fdf8e2bbc` with empty `git status --porcelain` and empty diff **before and after** the harness run (disk `summary.json.pristine`).
- Stable dev instance `:3080` / `D:\deepseek-harness\`: never touched; HTTP 200 before and after (disk `summary.json.stable3080`).
- Ports: verified free before the run; `ports.released` odd(3180)/even(3181)/mcp(3491) all `true` after (disk).
- Worktree: clean except sanctioned untracked `g5-review-harness-output/` (summary.json, per-scenario JSON + done-*.json, run.log, per-boot instance/dump-config logs); no files modified by me anywhere in phase 3.
- No node: builtin imports, matcher surface, or tooling-chain violations (phase 1 code audit, confirmed by phase-2 green leg2/tsc).

## Blindness-compliance statement

This reviewer did not read `dev/agent-workflow/SESSION_ROUTER_LOG.md`, `dev/agent-workflow/graph.yaml`, or any `dev/agent-workflow/evidence/**` file **except** `dev/agent-workflow/evidence/provenance/file-manifest.json` (permitted solely for the frozen_docs manifest cross-check in phase 2). All judgments rest on: the four frozen docs, `docs/ROUTER_RULES.md` and `docs/TEST_METHODS.md` (read first, per the repo prompt-injection rule), the delivered code in my worktree (tree + git history vs base `602590db…`), and my own fresh phase-2 test/harness executions. No other agent's output was consulted or awaited; no subagents were used (leaf agent); nothing was pushed; no edits were made outside my own worktree.
