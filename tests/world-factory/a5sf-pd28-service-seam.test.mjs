/**
 * tests/world-factory/a5sf-pd28-service-seam.test.mjs — PD-28: the confined
 * `skill` and `present` capabilities are served by the SEAM, not by forked
 * consumer tools.
 *
 * WHY THIS SUITE EXISTS. PD-26 restored `skill`/`present` by writing two Team
 * TOOL modules (`confined-skill-tool.mjs`, `confined-present-tool.mjs`) that
 * re-implemented the pinned host packages' definitions. The audit of PD-26 is
 * right: `@deepseek-ai/dsh-tool-skill` only calls `ctx.skills.list()/get()`,
 * and `@deepseek-ai/dsh-tool-present` only calls `ctx.fs.lstat/resolve/stat` +
 * `ctx.on('tools/result')`. Neither tool has a filesystem capability of its
 * own, so forking them cannot be the fix. What was missing was what a tool
 * CONSUMES:
 *
 *   skills face   a `skills` PROVIDER. The preset's `skill-filesystem`
 *                 provider reads through the preset scope's base `fs`; a
 *                 provider registered from the Member's realm reads through the
 *                 realm's confined `fs` face. The pinned host `tool-skill` row
 *                 stays byte-untouched.
 *   event face    the registration router's `isolate('tools', …)` label.
 *                 Cordis filters service-scoped events by the provider's
 *                 isolation label, and `tools/result` is dispatched through
 *                 the `tools` service, so a routed `present` never receives
 *                 the result of its own call. Mounted DIRECTLY on the realm
 *                 scope (same `fs` label, real `tools` label) it does.
 *
 * This suite is HOST-FREE (no boot, no port, no DSH_HOME) and drives the REAL
 * `mountMemberA5sfRealm` + `attachA5sfNativeToolModules` with the REAL pinned
 * `@deepseek-ai/dsh-tool-skill`, `@deepseek-ai/dsh-tool-present` and
 * `@deepseek-ai/dsh-skill` registry, over the REAL compiled guard (the
 * `TestFileSystem` provider class the route-C suite uses, so every consult
 * writes an `a5sf-guard-consult/1` fact).
 *
 *   PIN                with A5SF_PD28_PIN=1 the pre-fix behaviour is measured
 *                      on the SAME harness: with no `skills` provider the
 *                      pinned host `skill` answers "unknown"; with route C
 *                      skipped the pinned host `present` reads through the
 *                      BASE `fs` and accepts a real out-of-lane file with ZERO
 *                      guard facts (PD-24's hole). The git half records that
 *                      BASE carries the two Team shadows and no provider.
 *   HOST-DEFINITIONS   the agent-resolved `skill` definition is the preset
 *                      row's own object (nothing shadows it) and the
 *                      agent-resolved `present` definition is the host
 *                      package's own definition (description, schema, output,
 *                      render and execute source equal a clean host mount).
 *                      NO Team `present`/`skill` implementation exists.
 *   SKILL-IN           a declared in-lane skill body is returned by the NATIVE
 *                      `skill` tool; the body came through the confined face
 *                      (allow facts), and the surface did not change.
 *   SKILL-OUT          a declared out-of-lane skill is REFUSED by the native
 *                      tool with 0 bytes, a typed IO_READ_DENIED and exactly
 *                      ONE deny fact; `error.info.code` carries the code (the
 *                      HarnessError change), and the refusal is not an
 *                      existence answer.
 *   PRESENT-IN         the native `present` succeeds and appends EXACTLY ONE
 *                      `deliverables/presented` — the event seam acceptance.
 *   PRESENT-OUT        an existing out-of-lane file AND a missing out-of-lane
 *                      file are both refused with ONE deny fact each, ZERO
 *                      events, and no "not found" existence oracle.
 *   CATALOG            a malformed catalog refuses at assembly; the row parser
 *                      uses the same validator.
 *
 * MUTATION CONTROL hooks (never set in CI), driven by
 * `tests/world-factory/a5sf-pd28-mutation-controls.mjs`:
 *   A5SF_PD28_SKILL_FS=base   the provider is mounted on the PRESET scope (the
 *                             base `fs`) instead of the realm: SKILL-OUT goes
 *                             red for the right reason (body returned, 0 facts).
 *   A5SF_PD28_PRESENT_ROUTED=1 the host `present` package is mounted ROUTED
 *                             (through the registration router) instead of
 *                             direct: PRESENT-IN goes red (0 delivery events).
 *
 * Run: node --test tests/world-factory/a5sf-pd28-service-seam.test.mjs
 */
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire, register } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import test, { after } from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = join(HERE, '..', '..')
const PIN = process.env.A5SF_PD28_PIN === '1'
const SKILL_FS = process.env.A5SF_PD28_SKILL_FS
const PRESENT_ROUTED = process.env.A5SF_PD28_PRESENT_ROUTED === '1'
/** origin/master at the PD-28 branch point (PD-26 merged). */
const BASE_COMMIT = '24d2cf760'

