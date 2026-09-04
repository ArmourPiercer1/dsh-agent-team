/**
 * Raw auth-exchange isolation test: spawn the web instance directly (no
 * DshInstance), capture stdout in-process, extract the boot marker, and try
 * the token exchange with full diagnostics. Kills the child on exit.
 */

import { spawn } from 'node:child_process'
import { createWriteStream, openSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const EV = dirname(fileURLToPath(import.meta.url))
const REPO = join(EV, '..', '..', '..', '..', '..')
const HOST_TREE = join(REPO, 'references', 'deepseek-harness-test-use')
const home = process.argv[2]
if (!home) { console.error('usage: node s8-rawauth.mjs <s8-home-dir>'); process.exit(2) }

const PORT = 3180
const LOG_PATH = join(EV, 'instances', 'rawauth.log')
const fd = openSync(LOG_PATH, 'w')
const child = spawn(
  process.execPath,
  ['apps/cli/lib/bin.js', 'web', '--port', String(PORT), '--no-open'],
  {
    cwd: HOST_TREE,
    stdio: ['ignore', fd, fd],
    env: { ...process.env, DSH_HOME: home, DSH_CLIENT_COMMIT_HASH: '76fda72979' },
  },
)

const marker = await new Promise((resolve) => {
  const t0 = Date.now()
  const iv = setInterval(() => {
    let text = ''
    try { text = readFileSync(LOG_PATH, 'utf8') } catch { text = '' }
    const line = text.split('\n').find((l) => l.includes('dsh web: http://'))
    if (line) { clearInterval(iv); resolve(line) }
    else if (Date.now() - t0 > 90_000) { clearInterval(iv); resolve(null) }
  }, 250)
})
if (marker === null) { console.error('no marker'); child.kill(); process.exit(1) }

const token = marker.slice(marker.indexOf('token=') + 6).trim()
console.log(`token: ${JSON.stringify(token)} (len=${token.length})`)

const origin = `http://127.0.0.1:${PORT}`
const res = await fetch(`${origin}/?token=***}`, { redirect: 'manual', signal: AbortSignal.timeout(15_000) })
console.log(`exchange status=${res.status}`)
for (const [k, v] of res.headers) console.log(`  ${k}: ${String(v).slice(0, 80)}`)
await res.arrayBuffer()

child.kill()
setTimeout(() => process.exit(0), 500)
