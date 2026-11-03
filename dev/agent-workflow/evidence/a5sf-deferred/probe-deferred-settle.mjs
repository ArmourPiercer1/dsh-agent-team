#!/usr/bin/env node
/**
 * probe-deferred-settle.mjs — HOST-FREE proof of the deferred-registration
 * settle/inspect decision in the routed native tool mount.
 *
 * WHY THIS EXISTS. `a5sf-acceptance` measured that #561's refusal refuses the
 * WHOLE native `dsh-tool-fs` mount whenever `attachments` is resolvable, so no
 * a5sf-wired Member can activate on a live Host. The seam treated "a deferred
 * descendant fiber is not ACTIVE yet and one of its inject names resolves" as
 * fatal. This probe drives the REAL product entry points the live glue uses —
 * `mountMemberA5sfRealm` -> `attachA5sfNativeToolModules` — with the REAL
 * pinned `@deepseek-ai/dsh-tool-fs`, in an in-process unit root. ZERO Host
 * boots, ZERO ports, no DSH_HOME, no pristine-tree writes.
 *
 * ARMS (each one is an assertion, not a narration):
 *   A1 ACCEPT      routed mount + resolvable `attachments` + pinned tool-fs
 *                  MUST mount, and `read`/`read_image` must resolve to the
 *                  ROUTED definitions (the preset object is not the one the
 *                  agent sees), with the name set unchanged.
 *   A2 UNCOVERED   a deferred registration that lands a name no fiber of the
 *                  attach forwards MUST still be refused, and the reason MUST
 *                  name the name (this is #561's protection, kept).
 *   A3 FAILED      a deferred child that ends FAILED MUST be refused (typed).
 *   A4 UNSETTLED   a deferred child that never settles within the bound MUST
 *                  be refused, and the probe must not hang.
 *   A5 SHADOW      after acceptance the P0 invalidation path still works: an
 *                  external holder disposing every shadow fiber is RECORDED
 *                  (surface restored, no half-shadow). The admission deny that
 *                  consumes that record is re-run by the a5sf assembly suite
 *                  (`tests/world-factory/a5sf-assembly.test.mjs`), whose arms
 *                  are executed by the lane's GREEN step.
 *
 * Run: node probe-deferred-settle.mjs
 */
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire, register } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = join(HERE, '..', '..', '..', '..')
const OUT = join(HERE, 'probe-deferred-settle.json')
const LOG = join(HERE, 'probe-deferred-settle.log')

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
const HOST_TOOL_FS = pathToFileURL(join(HOST_TREE, 'packages', 'fs', 'tool-fs', 'lib', 'index.js')).href

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

const IDENTITY = Object.freeze({ teamId: 'team-deferred-probe', memberInstanceId: 'member-probe-a', templateId: 'worker', instanceGeneration: 1 })
const lane = (allow) => Object.freeze({ mode: 'restricted', allow: Object.freeze([...allow]), ask: Object.freeze([]), deny: Object.freeze([]) })

const dirs = []
function trackedDir(prefix) {
  const dir = mkdtempSync(join(tmpdir(), prefix))
  dirs.push(dir)
  return dir
}

/** The unit-world fs double (same shape as the route-C suite's). */
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

/** The `attachments` service the pinned tool-fs ALWAYS injects for `read_image`. */
class TestAttachments extends Service {
  constructor(ctx) {
    super(ctx, 'attachments')
    this.imageLimits = Object.freeze({
      mediaTypes: Object.freeze(['image/png', 'image/jpeg']),
      maxImageBytes: 10 * 1024 * 1024,
      maxMessageImageBytes: 10 * 1024 * 1024,
      maxImageDimension: 8000,
      maxImagePixels: 40_000_000,
    })
  }
  async saveImage() { return { ref: 'image-probe' } }
}

function presetTopology(root) {
  const standingKey = {}
  const standing = createScope(root, standingKey)
  const agentKey = {}
  const agent = createScope(root, agentKey)
  bindScopeParent(agentKey, standingKey)
  return { standingKey, standing, agentKey, agentCtx: agent.ctx }
}

/** A preset row on the standing scope: one definition per name, so the routed
 *  mount's surface-neutrality check sees exactly the names the module forwards. */
