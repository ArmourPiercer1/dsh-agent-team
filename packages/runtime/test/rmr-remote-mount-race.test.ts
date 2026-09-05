/**
 * rmr-remote-mount-race — the bounded wait for the `connection` public
 * service (remote-mount-race fix, root cause A): the deterministic
 * regression test for the user-world 405.
 *
 * The production entry (`host.ts` `apply`) mounts the Remote contract v1
 * dispatcher onto the public connection seam at the mount step. The web
 * profile's client-connection row provides the `connection` service on an
 * INDEPENDENT fiber (no dependency edge to the team row) — on a slow boot
 * the service can legitimately be ABSENT at the mount step. The pre-fix
 * entry read `ctx.get('connection')` exactly ONCE and decided forever: a
 * lost race meant a permanent SILENT skip (the user-world 405 — POST
 * /team-remote/* hit the frontend static fallback, no route, nothing
 * logged; live-confirmed in the user's world copy: the one-shot read saw
 * `undefined` at +23 ms, the service existed by +717 ms, the mount was
 * skipped forever).
 *
 * Fixed semantics proven here (real timers; the window is small):
 *   1. late mount   — absent at the mount step, appearing inside the
 *                     window: the facade goes pending → mounted; the
 *                     dispatcher answers through the EXACT late-appearing
 *                     service object (identity, as in T12-M4) with the
 *                     frozen envelope;
 *   2. window expiry — absent forever (headless): pending → skipped with
 *                     the window named in the reason; the boot succeeds;
 *   3. late malformed — a broken service appears inside the window:
 *                     pending → failed with rpc.handle named; the boot
 *                     itself has ALREADY settled (no throw after ready);
 *   4. immediate    — remoteMountWaitMs: 0 (the legacy decision): absent
 *                     at the mount step → skipped AT ONCE, no watcher
 *                     effect armed (exactly one row effect, the backstop);
 *   5. row stop     — the watcher's effect settles a terminal skipped when
 *                     the row stops while still pending (no dangling
 *                     pending on the facade);
 *   6. validation   — a negative remoteMountWaitMs rejects the bootstrap
 *                     (TEAM_PLUGIN_CONFIG_INVALID, the field named).
 *
 * Drives the REAL production entry with a plain-object Cordis context +
 * the real file storage seam; the `connection` service is the EXACT plain
 * object placed on ctx (no faked ConnectionLike substituted). The
 * scenarios run at module top level — the same convention as t12m4
 * (the sync shim forbids async `it()` bodies).
 */
import { describe, expect, it } from 'vitest'
import {
  destroyDir,
  FileStorageSeam,
  scratchDir,
} from '../../testkit/fault-injection/file-seam.mjs'
import { REMOTE_RPC_CHANNEL } from '../../remote/src/handlers/register.js'
import {
  isTeamPluginError,
  TEAM_PLUGIN_ERROR_CODES,
} from '../src/plugin/types.js'
import type { TeamPluginConfig } from '../src/plugin/types.js'
import * as hostEntry from '../src/plugin/host.js'
import type { TeamPluginHostContext } from '../src/plugin/host.js'
import { stubGlueUrl } from './p8s5a-artifacts.mjs'

// --- the RMR fixture world (own ids; structure mirrors T12M4) --------------

/** The RMR root session id (distinct from every other phase fixture). */
const ROOT_SID = 'session-rmrroot'
/** The RMR seeded worker. */
const SEED_WORKER_ID = 'inst-rmrseedw1'
const SEED_WORKER_CHILD = 'session-child-rmrseedw1'

/** The RMR blueprint (own id; structure mirrors the T12M4 fixture). */
const BLUEPRINT_SOURCE = [
  '---',
  'schemaVersion: 1',
  'blueprintId: RMR-BP',
  'revision: "1"',
  'leader:',
  '  templateId: leader',
  '  persona: You lead the RMR team.',
  'members:',
  '  - templateId: worker',
  '    displayName: Worker',
  '    persona: You do the RMR work.',
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
  '  deny:',
  '    - delete-team',
  'policyStates:',
  '  - id: default',
  '    description: "Default state."',
  'quotas:',
  '  team:',
  '    maxInstances: 4',
  '    maxConcurrent: 4',
  '  members:',
  '    maxInstances: 2',
  '    maxConcurrent: 2',
  'metadata: {}',
  '---',
].join('\n')

