/**
 * a5sf-pd16-search-read-axis.test.mjs — PD-16: a governed Member's `grep` and
 * `glob` never reached the confined subprocess face, so a one-workspace Member
 * read outside its compiled read lane.
 *
 * WHAT THIS SUITE IS (host-free; in-process Cordis roots, no boot, no DSH_HOME,
 * no port): the discriminating pair for the SEARCH face over the PRODUCT seam.
 * The pinned `@deepseek-ai/dsh-tool-fs-search` module injects `subprocess` (NOT
 * `fs`), so the realm confinement measured for `read`/`write`/`edit` never
 * covered `grep`/`glob`. The recon `a5sf-recon-search` (PR #655) measured the
 * consequence on a live Host: `rg` as a direct child of the Host node process,
 * same namespaces, no launcher, ZERO `a5sf-guard-consult/1` facts, and a
 * one-workspace Member returning the bytes of `../out-of-lane/secret`.
 *
 * The world is the recon's shape: a workspace (the compiled read lane) with a
 * sibling `out-of-lane/` directory that the lane DENIES, a `.gitignore`d file,
 * an absent needle and a hidden file. The preset plane mounts the REAL pinned
 * host search module on the standing scope; the realm mounts the confined
 * `subprocess` face (real Landlock launcher + real packaged ripgrep) and the
 * route-C attach places the shadow.
 *
 * ARMS
 *   P0  THE DEFECT PIN (env-gated, `A5SF_PD16_PIN=1`). It asserts TODAY'S
 *       PRE-FIX behaviour: `grep` with `path: '..'` and with an ABSOLUTE
 *       out-of-lane directory returns the secret bytes and NO guard fact names
 *       the locator. It is GREEN before the fix and RED after it; the default
 *       suite run skips it (a pin is a one-way marker, not a regression guard).
 *   D1  THE FIX, parent form: `grep {path: '..'}` is refused with ZERO confined
 *       provider calls, ZERO secret bytes, and exactly ONE deny fact naming the
 *       resolved locator.
 *   D2  THE FIX, absolute form: `grep {path: <absolute out-of-lane dir>}` is
 *       refused the same way (the recon's second measured form).
 *   D3  THE FIX, glob: `glob {path: <absolute out-of-lane dir>}` is refused the
 *       same way — glob rides the SAME confined face (its argv is a different
 *       admitted shape, not a different route).
 *   A1  ALLOW: an in-lane `grep` finds the needle through the confined face
 *       (≥1 provider call, ≥1 spawn, one `allow` fact) and the INHERITED base
 *       service is never reached.
 *   A2  EXIT-CODE FIDELITY: an in-lane search with no hit is NOT an error
 *       (rg exit 1 → "No matches found") while an invalid pattern IS an error
 *       (rg exit 2 → "rejected by ripgrep"). The two are distinguishable at the
 *       tool result, so the face did not flatten the exit status.
 *   A3  LANE-SAFE IGNORE DISCOVERY: the search root's ancestors are outside the
 *       lane, so the face adds `--no-ignore-parent --no-ignore-vcs`: the
 *       `.gitignore`d file IS searched and the allow fact carries the two
 *       disclosure notes. (The alternative is an `rg` that reads a lane-denied
 *       `.git` and dies with exit 2.)
 *   A4  IGNORE SEMANTICS KEPT where they can be: a lane that includes the
 *       `.git`-bearing ancestor keeps ordinary ripgrep semantics — the
 *       `.gitignore`d file is NOT searched and no disclosure note is recorded.
 *   A5  GLOB ALLOW: an in-lane `glob` lists the workspace files through the same
 *       confined face.
 *   S1  SURFACE NEUTRAL: the model-visible name set is unchanged, and the
 *       `grep`/`glob` parameter schemas are byte-identical before/after (the
 *       shadow replaces the definition, it does not reshape the tool).
 *   C1  CONTROL — remove the shadow (dispose the native modules): the fixed
 *       refusal goes RED in place (the ungoverned path returns the bytes).
 *
 * Run:  node --test --test-reporter=spec tests/world-factory/a5sf-pd16-search-read-axis.test.mjs
 * Pin:  A5SF_PD16_PIN=1 node --test --test-reporter=spec tests/world-factory/a5sf-pd16-search-read-axis.test.mjs
 */
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire, register } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import test, { after } from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = join(HERE, '..', '..')
const PIN = process.env.A5SF_PD16_PIN === '1'

