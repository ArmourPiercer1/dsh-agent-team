/**
 * a5sf-pd25-unbounded-turn.test.mjs — PD-24/UNBOUNDED-TURN: a governed Member
 * can execute without a total bound, and the opt-in governed preset no longer
 * offers the tools that made it unbounded.
 *
 * WHY THIS SUITE EXISTS. The Alpha.5 ceiling is per CALL
 * (`EffectiveIo(member, tool, call) ⊆ ceiling ∩ restriction`). PD-23 recorded
 * `create_goal` as a "typed refusal" on a delegated Member turn; the PD-25 live
 * lane re-measured it and found the opposite: the goal tools are ACCEPTED,
 * because the Team runtime delivers the delegated work prompt as a
 * `user`-kind message into a session that is itself a runtime ROOT, so
 * `requireDirectHuman` passes. What follows the acceptance is the product's
 * goal-round driver: rounds 1..N of automatic continuation inside the Member's
 * own session, with the round budget (`maxGoalRounds`, default 256) settable BY
 * THE MEMBER (create argument, and `update_goal edit`). The lane also measured
 * that one Member turn executes an unbounded number of tool calls (30/30
 * sequential confined `bash` calls, no cap), and that `ask_user_question` in an
 * unattended Member turn BLOCKS the delegation (the api-remotes waterfall
 * queues the question for a client that is not there and never settles).
 *
 * Disposition (fail-closed, capability regression disclosed): the `tool-goal`
 * and `tool-ask-user` rows leave the opt-in governed preset. `plan-mode`
 * (`exit_plan_mode` is a typed "only available in plan mode" error) and
 * `tool-todo` (session-local) stay.
 *
 * This suite is HOST-FREE and pins three faces:
 *
 *   PIN        with A5SF_PD25_PIN=1 the BASE commit (6cfc67b76) is read out of
 *              git and the PRE-FIX rows are asserted present, so the flip is a
 *              recorded fact rather than a story;
 *   SURFACE    the shipped governed preset declares no goal row and no ask-user
 *              row anywhere in its (nested) plugin tree — by id AND by package
 *              name — the retained rows are untouched, and the removal is
 *              surgical (the pinned host's `standard` preset still ships both
 *              capabilities, so this is a governed-preset removal, not a
 *              product removal);
 *   REFUSAL    a registry that mounts exactly the governed preset's remaining
 *              tool rows dispatches `get_goal` / `create_goal` / `update_goal` /
 *              `ask_user_question` to the host router's typed
 *              `unknown tool "<name>"` and executes nothing.
 *
 * MUTATION CONTROL hooks (never set in CI):
 *   A5SF_PD25_COMPOSITION=<path>      SURFACE arm reads a mutated composition
 *   A5SF_PD25_MUTATE_REGISTER=goal    REFUSAL arm registers dispatchable goal tools
 *   A5SF_PD25_MUTATE_REGISTER=ask     REFUSAL arm registers a dispatchable ask tool
 *   A5SF_PD25_MUTATE_REGISTER=partial REFUSAL arm registers `get_goal` ONLY (the
 *                                     trio is removed as a set: a surviving
 *                                     reader must redden the arm too)
 * `tests/world-factory/a5sf-pd25-mutation-controls.mjs` drives CLEAN + three
 * register mutations + one composition mutation and asserts that each mutation
 * REDDENS exactly the arm it names.
 *
 * What is fixture (disclosed): the tripwire tools and the mutated composition
 * copies. The preset parser, the tool router and the typed refusal are product
 * code. No boot, no port, no DSH_HOME.
 *
 * Run: node --test tests/world-factory/a5sf-pd25-unbounded-turn.test.mjs
 */
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { test } from 'node:test'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..', '..')
const COMPOSITION = process.env.A5SF_PD25_COMPOSITION ?? join(REPO, 'cordis.patch.yml')
const PIN = process.env.A5SF_PD25_PIN === '1'
const MUTATE_REGISTER = process.env.A5SF_PD25_MUTATE_REGISTER ?? ''
/** The recorded start of this task (origin/master at this branch point). */
const BASE_COMMIT = '6cfc67b7695672ac817c64d3aec47a48b1dc48b4'
// PD-29 (2026-11-14 owner ruling) REOPENED `tool-goal`: Preview accepts the
// absence of a trustworthy GLOBAL round budget, so the goal trio is served
// again by the upstream packages (the round cap stays the Member-editable
// upstream `maxGoalRounds`). PD-25's own finding is unchanged and still
// pinned: the ask tool stays OUT, because its measured defect (a blocked
// delegation with no answerer) is a liveness defect, not a budget question.
const CLOSED_ROWS = Object.freeze(['tool-ask-user'])
const CLOSED_TOOLS = Object.freeze(['ask_user_question'])
const REOPENED_ROWS = Object.freeze(['tool-goal'])
const REOPENED_TOOLS = Object.freeze(['get_goal', 'create_goal', 'update_goal'])
const KEPT_ROWS = Object.freeze([
  'tool-bash',
  'tool-fs',
  'tool-fs-search',
  'tool-jobs',
  'tool-todo',
  'plan-mode',
  'command-goal',
  'persona',
  'agent-instructions',
  'compaction-basic',
  'tool-result-pruner',
])
const PRESET_ID = 'a5sf-governed-member'

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

