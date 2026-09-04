// One-shot live probe: open the current world's session(s) and report what the
// conversation view renders (team tab? zero-state? team header?).
// Usage: node probe-live.mjs  (reads token/workspace from s8/state.json)
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createRequire } from 'node:module'

const EV = 'D:/AgentDev/dsh-plugins/dsh-agent-team/dev/agent-workflow/evidence/P9/s8'
const state = JSON.parse(readFileSync(join(EV, 'state.json'), 'utf8'))
const requireFromWeb = createRequire(join('D:/AgentDev/dsh-plugins/dsh-agent-team/references/deepseek-harness-test-use', 'apps/web/package.json'))
const pw = requireFromWeb('playwright')
const { chromium } = pw

const browser = await pw.chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const launchUrl = `http://127.0.0.1:3180/?token=${state.token}`
await page.goto(launchUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 })
await page.waitForSelector('button', { timeout: 60_000 })
const betaBtn = page.locator('button:has-text("继续")').first()
if (await betaBtn.isVisible().catch(() => false)) { await betaBtn.click(); await page.waitForTimeout(1000) }
await page.waitForTimeout(2000)

// Enumerate sidebar session items.
const sessionItems = await page.evaluate(() => {
  const items = Array.from(document.querySelectorAll('aside li, aside [role="listitem"], .sidebar [data-session-id], [class*="session"]'))
  return items.slice(0, 40).map(el => ({ tag: el.tagName, cls: String(el.className).slice(0, 80), text: (el.textContent || '').slice(0, 40), dataSessionId: el.getAttribute('data-session-id') }))
})
console.log('SIDEBAR-ITEMS:', JSON.stringify(sessionItems, null, 1).slice(0, 2500))

// Click each sidebar session-like row (text 新会话 / any row under 未分组).
const rows = page.locator('aside li, aside button, aside [role="button"]').filter({ hasText: '新会话' })
const nRows = await rows.count()
console.log('session-rows-found:', nRows)
if (nRows > 0) {
  await rows.first().click()
  await page.waitForTimeout(2500)
}
const tabs = await page.evaluate(() => Array.from(document.querySelectorAll('[role="tab"]')).map(el => (el.textContent || '').trim().slice(0, 30)))
console.log('role=tab after open:', JSON.stringify(tabs))
const teamText = await page.locator('text=团队').count()
console.log('team-text-count:', teamText)
const headerTeam = await page.evaluate(() => {
  const els = Array.from(document.querySelectorAll('button, div, span')).filter(el => (el.textContent || '').includes('运行中') && (el.textContent || '').length < 60)
  return els.slice(0, 5).map(el => ({ tag: el.tagName, text: (el.textContent || '').trim().slice(0, 50), cls: String(el.className).slice(0, 60) }))
})
console.log('running-header-els:', JSON.stringify(headerTeam, null, 1))
await page.screenshot({ path: join(EV, 'browser', 'probe-live-opened.png') })
const main = await page.evaluate(() => document.body.innerText.slice(0, 800))
console.log('MAIN-TEXT:\n' + main)
await browser.close()
console.log('PROBE DONE')
