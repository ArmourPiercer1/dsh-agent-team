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
 * S1–S5 (PR #31 minimal supplement — startup-failure isolation): the
 * bootstrap rejects BEFORE the resolver binds (the domain open itself
 * fails): without isolation, every later ordinary `agent/created` (the
 * fence listeners are registered `{ global: true }` at the top of
 * `apply()`) would await the `ownershipReady` barrier forever on a row
 * that keeps running (a failed boot is terminal, but the row stops only
 * on its own teardown). The host now closes its fence on the bootstrap
 * rejection:
 *   S1 — the fence listener is registered (apply top) and the resolver
 *        is unbound when the bootstrap fails before the domain open
 *        settles;
 *   S2 — an ordinary `agent/created` suspended in the window SETTLES
 *        (pass-through) after the bootstrap failure — no permanent hang
 *        on `ownershipReady`;
 *   S3 — a NEW ordinary activation after the failure passes through
 *        immediately (the failed row no longer blocks ordinary
 *        non-Team sessions);
 *   S4 — the normal successful bootstrap path is unchanged (the
 *        successful world still vetoes the foreign Team activation and
 *        passes the ordinary one — the fence stays armed, not closed);
 *   S5 — the row-stop backstop's `close()` after the bootstrap-failure
 *        close is exception-free (idempotent double close).
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
import { agentPresetsStandardDouble } from './agent-presets-double.mjs'

// --- the fixture identities -----------------------------------------------------

const ROOT_SID = 'session-startupfenceroot'
/** The ordinary (unmanaged) session of H2 — no Team row, no binding. */
const ORDINARY_SID = 'session-startupfence-ordinary'

// §7.4 (pre-flip): a v3 document declares BOTH authority documents; both are
// `rules: []`, which is the honest zero this fixture always meant (an absent
// pre-v3 carrier already reads as `{rules: []}`, and an empty hard envelope
// narrows nothing). No test here reaches the permission-mutation lane, so the
// v3 ceiling gate stays unspent — the document moved, this fixture's claim did not.
/** The row blueprint (own id; structure mirrors the rmr fixture). */
const BLUEPRINT_SOURCE = [
  '---',
  'schemaVersion: 3',
  'permissionMutationEnvelope:',
  '  rules: []',
  'teamHardEnvelope:',
  '  rules: []',
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

/**
 * A StorageDomainSeam whose `open` awaits a gate that REJECTS on release
 * (the "domain open 失败" handle — the startup-failure-isolation world):
 * the bootstrap's `await createOrOpenTeamDomainDetailed(seam)` settles
 * with the injected error BEFORE the `bindOwnershipResolver` right after
 * the open — the exact failure in which the fence's `ownershipReady`
 * barrier would never settle without the startup-failure isolation.
 */
function makeFailingSeam(real: FileStorageSeam): {
  seam: FileStorageSeam
  release: () => void
  openArmed: () => boolean
} {
  let settleGate: (fail: boolean) => void = () => {}
  const gate = new Promise<void>((resolve, reject) => {
    settleGate = (fail) =>
      fail
        ? reject(new Error('injected domain-open failure (startup-failure isolation world)'))
        : resolve()
  })
  let openSeen = false
  const failing = {
    open: (spec: Parameters<FileStorageSeam['open']>[0]) => {
      openSeen = true
      return gate.then(() => real.open(spec))
    },
    closeAll: () => real.closeAll(),
  }
  return {
    seam: failing as unknown as FileStorageSeam,
    release: () => settleGate(true),
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
 *  `apply` under the `teamRoot` key — the t12b1 pattern). The effect
 *  DISPOSERS are captured too: the host registers the row-stop backstop
 *  as an effect, and the S-world drives a real row stop through them
 *  (the double close after the bootstrap-failure close, S5). */
function makeListenerWorld(seam: FileStorageSeam): {
  ctx: TeamPluginHostContext
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
  provided: Record<string, any>
  createdListeners: CreatedListener[]
  disposedListeners: ((payload: { readonly agent: unknown }) => void)[]
  effectDisposers: (() => void)[]
} {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
  const provided: Record<string, any> = {
    agents: { create: async () => {}, resume: async () => {} },
    sessionPersistence: { ensure: async () => {} },
    workspaceRegistry: { list: () => [], resolveByPath: async () => undefined },
    teamStorageSeam: seam,
    // pre-alpha3 W3-A (F1): the agentPresets service double (W2-A fail-closed
    // contract — service-absent worlds without a row preset id no longer bind).
    agentPresets: agentPresetsStandardDouble(),
  }
  const createdListeners: CreatedListener[] = []
  const disposedListeners: ((payload: { readonly agent: unknown }) => void)[] = []
  const effectDisposers: (() => void)[] = []
  const raw = {
    get: (name: string) => provided[name],
    provide: (name: string, value: unknown) => {
      provided[name] = value
    },
    effect: (factory: () => () => void) => {
      effectDisposers.push(factory())
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
    effectDisposers,
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

// --- phase 3: the RESTART whose domain open FAILS (startup-failure
// isolation — the bootstrap rejects before the resolver bind) ------------
// The world shape mirrors phase 2 exactly (the same production restart
// cycle over a seeded medium); the gated `open` REJECTS on release, so
// the bootstrap's rejection arrives BEFORE the `bindOwnershipResolver`
// right after the open — the resolver never binds, while the row keeps
// running (the test context never stops the row). Without the
// startup-failure isolation, every later ordinary `agent/created` (the
// fence listeners are process-wide) would await `ownershipReady`
// forever.
const SCRATCH_FAIL = scratchDir('startup-fence-fail')
{
  const seeded = makeListenerWorld(new FileStorageSeam(SCRATCH_FAIL))
  await hostEntry.apply(seeded.ctx, rowConfig({}))
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
  const rootSeed: any = await seeded.provided.teamRoot.ready
  await rootSeed.close()
}
const { seam: failingSeam, release: failRelease, openArmed: failOpenArmed } = makeFailingSeam(
  new FileStorageSeam(SCRATCH_FAIL),
)
const world3 = makeListenerWorld(failingSeam)
const apply3 = hostEntry.apply(world3.ctx, rowConfig({ bootPhase: 'create-or-open' }))

// S1 setup: the fence is armed at the TOP of `apply` (the listener is
// registered in the synchronous prefix) while the resolver is UNBOUND
// (the domain open is suspended at the gate — the test synchronization
// handle with a hard deadline, not a production retry).
const s1ListenerRegistered = world3.createdListeners.length === 1
await waitUntil(() => failOpenArmed(), 5000, 10)

// S2 setup: an ORDINARY `agent/created` arrives in the window (the
// browser-style activation driven THROUGH the registered listener — the
// production path; the listener is AWAITED).
const FAIL_ORDINARY_AGENT = { id: 'session-startupfence-fail-ordinary' }
const s2Promise = world3.createdListeners[0]!({ agent: FAIL_ORDINARY_AGENT, source: 'startup' })
const s2SuspendedBefore = await settles(s2Promise, 150)

// Release: the domain open REJECTS → the bootstrap rejects BEFORE the
// resolver bind → `ready` settles rejected (the rejection, the console
// error, and the row-stop cleanup semantics are all unchanged by the
// supplement — only the fence close is added).
failRelease()
const READY3_REJECTION: { rejected: boolean; message: string } = await (async () => {
  try {
    await world3.provided.teamRoot.ready
    return { rejected: false, message: '' }
  } catch (error) {
    return { rejected: true, message: error instanceof Error ? error.message : String(error) }
  }
})()

// S2 observation: the suspended ordinary waiter SETTLED after the
// bootstrap failure (the fence closed on the rejection → the waiter
// wakes and passes through) — no permanent hang on `ownershipReady`.
// (Guards on `s2SettledAfter` keep a regression a finite 'unsettled'
// failure instead of a module-load hang.)
const s2SettledAfter = await settles(s2Promise, 500)
const S2_OUTCOME: 'pass' | 'other' | 'unsettled' = s2SettledAfter
  ? await (async () => {
      try {
        await s2Promise
        return 'pass' as const
      } catch {
        return 'other' as const
      }
    })()
  : 'unsettled'

// S3: a NEW ordinary activation AFTER the failure — it must pass
// through immediately (the failed row no longer blocks ordinary
// non-Team sessions of this process).
const FAIL_ORDINARY_AGENT_2 = { id: 'session-startupfence-fail-ordinary-2' }
const s3Promise = world3.createdListeners[0]!({ agent: FAIL_ORDINARY_AGENT_2, source: 'startup' })
const s3Settled = await settles(s3Promise, 500)
const S3_OUTCOME: 'pass' | 'other' | 'unsettled' = s3Settled
  ? await (async () => {
      try {
        await s3Promise
        return 'pass' as const
      } catch {
        return 'other' as const
      }
    })()
  : 'unsettled'

// S5: the row stop now runs its backstop (the captured effect disposers
// — the production row-stop semantics; they close the fence AGAIN after
// the bootstrap-failure close, then dispose the registration and close
// the root/domain when the bootstrap had settled). The double close must
// be exception-free: the disposer call itself must not throw, and the
// backstop's async body (given a few turns to run) is fully
// try/catch-guarded in production — a throw there would be an unhandled
// rejection, which the node test process reports as a suite failure
// (the test shim's ambient `process` type exposes no `.on`, so the
// crash-on-unhandled-rejection default is the verification backstop).
let s5DisposerThrew = false
try {
  for (const dispose of world3.effectDisposers) dispose()
} catch {
  s5DisposerThrew = true
}
await new Promise<void>((resolve) => {
  setTimeout(resolve, 50)
})

destroyDir(SCRATCH_FAIL)

// --- the S assertions ----------------------------------------------------------------

describe('startup-failure isolation (PR #31 supplement: the bootstrap rejection closes the fence)', () => {
  it('S1: the fence listener is registered (apply top) and the resolver is unbound when the bootstrap fails before the domain open settles', () => {
    expect(s1ListenerRegistered).toBe(true)
    expect(READY3_REJECTION.rejected).toBe(true)
    expect(READY3_REJECTION.message).toContain('injected domain-open failure')
  })

  it('S2: the ordinary agent/created waiter suspended in the window SETTLES (pass-through) after the bootstrap failure — no permanent hang on ownershipReady', () => {
    expect(s2SuspendedBefore).toBe(false)
    expect(s2SettledAfter).toBe(true)
    expect(S2_OUTCOME).toBe('pass')
  })

  it('S3: a NEW ordinary activation after the failure passes through immediately (the failed Team row no longer blocks ordinary sessions)', () => {
    expect(s3Settled).toBe(true)
    expect(S3_OUTCOME).toBe('pass')
  })

  it('S4: the normal successful bootstrap path is unchanged — the successful world still VETOES the foreign Team activation and PASSES the ordinary one (the fence stays armed, not closed by this supplement)', () => {
    expect(H1_RESULT.outcome).toBe('veto')
    expect(H2_OUTCOME).toBe('pass')
  })

  it('S5: the row-stop backstop close after the bootstrap-failure close is exception-free (idempotent double close)', () => {
    expect(s5DisposerThrew).toBe(false)
  })
})
