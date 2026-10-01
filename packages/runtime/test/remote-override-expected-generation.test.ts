/**
 * pre-alpha3 W1 fix-A (F10, review fix guide §9) — REMOTE
 * `override.set` / `override.reset` INGRESS for the optional
 * `expectedGeneration` (remote contract v7):
 *
 *  A. the CONTRACT (the version-aware closed param schemas): v7 carries
 *     the optional field (present = the safe integer, verbatim; absent =
 *     structurally absent — the legacy call shape); the v1–v6 closed sets
 *     REJECT the field (`malformed-params` / `unknown-field` — the
 *     version bump never edits the old wire surface); malformed values
 *     (1.5 / -1 / '4' / null) are `malformed-params` on `expectedGeneration`.
 *  B. the PRODUCTION DISPATCHER over the real governance mutation
 *     service: a stale v7 guard → the typed
 *     `OVERRIDE_GENERATION_CONFLICT` passes through invariant 4b with its
 *     expected/actual pair under `details.cause.details` and ZERO write;
 *     a matching guard commits; an ABSENT guard is legacy even against a
 *     moved slot (set and reset); the v1 byte-for-byte call still works;
 *     the success provenance echoes the request's contract version.
 *  C. the INGRESS ARG SHAPE: the remote layer forwards the parsed number
 *     verbatim into the service guard, and keeps the field structurally
 *     ABSENT from the service call when the wire request carries none
 *     (no `undefined` key — the legacy shape, exactly).
 *
 * The real-host dual-client stale-save gate is PARENT-level (the
 * pr-a-governance-smoke kit, G6); this file is the in-process pin.
 *
 * The runner executes these files under plain Node: all async work runs
 * in the top-level block, the `it` bodies assert synchronously.
 *
 * @module @dsh-agent-team/runtime/test/remote-override-expected-generation
 */

import { describe, expect, it } from 'vitest'

import {
  createS6RemoteDispatcher,
  createS6RemotePorts,
} from '../src/plugin/s6-remote.js'
import type { S6RemoteOptions } from '../src/plugin/s6-remote.js'
import type { ServerPrincipalDerivation } from '../src/plugin/types.js'
import type { TeamDomainRepositories } from '../../storage/repositories/index.js'
import {
  REMOTE_CONTRACT_VERSION,
  REMOTE_CONTRACT_VERSION_V2,
  REMOTE_CONTRACT_VERSION_V3,
  REMOTE_CONTRACT_VERSION_V4,
  REMOTE_CONTRACT_VERSION_V5,
  REMOTE_CONTRACT_VERSION_V6,
  REMOTE_CONTRACT_VERSION_V7,
  REMOTE_CONTRACT_ERROR_CODES,
  isRemoteContractError,
  parseRemoteMethodParams,
} from '../../remote/src/index.js'
import type { RemoteResponse, RemoteSafeRecord } from '../../remote/src/index.js'
import {
  createGovernanceMutationService,
  selectSlotWinner,
  slotIdentityOf,
  type GovernanceTransitionCache,
  type GovernanceTransitionCommit,
} from '../governance/index.js'
import { createTeamOperationCoordinator } from '../coordination/index.js'
import type {
  OverrideRecordView,
  OverrideStorePort,
  PolicyReader,
  PolicyStateTransitionRecord,
} from '../mutation/index.js'
import type { PolicyEntry } from '../../domain/policy/src/index.js'
import { createMemberIdentity } from '../../domain/policy/src/index.js'
import type { MemberIdentity } from '../../domain/policy/src/index.js'
import { createTeamDomain } from '../../storage/repositories/index.js'
import { FileStorageSeam, destroyDir, scratchDir } from '../../testkit/fault-injection/file-seam.mjs'
import { readEffectivePolicy } from '../effective-policy/index.js'

const ROOT_SID = 'root-session-remote-override-gen'
const NOW = '2026-09-29T00:00:00.000Z'

// ---------------------------------------------------------------------------
// Part A — the version-aware contract (parseRemoteMethodParams directly).
// ---------------------------------------------------------------------------

/** The closed v1 base fields (actor is REQUIRED on both override methods —
 *  the frozen v1 contract; the human-actor convention of the client). */
const SET_BASE = {
  teamSessionId: ROOT_SID,
  capability: 'model',
  value: { kind: 'allow', items: ['m-a'] },
  actor: { kind: 'human' },
}

/** The closed v1 base fields of override.reset (actor + capability are
 *  required there too — the reset is addressed per slot AND capability). */
const RESET_BASE = {
  teamSessionId: ROOT_SID,
  capability: 'model',
  actor: { kind: 'human' },
}

/** Parse, resolving to the value or the thrown typed error. */
async function parseOutcome(
  version: number,
  method: string,
  params: RemoteSafeRecord,
): Promise<{ ok: true; params: unknown } | { ok: false; error: Error }> {
  try {
    return { ok: true, params: parseRemoteMethodParams(version, method, params).params }
  } catch (error) {
    return { ok: false, error: error as Error }
  }
}

