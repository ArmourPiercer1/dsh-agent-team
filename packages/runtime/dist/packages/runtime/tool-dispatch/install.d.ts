/**
 * Alpha.5 PR1 (plan §4) — the ASSEMBLY INSTALL of the closed-world Guard and
 * the Stable Scoped Dispatcher on one Team Agent's public seams.
 *
 * WHY THIS FILE EXISTS (design §4.1 PREPARING, verbatim order):
 *
 *     1. install the closed-world Guard            (`tools.guard`, monotonic)
 *     2. mask the inherited names to be taken over (`tools.restrict`)
 *     3. register the STABLE Dispatcher Definition (`tools.register`)
 *     4. validate presets / MCP / scope / output / Provider capabilities
 *     5. PUBLISH (PREPARING → ACTIVE)
 *
 * Any failure before (5) means the Agent is NOT published — the AgentSetup
 * contract already rolls an unpublished agent back, and the Guard installed
 * in (1) refuses everything while the state is not ACTIVE, so a half-built
 * assembly is never a runnable Agent.
 *
 * THE ORDER IS THE SECURITY PROPERTY, and the disposer preserves it in
 * reverse-minus-the-Guard (NEG-1, the PoC's `L3-hazard` leg): the host's
 * teardown habit is "lift the restriction, then drop the listener", and that
 * order lets the ToolRuntime's late dispatch re-resolution fall back to the
 * NATIVE BODY (the PoC measured it: 原体 ran once). Here the composite
 * disposer therefore:
 *
 *     beginDrain()            → new calls refused, in-flight cancellation
 *     (no restrict lift)      → the mask STAYS for the whole drain
 *     wait for the self-count → only then tombstone()
 *     tombstone()             → late callbacks keep meeting the same refusal
 *     release()               → refuses while a self-counted lease is open
 *     only at RELEASED        → the mask may lift, and the Guard goes last
 *
 * The Guard is the LAST thing removed and the FIRST thing installed. A host
 * that never lets the count reach zero keeps the mask and the Guard forever
 * — a leaked mask is a resource problem; a lifted mask is a safety problem.
 *
 * FAIL-CLOSED SERVICES (plan §4 "缺少必需 Service 时不接受 Cordis Fiber 静默
 * PENDING 当作已完成装配"): {@link requireService} turns "the service is
 * absent / malformed" into a typed assembly failure rather than a fiber that
 * merely sits PENDING (NEG-8 in the PoC: a missing service surfaces as
 * PENDING with an EMPTY tool surface, which looks like a successful mount
 * from outside).
 *
 * What it touches upstream, all PUBLIC: `agentCtx.tools.guard`,
 * `agentCtx.tools.schemas(scope)`, `agentCtx.on('tools/change')` (diagnostics
 * only — see {@link ScopedDispatcher.revalidateSurface}), and the
 * {@link MaskPort} the caller already owns (`applyBuiltInToolDeny`). It never
 * reaches into a registry, never imports a private module, never mutates the
 * global layer.
 *
 * @module @dsh-agent-team/runtime/tool-dispatch/install
 */
import type { GovernanceResult } from '../../domain/tool-governance/src/index.js';
import { type GuardExecView } from './closed-world-guard.js';
import { type ScopedDispatcher, type ScopedDispatcherOptions } from './scoped-dispatcher.js';
/** The public `ToolGuard` shape (structural; the host owns the real type). */
export type GuardFn = (exec: GuardExecView) => string | undefined;
/** The agent-scoped public seams this install needs (structural). */
export interface ScopedGuardAgentCtx {
    readonly tools: {
        readonly guard?: (guard: GuardFn) => () => void;
        readonly schemas?: (scope?: unknown) => readonly unknown[];
        /**
         * The Host's public definition accessor (`get(name, scope)`): the ONE
         * publicly reachable seam that says WHICH Body a name resolves to right
         * now. Without it the closed world has no way to notice that a verified
         * name started pointing at somebody else's Body, so it is a REQUIRED
         * dependency of the assembly, not an optional extra.
         */
        readonly get?: (name: string, scope?: unknown) => unknown;
    };
    readonly on?: (event: string, listener: (...args: never[]) => unknown) => () => void;
}
/**
 * THE PROVIDER SIDE OF THE SAME IDENTITY LAW (pb §6 binding feed). An
 * assembly that PLACES a Definition holds the very object it registered;
 * this is how it records that placement's identity in the SAME algebra the
 * Guard compares against at every call. It is the only way a provider can
 * say "the Body I reviewed and placed is THIS Body" without stringifying
 * the Body (which leaks and is spoofable by re-stringifying) and without
 * reading a clock (which this lane never does).
 */
