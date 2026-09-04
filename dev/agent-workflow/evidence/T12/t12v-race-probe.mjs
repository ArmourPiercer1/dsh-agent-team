// main-agent diagnostic (t12v-race-probe.mjs v2): prove the upstream-resolver hook
// WORKS once activated, with checkout discovery mimicking the real boot
// (argv[1] = test-use/apps/cli/lib/bin.js, cwd = test-use root).
// Sandbox: piped-stdio spawn is EPERM here -> children use stdio 'ignore' and
// append results to a shared file.
import { spawn } from 'node:child_process'
import { appendFile, rm } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const resultFile = join(here, 't12v-race-probe-results.txt')
await rm(resultFile, { force: true })

const hook = 'file:///D:/AgentDev/dsh-plugins/dsh-agent-team/.worktrees/T12-V/packages/runtime/src/plugin/upstream-resolver.mjs'
const seam = 'file:///D:/AgentDev/dsh-plugins/dsh-agent-team/.worktrees/T12-V/packages/runtime/root-binding/harness/seam.mjs'
const fakeArgv1 = 'D:\\AgentDev\\dsh-plugins\\dsh-agent-team\\references\\deepseek-harness-test-use\\apps\\cli\\lib\\bin.js'

const shimTemplate = `
import { register } from 'node:module'
import { setTimeout as sleep } from 'node:timers/promises'
import { appendFile } from 'node:fs/promises'
process.argv[1] = __FAKE_ARGV1__
register(__HOOK__, import.meta.url)
await sleep(__DELAY__)
let line
try {
  await import(__SEAM__)
  line = 'SEAM LOADED (delay=__DELAY__ms)'
} catch (e) {
  line = 'SEAM LOAD FAILED (delay=__DELAY__ms): ' + e.message
}
await appendFile(__RESULT__, line + '\\n')
`

for (const ms of [0, 2000]) {
  const shim = shimTemplate
    .replace(/__FAKE_ARGV1__/g, JSON.stringify(fakeArgv1))
    .replace(/__HOOK__/g, JSON.stringify(hook))
    .replace(/__SEAM__/g, JSON.stringify(seam))
    .replace(/__RESULT__/g, JSON.stringify(resultFile))
    .replace(/__DELAY__/g, String(ms))
  const r = spawn(process.execPath, ['--input-type=module', '-e', shim], {
    cwd: 'D:\\AgentDev\\dsh-plugins\\dsh-agent-team\\references\\deepseek-harness-test-use',
    stdio: 'ignore',
  })
  await new Promise((res) => r.on('close', res))
}

const { readFileSync } = await import('node:fs')
console.log(readFileSync(resultFile, 'utf8').trim())
