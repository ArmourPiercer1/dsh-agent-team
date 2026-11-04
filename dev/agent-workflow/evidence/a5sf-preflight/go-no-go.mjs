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
 *   - a ledger row already exists for this evidence directory (an orphan
 *     pre-registration would mean a boot was already spent);
 *   - the boot pool does not allocate the three dedicated P2-01 starts
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
check('no ledger row exists for this evidence directory (no boot was spent)', !existsSync(ledgerPath), ledgerPath)
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
  pool: { item: p201?.item ?? null, boots: p201?.boots ?? null, allocated: poolOk },
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
