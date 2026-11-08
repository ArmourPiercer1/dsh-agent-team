/**
 * a5sf-pd23-mutation-controls.mjs — the mutation controls for PD-23.
 *
 * A green suite proves nothing unless each arm CAN go red. This script drives
 * the host-free suite four times and asserts the exact arm that reddens:
 *
 *   CLEAN        no mutation                              everything GREEN
 *   M1-control   register dispatchable send_message /     PD23-TYPED-REFUSAL RED,
 *                interrupt_agent / list_agents            the SURFACE arms stay GREEN
 *   M2-skill     register a dispatchable `skill` loader   PD23-TYPED-REFUSAL RED
 *   M3-row       re-insert the removed `tool-skill` and   PD23-SURFACE-CLOSED RED,
 *                `tool-subagent-control` rows into a      PD23-TYPED-REFUSAL stays GREEN
 *                COPY of the composition
 *
 * The mutations are fixtures: they live only inside the child processes and a
 * temp copy of `cordis.patch.yml` under the OS temp dir. The tracked file is
 * never written. Exit code 0 = every mutation reddened the arm it names.
 *
 * Run: node tests/world-factory/a5sf-pd23-mutation-controls.mjs
 */
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..', '..')
const SUITE = join(HERE, 'a5sf-pd23-control-surface.test.mjs')
const COMPOSITION = join(REPO, 'cordis.patch.yml')

const BASE_COMMIT = 'c5d619e53'
const CLOSED_ROWS = ['tool-subagent-control', 'tool-subagent-list-agents', 'tool-skill', 'skill-filesystem']

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

// ── M1: a dispatchable CONTROL tool must redden the refusal arm ─────────────
const m1 = runSuite({ A5SF_PD23_MUTATE_REGISTER: 'control' })
check('M1-control: PD23-TYPED-REFUSAL reddens', named(m1.outcomes, 'PD23-TYPED-REFUSAL') === false,
  `refusal=${String(named(m1.outcomes, 'PD23-TYPED-REFUSAL'))}`)
check('M1-control: the SURFACE arms stay green (the mutation is not a global break)',
  named(m1.outcomes, 'PD23-SURFACE-CLOSED') === true && named(m1.outcomes, 'PD23-SURFACE-SURGICAL') === true,
  `closed=${String(named(m1.outcomes, 'PD23-SURFACE-CLOSED'))} surgical=${String(named(m1.outcomes, 'PD23-SURFACE-SURGICAL'))}`)

// ── M2: a dispatchable SKILL loader must redden the refusal arm ─────────────
const m2 = runSuite({ A5SF_PD23_MUTATE_REGISTER: 'skill' })
check('M2-skill: PD23-TYPED-REFUSAL reddens', named(m2.outcomes, 'PD23-TYPED-REFUSAL') === false,
  `refusal=${String(named(m2.outcomes, 'PD23-TYPED-REFUSAL'))}`)

// ── M3: re-inserting the removed rows must redden the surface arm ───────────
const dir = mkdtempSync(join(tmpdir(), 'pd23-mut-'))
let m3
try {
  const original = readFileSync(COMPOSITION, 'utf8')
  const anchor = original.indexOf('          - id: tool-jobs')
  if (anchor === -1) throw new Error('the governed preset anchor (tool-jobs) was not found in the composition')
  const injected = original.slice(0, anchor)
    + CLOSED_ROWS.map((id) => `          - id: ${id}\n            name: '@deepseek-ai/dsh-${id.replace(/^tool-/u, 'tool-')}'\n`).join('')
    + original.slice(anchor)
  const mutated = join(dir, 'cordis.patch.yml')
  writeFileSync(mutated, injected)
  m3 = runSuite({ A5SF_PD23_COMPOSITION: mutated })
} finally {
  rmSync(dir, { recursive: true, force: true })
}
check('M3-row: PD23-SURFACE-CLOSED reddens', named(m3.outcomes, 'PD23-SURFACE-CLOSED') === false,
  `closed=${String(named(m3.outcomes, 'PD23-SURFACE-CLOSED'))}`)
check('M3-row: PD23-TYPED-REFUSAL stays green (the row arm measures the composition, not the router)',
  named(m3.outcomes, 'PD23-TYPED-REFUSAL') === true,
  `refusal=${String(named(m3.outcomes, 'PD23-TYPED-REFUSAL'))}`)

// ── PIN: the BASE commit really carries the rows ────────────────────────────
let baseRows = []
try {
  const base = execFileSync('git', ['-C', REPO, 'show', `${BASE_COMMIT}:cordis.patch.yml`], { encoding: 'utf8' })
  baseRows = CLOSED_ROWS.filter((id) => base.includes(`- id: ${id}`))
} catch (error) {
  check('PIN: the BASE composition is readable', false, String(error?.message ?? error))
}
check('PIN: the BASE commit carries every row this lane removes', baseRows.length === CLOSED_ROWS.length,
  `rows=${JSON.stringify(baseRows)}`)

const failed = results.filter((r) => r.ok !== true)
console.log(`\nMUTATION CONTROLS ${failed.length === 0 ? 'PASS' : 'FAIL'} (${String(results.length - failed.length)}/${String(results.length)})`)
if (failed.length > 0) process.exitCode = 1
