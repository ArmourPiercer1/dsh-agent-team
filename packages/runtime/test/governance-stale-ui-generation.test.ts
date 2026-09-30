/**
 * pre-alpha3 W1 fix-A (F10, review fix guide §9) — STALE-UI GENERATION
 * GUARD: the production Remote `override.set` / `override.reset` ingress
 * gains the optional `expectedGeneration` (absent = legacy, no conflict
 * check; present = the optimistic guard the Governance service already
 * implements). This file pins the SERVICE-level closure the UI read-
 * through relies on:
 *
 *  1. concurrent writes under the shared chain still serialize (no lost
 *     update — both cells land, generation +2);
 *  2. the stale-UI sequence (read g4 → another writer commits g5 → the
 *     UI submits `expectedGeneration: 4`) → typed
 *     `OVERRIDE_GENERATION_CONFLICT` with the expected/actual pair, ZERO
 *     further write (the store holds exactly 5 records; the winner stays
 *     g5);
 *  3. legacy compatibility: a call WITHOUT `expectedGeneration` against
 *     an already-moved slot still succeeds (no guard, no conflict);
 *  4. a RESET carrying a stale `expectedGeneration` → the same typed
 *     conflict (no tombstone written); a reset carrying the CURRENT
 *     generation removes the slot.
 *
 * The real-host dual-client stale-save gate is PARENT-level (the
 * pr-a-governance-smoke kit, G6); this file is the in-process pin.
 *
 * The runner executes these files under plain Node: all async work runs
 * in the top-level block, the `it` bodies assert synchronously.
 *
 * @module @dsh-agent-team/runtime/test/governance-stale-ui-generation
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
import type { PolicyEntry } from '../../domain/policy/src/index.js'

const ROOT = 'session-gov-stale-ui'
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
  // pre-alpha3 re-land (w1a → pre-e base): the pre-e lineage widened the
  // commit port to the per-root (rootSessionId, transition) pair (the
  // durable row is stamped with the addressed root); the w1a test fake
  // adapted to the wider signature.
  async commit(_rootSessionId: string, _transition: PolicyStateTransitionRecord): Promise<void> {}
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

/** The UI's slot read (the override.get winner for the operator team slot). */
function winnerOf(overrides: AsyncOverrides): OverrideRecordView | null {
  const slotId = slotIdentityOf({ kind: 'human-override', scope: 'team', origin: undefined }, ROOT)
  return selectSlotWinner(overrides.all, slotId)
}

/** Resolve a promise to its value or its rejection (outcome capture). */
async function outcome<T>(promise: Promise<T>): Promise<T | Error> {
  try {
    return await promise
  } catch (error) {
    return error as Error
  }
}

function cells(model: string): Record<string, PolicyEntry> {
  return { model: { kind: 'allow', items: [model] } } as Record<string, PolicyEntry>
}

// ---------------------------------------------------------------------------
// S1: concurrent writes under the chain — serialize, no lost update.
// ---------------------------------------------------------------------------
const s1 = makeService()
const s1a = s1.service.setOverride({
  authority: { kind: 'operator' },
  rootSessionId: ROOT,
  scope: 'team',
  cells: cells('m-a'),
})
const s1b = s1.service.setOverride({
  authority: { kind: 'operator' },
  rootSessionId: ROOT,
  scope: 'team',
  cells: { mcp: { kind: 'deny' } } as Record<string, PolicyEntry>,
})
const [s1r1, s1r2] = await Promise.all([s1a, s1b])

