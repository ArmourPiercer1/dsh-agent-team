/**
 * The projection contract family (P8-T1, projection contract v1).
 *
 * The single module for the frozen TeamProjectionDto and its embedded
 * records (Development Plan §21): the whole read-only view of one
 * TeamSession that the P8-T2 read service produces from TeamDomain (+ an
 * optional live overlay) and the client renders.
 *
 * This barrel re-exports the family surface plus the two P3-T1 values the
 * family embeds (the MemberInstance lifecycle vocabulary and the blueprint
 * snapshot ref type) so a projection consumer reads one module.
 *
 * @module @dsh-agent-team/contracts/projection
 */

// --- projection schema version (own track; v1 frozen by P8-T1, v2 additive by S7-R2) ----
export {
  PROJECTION_SCHEMA_VERSION,
  PROJECTION_SCHEMA_VERSION_V2,
  SUPPORTED_PROJECTION_SCHEMA_VERSIONS,
  isSupportedProjectionSchemaVersion,
  assertProjectionSchemaVersion,
} from './schema.js'
export type { ProjectionSchemaVersion, ProjectionSchemaVersionV2 } from './schema.js'

// --- closed state vocabularies -------------------------------------------------------
export {
  ADMISSION_STATES,
  ADMISSION_STATE_VALUES,
  isAdmissionState,
  RESIDENCY_STATES,
  RESIDENCY_STATE_VALUES,
  isResidencyState,
  TEMPLATE_KINDS,
  TEMPLATE_KIND_VALUES,
  isTemplateKind,
  CONTEXT_POLICIES,
  CONTEXT_POLICY_VALUES,
  isContextPolicy,
  PROGRESS_VALUES,
  isProgressValue,
  LEDGER_CATEGORIES,
  LEDGER_CATEGORY_VALUES,
  isLedgerCategory,
} from './states.js'
export type {
  AdmissionState,
  ResidencyState,
  TemplateKind,
  ContextPolicy,
  ProgressValue,
  LedgerCategory,
} from './states.js'

// --- effective configuration (UI §18.2) ------------------------------------------------
export {
  EFFECTIVE_CONFIG_VALUE_MAX_LENGTH,
  EFFECTIVE_CONFIG_SOURCES,
  EFFECTIVE_CONFIG_SOURCE_VALUES,
  isEffectiveConfigSource,
  EFFECTIVE_CONFIG_STATES,
  EFFECTIVE_CONFIG_STATE_VALUES,
  isEffectiveConfigState,
  EFFECTIVE_CONFIG_ENTRY_FIELDS,
  parseEffectiveConfigEntry,
  EFFECTIVE_CONFIG_FIELDS,
  parseEffectiveConfigDto,
  EFFECTIVE_CONFIG_ENTRY_FIELDS_V2,
  EFFECTIVE_CONFIG_DENIED_BY_MAX_LENGTH,
} from './effective-config.js'
export type {
  EffectiveConfigSource,
  EffectiveConfigState,
  EffectiveConfigEntry,
  EffectiveConfigDto,
  EffectiveConfigEntryV2,
  EffectiveConfigDtoV2,
} from './effective-config.js'

// --- compatibility / admission summary (UI §18.1) -------------------------------------
export {
  COMPATIBILITY_FINGERPRINT_MAX_LENGTH,
  COMPATIBILITY_SUMMARY_FIELDS,
  parseCompatibilitySummary,
} from './compatibility.js'
export type { CompatibilitySummaryDto } from './compatibility.js'

// --- activity: durable summary + nullable live overlay (UI §24/§25) -------------------
export {
  ACTIVITY_CORRELATION_MAX_LENGTH,
  ACTIVITY_TEXT_MAX_LENGTH,
  ACTIVITY_SUMMARY_MAX_LENGTH,
  ACTIVITY_INTERVAL_FIELDS,
  parseActivityInterval,
  MEMBER_ACTIVITY_SUMMARY_FIELDS,
  parseMemberActivitySummary,
  MEMBER_LIVE_ACTIVITY_FIELDS,
  parseMemberLiveActivity,
} from './activity.js'
export type {
  ActivityIntervalSummary,
  MemberActivitySummaryDto,
  MemberLiveActivityDto,
} from './activity.js'

