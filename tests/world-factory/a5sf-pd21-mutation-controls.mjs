#!/usr/bin/env node
/**
 * tests/world-factory/a5sf-pd21-mutation-controls.mjs — PD-21's two mutation
 * controls, run as one host-free command.
 *
 * A test that only ever passes proves nothing about what it measures. PD-21
 * claims "the governed preset carries no subagent row, so a governed Member's
 * `subagent` dispatch is a typed UNKNOWN_TOOL". This script makes that claim
 * pay for itself:
 *
 *   M1 (REFUSAL arm)  register a DISPATCHABLE `subagent` tripwire in the
 *                     governed-shaped tool registry. `PD21-TYPED-REFUSAL` MUST
 *                     go red; a green run would mean the arm checks a string,
 *                     not an absence.
 *   M2 (SURFACE arm)  re-insert `tool-subagent` into a COPY of
 *                     `cordis.patch.yml`. `PD21-SURFACE-CLOSED` MUST go red.
 *
 * The clean control run must be green. Every run is `node --test` on the same
 * suite; no boot, no port, no DSH_HOME. The mutated composition is written
 * under `tests/homes/pd21-mutation-controls/` (gitignored) and left there as
 * the artefact of the run.
 *
 * Exit code: 0 only when all three expectations hold.
 *
 * Run: node tests/world-factory/a5sf-pd21-mutation-controls.mjs
 */
import { spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..', '..')
const SUITE = join(HERE, 'a5sf-pd21-subagent.test.mjs')
const MUTATION_DIR = join(REPO, 'tests', 'homes', 'pd21-mutation-controls')
const MUTATED_COMPOSITION = join(MUTATION_DIR, 'cordis.patch.yml')

/** Re-insert the removed row into the governed preset of a COPY. */
function writeMutatedComposition() {
  const text = readFileSync(join(REPO, 'cordis.patch.yml'), 'utf8')
  const presetAt = text.indexOf('    - id: "preset-a5sf-governed-member"')
  if (presetAt === -1) throw new Error('the governed preset row is absent from cordis.patch.yml')
  // Insert at the END of the preset's plugin list: the last row before the next
  // top-level row (`    - id:`), i.e. `tool-plugin-manager`, which is unique
  // inside the preset. A simpler, stable anchor is the `tool-ask-user` row.
  const anchor = '          - id: tool-ask-user\n'
  const at = text.indexOf(anchor, presetAt)
  if (at === -1) throw new Error('the tool-ask-user anchor is absent inside the governed preset')
  const injected = [
    '          - id: tool-subagent\n',
    "            name: '@deepseek-ai/dsh-tool-subagent'\n",
    '            config:\n',
    '              provider: spawn\n',
    '              toolName: subagent\n',
    '              backgroundMode: continuable\n',
  ].join('')
  mkdirSync(MUTATION_DIR, { recursive: true })
  writeFileSync(MUTATED_COMPOSITION, `${text.slice(0, at)}${injected}${text.slice(at)}`, 'utf8')
  return MUTATED_COMPOSITION
}

function runSuite(env, label) {
  const result = spawnSync(process.execPath, ['--test', SUITE], {
    cwd: REPO,
    encoding: 'utf8',
    env: { ...process.env, ...env },
    timeout: 180_000,
  })
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`
  const failedNames = [...output.matchAll(/^✖ (.+?) \(/gmu)].map((m) => m[1])
  console.log(`\n── ${label}: exit=${String(result.status)} failed=[${failedNames.join(' | ')}]`)
  return { status: result.status, failedNames, output }
}

const controls = []
controls.push({
  id: 'CLEAN',
  expectation: 'the unmutated suite is GREEN',
  run: runSuite({}, 'CLEAN control'),
  ok: (r) => r.status === 0 && r.failedNames.length === 0,
})
controls.push({
  id: 'M1-REFUSAL',
  expectation: 'a dispatchable `subagent` REDDENS pd21 TYPED-REFUSAL',
  run: runSuite({ A5SF_PD21_MUTATE_REGISTER_SUBAGENT: '1' }, 'M1 dispatchable subagent'),
  ok: (r) => r.status !== 0 && r.failedNames.some((n) => n.includes('PD21-TYPED-REFUSAL')),
})
const mutated = writeMutatedComposition()
console.log(`mutated composition: ${mutated}`)
controls.push({
  id: 'M2-SURFACE',
  expectation: 'a re-inserted tool-subagent row REDDENS PD21-SURFACE-CLOSED',
  run: runSuite({ A5SF_PD21_COMPOSITION: mutated }, 'M2 re-added tool-subagent'),
  ok: (r) => r.status !== 0 && r.failedNames.some((n) => n.includes('PD21-SURFACE-CLOSED')),
})

let ok = true
console.log('\nMUTATION CONTROLS')
for (const control of controls) {
  const passed = control.ok(control.run)
  if (!passed) ok = false
  console.log(`  ${passed ? 'PASS' : 'FAIL'}  ${control.id}: ${control.expectation}`)
}
console.log(`\nMUTATION CONTROLS ${ok ? 'PASS' : 'FAIL'} (${controls.filter((c) => c.ok(c.run)).length}/${controls.length})`)
process.exitCode = ok ? 0 : 1
