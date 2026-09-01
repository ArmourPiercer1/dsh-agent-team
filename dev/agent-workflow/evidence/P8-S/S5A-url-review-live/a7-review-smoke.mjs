// S5A-url-review A7 re-proof (independent of the implementation's a7-smoke.mjs):
// plain-Node import of the REBUILT dist entry with ZERO TS tooling, asserting
// the stable Cordis export shape.
import { pathToFileURL } from 'node:url'

const entryPath = process.argv[2]
if (entryPath === undefined) throw new Error('usage: node a7-review-smoke.mjs <dist-host-entry.js>')

const mod = await import(pathToFileURL(entryPath).href)

const failures = []
if (typeof mod.name !== 'string' || mod.name !== 'dsh-agent-team') {
  failures.push(`name: ${JSON.stringify(mod.name)}`)
}
if (typeof mod.apply !== 'function') failures.push(`apply: ${typeof mod.apply}`)
if (typeof mod.validateTeamPluginConfig !== 'function') {
  failures.push(`validateTeamPluginConfig: ${typeof mod.validateTeamPluginConfig}`)
}
if (!Array.isArray(mod.inject) || JSON.stringify(mod.inject) !== JSON.stringify(['agents', 'storageDomain', 'sessionPersistence'])) {
  failures.push(`inject: ${JSON.stringify(mod.inject)}`)
}
if (mod.name !== undefined && typeof mod.name !== 'string') failures.push('name not string')

if (failures.length > 0) {
  console.error('A7-REVIEW-SMOKE FAIL: ' + failures.join(' | '))
  process.exit(1)
}
console.log('A7-REVIEW-SMOKE OK: name/apply/validateTeamPluginConfig/inject all present and correct')
console.log('  name  = ' + mod.name)
console.log('  apply = function')
console.log('  validateTeamPluginConfig = function')
console.log('  inject = ' + JSON.stringify(mod.inject))
