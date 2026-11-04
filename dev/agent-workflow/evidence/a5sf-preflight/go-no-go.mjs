#!/usr/bin/env node
/**
 * go-no-go.mjs — the ONE command that authorises spending the first of the three
 * dedicated P2-01 boots.
 *
 * It does not re-run the World. It checks that the committed preflight evidence
 * still describes THIS tree, and that every external precondition the human
 * checklist names is literally true. It REFUSES (exit 1) on any of:
 *
 *   - the committed `dry-run.json` is not green;
 *   - the PRODUCT tree changed since that dry run (the digest below ignores
 *     `dev/agent-workflow/evidence/**`, so evidence-only commits do not
 *     invalidate it, while a code/test/config change does);
 *   - the product tree has uncommitted modifications;
 *   - the branch is not the preflight branch;
 *   - the LEDGER IS INCONSISTENT with itself (an intent row whose
 *     `plannedStarts` does not match the boot rows of its `runId`, or a boot row
 *     with no intent) — this replaces the old "no ledger row may exist", which
 *     became a false refusal the moment the first live run legitimately spent
 *     its one start, and which would have kept refusing forever;
 *   - the pool has no START LEFT for this run (`boots - bootRows < 1`), i.e. the
 *     remaining budget is not enough for the run this checklist authorises;
 *   - the boot pool does not allocate the six P2-01 starts
 *     (this is the amendment fact: `boots >= 6`, review B5);
 *   - the pinned host tree is not the pinned commit or is dirty.
 *
 * The raw HEAD is deliberately NOT compared: a committed dry run is written
 * before the commit that carries it, so it is always one commit behind. The
 * product digest is the value that must match, and `dry-run.json.head` is kept
 * for the reader.
 *
 * Run: node dev/agent-workflow/evidence/a5sf-preflight/go-no-go.mjs
 *
 * @module dev/agent-workflow/evidence/a5sf-preflight/go-no-go
 */
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = join(HERE, '..', '..', '..', '..')
const HOST_TREE = existsSync(join(REPO_ROOT, 'tests', 'deepseek-harness-test-use'))
  ? join(REPO_ROOT, 'tests', 'deepseek-harness-test-use')
  : join(REPO_ROOT, '..', '..', 'tests', 'deepseek-harness-test-use')
const PIN = (() => {
  try { return readFileSync(join(REPO_ROOT, 'tests', 'paths.mjs'), 'utf8').match(/TEST_USE_BASELINE_SHA\s*=\s*'([0-9a-f]+)'/)?.[1] ?? null } catch { return null }
})()

let report_ledger = null
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
function productTreeDigest() {
  const r = git(['ls-tree', '-r', 'HEAD', '--', 'packages', 'scripts', 'tests', 'docs/plans', 'docs/contracts', 'dev/engineering', 'package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml'])
  return createHash('sha256').update(r.stdout).digest('hex')
}

const dryRun = existsSync(join(HERE, 'dry-run.json')) ? JSON.parse(readFileSync(join(HERE, 'dry-run.json'), 'utf8')) : null
const head = git(['rev-parse', 'HEAD']).stdout
const branch = git(['rev-parse', '--abbrev-ref', 'HEAD']).stdout
const digestNow = productTreeDigest()
const productStatus = git(['status', '--porcelain', '--untracked-files=no', '--', ':!dev/agent-workflow/evidence']).stdout
const ledgerPath = join(HERE, 'ledger.jsonl')
const poolPath = join(REPO_ROOT, 'dev', 'agent-workflow', 'budgets', 'a5sf-boot-pool-20261103.json')
const pool = existsSync(poolPath) ? JSON.parse(readFileSync(poolPath, 'utf8')) : null
const p201 = (pool?.allocation ?? []).find((item) => String(item?.item ?? '').startsWith('P2-01')) ?? null
const poolOk = Number(p201?.boots ?? 0) >= 6
const hostHead = existsSync(HOST_TREE) ? git(['rev-parse', 'HEAD'], HOST_TREE).stdout : null
const hostStatus = existsSync(HOST_TREE) ? git(['status', '--porcelain'], HOST_TREE).stdout : null

check('dry-run evidence exists and is green', dryRun !== null && dryRun.goNoGo === true, dryRun === null ? 'dry-run.json missing' : { checks: dryRun.checks?.length ?? null, failed: (dryRun.checks ?? []).filter((entry) => entry.ok !== true).length })
check('the PRODUCT tree matches the one the dry run measured', dryRun !== null && dryRun.productTreeDigest === digestNow, { committed: dryRun?.productTreeDigest ?? null, now: digestNow })
check('the product tree has no uncommitted modifications', productStatus === '', productStatus)
check('branch is the preflight branch', /^task\/a5sf-preflight-/.test(branch), branch)
// ── the ledger, read as a BUDGET ACCOUNT (replaces "no row may exist") ──────
// The first live run (07:28Z) spent exactly one start and left one intent row +
// one boot row, which is the HEALTHY post-run state. The old clause asserted the
// PRE-run state and therefore could only ever pass before a boot — after the run
// it refused forever, which is how a gate turns into a blocker.
const ledgerRows = existsSync(ledgerPath)
  ? readFileSync(ledgerPath, 'utf8').split('\n').filter((line) => line.trim() !== '').map((line) => {
    try { return JSON.parse(line) } catch { return { unparseable: line.slice(0, 200) } }
  })
  : []
