# S2-review — P8-S2 (Leader + Core Contract Repair), independent task-level review

**Verdict: APPROVE**

- **Reviewer role**: independent task-level reviewer (read-only; sole write = this file)
- **Repo**: `D:/AgentDev/dsh-plugins/dsh-agent-team`
- **Review worktree**: `D:/AgentDev/dsh-plugins/dsh-agent-team/.worktrees/P8S2-R` (detached, verified `git rev-parse HEAD` = `126b074953392aa790334840457ad5d8bba7a216`; `git status --porcelain` clean at review start and after all verification runs)
- **Diff under review**: `git diff 3fa4c1f27ed1e8903c131dadc9aafe536ed9eb86..HEAD` — 22 files, +1834/−68 (every hunk read; file map below)
- **Branch**: `task/P8-S2-leader-contract` (code commit `81c0beb`, evidence commit `126b074`)
- **Task closed**: CR-1 of `dev/agent-workflow/evidence/P8-S/confirmed-repair-list.md` (S1B D-C remaining gap: durable leader record shape C-1a, fresh-root leader-row producer C-1b, leader caller resolution C-1c, fail-closed leader lifecycle guard C-2, harness-seeding hack C-1harness)

## 1. Acceptance checklist (plan §15.2 + §15.3)

| Item | Status | Evidence (file:function / test) |
| --- | --- | --- |
| C1a Leader representation: Leader = Root Agent + Root Session; v2 durable record has NO `childSessionId`/`lifecycle` keys (rejected on presence, never defaulted); `instanceId` must be `inst-leader` | **PASS** | `packages/contracts/src/dto/member-instance-record.ts` — `LeaderInstanceRecordDto` (field set = v1 minus `childSessionId`/`lifecycle`; `LEADER_INSTANCE_RECORD_FIELDS`), `validateLeaderInstanceRecord` (forbidden-key checks FIRST: `childSessionId` → `MALFORMED_DTO` reason `LEADER_INSTANCE_MUST_NOT_CARRY_CHILD_SESSION`, `lifecycle` → `MALFORMED_DTO` reason `LEADER_INSTANCE_MUST_NOT_CARRY_LIFECYCLE`; then no-legacy → no-unknown → presence → `assertSchemaVersion(…, 2)` → `instanceId !== LEADER_INSTANCE_ID` → `MALFORMED_DTO`); `createLeaderInstanceRecord` input gate (`LEADER_INSTANCE_RECORD_INPUT_FIELDS`, any `schemaVersion`/`childSessionId`/`lifecycle` key fails closed). Tests: contracts S1, S7, S8, S9, S12, S13 (all PASS) |
| C1b Fail-closed leader lifecycle guard; guard BEFORE any durable read/live effect in the prologue | **PASS** | `packages/runtime/lifecycle/resolve.ts:79-94` — `loadMember` = `validateTarget(target)` (identity gate only) → `if (target.instanceId === LEADER_INSTANCE_ID) throw new LifecycleRuntimeError(LIFECYCLE_LEADER_NOT_OPERABLE, …)` → only THEN `ports.teamDomain.repositories.memberInstances.get(…)`. Single guard covers all three operations because `archiveMember` (`archive.ts:111`), `restoreMember` (`restore.ts:59`), `disposeMember` (`dispose.ts:75`) each start with `loadMember` as their first statement. New 7th code in `lifecycle/errors.ts` (JSDoc: thrown before the durable read, no effect, shape-agnostic). Shape-agnostic: guard keys on the target id only — no row, v2 keyless row, or legacy v1 hack row all reject identically. Tests: runtime C1 (no row: archive+restore+dispose reject; `liveCallKinds = []`, `seamWriteDelta = 0`), C2 (present v2 row: archive rejects — not MEMBER_NOT_FOUND, not a lifecycle fault), C3 (legacy v1 hack row with `childSessionId`+`lifecycle: 'RUNNING'`: dispose rejects) — all PASS |
| C1c `childSessionId = rootSessionId` hack no longer represents the Leader in durable record, resolution, or lifecycle paths | **PASS** | Durable: fresh mint writes the keyless v2 row (A1/A2); the union factory never accepts a half-hack (S12). Resolution: `packages/runtime/admission/resolve.ts` `resolveCaller` leader branch never reads the row's `childSessionId`/`lifecycle` (row is best-effort, optional; its `templateId` is the only field consumed, for the envelope). Lifecycle: the guard rejects by instance id regardless of row shape (C1–C3, incl. the legacy hack row). Note (in-scope boundary): the frozen/unowned `tools/harness/plugin.mjs` seed block is not in the owned path set and is untouched by design (CR-1 secondary note defers harness de-duplication to P8-S5); its v1 rows remain parseable (freeze rule) and no longer represent the leader in any owned path |
| C2 Fresh root immediately yields a valid Leader actor identity, NO harness seed; durable mint idempotent, crash-safe ordering, fail-closed `ROOT_BINDING_LEADER_MINT_FAILED`, never defaulted | **PASS** | `packages/runtime/root-binding/fresh-root.ts:213-253` (new step 5, between binding commit and binder): skip-check via existing read handle `ports.teamDomain.getMemberInstance(sessionId, LEADER_INSTANCE_ID)` → row present: reported as stored, **zero writes**; absent: `ports.blueprintCatalog === undefined` → `ROOT_BINDING_LEADER_MINT_FAILED` (`details.cause = 'catalog-absent'`); `resolveBoundBlueprint` activation failure (`BLUEPRINT_UNRESOLVED`/`BLUEPRINT_HASH_MISMATCH`) re-thrown as the same code with `cause = <activation code>`; mint input carries exactly `rootSessionId, instanceId: LEADER_INSTANCE_ID, templateId: blueprint.leader.templateId, label, createdAt, activityVersion: 1` — no `childSessionId`/`lifecycle`/`schemaVersion`; write via `ports.writes.putMemberInstance` (production adapter = `repositories.memberInstances.put`, same-handle write chain). Ordering after record+binding commit: A1 pins `[putTeamSession, putSessionBinding, putMemberInstance]`; A4 pins the first two writes standing on mint failure. `cold-root.ts` untouched (not in diff); A5 pins cold rehydration zero-write. Tests A1–A5 + B1 (production adapters over a p6t2 world with NO leader seed) all PASS |
| C3 Leader caller resolves from durable Root/Team identity (TeamSession record + team-root binding required, else `CALLER_NOT_FOUND`) at fresh AND cold root; leader row absence is not a defect; leader row lifecycle NEVER governs the Leader; member path returns only the member role | **PASS** | `packages/runtime/admission/resolve.ts` `resolveCaller` (leader branch first, self-contained): `repositories.teamSessions.get(root) === undefined` → `CALLER_NOT_FOUND`; `sessionBindings.get(root)` missing or `kind !== 'team-root'` → `CALLER_NOT_FOUND`; then best-effort `memberInstances.get(root, 'inst-leader')` → present: `{ role: 'leader', callerMember: <row as stored> }`, absent: `{ role: 'leader' }`; NO staleness check for the leader (old leader row-exists + `CALLER_ROLE_STALE` path removed; the member tail now returns `{ role: 'member', callerMember }` unconditionally). Tests: B1 (fresh: `members-listed` incl. leader + delegate → `member-activated`), B2 (after `restartP6T1World`: cold list succeeds, v2 row survives), B3 (world with NO leader row: list + delegate both succeed; leader simply absent from the roster) — all PASS; member-caller suites (p6t1-*, p6t2-*) all green |
| C4 MemberInstance remains ordinary member only: member rows require `childSessionId`+`lifecycle`; union factory shape-guard rejects the half-hack fail-closed with no defaulting | **PASS** | `validateMemberInstanceRecord` byte-unchanged (all v1 fields required, frozen check order) — v1 diff hunk shows only context. `isLeaderInstanceRecordInput` branches ONLY on `instanceId === LEADER_INSTANCE_ID && childSessionId === undefined && lifecycle === undefined` (own-value check); every other input (incl. half-hacks: leader id with exactly one of the two fields) falls to the v1 path where the missing field is rejected fail-closed — the factory never defaults. Tests: contracts S12 (half-hack `leaderInput + childSessionId` → `createMemberInstanceRecord` → `MALFORMED_DTO`; `leaderInput + lifecycle` → `createLeaderInstanceRecord` → `MALFORMED_DTO`), S5/S6 (v1 member row unchanged), S10 (keyless row stamped 1 → v1 path → `MALFORMED_DTO`); runtime B4 (ordinary member `report-progress` → `fact-recorded`) — all PASS |
| C5 Projection-ready discriminated actor semantics; FROZEN P8-T1 projection rule NOT regressed (`childSessionId` absent for `inst-leader`, REQUIRED for every other member) | **PASS** | `git diff --name-only` contains NO file under `packages/contracts/src/projection/**` or `packages/runtime/projection/**` — the frozen `member.ts`/`validateMemberProjection` are untouched. Rule holds at the record layer: v2 row serializes with no `childSessionId`/`lifecycle` key and round-trips keyless (contracts S2/S3); runtime B1 asserts the leader list summary carries NO defined `lifecycle`/`childSessionId` values while members keep theirs; the entire frozen P8-T1 suite passes (`p8t1-projection-generation` 8, `p8t1-projection-negative` 23, `p8t1-projection-overlay` 8, `p8t1-projection-serialization` 11) |
| T1 fresh root → leader can list/delegate (test exists + passes) | **PASS** | `packages/runtime/test/p8s2-leader-contract.test.ts` `B1: a fresh root without any leader seed mints the v2 row and the Leader lists and delegates` — PASS (in 1798/1798 chain) |
| T2 cold root → leader remains valid (test exists + passes) | **PASS** | same file `B2: after a process restart the v2 leader row survives and the Leader still acts` — PASS; corroborated by `A5` (cold rehydration zero-write, row intact) |
| T3 archive(inst-leader) rejected (test exists + passes) | **PASS** | same file `C1` (no-row variant, typed `LIFECYCLE_LEADER_NOT_OPERABLE`) + `C2` (present-v2-row variant) — PASS |
| T4 restore(inst-leader) rejected (test exists + passes) | **PASS** | same file `C1` (restore leg, zero live calls, zero durable writes) — PASS |
| T5 dispose(inst-leader) rejected (test exists + passes) | **PASS** | same file `C1` (dispose leg) + `C3` (legacy v1 hack-row variant) — PASS |
| T6 no fake leader member seed (fresh-root path works with no seeding) | **PASS** | `A1` (fresh bind writes exactly the three team rows; the leader row exists only because the contract minted it — the p5t5/p6t2 worlds contain no leader seed) + `B3` (no row at all: leader list/delegate still succeed) — PASS |
| T7 ordinary Member behavior unchanged (no member-path regression) | **PASS** | `B4` (worker self `report-progress` → `fact-recorded`); baseline member surface green: p6t1-*, p6t2-* (incl. `p6t2-actions` 30, `p6t2-authority` 10, `p6t2-addressing` 12), p6t3/p6t4, p7t* (incl. all five `p7t3-*` lifecycle suites), `t3-member-n-instances` (14), `t6-9-negative-matrix` (12) — PASS |
| T8 serialization/migration: v1 records (incl. legacy harness-style leader rows carrying both fields) still parse; round-trip passes | **PASS** | contracts `S5` (v1 leader row with `childSessionId`+`lifecycle: 'RUNNING'` parses, fields intact), `S6` (v1 member row parses), `S2`/`S3` (v2 row serializes keyless, round-trips keyless, `toEqual` original), `S10` (corrupt/foreign stamps fail closed), plus testkit `p4t5-corrupt-version` (10 tests) PASS — no silent migration |