/** The RMR row config (the entry's ONLY input channel). */
function rowConfig(overrides: Partial<TeamPluginConfig> = {}): TeamPluginConfig {
  return {
    bootPhase: 'create',
    rootSessionId: ROOT_SID,
    blueprintSource: BLUEPRINT_SOURCE,
    generation: 1,
    defaultWorkspace: 'C:/agent-team/work/rmr',
    seedMembers: [
      {
        instanceId: SEED_WORKER_ID,
        templateId: 'worker',
        label: 'rmr-seed-worker',
        childSessionId: SEED_WORKER_CHILD,
      },
    ],
    staticModel: { provider: 'rmr-static', model: 'rmr-model-v1' },
    deniedSelection: null,
    mcpServer: null,
    environmentFacts: [
      { domain: 'tool', subject: 'web', available: true, generation: 1 },
      { domain: 'skill', subject: 'base', available: true, generation: 1 },
    ],
    externalPolicyFacts: { hard: {}, capabilityExists: {} },
    glueUrl: stubGlueUrl(),
    ...overrides,
  }
}

// --- the test Cordis context + the seam simulation (as in T12M4) -----------

interface World {
  ctx: TeamPluginHostContext
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
  readonly provided: Record<string, any>
  readonly effectDisposers: Array<() => void>
}

/** One plain-object Cordis context (get / provide / effect). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
function makeWorld(extra: Record<string, any>): World {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
  const provided: Record<string, any> = {
    agents: { create: async () => {}, resume: async () => {} },
    sessionPersistence: { ensure: async () => {} },
    ...extra,
  }
  const effectDisposers: Array<() => void> = []
  const ctx: TeamPluginHostContext = {
    get: (name: string) => provided[name],
    provide: (name: string, value: unknown) => {
      provided[name] = value
    },
    effect: (factory: () => () => void, _label?: string) => {
      effectDisposers.push(factory())
    },
  }
  return { ctx, provided, effectDisposers }
}

/** The DSH-shaped seam handler (the extra signal argument is ignored). */
type DshShapeHandler = (
  endpoint: string,
  payload: unknown,
  signal?: unknown,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
) => Promise<Record<string, any>>

/**
 * The seam SIMULATION: a plain-object 'connection' service whose
 * `rpc.handle` captures the channel + the DSH-shaped dispatcher (the
 * production wiring consumes EXACTLY this object from ctx).
 */