const aV7Present = await parseOutcome(REMOTE_CONTRACT_VERSION_V7, 'override.set', {
  ...SET_BASE,
  expectedGeneration: 4,
})
const aV7Absent = await parseOutcome(REMOTE_CONTRACT_VERSION_V7, 'override.set', { ...SET_BASE })
/** The six legacy versions must all reject the new field (closed sets). */
const aLegacyRejections: Array<{ ok: true; params: unknown } | { ok: false; error: Error }> = []
for (const version of [
  REMOTE_CONTRACT_VERSION,
  REMOTE_CONTRACT_VERSION_V2,
  REMOTE_CONTRACT_VERSION_V3,
  REMOTE_CONTRACT_VERSION_V4,
  REMOTE_CONTRACT_VERSION_V5,
  REMOTE_CONTRACT_VERSION_V6,
]) {
  aLegacyRejections.push(
    await parseOutcome(version, 'override.set', { ...SET_BASE, expectedGeneration: 4 }),
  )
}
/** The malformed-value matrix (v7): every one is a typed param rejection. */
const aMalformed: Array<{ ok: true; params: unknown } | { ok: false; error: Error }> = []
for (const bad of [1.5, -1, '4', null]) {
  aMalformed.push(
    await parseOutcome(REMOTE_CONTRACT_VERSION_V7, 'override.set', { ...SET_BASE, expectedGeneration: bad }),
  )
}
const aResetV7Present = await parseOutcome(REMOTE_CONTRACT_VERSION_V7, 'override.reset', {
  ...RESET_BASE,
  expectedGeneration: 4,
})
const aResetV6Field = await parseOutcome(REMOTE_CONTRACT_VERSION_V6, 'override.reset', {
  ...RESET_BASE,
  expectedGeneration: 4,
})
const aResetV7Bad = await parseOutcome(REMOTE_CONTRACT_VERSION_V7, 'override.reset', {
  ...RESET_BASE,
  expectedGeneration: '4',
})

// ---------------------------------------------------------------------------
// Part B — the production dispatcher over the real governance service.
// ---------------------------------------------------------------------------

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

/** The trip-wire repositories: ANY access is a test failure. */
function tripWireRepositories(): TeamDomainRepositories {
  const trip = (name: string): never => {
    throw new Error(`REMOTE-OVERRIDE-GEN guard: the override path must not touch repositories.${name}`)
  }
  return {
    teamSessions: { list: () => trip('teamSessions.list'), get: () => trip('teamSessions.get'), put: () => trip('teamSessions.put') },
    memberInstances: { list: () => trip('memberInstances.list'), get: () => trip('memberInstances.get'), put: () => trip('memberInstances.put') },
    sessionBindings: { get: () => trip('sessionBindings.get'), put: () => trip('sessionBindings.put'), listByKind: () => trip('sessionBindings.listByKind') },
    schemaMeta: { listStamps: () => trip('schemaMeta.listStamps'), size: 0 },
    overrides: { list: () => trip('overrides.list') },
    compatibility: { get: () => trip('compatibility.get') },
    operations: { list: () => trip('operations.list') },
    ledger: { list: () => trip('ledger.list'), count: () => trip('ledger.count') },
  } as unknown as TeamDomainRepositories
}

/** The human operator principal (closes the human-override slot). */
const humanPrincipal: ServerPrincipalDerivation = () => ({ kind: 'human', humanId: 'human-op' })

/** One wire envelope (the closed v1 envelope shape: version + params). */
function wire(version: number, params: Record<string, unknown>): Record<string, unknown> {
  return { version, params }
}

function errorOf(response: RemoteResponse): Record<string, unknown> {
  if (response.ok) throw new Error('REMOTE-OVERRIDE-GEN guard: expected an error result')
  return response.error as unknown as Record<string, unknown>
}

function dataOf(response: RemoteResponse): Record<string, unknown> {
  if (!response.ok) throw new Error('REMOTE-OVERRIDE-GEN guard: expected a success result')
  return response.value.data as unknown as Record<string, unknown>
}

function provenanceOf(response: RemoteResponse): Record<string, unknown> {
  if (!response.ok) throw new Error('REMOTE-OVERRIDE-GEN guard: expected a success result')
  return response.value.provenance as unknown as Record<string, unknown>
}

