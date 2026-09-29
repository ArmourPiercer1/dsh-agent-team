/**
 * pre-alpha3 W1 fix-A (F11) — review round 2 (B1/M1) — the PRODUCTION
 * wiring of the bound-Blueprint closed set: `policyState.get` /
 * `policyState.set` driven through the REAL production resolver
 * (`createBoundBlueprintResolver`, bound-blueprint.ts — the SAME factory
 * the host entry wires), the REAL `createBlueprintAuthority` (bootstrap-
 * only: `createBlueprintSourceIndex({ blueprintDir: undefined })` — the
 * filesystem catalog disabled; an in-memory registry for the frozen
 * rows), the REAL `createLiveBlueprintCatalog` facade, and REAL
 * `TeamSessionRecordDto` rows — wired exactly like production (root.ts
 * `policyStates` dep = the factory resolver's closed set; the s6-remote
 * `blueprint` option = the row anchor = the host boot Blueprint).
 *
 *  World: one host; the boot root is bound to the ANCHOR (team.alpha @
 *  "2" — the FULL fixture, one declared policyState 'active'); three
 *  owned roots:
 *   - B' (ROOT_MISMATCH): bound ref = the anchor identity with a
 *     MUTATED contentHash (a valid hash-grammar string the authority
 *     cannot reproduce) — the M1 negative case;
 *   - C (ROOT_GHOST): bound ref naming an identity the authority cannot
 *     resolve (no registry row, not the bootstrap anchor, no saved
 *     source) — the unresolvable case;
 *   - D (ROOT_LEGACY): a no-ref row (the `blueprint` field ABSENT — the
 *     pre-repair legacy shape; the DTO type models the field as
 *     REQUIRED, the runtime rows predate it — represented here via a
 *     cast, which is exactly the shape the resolver's case 2 consumes:
 *     `row.blueprint === undefined`).
 *
 *  Pinned:
 *   - S-mismatch (closes M1 + the B1 set path): get(B') fails typed
 *     TEAM_REMOTE_TEAM_CREATE_BLUEPRINT_MISMATCH (the remote plane's
 *     own hash check — invariant 4b, reason 'domain-error'; the source
 *     TeamPluginError carries its machine details under the SINGULAR
 *     `detail` key, which invariant 4b does NOT surface —
 *     `cause.details` stays absent); set(B', 'active') — a state the
 *     ANCHOR declares — fails typed POLICY_STATE_SNAPSHOT_MISMATCH
 *     (the service-level mapping of the raw authority
 *     TEAM_BLUEPRINT_SNAPSHOT_MISMATCH — the raw code is not a closed
 *     wire code — with reason 'snapshot-mismatch' and
 *     blueprintId/revision/expectedContentHash/foundContentHash under
 *     `cause.details`). The anchor's states are NOT advertised and NOT
 *     admitted for B'; NO transition commits (B''s durable lane stays
 *     empty).
 *   - S-unresolvable: get(C) / set(C) fail typed MALFORMED_DTO
 *     (blueprint-not-found — the authority's closed contract wording,
 *     invariant 4b pass-through carrying its own details); no anchor
 *     fallback; no commit.
 *   - S-legacy-no-ref (pins the documented legacy binding): get(D)
 *     advertises the ANCHOR's closed set (default + 'active') — the row
 *     anchor IS the team's bound blueprint by definition (case 2 of
 *     the three-case contract; the production read path resolves it
 *     through the s6-remote no-ref branch instead of crashing
 *     untyped); set(D, 'active') commits (entryId ps-active-0); set(D,
 *     'foreign') fails typed POLICY_STATE_UNKNOWN against the ANCHOR's
 *     closed set (closedStates default + active); D's durable lane
 *     holds exactly the one committed transition.
 *   - the factory's three cases DIRECTLY (resolver level, pre-mapping):
 *     missing row → throw; no-ref row → the parsed anchor; bound ref →
 *     the authority (resolvable → the anchor; mutated hash → the raw
 *     TEAM_BLUEPRINT_SNAPSHOT_MISMATCH with reason
 *     'snapshot-content-mismatch'; unknown identity → the raw
 *     MALFORMED_DTO blueprint-not-found).
 *
 *  Reverse verification (review round 2 — run against SCRATCH
 *  uncommitted corruptions of the factory, then restored): (i) a
 *  mismatched-ref branch that RETURNS THE ANCHOR instead of
 *  resolveSnapshot turns S-mismatch RED (set would admit 'active' /
 *  get would succeed — the assertions below fail); (ii) a no-ref
 *  branch that THROWS turns S-legacy-no-ref RED (get/set fail untyped).
 *  Both red runs are recorded in the router log with their exact
 *  failure lines; the restored tree is green.
 *
 *  The runner executes these files under plain Node: all async work
 *  runs in the top-level block, the `it` bodies assert synchronously
 *  on the captured per-step snapshots.
 *
 * @module @dsh-agent-team/runtime/test/policy-state-bound-blueprint-production-wiring
 */

