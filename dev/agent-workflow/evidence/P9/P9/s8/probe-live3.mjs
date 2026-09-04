// Probe v3: fresh load -> open the team-bound session -> does the TeamDock
// (data-team-dock / dock title with 运行中) render? + capture team-remote calls.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createRequire } from 'node:module'

const EV = 'D:/AgentDev/dsh-plugins/dsh-agent-team/dev/agent-workflow/evidence/P9/s8'
const state = JSON.parse(readFileSync(join(EV, 'state.json'), 'utf8'))
const requireFromWeb = createRequire(join('D:/AgentDev/dsh-plugins/dsh-agent-team/references/deepseek-harness-test-use', 'apps/web/package.json'))
const { chromium } = requireFromWeb('playwright')

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const teamRemoteCalls = []
page.on('request', req => {
  const u = req.url()
  if (u.includes('/team-remote/')) {
    const post = req.postData()
    let method = ''
    try { method = JSON.parse(post).method } catch { /* ignore */ }
    teamRemoteCalls.push({ method, url: u.split('/team-remote/')[1] })
  }
})
await page.goto(`http://127.0.0.1:3180/?token=${state.token}`, { waitUntil: 'domcontentloaded', timeout: 60_000 })
await page.waitForSelector('button', { timeout: 60_000 })
const betaBtn = page.locator('button:has-text("继续")').first()
if (await betaBtn.isVisible().catch(() => false)) { await betaBtn.click() }
await page.waitForTimeout(8000)
const row = page.locator('[class*="sessionRow"]').first()
console.log('rows before click:', await row.count())
if (await row.count() > 0) { await row.click(); await page.waitForTimeout(10000) }

const dock = await page.evaluate(() => {
  const els = Array.from(document.querySelectorAll('[data-team-dock], [data-dock-title], [data-team-dock=""]'))
  const anyDockish = Array.from(document.querySelectorAll('[class*="dock" i]')).slice(0, 6)
  return {
    dataTeamDock: els.map(el => ({ attr: el.getAttribute('data-team-dock'), title: el.getAttribute('data-dock-title'), text: (el.textContent || '').trim().slice(0, 40) })),
    classDock: anyDockish.map(el => ({ cls: String(el.className).slice(0, 60), text: (el.textContent || '').trim().slice(0, 40) })),
  }
})
console.log('DOCK:', JSON.stringify(dock, null, 1))
const tabs = await page.evaluate(() => Array.from(document.querySelectorAll('[role="tab"]')).map(el => (el.textContent || '').trim().slice(0, 20)))
console.log('role=tab:', JSON.stringify(tabs))
console.log('TEAM-REMOTE CALLS:', JSON.stringify(teamRemoteCalls, null, 1))
await page.screenshot({ path: join(EV, 'browser', 'probe-live3-dock.png') })
console.log('PROBE3 DONE')
await browser.close()
