// T12 §13 boot probe — evidence-only scratch. Validates that a REAL DSH web
// instance from the pinned test-use checkout boots in this environment
// (spawn with file-fd stdio per TEST_METHODS §2 / instance.mjs, fresh home,
// boot marker, HTTP 200, clean kill, port freed). Mirrors
// tests/characterization/lib/instance.mjs start() exactly.
import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync, openSync, closeSync, readFileSync, existsSync, statSync, rmSync } from 'node:fs'
import { dirname } from 'node:path'

const HOST = 'D:/AgentDev/dsh-plugins/dsh-agent-team/references/deepseek-harness-test-use'
const HOME = 'D:/AgentDev/dsh-plugins/dsh-agent-team/references/.dsh-test-t12probe'
const PORT = 3186
const LOG = 'D:/AgentDev/dsh-plugins/dsh-agent-team/dev/agent-workflow/evidence/T12/t12-13-boot-probe.log'
const TIMEOUT_MS = 120_000

if (existsSync(HOME)) {
  const dirents = []
  try { dirents.push(...(await import('node:fs')).readdirSync(HOME)) } catch {}
  if (dirents.length > 0) {
    console.error('PROBE ABORT: home already non-empty (fail-closed)')
    process.exit(2)
  }
}
mkdirSync(HOME, { recursive: true })
writeFileSync(LOG, '')
const outFd = openSync(LOG, 'a')
const errFd = openSync(LOG, 'a')

const child = spawn(
  process.execPath,
  ['apps/cli/lib/bin.js', 'web', '--port', String(PORT), '--no-open'],
  {
    cwd: HOST,
    stdio: ['ignore', outFd, errFd],
    env: { ...process.env, DSH_HOME: HOME, DSH_CLIENT_COMMIT_HASH: 'cd5ef814' },
  },
)

let marker = null
const t0 = Date.now()
while (Date.now() - t0 < TIMEOUT_MS) {
  await new Promise((r) => setTimeout(r, 1000))
  if (existsSync(LOG)) {
    const m = readFileSync(LOG, 'utf8').match(/dsh web: http:\/\/127\.0\.0\.1:(\d+)\/\?token=[A-Za-z0-9_-]+/)
    if (m) { marker = m[0]; break }
  }
  if (child.exitCode !== null) break
}

let httpStatus = null
if (marker) {
  const url = marker.replace(/.*dsh web:\s*/, '')
  try { const r = await fetch(url); httpStatus = r.status } catch (e) { httpStatus = 'ERR ' + e.message }
}

try { child.kill() } catch {}
await new Promise((r) => setTimeout(r, 2500))
if (child.exitCode === null) { try { child.kill('SIGKILL') } catch {} }
await new Promise((r) => setTimeout(r, 1000))
closeSync(outFd)
closeSync(errFd)

const portFree = await (async () => {
  try {
    const s = await netConnect(PORT)
    s.destroy()
    return false
  } catch { return true }
})
async function netConnect(port) {
  const { connect } = await import('node:net')
  return new Promise((res, rej) => {
    const s = connect({ host: '127.0.0.1', port })
    s.once('connect', () => res(s))
    s.once('error', rej)
  })
}

const tail = existsSync(LOG) ? readFileSync(LOG, 'utf8').split('\n').slice(-8).join('\n') : '<no log>'
rmSync(HOME, { recursive: true, force: true })
console.log(JSON.stringify({
  markerFound: marker !== null,
  bootMs: marker ? Date.now() - t0 : null,
  httpStatus,
  exitCode: child.exitCode,
  portFreeAfterKill: portFree,
  logTail: tail,
}, null, 1))
process.exit(marker !== null && httpStatus === 200 && portFree ? 0 : 1)
