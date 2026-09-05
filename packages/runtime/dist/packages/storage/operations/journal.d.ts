/**
 * The operation journal engine (TaskDoc §11.5 P4-T2).
 *
 * Implements the vNext crash model (Development Plan §17.3, Architecture
 * §14.4) over the P4-T1 `operations` and `ledger` repositories:
 *
 * ```text
 * PREPARED operation → idempotent effects → ledger fact → COMMITTED
 * ```
 *
 * with the generation CAS (`expectedGeneration`) as the optimistic
 * concurrency guard on the journal row, and roll-forward (never rollback)
 * as the only recovery strategy: a crash between ANY two durable writes
 * leaves a state that re-driving the same operation converges to the same
 * durable result. The engine performs ZERO deletes: sidecar rows are never
 * rolled back, only reconciled forward (orphan rows — e.g. an externally
 * created child session whose TeamDomain writes never landed — are
 * diagnosed by their absence from the journal, Development Plan §17.4).
 *
 * Team scoping: one journal instance is bound to ONE TeamSession
 * (`rootSessionId`). The frozen v1 `OperationRecord` carries no team field
 * (the operations store is global across teams), so team scoping is a
 * journal-level concern: the request needs no root (the journal adds it),
 * and every ledger fact this journal writes (or reads for
 * `lastApplied()`/`factSequence()`) is verified against the bound team.
 *
 * `lastAppliedOperationId` embodiment: the frozen v1 target DTOs carry no
 * such field (verified by inspection of `packages/contracts`), so the
 * durable "this operation was applied to this team" marker is the ledger
 * FACT's `operationId` link: `lastApplied()` returns the operation id of
 * the highest-sequence fact of the bound team that links one.
 *
 * Concurrency: per-operationId process-local async serialization (a chain
 * of settled promises) COMPLEMENTS — it does not replace — the domain
 * write chain. There is no cross-process guarantee (Architecture §14.4:
 * in-domain write serialization only); a second process re-driving the
 * same operation relies on the row-level CAS and the ledger/repository
 * conflict tags to fail loudly instead of double-applying.
 *
 * Error discipline: every failure is a `TeamDomainError`; consumers branch
 * on `code` + `details.problem` (see `JOURNAL_PROBLEMS`), never on
 * message text.
 * @module @dsh-agent-team/storage/operations/journal
 */
import { type RootSessionId } from '../../contracts/src/index.js';
import type { TeamDomain } from '../repositories/index.js';
import { type EffectsResolver, type OperationJournal } from './types.js';
/**
 * Build the operation journal of one TeamSession.
 *
 * @param domain - The open TeamDomain (sole sidecar access for the protocol AND for the effects).
 * @param rootSessionId - The team (root session id) this journal is scoped to.
 * @param effects - Optional intent → idempotent effects resolver (bound once; the resolver of an intent type must stay stable for the lifetime of that operation).
 * @throws `RECORD_INVALID` (`normalizeValidationError`) when `rootSessionId` is not a valid root session id.
 */
export declare function createOperationJournal(domain: TeamDomain, rootSessionId: RootSessionId | string, effects?: EffectsResolver): OperationJournal;
//# sourceMappingURL=journal.d.ts.map