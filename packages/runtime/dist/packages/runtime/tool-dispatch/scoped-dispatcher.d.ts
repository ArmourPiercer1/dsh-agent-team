/**
 * Alpha.5 PR1 (plan §4, design §4.1) — the STABLE SCOPED DISPATCHER and its
 * assembly state machine.
 *
 * THE MACHINE (PR0 froze the transitions; this is the runtime that walks
 * them, design §4.1 verbatim order):
 *
 *   UNBOUND → PREPARING → ACTIVE → DRAINING → TOMBSTONED → RELEASED
 *
 *  - PREPARING — the Guard is installed FIRST, the inherited-name mask
 *    SECOND, the stable Dispatcher Definition LAST (`install.ts` owns that
 *    order); a required Service that is not READY fails the assembly — a
 *    Cordis fiber that merely sits PENDING is NOT "assembled" (NEG-8 in the
 *    PoC: missing services surface as a silent PENDING fiber with an empty
 *    tool surface, which looks like success from the outside).
 *    Any failure goes `PREPARING → UNBOUND` and the Agent is NOT published;
 *  - ACTIVE — the registered ToolDefinition shape never changes. A policy /
 *    binding CHANGE flips an immutable REVISION inside the Binding
 *    ({@link ScopedDispatcher.revise}); the name is never unloaded to "let
 *    the native body come back" (NEG-1 is exactly that shape);
 *  - DRAINING — NEW calls and new Asks are refused from the first instant
 *    (`beginCall` refuses, the Guard refuses), in-flight calls are
 *    cancellation-requested, and the mask STAYS;
 *  - TOMBSTONED — stale references to the old Agent object keep meeting the
 *    same refusal (late callbacks, deferred result projection);
 *  - RELEASED — reachable ONLY when the Dispatcher's OWN counter of
 *    outstanding calls/leases is zero.
 *
 * THE SELF-COUNT IS THE POINT (plan §4: "必须记录自己持有的 lease/token 数，
 * 而非仅检查 Cordis Dispose 已返回"). `dispose()` returning is an upstream
 * fact about upstream bookkeeping; it proves nothing about a body that is
 * still running, a promise that has not settled, or a ToolRuntime that
 * re-resolved a late dispatch. So this object counts what IT handed out,
 * refuses to reach RELEASED while its own count is non-zero, and reports the
 * refusal as the §5 `EXECUTION_TERMINATION_UNCONFIRMED` error with
 * `sideEffectUnknown: true` — never as a silent "released".
 *
 * Purity: no `node:*`, no I/O, no timers, no DSH import. The caller (the
 * live glue / the install) owns the seams, the timers and the mask; this
 * module owns the ordering law.
 *
 * @module @dsh-agent-team/runtime/tool-dispatch/scoped-dispatcher
 */
import { type BindingState, type GovernanceResult, type ToolBinding } from '../../domain/tool-governance/src/index.js';
import { type GuardExecView, type GovernedOrigin, type GovernedSurface, type GuardVerdict } from './closed-world-guard.js';
/** One outstanding call the Dispatcher handed out (self-counted). */
export interface CallToken {
    readonly callId: string;
    readonly toolName: string;
    /** Flipped by `requestCancellation` — the body's own abort signal source. */
    cancellationRequested: boolean;
}
/** The observations this Dispatcher emits (the evidence channel). */
export type DispatcherObservation = Readonly<Record<string, unknown>> & {
    readonly event: string;
};
/**
 * What the name resolves to AT THE MOMENT OF THE CALL, as read through the
 * Host's public `tools.get(name, scope)` seam.
 *
 * The Resolver is an assembly-supplied function, held by the Dispatcher, so
 * the definition check sits on the decision path itself and no caller can
 * forget to perform it. An assembly that cannot supply one gets
 * `{ ok: false }` for every call, which is a REFUSAL: PR1 Gate R2 forbids
 * "could not read the definition, so assume the Body did not change".
 */
