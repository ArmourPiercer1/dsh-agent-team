// Generate a tinf-timing.tsv through the REAL recorder API from SYNTHETIC vitest reports.
//
// Why synthetic: this checkout has no pristine host and no installed node_modules, so a real
// `vitest run` cannot be executed here (the census leg would refuse before spawning anyway, see
// ci-pr-gate.mjs's missing-test-use-checkout preflight). The reports below have the exact shape
// vitest 4.1.11 writes (verified by running the reporter once in the main checkout: each
// testResults[] entry carries name/startTime/endTime/status), and every row is produced by
// createTimer/rowsFromVitestReport — the same code the gate path uses — so the TSV is a real
// harness product of a synthetic measurement, not a hand-written fixture.
//
// TWO attempts x THREE roots (the minimum the M3 brief asks the summarizer to be exercised on).
import { rmSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { createTimer, rowsFromVitestReport } from '../../../../scripts/tinf-timing.mjs'

const dir = resolve(process.argv[2] ?? '.artifacts/tmp/tinf-m3-demo')
// Only the file this script owns is removed: passing the evidence directory must never delete
// the evidence around it (measured the hard way — the first draft rm -rf'd its own directory).
rmSync(join(dir, 'tinf-timing.tsv'), { force: true })
const timer = createTimer({
  dir,
  runId: 'demo-synthetic-2x3',
  identity: { product_merge_tree: '384ae0a40f37a75da636569b65efe5631bef8b5a', host_commit: '639ed015397290b3745d163aafe02ffee4aa3f84' },
})
const t0 = Date.parse('2026-11-14T19:00:00.000Z')
// attempt 1: three roots running concurrently inside one vitest process, with different starts
const attempt1 = {
  testResults: [
    { name: '/repo/packages/domain/test/a.test.ts', startTime: t0 + 1000, endTime: t0 + 91000, status: 'passed' },
    { name: '/repo/packages/domain/test/b.test.ts', startTime: t0 + 2000, endTime: t0 + 88000, status: 'passed' },
    { name: '/repo/packages/runtime/test/c.test.ts', startTime: t0 + 1500, endTime: t0 + 251000, status: 'passed' },
    { name: '/repo/packages/storage/test/d.test.ts', startTime: t0 + 500, endTime: t0 + 61000, status: 'passed' },
  ],
}
// attempt 2: same roots, warmer — shorter windows (still one vitest process)
const attempt2 = {
  testResults: [
    { name: '/repo/packages/domain/test/a.test.ts', startTime: t0 + 400000, endTime: t0 + 460000, status: 'passed' },
    { name: '/repo/packages/domain/test/b.test.ts', startTime: t0 + 400100, endTime: t0 + 459000, status: 'passed' },
    { name: '/repo/packages/runtime/test/c.test.ts', startTime: t0 + 400200, endTime: t0 + 520000, status: 'passed' },
    { name: '/repo/packages/storage/test/d.test.ts', startTime: t0 + 400300, endTime: t0 + 430000, status: 'passed' },
  ],
}
for (const [i, report] of [attempt1, attempt2].entries()) {
  const attempt = i + 1
  const captureMs = Math.max(...report.testResults.map((r) => r.endTime)) - Math.min(...report.testResults.map((r) => r.startTime))
  // A capture row the way the gate wraps the vitest spawn: started_at from the report's own start,
  // duration = the measured capture wall clock.
  timer.record({
    phase: 'census-capture',
    root: 'nine-roots',
    attempt,
    startedAt: new Date(Math.min(...report.testResults.map((r) => r.startTime))).toISOString(),
    durationMs: captureMs,
    status: 'ok',
  })
  for (const row of rowsFromVitestReport(report, { attempt })) {
    timer.record({ phase: 'census-root', root: row.root, attempt, startedAt: row.startedAt, durationMs: row.durationMs, status: row.status })
  }
}
const flushed = timer.flush()
console.log(JSON.stringify({ path: flushed.path, rows: flushed.rows, warnings: flushed.warnings }, null, 2))
