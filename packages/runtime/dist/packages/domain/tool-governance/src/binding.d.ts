/**
 * `ToolBinding` and its assembly state machine (design §4.1, plan §3).
 *
 * THE MACHINE (design §4.1, verbatim order):
 *
 *   UNBOUND → PREPARING → ACTIVE → DRAINING → TOMBSTONED → RELEASED
 *
 *  - PREPARING: mask first, Guard first, Dispatcher last; ANY failure means
 *    the Agent is NOT published (`PREPARING → UNBOUND` is the only back-edge);
 *  - ACTIVE: the ToolDefinition shape stays stable, internals flip immutable
 *    Binding Revisions — never "unload first and let the name fall back";
 *  - DRAINING: no new operations, no new Asks; in-flight calls are cancelled/
 *    drained; masks and the trusted-identity tombstone STAY (NEG-1: lifting
 *    the mask before the in-flight body settles lets the native body run);
 *  - TOMBSTONED: stale references to the old Agent object keep meeting a
 *    final refusal for the Team-trusted identity;
 *  - RELEASED: only after every in-flight Body/ExecutionLease settled with
 *    evidence. Terminal.
 *
 * The refusal is TYPED (`state-transition`), never a throw: a wrong teardown
 * order is a governance fact the caller must see and record.
 *
 * Purity: no `node:*`, no I/O.
 *
 * @module @dsh-agent-team/domain/tool-governance/binding
 */
import { type AssuranceContract, type ExecutionBoundary, type ImplementationOrigin } from './assurance.js';
import { type ParseResult } from './parse-util.js';
/** The binding states, in assembly order (design §4.1). */
export declare const BINDING_STATES: readonly ["UNBOUND", "PREPARING", "ACTIVE", "DRAINING", "TOMBSTONED", "RELEASED"];
/** One binding state. */
export type BindingState = (typeof BINDING_STATES)[number];
/** The legal transitions. Anything else (e.g. ACTIVE←DRAINING, UNBOUND→ACTIVE) is refused. */
export declare const BINDING_TRANSITIONS: Readonly<Record<BindingState, readonly BindingState[]>>;
/** One immutable binding revision (design §4.2). */
export interface ToolBinding {
    readonly bindingId: string;
    /** The trusted Team Agent / Scope key the binding belongs to. */
    readonly agentScopeKey: string;
    /** The executable tool name the binding routes. */
    readonly toolName: string;
    /** The identity of the registered ToolDefinition shape (stable at ACTIVE). */
    readonly definitionIdentity: string;
    readonly providerId: string;
    readonly implementationOrigin: ImplementationOrigin;
    readonly executionBoundary: ExecutionBoundary;
    readonly assurance: AssuranceContract;
    /** Policy generation the binding was validated against. */
    readonly policyGeneration: number;
    /** Authority generation the binding was validated against. */
    readonly authorityGeneration: number;
    /** Immutable revision counter (flipped, never mutated in place). */
    readonly revision: number;
    readonly status: BindingState;
}
/** A binding advance outcome — typed, never thrown. */
export type BindingAdvance = {
    readonly ok: true;
    readonly binding: ToolBinding;
} | {
    readonly ok: false;
    readonly problems: readonly [{
        readonly code: 'state-transition';
        readonly path: string;
        readonly detail: string;
    }];
};
/** Strictly parse one raw binding; the three dimensions must be CONSISTENT. */
export declare function parseToolBinding(raw: unknown): ParseResult<ToolBinding>;
/**
 * Advance one binding along the §4.1 machine. Illegal orders (the NEG-1
 * family: unmask-before-drain, release-with-in-flight, re-activate-from-
 * draining) come back as a typed `state-transition` refusal.
 */
export declare function advanceBindingStatus(binding: ToolBinding, to: BindingState): BindingAdvance;
//# sourceMappingURL=binding.d.ts.map