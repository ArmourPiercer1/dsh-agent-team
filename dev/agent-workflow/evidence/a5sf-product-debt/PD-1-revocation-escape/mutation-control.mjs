#!/usr/bin/env node
/**
 * PD-1 negative control — prove the acceptance arm measures the DEFECT and not
 * a fixture artefact.
 *
 * THE CONTROL. `packages/runtime/team-sandbox/src/terminal.ts` is mutated
 * in-process so the revocation is recorded unconditionally, even for a member
 * that owns no live domain (a member-scoped tombstone set, because
 * `revoke(memberInstanceId)` carries no generation — see the evidence README
 * §3). With the escape impossible, the SAME arm is run in control mode
 * (`A5SF_PD1_EXPECT=fixed`) and must be GREEN.
 *
 * WHY A CONTROL MODE AND NOT "the pin greens under mutation": the pin asserts
 * the escape. A mutation that removes the escape must make the pin's own
 * assertion fail (that is the inversion contract). The control therefore drives
 * the arm's *other* branch — the one a real fix will exercise — over the same
 * fixture. Both branches are in one file so there is nothing to drift.
 *
 * WHAT IS ALSO RECORDED (not required, but it is the handover proof): the pin
 * in its default mode, under the same mutation, REDS with the message that
 * names the register row. That is exactly what a real PD-1 fix will do.
 *
 * CORE PATCH BUDGET = 0. The product file is restored in a `finally`, compared
 * byte-for-byte and by sha256, and `git diff --quiet` must exit 0 for it. No
 * `packages/**` change is committed.
 *
 * Run: node dev/agent-workflow/evidence/a5sf-product-debt/PD-1-revocation-escape/mutation-control.mjs
 */
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = join(HERE, '..', '..', '..', '..', '..')
const ARM = join(REPO, 'tests', 'world-factory', 'a5sf-pd1-revocation-escape.test.mjs')
const TARGET = join(REPO, 'packages', 'runtime', 'team-sandbox', 'src', 'terminal.ts')
const TARGET_REL = relative(REPO, TARGET)

const sha256 = (text) => createHash('sha256').update(text).digest('hex')

const ORIGINAL = readFileSync(TARGET, 'utf8')
const ORIGINAL_SHA = sha256(ORIGINAL)

/** Three exact, single-occurrence edits; each is asserted to apply once. */
const MUTATION = [
  {
    what: 'declare the member-scoped tombstone set (unconditional revocation record)',
    from: '  const revokedMembers = new Set<string>()\n',
    to: '  const revokedMembers = new Set<string>()\n  const revokedMemberIds = new Set<string>() // PD-1 NEGATIVE CONTROL\n',
  },
  {
    what: 'record the member even when it owns no live domain',
    from: '      if (memberInstanceId !== undefined) {\n        for (const domain of domains.values()) {\n',
    to: '      if (memberInstanceId !== undefined) {\n        revokedMemberIds.add(memberInstanceId) // PD-1 NEGATIVE CONTROL\n        for (const domain of domains.values()) {\n',
  },
  {
    what: 'consult the unconditional record at acquire',
    from: '    if (revokedMembers.has(memberKey(identity))) {\n',
    to: '    if (revokedMembers.has(memberKey(identity)) || revokedMemberIds.has(identity.memberInstanceId)) { // PD-1 NEGATIVE CONTROL\n',
  },
]

function mutate(source) {
  let text = source
  for (const edit of MUTATION) {
    const occurrences = text.split(edit.from).length - 1
    assert.equal(occurrences, 1, `PD-1 control: expected exactly one occurrence of "${edit.what}" (${JSON.stringify(edit.from)}), found ${occurrences} — the source moved; update the control`)
    text = text.replace(edit.from, edit.to)
  }
  assert.notEqual(sha256(text), ORIGINAL_SHA, 'PD-1 control: the mutation changed nothing')
  return text
}

