#!/usr/bin/env node
/**
 * probe-e8-freeze.mjs — HOST-FREE measurement of the E8 INTRA-EMISSION
 * DISPATCH WINDOW, closed by the realm freeze (2026-11-03) (`tool-subagent` registers its
 * tool from a `subagent/provider-added` event, not from `apply` and not from a
 * deferred `ctx.inject` child).
 *
 * WHY THIS EXISTS. `NATIVE-SOURCE-INVENTORY.md` §1.1/§4-row-9 records that the
 * routed native mount has nothing to observe for this shape: the settle window
 * waits for FIBERS, and this module creates none — it subscribes to a service
 * event. The inventory reasoned that "provider absent ⇒ zero registrations ⇒
 * zero forwarded names ⇒ zero identity checks", but did NOT measure the
 * consequence, which is the P0-class question: at that moment is the PRESET
 * definition for the module's tool name executable and unguarded?
 *
 * This probe answers (1)-(4) of the task with the REAL pinned module
 * (`tests/deepseek-harness-test-use/packages/subagent/tool-subagent/lib/index.js`,
 * 0.2.0-rc.2 @ 639ed01539) on BOTH planes (preset row and managed native
 * module), driving the REAL product entry points
 * (`mountMemberA5sfRealm` → `attachA5sfNativeToolModules` → `mount.ts`).
 * ZERO Host boots, ZERO ports, no DSH_HOME, no pristine-tree writes.
 *
 * ARMS
 *   E1 absent-provider, SAME configuration on both planes (the product shape):
 *      what the attach records (`observed`/`forwarded`), whether a settle
 *      window with any transient descendant is entered, whether the surface
 *      changes, and whether ANY definition of the tool name exists afterwards.
 *   E2 absent-provider on the MANAGED side while the PRESET row of the same
 *      module/config family provides the name (a composition that configures
 *      the two planes differently): is the preset definition executable and
 *      unguarded? (the P0-class variant of the same shape)
 *   E3 provider appears AFTER the mount settles: does the registration land
 *      through the router, does the realm fold + invalidate (fail closed), what
 *      are `lateRegistrations`/`uncovered`/`surfaceAdded`, and does the
 *      admission deny cover the name?
 *   E4 provider present BEFORE the mount: is the registration covered
 *      synchronously and is the resulting definition routed and
 *      identity-verified?
 *   E5 provider REMOVED after a covered mount (the control that the ordinary
 *      event path already fails closed).
 *
 * Run: node probe-event-driven.mjs
 */
import { appendFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire, register } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = join(HERE, '..', '..', '..', '..')
const OUT = join(HERE, 'probe-e8-freeze.json')
const LOG = join(HERE, 'probe-e8-freeze.log')

const LOG_LINES = []
function log(line) {
  const text = `[${new Date().toISOString()}] ${line}`
  // eslint-disable-next-line no-console
  console.log(text)
  LOG_LINES.push(text)
}

function hostTreePath() {
  const local = join(REPO_ROOT, 'tests', 'deepseek-harness-test-use')
  if (existsSync(local)) return local
  const shared = join(REPO_ROOT, '..', '..', 'tests', 'deepseek-harness-test-use')
  if (existsSync(shared)) return shared
  throw new Error('no pristine host tree')
}
const HOST_TREE = hostTreePath()
const HOST_TOOL_SUBAGENT = pathToFileURL(
  join(HOST_TREE, 'packages', 'subagent', 'tool-subagent', 'lib', 'index.js'),
).href

/** The repo's EXISTING TS-under-plain-node hooks (no new loader). */
register(pathToFileURL(join(REPO_ROOT, 'scripts', 'run-tests-hooks.mjs')).href)

const row = await import(pathToFileURL(join(REPO_ROOT, 'packages', 'runtime', 'src', 'plugin', 'live', 'a5sf-realm-row.mjs')).href)

const RUNTIME_PEERS = ['@deepseek-ai/cordis', '@deepseek-ai/dsh-tools', '@deepseek-ai/dsh-system-prompt', '@deepseek-ai/dsh-scope']
function pickRuntimeRequire() {
  const candidates = [
    join(REPO_ROOT, 'packages', 'runtime', 'package.json'),
    join(REPO_ROOT, '..', '..', 'packages', 'runtime', 'package.json'),
    join(HOST_TREE, 'packages', 'boot', 'plugin-manager', 'package.json'),
  ]
  const tried = []
  for (const base of candidates) {
    if (!existsSync(base)) { tried.push({ base, ok: false, reason: 'missing' }); continue }
    const require = createRequire(base)
    const resolved = {}
    for (const peer of RUNTIME_PEERS) {
      try { resolved[peer] = require.resolve(peer) } catch { resolved[peer] = null }
    }
    if (RUNTIME_PEERS.every((peer) => resolved[peer] !== null)) {
      log(`runtime peers resolved from ${base}`)
      return { require, base, resolved, tried }
    }
    tried.push({ base, ok: false, missing: Object.entries(resolved).filter(([, v]) => v === null).map(([k]) => k) })
  }
  throw new Error(`cannot resolve the runtime peers from any base: ${JSON.stringify(tried)}`)
}
const runtime = pickRuntimeRequire()
const { Context, Service } = await import(pathToFileURL(runtime.resolved['@deepseek-ai/cordis']).href)
const ToolRuntime = (await import(pathToFileURL(runtime.resolved['@deepseek-ai/dsh-tools']).href)).default
const SystemPrompt = (await import(pathToFileURL(runtime.resolved['@deepseek-ai/dsh-system-prompt']).href)).default
const { createScope, bindScopeParent } = await import(pathToFileURL(runtime.resolved['@deepseek-ai/dsh-scope']).href)

