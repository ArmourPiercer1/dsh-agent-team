/**
 * a5sf-sub-contract-world.mjs — the host-free world for the Subprocess
 * capability face's LAYER B (native-tool contract) arms.
 *
 * WHAT IS REAL HERE, and why each piece has to be:
 *
 *   base service   the PINNED baseline's real `LocalSubprocessRuntime`
 *                  (`@deepseek-ai/dsh-subprocess-local`) is mounted on the root
 *                  as `ctx.subprocess`. It is the service the product realm
 *                  SHADOWS, and its own `spawn` is the UNCONFINED path the
 *                  environment arm compares against (it goes through
 *                  `childEnv` → `scrubbedParentEnv`).
 *   native module  the PINNED baseline's real `@deepseek-ai/dsh-bash-local`
 *                  `LocalBashExecutor` — the shipped executor that injects
 *                  `subprocess` and builds the `['bash','-c',command]` spawn
 *                  spec. It is mounted INSIDE the Member's isolated scope
 *                  through the product seam (`realm.mountNativeToolModules`),
 *                  so it resolves the confined face, not the base service.
 *   OS provider    the PRODUCT's real `createConfinedProcessProvider` (P1-07)
 *                  with the real Landlock launcher pin. Wrapped ONCE by
 *                  {@link countingProvider}, which only COUNTS calls, records
 *                  the exact `SpawnRequest` and forwards the real result/error
 *                  untouched, so a refusal arm's `before === after` is a
 *                  measurement, not a claim.
 *   confinement    the PRODUCT seam: `mountA5sfRealm` with the
 *                  `subprocess: { effective, provider, shellClass }` install
 *                  spec. The arms drive `realm.installation.members[0].faces
 *                  .subprocess` — the face the product actually mounted.
 *
 * NO HOST BOOT, no port, no DSH_HOME, no `tests/homes/**`. A real child process
 * IS created by the admitted arms (through the real Landlock launcher), exactly
 * as the BL-16 grep arms do; that is a process, not a Host.
 *
 * HOST-REQUIRED. The four entries the arms consume are `lib/` build outputs of
 * the pinned tree; `lib/` is not committed there. The suite has the same three
 * states as the FS face (`host absent` = declared refusal, `present but
 * partial` = hard failure, `present and complete` = run).
 *
 * @module tests/world-factory/lib/a5sf-sub-contract-world
 */

import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { createRequire, register } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { findTestRepoRoot, testUseTree } from '../../paths.mjs'

/** The Member identity every arm runs under. */
export const SUB_CONTRACT_IDENTITY = Object.freeze({
  teamId: 'team-a5sf-sub-contract',
  memberInstanceId: 'member-a5sf-sub-contract',
  templateId: 'worker',
  instanceGeneration: 1,
})

/** The closed shell-class refusal vocabulary the suite pins (read from the module, not invented). */
export const SHELL_ADMISSION_CODES = Object.freeze({
  notDeclared: 'SUBPROCESS_SHELL_NOT_DECLARED',
  programNotAdmitted: 'SUBPROCESS_SHELL_PROGRAM_NOT_ADMITTED',
  invocationUndeclared: 'SUBPROCESS_SHELL_INVOCATION_UNDECLARED',
  argvUnsupported: 'SUBPROCESS_SHELL_ARGV_UNSUPPORTED',
})

/** The pinned shell executor's own argv shape (`bash-local/src/index.ts:188`). */
export const NATIVE_BASH_ARGV = Object.freeze(['bash', '-c'])

const SEAM_CACHE = new Map()

/**
 * WHERE the pinned entries live and WHAT the arms consume. Exported so the
 * suite's host gate can distinguish an environment ABSENCE from a pin
 * VIOLATION (a partial/older checkout), the two shapes PR #612 proved must not
 * be confused.
 */
