/**
 * bound-blueprint-persona-root.test.ts — A2 (RC2 repair, plan §5/§6): the
 * production root's binder persona source must resolve from the
 * TeamSession's BOUND blueprint snapshot through the host's per-Team
 * resolver — never from the row-level `config.blueprintSource` anchor.
 *
 * Proven through the production entry (`host.apply` over a REAL file
 * storage seam, the p8s7r4 / t12b2 pattern) plus one FACTORY world
 * (direct `createTeamProductionRoot`, no resolver injected) that pins the
 * legacy row-anchor behavior as the factory-world-only fallback:
 *
 *   W1 (the production host-entry world, one medium):
 *     boot 1 — REAL create, row anchor = B: the boot root binds its
 *              durable TeamSession row to B's snapshot ref (the freeze
 *              barrier appends B's registry row).
 *     seed   — Team 2 (root bound to C: row + root binding + leader +
 *              C's registry row), Team 3 (root bound to the DANGLING ref
 *              D: row + root binding + leader, NO registry row / source),
 *              and the post-terminal-commit member rows the durable
 *              creates committed (Team 1 `worker-b`, Team 2 `worker`,
 *              Team 3 `worker-a`).
 *     boot 2 — RESTART, row anchor = A (the DIVERGED row config):
 *              A2-T1  bindFreshMember(Team 1's worker-b child) — the
 *                      template exists ONLY in bound snapshot B; the
 *                      post-commit binder must INSTALL (pre-repair it
 *                      threw the forbidden "no blueprint member template
 *                      with templateId \"worker-b\"" and the create
 *                      reported a FALSE rejected).
 *              A2-T3  bindFreshMember(Team 2's worker child) — the SAME
 *                      templateId `worker` is absent from anchor A but
 *                      present in Team 2's bound snapshot C: one row
 *                      serves multiple teams; the persona lookup is
 *                      ROOT-SCOPED (a row-global anchor lookup would
 *                      fail both teams).
 *              A2-T4  bindFreshMember(Team 3's worker-a child) — the
 *                      bound ref is UNRESOLVABLE (no registry row, no
 *                      saved source, not the anchor): the bind must FAIL
 *                      CLOSED with the authority's typed
 *                      "blueprint not found in catalog" error — while
 *                      `worker-a` EXISTS in anchor A, so a silent
 *                      row-anchor fallback would have succeeded: the
 *                      failure discriminates.
 *              extra  the missing durable TeamSession row fails closed
 *                      through the host resolver's typed throw (the
 *                      glue must never set up an agent for a rowless
 *                      root) — a direct persona-slot drive on an orphan
 *                      root.
 *
 *   W3 (the factory world — direct root construction, NO resolver):
 *     the persona source is the LEGACY row-anchor closure (unchanged):
 *     a member whose template is in the anchor installs; a member whose
 *     template is NOT in the anchor keeps the typed
 *     "no blueprint member template with templateId …" throw.
 *
 * The agent-PROMPT persona TEXT of the same diverged world (A2-T1 / T2 /
 * T3 installed text) is asserted by the companion
 * `bound-blueprint-persona-live.test.ts` (the T12 lane-A live bridge over
 * the real glue — the real agent-ctx prompt surface).
 *
 * Runner note: the plain-node vitest shim forbids async `it()` bodies —
 * the worlds are booted at module load (top-level await), the `it`
 * bodies assert synchronously (the p8s7r4 / t12b2 pattern).
 * @module @dsh-agent-team/runtime/test/bound-blueprint-persona-root
 */

import { describe, expect, it } from 'vitest'
import {
  destroyDir,
  FileStorageSeam,
  scratchDir,
} from '../../testkit/fault-injection/file-seam.mjs'
import * as hostEntry from '../src/plugin/host.js'
import type { TeamPluginHostContext } from '../src/plugin/host.js'
import { createTeamProductionRoot } from '../src/plugin/root.js'
import type { TeamPluginConfig } from '../src/plugin/types.js'
import { createTeamDomain } from '../../storage/repositories/index.js'
import { ADMISSION_OPEN_CODE, isTeamAgentBinderError, TEAM_AGENT_BINDER_ERROR_CODES } from '../agent-setup/binder/index.js'
import type { TeamAgentBinderError } from '../agent-setup/binder/index.js'
import { createAgentBindings as createStubBindings } from './p8s5a-stub-glue.mjs'
import { stubGlueUrl } from './p8s5a-artifacts.mjs'
import {
  createMemberInstanceRecord,
  createTeamSessionRecord,
  LEADER_INSTANCE_ID,
  parseChildSessionId,
  parseInstanceId,
  parseRootSessionId,
  parseTemplateId,
} from '../../contracts/src/index.js'
import {
  A2_NOW,
  CHILD_B1,
  CHILD_C1,
  CHILD_D1,
  CHILD_F1,
  DOC_A,
  DOC_B,
  DOC_C,
  INST_B1,
  INST_C1,
  INST_D1,
  INST_F1,
  ORPHAN,
  REF_B,
  REF_C,
  REF_D,
  ROOT_B,
  ROOT_C,
  ROOT_D,
  ROOT_F,
} from './bound-blueprint-persona-helpers.js'