/** The repo's EXISTING TS-under-plain-node hooks (no new loader). */
register(pathToFileURL(join(REPO_ROOT, 'scripts', 'run-tests-hooks.mjs')).href)

const row = await import(pathToFileURL(join(REPO_ROOT, 'packages', 'runtime', 'src', 'plugin', 'live', 'a5sf-realm-row.mjs')).href)
const runtimeRequire = createRequire(join(REPO_ROOT, 'packages', 'runtime', 'package.json'))
const { Context, Service } = await import(pathToFileURL(runtimeRequire.resolve('@deepseek-ai/cordis')).href)
const ToolRuntime = (await import(pathToFileURL(runtimeRequire.resolve('@deepseek-ai/dsh-tools')).href)).default
const SystemPrompt = (await import(pathToFileURL(runtimeRequire.resolve('@deepseek-ai/dsh-system-prompt')).href)).default
const { createScope, bindScopeParent } = await import(pathToFileURL(runtimeRequire.resolve('@deepseek-ai/dsh-scope')).href)
/** The REAL pinned host search package (public) — what the governed preset mounts. */
const searchModule = await import(pathToFileURL(runtimeRequire.resolve('@deepseek-ai/dsh-tool-fs-search')).href)
const { compileEffectiveIo } = await import(pathToFileURL(join(REPO_ROOT, 'packages', 'runtime', 'member-io-policy', 'src', 'index.ts')).href)
const { createConfinedProcessProvider } = await import(pathToFileURL(join(REPO_ROOT, 'packages', 'runtime', 'sandbox-provider', 'index.ts')).href)
const { readGuardConsultFile } = await import(pathToFileURL(join(REPO_ROOT, 'packages', 'runtime', 'team-services', 'src', 'guard-observability.ts')).href)
const { SEARCH_IGNORE_DISCOVERY_NOTES } = await import(pathToFileURL(join(REPO_ROOT, 'packages', 'runtime', 'team-services', 'src', 'subprocess.ts')).href)

const LAUNCHER = join(REPO_ROOT, 'packages/runtime/sandbox-provider/launcher/landlock-prelauncher.py')
const LAUNCHER_SHA = createHash('sha256').update(readFileSync(LAUNCHER)).digest('hex')

const IDENTITY = Object.freeze({
  teamId: 'team-a5sf-pd16',
  memberInstanceId: 'member-pd16-a',
  templateId: 'worker',
  instanceGeneration: 1,
})
const REVISION = 'rev-a5sf-pd16'

const INLANE_NEEDLE = 'A5SF_PD16_INLANE_NEEDLE'
const OUTLANE_NEEDLE = 'A5SF_PD16_OUTLANE_SECRET'
const IGNORED_NEEDLE = 'A5SF_PD16_IGNORED_NEEDLE'
const ABSENT_NEEDLE = 'A5SF_PD16_ABSENT_NEEDLE_9f13'

// --- fixtures ---------------------------------------------------------------

const dirs = []
function tracked(dir) {
  dirs.push(dir)
  return dir
}
after(() => {
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true })
})

/**
 * The recon's world: a workspace (the compiled read lane) plus a sibling
 * `out-of-lane/` the lane denies. `gitRoot` decides the ignore-discovery shape:
 *   - `null`  → every ancestor of the workspace is outside the lane, so the
 *               face MUST add the lane-safe flags (A3);
 *   - a path  → the lane includes a `.git`-bearing ancestor, so ripgrep's own
 *               ignore discovery stays inside the lane (A4).
 */
