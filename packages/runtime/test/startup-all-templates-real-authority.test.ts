/**
 * startup-all-templates-real-authority.test.ts — pre-alpha3 W3-B (review
 * fix F6, guide §6): the creation preflight checks EVERY declared
 * template scope of the bound blueprint — NOT just the scopes of
 * seeded/instantiated members. Guide R9 (verbatim): "未使用 specialist
 * template 的 required MCP down：`team.create` → `fix-or-disable`，证明
 * all-template preflight 真正在 server authority."
 *
 * This file pins guide §6.3 test 6: a v2 blueprint with TWO member
 * templates — `wpass` (its required requirement passes on the seed)
 * and `wdown` (its required `mcpServer` subject is deterministically
 * unreachable — the row configures NO MCP server) — with NO instances of
 * either template (a fresh create, `seedMembers: []`). The boot create
 * MUST be refused `fixOrDisable` naming the `wdown` scope alone (the
 * team scope and the `wpass` scope pass), proving the all-template
 * check is REAL SERVER authority, not an artifact of member seeding.
 * The scenario then resolves through the production disable writer and
 * re-drives (the `wdown` scope is RESOLVED — the creation proceeds).
 *
 * World facts (deterministic): `mcpServer: null` → every `mcpServer`
 * subject is deterministically `unreachable`; the seed facts carry
 * `skill/base` available (both the team scope and the `wpass` template
 * scope require it — the same (domain, subject) pair in two scopes is
 * legal; each scope feeds its OWN requirement inputs).
 *
 * The plain-node vitest shim forbids async `it()` bodies: the worlds
 * boot at module load (top-level await), the `it` bodies assert
 * synchronously (the bp1-freeze-barrier pattern).
 *
 * @module @dsh-agent-team/runtime/test/startup-all-templates-real-authority
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
import type { TeamBlueprint } from '../../domain/blueprint/src/index.js'

// --- the fixture identities -------------------------------------------------------

const ROOT6 = 'session-sa-r6'

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

/**
 * The document version this fixture declares, and why it is 3 now.
 *
 * §7.4 (lane B-runtime-semantics-A) deliberately LEFT this digit at 2 and put
 * it on a typed code position, because at that SHA the §E.2 structured-
 * requirement grammar was read by production only behind
 * `blueprint.schemaVersion === 2` (requirements/scope-requirements.ts,
 * requirements/creation-preflight.ts, admission/requirement-gate.ts,
 * compatibility/blueprint.ts, activation/provider.ts). Their recorded trial —
 * "promoting the digit reddens N of this file's tests" — was a true measurement
 * of that tree, and §7.3 option A (3b253775, PR #161) consumed it: the five
 * comparisons are gone and the grammar is now a property of the blueprint SHAPE,
 * not of its version digit.
 *
 * So the flip is a no-op for this file's CLAIM, and that was re-measured here
 * rather than assumed: at schemaVersion 3 plus the two authority documents v3
 * requires (below), this file is fully green — the same legs, asserting the same
 * facts. §7.3's narrowing of `TeamBlueprint['schemaVersion']` is what forces the
 * digit to move in the same commit as the cutover instead of drifting.
 */
const DECLARED_DOCUMENT_VERSION: TeamBlueprint['schemaVersion'] = 3

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
    `schemaVersion: ${DECLARED_DOCUMENT_VERSION}`,
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
      // §7.3 v3-only: the two authority documents version 3 REQUIRES, at the honest
    // zero `rules: []`. No test in this file mutates permissions, so nothing here
    // asks to expand; a filler rule would write a wide grant into a fixture that no
    // test would notice (ADR §5.1 forbids the implicit ceiling just as much).
  'permissionMutationEnvelope:',
  '  rules: []',
  'teamHardEnvelope:',
  '  rules: []',
  'metadata: {}',
    '---',
  )
  return lines.join('\n')
}

/** R9: TWO member templates, NO instances. `wpass`'s required skill
 *  passes (seeded); `wdown`'s required mcpServer is deterministically
 *  unreachable. Both scopes are declared — neither is instantiated. */
