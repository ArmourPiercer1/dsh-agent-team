/**
 * P8-S6 A31 + A33 + A34 — the production remote-handler registration, the
 * ledger-page pagination completion, and the production dispatcher of the
 * Remote contract v1 (plan §20; closes CR-12 together with A30/A32).
 *
 * The frozen `packages/remote` library ships a SYNCHRONOUS dispatcher and
 * twelve synchronous ports (its design note §6: the ports are pure reads
 * over injected tables). The vNext production facades are ASYNC (durable
 * repository writes, the action router's team lock, the lifecycle chains,
 * the compatibility prober). This module is the PRODUCTION async mirror:
 *
 * - the dispatcher mirrors the frozen seven invariants byte-for-byte
 *   (unknown endpoint BEFORE the envelope; the closed envelope; the
 *   per-method closed param schema; the typed-error pass-through with the
 *   source identity under `details.cause`; the untyped-throw →
 *   `internal-error` with no leak; the lossless-JSON check before the
 *   success reply; the promise that never rejects) — the ONLY divergence
 *   is the `await` of the category handler (invariant 4), forced by the
 *   async facades;
 * - the twelve ports are host adapters over the runtime authorities ONLY
 *   (plan §20.4: a remote handler must call Runtime/Team service
 *   authority — never a direct repository mutation, never a direct
 *   Agent.followup, never a local compatibility recompute);
 * - every client-claimed principal (`caller` / `actor` / `acknowledgedBy`)
 *   is derived SERVER-SIDE through the installed `serverPrincipalDerivation`
 *   seam (A32; closes CR-4) — the claim is input to the derivation, never
 *   authority;
 * - `team.getLedgerPage` additionally flows through the pagination
 *   completion (A34): the frozen `createLedgerPageTracker` (the A33
 *   wiring) gates every served page (plan §20.5/§20.6: the stable cursor,
 *   the load-earlier session, the growth-safe historical window).
 *
 * The wire contract is UNCHANGED: every `outcome.data` shape mirrors the
 * frozen category handlers (one dotted endpoint per method, the same
 * value shapes, the same provenance cells), so a frozen-contract client
 * cannot tell the mirror apart from the frozen dispatcher.
 *
 * Pure assembly module: no `node:` builtins, no DSH imports (the DSH side
 * arrives exclusively through the injected ports).
 * @module @dsh-agent-team/runtime/plugin/s6-remote
 */

import {
  REMOTE_CATEGORIES,
  isRemoteMethod,
  remoteCategoryOf,
} from '../../../remote/src/contracts/catalog.js'
import {
  REMOTE_CONTRACT_ERROR_CODES,
  isRemoteContractError,
  remoteContractError,
} from '../../../remote/src/contracts/errors.js'
import {
  parseRemoteMethodParams,
  parseRemoteTeamGetLedgerPageParams,
} from '../../../remote/src/contracts/params.js'
import type {
  RemoteCatalogGetParams,
  RemoteCompatibilityAckParams,
  RemoteCompatibilityGetParams,
  RemoteCompatibilityReprobeParams,
  RemoteHandoffCreateParams,
  RemoteHandoffPrepareParams,
  RemoteIntentProbeParams,
  RemoteLegacyInspectParams,
  RemoteMemberCreateParams,
  RemoteMemberFollowupParams,
  RemoteMemberLifecycleParams,
  RemoteMemberSendParams,
  RemoteMethodParams,
  RemoteOverrideGetParams,
  RemoteOverrideResetParams,
  RemoteOverrideSetParams,
  RemotePolicyStateGetParams,
  RemotePolicyStateSetParams,
  RemoteTeamAdmitInitialWorkParams,
  RemoteTeamCreateParams,
  RemoteTeamCreateParamsV2,
  RemoteTeamEnsureRootLiveParams,
  RemoteTeamGetLedgerPageParams,
  RemoteTeamGetProjectionParams,
  RemoteTeamResolveControlParams,
} from '../../../remote/src/contracts/params.js'
import { parseRemoteRequest } from '../../../remote/src/contracts/request.js'
import type { RemoteRequest } from '../../../remote/src/contracts/request.js'
import {
  buildRemoteError,
  buildRemoteSuccess,
} from '../../../remote/src/contracts/response.js'
import type {
  RemoteProvenanceContext,
  RemoteResponse,
} from '../../../remote/src/contracts/response.js'
import {
  REMOTE_PROJECTION_FIELDS,
  type RemoteLedgerEntryValue,
  type RemoteLedgerPageValue,
} from '../../../remote/src/contracts/types.js'
import {
  REMOTE_CONTRACT_VERSION,
  REMOTE_CONTRACT_VERSION_V2,
} from '../../../remote/src/contracts/version.js'
import type { RemoteSafeRecord } from '../../../remote/src/contracts/remote-safe.js'
import { REMOTE_BACKING_ERROR_CODE_SET } from '../../../remote/src/handlers/dispatch.js'
import type { RemoteDispatcher } from '../../../remote/src/handlers/dispatch.js'
import type { RemoteHandlerOutcome } from '../../../remote/src/handlers/ports.js'
import { REMOTE_RPC_CHANNEL } from '../../../remote/src/handlers/register.js'
import type {
  ConnectionLike,
  RemoteRegistration,
} from '../../../remote/src/handlers/register.js'
import { createLedgerPageTracker } from '../../../remote/src/push/ledger-page.js'
import type { PageCheckResult } from '../../../remote/src/push/types.js'
import type { TeamRootWireRow } from '../team-ownership-index.js'
import { TeamPluginError } from './types.js'
import type {
  RemoteHandlerRegistration,
  RemoteQueryCommandCompletion,
  ServerPrincipalDerivation,
  WorkspaceAttachPort,
} from './types.js'
import {
  S6_PRINCIPAL_ERROR_CODES,
  SERVER_PRINCIPAL_TRANSPORTS,
  createServerPrincipalContext,
  isServerPrincipalContext,
} from './s6-principal.js'
import type { ServerPrincipalContext } from './s6-principal.js'
import type { TeamDomainRepositories } from '../../../storage/repositories/index.js'
import type {
  ActionCaller,
  TeamRuntime,
  TeamRuntimeActionOutcome,
  TeamRuntimeActionRequest,
} from '../../admission/index.js'
import {
  resolveCaller,
  TEAM_RUNTIME_ERROR_CODES,
  TeamRuntimeError,
} from '../../admission/index.js'
import type {
  AdmitRootInitialWork,
  RootInitialWorkArgs,
  RootInitialWorkResult,
} from '../../action-router/index.js'
import type { InstanceId, TeamSessionId } from '../../../contracts/src/index.js'
import { canonicalJsonStringify } from '../../../contracts/src/index.js'
import type { LifecycleService } from '../../lifecycle/index.js'
import { activePolicyState } from '../../mutation/index.js'
import type {
  MessagingCoordinator,
  SendTeamMessageOutcome,
  SendTeamMessageRequest,
} from '../../messaging/index.js'
import type {
  AdmittedGovernanceOverride,
  AdmitGovernanceOverrideArgs,
  MutationActor,
  MutationAuthority,
  OverrideStorePort,
  PolicyEntry,
  PolicyStateTransitionRecord,
  PolicyStateView,
} from '../../mutation/index.js'
import {
  PROBE_TRIGGER_VALUES,
  compatibilityRequirementsOf,
} from '../../compatibility/index.js'
import type { CompatibilityProber } from '../../compatibility/index.js'
import {
  evaluateCompatibility,
  parseEnvironmentFacts,
} from '../../../domain/compatibility/src/index.js'
import type { EnvironmentFact } from '../../../domain/compatibility/src/index.js'
import type {
  BlueprintCatalog,
  BlueprintTemplate,
  TeamBlueprint,
} from '../../../domain/blueprint/src/index.js'
import { sha256Hex } from '../../../domain/blueprint/src/index.js'
import { DEFAULT_POLICY_STATE_ID } from '../../../domain/policy/src/index.js'
import type {
  ColdRootBindingInput,
  FreshRootBindingInput,
  RootBindingResult,
} from '../../root-binding/index.js'
import type { HandoffService } from '../../handoff/index.js'
import type { LegacyHomePort, LegacyInspectFn } from './legacy-surface.js'
import type { ProjectionService } from '../../projection/index.js'

// --- the stable S6 remote error codes (the typed domain errors) ----------------------

/** The stable error codes the S6 remote surfaces throw (CR-4/CR-12 boundary). */
export const S6_REMOTE_ERROR_CODES = {
  /** A34 — the ledger-page tracker rejected the page (the 20.5/20.6 boundary). */
  LEDGER_PAGE_REJECTED: 'TEAM_REMOTE_LEDGER_PAGE_REJECTED',
  /** A31 — no durable compatibility state to read (fail-closed). */
  COMPATIBILITY_STATE_ABSENT: 'TEAM_REMOTE_COMPATIBILITY_STATE_ABSENT',
  /** A31 — the durable compatibility state is structurally malformed. */
  COMPATIBILITY_STATE_MALFORMED: 'TEAM_REMOTE_COMPATIBILITY_STATE_MALFORMED',
  /** A31 — the requested PolicyState is outside the bound blueprint's closed set. */
  POLICY_STATE_UNKNOWN: 'TEAM_REMOTE_POLICY_STATE_UNKNOWN',
  /** A31 — a catalog revision is not a safe integer (host bug, fail-closed). */
  CATALOG_REVISION_MALFORMED: 'TEAM_REMOTE_CATALOG_REVISION_MALFORMED',
  /** A31 — a durable ledger entry is structurally malformed (fail-closed). */
  LEDGER_ENTRY_MALFORMED: 'TEAM_REMOTE_LEDGER_ENTRY_MALFORMED',
  /** A31 — handoff.prepare: the production root exposes no source-session read surface. */
  HANDOFF_PREPARE_UNAVAILABLE: 'TEAM_HANDOFF_SOURCE_SURFACE_UNAVAILABLE',
  /** A31 — legacy.inspect: no legacy home port is bound to this root. */
  LEGACY_HOME_UNAVAILABLE: 'TEAM_REMOTE_LEGACY_HOME_UNAVAILABLE',
  /** A31 — an instance-scoped override request carries no target instance. */
  OVERRIDE_TARGET_REQUIRED: 'TEAM_REMOTE_OVERRIDE_TARGET_REQUIRED',
  /** A31 — team.create names a blueprint snapshot the bound TeamSession does not carry. */
  TEAM_CREATE_BLUEPRINT_MISMATCH: 'TEAM_REMOTE_TEAM_CREATE_BLUEPRINT_MISMATCH',
  /** D-3 — team.create: the live glue exposes no root-agent start port (a
   *  created team must own a live leader; failing closed). */
  TEAM_CREATE_ROOT_START_UNAVAILABLE: 'TEAM_REMOTE_TEAM_CREATE_ROOT_START_UNAVAILABLE',
  /** D-3 — team.create: starting the root (leader) agent of the created or
   *  retained root failed (the durable bind is preserved; the retry
   *  re-drives the start on the cold path). */
  TEAM_CREATE_ROOT_START_FAILED: 'TEAM_REMOTE_TEAM_CREATE_ROOT_START_FAILED',
  /** TCM vNext §15.5 — v2 team.create: no registered workspace for the
   *  requested path (typed at the workspace port BEFORE any durable
   *  effect; the upstream reason rides in the message). The closed wire
   *  code the M1 backing vocabulary established for this condition. */
  TEAM_CREATE_WORKSPACE_NOT_FOUND: 'TEAM_CREATE_WORKSPACE_NOT_FOUND',
  /** TCM vNext §15.6 — v2 team.create cold retry: the durable
   *  `defaultWorkspace` differs from the requested canonical workspace
   *  path (zero writes). */
  TEAM_CREATE_WORKSPACE_MISMATCH: 'TEAM_CREATE_WORKSPACE_MISMATCH',
  /** TCM vNext §15.6 — v2 team.create: the public `Workspace.attachSession`
   *  rejected AFTER the durable bind (the bind is preserved — the typed
   *  retryable failure; the retry re-drives the attach, idempotent
   *  upstream). */
  TEAM_CREATE_WORKSPACE_ATTACH_FAILED: 'TEAM_CREATE_WORKSPACE_ATTACH_FAILED',
  /** TCM vNext §15.8 — the Root initial-work paths (the v1 create's
   *  `initialWork` + the v2 `team.admitInitialWork`): the production root
   *  exposes no Root initial-work authority (glue without the
   *  `deliverRootWork` port) — fail-closed BEFORE any durable effect. */
  TEAM_CREATE_ROOT_WORK_UNAVAILABLE: 'TEAM_CREATE_ROOT_WORK_UNAVAILABLE',
  /** TCM vNext §15.6 — the Root initial work: same token, different
   *  canonical payload (the strategy's typed ROOT_WORK_PAYLOAD_MISMATCH,
   *  zero writes; mapped onto the M1 closed wire vocabulary). */
  TEAM_CREATE_ROOT_WORK_PAYLOAD_MISMATCH: 'TEAM_CREATE_ROOT_WORK_PAYLOAD_MISMATCH',
  /** TCM vNext §15.6 — the Root initial work: a delivery fault (the
   *  durable admission is retained, no terminal fact; the same-token
   *  retry recovers. The strategy's WORK_DELIVERY_FAILED mapped onto the
   *  M1 closed wire vocabulary). */
  TEAM_CREATE_ROOT_WORK_DELIVERY_FAILED: 'TEAM_CREATE_ROOT_WORK_DELIVERY_FAILED',
  /** D1 (Team D1-D6 repair v2, remote contract v3) — team.listRoots:
   *  the host wiring exposes no listRoots port (the TeamDomain
   *  repositories are not reachable from this root) — fail-closed
   *  BEFORE any read; never a silent empty list. */
  TEAM_ROOTS_UNAVAILABLE: 'TEAM_REMOTE_TEAM_ROOTS_UNAVAILABLE',
  /** D1 (Team D1-D6 repair v2, remote contract v3) — team.ensureRootLive:
   *  the v3 method is reserved; the production host handler is wired by
   *  D2 (over the live glue's `ensureLiveAgent`, A3 Q2). Until then the
   *  method fails closed typed — NEVER a silent success. */
  TEAM_ROOT_LIVE_NOT_IMPLEMENTED: 'TEAM_REMOTE_TEAM_ROOT_LIVE_NOT_IMPLEMENTED',
  /** D2-RESERVED (A3 Q2) — the ensureRootLive glue port is absent. */
  TEAM_ROOT_LIVE_PORT_UNAVAILABLE: 'TEAM_REMOTE_TEAM_ROOT_LIVE_PORT_UNAVAILABLE',
  /** D2-RESERVED (A3 Q2) — the root has no durable session artifact. */
  TEAM_ROOT_LIVE_NO_DURABLE_ARTIFACT: 'TEAM_REMOTE_TEAM_ROOT_LIVE_NO_DURABLE_ARTIFACT',
  /** D2-RESERVED (A3 Q2) — the session is already live OUTSIDE the Team glue. */
  TEAM_ROOT_LIVE_OUTSIDE_TEAM: 'TEAM_REMOTE_TEAM_ROOT_LIVE_OUTSIDE_TEAM',
  /** D2-RESERVED (A3 Q2) — the glue start failed for another reason. */
  TEAM_ROOT_LIVE_START_FAILED: 'TEAM_REMOTE_TEAM_ROOT_LIVE_START_FAILED',
  /** F9 (F3/F11/F9/T1.4 repair round r1, remote contract v4) —
   *  team.resolveControl: the host wiring exposes no control-service
   *  closure (the durable control plane is not reachable from this
   *  root) — fail-closed BEFORE any decision; NEVER a silent success
   *  (never a default decision, never a no-op). */
  TEAM_RESOLVE_CONTROL_UNAVAILABLE: 'TEAM_REMOTE_TEAM_RESOLVE_CONTROL_UNAVAILABLE',
} as const

export type S6RemoteErrorCode = (typeof S6_REMOTE_ERROR_CODES)[keyof typeof S6_REMOTE_ERROR_CODES]

// --- the production port vocabulary (the async mirror of the frozen twelve) ----------

/**
 * The admission request the `member.create` / `member.send` /
 * `member.followup` handlers build (the structural mirror of the frozen
 * `RemoteAdmissionRequest`). `callerClaim` is the CLIENT'S claim: it is
 * input to the server-side principal derivation (A32) and NEVER authority —
 * the port acts on the derived caller only (plan §20.3, CR-4).
 */
export interface S6RemoteAdmissionRequest {
  readonly rootSessionId: string
  readonly action: 'create-member' | 'send-message' | 'follow-up'
  /** The client's caller claim (derivation input only). */
  readonly callerClaim: unknown
  readonly requestToken: string
  readonly targetInstanceId?: string
  readonly delegationTemplateId?: string
  readonly delegationInstanceId?: string
  readonly body?: string
  readonly subject?: string
  readonly payload?: RemoteSafeRecord
}

/** The `override.set` request (the structural mirror of the frozen shape). */
export interface S6RemoteOverrideSetRequest {
  readonly teamSessionId: string
  readonly capability: string
  readonly value: RemoteSafeRecord
  /** The client's actor claim (derivation input only). */
  readonly actorClaim: unknown
  readonly scope?: 'team' | 'instance'
  readonly targetInstanceId?: string
}

/** The `override.reset` request (the structural mirror of the frozen shape). */
export interface S6RemoteOverrideResetRequest {
  readonly teamSessionId: string
  readonly capability: string
  /** The client's actor claim (derivation input only). */
  readonly actorClaim: unknown
  readonly scope?: 'team' | 'instance'
  readonly targetInstanceId?: string
}

/** The `policyState.set` request (the structural mirror of the frozen shape). */
export interface S6RemotePolicyStateSwitchRequest {
  readonly teamSessionId: string
  readonly target: RemoteSafeRecord
  /** The client's actor claim (derivation input only). */
  readonly actorClaim: unknown
}

/** Port 1/12 — blueprint catalog discovery (`catalog.*`). */
export interface S6RemoteCatalogPort {
  list(): Promise<readonly RemoteSafeRecord[]>
  get(blueprintId: string, blueprintRevision?: number): Promise<RemoteSafeRecord>
}
/**
 * Port 2/12 — the pre-creation compatibility probe (`intent.probe`).
 *
 * T1.4-B (U5/T1-B strict; the shared v4 semantic entry 2, CF2; the wire
 * shape is UNCHANGED — same v1 method, same params, same result shape;
 * only the host-side fact completion changed): the probe is a FAITHFUL
 * PREDICTOR of the post-creation admission gate. It evaluates the SAME
 * world the gate consumes: the host row-config environment facts (the
 * same injected source — {@link S6RemoteOptions.environmentFacts})
 * merged with the caller's wire facts under the strict U5 rule:
 *
 * - the caller contributes ONLY the `persona` domain (the selected
 *   preset is the explicit user intent; the row's persona fact is the
 *   deployment default and yields to the selection — diverging against
 *   a required persona makes the probe STRICTER than the gate, the
 *   documented safe direction; the §7.4 complete:true preset-conflict
 *   semantics are untouched);
 * - every other domain is host-only: caller capability claims are
 *   DISCARDED, not overridden (the fact-forgery hole closed — a wire
 *   payload cannot self-attest the environment, CR-4 discipline).
 *
 * INV-9.4: "A compatibility verdict is authoritative only when every
 * required requirement domain is represented by an authoritative
 * environment fact source. Missing required facts remain fail-closed;
 * the fix for incomplete observation is to complete the observation,
 * not weaken the verdict." — required → FATAL (no downgrade, no
 * Continue-anyway), optional → WARNING + the explicit ack path, all
 * preserved (compatibility red line, Architecture §27.2, invariant 47).
 */
