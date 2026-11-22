/**
 * a5sf-pd13-terminal-read-axis.test.mjs — PD-13: a Member's shell has no read
 * axis, because the terminal path never consults the compiled lane.
 *
 * WHAT THIS SUITE PINS (host-free; in-process Cordis roots, no boot, no
 * DSH_HOME, no pinned host tree, no real PTY):
 *
 * WHAT THIS SUITE PINS TODAY (host-free; in-process Cordis roots, no boot, no
 * DSH_HOME, no pinned host tree, no real PTY):
 *
 *   P0  THE DEFECT PIN (env-gated). The pre-fix world ran the shell command on
 *       the confined `subprocess` face, whose read admission is DECLARED-ROOT
 *       based, so a body `cat` of a lane-denied path returned the bytes with no
 *       guard fact; `A5SF_PD13_PIN=1` re-enables the pin. RETIRED-BY-A0 (round
 *       80): its "fixed" counterpart (D1) retired with the appended shadow, so
 *       the pin now records the post-cut behaviour only.
 *   S1  SURFACE NEUTRAL: the model-visible name set is unchanged (one `bash`).
 *   C2  CONTROL — a realm with the confined `subprocess` face but NO terminal
 *       face answers `faces.terminals === null`, the attach stays
 *       surface-neutral and it routes nothing (0 confined calls, 0 read facts).
 *   C3  CONTROL — a terminal face declared without a confined `subprocess` face
 *       is refused at install (`TERMINALS_UNCONFINED_REALM`): the face cannot
 *       run a command and never falls back to the inherited shell.
 *   C4  CONTROL — DOUBLE TERMINAL: a preset that mounts the legacy `terminals`
 *       service alongside the confined face is REFUSED
 *       (`TERMINALS_DOUBLE_TERMINAL_REFUSED`) with ZERO legacy allocations.
 *       The Member never holds a governed and an ungoverned shell at once.
 *   C5  CONTROL — no declared shell class on the subprocess face: the terminal
 *       face refuses at install, because its commands could never be admitted.
 *   C6  DECLARED WEAKNESS — a DYNAMIC read (`$(...)`/backticks) is not
 *       lexically attributable and is NOT refused at admission; it is the OS
 *       profile's problem. Pinned so the limit cannot be quietly claimed away.
 *   RETIRED-BY-A0  the seven arms whose subject was the APPENDED confined
 *       terminal (read-axis) shadow: D1, the D2 definition-locus half, A1, A2,
 *       A3 and the C1 disposal control. See the retirement pin at the end of
 *       this file for the subject, the citation and the named successors.
 *       Nothing was skipped and no retired expectation was kept as green.
 *
 * Run: node --test tests/world-factory/a5sf-pd13-terminal-read-axis.test.mjs
 * Pin:  A5SF_PD13_PIN=1 node --test tests/world-factory/a5sf-pd13-terminal-read-axis.test.mjs
 */
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire, register } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { PassThrough } from 'node:stream'
import test, { after } from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = join(HERE, '..', '..')
const PIN = process.env.A5SF_PD13_PIN === '1'

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
  teamId: 'team-a5sf-pd13',
  memberInstanceId: 'member-pd13-a',
  templateId: 'worker',
  instanceGeneration: 1,
})
const REVISION = 'a5sf-pd13:member-pd13-a:g1'
const PROGRAM = '/bin/bash'
const SECRET_MARKER = 'A5SF_PD13_SECRET_BYTES'
const SECRET_NAME = 'secret-product.txt'

const dirs = []
function tracked(dir) {
  dirs.push(dir)
  return dir
}
after(() => {
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true })
})

/**
 * Two roots: the Member workspace (the compiled read lane) and a sibling
 * `write-only` directory that the lane DENIES reading — the same shape the
 * PTY dev-live lane measured.
 */
