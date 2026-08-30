# P4-T6 — G4 Report: Independent TeamDomain Audit

- **Task:** P4-T6 (Team-mode vNext, Phase P4, E4) — independent TeamDomain audit + G4 report
- **Branch / worktree:** `task/P4-T6-teamdomain-audit` / `D:\AgentDev\dsh-plugins\dsh-agent-team\.worktrees\P4-T6`
- **Base:** `4a61394296f1c4037fbd2aa7fba7c07dc11e6e69` (int/P4, R23 — P4-T5 integrated)
- **Code head:** `d3bf92c1f475e4d46f38476217509fdc37d0dae1` (evidence commit stacked directly on top)
- **Independence:** this task did NOT implement P4-T1..T5 and spawned no subagents. All P4-T1..T5 code was audited read-only; the only code added is the denylist scanner, its type surface, and the committed pinning test (3 new files, 592 insertions, 0 existing files modified).
- **Discipline:** Step 0 docs read first (`docs/ROUTER_RULES.md`, `docs/TEST_METHODS.md`); no port, no DSH_HOME, no live DSH instance; canonical chain only (`pnpm install --ignore-scripts` → `node scripts/run-tests.mjs` → tsc storage → tsc domain → tsc contracts); no pnpm run/exec, no vitest CLI/tsx/esbuild/vite, no piped-stdio child spawns.

## Overall G4 verdict

**G4: PASS — 7/7 criteria met on P4 evidence; 0 blocking invariants; 0 defects found in P4-T1..T5.**

```text
✓ TeamDomain is sole Team control-plane authority      — PASS (direct)
✓ no Team SessionEvent persistence                     — PASS (direct)
✓ crash matrix converges                               — PASS (direct)
✓ retries idempotent                                   — PASS (direct)
✓ SessionBinding integrity checks                      — PASS (to the extent P4 evidence exists)
✓ schema version mismatch fails loudly                 — PASS (direct)
✓ recovery tests work after process restart            — PASS (to the extent P4 evidence exists; see restart-equivalence note)
```

Scope note: criteria 1/2/3/4/6 are judged directly from executed P4 evidence. Criteria 5 and 7 are judged to the extent P4 evidence exists: SessionBinding integrity is proven against the durable record model (real agent binding is P5), and process restart is proven at the seam level (real OS process + real StorageDomain binding is P5 runtime). The final pass/fail call belongs to G4-REVIEW.

## Executed chain (canonical attempt 3 = final pass)

| Leg | Command | Result |
| --- | --- | --- |
| 1 | `pnpm install --ignore-scripts` | EXIT=0 (48 ms, up to date) |
| 2 | `node scripts/run-tests.mjs` | EXIT=0 — **783 passed / 0 failed / 783 total** (773 baseline at base commit + 10 new p4t6 tests) |
| 3 | `node node_modules/typescript/bin/tsc -p packages/storage/tsconfig.json` | EXIT=0 |
| 4 | `node node_modules/typescript/bin/tsc -p packages/domain/tsconfig.json` | EXIT=0 |
| 5 | `node node_modules/typescript/bin/tsc -p packages/contracts/tsconfig.json` | EXIT=0 |
| DEBUG | `node node_modules/typescript/bin/tsc -p packages/testkit/tsconfig.json` | EXIT=0 (recorded separately, not a canonical leg) |

Attempts 1 and 2 both failed on defects in THIS task's new test file (attempt 1: missing `import { describe, it, expect } from 'vitest'` → import/evaluation error; attempt 2: runtime-green but `tsc testkit` debug leg found TS2532 on an index access under `noUncheckedIndexedAccess`). Both were fixed in the new test file only; no pre-existing file was ever touched. Full chronology in `run-log.txt`, ledger in `attempt-ledger.txt`.

## Criterion evidence

### C1 — TeamDomain is sole Team control-plane authority — PASS

