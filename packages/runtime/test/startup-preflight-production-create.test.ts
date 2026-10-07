/**
 * startup-preflight-production-create.test.ts — pre-alpha3 W3-B (review
 * fix F6, guide §6): the production CREATION preflight authority is
 * server-side enforced BEFORE the durable Team bind, with ZERO durable
 * effect on a non-`proceed` outcome.
 *
 * The guide §6.1 gap: PR-E's pure `startupPreflight()` existed but the
 * production creation path (the row boot create — the ONLY creation
 * entry the plain host-entry world drives; the remote `team.create`
 * reaches the SAME `bindFresh` choke point, pinned by
 * team-compatibility-scope) never enforced it before the durable bind.
 *
 * This file pins guide §6.3 tests 1, 2 and 4 on the REAL production
 * surface (host.apply → the row boot create → the `bindFresh` wrapper's
 * preflight over the W3-A live requirement-facts provider):
 *
 *   S1 (guide §6.3.1) — a Team-level REQUIRED requirement down (an
 *      UNCONFIGURED `mcpServer` subject is deterministically
 *      `unreachable` on the production provider — the row configures no
 *      MCP server) → the boot create is refused TYPED
 *      (`TEAM_RUNTIME_COMPATIBILITY_BLOCKED`, `source:
 *      'creation-preflight'`, `outcome: 'fatal'`) with ZERO durable
 *      effect (no TeamSession record, no blueprint-registry row — the
 *      freeze never ran — no requirement-fact row under the root).
 *   S2 (guide §6.3.2) — a MemberTemplate-level REQUIRED requirement
 *      down (a template scope of a v2 blueprint — NO instance of the
 *      template exists; the preflight checks every declared scope) →
 *      refused with `outcome: 'fixOrDisable'` + the blocked template
 *      scope key + the down requirement id, zero durable effect.
 *   S4 (guide §6.3.4) — an OPTIONAL requirement down WITHOUT a consent →
 *      refused with `outcome: 'consentRequired'` + the requirement id
 *      in `consentRequiredRequirementIds`, zero durable effect.
 *
 * World facts (deterministic, no live-state manipulation): the row
 * configures NO MCP server (`mcpServer: null` → `configuredMcpServers`
 * empty → every `mcpServer`-typed requirement is `unreachable`); the
 * seed environment facts carry `skill/base` available (the `skill` type
 * has no probe port → `unknown` → the seed resolves it).
 *
 * The plain-node vitest shim forbids async `it()` bodies: the worlds
 * boot at module load (top-level await), the `it` bodies assert
 * synchronously (the bp1-freeze-barrier / t12b1 pattern).
 *
 * @module @dsh-agent-team/runtime/test/startup-preflight-production-create
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
  OPTIONAL_REQUIREMENT_ACCEPTED_FACT_TYPE,
  TEMPLATE_AVAILABILITY_SET_FACT_TYPE,
} from '../requirements/index.js'
import { stubGlueUrl } from './p8s5a-artifacts.mjs'
import { agentPresetsStandardDouble } from './agent-presets-double.mjs'
import type { TeamBlueprint } from '../../domain/blueprint/src/index.js'

// --- the fixture identities -------------------------------------------------------

const ROOT_FATAL = 'session-spfc-fat1'
const ROOT_FIXDISABLE = 'session-spfc-fix1'
const ROOT_CONSENT = 'session-spfc-con1'

// --- the v2 blueprint builder (the closed document shape, plan §E.2) ----------------

interface DocMember {
  readonly templateId: string
  readonly displayName: string
  /** The v2 structured requirement lines (rendered at list-item level). */
  readonly requirements?: readonly string[]
}

/** One v2 structured requirement (the closed §E.2 field set). */
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
 * §7.4 carrier migration (pre-flip half): this builder assembles the closed
 * §E.2 **v2** structured-requirement document, and that version IS the subject:
 * production reads `teamRequirements` and the per-template `requirements` only
 * behind a `blueprint.schemaVersion === 2` comparison
 * (requirements/scope-requirements.ts:108, requirements/creation-preflight.ts:217,
 * admission/requirement-gate.ts:460, compatibility/blueprint.ts:81,
 * activation/provider.ts:821). Promoting the digit would not migrate this file's
 * claim, it would delete it — measured: with the document saying 3 every
 * requirement-scoping leg here goes red (the boot create stops refusing). See
 * dev/agent-workflow/evidence/a4-pr7/7-4-b2b/FINDINGS.md.
 *
 * The digit therefore stays 2 and moves onto a typed code position: §7.3's
 * narrowing of `TeamBlueprint['schemaVersion']` turns THIS line into a compile
 * error naming this file, which is where plan §7.3's delete-or-retarget is
 * decided in review — never silently. Emitted YAML bytes are unchanged.
 */
const V2_DOCUMENT_VERSION: TeamBlueprint['schemaVersion'] = 2

/**
 * Assemble one closed schema-v2 blueprint document. The v1 flat
 * `requirements` list stays `[]` (the frozen mechanism, empty in v2);
 * the structured requirements ride `teamRequirements` (team scope) and
 * the per-template `requirements` (template scopes).
 */