export function subContractHostLayout(repoRoot) {
  // Simulation-only override: lets the suite's own three-state host gate be
  // exercised against an ABSENT root without moving the gitignored checkout.
  // Product/test code never reads it; see `host-refusal-simulation.log`.
  const override = process.env.A5SF_SUB_CONTRACT_HOST_ROOT
  const root = override === undefined || override === '' ? testUseTree(findTestRepoRoot(repoRoot) ?? repoRoot) : override
  return {
    root,
    entries: {
      upstreamSubprocess: join(root, 'packages', 'subprocess', 'subprocess', 'lib', 'index.js'),
      subprocessLocal: join(root, 'packages', 'subprocess', 'subprocess-local', 'lib', 'index.js'),
      bashLocal: join(root, 'packages', 'shell', 'bash-local', 'lib', 'index.js'),
      httpProxy: join(root, 'packages', 'util', 'http-proxy', 'lib', 'index.js'),
    },
  }
}

/** Load the repo seams and the PINNED module entries. Cached per repo root. */
export function loadSubContractSeams(repoRoot) {
  if (SEAM_CACHE.has(repoRoot)) return SEAM_CACHE.get(repoRoot)
  const promise = (async () => {
    register(pathToFileURL(join(repoRoot, 'scripts', 'run-tests-hooks.mjs')).href)
    const memberIoPolicy = await import(pathToFileURL(join(repoRoot, 'packages/runtime/member-io-policy/src/index.ts')).href)
    const services = await import(pathToFileURL(join(repoRoot, 'packages/runtime/team-services/src/index.ts')).href)
    const subprocess = await import(pathToFileURL(join(repoRoot, 'packages/runtime/team-services/src/subprocess.ts')).href)
    const providerModule = await import(pathToFileURL(join(repoRoot, 'packages/runtime/sandbox-provider/provider.ts')).href)
    const network = await import(pathToFileURL(join(repoRoot, 'packages/runtime/sandbox-provider/network.ts')).href)
    const profile = await import(pathToFileURL(join(repoRoot, 'packages/runtime/team-sandbox/src/profile.ts')).href)
    const runtimeRequire = createRequire(join(repoRoot, 'packages/runtime/package.json'))
    const { Context, Service } = await import(pathToFileURL(runtimeRequire.resolve('@deepseek-ai/cordis')).href)
    const ToolRuntime = (await import(pathToFileURL(runtimeRequire.resolve('@deepseek-ai/dsh-tools')).href)).default
    const SystemPrompt = (await import(pathToFileURL(runtimeRequire.resolve('@deepseek-ai/dsh-system-prompt')).href)).default
    const { bindScopeParent, createScope } = await import(pathToFileURL(runtimeRequire.resolve('@deepseek-ai/dsh-scope')).href)

    const { entries } = subContractHostLayout(repoRoot)
    for (const [name, entry] of Object.entries(entries)) {
      if (!existsSync(entry)) {
        throw new Error(`the pinned baseline's ${name} entry is missing (${entry}); provision tests/deepseek-harness-test-use and build it`)
      }
    }
    const [upstream, subprocessLocal, bashLocal, httpProxy] = await Promise.all([
      import(pathToFileURL(entries.upstreamSubprocess).href),
      import(pathToFileURL(entries.subprocessLocal).href),
      import(pathToFileURL(entries.bashLocal).href),
      import(pathToFileURL(entries.httpProxy).href),
    ])

    const launcher = join(repoRoot, 'packages', 'runtime', 'sandbox-provider', 'launcher', 'landlock-prelauncher.py')
    const launcherSha256 = createHash('sha256').update(readFileSync(launcher)).digest('hex')

    return Object.freeze({
      memberIoPolicy,
      services,
      subprocess,
      providerModule,
      network,
      profile,
      Context,
      Service,
      ToolRuntime,
      SystemPrompt,
      bindScopeParent,
      createScope,
      upstream,
      subprocessLocal,
      bashLocal,
      httpProxy,
      launcher,
      launcherSha256,
    })
  })()
  SEAM_CACHE.set(repoRoot, promise)
  return promise
}

/** One restricted lane (the shipped v4 shape). */
export function lane(allow, deny = []) {
  return Object.freeze({ mode: 'restricted', allow: Object.freeze([...allow]), ask: Object.freeze([]), deny: Object.freeze([...deny]) })
}

/** The Member ceiling under the fixed identity. */
export function memberCeiling({ read, write, network }) {
  return Object.freeze({
    memberIdentity: SUB_CONTRACT_IDENTITY.memberInstanceId,
    templateId: SUB_CONTRACT_IDENTITY.templateId,
    instanceGeneration: SUB_CONTRACT_IDENTITY.instanceGeneration,
    revision: 'rev-a5sf-sub-contract',
    read,
    write,
    network: Object.freeze({ access: network }),
  })
}