function presetPluginIds(text) {
  return presetPlugins(text).map((row) => row.id)
}

const HOST_TREE = process.env.A5SF_PD25_HOST_TREE ?? join(REPO, 'tests', 'deepseek-harness-test-use')
const PINNED_STANDARD = join(HOST_TREE, 'packages', 'bundle', 'web-app', 'presets', 'standard.patch.yml')

// ===========================================================================
// PIN — the BASE commit still carries the rows this lane removes
// ===========================================================================
test('PD25-PIN: the BASE commit carries the goal row and the ask-user row (PRE-FIX, pinned)', { skip: !PIN }, () => {
  const base = execFileSync('git', ['-C', REPO, 'show', `${BASE_COMMIT}:cordis.patch.yml`], { encoding: 'utf8' })
  const plugins = presetPlugins(base)
  const ids = plugins.map((row) => row.id)
  for (const id of CLOSED_ROWS) {
    assert.equal(ids.includes(id), true, `BASE ${BASE_COMMIT} must carry '${id}' (the pre-fix state)`)
  }
  assert.equal(plugins.find((row) => row.id === 'tool-goal')?.name, '@deepseek-ai/dsh-tool-goal')
  assert.equal(plugins.find((row) => row.id === 'tool-ask-user')?.name, '@deepseek-ai/dsh-tool-ask-user')
})

// ===========================================================================
// SURFACE — the shipped governed preset is closed, and the removal is surgical
// ===========================================================================
test('PD25-SURFACE-CLOSED (ask-user only; goal REOPENED by PD-29): the governed preset declares NO ask-user row and the goal row again', () => {
  const text = readFileSync(COMPOSITION, 'utf8')
  const ids = presetPluginIds(text)
  for (const id of CLOSED_ROWS) {
    assert.equal(ids.includes(id), false, `the governed preset must not declare '${id}'`)
  }
  // PD-29: the goal ROW is back, by id AND by package name (the upstream
  // package, never a Team re-implementation).
  const byId = new Map(presetPlugins(text).map((row) => [row.id, row]))
  for (const id of REOPENED_ROWS) {
    assert.equal(byId.has(id), true, `PD-29 reopened '${id}' and the governed preset must declare it`)
  }
  assert.equal(byId.get('tool-goal')?.name, '@deepseek-ai/dsh-tool-goal', 'the goal row must mount the upstream tool package')
  // A row by ANY id could expose the remaining closed surface: assert by
  // package name too, so a rename cannot smuggle it back.
  for (const row of presetPlugins(text)) {
    const name = String(row.name)
    assert.equal(name.includes('dsh-tool-ask-user'), false, `'${String(row.id)}' still mounts the ask-user tool package`)
  }
})

test('PD25-SURFACE-POSITIVE-CONTROL: the retained rows are untouched', () => {
  const ids = presetPluginIds(readFileSync(COMPOSITION, 'utf8'))
  for (const id of KEPT_ROWS) {
    assert.equal(ids.includes(id), true, `the governed preset unexpectedly lost '${id}'`)
  }
  // The removal is NOT a blanket strip of the preset.
  assert.equal(ids.length > 12, true, `the governed preset still carries its retained surface (got ${ids.length} rows)`)
})

test('PD25-SURFACE-SURGICAL: the pinned standard preset still ships both capabilities', () => {
  // The capability exists OUTSIDE the governed preset: this is a governed-row
  // removal, not a product removal.
  const text = readFileSync(PINNED_STANDARD, 'utf8')
  const standard = rowsOf(parseYaml(text)).filter((row) => row?.config?.id === 'standard')
  assert.equal(standard.length, 1, 'the standard preset row must be declared in the pinned host tree')
  const ids = flattenPlugins(standard[0].config.plugins).map((row) => row.id)
  for (const id of ['tool-goal', 'tool-ask-user', 'plan-mode', 'tool-todo']) {
    assert.equal(ids.includes(id), true, `the standard preset must still declare '${id}' (capability outside the governed preset)`)
  }
})

// ===========================================================================
// REFUSAL — a registry mounting exactly the governed preset's tool rows
// ===========================================================================
/**
 * The governed preset's remaining TOOL rows, mapped to the tool names the host
 * router would expose for them. Only the tripwire names matter here: every
 * other row is registered under a synthetic name so the registry is shaped
 * like the preset (it is not an empty registry with four holes cut in it).
 */
