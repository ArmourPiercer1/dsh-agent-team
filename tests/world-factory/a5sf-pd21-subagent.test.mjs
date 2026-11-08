/**
 * a5sf-pd21-subagent.test.mjs — PD-21: the governed Member has NO subagent
 * realm, and the removal is a recorded flip rather than a story.
 *
 * WHY THIS SUITE EXISTS. PD-18 (#668) fail-closed the shipped governed
 * preset's host-executed executors and RETAINED `subagent`/`subagent_fork`,
 * recording its child-session assembly as UNMEASURED. The PD-21 live lane then
 * measured it on the real Host (evidence/a5sf-pd21-subagent/): a governed
 * Member's `subagent` call spawned a live child whose preset label was
 * `a5sf-governed-member` but whose realm was the HOST's — its `read` returned
 * an out-of-lane fixture (no guard fact) and its `bash` ran on the base
 * subprocess. The child also carried `subagent` itself. The disposition is
 * FAIL-CLOSED: the family is removed from the governed preset.
 *
 * This suite is HOST-FREE and pins three independent faces:
 *
 *   PIN        with A5SF_PD21_PIN=1 the BASE commit (3df546de6) is read out of
 *              git and the PRE-FIX rows are asserted present, so the flip is a
 *              recorded fact;
 *   SURFACE    the shipped governed preset declares no subagent row anywhere in
 *              its (nested) plugin tree, and the removal is surgical;
 *   REFUSAL    a governed-shaped tool registry dispatches `subagent`/
 *              `subagent_fork` to the host router's typed `unknown tool`
 *              error and executes nothing.
 *
 * MUTATION CONTROL hooks (never set in CI):
 *   A5SF_PD21_COMPOSITION=<path>        SURFACE arm reads a mutated composition
 *   A5SF_PD21_MUTATE_REGISTER_SUBAGENT=1 REFUSAL arm registers a dispatchable
 *                                       `subagent` tripwire
 * `tests/world-factory/a5sf-pd21-mutation-controls.mjs` drives both and asserts
 * that each one REDDENS exactly the arm it names.
 *
 * What is fixture (disclosed): the tripwire tool and the mutated composition
 * copies. The preset parser, the tool router and the typed refusal are product
 * code. No boot, no port, no DSH_HOME.
 *
 * Run: node --test tests/world-factory/a5sf-pd21-subagent.test.mjs
 */
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { test } from 'node:test'

import { testUseTree } from '../paths.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..', '..')
const COMPOSITION = process.env.A5SF_PD21_COMPOSITION ?? join(REPO, 'cordis.patch.yml')
const PIN = process.env.A5SF_PD21_PIN === '1'
const MUTATE_REGISTER_SUBAGENT = process.env.A5SF_PD21_MUTATE_REGISTER_SUBAGENT === '1'
/** The recorded start of this task (origin/master at the PD-21 branch point). */
const BASE_COMMIT = '3df546de6'
const CLOSED_ROWS = Object.freeze([
  'tool-subagent',
  'tool-subagent-fork',
  'tool-subagent-control',
  'tool-subagent-list-agents',
  'tool-ralph',
])
const CLOSED_TOOLS = Object.freeze(['subagent', 'subagent_fork', 'send_message', 'list_agents'])
const KEPT_ROWS = Object.freeze(['tool-bash', 'tool-fs', 'tool-fs-search', 'tool-jobs', 'tool-skill', 'persona', 'compaction-basic', 'tool-result-pruner'])

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

function governedPlugins(path) {
  const preset = rowsOf(parseYaml(readFileSync(path, 'utf8'))).find((row) => row?.config?.id === 'a5sf-governed-member')
  assert.notEqual(preset, undefined, 'the shipped governed preset row is present')
  return flattenPlugins(preset.config.plugins)
}

function standardPresetPath() {
  return join(testUseTree(REPO), 'packages', 'bundle', 'web-app', 'presets', 'standard.patch.yml')
}

// ===========================================================================
// P0 PIN — the PRE-FIX surface, read from the recorded base commit
// ===========================================================================

test('P0 PD-21 defect pin (PRE-FIX): the base governed preset carried the subagent family', { skip: !PIN }, () => {
  const pre = execFileSync('git', ['-C', REPO, 'show', `${BASE_COMMIT}:cordis.patch.yml`], { encoding: 'utf8' })
  const prePreset = rowsOf(parseYaml(pre)).find((row) => row?.config?.id === 'a5sf-governed-member')
  const preIds = flattenPlugins(prePreset.config.plugins).map((row) => row.id)
  for (const id of CLOSED_ROWS) {
    assert.equal(preIds.includes(id), true, `PRE-FIX the governed preset declared '${id}' — that is the defect this commit closes`)
  }
  const nowIds = governedPlugins(join(REPO, 'cordis.patch.yml')).map((row) => row.id)
  for (const id of CLOSED_ROWS) {
    assert.equal(nowIds.includes(id), false, `POST-FIX the governed preset no longer declares '${id}'`)
  }
  // The pin must also prove the pre-fix preset is otherwise the SAME instrument:
  // bash, fs and search were present before the flip and are present after it.
  for (const kept of ['tool-bash', 'tool-fs', 'tool-fs-search']) {
    assert.equal(preIds.includes(kept), true, `PRE-FIX '${kept}' was declared`)
    assert.equal(nowIds.includes(kept), true, `POST-FIX '${kept}' is still declared`)
  }
})

