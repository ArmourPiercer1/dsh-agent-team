# S2-result — P8-S2 (Leader + Core Contract Repair)

**Task:** P8-S2 (Leader + Core Contract Repair), closing CR-1 of `dev/agent-workflow/evidence/P8-S/confirmed-repair-list.md`
**Worktree:** `D:/AgentDev/dsh-plugins/dsh-agent-team/.worktrees/P8S2`
**Branch:** `task/P8-S2-leader-contract`
**Base SHA:** `3fa4c1f27ed1e8903c131dadc9aafe536ed9eb86`
**Final code SHA (code + tests, verified green):** `81c0beb71c13dc441351db431b84d3c4bdf0a020` — `P8-S2: leader contract — v2 LeaderInstance record, fail-closed guard, durable mint` (21 files changed, +1689/−68)
**Branch HEAD:** this evidence file, committed directly on top of the final code SHA as `P8-S2: evidence (S2-result.md — full TaskResult, 1798/1798 chain + tsc x6 green)` (single-writer branch, not pushed)
**Blockers:** none (no `CORE_SEAM_BLOCKER` / `CONTRACT_CHANGE_REQUEST` / `ARCHITECTURE_DECISION_REQUIRED` emitted)

---

## 1. Changed files

| File | Change |
| --- | --- |
| `packages/contracts/src/schema-version.ts` | `LEADER_INSTANCE_RECORD_SCHEMA_VERSION = 2` (+type); `SUPPORTED_SCHEMA_VERSIONS = [1, 2]` |
| `packages/contracts/src/dto/member-instance-record.ts` | v2 LeaderInstance record: fields/DTO/input, `validateLeaderInstanceRecord`, `createLeaderInstanceRecord`, `isLeaderInstanceRecordInput`; parse version routing (stamp 2 → v2 leader validator); `createMemberInstanceRecord` union input with shape-branch; documented type-lie casts at the v1-typed return/assignment surface |
| `packages/contracts/src/index.ts` | exports for the v2 symbols (both blocks) |
| `packages/contracts/CHANGELOG.md` | v2 section (status, authority citations, v1 untouched, added-in-v2 details, freeze-rule compliance) |
| `packages/contracts/test/leader-instance-record.test.ts` | **new** — S1–S13 contract suite (13 tests) |
| `packages/contracts/test/negative.test.ts` | supported-set update (defect-encoding, §4.1) |
| `packages/runtime/admission/resolve.ts` | C3 leader branch in `resolveCaller` (durable Root/Team identity) |
| `packages/runtime/lifecycle/errors.ts` | 7th code `LIFECYCLE_LEADER_NOT_OPERABLE` (+docs) |
| `packages/runtime/lifecycle/resolve.ts` | shape-agnostic leader guard in `loadMember` (before any durable read) |
| `packages/runtime/lifecycle/index.ts` | prologue/doc updates (seven codes; guard step) |
| `packages/runtime/root-binding/types.ts` | `TeamDomainWritePort.putMemberInstance`; `RootBindingPorts.blueprintCatalog?`; `RootBindingDurableState.leaderRow?` (union-typed) |
| `packages/runtime/root-binding/errors.ts` | 4th code `ROOT_BINDING_LEADER_MINT_FAILED` |
| `packages/runtime/root-binding/write-port.ts` | adapter `putMemberInstance` (documented cast) |
| `packages/runtime/root-binding/fresh-root.ts` | step 5: durable LeaderInstance mint (skip-check → fail-closed catalog check → `resolveBoundBlueprint` → mint after record+binding commit) |
| `packages/runtime/test/p5t5-helpers.ts` | world gains `blueprintCatalog` port (fixture-hash-matched `P5T5_BLUEPRINT` literal + catalog, documented test-world arrangement), recording proxy `putMemberInstance` passthrough, write-call union |
| `packages/runtime/test/p5t5-fresh-root.test.ts` | write-count defect-encoding (§4.2) |
| `packages/runtime/test/p5t5-cold-root.test.ts` | write-count defect-encoding (§4.3) |
| `packages/runtime/test/p5t5-admission.test.ts` | write-count defect-encoding (§4.4) |
| `packages/runtime/test/p8s2-leader-contract.test.ts` | **new** — acceptance suite, families A/B/C (12 tests) |
| `packages/testkit/test/p4t5-corrupt-version.test.ts` | b3 contractsCode defect-encoding (§4.5) |
| `packages/testkit/test/p4t6-session-event-scan.test.ts` | file-inventory defect-encoding (§4.6) |

