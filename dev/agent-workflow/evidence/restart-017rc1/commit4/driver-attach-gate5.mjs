#!/usr/bin/env node
/**
 * Run-6 gold-standard completion driver (attach path).
 *
 * Context: the takeover already happened in-run (probe: agent/created after
 * the UI "Open in Team mode" click, no dispose). The page that experienced
 * the veto is stuck in the failed-resume client state (0.1.7 UI finding —
 * 04a/04b dumps; re-clicking the already-selected row is a no-op). This
 * driver opens a FRESH page (never a reload), attaches to the taken-over
 * session (a live attach — zero new activation events), and runs the
 * gate-5 prompt through the enabled composer. The kit auto-releases its
 * hold when the prompt reaches the mock model.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const __dirname = dirname(fileURLToPath(import.meta.url))
const KIT_DIR = __dirname
const OUT = join(KIT_DIR, 'world-A', 'boot-2', 'browser-driver')
mkdirSync(OUT, { recursive: true })

process.env.PLAYWRIGHT_BROWSERS_PATH = '/home/user/dsh-plugins/dsh-agent-team/tests/homes/.browsers'
process.env.LD_LIBRARY_PATH = ['/home/user/dsh-plugins/dsh-agent-team/tests/homes/.browser-libs/extract/usr/lib/x86_64-linux-gnu', process.env.LD_LIBRARY_PATH].filter(Boolean).join(':')

const require = createRequire('/home/user/dsh-plugins/dsh-agent-team/tests/deepseek-harness-test-use/package.json')
const pw = require('/home/user/dsh-plugins/dsh-agent-team/tests/deepseek-harness-test-use/node_modules/.pnpm/playwright@1.61.1/node_modules/playwright')

const hold = JSON.parse(readFileSync(join(KIT_DIR, 'world-A', 'boot-2', 'browser-hold.json'), 'utf8'))
const markerRaw = readFileSync(join(KIT_DIR, 'world-A', 'boot-2', 'boot-2-marker.txt'), 'utf8')
const markerUrl = (markerRaw.match(/https?:\/\/\S+/) ?? [])[0] ?? markerRaw.trim()
const log = (l) => console.error(`[attach] ${l}`)
const dump = async (page, name) => {
  const text = await page.evaluate(() => document.body ? document.body.innerText : '(no body)')
  writeFileSync(join(OUT, `${name}.txt`), text)
  await page.screenshot({ path: join(OUT, `${name}.png`) }).catch(() => {})
  log(`${name}: text ${text.length} chars`)
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

log(`gui=${hold.gui} dynamicRoot=${hold.dynamicRoot}`)
const browser = await pw.chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
page.on('console', (m) => { if (m.type() === 'error') log(`page console error: ${m.text().slice(0, 200)}`) })

try {
  await page.goto(markerUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 })
  await sleep(9000)
  // onboarding may be present (fresh page, but the home has a workspace
  // selected from the main driver's pass — if not, complete it here)
  let text = await page.evaluate(() => document.body ? document.body.innerText : '')
  if (text.includes('Internal Testing') || text.includes('Continue')) {
    const cont = page.locator('[role="dialog"] button, [class*="modal"] button').filter({ hasText: /^Continue$/ }).first()
    await cont.click({ timeout: 15_000 })
    await sleep(3000)
    text = await page.evaluate(() => document.body ? document.body.innerText : '')
  }
  if (text.includes('Choose workspace')) {
    log('onboarding present — completing via picker')
    const cw = page.locator('button, [role="button"]').filter({ hasText: /Choose workspace/ }).first()
    await cw.click({ timeout: 15_000 })
    await sleep(2500)
    const mat = JSON.parse(readFileSync(join(KIT_DIR, 'world-A', 'world', 'materialized.json'), 'utf8'))
    const homeDir = mat.home.split('/').filter(Boolean).pop()
    const clickNamed = async (name, timeoutMs = 8000) => {
      const deadline = Date.now() + timeoutMs
      for (;;) {
        const res = await page.evaluate((n) => {
          const els = [...document.querySelectorAll('button, [role="button"], li, a')]
          const hit = els.find((el) => (el.innerText || '').trim() === n && el.offsetParent !== null)
          if (!hit) return 'absent'
          hit.scrollIntoView({ block: 'center' }); hit.click(); return 'clicked'
        }, name)
        if (res === 'clicked') return 'clicked'
        if (Date.now() > deadline) return 'absent'
        await sleep(400)
      }
    }
    for (const seg of ['dsh-plugins', 'dsh-agent-team', 'tests', 'homes', homeDir, 'workspace']) {
      const r = await clickNamed(seg)
      log(`picker seg "${seg}" → ${r}`)
      if (r === 'absent') { await dump(page, 'attach-dialog-stuck'); process.exit(7) }
      await sleep(1500)
    }
    const open = await clickNamed('Open')
    if (open === 'absent') { await dump(page, 'attach-dialog-no-open'); process.exit(8) }
    await sleep(8000)
  }
  await dump(page, 'attach-01-landing')

  // Attach to the taken-over dyn session: expand the Ungrouped bucket if
  // needed, then click the row. A live attach must produce NO new
  // activation events (verified afterwards via the probe timeline).
  const dynId = hold.dynamicRoot
  const clickRow = async () => page.evaluate((id) => {
    const cands = [...document.querySelectorAll('li, [role="button"], a, button, [class*=item], [class*=session]')]
      .filter((el) => el.offsetParent !== null && (el.innerText || '').length < 400 && el.outerHTML.includes(id))
    if (cands.length === 0) return 'no-candidate'
    cands.sort((a, b) => a.outerHTML.length - b.outerHTML.length)
    cands[0].scrollIntoView({ block: 'center' })
    cands[0].click()
    return `clicked-${cands.length}`
  }, dynId)
  let res = await clickRow()
  if (res === 'no-candidate') {
    // expand the collapsed Ungrouped bucket
    await page.evaluate(() => {
      const spans = [...document.querySelectorAll('span, div')]
      const leaf = spans.find((el) => (el.innerText || '').trim() === 'Ungrouped' && el.offsetParent !== null)
      if (!leaf) return 'no-bucket'
      let node = leaf
      for (let i = 0; i < 6 && node; i += 1) {
        if (node.tagName === 'BUTTON' || /row/i.test(node.className || '')) break
        node = node.parentElement
      }
      if (node) { node.scrollIntoView({ block: 'center' }); node.click(); return 'clicked' }
      return 'no-row'
    })
    await sleep(3000)
    res = await clickRow()
  }
  log(`row click → ${res}`)
  await sleep(9000)
  await dump(page, 'attach-02-after-open')
  const unavailable = await page.evaluate(() => (document.body.innerText || '').includes('Session unavailable'))
  log(`post-attach "Session unavailable" present = ${unavailable}`)
  if (unavailable) { log('attach page still shows the unavailable composer — dumping and stopping'); process.exit(11) }

  // Composer (Chat tab is the default view) → type + send the gate-5 prompt.
  const ta = page.locator('textarea:visible').last()
  const ce = page.locator('[contenteditable="true"]:visible').last()
  const useTa = await ta.count().catch(() => 0) > 0
  const target = useTa ? ta : ce
  if ((useTa ? 1 : await ce.count().catch(() => 0)) === 0) { log('NO composer found'); await dump(page, 'attach-no-composer'); process.exit(6) }
  log(`composer = ${useTa ? 'textarea' : 'contenteditable'} — typing gate-5 prompt (fresh page, never reloaded)`)
  await target.click({ timeout: 15_000 })
  await sleep(300)
  if (useTa) { await target.fill(hold.gate5Prompt) } else { await target.fill(hold.gate5Prompt).catch(async () => { await target.type(hold.gate5Prompt) }) }
  await sleep(500)
  await page.screenshot({ path: join(OUT, 'attach-03-typed.png') }).catch(() => {})
  const sendAria = page.locator('button[aria-label="Send message"]:not([disabled])').last()
  if (await sendAria.count().catch(() => 0) > 0) { await sendAria.click().catch(() => {}); log('sent via Send-message button') }
  else {
    const sendBtn = page.locator('button').filter({ hasText: /^(发送|Send)$/ }).first()
    if (await sendBtn.count().catch(() => 0) > 0) { await sendBtn.click().catch(() => {}); log('sent via send button') }
    else { await target.press('Enter'); log('sent via Enter') }
  }
  await sleep(45_000) // leader turn (run-5: 27s) + UI render
  await dump(page, 'attach-04-gate5-answer')
  log('DONE — the kit auto-releases its hold when the gate-5 request is observed')
} finally {
  await browser.close().catch(() => {})
}
