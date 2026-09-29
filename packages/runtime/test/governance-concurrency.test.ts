/**
 * pre-alpha3 PR-A — GOVERNANCE MUTATION CONCURRENCY: the service's
 * shared-chain serialization closed the lost-update race (plan item 1),
 * the `expectedGeneration` guard surfaces a typed conflict under
 * concurrent same-guard writes (plan item 2), and a failed unit never
 * poisons the chain for the next writer.
 *
 * The contrast (the unserialized interleaving that LOSES an update) is
 * pinned by p8s5b-operation-fencing (R6a/R6b). This file pins the
 * service-level closure: concurrent callers against the ONE shared
 * coordinator resolve to a deterministic, complete final state.
 *
 * The overrides port is async with a tick of I/O latency so the
 * concurrent work genuinely overlaps at the port boundary; the chain
 * keeps the slot read-modify-write atomic.
 *
 * The runner executes these files under plain Node: all async work runs
 * in the top-level block, the `it` bodies assert synchronously.
 *
 * @module @dsh-agent-team/runtime/test/governance-concurrency
 */

import { describe, expect, it } from 'vitest'
import { createTeamOperationCoordinator } from '../coordination/index.js'
import {
  createGovernanceMutationService,
  isMutationError,
  MUTATION_ERROR_CODES,
  selectSlotWinner,
  slotIdentityOf,
  type GovernanceMutationService,
  type GovernanceTransitionCache,
  type GovernanceTransitionCommit,
} from '../governance/index.js'
import type {
  OverrideRecordView,
  OverrideStorePort,
  PolicyReader,
  PolicyStateTransitionRecord,
} from '../mutation/index.js'
import type { MutationError as MutationErrorType } from '../mutation/index.js'
import type { PolicyEntry } from '../../domain/policy/src/index.js'

const ROOT = 'session-gov-concurrency'
const NOW = '2026-09-29T00:00:00.000Z'

/** One tick of simulated I/O latency (overlap at the port boundary). */
const tick = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0))

class DuplicateStoreError extends Error {
  readonly code = 'RECORD_DUPLICATE'
  constructor() {
    super('a different record already occupies the key')
    this.name = 'DuplicateStoreError'
  }
}

/** The storage-faithful overrides port with an async read. */
class AsyncOverrides implements OverrideStorePort {
  readonly all: OverrideRecordView[] = []
  private readonly bytesByKey = new Map<string, string>()

  private identityKey(record: OverrideRecordView): string {
    const identity: Record<string, unknown> = {
      kind: record.kind,
      recordId: record.recordId,
      rootSessionId: record.rootSessionId,
      scope: record.scope,
    }
    if (record.instanceId !== undefined) identity['instanceId'] = record.instanceId
    return JSON.stringify(identity)
  }

  async list(rootSessionId: string): Promise<readonly OverrideRecordView[]> {
    await tick()
    return this.all.filter((record) => record.rootSessionId === rootSessionId)
  }

  async put(record: unknown): Promise<unknown> {
    const row = record as OverrideRecordView
    const key = this.identityKey(row)
    const bytes = JSON.stringify(row)
    const existing = this.bytesByKey.get(key)
    if (existing !== undefined) {
      if (existing === bytes) return this.all.find((candidate) => this.identityKey(candidate) === key)
      throw new DuplicateStoreError()
    }
    this.bytesByKey.set(key, bytes)
    this.all.push(row)
    return row
  }
}

class MemTransitions implements GovernanceTransitionCache {
  appendTransition(_teamSessionId: string, _transition: PolicyStateTransitionRecord): void {}
  listTransitions(_teamSessionId: string): readonly PolicyStateTransitionRecord[] {
    return []
  }
}

class MemCommit implements GovernanceTransitionCommit {
  async commit(_transition: PolicyStateTransitionRecord): Promise<void> {}
}

const noopPolicy: PolicyReader = {
  readBlueprintEnvelope: () => ({}),
  readTemplatePolicy: () => ({}),
  readExternalFacts: () => ({ hard: {}, capabilityExists: {} }),
}

function makeService(): { service: GovernanceMutationService; overrides: AsyncOverrides } {
  const overrides = new AsyncOverrides()
  const service = createGovernanceMutationService({
    chain: createTeamOperationCoordinator(),
    overrides,
    transitions: new MemTransitions(),
    transitionCommit: new MemCommit(),
    policy: noopPolicy,
    registeredMembers: () => Promise.resolve([]),
    policyStates: () => ['default', 'strict'],
    now: () => NOW,
  })
  return { service, overrides }
}

// ---------------------------------------------------------------------------
// C1: concurrent same-slot updates (different cells) — serialize, no lost
// update. Both land; the final winner carries BOTH cells.
// ---------------------------------------------------------------------------
const c1 = makeService()
const c1a = c1.service.setOverride({
  authority: { kind: 'operator' },
  rootSessionId: ROOT,
  scope: 'team',
  cells: { model: { kind: 'allow', items: ['m-a'] } } as Record<string, PolicyEntry>,
})
const c1b = c1.service.setOverride({
  authority: { kind: 'operator' },
  rootSessionId: ROOT,
  scope: 'team',
  cells: { mcp: { kind: 'deny' } } as Record<string, PolicyEntry>,
})
const [c1r1, c1r2] = await Promise.all([c1a, c1b])

