// Probe v2: longer settle, explicit session-row click, team-tab + pill check.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createRequire } from 'node:module'

const EV = 'D:/AgentDev/dsh-plugins/dsh-agent-team/dev/agent-workflow/evidence/P9/s8'
const state = JSON.parse(readFileSync(join(EV, 'state.json'), 'utf8'))
const requireFromWeb = createRequire(join('D:/AgentDev/dsh-plugins/dsh-agent-team/references/deepseek-harness-test-use', 'apps/web/package.json'))
const { chromium } = requireFromWeb('playwright')

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
page.on('console', msg => { if (msg.type() === 'error') console.log('CONSOLE-ERR:', msg.text().slice(0, 200)) })
await page.goto(`http://127.0.0.1:3180/?token=${state.token}`, { waitUntil: 'domcontentloaded', timeout: 60_000 })
await page.waitForSelector('button', { timeout: 60_000 })
const betaBtn = page.locator('button:has-text("继续")').first()
if (await betaBtn.isVisible().catch(() => false)) { await betaBtn.click() }
console.log('settling 12s for mirror + projection…')
await page.waitForTimeout(12_000)

const rowInfo = await page.evaluate(() => {
  const row = document.querySelector('[class*="sessionRow"]')
  return row ? { cls: row.className, text: (row.textContent || '').trim(), attrs: Array.from(row.attributes).map(a => `${a.name}=${a.value}`) } : null
})
console.log('SESSION-ROW:', JSON.stringify(rowInfo))

// Click the session row explicitly (it is a DIV, not a button).
const row = page.locator('[class*="sessionRow"]').first()
if (await row.count() > 0) {
  await row.click()
  await page.waitForTimeout(4000)
  console.log('clicked session row, settled 4s')
}

const tabs = await page.evaluate(() => Array.from(document.querySelectorAll('[role="tab"]')).map(el => (el.textContent || '').trim().slice(0, 30)))
console.log('role=tab:', JSON.stringify(tabs))
const pill = await page.evaluate(() => {
  const els = Array.from(document.querySelectorAll('button, [role="button"], div, span'))
    .filter(el => { const t = (el.textContent || ''); return t.includes('运行中') && t.length < 60 })
  return els.slice(0, 4).map(el => ({ tag: el.tagName, text: (el.textContent || '').trim(), cls: String(el.className).slice(0, 70) }))
})
console.log('PILL:', JSON.stringify(pill, null, 1))
const dataIntent = await page.evaluate(() => Array.from(document.querySelectorAll('[data-intent-start-here], [data-team-dock], [data-dock-title]')).map(el => el.getAttribute('data-intent-start-here') !== null ? 'start-here' : el.getAttribute('data-team-dock') !== null ? 'dock' : 'dock-title'))
console.log('TEAM-ELTS:', JSON.stringify(dataIntent))
await page.screenshot({ path: join(EV, 'browser', 'probe-live2-opened.png') })
console.log('PROBE2 DONE')
await browser.close()
