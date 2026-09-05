/**
 * LedgerRepository — the `ledger` store: the durable append-only fact
 * ledger, keyed by `String(sequence)` (no delete).
 *
 * The recovery protocol (roll-forward, never rollback) reconciles against
 * this ledger: sequence gaps are first-class diagnostics
 * (`gaps()`), and a crashed write between the counter increment and the
 * entry write leaves a gap that a later write may fill (the entry put
 * only requires `sequence <= counter`, never contiguity).
 *
 * Allocation uses the public seam's `update` (atomic on the domain write
 * chain): the counter row is bootstrapped with an idempotent put when
 * absent (race-safe: both racers write the identical `value: 0` bytes),
 * then incremented atomically — the increment is the only non-idempotent
 * step, and it is serialized on the write chain.
 *
 * S1-A hook A (lag-tolerant stamp advance, adjudicated R60): this
 * repository is the SINGLE choke point every durable ledger fact passes
 * through (in-tree writers W10-W14, and any future fact writer — the
 * operation journal redrive dedups on `findFact` before reaching `put`,
 * so a replayed fact never appends twice). After a NEW entry is
 * durably written, the repository advances `team_sessions.generation`
 * +1 via the injected `TeamSessionsRepository` — one atomic `update` on
 * the SAME `team_domain` write chain that serialized the fact put,
 * state-durable-before-stamp by construction. The accepted crash window
 * (fact durable, stamp not yet advanced — a lag of exactly one change,
 * caught up at the next mutation) is the documented v1 consistency
 * model; stamp-first ordering is never used.
 *
 * @module @dsh-agent-team/storage/repositories/ledger
 */
import type { LedgerEntry, StorageDomainHandle } from '../schema/index.js';
import { BaseRepository } from './base.js';
import type { TeamSessionsRepository } from './team-sessions.js';
/**
 * The `ledger` repository (append-only journal).
 */
export declare class LedgerRepository extends BaseRepository {
    /** The `team_sessions` repository receiving the S1-A stamp advance. */
    private readonly teamSessions;
    /**
     * @param handle - the open `team_domain` handle.
     * @param teamSessions - the `team_sessions` repository of the SAME
     *   handle (one upstream domain, one write chain); the sole
     *   construction site is `buildDomain`, which passes its own
     *   `teamSessions` instance so stamp and fact serialize on the same
     *   chain.
     */
    constructor(handle: StorageDomainHandle, teamSessions: TeamSessionsRepository);
    /** Read the counter row, or `undefined` before the first allocation. */
    private readCounter;
    /**
     * Allocate the next ledger sequence (atomic, serialized on the domain
     * write chain).
     * @returns the newly allocated sequence (1 on a fresh ledger).
     */
    allocateSequence(): Promise<number>;
    /**
     * Durably put one ledger entry at its allocated sequence.
     *
     * Put rules: the counter must exist (`sequence-not-allocated`), the
     * sequence must not exceed the counter (`unallocated-sequence`), and an
     * occupied sequence raises `duplicate-ledger-entry` (identical bytes are
     * the idempotent no-op). Gaps may be filled later (roll-forward).
     *
     * S1-A hook A: a NEW entry (absent before this put) durably advances
     * `team_sessions.generation` +1 AFTER the entry write is durable; a
     * no-op re-put of identical bytes advances nothing.
     * @param entry - the unknown input, parsed via `parseLedgerEntry`.
     * @returns the frozen entry.
     */
    put(entry: unknown): Promise<LedgerEntry>;
    /**
     * Read one ledger entry by sequence.
     * @returns the frozen entry, or `undefined` when absent (a gap).
     * @throws `RECORD_INVALID` (problem `bad-sequence`) for a non-positive
     *   sequence, or a malformed/non-canonical stored row.
     */
    get(sequence: number): LedgerEntry | undefined;
    /**
     * List every ledger entry (the counter row is excluded), sorted by
     * sequence. Gaps appear as missing sequence numbers in the result.
     */
    list(): LedgerEntry[];
    /**
     * The allocated-but-missing sequences in `1..counter` (empty when the
     * ledger is contiguous or unallocated). This is the crash diagnostic:
     * a gap is expected after a crash between the counter increment and the
     * entry write, and is filled by roll-forward — never by rollback.
     */
    gaps(): number[];
    /**
     * The number of fact entries (the counter row is excluded).
     */
    entryCount(): number;
}
//# sourceMappingURL=ledger.d.ts.map