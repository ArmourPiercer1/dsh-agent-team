/**
 * a5sf-governed-preset.test.mjs — the GOVERNED-PRESET product-composition suite
 * (2026-11-11 owner ruling).
 *
 * ZERO Host boots, ZERO ports, no DSH_HOME. In-process Cordis roots + mkdtemp
 * fixtures only. Run: `node --test tests/world-factory/a5sf-governed-preset.test.mjs`
 *
 * WHAT THIS SUITE PINS — and it pins it through the REAL product modules, not
 * through a re-implementation:
 *   - `a5sf-realm-row.mjs` (the product row: neutral key, fork refusal, mount),
 *   - `a5sf-governed-realm.mjs` (the SHIPPED provider: bound blueprint + live
 *     authority + actual Member identity/generation, ONE compiler),
 *   - `product-assembly.ts` (`deriveProductRealmPlanFromBlueprint` and the ONE
 *     `parseProductRealmDeclaration` / `compileMemberPolicy`),
 *   - `mountA5sfRealm` / `installMemberIoProviders` (the real mount seam, incl.
 *     PD-13's confined terminal face and the route-C `bash` shadow).
 *
 * ONLY TWO THINGS ARE DOUBLES, and both are labelled where they are used:
 *   1. the confined OS process provider (no kernel process is spawned — the
 *      double records argv and answers a recorded exit; `mounted confinement`
 *      claims are NOT made from this suite),
 *   2. the durable authority READ (`readAuthority`) as a mutable fixture —
 *      the MAPPING it produces (`governedAuthorityReference`) is the real one
 *      the Host uses, and the refusal it drives is the real compiler's.
 *
 * ARMS:
 *   G1 the neutral key's contract: `true` enables, `false` is refused, combining
 *      it with `a5sfMemberPolicies`/`a5sfMemberAuthority` is the "two
 *      compiled-realm sources" fork, and a governed row with NO provider refuses
 *      at mount (never "silently unmanaged").
 *   G2 NO ACCIDENTAL GOVERNED MEMBER: a v3 bound blueprint (the shipped default)
 *      and a v4 blueprint without `memberIoCeilings` both REFUSE, typed; a
 *      non-opt-in v3 row mounts nothing at all (the legacy path is unchanged).
 *   G3 POSITIVE READ + CEILING DENIAL through the governed `bash`: an in-lane
 *      read runs on the confined terminal face (one confined call, zero host
 *      spawns); a lane-denied read is refused `IO_READ_DENIED` with ZERO bytes
 *      and ZERO confined calls.
 *   G4 NATIVE SURFACE == ACTUAL EXECUTION PROVIDER: the model-visible `bash`
 *      schema is the confined terminal tool's (no `run_in_background`, no
 *      `timeoutMs`, no `sandbox_permissions`) AND the executed result is that
 *      face's (`kind: 'confined-terminal'`).
 *   G5 REVOCATION ON MEMBER LIFECYCLE: ARCHIVED / DISPOSED / a vanished row are
 *      NOT admitted by `governedAuthorityReference`, and the provider then
 *      refuses `MEMBER_POLICY_UNAVAILABLE` carrying `AUTHORITY_REFUSED` — no
 *      realm is mounted.
 *   G6 INVALIDATION AFTER A GENERATION MOVE: the live authority generation is
 *      read per attach, so the compiled policy REVISION changes with it, and the
 *      ONE compiler refuses a stale pairing with `MEMBER_GENERATION_STALE`.
 *   G7 A PERSISTENT SHELL STILL FAILS CLOSED: a world that also mounts the
 *      legacy `terminals` service refuses with
 *      `TERMINALS_DOUBLE_TERMINAL_REFUSED` and allocates ZERO legacy shells.
 *
 * @module tests/world-factory/a5sf-governed-preset.test
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

register(pathToFileURL(join(REPO_ROOT, 'scripts', 'run-tests-hooks.mjs')).href)

const row = await import(pathToFileURL(join(REPO_ROOT, 'packages', 'runtime', 'src', 'plugin', 'live', 'a5sf-realm-row.mjs')).href)
const governed = await import(pathToFileURL(join(REPO_ROOT, 'packages', 'runtime', 'src', 'plugin', 'live', 'a5sf-governed-realm.mjs')).href)
const assembly = await import(pathToFileURL(join(REPO_ROOT, 'packages', 'runtime', 'team-services', 'src', 'product-assembly.ts')).href)
const blueprintModule = await import(pathToFileURL(join(REPO_ROOT, 'packages', 'domain', 'blueprint', 'src', 'index.ts')).href)
const memberPolicy = await import(pathToFileURL(join(REPO_ROOT, 'packages', 'runtime', 'member-io-policy', 'src', 'index.ts')).href)

const runtimeRequire = createRequire(join(REPO_ROOT, 'packages', 'runtime', 'package.json'))
const { Context, Service } = await import(pathToFileURL(runtimeRequire.resolve('@deepseek-ai/cordis')).href)
const ToolRuntime = (await import(pathToFileURL(runtimeRequire.resolve('@deepseek-ai/dsh-tools')).href)).default
const SystemPrompt = (await import(pathToFileURL(runtimeRequire.resolve('@deepseek-ai/dsh-system-prompt')).href)).default
const { createScope, bindScopeParent } = await import(pathToFileURL(runtimeRequire.resolve('@deepseek-ai/dsh-scope')).href)

// --- fixtures ---------------------------------------------------------------

const TEAM = 'team-a5sf-governed'
const MEMBER = 'member-governed-a'
const TEMPLATE = 'worker'
const PROGRAM = '/bin/bash'
const SECRET_MARKER = 'A5SF_GOVERNED_SECRET_BYTES'
const SECRET_NAME = 'secret-product.txt'

const dirs = []
after(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

function makeWorldDirs(label) {
  const dir = mkdtempSync(join(tmpdir(), `a5sf-governed-${label}-`))
  dirs.push(dir)
  const workspace = join(dir, 'workspace')
  const writeOnly = join(dir, 'write-only')
  mkdirSync(workspace, { recursive: true })
  mkdirSync(writeOnly, { recursive: true })
  writeFileSync(join(workspace, 'in-lane.txt'), 'in lane\n', 'utf8')
  writeFileSync(join(writeOnly, SECRET_NAME), `${SECRET_MARKER}\n`, 'utf8')
  return { dir, workspace, writeOnly, secret: join(writeOnly, SECRET_NAME) }
}

function lane(allow) {
  return Object.freeze({ mode: 'restricted', allow: Object.freeze([...allow]), ask: Object.freeze([]), deny: Object.freeze([]) })
}

/**
 * A bound blueprint carrying the Member ceiling family. The read lane is the
 * Member WORKSPACE; the sibling `write-only` directory is outside it — the same
 * shape the PTY dev-live lane measured. Defaults to the v4 face; PD-42 cases
 * pass `schemaVersion: 5` (and may add `reviewRouting`) to prove the SAME
 * family is read from either document version.
 */
