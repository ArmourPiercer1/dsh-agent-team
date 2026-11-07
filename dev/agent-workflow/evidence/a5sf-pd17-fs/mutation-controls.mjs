#!/usr/bin/env node
/**
 * mutation-controls.mjs — each mechanism the PD-17 fix claims is pinned
 * INDEPENDENTLY load-bearing, by removing exactly ONE mechanism from the REAL
 * source and requiring the arms that mechanism protects to go RED while the
 * rest stay GREEN.
 *
 *   MA (the FS shadow removed): the route-C attach appends no PD-17 filesystem
 *      module, i.e. the exact pre-fix composition. `read`/`write`/`edit`/
 *      `read_image` are the PRESET's host definitions again and execute on the
 *      INHERITED base provider, so the ungoverned path returns:
 *        - D1/D2/D5 FAIL — a sibling Member's lane bytes and /etc/hostname are
 *          returned, and the out-of-lane image reaches the attachment store;
 *        - D3/D4 FAIL — the out-of-lane file is written/rewritten;
 *        - A1/A2 FAIL — no `allow` fact is recorded (there is no confined
 *          admission to consult the lane);
 *        - A4 FAILS — the write⇒read contract lives in the confined provider,
 *          which is not on the path;
 *        - S1 FAILS — the four definitions are the preset's, unchanged;
 *        - D6/C1 FAIL — no shadow to narrow or dispose.
 *      A3 (in-lane edit) and A5 (in-lane image) stay GREEN: the ungoverned path
 *      is FUNCTIONAL, which is exactly why the hole was invisible in product
 *      use. Their staying green is what makes MA a clean control: the reds are
 *      the ROUTING, not a broken world.
 *
 *   MB (the read-axis decision removed): the confined provider still evaluates
 *      the locator and still records one fact per call, but the READ branch no
 *      longer refuses (the WRITE branch is untouched). Then:
 *        - D1/D2/D5 FAIL — the read executes and the bytes come back while the
 *          arm requires a typed refusal and zero bytes;
 *        - D6/C1 FAIL — both ALSO assert a read refusal (D6 the sibling read
 *          after the deny lane, C1 the mounted refusal before the disposal), so
 *          they are red for the same reason, not for an unrelated mechanism;
 *        - every write arm (D3/D4), the write⇒read arm (A4), the surface arm
 *          (S1) and every allow arm stay GREEN.
 *      That isolates the read-axis JUDGEMENT (the half `fs-sandbox` has no
 *      carrier for) from the shadow, the schemas and the write path.
 *
 *   MD (the configured-owner detection removed): the row no longer skips the
 *      shadow when the composition already places a filesystem-face module.
 *      S2's composition declares ownership ONLY through the module's own
 *      `inject: ['fs']` (no name match, no `expectedTools`), so removing the
 *      detection is what re-introduces the second registration. Then a
 *      composition that OWNS the face gets a SECOND registration of the same
 *      names in the same scope, which Cordis refuses (duplicate `tool:read`
 *      prompt section) — the route-C suite's own composition shape, measured
 *      by S2. S2 is the only arm that supplies a configured owner, so it is the
 *      only red; that isolates the ownership branch from the routing itself.
 *
 *   MC (the visible-subset narrowing removed): the module places all four
 *      shipped names regardless of the surface. With `write` denied by the
 *      capability lane, the shadow re-registers it → the attach's surface gate
 *      refuses (and had it not, the denied lane would be re-enabled):
 *        - D6 FAILS;
 *        - every other arm stays GREEN, because a Member that denies nothing
 *          sees the same four names either way.
 *      That isolates the narrowing from the routing itself.
 *
 * The mutation is a literal, single-occurrence edit; the original bytes are
 * restored in `finally` and the sha256 of every touched file is compared before
 * and after. A control that fails to produce the expected RED pattern exits
 * non-zero: "no RED" is a failure of the control, never a pass.
 *
 * Usage: node dev/agent-workflow/evidence/a5sf-pd17-fs/mutation-controls.mjs
 */
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..', '..', '..', '..')
const ROW = 'packages/runtime/src/plugin/live/a5sf-realm-row.mjs'
const GUARD = 'packages/runtime/team-services/src/fs.ts'
const MODULE = 'packages/runtime/src/plugin/live/confined-fs-tool.mjs'
const ARMS = 'tests/world-factory/a5sf-pd17-fs-read-axis.test.mjs'
const REPORT = join(HERE, 'mutation-controls.json')
const sha = (text) => createHash('sha256').update(text).digest('hex')

const ALL_ARMS = ['P0', 'D1', 'D2', 'D3', 'D4', 'D5', 'A1', 'A2', 'A3', 'A4', 'A5', 'S1', 'S2', 'D6', 'C1']
const others = (failed) => ALL_ARMS.filter((arm) => !failed.includes(arm))

