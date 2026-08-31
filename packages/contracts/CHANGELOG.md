# Changelog — @dsh-agent-team/contracts

All contract changes are recorded here. After a version is frozen, its
semantics are immutable; changes go through a **new** version.

## [v1] — frozen 2026-08-29 (task P3-T1)

**Status: FROZEN.** TaskDoc §11.4 P3-T1: "freeze core contracts/IDs/errors —
establish TeamSessionId/InstanceId/TemplateId, DTO foundation, errors, schema
version; form shared contract v1 in `packages/contracts/**`."

Authority: `docs/plans/active/DSH_Agent_Team_vNext_Detailed_Architecture_20260829.md`
(frozen Architecture doc, in particular §5.1–§5.2, §8.2, §9.2, §10.2, §14.2–§14.3,
§24.1, §29, and the §42 invariant list); Development Plan §9.1 (what lives in
contracts: IDs, DTOs, error codes, schema version, remote-safe values — and
what is forbidden: business mutation, Cordis service, storage, React).

### Frozen in v1

**Schema version**
- `TEAM_CONTRACT_SCHEMA_VERSION = 1`; `SUPPORTED_SCHEMA_VERSIONS = [1]`.
- Codes `SCHEMA_VERSION_MISMATCH` (well-formed but different) vs
  `SCHEMA_VERSION_UNSUPPORTED` (structurally corrupt).

**IDs (branded strings, lossless-JSON safe)**
- `SessionId` / `RootSessionId` / `ChildSessionId` — opaque upstream DSH
  session ids (minted as `session-<n>`); structural rules: non-empty,
  ≤ 255 chars, no control characters, no whitespace.
- **`TeamSessionId = RootSessionId`** — a type alias, encoding invariant 9
  (TeamSessionId IS the RootSessionId; no second team id exists) at the type
  level. `teamSessionIdOf(rootSessionId)` returns the same value.
- `InstanceId` — `inst-<1..32 lowercase alphanumerics>` (≤ 37 chars); unique
  within one TeamSession only.
- `TemplateId` — lowercase slug `[a-z][a-z0-9-]{0,63}`; the *static* identity
  of a Leader/MemberTemplate (invariant 17: 0..N instances per template).
- `BlueprintId` (≤ 128, no `@`), `BlueprintRevision` (≤ 64, no `@`),
  `BlueprintContentHash` (≤ 256). The snapshot display form is
  `blueprintId@revision` (e.g. `AIUED-ALGO@17`); `@` is reserved in ids.

**Member runtime identity (invariant 18)**
- `MemberIdentity = { rootSessionId: RootSessionId; instanceId: InstanceId }`
  — exactly these two components; `label` / `templateId` / `groupId` are NOT
  runtime identities (invariant 19); `groupId` carries no
  state/permission/lifecycle/activation semantics (invariant 20).
- Canonical identity key = canonical JSON (sorted keys) of the pair;
  `parseMemberIdentityKey` enforces the exact field set and the canonical
  encoding.
- `LEADER_INSTANCE_ID = 'inst-leader'` — the reserved instance id of the
  single LeaderInstance (invariants 13/14).
- Cross-scope use of a member identity in another TeamSession fails with
  `IDENTITY_SCOPE_MISMATCH`.

**DTOs (versioned, frozen, canonical-JSON serializable)**
- `TeamSessionRecordDto` — `schemaVersion, rootSessionId, blueprint
  (BlueprintSnapshotRef), defaultWorkspace?, createdAt, generation`
  (invariant 8: 0..1 TeamSession per root; invariant 10: exactly one immutable
  Blueprint snapshot per TeamSession).
- `MemberInstanceRecordDto` — `schemaVersion, rootSessionId, instanceId,
  templateId, label, groupId?, childSessionId, workspace?, lifecycle,
  createdAt, activityVersion` (invariant 23: every MemberInstance binds
  exactly one durable child Session).
- `SessionBindingDto` — discriminated union `ordinary | team-root |
  team-member` (Architecture §14.3 C): any relevant DSH Session resolves to
  one binding; a `team-member` binding carries
  `childSessionId -> rootSessionId -> instanceId`, i.e. it recovers the exact
  composite member identity — never a label, never a legacy `memberId`.
- Absent optional fields stay **absent** (no own `undefined` keys): every
  DTO is a lossless-JSON value.
- Lifecycle: exactly `CREATED | RUNNING | SETTLED | ARCHIVED | DISPOSED`
  (Architecture §29). `PROVISIONING_FAILED` is a failure condition, NOT a
  lifecycle state.

**Error vocabulary (closed, 20 codes)**
- `TeamContractError extends Error` with a frozen `code` and optional
  lossless-JSON `details`; consumers branch on `code`, never on message text.
- `TeamContractErrorCode` (const object) + union type +
  `TEAM_CONTRACT_ERROR_CODE_VALUES`. Adding or renaming a code is a contract
  change (see freeze rule below).