// --- the row config base (the entry's ONLY input channel) --------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
function rowConfig(overrides: Record<string, any>): Record<string, any> {
  return {
    bootPhase: 'create',
    rootSessionId: ROOT_B,
    blueprintSource: DOC_B,
    generation: 1,
    defaultWorkspace: 'C:/agent-team/work/a2bpp',
    seedMembers: [],
    staticModel: { provider: 'a2bpp-static', model: 'a2bpp-model-v1' },
    deniedSelection: null,
    mcpServer: null,
    environmentFacts: [],
    externalPolicyFacts: { hard: {}, capabilityExists: {} },
    glueUrl: stubGlueUrl(),
    ...overrides,
  }
}

// --- the test Cordis context (the p8s5a / t12b2 pattern) ---------------------

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
    workspaceRegistry: { list: () => [], resolveByPath: async () => undefined },
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
  if (teamRoot === undefined) throw new Error('A2 guard: apply resolved but never provided teamRoot')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
  const root: Record<string, any> = await teamRoot.ready
  return root
}

/** Fail the whole file (module-load failure) on a flow-critical invariant. */
function check(condition: boolean, label: string): void {
  if (!condition) throw new Error(`A2 invariant: ${label}`)
}

// --- the W1 world (production host entry, one medium, diverged anchor) ──────

// Pre-cleanup: the scratch basenames are DETERMINISTIC (the testkit
// contract) — a crashed run (a module-load failure skips the teardown
// below) would leave a stamped team_domain behind and poison the next
// run's create. Destroy every world's medium BEFORE the first boot.
for (const n of ['a2bpp-main', 'a2bpp-factory']) {
  destroyDir(scratchDir(n))
}

interface W1State {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- untyped test payload (binder results)
  t1: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- untyped test payload (binder results)
  t3: any
  t4: unknown
  orphan: unknown
  childB1Slots: string[]
  childC1Slots: string[]
  t1Events: string[]
}

