/**
 * suite-seam-probe.mjs — prove the 150-a5sf-read LIVE seam now measures.
 *
 * Before this lane, `resolveReadDriver()` threw `LIVE_SEAM_UNAVAILABLE` and the
 * suite could only run its `node:fs` DRY driver. This probe:
 *   1. resolves the SAME driver spec the suite's `run()` resolves (env
 *      `A5SF_READ_DRIVER` or `--driver`), so a missing/invalid driver still
 *      refuses exactly as the suite does;
 *   2. runs the suite's own 5-call live-seam scene through it
 *      (`runLiveSeamScenario`), which performs the reads through the real
 *      confined native provider;
 *   3. prints the case verdicts and writes the evidence dir.
 *
 * It boots NO Host, spends NO start, writes NO ledger row. What it does not do
 * is stated in its output: the hosted route (cancel/archive/teardown) is not
 * exercised here.
 *
 * Usage:
 *   A5SF_READ_DRIVER=<abs path> node .../suite-seam-probe.mjs [--evidence <dir>]
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(HERE, '..', '..', '..', '..', '..')
const args = process.argv.slice(2)
const at = args.indexOf('--evidence')
const evidenceDir = resolve(at === -1 ? join(REPO_ROOT, '.artifacts', 'a5sf-read', 'live-seam') : args[at + 1])

const suite = await import(pathToFileURL(join(REPO_ROOT, 'tests', 'world-factory', 'suites', '150-a5sf-read.mjs')).href)
const spec = await suite.resolveReadDriver({ driver: args.includes('--driver') ? args[args.indexOf('--driver') + 1] : undefined })
const driver = await spec.createReadDriver({ repoRoot: REPO_ROOT, harness: null, evidenceDir, recorder: null })
mkdirSync(evidenceDir, { recursive: true })
try {
  const result = await suite.runLiveSeamScenario({ repoRoot: REPO_ROOT, evidenceDir, driver })
  const summary = {
    schema: 'a5sf-read-live-seam-probe/1',
    at: new Date().toISOString(),
    driver: { kind: driver.kind, native: driver.native === true, schema: driver.schema ?? null },
    hostStarts: 0,
    assertions: result.assertions.map(({ id, ok, detail }) => ({ id, ok, detail })),
    checked: result.assertions.filter((a) => a.ok).length,
    total: result.assertions.length,
    cases: result.cases,
    diag: result.evidence?.diag ?? null,
    chainVerdict: result.evidence?.chain?.verdict ?? null,
    notMeasured: [
      'a hosted route (cancel/archive/teardown): no Host is booted by this probe',
      'read_image composition through a BINDING realm (GAP-FS-CONTRACT-1: the isolated ctx does not settle the module\'s deferred fs inject)',
      'effect attribution to a live host pid (the oracle needs a Host)',
    ],
  }
  writeFileSync(join(evidenceDir, 'live-seam-summary.json'), `${JSON.stringify(summary, null, 2)}\n`)
  process.stdout.write(`A5SF-READ-LIVE-SEAM driver=${driver.kind} native=${String(driver.native === true)} hostStarts=0\n`)
  for (const a of summary.assertions) process.stdout.write(`${a.ok ? 'PASS' : 'FAIL'} ${a.id}\n`)
  for (const row of summary.cases) process.stdout.write(`CASE ${row.verdict} ${row.caseId} reason=${row.reason}\n`)
  process.stdout.write(`A5SF-READ-LIVE-SEAM assertions=${summary.checked}/${summary.total} cases=${summary.cases.filter((c) => c.verdict === 'PASS').length}PASS/${summary.cases.filter((c) => c.verdict === 'NOT_REACHED').length}NOT_REACHED/${summary.cases.filter((c) => c.verdict === 'FAIL').length}FAIL\n`)
  if (summary.checked !== summary.total) process.exitCode = 1
} finally {
  if (typeof driver.dispose === 'function') await driver.dispose()
}
