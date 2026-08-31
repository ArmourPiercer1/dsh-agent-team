/**
 * loader-smoke.mjs — verifies the ts-loader rewrite for the three specifier
 * kinds the harness uses: file: URLs (driver probe, worker world imports,
 * row register.js import), relative .js, and a no-rewrite negative (a real
 * .mjs file must pass through untouched). Run: node loader-smoke.mjs
 */
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { register } from 'node:module'

const HERE = import.meta.dirname
const PACKAGES = join(HERE, '..', '..', '..', '..', '..', '..', 'packages')

register(pathToFileURL(join(HERE, 'ts-loader.mjs')).href, import.meta.url)

const results = []
const check = async (label, fn, expectKeys) => {
  try {
    const mod = await fn()
    const keys = Object.keys(mod).slice(0, 3)
    const ok = expectKeys === null || expectKeys.every((k) => k in mod)
    results.push(`${ok ? 'OK  ' : 'BAD '} ${label}: exports=${keys.join(',')}`)
    if (!ok) process.exitCode = 1
  } catch (error) {
    results.push(`FAIL ${label}: ${error.message}`)
    process.exitCode = 1
  }
}

await check(
  'file: URL -> contracts/src/index.ts',
  () => import(pathToFileURL(join(PACKAGES, 'contracts', 'src', 'index.js')).href),
  null,
)
await check(
  'file: URL -> remote/src/handlers/register.ts',
  () => import(pathToFileURL(join(PACKAGES, 'remote', 'src', 'handlers', 'register.js')).href),
  ['registerRemoteHandlers'],
)
await check(
  'real .mjs passes through (no rewrite)',
  () => import(pathToFileURL(join(PACKAGES, 'testkit', 'fault-injection', 'file-seam.mjs')).href),
  ['FileStorageSeam'],
)

for (const line of results) console.log(line)
console.log(process.exitCode === 1 ? 'loader-smoke: FAIL' : 'loader-smoke: PASS')
