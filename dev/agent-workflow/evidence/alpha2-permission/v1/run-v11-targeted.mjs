#!/usr/bin/env node
/**
 * V1-1 targeted runner (the fs-seam fix): re-runs the FULL alpha.2
 * permission plane (A2–A6, incl. the NEW a6a fs-seam legs) plus the
 * alpha.1 wiring / control-plane suites that ride the t12a live bridge
 * (which now serves the `fsBackend` dep additively).
 */
import { register } from 'node:module'
import { pathToFileURL } from 'node:url'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', '..')
register(pathToFileURL(join(root, 'scripts', 'run-tests-hooks.mjs')).href, import.meta.url)
const shim = await import(pathToFileURL(join(root, 'scripts', 'test-vitest-shim.mjs')).href)

const files = [
  'packages/runtime/test/a2-canonical-operation.test.ts',
  'packages/runtime/test/a3-permission-resolver.test.ts',
  'packages/runtime/test/a4a-control-exact-scope.test.ts',
  'packages/runtime/test/a5a-pre-execute.test.ts',
  'packages/runtime/test/a6a-production-wiring.test.ts',
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
      if (t.error) console.log(`       ${t.error.split('\n').slice(0, 6).join('\n       ')}`)
    }
  }
}
console.log('')
console.log(`targeted: ${totalPass} passed, ${totalFail} failed, ${totalPass + totalFail} total`)
if (totalFail > 0) process.exit(1)
console.log('RESULT: PASS targeted (0 failures)')
process.exit(0)
