// 401 probe: what exactly does Chromium send, and what does the server answer?
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const EV = dirname(fileURLToPath(import.meta.url))
const require = createRequire(join(EV, '..', '..', '..', '..', '..', 'references', 'deepseek-harness-test-use', 'apps', 'web', 'package.json'))
const { chromium } = require('playwright')

const state = JSON.parse(readFileSync(join(EV, 'state.json'), 'utf8'))
const u = new URL(state.origin)
u.searchParams.set('token', state.token)
const target = u.href

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage()
const seen = []
page.on('request', (req) => {
  const h = req.headers()
  seen.push({ phase: 'request', url: req.url().slice(0, 120), method: req.method(), host: h['host'] ?? null, ua: (h['user-agent'] ?? '').slice(0, 60) })
})
page.on('response', async (res) => {
  let body = ''
  try { body = (await res.text()).slice(0, 300) } catch { body = '<unreadable>' }
  seen.push({ phase: 'response', url: res.url().slice(0, 120), status: res.status(), body })
})
const resp = await page.goto(target, { waitUntil: 'domcontentloaded', timeout: 30_000 }).catch((e) => ({ error: String(e) }))
console.log('goto result:', resp ? resp.status() : resp)
await page.waitForTimeout(1500)
console.log(JSON.stringify(seen, null, 2))

// Control: fetch the same URL from the browser context via page.evaluate.
if (resp && resp.status()) {
  const inPage = await page.evaluate(async (href) => {
    const r = await fetch(href)
    const t = await r.text()
    return { status: r.status, body: t.slice(0, 200) }
  }, target)
  console.log('in-page fetch of same URL:', JSON.stringify(inPage))
}
await browser.close()