const B = await (async () => {
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
  const ports = createS6RemotePorts(
    {
      rootSessionId: ROOT_SID,
      repositories: tripWireRepositories(),
      governance: service,
      overrideRecords: (rootSessionId: string) =>
        overrides.all
          .filter((record) => record.rootSessionId === rootSessionId)
          .map((record) => record as unknown as Record<string, unknown>),
      mutationTransitions: () => [],
      leaderInstanceId: 'inst-leader',
      now: () => NOW,
    } as unknown as S6RemoteOptions,
  )
  const dispatch = createS6RemoteDispatcher(ports, humanPrincipal)

  const SLOT_ID = slotIdentityOf({ kind: 'human-override', scope: 'team', origin: undefined }, ROOT_SID)
  /** The durable store snapshot AFTER one step (the `it` bodies run only
   *  after EVERY step, so the per-step counts must be captured here). */
  const snap = (): { count: number; winnerGeneration: number | null } => {
    const winner = selectSlotWinner(overrides.all, SLOT_ID)
    return { count: overrides.all.length, winnerGeneration: winner === null ? null : winner.generation }
  }

  // 1. v7 set, ABSENT guard (the legacy shape on v7) → commits g1.
  const b1 = await dispatch(
    'override.set',
    wire(REMOTE_CONTRACT_VERSION_V7, { ...SET_BASE, value: { kind: 'allow', items: ['m-1'] } }),
  )
  const after1 = snap()
  // 2. the v1 byte-for-byte call (no field, v1 envelope) → commits g2.
  const b2 = await dispatch(
    'override.set',
    wire(REMOTE_CONTRACT_VERSION, { ...SET_BASE, value: { kind: 'allow', items: ['m-2'] } }),
  )
  const after2 = snap()
  // 3. v7 set, STALE guard (expected 1, the slot is at g2) → typed
  //    conflict, zero write.
  const b3 = await dispatch(
    'override.set',
    wire(REMOTE_CONTRACT_VERSION_V7, {
      ...SET_BASE,
      value: { kind: 'allow', items: ['m-3'] },
      expectedGeneration: 1,
    }),
  )
  const after3 = snap()
  // 4. v7 set, MATCHING guard (expected 2) → commits g3.
  const b4 = await dispatch(
    'override.set',
    wire(REMOTE_CONTRACT_VERSION_V7, {
      ...SET_BASE,
      value: { kind: 'allow', items: ['m-3'] },
      expectedGeneration: 2,
    }),
  )
  const after4 = snap()
  // 5. v7 set, ABSENT guard after the slot moved → legacy: commits g4.
  const b5 = await dispatch(
    'override.set',
    wire(REMOTE_CONTRACT_VERSION_V7, { ...SET_BASE, value: { kind: 'allow', items: ['m-4'] } }),
  )
  const after5 = snap()
  // 6. v7 reset, STALE guard (expected 3, the slot is at g4) → typed
  //    conflict, no tombstone.
  const b6 = await dispatch(
    'override.reset',
    wire(REMOTE_CONTRACT_VERSION_V7, { ...RESET_BASE, expectedGeneration: 3 }),
  )
  const after6 = snap()
  // 7. v7 reset, ABSENT guard → legacy: removes (the g5 tombstone).
  const b7 = await dispatch('override.reset', wire(REMOTE_CONTRACT_VERSION_V7, { ...RESET_BASE }))
  const after7 = snap()

  return { b1, b2, b3, b4, b5, b6, b7, after1, after2, after3, after4, after5, after6, after7 }
})()

// ---------------------------------------------------------------------------
// Part C — the ingress arg shape (a capturing fake governance service).
// ---------------------------------------------------------------------------

const C = await (async () => {
  const captured: Array<{ method: 'set' | 'reset'; args: Record<string, unknown> }> = []
  const admitted = (generation: number) => ({
    recordId: `rec-gen-${generation}`,
    kind: 'human-override',
    scope: 'team',
    rootSessionId: ROOT_SID,
    values: {} as Record<string, PolicyEntry>,
    generation,
    updatedAt: NOW,
  })
  const fakeGovernance = {
    setOverride: async (args: Record<string, unknown>): Promise<unknown> => {
      captured.push({ method: 'set', args })
      return { changed: true, record: admitted(1) }
    },
    resetOverride: async (args: Record<string, unknown>): Promise<unknown> => {
      captured.push({ method: 'reset', args })
      return { removed: true, tombstone: admitted(1) }
    },
    switchPolicyState: async (): Promise<unknown> => {
      throw new Error('REMOTE-OVERRIDE-GEN guard: switchPolicyState is not exercised here')
    },
  }
  const ports = createS6RemotePorts(
    {
      rootSessionId: ROOT_SID,
      repositories: tripWireRepositories(),
      governance: fakeGovernance as never,
      overrideRecords: () => [],
      mutationTransitions: () => [],
      leaderInstanceId: 'inst-leader',
      now: () => NOW,
    } as unknown as S6RemoteOptions,
  )
  const dispatch = createS6RemoteDispatcher(ports, humanPrincipal)

  const c1 = await dispatch(
    'override.set',
    wire(REMOTE_CONTRACT_VERSION_V7, { ...SET_BASE, expectedGeneration: 42 }),
  )
  const c2 = await dispatch('override.set', wire(REMOTE_CONTRACT_VERSION_V7, { ...SET_BASE }))
  const c3 = await dispatch(
    'override.reset',
    wire(REMOTE_CONTRACT_VERSION_V7, { ...RESET_BASE, expectedGeneration: 7 }),
  )
  const c4 = await dispatch('override.reset', wire(REMOTE_CONTRACT_VERSION_V7, { ...RESET_BASE }))

  return { captured, c1, c2, c3, c4 }
})()

// ---------------------------------------------------------------------------
// Part D — G-regression (fix/effective-policy-reset-fallback): the
// `override.get` value derives from the CURRENT LATEST slot winner ONLY —
// the full-slot re-issue lane means the LATEST row is the complete current
// state of the slot, so a capability the latest row does not carry has NO
// value at the slot (null): an older history row carrying it is
// AUDIT-ONLY. (The pre-fix scan resurrected the g1 `model` value after
// model->reset->mcp, handing the client a stale generation 1 that made the
// NEXT guarded write false-conflict against the LATEST row the write path
// actually validates — a deterministic conflict with zero concurrent
// writers.)
// ---------------------------------------------------------------------------

