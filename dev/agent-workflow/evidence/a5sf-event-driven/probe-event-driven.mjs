#!/usr/bin/env node
/**
 * probe-event-driven.mjs — HOST-FREE measurement of the THIRD registration
 * shape: EVENT-DRIVEN CONDITIONAL registration (`tool-subagent` registers its
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
const OUT = join(HERE, 'probe-event-driven.json')
const LOG = join(HERE, 'probe-event-driven.log')

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
    await body?.({ realm, root, agentKey, out, subagents, sinkPath })
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
  schema: 'a5sf-event-driven/probe/1',
  at: new Date().toISOString(),
  hostTree: HOST_TREE,
  hostToolSubagent: HOST_TOOL_SUBAGENT,
  hostToolSubagentVersion: JSON.parse(readFileSync(join(HOST_TREE, 'packages', 'subagent', 'tool-subagent', 'package.json'), 'utf8')).version,
  arms: [],
}
try {
  // ── E1: absent provider, SAME config on both planes (the product shape) ───
  // REVIEW C2 (2026-11-03): this shape is INDISTINGUISHABLE from E2 at the row —
  // same entry, same config, same empty frontier; only the preset plane's module
  // config differs, and the row cannot read it. The default is therefore fail
  // closed for any CONFIGURED module that forwards nothing; `allowEmpty: true`
  // is the explicit opt-out that E1b uses to keep the availability-only
  // measurement on record.
  const e1 = await arm('E1-absent-provider-same-config-REFUSED', {
    presetMode: 'real',
    presetProvider: 'in-process',
    managedProvider: 'in-process',
    providersAtBoot: [],
  }, async ({ root, agentKey, out, subagents, sinkPath }) => {
    // PRE-FIX BEHAVIOUR (RED): the attach is ACCEPTED and this body runs. Record
    // what it measures, so the refusal's absence is a measurement, not a guess.
    out.dispatches = { preFix: await dispatchTool(root, agentKey, 'subagent', SUBAGENT_ARGS) }
    out.guardFacts = consultFacts(sinkPath).length
    out.providerStarts = subagents.starts.length
    out.subagentDefinitionAfterAttach = root.get('tools').get('subagent', agentKey)
    out.subagentDefinition = out.subagentDefinitionAfterAttach === undefined ? 'absent' : 'definition-present'
  })
  result.arms.push(assertArm(e1, {
    'the CONFIGURED module with an empty frontier is REFUSED': (r) => r.mounted === false,
    'the refusal is TYPED': (r) => r.error?.code === 'A5SF_MANAGED_FRONTIER_EMPTY'
      || `error=${JSON.stringify(r.error ?? null)}`,
    'the refusal names the escape hatch': (r) => /allowEmpty/.test(r.error?.message ?? '')
      || `message=${String(r.error?.message)}`,
    'no invalidation (a refusal is not a late-change record)': (r) => r.invalidationAfterAttach === null,
    'the preset plane registered nothing either (the same absent provider)': (r) => r.surfaceAtEnd?.includes('subagent') !== true
      || `surface=${JSON.stringify(r.surfaceAtEnd)}`,
  }, 'contract'))

  const e1b = await arm('E1b-absent-provider-same-config-allowEmpty', {
    presetMode: 'real',
    presetProvider: 'in-process',
    managedProvider: 'in-process',
    providersAtBoot: [],
    allowEmpty: true,
  }, async ({ realm, root, agentKey, out, subagents, sinkPath }) => {
    const dispatch = await dispatchTool(root, agentKey, 'subagent', SUBAGENT_ARGS)
    out.dispatches = { beforeProvider: dispatch }
    out.guardFacts = consultFacts(sinkPath).length
    out.providerStarts = subagents.starts.length
    out.fiberStates = (out.fibers ?? []).map((fiber) => fiber?.state)
    out.attachFiberNames = (out.attachCreatedFibers ?? []).map((fiber) => fiber.name)
    void realm
  })
  result.arms.push(assertArm(e1b, {
    mounted: (r) => r.mounted === true || `attach refused: ${JSON.stringify(r.error ?? null)}`,
    'the opt-out ACCEPTED the empty frontier': (r) => r.mounted === true,
    'the module registered NOTHING (observed empty)': (r) => (r.routings?.[0]?.observed ?? null)?.length === 0
      || `observed=${JSON.stringify(r.routings?.[0]?.observed ?? null)}`,
    'NOTHING was forwarded (no shadow)': (r) => (r.routings?.[0]?.forwarded ?? null)?.length === 0
      || `forwarded=${JSON.stringify(r.routings?.[0]?.forwarded ?? null)}`,
    'the module created NO deferred child fiber (settle has nothing to wait for)': (r) => {
      const names = (r.attachCreatedFibers ?? []).map((fiber) => fiber.name)
      return names.length === 2 && names.includes('a5sf-tool-registration-router')
        || `created=${JSON.stringify(names)}`
    },
    'the preset row also registered NOTHING (the same absent provider)': (r) => r.presetHasSubagent === false
      || `preset surface=${JSON.stringify(r.presetSurface)}`,
    'surface unchanged': (r) => JSON.stringify(r.surfaceAfterAttach) === JSON.stringify(r.presetSurface)
      || `after=${JSON.stringify(r.surfaceAfterAttach)}`,
    'no definition of the name exists anywhere': (r) => r.subagentDefinition === 'absent'
      || `definition=${String(r.subagentDefinition)}`,
    'dispatch is unavailable (not a guard leak)': (r) => r.dispatches?.beforeProvider?.isError === true
      || `dispatch=${JSON.stringify(r.dispatches?.beforeProvider ?? null)}`,
    'the base provider never ran': (r) => r.providerStarts === 0 || `starts=${String(r.providerStarts)}`,
    'no invalidation at rest': (r) => r.invalidationAfterAttach === null,
  }))

  // ── E2: the MANAGED module's provider is absent while the PRESET plane
  //        serves the same name (two different provider configs) ─────────────
  // REVIEW C2: the natural-composition hazard. On the PREVIOUS head this attach
  // was accepted and the preset body executed with zero guard facts (E2b, the
  // canary that still records it under the explicit opt-out). Default = REFUSED.
  const e2 = await arm('E2-absent-managed-provider-preset-serves-name-REFUSED', {
    presetMode: 'real',
    presetProvider: 'in-process',
    managedProvider: 'ghost',
    providersAtBoot: ['in-process'],
  }, async ({ root, agentKey, out, subagents, sinkPath }) => {
    // PRE-FIX BEHAVIOUR (RED): the ATK4 composition is accepted and the preset
    // definition executes the base provider with zero guard facts.
    out.dispatches = { preFix: await dispatchTool(root, agentKey, 'subagent', SUBAGENT_ARGS) }
    out.guardFacts = consultFacts(sinkPath).length
    out.providerStarts = subagents.starts.length
    out.subagentDefinitionAfterAttach = root.get('tools').get('subagent', agentKey)
    out.subagentDefinition = out.subagentDefinitionAfterAttach === undefined ? 'absent' : 'definition-present'
  })
  result.arms.push(assertArm(e2, {
    'the ATK4 composition is REFUSED at assembly': (r) => r.mounted === false,
    'the refusal is TYPED': (r) => r.error?.code === 'A5SF_MANAGED_FRONTIER_EMPTY'
      || `error=${JSON.stringify(r.error ?? null)}`,
    'the preset definition was never executed': (r) => r.surfaceAtEnd?.includes('subagent') === true
      && r.providerStartsAtEvent === undefined
      || `surface=${JSON.stringify(r.surfaceAtEnd)} starts=${String(r.providerStartsAtEvent)}`,
    'no invalidation (a refusal is not a late-change record)': (r) => r.invalidationAfterAttach === null,
  }))

  const e2b = await arm('E2b-absent-managed-provider-allowEmpty-canary', {
    presetMode: 'real',
    presetProvider: 'in-process',
    managedProvider: 'ghost',
    providersAtBoot: ['in-process'],
    allowEmpty: true,
  }, async ({ root, agentKey, out, subagents, sinkPath }) => {
    out.guardFactsBefore = consultFacts(sinkPath).length
    const dispatch = await dispatchTool(root, agentKey, 'subagent', SUBAGENT_ARGS)
    out.dispatches = { withPresetName: dispatch }
    out.guardFacts = consultFacts(sinkPath).length
    out.providerStarts = subagents.starts.length
    void root
  })
  result.arms.push(assertArm(e2b, {
    mounted: (r) => r.mounted === true || `attach refused: ${JSON.stringify(r.error ?? null)}`,
    'the OPT-OUT accepts the empty frontier': (r) => r.mounted === true,
    'the preset plane DOES provide the name': (r) => r.presetHasSubagent === true
      || `preset surface=${JSON.stringify(r.presetSurface)}`,
    'the name still resolves to the PRESET definition after the attach': (r) => r.subagentDefinition === 'preset'
      || `definition=${String(r.subagentDefinition)}`,
    'the unshadowed preset definition EXECUTES (unguarded)': (r) => r.dispatches?.withPresetName?.isError === false
      || `dispatch=${JSON.stringify(r.dispatches?.withPresetName ?? null)}`,
    'ZERO a5sf guard facts were consulted': (r) => r.guardFacts === 0 || `facts=${String(r.guardFacts)}`,
    'the base provider ran': (r) => r.providerStarts === 1 || `starts=${String(r.providerStarts)}`,
    'no invalidation fired (nothing to detect)': (r) => r.invalidation === null,
  }, 'hazard-canary'))

  // ── E3a: the provider appears AFTER the mount settled, managed plane only
  //         (the preset row is configured with a DIFFERENT, still-absent
  //         provider, so it does not race the managed registration) ─────────
  const e3a = await arm('E3a-provider-after-settle-managed-only', {
    presetMode: 'real',
    presetProvider: 'preset-absent',
    managedProvider: 'in-process',
    providersAtBoot: [],
    providerAfter: 'in-process',
    allowEmpty: true,
  }, async ({ realm, root, agentKey, out, subagents, sinkPath }) => {
    out.dispatches = {}
    for (let i = 0; i < 80 && (out.fibers ?? []).some((fiber) => (fiber?.state ?? 4) < 4); i += 1) {
      await new Promise((resolve) => setTimeout(resolve, 5))
    }
    await realm.whenNativeVerificationSettled?.()
    out.guardFacts = consultFacts(sinkPath).length
    out.providerStarts = subagents.starts.length
    out.surfaceAfterEvent = surfaceNames(root, agentKey)
    out.dispatches.afterDeny = await dispatchTool(root, agentKey, 'subagent', SUBAGENT_ARGS)
    out.definitionAfterEvent = root.get('tools').get('subagent', agentKey) === undefined ? 'absent' : 'preset'
  })
  result.arms.push(assertArm(e3a, {
    mounted: (r) => r.mounted === true || `attach refused: ${JSON.stringify(r.error ?? null)}`,
    'the attach itself accepted (nothing to settle)': (r) => r.invalidationAfterAttach === null,
    'the provider registration did NOT throw': (r) => r.providerRegistration?.threw === false
      || `providerRegistration=${JSON.stringify(r.providerRegistration ?? null)}`,
    'the late provider event INVALIDATES (fold, not escape)': (r) => r.invalidation !== null
      || 'the post-settle registration left no record',
    'the record FOLDS IN the late name (lateRegistrations)': (r) => JSON.stringify(r.invalidation?.lateRegistrations) === JSON.stringify(['subagent'])
      || `lateRegistrations=${JSON.stringify(r.invalidation?.lateRegistrations ?? null)}`,
    'the reason says it landed after the mount settled': (r) => /after the mount settled/.test(r.invalidation?.reason ?? '')
      || `reason: ${r.invalidation?.reason ?? ''}`,
    'uncovered is empty (the folded definition was live)': (r) => JSON.stringify(r.invalidation?.uncovered) === JSON.stringify([])
      || `uncovered=${JSON.stringify(r.invalidation?.uncovered ?? null)}`,
    'surfaceAdded names the newly visible name': (r) => JSON.stringify(r.invalidation?.surfaceAdded) === JSON.stringify(['subagent'])
      || `surfaceAdded=${JSON.stringify(r.invalidation?.surfaceAdded ?? null)}`,
    'the admission deny COVERS the folded name': (r) => r.dispatches?.afterDeny?.isError === true
      && r.dispatches?.afterDeny?.info?.code === 'A5SF_NATIVE_SHADOW_INVALIDATED'
      || `dispatch=${JSON.stringify(r.dispatches?.afterDeny ?? null)}`,
    'the base provider never ran': (r) => r.providerStarts === 0 || `starts=${String(r.providerStarts)}`,
    'no guard facts (denied before execution)': (r) => r.guardFacts === 0 || `facts=${String(r.guardFacts)}`,
  }))

  // ── E3b: the PRODUCT order — preset row mounted first, same configuration,
  //         provider appears after settle. The preset plane's registration wins
  //         the race inside the SAME synchronous `subagent/provider-added`
  //         emission; the managed registration must still land, be folded and
  //         be denied, and the emission must not throw. ────────────────────
  const e3b = await arm('E3b-provider-after-settle-product-order', {
    presetMode: 'real',
    presetProvider: 'in-process',
    managedProvider: 'in-process',
    providersAtBoot: [],
    providerAfter: 'in-process',
    allowEmpty: true,
  }, async ({ realm, root, agentKey, out, subagents, sinkPath }) => {
    out.dispatches = {}
    for (let i = 0; i < 80 && (out.fibers ?? []).some((fiber) => (fiber?.state ?? 4) < 4); i += 1) {
      await new Promise((resolve) => setTimeout(resolve, 5))
    }
    await realm.whenNativeVerificationSettled?.()
    out.guardFacts = consultFacts(sinkPath).length
    out.providerStarts = subagents.starts.length
    out.fiberStatesAfterSettle = (out.fibers ?? []).map((fiber) => fiber?.state)
    out.surfaceAfterEvent = surfaceNames(root, agentKey)
    const defAfterSettle = root.get('tools').get('subagent', agentKey)
    out.definitionAfterEvent = defAfterSettle === undefined ? 'absent'
      : out.presetDefinitions.get('subagent') === undefined ? 'preset-plane'
      : defAfterSettle === out.presetDefinitions.get('subagent') ? 'preset-snapshot' : 'routed'
    out.dispatches.afterDeny = await dispatchTool(root, agentKey, 'subagent', SUBAGENT_ARGS)
    out.providerStarts = subagents.starts.length
    out.fiberStatesAfterDispatch = (out.fibers ?? []).map((fiber) => fiber?.state)
  })
  result.arms.push(assertArm(e3b, {
    mounted: (r) => r.mounted === true || `attach refused: ${JSON.stringify(r.error ?? null)}`,
    'the attach itself accepted (nothing to settle)': (r) => r.invalidationAfterAttach === null,
    'the provider registration did NOT throw (RED: INACTIVE_EFFECT)': (r) => r.providerRegistration?.threw === false
      || `providerRegistration=${JSON.stringify(r.providerRegistration ?? null)}`,
    'the provider stays registered': (r) => r.providerStillRegistered === true,
    'the surface-gate invalidation fired': (r) => r.invalidation !== null
      || 'the preset plane\'s late registration left no record',
    'surfaceAdded names the preset-plane name': (r) => JSON.stringify(r.invalidation?.surfaceAdded) === JSON.stringify(['subagent'])
      || `surfaceAdded=${JSON.stringify(r.invalidation?.surfaceAdded ?? null)}`,
    'uncovered is empty (the managed definition was live when folded)': (r) => JSON.stringify(r.invalidation?.uncovered) === JSON.stringify([])
      || `uncovered=${JSON.stringify(r.invalidation?.uncovered ?? null)}`,
    'the preset plane\'s definition is visible again after the teardown': (r) => r.definitionAfterEvent === 'preset-plane'
      || `definitionAfterEvent=${String(r.definitionAfterEvent)}`,
    'the admission deny COVERS the name (folded after the boundary record)': (r) => r.dispatches?.afterDeny?.isError === true
      && r.dispatches?.afterDeny?.info?.code === 'A5SF_NATIVE_SHADOW_INVALIDATED'
      || `dispatch=${JSON.stringify(r.dispatches?.afterDeny ?? null)}`,
    'the base provider never ran': (r) => r.providerStarts === 0 || `starts=${String(r.providerStarts)}`,
    'no guard facts (denied before execution)': (r) => r.guardFacts === 0 || `facts=${String(r.guardFacts)}`,
  }))

  // ── E4: the provider is present BEFORE the mount ─────────────────────────
  const e4 = await arm('E4-provider-present-before-mount', {
    presetMode: 'real',
    presetProvider: 'in-process',
    managedProvider: 'in-process',
    providersAtBoot: ['in-process'],
  }, async ({ root, agentKey, out, subagents, sinkPath }) => {
    out.guardFactsBefore = consultFacts(sinkPath).length
    const dispatch = await dispatchTool(root, agentKey, 'subagent', SUBAGENT_ARGS)
    out.dispatches = { covered: dispatch }
    out.guardFacts = consultFacts(sinkPath).length
    out.providerStarts = subagents.starts.length
    out.fiberStates = (out.fibers ?? []).map((fiber) => fiber?.state)
  })
  result.arms.push(assertArm(e4, {
    mounted: (r) => r.mounted === true || `attach refused: ${JSON.stringify(r.error ?? null)}`,
    'the registration is SYNCHRONOUS (observed and forwarded)': (r) => JSON.stringify(r.routings?.[0]?.forwarded) === JSON.stringify(['subagent'])
      || `routings=${JSON.stringify(r.routings)}`,
    'the definition is ROUTED (not the preset object)': (r) => r.subagentDefinition === 'routed'
      || `definition=${String(r.subagentDefinition)}`,
    'the routed definition is IDENTITY-verified by the row': (r) => r.mounted === true,
    'surface unchanged': (r) => JSON.stringify(r.surfaceAfterAttach) === JSON.stringify(r.presetSurface)
      || `after=${JSON.stringify(r.surfaceAfterAttach)}`,
    'the covered call executes the routed definition': (r) => r.dispatches?.covered?.isError === false
      && /BASE-PROVIDER-RAN/.test(r.dispatches?.covered?.text ?? '')
      || `dispatch=${JSON.stringify(r.dispatches?.covered ?? null)}`,
    'the base provider ran exactly once (the shadow is live)': (r) => r.providerStarts === 1 || `starts=${String(r.providerStarts)}`,
    'no invalidation at rest': (r) => r.invalidationAfterAttach === null,
    'the fiber stays ACTIVE': (r) => (r.fiberStates ?? []).every((state) => state === 2) || `states=${JSON.stringify(r.fiberStates)}`,
  }))

  // ── E5: provider REMOVED after a covered mount (event path control) ───────
  const e5 = await arm('E5-provider-removed-after-covered-mount', {
    presetMode: 'real',
    presetProvider: 'in-process',
    managedProvider: 'in-process',
    providersAtBoot: ['in-process'],
    removeAfter: 'in-process',
  }, async ({ realm, root, agentKey, out, subagents, sinkPath }) => {
    await realm.whenNativeVerificationSettled?.()
    for (let i = 0; i < 80 && (out.fibers ?? []).some((fiber) => (fiber?.state ?? 4) < 4); i += 1) {
      await new Promise((resolve) => setTimeout(resolve, 5))
    }
    out.dispatches = { afterRemoval: await dispatchTool(root, agentKey, 'subagent', SUBAGENT_ARGS) }
    out.guardFacts = consultFacts(sinkPath).length
    out.providerStarts = subagents.starts.length
    void root
  })
  result.arms.push(assertArm(e5, {
    mounted: (r) => r.mounted === true || `attach refused: ${JSON.stringify(r.error ?? null)}`,
    'the removal INVALIDATES with the lost managed name': (r) => JSON.stringify(r.invalidationAfterProviderRemoved?.uncovered) === JSON.stringify(['subagent'])
      || `record=${JSON.stringify(r.invalidationAfterProviderRemoved ?? null)}`,
    'the admission deny covers the name': (r) => r.dispatches?.afterRemoval?.isError === true
      && r.dispatches?.afterRemoval?.info?.code === 'A5SF_NATIVE_SHADOW_INVALIDATED'
      || `dispatch=${JSON.stringify(r.dispatches?.afterRemoval ?? null)}`,
    'the base provider never ran': (r) => r.providerStarts === 0 || `starts=${String(r.providerStarts)}`,
  }))
  // ── E6: the OPT-IN declaration on the DIVERGENT composition ──────────────
  // Same shape as E2 (preset plane serves `subagent`, the managed module's
  // provider is absent), but the managed entry DECLARES `expectedTools`. The
  // declaration grants nothing; it only turns "declared but never shadowed"
  // into a typed assembly refusal instead of a silent zero-shadow attach.
  const e6 = await arm('E6-expected-tools-declared-divergent', {
    presetMode: 'real',
    presetProvider: 'in-process',
    managedProvider: 'ghost',
    providersAtBoot: ['in-process'],
    expectedTools: ['subagent'],
  }, async ({ root, agentKey, out, subagents, sinkPath }) => {
    out.guardFacts = consultFacts(sinkPath).length
    out.providerStarts = subagents.starts.length
    out.dispatches = { afterRefusal: await dispatchTool(root, agentKey, 'subagent', SUBAGENT_ARGS) }
    void root
  })
  result.arms.push(assertArm(e6, {
    'the attach is REFUSED (not silently accepted with zero shadow)': (r) => r.mounted === false
      || `mounted=${String(r.mounted)} routings=${JSON.stringify(r.routings)}`,
    'the refusal is TYPED and names the declaration': (r) => r.error?.code === 'A5SF_EXPECTED_TOOLS_UNSHADOWED'
      || `error=${JSON.stringify(r.error ?? null)}`,
    'the refusal NAMES the missing tool': (r) => /subagent/.test(r.error?.message ?? '')
      || `message=${String(r.error?.message ?? '')}`,
    'nothing was shadowed (no invalidation record)': (r) => (r.nativeInvalidation ?? null) === null
      && (r.nativeInvalidationAfterAttach ?? null) === null,
    // HONESTY: refusing the managed attach does NOT unregister the preset
    // plane's own definition — that registration belongs to the composition, not
    // to this seam. The declaration makes the mismatch LOUD at assembly; a
    // composition that still ships both planes will still serve the preset.
    'the preset plane\'s definition is still on the surface (refusal ≠ removal)': (r) => Array.isArray(r.surfaceAtEnd)
      && r.surfaceAtEnd.includes('subagent')
      || `surfaceAtEnd=${JSON.stringify(r.surfaceAtEnd ?? null)}`,
  }, 'hazard-boundary'))

  // ── E7: UNDECIDABILITY (review C2). Two worlds with the SAME row input — the
  //        same managed entry, the same config, `allowEmpty: true` so both are
  //        accepted — differing ONLY in the preset plane's module config, which
  //        is NOT an input of `a5sfRealmConfigOf`/`attachA5sfNativeToolModules`.
  //        World A: nothing serves the name anywhere (harmless). World B: the
  //        preset definition serves it and executes the base provider with zero
  //        guard facts (the ATK4 hazard). Identical `rowConfigJson` + opposite
  //        outcomes = the row cannot decide this by inspection; the decidable
  //        unit is the entry's own shape (`allowEmpty`) or a declaration.
  const e7a = await arm('E7a-undecidable-world-A-nothing-serves', {
    presetMode: 'real',
    presetProvider: 'ghost',
    managedProvider: 'ghost',
    providersAtBoot: [],
    allowEmpty: true,
  }, async ({ root, agentKey, out, subagents, sinkPath }) => {
    out.dispatches = { probe: await dispatchTool(root, agentKey, 'subagent', SUBAGENT_ARGS) }
    out.guardFacts = consultFacts(sinkPath).length
    out.providerStarts = subagents.starts.length
    void root
  })
  result.arms.push(assertArm(e7a, {
    mounted: (r) => r.mounted === true || `attach refused: ${JSON.stringify(r.error ?? null)}`,
    'nothing is forwarded': (r) => (r.routings?.[0]?.forwarded ?? null)?.length === 0,
    'the name is UNKNOWN (no definition anywhere)': (r) => r.subagentDefinition === 'absent'
      || `definition=${String(r.subagentDefinition)}`,
    'dispatch is unavailable': (r) => r.dispatches?.probe?.isError === true,
    'the base provider never ran': (r) => r.providerStarts === 0,
  }, 'measurement'))

  const e7b = await arm('E7b-undecidable-world-B-preset-serves', {
    presetMode: 'real',
    presetProvider: 'in-process',
    managedProvider: 'ghost',
    providersAtBoot: ['in-process'],
    allowEmpty: true,
  }, async ({ root, agentKey, out, subagents, sinkPath }) => {
    out.dispatches = { probe: await dispatchTool(root, agentKey, 'subagent', SUBAGENT_ARGS) }
    out.guardFacts = consultFacts(sinkPath).length
    out.providerStarts = subagents.starts.length
    void root
  })
  result.arms.push(assertArm(e7b, {
    mounted: (r) => r.mounted === true || `attach refused: ${JSON.stringify(r.error ?? null)}`,
    'nothing is forwarded': (r) => (r.routings?.[0]?.forwarded ?? null)?.length === 0,
    'the name resolves to the PRESET definition': (r) => r.subagentDefinition === 'preset'
      || `definition=${String(r.subagentDefinition)}`,
    'the preset definition EXECUTES unguarded': (r) => r.dispatches?.probe?.isError === false,
    'ZERO guard facts': (r) => r.guardFacts === 0,
    'the base provider ran': (r) => r.providerStarts === 1,
  }, 'measurement'))

  result.undecidability = {
    identicalRowInput: e7a.rowConfigJson === e7b.rowConfigJson,
    rowConfigJson: e7a.rowConfigJson,
    worldA: { definition: e7a.subagentDefinition, providerStarts: e7a.providerStarts ?? null, text: e7a.dispatches?.probe?.text ?? null },
    worldB: { definition: e7b.subagentDefinition, providerStarts: e7b.providerStarts ?? null, text: e7b.dispatches?.probe?.text ?? null },
    differsOnlyIn: 'the preset plane module config (not an input of a5sfRealmConfigOf)',
  }

  // ── E8: the SAME-EMISSION DISPATCH WINDOW (review C1). A listener mounted
  //        between the preset row and the managed attach dispatches the managed
  //        name inside the boundary emission, right after the surface record is
  //        set and before the managed registration lands. Measured: admission is
  //        decided in that window (the fold sees nothing), and the body that
  //        then runs is the one the name resolves to at execution time.
  const e8 = await arm('E8-same-emission-dispatch-window', {
    presetMode: 'real',
    presetProvider: 'in-process',
    managedProvider: 'in-process',
    providersAtBoot: [],
    providerAfter: 'in-process',
    allowEmpty: true,
    spyEvent: 'subagent/provider-added',
  }, async ({ out, subagents, sinkPath }) => {
    out.windowDispatchResult = out.windowDispatch === undefined
      ? { missing: true }
      : await out.windowDispatch
    out.invalidationAfterWindow = out.invalidationAfterProviderEvent
    out.providerStartsAfterWindow = subagents.starts.length
    out.guardFactsAfterWindow = consultFacts(sinkPath).length
  })
  result.arms.push(assertArm(e8, {
    'the window dispatch was actually issued': (r) => r.windowDispatchIssued === true
      || `windowDispatchIssued=${String(r.windowDispatchIssued)} spyMounted=${String(r.spyMounted)}`,
    'the dispatch was ADMITTED in the window (the fold saw nothing)': (r) => r.windowDispatchResult?.isError === false
      || `result=${JSON.stringify(r.windowDispatchResult ?? null)}`,
    'the body that ran is NAMED (measured, not inferred: the text is recorded verbatim)': (r) => (r.windowDispatchResult?.text ?? '').length > 0
      || `result=${JSON.stringify(r.windowDispatchResult)}`,
    'the record was already set when it ran': (r) => r.invalidationAfterWindow !== null
      || 'no surface record before the managed registration',
    'the emission itself completed (the provider registration did not throw)': (r) => r.providerRegistration?.threw === false
      || `providerRegistration=${JSON.stringify(r.providerRegistration ?? null)}`,
    'the managed registration still landed (surfaceAdded names it)': (r) => JSON.stringify(r.invalidation?.surfaceAdded) === JSON.stringify(['subagent'])
      || `surfaceAdded=${JSON.stringify(r.invalidation?.surfaceAdded ?? null)}`,
  }, 'measurement'))


} finally {
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true })
}
writeFileSync(OUT, JSON.stringify(result, null, 2) + '\n')
writeFileSync(LOG, LOG_LINES.join('\n') + '\n')
log(`wrote ${OUT}`)
const failures = results.filter((record) => record.verdict === 'FAIL')
log(`RESULT arms=${String(results.length)} PASS:${String(results.length - failures.length)} FAIL:${String(failures.length)}`)
process.exitCode = failures.length === 0 ? 0 : 1
