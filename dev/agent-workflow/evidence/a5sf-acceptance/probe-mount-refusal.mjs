#!/usr/bin/env node
/**
 * probe-mount-refusal.mjs — HOST-FREE reproduction of the ONE-alive-boot's
 * `SERVICE_MOUNT_FAILED` refusal (rows 1-6 NOT_REACHED).
 *
 * WHY THIS EXISTS. The boot at 2026-11-03T22:53:55Z reached `team.create` and
 * then died at MEMBER ACTIVATION, not at any of the six rows:
 *
 *   team_delegate -> {status:"rejected", code:"TEAM_RUNTIME_DURABLE_WRITE_FAILED",
 *     message:"activation: child-session creation failed for member
 *     'inst-0b366g81a5yc': TeamServiceInstallError: SERVICE_MOUNT_FAILED:
 *     native tool module null registers asynchronously and its deferred
 *     registration cannot run inside the routed mount (deferred …"}
 *
 * The driver had already persisted its transcript with the result text clipped
 * at 320 characters (a capture defect, disclosed in the README), so the live
 * run cannot tell WHICH deferred dependency was unsettled. This probe answers
 * that host-free — ZERO boots, ZERO ports, no DSH_HOME, no pristine host tree
 * written — by mounting the REAL pinned `@deepseek-ai/dsh-tool-fs` module
 * through the SAME product entry point the live glue uses
 * (`mountMemberA5sfRealm` + `attachA5sfNativeToolModules`), with and without an
 * `attachments` service in the composition.
 *
 * WHAT IT IS: a measurement receipt for the refusal's CAUSE, reproducible on
 * any machine. WHAT IT IS NOT: a sixth-row verdict — the rows were never
 * reached; and it is not the live Host's own log line (the live detail text was
 * lost to the capture clip; this probe reproduces the refusal shape at the same
 * HEAD).
 *
 * Run: node probe-mount-refusal.mjs
 */
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire, register } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = join(HERE, '..', '..', '..', '..')
const OUT = join(HERE, 'mount-refusal-probe.json')
const LOG = join(HERE, 'mount-refusal-probe.log')

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

/**
 * Resolve the runtime peers (`@deepseek-ai/cordis` + the real tool runtime).
 * A WORKTREE may carry no `node_modules` of its own (pnpm installs per
 * checkout), so try the worktree, the main checkout, then the pinned host
 * tree — the first base that resolves ALL FOUR wins, and the choice is logged.
 */
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

const IDENTITY = Object.freeze({ teamId: 'team-acceptance-probe', memberInstanceId: 'member-probe-a', templateId: 'worker', instanceGeneration: 1 })
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
 * ONE arm: mount the REAL pinned tool-fs through the product entry points and
 * report the outcome verbatim (no interpretation).
 */
