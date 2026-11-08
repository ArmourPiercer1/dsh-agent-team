/**
 * tests/world-factory/a5sf-pd24-surface-ledger.test.mjs — PD-24: the governed
 * Member's `present` tool stat'ed files through the BASE `fs`, so it was an
 * out-of-lane existence oracle with ZERO a5sf facts. The row is REMOVED
 * fail-closed, and the flip is a recorded fact rather than a story.
 *
 * WHY THIS SUITE EXISTS. PD-18/21/22/23 fail-closed every row that had been
 * MEASURED and found to run on base services. The governed Member surface was
 * still 34 names, and the ten non-team, non-confined rows had never been
 * classified one name at a time. The PD-24 live lane
 * (`evidence/a5sf-pd24-surface-ledger/`) walked the whole roster in one real
 * Member turn. Two of the three unmeasured rows were typed refusals that touch
 * nothing:
 *   - `ask_user_question` -> `DELEGATED_CALLER` (a delegated turn has no human
 *     answerer), no question state, the turn keeps going;
 *   - `exit_plan_mode` (plan mode inactive) -> an error result, no `plan/mode`
 *     event, the turn keeps going.
 * The third was a real governance hole: `present` injects the base `fs` on the
 * registry generation scope, so `ctx.fs.stat` resolved a path ABOVE the Member's
 * compiled read lane. A real out-of-lane file was ACCEPTED (a
 * `deliverables/presented` event was appended to the Member's own session) and a
 * missing one was refused with `file not found` — an existence oracle — with
 * zero `a5sf-guard-consult` facts. The row is now gone from the governed preset
 * (typed `unknown tool "present"`), a disclosed CAPABILITY REGRESSION: the
 * Member can no longer declare deliverables.
 *
 * WHY REMOVAL AND NOT A CONFINED FACE (the CORE_SEAM_BLOCKER). `present`
 * resolves `fs` from the scope its preset row mounts on (the registry
 * generation scope). The Member's confined provider is a FORK in the Member's
 * isolate, so no composition-level row can hand `present` the realm's `fs` —
 * the same seam PD-23 hit for `skill`. Re-parenting it needs a new
 * route-C product row plus a realm-bound provider face (`confined-present-tool`
 * on the `a5sf-realm-row` attach), i.e. a new capability face with its own
 * allow/deny contract tests. That is outside this lane's budget, so the honest
 * disposition is fail-closed removal, and the capability is recorded as GONE.
 *
 * This suite is HOST-FREE and pins four independent faces:
 *
 *   PIN        with A5SF_PD24_PIN=1 the BASE commit (6cfc67b76) is read out of
 *              git, the PRE-FIX `present` row is asserted present, and the
 *              archived pre-fix composition is asserted byte-identical to it;
 *   SURFACE    the shipped governed preset declares no `present` row (by id AND
 *              by package name) while the retained rows are untouched;
 *   REFUSAL    a governed-shaped tool registry dispatches `present` and the ten
 *              earlier fail-closed names to the host router's typed
 *              `unknown tool` error and executes nothing;
 *   LEDGER     the committed ledger artefact (`ledger.json`) still covers every
 *              name on the measured roster exactly once and its bucket identity
 *              still holds, so the dated counts cannot rot silently.
 *
 * MUTATION CONTROL hooks (never set in CI):
 *   A5SF_PD24_COMPOSITION=<path>        SURFACE arm reads a mutated composition
 *   A5SF_PD24_MUTATE_REGISTER=present   REFUSAL arm registers a dispatchable
 *                                       `present` loader
 * `tests/world-factory/a5sf-pd24-mutation-controls.mjs` drives both and asserts
 * that each one REDDENS exactly the arm it names.
 *
 * What is fixture (disclosed): the tripwire tool, the mutated composition copy
 * (the lane's archived pre-fix file) and the ledger artefact. The preset parser,
 * the tool router and the typed refusal are product code. No boot, no port, no
 * DSH_HOME.
 *
 * Run: node --test tests/world-factory/a5sf-pd24-surface-ledger.test.mjs
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
const COMPOSITION = process.env.A5SF_PD24_COMPOSITION ?? join(REPO, 'cordis.patch.yml')
const PIN = process.env.A5SF_PD24_PIN === '1'
const MUTATE_REGISTER = process.env.A5SF_PD24_MUTATE_REGISTER ?? ''
/** The recorded start of this task (origin/master at the PD-24 branch point). */
const BASE_COMMIT = '6cfc67b76'
const EVIDENCE = join(REPO, 'dev', 'agent-workflow', 'evidence', 'a5sf-pd24-surface-ledger')
const PRE_FIX_COMPOSITION = join(EVIDENCE, 'archive', 'pre-fix', 'cordis.patch.yml')
const LEDGER = join(EVIDENCE, 'ledger.json')
const PRESET_ID = 'a5sf-governed-member'