import { describe, expect, it } from 'vitest'

import {
  createS6RemoteDispatcher,
  createS6RemotePorts,
} from '../src/plugin/s6-remote.js'
import type { S6RemoteOptions } from '../src/plugin/s6-remote.js'
import { createBoundBlueprintResolver } from '../src/plugin/bound-blueprint.js'
import {
  createBlueprintAuthority,
  type BlueprintRegistryPort,
  type BlueprintRegistryRecordView,
} from '../src/plugin/blueprint-authority.js'
import { createBlueprintSourceIndex } from '../src/plugin/blueprint-source-index.js'
import { createLiveBlueprintCatalog } from '../src/plugin/blueprint-live-catalog.js'
import type { ServerPrincipalDerivation } from '../src/plugin/types.js'
import type { TeamDomainRepositories } from '../../storage/repositories/index.js'
import type { TeamSessionRecordDto } from '../../contracts/src/index.js'
import {
  parseBlueprint,
  toBlueprintSnapshotRef,
} from '../../domain/blueprint/src/index.js'
import type { TeamBlueprint } from '../../domain/blueprint/src/index.js'
import { FULL_BLUEPRINT_SOURCE } from '../../domain/blueprint/testdata/fixtures.js'
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
import type { RemoteResponse } from '../../remote/src/index.js'

const NOW = '2026-09-30T00:00:00.000Z'
const ROOT_BOOT = 'root-boot-prod'
const ROOT_MISMATCH = 'root-mismatch-prod'
const ROOT_GHOST = 'root-ghost-prod'
const ROOT_LEGACY = 'root-legacy-prod'
const ROOT_MISSING = 'root-missing-prod'

// ---------------------------------------------------------------------------
// The ANCHOR (the host boot Blueprint source — the FULL fixture: one
// declared policyState 'active') + the real production authority chain
// (bootstrap-only: no blueprintDir, the filesystem catalog disabled; an
// in-memory registry for the frozen rows — wired like host.ts BP3/BP4).
// ---------------------------------------------------------------------------

const ANCHOR_SOURCE = FULL_BLUEPRINT_SOURCE
const anchor: TeamBlueprint = parseBlueprint(ANCHOR_SOURCE)
const ANCHOR_REF = toBlueprintSnapshotRef(anchor)
/** A valid hash-grammar string (non-empty, ≤ 256) the authority cannot
 *  reproduce for the anchor identity — the S-mismatch ref's contentHash. */
const MUTATED_HASH = 'sha-mutated-deadbeef000000000000000000000000000000'

class MemRegistry implements BlueprintRegistryPort {
  readonly rows = new Map<string, BlueprintRegistryRecordView>()

  get(blueprintId: string, revision: string): BlueprintRegistryRecordView | undefined {
    return this.rows.get(`${blueprintId}@${revision}`)
  }

  list(): readonly BlueprintRegistryRecordView[] {
    return [...this.rows.values()]
  }

  async freeze(input: {
    readonly blueprintId: string
    readonly revision: string
    readonly contentHash: string
    readonly source: string
    readonly frozenAt: string
  }): Promise<BlueprintRegistryRecordView> {
    const key = `${input.blueprintId}@${input.revision}`
    const existing = this.rows.get(key)
    if (existing !== undefined) {
      if (existing.contentHash === input.contentHash) return existing
      const error = new Error('RECORD_DUPLICATE: blueprint-revision-frozen')
      ;(error as { code?: string }).code = 'RECORD_DUPLICATE'
      throw error
    }
    const row: BlueprintRegistryRecordView = {
      schemaVersion: 2,
      blueprintId: input.blueprintId,
      revision: input.revision,
      contentHash: input.contentHash,
      source: input.source,
      frozenAt: input.frozenAt,
    }
    this.rows.set(key, row)
    return row
  }
}