const w1: W1State = await (async (): Promise<W1State> => {
  const seam = new FileStorageSeam(scratchDir('a2bpp-main'))

  // ── boot 1: the REAL create, row anchor = B ─────────────────────────────
  // The boot root's durable TeamSession row binds B's snapshot ref; the
  // freeze barrier (the host always passes the live authority) appends
  // B's registry row.
  const root1 = await applyWorld(makeWorld(seam), rowConfig({}))
  const repos1 = root1.domain.repositories
  const teamB = repos1.teamSessions.get(ROOT_B)
  check(teamB !== undefined, 'W1 boot1: the real create committed the TeamSession row')
  check(String(teamB.blueprint.blueprintId) === 'a2bpp.b', 'W1 boot1: the boot root bound the anchor (B) snapshot')
  check(repos1.blueprintRegistry.get('a2bpp.b', '1') !== undefined, 'W1 boot1: the freeze barrier appended B to the registry')

  // ── seed Team 2 (bound to C) — a second team on the SAME row ────────────
  await repos1.teamSessions.put({
    blueprint: REF_C,
    createdAt: A2_NOW,
    defaultWorkspace: 'C:/agent-team/work/a2bpp',
    generation: 1,
    rootSessionId: parseRootSessionId(ROOT_C),
  })
  await repos1.sessionBindings.put({ kind: 'team-root', schemaVersion: 1, sessionId: ROOT_C })
  await repos1.memberInstances.put({
    activityVersion: 1,
    createdAt: A2_NOW,
    instanceId: parseInstanceId(LEADER_INSTANCE_ID),
    label: 'a2bpp leader C',
    rootSessionId: parseRootSessionId(ROOT_C),
    templateId: parseTemplateId('leader'),
  })
  await repos1.blueprintRegistry.freeze({
    blueprintId: 'a2bpp.c',
    revision: '1',
    contentHash: String(REF_C.contentHash),
    source: DOC_C,
    frozenAt: A2_NOW,
  })

  // ── seed Team 3 (bound to the DANGLING ref D — unresolvable) ────────────
  await repos1.teamSessions.put({
    blueprint: REF_D,
    createdAt: A2_NOW,
    defaultWorkspace: 'C:/agent-team/work/a2bpp',
    generation: 1,
    rootSessionId: parseRootSessionId(ROOT_D),
  })
  await repos1.sessionBindings.put({ kind: 'team-root', schemaVersion: 1, sessionId: ROOT_D })
  await repos1.memberInstances.put({
    activityVersion: 1,
    createdAt: A2_NOW,
    instanceId: parseInstanceId(LEADER_INSTANCE_ID),
    label: 'a2bpp leader D',
    rootSessionId: parseRootSessionId(ROOT_D),
    templateId: parseTemplateId('leader'),
  })
  // NO registry row for a2bpp.d@1 (and no saved source, and the anchor is
  // a2bpp.a): the bound snapshot is unresolvable — the A2-T4 registry
  // inconsistency.

  // ── seed the member rows (the post-terminal-commit durable truth) ───────
  // Team 1: `worker-b` — the template exists ONLY in bound snapshot B
  // (absent from anchor A). Team 2: `worker` — the shared templateId
  // (absent from anchor A). Team 3: `worker-a` — present in anchor A, so a
  // silent row-anchor fallback would have SUCCEEDED (the discriminator).
  const seedMember = async (
    root: string,
    instanceId: string,
    templateId: string,
    childSessionId: string,
  ): Promise<void> => {
    await repos1.memberInstances.put({
      activityVersion: 1,
      childSessionId: parseChildSessionId(childSessionId),
      createdAt: A2_NOW,
      instanceId: parseInstanceId(instanceId),
      label: `a2bpp ${templateId}`,
      lifecycle: 'CREATED',
      rootSessionId: parseRootSessionId(root),
      templateId: parseTemplateId(templateId),
    })
    await repos1.sessionBindings.put({
      instanceId,
      kind: 'team-member',
      rootSessionId: root,
      schemaVersion: 1,
      sessionId: childSessionId,
    })
  }
  await seedMember(ROOT_B, INST_B1, 'worker-b', CHILD_B1)
  await seedMember(ROOT_C, INST_C1, 'worker', CHILD_C1)
  await seedMember(ROOT_D, INST_D1, 'worker-a', CHILD_D1)

  await root1.close()

  // ── boot 2: the RESTART — the DIVERGED row config (anchor A) ────────────
  const root = await applyWorld(makeWorld(seam), rowConfig({ bootPhase: 'resume', blueprintSource: DOC_A }))

  // A2-T1: the post-commit binder install for the `worker-b` child (the
  // false-rejected site: pre-repair the persona source read the row
  // anchor, found no `worker-b`, and the durable create reported a
  // FALSE rejected).
  const t1 = root.binder.bindFreshMember(CHILD_B1)

  // A2-T3: the post-commit binder install for Team 2's `worker` child —
  // the SAME templateId Team 1 carries, resolved under Team 2's root.
  const t3 = root.binder.bindFreshMember(CHILD_C1)

  // A2-T4: the post-commit binder install for Team 3's child — the bound
  // snapshot is unresolvable: a typed FAIL-CLOSED error (never a silent
  // row-anchor fallback — `worker-a` is in anchor A, so the fallback
  // would have succeeded).
  let t4: unknown
  try {
    root.binder.bindFreshMember(CHILD_D1)
  } catch (error) {
    t4 = error
  }

  // The missing durable TeamSession row: the host resolver's typed throw
  // (the glue must never set up an agent for a rowless root) — a direct
  // persona-slot drive on the orphan root (the binder's own durable
  // lookups would reject first; the slot isolates the resolver path).
  let orphan: unknown
  try {
    root.slots.persona.apply({
      target: { kind: 'root', sessionId: ORPHAN, rootSessionId: ORPHAN, instanceId: LEADER_INSTANCE_ID },
      record: teamB,
      path: 'fresh-root',
    })
  } catch (error) {
    orphan = error
  }

  const childB1Slots = root.live.__t1.slots.get(CHILD_B1) ?? []
  const childC1Slots = root.live.__t1.slots.get(CHILD_C1) ?? []
  const t1Events = (t1.emittedEvents ?? []).map((event: { name: string; detail?: string }) => `${event.name}:${event.detail ?? ''}`)

  try {
    return { t1, t3, t4, orphan, childB1Slots, childC1Slots, t1Events }
  } finally {
    await root.close()
    destroyDir(scratchDir('a2bpp-main'))
  }
})()

