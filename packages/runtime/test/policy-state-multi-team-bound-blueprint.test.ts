/**
 * pre-alpha3 W1 fix-A (F11, review fix guide §10) — the Remote
 * `policyState.get` / `policyState.set` closed set is the ADDRESSED
 * team's BOUND Blueprint (the durable TeamSession's bound snapshot
 * resolved through the catalog), NEVER the host boot Blueprint:
 *
 *  World: one host, boot root A (bound BP-A with policyStates A1/A2) and
 *  an owned root B (bound BP-B with policyStates B1/B2). The surface is
 *  the real s6-remote dispatcher over the REAL governance mutation
 *  service (per-root bound closed set — the same per-root authority the
 *  production root wires, root.ts `policyStates` dep). The host boot
 *  Blueprint (options.blueprint = BP-A) is deliberately present so the
 *  old boot-Blueprint precheck world would DISAGREE with the pinned
 *  behavior: the old Remote precheck would have REJECTED B2 on B (A2
 *  is boot-legal, B2 is not) and would have ADVERTISED A1/A2 on
 *  get(B) (B1/B2 are not boot-legal).
 *
 *  Pinned:
 *   - get(B) reports B's bound closed set (default + B1 + B2) minus the
 *     active state — never the boot team's states.
 *   - set(B2 on B) commits: an addressed-legal state absent from the
 *     boot team's policyStates is ADMITTED (the old boot precheck
 *     rejected it at the wire).
 *   - set(A2 on B) fails with the typed POLICY_STATE_UNKNOWN passing
 *     through the dispatcher (invariant 4b) — the SEMANTIC closed-set
 *     check is the Governance service's authority; the Remote performs
 *     shape validation only (stateId string).
 *   - no cross-root ledger leak: A's durable lane stays empty and A's
 *     active state stays `default` after B's transitions.
 *   - restart: a fresh world over the SAME durable stores preloads the
 *     durable lanes (the production single-root durable store stamps
 *     every row with its owning root and preloads exactly that root's
 *     rows — durable-mutation-store.ts); the bound set is re-resolved
 *     from the durable TeamSession row + catalog, B's active state is
 *     preserved, and the closed set still agrees (B1 admitted, A2
 *     refused).
 *
 *  The durable placement in this world is PER-ROOT (each root's own
 *  durable lane) — the 1:1 single-root production model; the F11
 *  semantics under test (closed-set authority + no cross-root READ
 *  leak at the surface) are independent of that placement.
 *
 *  The runner executes these files under plain Node: all async work runs
 *  in the top-level block, the `it` bodies assert synchronously on the
 *  captured per-step snapshots.
 *
 * @module @dsh-agent-team/runtime/test/policy-state-multi-team-bound-blueprint
 */

import { describe, expect, it } from 'vitest'

