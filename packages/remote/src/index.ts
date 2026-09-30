/**
 * @dsh-agent-team/remote — Remote contract v1 and host-side handlers.
 *
 * Responsibility (TaskDoc §11 package boundary, P8-T3): the typed Remote
 * contract for the Team remote seam — the closed method catalog, the
 * lossless-JSON wire envelope (request/response with provenance), the
 * frozen-ID and boundary-code error vocabulary, the per-method closed
 * param schemas, and the host-side handler layer that routes a parsed
 * request to the category handlers backed by structural service ports.
 *
 * The remote never writes team state: handlers are read/projection and
 * typed-effect surfaces over TeamDomain; the dispatcher guarantees the
 * closed invariants (unknown method before envelope, per-method param
 * parse, typed error results only, promise never rejects).
 *
 * Wiring note (host): registration goes through
 * `registerRemoteHandlers` + `ctx.effect` in the host composition —
 * this package itself has no seam dependency.
 *
 * Pure module: no I/O, no node: builtins, no runtime environment
 * assumptions (design note, deviation D-1: self-contained, no
 * cross-package .ts imports).
 * @module @dsh-agent-team/remote
 */

/**
 * Stable identity marker of the remote package (skeleton contract, P1-T4:
 * asserted by the package unit test; retained through P8-T3 additively).
 */
export const PACKAGE_ID = 'remote'

export {
  isRemoteSafeJsonValue,
  assertRemoteSafeJsonValue,
  toRemoteSafeDetail,
} from './contracts/remote-safe.js'

export type {
  RemoteSafeJsonValue,
  RemoteSafeRecord,
} from './contracts/remote-safe.js'

export {
  REMOTE_CONTRACT_ERROR_CODES,
  REMOTE_CONTRACT_ERROR_CODE_VALUES,
  RemoteContractError,
  isRemoteContractError,
  remoteContractError,
} from './contracts/errors.js'

export type {
  RemoteContractErrorCode,
} from './contracts/errors.js'

export {
  REMOTE_ID_MAX_LENGTH,
  REMOTE_ID_ERROR_CODES,
  parseRemoteTeamSessionId,
  parseRemoteRootSessionId,
  parseRemoteSessionId,
  parseRemoteInstanceId,
  parseRemoteTemplateId,
  parseRemoteBlueprintId,
  parseRemoteBlueprintRevision,
} from './contracts/ids.js'

export {
  REMOTE_CONTRACT_VERSION,
  REMOTE_CONTRACT_VERSION_V2,
  REMOTE_CONTRACT_VERSION_V3,
  REMOTE_CONTRACT_VERSION_V4,
  REMOTE_CONTRACT_VERSION_V5,
  REMOTE_CONTRACT_VERSION_V6,
  REMOTE_CONTRACT_VERSION_V7,
  SUPPORTED_REMOTE_CONTRACT_VERSIONS,
  isSupportedRemoteContractVersion,
  assertSupportedRemoteContractVersion,
  parseRemoteContractVersion,
} from './contracts/version.js'

export type {
  RemoteContractVersion,
} from './contracts/version.js'

export {
  TEAM_CREATE_FLAVORS,
  TEAM_CREATE_FLAVOR_VALUES,
  isTeamCreateFlavor,
  teamCreateFlavorOf,
  PROJECTION_SHAPES,
  PROJECTION_SHAPE_VALUES,
  isProjectionShape,
  projectionShapeOf,
  withLiveProjectionFreshness,
} from './contracts/semantic.js'

export type {
  TeamCreateFlavor,
  ProjectionShape,
} from './contracts/semantic.js'

export {
  REMOTE_CATEGORIES,
  REMOTE_CATEGORY_VALUES,
  REMOTE_METHOD_CATALOG,
  REMOTE_METHOD_NAMES,
  REMOTE_METHODS_BY_CATEGORY,
  REMOTE_V2_ONLY_METHODS,
  REMOTE_V3_ONLY_METHODS,
  REMOTE_V4_ONLY_METHODS,
  REMOTE_V5_ONLY_METHODS,
  REMOTE_V6_ONLY_METHODS,
  isRemoteMethod,
  isRemoteMethodAvailableInVersion,
  remoteCategoryOf,
} from './contracts/catalog.js'