function runArm(token, mode) {
  const env = { ...process.env }
  delete env.A5SF_PD1_EXPECT
  if (mode !== undefined) env.A5SF_PD1_EXPECT = mode
  const result = spawnSync(process.execPath, ['--test', ARM], { cwd: REPO, encoding: 'utf8', env })
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`
  return { status: result.status, output, token }
}

function score(step, run, { green, mustInclude, mustExclude = [] }) {
  const okStatus = green ? run.status === 0 : run.status !== 0
  const missing = mustInclude.filter((needle) => !run.output.includes(needle))
  const forbidden = mustExclude.filter((needle) => run.output.includes(needle))
  const pass = okStatus && missing.length === 0 && forbidden.length === 0
  console.log(
    `${pass ? 'PASS' : 'FAIL'} ${step}: exit=${run.status} expected=${green ? 'green' : 'red'}` +
      (missing.length > 0 ? ` missing=${missing.join(',')}` : '') +
      (forbidden.length > 0 ? ` forbidden=${forbidden.join(',')}` : ''),
  )
  if (run.token !== undefined) {
    const tokens = run.output.split('\n').filter((line) => line.trim() === run.token)
    console.log(`     token ${run.token}: ${tokens.length} occurrence(s)`)
    assert.equal(tokens.length, 1, `PD-1 control: ${step} must print ${run.token} exactly once`)
  }
  return pass
}

let ok = true
try {
  // 0. The pin is green on the UNMUTATED source and prints its escape token.
  {
    const run = runArm('PD1-ESCAPE-REPRODUCED')
    ok = score('baseline: the pin is green on the real source (escape still exists)', run, {
      green: true,
      mustInclude: ['PD1-ESCAPE-REPRODUCED'],
    }) && ok
  }

  // 1. Mutate: revocation is recorded even with no live domain.
  const MUTATED = mutate(ORIGINAL)
  writeFileSync(TARGET, MUTATED, 'utf8')
  console.log(`MUTATED ${TARGET_REL}: ${ORIGINAL_SHA} -> ${sha256(MUTATED)}`)

  // 2. The SAME arm in control mode must be green: the escape is impossible.
  {
    const run = runArm('PD1-ESCAPE-CLOSED', 'fixed')
    ok = score('mutation: the same arm in control mode is GREEN (escape impossible)', run, {
      green: true,
      mustInclude: ['PD1-ESCAPE-CLOSED', 'DOMAIN_REVOKED'],
      mustExclude: ['PD1-ESCAPE-REPRODUCED'],
    }) && ok
    for (const line of run.output.split('\n').filter((l) => l.startsWith('PD1-CONTROL-REFUSAL'))) console.log(`     ${line}`)
  }

  // 3. The handover inversion: the pin in default mode reds and names the register row.
  {
    const run = runArm(undefined)
    ok = score('mutation: the pin in default mode REDS with the register handover message', run, {
      green: false,
      mustInclude: ['PD-1 NO LONGER ESCAPES', 'PRODUCT-DEBT-REGISTER.md', 'register needs updating'],
      mustExclude: ['PD1-ESCAPE-REPRODUCED'],
    }) && ok
    const handover = run.output.split('\n').find((line) => line.includes('PD-1 NO LONGER ESCAPES'))
    if (handover !== undefined) console.log(`     RED-MESSAGE: ${handover.trim()}`)
  }
} finally {
  writeFileSync(TARGET, ORIGINAL, 'utf8')
}

// 4. Restoration is byte-for-byte, sha256-identical, and git sees no diff.
const RESTORED = readFileSync(TARGET, 'utf8')
assert.equal(sha256(RESTORED), ORIGINAL_SHA, 'PD-1 control: the product file was NOT restored byte-for-byte')
assert.equal(RESTORED, ORIGINAL, 'PD-1 control: the product file bytes differ after restore')
const diff = spawnSync('git', ['diff', '--quiet', '--', TARGET_REL], { cwd: REPO })
assert.equal(diff.status, 0, `PD-1 control: git sees a diff in ${TARGET_REL} after restore (rc ${diff.status})`)
console.log(`RESTORED ${TARGET_REL}: sha256=${ORIGINAL_SHA} bytes-identical=yes git-diff=clean`)

// 5. The pin is green again on the restored source.
{
  const run = runArm('PD1-ESCAPE-REPRODUCED')
  ok = score('restored: the pin is green again on the original bytes', run, {
    green: true,
    mustInclude: ['PD1-ESCAPE-REPRODUCED'],
  }) && ok
}

if (!ok) {
  console.error('PD1-MUTATION-CONTROL-FAIL')
  process.exit(1)
}
console.log('PD1-MUTATION-CONTROL-PASS')
