# Contracts v1 Freeze Confirmation — P3-T6

Task P3-T6 (domain integration / property review) confirms that the frozen
contracts v1 surface is intact and is the basis of all t6 evidence.

## Freeze status (as recorded by the owner)

`packages/contracts/CHANGELOG.md` (read-only during P3-T6):

- Line 6: `## [v1] — frozen 2026-08-29 (task P3-T1)`
- Line 8: `**Status: FROZEN.**`
- Freeze rule (CHANGELOG §"Freeze rule", lines 94–106): *"As of v1, **no
  other task may modify contracts v1 semantics** (add/remove fields or
  codes, change id rules, change canonical encodings, reinterpret an
  invariant). A change requires: 1. a new version (v2) with a new
  `schemaVersion` stamp and a new section here; 2. explicit authority (a
  change to the frozen Architecture/Development Plan documents, or a user
  ruling recorded in the workflow log); 3. main-agent approval before any
  consumer task depends on it."*
- General rule (lines 3–4): *"After a version is frozen, its semantics are
  immutable; changes go through a **new** version."*

**P3-T6 made zero modifications under `packages/contracts/**`** (git status
in the worktree confirms the path is untouched); every t6 test imports the
frozen surface and no contract gap was found — all expectation mismatches
during development were test-side errors against documented frozen behavior
(see `docs/contracts/g3-report.md`, "Contract gaps").

## Spot-checks (frozen fact → t6 evidence)

| # | Frozen fact (CHANGELOG v1 / Architecture) | t6 evidence |
| --- | --- | --- |
| 1 | `TeamSessionId = RootSessionId` — a type alias, invariant 9; `teamSessionIdOf(rootSessionId)` returns the same value | `t6-2` it "runtime identity = (TeamSessionId, instanceId) with TeamSessionId = RootSessionId (invariants 9/18)"; `t6-10` it "builds deterministically and binds the immutable snapshot (invariants 9/10)" |
| 2 | `MemberIdentity = { rootSessionId, instanceId }` exactly (invariant 18); canonical identity key = canonical JSON (sorted keys) of the pair → **instanceId-first**; `label`/`templateId`/`groupId` are NOT identities (invariants 19/20) | `t6-8` it "MemberIdentity: the canonical key round-trips strictly (non-canonical encodings rejected)" — the instanceId-first literal parses back; a rootSessionId-first reordering and a field-missing encoding both fail with `MALFORMED_DTO`; `t6-2` it "the member identity key round-trips: key → parse → same identity (N=5)" and it "all N instances share templateId and label, yet identities are pairwise distinct (invariant 19)" |
| 3 | Closed error vocabulary: exactly **20 codes** (`TeamContractErrorCode` + `TEAM_CONTRACT_ERROR_CODE_VALUES`); consumers branch on `code`, never on message text | `t6-9` it "the closed contracts vocabulary is exactly 20 codes" (Set size over `TEAM_CONTRACT_ERROR_CODE_VALUES`) + the table property that every code raised by all 88 negative cases is a member of that closed set |
| 4 | Legacy `MemberId` quarantine (detection-only): any DTO carrying `memberId` fails with `LEGACY_MEMBER_ID_REJECTED` on every surface | `t6-9` cases "MemberInstanceRecord legacy memberId", "TeamSessionRecord legacy memberId", "SessionBinding legacy memberId" (3/3 typed `LEGACY_MEMBER_ID_REJECTED`) |
| 5 | vNext defines **NO** Team SessionEvents (invariant 42); the five legacy event names (`team/member-bound`, `team/progress`, `team/control-request`, `team/control-decision`, `team/message`) exist solely to recognize and reject legacy values | `t6-9` loop over `LEGACY_TEAM_SESSION_EVENT_NAMES` — all 5 names raise `LEGACY_TEAM_SESSION_EVENT_REJECTED` via `assertNotLegacyTeamSessionEvent` (detection-only, no vNext event surface exists to emit them) |
| 6 | One TeamSession per root (invariant 8) and **exactly one immutable Blueprint snapshot per TeamSession** (invariant 10); snapshot ref keyed `blueprintId@revision` | `t6-6` it "the snapshot ref is frozen, keyed blueprintId@revision, and round-trips through the contracts key parser" + it "the composition binds a deep-frozen snapshot ref into the TeamSession record"; `t6-2` it "an identity cannot be asserted into a different TeamSession (IDENTITY_SCOPE_MISMATCH)" and `t6-9` case "second TeamSession on the same root" → `DUPLICATE_TEAM_SESSION` |
| 7 | Schema version: `TEAM_CONTRACT_SCHEMA_VERSION = 1`, `SUPPORTED_SCHEMA_VERSIONS = [1]`; `SCHEMA_VERSION_MISMATCH` (well-formed but different) vs `SCHEMA_VERSION_UNSUPPORTED` (structurally corrupt) | `t6-9` cases: TeamSessionRecord schemaVersion 2 → `SCHEMA_VERSION_MISMATCH`; TeamSessionRecord schemaVersion 0 → `SCHEMA_VERSION_UNSUPPORTED`; MemberInstanceRecord schemaVersion 9 → `SCHEMA_VERSION_MISMATCH` |
| 8 | Lifecycle exactly `CREATED | RUNNING | SETTLED | ARCHIVED | DISPOSED`; `PROVISIONING_FAILED` is a failure condition, NOT a state | `t6-3` (matrix over the 5-state set; `MEMBER_LIFECYCLE_STATES` from contracts); `t6-9` — all 16 illegal pairs typed-rejected |
| 9 | Remote-safe (lossless-JSON) discipline: `REMOTE_VALUE_NOT_JSON` with path-carrying details; `canonicalJsonStringify` sorted keys | `t6-9` cases: `deepFreeze(BigInt)`, `assertRemoteSafeJsonValue({a: Date})`, `canonicalJsonStringify({a: BigInt})` → `REMOTE_VALUE_NOT_JSON`; `t6-8`/`t6-10` canonical-JSON round-trip stability |

## Conclusion

Contracts v1 (frozen 2026-08-29 by P3-T1) is **confirmed frozen and
consistent** at the P3-T6 stage: the t6 suite encodes its semantics without
deviation, every frozen spot-check above has independent test evidence, and
no contract change (add/remove fields or codes, changed id rules, changed
canonical encodings, reinterpreted invariant) was required or made. No
CONTRACT_CHANGE_REQUEST is raised from P3-T6.