/** The name this lane removes, and the ten names earlier lanes already removed. */
const CLOSED_BY_PD24 = Object.freeze(['present'])
const CLOSED_EARLIER = Object.freeze([
  'interrupt_agent', 'list_agents', 'pwsh', 'send_message', 'skill', 'subagent', 'subagent_fork',
  'web_fetch', 'web_search', 'workflow',
])
const CLOSED_TOOLS = Object.freeze([...CLOSED_BY_PD24, ...CLOSED_EARLIER])
/** Rows the governed preset must keep — the removal must stay surgical. */
// 2026-11-14: `tool-goal` and `tool-ask-user` left this list when PD-25
// (UNBOUNDED-TURN, #674) removed them from the same governed preset for its own
// measured defect; this lane's arm still pins every row IT did not remove, and
// PD-25's own POSITIVE-CONTROL arm pins its retained set. The `present` removal
// is this lane's, so `present` must never appear here.
const KEPT_ROWS = Object.freeze([
  'persona', 'agent-instructions', 'tool-bash', 'tool-fs', 'tool-fs-search', 'tool-jobs',
  'command-goal', 'plan-mode', 'compaction-basic', 'command-compact',
  'tool-result-pruner', 'tool-todo',
])

const runtimeRequire = createRequire(join(REPO, 'packages', 'runtime', 'package.json'))
/** The pinned host checkout. A git worktree does NOT carry its own
 *  `tests/deepseek-harness-test-use` clone (gitignored), so resolve in order:
 *  explicit env override, this tree, then the MAIN checkout this worktree was
 *  cut from. Absent everywhere = a real skip, not a green. */
function resolveHostTree() {
  const candidates = [process.env.A5SF_PD24_HOST_TREE, join(REPO, 'tests', 'deepseek-harness-test-use')]
  const m = /^(.*)\/\.worktrees\/[^/]+$/u.exec(REPO)
  if (m !== null) candidates.push(join(m[1], 'tests', 'deepseek-harness-test-use'))
  for (const candidate of candidates) {
    if (candidate !== undefined && candidate !== null && candidate !== '' && existsSync(candidate)) return candidate
  }
  return null
}
const hostTree = resolveHostTree()

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

// ===========================================================================
// PIN — the BASE commit still carries `present`, and the archive is that file
// ===========================================================================
test('PD24-PIN: the BASE commit carries the `present` row, and the archived pre-fix composition is byte-identical to it', { skip: !PIN }, () => {
  const base = execFileSync('git', ['-C', REPO, 'show', `${BASE_COMMIT}:cordis.patch.yml`], { encoding: 'utf8' })
  const plugins = presetPlugins(base)
  const ids = plugins.map((row) => row.id)
  assert.equal(ids.includes('present'), true, `BASE ${BASE_COMMIT} must carry the pre-fix 'present' row`)
  const present = plugins.find((row) => row.id === 'present')
  assert.equal(present?.name, '@deepseek-ai/dsh-tool-present')
  assert.equal(existsSync(PRE_FIX_COMPOSITION), true, 'the lane must archive the pre-fix composition it measured')
  assert.equal(readFileSync(PRE_FIX_COMPOSITION, 'utf8'), base, 'the archived pre-fix composition must be the BASE commit file, not a hand edit')
})

