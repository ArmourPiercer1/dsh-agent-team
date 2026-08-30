# G6 Gate Review — Reviewer 3 (blind, independent)

- Reviewer: 3 of 3 (leaf; no subagents)
- Worktree: `D:\AgentDev\dsh-plugins\dsh-agent-team\.worktrees\G6-R3` (branch `g6-review-r3`)
- Delta under review: `11b0584473c78e6d1aed179f3a06b5fb7fa0db2d` (pre-P6 master = G5 pass) .. `54950fb60f60d2318cc2e10af800e37c50f87192` (int/P6 tip)
- Phase P6 = Activation runtime + Team tools + orchestration E2E
- Frozen docs verified: TaskDoc `2b457cc0…888a3`, DevPlan `a05d237f…d881d0f`, Arch `030dfb8e…7870c53`, UI `3ef3ab69…c4981e` (SHA-256 match brief AND `provenance/file-manifest.json frozen_docs`)
- Method: brief §6 six-step protocol, executed personally; in-tree reports treated as claims and independently re-verified.

## Step 1 — Canonical chain (own worktree, own runs)

| Leg | Command | Result | Log |
| --- | --- | --- | --- |
| install | `pnpm install --ignore-scripts` | exit 0 | `chain-leg1-install.log` |
| full tests | `node scripts/run-tests.mjs` (all 9 pkgs) | **1214/1214 pass, RESULT: PASS, exit 0** | `chain-leg2b-runtests-utf8.log` |
| tsc ×5 | `node node_modules/typescript/bin/tsc -p packages/<pkg>/tsconfig.json` for contracts, domain, storage, runtime, testkit | **all EXITCODE=0** | `chain-leg3-tsc-{contracts,domain,storage,runtime,testkit}.log` |
| targeted reruns | `node scripts/run-tests.mjs runtime tools testkit` | **560/560 pass, exit 0** (p6t6-actions 14, p6t6-bypass-scan 10, p6t6-guard 9, p4t6 scan included) | `chain-leg4-targeted-utf8.log` |

P6 suite totals (self-counted from runs): p6t1=93, p6t2=58, p6t3=20, p6t4=32, p6t5=49, p6t6=33 → 285.
Forbidden commands (pnpm run / vitest CLI / tsx / esbuild / vite) not used anywhere in my verification.

## Step 2 — Zero-core

- test-use pristine, self-verified THREE times (pre-chain, post-chain, post-E2E):
  `git rev-parse HEAD` = `cd5ef8148158c3a752a658978873241fdf8e2bbc`, `status --porcelain` empty, `diff --stat` empty.
- Full-delta import scan: 75 files, 495 specifiers (`scan-imports.mjs`, `zero-core-import-scan.txt`), incl. multi-line `from` clauses. 4 flags, all adjudicated:
  1. `packages/tools/harness/plugin.mjs:54` `@deepseek-ai/dsh-session` (SessionId)
  2. `packages/tools/harness/plugin.mjs:55` `@deepseek-ai/dsh-agent` (installModelSelection)
  3. `packages/tools/harness/plugin.mjs:56` `@deepseek-ai/dsh-llm` (ToolCallId, createUserMessage)
     → **CLEAN (public seam)**: root-entry imports of real upstream monorepo packages (`packages/core/session`, `packages/core/agent`, `packages/llm/llm` in test-use; `publishConfig.access=public`, exports `.` → built `lib/index.js`). All four named symbols verified present in the built public export lists (`export { … SessionId … }` etc.). No `./src/*` deep imports, no relative paths into upstream. Resolution is via the harness junction farm (`<worktree>/packages/node_modules` junctions → test-use built package dirs), created pre-flight and **removed post-flight (verified)**. Upstream source untouched (pristine asserted by harness and re-verified independently).
  4. `packages/tools/test/p6t6-bypass-scan.mjs` specifier `x`
     → **CLEAN (false positive)**: the only quoted `x` occurrences are doc-comment examples (lines 117–118) describing the scanner's regex coverage; the file's actual imports are node: builtins only.
