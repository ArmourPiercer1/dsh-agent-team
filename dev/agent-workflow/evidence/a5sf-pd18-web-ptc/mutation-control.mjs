#!/usr/bin/env node
/**
 * mutation-control.mjs — PD-18 mutation controls (host-free, no boot).
 *
 * Two mutations, each must turn ONE named arm RED:
 *
 *   M1 SURFACE-READD   re-add the `tool-web` row to the governed preset in a
 *                      temporary copy of cordis.patch.yml and run the suite
 *                      against it (`A5SF_PD18_COMPOSITION`). Expected red:
 *                      PD18-SURFACE-CLOSED. This proves the surface arm reads
 *                      the shipped declaration rather than a constant.
 *   M2 DISPATCHABLE    make the `workflow` name dispatchable again in the
 *                      registry arm (`A5SF_PD18_MUTATE_REGISTER_WORKFLOW=1`).
 *                      Expected red: PD18-TYPED-REFUSAL. This proves the
 *                      refusal arm measures ABSENCE + ZERO EXECUTION rather
 *                      than a message string.
 *
 * Writes `mutations.log` in this directory. Exit 0 only when BOTH mutations
 * reddened the expected arm AND the unmutated suite stayed green.
 */
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = join(HERE, '..', '..', '..', '..')
const TMP = join(HERE, '.mutation')
const SUITE = 'tests/world-factory/a5sf-pd18-web-ptc.test.mjs'
const ROWS = []

function runSuite(env = {}) {
  const result = spawnSync(process.execPath, ['--test', SUITE], {
    cwd: REPO,
    encoding: 'utf8',
    env: { ...process.env, ...env },
  })
  const text = `${String(result.stdout ?? '')}\n${String(result.stderr ?? '')}`
  const failed = [...text.matchAll(/^✖\s+(PD18-[A-Z-]+)/gmu)].map((match) => match[1])
  return { status: result.status, failed: [...new Set(failed)], text }
}

function record(label, expected, observed) {
  const redOk = observed.failed.includes(expected)
  ROWS.push({ label, expected, observed: observed.failed, status: observed.status, reddened: redOk })
  return redOk
}

mkdirSync(TMP, { recursive: true })
let ok = true

// Baseline: the unmutated suite is green.
const baseline = runSuite()
const baselineOk = baseline.status === 0 && baseline.failed.length === 0
ROWS.push({ label: 'BASELINE', expected: '(none red)', observed: baseline.failed, status: baseline.status, reddened: baselineOk })
ok = ok && baselineOk

// M1 — re-add tool-web to the governed preset.
try {
  const source = readFileSync(join(REPO, 'cordis.patch.yml'), 'utf8')
  const needle = "          - id: present\n"
  if (!source.includes(needle)) throw new Error('mutation anchor not found')
  const mutated = source.replace(needle, "          - id: tool-web\n            name: '@deepseek-ai/dsh-tool-web'\n            config:\n              fetch: true\n              searchTimeoutMs: 60000\n" + needle)
  const target = join(TMP, 'cordis.m1.patch.yml')
  writeFileSync(target, mutated)
  ok = record('M1 SURFACE-READD tool-web', 'PD18-SURFACE-CLOSED', runSuite({ A5SF_PD18_COMPOSITION: target })) && ok
} catch (error) {
  ROWS.push({ label: 'M1 SURFACE-READD tool-web', expected: 'PD18-SURFACE-CLOSED', observed: [`harness error: ${String(error?.message ?? error)}`], status: null, reddened: false })
  ok = false
}

// M2 — make `workflow` dispatchable again.
ok = record('M2 DISPATCHABLE workflow', 'PD18-TYPED-REFUSAL', runSuite({ A5SF_PD18_MUTATE_REGISTER_WORKFLOW: '1' })) && ok

const lines = [
  '# PD-18 mutation controls (host-free; every row is an observed suite run)',
  '',
  '| mutation | expected RED arm | observed RED arms | exit | verdict |',
  '| --- | --- | --- | --- | --- |',
  ...ROWS.map((row) => `| ${row.label} | ${row.expected} | ${row.observed.join(', ') || '(none)'} | ${String(row.status)} | ${row.reddened ? 'EXPECTED' : 'UNEXPECTED'} |`),
  '',
  `overall: ${ok ? 'PASS (baseline green; each mutation reddened its named arm)' : 'FAIL'}`,
  '',
  'M1 rewrites a temporary copy of `cordis.patch.yml` (the repo file is never touched); the',
  'suite is pointed at it with `A5SF_PD18_COMPOSITION`. M2 sets',
  '`A5SF_PD18_MUTATE_REGISTER_WORKFLOW=1`, which registers a tripwire `workflow` definition',
  'in the test registry: the arm must then observe EXECUTION instead of `unknown tool`.',
  '',
]
writeFileSync(join(HERE, 'mutations.log'), lines.join('\n'))
rmSync(TMP, { recursive: true, force: true })
// eslint-disable-next-line no-console
console.log(lines.join('\n'))
process.exitCode = ok ? 0 : 1
