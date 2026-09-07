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
import { type RemoteLedgerEntryValue } from '../../../remote/src/contracts/types.js';
import type { RemoteSafeRecord } from '../../../remote/src/contracts/remote-safe.js';
import type { RemoteDispatcher } from '../../../remote/src/handlers/dispatch.js';
import type { TeamRootWireRow } from '../team-ownership-index.js';
import type { RemoteHandlerRegistration, RemoteQueryCommandCompletion, ServerPrincipalDerivation, WorkspaceAttachPort } from './types.js';
import type { ServerPrincipalContext } from './s6-principal.js';
import type { TeamDomainRepositories } from '../../../storage/repositories/index.js';
import type { ActionCaller, TeamRuntime, TeamRuntimeActionOutcome } from '../../admission/index.js';
import type { AdmitRootInitialWork } from '../../action-router/index.js';
import type { TeamSessionId } from '../../../contracts/src/index.js';
import type { LifecycleService } from '../../lifecycle/index.js';
import type { MessagingCoordinator, SendTeamMessageOutcome, SendTeamMessageRequest } from '../../messaging/index.js';
import type { AdmittedGovernanceOverride, AdmitGovernanceOverrideArgs, MutationActor, OverrideStorePort, PolicyStateTransitionRecord, PolicyStateView } from '../../mutation/index.js';
import type { CompatibilityProber } from '../../compatibility/index.js';
import type { EnvironmentFact } from '../../../domain/compatibility/src/index.js';
import type { BlueprintCatalog, TeamBlueprint } from '../../../domain/blueprint/src/index.js';
import type { ColdRootBindingInput, FreshRootBindingInput, RootBindingResult } from '../../root-binding/index.js';
import type { HandoffService } from '../../handoff/index.js';
import type { LegacyHomePort, LegacyInspectFn } from './legacy-surface.js';
import type { ProjectionService } from '../../projection/index.js';
/** The stable error codes the S6 remote surfaces throw (CR-4/CR-12 boundary). */
export declare const S6_REMOTE_ERROR_CODES: {
    /** A34 — the ledger-page tracker rejected the page (the 20.5/20.6 boundary). */
    readonly LEDGER_PAGE_REJECTED: "TEAM_REMOTE_LEDGER_PAGE_REJECTED";
    /** A31 — no durable compatibility state to read (fail-closed). */
    readonly COMPATIBILITY_STATE_ABSENT: "TEAM_REMOTE_COMPATIBILITY_STATE_ABSENT";
    /** A31 — the durable compatibility state is structurally malformed. */
    readonly COMPATIBILITY_STATE_MALFORMED: "TEAM_REMOTE_COMPATIBILITY_STATE_MALFORMED";
    /** A31 — the requested PolicyState is outside the bound blueprint's closed set. */
    readonly POLICY_STATE_UNKNOWN: "TEAM_REMOTE_POLICY_STATE_UNKNOWN";
    /** A31 — a catalog revision is not a safe integer (host bug, fail-closed). */
    readonly CATALOG_REVISION_MALFORMED: "TEAM_REMOTE_CATALOG_REVISION_MALFORMED";
    /** A31 — a durable ledger entry is structurally malformed (fail-closed). */
    readonly LEDGER_ENTRY_MALFORMED: "TEAM_REMOTE_LEDGER_ENTRY_MALFORMED";
    /** A31 — handoff.prepare: the production root exposes no source-session read surface. */
    readonly HANDOFF_PREPARE_UNAVAILABLE: "TEAM_HANDOFF_SOURCE_SURFACE_UNAVAILABLE";
    /** A31 — legacy.inspect: no legacy home port is bound to this root. */
    readonly LEGACY_HOME_UNAVAILABLE: "TEAM_REMOTE_LEGACY_HOME_UNAVAILABLE";
    /** A31 — an instance-scoped override request carries no target instance. */
    readonly OVERRIDE_TARGET_REQUIRED: "TEAM_REMOTE_OVERRIDE_TARGET_REQUIRED";
    /** A31 — team.create names a blueprint snapshot the bound TeamSession does not carry. */
    readonly TEAM_CREATE_BLUEPRINT_MISMATCH: "TEAM_REMOTE_TEAM_CREATE_BLUEPRINT_MISMATCH";
    /** D-3 — team.create: the live glue exposes no root-agent start port (a
     *  created team must own a live leader; failing closed). */
    readonly TEAM_CREATE_ROOT_START_UNAVAILABLE: "TEAM_REMOTE_TEAM_CREATE_ROOT_START_UNAVAILABLE";
    /** D-3 — team.create: starting the root (leader) agent of the created or
     *  retained root failed (the durable bind is preserved; the retry
     *  re-drives the start on the cold path). */
    readonly TEAM_CREATE_ROOT_START_FAILED: "TEAM_REMOTE_TEAM_CREATE_ROOT_START_FAILED";
    /** TCM vNext §15.5 — v2 team.create: no registered workspace for the
     *  requested path (typed at the workspace port BEFORE any durable
     *  effect; the upstream reason rides in the message). The closed wire
     *  code the M1 backing vocabulary established for this condition. */
    readonly TEAM_CREATE_WORKSPACE_NOT_FOUND: "TEAM_CREATE_WORKSPACE_NOT_FOUND";
    /** TCM vNext §15.6 — v2 team.create cold retry: the durable
     *  `defaultWorkspace` differs from the requested canonical workspace
     *  path (zero writes). */
    readonly TEAM_CREATE_WORKSPACE_MISMATCH: "TEAM_CREATE_WORKSPACE_MISMATCH";
    /** TCM vNext §15.6 — v2 team.create: the public `Workspace.attachSession`
     *  rejected AFTER the durable bind (the bind is preserved — the typed
     *  retryable failure; the retry re-drives the attach, idempotent
     *  upstream). */
    readonly TEAM_CREATE_WORKSPACE_ATTACH_FAILED: "TEAM_CREATE_WORKSPACE_ATTACH_FAILED";
    /** TCM vNext §15.8 — the Root initial-work paths (the v1 create's
     *  `initialWork` + the v2 `team.admitInitialWork`): the production root
     *  exposes no Root initial-work authority (glue without the
     *  `deliverRootWork` port) — fail-closed BEFORE any durable effect. */
    readonly TEAM_CREATE_ROOT_WORK_UNAVAILABLE: "TEAM_CREATE_ROOT_WORK_UNAVAILABLE";
    /** TCM vNext §15.6 — the Root initial work: same token, different
     *  canonical payload (the strategy's typed ROOT_WORK_PAYLOAD_MISMATCH,
     *  zero writes; mapped onto the M1 closed wire vocabulary). */
    readonly TEAM_CREATE_ROOT_WORK_PAYLOAD_MISMATCH: "TEAM_CREATE_ROOT_WORK_PAYLOAD_MISMATCH";
    /** TCM vNext §15.6 — the Root initial work: a delivery fault (the
     *  durable admission is retained, no terminal fact; the same-token
     *  retry recovers. The strategy's WORK_DELIVERY_FAILED mapped onto the
     *  M1 closed wire vocabulary). */
    readonly TEAM_CREATE_ROOT_WORK_DELIVERY_FAILED: "TEAM_CREATE_ROOT_WORK_DELIVERY_FAILED";
    /** D1 (Team D1-D6 repair v2, remote contract v3) — team.listRoots:
     *  the host wiring exposes no listRoots port (the TeamDomain
     *  repositories are not reachable from this root) — fail-closed
     *  BEFORE any read; never a silent empty list. */
    readonly TEAM_ROOTS_UNAVAILABLE: "TEAM_REMOTE_TEAM_ROOTS_UNAVAILABLE";
    /** D1 (Team D1-D6 repair v2, remote contract v3) — team.ensureRootLive:
     *  the v3 method is reserved; the production host handler is wired by
     *  D2 (over the live glue's `ensureLiveAgent`, A3 Q2). Until then the
     *  method fails closed typed — NEVER a silent success. */
    readonly TEAM_ROOT_LIVE_NOT_IMPLEMENTED: "TEAM_REMOTE_TEAM_ROOT_LIVE_NOT_IMPLEMENTED";
    /** D2-RESERVED (A3 Q2) — the ensureRootLive glue port is absent. */
    readonly TEAM_ROOT_LIVE_PORT_UNAVAILABLE: "TEAM_REMOTE_TEAM_ROOT_LIVE_PORT_UNAVAILABLE";
    /** D2-RESERVED (A3 Q2) — the root has no durable session artifact. */
    readonly TEAM_ROOT_LIVE_NO_DURABLE_ARTIFACT: "TEAM_REMOTE_TEAM_ROOT_LIVE_NO_DURABLE_ARTIFACT";
    /** D2-RESERVED (A3 Q2) — the session is already live OUTSIDE the Team glue. */
    readonly TEAM_ROOT_LIVE_OUTSIDE_TEAM: "TEAM_REMOTE_TEAM_ROOT_LIVE_OUTSIDE_TEAM";
    /** D2-RESERVED (A3 Q2) — the glue start failed for another reason. */
    readonly TEAM_ROOT_LIVE_START_FAILED: "TEAM_REMOTE_TEAM_ROOT_LIVE_START_FAILED";
    /** F9 (F3/F11/F9/T1.4 repair round r1, remote contract v4) —
     *  team.resolveControl: the host wiring exposes no control-service
     *  closure (the durable control plane is not reachable from this
     *  root) — fail-closed BEFORE any decision; NEVER a silent success
     *  (never a default decision, never a no-op). */
    readonly TEAM_RESOLVE_CONTROL_UNAVAILABLE: "TEAM_REMOTE_TEAM_RESOLVE_CONTROL_UNAVAILABLE";
};
export type S6RemoteErrorCode = (typeof S6_REMOTE_ERROR_CODES)[keyof typeof S6_REMOTE_ERROR_CODES];
/**
 * The admission request the `member.create` / `member.send` /
 * `member.followup` handlers build (the structural mirror of the frozen
 * `RemoteAdmissionRequest`). `callerClaim` is the CLIENT'S claim: it is
 * input to the server-side principal derivation (A32) and NEVER authority —
 * the port acts on the derived caller only (plan §20.3, CR-4).
 */