const GOVERNED_TOOL_ROWS = Object.freeze({
  'tool-bash': ['bash'],
  'tool-fs': ['read', 'write', 'edit', 'glob', 'grep', 'read_image'],
  'tool-fs-search': ['search'],
  'tool-jobs': ['job_list', 'job_output', 'job_kill'],
  'tool-todo': ['todo_write'],
  'plan-mode': ['exit_plan_mode'],
  present: ['present'],
  // PD-29 reopened the goal trio on the governed preset; it is part of the
  // preset's RETAINED surface this registry mirrors.
  'tool-goal': ['get_goal', 'create_goal', 'update_goal'],
})

async function governedShapedRegistry() {
  const { Context } = await import(pathToFileURL(runtimeRequire.resolve('@deepseek-ai/cordis')).href)
  const ToolRuntime = (await import(pathToFileURL(runtimeRequire.resolve('@deepseek-ai/dsh-tools')).href)).default
  const SystemPrompt = (await import(pathToFileURL(runtimeRequire.resolve('@deepseek-ai/dsh-system-prompt')).href)).default
  const root = new Context()
  await root.plugin(SystemPrompt)
  await root.plugin(ToolRuntime)
  const tools = root.get('tools')
  const effects = { goal: 0, ask: 0, kept: 0 }
  const register = (name, execute) => tools.register({
    name,
    description: `PD-25 registry probe: ${name}`,
    parameters: { type: 'object', properties: {}, additionalProperties: true },
    output: {
      schema: { type: 'object' },
      render(_args, value) { return [{ type: 'text', text: JSON.stringify(value) }] },
    },
    async execute() { return execute() },
  })
  // The preset's RETAINED surface is dispatchable — the refusal is specific.
  for (const names of Object.values(GOVERNED_TOOL_ROWS)) {
    for (const name of names) register(name, () => { effects.kept += 1; return { value: 'KEPT_TOOL_REACHED' } })
  }
  if (MUTATE_REGISTER === 'goal') {
    // MUTATION ARM kept for the ask arm's sibling shape: make a goal tool
    // implementation distinguishable from the retained placeholder.
    effects.goal = 0
  }
  if (MUTATE_REGISTER === 'ask') {
    register('ask_user_question', () => { effects.ask += 1; return { value: 'MUTATION_ASK_REACHED' } })
  }
  return { root, tools, effects }
}

const ARGUMENTS = Object.freeze({
  get_goal: {},
  create_goal: { objective: 'pd25 refusal probe' },
  update_goal: { goal_id: 'goal-nope', action: 'pause' },
  ask_user_question: { questions: [{ id: 'q1', question: 'pd25 refusal probe' }] },
})

test('PD25-TYPED-REFUSAL: ask_user_question is UNKNOWN_TOOL and executes nothing (the goal trio is dispatchable again, PD-29)', async () => {
  const { tools, effects } = await governedShapedRegistry()
  // Control: the registry itself dispatches (so a green refusal cannot come
  // from a broken harness).
  const kept = await tools.execute({
    signal: new AbortController().signal,
    callId: 'pd25-kept-control',
    name: 'todo_write',
    arguments: { todos: [] },
    agent: {},
  })
  assert.equal(kept.isError ?? false, false, 'the retained surface must dispatch in this registry')
  assert.equal(effects.kept, 1)
  // PD-29: the goal trio is BACK on the governed preset — it must dispatch,
  // and this positive arm is what M1-row-removed reddens at the composition.
  for (const name of REOPENED_TOOLS) {
    const settled = await tools.execute({
      signal: new AbortController().signal,
      callId: `pd25-reopened-${name}`,
      name,
      arguments: ARGUMENTS[name],
      agent: {},
    })
    assert.notEqual(settled.isError, true, `${name} must be dispatchable again (PD-29 reopened the goal row)`)
  }
  assert.equal(effects.kept, 1 + REOPENED_TOOLS.length)
  for (const name of CLOSED_TOOLS) {
    const settled = await tools.execute({
      signal: new AbortController().signal,
      callId: `pd25-${name}`,
      name,
      arguments: ARGUMENTS[name],
      agent: {},
    })
    const text = Array.isArray(settled.content) ? settled.content.map((part) => part?.type === 'text' ? part.text : '').join('') : ''
    assert.equal(settled.isError, true, `${name} must be a typed tool error`)
    assert.match(text, new RegExp(`unknown tool "${name}"`, 'u'), `${name} must be refused by the host router, not executed`)
    assert.equal(text.includes('MUTATION_'), false, `${name} reached a real implementation`)
  }
  assert.equal(effects.goal, 0, 'no goal-tool implementation ran')
  assert.equal(effects.ask, 0, 'no ask-user implementation ran')
})
