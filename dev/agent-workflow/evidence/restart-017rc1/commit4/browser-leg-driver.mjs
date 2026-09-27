#!/usr/bin/env node
/**
 * browser-leg-driver.mjs — the OPERATOR for the World A BROWSER gold-standard
 * gate-5 (run ONLY while the kit is in its --browser-hold wait at boot 2).
 *
 * Reads commit4/world-A/boot-2/browser-hold.json (written by the kit at hold
 * start: gui origin, dynamicRoot, gate5Prompt, kitPid) + the boot-2 marker
 * URL file, drives a headless chromium (playwright, locally extracted libs)
 * through the UI flow, and dumps text + screenshots at every step so the
 * operator can verify/adapt:
 *
 *   1. open the marker URL (app root with token)          → 01-landing
 *   1.5 complete onboarding if present (IDEMPOTENT — a fresh home shows
 *       the "Internal Testing Notice" modal + "Into the Unknown" onboarding;
 *       the workspace must be the home's <home>/workspace). Dismiss modal →
 *       "Choose workspace" file dialog → navigate dsh-plugins/dsh-agent-team/
 *       tests/homes/<home>/workspace → Open. (A pre-takeover reload here is
 *       fine; the no-reload requirement starts AFTER the Team takeover.)
 *   2. open the cold dynamic session in the session list  → 02-after-open
 *      (the background ordinary promote is vetoed by the production fence —
 *      the error lane "会话不可用" is what we screenshot; if the list does
 *      not yet contain the session, ONE pre-takeover reload refreshes it)
 *   3. click 以 Team 模式打开 (Team-mode takeover)          → 03-team-open
 *   4. WITHOUT reloading: type the gate-5 prompt into the
 *      composer and send it → leader answer              → 04-gate5-answer
 *
 * After the driver finishes (or the operator gives up), send SIGTERM to the
 * kit (via job_kill of the kit's background job; the kitPid in
 * browser-hold.json is the PID inside the job's namespace) — the kit then
 * collects probe events + runs its own checks.
 *
 * Usage: node browser-leg-driver.mjs [--only step1,step15,step2,...]
 * All artifacts → commit4/world-A/boot-2/browser-driver/
 */
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { createRequire } from 'node:module'

// Self-contained browser env (locally extracted, no sudo): the headless
// shell lives in tests/homes/.browsers and its runtime libs in the
// dpkg-deb-extracted tree (apt-get download + dpkg-deb -x; the system
// dir is read-only for this sandbox).
process.env.PLAYWRIGHT_BROWSERS_PATH ??= '/home/user/dsh-plugins/dsh-agent-team/tests/homes/.browsers'
process.env.LD_LIBRARY_PATH = ['/home/user/dsh-plugins/dsh-agent-team/tests/homes/.browser-libs/extract/usr/lib/x86_64-linux-gnu', process.env.LD_LIBRARY_PATH].filter(Boolean).join(':')

const KIT_DIR = '/home/user/dsh-plugins/dsh-agent-team/.worktrees/team-restart-017rc1/dev/agent-workflow/evidence/restart-017rc1/commit4'
const OUT = join(KIT_DIR, 'world-A', 'boot-2', 'browser-driver')
mkdirSync(OUT, { recursive: true })

const require = createRequire('/home/user/dsh-plugins/dsh-agent-team/tests/deepseek-harness-test-use/package.json')
const pw = require('/home/user/dsh-plugins/dsh-agent-team/tests/deepseek-harness-test-use/node_modules/.pnpm/playwright@1.61.1/node_modules/playwright')

