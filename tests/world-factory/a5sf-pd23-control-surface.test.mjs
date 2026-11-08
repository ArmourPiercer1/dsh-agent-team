/**
 * a5sf-pd23-control-surface.test.mjs — PD-23: the governed Member has no
 * reachable CROSS-MEMBER control surface and no unconfined skill-body read,
 * and the removals are a recorded flip rather than a story.
 *
 * WHY THIS SUITE EXISTS. PD-18 fail-closed the governed preset's host-executed
 * executors; PD-21/PD-22 fail-closed its `subagent` family after measuring that
 * a child session resolves the BASE services. The remaining model-facing
 * control-plane tools were never measured on a real Host:
 * `send_message` / `interrupt_agent` / `list_agents` (cross-Member influence),
 * `job_*` (owner-scoped but with no producer), `skill` (whose BODY read is a
 * file read), and the per-session `todo_write` / goal tools.
 *
 * The PD-23 live lane (`evidence/a5sf-pd23-control-surface/`) measured them on
 * the shipped opt-in governed preset with a real Member turn:
 *   - `send_message` to the sibling, and to the Leader, is refused by the
 *     subagent lineage rule; the sibling is never woken;
 *   - `interrupt_agent` on the sibling is refused (or an accepted no-op) and
 *     the sibling's turn settles untouched;
 *   - `list_agents` reports only the caller's OWN subagent children (none);
 *   - `job_*` answer from an OWNER-scoped registry with no producer;
 *   - `skill` loaded a body that lives OUTSIDE the Member's compiled read lane
 *     and returned its bytes with ZERO `a5sf-guard-consult` facts — the body
 *     read resolves the BASE `fs`, not the confined one;
 *   - `todo_write` writes to the Member's own session.
 * CORRECTION (PD-24/UNBOUNDED-TURN, 2026-11-14): this suite's docstring used to
 * claim the goal tools were "typed refusals (a Member turn holds no
 * direct-human goal authority)". The durable probe JSON from THIS lane's own
 * live boots shows `create_goal` ACCEPTED (`maxGoalRounds: 256`,
 * `activation: armed`), and PD-25 re-measured it: the Team runtime creates a
 * Member as a runtime ROOT and delivers the delegated prompt as a `user`-kind
 * message, so `requireDirectHuman` passes. The goal tools are removed by PD-25
 * (fail-closed, see evidence/a5sf-pd25-unbounded-turn/README.md).
 * The disposition follows PD-18/PD-21: the unreachable control rows and the
 * unconfined skill loader are REMOVED from the governed preset (fail-closed,
 * typed `unknown tool`), the session-scoped tools are RETAINED.
 *
 * This suite is HOST-FREE and pins three independent faces:
 *
 *   PIN        with A5SF_PD23_PIN=1 the BASE commit (c5d619e53) is read out of
 *              git and the PRE-FIX rows are asserted present, so the flip is a
 *              recorded fact;
 *   SURFACE    the shipped governed preset declares no control row and no skill
 *              provider/loader anywhere in its (nested) plugin tree, the
 *              retained rows are untouched, and the removal is surgical;
 *   REFUSAL    a governed-shaped tool registry dispatches `send_message`,
 *              `interrupt_agent`, `list_agents` and `skill` to the host
 *              router's typed `unknown tool` error and executes nothing.
 *
 * MUTATION CONTROL hooks (never set in CI):
 *   A5SF_PD23_COMPOSITION=<path>       SURFACE arm reads a mutated composition
 *   A5SF_PD23_MUTATE_REGISTER=control  REFUSAL arm registers dispatchable
 *                                      control tools
 *   A5SF_PD23_MUTATE_REGISTER=skill    REFUSAL arm registers a dispatchable
 *                                      `skill` loader
 * `tests/world-factory/a5sf-pd23-mutation-controls.mjs` drives all three and
 * asserts that each one REDDENS exactly the arm it names.
 *
 * What is fixture (disclosed): the tripwire tools and the mutated composition
 * copies. The preset parser, the tool router and the typed refusal are product
 * code. No boot, no port, no DSH_HOME.
 *
 * Run: node --test tests/world-factory/a5sf-pd23-control-surface.test.mjs
 */
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { test } from 'node:test'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..', '..')
const COMPOSITION = process.env.A5SF_PD23_COMPOSITION ?? join(REPO, 'cordis.patch.yml')
const PIN = process.env.A5SF_PD23_PIN === '1'
const MUTATE_REGISTER = process.env.A5SF_PD23_MUTATE_REGISTER ?? ''
/** The recorded start of this task (origin/master at the PD-23 branch point). */
const BASE_COMMIT = 'c5d619e53'
const CLOSED_ROWS = Object.freeze([
  'tool-subagent-control',
  'tool-subagent-list-agents',
  'tool-skill',
  'skill-filesystem',
])
const CLOSED_TOOLS = Object.freeze(['send_message', 'interrupt_agent', 'list_agents', 'skill'])
// `tool-goal` left this list on 2026-11-14 with PD-24/UNBOUNDED-TURN: PD-23's
// live lane read `create_goal` as a typed refusal, and PD-25 re-measured the
// same preset and found it ACCEPTED (the Member is a runtime root and the work
// prompt is a `user`-kind message, so `requireDirectHuman` passes). The goal
// tools are removed by PD-25, so this POSITIVE CONTROL must not claim them.
const KEPT_ROWS = Object.freeze(['tool-bash', 'tool-fs', 'tool-fs-search', 'tool-jobs', 'tool-todo', 'plan-mode', 'command-goal', 'persona', 'agent-instructions', 'compaction-basic', 'tool-result-pruner'])
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