// ---------------------------------------------------------------------------
// C2: concurrent same-slot writes with the SAME expectedGeneration guard:
// exactly one lands, the other is the typed generation conflict.
// ---------------------------------------------------------------------------
const c2 = makeService()
const c2seed = await c2.service.setOverride({
  authority: { kind: 'operator' },
  rootSessionId: ROOT,
  scope: 'team',
  cells: { model: { kind: 'allow', items: ['m-a'] } } as Record<string, PolicyEntry>,
})
const c2a = c2.service.setOverride({
  authority: { kind: 'operator' },
  rootSessionId: ROOT,
  scope: 'team',
  cells: { model: { kind: 'allow', items: ['m-b'] } } as Record<string, PolicyEntry>,
  expectedGeneration: 1,
})
const c2b = c2.service.setOverride({
  authority: { kind: 'operator' },
  rootSessionId: ROOT,
  scope: 'team',
  cells: { model: { kind: 'allow', items: ['m-c'] } } as Record<string, PolicyEntry>,
  expectedGeneration: 1,
})
/** Resolve a promise to its value or its rejection (outcome capture). */
async function outcome<T>(promise: Promise<T>): Promise<T | MutationErrorType> {
  try {
    return await promise
  } catch (error) {
    return error as MutationErrorType
  }
}
const [c2r1, c2r2] = await Promise.all([outcome(c2a), outcome(c2b)])

// ---------------------------------------------------------------------------
// C3: concurrent DIFFERENT slots (team + one instance) — both land, no
// cross-slot interference.
// ---------------------------------------------------------------------------
const c3 = makeService()
const c3a = c3.service.setOverride({
  authority: { kind: 'operator' },
  rootSessionId: ROOT,
  scope: 'team',
  cells: { model: { kind: 'allow', items: ['m-a'] } } as Record<string, PolicyEntry>,
})
const c3b = c3.service.setOverride({
  authority: { kind: 'operator' },
  rootSessionId: ROOT,
  scope: 'instance',
  instanceId: 'inst-x',
  cells: { skills: { kind: 'deny' } } as Record<string, PolicyEntry>,
})
const [c3r1, c3r2] = await Promise.all([c3a, c3b])

// ---------------------------------------------------------------------------
// C4: concurrent set + reset on the same slot — serialized; the final
// winner is exactly one coherent record (no resurrection race).
// ---------------------------------------------------------------------------
const c4 = makeService()
const c4seed = await c4.service.setOverride({
  authority: { kind: 'operator' },
  rootSessionId: ROOT,
  scope: 'team',
  cells: { model: { kind: 'allow', items: ['m-a'] } } as Record<string, PolicyEntry>,
})
const c4a = c4.service.setOverride({
  authority: { kind: 'operator' },
  rootSessionId: ROOT,
  scope: 'team',
  cells: { mcp: { kind: 'deny' } } as Record<string, PolicyEntry>,
})
const c4b = c4.service.resetOverride({
  authority: { kind: 'operator' },
  rootSessionId: ROOT,
  scope: 'team',
})
const [c4rSet, c4rReset] = await Promise.all([c4a, c4b])

// ---------------------------------------------------------------------------
// C5: a failed unit (the stale guard) never poisons the chain: the next
// writer on the SAME root succeeds.
// ---------------------------------------------------------------------------
const c5 = makeService()
const c5seed = await c5.service.setOverride({
  authority: { kind: 'operator' },
  rootSessionId: ROOT,
  scope: 'team',
  cells: { model: { kind: 'allow', items: ['m-a'] } } as Record<string, PolicyEntry>,
})
const c5stale = await c5.service
  .setOverride({
    authority: { kind: 'operator' },
    rootSessionId: ROOT,
    scope: 'team',
    cells: { model: { kind: 'allow', items: ['m-b'] } } as Record<string, PolicyEntry>,
    expectedGeneration: 99,
  })
  .then(
    (value): { ok: true; value: Awaited<ReturnType<typeof c5.service.setOverride>> } => ({ ok: true, value }),
    (error): { ok: false; error: Error } => ({ ok: false, error }),
  )
const c5next = await c5.service.setOverride({
  authority: { kind: 'operator' },
  rootSessionId: ROOT,
  scope: 'team',
  cells: { model: { kind: 'allow', items: ['m-b'] } } as Record<string, PolicyEntry>,
})

// ---------------------------------------------------------------------------
// Assertions
// ---------------------------------------------------------------------------

function winnerOf(overrides: AsyncOverrides): OverrideRecordView | null {
  const slotId = slotIdentityOf({ kind: 'human-override', scope: 'team', origin: undefined }, ROOT)
  return selectSlotWinner(overrides.all, slotId)
}