## 2. Frozen invariants (relevant subset)

| # | Invariant | Status |
| --- | --- | --- |
| 1 | CORE PATCH BUDGET = 0 | **Held** — 0 files under `references/` in the diff; no upstream/deepseek-harness imports in any added line (only in-repo relative imports: `../../contracts`, `../../domain/blueprint`, `../../storage/repositories`, `../activation`, `../lifecycle`, test helpers); no `package.json`/`pnpm-lock`/patch-tooling changes |
| 2 | Object model TeamBlueprint → TeamSession + TeamDomain → MemberInstance | **Held** — no changes to the model; leader is now the Root Agent + Root Session per §9.2 |
| 3 | Leader = Root Agent + Root Session, `inst-leader`, no childSessionId | **Held** — encoded in the v2 record (C1a) and enforced by the guard (C1b) |
| 4 | No Team SessionEvents / no SessionController Team mirror / no session-log scan for Team authority | **Held** — none of those surfaces touched; `p4t6-session-event-scan` (10 tests) green with denylist/quarantine/exclusion assertions unchanged |
| 5 | label/templateId/groupId never runtime actor identity | **Held** — leader resolution keys on `instanceId === LEADER_INSTANCE_ID` + durable Root/Team records only |
| 6 | TeamDomain single backend authority | **Held** — mint flows through the TeamDomain repositories (same-handle write port) |
| 7 | Durable writes through TeamDomain repositories | **Held** — `write-port.ts` `putMemberInstance` adapter → `repositories.memberInstances.put` (verified: unowned repo `put` → `createMemberInstanceRecord` union factory, so the mint routes through the shape branch with no storage edits) |
| 8 | P8-T1 projection leader rule frozen | **Held** — projection packages untouched; suites green (see C5) |
| 9 | REMOTE_CONTRACT_VERSION = 1; `packages/remote` out of scope | **Held** — `packages/remote` absent from the diff; `packages/remote/src/contracts/version.ts:29` still `= 1 as const` |
| 10 | Member instanceId deterministic from (rootSessionId, source, requestToken) | **Held** — admission member path and domain untouched (diff hunk only removes the leader-specific message suffix from the shared member branch) |
| 11 | Leader guard REJECTS; no new lifecycle states | **Held** — only a new runtime error code was added; `domain/lifecycle/**` untouched; no state additions |
| 12 | Schema freeze: adding v2 never rewrites v1; all v1 records stay parseable | **Held** — v1 validator/fields/check-order byte-unchanged; `TEAM_CONTRACT_SCHEMA_VERSION` stays 1; `SUPPORTED_SCHEMA_VERSIONS` grows `[1] → [1, 2]` (documented in CHANGELOG v2 with authority citations); S5/S6/negative suites pin v1 parseability incl. legacy hack rows |
| 13 | No invariant test weakened; defect-encoding updates documented | **Held** — all six pre-existing test updates are defect-encoding and documented in S2-result §4 (see §3 below); invariant suites `t3-member-n-instances`, `t6-9-negative-matrix`, `contracts identity`, and the entire P8-T1 projection suite are unmodified and green |