function makeWorldDirs(label, { gitRoot = null, ancestorGitFile = false, emptyWorkspaceGit = false } = {}) {
  const root = tracked(mkdtempSync(join(tmpdir(), `a5sf-pd16-${label}-`)))
  const base = gitRoot === null ? root : join(root, 'lane-root')
  const workspace = join(base, 'workspace')
  const outOfLane = join(root, 'out-of-lane')
  mkdirSync(workspace, { recursive: true })
  mkdirSync(join(workspace, 'sub'), { recursive: true })
  mkdirSync(join(workspace, '.hidden'), { recursive: true })
  mkdirSync(outOfLane, { recursive: true })
  if (gitRoot !== null) {
    // A VALID repository root (HEAD present): rg's discovery legitimately stops
    // inside the lane here.
    mkdirSync(join(gitRoot, '.git', 'objects'), { recursive: true })
    writeFileSync(join(gitRoot, '.git', 'HEAD'), 'ref: refs/heads/main\n', 'utf8')
  }
  if (ancestorGitFile) {
    // The `.worktrees/` layout: an ancestor `.git` FILE (a `gitdir:` worktree
    // pointer) OUTSIDE the lane. Measured (PD-16 boot): rg OPENS it and a
    // kernel denial of that open is FATAL exit 2 even though the match is on
    // stdout.
    mkdirSync(join(root, '.gitdir'), { recursive: true })
    writeFileSync(join(root, '.gitdir', 'HEAD'), 'ref: refs/heads/main\n', 'utf8')
    writeFileSync(join(root, '.git'), `gitdir: ${join(root, '.gitdir')}\n`, 'utf8')
  }
  if (emptyWorkspaceGit) {
    // The recon fixture's shape: a `.git` DIRECTORY with no HEAD — rg keeps
    // walking above it (measured), so it is not a containment boundary.
    mkdirSync(join(workspace, '.git'), { recursive: true })
  }
  writeFileSync(join(workspace, 'in-lane.txt'), `${INLANE_NEEDLE} in lane\n`, 'utf8')
  writeFileSync(join(workspace, 'sub', 'nested.txt'), `${INLANE_NEEDLE} nested\n`, 'utf8')
  writeFileSync(join(workspace, 'absent.txt'), 'nothing to see here\n', 'utf8')
  writeFileSync(join(workspace, '.hidden', 'hidden.txt'), `${INLANE_NEEDLE} hidden\n`, 'utf8')
  writeFileSync(join(workspace, 'ignored.txt'), `${IGNORED_NEEDLE} ignored but present\n`, 'utf8')
  writeFileSync(join(workspace, '.gitignore'), 'ignored.txt\n', 'utf8')
  writeFileSync(join(outOfLane, 'secret-out-of-lane.txt'), `${OUTLANE_NEEDLE}\n`, 'utf8')
  writeFileSync(join(outOfLane, 'other.txt'), 'harmless\n', 'utf8')
  return { root, base, workspace, outOfLane, secret: join(outOfLane, 'secret-out-of-lane.txt') }
}

function lane(allow) {
  return Object.freeze({ mode: 'restricted', allow: Object.freeze([...allow]), ask: Object.freeze([]), deny: Object.freeze([]) })
}

function policyFor(workspace) {
  return Object.freeze({
    memberIdentity: IDENTITY.memberInstanceId,
    templateId: IDENTITY.templateId,
    instanceGeneration: IDENTITY.instanceGeneration,
    revision: REVISION,
    read: lane([workspace]),
    write: lane([workspace]),
    network: Object.freeze({ access: 'allow' }),
  })
}

function effectiveFor(workspace) {
  return Object.freeze({
    memberIdentity: IDENTITY.memberInstanceId,
    toolBindingIdentity: 'dsh.subprocess/exec',
    invocationId: 'a5sf-pd16:exec',
    policyRevision: REVISION,
    read: lane([workspace]),
    write: lane([workspace]),
    network: Object.freeze({ access: 'allow' }),
  })
}

/** The one compiler: ceiling ∩ restriction (never re-derived here). */
function effectiveOf(readRoots, writeRoots = readRoots) {
  // The ceiling is the SAME root set as the restriction, so the compiled
  // effective lane really contains every root this world means to allow (a
  // narrower ceiling would silently intersect the A4 root away).
  const ceiling = Object.freeze({
    ...policyFor(readRoots[0]),
    read: lane(readRoots),
    write: lane(writeRoots),
  })
  const compiled = compileEffectiveIo(ceiling, {
    bindingIdentity: 'dsh.search/grep',
    read: lane(readRoots),
    write: lane(writeRoots),
    network: 'allow',
  }, {
    memberIdentity: IDENTITY.memberInstanceId,
    callId: 'call-a5sf-pd16',
    policyRevision: REVISION,
    toolBindingIdentity: 'dsh.search/grep',
    approvedOnce: false,
  })
  if (!compiled.ok) throw new Error(`compileEffectiveIo refused: ${JSON.stringify(compiled)}`)
  return compiled.value
}

