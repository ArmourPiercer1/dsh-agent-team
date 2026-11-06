#!/usr/bin/env node
/**
 * PD-1 fix — negative controls (two mutations, each restored byte-for-byte).
 *
 * CONTROL A (the required one): revert ONLY the new unconditional recording
 * line in `revoke` (`revokedMembers.add(revokedKey)`). The pre-fix live-domain
 * recording path inside the kill loop is still there, so:
 *   - `PD-1 REFUSAL` MUST red (a member with no live domain is never recorded);
 *   - `PD-1 CONTRAST (live domain)` MUST stay green (the loop records it);
 *   - `PD-1 IN-FLIGHT` MUST stay green (the live shell on the other binding
 *     records the generation; the post-await re-check still reaps the late
 *     creation);
 *   - `PD-1 CONTRAST (new generation)` MUST stay green.
 * This isolates the PD-1 fix line from the race fix and from the contrast.
 *
 * CONTROL B (the race window): disable ONLY the post-await re-check
 * (`if (revokedMembers.has(memberKey(identity)))` after `spawn`). The
 * unconditional recording is still there, so the refusal and both contrasts
 * stay green while `PD-1 IN-FLIGHT` MUST red: the late creation is published
 * and becomes usable — the exact race the ruling asked us to close.
 *
 * CORE PATCH BUDGET = 0. The product file is restored after every run,
 * compared byte-for-byte and by sha256, and `git diff --quiet` must exit 0.
 *
 * Run: node dev/agent-workflow/evidence/a5sf-pd1-fix/mutation-control.mjs
 */
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = join(HERE, '..', '..', '..', '..')
const ARM_REL = 'tests/world-factory/a5sf-pd1-revocation-escape.test.mjs'
const ARM = join(REPO, ARM_REL)
const TARGET_REL = 'packages/runtime/team-sandbox/src/terminal.ts'
const TARGET = join(REPO, TARGET_REL)

const ARMS = [
  'PD-1 REFUSAL',
  'PD-1 CONTRAST (live domain)',
  'PD-1 IN-FLIGHT',
  'PD-1 CONTRAST (new generation)',
  'PD-1 REGISTER',
]

const sha256 = (text) => createHash('sha256').update(text).digest('hex')
const ORIGINAL = readFileSync(TARGET, 'utf8')
const ORIGINAL_SHA = sha256(ORIGINAL)
/** The working tree already carries the FIX itself, so "clean" means "equals
 *  the bytes at script start", not "equals HEAD". */
const INITIAL_DIFF = spawnSync('git', ['diff', '--', TARGET_REL], { cwd: REPO, encoding: 'utf8' }).stdout

function mutate(source, [from, to], what) {
  const occurrences = source.split(from).length - 1
  assert.equal(occurrences, 1, `PD-1 control: expected exactly one occurrence of "${what}" (${JSON.stringify(from)}), found ${occurrences} — the source moved; update the control`)
  const mutated = source.replace(from, to)
  assert.notEqual(sha256(mutated), ORIGINAL_SHA, `PD-1 control: mutation "${what}" changed nothing`)
  return mutated
}

