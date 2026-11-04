#!/usr/bin/env node
/**
 * probe-mount-compat.mjs — HOST-FREE mount-compatibility measurement for the
 * six-row acceptance World, after #576/#578 changed the routed-mount seam.
 *
 * WHY THIS EXISTS. The #575 boot never reached a single row because MEMBER
 * ACTIVATION was refused:
 *
 *   SERVICE_MOUNT_FAILED: native tool module null registers asynchronously and
 *   its deferred registration cannot run inside the routed mount (deferred …)
 *
 * #575 proved, host-free, that the refusal was the intersection of (a) the
 * ROUTED mount and (b) a RESOLVABLE `attachments` service: the pinned
 * `@deepseek-ai/dsh-tool-fs` always declares `ctx.inject(['attachments'], …)`
 * for `read_image`, and #561's settle rule counted that child as unsettled
 * whenever the service existed. #576 replaced the reachability rule with an
 * outcome rule (+ the router-services merge into the deferred child's inject);
 * #578 narrowed the event-driven shape. THIS probe re-measures that exact
 * intersection at the CURRENT HEAD, with the real pinned module and a real
 * `attachments` provider, and adds the IDENTITY arm (`expectedTools`): a mount
 * that "succeeds" while forwarding nothing is refused by the product, so
 * "mounted" here means "mounted AND every declared native name is shadowed by
 * the module's own definition".
 *
 * ZERO BOOTS: no Host, no port, no DSH_HOME, no pristine-tree writes. The
 * `dshHome` the real attachment store receives is an OS temp directory that is
 * removed at the end.
 *
 * ARMS (the discriminating matrix):
 *
 *   A  real attachment-local   + routed mount + expectedTools  -> MOUNTED, 4/4
 *   B  stub attachments        + routed mount + expectedTools  -> MOUNTED, 4/4
 *   C  NO attachments          + routed mount + expectedTools  -> REFUSED
 *      (A5SF_EXPECTED_TOOLS_UNSHADOWED, naming read_image) — proves the
 *      declaration is not vacuous and that an absent attachments provider would
 *      be a genuine preflight blocker, not something to paper over
 *   D  NO attachments          + routed mount, UNDECLARED     -> MOUNTED, 3/4
 *      (the pending `attachments` child is benign and registers nothing)
 *
 * Run: node dev/agent-workflow/evidence/a5sf-preflight/probe-mount-compat.mjs
 *
 * @module dev/agent-workflow/evidence/a5sf-preflight/probe-mount-compat
 */
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire, register } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = join(HERE, '..', '..', '..', '..')
const OUT = join(HERE, 'mount-compat.json')
const LOG = join(HERE, 'mount-compat.log')
const EXPECTED_TOOLS = Object.freeze(['read', 'write', 'edit', 'read_image'])

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
const HOST_ATTACHMENT_LOCAL = pathToFileURL(join(HOST_TREE, 'packages', 'attachment', 'attachment-local', 'lib', 'index.js')).href

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
    tried.push({ base, ok: false, missing: Object.entries(resolved).filter(([, value]) => value === null).map(([key]) => key) })
  }
  throw new Error(`cannot resolve the runtime peers from any base: ${JSON.stringify(tried)}`)
}
const runtime = pickRuntimeRequire()
const { Context, Service } = await import(pathToFileURL(runtime.resolved['@deepseek-ai/cordis']).href)
const ToolRuntime = (await import(pathToFileURL(runtime.resolved['@deepseek-ai/dsh-tools']).href)).default
const SystemPrompt = (await import(pathToFileURL(runtime.resolved['@deepseek-ai/dsh-system-prompt']).href)).default
const { createScope, bindScopeParent } = await import(pathToFileURL(runtime.resolved['@deepseek-ai/dsh-scope']).href)

const IDENTITY = Object.freeze({ teamId: 'team-a5sf-preflight', memberInstanceId: 'member-preflight-a', templateId: 'worker', instanceGeneration: 1 })
const lane = (allow) => Object.freeze({ mode: 'restricted', allow: Object.freeze([...allow]), ask: Object.freeze([]), deny: Object.freeze([]) })

