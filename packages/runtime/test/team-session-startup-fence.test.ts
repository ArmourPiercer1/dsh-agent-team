/**
 * H1/H2 (supplement guide §4.3) — the production host STARTUP race:
 * the activation listeners are registered at the TOP of `apply()`, but
 * the ownership resolver binds only AFTER the domain open — the window
 * in which a real host's browser-style activation arrives before any
 * Team classification is possible (INV-4: classification PENDING, never
 * "unmanaged"):
 *
 *   H1 — foreign TEAM activation (an `agent/created` of a Team-managed
 *        session that arrived WITHOUT the Team glue — no ownership
 *        guard, no exact claim — e.g. the browser opening the team
 *        session's page while the row's domain open is still pending):
 *        it must NOT PASS during the window (the fence suspends the
 *        awaited listener — no early pass, no early veto). Once the
 *        domain opens and the resolver binds → VETO (the typed
 *        TeamSessionActivationInterceptedError).
 *   H2 — the same startup window, an ORDINARY session (unmanaged): the
 *        activation likewise suspends (no early pass), and after the
 *        resolver bind it classifies unmanaged → PASS (the ordinary
 *        open proceeds upstream-equivalently).
 *
 * World shape (the production restart cycle over ONE medium, the
 * p8s7r4 / t12b1 / rmr-create-or-open pattern over a REAL file storage
 * seam):
 *   phase 1 — a full production `create` (ungated): mints the durable
 *             TeamSession for the root.
 *   phase 2 — a production `create-or-open` RESTART whose seam `open`
 *             is GATED (the domain open — and therefore the
 *             `bindOwnershipResolver` right after it — is deferred
 *             behind the test's release). The `apply` call is NOT
 *             awaited; its synchronous prefix has already registered
 *             the activation listeners (verified before driving).
 *
 * Runner note: the plain-node vitest shim forbids async `it()` bodies —
 * the scenario runs at module load (top-level await), the `it` bodies
 * assert synchronously (the p8s7r4 pattern).
 * @module @dsh-agent-team/runtime/test/team-session-startup-fence
 */

import { describe, expect, it } from 'vitest'

import {
  destroyDir,
  FileStorageSeam,
  scratchDir,
} from '../../testkit/fault-injection/file-seam.mjs'
import * as hostEntry from '../src/plugin/host.js'
import type { TeamPluginHostContext } from '../src/plugin/host.js'
import {
  TeamSessionActivationInterceptedError,
} from '../src/plugin/team-session-activation.js'
import { stubGlueUrl } from './p8s5a-artifacts.mjs'

// --- the fixture identities -----------------------------------------------------

const ROOT_SID = 'session-startupfenceroot'
/** The ordinary (unmanaged) session of H2 — no Team row, no binding. */
const ORDINARY_SID = 'session-startupfence-ordinary'