function v4Blueprint({ workspace, blueprintId = TEAM, revision = '1', ceilings = true, schemaVersion = 4, reviewRouting } = {}) {
  const document = {
    schemaVersion,
    blueprintId,
    revision,
    leader: { templateId: 'leader', persona: 'Lead.' },
    members: [{ templateId: TEMPLATE, persona: 'Worker.' }],
    requirements: [],
    memberEnvelopes: [],
    policyStates: [],
    permissionMutationEnvelope: { rules: [] },
    teamHardEnvelope: { rules: [] },
    metadata: {},
    ...(reviewRouting === undefined ? {} : { reviewRouting }),
    ...(ceilings
      ? {
          memberIoCeilings: [{
            templateId: TEMPLATE,
            io: {
              read: lane([workspace]),
              write: lane([workspace]),
              network: { mode: 'allow' },
            },
          }],
        }
      : {}),
  }
  return `---\n${JSON.stringify(document, null, 2)}\n---\n`
}

/** The SHIPPED default blueprint's schema: version 3, no ceiling family. */
function v3Blueprint({ blueprintId = TEAM } = {}) {
  const document = {
    schemaVersion: 3,
    blueprintId,
    revision: '1',
    leader: { templateId: 'leader', persona: 'Lead.' },
    members: [{ templateId: TEMPLATE, persona: 'Worker.' }],
    requirements: [],
    teamEnvelope: { allow: [], deny: [] },
    memberEnvelopes: [{ templateId: TEMPLATE, envelope: { allow: [], deny: [] } }],
    policyStates: [{ id: 'default', description: 'Default.' }],
    quotas: { team: { maxInstances: 4, maxConcurrent: 4 }, members: { maxInstances: 2, maxConcurrent: 2 } },
    permissionMutationEnvelope: { rules: [] },
    teamHardEnvelope: { rules: [] },
    metadata: {},
  }
  return `---\n${JSON.stringify(document, null, 2)}\n---\n`
}

// --- the two labelled doubles -----------------------------------------------

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

/** The INHERITED base `subprocess` service (the preset's own executor path). */
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
    pid: 4242,
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

/** DOUBLE 1: the confined OS process provider. Records argv; no process exists. */
function makeConfinedProvider() {
  const calls = []
  return {
    calls,
    async spawnStreaming(request) {
      calls.push({ argv: [...(request?.argv ?? [])], cwd: String(request?.cwd ?? '') })
      const body = String(request?.argv?.[2] ?? '')
      const stdout = body.includes(SECRET_NAME) ? `${SECRET_MARKER}\n` : 'CONFINED-EXECUTOR\n'
      return { ok: true, value: fakeStreamProcess({ stdout, code: 0 }) }
    },
    async probe() {
      return { ok: true, value: [{ dimension: 'network-destination', level: 'unsupported', note: 'double reports unsupported' }] }
    },
  }
}

