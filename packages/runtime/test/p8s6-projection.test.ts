/**
 * p8s6-projection.test.ts — C2 (P8-S6): the production projection surface
 * (plan §20.1) assembles and reads durably, WITHOUT the forbidden sources.
 *
 * Proven per test (the whole world is driven at module top level — the
 * plain-node shim forbids async `it()` bodies):
 *
 *   C2.1 — the production `root.projection.project(root)` returns the
 *          frozen whole `TeamProjectionDto` with the §21.2/§20.2 fixed
 *          field semantics: identity core verbatim from the durable
 *          TeamSession row, the bound snapshot ref, the generatedAt stamp,
 *          the root facts (policyState 'default', admission, compatibility,
 *          zero budget), the three template rows (leader displayName
 *          fallback + member display names + context policies), the three
 *          member rows (leader WITHOUT childSessionId, RUNNING, effective
 *          workspace inherited from the team default, all three
 *          liveActivity = { residency: 'cold' } — the stub world's live
 *          set is empty), and the zeroed ledger summary (8 explicit
 *          category keys);
 *   C2.2 — the A30 live-residency overlay unit: the leader's child session
 *          resolves to the root (hasLive(root) -> leader RESIDENT with the
 *          injected clock stamp), an ordinary member is resident only when
 *          its own child session is live, DISPOSED rows are excluded, and
 *          v2-shaped rows (no childSessionId key) resolve against the root;
 *   C2.3 — NEGATIVE (the §21.2 red line): the read port takes only
 *          (domain, deps) — no session-log / controller-mirror / event
 *          channel — and a property-recording fake domain proves the
 *          adapter reads EXACTLY the four repositories (teamSessions,
 *          memberInstances, compatibility, ledger) and nothing else.
 *
 * World: own scratch seam + own root session id + own seed ids (distinct
 * from the P8-S5A T1 fixture); the same blueprint structure (leader +
 * worker + scout, scout fresh_per_delegation).
 * @module @dsh-agent-team/runtime/test/p8s6-projection
 */

import { describe, expect, it } from 'vitest'
import {
  MEMBER_LIFECYCLE_STATES,
  RESIDENCY_STATES,
  TEAM_PROJECTION_FIELDS,
  TEAM_ROOT_PROJECTION_FIELDS,
  TEMPLATE_PROJECTION_FIELDS,
  MEMBER_PROJECTION_FIELDS_V2,
  LEDGER_SUMMARY_FIELDS,
  parseRootSessionId,
} from '../../contracts/src/index.js'
import {
  destroyDir,
  FileStorageSeam,
  scratchDir,
} from '../../testkit/fault-injection/file-seam.mjs'
import * as hostEntry from '../src/plugin/host.js'
import { createTeamDomainReadPort } from '../src/plugin/projection-source.js'
import { createLiveResidencyOverlay } from '../src/plugin/s6-live-overlay.js'
import { stubGlueUrl } from './p8s5a-artifacts.mjs'

// --- the C2 fixture world -----------------------------------------------------------

/** The C2 root session id (distinct from every other phase fixture). */
const ROOT_SID = 'session-p8s6projroot'
/** The C2 seeded worker / scout (the leader is implied by the root). */
const SEED_WORKER_ID = 'inst-p8s6seedw1'
const SEED_SCOUT_ID = 'inst-p8s6seeds1'
const SEED_WORKER_CHILD = 'session-child-p8s6seedw1'
const SEED_SCOUT_CHILD = 'session-child-p8s6seeds1'
/** The deterministic clock the C2 assertions compare against. */
const FIXED_NOW = '2026-09-01T00:00:00.000Z'

