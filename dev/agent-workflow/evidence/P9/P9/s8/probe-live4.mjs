// Probe v4: the decisive user-flow test on the LIVE instance.
// Fresh load -> open the team-bound root -> send the FIRST message ->
// does the 团队 tab (and the team view) appear? What team-remote calls flow?
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createRequire } from 'node:module'

const EV = 'D:/AgentDev/dsh-plugins/dsh-agent-team/dev/agent-workflow/evidence/P9/s8'
const state = JSON.parse(readFileSync(join(EV, 'state.json'), 'utf8'))
const requireFromWeb = createRequire(join('D:/AgentDev/dsh-plugins/dsh-agent-team/references/deepseek-harness-test-use', 'apps/web/package.json'))
const { chromium } = requireFromWeb('playwright')

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const calls = []
page.on('request', req => {
  const u = req.url()
  if (u.includes('/team-remote/')) {
    let method = '', param = ''
    try { const p = JSON.parse(req.postData()); method = p.method; param = JSON.stringify(p.payload?.params ?? {}).slice(0, 120) } catch { /* ignore */ }
    calls.push(`${method} ${param}`)
  }
})
await page.goto(`http://127.0.0.1:3180/?token=${state.token}`, { waitUntil: 'domcontentloaded', timeout: 60_000 })
await page.waitForSelector('button', { timeout: 60_000 })
const betaBtn = page.locator('button:has-text("继续")').first()
if (await betaBtn.isVisible().catch(() => false)) { await betaBtn.click() }
await page.waitForTimeout(6000)
const row = page.locator('[class*="sessionRow"]').first()
if (await row.count() > 0) { await row.click(); await page.waitForTimeout(4000) }
await page.screenshot({ path: join(EV, 'browser', 'probe4-01-before-message.png') })

// Type the first message in the composer and send.
const composer = page.locator('textarea, [contenteditable="true"]').last()
await composer.click()
await page.waitForTimeout(500)
if (await composer.evaluate((el) => el.tagName).catch(() => '') === 'TEXTAREA') {
  await composer.fill('团队启动问候：请确认团队已就绪。')
} else {
  await composer.type('团队启动问候：请确认团队已就绪。')
}
await page.screenshot({ path: join(EV, 'browser', 'probe4-02-typed.png') })
const sendBtn = page.locator('button[aria-label="发送消息"]').first()
await sendBtn.click()
console.log('message sent; waiting 20s for mock turn + render…')
await page.waitForTimeout(20_000)

const tabs = await page.evaluate(() => Array.from(document.querySelectorAll('[role="tab"]')).map(el => (el.textContent || '').trim().slice(0, 20)))
console.log('role=tab AFTER message:', JSON.stringify(tabs))
const dock = await page.evaluate(() => Array.from(document.querySelectorAll('[data-team-dock], [data-dock-title]')).map(el => ({ t: el.getAttribute('data-dock-title'), x: (el.textContent || '').trim().slice(0, 50) })))
console.log('DOCK:', JSON.stringify(dock))
await page.screenshot({ path: join(EV, 'browser', 'probe4-03-after-message.png') })

// If the 团队 tab is there, open it and inspect the team view.
const teamTab = page.getByRole('tab', { name: '团队' }).first()
if (await teamTab.count() > 0) {
  await teamTab.click()
  await page.waitForTimeout(4000)
  const teamView = await page.evaluate(() => ({
    members: document.querySelectorAll('[data-team-section="members"]').length,
    tasks: document.querySelectorAll('[data-team-section="tasks"]').length,
    text: (document.body.innerText || '').slice(0, 600),
  }))
  console.log('TEAM-VIEW:', JSON.stringify(teamView, null, 1).slice(0, 1200))
  await page.screenshot({ path: join(EV, 'browser', 'probe4-04-team-view.png') }
)
} else {
  console.log('NO 团队 tab after message')
}
console.log('CALLS:', JSON.stringify(calls, null, 1))
console.log('PROBE4 DONE')
await browser.close()