## 3. Explicit judgment: the two testkit audit-scan edits

**Verdict on both: LEGITIMATE defect-encoding / expected-value updates. NO scan weakening. NOT scope creep.**

Both files live in `packages/testkit/test/**`, outside the owned path list, which is exactly why they required special judgment. Both edits change ONLY expected values (plus the documentation comments that describe those values); neither touches any scan/exclusion/denylist logic.

### 3.1 `packages/testkit/test/p4t5-corrupt-version.test.ts` (b3: `SCHEMA_VERSION_MISMATCH` → `MALFORMED_DTO`)

Exact hunks (diff lines 2378–2407):

- Hunk `@@ -19,7 +19,10 @@` (module doc, case (b3) description): `- *     preserving contractsCode `SCHEMA_VERSION_MISMATCH`;` → `+ *     preserving contractsCode `MALFORMED_DTO` (P8-S2: stamp 2 now names the v2 LeaderInstance record, so a member row stamped 2 is a malformed leader record carrying forbidden keys, not a version mismatch — the read still fails loudly, never silently);`
- Hunk `@@ -403,14 +406,17 @@` (test (b3)): the `it(...)` title gains the same defect-encoding annotation; the single changed assertion is `- expect(b3?.details?.['contractsCode']).toBe('SCHEMA_VERSION_MISMATCH')` → `+ expect(b3?.details?.['contractsCode']).toBe('MALFORMED_DTO')` with an inline comment (`// P8-S2: the parse dispatcher routes stamp-2 rows to the v2 LeaderInstance validator; the member row carries the forbidden childSessionId key → MALFORMED_DTO (reason LEADER_INSTANCE_MUST_NOT_CARRY_CHILD_SESSION).`).

