// repro6-driver.mjs — boot host on an existing world, run the spike-class
// client (repro6-spike-client.mjs) for 12 s against /api/remote.mux.
// usage: node repro6-driver.mjs <world-dir> [port=3492]
import { spawn } from 'node:child_process'
import { openSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const MAIN = '/home/user/dsh-plugins/dsh-agent-team'
const TESTUSE = join(MAIN, 'tests', 'deepseek-harness-test-use')
const WORKTREE = join(MAIN, '.worktrees', 'team-restart-017rc1')
const world = process.argv[2]
const port = Number(process.argv[3] ?? 3492)
const mockPort = 3497
if (!world) { console.error('usage: repro6-driver <world> [port]'); process.exit(2) }

const { startMockModel } = await import(pathToFileURL(join(WORKTREE, 'packages', 'tools', 'harness', 'mock-deepseek.mjs')).href)
const mock = await startMockModel({ port: mockPort, decide: () => ({ kind: 'text', content: 'repro6 ack' }), log: () => {} })
console.log(`mock up @ ${mockPort}`)

const hostLog = join('repro6-driver', `host-${Date.now()}.log`)
import { mkdirSync } from 'node:fs'
mkdirSync('repro6-driver', { recursive: true })
const outFd = openSync(hostLog, 'a')
const host = spawn(process.execPath, [join(TESTUSE, 'apps', 'cli', 'lib', 'bin.js'), 'web', '--port', String(port), '--no-open'], {
  cwd: join(world, 'workspace'),
  stdio: ['ignore', outFd, outFd],
  env: {
    ...process.env,
    DSH_HOME: world,
    DSH_CLIENT_COMMIT_HASH: '46a7f68b09',
    DEEPSEEK_BASE_URL: `http://127.0.0.1:${mockPort}`,
    DEEPSEEK_API_KEY: 'repro6-mock-key',
  },
})
let urlLine = null
const urlRe = /dsh web: (http:\/\/127\.0\.0\.1:\d+\/\?token=[^\s]+)/
const deadline = Date.now() + 120_000
const logFile = hostLog
for (;;) {
  const { readFileSync } = await import('node:fs')
  const txt = readFileSync(logFile, 'utf8')
  const m = txt.match(urlRe)
  if (m) { urlLine = m[1]; break }
  if (Date.now() >= deadline) throw new Error('no boot marker within 120s')
  await new Promise((r) => setTimeout(r, 500))
}
console.log(`host up: ${urlLine}`)
const origin = urlLine.split('/?token=')[0]
const token = urlLine.split('?token=')[1]
const res = await fetch(`${origin}/?token=${token}`, { redirect: 'manual', signal: AbortSignal.timeout(30_000) })
const setCookie = res.headers.get('set-cookie')
const cookie = setCookie ? setCookie.split(';', 1)[0] : null
console.log(`cookie acquired: ${cookie !== null}`)

const client = spawn(process.execPath, [join(import.meta.dirname ?? '.', 'repro6-spike-client.mjs'), origin, cookie ?? ''], { stdio: 'inherit' })
const code = await new Promise((r) => client.on('close', r))
console.log(`client exit=${code}`)
try { host.kill('SIGTERM') } catch {}
await new Promise((r) => setTimeout(r, 1500))
try { host.kill('SIGKILL') } catch {}
try { await mock.close?.() } catch {}
process.exit(code ?? 0)
