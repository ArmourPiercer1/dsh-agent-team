/**
 * world.mjs — the WEB family's old-path world: the PRODUCT route-C composition,
 * host-free, driving the REAL pinned `@deepseek-ai/dsh-tool-web` definitions over
 * the REAL confined `web` face and a REAL loopback fixture socket.
 *
 * WHAT IS REAL HERE (and why each piece has to be):
 *
 *   preset row      the PINNED baseline's own `@deepseek-ai/dsh-tool-web` module
 *                   mounted on the standing (preset) scope, exactly as the
 *                   shipped composition mounts it. Those are the definitions the
 *                   model sees, and the ones the route-C attach must replace.
 *   governance      the PRODUCT seam `mountMemberA5sfRealm` +
 *                   `attachA5sfNativeToolModules`
 *                   (`packages/runtime/src/plugin/live/a5sf-realm-row.mjs`).
 *                   The realm mounts the confined `web` face (BL-18) on the
 *                   Member's isolated scope; the attach appends PD-27's
 *                   `confined-web-tool.mjs`, which re-registers the SAME host
 *                   definitions on that scope so their `ctx.web` is the CONFINED
 *                   face. PD-30's admission (SSRF leg, exact declared test
 *                   endpoints) and the one-fact-per-call guard are product code.
 *   provider        the composition-owned transport (`lib/fixture-provider.mjs`):
 *                   the PINNED `HttpFetchProvider` pointed at the loopback
 *                   fixture through its own resolver seam, plus a bounded JSON
 *                   POST for search.
 *   backend         a REAL `node:http` fixture server on `127.0.0.1:3182`
 *                   (sanctioned test band). Its request log and byte counts are
 *                   the corroborating side effect.
 *   socket witness  `lib/net-witness.mjs` patches `net.Socket.prototype.connect`
 *                   for the world's lifetime and REFUSES any non-loopback
 *                   destination, so "no real network" is a counted measurement.
 *
 * THE BASE `web` SERVICE IS A TRIPWIRE. It exists so the preset row can mount;
 * if the route-C attach ever failed to shadow the pair, the call would reach
 * this service and throw `BL18_TRIPWIRE` — a measured failure instead of a
 * silent ungoverned fetch. `NC-SHADOW-LOAD-BEARING` uses exactly that.
 *
 * NO BOOT, no DSH_HOME, no DSH port: a C1 capture. A real socket to the fixture
 * IS opened (that is the effect under measurement); nothing leaves the machine.
 *
 * @module tests/ute-g1-web/lib/world
 */
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { createRequire, register } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { installNetworkWitness, networkWitnessOf, uninstallNetworkWitness } from './net-witness.mjs'
import { createFixtureWebProvider, DEFAULT_FETCH_LIMITS } from './fixture-provider.mjs'
import { startFixtureServer } from './fixture-server.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
/** This suite's repo root (`tests/ute-g1-web/lib` → repo root). */
export const REPO_ROOT = join(HERE, '..', '..', '..')

/** The pinned host tree (read-only import source; never written). */
export const PRISTINE_ROOT = join(REPO_ROOT, 'tests', 'deepseek-harness-test-use')

/** The repo's EXISTING TypeScript-under-plain-node hooks (no new loader). */
let registered = false
export function registerRepoHooks() {
  if (registered) return
  register(pathToFileURL(join(REPO_ROOT, 'scripts', 'run-tests-hooks.mjs')).href)
  registered = true
}
const hooksRegistered = registerRepoHooks

/** The Member identity every vector runs under (one world per vector). */
export const WEB_IDENTITY = Object.freeze({
  teamId: 'team-ute3-web-b1',
  memberInstanceId: 'member-ute3-web-b1',
  templateId: 'worker',
  instanceGeneration: 1,
})
export const WEB_REVISION = 'rev-ute3-web-b1'

