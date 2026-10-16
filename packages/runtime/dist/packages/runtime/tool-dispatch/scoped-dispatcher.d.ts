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
/** Options of {@link createScopedDispatcher}. */
export interface ScopedDispatcherOptions {
    readonly agentScopeKey: string;
    readonly trustedIdentities: readonly string[];
    /** The generations ACTIVE calls are validated against (re-read per call). */
    policyGeneration?: number;
    authorityGeneration?: number;
    readonly nativeProviderId?: string;
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
    readonly endCallById: (callId: string) => void;
    readonly requestCancellation: () => void;
    readonly inFlight: () => number;
    readonly outstandingCallIds: () => readonly string[];
    /** The host told us its dispose returned — recorded, NEVER sufficient. */
    readonly noteHostDisposeReturned: () => void;
    readonly hostDisposeReturned: () => boolean;
    /** The ONLY state in which lifting the inherited-name mask is legal. */
    readonly maskMayLift: () => boolean;
    readonly bindInheritedSurface: (names: readonly string[]) => number;
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
    /** Re-validation after a `tools/change` event (diagnostic, never a grant). */
    readonly revalidateSurface: (observedNames: readonly string[]) => {
        readonly added: readonly string[];
        readonly removed: readonly string[];
        readonly unverified: readonly string[];
    };
    readonly policyGeneration: () => number;
    readonly authorityGeneration: () => number;
}
/** Create one Team Agent's Dispatcher (per-agent closure, zero module state). */
export declare function createScopedDispatcher(options: ScopedDispatcherOptions): ScopedDispatcher;
//# sourceMappingURL=scoped-dispatcher.d.ts.map