const SUBAGENT = await import(HOST_TOOL_SUBAGENT)

const IDENTITY = Object.freeze({ teamId: 'team-event-driven-probe', memberInstanceId: 'member-probe-e', templateId: 'worker', instanceGeneration: 1 })
const lane = (allow) => Object.freeze({ mode: 'restricted', allow: Object.freeze([...allow]), ask: Object.freeze([]), deny: Object.freeze([]) })

const dirs = []
function trackedDir(prefix) {
  const dir = mkdtempSync(join(tmpdir(), prefix))
  dirs.push(dir)
  return dir
}

/** The unit-world fs double (same shape as the route-C / deferred suites). */
class TestFileSystem extends Service {
  constructor(ctx, config = {}) { super(ctx, 'fs'); this.config = config }
  processPath(target) { return target.hostPath }
  contains(parent, child) { return this.processPath(child).startsWith(this.processPath(parent)) }
  async resolve(path) { return { hostPath: path } }
  async readText() { return 'ok\n' }
  async readBytes() { return Buffer.from('ok\n') }
  async readByteRange() { return Buffer.from('ok') }
  async streamText() { return (async function* s() { yield 'ok\n' })() }
  async listDir() { return [] }
  async stat() { return { lstat: { size: 3, mtimeMs: 0, mode: 0o644 } } }
  async lstat() { return { size: 3, mtimeMs: 0, mode: 0o644 } }
  async watch() { return async () => {} }
  async writeText() { return { version: 'v1' } }
  async editText() { return { version: 'v2' } }
}

/**
 * `ctx.sessionProjections` — the module registers its model-selection
 * projection definition synchronously; nothing reads it back in this probe.
 */
class TestSessionProjections extends Service {
  constructor(ctx) { super(ctx, 'sessionProjections'); this.definitions = [] }
  register(definition) { this.definitions.push(definition); return () => {} }
}

/**
 * `ctx.subagents` — the service `tool-subagent` subscribes to and reads. The
 * provider registry is the EVENT SOURCE of the whole shape: `registerProvider`
 * emits `subagent/provider-added` exactly like the pinned
 * `SubagentRuntime.registerProvider` (packages/subagent/subagent/lib/index.js
 * :3076-3087), and `start` is the BASE-provider execution the tool body would
 * reach if its definition ever ran unshadowed.
 */
class TestSubagents extends Service {
  constructor(ctx) {
    super(ctx, 'subagents')
    this.providers = new Map()
    this.starts = []
  }
  getProvider(name) { return this.providers.get(name) }
  resolveMaxDepth() { return undefined }
  registerProvider(provider) {
    const name = provider.name
    // MIRRORS the pinned SubagentRuntime.registerProvider: an effect-scoped
    // registration that emits `subagent/provider-added` INSIDE the effect, so a
    // listener fault fails the effect and runs the disposer (which emits
    // `subagent/provider-removed`) exactly like the real service.
    return this.ctx.effect(function* registerProviderEffect() {
      if (this.providers.has(name)) throw new Error(`duplicate provider ${name}`)
      this.providers.set(name, provider)
      yield () => {
        this.providers.delete(name)
        this.ctx.emit('subagent/provider-removed', name)
      }
      this.ctx.emit('subagent/provider-added', provider)
    }.bind(this), 'subagents.registerProvider()')
  }
  removeProvider(name) {
    if (!this.providers.has(name)) return
    this.providers.delete(name)
    this.ctx.emit('subagent/provider-removed', name)
  }
  /** The base-provider body a leaked preset definition would execute. */
  start(providerName) {
    this.starts.push(providerName)
    return {
      id: `run-${String(this.starts.length)}`,
      result: Promise.resolve({
        stopReason: 'completed',
        output: [{ type: 'text', text: `BASE-PROVIDER-RAN:${providerName}` }],
      }),
      dispose: async () => {},
    }
  }
  async startContinuable() { throw new Error('continuable delegation is not configured in this probe') }
}

function testProvider(name) {
  return { name, capabilities: Object.freeze({ depthLimit: true, agentOptions: true }), inheritsParentContext: false }
}

function presetTopology(root) {
  const standingKey = {}
  const standing = createScope(root, standingKey)
  const agentKey = {
    // The pinned tool body reads the DELEGATING agent: `session.requestHeader()`
    // and `options` (packages/subagent/subagent/lib/index.js:414-424). The Agent
    // IS the scope key in this host, so the same object carries both roles.
    session: { requestHeader: () => undefined },
    options: { provider: 'in-process', model: 'probe-model', maxTokens: 1024 },
  }
  const agent = createScope(root, agentKey)
  bindScopeParent(agentKey, standingKey)
  return { standingKey, standing, agentKey, agentCtx: agent.ctx }
}

