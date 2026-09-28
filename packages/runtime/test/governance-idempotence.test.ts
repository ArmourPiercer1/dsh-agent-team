/**
 * pre-alpha3 PR-A — GOVERNANCE MUTATION IDEMPOTENCE: the desired-state
 * no-op (plan item 3 — a retry of the same desired state never writes a
 * new generation) and the idempotent reset (a reset of an already
 * tombstoned slot is a typed no-op, not a second tombstone).
 *
 * The semantics pinned here:
 *
 * - `setOverride` with cells that LEAVE THE SLOT'S WINNER VALUES
 *   UNCHANGED (a subset of equal values, or the full equal set) resolves
 *   `{changed:false}` with the current winner — zero durable writes;
 * - `setOverride` with a changed value is a real re-issue (gen + 1);
 * - `resetOverride` on an empty slot is `{removed:false}`;
 * - `resetOverride` on an already-tombstoned slot is `{removed:false}`
 *   with the standing tombstone as `current` — the reset's desired state
 *   ("no override in force") already holds;
 * - the tombstone does NOT swallow a later real change: a set after a
 *   reset re-issues a fresh record (the merged values over the empty
 *   tombstone base are the cells themselves).
 *
 * The runner executes these files under plain Node: all async work runs
 * in the top-level block, the `it` bodies assert synchronously.
 *
 * @module @dsh-agent-team/runtime/test/governance-idempotence
 */

