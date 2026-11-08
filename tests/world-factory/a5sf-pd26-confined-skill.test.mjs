/**
 * tests/world-factory/a5sf-pd26-confined-skill.test.mjs — PD-26: the governed
 * Member's `skill` and `present` reads now ride the realm's CONFINED `fs`
 * face, so the capability PD-23/PD-24 removed fail-closed is restored
 * HONESTLY instead of by routing around the guard.
 *
 * WHY THIS SUITE EXISTS. PD-23 measured the preset's `skill` loader reading a
 * `$DSH_HOME/skills` body through the BASE `fs` (body in 7 model requests, ZERO
 * guard facts) and removed `tool-skill`/`skill-filesystem`; PD-24 measured
 * `present` `lstat`/`stat`-ing through the BASE `fs` (a real out-of-lane file
 * ACCEPTED, a missing one refused `file not found`, zero facts, two
 * `deliverables/presented` events) and removed the row. Both left the governed
 * preset with a disclosed CAPABILITY REGRESSION and named the same missing
 * seam: a route-C product row that resolves the Member's confined provider.
 *
 * This suite is HOST-FREE (no boot, no port, no DSH_HOME) and pins:
 *
 *   PIN                 with A5SF_PD26_PIN=1 the recorded pre-fix commit
 *                       (1e650c3e3) is read out of git: its governed preset
 *                       declares NO `skill`/`present` row, and both names are
 *                       the host router's typed `unknown tool` against a real
 *                       tool registry. The CURRENT composition declares both,
 *                       so the pin is a measured before/after, not a story.
 *   SURFACE             the shipped preset restores the two NAMES
 *                       (`@deepseek-ai/dsh-tool-skill` / `-tool-present`) and
 *                       does NOT restore the base-fs `skill-filesystem`
 *                       provider; the retained rows are untouched.
 *   CONTRACT-SKILL      the Team `skill` module, mounted over a fake CONFINED
 *                       `fs`: an in-lane `SKILL.md` returns its body; an
 *                       out-of-lane body is a typed `IO_READ_DENIED` with ZERO
 *                       bytes and exactly ONE read attempt (the shape PD-17's
 *                       native `read` arm pins).
 *   CONTRACT-PRESENT    the Team `present` module (the host package's own
 *                       `apply` over a fake CONFINED `fs`): an in-lane file is
 *                       presented and one `deliverables/presented` event is
 *                       appended; an out-of-lane path is a typed
 *                       `IO_READ_DENIED`, appends NO event, and never reaches
 *                       `resolve`/`stat`.
 *   PARITY              the shadow's `skill` definition is the shipped
 *                       package's own description + parameter schema (this file
 *                       copies them; a drift would be a silent product change).
 *
 * MUTATION CONTROL hooks (never set in CI):
 *   A5SF_PD26_SKILL_MODULE=<path>   CONTRACT-SKILL imports a MUTATED module copy
 *                                   (the base-`fs` regression the lane exists
 *                                   to prevent) so its deny arm must go red
 *   A5SF_PD26_COMPOSITION=<path>    SURFACE reads a mutated composition
 *                                   (a dropped `tool-present` row) so it must
 *                                   go red
 * `tests/world-factory/a5sf-pd26-mutation-controls.mjs` drives both and asserts
 * each one reddens exactly the arm it names.
 *
 * What is fixture (disclosed): the fake `fs`/`tools`/`sessionProjections`
 * doubles and the mutated copies. The product code under test is the two
 * route-C modules, the row-config parser and the shipped composition.
 *
 * Run: node --test tests/world-factory/a5sf-pd26-confined-skill.test.mjs
 */
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { test } from 'node:test'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..', '..')
const COMPOSITION = process.env.A5SF_PD26_COMPOSITION ?? join(REPO, 'cordis.patch.yml')
const PIN = process.env.A5SF_PD26_PIN === '1'
const SKILL_MODULE = process.env.A5SF_PD26_SKILL_MODULE
  ?? join(REPO, 'packages', 'runtime', 'src', 'plugin', 'live', 'confined-skill-tool.mjs')