export declare function definitionIdentityOf(target: unknown): string | null;
/**
 * One pb §6 binding-feed entry: the identity the PROVIDER — the trusted Team
 * assembly, the side that PLACES the reviewed Definitions — recorded at
 * placement time for one name, plus the realm that placement lives in.
 *
 * This is the "verified Definition identity → per-call comparison input"
 * channel: the provider's own placement record, never a registry guess. The
 * Guard's per-call side stays exactly what PR1 froze — the scoped public
 * read must still resolve to THIS identity on every call, or the call is
 * refused and the verification withdrawn.
 */
export interface BindingFeedEntry {
    /** Identity of the Definition this assembly placed (see {@link definitionIdentityOf}). */
    readonly definitionIdentity: string;
    /** The realm the placement lives in; must equal the assembly's `realmId`. */
    readonly realmId: string;
}
/** The provider-side feed: the placement record for one name, or none. */
export type BindingFeed = (name: string) => BindingFeedEntry | undefined;
/** The mask the assembly owns (design §4.1 step 2), handed over for the drain. */
export interface MaskPort {
    /** Lift the inherited-name restriction. Called ONLY at RELEASED. */
    readonly lift: () => void;
    readonly names?: readonly string[];
}
/** The `tools/change` diagnostics the install reports (never a permission). */
export interface SurfaceRevalidation {
    readonly added: readonly string[];
    readonly removed: readonly string[];
    /** The names that appeared after assembly and are therefore DENIED. */
    readonly denied: readonly string[];
    /**
     * The governed names whose CURRENT definition no longer matches the one their
     * Binding pinned. Each has already been revised DOWN to unverified, so its
     * next call is refused; only an explicit re-bind by the trusted assembly
     * restores it (PR1 Gate R2's refuse-and-rebind flow).
     */
    readonly drifted?: readonly string[];
}
/** The handle the assembly holds until the Agent is released. */
export interface ScopedGuardHandle {
    readonly dispatcher: ScopedDispatcher;
    /** PREPARING until {@link publish}: everything is refused before it. */
    readonly publish: () => GovernanceResult<void>;
    /** Bind the names THIS assembly registered in its own layer. */
    readonly bindOwnTools: (names: readonly string[]) => GovernanceResult<void>;
    /** Bind the names an MCP reconcile provably introduced. */
    readonly bindMcpTools: (names: readonly string[]) => GovernanceResult<void>;
    /** Re-read the surface after a `tools/change` event (diagnostics only). */
    readonly revalidate: () => SurfaceRevalidation;
    /** The ordered teardown: refuse → drain (mask KEPT) → tombstone → release. */
    readonly disposeOrdered: () => GovernanceResult<void>;
    /** Read the current agent-scoped surface names (fails closed typed). */
    readonly surfaceNames: () => GovernanceResult<readonly string[]>;
    readonly observations: () => readonly Record<string, unknown>[];
    /**
     * The calls this lane currently holds a cancellable watch on: between the
     * dispatch door and the settled edge. A teardown asks this; a non-zero answer
     * that never drains is a leak.
     */
    readonly pendingCalls: () => readonly {
        callId: string;
        name: string;
        state: string;
    }[];
    /**
     * Whether the cancellation mechanism has an actual notification behind it on
     * this Host: `armed` = subscribed (the assembly is supported), `proven` = a
     * notification has been delivered at least once. Reported, never assumed.
     */
    readonly changeChannelStatus: () => 'armed' | 'proven';
}
/**
 * Map one host `ToolExecution` (the pinned `ToolGuard` parameter) to the
 * host-neutral {@link GuardExecView}. The identity facts the Guard verifies
 * are exactly what the public execution object exposes: the calling `Agent`
 * (the registry's own scope routing key) through its Agent id, else its
 * durable session header id. A tool name is never an identity, and an exec
 * with NO identity is not an anonymous pass (NEG-2: a Team-origin dispatch
 * that lost its Agent is refused, not laundered into the global lane).
 */
