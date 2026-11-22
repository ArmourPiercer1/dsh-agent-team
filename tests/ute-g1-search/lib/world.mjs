/**
 * world.mjs — the SEARCH family's old-path world: the PRODUCT route-C
 * composition, host-free, driving the REAL pinned search module over the
 * REAL confined `subprocess` face.
 *
 * WHAT IS REAL HERE (and why each piece has to be):
 *
 *   preset row      the PINNED baseline's own `@deepseek-ai/dsh-tool-fs-search`
 *                   module is mounted on the standing (preset) scope, exactly
 *                   as the governed preset mounts it. That is the module whose
 *                   `grep`/`glob` definitions the model sees, and the module
 *                   the route-C shadow delegates its DEFINITIONS to.
 *   governance      the PRODUCT seam: `mountMemberA5sfRealm` +
 *                   `attachA5sfNativeToolModules`
 *                   (`packages/runtime/src/plugin/live/a5sf-realm-row.mjs`).
 *                   The realm mounts the confined `subprocess` face; the attach
 *                   appends `confined-search-tool.mjs` (PD-16), which registers
 *                   the SAME grep/glob definitions on the Member's isolated
 *                   scope so their `ctx.subprocess` is the CONFINED face.
 *   backend         the PRODUCT's real `createConfinedProcessProvider` (the
 *                   Landlock launcher + the packaged ripgrep). A counting shim
 *                   records every `SpawnRequest` and forwards the real result
 *                   untouched, so "the confined face was/was not reached" is a
 *                   measurement, not a claim.
 *   base service    the pinned host's `LocalSubprocessRuntime` is NOT available
 *                   host-free without a boot, so the base `subprocess` service
 *                   is a REAL child_process spawn (the same shape the PD-16
 *                   suite uses). It exists so the preset search module can
 *                   mount; with the shadow in place it is never reached, and
 *                   the negative control that REMOVES the shadow shows what it
 *                   would do (run rg unconfined inside the lane).
 *
 * NO BOOT, no port, no DSH_HOME. A real child process IS created by the
 * admitted arms (through the real Landlock launcher) — a process, not a Host.
 * The arms that need the kernel to ENFORCE `content-read` declare that
 * requirement and refuse (never skip-to-green) when the host cannot meet it.
 *
 * @module tests/ute-g1-search/lib/world
 */
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire, register } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
/** This suite's repo root (tests/ute-g1-search/lib -> repo root). */
export const REPO_ROOT = join(HERE, '..', '..', '..')

/** The repo's EXISTING TypeScript-under-plain-node hooks (no new loader). */
let registered = false
function hooksRegistered() {
  if (registered) return
  register(pathToFileURL(join(REPO_ROOT, 'scripts', 'run-tests-hooks.mjs')).href)
  registered = true
}

/** The Member identity every vector runs under (one world per vector). */
export const SEARCH_IDENTITY = Object.freeze({
  teamId: 'team-ute3-search-b1',
  memberInstanceId: 'member-ute3-search-b1',
  templateId: 'worker',
  instanceGeneration: 1,
})
export const SEARCH_REVISION = 'rev-ute3-search-b1'

const LAUNCHER = join(REPO_ROOT, 'packages/runtime/sandbox-provider/launcher/landlock-prelauncher.py')
const LAUNCHER_SHA = createHash('sha256').update(readFileSync(LAUNCHER)).digest('hex')