register(pathToFileURL(join(REPO, 'scripts', 'run-tests-hooks.mjs')).href)

const row = await import(pathToFileURL(join(REPO, 'packages', 'runtime', 'src', 'plugin', 'live', 'a5sf-realm-row.mjs')).href)
const providerModule = await import(pathToFileURL(join(REPO, 'packages', 'runtime', 'src', 'plugin', 'live', 'a5sf-skill-provider.mjs')).href)
const runtimeRequire = createRequire(join(REPO, 'packages', 'runtime', 'package.json'))
const load = (spec) => import(pathToFileURL(runtimeRequire.resolve(spec)).href)
const { Context, Service } = await load('@deepseek-ai/cordis')
const ToolRuntime = (await load('@deepseek-ai/dsh-tools')).default
const SystemPrompt = (await load('@deepseek-ai/dsh-system-prompt')).default
const SkillRegistry = (await load('@deepseek-ai/dsh-skill')).default
const { createScope, bindScopeParent } = await load('@deepseek-ai/dsh-scope')
const hostSkill = await load('@deepseek-ai/dsh-tool-skill')
const hostPresent = await load('@deepseek-ai/dsh-tool-present')
const HOST_PRESENT_SPECIFIER = '@deepseek-ai/dsh-tool-present'

const IDENTITY = Object.freeze({ teamId: 'team-a5sf-pd28', memberInstanceId: 'member-pd28', templateId: 'worker', instanceGeneration: 1 })
const MEMBER_REVISION = 'a5sf1:member-pd28:g1'
const IN_LANE_BODY = 'A5SF_PD28_IN_LANE_SKILL_BODY'
const OUT_OF_LANE_BODY = 'A5SF_PD28_OUT_OF_LANE_SECRET_BODY'

// --- fixture world ----------------------------------------------------------
const dirs = []
function mktemp(label) {
  const dir = mkdtempSync(join(tmpdir(), `a5sf-pd28-${label}-`))
  dirs.push(dir)
  return dir
}
const FIXTURE = mktemp('world')
const LANE = join(FIXTURE, 'lane')
const OUTSIDE = join(FIXTURE, 'outside')
mkdirSync(join(LANE, 'skills'), { recursive: true })
mkdirSync(join(OUTSIDE, 'skills'), { recursive: true })
const IN_SKILL = join(LANE, 'skills', 'pd28-in-lane', 'SKILL.md')
const OUT_SKILL = join(OUTSIDE, 'skills', 'pd28-out-of-lane', 'SKILL.md')
const IN_FILE = join(LANE, 'deliverable.txt')
const OUT_FILE = join(OUTSIDE, 'secret.txt')
const MISSING_FILE = join(OUTSIDE, 'does-not-exist.txt')
mkdirSync(dirname(IN_SKILL), { recursive: true })
mkdirSync(dirname(OUT_SKILL), { recursive: true })
writeFileSync(IN_SKILL, `---\ndescription: in-lane fixture\n---\n${IN_LANE_BODY}`)
writeFileSync(OUT_SKILL, `---\ndescription: out-of-lane fixture\n---\n${OUT_OF_LANE_BODY}`)
writeFileSync(IN_FILE, 'deliverable\n')
writeFileSync(OUT_FILE, OUT_OF_LANE_BODY)
const SINK = join(mktemp('sink'), 'consult.jsonl')

