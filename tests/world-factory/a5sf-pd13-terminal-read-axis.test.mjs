/**
 * a5sf-pd13-terminal-read-axis.test.mjs — PD-13: a Member's shell has no read
 * axis, because the terminal path never consults the compiled lane.
 *
 * WHAT THIS SUITE PINS (host-free; in-process Cordis roots, no boot, no
 * DSH_HOME, no pinned host tree, no real PTY):
 *
 *   P0  THE DEFECT PIN (env-gated). The same world that the fix serves — a
 *       Member realm that declares a confined terminal face — on the PRE-FIX
 *       tree runs the `bash` command on the confined `subprocess` face, whose
 *       read admission is DECLARED-ROOT based: the body's `cat` of a path the
 *       compiled read lane denies returns the bytes, and NO guard fact names
 *       that path. The arm asserts that old behaviour verbatim, so it is GREEN
 *       before the fix and RED after it; the gate skips it unless
 *       `A5SF_PD13_PIN=1` (the before/after logs live in the evidence dir).
 *   D1  THE FIX: the SAME read is refused through the Member's own `bash` with
 *       the typed `IO_READ_DENIED`, ZERO bytes returned, ZERO confined provider
 *       calls, and exactly ONE guard fact naming the locator.
 *   D2  LOCUS: the realm reports `faces.terminals`, and the model-visible
 *       `bash` definition is the confined terminal module's — the refusal is
 *       attributed to the face, not to "bash is broken".
 *   A1  THE ALLOW LANE still works: an in-lane read runs through the confined
 *       terminal face to the confined process provider exactly once, returns
 *       its stdout/exit code, and records an ALLOW fact for the read root.
 *   A2  THE WRITE LANE IS NOT TOUCHED: a command whose path token is a
 *       redirection target is not treated as a read, so an in-lane write runs
 *       (the read axis is the only axis this face adds).
 *   A3  NO PATH, NO CONSULT: a command with no path-shaped token produces no
 *       `shellRead` fact at all.
 *   S1  SURFACE NEUTRAL: the model-visible name set is unchanged (one `bash`).
 *   C1  CONTROL — remove the shadow (dispose the native modules): the fixed
 *       refusal goes RED in place (the ungoverned path returns the bytes).
 *   C2  CONTROL — a realm with the confined `subprocess` face but NO terminal
 *       face keeps the PD-12 shape: the body's read is NOT attributed and the
 *       bytes come back. The read axis is the new face's, not `bash`'s.
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
// D1 + D2 — THE FIX and its LOCUS.
// ===========================================================================
test('D1 fix: the Member\'s bash read of a lane-denied path is IO_READ_DENIED, 0 bytes, 1 guard fact, 0 provider calls', async () => {
  const world = await makeWorld('deny')
  world.label = 'deny'
  const mounted = await mountAndAttach(world, { a5sfEvidencePath: join(world.workspace, '..', 'consult-deny.jsonl') })
  try {
    const { result, delta } = await runBash(world, `cat ${world.secret}`)
    assert.equal(result.isError, true, `the denied read is REFUSED, not delivered: ${result.text}`)
    assert.match(result.text, /IO_READ_DENIED/u, 'the refusal carries the face\'s typed code')
    assert.doesNotMatch(result.text, new RegExp(SECRET_MARKER, 'u'), 'ZERO bytes of the secret are returned')
    assert.equal(delta.confined, 0, '0 confined provider calls: no command was requested')
    assert.equal(delta.base, 0, '0 inherited base spawns')
    const naming = readFacts(world).filter((fact) => fact.locator === world.secret)
    assert.equal(naming.length, 1, `exactly ONE read fact names the locator (got ${String(naming.length)})`)
    assert.equal(naming[0].decision, 'deny')
    assert.equal(naming[0].decidedBy, 'IO_READ_DENIED')
    assert.equal(naming[0].memberIdentity, IDENTITY.memberInstanceId, 'the fact is attributed to the Member')
    assert.equal(naming[0].policyRevision, REVISION, 'the fact carries the compiled revision')
  } finally {
    await mounted.dispose()
  }
})

test('D2 locus: the realm reports faces.terminals and the model-visible bash definition is the confined terminal module\'s', async () => {
  const world = await makeWorld('locus')
  world.label = 'locus'
  const mounted = await mountAndAttach(world, { a5sfEvidencePath: join(world.workspace, '..', 'consult-locus.jsonl') })
  try {
    const member = mounted.installation.members[0]
    assert.notEqual(member.faces.terminals, null, 'the realm owns a confined terminal face')
    assert.equal(member.faces.terminals, member.ctx.get('terminals'), 'the Member scope resolves THAT face, not the inherited service')
    const definition = world.root.tools.get('bash', world.agentKey)
    assert.match(String(definition?.description ?? ''), /confined terminal/u, 'the model resolves the confined terminal definition')
    const { result } = await runBash(world, 'printf A5SF_PD13_LOCUS')
    assert.equal(result.isError, false, `the allow lane still runs: ${result.text}`)
    assert.equal(JSON.parse(result.value).kind, 'confined-terminal', 'the result says which face served it')
  } finally {
    await mounted.dispose()
  }
})

// ===========================================================================
// A1/A2/A3 + S1 — the allow axis and the surface.
// ===========================================================================
test('A1 allow lane: an in-lane read runs through the confined terminal face exactly once, with an ALLOW read fact', async () => {
  const world = await makeWorld('allow')
  world.label = 'allow'
  const mounted = await mountAndAttach(world, { a5sfEvidencePath: join(world.workspace, '..', 'consult-allow.jsonl') })
  try {
    const inLane = join(world.workspace, 'in-lane.txt')
    const { result, delta } = await runBash(world, `cat ${inLane}`)
    assert.equal(result.isError, false, `the in-lane read is admitted: ${result.text}`)
    const payload = JSON.parse(result.value)
    assert.equal(payload.kind, 'confined-terminal')
    assert.equal(payload.exitCode, 0)
    assert.match(payload.stdout, /CONFINED-EXECUTOR/u, 'the confined provider\'s child produced the stdout')
    assert.equal(delta.confined, 1, 'exactly ONE confined provider call')
    assert.equal(delta.base, 0, 'the inherited base executor was never reached')
    assert.deepEqual(world.confined.calls.at(-1)?.argv, [PROGRAM, '-c', `cat ${inLane}`])
    const naming = readFacts(world).filter((fact) => fact.locator === inLane)
    assert.equal(naming.length, 1, 'one read consultation for the in-lane operand')
    assert.equal(naming[0].decision, 'allow')
    assert.equal(naming[0].decidedBy, 'ALLOW')
  } finally {
    await mounted.dispose()
  }
})

test('A2 write lane untouched: a redirection target is not a read, so an in-lane write still runs', async () => {
  const world = await makeWorld('write')
  world.label = 'write'
  const mounted = await mountAndAttach(world, { a5sfEvidencePath: join(world.workspace, '..', 'consult-write.jsonl') })
  try {
    const target = join(world.workspace, 'out-lane.txt')
    const { result, delta } = await runBash(world, `printf rewritten > ${target}`)
    assert.equal(result.isError, false, `an in-lane write is not this face's read axis: ${result.text}`)
    assert.equal(delta.confined, 1, 'the command ran through the confined face')
    assert.deepEqual(readFacts(world), [], 'no read fact was produced for a redirection target')
  } finally {
    await mounted.dispose()
  }
})

test('A3 no path token: a command with no path-shaped operand produces no shellRead fact', async () => {
  const world = await makeWorld('nopath')
  world.label = 'nopath'
  const mounted = await mountAndAttach(world, { a5sfEvidencePath: join(world.workspace, '..', 'consult-nopath.jsonl') })
  try {
    const { result, delta } = await runBash(world, 'printf A5SF_PD13_NOPATH')
    assert.equal(result.isError, false, `a path-free command runs: ${result.text}`)
    assert.equal(delta.confined, 1)
    assert.deepEqual(readFacts(world), [], 'no read axis consultation without a path token')
  } finally {
    await mounted.dispose()
  }
})

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
// C1 — remove the shadow: the ungoverned read returns (the fixed assertion reds).
// ===========================================================================
test('C1 control (shadow removed): the body read returns the secret bytes again', async () => {
  const world = await makeWorld('no-shadow')
  world.label = 'no-shadow'
  const mounted = await mountAndAttach(world, { a5sfEvidencePath: join(world.workspace, '..', 'consult-no-shadow.jsonl') })
  try {
    await mounted.disposeNativeToolModules()
    const { result, delta } = await runBash(world, `cat ${world.secret}`)
    assert.equal(result.isError, false, 'without the shadow the command executes (the hole returns)')
    assert.match(result.text, new RegExp(SECRET_MARKER, 'u'), 'the bytes come back through the ungoverned path')
    assert.equal(delta.base, 1, 'the inherited executor served it')
    assert.deepEqual(readFacts(world), [], 'the read axis was never consulted')
  } finally {
    await mounted.dispose()
  }
})

// ===========================================================================
// C2 — no terminal face: the PD-12 shape (permanent contrast).
// ===========================================================================
test('C2 control (no terminal face): bash keeps the PD-12 shape and the body read is not attributed', async () => {
  const world = await makeWorld('no-terminal-face', { terminalFace: false })
  world.label = 'no-terminal-face'
  const mounted = await mountAndAttach(world, { a5sfEvidencePath: join(world.workspace, '..', 'consult-no-terminal-face.jsonl') })
  try {
    assert.equal(mounted.installation.members[0].faces.terminals, null, 'the realm answers "no terminal face"')
    const { result, delta } = await runBash(world, `cat ${world.secret}`)
    assert.equal(result.isError, false, 'the confined subprocess face still runs the command')
    assert.match(result.text, new RegExp(SECRET_MARKER, 'u'), 'its declared-root admission does not attribute the body read')
    assert.equal(delta.confined, 1, 'the confined subprocess face served it')
    assert.deepEqual(readFacts(world), [], 'no read fact: the read axis is the terminal face\'s')
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
  const world = await makeWorld('dynamic')
  world.label = 'dynamic'
  const mounted = await mountAndAttach(world, { a5sfEvidencePath: join(world.workspace, '..', 'consult-dynamic.jsonl') })
  try {
    const { result, delta } = await runBash(world, `cat "$(printf ${world.secret})"`)
    assert.equal(result.isError, false, 'the dynamic read is NOT refused at admission (declared limit)')
    assert.equal(delta.confined, 1, 'it ran under the confined process face (the OS profile is its boundary)')
    assert.deepEqual(readFacts(world), [], 'no lexical read fact exists for a dynamic token')
  } finally {
    await mounted.dispose()
  }
})
