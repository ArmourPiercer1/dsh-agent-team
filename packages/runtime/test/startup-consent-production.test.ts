/**
 * startup-consent-production.test.ts — pre-alpha3 W3-B (review fixes F6
 * + F7, guide §6): the durable degradation-CONSENT is a PRODUCTION
 * writer (`requirementAuthority.grantDegradationConsent`), and a
 * consented creation is admitted on the RE-DRIVE — the consent persists
 * across restarts, and a consent is NEVER inherited across a different
 * root (invariant 10: a different blueprint identity means a different
 * root session; consents are keyed by rootSessionId, full stop).
 *
 * The F7 gap: PR-E's consent model (the `optional-requirement-accepted`
 * durable fact) had NO production writer — the only way a consent could
 * exist was test-seam injection. This file pins guide §6.3 tests 5, 7
 * and 8 on the REAL production surface:
 *
 *   S5 (guide §6.3.5) — an OPTIONAL requirement down, no consent → the
 *      boot create is refused (`consentRequired`) → the human grants
 *      the consent through the facade's `requirementAuthority`
 *      (reachable AFTER the boot rejection — the root is assigned
 *      before the boot) → the RE-DRIVEN creation proceeds (the consent
 *      is read from the durable ledger by the preflight).
 *   S7 (guide §6.3.7) — the consent SURVIVES A RESTART: a third
 *      apply (same seam, create phase) re-runs the preflight against
 *      the durable consent and adopts the existing record without a
 *      re-mint (create-or-open).
 *   S8 (guide §6.3.8, invariant 10) — a consent granted for root R1
 *      under blueprint B3 rev1 is NOT honored for a NEW root R2
 *      binding B3 rev2 (same requirement ids, different content
 *      hash): the remote `team.create` of R2 is refused
 *      `consentRequired` with zero durable effect (the consent is
 *      read under R2's rootSessionId — none exists there).
 *
 * World facts (deterministic): `mcpServer: null` → every `mcpServer`
 * subject is deterministically `unreachable`; the seed facts carry
 * `skill/base` available.
 *
 * The plain-node vitest shim forbids async `it()` bodies: the worlds
 * boot at module load (top-level await), the `it` bodies assert
 * synchronously (the bp1-freeze-barrier pattern).
 *
 * @module @dsh-agent-team/runtime/test/startup-consent-production
 */
import { describe, expect, it } from 'vitest'
import {
  destroyDir,
  FileStorageSeam,
  scratchDir,
  writeText,
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
} from '../requirements/index.js'
import { stubGlueUrl } from './p8s5a-artifacts.mjs'
import { agentPresetsStandardDouble } from './agent-presets-double.mjs'

// --- the fixture identities -------------------------------------------------------