const dirs = []
function trackedDir(prefix) {
  const dir = mkdtempSync(join(tmpdir(), prefix))
  dirs.push(dir)
  return dir
}

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

/** The minimal `attachments` service shape the pinned tool-fs injects. */
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
          output: { schema: { type: 'string' }, render: (_args, value) => [{ type: 'text', text: String(value) }] },
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
  if (attachments === 'real') {
    const attachmentLocal = await import(HOST_ATTACHMENT_LOCAL)
    const Config = attachmentLocal.default?.Config ?? attachmentLocal.Config
    const config = typeof Config?.parse === 'function' ? Config.parse({ dshHome: trackedDir('a5sf-attach-home-') }) : { dshHome: trackedDir('a5sf-attach-home-') }
    await root.plugin(attachmentLocal.default, config)
    log(`real attachment-local mounted from ${HOST_ATTACHMENT_LOCAL}`)
  } else if (attachments === 'stub') {
    await root.plugin(TestAttachments)
  }
  return root
}

/** A compiled ceiling + one ToolBinding realm for `dsh.fs/read`, the same
 *  two-factor composition the six-row World's provider row supplies. */
function compiledFor() {
  const inside = lane([IDENTITY.workspace ?? '/tmp'])
  const policy = Object.freeze({
    memberIdentity: IDENTITY.memberInstanceId,
    templateId: IDENTITY.templateId,
    instanceGeneration: IDENTITY.instanceGeneration,
    revision: `a5sf-preflight:${IDENTITY.memberInstanceId}:g1`,
    read: inside,
    write: inside,
    network: Object.freeze({ access: 'allow' }),
  })
  const effective = Object.freeze({
    memberIdentity: IDENTITY.memberInstanceId,
    toolBindingIdentity: 'dsh.fs/read',
    invocationId: `a5sf-preflight:${IDENTITY.memberInstanceId}:dsh.fs/read`,
    policyRevision: policy.revision,
    read: inside,
    write: inside,
    network: Object.freeze({ access: 'allow' }),
  })
  return {
    members: [{ identity: IDENTITY, policy: { ok: true, value: policy } }],
    bindings: [{ identity: IDENTITY, toolBindingIdentity: 'dsh.fs/read', effective }],
  }
}

function routingOf(fibers) {
  return fibers.map((fiber) => {
    const metadata = fiber?.['a5sfRegistrationRouting'] ?? null
    return metadata === null
      ? null
      : {
          realm: metadata.realm ?? null,
          toolBindingIdentity: metadata.toolBindingIdentity ?? null,
          forwarded: [...(metadata.forwarded ?? [])],
          observed: [...(metadata.observed ?? [])],
          dropped: [...(metadata.dropped ?? [])],
        }
  })
}

/**
 * ONE arm: mount the REAL pinned tool-fs through the product entry points and
 * report the outcome verbatim, plus the identity measurement.
 */
