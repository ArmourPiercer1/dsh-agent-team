# P4-T5 Fault Matrix Report — file-backed fault injection / restart testkit

- **Task**: P4-T5 (Fault-injection/restart testkit), DSH Agent Team vNext, Phase P4, E3
- **Branch**: `task/P4-T5-fault-injection-testkit` (base `28466acabb28426629c10ef82b27858fff280bbb`)
- **Scope (ruling R22)**: file-backed `StorageDomainSeam` in `.mjs` (the only testkit module allowed `node:fs`/`node:path`; no `.ts` imports `node:` builtins), adjacent `.d.mts`, atomic durable writes (sibling tmp + `renameSync`), seam-level ARMED fault `armCrashAfterWrites(n)` throwing a distinct `CrashFault`. A "crash" = the fault fires **mid-atomic-write** (tmp file left with the new bytes, target keeps the old bytes, in-memory rows not advanced); a "process restart" = the test **drops the whole realm** (seam + TeamDomain + adapter + coordinator — all in-memory state lost) and **reopens a brand-new stack over the SAME scratch dir**.
- **Owns**: `packages/testkit/fault-injection/**` (harness + fixture) + `packages/testkit/test/p4t5-*.test.ts`. No shared file was modified (all of `packages/storage/**`, `domain/**`, `contracts/**`, testkit `src/index.ts`, tsconfigs, `package.json` zero-new-deps, scripts, `.gitignore`, `graph.yaml` untouched).
- **Result**: canonical attempt 1/3 PASS (5/5 legs EXIT=0 + extra DEBUG tsc-testkit EXIT=0); **773/773** tests (740 baseline + 33 new).

## 1. The 8-write commit drive (write arithmetic, verified by the fixture generator)

A fresh provisioning commit writes exactly 8 seam rows (W1–W8), after the 8 `schema_meta` stamp writes that create the realm (stamps = base, counted separately):

| write | table | op | meaning |
| --- | --- | --- | --- |
| W1 | operations | put | op row `PREPARED` (deterministic op id, idempotency key `provision:<root>:<instance>:<token>`) |
| W2 | operations | put | same op row: child session id recorded (generation bump) |
| W3 | member_instances | put | the MemberInstance record |
| W4 | session_bindings | put | the `team-member` binding keyed by the child session id |
| W5 | ledger | put | ledger sequence counter BOOT |
| W6 | ledger | update | counter bump |
| W7 | ledger | put | the ledger fact (sequence 1) |
| W8 | operations | put | op row `COMMITTED` (terminal) |

`CrashFault` has no `code`, so the T1 repositories classify it as `SEAM_FAILURE` with `problem: 'unclassified-seam-error'` — the same observable surface as T4's in-memory `FakeCrashError`. Recovery after a crash at offset `n` writes exactly `8 − n` seam rows (roll-forward, DevPlan §17.3), then a 0-write no-op.

## 2. The 10-boundary fault matrix (DevPlan §17.4) — file-backed proof

Proving test file: `packages/testkit/test/p4t5-crash-matrix.test.ts` (13 `it`s: one per boundary + arithmetic + torn-target + shared-seam-state). Every row was exercised: armed fault fires at the exact offset → crash captured → realm dropped → brand-new stack reopened over the same scratch dir → `recover` roll-forward → final invariants → scratch dir destroyed in `finally`.