const LAUNCHER = join(REPO_ROOT, 'packages/runtime/sandbox-provider/launcher/landlock-prelauncher.py')
const LAUNCHER_SHA = createHash('sha256').update(readFileSync(LAUNCHER)).digest('hex')

let seamsPromise
/** Load the repo seams + the pinned host modules ONCE per process. */
export function loadWebSeams() {
  seamsPromise ??= (async () => {
    hooksRegistered()
    const row = await import(pathToFileURL(join(REPO_ROOT, 'packages', 'runtime', 'src', 'plugin', 'live', 'a5sf-realm-row.mjs')).href)
    const runtimeRequire = createRequire(join(REPO_ROOT, 'packages', 'runtime', 'package.json'))
    const { Context, Service } = await import(pathToFileURL(runtimeRequire.resolve('@deepseek-ai/cordis')).href)
    const ToolRuntime = (await import(pathToFileURL(runtimeRequire.resolve('@deepseek-ai/dsh-tools')).href)).default
    const SystemPrompt = (await import(pathToFileURL(runtimeRequire.resolve('@deepseek-ai/dsh-system-prompt')).href)).default
    const { createScope, bindScopeParent } = await import(pathToFileURL(runtimeRequire.resolve('@deepseek-ai/dsh-scope')).href)
    const { compileEffectiveIo } = await import(pathToFileURL(join(REPO_ROOT, 'packages', 'runtime', 'member-io-policy', 'src', 'index.ts')).href)
    const { readGuardConsultFile } = await import(pathToFileURL(join(REPO_ROOT, 'packages', 'runtime', 'team-services', 'src', 'guard-observability.ts')).href)
    // The PINNED preset row and web stack (read-only imports from the pristine tree).
    const toolWeb = await import(pathToFileURL(join(PRISTINE_ROOT, 'packages', 'web', 'tool-web', 'lib', 'index.js')).href)
    const webRuntime = await import(pathToFileURL(join(PRISTINE_ROOT, 'packages', 'web', 'web', 'lib', 'index.js')).href)
    return Object.freeze({
      row, Context, Service, ToolRuntime, SystemPrompt, createScope, bindScopeParent,
      compileEffectiveIo, readGuardConsultFile, toolWeb, webRuntime,
    })
  })()
  return seamsPromise
}

/** One lane axis in the A1 policy/compiled shape. */
export function lane(allow, { ask = [], deny = [] } = {}) {
  return Object.freeze({ mode: 'restricted', allow: Object.freeze([...allow]), ask: Object.freeze([...ask]), deny: Object.freeze([...deny]) })
}

/** The base unconfined `fs` service the realm shadows (web rows never consume it). */
function baseFileSystemClass(Service) {
  return class BaseFileSystem extends Service {
    constructor(ctx, config = {}) {
      super(ctx, 'fs')
      this.config = config
    }
    processPath(target) { return target.hostPath }
    contains(parent, child) { return this.processPath(child).startsWith(this.processPath(parent)) }
    async resolve(path) { return { hostPath: path } }
    async readText() { return '' }
    async readBytes() { return new Uint8Array() }
    async readByteRange() { return new Uint8Array() }
    async streamText() { return (async function* stream() { yield '' })() }
    async listDir() { return [] }
    async stat() { return { type: 'file', size: 0, mtimeMs: 0, mode: 0o644 } }
    async lstat() { return { size: 0, mtimeMs: 0, mode: 0o644 } }
    async watch() { return () => undefined }
    async writeText() { return { path: '<base-fs>', version: 'v1' } }
    async editText() { return { path: '<base-fs>', version: 'v2' } }
  }
}

/**
 * The INHERITED host `web` service: reaching it is a measured FAILURE.
 * It is what the preset `tool-web` row would execute against if the route-C
 * attach did not shadow the pair onto the confined face.
 */
