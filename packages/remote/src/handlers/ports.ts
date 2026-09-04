/**
 * The backing ports of the Remote handler layer (deviation D-2).
 *
 * The handler layer depends on NO runtime types: its entire dependency
 * surface is these 12 structural ports, each of which the host wiring (a
 * later P8 harness task) implements over the P7/P8 runtime APIs
 * (design note §3 table, "Backing API" column). Every port method returns
 * a lossless-JSON-safe record (or `null` where the wire shape allows it):
 * the remote layer never sees a live DSH object.
 *
 * The port methods are synchronous: the vNext runtime services and storage
 * repositories are in-process and synchronous; the seam itself is
 * promise-based and the dispatcher adapts (design note §6).
 *
 * Pure module: no I/O, no node: builtins, no runtime environment
 * assumptions.
 * @module @dsh-agent-team/remote/handlers/ports
 */

import type {
  RemoteAdmissionAction,
  RemoteCaller,
  RemoteCapability,
  RemoteLosslessRecord,
  RemoteMethodParams,
  RemoteMutationActor,
  RemoteMutationScope,
  RemotePolicyEntry,
  RemotePolicyStateViewValue,
  RemoteProbeTrigger,
} from '../contracts/params.js'
import type { RemoteSafeRecord } from '../contracts/remote-safe.js'

// ---------------------------------------------------------------------------
// Port 1 — catalog (BlueprintCatalog, packages/domain/blueprint)
// ---------------------------------------------------------------------------

/** The blueprint catalog read port (pre-creation discovery). */
export interface RemoteCatalogPort {
  /**
   * Every blueprint the catalog knows.
   * @returns records of the shape `{ blueprintId, revisions: number[] }`.
   */
  list(): readonly RemoteSafeRecord[]
  /**
   * Resolve one blueprint (a specific revision or the latest).
   * @param blueprintId - the validated blueprint id.
   * @param blueprintRevision - the requested revision, or `undefined` for
   *   the latest.
   * @returns the resolved TeamBlueprint (lossless JSON).
   */
  get(blueprintId: string, blueprintRevision: number | undefined): RemoteSafeRecord
}

// ---------------------------------------------------------------------------
// Port 2 — intent (domain evaluateCompatibility, Architecture §7)
// ---------------------------------------------------------------------------

/** The pre-creation compatibility probe port. */
export interface RemoteIntentPort {
  /**
   * Evaluate the blueprint's compatibility requirements against the
   * declared environment facts (pure domain evaluation).
   * @returns the CompatibilityResult (lossless JSON).
   */
  probe(
    blueprintId: string,
    blueprintRevision: number | undefined,
    environmentFacts: readonly RemoteSafeRecord[],
  ): RemoteSafeRecord
}

// ---------------------------------------------------------------------------
// Port 3 — team.create (root binding, P5-T5)
// ---------------------------------------------------------------------------

/** The TeamSession creation (root binding) port. */
export interface RemoteTeamCreatePort {
  /**
   * Bind a fresh root or rehydrate a cold root for the requested
   * blueprint.
   * @returns the value object
   *   `{ path: 'fresh-root' | 'cold-root', durable: <state> | null,
   *   bind: <bind result> }` (lossless JSON).
   */
  create(
    rootSessionId: string,
    blueprintId: string,
    blueprintRevision: number | undefined,
  ): RemoteSafeRecord
}

// ---------------------------------------------------------------------------
// Port 4 — projection (ProjectionService, P8-T2)
// ---------------------------------------------------------------------------

/** The whole-projection read port. */
export interface RemoteProjectionPort {
  /**
   * Project one TeamSession to its whole read-only view.
   * @returns the exact P8-T1 `TeamProjectionDto` (nine top-level fields,
   *   lossless JSON).
   */
  project(teamSessionId: string): RemoteSafeRecord
}

// ---------------------------------------------------------------------------
// Port 5 — ledger (storage LedgerRepository behind a slicing adapter, D-5)
// ---------------------------------------------------------------------------

/** The durable Team ledger read port (remote-level pagination, D-5). */
export interface RemoteLedgerPort {
  /**
   * Every durable fact row of one TeamSession, sorted by sequence
   * ascending (the storage `LedgerEntry` shape).
   */
  listEntries(teamSessionId: string): readonly RemoteSafeRecord[]
  /** The total fact-row count of one TeamSession. */
  countEntries(teamSessionId: string): number
}

