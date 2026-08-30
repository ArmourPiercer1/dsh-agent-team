# G4 Gate Review — Reviewer 3 of 3 (blind)

- **Role**: Blind Gate reviewer 3/3 for Gate G4 (Team-mode vNext, Phase P4 — TeamDomain/journal).
- **Blind-rule compliance**: I did not participate in P4 implementation. I did NOT read `dev/agent-workflow/SESSION_ROUTER_LOG.md` content, `graph.yaml` content, or any `evidence/**` content except `evidence/provenance/file-manifest.json` (provenance only). Commit messages from `git log` were treated as claims and every P4 commit claim that mattered was independently verified against actual test sources. All conclusions below rest on (a) source I read line-by-line in this worktree and (b) commands I executed myself.
- **Worktree**: `D:\AgentDev\dsh-plugins\dsh-agent-team\.worktrees\G4-R3`, detached at P4 integration head `cdc7f9506f1e84b53c381b6f5e4641f88e3b2b07`; base `3ccff7bc98fb15bd8c691a13639177041f91b1b0` (master after G3).
- **Frozen docs** (absolute paths, untracked, main worktree; read + hashed this review):

  | Doc | SHA-256 | Size |
  | --- | --- | --- |
  | `docs/plans/active/DSH_Agent_Team_vNext_Detailed_Architecture_20260829.md` | `030dfb8ec55bae30f35c2826c7e4e659c0e0b742d836018ce502f34017870c53` | 73,980 B |
  | `docs/plans/active/DSH_Agent_Team_vNext_Detailed_UI_Design_20260829.md` | `3ef3ab69ed2bd7879e4c15079a16c8dae456b572690246a5c1f9cbb0c8c4981e` | 59,833 B |
  | `docs/plans/active/DSH_Agent_Team_vNext_Detailed_Development_Plan_20260829.md` | `a05d237f8515fd6467373632849afe0c6a1ae63bc0ec298de63b9d124d881d0f` | 72,945 B |
  | `docs/plans/active/DSH_Agent_Team_vNext_Task_Decomposition_and_Review_Method_20260829.md` | `2b457cc033ca1b72aa781e072e0ef7fe55bc05d2f7ea25cc03c827d257e888a3` | 108,677 B |

---

## 1. Footprint audit

`git diff --name-only 3ccff7bc98fb15bd8c691a13639177041f91b1b0..HEAD` in this worktree yields **102 changed paths**, classified by re-running the classification with explicit per-path boolean checks (an earlier `-like`/`-and`/`-or` precedence pass produced false positives and was discarded):

| Zone | Paths | Breakdown |
| --- | --- | --- |
| `packages/storage/` | **59** | `schema/**` (10) + `repositories/**` (13) + `operations/**` (3) + `provisioning/**` (8) + `bindings/**` (4) + `test/**` (23, incl. helpers) + `tsconfig.json` (1) |
| `packages/testkit/` | **18** | `fault-injection/file-seam.{mjs,d.mts}` (2) + `fixtures/committed-world/**` (9: meta + 8 tables) + `fault-injection/session-event-scan.{mjs,d.mts}` (2) + `test/**` (5: p4t5-corrupt-version, p4t5-crash-matrix, p4t5-helpers, p4t5-retry-restart, p4t6) |
| `dev/agent-workflow/evidence/P4-*` | **23** | P4 task evidence artifacts |
| `dev/agent-workflow/` (orchestration) | **2** | `SESSION_ROUTER_LOG.md`, `graph.yaml` (content NOT read — blind rule; presence expected) |
| **Total** | **102** | **Out-of-zone: 0. Other packages touched: none.** |

**Contracts freeze**: `git rev-parse 3ccff7b:packages/contracts` == `git rev-parse HEAD:packages/contracts` == **`1476fbc4975e7b0e06bcd4a22180e7056a2b72e3`** — byte-identical tree before and after P4. (The provenance `file-manifest.json` contains no frozen-doc SHA-256 entries, so a manifest-based hash cross-check is impossible; hashes above were recorded directly from the files. See Defect MINOR-1.)

---

## 2. Canonical chain (all legs executed by this reviewer)