const MUTANTS = [
  {
    id: 'MA-fs-shadow-removed',
    description: 'the route-C attach appends no PD-17 filesystem module — the pre-fix composition (the four tools on the inherited base provider)',
    edits: [
      {
        file: ROW,
        old: '  const fsSpec = confinedFsSpecOf(realm, nativeSpecs, before, configuredModules)\n',
        new: '  const fsSpec = undefined // MUTANT MA: the filesystem shadow is removed\n',
      },
    ],
    expectRed: ['D1', 'D2', 'D3', 'D4', 'D5', 'A1', 'A2', 'A4', 'S1', 'D6', 'C1'],
  },
  {
    id: 'MB-read-axis-decision-removed',
    description: 'the confined provider still evaluates the locator and records a fact, but the READ branch no longer refuses (the write branch is untouched)',
    edits: [
      {
        file: GUARD,
        old: "    if (decision.decision !== 'allow') {\n      throw new TeamIoDenial(",
        new: "    if (decision.decision !== 'allow' && write) { // MUTANT MB: the read axis no longer decides\n      throw new TeamIoDenial(",
      },
    ],
    expectRed: ['D1', 'D2', 'D5', 'D6', 'C1'],
  },
  {
    id: 'MD-fs-owner-detection-removed',
    description: 'the row no longer recognises a configured filesystem-face module (the inject/name/expectedTools ownership check is removed), so it appends a SECOND registration of the same names beside a composition that owns them',
    edits: [
      {
        file: ROW,
        old: "  for (const entry of configuredModules) {\n    const moduleName = entry?.module?.name\n    if (moduleName === 'tool-fs' || moduleName === 'a5sf-confined-fs') return undefined",
        new: "  for (const entry of []) {\n    const moduleName = entry?.module?.name\n    if (moduleName === 'tool-fs' || moduleName === 'a5sf-confined-fs') return undefined",
      },
    ],
    expectRed: ['S2'],
  },
  {
    id: 'MC-visible-subset-narrowing-removed',
    description: 'the module places all four shipped names regardless of the visible surface',
    edits: [
      {
        file: MODULE,
        old: "  const configured = config?.tools\n  if (configured === undefined || configured === null) return A5SF_CONFINED_FS_TOOLS\n",
        new: "  const configured = config?.tools\n  return A5SF_CONFINED_FS_TOOLS // MUTANT MC: the visible-subset narrowing is removed\n  // eslint-disable-next-line no-unreachable\n  if (configured === undefined || configured === null) return A5SF_CONFINED_FS_TOOLS\n",
      },
    ],
    expectRed: ['D6'],
  },
]

function runArms() {
  const result = spawnSync(process.execPath, ['--test', '--test-reporter=spec', ARMS], {
    cwd: ROOT,
    encoding: 'utf8',
    env: { ...process.env, A5SF_PD17_PIN: '0' },
    timeout: 900_000,
  })
  const text = `${result.stdout ?? ''}\n${result.stderr ?? ''}`
  const arms = {}
  for (const line of text.split('\n')) {
    const match = /^([✔✖﹣])\s+(P0|D1|D2|D3|D4|D5|A1|A2|A3|A4|A5|S1|S2|D6|C1)\b/u.exec(line.trim())
    if (match === null) continue
    const [, mark, id] = match
    if (mark === '﹣') continue
    arms[id] = mark === '✔' ? 'pass' : 'fail'
  }
  return { status: result.status, arms, text }
}

const recorded = []
let controlFailure = false

for (const mutant of MUTANTS) {
  const originals = new Map()
  const before = new Map()
  for (const edit of mutant.edits) {
    const path = join(ROOT, edit.file)
    if (!originals.has(path)) {
      const original = readFileSync(path, 'utf8')
      originals.set(path, original)
      before.set(path, sha(original))
    }
  }
  const entry = { id: mutant.id, description: mutant.description, edits: mutant.edits.map((edit) => ({ file: edit.file })), expectedRed: mutant.expectRed }
  try {
    for (const edit of mutant.edits) {
      const path = join(ROOT, edit.file)
      const current = readFileSync(path, 'utf8')
      const occurrences = current.split(edit.old).length - 1
      if (occurrences !== 1) throw new Error(`mutant ${mutant.id}: the anchor must occur exactly once in ${edit.file} (found ${occurrences})`)
      writeFileSync(path, current.replace(edit.old, edit.new), 'utf8')
    }
    const run = runArms()
    entry.arms = run.arms
    entry.observedRed = ALL_ARMS.filter((arm) => run.arms[arm] === 'fail')
    entry.observedGreen = ALL_ARMS.filter((arm) => run.arms[arm] === 'pass')
    entry.missingGreen = run.arms.P0 === undefined ? ['P0-skipped'] : []
    entry.expectedRedMissing = mutant.expectRed.filter((arm) => run.arms[arm] !== 'fail')
    entry.unexpectedRed = others(mutant.expectRed).filter((arm) => run.arms[arm] === 'fail')
    entry.patternHolds = entry.expectedRedMissing.length === 0 && entry.unexpectedRed.length === 0
    if (!entry.patternHolds) controlFailure = true
    entry.exitStatus = run.status
  } finally {
    for (const [path, original] of originals) {
      writeFileSync(path, original, 'utf8')
      const after = sha(readFileSync(path, 'utf8'))
      if (after !== before.get(path)) throw new Error(`mutant ${mutant.id}: ${path} was NOT restored byte-for-byte`)
    }
  }
  recorded.push(entry)
  process.stdout.write(`${entry.patternHolds ? 'OK ' : 'BAD'} ${entry.id}: red=${JSON.stringify(entry.observedRed)}`
    + `${entry.expectedRedMissing.length > 0 ? ` missing=${JSON.stringify(entry.expectedRedMissing)}` : ''}`
    + `${entry.unexpectedRed.length > 0 ? ` unexpected=${JSON.stringify(entry.unexpectedRed)}` : ''}\n`)
}

writeFileSync(REPORT, `${JSON.stringify({ schema: 'a5sf-pd17-mutation-controls/1', suite: ARMS, controls: recorded }, null, 2)}\n`, 'utf8')
process.stdout.write(`wrote ${REPORT}\n`)
if (controlFailure) process.exit(1)
