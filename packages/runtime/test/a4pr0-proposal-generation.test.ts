/**
 * A4-PR0 — the proposal record against the THREE generations it must not
 * confuse (plan Task 0 / A4-PR0, ADR A4-2 + A4-3, spec §24.5).
 *
 * ADR A4-2: "a proposal append advances only (1)". The three counters are:
 *
 *  (a) `team_sessions.generation` — the per-team durable STAMP, advanced by
 *      `LedgerRepository.put` through `advanceGeneration`
 *      (`packages/storage/repositories/team-sessions.ts:119-141`) and surfaced
 *      to the client ONLY as `generation: source.generation` in
 *      `packages/runtime/projection/fold.ts:99`. Every ledger fact advances it,
 *      including a proposal.
 *  (b) the override SLOT winner generation — the Alpha.2/3 capability lane's
 *      own CAS (`governance/service.ts:295-305`,
 *      `MUTATION_ERROR_CODES.OVERRIDE_GENERATION_CONFLICT`).
 *  (c) the OVERLAY SNAPSHOT generation — the durable permission chain
 *      (`governance/service.ts:615-624`,
 *      `PERMISSION_MUTATION_ERROR_CODES.GENERATION_CONFLICT` against
 *      `overlay.latest().metadata.generation`).
 *
 * `baseGeneration` is (c) and NOTHING else, with `baseSnapshotId` authoritative
 * beside it (A4-3): the pair identifies the overlay head the proposal was
 * written against. (a) is a stamp that every fact moves, so a `baseGeneration`
 * wired to it would be stale the instant any unrelated fact was appended; (b)
 * belongs to a different plane entirely. The counters are therefore driven to
 * three DIFFERENT numbers before the append, and the record is checked against
 * exactly one of them — an implementation that wired the wrong counter is red
 * here rather than accidentally green.
 *
 * WHY the CAS probes are re-run after the append instead of only comparing
 * numbers: the durable proof that a proposal did not move a counter is that a
 * stale writer is still rejected with the SAME `actualGeneration` it would have
 * seen before, and that the rejection still writes nothing.
 *
 * Test pattern of this repo (the plain-node shim's `it` is synchronous): the
 * scenario runs at module top level with `await`; the `it` bodies assert
 * captured values.
 */

import { describe, expect, it } from 'vitest'
import { parseRootSessionId } from '../../contracts/src/index.js'
import { createTeamOperationCoordinator } from '../coordination/index.js'
import {
  MUTATION_ERROR_CODES,
  PERMISSION_MUTATION_ERROR_CODES,
  createGovernanceMutationService,
  isMutationError,
  isPermissionMutationError,
  selectSlotWinner,
  slotIdentityOf,
} from '../governance/index.js'
import type {
  GovernanceMutationServiceDeps,
} from '../governance/index.js'
import type {
  OverrideRecordView,
  OverrideStorePort,
  PolicyReader,
  PolicyStateTransitionRecord,
} from '../mutation/index.js'
import type {
  GovernanceTransitionCache,
  GovernanceTransitionCommit,
} from '../governance/types.js'
import { createPermissionOverlayRepositoryPort } from '../permission-governance/index.js'
import type { PolicyEntry } from '../../domain/policy/src/index.js'
import { permissionOverlaySnapshotKey } from '../../storage/schema/permission-overlay.js'
import {
  P6T4_NOW,
  P6T4_ROOT,
  P6T4_SEEDS,
  createP6T4World,
  destroyP6T1World,
  restartP6T1World,
  writeRawControlFact,
} from './p6t4-helpers.js'
import type { P6T1World } from './p6t1-helpers.js'
import { createTeamDomainReadPort } from '../src/plugin/projection-source.js'
import { createGovernanceProposalStore } from '../governance/proposal-store.js'
import type {
  GovernanceProposalDraft,
  ProposalReadRecord,
} from '../governance/proposal-store.js'

const WORKER_ID = String(P6T4_SEEDS.worker.instanceId)
const GOV_NOW = '2026-10-07T00:00:00.000Z'
const PROPOSAL_NOW = '2026-10-07T00:00:01.000Z'

const PORT_DEPS = {
  templates: () =>
    [
      { kind: 'leader', templateId: 'leader', displayName: 'leader', contextPolicy: 'persistent' },
      { kind: 'member', templateId: 'worker', displayName: 'Worker', contextPolicy: 'persistent' },
    ] as never,
  policyState: () => 'default' as const,
}

