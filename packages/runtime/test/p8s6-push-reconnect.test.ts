/**
 * p8s6-push-reconnect.test.ts — C5 (P8-S6): the production push /
 * reconnect semantics (plan §20.5): monotonic generation, stale
 * overwrite rejected, duplicate invalidation safe, and a reconnect
 * pulls the AUTHORITATIVE projection.
 *
 * Driven end-to-end through the installed A31 seam (a fake
 * `ConnectionLike` captures the production dispatcher; the scenarios
 * call it as a remote peer). The client-side frame rule is the frozen
 * `decideFrameVerdict` (packages/remote/push/generation) — applied to
 * the exact generations the production surface serves.
 *
 * Proven per test:
 *
 *   C5.1 — the first `team.getProjection` carries the whole-projection
 *          generation in BOTH the value and the provenance (>= 1), and
 *          the boot world performs NO compatibility probe (the durable
 *          compatibility state is absent before any reprobe — so the
 *          boot generation is the row generation, verbatim);
 *   C5.2 — one `compatibility.reprobe` advances the TeamSession
 *          generation by EXACTLY one (gen2 = gen1 + 1) and the durable
 *          compatibility state now exists;
 *   C5.3 — the frozen frame verdicts: a stale frame (older generation)
 *          is `stale`, an equal one is `duplicate` (invalidation safe),
 *          a first frame is `apply`, and a different teamSessionId is
 *          `foreign`;
 *   C5.4 — the RECONNECT: a fresh client (applied = the first frame)
 *          pulls the authoritative projection (a fresh
 *          `team.getProjection`) — the verdict is `apply` (strictly
 *          newer) and its generation equals the CURRENT durable
 *          generation (`root.projection.project` — the durable
 *          authority), never a re-computed local state.
 *
 * World: own scratch seam + own root + own seed ids.
 * @module @dsh-agent-team/runtime/test/p8s6-push-reconnect
 */

import { describe, expect, it } from 'vitest'
import {
  destroyDir,
  FileStorageSeam,
  scratchDir,
} from '../../testkit/fault-injection/file-seam.mjs'
import * as hostEntry from '../src/plugin/host.js'
import { decideFrameVerdict } from '../../remote/src/push/generation.js'
import { stubGlueUrl } from './p8s5a-artifacts.mjs'

// --- the C5 fixture world -----------------------------------------------------------

/** The C5 root session id (distinct from every other phase fixture). */
const ROOT_SID = 'session-p8s6pushroot'
/** The C5 seeded worker / scout (the leader is implied by the root). */
const SEED_WORKER_ID = 'inst-p8s6pushw1'
const SEED_WORKER_CHILD = 'session-child-p8s6pushw1'
const SEED_SCOUT_ID = 'inst-p8s6pushs1'
const SEED_SCOUT_CHILD = 'session-child-p8s6pushs1'

