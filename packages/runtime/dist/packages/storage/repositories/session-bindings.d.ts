/**
 * SessionBindingsRepository — the `session_bindings` store: the durable
 * session-kind bindings, keyed by session id (one row per bound session).
 *
 * Three frozen kinds (contracts v1): `ordinary` (a plain session),
 * `team-root` (a session that is the root of a team), and `team-member`
 * (a member child session bound to a team, carrying root session id +
 * instance id). The vNext session model has no Team SessionEvents — the
 * binding row is the durable record that a member child session belongs
 * to a team, independent of any SessionEvent storage (the AC this task
 * must prove).
 *
 * Uniqueness: a session id may be bound exactly once. Re-binding a
 * `team-member` session raises `RECORD_DUPLICATE` with
 * `contractsCode: 'SESSION_ALREADY_BOUND'` (the frozen contracts
 * assertion); re-binding a session of a different kind raises the
 * store-level `session-already-bound` problem.
 *
 * @module @dsh-agent-team/storage/repositories/session-bindings
 */
import type { SessionBindingDto } from '../../contracts/src/index.js';
import type { StorageDomainHandle } from '../schema/index.js';
import { BaseRepository } from './base.js';
/**
 * The `session_bindings` repository.
 */
export declare class SessionBindingsRepository extends BaseRepository {
    /**
     * @param handle - the open `team_domain` handle.
     */
    constructor(handle: StorageDomainHandle);
    /**
     * Durably put one session binding, keyed by session id.
     * Idempotent when the identical bytes are stored; an occupied key
     * raises `RECORD_DUPLICATE` (same-kind team-member rebinds keep the
     * contracts `SESSION_ALREADY_BOUND`; cross-kind rebinds raise the typed
     * `session-already-bound` problem).
     * @param binding - the unknown input, parsed via the frozen contracts
     *   `parseSessionBinding` (no factory exists by design).
     * @returns the frozen binding.
     */
    put(binding: unknown): Promise<SessionBindingDto>;
    /**
     * Read one session binding by session id.
     * @returns the frozen binding, or `undefined` when absent.
     * @throws `RECORD_INVALID` (contracts code preserved) for a malformed
     *   session id, or a malformed/non-canonical stored row.
     */
    get(sessionId: string): SessionBindingDto | undefined;
    /**
     * List every binding of one kind, sorted by session id (byte order).
     * @param kind - the frozen binding kind (`ordinary` | `team-root` |
     *   `team-member`).
     * @throws `RECORD_INVALID` (problem `bad-binding-kind`) for a
     *   non-frozen kind.
     */
    listByKind(kind: string): SessionBindingDto[];
    /**
     * Durably delete one session binding.
     * @returns `true` when the binding existed, `false` otherwise.
     */
    delete(sessionId: string): Promise<boolean>;
}
//# sourceMappingURL=session-bindings.d.ts.map