/**
 * a4p7-governance-warning-restart-reconstruction.test.ts — A4-PR7 §7.6 row 17.
 *
 * WHAT `7-6-closure/SCENARIOS.md` FOUND, quoted: "§21.10's other entries have
 * restart legs; the governance-warning family has no restart leg." Verified
 * independently here: across the four files that carry the family
 * (`a4p6-governance-warning`, `a4p6-governance-warning-service`,
 * `a4p6-governance-warning-host-adapter`, `a4p6-intervention-aggregation`)
 * there is no second store and no reopened handle — the one "re-opens" is the
 * in-memory `ensureRootLive` re-entry, which is the same process reading the
 * same object. Every one of those suites drives the service through
 * `FakeLedger`, an in-memory array: state that never leaves the heap cannot be
 * shown to survive a restart, so a green there is not evidence about restart.
 *
 * THE LAW, from the documents this leg is derived from:
 *
 * - spec §21.10 (Persistence/restart), the line with no leg: "**warning
 *   acknowledgement reconstructs**".
 * - spec §16: "Governance warnings use a **separate durable source** but reuse
 *   the fingerprinted-acknowledgement design pattern."
 * - spec §15.5: acknowledgement carries "warning id / fingerprint;
 *   acknowledgedBy; acknowledgedAt; optional note" and "affects reminder state
 *   only. It never modifies authority."
 * - spec §15.4: the fingerprint binds kind, Blueprint contentHash, the
 *   normalized Leader envelope and the normalized Team Hard envelope — so a
 *   reconstructed ack is bound to THAT identity and to nothing broader.
 *
 * THIS LEG'S CONSTRUCTION. A real `TeamDomain` over the testkit file seam in a
 * scratch directory; the warning family written through the PRODUCTION writer
 * (`commitDurableFact`, the same call the host's `buildGovernanceWarningWriter`
 * makes) and read through the PRODUCTION reader shape (a filter over
 * `repositories.ledger.list()`, never a re-shape). The restart is the unit
 * restart this repo's model requires: `domain.close()`, then a NEW
 * `FileStorageSeam` and a NEW `TeamDomain` handle over the SAME directory, and
 * a NEW service instance — no in-process state is handed across, and the only
 * thing the second store can read is what the first one put on disk. The
 * document port is the PR6 fixture: this leg is about the durable WARNING
 * state, and the documents it compares are inputs, not the subject.
 *
 * Legs: (1) the warning reconstructs — identity, fingerprint, folded
 * count/time, and the acknowledgement, byte-identical from a store that never
 * wrote it, with the raw append-only rows unchanged across the reopen; (2) the
 * reconstructed ack is bound to its FINGERPRINT — drift in the bound documents
 * after the restart mints a new, un-acknowledged warning that re-blocks; (3)
 * the production projection reconstructs over a ledger carrying the warning
 * family (the a4pr0a composition law: a fact type that is written must be
 * classifiable by the projection, or one warning breaks `team.getProjection`
 * for that Team permanently).
 *
 * @module @dsh-agent-team/runtime/test/a4p7-governance-warning-restart-reconstruction
 */

import { describe, expect, it, vi } from 'vitest'

import { parseRootSessionId } from '../../contracts/src/index.js'
import { commitDurableFact } from '../action-router/effects.js'
import { createGovernanceWarningService } from '../governance-warning/service.js'
import {
  GOVERNANCE_WARNING_FACT_TYPES,
  GOVERNANCE_WARNING_FACT_TYPE_VALUES,
  type EnvelopeContains,
  type GovernanceEnvelopeView,
  type GovernanceStartOutcome,
  type GovernanceWarningAcknowledgeOutcome,
  type GovernanceWarningService,
} from '../governance-warning/index.js'
import { createTeamDomainReadPort } from '../src/plugin/projection-source.js'
import { P6T4_ROOT, createP6T4World, destroyP6T1World, restartP6T1World } from './p6t4-helpers.js'
import { type P6T1World } from './p6t1-helpers.js'

// ---------------------------------------------------------------------------
// the durable warning world: production writer + production reader over a real
// store, and the unit restart (new handle, same directory)
// ---------------------------------------------------------------------------

/** The bound-document view the gate compares. Mutable because the drift arm
 *  must be able to move it; it is an INPUT of the diagnostic, never its
 *  durable state. */
interface BoundDocs {
  stage: 'v3'
  blueprintContentHash: string
  leader: GovernanceEnvelopeView
  hard: GovernanceEnvelopeView
  hardStatus: 'declared'
}

