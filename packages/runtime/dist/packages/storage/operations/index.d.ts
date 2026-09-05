/**
 * Operation protocol surface (TaskDoc §11.5 P4-T2): the crash-safe
 * PREPARED → effects → ledger → COMMITTED journal with generation CAS,
 * duplicate-ledger prevention and roll-forward recovery.
 *
 * Protocol authority: Development Plan §17.3 (crash model, idempotent
 * effects, lastAppliedOperationId, ledger, generation CAS), Architecture
 * §14.4 (no cross-table ACID; single-write durability; in-domain write
 * serialization only). Row/ledger repository semantics: P4-T1
 * (`packages/storage/repositories/operations.ts`, `ledger.ts`).
 * @module @dsh-agent-team/storage/operations
 */
export { createOperationJournal } from './journal.js';
export { JOURNAL_PROBLEMS } from './types.js';
export type { EffectOutcome, EffectsResolver, JournalContext, JournalEffect, JournalProblem, OperationDriveOptions, OperationJournal, OperationRequest, OperationResult, } from './types.js';
//# sourceMappingURL=index.d.ts.map