// ---------------------------------------------------------------------------
// S2: the stale-UI sequence — read g4, another writer commits g5, the UI
// submits expectedGeneration 4 → typed conflict, zero g6, winner stays g5.
// ---------------------------------------------------------------------------
const s2 = makeService()
const s2g1 = await s2.service.setOverride({ authority: { kind: 'operator' }, rootSessionId: ROOT, scope: 'team', cells: cells('m-1') })
const s2g2 = await s2.service.setOverride({ authority: { kind: 'operator' }, rootSessionId: ROOT, scope: 'team', cells: cells('m-2') })
const s2g3 = await s2.service.setOverride({ authority: { kind: 'operator' }, rootSessionId: ROOT, scope: 'team', cells: cells('m-3') })
const s2g4 = await s2.service.setOverride({ authority: { kind: 'operator' }, rootSessionId: ROOT, scope: 'team', cells: cells('m-4') })
// The UI's most-recently-read slot winner (its guard input).
const s2read = winnerOf(s2.overrides)
const s2readGeneration = s2read === null ? -1 : s2read.generation
// Another writer moves the slot to g5 (the UI never observed it).
const s2g5 = await s2.service.setOverride({ authority: { kind: 'operator' }, rootSessionId: ROOT, scope: 'team', cells: cells('m-5') })
const s2stale = await s2.service
  .setOverride({
    authority: { kind: 'operator' },
    rootSessionId: ROOT,
    scope: 'team',
    cells: cells('m-stale-ui'),
    expectedGeneration: s2readGeneration,
  })
  .then(
    (value): { ok: true; value: typeof value } => ({ ok: true, value }),
    (error): { ok: false; error: Error } => ({ ok: false, error }),
  )

// ---------------------------------------------------------------------------
// S3: legacy compatibility — no expectedGeneration, the slot has moved →
// the write still lands (the absent field IS the legacy call shape).
// ---------------------------------------------------------------------------
const s3 = makeService()
await s3.service.setOverride({ authority: { kind: 'operator' }, rootSessionId: ROOT, scope: 'team', cells: cells('m-1') })
await s3.service.setOverride({ authority: { kind: 'operator' }, rootSessionId: ROOT, scope: 'team', cells: cells('m-2') })
const s3legacy = await s3.service
  .setOverride({ authority: { kind: 'operator' }, rootSessionId: ROOT, scope: 'team', cells: cells('m-3') })
  .then(
    (value): { ok: true; value: typeof value } => ({ ok: true, value }),
    (error): { ok: false; error: Error } => ({ ok: false, error }),
  )

// ---------------------------------------------------------------------------
// S4: a stale RESET — the slot moved to g2, the caller guards generation 1
// → the same typed conflict, NO tombstone; then the fresh reset (guard 2)
// removes the slot.
// ---------------------------------------------------------------------------
const s4 = makeService()
await s4.service.setOverride({ authority: { kind: 'operator' }, rootSessionId: ROOT, scope: 'team', cells: cells('m-1') })
await s4.service.setOverride({ authority: { kind: 'operator' }, rootSessionId: ROOT, scope: 'team', cells: cells('m-2') })
const s4staleReset = await s4.service
  .resetOverride({ authority: { kind: 'operator' }, rootSessionId: ROOT, scope: 'team', expectedGeneration: 1 })
  .then(
    (value): { ok: true; value: typeof value } => ({ ok: true, value }),
    (error): { ok: false; error: Error } => ({ ok: false, error }),
  )
const s4freshReset = await s4.service
  .resetOverride({ authority: { kind: 'operator' }, rootSessionId: ROOT, scope: 'team', expectedGeneration: 2 })
  .then(
    (value): { ok: true; value: typeof value } => ({ ok: true, value }),
    (error): { ok: false; error: Error } => ({ ok: false, error }),
  )

// ---------------------------------------------------------------------------
// Assertions
// ---------------------------------------------------------------------------