const D = await (async () => {
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
  const ports = createS6RemotePorts(
    {
      rootSessionId: ROOT_SID,
      repositories: tripWireRepositories(),
      governance: service,
      overrideRecords: (rootSessionId: string) =>
        overrides.all
          .filter((record) => record.rootSessionId === rootSessionId)
          .map((record) => record as unknown as Record<string, unknown>),
      mutationTransitions: () => [],
      leaderInstanceId: 'inst-leader',
      now: () => NOW,
    } as unknown as S6RemoteOptions,
  )
  const dispatch = createS6RemoteDispatcher(ports, humanPrincipal)

  const INST = { teamSessionId: ROOT_SID, scope: 'instance', targetInstanceId: 'inst-d' }
  // 1. g1 {model: A} (the instance slot).
  const d1 = await dispatch(
    'override.set',
    wire(REMOTE_CONTRACT_VERSION_V7, {
      ...INST,
      capability: 'model',
      value: { kind: 'allow', items: ['m-a'] },
      actor: { kind: 'human' },
    }),
  )
  // 2. reset the instance slot -> the g2 tombstone {}.
  const d2 = await dispatch(
    'override.reset',
    wire(REMOTE_CONTRACT_VERSION_V7, {
      ...INST,
      capability: 'model',
      actor: { kind: 'human' },
    }),
  )
  // 3. g3 {mcp: S} — a DIFFERENT capability in the SAME slot.
  const d3 = await dispatch(
    'override.set',
    wire(REMOTE_CONTRACT_VERSION_V7, {
      ...INST,
      capability: 'mcp',
      value: { kind: 'allow', items: ['srv-s'] },
      actor: { kind: 'human' },
    }),
  )
  // 4. get(model): the LATEST row (g3) has no `model` -> null at the slot
  //    (NOT the resurrected g1 value A with its stale generation 1).
  const d4 = await dispatch(
    'override.get',
    wire(REMOTE_CONTRACT_VERSION_V7, {
      teamSessionId: ROOT_SID,
      capability: 'model',
      scope: 'instance',
      targetInstanceId: 'inst-d',
    }),
  )
  // 5. get(mcp): the LATEST row carries it -> the g3 record.
  const d5 = await dispatch(
    'override.get',
    wire(REMOTE_CONTRACT_VERSION_V7, {
      teamSessionId: ROOT_SID,
      capability: 'mcp',
      scope: 'instance',
      targetInstanceId: 'inst-d',
    }),
  )
  // 6. the next UI write guarded by the CURRENT slot generation (3) ->
  //    commits g4 (no spurious conflict — the guard validates against the
  //    LATEST row).
  const d6 = await dispatch(
    'override.set',
    wire(REMOTE_CONTRACT_VERSION_V7, {
      ...INST,
      capability: 'model',
      value: { kind: 'allow', items: ['m-b'] },
      actor: { kind: 'human' },
      expectedGeneration: 3,
    }),
  )
  // 7. the RESURRECTED stale generation (1, from the g1 history row) still
  //    conflicts — the guard uses the LATEST row (g4), never a history row.
  const d7 = await dispatch(
    'override.set',
    wire(REMOTE_CONTRACT_VERSION_V7, {
      ...INST,
      capability: 'model',
      value: { kind: 'allow', items: ['m-c'] },
      actor: { kind: 'human' },
      expectedGeneration: 1,
    }),
  )
  // 8. control: get(model) after d6 -> the g4 record (model is back in the
  //    LATEST row).
  const d8 = await dispatch(
    'override.get',
    wire(REMOTE_CONTRACT_VERSION_V7, {
      teamSessionId: ROOT_SID,
      capability: 'model',
      scope: 'instance',
      targetInstanceId: 'inst-d',
    }),
  )
  // 9. control: get(model) on the TEAM slot (never written in this world)
  //    -> null.
  const d9 = await dispatch(
    'override.get',
    wire(REMOTE_CONTRACT_VERSION_V7, { teamSessionId: ROOT_SID, capability: 'model' }),
  )

  return { d1, d2, d3, d4, d5, d6, d7, d8, d9, count: overrides.all.length }
})()

// ---------------------------------------------------------------------------
// Assertions
// ---------------------------------------------------------------------------

