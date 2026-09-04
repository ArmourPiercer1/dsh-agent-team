// s8-wsmenuprobe.mjs — click 选择工作区 and dump what appears (menu/listbox/portal).
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const EV = dirname(fileURLToPath(import.meta.url))
const require = createRequire(join(EV, '..', '..', '..', '..', '..', 'references', 'deepseek-harness-test-use', 'apps', 'web', 'package.json'))
const { chromium } = require('playwright')

const state = JSON.parse(readFileSync(join(EV, 'state.json'), 'utf8'))
const launchUrl = new URL(state.origin)
launchUrl.searchParams.set('token', state.token)

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const consoleEvents = []
const pageErrors = []
page.on('console', (m) => { if (m.type() === 'error') consoleEvents.push(m.text().slice(0, 300)) })
page.on('pageerror', (e) => pageErrors.push(String(e).slice(0, 300)))

await page.goto(launchUrl.href, { waitUntil: 'domcontentloaded', timeout: 60_000 })
await page.waitForTimeout(3000)

const beta = page.locator('button:has-text("继续")').first()
if (await beta.isVisible().catch(() => false)) {
  await beta.click()
  await page.waitForTimeout(1500)
  console.log('beta dismissed')
}

const wsBtn = page.locator('button[aria-label="选择工作区"]').first()
console.log('ws button:', await wsBtn.count(), 'enabled:', await wsBtn.isEnabled().catch(() => false))
await wsBtn.click()
await page.waitForTimeout(2500)

const census = await page.evaluate(() => {
  const menus = [...document.querySelectorAll('[role="menu"], [role="listbox"], [role="dialog"], [role="menuitem"], [role="option"]')].map((el) => ({
    role: el.getAttribute('role'), tag: el.tagName, cls: (el.className || '').slice(0, 60),
    text: (el.textContent || '').trim().slice(0, 120),
  }))
  const addWs = [...document.querySelectorAll('body *')].filter((el) => el.children.length === 0 && (el.textContent || '').includes('工作区')).map((el) => ({ tag: el.tagName, cls: (el.className || '').slice(0, 60), text: (el.textContent || '').trim().slice(0, 60) }))
  const bodyText = (document.body?.innerText || '').slice(0, 1200)
  return { menus, addWs, bodyText }
})
console.log(JSON.stringify(census, null, 1).slice(0, 7000))
console.log('CONSOLE_ERRORS=' + JSON.stringify(consoleEvents.slice(0, 8)))
console.log('PAGEERRORS=' + JSON.stringify(pageErrors.slice(0, 5)))

await page.screenshot({ path: join(EV, 'wsmenuprobe.png') })
const html = await page.content()
writeFileSync(join(EV, 'wsmenuprobe.html'), html)
console.log('html chars:', html.length)
await browser.close()
console.log('done')