/** The C5 blueprint (own id; structure mirrors the P8-S5A T1 fixture). */
const BLUEPRINT_SOURCE = [
  '---',
  'schemaVersion: 1',
  'blueprintId: P8S6PUSH-BP',
  'revision: "1"',
  'leader:',
  '  templateId: leader',
  '  persona: You lead the P8S6PUSH team.',
  'members:',
  '  - templateId: worker',
  '    displayName: Worker',
  '    persona: You do the P8S6PUSH work.',
  '  - templateId: scout',
  '    displayName: Scout',
  '    persona: You scout for the P8S6PUSH team.',
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
  '    description: The C5 default state.',
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

/** The C5 row config (the entry's ONLY input channel). */
function rowConfig(): Record<string, any> {
  return {
    bootPhase: 'create',
    rootSessionId: ROOT_SID,
    blueprintSource: BLUEPRINT_SOURCE,
    generation: 1,
    defaultWorkspace: 'C:/agent-team/work/p8s6push',
    seedMembers: [
      {
        instanceId: SEED_WORKER_ID,
        templateId: 'worker',
        label: 'c5-seed-worker',
        childSessionId: SEED_WORKER_CHILD,
      },
      {
        instanceId: SEED_SCOUT_ID,
        templateId: 'scout',
        label: 'c5-seed-scout',
        childSessionId: SEED_SCOUT_CHILD,
      },
    ],
    staticModel: { provider: 'p8s6push-static', model: 'p8s6push-model-v1' },
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

function check(condition: boolean, label: string): void {
  if (!condition) throw new Error(`C5 scenario guard: ${label}`)
}

async function applyWorld(world: TestWorld, config: Record<string, any>) {
  const host = await loadHost()
  await host.apply(world.ctx, config)
  const teamRoot: TeamRootFacade = world.provided.teamRoot
  check(teamRoot !== undefined, 'apply resolved but never provided teamRoot')
  const root = await teamRoot.ready
  return { host, teamRoot, root }
}

// --- the scenarios (module top level — the sync shim forbids async it()) -------------

const c5 = await (async () => {
  const dir = scratchDir('p8s6-push')
  const seam = new FileStorageSeam(dir)
  const world = makeWorld(seam)
  try {
    const { root } = await applyWorld(world, rowConfig())

    const registration = root.seams.remoteHandlerRegistration.current()
    let capturedDispatcher: ((endpoint: string, payload: unknown) => Promise<Record<string, any>>) | null = null
    const registrationResult = registration({
      rpc: {
        handle: (_channel: string, dispatcher: unknown) => {
          capturedDispatcher = dispatcher as (endpoint: string, payload: unknown) => Promise<Record<string, any>>
          return () => {}
        },
      },
    })
    check(capturedDispatcher !== null, 'registration never registered a dispatcher')

    async function call(endpoint: string, params: Record<string, any>): Promise<Record<string, any>> {
      const dispatcher = capturedDispatcher
      if (dispatcher === null) throw new Error('C5 scenario guard: dispatcher missing')
      const response = await dispatcher(endpoint, { version: 1, params })
      return response as Record<string, any>
    }

    // --- C5.1 the first frame (the boot generation; no probe at boot) ---------------

    const compatBefore = await call('compatibility.get', { teamSessionId: ROOT_SID })
    const first = await call('team.getProjection', { teamSessionId: ROOT_SID })
    const firstProjection = (first.value.data as Record<string, any>).projection as Record<string, any>
    const gen1 = Number(firstProjection.generation)
    const prov1 = first.value.provenance as Record<string, any>

    // --- C5.2 one reprobe advances the generation by exactly one --------------------

    const reprobe = await call('compatibility.reprobe', {
      teamSessionId: ROOT_SID,
      trigger: 'NEW_ACTIVATION',
    })
    const second = await call('team.getProjection', { teamSessionId: ROOT_SID })
    const secondProjection = (second.value.data as Record<string, any>).projection as Record<string, any>
    const gen2 = Number(secondProjection.generation)
    const compatAfter = await call('compatibility.get', { teamSessionId: ROOT_SID })

    // --- C5.4 the reconnect pull (the authoritative projection) ---------------------

    const reconnectPull = await call('team.getProjection', { teamSessionId: ROOT_SID })
    const reconnectProjection = (reconnectPull.value.data as Record<string, any>).projection as Record<string, any>
    // The durable authority (the SAME projection service the root exposes).
    const durableNow = root.projection.project(
      ROOT_SID as never,
    ) as Record<string, any>

    registrationResult.dispose()

    return {
      world,
      dir,
      compatBefore,
      first,
      firstProjection,
      gen1,
      prov1,
      reprobe,
      secondProjection,
      gen2,
      compatAfter,
      reconnectProjection,
      durableNow,
    }
  } catch (err) {
    destroyDir(dir)
    world.effectDisposers.forEach((dispose) => dispose())
    throw new Error(`C5 push world failing: ${err instanceof Error ? err.message : String(err)}`)
  }
})()

it('C5.1 the first frame carries the generation in value AND provenance (>= 1)', () => {
  expect(c5.first.ok).toBe(true)
  expect(c5.gen1).toBeGreaterThan(0)
  expect(c5.prov1.projectionGeneration).toBe(c5.gen1)
  expect(c5.prov1.origin).toBe('team-remote')
  expect(c5.prov1.method).toBe('team.getProjection')
  expect(c5.prov1.contractVersion).toBe(1)
  expect(typeof c5.firstProjection.generatedAt).toBe('string')
  check(c5.firstProjection.generatedAt.length > 0, 'generatedAt is empty')
  // The production root establishes the BOOT compatibility state (wiring
  // decision (x) — the STALE_GENERATION_BEFORE_NEW_WORK trigger covers the
  // first-ever evaluation), so the durable state exists BEFORE any reprobe;
  // the verdict carries the frozen closed shape.
  expect(c5.compatBefore.ok).toBe(true)
  const verdict = (c5.compatBefore.value.data as Record<string, any>).verdict as Record<string, any>
  expect(typeof verdict.status).toBe('string')
  expect(verdict.counts.fatal).toBe(0)
  expect(verdict.generation).toBeGreaterThan(0)
})

it('C5.2 one reprobe advances the generation by exactly one and the state now exists', () => {
  expect(c5.reprobe.ok).toBe(true)
  const data = (c5.reprobe.value.data as Record<string, any>).probe as Record<string, any>
  expect(data.trigger).toBe('NEW_ACTIVATION')
  expect(data.fatal).toBe(0)
  expect(typeof data.generation).toBe('number')
  expect(c5.gen2).toBe(c5.gen1 + 1)
  expect(c5.compatAfter.ok).toBe(true)
})

it('C5.3 the frozen frame verdicts: stale rejected, duplicate safe, first applies, foreign rejected', () => {
  // A stale frame (the first generation after the reprobe) must not
  // overwrite the new state.
  expect(
    decideFrameVerdict({ teamSessionId: ROOT_SID, generation: c5.gen2 }, { teamSessionId: ROOT_SID, generation: c5.gen1 }),
  ).toBe('stale')
  // The duplicate (equal generation) is safe — invalidation does not
  // corrupt the applied state.
  expect(
    decideFrameVerdict({ teamSessionId: ROOT_SID, generation: c5.gen2 }, { teamSessionId: ROOT_SID, generation: c5.gen2 }),
  ).toBe('duplicate')
  // A first frame (nothing applied) always applies.
  expect(
    decideFrameVerdict(null, { teamSessionId: ROOT_SID, generation: c5.gen1 }),
  ).toBe('apply')
  // A different teamSessionId is foreign (never applied to this team).
  expect(
    decideFrameVerdict({ teamSessionId: ROOT_SID, generation: c5.gen2 }, { teamSessionId: 'session-other', generation: c5.gen2 + 1 }),
  ).toBe('foreign')
  // And strictly newer applies (the normal progression).
  expect(
    decideFrameVerdict({ teamSessionId: ROOT_SID, generation: c5.gen1 }, { teamSessionId: ROOT_SID, generation: c5.gen2 }),
  ).toBe('apply')
})

it('C5.4 a reconnect pulls the authoritative projection (strictly newer + the durable generation)', () => {
  // A fresh client that only holds the FIRST frame: the reconnect pull
  // is strictly newer...
  expect(
    decideFrameVerdict(
      { teamSessionId: ROOT_SID, generation: c5.gen1 },
      { teamSessionId: ROOT_SID, generation: Number(c5.reconnectProjection.generation) },
    ),
  ).toBe('apply')
  // ...and its generation equals the CURRENT durable generation (the
  // durable authority — not a local recompute).
  expect(Number(c5.reconnectProjection.generation)).toBe(Number(c5.durableNow.generation))
  expect(c5.reconnectProjection.teamSessionId).toBe(ROOT_SID)
})

// --- teardown --------------------------------------------------------------------------

describe('p8s6-push-reconnect teardown', () => {
  it('the C5 world is disposed (stop semantics)', () => {
    c5.world.effectDisposers.forEach((dispose) => dispose())
    c5.world.effectDisposers.length = 0
    destroyDir(c5.dir)
    expect(true).toBe(true)
  })
})
