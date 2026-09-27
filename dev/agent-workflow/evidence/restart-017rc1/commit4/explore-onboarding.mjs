#!/usr/bin/env node
// explore-onboarding.mjs — throwaway UI exploration: complete the workspace
// onboarding and dump the resulting main screen + session list inventory.
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { createRequire } from 'node:module'
process.env.PLAYWRIGHT_BROWSERS_PATH ??= '/home/user/dsh-plugins/dsh-agent-team/tests/homes/.browsers'
process.env.LD_LIBRARY_PATH = ['/home/user/dsh-plugins/dsh-agent-team/tests/homes/.browser-libs/extract/usr/lib/x86_64-linux-gnu', process.env.LD_LIBRARY_PATH].filter(Boolean).join(':')
const KIT_DIR = '/home/user/dsh-plugins/dsh-agent-team/.worktrees/team-restart-017rc1/dev/agent-workflow/evidence/restart-017rc1/commit4'
const OUT = join(KIT_DIR, 'world-A', 'boot-2', 'browser-driver')
mkdirSync(OUT, { recursive: true })
const pw = createRequire('/home/user/dsh-plugins/dsh-agent-team/tests/deepseek-harness-test-use/package.json')('/home/user/dsh-plugins/dsh-agent-team/tests/deepseek-harness-test-use/node_modules/.pnpm/playwright@1.61.1/node_modules/playwright')

const hold = JSON.parse(readFileSync(join(KIT_DIR, 'world-A', 'boot-2', 'browser-hold.json'), 'utf8'))
const markerRaw = readFileSync(join(KIT_DIR, 'world-A', 'boot-2', 'boot-2-marker.txt'), 'utf8')
const markerUrl = (markerRaw.match(/https?:\/\/\S+/) ?? [])[0]
const log = (l) => console.error(`[explore] ${l}`)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const browser = await pw.chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
await page.goto(markerUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 })
await sleep(6000)
const dump = async (name) => {
  const text = await page.evaluate(() => document.body ? document.body.innerText : '(no body)')
  writeFileSync(join(OUT, `${name}.txt`), text)
  await page.screenshot({ path: join(OUT, `${name}.png`) }).catch(() => {})
  log(`${name}: ${text.length} chars`)
}
await dump('exp-00-landing')
// 0) dismiss the "Internal Testing Notice" modal if present (it overlays
//    the onboarding controls and intercepts pointer events)
const modalCont = page.locator('[role="dialog"] button, [role="presentation"] button, [class*="modal"] button, [class*="_root_"] button').filter({ hasText: /^Continue$/ }).first()
if (await modalCont.count().catch(() => 0)) {
  await modalCont.click({ timeout: 10_000 }).catch((e) => log('modal continue click failed: ' + e.message.slice(0, 120)))
  await sleep(2000)
  await dump('exp-00b-after-modal')
}
// open the workspace picker
const stamp = hold.dynamicRoot.slice(-19) // e.g. 2026-09-26T12-42-57
const homeDir = `rst017-c4-${stamp}-A`
const PATH_SEGMENTS = ['dsh-plugins', 'dsh-agent-team', 'tests', 'homes', homeDir, 'workspace']
const wsBtn = page.locator('button, [role="button"]').filter({ hasText: /Choose workspace/ }).first()
const clickNamed = async (name) => {
  return page.evaluate((n) => {
    const els = [...document.querySelectorAll('button, [role="button"], li')]
    const el = els.find((e) => (e.innerText || '').trim() === n && e.offsetParent !== null)
    if (!el) return 'not-found'
    el.click()
    return 'clicked'
  }, name)
}
if (await wsBtn.count()) {
  await wsBtn.click()
  await sleep(2000)
  await dump('exp-01-workspace-picker')
  for (const seg of PATH_SEGMENTS) {
    const r = await clickNamed(seg)
    log(`navigate ${seg}: ${r}`)
    if (r !== 'clicked') break
    await sleep(1200)
  }
  const openR = await clickNamed('Open')
  log(`click Open: ${openR}`)
  await sleep(2500)
} else {
  log('no "Choose workspace" button found')
}
await dump('exp-02-after-workspace')
const cont = page.locator('button, [role="button"]').filter({ hasText: /^Continue$/ }).first()
if (await cont.count()) {
  await cont.click()
  await sleep(8000)
}
await dump('exp-03-main')
// session list inventory on the main screen
const items = await page.evaluate((dynId) => {
  const out = []
  document.querySelectorAll('li, [role="button"], a, button, [class*="item"], [class*="session"]').forEach((el, i) => {
    const t = (el.innerText || '').trim().replace(/\s+/g, ' ')
    if (t && t.length < 400 && el.offsetParent !== null) out.push({ i, tag: el.tagName, text: t.slice(0, 150), html: el.outerHTML.slice(0, 400), dyn: el.outerHTML.includes(dynId) })
  })
  return out.slice(0, 300)
}, hold.dynamicRoot)
writeFileSync(join(OUT, 'exp-03-main-candidates.json'), JSON.stringify(items, null, 1))
log(`main screen candidates: ${items.length}`)
for (const c of items.slice(0, 40)) log(`  ${c.i} ${c.tag} dyn=${c.dyn} | ${c.text.slice(0, 90)}`)
await browser.close()