function presetPluginIds(text) {
  const presets = rowsOf(parseYaml(text)).filter((row) => row?.config?.id === PRESET_ID)
  assert.equal(presets.length, 1, `exactly one ${PRESET_ID} row must be declared`)
  return flattenPlugins(presets[0].config.plugins).map((row) => row.id)
}

function presetPlugins(text) {
  const presets = rowsOf(parseYaml(text)).filter((row) => row?.config?.id === PRESET_ID)
  return flattenPlugins(presets[0].config.plugins)
}

function standardPresetPluginIds(text) {
  // The pinned host's `standard` preset is a SEPARATE file; the positive
  // control reads the shipped composition's own standard-preset row when the
  // deployment declares one, otherwise the pinned preset file.
  const rows = rowsOf(parseYaml(text))
  const standard = rows.filter((row) => row?.config?.id === 'standard')
  if (standard.length === 1) return flattenPlugins(standard[0].config.plugins).map((row) => row.id)
  return null
}

// ===========================================================================
// PIN — the BASE commit still carries the rows this lane removes
// ===========================================================================
test('PD23-PIN: the BASE commit carries the control rows and the skill loader (PRE-FIX, pinned)', { skip: !PIN }, () => {
  const base = execFileSync('git', ['-C', REPO, 'show', `${BASE_COMMIT}:cordis.patch.yml`], { encoding: 'utf8' })
  const plugins = presetPlugins(base)
  const ids = plugins.map((row) => row.id)
  for (const id of CLOSED_ROWS) {
    assert.equal(ids.includes(id), true, `BASE ${BASE_COMMIT} must carry '${id}' (the pre-fix state)`)
  }
  // And the ONE fact that makes the skill row dangerous is recorded, not
  // inferred here: the live lane measured the body read returning out-of-lane
  // bytes with zero guard facts (evidence/a5sf-pd23-control-surface/README.md).
  const skill = plugins.find((row) => row.id === 'tool-skill')
  assert.equal(skill?.name, '@deepseek-ai/dsh-tool-skill')
})

// ===========================================================================
// SURFACE — the shipped governed preset is closed, and the removal is surgical
// ===========================================================================
test('PD23-SURFACE-CLOSED (SUPERSEDED BY PD-26): the composition this lane measured declares NO control row and NO skill loader/provider', () => {
  // PD-23 measured the composition at its own base. PD-26 restored the `skill`
  // NAME on the governed preset as a route-C shadow over the Member's confined
  // `fs` (PD26-SURFACE-RESTORED pins today's file, and the live evidence proves
  // the body read is confined). This arm therefore pins the ARCHIVED pre-fix
  // composition it actually measured — `git show 06adbf850:cordis.patch.yml`,
  // kept byte-identical in the PD-26 evidence tree — instead of asserting
  // today's file, which would be a claim about a composition this lane never saw.
  const preFix = join(REPO, 'dev/agent-workflow/evidence/a5sf-pd26-confined-skill/archive/pre-fix/cordis.patch.yml')
  assert.equal(existsSync(preFix), true, 'the pre-fix composition this arm measured must be archived in the tree')
  const text = readFileSync(preFix, 'utf8')
  assert.equal(text.includes('`a5sfSkillCatalog`') || text.includes('preset-a5sf-governed-member'), true, 'the archived file must still be the shipped composition')
  const ids = presetPluginIds(text)
  for (const id of CLOSED_ROWS) {
    assert.equal(ids.includes(id), false, `the pre-fix governed preset must not declare '${id}'`)
  }
  // A control row by ANY id would still expose the tool: assert by the plugin
  // package name too, so a rename cannot smuggle the surface back.
  for (const row of presetPlugins(text)) {
    assert.equal(String(row.name).includes('dsh-tool-subagent-control'), false, `'${String(row.id)}' still mounts the subagent-control package`)
    assert.equal(String(row.name).includes('dsh-tool-skill'), false, `'${String(row.id)}' still mounts the skill loader`)
    assert.equal(String(row.name).includes('dsh-skill-filesystem'), false, `'${String(row.id)}' still mounts the filesystem skill provider`)
  }
})

