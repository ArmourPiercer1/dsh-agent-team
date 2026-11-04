#!/usr/bin/env node
/**
 * go-no-go.mjs — the ONE command that authorises spending the dedicated P2-04
 * start (the single boot this lane is allowed).
 *
 * It does not boot. It checks that the committed host-free evidence still
 * describes THIS tree and that every external precondition is literally true. It
 * REFUSES (exit 1) on any of:
 *
 *   - the committed `dry-run.json` is not green;
 *   - the committed `negative-controls.json` is not green (a net that cannot go
 *     red must not authorise a boot);
 *   - the PRODUCT tree changed since the dry run (the digest ignores
 *     `dev/agent-workflow/evidence/**`, so evidence-only commits do not
 *     invalidate it while a code/test/config change does);
 *   - the product tree has uncommitted modifications;
 *   - the branch is not this lane's branch;
 *   - the ledger is inconsistent with itself (an intent row whose plannedStarts
 *     does not match its boot rows net of declared aborts; a boot row with no
 *     intent; an abort row with no intent) — the invariant is
 *     `bootRows === plannedStarts - aborts`;
 *   - the pool item "P2-04 grep (BL-16)" has no start left, or does not allocate
 *     the 3 starts the ruling granted;
 *   - the pinned host tree is not at the pinned commit or is dirty;
 *   - `lane-ruling.json` does not authorise another start. The ruling file is the
 *     budget: entries are named, they must sum to `authorisedStarts`, and a start
 *     is allowed only while the ledger holds fewer boot rows than that. A third
 *     boot needs a NEW entry, not an edit to the number.
 *   - the HANDOFF does not hold: the rows `--plan` handed to a probe World are
 *     not identical, in order, to the rows in the emitted patch; the health probe
 *     row is absent; or the driver's `handOverRows(world, rows)` call is missing
 *     or sits after `harness.boot(`. This is the check the 2026-11-04 attempt
 *     needed: `--plan` was green because it only judged text, so a gate that
 *     cannot see the handoff must not be able to say GO.
 *
 * The raw HEAD is deliberately NOT compared: a committed dry run is written
 * before the commit that carries it, so it is always one commit behind. The
 * product digest is the value that must match.
 *
 * Run: node dev/agent-workflow/evidence/a5sf-search-live/go-no-go.mjs
 *
 * @module dev/agent-workflow/evidence/a5sf-search-live/go-no-go
 */
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const DRIVER = join(HERE, 'run-boot.mjs')
const REPO_ROOT = join(HERE, '..', '..', '..', '..')
const HOST_TREE = existsSync(join(REPO_ROOT, 'tests', 'deepseek-harness-test-use', 'packages', 'fs', 'tool-fs-search', 'lib', 'index.js'))
  ? join(REPO_ROOT, 'tests', 'deepseek-harness-test-use')
  : join(REPO_ROOT, '..', '..', 'tests', 'deepseek-harness-test-use')
const PIN = (() => {
  try {
    return readFileSync(join(REPO_ROOT, 'tests', 'paths.mjs'), 'utf8').match(/TEST_USE_BASELINE_SHA\s*=\s*'([0-9a-f]+)'/u)?.[1] ?? null
  } catch {
    return null
  }
})()

const results = []
function check(id, ok, detail) {
  results.push({ id, ok: ok === true, detail })
  // eslint-disable-next-line no-console
  console.log(`${ok === true ? 'PASS' : 'REFUSE'} ${id}: ${typeof detail === 'string' ? (detail === '' ? '(clean)' : detail) : JSON.stringify(detail)}`)
}
function git(args, cwd = REPO_ROOT) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8' })
  return { status: r.status, stdout: String(r.stdout ?? '').trim(), stderr: String(r.stderr ?? '').trim() }
}
/** The sum of named ruling entries, or null when the file is unusable. */
function ruleRowsSum(value) {
  if (value === null || !Array.isArray(value.rulings)) return null
  const sum = value.rulings.reduce((total, row) => total + Number(row?.starts ?? 0), 0)
  return Number.isFinite(sum) ? sum : null
}

