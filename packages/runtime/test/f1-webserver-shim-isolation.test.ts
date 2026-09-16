/**
 * F1 — the webServer compatibility shim, SCOPED (PR #17 review
 * follow-up; instructions in
 * evidence/fix-alpha2-explicit-agent-setup-compat/
 * pr17-review-followup-instructions.md).
 *
 * The production entry (`packages/runtime/src/plugin/host.ts`) carries a
 * `webServer` property-read compatibility seam for DSH 0.1.5+ hosts (the
 * connection row no longer injects `webServer` — upstream 2ef85b1e17 — so
 * `connection.rpc.handle('/team-remote', ...)` fails the built-in
 * ancestor-fiber walk). The review finding (F1): the original listener
 * was PROCESS-WIDE — while the Team row was loaded, ANY row's
 * `webServer` read (unrelated plugin, no inject declared) was served by
 * the strict read, masking broken dependency declarations (and letting
 * an unrelated plugin mount foreign RPC channels through the seam).
 *
 * The fix scopes the seam to the ONE window in which THIS row's own
 * registration call is in flight (`teamRemoteMountInFlight`, set in
 * `mountRemoteNow`). The real-host probe
 * (evidence/.../probe/runs/f1-shim-probe-*) established the caller
 * topology this suite mirrors in a real Cordis world:
 *
 *   - the waterfall receiver of the `webServer` read is a per-call
 *     traceable SHADOW of the CALLING row's context (the read's reader
 *     fiber is the CALLER row's own fiber; a fresh proxy per call —
 *     `readerCtx === ctx` never holds for the service-mediated read);
 *   - the read is synchronous inside `connection.rpc.handle` (the
 *     connection service's `owner.effect(...)` body runs in the same
 *     tick);
 *   - pre-fix, an unrelated row's own property read AND an unrelated
 *     row's `connection.rpc.handle` were both served (demonstrated live
 *     on the 0.1.5-rc.2 host).
 *
 * This world therefore models the 0.1.5 topology at service fidelity:
 * the REAL `@deepseek-ai/cordis` context + the REAL production entry
 * (`hostEntry.apply`) + a connection service that performs the EXACT
 * 0.1.5 read pattern (`owner.effect(() => owner.webServer.register(...))`
 * with `owner = this.ctx`, no `webServer` inject) + the `webServer`
 * service on a SIBLING row fiber (the built-in walk cannot reach it —
 * the native failure the seam exists for).
 *
 * Scenarios:
 *   F1-T1 — team remote registration is served by the scoped shim
 *           (0.1.5 topology): the `/team-remote` route lands on the
 *           webServer service although the native walk fails;
 *   F1-T2 — unrelated contexts keep the NATIVE Cordis failure (the key
 *           regression): an unrelated row's own `ctx.webServer` read and
 *           an unrelated row's `connection.rpc.handle` both throw the
 *           exact `cannot get property "webServer" without inject`
 *           despite the Team row (shim) being loaded, and no foreign
 *           route is recorded;
 *   F1-T3 — 0.1.2-era behavior is unchanged: where the built-in walk
 *           resolves `webServer` natively (the connection row's own
 *           fiber carries it), the mount AND unrelated registration
 *           calls succeed exactly as before the seam existed.
 */
import { describe, expect, it } from 'vitest'
import { Context, Service } from '@deepseek-ai/cordis'
import {
  destroyDir,
  FileStorageSeam,
  scratchDir,
} from '../../testkit/fault-injection/file-seam.mjs'
import { REMOTE_RPC_CHANNEL } from '../../remote/src/handlers/register.js'
import * as hostEntry from '../src/plugin/host.js'
import type { TeamPluginHostContext } from '../src/plugin/host.js'
import { stubGlueUrl } from './p8s5a-artifacts.mjs'

// --- the 0.1.5-topology connection service (the probe-verified pattern) ----

/**
 * The 0.1.5 `dsh-client-connection` HostConnectionService shape:
 * `rpc.handle` registers the route through `owner.effect(() =>
 * owner.webServer.register(route))` where `owner = this.ctx` (the row's
 * OWN context — stored once at construction) and NO `webServer` inject
 * is declared (upstream 2ef85b1e17). The property read therefore goes
 * through the `internal/get` waterfall with the built-in ancestor-fiber
 * walk as the fallback — exactly the seam under test.
 */
