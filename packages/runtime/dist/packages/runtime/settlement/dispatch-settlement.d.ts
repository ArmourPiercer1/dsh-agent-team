import type { ContractEffectEvidence, ExecutionSettlementRecord, ExecutionSettlementStore, SettlementState } from './execution-settlement.js';
/** The typed refusal a wrapper call raises before/after the body. */
export declare class DispatchSettlementRefusal extends Error {
    readonly code: string;
    readonly details: Readonly<Record<string, unknown>>;
    constructor(code: string, detail: string, details?: Record<string, unknown>);
}
/** The host-side execution context this wrapper reads. */
export interface DispatchCallExec {
    readonly callId?: unknown;
    readonly signal?: {
        readonly aborted?: boolean;
    };
    readonly agent?: unknown;
    readonly [key: string]: unknown;
}
/** Trusted provenance for the physical attempt (never model-supplied). */
export interface DispatchProvenance {
    readonly rootSessionId: string;
    readonly agentInstanceId: string;
    readonly toolName: string;
}
/** The admission the caller's guard already decided (a REFERENCE, not a verdict factory). */
export interface DispatchAdmissionDecision {
    readonly decision: 'allow' | 'deny';
    readonly decisionId: string;
    readonly decisionDigest: string;
    readonly decisionKind: string;
    readonly decidedAt?: string;
}
/** What an observer may report about the effect; every field is optional. */
export interface DispatchObservation {
    readonly effectEvidence?: ContractEffectEvidence;
    readonly observedEffects?: readonly {
        readonly kind: string;
        readonly target: string;
        readonly evidenceId: string;
    }[];
}
/** The input handed to a caller-supplied observer. */
export interface DispatchObserverInput {
    readonly args: unknown;
    readonly exec: DispatchCallExec;
    readonly value?: unknown;
    readonly error?: unknown;
}
/** A trusted effect observer (the ONLY source of an observed effect reference). */
export type DispatchObserver = (input: DispatchObserverInput) => DispatchObservation | void;
/** Where a settlement fault was observed (never silently swallowed). */
export type DispatchSettlementPhase = 'invocation' | 'admission' | 'running' | 'observation' | 'terminal' | 'fallback';
/** The context handed to `onSettlementError`. */
export interface DispatchSettlementErrorContext {
    readonly phase: DispatchSettlementPhase;
    readonly executionId?: string;
    readonly toolName?: string;
}
/** Options for {@link createSettlementObservingDefinition}. */
export interface DispatchSettlementOptions {
    /** THE writer binding: one store per wrapper, captured for the wrapper's life. */
    readonly store: ExecutionSettlementStore;
    /** Trusted provenance, or a resolver over the call (never over model arguments). */
    readonly provenance: DispatchProvenance | ((args: unknown, exec: DispatchCallExec) => DispatchProvenance);
    /** ControlRequest legs this execution references (read-only). */
    readonly controlRequestIds?: readonly string[] | ((exec: DispatchCallExec) => readonly string[]);
    /** The guard's already-made admission decision, if it has one. */
    readonly admission?: (exec: DispatchCallExec) => DispatchAdmissionDecision | undefined;
    /** The only source of observed effects. Absent = nothing observed is claimed. */
    readonly observe?: DispatchObserver;
    /** Injectable clock (the default is the wall clock, ISO-8601 UTC). */
    readonly clock?: () => string;
    /** Called for every settlement fault; returning normally never changes the result. */
    readonly onSettlementError?: (error: unknown, context: DispatchSettlementErrorContext) => void;
}
/** The structural shape this wrapper knows how to wrap. */
export interface DispatchToolDefinition {
    readonly name?: string;
    execute(args: unknown, exec: DispatchCallExec): unknown;
    readonly [key: string]: unknown;
}
/**
 * Turn ONE tool definition into a settlement-observing definition.
 *
 * The returned definition carries every other field of the input by reference
 * (name, description, parameter schema, render, …); only `execute` is wrapped.
 * The wrapper is inert unless a caller constructs it with a store — no
 * production path imports this module.
 */
export declare function createSettlementObservingDefinition<T extends DispatchToolDefinition>(definition: T, options: DispatchSettlementOptions): T;
/** The ExecutionId this wrapper would mint for a physical attempt (for tests/diagnostics). */
export declare function dispatchExecutionId(provenance: Pick<DispatchProvenance, 'rootSessionId' | 'agentInstanceId'>, hostCallId: string): string;
/** The states a wrapper will not re-drive (exported so a caller can pre-check). */
export declare function isTerminalSettlementState(state: SettlementState): boolean;
/** Read-through helper: the record a wrapped call produced (for diagnostics/tests). */
export declare function readDispatchSettlement(store: ExecutionSettlementStore, executionId: string): ExecutionSettlementRecord | null;
//# sourceMappingURL=dispatch-settlement.d.ts.map