- `packages/storage/src/index.ts:2-8` — package identity: TeamDomain "the sole persistent control-plane authority … TeamSession / MemberInstance records and the Team ledger live here, never in DSH SessionEvents (zero-core: no Team event vocabulary enters the host)"; `packages/storage/package.json` description matches.
- `packages/storage/repositories/team-domain.ts:44-73` — the open TeamDomain facade exposes exactly the eight store repositories (`schemaMeta, teamSessions, memberInstances, sessionBindings, overrides, compatibility, operations, ledger`); `createTeamDomain` (155-177) stamps all eight stores (guard `TEAM_DOMAIN_EXISTS`), `openTeamDomain` (179-215) re-verifies and hands out repositories; the seam handle is injected — "this module has no host-backend import; the real binding lands in P4-T5/P5" (16-17, 148-149).
- `packages/storage/schema/stores.ts:25-32` — `TEAM_DOMAIN_NAME='team_domain'`, `TEAM_DOMAIN_SCHEMA_VERSION=1`, `SUPPORTED_TEAM_DOMAIN_SCHEMA_VERSIONS=[1]`, the eight stores, `createTeamDomainSeamSpec()`.
- Object model per Architecture: TeamSession + TeamDomain + MemberInstance as durable records (`team-sessions.ts`, `member-instances.ts`), no SessionEvent path.
- Independence negative scan: `packages/storage/test/p4-08-independence-negative.test.ts` (6 tests, PASS in the executed run) — the P4-T1 closure (22 production + 18 contracts modules) carries zero banned vocabulary, including the legacy Team event names; the domain package stays pure (no storage/remote vocabulary).
- Executed: p4-01..p4-08 storage suites (10/9/9/8/11/13/6/6 tests, all PASS) + full 783/783.

### C2 — no Team SessionEvent persistence — PASS