class F1ConnectionService extends Service {
  constructor(ctx: Context) {
    super(ctx, 'connection')
  }

  get rpc() {
    const owner = this.ctx
    return {
      handle: (channel: string, handler: unknown): unknown =>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the property read is the SEAM under test; untyped by design
        owner.effect(() => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- property read on the real ctx proxy (the seam trigger)
          ;(owner as any).webServer.register({ kind: 'prefix', path: channel, handler })
          // No-op disposer: mirrors upstream rpc.handle (register-once,
          // nothing to clean up); makes the body match the SyncEffect overload.
          return () => {}
        }, `f1: ${channel}`),
    }
  }
}

/** The webServer service double (records registered routes). */
function makeWebServerDouble() {
  const routes: Array<{ kind: string; path: string }> = []
  return {
    routes,
    register(route: { kind: string; path: string }): void {
      routes.push(route)
    },
  }
}

// --- the row config (the t12m4 shape; the stub glue keeps the boot light) --

const F1_ROOT_SID = 'session-f1root'

function rowConfig(defaultWorkspace: string) {
  return {
    bootPhase: 'create',
    rootSessionId: F1_ROOT_SID,
    blueprintSource: [
      '---',
      'schemaVersion: 1',
      'blueprintId: F1-BP',
      'revision: "1"',
      'leader:',
      '  templateId: leader',
      '  persona: You lead the F1 world.',
      'requirements: []',
      'memberEnvelopes: []',
      'policyStates: []',
      'metadata: {}',
      '---',
      '',
    ].join('\n'),
    generation: 1,
    defaultWorkspace,
    seedMembers: [],
    staticModel: { provider: 'f1-static', model: 'f1-model-v1' },
    deniedSelection: null,
    mcpServer: null,
    environmentFacts: [
      { domain: 'tool', subject: 'web', available: true, generation: 1 },
      { domain: 'skill', subject: 'base', available: true, generation: 1 },
    ],
    externalPolicyFacts: { hard: {}, capabilityExists: {} },
    glueUrl: stubGlueUrl(),
    // The connection service is PRESENT at the mount step in every F1
    // world — pin the legacy immediate decision (no bounded wait) so the
    // mount outcome is synchronous with the entry's apply.
    remoteMountWaitMs: 0,
  }
}

// --- the world ---------------------------------------------------------------

interface F1World {
  readonly root: Context
  readonly webServer: ReturnType<typeof makeWebServerDouble>
  readonly connection: F1ConnectionService
  readonly dir: string
}

/**
 * Boot one real-Cordis F1 world:
 *   mode '015' — the webServer service is provided on a SIBLING row fiber
 *                (the 0.1.5 host shape: the built-in walk from the
 *                connection row cannot reach it — the seam exists for
 *                exactly this);
 *   mode '012' — the webServer service is provided on the CONNECTION
 *                row's own fiber (the 0.1.2-era shape: the built-in walk
 *                resolves it natively).
 * The production entry is driven on the root context with the t12m4
 * doubles (the four hard injects + the file storage seam) — the entry's
 * `internal/get` listener lands on the global event bus either way.
 */
async function bootF1World(mode: '015' | '012', label: string): Promise<F1World> {
  const root = new Context()
  const webServer = makeWebServerDouble()

  if (mode === '015') {
    // The webServer service on its OWN row fiber (sibling branch — the
    // built-in ancestor-fiber walk from the connection row never crosses
    // to it; the strict `ctx.get` read does, topology-independently).
    await root.plugin(
      Object.assign((inner: Context) => {
        inner.reflect.provide('webServer', webServer)
      }, { inject: [] }),
    )
  }

  let connection!: F1ConnectionService
  await root.plugin(
    Object.assign((inner: Context) => {
      if (mode === '012') {
        // 0.1.2-era: the walk resolves webServer from the connection
        // row's own fiber (the 0.1.2 connection row declares the inject;
        // same-fiber provision models the walk's resolution directly).
        inner.reflect.provide('webServer', webServer)
      }
      connection = new F1ConnectionService(inner)
    }, { inject: [] }),
  )

  // The production entry's hard injects (t12m4 double shapes — the stub
  // glue boot does not exercise them beyond the lazy accessor checks)
  // + the file storage seam (the entry's teamStorageSeam deps key).
  const dir = scratchDir(`f1-${label}`)
  destroyDir(dir) // idempotent start-state
  root.reflect.provide('agents', { create: async () => {}, resume: async () => {} })
  root.reflect.provide('storageDomain', {})
  root.reflect.provide('sessions', {})
  root.reflect.provide('workspaceRegistry', { list: () => [], resolveByPath: async () => undefined })
  root.reflect.provide('sessionPersistence', { ensure: async () => {} })
  root.reflect.provide('teamStorageSeam', new FileStorageSeam(dir))

  // The REAL production entry — the shim under test is installed by it.
  await hostEntry.apply(root as unknown as TeamPluginHostContext, rowConfig(dir))
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (the provided facade), untyped by design
  const teamRoot = (root as any).get('teamRoot')
  await teamRoot.ready

  return { root, webServer, connection, dir }
}