function runArms() {
  const result = spawnSync(process.execPath, ['--test', '--test-reporter=tap', ARM], { cwd: REPO, encoding: 'utf8' })
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`
  const lines = output.split('\n')
  const notOk = lines.filter((line) => /^not ok \d+ - /.test(line)).map((line) => line.replace(/^not ok \d+ - /, ''))
  const ok = lines.filter((line) => /^ok \d+ - /.test(line)).map((line) => line.replace(/^ok \d+ - /, ''))
  return { status: result.status, output, notOk, ok }
}

function report(step, run, { green, redArms, greenArms, tokensPresent = [], tokensAbsent = [] }) {
  const expectedGreen = green ? run.status === 0 : run.status !== 0
  const wrongRed = run.notOk.filter((name) => !redArms.some((arm) => name.startsWith(arm)))
  const missingGreen = greenArms.filter((arm) => !run.ok.some((name) => name.startsWith(arm)))
  const missingToken = tokensPresent.filter((token) => !run.output.includes(token))
  const forbiddenToken = tokensAbsent.filter((token) => run.output.includes(token))
  const pass = expectedGreen && wrongRed.length === 0 && missingGreen.length === 0 && missingToken.length === 0 && forbiddenToken.length === 0
  console.log(
    `${pass ? 'PASS' : 'FAIL'} ${step}: exit=${run.status} expected=${green ? 'green' : 'red'} ` +
      `red=[${run.notOk.map((n) => n.split(':')[0]).join('; ')}]`,
  )
  if (wrongRed.length > 0) console.log(`     UNEXPECTED RED: ${wrongRed.join('; ')}`)
  if (missingGreen.length > 0) console.log(`     MISSING GREEN: ${missingGreen.join('; ')}`)
  if (missingToken.length > 0) console.log(`     MISSING TOKEN: ${missingToken.join(', ')}`)
  if (forbiddenToken.length > 0) console.log(`     FORBIDDEN TOKEN: ${forbiddenToken.join(', ')}`)
  return pass
}

let allOk = true

// 0. Baseline: all five arms green on the real source.
{
  const run = runArms()
  allOk =
    report('baseline (unmutated): all five arms green', run, {
      green: true,
      redArms: [],
      greenArms: ARMS,
      tokensPresent: ['PD1-REFUSAL-ZERO-ALLOC', 'PD1-CONTRAST-WITH-DOMAIN', 'PD1-INFLIGHT-REAPED', 'PD1-CONTRAST-NEW-GENERATION-ACQUIRES'],
    }) && allOk
}

// 1. CONTROL A: revert only the unconditional recording line.
{
  const mutated = mutate(
    ORIGINAL,
    ['      revokedMembers.add(revokedKey)\n', '      // PD-1 NEGATIVE CONTROL: unconditional recording reverted\n'],
    'unconditional recording line',
  )
  writeFileSync(TARGET, mutated, 'utf8')
  console.log(`MUTATED A ${TARGET_REL}: ${ORIGINAL_SHA} -> ${sha256(mutated)} (removed the unconditional recording line)`)
  const run = runArms()
  allOk =
    report('mutation A (revert ONLY the new recording line): exactly PD-1 REFUSAL reds', run, {
      green: false,
      redArms: ['PD-1 REFUSAL'],
      greenArms: ['PD-1 CONTRAST (live domain)', 'PD-1 IN-FLIGHT', 'PD-1 CONTRAST (new generation)'],
      tokensPresent: ['PD1-CONTRAST-WITH-DOMAIN', 'PD1-INFLIGHT-REAPED', 'PD1-CONTRAST-NEW-GENERATION-ACQUIRES'],
      tokensAbsent: ['PD1-REFUSAL-ZERO-ALLOC'],
    }) && allOk
  writeFileSync(TARGET, ORIGINAL, 'utf8')
  assert.equal(sha256(readFileSync(TARGET, 'utf8')), ORIGINAL_SHA, 'PD-1 control A: source not restored')
}

// 2. CONTROL B: disable only the post-await re-check (the race window).
{
  const mutated = mutate(
    ORIGINAL,
    ['        if (revokedMembers.has(memberKey(identity))) {\n', '        if (false && revokedMembers.has(memberKey(identity))) { // PD-1 NEGATIVE CONTROL\n'],
    'post-await revocation re-check',
  )
  writeFileSync(TARGET, mutated, 'utf8')
  console.log(`MUTATED B ${TARGET_REL}: ${ORIGINAL_SHA} -> ${sha256(mutated)} (disabled the post-await re-check)`)
  const run = runArms()
  allOk =
    report('mutation B (disable ONLY the post-await re-check): exactly PD-1 IN-FLIGHT reds', run, {
      green: false,
      redArms: ['PD-1 IN-FLIGHT'],
      greenArms: ['PD-1 REFUSAL', 'PD-1 CONTRAST (live domain)', 'PD-1 CONTRAST (new generation)'],
      tokensPresent: ['PD1-REFUSAL-ZERO-ALLOC', 'PD1-CONTRAST-WITH-DOMAIN', 'PD1-CONTRAST-NEW-GENERATION-ACQUIRES'],
      tokensAbsent: ['PD1-INFLIGHT-REAPED'],
    }) && allOk
  writeFileSync(TARGET, ORIGINAL, 'utf8')
  assert.equal(sha256(readFileSync(TARGET, 'utf8')), ORIGINAL_SHA, 'PD-1 control B: source not restored')
}

// 3. Restoration proof.
const restored = readFileSync(TARGET, 'utf8')
assert.equal(restored, ORIGINAL, 'PD-1 control: product file bytes differ after restore')
const FINAL_DIFF = spawnSync('git', ['diff', '--', TARGET_REL], { cwd: REPO, encoding: 'utf8' }).stdout
assert.equal(FINAL_DIFF, INITIAL_DIFF, `PD-1 control: the working-tree diff for ${TARGET_REL} changed after restore`)
console.log(`RESTORED ${TARGET_REL}: sha256=${ORIGINAL_SHA} bytes-identical=yes git-diff-equals-start=yes`)

// 4. Baseline again on the restored bytes.
{
  const run = runArms()
  allOk =
    report('restored: all five arms green again', run, {
      green: true,
      redArms: [],
      greenArms: ARMS,
    }) && allOk
}

if (!allOk) {
  console.error('PD1-MUTATION-CONTROL-FAIL')
  process.exit(1)
}
console.log('PD1-MUTATION-CONTROL-PASS')