/** Compile the effective lane with the ONE compiler (`ceiling ∩ restriction`). */
export function effectiveLane(seams, { read, write, network, bindingIdentity = 'team/sub-contract' }) {
  const ceiling = memberCeiling({ read, write, network })
  const compiled = seams.memberIoPolicy.compileEffectiveIo(
    ceiling,
    { bindingIdentity, read, write, network },
    {
      memberIdentity: SUB_CONTRACT_IDENTITY.memberInstanceId,
      callId: 'call-a5sf-sub-contract',
      policyRevision: ceiling.revision,
      toolBindingIdentity: bindingIdentity,
      approvedOnce: false,
    },
  )
  if (compiled.ok !== true) throw new Error(`compileEffectiveIo refused: ${JSON.stringify(compiled)}`)
  return { ceiling, effective: compiled.value }
}

/**
 * The counting boundary over the REAL provider: it records the exact request
 * and delegates. A refusal arm compares `spawns.count` before/after, so
 * "refused before any process" is a counter, not a narration.
 */
export function countingProvider(inner) {
  const requests = []
  const spawns = { count: 0 }
  return {
    requests,
    spawns,
    provider: {
      async spawnStreaming(request, streaming) {
        spawns.count += 1
        requests.push(request)
        return inner.spawnStreaming(request, streaming)
      },
      probe: () => inner.probe(),
    },
  }
}

/** The base `fs` Provider the realm needs (the subprocess face never calls it). */
export function baseFsClass(Service) {
  return class BaseFs extends Service {
    constructor(ctx, config = {}) {
      super(ctx, 'fs')
      this.config = config
    }

    processPath(target) {
      return target.hostPath ?? target
    }

    contains(parent, child) {
      return String(this.processPath(child)).startsWith(String(this.processPath(parent)))
    }

    async resolve(path) {
      return { hostPath: path, displayPath: path }
    }

    async readText() { return '' }
    async streamText() { return (async function* stream() {})() }
    async readBytes() { return new Uint8Array() }
    async readByteRange() { return new Uint8Array() }
    async listDir() { return [] }
    async stat() { return { type: 'file', size: 0, mtimeMs: 0, mode: 0o644 } }
    async lstat() { return this.stat() }
    async watch() { return async () => undefined }
    async writeText() { return { version: 'v1' } }
    async editText() { return { version: 'v2' } }
  }
}

/** One spawn spec in the native seam's shape. */
export function spawnSpec({ argv, cwd, shell, env, stdin = 'ignore', maxBytes = 1 << 18 }) {
  return {
    argv,
    cwd,
    stdio: { stdin, stdout: { maxBytes }, stderr: { maxBytes } },
    graceMs: 5_000,
    ...(shell === undefined ? {} : { shell }),
    ...(env === undefined ? {} : { env }),
  }
}

/** The declared invocation every shell arm uses (the opaque body is not a path). */
export function shellDeclaration({ program = 'bash', reads, writes, chmod } = {}) {
  return {
    program,
    ...(reads === undefined ? {} : { reads }),
    ...(writes === undefined ? {} : { writes }),
    ...(chmod === undefined ? {} : { chmod }),
  }
}

/**
 * Build ONE world: the product realm with the real confined subprocess face,
 * the real pinned base service and the real pinned `bash-local` executor
 * mounted inside the Member scope.
 *
 * @param {object} input
 * @param {string} input.repoRoot - workspace root.
 * @param {string} input.label - mkdtemp label.
 * @param {{ programs: readonly string[] }|undefined} [input.shellClass] - the
 *   COMPOSITION's declared shell class; omitted = none (the BL-16 refusal).
 * @param {'allow'|'deny'} [input.network] - the network axis of the lane.
 * @param {{ read?: string[], write?: string[] }} [input.laneRoots] - allow
 *   subtrees by fixture name (`inside`, `outside`). A read lane WIDER than the
 *   write lane is the anti-mis-attribution shape the write arm needs.
 * @param {boolean} [input.withNativeModule] - mount the real `bash-local`
 *   executor into the Member scope (default true).
 */
