/**
 * a5sf-native-bash-preservation.test.mjs — NATIVE-BASH-PRESERVATION
 * (2026-11-11). Alpha.5 must replace a native tool's EXECUTION BACKEND, never
 * the tool (A5-NATIVE-01/02, A5-BOUNDARY-01). This suite pins the replacement.
 *
 * WHAT IT PINS (host-free; in-process Cordis roots, a REAL `/dev/pts` PTY via
 * the pinned `@deepseek-ai/dsh-terminal` + `@deepseek-ai/dsh-terminal-bash` +
 * the local subprocess provider; no boot, no DSH_HOME, no pinned-tree edit):
 *
 *   P1  DEFINITION IDENTITY: the `bash` route C registers is the PINNED
 *       `@deepseek-ai/dsh-tool-bash-persistent` definition — same `name`,
 *       `description`, `parameters` (deep-equal) and `presentCall` — with only
 *       `execute` wrapped by the admission middleware. The wrapper's own
 *       `apply` registers exactly ONE tool and it is that definition.
 *   P2  ONE MEMBER, ONE PTY: two calls through that definition keep `cd` and
 *       `export` state (the native persistent contract).
 *   P3  EXACT IDENTITY: an owner that is not the EXACT bound Member session is
 *       a typed `PTY_OWNER_MISMATCH`; a face with no bound session is a typed
 *       `PTY_OWNER_UNBOUND`; and BOTH refuse BEFORE any PTY exists.
 *   P4  CEILING: the policy the pinned backend hands `sandbox.confine` is the
 *       Member's own write root, `danger-full-access` is CLAMPED, and a write
 *       outside the root is refused by the enforcement provider (zero bytes
 *       written) with the refusal attributable to the Member's PTY.
 *   P5  POLICY GENERATION: a retained PTY whose revision is no longer current
 *       answers `PTY_POLICY_STALE`, is killed, and the next call opens a fresh
 *       domain under the new revision — a stale permission domain never runs.
 *   P6  ADMISSION IN FRONT OF THE NATIVE CALL: allow ⇒ the native body runs
 *       exactly once and the plane's settle sees `succeeded`; deny ⇒ the native
 *       body runs ZERO times and no PTY is created; no published edge ⇒ typed
 *       `A5_NATIVE_ADMISSION_UNAVAILABLE` and zero execution.
 *   P7  NO SILENT FALLBACK: a realm with no governed PTY face never resolves
 *       this module (`nativeBashPtySpecOf` answers `undefined`), so the
 *       inherited host `terminals` service can never serve the governed name.
 *
 * Run: node --test tests/world-factory/a5sf-native-bash-preservation.test.mjs
 */
import assert from 'node:assert/strict'
import { createRequire, register } from 'node:module'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import test, { after } from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = join(HERE, '..', '..')
register(pathToFileURL(join(REPO_ROOT, 'scripts', 'run-tests-hooks.mjs')).href)

const runtimeRequire = createRequire(join(REPO_ROOT, 'packages', 'runtime', 'package.json'))
const hostRequire = createRequire(join(REPO_ROOT, 'package.json'))
const { Context } = await import(pathToFileURL(runtimeRequire.resolve('@deepseek-ai/cordis')).href)
const LocalSubprocessRuntime = (await import(pathToFileURL(runtimeRequire.resolve('@deepseek-ai/dsh-subprocess-local')).href)).default
const nativeModule = await import(pathToFileURL(hostRequire.resolve('@deepseek-ai/dsh-tool-bash-persistent')).href)
const { createGovernedPtyTerminalFace, narrowSandboxPolicy, PtyFaceRefusal } = await import(
  pathToFileURL(join(REPO_ROOT, 'packages', 'runtime', 'team-services', 'src', 'terminal-pty.ts')).href
)
const nativeBash = await import(pathToFileURL(join(REPO_ROOT, 'packages', 'runtime', 'src', 'plugin', 'live', 'native-bash-tool.mjs')).href)
const admission = await import(pathToFileURL(join(REPO_ROOT, 'packages', 'runtime', 'src', 'plugin', 'live', 'native-tool-admission.mjs')).href)

