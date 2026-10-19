#!/usr/bin/env node
/**
 * run-one — run ONE .test.ts file through the exact plain-node chain of
 * scripts/run-tests.mjs (register(run-tests-hooks) + test-vitest-shim), but
 * for a single spec file instead of a whole package. Same module-load
 * semantics (the p4t6 tree scan runs at import time here, exactly as it does
 * under vitest at file-load time).
 *
 * Usage: node dev/agent-workflow/evidence/a5-p4t6-race/run-one.mjs <relative-test-file>
 * Exit: 0 all pass, 1 any failure.
 */
import { dirname, join, relative } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { register } from 'node:module'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..', '..', '..', '..')

register('../../../../scripts/run-tests-hooks.mjs', import.meta.url)
const shim = await import('../../../../scripts/test-vitest-shim.mjs')

const target = process.argv[2]
if (target === undefined) {
  console.error('usage: run-one.mjs <relative-test-file>')
  process.exit(2)
}
const file = join(root, target)

shim.__beginFile(relative(root, file))
let importError
try {
  await import(pathToFileURL(file).href)
} catch (err) {
  importError = err instanceof Error ? (err.stack ?? err.message) : String(err)
}
const tests = shim.__collectAndReset()
if (importError !== undefined) {
  console.log(`FAIL ${relative(root, file)}`)
  console.log(`     import/evaluation error: ${importError.split('\n')[0]}`)
  process.exit(1)
}
const failed = tests.filter((t) => !t.ok)
for (const t of failed) {
  console.log(`  × ${t.name}`)
  console.log(`    ${String(t.error ?? '').split('\n').slice(0, 12).join('\n    ')}`)
}
console.log(`${failed.length === 0 ? 'PASS' : 'FAIL'} ${relative(root, file)} (${tests.length - failed.length}/${tests.length} tests)`)
process.exit(failed.length === 0 ? 0 : 1)
