/**
 * t12b1-real-create.test.ts — T12-B1 (Lane B): the normal production
 * `create` boot no longer runs the frozen `seedBootWorld()` scenario.
 *
 * Plan §7-B1 target flow, proven through the production entry
 * (`host.apply` over a REAL file storage seam, the p8s7r4 pattern):
 *
 *   real Team creation input
 *   → durable TeamSession          (canonical fresh-root record, row clock)
 *   → bindFreshTeamRoot(...)       (team-root binding + honest-v2 Leader
 *                                   mint, zero fabricated members)
 *   → real Root Agent              (live.boot — the live layer's one-shot
 *                                   create phase; the stub glue counts it)
 *
 * The frozen seed world stays reachable ONLY by explicit opt-in
 * (`fixtureWorld: true`) or by the documented legacy-compatibility
 * trigger (a non-empty `seedMembers` — the old dev harness / legacy
 * tests). The shipped create (no flag, empty seedMembers) is
 * unreachable from `seedBootWorld` by construction.
 *
 * W4 additionally pins the create boundary: a second `create` over the
 * SAME medium fails closed at the storage layer (no silent duplicate
 * team); the create -> restart -> RESUME cycle is T12-B2's acceptance.
 *
 * Runner note: the plain-node vitest shim forbids async `it()` bodies —
 * the worlds are booted at module load (top-level await), the `it`
 * bodies assert synchronously (the p8s7r4 pattern).
 * @module @dsh-agent-team/runtime/test/t12b1-real-create
 */

import { describe, expect, it } from 'vitest'
import {
  destroyDir,
  FileStorageSeam,
  scratchDir,
} from '../../testkit/fault-injection/file-seam.mjs'
import * as hostEntry from '../src/plugin/host.js'
import type { TeamPluginHostContext } from '../src/plugin/host.js'
import { stubGlueUrl } from './p8s5a-artifacts.mjs'
import { LEADER_INSTANCE_ID } from '../../contracts/src/index.js'

// --- the fixture identities -----------------------------------------------------

/** The production row's root (the team the real create builds). */
const ROOT_SID = 'session-t12b1root'
/** The frozen epoch-0 stamp of the seed world (the B1 defect's fingerprint). */
const EPOCH_0 = new Date(0).toISOString()

