#!/usr/bin/env node
// pbf-scope-probe.mjs — D4b evidence, S1+S3+S4.
//
// The probe MUST be copied into the production resolution scope
// (packages/runtime/) and run from there, then the copy deleted — the
// ESM resolution scope is the importing module's location:
//
//   Copy-Item references/pbf-scope-probe.mjs <PBF>/packages/runtime/
//   node <PBF>/packages/runtime/pbf-scope-probe.mjs
//   Remove-Item <PBF>/packages/runtime/pbf-scope-probe.mjs
//
//   S1: an @deepseek-ai/* import resolves from THIS scope's node_modules
//       (normal-first), not the test-use checkout.
//   S3: a non-exported subpath of an available package throws
//       ERR_PACKAGE_PATH_NOT_EXPORTED through the hook unchanged.
//   S4: a non-@deepseek-ai specifier passes through untouched.
import { register } from 'node:module'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const HOOK = new URL('src/plugin/upstream-resolver.mjs', import.meta.url)
register(HOOK.href)

// probe at packages/runtime/xxx.mjs → PBF root is two levels up.
const pbfRoot = new URL('../../', import.meta.url).href

let pass = true
function check(label, ok, detail) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}${detail ? ` — ${detail}` : ''}`)
  if (!ok) pass = false
}

// ---- S1: normal-first from the production (packages/runtime) scope ----
const resolvedUrl = import.meta.resolve('@deepseek-ai/dsh-session')
check('S1: import.meta.resolve finds @deepseek-ai/dsh-session in this scope',
  typeof resolvedUrl === 'string' && existsSync(fileURLToPath(resolvedUrl)), resolvedUrl)
check('S1: resolution is INSIDE the PBF install, not the test-use checkout',
  typeof resolvedUrl === 'string' && resolvedUrl.startsWith(pbfRoot) && !resolvedUrl.includes('deepseek-harness-test-use'),
  resolvedUrl ?? undefined)

const session = await import('@deepseek-ai/dsh-session')
check('S1: dynamic import through the hook succeeds (normal path)',
  typeof session.SessionId !== 'undefined', Object.keys(session).slice(0, 5).join(','))

// ---- S3: ERR_PACKAGE_PATH_NOT_EXPORTED passes through unchanged --------
let s3Error = null
try {
  await import('@deepseek-ai/dsh-session/definitely-not-a-real-subpath')
} catch (error) {
  s3Error = error
}
check('S3: bad subpath throws', s3Error !== null, s3Error?.code)
check('S3: ...with the ORIGINAL code (not masked by the fallback)',
  s3Error?.code === 'ERR_PACKAGE_PATH_NOT_EXPORTED', s3Error?.code)

// ---- S4: non-@deepseek-ai specifiers pass through untouched -----------
const vm = await import('node:vm')
check('S4: non-upstream specifier untouched (node:vm resolves normally)',
  typeof vm.createContext === 'function')

console.log(pass ? 'PASS pbf-scope-probe' : 'FAIL pbf-scope-probe')
process.exit(pass ? 0 : 1)