describe('PR-A governance concurrency — same-slot serialization (no lost update)', () => {
  it('both concurrent same-slot writes land; the final winner carries both cells', () => {
    expect(isMutationError(c1r1)).toBe(false)
    expect(isMutationError(c1r2)).toBe(false)
    if (!isMutationError(c1r1) && c1r1.changed && !isMutationError(c1r2) && c1r2.changed) {
      const gens = [c1r1.record.generation, c1r2.record.generation].sort((x, y) => x - y)
      expect(gens).toEqual([1, 2])
      const winner = winnerOf(c1.overrides)
      expect(winner).not.toBeNull()
      if (winner === null) throw new Error('no winner')
      // The lost-update signature would be ONE cell missing.
      expect(winner.values).toEqual({
        model: { kind: 'allow', items: ['m-a'] },
        mcp: { kind: 'deny' },
      })
      expect(winner.generation).toBe(2)
    }
  })
})

describe('PR-A governance concurrency — the same-guard race', () => {
  it('exactly one writer lands; the other gets the typed generation conflict', () => {
    const outcomes = [c2r1, c2r2]
    const landed: Array<Extract<typeof c2r1, { changed: true }>> = []
    const conflicts: Array<import('../mutation/index.js').MutationError> = []
    for (const outcome of outcomes) {
      if (isMutationError(outcome)) {
        if (outcome.code === MUTATION_ERROR_CODES.OVERRIDE_GENERATION_CONFLICT) conflicts.push(outcome)
      } else if (outcome.changed) {
        landed.push(outcome)
      }
    }
    expect(landed).toHaveLength(1)
    expect(conflicts).toHaveLength(1)
    if (landed.length === 1 && landed[0] !== undefined) {
      expect(landed[0].record.generation).toBe(2)
    }
    if (conflicts.length === 1 && conflicts[0] !== undefined) {
      expect(conflicts[0].details).toEqual({ expectedGeneration: 1, actualGeneration: 2 })
    }
    // The seed (generation 1) is still there; the slot holds exactly 2 records.
    expect(c2.overrides.all).toHaveLength(2)
    expect(c2seed.changed).toBe(true)
    if (c2seed.changed) expect(c2seed.record.generation).toBe(1)
  })
})

describe('PR-A governance concurrency — different slots do not interfere', () => {
  it('team and instance writes both land at their own generation 1', () => {
    expect(isMutationError(c3r1)).toBe(false)
    expect(isMutationError(c3r2)).toBe(false)
    if (!isMutationError(c3r1) && c3r1.changed && !isMutationError(c3r2) && c3r2.changed) {
      expect(c3r1.record.scope).toBe('team')
      expect(c3r1.record.generation).toBe(1)
      expect(c3r2.record.scope).toBe('instance')
      expect(c3r2.record.instanceId).toBe('inst-x')
      expect(c3r2.record.generation).toBe(1)
    }
    expect(c3.overrides.all).toHaveLength(2)
  })
})

describe('PR-A governance concurrency — the set/reset race', () => {
  it('serialized: the final winner is exactly one coherent record', () => {
    expect(isMutationError(c4rSet)).toBe(false)
    expect(c4rReset.removed).toBe(true)
    const winner = winnerOf(c4.overrides)
    expect(winner).not.toBeNull()
    if (winner === null) throw new Error('no winner')
    // The reset always wins the last write (it ran after the set in the
    // serialized order OR the set ran after the reset — in either
    // serialized order the final state is coherent: either the tombstone
    // (values {}) or the merged set. Both orders are valid; the state
    // must NOT be a half-merged phantom.
    const isTombstone = Object.keys(winner.values).length === 0
    const isMergedSet =
      JSON.stringify(winner.values) ===
      JSON.stringify({ model: { kind: 'allow', items: ['m-a'] }, mcp: { kind: 'deny' } })
    expect(isTombstone || isMergedSet).toBe(true)
    // History is preserved: seed + (set and/or tombstone) — no deletes.
    expect(c4.overrides.all.length).toBeGreaterThanOrEqual(2)
    expect(c4.overrides.all.length).toBeLessThanOrEqual(3)
  })
})

describe('PR-A governance concurrency — chain hygiene after a failed unit', () => {
  it('the stale-guard conflict does not poison the chain', () => {
    expect(c5stale.ok).toBe(false)
    if (!c5stale.ok) {
      expect(c5stale.error).toBeTruthy()
      const error = c5stale.error
      expect(isMutationError(error)).toBe(true)
      if (isMutationError(error)) {
        expect(error.code).toBe(MUTATION_ERROR_CODES.OVERRIDE_GENERATION_CONFLICT)
      }
    }
    expect(isMutationError(c5next)).toBe(false)
    if (!isMutationError(c5next) && c5next.changed) {
      expect(c5next.record.generation).toBe(2)
    }
  })
})