/** A real Cordis fs Service over node:fs — the base provider the realm shadows. */
class TestFileSystem extends Service {
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
  async stat(target) { return { type: 'file', size: 0, mtimeMs: 0, mode: 0o644 } }
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
 * The INHERITED base `subprocess` service: the preset's own executor path, and
 * a REAL one. This is what makes P0 a measurement rather than a mock — the
 * packaged ripgrep actually runs, actually reads `../out-of-lane`, and actually
 * returns the secret. The `calls` counter is the negative control every fixed
 * arm uses ("the ungoverned path was never reached").
 */
class BaseSubprocess extends Service {
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

/** The PRESET's model-visible search row: the REAL pinned host module. */
async function mountPresetSearch(standingCtx) {
  await standingCtx.plugin(searchModule, { sampleOverCapGlobResults: false })
}

/** A counting shim over the REAL OS provider: the negative control's counter. */
function countingProvider(inner) {
  const calls = []
  return {
    calls,
    async spawnStreaming(request, streaming) {
      calls.push({ argv: [...(request?.argv ?? [])], cwd: String(request?.cwd ?? '') })
      return inner.spawnStreaming(request, streaming)
    },
  }
}

async function makeWorld(label, { gitRoot = null, ancestorGitFile = false, emptyWorkspaceGit = false } = {}) {
  const dirsOf = makeWorldDirs(label, { gitRoot, ancestorGitFile, emptyWorkspaceGit })
  const root = new Context()
  await root.plugin(SystemPrompt)
  await root.plugin(ToolRuntime)
  await root.plugin(TestFileSystem, {})
  await root.plugin(BaseSubprocess, {})
  const standingKey = {}
  const standing = createScope(root, standingKey)
  await mountPresetSearch(standing.ctx)
  const agentKey = { id: `agent-${label}`, session: { header: { cwd: dirsOf.workspace } } }
  const agent = createScope(root, agentKey)
  bindScopeParent(agentKey, standingKey)
  const sinkPath = join(dirsOf.root, `consult-${label}.jsonl`)
  const osProvider = createConfinedProcessProvider({
    realmId: `realm-${label}`,
    trustRoot: `sha256:${LAUNCHER_SHA.slice(0, 16)}#${LAUNCHER}`,
    scratchRoot: join(dirsOf.root, `scratch-${label}`),
    assembly: { launcherPath: LAUNCHER, launcherSha256: LAUNCHER_SHA, minAbiVersion: 3 },
  })
  const confined = countingProvider(osProvider)
  const readRoots = gitRoot === null ? [dirsOf.workspace] : [dirsOf.workspace, gitRoot]
  return {
    label,
    ...dirsOf,
    root,
    agentKey,
    agentCtx: agent.ctx,
    standingCtx: standing.ctx,
    sinkPath,
    confined,
    readRoots,
    provider: () => ({
      compiledFor: () => ({
        members: [{ identity: IDENTITY, policy: { ok: true, value: policyFor(dirsOf.workspace) } }],
        providerClass: TestFileSystem,
        subprocess: {
          effective: effectiveOf(readRoots),
          provider: confined,
          realmId: `realm-${label}`,
          bindingId: 'dsh.search/grep',
          memberScope: IDENTITY.memberInstanceId,
          providerClass: BaseSubprocess,
        },
      }),
    }),
  }
}

async function mountAndAttach(world, config = {}) {
  const mounted = await row.mountMemberA5sfRealm({
    root: world.agentCtx,
    a5sfConfig: row.a5sfRealmConfigOf({ a5sfEvidencePath: world.sinkPath }),
    provider: world.provider,
    member: {
      sessionId: `session-${world.label}`,
      instanceId: IDENTITY.memberInstanceId,
      teamRootSessionId: 'team-root',
      templateId: IDENTITY.templateId,
    },
  })
  assert.ok(mounted !== undefined, 'the configured row must mount a realm')
  // The PRODUCT composition configures NO search module; the row's own search
  // shadow is the only thing that can route grep/glob (that is the fix).
  await row.attachA5sfNativeToolModules(mounted, world.agentCtx, row.a5sfRealmConfigOf(config))
  return mounted
}

function toolNames(world) {
  return world.root.tools.schemas(world.agentKey).map((schema) => schema.name)
}

function schemaOf(world, name) {
  return world.root.tools.get(name, world.agentKey)
}

async function dispatch(world, name, args) {
  const settled = await world.root.tools.execute({
    signal: new AbortController().signal,
    callId: `a5sf-pd16-${name}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    arguments: args,
    agent: world.agentKey,
  })
  const text = Array.isArray(settled.content)
    ? settled.content.map((part) => (part?.type === 'text' ? part.text : '')).join('')
    : ''
  return { isError: settled.isError === true, text, value: settled.value }
}

async function factsOf(world) {
  if (!existsSync(world.sinkPath)) return []
  return readGuardConsultFile(world.sinkPath)
}

function naming(facts, locator) {
  return facts.filter((fact) => fact.locator === locator)
}

// --- kernel requirement -----------------------------------------------------

/**
 * `A` arms need the Landlock `content-read` leg ENFORCED (a real in-lane
 * search must actually run). `D` arms are decided BEFORE any process and do
 * not. When the host cannot enforce it the A arms are SKIPPED, never reported
 * green (the `a5sf-os-runner.test.ts` precedent).
 */
const ENFORCED = await (async () => {
  const probe = createConfinedProcessProvider({
    realmId: 'probe-pd16',
    trustRoot: `sha256:${LAUNCHER_SHA.slice(0, 16)}#${LAUNCHER}`,
    scratchRoot: join(tmpdir(), `a5sf-pd16-probe-${process.pid}`),
    assembly: { launcherPath: LAUNCHER, launcherSha256: LAUNCHER_SHA, minAbiVersion: 3 },
  })
  const probed = await probe.probe()
  return probed.ok === true
    && probed.value?.some((entry) => entry.dimension === 'content-read' && entry.level === 'enforced') === true
})()
const SKIP_A = ENFORCED ? false : 'the Landlock content-read leg is not enforced on this host'

// ===========================================================================
// P0 — THE DEFECT PIN (pre-fix behaviour). RED on the fixed tree by design.
// ===========================================================================
test('P0 PD-16 defect pin (PRE-FIX): the Member grep reads the lane-denied secret by parent path AND by absolute path, with no guard fact naming it', { skip: !PIN }, async () => {
  const world = await makeWorld('pin')
  const mounted = await mountAndAttach(world)
  try {
    const byParent = await dispatch(world, 'grep', { pattern: OUTLANE_NEEDLE, path: '..' })
    // THE OLD BEHAVIOUR, asserted verbatim. On the fixed tree the shadow's
    // confined face refuses this root, so this arm goes RED — the flip is the
    // evidence, not a regression.
    assert.equal(byParent.isError, false, 'PRE-FIX: grep {path:".."} executed')
    assert.match(byParent.text, new RegExp(OUTLANE_NEEDLE, 'u'), 'PRE-FIX: the parent search returned the lane-denied bytes')
    const byAbsolute = await dispatch(world, 'grep', { pattern: OUTLANE_NEEDLE, path: world.outOfLane })
    assert.equal(byAbsolute.isError, false, 'PRE-FIX: grep {path:<absolute out-of-lane>} executed')
    assert.match(byAbsolute.text, new RegExp(OUTLANE_NEEDLE, 'u'), 'PRE-FIX: the absolute search returned the lane-denied bytes')
    assert.deepEqual(await factsOf(world), [], 'PRE-FIX: zero guard facts — the read lane was never consulted')
    assert.equal(world.confined.calls.length, 0, 'PRE-FIX: the confined face was never reached')
  } finally {
    await mounted.dispose()
  }
})

// ===========================================================================
// D — the fix: the confined face refuses the out-of-lane root before any spawn
// ===========================================================================
test('D1 fix (parent path): grep {path:".."} is a typed refusal, 0 confined calls, 0 secret bytes, 1 deny fact', async () => {
  const world = await makeWorld('d1')
  const mounted = await mountAndAttach(world)
  try {
    const before = { base: BaseSubprocess.calls, confined: world.confined.calls.length }
    const outcome = await dispatch(world, 'grep', { pattern: OUTLANE_NEEDLE, path: '..' })
    assert.equal(world.confined.calls.length, before.confined, 'no confined process was asked for')
    assert.equal(BaseSubprocess.calls, before.base, 'the inherited base service was never reached')
    assert.equal(outcome.isError, true, 'the search failed instead of answering')
    assert.doesNotMatch(outcome.text, new RegExp(OUTLANE_NEEDLE, 'u'), 'no out-of-lane byte reached the model')
    const facts = await factsOf(world)
    const denials = facts.filter((fact) => fact.decision === 'deny')
    assert.equal(denials.length, 1, 'exactly one deny fact')
    assert.equal(denials[0].method, 'spawn')
    assert.equal(denials[0].decidedBy, 'IO_READ_DENIED')
    assert.equal(denials[0].realm, 'member')
    assert.equal(denials[0].memberIdentity, IDENTITY.memberInstanceId)
    // The locator is the RESOLVED parent of the workspace, not the raw token.
    assert.equal(denials[0].locator, dirname(world.workspace))
  } finally {
    await mounted.dispose()
  }
})

test('D2 fix (absolute path): grep {path:<out-of-lane dir>} is refused the same way', async () => {
  const world = await makeWorld('d2')
  const mounted = await mountAndAttach(world)
  try {
    const before = { base: BaseSubprocess.calls, confined: world.confined.calls.length }
    const outcome = await dispatch(world, 'grep', { pattern: OUTLANE_NEEDLE, path: world.outOfLane })
    assert.equal(world.confined.calls.length, before.confined, 'no confined process was asked for')
    assert.equal(BaseSubprocess.calls, before.base, 'the inherited base service was never reached')
    assert.equal(outcome.isError, true)
    assert.doesNotMatch(outcome.text, new RegExp(OUTLANE_NEEDLE, 'u'))
    const denials = (await factsOf(world)).filter((fact) => fact.decision === 'deny')
    assert.equal(denials.length, 1)
    assert.equal(denials[0].locator, world.outOfLane)
    assert.equal(denials[0].decidedBy, 'IO_READ_DENIED')
  } finally {
    await mounted.dispose()
  }
})

test('D3 fix (glob): glob {path:<out-of-lane dir>} is refused by the same confined face', async () => {
  const world = await makeWorld('d3')
  const mounted = await mountAndAttach(world)
  try {
    const before = { base: BaseSubprocess.calls, confined: world.confined.calls.length }
    const outcome = await dispatch(world, 'glob', { pattern: '**/*.txt', path: world.outOfLane })
    assert.equal(world.confined.calls.length, before.confined, 'no confined process was asked for')
    assert.equal(BaseSubprocess.calls, before.base, 'the inherited base service was never reached')
    assert.equal(outcome.isError, true)
    assert.doesNotMatch(outcome.text, /secret-out-of-lane/u, 'no out-of-lane path was listed')
    const denials = (await factsOf(world)).filter((fact) => fact.decision === 'deny')
    assert.equal(denials.length, 1)
    assert.equal(denials[0].locator, world.outOfLane)
    assert.equal(denials[0].decidedBy, 'IO_READ_DENIED')
  } finally {
    await mounted.dispose()
  }
})

// ===========================================================================
// A — the allow lane still works, through the confined face
// ===========================================================================
test('A1 allow: an in-lane grep finds the needle through the confined face and never reaches the inherited service', { skip: SKIP_A }, async () => {
  const world = await makeWorld('a1')
  const mounted = await mountAndAttach(world)
  try {
    const before = { base: BaseSubprocess.calls, confined: world.confined.calls.length }
    const outcome = await dispatch(world, 'grep', { pattern: INLANE_NEEDLE, path: world.workspace })
    assert.equal(outcome.isError, false, outcome.text)
    assert.match(outcome.text, /Found 2 matches/u)
    assert.match(outcome.text, /in-lane\.txt/u)
    assert.match(outcome.text, /sub\/nested\.txt/u)
    assert.doesNotMatch(outcome.text, new RegExp(OUTLANE_NEEDLE, 'u'))
    assert.ok(world.confined.calls.length > before.confined, 'the confined provider ran the search')
    assert.equal(BaseSubprocess.calls, before.base, 'the inherited base service was never reached')
    const facts = await factsOf(world)
    const allowed = facts.filter((fact) => fact.decision === 'allow')
    assert.equal(allowed.length, 1, 'exactly one allow fact for the one declared root')
    assert.equal(allowed[0].locator, world.workspace)
    assert.equal(allowed[0].method, 'spawn')
  } finally {
    await mounted.dispose()
  }
})

test('A2 exit-code fidelity: no-match (exit 1) is not an error, an invalid pattern (exit 2) is', { skip: SKIP_A }, async () => {
  const world = await makeWorld('a2')
  const mounted = await mountAndAttach(world)
  try {
    const noMatch = await dispatch(world, 'grep', { pattern: ABSENT_NEEDLE, path: world.workspace })
    assert.equal(noMatch.isError, false, 'exit 1 must survive as "no matches", not as a failure')
    assert.match(noMatch.text, /No matches found/u)
    const invalid = await dispatch(world, 'grep', { pattern: 'A5SF_PD16_[unclosed', path: world.workspace })
    assert.equal(invalid.isError, true, 'exit 2 must be a failure')
    assert.match(invalid.text, /rejected by ripgrep|search failed/iu)
    assert.notEqual(noMatch.text, invalid.text)
  } finally {
    await mounted.dispose()
  }
})

test('A3 lane-safe ignore discovery: an out-of-lane ancestor turns .gitignore discovery off, with the disclosure on the allow fact', { skip: SKIP_A }, async () => {
  const world = await makeWorld('a3')
  const mounted = await mountAndAttach(world)
  try {
    const outcome = await dispatch(world, 'grep', { pattern: IGNORED_NEEDLE, path: world.workspace })
    assert.equal(outcome.isError, false, outcome.text)
    // The lane cannot read the ancestors, so the face added the two flags: the
    // ignored file IS searched (and the foot-gun is disclosed, not hidden).
    assert.match(outcome.text, /ignored\.txt/u)
    const allowed = (await factsOf(world)).filter((fact) => fact.decision === 'allow')
    assert.equal(allowed.length, 1)
    assert.deepEqual(allowed[0].annotations, SEARCH_IGNORE_DISCOVERY_NOTES)
  } finally {
    await mounted.dispose()
  }
})

test('A4 ignore semantics kept where they can be: a valid in-lane repository root keeps .gitignore, no disclosure', { skip: SKIP_A }, async () => {
  // The lane covers the workspace AND its valid repository root, and no
  // `.git` FILE sits above it: rg's discovery is contained, so the shipped
  // argv is kept and ordinary .gitignore semantics survive.
  const world = await makeWorld('a4')
  const laneRoot = dirname(world.workspace)
  mkdirSync(join(laneRoot, '.git', 'objects'), { recursive: true })
  writeFileSync(join(laneRoot, '.git', 'HEAD'), 'ref: refs/heads/main\n', 'utf8')
  const readRoots = [world.workspace, laneRoot]
  world.provider = () => ({
    compiledFor: () => ({
      members: [{ identity: IDENTITY, policy: { ok: true, value: policyFor(world.workspace) } }],
      providerClass: TestFileSystem,
      subprocess: {
        effective: effectiveOf(readRoots),
        provider: world.confined,
        realmId: `realm-${world.label}`,
        bindingId: 'dsh.search/grep',
        memberScope: IDENTITY.memberInstanceId,
        providerClass: BaseSubprocess,
      },
    }),
  })
  const mounted = await mountAndAttach(world)
  try {
    const outcome = await dispatch(world, 'grep', { pattern: IGNORED_NEEDLE, path: world.workspace })
    assert.equal(outcome.isError, false, outcome.text)
    assert.match(outcome.text, /No matches found/u, '.gitignore is honoured when discovery stays in the lane')
    const allowed = (await factsOf(world)).filter((fact) => fact.decision === 'allow')
    assert.equal(allowed.length, 1)
    assert.equal(allowed[0].annotations, undefined, 'no disclosure: the flags were not needed')
  } finally {
    await mounted.dispose()
  }
})

test('A5 glob allow: an in-lane glob lists the workspace through the same confined face', { skip: SKIP_A }, async () => {
  const world = await makeWorld('a5')
  const mounted = await mountAndAttach(world)
  try {
    const before = { base: BaseSubprocess.calls, confined: world.confined.calls.length }
    const outcome = await dispatch(world, 'glob', { pattern: '**/*.txt', path: world.workspace })
    assert.equal(outcome.isError, false, outcome.text)
    assert.match(outcome.text, /in-lane\.txt/u)
    assert.match(outcome.text, /sub\/nested\.txt/u)
    assert.doesNotMatch(outcome.text, /secret-out-of-lane/u)
    assert.ok(world.confined.calls.length > before.confined)
    assert.equal(BaseSubprocess.calls, before.base)
    const allowed = (await factsOf(world)).filter((fact) => fact.decision === 'allow')
    assert.equal(allowed.length, 1)
    assert.equal(allowed[0].locator, world.workspace)
  } finally {
    await mounted.dispose()
  }
})

test('A6 lane-safe discovery under a worktree `.git` FILE above the lane: the in-lane search succeeds and the flags are disclosed', { skip: SKIP_A }, async () => {
  // THE MEASURED BOOT SHAPE (PD-16 DEV-LIVE, boot 1): the workspace carries the
  // recon fixture's `.git` DIRECTORY (no HEAD) and a `.worktrees/`-style
  // `.git` FILE sits above the lane. rg opens that file, the kernel denies the
  // open, and rg exits 2 after already finding the answer. The lane-safe
  // rewrite must recognise this and make the invocation self-contained — and
  // say so on the allow fact.
  const world = await makeWorld('a6', { ancestorGitFile: true, emptyWorkspaceGit: true })
  const mounted = await mountAndAttach(world)
  try {
    const hit = await dispatch(world, 'grep', { pattern: INLANE_NEEDLE, path: world.workspace })
    assert.equal(hit.isError, false, `the search must not die on a lane-denied ancestor .git: ${hit.text}`)
    assert.match(hit.text, /Found 2 matches/u)
    assert.doesNotMatch(hit.text, new RegExp(OUTLANE_NEEDLE, 'u'), 'no out-of-lane byte')
    // The flags really took effect: the `.gitignore`d file is now searched.
    const ignored = await dispatch(world, 'grep', { pattern: IGNORED_NEEDLE, path: world.workspace })
    assert.equal(ignored.isError, false, ignored.text)
    assert.match(ignored.text, /ignored\.txt/u, 'the VCS-ignore removal is observable, not just declared')
    const allowed = (await factsOf(world)).filter((fact) => fact.decision === 'allow')
    assert.equal(allowed.length, 2)
    for (const fact of allowed) assert.deepEqual(fact.annotations, SEARCH_IGNORE_DISCOVERY_NOTES, 'the removed ignore semantics are disclosed on every allow fact')
  } finally {
    await mounted.dispose()
  }
})

// ===========================================================================
// S1 — surface neutral
// ===========================================================================
test('S1 surface neutral: same tool names, byte-identical grep/glob parameter schemas, after the shadow', async () => {
  const world = await makeWorld('s1')
  const before = toolNames(world)
  const beforeGrep = schemaOf(world, 'grep')
  const beforeGlob = schemaOf(world, 'glob')
  assert.ok(before.includes('grep') && before.includes('glob'))
  const mounted = await mountAndAttach(world)
  try {
    assert.deepEqual(toolNames(world), before, 'the attach may not add or remove a name')
    const afterGrep = schemaOf(world, 'grep')
    const afterGlob = schemaOf(world, 'glob')
    assert.notEqual(afterGrep, beforeGrep, 'grep WAS shadowed (a new definition, not the preset one)')
    assert.notEqual(afterGlob, beforeGlob, 'glob WAS shadowed')
    assert.deepEqual(afterGrep.parameters, beforeGrep.parameters, 'grep parameters are byte-identical')
    assert.deepEqual(afterGlob.parameters, beforeGlob.parameters, 'glob parameters are byte-identical')
    assert.equal(afterGrep.name, 'grep')
    assert.equal(afterGlob.name, 'glob')
  } finally {
    await mounted.dispose()
  }
})

// ===========================================================================
// C1 — control: remove the shadow and the leak comes back
// ===========================================================================
test('C1 control (shadow removed): the ungoverned path returns the lane-denied bytes again', async () => {
  const world = await makeWorld('c1')
  const mounted = await mountAndAttach(world)
  try {
    await mounted.disposeNativeToolModules()
    const before = world.confined.calls.length
    const outcome = await dispatch(world, 'grep', { pattern: OUTLANE_NEEDLE, path: world.outOfLane })
    assert.equal(world.confined.calls.length, before, 'the confined face is gone with the shadow')
    assert.match(outcome.text, new RegExp(OUTLANE_NEEDLE, 'u'), 'the preset definition reads the lane-denied file')
  } finally {
    await mounted.dispose()
  }
})