const sourceIndex = createBlueprintSourceIndex({})
const registry = new MemRegistry()
const authority = createBlueprintAuthority({
  bootstrapSource: ANCHOR_SOURCE,
  sourceIndex,
  registry,
  now: () => NOW,
})
const liveCatalog = createLiveBlueprintCatalog(authority)

// The production boot shape (BP6 barrier): the anchor is FROZEN — the
// S-mismatch row's ref resolves through the registry's stored source
// text (the frozen path), then fails the ref's content-hash equality.
await authority.freezeSnapshot(ANCHOR_REF)

// ---------------------------------------------------------------------------
// The durable world: REAL TeamSessionRecordDto rows (the bound snapshot
// per root; the no-ref legacy row via a cast — see the header).
// ---------------------------------------------------------------------------

const sessionRows = new Map<string, TeamSessionRecordDto>()
for (const row of [
  {
    schemaVersion: 1,
    rootSessionId: ROOT_BOOT,
    blueprint: { ...ANCHOR_REF },
    createdAt: NOW,
    generation: 1,
  },
  {
    schemaVersion: 1,
    rootSessionId: ROOT_MISMATCH,
    blueprint: {
      blueprintId: ANCHOR_REF.blueprintId,
      revision: ANCHOR_REF.revision,
      contentHash: MUTATED_HASH,
    },
    createdAt: NOW,
    generation: 1,
  },
  {
    schemaVersion: 1,
    rootSessionId: ROOT_GHOST,
    blueprint: { blueprintId: 'team.ghost', revision: '1', contentHash: 'sha-ghost' },
    createdAt: NOW,
    generation: 1,
  },
] as TeamSessionRecordDto[]) {
  sessionRows.set(row.rootSessionId, row)
}
// The no-ref legacy row (case 2): the `blueprint` field is REQUIRED on
// the DTO type (presence-validated), but the pre-repair runtime rows
// predate it — the absent-field shape the resolver's case 2 consumes.
const legacyRow = {
  schemaVersion: 1,
  rootSessionId: ROOT_LEGACY,
  createdAt: NOW,
  generation: 1,
} as unknown as TeamSessionRecordDto
sessionRows.set(ROOT_LEGACY, legacyRow)

// ---------------------------------------------------------------------------
// THE REAL PRODUCTION RESOLVER (the factory host.ts wires — the B1
// fix): the durable rows + the real authority's resolveSnapshot + the
// row anchor source.
// ---------------------------------------------------------------------------

const resolveBoundBlueprint = createBoundBlueprintResolver({
  teamSessions: { get: (rootSessionId: string) => sessionRows.get(rootSessionId) },
  resolveSnapshot: (ref) => authority.resolveSnapshot(ref),
  anchorBlueprintSource: ANCHOR_SOURCE,
})

// ---------------------------------------------------------------------------
// The durable PolicyState lanes (per root — the single-root production
// model) + the per-root in-memory transition cache.
// ---------------------------------------------------------------------------

const durableLanes = new Map<string, PolicyStateTransitionRecord[]>()

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

class MemOverrides implements OverrideStorePort {
  async list(_rootSessionId: string): Promise<readonly OverrideRecordView[]> {
    return []
  }
  async put(_record: unknown): Promise<unknown> {
    throw new Error('POLICY-STATE-PW guard: the policyState path must not write overrides')
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
    throw new Error(`POLICY-STATE-PW guard: the policyState path must not touch repositories.${name}`)
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

// One world: the real service (wired like root.ts) + the real s6-remote
// surface (wired like the production host: the row anchor as the `blueprint`
// option, the live catalog facade, the real repositories).
const transitions = new PerRootTransitions()
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
      return Promise.reject(new Error('POLICY-STATE-PW guard: commit outside the chain — impossible'))
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
  // THE PER-ROOT bound closed set — root.ts `policyStates` dep, verbatim
  // production wiring: default + the ADDRESSED team's declared states,
  // resolved through the REAL production resolver (the three-case
  // contract of bound-blueprint.ts).
  policyStates: (root) => [
    DEFAULT_POLICY_STATE_ID,
    ...resolveBoundBlueprint(root).policyStates.map((state) => state.id),
  ],
  now: () => NOW,
})
const ports = createS6RemotePorts(
  {
    rootSessionId: ROOT_BOOT,
    repositories: worldRepositories(),
    // The BOOT Blueprint = the row anchor (case 2's resolution source;
    // NEVER consulted for a bound ref — the three-case contract).
    blueprint: anchor,
    catalog: liveCatalog,
    governance: service,
    overrideRecords: () => [],
    mutationTransitions: (root: string) => transitions.listTransitions(root),
    leaderInstanceId: 'inst-leader',
    now: () => NOW,
    isOwnedRoot: (root: string) => root !== ROOT_BOOT,
  } as unknown as S6RemoteOptions,
)
const W = createS6RemoteDispatcher(ports, humanPrincipal)