const PRESENT_MODULE = join(REPO, 'packages', 'runtime', 'src', 'plugin', 'live', 'confined-present-tool.mjs')
/** The recorded start of this task (origin/master at the PD-26 branch point). */
const BASE_COMMIT = '1e650c3e3'
const PRESET_ID = 'a5sf-governed-member'

/** The two names this lane restores (preset row id → the model-visible name). */
const RESTORED = Object.freeze([
  { id: 'tool-skill', name: 'skill' },
  { id: 'tool-present', name: 'present' },
])

const runtimeRequire = createRequire(join(REPO, 'packages', 'runtime', 'package.json'))

function parseYaml(text) {
  const YAML = runtimeRequire('yaml')
  return YAML.parse(text.replace(/!!js /gu, ''))
}
function rowsOf(document) {
  const rows = Array.isArray(document) ? document : document === null || document === undefined ? [] : [document]
  return rows.flatMap((row) => (Array.isArray(row?.insert) ? rowsOf(row.insert) : [row]))
}
/** Flatten a preset's plugin tree — GROUPS ARE PART OF THE SURFACE. */
function flattenPlugins(list) {
  const out = []
  for (const row of list ?? []) {
    if (row?.group === true) { out.push(...flattenPlugins(row.config)); continue }
    if (row?.id !== undefined && row?.name !== undefined) out.push(row)
  }
  return out
}
function presetPlugins(text) {
  const presets = rowsOf(parseYaml(text)).filter((row) => row?.config?.id === PRESET_ID)
  assert.equal(presets.length, 1, `exactly one ${PRESET_ID} row must be declared`)
  return flattenPlugins(presets[0].config.plugins)
}

// ===========================================================================
// PIN — the pre-fix commit offers neither name, and the host router refuses them
// ===========================================================================
async function realToolRouter() {
  const { Context } = await import(pathToFileURL(runtimeRequire.resolve('@deepseek-ai/cordis')).href)
  const ToolRuntime = (await import(pathToFileURL(runtimeRequire.resolve('@deepseek-ai/dsh-tools')).href)).default
  const SystemPrompt = (await import(pathToFileURL(runtimeRequire.resolve('@deepseek-ai/dsh-system-prompt')).href)).default
  const root = new Context()
  await root.plugin(SystemPrompt)
  await root.plugin(ToolRuntime)
  return root.get('tools')
}

async function dispatchUnknown(tools, name, args) {
  const settled = await tools.execute({
    signal: new AbortController().signal,
    callId: `pd26-${name}`,
    name,
    arguments: args,
    agent: {},
  })
  const text = Array.isArray(settled.content)
    ? settled.content.map((part) => (part?.type === 'text' ? part.text : '')).join('')
    : ''
  return { isError: settled.isError === true, text }
}

test('PD26-PIN: the pre-fix composition offers neither name and the host router answers typed `unknown tool`', { skip: !PIN }, async () => {
  const base = execFileSync('git', ['-C', REPO, 'show', `${BASE_COMMIT}:cordis.patch.yml`], { encoding: 'utf8' })
  const baseIds = presetPlugins(base).map((row) => row.id)
  for (const { id, name } of RESTORED) {
    assert.equal(baseIds.includes(id), false, `BASE ${BASE_COMMIT} must NOT carry the '${id}' row (this lane's premise for \`${name}\`)`)
  }
  // The premise is not a story about YAML: with neither row, a REAL tool
  // registry refuses both calls as unknown tools and executes nothing.
  const tools = await realToolRouter()
  const settled = {
    skill: await dispatchUnknown(tools, 'skill', { name: 'pd26' }),
    present: await dispatchUnknown(tools, 'present', { files: [{ path: 'in-lane.txt' }] }),
  }
  for (const { name } of RESTORED) {
    assert.equal(settled[name].isError, true, `${name} must be a typed error on the pre-fix surface`)
    assert.match(settled[name].text, new RegExp(`unknown tool "${name}"`, 'u'), `${name} must be the host router's typed unknown-tool refusal`)
  }
  // ... while the SHIPPED composition DOES declare them: a real flip. This
  // reads the committed file, not A5SF_PD26_COMPOSITION, so the M2 mutation
  // control (which boots the pre-fix composition) reddens only the SURFACE arm.
  const currentIds = presetPlugins(readFileSync(join(REPO, 'cordis.patch.yml'), 'utf8')).map((row) => row.id)
  for (const { id } of RESTORED) {
    assert.equal(currentIds.includes(id), true, `the composition under test must declare '${id}' — otherwise the pin is comparing nothing`)
  }
})

