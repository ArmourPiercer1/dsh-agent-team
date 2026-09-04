/**
 * p8s6-remote-commands.test.ts — C4 (P8-S6): the production remote
 * commands act ONLY through the runtime/Team service authority
 * (plan §20.4) — no direct repository mutation, no Agent.followup
 * bypass, no local compatibility recompute.
 *
 * Driven end-to-end through the installed A31 seam (a fake
 * `ConnectionLike` captures the production dispatcher on
 * `/team-remote`; every scenario calls it as a remote peer). The stub
 * glue world cannot complete a live admission action (by design — its
 * live ports throw), so the routing proof is: (a) the typed FACADE
 * validation errors pass through verbatim (the request reached the
 * facade, not a repository shortcut) with ZERO durable writes, and
 * (b) the pure-store governance paths (`override.set` /
 * `policyState.set`) complete end-to-end through the named mutation
 * authorities with the durable side-effects in exactly their owning
 * stores.
 *
 * Proven per test:
 *
 *   C4.1 — `override.set` (valid human actor) completes: the response
 *          carries the admitted record; the DURABLE override store
 *          carries the same record; the durable TeamLedger is untouched
 *          (the override writes its owning store only);
 *   C4.2 — `override.get` round-trips the slot winner (no local
 *          recompute — the durable record is the answer);
 *   C4.3 — `policyState.set` to the blueprint's second state completes
 *          through the mutation service (entryId / origin 'human' /
 *          requestedAtStep 0 / effectiveFromStep 1 — the pinned clock);
 *          `policyState.get` now reports the switched state (the
 *          far-future-step read); R2-1: the transition now owns a
 *          DURABLE ledger fact (`policy-state-transitioned`, settled
 *          asynchronously — the synchronous admission is never blocked
 *          by the scheduled write);
 *   C4.4 — a malformed `member.create` (missing payload.label) is
 *          rejected by the FACADE validator (`TEAM_RUNTIME_REQUEST_
 *          MALFORMED` passes through the typed-error invariant) with
 *          zero member rows / zero NEW ledger entries (the only durable
 *          row is the C4.3 policy-state fact);
 *   C4.5 — a malformed `member.followup` (empty payload.prompt) is
 *          rejected the same way with zero writes (no Agent.followup
 *          bypass — the only path is the facade).
 *
 * World: own scratch seam + own root + own blueprint carrying TWO
 * policyStates (default + restricted).
 * @module @dsh-agent-team/runtime/test/p8s6-remote-commands
 */

import { describe, expect, it } from 'vitest'
import {
  destroyDir,
  FileStorageSeam,
  scratchDir,
} from '../../testkit/fault-injection/file-seam.mjs'
import * as hostEntry from '../src/plugin/host.js'
import { stubGlueUrl } from './p8s5a-artifacts.mjs'

// --- the C4 fixture world -----------------------------------------------------------

/** The C4 root session id (distinct from every other phase fixture). */
const ROOT_SID = 'session-p8s6cmroot'
/** The C4 seeded worker / scout (the leader is implied by the root). */
const SEED_WORKER_ID = 'inst-p8s6cmw1'
const SEED_WORKER_CHILD = 'session-child-p8s6cmw1'
const SEED_SCOUT_ID = 'inst-p8s6cms1'
const SEED_SCOUT_CHILD = 'session-child-p8s6cms1'

