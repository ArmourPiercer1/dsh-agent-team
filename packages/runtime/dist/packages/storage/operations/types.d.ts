/**
 * OperationJournal protocol types (TaskDoc §11.5 P4-T2).
 *
 * The vNext TeamDomain is not a cross-table ACID database (Architecture
 * §14.4): every TeamDomain write, the external DSH Session/Agent creation,
 * and the ledger append are separate durable boundaries with a crash
 * possible between any two of them (Development Plan §17.3). The protocol
 * this module types is the crash model made executable:
 *
 * ```text
 * PREPARED operation (journal row — the first durable write)
 * → idempotent effects (check-then-apply through the TeamDomain
 *    repositories; an effect whose target record already exists from a
 *    previous attempt is detected and SKIPPED, never re-applied)
 * → ledger fact (duplicate-prevented per operationId)
 * → COMMITTED (terminal journal row)
 * ```
 *
 * Recovery defaults to roll-forward / reconcile, never rollback: a crash
 * anywhere leaves a durable state that re-driving the SAME operation
 * (same operationId, same idempotency key, same canonical intent)
 * converges to the same durable result (Development Plan §17.3).
 *
 * The protocol vocabulary here is intentionally small; every failure is a
 * `TeamDomainError` whose stable `code` and `details.problem` the
 * consumer branches on (never on message text). The problem tags below are
 * the ENGINE-level additions on top of P4-T1's row-level tags
 * (`terminal-operation`, `idempotency-conflict`, `non-monotonic-update`,
 * `unallocated-sequence`, ...):
 *
 * - `idempotency-conflict` — same operationId re-submitted with a
 *   different idempotency key, a different canonical intent, or a ledger
 *   fact already committed under a different team (RECORD_DUPLICATE);
 * - `stale-generation` — the caller's generation CAS
 *   (`expectedGeneration`) does not match the durable row (RECORD_INVALID);
 * - `operation-not-found` — drive/fail on an operationId with no durable
 *   journal row (RECORD_INVALID);
 * - `child-session-conflict` — a different external child session identity
 *   is already durably recorded for the operation (RECORD_DUPLICATE);
 * - `unclassified-effect-error` — an effect threw something that is not a
 *   TeamDomain/contracts error (SEAM_FAILURE, mirroring the
 *   `BaseRepository.updateRaw` classification discipline).
 *
 * Pure module: types and constants only, no I/O.
 * @module @dsh-agent-team/storage/operations/types
 */
import type { ChildSessionId, RootSessionId } from '../../contracts/src/index.js';
import type { OperationIntent, OperationPhase, OperationRecord } from '../schema/index.js';
import type { TeamDomain } from '../repositories/index.js';
/**
 * The engine-level problem tags of the operation protocol (the
 * `details.problem` values a consumer may branch on).
 */
export declare const JOURNAL_PROBLEMS: {
    /** Same operationId, different idempotency key / canonical intent / team fact. */
    readonly IDEMPOTENCY_CONFLICT: "idempotency-conflict";
    /** The caller's generation CAS does not match the durable row. */
    readonly STALE_GENERATION: "stale-generation";
    /** No durable journal row for the operationId. */
    readonly OPERATION_NOT_FOUND: "operation-not-found";
    /** A different external child session is already recorded for the operation. */
    readonly CHILD_SESSION_CONFLICT: "child-session-conflict";
    /** The operation is terminal (COMMITTED | FAILED) and immutable. */
    readonly TERMINAL_OPERATION: "terminal-operation";
    /** An effect threw a value that is not a TeamDomain/contracts error. */
    readonly UNCLASSIFIED_EFFECT_ERROR: "unclassified-effect-error";
};
/** One of the engine-level protocol problem tags. */
export type JournalProblem = (typeof JOURNAL_PROBLEMS)[keyof typeof JOURNAL_PROBLEMS];
/**
 * One submission of a logical operation to the journal.
 *
 * Identity is the triple `(operationId, idempotencyKey, canonical intent)`:
 * re-submitting the SAME triple after a partial or complete application is
 * a no-op that returns the original durable result; re-submitting the same
 * `operationId` with a different key or a different canonical intent fails
 * with `idempotency-conflict`.
 */
export interface OperationRequest {
    /** The durable operation id (row key, `/^op-[a-z0-9]{1,32}$/`). */
    readonly operationId: string;
    /** The caller's logical operation identity (idempotency key). */
    readonly idempotencyKey: string;
    /** The typed intent (discriminator + lossless-JSON payload). */
    readonly intent: OperationIntent;
    /** The externally allocated child session (when the operation acts on one). */
    readonly childSessionId?: ChildSessionId;
}
/** The outcome of one idempotent effect application. */
export interface EffectOutcome {
    /** `true` when this attempt performed the durable write; `false` when the effect's target already existed from a previous attempt (skipped, not re-applied). */
    readonly applied: boolean;
}
/** The context handed to every effect of one drive. */
export interface JournalContext {
    /** The open TeamDomain (the ONLY sidecar access an effect may use). */
    readonly domain: TeamDomain;
    /** The team (root session id) this journal is scoped to. */
    readonly rootSessionId: RootSessionId;
    /** The durable journal row the effects act for (PREPARED). */
    readonly operation: OperationRecord;
}
/**
 * One idempotent effect of an operation's apply phase.
 *
 * Contract: `apply` MUST inspect the current durable state through
 * `ctx.domain.repositories` BEFORE writing. When the effect's target record
 * already exists (an earlier attempt applied it), it returns
 * `{ applied: false }` WITHOUT writing; otherwise it writes through the
 * repositories (the repository `put` is byte-idempotent) and returns
 * `{ applied: true }`. An effect that violates this contract re-applies
 * side effects on every retry — the journal cannot police effect internals,
 * it only guarantees the surrounding protocol (prepare → effects → ledger →
 * COMMITTED) is re-driven exactly in that order.
 */
