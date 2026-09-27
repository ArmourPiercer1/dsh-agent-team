#!/usr/bin/env node
// url-scheme.mjs — capture the URL the UI uses when a session is open,
// then test candidate deep-link patterns for a session id.
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
const log = (l) => console.error(`[url] ${l}`)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const browser = await pw.chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
await page.goto(markerUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 })
await sleep(15_000) // let the UI settle on the auto-opened blank session
const openUrl = page.url()
const openText = (await page.evaluate(() => document.body ? document.body.innerText : '')).slice(0, 200)
log(`URL while a session is open: ${openUrl}`)
log(`screen: ${openText.replace(/\n/g, ' | ').slice(0, 160)}`)
// candidate deep links for the dynamic root
const dyn = hold.dynamicRoot
const base = new URL(markerUrl)
const cands = [
  `/?session=${dyn}`,
  `/?sessionId=${dyn}`,
  `/session/${dyn}`,
  `/#/${dyn}`,
  `/#session=${dyn}`,
]
const results = []
for (const c of cands) {
  const u = new URL(c, base).href
  try {
    await page.goto(u, { waitUntil: 'domcontentloaded', timeout: 30_000 })
    await sleep(8_000)
    const t = (await page.evaluate(() => document.body ? document.body.innerText : ''))
    const hit = t.includes('RST017C4') || t.includes(dyn) || /Team|Leader|成员|member/i.test(t)
    results.push({ cand: c, url: page.url(), hit, screen: t.slice(0, 220).replace(/\n/g, ' | ') })
    log(`${hit ? 'HIT ' : '----'} ${c} -> ${page.url()} :: ${t.slice(0, 120).replace(/\n/g, ' | ')}`)
  } catch (e) {
    results.push({ cand: c, error: String(e).slice(0, 120) })
    log(`ERR ${c}: ${String(e).slice(0, 120)}`)
  }
}
writeFileSync(join(OUT, 'url-scheme.json'), JSON.stringify({ openUrl, openText, results }, null, 1))
await browser.close()