function makeWorldDirs(label) {
  const dir = tracked(mkdtempSync(join(tmpdir(), `a5sf-pd13-${label}-`)))
  const workspace = join(dir, 'workspace')
  const writeOnly = join(dir, 'write-only')
  mkdirSync(workspace, { recursive: true })
  mkdirSync(writeOnly, { recursive: true })
  writeFileSync(join(workspace, 'in-lane.txt'), 'in lane\n', 'utf8')
  writeFileSync(join(workspace, 'out-lane.txt'), 'before\n', 'utf8')
  writeFileSync(join(writeOnly, SECRET_NAME), `${SECRET_MARKER}\n`, 'utf8')
  return { dir, workspace, writeOnly, secret: join(writeOnly, SECRET_NAME) }
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
    invocationId: 'a5sf-pd13:exec',
    policyRevision: REVISION,
    read: lane([workspace]),
    write: lane([workspace]),
    network: Object.freeze({ access: 'allow' }),
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
 * The INHERITED base `subprocess` service — the preset's own executor path.
 * `spawn` answers the command as if the shell had read whatever file the body
 * names: that is the pre-fix product fact, recorded rather than inferred.
 */
class TestSubprocess extends Service {
  constructor(ctx, config = {}) {
    super(ctx, 'subprocess')
    this.spawns = config.spawns ?? []
  }
  spawn(spec) {
    this.spawns.push({ argv: [...(spec?.argv ?? [])], cwd: String(spec?.cwd ?? ''), service: 'base' })
    return fakeHandle({ stdout: bodyAnswer(spec?.argv?.[2]) })
  }
  async spawnStreaming(spec) {
    this.spawns.push({ argv: [...(spec?.argv ?? [])], cwd: String(spec?.cwd ?? ''), service: 'base' })
    return { ok: true, value: fakeStreamProcess({ stdout: bodyAnswer(spec?.argv?.[2]) }) }
  }
}

/** The recorded answer of a shell that has no read axis: the body's file bytes. */
function bodyAnswer(command) {
  const text = String(command ?? '')
  if (text.includes(SECRET_NAME)) return `${SECRET_MARKER}\n`
  return 'BASE-EXECUTOR\n'
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
 * (argv/cwd/shell declaration) and answers a recorded exit. It is the only
 * place a process could exist in this suite, so a denial that never calls it is
 * measured as zero-process.
 */
function makeConfinedProvider() {
  const calls = []
  return {
    calls,
    async spawnStreaming(request) {
      calls.push({
        argv: [...(request?.argv ?? [])],
        cwd: String(request?.cwd ?? ''),
        networkProfile: request?.networkProfile ?? null,
      })
        // A confined child that is allowed to run answers what a shell would
        // print: the file bytes for the secret body, a marker otherwise. The
        // pre-fix hole is exactly that this face attributes no read.
        const body = request?.argv?.[2]
        const stdout = String(body ?? '').includes(SECRET_NAME) ? `${SECRET_MARKER}\n` : 'CONFINED-EXECUTOR\n'
        return { ok: true, value: fakeStreamProcess({ stdout, code: 0 }) }
    },
    async probe() {
      return { ok: true, value: [{ dimension: 'network-destination', level: 'unsupported', note: 'double reports unsupported' }] }
    },
  }
}

/**
 * The PRESET's model-visible `bash` row: a shell whose body resolves the
 * INHERITED `ctx.subprocess` / `ctx.terminals`. It is what the shadow replaces
 * and what the C1 control restores.
 */
function presetBashPlugin({ useTerminals = false } = {}) {
  return {
    name: 'fixture-preset-bash',
    inject: useTerminals ? ['tools', 'terminals'] : ['tools', 'subprocess'],
    apply(ctx) {
      ctx.tools.register({
        name: 'bash',
        description: 'PRESET bash (inherited shell) — the pre-fix product path',
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
          if (useTerminals) {
            return JSON.stringify({ executor: 'preset-pty', stdout: bodyAnswer(args?.command) })
          }
          const handle = ctx.subprocess.spawn({
            argv: [PROGRAM, '-c', String(args?.command ?? '')],
            cwd: String(args?.workdir ?? process.cwd()),
            stdio: { stdin: 'ignore', stdout: { maxBytes: 1 << 18 }, stderr: { maxBytes: 1 << 18 } },
            graceMs: 5_000,
          })
          const settled = await handle.done
          return JSON.stringify({
            executor: 'preset',
            exitCode: settled?.exitCode ?? null,
            stdout: handle.collected?.stdout?.readFrom(0)?.text ?? '',
          })
        },
      })
    },
  }
}

/**
 * The PRESET's legacy terminal service (the `dsh-terminal` row a
 * persistent-shell preset mounts). It counts allocations so "the Member never
 * got a legacy shell" is measured over a service that really could allocate.
 */
function makeLegacyTerminals() {
  const allocations = []
  return {
    allocations,
    listBackends: () => ['legacy-shell'],
    async spawn(owner, request) {
      allocations.push({ owner: String(owner?.id ?? ''), type: String(request?.type ?? '') })
      return { sessionId: `pty-${String(allocations.length)}`, type: 'legacy-shell', pid: 9000 + allocations.length, status: { kind: 'running' }, motd: 'legacy' }
    },
    startSend() { throw new Error('the legacy terminal must never be reached by this suite') },
    read() { throw new Error('the legacy terminal must never be reached by this suite') },
    signal() { throw new Error('the legacy terminal must never be reached by this suite') },
    async kill() { return true },
    list() { return [] },
  }
}

function presetTopology(root, workspace) {
  const standingKey = {}
  const standing = createScope(root, standingKey)
  // The Agent IS the scope key AND the terminal owner (the face is
  // owner-scoped: a session is fenced by this object's identity).
  const agentKey = {
    id: 'agent-pd13',
    session: { header: { cwd: workspace } },
  }
  const agent = createScope(root, agentKey)
  bindScopeParent(agentKey, standingKey)
  return { standing, agentKey, agentCtx: agent.ctx }
}

async function makeWorld(label, {
  face = true,
  terminalFace = true,
  legacyTerminal = false,
  shellClass = true,
} = {}) {
  const { workspace, writeOnly, secret } = makeWorldDirs(label)
  const root = new Context()
  await root.plugin(SystemPrompt)
  await root.plugin(ToolRuntime)
  const baseSpawns = []
  await root.plugin(TestFileSystem, {})
  await root.plugin(TestSubprocess, { spawns: baseSpawns })
  const { standing, agentKey, agentCtx } = presetTopology(root, workspace)
  const legacy = makeLegacyTerminals()
  if (legacyTerminal) standing.ctx.provide('terminals', legacy)
  await standing.ctx.plugin(presetBashPlugin({ useTerminals: legacyTerminal }))
  const confined = makeConfinedProvider()
  const provider = {
    compiledFor: () => ({
      members: [{ identity: IDENTITY, policy: { ok: true, value: policyFor(workspace) } }],
      providerClass: TestFileSystem,
      ...(face
        ? {
            subprocess: {
              effective: effectiveFor(workspace),
              provider: confined,
              realmId: 'member:member-pd13-a',
              bindingId: 'dsh.subprocess/exec',
              memberScope: IDENTITY.memberInstanceId,
              providerClass: TestSubprocess,
              ...(shellClass ? { shellClass: Object.freeze({ programs: Object.freeze(['bash']) }) } : {}),
            },
          }
        : {}),
      ...(terminalFace ? { terminal: Object.freeze({ program: PROGRAM }) } : {}),
    }),
  }
  return {
    root,
    agentKey,
    agentCtx,
    workspace,
    writeOnly,
    secret,
    baseSpawns,
    confined,
    legacy,
    mount: () => row.mountMemberA5sfRealm({
      root: agentCtx,
      a5sfConfig: row.a5sfRealmConfigOf({ a5sfEvidencePath: join(workspace, '..', `consult-${label}.jsonl`) }),
      provider: () => provider,
      member: {
        sessionId: `session-pd13-${label}`,
        instanceId: IDENTITY.memberInstanceId,
        teamRootSessionId: 'team-root',
        templateId: IDENTITY.templateId,
      },
    }),
  }
}

function toolNames(root, scope) {
  return root.tools.schemas(scope).map((schema) => schema.name)
}

async function dispatch(root, agent, name, args) {
  const settled = await root.tools.execute({
    signal: new AbortController().signal,
    callId: `a5sf-pd13-${name}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    arguments: args,
    agent,
  })
  const text = Array.isArray(settled.content)
    ? settled.content.map((part) => (part?.type === 'text' ? part.text : '')).join('')
    : ''
  return { isError: settled.isError === true, text, value: settled.value }
}

async function mountAndAttach(world, config = {}) {
  const mounted = await world.mount()
  assert.ok(mounted !== undefined, 'the configured row must mount a realm')
  await row.attachA5sfNativeToolModules(mounted, world.agentCtx, row.a5sfRealmConfigOf(config))
  return mounted
}

/** Read the guard-consult sink the row wrote (facts, not an inference). */
function factsOf(world) {
  const path = join(world.workspace, '..', `consult-${world.label}.jsonl`)
  if (!existsSync(path)) return []
  return readFileSync(path, 'utf8').split('\n').filter((line) => line.trim() !== '').map((line) => JSON.parse(line))
}

function readFacts(world) {
  return factsOf(world).filter((fact) => fact.method === 'shellRead')
}

/** Dispatch one `bash` call and answer the tool result plus the counter deltas. */
async function runBash(world, command, workdir = world.workspace) {
  const before = { base: world.baseSpawns.length, confined: world.confined.calls.length, legacy: world.legacy.allocations.length }
  const result = await dispatch(world.root, world.agentKey, 'bash', {
    command,
    description: 'PD-13 read-axis probe',
    workdir,
  })
  const after = { base: world.baseSpawns.length, confined: world.confined.calls.length, legacy: world.legacy.allocations.length }
  return { result, delta: { base: after.base - before.base, confined: after.confined - before.confined, legacy: after.legacy - before.legacy } }
}

// ===========================================================================
// P0 — THE DEFECT PIN (pre-fix behaviour). RED on the fixed tree by design.
// ===========================================================================
test('P0 PD-13 defect pin (PRE-FIX): the Member shell reads the lane-denied secret and returns its bytes, with no guard fact naming it', { skip: !PIN }, async () => {
  const world = await makeWorld('pin')
  world.label = 'pin'
  const mounted = await mountAndAttach(world, { a5sfEvidencePath: join(world.workspace, '..', 'consult-pin.jsonl') })
  try {
    const { result } = await runBash(world, `cat ${world.secret}`)
    // THE OLD BEHAVIOUR, asserted verbatim. On the fixed tree the confined
    // terminal face refuses this read, so this arm goes RED — the flip is the
    // evidence, not a regression.
    assert.equal(result.isError, false, 'PRE-FIX: the Member\'s shell command executed')
    assert.match(result.text, new RegExp(SECRET_MARKER, 'u'), 'PRE-FIX: the denied read returned its bytes')
    const naming = readFacts(world).filter((fact) => fact.locator === world.secret)
    assert.deepEqual(naming, [], 'PRE-FIX: no guard fact names the denied locator — the read was never evaluated')
  } finally {
    await mounted.dispose()
  }
})

// ===========================================================================
// S1 — the surface stays neutral.
// ===========================================================================
test('S1 surface neutral: exactly one `bash`, same name set before and after the shadow', async () => {
  const world = await makeWorld('surface')
  world.label = 'surface'
  const before = toolNames(world.root, world.agentKey)
  assert.deepEqual(before, ['bash'], 'the preset plane exposes one bash')
  const mounted = await mountAndAttach(world, { a5sfEvidencePath: join(world.workspace, '..', 'consult-surface.jsonl') })
  try {
    assert.deepEqual(toolNames(world.root, world.agentKey), before, 'the shadow replaces the definition, never the name set')
  } finally {
    await mounted.dispose()
  }
})

// ===========================================================================
// C2 — no terminal face: the realm answers "no terminal face", and the unioned
//      row adds NO shell of its own on top of the preset's.
// ===========================================================================
// RETIRED-BY-A0 (round 80): this control used to assert that the confined
// `subprocess` face served the command (delta.confined === 1) with no read fact.
// That expectation belonged to the appended PD-12 shadow, which the A1 cut
// deleted (see the retirement pin at the end of this file). The locus half is
// LIVE and still enforced: the realm must answer `faces.terminals === null`
// when it was declared without a terminal face, and the attach must add no
// shell. If a shadow ever returns, `delta.confined` becomes 1 and this arm is
// the control that names it.
test('C2 control (no terminal face): the realm answers "no terminal face" and the attach adds no shell', async () => {
  const world = await makeWorld('no-terminal-face', { terminalFace: false })
  world.label = 'no-terminal-face'
  const before = toolNames(world.root, world.agentKey)
  const mounted = await mountAndAttach(world, { a5sfEvidencePath: join(world.workspace, '..', 'consult-no-terminal-face.jsonl') })
  try {
    assert.equal(mounted.installation.members[0].faces.terminals, null, 'the realm answers "no terminal face"')
    assert.deepEqual(toolNames(world.root, world.agentKey), before, 'the attach is surface-neutral')
    const { result, delta } = await runBash(world, `cat ${world.secret}`)
    assert.equal(result.isError, false, 'the preset executor still serves the command in this world')
    assert.equal(delta.confined, 0, 'the confined face is NOT consulted: no shadow routes this call (post-cut)')
    assert.equal(delta.legacy, 0, 'and no legacy terminal is allocated')
    assert.deepEqual(readFacts(world), [], 'no read fact exists: the lexical read axis is retired with the shadow')
  } finally {
    await mounted.dispose()
  }
})

// ===========================================================================
// C3 — a terminal face with no process face is refused at install.
// ===========================================================================
test('C3 control (terminal face without a subprocess face): refused at install with TERMINALS_UNCONFINED_REALM', async () => {
  const world = await makeWorld('no-process-face', { face: false })
  world.label = 'no-process-face'
  await assert.rejects(world.mount(), (error) => {
    assert.equal(error.code, 'TERMINALS_UNCONFINED_REALM')
    assert.match(String(error.message), /confined subprocess face/u)
    return true
  })
  assert.equal(world.confined.calls.length, 0, 'no provider was ever called')
})

// ===========================================================================
// C4 — the DOUBLE-TERMINAL refusal.
// ===========================================================================
test('C4 control (double terminal): a legacy preset terminal beside the confined face is refused, 0 legacy allocations', async () => {
  const world = await makeWorld('double-terminal', { legacyTerminal: true })
  world.label = 'double-terminal'
  await assert.rejects(world.mount(), (error) => {
    assert.equal(error.code, 'TERMINALS_DOUBLE_TERMINAL_REFUSED')
    assert.match(String(error.message), /legacy/u)
    return true
  })
  assert.equal(world.legacy.allocations.length, 0, 'the Member never holds a legacy shell beside a confined one')
})

// ===========================================================================
// C5 — no declared shell class: the face refuses at install.
// ===========================================================================
test('C5 control (no shell class): the terminal face refuses at install, because its commands could never be admitted', async () => {
  const world = await makeWorld('no-shell-class', { shellClass: false })
  world.label = 'no-shell-class'
  await assert.rejects(world.mount(), (error) => {
    assert.equal(error.code, 'TERMINALS_UNCONFINED_REALM')
    assert.match(String(error.message), /shell class/u)
    return true
  })
})

// ===========================================================================
// C6 — declared weakness: a DYNAMIC read is not lexically attributable.
// ===========================================================================
test('C6 declared weakness: a dynamic read (`$(...)`) is not attributed and is not refused at admission', async () => {
  // RETIRED-BY-A0 (round 80) — re-pointed, NOT retired. The DECLARED WEAKNESS
  // this arm exists to pin is unchanged: a dynamic token (`$(...)`, backticks)
  // is not lexically attributable, so no `shellRead` fact exists for it and
  // admission cannot refuse it. Only the executor sentence changed: the appended
  // terminal shadow used to run it under the confined process face
  // (`delta.confined === 1`); that shadow retired with the A1 cut, so the same
  // command now runs on the preset executor (`delta.base === 1`). The weakness
  // is asserted exactly as before — never that a refusal happened.
  const world = await makeWorld('dynamic')
  world.label = 'dynamic'
  const mounted = await mountAndAttach(world, { a5sfEvidencePath: join(world.workspace, '..', 'consult-dynamic.jsonl') })
  try {
    const { result, delta } = await runBash(world, `cat "$(printf ${world.secret})"`)
    assert.equal(result.isError, false, 'the dynamic read is NOT refused at admission (declared limit)')
    assert.equal(delta.base, 1, 'it ran on the preset executor (no appended face serves this row post-cut)')
    assert.equal(delta.confined, 0, 'the confined faces are not consulted for it')
    assert.deepEqual(readFacts(world), [], 'no lexical read fact exists for a dynamic token')
  } finally {
    await mounted.dispose()
  }
})

// ===========================================================================
// RETIRED-BY-A0 (round 80) — the appended confined terminal (read-axis) shadow
// ===========================================================================
// WHAT WAS HERE. Seven arms (D1, D2, A1, A2, A3, C1) mounted a realm and called
// `attachA5sfNativeToolModules`, expecting it to APPEND a Team-authored
// confined terminal shadow (`confinedTerminalSpecOf`) that replaced the
// model-visible `bash` with a lexically read-admitted shell over the realm's
// confined `terminals` face:
//   D1  a lane-denied read refused with IO_READ_DENIED, 0 bytes, 1 read fact;
//   D2  the realm reports faces.terminals AND the model-visible bash definition
//       is the confined terminal module's;
//   A1  an in-lane read runs through the terminal face once with an ALLOW fact;
//   A2  a redirection target is not a read, so an in-lane write still runs;
//   A3  a command with no path token produces no shellRead fact;
//   C1  the control: with the shadow disposed, the secret bytes come back.
//
// WHY THEY ARE RETIRED (per SUBJECT, never "the check was red").
//   subject:   the appended confined-terminal read axis — `confinedTerminalSpecOf`
//              and the `live/confined-terminal-tool.mjs` module it named.
//   citation:  commit 5d1349767 ("refactor(ute-a1): re-point the surviving
//              referrers and the kept-capability tests") deleted that spec
//              function and its module together with the PD-12 bash, PD-16
//              search, PD-17 fs and PD-27 web appends, because a Team-authored
//              shadow definition is exactly what the A1 cut forbids: the
//              composition supplies its native module specs and
//              `attachA5sfNativeToolModules` appends no tool of its own (the law
//              survives verbatim at
//              `packages/runtime/src/plugin/live/a5sf-realm-row.mjs:1164-1180`).
//              The process FAMILY contribution is booked per subject in
//              `dev/agent-workflow/ledgers/ute-cut-closure.allow.json`
//              `#retiredSurfaces[dsh.process-family]` (citations: the reviewed
//              inventory §family-process, the keep/delete decision, and the
//              round-72 per-file record).
//   successor: `tests/ute-g1-fs/lane-suite.test.mjs` (the one route-C lane that
//              still reproduces its golden post-cut, 5/5) and
//              `packages/runtime/test/vnext-admission.test.mjs` (the
//              `ute-vnext-a1` CI leg: the ONE admission point). The governed
//              shell's replacement backend — the HOST's own persistent-`bash`
//              definition over a Member-bound PTY, whose ceiling is handed to
//              the OS profile instead of a lexical read scan — is pinned by
//              `tests/world-factory/a5sf-native-bash-preservation.test.mjs`
//              (P4 measures an out-of-root write refused by the enforcement
//              provider with zero bytes written). NOT a successor:
//              `tests/ute-g1-process/lane-suite.test.mjs` — it is the process
//              lane's old-path world and mounts the same deleted append
//              (`lib/world.mjs:361`), so it is red at this head; see
//              ROUND80-CI-CLOSURE.md §3.6 for that disposition.
//
// WHAT THIS PIN STILL ENFORCES. A resurrection is RED, not silent: the three
// retired spec functions must stay absent from the row, the D2 LOCUS half that
// survives is still measured (the realm reports the terminal face it was
// declared with), the attach appends no tool and records no read fact, and
// every successor must still exist on disk. Nothing below asserts a retired
// expectation as green, and no arm was skipped.
test('RETIRED-BY-A0: the appended confined-terminal read axis stays gone and its successors exist', async () => {
  for (const name of ['confinedTerminalSpecOf', 'confinedBashSpecOf', 'nativeBashPtySpecOf']) {
    assert.equal(row[name], undefined, `${name} was retired with the A0/A1 cut; restoring it rebuilds a Team-authored shadow, which A1 forbids`)
  }
  const world = await makeWorld('retired')
  world.label = 'retired'
  const mounted = await world.mount()
  try {
    // D2's LIVE half: the realm still answers the terminal face it was declared
    // with; only the appended definition shadow retired.
    assert.notEqual(mounted.installation.members[0].faces.terminals, null, 'the realm still reports its confined terminal face')
    const before = toolNames(world.root, world.agentKey)
    const appended = await row.attachA5sfNativeToolModules(
      mounted,
      world.agentCtx,
      row.a5sfRealmConfigOf({ a5sfEvidencePath: join(world.workspace, '..', 'consult-retired.jsonl') }),
    )
    assert.equal(appended, undefined, 'with no configured native module the attach appends NOTHING (the appending mechanism is gone)')
    assert.deepEqual(toolNames(world.root, world.agentKey), before, 'and it changes no model-visible name')
    assert.deepEqual(readFacts(world), [], 'and it records no shellRead fact: the lexical read axis is retired')
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
