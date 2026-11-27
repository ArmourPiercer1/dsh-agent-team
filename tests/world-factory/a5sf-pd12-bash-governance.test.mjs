/**
 * a5sf-pd12-bash-governance.test.mjs — PD-12: a Member's model-visible `bash`
 * must reach the CONFINED `subprocess` face, so the compiled ceiling's network
 * term is actually consulted.
 *
 * WHAT THIS SUITE PINS TODAY (host-free; in-process Cordis roots, no boot, no
 * DSH_HOME, no pinned host tree):
 *
 *   P0  THE DEFECT PIN (env-gated). On the PRE-FIX tree the same world ran
 *       `bash` on the preset's inherited executor while the confined provider
 *       was called ZERO times; the gate skips it unless `A5SF_PD12_PIN=1`.
 *       RETIRED-BY-A0 (round 80): its "fixed" counterpart (D1) retired with the
 *       appended shadow, so the pin now records the post-cut behaviour only.
 *   S1  SURFACE NEUTRAL: the model-visible name set is unchanged (one `bash`,
 *       no added/removed names) across the attach.
 *   C2  CONTROL — a realm that owns NO confined face is not shadowed: `bash`
 *       runs on the preset executor and the confined provider is called 0
 *       times.
 *   RETIRED-BY-A0  the five arms whose subject was the APPENDED confined-`bash`
 *       shadow (D1, A1, A2, C1, C4). See the retirement pin at the end of this
 *       file for the subject, the citation and the named successors. Nothing
 *       was skipped and no retired expectation was kept as green.
 *
 * Run: node --test tests/world-factory/a5sf-pd12-bash-governance.test.mjs
 * Pin:  A5SF_PD12_PIN=1 node --test tests/world-factory/a5sf-pd12-bash-governance.test.mjs
 */
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire, register } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { PassThrough } from 'node:stream'
import test, { after } from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = join(HERE, '..', '..')
const PIN = process.env.A5SF_PD12_PIN === '1'

/** The repo's EXISTING TS-under-plain-node hooks (no new loader). */
register(pathToFileURL(join(REPO_ROOT, 'scripts', 'run-tests-hooks.mjs')).href)

const row = await import(pathToFileURL(join(REPO_ROOT, 'packages', 'runtime', 'src', 'plugin', 'live', 'a5sf-realm-row.mjs')).href)
const runtimeRequire = createRequire(join(REPO_ROOT, 'packages', 'runtime', 'package.json'))
const { Context, Service } = await import(pathToFileURL(runtimeRequire.resolve('@deepseek-ai/cordis')).href)
const ToolRuntime = (await import(pathToFileURL(runtimeRequire.resolve('@deepseek-ai/dsh-tools')).href)).default
const SystemPrompt = (await import(pathToFileURL(runtimeRequire.resolve('@deepseek-ai/dsh-system-prompt')).href)).default
const { createScope, bindScopeParent } = await import(pathToFileURL(runtimeRequire.resolve('@deepseek-ai/dsh-scope')).href)

// --- fixtures ---------------------------------------------------------------

const IDENTITY = Object.freeze({
  teamId: 'team-a5sf-pd12',
  memberInstanceId: 'member-pd12-a',
  templateId: 'worker',
  instanceGeneration: 1,
})
const REVISION = 'a5sf-pd12:member-pd12-a:g1'
const PROGRAM = '/bin/bash'

const dirs = []
function tracked(dir) {
  dirs.push(dir)
  return dir
}
after(() => {
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true })
})

function makeWorkspace(label) {
  const dir = tracked(mkdtempSync(join(tmpdir(), `a5sf-pd12-${label}-`)))
  const workspace = join(dir, 'workspace')
  mkdirSync(workspace, { recursive: true })
  writeFileSync(join(workspace, 'in-lane.txt'), 'in lane\n', 'utf8')
  return { dir, workspace }
}

function lane(allow) {
  return Object.freeze({ mode: 'restricted', allow: Object.freeze([...allow]), ask: Object.freeze([]), deny: Object.freeze([]) })
}

