# S3-result — P8-S3 (Work Execution + Lifecycle Closure)

**Task:** P8-S3 (Work execution + lifecycle closure — plan §16), closing **CR-2, CR-3, CR-9, CR-10, CR-11** of `dev/agent-workflow/evidence/P8-S/confirmed-repair-list.md`
**Worktree:** `D:/AgentDev/dsh-plugins/dsh-agent-team/.worktrees/P8S3`
**Branch:** `task/P8-S3-work-lifecycle`
**Base SHA:** `6956cf5af460c64cfb261f12771f5b91805437a3` (tip of `int/P8-S-backend-closure`; P8-S2 evidence commit)
**Attempt:** 2 of 3 (attempt 1 was interrupted during live-E2E diagnosis — it left no commit and no production-code change; this attempt resumed from the same worktree state and completed)
**Final code SHA (code + tests, verified green):** `5e6d8b747dfbbcf6cefa3ddafee6c9c0dcd46ab6` — `P8-S3: work execution + lifecycle closure (R1-R7: production work chain, fail-closed settlement owner, durable CAS)` (33 files changed, +3607/−319)
**Branch HEAD:** this evidence file, committed directly on top of the final code SHA as `P8-S3: evidence (S3-result.md — full TaskResult, 1821/1821 chain + tsc x6 + live 12/12 green)` (single-writer branch, not pushed)
**Blockers:** none (no `CORE_SEAM_BLOCKER` / `CONTRACT_CHANGE_REQUEST` / `ARCHITECTURE_DECISION_REQUIRED` emitted)

---

## 1. Requirement coverage R1–R7

| # | Requirement | Implementation (file :: symbol) | Verifying tests | Verdict |
| --- | --- | --- | --- | --- |
| R1 | Vertical chain in production paths (delegate → real Member Session receives the work; no test-only bypass) | `packages/runtime/action-router/effects.ts :: runDelegate` (@518) → `executeWorkChain` (`packages/runtime/action-router/work-execution.ts` @278) → `workDelivery` port (harness `plugin.mjs` @623–643) → real DSH Session input API (`createUserMessage` + `agent.followup` + `whenIdle` + `persistence.ensureMaterialized`) → real Agent turn. Driver talks only to the registered public tools over the HTTP tool seam; `p6t6-bypass-scan` (10 tests) pins the surface | live W1/W2/W3/W5/W7 + E-world; `p8s3-work-chain.test.ts` R1 full-chain test | **PASS** |
| R2 | Work request carries explicit `prompt` + `attachedContext` + `requestToken` + actor; NO default transcript inheritance | Work-request conformance: empty/missing `prompt` → `REQUEST_MALFORMED` with **zero writes**; delivery text is built **only** from the explicit prompt + optional `[attached-context]` block + visibly-embedded token `` `[team-work requestToken=…]` `` (`plugin.mjs :: workDelivery` @623–643). No production path copies root transcript content into a work request | `p8s3-work-request.test.ts` (5 tests, incl. conforming follow-up on RUNNING); p6t2-suite conformance (§5) | **PASS** |
| R3 | Required lifecycle commit with negative rejection test | Work chain requires the `lifecycleCommit` port **together** with `workDelivery`+`workActivity` (`effects.ts :: workChainPorts` @364–378); port absent → `TEAM_RUNTIME_ERROR_CODES.LIFECYCLE_COMMIT_UNAVAILABLE`, zero writes, no fact | `p8s3-work-chain.test.ts` (R3 fail-closed; partial-install never runs chain) + **new** `p6t2-addressing.test.ts` control (no-port fail-closed vs ported-runtime positive) | **PASS** |
| R4 | Durable CAS identity + activityVersion + from-state across the P8-S2 record union | `packages/storage/repositories/member-instances.ts :: commitTransition` — compare-and-swap on identity (rootSessionId+instanceId), `expectedActivityVersion`, and from-state; exactly +1 bump; errors: `RECORD_DUPLICATE` (cas-mismatch), `cas-leader-not-operable` (v2 leader rows of the P8-S2 union), `cas-identity-mismatch`, `RECORD_INVALID`, `SEAM_FAILURE` | `p8s3-member-cas.test.ts` (9 tests, incl. W8 concurrent writers, crash-during-CAS-write) | **PASS** |
| R5 | ONE production settlement owner, named (plan §16.6) | **`settleAdmittedWork` — `packages/runtime/action-router/work-execution.ts` @524**. Sole production path "actual Agent turn completion → Team work settle": invoked from `executeWorkChain` after `workDelivery` resolves (turn idle + materialized), converges missing evidence facts exactly once, writes the settle fact (payload: action/caller/instanceId/from/to/workOutcome/failure/requestToken/at) and the CAS lifecycle transition to SETTLED | live W1/W2/W3/W5/W7 (effects carry `settled:true` + `settledSequence`); `p8s3-work-chain.test.ts` (settle fact, REPLAY/RESUME convergence) | **PASS** |
| R6 | Delivery failure → no fake RUNNING (plan §16.7) | Fail-closed: if `workDelivery` throws (admission intent durable, DSH input not accepted), `settleAdmittedWork` settles with `workOutcome:'delivery-failed'` + failure → row SETTLED, never left RUNNING | `p8s3-work-chain.test.ts` W4 test (delivery fault → SETTLED + delivery-failed fact, no running success); live: every work row ends SETTLED | **PASS** |
| R7 | Router archive/restore/dispose run P7-T3 ordering through REAL production ports; wiring installs commit port non-optionally | `effects.ts :: runLifecycle` (@438) invokes the P7-T3 cores `archiveMember`/`restoreMember`/`disposeMember` (import @78 from `../lifecycle/index.js`) under the router's own team lock, over the router's own ports; `plugin.mjs :: createTeamRuntime` (@644–655) installs `lifecycleCommit` + `lifecyclePorts` + `workDelivery` + `workActivity` **non-optionally** (closeNewWork = documented no-op on the work-chain fence, interrupt via public Agent cancel, drain via `whenIdle`, residency = live-agent handle map) | `p7t3-*` suites (unchanged, green); `p8s3-work-chain.test.ts`; live E-world (7/7) | **PASS** |

