#!/usr/bin/env node
/**
 * T14-H evidence driver — full runtime package sweep, ONE NODE PROCESS
 * PER TEST FILE.
 *
 * Why: `d5-instance-contract.test.ts` throws a top-level (module-scope)
 * `toHaveLength` outside the audited shim surface; that crash kills any
 * shared test process mid-run (taking the remaining files down with it —
 * F3-C's full-sweep.ps1 runs one process per file for exactly this
 * reason). This driver spawns the SAME per-file runner (run-file.mjs)
 * once per suite, in a fresh process, and continues past each crash.
 *
 * Sandbox note: children run with stdio INHERIT (piped-stdio spawns EPERM
 * under the Windows confined sandbox); output streams straight through to
 * the caller's stdout, so the pwsh wrapper redirects it to the evidence
 * file. The driver continues regardless of child exit status.
 *
 * Usage:  node sweep-driver.mjs
 * Exit:   always 0 (the per-file PASS/FAIL lines in the output are the
 *         data; a final tally line is emitted for the record).
 */
import { spawnSync } from 'node:child_process'
import { readdirSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(scriptDir, '..', '..', '..', '..', '..')
const runner = join(scriptDir, 'run-file.mjs')
const testDir = join(repoRoot, 'packages', 'runtime', 'test')

const files = readdirSync(testDir)
  .filter((f) => f.endsWith('.test.ts'))
  .sort()
  .map((f) => join(testDir, f))

let ok = 0
const bad = []
for (const f of files) {
  // The child's PASS/FAIL line streams through this process's stdout
  // (inherited), which the pwsh wrapper redirects into the evidence file.
  const r = spawnSync(process.execPath, [runner, f], {
    cwd: repoRoot,
    stdio: 'inherit',
  })
  if (r.status === 0) {
    ok += 1
  } else {
    bad.push(relative(repoRoot, f))
  }
}
console.log('')
console.log(`SUMMARY: files=${files.length} ok=${ok} bad=${bad.length}`)
console.log(`BAD: ${bad.join(', ')}`)