async function disposeF1World(world: F1World): Promise<void> {
  destroyDir(world.dir)
}

// --- the scenarios -----------------------------------------------------------

describe('F1 the scoped webServer compatibility seam (host.ts internal/get)', () => {
  it('F1-T1: the team remote registration is served by the scoped shim (0.1.5 topology)', async () => {
    const world = await bootF1World('015', 't1')
    try {
      // Control: in this topology the NATIVE walk cannot resolve
      // webServer from the connection row (sibling provider fiber) — the
      // recorded /team-remote route therefore PROVES the scoped shim
      // served the team's own registration read.
      const paths = world.webServer.routes.map((r) => r.path)
      expect(paths).toContain(REMOTE_RPC_CHANNEL)
      expect(world.webServer.routes.filter((r) => r.path === REMOTE_RPC_CHANNEL)).toHaveLength(1)
    } finally {
      await disposeF1World(world)
    }
  })

  it('F1-T2: unrelated contexts keep the native Cordis failure (the key regression)', async () => {
    const world = await bootF1World('015', 't2')
    try {
      // The team's own mount succeeded first (the flag window served it).
      const paths0 = world.webServer.routes.map((r) => r.path)
      expect(paths0).toContain(REMOTE_RPC_CHANNEL)

      // (a) an unrelated row's OWN property read (no webServer inject) —
      //     the pre-fix process-wide shim served this; the scoped seam
      //     must fall through to the built-in walk verbatim.
      let rowCtx!: Context
      await world.root.plugin(
        Object.assign((inner: Context) => {
          rowCtx = inner
        }, { inject: [] }),
      )
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the property read is the negative under test
      expect(() => (rowCtx as any).webServer).toThrow(
        'cannot get property "webServer" without inject',
      )

      // (b) the worst case: an unrelated plugin's OWN
      //     connection.rpc.handle (foreign channel ownership through the
      //     team seam) — the pre-fix probe registered these channels
      //     live on the 0.1.5-rc.2 host; the scoped seam must fail them
      //     natively and record NOTHING.
      const FOREIGN_CHANNEL = '/f1-unrelated-channel'
      expect(() => {
        world.connection.rpc.handle(FOREIGN_CHANNEL, async () => 'x')
      }).toThrow('cannot get property "webServer" without inject')
      expect(world.webServer.routes.map((r) => r.path)).not.toContain(FOREIGN_CHANNEL)

      // (c) the team's mount is untouched: exactly one /team-remote route.
      expect(world.webServer.routes.filter((r) => r.path === REMOTE_RPC_CHANNEL)).toHaveLength(1)
    } finally {
      await disposeF1World(world)
    }
  })

  it('F1-T3: 0.1.2-era behavior is unchanged (the native walk resolves)', async () => {
    const world = await bootF1World('012', 't3')
    try {
      // The built-in walk resolves webServer natively here (the
      // connection row's own fiber carries it) — the mount succeeds
      // exactly as it did before the seam existed.
      const paths = world.webServer.routes.map((r) => r.path)
      expect(paths).toContain(REMOTE_RPC_CHANNEL)

      // And an unrelated registration call still succeeds natively in
      // this topology (0.1.2 hosts resolved every caller's walk — the
      // scoped seam must not change that).
      const LEGACY_FOREIGN = '/f1-legacy-foreign'
      world.connection.rpc.handle(LEGACY_FOREIGN, async () => 'x')
      expect(world.webServer.routes.map((r) => r.path)).toContain(LEGACY_FOREIGN)
    } finally {
      await disposeF1World(world)
    }
  })
})