export interface S6RemoteIntentPort {
  probe(
    blueprintId: string,
    blueprintRevision: number | undefined,
    environmentFacts: readonly RemoteSafeRecord[],
  ): Promise<RemoteSafeRecord>
}
/** Port 3/12 — TeamSession creation via the root binding (`team.create` v1). */
export interface S6RemoteTeamCreatePort {
  /**
   * Bind a fresh root or rehydrate a cold root for the requested
   * blueprint. `initialWork` (BC-03 / R1-A) is optional: when present it
   * is admitted as part of the creation through the SAME Root-specific
   * initial-work authority the v2 `team.admitInitialWork` command uses
   * (TCM vNext §15.4/G1: the plan §15.8 closure over the shared
   * coordination chains + the single compatibility gate — NEVER the
   * generic Member `follow-up` on `inst-leader`, which needs a durable
   * Leader member record + `childSessionId` + the lifecycle settlement
   * the honest Leader v2 must not carry). Absent, the behavior is
   * unchanged.
   * @returns the value object
   *   `{ path: 'fresh-root' | 'cold-root', durable: <state> | null,
   *   bind: <bind result> }` (lossless JSON).
   */
  create(
    rootSessionId: string,
    blueprintId: string,
    blueprintRevision?: number,
    initialWork?: RemoteSafeRecord,
  ): Promise<RemoteSafeRecord>
}
/** TCM vNext §15.6 — the v2 workspace-aware `team.create` port (the
 *  production async mirror of the frozen `RemoteTeamCreateV2Port`).
 *  CREATE-ONLY: it never carries initial work (that travels the v2-only
 *  `team.admitInitialWork` command, {@link S6RemoteTeamAdmitInitialWorkPort},
 *  after the root is open). Typed failures raised here (the closed
 *  `TEAM_CREATE_WORKSPACE_*` codes) pass through the dispatcher unchanged
 *  (the closed backing vocabulary, invariant 4b). */
export interface S6RemoteTeamCreateV2Port {
  /**
   * Bind a fresh root (or rehydrate a cold root) for the requested
   * blueprint. When `workspace` is present it is resolved through the
   * host workspace registry BEFORE any durable effect (the canonical
   * path is the registry's, verbatim), bound as the TeamSession's
   * `defaultWorkspace`, and the materialized root session is attached to
   * the workspace through the public `Workspace.attachSession` AFTER the
   * bind + the Root agent start (plan §2.2 creation order). When absent,
   * the host default workspace carries (unchanged pre-v2 behavior) and no
   * attach runs.
   * @param rootSessionId - the validated root session id.
   * @param blueprintId - the validated blueprint id.
   * @param blueprintRevision - the requested revision, or `undefined`
   *   for the latest.
   * @param workspace - the selected workspace path (the client's
   *   `TeamWorkspaceOption.path`), or `undefined` for the host default.
   * @returns the same value object as v1:
   *   `{ path: 'fresh-root' | 'cold-root', durable: <state> | null,
   *   bind: <bind result> }` (lossless JSON).
   */
  create(
    rootSessionId: string,
    blueprintId: string,
    blueprintRevision: number | undefined,
    workspace: string | undefined,
  ): Promise<RemoteSafeRecord>
}
/** TCM vNext §15.6 — the v2-only `team.admitInitialWork` port (the
 *  production async mirror of the frozen
 *  `RemoteTeamAdmitInitialWorkPort`): the creation-time initial work
 *  command. It calls the SAME Root-specific authority the v1 create's
 *  `initialWork` uses (the plan §15.8 closure — never the generic Member
 *  follow-up). Idempotent per `(rootSessionId, requestToken)`: a replayed
 *  terminal success redelivers nothing; the same token with a different
 *  canonical payload is a typed mismatch; the team's one initial-work
 *  slot occupied by another token is a typed rejection. Typed failures
 *  raised here (the closed `TEAM_CREATE_ROOT_WORK_*` codes + the
 *  strategy's already-closed runtime codes) pass through the dispatcher
 *  unchanged (invariant 4b). */
export interface S6RemoteTeamAdmitInitialWorkPort {
  /**
   * Admit (or replay-reject) the creation-time initial work for one root.
   * @param rootSessionId - the validated root session id.
   * @param requestToken - the caller-stable opaque work token
   *   (idempotency identity).
   * @param prompt - the initial work prompt (free-form, 1..200000).
   * @param attachedContext - optional attached context text
   *   (free-form, 1..200000); the host folds it into the delivered work.
   * @returns the admission outcome (lossless JSON).
   */
  admit(
    rootSessionId: string,
    requestToken: string,
    prompt: string,
    attachedContext: string | undefined,
  ): Promise<RemoteSafeRecord>
}
/** D1 (Team D1-D6 repair v2, remote contract v3) — the v3-only
 *  `team.listRoots` port (the production async mirror of the frozen
 *  `RemoteTeamRootsPort`): the durable Team root ownership / identity
 *  list. READ-ONLY: no repository writes, no agent effects. The
 *  production backing is the D1 pure ownership-index module
 *  (`team-ownership-index.ts` over the already-injected TeamDomain
 *  repositories); it FAILS CLOSED on a corrupt or inconsistent row (the
 *  index's `TEAM_OWNERSHIP_INDEX_*` codes + the storage layer's
 *  `RECORD_INVALID` / `MALFORMED_DTO` codes — all members of the closed
 *  backing vocabulary, invariant 4b), never a silent empty list. */
export interface S6RemoteTeamRootsPort {
  /** The durable root wire rows, sorted by root session id. */
  listRoots(): Promise<readonly TeamRootWireRow[]>
}
/** D2 (Team D1-D6 repair v2, remote contract v3) — the v3-only
 *  `team.ensureRootLive` port (the production async mirror of the frozen
 *  `RemoteTeamEnsureRootLivePort`). TEAM-SCOPED like `team.admitInitialWork`:
 *  the bound-root guard runs BEFORE anything else (fail-closed
 *  FOREIGN_TEAM). D2 answers a guarded call by driving the host's
 *  `ensureRootLive` option (the live glue's `ensureLiveAgent`, A3 Q2 —
 *  live-first: the upstream agent registry resolves a live agent and
 *  reuses it, so a second agent under one root is structurally impossible)
 *  and mapping the port's rejections onto the closed
 *  TEAM_REMOTE_TEAM_ROOT_LIVE_* vocabulary (OUTSIDE_TEAM /
 *  NO_DURABLE_ARTIFACT / START_FAILED; PORT_UNAVAILABLE when the option
 *  is absent) — NEVER a silent success, never a silent adoption. */
export interface S6RemoteTeamEnsureRootLivePort {
  /**
   * Ensure the named root is live in Team mode.
   * @param teamSessionId - the validated TeamSession (root session) id.
   * @returns the closed v3 success shape
   *   `{ rootSessionId, mode: "team", live: true }` (lossless JSON).
   */
  ensureRootLive(teamSessionId: string): Promise<RemoteSafeRecord>
}
/** F9 (F3/F11/F9/T1.4 repair round r1, remote contract v4) — the v4-only
 *  `team.resolveControl` port (the production async mirror of the frozen
 *  `RemoteTeamResolveControlPort`). TEAM-SCOPED like `team.admitInitialWork`:
 *  the bound-root guard runs BEFORE anything else (fail-closed
 *  FOREIGN_TEAM). The wire params carry NO caller/role/principal fields
 *  (adjudication U3) — the host derives the human principal from the
 *  T12-B4 trusted principal seam (the connection-gate authority basis;
 *  the single authenticated operator) and passes it HERE, stamped:
 *  `caller` is host-derived, never a client claim. The port drives the
 *  host's `resolveControl` option (the existing durable control service,
 *  A25 — `CONTROL_RESOLVER_ROLES` + the durable exactly-once semantics
 *  UNCHANGED; this port is the command surface, not a second authority)
 *  and passes the service's closed CONTROL_* failures through unmapped
 *  (invariant 4b) — NEVER a silent success, never a default decision. */
export interface S6RemoteTeamResolveControlPort {
  /**
   * Resolve one pending control request (allow / deny) as the derived
   * human principal.
   * @param teamSessionId - the validated TeamSession (root session) id.
   * @param requestId - the validated opaque control request id.
   * @param decision - the frozen decision (`allow` / `deny`).
   * @param note - the decider's free-form note (1..2048), or `undefined`.
   * @param caller - the HOST-DERIVED ActionCaller (the T12-B4 seam; the
   *   v4 branch stamps `{ kind: 'human', humanId: <owned teamSessionId> }`
   *   — never a client claim).
   * @returns the durable decision record (lossless JSON).
   */
  resolveControl(
    teamSessionId: string,
    requestId: string,
    decision: 'allow' | 'deny',
    note: string | undefined,
    caller: ActionCaller,
  ): Promise<RemoteSafeRecord>
}
/** Port 4/12 — the whole-projection observation (`team.getProjection`). */
export interface S6RemoteProjectionPort {
  project(teamSessionId: string): Promise<RemoteSafeRecord>
}
/** Port 5/12 — the durable ledger behind the D-5 slicer (`team.getLedgerPage`). */
export interface S6RemoteLedgerPort {
  listEntries(teamSessionId: string): Promise<readonly RemoteLedgerEntryValue[]>
  countEntries(teamSessionId: string): Promise<number>
}
/** Port 6/12 — member admission over the TeamRuntime facade (`member.*`). */
export interface S6RemoteAdmissionPort {
  performAction(
    request: S6RemoteAdmissionRequest,
    caller: ActionCaller,
  ): Promise<TeamRuntimeActionOutcome>
}
/** Port 7/12 — member lifecycle over the LifecycleService (`member.*`). */
export interface S6RemoteLifecyclePort {
  archive(teamSessionId: string, instanceId: string): Promise<RemoteSafeRecord>
  restore(teamSessionId: string, instanceId: string): Promise<RemoteSafeRecord>
  dispose(teamSessionId: string, instanceId: string): Promise<RemoteSafeRecord>
}
/** Port 8/12 — governance overrides over the mutation admission (`override.*`). */
export interface S6RemoteOverridePort {
  get(
    teamSessionId: string,
    capability: string,
    scope?: 'team' | 'instance',
    targetInstanceId?: string,
  ): Promise<RemoteSafeRecord | null>
  set(request: S6RemoteOverrideSetRequest, caller: ActionCaller): Promise<RemoteSafeRecord>
  reset(request: S6RemoteOverrideResetRequest, caller: ActionCaller): Promise<{ readonly removed: boolean }>
}
/** Port 9/12 — the TeamSession PolicyState over the mutation service (`policyState.*`). */
export interface S6RemotePolicyStatePort {
  read(teamSessionId: string): Promise<RemoteSafeRecord>
  switchState(request: S6RemotePolicyStateSwitchRequest, caller: ActionCaller): Promise<RemoteSafeRecord>
}
/** Port 10/12 — the durable compatibility state over the prober (`compatibility.*`). */
export interface S6RemoteCompatibilityPort {
  current(teamSessionId: string): Promise<RemoteSafeRecord>
  acknowledge(teamSessionId: string, requirementId: string, caller: ActionCaller, note?: string): Promise<RemoteSafeRecord>
  probe(teamSessionId: string, trigger: string): Promise<RemoteSafeRecord>
}
/** Port 11/12 — start-a-team-from-here over the handoff service (`handoff.*`). */
export interface S6RemoteHandoffPort {
  prepareSource(sourceSessionId: string): Promise<RemoteSafeRecord>
  start(sourceSessionId: string, requestToken: string, staged?: RemoteSafeRecord): Promise<RemoteSafeRecord>
}
/** Port 12/12 — the read-only legacy inspection (`legacy.inspect`). */
export interface S6RemoteLegacyPort {
  inspect(dshHome: string, workspaceCwd?: string, projectDir?: string): Promise<RemoteSafeRecord>
}

/** The sixteen production ports (the frozen twelve + the T12-V16 messaging
 *  coordinator port + the two TCM vNext §15.6 team-create v2 ports + the
 *  D1 remote-contract-v3 `team.listRoots` port). */
export interface S6RemotePorts {
  readonly catalog: S6RemoteCatalogPort
  readonly intent: S6RemoteIntentPort
  readonly teamCreate: S6RemoteTeamCreatePort
  /** TCM vNext §15.6 (G1) — the v2 workspace-aware `team.create` port. */
  readonly teamCreateV2: S6RemoteTeamCreateV2Port
  /** TCM vNext §15.6 (G1) — the v2-only `team.admitInitialWork` port. */
  readonly teamAdmitInitialWork: S6RemoteTeamAdmitInitialWorkPort
  /** D1 (Team D1-D6 repair v2, remote contract v3) — the v3-only
   *  `team.listRoots` port (the durable root ownership list). */
  readonly teamRoots: S6RemoteTeamRootsPort
  /** D1 (Team D1-D6 repair v2, remote contract v3) — the v3-only
   *  `team.ensureRootLive` port (D1: fails closed typed; D2: the live
   *  glue's Team-mode ensure). */
  readonly teamEnsureRootLive: S6RemoteTeamEnsureRootLivePort
  /** F9 (F3/F11/F9/T1.4 repair round r1, remote contract v4) — the v4-only
   *  `team.resolveControl` port (the human control-resolution command). */
  readonly teamResolveControl: S6RemoteTeamResolveControlPort
  readonly projection: S6RemoteProjectionPort
  readonly ledger: S6RemoteLedgerPort
  readonly admission: S6RemoteAdmissionPort
  readonly lifecycle: S6RemoteLifecyclePort
  readonly override: S6RemoteOverridePort
  readonly policyState: S6RemotePolicyStatePort
  readonly compatibility: S6RemoteCompatibilityPort
  readonly handoff: S6RemoteHandoffPort
  readonly legacy: S6RemoteLegacyPort
  /** T12-V16 — the P6-T3 messaging coordinator behind `member.send`:
   *  facade admission + LIVE delivery at admission time (the window-latch
   *  fix; t12v-finding-360s-first-turn.md). The bound-root guard lives in
   *  the port (fail-closed FOREIGN_TEAM on a foreign teamSessionId). */
  readonly messaging: S6RemoteMessagingPort
}

/** The P6-T3 messaging coordinator port (T12-V16). */
export interface S6RemoteMessagingPort {
  sendTeamMessage(request: SendTeamMessageRequest): Promise<SendTeamMessageOutcome>
}

// --- the construction inputs ------------------------------------------------------------

/** The root-binding surface the `team.create` port drives. */
export interface S6RootBindingPort {
  bindFresh(input: FreshRootBindingInput): Promise<RootBindingResult>
  rehydrateCold(input: ColdRootBindingInput): Promise<RootBindingResult>
}

/** The construction inputs of the S6 remote surfaces (all injected). */
/**
 * BP-G (issue #2 blueprint-loading, plan §12.2) — the in-process
 * read-only boot readiness state of the team runtime: `starting` (the
 * root is constructed and the remote route is mounted, the live boot has
 * not settled yet), `ready` (the live boot settled), `failed` (the live
 * boot rejected — the route STAYS registered; the state is terminal for
 * this process's lifetime: no automatic retry, no re-boot).
 */
export type RemoteReadiness = 'starting' | 'ready' | 'failed'

/**
 * BP-G (issue #2 blueprint-loading, plan §12.2) — the methods the
 * readiness gate does NOT refuse while the state is not `ready`: the
 * read-only catalog queries. They depend only on the Blueprint source
 * authority + the opened domain — never on the live boot outcome (the
 * whole point of the mount-before-boot reorder is that a failed live
 * boot leaves them servable — the 405 symptom the repair removes).
 * Every other closed contract method is refused with the frozen
 * `internal-error` failure envelope (no new wire code, no protocol
 * bump, plan §12.3).
 */
export const REMOTE_READINESS_INDEPENDENT_METHODS: ReadonlySet<string> = new Set([
  'catalog.list',
  'catalog.get',
])