// ---------------------------------------------------------------------------
// Port 6 — admission (TeamRuntime facade, P6-T2)
// ---------------------------------------------------------------------------

/**
 * The admission action request the port receives (the remote-side mirror
 * of the P6-T2 `TeamRuntimeActionRequest`; the host adapter maps it, and
 * the messaging fields `body`/`subject` ride along for `send-message`).
 */
export interface RemoteAdmissionRequest {
  readonly rootSessionId: string
  readonly action: RemoteAdmissionAction
  readonly caller: RemoteCaller
  readonly requestToken: string
  readonly targetInstanceId?: string
  readonly delegationTemplateId?: string
  readonly delegationInstanceId?: string
  readonly body?: string
  readonly subject?: string
  readonly payload?: RemoteLosslessRecord
}

/** The TeamRuntime action port (P6-T2 `performAction`). */
export interface RemoteAdmissionPort {
  /**
   * Perform one admission-controlled team action.
   * @returns the `TeamRuntimeActionOutcome` (lossless JSON).
   */
  performAction(request: RemoteAdmissionRequest): RemoteSafeRecord
}

// ---------------------------------------------------------------------------
// Port 7 — lifecycle (LifecycleService, P7-T3)
// ---------------------------------------------------------------------------

/** The member lifecycle port (archive / restore / dispose). */
export interface RemoteLifecyclePort {
  /** @returns the `ArchiveMemberResult` (lossless JSON). */
  archive(teamSessionId: string, instanceId: string): RemoteSafeRecord
  /** @returns the `RestoreMemberResult` (lossless JSON). */
  restore(teamSessionId: string, instanceId: string): RemoteSafeRecord
  /** @returns the `DisposeMemberResult` (lossless JSON). */
  dispose(teamSessionId: string, instanceId: string): RemoteSafeRecord
}

// ---------------------------------------------------------------------------
// Port 8 — override (MutationService + mutation store, P7-T2)
// ---------------------------------------------------------------------------

/** The `override.set` request (a policy-entry mutation). */
export interface RemoteOverrideSetRequest {
  readonly teamSessionId: string
  readonly capability: RemoteCapability
  readonly value: RemotePolicyEntry
  readonly actor: RemoteMutationActor
  readonly scope?: RemoteMutationScope
  readonly targetInstanceId?: string
}

/** The `override.reset` request (a store revocation, D-7). */
export interface RemoteOverrideResetRequest {
  readonly teamSessionId: string
  readonly capability: RemoteCapability
  readonly actor: RemoteMutationActor
  readonly scope?: RemoteMutationScope
  readonly targetInstanceId?: string
}

/** The override (human override / autonomy overlay) port. */
export interface RemoteOverridePort {
  /**
   * Read the stored override/overlay record for the addressed cell.
   * @returns the `StoredMutationRecord` or `null` when no record exists.
   */
  get(
    teamSessionId: string,
    capability: RemoteCapability,
    scope: RemoteMutationScope | undefined,
    targetInstanceId: string | undefined,
  ): RemoteSafeRecord | null
  /**
   * Record a new override/overlay value.
   * @returns the durable `StoredMutationRecord` (lossless JSON).
   */
  set(request: RemoteOverrideSetRequest): RemoteSafeRecord
  /**
   * Revoke the stored record for the addressed cell (audit-preserving:
   * revoked, not deleted — D-7).
   * @returns whether a record was actually revoked.
   */
  reset(request: RemoteOverrideResetRequest): { readonly removed: boolean }
}

// ---------------------------------------------------------------------------
// Port 9 — policyState (mutation store + MutationService, P7-T2)
// ---------------------------------------------------------------------------

/** The `policyState.set` request (an explicit state switch). */
export interface RemotePolicyStateSwitchRequest {
  readonly teamSessionId: string
  readonly target: RemotePolicyStateViewValue
  readonly actor: RemoteMutationActor
}

/** The policy state port (read current view / switch, invariant 40). */
export interface RemotePolicyStatePort {
  /**
   * The current policy state view (latest effective transition replayed).
   * @returns the `PolicyStateView` (lossless JSON).
   */
  read(teamSessionId: string): RemoteSafeRecord
  /**
   * Switch to the requested policy state (explicit switch only).
   * @returns the durable `PolicyStateTransitionRecord` (lossless JSON).
   */
  switchState(request: RemotePolicyStateSwitchRequest): RemoteSafeRecord
}

