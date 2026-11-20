import type { ContractBodyOutcome, ContractDispatchState, ContractEffectEvidence, ContractExecutionFact, ExecutionSettlementStore } from './execution-settlement.js';
/** Contract dispatch vocabulary (identical to the store's phase vocabulary). */
export type DispatchState = ContractDispatchState;
/** Contract body-outcome vocabulary (no `not-started`: a fact is about a body). */
export type FactBodyOutcome = ContractBodyOutcome;
/** Contract effect-evidence vocabulary. */
export type FactEffectEvidence = ContractEffectEvidence;
/** One physical execution attempt = one ExecutionId = at most one terminal fact. */
export type ExecutionFact = ContractExecutionFact;
/** The contract interface, verbatim. */
export interface ExecutionSettlementWriter {
    record(fact: ExecutionFact): Promise<{
        recorded: boolean;
        reason?: string;
    }>;
    read(executionId: string): Promise<ExecutionFact | undefined>;
    listUnsettled(rootSessionId: string): Promise<readonly string[]>;
    projectControlResult(args: {
        readonly rootSessionId: string;
        readonly callId: string;
        readonly instanceId?: string;
        readonly outcome: 'succeeded' | 'failed' | 'unknown';
    }): Promise<{
        recorded: boolean;
        requestId?: string;
        reason?: string;
    }>;
}
/** A clock, injectable so tests can pin `recovery.at` on derived reads. */
export type SettlementClock = () => string;
/**
 * Build the contract writer over an existing store.
 *
 * `clock` is only used when a fact has to be DERIVED from a record the adapter
 * did not write (e.g. an admission recorded by the control wiring, or a
 * recovery). Durable timestamps always come from the store record.
 */
export declare function createExecutionSettlementWriter(store: ExecutionSettlementStore, clock?: SettlementClock): ExecutionSettlementWriter;
//# sourceMappingURL=writer-adapter.d.ts.map