/** The compiled Member ceiling. `network` omitted = no network axis at all. */
function policyFor(workspace, network) {
  return Object.freeze({
    memberIdentity: IDENTITY.memberInstanceId,
    templateId: IDENTITY.templateId,
    instanceGeneration: IDENTITY.instanceGeneration,
    revision: REVISION,
    read: lane([workspace]),
    write: lane([workspace]),
    ...(network === undefined ? {} : { network: Object.freeze({ access: network }) }),
  })
}

function effectiveFor(workspace, network) {
  return Object.freeze({
    memberIdentity: IDENTITY.memberInstanceId,
    toolBindingIdentity: 'dsh.subprocess/exec',
    invocationId: 'a5sf-pd12:exec',
    policyRevision: REVISION,
    read: lane([workspace]),
    write: lane([workspace]),
    ...(network === undefined ? {} : { network: Object.freeze({ access: network }) }),
  })
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
  async readText() { return '' }
  async readBytes() { return Buffer.alloc(0) }
  async readByteRange() { return Buffer.alloc(0) }
  async streamText() { return (async function* empty() {})() }
  async listDir() { return [] }
  async stat() { return { lstat: { size: 0, mtimeMs: 0, mode: 0o644 } } }
  async lstat() { return { size: 0, mtimeMs: 0, mode: 0o644 } }
  async watch() { return async () => {} }
  async writeText() { return { version: 'v1' } }
  async editText() { return { version: 'v2' } }
}

/**
 * The INHERITED base `subprocess` service — the pre-fix path (`SandboxBashExecutor`
 * over the base service). It records every spawn so "the preset executor ran"
 * is a measurement, not an inference.
 */
class TestSubprocess extends Service {
  constructor(ctx, config = {}) {
    super(ctx, 'subprocess')
    this.spawns = config.spawns ?? []
  }
  spawn(spec) {
    this.spawns.push({ argv: [...(spec?.argv ?? [])], cwd: String(spec?.cwd ?? ''), service: 'base' })
    return fakeHandle({ stdout: String(spec?.argv?.[2] ?? 'BASE-EXECUTOR\n'), code: 0 })
  }
  async spawnStreaming(spec) {
    this.spawns.push({ argv: [...(spec?.argv ?? [])], cwd: String(spec?.cwd ?? ''), service: 'base' })
    return { ok: true, value: fakeStreamProcess({ stdout: String(spec?.argv?.[2] ?? 'BASE-EXECUTOR\n'), code: 0 }) }
  }
}

function fakeStreamProcess({ stdout = '', stderr = '', code = 0 }) {
  const stdin = new PassThrough()
  const out = new PassThrough()
  const err = new PassThrough()
  const exited = Promise.resolve({ code, signal: null })
  const payloadExit = (async () => {
    await new Promise((resolve) => setImmediate(resolve))
    out.write(stdout)
    out.end()
    err.write(stderr)
    err.end()
    return { form: 'recorded', rc: code }
  })()
  return {
    pid: 4242,
    stdin,
    stdout: out,
    stderr: err,
    exited,
    terminate: async () => {},
    payloadExit,
  }
}

function fakeHandle({ stdout = '', stderr = '', code = 0 }) {
  const handle = fakeStreamProcess({ stdout, stderr, code })
  return {
    stdin: handle.stdin,
    stdout: handle.stdout,
    stderr: handle.stderr,
    collected: {
      stdout: { readFrom: () => ({ text: stdout }) },
      stderr: { readFrom: () => ({ text: stderr }) },
    },
    done: Promise.resolve({ exitCode: code, signal: null }),
    terminate() {},
    waitForExit: async () => true,
  }
}

/**
 * The confined process provider DOUBLE: counts every call, records the request
 * (argv/cwd/networkProfile) and answers a recorded exit. It is the only place
 * a "process" could exist in this suite, so a denial that never calls it is
 * measured zero-process.
 */
function makeConfinedProvider({ level = 'unsupported' } = {}) {
  const calls = []
  return {
    calls,
    async spawnStreaming(request) {
      calls.push({
        argv: [...(request?.argv ?? [])],
        cwd: String(request?.cwd ?? ''),
        networkProfile: request?.networkProfile ?? null,
      })
      return { ok: true, value: fakeStreamProcess({ stdout: 'CONFINED-EXECUTOR\n', code: 0 }) }
    },
    async probe() {
      return { ok: true, value: [{ dimension: 'network-destination', level, note: `double reports ${level}` }] }
    },
  }
}