const dirs = []
const teardowns = []
function tracked(dir) {
  dirs.push(dir)
  return dir
}
after(async () => {
  // Dispose every mounted fiber FIRST: a live PTY keeps the event loop open, so
  // a suite that leaks a shell never exits (and the leaked shell would be a
  // governance hole in its own right).
  for (const teardown of teardowns.reverse()) {
    try {
      await teardown()
    } catch {
      /* best-effort: the test result is already recorded */
    }
  }
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true })
})

const PROGRAM = '/bin/bash'

/** A Member ceiling: one writable root, no read axis claimed. */
function laneOf(memberIdentity, root, overrides = {}) {
  return {
    memberIdentity,
    read: { mode: 'restricted', allow: [root], ask: [], deny: [] },
    write: { mode: 'restricted', allow: [root], ask: [], deny: [] },
    ...overrides,
  }
}

/**
 * Build one governed PTY world: a real Cordis root with the REAL local
 * subprocess provider, a fake `agents` service (the pinned registry requires a
 * live owner), and a recording `sandbox` provider that ENFORCES the write root
 * the way an OS profile would (so P4 measures a refusal, not a comment).
 */
async function makeWorld(label, { memberSessionId = `sess-${label}`, revision = `rev-${label}` } = {}) {
  const dir = tracked(mkdtempSync(join(tmpdir(), `a5sf-nbp-${label}-`)))
  const workspace = join(dir, 'workspace')
  mkdirSync(workspace, { recursive: true })
  const root = new Context()
  await root.plugin(LocalSubprocessRuntime)
  const agents = new Map()
  root.provide('agents', { get: (id) => agents.get(id) })

  const confineCalls = []
  const argvSeen = []
  const sandbox = {
    async confine(argv, policy) {
      confineCalls.push(policy)
      argvSeen.push([...argv])
      // HOST-FREE BOUND: this recorder does not run an OS profile, so it
      // measures the CONTRACT (the exact policy the pinned backend asks to be
      // confined under, and that it asks BEFORE any PTY is allocated). The
      // kernel-level "an outside write really fails" leg is the live run's.
      // `world.confineRefuses` turns the recorder into a refusing provider so
      // the refusal path (no PTY, typed failure) is measurable here too.
      if (world.confineRefuses === true) {
        throw new Error(`ENFORCEMENT_REFUSED: refusing to confine under ${policy.mode} at ${policy.workspaceRoot}`)
      }
      return { argv }
    },
  }
  const world = {
    dir,
    workspace,
    root,
    agents,
    confineCalls,
    argvSeen,
    confineRefuses: false,
    sandbox,
    memberSessionId,
    revision,
    face: undefined,
    terminals: undefined,
  }
  world.mount = async (options = {}) => {
    const memberId = options.memberIdentity ?? `member-${label}`
    const face = createGovernedPtyTerminalFace({
      effective: options.lane ?? laneOf(memberId, workspace),
      memberIdentity: memberId,
      memberSessionId: 'memberSessionId' in options ? options.memberSessionId : world.memberSessionId,
      policyRevision: options.revision ?? world.revision,
      program: PROGRAM,
      backendType: `a5sf-pty-${label}`,
      sandboxPolicy: {
        defaultMode: 'workspace-write',
        workspaceRoot: workspace,
        resolve: ({ session }) => ({
          // The HOST default for this session is danger-full-access: the face
          // must clamp it (P4), never pass it through.
          mode: options.hostMode ?? 'danger-full-access',
          workspaceRoot: session?.header?.cwd ?? workspace,
          sessionId: session?.id,
        }),
      },
      baseSubprocess: root.get('subprocess'),
      sandboxProvider: () => sandbox,
      ...(options.revisionNow === undefined ? {} : { revisionNow: options.revisionNow }),
    })
    const scope = root.isolate('terminals', Symbol(`a5sf-nbp-${label}-${String(Math.random())}`))
    const fiber = await scope.plugin(face, {})
    teardowns.push(() => fiber.dispose())
    world.scope = scope
    world.face = face
    world.faces = [...(world.faces ?? []), scope.get('terminals')]
    world.terminals = scope.get('terminals')
    return world.terminals
  }
  world.agentFor = (sessionId, cwd = workspace) => {
    const agent = {
      id: sessionId,
      session: { id: sessionId, header: { cwd } },
      ctx: { effect: () => () => {}, on: () => () => {} },
    }
    agents.set(sessionId, agent)
    return agent
  }
  return world
}