const unparseableRows = ledgerRows.filter((row) => row.unparseable !== undefined)
const intents = ledgerRows.filter((row) => row.kind === 'budget-intent')
// A boot row is a START. Abort rows are bookkeeping and must never be counted as spend.
const bootRows = ledgerRows.filter((row) => row.kind !== 'budget-intent' && row.kind !== 'budget-abort' && row.phase !== undefined)
const runsOf = (rows) => [...new Set(rows.map((row) => String(row.runId ?? '')))]
const intentRuns = runsOf(intents)
const bootRuns = runsOf(bootRows)
const orphanBootRuns = bootRuns.filter((runId) => !intentRuns.includes(runId))
// A run that aborted BEFORE reaching the Host leaves an intent row and no boot row, by design: the
// pre-registration is the whole point of the gate. Such a run is reconciled by an explicit
// `budget-abort` row (never by deleting the intent), so the invariant is
//   bootRows === plannedStarts - aborts
// and an abort row that names no intent is itself a defect.
const abortRows = ledgerRows.filter((row) => row.kind === 'budget-abort')
const abortsOf = (runId) => abortRows.filter((row) => String(row.runId ?? '') === runId).length
const abortRuns = runsOf(abortRows)
const orphanAbortRuns = abortRuns.filter((runId) => !intentRuns.includes(runId))
const plannedMismatch = intentRuns.map((runId) => {
  const planned = intents.filter((row) => String(row.runId ?? '') === runId)
  const spent = bootRows.filter((row) => String(row.runId ?? '') === runId).length
  const aborted = abortsOf(runId)
  const declared = planned.reduce((sum, row) => sum + Number(row.plannedStarts ?? 0), 0)
  return { runId, plannedStarts: declared, aborted, bootRows: spent, ok: declared - aborted === spent }
}).filter((entry) => entry.ok !== true)
const bootsSpent = bootRows.length
const remaining = Number(p201?.boots ?? 0) - bootsSpent
report_ledger = {
  path: ledgerPath,
  rows: ledgerRows.length,
  intents: intents.length,
  bootRows: bootsSpent,
  unparseable: unparseableRows.length,
  orphanBootRuns,
  plannedMismatch,
  aborts: abortRows.length,
  orphanAbortRuns,
  bootsInPool: Number(p201?.boots ?? 0),
  remaining,
}
check('ledger: every row parses and each boot row has its intent row', unparseableRows.length === 0 && orphanBootRuns.length === 0,
  report_ledger)
check('ledger: an abort row names an existing intent (an abort without an intent is a defect)', orphanAbortRuns.length === 0, { abortRuns })
check('ledger: each intent\'s plannedStarts equals the boot rows charged to it, net of declared aborts', plannedMismatch.length === 0,
  { intents: intentRuns.length, mismatch: plannedMismatch })
check('budget: at least ONE start of the P2-01 pool is still available', remaining >= 1,
  `boots=${String(p201?.boots ?? null)} spent=${String(bootsSpent)} remaining=${String(remaining)}`)
check('boot pool allocates the three dedicated P2-01 starts (boots >= 6, the amendment)', poolOk === true, {
  poolFile: 'dev/agent-workflow/budgets/a5sf-boot-pool-20261103.json',
  item: p201?.item ?? null,
  boots: p201?.boots ?? null,
  why: poolOk ? 'amended allocation present' : 'the pool amendment is not on this HEAD — merge master forward and re-run; do NOT spend a boot on the un-amended three-boot allocation',
})
check('pinned host tree is at the pinned commit and clean', hostHead !== null && hostHead === PIN && hostStatus === '', { hostHead, pin: PIN, porcelain: hostStatus })

const report = {
  schema: 'a5sf-acceptance-preflight/go-no-go/1',
  branch,
  // `head` is a RUNTIME fact printed to stdout, deliberately not persisted:
  // a committed file cannot contain the hash of the commit that contains it.
  // The binding identity is `productTreeDigest`, which is stable across
  // evidence-only commits and is what item 2 compares.
  evidenceHeadAtDryRun: dryRun?.head ?? null,
  productTreeDigest: digestNow,
  pinnedHost: PIN,
  pool: { item: p201?.item ?? null, boots: p201?.boots ?? null, allocated: poolOk, consumed: report_ledger?.bootRows ?? null, remaining: report_ledger?.remaining ?? null },
  ledger: report_ledger,
  go: results.every((entry) => entry.ok === true),
  checks: results,
  next: 'node dev/agent-workflow/evidence/a5sf-preflight/run-boot.mjs  (ONE Host, ONE ledger row, port family 3180)',
  structurallyUnverifiableWithoutBoot: dryRun?.structurallyUnverifiable ?? [],
}
writeFileSync(join(HERE, 'go-no-go.json'), JSON.stringify(report, null, 2) + '\n')
writeFileSync(join(HERE, 'go-no-go.log'), results.map((entry) => `${entry.ok ? 'PASS' : 'REFUSE'} ${entry.id}: ${typeof entry.detail === 'string' ? (entry.detail === '' ? '(clean)' : entry.detail) : JSON.stringify(entry.detail)}`).join('\n') + '\n')
// eslint-disable-next-line no-console
console.log(report.go ? `GO — head=${head} digest=${digestNow}` : `NO-GO — ${results.filter((entry) => entry.ok !== true).length} refusal(s); fix them before spending boot 1 of 3`)
process.exitCode = report.go ? 0 : 1