| # | Command (in worktree root) | Exit | Key result |
| --- | --- | --- | --- |
| 1 | `pnpm install --ignore-scripts` | 0 | 54.3 s, 150 packages, warm store |
| 2 | `node scripts/run-tests.mjs` | 0 | **783 passed / 0 failed / 783 total** (~700 ms) |
| 3 | `node node_modules/typescript/bin/tsc -p packages/storage/tsconfig.json` | 0 | 879 ms |
| 4 | `node node_modules/typescript/bin/tsc -p packages/domain/tsconfig.json` | 0 | 734 ms |
| 5 | `node node_modules/typescript/bin/tsc -p packages/contracts/tsconfig.json` | 0 | 503 ms |
| 6 | `node node_modules/typescript/bin/tsc -p packages/testkit/tsconfig.json` | 0 | 862 ms |

**Chain result**: `install EXIT=0; run-tests 783/783 EXIT=0; tsc storage/domain/contracts/testkit all EXIT=0`.

**P4 test subset: 291 tests** (per-file counts from the executed run; every `it` block in the files listed below was counted line-by-line during reading and matches the executed count exactly):

| File | Executed | Line-by-line read this review |
| --- | --- | --- |
| `storage/test/p4-01`…`p4-08` | 10/9/9/8/11/13/6/6 (=72) | schema/stores/seam/version-policy/errors modules read in full (source-level knowledge of the behavior under test); execution-verified |
| `storage/test/p4t2-conflicts.test.ts` | 25 | full (370 lines) |
| `storage/test/p4t2-crash-recovery.test.ts` | 19 | full (347 lines) |
| `storage/test/p4t2-journal.test.ts` | 12 | full (175 lines) |
| `storage/test/p4t3-binding-service.test.ts` | 17 | full (217 lines) |
| `storage/test/p4t3-fork-reconciliation.test.ts` | 12 | full (153 lines) |
| `storage/test/p4t3-reconciler.test.ts` | 17 | full (272 lines) |
| `storage/test/p4t4-adapter.test.ts` | 12 | adapter/fake-adapter sources read in full; execution-verified |
| `storage/test/p4t4-one-committed-invariant.test.ts` | 21 | full (381 lines) |
| `storage/test/p4t4-orphan-detect.test.ts` | 21 | full (350 lines) |
| `storage/test/p4t4-per-stage-retry.test.ts` | 20 | full (299 lines) |
| `testkit/test/p4t5-corrupt-version.test.ts` | 10 | full (453 lines) |
| `testkit/test/p4t5-crash-matrix.test.ts` | 13 | full |
| `testkit/test/p4t5-retry-restart.test.ts` | 10 | full (446 lines) |
| `testkit/test/p4t6-session-event-scan.test.ts` | 10 | full (193 lines) |
| **Total** | **291** | storage 248 + testkit 43 |

Helper files read in full: `storage/test/p4t4-helpers.ts` (173), `testkit/test/p4t5-helpers.ts` (332), `testkit/fault-injection/file-seam.mjs` (473), `testkit/fault-injection/session-event-scan.mjs` (299).

---

## 3. Criteria (DevPlan §17.5)

### C1 — TeamDomain is the sole Team control-plane authority — **PASS**

Per-package grep for `team_domain|TeamDomain|member_instances|session_bindings` across all 9 packages:

- `runtime`: 0 matches. `client`: 0.
- `remote/src/index.ts:6`: 1 — skeleton doc comment only. `tools/src/index.ts:6`: 1 — skeleton doc comment only.
- `domain`: 4 — all doc comments (`member/src/roster.ts:21,88,125`; `compatibility/src/result.ts:8`).
- `contracts`: doc comments + the pre-P4 frozen `legacy-vocabulary.ts` error text (tree byte-identical to base, §1).
- Only `packages/storage/**` (production code) and `packages/testkit/**` (harness) contain **code** that touches TeamDomain; `repositories/team-domain.ts` receives the seam as an **injected** `StorageDomainSeam` — no host-backend import anywhere in storage.

No other package can issue Team control-plane mutations; the only entry points are the TeamDomain modules themselves.

### C2 — No Team SessionEvent persistence — **PASS**