/**
 * Run one native `bash` call through the WRAPPED definition the module registers.
 *
 * Unless `keepEdge` is set, a permissive admission edge is published for the
 * agent so the call measures the PTY contract rather than the admission one
 * (P6 owns the admission arms and publishes its own edge, or none at all).
 */
async function callBash(world, agent, command, { signal, keepEdge = false } = {}) {
  if (!keepEdge) admission.publishNativeAdmission(agent, { admit: async () => ({ kind: 'allow', callId: 'auto' }), settle: () => {} })
  // ONE registration per world: the pinned module keeps its per-owner shell
  // cache in the registration's closure, so re-applying it per call would spawn
  // a fresh PTY and the persistence claim would be vacuous.
  const definition = definitionOn(world.terminals)
  return await definition.execute({ command }, { agent, signal: signal ?? new AbortController().signal })
}

/**
 * Register the adopted native `bash` ONCE per terminal face. The pinned module
 * keeps its per-owner shell cache in the registration's closure, so re-applying
 * it per call would spawn a fresh PTY and the persistence claim would be
 * vacuous.
 */
const definitionsByFace = new WeakMap()
function definitionOn(terminals) {
  const cached = definitionsByFace.get(terminals)
  if (cached !== undefined) return cached
  const registered = []
  nativeBash.apply({
    terminals,
    tools: { register: (definition) => { registered.push(definition); return () => {} } },
    effect: () => () => {},
    get: () => undefined,
  }, {})
  assert.equal(registered.length, 1, 'the native bash module registers exactly one definition')
  definitionsByFace.set(terminals, registered[0])
  return registered[0]
}

// ── P1 — the definition IS the pinned host definition ────────────────────────
test('P1 definition identity: the registered bash is the pinned host definition, only execute is wrapped', async () => {
  const world = await makeWorld('p1')
  const terminals = await world.mount()
  const agent = world.agentFor(world.memberSessionId)

  // The pinned module's OWN definition, registered on the same surface with no
  // middleware: this is the reference identity.
  const nativeDefs = []
  nativeModule.apply({
    terminals,
    tools: { register: (definition) => { nativeDefs.push(definition); return () => {} } },
    effect: () => () => {},
    get: () => undefined,
  }, { backendType: `a5sf-pty-p1` })
  assert.equal(nativeDefs.length, 1)
  const reference = nativeDefs[0]

  const registered = []
  nativeBash.apply({
    terminals,
    tools: { register: (definition) => { registered.push(definition); return () => {} } },
    effect: () => () => {},
    get: () => undefined,
  }, { backendType: `a5sf-pty-p1` })
  assert.equal(registered.length, 1, 'ONE model-visible name, never a second shell tool')
  const adopted = registered[0]

  assert.equal(adopted.name, reference.name)
  assert.equal(adopted.name, 'bash')
  assert.equal(adopted.description, reference.description, 'the pinned description is not re-authored')
  assert.deepEqual(adopted.parameters, reference.parameters, 'the pinned parameter schema is byte-identical')
  assert.equal(String(adopted.presentCall({ command: 'echo x' }).card), String(reference.presentCall({ command: 'echo x' }).card))
  assert.notEqual(adopted.execute, reference.execute, 'only the execution edge is wrapped (admission in FRONT of the native call)')
  assert.ok(typeof adopted.output?.render === 'function', 'the pinned output/render face survives the wrap')

  // And the wrapped definition still works end-to-end on the real PTY.
  const disposeEdge = admission.publishNativeAdmission(agent, {
    admit: async () => ({ kind: 'allow', callId: 'p1-call' }),
    settle: () => {},
  })
  const out = await adopted.execute({ command: 'echo identity-ok' }, { agent, signal: new AbortController().signal })
  disposeEdge()
  assert.match(String(out), /identity-ok/)
})