export type DefinitionProbe = {
    readonly ok: true;
    readonly fingerprint: string;
} | {
    readonly ok: false;
    readonly detail: string;
};
/** Options of {@link createScopedDispatcher}. */
export interface ScopedDispatcherOptions {
    readonly agentScopeKey: string;
    readonly trustedIdentities: readonly string[];
    /** The generations ACTIVE calls are validated against (re-read per call). */
    policyGeneration?: number;
    authorityGeneration?: number;
    readonly nativeProviderId?: string;
    /** The assembly's explicit trusted native list (see `GovernedSurfaceOptions`). */
    readonly nativeNames?: readonly string[];
    /** Read the CURRENT definition of one name at the public seam (F2). */
    readonly resolveDefinition?: (name: string) => DefinitionProbe;
    /**
     * How many public seams a correct assembly must have armed before it may
     * publish (the Guard plus its waterfall edges). The install declares each as
     * it arms it; a shortfall is an assembly failure, never a degraded Guard
     * (PR1 Gate R3). Default 5 = guard + pre-execute + execute + post-execute +
     * result.
     */
    readonly requiredSeams?: number;
    readonly onObserve?: (observation: DispatcherObservation) => void;
}
/** The handle the assembly installs and later drains. */
export interface ScopedDispatcher {
    readonly surface: GovernedSurface;
    readonly state: () => BindingState;
    readonly active: () => boolean;
    /** The Guard body to register on the public `tools.guard` seam. */
    readonly guard: (exec: GuardExecView) => string | undefined;
    /** The per-call verdict (exposed for tests and the dispatcher body path). */
    readonly decide: (exec: GuardExecView) => GuardVerdict;
    /**
     * Seam bookkeeping (PR1 Gate R3). `armSeam` is called by the install for each
     * public seam it successfully registers; `publish` refuses while the count is
     * short, so a Guard that silently lost an edge cannot present itself as an
     * assembled one — and a permanently short count is a failure the caller sees,
     * not a `RELEASED` that quietly happens anyway.
     */
    readonly armSeam: (seam: string) => void;
    readonly disarmSeam: (seam: string) => void;
    readonly seamsArmed: () => readonly string[];
    readonly requiredSeams: () => number;
    readonly beginAssembly: () => GovernanceResult<void>;
    readonly failAssembly: (reason: string) => GovernanceResult<void>;
    readonly publish: () => GovernanceResult<void>;
    readonly beginDrain: () => GovernanceResult<void>;
    readonly tombstone: () => GovernanceResult<void>;
    readonly release: () => GovernanceResult<{
        readonly releasedWithZeroInFlight: true;
    }>;
    readonly beginCall: (callId: string, toolName: string) => GovernanceResult<CallToken>;
    readonly endCall: (token: CallToken) => void;
    /**
     * End the lease one EXECUTION holds, by its callId. The result edge
     * (`tools/post-execute`) sees the execution, not the token this Dispatcher
     * handed out, so it ends by identity. An unknown callId is a no-op: the
     * result edge also fires for calls that never reached dispatch (a Guard
     * denial, for instance), and those never took a lease.
     */
    /**
     * End one lease by its callId, with the REASON that authorises it:
     *  - `'refused'` — a Gate of ours turned this call away, so its Body
     *    provably never ran. This ends the lease in ANY state: it is not evidence
     *    we are accepting from the host, it is a fact we created, and a call we
     *    refused must not be the reason a teardown can never finish.
     *  - `'settled'` (default) — the host says the call settled. Accepted ONLY
     *    while ACTIVE: after the drain began, a callback crossing that boundary
     *    cannot be authenticated as "the Body returned before the state changed"
     *    (PR1 Gate R4), so it is recorded and refused, and the half-state stands.
     */
    readonly endCallById: (callId: string, reason?: 'refused' | 'settled') => {
        readonly ended: boolean;
        readonly state: BindingState;
    };
    /**
     * A result exists for this call (the `tools/post-execute` edge). This is
     * DIAGNOSTIC ONLY and never ends a lease: on the pinned registry a result can
     * be in hand while the Body is still alive, so treating it as termination is
     * the NEG-1 hazard again. The lease ends at `tools/result`, the edge the
     * registry dispatches after the Body settled.
     */
    readonly noteResultObserved: (callId: string) => void;
    /**
     * The caller (the assembly, which owns the clock) says it stopped waiting for
     * a drain to settle. The lane reads no timer, so the decision is handed in:
     * from here `release()` refuses permanently and the mask and Guard stay
     * armed — the half-state is `EXECUTION_TERMINATION_UNCONFIRMED` FOREVER,
     * which is the safe side of "never disarms on an unproven termination".
     */
    readonly noteDrainGiveUp: (reason: string) => GovernanceResult<void>;
    readonly drainGiveUpReason: () => string | null;
    readonly requestCancellation: () => void;
    readonly inFlight: () => number;
    readonly outstandingCallIds: () => readonly string[];
    /** The host told us its dispose returned — recorded, NEVER sufficient. */
    readonly noteHostDisposeReturned: () => void;
    readonly hostDisposeReturned: () => boolean;
    /** The ONLY state in which lifting the inherited-name mask is legal. */
    readonly maskMayLift: () => boolean;
    readonly bindInheritedSurface: (names: readonly string[], identities?: Readonly<Record<string, string>>) => {
        readonly verifiedBound: number;
        readonly unverifiedBound: number;
        readonly unverified: readonly string[];
    };
    readonly bind: (input: {
        readonly name: string;
        readonly origin: GovernedOrigin;
        readonly binding: ToolBinding;
        readonly verified?: boolean;
    }) => GovernanceResult<void>;
    /** Binding CHANGE = a new immutable revision under the same identity. */
    readonly revise: (name: string, change: {
        readonly policyGeneration?: number;
        readonly authorityGeneration?: number;
        readonly assurance?: ToolBinding['assurance'];
        readonly verified?: boolean;
    }) => GovernanceResult<void>;
    /**
     * Re-validation after a `tools/change` event: a diagnosis plus a
     * DOWNGRADE, never a grant. Names that appeared are reported (and stay
     * outside the closed world); names whose CURRENT definition no longer matches
     * what their Binding pinned are REVISED DOWN to unverified, which is the
     * "refuse + re-bind" half of PR1 Gate R2 and the only way a drifted name gets
     * verified again — an explicit re-bind by the trusted assembly.
     */
    readonly revalidateSurface: (observedNames: readonly string[], identities?: Readonly<Record<string, string>>) => {
        readonly added: readonly string[];
        readonly removed: readonly string[];
        readonly unverified: readonly string[];
        readonly drifted: readonly string[];
    };
    readonly policyGeneration: () => number;
    readonly authorityGeneration: () => number;
}
/** Create one Team Agent's Dispatcher (per-agent closure, zero module state). */
export declare function createScopedDispatcher(options: ScopedDispatcherOptions): ScopedDispatcher;
//# sourceMappingURL=scoped-dispatcher.d.ts.map