- Legacy 5+5 vocabulary tokens: all 43 event-string grep matches are confined to `testkit/fault-injection/session-event-scan.mjs` (doc lines 19–23, denylist 79–83), `testkit/test/p4t6` (pinned expectation lines 104–123), `contracts/src/legacy-vocabulary.ts` (doc 7–8, denylist 51–55 — frozen pre-P4), `contracts/test/negative.test.ts` (119–123). **Zero matches in production code outside the quarantine.**
- `\bSessionEventMap\b`: 7 matches, all in p4t6 synthetic fixtures (135/152/181) or the scanner itself (doc 27–32, const 96).
- `p4t6` executes the scan: 9 package directories, **190 files scanned**, exact 2-file exclusion set, **0 violations outside quarantine, 0 payload symbols, 0 declaration merges, 15 pinned event-string hits at file:line:column**, positive control detected, 4 negative controls (including bare `SessionEventMap` → no hit) clean.
- vNext Team state is persisted exclusively in the 8 `team_domain` stores; no event payload is durable.

### C3 — Crash matrix converges — **PASS**

Crash model verified in source: PREPARED → idempotent effects → ledger fact → COMMITTED row; **roll-forward/reconcile only, never rollback** (zero deletes asserted in every crash suite; `p4t2-conflicts.ts:364–369` asserts no `delete` op in any of three seam writeLogs; `p4t2-crash-recovery` global section: every target record written EXACTLY ONCE, zero deletes).

Executed evidence (all read line-by-line):

- `p4t2-crash-recovery` (19 tests, in-memory seam, sticky mid-atomic-write `CrashFault` leaving `.tmp` + stale target): C0 nothing durable → re-drive 7w/2applied → reverify 0w; C1 PREPARED-gen1 only → 5w fact2; C2 one effect SKIPPED (1 skipped/1 applied) 4w; C3 both SKIPPED 3w; C4 gap `[5]` diagnosable → NEW sequence 6 (no reuse, no counter rewrite) 3w; C5 fact **reused** via `findFact(operationId)` — no allocation, 1w, same seq7, reverify 0w; staged-window crash (external child recorded, crash before binding/member) → orphan diagnosable with no binding/member/child on the row; recovery recordChildSession gen2 + drive 6w. Global: 7 facts, gaps `[5]`, sequences `[1,2,3,4,6,7,8]`, lastApplied=OP_G.
- `p4t4-one-committed-invariant` (21 tests, fresh world, W1–W8 write arithmetic): 10-boundary matrix B1–B10 at crash offsets 0…8 (BOUNDARIES lines 105–116; driver 118–168). Each boundary asserts **final converged state**, not merely non-throw (lines 246–256): stage INSTANCE_COMMITTED, committed, no diagnostic, exactly 1 member, 1 fact, op phase COMMITTED, 0 orphans, 1 child, 0 writes on no-op. Boundary-specific: B1 mint-once; B2/B3 re-mint the SAME deterministic child (idempotent adapter, createCalls 1→2); B4 recorded child is **reused** (createCalls stays 1) with orphan `missing=['record','binding','commit']`; B5 `['binding','commit']`; B6/B8 `['commit']` preFacts=0; B9 preFacts=1, not yet committed; Part 2 never-two-committed (replay 0w seq1; token/label conflict 0w; independent beta seq2; cross-root same instanceId different operationId → 3 facts); Part 3 stalled-S3 OR-branch (0 facts, CHILD_BOUND, orphan `missing=['commit']`).
- `p4t5-crash-matrix` (13 tests, **file-backed** realm over scratch dir, same 10 boundaries): convergent final states after real `.tmp`-leftover crash + realm reopen.

### C4 — Retries are idempotent — **PASS**

- Source: `provisioning/coordinator.ts:394–397` — idempotency guard: existing `childSessionId` → `ensureMemberRecord` + return; the adapter is **never re-called** for an already-recorded child. `operations/journal.ts` — `prepareInternal` idempotent; `drive` short-circuits on terminal phase with 0 effects/0 writes; per-operationId promise lock; duplicate fact prevention via `findFact(operationId)` before allocate+put.
- `p4t4-per-stage-retry` (20 tests): happy path 8 writes/1 adapter call/1 child/1 fact; per-stage retry deltas — allocate 1w retry 0; createChildSession 2w retry 0 with adapter NOT re-called (createCalls stays 1); bindChildSession 1w retry 0; commitInstance 4w retry 0 (same ledgerSequence, 0/0 effects); self-ensuring entry points (commitInstance from fresh state drives the full chain, adapter×1); idempotency guard (different token/label → RECORD_DUPLICATE + idempotency-conflict, 0 writes, 1 member; same-request replay 0w no-op seq1); recover from S0..S5 = 8/7/5/4/1/0 writes, all converge, committed exactly once.
- `p4t4-one-committed` Part 2 (replay 0w same seq; cross-root independence; never-two-committed).
- `p4t5-retry-restart` double-retry (file realm): B2 — crash at offset 1, recover#1 7w committed seq1, recover#2 **0w** seq1; B9 — crash at offset 7, recover#1 1w, recover#2 0w; both converge to 1 member/1 fact/0 orphans/COMMITTED.
- `p4t2-conflicts` (25 tests): zero writes on **every** conflict path (afterConflicts === beforeConflicts, line 217–219; afterTerminal === afterConflicts, 253–255); terminal re-exec 0-write no-op on same durable result (290–295); typed-failure re-drive converges with effectsSkipped=2 (336–341).