export async function makeSubContractWorld({
  repoRoot,
  label,
  shellClass,
  network = 'allow',
  laneRoots = {},
  withNativeModule = true,
}) {
  const seams = await loadSubContractSeams(repoRoot)
  const {
    Context, Service, ToolRuntime, SystemPrompt, createScope, bindScopeParent,
    memberIoPolicy, services, subprocess, providerModule, subprocessLocal, bashLocal,
    launcher, launcherSha256,
  } = seams

  const dir = mkdtempSync(join(tmpdir(), `a5sf-sub-contract-${label}-`))
  const inside = join(dir, 'inside')
  const outside = join(dir, 'outside')
  mkdirSync(inside, { recursive: true })
  mkdirSync(outside, { recursive: true })
  const fixtures = {
    dir,
    inside,
    outside,
    inLane: join(inside, 'in-lane.txt'),
    outsideSecret: join(outside, 'secret.txt'),
    outsideCreated: join(outside, 'created.txt'),
    insideCreated: join(inside, 'created.txt'),
  }
  writeFileSync(fixtures.inLane, 'IN-LANE-SUBPROCESS-BYTES\n', 'utf8')
  writeFileSync(fixtures.outsideSecret, 'OUTSIDE-SUBPROCESS-SECRET\n', 'utf8')

  const rootOf = (value) => (typeof value === 'string' && Object.hasOwn(fixtures, value) ? fixtures[value] : value)
  const resolveRoots = (values) => (values ?? []).map(rootOf)
  const readRoots = laneRoots.read === undefined ? [inside] : resolveRoots(laneRoots.read)
  const writeRoots = laneRoots.write === undefined ? [inside] : resolveRoots(laneRoots.write)

  const { ceiling, effective } = effectiveLane(seams, {
    read: lane(readRoots),
    write: lane(writeRoots),
    network,
  })

  const facts = []
  const root = new Context()
  await root.plugin(SystemPrompt)
  await root.plugin(ToolRuntime)
  await root.plugin(baseFsClass(Service), {})
  // The REAL pinned base service the realm shadows: the unconfined comparison
  // path for the environment arm, and the class `install` samples.
  await root.plugin(subprocessLocal.default ?? subprocessLocal)

  const standingKey = {}
  const standing = createScope(root, standingKey)
  const agentKey = { session: { header: {} }, options: {} }
  const agent = createScope(root, agentKey)
  bindScopeParent(agentKey, standingKey)

  const realmId = `realm-a5sf-sub-contract-${label}`
  const raw = providerModule.createConfinedProcessProvider({
    realmId,
    trustRoot: `sha256:${launcherSha256.slice(0, 16)}#${launcher}`,
    scratchRoot: join(dir, 'scratch'),
    assembly: { launcherPath: launcher, launcherSha256, minAbiVersion: 3 },
  })
  const counted = countingProvider(raw)

  const realm = await services.mountA5sfRealm({
    root: agent.ctx,
    members: [{ identity: SUB_CONTRACT_IDENTITY, policy: { ok: true, value: ceiling } }],
    providerClass: baseFsClass(Service),
    subprocess: {
      effective,
      provider: counted.provider,
      realmId,
      memberScope: SUB_CONTRACT_IDENTITY.memberInstanceId,
      // `shellClass: undefined` is passed as the ABSENCE of the field (the
      // admission's "declared no class" branch); an explicit `undefined` in the
      // spec is the same absence.
      ...(shellClass === undefined ? {} : { shellClass }),
    },
    onGuardConsult: (fact) => facts.push(fact),
  })

  const member = realm.installation.members[0]
  assert.ok(member?.faces?.subprocess !== undefined, 'the product realm mounted no confined subprocess face')
  const face = member.faces.subprocess
  const memberCtx = member.ctx

  let nativeFibers = []
  if (withNativeModule) {
    nativeFibers = await realm.mountNativeToolModules(
      [{ module: bashLocal.default ?? bashLocal }],
      { scope: agentKey },
    )
  }
  const shell = memberCtx.get('shell')

  return {
    seams,
    dir,
    fixtures,
    root,
    agentKey,
    realm,
    face,
    memberCtx,
    shell,
    nativeFibers,
    facts,
    counted,
    /** The pin the profile compiled from (read-only witness). */
    effective,
    ceiling,
    provider: counted.provider,
    /** The real base (unconfined) service, for the env comparison. */
    baseSubprocess: root.get('subprocess'),
    /**
     * Run one spawn through the MOUNTED face and settle its `done`.
     * A synchronous throw and an async rejection are returned in one shape.
     */
    async spawn(spec) {
      const before = counted.spawns.count
      let handle
      try {
        handle = face.spawn(spec)
      } catch (error) {
        return { before, after: counted.spawns.count, error, code: error?.code ?? null, text: undefined, factsAfter: facts.length }
      }
      const error = await handle.done.then(() => undefined, (caught) => caught)
      const text = handle.collected?.stdout?.readFrom(0).text
      return { before, after: counted.spawns.count, error, code: error?.code ?? null, text, factsAfter: facts.length }
    },
    /** Run one spawn through the UNCONFINED real base service and drain it. */
    async spawnBase(spec) {
      const handle = this.baseSubprocess.spawn(spec)
      const error = await handle.done.then(() => undefined, (caught) => caught)
      return { error, code: error?.code ?? null, text: handle.collected?.stdout?.readFrom(0).text }
    },
    async dispose() {
      for (const fiber of [...nativeFibers].reverse()) {
        try { await fiber.dispose() } catch { /* collected by the suite's own teardown assertion */ }
      }
      await realm.dispose()
      await root.dispose?.()
      rmSync(dir, { recursive: true, force: true })
    },
  }
}

