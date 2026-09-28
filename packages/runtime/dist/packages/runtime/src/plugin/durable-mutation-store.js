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
 * ## Write path (PR-A: the governance authority owns the commit)
 *
 * pre-alpha3 PR-A moved the durable COMMIT out of this wrapper into the
 * governance mutation authority (packages/runtime/governance): it writes
 * the durable ledger row FIRST ({@link writePolicyStateTransitionRow},
 * awaited — commit-before-ack) and only then appends to the inner store
 * through {@link MutationStore.appendTransition} (now a pure
 * synchronous cache append, exactly the S5A read-side wiring). The
 * wrapper itself NEVER schedules a write; its durable role is the boot
 * preload of the durable rows into the cache.
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
 * ## Crash semantics (PR-A: commit-before-ack)
 *
 * The R2-1 at-most-one-lag window is CLOSED: the durable ledger row is
 * written before the ack returns, so every acked transition is durable.
 * The only residual window is a crash between the durable commit and the
 * in-memory append — the cache is a view, the durable fact is the source
 * of truth, and the boot preload restores it (roll-forward, never
 * rollback — the same discipline the S1-A stamp hook documents for the
 * ledger in general).
 *
 * @module @dsh-agent-team/runtime/plugin/durable-mutation-store
 */
import { TEAM_VALUE_ORIGIN_VALUES } from '../../../domain/policy/src/index.js';
import { TEAM_DOMAIN_SCHEMA_VERSION } from '../../../storage/schema/stores.js';
/**
 * The ledger fact family this lane owns (open factType vocabulary,
 * 1..128 chars, no control chars/whitespace — 25 chars).
 *
 * `projection-source.ts` maps it to the frozen `policy` ledger category.
 */
export const POLICY_STATE_FACT_TYPE = 'policy-state-transitioned';
/** Safe-integer check for the step fields (the step clock is bounded). */
function isSafeInt(value) {
    return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}
/**
 * Parse one ledger entry's payload into a transition record.
 *
 * Returns `undefined` (skip) for any payload that violates this lane's
 * contract — defensive parsing of a durable row this lane owns; the
 * entry-level shape (schemaVersion/sequence/rootSessionId/factType/
 * payload/createdAt) is guaranteed by the ledger validator.
 */