function presetRowPlugin(names) {
  return {
    name: 'probe-preset-row',
    inject: ['tools', 'fs', 'systemPrompt'],
    apply(ctx) {
      for (const name of names) {
        ctx.systemPrompt.section({ name: `tool:${name}`, order: 50, text: `preset ${name} guidance` })
        ctx.tools.register({
          name,
          description: `preset native ${name} tool`,
          parameters: { type: 'object', properties: { file_path: { type: 'string' } }, required: ['file_path'], additionalProperties: false },
          output: { schema: { type: 'string' }, render: (_a, value) => [{ type: 'text', text: String(value) }] },
          async execute() { return 'ok\n' },
        })
      }
    },
  }
}

async function makeRoot({ attachments }) {
  const root = new Context()
  await root.plugin(SystemPrompt)
  await root.plugin(ToolRuntime)
  await root.plugin(TestFileSystem, {})
  if (attachments) await root.plugin(TestAttachments)
  return root
}

/**
 * The UNCOVERED shape, exercised at the realm seam (the product mount object
 * `mountMemberA5sfRealm` returns): a mount WITHOUT a ceiling sibling whose
 * module registers `read` synchronously (so the binding-targeted mount owns it)
 * and ALSO lands `x_a5sf_uncovered` from a DEFERRED child. The binding router
 * drops the deferred name, and no fiber of this call forwards it — the name no
 * fiber covers. The row expander (`nativeToolMountsOf`) always emits a ceiling
 * mount per module whose predicate forwards every non-binding-owned name, so
 * this shape is unreachable through `attachA5sfNativeToolModules` BY
 * CONSTRUCTION; the invariant still belongs to the seam that direct callers
 * (and any future routing change) reach. See README §4 for the argument.
 */
const UNCOVERED_DEFERRED_URL = `data:text/javascript,${encodeURIComponent(`
export const name = 'uncovered-deferred'
export const inject = ['tools', 'fs', 'systemPrompt']
export function apply(ctx) {
  ctx.tools.register({
    name: 'read',
    description: 'binding-owned read (forwarded by its own binding fiber)',
    parameters: { type: 'object', properties: { file_path: { type: 'string' } }, required: ['file_path'], additionalProperties: false },
    output: { schema: { type: 'string' }, render: (_a, value) => [{ type: 'text', text: String(value) }] },
    async execute() { return 'ok\\n' },
  })
  ctx.inject(['attachments'], (imageCtx) => {
    imageCtx.tools.register({
      name: 'x_a5sf_uncovered',
      description: 'deferred name no fiber of this mount forwards',
      parameters: { type: 'object', properties: {}, additionalProperties: false },
      output: { schema: { type: 'string' }, render: (_a, value) => [{ type: 'text', text: String(value) }] },
      async execute() { return 'ok\\n' },
    })
  })
}
`) }`

const FAILED_DEFERRED_URL = `data:text/javascript,${encodeURIComponent(`
export const name = 'failed-deferred'
export const inject = ['tools', 'fs', 'systemPrompt']
export function apply(ctx) {
  ctx.inject(['attachments'], () => { throw new Error('probe deferred child boom') })
}
`)}`

const UNSETTLED_DEFERRED_URL = `data:text/javascript,${encodeURIComponent(`
export const name = 'unsettled-deferred'
export const inject = ['tools', 'fs', 'systemPrompt']
export function apply(ctx) {
  ctx.inject(['attachments'], () => new Promise(() => {}))
}
`)}`

function compiledProvider({ inside, withBinding }) {
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
      ...(withBinding === true
        ? {
          bindings: [{
            identity: IDENTITY,
            toolBindingIdentity: 'dsh.fs/read',
            effective: Object.freeze({
              memberIdentity: IDENTITY.memberInstanceId,
              toolBindingIdentity: 'dsh.fs/read',
              invocationId: 'invocation-probe-1',
              policyRevision: `a5sf-probe:${IDENTITY.memberInstanceId}:g1`,
              read: lane([inside]),
              write: lane([inside]),
              network: Object.freeze({ access: 'allow' }),
            }),
            config: {},
          }],
        }
        : {}),
    }),
  })
}

function surfaceNames(root, scope) {
  return [...root.get('tools').schemas(scope)].map((schema) => schema?.name ?? schema).sort()
}

