#!/usr/bin/env node
/**
 * mutation-control.mjs — each NEW boot-seam piece is pinned INDEPENDENTLY
 * load-bearing.
 *
 * The green arms alone cannot prove that both pieces matter (BS1 passes if
 * the sweep closes its window; BS2 passes if the in-memory admission check
 * closes its own). This control removes exactly one piece at a time from the
 * REAL protected glue and requires the arm that piece protects to go RED,
 * while every other arm stays green:
 *
 *   M1 (the post-loop durable SWEEP removed): the sweep's eviction decision is
 *      forced to "no refusal". BS1 (the ARCHIVED commit lands while the boot
 *      resume is in flight) must FAIL — the handle published during the loop
 *      must SURVIVE boot. BS2 and BS3 must PASS (the in-memory admission check
 *      and the enumeration budget are untouched).
 *
 *   M2 (the POST-RESUME IN-MEMORY ADMISSION CHECK removed): the check is
 *      forced to "admission open". BS2 (the resume resolves between the
 *      archive's quiesce and its durable commit) must FAIL — boot then
 *      publishes a resident Agent for a member whose quiesce already released
 *      residency, while the durable row still reads SETTLED, so no durable
 *      read can refuse it. BS1 and BS3 must PASS.
 *
 * The mutation is a literal, single-occurrence edit; the original bytes are
 * restored in `finally` and the sha256 of the touched file is compared before
 * and after. A control that fails to produce the expected RED pattern exits
 * non-zero: "no RED" is a failure of the control, never a pass.
 *
 * Usage: node dev/agent-workflow/evidence/a5sf-boot-seam/mutation-control.mjs
 */
import { createHash } from 'node:crypto'
import { readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..', '..', '..', '..')
const GLUE = 'packages/runtime/src/plugin/live/agent-bindings.mjs'
const ARM_CONFIG = join(HERE, 'boot-seam-vitest.config.mjs')
const REPORT = join(HERE, 'mutation-control.report.json')
const sha = (text) => createHash('sha256').update(text).digest('hex')

const MUTANTS = [
  {
    id: 'M1-post-loop-durable-sweep',
    description: 'remove the post-loop durable sweep (the eviction decision never fires)',
    edits: [
      {
        file: GLUE,
        old: '          const sweptRefusal = memberResumeRefusal(sweptChild, rootSid, afterBoot)\n',
        new: '          const sweptRefusal = null\n',
      },
    ],
    expect: { failed: ['BS1'], passed: ['BS2', 'BS3'] },
  },
  {
    id: 'M2-post-resume-admission-check',
    description: 'remove the post-resume in-memory admission check in the boot loop',
    edits: [
      {
        file: GLUE,
        old: '          const midProcedureRefusal = admissionCloseRefusal(child)\n',
        new: '          const midProcedureRefusal = null\n',
      },
    ],
    expect: { failed: ['BS2'], passed: ['BS1', 'BS3'] },
  },
]

function runArm() {
  rmSync(REPORT, { force: true })
  const proc = spawnSync(
    join(ROOT, 'node_modules', '.bin', 'vitest'),
    ['run', '--config', ARM_CONFIG, '--reporter=json', `--outputFile=${REPORT}`],
    { cwd: ROOT, encoding: 'utf8', timeout: 600_000 },
  )
  let raw = null
  try {
    raw = readFileSync(REPORT, 'utf8')
  } catch {
    throw new Error(`vitest produced no JSON report (rc=${String(proc.status)}):\n${proc.stdout}\n${proc.stderr}`)
  }
  const report = JSON.parse(raw)
  const legs = []
  for (const file of report.testResults ?? []) {
    for (const assertion of file.assertionResults ?? []) {
      legs.push({ title: assertion.title, status: assertion.status })
    }
  }
  return { legs, rc: proc.status }
}

const legOf = (title) => {
  const match = /\b(BS[123])\b/u.exec(title)
  return match === null ? 'UNKNOWN' : match[1]
}

const originals = new Map()
{
  const text = readFileSync(join(ROOT, GLUE), 'utf8')
  originals.set(GLUE, { text, sha: sha(text) })
}
const outcomes = []
let controlFailed = false

try {
  for (const mutant of MUTANTS) {
    const touched = new Set()
    for (const edit of mutant.edits) {
      const base = originals.get(edit.file)
      if (base === undefined) throw new Error(`${mutant.id}: unknown file ${edit.file}`)
      const current = readFileSync(join(ROOT, edit.file), 'utf8')
      if (current.split(edit.old).length - 1 !== 1) {
        throw new Error(`${mutant.id}: the anchor is not unique in ${edit.file}: ${JSON.stringify(edit.old)}`)
      }
      writeFileSync(join(ROOT, edit.file), current.replace(edit.old, edit.new), 'utf8')
      touched.add(edit.file)
    }
    const mutatedShas = Object.fromEntries(
      [...touched].map((file) => [file, sha(readFileSync(join(ROOT, file), 'utf8'))]),
    )
    const { legs, rc } = runArm()
    for (const file of touched) writeFileSync(join(ROOT, file), originals.get(file).text, 'utf8')
    const restored = Object.fromEntries(
      [...touched].map((file) => [file, sha(readFileSync(join(ROOT, file), 'utf8'))]),
    )
    for (const file of touched) {
      if (restored[file] !== originals.get(file).sha) throw new Error(`${mutant.id}: restore FAILED for ${file}`)
    }

    const observed = Object.fromEntries(legs.map((leg) => [legOf(leg.title), leg.status]))
    const wronglyGreen = mutant.expect.failed.filter((leg) => observed[leg] !== 'failed')
    const wronglyRed = mutant.expect.passed.filter((leg) => observed[leg] !== 'passed')
    const ok = wronglyGreen.length === 0 && wronglyRed.length === 0
    if (!ok) controlFailed = true
    outcomes.push({
      mutant: mutant.id,
      description: mutant.description,
      mutatedFileSha256: mutatedShas,
      restoredFileSha256: restored,
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
  for (const [file, base] of originals) {
    writeFileSync(join(ROOT, file), base.text, 'utf8')
    const finalSha = sha(readFileSync(join(ROOT, file), 'utf8'))
    if (finalSha !== base.sha) throw new Error(`finally: restore FAILED for ${file}`)
  }
  rmSync(REPORT, { force: true })
  const summary = {
    control: 'a5sf-boot-seam mutation control',
    sourceSha256: Object.fromEntries([...originals].map(([file, base]) => [file, base.sha])),
    outcomes,
    verdict: controlFailed ? 'CONTROL-FAILED' : 'ALL-MUTANTS-RED-AS-REQUIRED',
  }
  writeFileSync(join(HERE, 'mutation-control.json'), `${JSON.stringify(summary, null, 1)}\n`, 'utf8')
  console.log(`\nrestored ${GLUE} sha256=${sha(readFileSync(join(ROOT, GLUE), 'utf8'))}`)
  console.log(`verdict: ${summary.verdict}`)
}
if (controlFailed) process.exitCode = 1