/** The module config used on BOTH planes for the product shape (E1/E3/E4/E5). */
const SAME_CONFIG = Object.freeze({ provider: 'in-process', toolName: 'subagent' })

/**
 * A preset row that registers `subagent` SYNCHRONOUSLY — used only by E2's
 * control variant, where the name is served by a definition this attach did
 * not create. It is a double, not a substitute for the real module: the real
 * module is mounted on the managed plane in every arm.
 */
const PRESET_DOUBLE_URL = `data:text/javascript,${encodeURIComponent(`
export const name = 'preset-double-subagent'
export const inject = ['tools', 'systemPrompt']
export function apply(ctx) {
  ctx.systemPrompt.section({ name: 'tool:subagent', order: 50, text: 'preset double' })
  ctx.tools.register({
    name: 'subagent',
    description: 'preset double definition of the managed name',
    parameters: { type: 'object', properties: { description: { type: 'string' }, prompt: { type: 'string' } }, required: ['description', 'prompt'], additionalProperties: false },
    output: { schema: { type: 'string' }, render: (_a, value) => [{ type: 'text', text: String(value) }] },
    async execute() { return 'PRESET-DOUBLE-RAN' },
  })
}
`) }`

async function makeRoot({ providers = [] }) {
  const root = new Context()
  await root.plugin(SystemPrompt)
  await root.plugin(ToolRuntime)
  await root.plugin(TestFileSystem, {})
  await root.plugin(TestSessionProjections)
  await root.plugin(TestSubagents)
  const subagents = root.get('subagents')
  for (const name of providers) subagents.registerProvider(testProvider(name))
  return root
}

function compiledProvider({ inside }) {
  return () => ({
    compiledFor: () => ({
      members: [{ identity: IDENTITY, policy: { ok: true, value: Object.freeze({
        memberIdentity: IDENTITY.memberInstanceId,
        templateId: IDENTITY.templateId,
        instanceGeneration: IDENTITY.instanceGeneration,
        revision: `a5sf-probe:${IDENTITY.memberInstanceId}:g1`,
        read: lane([inside]),
        write: lane([inside]),
        network: Object.freeze({ access: 'allow' }),
      }) } }],
      providerClass: TestFileSystem,
    }),
  })
}

function surfaceNames(root, scope) {
  return [...root.get('tools').schemas(scope)].map((schema) => schema?.name ?? schema).sort()
}

/** Dispatch exactly like the suites do (the pre-execute admission stage). */
async function dispatchTool(root, scope, name, args = {}) {
  const settled = await root.get('tools').execute({
    signal: new AbortController().signal,
    callId: `call-probe-${name}`,
    agent: scope,
    name,
    arguments: args,
  })
  const text = Array.isArray(settled.content)
    ? settled.content.map((part) => (part?.type === 'text' ? part.text : '')).join('')
    : ''
  return { isError: settled.isError === true, text, info: settled.error?.info ?? null }
}

/** The routing receipts on the fibers the attach returned. */
function routingsOf(fibers) {
  const receipts = []
  for (const fiber of fibers ?? []) {
    const routing = fiber?.[row.NATIVE_REGISTRATION_ROUTING ?? 'a5sfRegistrationRouting']
    if (routing === undefined || routing === null) continue
    receipts.push({
      realm: routing.realm,
      forwarded: [...routing.forwarded],
      observed: [...routing.observed],
      dropped: [...routing.dropped],
      forwardedSections: [...routing.forwardedSections],
    })
  }
  return receipts
}

/** Guard-consult facts recorded during a window (the "zero guard facts" proof). */
function consultFacts(sinkPath) {
  if (!existsSync(sinkPath)) return []
  const lines = readFileSync(sinkPath, 'utf8').split('\n').filter((line) => line.trim() !== '')
  return lines.map((line) => { try { return JSON.parse(line) } catch { return { raw: line } } })
}

/**
 * ONE arm: compose the world, mount through the REAL product entry points, run
 * the arm body and return every fact the assertions need. No interpretation.
 */