function v2Doc(
  blueprintId: string,
  revision: string,
  teamRequirements: readonly string[][],
  members: readonly DocMember[],
): string {
  const lines: string[] = [
    '---',
    `schemaVersion: ${V2_DOCUMENT_VERSION}`,
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
    for (const lines2 of teamRequirements) {
      for (const line of lines2) lines.push(`  ${line}`)
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

/** S1: the Team scope carries a REQUIRED mcpServer requirement (down). */
const DOC_FATAL = v2Doc('SPFC-1-BP', '1', [
  requirementLines('req-mcp-down', 'mcpServer', ['down'], true),
], [
  { templateId: 'worker', displayName: 'Worker' },
])

/** S2: the Team scope PASSES (seeded skill); the `worker` TEMPLATE scope
 *  carries a REQUIRED mcpServer requirement (down). No worker instance. */
const DOC_FIXDISABLE = v2Doc('SPFC-2-BP', '1', [
  requirementLines('req-skill-base', 'skill', ['base'], true),
], [
  {
    templateId: 'worker',
    displayName: 'Worker',
    requirements: requirementLines('req-mcp-y', 'mcpServer', ['y'], true),
  },
])

/** S4: the Team scope = a passing REQUIRED skill + a down OPTIONAL
 *  mcpServer (no consent yet). */
const DOC_CONSENT = v2Doc('SPFC-4-BP', '1', [
  requirementLines('req-skill-base', 'skill', ['base'], true),
  requirementLines('req-mcp-opt', 'mcpServer', ['opt'], false),
], [
  { templateId: 'worker', displayName: 'Worker' },
])

// --- the row config (the host entry's ONLY input channel) ----------------------------

function rowConfig(
  rootSessionId: string,
  blueprintSource: string,
): Record<string, unknown> {
  return {
    bootPhase: 'create',
    rootSessionId,
    blueprintSource,
    generation: 1,
    defaultWorkspace: 'C:/agent-team/work/spfc',
    seedMembers: [],
    staticModel: { provider: 'spfc-static', model: 'spfc-model-v1' },
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
    // pre-alpha3 W3-A (F1): the agentPresets service double (W2-A
    // fail-closed contract — service-absent worlds no longer bind).
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

/**
 * Apply the row and settle the boot. A REJECTED boot is a legitimate
 * outcome (the preflight refusal) — it is captured, never rethrown
 * (the facade stays live after the rejection: the root is assigned
 * before the boot, so the F7 writers remain reachable).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- untyped test payload
async function applyWorld(world: TestWorld, config: Record<string, unknown>): Promise<{
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- untyped test payload
  readonly teamRoot: Record<string, any>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- untyped test payload
  readonly root: Record<string, any> | null
  readonly bootError: unknown
}> {
  await hostEntry.apply(world.ctx, config)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- untyped test payload
  const teamRoot: Record<string, any> = world.provided.teamRoot
  if (teamRoot === undefined) throw new Error('S guard: apply resolved but never provided teamRoot')
  const settled = await teamRoot.ready.then(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- untyped test payload
    (root: Record<string, any>) => ({ root, bootError: null }),
    (bootError: unknown) => ({ root: null, bootError }),
  )
  return { teamRoot, ...settled }
}

/** The typed creation-preflight refusal (or throw the test). */
function preflightRefusal(error: unknown): { code: string; details: Record<string, unknown> } {
  expect(error).toBeInstanceOf(TeamRuntimeError)
  const typed = error as TeamRuntimeError
  expect(typed.code).toBe(TEAM_RUNTIME_ERROR_CODES.COMPATIBILITY_BLOCKED)
  expect(typed.details).toBeDefined()
  const details = typed.details as Record<string, unknown>
  expect(details['source']).toBe('creation-preflight')
  return { code: typed.code, details }
}

/**
 * The zero-durable-effect audit (guide §6.3.1 "create zero durable
 * effect"): the refused bind left NO TeamSession record, NO blueprint
 * registry row (the freeze is AFTER the preflight — it never ran) and
 * NO requirement-fact row under the root. The domain stamp (the
 * create-or-open adoption contract) precedes this — pre-existing
 * behavior, not a creation effect.
 */
function assertZeroDurableEffect(domain: TeamDomain, rootSessionId: string): void {
  expect(domain.repositories.teamSessions.get(rootSessionId)).toBeUndefined()
  expect(domain.repositories.blueprintRegistry.list()).toEqual([])
  for (const entry of domain.repositories.ledger.list()) {
    const record = entry as { rootSessionId?: unknown; factType?: unknown }
    if (record.rootSessionId === rootSessionId) {
      throw new Error(
        `S guard: a durable ledger row survived the refused bind (factType ${String(record.factType)})`,
      )
    }
  }
  // the compatibility-category fact vocabulary specifically:
  for (const entry of domain.repositories.ledger.list()) {
    const record = entry as { factType?: unknown }
    expect(record.factType).not.toBe(OPTIONAL_REQUIREMENT_ACCEPTED_FACT_TYPE)
    expect(record.factType).not.toBe(TEMPLATE_AVAILABILITY_SET_FACT_TYPE)
  }
}

/**
 * One microtask hop (the house `tick` chain — the shim forbids timers in
 * assertions, a module-load hop is plain promise chaining). The row-stop
 * backstop kicks its domain close off the `ready` settlement chain; the
 * hops let it settle before the scratch teardown touches the medium.
 */
function tick(n: number): Promise<void> {
  let step = Promise.resolve()
  for (let i = 0; i < n; i++) step = step.then(() => undefined)
  return step
}

/**
 * The row stays RUNNING past a rejected boot (the startup-failure
 * isolation contract — the domain closes only on the row-stop teardown),
 * so the teardown runs through the registered effect disposers.
 */
async function teardownWorld(world: TestWorld, dir: string): Promise<void> {
  for (const dispose of world.effectDisposers) dispose()
  await tick(4)
  destroyDir(dir)
}

// --- S1: Team-level required down → `fatal`, zero durable effect ----------------------

const dir1 = scratchDir('spfc-fatal')
destroyDir(dir1)
const seam1 = new FileStorageSeam(dir1)
const world1 = makeWorld(seam1)
const s1 = await applyWorld(world1, rowConfig(ROOT_FATAL, DOC_FATAL))
const audit1 = await openTeamDomain(new FileStorageSeam(dir1))
await teardownWorld(world1, dir1)

// --- S2: MemberTemplate required down → `fixOrDisable`, zero durable effect -----------

const dir2 = scratchDir('spfc-fixdisable')
destroyDir(dir2)
const seam2 = new FileStorageSeam(dir2)
const world2 = makeWorld(seam2)
const s2 = await applyWorld(world2, rowConfig(ROOT_FIXDISABLE, DOC_FIXDISABLE))
const audit2 = await openTeamDomain(new FileStorageSeam(dir2))
await teardownWorld(world2, dir2)

// --- S4: optional down, no consent → `consentRequired`, zero durable effect -----------

const dir4 = scratchDir('spfc-consent')
destroyDir(dir4)
const seam4 = new FileStorageSeam(dir4)
const world4 = makeWorld(seam4)
const s4 = await applyWorld(world4, rowConfig(ROOT_CONSENT, DOC_CONSENT))
const audit4 = await openTeamDomain(new FileStorageSeam(dir4))
await teardownWorld(world4, dir4)

// --- the assertions (sync it() bodies) --------------------------------------------------

describe('W3-B S1 — Team-level required down: the creation preflight refuses typed (guide §6.3.1)', () => {
  it('the boot create rejects with the typed creation-preflight refusal (outcome fatal)', () => {
    const { details } = preflightRefusal(s1.bootError)
    expect(details['outcome']).toBe('fatal')
    expect(details['rootSessionId']).toBe(ROOT_FATAL)
    expect(details['blockedScopes']).toEqual(['team'])
    expect(details['fatalRequirementIds']).toEqual(['req-mcp-down'])
    expect(details['consentRequiredRequirementIds']).toEqual([])
    expect(details['fixOrDisableRequirementIds']).toEqual([])
  })

  it('zero durable effect: no TeamSession record, no registry row, no fact row', () => {
    assertZeroDurableEffect(audit1, ROOT_FATAL)
  })
})

describe('W3-B S2 — MemberTemplate required down (no instance): `fixOrDisable` (guide §6.3.2)', () => {
  it('the boot create rejects typed with the blocked template scope + the down requirement', () => {
    const { details } = preflightRefusal(s2.bootError)
    expect(details['outcome']).toBe('fixOrDisable')
    expect(details['rootSessionId']).toBe(ROOT_FIXDISABLE)
    // the TEMPLATE scope is blocked (the team scope passed on the seed);
    // the scope key is the closed `template:<id>` form.
    expect(details['blockedScopes']).toEqual(['template:worker'])
    expect(details['fixOrDisableRequirementIds']).toEqual(['req-mcp-y'])
    expect(details['fatalRequirementIds']).toEqual([])
    expect(details['consentRequiredRequirementIds']).toEqual([])
  })

  it('zero durable effect: the refused bind wrote nothing under the root', () => {
    assertZeroDurableEffect(audit2, ROOT_FIXDISABLE)
  })
})

describe('W3-B S4 — optional down without consent: `consentRequired` (guide §6.3.4)', () => {
  it('the boot create rejects typed with the consent-required requirement id', () => {
    const { details } = preflightRefusal(s4.bootError)
    expect(details['outcome']).toBe('consentRequired')
    expect(details['rootSessionId']).toBe(ROOT_CONSENT)
    // the team scope is DEGRADED (not blocked) — no blocked scope:
    expect(details['blockedScopes']).toEqual([])
    expect(details['consentRequiredRequirementIds']).toEqual(['req-mcp-opt'])
    expect(details['fatalRequirementIds']).toEqual([])
    expect(details['fixOrDisableRequirementIds']).toEqual([])
  })

  it('zero durable effect: the refused bind wrote nothing under the root', () => {
    assertZeroDurableEffect(audit4, ROOT_CONSENT)
  })
})