/** The C2 blueprint (own id; structure mirrors the P8-S5A T1 fixture). */
const BLUEPRINT_SOURCE = [
  '---',
  'schemaVersion: 1',
  'blueprintId: P8S6PROJ-BP',
  'revision: "1"',
  'leader:',
  '  templateId: leader',
  '  persona: You lead the P8S6PROJ team.',
  'members:',
  '  - templateId: worker',
  '    displayName: Worker',
  '    persona: You do the P8S6PROJ work.',
  '  - templateId: scout',
  '    displayName: Scout',
  '    persona: You scout for the P8S6PROJ team.',
  '    contextPolicy: fresh_per_delegation',
  'requirements:',
  '  - domain: tool',
  '    name: web',
  '    optional: true',
  '  - domain: skill',
  '    name: base',
  'teamEnvelope:',
  '  allow:',
  '    - assign-task',
  '    - create-member',
  '    - send-message',
  '    - report-progress',
  '    - request-control',
  '    - resolve-control',
  '    - archive-member',
  '    - restore-member',
  '  deny:',
  '    - delete-team',
  'memberEnvelopes:',
  '  - templateId: worker',
  '    envelope:',
  '      allow:',
  '        - send-message',
  '        - report-progress',
  '      deny: []',
  '  - templateId: scout',
  '    envelope:',
  '      allow:',
  '        - send-message',
  '        - report-progress',
  '        - request-control',
  '      deny: []',
  'policyStates:',
  '  - id: default',
  '    description: The P8S6PROJ default state.',
  'quotas:',
  '  team:',
  '    maxInstances: 12',
  '    maxConcurrent: 12',
  '  members:',
  '    maxInstances: 4',
  '    maxConcurrent: 4',
  'metadata: {}',
  '---',
].join('\n')

/** The C2 row config (the entry's ONLY input channel). */
function rowConfig(): Record<string, any> {
  return {
    bootPhase: 'create',
    rootSessionId: ROOT_SID,
    blueprintSource: BLUEPRINT_SOURCE,
    generation: 1,
    defaultWorkspace: 'C:/agent-team/work/p8s6proj',
    seedMembers: [
      {
        instanceId: SEED_WORKER_ID,
        templateId: 'worker',
        label: 'c2-seed-worker',
        childSessionId: SEED_WORKER_CHILD,
      },
      {
        instanceId: SEED_SCOUT_ID,
        templateId: 'scout',
        label: 'c2-seed-scout',
        childSessionId: SEED_SCOUT_CHILD,
      },
    ],
    staticModel: { provider: 'p8s6proj-static', model: 'p8s6proj-model-v1' },
    deniedSelection: null,
    mcpServer: null,
    environmentFacts: [
      { domain: 'tool', subject: 'web', available: true, generation: 1 },
      { domain: 'skill', subject: 'base', available: true, generation: 1 },
    ],
    externalPolicyFacts: { hard: {}, capabilityExists: {} },
    glueUrl: stubGlueUrl(),
  }
}

// --- the test Cordis context + the entry loader --------------------------------------

interface TeamRootFacade {
  readonly ready: Promise<Record<string, any>>
  [key: string]: any
}

interface TestWorld {
  ctx: Record<string, any>
  readonly provided: Record<string, any>
  readonly effectDisposers: Array<() => void>
}

/** One plain-object Cordis context (get / provide / effect). */
function makeWorld(seam: FileStorageSeam): TestWorld {
  const provided: Record<string, any> = {
    agents: { create: async () => {}, resume: async () => {} },
    sessionPersistence: { ensure: async () => {} },
    teamStorageSeam: seam,
  }
  const effectDisposers: Array<() => void> = []
  return {
    ctx: {
      get: (name: string) => provided[name],
      provide: (name: string, value: unknown) => {
        provided[name] = value
      },
      effect: (factory: () => () => void, _label?: string) => {
        effectDisposers.push(factory())
      },
    },
    provided,
    effectDisposers,
  }
}

let hostModulePromise: Promise<Record<string, any>> | null = null
function loadHost(): Promise<Record<string, any>> {
  if (hostModulePromise === null) {
    hostModulePromise = Promise.resolve(hostEntry as unknown as Record<string, any>)
  }
  return hostModulePromise
}