export type {
  RemoteCategory,
  RemoteMethodSpec,
} from './contracts/catalog.js'

export {
  REMOTE_REQUEST_FIELDS,
  parseRemoteRequest,
} from './contracts/request.js'

export type {
  RemoteRequest,
} from './contracts/request.js'

export {
  REMOTE_ORIGIN,
  buildRemoteSuccess,
  buildRemoteError,
} from './contracts/response.js'

export type {
  RemoteProvenance,
  RemoteSuccessResult,
  RemoteErrorCause,
  RemoteErrorDetails,
  RemoteErrorResult,
  RemoteResponse,
  RemoteProvenanceContext,
} from './contracts/response.js'

export {
  REMOTE_CAPABILITY_VALUES,
  REMOTE_PROBE_TRIGGER_VALUES,
  REMOTE_MUTATION_ACTOR_KINDS,
  REMOTE_MUTATION_SCOPES,
  REMOTE_ADMISSION_ACTIONS,
  REMOTE_CATALOG_LIST_FIELDS,
  REMOTE_CATALOG_GET_FIELDS,
  REMOTE_INTENT_PROBE_FIELDS,
  REMOTE_TEAM_CREATE_FIELDS,
  REMOTE_TEAM_CREATE_FIELDS_V2,
  REMOTE_TEAM_ADMIT_INITIAL_WORK_FIELDS,
  REMOTE_TEAM_LIST_ROOTS_FIELDS,
  REMOTE_TEAM_ENSURE_ROOT_LIVE_FIELDS,
  REMOTE_TEAM_RESOLVE_CONTROL_DECISIONS,
  REMOTE_TEAM_RESOLVE_CONTROL_FIELDS,
  REMOTE_TEAM_PREPARE_ORDINARY_OPEN_FIELDS,
  REMOTE_TEAM_GET_READ_STATE_FIELDS,
  REMOTE_TEAM_GET_PROJECTION_FIELDS,
  REMOTE_TEAM_GET_LEDGER_PAGE_FIELDS,
  REMOTE_MEMBER_CREATE_FIELDS,
  REMOTE_MEMBER_SEND_FIELDS,
  REMOTE_MEMBER_FOLLOWUP_FIELDS,
  REMOTE_MEMBER_LIFECYCLE_FIELDS,
  REMOTE_OVERRIDE_GET_FIELDS,
  REMOTE_OVERRIDE_SET_FIELDS,
  REMOTE_OVERRIDE_SET_FIELDS_V7,
  REMOTE_OVERRIDE_RESET_FIELDS,
  REMOTE_OVERRIDE_RESET_FIELDS_V7,
  REMOTE_POLICY_STATE_GET_FIELDS,
  REMOTE_POLICY_STATE_SET_FIELDS,
  REMOTE_COMPATIBILITY_GET_FIELDS,
  REMOTE_COMPATIBILITY_ACK_FIELDS,
  REMOTE_COMPATIBILITY_REPROBE_FIELDS,
  REMOTE_HANDOFF_PREPARE_FIELDS,
  REMOTE_HANDOFF_CREATE_FIELDS,
  REMOTE_LEGACY_INSPECT_FIELDS,
  parseRemoteCatalogListParams,
  parseRemoteCatalogGetParams,
  parseRemoteIntentProbeParams,
  parseRemoteTeamCreateParams,
  parseRemoteTeamCreateParamsV2,
  parseRemoteTeamAdmitInitialWorkParams,
  parseRemoteTeamListRootsParams,
  parseRemoteTeamEnsureRootLiveParams,
  parseRemoteTeamResolveControlParams,
  parseRemoteTeamPrepareOrdinaryOpenParams,
  parseRemoteTeamGetReadStateParams,
  parseRemoteTeamGetProjectionParams,
  parseRemoteTeamGetLedgerPageParams,
  parseRemoteMemberCreateParams,
  parseRemoteMemberSendParams,
  parseRemoteMemberFollowupParams,
  parseRemoteMemberArchiveParams,
  parseRemoteMemberRestoreParams,
  parseRemoteMemberDisposeParams,
  parseRemoteOverrideGetParams,
  parseRemoteOverrideSetParams,
  parseRemoteOverrideSetParamsV7,
  parseRemoteOverrideResetParams,
  parseRemoteOverrideResetParamsV7,
  parseRemotePolicyStateGetParams,
  parseRemotePolicyStateSetParams,
  parseRemoteCompatibilityGetParams,
  parseRemoteCompatibilityAckParams,
  parseRemoteCompatibilityReprobeParams,
  parseRemoteHandoffPrepareParams,
  parseRemoteHandoffCreateParams,
  parseRemoteLegacyInspectParams,
  parseRemoteMethodParams,
} from './contracts/params.js'