function productTreeDigest() {
  const r = git(['ls-tree', '-r', 'HEAD', '--', 'packages', 'scripts', 'tests', 'docs/plans', 'docs/contracts', 'dev/engineering', 'package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml'])
  return createHash('sha256').update(r.stdout).digest('hex')
}

const dryRun = existsSync(join(HERE, 'dry-run.json')) ? JSON.parse(readFileSync(join(HERE, 'dry-run.json'), 'utf8')) : null
const planRows = existsSync(join(HERE, 'plan-rows.json')) ? JSON.parse(readFileSync(join(HERE, 'plan-rows.json'), 'utf8')) : null
const ruling = existsSync(join(HERE, 'lane-ruling.json')) ? JSON.parse(readFileSync(join(HERE, 'lane-ruling.json'), 'utf8')) : null
const controls = existsSync(join(HERE, 'negative-controls.json')) ? JSON.parse(readFileSync(join(HERE, 'negative-controls.json'), 'utf8')) : null
const head = git(['rev-parse', 'HEAD']).stdout
const branch = git(['rev-parse', '--abbrev-ref', 'HEAD']).stdout
const digestNow = productTreeDigest()
const productStatus = git(['status', '--porcelain', '--untracked-files=no', '--', ':!dev/agent-workflow/evidence']).stdout
const ledgerPath = join(HERE, 'run-ledger.jsonl')
const poolPath = join(REPO_ROOT, 'dev', 'agent-workflow', 'budgets', 'a5sf-boot-pool-20261103.json')
const pool = existsSync(poolPath) ? JSON.parse(readFileSync(poolPath, 'utf8')) : null
const p204 = (pool?.allocation ?? []).find((item) => String(item?.item ?? '').startsWith('P2-04')) ?? null
const hostHead = existsSync(HOST_TREE) ? git(['rev-parse', 'HEAD'], HOST_TREE).stdout : null
const hostStatus = existsSync(HOST_TREE) ? git(['status', '--porcelain'], HOST_TREE).stdout : null

check('dry-run evidence exists and is green', dryRun !== null && dryRun.goNoGo === true,
  dryRun === null ? 'dry-run.json missing' : { checks: dryRun.checks?.length ?? null, failed: (dryRun.checks ?? []).filter((entry) => entry.ok !== true).length })
check('negative controls exist and are green', controls !== null && controls.allControlsPassed === true,
  controls === null ? 'negative-controls.json missing' : { controls: controls.controls?.length ?? null, failed: (controls.controls ?? []).filter((entry) => entry.ok !== true).length })
// ── CONDITION 1+2 (coordinator ruling, retry): the HANDOFF is this gate's
// business, content-bearing. The dry run checks the driver source; this gate
// checks the artifact `--plan` produced by RUNNING the same handoff function
// against a probe, and independently re-reads the source. A length check would
// have passed the 2026-11-04 attempt; an ordered id identity would not.
const driverSourceForHandoff = existsSync(DRIVER) ? readFileSync(DRIVER, 'utf8') : ''
const handoffCall = 'handOverRows(world, rows)'
const handoffIndex = driverSourceForHandoff.indexOf(handoffCall)
const bootIndex = driverSourceForHandoff.indexOf('harness.boot(')
const sameIds = planRows !== null && Array.isArray(planRows.emittedRowIds) && Array.isArray(planRows.worldRowIds)
  && planRows.emittedRowIds.length === planRows.worldRowIds.length
  && planRows.emittedRowIds.length > 0
  && planRows.emittedRowIds.every((id, index) => id === planRows.worldRowIds[index])
check('handoff: the rows the World composes EQUAL the emitted rows, by identity and in order', planRows !== null && planRows.identityHolds === true && sameIds,
  planRows === null ? 'plan-rows.json missing: run --plan' : { emitted: planRows.emittedRowIds, world: planRows.worldRowIds, identityHolds: planRows.identityHolds })
