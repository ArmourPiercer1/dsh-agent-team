/**
 * a5sf-window-taxonomy.test.mjs — THE ACTIVATION-WINDOW DEFECT CLASS, hunted
 * deliberately (WINDOW-HUNT lane, 2026-11-12; base `origin/master` = ff04b6f41).
 *
 * THE CLASS (PHASE-REPORT-2026-11-10 appendix C.3):
 *
 *   In-process tests mounted AFTER the row existed; the product mounts BEFORE
 *   it. The fixture's ordering was kinder than production.
 *
 * The concrete instance (#649): `activation/provider.ts` step 13 runs the
 * child's `createChildSession` — the realm mount lives INSIDE it — while the
 * MemberInstance row is only committed at step 15. The governed realm therefore
 * asked the durable authority for a row that did not exist yet and read
 * `lifecycle: undefined` as "not admitted". Every in-process fixture mounted
 * against a roster where the row already existed, so nothing was red.
 *
 * THIS SUITE REPRODUCES THE PRODUCT'S ORDER FOR EACH WINDOW the attach /
 * activation / mount paths contain, and asserts the answer the product gives:
 *
 *   W1 child session before MemberInstance row   -> named narrow window
 *      (`freshCreate`, only when the live glue says `fresh-member`; the durable
 *      row always wins). Reproduced through the REAL `createActivationChildAdapter`
 *      with the row written AFTER the adapter returns, exactly as the
 *      coordinator does (`ensureMemberRecord` after `createChildSession`).
 *   W2 template/persona config projection before the row -> named window, the
 *      SAME gate (`freshCreateHintAdmits`) for both consumers; a cold path must
 *      fail closed.
 *   W3 tool surface before provider -> the product orders provider BEFORE
 *      surface (pinned in the source); the residual is the NEW finding: a
 *      governed row whose provider compiles NO realm for the Member's template
 *      used to leave the preset's ungoverned `bash` in place silently — now
 *      refused at the mount seam.
 *   W4 capability row before probe result -> no capability claim at mount; the
 *      only capability rows come from the provider's own probe and a missing /
 *      refusing / unevidenced probe is `unsupported`, never default-allow.
 *   W5 guard before policy revision -> the guard cannot be installed without a
 *      compiled revision, and the sink records THAT revision.
 *   W6 skill/config identity before the config row -> the template identity is
 *      required BEFORE the authority row is read (no authority read happens for
 *      an unidentifiable Member).
 *
 * ZERO Host boots, ZERO ports, no DSH_HOME. Run:
 *   `node --test tests/world-factory/a5sf-window-taxonomy.test.mjs`
 *
 * @module tests/world-factory/a5sf-window-taxonomy.test
 */
import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire, register } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import process from 'node:process'
import { PassThrough } from 'node:stream'
import test, { after } from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = join(HERE, '..', '..')

register(pathToFileURL(join(REPO_ROOT, 'scripts', 'run-tests-hooks.mjs')).href)

const row = await import(pathToFileURL(join(REPO_ROOT, 'packages', 'runtime', 'src', 'plugin', 'live', 'a5sf-realm-row.mjs')).href)
const governed = await import(pathToFileURL(join(REPO_ROOT, 'packages', 'runtime', 'src', 'plugin', 'live', 'a5sf-governed-realm.mjs')).href)
const blueprintModule = await import(pathToFileURL(join(REPO_ROOT, 'packages', 'domain', 'blueprint', 'src', 'index.ts')).href)
const subprocessModule = await import(pathToFileURL(join(REPO_ROOT, 'packages', 'runtime', 'team-services', 'src', 'subprocess.ts')).href)
const activationAdapter = await import(pathToFileURL(join(REPO_ROOT, 'packages', 'runtime', 'activation', 'adapter.ts')).href)

const runtimeRequire = createRequire(join(REPO_ROOT, 'packages', 'runtime', 'package.json'))
const { Context, Service } = await import(pathToFileURL(runtimeRequire.resolve('@deepseek-ai/cordis')).href)
const ToolRuntime = (await import(pathToFileURL(runtimeRequire.resolve('@deepseek-ai/dsh-tools')).href)).default
const SystemPrompt = (await import(pathToFileURL(runtimeRequire.resolve('@deepseek-ai/dsh-system-prompt')).href)).default
const { createScope, bindScopeParent } = await import(pathToFileURL(runtimeRequire.resolve('@deepseek-ai/dsh-scope')).href)

// --- fixtures ---------------------------------------------------------------