// ---------------------------------------------------------------------------
// The environment arm's controlled ambient process environment.
// ---------------------------------------------------------------------------

/** Every name the proxy overlay owns (`http-proxy` POLICY_ENV_NAMES) plus the flag. */
export const PROXY_ENV_NAMES = Object.freeze([
  'HTTP_PROXY', 'HTTPS_PROXY', 'ALL_PROXY', 'NO_PROXY',
  'http_proxy', 'https_proxy', 'all_proxy', 'no_proxy',
  'NODE_USE_ENV_PROXY',
])

/** Snapshot the ambient names the env arms touch, so they can be restored. */
export function snapshotAmbientEnv(names = [...PROXY_ENV_NAMES, 'A5SF_VISIBLE', 'A5SF_SECRET_TOKEN', 'DSH_HOME', 'dsh_lower']) {
  return Object.fromEntries(names.map((name) => [name, process.env[name]]))
}

/** Restore a snapshot taken by {@link snapshotAmbientEnv}. */
export function restoreAmbientEnv(snapshot) {
  for (const [name, value] of Object.entries(snapshot)) {
    if (value === undefined) Reflect.deleteProperty(process.env, name)
    else process.env[name] = value
  }
}

/**
 * Install a REAL proxy policy through the pinned `http-proxy` package, using a
 * caller-supplied user environment (never the ambient one). Returns the
 * disposer the package hands back. This is what makes
 * `scrubbedParentEnv()`'s child overlay non-empty.
 */
export async function installRealProxyPolicy(seams, userEnv, report = () => undefined) {
  const lookup = {
    get(name) {
      const value = userEnv[name]
      return value === undefined ? undefined : { value }
    },
  }
  return seams.httpProxy.installProxyFromEnvironment(lookup, report)
}

/** `stat` + bytes of a file, or `{exists:false}` — the effect control. */
export function snapshotFile(path) {
  if (!existsSync(path)) return { exists: false }
  const stat = statSync(path)
  return { exists: true, mode: stat.mode & 0o777, bytes: readFileSync(path, 'utf8') }
}

/**
 * Assert that a string is a CAPABILITY statement, never a measurement claim.
 * The network refusal must not read like "we observed no connections".
 */
export function assertCapabilityNotMeasurement(text, where) {
  const value = String(text)
  for (const forbidden of [
    /observed\s+(zero|no)\s+(network|connection|transport|socket)/i,
    /zero\s+(network\s+)?(transport\s+)?entries/i,
    /no\s+(outbound\s+)?connections?\s+(were\s+)?(observed|made|seen)/i,
    /syscall(s)?\s+(were\s+)?(observed|counted|recorded)/i,
  ]) {
    assert.equal(forbidden.test(value), false, `${where} must not read as a measurement claim: ${value}`)
  }
}
