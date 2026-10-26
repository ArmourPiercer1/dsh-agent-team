#!/usr/bin/env node
/**
 * eb3-security-run.mjs — the ci-security layer's runner.
 *
 * Runs the suites listed in `tests/checks/eb3-security-suites.txt` with a raised
 * test clock and emits the layer's own verdict token for the Required summary to
 * grade:
 *
 *   EB3-LAYER layer=ci-security verdict=PASS|FAIL|ENV_BLOCK|REFUSED|SKIP suites=<n> passed=<n> failed=<n>
 *
 * WHY A RAISED CLOCK, AND WHY IT IS PRINTED. One suite here (`a5mcp-native-trust-
 * filter`, the first dynamic `import()` of the shipped glue) takes 5.0–7.8 s to
 * LOAD on a loaded box against vitest's default 5000 ms testTimeout — measured in
 * this worktree: the assertion never failed, the clock ran out during import. The
 * census gate already carries exactly this override for exactly this reason
 * (`--census-test-timeout`), and runs it with the value printed on the leg line so a
 * pass states the clock it passed under. This runner does the same: the budget is on
 * the token. It is not a tolerance for red assertions — `--testTimeout` cannot
 * excuse one; it only moves the clock.
 *
 * WHY IT IS A SCRIPT AND NOT A WORKFLOW ONE-LINER. The verdict must be a TOKEN. A
 * `run: pnpm exec vitest run …` step that exits 0 has said nothing about which
 * suites ran; a step that exits non-zero leaves the summary nothing to classify
 * beyond "failure". A layer that could not run its suites (no node_modules, no
 * vitest binary) is ENV_BLOCK, and ENV_BLOCK is a disclosure the summary treats as
 * NOT green — never a pass.
 *
 *   node scripts/eb3-security-run.mjs [--layer <ci-…>] [--list-file <path>] [--timeout <ms>] [--json]
 *
 * Exit: 0 PASS | 1 FAIL | 3 ENV_BLOCK | 4 REFUSED (bad config, empty suite list).
 */
import { existsSync, readFileSync, mkdtempSync, rmSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..')
const DEFAULT_LIST = 'tests/checks/eb3-security-suites.txt'
const DEFAULT_TIMEOUT = 20000

const argv = process.argv.slice(2)
const arg = (n) => { const i = argv.indexOf(n); return i > -1 ? argv[i + 1] : null }
const listFile = arg('--list-file') ?? DEFAULT_LIST
const timeout = Number(arg('--timeout') ?? DEFAULT_TIMEOUT)
const json = argv.includes('--json')
// The layer NAME on the token. ci-full runs this same runner over the host-provisioned
// list; a token that said ci-security there would misattribute the result.
const layerName = arg('--layer') ?? 'ci-security'
if (!/^ci-[a-z]+$/.test(layerName)) {
  console.log(`EB3-LAYER layer=unknown verdict=REFUSED reason=bad --layer ${JSON.stringify(layerName)}`)
  process.exit(4)
}

function emit(verdict, detail, exit) {
  if (json) console.log(JSON.stringify({ layer: layerName, verdict, ...detail }, null, 2))
  else console.log(`EB3-LAYER layer=${layerName} verdict=${verdict} ${Object.entries(detail).map(([k, v]) => `${k}=${v}`).join(' ')}`)
  process.exit(exit)
}

const listPath = join(ROOT, listFile)
if (!existsSync(listPath)) emit('REFUSED', { reason: `suite list absent: ${listFile}` }, 4)
const suites = readFileSync(listPath, 'utf8').split('\n').map((l) => l.trim()).filter((l) => l !== '' && !l.startsWith('#'))
if (suites.length === 0) emit('REFUSED', { reason: `suite list is empty: ${listFile}`, suites: 0 }, 4)
const missing = suites.filter((s) => !existsSync(join(ROOT, s)))
if (missing.length > 0) {
  // A listed suite that no longer exists is a REFUSAL, not a smaller run: the list is
  // the coverage claim, and silently grading a shorter list is how coverage is lost.
  emit('REFUSED', { reason: `listed suite(s) absent: ${missing.join(',')}`, suites: suites.length }, 4)
}
if (!Number.isFinite(timeout) || timeout < 1000) emit('REFUSED', { reason: `bad --timeout ${String(timeout)}` }, 4)

const scratch = mkdtempSync(join(tmpdir(), 'eb3-security-'))
const report = join(scratch, 'vitest.json')
try {
  const vitest = spawnSync(process.execPath, [
    join(ROOT, 'node_modules/vitest/vitest.mjs'), 'run',
    ...suites,
    `--testTimeout=${String(timeout)}`,
    '--reporter=json', `--outputFile.json=${report}`,
  ], { cwd: ROOT, encoding: 'utf8', maxBuffer: 128 * 1024 * 1024 })

  if (vitest.error !== null && vitest.error !== undefined) {
    emit('ENV_BLOCK', { reason: `could not spawn vitest (${String(vitest.error.message ?? vitest.error)})`, suites: suites.length }, 3)
  }
  if (!existsSync(report)) {
    // No report = nothing was graded. Exit 0 with no report is the worst case and it
    // is NOT a pass: the suites may not have run at all.
    const why = (vitest.stderr ?? '').split('\n').filter((l) => l.trim() !== '').slice(-3).join(' | ')
    emit(vitest.status === 0 ? 'REFUSED' : 'ENV_BLOCK', { reason: `vitest wrote no JSON report (exit ${String(vitest.status)}): ${why}`, suites: suites.length }, vitest.status === 0 ? 4 : 3)
  }
  const r = JSON.parse(readFileSync(report, 'utf8'))
  const passed = r.numPassedTests ?? 0
  const failed = r.numFailedTests ?? 0
  // `files` is the number of TEST FILES vitest reported, and it must equal the listed
  // suite count: a listed file vitest never reported was not run. The first version used
  // numTotalTestSuites, which counts DESCRIBE BLOCKS (83 for 20 files) — a figure that
  // looked like coverage and measured nothing. `describes` keeps that number, named.
  const fileCount = Array.isArray(r.testResults) ? r.testResults.length : 0
  const body = { suites: suites.length, files: String(fileCount), describes: String(r.numTotalTestSuites ?? 0), passed: String(passed), failed: String(failed), clock_ms: String(timeout) }
  if (fileCount !== suites.length) {
    emit('REFUSED', { ...body, reason: `vitest reported ${String(fileCount)} test file(s) for ${String(suites.length)} listed — a listed suite that never reported did not run` }, 4)
  }
  if (failed > 0) {
    const names = []
    for (const f of r.testResults ?? []) {
      for (const a of f.assertionResults ?? []) {
        if (a.status !== 'passed') names.push(`${String(f.name).split('/').pop()} :: ${String(a.fullName).slice(0, 90)}`)
      }
    }
    emit('FAIL', { ...body, red: names.slice(0, 6).join(' ;; ') || 'unnamed' }, 1)
  }
  if (passed === 0) emit('REFUSED', { ...body, reason: 'zero tests passed — an empty run is not a green run' }, 4)
  emit('PASS', body, 0)
} finally {
  rmSync(scratch, { recursive: true, force: true })
}
