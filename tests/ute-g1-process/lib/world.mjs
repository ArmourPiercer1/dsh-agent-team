/**
 * world.mjs — the PROCESS family's old-path world: the PRODUCT route-C
 * composition, host-free, driving the REAL pinned host `bash` row on the
 * standing scope and the route-C `bash` shadow over the Member's confined
 * `subprocess` face.
 *
 * WHAT IS REAL HERE (and why each piece has to be):
 *
 *   preset row      the PINNED baseline host's own `@deepseek-ai/dsh-tool-bash`
 *                   module, mounted on the standing (preset) scope exactly as
 *                   the shipped `a5sf-governed-member` preset mounts it
 *                   (`cordis.patch.yml`: `- id: tool-bash, name:
 *                   '@deepseek-ai/dsh-tool-bash'`). It is the definition the
 *                   model would resolve un-shadowed, and it is the definition
 *                   the route-C attach must REPLACE. Its `shell` service is the
 *                   pinned host's own `LocalBashExecutor` (a real child process
 *                   spawn), so the un-shadowed arm is a real, unconfined shell.
 *   governance      the PRODUCT seam: `mountMemberA5sfRealm` +
 *                   `attachA5sfNativeToolModules`
 *                   (`packages/runtime/src/plugin/live/a5sf-realm-row.mjs`).
 *                   The realm mounts the confined `subprocess` face; the attach
 *                   appends `confined-bash-tool.mjs` (PD-12), which registers the
 *                   SAME `bash` name on the Member's isolated scope so its
 *                   `ctx.subprocess` is the CONFINED face.
 *   backend         the PRODUCT's real `createConfinedProcessProvider` (the
 *                   Landlock launcher). A counting shim records every
 *                   `SpawnRequest` and forwards the real result untouched, so
 *                   "the confined face was/was not reached" is a measurement.
 *   base service    the pinned host's `LocalBashExecutor` is the unconfined
 *                   path the preset row would use if the route-C shadow were
 *                   absent. It is the REAL host service, wrapped in a counting
 *                   subclass so "the inherited shell was never reached" is a
 *                   measurement rather than a claim.
 *
 * NO BOOT, no port, no DSH_HOME. A real child process IS created by the
 * admitted arms (through the real Landlock launcher) — a process, not a Host.
 *
 * @module tests/ute-g1-process/lib/world
 */
import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire, register } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
/** This suite's repo root (tests/ute-g1-process/lib -> repo root). */
export const REPO_ROOT = join(HERE, '..', '..', '..')
/** The PINNED legacy host tree (tests/deepseek-harness-test-use). */
export const HOST_ROOT = join(REPO_ROOT, 'tests', 'deepseek-harness-test-use')

/** The repo's EXISTING TypeScript-under-plain-node hooks (no new loader). */
let registered = false
function hooksRegistered() {
  if (registered) return
  register(pathToFileURL(join(REPO_ROOT, 'scripts', 'run-tests-hooks.mjs')).href)
  registered = true
}

/** The Member identity every vector runs under (one world per vector). */
export const PROCESS_IDENTITY = Object.freeze({
  teamId: 'team-ute3-process-b1',
  memberInstanceId: 'member-ute3-process-b1',
  templateId: 'worker',
  instanceGeneration: 1,
})
export const PROCESS_REVISION = 'rev-ute3-process-b1'

/** The shell program both the preset page and the confined face declare. */
export const SHELL_PROGRAM = '/bin/bash'
/** The confined `subprocess` face's declared shell class (install-spec law). */
export const SHELL_CLASS = Object.freeze({ programs: Object.freeze(['bash']) })

const LAUNCHER = join(REPO_ROOT, 'packages/runtime/sandbox-provider/launcher/landlock-prelauncher.py')
const LAUNCHER_SHA = createHash('sha256').update(readFileSync(LAUNCHER)).digest('hex')