const envelope = (
  rules: ReadonlyArray<readonly [string, 'deny' | 'ask' | 'allow', 'exact' | 'subtree' | 'fingerprint', string]>,
): GovernanceEnvelopeView => ({
  rules: rules.map(([operationClass, effect, matcherKind, matcherKey]) => ({
    operationClass,
    effect,
    matcherKind,
    matcherKey,
  })),
})

/** Canonical containment, as PR6 injects it: `a` contains `a/b` and `a:b`. */
const pathContains: EnvelopeContains = (parent, point) =>
  point === parent || point.startsWith(`${parent}/`) || point.startsWith(`${parent}:`)

/** A leader envelope that EXCEEDS the Team hard envelope: the diagnostic must
 *  answer `mismatch` and mint a warning (spec §15.3). */
const DRIFTING_DOCS = (): BoundDocs => ({
  stage: 'v3',
  blueprintContentHash: 'sha256:a4p7r17-blueprint-one',
  hardStatus: 'declared',
  hard: envelope([['tool.shell', 'deny', 'subtree', 'shell']]),
  leader: envelope([['tool.shell', 'allow', 'exact', 'shell:rm:-rf:/']]),
})

/** One raw durable ledger row, read back off the store. */
interface RawRow {
  readonly sequence: number
  readonly factType: string
  readonly payload: string
  readonly createdAt: string
}

interface WarningStore {
  readonly service: GovernanceWarningService
  readonly world: P6T1World
  /** Every warning-family row the directory holds, in sequence order. */
  rows(): readonly RawRow[]
  /** Read the Team projection through the PRODUCTION read port. */
  projection(): unknown
}

/** A monotonically ascending clock. It is PROCESS state, not durable state:
 *  the second store gets a fresh one, continuing the sequence, exactly as a
 *  restarted process would. */
let clockTick = 0
const nextClock = (): string =>
  new Date(Date.UTC(2026, 9, 9, 10, 0, 0) + clockTick++ * 1_000).toISOString()

/**
 * Wire the warning service over an OPEN domain exactly as the host does
 * (`src/plugin/host.ts` `buildGovernanceWarning*`): the writer commits through
 * the production `commitDurableFact` protocol with the lane's own named fact
 * types; the reader FILTERS the ledger's own list and never re-shapes it.
 *
 * `create` is a PARAMETER, not a captured import, for one reason: the restart
 * below wires the second store from a FRESH evaluation of the service module,
 * and a helper that quietly kept using the first store's factory would let
 * module-level memory across the restart — which is the exact hole this file's
 * own counterfactual found on its first run.
 */
function wireWarningStore(
  world: P6T1World,
  docs: BoundDocs,
  create: typeof createGovernanceWarningService = createGovernanceWarningService,
): WarningStore {
  const repositories = world.domain.repositories
  const service = create({
    writer: {
      writeObserved: (rootSessionId, payload) =>
        commitDurableFact(repositories, rootSessionId, nextClock, GOVERNANCE_WARNING_FACT_TYPES.OBSERVED, { ...payload }).then(
          () => undefined,
        ),
      writeAcknowledged: (rootSessionId, payload) =>
        commitDurableFact(
          repositories,
          rootSessionId,
          nextClock,
          GOVERNANCE_WARNING_FACT_TYPES.ACKNOWLEDGED,
          { ...payload },
        ).then(() => undefined),
    },
    reader: {
      list: async (rootSessionId, factTypes) =>
        repositories.ledger
          .list()
          .filter((row) => row.rootSessionId === rootSessionId && factTypes.includes(row.factType))
          .map((row) => ({
            factType: row.factType,
            payload: row.payload as Readonly<Record<string, unknown>>,
            createdAt: row.createdAt,
          })),
    },
    docs: {
      read: async () => docs as never,
    },
    contains: pathContains,
    now: nextClock,
  })
  return {
    service,
    world,
    rows() {
      return repositories.ledger
        .list()
        .filter((row) => GOVERNANCE_WARNING_FACT_TYPE_VALUES.includes(row.factType))
        .map((row) => ({
          sequence: row.sequence,
          factType: row.factType,
          payload: JSON.stringify(row.payload),
          createdAt: row.createdAt,
        }))
    },
    projection() {
      // The same helper the host's read port is built from, with the same
      // template rows production injects through `readPortDeps`.
      return createTeamDomainReadPort(world.domain as never, {
        templates: () =>
          [
            { kind: 'leader', templateId: 'leader', displayName: 'leader', contextPolicy: 'persistent' },
            { kind: 'member', templateId: 'worker', displayName: 'Worker', contextPolicy: 'persistent' },
          ] as never,
        policyState: () => 'default' as const,
      }).readProjectionSource(parseRootSessionId(P6T4_ROOT))
    },
  }
}