describe('pre-alpha3 W1 fix-A F10 — stale-UI generation guard (service level)', () => {
  it('S1: concurrent same-slot writes serialize — both cells land, no lost update', () => {
    expect(isMutationError(s1r1)).toBe(false)
    expect(isMutationError(s1r2)).toBe(false)
    if (!isMutationError(s1r1) && s1r1.changed && !isMutationError(s1r2) && s1r2.changed) {
      const gens = [s1r1.record.generation, s1r2.record.generation].sort((x, y) => x - y)
      expect(gens).toEqual([1, 2])
      const winner = winnerOf(s1.overrides)
      expect(winner).not.toBeNull()
      if (winner !== null) {
        expect(winner.generation).toBe(2)
        // The lost-update signature would be ONE cell missing.
        expect(winner.values).toEqual({
          model: { kind: 'allow', items: ['m-a'] },
          mcp: { kind: 'deny' },
        })
      }
    }
  })

  it('S2: read g4 → other writer g5 → stale UI (expectedGeneration 4) → typed conflict, ZERO g6, winner stays g5', () => {
    // The four seeded writes reached generation 4; the UI read it.
    expect(s2g4.changed).toBe(true)
    if (s2g4.changed) expect(s2g4.record.generation).toBe(4)
    expect(s2readGeneration).toBe(4)
    // The other writer moved the slot to g5.
    expect(s2g5.changed).toBe(true)
    if (s2g5.changed) expect(s2g5.record.generation).toBe(5)
    // The stale UI write is refused with the typed conflict + the pair.
    expect(s2stale.ok).toBe(false)
    if (!s2stale.ok) {
      expect(isMutationError(s2stale.error)).toBe(true)
      if (isMutationError(s2stale.error)) {
        expect(s2stale.error.code).toBe(MUTATION_ERROR_CODES.OVERRIDE_GENERATION_CONFLICT)
        expect(s2stale.error.details).toEqual({ expectedGeneration: 4, actualGeneration: 5 })
      }
    }
    // ZERO g6: exactly the five committed records; the winner is g5.
    expect(s2.overrides.all).toHaveLength(5)
    const winner = winnerOf(s2.overrides)
    expect(winner).not.toBeNull()
    if (winner !== null) {
      expect(winner.generation).toBe(5)
      expect(winner.values).toEqual({ model: { kind: 'allow', items: ['m-5'] } })
    }
  })

  it('S3: legacy absent — no expectedGeneration, moved slot → the write lands (no guard)', () => {
    expect(s3legacy.ok).toBe(true)
    if (s3legacy.ok) {
      expect(s3legacy.value.changed).toBe(true)
      if (s3legacy.value.changed) expect(s3legacy.value.record.generation).toBe(3)
    }
    expect(s3.overrides.all).toHaveLength(3)
  })

  it('S4: stale reset (expectedGeneration 1, slot at g2) → the same typed conflict, no tombstone; the fresh reset (guard 2) removes', () => {
    expect(s4staleReset.ok).toBe(false)
    if (!s4staleReset.ok) {
      expect(isMutationError(s4staleReset.error)).toBe(true)
      if (isMutationError(s4staleReset.error)) {
        expect(s4staleReset.error.code).toBe(MUTATION_ERROR_CODES.OVERRIDE_GENERATION_CONFLICT)
        expect(s4staleReset.error.details).toEqual({ expectedGeneration: 1, actualGeneration: 2 })
      }
    }
    // The fresh reset lands the g3 tombstone.
    expect(s4freshReset.ok).toBe(true)
    if (s4freshReset.ok) {
      expect(s4freshReset.value.removed).toBe(true)
      if (s4freshReset.value.removed) expect(s4freshReset.value.tombstone.generation).toBe(3)
    }
    // NO tombstone from the refused reset: the store holds exactly the
    // two set records + the ONE fresh tombstone (had the refused reset
    // written, the fresh tombstone would be generation 4, not 3).
    expect(s4.overrides.all).toHaveLength(3)
    const winner = winnerOf(s4.overrides)
    expect(winner).not.toBeNull()
    if (winner !== null) {
      expect(winner.generation).toBe(3)
      expect(Object.keys(winner.values)).toHaveLength(0)
    }
  })
})
