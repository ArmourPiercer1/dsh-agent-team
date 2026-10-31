import { spawn } from 'node:child_process'
import { openSync, readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { CLIENT_COMMIT_HASH } from '/home/armourpiercer/projects/dsh-agent-team/.worktrees/a5xenv-20261031/tests/paths.mjs'
const WORKTREE = process.cwd()
const TU = join(WORKTREE, 'tests/deepseek-harness-test-use')
const HOME = join(WORKTREE, 'tests/homes/a5x-pocB1-20261031T184115')
const LOG = '/home/armourpiercer/projects/dsh-agent-team/.worktrees/a5xenv-20261031/tests/kits/a5x-envpoc/tmp/manual-host.log'
const child = spawn(process.execPath, [join(TU, 'apps/cli/lib/bin.js'), 'web', '--port', '3187', '--no-open'], {
  cwd: WORKTREE, stdio: ['ignore', openSync(LOG, 'w'), openSync(LOG, 'a')],
  env: { ...process.env, DSH_HOME: HOME, DSH_CLIENT_COMMIT_HASH: CLIENT_COMMIT_HASH, DEEPSEEK_BASE_URL: 'http://127.0.0.1:4599', DEEPSEEK_API_KEY: 'k' },
})
const ORIGIN = 'http://127.0.0.1:3187'
let token = null
for (let i = 0; i < 300 && token === null; i++) {
  await new Promise(r => setTimeout(r, 400))
  const m = existsSync(LOG) ? readFileSync(LOG, 'utf8').match(/token=([A-Za-z0-9_-]+)/) : null
  if (m) token = m[1]
}
if (!token) { console.log('BOOT FAIL'); try{process.kill(child.pid)}catch{}; process.exit(1) }
const res = await fetch(`${ORIGIN}/?token=${token}`, { redirect: 'manual' })
const cookie = res.headers.get('set-cookie').split(';', 1)[0]
const r1 = await fetch(`${ORIGIN}/api/session/create`, { method: 'POST', headers: { 'content-type': 'application/json', cookie }, body: JSON.stringify({ type: 'client-request', rpcId: 'x1', method: 'session/create', payload: { args: { request: { sessionId: 'manual-m1', cwd: WORKTREE, agentPreset: 'a5x-tools' } } } }), signal: AbortSignal.timeout(20000) })
console.log('create status', r1.status)
console.log('create body', (await r1.text()).slice(0, 500))
try { process.kill(child.pid) } catch {}
await new Promise(r => setTimeout(r, 500))
const host = readFileSync(LOG, 'utf8')
const err = host.split('\n').filter(l => /error|Error|fail|throw|preset|Preset|plugin|Cannot|cannot/i.test(l)).slice(0, 10)
console.log('HOST LINES:', err.join('\n') || '(none)')
process.exit(0)