let seamsPromise
/** Load the repo seams + the pinned host modules ONCE per process. */
export function loadProcessSeams() {
  seamsPromise ??= (async () => {
    hooksRegistered()
    const row = await import(pathToFileURL(join(REPO_ROOT, 'packages', 'runtime', 'src', 'plugin', 'live', 'a5sf-realm-row.mjs')).href)
    const runtimeRequire = createRequire(join(REPO_ROOT, 'packages', 'runtime', 'package.json'))
    const { Context, Service } = await import(pathToFileURL(runtimeRequire.resolve('@deepseek-ai/cordis')).href)
    const ToolRuntime = (await import(pathToFileURL(runtimeRequire.resolve('@deepseek-ai/dsh-tools')).href)).default
    const SystemPrompt = (await import(pathToFileURL(runtimeRequire.resolve('@deepseek-ai/dsh-system-prompt')).href)).default
    const { createScope, bindScopeParent } = await import(pathToFileURL(runtimeRequire.resolve('@deepseek-ai/dsh-scope')).href)
    const { compileEffectiveIo } = await import(pathToFileURL(join(REPO_ROOT, 'packages', 'runtime', 'member-io-policy', 'src', 'index.ts')).href)
    const { createConfinedProcessProvider } = await import(pathToFileURL(join(REPO_ROOT, 'packages', 'runtime', 'sandbox-provider', 'index.ts')).href)
    const { readGuardConsultFile } = await import(pathToFileURL(join(REPO_ROOT, 'packages', 'runtime', 'team-services', 'src', 'guard-observability.ts')).href)
    // The pinned host's own modules, imported from the PINNED HOST TREE (the
    // same absolute-path discipline tests/world-factory uses for
    // `tool-bash-persistent`): the host's `bash` row, its local shell executor,
    // and the shell environment registry the row injects.
    const hostModule = async (rel) => import(pathToFileURL(join(HOST_ROOT, 'packages', ...rel.split('/'), 'lib', 'index.js')).href)
    const toolBash = await hostModule('shell/tool-bash')
    const shellEnv = await hostModule('shell/shell-env')
    const bashLocal = await hostModule('shell/bash-local')
    return Object.freeze({ row, Context, Service, ToolRuntime, SystemPrompt, createScope, bindScopeParent, compileEffectiveIo, createConfinedProcessProvider, readGuardConsultFile, toolBash, shellEnv, bashLocal })
  })()
  return seamsPromise
}

/** One lane axis in the A1 policy/compiled shape. */
export function lane(allow, { ask = [], deny = [] } = {}) {
  return Object.freeze({ mode: 'restricted', allow: Object.freeze([...allow]), ask: Object.freeze([...ask]), deny: Object.freeze([...deny]) })
}

/**
 * The base unconfined `fs` service: a minimal REAL node:fs provider. The
 * process rows do not consume it; the realm needs a base `fs` to install its
 * managed FS provider over, and the install refuses a provider missing the
 * declared method surface rather than degrading to a raw Node fallback.
 */
function baseFileSystemClass(Service) {
  return class BaseFileSystem extends Service {
    constructor(ctx, config = {}) {
      super(ctx, 'fs')
      this.config = config
    }
    processPath(target) { return target.hostPath }
    contains(parent, child) { return this.processPath(child).startsWith(this.processPath(parent)) }
    async resolve(path) { return { hostPath: path } }
    async readText(target) { return readFileSync(this.processPath(target), 'utf8') }
    async readBytes(target) { return readFileSync(this.processPath(target)) }
    async readByteRange(target) { return readFileSync(this.processPath(target)) }
    async streamText(target) {
      const text = await this.readText(target)
      return (async function* stream() { yield text })()
    }
    async listDir() { return [] }
    async stat() { return { type: 'file', size: 0, mtimeMs: 0, mode: 0o644 } }
    async lstat() { return { size: 0, mtimeMs: 0, mode: 0o644 } }
    async watch() { return () => undefined }
    async writeText(target, content) {
      const path = this.processPath(target)
      writeFileSync(path, String(content))
      return { path, version: 'v1' }
    }
    async editText(target, edit) {
      const path = this.processPath(target)
      writeFileSync(path, String(edit.newString))
      return { path, version: 'v2' }
    }
  }
}