async function arm(label, options, body) {
  const {
    presetMode = 'real',       // 'real' = same real module row; 'double' = sync definition of the name
    presetProvider = undefined, // provider name the preset row is configured with (real mode)
    managedProvider = 'in-process', // provider name the MANAGED module is configured with
    providersAtBoot = [],
    providerAfter = undefined,
    removeAfter = undefined,
    providerPresentBeforePreset = false,
    expectedTools = undefined,   // opt-in declaration on the managed module entry
    allowEmpty = undefined,      // opt-out of the configured-empty-frontier refusal
    spyEvent = undefined,        // mount a listener BETWEEN the preset row and the attach
    expectedToolsMap = undefined, // top-level declaration map (string-entry form)
  } = options
  const dir = trackedDir(`a5sf-event-driven-${label}-`)
  const inside = join(dir, 'inside')
  mkdirSync(inside, { recursive: true })
  writeFileSync(join(inside, 'ok.txt'), 'ok\n')
  const sinkPath = join(dir, 'consult.jsonl')
  const bootProviders = [...providersAtBoot]
  // `providerPresentBeforePreset` means the provider is registered BEFORE the
  // preset row is mounted (the "provider present before mount" shape); the
  // default registers it after the preset row so E4 measures only the managed
  // side's condition.
  const root = await makeRoot({ providers: bootProviders })
  const subagents = root.get('subagents')
  const { standing, agentCtx, agentKey } = presetTopology(root)

  if (presetMode === 'real') {
    const presetConfig = { provider: presetProvider ?? managedProvider, toolName: 'subagent' }
    await standing.ctx.plugin(SUBAGENT, presetConfig)
  } else {
    const double = await import(PRESET_DOUBLE_URL)
    await standing.ctx.plugin(double)
  }
  if (providerPresentBeforePreset && presetMode === 'real') {
    subagents.registerProvider(testProvider(presetProvider ?? managedProvider))
  }

  const a5sfConfig = row.a5sfRealmConfigOf({
    a5sfEvidencePath: sinkPath,
    a5sfNativeToolModules: [{
      url: HOST_TOOL_SUBAGENT,
      config: { provider: managedProvider, toolName: 'subagent' },
      ...(expectedTools === undefined ? {} : { expectedTools }),
      ...(allowEmpty === undefined ? {} : { allowEmpty }),
    }],
    ...(expectedToolsMap === undefined ? {} : { a5sfExpectedTools: expectedToolsMap }),
  })
  // C2 UNDECIDABILITY MEASUREMENT: the exact row input this seam receives. Two
  // worlds that differ ONLY in the preset plane's module config must produce the
  // same hash — that is what makes the hazard undecidable here.
  // Normalized: the evidence path is a temp dir, and the point of the hash is
  // that the ROW INPUT (modules + declaration + config) is identical.
  const rowConfigJson = JSON.stringify(a5sfConfig.nativeToolModules)
  const out = {
    label,
    presetMode,
    presetProvider: presetMode === 'real' ? (presetProvider ?? managedProvider) : null,
    managedProvider,
    providersAtBoot: bootProviders,
    providerAfter: providerAfter ?? null,
    removeAfter: removeAfter ?? null,
    expectedTools: expectedTools ?? null,
    allowEmpty: allowEmpty ?? null,
    rowConfigJson: rowConfigJson === undefined ? null : rowConfigJson,
  }
  // FIBER TRACE: what the mount creates, so "a settle window is entered but
  // there is no transient descendant" is measured, not inferred.
  const createdFibers = []
  const detachTrace = root.on('internal/plugin', (created) => {
    createdFibers.push({ uid: String(created.uid ?? ''), name: String(created.name ?? ''), state: created.state })
  })
  if (spyEvent !== undefined) {
    // C1 WINDOW PROBE: a listener mounted AFTER the preset row and BEFORE the
    // managed attach. On the boundary emission it dispatches the managed name in
    // the exact window the record exists to cover: the record is set, the
    // managed registration has not landed, and the fold therefore sees nothing.
    const spyPlugin = {
      name: 'probe-window-spy',
      inject: ['tools'],
      apply(ctx) {
        ctx.on(spyEvent, () => {
          if (out.windowDispatch !== undefined) return
          out.windowDispatch = dispatchTool(root, agentKey, 'subagent', SUBAGENT_ARGS)
        })
      },
    }
    await standing.ctx.plugin(spyPlugin)
    out.spyMounted = true
  }
  let realm
  const started = Date.now()
  try {
    realm = await row.mountMemberA5sfRealm({
      root: agentCtx,
      a5sfConfig,
      provider: compiledProvider({ inside }),
      member: { sessionId: 'session-probe', instanceId: IDENTITY.memberInstanceId, teamRootSessionId: 'team-root', templateId: IDENTITY.templateId },
    })
    out.presetSurface = surfaceNames(root, agentKey)
    out.presetDefinitions = new Map(out.presetSurface.map((name) => [name, root.get('tools').get(name, agentKey)]))
    out.presetHasSubagent = out.presetSurface.includes('subagent')
    out.createdBeforeAttach = createdFibers.length
    out.fibers = await row.attachA5sfNativeToolModules(realm, agentCtx, a5sfConfig, agentKey)
    out.mounted = true
    out.routings = routingsOf(out.fibers)
    out.attachCreatedFibers = createdFibers.slice(out.createdBeforeAttach).map((fiber) => ({ ...fiber, state: fiber.state }))
    out.surfaceAfterAttach = surfaceNames(root, agentKey)
    out.definitionsAfterAttach = new Map(out.surfaceAfterAttach.map((name) => [name, root.get('tools').get(name, agentKey)]))
    out.subagentDefinitionAfterAttach = root.get('tools').get('subagent', agentKey)
    out.subagentDefinitionIsPreset = out.subagentDefinitionAfterAttach !== undefined
      && out.subagentDefinitionAfterAttach === out.presetDefinitions.get('subagent')
    try { await realm.whenNativeVerificationSettled() } catch (error) { out.verificationError = String(error?.message ?? error) }
    out.nativeInvalidationAfterAttach = realm.nativeInvalidation ?? null

    if (providerAfter !== undefined) {
      const before = subagents.starts.length
      try {
        out.providerRegistration = { threw: false, code: null, message: null }
        subagents.registerProvider(testProvider(providerAfter))
      } catch (error) {
        out.providerRegistration = {
          threw: true,
          name: String(error?.name ?? ''),
          code: String(error?.code ?? ''),
          message: String(error?.message ?? error),
        }
      }
      out.providerStartsAtEvent = subagents.starts.length - before
      out.providerStillRegistered = subagents.providers.has(providerAfter)
      out.invalidationAfterProviderEvent = realm.nativeInvalidation ?? null
      out.fiberStatesAtEvent = (out.fibers ?? []).map((fiber) => fiber?.state)
    }
    if (removeAfter !== undefined) {
      subagents.removeProvider(removeAfter)
      out.invalidationAfterProviderRemoved = realm.nativeInvalidation ?? null
    }
    await body?.({ realm, root, agentCtx, agentKey, out, subagents, sinkPath, a5sfConfig, inside })
    out.nativeInvalidation = realm.nativeInvalidation ?? null
  } catch (error) {
    out.mounted = false
    out.error = {
      name: String(error?.name ?? ''),
      code: String(error?.code ?? ''),
      detail: String(error?.detail ?? ''),
      message: String(error?.message ?? error),
      stack: String(error?.stack ?? ''),
    }
  } finally {
    detachTrace?.()
    out.elapsedMs = Date.now() - started
    out.surfaceAtEnd = surfaceNames(root, agentKey)
    try { await realm?.dispose?.() } catch (disposeError) { out.disposeError = String(disposeError?.message ?? disposeError) }
  }
  log(`${label}: mounted=${String(out.mounted)} elapsedMs=${String(out.elapsedMs)} `
    + `${out.mounted
      ? `preset=${JSON.stringify(out.presetSurface)} after=${JSON.stringify(out.surfaceAfterAttach)} routings=${JSON.stringify(out.routings)}`
      : JSON.stringify(out.error).slice(0, 700)}`)
  return out
}