**Remote-safe (lossless-JSON) discipline**
- `RemoteSafeJsonValue` / `RemoteSafeRecord`; `isRemoteSafeJsonValue`,
  `assertRemoteSafeJsonValue` (path-carrying `REMOTE_VALUE_NOT_JSON`),
  `toRemoteSafeDetail` (never-throwing coercion for error details),
  `canonicalJsonStringify` (sorted keys, deterministic bytes), `deepFreeze`.

**Legacy vocabulary quarantine (detection-only)**
- `LEGACY_FORBIDDEN_FIELDS = ['memberId']` — any DTO carrying a `memberId`
  field fails with `LEGACY_MEMBER_ID_REJECTED` (the legacy doubled
  definition+runtime identity authority is rejected on every surface).
- `LEGACY_TEAM_SESSION_EVENT_NAMES` (the five legacy fork event names) exist
  solely to recognize and reject legacy values (`LEGACY_TEAM_SESSION_EVENT_REJECTED`).
  vNext defines NO Team SessionEvents (invariant 42).

## [v2] — LeaderInstance record (task P8-S2, 2026-09)

**Status: ACTIVE.** This is a NEW version added under the freeze rule —
v1 is untouched: every v1 record (including legacy harness-style leader
rows that carry `childSessionId` + `lifecycle`) stays parseable, and no v1
field, code, id rule, or encoding changed.

Authority: frozen Architecture §9.1/§9.2 (the LeaderInstance is the Root
Agent + the Root Session: exactly one, no child Session, no ordinary
member lifecycle, cannot be independently archived/disposed) and invariants
13/14/15/18/23; P8-S plan §15.2 (P8-S2 Leader + Core Contract Repair);
P8-S2 task packet with main-agent approval (dev/agent-workflow evidence).

### Added in v2

**Schema version**
- `LEADER_INSTANCE_RECORD_SCHEMA_VERSION = 2` (+ type
  `LeaderInstanceRecordSchemaVersion`).
- `SUPPORTED_SCHEMA_VERSIONS` grew from `[1]` to `[1, 2]` (the supported
  set only ever grows through an explicit contract change). The global
  `TEAM_CONTRACT_SCHEMA_VERSION` stays `1` (the current v1 member shape).

**DTO**
- `LeaderInstanceRecordDto` — `schemaVersion: 2, rootSessionId,
  instanceId, templateId, label, groupId?, workspace?, createdAt,
  activityVersion`. `childSessionId` and `lifecycle` are ABSENT keys:
  validation rejects their presence (reasons
  `LEADER_INSTANCE_MUST_NOT_CARRY_CHILD_SESSION` /
  `LEADER_INSTANCE_MUST_NOT_CARRY_LIFECYCLE` in `details.reason`), they are
  never defaulted, and they are absent from the canonical serialization —
  the same key rule the frozen P8-T1 member projection enforces for
  `inst-leader`.
- `LeaderInstanceRecordInput` — the creation input (no `schemaVersion`;
  stamped `2` by the factory). Any `schemaVersion`/`childSessionId`/
  `lifecycle` key on the input fails closed (`MALFORMED_DTO`).
- `LEADER_INSTANCE_RECORD_FIELDS` / `LEADER_INSTANCE_RECORD_INPUT_FIELDS` —
  the exact frozen v2 field sets (the v1 set minus `childSessionId` and
  `lifecycle`).
- `createLeaderInstanceRecord` — the v2 creation factory (rejects a
  non-leader `instanceId` with `MALFORMED_DTO`).

**Factories**
- `createMemberInstanceRecord` now accepts the union
  `MemberInstanceRecordInput | LeaderInstanceRecordInput`. The shape
  branch mints the honest v2 leader record only for the structurally
  leader input (reserved `inst-leader` id AND no `childSessionId` AND no
  `lifecycle`); every other input takes the v1 path byte-identical. A
  half-hack input (the leader id with exactly one of the two fields) falls
  to the v1 path and is rejected fail-closed.
- `parseMemberInstanceRecord` branches on `schemaVersion === 2` to the v2
  validator. Both branches keep the v1 `MemberInstanceRecordDto` declared
  return type (the unowned storage/domain consumers assign to it); a v2
  result is a `LeaderInstanceRecordDto` whose shared identity core makes
  those assignments safe (documented type lie, confined to the return
  types of `createMemberInstanceRecord` / `parseMemberInstanceRecord` /
  `deserializeMemberInstanceRecord`).

### Freeze rule

As of v1, **no other task may modify contracts v1 semantics** (add/remove
fields or codes, change id rules, change canonical encodings, reinterpret an
invariant). A change requires:

1. a new version (v2) with a new `schemaVersion` stamp and a new section here;
2. explicit authority (a change to the frozen Architecture/Development Plan
   documents, or a user ruling recorded in the workflow log);
3. main-agent approval before any consumer task depends on it.

Consumers write code against the frozen v1 surface and treat it as stable for
the lifetime of the vNext line.