// ===========================================================================
// SURFACE — the names are restored, the base-fs PROVIDER is not
// ===========================================================================
const KEPT_ROWS = Object.freeze([
  'persona', 'agent-instructions', 'tool-bash', 'tool-fs', 'tool-fs-search', 'tool-jobs',
  'command-goal', 'tool-goal', 'plan-mode', 'compaction-basic', 'command-compact',
  'tool-result-pruner', 'tool-ask-user', 'tool-todo',
])

test('PD26-SURFACE-RESTORED: the governed preset restores the two NAMES and no base-fs skill provider', () => {
  const plugins = presetPlugins(readFileSync(COMPOSITION, 'utf8'))
  const byId = new Map(plugins.map((row) => [row.id, row]))
  assert.equal(byId.get('tool-skill')?.name, '@deepseek-ai/dsh-tool-skill', 'the `skill` name must be declared by the host tool row')
  assert.equal(byId.get('tool-present')?.name, '@deepseek-ai/dsh-tool-present', 'the `present` name must be declared by the host tool row')
  for (const row of plugins) {
    assert.equal(
      String(row.name).includes('skill-filesystem'),
      false,
      `'${String(row.id)}' still mounts the base-fs skill provider (${String(row.name)}) — PD-23's measured hole`,
    )
  }
  for (const id of KEPT_ROWS) {
    assert.equal(byId.has(id), true, `the governed preset unexpectedly lost '${id}'`)
  }
})

// ===========================================================================
// CONTRACT-SKILL — the body read goes through the Member's confined `fs`
// ===========================================================================
const IN_LANE_BODY = 'A5SF_PD26_IN_LANE_SKILL_BODY'
const OUT_OF_LANE_BODY = 'A5SF_PD26_OUT_OF_LANE_SECRET_BODY'
/** Real on-disk fixtures (a temp dir, never the repo): the CONTRACT doubles
 *  decide admission, but the body bytes must exist so the M1 mutation control
 *  — a module copy that reads through the BASE fs — can actually read them and
 *  let the deny arm go red for the right reason. */
const FIXTURE_ROOT = mkdtempSync(join(tmpdir(), 'a5sf-pd26-'))
const IN_LANE_SKILL = join(FIXTURE_ROOT, 'lane', 'skills', 'pd26-in-lane', 'SKILL.md')
const OUT_OF_LANE_SKILL = join(FIXTURE_ROOT, 'outside', 'skills', 'pd26-out-of-lane', 'SKILL.md')
const ALLOW_PREFIX = join(FIXTURE_ROOT, 'lane')
mkdirSync(dirname(IN_LANE_SKILL), { recursive: true })
mkdirSync(dirname(OUT_OF_LANE_SKILL), { recursive: true })
writeFileSync(IN_LANE_SKILL, IN_LANE_BODY)
writeFileSync(OUT_OF_LANE_SKILL, OUT_OF_LANE_BODY)