/** The PRESET's model-visible `bash` row: a shell on the INHERITED service. */
function presetBashPlugin() {
  return {
    name: 'fixture-preset-bash',
    inject: ['tools', 'subprocess'],
    apply(ctx) {
      ctx.tools.register({
        name: 'bash',
        description: 'PRESET bash (inherited shell) — the pre-governed product path',
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

/** The legacy `terminals` service a persistent-shell preset mounts. */
function makeLegacyTerminals() {
  const allocations = []
  return {
    allocations,
    listBackends: () => ['legacy-shell'],
    async spawn(owner, request) {
      allocations.push({ owner: String(owner?.id ?? ''), type: String(request?.type ?? '') })
      return { sessionId: `pty-${String(allocations.length)}`, type: 'legacy-shell', pid: 9000 + allocations.length, status: { kind: 'running' }, motd: 'legacy' }
    },
    startSend() { throw new Error('the legacy terminal must never be reached') },
    read() { throw new Error('the legacy terminal must never be reached') },
    signal() { throw new Error('the legacy terminal must never be reached') },
    async kill() { return true },
    list() { return [] },
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
 * Build one governed world. The `state` object is the LABELLED durable-authority
 * fixture: `generation`/`lifecycle` are what the Host would read from the
 * permission overlay and the MemberInstance row.
 *
 * THE DEFAULT STATE IS THE PRODUCT'S ORDER (WINDOW-HUNT, 2026-11-12): the
 * activation contract mounts the realm INSIDE `createChildSession`, i.e. BEFORE
 * the MemberInstance row is durably written (`activation/provider.ts` steps
 * 13→15). So the default fixture has NO durable row (`lifecycle: undefined`)
 * and the read is made `freshCreate`-aware exactly as the Host's
 * `readGovernedAuthority` is. A suite that defaulted to a committed `RUNNING`
 * row was kinder than production and could not see the window (the #649
 * lesson). Tests that need a durable row pass one explicitly.
 */
async function makeGovernedWorld(label, { blueprintSource, blueprintFor, legacyTerminal = false, state = { generation: 0, lifecycle: undefined } } = {}) {
  const { dir, workspace, writeOnly, secret } = makeWorldDirs(label)
  // `blueprintFor` lets a case build the source from the World's OWN workspace
  // (the ceiling locators must name it); a fixed `blueprintSource` still wins.
  const source = blueprintSource ?? (blueprintFor === undefined ? v4Blueprint({ workspace }) : blueprintFor(workspace))
  const boundBlueprint = blueprintModule.parseBlueprint(source)
  const root = new Context()
  await root.plugin(SystemPrompt)
  await root.plugin(ToolRuntime)
  await root.plugin(TestFileSystem, {})
  const baseSpawns = []
  await root.plugin(TestSubprocess, { spawns: baseSpawns })
  const { standing, agentKey, agentCtx } = presetTopology(root, workspace)
  const legacy = makeLegacyTerminals()
  if (legacyTerminal) standing.ctx.provide('terminals', legacy)
  // The PRESET's `bash` lives on the STANDING scope (inherited by the agent), so
  // the route-C shadow registers on the agent's OWN scope and REPLACES it —
  // exactly the product relationship, not a same-scope collision.
  await standing.ctx.plugin(presetBashPlugin())
  const confined = makeConfinedProvider()
  const provider = governed.createGovernedRealmProvider({
    realmId: governed.GOVERNED_REALM_ID,
    scratchRoot: dir,
    // REAL bound-blueprint resolution seam: the Host's `resolveBoundBlueprint`.
    resolveBoundBlueprint: () => boundBlueprint,
    // DOUBLE 2 (labelled): the durable read. The MAPPING below is the Host's,
    // including the fresh-create window: `freshCreate` is forwarded from the
    // Member descriptor exactly as `host.ts#readGovernedAuthority` does
    // (`input.freshCreate === true`), so the fixture mounts in the SAME order
    // the product does — the row may not exist yet.
    readAuthority: async (input) => governed.governedAuthorityReference({
      generation: state.generation,
      lifecycle: state.lifecycle,
      freshCreate: input?.freshCreate === true,
    }),
    // DOUBLE 1 (labelled): no kernel process is spawned by this suite.
    processProvider: confined,
  })
  return {
    label,
    dir,
    workspace,
    writeOnly,
    secret,
    source,
    boundBlueprint,
    root,
    agentKey,
    agentCtx,
    baseSpawns,
    confined,
    legacy,
    state,
    provider,
  }
}

function governedConfig(extra = {}) {
  return row.a5sfRealmConfigOf({ a5sfGovernedRealm: true, ...extra })
}

function memberOf(world, bindPath = 'fresh-member') {
  return {
    sessionId: `session-${world.label}`,
    instanceId: MEMBER,
    teamRootSessionId: `team-root-${world.label}`,
    templateId: TEMPLATE,
    bindPath,
  }
}

async function mountGoverned(world, config = governedConfig(), bindPath = 'fresh-member') {
  return row.mountMemberA5sfRealm({
    root: world.agentCtx,
    a5sfConfig: config,
    provider: () => world.provider,
    member: memberOf(world, bindPath),
  })
}

async function mountAndAttach(world, config = governedConfig()) {
  const mounted = await mountGoverned(world, config)
  assert.notEqual(mounted, undefined, 'the governed row must mount a realm')
  await row.attachA5sfNativeToolModules(mounted, world.agentCtx, config)
  return mounted
}

/** Read the guard-consult sink the row wrote (facts, not an inference). */
function readFacts(path) {
  if (!existsSync(path)) return []
  return readFileSync(path, 'utf8')
    .split('\n')
    .filter((line) => line.trim() !== '')
    .map((line) => JSON.parse(line))
    .filter((fact) => fact.method === 'shellRead')
}

function toolNames(root, scope) {
  return root.tools.schemas(scope).map((schema) => schema.name)
}

function bashSchema(root, scope) {
  return root.tools.schemas(scope).find((schema) => schema.name === 'bash')
}

async function dispatch(root, agent, name, args) {
  const settled = await root.tools.execute({
    signal: new AbortController().signal,
    callId: `a5sf-governed-${name}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    arguments: args,
    agent,
  })
  const text = Array.isArray(settled.content)
    ? settled.content.map((part) => (part?.type === 'text' ? part.text : '')).join('')
    : ''
  return { isError: settled.isError === true, text, value: settled.value }
}

async function runBash(world, command, workdir = world.workspace) {
  const before = { base: world.baseSpawns.length, confined: world.confined.calls.length, legacy: world.legacy.allocations.length }
  const result = await dispatch(world.root, world.agentKey, 'bash', { command, description: 'governed preset probe', workdir })
  const after = { base: world.baseSpawns.length, confined: world.confined.calls.length, legacy: world.legacy.allocations.length }
  return {
    result,
    delta: { base: after.base - before.base, confined: after.confined - before.confined, legacy: after.legacy - before.legacy },
  }
}

// ===========================================================================
// G0 — the shipped preset row: opt-in only, no second shell, names resolve
// ===========================================================================

test('G0 the shipped preset is declared, opt-in, shell-free, PD-18 closed and resolvable', () => {
  const YAML = runtimeRequire('yaml')
  const composition = YAML.parse(readFileSync(join(REPO_ROOT, 'cordis.patch.yml'), 'utf8').replace(/!!js /g, ''))
  const rows = []
  const visit = (list) => {
    for (const row of list ?? []) {
      if (Array.isArray(row?.insert)) { visit(row.insert); continue }
      rows.push(row)
    }
  }
  visit(composition)
  const hostRow = rows.find((row) => row?.name === 'dsh-agent-team/host')
  assert.notEqual(hostRow, undefined)
  // DEFAULT UNCHANGED: the shipped layer names no preset at all.
  assert.equal(hostRow.config.memberPresetId, undefined, 'the shipped layer never selects a Member preset')
  assert.equal(hostRow.config.rootPresetId, undefined, 'the shipped layer never changes the root preset')
  assert.equal(hostRow.config.a5sfGovernedRealm, undefined, 'the shipped layer never opts a Team into the governed realm')

  const preset = rows.find((row) => row?.config?.id === 'a5sf-governed-member')
  assert.notEqual(preset, undefined, 'the governed preset row is shipped')
  assert.equal(preset.name, '@deepseek-ai/dsh-agent-preset')
  assert.equal(preset.config.order, 50)
  const ids = preset.config.plugins.filter((row) => row?.group !== true).map((row) => row.id)
  assert.equal(ids.includes('tool-bash'), true, 'the preset exposes `bash` (the shadow needs a visible name)')
  assert.equal(ids.includes('tool-pwsh'), false, 'NO second shell: tool-pwsh is not on the governed preset')
  // PD-18 (2026-11-13): the executors that resolved to BASE host services with
  // zero a5sf facts are removed from the governed preset. PD-27 (2026-11-14)
  // restores ONLY the network pair, and only through the Team module that
  // refuses a non-confined scope — the workflow/PTC removal is untouched.
  for (const closed of ['tool-workflow', 'workflow-ptc']) {
    assert.equal(ids.includes(closed), false, `PD-18 fail-closed: ${closed} is not on the governed preset`)
  }
  const webRow = preset.config.plugins.find((row) => row?.id === 'tool-web')
  assert.notEqual(webRow, undefined, 'PD-27: the network pair is back on the governed preset')
  assert.equal(webRow.name, 'dsh-agent-team/web-tool', 'PD-27: and it is the FAIL-CLOSED Team shadow, never the host package row')
  assert.notEqual(webRow.name, '@deepseek-ai/dsh-tool-web', 'PD-18 stays closed: the host web row is what ran on the inherited base service')
  const flat = []
  const flatten = (list) => {
    for (const row of list ?? []) {
      if (row?.group === true) { flatten(row.config); continue }
      flat.push(row)
    }
  }
  flatten(preset.config.plugins)
  for (const forbidden of ['terminals', 'dsh-terminal', 'persistent-shell', 'pty']) {
    assert.equal(flat.some((row) => String(row.name ?? '').includes(forbidden) || String(row.id ?? '').includes(forbidden)), false, `the governed preset must not mount a ${forbidden} row`)
  }
  // Every non-group plugin name is a package this workspace can resolve.
  // A `dsh-agent-team/*` name is a subpath of THIS repository's root package, so
  // its export map is owned by the root manifest, not by `packages/runtime` —
  // the loader in a real install resolves it out of the world's node_modules,
  // where `dsh-agent-team` is the installed bundle.
  const rootRequire = createRequire(join(REPO_ROOT, 'package.json'))
  for (const row of flat) {
    assert.notEqual(row.name, 'cordis:group')
    const base = String(row.name).startsWith('dsh-agent-team/') ? rootRequire : runtimeRequire
    assert.doesNotThrow(() => base.resolve(row.name), `${row.name} (${row.id}) must resolve`)
  }
})

// ===========================================================================
// G1 — the neutral enablement key's contract
// ===========================================================================

test('G1 the neutral key enables WITHOUT compiling, and the fork still fires', () => {
  const config = governedConfig()
  assert.equal(config.governedRealm, true, 'the key rides the wiring block')
  assert.equal(config.memberPolicies, undefined, 'the row compiles NOTHING (no memberPolicies to fork with)')
  assert.equal(config.evidencePath, undefined, 'no evidence file path is needed — the shipped layer can carry this')

  // ABSENT = the legacy path, byte-identical.
  assert.equal(row.a5sfRealmConfigOf({}), undefined, 'an unconfigured row stays unconfigured')
  assert.equal(row.a5sfRealmConfigOf({ a5sfGovernedRealm: null }), undefined, 'null is absent, not enabled')

  // `false` is refused rather than read as absent.
  assert.throws(
    () => row.a5sfRealmConfigOf({ a5sfGovernedRealm: false }),
    /a5sfGovernedRealm must be the boolean true/,
    'a half-written opt-out must never look like a clean default',
  )

  // THE FORK: a row that compiles AND claims a provider refuses, both keys.
  const declaration = {
    schema: 'a5sf-product-member-policies/1',
    teamId: TEAM,
    blueprintRevision: '1',
    authority: { revision: 'a4:1', admitted: true },
    members: [{ templateId: TEMPLATE, instanceGeneration: 1, ceiling: { read: lane(['/w']), write: lane(['/w']), network: { mode: 'allow' } } }],
  }
  for (const [key, value, needle] of [
    ['a5sfMemberPolicies', declaration, /a5sfMemberPolicies/],
    ['a5sfMemberAuthority', { revision: 'a4:1', admitted: true }, /a5sfMemberAuthority/],
  ]) {
    assert.throws(
      () => row.a5sfRealmConfigOf({ a5sfGovernedRealm: true, [key]: value }),
      (error) => {
        assert.equal(error.code, 'REALM_DECLARATION_INVALID')
        assert.match(error.message, /two compiled-realm sources/)
        assert.match(error.message, needle)
        return true
      },
      `${key} + the neutral key is the two-source fork`,
    )
  }
})

test('G1b a governed row with NO provider REFUSES at mount (never silently unmanaged)', async () => {
  const world = await makeGovernedWorld('g1b')
  await assert.rejects(
    () => row.mountMemberA5sfRealm({
      root: world.agentCtx,
      a5sfConfig: governedConfig(),
      provider: () => undefined,
      member: memberOf(world),
    }),
    /governed row that compiles nothing and has no provider would leave the Member with NO realm/,
  )
})

// ===========================================================================
// G2 — no accidental governed Member (v3 / v4-without-ceilings / non-opt-in)
// ===========================================================================

test('G2 a v3 bound blueprint (the shipped default) CANNOT get a governed Member', async () => {
  const world = await makeGovernedWorld('g2-v3', { blueprintSource: v3Blueprint() })
  await assert.rejects(
    () => world.provider.compiledFor(memberOf(world)),
    (error) => {
      assert.equal(error.code, 'MEMBER_POLICY_WITHOUT_BLUEPRINT', 'the refusal is typed, not a silent default')
      assert.match(error.message, /schemaVersion 3/)
      assert.match(error.message, /memberIoCeilings/)
      return true
    },
    'a v3 blueprint has no ceiling family; no silent relaxation and no silent deny-all',
  )
})

test('G2b a v4 blueprint WITHOUT memberIoCeilings also refuses (no implicit ceiling)', async () => {
  const world = await makeGovernedWorld('g2-v4-empty')
  // Rebuild the bound blueprint without the ceiling family.
  const { workspace } = world
  const bare = blueprintModule.parseBlueprint(v4Blueprint({ workspace, ceilings: false }))
  const provider = governed.createGovernedRealmProvider({
    realmId: governed.GOVERNED_REALM_ID,
    scratchRoot: world.dir,
    resolveBoundBlueprint: () => bare,
    readAuthority: async () => governed.governedAuthorityReference({ generation: 0, lifecycle: 'RUNNING' }),
    processProvider: world.confined,
  })
  await assert.rejects(
    () => provider.compiledFor(memberOf(world)),
    (error) => {
      assert.equal(error.code, 'MEMBER_POLICY_WITHOUT_BLUEPRINT')
      assert.match(error.message, /declares no memberIoCeilings family/)
      assert.match(error.message, /schemaVersion 4/)
      return true
    },
  )
})

// ===========================================================================
// G2- PD42 — the SOURCE-OF-DOCUMENT widening (owner ruling 2026-11-11)
//
// `TeamBlueprintV5Core` is the v4 core face (minus the stamp) plus the optional
// `reviewRouting`; the v5 validator hands its core to the v4 validator and the
// v5 hash projection delegates to the v4 one. So a v5 document with
// `memberIoCeilings` MUST be as good a source of Member ceilings as a v4 one —
// and a v5 document WITHOUT the family must refuse with its own truthful
// wording, never "schemaVersion 5 is unsupported".
// ===========================================================================

test('G2d a v5 blueprint with BOTH memberIoCeilings and reviewRouting DERIVES ceilings and mounts the governed realm (PD-42)', async () => {
  const world = await makeGovernedWorld('g2-v5-both', {
    blueprintFor: (workspace) => v4Blueprint({
      workspace,
      schemaVersion: 5,
      reviewRouting: {
        enabled: true,
        officerTemplateId: TEMPLATE,
        ordinaryToolApprovals: { default: 'officer', leaderExceptions: [] },
        whenOfficerUnavailable: 'hold',
      },
    }),
  })
  // The bound document really is v5 AND really carries BOTH families: the
  // positive arm cannot pass by silently falling back to a v4 document.
  assert.equal(world.boundBlueprint.schemaVersion, 5)
  assert.equal(world.boundBlueprint.reviewRouting?.officerTemplateId, TEMPLATE)
  assert.equal(world.boundBlueprint.memberIoCeilings?.length, 1)

  const sinkPath = join(world.dir, 'consult-pd42.jsonl')
  await mountAndAttach(world, governedConfig({ a5sfEvidencePath: sinkPath }))
  try {
    const allow = await runBash(world, 'cat in-lane.txt')
    assert.equal(allow.result.isError, false, `the v5-derived in-lane read must succeed: ${allow.result.text.slice(0, 400)}`)
    assert.equal(JSON.parse(allow.result.text).kind, 'confined-terminal')
    assert.equal(allow.delta.confined, 1)
    assert.equal(allow.delta.base, 0)

    const deny = await runBash(world, `cat ${world.secret}`)
    assert.equal(deny.result.isError, true)
    assert.match(deny.result.text, /IO_READ_DENIED/)
    assert.equal(deny.delta.confined, 0, 'the refusal happened before any confined child')

    const facts = readFacts(sinkPath)
    assert.equal(facts.filter((fact) => fact.decision === 'allow').length, 1, `one ALLOW fact: ${JSON.stringify(facts)}`)
    assert.equal(facts.filter((fact) => fact.decision === 'deny').length, 1, `one DENY fact: ${JSON.stringify(facts)}`)
  } finally {
    await world.root.dispose?.()
  }
})

test('G2e a v5 blueprint WITHOUT memberIoCeilings refuses with v5-specific wording (never "unsupported")', async () => {
  const world = await makeGovernedWorld('g2-v5-empty', {
    blueprintFor: (workspace) => v4Blueprint({
      workspace,
      schemaVersion: 5,
      ceilings: false,
      reviewRouting: {
        enabled: true,
        officerTemplateId: TEMPLATE,
        ordinaryToolApprovals: { default: 'officer', leaderExceptions: [] },
        whenOfficerUnavailable: 'hold',
      },
    }),
  })
  assert.equal(world.boundBlueprint.schemaVersion, 5)
  assert.equal(world.boundBlueprint.memberIoCeilings, undefined)
  await assert.rejects(
    () => world.provider.compiledFor(memberOf(world)),
    (error) => {
      assert.equal(error.code, 'MEMBER_POLICY_WITHOUT_BLUEPRINT', 'the refusal stays typed')
      assert.match(error.message, /schemaVersion 5/)
      assert.match(error.message, /declares no memberIoCeilings family/)
      assert.match(error.message, /v5 face is the v4 face plus the optional `reviewRouting` family/)
      assert.doesNotMatch(error.message, /unsupported/iu, 'a v5 document is NOT an unsupported version')
      return true
    },
    'a v5 document without the family has no ceiling to derive',
  )
})

test('G2f deriveProductRealmDeclaration reads the SAME family out of a v5 document (host-free, PD-42)', () => {
  const workspace = mkdtempSync(join(tmpdir(), 'a5sf-pd42-derive-'))
  dirs.push(workspace)
  const source = v4Blueprint({
    workspace,
    ceilings: false,
    schemaVersion: 5,
    reviewRouting: {
      enabled: true,
      officerTemplateId: TEMPLATE,
      ordinaryToolApprovals: { default: 'officer', leaderExceptions: [] },
      whenOfficerUnavailable: 'hold',
    },
  })
  // Same document, with the family re-inserted into the JSON body.
  const withFamily = source.replace(
    '"metadata": {}',
    `"metadata": {}, "memberIoCeilings": [{"templateId": "${TEMPLATE}", "io": {`
      + `"read": {"mode": "restricted", "allow": ${JSON.stringify([workspace])}, "ask": [], "deny": []},`
      + `"write": {"mode": "restricted", "allow": ${JSON.stringify([workspace])}, "ask": [], "deny": []},`
      + '"network": {"mode": "allow"}}}]',
  )
  const derived = assembly.deriveProductRealmDeclaration({
    blueprintSource: withFamily,
    authority: { revision: 'a4:pd42', admitted: true },
  })
  assert.equal(derived.teamId, TEAM)
  assert.equal(derived.blueprintRevision, '1')
  assert.equal(derived.members.length, 1)
  assert.equal(derived.members[0].templateId, TEMPLATE)
  assert.deepEqual(derived.members[0].ceiling.read.allow, [workspace], 'the ceiling came from the v5 document')
})

test('G2c a NON-opt-in v3 row keeps the legacy path (mounts nothing)', async () => {
  const world = await makeGovernedWorld('g2-legacy', { blueprintSource: v3Blueprint() })
  // No `a5sfGovernedRealm`, no declaration, no evidence path: the row is not wired.
  assert.equal(row.a5sfRealmConfigOf({ blueprintSource: world.source }), undefined)
  const mounted = await row.mountMemberA5sfRealm({
    root: world.agentCtx,
    a5sfConfig: row.a5sfRealmConfigOf({ blueprintSource: world.source }),
    provider: () => world.provider,
    member: memberOf(world),
  })
  assert.equal(mounted, undefined, 'the provider is never asked: the legacy path is unchanged')
  assert.deepEqual(toolNames(world.root, world.agentKey), ['bash'], 'the preset surface is untouched')
})

// ===========================================================================
// G3 — positive read + Member-ceiling denial through the governed `bash`
// ===========================================================================

test('G3 an in-lane read RUNS on the confined terminal face; a lane-denied read is refused with zero bytes and zero confined calls', async () => {
  const world = await makeGovernedWorld('g3')
  const sinkPath = join(world.dir, 'consult-g3.jsonl')
  await mountAndAttach(world, governedConfig({ a5sfEvidencePath: sinkPath }))
  try {
    // POSITIVE READ: an in-lane path is served, through the confined face.
    const allow = await runBash(world, 'cat in-lane.txt')
    assert.equal(allow.result.isError, false, `the in-lane read must succeed: ${allow.result.text.slice(0, 400)}`)
    const allowRecord = JSON.parse(allow.result.text)
    assert.equal(allowRecord.kind, 'confined-terminal', 'the call was served by the confined terminal face')
    assert.equal(allowRecord.exitCode, 0)
    // The confined provider DOUBLE answers a recorded exit (no process exists in
    // this suite); the ALLOW fact below is the real admission decision.
    assert.equal(allowRecord.stdout, 'CONFINED-EXECUTOR\n')
    assert.equal(allow.delta.confined, 1, 'exactly one confined child for the whole command')
    assert.equal(allow.delta.base, 0, 'the inherited host subprocess was never used')

    // CEILING DENIAL: the write-only lane is outside the compiled read lane.
    const deny = await runBash(world, `cat ${world.secret}`)
    assert.equal(deny.result.isError, true, 'the denied read is a tool error, never an empty success')
    assert.match(deny.result.text, /IO_READ_DENIED/)
    assert.equal(deny.result.text.includes(SECRET_MARKER), false, 'ZERO secret bytes reach the model')
    assert.equal(deny.delta.confined, 0, 'the refusal happened at admission: no confined child was started')
    assert.equal(deny.delta.base, 0)

    // The decisions are GUARD FACTS, not inferences from exit codes.
    const facts = readFacts(sinkPath)
    const allowFacts = facts.filter((fact) => fact.decision === 'allow')
    const denyFacts = facts.filter((fact) => fact.decision === 'deny')
    assert.equal(allowFacts.length, 1, `exactly one ALLOW fact: ${JSON.stringify(facts)}`)
    assert.equal(allowFacts[0].decidedBy, 'ALLOW')
    assert.equal(allowFacts[0].locator.startsWith(world.workspace), true, 'the ALLOW fact names the in-lane locator')
    assert.equal(denyFacts.length, 1, `exactly one DENY fact: ${JSON.stringify(facts)}`)
    assert.equal(denyFacts[0].decidedBy, 'IO_READ_DENIED')
    assert.equal(denyFacts[0].locator.includes(SECRET_NAME), true, 'the DENY fact names the refused locator')
  } finally {
    await world.root.dispose?.()
  }
})

// ===========================================================================
// G4 — native tool surface == actual execution provider
// ===========================================================================

test('G4 the model-visible `bash` schema AND the executed provider are the confined terminal face', async () => {
  const world = await makeGovernedWorld('g4')
  await mountAndAttach(world)
  try {
    const names = toolNames(world.root, world.agentKey)
    assert.deepEqual(names.filter((name) => name === 'bash'), ['bash'], 'exactly ONE `bash` — no double surface')

    const schema = bashSchema(world.root, world.agentKey)
    assert.notEqual(schema, undefined)
    const properties = Object.keys(schema.parameters?.properties ?? {})
    assert.deepEqual(properties.sort(), ['command', 'description', 'workdir'], 'the confined terminal tool\'s own parameter set')
    // The three transient-shell affordances are GONE, measured on the schema the
    // model actually sees (not inferred from a name).
    for (const gone of ['run_in_background', 'timeoutMs', 'sandbox_permissions', 'justification']) {
      assert.equal(properties.includes(gone), false, `the confined bash schema must not expose ${gone}`)
    }
    assert.notEqual(schema.description, 'PRESET bash (inherited shell) — the pre-governed product path', 'the preset definition was shadowed, not kept')

    // AND the executed provider is the same face the schema belongs to.
    const { result, delta } = await runBash(world, 'cat in-lane.txt')
    assert.equal(JSON.parse(result.text).kind, 'confined-terminal', 'the DEFINITION and the EXECUTION PROVIDER agree')
    assert.equal(delta.base, 0, 'the inherited shell executed nothing')
  } finally {
    await world.root.dispose?.()
  }
})

// ===========================================================================
// G5 — revocation on Member lifecycle
// ===========================================================================

test('G5 ARCHIVED / DISPOSED / vanished Member rows are NOT admitted, and the provider refuses AUTHORITY_REFUSED', async () => {
  for (const [label, lifecycle] of [['archived', 'ARCHIVED'], ['disposed', 'DISPOSED'], ['missing', undefined]]) {
    const reference = governed.governedAuthorityReference({ generation: 3, lifecycle })
    assert.equal(reference.admitted, false, `${label} is not an admission`)
    assert.equal(reference.instanceGeneration, 3, 'the generation is still reported honestly')
    assert.equal(reference.revision, 'a4:overlay-generation:3')

    // A VANISHED row means "the row a resume expected is gone" — that is the
    // COLD path, not the fresh-create window (a fresh creation with no row is
    // admitted by design, G5c). ARCHIVED/DISPOSED are durable rows and refuse
    // on both paths.
    const bindPath = label === 'missing' ? 'cold-member' : 'fresh-member'
    const world = await makeGovernedWorld(`g5-${label}`, { state: { generation: 3, lifecycle } })
    await assert.rejects(
      () => world.provider.compiledFor(memberOf(world, bindPath)),
      (error) => {
        assert.equal(error.code, 'MEMBER_POLICY_UNAVAILABLE', 'the ONE compiler refused before any realm existed')
        assert.match(error.message, /AUTHORITY_REFUSED/)
        return true
      },
      `${label} must not get a realm`,
    )
    // And the MOUNT refuses too (no realm, no faces, no shadow).
    await assert.rejects(() => mountGoverned(world, governedConfig(), bindPath), /AUTHORITY_REFUSED/)
  }
})

test('G5b a live Member (RUNNING) IS admitted — the negative arm above is not vacuous', () => {
  for (const lifecycle of governed.GOVERNED_ADMITTED_LIFECYCLES) {
    assert.equal(governed.governedAuthorityReference({ generation: 1, lifecycle }).admitted, true, `${lifecycle} is an admission`)
  }
})

// The FRESH-CREATE WINDOW (measured by the live Member turn, 2026-11-12): the
// activation contract commits the MemberInstance row AFTER the child session
// exists, so the realm mount inside `createChildSession` reads no row for the
// instance being activated. Without this window every governed Member failed
// live activation with AUTHORITY_REFUSED — a gap in-process acceptance could
// not see. A durable row still WINS: the window never resurrects a revoked
// Member, and it is only open when the live glue says `fresh-member`.
test('G5c the fresh-create window admits ONLY a not-yet-written row, and a durable row always wins', () => {
  const fresh = governed.governedAuthorityReference({ generation: 0, lifecycle: undefined, freshCreate: true })
  assert.equal(fresh.admitted, true, 'the instance being created is admitted while its durable row does not exist yet')
  assert.equal(fresh.revision, 'a4:overlay-generation:0')
  assert.equal(fresh.instanceGeneration, 0)

  assert.equal(governed.governedAuthorityReference({ generation: 0, lifecycle: undefined }).admitted, false, 'no window => a vanished row is still NOT admitted (G5 arm)')
  for (const lifecycle of ['ARCHIVED', 'DISPOSED']) {
    assert.equal(
      governed.governedAuthorityReference({ generation: 0, lifecycle, freshCreate: true }).admitted,
      false,
      `${lifecycle} is a durable fact and must beat the creation window`,
    )
  }
  for (const lifecycle of governed.GOVERNED_ADMITTED_LIFECYCLES) {
    assert.equal(
      governed.governedAuthorityReference({ generation: 0, lifecycle, freshCreate: true }).admitted,
      true,
      `${lifecycle} stays admitted in the window`,
    )
  }
})

// G5d — THE FIXTURE'S OWN ORDERING IS PINNED (WINDOW-HUNT, 2026-11-12). The
// class #649 found was "in-process tests mount after the row existed; the
// product mounts before it". G5c pins the mapping; this arm pins that the
// SUITE mounts in the product's order: the default world has no durable row,
// the mount goes through the window, and the row that lands AFTER the mount is
// what a later cold attach reads (and its absence refuses).
test('G5d the suite mounts BEFORE the row exists, and the row written after the mount wins on a cold re-attach', async () => {
  const world = await makeGovernedWorld('g5d')
  try {
    assert.equal(world.state.lifecycle, undefined, 'the fixture must start with NO durable MemberInstance row (the product order)')
    const mounted = await mountGoverned(world)
    assert.notEqual(mounted, undefined, 'the realm mounts inside the pre-row window, exactly as in createChildSession')
    assert.equal(world.state.lifecycle, undefined, 'the mount itself did not invent a durable row')

    // The activation flow commits the row AFTER the child session exists; a cold
    // re-attach (no window) then reads that durable fact.
    world.state.lifecycle = 'CREATED'
    const cold = await world.provider.compiledFor(memberOf(world, 'cold-member'))
    assert.notEqual(cold, undefined, 'a cold attach reads the committed row')
    assert.equal(cold.members[0].policy.ok, true)

    // ... and once the durable row is gone again, the COLD path refuses: the
    // window is not a general "missing row is fine" fallback.
    world.state.lifecycle = undefined
    await assert.rejects(
      () => world.provider.compiledFor(memberOf(world, 'cold-member')),
      /AUTHORITY_REFUSED/,
      'a cold resume with no row is a vanished Member, not a fresh creation',
    )
  } finally {
    await world.root.dispose?.()
  }
})

// ===========================================================================
// G6 — invalidation after a generation move
// ===========================================================================

test('G6 the authority generation is read PER ATTACH: the policy revision follows it, and a stale pairing is refused', async () => {
  const world = await makeGovernedWorld('g6', { state: { generation: 0, lifecycle: 'RUNNING' } })
  const first = await world.provider.compiledFor(memberOf(world))
  assert.notEqual(first, undefined)
  const firstRevision = first.members[0].policy.value.revision

  world.state.generation = 1
  const second = await world.provider.compiledFor(memberOf(world))
  const secondRevision = second.members[0].policy.value.revision
  assert.notEqual(secondRevision, firstRevision, 'a durable generation move changes the compiled revision — a cached policy cannot be silently re-served')

  // The ONE compiler refuses a pairing whose authority generation is stale.
  const plan = assembly.deriveProductRealmPlanFromBlueprint({
    blueprint: world.boundBlueprint,
    authority: { revision: 'a4:overlay-generation:1', admitted: true },
    instanceGenerations: { [TEMPLATE]: 1 },
  })
  const stale = memberPolicy.compileMemberPolicy({
    trustedMember: { teamId: TEAM, memberInstanceId: MEMBER, templateId: TEMPLATE, instanceGeneration: 0 },
    boundBlueprint: { teamId: TEAM, blueprint: plan.blueprint },
    effectiveAuthority: { revision: 'a4:overlay-generation:1', memberInstanceId: MEMBER, instanceGeneration: 1, admitted: true },
  })
  assert.equal(stale.ok, false)
  assert.equal(stale.code, 'MEMBER_GENERATION_STALE')
})

// ===========================================================================
// G7 — a persistent shell still fails closed (no double terminal)
// ===========================================================================

test('G7 a world that also mounts a persistent shell is REFUSED (TERMINALS_DOUBLE_TERMINAL_REFUSED), zero legacy allocations', async () => {
  const world = await makeGovernedWorld('g7', { legacyTerminal: true })
  await assert.rejects(
    () => mountGoverned(world),
    (error) => {
      assert.match(String(error?.message ?? error), /TERMINALS_DOUBLE_TERMINAL_REFUSED/)
      return true
    },
    'a governed Member never holds a governed and an ungoverned shell at once',
  )
  assert.equal(world.legacy.allocations.length, 0, 'the legacy PTY service was never reached')
  assert.equal(toolNames(world.root, world.agentKey).includes('bash'), true, 'the preset bash is still there — the refusal is the realm\'s')
})