const CATALOG = Object.freeze([
  { name: 'pd28-in-lane', description: 'in-lane fixture', path: IN_SKILL },
  { name: 'pd28-out-of-lane', description: 'out-of-lane fixture', path: OUT_SKILL },
])

function lane(allow) {
  return Object.freeze({ mode: 'restricted', allow: Object.freeze([...allow]), ask: Object.freeze([]), deny: Object.freeze([]) })
}
function compileForFixture() {
  return () => ({
    compiledFor: () => ({
      members: [{
        identity: IDENTITY,
        policy: {
          ok: true,
          value: Object.freeze({
            memberIdentity: IDENTITY.memberInstanceId,
            templateId: IDENTITY.templateId,
            instanceGeneration: IDENTITY.instanceGeneration,
            revision: MEMBER_REVISION,
            read: lane([LANE]),
            write: lane([LANE]),
            network: Object.freeze({ access: 'allow' }),
          }),
        },
      }],
      providerClass: TestFileSystem,
    }),
  })
}

/** The BASE provider double (node:fs), and the class the realm's guard wraps. */
class TestFileSystem extends Service {
  constructor(ctx) {
    super(ctx, 'fs')
  }
  processPath(target) {
    return target.hostPath
  }
  contains(parent, child) {
    return this.processPath(child).startsWith(this.processPath(parent))
  }
  async resolve(path) {
    return { hostPath: path }
  }
  async readText(target) {
    return readFileSync(this.processPath(target), 'utf8')
  }
  async readBytes(target) {
    return readFileSync(this.processPath(target))
  }
  async readByteRange(target, range) {
    return readFileSync(this.processPath(target)).subarray(range.offset, range.offset + range.length)
  }
  async streamText(target) {
    const text = readFileSync(this.processPath(target), 'utf8')
    return (async function* stream() { yield text })()
  }
  async listDir() {
    return []
  }
  async stat(target) {
    const path = this.processPath(target)
    return existsSync(path) ? { type: 'file', size: readFileSync(path).length } : undefined
  }
  async lstat(path) {
    return existsSync(path) ? { type: 'file', size: readFileSync(path).length } : undefined
  }
  async watch() {
    return async () => {}
  }
  async writeText() {
    return { version: 'v1' }
  }
  async editText() {
    return { version: 'v2' }
  }
}

async function makeRoot() {
  const root = new Context()
  await root.plugin(SystemPrompt)
  await root.plugin(ToolRuntime)
  await root.plugin(TestFileSystem)
  await root.plugin(SkillRegistry)
  // The pinned `tool-skill` declares `agents`; this suite never reaches a real
  // agent registry (the tool only reads `exec.agent.session.header.cwd`).
  await root.plugin({ name: 'pd28-fake-agents', apply: (ctx) => { ctx.provide('agents', { get: () => undefined, list: () => [] }) } })
  // The pinned `tool-present` declares `sessionProjections`.
  await root.plugin({
    name: 'pd28-fake-projections',
    apply: (ctx) => { ctx.provide('sessionProjections', { stateOf: () => ({ openTurnStartSeq: 1, lastTurn: 7 }) }) },
  })
  return root
}

/** The shipped preset topology: rows on a STANDING scope above the agent. */
async function presetTopology(root, { withPresent = true } = {}) {
  const standingKey = {}
  const standing = createScope(root, standingKey)
  const appended = []
  const session = { header: { cwd: FIXTURE }, append: (type, data) => appended.push({ type, data }) }
  const agent = { session }
  const agentScope = createScope(root, agent)
  bindScopeParent(agent, standingKey)
  await standing.ctx.plugin(hostSkill, {})
  if (withPresent) await standing.ctx.plugin(hostPresent, { maxFiles: 8 })
  return { standingKey, standing, agent, agentCtx: agentScope.ctx, appended }
}

function configOf(extra = {}) {
  return row.a5sfRealmConfigOf({ a5sfEvidencePath: SINK, a5sfNativeToolModules: [], ...extra })
}

