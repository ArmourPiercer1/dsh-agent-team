/**
 * a5sf-pd25-mutation-controls.mjs — the mutation controls for PD-25/UNBOUNDED-TURN.
 *
 * A green suite proves nothing unless each arm CAN go red. This script drives
 * the host-free suite four times and asserts the exact arm that reddens:
 *
 *   CLEAN          no mutation                              everything GREEN
 *   M1-row         DELETE the reopened `tool-goal` row from  PD25-SURFACE-CLOSED RED
 *                  a COPY of the composition                 (the PD-29 reopening arm)
 *   M2-ask         register a dispatchable                   PD25-TYPED-REFUSAL RED
 *                  ask_user_question
 *   M4-ask-row     re-insert the closed `tool-ask-user` row  PD25-SURFACE-CLOSED RED,
 *                  into a COPY of the composition          PD25-TYPED-REFUSAL GREEN
 *   PIN            the BASE commit really carries the rows   the PIN arm is GREEN
 *
 * PD-29 (2026-11-14 owner ruling) changed one thing this script pins: the goal
 * trio is no longer CLOSED (Preview accepts the absent global round budget), so
 * the two goal-register mutations of PD-25 no longer apply. The ask removal is
 * untouched, and the reopening is now the thing a mutation must be able to undo.
 *
 * The mutations are fixtures: they live only inside the child processes and a
 * temp copy of `cordis.patch.yml` under the OS temp dir. The tracked file is
 * never written. Exit code 0 = every mutation reddened the arm it names.
 *
 * Run: node tests/world-factory/a5sf-pd25-mutation-controls.mjs
 */
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..', '..')
const SUITE = join(HERE, 'a5sf-pd25-unbounded-turn.test.mjs')
const COMPOSITION = join(REPO, 'cordis.patch.yml')

const BASE_COMMIT = '6cfc67b7695672ac817c64d3aec47a48b1dc48b4'
const CLOSED_ROWS = ['tool-ask-user']

function runSuite(env) {
  const child = spawnSync(process.execPath, ['--test', '--test-reporter=tap', SUITE], {
    cwd: REPO,
    env: { ...process.env, ...env },
    encoding: 'utf8',
    timeout: 300_000,
  })
  const outcomes = new Map()
  for (const line of `${child.stdout}\n${child.stderr}`.split('\n')) {
    const m = /^(ok|not ok) \d+ - (.+?)($| \()/u.exec(line.trim())
    if (m === null) continue
    outcomes.set(m[2].trim(), m[1] === 'ok')
  }
  return { status: child.status, outcomes, stdout: child.stdout, stderr: child.stderr }
}

function named(outcomes, prefix) {
  const hits = [...outcomes.entries()].filter(([name]) => name.startsWith(prefix))
  if (hits.length !== 1) throw new Error(`expected exactly one test named '${prefix}…', found ${String(hits.length)}`)
  return hits[0][1]
}

const results = []
function check(label, ok, detail) {
  results.push({ label, ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}${detail === undefined ? '' : ` — ${detail}`}`)
}

// ── CLEAN ───────────────────────────────────────────────────────────────────
const clean = runSuite({})
const cleanAll = clean.outcomes.size > 0 && [...clean.outcomes.values()].every((ok) => ok === true)
check('CLEAN: every arm is green', clean.status === 0 && cleanAll,
  `exit=${String(clean.status)} tests=${String(clean.outcomes.size)} failed=${JSON.stringify([...clean.outcomes.entries()].filter(([, ok]) => ok !== true).map(([n]) => n))}`)

// ── M1: DELETING the reopened goal row must redden the reopening arm ────────
const dirM1 = mkdtempSync(join(tmpdir(), 'pd25-mut1-'))
let m1
try {
  const original = readFileSync(COMPOSITION, 'utf8')
  const line = "          - id: tool-goal\n            name: '@deepseek-ai/dsh-tool-goal'\n"
  if (!original.includes(line)) throw new Error('the governed preset no longer declares the exact tool-goal row this mutation removes')
  const mutated = join(dirM1, 'cordis.patch.yml')
  writeFileSync(mutated, original.replace(line, ''))
  m1 = runSuite({ A5SF_PD25_COMPOSITION: mutated })
} finally {
  rmSync(dirM1, { recursive: true, force: true })
}
check('M1-row-removed: PD25-SURFACE-CLOSED reddens (the goal reopening is pinned, not assumed)',
  named(m1.outcomes, 'PD25-SURFACE-CLOSED') === false,
  `closed=${String(named(m1.outcomes, 'PD25-SURFACE-CLOSED'))}`)

// ── M2: a dispatchable ASK tool must redden the refusal arm ─────────────────
const m2 = runSuite({ A5SF_PD25_MUTATE_REGISTER: 'ask' })
check('M2-ask: PD25-TYPED-REFUSAL reddens', named(m2.outcomes, 'PD25-TYPED-REFUSAL') === false,
  `refusal=${String(named(m2.outcomes, 'PD25-TYPED-REFUSAL'))}`)

// ── M4: re-inserting the CLOSED ask-user row must redden the surface arm ────
const dir = mkdtempSync(join(tmpdir(), 'pd25-mut-'))
let m4
try {
  const original = readFileSync(COMPOSITION, 'utf8')
  const anchor = original.indexOf('          - id: command-goal')
  if (anchor === -1) throw new Error('the governed preset anchor (command-goal) was not found in the composition')
  const injected = original.slice(0, anchor)
    + CLOSED_ROWS.map((id) => `          - id: ${id}\n            name: '@deepseek-ai/dsh-${id}'\n`).join('')
    + original.slice(anchor)
  const mutated = join(dir, 'cordis.patch.yml')
  writeFileSync(mutated, injected)
  m4 = runSuite({ A5SF_PD25_COMPOSITION: mutated })
} finally {
  rmSync(dir, { recursive: true, force: true })
}
check('M4-row: PD25-SURFACE-CLOSED reddens', named(m4.outcomes, 'PD25-SURFACE-CLOSED') === false,
  `closed=${String(named(m4.outcomes, 'PD25-SURFACE-CLOSED'))}`)
check('M4-row: PD25-TYPED-REFUSAL stays green (the row arm measures the composition, not the router)',
  named(m4.outcomes, 'PD25-TYPED-REFUSAL') === true,
  `refusal=${String(named(m4.outcomes, 'PD25-TYPED-REFUSAL'))}`)

// ── PIN: the BASE commit really carries the rows ────────────────────────────
const pin = runSuite({ A5SF_PD25_PIN: '1' })
check('PIN: the BASE commit carries both rows this lane removes', named(pin.outcomes, 'PD25-PIN') === true,
  `pin=${String(named(pin.outcomes, 'PD25-PIN'))}`)
let baseRows = []
try {
  const base = execFileSync('git', ['-C', REPO, 'show', `${BASE_COMMIT}:cordis.patch.yml`], { encoding: 'utf8' })
  baseRows = CLOSED_ROWS.filter((id) => base.includes(`- id: ${id}`))
} catch (error) {
  check('PIN: the BASE composition is readable', false, String(error?.message ?? error))
}
check('PIN: git really shows the pre-fix rows at the BASE commit', baseRows.length === CLOSED_ROWS.length,
  `rows=${JSON.stringify(baseRows)}`)

const failed = results.filter((r) => r.ok !== true)
console.log(`\nMUTATION CONTROLS ${failed.length === 0 ? 'PASS' : 'FAIL'} (${String(results.length - failed.length)}/${String(results.length)})`)
if (failed.length > 0) process.exitCode = 1