**CR closure map:** CR-2 → R1+R2+R5 · CR-3 → R3+R4+R5 · CR-9 → R7 · CR-10 → R4 · CR-11 → R5+R6+retry protocol (§2).

## 2. R5 settlement owner + the exactly-once / at-least-once contract

**Owner:** `settleAdmittedWork` in `packages/runtime/action-router/work-execution.ts` (line 524). It is the only production function that finalizes a work unit after the real Agent turn reaches idle; all five live W scenarios settle through it.

**Contract (documented in the module header and enforced by tests):**
- **Ledger: exactly-once per logical work unit.** `scanWorkUnitFacts` (@156) scans the durable ledger by `requestToken`: a repeated token classifies as `REPLAY` (no new admission, no re-settle, effect `replayed:true`) or `RESUME` (missing settlement evidence is repaired **exactly once** and converged to SETTLED). W9: a same-logical retry never mints a duplicate Member or a second work unit.
- **Visible delivery: at-least-once.** The DSH Session input seam (`createUserMessage`/`followup`) accepts no idempotency key — exactly-once delivery through it would require a core patch (CORE PATCH BUDGET = 0, forbidden). The delivered text therefore **visibly embeds the requestToken** (`` `[team-work requestToken=…] ${text}` ``) so the receiving session can identify the unit; on `RESUME` the delivery is re-driven once and the chain converges to SETTLED. This at-least-once-delivery / exactly-once-ledger pairing is the architecture-sanctioned combination (plan §16.6/§16.7; G8 §19.2 windows).
- **Crash window:** commit→fact ordering is crash-safe because SETTLED convergence re-derives the missing evidence fact from the durable admission (repaired exactly once); a fault during the CAS write itself surfaces as `SEAM_FAILURE` and the retry converges (`p8s3-member-cas.test.ts` crash test).

## 3. Attempt-1 inheritance audit

- **Production (transcript inheritance):** none exists. A work request must explicitly carry `prompt` (+optional `attachedContext`); the only inputs to the delivered text are that prompt, the attached-context block, and the token (§1 R2). The negative tests (`p8s3-work-request.test.ts`) reject missing/empty prompts with zero writes, and no production code path reads root-transcript content into a work request (audited: `workDelivery` @623–643 and `executeWorkChain` @278–522 have no transcript read).
- **Task (attempt state):** attempt 1 (interrupted, zero commits) and attempt 2 (this result) share the worktree only; the live evidence is inheritance-free — every live run uses a **fresh DSH_HOME** (runner fail-closes on non-empty homes), and the first W1 admission effect in run `p8s3-1788237995671` carries `sequence:1` — the very first ledger write of that fresh home, proving no residual work units from any earlier attempt/run. All request tokens are attempt-scoped (`p8s3-w1-token`, `p8s3-w5-token`, `p8s3-w7-token`, `p8s3-w2-token`, E-world `p6t6-e*` tokens).

