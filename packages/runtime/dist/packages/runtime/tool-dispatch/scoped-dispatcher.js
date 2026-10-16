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
import { BINDING_TRANSITIONS, } from '../../domain/tool-governance/src/index.js';
import { createGovernedSurface, guardDecision, } from './closed-world-guard.js';
const unverified = (code, message, sideEffectUnknown = false) => ({
    ok: false,
    error: sideEffectUnknown ? { code, message, sideEffectUnknown: true } : { code, message },
});
/** Create one Team Agent's Dispatcher (per-agent closure, zero module state). */
export function createScopedDispatcher(options) {
    const surface = createGovernedSurface({
        agentScopeKey: options.agentScopeKey,
        nativeProviderId: options.nativeProviderId,
        policyGeneration: options.policyGeneration ?? 0,
        authorityGeneration: options.authorityGeneration ?? 0,
    });
    const observe = options.onObserve ?? (() => { });
    let status = 'UNBOUND';
    let policyGeneration = options.policyGeneration ?? 0;
    let authorityGeneration = options.authorityGeneration ?? 0;
    const tokens = new Map();
    let hostDisposeReturned = false;
    const transition = (to, event) => {
        // The transition LAW is PR0's frozen table (REUSE, not a second machine):
        // an illegal order — unmask-before-drain, release-with-in-flight,
        // re-activate-from-draining — comes back as a typed refusal, never a
        // throw and never a silent acceptance.
        const allowed = BINDING_TRANSITIONS[status];
        if (!allowed.includes(to)) {
            const detail = `'${status}' may only advance to: ${allowed.join(', ') || 'none'}`;
            observe({ event: 'dispatcher-transition-refused', from: status, to, detail });
            return unverified('TOOL_BINDING_UNVERIFIED', `dispatcher state ${status} → ${to} is not a legal transition (${detail})`);
        }
        status = to;
        observe({ event, to });
        return { ok: true, value: undefined };
    };
    const decide = (exec) => guardDecision({
        exec,
        scope: { agentScopeKey: options.agentScopeKey, trustedIdentities: options.trustedIdentities },
        surface,
        active: status === 'ACTIVE',
        policyGeneration,
        authorityGeneration,
    });
    const guard = (exec) => {
        const verdict = decide(exec);
        if (verdict.kind === 'abstain')
            return undefined;
        observe({
            event: 'guard-denial',
            tool: exec.name,
            reason: verdict.reason,
            code: verdict.error.code,
            state: status,
        });
        return verdict.error.message;
    };
    return {
        surface,
        state: () => status,
        active: () => status === 'ACTIVE',
        guard,
        decide,
        beginAssembly: () => transition('PREPARING', 'dispatcher-preparing'),
        failAssembly: (reason) => {
            const outcome = transition('UNBOUND', 'dispatcher-assembly-failed');
            if (outcome.ok)
                observe({ event: 'dispatcher-assembly-failed', reason, published: false });
            return outcome;
        },
        publish: () => transition('ACTIVE', 'dispatcher-active'),
        beginDrain: () => {
            const outcome = transition('DRAINING', 'dispatcher-draining');
            if (!outcome.ok)
                return outcome;
            // REFUSE NEW CALLS FIRST, then request cancellation of the in-flight
            // ones (design §4.1 DRAINING). The mask is deliberately untouched.
            for (const token of tokens.values())
                token.cancellationRequested = true;
            observe({ event: 'dispatcher-drain-inflight', outstanding: tokens.size, mask: 'KEPT' });
            return { ok: true, value: undefined };
        },
        tombstone: () => transition('TOMBSTONED', 'dispatcher-tombstoned'),
        release: () => {
            if (tokens.size > 0) {
                // The self-count is the whole point: an upstream dispose that already
                // RETURNED does not settle a body that has not finished.
                observe({ event: 'dispatcher-release-refused', outstanding: [...tokens.keys()], hostDisposeReturned });
                return unverified('EXECUTION_TERMINATION_UNCONFIRMED', `cannot release: ${tokens.size} self-counted call lease(s) are still outstanding (${[...tokens.keys()].join(', ')})${hostDisposeReturned ? ' — the host dispose RETURNED, which is not termination evidence' : ''}`, true);
            }
            const outcome = transition('RELEASED', 'dispatcher-released');
            if (!outcome.ok)
                return outcome;
            observe({ event: 'dispatcher-released', hostDisposeReturned, maskLiftable: true });
            return { ok: true, value: { releasedWithZeroInFlight: true } };
        },
        beginCall: (callId, toolName) => {
            if (status !== 'ACTIVE') {
                return unverified('ADAPTER_DRAINING', `dispatcher is ${status}; new calls (including Asks) are refused: ${toolName}`);
            }
            const existing = tokens.get(callId);
            if (existing !== undefined) {
                return unverified('TOOL_BINDING_UNVERIFIED', `callId "${callId}" already holds an outstanding lease (no double entry)`);
            }
            const token = { callId, toolName, cancellationRequested: false };
            tokens.set(callId, token);
            observe({ event: 'dispatcher-call-begin', callId, tool: toolName, inFlight: tokens.size });
            return { ok: true, value: token };
        },
        endCall: (token) => {
            const current = tokens.get(token.callId);
            if (current === undefined || current !== token)
                return;
            tokens.delete(token.callId);
            observe({ event: 'dispatcher-call-end', callId: token.callId, tool: token.toolName, inFlight: tokens.size });
        },
        endCallById: (callId) => {
            const current = tokens.get(callId);
            if (current === undefined)
                return;
            tokens.delete(callId);
            observe({ event: 'dispatcher-call-end', callId, tool: current.toolName, inFlight: tokens.size });
        },
        requestCancellation: () => {
            for (const token of tokens.values())
                token.cancellationRequested = true;
            observe({ event: 'dispatcher-cancellation-requested', outstanding: tokens.size });
        },
        inFlight: () => tokens.size,
        outstandingCallIds: () => [...tokens.keys()],
        noteHostDisposeReturned: () => {
            hostDisposeReturned = true;
            observe({ event: 'dispatcher-host-dispose-returned', outstanding: tokens.size });
        },
        hostDisposeReturned: () => hostDisposeReturned,
        maskMayLift: () => status === 'RELEASED',
        bindInheritedSurface: (names) => {
            const bound = surface.bindInheritedSurface(names);
            observe({ event: 'dispatcher-bind-inherited', bound, surface: names.length });
            return bound;
        },
        bind: ({ name, origin, binding, verified = true }) => {
            const outcome = surface.bind({ name, origin, binding, verified });
            if (!outcome.ok)
                observe({ event: 'dispatcher-bind-refused', tool: name, code: outcome.error.code });
            return outcome.ok ? { ok: true, value: undefined } : outcome;
        },
        revise: (name, change) => {
            const entry = surface.entryOf(name);
            if (entry === undefined) {
                return unverified('TEAM_TOOL_UNGOVERNED', `revise("${name}"): the name is not governed`);
            }
            const next = Object.freeze({
                ...entry.binding,
                revision: entry.revision + 1,
                ...(change.policyGeneration === undefined ? {} : { policyGeneration: change.policyGeneration }),
                ...(change.authorityGeneration === undefined ? {} : { authorityGeneration: change.authorityGeneration }),
                ...(change.assurance === undefined ? {} : { assurance: change.assurance }),
            });
            const outcome = surface.bind({ name, origin: entry.origin, binding: next, verified: change.verified ?? entry.verified });
            if (!outcome.ok)
                return outcome;
            if (change.policyGeneration !== undefined)
                policyGeneration = change.policyGeneration;
            if (change.authorityGeneration !== undefined)
                authorityGeneration = change.authorityGeneration;
            observe({ event: 'dispatcher-binding-revised', tool: name, revision: next.revision, unloaded: false });
            return { ok: true, value: undefined };
        },
        revalidateSurface: (observedNames) => {
            const observed = new Set(observedNames);
            const governed = new Set(surface.names());
            const added = [...observed].filter((n) => !governed.has(n)).sort();
            const removed = [...governed].filter((n) => !observed.has(n)).sort();
            const unverifiedNames = [];
            for (const name of added) {
                // A `tools/change` event may ONLY re-diagnose. It never binds (that
                // would let a hot registration govern itself) and it never allows:
                // the added name stays OUTSIDE the closed world, so every call to it
                // is denied `TEAM_TOOL_UNGOVERNED` until the trusted assembly binds
                // it. `removed` is recorded for the Coverage diff only — removing a
                // governed name never re-admits the native body.
                unverifiedNames.push(name);
            }
            observe({ event: 'dispatcher-surface-revalidated', added, removed, state: status });
            return { added, removed, unverified: unverifiedNames };
        },
        policyGeneration: () => policyGeneration,
        authorityGeneration: () => authorityGeneration,
    };
}
//# sourceMappingURL=scoped-dispatcher.js.map