// ===========================================================================
// SURFACE — the shipped declaration, and the capability outside it
// ===========================================================================

test('PD21-SURFACE-CLOSED: no subagent row survives anywhere in the governed preset\'s plugin tree', () => {
  const rows = governedPlugins(COMPOSITION)
  for (const closed of CLOSED_ROWS) {
    assert.equal(rows.some((row) => row.id === closed), false, `the governed preset must not carry '${closed}' (PD-21 fail-closed)`)
    assert.equal(rows.some((row) => String(row.name ?? '').includes(closed)), false, `no row may re-introduce '${closed}'`)
  }
  // A GROUP whose id is `delegation` with no subagent children would still be a
  // capability advertisement; assert the family name does not survive either.
  assert.equal(rows.some((row) => row.id === 'delegation'), false, 'the delegation group itself is gone')
  for (const kept of KEPT_ROWS) {
    assert.equal(rows.some((row) => row.id === kept), true, `the governed preset keeps '${kept}' — this is a surgical removal, not a blanket strip`)
  }
})

test('PD21-SURFACE-POSITIVE-CONTROL: the pinned standard preset still declares the subagent capability', () => {
  const standard = rowsOf(parseYaml(readFileSync(standardPresetPath(), 'utf8'))).find((row) => row?.config?.id === 'standard')
  assert.notEqual(standard, undefined, 'the pinned standard preset row is present')
  const ids = flattenPlugins(standard.config.plugins).map((row) => row.id)
  assert.equal(ids.includes('tool-subagent'), true, 'standard keeps tool-subagent')
  assert.equal(ids.includes('tool-subagent-fork'), true, 'standard keeps tool-subagent-fork')
})

// ===========================================================================
// TYPED REFUSAL — a dispatchable-name registry with no subagent tool
// ===========================================================================

async function governedShapedRegistry() {
  const { Context } = await import(pathToFileURL(runtimeRequire.resolve('@deepseek-ai/cordis')).href)
  const ToolRuntime = (await import(pathToFileURL(runtimeRequire.resolve('@deepseek-ai/dsh-tools')).href)).default
  const SystemPrompt = (await import(pathToFileURL(runtimeRequire.resolve('@deepseek-ai/dsh-system-prompt')).href)).default
  const root = new Context()
  await root.plugin(SystemPrompt)
  await root.plugin(ToolRuntime)
  const tools = root.get('tools')
  const effects = { subagent: 0 }
  if (MUTATE_REGISTER_SUBAGENT) {
    // MUTATION ARM (never in CI): make `subagent` dispatchable again. The
    // typed-refusal test MUST go red — that is what proves it measures absence
    // rather than a string.
    tools.register({
      name: 'subagent',
      description: 'MUTATION tripwire: a dispatchable subagent must turn the refusal assertion red',
      parameters: { type: 'object', properties: { prompt: { type: 'string' } }, additionalProperties: true },
      async execute() { effects.subagent += 1; return { value: 'MUTATION_CHILD_STARTED' } },
    })
  }
  return { root, tools, effects }
}

test('PD21-TYPED-REFUSAL: subagent/subagent_fork are UNKNOWN_TOOL and start zero children', async () => {
  const { tools, effects } = await governedShapedRegistry()
  for (const name of ['subagent', 'subagent_fork']) {
    const settled = await tools.execute({
      signal: new AbortController().signal,
      callId: `pd21-${name}`,
      name,
      arguments: { description: 'pd21 refusal probe', prompt: 'a5sf-pd21-child: nope', run_in_background: false },
      agent: {},
    })
    const text = Array.isArray(settled.content) ? settled.content.map((part) => part?.type === 'text' ? part.text : '').join('') : ''
    assert.equal(settled.isError, true, `${name} must be a typed tool error`)
    assert.match(text, new RegExp(`unknown tool "${name}"`, 'u'), `${name} must be refused by the host router, not executed`)
    assert.equal(text.includes('MUTATION_CHILD_STARTED'), false, `${name} reached a child-start implementation`)
  }
  assert.equal(effects.subagent, 0, 'no child-start implementation ran')
})