const DOC_SA6 = v2Doc('SA-6-BP', '1', [
  requirementLines('req-skill-base', 'skill', ['base'], true),
], [
  {
    templateId: 'wpass',
    displayName: 'Passing Worker',
    requirements: requirementLines('req-wpass-skill', 'skill', ['base'], true),
  },
  {
    templateId: 'wdown',
    displayName: 'Down Worker',
    requirements: requirementLines('req-wdown-mcp', 'mcpServer', ['w'], true),
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
    defaultWorkspace: 'C:/agent-team/work/sa',
    seedMembers: [],
    staticModel: { provider: 'sa-static', model: 'sa-model-v1' },
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
  if (teamRoot === undefined) throw new Error('A guard: apply resolved but never provided teamRoot')
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

// --- the scenario: all-template block (no instances) → disable → proceed --------------

const dir6 = scratchDir('sa-alltemplates')
destroyDir(dir6)
const world6a = makeWorld(new FileStorageSeam(dir6))
const a6a = await applyWorld(world6a, rowConfig(ROOT6, DOC_SA6))
const a6Refusal = preflightRefusal(a6a.bootError)
const blockedAudit = await openTeamDomain(new FileStorageSeam(dir6))

// The R9 resolution: disable the down template (no instance of it
// exists — the disable is a BLUEPRINT-scope decision, not an
// instance-scoped one).
await a6a.teamRoot.requirementAuthority.setTemplateAvailability({
  rootSessionId: ROOT6,
  blueprintId: 'SA-6-BP',
  revision: '1',
  templateId: 'wdown',
  available: false,
})

// The RE-DRIVE (`create-or-open`): the stamped medium WITHOUT the team
// identity (the D-1 state after the refused create) re-runs the create
// phase — only the `wdown` scope is resolved — the creation proceeds.
const world6b = makeWorld(new FileStorageSeam(dir6))
const a6b = await applyWorld(world6b, rowConfig(ROOT6, DOC_SA6, 'create-or-open'))
const proceedAudit = await openTeamDomain(new FileStorageSeam(dir6))

// --- the teardown ----------------------------------------------------------------------

async function teardownWorlds(worlds: readonly TestWorld[], dirs: readonly string[]): Promise<void> {
  for (const world of worlds) {
    for (const dispose of world.effectDisposers) dispose()
  }
  await tick(6)
  for (const dir of dirs) destroyDir(dir)
}
await teardownWorlds([world6a, world6b], [dir6])

// --- the assertions (sync it() bodies) --------------------------------------------------

describe('W3-B S6 — the all-template preflight is real server authority (guide §6.3.6, R9)', () => {
  it('the fresh create (NO instances of either template) is refused fixOrDisable naming the wdown scope ALONE', () => {
    expect(a6Refusal['outcome']).toBe('fixOrDisable')
    // the team scope passed (seeded skill) and the `wpass` template
    // scope passed (its required skill is the seeded one) — ONLY the
    // uninstantiated `wdown` template's required MCP is down:
    expect(a6Refusal['blockedScopes']).toEqual(['template:wdown'])
    expect(a6Refusal['fixOrDisableRequirementIds']).toEqual(['req-wdown-mcp'])
    expect(a6Refusal['fatalRequirementIds']).toEqual([])
    expect(a6Refusal['consentRequiredRequirementIds']).toEqual([])
  })

  it('the refused bind left zero durable effect (no record, no fact row, no registry row)', () => {
    expect(blockedAudit.repositories.teamSessions.get(ROOT6)).toBeUndefined()
    expect(blockedAudit.repositories.blueprintRegistry.list()).toEqual([])
    expect(availabilityRowsOf(blockedAudit, ROOT6)).toEqual([])
  })

  it('the production disable (no instance exists) durably resolves the scope and the re-drive proceeds', () => {
    expect(a6b.bootError).toBeNull()
    expect(a6b.root).not.toBeNull()
    expect(availabilityRowsOf(proceedAudit, ROOT6)).toEqual([
      { templateId: 'wdown', available: false },
    ])
    const record = proceedAudit.repositories.teamSessions.get(ROOT6)
    expect(record).toBeDefined()
    expect(record?.blueprint.blueprintId).toBe('SA-6-BP')
    // S1-A stamp arithmetic: generation 2 = 1 (the mint) + 1 (the
    // boot-time compatibility probe's hook-B replaceState advance).
    // The pre-TEAM disable put advanced NOTHING (a stamped put before
    // the record existed would have rejected with the loud missing-key).
    expect(record?.generation).toBe(2)
  })
})