- **New committed scanner (this task):** `packages/testkit/fault-injection/session-event-scan.mjs` (+ adjacent token-free `session-event-scan.d.mts`) scans all 190 `.ts/.mts/.mjs` files under `packages/**` (9 package dirs; `packages/legacy` documented as a sourceless skeleton; `node_modules`/`dist` skipped and recorded; no files skipped for any other reason; unreadable files fail loud). Matching precision: exact same-quoted-literal match for the five legacy event strings; word-bounded match for the five legacy payload symbols; file-level declaration-merge detection (word-bounded `SessionEventMap` + ≥1 quoted legacy event string + quoted `@deepseek-ai/dsh-session/types` specifier ⇒ one hit at the first `SessionEventMap` line). Deterministic and re-runnable; exactly two self-referential exclusions (the scanner `.mjs` itself and the committed test).
- **Result: 15 hits, all inside the frozen 2-file quarantine set; 0 payload symbols; 0 declaration merges.** The quarantine set holds the frozen DETECTION vocabulary (invariant 42: vNext has no Team SessionEvents — the legacy names live only where they are needed to detect and reject them). Full table below.
- `packages/contracts/src/legacy-vocabulary.ts:51-55` — frozen `LEGACY_TEAM_SESSION_EVENT_NAMES` (the five names verbatim); 43-83 — `isLegacyTeamSessionEventName` / `assertNotLegacyTeamSessionEvent` → `LEGACY_TEAM_SESSION_EVENT_REJECTED` (detection-only, per the module's invariant-42 header).
- `packages/contracts/test/negative.test.ts:116-147` (21 tests in the file, PASS) — the quarantine describe block: exactly five names, detect-and-nothing-else, `assert` rejects legacy and passes non-legacy names.
- No session-event store exists in the eight-store schema (`stores.ts:25-32`); P4-T1's closure scan (p4-08, 6 tests) bans the legacy event names in the closure; p4t6 pins all of this as committed evidence.
- Executed: `packages/testkit/test/p4t6-session-event-scan.test.ts` (10 tests, PASS), `packages/contracts/test/negative.test.ts` (21 tests, PASS), p4-08 (6 tests, PASS).

### C3 — crash matrix converges — PASS

- DevPlan §17.4 requires fault injection at the ten Member-provisioning boundaries and allows only "one committed MemberInstance OR no committed MemberInstance + diagnosable orphan".
- `packages/testkit/test/p4t5-crash-matrix.test.ts` (13 runtime tests, PASS) implements B1..B10 over a FILE-BACKED realm: per boundary — fresh realm (8 stamp writes) → armed seam crash at the exact durable-write offset → crash-state asserts (durable row counts, derived stage, orphan diagnostic at `crash-matrix:136-138`, operation row, the single crash-leftover tmp) → **process restart** (`dropRealm` + `reopenRealm` at `crash-matrix:149-152`) → `recover` rolls forward with exactly `8 − offset` seam writes to EXACTLY ONE committed MemberInstance (0 orphans, 1 ledger fact, COMMITTED row) → a second `recover` is a 0-write no-op with the same ledger sequence. Shared seam-state equivalences B2==B3 and B6==B8 are asserted.
- Roll-forward mechanics: `packages/storage/operations/journal.ts:264-275` — `prepareInternal` is idempotent (existing PREPARED row returned as-is, no write, no generation bump; terminal rows reject a conflicting child id), then idempotent effects (applied/skipped) → ledger fact → COMMITTED (generation+1); zero deletes anywhere in the journal.
- Executed: p4t5-crash-matrix (13 tests), p4t4-one-committed-invariant (21 tests), p4t4-orphan-detect (21 tests), p4-07-durability-crash (6 tests) — all PASS.

### C4 — retries idempotent — PASS

- `packages/storage/test/p4t4-per-stage-retry.test.ts` (20 tests, PASS): a retry after each stage performs 0 additional seam writes and no adapter re-call; per-stage write accounting (allocate=1, createChildSession=2, bindChildSession=1, commitInstance=4, full provision=8); an idempotency-key conflict (different allocation token) is rejected `RECORD_DUPLICATE`.
- `packages/testkit/test/p4t5-retry-restart.test.ts` (10 tests, PASS): double retry at B2 (7 remaining writes then 0, same ledger sequence) and at B9 (1 then 0).
- `packages/storage/provisioning/coordinator.ts:392-397` — if the child session id is already durably recorded, the external effect ALREADY completed: the adapter is NOT called again ("no double effect"); `journal.ts:266-275` (idempotent prepare) plus the closed-code rejection set (`idempotencyConflict`/`childSessionConflict`/`terminalOperation` → `RECORD_DUPLICATE`; stale generation → `RECORD_INVALID`) in `journal.ts` back the guarantee.
- Executed: p4t4-per-stage-retry (20), p4t4-adapter (12), p4t4-one-committed-invariant (21), p4t5-retry-restart (10) — all PASS.

### C5 — SessionBinding integrity checks — PASS (to the extent P4 evidence exists)

- `packages/storage/bindings/binding-service.ts:131-143` — `createTeamRootBinding` rejects a root with no TeamSession record (`RECORD_INVALID`, `problem: 'root-session-not-a-team'`); the typed rejection set covers `member-record-missing`, `binding-contradicts-record` (invariant 24 — a binding is never re-pointed), and `SESSION_ALREADY_BOUND`; `resolve()` cold-hydrates bindings.
- `packages/storage/bindings/reconciler.ts` (307 lines) — read-only, fail-closed bidirectional integrity reconciliation (member↔binding, root↔root-binding, child-session uniqueness, invariant 23), closed diagnostic codes, deterministic ordering.
- Executed: p4t3-binding-service (17 tests), p4t3-reconciler (17 tests), p4t3-fork-reconciliation (12 tests) — 46 tests, all PASS; p4-04-session-bindings (8 tests), p4t4-orphan-detect (21 tests) — all PASS.
- Extent caveat: integrity is proven against the durable record model; binding to live Root/Member agents is P5 runtime scope.

### C6 — schema version mismatch fails loudly — PASS

- `packages/storage/schema/version-policy.ts:38-61` — `isSupportedTeamDomainSchemaVersion` / `assertSupportedTeamDomainSchemaVersion` throw `SCHEMA_STAMP_MISMATCH` with `details {store, expected, found}`; "NO built-in migration in v1" (module header 20-24) — mismatch REJECTS at open, loudly, on a closed code set.
- Layered policy: L1 at seam open — `packages/storage/repositories/team-domain.ts:94-109` maps the frozen seam `version-mismatch` code to `SCHEMA_VERSION_MISMATCH` (`{expected, found, seamCode}`); L2 per-store stamps — `team-domain.ts:179-215` verifies all eight stamps in canonical order (missing stamp → `SCHEMA_STAMP_MISSING`, "partial create or corruption", with `{store, expected, found: null}`); L3 record `schemaVersion` at every read (repository layer).
- Executed: `packages/storage/test/p4-01-schema-meta.test.ts` (10 tests, PASS — incl. the version-policy row at 162-167: v1 accepted, v2 throws); `packages/testkit/test/p4t5-corrupt-version.test.ts` (10 tests, PASS) — a1 per-store stamp tampered 1→2 → `SCHEMA_STAMP_MISMATCH`; a2 domain meta 1→2 → `SCHEMA_VERSION_MISMATCH`; b1 truncated table → malformed-medium → `SEAM_FAILURE`; b2 garbage body → `RECORD_INVALID` preserving `MALFORMED_DTO`; b3 record `schemaVersion` 1→2 → `RECORD_INVALID` preserving `SCHEMA_VERSION_MISMATCH`; c1/c2 planted and crash-leftover `.tmp` files never poison reopen.

### C7 — recovery tests work after process restart — PASS (to the extent P4 evidence exists)

- The P4-T5/P4-T6 restart model (`packages/testkit/test/p4t5-helpers.ts:5-18`): a "realm" is the whole in-memory stack over one scratch dir (seam + TeamDomain + fresh deterministic fake adapter + coordinator — "everything the OS process would hold"); a "process restart" is `dropRealm` (ALL in-memory state lost) followed by `reopenRealm` (a BRAND-NEW seam + repository + journal + binding + provisioning stack over the SAME scratch dir). Durable files outlive the realm; the fresh stack rehydrates only from them.
- Every crash-matrix boundary restarts before `recover` (`p4t5-crash-matrix.test.ts:149-153`); `p4t5-retry-restart.test.ts` (10 tests, PASS) adds: committed-world fixture restart → 0-write read-back + 0-write no-op `recover`; pristine-domain restart → `NONE` stage + `member-not-provisioned`, then a full 8-write commit; two independent members (inst-alpha, inst-beta) both survive a second restart (ledger sequences 1 and 2).
- See the process-restart equivalence note below for the P5 boundary.

## Team SessionEvent denylist — scan results table

Scanner: `packages/testkit/fault-injection/session-event-scan.mjs` (deterministic, re-runnable; results pinned by `packages/testkit/test/p4t6-session-event-scan.test.ts`, 10 tests, PASS).

Coverage: **190 files scanned** across **9 package dirs** (`client, contracts, domain, legacy, remote, runtime, storage, testkit, tools`); 8 dirs carry source (`packages/legacy` is a skeleton with no source files — documented, not a skip); `node_modules`/`dist` trees skipped and recorded; exactly two self-referential files excluded (`packages/testkit/fault-injection/session-event-scan.mjs`, `packages/testkit/test/p4t6-session-event-scan.test.ts`).

**Summary: `{"eventString": 15, "payloadSymbol": 0, "declarationMerge": 0, "total": 15}`** — all 15 hits are the frozen quarantine vocabulary (true detection entries, not false positives; near-miss tokens such as `'team/unknown'`, `'user/message'`, `'team/progress-report'`, `TeamProgressDataX` produce zero hits — negative control in the committed test).

| # | kind | file | line | col | token |
| --- | --- | --- | --- | --- | --- |
| 1 | event-string | packages/contracts/src/legacy-vocabulary.ts | 7 | 5 | team/member-bound |
| 2 | event-string | packages/contracts/src/legacy-vocabulary.ts | 7 | 26 | team/progress |
| 3 | event-string | packages/contracts/src/legacy-vocabulary.ts | 7 | 43 | team/control-request |
| 4 | event-string | packages/contracts/src/legacy-vocabulary.ts | 8 | 4 | team/control-decision |
| 5 | event-string | packages/contracts/src/legacy-vocabulary.ts | 8 | 29 | team/message |
| 6 | event-string | packages/contracts/src/legacy-vocabulary.ts | 51 | 3 | team/member-bound |
| 7 | event-string | packages/contracts/src/legacy-vocabulary.ts | 52 | 3 | team/progress |
| 8 | event-string | packages/contracts/src/legacy-vocabulary.ts | 53 | 3 | team/control-request |
| 9 | event-string | packages/contracts/src/legacy-vocabulary.ts | 54 | 3 | team/control-decision |
| 10 | event-string | packages/contracts/src/legacy-vocabulary.ts | 55 | 3 | team/message |
| 11 | event-string | packages/contracts/test/negative.test.ts | 119 | 7 | team/member-bound |
| 12 | event-string | packages/contracts/test/negative.test.ts | 120 | 7 | team/progress |
| 13 | event-string | packages/contracts/test/negative.test.ts | 121 | 7 | team/control-request |
| 14 | event-string | packages/contracts/test/negative.test.ts | 122 | 7 | team/control-decision |
| 15 | event-string | packages/contracts/test/negative.test.ts | 123 | 7 | team/message |

Quarantine adjudication: hits 1-5 are the JSDoc of the frozen detection module, 6-10 the `LEGACY_TEAM_SESSION_EVENT_NAMES` array, 11-15 the contracts negative test that exercises `assertNotLegacyTeamSessionEvent`. Payload symbols and the declaration-merging pattern: **zero hits tree-wide** (the legacy `events.ts` declaration-merge from the frozen fork is not reproduced anywhere in vNext).

## Required-suite citation (all executed, all PASS, counts from `run-tests-full.log`)

| Suite | Tests | Criterion role |
| --- | --- | --- |
| packages/storage/test/p4t4-adapter.test.ts | 12 | C3/C4 (adapter contract, per-stage accounting) |
| packages/storage/test/p4t4-one-committed-invariant.test.ts | 21 | C4 (one-committed invariant) |
| packages/storage/test/p4t4-orphan-detect.test.ts | 21 | C3/C5 (orphan diagnostics) |
| packages/storage/test/p4t4-per-stage-retry.test.ts | 20 | C4 (per-stage retry idempotency) |
| packages/testkit/test/p4t5-crash-matrix.test.ts | 13 | C3/C7 (10-boundary matrix + restart) |
| packages/testkit/test/p4t5-retry-restart.test.ts | 10 | C4/C7 (double retry + restart semantics) |
| packages/testkit/test/p4t5-corrupt-version.test.ts | 10 | C6 (corrupt-version a/b/c, exact T1 codes) |
| packages/storage/test/p4-01-schema-meta.test.ts | 10 | C6 (schema meta + version policy) |
| packages/testkit/test/p4t6-session-event-scan.test.ts | 10 | C2 (this audit's committed pinning test) |

Supporting executed suites (all PASS): p4-02 (9), p4-03 (9), p4-04 (8), p4-05 (11), p4-06 (13), p4-07 (6), p4-08 (6), p4t3-binding-service (17), p4t3-reconciler (17), p4t3-fork-reconciliation (12), contracts negative (21), contracts errors (7), domain P3 suites (199). Full run: **783/783 = 773 baseline at base commit + 10 new p4t6 tests**.

## Process-restart equivalence note

The P4 restart model is a SEAM-LEVEL process-restart equivalence, not a literal OS-process kill: `dropRealm` discards every in-memory object (seam instances, repository caches, journal state, coordinator, adapter — all of it), and `reopenRealm` constructs a brand-new stack whose only input is the durable scratch directory. A fresh stack in a fresh JS heap can observe exactly what a fresh OS process can observe when it attaches to the same storage medium — the durable files and nothing else — so every "restart" assertion (0-write read-back, 8−offset roll-forward, no double external effect, both members surviving) is a faithful model of post-crash process recovery. The two things deliberately left to P5: (1) a real OS process boundary, and (2) the real public StorageDomain binding (the seam handle is injected today — `team-domain.ts:16-17`: "the real binding lands in P4-T5/P5"). Criterion 7 is therefore judged at the modeled level, and G4-REVIEW makes the final call under the scope note.

## Defect findings in P4-T1..T5

**None.** The independent audit (read-only over all T1..T5 code, plus the executed full suite) found no blocking or non-blocking defects: no denylist vocabulary outside the frozen quarantine, no double-effect paths, no migration/backfill behavior, no silent version-mismatch handling, no handle leaks on error paths (every post-open error releases the handle — `team-domain.ts:173-176, 211-214`), no stage-row persistence (stages are derived from durable state), no deletes in the journal.

## Provenance / doc-hash note

The task's provenance manifest is a legacy-fork diff (470 file entries) and carries NO hashes of the four frozen planning docs, so a doc-hash cross-check against that manifest is N/A; the frozen docs were read directly by absolute path from `docs/plans/active/` (the 20260829 versions). G4 criteria were quoted verbatim from `DSH_Agent_Team_vNext_Detailed_Development_Plan_20260829.md` §17.5 (lines 2294-2304); the fault matrix from §17.4 (lines 2267-2290).

## Toolchain

Node v24.20.0; plain-node runner `scripts/run-tests.mjs` (native TS type-stripping + vitest shim with frozen matcher surface `toBe/toEqual/toBeGreaterThan/toThrow(.not)`, `.js`→`.ts` sibling hooks); typescript 6.0.3 (per-package tsc, erasable-only TS, NodeNext + verbatimModuleSyntax); pnpm 11.7.0 (`install --ignore-scripts` only); zero new dependencies; `node:fs`/`node:path` confined to `packages/testkit/fault-injection/session-event-scan.mjs` (the ruling-R22 `.mjs` exception) with adjacent `session-event-scan.d.mts` type surface.