/** Fail the whole file (module-load failure) on a flow-critical invariant. */
function check(condition: boolean, label: string): void {
  if (!condition) throw new Error(`C2 scenario guard: ${label}`)
}

/** Assert-value helper (narrowing): the value is neither null nor undefined. */
function defined<T>(value: T, label: string): asserts value is NonNullable<T> {
  if (value === null || value === undefined) throw new Error(`C2 scenario guard: ${label}`)
}

/** Apply the entry and await its bootstrap (`ready`). */
async function applyWorld(world: TestWorld, config: Record<string, any>) {
  const host = await loadHost()
  await host.apply(world.ctx, config)
  const teamRoot: TeamRootFacade = world.provided.teamRoot
  check(teamRoot !== undefined, 'apply resolved but never provided teamRoot')
  const root = await teamRoot.ready
  return { host, teamRoot, root }
}

/** The sorted own-key list of a plain object (the closed-field assertions). */
function keysOf(value: unknown): string[] {
  check(value !== null && typeof value === 'object', 'expected a plain object')
  return Object.keys(value as Record<string, unknown>).sort()
}

/** Every key of `value` must be a member of the frozen field list. */
function within(value: unknown, fields: readonly string[], label: string): void {
  for (const key of Object.keys(value as Record<string, unknown>)) {
    check(fields.includes(key), `${label} carries unknown field '${key}'`)
  }
}

// --- C2.1 the positive whole projection -----------------------------------------------

const c2world = await (async () => {
  const dir = scratchDir('p8s6-proj')
  const seam = new FileStorageSeam(dir)
  const world = makeWorld(seam)
  try {
    const { root } = await applyWorld(world, rowConfig())

    // The projection surface is installed (A30): the fail-closed overlay
    // proxy is live, so `project` succeeds with the durable source + the
    // (stub) live residency facts.
    const projection = root.projection.project(parseRootSessionId(ROOT_SID))

    // The A30 overlay installed at construction: a direct snapshot read
    // reports all three members cold (the stub world's live set is empty).
    const seamOverlay = root.seams.projectionLiveOverlay.current()
    const overlaySnapshot = seamOverlay.snapshot()

    return {
      world,
      dir,
      root,
      projection,
      overlaySnapshot: overlaySnapshot as ReadonlyMap<string, { residency: string; lastActivityAt?: string }>,
      repos: root.domain.repositories,
    }
  } catch (err) {
    destroyDir(dir)
    world.effectDisposers.forEach((dispose) => dispose())
    throw new Error(`C2.1 projection world failing: ${err instanceof Error ? err.message : String(err)}`)
  }
})()

const c2p = c2world.projection as Record<string, any>

it('C2.1a the production projection is the frozen whole TeamProjectionDto (closed top-level fields)', () => {
  expect(keysOf(c2p)).toEqual([...TEAM_PROJECTION_FIELDS].sort())
  // P8-S7-R2 premise update (R2-2): the production projection service is
  // now stamped v2 (the additive effective-config lane; the top-level field
  // set is unchanged — every v2 additive key is DURATIONAL-optional).
  expect(c2p.schemaVersion).toBe(2)
  expect(c2p.teamSessionId).toBe(ROOT_SID)
  // The generation is the DURE row's generation, verbatim: the production
  // boot establishes the initial compatibility state (wiring decision (x)),
  // which advances the row generation once past the seeded value, so the
  // honest assertion is verbatim equality with the durable row (not a
  // hardcoded 1).
  const durableRow = c2world.repos.teamSessions.get(ROOT_SID) as Record<string, any>
  check(durableRow !== undefined, 'durable team row missing')
  expect(c2p.generation).toBeGreaterThan(0)
  expect(c2p.generation).toBe(durableRow.generation)
  expect(typeof c2p.generatedAt).toBe('string')
  check(c2p.generatedAt.length > 0, 'generatedAt is empty')
  check(!Number.isNaN(Date.parse(c2p.generatedAt)), 'generatedAt is not ISO-8601')
})