export type {
  RemoteCapability,
  RemoteProbeTrigger,
  RemoteMutationActorKind,
  RemoteMutationScope,
  RemoteAdmissionAction,
  RemoteCaller,
  RemoteMutationActor,
  RemotePolicyEntry,
  RemotePolicyStateCellValue,
  RemotePolicyStateViewValue,
  RemoteLosslessRecord,
  RemoteCatalogListParams,
  RemoteCatalogGetParams,
  RemoteIntentProbeParams,
  RemoteTeamCreateParams,
  RemoteTeamCreateParamsV2,
  RemoteTeamAdmitInitialWorkParams,
  RemoteTeamListRootsParams,
  RemoteTeamEnsureRootLiveParams,
  RemoteTeamResolveControlDecision,
  RemoteTeamResolveControlParams,
  RemoteTeamPrepareOrdinaryOpenParams,
  RemoteTeamGetReadStateParams,
  RemoteTeamGetProjectionParams,
  RemoteTeamGetLedgerPageParams,
  RemoteMemberCreateParams,
  RemoteMemberSendParams,
  RemoteMemberFollowupParams,
  RemoteMemberLifecycleParams,
  RemoteOverrideGetParams,
  RemoteOverrideSetParams,
  RemoteOverrideSetParamsV7,
  RemoteOverrideResetParams,
  RemoteOverrideResetParamsV7,
  RemotePolicyStateGetParams,
  RemotePolicyStateSetParams,
  RemoteCompatibilityGetParams,
  RemoteCompatibilityAckParams,
  RemoteCompatibilityReprobeParams,
  RemoteHandoffPrepareParams,
  RemoteHandoffCreateParams,
  RemoteLegacyInspectParams,
  RemoteMethodParams,
  RemoteParsedParams,
} from './contracts/params.js'

export {
  REMOTE_PROJECTION_FIELDS,
  REMOTE_PROJECTION_FIELDS_V6,
  REMOTE_LEDGER_ENTRY_FIELDS,
} from './contracts/types.js'

export type {
  RemoteCatalogListValue,
  RemoteCatalogGetValue,
  RemoteIntentProbeValue,
  RemoteTeamCreatePath,
  RemoteTeamCreateValue,
  RemoteProjectionValue,
  RemoteProjectionValueV6,
  RemoteTeamGetProjectionValue,
  RemoteTeamGetReadStateNoneValue,
  RemoteTeamGetReadStateTeamMemberValue,
  RemoteTeamGetReadStateTeamRootValue,
  RemoteTeamGetReadStateValue,
  RemoteLedgerEntryValue,
  RemoteLedgerPageValue,
  RemoteAdmissionOutcomeValue,
  RemoteMemberOutcomeValue,
  RemoteMemberArchiveValue,
  RemoteMemberRestoreValue,
  RemoteMemberDisposeValue,
  RemoteOverrideGetValue,
  RemoteOverrideSetValue,
  RemoteOverrideResetValue,
  RemotePolicyStateGetValue,
  RemotePolicyStateSetValue,
  RemoteCompatibilityGetValue,
  RemoteCompatibilityAckValue,
  RemoteCompatibilityReprobeValue,
  RemoteHandoffPrepareValue,
  RemoteHandoffCreateValue,
  RemoteLegacyInspectValue,
} from './contracts/types.js'

