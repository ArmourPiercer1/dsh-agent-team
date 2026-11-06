#!/usr/bin/env node
/**
 * mutation-controls.mjs — each mechanism the PD-12 fix claims is pinned
 * INDEPENDENTLY load-bearing, by removing exactly ONE mechanism from the REAL
 * source and requiring the arms that mechanism protects to go RED while the
 * rest stay GREEN.
 *
 *   MA (the shadow row removed): `attachA5sfNativeToolModules` never appends the
 *      confined-`bash` spec. The deny lane's `bash` runs on the preset executor
 *      again, so D1 / A1 / A2 / C4 must FAIL. S1 / C1 / C2 must stay GREEN
 *      (they do not depend on the row): C1 already removes the shadow itself,
 *      C2 has no confined face, S1 only compares names.
 *
 *   MB (the confined face's network admission removed): the `network: deny`
 *      probe branch in `team-services/src/subprocess.ts` is skipped. The shadow
 *      still routes `bash` onto the face, but the deny is no longer consulted,
 *      so ONLY D1 must FAIL; A1 / A2 (allow axis) and the controls stay GREEN.
 *      That is the discriminating pair for "the refusal is the network term".
 *
 * The mutation is a literal, single-occurrence edit; the original bytes are
 * restored in `finally` and the sha256 of every touched file is compared before
 * and after. A control that fails to produce the expected RED pattern exits
 * non-zero: "no RED" is a failure of the control, never a pass.
 *
 * Usage: node dev/agent-workflow/evidence/a5sf-pd12-fix/mutation-controls.mjs
 */
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..', '..', '..', '..')
const ROW = 'packages/runtime/src/plugin/live/a5sf-realm-row.mjs'
const SUBPROCESS = 'packages/runtime/team-services/src/subprocess.ts'
const ARMS = 'tests/world-factory/a5sf-pd12-bash-governance.test.mjs'
const REPORT = join(HERE, 'mutation-controls.json')
const sha = (text) => createHash('sha256').update(text).digest('hex')

const ALL_ARMS = ['P0', 'D1', 'A1', 'A2', 'S1', 'C1', 'C2', 'C4']
const others = (failed) => ALL_ARMS.filter((arm) => !failed.includes(arm))

const MUTANTS = [
  {
    id: 'MA-shadow-row-removed',
    description: 'the route-C attach never appends the confined-`bash` module (the pre-fix composition)',
    edits: [
      {
        file: ROW,
        old: '  const bashSpec = confinedBashSpecOf(realm, nativeSpecs, before)\n',
        new: '  const bashSpec = undefined // MUTANT MA: the PD-12 shadow row is removed\n',
      },
    ],
    expectRed: ['D1', 'A1', 'A2', 'C4'],
  },
  {
    id: 'MB-network-admission-removed',
    description: 'the confined face never consults the provider capability probe for a network=deny lane',
    edits: [
      {
        file: SUBPROCESS,
        old: '        if (networkDenied) {\n          const capability = await probeNetworkDenial(provider)\n',
        new: '        if (false && networkDenied) { // MUTANT MB: the network admission is removed\n          const capability = await probeNetworkDenial(provider)\n',
      },
    ],
    expectRed: ['D1'],
  },
]

function runArms() {
  const result = spawnSync(process.execPath, ['--test', ARMS], {
    cwd: ROOT,
    encoding: 'utf8',
    env: { ...process.env, A5SF_PD12_PIN: '0' },
    timeout: 180_000,
  })
  const text = `${result.stdout ?? ''}\n${result.stderr ?? ''}`
  const arms = {}
  for (const line of text.split('\n')) {
    const match = /^([✔✖﹣])\s+(P0|D1|A1|A2|S1|C1|C2|C4)\b/u.exec(line.trim())
    if (match === null) continue
    const [, mark, id] = match
    if (mark === '﹣') continue
    arms[id] = mark === '✔' ? 'pass' : 'fail'
  }
  return { arms, rc: result.status, text }
}

const originals = new Map()
for (const file of [ROW, SUBPROCESS]) originals.set(file, readFileSync(join(ROOT, file), 'utf8'))

const report = {
  schema: 'a5sf-pd12-mutation-controls/1',
  at: new Date().toISOString(),
  arms: ARMS,
  mutantCount: MUTANTS.length,
  controls: [],
}

let failed = false
try {
  for (const mutant of MUTANTS) {
    for (const edit of mutant.edits) {
      const original = originals.get(edit.file)
      const occurrences = original.split(edit.old).length - 1
      if (occurrences !== 1) {
        throw new Error(`mutation ${mutant.id}: expected exactly one occurrence in ${edit.file}, found ${occurrences}`)
      }
      writeFileSync(join(ROOT, edit.file), original.replace(edit.old, edit.new))
    }
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
      for (const file of [ROW, SUBPROCESS]) writeFileSync(join(ROOT, file), originals.get(file))
    }
  }
} finally {
  for (const file of [ROW, SUBPROCESS]) writeFileSync(join(ROOT, file), originals.get(file))
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
