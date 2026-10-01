/**
 * consent-scope-hash-binding.test.ts — finding J (P2) regression: startup
 * consent loses its scope / blueprint-hash binding.
 *
 * The defect: the consent match keyed on the requirementId ALONE
 * (`startupPreflight` flattens the scope verdicts and matches `consent.requirementId`
 * against the flat warning set; `grantDegradationConsent` flattens the
 * per-scope verdicts before validation; the durable fact carries no
 * scope/hash). The pre-alpha3 ADR (ADR-12) is explicit: the consent key is
 * the IMMUTABLE Blueprint scope/hash — the consent binds to the EXACT
 * scope + blueprint content hash it was granted for; a different scope or a
 * different hash means NOT consented.
 *
 * Two consequences are pinned here through the REAL production chain (the
 * host entry → the server-side creation preflight `runCreationPreflight` /
 * `startupPreflight` → the production consent writer
 * `requirementAuthority.grantDegradationConsent` → the re-driven create —
 * no handcrafted facts):
 *
 *   J1 (CROSS-SCOPE) — the SAME optional requirementId is declared in the
 *      TEAM scope (an `mcpServer` subject `opt-a`) and in a MEMBER TEMPLATE
 *      scope (a DIFFERENT `mcpServer` subject `opt-b`) — legal: the v2
 *      validator guarantees uniqueness WITHIN each list only. A consent
 *      granted for the TEAM scope must NOT cover the template scope's
 *      same-id requirement: the re-drive stays `consentRequired` for the
 *      worker scope until the worker scope is consented SEPARATELY.
 *   J2 (STALE BLUEPRINT, SAME ROOT) — the pre-team window: the first create
 *      (rev1) is refused `consentRequired`; the human grants the consent
 *      (stamped against rev1's content hash); the blueprint source changes
 *      on the SAME root (rev2 — same requirement ids, different content →
 *      different content hash) BEFORE the team record is minted; the
 *      re-drive against rev2 must NOT inherit the rev1 consent — it stays
 *      `consentRequired`. Re-consenting against rev2 then admits.
 *
 * Migration behavior (disclosed): durable consent rows written WITHOUT the
 * scope/hash key (the pre-fix shape) are FAIL-CLOSED — a keyed evaluation
 * never treats an unkeyed legacy row as consented; the human re-grants.
 *
 * The plain-node vitest shim forbids async `it()` bodies: the worlds boot
 * at module load (top-level await), the `it` bodies assert synchronously
 * (the bp1-freeze-barrier pattern).
 *
 * @module @dsh-agent-team/runtime/test/consent-scope-hash-binding
 */
import { describe, expect, it } from 'vitest'
import {
  destroyDir,
  FileStorageSeam,
  scratchDir,
  writeText,
} from '../../testkit/fault-injection/file-seam.mjs'
import { openTeamDomain, type TeamDomain } from '../../storage/repositories/index.js'
import { parseBlueprint } from '../../domain/blueprint/src/index.js'
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