- Manifest scan: no patch-package / pnpm patch / postinstall / vendored-upstream in root package.json or delta. Only devDeps (eslint/typescript/vitest/globals) + `test:node` plain-node script.

## Step 3 — Private-import / owned boundary / DEC-1

- All 75 package files map onto TaskDoc §11.7 P6 owned paths (T1 activation 7, T2 admission+action-router 15, T3 messaging 5+tests, T4 control 4+tests, T5 activity 6+tests, T6 tools+harness+tests; counts in `delta-packages.txt`). NO files outside owned paths; `scripts/`, `docs/`, `graph.yaml` untouched (179-file delta = 75 packages + 104 `dev/agent-workflow/evidence/P6-T*` files only).
- DEC-1 standing exception: `packages/testkit/test/p4t6-session-event-scan.test.ts` diff is exactly 2 hunks — it-title 258→330 and enum comment extension with `toBe(258)`→`toBe(330)` ×2. Scanner logic byte-identical. Arithmetic: 258 + 72 new scannable delta files = 330 (base `packages/tools/src/index.ts` pre-existing; `tsconfig.json` not scanned). **CONSISTENT.**

## Step 4 — E2E harness rerun (lockfile serialization)

- Lock protocol executed against `references/.dsh-test-p6t6.lock`: absent at start → wrote `reviewer-3 2026-08-31T05:07:53` → harness → released in `finally` (job pwsh-173, `HARNESS_EXIT=0`).
- Command: `node packages/tools/harness/run.mjs --report-dir dev/agent-workflow/evidence/G6-REVIEW/reviewer-3/harness-output` (my worktree).
- Result: **PASS, all 7 scenarios E1–E7** (`summary.json` `pass=true`; per-scenario `pass=true`, `failing=[]`):
  - E1 (C1): 3 concurrent same-template creates → all executed, 3 distinct instance ids + 3 distinct child sessions, none colliding with seeds.
  - E2 (C2): label/template/out-of-namespace targets on team_follow_up / team_delegate / team_send_message → all live-rejected `TEAM_RUNTIME_ACTION_ADDRESSING_REJECTED`, member count unchanged (zero side effects).
  - E3 (C3): two follow-ups on the same persistent worker → same instance, admission sequences 4→5 monotonic, bound child session id UNCHANGED, no new instance.
  - E4 (C4): fresh_per_delegation delegates → 2 NEW instances, 2 NEW child sessions, distinct ids.
  - E5 (C5): boot-1 writes (message delivered to leader's bound root session, durable fact seq 9 + delivered seq 10; progress seq 1,2; control request pending with correlation token) → process KILLED → boot-2 over same DSH_HOME: member set unchanged (9), control request survived as pending, progress rows 1,2 survived, no skipped delivery at recovery, leader allow → guarded follow-up EXECUTED (allow consumed), retry same token BLOCKED `allow-consumed` (exactly-once), fresh token proceeds as no-request deviation, post-restart progress continues at seq 3, request row decided after consumption.
  - E6 (C6): 3 concurrent creates at template limit (3 scouts, limit 4) → exactly 1 admitted (executed, member-activated), 2 rejected `TEAM_RUNTIME_QUOTA_EXCEEDED_TEMPLATE_INSTANCES`; final scoutCount=4 (== limit, never over-created), total=9 (team limit 12 untouched).
  - E7 (C7): committed static bypass scan re-run over live worktree: covers exactly the five `packages/tools/src/*.ts` files, **zero violations**.
- Boots: real DSH test instances (boot 1 :3180, boot 2 :3181, same fresh DSH_HOME `references/.dsh-test-p6t6`; row `p6t6-team-tools` mounted via public profile-patch seam only — `dump-config-boot1/2.txt` line 526 shows the row; `build.required=false` — existing up-to-date lib artifacts of the pinned pristine test-use tree were reused, source pristine verified before/after).
- Post-flight (independent, mine): ports 3180/3181/3491 all FREE; test-use pristine (HEAD + porcelain + diff empty); `:3080` = 200; junction farm REMOVED; lock REMOVED.
- Note (INFO): a transient lock file was observed during one post-check — a concurrent other-reviewer harness run serialized correctly through the same lock (acquire→release within seconds of my release); no interference, protocol behaved as designed.

## Step 5 — Cross-task invariant combination review

- (a) **Quota race safety (Arch §32)**: `activation/checks.ts` step 7 counts committed members PLUS in-flight PREPARED provisioning reservations toward BOTH instance totals and concurrent-active quotas (code lines 406–529); quota enforced once inside the provider under the per-team lock (provider.ts:636, `withTeamLock`). Unit: p6t1-parallel (5 parallel → exactly 2 admitted, 3 `QUOTA_MEMBER_MAX_INSTANCES`, exact final state), p6t2-quota (exact-boundary in/out, 4-parallel template race → exactly 1). E2E: E6.
- (b) **Admit-once convergence (Arch §17/§18.2)**: `activation/identity.ts` deterministic allocation `activationKey = rootSessionId\0source\0requestToken` → instanceId/operationId/idempotencyKey (label/templateId/groupId NOT identity, inv 19); provider.ts: existing durable op → `reDriveActivation` (PREPARED roll-forward, no re-admission/no re-quota/no re-compatibility; COMMITTED → `replayed:true`; FAILED → ABANDONED → `OPERATION_FAILED` loud fail). Unit: p6t1-parallel/explicit/delegate/recovery. E2E: E1/E6.
- (c) **Messaging two-record separation (Arch §23/§24)**: `messaging/coordinator.ts` writes the TeamDomain coordination fact (step 6, under facade lock) BEFORE delivery, then delivers a plain attributed input to the target's bound child session via the public `SessionInputPort.submitAttributedInput`; correlation `{requestToken, factSequence}` links both records; at-least-once with restart recovery (skipped/missing targets recoverable, no silent loss); instance-first addressing (self-send rejected, target liveness gating). Mediation rule (human/leader/member→leader direct; peer direct only via per-SENDER instance-scoped autonomy overlay grant, else via-leader relay with attribution header) documented exactly in `messaging/mediation.ts`. Unit: p6t3-mediation/send-delivery/restart. E2E: E5.
- (d) **Control (Arch §21.4–§25)**: `control/service.ts` — first decision authoritative (at most one decision row per request); `control-allow-consumed` exactly-once consumption (check-and-reserve under per-team lock; ambiguous multi-allow → `CONTROL_GUARD_AMBIGUOUS`, never consumes); external hard policy cannot be overridden by any allow (`CONTROL_EXTERNAL_POLICY_DENIED`, human/leader alike — invariant 34); stale target closed as durable `stale-denied` FIRST; stale caller rejected before target check; scope = exact snapshot. Unit: p6t4-allow-once/deny/external-policy/negatives(11)/restart/stale. E2E: E5 (consume-once, allow-consumed retry block, no-request deviation).
- (e) **Activity (Arch §26–§30)**: `activity/ledger.ts` — out-of-order GUARD with REJECT policy: claimed sequence must equal durable head+1 exactly (≤ head → stale REJECT, > head+1 → gap REJECT); repairable by re-report at re-read head+1; two-phase guarded commit (fresh durable re-read under per-team lock → guards → commit; committed-entry re-parse internal invariant); telemetry only (subject/status/summary/correlation/last action/RUNNING intervals), no lifecycle authority. Unit: p6t5-authority/intervals/progress/projection/restart. E2E: E5 (sequences 1,2 survive restart, continue at 3).
- (f) **Tool layer cannot bypass (criterion 7)**: `tools/src/tools.ts` — closed set of 10 tools (list_members/list_templates/inspect_config/create_member/delegate/follow_up/send_message/report_progress/request_control/resolve_control); every guarded perform immediately preceded by `consultGuard` (pinned by p6t6-guard ordering test); guard semantics per SD-GUARD: allowed→proceed (allow consumed, exactly-once), no-request→proceed (documented deviation, runtime facade still enforces identity/authority/envelope/quota), all other reasons→fail-closed with runtime NEVER called; control service = sole authority, no tool-layer cache. Static: `p6t6-bypass-scan.mjs` (deterministic sorted walk; rules: no `storage`-segment imports, no `.repositories.` access, no `agents.create`, P4-T6 frozen legacy-vocabulary denylist with same precision + stronger local SessionEventMap rule) — scanner itself pinned by 10 tests incl. synthetic positives; E7 re-runs it over the live tree: 5 files, 0 violations. Driver purity: `harness/run.mjs` references TeamRuntime only in header comments — every action travels HTTP `/__p6t6/tool` → registered tool handler.

## Step 6 — Seven criteria (DevPlan §19.7) evidence table

| # | Criterion | Self-verified evidence | Result |
| --- | --- | --- | --- |
| C1 | Same template N concurrent instances | E2E E1 (3/3 executed, distinct ids/sessions) + p6t1-parallel + provider per-team lock | PASS |
| C2 | Instance-addressed actions; label/template addressing rejected | E2E E2 (3 tools, `ACTION_ADDRESSING_REJECTED`, zero side effects) + p6t2-addressing | PASS |
| C3 | Persistent follow-up stays on the SAME Session | E2E E3 (same instance, child session unchanged, seq 4→5) + p6t1-delegate | PASS |
| C4 | fresh_per_delegation → new instance per delegation | E2E E4 (2 new instances + 2 new child sessions) + p6t2-actions | PASS |
| C5 | Message/control/progress survive restart | E2E E5 both phases (pending control survived, allow consumed once after restart, progress seq 3, no skipped delivery) + p6t3-restart + p6t4-restart + p6t5-restart | PASS |
| C6 | Quota race: never over-create | E2E E6 (1 admitted at limit, 2 rejected, ==limit final) + p6t2-quota + p6t1-parallel + checks.ts in-flight reservation counting | PASS |
| C7 | Tool layer cannot bypass the runtime | E2E E7 (static scan 5 files, 0 violations) + p6t6-guard (9, incl. ordering) + p6t6-bypass-scan (10) + tools.ts delegation + driver purity | PASS |

## Findings

| # | Severity | Location | Description |
| --- | --- | --- | --- |
| 1 | INFO | `references/.dsh-test-p6t6.lock` (runtime) | Transient lock presence during one post-check window — a concurrent other-reviewer harness run serialized correctly through the shared lock (its acquire→release observed between my checks). Lock protocol behaved as designed; no interference, no residue. |
| 2 | INFO | `packages/tools/harness/run.mjs` (build step) | E2E reused existing up-to-date `lib/` build artifacts of the pinned pristine test-use tree (`build.required=false`); install/build skipped as not required. Source pristine (HEAD + porcelain + diff) independently verified before and after the run, so the artifacts correspond to the exact pinned commit. Not a gap: the chain leg 1/3 installs and type-checks were run fresh by this reviewer on the worktree. |
| 3 | INFO | `dev/agent-workflow/evidence/G6-REVIEW/reviewer-3/scan-imports.mjs` | Reviewer tooling: the zero-core scanner's line attribution for comment-embedded quotes is offset from physical file lines (flagged bypass-scan.mjs:65 for a doc-comment example actually at lines 117–118). Cosmetic tooling note only; all flags adjudicated on content, verdict unaffected. |

No HIGH or MED findings.

## Verdict

7/7 criteria PASS on independently re-verified evidence (own worktree chain 1214/1214 + tsc ×5 clean; own zero-core scan with all flags adjudicated; own E2E rerun 7/7 scenarios with per-assertion inspection; cross-task invariants (a)–(f) grounded in code + unit tests + E2E). No HIGH/MED findings → verdict **通过 (PASS)** per the four-way ruling rules.