// ---------------------------------------------------------------------------
// Port 10 — compatibility (CompatibilityProber, P7-T1)
// ---------------------------------------------------------------------------

/** The durable environment-compatibility port. */
export interface RemoteCompatibilityPort {
  /**
   * The current compatibility verdict.
   * @returns the `CompatibilityVerdict` (lossless JSON).
   */
  current(teamSessionId: string): RemoteSafeRecord
  /**
   * Acknowledge one requirement of the current mismatch (bound to the
   * current mismatch + fingerprint; FATAL never ack-able).
   * @returns the verdict after the ack (lossless JSON).
   */
  acknowledge(
    teamSessionId: string,
    requirementId: string,
    acknowledgedBy: string,
    note: string | undefined,
  ): RemoteSafeRecord
  /**
   * Run one fresh probe under the given frozen trigger.
   * @returns the `ProbeOutcome` (verdict + trigger, lossless JSON).
   */
  probe(teamSessionId: string, trigger: RemoteProbeTrigger): RemoteSafeRecord
}

// ---------------------------------------------------------------------------
// Port 11 — handoff (HandoffService + source surface, P7-T5)
// ---------------------------------------------------------------------------

/** The handoff port (read-only prepare + startTeamFromHere, D-6). */
export interface RemoteHandoffPort {
  /**
   * The read-only source-surface summary: what a handoff would freeze.
   * Zero durable writes, no team creation (D-6).
   * @returns the source-surface summary (lossless JSON).
   */
  prepareSource(sourceSessionId: string): RemoteSafeRecord
  /**
   * Start the team from the source session (idempotent by
   * `(sourceSessionId, requestToken)`).
   * @returns the closed `HandoffOperationState` (always `replayed`;
   *   lossless JSON).
   */
  start(
    sourceSessionId: string,
    requestToken: string,
    staged: RemoteLosslessRecord | undefined,
  ): RemoteSafeRecord
}

// ---------------------------------------------------------------------------
// Port 12 — legacy (inspectLegacyTeam, P7-T7)
// ---------------------------------------------------------------------------

/** The read-only legacy Team inspection port (read-only by construction). */
export interface RemoteLegacyPort {
  /**
   * Inspect the legacy metadata under a DSH home.
   * @returns the closed `LegacyTeamInspection` union
   *   (`status: 'legacy-team' | 'native-fallback'`, lossless JSON).
   */
  inspect(
    dshHome: string,
    workspaceCwd: string | undefined,
    projectDir: string | undefined,
  ): RemoteSafeRecord
}

// ---------------------------------------------------------------------------
// Deps + handler contract
// ---------------------------------------------------------------------------

/**
 * The complete dependency surface of the handler layer: exactly 12 ports,
 * none of which is a mirror of the upstream session controller, a session
 * log artifact, or an upstream private API (G8).
 */
export interface RemoteHandlerDeps {
  readonly catalog: RemoteCatalogPort
  readonly intent: RemoteIntentPort
  readonly teamCreate: RemoteTeamCreatePort
  readonly projection: RemoteProjectionPort
  readonly ledger: RemoteLedgerPort
  readonly admission: RemoteAdmissionPort
  readonly lifecycle: RemoteLifecyclePort
  readonly override: RemoteOverridePort
  readonly policyState: RemotePolicyStatePort
  readonly compatibility: RemoteCompatibilityPort
  readonly handoff: RemoteHandoffPort
  readonly legacy: RemoteLegacyPort
}

/**
 * The outcome of one handler call: the typed method value plus the
 * method-specific provenance additions (design note §5).
 */
export interface RemoteHandlerOutcome {
  /** The typed method value (lossless-checked before the reply). */
  readonly data: unknown
  /** `team.getProjection`: the whole-projection generation. */
  readonly projectionGeneration?: number
  /** Admission outcomes: the durable effect sequence of the P6-T2 effect,
   *   when it carries one — `sequence` for `fact-recorded` /
   *   `work-admitted` / `lifecycle-changed`, `ledgerSequence` for
   *   `member-activated` (absent otherwise); the wire cell is `null` when
   *   the effect carries no sequence. */
  readonly effectSequence?: number
}

/**
 * One category handler: serves every method of one catalog category. The
 * dispatcher routes by category; `method` is the exact endpoint.
 */
export type RemoteHandler = (
  method: string,
  params: RemoteMethodParams,
  deps: RemoteHandlerDeps,
) => RemoteHandlerOutcome
