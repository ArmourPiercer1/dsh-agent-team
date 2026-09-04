/**
 * S8 probe: boot an instance in a given S8 home, wait for the boot marker,
 * then fetch the index page (with auth cookie) and print the injected
 * /plugins/ URLs (the composed boot graph — the definitive list of client
 * rows the module registry recognized). Also tries a few candidate bundle
 * URLs and prints status. Kills the instance on exit.
 *
 * Usage: node s8-probe.mjs <home-dir>
 */

import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DshInstance } from '../../../../../.worktrees/RC1/tests/characterization/lib/instance.mjs'
import { logTail, waitForLogLine } from '../../../../../.worktrees/RC1/tests/characterization/lib/util.mjs'

const EV = dirname(fileURLToPath(import.meta.url))
const REPO = join(EV, '..', '..', '..', '..', '..')
const HOST_TREE = join(REPO, 'references', 'deepseek-harness-test-use')
const BOOT_MARKER = /dsh web: http:\/\/127\.0\.0\.1:(\d+)\/\?token=[A-Za-z0-9_-]+/

const home = process.argv[2]
if (!home || !existsSync(home)) {
  console.error('usage: node s8-probe.mjs <s8-home-dir>')
  process.exit(2)
}

const PORT = 3180
const instance = new DshInstance({
  hostTree: HOST_TREE,
  dshHome: home,
  port: PORT,
  clientCommitHash: '76fda72979',
  logDir: join(EV, 'instances'),
})

try {
  const started = await instance.start({ timeoutMs: 120_000 })
  const markerLine = await waitForLogLine(started.logPath, BOOT_MARKER, 30_000)
  const token = markerLine.slice(markerLine.indexOf('token=') + 6).trim()
  const origin = `http://127.0.0.1:${PORT}`
  console.log(`probe: booted at ${origin}`)

  // Auth cookie.
  const authRes = await fetch(`${origin}/?token=***}`, { redirect: 'manual', signal: AbortSignal.timeout(30_000) })
  const setCookie = authRes.headers.get('set-cookie')
  console.log(`probe: auth exchange status=${authRes.status} set-cookie=${setCookie === null ? 'NULL' : setCookie.slice(0, 16) + '…'} location=${authRes.headers.get('location')}`)
  const cookie = setCookie?.split(';', 1)[0] ?? ''
  console.log(`probe: cookie ${cookie.slice(0, 12)}…`)

  // Index page — extract every /plugins/ reference (the composed boot graph).
  const idx = await fetch(origin, { headers: { cookie }, signal: AbortSignal.timeout(30_000) })
  const idxText = await idx.text()
  const urls = [...new Set(idxText.match(/\/plugins\/[^"'\s\\]+/g) ?? [])]
  console.log(`probe: index status=${idx.status} bytes=${idxText.length}; injected /plugins/ URLs:`)
  for (const u of urls) console.log(`  ${u}`)

  // Candidate bundle URLs.
  const candidates = [
    '/plugins/@dsh-agent-team/client/client.js',
    '/plugins/dsh-agent-team-client/client.js',
    '/plugins/%40dsh-agent-team/client/client.js',
  ]
  for (const u of candidates) {
    const r = await fetch(origin + u, { headers: { cookie }, signal: AbortSignal.timeout(15_000) })
    const buf = Buffer.from(await r.arrayBuffer())
    console.log(`probe GET ${u} → ${r.status} (${buf.length} B)`)
  }

  // Instance stdout/stderr tail (loader / client-modules log lines).
  console.log(`probe: instance log tail:\n${logTail(started.logPath, 40)}`)
} finally {
  await instance.stop({ timeoutMs: 20_000 })
}
console.log('probe: done')