it('C2.1b the identity core + the bound snapshot ref are verbatim durable facts', () => {
  const bp = c2p.blueprint as Record<string, any>
  check(typeof bp.contentHash === 'string' && bp.contentHash.length > 0, 'contentHash empty')
  expect(keysOf(bp).length).toBe(3) // blueprintId, revision, contentHash
  expect(bp.blueprintId).toBe('P8S6PROJ-BP')
  expect(bp.revision).toBe('1')
  // createdAt is a ROOT fact (TEAM_ROOT_PROJECTION_FIELDS), not a
  // top-level DTO field (the closed top-level set is checked in C2.1a).
  const rootFactsB = c2p.root as Record<string, any>
  expect(typeof rootFactsB.createdAt).toBe('string')
  check(!Number.isNaN(Date.parse(rootFactsB.createdAt)), 'createdAt is not ISO-8601')
})

it('C2.1c the root facts carry the §20.2 semantics (default policy state, zero budget)', () => {
  const rootFacts = c2p.root as Record<string, any>
  within(rootFacts, TEAM_ROOT_PROJECTION_FIELDS, 'root')
  expect(rootFacts.teamSessionId).toBe(ROOT_SID)
  expect(rootFacts.defaultWorkspace).toBe('C:/agent-team/work/p8s6proj')
  expect(rootFacts.policyState).toBe('default')
  expect(typeof rootFacts.admission).toBe('string')
  check(rootFacts.admission.length > 0, 'admission is empty')
  expect(typeof rootFacts.compatibility).toBe('object')
  expect(rootFacts.creationBudgetConsumed).toBe(0)
  expect('handoffSourceSessionId' in rootFacts).toBe(false) // created fresh
})

it('C2.1d the three template rows carry kind / display name / context policy', () => {
  check(Array.isArray(c2p.templates), 'templates is not an array')
  expect(c2p.templates.length).toBe(3)
  const [leader, worker, scout] = c2p.templates as Array<Record<string, any>>
  defined(leader, 'leader template missing')
  defined(worker, 'worker template missing')
  defined(scout, 'scout template missing')
  for (const row of [leader, worker, scout]) within(row, TEMPLATE_PROJECTION_FIELDS, 'template')
  expect(leader.kind).toBe('leader')
  expect(leader.templateId).toBe('leader')
  expect(leader.displayName).toBe('leader') // no displayName in the blueprint -> fallback
  expect(leader.contextPolicy).toBe('persistent')
  expect(worker.templateId).toBe('worker')
  expect(worker.displayName).toBe('Worker')
  expect(worker.contextPolicy).toBe('persistent')
  expect(scout.templateId).toBe('scout')
  expect(scout.displayName).toBe('Scout')
  expect(scout.contextPolicy).toBe('fresh_per_delegation')
})