describe('pre-alpha3 W1 fix-A F10 — the contract (version-aware closed sets)', () => {
  it('v7 override.set carries the optional expectedGeneration (present → the value, verbatim)', () => {
    expect(aV7Present.ok).toBe(true)
    if (aV7Present.ok) {
      expect((aV7Present.params as Record<string, unknown>)['expectedGeneration']).toBe(4)
      expect((aV7Present.params as Record<string, unknown>)['capability']).toBe('model')
    }
  })

  it('v7 override.set without the field parses it as structurally absent (the legacy shape)', () => {
    expect(aV7Absent.ok).toBe(true)
    if (aV7Absent.ok) {
      expect('expectedGeneration' in (aV7Absent.params as Record<string, unknown>)).toBe(false)
    }
  })

  it('every v1–v6 closed set rejects the field (malformed-params / unknown-field)', () => {
    expect(aLegacyRejections.length).toBe(6)
    for (const outcome of aLegacyRejections) {
      expect(outcome.ok).toBe(false)
      if (!outcome.ok) {
        expect(isRemoteContractError(outcome.error)).toBe(true)
        if (isRemoteContractError(outcome.error)) {
          expect(outcome.error.code).toBe(REMOTE_CONTRACT_ERROR_CODES.MALFORMED_PARAMS)
          const details = outcome.error.details as unknown as Record<string, unknown>
          expect(details['field']).toBe('expectedGeneration')
          expect(details['reason']).toBe('unknown-field')
        }
      }
    }
  })

  it('a malformed v7 expectedGeneration (1.5 / -1 / "4" / null) → malformed-params on the field', () => {
    expect(aMalformed.length).toBe(4)
    for (const outcome of aMalformed) {
      expect(outcome.ok).toBe(false)
      if (!outcome.ok) {
        expect(isRemoteContractError(outcome.error)).toBe(true)
        if (isRemoteContractError(outcome.error)) {
          expect(outcome.error.code).toBe(REMOTE_CONTRACT_ERROR_CODES.MALFORMED_PARAMS)
          const details = outcome.error.details as unknown as Record<string, unknown>
          expect(details['field']).toBe('expectedGeneration')
        }
      }
    }
  })

  it('v7 override.reset mirrors the set closed set (present → parses; v6 field → rejected; string → rejected)', () => {
    expect(aResetV7Present.ok).toBe(true)
    if (aResetV7Present.ok) {
      expect((aResetV7Present.params as Record<string, unknown>)['expectedGeneration']).toBe(4)
    }
    expect(aResetV6Field.ok).toBe(false)
    if (!aResetV6Field.ok) {
      expect(isRemoteContractError(aResetV6Field.error)).toBe(true)
      if (isRemoteContractError(aResetV6Field.error)) {
        expect(aResetV6Field.error.code).toBe(REMOTE_CONTRACT_ERROR_CODES.MALFORMED_PARAMS)
        const details = aResetV6Field.error.details as unknown as Record<string, unknown>
        expect(details['field']).toBe('expectedGeneration')
        expect(details['reason']).toBe('unknown-field')
      }
    }
    expect(aResetV7Bad.ok).toBe(false)
    if (!aResetV7Bad.ok) {
      expect(isRemoteContractError(aResetV7Bad.error)).toBe(true)
      if (isRemoteContractError(aResetV7Bad.error)) {
        expect(aResetV7Bad.error.code).toBe(REMOTE_CONTRACT_ERROR_CODES.MALFORMED_PARAMS)
        const details = aResetV7Bad.error.details as unknown as Record<string, unknown>
        expect(details['field']).toBe('expectedGeneration')
      }
    }
  })
})

describe('pre-alpha3 W1 fix-A F10 — the production dispatcher over the real governance service', () => {
  it('v7 absent guard commits (the legacy shape on v7); provenance echoes v7', () => {
    const data = dataOf(B.b1)
    expect(data['generation']).toBe(1)
    expect(provenanceOf(B.b1)['contractVersion']).toBe(REMOTE_CONTRACT_VERSION_V7)
  })

  it('the v1 byte-for-byte call still works (no field, v1 envelope); provenance echoes v1', () => {
    const data = dataOf(B.b2)
    expect(data['generation']).toBe(2)
    expect(provenanceOf(B.b2)['contractVersion']).toBe(REMOTE_CONTRACT_VERSION)
  })

  it('a stale v7 guard → the typed OVERRIDE_GENERATION_CONFLICT passes through (invariant 4b), zero write', () => {
    const error = errorOf(B.b3)
    expect(error['code']).toBe('OVERRIDE_GENERATION_CONFLICT')
    const details = error['details'] as Record<string, unknown>
    const cause = details['cause'] as Record<string, unknown>
    expect(cause['code']).toBe('OVERRIDE_GENERATION_CONFLICT')
    expect(cause['details']).toEqual({ expectedGeneration: 1, actualGeneration: 2 })
    // Zero write: the store held exactly the two committed records after
    // the two sets, and the refused set added NONE (the winner stays g2).
    expect(B.after1.count).toBe(1)
    expect(B.after1.winnerGeneration).toBe(1)
    expect(B.after2.count).toBe(2)
    expect(B.after2.winnerGeneration).toBe(2)
    expect(B.after3.count).toBe(2)
    expect(B.after3.winnerGeneration).toBe(2)
  })

  it('a matching v7 guard commits (g3); provenance echoes v7', () => {
    const data = dataOf(B.b4)
    expect(data['generation']).toBe(3)
    expect(provenanceOf(B.b4)['contractVersion']).toBe(REMOTE_CONTRACT_VERSION_V7)
    expect(B.after4.count).toBe(3)
    expect(B.after4.winnerGeneration).toBe(3)
  })

  it('v7 absent guard after the slot moved → legacy: the write lands (g4)', () => {
    const data = dataOf(B.b5)
    expect(data['generation']).toBe(4)
    expect(B.after5.count).toBe(4)
    expect(B.after5.winnerGeneration).toBe(4)
  })

  it('a stale v7 reset guard → the typed conflict on the wire, no tombstone', () => {
    const error = errorOf(B.b6)
    expect(error['code']).toBe('OVERRIDE_GENERATION_CONFLICT')
    const details = error['details'] as Record<string, unknown>
    const cause = details['cause'] as Record<string, unknown>
    expect(cause['details']).toEqual({ expectedGeneration: 3, actualGeneration: 4 })
    // No tombstone: the store is unchanged (4 records, winner still g4).
    expect(B.after6.count).toBe(4)
    expect(B.after6.winnerGeneration).toBe(4)
  })

  it('v7 absent reset → legacy: removes (the g5 tombstone)', () => {
    const data = dataOf(B.b7)
    expect(data['removed']).toBe(true)
    expect(B.after7.count).toBe(5)
    // The g5 tombstone wins the slot (empty values — "no override" to
    // the resolution side; selectSlotWinner still reports it as the
    // highest-generation slot record).
    expect(B.after7.winnerGeneration).toBe(5)
  })
})

