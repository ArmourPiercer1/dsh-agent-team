/**
 * rmr-create-or-open-boot.test.ts — remote-mount-race fix (root cause B):
 * the row-level `bootPhase: "create-or-open"` (the shipped bundle's
 * restart-safe phase) RESOLVED through the production entry
 * (`host.apply` over a REAL file storage seam, the p8s7r4/t12b2 pattern):
 *
 *   S1 fresh medium: create-or-open INITIALIZES the domain (the full
 *      eight-store stamp) and MINTS the Team identity — the resolved
 *      `create` branch (the root's real production create: TeamSession
 *      record + team-root binding + exactly the Leader).
 *   S2 returning home: the SAME medium, a fresh row instance,
 *      create-or-open ADOPTS the domain and LOADS the identity — the
 *      resolved `resume` branch (createdAt byte-identical, one Team row,
 *      no re-mint, no duplicate rows). This is the user-world 405 fix:
 *      the pre-fix bundle shipped `create`, whose TEAM_DOMAIN_EXISTS on
 *      every returning home was swallowed by the bootstrap.
 *   S3 strictness preserved: `bootPhase: "create"` over the now-stamped
 *      medium STILL fails closed with TEAM_DOMAIN_EXISTS — the new phase
 *      never leaks into the strict fresh-world contract (and `resume`
 *      stays strict load-only per plan §7-B2 / t12b2 W4).
 *   S4/S5/S6 the D-1 state (user real-machine home): the full eight-store
 *      stamp is present but the Team identity was NEVER committed (a
 *      pre-fix first boot that stamped and died before minting, or a
 *      crash between the stamp commit and the mint commit). The medium is
 *      tampered to exactly that shape (L1 + L2 stamps kept, every other
 *      table zeroed):
 *        S4 strict `resume` over it STILL fails closed (a resume never
 *           self-heals — T12-B2 load-only is preserved for the strict
 *           entry);
 *        S5 `create-or-open` SELF-HEALS it: the stamps are ADOPTED
 *           (byte-identical, never re-stamped) and the missing identity
 *           is MINTED (fresh createdAt, one Team row, exactly the Leader);
 *        S6 the healed home RESTARTS: create-or-open adopts + LOADS
 *           (createdAt stable — no re-mint).
 *
 * The resolution lives in the host: the domain step learns whether the
 * medium was created or adopted (`createOrOpenTeamDomainDetailed`) and
 * passes the resolved two-value phase to the root and the live glue,
 * whose strict `create` | `resume` contract is unchanged.
 *
 * Runner note: the plain-node vitest shim forbids async `it()` bodies —
 * the worlds are booted at module load (top-level await), the `it`
 * bodies assert synchronously (the p8s7r4/t12b2 pattern).
 * @module @dsh-agent-team/runtime/test/rmr-create-or-open-boot
 */

import { describe, expect, it } from 'vitest'
import {
  destroyDir,
  FileStorageSeam,
  listFiles,
  readText,
  scratchDir,
  writeText,
} from '../../testkit/fault-injection/file-seam.mjs'
import * as hostEntry from '../src/plugin/host.js'
import type { TeamPluginHostContext } from '../src/plugin/host.js'
import { isTeamPluginError } from '../src/plugin/types.js'
import { stubGlueUrl } from './p8s5a-artifacts.mjs'
import { LEADER_INSTANCE_ID } from '../../contracts/src/index.js'

// --- the fixture identities -----------------------------------------------------

const ROOT_SID = 'session-rmrcooroot'

/** The row blueprint (own id; structure mirrors the t12b2 fixture). */
const BLUEPRINT_SOURCE = [
  '---',
  'schemaVersion: 1',
  'blueprintId: RMR-COO-BP',
  'revision: "1"',
  'leader:',
  '  templateId: leader',
  '  persona: You lead the RMR-COO team.',
  'members:',
  '  - templateId: worker',
  '    displayName: Worker',
  '    persona: You do the RMR-COO work.',
  'requirements:',
  '  - domain: tool',
  '    name: web',
  '    optional: true',
  'teamEnvelope:',
  '  allow:',
  '    - assign-task',
  '    - create-member',
  '    - send-message',
  '    - report-progress',
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
  '    description: The RMR-COO default state.',
  'quotas:',
  '    team:',
  '      maxInstances: 12',
  '      maxConcurrent: 12',
  '    members:',
  '      maxInstances: 4',
  '      maxConcurrent: 4',
  'metadata: {}',
  '---',
].join('\n')