import { describe, expect, it } from 'vitest'
import { createTeamOperationCoordinator } from '../coordination/index.js'
import {
  createGovernanceMutationService,
  isMutationError,
  MUTATION_ERROR_CODES,
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
import type { PolicyEntry } from '../../domain/policy/src/index.js'

const ROOT = 'session-gov-idempotence'
const NOW = '2026-09-29T00:00:00.000Z'

class MemOverrides implements OverrideStorePort {
  readonly all: OverrideRecordView[] = []
  async list(rootSessionId: string): Promise<readonly OverrideRecordView[]> {
    return this.all.filter((record) => record.rootSessionId === rootSessionId)
  }
  async put(record: unknown): Promise<unknown> {
    this.all.push(record as OverrideRecordView)
    return record
  }
}

class MemTransitions implements GovernanceTransitionCache {
  appendTransition(_teamSessionId: string, _transition: PolicyStateTransitionRecord): void {}
  listTransitions(_teamSessionId: string): readonly PolicyStateTransitionRecord[] {
    return []
  }
}

class MemCommit implements GovernanceTransitionCommit {
  async commit(
    _rootSessionId: string,
    _transition: PolicyStateTransitionRecord,
  ): Promise<void> {}
}

const noopPolicy: PolicyReader = {
  readBlueprintEnvelope: () => ({}),
  readTemplatePolicy: () => ({}),
  readExternalFacts: () => ({ hard: {}, capabilityExists: {} }),
}

function makeService(): { service: GovernanceMutationService; overrides: MemOverrides } {
  const overrides = new MemOverrides()
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

const cells = (m: string): Record<string, PolicyEntry> => ({ model: { kind: 'allow', items: [m] } })

// ---------------------------------------------------------------------------
// I1/I2/I3: the desired-state no-op on set
// ---------------------------------------------------------------------------
const i1 = makeService()
const i1seed = await i1.service.setOverride({
  authority: { kind: 'operator' },
  rootSessionId: ROOT,
  scope: 'team',
  cells: cells('m-a'),
})
const i1CountAfterSeed = i1.overrides.all.length
const i1retry = await i1.service.setOverride({
  authority: { kind: 'operator' },
  rootSessionId: ROOT,
  scope: 'team',
  cells: cells('m-a'),
})
const i1CountAfterRetry = i1.overrides.all.length
// A partial subset of the same value set: the merged winner is unchanged.
const i1subset = await i1.service.setOverride({
  authority: { kind: 'operator' },
  rootSessionId: ROOT,
  scope: 'team',
  cells: { model: i1seed.changed ? i1seed.record.values['model'] : ({} as PolicyEntry) } as Record<string, PolicyEntry>,
})
const i1CountAfterSubset = i1.overrides.all.length
const i1change = await i1.service.setOverride({
  authority: { kind: 'operator' },
  rootSessionId: ROOT,
  scope: 'team',
  cells: cells('m-b'),
})
const i1CountAfterChange = i1.overrides.all.length

// ---------------------------------------------------------------------------
// I7: a stale expectedGeneration still conflicts — even for a would-be
// no-op (the caller's view of the slot is stale; fail closed).
// ---------------------------------------------------------------------------
const i7stale = await i1.service
  .setOverride({
    authority: { kind: 'operator' },
    rootSessionId: ROOT,
    scope: 'team',
    cells: cells('m-b'),
    expectedGeneration: 1,
  })
  .then(
    (value): { ok: true; value: Awaited<ReturnType<typeof i1.service.setOverride>> } => ({ ok: true, value }),
    (error): { ok: false; error: Error } => ({ ok: false, error }),
  )
// A correct guard on the (now changed) slot: admitted.
const i7fresh = await i1.service.setOverride({
  authority: { kind: 'operator' },
  rootSessionId: ROOT,
  scope: 'team',
  cells: cells('m-c'),
  expectedGeneration: 2,
})

// ---------------------------------------------------------------------------
// I4/I5/I6: reset idempotence + the tombstone is not a no-op for changes
// ---------------------------------------------------------------------------
const i4 = makeService()
const i4emptyReset = await i4.service.resetOverride({
  authority: { kind: 'operator' },
  rootSessionId: ROOT,
  scope: 'team',
})
const i4CountAfterEmptyReset = i4.overrides.all.length
const i4seed = await i4.service.setOverride({
  authority: { kind: 'operator' },
  rootSessionId: ROOT,
  scope: 'team',
  cells: cells('m-a'),
})
const i4reset1 = await i4.service.resetOverride({
  authority: { kind: 'operator' },
  rootSessionId: ROOT,
  scope: 'team',
})
const afterReset1 = i4.overrides.all.length
const i4reset2 = await i4.service.resetOverride({
  authority: { kind: 'operator' },
  rootSessionId: ROOT,
  scope: 'team',
})
const afterReset2 = i4.overrides.all.length
// The tombstone does not swallow a later real change.
const i4reSet = await i4.service.setOverride({
  authority: { kind: 'operator' },
  rootSessionId: ROOT,
  scope: 'team',
  cells: cells('m-a'),
})

// ---------------------------------------------------------------------------
// Assertions
// ---------------------------------------------------------------------------

describe('PR-A governance idempotence — the desired-state no-op on set', () => {
  it('a retry of the exact desired state writes nothing and reports the current winner', () => {
    expect(i1seed.changed).toBe(true)
    if (!i1seed.changed) throw new Error('seed not admitted')
    expect(i1seed.record.generation).toBe(1)

    expect(i1retry.changed).toBe(false)
    if (!i1retry.changed) {
      expect(i1retry.reason).toBe('no-change')
      expect(i1retry.current).toBeTruthy()
      if (i1retry.current) expect(i1retry.current.recordId).toBe(i1seed.record.recordId)
    }
    // Zero writes from the retry: still exactly one record in the slot.
    expect(i1CountAfterSeed).toBe(1)
    expect(i1CountAfterRetry).toBe(1)

    // A partial subset of the same values: still no change (merge keeps
    // the winner values byte-equal).
    expect(i1subset.changed).toBe(false)
    if (!i1subset.changed) expect(i1subset.current?.recordId).toBe(i1seed.record.recordId)
    expect(i1CountAfterSubset).toBe(1)
  })

  it('a changed value is a real re-issue at generation + 1', () => {
    expect(i1change.changed).toBe(true)
    if (i1change.changed) {
      expect(i1change.record.generation).toBe(2)
      expect(i1change.record.values).toEqual(cells('m-b'))
    }
    expect(i1CountAfterChange).toBe(2)
  })
})

describe('PR-A governance idempotence — the generation guard on a no-op', () => {
  it('a stale guard still conflicts (the caller view is stale); a fresh guard passes', () => {
    expect(i7stale.ok).toBe(false)
    if (!i7stale.ok) {
      const error = i7stale.error
      expect(isMutationError(error)).toBe(true)
      if (isMutationError(error)) {
        expect(error.code).toBe(MUTATION_ERROR_CODES.OVERRIDE_GENERATION_CONFLICT)
      }
    }
    expect(i7fresh.changed).toBe(true)
    if (i7fresh.changed) expect(i7fresh.record.generation).toBe(3)
  })
})

describe('PR-A governance idempotence — the idempotent reset', () => {
  it('reset on an empty slot removes nothing', () => {
    expect(i4emptyReset.removed).toBe(false)
    if (i4emptyReset.removed === false) expect(i4emptyReset.current).toBeUndefined()
    expect(i4CountAfterEmptyReset).toBe(0)
  })

  it('the first reset writes the tombstone; the second reset is a typed no-op', () => {
    expect(i4seed.changed).toBe(true)
    expect(i4reset1.removed).toBe(true)
    if (i4reset1.removed) {
      expect(i4reset1.tombstone.values).toEqual({})
      expect(i4reset1.tombstone.generation).toBe(2)
    }
    expect(afterReset1).toBe(2) // seed + tombstone — nothing deleted

    expect(i4reset2.removed).toBe(false)
    if (i4reset2.removed === false) {
      expect(afterReset2).toBe(2) // no second tombstone
      expect(i4reset2.current).toBeTruthy()
      if (i4reset2.current) {
        expect(i4reset2.current.values).toEqual({})
        expect(i4reset2.current.generation).toBe(2)
      }
    }
  })

  it('the tombstone does not swallow a later real change', () => {
    expect(i4reSet.changed).toBe(true)
    if (i4reSet.changed) {
      expect(i4reSet.record.generation).toBe(3)
      expect(i4reSet.record.values).toEqual(cells('m-a'))
    }
    expect(i4.overrides.all).toHaveLength(3) // seed + tombstone + re-issue
  })
})
