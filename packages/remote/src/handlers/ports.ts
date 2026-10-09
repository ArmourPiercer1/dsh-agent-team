/**
 * The backing ports of the Remote handler layer (deviation D-2).
 *
 * The handler layer depends on NO runtime types: its entire dependency
 * surface is these 20 structural ports (12 frozen P8-T3 ports + the two
 * TCM vNext §15.6 create-flavor ports + the two Team D1-D6 repair v2 v3
 * ports + the F3/F11/F9/T1.4 repair round r1 F9 v4 port + the C1
 * restart-0.1.7-rc.1 recovery v5 port + the two team-view-sync-complete
 * v6 ports),
 * each of which the host wiring implements over the runtime APIs
 * (design note §3 table, "Backing API" column). Every port method returns
 * a lossless-JSON-safe record (or `null` where the wire shape allows it):
 * the remote layer never sees a live DSH object.
 *
 * Semantic naming (pre-alpha3 PR-F, plan §F.3): the ports are named for
 * the SEMANTIC decision they serve (the create flavors, the projection
 * shapes), never for a wire contract version — the version -> semantic
 * translation lives in the contracts semantic adapter
 * (`../contracts/semantic.js`), and the category handlers branch on the
 * semantic values only.
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
import type { RemoteTeamGetReadStateValue } from '../contracts/types.js'

// ---------------------------------------------------------------------------
// Port 1 — catalog (BlueprintCatalog, packages/domain/blueprint)
// ---------------------------------------------------------------------------

/** The blueprint catalog read port (pre-creation discovery). */
export interface RemoteCatalogPort {
  /**
   * Every blueprint the catalog knows.
   *
   * A4-PR7 Ruling 1 — records now carry the migration state beside the revisions:
   * `{ blueprintId, revisions: number[], revisionStates: { revision, schemaVersion,
   * migrationState }[] }`, where `migrationState` is `current`,
   * `migration-required` (a version this product DEFINED and retired — the
   * operator's migration backlog) or `unreadable` (a version it never defined, so
   * nothing is owed and nothing can be claimed). Migration visibility is part of
   * DISCOVERY: an operator decides "what is still left to migrate?" from this one
   * read. The state is not selectable by contract version, and it never selects the
   * authority algebra — the A5-12 law is about the wire version, and this is a read
   * of the bound document's version, which is the one thing that law says to read.
   *
   * `schemaVersion` is the version the BLUEPRINT DOCUMENT declares, read out of the
   * stored document. Finding F1 is why that sentence exists: a durable registry row
   * carries its own `schemaVersion`, which is the TeamDomain L3 row stamp and is
   * never a document version, so it is not carried onto this surface at all. When
   * the stored document cannot declare one, the field is ABSENT and the state is
   * `unreadable` — absence is the honest rendering of "this build cannot know",
   * where a default would hand the operator a version to migrate from that nobody
   * ever read.
   * @returns one record per blueprint.
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

/**
 * The TeamSession creation (root binding) port for the `embedded-work`
 * create flavor (the contract v1 wire field set: the optional
 * creation-time `initialWork` admitted inside the create —
 * pre-alpha3 PR-F semantic naming, plan §F.3; the version -> flavor
 * translation lives in the contracts semantic adapter, never here).
 */
export interface RemoteTeamCreateEmbeddedWorkPort {
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
   * Project one TeamSession to its whole read-only view (the `base`
   * projection shape — the exact frozen shape, served for contract
   * versions 1-5; pre-alpha3 PR-F semantic naming, plan §F.3).
   * @returns the exact P8-T1 `TeamProjectionDto` (nine top-level fields,
   *   lossless JSON).
   */
  project(teamSessionId: string): RemoteSafeRecord
  /**
   * The `live` projection shape's ATOMIC read (team-view-sync-complete,
   * PR #35 second follow-up P0-2 — the same-snapshot guarantee; served
   * for contract version 6): the whole projection PLUS its `liveToken`
   * computed FROM THE SAME PROJECTION RESULT. The adapter materializes
   * the live overlay ONCE (the Team-scoped `snapshot(teamSessionId)`),
   * folds it into the member rows, and derives the token from those
   * already-materialized `members[].liveActivity` cells — the frame's
   * live state and the token can NEVER come from two different live
   * snapshots, and no second live read happens on the live-shape path
   * (the lightweight `liveToken` port remains for the v6
   * `team.getReadState` probe, which must NOT build a full projection).
   * @returns the projection (the same lossless-JSON `TeamProjectionDto`
   *   shape as `project`) plus its same-snapshot `liveToken` (a
   *   non-empty opaque `lt-v1-*` string).
   */
  projectLive(teamSessionId: string): {
    projection: RemoteSafeRecord
    liveToken: string
  }
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
/** Re-exported so handler/test authors import wire DTOs from the seam they
 *  already import (the frozen home stays `contracts/types.ts`). */
export type {
  RemoteCorruptControlLegWire,
  RemoteInterventionWireAdministration,
  RemoteInterventionWireItem,
  RemoteInterventionWireSource,
} from '../contracts/types.js'
import type {
  RemoteCorruptControlLegWire,
  RemoteInterventionWireAdministration,
  RemoteInterventionWireItem,
} from '../contracts/types.js'

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
// Port 13 — team.create workspace flavor (workspace-aware creation,
// TCM vNext §15.6)
// ---------------------------------------------------------------------------

/**
 * The `workspace` create-flavor `team.create` port (TCM vNext §15.6 —
 * the contract v2 wire field set; pre-alpha3 PR-F semantic naming, plan
 * §F.3). The workspace-aware creation variant. This flavor is
 * CREATE-ONLY — it never carries initial work (that travels the
 * `team.admitInitialWork` command, port 14, after the root is open).
 * Typed failures raised here (e.g. `TEAM_CREATE_WORKSPACE_*`) pass
 * through the dispatcher unchanged (invariant 4b, the closed backing
 * vocabulary).
 */
export interface RemoteTeamCreateWorkspacePort {
  /**
   * Bind a fresh root (or rehydrate a cold root) for the requested
   * blueprint, resolving `workspace` through the host workspace registry
   * and attaching the root session to it (TCM vNext §2.2/§15.6).
   * @param rootSessionId - the validated root session id.
   * @param blueprintId - the validated blueprint id.
   * @param blueprintRevision - the requested revision, or `undefined`
   *   for the latest.
   * @param workspace - the selected workspace path (the client's
   *   `TeamWorkspaceOption.path`), or `undefined` for the host default
   *   workspace.
   * @returns the same value object as v1:
   *   `{ path: 'fresh-root' | 'cold-root', durable: <state> | null,
   *   bind: <bind result> }` (lossless JSON).
   */
  create(
    rootSessionId: string,
    blueprintId: string,
    blueprintRevision: number | undefined,
    workspace: string | undefined,
  ): RemoteSafeRecord
}

// ---------------------------------------------------------------------------
// Port 14 — team.admitInitialWork (v2-only creation-time initial work,
// TCM vNext §15.6)
// ---------------------------------------------------------------------------

/**
 * The v2-only `team.admitInitialWork` port. The host admits the
 * creation-time initial work for ONE root through the Team
 * compatibility/admission authority with a Root-specific strategy (never
 * the generic Member follow-up; TCM vNext §4.2). Idempotent per
 * `(rootSessionId, requestToken)`: a replayed terminal success
 * redelivers nothing; the same token with a different canonical payload
 * is a typed mismatch. Typed failures raised here (e.g.
 * `TEAM_CREATE_ROOT_WORK_*`) pass through the dispatcher unchanged
 * (invariant 4b, the closed backing vocabulary).
 */
export interface RemoteTeamAdmitInitialWorkPort {
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
  ): RemoteSafeRecord
}

// ---------------------------------------------------------------------------
// Port 15 — team.listRoots (v3-only durable ownership query,
// Team D1-D6 repair v2 D1)
// ---------------------------------------------------------------------------

/**
 * The v3-only `team.listRoots` port: the durable Team root ownership /
 * identity list of the host's TeamDomain (the D1 pure ownership-index
 * module is the production implementation; it reads `teamSessions` /
 * `memberInstances` / `sessionBindings` and FAILS CLOSED on a corrupt or
 * inconsistent row — never a silent empty list). READ-ONLY: no
 * repository writes, no agent effects.
 */
export interface RemoteTeamRootsPort {
  /**
   * The durable root rows, sorted by root session id.
   * @returns the remote-safe root rows, each of the closed wire shape
   *   `{ rootSessionId, blueprintId, revision, defaultWorkspace?,
   *   createdAt, generation, memberCount }` (lossless JSON).
   */
  listRoots(): readonly RemoteSafeRecord[]
}

// ---------------------------------------------------------------------------
// Port 16 — team.ensureRootLive (v3-only Team-mode ensure,
// Team D1-D6 repair v2 D1 — the handler arrives with D2)
// ---------------------------------------------------------------------------

/**
 * The v3-only `team.ensureRootLive` port: guarantees the named persisted
 * root is live IN TEAM MODE (root ownership + Team glue + Leader setup +
 * the `team_*` tools — the A3 Q2 host wiring, wired by D2 over the live
 * glue's `ensureLiveAgent`). Until D2, the production S6 handler serves
 * the method with the typed `TEAM_REMOTE_TEAM_ROOT_LIVE_NOT_IMPLEMENTED`
 * failure (never a silent success). The typed failure vocabulary this
 * port will raise (A3 Q2): the glue port absent
 * (`TEAM_REMOTE_TEAM_ROOT_LIVE_PORT_UNAVAILABLE`), the root with no
 * durable session artifact (`TEAM_REMOTE_TEAM_ROOT_LIVE_NO_DURABLE_ARTIFACT`),
 * the session already live OUTSIDE the Team glue
 * (`TEAM_REMOTE_TEAM_ROOT_LIVE_OUTSIDE_TEAM`), and the other glue
 * start failures (`TEAM_REMOTE_TEAM_ROOT_LIVE_START_FAILED`).
 */
export interface RemoteTeamEnsureRootLivePort {
  /**
   * Ensure the named root is live in Team mode.
   * @param teamSessionId - the validated TeamSession (root session) id.
   * @returns the closed success shape
   *   `{ rootSessionId, mode: "team", live: true }` (lossless JSON).
   */
  ensureRootLive(teamSessionId: string): RemoteSafeRecord
}

// ---------------------------------------------------------------------------
// Port 17 — team.resolveControl (v4-only human control resolution,
// F3/F11/F9/T1.4 repair round r1 F9)
// ---------------------------------------------------------------------------

/**
 * The v4-only `team.resolveControl` port: the human ingress of the durable
 * control plane (F9). The host resolves ONE pending control request of
 * ONE owned team through the existing control-service authority
 * (`CONTROL_RESOLVER_ROLES` + the durable exactly-once decision
 * semantics — unchanged; this port is the command surface, not a second
 * authority). The wire carries NO caller/role/principal fields
 * (adjudication U3): the production host (the S6 plugin) derives the
 * human principal from the T12-B4 connection-gate authority basis — the
 * trusted authenticated UI/session ownership — and stamps it on the
 * service call (the S6 async port carries the derived caller; this pure
 * port's synchronous signature is the contract layer's, where no
 * derivation exists). Typed failures raised here (the control service's
 * closed `CONTROL_*` vocabulary + the reused facade's
 * `TEAM_RUNTIME_*` codes) pass through the dispatcher unchanged
 * (invariant 4b).
 */
export interface RemoteTeamResolveControlPort {
  /**
   * Resolve one pending control request (allow / deny).
   * @param teamSessionId - the validated TeamSession (root session) id.
   * @param requestId - the validated opaque control request id.
   * @param decision - the frozen decision (`allow` / `deny`).
   * @param note - the decider's free-form note (1..2048), or `undefined`.
   * @returns the durable decision record (lossless JSON).
   */
  resolveControl(
    teamSessionId: string,
    requestId: string,
    decision: 'allow' | 'deny',
    note: string | undefined,
  ): RemoteSafeRecord
}

// ---------------------------------------------------------------------------
// Port 18 — team.prepareOrdinaryOpen (v5-only one-shot ordinary-activation
// permit, C1 restart-0.1.7-rc.1 recovery — guide §10.2)
// ---------------------------------------------------------------------------

/**
 * The v5-only `team.prepareOrdinaryOpen` port: the narrow one-shot
 * ordinary-activation PERMIT of the Team fence (guide §10.2). The host
 * arms the fence's per-root one-shot activation permit for the given Team
 * root (process-local, single-use, TTL-bounded; the armed permit expires
 * silently if never consumed — there is NO revoke RPC; an unconsumed
 * permit on a failed client-side native open simply lapses). This is a
 * Team CONTROL-PLANE RPC: it performs NO Team ensure, NO Team Agent side
 * effect, and no TeamDomain mutation beyond the one-shot activation-allow
 * fact. The production S6 handler (the A33/A34 host wiring, s6-remote)
 * raises the typed failures: a root outside the caller's team
 * (`TEAM_REMOTE_FOREIGN_TEAM`, via `assertBoundRoot`) and the permit port
 * absent from the host wiring
 * (`TEAM_REMOTE_TEAM_ORDINARY_OPEN_PORT_UNAVAILABLE` — fail closed,
 * never a silent success); both pass through the dispatcher unchanged
 * (invariant 4b).
 */
export interface RemoteTeamPrepareOrdinaryOpenPort {
  /**
   * Arm the one-shot ordinary-activation permit for the named Team root.
   * @param teamSessionId - the validated TeamSession (root session) id.
   * @returns the closed success shape (lossless JSON): at least
   *   `{ rootSessionId, permitted: true }`.
   */
  prepareOrdinaryOpen(teamSessionId: string): RemoteSafeRecord
}

// ---------------------------------------------------------------------------
// Port 19 — team.getReadState (v6-only authoritative per-session read-state,
// team-view-sync-complete Phase 2)
// ---------------------------------------------------------------------------

/**
 * The v6-only `team.getReadState` port: the authoritative per-session
 * read-state query over the host's durable TeamDomain rows. The durable
 * rows are the SOLE authority:
 *
 * - a `team-root` / `team-member` answer requires a positively readable
 *   durable row (the `session_bindings` row, corroborated by the
 *   `team_sessions` / `member_instances` rows; a disposed member still
 *   resolves to the member relation, marked `disposed`);
 * - only a successful read that positively confirms no affiliation may
 *   answer `none` (an explicit `ordinary` binding or the confirmed
 *   absence of every durable affiliation);
 * - EVERY storage/integrity failure (corrupt row, non-canonical bytes,
 *   seam failure, missing corroborating row) FAILS CLOSED by throwing —
 *   a storage error is never translated into a `none` answer.
 *
 * READ-ONLY: no repository writes, no agent effects, no generation
 * advance.
 */
export interface RemoteTeamReadStatePort {
  /**
   * Resolve the session to its Team affiliation (or a confirmed none).
   * @param sessionId - the validated session id (any kind).
   * @returns the closed read-state value (see
   *   `RemoteTeamGetReadStateValue`).
   * @throws the storage layer's typed error on any storage/integrity
   *   failure (fail closed).
   */
  readState(sessionId: string): RemoteTeamGetReadStateValue
}

// ---------------------------------------------------------------------------
// Port 20 — liveToken (v6 semantic-live-state token,
// team-view-sync-complete Phase 2)
// ---------------------------------------------------------------------------

/**
 * The v6 `liveToken` port: the deterministic opaque token over ONE team's
 * SEMANTIC live state — the sorted per-member `{ instanceId, residency }`
 * pairs of the team's non-disposed durable member rows (residency
 * `resident` / `resuming` / `cold`). The token is a pure function of that
 * semantic state: it EXCLUDES `lastActivityAt` / `now()` / `generatedAt`
 * and every per-process counter (nothing that resets on host restart),
 * and it is NEVER folded into the durable generation. It is recomputed
 * fresh on every call (the overlay snapshot is the single source); an
 * all-cold state after a restart is a genuine semantic state and produces
 * a well-defined token of its own.
 *
 * Scope (PR #35 second follow-up P0-2): this port serves the LIGHTWEIGHT
 * v6 `team.getReadState` probe ONLY — the probe must NOT build a full
 * projection. The `live` projection shape does not consult it: its token
 * comes from the ATOMIC `RemoteProjectionPort.projectLive` read (the
 * token is computed from the same projection result — same snapshot).
 */
export interface RemoteLiveTokenPort {
  /**
   * Compute the deterministic live token for one team.
   * @param teamSessionId - the validated TeamSession (root session) id.
   * @returns the deterministic opaque token (a non-empty string).
   * @throws the storage layer's typed error if the team's durable rows
   *   cannot be read (fail closed — no fallback token).
   */
  liveToken(teamSessionId: string): string
}

// ---------------------------------------------------------------------------
// Deps + handler contract
// ---------------------------------------------------------------------------

/**
 * The complete dependency surface of the handler layer: exactly 20 ports
 * (the 12 frozen P8-T3 ports + the two TCM vNext §15.6 create-flavor
 * ports (the workspace flavor + the initial-work admission) + the two
 * Team D1-D6 repair v2 v3 ports + the F9 v4 port + the C1
 * restart-0.1.7-rc.1 recovery v5 port + the two team-view-sync-complete
 * v6 ports: the authoritative per-session read-state port and the
 * semantic-live-state token port), none of which is a mirror of the
 * upstream session controller, a session log artifact, or an upstream
 * private API (G8).
 */
// ---------------------------------------------------------------------------
// A4-PR6 §6.B — the v8 intervention seam (port 14 on the runtime side;
// the twenty-first port of the generic dispatcher)
// ---------------------------------------------------------------------------

/** The closed `intervention.act` request (the frozen client payload rule). */
export interface RemoteInterventionActRequest {
  readonly teamSessionId: string
  readonly interventionId: string
  readonly action: 'allow' | 'deny' | 'escalate' | 'acknowledge'
  readonly note?: string
}

/**
 * The v8 intervention seam. Every method is a pure READ or a VERB that
 * routes to ONE authoritative server-side entry (the ControlService
 * decision/escalate entries, the GovernanceWarning acknowledgement): the
 * port NEVER re-implements decisioning and NEVER accepts a client-chosen
 * authority. The handler validates the returned values against the closed
 * wire shapes (`contracts/types.ts`).
 */
export interface RemoteInterventionPort {
  /** The team's current intervention items (server-derived projection). */
  list(request: {
    readonly teamSessionId: string
  }): { readonly items: readonly RemoteInterventionWireItem[] }
  /** One item by id; typed `INTERVENTION_NOT_FOUND` when absent. */
  get(request: {
    readonly teamSessionId: string
    readonly interventionId: string
  }): { readonly item: RemoteInterventionWireItem }
  /** The single verb entry (authority re-derived server-side, A1-2). */
  act(request: RemoteInterventionActRequest): {
    readonly outcome: 'decided' | 'escalated' | 'acknowledged' | 'already-acknowledged'
  }
  /**
   * The permission-administration read. The port may return a RICH
   * record; the handler STRIPS it to the closed wire fields — the strip is
   * the handler's law, so authority-bearing cells cannot reach the wire
   * even through a port regression.
   */
  permissionAdministration(request: {
    readonly teamSessionId: string
    readonly memberInstanceId?: string
  }): { readonly administration: RemoteInterventionWireAdministration }
}

// ---------------------------------------------------------------------------
// A4-PR7 W1 — contract v9: the corrupt-leg visibility read seam
// ---------------------------------------------------------------------------

/**
 * The v9 corrupt-leg visibility seam. The single method is a pure READ
 * that surfaces the control service's `listControlState().corruptLegs` —
 * the strict reader's refusal list. The port is the ONLY channel: it does
 * NOT re-parse or re-judge ledger rows (the control service stays the
 * SOLE authority on approval state, `packages/tools/src/guard.ts`), it
 * re-exposes the service's already-built `ControlCorruptLegRecord` echo.
 * RULING 5-B warning-first: this is VISIBILITY only — the read never
 * isolates, gates, or selects execution semantics. The handler projects
 * it to the closed bounded wire (`corruptControlLegsValue`, `team.ts`).
 */
export interface RemoteTeamCorruptControlLegsPort {
  /** The team's full corrupt-leg list (ascending ledger sequence,
   *  exactly as `ControlService.listControlState()` returns it). */
  listCorruptLegs(request: {
    readonly teamSessionId: string
  }): { readonly corruptLegs: readonly RemoteCorruptControlLegWire[] }
}

export interface RemoteHandlerDeps {
  readonly catalog: RemoteCatalogPort
  readonly intent: RemoteIntentPort
  readonly teamCreateEmbeddedWork: RemoteTeamCreateEmbeddedWorkPort
  readonly teamCreateWorkspace: RemoteTeamCreateWorkspacePort
  readonly teamAdmitInitialWork: RemoteTeamAdmitInitialWorkPort
  readonly teamRoots: RemoteTeamRootsPort
  readonly teamEnsureRootLive: RemoteTeamEnsureRootLivePort
  readonly teamResolveControl: RemoteTeamResolveControlPort
  readonly teamPrepareOrdinaryOpen: RemoteTeamPrepareOrdinaryOpenPort
  readonly teamReadState: RemoteTeamReadStatePort
  readonly liveToken: RemoteLiveTokenPort
  readonly projection: RemoteProjectionPort
  readonly ledger: RemoteLedgerPort
  readonly admission: RemoteAdmissionPort
  readonly lifecycle: RemoteLifecyclePort
  readonly override: RemoteOverridePort
  readonly policyState: RemotePolicyStatePort
  readonly compatibility: RemoteCompatibilityPort
  readonly handoff: RemoteHandoffPort
  readonly legacy: RemoteLegacyPort
  /**
   * A4-PR6 §6.B (contract v8): the intervention plane + the
   * `override.getPermissionAdministration` read. OPTIONAL on purpose: the
   * pre-v8 fakes and surfaces keep compiling UNCHANGED (the frozen
   * `p8t3-helpers` fake set is part of the v1 contract surface and is not
   * re-authored by the v8 bump); an UNWIRED v8 surface answers the four
   * v8-only methods with a typed refusal (`internal-error`, reason
   * `port-unwired`) and every v1–v7 method byte-for-byte. A production
   * host that serves v8 MUST wire this port.
   */
  readonly intervention?: RemoteInterventionPort
  /**
   * A4-PR7 W1 (contract v9): the corrupt-leg visibility read over the
   * control service's `listControlState().corruptLegs`. OPTIONAL on
   * purpose (the v8 `intervention` precedent): the pre-v9 fakes and
   * surfaces keep compiling UNCHANGED; an UNWIRED v9 surface answers
   * `team.listCorruptControlLegs` with a typed refusal (`internal-error`,
   * reason `port-unwired` — never a silently empty success) and every
   * v1–v8 method byte-for-byte. A production host that serves v9 MUST
   * wire this port.
   */
  readonly teamControlCorruption?: RemoteTeamCorruptControlLegsPort
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