export type {
  RemoteCatalogPort,
  RemoteIntentPort,
  RemoteTeamCreateEmbeddedWorkPort,
  RemoteTeamCreateWorkspacePort,
  RemoteTeamAdmitInitialWorkPort,
  RemoteProjectionPort,
  RemoteLedgerPort,
  RemoteAdmissionRequest,
  RemoteAdmissionPort,
  RemoteLifecyclePort,
  RemoteOverrideSetRequest,
  RemoteOverrideResetRequest,
  RemoteOverridePort,
  RemotePolicyStateSwitchRequest,
  RemotePolicyStatePort,
  RemoteCompatibilityPort,
  RemoteHandoffPort,
  RemoteLegacyPort,
  RemoteTeamRootsPort,
  RemoteTeamEnsureRootLivePort,
  RemoteTeamResolveControlPort,
  RemoteTeamPrepareOrdinaryOpenPort,
  RemoteTeamReadStatePort,
  RemoteLiveTokenPort,
  RemoteHandlerDeps,
  RemoteHandlerOutcome,
  RemoteHandler,
} from './handlers/ports.js'

export {
  createRemoteCatalogHandler,
} from './handlers/catalog.js'

export {
  createRemoteIntentHandler,
} from './handlers/intent.js'

export {
  createRemoteTeamHandler,
} from './handlers/team.js'

export type {
  RemoteTeamHandlerPorts,
} from './handlers/team.js'

export {
  createRemoteMemberHandler,
} from './handlers/member.js'

export type {
  RemoteMemberHandlerPorts,
} from './handlers/member.js'

export {
  createRemoteOverrideHandler,
} from './handlers/override.js'

export {
  createRemotePolicyStateHandler,
} from './handlers/policy-state.js'

export {
  createRemoteCompatibilityHandler,
} from './handlers/compatibility.js'

export {
  createRemoteHandoffHandler,
} from './handlers/handoff.js'

export {
  createRemoteLegacyHandler,
} from './handlers/legacy.js'

export {
  createRemoteDispatcher,
} from './handlers/dispatch.js'

export type {
  RemoteDispatcher,
} from './handlers/dispatch.js'

export {
  REMOTE_RPC_CHANNEL,
  registerRemoteHandlers,
} from './handlers/register.js'

export type {
  ConnectionLike,
  RemoteRegistration,
  RegisterRemoteHandlersOptions,
} from './handlers/register.js'

// ---------------------------------------------------------------------------
// P8-T4 push model (whole-projection generation, versioned invalidation +
// pull): the pure client-side sync engine over the frozen contract v1
// surface (Gate G8: a new state is never overwritten by a stale response).
// ---------------------------------------------------------------------------

export {
  PushBackoffRangeError,
  backoffCapMs,
  defaultDelayPicker,
  isStateChange,
  pickBackoffDelayMs,
  stateOnConnect,
  stateOnLoss,
} from './push/reconnect.js'

export {
  PUSH_MIN_GENERATION,
  decideFrameVerdict,
  isStrictlyNewerGeneration,
} from './push/generation.js'

export {
  PULL_PROJECTION_ENDPOINT,
  assessProjectionSync,
  extractPushFrame,
  isApplyAssessment,
} from './push/pull.js'

export {
  assessProjectionSyncV6,
  extractPushFrameV6,
  appliedIdentityFromV6,
} from './push/pull-v6.js'
export type {
  AppliedProjectionIdentityV6,
  RemotePushFrameV6,
} from './push/pull-v6.js'

export {
  createLedgerPageTracker,
  verifyLedgerPageAnchor,
} from './push/ledger-page.js'
export type {
  LedgerPageTracker,
  LedgerPageTrackerState,
} from './push/ledger-page.js'

export { PushTransportLossError } from './push/types.js'
export type {
  AppliedProjectionIdentity,
  FrameVerdict,
  PageAnchorRequest,
  PageCheckResult,
  PageFetchReport,
  PageRejectReason,
  PushBackoffConfig,
  PushBackoffEntry,
  PushClientState,
  ProjectionSyncAssessment,
  ProjectionSyncStatus,
  ReconnectState,
  RemotePushFrame,
  RemotePushTransport,
  SeamClientRequest,
  SeamServerResponse,
} from './push/types.js'
