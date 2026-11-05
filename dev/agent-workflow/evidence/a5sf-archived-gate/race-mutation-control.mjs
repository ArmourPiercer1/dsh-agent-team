#!/usr/bin/env node
/**
 * race-mutation-control.mjs — each half of the archive-race fix is pinned
 * INDEPENDENTLY load-bearing.
 *
 * A green race arm alone cannot prove that both halves matter (the arm passes
 * if either half closes the window it measures). This control removes exactly
 * one half at a time from the REAL source and requires the arm that half
 * protects to go RED, while every other arm stays green:
 *
 *   M1 (fix a removed): the post-commit residency re-drop in `archive.ts` and
 *      `dispose.ts`. RO4 (a resume completing INSIDE the window) must FAIL —
 *      the handle it let in must survive the commit. RO1/RO2/RO3 must PASS
 *      (the admission close and the post-resume re-read still cover theirs).
 *
 *   M2 (fix b removed): the post-resume durable re-read in
 *      `ensureLiveAgentOnce`. RO3 (a resume resolving AFTER the commit) must
 *      FAIL. RO1/RO2/RO4 must PASS.
 *
 *   M3 (fix c removed): the per-member admission-close consults in
 *      `ensureLiveAgent` / `executeTool`. RO2 (a dispatch issued INSIDE the
 *      drop→commit window) must FAIL, and RO4's racing dispatch must complete
 *      as a tool execution instead of a refusal. RO1/RO3 must PASS.
 *
 * The mutation is a literal, single-occurrence edit; the original bytes are
 * restored in `finally` and the sha256 of EVERY touched file is compared
 * before and after. A control that fails to produce the expected RED pattern
 * exits non-zero: "no RED" is a failure of the control, never a pass.
 *
 * Usage: node dev/agent-workflow/evidence/a5sf-archived-gate/race-mutation-control.mjs
 */
import { createHash } from 'node:crypto'
import { readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..', '..', '..', '..')
const GLUE = 'packages/runtime/src/plugin/live/agent-bindings.mjs'
const ARCHIVE = 'packages/runtime/lifecycle/archive.ts'
const DISPOSE = 'packages/runtime/lifecycle/dispose.ts'
const ARM_CONFIG = join(HERE, 'a5sf-race-vitest.config.mjs')
const REPORT = join(HERE, 'race-mutation-control.report.json')
const sha = (text) => createHash('sha256').update(text).digest('hex')

const MUTANTS = [
  {
    id: 'M1-fix-a-post-commit-re-drop',
    description: 'remove the post-commit residency re-drop (archive.ts + dispose.ts)',
    edits: [
      { file: ARCHIVE, old: '    dropResidencyAfterCommit(ports, member.childSessionId)\n', new: '' },
      { file: DISPOSE, old: '    dropResidencyAfterCommit(ports, member.childSessionId)\n', new: '' },
    ],
    expect: { failed: ['RO4'], passed: ['RO1', 'RO2', 'RO3'] },
  },
  {
    id: 'M2-fix-b-post-resume-re-read',
    description: 'remove the post-resume durable re-read (ensureLiveAgentOnce)',
    edits: [
      { file: GLUE, old: '      const lateRefusal = memberResumeRefusal(sid, teamRoot)\n', new: '      const lateRefusal = null\n' },
    ],
    expect: { failed: ['RO3'], passed: ['RO1', 'RO2', 'RO4'] },
  },
  {
    id: 'M3-fix-c-admission-close-consults',
    description: 'remove the admission-close consults (ensureLiveAgent + executeTool)',
    edits: [
      { file: GLUE, old: '    const admissionRefusal = admissionCloseRefusal(sid)\n', new: '    const admissionRefusal = null\n' },
      { file: GLUE, old: '    const lateAdmissionRefusal = admissionCloseRefusal(String(sessionId))\n', new: '    const lateAdmissionRefusal = null\n' },
    ],
    expect: { failed: ['RO2', 'RO4'], passed: ['RO1', 'RO3'] },
  },
]

function runArm() {
  rmSync(REPORT, { force: true })
  const proc = spawnSync(
    'pnpm',
    ['exec', 'vitest', 'run', '--config', ARM_CONFIG, '--reporter=json', `--outputFile=${REPORT}`],
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
  const match = /\bRO([1-4])\b/u.exec(title)
  return match === null ? 'UNKNOWN' : `RO${match[1]}`
}

const originals = new Map()
for (const file of [GLUE, ARCHIVE, DISPOSE]) {
  const text = readFileSync(join(ROOT, file), 'utf8')
  originals.set(file, { text, sha: sha(text) })
}
const outcomes = []
let controlFailed = false

try {
  for (const mutant of MUTANTS) {
    // Apply every edit of this mutant to the pristine originals.
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
    if (finalSha !== base.sha) {
      console.error(`FATAL: ${file} not restored (${finalSha} != ${base.sha})`)
      process.exitCode = 1
    }
  }
  writeFileSync(
    REPORT.replace(/\.report\.json$/u, '.json'),
    `${JSON.stringify({
      schema: 'a5sf-archived-gate/race-mutation-control/1',
      generatedAt: new Date().toISOString(),
      sources: [...originals.keys()],
      originalSourceSha256: Object.fromEntries([...originals].map(([file, base]) => [file, base.sha])),
      control: controlFailed ? 'FAILED' : 'PASS',
      outcomes,
    }, null, 2)}\n`,
    'utf8',
  )
  rmSync(REPORT, { force: true })
}

if (controlFailed) {
  console.error('\nmutation control FAILED: the race fix halves are not independently load-bearing')
  process.exitCode = 1
} else {
  console.log('\nmutation control PASS: removing (a), (b), or (c) alone reproduces RED on exactly its arms')
}