it('C2.1e the three member rows carry invariant 14 + inherited workspace + cold residency', () => {
  check(Array.isArray(c2p.members), 'members is not an array')
  expect(c2p.members.length).toBe(3)
  const byId = new Map(
    (c2p.members as Array<Record<string, any>>).map((row) => [row.instanceId, row]),
  )
  for (const row of c2p.members as Array<Record<string, any>>) {
    // Premise update (S7-R2 R2-3): the production projection is v2-stamped
    // and every member row carries the additive DURATIONAL-optional
    // `modelState` key — the closed-field check moves to the v2 field set.
    within(row, MEMBER_PROJECTION_FIELDS_V2, 'member')
    expect(row.lifecycle).toBe(MEMBER_LIFECYCLE_STATES.RUNNING)
    expect(row.workspace).toBe('C:/agent-team/work/p8s6proj') // inherited default
    expect(row.liveActivity).toEqual({ residency: RESIDENCY_STATES.cold })
    expect(typeof row.effectiveConfig).toBe('object')
  }
  const leader = byId.get('inst-leader')
  defined(leader, 'leader row missing')
  expect(leader.templateId).toBe('leader')
  expect(leader.label).toBe('leader')
  expect('childSessionId' in leader).toBe(false) // invariant 14
  const worker = byId.get(SEED_WORKER_ID)
  defined(worker, 'worker row missing')
  expect(worker.templateId).toBe('worker')
  expect(worker.label).toBe('c2-seed-worker')
  expect(worker.childSessionId).toBe(SEED_WORKER_CHILD)
  expect(worker.contextPolicy).toBe('persistent')
  const scout = byId.get(SEED_SCOUT_ID)
  defined(scout, 'scout row missing')
  expect(scout.templateId).toBe('scout')
  expect(scout.label).toBe('c2-seed-scout')
  expect(scout.childSessionId).toBe(SEED_SCOUT_CHILD)
  // The per-INSTANCE contextPolicy is the domain default ('persistent')
  // for every row: the v1/v2 member records carry no durable contextPolicy
  // (the read port derives the default rather than fabricating one). The
  // per-template policy (fresh_per_delegation for scout) lives on the
  // TEMPLATE rows — checked in C2.1d.
  expect(scout.contextPolicy).toBe('persistent')
})

it('C2.1f the ledger summary is zeroed with the eight explicit category keys', () => {
  const ledger = c2p.ledger as Record<string, any>
  within(ledger, LEDGER_SUMMARY_FIELDS, 'ledger')
  expect(ledger.latestSequence).toBe(0)
  expect(ledger.totalEntries).toBe(0)
  expect(ledger.pendingControlCount).toBe(0)
  const byCategory = ledger.byCategory as Record<string, number>
  expect(Object.keys(byCategory).length).toBe(8)
  for (const count of Object.values(byCategory)) expect(count).toBe(0)
})

it('C2.1g the A30 overlay seam is installed and reports all three members cold in the stub world', () => {
  const snapshot = c2world.overlaySnapshot
  expect(snapshot.size).toBe(3)
  expect(snapshot.get('inst-leader')?.residency).toBe(RESIDENCY_STATES.cold)
  expect(snapshot.get(SEED_WORKER_ID)?.residency).toBe(RESIDENCY_STATES.cold)
  expect(snapshot.get(SEED_SCOUT_ID)?.residency).toBe(RESIDENCY_STATES.cold)
})

// --- C2.2 the A30 live-residency overlay (unit) ---------------------------------------

interface LiveFlag {
  hasLive: (sessionId: string) => boolean
  /** Premise update (S7-R2 R2-5): the overlay also reads the resuming
   *  marker (`live.isResuming`); the fakes below default it to false (no
   *  resume in flight in the C2 worlds). */
  isResuming?: (sessionId: string) => boolean
}

function makeOverlay(live: LiveFlag): ReadonlyMap<string, Record<string, any>> {
  const port = createLiveResidencyOverlay({
    repositories: c2world.repos,
    live: { isResuming: () => false, ...live } as never,
    rootSessionId: ROOT_SID,
    now: () => FIXED_NOW,
  })
  return port.snapshot() as ReadonlyMap<string, Record<string, any>>
}

