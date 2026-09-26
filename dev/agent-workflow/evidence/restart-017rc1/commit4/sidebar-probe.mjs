#!/usr/bin/env node
// sidebar-probe.mjs — what does the UI's own list call return, and what
// is in the sidebar DOM (full-element scan for session items)?
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { createRequire } from 'node:module'
process.env.PLAYWRIGHT_BROWSERS_PATH ??= '/home/user/dsh-plugins/dsh-agent-team/tests/homes/.browsers'
process.env.LD_LIBRARY_PATH = ['/home/user/dsh-plugins/dsh-agent-team/tests/homes/.browser-libs/extract/usr/lib/x86_64-linux-gnu', process.env.LD_LIBRARY_PATH].filter(Boolean).join(':')
const KIT_DIR = '/home/user/dsh-plugins/dsh-agent-team/.worktrees/team-restart-017rc1/dev/agent-workflow/evidence/restart-017rc1/commit4'
const OUT = join(KIT_DIR, 'world-A', 'boot-2', 'browser-driver')
const pw = createRequire('/home/user/dsh-plugins/dsh-agent-team/tests/deepseek-harness-test-use/package.json')('/home/user/dsh-plugins/dsh-agent-team/tests/deepseek-harness-test-use/node_modules/.pnpm/playwright@1.61.1/node_modules/playwright')
const markerRaw = readFileSync(join(KIT_DIR, 'world-A', 'boot-2', 'boot-2-marker.txt'), 'utf8')
const markerUrl = (markerRaw.match(/https?:\/\/\S+/) ?? [])[0]
const log = (l) => console.error(`[side] ${l}`)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const browser = await pw.chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const listCalls = []
page.on('response', async (resp) => {
  const u = resp.url()
  if (u.includes('/api/session/list')) {
    try {
      const b = await resp.text()
      const m = b.match(/"sessionId":"([^"]+)"/g)
      listCalls.push({ at: Date.now(), status: resp.status(), len: b.length, ids: m ?? [] })
      if (b.length < 8000) listCalls[listCalls.length - 1].raw = b
    } catch {}
  }
})
await page.goto(markerUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 })
await sleep(15_000)
// full DOM scan: every element whose TEXT or outerHTML mentions our sessions
const scan = await page.evaluate(() => {
  const needles = ['c4 title', 'rst017c4-dyn', 'RST017C4DONE', 'rst017c4-boot', 'commit 4']
  const hits = []
  const all = document.querySelectorAll('*')
  all.forEach((el) => {
    const t = (el.textContent || '').trim()
    const own = (el.childElementCount === 0 ? (el.textContent || '').trim() : '')
    for (const n of needles) {
      if (own.includes(n) || (el.outerHTML || '').includes(n)) {
        hits.push({ tag: el.tagName, cls: String(el.className).slice(0, 120), own: own.slice(0, 120), needle: n, visible: el.offsetParent !== null, rect: el.getBoundingClientRect ? `${Math.round(el.getBoundingClientRect().x)},${Math.round(el.getBoundingClientRect().y)} ${Math.round(el.getBoundingClientRect().width)}x${Math.round(el.getBoundingClientRect().height)}` : '?' })
        break
      }
    }
  })
  return hits.slice(0, 60)
})
writeFileSync(join(OUT, 'sidebar-scan.json'), JSON.stringify({ listCalls, scan }, null, 1))
log(`list calls: ${JSON.stringify(listCalls.map((c) => ({ status: c.status, len: c.len, ids: c.ids })))}`)
log(`DOM needle hits: ${scan.length}`)
for (const h of scan.slice(0, 20)) log(`  ${h.needle} <${h.tag}> vis=${h.visible} ${h.rect} :: ${h.own.slice(0, 80)}`)
// also: the sidebar subtree text (left 300px)
const side = await page.evaluate(() => {
  const els = [...document.querySelectorAll('*')].filter((e) => { const r = e.getBoundingClientRect(); return r.x < 320 && r.width > 40 && r.width < 400 && r.height > 200 })
  els.sort((a, b) => (a.getBoundingClientRect().width * a.getBoundingClientRect().height) - (b.getBoundingClientRect().width * b.getBoundingClientRect().height))
  return els.slice(0, 3).map((e) => (e.innerText || '').replace(/\n+/g, ' | ').slice(0, 600))
})
log('sidebar subtrees:')
for (const s of side) log('  ' + s)
await browser.close()