export interface S6RemoteOptions {
  /** The bound root session id (this host's boot root TeamSession). */
  readonly rootSessionId: string
  /**
   * P9-S8 — the durable-ownership predicate over TeamSession roots: the
   * roots this host durably owns (a TeamSession record exists for the id).
   * The bound-root guard accepts the bound root AND any owned root, so a
   * team created after boot through the public remote creation faces
   * (`team.create` / `handoff.create`) is servable by this same remote.
   * Absent (tests, single-root fixtures): the T12 single-root semantics —
   * bound root only. Genuinely foreign TeamSession ids are rejected either
   * way (fail-closed; CR-4 — the browser payload still cannot self-appoint
   * authority; ownership is host-owned durable state, never a claim).
   */
  readonly isOwnedRoot?: (teamSessionId: string) => boolean
  /**
   * P9-S8 — the host default workspace (the row config): a team created
   * through this remote inherits it on its fresh bind (the team's
   * `defaultWorkspace` — inherited by its members; the projection fold
   * resolves the effective workspace against it). Absent: the created
   * team carries no default workspace.
   */
  readonly defaultWorkspace?: string
  /**
   * T1.4-B (U5/T1-B strict, CF2 entry 2) — the authoritative host
   * row-config environment facts: the SAME injected source the
   * post-creation admission gate consumes (the production root passes
   * its fresh-read fact thunk over `config.environmentFacts — the very
   * source the prober / authority / runtime wiring reads).
   * `intent.probe` merges these with the caller's wire facts under the
   * strict U5 rule ({@link mergeProbeEnvironmentFacts}): the caller
   * contributes ONLY the `persona` domain (the selected preset — user
   * intent); every other domain is taken exclusively from these host
   * facts (caller capability claims are discarded, not overridden —
   * the fact-forgery hole closed). Absent (factory / test worlds
   * without the host entry): the capability world is EMPTY — the
   * merge still applies, so a caller claim can NEVER substitute for a
   * host fact (fail-closed, the same direction the admission gate
   * fails when its facts source is empty; INV-9.4: missing required
   * facts remain fail-closed — the observation is completed, the
   * verdict is never weakened).
   */
  readonly environmentFacts?: () => Promise<readonly EnvironmentFact[]>
  /**
   * TCM vNext §15.5 (M2) — the narrow workspace attach port (the host
   * entry's closure over the hard-injected public `workspaceRegistry`
   * service). A v2 `team.create` carrying `workspace` resolves it through
   * this port BEFORE any durable effect and attaches the materialized
   * root session to it AFTER the bind + the Root agent start (plan §2.2).
   * Absent (factory worlds without the host entry): a v2 create carrying
   * `workspace` fails closed with the typed TEAM_CREATE_WORKSPACE_NOT_FOUND
   * (the path cannot be resolved without the registry).
   */
  readonly workspaceAttach?: WorkspaceAttachPort
  /**
   * TCM vNext §15.8 (M3) — the Root initial-work closure:
   * `withTeamLock` (the root's shared coordination chains) →
   * `enforceCompatibilityGate` (the existing single compatibility
   * authority, INSIDE the lock) → `executeRootInitialWorkLocked` (the
   * two-fact scanner + strategy). The ONE authority both Root initial-work
   * paths call: the v1 `team.create`'s `initialWork` and the v2
   * `team.admitInitialWork` command (plan §15.4 — the v1 create's initial
   * work re-routes through the same strategy; never the generic Member
   * follow-up). Absent (a live glue without the `deliverRootWork` port):
   * both paths fail closed with the typed TEAM_CREATE_ROOT_WORK_UNAVAILABLE
   * before any durable effect.
   */
  readonly admitRootInitialWork?: AdmitRootInitialWork
  /** The open TeamDomain repositories (the durable rows). */
  readonly repositories: TeamDomainRepositories
  /** The host blueprint catalog (the single bound blueprint). */
  readonly catalog: BlueprintCatalog
  /** The bound blueprint (policy-state closed set, template quota). */
  readonly blueprint: TeamBlueprint
  /** The bound leader's instance id (the leader authority). */
  readonly leaderInstanceId: string
  /** The projection service (durable source + the S6 overlay). */
  readonly projection: ProjectionService
  /** The TeamRuntime action facade (the ONLY admission authority). */
  readonly runtime: TeamRuntime
  /** The lifecycle service (the ONLY lifecycle authority). */
  readonly lifecycle: LifecycleService
  /** The mutation service (the ONLY PolicyState authority). */
  readonly mutationService: {
    switchPolicyState(request: {
      teamSessionId: TeamSessionId
      target: PolicyStateView
      actor: MutationActor
    }): PolicyStateTransitionRecord
  }
  /** The mutation store's transition rows (the durable PolicyState read). */
  readonly mutationTransitions: (teamSessionId: string) => readonly PolicyStateTransitionRecord[]
  /** The governance-override admission (the ONLY override authority). */
  readonly admitGovernanceOverride: (
    args: AdmitGovernanceOverrideArgs,
    store?: OverrideStorePort,
  ) => Promise<AdmittedGovernanceOverride>
  /** The durable override store (list/delete of the addressed record). */
  readonly overrideStore: OverrideStorePort
  /** The override record identity source (the durable `overrides` rows). */
  readonly overrideRecords: (rootSessionId: string) => readonly RemoteSafeRecord[]
  /** The root binding (fresh + cold). */
  readonly rootBinding: S6RootBindingPort
  /** The compatibility prober (the ONLY compatibility authority). */
  readonly compatibility: CompatibilityProber
  /** The handoff service (the ONLY handoff authority). */
  readonly handoff: HandoffService
  /**
   * The handoff prepare source producer (P8-S7-R4 A28 un-wiring): the
   * EXACTLY-ONE canonical surface freeze + the one-shot NON-MODEL
   * deterministic digest, returned as the remote-safe `summary` payload.
   * ABSENT → `handoff.prepare` fails closed exactly as before (the S5A
   * boot world and test worlds without the DSH session read service).
   */
  readonly handoffPrepare?: (sourceSessionId: string) => Promise<RemoteSafeRecord>
  /** The frozen legacy reader's operational entry. */
  readonly legacyInspect: LegacyInspectFn
  /** The legacy home port (ABSENT in the boot world: fail-closed). */
  readonly legacyHome: LegacyHomePort | undefined
  /** The installed A32 principal derivation (the seam's `current()`). */
  readonly principal: ServerPrincipalDerivation
  /**
   * The P6-T3 messaging coordinator (the live send path: facade admission
   * + the durable intent fact, LIVE delivery of the attributed input, the
   * confirmation fact). The `member.send` remote method routes through it
   * (T12-V16: the pre-fix admission-only facade call left every relay
   * intent undelivered until a `recoverPendingDeliveries` scan happened to
   * run — the T12 window latch of runs #5-#13).
   */
  readonly messaging: MessagingCoordinator
  /**
   * D-3 — the root (leader) agent start surface behind `team.create`:
   * starts (create-or-ensure, idempotent per rootSessionId) the real DSH
   * Agent for the created or retained root through the SAME glue port the
   * with-context handoff uses (`createRootAgent`). A fresh root has no
   * session artifact yet, so the port takes the `agents.create` path (the
   * validated handoff shape: the host owns the session — NO native root).
   * Absent (test worlds without a live glue): `team.create` fails closed
   * with a typed error — a created team must own a live leader, and a
   * remote that cannot start one must not pretend otherwise.
   */
  readonly startRootAgent?: (rootSessionId: string) => Promise<void>
  /**
   * D2 (Team D1-D6 repair v2, remote contract v3) — the Team-mode live
   * ensure behind the v3-only `team.ensureRootLive`: the live glue's
   * `ensureLiveAgent` (create-or-ensure on the persisted root WITH the
   * Team setup — A3 Q1 live-first: the upstream agent registry resolves
   * a live agent and reuses it, so a second agent under one root is
   * structurally impossible via the registry `enter()` collision).
   * Absent (test worlds without the live glue): `team.ensureRootLive`
   * fails closed with the typed TEAM_REMOTE_TEAM_ROOT_LIVE_PORT_UNAVAILABLE
   * — the same discipline as `startRootAgent` / `listRoots`. The
   * production host entry (root.ts) wires it; the port's rejections are
   * mapped by the handler onto the closed TEAM_REMOTE_TEAM_ROOT_LIVE_*
   * vocabulary (a TeamPluginError raised by the closure rethrows
   * unchanged, invariant 4a/4b).
   */
  readonly ensureRootLive?: (rootSessionId: string) => Promise<void>
  /**
   * F9 (F3/F11/F9/T1.4 repair round r1, remote contract v4) — the
   * durable control-service closure behind the v4-only
   * `team.resolveControl`: resolves ONE pending control request of the
   * addressed owned root through the EXISTING control-service authority
   * (A25: `CONTROL_RESOLVER_ROLES` + the durable exactly-once decision
   * semantics — unchanged; the wire is the command surface, never a
   * second authority). The `caller` argument is HOST-DERIVED (the T12-B4
   * trusted principal seam stamps the human operator of the addressed
   * root — never a client claim; the v4 wire carries no caller fields).
   * Absent (test worlds without the control-plane wiring):
   * `team.resolveControl` fails closed with the typed
   * TEAM_REMOTE_TEAM_RESOLVE_CONTROL_UNAVAILABLE — never a silent
   * success, never a default decision. The production host entry
   * (root.ts) wires it over the always-built A25 control service.
   */
  readonly resolveControl?: (args: {
    readonly rootSessionId: string
    readonly caller: ActionCaller
    readonly requestId: string
    readonly decision: 'allow' | 'deny'
    readonly note?: string
  }) => Promise<RemoteSafeRecord>
  /**
   * D1 (Team D1-D6 repair v2, remote contract v3) — the read-only
   * durable root ownership list behind the v3-only `team.listRoots`:
   * the host entry's closure over the already-injected TeamDomain
   * repositories (the D1 pure ownership-index module — see
   * `team-ownership-index.ts`; NO repository writes, NO agent effects).
   * Absent (test worlds without the TeamDomain wiring): `team.listRoots`
   * fails closed with the typed TEAM_REMOTE_TEAM_ROOTS_UNAVAILABLE —
   * never a silent empty list. The production host entry (root.ts)
   * wires it; a typed integrity failure raised by the closure propagates
   * unchanged through the dispatcher (invariant 4b).
   */
  readonly listRoots?: () => Promise<readonly TeamRootWireRow[]>
  /** The deterministic clock (ISO-8601). */
  readonly now: () => string
  /**
   * BP-G (issue #2 blueprint-loading, plan §12.2, optional additive): the
   * in-process read-only boot readiness getter. ABSENT (every pre-BP-G
   * world — factory roots, test worlds): the mounted dispatcher runs
   * unguarded (the legacy behavior, byte-for-byte). PRESENT: the mounted
   * dispatcher gates every closed method EXCEPT
   * REMOTE_READINESS_INDEPENDENT_METHODS (catalog.list / catalog.get) on
   * the state — a non-`ready` state answers the frozen `internal-error`
   * envelope (the route itself stays registered: the host mounts BEFORE
   * it awaits the live boot, plan §12.1; unknown endpoints are NOT
   * gated — they get the frozen UNKNOWN_METHOD either way, so the error
   * vocabulary stays state-invariant). The getter reads the CURRENT
   * state per call (the host's closure over its own state variable).
   */
  readonly readiness?: () => RemoteReadiness
}

// --- small local helpers ------------------------------------------------------------------

/** True for a plain (non-array, non-null) object. */
function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

/** A safe non-negative integer. */
function isSafeInt(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
}

/**
 * BC-03 / R1-A — the stable logical-operation token of one creation-time
 * work admission: the content hash of the initial work's canonical JSON.
 * The work chain's token protocol (closure plan §CR2) then makes a retried
 * `team.create` carrying the SAME initial work a replay/resume (zero
 * duplicate `team-work-admitted` facts), while a different payload is a
 * distinct logical operation (a fresh admission through the same gates).
 * The token scan is root-scoped, so identical payloads on different teams
 * never collide.
 */
function initialWorkRequestToken(initialWork: RemoteSafeRecord): string {
  return `team-create:initial-work:sha256:${sha256Hex(canonicalJsonStringify(initialWork))}`
}

/** Map the derived caller to the mutation authority (server-side). */
function authorityOf(caller: ActionCaller, leaderInstanceId: string): MutationAuthority {
  if (caller.kind === 'human') return { kind: 'operator' }
  if (caller.instanceId === leaderInstanceId) return { kind: 'leader' }
  return { kind: 'member', instanceId: caller.instanceId }
}

/** Map the derived caller to the mutation actor (server-side). */
function actorOf(
  caller: ActionCaller,
  rootSessionId: string,
  leaderInstanceId: string,
): MutationActor {
  if (caller.kind === 'human') return { kind: 'human' }
  if (caller.instanceId === leaderInstanceId) return { kind: 'leader' }
  return {
    kind: 'member',
    member: { rootSessionId: rootSessionId as TeamSessionId, instanceId: caller.instanceId as InstanceId },
  }
}

/** Map a blueprint template to its wire discovery record. */
function templateToRecord(template: BlueprintTemplate): RemoteSafeRecord {
  const record: Record<string, unknown> = { templateId: template.templateId, persona: template.persona }
  if (template.displayName !== undefined) record['displayName'] = template.displayName
  if (template.description !== undefined) record['description'] = template.description
  if (template.modelPreference !== undefined) record['modelPreference'] = template.modelPreference
  if (template.contextPolicy !== undefined) record['contextPolicy'] = template.contextPolicy
  return record as RemoteSafeRecord
}

/** Map a resolved blueprint to its wire discovery record. */
function blueprintToRecord(blueprint: TeamBlueprint): RemoteSafeRecord {
  const record: Record<string, unknown> = {
    schemaVersion: blueprint.schemaVersion,
    blueprintId: blueprint.blueprintId,
    revision: blueprint.revision,
    contentHash: blueprint.contentHash,
    leader: templateToRecord(blueprint.leader),
    members: [...blueprint.members.map((template) => templateToRecord(template))],
    requirements: [
      ...blueprint.requirements.map((requirement) => ({
        domain: requirement.domain,
        name: requirement.name,
        optional: requirement.optional,
      })),
    ],
    policyStates: [
      ...blueprint.policyStates.map((state) => {
        const stateRecord: Record<string, unknown> = { id: state.id, fields: [...state.fields] }
        if (state.description !== undefined) stateRecord['description'] = state.description
        return stateRecord
      }),
    ],
  }
  if (blueprint.displayName !== undefined) record['displayName'] = blueprint.displayName
  if (blueprint.description !== undefined) record['description'] = blueprint.description
  if (blueprint.quotas !== undefined) {
    const quotaOf = (quota: { maxInstances?: number; maxConcurrent?: number } | undefined) =>
      quota === undefined
        ? null
        : {
            maxInstances: quota.maxInstances ?? null,
            maxConcurrent: quota.maxConcurrent ?? null,
          }
    record['quotas'] = {
      team: quotaOf(blueprint.quotas.team),
      members: quotaOf(blueprint.quotas.members),
    }
  }
  return record as RemoteSafeRecord
}

/** The durable effect sequence of an admission outcome (the frozen rule, verbatim). */
function admissionEffectSequence(outcome: Record<string, unknown>): number | undefined {
  const effect = outcome['effect']
  if (effect === null || typeof effect !== 'object' || Array.isArray(effect)) return undefined
  const effectRecord = effect as Record<string, unknown>
  let candidate: unknown
  switch (typeof effectRecord['kind'] === 'string' ? effectRecord['kind'] : '') {
    case 'fact-recorded':
    case 'work-admitted':
    case 'lifecycle-changed':
      candidate = effectRecord['sequence']
      break
    case 'member-activated':
      candidate = effectRecord['ledgerSequence']
      break
    default:
      return undefined
  }
  if (typeof candidate === 'number' && Number.isSafeInteger(candidate)) {
    return candidate
  }
  return undefined
}

/** One ledger entry from a durable row (the frozen wire shape, field-by-field). */
function ledgerEntryWire(record: Record<string, unknown>): RemoteLedgerEntryValue {
  const schemaVersion = record['schemaVersion']
  const sequence = record['sequence']
  const rootSessionId = record['rootSessionId']
  const factType = record['factType']
  const payload = record['payload']
  const createdAt = record['createdAt']
  if (!isSafeInt(schemaVersion)) {
    throw new TeamPluginError(
      S6_REMOTE_ERROR_CODES.LEDGER_ENTRY_MALFORMED,
      `durable ledger entry carries a malformed schemaVersion (${String(schemaVersion)})`,
      { reason: 'malformed-schema-version' },
    )
  }
  if (!isSafeInt(sequence) || sequence < 1) {
    throw new TeamPluginError(
      S6_REMOTE_ERROR_CODES.LEDGER_ENTRY_MALFORMED,
      `durable ledger entry carries a malformed sequence (${String(sequence)})`,
      { reason: 'malformed-sequence' },
    )
  }
  if (typeof rootSessionId !== 'string' || rootSessionId.length === 0) {
    throw new TeamPluginError(
      S6_REMOTE_ERROR_CODES.LEDGER_ENTRY_MALFORMED,
      'durable ledger entry carries a malformed rootSessionId',
      { reason: 'malformed-root-session-id' },
    )
  }
  if (typeof factType !== 'string' || factType.length === 0) {
    throw new TeamPluginError(
      S6_REMOTE_ERROR_CODES.LEDGER_ENTRY_MALFORMED,
      'durable ledger entry carries a malformed factType',
      { reason: 'malformed-fact-type' },
    )
  }
  if (!isPlainRecord(payload)) {
    throw new TeamPluginError(
      S6_REMOTE_ERROR_CODES.LEDGER_ENTRY_MALFORMED,
      'durable ledger entry carries a malformed payload',
      { reason: 'malformed-payload' },
    )
  }
  if (typeof createdAt !== 'string' || createdAt.length === 0) {
    throw new TeamPluginError(
      S6_REMOTE_ERROR_CODES.LEDGER_ENTRY_MALFORMED,
      'durable ledger entry carries a malformed createdAt',
      { reason: 'malformed-created-at' },
    )
  }
  const operationId = record['operationId']
  return {
    schemaVersion,
    sequence,
    rootSessionId,
    factType,
    payload: payload as RemoteSafeRecord,
    operationId: operationId === undefined ? null : (operationId as string),
    createdAt,
  }
}

/**
 * The durable PolicyState read (the mutation store's transition rows).
 *
 * The remote read evaluates at the far-future step: it reports the state of
 * the LATEST durable transition (or the default state when the store is
 * empty). The production step clock is pinned to 0 (the step model advances
 * with the work chain, not with explicit transitions), so evaluating at
 * step 0 would hide every explicit transition from the remote read
 * permanently — the client must read back the state it set.
 */
function policyStateReadOf(
  transitions: readonly PolicyStateTransitionRecord[],
  atStep: number,
): PolicyStateView {
  return activePolicyState(transitions, atStep)
}

/** The compatibility verdict of one durable state record (defensive read). */
function compatibilityCurrentOf(state: Record<string, unknown>): RemoteSafeRecord {
  const status = state['status']
  const fingerprint = state['fingerprint']
  const generation = state['generation']
  const computedAt = state['computedAt']
  const outcomes = state['outcomes']
  if (
    typeof status !== 'string' ||
    typeof fingerprint !== 'string' ||
    !isSafeInt(generation) ||
    typeof computedAt !== 'string' ||
    !isPlainRecord(outcomes)
  ) {
    throw new TeamPluginError(
      S6_REMOTE_ERROR_CODES.COMPATIBILITY_STATE_MALFORMED,
      'the durable compatibility state is structurally malformed',
      { reason: 'malformed-state' },
    )
  }
  const counts = outcomes['counts']
  if (
    !isPlainRecord(counts) ||
    !isSafeInt(counts['pass']) ||
    !isSafeInt(counts['warning']) ||
    !isSafeInt(counts['fatal']) ||
    !isSafeInt(counts['unackedWarning']) ||
    !isSafeInt(counts['staleAcknowledgement'])
  ) {
    throw new TeamPluginError(
      S6_REMOTE_ERROR_CODES.COMPATIBILITY_STATE_MALFORMED,
      'the durable compatibility state carries a malformed counts block',
      { reason: 'malformed-counts' },
    )
  }
  return {
    status,
    environmentFingerprint: fingerprint,
    generation,
    recordedAt: computedAt,
    counts: {
      pass: counts['pass'],
      warning: counts['warning'],
      fatal: counts['fatal'],
      unackedWarning: counts['unackedWarning'],
      staleAcknowledgement: counts['staleAcknowledgement'],
    },
  }
}

// --- T1.4-B the strict probe/gate fact merge (U5 / T1-B, CF2 entry 2) -----------------------