const ROOT_J1 = 'session-fndj-r1'
const ROOT_J2 = 'session-fndj-r2'

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
    requirements?: readonly string[][]
  }>,
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
    if (member.requirements !== undefined) {
      lines.push('    requirements:')
      for (const reqLines of member.requirements) {
        for (const line of reqLines) lines.push(`      ${line}`)
      }
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

// --- J1: the SAME optional reqID in the TEAM scope AND the WORKER scope -------------
// (legal: the v2 validator guarantees uniqueness WITHIN each list only; the
// two scopes carry DIFFERENT capabilities — the team needs `opt-a`, the
// worker needs `opt-b`; both are deterministically down: `mcpServer: null`).

const TEAM_REQS_J1 = [
  requirementLines('req-skill-base', 'skill', ['base'], true),
  requirementLines('req-opt', 'mcpServer', ['opt-a'], false),
]
const WORKER_REQS_J1 = [requirementLines('req-opt', 'mcpServer', ['opt-b'], false)]
const DOC_J1 = v2Doc(
  'JND-1-BP',
  '1',
  TEAM_REQS_J1,
  [{ templateId: 'worker', displayName: 'Worker', requirements: WORKER_REQS_J1 }],
  'You lead the J1 team.',
  'The cross-scope consent scenario team.',
)

// --- J2: rev1 / rev2 — the SAME requirement ids, DIFFERENT content (hash) -----------

const TEAM_REQS_J2 = [
  requirementLines('req-skill-base', 'skill', ['base'], true),
  requirementLines('req-opt', 'mcpServer', ['opt'], false),
]
const DOC_J2_REV1 = v2Doc(
  'JND-2-BP',
  '1',
  TEAM_REQS_J2,
  [{ templateId: 'worker', displayName: 'Worker' }],
  'You lead the J2 team, first revision.',
  'The stale-hash scenario team, revision 1.',
)
const DOC_J2_REV2 = v2Doc(
  'JND-2-BP',
  '2',
  TEAM_REQS_J2,
  [{ templateId: 'worker', displayName: 'Worker' }],
  'You lead the J2 team, second revision.',
  'The stale-hash scenario team, revision 2.',
)

const HASH_J1 = parseBlueprint(DOC_J1).contentHash
const HASH_J2_REV1 = parseBlueprint(DOC_J2_REV1).contentHash
const HASH_J2_REV2 = parseBlueprint(DOC_J2_REV2).contentHash

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
    defaultWorkspace: 'C:/agent-team/work/fndj',
    seedMembers: [],
    staticModel: { provider: 'fndj-static', model: 'fndj-model-v1' },
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

function makeWorld(seam: FileStorageSeam): TestWorld {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
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

/** The typed creation-preflight refusal details (asserts the typed shape). */
function preflightRefusal(error: unknown): Record<string, unknown> {
  expect(error).toBeInstanceOf(TeamRuntimeError)
  const typed = error as TeamRuntimeError
  expect(typed.code).toBe(TEAM_RUNTIME_ERROR_CODES.COMPATIBILITY_BLOCKED)
  const details = typed.details as Record<string, unknown>
  expect(details['source']).toBe('creation-preflight')
  return details
}

/**
 * The durable consent audit: the `optional-requirement-accepted` rows under
 * the root (append-only — one row per grant), INCLUDING the scope/hash key
 * fields (ABSENT on legacy pre-fix rows → `undefined`).
 */
function consentRowsOf(
  domain: TeamDomain,
  rootSessionId: string,
): Array<{
  requirementId: string
  generation: number
  consentedBy: string
  scopeKey: string | undefined
  contentHash: string | undefined
}> {
  const rows: Array<{
    requirementId: string
    generation: number
    consentedBy: string
    scopeKey: string | undefined
    contentHash: string | undefined
  }> = []
  for (const entry of domain.repositories.ledger.list()) {
    const record = entry as {
      rootSessionId?: unknown
      factType?: unknown
      payload?: {
        requirementId?: unknown
        generation?: unknown
        consentedBy?: unknown
        scopeKey?: unknown
        contentHash?: unknown
      }
    }
    if (record.rootSessionId !== rootSessionId) continue
    if (record.factType !== OPTIONAL_REQUIREMENT_ACCEPTED_FACT_TYPE) continue
    const payload = record.payload ?? {}
    rows.push({
      requirementId: String(payload.requirementId),
      generation: Number(payload.generation),
      consentedBy: String(payload.consentedBy),
      scopeKey: payload.scopeKey !== undefined ? String(payload.scopeKey) : undefined,
      contentHash: payload.contentHash !== undefined ? String(payload.contentHash) : undefined,
    })
  }
  return rows
}

/** The production consent grant (captured — a typed refusal must not kill the arc). */
async function grantOf(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- untyped test payload
  teamRoot: Record<string, any>,
  input: Record<string, unknown>,
): Promise<{ ok: true } | { ok: false; error: unknown }> {
  try {
    await teamRoot.requirementAuthority.grantDegradationConsent(input)
    return { ok: true }
  } catch (error) {
    return { ok: false, error }
  }
}

/** The row stays RUNNING past a rejected boot; the teardown runs the effect
 *  disposers, settles the kicked-off domain close, then the scratch teardown. */
async function teardownWorlds(worlds: readonly TestWorld[], dirs: readonly string[]): Promise<void> {
  for (const world of worlds) {
    for (const dispose of world.effectDisposers) dispose()
  }
  await tick(6)
  for (const dir of dirs) destroyDir(dir)
}

// --- J1 arc: cross-scope — one consent per SCOPE (same reqID, different capability) ---

const dir1 = scratchDir('fndj-cross-scope')
destroyDir(dir1)
const world1a = makeWorld(new FileStorageSeam(dir1))
const j1a = await applyWorld(world1a, rowConfig(ROOT_J1, DOC_J1))
// Precondition: the create is refused (two unconsented warnings — the same
// reqID in two scopes).
const j1Refusal = preflightRefusal(j1a.bootError)

// The human consents the TEAM scope's `req-opt` (the scoped grant).
const j1Grant1 = await grantOf(j1a.teamRoot, {
  rootSessionId: ROOT_J1,
  blueprintId: 'JND-1-BP',
  revision: '1',
  requirementId: 'req-opt',
  generation: 1,
  consentedBy: ROOT_J1,
  scopeKey: 'team',
})
const j1Audit1 = await openTeamDomain(new FileStorageSeam(dir1))

// RE-DRIVE #1: the worker scope's same-id requirement must STILL be
// unconsented (a different scope is a different consent).
const world1b = makeWorld(new FileStorageSeam(dir1))
const j1b = await applyWorld(world1b, rowConfig(ROOT_J1, DOC_J1, undefined, 'create-or-open'))

// The human consents the WORKER scope's `req-opt` (a SEPARATE grant).
const j1Grant2 = await grantOf(j1b.teamRoot, {
  rootSessionId: ROOT_J1,
  blueprintId: 'JND-1-BP',
  revision: '1',
  requirementId: 'req-opt',
  generation: 2,
  consentedBy: ROOT_J1,
  scopeKey: 'template:worker',
})

// RE-DRIVE #2: both scopes consented → the creation proceeds.
const world1c = makeWorld(new FileStorageSeam(dir1))
const j1c = await applyWorld(world1c, rowConfig(ROOT_J1, DOC_J1, undefined, 'create-or-open'))
const j1Audit2 = await openTeamDomain(new FileStorageSeam(dir1))

// --- J2 arc: stale hash, SAME root (the pre-team blueprint change) -------------------

const dir2 = scratchDir('fndj-stale-hash')
destroyDir(dir2)
const sourcesDir2 = scratchDir('fndj-stale-hash-bp')
destroyDir(sourcesDir2)
writeText(`${sourcesDir2}/jnd2-rev1.yaml`, DOC_J2_REV1)
writeText(`${sourcesDir2}/jnd2-rev2.yaml`, DOC_J2_REV2)
const world2a = makeWorld(new FileStorageSeam(dir2))
const j2a = await applyWorld(world2a, rowConfig(ROOT_J2, DOC_J2_REV1, sourcesDir2))
const j2Refusal = preflightRefusal(j2a.bootError)

// The human consents `req-opt` against REV1 (no explicit scope — the
// requirement is unmet in exactly ONE scope: the team; the writer derives
// and stamps it together with rev1's content hash).
const j2Grant1 = await grantOf(j2a.teamRoot, {
  rootSessionId: ROOT_J2,
  blueprintId: 'JND-2-BP',
  revision: '1',
  requirementId: 'req-opt',
  generation: 1,
  consentedBy: ROOT_J2,
})
const j2Audit1 = await openTeamDomain(new FileStorageSeam(dir2))

// THE BLUEPRINT CHANGES on the SAME root (pre-team: no record yet): the
// re-drive binds REV2 (same requirement ids, different content hash). The
// rev1 consent must NOT be inherited — the re-drive stays consentRequired.
const world2b = makeWorld(new FileStorageSeam(dir2))
const j2b = await applyWorld(world2b, rowConfig(ROOT_J2, DOC_J2_REV2, sourcesDir2, 'create-or-open'))

// The human re-consents against the NEW revision (rev2).
const j2Grant2 = await grantOf(j2b.teamRoot, {
  rootSessionId: ROOT_J2,
  blueprintId: 'JND-2-BP',
  revision: '2',
  requirementId: 'req-opt',
  generation: 2,
  consentedBy: ROOT_J2,
})

// RE-DRIVE: the rev2 consent matches (same scope + rev2 hash) → proceeds.
const world2c = makeWorld(new FileStorageSeam(dir2))
const j2c = await applyWorld(world2c, rowConfig(ROOT_J2, DOC_J2_REV2, sourcesDir2, 'create-or-open'))
const j2Audit2 = await openTeamDomain(new FileStorageSeam(dir2))

// --- the teardown ----------------------------------------------------------------------

await teardownWorlds(
  [world1a, world1b, world1c, world2a, world2b, world2c],
  [dir1, dir2, sourcesDir2],
)

// --- the assertions (sync it() bodies) --------------------------------------------------

describe('finding J premise: the same optional reqID is legal in two scopes; rev1/rev2 differ by hash', () => {
  it('J1: the team list and the worker list carry the SAME reqID (validate allows it — within-list uniqueness only)', () => {
    const bp = parseBlueprint(DOC_J1)
    const teamIds = (bp.teamRequirements ?? []).map((r) => r.requirementId)
    const workerIds = bp.members.find((m) => m.templateId === 'worker')?.requirements?.map((r) => r.requirementId) ?? []
    expect(teamIds).toContain('req-opt')
    expect(workerIds).toContain('req-opt')
    // DIFFERENT capabilities: the same id names a different (domain, subject)
    // pair per scope — exactly what a flat ID-only consent match cannot tell apart.
    const teamOpt = (bp.teamRequirements ?? []).find((r) => r.requirementId === 'req-opt')
    const workerOpt = bp.members.find((m) => m.templateId === 'worker')?.requirements?.find((r) => r.requirementId === 'req-opt')
    expect(teamOpt?.subjects).toEqual(['opt-a'])
    expect(workerOpt?.subjects).toEqual(['opt-b'])
  })

  it('J2: rev1 and rev2 carry the SAME requirement ids but DIFFERENT content hashes', () => {
    expect(HASH_J2_REV1).not.toBe(HASH_J2_REV2)
    const ids = (doc: string) =>
      (parseBlueprint(doc).teamRequirements ?? []).map((r) => r.requirementId).sort()
    expect(ids(DOC_J2_REV1)).toEqual(ids(DOC_J2_REV2))
  })
})

describe('J1: a consent is bound to the SCOPE it was granted for (cross-scope, same reqID)', () => {
  it('the first create is refused consentRequired (both scopes carry the unconsented reqID)', () => {
    expect(j1Refusal['outcome']).toBe('consentRequired')
    const ids = j1Refusal['consentRequiredRequirementIds'] as readonly string[]
    expect(ids).toContain('req-opt')
  })

  it('a consent granted for the TEAM scope does NOT cover the WORKER scope: re-drive #1 stays consentRequired', () => {
    // The bug (flat ID-only match): re-drive #1 PROCEEDED because the one
    // consent "covered" the worker's same-id warning.
    expect(j1b.bootError).toBeInstanceOf(TeamRuntimeError)
    const details = preflightRefusal(j1b.bootError)
    expect(details['outcome']).toBe('consentRequired')
    expect(details['consentRequiredRequirementIds']).toContain('req-opt')
    expect(j1b.root).toBeNull()
    // And the refusal left ZERO durable effect (no team record).
    expect(j1Audit1.repositories.teamSessions.get(ROOT_J1)).toBeUndefined()
  })

  it('the two scoped grants are distinct durable rows (scopeKey + contentHash stamped)', () => {
    expect(j1Grant1.ok).toBe(true)
    expect(j1Grant2.ok).toBe(true)
    expect(consentRowsOf(j1Audit2, ROOT_J1)).toEqual([
      {
        requirementId: 'req-opt',
        generation: 1,
        consentedBy: ROOT_J1,
        scopeKey: 'team',
        contentHash: HASH_J1,
      },
      {
        requirementId: 'req-opt',
        generation: 2,
        consentedBy: ROOT_J1,
        scopeKey: 'template:worker',
        contentHash: HASH_J1,
      },
    ])
  })

  it('after BOTH scopes are consented the re-drive proceeds (the consent is per-scope, not per-id)', () => {
    expect(j1c.bootError).toBeNull()
    expect(j1c.root).not.toBeNull()
    const record = j1Audit2.repositories.teamSessions.get(ROOT_J1)
    expect(record).toBeDefined()
    expect(record?.blueprint.blueprintId).toBe('JND-1-BP')
  })
})

describe('J2: a consent is bound to the BLUEPRINT HASH it was granted for (stale-hash, same root)', () => {
  it('the first create (rev1) is refused consentRequired', () => {
    expect(j2Refusal['outcome']).toBe('consentRequired')
    const ids = j2Refusal['consentRequiredRequirementIds'] as readonly string[]
    expect(ids).toContain('req-opt')
  })

  it('the rev1 consent row is stamped with the derived scope (team) and rev1 content hash', () => {
    expect(j2Grant1.ok).toBe(true)
    expect(consentRowsOf(j2Audit1, ROOT_J2)).toEqual([
      {
        requirementId: 'req-opt',
        generation: 1,
        consentedBy: ROOT_J2,
        scopeKey: 'team',
        contentHash: HASH_J2_REV1,
      },
    ])
  })

  it('the pre-team rev2 re-drive does NOT inherit the rev1 consent: stays consentRequired (the stale hash fails closed)', () => {
    // The bug (ID-only match): the rev1 consent (same root, same reqID)
    // was honored for rev2 — the re-drive PROCEEDED.
    expect(j2b.bootError).toBeInstanceOf(TeamRuntimeError)
    const details = preflightRefusal(j2b.bootError)
    expect(details['outcome']).toBe('consentRequired')
    expect(details['consentRequiredRequirementIds']).toContain('req-opt')
    expect(j2b.root).toBeNull()
    // Zero durable effect: no team record under the root.
    expect(j2Audit1.repositories.teamSessions.get(ROOT_J2)).toBeUndefined()
  })

  it('re-consenting against rev2 admits the re-drive (the consent keys on scope + hash, both must match)', () => {
    expect(j2Grant2.ok).toBe(true)
    expect(j2c.bootError).toBeNull()
    expect(j2c.root).not.toBeNull()
    const record = j2Audit2.repositories.teamSessions.get(ROOT_J2)
    expect(record).toBeDefined()
    expect(record?.blueprint.blueprintId).toBe('JND-2-BP')
    expect(String(record?.blueprint.revision)).toBe('2')
    // Both rows persist (append-only): the rev1 row (stale) + the rev2 row.
    expect(consentRowsOf(j2Audit2, ROOT_J2)).toEqual([
      {
        requirementId: 'req-opt',
        generation: 1,
        consentedBy: ROOT_J2,
        scopeKey: 'team',
        contentHash: HASH_J2_REV1,
      },
      {
        requirementId: 'req-opt',
        generation: 2,
        consentedBy: ROOT_J2,
        scopeKey: 'team',
        contentHash: HASH_J2_REV2,
      },
    ])
  })
})