/**
 * The host `LocalBashExecutor`, subclassed ONLY to count executions. Every
 * method is the pinned class's own (`resolve`/`execute`), so the unconfined
 * arm's behaviour is the host's, unmodified.
 */
function countingBashLocal(Base) {
  return class CountingBashLocal extends Base {
    static calls = 0
    async execute(spec) {
      CountingBashLocal.calls += 1
      return super.execute(spec)
    }
  }
}

/** A non-consuming reader over the bytes collected so far (the published shape). */
function readerOf(chunks) {
  return {
    readFrom(fromByte) {
      const all = Buffer.concat(chunks)
      const slice = all.subarray(Math.min(fromByte, all.length))
      return { text: slice.toString('utf8'), nextOffset: all.length, lossy: false }
    },
  }
}

/**
 * The base `subprocess` service: the UNCONFINED path a `subprocess`-consuming
 * module would resolve if the realm mounted no confined face. It is a REAL
 * spawn (the same shape the PD-16 suite uses), and it counts every call.
 */
function baseSubprocessClass(Service) {
  return class BaseSubprocess extends Service {
    static calls = 0
    constructor(ctx, config = {}) {
      super(ctx, 'subprocess')
      this.config = config
    }
    spawn(spec) {
      BaseSubprocess.calls += 1
      const child = spawn(spec.argv[0], spec.argv.slice(1), {
        cwd: String(spec.cwd),
        stdio: ['ignore', 'pipe', 'pipe'],
        env: process.env,
      })
      const stdout = []
      const stderr = []
      child.stdout.on('data', (chunk) => stdout.push(Buffer.from(chunk)))
      child.stderr.on('data', (chunk) => stderr.push(Buffer.from(chunk)))
      const done = new Promise((resolve) => {
        child.on('error', (error) => resolve({ exitCode: null, signal: 'SIGERROR', error }))
        child.on('close', (code, signal) => resolve({ exitCode: code, signal: signal ?? null }))
      })
      return {
        stdin: undefined,
        stdout: undefined,
        stderr: undefined,
        collected: { stdout: readerOf(stdout), stderr: readerOf(stderr) },
        done,
        terminate: () => { child.kill('SIGKILL') },
        waitForExit: async () => true,
      }
    }
  }
}

/** A counting shim over the REAL OS provider: the observed-provider-facts seam. */
function countingProvider(inner) {
  const calls = []
  return {
    calls,
    async spawnStreaming(request, streaming) {
      calls.push({
        argv: [...(request?.argv ?? [])],
        cwd: String(request?.cwd ?? ''),
        allowPaths: (request?.allowPaths ?? []).map((entry) => entry.path),
      })
      return inner.spawnStreaming(request, streaming)
    },
  }
}

/**
 * Is the Landlock `content-read` leg ENFORCED on this host? A shell that is
 * admitted must really run, so the arms that need the OS profile declare this;
 * a host that cannot enforce it refuses those arms (`PROCESS_KERNEL_UNENFORCED`),
 * never reports them green.
 * @returns {Promise<boolean>}
 */
export async function kernelEnforced() {
  const seams = await loadProcessSeams()
  const probe = seams.createConfinedProcessProvider({
    realmId: 'probe-ute3-process',
    trustRoot: `sha256:${LAUNCHER_SHA.slice(0, 16)}#${LAUNCHER}`,
    scratchRoot: join(REPO_ROOT, '.artifacts', 'tmp', 'ute-g1-process', `probe-${process.pid}`),
    assembly: { launcherPath: LAUNCHER, launcherSha256: LAUNCHER_SHA, minAbiVersion: 3 },
  })
  const probed = await probe.probe()
  return probed.ok === true
    && probed.value?.some((entry) => entry.dimension === 'content-read' && entry.level === 'enforced') === true
}

