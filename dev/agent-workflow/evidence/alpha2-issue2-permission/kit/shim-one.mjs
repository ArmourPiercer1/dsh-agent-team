#!/usr/bin/env node
/**
 * shim-one — run ONE .test.ts file under the same plain-node vitest shim the
 * repo's `test:node` gate uses (scripts/run-tests.mjs), without executing the
 * whole package suite.
 *
 * Why this exists: the package-wide shim run dies at a PRE-EXISTING
 * module-level matcher incompatibility in d5-instance-contract.test.ts
 * (toHaveLength at module scope, outside any it()) before reaching files
 * later in alphabetical order (issue2-*). This driver executes the SAME
 * shim mechanics (run-tests-hooks.mjs resolution + test-vitest-shim.mjs)
 * against a single file so the new issue2 tests are verified under the
 * sandbox-portable runner without touching any file outside this PR's
 * ownership fence.
 *
 * Usage: node kit/shim-one.mjs <relative-or-absolute test file>
 * Exit: 0 all tests pass; 1 any failure or import error.
 */
import process from 'node:process'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { register } from 'node:module'

// kit -> alpha2-issue2-permission -> evidence -> agent-workflow -> dev -> repo root
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', '..')
const scripts = join(repoRoot, 'scripts')

register(pathToFileURL(join(scripts, 'run-tests-hooks.mjs')).href, pathToFileURL(import.meta.url).href)
const shim = await import(pathToFileURL(join(scripts, 'test-vitest-shim.mjs')).href)

const target = resolve(process.argv[2] ?? '')
shim.__beginFile(relative(repoRoot, target))
let importError
try {
  await import(pathToFileURL(target).href)
} catch (err) {
  importError = err instanceof Error ? (err.stack ?? err.message) : String(err)
}
const tests = shim.__collectAndReset()
if (importError !== undefined) {
  console.log(`FAIL ${relative(repoRoot, target)}`)
  console.log(`     import/evaluation error: ${importError.split('\n')[0]}`)
  process.exit(1)
}
const failed = tests.filter((t) => !t.ok)
if (failed.length === 0) {
  console.log(`PASS ${relative(repoRoot, target)} (${tests.length} tests)`)
  process.exit(0)
}
console.log(`FAIL ${relative(repoRoot, target)} (${failed.length}/${tests.length} tests)`)
for (const t of failed) {
  console.log(`     ✗ ${t.suite ? t.suite + ' › ' : ''}${t.name}`)
  if (t.error) console.log(`       ${t.error.split('\n').slice(0, 6).join('\n       ')}`)
}
process.exit(1)