/**
 * The PRESET's own `bash` row (the pre-fix product path): a model-visible
 * `bash` whose body resolves the inherited `ctx.subprocess` service, exactly
 * the shape `@deepseek-ai/dsh-tool-bash` -> `ctx.shell` -> `bash-sandbox`
 * collapses to for this measurement.
 */
function presetBashPlugin() {
  return {
    name: 'fixture-preset-bash',
    inject: ['tools', 'subprocess'],
    apply(ctx) {
      ctx.tools.register({
        name: 'bash',
        description: 'PRESET bash (inherited executor) — the pre-fix product path',
        parameters: {
          type: 'object',
          properties: {
            command: { type: 'string' },
            description: { type: 'string' },
            workdir: { type: 'string' },
          },
          required: ['command', 'description'],
          additionalProperties: false,
        },
        output: { schema: { type: 'string' }, render: (_args, value) => [{ type: 'text', text: String(value) }] },
        async execute(args) {
          const cwd = String(args?.workdir ?? process.cwd())
          const handle = ctx.subprocess.spawn({
            argv: ['bash', '-c', String(args?.command ?? '')],
            cwd,
            stdio: { stdin: 'ignore', stdout: { maxBytes: 1 << 18 }, stderr: { maxBytes: 1 << 18 } },
            graceMs: 5_000,
          })
          const settled = await handle.done
          const stdout = handle.collected?.stdout?.readFrom(0)?.text ?? ''
          return JSON.stringify({ executor: 'preset', exitCode: settled?.exitCode ?? null, stdout })
        },
      })
    },
  }
}

function presetTopology(root) {
  const standingKey = {}
  const standing = createScope(root, standingKey)
  const agentKey = {}
  const agent = createScope(root, agentKey)
  bindScopeParent(agentKey, standingKey)
  return { standing, agentKey, agentCtx: agent.ctx }
}

async function makeWorld(label, { face = true, shellClass = true, network = 'allow', level = 'unsupported' } = {}) {
  const { workspace } = makeWorkspace(label)
  const root = new Context()
  await root.plugin(SystemPrompt)
  await root.plugin(ToolRuntime)
  const baseSpawns = []
  await root.plugin(TestFileSystem, {})
  await root.plugin(TestSubprocess, { spawns: baseSpawns })
  const { standing, agentKey, agentCtx } = presetTopology(root)
  await standing.ctx.plugin(presetBashPlugin())
  const confined = makeConfinedProvider({ level })
  const provider = {
    compiledFor: () => ({
      members: [{ identity: IDENTITY, policy: { ok: true, value: policyFor(workspace, network) } }],
      providerClass: TestFileSystem,
      ...(face
        ? {
            subprocess: {
              effective: effectiveFor(workspace, network),
              provider: confined,
              realmId: 'member:member-pd12-a',
              bindingId: 'dsh.subprocess/exec',
              memberScope: IDENTITY.memberInstanceId,
              providerClass: TestSubprocess,
              ...(shellClass ? { shellClass: Object.freeze({ programs: Object.freeze(['bash']) }) } : {}),
            },
          }
        : {}),
    }),
  }
  return {
    root,
    agentKey,
    agentCtx,
    workspace,
    baseSpawns,
    confined,
    mount: () => row.mountMemberA5sfRealm({
      root: agentCtx,
      a5sfConfig: row.a5sfRealmConfigOf({ a5sfEvidencePath: join(workspace, '..', `consult-${label}.jsonl`) }),
      provider: () => provider,
      member: { sessionId: 'session-pd12', instanceId: IDENTITY.memberInstanceId, teamRootSessionId: 'team-root', templateId: IDENTITY.templateId },
    }),
  }
}

function toolNames(root, scope) {
  return root.tools.schemas(scope).map((schema) => schema.name)
}