// --- the W3 world (factory: direct root construction, NO resolver) ──────────

interface W3State {
  f1: unknown
  f2: unknown
  fLeader: unknown
}

const w3: W3State = await (async (): Promise<W3State> => {
  const seam = new FileStorageSeam(scratchDir('a2bpp-factory'))
  const domain = await createTeamDomain(seam)

  // The durable truth the binder READS: the `worker-a` member (the
  // template EXISTS in anchor A) + its child binding. No TeamSession row
  // is needed: the factory persona source is the row-ANCHOR closure (it
  // never reads a bound ref).
  await domain.repositories.memberInstances.put({
    activityVersion: 1,
    childSessionId: parseChildSessionId(CHILD_F1),
    createdAt: A2_NOW,
    instanceId: parseInstanceId(INST_F1),
    label: 'a2bpp factory worker-a',
    lifecycle: 'CREATED',
    rootSessionId: parseRootSessionId(ROOT_F),
    templateId: parseTemplateId('worker-a'),
  })
  await domain.repositories.sessionBindings.put({
    instanceId: INST_F1,
    kind: 'team-member',
    rootSessionId: ROOT_F,
    schemaVersion: 1,
    sessionId: CHILD_F1,
  })

  const config: TeamPluginConfig = {
    bootPhase: 'create',
    rootSessionId: ROOT_F,
    blueprintSource: DOC_A,
    generation: 1,
    defaultWorkspace: 'C:/agent-team/work/a2bpp-factory',
    seedMembers: [],
    staticModel: { provider: 'a2bpp-factory', model: 'a2bpp-factory-model' },
    deniedSelection: null,
    mcpServer: null,
    environmentFacts: [],
    externalPolicyFacts: { hard: {}, capabilityExists: {} },
  }
  const teamToolsRef = { current: undefined }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (stub glue), untyped by design
  const live: any = createStubBindings({ config, teamToolsRef, domain })
  const unused = (): never => {
    throw new Error('A2 factory world: legacy inspect is unused')
  }
  const root = createTeamProductionRoot({
    config,
    domain,
    storageSeam: seam,
    live,
    now: () => A2_NOW,
    teamToolsRef,
    controlServiceRef: { current: undefined },
    legacyInspect: unused as never,
    // Factory world: NO blueprintCatalog / blueprintAuthority /
    // resolveBoundBlueprint — the legacy static catalog + the row-anchor
    // persona source (the pre-repair behavior this case pins).
  })

  // The anchor-resolved member install (unchanged factory behavior):
  // `worker-a` is in anchor A.
  let f1: unknown
  try {
    f1 = root.binder.bindFreshMember(CHILD_F1)
  } catch (error) {
    f1 = error
  }

  // The missing-template typed throw (unchanged factory behavior):
  // `worker-b` is NOT in anchor A (a direct persona-slot drive with a
  // member record carrying the templateId — no binder durable lookups).
  const missingTemplateRow = createMemberInstanceRecord({
    rootSessionId: parseRootSessionId(ROOT_F),
    instanceId: parseInstanceId('inst-a2bppf2'),
    templateId: parseTemplateId('worker-b'),
    label: 'a2bpp factory missing template',
    childSessionId: parseChildSessionId('session-child-a2bppf2'),
    lifecycle: 'CREATED',
    createdAt: A2_NOW,
    activityVersion: 1,
  })
  let f2: unknown
  try {
    root.slots.persona.apply({
      target: { kind: 'member', sessionId: 'session-child-a2bppf2', rootSessionId: ROOT_F, instanceId: 'inst-a2bppf2' },
      record: missingTemplateRow,
      path: 'fresh-member',
    })
  } catch (error) {
    f2 = error
  }

  // The anchor-resolved leader install (unchanged factory behavior).
  const factoryTeamRow = createTeamSessionRecord({
    blueprint: REF_B,
    createdAt: A2_NOW,
    generation: 1,
    rootSessionId: parseRootSessionId(ROOT_F),
  })
  let fLeader: unknown
  try {
    root.slots.persona.apply({
      target: { kind: 'root', sessionId: ROOT_F, rootSessionId: ROOT_F, instanceId: LEADER_INSTANCE_ID },
      record: factoryTeamRow,
      path: 'fresh-root',
    })
  } catch (error) {
    fLeader = error
  }

  try {
    await root.close()
    return { f1, f2, fLeader }
  } finally {
    destroyDir(scratchDir('a2bpp-factory'))
  }
})()

// --- the case assertions ─────────────────────────────────────────────────────

const FORBIDDEN_T1 = 'no blueprint member template with templateId "worker-b"'

