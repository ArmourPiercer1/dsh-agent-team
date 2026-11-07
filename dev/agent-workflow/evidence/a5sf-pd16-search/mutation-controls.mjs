#!/usr/bin/env node
/**
 * mutation-controls.mjs — each mechanism the PD-16 fix claims is pinned
 * INDEPENDENTLY load-bearing, by removing exactly ONE mechanism from the REAL
 * source and requiring the arms that mechanism protects to go RED while the
 * rest stay GREEN.
 *
 *   MA (the search shadow removed): the route-C attach appends no PD-16 search
 *      module, i.e. the exact pre-fix composition. `grep`/`glob` are the
 *      preset's host definitions again and execute on the INHERITED
 *      `subprocess` service, so the ungoverned path returns:
 *        - D1/D2/D3 FAIL — the out-of-lane roots are searched instead of being
 *          refused (the deny arms are exactly the leak this fix closes);
 *        - A1/A5 FAIL — the confined face is never called, the inherited
 *          service is;
 *        - A3/A4 FAIL — no allow fact carries the ignore-discovery disclosure
 *          (there is no confined admission to annotate);
 *        - S1 FAILS — grep/glob are the preset definitions, not shadowed ones.
 *      A2 (exit-code fidelity) and C1 (which removes the shadow itself) stay
 *      GREEN, and their staying green is what makes MA a clean control: the
 *      reds are the ROUTING, not a broken world.
 *
 *   MC (the BL-16 containment correction reverted): `ancestorsStayInLane` ends at
 *      ANY in-lane `.git` again, i.e. the pre-PD-16 heuristic. The world A6 is
 *      the measured live-boot shape (workspace `.git` without HEAD, a worktree
 *      `.git` FILE above the lane), so the flags are not added, rg opens the
 *      denied pointer file, and the in-lane search dies with exit 2:
 *        - A6 FAILS — the search that must answer does not;
 *      every deny arm and every other allow arm stays GREEN (they do not have
 *      that composition), which is what isolates this correction.
 *
 *   MB (the read-axis decision removed): the confined face still enumerates
 *      each invocation's declared roots and still records a fact for every
 *      root, but the lane's decision no longer refuses. The lane is unchanged
 *      and the OS profile is unchanged, so the search now DIES at the kernel
 *      (rg exit 2) instead of being refused at admission:
 *        - D1/D2/D3 FAIL — no typed refusal, one confined provider call, and a
 *          fact that says `allow` where the arm requires `deny`.
 *      Everything else stays GREEN, which is the point: the read-axis JUDGEMENT
 *      is what the deny arms pin, not the shadow, the argv or the surface.
 *
 * The mutation is a literal, single-occurrence edit; the original bytes are
 * restored in `finally` and the sha256 of every touched file is compared before
 * and after. A control that fails to produce the expected RED pattern exits
 * non-zero: "no RED" is a failure of the control, never a pass.
 *
 * Usage: node dev/agent-workflow/evidence/a5sf-pd16-search/mutation-controls.mjs
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
const ARMS = 'tests/world-factory/a5sf-pd16-search-read-axis.test.mjs'
const REPORT = join(HERE, 'mutation-controls.json')
const sha = (text) => createHash('sha256').update(text).digest('hex')

const ALL_ARMS = ['P0', 'D1', 'D2', 'D3', 'A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'S1', 'C1']
const others = (failed) => ALL_ARMS.filter((arm) => !failed.includes(arm))

const MUTANTS = [
  {
    id: 'MA-search-shadow-removed',
    description: 'the route-C attach appends no PD-16 search module — the pre-fix composition (grep/glob on the inherited subprocess service)',
    edits: [
      {
        file: ROW,
        old: '  const searchSpec = confinedSearchSpecOf(realm, nativeSpecs, before)\n',
        new: '  const searchSpec = undefined // MUTANT MA: the search shadow is removed\n',
      },
    ],
    expectRed: ['D1', 'D2', 'D3', 'A1', 'A3', 'A4', 'A5', 'A6', 'S1'],
  },
  {
    id: 'MC-bl16-containment-reverted',
    description: 'the pre-PD-16 containment heuristic: the ancestor walk ends at any in-lane `.git`, so a worktree pointer file above the lane is never seen',
    edits: [
      {
        file: SUBPROCESS,
        old: "      if (deps.isDirectory(git) && !deps.exists(join(git, 'HEAD'))) {\n        // Not a repository root (no HEAD): rg keeps walking above it, so this\n        // directory decides nothing about containment.\n      } else {\n        return await worktreePointerAboveStaysInLane(dir, readLane, resolver, deps)\n      }\n",
        new: "      return gitDecision.decision === 'allow' // MUTANT MC: pre-PD-16 early return\n",
      },
    ],
    expectRed: ['A6'],
  },
  {
    id: 'MB-read-axis-decision-removed',
    description: 'the confined face still enumerates declared roots and records facts, but the read lane no longer refuses',
    edits: [
      {
        file: SUBPROCESS,
        old: '    if (decision.decision !== \'allow\') {\n      throw new TeamIoDenial(\n        decision.decision === \'deny\'\n          ? \'IO_READ_DENIED\'',
        new: '    if (decision.decision === \'allow\' && false) { // MUTANT MB: the read axis no longer decides\n      throw new TeamIoDenial(\n        decision.decision === \'deny\'\n          ? \'IO_READ_DENIED\'',
      },
    ],
    expectRed: ['D1', 'D2', 'D3'],
  },
]

function runArms() {
  const result = spawnSync(process.execPath, ['--test', '--test-reporter=spec', ARMS], {
    cwd: ROOT,
    encoding: 'utf8',
    env: { ...process.env, A5SF_PD16_PIN: '0' },
    timeout: 600_000,
  })
  const text = `${result.stdout ?? ''}\n${result.stderr ?? ''}`
  const arms = {}
  for (const line of text.split('\n')) {
    const match = /^([✔✖﹣])\s+(P0|D1|D2|D3|A1|A2|A3|A4|A5|A6|S1|C1)\b/u.exec(line.trim())
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
  schema: 'a5sf-pd16-mutation-controls/1',
  at: new Date().toISOString(),
  arms: ARMS,
  mutantCount: MUTANTS.length,
  controls: [],
}

let failed = false
try {
  const baseline = runArms()
  report.baseline = { rc: baseline.rc, arms: baseline.arms }
  const baseFailed = ALL_ARMS.filter((arm) => baseline.arms[arm] === 'fail')
  if (baseFailed.length > 0) {
    report.baselineUnexpectedRed = baseFailed
    failed = true
  }

  for (const mutant of MUTANTS) {
    // Edits to the SAME file must compound: each starts from the text the
    // previous edit produced, never from the pristine original.
    const working = new Map(originals)
    for (const edit of mutant.edits) {
      const current = working.get(edit.file)
      const count = current.split(edit.old).length - 1
      if (count !== 1) {
        throw new Error(`${mutant.id}: the edit target occurs ${String(count)} time(s) in ${edit.file} (expected exactly 1) — the mutant is not a single-occurrence edit`)
      }
      working.set(edit.file, current.replace(edit.old, edit.new))
    }
    for (const [file, text] of working) writeFileSync(join(ROOT, file), text)
    let measured
    try {
      measured = runArms()
    } finally {
      for (const [file, text] of originals) writeFileSync(join(ROOT, file), text)
    }
    const red = ALL_ARMS.filter((arm) => measured.arms[arm] === 'fail')
    const expectRed = [...mutant.expectRed].sort()
    const actualRed = [...red].sort()
    const matches = JSON.stringify(expectRed) === JSON.stringify(actualRed)
    if (!matches) failed = true
    report.controls.push({
      id: mutant.id,
      description: mutant.description,
      edits: mutant.edits.map((edit) => ({ file: edit.file, old: edit.old, new: edit.new })),
      expectRed,
      red,
      green: others(red),
      expectedRedSetHolds: matches,
      rc: measured.rc,
      arms: measured.arms,
    })
    process.stdout.write(`${mutant.id}: red=${JSON.stringify(red)} ${matches ? 'OK' : `MISMATCH (expected ${JSON.stringify(expectRed)})`}\n`)
  }
} finally {
  for (const [file, text] of originals) {
    const restored = readFileSync(join(ROOT, file), 'utf8')
    if (sha(restored) !== sha(text)) {
      writeFileSync(join(ROOT, file), text)
      throw new Error(`restore failed for ${file}; bytes rewritten from the in-memory original`)
    }
  }
}

report.overall = failed ? 'FAIL' : 'PASS'
writeFileSync(REPORT, `${JSON.stringify(report, null, 2)}\n`)
process.stdout.write(`mutation-controls: ${report.overall} (${String(report.controls.length)} mutant(s)); report ${REPORT}\n`)
process.exitCode = failed ? 1 : 0