/**
 * T1.4-B (U5/T1-B strict, CF2 entry 2) — the strict probe/gate fact
 * merge (INV-9.4: the probe and the admission gate evaluate the SAME
 * world — "complete the observation, never weaken the verdict"):
 *
 * - every domain EXCEPT `persona` comes exclusively from the host
 *   row-config facts — the same injected source the post-creation
 *   admission gate consumes. The caller's capability claims (any
 *   non-persona fact on the wire) are DISCARDED: the wire channel
 *   cannot self-attest the environment (the fact-forgery hole closed —
 *   a caller claiming `mcpServer/X available: true` against an
 *   unavailable host row changes nothing, and a caller denying an
 *   available host capability changes nothing either; CR-4 discipline:
 *   a claim is input, never authority);
 * - the `persona` domain is driven by the caller's selected preset
 *   (the explicit user intent): the row's persona fact is the
 *   deployment default and yields to the explicit selection. When the
 *   two diverge against a required persona, the probe is strictly
 *   STRICTER than the gate (it refuses a creation the gate would
 *   admit) — the documented safe direction (U5 nuance); the §7.4
 *   complete:true preset-conflict semantics are untouched. A caller
 *   without persona facts sees an EMPTY persona world (fail-closed —
 *   identical to the pre-T1.4 pure-caller evaluation).
 *
 * The merge never creates a duplicate (domain, subject) pair across the
 * two halves (persona subjects come from the caller only; every other
 * subject from the host only), so the engine's duplicate-fact
 * validation fires on the merged world exactly as it fired pre-T1.4 on
 * the caller's own list — the wire validation behavior is unchanged.
 *
 * Pure: no I/O, no mutation (returns a new array; the inputs —
 * deep-frozen domain facts — are never touched).
 *
 * @param hostFacts - the authoritative host row-config facts.
 * @param callerFacts - the caller's (already-validated) wire facts.
 * @returns the merged environment fact list for the probe evaluation.
 */
export function mergeProbeEnvironmentFacts(
  hostFacts: readonly EnvironmentFact[],
  callerFacts: readonly EnvironmentFact[],
): readonly EnvironmentFact[] {
  return [
    ...callerFacts.filter((fact) => fact.domain === 'persona'),
    ...hostFacts.filter((fact) => fact.domain !== 'persona'),
  ]
}

// --- the port builders ---------------------------------------------------------------------

/**
 * Build the thirteen production remote ports over the host's owned roots
 * (the bound root + any TeamSession root the host durably owns — P9-S8:
 * teams created after boot through `team.create` / `handoff.create` are
 * servable by this same remote; the frozen twelve + the T12-V16 messaging
 * coordinator port).
 *
 * Every port asserts the bound-root guard first (the foreign-team guard —
 * the A32 seam re-asserts it for the claim-carrying methods; the other
 * methods assert it here, so NO team-scoped remote method can address a
 * TeamSession this host does not own). Every authority call goes to the runtime facade; the
 * ports themselves perform no repository writes except the single
 * `override.reset` deletion of the ADDRESS-RESOLVED record (the reset
 * authority: the admission's identity resolution + the durable delete —
 * the mutation admission is the set authority, the delete is the
 * audit-preserving revoke the frozen contract names).
 * @param options - the root-bound inputs.
 * @returns the thirteen ports.
 */
