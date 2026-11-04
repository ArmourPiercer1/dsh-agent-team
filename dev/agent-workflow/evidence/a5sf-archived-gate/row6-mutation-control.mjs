#!/usr/bin/env node
/**
 * row6-mutation-control.mjs — the two-seam property is pinned, not assumed.
 *
 * The diagnosis found the boot seam (seam 2) only by READING the code; the
 * on-demand seam (seam 1) was the measured one. A green arm alone cannot
 * prove both call sites are load-bearing, so this control removes the gate
 * at EXACTLY ONE seam at a time and requires the arm to go RED on exactly
 * the legs that seam protects:
 *
 *   M1 (seam 1 removed — ensureLiveAgentOnce): ARCHIVED and DISPOSED must
 *      FAIL (the cold resume happens again); SETTLED and RESTART must PASS
 *      (the boot seam still refuses).
 *   M2 (seam 2 removed — boot resume loop): RESTART must FAIL (the archived
 *      member is re-bound); the other three legs must PASS.
 *
 * The mutation is a literal, single-occurrence edit of the REAL source; the
 * original bytes are restored in `finally` and the sha256 is compared before
 * and after. A control that fails to produce the expected RED pattern exits
 * non-zero: "no RED" is a failure of the control, never a pass.
 *
 * Usage: node row6-mutation-control.mjs
 */
import { createHash } from 'node:crypto'
import { readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..', '..', '..', '..')
const SOURCE = join(ROOT, 'packages/runtime/src/plugin/live/agent-bindings.mjs')
const ARM_CONFIG = join(ROOT, 'dev/agent-workflow/evidence/a5sf-search-live/row6-vitest.config.mjs')
const REPORT = join(HERE, 'row6-mutation-control.report.json')
const sha = (text) => createHash('sha256').update(text).digest('hex')

const MUTANTS = [
  {
    id: 'M1-seam1-ensureLiveAgentOnce',
    description: 'remove the gate at the on-demand seam only (seam 1)',
    old: `    const refusal = memberResumeRefusal(sid, teamRoot)
    if (refusal !== null) throw refusal`,
    new: `    const refusal = memberResumeRefusal(sid, teamRoot)
    if (false && refusal !== null) throw refusal`,
    expect: { failed: ['ARCHIVED', 'DISPOSED'], passed: ['SETTLED', 'RESTART'] },
  },
  {
    id: 'M2-seam2-boot-resume-loop',
    description: 'remove the gate at the boot resume loop only (seam 2)',
    old: `          const refusal = memberResumeRefusal(child, rootSid, members)
          if (refusal !== null) {`,
    new: `          const refusal = memberResumeRefusal(child, rootSid, members)
          if (false && refusal !== null) {`,
    expect: { failed: ['RESTART'], passed: ['ARCHIVED', 'DISPOSED', 'SETTLED'] },
  },
]

function runArm() {
  rmSync(REPORT, { force: true })
  const proc = spawnSync(
    'pnpm',
    ['exec', 'vitest', 'run', '--config', ARM_CONFIG, '--reporter=json', `--outputFile=${REPORT}`],
    { cwd: ROOT, encoding: 'utf8', timeout: 600_000 },
  )
  if (!readFileSyncIfExists(REPORT)) {
    throw new Error(`vitest produced no JSON report (rc=${String(proc.status)}):\n${proc.stdout}\n${proc.stderr}`)
  }
  const report = JSON.parse(readFileSync(REPORT, 'utf8'))
  const legs = []
  for (const file of report.testResults ?? []) {
    for (const assertion of file.assertionResults ?? []) {
      legs.push({ title: assertion.title, status: assertion.status })
    }
  }
  return { legs, rc: proc.status }
}

function readFileSyncIfExists(path) {
  try {
    return readFileSync(path, 'utf8')
  } catch {
    return null
  }
}

const legOf = (title) =>
  // RESTART first: its title also names the ARCHIVED member it re-binds.
  title.includes('RESTART') ? 'RESTART'
    : title.includes('ARCHIVED') ? 'ARCHIVED'
      : title.includes('DISPOSED') ? 'DISPOSED'
        : title.includes('SETTLED') ? 'SETTLED'
          : 'UNKNOWN'

const original = readFileSync(SOURCE, 'utf8')
const originalSha = sha(original)
const outcomes = []
let controlFailed = false

try {
  for (const mutant of MUTANTS) {
    if (original.split(mutant.old).length - 1 !== 1) {
      throw new Error(`${mutant.id}: the mutation anchor is not unique in the source`)
    }
    writeFileSync(SOURCE, original.replace(mutant.old, mutant.new), 'utf8')
    const mutatedSha = sha(readFileSync(SOURCE, 'utf8'))
    const { legs, rc } = runArm()
    writeFileSync(SOURCE, original, 'utf8')
    const restoredSha = sha(readFileSync(SOURCE, 'utf8'))
    if (restoredSha !== originalSha) throw new Error(`${mutant.id}: source restore FAILED`)

    const observed = Object.fromEntries(legs.map((leg) => [legOf(leg.title), leg.status]))
    const failed = mutant.expect.failed.filter((leg) => observed[leg] !== 'failed')
    const passed = mutant.expect.passed.filter((leg) => observed[leg] !== 'passed')
    const red = mutant.expect.failed.every((leg) => observed[leg] === 'failed')
    const ok = red && failed.length === 0 && passed.length === 0
    if (!ok) controlFailed = true
    outcomes.push({
      mutant: mutant.id,
      description: mutant.description,
      mutatedSourceSha256: mutatedSha,
      restoredSourceSha256: restoredSha,
      vitestExitCode: rc,
      observed,
      expected: mutant.expect,
      verdict: ok ? 'RED-AS-REQUIRED' : 'CONTROL-FAILED',
    })
    console.log(`\n${mutant.id}: ${ok ? 'RED-AS-REQUIRED' : 'CONTROL-FAILED'}`)
    console.log(`  observed=${JSON.stringify(observed)}`)
    console.log(`  expected failed=${JSON.stringify(mutant.expect.failed)} passed=${JSON.stringify(mutant.expect.passed)}`)
  }
} finally {
  writeFileSync(SOURCE, original, 'utf8')
  const finalSha = sha(readFileSync(SOURCE, 'utf8'))
  if (finalSha !== originalSha) {
    console.error(`FATAL: source not restored (${finalSha} != ${originalSha})`)
    process.exitCode = 1
  }
  writeFileSync(
    REPORT.replace(/\.report\.json$/u, '.json'),
    `${JSON.stringify({
      schema: 'a5sf-archived-gate/row6-mutation-control/1',
      generatedAt: new Date().toISOString(),
      source: 'packages/runtime/src/plugin/live/agent-bindings.mjs',
      originalSourceSha256: originalSha,
      control: controlFailed ? 'FAILED' : 'PASS',
      outcomes,
    }, null, 2)}\n`,
    'utf8',
  )
  rmSync(REPORT, { force: true })
}

if (controlFailed) {
  console.error('\nmutation control FAILED: the two-seam property is not pinned')
  process.exitCode = 1
} else {
  console.log('\nmutation control PASS: removing either seam alone reproduces RED on exactly its legs')
}