Why this is a defect-encoding update, not a weakening:
1. **The failure invariant is fully preserved and still pinned, line-for-line, in the same test**: `openOk === true`, `readOk === false`, `readErrorCode === 'RECORD_INVALID'`, `details['store'] === 'member_instances'`, `details['key'] === MEMBER_KEY` — all unchanged. The test still proves the hydration READ fails LOUDLY and TYPED, never silently.
2. **The old expected value encoded the pre-P8-S2 state**: under the v1-only supported set, a stamp-2 row was an "unsupported version". Under the authorized v2 contract change, stamp 2 now *names* the LeaderInstance record, so the (authorized, documented) parse routing sends stamp-2 rows to `validateLeaderInstanceRecord`, where a member row is malformed on the first forbidden key (`childSessionId` → `MALFORMED_DTO`, reason `LEADER_INSTANCE_MUST_NOT_CARRY_CHILD_SESSION`). This is exactly the same code path pinned by contracts S8 and by the new runtime C2/C3 tests. The new expectation is a *more specific* classification of the same typed failure, produced by a legitimate contract change — which is the definition of a defect-encoding update.
3. **No scan surface is involved**: this is a fault-injection hydration test, not an audit scan; the file's (c)-series reopen-poisoning tests are untouched.

### 3.2 `packages/testkit/test/p4t6-session-event-scan.test.ts` (filesScanned 484 → 486)