/**
 * ONE arm: compose the world, mount through the REAL product entry points and
 * return everything the assertion needs. No interpretation.
 */
async function arm(label, { attachments = true, presetNames, nativeModules, withBinding = false, bindingOnlyMount = false }, body) {
  const dir = trackedDir(`a5sf-deferred-${label}-`)
  const inside = join(dir, 'inside')
  mkdirSync(inside, { recursive: true })
  writeFileSync(join(inside, 'ok.txt'), 'ok\n')
  const sinkPath = join(dir, 'consult.jsonl')
  const root = await makeRoot({ attachments })
  const { standing, agentCtx, agentKey } = presetTopology(root)
  await standing.ctx.plugin(presetRowPlugin(presetNames))
  const toolFs = await import(HOST_TOOL_FS)
  const toolFsConfig = typeof toolFs.Config?.parse === 'function' ? toolFs.Config.parse({}) : {}
  const a5sfConfig = row.a5sfRealmConfigOf({
    a5sfEvidencePath: sinkPath,
    a5sfNativeToolModules: [
      { url: HOST_TOOL_FS, config: toolFsConfig },
      ...nativeModules.map((url) => ({ url })),
    ],
  })
  const out = { label, attachmentsService: attachments, withBinding }
  let realm
  const started = Date.now()
  try {
    realm = await row.mountMemberA5sfRealm({
      root: agentCtx,
      a5sfConfig,
      provider: compiledProvider({ inside, withBinding }),
      member: { sessionId: 'session-probe', instanceId: IDENTITY.memberInstanceId, teamRootSessionId: 'team-root', templateId: IDENTITY.templateId },
    })
    out.presetSurface = surfaceNames(root, agentKey)
    out.presetDefinitions = new Map(out.presetSurface.map((name) => [name, root.get('tools').get(name, agentKey)]))
    if (bindingOnlyMount) {
      // The realm object is the SAME product seam; the mount is driven directly
      // because the row expander cannot emit a binding-only mount (see the
      // UNCOVERED_DEFERRED_URL note).
      const url = nativeModules[0].replace(/^data:text\/javascript,/, '')
      const module = await import(nativeModules[0])
      out.fibers = await realm.mountNativeToolModules(
        [{ module, toolBindingIdentity: 'dsh.fs/read' }],
        { scope: agentKey },
      )
      void url
    } else {
      out.fibers = await row.attachA5sfNativeToolModules(realm, agentCtx, a5sfConfig, agentKey)
    }
    out.mounted = true
    out.surfaceAfterMount = surfaceNames(root, agentKey)
    out.definitions = new Map(out.surfaceAfterMount.map((name) => [name, root.get('tools').get(name, agentKey)]))
    try { await realm.whenNativeVerificationSettled() } catch (error) { out.verificationError = String(error?.message ?? error) }
    out.nativeInvalidation = realm.nativeInvalidation
    await body?.({ realm, root, agentKey, out })
    out.nativeInvalidation = realm.nativeInvalidation
  } catch (error) {
    out.mounted = false
    out.error = {
      name: String(error?.name ?? ''),
      code: String(error?.code ?? ''),
      detail: String(error?.detail ?? ''),
      message: String(error?.message ?? error),
    }
  } finally {
    out.elapsedMs = Date.now() - started
    out.surfaceAtEnd = surfaceNames(root, agentKey)
    try { await realm?.dispose?.() } catch (disposeError) { out.disposeError = String(disposeError?.message ?? disposeError) }
  }
  log(`${label}: mounted=${String(out.mounted)} elapsedMs=${String(out.elapsedMs)} `
    + `${out.mounted ? `surface=${JSON.stringify(out.surfaceAfterMount)}` : JSON.stringify(out.error).slice(0, 700)}`)
  return out
}

/** Minimal assertion ledger: every arm records PASS/FAIL with the observed values. */
const results = []
/** JSON-safe projection: Fiber/Context objects cannot be serialized (their
 *  proxies throw on unknown properties), so the recorded observation is the
 *  measured facts, not the object graph. */