function errorMessage(error: unknown): string {
  if (error === undefined) return ''
  if (error instanceof Error) {
    const code = 'code' in error ? String((error as { code?: unknown }).code) : ''
    return code !== '' ? `[${code}] ${error.message}` : error.message
  }
  return String(error)
}

describe('A2-T1 the post-commit binder installs a member whose template exists only in the bound snapshot', () => {
  it('the durable create survived; the binder install SUCCEEDS (no false rejected)', () => {
    expect(w1.t1.bound).toBe(true)
    expect(w1.t1.installed).toBe(true)
    expect(w1.t1.admitted).toBe(true)
    // All three overlay slots installed on the member residency (persona
    // first — the slot that used to fail).
    expect(w1.childB1Slots).toEqual(['persona', 'model', 'capability'])
    expect(w1.t1Events).toContain('agent-setup/overlay-installed:persona')
    expect(w1.t1Events).toContain(`agent-setup/admission-decided:${ADMISSION_OPEN_CODE}`)
  })

  it('the forbidden row-anchor error never occurs (the create is not a false rejected)', () => {
    const observed = [
      ...w1.t1Events,
      errorMessage(w1.t4),
      errorMessage(w1.orphan),
    ].join('\n')
    expect(observed).not.toContain(FORBIDDEN_T1)
    // T1 itself produced no error (a success is a plain result).
    expect(w1.t1 instanceof Error).toBe(false)
  })
})

describe('A2-T3 one row, multiple teams: the persona lookup is root-scoped, not row-global', () => {
  it('Team 2 installs its `worker` member from its own bound snapshot (C)', () => {
    // `worker` is ABSENT from the row anchor A — a row-global anchor
    // lookup would have thrown "no blueprint member template with
    // templateId \"worker\"" for BOTH teams; the bound-snapshot lookup
    // resolves it under Team 2's root only.
    expect(w1.t3.bound).toBe(true)
    expect(w1.t3.installed).toBe(true)
    expect(w1.t3.admitted).toBe(true)
    expect(w1.childC1Slots).toEqual(['persona', 'model', 'capability'])
    const observed = [...w1.t1Events, errorMessage(w1.t4), errorMessage(w1.orphan)].join('\n')
    expect(observed).not.toContain('no blueprint member template with templateId "worker"')
  })
})

describe('A2-T4 the unresolvable bound snapshot fails closed — never a silent row-anchor fallback', () => {
  it('the bind is rejected with the authority\'s typed snapshot error', () => {
    expect(isTeamAgentBinderError(w1.t4)).toBe(true)
    const binderError = w1.t4 as TeamAgentBinderError
    expect(binderError.code).toBe(TEAM_AGENT_BINDER_ERROR_CODES.BINDER_OVERLAY_FAILED)
    // The underlying typed failure is the authority's "bound snapshot
    // unavailable" error — NOT a template-missing error and NOT a silent
    // success (worker-a exists in anchor A: the fallback would have
    // installed A's persona without a trace).
    expect(errorMessage(w1.t4)).toContain('blueprint not found in catalog')
    expect(errorMessage(w1.t4)).toContain('a2bpp.d')
    expect(errorMessage(w1.t4)).not.toContain('no blueprint member template')
  })
})

describe('A2 extra: the missing durable TeamSession row fails closed through the resolver', () => {
  it('a rowless root throws the resolver\'s typed error (no silent persona-less agent)', () => {
    expect(w1.orphan instanceof Error).toBe(true)
    expect(errorMessage(w1.orphan)).toContain('no durable TeamSession row')
    expect(errorMessage(w1.orphan)).toContain(ORPHAN)
    // It is the resolver's failure, not a template-missing error.
    expect(errorMessage(w1.orphan)).not.toContain('no blueprint member template')
  })
})

describe('factory world unchanged: without a resolver, the row anchor stays the persona authority', () => {
  it('a member template present in the anchor installs (legacy behavior)', () => {
    expect(w3.f1 instanceof Error).toBe(false)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- untyped binder result
    expect((w3.f1 as any).bound).toBe(true)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- untyped binder result
    expect((w3.f1 as any).installed).toBe(true)
  })

  it('a member template absent from the anchor keeps the typed throw (legacy behavior)', () => {
    expect(w3.f2 instanceof Error).toBe(true)
    expect(errorMessage(w3.f2)).toContain('no blueprint member template with templateId "worker-b"')
  })

  it('the leader install resolves from the anchor (legacy behavior)', () => {
    expect(w3.fLeader instanceof Error).toBe(false)
  })
})