async function arm(label, { attachments, presetNames }) {
  const dir = trackedDir(`a5sf-probe-${label}-`)
  const inside = join(dir, 'inside')
  mkdirSync(inside, { recursive: true })
  writeFileSync(join(inside, 'ok.txt'), 'ok\n')
  const sinkPath = join(dir, 'consult.jsonl')
  const root = await makeRoot({ attachments })
  const { standing, agentCtx } = presetTopology(root)
  await standing.ctx.plugin(presetRowPlugin(presetNames))
  const toolFs = await import(HOST_TOOL_FS)
  // The row's loader applies the module's Config schema; the host-free probe
  // applies the SAME schema itself (the module's own exported `Config`).
  const moduleConfig = typeof toolFs.Config?.parse === 'function' ? toolFs.Config.parse({}) : {}
  const a5sfConfig = row.a5sfRealmConfigOf({
    a5sfEvidencePath: sinkPath,
    a5sfNativeToolModules: [{ url: HOST_TOOL_FS, config: moduleConfig }],
  })
  const provider = () => ({
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
  const out = { label, attachmentsService: attachments, moduleInject: toolFs.inject, moduleName: toolFs.name, mounted: false }
  let realm
  try {
    realm = await row.mountMemberA5sfRealm({
      root: agentCtx,
      a5sfConfig,
      provider,
      member: { sessionId: 'session-probe', instanceId: IDENTITY.memberInstanceId, teamRootSessionId: 'team-root', templateId: IDENTITY.templateId },
    })
    await row.attachA5sfNativeToolModules(realm, agentCtx, a5sfConfig)
    out.mounted = true
    out.surfaceAfterMount = root.tools.schemas(undefined).map((schema) => schema?.name ?? schema)
  } catch (error) {
    out.mounted = false
    out.error = {
      name: String(error?.name ?? ''),
      code: String(error?.code ?? ''),
      detail: String(error?.detail ?? ''),
      message: String(error?.message ?? error),
      stackHead: String(error?.stack ?? '').split('\n').slice(0, 6).join('\n'),
    }
  } finally {
    try { await realm?.dispose?.() } catch (disposeError) { out.disposeError = String(disposeError?.message ?? disposeError) }
  }
  log(`${label}: attachments=${String(attachments)} mounted=${String(out.mounted)} ${out.mounted ? '' : JSON.stringify(out.error).slice(0, 900)}`)
  return out
}

/** Arm C: the SAME module mounted DIRECTLY on the agent ctx (no router), which
 *  is the composition the preset itself uses. If this succeeds, the router is
 *  what the deferred `attachments` child cannot survive; if it also fails, the
 *  module's `read_image` registration is the failing step. */
async function directArm() {
  const dir = trackedDir('a5sf-probe-direct-')
  const inside = join(dir, 'inside')
  mkdirSync(inside, { recursive: true })
  writeFileSync(join(inside, 'ok.txt'), 'ok\n')
  const root = await makeRoot({ attachments: true })
  const { standing, agentCtx } = presetTopology(root)
  await standing.ctx.plugin(presetRowPlugin(['read', 'read_image', 'write', 'edit']))
  const toolFs = await import(HOST_TOOL_FS)
  // The module's own `Config` defaults are applied by the LIVE loader, not by a
  // bare `Config.parse({})` in a unit root, so the direct arm passes the four
  // documented positive integers explicitly (registration only; no execution).
  const moduleConfig = { readLimit: 2000, readMaxLineLength: 2000, readMaxBytes: 1048576, readStreamMinSize: 65536 }
  const out = { label: 'C-direct-plugin-mount', attachmentsService: true }
  try {
    const fiber = await agentCtx.plugin({ name: 'probe-direct-tool-fs', inject: toolFs.inject, apply: (ctx) => toolFs.apply(ctx, moduleConfig) })
    out.mounted = true
    out.surface = root.tools.schemas(agentCtx === undefined ? undefined : undefined).map((schema) => schema?.name ?? schema)
    await fiber?.dispose?.()
  } catch (error) {
    out.mounted = false
    out.error = { name: String(error?.name ?? ''), message: String(error?.message ?? error), stackHead: String(error?.stack ?? '').split('\n').slice(0, 5).join('\n') }
  }
  log(`${out.label}: mounted=${String(out.mounted)} ${out.mounted ? JSON.stringify(out.surface) : JSON.stringify(out.error).slice(0, 700)}`)
  return out
}

const result = { schema: 'a5sf-acceptance/mount-refusal-probe/1', at: new Date().toISOString(), hostToolFs: HOST_TOOL_FS, arms: [] }
try {
  result.arms.push(await arm('B-with-attachments', { attachments: true, presetNames: ['read', 'read_image', 'write', 'edit'] }))
  result.arms.push(await arm('A-without-attachments', { attachments: false, presetNames: ['read', 'write', 'edit'] }))
  result.arms.push(await directArm())
} finally {
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true })
}
writeFileSync(OUT, JSON.stringify(result, null, 2) + '\n')
writeFileSync(LOG, LOG_LINES.join('\n') + '\n')
log(`wrote ${OUT}`)
