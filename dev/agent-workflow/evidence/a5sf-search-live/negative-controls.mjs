#!/usr/bin/env node
/**
 * negative-controls.mjs — MUTATION-BASED proof that the host-free net is
 * load-bearing.
 *
 * A check that cannot go red is decoration. Every control below BREAKS the
 * property its check asserts, runs the check, requires it to FAIL, restores the
 * original bytes, and verifies the restore by sha256. If a control ever passes
 * its check while the property is broken, this script exits non-zero and the
 * go/no-go gate refuses the boot — which is the point: the boot is the expensive
 * instrument, so the instrument that guards it must itself be falsifiable.
 *
 * CONTROLS
 *   1. oracle: row 2 tolerates a CREATED PROCESS — `noConfinedProcess` forced
 *      true. The suite must go red on the arm that asserts a refusal starts no
 *      process.
 *   2. oracle: row 6 counts a DELTA — `noFactAfterStop` forced true. The suite
 *      must go red on the arm with a fact after the stop instant.
 *   3. oracle: row 4 accepts a SUCCESS as a cancellation — the `settlementIsCancelled`
 *      clause forced true. The suite must go red on the success-result arm.
 *   4. driver: `a5sfExpectedTools` removed — the dry run's declaration check must
 *      go red (the native attach would otherwise silently keep the preset search
 *      on the unconfined service).
 *   5. driver: the cancellation trigger replaced by a test route literal — the
 *      dry run's "SHIPPED route" check must go red.
 *   6. lane: the restriction WIDENED to the ceiling — the row-3 premise
 *      (`restriction denies`) must flip to allow, proving the restriction is what
 *      the intersection acts on and that the dry run's premise check can see it.
 *   7. row 4 window: the packaged `rg` on a REGULAR file does not block — proving
 *      the FIFO premise check is not green for any invocation.
 *
 * Run: node dev/agent-workflow/evidence/a5sf-search-live/negative-controls.mjs
 *
 * @module dev/agent-workflow/evidence/a5sf-search-live/negative-controls
 */
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import {
  existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = join(HERE, '..', '..', '..', '..')
const HOST_TREE = existsSync(join(REPO_ROOT, 'tests', 'deepseek-harness-test-use', 'packages', 'fs', 'tool-fs-search', 'lib', 'index.js'))
  ? join(REPO_ROOT, 'tests', 'deepseek-harness-test-use')
  : join(REPO_ROOT, '..', '..', 'tests', 'deepseek-harness-test-use')
const LIB = join(REPO_ROOT, 'tests', 'world-factory', 'lib', 'a5sf-search-live.mjs')
const TEST = join(REPO_ROOT, 'tests', 'world-factory', 'a5sf-search-live.test.mjs')
const DRIVER = join(HERE, 'run-boot.mjs')
const DRY = join(HERE, 'dry-run.mjs')

const sha = (path) => createHash('sha256').update(readFileSync(path)).digest('hex')
/** The dry-run artifacts the mutated runs OVERWRITE. They are the COMMITTED
 *  evidence of the GREEN run, so they are snapshotted here and restored after
 *  the controls — otherwise the last control's red output would become the
 *  evidence the go/no-go gate reads (measured: it did). */
const PRESERVED = ['dry-run.json', 'dry-run.log', 'plan.log'].map((name) => {
  const path = join(HERE, name)
  return { path, bytes: existsSync(path) ? readFileSync(path) : null }
})
const controls = []
function record(id, ok, detail) {
  controls.push({ id, ok: ok === true, detail })
  // eslint-disable-next-line no-console
  console.log(`${ok === true ? 'CONTROL-PASS' : 'CONTROL-FAIL'} ${id}: ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`)
}
function runNode(args, timeout = 180_000) {
  const r = spawnSync(process.execPath, args, { cwd: REPO_ROOT, encoding: 'utf8', timeout })
  return { status: r.status, stdout: String(r.stdout ?? ''), stderr: String(r.stderr ?? '') }
}

/**
 * Mutate -> run -> require RED -> restore -> verify bytes.
 * `mutation` is a literal replacement; it must actually change the file.
 */
function withMutation({ id, file, from, to, args, wantsRed, checkId = null }) {
  const original = readFileSync(file, 'utf8')
  const before = sha(file)
  if (!original.includes(from)) {
    record(id, false, `the mutation target is absent from ${relative(REPO_ROOT, file)}: the control cannot be applied (the check it guards may have drifted)`)
    return
  }
  const mutated = original.split(from).join(to)
  if (mutated === original) {
    record(id, false, 'the mutation did not change the file')
    return
  }
  try {
    writeFileSync(file, mutated)
    const r = runNode(args)
    const red = wantsRed ? r.status !== 0 : r.status === 0
    const mentions = checkId === null ? true : `${r.stdout}${r.stderr}`.includes(checkId)
    record(id, red && mentions, {
      file: relative(REPO_ROOT, file),
      exit: r.status,
      expected: wantsRed ? 'non-zero (the check must fail on the broken property)' : 'zero',
      checkNamed: mentions,
      tail: `${r.stdout}${r.stderr}`.split('\n').filter((l) => l.trim() !== '').slice(-2).join(' | ').slice(0, 400),
    })
  } finally {
    writeFileSync(file, original)
    const after = sha(file)
    if (after !== before) {
      record(`${id}:restore`, false, `the original bytes were NOT restored: ${before} -> ${after}`)
    }
  }
}

// ── 1-3. the oracle is falsifiable ─────────────────────────────────────────
withMutation({
  id: 'oracle: row 2 must REFUTE a refusal that still created a process',
  file: LIB,
  from: '    noConfinedProcess: spawns.length === 0,',
  to: '    noConfinedProcess: true,',
  args: ['--test', TEST],
  wantsRed: true,
})
withMutation({
  id: 'oracle: row 6 must REFUTE a fact whose observedAt is after the stop',
  file: LIB,
  from: '    noFactAfterStop: afterStop.length === 0,',
  to: '    noFactAfterStop: true,',
  args: ['--test', TEST],
  wantsRed: true,
})
withMutation({
  id: 'oracle: row 4 must REFUTE a SUCCESS result as a cancellation',
  file: LIB,
  from: '    settlementIsCancelled: delivered ? (settledAsError && abortText.test(textOfResult(result))) : childTerminated,',
  to: '    settlementIsCancelled: true,',
  args: ['--test', TEST],
  wantsRed: true,
})
withMutation({
  id: 'oracle: row 3 must REFUTE a widened effective lane',
  file: LIB,
  from: '    noWidenedEffectiveDecision: probe.effectiveRead !== \'allow\',',
  to: '    noWidenedEffectiveDecision: true,',
  args: ['--test', TEST],
  wantsRed: true,
})

// ── 4-5. the driver's static checks are falsifiable ────────────────────────
withMutation({
  id: 'driver: the dry run must notice a MISSING expectedTools declaration',
  file: DRIVER,
  from: '    a5sfExpectedTools: {',
  to: '    a5sfExpectedToolsNotDeclared: {',
  args: [DRY],
  wantsRed: true,
  checkId: 'declares expectedTools for BOTH native modules',
})
withMutation({
  id: 'driver: the dry run must notice a test-composition cancel route',
  file: DRIVER,
  from: '        cancelCall = await apiSessionCancel',
  to: '    const interruptRoute = 1\n    const cancelCall = await apiSessionCancel',
  args: [DRY],
  wantsRed: true,
  checkId: 'the cancellation trigger is the SHIPPED client route',
})

withMutation({
  id: 'driver: the dry run must notice rows that are emitted but NEVER given to the World',
  file: DRIVER,
  from: 'handOverRows(world, rows)',
  to: 'void rows',
  args: [DRY],
  wantsRed: true,
  checkId: 'the composed rows are GIVEN to the World',
})

// ── 6. the restriction is load-bearing in the PRODUCT algebra ──────────────
let laneControl = { ok: false, detail: 'path-rules not importable' }
try {
  const DIST = join(REPO_ROOT, 'packages', 'runtime', 'dist', 'packages', 'runtime')
  const pathRules = await import(pathToFileURL(join(DIST, 'member-io-policy', 'src', 'path-rules.js')).href)
  const lane = (allow) => ({ mode: 'restricted', allow, ask: [], deny: [] })
  const workspace = '/w/ws'
  const inLane = '/w/ws/lane/inside'
  const restricted = '/w/ws/lane/outside-restriction.txt'
  const ceiling = lane([workspace])
  const narrow = pathRules.intersectPathRuleSets(ceiling, lane([inLane]))
  // The CONTROL: widen the restriction to the ceiling. If the row-3 premise
  // still reported "restriction denies", the premise would be insensitive to the
  // very input it claims to measure.
  const widened = pathRules.intersectPathRuleSets(ceiling, lane([workspace]))
  const narrowDenies = pathRules.matchLocator(narrow, restricted) === 'deny'
  const widenedAllows = pathRules.matchLocator(widened, restricted) === 'allow'
  laneControl = {
    ok: narrowDenies && widenedAllows,
    detail: {
      narrowRestriction: pathRules.matchLocator(lane([inLane]), restricted),
      widenedRestriction: pathRules.matchLocator(lane([workspace]), restricted),
      narrowEffective: pathRules.matchLocator(narrow, restricted),
      widenedEffective: pathRules.matchLocator(widened, restricted),
      why: 'the restriction input alone flips the effective answer, so the row-3 premise is measuring the restriction',
    },
  }
} catch (error) {
  laneControl = { ok: false, detail: String(error?.message ?? error) }
}
record('lane: the restriction INPUT flips the row-3 effective answer (the premise is sensitive)', laneControl.ok, laneControl.detail)

// ── 7. the FIFO premise is not green for a non-blocking invocation ─────────
let rgControl = { ok: false, detail: 'packaged rg unavailable' }
try {
  const hostRequire = createRequire(join(HOST_TREE, 'packages', 'fs', 'tool-fs-search', 'lib', 'index.js'))
  const rgPath = (await import(pathToFileURL(hostRequire.resolve('@vscode/ripgrep')).href)).rgPath
  const dir = mkdtempSync(join(tmpdir(), 'a5sf-search-rgctl-'))
  const regular = join(dir, 'regular.txt')
  writeFileSync(regular, 'nothing here\n')
  const r = spawnSync(rgPath, ['--no-config', '--json', '--regexp=zzz', '--', regular], { encoding: 'utf8', timeout: 3000 })
  rgControl = {
    ok: r.error === undefined && r.status === 1,
    detail: { status: r.status ?? null, signal: r.signal ?? null, error: r.error?.code ?? null, why: 'exit 1 (no match) on a regular file: the FIFO check is green only for a BLOCKING operand' },
  }
  rmSync(dir, { recursive: true, force: true })
} catch (error) {
  rgControl = { ok: false, detail: String(error?.message ?? error) }
}
record('row 4 window: a regular file does NOT block (the FIFO premise is specific)', rgControl.ok, rgControl.detail)

for (const entry of PRESERVED) {
  if (entry.bytes === null) continue
  writeFileSync(entry.path, entry.bytes)
}
const report = {
  schema: 'a5sf-search-live/negative-controls/1',
  at: new Date().toISOString(),
  controls,
  allControlsPassed: controls.every((entry) => entry.ok === true),
  note: 'every control restores the original bytes in a finally block and verifies the sha256; a failed restore is itself reported as a CONTROL-FAIL',
}
writeFileSync(join(HERE, 'negative-controls.json'), JSON.stringify(report, null, 2) + '\n')
writeFileSync(join(HERE, 'negative-controls.log'), controls.map((entry) => `${entry.ok ? 'CONTROL-PASS' : 'CONTROL-FAIL'} ${entry.id}: ${typeof entry.detail === 'string' ? entry.detail : JSON.stringify(entry.detail)}`).join('\n') + '\n')
// eslint-disable-next-line no-console
console.log(report.allControlsPassed
  ? `NEGATIVE CONTROLS GREEN — ${String(controls.length)} controls, every guarded check went RED on the broken property and the bytes were restored`
  : `NEGATIVE CONTROLS RED — ${String(controls.filter((c) => c.ok !== true).length)} control(s) failed: ${controls.filter((c) => c.ok !== true).map((c) => c.id).join(', ')}`)
process.exitCode = report.allControlsPassed ? 0 : 1