export interface JournalEffect {
    /** Stable diagnostic name (shown in `unclassified-effect-error`). */
    readonly name: string;
    /** Apply (or verify the prior application of) this effect idempotently. */
    apply(ctx: JournalContext): Promise<EffectOutcome>;
}
/** Resolves the effect list of one intent (bound at journal creation). */
export type EffectsResolver = (intent: OperationIntent) => readonly JournalEffect[];
/** Options shared by `execute` and `drive`. */
export interface OperationDriveOptions {
    /**
     * The generation CAS: the journal row generation the caller last saw.
     * `0` asserts the row does not exist yet (fresh prepare). When the
     * durable row disagrees, the call fails with `stale-generation` before
     * any write. Omitted: no CAS (plain roll-forward).
     */
    readonly expectedGeneration?: number;
}
/** The durable result of driving one operation. */
export interface OperationResult {
    /** The operation id. */
    readonly operationId: string;
    /** The durable journal row (COMMITTED after a full drive; the terminal row on a replay). */
    readonly record: OperationRecord;
    /** The phase of `record`. */
    readonly phase: OperationPhase;
    /** The ledger sequence of the operation's fact (present once COMMITTED). */
    readonly ledgerSequence: number | undefined;
    /** Effects durably written by THIS drive (0 on a no-op replay). */
    readonly effectsApplied: number;
    /** Effects detected as already applied and skipped by THIS drive. */
    readonly effectsSkipped: number;
}
/**
 * The operation journal of one TeamSession: the crash-safe
 * PREPARED → effects → ledger → COMMITTED protocol over the P4-T1
 * `operations` and `ledger` repositories (roll-forward, never rollback).
 */
export interface OperationJournal {
    /** The team (root session id) this journal is scoped to. */
    readonly rootSessionId: RootSessionId;
    /**
     * The full protocol in one call: prepare (first durable write) →
     * idempotent effects → ledger fact → COMMITTED. Re-submitting the same
     * request (same operationId + idempotency key + canonical intent) is a
     * no-op that returns the original durable result; the generation CAS
     * (`expectedGeneration`) is checked before any write.
     */
    execute(request: OperationRequest, options?: OperationDriveOptions): Promise<OperationResult>;
    /**
     * Record (or re-verify) the PREPARED journal row — the first durable
     * write of the protocol. Idempotent: an existing row for the same
     * operation is returned as-is (a provided child session is recorded when
     * the row does not carry one yet). Use this, then the external DSH
     * Session/Agent creation, then `recordChildSession`, then `drive` — for
     * operations whose effects depend on an externally allocated child.
     */
    prepare(request: OperationRequest): Promise<OperationRecord>;
    /**
     * Re-drive one durable operation from its stored state (the recovery
     * entry point): verify (CAS) → terminal short-circuit → idempotent
     * effects → duplicate-prevented ledger fact → COMMITTED.
     */
    drive(operationId: string, options?: OperationDriveOptions): Promise<OperationResult>;
    /**
     * Mark one PREPARED operation FAILED (terminal) with a diagnostic.
     * Idempotent for the identical diagnostic; a terminal row is immutable
     * (`terminal-operation`).
     */
    fail(operationId: string, diagnostic: string): Promise<OperationRecord>;
    /**
     * Record the externally allocated child session on one PREPARED
     * operation (the crash window between TeamDomain write A and write B).
     * Idempotent for the same child; a different recorded child fails with
     * `child-session-conflict`; a terminal row is immutable.
     */
    recordChildSession(operationId: string, childSessionId: ChildSessionId | string): Promise<OperationRecord>;
    /** The durable journal row of one operation (all teams), or `undefined`. */
    get(operationId: string): OperationRecord | undefined;
    /** Every durable journal row (all teams), sorted by operation id. */
    list(): OperationRecord[];
    /**
     * The `lastAppliedOperationId` view of this team: the operation id of
     * the highest-sequence ledger fact of this team that links an operation
     * (the durable marker that the operation was applied), or `undefined`.
     */
    lastApplied(): string | undefined;
    /**
     * The ledger sequence of one operation's fact, or `undefined`.
     * @throws `idempotency-conflict` when the fact exists under a different
     *   team than this journal's scope.
     */
    factSequence(operationId: string): number | undefined;
}
//# sourceMappingURL=types.d.ts.map