check('handoff: the p6t6 health-probe row and all four evidence rows are among them', planRows !== null && planRows.healthProbeRowPresent === true && planRows.allFourRowsPresent === true,
  planRows === null ? 'plan-rows.json missing' : { healthProbeRowPresent: planRows.healthProbeRowPresent, allFourRowsPresent: planRows.allFourRowsPresent, world: planRows.worldRowIds })
check('handoff: the driver CALLS the handoff before harness.boot( (independent source read)', handoffIndex !== -1 && bootIndex !== -1 && handoffIndex < bootIndex,
  { handoffIndex, bootIndex, call: handoffCall })
check('handoff: the plan was produced on THIS commit and carries a non-empty patch', planRows !== null && planRows.head === head && Number(planRows.patchBytes) > 0 && String(planRows.patchSha256 ?? '').length === 64,
  planRows === null ? 'plan-rows.json missing' : { planHead: planRows.head, head, patchBytes: planRows.patchBytes, patchSha256: planRows.patchSha256 })
check('the PRODUCT tree matches the one the dry run measured', dryRun !== null && dryRun.productTreeDigest === digestNow,
  { committed: dryRun?.productTreeDigest ?? null, now: digestNow })
check('the product tree has no uncommitted modifications', productStatus === '', productStatus)
// the lane's branch series: task/a5sf-search-live-<date> (round 1) and
// task/a5sf-search-live2-<date> (the 2026-11-05 round on a fresh master base)
check('branch is this lane\'s branch', /^task\/a5sf-search-live2?-\d{8}$/u.test(branch), branch)

// ── the ledger, read as a BUDGET ACCOUNT ───────────────────────────────────
const ledgerRows = existsSync(ledgerPath)
  ? readFileSync(ledgerPath, 'utf8').split('\n').filter((line) => line.trim() !== '').map((line) => {
    try {
      return JSON.parse(line)
    } catch {
      return { unparseable: line.slice(0, 200) }
    }
  })
  : []
const unparseable = ledgerRows.filter((row) => row.unparseable !== undefined)
const intents = ledgerRows.filter((row) => row.kind === 'budget-intent')
const bootRows = ledgerRows.filter((row) => row.kind !== 'budget-intent' && row.kind !== 'budget-abort' && row.phase !== undefined)
const aborts = ledgerRows.filter((row) => row.kind === 'budget-abort')
const runsOf = (rows) => [...new Set(rows.map((row) => String(row.runId ?? '')))]
const intentRuns = runsOf(intents)
const bootRuns = runsOf(bootRows)
const abortRuns = runsOf(aborts)
const orphanBootRuns = bootRuns.filter((runId) => !intentRuns.includes(runId))
const orphanAbortRuns = abortRuns.filter((runId) => !intentRuns.includes(runId))
const plannedMismatch = intentRuns.map((runId) => {
  const planned = intents.filter((row) => String(row.runId ?? '') === runId)
  const spent = bootRows.filter((row) => String(row.runId ?? '') === runId).length
  const aborted = aborts.filter((row) => String(row.runId ?? '') === runId).length
  const declared = planned.reduce((sum, row) => sum + Number(row.plannedStarts ?? 0), 0)
  return { runId, plannedStarts: declared, aborted, bootRows: spent, ok: declared - aborted === spent }
}).filter((entry) => entry.ok !== true)
const bootsSpent = bootRows.length
const remaining = Number(p204?.boots ?? 0) - bootsSpent
const ledger = {
  path: ledgerPath,
  rows: ledgerRows.length,
  intents: intents.length,
  bootRows: bootsSpent,
  aborts: aborts.length,
  unparseable: unparseable.length,
  orphanBootRuns,
  orphanAbortRuns,
  plannedMismatch,
  bootsInPool: Number(p204?.boots ?? 0),
  remaining,
}
check('ledger: every row parses and each boot row has its intent row', unparseable.length === 0 && orphanBootRuns.length === 0, ledger)
check('ledger: an abort row names an existing intent (an abort without an intent is a defect)', orphanAbortRuns.length === 0, { abortRuns })
check('ledger: each intent\'s plannedStarts equals its boot rows, net of declared aborts', plannedMismatch.length === 0, { intents: intentRuns.length, mismatch: plannedMismatch })
check('budget: at least ONE P2-04 start is still available', remaining >= 1, `boots=${String(p204?.boots ?? null)} spent=${String(bootsSpent)} remaining=${String(remaining)}`)
check('boot pool allocates the three P2-04 starts (the ruling)', Number(p204?.boots ?? 0) >= 3, {
  poolFile: 'dev/agent-workflow/budgets/a5sf-boot-pool-20261103.json',
  item: p204?.item ?? null,
  boots: p204?.boots ?? null,
})
const rulingStarts = ruling === null ? null : Number(ruling.authorisedStarts)
const rulingSum = ruleRowsSum(ruling)
check('budget: the lane ruling is well-formed (entries sum to authorisedStarts, each names by + reason)',
  ruling !== null && Number.isFinite(rulingStarts) && rulingStarts >= 1 && rulingSum === rulingStarts
  && Array.isArray(ruling.rulings) && ruling.rulings.length > 0 && ruling.rulings.every((row) => String(row?.by ?? '') !== '' && String(row?.reason ?? '') !== ''),
  ruling === null ? 'lane-ruling.json missing' : { authorisedStarts: rulingStarts, entries: rulingSum, rulings: (ruling.rulings ?? []).map((row) => ({ starts: row.starts, by: row.by })) })