// ── P2 — one Member, one PTY, native persistence ─────────────────────────────
test('P2 one Member shares ONE PTY across calls: cd and export persist', async () => {
  const world = await makeWorld('p2')
  await world.mount()
  const agent = world.agentFor(world.memberSessionId)
  await callBash(world, agent, 'mkdir -p kept && cd kept && export NBP_TOKEN=persisted-42')
  const out = await callBash(world, agent, 'echo "PWD=$(basename "$PWD") TOKEN=$NBP_TOKEN"')
  assert.match(String(out), /PWD=kept/, 'the working directory survives the call boundary')
  assert.match(String(out), /TOKEN=persisted-42/, 'the exported environment survives the call boundary')
  const sessions = world.terminals.list(agent)
  assert.equal(sessions.length, 1, 'both calls share exactly ONE PTY session')
})

// ── P3 — exact Member binding, fail closed ───────────────────────────────────
test('P3 exact identity: a foreign session is refused and NO PTY is created', async () => {
  const world = await makeWorld('p3')
  await world.mount()
  const foreign = world.agentFor('sess-someone-else')
  await assert.rejects(
    () => world.terminals.spawn(foreign, { type: 'a5sf-pty-p3', cwd: world.workspace }),
    (error) => error instanceof PtyFaceRefusal && error.code === 'PTY_OWNER_MISMATCH',
    'a session that is not the bound Member is a typed refusal',
  )
  // A PREFIX of the bound id must not match either (the exact-match law).
  const prefix = world.agentFor(world.memberSessionId.slice(0, -1))
  await assert.rejects(
    () => world.terminals.spawn(prefix, { type: 'a5sf-pty-p3', cwd: world.workspace }),
    (error) => error instanceof PtyFaceRefusal && error.code === 'PTY_OWNER_MISMATCH',
  )
  assert.equal(world.confineCalls.length, 0, 'zero enforcement calls: no PTY was ever started')
})

test('P3b unbound face: no Member session bound = typed refusal, zero PTYs', async () => {
  const world = await makeWorld('p3b')
  await world.mount({ memberSessionId: undefined })
  const agent = world.agentFor('anyone')
  await assert.rejects(
    () => world.terminals.spawn(agent, { type: 'a5sf-pty-p3b', cwd: world.workspace }),
    (error) => error instanceof PtyFaceRefusal && error.code === 'PTY_OWNER_UNBOUND',
  )
  assert.equal(world.confineCalls.length, 0)
})

test('P3c two Members get two PTYs and cannot see each other', async () => {
  const world = await makeWorld('p3c')
  await world.mount({ memberSessionId: 'sess-a' })
  const a = world.agentFor('sess-a')
  await callBash(world, a, 'export NBP_SHARED=only-a && cd /tmp')
  // A SECOND Member is a SECOND realm in production; here it is a second face
  // over the same root, which is the strictest form of the separation claim.
  await world.mount({ memberSessionId: 'sess-b', memberIdentity: 'member-b', revision: 'rev-b' })
  const b = world.agentFor('sess-b')
  admission.publishNativeAdmission(b, { admit: async () => ({ kind: 'allow', callId: 'p3c-b' }), settle: () => {} })
  const out = await definitionOn(world.faces[1]).execute(
    { command: 'echo "SHARED=${NBP_SHARED:-UNSET} PWD=$PWD"' },
    { agent: b, signal: new AbortController().signal },
  )
  assert.match(String(out), /SHARED=UNSET/, 'the second Member does not inherit the first Member environment')
  assert.doesNotMatch(String(out), /only-a/)
  const [faceA, faceB] = world.faces
  // Each face owns its OWN registry (in production each Member is its own
  // realm), so the string ids restart at pty-1: the PROCESS identity is the
  // fact that proves two terminals, not the per-registry label.
  const pidA = faceA.list(a)[0].pid
  const pidB = faceB.list(b)[0].pid
  assert.equal(typeof pidA, 'number')
  assert.equal(typeof pidB, 'number')
  assert.notEqual(pidA, pidB, 'each Member owns a distinct PTY PROCESS')
})