Exact hunk (diff lines 2414–2426), single hunk `@@ -159,9 +159,11 @@` in `describe('p4t6 frozen Team SessionEvent denylist scan')`:

- Comment inventory line updated: `- // runtime g8s1-generation-stamp)).` → `+ // runtime g8s1-generation-stamp) +` / `+ // 2 P8-S2 leader-contract test files (contracts` / `+ // leader-instance-record.test + runtime p8s2-leader-contract.test)).`
- `- expect(scanResult.filesScanned).toBe(484)` → `+ expect(scanResult.filesScanned).toBe(486)`
- `- expect(scanResult.files.length).toBe(484)` → `+ expect(scanResult.files.length).toBe(486)`

Why this is legitimate, not scope creep:
1. The test pins an **exact file-inventory count** of the tree the audit enumerates. P8-S2 adds exactly two test files (`packages/contracts/test/leader-instance-record.test.ts`, `packages/runtime/test/p8s2-leader-contract.test.ts`); 484 + 2 = 486. The delta matches the diff contents one-for-one (verified: `git diff --name-only` shows exactly those two new test files and no other new file).
2. **Scan logic and exclusion contract are untouched**: the scanner implementation (not in the diff) is unchanged; the subsequent `it('exclusion contract: exactly the two self-referential files are excluded, in sorted order')` and all denylist/quarantine assertions are unchanged (diff ends at the count lines; the exclusion test shows only as context). The test still fails loudly if any file disappears from or is added to the scan universe beyond the documented delta.
3. This is the same inventory-pin discipline the test already exercised for prior tasks (the comment history records the G8-S1 +2 pin 482→484). Bumping the pin with a comment naming the added files is the established, documented update pattern for this audit — not a weakening (a weakened scan would drop/loosen denylist or exclusion assertions, which did not happen).

Both updates are documented per-frozen-invariant-13 in S2-result §4.5/§4.6 with defect-encoding justification. **Approved as in-scope-by-task-packet ("wherever located" sanction for the two audit updates) and technically sound.**

## 4. Diff scope audit (base..head, 22 files)

File map (all hunks read):

