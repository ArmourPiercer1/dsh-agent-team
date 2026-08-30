# G4 Review — Reviewer 1 of 3 (blind, independent)

- **Gate**: G4 (P4 — TeamDomain / Journal / Recovery)
- **Review target**: HEAD `cdc7f9506f1e84b53c381b6f5e4641f88e3b2b07` (int/P4-teamdomain-journal)
- **Footprint baseline**: `3ccff7bc98fb15bd8c691a13639177041f91b1b0` (master after G3)
- **Worktree**: `.worktrees/G4-R1` (detached at integration head; only file created is this report; nothing committed)
- **Method**: all claims below are from direct source reads and my own executions in this worktree. Worker self-reports, commit-message claims, and orchestrator log entries (SESSION_ROUTER_LOG.md / graph.yaml / evidence/**, off-limits to me by the blind rule except the file manifest) were treated as CLAIMS and re-verified independently wherever the evidence was reachable.
- **Sanctioned toolchain only**: `pnpm install --ignore-scripts`, `node scripts/run-tests.mjs`, `tsc` per package, plain-node single-file harness built on `scripts/run-tests-hooks.mjs` + `scripts/test-vitest-shim.mjs` (no pnpm run/exec, no vitest CLI, no tsx/esbuild/vite, no piped-stdio child spawns).

---

## 1. Footprint audit

`git diff --name-only 3ccff7b..HEAD` = **102 files**, all accounted for:

| Bucket | Files | Allowed? |
|---|---|---|
| `packages/storage/**` | 59 | YES — P4 phase home (schema 11, repositories 11, operations 3, bindings 4, provisioning 7, test 10+4+4+5+1 helpers = 45, tsconfig 1) |
| `packages/testkit/**` | 18 | YES — T5 `fault-injection*` (2 harness + 9 committed-world fixture) + T6 scanner (2) + p4t5/p4t6 tests (5) |
| `dev/agent-workflow/evidence/P4-*` | 23 | YES — task evidence artifacts (6 evidence commits: f441d1f, f8da356, d5300dd, 194c224, c874a7f, cdc7f95) |
| `dev/agent-workflow/SESSION_ROUTER_LOG.md`, `dev/agent-workflow/graph.yaml` | 2 | NAME-ONLY: orchestrator state files; content off-limits by the blind rule — recorded, not inspected |

- **Contracts tree byte-identical**: tree hash of `packages/contracts/` is `1476fbc4975e7b0e06bcd4a22180e7056a2b72e3` at both `3ccff7b` and `cdc7f95` — P4 made **zero** changes to contracts (the legacy-vocabulary quarantine files already existed at G3).
- Zero changes in `packages/domain`, `packages/runtime|tools|remote|client|legacy`, `scripts/`, `docs/`, `.gitignore`, `references/`.
- Per-commit file lists (Section 5) reconcile exactly to the 59/18/23/2 split; no unexplained file.

## 2. Canonical chain results (all executed by me at HEAD)

| Leg | Command | Result |
|---|---|---|
| 1 | `pnpm install --ignore-scripts` | EXIT=0 (53.3 s warm) |
| 2 | `node scripts/run-tests.mjs` (all packages) | **783 passed, 0 failed, 783 total, EXIT=0** |
| 3 | `tsc -p packages/storage` | EXIT=0 |
| 4 | `tsc -p packages/domain` | EXIT=0 |
| 5 | `tsc -p packages/contracts` | EXIT=0 |
| 6 | `tsc -p packages/testkit` | EXIT=0 |

Individual re-runs of the P4-critical suites (single-file plain-node harness, executed by me):

| Suite | Result |
|---|---|
| `p4t5-crash-matrix.test.ts` | 13/13 PASS |
| `p4t5-retry-restart.test.ts` | 10/10 PASS |
| `p4t5-corrupt-version.test.ts` | 10/10 PASS |
| `p4t6-session-event-scan.test.ts` | 10/10 PASS |
| `p4t4-per-stage-retry.test.ts` | 20/20 PASS |
| `p4t4-one-committed-invariant.test.ts` | 21/21 PASS |
| `p4t4-orphan-detect.test.ts` | 21/21 PASS |
| `p4-08-independence-negative.test.ts` | 6/6 PASS |
| `p4t3-fork-reconciliation.test.ts` | 12/12 PASS |
| `p4t3-binding-service.test.ts` | 17/17 PASS |
| `p4t3-reconciler.test.ts` | 17/17 PASS |
| `p4t4-adapter.test.ts` | 12/12 PASS |

## 3. Criteria C1–C7 (DevPlan §17.5, lines 2296–2303, verbatim)

### C1 — "TeamDomain is sole Team control-plane authority" — **PASS**

- `packages/storage/schema/stores.ts:38–47`: single domain `team_domain`, 8 logical stores `['schema_meta','team_sessions','member_instances','session_bindings','overrides','compatibility','operations','ledger']`, `SUPPORTED_TEAM_DOMAIN_SCHEMA_VERSIONS=[1]`.
- Every repository consumes **only** the injected handle: `repositories/base.ts` `BaseRepository` (canonical-JSON-row invariant, identical-bytes put = no-op, occupied key → typed conflict); `repositories/team-domain.ts:191–215` `openTeamDomain` validates L1/L2 then stamps/reads the 8 stores.
- The **only** file-writing code under `packages/**` is the test-only `testkit/fault-injection/file-seam.mjs` (a StorageDomainSeam implementation). Production `packages/storage` performs zero direct I/O — all reads/writes flow through the seam interface (`schema/seam.ts`, pure).
- Other packages carry no Team state: `domain` is I/O-free (lifecycle/policy/blueprint/compatibility only); `runtime|tools|remote|client|legacy` are side-effect-free skeletons (identity markers + empty Cordis entries).
- Independence pinned by `p4-08-independence-negative.test.ts` (6/6, executed): import closure pinned to exactly 40 modules (22 production + 18 contracts), zero bare specifiers, no banned path segment, no live export SessionEvent- or agent-shaped.
- Matches Architecture §14.1/14.2 sidecar definition and §14.4 non-ACID single-write-durable model.

### C2 — "no Team SessionEvent persistence" — **PASS**

- `p4t6-session-event-scan.test.ts` (10/10, executed): frozen denylist scanner (`testkit/fault-injection/session-event-scan.mjs`) over **all 190 `.ts/.mts/.mjs` files in 9 package dirs**; exact quoted-literal event matching, word-bounded payload-symbol matching, declaration-merge detection (`SessionEventMap` + legacy name + quoted `'@deepseek-ai/dsh-session/types'` in one file). Zero hits outside the two sanctioned quarantine files (`packages/contracts/src/legacy-vocabulary.ts`, `packages/contracts/test/negative.test.ts` — both pre-dating P4, contracts tree byte-identical to G3).
- My own independent greps confirm: the 5 legacy event strings appear **only** in the 4 sanctioned locations (legacy-vocabulary.ts, negative.test.ts, the p4t6 test, the scanner .mjs); the 5 payload symbols only in testkit; no `@deepseek-ai/*` import anywhere under `packages/**`.
- `legacy-vocabulary.ts` (100 lines, read in full) is **detection/quarantine-only**: `isLegacyTeamSessionEventName`, `assertNotLegacyTeamSessionEventName` → `LEGACY_TEAM_SESSION_EVENT_REJECTED`, `assertNoLegacyFields` → `LEGACY_MEMBER_ID_REJECTED` (invoked by every DTO parser). It rejects emission and supports read-only legacy import; it emits and persists nothing.
- vNext persistence vocabulary is exclusively the 8 TeamDomain stores + contracts DTOs; no Team SessionEvent type exists in any persistence path.

### C3 — "crash matrix converges" — **PASS**

- Coverage: `p4t5-helpers.ts:285–295` `BOUNDARIES` B1–B10 map **all ten** DevPlan §17.4 boundaries (lines 2272–2281) to concrete write offsets, with the documented equivalences B2≡B3 and B6≡B8 asserted explicitly (`p4t5-crash-matrix.test.ts:366–374`).
- Per-boundary, `p4t5-crash-matrix.test.ts` (13/13, executed) asserts **final states, not absence of throws**: post-crash (typed `SEAM_FAILURE`/unclassified seam error; `crashWrites` = exact offset; exactly one `.tmp` in the crashed table; expected pre-rows; expected stage/diagnostic/orphans), then after `dropRealm`+`reopenRealm` (brand-new in-memory stack, same durable files): **exact** recovery write counts, operation `COMMITTED`, stage `INSTANCE_COMMITTED`, `ledgerSequence=1`, `effectsApplied=0`/`effectsSkipped=0`, `finalMemberCount=1`, `finalFactCount=1`, `finalOrphanCount=0`.
- Allowed finals per DevPlan §17.4 (lines 2286–2289) enforced by `p4t4-one-committed-invariant.test.ts` (21/21, executed): at every boundary the final world is **exactly one committed MemberInstance, or none + a typed diagnosable orphan** (`ORPHANED_CHILD_SESSION` / `MEMBER_NOT_PROVISIONED` with missing-piece context, closed set in `provisioning/diagnostics.ts`).
- Zero-delete property: `p4t2-conflicts.test.ts:365–369` — "no delete operation was ever issued on the team_domain sidecar" (writeLog scan over all seams).

### C4 — "retries idempotent" — **PASS**

- `p4t4-per-stage-retry.test.ts` (20/20, executed): full write census allocate=1 / createChildSession=2 / bindChildSession=1 / commitInstance=4 / full provision=8; **every retry performs 0 writes**; `adapterCallsAfterChild=1` and `adapterCallsAfterChildRetry=1` — the external effect (fake `AgentFactoryAdapter.createChildSession`) is **never re-invoked** after the child row exists (`coordinator.ts:394` skip path); recover S1..S5 = 7/5/4/1/0 writes.
- `p4t5-retry-restart.test.ts` (10/10, executed): double retry at B2 (recover #1 = 7 writes, seq 1; recover #2 = **0 writes**, seq 1) and B9 (1 then 0).
- Crash-matrix: second `recover` after a full recovery is a 0-write no-op at the same sequence number.
- Journal level (`p4t2-conflicts.test.ts`, all green in full run + reads): `verifyRequestIdentity` runs **before any write** — different idempotencyKey or canonical intent → `IDEMPOTENCY_CONFLICT`; re-executing a staged request after COMMITTED returns the same durable result with **zero writes** (lines 290–295 assert `seam.writeCount` unchanged); duplicate-ledger prevention (one byte-stable fact per operationId, no gaps); terminal-operation and operation-not-found rejections all zero-write.

### C5 — "SessionBinding integrity checks" — **PASS**

- `bindings/binding-service.ts`: `resolve(sessionId)` → unbound|ordinary|team-root|team-member (cold hydration); `createTeamRootBinding` rejects `root-session-not-a-team`; `createTeamMemberBinding` (lines 181–234) rejects `member-record-missing` and `binding-contradicts-record` (a member binding is **never re-pointed**), and `RECORD_DUPLICATE` if the child session is already bound to anything; creates are idempotent puts.
- `bindings/reconciler.ts`: **read-only** bidirectional reconciliation per team scope, deterministic ordering, fail-closed, `byCode` counts; the diagnostic vocabulary is a **closed set of 10** codes (`bindings/diagnostics.ts:30–83`: team-session-missing, missing-root-binding, root-binding-kind-conflict, missing-member-binding, orphan-member-binding, member-child-mismatch, child-bound-to-other-root, child-bound-to-other-instance, binding-kind-conflict, duplicate-child-claim).
- Executed evidence: `p4t3-binding-service` 17/17 (typed cross-record rejections + idempotent creates), `p4t3-reconciler` 17/17 (all 10 codes, read-only-no-writes, deterministic, malformed-scope rejection with contracts code preserved), `p4t3-fork-reconciliation` 12/12 (fails closed recognizing a fork before its TeamSession commits; refuses to re-point a member-child fork; refuses a team-root binding on a member fork; **no row created** after rejected attempts; ordinary fork recorded without disturbing team integrity).
- Uniqueness guards (one TeamSession per root; child bound at most once) also pinned by `t6-9-negative-matrix.test.ts` (12 tests, green in full run).

### C6 — "schema version mismatch fails loudly" — **PASS**

- Layered policy with no migration path: L1 seam domain version — `repositories/team-domain.ts:94–104` maps seam `version-mismatch` → `SCHEMA_VERSION_MISMATCH` and **closes the handle**; L2 per-store stamps — `team-domain.ts:199–208` → `SCHEMA_STAMP_MISSING` / `SCHEMA_STAMP_MISMATCH`; L3 record `schemaVersion` → `RECORD_INVALID` with contracts `SCHEMA_VERSION_MISMATCH`. `schema/version-policy.ts:50–61` `assertSupportedTeamDomainSchemaVersion` throws `{store, expected, found}`; `SUPPORTED_TEAM_DOMAIN_SCHEMA_VERSIONS=[1]` (stores.ts:40); the closed error set (`schema/errors.ts:27–44`) contains **no migration code path** — mismatches are terminal and typed.
- Executed evidence `p4t5-corrupt-version.test.ts` (10/10): (a1) tampered `schema_meta` ledger stamp 1→2 → `SCHEMA_STAMP_MISMATCH {store:'ledger', expected:1, found:2}`; (a2) tampered domain meta → `SCHEMA_VERSION_MISMATCH` (seamCode `version-mismatch`); (b1) truncated table file → `SEAM_FAILURE`/`malformed-medium`; (b2) garbage row body → `RECORD_INVALID`/`MALFORMED_DTO`; (b3) record schemaVersion 1→2 → `RECORD_INVALID`/`SCHEMA_VERSION_MISMATCH`; (c1) planted `.tmp` file is **ignored** (not adopted); (S0) committed world restarts with a 0-write no-op recover. Every mismatch surfaces at open/read with a typed error — never a silent migration or default.

### C7 — "recovery tests work after process restart" — **PASS (with documented reservation R-A)**

- Executed evidence `p4t5-retry-restart.test.ts` (10/10): committed-world fixture **restart** (0-write read-back of all durable state; 0-write no-op recover at seq 1); pristine-domain restart (typed `MEMBER_NOT_PROVISIONED` diagnostic; recover = 8 writes → committed); a **second member** (inst-beta) provisioned after restart (its own 8 writes, seq 2, its own deterministic child) — **both** members survive a second restart. `p4t5-corrupt-version` S0 sanity: committed world restart + 0-write no-op recover.
- Mechanism: file-backed `FileStorageSeam` (durable tmp+rename writes) + `dropRealm`/`reopenRealm` = a **brand-new in-memory stack** (seam, repositories, journal, coordinator, binding service) over the **same durable files**.
- **Reservation R-A**: per ruling R22 this is an observationally-equivalent *process-restart proxy* — TeamDomain has no PID/socket/global-state access, so P4 cannot observe or affect a real OS process; binding the same suites to a real OS process + real StorageDomain binding is P5 scope. The criterion as scoped by TaskDoc T5 ("跨 process/reopen recovery") is satisfied within P4's defined capability; a full 通过 for C7 under a real-process reading is deferred to P5.

## 4. Red-line audits

| Red line | Result | Evidence |
|---|---|---|
| zero-core: no `@deepseek-ai/*` imports | **CLEAN** | grep over `packages/**`: zero import specifiers; the only occurrences of the string are detection constants in the scanner/tests |
| node: builtin rule | **CLEAN** | zero `node:` imports in any `.ts` under `packages/**`; only the two sanctioned `.mjs` test harnesses use `node:fs` (`file-seam.mjs`, `session-event-scan.mjs`), each with its adjacent `.d.mts` (existence verified) |
| no live Agent creation / DSH runtime calls | **CLEAN** | external effect is the single-method `AgentFactoryAdapter.createChildSession` interface (`provisioning/adapter.ts`); the only implementation in P4 is the in-memory deterministic `FakeAgentFactoryAdapter` (documented fake, ruling R20); no DSH runtime API referenced anywhere |
| no ports / DSH_HOME / stable-deployment references | **CLEAN** | grep `3080\|DSH_HOME\|deepseek-harness\|execSync\|spawnSync\|child_process\|http\.\|net\.` over `packages/**` src: no hits in package code (only pre-existing `vitest.config.ts` doc comments and one `@see` URL in `packages/contracts/src/ids/session-id.ts`, both non-executable and pre-dating P4) |
| no git/network operations in package code | **CLEAN** | no fetch/http/child_process/git invocations in any production module; test harnesses perform local file I/O only inside scratch dirs |

## 5. Owned-path discipline (TaskDoc §11.5 cards vs per-commit file lists)

Phase commit chain (21 commits, `3ccff7b..cdc7f95`): R16 kickoff → T1 → T1-evidence → R17 → E1 kickoff → T2 → T2-evidence → T3 → T3-evidence → R18/R19 → R20 → T4 → T4-evidence → R21 → R22 → T5 → T5-evidence → R23 → R24 → T6 → T6-evidence (HEAD).

| Commit | Task | Files touched | Inside owned paths? |
|---|---|---|---|
| `8c4d8fa` | P4-T1 | `storage/schema/**` (11), `storage/repositories/**` (11), `storage/test/p4-0*`+`p4-helpers` (9), `storage/tsconfig.json` (1) | YES, except the 1-line tsconfig tweak — see D-02. The 9 test files are the card's own 必须测试/输出物 ("repository tests") |
| `31a3d2e` | P4-T2 | `storage/operations/**` (3), `storage/test/p4t2-*` (4) | YES (tests = card 必须测试: retry same op, generation conflict, duplicate ledger prevention — all present) |
| `4e110a4` | P4-T3 | `storage/bindings/**` (4), `storage/test/p4t3-*` (4) | YES (tests = card 必须测试: missing child, duplicate binding, wrong root, ordinary fork no binding — all present) |
| `8c50e4c` | P4-T4 | `storage/provisioning/**` (7), `storage/test/p4t4-*` (5) | YES (tests = card 必须测试: per-stage retry, orphan detect, one-committed invariant — all present) |
| `3adddf4` | P4-T5 | `testkit/fault-injection/**` (2 + 9 committed-world fixtures), `testkit/test/p4t5-*` (4) | YES (owned `packages/testkit/fault-injection*; persistence tests`; fixtures = card 输出物; tests = card 必须测试: all crash points, double retry, restart, corrupt version — all present) |
| `92368d2` | P4-T6 | `testkit/fault-injection/session-event-scan.{mjs,d.mts}`, `testkit/test/p4t6-…` (3) | YES — card owns "review artifacts only; **minor test-only additions if assigned**"; the scanner + pinning test are test-only additions under `packages/testkit/**`, **zero production-code changes** (contracts tree byte-identical confirms) |
| 6 evidence commits | T1–T6 | `dev/agent-workflow/evidence/P4-*` (23) | YES (card 输出物: run logs, attempt ledgers, task summaries, G4 report) |
| 9 workflow commits | orchestrator | `SESSION_ROUTER_LOG.md`, `graph.yaml` only | NAME-ONLY (blind rule; content off-limits — no contradiction with my independent findings) |

No cross-task file entanglement: E1 parallel tasks T2/T3 touched disjoint directories (verified from both commits' file lists); no shared-file edits.

## 6. Negative-test presence

Executed and title-verified in this review (counts above): `p4t2-conflicts` (stale-generation CAS with expected/found incl. absent-row `found:null`; idempotency conflict; duplicate-ledger prevention; terminal-operation no-op with zero writes; child-session-conflict; operation-not-found; effect-error classification; cross-team fact conflicts; "the protocol never deletes"), `p4-08-independence-negative` (closure pin 40 modules; zero bare specifiers; no legacy names in closure; no SessionEvent/agent-shaped exports), `p4t3-binding-service` / `p4t3-reconciler` (all 10 diagnostic codes; read-only; deterministic; malformed scope rejected), `p4t3-fork-reconciliation` (fail-closed fork recognition; never re-pointed; no row after rejection), `p4t4-adapter` (closed stage set; closed 2-code diagnostic set; deterministic identity; scriptable failures typed), `t6-9-negative-matrix` (12 P3/G3 cross-module negatives, green in full run). Every frozen semantic has a rejecting, typed negative test.

## 7. Frozen-document hash cross-check

Computed SHA-256 of the four frozen 20260829 docs (untracked, read-only, outside the worktree):

| Doc | SHA-256 |
|---|---|
| `…_Detailed_Architecture_20260829.md` | `030DFB8EC55BAE30F35C2826C7E4E659C0E0B742D836018CE502F34017870C53` |
| `…_UI_Design_20260829.md` | `3EF3AB69ED2BD7879E4C15079A16C8DAE456B572690246A5C1F9CBB0C8C4981E` |
| `…_Detailed_Development_Plan_20260829.md` | `A05D237F8515FD6467373632849AFE0C6A1AE63BC0EC298DE63B9D124D881D0F` |
| `…_Task_Decomposition_and_Review_Method_20260829.md` | `2B457CC033CA1B72AA781E072E0EF7FE55BC05D2F7EA25CC03C827D257E888A3` |

`dev/agent-workflow/evidence/provenance/file-manifest.json` contains **no hash entries for the frozen docs** (its `files[]` is the legacy-fork diff classification; no frozen-doc hash section exists) → the required cross-check **could not be performed**. Recorded as D-01 (provenance gap), not a mismatch. The values above should be recorded into provenance so G5 can close this.

## 8. Defect list

- **D-01 (minor, provenance)**: `file-manifest.json` lacks SHA-256 entries for the four frozen docs → the mandated hash cross-check is impossible at G4. No evidence of tampering; all four docs read exactly as quoted in the frozen-plan sections I relied on (DevPlan §17.2–17.5, Architecture §14/§15.3/§40.5, TaskDoc §11.5). Action: record the hashes from Section 7 into provenance before G5.
- **D-02 (minor, owned-path formality)**: `8c4d8fa` (P4-T1) changed `packages/storage/tsconfig.json` one line (`rootDir: "."` → `"../.."`) — outside T1's stated globs (`schema/**`, `repositories/**`). It is test-typechecking tooling required to run the card's mandatory tests; no production code, no other task affected. Formally outside owned paths; substantively harmless.
- **R-A (reservation, not a defect)**: C7's process-restart evidence is the ruling-R22 observationally-equivalent proxy (new in-memory stack over same durable files). A real OS process + real StorageDomain binding is P5 scope.
- **R-B (reservation, not a defect)**: blind rule barred reading orchestrator logs/evidence (except the file manifest); all orchestrator self-reports (e.g., R23's "owned-path clean") were therefore independently re-verified by me — no contradiction found.

No blocking or material defects found.

## 9. Verdict

**投机通过 (speculative pass).**

Justification: all seven G4 criteria PASS on direct, executed evidence (783/783 canonical run + 12 individually re-executed P4-critical suites, each criterion backed by file:line source evidence and exact write-count/typed-error assertions). Red-line audits are clean; owned-path discipline holds per-commit (two minor formalities, D-01/D-02, neither affecting production code or frozen semantics); negative tests are present and green for every frozen semantic. The verdict is **not** a full 通过 because of two documented reservations: (a) C7 is satisfied via the process-restart proxy until P5 binds a real OS process + real StorageDomain (R-A), and (b) the frozen-doc hash cross-check is blocked by the missing provenance entries (D-01). Both are closeable by the next gate without any P4 rework.

### Invariants to hold until the reservations are closed (numbered)

1. **I-1 (C7 / R-A)**: Until P5 re-runs the crash-matrix, retry-restart, and corrupt-version suites under a **real OS process with a real StorageDomain binding**, C7 remains proxy-satisfied per ruling R22 only; any P5 binding that changes observable restart behavior must re-execute the full P5 fault suite before G5.
2. **I-2 (D-01 / provenance)**: The four SHA-256 values in Section 7 must be recorded into provenance (`file-manifest.json` frozen-doc section or G5 evidence) and re-cross-checked at G5; any mismatch is an immediate blocking invariant.
3. **I-3 (C2 quarantine)**: The legacy Team SessionEvent vocabulary (5 event strings, 5 payload symbols, `SessionEventMap` merge pattern) remains detection/quarantine-only; the denylist scanner's negative control must stay green (zero hits outside `packages/contracts/src/legacy-vocabulary.ts` and `packages/contracts/test/negative.test.ts`) in every subsequent gate.

---

*Reviewer 1 — independent blind review; all executions performed in `.worktrees/G4-R1` at `cdc7f95`; no subagents; no commits; no files created other than this report.*