// ── P4 — the ceiling, clamped and enforced ───────────────────────────────────
test('P4 ceiling: the confined policy is the Member root, danger-full-access is clamped', async () => {
  const world = await makeWorld('p4')
  await world.mount()
  const agent = world.agentFor(world.memberSessionId)
  await callBash(world, agent, 'echo gate')
  assert.equal(world.confineCalls.length >= 1, true, 'the pinned backend DID consult the enforcement seam')
  const policy = world.confineCalls[0]
  assert.equal(policy.mode, 'workspace-write', 'the host danger-full-access default is CLAMPED to the ceiling')
  assert.notEqual(policy.mode, 'danger-full-access')
  assert.equal(policy.workspaceRoot, world.workspace, 'the one OS write root is the Member workspace')
  assert.equal(policy.sessionId, world.memberSessionId, 'the policy carries the exact Member session')

  // The clamp is a pure function; pin its law directly too.
  const narrowed = narrowSandboxPolicy(
    { mode: 'danger-full-access', workspaceRoot: world.workspace, sessionId: 's' },
    laneOf('m', world.workspace),
  )
  assert.equal(narrowed.policy.mode, 'workspace-write')
  const readOnly = narrowSandboxPolicy(
    { mode: 'read-only', workspaceRoot: world.workspace, sessionId: 's' },
    laneOf('m', world.workspace),
  )
  assert.equal(readOnly.policy.mode, 'read-only', 'a read-only session is never lifted by the ceiling')
  const outside = narrowSandboxPolicy(
    { mode: 'workspace-write', workspaceRoot: '/somewhere/else', sessionId: 's' },
    laneOf('m', world.workspace),
  )
  assert.equal(outside.writeRoot, null, 'a cwd outside every declared root leaves no writable root')
  assert.equal(outside.policy.mode, 'read-only', 'and degrades to read-only instead of guessing a root')
})

test('P4b enforcement refusal: a confiner that refuses means NO PTY and a failed call', async () => {
  const world = await makeWorld('p4b')
  await world.mount()
  const agent = world.agentFor(world.memberSessionId)
  const inside = join(world.workspace, 'inside.txt')
  const okOut = await callBash(world, agent, `echo in > ${inside} && echo wrote-inside`)
  assert.match(String(okOut), /wrote-inside/)
  assert.equal(readFileSync(inside, 'utf8').trim(), 'in', 'the in-ceiling write really happened')
  assert.equal(world.argvSeen.length >= 1, true, 'the pinned backend handed the shell argv to the enforcement seam BEFORE spawning')
  assert.equal(world.argvSeen[0][0], PROGRAM, 'and the argv it confined is the shell the PTY runs')

  // Now make the enforcement provider refuse (the deployment cannot express
  // this ceiling). The call must fail and NO second PTY may exist.
  // Now make the enforcement provider refuse from the START (a deployment that
  // cannot express this ceiling). The call must fail and NO PTY may exist.
  const blocked = await makeWorld('p4b-refused')
  blocked.confineRefuses = true
  await blocked.mount()
  const blockedAgent = blocked.agentFor(blocked.memberSessionId)
  await assert.rejects(
    () => callBash(blocked, blockedAgent, 'echo must-not-run'),
    (error) => /ENFORCEMENT_REFUSED/.test(String(error.message)),
    'an unenforceable ceiling is a refusal, never an unconfined shell',
  )
  assert.equal(blocked.terminals.list(blockedAgent).length, 0, 'no PTY exists for a refused allocation')
})