const ROOT5 = 'session-scp-r5'
const ROOT8 = 'session-scp-r8'
const ROOT8_CHILD = 'session-scp-r8c'

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
  members: ReadonlyArray<{ templateId: string; displayName: string }>,
  leaderPersona: string,
  description: string,
): string {
  const lines: string[] = [
    '---',
    'schemaVersion: 2',
    `blueprintId: ${blueprintId}`,
    `revision: "${revision}"`,
    `description: ${description}`,
    'leader:',
    '  templateId: leader',
    `  persona: ${leaderPersona}`,
    'members:',
  ]
  for (const member of members) {
    lines.push(`  - templateId: ${member.templateId}`)
    lines.push(`    displayName: ${member.displayName}`)
    lines.push(`    persona: You do the ${member.templateId} work.`)
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

/** The S5/S8 team scope: a passing REQUIRED skill + a down OPTIONAL
 *  mcpServer (the consent-target). */
const TEAM_REQS = [
  requirementLines('req-skill-base', 'skill', ['base'], true),
  requirementLines('req-mcp-opt', 'mcpServer', ['opt'], false),
]

/** S5: the row anchor. */
const DOC_SCP5 = v2Doc(
  'SCP-5-BP',
  '1',
  TEAM_REQS,
  [{ templateId: 'worker', displayName: 'Worker' }],
  'You lead the SCP-5 team.',
  'The consent-production scenario team.',
)

/** S8: B3 rev1 = the row anchor; rev2 (a SAVED SOURCE in the
 *  blueprintDir) carries the SAME requirement ids but different
 *  content (different persona + description → different content
 *  hash — the drift the non-inheritance invariant guards). */
const DOC_B3_REV1 = v2Doc(
  'SCP-8-BP',
  '1',
  TEAM_REQS,
  [{ templateId: 'worker', displayName: 'Worker' }],
  'You lead the SCP-8 team, first revision.',
  'The non-inheritance scenario team, revision 1.',
)
const DOC_B3_REV2 = v2Doc(
  'SCP-8-BP',
  '2',
  TEAM_REQS,
  [{ templateId: 'worker', displayName: 'Worker' }],
  'You lead the SCP-8 team, second revision.',
  'The non-inheritance scenario team, revision 2.',
)

// --- the row config (the host entry's ONLY input channel) ----------------------------

function rowConfig(
  rootSessionId: string,
  blueprintSource: string,
  blueprintDir?: string,
  bootPhase: 'create' | 'create-or-open' = 'create',
): Record<string, unknown> {
  return {
    bootPhase,
    rootSessionId,
    blueprintSource,
    generation: 1,
    defaultWorkspace: 'C:/agent-team/work/scp',
    seedMembers: [],
    staticModel: { provider: 'scp-static', model: 'scp-model-v1' },
    deniedSelection: null,
    mcpServer: null,
    environmentFacts: [
      { domain: 'skill', subject: 'base', available: true, generation: 0 },
    ],
    externalPolicyFacts: { hard: {}, capabilityExists: {} },
    glueUrl: stubGlueUrl(),
    remoteMountWaitMs: 0,
    ...(blueprintDir !== undefined ? { blueprintDir } : {}),
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
  if (teamRoot === undefined) throw new Error('C guard: apply resolved but never provided teamRoot')
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

/**
 * The durable consent audit: the `optional-requirement-accepted` rows
 * under the root (the append-only ledger — one row per grant).
 */
function consentRowsOf(
  domain: TeamDomain,
  rootSessionId: string,
): Array<{ requirementId: string; generation: number; consentedBy: string }> {
  const rows: Array<{ requirementId: string; generation: number; consentedBy: string }> = []
  for (const entry of domain.repositories.ledger.list()) {
    const record = entry as {
      rootSessionId?: unknown
      factType?: unknown
      payload?: { requirementId?: unknown; generation?: unknown; consentedBy?: unknown }
    }
    if (record.rootSessionId !== rootSessionId) continue
    if (record.factType !== OPTIONAL_REQUIREMENT_ACCEPTED_FACT_TYPE) continue
    const payload = record.payload ?? {}
    rows.push({
      requirementId: String(payload.requirementId),
      generation: Number(payload.generation),
      consentedBy: String(payload.consentedBy),
    })
  }
  return rows
}

/** The remote wire call (the C3 pattern — the captured dispatcher). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic wire payload, untyped by design
type WireResponse = Record<string, any>
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
function makeRemoteCaller(
  root: Record<string, any>,
): (endpoint: string, params: Record<string, unknown>) => Promise<WireResponse> {
  const registration = root.seams.remoteHandlerRegistration.current()
  let capturedDispatcher: ((endpoint: string, payload: unknown) => Promise<WireResponse>) | null = null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
  registration({
    rpc: {
      handle: (_channel: string, dispatcher: unknown) => {
        capturedDispatcher = dispatcher as (endpoint: string, payload: unknown) => Promise<WireResponse>
        return () => {}
      },
    },
  })
  if (capturedDispatcher === null) throw new Error('C guard: registration never registered a dispatcher')
  // The assignment happens inside the registration closure (CFA does not
  // track it), so re-annotate to the callable type the guard just proved.
  const dispatcher = capturedDispatcher as (endpoint: string, payload: unknown) => Promise<WireResponse>
  return (endpoint, params) => dispatcher(endpoint, { version: 1, params })
}

/**
 * The row stays RUNNING past a rejected boot (the startup-failure
 * isolation contract — the domain closes only on the row-stop teardown),
 * so the teardown runs through the registered effect disposers, then
 * lets the kicked-off domain close settle before the scratch teardown.
 */
async function teardownWorlds(worlds: readonly TestWorld[], dirs: readonly string[]): Promise<void> {
  for (const world of worlds) {
    for (const dispose of world.effectDisposers) dispose()
  }
  await tick(6)
  for (const dir of dirs) destroyDir(dir)
}

// --- S5: consent → the re-driven creation proceeds; S7: it survives a restart ---------

const dir5 = scratchDir('scp-consent')
destroyDir(dir5)
const world5a = makeWorld(new FileStorageSeam(dir5))
const c5a = await applyWorld(world5a, rowConfig(ROOT5, DOC_SCP5))

// The first boot create is refused (optional down, no consent).
const s5Refusal = preflightRefusal(c5a.bootError)

// F7: the human grants the durable consent through the PRODUCTION
// writer — the facade stays live past the boot rejection (the root is
// assigned before the boot; the row keeps running).
await c5a.teamRoot.requirementAuthority.grantDegradationConsent({
  rootSessionId: ROOT5,
  blueprintId: 'SCP-5-BP',
  revision: '1',
  requirementId: 'req-mcp-opt',
  generation: 1,
  consentedBy: ROOT5,
})
const consentAudit1 = await openTeamDomain(new FileStorageSeam(dir5))

// The RE-DRIVE: a new world on the same seam, `create-or-open` — the
// stamped medium WITHOUT the team identity (the refused create stamped
// the domain and died before the mint — the D-1 state) adopts the
// stamps and RE-RUNS the create phase: the preflight reads the durable
// consent and proceeds.
const world5b = makeWorld(new FileStorageSeam(dir5))
const c5b = await applyWorld(world5b, rowConfig(ROOT5, DOC_SCP5, undefined, 'create-or-open'))

// S7: the RESTART — a third apply (create-or-open) over the NOW-CREATED
// team: the durable record exists → the phase RESOLVES TO `resume`
// (load-only, never re-mints) — the restart adopts the same identity.
const world5c = makeWorld(new FileStorageSeam(dir5))
const c5c = await applyWorld(world5c, rowConfig(ROOT5, DOC_SCP5, undefined, 'create-or-open'))
const consentAudit2 = await openTeamDomain(new FileStorageSeam(dir5))

// --- S8: the consent is NOT inherited across a new root / new revision ----------------

const dir8 = scratchDir('scp-noinherit')
destroyDir(dir8)
const sourcesDir8 = scratchDir('scp-noinherit-bp')
destroyDir(sourcesDir8)
writeText(`${sourcesDir8}/scp8-rev2.yaml`, DOC_B3_REV2)
const world8a = makeWorld(new FileStorageSeam(dir8))
const i8a = await applyWorld(world8a, rowConfig(ROOT8, DOC_B3_REV1, sourcesDir8))
const i8Refusal = preflightRefusal(i8a.bootError)
await i8a.teamRoot.requirementAuthority.grantDegradationConsent({
  rootSessionId: ROOT8,
  blueprintId: 'SCP-8-BP',
  revision: '1',
  requirementId: 'req-mcp-opt',
  generation: 1,
  consentedBy: ROOT8,
})
const world8b = makeWorld(new FileStorageSeam(dir8))
const i8b = await applyWorld(world8b, rowConfig(ROOT8, DOC_B3_REV1, sourcesDir8, 'create-or-open'))
if (i8b.root === null) throw new Error('C guard: the rev1 re-drive did not proceed')
const i8CreateChild = await makeRemoteCaller(i8b.root)(
  'team.create',
  {
    rootSessionId: ROOT8_CHILD,
    blueprintId: 'SCP-8-BP',
    blueprintRevision: 2,
  },
)
const noinheritAudit = await openTeamDomain(new FileStorageSeam(dir8))

// --- the teardown ----------------------------------------------------------------------

await teardownWorlds([world5a, world5b, world5c, world8a, world8b], [dir5, dir8, sourcesDir8])

// --- the assertions (sync it() bodies) --------------------------------------------------

describe('W3-B S5 — the production consent grant admits the re-driven creation (guide §6.3.5)', () => {
  it('the first boot create is refused consentRequired (the F7 precondition)', () => {
    expect(s5Refusal['outcome']).toBe('consentRequired')
    expect(s5Refusal['consentRequiredRequirementIds']).toEqual(['req-mcp-opt'])
  })

  it('the consent writer durably stamped the optional-requirement-accepted fact', () => {
    expect(consentRowsOf(consentAudit1, ROOT5)).toEqual([
      { requirementId: 'req-mcp-opt', generation: 1, consentedBy: ROOT5 },
    ])
  })

  it('the re-driven creation proceeds and the team record exists (the anchor blueprint; the pre-team consent advanced no stamp)', () => {
    expect(c5b.bootError).toBeNull()
    expect(c5b.root).not.toBeNull()
    const record = consentAudit2.repositories.teamSessions.get(ROOT5)
    expect(record).toBeDefined()
    expect(record?.blueprint.blueprintId).toBe('SCP-5-BP')
    expect(String(record?.blueprint.revision)).toBe('1')
    // S1-A stamp arithmetic: generation 2 = 1 (the mint) + 1 (the
    // boot-time compatibility probe's hook-B replaceState advance).
    // The pre-TEAM consent put advanced NOTHING — a stamped `put`
    // before the record existed would have rejected with the loud
    // missing-key SEAM_FAILURE, and a silent advance would land the
    // record at 3.
    expect(record?.generation).toBe(2)
  })
})

describe('W3-B S7 — the consent survives a restart (guide §6.3.7)', () => {
  it('the durable consent written by the FIRST run admitted the RE-DRIVEN run (across a process boundary)', () => {
    // the consent fact was written by world5a BEFORE any team record
    // existed; the re-driven world5b (a fresh row run on the same seam)
    // read it from the durable ledger and proceeded — restart
    // persistence across the refuse→consent→re-drive boundary:
    expect(c5b.bootError).toBeNull()
    expect(c5b.root).not.toBeNull()
  })

  it('a later restart (create-or-open over the created team) resolves to resume: load-only, exactly one record (no re-mint)', () => {
    expect(c5c.bootError).toBeNull()
    expect(c5c.root).not.toBeNull()
    // exactly ONE durable record under the root (the adoption, not a second mint):
    const rows = consentAudit2.repositories.teamSessions
      .list()
      .filter((row) => (row as { rootSessionId?: unknown }).rootSessionId === ROOT5)
    expect(rows).toHaveLength(1)
  })
})

describe('W3-B S8 — a consent is never inherited across a new root / new revision (guide §6.3.8, invariant 10)', () => {
  it('the rev1 creation (root R1) proceeded after its OWN consent', () => {
    expect(i8Refusal['outcome']).toBe('consentRequired')
    expect(noinheritAudit.repositories.teamSessions.get(ROOT8)).toBeDefined()
  })

  it('the rev2 creation under a NEW root R2 is refused consentRequired (the R1 consent is not read for R2)', () => {
    expect(i8CreateChild.ok).toBe(false)
    const error = i8CreateChild.error as {
      code: string
      details?: { cause?: { details?: Record<string, unknown> } }
    }
    expect(error.code).toBe('TEAM_RUNTIME_COMPATIBILITY_BLOCKED')
    const causeDetails = error.details?.cause?.details as Record<string, unknown>
    expect(causeDetails['source']).toBe('creation-preflight')
    expect(causeDetails['outcome']).toBe('consentRequired')
    expect(causeDetails['consentRequiredRequirementIds']).toContain('req-mcp-opt')
  })

  it('the refused rev2 creation left zero durable effect under R2', () => {
    expect(noinheritAudit.repositories.teamSessions.get(ROOT8_CHILD)).toBeUndefined()
    for (const entry of noinheritAudit.repositories.ledger.list()) {
      const record = entry as { rootSessionId?: unknown }
      expect(record.rootSessionId).not.toBe(ROOT8_CHILD)
    }
    expect(consentRowsOf(noinheritAudit, ROOT8_CHILD)).toEqual([])
  })
})