test('PD23-SURFACE-POSITIVE-CONTROL: the retained rows (jobs, todo, goal, confined faces) are untouched', () => {
  const ids = presetPluginIds(readFileSync(COMPOSITION, 'utf8'))
  for (const id of KEPT_ROWS) {
    assert.equal(ids.includes(id), true, `the governed preset unexpectedly lost '${id}'`)
  }
  // The removal is NOT a blanket strip of the preset. The floor moved twice on
  // 2026-11-14: PD-24 removed `present` (16 -> 15) and PD-25 removed `tool-goal`
  // and `tool-ask-user` (15 -> 13), so the shipped governed preset now declares
  // 13 rows. The floor is a "not a blanket strip" guard, not a roster pin: each
  // lane's own POSITIVE-CONTROL arm pins its exact retained set.
  assert.equal(ids.length >= 13, true, `the governed preset still carries its retained surface (got ${ids.length} rows)`)
})

test('PD23-SURFACE-SURGICAL: the pinned standard preset still declares the control tools and the skill loader', () => {
  // The capability exists OUTSIDE the governed preset: this is a governed-row
  // removal, not a product removal. The standard preset is read from the pinned
  // host tree when the shipped composition does not inline it.
  const text = readFileSync(join(REPO, 'tests', 'deepseek-harness-test-use', 'packages', 'bundle', 'web-app', 'presets', 'standard.patch.yml'), 'utf8')
  const standard = rowsOf(parseYaml(text)).filter((row) => row?.config?.id === 'standard')
  assert.equal(standard.length, 1, 'the standard preset row must be declared in the pinned host tree')
  const ids = flattenPlugins(standard[0].config.plugins).map((row) => row.id)
  for (const id of ['tool-subagent-control', 'tool-subagent-list-agents', 'tool-skill', 'skill-filesystem']) {
    assert.equal(ids.includes(id), true, `the standard preset must still declare '${id}' (capability outside the governed preset)`)
  }
})

// ===========================================================================
// REFUSAL — a dispatchable-name registry with none of the removed tools
// ===========================================================================
async function governedShapedRegistry() {
  const { Context } = await import(pathToFileURL(runtimeRequire.resolve('@deepseek-ai/cordis')).href)
  const ToolRuntime = (await import(pathToFileURL(runtimeRequire.resolve('@deepseek-ai/dsh-tools')).href)).default
  const SystemPrompt = (await import(pathToFileURL(runtimeRequire.resolve('@deepseek-ai/dsh-system-prompt')).href)).default
  const root = new Context()
  await root.plugin(SystemPrompt)
  await root.plugin(ToolRuntime)
  const tools = root.get('tools')
  const effects = { control: 0, skill: 0 }
  if (MUTATE_REGISTER === 'control') {
    // MUTATION ARM (never in CI): make the control names dispatchable again.
    for (const name of ['send_message', 'interrupt_agent', 'list_agents']) {
      tools.register({
        name,
        description: `MUTATION tripwire: a dispatchable ${name} must turn the refusal assertion red`,
        parameters: { type: 'object', properties: { agent_id: { type: 'string' }, message: { type: 'string' }, scope: { type: 'string' } }, additionalProperties: true },
        async execute() { effects.control += 1; return { value: 'MUTATION_CONTROL_REACHED' } },
      })
    }
  }
  if (MUTATE_REGISTER === 'skill') {
    tools.register({
      name: 'skill',
      description: 'MUTATION tripwire: a dispatchable skill loader must turn the refusal assertion red',
      parameters: { type: 'object', properties: { name: { type: 'string' } }, additionalProperties: true },
      async execute() { effects.skill += 1; return { value: 'MUTATION_SKILL_READ' } },
    })
  }
  return { root, tools, effects }
}

const ARGUMENTS = Object.freeze({
  send_message: { agent_id: 'session-team-child-nope', message: 'pd23 refusal probe' },
  interrupt_agent: { agent_id: 'session-team-child-nope' },
  list_agents: { scope: 'descendants' },
  skill: { name: 'pd23-out-of-lane' },
})

test('PD23-TYPED-REFUSAL: send_message/interrupt_agent/list_agents/skill are UNKNOWN_TOOL and execute nothing', async () => {
  const { tools, effects } = await governedShapedRegistry()
  for (const name of CLOSED_TOOLS) {
    const settled = await tools.execute({
      signal: new AbortController().signal,
      callId: `pd23-${name}`,
      name,
      arguments: ARGUMENTS[name],
      agent: {},
    })
    const text = Array.isArray(settled.content) ? settled.content.map((part) => part?.type === 'text' ? part.text : '').join('') : ''
    assert.equal(settled.isError, true, `${name} must be a typed tool error`)
    assert.match(text, new RegExp(`unknown tool "${name}"`, 'u'), `${name} must be refused by the host router, not executed`)
    assert.equal(text.includes('MUTATION_'), false, `${name} reached a real implementation`)
  }
  assert.equal(effects.control, 0, 'no control-tool implementation ran')
  assert.equal(effects.skill, 0, 'no skill-body read ran')
})