export function createS6RemotePorts(options: S6RemoteOptions): S6RemotePorts {
  const { rootSessionId, repositories, catalog, blueprint, leaderInstanceId, now, isOwnedRoot } = options

  /** The bound-root guard's acceptance: the bound root OR a durably owned
   *  root (P9-S8 — a team created after boot by this host). Without the
   *  predicate (single-root fixtures) this is the T12 bound-root-only
   *  check. */
  function ownsRoot(teamSessionId: string): boolean {
    return teamSessionId === rootSessionId || (isOwnedRoot?.(teamSessionId) ?? false)
  }

  function assertBoundRoot(method: string, teamSessionId: unknown): string {
    if (typeof teamSessionId !== 'string' || !ownsRoot(teamSessionId)) {
      throw new TeamPluginError(
        S6_PRINCIPAL_ERROR_CODES.FOREIGN_TEAM,
        `remote method '${method}' addresses TeamSession '${String(teamSessionId)}' which this host does not own (bound root '${rootSessionId}')`,
        { reason: 'foreign-team', requested: String(teamSessionId), bound: rootSessionId },
      )
    }
    return teamSessionId
  }

  function resolveBlueprint(blueprintId: string, revision: number | undefined): TeamBlueprint {
    if (revision === undefined) return catalog.resolveLatest(blueprintId)
    if (!Number.isSafeInteger(revision)) {
      throw new TeamPluginError(
        S6_REMOTE_ERROR_CODES.CATALOG_REVISION_MALFORMED,
        `blueprint revision '${String(revision)}' is not a safe integer`,
        { reason: 'malformed-revision', blueprintId },
      )
    }
    return catalog.resolve(blueprintId, String(revision))
  }

  // P9-S8 (F1-lite v3): filter by the ASSERTED addressed root — the bound
  // root alone would serve the boot team's ledger to every host-owned team.
  function rootLedgerEntries(addressedRoot: string): readonly Record<string, unknown>[] {
    return repositories.ledger
      .list()
      .filter((entry) => entry.rootSessionId === addressedRoot) as unknown as readonly Record<string, unknown>[]
  }

  /**
   * D-3 — the fail-closed `team.create` preflight: the created or
   * retained root must own a LIVE leader agent (the team tools, the
   * leader persona, the leader model), started through the SAME glue
   * port the with-context handoff uses (`createRootAgent`). Runs BEFORE
   * any durable effect (the handoff preflight discipline: a failed
   * preflight leaves no partial team).
   */
  function requireStartRootAgentPort(): (rootSessionId: string) => Promise<void> {
    const port = options.startRootAgent
    if (port === undefined) {
      throw new TeamPluginError(
        S6_REMOTE_ERROR_CODES.TEAM_CREATE_ROOT_START_UNAVAILABLE,
        'team.create cannot start the root (leader) agent: the live glue does not provide the createRootAgent port; a created team must own a live leader — failing closed before any durable effect',
        { reason: 'root-start-unavailable' },
      )
    }
    return port
  }

  /**
   * D-3 — the root (leader) agent start behind `team.create` (the
   * create-or-ensure, idempotent per rootSessionId). A port rejection is
   * typed: the durable bind already landed, the team row stays durable,
   * and the retry (cold path) re-drives the start.
   */
  async function startRootAgent(rootSessionId: string): Promise<void> {
    try {
      await requireStartRootAgentPort()(rootSessionId)
    } catch (error) {
      if (error instanceof TeamPluginError) throw error
      throw new TeamPluginError(
        S6_REMOTE_ERROR_CODES.TEAM_CREATE_ROOT_START_FAILED,
        `team.create: starting the root (leader) agent for '${rootSessionId}' failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
        { reason: 'root-start-failed' },
      )
    }
  }

  /**
   * D1 (Team D1-D6 repair v2, remote contract v3) — the fail-closed
   * `team.listRoots` preflight: the host wiring must expose the
   * read-only durable root ownership list. Absent → the typed
   * TEAM_REMOTE_TEAM_ROOTS_UNAVAILABLE BEFORE any read (never a silent
   * empty list). A typed integrity failure the closure raises (the D1
   * index's TEAM_OWNERSHIP_INDEX_* codes, the storage layer's
   * RECORD_INVALID / MALFORMED_DTO) is rethrown UNMAPPED (invariant 4b
   * pass-through); only an untyped throw is re-wrapped as the same
   * unavailable code with the message preserved for diagnosis.
   */
  function requireListRootsPort(): () => Promise<readonly TeamRootWireRow[]> {
    const port = options.listRoots
    if (port === undefined) {
      throw new TeamPluginError(
        S6_REMOTE_ERROR_CODES.TEAM_ROOTS_UNAVAILABLE,
        'team.listRoots cannot read the durable root ownership list: the host wiring does not provide the listRoots port — failing closed (never a silent empty list)',
        { reason: 'team-roots-unavailable' },
      )
    }
    return port
  }

  async function listRoots(): Promise<readonly TeamRootWireRow[]> {
    try {
      return await requireListRootsPort()()
    } catch (error) {
      if (error instanceof TeamPluginError) throw error
      // A typed non-TeamPluginError whose string code is a member of the
      // closed backing vocabulary (the D1 index's TEAM_OWNERSHIP_INDEX_*
      // codes, the storage layer's RECORD_INVALID / MALFORMED_DTO, …)
      // propagates UNMAPPED (invariant 4b — the dispatcher passes code +
      // message through). Only a genuinely untyped throw is re-wrapped.
      const code = error instanceof Error ? (error as Error & { readonly code?: unknown }).code : undefined
      if (typeof code === 'string' && REMOTE_BACKING_ERROR_CODE_SET.has(code)) {
        throw error
      }
      throw new TeamPluginError(
        S6_REMOTE_ERROR_CODES.TEAM_ROOTS_UNAVAILABLE,
        `team.listRoots failed while reading the durable root ownership list: ${
          error instanceof Error ? error.message : String(error)
        }`,
        { reason: 'team-roots-unavailable' },
      )
    }
  }

  /**
   * D2 (Team D1-D6 repair v2, remote contract v3) — the fail-closed
   * `team.ensureRootLive` preflight: the host wiring must expose the
   * Team-mode live ensure (the live glue's `ensureLiveAgent`). Absent →
   * the typed TEAM_REMOTE_TEAM_ROOT_LIVE_PORT_UNAVAILABLE BEFORE any
   * agent effect (the `startRootAgent` / `listRoots` discipline mirrored).
   */
  function requireEnsureRootLivePort(): (rootSessionId: string) => Promise<void> {
    const port = options.ensureRootLive
    if (port === undefined) {
      throw new TeamPluginError(
        S6_REMOTE_ERROR_CODES.TEAM_ROOT_LIVE_PORT_UNAVAILABLE,
        'team.ensureRootLive cannot ensure the root live: the host wiring does not provide the ensureRootLive port — failing closed before any agent effect',
        { reason: 'team-root-live-port-unavailable' },
      )
    }
    return port
  }

  /**
   * D2 (A3 Q2) — the typed mapping of the `ensureRootLive` port's
   * rejections onto the closed TEAM_REMOTE_TEAM_ROOT_LIVE_* vocabulary:
   * (b) the upstream registry collision (`agent "<id>" is already
   * registered` — the core/agent `enter()` boundary: a session already
   * live OUTSIDE the Team glue) → OUTSIDE_TEAM (fail closed, never a
   * silent adoption); (c) the glue's no-durable-artifact rejection
   * (`neither live nor durable`) → NO_DURABLE_ARTIFACT; (d) every other
   * glue failure → START_FAILED (the message preserved for diagnosis).
   * A TeamPluginError raised by the closure itself rethrows unchanged
   * (invariant 4a/4b — the caller maps it).
   */
  function mapEnsureRootLiveError(error: unknown, teamSessionId: string): TeamPluginError {
    const message = error instanceof Error ? error.message : String(error)
    if (/^agent ".+" is already registered$/.test(message)) {
      return new TeamPluginError(
        S6_REMOTE_ERROR_CODES.TEAM_ROOT_LIVE_OUTSIDE_TEAM,
        `team.ensureRootLive: session '${teamSessionId}' is already live outside the Team glue (the upstream agent registry refuses a second agent under one session id) — refusing to adopt it silently`,
        { reason: 'team-root-live-outside-team', teamSessionId },
      )
    }
    if (message.includes('neither live nor durable')) {
      return new TeamPluginError(
        S6_REMOTE_ERROR_CODES.TEAM_ROOT_LIVE_NO_DURABLE_ARTIFACT,
        `team.ensureRootLive: session '${teamSessionId}' has no durable session artifact and is not live — the Team-mode ensure cannot resume it: ${message}`,
        { reason: 'team-root-live-no-durable-artifact', teamSessionId },
      )
    }
    return new TeamPluginError(
      S6_REMOTE_ERROR_CODES.TEAM_ROOT_LIVE_START_FAILED,
      `team.ensureRootLive: the Team-mode ensure of '${teamSessionId}' failed: ${message}`,
      { reason: 'team-root-live-start-failed', teamSessionId },
    )
  }

  /**
   * D2 (Team D1-D6 repair v2, remote contract v2→v3) — the v3-only
   * `team.ensureRootLive` port body (A3 Q2): the bound-root guard runs
   * FIRST (fail-closed FOREIGN_TEAM), then the host's Team-mode ensure
   * (the live glue's `ensureLiveAgent`, live-first — the upstream
   * `resolve()` reuses a live agent, so a second agent under one root is
   * structurally impossible). Success resolves to the closed v3 shape
   * `{ rootSessionId, mode: "team", live: true }`; a port rejection is
   * mapped by {@link mapEnsureRootLiveError} (TeamPluginError rethrows
   * unchanged). The durable root row is never touched.
   */
  async function ensureRootLive(requestedTeamSessionId: string): Promise<RemoteSafeRecord> {
    const teamSessionId = assertBoundRoot('team.ensureRootLive', requestedTeamSessionId)
    try {
      await requireEnsureRootLivePort()(teamSessionId)
    } catch (error) {
      if (error instanceof TeamPluginError) throw error
      throw mapEnsureRootLiveError(error, teamSessionId)
    }
    return { rootSessionId: teamSessionId, mode: 'team', live: true }
  }

  /**
   * F9 (F3/F11/F9/T1.4 repair round r1, remote contract v4) — the v4-only
   * `team.resolveControl` port body: the bound-root guard runs FIRST
   * (fail-closed FOREIGN_TEAM — before any decision), then the host's
   * control-service closure (the EXISTING A25 authority:
   * `CONTROL_RESOLVER_ROLES` + the durable exactly-once decision
   * semantics — UNCHANGED; the wire is the command surface, never a
   * second authority). The `caller` argument is HOST-DERIVED (the T12-B4
   * trusted principal seam stamps `{ kind: 'human', humanId: <owned
   * teamSessionId> }` — never a client claim; the v4 wire carries no
   * caller/role fields, adjudication U3). A missing closure fails closed
   * with the typed TEAM_REMOTE_TEAM_RESOLVE_CONTROL_UNAVAILABLE (before
   * any decision — never a silent success, never a default decision).
   * The service's closed CONTROL_* rejections (the facade-reused
   * TeamRuntimeError codes + the control service's ControlError codes)
   * propagate UNCHANGED — invariant 4b (every resolveControl-reachable
   * code is a member of the closed backing vocabulary).
   */
  async function resolveControl(
    requestedTeamSessionId: string,
    requestId: string,
    decision: 'allow' | 'deny',
    note: string | undefined,
    caller: ActionCaller,
  ): Promise<RemoteSafeRecord> {
    const teamSessionId = assertBoundRoot('team.resolveControl', requestedTeamSessionId)
    const port = options.resolveControl
    if (port === undefined) {
      throw new TeamPluginError(
        S6_REMOTE_ERROR_CODES.TEAM_RESOLVE_CONTROL_UNAVAILABLE,
        'team.resolveControl cannot resolve the control request: the host wiring does not provide the control-service closure — failing closed before any decision',
        { reason: 'team-resolve-control-unavailable', teamSessionId },
      )
    }
    return port({
      rootSessionId: teamSessionId,
      caller,
      requestId,
      decision,
      ...(note !== undefined ? { note } : {}),
    })
  }

  // --- TCM vNext §15 (G1) — the Root initial-work authority + the workspace port ---

  /**
   * TCM vNext §15.8 — the fail-closed preflight of BOTH Root initial-work
   * paths (the v1 create's `initialWork` + the v2 `team.admitInitialWork`):
   * the production root must expose the Root initial-work closure (the
   * plan §15.8 closure — shared coordination chains + the single
   * compatibility gate + the two-fact scanner). Runs BEFORE any durable
   * effect (a failed preflight leaves no partial team).
   */
  function requireAdmitRootInitialWorkPort(): AdmitRootInitialWork {
    const admit = options.admitRootInitialWork
    if (admit === undefined) {
      throw new TeamPluginError(
        S6_REMOTE_ERROR_CODES.TEAM_CREATE_ROOT_WORK_UNAVAILABLE,
        'the production root exposes no Root initial-work authority (the live glue does not provide the deliverRootWork port) — the creation-time initial work is fail-closed before any durable effect',
        { reason: 'root-work-unavailable' },
      )
    }
    return admit
  }

  /**
   * TCM vNext §15.6 — map the Root initial-work strategy's closed runtime
   * codes onto the wire vocabulary the M1 closed backing set established
   * for the TCM team-create v2 surface. The dispatcher passes a typed
   * code through ONLY when its string `code` is a member of the closed
   * backing set (invariant 4b) — anything else degrades to
   * `internal-error`. The strategy's OTHER codes (REQUEST_MALFORMED /
   * COMPATIBILITY_BLOCKED / INITIAL_WORK_ALREADY_ADMITTED /
   * DURABLE_WRITE_FAILED) are already members of the closed set and pass
   * through unchanged.
   */
  function mapRootWorkError(error: unknown): never {
    if (error instanceof TeamRuntimeError) {
      switch (error.code) {
        case TEAM_RUNTIME_ERROR_CODES.ROOT_WORK_PAYLOAD_MISMATCH:
          throw new TeamPluginError(
            S6_REMOTE_ERROR_CODES.TEAM_CREATE_ROOT_WORK_PAYLOAD_MISMATCH,
            error.message,
            error.details !== undefined ? { ...error.details } : undefined,
          )
        case TEAM_RUNTIME_ERROR_CODES.WORK_DELIVERY_FAILED:
          throw new TeamPluginError(
            S6_REMOTE_ERROR_CODES.TEAM_CREATE_ROOT_WORK_DELIVERY_FAILED,
            error.message,
            error.details !== undefined ? { ...error.details } : undefined,
          )
        default:
          throw error
      }
    }
    throw error
  }

  /**
   * TCM vNext §15.8 (G1) — the ONE call site of the Root initial-work
   * authority (both the v1 create's `initialWork` and the v2
   * `team.admitInitialWork` route here): the preflight + the closure call
   * + the closed wire-code mapping (plan §15.4: the v1 single-call
   * initialWork re-routes through the SAME strategy; never the generic
   * Member follow-up on `inst-leader`).
   */
  async function admitRootWorkMapped(args: RootInitialWorkArgs): Promise<RootInitialWorkResult> {
    const admit = requireAdmitRootInitialWorkPort()
    try {
      return await admit(args)
    } catch (error) {
      mapRootWorkError(error)
    }
  }

  /**
   * TCM vNext §15.4 — the v1 `initialWork` record is a free-form lossless
   * client payload; the Root strategy consumes its `prompt` (a non-empty
   * string — the frozen v1 behavior: a missing/blank prompt rejects with
   * the existing TEAM_RUNTIME_REQUEST_MALFORMED pass-through, BEFORE any
   * durable effect) and its optional `attachedContext` (a non-empty
   * string; any other shape is treated as ABSENT — the record's
   * free-form fields are not part of the plan §15.7 durable
   * representation).
   */
  function rootWorkFromInitialWork(initialWork: RemoteSafeRecord): {
    readonly prompt: string
    readonly attachedContext?: string
  } {
    const prompt = initialWork['prompt']
    if (typeof prompt !== 'string' || prompt.length === 0) {
      throw new TeamPluginError(
        TEAM_RUNTIME_ERROR_CODES.REQUEST_MALFORMED,
        'the initialWork record carries no non-empty string prompt (the creation-time initial work is prompt-bearing content)',
        { reason: 'initial-work-malformed' },
      )
    }
    const attachedContext = initialWork['attachedContext']
    return {
      prompt,
      ...(typeof attachedContext === 'string' && attachedContext.length > 0
        ? { attachedContext }
        : {}),
    }
  }

  /**
   * TCM vNext §15.5 — resolve the v2 `workspace` request path through the
   * narrow workspace attach port (the host's closure over the public
   * workspace registry). EVERY resolution failure is the typed
   * TEAM_CREATE_WORKSPACE_NOT_FOUND (the upstream reason is preserved in
   * the message) — a missing path, an existing unowned directory, and a
   * world without the port all resolve to the same closed code. Runs
   * BEFORE any durable effect (plan §2.2: typed rejection before bind).
   */
  async function resolveRequestedWorkspace(
    workspace: string,
  ): Promise<{ readonly workspaceId: string; readonly canonicalPath: string }> {
    const port = options.workspaceAttach
    if (port === undefined) {
      throw new TeamPluginError(
        S6_REMOTE_ERROR_CODES.TEAM_CREATE_WORKSPACE_NOT_FOUND,
        `no workspace is registered for path "${workspace}" (this production root carries no workspace attach port — the path cannot be resolved)`,
        { reason: 'workspace-attach-port-unavailable' },
      )
    }
    try {
      const resolution = await port.resolvePath(workspace)
      return { workspaceId: resolution.workspaceId, canonicalPath: resolution.path }
    } catch (error) {
      throw new TeamPluginError(
        S6_REMOTE_ERROR_CODES.TEAM_CREATE_WORKSPACE_NOT_FOUND,
        error instanceof Error ? error.message : String(error),
        { reason: 'workspace-not-found' },
      )
    }
  }

  /**
   * TCM vNext §15.5 — the public `Workspace.attachSession` drive (AFTER
   * the durable bind + the Root agent start — the plan §2.2 creation
   * order). EVERY upstream attach rejection is the typed
   * TEAM_CREATE_WORKSPACE_ATTACH_FAILED (the durable bind stays durable:
   * the typed retryable failure — the retry re-drives the attach, which
   * is idempotent upstream).
   */
  async function attachWorkspaceSession(workspaceId: string, rootSessionId: string): Promise<void> {
    const port = options.workspaceAttach
    if (port === undefined) {
      // Unreachable (resolveRequestedWorkspace gates it) — fail closed anyway.
      throw new TeamPluginError(
        S6_REMOTE_ERROR_CODES.TEAM_CREATE_WORKSPACE_ATTACH_FAILED,
        'the production root carries no workspace attach port — the attach cannot run',
        { reason: 'workspace-attach-port-unavailable' },
      )
    }
    try {
      await port.attachSession(workspaceId, rootSessionId)
    } catch (error) {
      throw new TeamPluginError(
        S6_REMOTE_ERROR_CODES.TEAM_CREATE_WORKSPACE_ATTACH_FAILED,
        error instanceof Error ? error.message : String(error),
        { reason: 'workspace-attach-failed' },
      )
    }
  }

  /**
   * TCM vNext §15.8 (G1) — the gate blueprint of the TARGET team (the v2
   * `team.admitInitialWork` is team-scoped: the created team already
   * exists): the durable TeamSession's bound snapshot ref resolved
   * through the catalog. A content hash the catalog cannot reproduce is
   * the existing typed blueprint mismatch (fail-closed before the gate).
   */
  function resolveTargetBlueprint(rootSessionId: string): TeamBlueprint {
    const row = repositories.teamSessions.get(rootSessionId)
    if (row === undefined) {
      // Unreachable behind assertBoundRoot — fail closed anyway.
      throw new TeamPluginError(
        TEAM_RUNTIME_ERROR_CODES.TEAM_SESSION_NOT_FOUND,
        `no durable TeamSession for root "${rootSessionId}" — team.admitInitialWork addresses an existing team`,
        { reason: 'team-session-not-found' },
      )
    }
    const snapshot = row.blueprint
    const resolved = resolveBlueprint(String(snapshot.blueprintId), Number(snapshot.revision))
    if (String(resolved.contentHash) !== String(snapshot.contentHash)) {
      throw new TeamPluginError(
        S6_REMOTE_ERROR_CODES.TEAM_CREATE_BLUEPRINT_MISMATCH,
        `the durable TeamSession of root "${rootSessionId}" carries blueprint '${String(snapshot.blueprintId)}' (revision '${String(snapshot.revision)}') with a content hash the catalog cannot reproduce`,
        { reason: 'blueprint-hash-mismatch' },
      )
    }
    return resolved
  }

  return {
    // --- 1/12 catalog: host catalog discovery (read-only) ---------------------------
    catalog: {
      async list(): Promise<readonly RemoteSafeRecord[]> {
        const rows: RemoteSafeRecord[] = []
        for (const blueprintId of catalog.blueprintIds) {
          const revisions = catalog.listRevisions(blueprintId).map((revision) => {
            const value = Number(revision)
            if (!Number.isSafeInteger(value)) {
              throw new TeamPluginError(
                S6_REMOTE_ERROR_CODES.CATALOG_REVISION_MALFORMED,
                `blueprint '${blueprintId}' carries a malformed revision '${revision}'`,
                { reason: 'malformed-revision', blueprintId, revision },
              )
            }
            return value
          })
          rows.push({ blueprintId, revisions })
        }
        return rows
      },
      async get(blueprintId: string, blueprintRevision?: number): Promise<RemoteSafeRecord> {
        return blueprintToRecord(resolveBlueprint(blueprintId, blueprintRevision))
      },
    },

    // --- 2/12 intent: the host-completed pre-creation probe (T1.4-B) ------------
    // INV-9.4 — the probe and the post-creation admission gate evaluate the
    // SAME world: the authoritative host row-config facts (the same
    // injected source the gate consumes — options.environmentFacts),
    // completed with the caller's wire facts under the strict U5 rule
    // ({@link mergeProbeEnvironmentFacts}: the caller contributes ONLY the
    // persona domain — the selected preset is the explicit user intent;
    // every other domain is host-only, caller capability claims
    // discarded — the fact-forgery hole closed). The wire shape is
    // UNCHANGED (the v1 method, same params, same result shape); the
    // caller list is validated with the EXACT frozen engine parser first
    // (malformed caller facts still fail loud MALFORMED_DTO, exactly as
    // pre-T1.4). Required → FATAL (no downgrade, no Continue-anyway),
    // optional → WARNING + the explicit ack path, missing host fact →
    // unavailable → fail-closed: all preserved (Architecture §27.2,
    // invariant 47).
    intent: {
      async probe(
        blueprintId: string,
        blueprintRevision: number | undefined,
        environmentFacts: readonly RemoteSafeRecord[],
      ): Promise<RemoteSafeRecord> {
        const resolved = resolveBlueprint(blueprintId, blueprintRevision)
        const callerFacts = parseEnvironmentFacts(environmentFacts)
        const hostFacts = (await options.environmentFacts?.()) ?? []
        const result = evaluateCompatibility({
          requirements: compatibilityRequirementsOf(resolved),
          environmentFacts: mergeProbeEnvironmentFacts(hostFacts, callerFacts),
        })
        return result as unknown as RemoteSafeRecord
      },
    },

    // --- 3/12 teamCreate: the root binding (fresh or cold), v1 -----------------------
    teamCreate: {
      async create(
        requestedRootSessionId: string,
        blueprintId: string,
        blueprintRevision: number | undefined,
        initialWork: RemoteSafeRecord | undefined,
      ): Promise<RemoteSafeRecord> {
        // P9-S8 — team.create is the CREATION method: the bound-root guard
        // does not apply to it. The requested root is either NEW (the
        // client's minted id — the standard UI flow, UI §4.3: fresh bind,
        // the host creates and then OWNS the team) or already host-OWNED
        // (the cold rehydrate path — the durable row's bound snapshot must
        // match, enforced below). The frozen request parser already
        // validated the id shape. CR-4 is preserved: creation is a
        // host-authority operation (blueprint snapshot, uniqueness,
        // admission all host-validated) and grants NO authority over
        // existing teams — every other team-scoped method still asserts
        // ownership.
        // D-3 — the fail-closed preflight: the created or retained root must
        // own a LIVE leader agent (the team tools, the leader persona, the
        // leader model) started through the glue's createRootAgent port.
        // Absent port → typed UNAVAILABLE BEFORE any durable effect (no
        // partial team; the handoff preflight discipline).
        requireStartRootAgentPort()
        const resolved = resolveBlueprint(blueprintId, blueprintRevision)
        // TCM vNext §15.4 (G1): the creation-time initial work is admitted
        // through the SAME Root-specific authority the v2
        // `team.admitInitialWork` command uses (the plan §15.8 closure —
        // the shared coordination chains + the single compatibility gate +
        // the two-fact scanner). It NEVER runs the generic Member
        // `follow-up` on `inst-leader` (that chain needs a durable Leader
        // member record + a childSessionId + the member-lifecycle-changed
        // settlement the honest Leader v2 must not carry — the original
        // TEAM_RUNTIME_WORK_STATE_REJECTED symptom). The v1 wire contract
        // is preserved: the same closed fields, the same reply shape, the
        // same timing (admitted before the RPC returns), and the frozen
        // malformed-prompt behavior (REQUEST_MALFORMED, before any durable
        // effect).
        const initialWorkTarget =
          initialWork !== undefined
            ? {
                work: rootWorkFromInitialWork(initialWork),
                caller: resolveCaller(
                  repositories,
                  requestedRootSessionId,
                  await options.principal({
                    method: 'team.create',
                    request: {
                      version: REMOTE_CONTRACT_VERSION,
                      params: {
                        rootSessionId: requestedRootSessionId,
                        blueprintId,
                        ...(blueprintRevision !== undefined ? { blueprintRevision } : {}),
                        initialWork,
                      },
                    },
                  }),
                ),
                // BC-03 / R1-A — the stable logical-operation token of one
                // creation-time work admission: the content hash of the
                // initial work's canonical JSON. A retried create carrying
                // the SAME initial work is a replay/resume (zero duplicate
                // admission facts), a different payload is a distinct
                // logical operation.
                requestToken: initialWorkRequestToken(initialWork),
              }
            : undefined
        // A create carrying initialWork needs the Root work authority too
        // (BEFORE any durable effect — the C1e no-partial-creation rule).
        if (initialWorkTarget !== undefined) requireAdmitRootInitialWorkPort()
        // P9-S8 — the durable-row check addresses the REQUESTED root (a
        // NEW root has no row → the fresh path; an already-owned root →
        // the cold path with the snapshot match above).
        const durableRow = repositories.teamSessions.get(requestedRootSessionId)
        let result: RootBindingResult
        if (durableRow !== undefined) {
          // The cold path: the durable row's bound snapshot is the truth;
          // a request naming a different snapshot is a foreign intent.
          if (
            durableRow.blueprint.blueprintId !== resolved.blueprintId ||
            (blueprintRevision !== undefined &&
              Number(durableRow.blueprint.revision) !== blueprintRevision)
          ) {
            throw new TeamPluginError(
              S6_REMOTE_ERROR_CODES.TEAM_CREATE_BLUEPRINT_MISMATCH,
              `team.create names blueprint '${resolved.blueprintId}' (revision ${String(blueprintRevision ?? 'latest')}) but the bound TeamSession carries '${durableRow.blueprint.blueprintId}' (revision '${durableRow.blueprint.revision}')`,
              { reason: 'blueprint-mismatch' },
            )
          }
          result = await options.rootBinding.rehydrateCold({ rootSessionId: requestedRootSessionId as TeamSessionId })
        } else {
          result = await options.rootBinding.bindFresh({
            rootSessionId: requestedRootSessionId as TeamSessionId,
            blueprint: {
              blueprintId: resolved.blueprintId,
              revision: resolved.revision,
              contentHash: resolved.contentHash,
            },
            // P9-S8 — inherit the host default workspace (the projection
            // fold resolves the created team's effective workspace against
            // it; the team is host-scoped, so the host default IS the
            // team default).
            ...(options.defaultWorkspace !== undefined
              ? { defaultWorkspace: options.defaultWorkspace }
              : {}),
          })
        }
        // D-3 — the created/retained root must own a LIVE leader agent:
        // start it (create-or-ensure) BEFORE any initial work delivery —
        // the delivery admits work to the live leader, and a fresh root
        // has no session artifact yet (the port takes the `agents.create`
        // path, the validated handoff shape: the host owns the session,
        // NO native root). The durable bind already landed: a start
        // failure is typed, the team row stays durable, and the retry
        // (cold path) re-drives the start.
        await startRootAgent(requestedRootSessionId)
        // TCM vNext §15.4 (G1) — AFTER the bind + the start, the Root
        // initial work runs the plan §15.8 closure (lock → gate →
        // two-fact scanner → the live Root input seam); the gate's
        // blueprint input is the create's resolved snapshot (the cold
        // path verified it against the durable row above).
        if (initialWorkTarget !== undefined) {
          await admitRootWorkMapped({
            rootSessionId: requestedRootSessionId,
            caller: initialWorkTarget.caller,
            requestToken: initialWorkTarget.requestToken,
            prompt: initialWorkTarget.work.prompt,
            ...(initialWorkTarget.work.attachedContext !== undefined
              ? { attachedContext: initialWorkTarget.work.attachedContext }
              : {}),
            blueprint: resolved,
          })
        }
        return {
          path: result.path,
          durable: result.durable ?? null,
          bind: result.bind as unknown as RemoteSafeRecord,
        } as unknown as RemoteSafeRecord
      },
    },

    // --- TCM vNext §15.6 (G1): the v2 workspace-aware team.create ---------------------
    teamCreateV2: {
      async create(
        requestedRootSessionId: string,
        blueprintId: string,
        blueprintRevision: number | undefined,
        workspace: string | undefined,
      ): Promise<RemoteSafeRecord> {
        // Same creation semantics as the v1 port (P9-S8 creation method,
        // no bound-root guard; CR-4 preserved) — CREATE-ONLY: the v2
        // closed field set carries NO initialWork (the creation-time
        // initial work travels the v2-only `team.admitInitialWork` after
        // the root is open).
        // D-3 — the fail-closed preflight (BEFORE any durable effect).
        requireStartRootAgentPort()
        const resolved = resolveBlueprint(blueprintId, blueprintRevision)
        // TCM vNext §2.2 (G1) — the requested workspace is resolved
        // through the host workspace registry BEFORE any durable effect;
        // the canonical path is the registry's, VERBATIM (the seam never
        // re-normalizes). Unknown path / unowned directory / absent port
        // → the typed TEAM_CREATE_WORKSPACE_NOT_FOUND (no partial team).
        const requestedWorkspace =
          workspace !== undefined ? await resolveRequestedWorkspace(workspace) : undefined
        // P9-S8 — the durable-row check addresses the REQUESTED root (a
        // NEW root has no row → the fresh path; an already-owned root →
        // the cold path with the snapshot match below).
        const durableRow = repositories.teamSessions.get(requestedRootSessionId)
        let result: RootBindingResult
        if (durableRow !== undefined) {
          // The cold path: the durable row's bound snapshot is the truth;
          // a request naming a different snapshot is a foreign intent.
          if (
            durableRow.blueprint.blueprintId !== resolved.blueprintId ||
            (blueprintRevision !== undefined &&
              Number(durableRow.blueprint.revision) !== blueprintRevision)
          ) {
            throw new TeamPluginError(
              S6_REMOTE_ERROR_CODES.TEAM_CREATE_BLUEPRINT_MISMATCH,
              `team.create names blueprint '${resolved.blueprintId}' (revision ${String(blueprintRevision ?? 'latest')}) but the bound TeamSession carries '${durableRow.blueprint.blueprintId}' (revision '${durableRow.blueprint.revision}')`,
              { reason: 'blueprint-mismatch' },
            )
          }
          // TCM vNext §2.2 (G1) — a cold retry asserting a workspace
          // different from the durable defaultWorkspace is a typed
          // mismatch (zero writes). An omitted workspace asserts nothing
          // (the durable workspace stands; the host-default semantics).
          if (
            requestedWorkspace !== undefined &&
            String(durableRow.defaultWorkspace) !== requestedWorkspace.canonicalPath
          ) {
            throw new TeamPluginError(
              S6_REMOTE_ERROR_CODES.TEAM_CREATE_WORKSPACE_MISMATCH,
              `team.create asserts workspace '${requestedWorkspace.canonicalPath}' but the bound TeamSession carries defaultWorkspace '${String(durableRow.defaultWorkspace)}'`,
              { reason: 'workspace-mismatch' },
            )
          }
          result = await options.rootBinding.rehydrateCold({ rootSessionId: requestedRootSessionId as TeamSessionId })
        } else {
          result = await options.rootBinding.bindFresh({
            rootSessionId: requestedRootSessionId as TeamSessionId,
            blueprint: {
              blueprintId: resolved.blueprintId,
              revision: resolved.revision,
              contentHash: resolved.contentHash,
            },
            // TCM vNext §2.2 (G1) — the selected workspace is bound as
            // the TeamSession's defaultWorkspace; when the request omits
            // it, the host default workspace carries (unchanged pre-v2
            // behavior — an unregistered host default is NOT created into
            // a workspace by this fix).
            ...(requestedWorkspace !== undefined
              ? { defaultWorkspace: requestedWorkspace.canonicalPath }
              : options.defaultWorkspace !== undefined
                ? { defaultWorkspace: options.defaultWorkspace }
                : {}),
          })
        }
        // D-3 — the created/retained root must own a LIVE leader agent:
        // start it (create-or-ensure) BEFORE the workspace attach (the
        // plan §2.2 order: bind → start/materialize → attach). The
        // durable bind already landed: a start failure is typed, the team
        // row stays durable, and the retry (cold path) re-drives the
        // start + the attach.
        await startRootAgent(requestedRootSessionId)
        // TCM vNext §2.2 (G1) — the public Workspace.attachSession
        // (idempotent upstream: the same-root/workspace retry re-drives
        // without duplicating). A failure keeps the durable bind: the
        // typed retryable TEAM_CREATE_WORKSPACE_ATTACH_FAILED.
        if (requestedWorkspace !== undefined) {
          await attachWorkspaceSession(requestedWorkspace.workspaceId, requestedRootSessionId)
        }
        return {
          path: result.path,
          durable: result.durable ?? null,
          bind: result.bind as unknown as RemoteSafeRecord,
        } as unknown as RemoteSafeRecord
      },
    },

    // --- TCM vNext §15.6 (G1): the v2-only team.admitInitialWork ----------------------
    teamAdmitInitialWork: {
      async admit(
        requestedRootSessionId: string,
        requestToken: string,
        prompt: string,
        attachedContext: string | undefined,
      ): Promise<RemoteSafeRecord> {
        // TCM vNext §15.6 (G1) — team.admitInitialWork is TEAM-SCOPED
        // (unlike the creation methods): the created team must exist and
        // be owned — the bound-root guard, fail-closed.
        const rootSessionId = assertBoundRoot('team.admitInitialWork', requestedRootSessionId)
        // A32 — the caller claim is derivation input, never authority
        // (the closed param schema already validated the fields).
        const caller = resolveCaller(
          repositories,
          rootSessionId,
          await options.principal({
            method: 'team.admitInitialWork',
            request: {
              version: REMOTE_CONTRACT_VERSION_V2,
              params: {
                rootSessionId,
                requestToken,
                prompt,
                ...(attachedContext !== undefined ? { attachedContext } : {}),
              },
            },
          }),
        )
        // The gate's blueprint input: the TARGET team's durable bound
        // snapshot (the team already exists — unlike the creation paths).
        const blueprint = resolveTargetBlueprint(rootSessionId)
        // TCM vNext §15.8 (G1) — the SAME Root-specific authority the v1
        // create's initialWork uses: withTeamLock (the shared
        // coordination.chains) → enforceCompatibilityGate (the existing
        // single compatibility authority, INSIDE the lock) → the two-fact
        // scanner + the live Root input seam. Never the generic Member
        // follow-up (no Member lifecycle, no childSessionId, no new
        // schema, no new ledger category).
        const outcome = await admitRootWorkMapped({
          rootSessionId,
          caller,
          requestToken,
          prompt,
          ...(attachedContext !== undefined ? { attachedContext } : {}),
          blueprint,
        })
        // The outcome is a plain lossless-JSON record (all fields
        // primitive; the dispatcher's invariant-6 check keeps it honest).
        return outcome as unknown as RemoteSafeRecord
      },
    },

    // --- D1 (Team D1-D6 repair v2, remote contract v3): team.listRoots ---------
    teamRoots: {
      listRoots(): Promise<readonly TeamRootWireRow[]> {
        // v3-only READ-ONLY: the host answers from its own durable
        // TeamDomain (no root addressed — the bound-root guard does not
        // apply; no repository writes, no agent effects). Typed integrity
        // failures propagate unchanged (invariant 4b).
        return listRoots()
      },
    },

    // --- D2 (Team D1-D6 repair v2, remote contract v3): team.ensureRootLive ----
    teamEnsureRootLive: {
      ensureRootLive(requestedTeamSessionId: string): Promise<RemoteSafeRecord> {
        // The D2 production handler (the A3 Q2 wiring): the bound-root
        // guard FIRST (fail-closed FOREIGN_TEAM), then the host's
        // Team-mode ensure over the live glue, with the typed failure
        // vocabulary TEAM_REMOTE_TEAM_ROOT_LIVE_* (PORT_UNAVAILABLE /
        // NO_DURABLE_ARTIFACT / OUTSIDE_TEAM / START_FAILED). NEVER a
        // silent success; the durable root row is never touched.
        return ensureRootLive(requestedTeamSessionId)
      },
    },

    // --- F9 (F3/F11/F9/T1.4 repair round r1, remote contract v4):
    // --- team.resolveControl (the human control-resolution command) ----
    teamResolveControl: {
      resolveControl(
        requestedTeamSessionId: string,
        requestId: string,
        decision: 'allow' | 'deny',
        note: string | undefined,
        caller: ActionCaller,
      ): Promise<RemoteSafeRecord> {
        // The F9 production handler: the bound-root guard FIRST (fail-
        // closed FOREIGN_TEAM — before any decision), then the host's
        // control-service closure (the existing A25 authority —
        // CONTROL_RESOLVER_ROLES + the durable exactly-once semantics,
        // UNCHANGED). The `caller` is HOST-DERIVED (the T12-B4 seam; the
        // wire carries no caller fields — adjudication U3). Typed
        // CONTROL_* failures propagate unchanged (invariant 4b); a
        // missing closure fails closed typed. NEVER a silent success.
        return resolveControl(requestedTeamSessionId, requestId, decision, note, caller)
      },
    },

    // --- 4/12 projection: the projection service (durable source + overlay) ---------
    projection: {
      async project(teamSessionId: string): Promise<RemoteSafeRecord> {
        assertBoundRoot('team.getProjection', teamSessionId)
        const projection = options.projection.project(teamSessionId as TeamSessionId)
        return projection as unknown as RemoteSafeRecord
      },
    },

    // --- 5/12 ledger: the durable rows behind the D-5 slicer (root-filtered) --------
    ledger: {
      async listEntries(teamSessionId: string): Promise<readonly RemoteLedgerEntryValue[]> {
        const root = assertBoundRoot('team.getLedgerPage', teamSessionId)
        return rootLedgerEntries(root).map((record) => ledgerEntryWire(record))
      },
      async countEntries(teamSessionId: string): Promise<number> {
        const root = assertBoundRoot('team.getLedgerPage', teamSessionId)
        return rootLedgerEntries(root).length
      },
    },

    // --- 6/12 admission: the TeamRuntime facade (NEVER the claimed caller) ----------
    admission: {
      async performAction(
        request: S6RemoteAdmissionRequest,
        caller: ActionCaller,
      ): Promise<TeamRuntimeActionOutcome> {
        // P9-S8 (F1-lite v3): admit on the ADDRESSED root (guard-asserted),
        // never the closure bound root — F1-lite v1 fixed team.create but
        // left this port on the bound root, so every host-owned team's
        // member action executed on the boot team (attempt-25 S5: the
        // worker instance + ledger landed on the bound root while the UI
        // projected the handoff root, whose static generation then made the
        // post-create pull a G2 duplicate).
        const addressedRoot = assertBoundRoot(
          request.action === 'create-member'
            ? 'member.create'
            : request.action === 'send-message'
              ? 'member.send'
              : 'member.followup',
          request.rootSessionId,
        )
        const base = {
          rootSessionId: addressedRoot as TeamSessionId,
          caller,
          requestToken: request.requestToken,
        }
        let facadeRequest: TeamRuntimeActionRequest
        if (request.action === 'create-member') {
          facadeRequest = {
            ...base,
            action: 'create-member',
            ...(request.delegationTemplateId !== undefined
              ? { delegationTemplateId: request.delegationTemplateId }
              : {}),
            ...(request.delegationInstanceId !== undefined
              ? { delegationInstanceId: request.delegationInstanceId }
              : {}),
            ...(request.payload !== undefined ? { payload: { ...request.payload } } : {}),
          }
        } else if (request.action === 'send-message') {
          // The authoritative recipient/body come from the parsed params;
          // the client's extra payload fields merge UNDER them (no
          // override of the authority fields).
          const payload: Record<string, unknown> = { ...(request.payload ?? {}) }
          payload['recipientInstanceId'] = request.targetInstanceId
          payload['body'] = request.body
          if (request.subject !== undefined) payload['subject'] = request.subject
          facadeRequest = {
            ...base,
            action: 'send-message',
            targetInstanceId: request.targetInstanceId as InstanceId,
            payload,
          }
        } else {
          facadeRequest = {
            ...base,
            action: 'follow-up',
            targetInstanceId: request.targetInstanceId as InstanceId,
            ...(request.payload !== undefined ? { payload: { ...request.payload } } : {}),
          }
        }
        return options.runtime.performAction(facadeRequest)
      },
    },

    // --- 7/12 lifecycle: the LifecycleService (the only lifecycle authority) --------
    lifecycle: {
      async archive(teamSessionId: string, instanceId: string): Promise<RemoteSafeRecord> {
        // F1-lite v3: the asserted addressed root (host-owned teams).
        const root = assertBoundRoot('member.archive', teamSessionId)
        const result = await options.lifecycle.archiveMember({
          rootSessionId: root as TeamSessionId,
          instanceId: instanceId as InstanceId,
        })
        return result as unknown as RemoteSafeRecord
      },
      async restore(teamSessionId: string, instanceId: string): Promise<RemoteSafeRecord> {
        // F1-lite v3: the asserted addressed root (host-owned teams).
        const root = assertBoundRoot('member.restore', teamSessionId)
        const result = await options.lifecycle.restoreMember({
          rootSessionId: root as TeamSessionId,
          instanceId: instanceId as InstanceId,
        })
        return result as unknown as RemoteSafeRecord
      },
      async dispose(teamSessionId: string, instanceId: string): Promise<RemoteSafeRecord> {
        // F1-lite v3: the asserted addressed root (host-owned teams).
        const root = assertBoundRoot('member.dispose', teamSessionId)
        const result = await options.lifecycle.disposeMember({
          rootSessionId: root as TeamSessionId,
          instanceId: instanceId as InstanceId,
        })
        return result as unknown as RemoteSafeRecord
      },
    },

    // --- 8/12 override: the governance-override admission ----------------------------
    override: {
      async get(
        teamSessionId: string,
        capability: string,
        scope?: 'team' | 'instance',
        targetInstanceId?: string,
      ): Promise<RemoteSafeRecord | null> {
        const root = assertBoundRoot('override.get', teamSessionId)
        const records = options.overrideRecords(root)
        const effectiveScope = scope ?? 'team'
        const matches = records.filter((record) => {
          if (record['scope'] !== effectiveScope) return false
          if (effectiveScope === 'instance' && record['instanceId'] !== targetInstanceId) return false
          if (effectiveScope === 'team' && record['instanceId'] !== undefined) return false
          const values = record['values']
          return isPlainRecord(values) && capability in values
        })
        // The most-recently-written record wins (the slot winner by generation).
        let winner: RemoteSafeRecord | null = null
        for (const record of matches) {
          const generation = record['generation']
          if (!isSafeInt(generation)) continue
          if (winner === null || generation > (winner['generation'] as number)) winner = record
        }
        return winner
      },
      async set(request: S6RemoteOverrideSetRequest, caller: ActionCaller): Promise<RemoteSafeRecord> {
        const root = assertBoundRoot('override.set', request.teamSessionId)
        const authority = authorityOf(caller, leaderInstanceId)
        const scope = request.scope ?? 'team'
        const instanceId = scope === 'instance' ? request.targetInstanceId : undefined
        if (scope === 'instance' && (instanceId === undefined || instanceId.length === 0)) {
          throw new TeamPluginError(
            S6_REMOTE_ERROR_CODES.OVERRIDE_TARGET_REQUIRED,
            'override.set with instance scope requires a targetInstanceId',
            { reason: 'missing-target' },
          )
        }
        const kind = authority.kind === 'operator' ? 'human-override' : 'autonomy-overlay'
        const records = options.overrideRecords(root)
        const slotMatches = records.filter(
          (record) =>
            record['kind'] === kind &&
            record['scope'] === scope &&
            (scope === 'instance' ? record['instanceId'] === instanceId : record['instanceId'] === undefined),
        )
        let winnerGeneration = 0
        for (const record of slotMatches) {
          const generation = record['generation']
          if (isSafeInt(generation) && generation > winnerGeneration) winnerGeneration = generation
        }
        // The server-side deterministic clean record id (the remote
        // contract carries NO client-supplied record id; the id is bound
        // to the addressed slot + the current slot generation, so a
        // concurrent same-slot set collides instead of clobbering).
        const recordId = `ovr-${request.capability}-${scope === 'instance' ? instanceId : 'team'}-g${winnerGeneration}`
        const admitted = await options.admitGovernanceOverride(
          {
            authority,
            rootSessionId: root,
            recordId,
            scope,
            ...(instanceId !== undefined ? { instanceId } : {}),
            cells: { [request.capability]: request.value as unknown as PolicyEntry },
            now,
          },
          options.overrideStore,
        )
        const record: Record<string, unknown> = {
          recordId: admitted.recordId,
          kind: admitted.kind,
          scope: admitted.scope,
          rootSessionId: admitted.rootSessionId,
          values: admitted.values as unknown as RemoteSafeRecord,
          generation: admitted.generation,
          updatedAt: admitted.updatedAt,
        }
        if (admitted.instanceId !== undefined) record['instanceId'] = admitted.instanceId
        if (admitted.origin !== undefined) record['origin'] = admitted.origin
        return record as RemoteSafeRecord
      },
      async reset(
        request: S6RemoteOverrideResetRequest,
        caller: ActionCaller,
      ): Promise<{ readonly removed: boolean }> {
        const root = assertBoundRoot('override.reset', request.teamSessionId)
        const authority = authorityOf(caller, leaderInstanceId)
        const scope = request.scope ?? 'team'
        const instanceId = scope === 'instance' ? request.targetInstanceId : undefined
        const kind = authority.kind === 'operator' ? 'human-override' : 'autonomy-overlay'
        const records = options.overrideRecords(root)
        const slotMatches = records.filter(
          (record) =>
            record['kind'] === kind &&
            record['scope'] === scope &&
            (scope === 'instance' ? record['instanceId'] === instanceId : record['instanceId'] === undefined),
        )
        let winner: RemoteSafeRecord | null = null
        for (const record of slotMatches) {
          const generation = record['generation']
          if (!isSafeInt(generation)) continue
          if (winner === null || generation > (winner['generation'] as number)) winner = record
        }
        if (winner === null) return { removed: false }
        const removed = await repositories.overrides.delete({
          kind: winner['kind'] as 'human-override' | 'autonomy-overlay',
          recordId: winner['recordId'] as string,
          scope: winner['scope'] as 'team' | 'instance',
          rootSessionId: root,
          ...(scope === 'instance' ? { instanceId } : {}),
        })
        return { removed }
      },
    },

    // --- 9/12 policyState: the mutation service (invariant 40: explicit only) -------
    policyState: {
      async read(teamSessionId: string): Promise<RemoteSafeRecord> {
        const root = assertBoundRoot('policyState.get', teamSessionId)
        const view = policyStateReadOf(
          options.mutationTransitions(root),
          Number.MAX_SAFE_INTEGER,
        )
        // R2-1 (BQ-10): the surface reports the CURRENT state plus the
        // AVAILABLE AUTHORIZED TRANSITIONS — the bound blueprint's closed
        // state set (default + the declared states, declaration order)
        // minus the state already active (a self-transition is a no-op
        // the surface does not advertise). The frozen
        // RemotePolicyStateGetValue.state is an open RemoteSafeRecord, so
        // the additive key passes the remote plane unchanged. No impact
        // PREVIEW is invented: the backend provides no preview surface
        // for a not-yet-admitted transition (adjudication, documented in
        // S7R2-result.md). The A31 rejection semantics are untouched: an
        // out-of-closed-set target still fails POLICY_STATE_UNKNOWN and a
        // member actor still fails UNAUTHORIZED_TRANSITION (switchState).
        const closedStates = new Set<string>([
          DEFAULT_POLICY_STATE_ID,
          ...blueprint.policyStates.map((state) => state.id),
        ])
        const availableTransitions = [...closedStates].filter(
          (stateId) => stateId !== view.stateId,
        )
        return {
          ...(view as unknown as RemoteSafeRecord),
          availableTransitions,
        }
      },
      async switchState(
        request: S6RemotePolicyStateSwitchRequest,
        caller: ActionCaller,
      ): Promise<RemoteSafeRecord> {
        const root = assertBoundRoot('policyState.set', request.teamSessionId)
        const target = request.target
        const stateId = target['stateId']
        const closed = new Set<string>([DEFAULT_POLICY_STATE_ID, ...blueprint.policyStates.map((state) => state.id)])
        if (typeof stateId !== 'string' || !closed.has(stateId)) {
          throw new TeamPluginError(
            S6_REMOTE_ERROR_CODES.POLICY_STATE_UNKNOWN,
            `policyState.set names state '${String(stateId)}' which is outside the bound blueprint's closed set (${[...closed].join(', ')})`,
            { reason: 'unknown-state', stateId: String(stateId) },
          )
        }
        const transition = options.mutationService.switchPolicyState({
          teamSessionId: root as TeamSessionId,
          target: target as unknown as PolicyStateView,
          actor: actorOf(caller, root, leaderInstanceId),
        })
        return {
          entryId: transition.entryId,
          origin: transition.origin,
          state: transition.state as unknown as RemoteSafeRecord,
          requestedAtStep: transition.requestedAtStep,
          effectiveFromStep: transition.effectiveFromStep,
        }
      },
    },

    // --- 10/12 compatibility: the prober (durable state; no local recompute) --------
    compatibility: {
      async current(teamSessionId: string): Promise<RemoteSafeRecord> {
        assertBoundRoot('compatibility.get', teamSessionId)
        const state = await options.compatibility.current()
        if (state === undefined) {
          throw new TeamPluginError(
            S6_REMOTE_ERROR_CODES.COMPATIBILITY_STATE_ABSENT,
            `no durable compatibility state exists for TeamSession '${rootSessionId}'`,
            { reason: 'state-absent' },
          )
        }
        return compatibilityCurrentOf(state as unknown as Record<string, unknown>)
      },
      async acknowledge(
        teamSessionId: string,
        requirementId: string,
        caller: ActionCaller,
        note?: string,
      ): Promise<RemoteSafeRecord> {
        assertBoundRoot('compatibility.ack', teamSessionId)
        const verdict = await options.compatibility.acknowledge({
          requirementId,
          acknowledgedBy: caller.kind === 'human' ? caller.humanId : caller.instanceId,
          ...(note !== undefined ? { note } : {}),
        })
        return verdict as unknown as RemoteSafeRecord
      },
      async probe(teamSessionId: string, trigger: string): Promise<RemoteSafeRecord> {
        assertBoundRoot('compatibility.reprobe', teamSessionId)
        if (!(PROBE_TRIGGER_VALUES as readonly string[]).includes(trigger)) {
          throw new TeamPluginError(
            S6_REMOTE_ERROR_CODES.COMPATIBILITY_STATE_MALFORMED,
            `compatibility.reprobe names trigger '${trigger}' outside the closed vocabulary`,
            { reason: 'unknown-trigger', trigger },
          )
        }
        const outcome = await options.compatibility.probe(trigger as (typeof PROBE_TRIGGER_VALUES)[number])
        return outcome as unknown as RemoteSafeRecord
      },
    },

    // --- 11/12 handoff: the handoff service (§34.4 fail-closed triad) ---------------
    handoff: {
      async prepareSource(sourceSessionId: string): Promise<RemoteSafeRecord> {
        // P8-S7-R4 A28: the producer is injected by the production root
        // (the DSH public sessionQuery authority + the deterministic
        // digest). ABSENT (the S5A boot world / test worlds without the
        // session read service) → fail closed exactly as before.
        const producer = options.handoffPrepare
        if (producer === undefined) {
          throw new TeamPluginError(
            S6_REMOTE_ERROR_CODES.HANDOFF_PREPARE_UNAVAILABLE,
            `the production root exposes no DSH public session read surface for handoff prepare (source session '${sourceSessionId}')`,
            { reason: 'source-surface-unavailable' },
          )
        }
        return producer(sourceSessionId)
      },
      async start(
        sourceSessionId: string,
        requestToken: string,
        staged?: RemoteSafeRecord,
      ): Promise<RemoteSafeRecord> {
        const state = await options.handoff.startTeamFromHere({
          requestToken,
          sourceSessionId,
          ...(staged !== undefined ? { staged } : {}),
        })
        return state as unknown as RemoteSafeRecord
      },
    },

    // --- 12/12 legacy: the frozen read-only reader (fail-closed without a home) -----
    legacy: {
      async inspect(dshHome: string, workspaceCwd?: string, projectDir?: string): Promise<RemoteSafeRecord> {
        if (options.legacyHome === undefined) {
          throw new TeamPluginError(
            S6_REMOTE_ERROR_CODES.LEGACY_HOME_UNAVAILABLE,
            "this production root carries no legacy home port (the boot world does not bind one); legacy.inspect is fail-closed",
            { reason: 'legacy-home-unavailable' },
          )
        }
        const inspection = options.legacyInspect(options.legacyHome, {
          dshHome,
          ...(workspaceCwd !== undefined ? { workspaceCwd } : {}),
          ...(projectDir !== undefined ? { projectDir } : {}),
        })
        return inspection as unknown as RemoteSafeRecord
      },
    },

    // --- 13/13 messaging: the P6-T3 coordinator (T12-V16) ------------------------
    // `member.send` is the ONLY team-scoped remote method that needs live
    // delivery at admission time: the pre-fix facade-only path left every
    // relay intent undelivered until a `recoverPendingDeliveries` scan
    // happened to run (the T12 window latch, runs #5-#13). The port asserts
    // the bound root (fail-closed) and hands the FULL request — caller
    // included — to the injected coordinator, whose self-send policy,
    // direct/mediated plan, and at-least-once contract match the team tool
    // path exactly.
    messaging: {
      sendTeamMessage(request: SendTeamMessageRequest): Promise<SendTeamMessageOutcome> {
        return options.messaging.sendTeamMessage({
          ...request,
          rootSessionId: assertBoundRoot('member.send', request.rootSessionId),
        })
      },
    },
  }
}