function parseTransitionPayload(payload) {
    if (typeof payload !== 'object' || payload === null)
        return undefined;
    const record = payload;
    if (typeof record['entryId'] !== 'string' || record['entryId'] === '')
        return undefined;
    const origin = record['origin'];
    if (typeof origin !== 'string' || !TEAM_VALUE_ORIGIN_VALUES.includes(origin)) {
        return undefined;
    }
    const state = record['state'];
    if (typeof state !== 'object' || state === null)
        return undefined;
    const stateRecord = state;
    if (typeof stateRecord['stateId'] !== 'string' || stateRecord['stateId'] === '') {
        return undefined;
    }
    if (!isSafeInt(record['requestedAtStep']) || !isSafeInt(record['effectiveFromStep'])) {
        return undefined;
    }
    return {
        entryId: record['entryId'],
        origin: origin,
        state: state,
        requestedAtStep: record['requestedAtStep'],
        effectiveFromStep: record['effectiveFromStep'],
    };
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
export function createDurableMutationStore(inner, repositories, rootSessionId, now) {
    const store = {
        // --- the transitions lane (PR-A: the read cache) ---------------------------
        // Durability is OWNED by the governance mutation authority
        // (packages/runtime/governance): it commits the durable ledger row
        // BEFORE the ack ({@link writePolicyStateTransitionRow}) and only
        // then appends here (commit-before-ack — the R2-1 fire-and-schedule
        // window is closed). This wrapper stays the synchronous READ view
        // (boot preload + the live commits).
        listTransitions(teamSessionId) {
            return inner.listTransitions(teamSessionId);
        },
        appendTransition(teamSessionId, transition) {
            inner.appendTransition(teamSessionId, transition);
        },
        // --- the ephemeral lanes (S5A documented wiring, verbatim delegation) ------
        listRecords(teamSessionId) {
            return inner.listRecords(teamSessionId);
        },
        appendRecord(teamSessionId, record) {
            inner.appendRecord(teamSessionId, record);
        },
        getCreationFields(teamSessionId, instanceId) {
            return inner.getCreationFields(teamSessionId, instanceId);
        },
        registerCreationFields(teamSessionId, member, fields) {
            inner.registerCreationFields(teamSessionId, member, fields);
        },
        setWorkspace(teamSessionId, instanceId, workspace) {
            inner.setWorkspace(teamSessionId, instanceId, workspace);
        },
        isRunning(teamSessionId, instanceId) {
            return inner.isRunning(teamSessionId, instanceId);
        },
        markRunning(teamSessionId, instanceId) {
            inner.markRunning(teamSessionId, instanceId);
        },
        listInstances(teamSessionId) {
            return inner.listInstances(teamSessionId);
        },
        listLedger(teamSessionId) {
            return inner.listLedger(teamSessionId);
        },
        appendLedger(teamSessionId, entry) {
            inner.appendLedger(teamSessionId, entry);
        },
        listSuppressions(teamSessionId) {
            return inner.listSuppressions(teamSessionId);
        },
        appendSuppression(teamSessionId, record) {
            inner.appendSuppression(teamSessionId, record);
        },
    };
    const preload = async () => {
        // The ledger's `list()` is synchronous and sequence-sorted — the
        // durable admission order of every fact of the domain, including
        // this lane's rows (interleaved with the other lanes' facts, which
        // are filtered out here).
        const entries = repositories.ledger.list();
        const rows = [];
        for (const entry of entries) {
            if (entry.rootSessionId !== rootSessionId)
                continue;
            if (entry.factType !== POLICY_STATE_FACT_TYPE)
                continue;
            const transition = parseTransitionPayload(entry.payload);
            if (transition === undefined)
                continue; // defensive skip (module docs)
            rows.push({ sequence: entry.sequence, transition });
        }
        rows.sort((a, b) => a.sequence - b.sequence);
        // The inner store holds this process's live appends (empty in the
        // production flow: preload runs at boot, before any admission). The
        // entryId dedupe makes the restore idempotent for the non-production
        // order (an append whose scheduled write completed before a
        // same-process preload — the same row must not appear twice).
        const existing = new Set(inner
            .listTransitions(rootSessionId)
            .map((transition) => transition.entryId));
        for (const row of rows) {
            if (existing.has(row.transition.entryId))
                continue;
            inner.appendTransition(rootSessionId, row.transition);
            existing.add(row.transition.entryId);
        }
    };
    return { store, preload };
}
/**
 * Durably write ONE admitted PolicyState transition (one `ledger` fact
 * row) — the COMMIT side of the commit-before-ack contract (pre-alpha3
 * PR-A): the governance mutation authority AWAITs this write before it
 * returns the ack, so a durable transition fact exists before any caller
 * observes the switch.
 *
 * The ledger's `allocateSequence` is atomic on the domain write chain
 * (serialized, monotonically increasing — the allocation order is the
 * admission order of the transitions); the ledger `put` is idempotent on
 * identical bytes, so a replayed write never appends twice. A failure
 * (e.g. the domain already closed) PROPAGATES to the caller — the ack
 * fails with the durable write (no silent ack, no retry).
 *
 * @param ledger - the OPENED TeamDomain `ledger` repository.
 * @param rootSessionId - the root the row is stamped with.
 * @param transition - the admitted transition (payload mirrored verbatim).
 * @param now - the production ISO-8601 clock (`createdAt` stamp).
 */
export async function writePolicyStateTransitionRow(ledger, rootSessionId, transition, now) {
    const sequence = await ledger.allocateSequence();
    await ledger.put({
        schemaVersion: TEAM_DOMAIN_SCHEMA_VERSION,
        sequence,
        rootSessionId,
        factType: POLICY_STATE_FACT_TYPE,
        payload: {
            entryId: transition.entryId,
            origin: transition.origin,
            state: transition.state,
            requestedAtStep: transition.requestedAtStep,
            effectiveFromStep: transition.effectiveFromStep,
        },
        createdAt: now(),
    });
}
//# sourceMappingURL=durable-mutation-store.js.map