### C5 — SessionBinding integrity checks — **PASS**

- Source: `bindings/binding-service.ts` — resolve 4 states (team-root / team-member / unbound / fork-unbound); rejections `root-session-not-a-team`, `member-record-missing`, `binding-contradicts-record` (invariant 24), occupied-by-other → RECORD_DUPLICATE; idempotent when bound to us. `bindings/reconciler.ts` — bidirectional, read-only (0 writes asserted), fail-closed, **closed 10-code set**: `missing-member-binding, orphan-member-binding, member-child-mismatch, child-bound-to-other-root, child-bound-to-other-instance, binding-kind-conflict, duplicate-child-claim, team-session-missing, missing-root-binding, root-binding-kind-conflict`; deterministic sorted diagnostics + `byCode`.
- `p4t3-binding-service` (17 tests): cold hydration of all 4 states with exact composite identities; idempotent create 0w; wrong-root → RECORD_INVALID root-session-not-a-team (store=session_bindings); fork rejection keeps child unbound (fail-closed); malformed ids preserve INVALID_INSTANCE_ID / INVALID_CHILD_SESSION_ID; cross-kind duplicate → existingKind/newKind; same-kind duplicate claim → SESSION_ALREADY_BOUND.
- `p4t3-reconciler` (17 tests): healthy scope → diagnostics `[]`, `byCode {}`, frozen report, identical across two runs, 0 writes; S1–S12 exercise **all 10 codes** (including cross-side asymmetry: one side sees `child-bound-to-other-root`, the other `orphan-member-binding`); S13 empty scope trivially consistent; S14 malformed scope → INVALID_ROOT_SESSION_ID.
- `p4t3-fork-reconciliation` (12 tests): root fork §35.2 (pre-commit recognition fail-closed; committed fork awaiting sidecar → missing-root-binding; idempotent sidecar 0w; original team untouched, no member inheritance); member-child fork §35.3 (refused binding → binding-contradicts-record with expected/given child; NO row created → unbound); cold hydration §36.1 from binding store alone.

### C6 — Schema version mismatch fails loudly — **PASS**

- Source: layered policy — L1 domain meta version vs `SUPPORTED_TEAM_DOMAIN_SCHEMA_VERSIONS=[1]` → `SCHEMA_VERSION_MISMATCH` {expected, found}; L2 per-store stamp → `SCHEMA_STAMP_MISMATCH` {store, expected, found}; L3 record `schemaVersion` via parsers → `RECORD_INVALID` preserving `contractsCode`. No built-in migration (Architecture §14.4 / DevPlan §17).
- `p4t5-corrupt-version` (10 tests, file realm, raw byte tampering of durable files): (a1) ledger stamp 1→2 → SCHEMA_STAMP_MISMATCH store='ledger' expected=1 found=2; (a2) domain meta 1→2 → SCHEMA_VERSION_MISMATCH expected=1 found=2, seamCode='version-mismatch'; (b1) truncated table → SEAM_FAILURE seamCode='malformed-medium' (classified, not silent); (b2) garbage record body → open OK, read fails RECORD_INVALID contractsCode='MALFORMED_DTO' with store/key named; (b3) record schemaVersion 1→2 with canonical bytes kept → RECORD_INVALID contractsCode='SCHEMA_VERSION_MISMATCH' (loud, per-record, at read time); (c1) planted stale `.tmp` ignored on open AND left untouched, recover 0w; (c2) **real** crash-leftover `.tmp` at B9 → reopen OK, recover exactly 1w to committed world, leftover count unchanged; classification test: a1/a2 ∈ {SCHEMA_STAMP_MISMATCH, SCHEMA_VERSION_MISMATCH}, NOT collapsed into SEAM_FAILURE.
- Commit-message claims for the P4-T5 corruption work match the test file exactly.

