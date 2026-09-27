#!/usr/bin/env node
// net-probe.mjs — capture the UI's network traffic on the main screen:
// which list endpoint is called and what it returns.
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { createRequire } from 'node:module'
process.env.PLAYWRIGHT_BROWSERS_PATH ??= '/home/user/dsh-plugins/dsh-agent-team/tests/homes/.browsers'
process.env.LD_LIBRARY_PATH = ['/home/user/dsh-plugins/dsh-agent-team/tests/homes/.browser-libs/extract/usr/lib/x86_64-linux-gnu', process.env.LD_LIBRARY_PATH].filter(Boolean).join(':')
const KIT_DIR = '/home/user/dsh-plugins/dsh-agent-team/.worktrees/team-restart-017rc1/dev/agent-workflow/evidence/restart-017rc1/commit4'
const OUT = join(KIT_DIR, 'world-A', 'boot-2', 'browser-driver')
const pw = createRequire('/home/user/dsh-plugins/dsh-agent-team/tests/deepseek-harness-test-use/package.json')('/home/user/dsh-plugins/dsh-agent-team/tests/deepseek-harness-test-use/node_modules/.pnpm/playwright@1.61.1/node_modules/playwright')
const hold = JSON.parse(readFileSync(join(KIT_DIR, 'world-A', 'boot-2', 'browser-hold.json'), 'utf8'))
const markerRaw = readFileSync(join(KIT_DIR, 'world-A', 'boot-2', 'boot-2-marker.txt'), 'utf8')
const markerUrl = (markerRaw.match(/https?:\/\/\S+/) ?? [])[0]
const log = (l) => console.error(`[net] ${l}`)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const browser = await pw.chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const calls = []
page.on('requestfinished', async (req) => {
  const u = req.url()
  if (!u.includes('127.0.0.1:3492')) return
  const path = new URL(u).pathname + (new URL(u).search || '')
  if (path.includes('/assets/') || path.includes('/icons')) return
  let body = null
  try {
    const r = await req.response()
    const ct = r?.headers()?.['content-type'] ?? ''
    if (ct.includes('json') || path.includes('api')) {
      const t = await r.text().catch(() => null)
      if (t) body = t.slice(0, path.includes('session/list') ? 30000 : 1200)
    }
    calls.push({ method: req.method(), path: path.slice(0, 120), status: r?.status(), body })
  } catch { calls.push({ method: req.method(), path: path.slice(0, 120), status: 'no-resp' }) }
})
await page.goto(markerUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 })
await sleep(12_000)
// reload once (pre-takeover reloads are fine; the gate is about the composer AFTER takeover)
await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {})
await sleep(10_000)
writeFileSync(join(OUT, 'net-calls.json'), JSON.stringify(calls, null, 1))
const text = await page.evaluate(() => document.body ? document.body.innerText : '')
writeFileSync(join(OUT, 'net-screen.txt'), text)
log(`captured ${calls.length} API calls; screen ${text.length} chars`)
for (const c of calls) log(`${c.method} ${c.status} ${c.path} ${c.body ? c.body.slice(0, 140).replace(/\n/g, ' ') : ''}`)
log(`screen head: ${text.slice(0, 300).replace(/\n/g, ' | ')}`)
// direct API probes from the page context (same-origin, cookie-authed)
const probe = await page.evaluate(async (token) => {
  const out = {}
  const rpc = (method, req) => ({ type: 'client-request', rpcId: 'probe-' + Math.random().toString(36).slice(2, 10), method, payload: { args: { _request: req } } })
  try {
    const r1 = await fetch('/api/session/search', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(rpc('session/search', { query: token })) })
    out.search = { status: r1.status, body: (await r1.text()).slice(0, 3000) }
  } catch (e) { out.search = { error: String(e) } }
  try {
    const r2 = await fetch('/api/session/list', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(rpc('session/list', {})) })
    const b2 = await r2.text()
    out.list = { status: r2.status, len: b2.length, ids: (b2.match(/"sessionId":"([^"]+)"/g) ?? []) }
  } catch (e) { out.list = { error: String(e) } }
  return out
}, 'RST017C4DONE')
writeFileSync(join(OUT, 'direct-probes.json'), JSON.stringify(probe, null, 1))
log(`search: ${String(probe.search?.body ?? probe.search?.error).slice(0, 500)}`)
log(`list ids: ${JSON.stringify(probe.list?.ids ?? probe.list?.error)}`)
await browser.close()
