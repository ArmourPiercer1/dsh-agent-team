#!/usr/bin/env node
/**
 * tests/world-factory/a5sf-pd24-mutation-controls.mjs — the mutation controls
 * for PD-24. A suite that cannot go red is not evidence, so each arm is driven
 * to its OWN red and the other arms are asserted to stay green.
 *
 *   CLEAN                        everything green
 *   M1  A5SF_PD24_MUTATE_REGISTER=present
 *                                the REFUSAL arm must go red (a dispatchable
 *                                `present` is exactly what the removal forbids)
 *   M2  A5SF_PD24_COMPOSITION=<archived pre-fix composition>
 *                                the SURFACE arm must go red (the pre-fix file
 *                                still declares `present`), while the REFUSAL
 *                                arm stays green (it measures the router, not
 *                                the composition)
 *   PIN A5SF_PD24_PIN=1          the pre-fix row is read out of git and the
 *                                archived composition must equal it
 *
 * Every arm is a real `node --test` child process; the verdict is its exit code
 * plus the name of the failing test, so a green CLEAN that hides a red M1 cannot
 * happen. Writes only `mutation-controls.log` under the lane's evidence dir.
 *
 * CORE PATCH BUDGET = 0. No boot, no port, no DSH_HOME, no git write.
 *
 * Run: node tests/world-factory/a5sf-pd24-mutation-controls.mjs
 *
 * @module tests/world-factory/a5sf-pd24-mutation-controls
 */
import { spawnSync } from 'node:child_process'
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..', '..')
const SUITE = join(HERE, 'a5sf-pd24-surface-ledger.test.mjs')
const EVIDENCE = join(REPO, 'dev', 'agent-workflow', 'evidence', 'a5sf-pd24-surface-ledger')
const LOG = join(EVIDENCE, 'mutation-controls.log')
const PRE_FIX = join(EVIDENCE, 'archive', 'pre-fix', 'cordis.patch.yml')

mkdirSync(EVIDENCE, { recursive: true })
writeFileSync(LOG, `# PD-24 mutation controls — ${new Date().toISOString()}\n`)

function run(label, env) {
  const result = spawnSync(process.execPath, ['--test', SUITE], {
    cwd: REPO,
    encoding: 'utf8',
    env: { ...process.env, ...env },
    timeout: 300_000,
  })
  const output = `${String(result.stdout ?? '')}${String(result.stderr ?? '')}`
  // `node --test` prints the spec reporter: `✔ name (1.2ms)` / `✖ name (0.3ms)`.
  // (TAP's `ok N - name` is only used with --test-reporter=tap.)
  const strip = (line) => line.replace(/\s*\(\d+(?:\.\d+)?ms\)\s*$/u, '').replace(/^[✔✖]\s+/u, '').trim()
  // Only test NAMES count: the spec reporter repeats the failures under a
  // `✖ failing tests:` header, which is not a test.
  const isTest = (name) => name.startsWith('PD24-')
  const failing = [...new Set([...output.matchAll(/^✖ (.+)$/gmu)].map((m) => strip(m[0])))].filter(isTest)
  const passing = [...new Set([...output.matchAll(/^✔ (.+)$/gmu)].map((m) => strip(m[0])))].filter(isTest)
  const passed = result.status === 0
  const line = `[${new Date().toISOString()}] ${label}: ${passed ? 'PASS' : 'FAIL'} (exit=${String(result.status)})`
    + ` passing=${JSON.stringify(passing)} failing=${JSON.stringify(failing)}`
  appendFileSync(LOG, `${line}\n`)
  // eslint-disable-next-line no-console
  console.log(line)
  return { label, passed, failing, passing, status: result.status }
}

const clean = run('CLEAN', {})
const m1 = run('M1 register a dispatchable present', { A5SF_PD24_MUTATE_REGISTER: 'present' })
const m2 = run('M2 boot the archived PRE-FIX composition', { A5SF_PD24_COMPOSITION: PRE_FIX })
const pin = run('PIN read the pre-fix row out of git', { A5SF_PD24_PIN: '1' })

const failures = []
const expect = (label, condition, detail) => {
  if (!condition) failures.push(`${label}: ${detail}`)
  appendFileSync(LOG, `[check] ${condition ? 'ok' : 'RED'} ${label} — ${detail}\n`)
  // eslint-disable-next-line no-console
  console.log(`${condition ? 'ok  ' : 'RED '} ${label} — ${detail}`)
}

expect('CLEAN is green', clean.passed, 'every arm green with no hook set')
expect('M1 reddens the REFUSAL arm', m1.passed === false && m1.failing.some((t) => t.startsWith('PD24-TYPED-REFUSAL')), `failing=${JSON.stringify(m1.failing)}`)
expect('M1 leaves SURFACE/PIN/LEDGER green', m1.failing.every((t) => t.startsWith('PD24-TYPED-REFUSAL')), `failing=${JSON.stringify(m1.failing)}`)
expect('M2 reddens the SURFACE arm only', m2.passed === false && m2.failing.length === 1 && m2.failing[0].startsWith('PD24-SURFACE-CLOSED'), `failing=${JSON.stringify(m2.failing)}`)
expect('M2 leaves the REFUSAL arm green', m2.passing.some((t) => t.startsWith('PD24-TYPED-REFUSAL')), 'the refusal arm measures the router, not the composition')
expect('PIN is green and reads the pre-fix row', pin.passed && pin.passing.some((t) => t.startsWith('PD24-PIN')), `passing=${JSON.stringify(pin.passing)}`)

const verdict = failures.length === 0 ? 'PASS' : 'FAIL'
appendFileSync(LOG, `\nVERDICT ${verdict} (${String(6 - failures.length)}/6 checks)\n`)
// eslint-disable-next-line no-console
console.log(`\nVERDICT ${verdict}${failures.length === 0 ? '' : `\n${failures.join('\n')}`}`)
if (failures.length !== 0) process.exitCode = 1