export declare function hostExecToView(exec: unknown): GuardExecView;
/** Inputs of {@link installScopedToolGuard}. */
export interface InstallScopedGuardInput extends ScopedDispatcherOptions {
    readonly agentCtx: ScopedGuardAgentCtx;
    /** The canonical runtime Agent — the scope key `tools.schemas` takes. */
    readonly runtimeAgent: unknown;
    /**
     * The inherited names this assembly masks (design §4.1 step 2). The Guard
     * itself does not mask — the caller's `applyBuiltInToolDeny` does — but the
     * install records them, because "the mask outlives the Dispatcher" is a
     * fact the ordered teardown has to be able to state.
     */
    readonly maskedNames?: readonly string[];
    /**
     * The assembly's EXPLICIT trusted native list — the only names that may be
     * inherited as `dsh-native` without a real Team Binding. The caller derives
     * it from the Host's public GLOBAL view (`tools.schemas()` with no scope);
     * it is never derived from the agent-scoped surface being governed, because
     * a name that is merely visible to this Agent is not a native one.
     */
    readonly nativeNames?: readonly string[];
    /**
     * Names this assembly (or the Team glue it belongs to) registered itself.
     * They are subtracted from {@link nativeNames} defensively: even if a Team
     * tool lands in the global layer, it can never inherit a native Binding,
     * because the assembly knows its own contributions.
     */
    readonly assemblyOwnedNames?: readonly string[];
    /**
     * THE REALM THIS ASSEMBLY PLACES IN (pb §6 binding feed). A placement
     * identity is only ever evidence inside the realm that made it; an entry
     * naming any other realm is refused, never compared across the boundary
     * (design §2.1: Realm 不可混淆 — a same name in another realm is a
     * different world, and NC-1 measured what trusting it would cost).
     */
    readonly realmId?: string;
    /**
     * THE pb §6 BINDING FEED — the provider side of the per-call comparison.
     * The trusted assembly hands, per name, the identity it RECORDED when it
     * PLACED that Definition; `bindOwnTools` then verifies the LIVE scoped
     * resolution against the provider's record instead of silently pinning
     * whatever the seam happens to answer today. ABSENT (or no entry for a
     * name) = the pre-feed path byte-for-byte — this seam only ever tightens:
     *  - placement attribution: an entry is honoured ONLY for a name the
     *    assembly declared it placed (`assemblyOwnedNames`); a feed entry for
     *    any other name is a laundering attempt and REFUSES the bind;
     *  - realm pairing: `entry.realmId` must equal this assembly's `realmId`;
     *  - placement integrity: the current scoped read must resolve to the
     *    recorded identity — a Body that moved between placement and bind is
     *    a refusal, never a re-pin of the shadow.
     */
    readonly bindingFeed?: BindingFeed;
    /**
     * U6 PR2 — THE KERNEL-OWNED NAME GUARD (center-assembly enforcing seam;
     * a PORT, not a second identity law). For every name this port answers
     * `owns(name) === true`, the dispatch gate adds exactly one delta over
     * the armed-once law the settled edge still applies to every other name:
     * after `next()` resolves, the gate RE-RESOLVES the live definition and
     * compares it against BOTH the identity this door pinned and the identity
     * the center's approval table binds; a SUCCESS-shaped result whose Body
     * moved is converted into a fail-closed refusal (the settled edge's
     * alarm-only law would deliver a result the table no longer backs). A
     * cancelled or error-shaped settle keeps its native shape, and a
     * kernel-owned SUCCESS whose Body did NOT move keeps the native success
     * shape untouched (sup-a §5 cond 10). Identity questions stay owned by
     * the Guard's existing live-vs-feed law — this port only feeds it the
     * table's answer and consumes the veto. ABSENT = today's behavior
     * byte-for-byte for every name.
     */
    readonly kernelGuard?: {
        /** Does the center kernel own this name (table-backed enforcing set)? */
        readonly owns: (name: string) => boolean;
        /** The ONE identity the center table binds for the name; null = the
         *  table holds no entry — the pb §6 feed stays silent for that name, so
         *  no call of it ever binds, and the door refuses it before this check
         *  is reached (the refusal lives in the bind path, not here). */
        readonly identityFor: (name: string) => string | null;
    };
    /**
     * The restriction this assembly installed (design §4.1 step 2). The Handle
     * owns its lifetime: an armed Guard means the mask is NEVER lifted by the
     * ordinary disposer drain, because "lift the restriction, then drop the
     * adapter" is precisely the NEG-1 hazard order. The lift happens ONLY at
     * RELEASED, inside {@link ScopedGuardHandle.disposeOrdered}.
     */
    readonly maskPort?: MaskPort;
}
/**
 * The required-Service check that replaces the silent `PENDING` (plan §4).
 * A Cordis fiber whose service is absent does not throw at mount: it sits
 * PENDING and the tool surface simply comes back EMPTY (PoC NEG-8), so the
 * assembly must ask for each dependency explicitly and fail loudly.
 */
export declare function requireService<T>(value: T | undefined | null, what: string, predicate?: (value: NonNullable<T>) => boolean): GovernanceResult<NonNullable<T>>;
/**
 * Install the Guard + Dispatcher on ONE Team Agent scope (design §4.1
 * PREPARING steps 1 and 3; the caller performs step 2 between them).
 *
 * The returned handle starts in PREPARING — the Guard is ALREADY armed and
 * already refusing while the caller finishes the assembly (mask, own-layer
 * registrations, MCP, capability validation). {@link
 * ScopedGuardHandle.publish} is the only door to ACTIVE.
 */
export declare function installScopedToolGuard(input: InstallScopedGuardInput): GovernanceResult<ScopedGuardHandle>;
//# sourceMappingURL=install.d.ts.map