#!/usr/bin/env node
/**
 * mutation-controls.mjs — each mechanism BL-42 claims is pinned INDEPENDENTLY
 * load-bearing, by removing exactly ONE mechanism from the REAL source and
 * requiring the arms that mechanism protects to go RED while the rest stay
 * GREEN.
 *
 *   MA (the mechanism application removed): the launcher's `enter_netns()`
 *      returns before it unshares, so the child stays in the host network
 *      namespace. The provider's net leg cannot confirm a deny, so the probe
 *      falls back to `unsupported` and the deny lane is refused at admission
 *      again. A1 / A2 / A3 / A5 must FAIL; P0 (the negative control: a launcher
 *      that cannot apply the mechanism MUST refuse) and A2b / A6 must stay
 *      GREEN — the pin does not depend on the mechanism existing.
 *
 *   MB (the probe honesty removed): `probeNetworkDenial` hard-codes
 *      `level: 'enforced'` for a network row, i.e. it reports the INTENT
 *      instead of the measurement. A2b (a bare `enforced` level is still
 *      `unsupported`) and P0 (a mechanism-less backend still refuses) must go
 *      RED while A1 / A2 / A3 / A5 / A6 stay GREEN: the real mechanism really
 *      does work, so only the HONESTY arm notices the lie.
 *
 * The mutation is a literal, single-occurrence edit; the original bytes are
 * restored in `finally` and the sha256 of every touched file is compared before
 * and after. A control that fails to produce the expected RED pattern exits
 * non-zero: "no RED" is a failure of the control, never a pass.
 *
 * Usage: node dev/agent-workflow/evidence/a5sf-bl42-netdeny/mutation-controls.mjs
 */
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..', '..', '..', '..')
const LAUNCHER = 'packages/runtime/sandbox-provider/launcher/landlock-prelauncher.py'
const PROBE = 'packages/runtime/team-services/src/subprocess.ts'
const ARMS = 'tests/world-factory/a5sf-bl42-netdeny.test.mjs'
const REPORT = join(HERE, 'mutation-controls.json')
const sha = (text) => createHash('sha256').update(text).digest('hex')

const ALL_ARMS = ['A1', 'A2', 'A2b', 'A3', 'P0', 'A5', 'A6']
const others = (failed) => ALL_ARMS.filter((arm) => !failed.includes(arm))

const MUTANTS = [
  {
    id: 'MA-mechanism-not-applied',
    description: 'the launcher never enters the network namespace (the pre-BL-42 behaviour)',
    edits: [
      {
        file: LAUNCHER,
        // The anchor includes the closing docstring line: `host_ino =
        // net_ns_inode_of()` also appears in the net-leg server, and the edit
        // must be unique by construction, not by luck.
        old: '    """\n    host_ino = net_ns_inode_of()\n',
        new: '    """\n    return {"applied": False, "reason": "MUTANT MA: the mechanism is not applied"}  # BL-42 control\n    host_ino = net_ns_inode_of()\n',
      },
    ],
    expectRed: ['A1', 'A2', 'A3', 'A5'],
  },
  {
    id: 'MB-probe-honesty-removed',
    description: 'the shared probe HARD-CODES `enforced` for the network dimension instead of reading the backend\'s own level (the intent reported as the measurement)',
    edits: [
      {
        file: PROBE,
        old: "  if (row.level === 'enforced') {\n",
        new: "  if (false) { // MUTANT MB: the mechanism/evidence guard is removed\n",
      },
      {
        file: PROBE,
        old: "    level: row.level === 'enforced' ? 'enforced' as const : 'unsupported' as const,\n",
        new: "    level: 'enforced' as const, // MUTANT MB: the level is hard-coded, not read\n",
      },
    ],
    expectRed: ['A2b', 'P0'],
  },
]

function runArms() {
  const result = spawnSync(process.execPath, ['--test', ARMS], {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 600_000,
  })
  const text = `${result.stdout ?? ''}\n${result.stderr ?? ''}`
  const arms = {}
  for (const line of text.split('\n')) {
    const marked = /^([✔✖])\s+(A1|A2b|A2|A3|P0|A5|A6)-/.exec(line.trim())
    if (marked === null) continue
    const [, glyph, arm] = marked
    if (glyph === '✖') arms[arm] = 'RED'
    else if (arms[arm] !== 'RED') arms[arm] = 'GREEN'
  }
  return { arms, rc: result.status }
}

const before = new Map()
for (const mutant of MUTANTS) for (const edit of mutant.edits) before.set(edit.file, readFileSync(join(ROOT, edit.file), 'utf8'))

/** Assert every arm the baseline run reported GREEN exists and is being observed. */
const baseline = runArms()
const missing = ALL_ARMS.filter((arm) => baseline.arms[arm] === undefined)
if (missing.length > 0) {
  process.stderr.write(`mutation-controls: baseline run did not report ${missing.join(', ')} — the arm ids or the reporter changed\n`)
  process.exit(2)
}
const baselineRed = ALL_ARMS.filter((arm) => baseline.arms[arm] === 'RED')
if (baselineRed.length > 0) {
  process.stderr.write(`mutation-controls: baseline run is already RED at ${baselineRed.join(', ')} — fix the suite before mutating\n`)
  process.exit(2)
}

const controls = []
for (const mutant of MUTANTS) {
  const hashes = []
  try {
    for (const edit of mutant.edits) {
      const path = join(ROOT, edit.file)
      const source = readFileSync(path, 'utf8')
      const occurrences = source.split(edit.old).length - 1
      if (occurrences !== 1) throw new Error(`mutation ${mutant.id}: expected 1 occurrence in ${edit.file}, found ${occurrences}`)
      const mutated = source.replace(edit.old, edit.new)
      writeFileSync(path, mutated, 'utf8')
      hashes.push({ file: edit.file, mutated: sha(mutated) })
    }
    const run = runArms()
    const observedRed = ALL_ARMS.filter((arm) => run.arms[arm] === 'RED')
    const observedGreen = others(observedRed)
    const redOk = mutant.expectRed.every((arm) => observedRed.includes(arm))
    const greenOk = others(mutant.expectRed).every((arm) => observedGreen.includes(arm))
    controls.push({
      id: mutant.id,
      description: mutant.description,
      expectedRed: mutant.expectRed,
      observedRed,
      expectedGreen: others(mutant.expectRed),
      observedGreen,
      rc: run.rc,
      verdict: redOk && greenOk ? 'RED-AS-REQUIRED' : 'MISMATCH',
    })
  } finally {
    for (const edit of mutant.edits) writeFileSync(join(ROOT, edit.file), before.get(edit.file), 'utf8')
    for (const entry of hashes) {
      const restored = sha(readFileSync(join(ROOT, entry.file), 'utf8'))
      if (restored !== sha(before.get(entry.file))) {
        process.stderr.write(`mutation-controls: FAILED to restore ${entry.file} byte-identically\n`)
        process.exit(2)
      }
    }
  }
}

const verdict = controls.every((control) => control.verdict === 'RED-AS-REQUIRED') ? 'PASS' : 'FAIL'
const report = {
  schema: 'a5sf-bl42-mutation-controls/1',
  at: new Date().toISOString(),
  arms: ARMS,
  mutantCount: MUTANTS.length,
  baseline: { arms: baseline.arms, rc: baseline.rc },
  controls,
  verdict,
}
writeFileSync(REPORT, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
process.stdout.write(`${JSON.stringify({ verdict, controls: controls.map((control) => ({ id: control.id, verdict: control.verdict, observedRed: control.observedRed })) }, null, 2)}\n`)
process.exit(verdict === 'PASS' ? 0 : 1)