## 4. Changed files (33; +3607/−319 vs base)

**New (4):**

| File | Content |
| --- | --- |
| `packages/runtime/action-router/work-execution.ts` | NEW production module (594 lines): `scanWorkUnitFacts` (@156), `casTransition` (@195), `executeWorkChain` (@278), **`settleAdmittedWork` (@524)** — the work chain + settlement owner |
| `packages/runtime/test/p8s3-work-chain.test.ts` | NEW — 8 tests: R3 fail-closed zero writes; partial install never runs chain; W4 delivery-failed settlement fact; W6 activity interval open/close (correlation=token); W9 same-token REPLAY no duplicate; RESUME redelivers once, converges SETTLED; R1 package-level vertical delegate-create full chain; R2 explicit prompt+attachedContext, no inheritance |
| `packages/runtime/test/p8s3-work-request.test.ts` | NEW — 5 tests: missing/empty prompt, delegate-without-prompt, empty attachedContext → `REQUEST_MALFORMED` zero writes; conforming follow-up on RUNNING executes |
| `packages/storage/test/p8s3-member-cas.test.ts` | NEW — 9 tests: matching transition bumps av exactly 1; stale version → `RECORD_DUPLICATE` cas-mismatch; wrong from-state → cas-mismatch; v2 leader row → `RECORD_INVALID` cas-leader-not-operable; missing row → `SEAM_FAILURE`; invalid target → no write; corrupt identity → `RECORD_INVALID` cas-identity-mismatch; W8 exactly-one-of-two concurrent writers succeeds (final = seeded+1); crash during CAS write → `SEAM_FAILURE`, retry converges |

**Modified source (14):**

| File | Change |
| --- | --- |
| `packages/runtime/action-router/effects.ts` | `runDelegate`/`runWorkChainOn` route delegate/follow-up through `executeWorkChain`; `workChainPorts` (@364–378) requires the three ports together; `runLifecycle` now drives the P7-T3 cores through the real ports |
| `packages/runtime/action-router/router.ts` | work-action dispatch carries the work-request contract; lifecycle actions go through `runLifecycle` |
| `packages/runtime/action-router/index.ts` | exports for the work-execution module |
| `packages/runtime/activity/ledger.ts` / `index.ts` | activity interval open/close facts (correlated by requestToken) for W6 |
| `packages/runtime/admission/actions.ts` / `errors.ts` / `types.ts` / `index.ts` | work-request conformance (`prompt` required; `REQUEST_MALFORMED`), `lifecycleCommit` required-by-chain, `work-admitted` effect gains `settled`/`settledSequence`/`replayed`, new error code surface |
| `packages/runtime/lifecycle/{archive,dispose,resolve,restore}.ts` | P7-T3 cores consume the production `AdmissionClosePort`/commit wiring (close admission, interrupt, quiesce, release, commit order preserved) |
| `packages/storage/repositories/member-instances.ts` | `commitTransition` CAS surface (identity + activityVersion + from-state) |
| `packages/tools/src/tools.ts` | delegate/follow-up tool payloads accept the explicit work request (prompt/attachedContext) |
| `packages/tools/harness/plugin.mjs` | production composition: `lifecycleCommitPort` (@554–558 → `memberInstances.commitTransition`), `lifecyclePorts` (@568+), `workDelivery` (@623–643), `createTeamRuntime` installs all ports **non-optionally** (@644–655); `ensureLiveAgent` cold resume (@302–314) |
| `packages/tools/harness/run.mjs` | live E2E driver: W1/W2/W3/W5/W7 scenarios added; multi-frame zstd session-log reader; E3 sequence check aligned to the post-settlement invariant (justified in §5b) |

## 5. Pre-existing tests updated (with justification)

**5a. Unit-suite conformance (12 files).** The R2 contract makes an explicit `prompt` mandatory on work-bearing actions, so every pre-existing suite that drives work actions had to conform; each change is payload-conformance only (no assertion weakened):

