/**
 * p8s6-principal.test.ts — C3 (P8-S6): the production principal boundary
 * (plan §20.3; closes CR-4) rejects spoofed caller claims server-side.
 *
 * The whole surface is driven END-TO-END through the installed A31 seam:
 * the production registration is attached to a fake `ConnectionLike`
 * (which captures the dispatcher on channel `/team-remote`), and every
 * scenario calls the captured dispatcher exactly as a remote peer would —
 * `dispatcher(endpoint, { version, params })` — asserting on the frozen
 * `RemoteResponse` wire shape.
 *
 * Proven per test (scenarios at module top level; sync `it` assertions):
 *
 *   C3.1 — the registration attaches on `/team-remote` with an idempotent
 *          disposer (the frozen register semantics, mirrored);
 *   C3.2 — a spoofed INSTANCE caller (no durable row) on `member.create`
 *          is rejected with `TEAM_REMOTE_PRINCIPAL_INVALID`;
 *   C3.3 — a spoofed HUMAN caller (humanId != the bound root) on
 *          `member.create` is rejected (spoofed-human);
 *   C3.4 — a member ACTOR with no durable instance (unknown-instance) on
 *          `override.set` is rejected;
 *   C3.5 — a member ACTOR claiming a foreign rootSessionId is rejected
 *          (wrong-root);
 *   C3.6 — a member ACTOR claiming the LEADER instance as an ordinary
 *          member is rejected (leader-is-not-a-member);
 *   C3.7 — a spoofed `acknowledgedBy` on `compatibility.ack` is rejected
 *          (spoofed-ack-by);
 *   C3.8 — a FOREIGN teamSessionId on `team.getProjection` is rejected
 *          with `TEAM_REMOTE_FOREIGN_TEAM` (never a principal error);
 *   C3.9 — the VALID human actor on `override.set` is derived to the
 *          host-known operator and completes (the pure-store path): the
 *          durable override record exists (recordId / kind / generation);
 *   C3.10 — the VALID human caller on `member.create` passes the boundary
 *           (no principal / foreign code — the stub world's downstream
 *           failure is a different, non-boundary code).
 *
 * World: own scratch seam + own root session id + own seed ids.
 * @module @dsh-agent-team/runtime/test/p8s6-principal
 */

import { describe, expect, it } from 'vitest'
import {
  destroyDir,
  FileStorageSeam,
  scratchDir,
} from '../../testkit/fault-injection/file-seam.mjs'
import * as hostEntry from '../src/plugin/host.js'
import { stubGlueUrl } from './p8s5a-artifacts.mjs'

// --- the C3 fixture world -----------------------------------------------------------

/** The C3 root session id (distinct from every other phase fixture). */
const ROOT_SID = 'session-p8s6prinroot'
/** The C3 seeded worker / scout (the leader is implied by the root). */
const SEED_WORKER_ID = 'inst-p8s6prinw1'
const SEED_WORKER_CHILD = 'session-child-p8s6prinw1'
const SEED_SCOUT_ID = 'inst-p8s6prins1'
const SEED_SCOUT_CHILD = 'session-child-p8s6prins1'