/** The row blueprint (structure mirrors the P8-S7R4 fixture; own id). */
const BLUEPRINT_SOURCE = [
  '---',
  'schemaVersion: 1',
  'blueprintId: T12B1-BP',
  'revision: "1"',
  'leader:',
  '  templateId: leader',
  '  persona: You lead the T12B1 team.',
  'members:',
  '  - templateId: worker',
  '    displayName: Worker',
  '    persona: You do the T12B1 work.',
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
  'policyStates:',
  '  - id: default',
  '    description: The T12B1 default state.',
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

/** The row config base (the entry's ONLY input channel). */
function rowConfig(overrides: Record<string, any>): Record<string, any> {
  return {
    bootPhase: 'create',
    rootSessionId: ROOT_SID,
    blueprintSource: BLUEPRINT_SOURCE,
    generation: 1,
    defaultWorkspace: 'C:/agent-team/work/t12b1',
    seedMembers: [],
    staticModel: { provider: 't12b1-static', model: 't12b1-model-v1' },
    deniedSelection: null,
    mcpServer: null,
    environmentFacts: [
      { domain: 'tool', subject: 'web', available: true, generation: 1 },
      { domain: 'skill', subject: 'base', available: true, generation: 1 },
    ],
    externalPolicyFacts: { hard: {}, capabilityExists: {} },
    glueUrl: stubGlueUrl(),
    ...overrides,
  }
}

// --- the test Cordis context (the p8s5a / p8s7r4 pattern) ----------------------

interface TestWorld {
  ctx: TeamPluginHostContext
  readonly provided: Record<string, any>
}

/** One plain-object Cordis context (get / provide / effect). */
function makeWorld(seam: FileStorageSeam): TestWorld {
  const provided: Record<string, any> = {
    agents: { create: async () => {}, resume: async () => {} },
    sessionPersistence: { ensure: async () => {} },
    teamStorageSeam: seam,
  }
  return {
    ctx: {
      get: (name: string) => provided[name],
      provide: (name: string, value: unknown) => {
        provided[name] = value
      },
      effect: (factory: () => () => void, _label?: string) => {
        void factory()
      },
    },
    provided,
  }
}

/** Apply the entry and await its bootstrap (`ready`). */
async function applyWorld(world: TestWorld, config: Record<string, any>): Promise<Record<string, any>> {
  await hostEntry.apply(world.ctx, config)
  const teamRoot: Record<string, any> = world.provided.teamRoot
  if (teamRoot === undefined) throw new Error('T12B1 guard: apply resolved but never provided teamRoot')
  const root: Record<string, any> = await teamRoot.ready
  return root
}

/** Fail the whole file (module-load failure) on a flow-critical invariant. */
function check(condition: boolean, label: string): void {
  if (!condition) throw new Error(`T12B1 invariant: ${label}`)
}

const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/

// Pre-cleanup: the scratch basenames are DETERMINISTIC (the testkit
// contract) — a crashed run (a module-load failure skips the teardown
// below) would leave a stamped team_domain behind and poison the next
// run's create. Destroy every world's medium BEFORE the first boot so
// each world starts on a truly fresh medium.
for (const n of ['t12b1-real-create', 't12b1-fixture-flag', 't12b1-legacy-seed', 't12b1-recreate']) {
  destroyDir(scratchDir(n))
}

// --- W1: the REAL production create (no flag, empty seedMembers) ----------------

const seam1 = new FileStorageSeam(scratchDir('t12b1-real-create'))
const world1 = makeWorld(seam1)
const root1 = await applyWorld(world1, rowConfig({}))
/** The stub glue's recorded state (`root.live` IS the glue bundle). */
const glueState1: any = (root1 as any).live?.__t1

const repos1 = root1.domain.repositories
const teamSession1 = repos1.teamSessions.get(ROOT_SID)
const binding1 = repos1.sessionBindings.get(ROOT_SID)
const members1 = repos1.memberInstances.list(ROOT_SID)

check(teamSession1 !== undefined, 'W1: the real create durably committed the TeamSession record')
check(binding1 !== undefined, 'W1: the real create durably committed the team-root binding')

// --- W2: the explicit fixture mode (`fixtureWorld: true`, empty seedMembers) ----

const seam2 = new FileStorageSeam(scratchDir('t12b1-fixture-flag'))
const root2 = await applyWorld(makeWorld(seam2), rowConfig({ fixtureWorld: true }))
const repos2 = root2.domain.repositories

// --- W3: the legacy-compatibility trigger (non-empty seedMembers, no flag) ------

const SEED_WORKER_ID = 'inst-t12b1seedw1'
const SEED_WORKER_CHILD = 'session-child-t12b1seedw1'
const seam3 = new FileStorageSeam(scratchDir('t12b1-legacy-seed'))
const root3 = await applyWorld(
  makeWorld(seam3),
  rowConfig({
    seedMembers: [
      { instanceId: SEED_WORKER_ID, templateId: 'worker', label: 't12b1-seed-worker', childSessionId: SEED_WORKER_CHILD },
    ],
  }),
)
const repos3 = root3.domain.repositories

// --- W4: a second create over the same medium fails closed ----------------------
// W4a: the real create over a fresh medium. The SECOND create attempt over
// the same medium must REJECT at the storage layer (team_domain already
// exists -> use openTeamDomain): the normal production create mints exactly
// ONE durable Team identity per medium; a repeat create fails closed instead
// of silently duplicating. (The create -> restart -> RESUME cycle is the
// T12-B2 acceptance, covered by the t12b2 test.)

const seam4 = new FileStorageSeam(scratchDir('t12b1-recreate'))
const root4a = await applyWorld(makeWorld(seam4), rowConfig({}))
const createdAt4a = root4a.domain.repositories.teamSessions.get(ROOT_SID)!.createdAt
await root4a.close()
/** The rejection message of the second (must-fail) create over the same medium. */
let secondCreateError = ''
{
  // `apply` settles BEFORE the bootstrap: the rejection surfaces on the
  // provided `teamRoot.ready` (the production entry's lazy bootstrap
  // contract). Awaiting it here is what handles that rejection.
  const world4 = makeWorld(seam4)
  await hostEntry.apply(world4.ctx, rowConfig({}))
  const teamRoot4: any = world4.provided.teamRoot
  try {
    await teamRoot4.ready
  } catch (e) {
    secondCreateError = e instanceof Error ? e.message : String(e)
  }
}

// --- the assertions --------------------------------------------------------------

describe('T12-B1: the real production create (no seedBootWorld)', () => {
  it('W1: the real create commits the canonical fresh-root durable state', () => {
    // The TeamSession record: the row's bound blueprint, the generation
    // stamp, the row clock as createdAt — NOT the frozen epoch-0 seed
    // stamp. Generation 2 = the bindFresh creation stamp (1) advanced
    // ONCE by the boot-time initial compatibility probe's replaceState
    // (the frozen G8-S1 hook-B semantic: every probe state replacement
    // moves the team_sessions generation stamp).
    expect(teamSession1.blueprint.blueprintId).toBe('T12B1-BP')
    expect(teamSession1.blueprint.revision).toBe('1')
    expect(teamSession1.generation).toBe(2)
    expect(teamSession1.defaultWorkspace).toBe('C:/agent-team/work/t12b1')
    expect(ISO_RE.test(teamSession1.createdAt)).toBe(true)
    expect(teamSession1.createdAt).not.toBe(EPOCH_0)

    // The team-root binding row (record BEFORE binding, the frozen write
    // ordering of the canonical fresh-root path).
    expect(binding1.kind).toBe('team-root')
    expect(binding1.sessionId).toBe(ROOT_SID)

    // ZERO fabricated members: exactly the canonical Leader mint (the honest
    // v2 shape — no childSessionId, no lifecycle: the Leader IS the Root
    // Agent + the Root Session).
    expect(members1.length).toBe(1)
    const leader = members1[0]
    expect(leader.instanceId).toBe(LEADER_INSTANCE_ID)
    expect(leader.templateId).toBe('leader')
    expect(leader.label).toBe('leader')
    expect(leader.activityVersion).toBe(1)
    expect(ISO_RE.test(leader.createdAt)).toBe(true)
    expect(leader.createdAt).not.toBe(EPOCH_0)
    expect('childSessionId' in leader).toBe(false)
    expect('lifecycle' in leader).toBe(false)

    // The live Root Agent: the live layer's one-shot create phase ran (the
    // stub glue counts it — the real glue creates the root agent there).
    expect(glueState1?.bootCount).toBe(1)
  })

  it('W2: the explicit fixture mode keeps the frozen seed world (unchanged contract)', () => {
    const seeded = repos2.teamSessions.get(ROOT_SID)
    expect(seeded).not.toBe(undefined)
    // The frozen seed fingerprint: the epoch-0 stamp ...
    expect(seeded.createdAt).toBe(EPOCH_0)
    // ... and the P6-era leader row (child session IS the root session,
    // lifecycle RUNNING) — NOT the honest-v2 bindFresh mint.
    const leader = repos2.memberInstances.get(ROOT_SID, LEADER_INSTANCE_ID)
    expect(leader).not.toBe(undefined)
    expect(leader.childSessionId).toBe(ROOT_SID)
    expect(leader.lifecycle).toBe('RUNNING')
  })

  it('W3: a non-empty seedMembers keeps the legacy seeded world (harness compatibility)', () => {
    const seeded = repos3.teamSessions.get(ROOT_SID)
    expect(seeded.createdAt).toBe(EPOCH_0)
    const seed = repos3.memberInstances.get(ROOT_SID, SEED_WORKER_ID)
    expect(seed).not.toBe(undefined)
    expect(seed.templateId).toBe('worker')
    expect(seed.childSessionId).toBe(SEED_WORKER_CHILD)
    expect(seed.lifecycle).toBe('RUNNING')
    // The leader is the seeded P6 shape (the seed world's own row).
    const leader = repos3.memberInstances.get(ROOT_SID, LEADER_INSTANCE_ID)
    expect(leader.childSessionId).toBe(ROOT_SID)
  })

  it('W4: a second create over the same medium fails closed (no silent duplicate)', () => {
    // The storage layer refuses the re-create of an existing durable team
    // domain: one create == one durable Team identity (plan §7-B2 separation
    // of create and resume). The failure must name the existing domain and
    // point at the resume path.
    expect(secondCreateError.indexOf('team_domain already exists') >= 0).toBe(true)
    expect(secondCreateError.indexOf('openTeamDomain') >= 0).toBe(true)
    // The first create's durable identity stands (captured before close):
    // row clock, not the frozen epoch-0 seed stamp.
    expect(ISO_RE.test(createdAt4a)).toBe(true)
    expect(createdAt4a).not.toBe(EPOCH_0)
  })
})

// --- teardown (the p8s7r4 pattern: module-level, after the boots) ---------------

await root1.close()
await root2.close()
await root3.close()
await destroyDir(seam1.scratchDir)
await destroyDir(seam2.scratchDir)
await destroyDir(seam3.scratchDir)
await destroyDir(seam4.scratchDir)
