/**
 * T12-M4 — the production Remote mount (the Remote contract v1 dispatcher
 * onto the public connection seam, wired by the production entry
 * `packages/runtime/src/plugin/host.ts`).
 *
 * Drives the REAL production entry (`apply`) with a plain-object Cordis
 * context + the real file storage seam. The seam is SIMULATED at the
 * service boundary only: the `connection` service the wiring consumes is
 * EXACTLY the plain object provided on ctx (no faked ConnectionLike
 * substituted into the production path), and its `rpc.handle` captures
 * the channel + the DSH-shaped dispatcher so a full request through
 * `(endpoint, payload, signal)` must produce the frozen wire envelope.
 *
 * Scenarios (module top level — the sync shim forbids async `it()`):
 *   1. mounted  — 'connection' present: the `/team-remote` channel is
 *                 registered through the EXACT service object from ctx
 *                 (identity), the facade records the mount, the captured
 *                 dispatcher answers DSH-shaped calls with the frozen
 *                 envelope (unknown-method / success + provenance /
 *                 contract-version-unsupported), and the row-stop
 *                 releases the channel.
 *   2. headless — 'connection' absent: the boot succeeds, the remote
 *                 surface stays unmounted (recorded on the facade, never
 *                 a boot throw).
 *   3. malformed — 'connection' present but broken (no `rpc.handle`):
 *                 boot failure (TEAM_PLUGIN_SERVICE_MISSING, the
 *                 malformation named).
 *   4. conflict — the channel is already owned: boot failure
 *                 (TEAM_PLUGIN_SEAM_ALREADY_INSTALLED, the channel named
 *                 — one owner per channel).
 *
 * Source-level scope: like p8s5a, the entry is statically imported from
 * TS source (the runner's .js→.ts sibling hook loads it).
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
import * as hostEntry from '../src/plugin/host.js'
import type { TeamPluginHostContext } from '../src/plugin/host.js'
import { stubGlueUrl } from './p8s5a-artifacts.mjs'

// --- the T12M4 fixture world (own ids; structure mirrors the P8S5A T1) ----

/** The T12M4 root session id (distinct from every other phase fixture). */
const ROOT_SID = 'session-t12m4root'
/** The T12M4 seeded worker / scout (the leader is implied by the root). */
const SEED_WORKER_ID = 'inst-t12m4seedw1'
const SEED_SCOUT_ID = 'inst-t12m4seeds1'
const SEED_WORKER_CHILD = 'session-child-t12m4seedw1'
const SEED_SCOUT_CHILD = 'session-child-t12m4seeds1'

