#!/usr/bin/env node
/**
 * run-tests — sandbox-portable plain-node runner for the skeleton's vitest
 * test files (package.json script `test:node`).
 *
 * Why this exists: `vitest run` cannot start in the spawn-restricted P1-T5
 * sandbox — vite 8's windowsSafeRealPathSync execFile()s a child process
 * during config loading, which the sandbox denies (EPERM errno -4048;
 * full trace: evidence/P1-T5/D-05-test-pnpm.log). This runner executes the
 * identical .test.ts sources under plain Node with:
 *
 *   - node's native TS type-stripping (node >= 23.6, no flag; the skeleton
 *     tests use only erasable TS syntax),
 *   - scripts/run-tests-hooks.mjs resolution hooks ('vitest' -> shim;
 *     .js -> .ts sibling for TS-style relative specifiers),
 *   - scripts/test-vitest-shim.mjs (the audited matcher surface: toBe,
 *     toEqual, toBeGreaterThan, toThrow, each with .not).
 *
 * No child processes are spawned anywhere in this chain (the hook worker
 * created by module.register is an in-process worker thread, not a spawned
 * child), so it runs where vitest cannot.
 *
 * Usage: node scripts/run-tests.mjs            (all packages)
 *        node scripts/run-tests.mjs <pkg>...   (subset, e.g. runtime client)
 * Exit: 0 all tests pass; 1 any failure; 2 no test files found.
 */
import { readdirSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import process from 'node:process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { register } from 'node:module'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')

register('./run-tests-hooks.mjs', import.meta.url)
const shim = await import('./test-vitest-shim.mjs')

const wanted = process.argv.slice(2)
const pkgDirs = readdirSync(join(root, 'packages'), { withFileTypes: true })
  .filter((e) => e.isDirectory())
  .map((e) => e.name)
  .filter((name) => wanted.length === 0 || wanted.includes(name))
  .sort()

const files = []
for (const pkg of pkgDirs) {
  const testDir = join(root, 'packages', pkg, 'test')
  let entries
  try {
    entries = readdirSync(testDir)
  } catch {
    continue
  }
  for (const entry of entries.filter((f) => f.endsWith('.test.ts')).sort()) {
    files.push(join(testDir, entry))
  }
}

if (files.length === 0) {
  console.error(`run-tests: no .test.ts files found for: ${pkgDirs.join(', ') || '(none)'}`)
  process.exit(2)
}

const startedAt = Date.now()
let totalPass = 0
let totalFail = 0

for (const file of files) {
  shim.__beginFile(relative(root, file))
  let importError
  try {
    await import(pathToFileURL(file).href)
  } catch (err) {
    importError = err instanceof Error ? (err.stack ?? err.message) : String(err)
  }
  const tests = shim.__collectAndReset()
  if (importError !== undefined) {
    totalFail += 1
    console.log(`FAIL ${relative(root, file)}`)
    console.log(`     import/evaluation error: ${importError.split('\n')[0]}`)
    continue
  }
  const failed = tests.filter((t) => !t.ok)
  const rel = relative(root, file)
  if (failed.length === 0) {
    totalPass += tests.length
    console.log(`PASS ${rel} (${tests.length} tests)`)
  } else {
    totalPass += tests.length - failed.length
    totalFail += failed.length
    console.log(`FAIL ${rel} (${failed.length}/${tests.length} tests)`)
    for (const t of failed) {
      console.log(`     ✗ ${t.suite ? t.suite + ' › ' : ''}${t.name}`)
      if (t.error) console.log(`       ${t.error.split('\n').slice(0, 4).join('\n       ')}`)
    }
  }
}

const elapsedMs = Date.now() - startedAt
const total = totalPass + totalFail
console.log('')
console.log(`run-tests (plain-node vitest-equivalent): ${totalPass} passed, ${totalFail} failed, ${total} total, ${elapsedMs} ms`)
if (totalFail > 0) {
  process.exit(1)
}
console.log('RESULT: PASS run-tests (0 failures)')
process.exit(0)