/**
 * THE RESTART, in the form this law requires. Three things move, and each is
 * needed:
 *
 * 1. the handle: `domain.close()`, then a NEW `FileStorageSeam` and a NEW
 *    `TeamDomain` over the SAME directory (`restartP6T1World`);
 * 2. the wiring: a NEW service instance, built from scratch over the new
 *    repositories;
 * 3. the PROCESS: `vi.resetModules()` and a fresh evaluation of the service
 *    module, so that not even module-level state — a `Map` a lane hides its
 *    acknowledgement in, a memo, a closure cache — can cross. Without step 3 a
 *    leg can pass on heap state and never touch the disk; this file's
 *    counterfactual (`acknowledgement-lives-in-the-heap`) demonstrated exactly
 *    that on this leg's first run, which is why it is written out.
 *
 * After this, the only thing the second store knows is what the first one put
 * in the directory.
 */
async function restartWarningStore(store: WarningStore, docs: BoundDocs): Promise<WarningStore> {
  const reopened = await restartP6T1World(store.world)
  await vi.resetModules()
  const fresh = (await import('../governance-warning/service.js')) as typeof import('../governance-warning/service.js')
  expect(fresh.createGovernanceWarningService).not.toBe(createGovernanceWarningService)
  return wireWarningStore(reopened, docs, fresh.createGovernanceWarningService)
}

// ---------------------------------------------------------------------------
// the legs
// ---------------------------------------------------------------------------

/**
 * Narrow the closed start-gate union to the arm the leg is about, ASSERTING the
 * arm in the same breath (`GovernanceStartOutcome` is
 * `open | warning-required | corrupt | migration-required`, and a leg that reads
 * a warning identity off it has to say which arm it expects — spec §15.3 says a
 * mismatched pair blocks, so anything else is the leg failing, not a fallback).
 */
function requireBlocked(
  outcome: GovernanceStartOutcome,
  where: string,
): Extract<GovernanceStartOutcome, { status: 'warning-required' }> {
  expect(outcome.status, `${where}: a leader envelope exceeding the hard envelope must block`).toBe(
    'warning-required',
  )
  if (outcome.status !== 'warning-required') throw new Error(`${where}: expected warning-required, got ${outcome.status}`)
  return outcome
}

/** The same narrowing for the acknowledgement outcome, whose arms are
 *  `acknowledged | already-acknowledged | not-found | not-acknowledgeable`. */
function requireAck(
  outcome: GovernanceWarningAcknowledgeOutcome,
  kind: 'acknowledged' | 'already-acknowledged',
  where: string,
): Extract<GovernanceWarningAcknowledgeOutcome, { kind: 'acknowledged' | 'already-acknowledged' }> {
  expect(outcome.kind, `${where}: expected ${kind}`).toBe(kind)
  if (outcome.kind !== kind) throw new Error(`${where}: expected ${kind}, got ${outcome.kind}`)
  return outcome
}

