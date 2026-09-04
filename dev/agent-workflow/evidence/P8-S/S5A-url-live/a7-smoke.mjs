/**
 * A7 out-of-chain loadability smoke (S5A-URL): the REBUILT dist entry
 * `packages/runtime/dist/packages/runtime/src/plugin/host.js` loads under
 * PLAIN Node (zero TS tooling, no loader hook, no `node --import`) and
 * exposes the named Cordis export shape:
 *
 *   - name  === 'dsh-agent-team'
 *   - apply  is a function
 *   - validateTeamPluginConfig is a function
 *   - inject === ['agents', 'storageDomain', 'sessionPersistence']
 *
 * `apply` is deliberately NOT invoked (T1's contract; invoking it would
 * register the upstream-resolution hook into this process).
 *
 * Run from the worktree root:
 *   node dev/agent-workflow/evidence/P8-S/S5A-url-live/a7-smoke.mjs
 * @module @dsh-agent-team/evidence/s5a-url/a7-smoke
 */
import { pathToFileURL } from 'node:url'

const entryPath =
  'packages/runtime/dist/packages/runtime/src/plugin/host.js'
const entryUrl = pathToFileURL(entryPath).href
console.log(`A7: importing ${entryUrl}`)
const mod = await import(entryUrl)
const checks = {
  'name === dsh-agent-team': mod.name === 'dsh-agent-team',
  'typeof apply === function': typeof mod.apply === 'function',
  'typeof validateTeamPluginConfig === function':
    typeof mod.validateTeamPluginConfig === 'function',
  'inject === [agents, storageDomain, sessionPersistence]':
    Array.isArray(mod.inject) &&
    mod.inject.length === 3 &&
    mod.inject[0] === 'agents' &&
    mod.inject[1] === 'storageDomain' &&
    mod.inject[2] === 'sessionPersistence',
}
let allOk = true
for (const [label, ok] of Object.entries(checks)) {
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${label}`)
  allOk = allOk && ok
}
if (!allOk) {
  console.log('A7 SMOKE: FAIL')
  process.exit(1)
}
console.log('A7 SMOKE: PASS (plain-Node import of the rebuilt dist entry)')