const c2overlay = await (async () => {
  // The leader's child session IS the root: hasLive(root) makes the leader
  // resident (the injected clock stamps lastActivityAt).
  const leaderLive = makeOverlay({ hasLive: (sid) => sid === ROOT_SID })
  // An ordinary member is resident only when its OWN child session is live.
  const workerLive = makeOverlay({ hasLive: (sid) => sid === SEED_WORKER_CHILD })
  // DISPOSED exclusion + the v2-shaped row (no childSessionId key): the
  // fake repository surface returns the real rows + a DISPOSED row + a
  // v2-shaped row resolved against the root.
  const disposedRow = {
    schemaVersion: 1,
    rootSessionId: ROOT_SID,
    instanceId: 'inst-p8s6disp',
    templateId: 'worker',
    label: 'c2-disposed',
    childSessionId: 'session-child-p8s6disp',
    lifecycle: MEMBER_LIFECYCLE_STATES.DISPOSED,
    createdAt: '2026-08-01T00:00:00.000Z',
    activityVersion: 1,
  }
  const v2Row = {
    schemaVersion: 1,
    rootSessionId: ROOT_SID,
    instanceId: 'inst-p8s6v2',
    templateId: 'worker',
    label: 'c2-v2',
    createdAt: '2026-08-01T00:00:00.000Z',
  }
  const realRows = c2world.repos.memberInstances.list(ROOT_SID)
  const fakeRepos = {
    memberInstances: { list: (root: string) => [...realRows, disposedRow, v2Row] },
    // P9-S8 F1-lite: the overlay iterates every root the host durably owns;
    // this unit's world is single-root (the bound ROOT_SID), so no extras.
    teamSessions: { list: () => [] },
  }
  const port = createLiveResidencyOverlay({
    repositories: fakeRepos as never,
    live: {
      hasLive: (sid: string) => sid === ROOT_SID || sid === 'session-child-p8s6v2',
      isResuming: () => false, // premise update (S7-R2 R2-5)
    } as never,
    rootSessionId: ROOT_SID,
    now: () => FIXED_NOW,
  })
  return { leaderLive, workerLive, extra: port.snapshot() as ReadonlyMap<string, Record<string, any>> }
})()

it('C2.2a the leader resolves its child to the root session (hasLive(root) -> resident)', () => {
  const leader = c2overlay.leaderLive.get('inst-leader')
  defined(leader, 'leader absent from the snapshot')
  expect(leader.residency).toBe(RESIDENCY_STATES.resident)
  expect(leader.lastActivityAt).toBe(FIXED_NOW)
  expect(c2overlay.leaderLive.get(SEED_WORKER_ID)?.residency).toBe(RESIDENCY_STATES.cold)
  expect(c2overlay.leaderLive.get(SEED_SCOUT_ID)?.residency).toBe(RESIDENCY_STATES.cold)
})

it('C2.2b an ordinary member is resident only when its own child session is live', () => {
  const worker = c2overlay.workerLive.get(SEED_WORKER_ID)
  defined(worker, 'worker absent from the snapshot')
  expect(worker.residency).toBe(RESIDENCY_STATES.resident)
  expect(worker.lastActivityAt).toBe(FIXED_NOW)
  expect(c2overlay.workerLive.get('inst-leader')?.residency).toBe(RESIDENCY_STATES.cold)
  expect(c2overlay.workerLive.get(SEED_SCOUT_ID)?.residency).toBe(RESIDENCY_STATES.cold)
})

it('C2.2c DISPOSED rows are excluded and v2-shaped rows resolve against the root', () => {
  const extra = c2overlay.extra
  expect(extra.get('inst-p8s6disp')).toEqual(undefined)
  // The v2-shaped row carries NO childSessionId, so the overlay resolves it
  // against the ROOT session; the root is live in this set, so the row is
  // RESIDENT (a mistaken resolution to an unknown child would read cold —
  // this assertion pins the root-resolution rule).
  expect(extra.get('inst-p8s6v2')?.residency).toBe(RESIDENCY_STATES.resident) // root is live
  expect(extra.get('inst-leader')?.residency).toBe(RESIDENCY_STATES.resident) // root is live
  expect(extra.size).toBe(4) // leader + worker + scout + v2 row
})

// --- C2.3 NEGATIVE: the read port reads exactly four repositories ----------------------