// --- template rows (Architecture §6.1) ---------------------------------------------------
export {
  TEMPLATE_DESCRIPTION_MAX_LENGTH,
  TEMPLATE_PROJECTION_FIELDS,
  parseTemplateProjection,
  createTemplateProjection,
} from './template.js'
export type { TemplateProjectionDto, TemplateProjectionInput } from './template.js'

// --- team root view (no lifecycle, Architecture §8.6) -----------------------------------
export {
  TEAM_ROOT_PROJECTION_FIELDS,
  parseTeamRootProjection,
  createTeamRootProjection,
} from './root.js'
export type { TeamRootProjectionDto, TeamRootProjectionInput } from './root.js'

// --- member rows (unified leader/member, invariant 14) -----------------------------------
export {
  MEMBER_PROJECTION_FIELDS,
  MEMBER_PROJECTION_FIELDS_V2,
  parseMemberProjection,
  createMemberProjection,
} from './member.js'
export type { MemberProjectionDto, MemberProjectionInput } from './member.js'

// --- member model state view (BQ-11, projection v2, S7-R2 R2-3) --------------------------
export {
  MODEL_STATE_FIELDS,
  MODEL_STATE_OPTIONAL_FIELDS,
  MODEL_STATE_ENTRY_FIELDS,
  MODEL_STATE_ENTRY_OPTIONAL_FIELDS,
  MODEL_STATE_PROVENANCE_FIELDS,
  MODEL_STATE_VALUE_MAX_LENGTH,
  MODEL_STATE_DENIED_BY_MAX_LENGTH,
  MODEL_STATE_EXPLANATION_MAX_LENGTH,
  MODEL_STATE_LAYER_VALUES,
  MODEL_STATE_ORIGIN_VALUES,
  MODEL_STATE_AVAILABILITY_VALUES,
  parseModelStateEntry,
  parseModelStateProvenance,
  parseMemberModelState,
} from './model-state.js'
export type {
  ModelStateEntryDto,
  ModelStateProvenanceDto,
  MemberModelStateDto,
  ModelStateAvailability,
} from './model-state.js'

// --- the DISPOSED retained-history bundle (S7-R2 R2-6, D14) -----------------------
export {
  DISPOSED_MEMBER_HISTORY_FIELDS,
  DISPOSED_MEMBER_HISTORY_OPTIONAL_FIELDS,
  parseDisposedMemberHistory,
  createDisposedMemberHistory,
} from './disposed-history.js'
export type { DisposedMemberHistoryDto, DisposedMemberHistoryInput } from './disposed-history.js'

// --- ledger summary (UI §27) ---------------------------------------------------------------
export {
  LEDGER_SUMMARY_FIELDS,
  parseLedgerSummary,
  createLedgerSummary,
} from './ledger.js'
export type { LedgerSummaryDto, LedgerCategoryCounts, LedgerSummaryInput } from './ledger.js'

// --- the whole projection + stale-overwrite guard (DevPlan §21) ----------------------------
export {
  TEAM_PROJECTION_FIELDS,
  TEAM_PROJECTION_FIELDS_V2,
  parseTeamProjection,
  createTeamProjection,
  serializeTeamProjection,
  deserializeTeamProjection,
  isStaleTeamProjection,
} from './projection.js'
export type { TeamProjectionDto, TeamProjectionInput } from './projection.js'

// --- P3-T1 values the family embeds ----------------------------------------------------------
export {
  MEMBER_LIFECYCLE_STATES,
  MEMBER_LIFECYCLE_STATE_VALUES,
  isMemberLifecycleState,
} from '../dto/member-instance-record.js'
export type { MemberLifecycleState } from '../dto/member-instance-record.js'
export type { BlueprintSnapshotRef } from '../dto/blueprint-snapshot.js'