/** The legacy capability lane's cell set (one cell is enough to move a slot
 *  winner; each set differs so no `setOverride` is a no-change no-op). */
function cells(model: string): Record<string, PolicyEntry> {
  return { model: { kind: 'allow', items: [model] } } as Record<string, PolicyEntry>
}

const noopPolicy: PolicyReader = {
  readBlueprintEnvelope: () => ({}),
  readTemplatePolicy: () => ({}),
  readExternalFacts: () => ({ hard: {}, capabilityExists: {} }),
}

class NoopTransitions implements GovernanceTransitionCache {
  appendTransition(_teamSessionId: string, _transition: PolicyStateTransitionRecord): void {}
  listTransitions(_teamSessionId: string): readonly PolicyStateTransitionRecord[] {
    return []
  }
}

class NoopCommit implements GovernanceTransitionCommit {
  async commit(_rootSessionId: string, _transition: PolicyStateTransitionRecord): Promise<void> {}
}

/** The same adapter production uses (`src/plugin/root.ts:2481`): the durable
 *  overrides repository behind the store port. */
function overrideStoreOf(world: P6T1World): OverrideStorePort {
  const repository = world.domain.repositories.overrides
  return {
    list: (rootSessionId: string) =>
      Promise.resolve(repository.list(rootSessionId) as readonly OverrideRecordView[]),
    put: (record: unknown) => repository.put(record),
  }
}

/** The durable overlay head of one member (counter (c)). */
async function overlayHead(world: P6T1World): Promise<{ generation: number; snapshotId: string | null; historyLength: number }> {
  const overlay = createPermissionOverlayRepositoryPort({
    repository: world.domain.repositories.permissionOverlays,
  })
  const latest = await overlay.latest({ teamSessionId: P6T4_ROOT, memberInstanceId: WORKER_ID })
  const history = await overlay.history({ teamSessionId: P6T4_ROOT, memberInstanceId: WORKER_ID })
  return {
    generation: latest === undefined ? 0 : latest.metadata.generation,
    snapshotId: latest === undefined ? null : latest.snapshotId,
    historyLength: history.length,
  }
}

/** The override slot winner of the team operator slot (counter (b)). */
function slotWinner(world: P6T1World): OverrideRecordView | null {
  const slotId = slotIdentityOf({ kind: 'human-override', scope: 'team', origin: undefined }, P6T4_ROOT)
  return selectSlotWinner(world.domain.repositories.overrides.list(P6T4_ROOT), slotId)
}

/** The per-team durable stamp (counter (a)) as the repository carries it. */
function sessionStamp(world: P6T1World): number {
  return world.domain.repositories.teamSessions.get(P6T4_ROOT)?.generation ?? -1
}

/** Counter (a) as the CLIENT can see it. The projection source is the only
 *  read path for it, and `projection/fold.ts` stamps `generation:
 *  source.generation` verbatim into the DTO — so reading the source reads the
 *  number the client sees. (Reading the source is also where the frozen ledger
 *  CATEGORY table is enforced, which is the property A4-PR0a exists for: an
 *  unmapped fact type throws here, on every read, forever.) */
function projectedGeneration(world: P6T1World): number {
  const port = createTeamDomainReadPort(world.domain, PORT_DEPS)
  return port.readProjectionSource(parseRootSessionId(P6T4_ROOT)).generation
}

// --- scenario ----------------------------------------------------------------

type Captured = {
  readonly stampBefore: number
  readonly projectedStampBefore: number
  readonly slotGenerationBefore: number
  readonly overlayBefore: { generation: number; snapshotId: string | null; historyLength: number }
  readonly distinctCounters: boolean
  readonly appendedBaseGeneration: number
  readonly appendedBaseSnapshotId: string | null
  readonly stampAfter: number
  readonly projectedStampAfter: number
  readonly slotGenerationAfter: number
  readonly overlayAfter: { generation: number; snapshotId: string | null; historyLength: number }
  readonly slotConflictCode: string | undefined
  readonly slotConflictActual: unknown
  readonly slotRowsAfterConflict: number
  readonly overlayConflictCode: string | undefined
  readonly overlayConflictActual: unknown
  readonly proposalCountAfterConflicts: number
  readonly reopenedBaseGeneration: number
  readonly reopenedBaseSnapshotId: string | null
  readonly reopenedPairStillAgrees: boolean
  readonly stalePairReadsSound: boolean
  readonly stalePairBaseGeneration: number
  readonly stalePairBaseSnapshotId: string | null
}