// ===========================================================================
// SURFACE — the shipped governed preset is closed, and the removal is surgical
// ===========================================================================
test('PD24-SURFACE-CLOSED: the governed preset declares NO `present` row (by id or by package name)', () => {
  const text = readFileSync(COMPOSITION, 'utf8')
  const ids = presetPluginIds(text)
  assert.equal(ids.includes('present'), false, "the governed preset must not declare a 'present' row")
  for (const row of presetPlugins(text)) {
    assert.equal(
      String(row.name).includes('dsh-tool-present'),
      false,
      `'${String(row.id)}' still mounts the base-fs present package (${String(row.name)})`,
    )
  }
})

test('PD24-SURFACE-POSITIVE-CONTROL: the retained rows are untouched', () => {
  const ids = presetPluginIds(readFileSync(COMPOSITION, 'utf8'))
  for (const id of KEPT_ROWS) {
    assert.equal(ids.includes(id), true, `the governed preset unexpectedly lost '${id}'`)
  }
  // Floor 16 -> 15 (PD-24 removed `present`) -> 13 (PD-25 removed `tool-goal`
  // and `tool-ask-user`): a "not a blanket strip" guard, not a roster pin.
  assert.equal(ids.length >= 13, true, `the governed preset still carries its retained surface (got ${ids.length} rows)`)
})