function summarize(armResult) {
  const identities = {}
  for (const name of armResult.surfaceAfterMount ?? []) {
    identities[name] = armResult.definitions?.get(name) === armResult.presetDefinitions?.get(name) ? 'preset' : 'routed'
  }
  return {
    label: armResult.label,
    attachmentsService: armResult.attachmentsService,
    withBinding: armResult.withBinding,
    mounted: armResult.mounted,
    elapsedMs: armResult.elapsedMs,
    presetSurface: armResult.presetSurface,
    surfaceAfterMount: armResult.surfaceAfterMount,
    surfaceAtEnd: armResult.surfaceAtEnd,
    definitionIdentities: identities,
    fiberCount: Array.isArray(armResult.fibers) ? armResult.fibers.length : 0,
    nativeInvalidation: armResult.nativeInvalidation ?? null,
    postDispose: armResult.postDispose ?? null,
    error: armResult.error ?? null,
    verificationError: armResult.verificationError ?? null,
  }
}
function assertArm(armResult, checks) {
  const failures = []
  for (const [name, fn] of Object.entries(checks)) {
    try {
      const verdict = fn(armResult)
      if (verdict !== true) failures.push(`${name}: ${String(verdict)}`)
    } catch (error) {
      failures.push(`${name}: thrown ${String(error?.message ?? error)}`)
    }
  }
  const record = { arm: armResult.label, verdict: failures.length === 0 ? 'PASS' : 'FAIL', failures, observed: summarize(armResult) }
  results.push(record)
  log(`${armResult.label}: ${record.verdict}${failures.length === 0 ? '' : ` — ${failures.join('; ')}`}`)
  return record
}

