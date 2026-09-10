#!/usr/bin/env node
/**
 * V1 targeted runner for the alpha.2 focused suites that the plain
 * run-tests.mjs never reaches (it aborts in the pre-existing
 * d5-instance-contract crash, alphabetical order, before the
 * f / p / t suites).
 * Runs ONLY the V1-relevant suites: the t3 skills/MCP adapter, the t4a
 * capability-wiring legacy suite, the f9 control-plane suites, and the
 * p6t4 allow-once/deny/stale/negatives/restart control suites.
 */
import { register } from 'node:module'
import { pathToFileURL } from 'node:url'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// Anchored on the script location (dev/agent-workflow/evidence/alpha2-permission/v1/
// — five levels under the worktree root) so it can be invoked from any cwd.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', '..')
register(pathToFileURL(join(root, 'scripts', 'run-tests-hooks.mjs')).href, import.meta.url)
const shim = await import(pathToFileURL(join(root, 'scripts', 'test-vitest-shim.mjs')).href)

const files = [
  'packages/runtime/test/t3-skills-mcp-adapter.test.ts',
  'packages/runtime/test/t4a-capability-wiring.test.ts',
  'packages/runtime/test/f9-control-exactly-once.test.ts',
  'packages/runtime/test/f9-s6-resolve-control.test.ts',
  'packages/runtime/test/p6t4-allow-once.test.ts',
  'packages/runtime/test/p6t4-deny.test.ts',
  'packages/runtime/test/p6t4-stale.test.ts',
  'packages/runtime/test/p6t4-negatives.test.ts',
  'packages/runtime/test/p6t4-restart.test.ts',
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
