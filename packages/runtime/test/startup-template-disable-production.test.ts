/**
 * startup-template-disable-production.test.ts — pre-alpha3 W3-B (review
 * fixes F6 + F7, guide §6): the durable template-AVAILABILITY set (the
 * "disable the template" half of the `fixOrDisable` resolution) is a
 * PRODUCTION writer (`requirementAuthority.setTemplateAvailability`),
 * and a disabled template RESOLVES its blocked scope — the re-driven
 * creation proceeds, the fact persists across restarts, and RE-ENABLING
 * the template (with the requirement still down) BLOCKS AGAIN.
 *
 * The F7 gap: PR-E's template-availability model (the
 * `template-availability-set` durable fact) had NO production writer.
 * This file pins guide §6.3 test 3 on the REAL production surface:
 *
 *   S3 (guide §6.3.3) — a MemberTemplate-level REQUIRED requirement
 *      down → the boot create is refused `fixOrDisable` (the down
 *      template is NOT disabled) → the human disables the template
 *      through the PRODUCTION writer → the re-driven creation proceeds
 *      (the disabled scope is RESOLVED — its required work will not
 *      start) → the durable fact is audited (the
 *      `template-availability-set` row, `available: false`).
 *   S3a (idempotence) — a second identical disable after the team
 *      exists is appended (latest-wins keeps the CURRENT availability
 *      false) and goes through the STAMPED put (the S1-A generation
 *      advance applies once the record exists — 1 → 2).
 *   S3b (negative control) — a FRESH root with an explicit
 *      `available: true` fact (the RE-ENABLE) is refused AGAIN with
 *      `fixOrDisable`: only `available: false` resolves the blocked
 *      scope (the disable is the resolution mechanism, reversible; an
 *      available template — explicitly or by default — is evaluated
 *      and blocks). The creation gate is a CREATION-time gate: a
 *      re-enable on an already-CREATED team is the runtime prober's
 *      territory (BLOCKED state + ack), not this gate's.
 *
 * World facts (deterministic): `mcpServer: null` → every `mcpServer`
 * subject is deterministically `unreachable`; the seed facts carry
 * `skill/base` available.
 *
 * The plain-node vitest shim forbids async `it()` bodies: the worlds
 * boot at module load (top-level await), the `it` bodies assert
 * synchronously (the bp1-freeze-barrier pattern).
 *
 * @module @dsh-agent-team/runtime/test/startup-template-disable-production
 */
import { describe, expect, it } from 'vitest'
import {
  destroyDir,
  FileStorageSeam,
  scratchDir,
} from '../../testkit/fault-injection/file-seam.mjs'
import { openTeamDomain } from '../../storage/repositories/index.js'
import type { TeamDomain } from '../../storage/repositories/index.js'
import * as hostEntry from '../src/plugin/host.js'
import type { TeamPluginHostContext } from '../src/plugin/host.js'
import {
  TEAM_RUNTIME_ERROR_CODES,
  TeamRuntimeError,
} from '../admission/index.js'
import {
  TEMPLATE_AVAILABILITY_SET_FACT_TYPE,
} from '../requirements/index.js'
import { stubGlueUrl } from './p8s5a-artifacts.mjs'
import { agentPresetsStandardDouble } from './agent-presets-double.mjs'

// --- the fixture identities -------------------------------------------------------

const ROOT3 = 'session-std-r3'
const ROOT3X = 'session-std-r3x'

// --- the v2 blueprint builder (the closed document shape, plan §E.2) ----------------

function requirementLines(
  requirementId: string,
  type: 'mcpServer' | 'skill',
  subjects: readonly string[],
  complete: boolean,
): string[] {
  const lines = [
    `- requirementId: ${requirementId}`,
    `  type: ${type}`,
    '  subjects:',
  ]
  for (const subject of subjects) lines.push(`    - ${subject}`)
  lines.push(`  complete: ${complete}`)
  return lines
}