const result = { schema: 'a5sf-deferred/probe-deferred-settle/1', at: new Date().toISOString(), hostToolFs: HOST_TOOL_FS, arms: [] }
try {
  // ── A1: routed mount + resolvable attachments + pinned tool-fs → MOUNT ────
  const a1 = await arm('A1-accept-routed-read', {
    attachments: true,
    presetNames: ['read', 'read_image', 'write', 'edit'],
    nativeModules: [],
  })
  result.arms.push(assertArm(a1, {
    mounted: (r) => r.mounted === true || `attach refused: ${JSON.stringify(r.error ?? null)}`,
    'surface unchanged': (r) => JSON.stringify(r.surfaceAfterMount) === JSON.stringify(r.presetSurface)
      || `preset=${JSON.stringify(r.presetSurface)} after=${JSON.stringify(r.surfaceAfterMount)}`,
    'read routed (definition identity)': (r) => r.definitions?.get('read') !== r.presetDefinitions?.get('read'),
    'write routes routed': (r) => r.definitions?.get('write') !== r.presetDefinitions?.get('write'),
    'edit routes routed': (r) => r.definitions?.get('edit') !== r.presetDefinitions?.get('edit'),
    'deferred read_image routed (not the preset object)': (r) => r.definitions?.get('read_image') !== r.presetDefinitions?.get('read_image'),
    'one read on the surface': (r) => (r.surfaceAfterMount ?? []).filter((n) => n === 'read').length === 1,
    'no invalidation at rest': (r) => (r.nativeInvalidation ?? null) === null,
  }))

  // ── A6: the OPTIONAL-dependency control — `attachments` absent → the child
  //        never runs (benign), and the mount still succeeds on the names it has.
  const a6 = await arm('A6-absent-attachments-mounts', {
    attachments: false,
    presetNames: ['read', 'write', 'edit'],
    nativeModules: [],
  })
  result.arms.push(assertArm(a6, {
    mounted: (r) => r.mounted === true || `the benign absent-optional case was refused: ${JSON.stringify(r.error ?? null)}`,
    'surface unchanged': (r) => JSON.stringify(r.surfaceAfterMount) === JSON.stringify(r.presetSurface),
    'read routed': (r) => r.definitions?.get('read') !== r.presetDefinitions?.get('read'),
    'no read_image invented': (r) => (r.surfaceAfterMount ?? []).includes('read_image') === false,
  }))

  // ── A2: a deferred registration landing an UNCOVERED name → REFUSED ──────
  const a2 = await arm('A2-uncovered-deferred-refused', {
    attachments: true,
    presetNames: ['read', 'read_image', 'write', 'edit'],
    withBinding: true,
    nativeModules: [UNCOVERED_DEFERRED_URL],
    bindingOnlyMount: true,
  })
  result.arms.push(assertArm(a2, {
    'attach refused': (r) => r.mounted === false || 'the attach accepted an uncovered deferred registration',
    'typed SERVICE_MOUNT_FAILED': (r) => r.error?.code === 'SERVICE_MOUNT_FAILED' || `got ${JSON.stringify(r.error ?? null)}`,
    'reason NAMES the uncovered name': (r) => /UNCOVERED/.test(r.error?.detail ?? '') && /x_a5sf_uncovered/.test(r.error?.detail ?? '')
      || `detail did not name the uncovered name: ${r.error?.detail ?? ''}`,
    'surface restored (no half shadow)': (r) => JSON.stringify(r.surfaceAtEnd) === JSON.stringify(r.presetSurface)
      || `preset=${JSON.stringify(r.presetSurface)} after=${JSON.stringify(r.surfaceAtEnd)}`,
  }))

  // ── A3: a deferred child that ends FAILED → REFUSED, typed ───────────────
  const a3 = await arm('A3-failed-deferred-refused', {
    attachments: true,
    presetNames: ['read', 'write', 'edit'],
    nativeModules: [FAILED_DEFERRED_URL],
  })
  result.arms.push(assertArm(a3, {
    'attach refused': (r) => r.mounted === false || 'the attach accepted a FAILED deferred child',
    'typed SERVICE_MOUNT_FAILED': (r) => r.error?.code === 'SERVICE_MOUNT_FAILED' || `got ${JSON.stringify(r.error ?? null)}`,
    'reason says the deferred registration FAILED': (r) => /deferred registration failed/.test(r.error?.detail ?? '')
      || `detail: ${r.error?.detail ?? ''}`,
    'surface restored': (r) => JSON.stringify(r.surfaceAtEnd) === JSON.stringify(r.presetSurface),
  }))

  // ── A4: a deferred child that never settles → REFUSED, no hang ───────────
  const a4 = await arm('A4-unsettled-deferred-refused', {
    attachments: true,
    presetNames: ['read', 'write', 'edit'],
    nativeModules: [UNSETTLED_DEFERRED_URL],
  })
  result.arms.push(assertArm(a4, {
    'attach refused (not accepted)': (r) => r.mounted === false || 'the attach accepted a never-settling deferred child',
    'typed SERVICE_MOUNT_FAILED': (r) => r.error?.code === 'SERVICE_MOUNT_FAILED' || `got ${JSON.stringify(r.error ?? null)}`,
    'reason says it did not settle': (r) => /did not settle/.test(r.error?.detail ?? '') || `detail: ${r.error?.detail ?? ''}`,
    'bounded (did not hang)': (r) => r.elapsedMs < 5000 || `elapsed ${String(r.elapsedMs)}ms`,
    'surface restored': (r) => JSON.stringify(r.surfaceAtEnd) === JSON.stringify(r.presetSurface),
  }))

  // ── A5: acceptance keeps the P0 invalidation path real ───────────────────
  const a5 = await arm('A5-accepted-shadow-invalidates', {
    attachments: true,
    presetNames: ['read', 'read_image', 'write', 'edit'],
    nativeModules: [],
  }, async ({ realm, root, agentKey, out }) => {
    // An EXTERNAL holder of the returned fibers disposes them: exactly the
    // "shadow is gone" shape the P0 verifier must record (not silently accept).
    for (const fiber of out.fibers ?? []) await fiber?.dispose?.()
    for (let i = 0; i < 40 && (realm.nativeInvalidation ?? null) === null; i += 1) {
      await new Promise((resolve) => setTimeout(resolve, 5))
    }
    out.postDispose = {
      readStillRouted: root.get('tools').get('read', agentKey) !== out.presetDefinitions.get('read'),
      surface: surfaceNames(root, agentKey),
      invalidation: realm.nativeInvalidation ?? null,
    }
  })
  result.arms.push(assertArm(a5, {
    mounted: (r) => r.mounted === true || `attach refused: ${JSON.stringify(r.error ?? null)}`,
    'shadow invalidated after external disposal': (r) => (r.nativeInvalidation ?? null) !== null,
    'invalidation names the lost shadow': (r) => (r.nativeInvalidation?.uncovered ?? []).length > 0,
    'preset surface restored after invalidation': (r) => JSON.stringify(r.surfaceAtEnd) === JSON.stringify(r.presetSurface),
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