function wire(params: Record<string, unknown>): Record<string, unknown> {
  return { version: 1, params }
}

function dataOf(response: RemoteResponse): Record<string, unknown> {
  if (!response.ok) throw new Error('POLICY-STATE-PW guard: expected a success result')
  return response.value.data as unknown as Record<string, unknown>
}

function errorOf(response: RemoteResponse): Record<string, unknown> {
  if (response.ok) throw new Error('POLICY-STATE-PW guard: expected an error result')
  return response.error as unknown as Record<string, unknown>
}

/** Synchronous capture for the (synchronous) resolver unit cases. */
function capture<T>(fn: () => T): { ok: true; value: T } | { ok: false; error: unknown } {
  try {
    return { ok: true, value: fn() }
  } catch (error) {
    return { ok: false, error }
  }
}

const laneCount = (root: string): number => durableLanes.get(root)?.length ?? 0

// ---------------------------------------------------------------------------
// The scenarios (top-level: every step completes before any `it` runs).
// ---------------------------------------------------------------------------

const S = await (async () => {
  // S-mismatch (closes M1 + the B1 set path): the ref's contentHash the
  // authority cannot reproduce.
  const smGet = await W('policyState.get', wire({ teamSessionId: ROOT_MISMATCH }))
  const smSet = await W(
    'policyState.set',
    wire({ teamSessionId: ROOT_MISMATCH, target: { stateId: 'active' }, actor: { kind: 'human' } }),
  )
  const smLaneAfterSet = laneCount(ROOT_MISMATCH)

  // Control: the anchor's own team (boot root, bound ref = the anchor)
  // resolves fine — the anchor's states are advertised for the RIGHT
  // team only.
  const bootGet = await W('policyState.get', wire({ teamSessionId: ROOT_BOOT }))

  // S-unresolvable: the ref names an identity the authority cannot
  // resolve.
  const guGet = await W('policyState.get', wire({ teamSessionId: ROOT_GHOST }))
  const guSet = await W(
    'policyState.set',
    wire({ teamSessionId: ROOT_GHOST, target: { stateId: 'active' }, actor: { kind: 'human' } }),
  )
  const guLaneAfterSet = laneCount(ROOT_GHOST)

  // S-legacy-no-ref (pins the documented legacy binding): the row's
  // bound blueprint IS the row anchor by definition.
  const lgGet = await W('policyState.get', wire({ teamSessionId: ROOT_LEGACY }))
  const lgSetActive = await W(
    'policyState.set',
    wire({ teamSessionId: ROOT_LEGACY, target: { stateId: 'active' }, actor: { kind: 'human' } }),
  )
  const lgLaneAfterSet = laneCount(ROOT_LEGACY)
  const lgSetForeign = await W(
    'policyState.set',
    wire({ teamSessionId: ROOT_LEGACY, target: { stateId: 'foreign' }, actor: { kind: 'human' } }),
  )
  const lgLaneFinal = laneCount(ROOT_LEGACY)
  const lgLane = [...(durableLanes.get(ROOT_LEGACY) ?? [])]

  // The factory's three cases DIRECTLY (resolver level, pre-mapping).
  const fcMissing = capture(() => resolveBoundBlueprint(ROOT_MISSING))
  const fcLegacy = capture(() => resolveBoundBlueprint(ROOT_LEGACY))
  const fcBoot = capture(() => resolveBoundBlueprint(ROOT_BOOT))
  const fcMismatch = capture(() => resolveBoundBlueprint(ROOT_MISMATCH))
  const fcGhost = capture(() => resolveBoundBlueprint(ROOT_GHOST))

  return {
    smGet,
    smSet,
    smLaneAfterSet,
    bootGet,
    guGet,
    guSet,
    guLaneAfterSet,
    lgGet,
    lgSetActive,
    lgLaneAfterSet,
    lgSetForeign,
    lgLaneFinal,
    lgLane,
    fcMissing,
    fcLegacy,
    fcBoot,
    fcMismatch,
    fcGhost,
  }
})()

