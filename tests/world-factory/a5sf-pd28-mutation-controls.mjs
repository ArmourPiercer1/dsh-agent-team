#!/usr/bin/env node
/**
 * tests/world-factory/a5sf-pd28-mutation-controls.mjs — the mutation controls
 * for PD-28. A suite that cannot go red is not evidence, so each control is
 * driven to its OWN red while the other arms stay green.
 *
 *   CLEAN  no hook set                 every arm green
 *   M1     A5SF_PD28_SKILL_FS=base    the SAME `skills` provider module with the
 *                                     SAME catalog, mounted on the PRESET scope
 *                                     (whose `fs` is the BASE provider) instead
 *                                     of inside the Member's realm. The service
 *                                     face is the only thing that changed, so
 *                                     PD28-SKILL's out-of-lane clause MUST go
 *                                     red (body served, no refusal) — this is
 *                                     the exact regression the seam exists to
 *                                     prevent, and "it looks restored" while
 *                                     reading the base fs is the failure mode.
 *   M2     A5SF_PD28_PRESENT_ROUTED=1 the pinned host `present` package mounted
 *                                     ROUTED (through the registration router)
 *                                     instead of directly. The shadow still
 *                                     works and the in-lane read still passes,
 *                                     but the module's own `tools/result`
 *                                     listener never receives the dispatch, so
 *                                     PD28-PRESENT's "exactly ONE delivery"
 *                                     clause MUST go red (0 events).
 *   PIN    A5SF_PD28_PIN=1            the pre-fix commit is read out of git and
 *                                     the SAME harness reproduces PD-23 (`skill`
 *                                     unknown with no provider) and PD-24
 *                                     (`present` accepts a real out-of-lane file
 *                                     through the base fs with zero facts).
 *
 * Every arm is a real `node --test` child process; the verdict is its exit code
 * plus the NAMES of the failing tests, so a green CLEAN that hides a red M1
 * cannot happen. Writes `mutation-controls.log` and archives the measured
 * pre-fix row under the lane's evidence dir.
 *
 * CORE PATCH BUDGET = 0. No boot, no port, no DSH_HOME, no git write.
 *
 * Run: node tests/world-factory/a5sf-pd28-mutation-controls.mjs
 *
 * @module tests/world-factory/a5sf-pd28-mutation-controls
 */
import { execFileSync, spawnSync } from 'node:child_process'
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..', '..')
const SUITE = join(HERE, 'a5sf-pd28-service-seam.test.mjs')
const EVIDENCE = join(REPO, 'dev', 'agent-workflow', 'evidence', 'a5sf-pd28-service-seam')
const LOG = join(EVIDENCE, 'mutation-controls.log')
const ARCHIVE = join(EVIDENCE, 'archive')
const BASE_COMMIT = '24d2cf760'

mkdirSync(join(ARCHIVE, 'pre-fix'), { recursive: true })

// The measured pre-fix row: the two Team tool forks, straight out of git.
const baseRow = execFileSync(
  'git',
  ['-C', REPO, 'show', `${BASE_COMMIT}:packages/runtime/src/plugin/live/a5sf-realm-row.mjs`],
  { encoding: 'utf8' },
)
writeFileSync(join(ARCHIVE, 'pre-fix', 'a5sf-realm-row.mjs'), baseRow)
// The pre-fix placement record names both forks; keep it beside the row so the
// archive cannot be read as "the provider existed at BASE".
const basePlacements = execFileSync(
  'git',
  ['-C', REPO, 'ls-tree', '-r', '--name-only', BASE_COMMIT, 'packages/runtime/src/plugin/live'],
  { encoding: 'utf8' },
).split('\n').filter((line) => line.includes('confined-') || line.includes('skill-provider'))
writeFileSync(join(ARCHIVE, 'pre-fix', 'live-modules.txt'), `${basePlacements.join('\n')}\n`)

writeFileSync(LOG, `# PD-28 mutation controls — ${new Date().toISOString()}\n`)