/** JSON-safe projection: Fiber/Context objects cannot be serialized. */
function summarize(armResult) {
  const identities = {}
  for (const name of armResult.surfaceAfterAttach ?? []) {
    identities[name] = armResult.definitionsAfterAttach?.get(name) === armResult.presetDefinitions?.get(name) ? 'preset' : 'routed'
  }
  const record = armResult.nativeInvalidation ?? armResult.nativeInvalidationAfterProviderEvent ?? null
  return {
    label: armResult.label,
    presetMode: armResult.presetMode,
    presetProvider: armResult.presetProvider,
    managedProvider: armResult.managedProvider,
    providersAtBoot: armResult.providersAtBoot,
    providerAfter: armResult.providerAfter,
    removeAfter: armResult.removeAfter,
    expectedTools: armResult.expectedTools ?? null,
    allowEmpty: armResult.allowEmpty ?? null,
    rowConfigJson: armResult.rowConfigJson ?? null,
    spyMounted: armResult.spyMounted ?? null,
    windowDispatchIssued: armResult.windowDispatch !== undefined,
    windowDispatchResult: armResult.windowDispatchResult ?? null,
    invalidationAfterWindow: armResult.invalidationAfterWindow ?? null,
    providerStartsAfterWindow: armResult.providerStartsAfterWindow ?? null,
    guardFactsAfterWindow: armResult.guardFactsAfterWindow ?? null,
    mounted: armResult.mounted,
    elapsedMs: armResult.elapsedMs,
    presetSurface: armResult.presetSurface,
    presetHasSubagent: armResult.presetHasSubagent,
    createdBeforeAttach: armResult.createdBeforeAttach,
    attachCreatedFibers: armResult.attachCreatedFibers,
    surfaceAfterAttach: armResult.surfaceAfterAttach,
    definitionIdentities: identities,
    subagentDefinition: armResult.subagentDefinitionAfterAttach === undefined
      ? 'absent'
      : armResult.subagentDefinitionIsPreset ? 'preset' : 'routed',
    routings: armResult.routings,
    invalidation: record === null || record === undefined ? null : {
      reason: record.reason,
      uncovered: record.uncovered,
      surfaceAdded: record.surfaceAdded,
      surfaceRemoved: record.surfaceRemoved,
      lateRegistrations: record.lateRegistrations,
    },
    invalidationAfterAttach: armResult.nativeInvalidationAfterAttach ?? null,
    providerRegistration: armResult.providerRegistration ?? null,
    providerStillRegistered: armResult.providerStillRegistered ?? null,
    fiberStatesAtEvent: armResult.fiberStatesAtEvent ?? null,
    fiberStatesAfterSettle: armResult.fiberStatesAfterSettle ?? null,
    fiberStatesAfterDispatch: armResult.fiberStatesAfterDispatch ?? null,
    surfaceAfterEvent: armResult.surfaceAfterEvent ?? null,
    definitionAfterEvent: armResult.definitionAfterEvent ?? null,
    invalidationAfterProviderRemoved: armResult.invalidationAfterProviderRemoved
      ? {
        reason: armResult.invalidationAfterProviderRemoved.reason,
        uncovered: armResult.invalidationAfterProviderRemoved.uncovered,
        surfaceAdded: armResult.invalidationAfterProviderRemoved.surfaceAdded,
        lateRegistrations: armResult.invalidationAfterProviderRemoved.lateRegistrations,
      }
      : null,
    surfaceAtEnd: armResult.surfaceAtEnd,
    dispatches: armResult.dispatches ?? null,
    guardFacts: armResult.guardFacts ?? null,
    providerStarts: armResult.providerStarts ?? null,
    attachRecord: armResult.attachRecord ?? null,
    dispatch: armResult.dispatch ?? null,
    partialReattachRefused: armResult.partialReattachRefused ?? null,
    guardFactsAfterRemount: armResult.guardFactsAfterRemount ?? null,
    reassembledInvalidation: armResult.reassembledInvalidation ?? null,
    reassembledAttachRecord: armResult.reassembledAttachRecord ?? null,
    reassembledRoutings: armResult.reassembledRoutings ?? null,
    unknownWhileFrozen: armResult.unknownWhileFrozen ?? null,
    unknownAfterRemount: armResult.unknownAfterRemount ?? null,
    subagentAfterRemount: armResult.subagentAfterRemount ?? null,
    providerStartsAfterRemount: armResult.providerStartsAfterRemount ?? null,
    coveredDispatchAfterEmission: armResult.coveredDispatchAfterEmission ?? null,
    providerStartsAfterWindow: armResult.providerStartsAfterWindow ?? null,
    guardFactsAfterWindow: armResult.guardFactsAfterWindow ?? null,
    providerStartsAfterCovered: armResult.providerStartsAfterCovered ?? null,
    guardFactsAfterCovered: armResult.guardFactsAfterCovered ?? null,
    error: armResult.error ?? null,
    verificationError: armResult.verificationError ?? null,
  }
}

