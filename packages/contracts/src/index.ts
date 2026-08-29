/**
 * @dsh-agent-team/contracts — frozen shared contracts v1 for DSH Agent Team vNext.
 *
 * The single source for the stable, serializable contract vocabulary every
 * other vNext package consumes (Development Plan §9.1): IDs, DTOs, error
 * codes, schema version, remote-safe values. This package contains NO
 * business state mutation, NO Cordis service, NO storage, NO React, and NO
 * live Agent dependency (TaskDoc §11.4 P3-T1).
 *
 * FROZEN as of contract v1 (P3-T1). After this freeze no other task may
 * modify contracts v1 semantics; changes go through a new version per the
 * rule in CHANGELOG.md.
 *
 * Authority: `docs/plans/active/DSH_Agent_Team_vNext_Detailed_Architecture_20260829.md`
 * (Architecture Frozen), in particular:
 *
 * - object model TeamBlueprint -> TeamSession + TeamDomain -> MemberInstance;
 * - invariant 8: one Root Session -> 0 or 1 TeamSession;
 * - invariant 9: **TeamSessionId = RootSessionId**;
 * - invariant 10: one TeamSession binds exactly one immutable Blueprint snapshot;
 * - invariant 13: a blueprint carries exactly one complete LeaderTemplate;
 * - invariant 14: LeaderInstance is the only special MemberInstance (no childSessionId);
 * - invariant 17: one MemberTemplate produces 0..N MemberInstances;
 * - invariant 18: **member runtime identity = (rootSessionId, instanceId)**;
 * - invariant 19: label / templateId / groupId are NOT runtime identities;
 * - invariant 20: groupId has no state/permission/lifecycle/activation semantics;
 * - invariant 23: every MemberInstance binds exactly one durable child Session;
 * - invariant 29: contextPolicy freezes at creation (carried by later versions);
 * - invariant 41: Team control-plane durable authority = TeamDomain;
 * - invariant 42: **no Team-specific DSH SessionEvent vocabulary**;
 * - invariant 65: existing legacy Team Sessions are READ-ONLY, never auto-migrated;
 * - §29: MemberInstance lifecycle = CREATED | RUNNING | SETTLED | ARCHIVED | DISPOSED.
 *
 * Skeleton status note: the P1-T1 skeleton marker (`PACKAGE_ID`) is retained
 * for compatibility with the skeleton tests; all contract content below is
 * the P3-T1 v1 freeze.
 * @module @dsh-agent-team/contracts
 */

/**
 * Stable identity marker of the contracts package (retained from the P1-T1
 * skeleton; asserted by the package unit test).
 */
export const PACKAGE_ID = 'contracts'

// --- schema version -------------------------------------------------------
export {
  TEAM_CONTRACT_SCHEMA_VERSION,
  SUPPORTED_SCHEMA_VERSIONS,
  isSupportedSchemaVersion,
  assertSupportedSchemaVersion,
  assertSchemaVersion,
} from './schema-version.js'
export type { TeamContractSchemaVersion } from './schema-version.js'

// --- errors ----------------------------------------------------------------
export {
  TeamContractErrorCode,
  TEAM_CONTRACT_ERROR_CODE_VALUES,
  TeamContractError,
  teamContractError,
  isTeamContractError,
} from './errors.js'

// --- remote-safe (lossless-JSON) values -------------------------------------
export {
  isRemoteSafeJsonValue,
  assertRemoteSafeJsonValue,
  toRemoteSafeDetail,
  canonicalJsonStringify,
  deepFreeze,
} from './remote-safe.js'
export type { RemoteSafeJsonValue, RemoteSafeRecord } from './remote-safe.js'

// --- identities -------------------------------------------------------------
export {
  SESSION_ID_MAX_LENGTH,
  parseSessionId,
  parseRootSessionId,
  parseTeamSessionId,
  parseChildSessionId,
  isSessionId,
  isRootSessionId,
  isChildSessionId,
  teamSessionIdOf,
} from './ids/session-id.js'
export type {
  SessionId,
  RootSessionId,
  TeamSessionId,
  ChildSessionId,
} from './ids/session-id.js'