let seamsPromise
/** Load the repo seams + the pinned host modules ONCE per process. */
export function loadSearchSeams() {
  seamsPromise ??= (async () => {
    hooksRegistered()
    const row = await import(pathToFileURL(join(REPO_ROOT, 'packages', 'runtime', 'src', 'plugin', 'live', 'a5sf-realm-row.mjs')).href)
    const runtimeRequire = createRequire(join(REPO_ROOT, 'packages', 'runtime', 'package.json'))
    const { Context, Service } = await import(pathToFileURL(runtimeRequire.resolve('@deepseek-ai/cordis')).href)
    const ToolRuntime = (await import(pathToFileURL(runtimeRequire.resolve('@deepseek-ai/dsh-tools')).href)).default
    const SystemPrompt = (await import(pathToFileURL(runtimeRequire.resolve('@deepseek-ai/dsh-system-prompt')).href)).default
    const { createScope, bindScopeParent } = await import(pathToFileURL(runtimeRequire.resolve('@deepseek-ai/dsh-scope')).href)
    const searchModule = await import(pathToFileURL(runtimeRequire.resolve('@deepseek-ai/dsh-tool-fs-search')).href)
    const { compileEffectiveIo } = await import(pathToFileURL(join(REPO_ROOT, 'packages', 'runtime', 'member-io-policy', 'src', 'index.ts')).href)
    const { createConfinedProcessProvider } = await import(pathToFileURL(join(REPO_ROOT, 'packages', 'runtime', 'sandbox-provider', 'index.ts')).href)
    const { readGuardConsultFile } = await import(pathToFileURL(join(REPO_ROOT, 'packages', 'runtime', 'team-services', 'src', 'guard-observability.ts')).href)
    return Object.freeze({ row, Context, Service, ToolRuntime, SystemPrompt, createScope, bindScopeParent, searchModule, compileEffectiveIo, createConfinedProcessProvider, readGuardConsultFile })
  })()
  return seamsPromise
}

/** One lane axis in the A1 policy/compiled shape. */
export function lane(allow, { ask = [], deny = [] } = {}) {
  return Object.freeze({ mode: 'restricted', allow: Object.freeze([...allow]), ask: Object.freeze([...ask]), deny: Object.freeze([...deny]) })
}

/**
 * The base unconfined `fs` service: a minimal REAL node:fs provider. The
 * search rows do not consume it; the realm needs a base `fs` to shadow and
 * the preset topology to be the product one.
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
 * The base `subprocess` service: the UNCONFINED path the preset row would use
 * if the route-C shadow were absent. It is a REAL spawn (the same shape the
 * PD-16 suite uses), and it counts every call so the corpus can record "the
 * inherited base service was never reached" as an observed fact.
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
      })
      return inner.spawnStreaming(request, streaming)
    },
  }
}

/**
 * Is the Landlock `content-read` leg ENFORCED on this host? A search that is
 * admitted must really run, so the arms that need it declare this; a host that
 * cannot enforce it refuses those arms (`SEARCH_KERNEL_UNENFORCED`), never
 * reports them green.
 * @returns {Promise<boolean>}
 */
