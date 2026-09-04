// s8-sessionprobe.mjs — what does the GUI show after clicking 新会话?
// Dumps: tag census, inputs/editables, role=tab/any, 团队 text presence,
// main-panel class census, screenshot + html.
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
page.on('console', (m) => consoleEvents.push({ type: m.type(), text: m.text().slice(0, 300) }))
page.on('pageerror', (e) => pageErrors.push(String(e).slice(0, 400)))

await page.goto(launchUrl.href, { waitUntil: 'domcontentloaded', timeout: 60_000 })
console.log('initial:', page.url())
await page.waitForTimeout(3000)

const beta = page.locator('button:has-text("继续")').first()
if (await beta.isVisible().catch(() => false)) {
  await beta.click()
  await page.waitForTimeout(1500)
  console.log('beta dismissed')
}

const newSession = page.locator('button[aria-label="新会话"]').first()
console.log('newSession buttons:', await newSession.count())
await newSession.click()
await page.waitForTimeout(4000)

const info = await page.evaluate(() => {
  const all = [...document.querySelectorAll('*')]
  const byTag = {}
  for (const el of all) byTag[el.tagName] = (byTag[el.tagName] ?? 0) + 1
  const inputs = [...document.querySelectorAll('input, textarea')].map((el) => ({ tag: el.tagName, type: el.type ?? null, placeholder: el.placeholder ?? null, cls: (el.className || '').slice(0, 60) }))
  const editables = [...document.querySelectorAll('[contenteditable]')].map((el) => ({ tag: el.tagName, editable: el.getAttribute('contenteditable'), cls: (el.className || '').slice(0, 60) }))
  const tabs = [...document.querySelectorAll('[role="tab"]')].map((el) => (el.textContent || '').trim().slice(0, 40))
  const teamText = [...all].filter((el) => el.children.length === 0 && (el.textContent || '').includes('团队')).map((el) => ({ tag: el.tagName, cls: (el.className || '').slice(0, 60), text: (el.textContent || '').trim().slice(0, 40) }))
  const bodyText = (document.body?.innerText || '').slice(0, 1200)
  return { byTag, inputs, editables, tabs, teamText, bodyText, url: location.href }
})
console.log(JSON.stringify(info, null, 1).slice(0, 7000))
console.log('CONSOLE_ERRORS=' + JSON.stringify(consoleEvents.filter((e) => e.type === 'error').slice(0, 10)))
console.log('PAGEERRORS=' + JSON.stringify(pageErrors.slice(0, 5)))

await page.screenshot({ path: join(EV, 'sessionprobe-after-newsession.png') })
const html = await page.content()
writeFileSync(join(EV, 'sessionprobe-after-newsession.html'), html)
console.log('html chars:', html.length)
await browser.close()
console.log('done')