### C7 — Recovery tests work after process restart — **PASS (with documented scope reservation)**

TeamDomain touches the OS **only** through the injected seam (verified: zero `node:` imports, zero process/global/timer access in any `.ts` in the worktree — §4), so the file-backed realm restart is an observationally equivalent proxy for a process restart: `dropRealm` loses all in-memory state (best-effort close, durable files untouched) and `reopenRealm` builds a brand-new seam + stack + adapter + coordinator over the **same** scratch dir (`p4t5-helpers.ts:172–179`; doc lines 167–168: "This is the P4-T5 stand-in for an OS process restart; a real process + real StorageDomain binding is P5 runtime territory (DevPlan §17.5 criterion 7)").

Executed evidence (33 file-realm tests, all read line-by-line): `p4t5-retry-restart` (10): double retry across the crash point and across restarts (7w+0w, 1w+0w, same seq); committed-world fixture restart → 0-write read-back (stage INSTANCE_COMMITTED, 1/1/0, opChild=memberChild) and recover 0w no-op seq1 0/0 effects; pristine-domain restart → exactly 8 writes to stamp, then recover exactly 8w committed seq1, second recover 0w; second member after restart → 7 writes (counter already bootstrapped), seq2, deterministic BETA_CHILD, both members 0w-recover, second restart → 2 members/2 facts/0 orphans/both COMMITTED. `p4t5-corrupt-version` reopen tests (c1/c2 + fixture sanity) and `p4t5-crash-matrix` (13) additionally prove convergence after reopen of crashed state.

**Exact scope statement**: TeamDomain touches the OS only through the injected seam (verified: no pid/socket/process/global-state access anywhere in `packages/storage/**`), so the file-backed realm restart is an observationally equivalent proxy and the criterion passes to the extent P4 evidence exists (real OS process + real StorageDomain binding is a later phase); ANY code path outside the seam behaving differently across a real process boundary would be a concrete finding — **none found**.

---

## 4. Red-line audits (executed greps, all in worktree)

| Check | Result |
| --- | --- |
| Port `3080` in `.ts` | 0 matches |
| `deepseek-harness\|DSH_HOME\|.dsh-test` | 4 matches, all comments/allowlist strings: `domain/src/import-graph.ts:52` (allowlist string), `contracts/src/ids/session-id.ts:33` (doc `@see` link), `storage/test/p4-08-independence-negative.test.ts:9` (comment), `storage/test/p4-helpers.ts:864` (allowlist string) |
| Network (`fetch(\|https?://\|WebSocket\|net.connect\|dgram`) | 1 match — doc comment only |
| Child-process (`spawn(\|execFile\|child_process\|execSync`) | 8 matches — all `vitest.config.ts` comments stating "no child_process" |
| `node:` builtins in any `.ts` | **0 matches** (zero-core rule holds) |
| `node:` in `.mjs` | Exactly 6 import lines in exactly the 2 sanctioned harnesses: `file-seam.mjs` (fs/path/url), `session-event-scan.mjs` (fs/path); both have adjacent `.d.mts` shims |
| `process.\|globalThis\|setTimeout\|setInterval\|setImmediate` in `.ts` | 0 |
| `@deepseek-ai/dsh*` specifiers | 2 — both in `p4t6` (comment line 5 + synthetic fixture string line 134) |
| `Buffer\|window\|document\|XMLHttpRequest\|import.meta` in `.ts` | 0 real (3 false positives: English word "document" in comments) |
| Absolute Windows paths / `references/deepseek-harness` | 1 — `session-event-scan.mjs:14` doc comment citing the legacy denylist source |
| StorageDomain usage in storage | All seam-interface names / doc comments / test fakes; no `openStorageDomain` call |
| `.mjs` network/process/timers | 0 |

`run-tests.mjs` confirmed as plain-node runner (native TS type-stripping + shim), no child processes, discovers `packages/*/test/*.test.ts`.

---

## 5. Owned-path discipline (TaskDoc §11.5 P4 cards)