function realmArgs(agentCtx) {
  return {
    root: agentCtx,
    provider: compileForFixture(),
    member: { sessionId: 'session-pd28', instanceId: IDENTITY.memberInstanceId, teamRootSessionId: 'team-root', templateId: IDENTITY.templateId },
  }
}

const toolNames = (root, scope) => root.tools.schemas(scope).map((schema) => schema.name)
async function dispatch(root, agent, name, args) {
  const settled = await root.tools.execute({
    signal: new AbortController().signal,
    callId: `pd28-${name}-${String(Math.random()).slice(2)}`,
    name,
    arguments: args,
    agent,
  })
  const text = Array.isArray(settled.content)
    ? settled.content.map((part) => (part?.type === 'text' ? part.text : '')).join('')
    : ''
  return { isError: settled.isError === true, text, value: settled.value, info: settled.error?.info }
}
function facts() {
  if (!existsSync(SINK)) return []
  return readFileSync(SINK, 'utf8').trim().split('\n').filter(Boolean).map((line) => JSON.parse(line))
}
function clearFacts() {
  if (existsSync(SINK)) rmSync(SINK)
}
function deliveries(appended) {
  return appended.filter((entry) => entry.type === 'deliverables/presented')
}

after(() => {
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true })
})

/**
 * The full current-world arm: preset rows above, realm + route-C attach after.
 * Returns everything an arm needs to judge the two seams.
 */
async function governedWorld({
  catalog = CATALOG,
  // MUTATION hooks: the SAME suite is driven with one seam broken, so the arm
  // that depends on it must go red (see a5sf-pd28-mutation-controls.mjs).
  presentOwner = PRESENT_ROUTED ? { url: HOST_PRESENT_SPECIFIER, config: {}, expectedTools: ['present'] } : undefined,
  mountProviderOnStanding = SKILL_FS === 'base',
} = {}) {
  const root = await makeRoot()
  const world = await presetTopology(root)
  const presetSkill = root.tools.get('skill', world.agent)
  const presetPresent = root.tools.get('present', world.agent)
  const before = toolNames(root, world.agent)
  clearFacts()

  let standingProvider
  if (mountProviderOnStanding) {
    // MUTATION (A5SF_PD28_SKILL_FS=base): the provider is mounted on the PRESET
    // scope, whose `fs` is the inherited base provider. Same module, same
    // catalog, same consumer — only the SERVICE's face is wrong.
    await world.standing.ctx.plugin(providerModule, { skills: catalog })
    standingProvider = true
  }
  const config = configOf({
    ...(standingProvider ? {} : { a5sfSkillCatalog: catalog }),
    ...(presentOwner === undefined ? {} : { a5sfNativeToolModules: [presentOwner] }),
  })
  const realm = await row.mountMemberA5sfRealm({ ...realmArgs(world.agentCtx), a5sfConfig: config })
  await row.attachA5sfNativeToolModules(realm, world.agentCtx, config)
  return { root, world, realm, config, presetSkill, presetPresent, before, standingProvider }
}