| File | Change | Justification |
| --- | --- | --- |
| `packages/runtime/test/p6t2-helpers.ts` | `makeActionRequest` defaults `payload:{prompt:'p6t2 default work prompt'}` | The conformance mechanism for the whole p6t2 suite (one helper feeds every suite below) |
| `packages/runtime/test/p6t2-actions.test.ts` | explicit prompt payloads on direct request literals | R2 conformance |
| `packages/runtime/test/p6t2-addressing.test.ts` | **+1 new test** (no-port fail-closed R3 control vs ported-runtime positive) + prompt payloads | R3 negative rejection test at the addressing surface |
| `packages/runtime/test/p6t2-authority.test.ts` | prompt payloads | R2 conformance |
| `packages/runtime/test/p6t2-quota.test.ts` | prompt payloads | R2 conformance |
| `packages/runtime/test/g8s1-generation-stamp.test.ts` | prompt payloads | R2 conformance |
| `packages/runtime/test/p6t5-authority.test.ts` | 1-line prompt conformance | R2 conformance |
| `packages/runtime/test/p7t3-helpers.ts` | `P7T3CommitFake` records `expectedActivityVersion` | R4: fake now matches the real CAS port contract |
| `packages/runtime/test/p8s2-leader-contract.test.ts` | prompt conformance | R2 conformance |
| `packages/testkit/test/p4t6-session-event-scan.test.ts` | `filesScanned` 486 → 490 | 4 new files enumerated inside the scanner's roots (work-execution.ts + 3 new suites) — count re-derived from the actual scan |
| `packages/tools/test/p6t6-actions.test.ts` | `base()` + probes gain prompt | R2 conformance |
| `packages/tools/test/p6t6-guard.test.ts` | `followUpArgs` + prompt | R2 conformance |