// --- the category handlers (the async mirror of the frozen nine) ------------------------

/** One async category handler as wired by the production dispatcher. */
type S6CategoryHandler = (
  method: string,
  params: RemoteMethodParams,
  envelope: RemoteRequest,
) => Promise<RemoteHandlerOutcome>

/**
 * Wire the thirteen ports into the nine category handlers.
 *
 * Every value shape mirrors the frozen handler byte-for-byte (the wire
 * contract). The claim-carrying methods derive the principal through the
 * A32 seam BEFORE the port call (the port acts on the derived caller).
 */
function buildS6CategoryHandlers(ports: S6RemotePorts, principal: ServerPrincipalDerivation) {
  return {
    [REMOTE_CATEGORIES.CATALOG]:
      ((method: string, params: RemoteMethodParams): Promise<RemoteHandlerOutcome> => {
        switch (method) {
          case 'catalog.list': {
            return ports.catalog.list().then((blueprints) => ({ data: { blueprints } }))
          }
          case 'catalog.get': {
            const getParams = params as RemoteCatalogGetParams
            return ports
              .catalog.get(getParams.blueprintId, getParams.blueprintRevision)
              .then((blueprint) => ({ data: { blueprint } }))
          }
          default:
            return Promise.reject(new Error(`catalog handler routed an unknown method: ${method}`))
        }
      }) as S6CategoryHandler,

    [REMOTE_CATEGORIES.INTENT]:
      ((method: string, params: RemoteMethodParams): Promise<RemoteHandlerOutcome> => {
        switch (method) {
          case 'intent.probe': {
            const probeParams = params as RemoteIntentProbeParams
            return ports
              .intent.probe(probeParams.blueprintId, probeParams.blueprintRevision, probeParams.environmentFacts)
              .then((compatibility) => ({ data: { compatibility } }))
          }
          default:
            return Promise.reject(new Error(`intent handler routed an unknown method: ${method}`))
        }
      }) as S6CategoryHandler,

    [REMOTE_CATEGORIES.TEAM]:
      ((method: string, params: RemoteMethodParams, envelope: RemoteRequest): Promise<RemoteHandlerOutcome> => {
        switch (method) {
          case 'team.create': {
            // TCM vNext §15.3/§15.6 (G1) — the shared parser already
            // validated the closed field set per version: v1 (the optional
            // `initialWork`) vs v2 (the optional `workspace`, NO initial
            // work). Route by the envelope version.
            if (envelope.version === 2) {
              const v2CreateParams = params as RemoteTeamCreateParamsV2
              return ports
                .teamCreateV2.create(
                  v2CreateParams.rootSessionId,
                  v2CreateParams.blueprintId,
                  v2CreateParams.blueprintRevision,
                  v2CreateParams.workspace,
                )
                .then((created) => ({ data: { path: created['path'], durable: created['durable'], bind: created['bind'] } }))
            }
            const createParams = params as RemoteTeamCreateParams
            return ports
              .teamCreate.create(
                createParams.rootSessionId,
                createParams.blueprintId,
                createParams.blueprintRevision,
                createParams.initialWork,
              )
              .then((created) => ({ data: { path: created['path'], durable: created['durable'], bind: created['bind'] } }))
          }
          case 'team.admitInitialWork': {
            // TCM vNext §15.6 (G1) — the v2-only creation-time initial
            // work command (team-scoped: the created team must exist and
            // be owned). The port runs the SAME Root-specific authority
            // the v1 create's initialWork uses; typed failures pass
            // through the dispatcher unchanged (the closed backing
            // vocabulary, invariant 4b).
            const admitParams = params as RemoteTeamAdmitInitialWorkParams
            return ports
              .teamAdmitInitialWork.admit(
                admitParams.rootSessionId,
                admitParams.requestToken,
                admitParams.prompt,
                admitParams.attachedContext,
              )
              .then((result) => ({ data: result }))
          }
          case 'team.listRoots': {
            // D1 (Team D1-D6 repair v2, remote contract v3) — the v3-only
            // durable ownership / root-identity query. The version-aware
            // param parser guarantees the request version is 3 (an
            // older-version request is typed-rejected before dispatch).
            // READ-ONLY, no root addressed (the host-authority read of the
            // host's own durable TeamDomain — the bound-root guard does
            // not apply); the port fails closed typed when the host wiring
            // is absent, and the index's integrity failures propagate
            // unchanged (the closed backing vocabulary, invariant 4b).
            return ports.teamRoots.listRoots().then((roots) => ({ data: { roots } }))
          }
          case 'team.ensureRootLive': {
            // D1 (Team D1-D6 repair v2, remote contract v3) — the v3-only
            // explicit open-in-Team-mode guarantee. TEAM-SCOPED like
            // `team.admitInitialWork`: the bound-root guard runs in the
            // port (fail-closed FOREIGN_TEAM), and D1's port body fails
            // closed with the typed TEAM_REMOTE_TEAM_ROOT_LIVE_NOT_IMPLEMENTED
            // — the production host handler is wired by D2 (over the live
            // glue's `ensureLiveAgent`, A3 Q2; the reserved
            // TEAM_REMOTE_TEAM_ROOT_LIVE_* failure codes are already in
            // the closed backing set). Typed failures pass through the
            // dispatcher unchanged (the closed backing vocabulary,
            // invariant 4b).
            const ensureParams = params as RemoteTeamEnsureRootLiveParams
            return ports
              .teamEnsureRootLive.ensureRootLive(ensureParams.teamSessionId)
              .then((result) => ({ data: result }))
          }
          case 'team.resolveControl': {
            // F9 (F3/F11/F9/T1.4 repair round r1, remote contract v4) —
            // the v4-only human control-resolution command (TEAM-SCOPED
            // like `team.admitInitialWork`). The derivation runs FIRST:
            // the T12-B4 trusted principal seam stamps the human operator
            // of the addressed (assertTeamScoped-validated, owned) root —
            // the v4 wire params carry NO caller/role fields
            // (adjudication U3), and a foreign teamSessionId fails closed
            // FOREIGN_TEAM before any port work. The port then drives the
            // existing control-service authority (A25 —
            // CONTROL_RESOLVER_ROLES + the durable exactly-once semantics,
            // UNCHANGED); the service's closed CONTROL_* failures pass
            // through the dispatcher unchanged (the closed backing
            // vocabulary, invariant 4b). Success: the durable decision
            // record under `data.decision` (the closed v4 shape).
            const resolveParams = params as RemoteTeamResolveControlParams
            return Promise.resolve(
              principal({ method, request: envelope }),
            ).then((caller) =>
              ports.teamResolveControl.resolveControl(
                resolveParams.teamSessionId,
                resolveParams.requestId,
                resolveParams.decision,
                resolveParams.note,
                caller,
              ),
            ).then((decision) => ({ data: { decision } }))
          }
          case 'team.getProjection': {
            const projectionParams = params as RemoteTeamGetProjectionParams
            return ports.projection.project(projectionParams.teamSessionId).then((raw) => {
              const projection = normalizeS6Projection(raw)
              return {
                data: { projection },
                projectionGeneration: projection['generation'],
              }
            })
          }
          case 'team.getLedgerPage': {
            const pageParams = params as RemoteTeamGetLedgerPageParams
            return Promise.all([
              ports.ledger.listEntries(pageParams.teamSessionId),
              ports.ledger.countEntries(pageParams.teamSessionId),
            ]).then(([allEntries, total]) => {
              const entriesAfter: RemoteLedgerEntryValue[] = []
              for (const entry of allEntries) {
                if (entry.sequence > pageParams.afterSequence) entriesAfter.push(entry)
              }
              const page = entriesAfter.slice(0, pageParams.limit)
              let nextAfterSequence: number | null = null
              if (entriesAfter.length > pageParams.limit) {
                const last = page[page.length - 1]
                if (last === undefined) {
                  throw new TeamPluginError(
                    S6_REMOTE_ERROR_CODES.LEDGER_PAGE_REJECTED,
                    'internal ledger slicing error',
                    { reason: 'internal-slicing-error' },
                  )
                }
                nextAfterSequence = last.sequence
              }
              return { data: { entries: page, nextAfterSequence, total } }
            })
          }
          default:
            return Promise.reject(new Error(`team handler routed an unknown method: ${method}`))
        }
      }) as S6CategoryHandler,

    [REMOTE_CATEGORIES.MEMBER]:
      ((method: string, params: RemoteMethodParams, envelope: RemoteRequest): Promise<RemoteHandlerOutcome> => {
        switch (method) {
          case 'member.create': {
            const createParams = params as RemoteMemberCreateParams
            const request: S6RemoteAdmissionRequest = {
              rootSessionId: createParams.teamSessionId,
              action: 'create-member',
              callerClaim: createParams.caller,
              requestToken: createParams.requestToken,
              ...(createParams.delegationTemplateId !== undefined
                ? { delegationTemplateId: createParams.delegationTemplateId }
                : {}),
              ...(createParams.delegationInstanceId !== undefined
                ? { delegationInstanceId: createParams.delegationInstanceId }
                : {}),
              ...(createParams.payload !== undefined ? { payload: createParams.payload } : {}),
            }
            return Promise.resolve(
              principal({ method, request: envelope }),
            ).then((caller) => ports.admission.performAction(request, caller)).then((outcome) => ({
              data: { outcome: outcome as unknown as RemoteSafeRecord },
              effectSequence: admissionEffectSequence(outcome as unknown as Record<string, unknown>),
            }))
          }
          case 'member.send': {
            const sendParams = params as RemoteMemberSendParams
            // T12-V16: the FULL coordinator path — facade admission (the
            // durable `team-coordination-recorded` intent fact) + LIVE
            // delivery of the attributed input to the bound child session
            // + the `team-message-delivered` confirmation fact. The
            // pre-fix admission-only facade call left every relay intent
            // undelivered until a `recoverPendingDeliveries` scan happened
            // to run (the T12 window latch: runs #5-#13,
            // t12v-finding-360s-first-turn.md). Self-send policy, the
            // direct/mediated plan, and the at-least-once contract all
            // come from the coordinator, exactly as for the team tool
            // path. The bound-root guard lives in the messaging port.
            return Promise.resolve(
              principal({ method, request: envelope }),
            ).then((caller) => ports.messaging.sendTeamMessage({
              rootSessionId: sendParams.teamSessionId,
              caller,
              recipientInstanceId: sendParams.recipientInstanceId,
              body: sendParams.body,
              ...(sendParams.subject !== undefined ? { subject: sendParams.subject } : {}),
              requestToken: sendParams.requestToken,
            })).then((outcome) => ({
              data: { outcome: outcome as unknown as RemoteSafeRecord },
              effectSequence: outcome.factSequence,
            }))
          }
          case 'member.followup': {
            const followupParams = params as RemoteMemberFollowupParams
            const request: S6RemoteAdmissionRequest = {
              rootSessionId: followupParams.teamSessionId,
              action: 'follow-up',
              callerClaim: followupParams.caller,
              requestToken: followupParams.requestToken,
              targetInstanceId: followupParams.targetInstanceId,
              ...(followupParams.payload !== undefined ? { payload: followupParams.payload } : {}),
            }
            return Promise.resolve(
              principal({ method, request: envelope }),
            ).then((caller) => ports.admission.performAction(request, caller)).then((outcome) => ({
              data: { outcome: outcome as unknown as RemoteSafeRecord },
              effectSequence: admissionEffectSequence(outcome as unknown as Record<string, unknown>),
            }))
          }
          case 'member.archive': {
            const lifecycleParams = params as RemoteMemberLifecycleParams
            return ports.lifecycle.archive(lifecycleParams.teamSessionId, lifecycleParams.instanceId).then((result) => ({ data: result }))
          }
          case 'member.restore': {
            const lifecycleParams = params as RemoteMemberLifecycleParams
            return ports.lifecycle.restore(lifecycleParams.teamSessionId, lifecycleParams.instanceId).then((result) => ({ data: result }))
          }
          case 'member.dispose': {
            const lifecycleParams = params as RemoteMemberLifecycleParams
            return ports.lifecycle.dispose(lifecycleParams.teamSessionId, lifecycleParams.instanceId).then((result) => ({ data: result }))
          }
          default:
            return Promise.reject(new Error(`member handler routed an unknown method: ${method}`))
        }
      }) as S6CategoryHandler,

    [REMOTE_CATEGORIES.OVERRIDE]:
      ((method: string, params: RemoteMethodParams, envelope: RemoteRequest): Promise<RemoteHandlerOutcome> => {
        switch (method) {
          case 'override.get': {
            const getParams = params as RemoteOverrideGetParams
            return ports
              .override.get(getParams.teamSessionId, getParams.capability, getParams.scope, getParams.targetInstanceId)
              .then((override) => ({ data: { override } }))
          }
          case 'override.set': {
            const setParams = params as RemoteOverrideSetParams
            const request: S6RemoteOverrideSetRequest = {
              teamSessionId: setParams.teamSessionId,
              capability: setParams.capability,
              value: setParams.value as unknown as RemoteSafeRecord,
              actorClaim: setParams.actor,
              ...(setParams.scope !== undefined ? { scope: setParams.scope } : {}),
              ...(setParams.targetInstanceId !== undefined
                ? { targetInstanceId: setParams.targetInstanceId }
                : {}),
            }
            return Promise.resolve(
              principal({ method, request: envelope }),
            ).then((caller) => ports.override.set(request, caller)).then((result) => ({ data: result }))
          }
          case 'override.reset': {
            const resetParams = params as RemoteOverrideResetParams
            const request: S6RemoteOverrideResetRequest = {
              teamSessionId: resetParams.teamSessionId,
              capability: resetParams.capability,
              actorClaim: resetParams.actor,
              ...(resetParams.scope !== undefined ? { scope: resetParams.scope } : {}),
              ...(resetParams.targetInstanceId !== undefined
                ? { targetInstanceId: resetParams.targetInstanceId }
                : {}),
            }
            return Promise.resolve(
              principal({ method, request: envelope }),
            ).then((caller) => ports.override.reset(request, caller)).then((result) => ({ data: { removed: result.removed } }))
          }
          default:
            return Promise.reject(new Error(`override handler routed an unknown method: ${method}`))
        }
      }) as S6CategoryHandler,

    [REMOTE_CATEGORIES.POLICY_STATE]:
      ((method: string, params: RemoteMethodParams, envelope: RemoteRequest): Promise<RemoteHandlerOutcome> => {
        switch (method) {
          case 'policyState.get': {
            const getParams = params as RemotePolicyStateGetParams
            return ports.policyState.read(getParams.teamSessionId).then((state) => ({ data: { state } }))
          }
          case 'policyState.set': {
            const setParams = params as RemotePolicyStateSetParams
            const request: S6RemotePolicyStateSwitchRequest = {
              teamSessionId: setParams.teamSessionId,
              target: setParams.target as unknown as RemoteSafeRecord,
              actorClaim: setParams.actor,
            }
            return Promise.resolve(
              principal({ method, request: envelope }),
            ).then((caller) => ports.policyState.switchState(request, caller)).then((transition) => ({ data: { transition } }))
          }
          default:
            return Promise.reject(new Error(`policyState handler routed an unknown method: ${method}`))
        }
      }) as S6CategoryHandler,

    [REMOTE_CATEGORIES.COMPATIBILITY]:
      ((method: string, params: RemoteMethodParams, envelope: RemoteRequest): Promise<RemoteHandlerOutcome> => {
        switch (method) {
          case 'compatibility.get': {
            const getParams = params as RemoteCompatibilityGetParams
            return ports.compatibility.current(getParams.teamSessionId).then((verdict) => ({ data: { verdict } }))
          }
          case 'compatibility.ack': {
            const ackParams = params as RemoteCompatibilityAckParams
            return Promise.resolve(
              principal({ method, request: envelope }),
            ).then((caller) =>
              ports.compatibility.acknowledge(
                ackParams.teamSessionId,
                ackParams.requirementId,
                caller,
                ackParams.note,
              ),
            ).then((verdict) => ({ data: { verdict } }))
          }
          case 'compatibility.reprobe': {
            const reprobeParams = params as RemoteCompatibilityReprobeParams
            return ports
              .compatibility.probe(reprobeParams.teamSessionId, reprobeParams.trigger)
              .then((probe) => ({ data: { probe } }))
          }
          default:
            return Promise.reject(new Error(`compatibility handler routed an unknown method: ${method}`))
        }
      }) as S6CategoryHandler,

    [REMOTE_CATEGORIES.HANDOFF]:
      ((method: string, params: RemoteMethodParams): Promise<RemoteHandlerOutcome> => {
        switch (method) {
          case 'handoff.prepare': {
            const prepareParams = params as RemoteHandoffPrepareParams
            return ports.handoff.prepareSource(prepareParams.sourceSessionId).then((summary) => ({
              data: { summary, sourceSessionId: prepareParams.sourceSessionId },
            }))
          }
          case 'handoff.create': {
            const createParams = params as RemoteHandoffCreateParams
            return ports
              .handoff.start(createParams.sourceSessionId, createParams.requestToken, createParams.staged)
              .then((state) => ({ data: { state } }))
          }
          default:
            return Promise.reject(new Error(`handoff handler routed an unknown method: ${method}`))
        }
      }) as S6CategoryHandler,

    [REMOTE_CATEGORIES.LEGACY]:
      ((method: string, params: RemoteMethodParams): Promise<RemoteHandlerOutcome> => {
        switch (method) {
          case 'legacy.inspect': {
            const inspectParams = params as RemoteLegacyInspectParams
            return ports
              .legacy.inspect(inspectParams.dshHome, inspectParams.workspaceCwd, inspectParams.projectDir)
              .then((inspection) => ({ data: { inspection } }))
          }
          default:
            return Promise.reject(new Error(`legacy handler routed an unknown method: ${method}`))
        }
      }) as S6CategoryHandler,
  }
}