check('budget: this start is authorised by the rulings and is NOT a third', rulingStarts !== null && bootsSpent < rulingStarts && bootsSpent + 1 <= rulingStarts,
  `authorised=${String(rulingStarts)} spent=${String(bootsSpent)} — a further start needs a NEW ruling entry appended to lane-ruling.json, not an edit to authorisedStarts`)
check('pinned host tree is at the pinned commit and clean', hostHead !== null && hostHead === PIN && hostStatus === '', { hostHead, pin: PIN, porcelain: hostStatus })

const report = {
  schema: 'a5sf-search-live/go-no-go/1',
  branch,
  evidenceHeadAtDryRun: dryRun?.head ?? null,
  productTreeDigest: digestNow,
  pinnedHost: PIN,
  pool: { item: p204?.item ?? null, boots: p204?.boots ?? null, consumed: bootsSpent, remaining },
  ruling: ruling === null ? null : { authorisedStarts: rulingStarts, entries: rulingSum, path: join(HERE, 'lane-ruling.json') },
  handoff: planRows === null ? null : { emittedRowIds: planRows.emittedRowIds, worldRowIds: planRows.worldRowIds, identityHolds: planRows.identityHolds, patchSha256: planRows.patchSha256 },
  ledger,
  go: results.every((entry) => entry.ok === true),
  checks: results,
  next: 'node dev/agent-workflow/evidence/a5sf-search-live/run-boot.mjs  (ONE Host, ONE start, port family 3180)',
  structurallyUnverifiableWithoutBoot: dryRun?.structurallyUnverifiable ?? [],
}
writeFileSync(join(HERE, 'go-no-go.json'), JSON.stringify(report, null, 2) + '\n')
writeFileSync(join(HERE, 'go-no-go.log'), results.map((entry) => `${entry.ok ? 'PASS' : 'REFUSE'} ${entry.id}: ${typeof entry.detail === 'string' ? (entry.detail === '' ? '(clean)' : entry.detail) : JSON.stringify(entry.detail)}`).join('\n') + '\n')
// eslint-disable-next-line no-console
console.log(report.go ? `GO — head=${head} digest=${digestNow}` : `NO-GO — ${String(results.filter((entry) => entry.ok !== true).length)} refusal(s); fix them before spending the lane's single boot`)
process.exitCode = report.go ? 0 : 1