function run(label, env) {
  const result = spawnSync(process.execPath, ['--test', SUITE], {
    cwd: REPO,
    encoding: 'utf8',
    env: { ...process.env, ...env },
    timeout: 300_000,
  })
  const output = `${String(result.stdout ?? '')}${String(result.stderr ?? '')}`
  const strip = (line) => line.replace(/\s*\(\d+(?:\.\d+)?ms\)\s*$/u, '').replace(/^[✔✖]\s+/u, '').trim()
  const isTest = (name) => name.startsWith('PD28-')
  const failing = [...new Set([...output.matchAll(/^✖ (.+)$/gmu)].map((match) => strip(match[0])))].filter(isTest)
  const passing = [...new Set([...output.matchAll(/^✔ (.+)$/gmu)].map((match) => strip(match[0])))].filter(isTest)
  const passed = result.status === 0
  const line = `[${new Date().toISOString()}] ${label}: ${passed ? 'PASS' : 'FAIL'} (exit=${String(result.status)})`
    + ` passing=${JSON.stringify(passing)} failing=${JSON.stringify(failing)}`
  appendFileSync(LOG, `${line}\n`)
  // eslint-disable-next-line no-console
  console.log(line)
  return { label, passed, failing, passing, status: result.status }
}

const SKILL_ARM = 'PD28-SKILL:'
const PRESENT_ARM = 'PD28-PRESENT:'
const clean = run('CLEAN', {})
const m1 = run('M1 the skills provider mounted on the BASE-facing preset scope', { A5SF_PD28_SKILL_FS: 'base' })
const m2 = run('M2 the host `present` mounted ROUTED (the pre-PD-28 route)', { A5SF_PD28_PRESENT_ROUTED: '1' })
const pin = run('PIN the pre-fix surface read out of git and measured', { A5SF_PD28_PIN: '1' })

const failures = []
const expect = (label, condition, detail) => {
  if (!condition) failures.push(`${label}: ${detail}`)
  appendFileSync(LOG, `[check] ${condition ? 'ok' : 'RED'} ${label} — ${detail}\n`)
  // eslint-disable-next-line no-console
  console.log(`${condition ? 'ok  ' : 'RED '} ${label} — ${detail}`)
}

expect('CLEAN is green', clean.passed, `failing=${JSON.stringify(clean.failing)}`)
expect(
  'M1 reddens the SKILL arm',
  m1.passed === false && m1.failing.some((name) => name.startsWith(SKILL_ARM)),
  `failing=${JSON.stringify(m1.failing)}`,
)
expect(
  'M1 reddens ONLY the SKILL arm',
  m1.failing.every((name) => name.startsWith(SKILL_ARM)),
  `failing=${JSON.stringify(m1.failing)}`,
)
expect(
  'M1 leaves the PRESENT and HOST-DEFINITIONS arms green',
  m1.passing.some((name) => name.startsWith(PRESENT_ARM)) && m1.passing.some((name) => name.startsWith('PD28-HOST-DEFINITIONS:')),
  `passing=${JSON.stringify(m1.passing)}`,
)
expect(
  'M2 reddens the PRESENT arm',
  m2.passed === false && m2.failing.some((name) => name.startsWith(PRESENT_ARM)),
  `failing=${JSON.stringify(m2.failing)}`,
)
expect(
  'M2 reddens ONLY the PRESENT arm',
  m2.failing.every((name) => name.startsWith(PRESENT_ARM)),
  `failing=${JSON.stringify(m2.failing)}`,
)
expect(
  'M2 leaves the SKILL arm green',
  m2.passing.some((name) => name.startsWith(SKILL_ARM)),
  `passing=${JSON.stringify(m2.passing)}`,
)
expect(
  'PIN is green and measures the pre-fix surface',
  pin.passed && pin.passing.some((name) => name.startsWith('PD28-PIN:')),
  `passing=${JSON.stringify(pin.passing)}`,
)

const verdict = failures.length === 0 ? 'PASS' : 'FAIL'
appendFileSync(LOG, `\nVERDICT ${verdict} (${String(8 - failures.length)}/8 checks)\n`)
// eslint-disable-next-line no-console
console.log(`\nVERDICT ${verdict}${failures.length === 0 ? '' : `\n${failures.join('\n')}`}`)
if (failures.length !== 0) process.exitCode = 1