/** The T12M4 blueprint (own id; structure mirrors the P8S5A T1 fixture). */
const BLUEPRINT_SOURCE = [
  '---',
  'schemaVersion: 1',
  'blueprintId: T12M4-BP',
  'revision: "1"',
  'leader:',
  '  templateId: leader',
  '  persona: You lead the T12M4 team.',
  'members:',
  '  - templateId: worker',
  '    displayName: Worker',
  '    persona: You do the T12M4 work.',
  '  - templateId: scout',
  '    displayName: Scout',
  '    persona: You scout for the T12M4 team.',
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
  '    description: The T12M4 default state.',
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

/** The T12M4 row config (the entry's ONLY input channel). */
function rowConfig() {
  return {
    bootPhase: 'create',
    rootSessionId: ROOT_SID,
    blueprintSource: BLUEPRINT_SOURCE,
    generation: 1,
    defaultWorkspace: 'C:/agent-team/work/t12m4',
    seedMembers: [
      {
        instanceId: SEED_WORKER_ID,
        templateId: 'worker',
        label: 't12m4-seed-worker',
        childSessionId: SEED_WORKER_CHILD,
      },
      {
        instanceId: SEED_SCOUT_ID,
        templateId: 'scout',
        label: 't12m4-seed-scout',
        childSessionId: SEED_SCOUT_CHILD,
      },
    ],
    staticModel: { provider: 't12m4-static', model: 't12m4-model-v1' },
    deniedSelection: null,
    mcpServer: null,
    environmentFacts: [
      { domain: 'tool', subject: 'web', available: true, generation: 1 },
      { domain: 'skill', subject: 'base', available: true, generation: 1 },
    ],
    externalPolicyFacts: { hard: {}, capabilityExists: {} },
    glueUrl: stubGlueUrl(),
    // RMR (remote-mount-race fix): pin the LEGACY immediate mount decision
    // (absent at the mount step → skip at once, no bounded wait) so this
    // suite's headless scenario keeps its pre-race-fix observable
    // semantics; the bounded wait window itself (pending → late mount /
    // expiry skip / late malformed) is covered by
    // rmr-remote-mount-race.test.ts.
    remoteMountWaitMs: 0,
  }
}

// --- the test Cordis context + the seam simulation --------------------------

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
 * `rpc.handle` captures the channel + the DSH-shaped dispatcher. The
 * production wiring consumes EXACTLY this object from ctx, so the
 * identity assertions below prove the mount used the real service
 * object (not a copy).
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

/** Await the row-stop backstop's microtask chain (ready already settled). */
async function flushMicrotasks(): Promise<void> {
  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()
}

// --- the scenarios (module top level — the sync shim forbids async it()) ----

// --- scenario 1: mounted (the web profile provides 'connection') -----------
const dir1 = scratchDir('t12m4-mounted')
destroyDir(dir1) // idempotent start-state: an aborted prior run may have left a stamped domain
const seam1 = new FileStorageSeam(dir1)
const sink1 = makeConnectionSink()
const world1 = makeWorld({ teamStorageSeam: seam1, connection: sink1.connection })
await hostEntry.apply(world1.ctx, rowConfig())
const teamRoot1 = world1.provided.teamRoot
const root1 = await teamRoot1.ready
const handler1: DshShapeHandler | null = sink1.captured.handler
if (handler1 === null) {
  throw new Error('T12-M4 scenario 1: the mount never registered a dispatcher')
}
// The full DSH-shaped request flow through the captured seam handler:
// (endpoint, payload, signal) — signal is extra and must be ignored.
const wireUnknown = await handler1(
  'team.doesNotExist',
  { version: 1, params: {} },
  undefined,
)
const wireOk = await handler1(
  'team.getProjection',
  { version: 1, params: { teamSessionId: ROOT_SID } },
  undefined,
)
const wireVersion = await handler1(
  'team.getProjection',
  { version: 2, params: { teamSessionId: ROOT_SID } },
  undefined,
)
// Row stop: the backstop must release the /team-remote channel ownership.
for (const dispose of world1.effectDisposers) dispose()
await flushMicrotasks()
destroyDir(dir1)

// --- scenario 2: headless (no 'connection' service) -------------------------
const dir2 = scratchDir('t12m4-headless')
destroyDir(dir2) // idempotent start-state
const world2 = makeWorld({ teamStorageSeam: new FileStorageSeam(dir2) })
await hostEntry.apply(world2.ctx, rowConfig())
const teamRoot2 = world2.provided.teamRoot
const root2 = await teamRoot2.ready
destroyDir(dir2)

// --- scenario 3: malformed 'connection' service (fail closed) --------------
const dir3 = scratchDir('t12m4-malformed')
destroyDir(dir3) // idempotent start-state
const world3 = makeWorld({
  teamStorageSeam: new FileStorageSeam(dir3),
  connection: { rpc: {} },
})
await hostEntry.apply(world3.ctx, rowConfig())
const teamRoot3 = world3.provided.teamRoot
const err3: unknown = await teamRoot3.ready.then(
  () => null,
  (error: unknown) => error,
)
destroyDir(dir3)

// --- scenario 4: channel conflict (one owner per channel) -------------------
const dir4 = scratchDir('t12m4-conflict')
destroyDir(dir4) // idempotent start-state
const CONFLICT_MESSAGE = 'webserver: route /team-remote is already registered'
const world4 = makeWorld({
  teamStorageSeam: new FileStorageSeam(dir4),
  connection: {
    rpc: {
      handle() {
        throw new Error(CONFLICT_MESSAGE)
      },
    },
  },
})
await hostEntry.apply(world4.ctx, rowConfig())
const teamRoot4 = world4.provided.teamRoot
const err4: unknown = await teamRoot4.ready.then(
  () => null,
  (error: unknown) => error,
)
destroyDir(dir4)

// --- the assertions (sync it() bodies) --------------------------------------

describe('T12-M4 the production Remote mount (host.ts wiring)', () => {
  it('reserves the /team-remote channel constant (grammar, not /api)', () => {
    expect(REMOTE_RPC_CHANNEL).toBe('/team-remote')
  })

  it('mounts the /team-remote channel through the EXACT connection object from ctx', () => {
    expect(root1 !== undefined && root1 !== null).toBe(true)
    expect(sink1.captured.channel).toBe(REMOTE_RPC_CHANNEL)
    expect(sink1.captured.calls).toEqual([REMOTE_RPC_CHANNEL])
    // Identity: the wiring called rpc.handle ON the service object itself.
    expect(sink1.captured.rpcThis).toBe(sink1.connection.rpc)
    expect(teamRoot1.remote).toEqual({
      state: 'mounted',
      channel: REMOTE_RPC_CHANNEL,
    })
  })

  it('answers an unknown endpoint with the frozen unknown-method envelope', () => {
    expect(wireUnknown.ok).toBe(false)
    expect(Object.keys(wireUnknown).sort()).toEqual(['error', 'ok'])
    expect(wireUnknown.error.code).toBe('unknown-method')
    expect(typeof wireUnknown.error.message).toBe('string')
    // details is ALWAYS a present object (the frozen error contract).
    expect(wireUnknown.error.details !== null && wireUnknown.error.details !== undefined).toBe(true)
    expect(typeof wireUnknown.error.details).toBe('object')
  })

  it('serves team.getProjection with data + the frozen provenance', () => {
    expect(wireOk.ok).toBe(true)
    expect(Object.keys(wireOk).sort()).toEqual(['ok', 'value'])
    expect(wireOk.value.data !== null && wireOk.value.data !== undefined).toBe(true)
    expect(typeof wireOk.value.data).toBe('object')
    expect(wireOk.value.provenance.origin).toBe('team-remote')
    expect(wireOk.value.provenance.method).toBe('team.getProjection')
    expect(wireOk.value.provenance.endpoint).toBe('team.getProjection')
    expect(wireOk.value.provenance.contractVersion).toBe(1)
    expect(wireOk.value.provenance.requestToken).toBe(null)
  })

  it('rejects an unsupported contract version with the frozen boundary code', () => {
    expect(wireVersion.ok).toBe(false)
    expect(wireVersion.error.code).toBe('contract-version-unsupported')
  })

  it('releases the /team-remote channel ownership at row stop', () => {
    expect(world1.effectDisposers.length).toBe(1)
    expect(sink1.state.disposed).toBe(true)
  })

  it('stays unmounted without a boot failure when the connection service is absent (headless)', () => {
    expect(root2 !== undefined && root2 !== null).toBe(true)
    expect(teamRoot2.remote).toEqual({
      state: 'skipped',
      reason: 'the "connection" public service is absent (headless host)',
    })
  })

  it('fails the boot on a malformed connection service (fail closed)', () => {
    const rejected = isTeamPluginError(err3)
    expect(rejected).toBe(true)
    if (!rejected) throw new Error('T12-M4 scenario 3: expected a TeamPluginError')
    expect(err3.code).toBe(TEAM_PLUGIN_ERROR_CODES.TEAM_PLUGIN_SERVICE_MISSING)
    expect(String(err3).includes('rpc.handle')).toBe(true)
  })

  it('fails the boot on a channel conflict, naming the channel (one owner per channel)', () => {
    const rejected = isTeamPluginError(err4)
    expect(rejected).toBe(true)
    if (!rejected) throw new Error('T12-M4 scenario 4: expected a TeamPluginError')
    expect(err4.code).toBe(TEAM_PLUGIN_ERROR_CODES.TEAM_PLUGIN_SEAM_ALREADY_INSTALLED)
    expect(String(err4).includes('/team-remote')).toBe(true)
    expect(String(err4).includes(CONFLICT_MESSAGE)).toBe(true)
  })
})