function v2Doc(
  blueprintId: string,
  revision: string,
  teamRequirements: readonly string[][],
  members: ReadonlyArray<{
    templateId: string
    displayName: string
    requirements?: readonly string[]
  }>,
): string {
  const lines: string[] = [
    '---',
    'schemaVersion: 2',
    `blueprintId: ${blueprintId}`,
    `revision: "${revision}"`,
    'leader:',
    '  templateId: leader',
    `  persona: You lead the ${blueprintId} team.`,
    'members:',
  ]
  for (const member of members) {
    lines.push(`  - templateId: ${member.templateId}`)
    lines.push(`    displayName: ${member.displayName}`)
    lines.push(`    persona: You do the ${member.templateId} work.`)
    if (member.requirements !== undefined && member.requirements.length > 0) {
      lines.push('    requirements:')
      for (const line of member.requirements) lines.push(`      ${line}`)
    }
  }
  lines.push('requirements: []')
  if (teamRequirements.length > 0) {
    lines.push('teamRequirements:')
    for (const reqLines of teamRequirements) {
      for (const line of reqLines) lines.push(`  ${line}`)
    }
  }
  lines.push(
    'teamEnvelope:',
    '  allow:',
    '    - send-message',
    '    - report-progress',
    '  deny: []',
    'memberEnvelopes:',
  )
  for (const member of members) {
    lines.push(`  - templateId: ${member.templateId}`)
    lines.push('    envelope:')
    lines.push('      allow:')
    lines.push('        - send-message')
    lines.push('        - report-progress')
    lines.push('      deny: []')
  }
  lines.push(
    'policyStates:',
    '  - id: default',
    `    description: The ${blueprintId} default state.`,
    'quotas:',
    '    team:',
    '      maxInstances: 4',
    '      maxConcurrent: 4',
    '    members:',
    '      maxInstances: 4',
    '      maxConcurrent: 4',
    'metadata: {}',
    '---',
  )
  return lines.join('\n')
}

/** The team scope PASSES (seeded skill); the `worker` TEMPLATE scope
 *  carries a REQUIRED mcpServer requirement (deterministically down). */
const DOC_STD3 = v2Doc('STD-3-BP', '1', [
  requirementLines('req-skill-base', 'skill', ['base'], true),
], [
  {
    templateId: 'worker',
    displayName: 'Worker',
    requirements: requirementLines('req-mcp-w', 'mcpServer', ['w'], true),
  },
])

// --- the row config (the host entry's ONLY input channel) ----------------------------

function rowConfig(
  rootSessionId: string,
  blueprintSource: string,
  bootPhase: 'create' | 'create-or-open' = 'create',
): Record<string, unknown> {
  return {
    bootPhase,
    rootSessionId,
    blueprintSource,
    generation: 1,
    defaultWorkspace: 'C:/agent-team/work/std',
    seedMembers: [],
    staticModel: { provider: 'std-static', model: 'std-model-v1' },
    deniedSelection: null,
    mcpServer: null,
    environmentFacts: [
      { domain: 'skill', subject: 'base', available: true, generation: 0 },
    ],
    externalPolicyFacts: { hard: {}, capabilityExists: {} },
    glueUrl: stubGlueUrl(),
    remoteMountWaitMs: 0,
  }
}

// --- the test Cordis context (the t12b1/bp1 pattern) ----------------------------------

