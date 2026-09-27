#!/usr/bin/env node
// expand-probe.mjs — inspect the sidebar group rows (chevrons?), expand
// everything, re-dump; also probe the workspace membership API.
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
const log = (l) => console.error(`[exp] ${l}`)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const browser = await pw.chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
await page.goto(markerUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 })
await sleep(12_000)

// 1. full sidebar DOM (left 340px), with aria attributes
const teamTab = await page.evaluate(() => {
  const els = [...document.querySelectorAll('button, [role="tab"], [role="button"], a, div, span')]
  const hit = els.find((e) => (e.textContent || '').trim() === 'Team' && e.offsetParent !== null && e.getBoundingClientRect().x > 300)
  if (!hit) return 'no-team-tab'
  // prefer the smallest element with exactly 'Team'
  const small = els.filter((e) => (e.textContent || '').trim() === 'Team' && e.offsetParent !== null && e.getBoundingClientRect().x > 300)
  small.sort((a, b) => a.textContent.length - b.textContent.length || a.getBoundingClientRect().width - b.getBoundingClientRect().width)
  const el = small[0]
  el.click()
  return `clicked ${el.tagName}.${String(el.className).slice(0, 60)}`
})
log('team tab: ' + teamTab)
await sleep(8000)
const teamScreen = await page.evaluate(() => document.body ? document.body.innerText : '')
writeFileSync(join(OUT, 'team-tab-screen.txt'), teamScreen)
log(`team tab screen: ${teamScreen.replace(/\n/g, ' | ').slice(0, 700)}`)
const btns = await page.evaluate(() => {
  return [...document.querySelectorAll('button, [role="button"]')]
    .filter((b) => b.offsetParent !== null && b.getBoundingClientRect().x > 300)
    .map((b) => ({ label: (b.getAttribute('aria-label') || '').slice(0, 50), text: (b.innerText || '').trim().replace(/\s+/g, ' ').slice(0, 60), disabled: b.disabled || b.getAttribute('aria-disabled') === 'true' }))
    .filter((b) => b.text || b.label)
})
writeFileSync(join(OUT, 'team-tab-buttons.json'), JSON.stringify(btns, null, 1))
log('main-pane buttons: ' + JSON.stringify(btns.slice(0, 25)))
await page.screenshot({ path: join(OUT, 'team-tab.png') }).catch(() => {})
await browser.close()