export interface S6RemoteAdmissionRequest {
    readonly rootSessionId: string;
    readonly action: 'create-member' | 'send-message' | 'follow-up';
    /** The client's caller claim (derivation input only). */
    readonly callerClaim: unknown;
    readonly requestToken: string;
    readonly targetInstanceId?: string;
    readonly delegationTemplateId?: string;
    readonly delegationInstanceId?: string;
    readonly body?: string;
    readonly subject?: string;
    readonly payload?: RemoteSafeRecord;
}
/** The `override.set` request (the structural mirror of the frozen shape). */
export interface S6RemoteOverrideSetRequest {
    readonly teamSessionId: string;
    readonly capability: string;
    readonly value: RemoteSafeRecord;
    /** The client's actor claim (derivation input only). */
    readonly actorClaim: unknown;
    readonly scope?: 'team' | 'instance';
    readonly targetInstanceId?: string;
}
/** The `override.reset` request (the structural mirror of the frozen shape). */
export interface S6RemoteOverrideResetRequest {
    readonly teamSessionId: string;
    readonly capability: string;
    /** The client's actor claim (derivation input only). */
    readonly actorClaim: unknown;
    readonly scope?: 'team' | 'instance';
    readonly targetInstanceId?: string;
}
/** The `policyState.set` request (the structural mirror of the frozen shape). */
export interface S6RemotePolicyStateSwitchRequest {
    readonly teamSessionId: string;
    readonly target: RemoteSafeRecord;
    /** The client's actor claim (derivation input only). */
    readonly actorClaim: unknown;
}
/** Port 1/12 — blueprint catalog discovery (`catalog.*`). */
export interface S6RemoteCatalogPort {
    list(): Promise<readonly RemoteSafeRecord[]>;
    get(blueprintId: string, blueprintRevision?: number): Promise<RemoteSafeRecord>;
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
    probe(blueprintId: string, blueprintRevision: number | undefined, environmentFacts: readonly RemoteSafeRecord[]): Promise<RemoteSafeRecord>;
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
    create(rootSessionId: string, blueprintId: string, blueprintRevision?: number, initialWork?: RemoteSafeRecord): Promise<RemoteSafeRecord>;
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
    create(rootSessionId: string, blueprintId: string, blueprintRevision: number | undefined, workspace: string | undefined): Promise<RemoteSafeRecord>;
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
    admit(rootSessionId: string, requestToken: string, prompt: string, attachedContext: string | undefined): Promise<RemoteSafeRecord>;
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
    listRoots(): Promise<readonly TeamRootWireRow[]>;
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
    ensureRootLive(teamSessionId: string): Promise<RemoteSafeRecord>;
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
    resolveControl(teamSessionId: string, requestId: string, decision: 'allow' | 'deny', note: string | undefined, caller: ActionCaller): Promise<RemoteSafeRecord>;
}
/** Port 4/12 — the whole-projection observation (`team.getProjection`). */
export interface S6RemoteProjectionPort {
    project(teamSessionId: string): Promise<RemoteSafeRecord>;
}
/** Port 5/12 — the durable ledger behind the D-5 slicer (`team.getLedgerPage`). */
export interface S6RemoteLedgerPort {
    listEntries(teamSessionId: string): Promise<readonly RemoteLedgerEntryValue[]>;
    countEntries(teamSessionId: string): Promise<number>;
}
/** Port 6/12 — member admission over the TeamRuntime facade (`member.*`). */
export interface S6RemoteAdmissionPort {
    performAction(request: S6RemoteAdmissionRequest, caller: ActionCaller): Promise<TeamRuntimeActionOutcome>;
}
/** Port 7/12 — member lifecycle over the LifecycleService (`member.*`). */
export interface S6RemoteLifecyclePort {
    archive(teamSessionId: string, instanceId: string): Promise<RemoteSafeRecord>;
    restore(teamSessionId: string, instanceId: string): Promise<RemoteSafeRecord>;
    dispose(teamSessionId: string, instanceId: string): Promise<RemoteSafeRecord>;
}
/** Port 8/12 — governance overrides over the mutation admission (`override.*`). */
export interface S6RemoteOverridePort {
    get(teamSessionId: string, capability: string, scope?: 'team' | 'instance', targetInstanceId?: string): Promise<RemoteSafeRecord | null>;
    set(request: S6RemoteOverrideSetRequest, caller: ActionCaller): Promise<RemoteSafeRecord>;
    reset(request: S6RemoteOverrideResetRequest, caller: ActionCaller): Promise<{
        readonly removed: boolean;
    }>;
}
/** Port 9/12 — the TeamSession PolicyState over the mutation service (`policyState.*`). */
export interface S6RemotePolicyStatePort {
    read(teamSessionId: string): Promise<RemoteSafeRecord>;
    switchState(request: S6RemotePolicyStateSwitchRequest, caller: ActionCaller): Promise<RemoteSafeRecord>;
}
/** Port 10/12 — the durable compatibility state over the prober (`compatibility.*`). */
export interface S6RemoteCompatibilityPort {
    current(teamSessionId: string): Promise<RemoteSafeRecord>;
    acknowledge(teamSessionId: string, requirementId: string, caller: ActionCaller, note?: string): Promise<RemoteSafeRecord>;
    probe(teamSessionId: string, trigger: string): Promise<RemoteSafeRecord>;
}
/** Port 11/12 — start-a-team-from-here over the handoff service (`handoff.*`). */
export interface S6RemoteHandoffPort {
    prepareSource(sourceSessionId: string): Promise<RemoteSafeRecord>;
    start(sourceSessionId: string, requestToken: string, staged?: RemoteSafeRecord): Promise<RemoteSafeRecord>;
}
/** Port 12/12 — the read-only legacy inspection (`legacy.inspect`). */
export interface S6RemoteLegacyPort {
    inspect(dshHome: string, workspaceCwd?: string, projectDir?: string): Promise<RemoteSafeRecord>;
}
/** The sixteen production ports (the frozen twelve + the T12-V16 messaging
 *  coordinator port + the two TCM vNext §15.6 team-create v2 ports + the
 *  D1 remote-contract-v3 `team.listRoots` port). */
