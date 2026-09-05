/**
 * P8-S7-R2 (R2-1) — the durable PolicyState lane of the production
 * mutation store (plan §21 BQ-10 / repair C07, H01, H02, H03).
 *
 * The S5A production root wired a PROCESS-LOCAL {@link MutationStore}
 * (root.ts "ephemeral mutation store"): `policyState.set` (A31, s6-remote
 * `switchPolicyState`) appended the transition to a Map that died with the
 * process, while the production projection's `policyState` read-port dep
 * returned the constant `DEFAULT_POLICY_STATE_ID` — so a FRESH boot of the
 * same TeamDomain reported `default` for a state an earlier process had
 * explicitly set, and the remote `policyState.get` disagreed with the
 * projection.
 *
 * This module closes that gap without touching the frozen plane: the
 * {@link MutationStore} port STAYS fully synchronous (the mutation service
 * is synchronous by contract — `switchPolicyState` returns its record
 * inline, and the p7t2 test surface relies on synchronous throws), and the
 * durability is added as a wrapper lane:
 *
 * | lane                     | durability                          |
 * | ------------------------ | ----------------------------------- |
 * | transitions (THIS MODULE)| durable: `ledger` fact rows         |
 * | all other lanes          | ephemeral, delegated verbatim (the  |
 * |                          | S5A documented wiring is preserved: |
 * |                          | the durable homes of those lanes are |
 * |                          | the `overrides` repository + the    |
 * |                          | MemberInstance records)             |
 *
 * ## Write path (appendTransition)
 *
 * Synchronous append to the inner (process-local) store FIRST — the caller
 * observes the transition immediately, exactly as with the S5A wiring —
 * then a SCHEDULED durable write:
 *
 *   1. `ledger.allocateSequence()` (atomic on the domain write chain;
 *      serialized, monotonically increasing — the allocation order is the
 *      admission order of the transitions);
 *   2. `ledger.put(...)` of one `policy-state-transitioned` fact row whose
 *      payload mirrors the {@link PolicyStateTransitionRecord} verbatim
 *      (entryId, origin, state, requestedAtStep, effectiveFromStep).
 *
 * The ledger's `put` is idempotent on identical bytes, so a replayed
 * write never appends twice. A failed durable write (e.g. the domain
 * already closed) is recorded and surfaced by {@link DurableMutationStore.flush} —
 * never swallowed, never retried silently.
 *
 * ## Read path (listTransitions)
 *
 * Pure delegation to the inner store. The inner store's admission order is
 * the admission order: rows preloaded from the durable ledger (sequence
 * order) come first, live appends follow.
 *
 * ## Preload (boot)
 *
 * {@link DurableMutationStore.preload} reads the durable ledger ONCE,
 * filters this root's `policy-state-transitioned` rows, parses each payload
 * against this lane's contract (defensive — a malformed payload is SKIPPED
 * with a note, it never fails the boot; the ledger validator already
 * guarantees the entry shape, so this only rejects out-of-band payload
 * corruption), and appends the rows to the inner store in SEQUENCE ORDER
 * (durable admission order), deduplicated by `entryId` (idempotent). It is
 * called once from the production `boot()` BEFORE the live boot flow, so
 * the first projection / remote read of a resumed root already sees the
 * durable state.
 *
 * ## Crash semantics (documented limitation)
 *
 * The accepted crash window is exactly one transition: the ledger fact is
 * durable, the process dies before the next mutation. On resume the
 * preload restores it — the durable fact is the source of truth, the
 * in-memory cache is a view. A transition whose durable write has not
 * completed at crash time is lost (its ledger fact was never written);
 * the in-memory-only cache dies with the process. This is the same
 * at-most-one-lag discipline the S1-A stamp hook documents for the ledger
 * in general — roll-forward, never rollback.
 *
 * @module @dsh-agent-team/runtime/plugin/durable-mutation-store
 */
import type { MutationStore } from '../../mutation/types.js';
import type { TeamDomainRepositories } from '../../../storage/repositories/index.js';
/**
 * The ledger fact family this lane owns (open factType vocabulary,
 * 1..128 chars, no control chars/whitespace — 25 chars).
 *
 * `projection-source.ts` maps it to the frozen `policy` ledger category.
 */
export declare const POLICY_STATE_FACT_TYPE = "policy-state-transitioned";
/**
 * The durable-lane wrapper surface.
 */
export interface DurableMutationStore {
    /**
     * The wrapped {@link MutationStore}. The mutation service and the A31
     * read-port resolvers consume this object; the transitions lane is
     * durable-backed, every other lane delegates verbatim to the inner
     * store (the S5A documented ephemeral wiring, unchanged).
     */
    readonly store: MutationStore;
    /**
     * Restore this root's durable transitions into the inner store (boot
     * time, once). No-op on an empty ledger; idempotent by `entryId`.
     */
    preload(): Promise<void>;
    /**
     * Await every scheduled durable write; throw an aggregated error when
     * any of them failed (close time). Deterministic across repeated calls.
     */
    flush(): Promise<void>;
}
/**
 * Create the durable-lane wrapper around the production (inner) mutation
 * store.
 *
 * @param inner - the process-local store the production root already
 *   assembles (its lanes keep the S5A documented ephemeral semantics; its
 *   transitions lane becomes the synchronous cache of this module).
 * @param repositories - the OPENED TeamDomain repositories (the `ledger`
 *   store is the single durable home; no new storage surface is added —
 *   the existing ledger port already expresses this write).
 * @param rootSessionId - the root this store instance serves (the
 *   production root is single-root; every durable fact row is stamped
 *   with this root).
 * @param now - the production ISO-8601 clock (ledger `createdAt` stamp).
 */
export declare function createDurableMutationStore(inner: MutationStore, repositories: TeamDomainRepositories, rootSessionId: string, now: () => string): DurableMutationStore;
//# sourceMappingURL=durable-mutation-store.d.ts.map