async function dispatch(root, agent, name, args) {
  const settled = await root.tools.execute({
    signal: new AbortController().signal,
    callId: `a5sf-pd12-${name}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    arguments: args,
    agent,
  })
  const text = Array.isArray(settled.content)
    ? settled.content.map((part) => (part?.type === 'text' ? part.text : '')).join('')
    : ''
  return { isError: settled.isError === true, text, value: settled.value }
}

/** Shared: mount, attach, and answer the post-attach surface + handle. */
async function mountAndAttach(world, config = {}) {
  const mounted = await world.mount()
  assert.ok(mounted !== undefined, 'the configured row must mount a realm')
  await row.attachA5sfNativeToolModules(mounted, world.agentCtx, row.a5sfRealmConfigOf(config))
  return mounted
}

// ===========================================================================
// P0 — THE DEFECT PIN (pre-fix behaviour). RED on the fixed tree by design.
// ===========================================================================
test('P0 PD-12 defect pin (PRE-FIX): deny bash executes on the preset executor; confined provider 0 calls', { skip: !PIN }, async () => {
  const world = await makeWorld('pin', { network: 'deny' })
  const mounted = await mountAndAttach(world, { a5sfEvidencePath: join(world.workspace, '..', 'pin.jsonl') })
  try {
    const before = { base: world.baseSpawns.length, confined: world.confined.calls.length }
    const result = await dispatch(world.root, world.agentKey, 'bash', {
      command: 'printf A5SF_PD12_PIN',
      description: 'Exercise the pre-fix bash path',
      workdir: world.workspace,
    })
    const after = { base: world.baseSpawns.length, confined: world.confined.calls.length }
    // THE OLD BEHAVIOUR, asserted verbatim. On the fixed tree the shadow
    // serves this call, so `isError` is true and the confined provider is
    // called: this arm goes RED (that flip is the evidence, not a regression).
    assert.equal(result.isError, false, 'PRE-FIX: the deny Member\'s bash executed')
    assert.match(result.text, /A5SF_PD12_PIN/u, 'PRE-FIX: stdout carried the marker')
    assert.equal(after.base - before.base, 1, 'PRE-FIX: the inherited base executor served the call')
    assert.equal(after.confined - before.confined, 0, 'PRE-FIX: the confined provider was never called')
  } finally {
    await mounted.dispose()
  }
})

// ===========================================================================
// S1 — the surface stays neutral.
// ===========================================================================
test('S1 surface neutral: exactly one `bash`, same name set before and after the shadow', async () => {
  const world = await makeWorld('surface', { network: 'allow' })
  const before = toolNames(world.root, world.agentKey)
  assert.deepEqual(before, ['bash'], 'the preset plane exposes one bash')
  const mounted = await mountAndAttach(world, { a5sfEvidencePath: join(world.workspace, '..', 'surface.jsonl') })
  try {
    assert.deepEqual(toolNames(world.root, world.agentKey), before, 'the shadow replaces the definition, never the name set')
  } finally {
    await mounted.dispose()
  }
})

// ===========================================================================
// C2 — no confined face: no shadow, the pre-fix shape (permanent contrast).
// ===========================================================================
test('C2 control (no confined face): bash is NOT shadowed and runs on the preset executor', async () => {
  const world = await makeWorld('no-face', { face: false, network: 'deny' })
  const mounted = await world.mount()
  try {
    const surface = toolNames(world.root, world.agentKey)
    assert.deepEqual(surface, ['bash'])
    await row.attachA5sfNativeToolModules(mounted, world.agentCtx, row.a5sfRealmConfigOf({ a5sfEvidencePath: join(world.workspace, '..', 'no-face.jsonl') }))
    const result = await dispatch(world.root, world.agentKey, 'bash', {
      command: 'printf A5SF_PD12_NO_FACE',
      description: 'Exercise the face-less path',
      workdir: world.workspace,
    })
    assert.equal(result.isError, false, 'no confined face => nothing to route to, so the preset path remains')
    assert.equal(world.confined.calls.length, 0, 'the provider double was never built/called')
  } finally {
    await mounted.dispose()
  }
})

// ===========================================================================
// RETIRED-BY-A0 (round 80) — the appended confined-`bash` shadow
// ===========================================================================
// WHAT WAS HERE. Five arms (D1, A1, A2, C1, C4) mounted a realm and called
// `attachA5sfNativeToolModules`, expecting it to APPEND a Team-authored
// confined-`bash` shadow (`confinedBashSpecOf`) that re-implemented the
// model-visible `bash` over the realm's confined `subprocess` face:
//   D1  deny bash refused with NETWORK_UNCONFINED_REALM, 0 provider calls;
//   A1  allow bash served by the confined face end to end;
//   A2  no network axis => the same world allows;
//   C1  the control: with the shadow disposed, deny bash runs on the preset executor;
//   C4  without a declared shell class the refusal is SUBPROCESS_SHELL_NOT_DECLARED.
//
// WHY THEY ARE RETIRED (per SUBJECT, never "the check was red").
//   subject:   the appended confined-`bash` shadow — `confinedBashSpecOf` and the
//              `live/confined-bash-tool.mjs` module it named.
//   citation:  commit 5d1349767 ("refactor(ute-a1): re-point the surviving
//              referrers and the kept-capability tests") deleted that spec
//              function and its module, together with the identical appends for
//              the terminal, search, fs and web faces, because a Team-authored
//              shadow definition is exactly what the A1 cut forbids: the
//              composition supplies its native module specs and
//              `attachA5sfNativeToolModules` appends no tool of its own. The law
//              survives verbatim at
//              `packages/runtime/src/plugin/live/a5sf-realm-row.mjs:1164-1180`
//              ("The two SERVICE-layer restorations that are not tool copies
//              stay"). The process FAMILY contribution is booked per subject in
//              `dev/agent-workflow/ledgers/ute-cut-closure.allow.json`
//              `#retiredSurfaces[dsh.process-family]`, whose own citations are
//              the reviewed inventory (`01-ASSET-INVENTORY.md` §family-process),
//              the keep/delete decision (`03-RETIRE-KEEP.md`) and the round-72
//              per-file record.
//   successor: `tests/ute-g1-fs/lane-suite.test.mjs` (the one route-C lane that
//              still reproduces its golden post-cut: 5/5) and
//              `packages/runtime/test/vnext-admission.test.mjs` (the
//              `ute-vnext-a1` CI leg: the ONE admission point a governed
//              Member's tools pass through). The governed shell's replacement
//              backend — the HOST's own persistent-`bash` definition over a
//              Member-bound PTY — is pinned by
//              `tests/world-factory/a5sf-native-bash-preservation.test.mjs`.
//              NOT a successor: `tests/ute-g1-process/lane-suite.test.mjs`. It
//              is the process lane's OLD-path world and it mounts the same
//              deleted append (`lib/world.mjs:361`), so it is red at this head;
//              citing it as a guarantee would be a citation to a red instrument
//              (ROUND80-CI-CLOSURE.md §3.6 owns that disposition).
//
// WHAT THIS PIN STILL ENFORCES. A resurrection is RED, not silent: the three
// retired spec functions must stay absent from the row, the attach must append
// no tool of its own, and every successor must still exist on disk. Nothing
// below asserts the retired behaviour as expected, and no arm was skipped.
test('RETIRED-BY-A0: the appended confined-bash shadow stays gone and its successors exist', async () => {
  for (const name of ['confinedBashSpecOf', 'confinedTerminalSpecOf', 'nativeBashPtySpecOf']) {
    assert.equal(row[name], undefined, `${name} was retired with the A0/A1 cut; restoring it rebuilds a Team-authored shadow, which A1 forbids`)
  }
  const world = await makeWorld('retired', { network: 'deny' })
  const mounted = await world.mount()
  try {
    const before = toolNames(world.root, world.agentKey)
    assert.deepEqual(before, ['bash'], 'the preset plane still exposes the one `bash` name')
    const appended = await row.attachA5sfNativeToolModules(
      mounted,
      world.agentCtx,
      row.a5sfRealmConfigOf({ a5sfEvidencePath: join(world.workspace, '..', 'retired.jsonl') }),
    )
    assert.equal(appended, undefined, 'with no configured native module the attach appends NOTHING (the appending mechanism is gone)')
    assert.deepEqual(toolNames(world.root, world.agentKey), before, 'and it changes no model-visible name')
    assert.equal(world.baseSpawns.length, 0, 'the attach itself spawns nothing')
    assert.equal(world.confined.calls.length, 0, 'the attach itself consults no confined face')
  } finally {
    await mounted.dispose()
  }
  for (const rel of [
    'tests/ute-g1-fs/lane-suite.test.mjs',
    'packages/runtime/test/vnext-admission.test.mjs',
    'tests/world-factory/a5sf-native-bash-preservation.test.mjs',
  ]) {
    assert.ok(existsSync(join(REPO_ROOT, rel)), `successor ${rel} must exist — a retirement without a target is a silence`)
  }
})
