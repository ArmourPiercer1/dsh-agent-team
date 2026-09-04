// Probe v6 (handoff smoke, clean world): load the page, dismiss the first-run
// notice, verify the R118 global 新建团队 entry is visible WITHOUT adopting a
// workspace (the user does first-run themselves). No world mutation.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createRequire } from 'node:module'

const EV = 'D:/AgentDev/dsh-plugins/dsh-agent-team/dev/agent-workflow/evidence/P9/s8'
const state = JSON.parse(readFileSync(join(EV, 'state.json'), 'utf8'))
const requireFromWeb = createRequire(join('D:/AgentDev/dsh-plugins/dsh-agent-team/references/deepseek-harness-test-use', 'apps/web/package.json'))
const { chromium } = requireFromWeb('playwright')

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const launchUrl = new URL(`http://127.0.0.1:${state.port}/`)
launchUrl.searchParams.set('token', state.token)
await page.goto(launchUrl.href, { waitUntil: 'domcontentloaded', timeout: 60_000 })
await page.waitForSelector('button', { timeout: 60_000 })
const betaBtn = page.locator('button:has-text("继续")').first()
const firstRun = await betaBtn.isVisible().catch(() => false)
if (firstRun) { await betaBtn.click(); await page.waitForTimeout(1500) }
await page.waitForTimeout(2500)

const entry = page.locator('button[aria-label="新建团队"]').first()
const entryVisible = await entry.isVisible().catch(() => false)
console.log('first-run-notice:', firstRun)
console.log('R118 entry visible (clean world, no workspace adopted):', entryVisible)
const composerInert = await page.getByText('选择一个工作区开始').first().isVisible().catch(() => false)
console.log('composer inert (workspace not yet adopted):', composerInert)
await page.screenshot({ path: join(EV, 'browser', 'handoff-smoke-clean.png') })
await browser.close()
console.log('SMOKE DONE', entryVisible ? 'OK' : 'FAIL')