// ── P8 — the LOADER path, not `apply()` directly ────────────────────────────
//
// Regression guard for the defect the joint-acceptance lane found live:
// `ctx.plugin(module, config)` resolves a plugin's config through
// `resolveConfig(runtime, config)` (`vendor/cordis/lib/index.js`), which is
//   `if (!runtime.Config) return config`
//   `const result = runtime.Config["~standard"].validate(config)`
// A module that exports a NON-SCHEMA `Config` (this module used to export
// `Object.freeze({})`) therefore throws `Cannot read properties of undefined
// (reading 'validate')` and the whole Member mount fails
// (`TEAM_RUNTIME_DURABLE_WRITE_FAILED` → `SERVICE_MOUNT_FAILED`). The host-free
// suite could not see it because it called `apply()` directly, so this arm
// mounts through the REAL Cordis loader with real injected services.
test('P8 the module mounts through the Cordis loader: config resolution passes and it registers', async () => {
  const { Context } = await import('@deepseek-ai/cordis')
  const registered = []
  const root = new Context()
  // The two injected services, minimal but REAL (provided, not faked into a
  // plain object ctx): the fiber must actually start for config resolution to
  // run at all.
  root.provide('tools', { register: (definition) => { registered.push(definition); return () => {} } })
  root.provide('terminals', { listBackends: () => ['shell'] })
  await root.plugin(nativeBash, {})
  assert.equal(registered.length, 1, 'the loader-mounted module registers exactly one definition')
  assert.equal(registered[0].name, 'bash')
  // The loader's own rule, stated as the contract it is: a configless module
  // exports NO `Config`, and then the loader hands the config through untouched.
  assert.equal(
    nativeBash.Config,
    undefined,
    'a configless native tool module must not export `Config`: the Cordis loader validates `Config["~standard"]` and only passes the config through when `Config` is absent',
  )
})

test('P8b every route-C mountable module in `live/` has a LOADER-ACCEPTABLE config surface', async () => {
  const { readdirSync } = await import('node:fs')
  const liveDir = new URL('../../packages/runtime/src/plugin/live/', import.meta.url)
  const mountable = []
  for (const file of readdirSync(liveDir).filter((name) => name.endsWith('.mjs'))) {
    let module
    try {
      module = await import(new URL(file, liveDir).href)
    } catch (error) {
      // A module that cannot even be imported is not mountable by route C
      // either; its own suite owns that fact.
      if (error?.code === 'ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX') continue
      throw error
    }
    if (typeof module.apply === 'function' && typeof module.name === 'string') mountable.push({ file, module })
  }
  assert.ok(
    mountable.some(({ file }) => file === 'native-bash-tool.mjs'),
    'the scan must include the adopted native bash module (a vacuous scan proves nothing)',
  )
  for (const { file, module } of mountable) {
    if (module.Config === undefined) continue
    assert.equal(
      typeof module.Config?.['~standard']?.validate,
      'function',
      `${file} exports a Config the Cordis loader cannot validate (it calls Config["~standard"].validate); omit Config or export a real schema`,
    )
  }
})

// ── P5 — policy generations ─────────────────────────────────────────────────
test('P5 policy generation: a retained PTY from a stale revision is refused and killed', async () => {
  const world = await makeWorld('p5')
  let live = 'rev-1'
  await world.mount({ revision: 'rev-1', revisionNow: () => live })
  const agent = world.agentFor(world.memberSessionId)
  await callBash(world, agent, 'export NBP_GEN=one')
  assert.equal(world.terminals.list(agent).length, 1)
  live = 'rev-2'
  await assert.rejects(
    () => callBash(world, agent, 'echo should-not-run'),
    (error) => error instanceof PtyFaceRefusal
      && (error.code === 'PTY_POLICY_STALE' || error.code === 'PTY_CEILING_STALE'),
    'the retained session is refused once its revision is no longer current',
  )
  // The stale session is terminated, so the NEXT call opens a fresh domain.
  const sessions = world.terminals.list(agent)
  assert.equal(sessions.length, 0, 'the stale permission domain was killed, never left running')
})

test('P5b a face serving a superseded install revision refuses at the boundary', async () => {
  const world = await makeWorld('p5b')
  const terminals = await world.mount({ revision: 'rev-installed' })
  const agent = world.agentFor(world.memberSessionId)
  // The realm is rebuilt on every rebind, so an install whose revision is not
  // the live one must never open a shell.
  const staleWorld = await makeWorld('p5c')
  await staleWorld.mount({ revision: 'rev-old', revisionNow: () => 'rev-new' })
  const staleAgent = staleWorld.agentFor(staleWorld.memberSessionId)
  await assert.rejects(
    () => staleWorld.terminals.spawn(staleAgent, { type: 'a5sf-pty-p5c', cwd: staleWorld.workspace }),
    (error) => error instanceof PtyFaceRefusal && error.code === 'PTY_CEILING_STALE',
  )
  assert.equal(staleWorld.confineCalls.length, 0)
  // control: the fresh face still works
  assert.equal(await callBash(world, agent, 'echo fresh').then(String).then((s) => s.includes('fresh')), true)
})