/** The row config base (the entry's ONLY input channel). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
function rowConfig(overrides: Record<string, any>): Record<string, any> {
  return {
    bootPhase: 'create-or-open',
    rootSessionId: ROOT_SID,
    blueprintSource: BLUEPRINT_SOURCE,
    generation: 1,
    defaultWorkspace: 'C:/agent-team/work/rmrcoo',
    seedMembers: [],
    staticModel: { provider: 'rmrcoo-static', model: 'rmrcoo-model-v1' },
    deniedSelection: null,
    mcpServer: null,
    environmentFacts: [
      { domain: 'tool', subject: 'web', available: true, generation: 1 },
    ],
    externalPolicyFacts: { hard: {}, capabilityExists: {} },
    glueUrl: stubGlueUrl(),
    remoteMountWaitMs: 0,
    ...overrides,
  }
}

// --- the test Cordis context (the t12b2 pattern) --------------------------------

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
  if (teamRoot === undefined) throw new Error('RMR-COO guard: apply resolved but never provided teamRoot')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
  const root: Record<string, any> = await teamRoot.ready
  return root
}

/** Apply the entry and AWAIT THE BOOTSTRAP REJECTION (the S3 negative). */
async function applyWorldFailing(
  world: TestWorld,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
  config: Record<string, any>,
): Promise<{ code: string | null; message: string }> {
  await hostEntry.apply(world.ctx, config)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
  const teamRoot: Record<string, any> = world.provided.teamRoot
  if (teamRoot === undefined) throw new Error('RMR-COO guard: apply resolved but never provided teamRoot')
  try {
    await teamRoot.ready
  } catch (error) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- untyped rejection (domain or plugin error)
    const raw = error as any
    const message = error instanceof Error ? error.message : String(error)
    const code = isTeamPluginError(error)
      ? error.code
      : typeof raw?.code === 'string'
        ? raw.code
        : null
    return { code, message }
  }
  throw new Error('RMR-COO guard: the negative world booted instead of rejecting')
}

/** Fail the whole file (module-load failure) on a flow-critical invariant. */
function check(condition: boolean, label: string): void {
  if (!condition) throw new Error(`RMR-COO invariant: ${label}`)
}

// Pre-cleanup: the scratch basename is DETERMINISTIC (the testkit
// contract) — a crashed run would leave a stamped team_domain behind and
// poison the next run's S1. Destroy the medium BEFORE the first boot.
destroyDir(scratchDir('rmrcoo-boot'))

// --- S1 + S2 + S3: one medium, three boots ----------------------------------------
// Fresh medium -> create-or-open (initializes + mints) -> close ->
// create-or-over the SAME medium (adopts + loads) -> close -> strict
// create over the SAME medium (must fail closed).

let teamCount1 = 0
let teamCount2 = 0
let teamCount3 = 0
let strictFail: { code: string | null; message: string } = { code: null, message: '' }

const seam = new FileStorageSeam(scratchDir('rmrcoo-boot'))

// S1 — fresh medium: the create-or-open world boots.
const root1 = await applyWorld(makeWorld(seam), rowConfig({}))
const repos1 = root1.domain.repositories
const team1 = repos1.teamSessions.get(ROOT_SID)
const binding1 = repos1.sessionBindings.get(ROOT_SID)
const members1 = repos1.memberInstances.list(ROOT_SID)
teamCount1 = repos1.teamSessions.list().length
check(team1 !== undefined, 'S1: the create-or-open create committed the TeamSession record')
check(binding1 !== undefined, 'S1: the create-or-open create committed the team-root binding')
check(members1.length === 1, 'S1: the create-or-open create minted exactly the Leader')
const createdAt1 = team1.createdAt
await root1.close()

// S2 — the RESTART: the same medium, a fresh row instance, create-or-open.
const root2 = await applyWorld(makeWorld(seam), rowConfig({}))
const repos2 = root2.domain.repositories
const team2 = repos2.teamSessions.get(ROOT_SID)
teamCount2 = repos2.teamSessions.list().length
check(team2 !== undefined, 'S2: the create-or-open adopt loaded the TeamSession record')
await root2.close()

// S3 — strict create over the now-stamped medium: must fail closed.
strictFail = await applyWorldFailing(makeWorld(seam), rowConfig({ bootPhase: 'create' }))

// --- S4 + S5 + S6: the D-1 stamped-no-identity state (user real-machine home) ---
// The user's 405 world after the pre-fix fix: the FIRST boot stamped all
// eight stores, then the process died before the Team identity was minted
// (stamps committed, data tables empty). Tamper the medium to exactly that
// shape: keep the L1 meta + the `schema_meta` L2 stamps, zero every other
// table file (the file-seam's plain tamper helpers — designed for this).

const DOMAIN_NAME = 'team_domain'
const DATA_TABLES = [
  'team_sessions',
  'member_instances',
  'session_bindings',
  'overrides',
  'compatibility',
  'operations',
  'ledger',
] as const

