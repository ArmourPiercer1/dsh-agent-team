/**
 * P8-S4B M6 (demoted by pre-alpha3 PR-A, ADR-03) — unit tests for the
 * NARROW governance-override PERSISTENCE primitive
 * (`persistGovernanceOverride`, DevPlan P8-S §18.2/§20.3: the backend
 * writer of the durable governance overrides the frozen policy layer
 * re-reads at every future Agent request boundary).
 *
 * pre-alpha3 PR-A: the production write authority is now the governance
 * mutation service (packages/runtime/governance — the authority/scope
 * closure, the write-time envelope + external-hard checks, the chain
 * serialization, the deterministic record-id mint, and the commit-
 * before-ack all live there). This file pins what the demoted primitive
 * still owns:
 *
 *  - A1 kind/origin consistency (an autonomy-overlay requires its
 *     traceability origin; a human-override carries none — the storage
 *     cross-field rules, typed at the boundary);
 *  - A3 structural validation: closed capability vocabulary, PolicyEntry
 *     shapes, clean ids, scope/instanceId cross-rules;
 *  - A4 the frozen one-record-per-slot ruling: cumulative mutations
 *     RE-ISSUE the full slot value set (merge winner + cells, new
 *     recordId, generation + 1), identity conflict is a typed rejection;
 *  - A5 optimistic generation guard (stale readers cannot clobber);
 *  - A6 the storage duplicate race maps to the identity-conflict code;
 *  - A7 selectSlotWinner mirrors the frozen winner rule (generation, then
 *     lexicographic recordId) and the slot boundaries.
 *
 * The authority->kind mapping and the authority scope rules (member = own
 * instance only) are the SERVICE's (slotOf) — pinned by
 * governance-mutation-authority.test.ts.
 *
 * The runner executes these files under plain Node: all async work runs in
 * the top-level block, the `it` bodies assert synchronously.
 *
 * @module @dsh-agent-team/runtime/test/p8s4b-override-admission
 */

import { describe, expect, it } from 'vitest'
import {
  MUTATION_ERROR_CODES,
  isMutationError,
  persistGovernanceOverride,
  selectSlotWinner,
  type OverrideRecordView,
  type OverrideStorePort,
} from '../mutation/index.js'

const ROOT = 'session-p8s4btest'
const NOW = (): string => '2026-08-31T00:00:00.000Z'