/** The row blueprint (own id; structure mirrors the rmr fixture). */
const BLUEPRINT_SOURCE = [
  '---',
  'schemaVersion: 1',
  'blueprintId: STARTUP-FENCE-BP',
  'revision: "1"',
  'leader:',
  '  templateId: leader',
  '  persona: You lead the startup-fence team.',
  'members:',
  '  - templateId: worker',
  '    displayName: Worker',
  '    persona: You do the startup-fence work.',
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
  '    description: The startup-fence default state.',
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
    bootPhase: 'create',
    rootSessionId: ROOT_SID,
    blueprintSource: BLUEPRINT_SOURCE,
    generation: 1,
    defaultWorkspace: 'C:/agent-team/work/startup-fence',
    seedMembers: [],
    staticModel: { provider: 'startupfence-static', model: 'startupfence-model-v1' },
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

// --- the gated seam (the "domain open 被人为延迟" handle) ------------------------

/**
 * A StorageDomainSeam whose `open` awaits a release gate (ALL opens
 * share it — in practice apply opens exactly once). `closeAll` is a
 * pass-through. The structural seam guard (`typeof open/closeAll ===
 * 'function'`) still accepts it — the host builds nothing else from the
 * seam before the domain step.
 */
function makeGatedSeam(real: FileStorageSeam): {
  seam: FileStorageSeam
  release: () => void
  openArmed: () => boolean
} {
  let releaseGate: () => void = () => {}
  const gate = new Promise<void>((resolve) => {
    releaseGate = resolve
  })
  let openSeen = false
  const gated = {
    open: (spec: Parameters<FileStorageSeam['open']>[0]) => {
      openSeen = true
      return gate.then(() => real.open(spec))
    },
    closeAll: () => real.closeAll(),
  }
  return {
    seam: gated as unknown as FileStorageSeam,
    release: releaseGate,
    openArmed: () => openSeen,
  }
}

// --- the test Cordis context (listener capture) ----------------------------------

/** The host's `agent/created` listener body (the awaited fence veto —
 *  always promise-returning: `beforeAgentCreated` is async). */
type CreatedListener = (payload: {
  readonly agent: unknown
  readonly source: string
  readonly signal?: AbortSignal
}) => Promise<void>

/** One plain-object Cordis context that CAPTURES the event listeners
 *  and the provided services (the teamRoot facade is provided by
 *  `apply` under the `teamRoot` key — the t12b1 pattern). */
function makeListenerWorld(seam: FileStorageSeam): {
  ctx: TeamPluginHostContext
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
  provided: Record<string, any>
  createdListeners: CreatedListener[]
  disposedListeners: ((payload: { readonly agent: unknown }) => void)[]
} {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
  const provided: Record<string, any> = {
    agents: { create: async () => {}, resume: async () => {} },
    sessionPersistence: { ensure: async () => {} },
    workspaceRegistry: { list: () => [], resolveByPath: async () => undefined },
    teamStorageSeam: seam,
  }
  const createdListeners: CreatedListener[] = []
  const disposedListeners: ((payload: { readonly agent: unknown }) => void)[] = []
  const raw = {
    get: (name: string) => provided[name],
    provide: (name: string, value: unknown) => {
      provided[name] = value
    },
    effect: (factory: () => () => void) => {
      void factory()
    },
    on: (name: string, listener: unknown) => {
      if (name === 'agent/created') createdListeners.push(listener as CreatedListener)
      if (name === 'agent/disposed') {
        disposedListeners.push(listener as (p: { readonly agent: unknown }) => void)
      }
    },
  }
  return {
    ctx: raw as unknown as TeamPluginHostContext,
    provided,
    createdListeners,
    disposedListeners,
  }
}

/** True iff the promise settled (resolved OR rejected) within `ms`. */
function settles(p: Promise<unknown>, ms: number): Promise<boolean> {
  let done = false
  void p.then(
    () => {
      done = true
    },
    () => {
      done = true
    },
  )
  return new Promise<boolean>((resolve) => {
    setTimeout(() => resolve(done), ms)
  })
}

/**
 * Bounded poll until `probe()` is truthy (the test's synchronization
 * handle — NOT a production retry: a fixed poll interval, a hard
 * deadline, and a loud failure when the deadline is reached). Returns
 * `true` on success; throws when `timeoutMs` elapses first.
 */
function waitUntil(probe: () => boolean, timeoutMs: number, stepMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs
  return new Promise<boolean>((resolve, reject) => {
    const tick = () => {
      if (probe()) {
        resolve(true)
        return
      }
      if (Date.now() >= deadline) {
        reject(new Error('waitUntil: deadline reached before the probe went true'))
        return
      }
      setTimeout(tick, stepMs)
    }
    tick()
  })
}

// --- the scenario (module-level, the dual-surface pattern) ------------------------

const SCRATCH = scratchDir('startup-fence')

// --- phase 1: the real production create (ungated) — seeds the durable world -----
{
  const seeded = makeListenerWorld(new FileStorageSeam(SCRATCH))
  await hostEntry.apply(seeded.ctx, rowConfig({}))
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
  const root1: any = await seeded.provided.teamRoot.ready
  // The durable TeamSession for the root is committed (H1's classification
  // basis at phase-2 bind time).
  expect(root1.domain.repositories.teamSessions.get(ROOT_SID)).not.toBe(undefined)
  await root1.close()
}

// --- phase 2: the create-or-open RESTART with the GATED domain open --------------
const { seam: gatedSeam, release, openArmed } = makeGatedSeam(new FileStorageSeam(SCRATCH))
const world2 = makeListenerWorld(gatedSeam)
const apply2 = hostEntry.apply(world2.ctx, rowConfig({ bootPhase: 'create-or-open' }))

// The apply call ran its SYNCHRONOUS prefix already (no await precedes the
// listener registration): both activation listeners are registered.
expect(world2.createdListeners.length).toBe(1)
expect(world2.disposedListeners.length).toBe(1)

// Synchronize to the suspended domain open: apply has reached the gated
// `seam.open` and is awaiting it — the resolver is UNBOUND, the
// classification-pending window is OPEN (a test synchronization handle
// with a hard deadline — not a production retry).
await waitUntil(() => openArmed(), 5000, 10)

// The EXACT Agent objects the foreign activations announce (the fence keys
// on object identity — the manual payloads carry plain structural agents).
const FOREIGN_AGENT = { id: ROOT_SID }
const ORDINARY_AGENT = { id: ORDINARY_SID }

// Drive the browser-style activations THROUGH the registered listener
// (the production path: upstream announces, the listener is AWAITED).
// H1: the foreign activation of the TEAM-MANAGED root (a cold browser
// open of the team session — source 'resume'); H2: the ORDINARY session
// (source 'startup').
const h1Promise = world2.createdListeners[0]!({ agent: FOREIGN_AGENT, source: 'resume' })
const h2Promise = world2.createdListeners[0]!({ agent: ORDINARY_AGENT, source: 'startup' })

// Both activations SUSPEND in the classification-pending window (no early
// PASS, no early veto) — the awaited listener does not settle.
const h1SettledBefore = await settles(h1Promise, 150)
const h2SettledBefore = await settles(h2Promise, 150)
// The domain open was reached (the gate is armed) — apply is suspended at
// exactly the deferred point (domain open / resolver bind).
const gateArmedBeforeRelease = openArmed()

// Release: the domain open proceeds, the domain is ADOPTED (the phase-1
// TeamSession row makes the root Team-managed), and the host binds the
// ownership resolver right after it.
release()
await apply2
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
const root2: any = await world2.provided.teamRoot.ready

// --- the frozen observations (the it bodies assert synchronously) ----------------

const H1_RESULT: { settled: boolean; outcome: 'pass' | 'veto' | 'other'; error?: unknown } =
  await (async () => {
    try {
      await h1Promise
      return { settled: true, outcome: 'pass' as const }
    } catch (error) {
      return {
        settled: true,
        outcome: error instanceof TeamSessionActivationInterceptedError
          ? ('veto' as const)
          : ('other' as const),
        error,
      }
    }
  })()
const H2_OUTCOME: 'pass' | 'other' = await (async () => {
  try {
    await h2Promise
    return 'pass' as const
  } catch {
    return 'other' as const
  }
})()

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- untyped test payload / hidden internal state
await root2.close()
destroyDir(SCRATCH)

// --- the assertions ---------------------------------------------------------------

describe('startup fence (supplement guide §4.3, INV-4)', () => {
  it('H1 window: the foreign Team activation does NOT pass while the resolver is unbound (classification pending)', () => {
    expect(h1SettledBefore).toBe(false)
    // and the world was genuinely suspended at the deferred domain open
    expect(gateArmedBeforeRelease).toBe(true)
  })

  it('H2 window: the ordinary activation likewise does not pass early (no "unmanaged" before the bind)', () => {
    expect(h2SettledBefore).toBe(false)
  })

  it('H1 bind: after the domain opens and the resolver binds, the foreign Team activation is VETOED with the typed intercept error', () => {
    expect(H1_RESULT.settled).toBe(true)
    expect(H1_RESULT.outcome).toBe('veto')
    if (H1_RESULT.error !== undefined) {
      expect(H1_RESULT.error).toBeInstanceOf(TeamSessionActivationInterceptedError)
    }
  })

  it('H2 bind: after the resolver binds, the ordinary session classifies unmanaged and PASSES', () => {
    expect(H2_OUTCOME).toBe('pass')
  })
})