| # | File | Nature |
| --- | --- | --- |
| 1 | `dev/agent-workflow/evidence/P8-S/S2-result.md` | new evidence file (worker TaskResult) |
| 2 | `packages/contracts/CHANGELOG.md` | +v2 section (authority, added-in-v2, freeze-rule compliance); v1 text untouched |
| 3 | `packages/contracts/src/dto/member-instance-record.ts` | v2 DTO/input/fields, `validateLeaderInstanceRecord`, `createLeaderInstanceRecord`, `isLeaderInstanceRecordInput`, parse version routing, union `createMemberInstanceRecord`, module-doc rewrite for the leader model; documented type-lie casts confined to the three factory/parse/deserialize return surfaces |
| 4 | `packages/contracts/src/index.ts` | exports for the new symbols (value + type blocks) |
| 5 | `packages/contracts/src/schema-version.ts` | `LEADER_INSTANCE_RECORD_SCHEMA_VERSION = 2` (+type); `SUPPORTED_SCHEMA_VERSIONS = [1, 2]`; `TEAM_CONTRACT_SCHEMA_VERSION` stays 1 |
| 6 | `packages/contracts/test/leader-instance-record.test.ts` | NEW — 13 tests S1–S13 |
| 7 | `packages/contracts/test/negative.test.ts` | supported-set defect-encoding update (§3 pattern; negatives STRENGTHENED: adds pins for `3` and string `'2'`) |
| 8 | `packages/runtime/admission/resolve.ts` | C3 leader branch in `resolveCaller`; member tail returns `{role:'member'}`; old leader suffix removed from member message |
| 9 | `packages/runtime/lifecycle/errors.ts` | 7th code `LIFECYCLE_LEADER_NOT_OPERABLE` + JSDoc; no-effect list updated (guard joined the before-effect codes) |
| 10 | `packages/runtime/lifecycle/index.ts` | module doc only (six→seven codes; prologue order `identity → LeaderInstance guard → durable read → dry-run legality`) |
| 11 | `packages/runtime/lifecycle/resolve.ts` | the guard itself in `loadMember` (+import, +JSDoc) |
| 12 | `packages/runtime/root-binding/errors.ts` | 4th code `ROOT_BINDING_LEADER_MINT_FAILED` + JSDoc |
| 13 | `packages/runtime/root-binding/fresh-root.ts` | step 5 durable mint (skip-check → fail-closed catalog → `resolveBoundBlueprint` → put after record+binding); step renumbering docs; `durable.leaderRow` in result |
| 14 | `packages/runtime/root-binding/types.ts` | `TeamDomainWritePort.putMemberInstance`; `RootBindingPorts.blueprintCatalog?`; `RootBindingDurableState.leaderRow?` (union-typed, ABSENT semantics documented) |
| 15 | `packages/runtime/root-binding/write-port.ts` | adapter `putMemberInstance` (documented cast to the unowned repo's v1-typed `put`) |
| 16–19 | `packages/runtime/test/p5t5-{admission,cold-root,fresh-root}.test.ts` | write-count/order defect-encoding (2→3; S1 `writeCalls` toEqual gains the third entry; S7 fake gains a faithful `putMemberInstance` delegate — mint never reached in S7 because the binding put fails first) |
| 20 | `packages/runtime/test/p5t5-helpers.ts` | test-world arrangement: `P5T5_BLUEPRINT` literal whose `contentHash` equals `P5T5_FIXTURE.blueprint.contentHash` BY CONSTRUCTION (verified in file: fixture ref hash `sha256-1111…` at line 59 = blueprint literal hash at line 83); `createBlueprintCatalog([P5T5_BLUEPRINT])` port; recording proxy `putMemberInstance` passthrough; write-call method union |
| 21 | `packages/runtime/test/p8s2-leader-contract.test.ts` | NEW — 12 tests A1–A5, B1–B4, C1–C3 (production adapters over p5t5/p6t2/p6t1/p7t3 worlds; no leader seeding anywhere) |
| 22 | `packages/testkit/test/p4t5-corrupt-version.test.ts` + `packages/testkit/test/p4t6-session-event-scan.test.ts` | the two sanctioned defect-encoding audit updates (§3) |

**No unrelated refactors.** Every hunk is leader-contract work: new v2 record code, the guard, the mint, caller resolution, their JSDoc/doc updates that state the new contract, and test updates forced by the new third durable write / new supported version / new test files. `cold-root.ts`, `quiesce.ts`, `archive.ts`/`restore.ts`/`dispose.ts` bodies, `types.ts` (lifecycle), `storage/**`, `domain/**`, `remote/**`, `tools/**`, `client/**`, `legacy/**`, `action-router/**`, `projection/**`, `references/**`, `docs/**` are all untouched. Owned paths per the task packet (`packages/contracts/**`, `packages/domain/member/**`, `packages/domain/policy/**`, `packages/runtime/root-binding/**`, `packages/runtime/admission/resolve*`, `packages/runtime/action-router/*caller*`, `packages/runtime/lifecycle/**` guard only, projection contract definitions, owned tests) are all respected — the domain and action-router owned paths were simply not needed.

**No private/upstream workaround:** zero files under `references/` in the diff; zero deepseek-harness imports in added lines (the only `deepseek-harness` string in added lines is the no-core assertion text in the evidence file); no patch tooling; `REMOTE_CONTRACT_VERSION = 1` untouched.

## 5. Verification commands run (sanctioned chain only)

Workdir: `D:/AgentDev/dsh-plugins/dsh-agent-team/.worktrees/P8S2-R` (worktree clean at start; `node_modules` present — no install needed; only sanctioned commands executed; no `pnpm run/exec`, no vitest CLI, no tsx/esbuild/vite).

| Command | Result |
| --- | --- |
| `git rev-parse HEAD` | `126b074953392aa790334840457ad5d8bba7a216` (matches task packet) |
| `git status --porcelain` (before review writes) | clean |
| `git diff --stat 3fa4c1f…..HEAD` | 22 files, +1834/−68 (matches task packet) |
| `node scripts/run-tests.mjs` (full chain) | **1798 passed, 0 failed, 1798 total — exit 0** (`RESULT: PASS run-tests (0 failures)`) |
| `node scripts/run-tests.mjs contracts` | 150 passed, 0 failed — exit 0 (incl. `leader-instance-record.test.ts` 13, `negative.test.ts` 21, all `p8t1-projection-*`) |
| `node scripts/run-tests.mjs runtime` | 725 passed, 0 failed — exit 0 (incl. `p8s2-leader-contract.test.ts` 12, all `p5t5-*`, all `p6t1-*`/`p6t2-*`, all `p7t3-*`) |
| `node node_modules/typescript/bin/tsc -p packages/contracts/tsconfig.json` | exit 0 |
| `node node_modules/typescript/bin/tsc -p packages/domain/tsconfig.json` | exit 0 |
| `node node_modules/typescript/bin/tsc -p packages/storage/tsconfig.json` | exit 0 |
| `node node_modules/typescript/bin/tsc -p packages/runtime/tsconfig.json` | exit 0 |
| `node node_modules/typescript/bin/tsc -p packages/testkit/tsconfig.json` | exit 0 |
| `node node_modules/typescript/bin/tsc -p packages/remote/tsconfig.json` | exit 0 |

Key suite lines from the full-chain log (all PASS): `leader-instance-record.test.ts (13)`, `p8s2-leader-contract.test.ts (12)`, `p4t5-corrupt-version.test.ts (10)`, `p4t6-session-event-scan.test.ts (10)`, `p5t5-admission (5)`, `p5t5-cold-root (7)`, `p5t5-fresh-root (9)`, `p6t2-actions (30)`, `p7t3-archive-running (7)`, `p7t3-descendant-drain (5)`, `p7t3-dispose-race (6)`, `p7t3-restore-no-agent (6)`, `t3-member-n-instances (14)`, `t6-9-negative-matrix (12)`.

**Delta check:** baseline 1773 (recorded at BASE_SHA in the G8-S1 evidence) + 25 new (13 contracts S1–S13 + 12 runtime A/B/C) = 1798. Zero regressions across all 1773 pre-existing tests.

## 6. Concerns (informational — none block)

1. **Documented type-lie at the v1-typed surface** (acknowledged by the worker, S2-result §5.1): the unowned `storage/repositories/member-instances.ts` and `domain/lifecycle/transitions.ts` assign/strict-access `MemberInstanceRecordDto` (strict `record.lifecycle`), so the factory/parse/deserialize *return* types stay v1-typed with a v2 object flowing underneath. The lie is confined, commented at every cast site, and the absent v2 keys stay absent at runtime (never defaulted). Runtime consequence: any consumer that strictly reads `.lifecycle` on a v2 leader row sees `undefined` — which is exactly what B1 pins (`hasLifecycleValue === false`) and what the frozen P8-T1 projection already requires for `inst-leader`. A future task that owns `admission/types.ts` (worker's known limitation #4) could make the summary shape explicit; out of scope here.
2. **Legacy harness seed persists in unowned frozen tooling** (`tools/harness/plugin.mjs`): its v1 hack rows remain parseable (freeze rule) and are shape-agnostically rejected by the guard (test C3); they no longer represent the Leader in any owned path. Redundancy removal is explicitly deferred to P8-S5 (CR-1 secondary note) — consistent, not a gap in this task.
3. **`p4t6` filesScanned is a whole-tree inventory pin** (now 486): any future task adding/removing scannable files must bump it with a comment — established discipline of this audit, unchanged by this task.
4. **Leader `callerMember` carries the row as stored** (v1 legacy or v2): only `templateId` is consumed downstream; `lifecycle`/`childSessionId` are never consulted for the leader (C3). Fine under the frozen model, but worth knowing for future caller-envelope work.

## 7. Reviewer no-write assertion

- No code, test, or config was modified by this review. The only file operation performed by the reviewer is the creation of this file (`S2-review.md`).
- `git status` of the review worktree after this write shows only the untracked `dev/agent-workflow/evidence/P8-S/S2-review.md` (verified after writing; see below).
- No servers started; no push; no install (node_modules pre-existed and was complete — tsc and the full chain ran from it).

git status (post-write, review worktree):

```
?? dev/agent-workflow/evidence/P8-S/S2-review.md
```