/** Canonical (sorted-key) JSON — the storage key/bytes discipline. */
function canonical(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map((item) => canonical(item)).join(',')}]`
  const record = value as Record<string, unknown>
  const keys = Object.keys(record).sort()
  return `{${keys.map((key) => `${JSON.stringify(key)}:${canonical(record[key])}`).join(',')}}`
}

class DuplicateStoreError extends Error {
  readonly code = 'RECORD_DUPLICATE'
  constructor() {
    super('a different record already occupies the key')
    this.name = 'DuplicateStoreError'
  }
}

/** In-memory store port honoring the storage idempotency/duplicate rules. */
class MemoryStore implements OverrideStorePort {
  private readonly all: OverrideRecordView[] = []
  private readonly bytesByKey = new Map<string, string>()

  private identityKey(record: OverrideRecordView): string {
    const identity: Record<string, unknown> = {
      kind: record.kind,
      recordId: record.recordId,
      rootSessionId: record.rootSessionId,
      scope: record.scope,
    }
    if (record.instanceId !== undefined) identity['instanceId'] = record.instanceId
    return canonical(identity)
  }

  async list(rootSessionId: string): Promise<readonly OverrideRecordView[]> {
    return this.all.filter((record) => record.rootSessionId === rootSessionId)
  }

  async put(record: unknown): Promise<unknown> {
    const row = record as OverrideRecordView
    const key = this.identityKey(row)
    const bytes = canonical(record)
    const existing = this.bytesByKey.get(key)
    if (existing !== undefined) {
      if (existing === bytes) {
        return this.all.find((candidate) => this.identityKey(candidate) === key)
      }
      throw new DuplicateStoreError()
    }
    this.bytesByKey.set(key, bytes)
    this.all.push(row)
    return row
  }

  /** Seed an occupied identity with DIFFERENT bytes (simulate a race). */
  seedConflict(record: unknown): void {
    const row = record as OverrideRecordView
    this.bytesByKey.set(this.identityKey(row), 'conflicting-bytes')
  }
}

const modelAllow = { model: { kind: 'allow', items: ['p6t6-static/p6t6-model-v2'] } }
const mcpAllow = { mcp: { kind: 'allow', items: ['p8s4bmini'] } }
const mcpDeny = { mcp: { kind: 'deny' } }

const a1: Awaited<ReturnType<typeof persistGovernanceOverride>> = await persistGovernanceOverride(
  {
    kind: 'autonomy-overlay',
    origin: 'leader',
    rootSessionId: ROOT,
    recordId: 'p8s4b-ovr-model',
    scope: 'team',
    cells: modelAllow,
    now: NOW,
  },
  new MemoryStore(),
)

// A fresh store for the cumulative sequence (the live driver's sequence).
const store = new MemoryStore()
await persistGovernanceOverride(
  { kind: 'autonomy-overlay', origin: 'leader', rootSessionId: ROOT, recordId: 'p8s4b-ovr-model', scope: 'team', cells: modelAllow, now: NOW },
  store,
)
const c2 = await persistGovernanceOverride(
  { kind: 'autonomy-overlay', origin: 'leader', rootSessionId: ROOT, recordId: 'p8s4b-ovr-mcp-allow', scope: 'team', cells: mcpAllow, now: NOW },
  store,
)
const c3 = await persistGovernanceOverride(
  { kind: 'autonomy-overlay', origin: 'leader', rootSessionId: ROOT, recordId: 'p8s4b-ovr-mcp-deny', scope: 'team', cells: mcpDeny, now: NOW },
  store,
)

const selfOverlay = await persistGovernanceOverride(
  {
    kind: 'autonomy-overlay',
    origin: 'member',
    rootSessionId: ROOT,
    recordId: 'p8s4b-ovr-self',
    scope: 'instance',
    instanceId: 'inst-p8s4bself',
    cells: { skills: { kind: 'deny' } },
    now: NOW,
  },
  store,
)

const humanOverride = await persistGovernanceOverride(
  {
    kind: 'human-override',
    rootSessionId: ROOT,
    recordId: 'p8s4b-ovr-human',
    scope: 'team',
    cells: { permissions: { kind: 'allow', items: ['read'] } },
    now: NOW,
  },
  store,
)

async function capture(args: Parameters<typeof persistGovernanceOverride>[0], target: OverrideStorePort): Promise<unknown> {
  try {
    return await persistGovernanceOverride(args, target)
  } catch (error) {
    return error
  }
}

const overlayMissingOrigin = await capture(
  { kind: 'autonomy-overlay', rootSessionId: ROOT, recordId: 'p8s4b-ovr-mo', scope: 'team', cells: modelAllow, now: NOW },
  store,
)
const humanWithOrigin = await capture(
  { kind: 'human-override', origin: 'leader', rootSessionId: ROOT, recordId: 'p8s4b-ovr-ho', scope: 'team', cells: modelAllow, now: NOW },
  store,
)
const unknownCapability = await capture(
  { kind: 'autonomy-overlay', origin: 'leader', rootSessionId: ROOT, recordId: 'p8s4b-ovr-uc', scope: 'team', cells: { gpu: { kind: 'deny' } }, now: NOW },
  store,
)
const emptyCells = await capture(
  { kind: 'autonomy-overlay', origin: 'leader', rootSessionId: ROOT, recordId: 'p8s4b-ovr-ec', scope: 'team', cells: {}, now: NOW },
  store,
)
const badEntryKind = await capture(
  { kind: 'autonomy-overlay', origin: 'leader', rootSessionId: ROOT, recordId: 'p8s4b-ovr-bek', scope: 'team', cells: { model: { kind: 'forbid' } }, now: NOW },
  store,
)
const emptyItems = await capture(
  { kind: 'autonomy-overlay', origin: 'leader', rootSessionId: ROOT, recordId: 'p8s4b-ovr-ei', scope: 'team', cells: { model: { kind: 'allow', items: [] } }, now: NOW },
  store,
)
const nonStringItem = await capture(
  { kind: 'autonomy-overlay', origin: 'leader', rootSessionId: ROOT, recordId: 'p8s4b-ovr-nsi', scope: 'team', cells: { model: { kind: 'allow', items: [42] } }, now: NOW },
  store,
)
const denyExtraFields = await capture(
  { kind: 'autonomy-overlay', origin: 'leader', rootSessionId: ROOT, recordId: 'p8s4b-ovr-def', scope: 'team', cells: { model: { kind: 'deny', items: [] } }, now: NOW },
  store,
)
const whitespaceRecordId = await capture(
  { kind: 'autonomy-overlay', origin: 'leader', rootSessionId: ROOT, recordId: 'p8s4b ovr', scope: 'team', cells: modelAllow, now: NOW },
  store,
)
const longRecordId = await capture(
  { kind: 'autonomy-overlay', origin: 'leader', rootSessionId: ROOT, recordId: 'x'.repeat(129), scope: 'team', cells: modelAllow, now: NOW },
  store,
)
const teamScopeWithInstance = await capture(
  { kind: 'autonomy-overlay', origin: 'leader', rootSessionId: ROOT, recordId: 'p8s4b-ovr-tw', scope: 'team', instanceId: 'inst-p8s4bself', cells: modelAllow, now: NOW },
  store,
)
const instanceScopeWithoutId = await capture(
  { kind: 'autonomy-overlay', origin: 'leader', rootSessionId: ROOT, recordId: 'p8s4b-ovr-iw', scope: 'instance', cells: modelAllow, now: NOW },
  store,
)
const identityConflict = await capture(
  { kind: 'autonomy-overlay', origin: 'leader', rootSessionId: ROOT, recordId: 'p8s4b-ovr-model', scope: 'team', cells: mcpDeny, now: NOW },
  store,
)
// Same recordId in a DIFFERENT slot (instance scope) is a fresh identity.
const sameRecordIdOtherScope = await capture(
  {
    kind: 'autonomy-overlay',
    origin: 'member',
    rootSessionId: ROOT,
    recordId: 'p8s4b-ovr-model',
    scope: 'instance',
    instanceId: 'inst-p8s4bself',
    cells: { model: { kind: 'deny' } },
    now: NOW,
  },
  store,
)
const staleGeneration = await capture(
  { kind: 'autonomy-overlay', origin: 'leader', rootSessionId: ROOT, recordId: 'p8s4b-ovr-stale', scope: 'team', cells: mcpAllow, expectedGeneration: 99, now: NOW },
  store,
)
const staleGenerationZero = await capture(
  { kind: 'autonomy-overlay', origin: 'leader', rootSessionId: ROOT, recordId: 'p8s4b-ovr-stale0', scope: 'team', cells: mcpAllow, expectedGeneration: 0, now: NOW },
  store,
)
const correctGeneration = await capture(
  { kind: 'autonomy-overlay', origin: 'leader', rootSessionId: ROOT, recordId: 'p8s4b-ovr-gen4', scope: 'team', cells: { model: { kind: 'deny' } }, expectedGeneration: 3, now: NOW },
  store,
)
const raceStore = new MemoryStore()
raceStore.seedConflict({
  schemaVersion: 1,
  kind: 'autonomy-overlay',
  recordId: 'p8s4b-ovr-race',
  scope: 'team',
  rootSessionId: ROOT,
  values: { other: 'bytes' },
  generation: 1,
  updatedAt: NOW(),
  origin: 'leader',
})
const duplicateRace = await capture(
  { kind: 'autonomy-overlay', origin: 'leader', rootSessionId: ROOT, recordId: 'p8s4b-ovr-race', scope: 'team', cells: modelAllow, now: NOW },
  raceStore,
)
const passThroughStore: OverrideStorePort = {
  list: async () => [],
  put: async () => {
    throw new Error('seam exploded')
  },
}
const passThrough = await capture(
  { kind: 'autonomy-overlay', origin: 'leader', rootSessionId: ROOT, recordId: 'p8s4b-ovr-pt', scope: 'team', cells: modelAllow, now: NOW },
  passThroughStore,
)

// A7 — the frozen winner rule over hand-built slot views.
const view = (recordId: string, generation: number, extra?: Partial<OverrideRecordView>): OverrideRecordView => ({
  recordId,
  kind: 'autonomy-overlay',
  scope: 'team',
  rootSessionId: ROOT,
  values: { model: { kind: 'deny' } },
  generation,
  updatedAt: NOW(),
  origin: 'leader',
  ...extra,
})
const tieWinner = selectSlotWinner(
  [view('p8s4b-b', 1), view('p8s4b-a', 1)],
  { kind: 'autonomy-overlay', scope: 'team', rootSessionId: ROOT },
)
const generationWinner = selectSlotWinner(
  [view('p8s4b-low', 1), view('p8s4b-high', 2)],
  { kind: 'autonomy-overlay', scope: 'team', rootSessionId: ROOT },
)
const crossSlotIsolation = selectSlotWinner(
  [
    view('p8s4b-instance', 5, { scope: 'instance', instanceId: 'inst-p8s4bself' }),
    view('p8s4b-human', 9, { kind: 'human-override', origin: undefined }),
    view('p8s4b-team', 1),
  ],
  { kind: 'autonomy-overlay', scope: 'team', rootSessionId: ROOT },
)
const emptySlot = selectSlotWinner([], { kind: 'autonomy-overlay', scope: 'team', rootSessionId: ROOT })

function codeOf(value: unknown): string | undefined {
  return isMutationError(value) ? value.code : undefined
}

describe('P8-S4B M6 override persistence primitive (PR-A demoted)', () => {
  it('A1 an autonomy-overlay with origin leader persists its kind/origin', () => {
    expect(a1.kind).toBe('autonomy-overlay')
    expect(a1.origin).toBe('leader')
    expect(a1.scope).toBe('team')
    expect(a1.rootSessionId).toBe(ROOT)
    expect(a1.generation).toBe(1)
    expect(a1.updatedAt).toBe(NOW())
    expect(a1.supersededRecordId).toBe(null)
    expect(a1.values).toEqual({ model: { kind: 'allow', items: ['p6t6-static/p6t6-model-v2'] } })
  })

  it('A1 an autonomy-overlay with origin member persists its kind/origin', () => {
    expect(selfOverlay.kind).toBe('autonomy-overlay')
    expect(selfOverlay.origin).toBe('member')
    expect(selfOverlay.instanceId).toBe('inst-p8s4bself')
  })

  it('A1 a human-override persists without an origin', () => {
    expect(humanOverride.kind).toBe('human-override')
    expect(humanOverride.origin).toBe(undefined)
  })

  it('A1 an autonomy-overlay without an origin is a malformed input', () => {
    expect(codeOf(overlayMissingOrigin)).toBe(MUTATION_ERROR_CODES.MALFORMED_MUTATION_INPUT)
  })

  it('A1 a human-override carrying an origin is a malformed input', () => {
    expect(codeOf(humanWithOrigin)).toBe(MUTATION_ERROR_CODES.MALFORMED_MUTATION_INPUT)
  })

  it('A3 unknown capability is a closed-vocabulary rejection', () => {
    expect(codeOf(unknownCapability)).toBe(MUTATION_ERROR_CODES.MALFORMED_MUTATION_INPUT)
  })

  it('A3 empty cells are rejected', () => {
    expect(codeOf(emptyCells)).toBe(MUTATION_ERROR_CODES.MALFORMED_MUTATION_INPUT)
  })

  it('A3 bad entry kind is rejected', () => {
    expect(codeOf(badEntryKind)).toBe(MUTATION_ERROR_CODES.MALFORMED_MUTATION_INPUT)
  })

  it('A3 allow with empty items is rejected', () => {
    expect(codeOf(emptyItems)).toBe(MUTATION_ERROR_CODES.MALFORMED_MUTATION_INPUT)
  })

  it('A3 allow with a non-string item is rejected', () => {
    expect(codeOf(nonStringItem)).toBe(MUTATION_ERROR_CODES.MALFORMED_MUTATION_INPUT)
  })

  it('A3 deny carrying extra fields is rejected', () => {
    expect(codeOf(denyExtraFields)).toBe(MUTATION_ERROR_CODES.MALFORMED_MUTATION_INPUT)
  })

  it('A3 whitespace recordId is rejected', () => {
    expect(codeOf(whitespaceRecordId)).toBe(MUTATION_ERROR_CODES.MALFORMED_MUTATION_INPUT)
  })

  it('A3 over-long recordId is rejected', () => {
    expect(codeOf(longRecordId)).toBe(MUTATION_ERROR_CODES.MALFORMED_MUTATION_INPUT)
  })

  it('A3 team scope with instanceId is rejected', () => {
    expect(codeOf(teamScopeWithInstance)).toBe(MUTATION_ERROR_CODES.MALFORMED_MUTATION_INPUT)
  })

  it('A3 instance scope without instanceId is rejected', () => {
    expect(codeOf(instanceScopeWithoutId)).toBe(MUTATION_ERROR_CODES.MALFORMED_MUTATION_INPUT)
  })

  it('A4 cumulative mutation 2 re-issues the full slot values at generation 2', () => {
    expect(c2.generation).toBe(2)
    expect(c2.supersededRecordId).toBe('p8s4b-ovr-model')
    expect(c2.values).toEqual({
      model: { kind: 'allow', items: ['p6t6-static/p6t6-model-v2'] },
      mcp: { kind: 'allow', items: ['p8s4bmini'] },
    })
  })

  it('A4 cumulative mutation 3 keeps the model value and denies mcp at generation 3', () => {
    expect(c3.generation).toBe(3)
    expect(c3.supersededRecordId).toBe('p8s4b-ovr-mcp-allow')
    expect(c3.values).toEqual({
      model: { kind: 'allow', items: ['p6t6-static/p6t6-model-v2'] },
      mcp: { kind: 'deny' },
    })
  })

  it('A4 the same identity re-put is a typed identity conflict', () => {
    expect(codeOf(identityConflict)).toBe(MUTATION_ERROR_CODES.OVERRIDE_IDENTITY_CONFLICT)
  })

  it('A4 the same recordId in a different slot is a fresh identity', () => {
    expect(isMutationError(sameRecordIdOtherScope)).toBe(false)
    expect((sameRecordIdOtherScope as { scope: string }).scope).toBe('instance')
    // The instance slot already held selfOverlay (gen 1) -> this re-issues at gen 2.
    expect((sameRecordIdOtherScope as { generation: number }).generation).toBe(2)
  })

  it('A5 a stale expectedGeneration is a typed generation conflict', () => {
    expect(codeOf(staleGeneration)).toBe(MUTATION_ERROR_CODES.OVERRIDE_GENERATION_CONFLICT)
    const details = (staleGeneration as { details?: Record<string, unknown> }).details
    expect(details?.['expectedGeneration']).toBe(99)
    expect(details?.['actualGeneration']).toBe(3)
  })

  it('A5 expectedGeneration 0 against an occupied slot is a conflict', () => {
    expect(codeOf(staleGenerationZero)).toBe(MUTATION_ERROR_CODES.OVERRIDE_GENERATION_CONFLICT)
  })

  it('A5 the correct expectedGeneration admits at generation 4', () => {
    expect(isMutationError(correctGeneration)).toBe(false)
    expect((correctGeneration as { generation: number }).generation).toBe(4)
  })

  it('A6 the storage duplicate race maps to the identity-conflict code', () => {
    expect(codeOf(duplicateRace)).toBe(MUTATION_ERROR_CODES.OVERRIDE_IDENTITY_CONFLICT)
  })

  it('A6 a non-duplicate store failure is rethrown untouched', () => {
    expect(passThrough instanceof Error).toBe(true)
    expect((passThrough as Error).message).toBe('seam exploded')
  })

  it('A7 winner ties break to the lexicographically smallest recordId', () => {
    expect(tieWinner?.recordId).toBe('p8s4b-a')
  })

  it('A7 the highest generation wins regardless of recordId', () => {
    expect(generationWinner?.recordId).toBe('p8s4b-high')
  })

  it('A7 other slots never leak into the winner domain', () => {
    expect(crossSlotIsolation?.recordId).toBe('p8s4b-team')
  })

  it('A7 an empty slot has no winner', () => {
    expect(emptySlot).toBe(null)
  })
})