function makeConnectionSink() {
  const captured: {
    channel: string | null
    handler: DshShapeHandler | null
    rpcThis: unknown
    calls: string[]
  } = { channel: null, handler: null, rpcThis: null, calls: [] }
  const state = { disposed: false }
  const rpc = {
    handle(channel: string, handler: DshShapeHandler) {
      captured.channel = channel
      captured.handler = handler
      captured.rpcThis = this
      captured.calls.push(channel)
      return async () => {
        state.disposed = true
      }
    },
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
  const connection: Record<string, any> = { rpc }
  return { connection, captured, state }
}

/** Poll a condition on the real timer (bounded; never hangs the suite). */
async function waitFor(check: () => boolean, timeoutMs: number): Promise<boolean> {
  const startedAt = Date.now()
  for (;;) {
    if (check()) return true
    if (Date.now() - startedAt > timeoutMs) return false
    await new Promise((resolve) => {
      setTimeout(resolve, 25)
    })
  }
}

/** Await the row-stop backstop's microtask chain (ready already settled). */
async function flushMicrotasks(): Promise<void> {
  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()
}

// --- the scenarios (module top level — the sync shim forbids async it()) ----

// --- scenario 1: late mount (the race regression: absent → appears) --------
const dir1 = scratchDir('rmr-late-mount')
destroyDir(dir1) // idempotent start-state
const sink1 = makeConnectionSink()
const world1 = makeWorld({ teamStorageSeam: new FileStorageSeam(dir1) })
await hostEntry.apply(world1.ctx, rowConfig({ remoteMountWaitMs: 10_000 }))
const teamRoot1 = world1.provided.teamRoot
const root1 = await teamRoot1.ready
// The mount step has passed (ready settled) and the service is still
// absent — the facade must show the intermediate state.
const pendingAtReady1 = teamRoot1.remote
// The late provider row settles: the service appears on ctx.
world1.provided.connection = sink1.connection
const mountedEventually1 = await waitFor(() => {
  const state = teamRoot1.remote
  return state !== undefined && state.state === 'mounted'
}, 5000)
const lateHandler: DshShapeHandler | null = sink1.captured.handler
let lateWireOk: Record<string, unknown> | null = null
if (lateHandler !== null) {
  lateWireOk = await lateHandler(
    'team.getProjection',
    { version: 1, params: { teamSessionId: ROOT_SID } },
    undefined,
  )
}
for (const dispose of world1.effectDisposers) dispose()
await flushMicrotasks()
destroyDir(dir1)

// --- scenario 2: window expiry (headless; absent forever) -------------------
const dir2 = scratchDir('rmr-expiry')
destroyDir(dir2) // idempotent start-state
const world2 = makeWorld({ teamStorageSeam: new FileStorageSeam(dir2) })
await hostEntry.apply(world2.ctx, rowConfig({ remoteMountWaitMs: 200 }))
const teamRoot2 = world2.provided.teamRoot
const root2 = await teamRoot2.ready
const pendingAtReady2 = teamRoot2.remote
const terminalEventually2 = await waitFor(() => {
  const state = teamRoot2.remote
  return state !== undefined && state.state !== 'pending'
}, 5000)
const terminal2 = teamRoot2.remote
for (const dispose of world2.effectDisposers) dispose()
await flushMicrotasks()
destroyDir(dir2)

// --- scenario 3: late malformed (broken service appears in the window) -----
const dir3 = scratchDir('rmr-late-malformed')
destroyDir(dir3) // idempotent start-state
const world3 = makeWorld({ teamStorageSeam: new FileStorageSeam(dir3) })
await hostEntry.apply(world3.ctx, rowConfig({ remoteMountWaitMs: 10_000 }))
const teamRoot3 = world3.provided.teamRoot
// The boot must SUCCEED — the malformation appears only AFTER ready.
const root3 = await teamRoot3.ready
world3.provided.connection = { rpc: {} }
const failedEventually3 = await waitFor(() => {
  const state = teamRoot3.remote
  return state !== undefined && state.state === 'failed'
}, 5000)
const terminal3 = teamRoot3.remote
for (const dispose of world3.effectDisposers) dispose()
await flushMicrotasks()
destroyDir(dir3)

// --- scenario 4: immediate (remoteMountWaitMs: 0 — the legacy decision) ----
const dir4 = scratchDir('rmr-immediate')
destroyDir(dir4) // idempotent start-state
const world4 = makeWorld({ teamStorageSeam: new FileStorageSeam(dir4) })
await hostEntry.apply(world4.ctx, rowConfig({ remoteMountWaitMs: 0 }))
const teamRoot4 = world4.provided.teamRoot
const root4 = await teamRoot4.ready
const immediateState4 = teamRoot4.remote
// Give a (nonexistent) watcher time to change anything: the state must be
// stable — the immediate decision armed no wait.
await new Promise((resolve) => {
  setTimeout(resolve, 150)
})
const unchanged4 = teamRoot4.remote
for (const dispose of world4.effectDisposers) dispose()
await flushMicrotasks()
destroyDir(dir4)

// --- scenario 5: row stop while pending (no dangling pending) ---------------
const dir5 = scratchDir('rmr-row-stop')
destroyDir(dir5) // idempotent start-state
const world5 = makeWorld({ teamStorageSeam: new FileStorageSeam(dir5) })
await hostEntry.apply(world5.ctx, rowConfig({ remoteMountWaitMs: 30_000 }))
const teamRoot5 = world5.provided.teamRoot
const root5 = await teamRoot5.ready
const pendingBeforeStop5 = teamRoot5.remote
// Row stop while still pending: the watcher's effect must settle a
// terminal skipped (the facade must never dangle on `pending`).
for (const dispose of world5.effectDisposers) dispose()
const stoppedState5 = teamRoot5.remote
destroyDir(dir5)

// --- scenario 6: config validation (negative window rejects the boot) ------
const world6 = makeWorld({})
await hostEntry.apply(world6.ctx, rowConfig({ remoteMountWaitMs: -1 }))
const err6: unknown = await world6.provided.teamRoot.ready.then(
  () => null,
  (error: unknown) => error,
)

// --- the assertions (sync it() bodies) --------------------------------------

describe('RMR the bounded wait for the connection service (root cause A)', () => {
  it('scenario 1: absent at the mount step → pending; appearing late → mounted (the race regression)', () => {
    expect(root1 !== undefined && root1 !== null).toBe(true)
    // at ready (the mount step has passed) the state is the intermediate one
    expect(pendingAtReady1).toEqual({ state: 'pending' })
    // the late appearance settles a terminal mounted ...
    expect(mountedEventually1).toBe(true)
    expect(teamRoot1.remote).toEqual({
      state: 'mounted',
      channel: REMOTE_RPC_CHANNEL,
    })
    // ... through the EXACT service object that appeared (identity).
    expect(sink1.captured.channel).toBe(REMOTE_RPC_CHANNEL)
    expect(sink1.captured.calls).toEqual([REMOTE_RPC_CHANNEL])
    expect(sink1.captured.rpcThis).toBe(sink1.connection.rpc)
  })

  it('scenario 1: the late-mounted dispatcher answers with the frozen envelope', () => {
    expect(lateWireOk !== null && lateWireOk !== undefined).toBe(true)
    if (lateWireOk === null) throw new Error('RMR scenario 1: no wire result')
    expect(lateWireOk.ok).toBe(true)
    const value = lateWireOk.value as { provenance?: { origin?: string } } | undefined
    expect(value !== undefined && value !== null).toBe(true)
    if (value !== undefined) {
      expect(value.provenance?.origin).toBe('team-remote')
    }
  })

  it('scenario 2: absent forever (headless) → pending → skipped, the window named; the boot succeeds', () => {
    expect(root2 !== undefined && root2 !== null).toBe(true)
    expect(pendingAtReady2).toEqual({ state: 'pending' })
    expect(terminalEventually2).toBe(true)
    expect(terminal2 !== undefined && terminal2 !== null).toBe(true)
    if (terminal2 !== undefined && terminal2.state === 'skipped') {
      expect(terminal2.reason.includes('200ms')).toBe(true)
      expect(terminal2.reason.includes('connection')).toBe(true)
    } else {
      throw new Error(`RMR scenario 2: expected a terminal skipped, got ${JSON.stringify(terminal2)}`)
    }
  })

  it('scenario 3: a malformed late appearance → failed (recorded, not thrown — the boot already settled)', () => {
    expect(root3 !== undefined && root3 !== null).toBe(true)
    expect(failedEventually3).toBe(true)
    expect(terminal3 !== undefined && terminal3 !== null).toBe(true)
    if (terminal3 !== undefined && terminal3.state === 'failed') {
      expect(terminal3.reason.includes('rpc.handle')).toBe(true)
    } else {
      throw new Error(`RMR scenario 3: expected a terminal failed, got ${JSON.stringify(terminal3)}`)
    }
  })

  it('scenario 4: remoteMountWaitMs 0 — the legacy immediate decision (skipped at once, no watcher)', () => {
    expect(root4 !== undefined && root4 !== null).toBe(true)
    expect(immediateState4).toEqual({
      state: 'skipped',
      reason: 'the "connection" public service is absent (headless host)',
    })
    expect(unchanged4).toEqual(immediateState4)
    // exactly one row effect: the row-stop backstop (no watcher armed)
    expect(world4.effectDisposers.length).toBe(1)
  })

  it('scenario 5: row stop while pending settles a terminal skipped (no dangling pending)', () => {
    expect(root5 !== undefined && root5 !== null).toBe(true)
    expect(pendingBeforeStop5).toEqual({ state: 'pending' })
    expect(stoppedState5 !== undefined && stoppedState5 !== null).toBe(true)
    if (stoppedState5 !== undefined && stoppedState5.state === 'skipped') {
      expect(stoppedState5.reason).toBe(
        'the row stopped before the "connection" public service appeared',
      )
    } else {
      throw new Error(`RMR scenario 5: expected a terminal skipped, got ${JSON.stringify(stoppedState5)}`)
    }
  })

  it('scenario 6: a negative remoteMountWaitMs rejects the bootstrap (the field named)', () => {
    const rejected = isTeamPluginError(err6)
    expect(rejected).toBe(true)
    if (!rejected) throw new Error('RMR scenario 6: expected a TeamPluginError')
    expect(err6.code).toBe(TEAM_PLUGIN_ERROR_CODES.TEAM_PLUGIN_CONFIG_INVALID)
    expect(String(err6).includes('remoteMountWaitMs')).toBe(true)
  })
})