function hostWebTripwireClass(Service) {
  const state = { calls: 0 }
  class HostWeb extends Service {
    constructor(ctx, config = {}) {
      super(ctx, 'web')
      this.config = config
    }
    async fetch() {
      state.calls += 1
      const error = new Error('BL18_TRIPWIRE: the INHERITED host ctx.web was consulted for web_fetch')
      error.code = 'BL18_TRIPWIRE'
      throw error
    }
    async search() {
      state.calls += 1
      const error = new Error('BL18_TRIPWIRE: the INHERITED host ctx.web was consulted for web_search')
      error.code = 'BL18_TRIPWIRE'
      throw error
    }
  }
  return { HostWeb, state }
}

/**
 * Mount the PRODUCT route-C composition for one vector.
 *
 * @param {object} input
 * @param {string} input.label - a stable, filesystem-safe world label.
 * @param {object} [input.overrides] - negative-control only:
 *   `dropWebShadow`   dispose the realm's own native-module fibers after attach;
 *   `extraTestEndpoints` widen the DECLARED admission (never the implementation);
 *   `searchMode`      `present` | `unavailable` | `absent`;
 *   `fetchLimits`     the pinned provider's resolved limits;
 *   `withWitness`     `false` removes the socket witness (the load-bearing control);
 *   `fixtureDelayMs`  `/slow`'s hold.
 * @returns {Promise<object>} the world handle.
 */