describe('a4p7 §7.6 row 17 — the governance-warning family reconstructs after restart (spec §21.10, §16, §15.4/§15.5)', () => {
  it('a warning observed and acknowledged on a real durable ledger is reproduced by a store opened over the same directory: same warning identity and fingerprint, same folded count/time, same acknowledgement — from rows that were never rewritten', async () => {
    // Derivation: spec §21.10 "warning acknowledgement reconstructs"; §16
    // "separate durable source … fingerprinted-acknowledgement"; §15.5 (the
    // acknowledgement fields, reminder state only).
    const docs = DRIFTING_DOCS()
    const world = await createP6T4World('a4p7r17-reconstruct')
    let store = wireWarningStore(world, docs)
    try {
      // Observe, re-enter un-acknowledged, acknowledge, re-enter acked.
      const first = requireBlocked(await store.service.checkStart(P6T4_ROOT), 'first checkStart')
      const second = requireBlocked(
        await store.service.checkEnsureRootLive(P6T4_ROOT),
        'un-acknowledged ensureRootLive re-entry',
      )
      expect(second.warningId).toBe(first.warningId)

      const interventionId = first.interventionId
      requireAck(
        await store.service.acknowledge({
          teamSessionId: P6T4_ROOT,
          interventionId,
          callerPrincipalId: 'principal:a4p7-row17-operator',
          note: 'reviewed the leader envelope against the hard envelope',
        }),
        'acknowledged',
        'first acknowledgement',
      )
      // Reminder state: the acked fingerprint stops re-blocking (spec §15.5
      // "affects reminder state only"), and it is still the SAME warning.
      const afterAck = await store.service.checkStart(P6T4_ROOT)
      expect(afterAck.status).toBe('open')

      const before = await store.service.listWarnings(P6T4_ROOT)
      expect(before).toHaveLength(1)
      const warning = before[0]!
      expect(warning.warningId).toBe(first.warningId)
      expect(warning.observationCount).toBe(3)
      expect(warning.acknowledged).toBe(true)
      expect(warning.acknowledgedBy).toBe('principal:a4p7-row17-operator')
      expect(warning.acknowledgementNote).toBe('reviewed the leader envelope against the hard envelope')
      // The raw truth: one ack row, the rest observations, all in the lane's
      // own fact-type vocabulary (a registry query, not a guessed literal).
      const rowsBefore = store.rows().map((row) => ({ factType: row.factType, payload: row.payload }))
      expect(rowsBefore.filter((row) => row.factType === GOVERNANCE_WARNING_FACT_TYPES.OBSERVED)).toHaveLength(3)
      expect(rowsBefore.filter((row) => row.factType === GOVERNANCE_WARNING_FACT_TYPES.ACKNOWLEDGED)).toHaveLength(1)
      expect([...new Set(rowsBefore.map((row) => row.factType))].sort()).toEqual(
        [...GOVERNANCE_WARNING_FACT_TYPE_VALUES].sort(),
      )
      const rawBefore = [...store.rows()]

      // THE RESTART: new handle, same directory, new service, new clock.
      store = await restartWarningStore(store, docs)
      const after = await store.service.listWarnings(P6T4_ROOT)
      expect(after).toEqual(before)
      // The acknowledgement itself, field by field, off the reconstructed rows
      // (spec §15.5: warning id / fingerprint, acknowledgedBy, acknowledgedAt,
      // optional note — and nothing else).
      expect(after[0]!.warningId).toBe(first.warningId)
      expect(after[0]!.fingerprint).toBe(warning.fingerprint)
      expect(after[0]!.verdict).toBe('mismatch')
      expect(after[0]!.observationCount).toBe(3)
      expect(after[0]!.firstObservedAt).toBe(warning.firstObservedAt)
      expect(after[0]!.lastObservedAt).toBe(warning.lastObservedAt)
      expect(after[0]!.acknowledged).toBe(true)
      expect(after[0]!.acknowledgedBy).toBe('principal:a4p7-row17-operator')
      expect(after[0]!.acknowledgedAt).toBe(warning.acknowledgedAt)
      expect(after[0]!.acknowledgementNote).toBe('reviewed the leader envelope against the hard envelope')

      // Re-acknowledging after the restart answers from the RECONSTRUCTED
      // history — `already-acknowledged`, carrying the ORIGINAL ack, never a
      // fresh timestamp. (A second store with an empty directory would answer
      // `not-found`: this answer can only come from the durable rows.)
      const reAck = requireAck(
        await store.service.acknowledge({
          teamSessionId: P6T4_ROOT,
          interventionId,
          callerPrincipalId: 'principal:a4p7-row17-second-operator',
        }),
        'already-acknowledged',
        'post-restart re-acknowledgement',
      )
      expect(reAck.acknowledgement.acknowledgedBy).toBe('principal:a4p7-row17-operator')

      // Append-only: the reopen saw every row the first store wrote, in the
      // same order, byte for byte. Nothing was rewritten or folded away.
      const rawAfterRestart = [...store.rows()]
      expect(rawAfterRestart).toEqual(rawBefore)

      // And the reconstructed ack behaves: the same fingerprint re-enters the
      // gate and stays OPEN, while the ledger still records the observation.
      const reopenedGate = await store.service.checkStart(P6T4_ROOT)
      expect(reopenedGate.status).toBe('open')
      const rawAfterReentry = store.rows()
      expect(rawAfterReentry.length).toBe(rawAfterRestart.length + 1)
      expect(rawAfterReentry.slice(0, rawAfterRestart.length)).toEqual(rawAfterRestart)
      const last = rawAfterReentry[rawAfterReentry.length - 1]!
      expect(last.factType).toBe(GOVERNANCE_WARNING_FACT_TYPES.OBSERVED)
      expect(JSON.parse(last.payload).fingerprint).toBe(warning.fingerprint)
    } finally {
      await destroyP6T1World(store.world)
    }
  })

  it('the reconstructed acknowledgement is bound to its fingerprint: after the restart, drift in the bound documents mints a NEW un-acknowledged warning that re-blocks', async () => {
    // Derivation: spec §15.4 (the fingerprint binds the Blueprint contentHash
    // and the normalized envelopes) + §21.10 (the ack reconstructs — for THAT
    // fingerprint, which is the whole content of "reminder state only").
    const docs = DRIFTING_DOCS()
    const world = await createP6T4World('a4p7r17-fingerprint')
    let store = wireWarningStore(world, docs)
    try {
      const blocked = requireBlocked(await store.service.checkStart(P6T4_ROOT), 'pre-restart checkStart')
      requireAck(
        await store.service.acknowledge({
          teamSessionId: P6T4_ROOT,
          interventionId: blocked.interventionId,
          callerPrincipalId: 'principal:a4p7-row17-operator',
        }),
        'acknowledged',
        'pre-restart acknowledgement',
      )
      const quiet = await store.service.checkStart(P6T4_ROOT)
      expect(quiet.status).toBe('open')

      // Restart, then move what the fingerprint binds: a different blueprint
      // content hash is a different warning, and the reconstructed ack says
      // nothing about it.
      store = await restartWarningStore(store, docs)
      docs.blueprintContentHash = 'sha256:a4p7r17-blueprint-two'
      const drifted = requireBlocked(await store.service.checkStart(P6T4_ROOT), 'post-drift checkStart')
      expect(drifted.warningId).not.toBe(blocked.warningId)

      const warnings = await store.service.listWarnings(P6T4_ROOT)
      expect(warnings).toHaveLength(2)
      const old = warnings.find((entry) => entry.warningId === blocked.warningId)!
      const fresh = warnings.find((entry) => entry.warningId === drifted.warningId)!
      expect(old.acknowledged).toBe(true)
      expect(fresh.acknowledged).toBe(false)
      expect(fresh.observationCount).toBe(1)
      // The new warning is acknowledgeable in its own right, and the old ack
      // is untouched by it.
      requireAck(
        await store.service.acknowledge({
          teamSessionId: P6T4_ROOT,
          interventionId: drifted.interventionId,
          callerPrincipalId: 'principal:a4p7-row17-operator',
        }),
        'acknowledged',
        'acknowledgement of the drifted warning',
      )
      const afterBoth = await store.service.listWarnings(P6T4_ROOT)
      expect(afterBoth.find((entry) => entry.warningId === blocked.warningId)!.acknowledgedAt).toBe(
        old.acknowledgedAt,
      )
      expect(afterBoth.find((entry) => entry.warningId === drifted.warningId)!.acknowledged).toBe(true)
    } finally {
      await destroyP6T1World(store.world)
    }
  })

  it('the production projection reconstructs over a ledger that carries the warning family (the a4pr0a composition law applies to these fact types too)', async () => {
    // Derivation: the warning lane writes durable ledger rows (spec §16
    // "separate durable source"), and every ledger fact type must be
    // classifiable by the projection or one warning breaks the Team
    // projection permanently (a4pr0a / the H3 incident class). The restart is
    // what makes it a reconstruction claim rather than a wiring claim.
    const docs = DRIFTING_DOCS()
    const world = await createP6T4World('a4p7r17-projection')
    let store = wireWarningStore(world, docs)
    try {
      const blocked = requireBlocked(await store.service.checkStart(P6T4_ROOT), 'projection leg checkStart')
      await store.service.acknowledge({
        teamSessionId: P6T4_ROOT,
        interventionId: blocked.interventionId,
        callerPrincipalId: 'principal:a4p7-row17-operator',
      })
      expect(store.rows()).toHaveLength(2)
      // Before the restart the composition already holds — asserted here so a
      // failure can never be blamed on the restart alone.
      expect(() => store.projection()).not.toThrow()

      store = await restartWarningStore(store, docs)
      let source: unknown
      expect(() => {
        source = store.projection()
      }).not.toThrow()
      const ledger = (source as { ledger: { totalEntries: number; byCategory: Record<string, number> } }).ledger
      expect(ledger.totalEntries).toBeGreaterThanOrEqual(2)
      // The warning family is registered in the CLOSED `policy` category
      // (6.C registration), and the projection counts it there.
      expect(ledger.byCategory.policy).toBeGreaterThanOrEqual(2)
      // Reconstructed state still answers after a projection read.
      const warnings = await store.service.listWarnings(P6T4_ROOT)
      expect(warnings).toHaveLength(1)
      expect(warnings[0]!.acknowledged).toBe(true)
    } finally {
      await destroyP6T1World(store.world)
    }
  })
})