interface TestWorld {
  ctx: TeamPluginHostContext
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double)
  readonly provided: Record<string, any>
  readonly effectDisposers: Array<() => void>
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
function makeWorld(seam: FileStorageSeam): TestWorld {
  const provided: Record<string, any> = {
    agents: { create: async () => {}, resume: async () => {} },
    sessionPersistence: { ensure: async () => {} },
    workspaceRegistry: { list: () => [], resolveByPath: async () => undefined },
    agentPresets: agentPresetsStandardDouble(),
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

/** Apply the row and settle the boot (a rejection is captured, never rethrown). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- untyped test payload
async function applyWorld(
  world: TestWorld,
  config: Record<string, unknown>,
): Promise<{
  world: TestWorld
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- untyped test payload
  readonly teamRoot: Record<string, any>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- untyped test payload
  readonly root: Record<string, any> | null
  readonly bootError: unknown
}> {
  await hostEntry.apply(world.ctx, config)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- untyped test payload
  const teamRoot: Record<string, any> = world.provided.teamRoot
  if (teamRoot === undefined) throw new Error('D guard: apply resolved but never provided teamRoot')
  const settled = await teamRoot.ready.then(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- untyped test payload
    (root: Record<string, any>) => ({ root, bootError: null }),
    (bootError: unknown) => ({ root: null, bootError }),
  )
  return { world, teamRoot, ...settled }
}

function tick(n: number): Promise<void> {
  let step = Promise.resolve()
  for (let i = 0; i < n; i++) step = step.then(() => undefined)
  return step
}

/** The typed creation-preflight refusal (or throw the test). */
function preflightRefusal(error: unknown): Record<string, unknown> {
  expect(error).toBeInstanceOf(TeamRuntimeError)
  const typed = error as TeamRuntimeError
  expect(typed.code).toBe(TEAM_RUNTIME_ERROR_CODES.COMPATIBILITY_BLOCKED)
  const details = typed.details as Record<string, unknown>
  expect(details['source']).toBe('creation-preflight')
  return details
}

/** The durable availability audit: the `template-availability-set` rows under the root. */
function availabilityRowsOf(domain: TeamDomain, rootSessionId: string): Array<{
  templateId: string
  available: boolean
}> {
  const rows: Array<{ templateId: string; available: boolean }> = []
  for (const entry of domain.repositories.ledger.list()) {
    const record = entry as {
      rootSessionId?: unknown
      factType?: unknown
      payload?: { templateId?: unknown; available?: unknown }
    }
    if (record.rootSessionId !== rootSessionId) continue
    if (record.factType !== TEMPLATE_AVAILABILITY_SET_FACT_TYPE) continue
    const payload = record.payload ?? {}
    rows.push({ templateId: String(payload.templateId), available: Boolean(payload.available) })
  }
  return rows
}

// --- the scenario: block → disable (pre-team) → re-drive proceeds → re-disable (stamped) ---
// --- S3b: a FRESH root with an explicit `available: true` fact (re-enable) still blocks ---

const dir3 = scratchDir('std-disable')
destroyDir(dir3)
const world3a = makeWorld(new FileStorageSeam(dir3))
const d3a = await applyWorld(world3a, rowConfig(ROOT3, DOC_STD3))

// The first boot create is refused (a required template requirement is
// down; the template is not disabled — no availability fact at all).
const d3Refusal = preflightRefusal(d3a.bootError)
const blockedAudit = await openTeamDomain(new FileStorageSeam(dir3))

// F7: the human DISABLES the template through the PRODUCTION writer
// (pre-team: the record does not exist yet — the pre-team put).
await d3a.teamRoot.requirementAuthority.setTemplateAvailability({
  rootSessionId: ROOT3,
  blueprintId: 'STD-3-BP',
  revision: '1',
  templateId: 'worker',
  available: false,
})
const disableAudit = await openTeamDomain(new FileStorageSeam(dir3))

// The RE-DRIVE (`create-or-open`): the stamped medium WITHOUT the team
// identity (the refused create stamped the domain and died before the
// mint — the D-1 state) adopts the stamps and RE-RUNS the create phase:
// the disabled scope is RESOLVED — the creation proceeds.
const world3b = makeWorld(new FileStorageSeam(dir3))
const d3b = await applyWorld(world3b, rowConfig(ROOT3, DOC_STD3, 'create-or-open'))
// The audit RIGHT AFTER the re-drive (before the second disable): the
// S1-A baseline for the stamped-put delta assertion below.
const postReDriveAudit = await openTeamDomain(new FileStorageSeam(dir3))

// S3a: a second identical disable — the record EXISTS now, so the fact
// goes through the STAMPED put (the S1-A advance applies: the team's
// generation moves 2 → 3, on top of the mint + boot-probe baseline).
await d3b.teamRoot.requirementAuthority.setTemplateAvailability({
  rootSessionId: ROOT3,
  blueprintId: 'STD-3-BP',
  revision: '1',
  templateId: 'worker',
  available: false,
})
const finalAudit = await openTeamDomain(new FileStorageSeam(dir3))

// S3b: a FRESH root on a fresh medium. The first create blocks (no
// facts — the baseline); the human then writes an explicit
// `available: true` fact (the RE-ENABLE) — the re-driven create must
// block AGAIN: only `available: false` resolves the blocked scope (the
// disable is the resolution mechanism, reversible; an available
// template — explicitly or by default — is evaluated and blocks).
const dir3x = scratchDir('std-reenable')
destroyDir(dir3x)
const world3x = makeWorld(new FileStorageSeam(dir3x))
const d3x1 = await applyWorld(world3x, rowConfig(ROOT3X, DOC_STD3))
const d3x1Refusal = preflightRefusal(d3x1.bootError)
await d3x1.teamRoot.requirementAuthority.setTemplateAvailability({
  rootSessionId: ROOT3X,
  blueprintId: 'STD-3-BP',
  revision: '1',
  templateId: 'worker',
  available: true,
})
const world3x2 = makeWorld(new FileStorageSeam(dir3x))
const d3x2 = await applyWorld(world3x2, rowConfig(ROOT3X, DOC_STD3, 'create-or-open'))
const d3x2Refusal = preflightRefusal(d3x2.bootError)
const reenableAudit = await openTeamDomain(new FileStorageSeam(dir3x))

// --- the teardown ----------------------------------------------------------------------

async function teardownWorlds(worlds: readonly TestWorld[], dirs: readonly string[]): Promise<void> {
  for (const world of worlds) {
    for (const dispose of world.effectDisposers) dispose()
  }
  await tick(6)
  for (const dir of dirs) destroyDir(dir)
}
await teardownWorlds([world3a, world3b, world3x, world3x2], [dir3, dir3x])

// --- the assertions (sync it() bodies) --------------------------------------------------

describe('W3-B S3 — the production template disable resolves the blocked scope (guide §6.3.3)', () => {
  it('the first boot create is refused fixOrDisable with the down template scope + requirement', () => {
    expect(d3Refusal['outcome']).toBe('fixOrDisable')
    expect(d3Refusal['blockedScopes']).toEqual(['template:worker'])
    expect(d3Refusal['fixOrDisableRequirementIds']).toEqual(['req-mcp-w'])
  })

  it('the refused bind left zero durable effect (no record, no fact, no registry row)', () => {
    expect(blockedAudit.repositories.teamSessions.get(ROOT3)).toBeUndefined()
    expect(blockedAudit.repositories.blueprintRegistry.list()).toEqual([])
    expect(availabilityRowsOf(blockedAudit, ROOT3)).toEqual([])
  })

  it('the production writer durably stamped the template-availability-set fact (pre-team put)', () => {
    expect(availabilityRowsOf(disableAudit, ROOT3)).toEqual([
      { templateId: 'worker', available: false },
    ])
    // still no record — the fact landed BEFORE the bind:
    expect(disableAudit.repositories.teamSessions.get(ROOT3)).toBeUndefined()
  })

  it('the re-driven creation proceeds (the disabled scope is RESOLVED) and the record exists', () => {
    expect(d3b.bootError).toBeNull()
    expect(d3b.root).not.toBeNull()
    expect(finalAudit.repositories.teamSessions.get(ROOT3)).toBeDefined()
    // the freeze ran (the preflight passed — the registry row exists):
    const registryRows = finalAudit.repositories.blueprintRegistry.list()
    expect(registryRows.some((row) => (row as { blueprintId?: string }).blueprintId === 'STD-3-BP')).toBe(true)
  })
})

describe('W3-B S3a — the disable is idempotent at the semantic level (and stamped once the team exists)', () => {
  it('the second identical disable appended one more fact row (latest-wins keeps the CURRENT availability false)', () => {
    // append-only ledger: two rows (pre-team disable + stamped
    // re-disable). The CURRENT (latest) availability is false — the
    // re-drive in d3b adopted the record on exactly that fact line.
    expect(availabilityRowsOf(finalAudit, ROOT3)).toEqual([
      { templateId: 'worker', available: false },
      { templateId: 'worker', available: false },
    ])
  })

  it('the second disable went through the STAMPED put (the team record exists — the S1-A advance moved the generation by EXACTLY one)', () => {
    // S1-A hook-A delta: the re-drive baseline is generation 2 (1 mint +
    // 1 boot-time compatibility-probe hook-B advance — the pre-team
    // disable advanced NOTHING, a stamped put before the record would
    // have rejected with the loud missing-key). The post-record
    // (stamped) disable appends a new ledger entry and advances the
    // stamp by exactly one: 2 → 3.
    const before = postReDriveAudit.repositories.teamSessions.get(ROOT3)?.generation
    const after = finalAudit.repositories.teamSessions.get(ROOT3)?.generation
    if (before === undefined || after === undefined) {
      throw new Error('S3b: the team-session row is missing (stamp arithmetic undefined)')
    }
    expect(before).toBe(2)
    expect(after).toBe(3)
    expect(after).toBe(before + 1)
  })
})

describe('W3-B S3b — an explicit re-enable (available: true) blocks the creation again (reversible)', () => {
  it('the fresh root blocks first (no facts — the baseline)', () => {
    expect(d3x1Refusal['outcome']).toBe('fixOrDisable')
    expect(d3x1Refusal['blockedScopes']).toEqual(['template:worker'])
  })

  it('after the explicit available:true fact, the re-driven create is refused fixOrDisable AGAIN (only false resolves)', () => {
    expect(d3x2Refusal['outcome']).toBe('fixOrDisable')
    expect(d3x2Refusal['blockedScopes']).toEqual(['template:worker'])
    expect(d3x2Refusal['fixOrDisableRequirementIds']).toEqual(['req-mcp-w'])
    expect(availabilityRowsOf(reenableAudit, ROOT3X)).toEqual([
      { templateId: 'worker', available: true },
    ])
    // still no record — the re-enable did not resolve the creation:
    expect(reenableAudit.repositories.teamSessions.get(ROOT3X)).toBeUndefined()
  })
})