describe('pre-alpha3 W1 fix-A F10 — the ingress arg shape (verbatim / structurally absent)', () => {
  it('present: the parsed number is forwarded verbatim into the service guard (set + reset)', () => {
    expect(C.c1.ok).toBe(true)
    expect(C.c3.ok).toBe(true)
    expect(C.captured.length).toBe(4)
    const setPresent = C.captured[0]
    const setAbsent = C.captured[1]
    const resetPresent = C.captured[2]
    const resetAbsent = C.captured[3]
    if (setPresent !== undefined && setAbsent !== undefined && resetPresent !== undefined && resetAbsent !== undefined) {
      expect(setPresent.method).toBe('set')
      expect(setPresent.args['expectedGeneration']).toBe(42)
      expect(typeof setPresent.args['expectedGeneration']).toBe('number')
      expect(resetPresent.method).toBe('reset')
      expect(resetPresent.args['expectedGeneration']).toBe(7)
    }
  })

  it('absent: the field is structurally ABSENT from the service call (no undefined key — the legacy shape)', () => {
    const setAbsent = C.captured[1]
    const resetAbsent = C.captured[3]
    if (setAbsent !== undefined && resetAbsent !== undefined) {
      expect('expectedGeneration' in setAbsent.args).toBe(false)
      expect('expectedGeneration' in resetAbsent.args).toBe(false)
    }
  })
})