import {
  createS6RemoteDispatcher,
  createS6RemotePorts,
} from '../src/plugin/s6-remote.js'
import type { S6RemoteOptions } from '../src/plugin/s6-remote.js'
import type { ServerPrincipalDerivation } from '../src/plugin/types.js'
import type { TeamDomainRepositories } from '../../storage/repositories/index.js'
import type { BlueprintSnapshotRef, TeamSessionRecordDto } from '../../contracts/src/index.js'
import type { TeamBlueprint } from '../../domain/blueprint/src/index.js'
import type { BlueprintCatalog } from '../../domain/blueprint/src/index.js'
import { DEFAULT_POLICY_STATE_ID } from '../../domain/policy/src/index.js'
import {
  createGovernanceMutationService,
  type GovernanceChainPort,
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
import type { RemoteResponse, RemoteSafeRecord } from '../../remote/src/index.js'

const ROOT_A = 'root-a-multi-team'
const ROOT_B = 'root-b-multi-team'
const NOW = '2026-09-29T00:00:00.000Z'

// ---------------------------------------------------------------------------
// The two bound blueprints (only the fields the surface + service read).
// ---------------------------------------------------------------------------

function blueprintOf(
  blueprintId: string,
  contentHash: string,
  stateIds: string[],
): TeamBlueprint {
  return {
    schemaVersion: 1,
    blueprintId,
    revision: '1',
    contentHash,
    policyStates: stateIds.map((stateId) => ({ id: stateId, fields: [] })),
  } as unknown as TeamBlueprint
}

const BP_A = blueprintOf('BP-A', 'sha-a', ['A1', 'A2'])
const BP_B = blueprintOf('BP-B', 'sha-b', ['B1', 'B2'])

// ---------------------------------------------------------------------------
// The durable world: catalog + TeamSession rows + per-root durable lanes.
// ---------------------------------------------------------------------------

/** The host catalog: both blueprints resolvable at revision '1'. */
const catalog: BlueprintCatalog = {
  blueprintIds: ['BP-A', 'BP-B'],
  hasBlueprint: (blueprintId) => blueprintId === 'BP-A' || blueprintId === 'BP-B',
  listRevisions: () => ['1'],
  resolve: (blueprintId, revision) => {
    const rev = String(revision)
    if (blueprintId === 'BP-A' && rev === '1') return BP_A
    if (blueprintId === 'BP-B' && rev === '1') return BP_B
    throw new Error(`POLICY-STATE-MT guard: the catalog cannot resolve ${blueprintId}@${rev}`)
  },
  resolveLatest: (blueprintId) => catalog.resolve(blueprintId, '1'),
  snapshotOf: (blueprintId, revision) =>
    ({
      blueprintId,
      revision: String(revision),
      contentHash: blueprintId === 'BP-A' ? 'sha-a' : 'sha-b',
    }) as BlueprintSnapshotRef,
}

/** The durable TeamSession rows (the bound snapshot per root). */
const sessionRows = new Map<string, TeamSessionRecordDto>()
for (const row of [
  {
    schemaVersion: 1,
    rootSessionId: ROOT_A,
    blueprint: { blueprintId: 'BP-A', revision: '1', contentHash: 'sha-a' },
    createdAt: NOW,
    generation: 1,
  },
  {
    schemaVersion: 1,
    rootSessionId: ROOT_B,
    blueprint: { blueprintId: 'BP-B', revision: '1', contentHash: 'sha-b' },
    createdAt: NOW,
    generation: 1,
  },
] as TeamSessionRecordDto[]) {
  sessionRows.set(row.rootSessionId, row)
}

/**
 * The per-root BOUND Blueprint resolver (the SAME per-root authority the
 * production service dep resolves against: the durable TeamSession's
 * bound snapshot through the catalog, fail-closed on a missing row or a
 * content hash the catalog cannot reproduce — NEVER a boot fallback).
 */
function boundFor(rootSessionId: string): TeamBlueprint {
  const row = sessionRows.get(rootSessionId)
  if (row === undefined) {
    throw new Error(`POLICY-STATE-MT guard: no durable TeamSession for root '${rootSessionId}'`)
  }
  const snapshot = row.blueprint
  const resolved = catalog.resolve(String(snapshot.blueprintId), String(snapshot.revision))
  if (String(resolved.contentHash) !== String(snapshot.contentHash)) {
    throw new Error(`POLICY-STATE-MT guard: the catalog cannot reproduce the content hash of '${rootSessionId}'`)
  }
  return resolved
}

/** The durable PolicyState lanes (per root — the single-root production
 *  model: every row stamped with its owning root, preloaded per root). */
const durableLanes = new Map<string, PolicyStateTransitionRecord[]>()

// ---------------------------------------------------------------------------
// The per-root in-memory transition cache (the production read lane).
// ---------------------------------------------------------------------------

class PerRootTransitions implements GovernanceTransitionCache {
  private readonly lanes = new Map<string, PolicyStateTransitionRecord[]>()

  appendTransition(teamSessionId: string, transition: PolicyStateTransitionRecord): void {
    const lane = this.lanes.get(teamSessionId) ?? []
    lane.push(transition)
    this.lanes.set(teamSessionId, lane)
  }

  listTransitions(teamSessionId: string): readonly PolicyStateTransitionRecord[] {
    return this.lanes.get(teamSessionId) ?? []
  }
}

/** The production preload: the durable rows re-appended in admission order. */
function preloadFromDurable(): PerRootTransitions {
  const cache = new PerRootTransitions()
  for (const [root, lane] of durableLanes) {
    for (const transition of lane) cache.appendTransition(root, transition)
  }
  return cache
}

// ---------------------------------------------------------------------------
// One world: the real service + the real s6-remote surface.
// ---------------------------------------------------------------------------

class MemOverrides implements OverrideStorePort {
  readonly all: OverrideRecordView[] = []
  async list(_rootSessionId: string): Promise<readonly OverrideRecordView[]> {
    return []
  }
  async put(_record: unknown): Promise<unknown> {
    throw new Error('POLICY-STATE-MT guard: the policyState path must not write overrides')
  }
}

const noopPolicy: PolicyReader = {
  readBlueprintEnvelope: () => ({}),
  readTemplatePolicy: () => ({}),
  readExternalFacts: () => ({ hard: {}, capabilityExists: {} }),
}

/** The trip-wire repositories: teamSessions.get is REAL (the bound
 *  snapshot source); EVERY other access is a test failure. */
function worldRepositories(): TeamDomainRepositories {
  const trip = (name: string): never => {
    throw new Error(`POLICY-STATE-MT guard: the policyState path must not touch repositories.${name}`)
  }
  return {
    teamSessions: {
      list: () => trip('teamSessions.list'),
      get: (rootSessionId: string) => sessionRows.get(rootSessionId),
      put: () => trip('teamSessions.put'),
    },
    memberInstances: { list: () => trip('memberInstances.list'), get: () => trip('memberInstances.get'), put: () => trip('memberInstances.put') },
    sessionBindings: { get: () => trip('sessionBindings.get'), put: () => trip('sessionBindings.put'), listByKind: () => trip('sessionBindings.listByKind') },
    schemaMeta: { listStamps: () => trip('schemaMeta.listStamps'), size: 0 },
    overrides: { list: () => trip('overrides.list') },
    compatibility: { get: () => trip('compatibility.get') },
    operations: { list: () => trip('operations.list') },
    ledger: { list: () => trip('ledger.list'), count: () => trip('ledger.count') },
  } as unknown as TeamDomainRepositories
}

/** The human operator principal (explicit human transitions — invariant 40). */
const humanPrincipal: ServerPrincipalDerivation = () => ({ kind: 'human', humanId: 'human-op' })

function makeWorld(transitions: PerRootTransitions) {
  // The chain wrapper tracks the CURRENT root so the durable commit lands
  // in the addressed root's own lane (the single-root production model).
  const realChain = createTeamOperationCoordinator()
  const tracker: { current: string | undefined } = { current: undefined }
  const chain: GovernanceChainPort = {
    run: <T>(rootSessionId: string, work: () => Promise<T>): Promise<T> =>
      realChain.run(rootSessionId, async () => {
        tracker.current = rootSessionId
        try {
          return await work()
        } finally {
          tracker.current = undefined
        }
      }),
  }
  const transitionCommit: GovernanceTransitionCommit = {
    commit: (transition) => {
      const root = tracker.current
      if (root === undefined) {
        return Promise.reject(new Error('POLICY-STATE-MT guard: commit outside the chain — impossible'))
      }
      const lane = durableLanes.get(root) ?? []
      lane.push(transition)
      durableLanes.set(root, lane)
      return Promise.resolve()
    },
  }
  const service = createGovernanceMutationService({
    chain,
    overrides: new MemOverrides(),
    transitions,
    transitionCommit,
    policy: noopPolicy,
    registeredMembers: () => Promise.resolve([]),
    // THE PER-ROOT bound closed set (root.ts `policyStates` dep, verbatim
    // semantics): default + the ADDRESSED team's declared states.
    policyStates: (root) => [
      DEFAULT_POLICY_STATE_ID,
      ...boundFor(root).policyStates.map((state) => state.id),
    ],
    now: () => NOW,
  })
  const ports = createS6RemotePorts(
    {
      rootSessionId: ROOT_A,
      repositories: worldRepositories(),
      // The BOOT Blueprint — present so a boot-Blueprint closed set would
      // disagree with the pinned per-root authority (it must NOT be
      // consulted for the addressed team's policyState surface).
      blueprint: BP_A,
      catalog,
      governance: service,
      overrideRecords: () => [],
      mutationTransitions: (root: string) => transitions.listTransitions(root),
      leaderInstanceId: 'inst-leader',
      now: () => NOW,
      isOwnedRoot: (root: string) => root === ROOT_B,
    } as unknown as S6RemoteOptions,
  )
  return createS6RemoteDispatcher(ports, humanPrincipal)
}

function wire(params: Record<string, unknown>): Record<string, unknown> {
  return { version: 1, params }
}

function dataOf(response: RemoteResponse): Record<string, unknown> {
  if (!response.ok) throw new Error('POLICY-STATE-MT guard: expected a success result')
  return response.value.data as unknown as Record<string, unknown>
}

function errorOf(response: RemoteResponse): Record<string, unknown> {
  if (response.ok) throw new Error('POLICY-STATE-MT guard: expected an error result')
  return response.error as unknown as Record<string, unknown>
}

const laneCount = (root: string): number => durableLanes.get(root)?.length ?? 0

// ---------------------------------------------------------------------------
// The scenarios (top-level: every step completes before any `it` runs).
// ---------------------------------------------------------------------------

const W = await (async () => {
  const w1 = makeWorld(new PerRootTransitions())

  const w1GetB0 = await w1('policyState.get', wire({ teamSessionId: ROOT_B }))
  const w1GetA0 = await w1('policyState.get', wire({ teamSessionId: ROOT_A }))

  const w1SetB2 = await w1(
    'policyState.set',
    wire({ teamSessionId: ROOT_B, target: { stateId: 'B2' }, actor: { kind: 'human' } }),
  )
  const laneAfterW1SetB2 = laneCount(ROOT_B)

  const w1GetB1 = await w1('policyState.get', wire({ teamSessionId: ROOT_B }))

  const w1SetA2onB = await w1(
    'policyState.set',
    wire({ teamSessionId: ROOT_B, target: { stateId: 'A2' }, actor: { kind: 'human' } }),
  )
  const laneAfterW1SetA2onB = laneCount(ROOT_B)

  const w1SetB2Again = await w1(
    'policyState.set',
    wire({ teamSessionId: ROOT_B, target: { stateId: 'B2' }, actor: { kind: 'human' } }),
  )
  const laneAfterW1SetB2Again = laneCount(ROOT_B)

  const w1GetA1 = await w1('policyState.get', wire({ teamSessionId: ROOT_A }))

  // RESTART: a fresh world (fresh service + surface) over the SAME durable
  // stores; the cache is preloaded from the durable lanes (production
  // boot preload — sequence order, the rows already stamped per root).
  const w2 = makeWorld(preloadFromDurable())

  const w2GetB = await w2('policyState.get', wire({ teamSessionId: ROOT_B }))

  const w2SetB1 = await w2(
    'policyState.set',
    wire({ teamSessionId: ROOT_B, target: { stateId: 'B1' }, actor: { kind: 'human' } }),
  )
  const laneAfterW2SetB1 = laneCount(ROOT_B)

  const w2SetA2onB = await w2(
    'policyState.set',
    wire({ teamSessionId: ROOT_B, target: { stateId: 'A2' }, actor: { kind: 'human' } }),
  )
  const laneAfterW2SetA2onB = laneCount(ROOT_B)

  const w2GetA = await w2('policyState.get', wire({ teamSessionId: ROOT_A }))

  const laneB = [...(durableLanes.get(ROOT_B) ?? [])]
  const laneA = [...(durableLanes.get(ROOT_A) ?? [])]

  return {
    w1GetB0,
    w1GetA0,
    w1SetB2,
    laneAfterW1SetB2,
    w1GetB1,
    w1SetA2onB,
    laneAfterW1SetA2onB,
    w1SetB2Again,
    laneAfterW1SetB2Again,
    w1GetA1,
    w2GetB,
    w2SetB1,
    laneAfterW2SetB1,
    w2SetA2onB,
    laneAfterW2SetA2onB,
    w2GetA,
    laneB,
    laneA,
  }
})()

// ---------------------------------------------------------------------------
// The pins.
// ---------------------------------------------------------------------------

describe('pre-alpha3 W1 fix-A F11 — the policyState closed set is the ADDRESSED team\u2019s bound Blueprint (multi-team host)', () => {
  /** The `policyState.get` wire wraps the port record as `data.state`. */
  const stateOf = (response: RemoteResponse): Record<string, unknown> =>
    dataOf(response)['state'] as Record<string, unknown>
  /** The `policyState.set` wire wraps the port record as `data.transition`. */
  const transitionOf = (response: RemoteResponse): Record<string, unknown> =>
    dataOf(response)['transition'] as Record<string, unknown>

  it('get(B): the bound closed set of B (B1/B2) minus the active default — never the boot team\u2019s states', () => {
    const state = stateOf(W.w1GetB0)
    expect(state['stateId']).toBe(DEFAULT_POLICY_STATE_ID)
    expect(state['availableTransitions']).toEqual(['B1', 'B2'])
  })

  it('get(A): the boot team sees its OWN bound set (no cross-contamination in the other direction)', () => {
    const state = stateOf(W.w1GetA0)
    expect(state['stateId']).toBe(DEFAULT_POLICY_STATE_ID)
    expect(state['availableTransitions']).toEqual(['A1', 'A2'])
  })

  it('set(B2 on B) commits: an addressed-legal state absent from the boot team\u2019s policyStates is admitted (the old boot precheck rejected it)', () => {
    const transition = transitionOf(W.w1SetB2)
    expect((transition['state'] as Record<string, unknown>)['stateId']).toBe('B2')
    expect(transition['origin']).toBe('human')
    expect(W.laneAfterW1SetB2).toBe(1)
  })

  it('get(B) after the set: B2 is active; the available set is B\u2019s closed set minus B2', () => {
    const state = stateOf(W.w1GetB1)
    expect(state['stateId']).toBe('B2')
    expect(state['availableTransitions']).toEqual(['default', 'B1'])
  })

  it('set(A2 on B): the typed POLICY_STATE_UNKNOWN passes through (invariant 4b) with B\u2019s closed set in details — the semantic check is the service\u2019s', () => {
    const error = errorOf(W.w1SetA2onB)
    expect(error['code']).toBe('POLICY_STATE_UNKNOWN')
    const details = error['details'] as Record<string, unknown>
    const cause = details['cause'] as Record<string, unknown>
    expect(cause['code']).toBe('POLICY_STATE_UNKNOWN')
    expect(cause['details']).toEqual({
      reason: 'unknown-state',
      stateId: 'A2',
      closedStates: ['default', 'B1', 'B2'],
    })
    // Zero write: B\u2019s durable lane is unchanged.
    expect(W.laneAfterW1SetA2onB).toBe(1)
  })

  it('a self-transition (B2 on B) is a typed no-op (no new row)', () => {
    const transition = transitionOf(W.w1SetB2Again)
    expect(transition['noChange']).toBe(true)
    expect(transition['stateId']).toBe('B2')
    expect(W.laneAfterW1SetB2Again).toBe(1)
  })

  it('no cross-root ledger leak: A\u2019s lane stays empty and A\u2019s state stays the default after B\u2019s transitions', () => {
    const state = stateOf(W.w1GetA1)
    expect(state['stateId']).toBe(DEFAULT_POLICY_STATE_ID)
    expect(state['availableTransitions']).toEqual(['A1', 'A2'])
    expect(W.laneA).toHaveLength(0)
  })

  it('restart: the bound set is re-resolved from the durable row and B\u2019s active state is preserved (B2)', () => {
    const state = stateOf(W.w2GetB)
    expect(state['stateId']).toBe('B2')
    expect(state['availableTransitions']).toEqual(['default', 'B1'])
  })

  it('restart: an addressed-legal state is still admitted (B1 on B)', () => {
    const transition = transitionOf(W.w2SetB1)
    expect((transition['state'] as Record<string, unknown>)['stateId']).toBe('B1')
    expect(W.laneAfterW2SetB1).toBe(2)
  })

  it('restart: a foreign state is still refused (A2 on B, the typed conflict, zero write)', () => {
    const error = errorOf(W.w2SetA2onB)
    expect(error['code']).toBe('POLICY_STATE_UNKNOWN')
    const details = error['details'] as Record<string, unknown>
    const cause = details['cause'] as Record<string, unknown>
    expect(cause['details']).toEqual({
      reason: 'unknown-state',
      stateId: 'A2',
      closedStates: ['default', 'B1', 'B2'],
    })
    expect(W.laneAfterW2SetA2onB).toBe(2)
  })

  it('the final durable lanes are per-root: B carries both transitions (admission order), A carries none', () => {
    expect(W.laneB).toHaveLength(2)
    expect(W.laneA).toHaveLength(0)
    expect(W.laneB[0]?.state['stateId']).toBe('B2')
    expect(W.laneB[1]?.state['stateId']).toBe('B1')
    // The deterministic entry ids (state + lane length at admission).
    expect(W.laneB[0]?.entryId).toBe('ps-B2-0')
    expect(W.laneB[1]?.entryId).toBe('ps-B1-1')
  })
})