// ===========================================================================
// HOST-DEFINITIONS — no Team tool implementation survives
// ===========================================================================
test('PD28-HOST-DEFINITIONS: `skill` is the preset row itself and `present` is the host package\'s own definition', async () => {
  const { root, world, realm, presetSkill, presetPresent, before } = await governedWorld()
  try {
    // The surface is unchanged (route C is surface-neutral).
    assert.deepEqual(toolNames(root, world.agent), before, 'the attach must not add or remove a model-visible name')
    assert.deepEqual(before.sort(), ['present', 'skill'], 'fixture premise: the preset offers exactly the two names')

    // `skill`: NOT shadowed at all — the preset row's own definition object is
    // what the agent resolves. The provider is a service, not a tool.
    assert.equal(root.tools.get('skill', world.agent), presetSkill, 'nothing may shadow the pinned `skill` tool: PD-28 removes the fork rather than moving it')
    // `present`: shadowed ONLY because the HOST module is re-mounted.
    assert.notEqual(root.tools.get('present', world.agent), presetPresent, 'the routed-to-direct mount must replace the preset definition (else the base-fs listener stays)')

    // The host package's OWN definition, captured from a clean registry mount.
    const capture = async (plugin, config, services) => {
      const registered = []
      const ctx = {
        tools: { register: (definition) => { registered.push(definition); return () => {} } },
        systemPrompt: { section: (section) => () => section, getSectionOrder: () => 1100 },
        on: () => () => {},
        get: (name) => services[name],
        ...services,
      }
      plugin.apply(ctx, config)
      return registered[0]
    }
    const cleanFs = new TestFileSystem(new Context())
    const cleanSkill = await capture(hostSkill, {}, { fs: new TestFileSystem(new Context()), skills: {}, agents: {} })
    const cleanPresent = await capture(hostPresent, { maxFiles: 8 }, {
      fs: cleanFs,
      sessionProjections: { stateOf: () => ({ openTurnStartSeq: 1, lastTurn: 1 }) },
    })
    const resolvedPresent = root.tools.get('present', world.agent)
    for (const key of ['name', 'description']) {
      assert.equal(resolvedPresent[key], cleanPresent[key], `present.${key} must be the host package's own`)
    }
    assert.deepEqual(resolvedPresent.parameters, cleanPresent.parameters, 'present.parameters must be the host package\'s own schema')
    assert.deepEqual(resolvedPresent.output.schema, cleanPresent.output.schema, 'present output schema must be the host package\'s own')
    assert.equal(String(resolvedPresent.execute), String(cleanPresent.execute), 'present.execute must be the host package\'s own function source, not a Team copy')
    assert.equal(resolvedPresent.presentCall === undefined, cleanPresent.presentCall === undefined, 'presentCall shape must match the host package')
    // The preset `skill` definition is the host module's by construction, but
    // pin its schema so a "restore" cannot quietly become a paraphrase.
    assert.equal(presetSkill.description, cleanSkill.description)
    assert.deepEqual(presetSkill.parameters, cleanSkill.parameters)
  } finally {
    await realm.dispose()
  }
})

// ===========================================================================
// SKILL-IN / SKILL-OUT — the confined `skills` provider
// ===========================================================================
test('PD28-SKILL: the NATIVE `skill` tool returns the in-lane body and refuses the out-of-lane one (0 bytes, 1 deny fact)', async () => {
  const { root, world, realm } = await governedWorld()
  try {
    assert.deepEqual(facts(), [], 'mounting the provider must consult the lane ZERO times (the catalog is declaration data)')

    const inLane = await dispatch(root, world.agent, 'skill', { name: 'pd28-in-lane' })
    assert.equal(inLane.isError, false, `the in-lane skill must load through the native tool (got ${inLane.text})`)
    assert.equal(inLane.value.content, IN_LANE_BODY, 'the body must be the file body (frontmatter stripped), read through the confined face')
    assert.equal(inLane.value.provider, 'a5sf-confined')
    assert.equal(String(JSON.stringify(inLane.value)).includes(OUT_OF_LANE_BODY), false, 'the allowed result must not carry the out-of-lane body')
    const inFacts = facts()
    assert.equal(inFacts.length, 1, `the in-lane load must cost EXACTLY ONE lane consult (the body read), got ${JSON.stringify(inFacts)}`)
    assert.equal(inFacts[0].decision, 'allow')
    assert.equal(inFacts[0].method, 'readText', 'the BODY read itself must be admitted by the lane')
    assert.equal(String(inFacts[0].tool ?? ''), 'skill', 'the fact must be attributed to the native `skill` tool')

    clearFacts()
    const outLane = await dispatch(root, world.agent, 'skill', { name: 'pd28-out-of-lane' })
    assert.equal(outLane.isError, true, 'an out-of-lane declared skill must be REFUSED, never served')
    assert.equal(outLane.text.includes(OUT_OF_LANE_BODY), false, 'the refusal must disclose ZERO bytes of the body')
    assert.match(outLane.text, /IO_READ_DENIED/u, 'the refusal must be typed in the model-visible text')
    assert.match(outLane.text, /outside every allow subtree/u, 'the refusal must be the compiled lane decision, not "unknown skill"')
    assert.equal(/unknown or no longer available/u.test(outLane.text), false, 'a declared-but-refused skill must not look ABSENT')
    assert.equal(outLane.info?.code, 'IO_READ_DENIED', 'the tool result must carry the typed code (HarnessError.info)')
    const outFacts = facts()
    assert.equal(outFacts.length, 1, `exactly ONE lane consult for the refusal, got ${JSON.stringify(outFacts)}`)
    assert.equal(outFacts[0].decision, 'deny')
    assert.equal(outFacts[0].decidedBy, 'IO_READ_DENIED')
    assert.equal(outFacts[0].locator, OUT_SKILL)
  } finally {
    await realm.dispose()
  }
})