test('PD24-SURFACE-SURGICAL: the pinned standard preset still declares `present` (capability outside the governed preset)', () => {
  // The pinned host tree is gitignored and per-worktree, so resolve it the way
  // every other test does: `tests/paths.mjs#testUseTree`, with an env override
  // for a lane that runs in a worktree without its own clone.
  assert.notEqual(hostTree, null, 'the pinned host tree must be resolvable (set A5SF_PD24_HOST_TREE)')
  const standardPath = join(hostTree, 'packages', 'bundle', 'web-app', 'presets', 'standard.patch.yml')
  const standard = rowsOf(parseYaml(readFileSync(standardPath, 'utf8'))).filter((row) => row?.config?.id === 'standard')
  assert.equal(standard.length, 1, 'the standard preset row must be declared in the pinned host tree')
  const ids = flattenPlugins(standard[0].config.plugins).map((row) => row.id)
  assert.equal(ids.includes('present'), true, 'the standard preset must still declare `present` — this is a governed-row removal, not a product removal')
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
  const effects = { present: 0 }
  if (MUTATE_REGISTER === 'present') {
    // MUTATION ARM (never in CI): make `present` dispatchable again, so the
    // refusal assertion below must go red.
    tools.register({
      name: 'present',
      description: 'MUTATION tripwire: a dispatchable present must turn the refusal assertion red',
      parameters: { type: 'object', properties: { files: { type: 'array' } }, additionalProperties: true },
      async execute() { effects.present += 1; return { value: 'MUTATION_CONTROL_REACHED' } },
    })
  }
  return { root, tools, effects }
}

const ARGUMENTS = Object.freeze({
  present: { files: [{ path: 'in-lane.txt', description: 'pd24 refusal probe' }] },
  send_message: { agent_id: 'session-team-child-nope', message: 'pd24 refusal probe' },
  interrupt_agent: { agent_id: 'session-team-child-nope' },
  list_agents: { scope: 'descendants' },
  skill: { name: 'pd24' },
  subagent: { prompt: 'pd24 probe' },
  subagent_fork: { prompt: 'pd24 probe' },
  web_fetch: { url: 'https://example.invalid/' },
  web_search: { queries: ['pd24'] },
  workflow: { script: 'return 1' },
  pwsh: { command: 'Write-Output pd24' },
})

test('PD24-TYPED-REFUSAL: present and the ten earlier fail-closed names are UNKNOWN_TOOL and execute nothing', async () => {
  const { tools, effects } = await governedShapedRegistry()
  for (const name of CLOSED_TOOLS) {
    const settled = await tools.execute({
      signal: new AbortController().signal,
      callId: `pd24-${name}`,
      name,
      arguments: ARGUMENTS[name] ?? {},
      agent: {},
    })
    const text = Array.isArray(settled.content) ? settled.content.map((part) => part?.type === 'text' ? part.text : '').join('') : ''
    assert.equal(settled.isError, true, `${name} must be a typed tool error`)
    assert.match(text, new RegExp(`unknown tool "${name}"`, 'u'), `${name} must be refused by the host router, not executed`)
    assert.equal(text.includes('MUTATION_'), false, `${name} reached a real implementation`)
  }
  assert.equal(effects.present, 0, 'no present implementation ran')
})

// ===========================================================================
// LEDGER — the dated counts cannot rot: every roster name is classified once
// ===========================================================================
test('PD24-LEDGER-IDENTITY: the committed ledger covers every measured name once and its bucket identity holds', () => {
  assert.equal(existsSync(LEDGER), true, `the lane must commit its ledger artefact at ${LEDGER}`)
  const ledger = JSON.parse(readFileSync(LEDGER, 'utf8'))
  const rows = Array.isArray(ledger.rows) ? ledger.rows : []
  assert.equal(rows.length > 0, true, 'the ledger must carry rows')

  // 1. the roster is exactly the measured Member surface of the agreeing pair
  const roster = Array.isArray(ledger.roster) ? ledger.roster : []
  assert.equal(roster.length, ledger.counts?.measuredRoster, `roster length ${String(roster.length)} must equal counts.measuredRoster ${String(ledger.counts?.measuredRoster)}`)
  const shipped = roster.filter((name) => ledger.fixtures?.includes(name) === false)
  assert.equal(shipped.length, ledger.counts?.shippedRoster, 'the shipped roster is the measured roster minus the disclosed World fixtures')

  // 2. every shipped name is classified exactly once, in a closed bucket
  const buckets = ['GOVERNED', 'SESSION-LOCAL', 'OTHER-AUTHZ', 'FAIL-CLOSED', 'UNMEASURED']
  for (const name of shipped) {
    const matches = rows.filter((row) => row.name === name)
    assert.equal(matches.length, 1, `${name} must be classified by exactly one ledger row (got ${String(matches.length)})`)
    assert.equal(buckets.includes(matches[0].bucket), true, `${name} has an unknown bucket '${String(matches[0].bucket)}'`)
  }
  for (const name of ledger.fixtures ?? []) {
    assert.equal(rows.some((row) => row.name === name), false, `the World fixture ${name} must not be counted as a shipped row`)
  }

  // 3. the reported counts ARE the row counts (no prose number can drift).
  //    `FAIL-CLOSED` is the one bucket that also names rows which were NEVER on
  //    the measured roster (the ten earlier removals), so its count is asserted
  //    against `rows + offRosterRemoved` below instead of against the roster rows.
  for (const bucket of buckets) {
    if (bucket === 'FAIL-CLOSED') continue
    const actual = rows.filter((row) => row.bucket === bucket && shipped.includes(row.name)).length
    assert.equal(ledger.counts?.[bucket], actual, `counts.${bucket}=${String(ledger.counts?.[bucket])} must equal the ${String(actual)} ${bucket} rows`)
  }
  const onRosterClosed = rows.filter((row) => row.bucket === 'FAIL-CLOSED' && shipped.includes(row.name)).length
  assert.equal(onRosterClosed, ledger.counts?.onRosterClosed, 'the on-roster closed rows must be counted once')
  assert.equal(ledger.counts?.FAIL_CLOSED, onRosterClosed + (ledger.counts?.offRosterRemoved ?? 0), 'FAIL_CLOSED = on-roster closed rows + the names removed before this measurement')

  // 4. the identity the matrix §1.8 states, recomputed from the rows
  const closed = Array.isArray(ledger.removedNames) ? ledger.removedNames : []
  assert.equal(closed.length, ledger.counts?.totalRemoved, 'every removed name must be listed in removedNames')
  assert.equal(
    ledger.counts?.FAIL_CLOSED,
    (ledger.counts?.onRosterClosed ?? 0) + (ledger.counts?.offRosterRemoved ?? 0),
    'the FAIL-CLOSED bucket is the on-roster closed row plus the names earlier lanes removed',
  )
  assert.equal(
    ledger.counts?.GOVERNED + ledger.counts?.['SESSION-LOCAL'] + ledger.counts?.['OTHER-AUTHZ'] + ledger.counts?.FAIL_CLOSED + ledger.counts?.UNMEASURED,
    ledger.counts?.shippedRoster + ledger.counts?.offRosterRemoved,
    'the five buckets must sum to the shipped roster plus the names removed BEFORE this measurement',
  )
})