export async function kernelEnforced() {
  const seams = await loadSearchSeams()
  const probe = seams.createConfinedProcessProvider({
    realmId: 'probe-ute3-search',
    trustRoot: `sha256:${LAUNCHER_SHA.slice(0, 16)}#${LAUNCHER}`,
    scratchRoot: join(REPO_ROOT, '.artifacts', 'tmp', 'ute-g1-search', `probe-${process.pid}`),
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
 *   `dropSearchShadow` (omit the confined search module), `widenReadTokens`
 *   (handled by the caller rebuilding the lane), `grepMaxMatches` etc.
 * @returns {Promise<object>} the world handle.
 */
export async function mountRouteCWorld({ label, fixtureRoot, cwd, readRoots, writeRoots = readRoots, overrides = {} }) {
  const seams = await loadSearchSeams()
  const { row, Context, Service, ToolRuntime, SystemPrompt, createScope, bindScopeParent, searchModule, compileEffectiveIo, createConfinedProcessProvider, readGuardConsultFile } = seams
  const BaseFileSystem = baseFileSystemClass(Service)
  const BaseSubprocess = baseSubprocessClass(Service)

  const sinkPath = join(fixtureRoot, `.guard-${label}.jsonl`)
  const root = new Context()
  await root.plugin(SystemPrompt)
  await root.plugin(ToolRuntime)
  await root.plugin(BaseFileSystem, {})
  await root.plugin(BaseSubprocess, {})

  // The PRESET topology the live Member row has: the shipped search row on the
  // STANDING scope (that is the definition the model would see un-shadowed).
  const standingKey = {}
  const standing = createScope(root, standingKey)
  await standing.ctx.plugin(searchModule, { sampleOverCapGlobResults: false })
  const agentKey = { id: `agent-${label}`, session: { header: { cwd } } }
  const agent = createScope(root, agentKey)
  bindScopeParent(agentKey, standingKey)

  const policyFor = (workspace) => Object.freeze({
    memberIdentity: SEARCH_IDENTITY.memberInstanceId,
    templateId: SEARCH_IDENTITY.templateId,
    instanceGeneration: SEARCH_IDENTITY.instanceGeneration,
    revision: SEARCH_REVISION,
    read: lane(readRoots),
    write: lane(writeRoots),
    network: Object.freeze({ access: 'allow' }),
  })
  const effectiveFor = () => Object.freeze({
    memberIdentity: SEARCH_IDENTITY.memberInstanceId,
    toolBindingIdentity: 'dsh.subprocess/exec',
    invocationId: `ute3-search:${label}`,
    policyRevision: SEARCH_REVISION,
    read: lane(readRoots),
    write: lane(writeRoots),
    network: Object.freeze({ access: 'allow' }),
  })
  // The ONE compiler: ceiling ∩ restriction (never re-derived here).
  const compiled = compileEffectiveIo(policyFor(cwd), {
    bindingIdentity: 'dsh.search/grep',
    read: lane(readRoots),
    write: lane(writeRoots),
    network: 'allow',
  }, {
    memberIdentity: SEARCH_IDENTITY.memberInstanceId,
    callId: `call-${label}`,
    policyRevision: SEARCH_REVISION,
    toolBindingIdentity: 'dsh.search/grep',
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
        members: [{ identity: SEARCH_IDENTITY, policy: { ok: true, value: policyFor(cwd) } }],
        providerClass: BaseFileSystem,
        subprocess: {
          effective: compiled.value,
          provider: confined,
          realmId: `realm-${label}`,
          bindingId: 'dsh.search/grep',
          memberScope: SEARCH_IDENTITY.memberInstanceId,
          providerClass: BaseSubprocess,
        },
      }),
    }),
    member: {
      sessionId: `session-${label}`,
      instanceId: SEARCH_IDENTITY.memberInstanceId,
      teamRootSessionId: 'team-root-ute3-search',
      templateId: SEARCH_IDENTITY.templateId,
    },
  })
  assert.ok(mounted !== undefined, 'the configured row must mount a realm')

  // The PRODUCT composition configures NO search module; the row's own search
  // shadow is the only thing that routes the native grep/glob onto the confined
  // face. `overrides.dropSearchShadow` is the negative control that removes it
  // AFTER the attach, through the realm's own disposal — the preset definition
  // then answers again (never a second, test-only mount).
  // POST-CUT LAW (round 81): the A1 seam appends NO Team-authored shadow. With no
  // composition-declared native module the attach answers `undefined`; the
  // retirement pin measures exactly that instead of asserting the shadow exists.
  const fibers = await row.attachA5sfNativeToolModules(mounted, agent.ctx, row.a5sfRealmConfigOf({}))
  const attachAppendedNothing = fibers === undefined
  if (overrides.dropSearchShadow === true) {
    assert.equal(typeof mounted.disposeNativeToolModules, 'function', 'the realm must expose the native-module disposal the control uses')
    await mounted.disposeNativeToolModules()
  }

  const baseCalls = () => BaseSubprocess.calls

  /** Dispatch one tool call through the REAL registry (the model call path). */
  const dispatch = async (name, args, options = {}) => {
    const settled = await root.tools.execute({
      signal: options.signal ?? new AbortController().signal,
      callId: `ute3-search-${label}-${name}-${Math.random().toString(36).slice(2, 8)}`,
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
    attachAppendedNothing,
    providerCalls: () => [...confined.calls],
    async dispose() {
      if (disposed) return
      disposed = true
      await mounted.dispose()
    },
  })
}