// ===========================================================================
// PRESENT-IN / PRESENT-OUT — the direct mount's event seam
// ===========================================================================
test('PD28-PRESENT: the native `present` records EXACTLY ONE delivery in-lane and refuses out-of-lane with no event', async () => {
  const { root, world, realm } = await governedWorld()
  try {
    const allowed = await dispatch(root, world.agent, 'present', { files: [{ path: IN_FILE, description: 'pd28 deliverable' }] })
    assert.equal(allowed.isError, false, `the in-lane presentation must succeed (got ${allowed.text})`)
    assert.equal(allowed.value.files.length, 1)
    assert.equal(deliveries(world.appended).length, 1, 'the EVENT SEAM: the host module\'s own `tools/result` listener must append EXACTLY ONE deliverables/presented')
    assert.equal(facts().length >= 1, true, 'the in-lane lstat/stat must consult the lane')

    world.appended.length = 0
    clearFacts()
    const outLane = await dispatch(root, world.agent, 'present', { files: [{ path: OUT_FILE, description: 'pd28 denied' }] })
    assert.equal(outLane.isError, true, 'an existing out-of-lane file must be REFUSED')
    assert.equal(outLane.text.includes(OUT_OF_LANE_BODY), false, 'the refusal must not disclose the file bytes')
    assert.match(outLane.text, /IO_READ_DENIED|outside every allow subtree/u, 'the refusal must be typed')
    assert.equal(outLane.info?.code, 'IO_READ_DENIED', 'the refused present must carry the typed code')
    assert.equal(deliveries(world.appended).length, 0, 'a refused presentation must append NO deliverables/presented event')
    const outFacts = facts()
    assert.equal(outFacts.length, 1, `exactly ONE lane consult for the refused file, got ${JSON.stringify(outFacts)}`)
    assert.equal(outFacts[0].decision, 'deny')

    clearFacts()
    const missing = await dispatch(root, world.agent, 'present', { files: [{ path: MISSING_FILE, description: 'pd28 missing' }] })
    assert.equal(missing.isError, true, 'a missing out-of-lane file must be REFUSED')
    assert.equal(/not found|no such file/iu.test(missing.text), false, 'the refusal must never be an existence answer (no "not found")')
    assert.equal(missing.info?.code, 'IO_READ_DENIED', 'the missing path must be refused by the LANE, not by an ENOENT probe')
    assert.equal(deliveries(world.appended).length, 0, 'a refused presentation must append NO event')
    const missingFacts = facts()
    assert.equal(missingFacts.length, 1, `exactly ONE lane consult for the missing file, got ${JSON.stringify(missingFacts)}`)
    assert.equal(missingFacts[0].decision, 'deny')
  } finally {
    await realm.dispose()
  }
})

// ===========================================================================
// CATALOG — configuration faults refuse at assembly
// ===========================================================================
test('PD28-CATALOG: malformed declarations refuse, valid ones normalize, the row parser shares the validator', async () => {
  assert.deepEqual(providerModule.skillCatalogOf(undefined), [])
  assert.deepEqual(
    providerModule.skillCatalogOf([{ name: 'a-skill', description: 'd', path: '/x/SKILL.md' }]).map((entry) => entry.name),
    ['a-skill'],
  )
  for (const bad of [
    'not-an-array',
    [null],
    [{ name: 'bad name!', description: 'd', path: '/x' }],
    [{ name: 'ok', description: '   ', path: '/x' }],
    [{ name: 'ok', description: 'd', path: '   ' }],
    [{ name: 'ok', description: 'd', path: '/x' }, { name: 'ok', description: 'd', path: '/y' }],
  ]) {
    assert.throws(
      () => providerModule.skillCatalogOf(bad),
      /a5sf-skill-provider: config\.skills/u,
      `expected a typed refusal for ${JSON.stringify(bad)}`,
    )
  }
  assert.throws(
    () => row.a5sfRealmConfigOf({ a5sfEvidencePath: SINK, a5sfSkillCatalog: [{ name: 'bad name!', description: 'd', path: '/x' }] }),
    /config\.skills/u,
  )
})

