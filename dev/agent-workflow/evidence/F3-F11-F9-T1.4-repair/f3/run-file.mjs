#!/usr/bin/env node
/**
 * F3-A evidence runner — per-file plain-node vitest-equivalent runner.
 *
 * `vitest run` cannot start in the spawn-restricted workspace-write
 * sandbox: vite 8's config load calls `windowsSafeRealPathSync`, which
 * exec()s a child process (EPERM — see TEST_METHODS.md §5 and the P1-T5
 * evidence D-05-test-pnpm.log). The repo's `scripts/run-tests.mjs`
 * documents the plain-node fallback (native TS type-stripping + the
 * audited vitest shim + the .js->.ts resolution hooks), but it runs a
 * whole package in ONE process and crashes on a single top-level
 * matcher outside the shim surface (e.g. `toHaveLength` in
 * d5-instance-contract.test.ts), taking the rest of the package down
 * with it.
 *
 * This runner reuses the SAME hooks + shim as scripts/run-tests.mjs, but
 * imports ONE test file per invocation, so each suite's shim-surface
 * incompatibilities (pre-existing; unrelated to F3-A) stay isolated and
 * the focused non-regression suites (p8s3 / p8s5b / p6t5) plus their
 * siblings run to completion.
 *
 * Usage:  node run-file.mjs <test-file> [...]
 * Exit:   0 all named files pass; 1 any failure (assertion or import).
 */
import { register } from 'node:module'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(scriptDir, '..', '..', '..', '..', '..')
const hooksFile = join(repoRoot, 'scripts', 'run-tests-hooks.mjs')
register(pathToFileURL(hooksFile).href, import.meta.url)
const shim = await import(pathToFileURL(join(repoRoot, 'scripts', 'test-vitest-shim.mjs')).href)

const files = process.argv.slice(2).map((f) => resolve(f))
if (files.length === 0) {
  console.error('usage: node run-file.mjs <test-file> [...]')
  process.exit(2)
}

let failed = 0
for (const file of files) {
  shim.__beginFile(relative(repoRoot, file))
  let importError
  try {
    await import(pathToFileURL(file).href)
  } catch (err) {
    importError = err instanceof Error ? (err.stack ?? err.message) : String(err)
  }
  const tests = shim.__collectAndReset()
  const rel = relative(repoRoot, file)
  if (importError !== undefined) {
    failed += 1
    console.log(`FAIL ${rel}`)
    console.log(`     import/evaluation error: ${importError.split('\n')[0]}`)
    continue
  }
  const bad = tests.filter((t) => !t.ok)
  if (bad.length === 0) {
    console.log(`PASS ${rel} (${tests.length} tests)`)
  } else {
    failed += 1
    console.log(`FAIL ${rel} (${bad.length}/${tests.length} tests)`)
    for (const t of bad) {
      console.log(`     ✗ ${t.suite ? t.suite + ' › ' : ''}${t.name}`)
      if (t.error) console.log(`       ${t.error.split('\n').slice(0, 4).join('\n       ')}`)
    }
  }
}
if (failed > 0) process.exit(1)
console.log('run-file: all named files pass')
process.exit(0)