const results = []
function assertArm(armResult, checks, kind = 'contract') {
  const failures = []
  const observed = summarize(armResult)
  for (const [name, fn] of Object.entries(checks)) {
    try {
      const verdict = fn(observed)
      if (verdict !== true) failures.push(`${name}: ${String(verdict)}`)
    } catch (error) {
      failures.push(`${name}: thrown ${String(error?.message ?? error)}`)
    }
  }
  const record = { arm: armResult.label, kind, verdict: failures.length === 0 ? 'PASS' : 'FAIL', failures, observed }
  results.push(record)
  log(`${armResult.label}: ${record.verdict}${failures.length === 0 ? '' : ` — ${failures.join('; ')}`}`)
  return record
}

const SUBAGENT_ARGS = { description: 'probe delegation', prompt: 'probe prompt' }


const result = {
  schema: 'a5sf-e8-freeze/probe/1',
  at: new Date().toISOString(),
  hostTree: HOST_TREE,
  hostToolSubagent: HOST_TOOL_SUBAGENT,
  hostToolSubagentVersion: JSON.parse(readFileSync(join(HOST_TREE, 'packages', 'subagent', 'tool-subagent', 'package.json'), 'utf8')).version,
  arms: [],
}
try {
  // ── E8: THE MEASURED INTRA-EMISSION DISPATCH WINDOW, now CLOSED ──────────
  // Product order with the REAL pinned module on BOTH planes: the preset
  // listener registers `subagent` first inside `subagent/provider-added`, the
  // surface gate sets the invalidation record (verification detached, teardown
  // deferred one microtask), a spy listener mounted between the preset row and
  // the managed attach dispatches `subagent` INSIDE that same emission, and
  // only then does the managed module's listener register the same name.
  const e8 = await arm('E8-same-emission-dispatch-window-CLOSED', {
    presetMode: 'real',
    presetProvider: 'in-process',
    managedProvider: 'in-process',
    providersAtBoot: [],
    providerAfter: 'in-process',
    allowEmpty: true,
    spyEvent: 'subagent/provider-added',
  }, async ({ realm, root, agentKey, out, subagents, sinkPath }) => {
    out.attachRecord = realm.nativeAttachRecord ?? null
    out.windowDispatchResult = out.windowDispatch === undefined
      ? { missing: true }
      : await out.windowDispatch
    out.invalidationAfterWindow = realm.nativeInvalidation ?? null
    out.providerStartsAfterWindow = subagents.starts.length
    out.guardFactsAfterWindow = consultFacts(sinkPath).length
    // The name is covered once the managed registration has landed and been
    // folded at admission: it must yield the SPECIFIC name-keyed code.
    out.coveredDispatchAfterEmission = await dispatchTool(root, agentKey, 'subagent', SUBAGENT_ARGS)
    out.providerStartsAfterCovered = subagents.starts.length
    out.guardFactsAfterCovered = consultFacts(sinkPath).length
  })
  result.arms.push(assertArm(e8, {
    'the window dispatch was actually issued inside the emission': (r) => r.windowDispatchIssued === true
      || `windowDispatchIssued=${String(r.windowDispatchIssued)} spyMounted=${String(r.spyMounted)}`,
    'the record was already set in the window': (r) => r.invalidationAfterWindow !== null
      || 'no invalidation record before the managed registration',
    'the emission itself completed (the provider registration did not throw)': (r) => r.providerRegistration?.threw === false
      || `providerRegistration=${JSON.stringify(r.providerRegistration ?? null)}`,
    'the managed registration still landed (surfaceAdded names it)': (r) => JSON.stringify(r.invalidationAfterWindow?.surfaceAdded) === JSON.stringify(['subagent'])
      || `surfaceAdded=${JSON.stringify(r.invalidationAfterWindow?.surfaceAdded ?? null)}`,
    'THE WINDOW CALL IS DENIED (E8 closed) with the freeze code': (r) => r.windowDispatchResult?.isError === true
      && r.windowDispatchResult?.info?.code === 'A5SF_MEMBER_REALM_INVALIDATED'
      || `window=${JSON.stringify(r.windowDispatchResult ?? null)}`,
    'the refusal says what un-freezes the Member': (r) => /re-assembl/.test(r.windowDispatchResult?.text ?? '')
      || `text=${String(r.windowDispatchResult?.text ?? '')}`,
    'NO body ran in the window (preset or managed)': (r) => (r.providerStartsAfterWindow ?? -1) === 0
      || `providerStarts=${String(r.providerStartsAfterWindow)}`,
    'NO guard facts in the window': (r) => (r.guardFactsAfterWindow ?? -1) === 0
      || `guardFacts=${String(r.guardFactsAfterWindow)}`,
    'NAME-KEYED PRECEDENCE: the covered name keeps A5SF_NATIVE_SHADOW_INVALIDATED': (r) => r.coveredDispatchAfterEmission?.isError === true
      && r.coveredDispatchAfterEmission?.info?.code === 'A5SF_NATIVE_SHADOW_INVALIDATED'
      || `covered=${JSON.stringify(r.coveredDispatchAfterEmission ?? null)}`,
    'the covered refusal also runs no body': (r) => (r.providerStartsAfterCovered ?? -1) === 0
      || `providerStarts=${String(r.providerStartsAfterCovered)}`,
  }))

  // ── E8-lift: the freeze lifts ONLY on a full verified re-assembly ────────
  const lift = await arm('E8-lift-full-reassembly-admits-again', {
    presetMode: 'real',
    presetProvider: 'in-process',
    managedProvider: 'in-process',
    providersAtBoot: [],
    providerAfter: 'in-process',
    allowEmpty: true,
    spyEvent: 'subagent/provider-added',
  }, async ({ realm, root, agentCtx, agentKey, out, subagents, sinkPath, a5sfConfig, inside }) => {
    out.windowDispatchResult = out.windowDispatch === undefined ? { missing: true } : await out.windowDispatch
    out.invalidationAfterWindow = realm.nativeInvalidation ?? null
    // A name the attach never managed: the BLANKET freeze refuses it too.
    out.unknownWhileFrozen = await dispatchTool(root, agentKey, 'x_e8_unmanaged_probe', {})
    // A PARTIAL restoration is refused by the invalid realm.
    let partialRefused = null
    try {
      await realm.mountNativeToolModules([{ module: { name: 'x-partial', apply() {} } }])
      partialRefused = false
    } catch (error) {
      partialRefused = /invalidated/i.test(String(error?.message ?? error))
    }
    out.partialReattachRefused = partialRefused
    // FULL re-assembly: dispose the Member realm, mount + attach a NEW one on
    // the same agent/tool plane, settle verification, dispatch again.
    await realm.dispose()
    const realm2 = await row.mountMemberA5sfRealm({
      root: agentCtx,
      a5sfConfig,
      provider: compiledProvider({ inside }),
      member: { sessionId: 'session-probe', instanceId: IDENTITY.memberInstanceId, teamRootSessionId: 'team-root', templateId: IDENTITY.templateId },
    })
    const fibers2 = await row.attachA5sfNativeToolModules(realm2, agentCtx, a5sfConfig, agentKey)
    out.reassembledRoutings = routingsOf(fibers2)
    await realm2.whenNativeVerificationSettled()
    out.reassembledInvalidation = realm2.nativeInvalidation ?? null
    out.reassembledAttachRecord = realm2.nativeAttachRecord ?? null
    out.unknownAfterRemount = await dispatchTool(root, agentKey, 'x_e8_unmanaged_probe', {})
    out.subagentAfterRemount = await dispatchTool(root, agentKey, 'subagent', SUBAGENT_ARGS)
    out.providerStartsAfterRemount = subagents.starts.length
    out.guardFactsAfterRemount = consultFacts(sinkPath).length
    await realm2.dispose()
  })
  result.arms.push(assertArm(lift, {
    'the realm was invalidated by the boundary emission': (r) => r.invalidationAfterWindow !== null,
    'while frozen, even an UNMANAGED name is denied with the freeze code': (r) => r.unknownWhileFrozen?.isError === true
      && r.unknownWhileFrozen?.info?.code === 'A5SF_MEMBER_REALM_INVALIDATED'
      || `unknownWhileFrozen=${JSON.stringify(r.unknownWhileFrozen ?? null)}`,
    'no partial re-attach can lift the freeze': (r) => r.partialReattachRefused === true,
    'the fresh realm is verified, not invalid': (r) => r.reassembledInvalidation === null,
    'calls are ADMITTED again after the full re-assembly (unknown name resolves normally)': (r) => r.unknownAfterRemount?.isError === true
      && r.unknownAfterRemount?.info?.code === 'UNKNOWN_TOOL'
      || `unknownAfterRemount=${JSON.stringify(r.unknownAfterRemount ?? null)}`,
    'the re-assembled attach is a REAL routed frontier, not an empty acknowledgement': (r) => JSON.stringify(r.reassembledRoutings?.[0]?.forwarded) === JSON.stringify(['subagent'])
      || `reassembledRoutings=${JSON.stringify(r.reassembledRoutings ?? null)}`,
    'and the attach record does NOT acknowledge an empty frontier': (r) => r.reassembledAttachRecord?.emptyFrontierAcknowledged === false
      || `record=${JSON.stringify(r.reassembledAttachRecord ?? null)}`,
    'the re-assembled covered call executes the routed definition exactly once': (r) => r.subagentAfterRemount?.isError === false
      && (r.providerStartsAfterRemount ?? 0) === 1
      || `afterRemount=${JSON.stringify(r.subagentAfterRemount ?? null)} starts=${String(r.providerStartsAfterRemount)}`,
  }, 'contract+boundary'))

  // ── ACK-empty: allowEmpty on the REAL module (provider absent) ───────────
  const ackEmpty = await arm('ACK-empty-frontier-recorded', {
    presetMode: 'real',
    presetProvider: 'in-process',
    managedProvider: 'in-process',
    providersAtBoot: [],
    allowEmpty: true,
  }, async ({ realm, root, agentKey, out, subagents }) => {
    out.attachRecord = realm.nativeAttachRecord ?? null
    out.dispatch = await dispatchTool(root, agentKey, 'subagent', SUBAGENT_ARGS)
    out.providerStarts = subagents.starts.length
  })
  result.arms.push(assertArm(ackEmpty, {
    'the acknowledged-empty attach is ACCEPTED': (r) => r.mounted === true || `error=${JSON.stringify(r.error ?? null)}`,
    'the record carries emptyFrontierAcknowledged: true': (r) => r.attachRecord?.emptyFrontierAcknowledged === true
      || `record=${JSON.stringify(r.attachRecord ?? null)}`,
    'the acknowledged module is named': (r) => Array.isArray(r.attachRecord?.emptyFrontierModules)
      && r.attachRecord.emptyFrontierModules.length === 1
      || `record=${JSON.stringify(r.attachRecord ?? null)}`,
    'the ROW-CONFIG specifier that was accepted empty is recorded': (r) => JSON.stringify(r.attachRecord?.emptyFrontierSpecifiers) === JSON.stringify([HOST_TOOL_SUBAGENT])
      || `record=${JSON.stringify(r.attachRecord ?? null)}`,
    'nothing was declared on this entry (acknowledgedNames empty)': (r) => Array.isArray(r.attachRecord?.acknowledgedNames)
      && r.attachRecord.acknowledgedNames.length === 0
      || `record=${JSON.stringify(r.attachRecord ?? null)}`,
    'the name is unavailable (UNKNOWN_TOOL), not served': (r) => r.dispatch?.info?.code === 'UNKNOWN_TOOL'
      || `dispatch=${JSON.stringify(r.dispatch ?? null)}`,
    'no body ran': (r) => r.providerStarts === 0,
  }))

  // ── ACK-nonempty: a verified non-empty frontier does NOT carry the flag ──
  const ackVerified = await arm('ACK-nonempty-frontier-not-acknowledged', {
    presetMode: 'real',
    presetProvider: 'in-process',
    managedProvider: 'in-process',
    providersAtBoot: ['in-process'],
  }, async ({ realm, root, agentKey, out, subagents }) => {
    out.attachRecord = realm.nativeAttachRecord ?? null
    out.dispatch = await dispatchTool(root, agentKey, 'subagent', SUBAGENT_ARGS)
    out.providerStarts = subagents.starts.length
  })
  result.arms.push(assertArm(ackVerified, {
    'the non-empty attach is ACCEPTED': (r) => r.mounted === true || `error=${JSON.stringify(r.error ?? null)}`,
    'the record exists but does NOT acknowledge an empty frontier': (r) => r.attachRecord !== null
      && r.attachRecord?.emptyFrontierAcknowledged === false
      || `record=${JSON.stringify(r.attachRecord ?? null)}`,
    'no acknowledged modules and no acknowledged names': (r) => (r.attachRecord?.emptyFrontierModules ?? ['x']).length === 0
      && (r.attachRecord?.acknowledgedNames ?? ['x']).length === 0
      || `record=${JSON.stringify(r.attachRecord ?? null)}`,
    'the covered call executes the routed definition (the frontier is real)': (r) => r.dispatch?.isError === false
      && r.providerStarts === 1
      || `dispatch=${JSON.stringify(r.dispatch ?? null)} starts=${String(r.providerStarts)}`,
  }))
} finally {
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true })
}
writeFileSync(OUT, JSON.stringify(result, null, 2) + '\n')
writeFileSync(LOG, LOG_LINES.join('\n') + '\n')
log(`wrote ${OUT}`)
const failures = results.filter((record) => record.verdict === 'FAIL')
log(`RESULT arms=${String(results.length)} PASS:${String(results.length - failures.length)} FAIL:${String(failures.length)}`)
process.exitCode = failures.length === 0 ? 0 : 1