/** A fake CONFINED `fs`: one allow subtree, a typed denial everywhere else. */
function confinedFsDouble({ allowPrefix }) {
  const reads = []
  const deny = (method, path) => {
    const error = new Error(`authored locator '${path}' is outside every allow subtree of the lane`)
    error.name = 'TeamIoDenial'
    error.code = 'IO_READ_DENIED'
    error.method = method
    return error
  }
  const admitted = (method, path) => {
    reads.push({ method, path })
    if (!path.startsWith(allowPrefix)) throw deny(method, path)
  }
  return {
    reads,
    async resolve(path) { return { displayPath: path } },
    async readText(target) {
      admitted('readText', target.displayPath)
      return target.displayPath === IN_LANE_SKILL ? IN_LANE_BODY : OUT_OF_LANE_BODY
    },
    async lstat(path) {
      admitted('lstat', path)
      return { type: 'file' }
    },
    async stat(target) {
      admitted('stat', target.displayPath)
      return target.displayPath === IN_LANE_SKILL ? { type: 'file' } : undefined
    },
  }
}

async function loadSkillModule() {
  const imported = await import(pathToFileURL(SKILL_MODULE).href)
  return imported
}

async function mountSkill({ fs, catalog }) {
  const module = await loadSkillModule()
  const registered = []
  const sections = []
  const ctx = {
    fs,
    systemPrompt: { section: (section) => { sections.push(section); return () => {} }, getSectionOrder: () => 1100 },
    tools: { register: (definition) => { registered.push(definition); return () => {} } },
  }
  module.apply(ctx, { skills: catalog })
  assert.equal(registered.length, 1, 'the skill module must register exactly one tool')
  assert.equal(registered[0].name, 'skill')
  return { tool: registered[0], sections }
}

const EXEC = Object.freeze({ signal: new AbortController().signal, callId: 'pd26-skill', agent: { session: { header: { cwd: REPO } } } })

test('PD26-CONTRACT-SKILL: an in-lane body is returned, an out-of-lane body is a typed denial with 0 bytes and 1 read', async () => {
  const fs = confinedFsDouble({ allowPrefix: ALLOW_PREFIX })
  const catalog = [
    { name: 'pd26-in-lane', description: 'in-lane fixture', path: IN_LANE_SKILL },
    { name: 'pd26-out-of-lane', description: 'out-of-lane fixture', path: OUT_OF_LANE_SKILL },
  ]
  const { tool, sections } = await mountSkill({ fs, catalog })
  // The catalog section names both skills: declaring a skill is not a read and
  // must not consult the lane at all.
  assert.equal(fs.reads.length, 0, 'mounting the tool must read nothing')
  assert.equal(sections.length, 1, 'the module must publish exactly one catalog section')
  const text = sections[0].text()
  for (const name of ['pd26-in-lane', 'pd26-out-of-lane']) assert.equal(text.includes(name), true, `the catalog must name ${name}`)

  const allowed = await tool.execute({ name: 'pd26-in-lane' }, EXEC)
  assert.equal(allowed.content, IN_LANE_BODY, 'the in-lane body must be returned as-is')
  assert.equal(allowed.provider, 'a5sf-confined')
  assert.equal(allowed.resourceBase.path, dirname(IN_LANE_SKILL))
  assert.deepEqual(fs.reads.map((r) => r.method), ['readText'], 'exactly one target-bearing read for the in-lane body')
  assert.equal(JSON.stringify(allowed).includes(OUT_OF_LANE_BODY), false, 'the allowed result must not carry the out-of-lane body')

  fs.reads.length = 0
  await assert.rejects(
    () => tool.execute({ name: 'pd26-out-of-lane' }, EXEC),
    (error) => {
      assert.match(String(error?.message), /^IO_READ_DENIED: /u, 'the refusal must be TYPED in the model-visible message')
      assert.equal(String(error?.message).includes(OUT_OF_LANE_BODY), false, 'the refusal must not carry the body')
      return true
    },
  )
  assert.deepEqual(fs.reads.map((r) => r.method), ['readText'], 'the denial must be exactly ONE lane consult')
})

