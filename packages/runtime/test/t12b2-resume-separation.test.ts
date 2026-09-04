/**
 * t12b2-resume-separation.test.ts — T12-B2 (Lane B): the create / resume
 * separation — the `resume` boot phase LOADS the existing durable Team
 * identity (TeamSession record + team-root binding + member rows) and
 * NEVER re-mints.
 *
 * Plan §7-B2 acceptance, proven through the production entry
 * (`host.apply` over a REAL file storage seam, the p8s7r4 pattern):
 *
 *   create once -> restart -> resume
 *   -> same RootSessionId
 *   -> same MemberInstance
 *   -> same deterministic child SessionId
 *   -> no duplicate Team / member
 *
 * Worlds:
 *   W1+W2: the REAL production create (no flag, empty seedMembers) over a
 *          fresh medium; the restart re-applies `bootPhase: 'resume'`
 *          over the SAME medium. Every durable identity field is
 *          byte-identical (createdAt included — no re-mint), the
 *          generation stamp is unchanged (no re-stamp), exactly one Team
 *          row and one member row survive (no duplicates).
 *   W3: the fixture world (non-empty seedMembers — the legacy seed pair
 *       with its deterministic child session id) across create ->
 *       restart -> resume: the same MemberInstance and the same
 *       deterministic child SessionId survive; no duplicate rows.
 *   W4: resume over a medium that carries NO team domain fails closed at
 *       the storage layer (openTeamDomain — the schema stamp is missing):
 *       the resume never creates a domain.
 *   W5: resume of a root the medium's domain was never created for (a
 *       foreign `rootSessionId`) fails closed at the T12-B2
 *       durable-identity load (TEAM_PLUGIN_RESUME_STATE_MISSING): the
 *       resume LOADS, and a missing identity is a loud failure, not a
 *       silent pass-through re-mint.
 *
 * Runner note: the plain-node vitest shim forbids async `it()` bodies —
 * the worlds are booted at module load (top-level await), the `it`
 * bodies assert synchronously (the p8s7r4 pattern).
 * @module @dsh-agent-team/runtime/test/t12b2-resume-separation
 */

import { describe, expect, it } from 'vitest'
import {
  destroyDir,
  FileStorageSeam,
  scratchDir,
} from '../../testkit/fault-injection/file-seam.mjs'
import * as hostEntry from '../src/plugin/host.js'
import type { TeamPluginHostContext } from '../src/plugin/host.js'
import { isTeamPluginError } from '../src/plugin/types.js'
import { stubGlueUrl } from './p8s5a-artifacts.mjs'
import { LEADER_INSTANCE_ID } from '../../contracts/src/index.js'

// --- the fixture identities -----------------------------------------------------