/**
 * Validate the projection at the TOP LEVEL only (the frozen D-4 rule,
 * mirrored): the nine closed `TeamProjectionDto` fields must be present
 * with the right structural kinds; the nested values pass through.
 */
function normalizeS6Projection(raw: unknown): RemoteSafeRecord & { readonly generation: number } {
  if (!isPlainRecord(raw)) {
    throw new TeamPluginError(
      S6_REMOTE_ERROR_CODES.COMPATIBILITY_STATE_MALFORMED,
      `the projection port returned a malformed value (expected an object, got ${String(raw)})`,
      { reason: 'port-contract', field: 'projection' },
    )
  }
  for (const field of REMOTE_PROJECTION_FIELDS) {
    if (!(field in raw)) {
      throw new TeamPluginError(
        S6_REMOTE_ERROR_CODES.COMPATIBILITY_STATE_MALFORMED,
        `the projection port returned a malformed value (missing field '${field}')`,
        { reason: 'port-contract', field: `projection.${field}` },
      )
    }
  }
  const schemaVersion = raw['schemaVersion']
  const generation = raw['generation']
  if (!isSafeInt(schemaVersion)) {
    throw new TeamPluginError(
      S6_REMOTE_ERROR_CODES.COMPATIBILITY_STATE_MALFORMED,
      "the projection port returned a malformed 'schemaVersion'",
      { reason: 'port-contract', field: 'projection.schemaVersion' },
    )
  }
  if (!isSafeInt(generation) || generation < 1) {
    throw new TeamPluginError(
      S6_REMOTE_ERROR_CODES.COMPATIBILITY_STATE_MALFORMED,
      "the projection port returned a malformed 'generation'",
      { reason: 'port-contract', field: 'projection.generation' },
    )
  }
  return raw as RemoteSafeRecord & { readonly generation: number }
}