// ===========================================================================
// PIN — the same harness without the two seams reproduces PD-23/PD-24
// ===========================================================================
test('PD28-PIN: without a provider the host `skill` is unknown, without route C the host `present` reads the BASE fs', { skip: !PIN }, async () => {
  // The git half: BASE carries the two Team shadows and no provider.
  const baseRow = execFileSync('git', ['-C', REPO, 'show', `${BASE_COMMIT}:packages/runtime/src/plugin/live/a5sf-realm-row.mjs`], { encoding: 'utf8' })
  const baseFiles = execFileSync('git', ['-C', REPO, 'ls-tree', '-r', '--name-only', BASE_COMMIT, 'packages/runtime/src/plugin/live'], { encoding: 'utf8' }).split('\n')
  assert.equal(baseFiles.includes('packages/runtime/src/plugin/live/confined-skill-tool.mjs'), true, 'BASE must carry the PD-26 `skill` tool fork')
  assert.equal(baseFiles.includes('packages/runtime/src/plugin/live/confined-present-tool.mjs'), true, 'BASE must carry the PD-26 `present` tool fork')
  assert.equal(baseFiles.includes('packages/runtime/src/plugin/live/a5sf-skill-provider.mjs'), false, 'BASE must carry NO `skills` provider — the service this lane adds')
  assert.match(baseRow, /confined-skill-tool\.mjs/u)
  assert.match(baseRow, /confined-present-tool\.mjs/u)
  assert.equal(/a5sf-skill-provider/u.test(baseRow), false, 'BASE must not know the provider')
  // ... and the current row knows only the host package + the provider.
  const nowRow = readFileSync(join(REPO, 'packages', 'runtime', 'src', 'plugin', 'live', 'a5sf-realm-row.mjs'), 'utf8')
  assert.equal(/confined-skill-tool|confined-present-tool/u.test(nowRow), false, 'the shipped row must not reference either fork')
  assert.match(nowRow, /a5sf-skill-provider\.mjs/u)

  // Arm A: the pinned host `skill` with NO provider anywhere = "unknown",
  // exactly the pre-fix governed preset PD-23 disclosed.
  clearFacts()
  const bare = await makeRoot()
  const bareWorld = await presetTopology(bare, { withPresent: false })
  const bareSkill = await dispatch(bare, bareWorld.agent, 'skill', { name: 'pd28-in-lane' })
  assert.equal(bareSkill.isError, true)
  assert.match(bareSkill.text, /unknown or no longer available/u, 'with no provider the native tool must answer "unknown" — a capability absence, not a refusal')
  assert.deepEqual(facts(), [], 'with no provider nothing is read and nothing is consulted')

  // Arm B: without route C the pinned host `present` runs on the BASE fs:
  // PD-24's measured hole — a real out-of-lane file ACCEPTED, zero facts, an
  // event appended. The current tree (PRESENT-IN/OUT) is the flip.
  clearFacts()
  const root = await makeRoot()
  const world = await presetTopology(root)
  const basePresent = await dispatch(root, world.agent, 'present', { files: [{ path: OUT_FILE, description: 'pd24 hole' }] })
  assert.equal(basePresent.isError, false, 'the PRE-FIX `present` must accept the out-of-lane file (PD-24)')
  assert.deepEqual(facts(), [], 'PD-24: the base-fs read consults the compiled lane ZERO times')
  assert.equal(deliveries(world.appended).length, 1, 'PD-24: the unguarded presentation still appends its event')
})
