/**
 * CompatibilityRepository — the `compatibility` store: the durable
 * compatibility state per TeamSession, keyed by root session id (one row
 * per team).
 *
 * The state carries the frozen P3-aligned status, the environment/input
 * fingerprint, the requirement outcomes, and the explicit human
 * acknowledgements (the `DEGRADED_ACKNOWLEDGED` path). Storage validates
 * the closed shape only; the semantic evaluation of requirements stays in
 * the P3 policy domain.
 *
 * @module @dsh-agent-team/storage/repositories/compatibility
 */
import type { CompatibilityStateRecord, StorageDomainHandle } from '../schema/index.js';
import { BaseRepository } from './base.js';
/**
 * The `compatibility` repository.
 */
export declare class CompatibilityRepository extends BaseRepository {
    /**
     * @param handle - the open `team_domain` handle.
     */
    constructor(handle: StorageDomainHandle);
    /**
     * Durably put one compatibility state, keyed by root session id.
     * Idempotent when the identical bytes are stored; a different state at
     * the same key raises `RECORD_DUPLICATE` (problem
     * `duplicate-compatibility-state`).
     * @param state - the unknown input, parsed via
     *   `parseCompatibilityState` (closed shape).
     * @returns the frozen record.
     */
    put(state: unknown): Promise<CompatibilityStateRecord>;
    /**
     * Atomically REPLACE one compatibility state, CONDITIONED on the generation
     * the caller read (A4-PR7 `compat-atomic`; the owner ruling on the
     * p6t1-flake escalation).
     *
     * THE LAW — what this guarantees, and what it does not:
     *
     * - **One state transition, one durable write, no absent window.** The row
     *   goes from the record the caller read to the record the caller writes.
     *   This method never deletes, so the `delete`-then-`put` sequence has no
     *   moment at which the row is observable as ABSENT — neither by another
     *   consultation, nor by a crash landing between the two writes (a crashed
     *   write leaves the PREVIOUS row on disk: the seam writes tmp, renames, and
     *   does not advance memory when the write dies).
     * - **The generation check runs inside the write-chain slot.** The
     *   comparison against `expectedGeneration` happens in the `fn` of the
     *   seam's atomic `update` (`KvTable.update`: "atomic read-modify-write on
     *   the domain's write chain: `fn` sees the value current at its queue
     *   slot"), the same established pattern as
     *   `TeamSessionsRepository.advanceGeneration`. Two writers conditioned on
     *   the same generation therefore CANNOT both commit: the loser's `fn`
     *   throws before any write, so the loser is REPORTED
     *   (`RECORD_DUPLICATE`, problem `stale-generation-compatibility-state`,
     *   both generations and both fingerprints in `details`) and the winner's
     *   row survives untouched. A lost race is detectable, never silently
     *   destructive.
     * - **The cold transition is a create, not a compare-and-set.** A caller
     *   that read NO row passes `expectedGeneration: 0`; the transition is the
     *   single durable write of `put`, whose occupied-key rule reports a
     *   concurrent creator as `RECORD_DUPLICATE` (problem
     *   `duplicate-compatibility-state`). DISCLOSED RESIDUAL, stated exactly:
     *   that occupied-key check reads the row OUTSIDE the write-chain slot, and
     *   the public seam offers no conditional create (`update` rejects a missing
     *   key with `missing-key`), so a create whose gate read lands BEFORE a
     *   concurrent create's write is not detectable at this seam. Its outcome is
     *   bounded: two cold candidates carry the same generation and the same
     *   fingerprint (both probed the same live facts) and differ only in
     *   `computedAt`, so the surviving row is always ONE probe's complete,
     *   well-formed record — never absent, never torn, never a state no probe
     *   computed — and every reader, including the loser's own consultation,
     *   re-reads the row, so no reader can observe bytes no writer committed.
     *   Closing that last window needs a conditional create in the seam, i.e. an
     *   upstream (`CORE_SEAM_BLOCKER`) change: out of this lane's budget, named
     *   rather than hidden.
     *
     * `put`'s documented semantics are NOT changed: "identical bytes are a
     * no-op, different bytes are `RECORD_DUPLICATE`" still holds for `put` and
     * for its other users. This method adds a conditioned transition beside it.
     *
     * @param state - the unknown input, parsed via `parseCompatibilityState`.
     * @param expectedGeneration - the generation the caller read; `0` means the
     *   caller read no row at all (the cold transition is a create).
     * @returns the frozen record as stored after this transition.
     * @throws `RECORD_DUPLICATE` when the row moved on (problem
     *   `stale-generation-compatibility-state`) or was occupied by another
     *   creator (problem `duplicate-compatibility-state`); `RECORD_INVALID` for
     *   a malformed input, a malformed stored candidate, or a non-integer
     *   expected generation; a warm transition whose row is no longer there
     *   rejects as `SEAM_FAILURE` with `details.seamCode` = `missing-key`, the
     *   public read-modify-write contract of the seam — the same identity
     *   `teamSessions.advanceGeneration` rejects with over a missing team row
     *   (`g8s1-stamp-advance.test.ts`), and this repository adds nothing to it.
     */
    replaceIfGeneration(state: unknown, expectedGeneration: number): Promise<CompatibilityStateRecord>;
    /**
     * Read one compatibility state by root session id.
     * @returns the frozen record, or `undefined` when absent.
     * @throws `RECORD_INVALID` (contracts code preserved) for a malformed
     *   root session id, or a malformed/non-canonical stored row.
     */
    get(rootSessionId: string): CompatibilityStateRecord | undefined;
    /**
     * List every compatibility state of one team. There is at most one row
     * per root session (the key is the root session id), so this returns a
     * single-element or empty array; it exists so store audits can iterate
     * uniformly across repositories.
     * @param rootSessionId - the team (root session id) to list.
     */
    list(rootSessionId: string): CompatibilityStateRecord[];
    /**
     * Durably delete one compatibility state.
     * @returns `true` when the state existed, `false` otherwise.
     */
    delete(rootSessionId: string): Promise<boolean>;
}
//# sourceMappingURL=compatibility.d.ts.map