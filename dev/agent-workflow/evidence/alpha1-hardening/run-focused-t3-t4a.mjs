#!/usr/bin/env node
/**
 * Targeted runner for the alpha.1-hardening focused tests (t3 + t4a only).
 * The full run-tests.mjs crashes at the pre-existing d5-instance-contract
 * (an async it() unhandled rejection the shim cannot absorb) before reaching
 * the t3/t4a files (alphabetical order). This runner skips the crashing
 * pre-existing files and runs ONLY the hardening-focused tests.
 */
import { register } from 'node:module'
import { pathToFileURL } from 'node:url'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import process from 'node:process'

// Anchored on the script location (this runner lives in
// dev/agent-workflow/evidence/alpha1-hardening/ — three levels under the
// worktree root) so it can be invoked from any cwd.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..')
register(pathToFileURL(join(root, 'scripts', 'run-tests-hooks.mjs')).href, import.meta.url)
const shim = await import(pathToFileURL(join(root, 'scripts', 'test-vitest-shim.mjs')).href)

const files = [
  'packages/runtime/test/t3-skills-mcp-adapter.test.ts',
  'packages/runtime/test/t4a-capability-wiring.test.ts',
]

let totalPass = 0
let totalFail = 0
for (const file of files) {
  shim.__beginFile(relative(root, file))
  let importError
  try {
    await import(pathToFileURL(join(root, file)).href)
  } catch (err) {
    importError = err instanceof Error ? (err.stack ?? err.message) : String(err)
  }
  const tests = shim.__collectAndReset()
  if (importError !== undefined) {
    totalFail += 1
    console.log(`FAIL ${file}`)
    console.log(`     import/evaluation error: ${importError.split('\n')[0]}`)
    continue
  }
  const failed = tests.filter((t) => !t.ok)
  if (failed.length === 0) {
    totalPass += tests.length
    console.log(`PASS ${file} (${tests.length} tests)`)
  } else {
    totalPass += tests.length - failed.length
    totalFail += failed.length
    console.log(`FAIL ${file} (${failed.length}/${tests.length} tests)`)
    for (const t of failed) {
      console.log(`     x ${t.suite ? t.suite + ' | ' : ''}${t.name}`)
      if (t.error) console.log(`       ${t.error.split('\n').slice(0, 4).join('\n       ')}`)
    }
  }
}
console.log('')
console.log(`targeted: ${totalPass} passed, ${totalFail} failed, ${totalPass + totalFail} total`)
if (totalFail > 0) process.exit(1)
console.log('RESULT: PASS targeted (0 failures)')
process.exit(0)