| Card | Owned paths | P4 footprint | Verdict |
| --- | --- | --- | --- |
| T1 | `packages/storage/schema/**`, `repositories/**` | 10 + 13 | in-zone |
| T2 | `packages/storage/operations/**` | 3 | in-zone |
| T3 | `packages/storage/bindings/**` | 4 | in-zone |
| T4 | `packages/storage/provisioning/**` | 8 | in-zone |
| T5 | `packages/testkit/fault-injection*`, persistence tests | 18 (harness + fixtures + p4t5/p4t6 tests) | in-zone |
| T6 | audit + G4 report | evidence 23 + this review file | in-zone |
| — | storage `test/**` (23) | P4 suites + helpers | in-zone (task tests) |
| — | orchestration (2) | router state | expected |

Sole exception: `packages/storage/tsconfig.json` — one line, `"rootDir": "."` → `"../.."`. Structurally required: storage production modules use cross-package relative imports (`../../contracts/src/index.js`, 55+ grep matches), which make a repo-root `rootDir` mandatory for `tsc -p packages/storage/tsconfig.json` to type-check; testkit's tsconfig already had `../..` at base. Not enumerated in any card's owned paths → **MINOR-2**.

---

## 6. Negative-test presence

- `p4t6`: positive control (planted violation detected) + 4 negative controls (no false positives, incl. bare `SessionEventMap`); 15 pinned hits.
- `p4-08-independence-negative` (6 tests): negative independence checks.
- `contracts/test/negative.test.ts` (quarantine): `LEGACY_TEAM_SESSION_EVENT_REJECTED` / `LEGACY_MEMBER_ID_REJECTED` detection assertions.
- `p4t2-conflicts` (25): every failure discipline asserted — stale-generation ordering, idempotency-conflict (confKey / intentChanged / foreign fact / terminal), child-session-conflict (record + prepare paths), operation-not-found (drive/fail/record + get→undefined), unclassified-effect-error (row stays PREPARED, 0 fact, then converges), typed-error pass-through unwrapped, cross-team foreign fact, zero writes on all conflicts, never-deletes.
- `p4t3*`: fail-closed assertions throughout (rejected fork child stays unbound; malformed scope rejected; bidirectional consistency).

---

## 7. Defect list

| # | Severity | Finding |
| --- | --- | --- |
| MINOR-1 | MINOR | `evidence/provenance/file-manifest.json` (4,901 lines, 470 files) contains **no frozen-doc SHA-256 entries**, so the manifest-based hash cross-check prescribed by the review brief is impossible; hashes were recorded directly from the four frozen docs instead (table in header). Provenance completeness gap; no impact on any criterion. |
| MINOR-2 | MINOR | `packages/storage/tsconfig.json` one-line `rootDir` change is build glue outside any P4 card's explicit owned paths; structurally necessary (cross-package contracts imports) and verified against tsc legs 3/6 passing. |
| NOTE-1 | NOTE | `packages/storage/src/index.ts` is still the P1 skeleton (`PACKAGE_ID='storage'` only; last change `932edb1`, P1-T4). Untouched by P4, owned-path-consistent; the package public-API surface is a later-phase follow-up. |
| NOTE-2 | NOTE | "invariant 42" cited at `contracts/src/legacy-vocabulary.ts:13,46` (frozen pre-P4) is not a numbered item in the frozen docs; it resolves to the Architecture §14.2 quarantine citation. Citation hygiene only. |

---

## 8. Verdict

**通过 (pass)**

All seven DevPlan §17.5 criteria PASS on evidence I gathered independently: production modules and every P4 test file (storage 248 + testkit 43 = **291 P4 tests**) read line-by-line, plus my own execution of the full canonical chain (**783/783**, four `tsc` legs, all exit 0). The contracts tree is byte-identical to base (`1476fbc…`); the footprint is exactly 102 in-zone paths; every red line is clean; the crash matrix (10 boundaries × in-memory + file realms) converges to final committed state with roll-forward-only semantics, write-once targets, gap-diagnosability, and zero deletes; retries are idempotent end-to-end including across simulated process restarts (0-write no-ops, same sequence, deterministic child ids); binding integrity and the closed 10-code reconciler set are fully exercised; version mismatches fail loudly at all three layers; and the only OS contact point for TeamDomain is the injected seam, so the file-realm restart proxy is observationally equivalent within P4 scope (real OS process + real StorageDomain binding is the frozen plan's later phase — no out-of-seam path was found that could behave differently). No blocking invariant is violated. The four findings (2 MINOR, 2 NOTE) are documentation/provenance hygiene items that do not affect any criterion.