export interface S6RemotePorts {
    readonly catalog: S6RemoteCatalogPort;
    readonly intent: S6RemoteIntentPort;
    readonly teamCreate: S6RemoteTeamCreatePort;
    /** TCM vNext §15.6 (G1) — the v2 workspace-aware `team.create` port. */
    readonly teamCreateV2: S6RemoteTeamCreateV2Port;
    /** TCM vNext §15.6 (G1) — the v2-only `team.admitInitialWork` port. */
    readonly teamAdmitInitialWork: S6RemoteTeamAdmitInitialWorkPort;
    /** D1 (Team D1-D6 repair v2, remote contract v3) — the v3-only
     *  `team.listRoots` port (the durable root ownership list). */
    readonly teamRoots: S6RemoteTeamRootsPort;
    /** D1 (Team D1-D6 repair v2, remote contract v3) — the v3-only
     *  `team.ensureRootLive` port (D1: fails closed typed; D2: the live
     *  glue's Team-mode ensure). */
    readonly teamEnsureRootLive: S6RemoteTeamEnsureRootLivePort;
    /** F9 (F3/F11/F9/T1.4 repair round r1, remote contract v4) — the v4-only
     *  `team.resolveControl` port (the human control-resolution command). */
    readonly teamResolveControl: S6RemoteTeamResolveControlPort;
    readonly projection: S6RemoteProjectionPort;
    readonly ledger: S6RemoteLedgerPort;
    readonly admission: S6RemoteAdmissionPort;
    readonly lifecycle: S6RemoteLifecyclePort;
    readonly override: S6RemoteOverridePort;
    readonly policyState: S6RemotePolicyStatePort;
    readonly compatibility: S6RemoteCompatibilityPort;
    readonly handoff: S6RemoteHandoffPort;
    readonly legacy: S6RemoteLegacyPort;
    /** T12-V16 — the P6-T3 messaging coordinator behind `member.send`:
     *  facade admission + LIVE delivery at admission time (the window-latch
     *  fix; t12v-finding-360s-first-turn.md). The bound-root guard lives in
     *  the port (fail-closed FOREIGN_TEAM on a foreign teamSessionId). */
    readonly messaging: S6RemoteMessagingPort;
}
/** The P6-T3 messaging coordinator port (T12-V16). */
export interface S6RemoteMessagingPort {
    sendTeamMessage(request: SendTeamMessageRequest): Promise<SendTeamMessageOutcome>;
}
/** The root-binding surface the `team.create` port drives. */
export interface S6RootBindingPort {
    bindFresh(input: FreshRootBindingInput): Promise<RootBindingResult>;
    rehydrateCold(input: ColdRootBindingInput): Promise<RootBindingResult>;
}
/** The construction inputs of the S6 remote surfaces (all injected). */
export interface S6RemoteOptions {
    /** The bound root session id (this host's boot root TeamSession). */
    readonly rootSessionId: string;
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
    readonly isOwnedRoot?: (teamSessionId: string) => boolean;
    /**
     * P9-S8 — the host default workspace (the row config): a team created
     * through this remote inherits it on its fresh bind (the team's
     * `defaultWorkspace` — inherited by its members; the projection fold
     * resolves the effective workspace against it). Absent: the created
     * team carries no default workspace.
     */
    readonly defaultWorkspace?: string;
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
    readonly environmentFacts?: () => Promise<readonly EnvironmentFact[]>;
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
    readonly workspaceAttach?: WorkspaceAttachPort;
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
    readonly admitRootInitialWork?: AdmitRootInitialWork;
    /** The open TeamDomain repositories (the durable rows). */
    readonly repositories: TeamDomainRepositories;
    /** The host blueprint catalog (the single bound blueprint). */
    readonly catalog: BlueprintCatalog;
    /** The bound blueprint (policy-state closed set, template quota). */
    readonly blueprint: TeamBlueprint;
    /** The bound leader's instance id (the leader authority). */
    readonly leaderInstanceId: string;
    /** The projection service (durable source + the S6 overlay). */
    readonly projection: ProjectionService;
    /** The TeamRuntime action facade (the ONLY admission authority). */
    readonly runtime: TeamRuntime;
    /** The lifecycle service (the ONLY lifecycle authority). */
    readonly lifecycle: LifecycleService;
    /** The mutation service (the ONLY PolicyState authority). */
    readonly mutationService: {
        switchPolicyState(request: {
            teamSessionId: TeamSessionId;
            target: PolicyStateView;
            actor: MutationActor;
        }): PolicyStateTransitionRecord;
    };
    /** The mutation store's transition rows (the durable PolicyState read). */
    readonly mutationTransitions: (teamSessionId: string) => readonly PolicyStateTransitionRecord[];
    /** The governance-override admission (the ONLY override authority). */
    readonly admitGovernanceOverride: (args: AdmitGovernanceOverrideArgs, store?: OverrideStorePort) => Promise<AdmittedGovernanceOverride>;
    /** The durable override store (list/delete of the addressed record). */
    readonly overrideStore: OverrideStorePort;
    /** The override record identity source (the durable `overrides` rows). */
    readonly overrideRecords: (rootSessionId: string) => readonly RemoteSafeRecord[];
    /** The root binding (fresh + cold). */
    readonly rootBinding: S6RootBindingPort;
    /** The compatibility prober (the ONLY compatibility authority). */
    readonly compatibility: CompatibilityProber;
    /** The handoff service (the ONLY handoff authority). */
    readonly handoff: HandoffService;
    /**
     * The handoff prepare source producer (P8-S7-R4 A28 un-wiring): the
     * EXACTLY-ONE canonical surface freeze + the one-shot NON-MODEL
     * deterministic digest, returned as the remote-safe `summary` payload.
     * ABSENT → `handoff.prepare` fails closed exactly as before (the S5A
     * boot world and test worlds without the DSH session read service).
     */
    readonly handoffPrepare?: (sourceSessionId: string) => Promise<RemoteSafeRecord>;
    /** The frozen legacy reader's operational entry. */
    readonly legacyInspect: LegacyInspectFn;
    /** The legacy home port (ABSENT in the boot world: fail-closed). */
    readonly legacyHome: LegacyHomePort | undefined;
    /** The installed A32 principal derivation (the seam's `current()`). */
    readonly principal: ServerPrincipalDerivation;
    /**
     * The P6-T3 messaging coordinator (the live send path: facade admission
     * + the durable intent fact, LIVE delivery of the attributed input, the
     * confirmation fact). The `member.send` remote method routes through it
     * (T12-V16: the pre-fix admission-only facade call left every relay
     * intent undelivered until a `recoverPendingDeliveries` scan happened to
     * run — the T12 window latch of runs #5-#13).
     */
    readonly messaging: MessagingCoordinator;
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
    readonly startRootAgent?: (rootSessionId: string) => Promise<void>;
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
    readonly ensureRootLive?: (rootSessionId: string) => Promise<void>;
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
        readonly rootSessionId: string;
        readonly caller: ActionCaller;
        readonly requestId: string;
        readonly decision: 'allow' | 'deny';
        readonly note?: string;
    }) => Promise<RemoteSafeRecord>;
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
    readonly listRoots?: () => Promise<readonly TeamRootWireRow[]>;
    /** The deterministic clock (ISO-8601). */
    readonly now: () => string;
}
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
export declare function mergeProbeEnvironmentFacts(hostFacts: readonly EnvironmentFact[], callerFacts: readonly EnvironmentFact[]): readonly EnvironmentFact[];
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
export declare function createS6RemotePorts(options: S6RemoteOptions): S6RemotePorts;
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
export declare function createS6RemoteDispatcher(ports: S6RemotePorts, principal: ServerPrincipalDerivation, principalContext?: ServerPrincipalContext): RemoteDispatcher;
/**
 * Register the production dispatcher on the public seam (the frozen
 * register semantics, mirrored: one channel, the idempotent disposer).
 * @param ports - the thirteen production ports.
 * @param principal - the installed A32 principal derivation.
 * @param principalContext - the trusted PrincipalContext of the mounting
 *   transport (T12-B4; defaults to the connection-gate basis).
 * @returns the `RemoteHandlerRegistration` the A31 seam installs.
 */
export declare function createS6RemoteRegistration(ports: S6RemotePorts, principal: ServerPrincipalDerivation, principalContext?: ServerPrincipalContext): RemoteHandlerRegistration;
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
export declare function createS6RemoteQueryCommandCompletion(ports: S6RemotePorts, options: Pick<S6RemoteOptions, 'rootSessionId' | 'isOwnedRoot'>, dispatcher: RemoteDispatcher): RemoteQueryCommandCompletion;
/** The S6 remote surfaces the production root installs into the seams. */
export interface S6RemoteSurfaces {
    /** A31 — the registration the `remoteHandlerRegistration` seam installs. */
    readonly registration: RemoteHandlerRegistration;
    /** A34 — the completion the `remoteQueryCommandCompletion` seam installs. */
    readonly completion: RemoteQueryCommandCompletion;
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
export declare function createS6RemoteSurfaces(options: S6RemoteOptions): S6RemoteSurfaces;
//# sourceMappingURL=s6-remote.d.ts.map