const domainDir = seam.dirFor(DOMAIN_NAME)
for (const table of [...DATA_TABLES, 'schema_meta']) {
  const file = `${table}.json`
  check(listFiles(domainDir).includes(file), `D-1: the tamper precondition — table file present: ${file}`)
}
const stampsBeforeHeal = readText(seam.pathFor(DOMAIN_NAME, 'schema_meta'))
for (const table of DATA_TABLES) {
  writeText(seam.pathFor(DOMAIN_NAME, table), '{}')
}

// S4 — strict resume over stamped-no-identity: fails closed (W4 preserved —
// the strict entry never self-heals).
let resumeFail: { code: string | null; message: string } = { code: null, message: '' }
resumeFail = await applyWorldFailing(makeWorld(seam), rowConfig({ bootPhase: 'resume' }))

// S5 — create-or-open over stamped-no-identity: SELF-HEALS (adopts the
// stamps, mints the missing identity). The failed S4 root boot leaves the
// previous realm's domain open (the row-stop backstop would release it; the
// test ctx does not run row-stop effects) — exactly what a crashed/rejected
// bootstrap does in a real process. The restart therefore uses a FRESH
// seam instance over the same medium: the file-seam's documented process-
// restart model (durable files outlive the realm).
const seam2 = new FileStorageSeam(seam.scratchDir)
const root3 = await applyWorld(makeWorld(seam2), rowConfig({}))
const repos3 = root3.domain.repositories
const team3 = repos3.teamSessions.get(ROOT_SID)
const binding3 = repos3.sessionBindings.get(ROOT_SID)
const members3 = repos3.memberInstances.list(ROOT_SID)
check(team3 !== undefined, 'S5: the create-or-open heal minted the TeamSession record')
check(binding3 !== undefined, 'S5: the create-or-open heal minted the team-root binding')
check(members3.length === 1, 'S5: the create-or-open heal minted exactly the Leader')
teamCount3 = repos3.teamSessions.list().length
const createdAt3 = team3.createdAt
const stampsAfterHeal = readText(seam.pathFor(DOMAIN_NAME, 'schema_meta'))
await root3.close()

// S6 — the healed home RESTARTS: create-or-open adopts + loads (stable).
const root4 = await applyWorld(makeWorld(seam2), rowConfig({}))
const team4 = root4.domain.repositories.teamSessions.get(ROOT_SID)
const teamCount4 = root4.domain.repositories.teamSessions.list().length
check(team4 !== undefined, 'S6: the healed home restart loaded the minted identity')
await root4.close()

describe('rmr create-or-open boot (row-level phase resolution, root cause B)', () => {
  it('S1: fresh medium — create-or-open initializes the domain and mints the Team identity (resolved create)', () => {
    expect(team1 !== undefined).toBe(true)
    expect(binding1 !== undefined).toBe(true)
    expect(members1.length).toBe(1)
    expect(members1[0].instanceId).toBe(LEADER_INSTANCE_ID)
    expect(teamCount1).toBe(1)
    expect(typeof createdAt1 === 'string' && createdAt1.length > 0).toBe(true)
  })

  it('S2: returning home — create-or-open adopts the domain and LOADS the identity (resolved resume; no re-mint)', () => {
    expect(team2 !== undefined).toBe(true)
    // The durable identity is byte-identical (createdAt included — the
    // resolved resume branch never re-mints).
    expect(team2.createdAt).toBe(createdAt1)
    expect(teamCount2).toBe(1)
  })

  it('S3: strict create over the stamped medium still fails closed (phase separation preserved)', () => {
    expect(strictFail.code).toBe('TEAM_DOMAIN_EXISTS')
    expect(strictFail.message.includes('already exists')).toBe(true)
  })

  it('S4: strict resume over stamped-no-identity fails closed (the strict entry never self-heals — W4 preserved)', () => {
    expect(resumeFail.code).toBe('TEAM_PLUGIN_RESUME_STATE_MISSING')
    expect(resumeFail.message.includes('found no durable TeamSession record')).toBe(true)
  })

  it('S5: create-or-open SELF-HEALS stamped-no-identity (stamps adopted byte-identical, missing identity minted)', () => {
    expect(team3 !== undefined).toBe(true)
    expect(binding3 !== undefined).toBe(true)
    expect(members3.length).toBe(1)
    expect(members3[0].instanceId).toBe(LEADER_INSTANCE_ID)
    expect(teamCount3).toBe(1)
    // A FRESH mint (not a load): the identity did not exist before the heal.
    expect(createdAt3).not.toBe(createdAt1)
    // ADOPT, never re-stamp: the L2 stamps are byte-identical across the heal.
    expect(stampsAfterHeal).toBe(stampsBeforeHeal)
  })

  it('S6: the healed home restarts — create-or-open adopts + loads (no re-mint, createdAt stable)', () => {
    expect(team4 !== undefined).toBe(true)
    expect(team4.createdAt).toBe(createdAt3)
    expect(teamCount4).toBe(1)
  })
})