// ---------------------------------------------------------------------------
// The pins.
// ---------------------------------------------------------------------------

describe('pre-alpha3 W1 F11 review round 2 — the PRODUCTION wiring of the bound-Blueprint closed set (real resolver + real authority)', () => {
  /** The `policyState.get` wire wraps the port record as `data.state`. */
  const stateOf = (response: RemoteResponse): Record<string, unknown> =>
    dataOf(response)['state'] as Record<string, unknown>
  /** The `policyState.set` wire wraps the port record as `data.transition`. */
  const transitionOf = (response: RemoteResponse): Record<string, unknown> =>
    dataOf(response)['transition'] as Record<string, unknown>

  // -- S-mismatch (closes M1 + the B1 set path) -----------------------------

  it('S-mismatch get: the bound ref the authority cannot reproduce fails typed TEAM_REMOTE_TEAM_CREATE_BLUEPRINT_MISMATCH (invariant 4b) — the anchor is NEVER consulted', () => {
    const error = errorOf(S.smGet)
    expect(error['code']).toBe('TEAM_REMOTE_TEAM_CREATE_BLUEPRINT_MISMATCH')
    const details = error['details'] as Record<string, unknown>
    expect(details['reason']).toBe('domain-error')
    const cause = details['cause'] as Record<string, unknown>
    expect(cause['code']).toBe('TEAM_REMOTE_TEAM_CREATE_BLUEPRINT_MISMATCH')
    // The source TeamPluginError carries its machine details under the
    // SINGULAR `detail` key, which invariant 4b does not surface:
    // cause.details stays absent (no untyped leak, no anchor fallback).
    expect(cause['details']).toBeUndefined()
  })

  it('S-mismatch set: the ANCHOR-declared state is NOT admitted for a mismatched ref — the raw authority mismatch is mapped to the typed POLICY_STATE_SNAPSHOT_MISMATCH (reason snapshot-mismatch, zero write)', () => {
    const error = errorOf(S.smSet)
    expect(error['code']).toBe('POLICY_STATE_SNAPSHOT_MISMATCH')
    const details = error['details'] as Record<string, unknown>
    expect(details['reason']).toBe('domain-error')
    const cause = details['cause'] as Record<string, unknown>
    expect(cause['code']).toBe('POLICY_STATE_SNAPSHOT_MISMATCH')
    expect(cause['details']).toEqual({
      reason: 'snapshot-mismatch',
      rootSessionId: ROOT_MISMATCH,
      blueprintId: ANCHOR_REF.blueprintId,
      revision: ANCHOR_REF.revision,
      expectedContentHash: MUTATED_HASH,
      foundContentHash: anchor.contentHash,
    })
    // Zero write: B''s durable lane stays empty.
    expect(S.smLaneAfterSet).toBe(0)
  })

  it('S-mismatch control: the anchor\u2019s own team (boot root, bound to the anchor) resolves fine — the anchor\u2019s closed set is advertised for the RIGHT team only', () => {
    const state = stateOf(S.bootGet)
    expect(state['stateId']).toBe(DEFAULT_POLICY_STATE_ID)
    expect(state['availableTransitions']).toEqual(['active'])
  })

  // -- S-unresolvable --------------------------------------------------------

  it('S-unresolvable get: a ref the authority cannot resolve fails typed MALFORMED_DTO (blueprint-not-found) — invariant 4b pass-through with the authority\u2019s own details', () => {
    const error = errorOf(S.guGet)
    expect(error['code']).toBe('MALFORMED_DTO')
    const details = error['details'] as Record<string, unknown>
    expect(details['reason']).toBe('domain-error')
    const cause = details['cause'] as Record<string, unknown>
    expect(cause['code']).toBe('MALFORMED_DTO')
    expect(cause['details']).toEqual({ blueprintId: 'team.ghost', reason: 'blueprint-not-found' })
  })

  it('S-unresolvable set: the same typed failure (the service re-throws the authority\u2019s closed code unchanged — it is already a wire code), no anchor fallback, zero write', () => {
    const error = errorOf(S.guSet)
    expect(error['code']).toBe('MALFORMED_DTO')
    const cause = (error['details'] as Record<string, unknown>)['cause'] as Record<string, unknown>
    expect(cause['code']).toBe('MALFORMED_DTO')
    expect(cause['details']).toEqual({ blueprintId: 'team.ghost', reason: 'blueprint-not-found' })
    expect(S.guLaneAfterSet).toBe(0)
  })

  // -- S-legacy-no-ref (pins the documented legacy binding) ------------------

  it('S-legacy get: the no-ref row advertises the ANCHOR\u2019s closed set (default + active) — the row anchor IS the team\u2019s bound blueprint by definition (case 2, not a fallback)', () => {
    const state = stateOf(S.lgGet)
    expect(state['stateId']).toBe(DEFAULT_POLICY_STATE_ID)
    expect(state['availableTransitions']).toEqual(['active'])
  })

  it('S-legacy set (anchor-declared state): commits (entryId ps-active-0, origin human)', () => {
    const transition = transitionOf(S.lgSetActive)
    expect(transition['entryId']).toBe('ps-active-0')
    expect(transition['origin']).toBe('human')
    expect((transition['state'] as Record<string, unknown>)['stateId']).toBe('active')
    expect(S.lgLaneAfterSet).toBe(1)
  })

  it('S-legacy set (outside the anchor\u2019s closed set): refused typed POLICY_STATE_UNKNOWN against the ANCHOR\u2019s closed set (zero write)', () => {
    const error = errorOf(S.lgSetForeign)
    expect(error['code']).toBe('POLICY_STATE_UNKNOWN')
    const cause = (error['details'] as Record<string, unknown>)['cause'] as Record<string, unknown>
    expect(cause['details']).toEqual({
      reason: 'unknown-state',
      stateId: 'foreign',
      closedStates: ['default', 'active'],
    })
    expect(S.lgLaneFinal).toBe(1)
    expect(S.lgLane).toHaveLength(1)
    expect(S.lgLane[0]?.entryId).toBe('ps-active-0')
  })

  // -- the factory's three cases directly (resolver level, pre-mapping) ------

  it('factory case 1: a missing row throws (programming error, fail closed — the exact production message)', () => {
    expect(S.fcMissing.ok).toBe(false)
    const error = S.fcMissing.ok === false ? S.fcMissing.error : undefined
    expect(error).toBeInstanceOf(Error)
    expect((error as Error).message).toBe(
      `resolveBoundBlueprint(${ROOT_MISSING}): the domain carries no durable TeamSession row for this root — the glue must never set up an agent for a root without a row`,
    )
  })

  it('factory case 2: a no-ref legacy row resolves to the parsed ANCHOR (the documented legacy binding — by definition, not a fallback)', () => {
    expect(S.fcLegacy.ok).toBe(true)
    if (S.fcLegacy.ok) {
      expect(S.fcLegacy.value.contentHash).toBe(anchor.contentHash)
      expect(S.fcLegacy.value.policyStates.map((state) => state.id)).toEqual(['active'])
    }
  })

  it('factory case 3a: a resolvable bound ref resolves through the authority (the frozen registry row — the anchor)', () => {
    expect(S.fcBoot.ok).toBe(true)
    if (S.fcBoot.ok) {
      expect(S.fcBoot.value.contentHash).toBe(anchor.contentHash)
    }
  })

  it('factory case 3b: a mutated-hash bound ref fails with the raw TEAM_BLUEPRINT_SNAPSHOT_MISMATCH (reason snapshot-content-mismatch — pre-mapping; the wire mapping is pinned above)', () => {
    expect(S.fcMismatch.ok).toBe(false)
    const error = S.fcMismatch.ok === false ? S.fcMismatch.error : undefined
    expect(error).toBeInstanceOf(Error)
    expect((error as { code?: unknown }).code).toBe('TEAM_BLUEPRINT_SNAPSHOT_MISMATCH')
    const detail = (error as { detail?: Record<string, unknown> }).detail
    expect(detail?.['reason']).toBe('snapshot-content-mismatch')
    expect(detail?.['expectedContentHash']).toBe(MUTATED_HASH)
    expect(detail?.['foundContentHash']).toBe(anchor.contentHash)
  })

  it('factory case 3c: an unknown-identity bound ref fails with the raw MALFORMED_DTO (blueprint-not-found — the authority\u2019s closed contract wording)', () => {
    expect(S.fcGhost.ok).toBe(false)
    const error = S.fcGhost.ok === false ? S.fcGhost.error : undefined
    expect(error).toBeInstanceOf(Error)
    expect((error as { code?: unknown }).code).toBe('MALFORMED_DTO')
    const details = (error as { details?: Record<string, unknown> }).details
    expect(details?.['reason']).toBe('blueprint-not-found')
    expect(details?.['blueprintId']).toBe('team.ghost')
  })
})