Not touched (decisive unowned set verified by the working tree): `action-router/effects.ts`, `runtime/messaging/**`, `runtime/compatibility/**`, `runtime/activation/**`, `remote/**`, `tools/**`, `client/**`, `legacy/**`, `testkit/**` (except the two sanctioned test updates), `references/**`, `docs/**`, `storage/**`, `domain/lifecycle/**`, `runtime/projection/**`, `runtime/control/**`, `runtime/member-residency/**`, `admission/types.ts`, `agent-setup/**`.

---

## 2. Implementation summary (per acceptance item)

### C1 — archive/restore/dispose on the leader are rejected, fail-closed, never defaulted — PASS
`packages/runtime/lifecycle/resolve.ts` `loadMember` now throws `LifecycleRuntimeError(LIFECYCLE_RUNTIME_ERROR_CODES.LIFECYCLE_LEADER_NOT_OPERABLE, …)` immediately after `validateTarget(target)` whenever `target.instanceId === LEADER_INSTANCE_ID` — **before any durable read**, regardless of whether a row exists and regardless of its shape (v2 keyless, v1 legacy hack, or absent). Because archive (`archive.ts`), restore (`restore.ts`) and dispose (`dispose.ts`) all start with `loadMember`, the single guard covers all three transitions. The code was added as the 7th `LIFECYCLE_RUNTIME_ERROR_CODES` entry with JSDoc citing §9.2 / invariant 15. The `childSessionId = rootSessionId` hack no longer represents the Leader anywhere owned: fresh roots mint the honest v2 keyless row (§C2), the admission leader branch no longer depends on a member row (§C3), and the lifecycle guard rejects even a seeded legacy hack row (test C3).

### C2 — fresh root durably mints the LeaderInstance row, no harness seed — PASS
`packages/runtime/root-binding/fresh-root.ts` gains **step 5** between the binding commit and the binder run (crash-safe order: `putTeamSession` → `putSessionBinding` → `putMemberInstance(leader)` → binder):
- **Skip-check (idempotence):** `ports.teamDomain.getMemberInstance(rootSessionId, LEADER_INSTANCE_ID)` (the existing read handle — no write-port read probe) — if a row already exists it is reported as stored and no write occurs, so an idempotent re-run performs **zero** additional durable writes (pinned by A3: exactly 3 total write calls after the re-run).
- **Fail-closed catalog:** if `ports.blueprintCatalog` is absent the mint throws `ROOT_BINDING_LEADER_MINT_FAILED` with `details.cause = 'catalog-absent'` — the mint is never defaulted. If the bound blueprint is unusable, the activation error (`BLUEPRINT_UNRESOLVED` / `BLUEPRINT_HASH_MISMATCH` via `resolveBoundBlueprint`) is re-thrown as the same code with `details.cause = <activation code>`. On failure the record + binding writes stand (pinned by A4: write calls `[putTeamSession, putSessionBinding]`).
- **Honest v2 row:** the minted input carries exactly `rootSessionId, instanceId, templateId (blueprint.leader.templateId), label, createdAt, activityVersion: 1` — no `childSessionId`, no `lifecycle`, no `schemaVersion`. The repository's `put` routes it through the `createMemberInstanceRecord` shape-branch into `createLeaderInstanceRecord`, producing the v2 record. The result's `durable.leaderRow` reports the honest v2 row (union-typed `MemberInstanceRecordDto | LeaderInstanceRecordDto`; ABSENT when no row exists).
- `cold-root.ts` is **unchanged** — the cold path keeps its hard zero-durable-writes contract; the mint never runs on a cold rehydration.