// ===========================================================================
// CONTRACT-PRESENT — same face, host package's own semantics
// ===========================================================================
async function mountPresent({ fs }) {
  const module = await import(pathToFileURL(PRESENT_MODULE).href)
  const registered = []
  const appended = []
  const sessionProjections = {
    stateOf: () => ({ openTurnStartSeq: 1, lastTurn: 7 }),
  }
  const ctx = {
    fs,
    tools: { register: (definition) => { registered.push(definition); return () => {} } },
    sessionProjections,
  }
  module.apply(ctx, {})
  assert.equal(registered.length, 1, 'the present module must register exactly one tool')
  assert.equal(registered[0].name, 'present')
  const session = { header: { cwd: REPO }, append: (type, data) => { appended.push({ type, data }) } }
  // The delivery listener must be registered on the AGENT ctx, not the realm
  // ctx: only the agent-scoped dispatch reaches it (module header).
  const agentListeners = []
  const agent = {
    session,
    ctx: { on: (event, listener) => { agentListeners.push([event, listener]); return () => {} } },
  }
  const exec = { signal: new AbortController().signal, callId: 'pd26-present', agent }
  return {
    tool: registered[0],
    appended,
    agentListeners,
    finish(settled, isError = false) {
      for (const [event, listener] of agentListeners) {
        if (event === 'tools/result') listener(exec, { isError, content: [] })
      }
      return settled
    },
    exec,
  }
}

test('PD26-CONTRACT-PRESENT: an in-lane file is presented and recorded; an out-of-lane path is a typed denial with no event', async () => {
  const fs = confinedFsDouble({ allowPrefix: ALLOW_PREFIX })
  const { tool, appended, agentListeners, finish, exec } = await mountPresent({ fs })

  const allowed = await tool.execute({ files: [{ path: IN_LANE_SKILL, description: 'pd26 deliverable' }] }, exec)
  assert.equal(allowed.turn, 7)
  assert.equal(agentListeners.length, 1, 'exactly one delivery listener must be registered on the agent ctx')
  finish(allowed, false)
  assert.equal(allowed.files.length, 1)
  assert.equal(allowed.files[0].path, IN_LANE_SKILL)
  assert.equal(appended.filter((e) => e.type === 'deliverables/presented').length, 1, 'the in-lane presentation must be recorded exactly once')

  appended.length = 0
  fs.reads.length = 0
  await assert.rejects(
    () => tool.execute({ files: [{ path: OUT_OF_LANE_SKILL, description: 'pd26 denied' }] }, exec),
    (error) => {
      assert.equal(error?.code, 'IO_READ_DENIED', 'the refusal must carry the typed IO_READ_DENIED code')
      assert.match(String(error?.message), /^IO_READ_DENIED: /u, 'the refusal must be TYPED in the model-visible message')
      assert.match(String(error?.message), /outside every allow subtree/u, 'the message must be the compiled lane decision, not "file not found"')
      assert.equal(String(error?.message).includes('not found'), false, 'a lane denial must never look like an existence answer')
      return true
    },
  )
  finish({ files: [] }, true)
  assert.equal(appended.length, 0, 'a refused presentation must append NO deliverables event')
  assert.deepEqual(fs.reads.map((r) => r.method), ['lstat'], 'the denial happens at the FIRST target-bearing call (no resolve/stat, no existence oracle)')
})