async function arm(label, { attachments, expectedTools, presetNames }) {
  const dir = trackedDir(`a5sf-compat-${label}-`)
  const inside = join(dir, 'inside')
  mkdirSync(inside, { recursive: true })
  writeFileSync(join(inside, 'ok.txt'), 'ok\n')
  const sinkPath = join(dir, 'consult.jsonl')
  const root = await makeRoot({ attachments })
  const { standing, agentCtx } = presetTopology(root)
  await standing.ctx.plugin(presetRowPlugin(presetNames))
  const toolFs = await import(HOST_TOOL_FS)
  const moduleConfig = typeof toolFs.Config?.parse === 'function' ? toolFs.Config.parse({}) : {}
  const a5sfConfig = row.a5sfRealmConfigOf({
    a5sfEvidencePath: sinkPath,
    a5sfNativeToolModules: [{ url: HOST_TOOL_FS, config: moduleConfig }],
    ...(expectedTools === undefined ? {} : { a5sfExpectedTools: { [HOST_TOOL_FS]: [...expectedTools] } }),
  })
  const provider = () => ({ compiledFor: () => compiledFor() })
  const out = {
    label,
    attachments: attachments ?? 'none',
    expectedTools: expectedTools ?? null,
    moduleInject: toolFs.inject,
    mounted: false,
  }
  let realm
  try {
    realm = await row.mountMemberA5sfRealm({
      root: agentCtx,
      a5sfConfig,
      provider,
      member: { sessionId: 'session-probe', instanceId: IDENTITY.memberInstanceId, teamRootSessionId: 'team-root', templateId: IDENTITY.templateId },
    })
    const fibers = await row.attachA5sfNativeToolModules(realm, agentCtx, a5sfConfig)
    out.mounted = true
    const mountedFibers = flatten(fibers)
    out.routing = routingOf(mountedFibers)
    out.forwardedUnion = [...new Set(out.routing.flatMap((entry) => entry?.forwarded ?? []))].sort()
    out.observedUnion = [...new Set(out.routing.flatMap((entry) => entry?.observed ?? []))].sort()
    out.surface = [...row.a5sfAgentToolSurface(agentCtx)].sort()
    out.declaredEveryForwarded = (expectedTools ?? []).every((name) => out.forwardedUnion.includes(name))
    out.realmSurface = {
      bindingIdentities: (realm.bindings ?? []).map((binding) => binding.toolBindingIdentity ?? null),
      nativeInvalidation: realm.nativeInvalidation ?? null,
    }
  } catch (error) {
    out.mounted = false
    out.error = {
      name: String(error?.name ?? ''),
      code: String(error?.code ?? ''),
      detail: String(error?.detail ?? ''),
      message: String(error?.message ?? error),
      stackHead: String(error?.stack ?? '').split('\n').slice(0, 8).join('\n'),
    }
  } finally {
    try { await realm?.dispose?.() } catch (disposeError) { out.disposeError = String(disposeError?.message ?? disposeError) }
  }
  log(`${label}: attachments=${String(out.attachments)} mounted=${String(out.mounted)} `
    + (out.mounted
      ? `forwarded=${JSON.stringify(out.forwardedUnion)} surface=${JSON.stringify(out.surface)} declaredAllForwarded=${String(out.declaredEveryForwarded)}`
      : `code=${String(out.error?.code)} message=${String(out.error?.message).slice(0, 300)}`))
  return out
}

function flatten(fibers) {
  if (Array.isArray(fibers)) return fibers.flatMap((entry) => flatten(entry))
  return fibers === undefined || fibers === null ? [] : [fibers]
}

const result = {
  schema: 'a5sf-acceptance-preflight/mount-compat/1',
  at: new Date().toISOString(),
  head: process.env.A5SF_PROBE_HEAD ?? null,
  hostToolFs: HOST_TOOL_FS,
  hostAttachmentLocal: HOST_ATTACHMENT_LOCAL,
  expectedTools: EXPECTED_TOOLS,
  note: 'HOST-FREE: no Host process, no port, no DSH_HOME. The real attachment store receives an OS temp dir as dshHome, deleted with the arm.',
  arms: [],
}
try {
  result.arms.push(await arm('A-real-attachment-store', { attachments: 'real', expectedTools: EXPECTED_TOOLS, presetNames: ['read', 'read_image', 'write', 'edit'] }))
  result.arms.push(await arm('B-stub-attachments', { attachments: 'stub', expectedTools: EXPECTED_TOOLS, presetNames: ['read', 'read_image', 'write', 'edit'] }))
  result.arms.push(await arm('C-no-attachments-declared', { attachments: 'none', expectedTools: EXPECTED_TOOLS, presetNames: ['read', 'write', 'edit'] }))
  result.arms.push(await arm('D-no-attachments-undeclared', { attachments: 'none', presetNames: ['read', 'write', 'edit'] }))
} finally {
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true })
}
writeFileSync(OUT, JSON.stringify(result, null, 2) + '\n')
writeFileSync(LOG, LOG_LINES.join('\n') + '\n')
const mountedWithAttachments = result.arms.filter((entry) => entry.attachments !== 'none').every((entry) => entry.mounted === true)
const identityHeld = result.arms.filter((entry) => entry.mounted === true).every((entry) => entry.declaredEveryForwarded === true && entry.forwardedUnion.includes('read'))
log(`wrote ${OUT}; mountedWithAttachments=${String(mountedWithAttachments)} identityHeld=${String(identityHeld)}`)
process.exitCode = mountedWithAttachments && identityHeld ? 0 : 1