export async function mountRouteCWorld({ label, overrides = {} }) {
  const seams = await loadWebSeams()
  const { row, Context, Service, ToolRuntime, SystemPrompt, createScope, bindScopeParent, compileEffectiveIo, readGuardConsultFile, toolWeb } = seams
  const BaseFileSystem = baseFileSystemClass(Service)
  const { HostWeb, state: hostState } = hostWebTripwireClass(Service)
  hostState.calls = 0

  const fixture = await startFixtureServer({ delayMs: overrides.fixtureDelayMs ?? 1500 })
  const witness = overrides.withWitness === false ? undefined : installNetworkWitness()
  const fetchLimits = overrides.fetchLimits ?? DEFAULT_FETCH_LIMITS
  const testEndpoints = [fixture.origin, ...(overrides.extraTestEndpoints ?? [])]
  const provider = await createFixtureWebProvider({
    origin: fixture.origin,
    fetchLimits,
    searchMode: overrides.searchMode ?? 'present',
    testEndpoints,
  })

  let root
  let mounted
  try {
    root = new Context()
    await root.plugin(SystemPrompt)
    await root.plugin(ToolRuntime)
    await root.plugin(BaseFileSystem, {})
    await root.plugin(HostWeb, {})

    // The PRESET topology: the shipped `tool-web` row on the STANDING scope
    // (over the inherited host `web` service — the pre-route-C state PD-18
    // measured). The route-C attach must replace these definitions.
    const standingKey = {}
    const standing = createScope(root, standingKey)
    await standing.ctx.plugin(toolWeb, {})
    const agentKey = { id: `agent-${label}`, session: { header: { cwd: REPO_ROOT } } }
    const agent = createScope(root, agentKey)
    bindScopeParent(agentKey, standingKey)

    const policyFor = () => Object.freeze({
      memberIdentity: WEB_IDENTITY.memberInstanceId,
      templateId: WEB_IDENTITY.templateId,
      instanceGeneration: WEB_IDENTITY.instanceGeneration,
      revision: WEB_REVISION,
      read: lane([REPO_ROOT]),
      write: lane([join(REPO_ROOT, '.artifacts', 'tmp', 'ute-g1-web')]),
      network: Object.freeze({ access: 'allow' }),
    })
    const compiled = compileEffectiveIo(policyFor(), {
      bindingIdentity: 'dsh.web/fetch',
      read: lane([REPO_ROOT]),
      write: lane([join(REPO_ROOT, '.artifacts', 'tmp', 'ute-g1-web')]),
      network: 'allow',
    }, {
      memberIdentity: WEB_IDENTITY.memberInstanceId,
      callId: `call-${label}`,
      policyRevision: WEB_REVISION,
      toolBindingIdentity: 'dsh.web/fetch',
      approvedOnce: false,
    })
    assert.equal(compiled.ok, true, `compileEffectiveIo refused: ${JSON.stringify(compiled)}`)

    const sinkPath = join(REPO_ROOT, '.artifacts', 'tmp', 'ute-g1-web', `guard-${label}-${String(process.pid)}.jsonl`)
    mounted = await row.mountMemberA5sfRealm({
      root: agent.ctx,
      // PD-30: the fixture origins are DECLARED by the composition on the
      // provider (`testEndpoints` below), which is the documented half the face
      // reads. No row-config key is invented for it.
      a5sfConfig: row.a5sfRealmConfigOf({ a5sfEvidencePath: sinkPath }),
      provider: () => ({
        compiledFor: () => ({
          members: [{ identity: WEB_IDENTITY, policy: { ok: true, value: policyFor() } }],
          providerClass: BaseFileSystem,
          web: {
            effective: compiled.value,
            provider,
            realmId: `realm-${label}`,
          },
        }),
      }),
      member: {
        sessionId: `session-${label}`,
        instanceId: WEB_IDENTITY.memberInstanceId,
        teamRootSessionId: 'team-root-ute3-web',
        templateId: WEB_IDENTITY.templateId,
      },
    })
    assert.ok(mounted !== undefined, 'the configured row must mount a realm')

    // The PRODUCT composition declares no web module: the attach's own PD-27
    // shadow is the only thing that routes web_fetch/web_search onto the
    // confined face. `dropWebShadow` removes it AFTER the attach, through the
    // realm's own disposal (never a second, test-only mount).
    const fibers = await row.attachA5sfNativeToolModules(
      mounted,
      agent.ctx,
      row.a5sfRealmConfigOf({ a5sfEvidencePath: sinkPath }),
      agentKey,
    )
    assert.ok(Array.isArray(fibers), 'the attach must answer the fibers it created')
    if (overrides.dropWebShadow === true) {
      assert.equal(typeof mounted.disposeNativeToolModules, 'function', 'the realm must expose the native-module disposal the control uses')
      await mounted.disposeNativeToolModules()
    }

    /** Dispatch one tool call through the REAL registry (the model call path). */
    const dispatch = async (name, args, options = {}) => {
      const settled = await root.tools.execute({
        signal: options.signal ?? new AbortController().signal,
        callId: `ute3-web-${label}-${name}-${Math.random().toString(36).slice(2, 8)}`,
        name,
        arguments: args,
        agent: agentKey,
      })
      const text = Array.isArray(settled.content)
        ? settled.content.map((part) => (part?.type === 'text' ? part.text : '')).join('')
        : ''
      return { isError: settled.isError === true, text, value: settled.value, meta: settled.meta }
    }

    const facts = () => (existsSync(sinkPath) ? readGuardConsultFile(sinkPath) : [])
    const visible = (name) => root.tools.get(name, agentKey) !== undefined

    let disposed = false
    return Object.freeze({
      label,
      root,
      agentKey,
      fixtureOrigin: fixture.origin,
      fixtureLog: () => fixture.log.map((entry) => Object.freeze({ ...entry })),
      fixtureSockets: () => fixture.sockets(),
      providerStats: () => Object.freeze({
        fetches: provider.stats.fetches,
        searches: provider.stats.searches,
        urls: Object.freeze([...provider.stats.urls]),
        queries: Object.freeze([...provider.stats.queries]),
      }),
      network: () => networkWitnessOf(witness),
      visible,
      hostWebCalls: () => hostState.calls,
      dispatch,
      facts,
      async dispose() {
        if (disposed) return
        disposed = true
        try {
          await mounted.dispose()
        } finally {
          await fixture.close()
          if (witness !== undefined) uninstallNetworkWitness()
        }
      },
    })
  } catch (error) {
    await fixture.close()
    if (witness !== undefined) uninstallNetworkWitness()
    throw error
  }
}
