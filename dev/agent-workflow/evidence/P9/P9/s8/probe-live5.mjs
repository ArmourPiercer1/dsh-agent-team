// Probe v5: diagnose the workspace-section session-row count logic against
// the live world (after gentry run 2: workspace-s8v has 3 sessions, all with
// history). Replicates the gentry countWsSessions evaluate and prints every
// intermediate step.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createRequire } from 'node:module'

const EV = 'D:/AgentDev/dsh-plugins/dsh-agent-team/dev/agent-workflow/evidence/P9/s8'
const state = JSON.parse(readFileSync(join(EV, 'state.json'), 'utf8'))
const requireFromWeb = createRequire(join('D:/AgentDev/dsh-plugins/dsh-agent-team/references/deepseek-harness-test-use', 'apps/web/package.json'))
const { chromium } = requireFromWeb('playwright')

const wsTitle = state.workspaceDir.split(/[\\/]/).filter(Boolean).pop()
console.log('wsTitle:', JSON.stringify(wsTitle))

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const launchUrl = new URL(`http://127.0.0.1:${state.port}/`)
launchUrl.searchParams.set('token', state.token)
await page.goto(launchUrl.href, { waitUntil: 'domcontentloaded', timeout: 60_000 })
await page.waitForSelector('button', { timeout: 60_000 })
const betaBtn = page.locator('button:has-text("继续")').first()
if (await betaBtn.isVisible().catch(() => false)) { await betaBtn.click(); await page.waitForTimeout(1000) }
await page.waitForTimeout(5000)

const diag = await page.evaluate((title) => {
  const out = { titleSpans: 0, sampleSpans: [], treeitems: 0, sampleTreeitems: [] }
  const spans = Array.from(document.querySelectorAll('span'))
  const matches = spans.filter((el) => el.textContent.trim() === title)
  out.titleSpans = matches.length
  out.sampleSpans = matches.slice(0, 5).map((el) => {
    const cls = String(el.className).slice(0, 80)
    const parent = el.parentElement ? String(el.parentElement.className).slice(0, 80) : null
    const closestRow = el.closest('[role="treeitem"]')
    return {
      cls, parent,
      closestRow: closestRow ? String(closestRow.className).slice(0, 80) : null,
      closestRowParent: closestRow && closestRow.parentElement ? String(closestRow.parentElement.className).slice(0, 80) : null,
      grandparentChain: (() => { let n = el; const chain = []; for (let i = 0; i < 8 && n; i++) { chain.push(String(n.tagName) + '.' + String(n.className).slice(0, 40)); n = n.parentElement } return chain })(),
    }
  })
  const items = Array.from(document.querySelectorAll('[role="treeitem"]'))
  out.treeitems = items.length
  out.sampleTreeitems = items.map((el) => ({
    cls: String(el.className).slice(0, 80),
    text: el.textContent.trim().slice(0, 50),
    ariaSelected: el.getAttribute('aria-selected'),
  }))
  // The full replicated count:
  for (const t of matches) {
    const row = t.closest('[role="treeitem"]')
    const section = row && row.parentElement
    if (!row || !section) { out.countResult = { found: false, why: 'no row/section' }; return out }
    const rows = Array.from(section.querySelectorAll('[role="treeitem"]')).filter((el) => el !== row)
    out.countResult = { found: true, n: rows.length, sectionCls: String(section.className).slice(0, 60), texts: rows.map((el) => el.textContent.trim().slice(0, 40)) }
    break
  }
  return out
}, wsTitle)
console.log(JSON.stringify(diag, null, 1))

// Also: what does the whole sidebar section subtree look like?
const sectionDump = await page.evaluate((title) => {
  const spans = Array.from(document.querySelectorAll('span')).filter((el) => el.textContent.trim() === title)
  for (const t of spans) {
    const row = t.closest('[role="treeitem"]')
    const section = row && row.parentElement
    if (section) return section.outerHTML.slice(0, 3000)
  }
  return null
}, wsTitle)
console.log('===SECTION HTML (3000)===')
console.log(sectionDump)

await page.screenshot({ path: join(EV, 'browser', 'probe5-sidebar.png') })
await browser.close()
console.log('PROBE5 DONE')