### C3 — leader caller resolves from durable Root/Team identity, fresh and cold — PASS
`packages/runtime/admission/resolve.ts` `resolveCaller` now handles the leader id **first**, self-contained (the control plane calls it without the step-1 member lookup):
- no `TeamSession` record for the root → `CALLER_NOT_FOUND` (message cites §9.2: the leader resolves from the Root Session, not a member row);
- no `SessionBinding` or `kind !== 'team-root'` → `CALLER_NOT_FOUND`;
- then a best-effort row read: `memberInstances.get(root, 'inst-leader')` — present → `{ role: 'leader', callerMember: <row as stored> }` (v1 legacy or v2 — the row's `templateId` feeds the envelope intersection; its `lifecycle`/`childSessionId` are **never** consulted for the leader), absent → `{ role: 'leader' }` (absence is not a defect).
No staleness check applies to the leader (a leader is never archived/restored — C1). Consequences, all pinned: B1 (fresh, minted row) — the leader `list-members` (returns `inst-leader` with templateId `leader` and **no** defined lifecycle/childSession summary values, plus worker+scout) and `delegate` (`member-activated`) succeed; B2 (cold, after process restart) — the leader list still works and the v2 row survives; B3 (**no row at all**, fresh world never bound) — the leader list and delegate both succeed, proving the resolution derives from Root/Team identity, not from any seeded ordinary member row.

### C4 — MemberInstance remains an ordinary member; discriminated durable shape with validation — PASS
`createMemberInstanceRecord` input is the union `MemberInstanceRecordInput | LeaderInstanceRecordInput`. The shape guard `isLeaderInstanceRecordInput` branches **only** when `instanceId === LEADER_INSTANCE_ID && childSessionId === undefined && lifecycle === undefined` (own-value check) → the honest v2 leader record; **every other input — including half-hack leader rows (exactly one of the two fields) — takes the v1 path byte-identical to the frozen v1 factory**, where the missing/extra field is rejected fail-closed (the factory never defaults a value). The v2 validator (`validateLeaderInstanceRecord`) enforces the discriminated shape: forbidden-key checks **first** (`childSessionId` → `LEADER_INSTANCE_MUST_NOT_CARRY_CHILD_SESSION`, `lifecycle` → `LEADER_INSTANCE_MUST_NOT_CARRY_LIFECYCLE`, both `MALFORMED_DTO`), then no-legacy, no-unknown (v2 field set), presence, `assertSchemaVersion(… , 2)`, and `instanceId === LEADER_INSTANCE_ID`. Ordinary member behavior is unchanged end-to-end (B4: worker self `report-progress` → `fact-recorded`; all p6t2/p6t3/p6t4/p7t* suites green). The type-level design respects the unowned `storage/repositories/member-instances.ts` and `domain/lifecycle/transitions.ts` surfaces: the factory/parse/deserialize **return** types stay `MemberInstanceRecordDto` (documented type-lie, confined and commented at each cast site), while parameters may widen to the union.

### C5 — projection-ready discriminated actor semantics; frozen P8-T1 rule intact — PASS
`packages/contracts/src/projection/**` and `packages/runtime/projection/**` are untouched. The frozen P8-T1 member-projection DTO rule holds at the record layer and end-to-end: the leader row is keyless (`childSessionId` **ABSENT** for `inst-leader`, reason `LEADER_INSTANCE_MUST_NOT_CARRY_CHILD_SESSION`) and REQUIRED for every other member — pinned at the record layer by contracts S2/S3 (serialization carries no `childSessionId`/`lifecycle` key; round-trip stays keyless) and by runtime B1's list summary assertions (leader summary has no defined `lifecycle`/`childSessionId` values). The v1 freeze is honored: `TEAM_CONTRACT_SCHEMA_VERSION` stays 1, all v1 fields/validators/check-order are unchanged, and pre-existing v1 rows — including legacy harness-style leader rows carrying `childSessionId + lifecycle` — remain parseable (contracts S5). The parse **version routing** sends a stamp of exactly 2 (numeric, or numeric-string — a corrupt string `'2'` surfaces as `SCHEMA_VERSION_UNSUPPORTED` from the v2 validator, mirroring the v1 string-`'1'` behavior) to the v2 leader validator; every other value takes the v1 path (expected 1), where the frozen check order (no-legacy → no-unknown → presence → version) still applies (contracts S10).

---

## 3. Test evidence

Baseline at BASE_SHA `3fa4c1f`: full chain **1773/1773 pass**, tsc x6 exit 0 (recorded in the G8-S1 evidence).

Commands (run from the worktree root) and results at final SHA `81c0beb`:

| Command | Result |
| --- | --- |
| `node scripts/run-tests.mjs` (full chain) | **1798 passed, 0 failed, 1798 total** — exit 0 (`RESULT: PASS run-tests (0 failures)`) |
| `node scripts/run-tests.mjs runtime` (subset) | 725 passed, 0 failed, 725 total — exit 0 |
| `node node_modules/typescript/bin/tsc -p packages/contracts/tsconfig.json` | exit 0 |
| `node node_modules/typescript/bin/tsc -p packages/domain/tsconfig.json` | exit 0 |
| `node node_modules/typescript/bin/tsc -p packages/storage/tsconfig.json` | exit 0 |
| `node node_modules/typescript/bin/tsc -p packages/runtime/tsconfig.json` | exit 0 |
| `node node_modules/typescript/bin/tsc -p packages/testkit/tsconfig.json` | exit 0 |
| `node node_modules/typescript/bin/tsc -p packages/remote/tsconfig.json` | exit 0 |

Delta: 1798 − 1773 = **25 new tests** (13 contracts `leader-instance-record` + 12 runtime `p8s2-leader-contract`), **zero regressions** across all 1773 pre-existing tests.

### Acceptance items (C1–C5)

| Item | Status | Evidence |
| --- | --- | --- |
| C1 | **PASS** | lifecycle guard (§2.C1); tests C1/C2/C3 of `p8s2-leader-contract` (no row / present v2 row / legacy v1 hack row → all three transitions reject with `LIFECYCLE_LEADER_NOT_OPERABLE` before any read; `clock.kinds()` empty; seam write delta 0) |
| C2 | **PASS** | fresh-root mint step 5 (§2.C2); tests A1 (3 ordered writes incl. `putMemberInstance`), A2 (repo + result row: schemaVersion 2, keyless, templateId `leader`), A4 (absent catalog → `ROOT_BINDING_LEADER_MINT_FAILED`, cause `catalog-absent`, first two writes stand), B1 (production adapters over p6t2 world, no leader seed) |
| C3 | **PASS** | admission leader branch (§2.C3); tests B1 (fresh: list + delegate), B2 (cold after restart: list works, row survives), B3 (no row at all: list + delegate succeed) |
| C4 | **PASS** | shape-branch factory + v2 validator (§2.C4); contracts S4/S7–S13 (half-hack rejected fail-closed on the v1 path; forbidden keys; instanceId rule; version routing) + runtime B4 (ordinary member `report-progress` unchanged) |
| C5 | **PASS** | projection packages untouched; contracts S2/S3 (keyless serialization + round-trip) + runtime B1 summary assertions (leader: no defined lifecycle/childSession values; members keep theirs); frozen P8-T1 projection suites green |

### The eight required test items (§15.3)

1. **Fresh root → leader can list/delegate — PASS** (family B1: `members-listed` with `inst-leader` + worker + scout, then `delegate` → `member-activated`; a second list keeps the keyless leader summary).
2. **Cold root → leader remains valid — PASS** (family B2: `restartP6T1World` → cold list succeeds, the v2 row survives the restart; family A5: cold rehydration is zero-write and reports the row intact).
3. **archive(inst-leader) rejected — PASS** (C1: typed `LIFECYCLE_LEADER_NOT_OPERABLE`, zero durable effects).
4. **restore(inst-leader) rejected — PASS** (C1: same).
5. **dispose(inst-leader) rejected — PASS** (C1: same; C2 adds the present-v2-row variant, C3 the legacy v1 hack-row variant — all rejected).
6. **No fake leader member seed (fresh-root path works with no seeding at all) — PASS** (A1: the fresh bind writes exactly `[putTeamSession, putSessionBinding, putMemberInstance]` — the leader row is minted by the contract, not seeded; B3: a world with **no** leader row still serves leader list/delegate from Root/Team identity).
7. **Ordinary Member behavior unchanged — PASS** (B4 worker self `report-progress` → `fact-recorded`; the entire p6t2/p6t3/p6t4/p7t*/p8t2 surface green — 1773 baseline tests all still pass).
8. **Serialization/migration tests for the record shape change — PASS** (contracts S2/S3: v2 row serializes keyless and round-trips keyless; S5: v1 leader rows remain parseable — the freeze adds, never rewrites; p4t5 b3: a v2-stamped member row fails typed at hydration, no silent migration).

---

## 4. Pre-existing test updates (each justified: defect-encoding vs invariant)

Every updated pre-existing test is a **defect-encoding** update (the assertion encoded the pre-P8-S2 state of the system under an authorized change). **No invariant test was weakened.**

1. **`packages/contracts/test/negative.test.ts`** — "supports exactly version 1" → "supports exactly versions 1 and 2 (P8-S2…)". *Defect-encoding:* the supported-record-version set legitimately grew `[1]` → `[1, 2]` under the authorized v2 contract change (new schemaVersion stamp + CHANGELOG v2 + freeze-rule compliance). The assertion still pins all negatives (0, 3, string `'1'`, string `'2'` all rejected). The adjacent TeamSession `schemaVersion: 2 → MISMATCH` case is untouched and still passes (TeamSession stays v1-only).
2. **`packages/runtime/test/p5t5-fresh-root.test.ts`** — S1 `writeCalls` toEqual gains the third entry `{method:'putMemberInstance'}` (+ ordering comment: record → binding → leader mint); S3/S4 counts 2→3 (the successful first bind now mints; the failed re-run still writes nothing); S7 `failingWrites` fake gains the `putMemberInstance` port member (type completeness; in S7's flow the binding put fails first, so the mint is never reached — the record-stands/binder-not-run/recovery assertions are unchanged). *Defect-encoding:* the old counts encoded the pre-mint fresh path; the mint is the new third durable write of the fresh path. Fail-closed semantics unchanged.
3. **`packages/runtime/test/p5t5-cold-root.test.ts`** — S2/S7 counts 2→3 (the fresh phase now mints; the cold re-run/failed restore attempt still adds **zero** writes — the zero-write cold contract is unchanged and still pinned). *Defect-encoding.*
4. **`packages/runtime/test/p5t5-admission.test.ts`** — S1/S3 counts 2→3 (the original fresh create now includes the mint; "written exactly once" holds with three rows). *Defect-encoding.*
5. **`packages/testkit/test/p4t5-corrupt-version.test.ts`** — case (b3) expected `contractsCode` `SCHEMA_VERSION_MISMATCH` → `MALFORMED_DTO` (module doc + test title updated to say so). *Defect-encoding:* under the v1-only supported set, a member row stamped 2 was "unsupported version". Under the authorized v2 change, stamp 2 **identifies the LeaderInstance record**, so the parse dispatcher routes stamp-2 rows to the v2 leader validator, where a member row is a malformed leader record (forbidden `childSessionId` key → `MALFORMED_DTO`, reason `LEADER_INSTANCE_MUST_NOT_CARRY_CHILD_SESSION`). The invariant is preserved and still pinned: open succeeds, the hydration READ fails **loudly and typed** (`RECORD_INVALID`, store + key surfaced), never silently.
6. **`packages/testkit/test/p4t6-session-event-scan.test.ts`** — scanned-file inventory 484 → 486 (+ inventory comment line naming the two new files). *Defect-encoding:* the audit enumerates the tree; P8-S2 adds exactly two test files (`packages/contracts/test/leader-instance-record.test.ts`, `packages/runtime/test/p8s2-leader-contract.test.ts`). The denylist/quarantine/exclusion assertions are unchanged and still pass.

Also updated (test infrastructure for the new port, not an assertion): **`packages/runtime/test/p5t5-helpers.ts`** — the p5t5 world now supplies the new optional `blueprintCatalog` port (a `P5T5_BLUEPRINT` literal whose `contentHash` equals the fixture's bound ref **by construction**, so `resolveBoundBlueprint`'s hash equality passes — a documented test-world arrangement; `createBlueprintCatalog` performs no hash re-derivation), the recording write proxy passes through `putMemberInstance`, and the write-call method union gained it. Without the catalog the fresh path would fail-closed by design; the world is pre-arrangement, not a module write.

Invariant tests kept intact (not updated): `packages/domain/test/t3-member-n-instances.test.ts`, `packages/testkit/test/t6-9-negative-matrix.test.ts`, `packages/contracts/test/identity.test.ts`, and the entire frozen P8-T1 projection suite.

---

## 5. Blockers and known limitations

**Blockers: none.** No `CORE_SEAM_BLOCKER`, `CONTRACT_CHANGE_REQUEST`, or `ARCHITECTURE_DECISION_REQUIRED` was encountered.

Known limitations (all by design, none block CR-1):
1. **Documented type-lie at the v1-typed surface.** The unowned `packages/storage/repositories/member-instances.ts` assigns factory/parse results to `MemberInstanceRecordDto` and `packages/domain/lifecycle/src/transitions.ts` does strict `record.lifecycle` access; union *return* types on the factory/parse/deserialize surface are impossible without editing unowned files. The lie is confined to those return types and the port/read-handle signatures, with a comment at each cast site; a v2 object is a `LeaderInstanceRecordDto` sharing the identity core, and its absent keys stay absent at runtime (never defaulted).
2. **The legacy harness still seeds v1 hack rows in its own flow** (`tools/harness/plugin.mjs` is frozen/unowned and does not call `bindFreshTeamRoot`). Those rows remain readable v1 (freeze rule) and are rejected shape-agnostically by the lifecycle guard (test C3).
3. **No mint on the cold path** — by design: the cold path's hard zero-durable-writes contract is preserved; C3 satisfaction comes from caller derivation from Root/Team identity, not from cold-path minting.
4. **`memberSummary` for a v2 leader row carries no defined `lifecycle`/`childSessionId` values** (the unowned `admission/types.ts` reads them unguarded → `undefined`). `list-members` remains correct for the leader (C3) and the frozen P8-T1 projection rule holds at the DTO layer; fixing the summary shape would require touching unowned files.

## 6. No-core assertion

- **CORE PATCH BUDGET = 0 honored:** no `deepseek-harness` upstream source was modified; no unexported/private upstream imports; no patch-package/pnpm patch/postinstall rewriting; no vendored upstream copies.
- No Team-specific DSH SessionEvent authority reintroduced; no SessionController Team mirror; no continuable subagent used as a MemberInstance primitive; no label/templateId/groupId used as runtime actor identity (identity stays `(rootSessionId, instanceId)` per invariant 18); no UI/Remote second Team authority.
- Frozen architecture and acceptance tests not weakened: the four frozen docs untouched, all 1773 baseline tests pass unmodified except the six justified defect-encoding updates (§4), the frozen P8-T1 projection DTO rule is pinned and green, and `REMOTE_CONTRACT_VERSION = 1` is untouched (the new runtime error codes pass through the remote dispatcher unchanged — remote suite green).
- All edits stay inside `owned_paths` except the two sanctioned testkit defect-encoding audit updates (§4.5, §4.6), which the task packet explicitly permits "wherever located".
- No servers started; no push; working tree clean at the final SHA.
