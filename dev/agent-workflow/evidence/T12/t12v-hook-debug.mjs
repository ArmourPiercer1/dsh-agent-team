// main-agent diagnostic (t12v-hook-debug.mjs): instrumented COPY of
// upstream-resolver.mjs (in evidence dir; the original is builder-owned in
// T12-V). Registers the copy in a child process with argv[1] mimicking the
// real boot, logs discovery internals + every @deepseek-ai resolve, then
// imports the T12-V seam.
import { spawn } from 'node:child_process'
import { appendFile, rm } from 'node:fs/promises'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const resultFile = join(here, 't12v-hook-debug-results.txt')
await rm(resultFile, { force: true })

const seam = 'file:///D:/AgentDev/dsh-plugins/dsh-agent-team/.worktrees/T12-V/packages/runtime/root-binding/harness/seam.mjs'
const fakeArgv1 = 'D:\\AgentDev\\dsh-plugins\\dsh-agent-team\\references\\deepseek-harness-test-use\\apps\\cli\\lib\\bin.js'

const shim = `
import { register } from 'node:module'
import { appendFile } from 'node:fs/promises'
const log = (m) => appendFile(${JSON.stringify(resultFile)}, m + '\\n')
process.argv[1] = ${JSON.stringify(fakeArgv1)}
await log('argv1=' + process.argv[1])
await log('cwd=' + process.cwd())
register('file:///${here.replace(/\\/g, '/')}/t12v-hook-debug-resolver.mjs'.replace('file:///', 'file:///') , import.meta.url)
await new Promise((r) => setTimeout(r, 1500))
await log('hook registered + 1500ms; importing seam')
try {
  await import(${JSON.stringify(seam)})
  await log('SEAM LOADED')
} catch (e) {
  await log('SEAM LOAD FAILED: ' + e.message)
}
`

const r = spawn(process.execPath, ['--input-type=module', '-e', shim], {
  cwd: 'D:\\AgentDev\\dsh-plugins\\dsh-agent-team\\references\\deepseek-harness-test-use',
  stdio: 'ignore',
})
await new Promise((res) => r.on('close', res))
const txt = readFileSync(resultFile, 'utf8')
process.stdout.write(txt)
