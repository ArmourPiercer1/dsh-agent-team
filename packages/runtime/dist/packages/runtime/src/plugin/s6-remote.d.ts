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
import type { RemoteHandlerRegistration, RemoteQueryCommandCompletion, ServerPrincipalDerivation } from './types.js';
import type { ServerPrincipalContext } from './s6-principal.js';
import type { TeamDomainRepositories } from '../../../storage/repositories/index.js';
import type { ActionCaller, TeamRuntime, TeamRuntimeActionOutcome } from '../../admission/index.js';
import type { TeamSessionId } from '../../../contracts/src/index.js';
import type { LifecycleService } from '../../lifecycle/index.js';
import type { MessagingCoordinator, SendTeamMessageOutcome, SendTeamMessageRequest } from '../../messaging/index.js';
import type { AdmittedGovernanceOverride, AdmitGovernanceOverrideArgs, MutationActor, OverrideStorePort, PolicyStateTransitionRecord, PolicyStateView } from '../../mutation/index.js';
import type { CompatibilityProber } from '../../compatibility/index.js';
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
/** Port 2/12 — the pre-creation compatibility probe (`intent.probe`). */
export interface S6RemoteIntentPort {
    probe(blueprintId: string, blueprintRevision: number | undefined, environmentFacts: readonly RemoteSafeRecord[]): Promise<RemoteSafeRecord>;
}
/** Port 3/12 — TeamSession creation via the root binding (`team.create`). */
export interface S6RemoteTeamCreatePort {
    /**
     * Bind a fresh root or rehydrate a cold root for the requested
     * blueprint. `initialWork` (BC-03 / R1-A) is optional: when present it
     * is admitted through the existing work-admission path (the facade's
     * `follow-up` action on the leader instance) as part of the creation;
     * absent, the behavior is unchanged.
     * @returns the value object
     *   `{ path: 'fresh-root' | 'cold-root', durable: <state> | null,
     *   bind: <bind result> }` (lossless JSON).
     */
    create(rootSessionId: string, blueprintId: string, blueprintRevision?: number, initialWork?: RemoteSafeRecord): Promise<RemoteSafeRecord>;
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
/** The thirteen production ports (the frozen twelve + the T12-V16 messaging coordinator port). */
export interface S6RemotePorts {
    readonly catalog: S6RemoteCatalogPort;
    readonly intent: S6RemoteIntentPort;
    readonly teamCreate: S6RemoteTeamCreatePort;
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
    /** The deterministic clock (ISO-8601). */
    readonly now: () => string;
}
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