**5b. Live-driver (E2E) check adjustment — 1 check, meaning preserved.** `run.mjs` E3 check `the admission sequences advance by one (monotonic per admission)` (G6-era: `seq2 === seq1 + 1`) replaced by `the admission sequences advance strictly (second admit follows the first unit settlement)` (`seq1 < settle1 < seq2 < settle2`). Justification: the old check encoded a G6 implementation detail — one ledger fact per admission — which the R5 settlement chain (plan §16.6, required by this very task) intentionally replaced: each work unit now writes admission + delivery-observed + SETTLED + activity facts. The frozen E3 criterion (P6-T6 brief: *persistent follow-up keeps the SAME bound child session — Session id stable across follow-ups*) is unchanged and fully asserted (same instance, same child session, no new instance, executed status, strict monotonicity ordered by settlement). Live run #4: `seq1=4 settle1=7 seq2=8 settle2=11` — PASS.
Additionally, `run.mjs :: readChildSessionLog` now walks multi-frame zstd (Node's `zstdDecompressSync` decodes only the first frame of a multi-frame stream, while the durable session log is concatenated frames — one per materialized append). This is a reader bug fix in the test driver; it reads production durable logs it was always meant to read, and no production code was changed for it.

## 6. Canonical chain — commands + results (run on the final code SHA tree)

Environment: Node v24.20.0, Windows, workspace-write sandbox. No pnpm run/exec, no vitest CLI, no tsx/esbuild/vite.

1. **Chain:** `node scripts/run-tests.mjs`
   → `1821 passed, 0 failed, 1821 total, 7389 ms` — **PASS** (exit 0). Baseline at base SHA: 1798. New: **+23** = 22 in the three new P8-S3 suites (8+5+9) + 1 new R3 control in `p6t2-addressing.test.ts`. Zero regressions (all 1798 baseline tests pass; the only modified pre-existing tests are the justified conformance updates in §5).
2. **tsc ×6** (`node node_modules/typescript/bin/tsc -p packages/<pkg>/tsconfig.json`, per package):
   `contracts: exit 0 (568 ms)` · `domain: exit 0 (746 ms)` · `storage: exit 0 (806 ms)` · `runtime: exit 0 (1631 ms)` · `testkit: exit 0 (890 ms)` · `remote: exit 0 (588 ms)` — **ALL PASS**.
3. **Live E2E:** `node packages/tools/harness/run.mjs --scenarios E1,E2,E3,E4,E5,E6,E7,W1,W2,W3,W5,W7 --port 3181 --report-dir packages/tools/harness/reports/p8s3-live`
   → exit 0, overall `pass: true`, `failures: []`, runStamp `p8s3-1788237995671`, duration ≈ 32 s (4 boots). Environment pins: test-use HEAD `cd5ef8148158c3a752a658978873241fdf8e2bbc` pristine pre+post (porcelain 0); stable :3080 → 200 pre+post; lock `references/.dsh-test-p8s3.lock` acquired/released (own marker matched); ports 3181–3184 (boots 1–4) + mini-MCP 3491 all released; fresh DSH homes `references/.dsh-test-p8s3` (W world) + `references/.dsh-test-p8s3-e` (E world), deleted post-run.
   W4/W6/W8/W9 are package-level (verified in step 1) per the task packet; W1/W2/W3/W5/W7 + E1–E7 are live (step 3).

## 7. Live per-scenario results (run #4, runStamp `p8s3-1788237995671`)

| Scenario | Boot (port) | Verdict | Assertions | Key evidence |
| --- | --- | --- | --- | --- |
| W1 | 1 (3181) | **PASS** | 10 | delegate to persistent `worker` **continues** the seeded worker (M4); effect `{work-admitted, RUNNING, lifecycleCommitted:false, seq 1, settled:true, settledSeq 4}`; row SETTLED at av2 on `session-child-p6t6seedw1`; durable log carries `p8s3-w1-token` + the exact model-visible prompt; member count stays 3 |
| W5 | 1 (3181) | **PASS** | 7 | pre-state SETTLED av2 → `fromLifecycle SETTLED, lifecycleCommitted:true`, settle → SETTLED av4; activity interval open/close rows with correlation = token |
| W7 | 1 (3181) | **PASS** | 7 | residency dropped (session non-resident); cold-resume follow-up on the SAME child session; SETTLED av6; log carries W1+W7 tokens |
| W3 | 1 (3181) | **PASS** | 5 | two `fresh_per_delegation` delegates → two NEW instances/sessions (five members); both SETTLED av3; logs carry tokens |
| W2 | 2 (3182, **process restart**) | **PASS** | 7 | same five members survive restart; W1 row survived SETTLED on the original child session; follow-up SETTLED→admit+settle → SETTLED **av8** on the **same** childSessionId; log carries W1+W7+W2 tokens |
| E1 | 3 (3183) | **PASS** | 14 | seeds + three concurrent worker creates admitted; persistent workers bound to child sessions |
| E2 | 3 (3183) | **PASS** | 3 | three out-of-namespace targets live-rejected (`TEAM_RUNTIME_ACTION_ADDRESSING_REJECTED`), zero side effects |
| E3 | 3 (3183) | **PASS** | 6 | persistent follow-ups on the SAME instance, child session unchanged, no new instance (six members); `seq1=4 settle1=7 seq2=8 settle2=11` (§5b) |
| E4 | 3 (3183) | **PASS** | 5 | `fresh_per_delegation` mints a NEW instance per delegation |
| E5 | 3+4 (3183/3184, restart) | **PASS** | 24 (11+13) | members/sequences/messages survive restart; post-restart delivery on new durable sequences; per-subject progress sequence continues |
| E6 | 3 (3183) | **PASS** | 6 | quota race: pre-race scout count 3 (limit 4), exactly 1 of 3 concurrent admits, 2 rejected `TEAM_RUNTIME_QUOTA_EXCEEDED_TEMPLATE_INSTANCES` |
| E7 | — | **PASS** | 2 | bypass scan: exactly the five committed tool-layer source files; no forbidden seam usage |

**Total: 12/12 scenarios, 96 assertions, 0 failing.**

## 8. Acceptance items (task packet)

| # | Item | Verdict |
| --- | --- | --- |
| 1 | Chain green, ≥1798, zero regressions | **PASS** — 1821/1821 |
| 2 | tsc ×6 (contracts/domain/storage/runtime/testkit/remote) all exit 0 | **PASS** — 6/6 |
| 3 | Live W1: delegate TOKEN_A → real Member Session receives it | **PASS** |
| 4 | Live W2: persistent follow-up TOKEN_B → same childSessionId across restart | **PASS** (av8 on `session-child-p6t6seedw1`) |
| 5 | Live W3: fresh_per_delegation → two new instances/sessions | **PASS** |
| 6 | Live W5: turn completion → SETTLED | **PASS** |
| 7 | Live W7: non-resident SETTLED → cold resume → same Session | **PASS** |
| 8 | Package W4: delivery failure → no fake running success | **PASS** (`p8s3-work-chain.test.ts`) |
| 9 | Package W6: activity interval open/close | **PASS** (`p8s3-work-chain.test.ts`) |
| 10 | Package W8: concurrent CAS version mismatch fails one writer | **PASS** (`p8s3-member-cas.test.ts`) |
| 11 | Package W9: same-logical retry → no duplicate Member | **PASS** (`p8s3-work-chain.test.ts`) |
| 12 | E1–E7 kept green, unchanged in meaning | **PASS** — 7/7 live; only check adjustment is the justified E3 sequence invariant (§5b), meaning preserved |
| 13 | No-core (pristine test-use pre+post, :3080 untouched, zero upstream modification, no patching) | **PASS** (§9) |

## 9. No-core assertion

- `references/deepseek-harness-test-use` HEAD = `cd5ef8148158c3a752a658978873241fdf8e2bbc` and `git status --porcelain` = **0 lines, verified before and after** the live run (runner preflight/postflight + independent re-verification at commit time).
- Stable instance `:3080` → **200 before and after** (runner + independent probe); `D:/deepseek-harness` never touched.
- **Zero** upstream source modifications; no patch-package/postinstall/vendored copy; no private upstream imports — everything rides public seams: Cordis tool registration, the public Session input API, `agent.followup`/`whenIdle`/`persistence.ensureMaterialized`, and `agentsSVC.resume` for cold resume.
- Ports 3181–3184 + 3491 released; lock released (own marker matched); both test DSH homes deleted post-run; the runner's junction farm (`packages/node_modules`) removed by postflight.
- No push; branch `task/P8-S3-work-lifecycle` is local, single-writer.

## 10. Findings

1. **W1 semantics (canonical vs production).** Canonical §16.8 W1 requires *the token to reach a real Member Session*, not a new instance. Production target resolution (`domain/member :: resolveDelegationTarget`) always continues an explicit address, and the worker template is `persistent` (blueprint), so a W1 delegate **continues the seeded worker** (RUNNING settle-only, no admission CAS) — exactly what the live run shows. The new-instance criterion is owned by W3 (fresh_per_delegation) and E4. The driver was aligned to production; **no production code was changed for this**.
2. **Node zstd multi-frame decoding (test-driver bug, fixed).** `node:zlib :: zstdDecompressSync` decodes only the FIRST frame of a multi-frame stream, while the durable session log is concatenated zstd frames (one per materialized append; frames here carry no content size). Run #3's W-scenario log checks failed for this reason alone — per-chunk decompression proved the full conversations (all tokens, inbox splices, user messages) were durably logged correctly. `readChildSessionLog` now walks frames by magic with per-chunk validation (spurious-magic merge fallback).
3. **4-boot / 2-home layout.** The per-template `maxInstances = 4` quota forces the W world (seeds + 2 fresh scouts = 5 members) and the E world (seeds + 3 E1 workers + 2 E4 scouts + 1 E6 scout = 9 members) into separate DSH homes; the W2/E5b process-restart boundary needs boots 2 and 4. `directiveFor(boot)` sets phase create (boots 1,3) / resume (boots 2,4).

## 11. Known limitations

- **Static model, contained turn failures.** The test-use model `p6t6-static/p6t6-model-v1` has no provider, so every real Agent turn fails contained at the driver boundary (`no adapter registered for provider "p6t6-static"`, `NO_ADAPTER`) **after** the model-visible user message + inbox splice are durably logged. This proves the delivery→turn→settle vertical chain end-to-end (prompt lands, turn runs to idle, settlement commits); it does not exercise a successful model turn — out of scope for this task (no provider exists in the test environment).
- **build:web under sandbox** runs limited (`webSandboxLimited`), tolerated per TEST_METHODS precedent; the client bundle is built from the farm before boots.
- **W2/E5b restart** is a true process restart (fresh boot, new port, same DSH_HOME) — durable state is the only state carried across, per the task spec.

## 12. Cleanup / audit trail

- All `.p8s3-*` diagnostic/audit artifacts (18 files) deleted; `packages/tools/harness/reports/` deleted after its contents were summarized into §6/§7 above; `packages/testkit/test/.tmp-fault` residue removed. Working tree at commit time: 33 committed files + this evidence file only.
- `REMOTE_CONTRACT_VERSION = 1` untouched; `packages/remote` + `packages/contracts` out of scope (no changes); frozen architecture/acceptance tests not weakened (all 1798 baseline tests pass unmodified except the §5 conformance updates).