/**
 * Mount the PRODUCT route-C composition for one fixture.
 *
 * @param {object} input
 * @param {string} input.label - a stable, filesystem-safe world label.
 * @param {string} input.fixtureRoot - absolute world root (already populated).
 * @param {string} input.cwd - absolute agent session cwd (inside the read lane).
 * @param {readonly string[]} input.readRoots - absolute read-lane roots.
 * @param {readonly string[]} input.writeRoots - absolute write-lane roots.
 * @param {object} [input.overrides] - negative-control only:
 *   `dropBashShadow` (omit the confined bash shadow AFTER the attach, through
 *   the realm's own disposal), `faceEnv` (extra child env entries layered after
 *   the published scrub — the environment channel's positive arm).
 * @returns {Promise<object>} the world handle.
 */
export async function mountRouteCWorld({ label, fixtureRoot, cwd, readRoots, writeRoots = readRoots, overrides = {} }) {
  // A negative control may WIDEN the declared lane around one vector: the same
  // call then succeeds, which is how "the refusal was the lane's decision" is
  // proven instead of asserted. The golden capture never sets this.
  const laneExtra = Array.isArray(overrides.laneExtraRoots) ? overrides.laneExtraRoots : []
  readRoots = [...readRoots, ...laneExtra]
  writeRoots = [...writeRoots, ...laneExtra]
  const seams = await loadProcessSeams()
  const { row, Context, ToolRuntime, SystemPrompt, createScope, bindScopeParent, compileEffectiveIo, createConfinedProcessProvider, readGuardConsultFile, toolBash, shellEnv, bashLocal } = seams
  const BaseFileSystem = baseFileSystemClass(seams.Service)
  const BaseSubprocess = baseSubprocessClass(seams.Service)
  const CountingBash = countingBashLocal(bashLocal.default)

  const sinkPath = join(fixtureRoot, `.guard-${label}.jsonl`)
  const root = new Context()
  await root.plugin(SystemPrompt)
  await root.plugin(ToolRuntime)
  await root.plugin(BaseFileSystem, {})
  await root.plugin(BaseSubprocess, {})
  await root.plugin(shellEnv.default ?? shellEnv)
  await root.plugin(CountingBash, { cwd })

  // The PRESET topology the shipped governed Member row has: the host `bash`
  // row on the STANDING scope (that is the definition the model would resolve
  // un-shadowed, and the one the route-C attach replaces).
  const standingKey = {}
  const standing = createScope(root, standingKey)
  await standing.ctx.plugin(toolBash.default ?? toolBash, {})
  const agentKey = { id: `agent-${label}`, session: { header: { cwd } } }
  const agent = createScope(root, agentKey)
  bindScopeParent(agentKey, standingKey)

  const policyFor = (workspace) => Object.freeze({
    memberIdentity: PROCESS_IDENTITY.memberInstanceId,
    templateId: PROCESS_IDENTITY.templateId,
    instanceGeneration: PROCESS_IDENTITY.instanceGeneration,
    revision: PROCESS_REVISION,
    read: lane(readRoots),
    write: lane(writeRoots),
    network: Object.freeze({ access: 'allow' }),
  })
  // The ONE compiler: ceiling ∩ restriction (never re-derived here).
  const compiled = compileEffectiveIo(policyFor(cwd), {
    bindingIdentity: 'dsh.subprocess/exec',
    read: lane(readRoots),
    write: lane(writeRoots),
    network: 'allow',
  }, {
    memberIdentity: PROCESS_IDENTITY.memberInstanceId,
    callId: `call-${label}`,
    policyRevision: PROCESS_REVISION,
    toolBindingIdentity: 'dsh.subprocess/exec',
    approvedOnce: false,
  })
  assert.equal(compiled.ok, true, `compileEffectiveIo refused: ${JSON.stringify(compiled)}`)

  const osProvider = createConfinedProcessProvider({
    realmId: `realm-${label}`,
    trustRoot: `sha256:${LAUNCHER_SHA.slice(0, 16)}#${LAUNCHER}`,
    scratchRoot: join(fixtureRoot, '.scratch'),
    assembly: { launcherPath: LAUNCHER, launcherSha256: LAUNCHER_SHA, minAbiVersion: 3 },
  })
  const confined = countingProvider(osProvider)

  const mounted = await row.mountMemberA5sfRealm({
    root: agent.ctx,
    a5sfConfig: row.a5sfRealmConfigOf({ a5sfEvidencePath: sinkPath }),
    provider: () => ({
      compiledFor: () => ({
        members: [{ identity: PROCESS_IDENTITY, policy: { ok: true, value: policyFor(cwd) } }],
        providerClass: BaseFileSystem,
        subprocess: {
          effective: compiled.value,
          provider: confined,
          realmId: `realm-${label}`,
          bindingId: 'dsh.subprocess/exec',
          memberScope: PROCESS_IDENTITY.memberInstanceId,
          providerClass: BaseSubprocess,
          shellClass: SHELL_CLASS,
          ...(overrides.faceEnv === undefined ? {} : { env: overrides.faceEnv }),
        },
      }),
    }),
    member: {
      sessionId: `session-${label}`,
      instanceId: PROCESS_IDENTITY.memberInstanceId,
      teamRootSessionId: 'team-root-ute3-process',
      templateId: PROCESS_IDENTITY.templateId,
    },
  })
  assert.ok(mounted !== undefined, 'the configured row must mount a realm')

  const definitionBeforeAttach = root.tools.get('bash', agentKey)
  const fibers = await row.attachA5sfNativeToolModules(mounted, agent.ctx, row.a5sfRealmConfigOf({}))
  assert.ok(Array.isArray(fibers), 'the attach must answer the fibers it created')
  const definitionAfterAttach = root.tools.get('bash', agentKey)
  if (overrides.dropBashShadow === true) {
    assert.equal(typeof mounted.disposeNativeToolModules, 'function', 'the realm must expose the native-module disposal the control uses')
    await mounted.disposeNativeToolModules()
  }

  const baseCalls = () => CountingBash.calls

  /** Dispatch one tool call through the REAL registry (the model call path). */
  const dispatch = async (name, args, options = {}) => {
    const settled = await root.tools.execute({
      signal: options.signal ?? new AbortController().signal,
      callId: `ute3-process-${label}-${name}-${Math.random().toString(36).slice(2, 8)}`,
      name,
      arguments: args,
      agent: agentKey,
    })
    const text = Array.isArray(settled.content)
      ? settled.content.map((part) => (part?.type === 'text' ? part.text : '')).join('')
      : (typeof settled.content === 'string' ? settled.content : '')
    return { isError: settled.isError === true, text, value: settled.value, meta: settled.meta }
  }

  /** The realm's own guard-consult facts. The reader is ASYNC (the transport is
   *  a file), so the accessor answers a promise and every caller awaits it. */
  const facts = async () => (existsSync(sinkPath) ? readGuardConsultFile(sinkPath) : [])

  let disposed = false
  return Object.freeze({
    label,
    root,
    agentKey,
    fixtureRoot,
    cwd,
    sinkPath,
    confined,
    dispatch,
    facts,
    baseCalls,
    definitionBeforeAttach,
    definitionAfterAttach,
    shadowReplaced: definitionBeforeAttach !== undefined && definitionAfterAttach !== definitionBeforeAttach,
    providerCalls: () => [...confined.calls],
    async dispose() {
      if (disposed) return
      disposed = true
      await mounted.dispose()
    },
  })
}

/** Write a fixture file with plain node fs (the world's pre-state, not an effect). */
export function writeFixture(path, content) {
  writeFileSync(path, content)
}

/** The admitted shell's own version line (environment identity, never a row). */
export function shellIdentity() {
  const out = spawnSync(SHELL_PROGRAM, ['--version'], { encoding: 'utf8' })
  const first = String(out.stdout ?? '').split('\n')[0].trim()
  return first === '' ? 'unknown' : first
}