export {
  INSTANCE_ID_PATTERN,
  INSTANCE_ID_MAX_LENGTH,
  parseInstanceId,
  isInstanceId,
} from './ids/instance-id.js'
export type { InstanceId } from './ids/instance-id.js'

export {
  TEMPLATE_ID_PATTERN,
  TEMPLATE_ID_MAX_LENGTH,
  parseTemplateId,
  isTemplateId,
} from './ids/template-id.js'
export type { TemplateId } from './ids/template-id.js'

export {
  BLUEPRINT_ID_MAX_LENGTH,
  BLUEPRINT_REVISION_MAX_LENGTH,
  BLUEPRINT_CONTENT_HASH_MAX_LENGTH,
  parseBlueprintId,
  parseBlueprintRevision,
  parseBlueprintContentHash,
  isBlueprintId,
} from './ids/blueprint-id.js'
export type {
  BlueprintId,
  BlueprintRevision,
  BlueprintContentHash,
} from './ids/blueprint-id.js'

// --- member identity (composite key) ----------------------------------------
export {
  LEADER_INSTANCE_ID,
  createMemberIdentity,
  leaderMemberIdentityOf,
  memberIdentityKey,
  parseMemberIdentityKey,
  memberIdentitiesEqual,
  assertMemberIdentityInTeam,
} from './identity.js'
export type { MemberIdentity } from './identity.js'

// --- DTOs --------------------------------------------------------------------
export {
  TEAM_SESSION_RECORD_FIELDS,
  parseTeamSessionRecord,
  createTeamSessionRecord,
  serializeTeamSessionRecord,
  deserializeTeamSessionRecord,
} from './dto/team-session-record.js'
export type { TeamSessionRecordDto, TeamSessionRecordInput } from './dto/team-session-record.js'

export {
  MEMBER_LIFECYCLE_STATES,
  MEMBER_LIFECYCLE_STATE_VALUES,
  isMemberLifecycleState,
  MEMBER_INSTANCE_RECORD_FIELDS,
  parseMemberInstanceRecord,
  createMemberInstanceRecord,
  memberIdentityOf,
  serializeMemberInstanceRecord,
  deserializeMemberInstanceRecord,
} from './dto/member-instance-record.js'
export type {
  MemberInstanceRecordDto,
  MemberInstanceRecordInput,
  MemberLifecycleState,
} from './dto/member-instance-record.js'

export {
  SESSION_BINDING_KINDS,
  parseSessionBinding,
  serializeSessionBinding,
  deserializeSessionBinding,
} from './dto/session-binding.js'
export type {
  SessionBindingDto,
  SessionBindingOrdinary,
  SessionBindingTeamRoot,
  SessionBindingTeamMember,
  SessionBindingKind,
} from './dto/session-binding.js'

export {
  BLUEPRINT_SNAPSHOT_FIELDS,
  parseBlueprintSnapshotRef,
  createBlueprintSnapshotRef,
  blueprintSnapshotKey,
  parseBlueprintSnapshotKey,
} from './dto/blueprint-snapshot.js'
export type { BlueprintSnapshotRef } from './dto/blueprint-snapshot.js'

// --- legacy vocabulary quarantine ---------------------------------------------
export {
  LEGACY_FORBIDDEN_FIELDS,
  LEGACY_TEAM_SESSION_EVENT_NAMES,
  isLegacyTeamSessionEventName,
  assertNotLegacyTeamSessionEvent,
  assertNoLegacyFields,
} from './legacy-vocabulary.js'

// --- uniqueness / scoping assertions -------------------------------------------
export {
  assertTeamSessionUnique,
  assertInstanceIdUniqueWithinTeam,
  assertChildSessionBindingUnique,
} from './uniqueness.js'