/** The production row's root (W1/W2) and the foreign root (W5). */
const ROOT_SID = 'session-t12b2root'
const ROOT_FOREIGN = 'session-t12b2foreign'
/** The frozen epoch-0 stamp (the seed-world fingerprint; never here). */
const EPOCH_0 = new Date(0).toISOString()
/** The row blueprint (structure mirrors the T12-B1 fixture; own id). */
const BLUEPRINT_SOURCE = [
  '---',
  'schemaVersion: 1',
  'blueprintId: T12B2-BP',
  'revision: "1"',
  'leader:',
  '  templateId: leader',
  '  persona: You lead the T12B2 team.',
  'members:',
  '  - templateId: worker',
  '    displayName: Worker',
  '    persona: You do the T12B2 work.',
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
  '    description: The T12B2 default state.',
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

/** The W3 legacy seed pair (deterministic child session id). */
const SEED_WORKER_ID = 'inst-t12b2seedw1'
const SEED_WORKER_CHILD = 'session-child-t12b2seedw1'
const SEED_WORKER = {
  instanceId: SEED_WORKER_ID,
  templateId: 'worker',
  label: 't12b2-seed-worker',
  childSessionId: SEED_WORKER_CHILD,
}

/** The row config base (the entry's ONLY input channel). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
function rowConfig(overrides: Record<string, any>): Record<string, any> {
  return {
    bootPhase: 'create',
    rootSessionId: ROOT_SID,
    blueprintSource: BLUEPRINT_SOURCE,
    generation: 1,
    defaultWorkspace: 'C:/agent-team/work/t12b2',
    seedMembers: [],
    staticModel: { provider: 't12b2-static', model: 't12b2-model-v1' },
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
  readonly provided: Record<string, any>
}

/** One plain-object Cordis context (get / provide / effect). */
function makeWorld(seam: FileStorageSeam): TestWorld {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
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
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
async function applyWorld(world: TestWorld, config: Record<string, any>): Promise<Record<string, any>> {
  await hostEntry.apply(world.ctx, config)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
  const teamRoot: Record<string, any> = world.provided.teamRoot
  if (teamRoot === undefined) throw new Error('T12B2 guard: apply resolved but never provided teamRoot')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
  const root: Record<string, any> = await teamRoot.ready
  return root
}

/** Apply the entry and AWAIT THE BOOTSTRAP REJECTION (negative worlds). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
async function applyWorldFailing(world: TestWorld, config: Record<string, any>): Promise<{ code: string | null; message: string }> {
  await hostEntry.apply(world.ctx, config)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
  const teamRoot: Record<string, any> = world.provided.teamRoot
  if (teamRoot === undefined) throw new Error('T12B2 guard: apply resolved but never provided teamRoot')
  try {
    await teamRoot.ready
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const code = isTeamPluginError(error) ? error.code : null
    return { code, message }
  }
  throw new Error('T12B2 guard: the negative world booted instead of rejecting')
}

/** Fail the whole file (module-load failure) on a flow-critical invariant. */
function check(condition: boolean, label: string): void {
  if (!condition) throw new Error(`T12B2 invariant: ${label}`)
}

const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/

// Pre-cleanup: the scratch basenames are DETERMINISTIC (the testkit
// contract) — a crashed run (a module-load failure skips the teardown
// below) would leave a stamped team_domain behind and poison the next
// run's create. Destroy every world's medium BEFORE the first boot so
// each world starts on a truly fresh medium.
for (const n of ['t12b2-cycle', 't12b2-child', 't12b2-no-domain', 't12b2-foreign-root']) {
  destroyDir(scratchDir(n))
}

// --- W1+W2: the REAL create -> restart -> resume acceptance --------------------
// One fresh medium, one shared seam: the create world boots and closes,
// then the resume world re-applies over the SAME medium (the restart).
// The acceptance: same RootSessionId, same MemberInstance, no duplicate
// Team/member; the resume re-mints NOTHING (createdAt is byte-identical,
// the generation stamp is unchanged).

interface CycleState {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- untyped test payload / hidden internal state
  team1: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- untyped test payload / hidden internal state
  binding1: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- untyped test payload / hidden internal state
  members1: any[]
  teamCount1: number
  bootCount1: number
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- untyped test payload / hidden internal state
  team2: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- untyped test payload / hidden internal state
  binding2: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- untyped test payload / hidden internal state
  members2: any[]
  teamCount2: number
  bootCount2: number
}

const cycle: CycleState = await (async (): Promise<CycleState> => {
  const seam = new FileStorageSeam(scratchDir('t12b2-cycle'))
  const root1 = await applyWorld(makeWorld(seam), rowConfig({}))
  const repos1 = root1.domain.repositories
  const team1 = repos1.teamSessions.get(ROOT_SID)
  const binding1 = repos1.sessionBindings.get(ROOT_SID)
  const members1 = repos1.memberInstances.list(ROOT_SID)
  const teamCount1 = repos1.teamSessions.list().length
  check(team1 !== undefined, 'W1: the real create committed the TeamSession record')
  check(binding1 !== undefined, 'W1: the real create committed the team-root binding')
  check(members1.length === 1, 'W1: the real create minted exactly the Leader')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- untyped test payload / hidden internal state
  const bootCount1 = (root1.live as any).__t1.bootCount
  await root1.close()

  // The RESTART: the same medium, a fresh row instance, bootPhase 'resume'.
  const root2 = await applyWorld(makeWorld(seam), rowConfig({ bootPhase: 'resume' }))
  const repos2 = root2.domain.repositories
  const team2 = repos2.teamSessions.get(ROOT_SID)
  const binding2 = repos2.sessionBindings.get(ROOT_SID)
  const members2 = repos2.memberInstances.list(ROOT_SID)
  const teamCount2 = repos2.teamSessions.list().length
  check(team2 !== undefined, 'W2: the resume loaded the existing TeamSession record')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- untyped test payload / hidden internal state
  const bootCount2 = (root2.live as any).__t1.bootCount
  try {
    return {
      team1, binding1, members1, teamCount1, bootCount1,
      team2, binding2, members2, teamCount2, bootCount2,
    }
  } finally {
    await root2.close()
    destroyDir(scratchDir('t12b2-cycle'))
  }
})()

// --- W3: the fixture world's deterministic child SessionId across the restart --
// The legacy seed pair carries an explicit deterministic child session id
// — the acceptance's "same deterministic child SessionId" with a real
// member child present.

interface ChildState {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- untyped test payload / hidden internal state
  leader1: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- untyped test payload / hidden internal state
  worker1: any
  memberCount1: number
  teamGen1: number
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- untyped test payload / hidden internal state
  leader2: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- untyped test payload / hidden internal state
  worker2: any
  memberCount2: number
  teamGen2: number
}

const child: ChildState = await (async (): Promise<ChildState> => {
  const seam = new FileStorageSeam(scratchDir('t12b2-child'))
  const root1 = await applyWorld(makeWorld(seam), rowConfig({ seedMembers: [SEED_WORKER] }))
  const repos1 = root1.domain.repositories
  const leader1 = repos1.memberInstances.get(ROOT_SID, LEADER_INSTANCE_ID)
  const worker1 = repos1.memberInstances.get(ROOT_SID, SEED_WORKER_ID)
  const memberCount1 = repos1.memberInstances.list(ROOT_SID).length
  const teamGen1 = repos1.teamSessions.get(ROOT_SID)!.generation
  check(leader1 !== undefined, 'W3: the seeded world committed the Leader row')
  check(worker1 !== undefined, 'W3: the seeded world committed the seed worker row')
  await root1.close()

  const root2 = await applyWorld(makeWorld(seam), rowConfig({ bootPhase: 'resume', seedMembers: [SEED_WORKER] }))
  const repos2 = root2.domain.repositories
  const leader2 = repos2.memberInstances.get(ROOT_SID, LEADER_INSTANCE_ID)
  const worker2 = repos2.memberInstances.get(ROOT_SID, SEED_WORKER_ID)
  const memberCount2 = repos2.memberInstances.list(ROOT_SID).length
  const teamGen2 = repos2.teamSessions.get(ROOT_SID)!.generation
  check(worker2 !== undefined, 'W3: the resume loaded the seed worker row')
  try {
    return { leader1, worker1, memberCount1, teamGen1, leader2, worker2, memberCount2, teamGen2 }
  } finally {
    await root2.close()
    destroyDir(scratchDir('t12b2-child'))
  }
})()

// --- W4: resume over a medium with NO team domain fails closed -----------------
// The resume must never CREATE the domain: openTeamDomain rejects with
// the missing-stamp contract (before any Team identity could be minted).

let noDomain: { code: string | null; message: string }
{
  const seam = new FileStorageSeam(scratchDir('t12b2-no-domain'))
  noDomain = await applyWorldFailing(makeWorld(seam), rowConfig({ bootPhase: 'resume' }))
  destroyDir(scratchDir('t12b2-no-domain'))
}

// --- W5: resume of a FOREIGN root fails closed at the identity load ------------
// The medium's domain exists (created for ROOT_SID) but was never created
// for the foreign root: the T12-B2 durable-identity load finds no
// TeamSession record for that root and fails closed — the pre-B2
// pass-through would have booted a "resumed" root with no Team identity.

let foreign: { code: string | null; message: string }
{
  const seam = new FileStorageSeam(scratchDir('t12b2-foreign-root'))
  const root1 = await applyWorld(makeWorld(seam), rowConfig({}))
  await root1.close()
  foreign = await applyWorldFailing(
    makeWorld(seam),
    rowConfig({ bootPhase: 'resume', rootSessionId: ROOT_FOREIGN }),
  )
  destroyDir(scratchDir('t12b2-foreign-root'))
}

// --- the assertions -------------------------------------------------------------

describe('T12-B2 — create/resume separation (plan §7-B2)', () => {
  it('W1: the real production create (no flag, empty seedMembers) durably mints exactly ONE Team identity', () => {
    // The durable TeamSession (canonical fresh-root record, row clock).
    expect(cycle.team1.rootSessionId).toBe(ROOT_SID)
    expect(cycle.team1.blueprint.blueprintId).toBe('T12B2-BP')
    expect(cycle.team1.blueprint.revision).toBe('1')
    // G8-S1 hook B end-state: bindFresh stamps generation 1, the boot-time
    // initial compatibility probe advances it to 2 (frozen semantics).
    expect(cycle.team1.generation).toBe(2)
    expect(cycle.team1.defaultWorkspace).toBe('C:/agent-team/work/t12b2')
    expect(ISO_RE.test(cycle.team1.createdAt)).toBe(true)
    expect(cycle.team1.createdAt).not.toBe(EPOCH_0)

    // The team-root binding.
    expect(cycle.binding1.kind).toBe('team-root')
    expect(cycle.binding1.sessionId).toBe(ROOT_SID)

    // ZERO fabricated members: exactly the honest-v2 Leader (no
    // childSessionId, no lifecycle: the Leader IS the Root Agent).
    expect(cycle.members1.length).toBe(1)
    const leader = cycle.members1[0]
    expect(leader.instanceId).toBe(LEADER_INSTANCE_ID)
    expect(leader.templateId).toBe('leader')
    expect(leader.label).toBe('leader')
    expect(leader.activityVersion).toBe(1)
    expect(leader.childSessionId).toBe(undefined)
    expect(ISO_RE.test(leader.createdAt)).toBe(true)
    expect(leader.createdAt).not.toBe(EPOCH_0)

    // Exactly ONE Team on the medium; the root agent booted exactly once.
    expect(cycle.teamCount1).toBe(1)
    expect(cycle.bootCount1).toBe(1)
  })

  it('W2: the restart resume over the SAME medium loads the SAME identity — no re-mint, no duplicates', () => {
    const t1 = cycle.team1
    const t2 = cycle.team2

    // Same RootSessionId (byte-identical TeamSession row: the create's
    // row clock survived — the resume minted nothing new).
    expect(t2.rootSessionId).toBe(ROOT_SID)
    expect(t2.createdAt).toBe(t1.createdAt)
    expect(t2.blueprint.blueprintId).toBe(t1.blueprint.blueprintId)
    expect(t2.blueprint.revision).toBe(t1.blueprint.revision)
    expect(t2.defaultWorkspace).toBe(t1.defaultWorkspace)
    // No re-stamp: the generation stamp is unchanged (the resume found
    // the existing compatibility state — no initial probe ran).
    expect(t2.generation).toBe(t1.generation)
    expect(t2.generation).toBe(2)
    // The full durable row is byte-identical (deep equality).
    expect(t2).toEqual(t1)

    // Same team-root binding (byte-identical).
    expect(cycle.binding2.kind).toBe('team-root')
    expect(cycle.binding2).toEqual(cycle.binding1)

    // Same MemberInstance (byte-identical row), no duplicate member.
    expect(cycle.members2.length).toBe(1)
    expect(cycle.members2).toEqual(cycle.members1)
    const leader2 = cycle.members2[0]
    expect(leader2.instanceId).toBe(LEADER_INSTANCE_ID)
    expect(leader2.childSessionId).toBe(undefined)

    // No duplicate Team (exactly the create's one row), and the restarted
    // row instance booted its own root agent exactly once.
    expect(cycle.teamCount2).toBe(1)
    expect(cycle.bootCount2).toBe(1)
  })

  it('W3: the fixture world keeps the same MemberInstance and the same deterministic child SessionId across the restart', () => {
    // The Leader row (seeded: its child session IS the root session) is
    // byte-identical across the restart.
    expect(child.leader2).toEqual(child.leader1)
    expect(child.leader2.instanceId).toBe(LEADER_INSTANCE_ID)
    expect(child.leader2.childSessionId).toBe(ROOT_SID)

    // The seed worker: the SAME MemberInstance and the SAME deterministic
    // child SessionId after the restart (byte-identical row).
    expect(child.worker2).toEqual(child.worker1)
    expect(child.worker2.instanceId).toBe(SEED_WORKER_ID)
    expect(child.worker2.childSessionId).toBe(SEED_WORKER_CHILD)

    // No duplicate member rows (Leader + the one seed worker), no
    // re-stamp of the Team identity.
    expect(child.memberCount1).toBe(2)
    expect(child.memberCount2).toBe(2)
    expect(child.teamGen2).toBe(child.teamGen1)
  })

  it('W4: resume over a medium with no team domain fails closed (the resume never creates the domain)', () => {
    // openTeamDomain's missing-stamp contract (the domain's stamp rows
    // were never written — the resume must not write them).
    expect(noDomain.message.indexOf('is missing (partial create or corruption)') >= 0).toBe(true)
  })

  it('W5: resume of a root the medium was never created for fails closed at the durable-identity load', () => {
    // The T12-B2 loud failure (the pre-B2 pass-through would have booted
    // a "resumed" root with no Team identity at all).
    expect(foreign.code).toBe('TEAM_PLUGIN_RESUME_STATE_MISSING')
    expect(foreign.message.indexOf(`root "${ROOT_FOREIGN}"`) >= 0).toBe(true)
    expect(foreign.message.indexOf('no durable TeamSession record') >= 0).toBe(true)
  })
})
