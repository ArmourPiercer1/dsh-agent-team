#!/usr/bin/env node
/**
 * mutation-controls.mjs — each mechanism the PD-13 fix claims is pinned
 * INDEPENDENTLY load-bearing, by removing exactly ONE mechanism from the REAL
 * source and requiring the arms that mechanism protects to go RED while the
 * rest stay GREEN.
 *
 *   MA (the read-axis admission removed): the confined terminal face no longer
 *      enumerates a command's declared reads, so `shellRead` is never consulted.
 *      The lane denial is real and unchanged, but the shell no longer asks: the
 *      denied `cat` returns the secret bytes again. D1 and A1 must FAIL — and
 *      A2 / A3 / S1 / C1..C6 must stay GREEN, which is what makes this the
 *      discriminating control for "the READ AXIS is the fix", not the shadow:
 *      the command still runs through the confined face (A2's write, C6's
 *      dynamic read) and the surface is untouched (S1).
 *
 *   MB (the shadow row removed): the route-C attach appends NEITHER the PD-13
 *      confined-terminal module NOR the PD-12 confined-bash module, i.e. the
 *      exact pre-fix composition. The model-visible `bash` is the preset's
 *      inherited executor again, so the ungoverned path returns: D1 (denied read
 *      returns bytes), D2 (the definition is not the confined terminal module's)
 *      and A1 (no confined spawn, no read fact) FAIL, and every arm that
 *      measures the ROUTE — A2, A3, C6 (`delta.confined === 1`) and C2 (which
 *      needs the PD-12 subprocess shadow) — also FAILS, because the mutant
 *      removes the very wiring those arms observe. S1 (same name set) and
 *      C1 (which removes the shadow itself) stay GREEN. A control that reddened
 *      ONLY the denial arms would mean the shadow's routing is not observable;
 *      the wider RED set is the honest signature of removing it.
 *
 * The mutation is a literal, single-occurrence edit; the original bytes are
 * restored in `finally` and the sha256 of every touched file is compared before
 * and after. A control that fails to produce the expected RED pattern exits
 * non-zero: "no RED" is a failure of the control, never a pass.
 *
 * Usage: node dev/agent-workflow/evidence/a5sf-pd13-fix/mutation-controls.mjs
 */
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..', '..', '..', '..')
const TERMINAL = 'packages/runtime/team-services/src/terminal.ts'
const ROW = 'packages/runtime/src/plugin/live/a5sf-realm-row.mjs'
const ARMS = 'tests/world-factory/a5sf-pd13-terminal-read-axis.test.mjs'
const REPORT = join(HERE, 'mutation-controls.json')
const sha = (text) => createHash('sha256').update(text).digest('hex')

const ALL_ARMS = ['D1', 'D2', 'A1', 'A2', 'A3', 'S1', 'C1', 'C2', 'C3', 'C4', 'C5', 'C6']
const others = (failed) => ALL_ARMS.filter((arm) => !failed.includes(arm))

const MUTANTS = [
  {
    id: 'MA-read-axis-removed',
    description: 'the confined terminal face never enumerates a command\'s declared reads, so the lane is never consulted',
    edits: [
      {
        file: TERMINAL,
        old: '        for (const locator of shellReadIntentsOf(text, session.cwd)) {\n',
        new: '        for (const locator of [] as readonly string[]) { // MUTANT MA: the read axis is removed\n',
      },
    ],
    expectRed: ['D1', 'A1'],
  },
  {
    id: 'MB-shadow-row-removed',
    description: 'the route-C attach appends neither the confined-terminal nor the confined-bash module (the pre-fix composition)',
    edits: [
      {
        file: ROW,
        old: 'function confinedTerminalSpecOf(realm, nativeSpecs, surface) {\n',
        new: 'function confinedTerminalSpecOf(realm, nativeSpecs, surface) { // MUTANT MB\n  return undefined\n',
      },
      {
        file: ROW,
        old: 'function confinedBashSpecOf(realm, nativeSpecs, surface) {\n',
        new: 'function confinedBashSpecOf(realm, nativeSpecs, surface) { // MUTANT MB\n  return undefined\n',
      },
    ],
    expectRed: ['A1', 'A2', 'A3', 'C2', 'C6', 'D1', 'D2'],
  },
]

function runArms() {
  const result = spawnSync(process.execPath, ['--test', ARMS], {
    cwd: ROOT,
    encoding: 'utf8',
    env: { ...process.env, A5SF_PD13_PIN: '0' },
    timeout: 180_000,
  })
  const text = `${result.stdout ?? ''}\n${result.stderr ?? ''}`
  const arms = {}
  for (const line of text.split('\n')) {
    const match = /^([✔✖﹣])\s+(D1|D2|A1|A2|A3|S1|C1|C2|C3|C4|C5|C6)\b/u.exec(line.trim())
    if (match === null) continue
    const [, mark, id] = match
    if (mark === '﹣') continue
    arms[id] = mark === '✔' ? 'pass' : 'fail'
  }
  return { arms, rc: result.status, text }
}

const originals = new Map()
for (const file of [TERMINAL, ROW]) originals.set(file, readFileSync(join(ROOT, file), 'utf8'))

const report = {
  schema: 'a5sf-pd13-mutation-controls/1',
  at: new Date().toISOString(),
  arms: ARMS,
  mutantCount: MUTANTS.length,
  controls: [],
}

let failed = false
try {
  for (const mutant of MUTANTS) {
    // Edits to the SAME file must compound: each starts from the text the
    // previous edit produced, never from the pristine original (a second
    // original-based write would silently undo the first).
    const mutated = new Map()
    for (const edit of mutant.edits) {
      const base = mutated.get(edit.file) ?? originals.get(edit.file)
      const occurrences = base.split(edit.old).length - 1
      if (occurrences !== 1) {
        throw new Error(`mutation ${mutant.id}: expected exactly one occurrence in ${edit.file}, found ${occurrences}`)
      }
      mutated.set(edit.file, base.replace(edit.old, edit.new))
    }
    for (const [file, text] of mutated) writeFileSync(join(ROOT, file), text)
    try {
      const { arms, rc } = runArms()
      const observedRed = ALL_ARMS.filter((arm) => arms[arm] === 'fail')
      const expected = [...mutant.expectRed].sort()
      const matched = JSON.stringify(observedRed.sort()) === JSON.stringify(expected)
      const control = {
        id: mutant.id,
        description: mutant.description,
        expectedRed: expected,
        observedRed,
        expectedGreen: others(mutant.expectRed),
        observedGreen: others(observedRed),
        rc,
        verdict: matched ? 'RED-AS-REQUIRED' : 'CONTROL-FAILED',
      }
      report.controls.push(control)
      if (!matched) failed = true
      console.log(`${control.verdict} ${mutant.id}: red=${JSON.stringify(observedRed)} expected=${JSON.stringify(expected)}`)
    } finally {
      for (const file of [TERMINAL, ROW]) writeFileSync(join(ROOT, file), originals.get(file))
    }
  }
} finally {
  for (const file of [TERMINAL, ROW]) writeFileSync(join(ROOT, file), originals.get(file))
}

for (const [file, original] of originals) {
  const restored = readFileSync(join(ROOT, file), 'utf8')
  if (sha(restored) !== sha(original)) {
    failed = true
    console.error(`RESTORE-FAILED ${file}`)
  }
}

report.verdict = failed ? 'CONTROL-FAILED' : 'PASS'
writeFileSync(REPORT, `${JSON.stringify(report, null, 2)}\n`)
console.log(`control: ${report.verdict} (${report.controls.length}/${MUTANTS.length})`)
process.exit(failed ? 1 : 0)
