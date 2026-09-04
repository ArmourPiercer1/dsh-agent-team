// s8-domprobe.mjs — what does the zero-session GUI actually render?
// Captures: full DOM, title, element census, console events, page errors,
// failed requests, /api + /team-remote response bodies. No selector wait —
// fixed 20s settle, then dump.
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
const failedRequests = []
const apiBodies = []
page.on('console', (msg) => {
  consoleEvents.push({ type: msg.type(), text: msg.text().slice(0, 500) })
})
page.on('pageerror', (err) => {
  pageErrors.push(String(err).slice(0, 800))
})
page.on('requestfailed', (req) => {
  failedRequests.push({ url: req.url().slice(0, 300), failure: String(req.failure()?.errorText ?? req.failure()) })
})
page.on('response', async (res) => {
  const u = res.url()
  try {
    const up = new URL(u)
    if (up.pathname.startsWith('/api') || up.pathname.startsWith('/team-remote')) {
      let body = ''
      try { body = (await res.text()).slice(0, 800) } catch { body = '<unreadable>' }
      apiBodies.push({ method: res.request().method(), url: up.pathname, status: res.status(), body })
    }
  } catch { /* not a URL */ }
})

console.log('goto', state.origin)
const resp = await page.goto(launchUrl.href, { waitUntil: 'domcontentloaded', timeout: 60_000 })
console.log('initial:', resp?.status(), '->', page.url())
await page.waitForTimeout(20_000)

const html = await page.content()
writeFileSync(join(EV, 'domprobe-index.html'), html)
console.log('html chars:', html.length)

const census = await page.evaluate(() => {
  const all = [...document.querySelectorAll('*')]
  const byTag = {}
  for (const el of all) byTag[el.tagName] = (byTag[el.tagName] ?? 0) + 1
  const buttons = [...document.querySelectorAll('button')].map((b) => (b.textContent || '').trim().slice(0, 60))
  const tabs = [...document.querySelectorAll('[role="tab"]')].map((b) => (b.textContent || '').trim().slice(0, 60))
  const visibleText = (document.body?.innerText ?? '').slice(0, 2000)
  return {
    total: all.length,
    byTag,
    buttonCount: buttons.length,
    buttons: buttons.slice(0, 40),
    tabCount: tabs.length,
    tabs,
    title: document.title,
    visibleText,
  }
})
console.log('CENSUS=' + JSON.stringify(census, null, 1).slice(0, 6000))
console.log('CONSOLE=' + JSON.stringify(consoleEvents.slice(0, 40), null, 1).slice(0, 6000))
console.log('PAGEERRORS=' + JSON.stringify(pageErrors.slice(0, 20), null, 1).slice(0, 4000))
console.log('FAILED=' + JSON.stringify(failedRequests.slice(0, 20), null, 1).slice(0, 4000))
console.log('API=' + JSON.stringify(apiBodies.slice(0, 30), null, 1).slice(0, 8000))

await page.screenshot({ path: join(EV, 'domprobe-index.png'), fullPage: false })
await browser.close()
console.log('done')