const TEAM = 'team-window-hunt'
const MEMBER = 'member-window-a'
const TEMPLATE = 'worker'
const SIDEKICK = 'sidekick'
const PROGRAM = '/bin/bash'
const CHILD_SESSION = 'session-child-window-hunt'

const dirs = []
after(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

function makeWorldDirs(label) {
  const dir = mkdtempSync(join(tmpdir(), `a5sf-window-${label}-`))
  dirs.push(dir)
  const workspace = join(dir, 'workspace')
  mkdirSync(workspace, { recursive: true })
  writeFileSync(join(workspace, 'in-lane.txt'), 'in lane\n', 'utf8')
  return { dir, workspace }
}

function lane(allow) {
  return Object.freeze({ mode: 'restricted', allow: Object.freeze([...allow]), ask: Object.freeze([]), deny: Object.freeze([]) })
}

/**
 * A schemaVersion 4 bound blueprint. `ceilingFor` names the templates that get
 * an `memberIoCeilings` entry; a declared Member template WITHOUT one is the
 * shape W3 uses (a v4 blueprint MAY declare a member template the ceiling
 * family does not cover — measured: the parse accepts it).
 */
function v4Blueprint({ workspace, members = [TEMPLATE], ceilingFor = [TEMPLATE] }) {
  const document = {
    schemaVersion: 4,
    blueprintId: TEAM,
    revision: '1',
    leader: { templateId: 'leader', persona: 'Lead.' },
    members: members.map((templateId) => ({ templateId, persona: `Persona ${templateId}.` })),
    requirements: [],
    memberEnvelopes: [],
    policyStates: [],
    permissionMutationEnvelope: { rules: [] },
    teamHardEnvelope: { rules: [] },
    metadata: {},
    memberIoCeilings: ceilingFor.map((templateId) => ({
      templateId,
      io: {
        read: lane([workspace]),
        write: lane([workspace]),
        network: { mode: 'allow' },
      },
    })),
  }
  return `---\n${JSON.stringify(document, null, 2)}\n---\n`
}

/** A real Cordis fs Service over node:fs — the BASE provider the realm shadows. */
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

/** The INHERITED base `subprocess` service (the preset's ungoverned shell path). */
class TestSubprocess extends Service {
  constructor(ctx, config = {}) {
    super(ctx, 'subprocess')
    this.spawns = config.spawns ?? []
  }
  spawn(spec) {
    this.spawns.push({ argv: [...(spec?.argv ?? [])], service: 'base' })
    return fakeHandle({ stdout: 'BASE\n' })
  }
  async spawnStreaming(spec) {
    this.spawns.push({ argv: [...(spec?.argv ?? [])], service: 'base' })
    return { ok: true, value: fakeStreamProcess({ stdout: 'BASE\n' }) }
  }
}

function fakeStreamProcess({ stdout = '', stderr = '', code = 0 }) {
  const stdin = new PassThrough()
  const out = new PassThrough()
  const err = new PassThrough()
  const payloadExit = (async () => {
    await new Promise((resolve) => setImmediate(resolve))
    out.write(stdout)
    out.end()
    err.write(stderr)
    err.end()
    return { form: 'recorded', rc: code }
  })()
  return {
    pid: 4243,
    stdin,
    stdout: out,
    stderr: err,
    exited: Promise.resolve({ code, signal: null }),
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

/** DOUBLE: the confined OS process provider (no kernel process exists here). */
function makeConfinedProvider() {
  const calls = []
  let probeCalls = 0
  return {
    calls,
    get probeCalls() { return probeCalls },
    async spawnStreaming(request) {
      calls.push({ argv: [...(request?.argv ?? [])], cwd: String(request?.cwd ?? '') })
      return { ok: true, value: fakeStreamProcess({ stdout: 'CONFINED-EXECUTOR\n', code: 0 }) }
    },
    async probe() {
      probeCalls += 1
      return { ok: true, value: [{ dimension: 'network-destination', level: 'unsupported', note: 'double: no enforcement claim' }] }
    },
  }
}

/** The PRESET's model-visible `bash`: a shell on the INHERITED service. */
function presetBashPlugin() {
  return {
    name: 'fixture-window-preset-bash',
    inject: ['tools', 'subprocess'],
    apply(ctx) {
      ctx.tools.register({
        name: 'bash',
        description: 'PRESET bash (inherited shell)',
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
          const handle = ctx.subprocess.spawn({ argv: [PROGRAM, '-c', String(args?.command ?? '')], cwd: String(args?.workdir ?? process.cwd()) })
          const settled = await handle.done
          return JSON.stringify({ kind: 'preset-pty', exitCode: settled?.exitCode ?? null, stdout: handle.collected?.stdout?.readFrom(0)?.text ?? '' })
        },
      })
    },
  }
}

function presetTopology(root, workspace) {
  const standingKey = {}
  const standing = createScope(root, standingKey)
  const agentKey = { id: `agent-${MEMBER}`, session: { header: { cwd: workspace } } }
  const agent = createScope(root, agentKey)
  bindScopeParent(agentKey, standingKey)
  return { standing, agentKey, agentCtx: agent.ctx }
}

/**
 * Build one window world. THE ORDERING IS THE PRODUCT'S: the durable roster is
 * a Map that starts EMPTY (no MemberInstance row); `readAuthority` maps it
 * through the REAL `governedAuthorityReference` and forwards `freshCreate`
 * exactly as `host.ts#readGovernedAuthority` does. Writing the row is an
 * explicit act a test performs AFTER the mount (the coordinator's step 15).
 */
async function makeWindowWorld(label, { members = [TEMPLATE], ceilingFor = [TEMPLATE], generation = 0 } = {}) {
  const { dir, workspace } = makeWorldDirs(label)
  const source = v4Blueprint({ workspace, members, ceilingFor })
  const boundBlueprint = blueprintModule.parseBlueprint(source)
  const root = new Context()
  await root.plugin(SystemPrompt)
  await root.plugin(ToolRuntime)
  await root.plugin(TestFileSystem, {})
  const baseSpawns = []
  await root.plugin(TestSubprocess, { spawns: baseSpawns })
  const { standing, agentKey, agentCtx } = presetTopology(root, workspace)
  await standing.ctx.plugin(presetBashPlugin())
  const confined = makeConfinedProvider()
  /** THE DURABLE ROSTER (the MemberInstance rows). Empty until a test writes one. */
  const roster = new Map()
  let authorityReads = 0
  const provider = governed.createGovernedRealmProvider({
    realmId: governed.GOVERNED_REALM_ID,
    scratchRoot: dir,
    resolveBoundBlueprint: () => boundBlueprint,
    readAuthority: async (input) => {
      authorityReads += 1
      return governed.governedAuthorityReference({
        generation,
        lifecycle: roster.get(input.memberInstanceId)?.lifecycle,
        freshCreate: input?.freshCreate === true,
      })
    },
    processProvider: confined,
  })
  const world = {
    label,
    dir,
    workspace,
    boundBlueprint,
    root,
    agentKey,
    agentCtx,
    baseSpawns,
    confined,
    roster,
    provider,
    get authorityReads() { return authorityReads },
  }
  return world
}

function governedConfig(extra = {}) {
  return row.a5sfRealmConfigOf({ a5sfGovernedRealm: true, ...extra })
}

function memberOf(world, bindPath = 'fresh-member', overrides = {}) {
  return {
    sessionId: `session-${world.label}`,
    instanceId: MEMBER,
    teamRootSessionId: `team-root-${world.label}`,
    templateId: TEMPLATE,
    bindPath,
    ...overrides,
  }
}

async function mount(world, config = governedConfig(), member = memberOf(world)) {
  return row.mountMemberA5sfRealm({
    root: world.agentCtx,
    a5sfConfig: config,
    provider: () => world.provider,
    member,
  })
}

async function dispatch(root, agent, name, args) {
  const settled = await root.tools.execute({
    signal: new AbortController().signal,
    callId: `window-hunt-${name}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    arguments: args,
    agent,
  })
  const text = Array.isArray(settled.content)
    ? settled.content.map((part) => (part?.type === 'text' ? part.text : '')).join('')
    : ''
  return { isError: settled.isError === true, text }
}

// ===========================================================================
// W1 — child session before the MemberInstance row
// ===========================================================================

test('W1a the REAL activation adapter mounts the realm before the row: the row lands after, and it wins', async () => {
  const world = await makeWindowWorld('w1a')
  try {
    const order = []
    let mounted
    // The child-session factory is where the product mounts THIS Member's realm
    // (`agent-bindings.mjs#childFactory.createChildSession` -> agentSetup ->
    // mountMemberA5sfRealm). The durable roster is EMPTY here — the row is
    // committed only at activation step 15, after this call.
    const factory = {
      async createChildSession(request) {
        order.push('factory')
        assert.equal(world.roster.has(request.instanceId), false, 'the product window: no MemberInstance row yet')
        mounted = await mount(world, governedConfig(), memberOf(world, 'fresh-member', {
          instanceId: request.instanceId,
          templateId: request.templateId,
        }))
        order.push('mount')
        return { childSessionId: CHILD_SESSION }
      },
    }
    const durability = {
      async ensureDurable(childSessionId) {
        order.push('durable')
        assert.equal(childSessionId, CHILD_SESSION)
      },
    }
    const adapter = activationAdapter.createActivationChildAdapter(factory, durability)
    const result = await adapter.createChildSession({
      rootSessionId: `team-root-${world.label}`,
      instanceId: MEMBER,
      templateId: TEMPLATE,
      label: 'window hunt',
    })
    assert.equal(result.childSessionId, CHILD_SESSION)

    // The coordinator's own order: the external effect + barrier, and only THEN
    // the durable MemberInstance record (`ensureMemberRecord` inside
    // `createChildSession`, the CHILD_SESSION_CREATED stage).
    order.push('row')
    world.roster.set(MEMBER, { lifecycle: 'CREATED' })
    assert.deepEqual(order, ['factory', 'mount', 'durable', 'row'], 'mount -> barrier -> durable row is the product order')
    assert.notEqual(mounted, undefined, 'the realm mounted inside the pre-row window')
    assert.equal(mounted.installation.members[0].faces.subprocess !== undefined, true, 'the confined face exists in-window')

    // A LATER cold attach (no window) reads the row that landed — and gets the
    // SAME admitted answer at the same durable generation.
    const cold = await world.provider.compiledFor(memberOf(world, 'cold-member'))
    assert.notEqual(cold, undefined)
    assert.equal(cold.members[0].policy.value.memberIdentity, MEMBER)
  } finally {
    await world.root.dispose?.()
  }
})

test('W1b the window is CLOSED outside fresh-member: a cold attach with no row refuses', async () => {
  const world = await makeWindowWorld('w1b')
  try {
    await assert.rejects(
      () => world.provider.compiledFor(memberOf(world, 'cold-member')),
      (error) => {
        assert.equal(error.code, 'MEMBER_POLICY_UNAVAILABLE')
        assert.match(error.message, /AUTHORITY_REFUSED/)
        return true
      },
      'a cold resume of a vanished Member is not a fresh creation',
    )
    await assert.rejects(() => mount(world, governedConfig(), memberOf(world, 'cold-member')), /AUTHORITY_REFUSED/)
  } finally {
    await world.root.dispose?.()
  }
})

test('W1c a durable row ALWAYS wins inside the window (ARCHIVED/DISPOSED beat freshCreate)', async () => {
  for (const lifecycle of ['ARCHIVED', 'DISPOSED']) {
    const world = await makeWindowWorld(`w1c-${lifecycle.toLowerCase()}`)
    try {
      world.roster.set(MEMBER, { lifecycle })
      assert.equal(
        governed.governedAuthorityReference({ generation: 0, lifecycle, freshCreate: true }).admitted,
        false,
        `${lifecycle} is a durable fact`,
      )
      await assert.rejects(
        () => world.provider.compiledFor(memberOf(world, 'fresh-member')),
        /AUTHORITY_REFUSED/,
        `${lifecycle} must not be resurrected by the creation window`,
      )
    } finally {
      await world.root.dispose?.()
    }
  }
  for (const lifecycle of governed.GOVERNED_ADMITTED_LIFECYCLES) {
    const world = await makeWindowWorld(`w1c-${lifecycle.toLowerCase()}`)
    try {
      world.roster.set(MEMBER, { lifecycle })
      const compiled = await world.provider.compiledFor(memberOf(world, 'fresh-member'))
      assert.notEqual(compiled, undefined, `${lifecycle} stays admitted in the window`)
    } finally {
      await world.root.dispose?.()
    }
  }
})

// ===========================================================================
// W2 — template/persona config projection before the row
// ===========================================================================

test('W2 the hint gate is ONE rule, and it admits ONLY fresh-member', () => {
  assert.equal(row.freshCreateHintAdmits('fresh-member'), true)
  for (const closed of ['cold-member', 'fresh-root', 'cold-root', undefined, '', 'state-route']) {
    assert.equal(row.freshCreateHintAdmits(closed), false, `${String(closed)} must not open the hint window`)
  }
  // Both consumers must spell the rule through the ONE helper: the template
  // locate (which gates the ceiling/static-capability projection) and the
  // persona install. A second inline `bindPath === 'fresh-member'` would be a
  // second, drift-prone copy of the window.
  const source = readFileSync(join(REPO_ROOT, 'packages', 'runtime', 'src', 'plugin', 'live', 'agent-bindings.mjs'), 'utf8')
  const uses = source.split('freshCreateHintAdmits(bindPath)').length - 1
  assert.equal(uses, 2, `locateTemplate + installPersonaForSetup must both use the ONE gate (found ${uses})`)
  assert.equal(
    source.includes("} else if (bindPath === 'fresh-member' && templateIdHint !== undefined"),
    false,
    'no call site may re-implement the gate inline',
  )
})

// ===========================================================================
// W3 — tool surface before provider
// ===========================================================================

test('W3a the product orders provider BEFORE surface (realm mount, then preset mount, then the route-C shadow)', () => {
  const source = readFileSync(join(REPO_ROOT, 'packages', 'runtime', 'src', 'plugin', 'live', 'agent-bindings.mjs'), 'utf8')
  const realm = source.indexOf('await mountMemberA5sfRealm({')
  const preset = source.indexOf('await presets.mount(agentCtx,')
  const shadow = source.indexOf('await attachA5sfNativeToolModules(')
  assert.notEqual(realm, -1)
  assert.notEqual(preset, -1)
  assert.notEqual(shadow, -1)
  assert.equal(realm < preset, true, 'the confined PROVIDER is mounted before the preset TOOL SURFACE')
  assert.equal(preset < shadow, true, 'the route-C shadow runs after the preset mount (deny-then-attach)')
})

test('W3b NEW FINDING PIN: a governed row whose provider compiles NO realm refuses — never a silent ungoverned bash', async () => {
  // A v4 blueprint may declare a Member template OUTSIDE the ceiling family
  // (measured: the parse accepts it; only the ceiling's templateId must
  // resolve). The provider then has no compiled realm for that Member.
  const world = await makeWindowWorld('w3b', { members: [TEMPLATE, SIDEKICK], ceilingFor: [TEMPLATE] })
  try {
    const sidekick = memberOf(world, 'fresh-member', { templateId: SIDEKICK })
    assert.equal(await world.provider.compiledFor(sidekick), undefined, 'the provider answers undefined for an uncovered template')

    // BEFORE the fix this returned `undefined` and the caller then ran the
    // preset's inherited `bash` — the row said `a5sfGovernedRealm: true`.
    await assert.rejects(
      () => mount(world, governedConfig(), sidekick),
      (error) => {
        assert.equal(error.code, 'REALM_DECLARATION_INVALID', 'the mount seam refuses on undefined instead of silently proceeding')
        assert.match(error.message, /compiled no realm/)
        assert.match(error.message, new RegExp(SIDEKICK))
        return true
      },
      'a governed row does not silently leave a Member ungoverned',
    )
    // And no ungoverned shell ran: the refusal happened before any tool call.
    assert.equal(world.baseSpawns.length, 0, 'the inherited shell was never reached')
    assert.equal(world.confined.calls.length, 0)
  } finally {
    await world.root.dispose?.()
  }
})

// ===========================================================================
// W4 — capability row before probe result
// ===========================================================================

test('W4 no capability claim at mount; the provider probe is the ONLY source and absence/refusal is unsupported', async () => {
  const world = await makeWindowWorld('w4')
  try {
    const mounted = await mount(world)
    assert.notEqual(mounted, undefined)
    assert.equal(world.confined.probeCalls, 0, 'the mount claims NO capability before the provider probe runs')
    const faceKeys = Object.keys(mounted.installation.members[0].faces.subprocess ?? {})
    for (const claim of ['capabilities', 'capabilityRows', 'probe']) {
      assert.equal(faceKeys.includes(claim), false, `the mounted face must not carry a pre-probe ${claim}`)
    }

    // The product's single capability-row consumer. Absence, a throw, a refusal
    // and an unevidenced "enforced" are ALL the closed answer — never allow.
    assert.equal((await subprocessModule.probeNetworkDenial({})).level, 'unsupported')
    assert.equal((await subprocessModule.probeNetworkDenial({
      probe: async () => { throw new Error('probe exploded') },
    })).level, 'unsupported')
    assert.equal((await subprocessModule.probeNetworkDenial({
      probe: async () => ({ ok: false, error: { code: 'PROBE_REFUSED' } }),
    })).level, 'unsupported')
    assert.equal((await subprocessModule.probeNetworkDenial({
      probe: async () => ({ ok: true, value: [{ dimension: 'network-destination', level: 'enforced' }] }),
    })).level, 'unsupported', 'a level without a mechanism is not evidence')
    const enforced = await subprocessModule.probeNetworkDenial({
      probe: async () => ({
        ok: true,
        value: [{
          dimension: 'network-destination',
          level: 'enforced',
          mechanism: 'netns',
          evidence: 'evidence/bl42',
        }],
      }),
    })
    assert.equal(enforced.level, 'enforced')
    assert.equal(enforced.mechanism, 'netns')
  } finally {
    await world.root.dispose?.()
  }
})

// ===========================================================================
// W5 — guard before policy revision
// ===========================================================================

test('W5 the guard cannot exist before its compiled revision, and the sink records THAT revision', async () => {
  const world = await makeWindowWorld('w5')
  try {
    const sinkPath = join(world.dir, 'consult-w5.jsonl')
    const config = governedConfig({ a5sfEvidencePath: sinkPath })
    const mounted = await mount(world, config)
    assert.notEqual(mounted, undefined)
    await row.attachA5sfNativeToolModules(mounted, world.agentCtx, config)
    const policyRevision = mounted.installation.members[0].faces !== undefined
      ? (await world.provider.compiledFor(memberOf(world))).members[0].policy.value.revision
      : undefined
    assert.equal(typeof policyRevision, 'string')
    assert.notEqual(policyRevision, '')

    const result = await dispatch(world.root, world.agentKey, 'bash', {
      command: 'cat in-lane.txt',
      description: 'window tax probe',
      workdir: world.workspace,
    })
    assert.equal(result.isError, false, result.text)
    const facts = readFileSync(sinkPath, 'utf8').split('\n').filter((line) => line.trim() !== '').map((line) => JSON.parse(line))
    const fact = facts.find((entry) => entry.method === 'shellRead')
    assert.notEqual(fact, undefined, 'a guard fact exists')
    assert.equal(fact.policyRevision, policyRevision, 'the fact carries the compiled revision, never a placeholder')

    // A generation move changes a NEW attach's revision; it does not relabel
    // the already-mounted guard's facts.
    world.roster.set(MEMBER, { lifecycle: 'CREATED' })
    const moved = await makeWindowWorld('w5-moved', { generation: 1 })
    try {
      const movedCompiled = await moved.provider.compiledFor(memberOf(moved))
      assert.notEqual(movedCompiled.members[0].policy.value.revision, policyRevision)
    } finally {
      await moved.root.dispose?.()
    }
  } finally {
    await world.root.dispose?.()
  }

  // A compiled policy with NO revision can never be installed: the guard is
  // built FROM the compiled policy, so "guard before revision" is unreachable.
  const bare = await makeWindowWorld('w5-bare')
  try {
    const forged = {
      compiledFor: async () => ({
        members: [{
          identity: { teamId: TEAM, memberInstanceId: MEMBER, templateId: TEMPLATE, instanceGeneration: 0 },
          policy: { ok: true, value: { memberIdentity: MEMBER, instanceGeneration: 0, revision: '' } },
        }],
      }),
    }
    await assert.rejects(
      () => row.mountMemberA5sfRealm({
        root: bare.agentCtx,
        a5sfConfig: row.a5sfRealmConfigOf({ a5sfEvidencePath: join(bare.dir, 'bare.jsonl') }),
        provider: () => forged,
        member: memberOf(bare),
      }),
      (error) => {
        assert.equal(error.code, 'MEMBER_POLICY_UNAVAILABLE')
        assert.match(error.message, /must carry its revision/)
        return true
      },
      'no guard is installed ahead of a revision',
    )
  } finally {
    await bare.root.dispose?.()
  }
})

// ===========================================================================
// W6 — config identity before the config row
// ===========================================================================

test('W6 an unidentifiable Member refuses BEFORE the authority row is read (no read on undefined identity)', async () => {
  const world = await makeWindowWorld('w6')
  try {
    const identityReads = world.authorityReads
    await assert.rejects(
      () => world.provider.compiledFor({ ...memberOf(world), templateId: undefined }),
      (error) => {
        assert.equal(error.code, 'MEMBER_IDENTITY_INVALID')
        assert.match(error.message, /no templateId/)
        return true
      },
      'a ceiling is a template fact; it is never guessed',
    )
    assert.equal(world.authorityReads, identityReads, 'the authority was NOT read for an unidentifiable Member')
  } finally {
    await world.root.dispose?.()
  }
})