const captured: Captured = await (async (): Promise<Captured> => {
  const world = await createP6T4World('a4pr0-proposal-generation', ['leader', 'worker'])
  try {
    const service = createGovernanceMutationService({
      chain: createTeamOperationCoordinator(),
      overrides: overrideStoreOf(world),
      transitions: new NoopTransitions(),
      transitionCommit: new NoopCommit(),
      policy: noopPolicy,
      registeredMembers: async () => [],
      policyStates: () => ['default'],
      now: () => GOV_NOW,
      permissionLane: {
        overlay: createPermissionOverlayRepositoryPort({
          repository: world.domain.repositories.permissionOverlays,
        }),
      },
    } satisfies GovernanceMutationServiceDeps)

    // --- drive (b): three override sets → the slot winner sits at 3 ---------
    await service.setOverride({ authority: { kind: 'operator' }, rootSessionId: P6T4_ROOT, scope: 'team', cells: cells('m-1') })
    await service.setOverride({ authority: { kind: 'operator' }, rootSessionId: P6T4_ROOT, scope: 'team', cells: cells('m-2') })
    await service.setOverride({ authority: { kind: 'operator' }, rootSessionId: P6T4_ROOT, scope: 'team', cells: cells('m-3') })

    // --- drive (c): two overlay snapshots → the overlay chain sits at 2 -----
    const firstGrant = await service.mutatePermission({
      authority: { kind: 'operator' },
      teamSessionId: P6T4_ROOT,
      memberInstanceId: WORKER_ID,
      kind: 'grant_instance',
      mutationId: 'mut-a4pr0-g1',
      reason: 'seed the overlay chain',
      rules: [{ operationClass: 'write', matcher: { kind: 'exact', resource: 'file:/a4pr0/a.txt' }, effect: 'ask' }],
    })
    if (!firstGrant.changed) {
      throw new Error('scenario precondition: the seed grant did not change the overlay')
    }
    const secondGrant = await service.mutatePermission({
      authority: { kind: 'operator' },
      teamSessionId: P6T4_ROOT,
      memberInstanceId: WORKER_ID,
      kind: 'update_permission',
      mutationId: 'mut-a4pr0-g2',
      reason: 'move the overlay head once more',
      expectedGeneration: firstGrant.snapshot.metadata.generation,
      rules: [{ operationClass: 'write', matcher: { kind: 'exact', resource: 'file:/a4pr0/a.txt' }, effect: 'deny' }],
    })
    if (!secondGrant.changed) {
      throw new Error('scenario precondition: the second grant did not change the overlay')
    }

    // --- drive (a) well past (b) and (c) with unrelated durable facts -------
    for (let index = 0; index < 8; index += 1) {
      await writeRawControlFact(world, 'activity-progress-recorded', { tick: index })
    }

    const stampBefore = sessionStamp(world)
    const projectedStampBefore = projectedGeneration(world)
    const slotBefore = slotWinner(world)
    const slotGenerationBefore = slotBefore === null ? 0 : slotBefore.generation
    const overlayBefore = await overlayHead(world)
    const writesBefore = world.seam.writeCount

    // --- the proposal: (c) is its base, with the snapshot id beside it ------
    const store = createGovernanceProposalStore({
      ledger: world.domain.repositories.ledger,
      now: () => PROPOSAL_NOW,
    })
    const draft: GovernanceProposalDraft = {
      targetMemberInstanceId: WORKER_ID,
      baseGeneration: overlayBefore.generation,
      baseSnapshotId: overlayBefore.snapshotId,
      desiredEffect: 'deny',
      authorityEnvelopeAst: { kind: 'exact', path: 'shell.exec' },
      requiredAuthority: 'human-user',
      caseFingerprint: 'case-a4pr0-generation',
    }
    const appended = await store.appendProposal({ teamSessionId: P6T4_ROOT, proposal: draft })

    const stampAfter = sessionStamp(world)
    const projectedStampAfter = projectedGeneration(world)
    const slotAfter = slotWinner(world)
    const slotGenerationAfter = slotAfter === null ? 0 : slotAfter.generation
    const overlayAfter = await overlayHead(world)
    const slotRowsBeforeConflict = world.domain.repositories.overrides.list(P6T4_ROOT).length

    // --- the CAS probes AFTER the append (the durable non-disturbance proof) -
    let slotConflictCode: string | undefined
    let slotConflictActual: unknown
    try {
      await service.setOverride({
        authority: { kind: 'operator' },
        rootSessionId: P6T4_ROOT,
        scope: 'team',
        cells: cells('m-stale'),
        expectedGeneration: slotGenerationBefore - 1,
      })
    } catch (error) {
      if (!isMutationError(error)) throw error
      slotConflictCode = error.code
      slotConflictActual = error.details['actualGeneration']
    }
    const slotRowsAfterConflict = world.domain.repositories.overrides.list(P6T4_ROOT).length

    let overlayConflictCode: string | undefined
    let overlayConflictActual: unknown
    try {
      await service.mutatePermission({
        authority: { kind: 'operator' },
        teamSessionId: P6T4_ROOT,
        memberInstanceId: WORKER_ID,
        kind: 'update_permission',
        mutationId: 'mut-a4pr0-stale',
        reason: 'a stale writer after the proposal',
        expectedGeneration: 0,
        rules: [{ operationClass: 'write', matcher: { kind: 'exact', resource: 'file:/a4pr0/a.txt' }, effect: 'allow' }],
      })
    } catch (error) {
      if (!isPermissionMutationError(error)) throw error
      overlayConflictCode = error.code
      overlayConflictActual = error.details['actualGeneration']
    }

    // A stale-but-internally-consistent pair stays a SOUND record: the reader
    // has no overlay to compare against, and the commit-time revalidation that
    // calls it stale is PR5's (spec §24.5).
    const stale = await store.appendProposal({
      teamSessionId: P6T4_ROOT,
      proposal: { ...draft, baseGeneration: 0, baseSnapshotId: null, caseFingerprint: 'case-a4pr0-stale' },
    })
    const afterConflicts = store.listProposals({ teamSessionId: P6T4_ROOT })
    const staleOutcome = afterConflicts.find((outcome) => outcome.sequence === stale.sequence)
    if (staleOutcome === undefined || staleOutcome.kind !== 'record') {
      throw new Error('scenario precondition: the stale-pair row did not read back as a record')
    }
    const staleRecord = (staleOutcome as ProposalReadRecord).proposal

    // --- reopen: the base pair survives, and still matches the derived id ---
    const reopened = await restartP6T1World(world)
    try {
      const reopenedStore = createGovernanceProposalStore({
        ledger: reopened.domain.repositories.ledger,
        now: () => PROPOSAL_NOW,
      })
      const reopenedRead = reopenedStore.listProposals({ teamSessionId: P6T4_ROOT })
      const reopenedOutcome = reopenedRead.find((outcome) => outcome.sequence === appended.sequence)
      if (reopenedOutcome === undefined || reopenedOutcome.kind !== 'record') {
        throw new Error('scenario precondition: the appended row did not survive the reopen')
      }
      const reopenedRecord = (reopenedOutcome as ProposalReadRecord).proposal
      const reopenedHead = await overlayHead(reopened)

      return {
        stampBefore,
        projectedStampBefore,
        slotGenerationBefore,
        overlayBefore,
        distinctCounters:
          stampBefore !== overlayBefore.generation &&
          slotGenerationBefore !== overlayBefore.generation &&
          stampBefore !== slotGenerationBefore,
        appendedBaseGeneration: appended.record.baseGeneration,
        appendedBaseSnapshotId: appended.record.baseSnapshotId,
        stampAfter,
        projectedStampAfter,
        slotGenerationAfter,
        overlayAfter,
        slotConflictCode,
        slotConflictActual,
        slotRowsAfterConflict,
        overlayConflictCode,
        overlayConflictActual,
        proposalCountAfterConflicts: afterConflicts.length,
        reopenedBaseGeneration: reopenedRecord.baseGeneration,
        reopenedBaseSnapshotId: reopenedRecord.baseSnapshotId,
        reopenedPairStillAgrees:
          reopenedRecord.baseSnapshotId === reopenedHead.snapshotId &&
          reopenedRecord.baseGeneration === reopenedHead.generation,
        stalePairReadsSound: staleRecord.baseGeneration === 0 && staleRecord.baseSnapshotId === null,
        stalePairBaseGeneration: staleRecord.baseGeneration,
        stalePairBaseSnapshotId: staleRecord.baseSnapshotId,
      }
    } finally {
      await destroyP6T1World(reopened)
    }
  } finally {
    await destroyP6T1World(world)
  }
})()