// ===========================================================================
// PARITY — the shadow speaks the shipped package's own schema
// ===========================================================================
test('PD26-PARITY: both shadows are the pinned host packages\' own definitions', async () => {
  const hostSkill = await import(pathToFileURL(runtimeRequire.resolve('@deepseek-ai/dsh-tool-skill')).href)
  const registered = []
  const hostCtx = {
    tools: { register: (definition) => { registered.push(definition); return () => {} } },
    // `apply` registers its catalog hook here; the hook body is not executed.
    on: () => () => {},
    agents: {},
    skills: {},
  }
  hostSkill.apply(hostCtx, {})
  assert.equal(registered.length, 1, 'the host `tool-skill` package must register exactly one tool')
  const host = registered[0]
  const { tool: shadow } = await mountSkill({
    fs: confinedFsDouble({ allowPrefix: ALLOW_PREFIX }),
    catalog: [],
  })
  assert.equal(shadow.name, host.name)
  assert.equal(shadow.description, host.description, 'the shadow must not paraphrase the shipped description')
  assert.deepEqual(shadow.parameters, host.parameters, 'the shadow must accept exactly the shipped parameter schema')
  assert.deepEqual(Object.keys(shadow.output.schema.properties), Object.keys(host.output.schema.properties))

  // `present` is re-implemented (the host's listener cannot reach the realm
  // scope), so its definition must be pinned to the host package's own.
  const hostPresent = await import(pathToFileURL(runtimeRequire.resolve('@deepseek-ai/dsh-tool-present')).href)
  const hostPresentRegistered = []
  hostPresent.apply({
    fs: confinedFsDouble({ allowPrefix: ALLOW_PREFIX }),
    tools: { register: (definition) => { hostPresentRegistered.push(definition); return () => {} } },
    sessionProjections: { stateOf: () => ({ openTurnStartSeq: 1, lastTurn: 1 }) },
    on: () => () => {},
  }, { maxFiles: 8 })
  const { tool: presentShadow } = await mountPresent({ fs: confinedFsDouble({ allowPrefix: ALLOW_PREFIX }) })
  const hostPresentTool = hostPresentRegistered[0]
  assert.equal(presentShadow.name, hostPresentTool.name)
  assert.equal(presentShadow.description, hostPresentTool.description, 'the `present` shadow must not paraphrase the shipped description')
  assert.deepEqual(presentShadow.parameters, hostPresentTool.parameters, 'the `present` shadow must accept exactly the shipped parameter schema')
  assert.deepEqual(presentShadow.output.schema, hostPresentTool.output.schema, 'the `present` shadow must return exactly the shipped output schema')
  const sample = { turn: 3, files: [{ path: '/w/a.txt', description: 'd' }] }
  assert.deepEqual(presentShadow.output.render({}, sample), hostPresentTool.output.render({}, sample), 'the `present` shadow must render identically')
})

// ===========================================================================
// ROW CONFIG — a malformed catalog refuses at assembly (never a silent drop)
// ===========================================================================
test('PD26-CATALOG-VALIDATION: malformed catalog entries refuse, valid ones normalize', async () => {
  const module = await loadSkillModule()
  assert.deepEqual(module.skillCatalogOf(undefined), [])
  assert.deepEqual(
    module.skillCatalogOf([{ name: 'a-skill', description: 'd', path: '/x/SKILL.md' }]).map((e) => e.name),
    ['a-skill'],
  )
  for (const bad of [
    'not-an-array',
    [null],
    [{ name: 'bad name!', description: 'd', path: '/x' }],
    [{ name: 'ok', description: 'd', path: '   ' }],
    [{ name: 'ok', description: 'd', path: '/x' }, { name: 'ok', description: 'd', path: '/y' }],
  ]) {
    assert.throws(() => module.skillCatalogOf(bad), /a5sf-confined-skill: config\.skills/u, `expected a typed refusal for ${JSON.stringify(bad)}`)
  }
  // The row parser uses the SAME validator: a bad declaration cannot reach a mount.
  // The SOURCE row imports its team-services siblings as `.js` (they exist in
  // `dist`), so the host-free arm reads the committed dist mirror, exactly as
  // the harness loads it.
  const row = await import(pathToFileURL(join(REPO, 'packages', 'runtime', 'dist', 'packages', 'runtime', 'src', 'plugin', 'live', 'a5sf-realm-row.mjs')).href)
  assert.throws(
    () => row.a5sfRealmConfigOf({ a5sfEvidencePath: '/tmp/pd26.jsonl', a5sfSkillCatalog: [{ name: 'bad name!', description: 'd', path: '/x' }] }),
    /config\.skills/u,
  )
})
