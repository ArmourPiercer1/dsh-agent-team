// s8-sessionprobe2.mjs — dump the DOM first, then decide the click target.
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
await page.goto(launchUrl.href, { waitUntil: 'domcontentloaded', timeout: 60_000 })
await page.waitForTimeout(4000)

const census = await page.evaluate(() => {
  const buttons = [...document.querySelectorAll('button')].map((el) => ({
    aria: el.getAttribute('aria-label') || null,
    cls: (el.className || '').slice(0, 70),
    text: (el.textContent || '').trim().slice(0, 40),
    disabled: el.disabled || null,
  }))
  const editables = [...document.querySelectorAll('input, textarea, [contenteditable]')].map((el) => ({
    tag: el.tagName, type: el.type || null, placeholder: el.placeholder || null,
    ce: el.getAttribute('contenteditable') || null, cls: (el.className || '').slice(0, 70),
  }))
  const bodyText = (document.body?.innerText || '').slice(0, 1000)
  return { buttonCount: buttons.length, buttons, editables, bodyText, title: document.title, url: location.href }
})
console.log(JSON.stringify(census, null, 1).slice(0, 8000))

await page.screenshot({ path: join(EV, 'sessionprobe2-state.png') })
const html = await page.content()
writeFileSync(join(EV, 'sessionprobe2-state.html'), html)
console.log('html chars:', html.length)
await browser.close()
console.log('done')