| id | boundary (DevPlan §17.4 wording) | offset | crash table (fault fires in) | durable rows pre-reopen (op/member/binding/ledger) | pre-reopen stage | pre-reopen diagnostic | pre-reopen orphans (`context.missing`) | recovery writes | final state (post-restart) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| B1 | before op prepare | 0 | operations (W1) | 0/0/0/0 | NONE | `member-not-provisioned` | 0 (none) | 8 | **exactly one committed MemberInstance** (op COMMITTED, 1 fact, seq 1) |
| B2 | after op prepare | 1 | operations (W2) | 1/0/0/0 (PREPARED) | ALLOCATED | — | 0 (none) | 7 | **exactly one committed MemberInstance** |
| B3 | before child create (same seam state as B2: the adapter call performs no seam write) | 1 | operations (W2) | 1/0/0/0 (PREPARED) | ALLOCATED | — | 0 (none) | 7 | **exactly one committed MemberInstance** |
| B4 | after child create | 2 | member_instances (W3) | 1/0/0/0 (PREPARED, child on op row) | CHILD_SESSION_CREATED | `orphaned-child-session` | 1 (`record`, `binding`, `commit`) | 6 | **exactly one committed MemberInstance** |
| B5 | before SessionBinding | 3 | session_bindings (W4) | 1/1/0/0 | CHILD_SESSION_CREATED | `orphaned-child-session` | 1 (`binding`, `commit`) | 5 | **exactly one committed MemberInstance** |
| B6 | before MemberInstance commit | 4 | ledger (W5 boot) | 1/1/1/0 | CHILD_BOUND | `orphaned-child-session` | 1 (`commit`) | 4 | **exactly one committed MemberInstance** |
| B7 | after MemberInstance commit (no crash) | 8 | — (full commit completes, 8 writes) | 1/1/1/2 (COMMITTED) | INSTANCE_COMMITTED | — | 0 (none) | 0 (nothing left) | **exactly one committed MemberInstance** (idempotent 0-write no-op) |
| B8 | before ledger (same seam state as B6: the ledger write is the first commit write) | 4 | ledger (W5 boot) | 1/1/1/0 | CHILD_BOUND | `orphaned-child-session` | 1 (`commit`) | 4 | **exactly one committed MemberInstance** |
| B9 | before operation committed (fact durable, COMMITTED row not written) | 7 | operations (W8) | 1/1/1/2 (op still PREPARED, fact durable) | CHILD_BOUND | `orphaned-child-session` | 1 (`commit`) | 1 | **exactly one committed MemberInstance** |
| B10 | after committed (no crash) | 8 | — (full commit completes, 8 writes) | 1/1/1/2 (COMMITTED) | INSTANCE_COMMITTED | — | 0 (none) | 0 (nothing left) | **exactly one committed MemberInstance** (idempotent 0-write no-op) |

Per-boundary asserted invariants (crashing boundaries): the run fails with `SEAM_FAILURE`/`unclassified-seam-error` (never a raw `CrashFault` leak, never a silent success); `crashWrites === offset`; **exactly one** leftover `.tmp` file and it starts with the crashed table's name (e.g. B4 → `member_instances.json.*.tmp`); the crashed target file keeps its pre-crash bytes and remains **valid** JSON (torn-write isolation: tmp holds the new bytes, target never half-written); post-reopen stage equals the durable derivation; `recoveryWrites === 8 − offset`; after recovery: `committed === true`, stage `INSTANCE_COMMITTED`, **1 member, 1 ledger fact, 0 orphans**, op phase `COMMITTED`, child session id equals the deterministic `session-child-<token>`; a second `recover` is a **0-write no-op** at the same ledger sequence; the leftover tmp survives recovery untouched (never poisons anything).

Arithmetic invariants (dedicated `it`s): `offset + recoveryWrites === 8` for every crashing boundary (both from the spec and from the measured seam write counts); B7/B10 write all 8 and converge. Shared-seam-state invariants: B2 ≡ B3 and B6 ≡ B8 leave byte-comparable durable worlds (identical `crashWrites`, row counts, recovery writes, op-child presence).

**Acceptance (DevPlan §17.4 final-state rule)**: for every boundary the post-restart world is exactly **one committed MemberInstance**; the intermediate (pre-recovery) states that carry no committed member are all **diagnosable** — B1 `member-not-provisioned`, B4/B5/B6/B8/B9 `orphaned-child-session` with the exact `context.missing` array. No boundary leaves a second committed instance, an un-diagnosable orphan, or a silent corruption.

## 3. Double retry

Proving test file: `packages/testkit/test/p4t5-retry-restart.test.ts` (3 `it`s).