// --- the production dispatcher (the frozen seven invariants, async) ---------------------

/**
 * Map any failure value to a typed error result (the frozen invariants
 * 4a/4b/5, mirrored verbatim).
 */
function toS6RemoteErrorResult(error: unknown, ctx: RemoteProvenanceContext): RemoteResponse {
  // Invariant 4a: the remote layer's own typed errors keep their code.
  if (isRemoteContractError(error)) {
    const details = error.details
    const field =
      details !== undefined && typeof details['field'] === 'string' ? details['field'] : undefined
    const reason =
      details !== undefined && typeof details['reason'] === 'string'
        ? details['reason']
        : undefined
    return buildRemoteError(error.code, error.message, ctx, { field, reason })
  }
  // Invariant 4b (T12-H4): ONLY an error whose string `code` is a member of
  // the closed backing vocabulary (REMOTE_BACKING_ERROR_CODE_SET, the single
  // definition shared with the pure remote dispatcher) passes through with
  // code + message; the source identity rides under details.cause (never its
  // stack, never a live object — lossless-checked under cause.details). An
  // `Error` with an out-of-vocabulary `code` (a Node ENOENT with a path in
  // the message, a synthetic code, …) degrades to invariant 5.
  if (error instanceof Error) {
    const typed = error as Error & { readonly code?: unknown; readonly details?: unknown }
    if (typeof typed.code === 'string' && REMOTE_BACKING_ERROR_CODE_SET.has(typed.code)) {
      return buildRemoteError(typed.code, typed.message, ctx, {
        reason: 'domain-error',
        cause: { code: typed.code, message: typed.message },
        sourceDetails: typed.details,
      })
    }
  }
  // Invariant 5: an untyped throw — generic message, no leak.
  return buildRemoteError(
    REMOTE_CONTRACT_ERROR_CODES.INTERNAL_ERROR,
    'internal error in remote handler',
    ctx,
    { reason: 'untyped-error' },
  )
}

/**
 * Create the production throw-proof dispatcher (the frozen seven
 * invariants; the async mirror).
 *
 * T12-B4 — the mounted entry owns the transport's trusted
 * {@link ServerPrincipalContext}: the default is the connection-gate basis
 * (the DSH web seam's gate enforced 401/403 upstream of dispatch, so every
 * request reaching this dispatcher already passed it). A caller may pass an
 * explicit context (the production surfaces do); one that fails the
 * structural guard typed-rejects EVERY request under the existing
 * `TEAM_REMOTE_PRINCIPAL_INVALID` code — before any claim is read, with no
 * new wire code. See the `ServerPrincipalContext` authority model in
 * s6-principal for the full seam contract.
 *
 * @param ports - the thirteen production ports.
 * @param principal - the installed A32 principal derivation.
 * @param principalContext - the trusted PrincipalContext of the mounting
 *   transport (defaults to the connection-gate basis).
 * @returns the seam entry point: `(endpoint, payload) => Promise<RemoteResponse>`.
 */
export function createS6RemoteDispatcher(
  ports: S6RemotePorts,
  principal: ServerPrincipalDerivation,
  principalContext?: ServerPrincipalContext,
): RemoteDispatcher {
  const handlers = buildS6CategoryHandlers(ports, principal)
  const context: ServerPrincipalContext =
    principalContext ??
    createServerPrincipalContext({ transport: SERVER_PRINCIPAL_TRANSPORTS.CONNECTION_GATE })
  const contextValid = isServerPrincipalContext(context)
  return async (endpoint: string, payload: unknown): Promise<RemoteResponse> => {
    let ctx: RemoteProvenanceContext = {
      method: endpoint,
      endpoint,
      contractVersion: REMOTE_CONTRACT_VERSION,
      requestToken: null,
    }
    let response: RemoteResponse
    try {
      // T12-B4: the trusted PrincipalContext is consulted at the mounted
      // entry, BEFORE invariant 1 — fail-closed. No derivation, no claim
      // read, no new wire code.
      if (!contextValid) {
        throw new TeamPluginError(
          S6_PRINCIPAL_ERROR_CODES.PRINCIPAL_INVALID,
          'the remote mount does not carry the connection-gate authority basis',
          { reason: 'principal-context-broken' },
        )
      }
      // Invariant 1: unknown endpoint (checked before the envelope).
      if (!isRemoteMethod(endpoint)) {
        throw remoteContractError(
          REMOTE_CONTRACT_ERROR_CODES.UNKNOWN_METHOD,
          `endpoint '${endpoint}' is not a method of the closed Remote contract v1 catalog`,
          { reason: 'unknown-endpoint' },
        )
      }
      // Invariant 2: the request envelope (closed: version + params).
      const request = parseRemoteRequest(payload)
      ctx = { ...ctx, contractVersion: request.version }
      // Invariant 3: the method's closed param schema AT THE REQUEST'S
      // version (TCM vNext §15.3: the dispatcher passes request.version
      // through; a v1 request to a v2-only method is typed-rejected here,
      // after the envelope parse).
      const parsed = parseRemoteMethodParams(request.version, endpoint, request.params)
      ctx = { ...ctx, requestToken: parsed.requestToken }
      // Invariant 4: the category handler (the backing port call) — the
      // async mirror awaits (the frozen dispatcher calls synchronously).
      const outcome = await handlers[remoteCategoryOf(endpoint)](endpoint, parsed.params, request)
      // Invariant 6: lossless check + provenance on the success value.
      response = buildRemoteSuccess(outcome.data, {
        ...ctx,
        projectionGeneration: outcome.projectionGeneration ?? null,
        effectSequence: outcome.effectSequence ?? null,
      })
    } catch (error) {
      response = toS6RemoteErrorResult(error, ctx)
    }
    // Invariant 7: the promise never rejects.
    return Promise.resolve(response)
  }
}

/**
 * Register the production dispatcher on the public seam (the frozen
 * register semantics, mirrored: one channel, the idempotent disposer).
 * @param ports - the thirteen production ports.
 * @param principal - the installed A32 principal derivation.
 * @param principalContext - the trusted PrincipalContext of the mounting
 *   transport (T12-B4; defaults to the connection-gate basis).
 * @returns the `RemoteHandlerRegistration` the A31 seam installs.
 */
export function createS6RemoteRegistration(
  ports: S6RemotePorts,
  principal: ServerPrincipalDerivation,
  principalContext?: ServerPrincipalContext,
  readiness?: () => RemoteReadiness,
): RemoteHandlerRegistration {
  const dispatcher = createS6RemoteDispatcher(ports, principal, principalContext)
  // BP-G (issue #2 blueprint-loading, plan §12.2): the readiness gate —
  // ABSENT (the pre-BP-G worlds) = the legacy unguarded dispatcher,
  // byte-for-byte. A non-`ready` state refuses EVERY closed method except
  // the readiness-independent catalog reads (catalog.list / catalog.get —
  // they depend only on the Blueprint source authority + the opened
  // domain, never on the live boot outcome; the mount-before-boot
  // reorder exists so a failed boot leaves them servable). The refusal
  // is the frozen `internal-error` failure envelope (no new wire code,
  // no protocol bump — plan §12.3); the promise never rejects
  // (invariant 7 holds through the wrapper too). Unknown endpoints are
  // NOT gated (the frozen UNKNOWN_METHOD applies either way — the error
  // vocabulary stays state-invariant).
  const mounted: RemoteDispatcher =
    readiness === undefined
      ? dispatcher
      : (endpoint: string, payload: unknown): Promise<RemoteResponse> => {
          if (
            readiness() !== 'ready' &&
            isRemoteMethod(endpoint) &&
            !REMOTE_READINESS_INDEPENDENT_METHODS.has(endpoint)
          ) {
            const gateCtx: RemoteProvenanceContext = {
              method: endpoint,
              endpoint,
              contractVersion: REMOTE_CONTRACT_VERSION,
              requestToken: null,
            }
            return Promise.resolve(
              buildRemoteError(
                REMOTE_CONTRACT_ERROR_CODES.INTERNAL_ERROR,
                `remote method '${endpoint}' is unavailable while the team runtime is not ready (state: ${readiness()}) — the live boot is still starting or it failed; the route stays registered and the catalog reads stay servable`,
                gateCtx,
                { reason: 'runtime-not-ready' },
              ),
            )
          }
          return dispatcher(endpoint, payload)
        }
  return (connection: ConnectionLike): RemoteRegistration => {
    const channel = REMOTE_RPC_CHANNEL
    const handleResult = connection.rpc.handle(channel, mounted)
    if (typeof handleResult === 'function') {
      const disposeRegistration = handleResult as () => void
      let disposed = false
      return {
        channel,
        dispose: () => {
          if (disposed) return
          disposed = true
          disposeRegistration()
        },
      }
    }
    return { channel, dispose: () => {} }
  }
}

// --- A33 + A34 the pagination completion (the tracker gate) ------------------------------

/** The tracker cache bound (single-root host; one session per start anchor). */
const S6_TRACKER_CACHE_MAX = 16

/**
 * The A33 tracker cache: one `createLedgerPageTracker` session per
 * pagination START anchor. A request at anchor A continues the session
 * whose anchor is A (a mid-pagination continuation); any other state at
 * A starts a fresh session (a load-earlier / reconnect from A — idempotent
 * re-serve; documented). The cache is bounded (oldest evicted beyond
 * {@link S6_TRACKER_CACHE_MAX}).
 */
interface S6TrackerCache {
  trackerForAnchor(afterSequence: number): { readonly tracker: ReturnType<typeof createLedgerPageTracker> }
}

function createS6TrackerCache(): S6TrackerCache {
  const sessions = new Map<number, { readonly tracker: ReturnType<typeof createLedgerPageTracker> }>()
  return {
    trackerForAnchor(afterSequence: number) {
      const existing = sessions.get(afterSequence)
      if (existing !== undefined && existing.tracker.state().anchor === afterSequence) return existing
      const tracker = createLedgerPageTracker(afterSequence)
      sessions.set(afterSequence, { tracker })
      while (sessions.size > S6_TRACKER_CACHE_MAX) {
        const oldest = sessions.keys().next().value
        if (oldest === undefined) break
        sessions.delete(oldest)
      }
      return sessions.get(afterSequence)!
    },
  }
}

/**
 * The A34 remote query/command completion (the plan §20.5/§20.6 gate).
 *
 * `team.getLedgerPage` is gated BEFORE dispatch: the expected page is
 * computed from the durable ledger (the same slicer the dispatcher path
 * serves — dispatch is synchronous w.r.t. the durable rows, so the
 * pre-computed page IS the served page), then the tracker session for the
 * request's start anchor validates it (the 20.5/20.6 invariants: the
 * stable cursor, the load-earlier session, the growth-safe window, the
 * monotonic total). A rejected page is a typed error response BEFORE any
 * dispatch (fail-closed). Every other method passes through to the
 * dispatcher unchanged.
 *
 * The returned value is the lossless-JSON `RemoteResponse` (the seam
 * contract).
 */
export function createS6RemoteQueryCommandCompletion(
  ports: S6RemotePorts,
  options: Pick<S6RemoteOptions, 'rootSessionId' | 'isOwnedRoot'>,
  dispatcher: RemoteDispatcher,
): RemoteQueryCommandCompletion {
  const { rootSessionId, isOwnedRoot } = options
  const trackers = createS6TrackerCache()

  /** The bound-root guard's acceptance (same semantics as the port guard). */
  function ownsRoot(teamSessionId: string): boolean {
    return teamSessionId === rootSessionId || (isOwnedRoot?.(teamSessionId) ?? false)
  }

  return (input: { readonly method: string; readonly request: RemoteRequest }): Promise<unknown> => {
    const { method, request } = input
    if (method !== 'team.getLedgerPage') {
      // The non-paging query/command methods: the dispatcher is the
      // completion (the same seven invariants).
      return dispatcher(method, request)
    }
    const ctx: RemoteProvenanceContext = {
      method,
      endpoint: method,
      contractVersion: request.version,
      requestToken: null,
    }
    // 1. The bound-root guard (before anything else — a foreign TeamSession
    //    never reaches the ledger).
    const rawTeamSessionId = (request.params as Record<string, unknown>)['teamSessionId']
    if (typeof rawTeamSessionId !== 'string' || !ownsRoot(rawTeamSessionId)) {
      return Promise.resolve(
        buildRemoteError(
          S6_PRINCIPAL_ERROR_CODES.FOREIGN_TEAM,
          `remote method '${method}' addresses TeamSession '${String(rawTeamSessionId)}' which this host does not own (bound root '${rootSessionId}')`,
          ctx,
          { reason: 'foreign-team' },
        ),
      )
    }
    // 2. The closed param schema (malformed → the dispatcher reports it
    //    with the frozen codes; the pre-gate never invents a third code).
    let pageParams: RemoteTeamGetLedgerPageParams
    try {
      pageParams = parseRemoteTeamGetLedgerPageParams(method, request.params)
    } catch {
      return dispatcher(method, request)
    }
    // 3. The expected page (the D-5 slicer over the durable rows).
    return Promise.all([
      ports.ledger.listEntries(pageParams.teamSessionId),
      ports.ledger.countEntries(pageParams.teamSessionId),
    ]).then(([allEntries, total]) => {
      const entriesAfter: RemoteLedgerEntryValue[] = []
      for (const entry of allEntries) {
        if (entry.sequence > pageParams.afterSequence) entriesAfter.push(entry)
      }
      const page = entriesAfter.slice(0, pageParams.limit)
      let nextAfterSequence: number | null = null
      if (entriesAfter.length > pageParams.limit) {
        const last = page[page.length - 1]
        if (last === undefined) {
          return buildRemoteError(
            S6_REMOTE_ERROR_CODES.LEDGER_PAGE_REJECTED,
            'internal ledger slicing error',
            ctx,
            { reason: 'internal-slicing-error' },
          )
        }
        nextAfterSequence = last.sequence
      }
      const pageValue: RemoteLedgerPageValue = { entries: page, nextAfterSequence, total }
      // 4. The tracker gate (the A33 session for this start anchor).
      const session = trackers.trackerForAnchor(pageParams.afterSequence)
      const check: PageCheckResult = session.tracker.applyPage(
        { afterSequence: pageParams.afterSequence, limit: pageParams.limit },
        pageValue,
      )
      if (!check.ok) {
        return buildRemoteError(
          S6_REMOTE_ERROR_CODES.LEDGER_PAGE_REJECTED,
          `the ledger page was rejected by the pagination tracker: ${check.reason}`,
          ctx,
          { reason: check.reason },
        )
      }
      // 5. The lossless-JSON success reply (the served page).
      return buildRemoteSuccess(pageValue, {
        ...ctx,
        projectionGeneration: null,
        effectSequence: null,
      })
    })
  }
}

// --- the single entry point the production root installs ---------------------------------

/** The S6 remote surfaces the production root installs into the seams. */
export interface S6RemoteSurfaces {
  /** A31 — the registration the `remoteHandlerRegistration` seam installs. */
  readonly registration: RemoteHandlerRegistration
  /** A34 — the completion the `remoteQueryCommandCompletion` seam installs. */
  readonly completion: RemoteQueryCommandCompletion
}

/**
 * Build the complete S6 remote surface set (A31 + A33 + A34) over the
 * host's owned roots — the bound root + any TeamSession root the host
 * durably owns (P9-S8; the single entry point the production root calls).
 *
 * T12-B4: the production surface owns the transport's trusted
 * PrincipalContext EXPLICITLY — the DSH web seam's connection gate is the
 * authority basis of every call reaching the mounted dispatcher (and the
 * completion surface), recorded here at construction, never taken from a
 * payload claim.
 *
 * @param options - the root-bound inputs.
 * @returns the registration (A31) + the completion (A34, A33-gated).
 */
export function createS6RemoteSurfaces(options: S6RemoteOptions): S6RemoteSurfaces {
  const ports = createS6RemotePorts(options)
  const principalContext = createServerPrincipalContext({
    transport: SERVER_PRINCIPAL_TRANSPORTS.CONNECTION_GATE,
  })
  const dispatcher = createS6RemoteDispatcher(ports, options.principal, principalContext)
  const completion = createS6RemoteQueryCommandCompletion(ports, options, dispatcher)
  return {
    registration: createS6RemoteRegistration(ports, options.principal, principalContext, options.readiness),
    completion,
  }
}