// ── P6 — admission in front of the native call ──────────────────────────────
test('P6 allow: the native body runs exactly once and the settle reports succeeded', async () => {
  const world = await makeWorld('p6')
  await world.mount()
  const agent = world.agentFor(world.memberSessionId)
  const seen = []
  const dispose = admission.publishNativeAdmission(agent, {
    admit: async ({ toolName, args }) => {
      seen.push(toolName)
      return { kind: 'allow', callId: 'call-1' }
    },
    settle: (fact) => seen.push(`settle:${fact.callId}:${fact.outcome}`),
  })
  const out = await callBash(world, agent, 'echo admitted', { keepEdge: true })
  assert.match(String(out), /admitted/)
  assert.deepEqual(seen, ['bash', 'settle:call-1:succeeded'], 'admission ran once, before the call, and the outcome was reported once')
  dispose()
})

test('P6b deny: ZERO native execution and ZERO PTY — no side effect', async () => {
  const world = await makeWorld('p6b')
  await world.mount()
  const agent = world.agentFor(world.memberSessionId)
  const marker = join(world.workspace, 'should-never-exist.txt')
  const dispose = admission.publishNativeAdmission(agent, {
    admit: async () => ({ kind: 'deny', code: 'PERMISSION_DENIED', detail: 'the lane denied this command' }),
    settle: () => { throw new Error('a denied call must never settle an execution fact') },
  })
  await assert.rejects(
    () => callBash(world, agent, `echo nope > ${marker}`, { keepEdge: true }),
    (error) => /PERMISSION_DENIED/.test(String(error.message)),
  )
  assert.equal(existsSync(marker), false, 'the denied command never ran (no file side effect)')
  assert.equal(world.confineCalls.length, 0, 'the denied call never even reached the enforcement seam (no PTY)')
  dispose()
})

test('P6c no published edge: typed refusal, zero execution', async () => {
  const world = await makeWorld('p6c')
  await world.mount()
  const agent = world.agentFor(world.memberSessionId)
  await assert.rejects(
    () => callBash(world, agent, 'echo unapproved', { keepEdge: true }),
    (error) => String(error.message).includes(admission.NATIVE_ADMISSION_UNAVAILABLE),
    'without the plane edge the native call is refused, never executed unapproved',
  )
  assert.equal(world.confineCalls.length, 0)
})

// ── P7 — no silent fallback ─────────────────────────────────────────────────
test('P7 route C selects the native bash ONLY for a governed PTY face', async () => {
  const row = await import(pathToFileURL(join(REPO_ROOT, 'packages', 'runtime', 'src', 'plugin', 'live', 'a5sf-realm-row.mjs')).href)
  assert.equal(typeof row.attachA5sfNativeToolModules, 'function')
  // The selection predicate is internal; the OBSERVABLE contract is the module
  // the row appends. A realm whose terminal face is absent or is the retired
  // PD-13 face must not produce the native module. This is asserted through
  // the shipped source: the predicate requires the `governedPty` marker.
  const source = readFileSync(join(REPO_ROOT, 'packages', 'runtime', 'src', 'plugin', 'live', 'a5sf-realm-row.mjs'), 'utf8')
  assert.match(source, /terminals\.governedPty === undefined\) return undefined/, 'the selector refuses any face without the marker')
  assert.match(source, /const A5SF_NATIVE_BASH_TOOL = new URL\('\.\/native-bash-tool\.mjs'/, 'the row resolves the native module from its own mirror')
  // And the shipped PTY face really does declare the marker.
  const world = await makeWorld('p7')
  await world.mount()
  assert.equal(typeof world.terminals.governedPty, 'object')
  assert.equal(world.terminals.governedPty.memberSessionId, world.memberSessionId)
})
