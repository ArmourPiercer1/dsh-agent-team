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
  async commit(_transition: PolicyStateTransitionRecord): Promise<void> {}
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