// --- assertions ---------------------------------------------------------------

describe('A4-PR0 the proposal record against the three generations (A4-2, A4-3)', () => {
  it('G1 the three counters are three different numbers before the append', () => {
    // The precondition that makes every later assertion non-vacuous: with all
    // three equal, "baseGeneration is (c)" would be true of any wiring.
    expect(captured.distinctCounters).toBe(true)
    expect(captured.slotGenerationBefore).toBe(3)
    expect(captured.overlayBefore.generation).toBe(2)
    expect(captured.overlayBefore.snapshotId).toBe(permissionOverlaySnapshotKey(P6T4_ROOT, WORKER_ID, 2))
    expect(captured.stampBefore).toBe(captured.projectedStampBefore)
  })

  it('G2 the proposal append advances (a) by exactly one — repository and projection', () => {
    // (a) is the durable stamp every ledger fact advances; the projection is
    // its only client-visible surface (projection/fold.ts:99).
    expect(captured.stampAfter).toBe(captured.stampBefore + 1)
    expect(captured.projectedStampAfter).toBe(captured.projectedStampBefore + 1)
  })

  it('G3 the override slot winner is untouched, and its CAS still refuses at the same number (b)', () => {
    expect(captured.slotGenerationAfter).toBe(captured.slotGenerationBefore)
    expect(captured.slotConflictCode).toBe(MUTATION_ERROR_CODES.OVERRIDE_GENERATION_CONFLICT)
    expect(captured.slotConflictActual).toBe(captured.slotGenerationBefore)
    // Zero write: the refusal left the slot exactly as it found it.
    expect(captured.slotRowsAfterConflict).toBe(3)
  })

  it('G4 the overlay snapshot chain is untouched, and its CAS still refuses at the same number (c)', () => {
    expect(captured.overlayAfter.generation).toBe(captured.overlayBefore.generation)
    expect(captured.overlayAfter.snapshotId).toBe(captured.overlayBefore.snapshotId)
    expect(captured.overlayAfter.historyLength).toBe(captured.overlayBefore.historyLength)
    expect(captured.overlayConflictCode).toBe(PERMISSION_MUTATION_ERROR_CODES.GENERATION_CONFLICT)
    expect(captured.overlayConflictActual).toBe(captured.overlayBefore.generation)
  })

  it('G5 baseGeneration is the OVERLAY generation — not the stamp, not the slot (A4-2)', () => {
    expect(captured.appendedBaseGeneration).toBe(captured.overlayBefore.generation)
    expect(captured.appendedBaseSnapshotId).toBe(captured.overlayBefore.snapshotId)
    // The two numbers it must NOT be.
    expect(captured.appendedBaseGeneration).not.toBe(captured.stampBefore)
    expect(captured.appendedBaseGeneration).not.toBe(captured.slotGenerationBefore)
  })

  it('G6 the appended pair still identifies the overlay head after the append and a reopen (A4-3)', () => {
    expect(captured.reopenedBaseGeneration).toBe(captured.overlayBefore.generation)
    expect(captured.reopenedBaseSnapshotId).toBe(captured.overlayBefore.snapshotId)
    expect(captured.reopenedPairStillAgrees).toBe(true)
  })

  it('G7 neither CAS refusal nor the append left a stray proposal row behind', () => {
    // Two appends in this scenario: the honest pair and the stale pair.
    expect(captured.proposalCountAfterConflicts).toBe(2)
  })

  it('G8 a stale-but-consistent pair is a SOUND record — staleness is the commit revalidation, not the reader (spec §24.5)', () => {
    // The reader holds no overlay, so it cannot and must not decide staleness;
    // `(0, null)` is the legal empty-history pair. What it must never do is
    // report a pair that DISAGREES with itself as anything but corrupt
    // (a4pr0-proposal-corrupt C5).
    expect(captured.stalePairReadsSound).toBe(true)
    expect(captured.stalePairBaseGeneration).toBe(0)
    expect(captured.stalePairBaseSnapshotId).toBeNull()
  })
})