/** The C4 blueprint: TWO policyStates (default + restricted). */
const BLUEPRINT_SOURCE = [
  '---',
  'schemaVersion: 1',
  'blueprintId: P8S6CM-BP',
  'revision: "1"',
  'leader:',
  '  templateId: leader',
  '  persona: You lead the P8S6CM team.',
  'members:',
  '  - templateId: worker',
  '    displayName: Worker',
  '    persona: You do the P8S6CM work.',
  '  - templateId: scout',
  '    displayName: Scout',
  '    persona: You scout for the P8S6CM team.',
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
  '    description: The C4 default state.',
  '  - id: restricted',
  '    description: The C4 restricted state.',
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

/** The C4 row config (the entry's ONLY input channel). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
function rowConfig(): Record<string, any> {
  return {
    bootPhase: 'create',
    rootSessionId: ROOT_SID,
    blueprintSource: BLUEPRINT_SOURCE,
    generation: 1,
    defaultWorkspace: 'C:/agent-team/work/p8s6cm',
    seedMembers: [
      {
        instanceId: SEED_WORKER_ID,
        templateId: 'worker',
        label: 'c4-seed-worker',
        childSessionId: SEED_WORKER_CHILD,
      },
      {
        instanceId: SEED_SCOUT_ID,
        templateId: 'scout',
        label: 'c4-seed-scout',
        childSessionId: SEED_SCOUT_CHILD,
      },
    ],
    staticModel: { provider: 'p8s6cm-static', model: 'p8s6cm-model-v1' },
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
  readonly ready: Promise<Record<string, any>>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
  [key: string]: any
}

interface TestWorld {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
  ctx: Record<string, any>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
  readonly provided: Record<string, any>
  readonly effectDisposers: Array<() => void>
}

function makeWorld(seam: FileStorageSeam): TestWorld {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
let hostModulePromise: Promise<Record<string, any>> | null = null
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
function loadHost(): Promise<Record<string, any>> {
  if (hostModulePromise === null) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
    hostModulePromise = Promise.resolve(hostEntry as unknown as Record<string, any>)
  }
  return hostModulePromise
}

function check(condition: boolean, label: string): void {
  if (!condition) throw new Error(`C4 scenario guard: ${label}`)
}

/** Assert-value helper (narrowing): the value is neither null nor undefined. */
function defined<T>(value: T, label: string): asserts value is NonNullable<T> {
  if (value === null || value === undefined) throw new Error(`C4 scenario guard: ${label}`)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
async function applyWorld(world: TestWorld, config: Record<string, any>) {
  const host = await loadHost()
  await host.apply(world.ctx, config)
  const teamRoot: TeamRootFacade = world.provided.teamRoot
  check(teamRoot !== undefined, 'apply resolved but never provided teamRoot')
  const root = await teamRoot.ready
  return { host, teamRoot, root }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
function codeOf(response: Record<string, any>): string | null {
  if (response.ok === false) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
    return String((response.error as Record<string, any>).code)
  }
  return null
}

/**
 * R2-1: yield the microtask queue so the SCHEDULED durable write (the
 * policy-state transition's ledger fact — a purely-microtask chain over
 * the synchronous FileStorageSeam) settles before the durable counts are
 * read. The synchronous admission itself is never blocked by it (see the
 * C4.3 immediate `afterPolicyLedger`).
 */
async function settleScheduledWrites(hops = 50): Promise<void> {
  for (let i = 0; i < hops; i++) await Promise.resolve()
}

// --- the scenarios (module top level — the sync shim forbids async it()) -------------

const c4 = await (async () => {
  const dir = scratchDir('p8s6-remote-cmds')
  const seam = new FileStorageSeam(dir)
  const world = makeWorld(seam)
  try {
    const { root } = await applyWorld(world, rowConfig())
    const repos = root.domain.repositories

    const registration = root.seams.remoteHandlerRegistration.current()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
    let capturedDispatcher: ((endpoint: string, payload: unknown) => Promise<Record<string, any>>) | null = null
    const registrationResult = registration({
      rpc: {
        handle: (_channel: string, dispatcher: unknown) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
          capturedDispatcher = dispatcher as (endpoint: string, payload: unknown) => Promise<Record<string, any>>
          return () => {}
        },
      },
    })
    check(capturedDispatcher !== null, 'registration never registered a dispatcher')

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
    async function call(endpoint: string, params: Record<string, any>): Promise<Record<string, any>> {
      const dispatcher = capturedDispatcher
      if (dispatcher === null) throw new Error('C4 scenario guard: dispatcher missing')
      const response = await dispatcher(endpoint, { version: 1, params })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
      return response as Record<string, any>
    }

    const ledgerCount = (): number => (repos.ledger.list() as unknown[]).length
    const memberCount = (): number => (repos.memberInstances.list(ROOT_SID) as unknown[]).length

    check(ledgerCount() === 0, 'the boot world ledger must start empty')
    check(memberCount() === 3, 'the boot world must seed exactly three members')

    // --- C4.1 the override.set through the governance-override authority -----------

    const overrideSet = await call('override.set', {
      teamSessionId: ROOT_SID,
      capability: 'model',
      value: { kind: 'allow', items: ['m-x'] },
      actor: { kind: 'human' },
    })
    const afterOverrideLedger = ledgerCount()

    // --- C4.2 the override.get round-trip (the durable record is the answer) -------

    const overrideGet = await call('override.get', {
      teamSessionId: ROOT_SID,
      capability: 'model',
    })

    // --- C4.3 the policyState switch through the mutation service -------------------

    const policyBefore = await call('policyState.get', { teamSessionId: ROOT_SID })
    const policySet = await call('policyState.set', {
      teamSessionId: ROOT_SID,
      target: { stateId: 'restricted' },
      actor: { kind: 'human' },
    })
    const policyAfter = await call('policyState.get', { teamSessionId: ROOT_SID })
    const afterPolicyLedger = ledgerCount()

    // R2-1: the transition's durable fact is SCHEDULED (fire-and-track) —
    // the synchronous admission above returned before it landed. Settle
    // the microtask chain, then count the durable truth this lane owns.
    await settleScheduledWrites()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
    const policyFactRows = (repos.ledger.list() as Array<Record<string, any>>).filter(
      (entry) => entry.factType === 'policy-state-transitioned',
    )
    const policyFactSettledLedger = ledgerCount()
    const firstPolicyFact = policyFactRows[0]

    // An unknown state id is outside the bound blueprint's closed set.
    const policyUnknown = await call('policyState.set', {
      teamSessionId: ROOT_SID,
      target: { stateId: 'nonexistent' },
      actor: { kind: 'human' },
    })

    // --- C4.4 / C4.5 the malformed admission commands (facade validation) -----------

    const malformedCreate = await call('member.create', {
      teamSessionId: ROOT_SID,
      caller: { kind: 'human', humanId: ROOT_SID },
      requestToken: 'req-c44',
      delegationTemplateId: 'worker',
      payload: {}, // missing label
    })
    const afterCreateMembers = memberCount()
    const afterCreateLedger = ledgerCount()

    const malformedFollowup = await call('member.followup', {
      teamSessionId: ROOT_SID,
      caller: { kind: 'human', humanId: ROOT_SID },
      targetInstanceId: SEED_WORKER_ID,
      requestToken: 'req-c45',
      payload: { prompt: '' }, // empty prompt
    })
    const afterFollowupMembers = memberCount()
    const afterFollowupLedger = ledgerCount()

    registrationResult.dispose()

    return {
      world,
      dir,
      overrideSet,
      afterOverrideLedger,
      overrideGet,
      policyBefore,
      policySet,
      policyAfter,
      afterPolicyLedger,
      policyFactCount: policyFactRows.length,
      policyFactStateId:
        firstPolicyFact !== undefined
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
          ? String(((firstPolicyFact['payload'] as Record<string, any>)['state'] as Record<string, any>)['stateId'])
          : '<missing>',
      policyFactEntryId:
        firstPolicyFact !== undefined
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
          ? String((firstPolicyFact['payload'] as Record<string, any>)['entryId'])
          : '<missing>',
      policyFactSettledLedger,
      policyUnknown,
      malformedCreate,
      afterCreateMembers,
      afterCreateLedger,
      malformedFollowup,
      afterFollowupMembers,
      afterFollowupLedger,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
      durableOverride: (repos.overrides.list(ROOT_SID) as Array<Record<string, any>>).find(
        (record) => record.recordId === 'ovr-model-team-g0',
      ),
    }
  } catch (err) {
    destroyDir(dir)
    world.effectDisposers.forEach((dispose) => dispose())
    throw new Error(`C4 remote-commands world failing: ${err instanceof Error ? err.message : String(err)}`)
  }
})()

it('C4.1 override.set completes through the authority and writes only its owning store', () => {
  expect(c4.overrideSet.ok).toBe(true)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
  const data = c4.overrideSet.value.data as Record<string, any>
  expect(data.recordId).toBe('ovr-model-team-g0')
  expect(data.kind).toBe('human-override')
  expect(data.scope).toBe('team')
  expect(data.generation).toBe(1)
  expect(data.values.model).toEqual({ kind: 'allow', items: ['m-x'] })
  // The durable authority carries the identical record...
  defined(c4.durableOverride, 'the durable override record is missing')
  expect(c4.durableOverride.values.model).toEqual({ kind: 'allow', items: ['m-x'] })
  // ...and the durable TeamLedger was NOT touched (the override writes its
  // own store only — no ledger authority is implied by a governance override).
  expect(c4.afterOverrideLedger).toBe(0)
})

it('C4.2 override.get round-trips the durable slot winner (no local recompute)', () => {
  expect(c4.overrideGet.ok).toBe(true)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
  const data = (c4.overrideGet.value.data as Record<string, any>).override as Record<string, any>
  expect(data.recordId).toBe('ovr-model-team-g0')
  expect(data.kind).toBe('human-override')
  expect(data.generation).toBe(1)
  expect(data.values.model).toEqual({ kind: 'allow', items: ['m-x'] })
})

it('C4.3 policyState.set switches through the mutation service and policyState.get reflects it', () => {
  expect(c4.policyBefore.ok).toBe(true)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
  expect((c4.policyBefore.value.data as Record<string, any>).state.stateId).toBe('default')

  expect(c4.policySet.ok).toBe(true)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
  const data = (c4.policySet.value.data as Record<string, any>).transition as Record<string, any>
  expect(typeof data.entryId).toBe('string')
  check(data.entryId.length > 0, 'entryId is empty')
  expect(data.origin).toBe('human')
  expect(data.state.stateId).toBe('restricted')
  expect(data.requestedAtStep).toBe(0) // the pinned production clock
  expect(data.effectiveFromStep).toBe(1)

  // The far-future-step read reports the switched state (the documented
  // live-store read; the client must read back the state it set).
  expect(c4.policyAfter.ok).toBe(true)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
  expect((c4.policyAfter.value.data as Record<string, any>).state.stateId).toBe('restricted')

  // R2-1 (replaces the S6 premise "the durable TeamLedger is STILL
  // untouched — the transition lives in the named ephemeral mutation
  // store"): the transition now owns a durable ledger fact. The
  // SYNCHRONOUS admission itself was never blocked by the scheduled write,
  // but the write settles within the awaited remote round-trips that
  // followed it (the chain is microtask-only over the sync FileStorageSeam)
  // — so by the time the capture is read the ledger already carries it:
  expect(c4.afterPolicyLedger).toBe(1)
  // The same durable fact, verified against the storage ledger after an
  // explicit settle: exactly one row for this root, the lane's fact type,
  // the admitted transition's payload (entryId + stateId), and nothing else.
  expect(c4.policyFactCount).toBe(1)
  expect(c4.policyFactStateId).toBe('restricted')
  expect(c4.policyFactEntryId).toBe(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
    String((c4.policySet.value.data as Record<string, any>).transition.entryId),
  )
  expect(c4.policyFactSettledLedger).toBe(1)
})

it('C4.3b an unknown policy state is rejected with the closed-set code', () => {
  expect(c4.policyUnknown.ok).toBe(false)
  expect(codeOf(c4.policyUnknown)).toBe('TEAM_REMOTE_POLICY_STATE_UNKNOWN')
})

it('C4.4 a malformed member.create is rejected by the facade validator with zero writes', () => {
  expect(c4.malformedCreate.ok).toBe(false)
  expect(codeOf(c4.malformedCreate)).toBe('TEAM_RUNTIME_REQUEST_MALFORMED')
  expect(c4.afterCreateMembers).toBe(3)
  // R2-1: the only durable row in this world is the C4.3 policy-state
  // fact — the MALFORMED command added zero ledger writes (count
  // unchanged from the settled C4.3 baseline).
  expect(c4.afterCreateLedger).toBe(c4.policyFactSettledLedger)
})

it('C4.5 a malformed member.followup is rejected by the facade validator with zero writes', () => {
  expect(c4.malformedFollowup.ok).toBe(false)
  expect(codeOf(c4.malformedFollowup)).toBe('TEAM_RUNTIME_REQUEST_MALFORMED')
  expect(c4.afterFollowupMembers).toBe(3)
  // R2-1: same zero-write proof — the count is still exactly the settled
  // C4.3 baseline (the malformed followup added nothing).
  expect(c4.afterFollowupLedger).toBe(c4.policyFactSettledLedger)
})

// --- teardown --------------------------------------------------------------------------

describe('p8s6-remote-commands teardown', () => {
  it('the C4 world is disposed (stop semantics)', () => {
    c4.world.effectDisposers.forEach((dispose) => dispose())
    c4.world.effectDisposers.length = 0
    destroyDir(c4.dir)
    expect(true).toBe(true)
  })
})