| crash point | crash writes | recover #1 | recover #2 (retry) | ledger sequence (both retries) | converged world |
| --- | --- | --- | --- | --- | --- |
| B2 (offset 1, after op prepare) | 1 | 7 seam writes, commits | **0 writes** (no-op), same sequence | 1 | 1 member, 1 fact, 0 orphans, op COMMITTED |
| B9 (offset 7, fact durable, COMMITTED row missing) | 7 | **1 seam write** (only the COMMITTED row), commits | **0 writes** (no-op), same sequence | 1 | 1 member, 1 fact, 0 orphans, op COMMITTED |

Both retry drives converge to the **same committed member and the same ledger sequence** — retries are idempotent (DevPlan §17.5 criterion 4 at the seam level).

## 4. Restart semantics

Proving test file: `packages/testkit/test/p4t5-retry-restart.test.ts` (7 `it`s), consuming the committed `committed-world` fixture where marked.

1. **Committed-world restart (fixture)**: the committed `committed-world` fixture (`packages/testkit/fault-injection/fixtures/committed-world/`) is copied into a fresh scratch dir and reopened by a brand-new stack: read-back performs **0 seam writes**; status is `INSTANCE_COMMITTED` with 1 member, 1 fact, 0 orphans, op `COMMITTED`, op child === member child === the deterministic child id; `recover` is a **0-write no-op** at ledger sequence 1 with `effectsApplied`/`effectsSkipped` both 0 (the coordinator's journal is built without an effects resolver, so both are always 0 — asserted, not assumed).
2. **Pristine-domain restart**: a realm dropped right after the 8 stamp writes (process death before ANY provisioning write) restarts to stage `NONE` with the typed `member-not-provisioned` diagnostic, **0 orphans, 0 members, no op row**, and the restarted seam counts **0 writes** (a restart rehydrates; it does not re-stamp). `recover` then commits with exactly **8 seam writes** (1 member, seq 1), followed by a 0-write no-op.
3. **Second member after restart**: with alpha committed (seq 1) and the realm restarted, a second instance `inst-beta` commits **independently** — its own **7 seam writes** (the ledger counter is already bootstrapped, so no W5 boot write: the commit drive of a second member is 7 writes), its own ledger **sequence 2**, its own deterministic child `session-child-<token(root, inst-beta)>`; afterwards 2 members, 2 facts, 0 orphans, both ops `COMMITTED`, and both no-op recovers cost 0 writes. A **second restart** sees both members committed with 0 orphans.
4. **Fresh-realm invariant**: every fresh realm starts at exactly the 8 `schema_meta` stamp writes (`STAMP_WRITE_COUNT === 8`).

## 5. Corrupt version — required sub-cases a/b/c

Proving test file: `packages/testkit/test/p4t5-corrupt-version.test.ts` (10 `it`s, including S0 sanity). Every case copies the committed fixture into a fresh scratch dir, tampers, and reopens a brand-new stack (the process-restart model over corrupted bytes).

| case | tamper | open result | exact typed error (T1 codes, `details`) |
| --- | --- | --- | --- |
| S0 | none (fixture sanity) | OK, 0 read writes | — (INSTANCE_COMMITTED, 1 member/1 fact/0 orphans, op COMMITTED, `team-member` binding present; 0-write no-op recover, seq 1) |
| **(a1)** | `schema_meta` stamp of store `ledger`: `version` 1→2 (canonical bytes kept) | **fails LOUDLY at open** | `SCHEMA_STAMP_MISMATCH` `{ store: 'ledger', expected: 1, found: 2 }` |
| **(a2)** | domain meta (L1, `<scratch>/team_domain.meta.json`): `version` 1→2 | **fails LOUDLY at open** | `SCHEMA_VERSION_MISMATCH` `{ expected: 1, found: 2, seamCode: 'version-mismatch' }` (the seam's `version-mismatch` is mapped, never migrated) |
| **(b1)** | `member_instances.json` truncated to half its bytes (torn table file) | **fails at open** (the medium is malformed) | `SEAM_FAILURE` `{ store: 'team_domain', op: 'open', seamCode: 'malformed-medium' }` |
| **(b2)** | one member row's body replaced with `garbage-not-json` (valid table JSON, invalid record JSON) | open **succeeds** (the table file is valid JSON) — the hydration **read** fails | `RECORD_INVALID` `{ store: 'member_instances', key: <member identity key>, contractsCode: 'MALFORMED_DTO' }` |
| **(b3)** | one member row's `schemaVersion` tampered 1→2 (re-serialized canonically, byte form intact) | open **succeeds** — the hydration **read** fails | `RECORD_INVALID` `{ store: 'member_instances', key: <member identity key>, contractsCode: 'SCHEMA_VERSION_MISMATCH' }` |
| **(c1)** | planted crash-shaped file `operations.json.999.42.tmp` containing garbage | open **succeeds**; the committed world is intact; recover is a 0-write no-op | — (the tmp is ignored by the reopened seam; the exact same tmp listing before and after) |
| **(c2)** | a REAL crash: armed fault at B9 (offset 7) on a live realm → 7 writes, 1 leftover tmp → drop → reopen | open **succeeds**; recover writes exactly 1; converges to the committed world | — (the crash-leftover tmp is ignored by the reopen; identical tmp listing before/after) |

Honest note on (a): the task brief said "tamper schema-meta stamp → SCHEMA_VERSION_MISMATCH typed error". T1's layered version policy (frozen, verified in `packages/storage/schema/version-policy.ts` + `repositories/team-domain.ts`) distinguishes **L1** (the domain meta at the seam: `SCHEMA_VERSION_MISMATCH`, seam code `version-mismatch`) from **L2** (the per-store `schema_meta` stamps: missing → `SCHEMA_STAMP_MISMATCH`; unsupported version → `SCHEMA_STAMP_MISMATCH` naming the exact store). BOTH layers are implemented as (a1) and (a2) and fail loudly at open; `SUPPORTED = [1]` and there is **no built-in migration** (a version-2 world is rejected, never auto-migrated). A dedicated `it` asserts both codes sit on the closed TeamDomainError code set and are **not** `SEAM_FAILURE`.

## 6. Process equivalence (DevPlan §17.5 criterion 7)

**Argument (criterion 7, in scope here):** a real OS process restart loses exactly the process's in-memory state; every durable byte survives. The testkit model reproduces that partition precisely:

1. **Durable side**: all state that must survive lives in the scratch dir (the 9 table files + the L1 meta), written only through the seam's atomic path (tmp + `renameSync`). The tests reopen over the **same dir** — the same durable bytes a real process would re-read.
2. **Volatile side**: `dropRealm` discards the entire in-memory stack — seam instance (write counts, crash arming, open-domain maps), TeamDomain (repositories, handles, schema-meta cache), the deterministic `FakeAgentFactoryAdapter`, and the `ProvisioningCoordinator` (journal, stage caches, orphan caches). `reopenRealm` constructs a **brand-new instance of each** — nothing is carried over except the files, exactly as a new process carries nothing over but its durable store. The fresh adapter re-derives the **same** deterministic child id for the same `(root, instance)` (its idempotent-minting contract), which is what makes post-restart convergence checkable.
3. **Observable equivalence**: every assertion in §2–§5 is phrased purely in durable/derived terms (seam write counts, row counts, tmp-file listings, typed error codes, derived stages, diagnostics, statuses) — no assertion reads any volatile state of the dead realm after the drop. The one documented deviation from a real OS crash: `dropRealm` performs a best-effort `close` (a real crash performs no clean close); the seam's `closeAll` mutates only in-memory maps and never touches durable bytes, so the durable partition is identical.

**What this model does NOT cover (honest boundary)**: it does not exercise a real OS process, a real StorageDomain binding, or cross-process file locking — that is P5 runtime territory (DevPlan §18). The seam here is a faithful *substitute* for the StorageDomain binding's durable surface (atomic single-row writes, exact error-code contract), not the binding itself.

## 7. DevPlan §17.5 Gate G4 criteria mapping

| # | criterion (DevPlan §17.5) | status in P4-T5 |
| --- | --- | --- |
| 1 | TeamDomain is sole Team control-plane authority | **fully judged by P4-T6** (out of scope here; T5 only exercises it as the durable store) |
| 2 | no Team SessionEvent persistence | **fully judged by P4-T6** (out of scope here; no event persistence exists in the P4-T1–T5 stack by construction) |
| 3 | crash matrix converges | **IN SCOPE — met**: §2 (all 10 boundaries converge to exactly one committed MemberInstance; no-crash boundaries idempotent) |
| 4 | retries idempotent | **IN SCOPE — met at the seam level**: §3 double retry (0-write no-op retries, same ledger sequence) + §2 per-boundary 0-write no-op recover |
| 5 | SessionBinding integrity checks | **PARTIAL**: T5 proves the binding row's durability, its exact pre-reopen presence per boundary, and its read-back in S0; the binding *integrity checks* (uniqueness assertions, cross-referencing) are judged by P4-T6 |
| 6 | schema version mismatch fails loudly | **PARTIAL**: T5 proves loud, typed, no-migration failures for L1 (`SCHEMA_VERSION_MISMATCH`) and L2 (`SCHEMA_STAMP_MISMATCH`) plus typed record-level version failures (`RECORD_INVALID`/`contractsCode: SCHEMA_VERSION_MISMATCH`, `MALFORMED_DTO`); full policy surface (all stores, all layers end-to-end) judged by P4-T6 |
| 7 | recovery tests work after process restart | **IN SCOPE — met**: §2/§3/§4/§5 all run recovery across the drop→reopen model, with the process-equivalence argument in §6 |

## 8. Fixtures

`packages/testkit/fault-injection/fixtures/committed-world/` — one deterministic pre-built durable-store snapshot (9 files: L1 meta + 8 tables): a fully committed world for `(session-root-1, inst-alpha)` — op `op-0w8t36l14xmk0e0ocfhj71ye` phase `COMMITTED` generation 3 (idempotency key `provision:session-root-1:inst-alpha:p4t5-alloc-alpha-1`), member record + `team-member` binding for the deterministic child `session-child-0w8t36l14xmk0e0o`, ledger fact sequence 1 + counter value 1, 8 `schema_meta` stamps (version 1). All 11 timestamp fields normalized to `2026-08-29T12:00:00Z`. It was generated by driving the REAL stack once (`createTeamDomain` + `provision` over the file seam — the write log was verified: 8 stamps + W1–W8) and is consumed by **4 test flows** (retry-restart committed-world restart; corrupt-version S0/a1/a2/b1/b2/b3/c1; corrupt-version c2 uses a live crash instead). Consumed by ≥1 p4t5 test: **satisfied (2 test files, 7 flows)**.

## 9. Documented deviations from the P4-T1 in-memory fake (both harmless/unreachable in provisioning)

1. A crash armed for an `update` whose key is **missing** throws `CrashFault` without writing a tmp (the in-memory fake cannot represent a mid-write crash on a no-op update). Unreachable: every provisioning `update` (W2, W6) targets an existing key.
2. The first-open medium initialization (L1 meta + one empty JSON file per declared table) is **infrastructure**, excluded from `writeCount`/`writeLog` — matching T4's arithmetic, which counts only KvTable writes (8 stamps + W1–W8).

## 10. Prior-task defect findings

**None.** The only harness bug found while building this task was in P4-T5's own new `file-seam.mjs` (`KvTable.update` resolved `undefined` instead of the updated value, breaking `LedgerRepository.allocateSequence`); it was fixed in this task's code and is not a T1–T4 defect. All T1–T4 behavior observed (error codes, details shapes, version policy, coordinator arithmetic, orphan diagnostics) matched the verified contracts exactly.