const hold = JSON.parse(readFileSync(join(KIT_DIR, 'world-A', 'boot-2', 'browser-hold.json'), 'utf8'))
const markerRaw = readFileSync(join(KIT_DIR, 'world-A', 'boot-2', 'boot-2-marker.txt'), 'utf8')
const markerUrl = (markerRaw.match(/https?:\/\/\S+/) ?? [])[0] ?? markerRaw.trim()
if (!/^https?:\/\//.test(markerUrl)) { console.error(`[driver] no URL in marker file: ${markerRaw.slice(0, 120)}`); process.exit(1) }
console.error(`[driver] gui=${hold.gui} dynamicRoot=${hold.dynamicRoot} kitPid=${hold.kitPid}`)
console.error(`[driver] markerUrl=${markerUrl}`)

const log = (line) => console.error(`[driver] ${line}`)
const dump = async (page, name) => {
  const text = await page.evaluate(() => document.body ? document.body.innerText : '(no body)')
  writeFileSync(join(OUT, `${name}.txt`), text)
  await page.screenshot({ path: join(OUT, `${name}.png`), fullPage: false }).catch(() => {})
  log(`${name}: text ${text.length} chars → ${name}.txt/.png`)
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const argList = process.argv.slice(2)
const onlyIdx = argList.indexOf('--only')
const only = (onlyIdx >= 0 ? argList[onlyIdx + 1] : (argList.find((a) => !a.startsWith('--')) || '')).split(',').map((s) => s.trim()).filter(Boolean)
const run = (s) => only.length === 0 || only.includes(s)

// The home directory name comes from the kit's materialized.json (the
// home path's basename). Deriving it from the dynamic root's stamp is NOT
// reliable: home materialization can land one second after the run stamp
// (run 6: stamp 13-21-00, home 13-21-01-A). Fallback keeps the old
// convention for runs whose materialized.json is absent.
let homeDir = `rst017-c4-${hold.dynamicRoot.slice(-19)}-A`
try {
  const matRaw = readFileSync(join(KIT_DIR, 'world-A', 'world', 'materialized.json'), 'utf8')
  const mat = JSON.parse(matRaw)
  if (typeof mat?.home === 'string' && mat.home.length > 0) {
    homeDir = mat.home.split('/').filter(Boolean).pop()
  }
} catch { /* fallback keeps the derived name */ }
// File-dialog navigation from /home/user to the home's workspace.
const PATH_SEGMENTS = ['dsh-plugins', 'dsh-agent-team', 'tests', 'homes', homeDir, 'workspace']

const browser = await pw.chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
page.on('console', (m) => { if (m.type() === 'error') log(`page console error: ${m.text().slice(0, 200)}`) })
const errors = []
page.on('pageerror', (e) => errors.push(String(e).slice(0, 300)))

// Click a dialog entry by EXACT innerText (server-side file dialog renders
// each entry as a button with the entry name as its full text).
const clickNamed = async (name, timeoutMs = 8000) => {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    const res = await page.evaluate((n) => {
      const els = [...document.querySelectorAll('button, [role="button"], li, a')]
      const hit = els.find((el) => (el.innerText || '').trim() === n && el.offsetParent !== null)
      if (!hit) return 'absent'
      hit.scrollIntoView({ block: 'center' })
      hit.click()
      return 'clicked'
    }, name)
    if (res === 'clicked') return 'clicked'
    if (Date.now() > deadline) return 'absent'
    await sleep(400)
  }
}

try {
  // ── step 1: landing ────────────────────────────────────────────────────
  if (run('step1')) {
    log('step1: goto marker url')
    await page.goto(markerUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 })
    await sleep(8000) // let the app boot + session list load
    await dump(page, '01-landing')
  }

  // ── step 1.5: complete onboarding if present (idempotent) ──────────────
  if (run('step15')) {
    const bodyText = () => page.evaluate(() => document.body ? document.body.innerText : '')
    let text = await bodyText()
    if (text.includes('Internal Testing') || text.includes('Continue')) {
      log('step15: notice modal present — dismissing (Continue)')
      const cont = page.locator('[role="dialog"] button, [role="presentation"] button, [class*="modal"] button, [class*="_root_"] button').filter({ hasText: /^Continue$/ }).first()
      await cont.click({ timeout: 15_000 })
      await sleep(3000)
      text = await bodyText()
      await dump(page, '01b-modal-dismissed')
    } else {
      log('step15: no notice modal')
    }
    if (text.includes('Choose workspace')) {
      log(`step15: onboarding present — opening workspace picker (target ${homeDir}/workspace)`)
      const cw = page.locator('button, [role="button"]').filter({ hasText: /Choose workspace/ }).first()
      await cw.click({ timeout: 15_000 })
      await sleep(2500)
      for (const seg of PATH_SEGMENTS) {
        const r = await clickNamed(seg)
        log(`step15: dialog seg "${seg}" → ${r}`)
        if (r === 'absent') { await dump(page, '01c-dialog-stuck'); process.exit(7) }
        await sleep(1500)
      }
      const open = await clickNamed('Open')
      log(`step15: dialog Open → ${open}`)
      if (open === 'absent') { await dump(page, '01c-dialog-no-open'); process.exit(8) }
      await sleep(8000)
      await dump(page, '01d-main-screen')
    } else if (text.includes('New Team') && /Describe what you want to build/.test(text)) {
      log('step15: main screen already present (onboarding done in a previous pass) — skipping')
    } else {
      log(`step15: UNKNOWN screen state — dumping (head: ${text.slice(0, 160).replace(/\n/g, ' | ')})`)
      await dump(page, '01c-unknown-state')
      process.exit(9)
    }
  }

  // ── step 2: open the cold dynamic session ──────────────────────────────
  if (run('step2')) {
    const inventory = async (tag) => {
      const items = await page.evaluate((dynId) => {
        const out = []
        const cands = document.querySelectorAll('li, [role="button"], a, button, [class*="item"], [class*="session"]')
        cands.forEach((el, i) => {
          const t = (el.innerText || '').trim().replace(/\s+/g, ' ')
          if (t && t.length < 400 && el.offsetParent !== null) out.push({ i, tag: el.tagName, cls: String(el.className).slice(0, 100), text: t.slice(0, 150), html: el.outerHTML.slice(0, 400), dyn: el.outerHTML.includes(dynId) })
        })
        return out.slice(0, 300)
      }, hold.dynamicRoot)
      writeFileSync(join(OUT, `${tag}-candidates.json`), JSON.stringify(items, null, 1))
      log(`${tag}: ${items.length} candidate elements inventoried`)
      return items
    }
    let items = await inventory('step2')
    // Ranked selection: (a) full session id anywhere in the element,
    // (b) the session's durable title, (c) the MK_DONE token (the dyn
    // leader's acknowledgement in the last-message preview), (d) the
    // initial-work phrase, (e) any li.
    const pickFrom = (xs) => xs.find((x) => x.dyn)
      || xs.find((x) => x.text === 'c4 title')
      || xs.find((x) => x.text.includes('RST017C4DONE'))
      || xs.find((x) => x.text.toLowerCase().includes('commit 4 dynamic team'))
      || xs.find((x) => x.tag === 'LI' && x.text.length > 3)
    let pick = pickFrom(items)
    if (!pick) {
      // The team roots land in the collapsed "Ungrouped" bucket (the
      // workspace group only lists sessions the workspace record accounts
      // for). Expand the bucket like a user would, then re-inventory.
      log('step2: dyn row absent — expanding the Ungrouped bucket (collapsed by default)')
      const expanded = await page.evaluate(() => {
        const spans = [...document.querySelectorAll('span')]
        const t = spans.find((s) => (s.textContent || '').trim() === 'Ungrouped' && s.offsetParent !== null)
        if (!t) return 'no-ungrouped-row'
        // walk up to the row container (class *CWD04W*row* or a BUTTON)
        let row = t
        for (let i = 0; i < 6 && row.parentElement; i++) {
          row = row.parentElement
          const cls = String(row.className || '')
          if (/(^|\s)[\w]+row/i.test(cls) || row.tagName === 'BUTTON') break
        }
        row.scrollIntoView({ block: 'center' })
        row.click()
        return `clicked ${row.tagName}.${String(row.className).slice(0, 60)}`
      })
      log(`step2: ungrouped expand → ${expanded}`)
      await sleep(5000)
      items = await inventory('step2-ungrouped')
      pick = pickFrom(items)
      if (!pick) {
        // one pre-takeover reload to refresh the list, then expand again
        log('step2: still absent — ONE pre-takeover reload to refresh the list')
        await page.reload({ waitUntil: 'domcontentloaded' })
        await sleep(10_000)
        await dump(page, '02a-after-reload')
        const re = await page.evaluate(() => {
          const spans = [...document.querySelectorAll('span')]
          const t = spans.find((s) => (s.textContent || '').trim() === 'Ungrouped' && s.offsetParent !== null)
          if (!t) return 'no-ungrouped-row'
          let row = t
          for (let i = 0; i < 6 && row.parentElement; i++) {
            row = row.parentElement
            const cls = String(row.className || '')
            if (/(^|\s)[\w]+row/i.test(cls) || row.tagName === 'BUTTON') break
          }
          row.click()
          return 'clicked'
        })
        log(`step2: post-reload ungrouped expand → ${re}`)
        await sleep(5000)
        items = await inventory('step2-reload')
        pick = pickFrom(items)
      }
    }
    if (!pick) { log('step2: NO candidate matched even after expand+reload — dumping and stopping'); await dump(page, '02-no-candidate'); process.exit(3) }
    log(`step2: clicking candidate #${pick.i} (${pick.tag}) "${pick.text.slice(0, 60)}" dyn=${pick.dyn}`)
    const clicked = await page.evaluate((p) => {
      const cands = document.querySelectorAll('li, [role="button"], a, button, [class*="item"], [class*="session"]')
      const list = []
      cands.forEach((el) => { const t = (el.innerText || '').trim().replace(/\s+/g, ' '); if (t && t.length < 400 && el.offsetParent !== null) list.push({ el, t, dyn: el.outerHTML.includes(p.dynId) }) })
      const idx = list.findIndex((x) => (x.dyn && p.dyn) || x.t === p.text || x.t.startsWith(p.text))
      if (idx < 0) return 'not-found'
      list[idx].el.scrollIntoView({ block: 'center' })
      list[idx].el.click()
      return `clicked-${idx}`
    }, { ...pick, dynId: hold.dynamicRoot })
    log(`step2: click result=${clicked}`)
    if (clicked === 'not-found') { await dump(page, '02-click-failed'); process.exit(4) }
    await sleep(12_000) // give the background promote time to be vetoed
    await dump(page, '02-after-open')
  }

  // ── step 3: Team-mode takeover ─────────────────────────────────────────
  // The 0.1.7 English build presents the Team affordance as a "Team" tab
  // (Chat | Trajectory | Team) once the team projection is attached; the
  // zh build's 以 Team 模式打开 button is the same action. Try the button
  // first, fall back to the Team tab, and dump everything for adjudication.
  if (run('step3')) {
    const btnZh = page.locator('button, [role="button"]').filter({ hasText: /以\s*Team\s*模式打开/ })
    const btnEn = page.locator('button, [role="button"]').filter({ hasText: /Open in Team mode|Back to Leader|Take over/i })
    let count = await btnZh.count().catch(() => 0) + await btnEn.count().catch(() => 0)
    log(`step3: direct team-open button count=${count}`)
    if (count === 0) {
      // click the "Team" tab (smallest element with exact text 'Team', x > 300)
      const tab = await page.evaluate(() => {
        const els = [...document.querySelectorAll('button, [role="tab"], [role="button"], a, div, span')]
          .filter((e) => (e.textContent || '').trim() === 'Team' && e.offsetParent !== null && e.getBoundingClientRect().x > 300)
        if (els.length === 0) return 'no-team-tab'
        els.sort((a, b) => a.textContent.length - b.textContent.length || a.getBoundingClientRect().width - b.getBoundingClientRect().width)
        els[0].click()
        return `clicked ${els[0].tagName}`
      })
      log(`step3: team tab → ${tab}`)
      if (tab === 'no-team-tab') { log('step3: NO team affordance — dumping and stopping'); await dump(page, '03-no-button'); process.exit(5) }
      await sleep(8000)
      await dump(page, '02b-team-tab')
      const btns = await page.evaluate(() => [...document.querySelectorAll('button, [role="button"]')]
        .filter((b) => b.offsetParent !== null && b.getBoundingClientRect().x > 300)
        .map((b) => ({ label: (b.getAttribute('aria-label') || '').slice(0, 60), text: (b.innerText || '').trim().replace(/\s+/g, ' ').slice(0, 60), disabled: b.disabled || b.getAttribute('aria-disabled') === 'true' }))
        .filter((b) => b.text || b.label))
      writeFileSync(join(OUT, '02b-team-buttons.json'), JSON.stringify(btns, null, 1))
      log(`step3: team-tab buttons: ${JSON.stringify(btns.slice(0, 20))}`)
      const cand = btns.find((b) => /team mode|open in team|take ?over|回到\s*Leader/i.test(b.text + ' ' + b.label))
      if (!cand) { log('step3: no takeover button in Team view — dumping and stopping for operator'); process.exit(10) }
      log(`step3: clicking takeover "${cand.text || cand.label}"`)
      await page.evaluate((t) => {
        const els = [...document.querySelectorAll('button, [role="button"]')].filter((b) => b.offsetParent !== null && ((b.innerText || '').trim().replace(/\s+/g, ' ') === t) || (b.getAttribute('aria-label') || '') === t)
        els[0].click()
      }, cand.text || cand.label)
    } else {
      const b = (await btnZh.count().catch(() => 0)) > 0 ? btnZh.first() : btnEn.first()
      await b.click({ timeout: 15_000 })
    }
    await sleep(10_000) // takeover (prepareOrdinaryOpen/ensureRootLive) + UI reconcile
    await dump(page, '03-team-open')
  }

  // ── step 4: composer — type the gate-5 prompt + send (NO reload) ───────
  if (run('step4')) {
    // The Team tab shows the dashboard; the composer lives on the Chat tab.
    // Switching tabs is ordinary navigation — NOT a reload (the gold
    // standard forbids a page reload between takeover and the prompt).
    const chatTab = await page.evaluate(() => {
      const els = [...document.querySelectorAll('button, [role="tab"], [role="button"]')]
        .filter((e) => (e.textContent || '').trim() === 'Chat' && e.offsetParent !== null && e.getBoundingClientRect().x > 300)
      if (els.length === 0) return 'no-chat-tab'
      els.sort((a, b) => a.textContent.length - b.textContent.length || a.getBoundingClientRect().width - b.getBoundingClientRect().width)
      els[0].click()
      return 'clicked'
    })
    log(`step4: chat tab → ${chatTab}`)
    await sleep(5000)
    await dump(page, '04a-chat-after-takeover')
    const unavailable = await page.evaluate(() => (document.body.innerText || '').includes('Session unavailable'))
    log(`step4: "Session unavailable" banner present = ${unavailable}`)
    if (unavailable) {
      // KNOWN 0.1.7 UI behaviour (run-5 finding): a page that experienced
      // the veto keeps its client session in the failed-resume state even
      // after the server-side Team takeover succeeds; the composer on THAT
      // page stays "Session unavailable". Re-clicking the ALREADY-SELECTED
      // row is a no-op (run-6 finding: the client keeps its current
      // session). The user-facing recovery is to SWITCH AWAY (blank
      // "New Session") and back — a real attach, NOT a page reload.
      log('step4: composer stuck in the vetoed page state — switching away to the blank session (no reload)')
      const away = await page.evaluate(() => {
        const els = [...document.querySelectorAll('li, [role="button"], button, div, span')]
          .filter((el) => el.offsetParent !== null && (el.innerText || '').trim().length > 0 && (el.innerText || '').trim().length < 60)
        const row = els.find((el) => (el.innerText || '').trim() === 'New Session')
        if (!row) return 'no-blank-row'
        row.scrollIntoView({ block: 'center' })
        row.click()
        return 'clicked'
      })
      log(`step4: switch away (blank) → ${away}`)
      await sleep(8000)
      await dump(page, '04b-after-away')
      // Switch back: a real attach to the taken-over (live) dyn session.
      const back = await page.evaluate((dynId) => {
        const cands = [...document.querySelectorAll('li, [role="button"], a, button, [class*=item], [class*=session]')]
          .filter((el) => el.offsetParent !== null && (el.innerText || '').length < 400 && el.outerHTML.includes(dynId))
        if (cands.length === 0) return 'no-candidate'
        cands.sort((a, b) => a.outerHTML.length - b.outerHTML.length)
        cands[0].scrollIntoView({ block: 'center' })
        cands[0].click()
        return `clicked-${cands.length}`
      }, hold.dynamicRoot)
      log(`step4: switch back (dyn) → ${back}`)
      await sleep(9000)
      await dump(page, '04c-after-back')
      const stillUnavailable = await page.evaluate(() => (document.body.innerText || '').includes('Session unavailable'))
      log(`step4: after switch-back, "Session unavailable" present = ${stillUnavailable}`)
      if (stillUnavailable) { log('step4: composer still vetoed after takeover + session switch — dumping and stopping'); process.exit(11) }
    }
    // Composer: prefer a visible textarea; fall back to contenteditable.
    const ta = page.locator('textarea:visible').last()
    const ce = page.locator('[contenteditable="true"]:visible').last()
    const useTa = await ta.count().catch(() => 0) > 0
    const target = useTa ? ta : ce
    if ((useTa ? 1 : await ce.count().catch(() => 0)) === 0) { log('step4: NO composer found — dumping and stopping'); await dump(page, '04-no-composer'); process.exit(6) }
    log(`step4: composer = ${useTa ? 'textarea' : 'contenteditable'} — typing gate-5 prompt (NO reload since step 3)`)
    await target.click({ timeout: 15_000 })
    await sleep(300)
    if (useTa) { await target.fill(hold.gate5Prompt) } else { await target.fill(hold.gate5Prompt).catch(async () => { await target.type(hold.gate5Prompt) }) }
    await sleep(500)
    await page.screenshot({ path: join(OUT, '04-typed.png') }).catch(() => {})
    // Send: the build's send control is an icon button (aria-label "Send
    // message"); fall back to a text 发送/Send button, then Enter.
    const sendAria = page.locator('button[aria-label="Send message"]:not([disabled])').last()
    if (await sendAria.count().catch(() => 0) > 0) { await sendAria.click().catch(() => {}); log('step4: sent via Send-message button') }
    else {
      const sendBtn = page.locator('button').filter({ hasText: /^(发送|Send)$/ }).first()
      if (await sendBtn.count().catch(() => 0) > 0) { await sendBtn.click().catch(() => {}); log('step4: sent via send button') }
      else { await target.press('Enter'); log('step4: sent via Enter') }
    }
    await sleep(45_000) // leader turn over the mock (run-5: 27s) + UI render
    await dump(page, '04-gate5-answer')
  }

  log('driver: DONE — the kit auto-releases its hold when the gate-5 prompt reaches the mock model')
  if (errors.length) log('page errors seen: ' + JSON.stringify(errors.slice(0, 5)))
  await browser.close()
} catch (e) {
  log(`driver: FAILED at ${e.message?.slice(0, 300)}`)
  await dump(page, '99-failed').catch(() => {})
  await browser.close().catch(() => {})
  process.exit(2)
}
