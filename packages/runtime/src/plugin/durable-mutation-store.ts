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

import type {
  MutationStore,
  PolicyStateTransitionRecord,
} from '../../mutation/types.js'
import { TEAM_VALUE_ORIGIN_VALUES } from '../../../domain/policy/src/index.js'
import type { TeamDomainRepositories } from '../../../storage/repositories/index.js'
import { TEAM_DOMAIN_SCHEMA_VERSION } from '../../../storage/schema/stores.js'

/**
 * The ledger fact family this lane owns (open factType vocabulary,
 * 1..128 chars, no control chars/whitespace — 25 chars).
 *
 * `projection-source.ts` maps it to the frozen `policy` ledger category.
 */
export const POLICY_STATE_FACT_TYPE = 'policy-state-transitioned'

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
  readonly store: MutationStore
  /**
   * Restore this root's durable transitions into the inner store (boot
   * time, once). No-op on an empty ledger; idempotent by `entryId`.
   */
  preload(): Promise<void>
  /**
   * Await every scheduled durable write; throw an aggregated error when
   * any of them failed (close time). Deterministic across repeated calls.
   */
  flush(): Promise<void>
}

/**
 * One parsed durable transition payload (the lane's read-side contract).
 */
interface DurableTransitionRow {
  readonly sequence: number
  readonly transition: PolicyStateTransitionRecord
}

/** Safe-integer check for the step fields (the step clock is bounded). */
function isSafeInt(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
}

/**
 * Parse one ledger entry's payload into a transition record.
 *
 * Returns `undefined` (skip) for any payload that violates this lane's
 * contract — defensive parsing of a durable row this lane owns; the
 * entry-level shape (schemaVersion/sequence/rootSessionId/factType/
 * payload/createdAt) is guaranteed by the ledger validator.
 */
function parseTransitionPayload(
  payload: unknown,
): PolicyStateTransitionRecord | undefined {
  if (typeof payload !== 'object' || payload === null) return undefined
  const record = payload as Record<string, unknown>
  if (typeof record['entryId'] !== 'string' || record['entryId'] === '') return undefined
  const origin = record['origin']
  if (typeof origin !== 'string' || !TEAM_VALUE_ORIGIN_VALUES.includes(origin as never)) {
    return undefined
  }
  const state = record['state']
  if (typeof state !== 'object' || state === null) return undefined
  const stateRecord = state as Record<string, unknown>
  if (typeof stateRecord['stateId'] !== 'string' || stateRecord['stateId'] === '') {
    return undefined
  }
  if (!isSafeInt(record['requestedAtStep']) || !isSafeInt(record['effectiveFromStep'])) {
    return undefined
  }
  return {
    entryId: record['entryId'],
    origin: origin as PolicyStateTransitionRecord['origin'],
    state: state as PolicyStateTransitionRecord['state'],
    requestedAtStep: record['requestedAtStep'],
    effectiveFromStep: record['effectiveFromStep'],
  }
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
export function createDurableMutationStore(
  inner: MutationStore,
  repositories: TeamDomainRepositories,
  rootSessionId: string,
  now: () => string,
): DurableMutationStore {
  const pendingWrites: Promise<void>[] = []
  const failures: unknown[] = []

  /**
   * Schedule the durable write of one admitted transition (fire-and-track:
   * the synchronous caller has already observed the in-memory append).
   */
  const scheduleTransitionWrite = (transition: PolicyStateTransitionRecord): void => {
    const write: Promise<void> = (async () => {
      const sequence = await repositories.ledger.allocateSequence()
      await repositories.ledger.put({
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
      })
    })()
    write.catch((error: unknown) => {
      failures.push(error)
    })
    pendingWrites.push(write)
  }

  const store: MutationStore = {
    // --- the durable lane (R2-1) ------------------------------------------------
    listTransitions(teamSessionId) {
      return inner.listTransitions(teamSessionId)
    },
    appendTransition(teamSessionId, transition) {
      // Synchronous cache append FIRST (the caller sees the transition
      // inline, exactly as with the S5A wiring), then the scheduled
      // durable fact (the boot-time preload and the close-time flush are
      // the durable boundaries).
      inner.appendTransition(teamSessionId, transition)
      scheduleTransitionWrite(transition)
    },
    // --- the ephemeral lanes (S5A documented wiring, verbatim delegation) ------
    listRecords(teamSessionId) {
      return inner.listRecords(teamSessionId)
    },
    appendRecord(teamSessionId, record) {
      inner.appendRecord(teamSessionId, record)
    },
    getCreationFields(teamSessionId, instanceId) {
      return inner.getCreationFields(teamSessionId, instanceId)
    },
    registerCreationFields(teamSessionId, member, fields) {
      inner.registerCreationFields(teamSessionId, member, fields)
    },
    setWorkspace(teamSessionId, instanceId, workspace) {
      inner.setWorkspace(teamSessionId, instanceId, workspace)
    },
    isRunning(teamSessionId, instanceId) {
      return inner.isRunning(teamSessionId, instanceId)
    },
    markRunning(teamSessionId, instanceId) {
      inner.markRunning(teamSessionId, instanceId)
    },
    listInstances(teamSessionId) {
      return inner.listInstances(teamSessionId)
    },
    listLedger(teamSessionId) {
      return inner.listLedger(teamSessionId)
    },
    appendLedger(teamSessionId, entry) {
      inner.appendLedger(teamSessionId, entry)
    },
    listSuppressions(teamSessionId) {
      return inner.listSuppressions(teamSessionId)
    },
    appendSuppression(teamSessionId, record) {
      inner.appendSuppression(teamSessionId, record)
    },
  }

  const preload = async (): Promise<void> => {
    // The ledger's `list()` is synchronous and sequence-sorted — the
    // durable admission order of every fact of the domain, including
    // this lane's rows (interleaved with the other lanes' facts, which
    // are filtered out here).
    const entries = repositories.ledger.list()
    const rows: DurableTransitionRow[] = []
    for (const entry of entries) {
      if (entry.rootSessionId !== rootSessionId) continue
      if (entry.factType !== POLICY_STATE_FACT_TYPE) continue
      const transition = parseTransitionPayload(entry.payload)
      if (transition === undefined) continue // defensive skip (module docs)
      rows.push({ sequence: entry.sequence, transition })
    }
    rows.sort((a, b) => a.sequence - b.sequence)
    // The inner store holds this process's live appends (empty in the
    // production flow: preload runs at boot, before any admission). The
    // entryId dedupe makes the restore idempotent for the non-production
    // order (an append whose scheduled write completed before a
    // same-process preload — the same row must not appear twice).
    const existing = new Set<string>(
      inner
        .listTransitions(rootSessionId)
        .map((transition) => transition.entryId),
    )
    for (const row of rows) {
      if (existing.has(row.transition.entryId)) continue
      inner.appendTransition(rootSessionId, row.transition)
      existing.add(row.transition.entryId)
    }
  }

  const flush = async (): Promise<void> => {
    if (pendingWrites.length === 0 && failures.length === 0) return
    await Promise.all(pendingWrites)
    if (failures.length > 0) {
      const first = failures[0]
      const cause =
        first instanceof Error ? first : new Error(String(first))
      throw new Error(
        `durable-mutation-store: ${failures.length} scheduled policy-state durable write(s) failed: ${cause.message}`,
        { cause },
      )
    }
  }

  return { store, preload, flush }
}