/** The C3 blueprint (own id; structure mirrors the P8-S5A T1 fixture). */
const BLUEPRINT_SOURCE = [
  '---',
  'schemaVersion: 1',
  'blueprintId: P8S6PRIN-BP',
  'revision: "1"',
  'leader:',
  '  templateId: leader',
  '  persona: You lead the P8S6PRIN team.',
  'members:',
  '  - templateId: worker',
  '    displayName: Worker',
  '    persona: You do the P8S6PRIN work.',
  '  - templateId: scout',
  '    displayName: Scout',
  '    persona: You scout for the P8S6PRIN team.',
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
  '    description: The P8S6PRIN default state.',
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

/** The C3 row config (the entry's ONLY input channel). */
function rowConfig(): Record<string, any> {
  return {
    bootPhase: 'create',
    rootSessionId: ROOT_SID,
    blueprintSource: BLUEPRINT_SOURCE,
    generation: 1,
    defaultWorkspace: 'C:/agent-team/work/p8s6prin',
    seedMembers: [
      {
        instanceId: SEED_WORKER_ID,
        templateId: 'worker',
        label: 'c3-seed-worker',
        childSessionId: SEED_WORKER_CHILD,
      },
      {
        instanceId: SEED_SCOUT_ID,
        templateId: 'scout',
        label: 'c3-seed-scout',
        childSessionId: SEED_SCOUT_CHILD,
      },
    ],
    staticModel: { provider: 'p8s6prin-static', model: 'p8s6prin-model-v1' },
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
  if (!condition) throw new Error(`C3 scenario guard: ${label}`)
}

/** Assert-value helper (narrowing): the value is neither null nor undefined. */
function defined<T>(value: T, label: string): asserts value is NonNullable<T> {
  if (value === null || value === undefined) throw new Error(`C3 scenario guard: ${label}`)
}

async function applyWorld(world: TestWorld, config: Record<string, any>) {
  const host = await loadHost()
  await host.apply(world.ctx, config)
  const teamRoot: TeamRootFacade = world.provided.teamRoot
  check(teamRoot !== undefined, 'apply resolved but never provided teamRoot')
  const root = await teamRoot.ready
  return { host, teamRoot, root }
}

/** The frozen RemoteResponse code (null when the call succeeded). */
function codeOf(response: Record<string, any>): string | null {
  if (response.ok === false) {
    return String((response.error as Record<string, any>).code)
  }
  return null
}

// --- the scenarios (module top level — the sync shim forbids async it()) -------------

const c3 = await (async () => {
  const dir = scratchDir('p8s6-principal')
  const seam = new FileStorageSeam(dir)
  const world = makeWorld(seam)
  try {
    const { root } = await applyWorld(world, rowConfig())

    // The A31 registration attaches to a fake connection and hands over the
    // production dispatcher on the frozen channel.
    const registration = root.seams.remoteHandlerRegistration.current()
    let capturedChannel: string | null = null
    let capturedDispatcher: ((endpoint: string, payload: unknown) => Promise<Record<string, any>>) | null = null
    let handleDisposes = 0
    const registrationResult = registration({
      rpc: {
        handle: (channel: string, dispatcher: unknown) => {
          capturedChannel = channel
          capturedDispatcher = dispatcher as (endpoint: string, payload: unknown) => Promise<Record<string, any>>
          return () => {
            handleDisposes += 1
          }
        },
      },
    })
    check(capturedDispatcher !== null, 'registration never registered a dispatcher')

    async function call(endpoint: string, params: Record<string, any>): Promise<Record<string, any>> {
      const dispatcher = capturedDispatcher
      if (dispatcher === null) throw new Error('C3 scenario guard: dispatcher missing')
      const response = await dispatcher(endpoint, { version: 1, params })
      return response as Record<string, any>
    }

    // --- the spoofed claims (every one must hit the boundary, not the facade) ------

    // C3.2: a spoofed instance caller (no durable row under the bound root).
    const spoofedInstance = await call('member.create', {
      teamSessionId: ROOT_SID,
      caller: { kind: 'instance', instanceId: 'inst-ghost' },
      requestToken: 'req-c32',
      payload: { label: 'c3-ghost' },
    })

    // C3.3: a spoofed human caller (humanId != the bound root).
    const spoofedHuman = await call('member.create', {
      teamSessionId: ROOT_SID,
      caller: { kind: 'human', humanId: 'other-operator' },
      requestToken: 'req-c33',
      payload: { label: 'c3-spoofed' },
    })

    // C3.4: a member actor with no durable instance.
    const ghostActor = await call('override.set', {
      teamSessionId: ROOT_SID,
      capability: 'model',
      value: { kind: 'allow', items: ['m-x'] },
      actor: { kind: 'member', member: { rootSessionId: ROOT_SID, instanceId: 'inst-ghost' } },
    })

    // C3.5: a member actor claiming a foreign rootSessionId.
    const wrongRootActor = await call('override.set', {
      teamSessionId: ROOT_SID,
      capability: 'model',
      value: { kind: 'allow', items: ['m-x'] },
      actor: {
        kind: 'member',
        member: { rootSessionId: 'session-other-root', instanceId: SEED_WORKER_ID },
      },
    })

    // C3.6: a member actor claiming the leader as an ordinary member.
    const leaderAsMember = await call('override.set', {
      teamSessionId: ROOT_SID,
      capability: 'model',
      value: { kind: 'allow', items: ['m-x'] },
      actor: {
        kind: 'member',
        member: { rootSessionId: ROOT_SID, instanceId: 'inst-leader' },
      },
    })

    // C3.7: a spoofed acknowledgedBy.
    const spoofedAck = await call('compatibility.ack', {
      teamSessionId: ROOT_SID,
      requirementId: 'req-tool-web',
      acknowledgedBy: 'other-operator',
    })

    // C3.8: a foreign teamSessionId (a query, not a claim).
    const foreignProjection = await call('team.getProjection', {
      teamSessionId: 'session-other',
    })

    // --- the valid controls (the boundary lets the real authority through) ---------

    // C3.9: the valid human actor (derived to the host-known operator).
    const validOverride = await call('override.set', {
      teamSessionId: ROOT_SID,
      capability: 'model',
      value: { kind: 'allow', items: ['m-x'] },
      actor: { kind: 'human' },
    })

    // C3.10: the valid human caller on member.create (passes the boundary;
    // the stub world's downstream failure is NOT a boundary code).
    const validCreate = await call('member.create', {
      teamSessionId: ROOT_SID,
      caller: { kind: 'human', humanId: ROOT_SID },
      requestToken: 'req-c310',
      payload: { label: 'c3-valid' },
    })

    // The durable override record written by C3.9.
    const durableOverrides = root.domain.repositories.overrides.list(ROOT_SID) as Array<Record<string, any>>

    // The disposer (idempotent per the frozen register semantics).
    let disposeCalls = 0
    const disposer = (): void => {
      disposeCalls += 1
      registrationResult.dispose()
    }
    disposer()
    disposer()

    return {
      world,
      dir,
      capturedChannel,
      handleDisposes,
      disposeCalls,
      spoofedInstance,
      spoofedHuman,
      ghostActor,
      wrongRootActor,
      leaderAsMember,
      spoofedAck,
      foreignProjection,
      validOverride,
      validCreate,
      durableOverrides,
    }
  } catch (err) {
    destroyDir(dir)
    world.effectDisposers.forEach((dispose) => dispose())
    throw new Error(`C3 principal world failing: ${err instanceof Error ? err.message : String(err)}`)
  }
})()

it('C3.1 the registration attaches on the frozen channel with the idempotent disposer', () => {
  expect(c3.capturedChannel).toBe('/team-remote')
  // The wrapper's idempotent flag forwards the registration dispose exactly
  // once, even though the wrapper dispose itself was called twice.
  expect(c3.handleDisposes).toBe(1)
  expect(c3.disposeCalls).toBe(2)
})

it('C3.2 a spoofed instance caller is rejected server-side (TEAM_REMOTE_PRINCIPAL_INVALID)', () => {
  expect(c3.spoofedInstance.ok).toBe(false)
  expect(codeOf(c3.spoofedInstance)).toBe('TEAM_REMOTE_PRINCIPAL_INVALID')
})

it('C3.3 a spoofed human caller is rejected server-side (spoofed-human)', () => {
  expect(c3.spoofedHuman.ok).toBe(false)
  expect(codeOf(c3.spoofedHuman)).toBe('TEAM_REMOTE_PRINCIPAL_INVALID')
})

it('C3.4 a member actor with no durable instance is rejected (unknown-instance)', () => {
  expect(c3.ghostActor.ok).toBe(false)
  expect(codeOf(c3.ghostActor)).toBe('TEAM_REMOTE_PRINCIPAL_INVALID')
})

it('C3.5 a member actor claiming a foreign root is rejected (wrong-root)', () => {
  expect(c3.wrongRootActor.ok).toBe(false)
  expect(codeOf(c3.wrongRootActor)).toBe('TEAM_REMOTE_PRINCIPAL_INVALID')
})

it('C3.6 the leader instance cannot be claimed as an ordinary member', () => {
  expect(c3.leaderAsMember.ok).toBe(false)
  expect(codeOf(c3.leaderAsMember)).toBe('TEAM_REMOTE_PRINCIPAL_INVALID')
})

it('C3.7 a spoofed acknowledgedBy is rejected (spoofed-ack-by)', () => {
  expect(c3.spoofedAck.ok).toBe(false)
  expect(codeOf(c3.spoofedAck)).toBe('TEAM_REMOTE_PRINCIPAL_INVALID')
})

it('C3.8 a foreign TeamSession is rejected with the foreign-team code (never a principal code)', () => {
  expect(c3.foreignProjection.ok).toBe(false)
  expect(codeOf(c3.foreignProjection)).toBe('TEAM_REMOTE_FOREIGN_TEAM')
})

it('C3.9 the valid human actor completes as the host-known operator (durable record written)', () => {
  expect(c3.validOverride.ok).toBe(true)
  const data = c3.validOverride.value.data as Record<string, any>
  expect(data.recordId).toBe('ovr-model-team-g0')
  expect(data.kind).toBe('human-override')
  expect(data.scope).toBe('team')
  expect(data.rootSessionId).toBe(ROOT_SID)
  expect(data.generation).toBe(1)
  expect(data.values.model).toEqual({ kind: 'allow', items: ['m-x'] })
  // The durable authority carries the same record (the store IS the truth).
  const durable = c3.durableOverrides.find((record) => record.recordId === 'ovr-model-team-g0')
  defined(durable, 'the durable override record is missing')
  expect(durable.kind).toBe('human-override')
  expect(durable.generation).toBe(1)
  expect(durable.values.model).toEqual({ kind: 'allow', items: ['m-x'] })
})

it('C3.10 the valid human caller passes the boundary (no principal / foreign code downstream)', () => {
  const code = codeOf(c3.validCreate)
  check(code !== 'TEAM_REMOTE_PRINCIPAL_INVALID', 'a valid human caller must not hit the principal boundary')
  check(code !== 'TEAM_REMOTE_FOREIGN_TEAM', 'a bound-root request must not hit the foreign boundary')
  // The stub world's admission glue is unavailable downstream (a different,
  // non-boundary failure); the boundary itself let the authority through.
  check(code === null || code.length > 0, 'the response carries a code or succeeds')
})

// --- teardown --------------------------------------------------------------------------

describe('p8s6-principal teardown', () => {
  it('the C3 world is disposed (stop semantics)', () => {
    c3.world.effectDisposers.forEach((dispose) => dispose())
    c3.world.effectDisposers.length = 0
    destroyDir(c3.dir)
    expect(true).toBe(true)
  })
})