const c2port = await (async () => {
  const realDomain = c2world.root.domain
  const realRepos = realDomain.repositories
  const accessedDomainProps: string[] = []
  const accessedRepos: string[] = []
  const methodCalls: string[] = []
  function record(repo: string, name: string, fn: (...a: any[]) => unknown) {
    return (...a: any[]) => {
      methodCalls.push(`${repo}.${name}`)
      return fn(...a)
    }
  }
  const fakeRepos = new Proxy(
    {
      teamSessions: {
        get: record('teamSessions', 'get', (id: string) => realRepos.teamSessions.get(id)),
      },
      memberInstances: {
        list: record('memberInstances', 'list', (id: string) => realRepos.memberInstances.list(id)),
      },
      compatibility: {
        get: record('compatibility', 'get', (id: string) => realRepos.compatibility.get(id)),
      },
      ledger: {
        list: record('ledger', 'list', () => realRepos.ledger.list()),
      },
    },
    {
      get(target: Record<string, any>, prop: string | symbol) {
        if (typeof prop === 'string') accessedRepos.push(prop)
        return (target as Record<string | symbol, any>)[prop]
      },
    },
  )
  const fakeDomain = new Proxy(
    { name: realDomain.name, repositories: fakeRepos },
    {
      get(target: Record<string, any>, prop: string | symbol) {
        if (typeof prop === 'string') accessedDomainProps.push(prop)
        return (target as Record<string | symbol, any>)[prop]
      },
    },
  )
  const fixedTemplates = [
    { kind: 'leader', templateId: 'leader', displayName: 'leader', contextPolicy: 'persistent' },
    { kind: 'member', templateId: 'worker', displayName: 'Worker', contextPolicy: 'persistent' },
    { kind: 'member', templateId: 'scout', displayName: 'Scout', contextPolicy: 'fresh_per_delegation' },
  ]
  const port = createTeamDomainReadPort(fakeDomain as never, {
    templates: () => fixedTemplates as never,
    policyState: () => 'default',
  })
  const source = port.readProjectionSource(parseRootSessionId(ROOT_SID))
  return { accessedDomainProps, accessedRepos, methodCalls, source }
})()

it('C2.3a the read port takes only (domain, deps) — no session-log / mirror / event channel', () => {
  // The function arity pins the channel surface: exactly the domain + the
  // documented optional deps.
  expect(createTeamDomainReadPort.length).toBe(2)
})

it('C2.3b the adapter touches ONLY the four durable repositories of the domain', () => {
  const domainProps = [...new Set(c2port.accessedDomainProps)]
  for (const prop of domainProps) {
    check(prop === 'repositories', `read port accessed domain property '${prop}' (forbidden channel)`)
  }
  expect(domainProps).toEqual(['repositories'])
  const repos = [...new Set(c2port.accessedRepos)]
  for (const repo of repos) {
    check(
      ['teamSessions', 'memberInstances', 'compatibility', 'ledger'].includes(repo),
      `read port accessed repository '${repo}' (forbidden channel)`,
    )
  }
  expect(repos.sort()).toEqual(['compatibility', 'ledger', 'memberInstances', 'teamSessions'])
})

it('C2.3c the bounded read succeeds and reproduces the durable source facts', () => {
  expect(c2port.source.teamSessionId).toBe(ROOT_SID)
  expect(c2port.source.generation).toBe(
    (c2world.repos.teamSessions.get(ROOT_SID) as Record<string, any>).generation,
  )
  expect(c2port.source.members.length).toBe(3)
  expect(c2port.source.ledger.totalEntries).toBe(0)
  expect(c2port.source.root.policyState).toBe('default')
  expect(c2port.source.templates.length).toBe(3)
  // The bounded read order is fixed by the source construction: the root
  // row first, then the root facts (compatibility), the member rows, and
  // the ledger summary — exactly four reads, no other channel.
  expect(c2port.methodCalls).toEqual([
    'teamSessions.get',
    'compatibility.get',
    'memberInstances.list',
    'ledger.list',
  ])
})

// --- teardown --------------------------------------------------------------------------

describe('p8s6-projection teardown', () => {
  it('the C2 world is disposed (stop semantics)', () => {
    c2world.world.effectDisposers.forEach((dispose) => dispose())
    c2world.world.effectDisposers.length = 0
    destroyDir(c2world.dir)
    expect(true).toBe(true)
  })
})