describe('G-regression — override.get derives from the CURRENT LATEST slot winner only (no history resurrection)', () => {
  it('model->reset->mcp: get(model) is null at the slot (NOT the resurrected g1 value A / stale generation 1)', () => {
    expect(D.d1.ok).toBe(true)
    expect(dataOf(D.d1)['generation']).toBe(1)
    expect(D.d2.ok).toBe(true)
    expect(dataOf(D.d2)['removed']).toBe(true)
    expect(D.d3.ok).toBe(true)
    expect(dataOf(D.d3)['generation']).toBe(3)
    expect(dataOf(D.d4)['override']).toBeNull()
  })

  it('get(mcp) returns the LATEST row (g3) with the current slot generation', () => {
    const override = dataOf(D.d5)['override'] as Record<string, unknown>
    expect(override['recordId']).toBe('ovr-mcp-inst-d-g2')
    expect(override['generation']).toBe(3)
    expect(override['values']).toEqual({ mcp: { kind: 'allow', items: ['srv-s'] } })
  })

  it('the next UI write guarded by the CURRENT slot generation commits (no spurious conflict); the resurrected stale generation still conflicts', () => {
    expect(D.d6.ok).toBe(true)
    expect(dataOf(D.d6)['generation']).toBe(4)
    const error = errorOf(D.d7)
    expect(error['code']).toBe('OVERRIDE_GENERATION_CONFLICT')
    const details = error['details'] as Record<string, unknown>
    const cause = details['cause'] as Record<string, unknown>
    expect(cause['details']).toEqual({ expectedGeneration: 1, actualGeneration: 4 })
    // Zero write from the refused set: g1 + tombstone + g3 + g4 exactly.
    expect(D.count).toBe(4)
  })

  it('control: get(model) after the fresh write returns the LATEST row; the untouched TEAM slot reads null', () => {
    const override = dataOf(D.d8)['override'] as Record<string, unknown>
    expect(override['generation']).toBe(4)
    expect((override['values'] as Record<string, unknown>)['model']).toEqual({ kind: 'allow', items: ['m-b'] })
    expect((override['values'] as Record<string, unknown>)['mcp']).toEqual({ kind: 'allow', items: ['srv-s'] })
    expect(dataOf(D.d9)['override']).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Part E — the EXTERNAL-REVIEW mixed-kind regression (PR #47 BLOCK,
// 2026-09-29): the durable slot identity INCLUDES the override KIND
// (`governance/slot.ts` — kind + scope + rootSessionId + instanceId; the
// storage identity key `governanceOverrideKey` is kind-prefixed the same
// way). `override.get` is the HUMAN read plane — the TeamGovernance
// per-member editor reads and writes the EXPLICIT HUMAN override slot
// (the client documents the read as "the Explicit Human Override record")
// — so the LATEST row must be selected per the FULL slot identity: a
// member-kind row (autonomy-overlay) must never shadow a human value,
// and a member-kind generation must never be surfaced as the HUMAN write
// path's CAS input (the write-path guard, `selectSlotWinner`, is already
// kind-scoped — a member generation was never a valid human guard input,
// exactly the stale-generation class the G fix removed). Each kind's
// slot has its OWN independent generation sequence.
//
// The exact external repro (real governance mutation service + real
// dispatcher): HUMAN instance-slot model=A @ gen1 (the wire, the human
// UI write); MEMBER same instance mcp-deny @ gen1 then skills-deny @
// gen2 (a legitimate member tightening — the member lane is written
// through the REAL governance mutation service with MEMBER authority,
// the single PR-A authority the member team-tool path uses; the remote
// override wire itself is the human UI plane — D-7 rejects
// agent-actor instance scope on it).
// ---------------------------------------------------------------------------

const E_ROOT = 'root-session-override-mixed-kind'
const E_INST = 'inst-e'
const E_MEMBER = createMemberIdentity(E_ROOT, E_INST)

/** The static-facts + envelope authority: the template grants the MCP
 *  server `srv/x` (the baseline the member DENY must beat in the
 *  overlay lane); the model is granted in the envelope so the member's
 *  own-lane writes are exercised against a declared boundary (deny
 *  cells always pass — tightening never escalates). */
const ePolicy: PolicyReader = {
  readBlueprintEnvelope: () => ({ autonomyEnvelope: { model: { kind: 'allow', items: ['m-a', 'm-b', 'm-x'] } } }),
  readTemplatePolicy: () => ({
    values: { mcp: { kind: 'allow', items: ['srv/x'] } },
    mutationEnvelope: { model: { kind: 'allow', items: ['m-a', 'm-b', 'm-x'] } },
  }),
  readExternalFacts: () => ({ hard: {}, capabilityExists: {} }),
}

// The REAL STORAGE world: the human lane over the wire, the member lane
// over the real service.
const eDir = scratchDir('override-mixed-kind')
destroyDir(eDir) // self-cleaning: a crashed prior run may leave a domain behind
const eSeam = new FileStorageSeam(eDir)
const eDomain = await createTeamDomain(eSeam)
const eStore: OverrideStorePort = {
  list: (rootSessionId) => Promise.resolve(eDomain.repositories.overrides.list(rootSessionId)),
  put: (record) => eDomain.repositories.overrides.put(record),
}
const eService = createGovernanceMutationService({
  chain: createTeamOperationCoordinator(),
  overrides: eStore,
  transitions: new MemTransitions(),
  transitionCommit: new MemCommit(),
  policy: ePolicy,
  registeredMembers: () => Promise.resolve([E_MEMBER] as MemberIdentity[]),
  policyStates: () => ['default', 'strict'],
  now: () => NOW,
})
const ePorts = createS6RemotePorts(
  {
    rootSessionId: E_ROOT,
    repositories: tripWireRepositories(),
    governance: eService,
    overrideRecords: (rootSessionId: string) =>
      eDomain.repositories.overrides
        .list(rootSessionId)
        .map((record) => record as unknown as Record<string, unknown>),
    mutationTransitions: () => [],
    leaderInstanceId: 'inst-leader',
    now: () => NOW,
  } as unknown as S6RemoteOptions,
)
const eHuman = createS6RemoteDispatcher(ePorts, humanPrincipal)

const E_SET = { teamSessionId: E_ROOT, scope: 'instance', targetInstanceId: E_INST }
// 1. HUMAN instance-slot model=A @ gen1 (the wire — the human UI write).
const e1 = await eHuman(
  'override.set',
  wire(REMOTE_CONTRACT_VERSION_V7, {
    ...E_SET,
    capability: 'model',
    value: { kind: 'allow', items: ['m-a'] },
    actor: { kind: 'human' },
  }),
)
// 2. MEMBER same instance mcp-deny @ gen1 (its own lane — the real
//    service, MEMBER authority, own-instance closure).
const e2 = await eService.setOverride({
  authority: { kind: 'member', instanceId: E_INST },
  rootSessionId: E_ROOT,
  scope: 'instance',
  instanceId: E_INST,
  cells: { mcp: { kind: 'deny' } },
})
// 3. MEMBER skills-deny @ gen2 (a legitimate tightening — the full-slot
//    re-issue carries the merged mcp + skills).
const e3 = await eService.setOverride({
  authority: { kind: 'member', instanceId: E_INST },
  rootSessionId: E_ROOT,
  scope: 'instance',
  instanceId: E_INST,
  cells: { skills: { kind: 'deny' } },
})
// The canonical read BEFORE the human mcp write: both lanes coexist.
const eCanonicalBefore = readEffectivePolicy({
  rootSessionId: E_ROOT,
  instanceId: E_INST,
  policy: ePolicy,
  transitions: [],
  overrides: eDomain.repositories.overrides.list(E_ROOT),
})
// 4. get(model) on the HUMAN plane: the human A row — NOT null (the
//    member g2 row is a DIFFERENT slot) and NOT the member row.
const e4 = await eHuman(
  'override.get',
  wire(REMOTE_CONTRACT_VERSION_V7, {
    teamSessionId: E_ROOT,
    capability: 'model',
    scope: 'instance',
    targetInstanceId: E_INST,
  }),
)
// 5. get(mcp) on the HUMAN plane: the HUMAN slot has no mcp -> null (the
//    member mcp-deny must NOT become a human value or a human CAS input).
const e5 = await eHuman(
  'override.get',
  wire(REMOTE_CONTRACT_VERSION_V7, {
    teamSessionId: E_ROOT,
    capability: 'mcp',
    scope: 'instance',
    targetInstanceId: E_INST,
  }),
)
// 6. the HUMAN UI write of mcp, guarded EXACTLY as the client guards
//    (TeamGovernance readSlotGeneration: the settled wire record's
//    generation when present, legacy/unguarded when the read is null).
const e5Override = (dataOf(e5)['override'] ?? null) as Record<string, unknown> | null
const e6 = await eHuman(
  'override.set',
  wire(REMOTE_CONTRACT_VERSION_V7, {
    ...E_SET,
    capability: 'mcp',
    value: { kind: 'allow', items: ['srv-h'] },
    actor: { kind: 'human' },
    ...(e5Override !== null ? { expectedGeneration: e5Override['generation'] as number } : {}),
  }),
)
// 7. get(mcp) again: the HUMAN lane's LATEST row (its own sequence).
const e7 = await eHuman(
  'override.get',
  wire(REMOTE_CONTRACT_VERSION_V7, {
    teamSessionId: E_ROOT,
    capability: 'mcp',
    scope: 'instance',
    targetInstanceId: E_INST,
  }),
)
const eRecordsAfter = eDomain.repositories.overrides.list(E_ROOT)
destroyDir(eDir)

describe('E-external-review — the mixed-kind regression: the HUMAN read plane is per-KIND (full slot identity)', () => {
  it('repro leg 1: get(model) returns the HUMAN A row (the member g2 row must NOT shadow the human value)', () => {
    expect(e1.ok).toBe(true)
    expect(e2.changed).toBe(true)
    expect(e3.changed).toBe(true)
    const override = dataOf(e4)['override'] as Record<string, unknown>
    expect(override).not.toBeNull()
    expect(override['recordId']).toBe('ovr-model-inst-e-g0')
    expect(override['kind']).toBe('human-override')
    expect(override['generation']).toBe(1)
    expect(override['values']).toEqual({ model: { kind: 'allow', items: ['m-a'] } })
  })

  it('repro leg 2: get(mcp) is null on the HUMAN lane (the member mcp-deny is neither a human value nor a human CAS generation)', () => {
    expect(dataOf(e5)['override']).toBeNull()
  })

  it('repro leg 3: the human mcp write (guarded by the read) commits without a spurious conflict; the HUMAN lane keeps its own generation sequence', () => {
    expect(e6.ok).toBe(true)
    // The human mcp write lands in the HUMAN slot's OWN sequence: the
    // full-slot re-issue over the human g1 (model A) row -> human g2
    // (NEVER the member slot's generation — the member lane is at g2
    // too, but by its own sequence, and the value set differs).
    expect(dataOf(e6)['generation']).toBe(2)
    const override = dataOf(e7)['override'] as Record<string, unknown>
    expect(override['recordId']).toBe('ovr-mcp-inst-e-g1')
    expect(override['kind']).toBe('human-override')
    expect(override['generation']).toBe(2)
    expect(override['values']).toEqual({
      model: { kind: 'allow', items: ['m-a'] },
      mcp: { kind: 'allow', items: ['srv-h'] },
    })
  })

  it('lane coexistence: the canonical read (before the human mcp write) resolves model from the HUMAN lane and mcp/skills from the MEMBER lane', () => {
    // model: the HUMAN lane's row (the humanOverride layer).
    expect(eCanonicalBefore.policy.cells['model'].effective).toEqual({ kind: 'allow', items: ['m-a'] })
    expect(eCanonicalBefore.policy.cells['model'].team.layer).toBe('humanOverride')
    expect(eCanonicalBefore.policy.cells['model'].team.recordId).toBe('ovr-model-inst-e-g0')
    expect(eCanonicalBefore.humanOverride?.overrideId).toBe('ovr-model-inst-e-g0')
    expect(eCanonicalBefore.humanOverride?.scope).toBe('instance')
    // mcp + skills: the MEMBER lane's g2 row (the instanceOverlay lane)
    // — the member's g2 tightening beats the template mcp allow(srv/x).
    expect(eCanonicalBefore.policy.cells['mcp'].effective).toEqual({ kind: 'deny' })
    expect(eCanonicalBefore.policy.cells['mcp'].team.layer).toBe('instanceOverlay')
    expect(eCanonicalBefore.policy.cells['mcp'].team.recordId).toBe('ovr-skills-inst-e-g1')
    expect(eCanonicalBefore.policy.cells['skills'].effective).toEqual({ kind: 'deny' })
    expect(eCanonicalBefore.policy.cells['skills'].team.layer).toBe('instanceOverlay')
    expect(eCanonicalBefore.policy.cells['skills'].team.recordId).toBe('ovr-skills-inst-e-g1')
    // The staleness anchor counts both lanes' latest events (the member
    // g2 is the higher generation).
    expect(eCanonicalBefore.committedGeneration).toBe(2)
  })

  it('independent sequences: the per-KIND slot winner is selected per the full slot identity (the member lane is intact)', () => {
    expect(eRecordsAfter).toHaveLength(4)
    const keys = eRecordsAfter.map((record) => `${record.kind}|${record.recordId}|g${record.generation}`).sort()
    expect(keys).toEqual([
      'autonomy-overlay|ovr-mcp-inst-e-g0|g1',
      'autonomy-overlay|ovr-skills-inst-e-g1|g2',
      'human-override|ovr-mcp-inst-e-g1|g2',
      'human-override|ovr-model-inst-e-g0|g1',
    ])
    // Per-kind slot winners (the write-path guard's own kernel): the
    // member lane still shows its g2 tightening; the human lane shows
    // its own g2 (the human mcp write).
    const humanWinner = selectSlotWinner(
      eRecordsAfter as unknown as OverrideRecordView[],
      slotIdentityOf({ kind: 'human-override', scope: 'instance', origin: undefined, instanceId: E_INST }, E_ROOT),
    )
    expect(humanWinner?.recordId).toBe('ovr-mcp-inst-e-g1')
    expect(humanWinner?.generation).toBe(2)
    const memberWinner = selectSlotWinner(
      eRecordsAfter as unknown as OverrideRecordView[],
      slotIdentityOf({ kind: 'autonomy-overlay', scope: 'instance', origin: 'member', instanceId: E_INST }, E_ROOT),
    )
    expect(memberWinner?.recordId).toBe('ovr-skills-inst-e-g1')
    expect(memberWinner?.generation).toBe(2)
    expect(memberWinner?.values).toEqual({
      mcp: { kind: 'deny' },
      skills: { kind: 'deny' },
    })
  })
})
