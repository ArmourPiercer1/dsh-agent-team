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
  SUPPORTED_REMOTE_CONTRACT_VERSIONS,
  isSupportedRemoteContractVersion,
  assertSupportedRemoteContractVersion,
  parseRemoteContractVersion,
} from './contracts/version.js'

export type {
  RemoteContractVersion,
} from './contracts/version.js'

export {
  REMOTE_CATEGORIES,
  REMOTE_CATEGORY_VALUES,
  REMOTE_METHOD_CATALOG,
  REMOTE_METHOD_NAMES,
  REMOTE_METHODS_BY_CATEGORY,
  isRemoteMethod,
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
  REMOTE_TEAM_GET_PROJECTION_FIELDS,
  REMOTE_TEAM_GET_LEDGER_PAGE_FIELDS,
  REMOTE_MEMBER_CREATE_FIELDS,
  REMOTE_MEMBER_SEND_FIELDS,
  REMOTE_MEMBER_FOLLOWUP_FIELDS,
  REMOTE_MEMBER_LIFECYCLE_FIELDS,
  REMOTE_OVERRIDE_GET_FIELDS,
  REMOTE_OVERRIDE_SET_FIELDS,
  REMOTE_OVERRIDE_RESET_FIELDS,
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
  parseRemoteOverrideResetParams,
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
  RemoteTeamGetProjectionParams,
  RemoteTeamGetLedgerPageParams,
  RemoteMemberCreateParams,
  RemoteMemberSendParams,
  RemoteMemberFollowupParams,
  RemoteMemberLifecycleParams,
  RemoteOverrideGetParams,
  RemoteOverrideSetParams,
  RemoteOverrideResetParams,
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
  REMOTE_LEDGER_ENTRY_FIELDS,
} from './contracts/types.js'

export type {
  RemoteCatalogListValue,
  RemoteCatalogGetValue,
  RemoteIntentProbeValue,
  RemoteTeamCreatePath,
  RemoteTeamCreateValue,
  RemoteProjectionValue,
  RemoteTeamGetProjectionValue,
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
  RemoteTeamCreatePort,
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
