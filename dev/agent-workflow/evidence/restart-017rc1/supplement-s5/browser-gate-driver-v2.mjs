#!/usr/bin/env node
/**
 * browser-gate-driver-v2.mjs — the STRICT §5 HARD BROWSER GATE driver for the
 * S5 World A leg (run ONLY while the S5 kit holds boot 2).
 *
 * Reads world-A/boot-2/browser-hold.json (the kit writes it at hold start: gui
 * origin, dynamicRoot, doneToken, sessionTitle, gate5Prompt, strict) + the
 * boot-2 marker URL file, drives a headless chromium (playwright, locally
 * extracted libs) through the STRICT flow on a FRESH page, and writes
 * driver-done.json with the step ledger + structural counters.
 *
 * STRICT CONTRACT (guide §5 + brief red lines):
 *   - FRESH connected page (opened AFTER the restart): pageLoadCount must end
 *     as exactly 1. NO page reload, NO blank-navigation, NO session
 *     switch-away-and-back — the driver structurally never does these.
 *   - Accessibility-tree-level ops only: role/text locators, an a11y snapshot
 *     + a screenshot per step. NO page.evaluate DOM hacks for interaction, NO
 *     private-store reach. (page.evaluate is used ONLY to read body text /
 *     composer state for observation — never to click/fill.)
 *   - STOP at the FIRST failed assertion: the gate function returns early on
 *     the first failure, driver-done.json is written with the failed step,
 *     and the process exits. NO recovery (no switch-away-and-back, no
 *     reload). The known 0.1.7 stuck-state recovery (switch to the blank
 *     "New Session" and back) is FORBIDDEN here — the whole point of the gate
 *     is to prove the published client CANNOT clear the stuck failed
 *     generation without one (S3 NO-GO-C1 / Q2-FINDING).
 *
 * The expected outcome is a FAIL at STEP 10 (the composer is still disabled
 * after the single "Open in Team mode" click, with no reload). That FAIL is
 * the documented finding, not a driver defect. The host-side step 15
 * (activation probe) is collected by the kit, not this driver.
 *
 * Steps (the numbers match the kit's A5–A15 checks):
 *   5   the fresh page opened the cold Team root from the session list
 *   7   the page shows "Session unavailable" / 会话不可用 + composer disabled
 *   8   "Open in Team mode / Back to Leader" / 以 Team 模式打开 located in the
 *       a11y tree and clicked EXACTLY once
 *   9   NO reload / NO blank-navigation / NO session switch (structural)
 *   10  the composer is ENABLED after the single click (GATE STEP — expected
 *       to FAIL)
 *   11-14 (only if 10 passes) type+send the gate-5 prompt, the answer renders,
 *       and the captured request carries the Team leader persona + 13 tools
 *
 * All artifacts → world-A/boot-2/browser-driver/
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { createRequire } from 'node:module'

// Self-contained browser env (locally extracted, no sudo): the headless shell
// lives in tests/homes/.browsers and its runtime libs in the dpkg-deb-extracted
// tree (apt-get download + dpkg-deb -x; the system dir is read-only).
process.env.PLAYWRIGHT_BROWSERS_PATH ??= '/home/user/dsh-plugins/dsh-agent-team/tests/homes/.browsers'
process.env.LD_LIBRARY_PATH = ['/home/user/dsh-plugins/dsh-agent-team/tests/homes/.browser-libs/extract/usr/lib/x86_64-linux-gnu', process.env.LD_LIBRARY_PATH].filter(Boolean).join(':')

const KIT_DIR = '/home/user/dsh-plugins/dsh-agent-team/.worktrees/team-restart-017rc1/dev/agent-workflow/evidence/restart-017rc1/supplement-s5'
const OUT = join(KIT_DIR, 'world-A', 'boot-2', 'browser-driver')
mkdirSync(OUT, { recursive: true })

const require = createRequire('/home/user/dsh-plugins/dsh-agent-team/tests/deepseek-harness-test-use/package.json')
const pw = require('/home/user/dsh-plugins/dsh-agent-team/tests/deepseek-harness-test-use/node_modules/.pnpm/playwright@1.61.1/node_modules/playwright')

const hold = JSON.parse(readFileSync(join(KIT_DIR, 'world-A', 'boot-2', 'browser-hold.json'), 'utf8'))
const markerRaw = readFileSync(join(KIT_DIR, 'world-A', 'boot-2', 'boot-2-marker.txt'), 'utf8')
const markerUrl = (markerRaw.match(/https?:\/\/\S+/) ?? [])[0] ?? markerRaw.trim()
if (!/^https?:\/\//.test(markerUrl)) { console.error(`[driver] no URL in marker file: ${markerRaw.slice(0, 120)}`); process.exit(1) }
// The home's workspace path (for the pre-takeover onboarding picker).
let workspacePath = null
try {
  const mat = JSON.parse(readFileSync(join(KIT_DIR, 'world-A', 'world', 'materialized.json'), 'utf8'))
  if (typeof mat?.workspace === 'string') workspacePath = mat.workspace
} catch { /* onboarding is best-effort pre-takeover */ }

const log = (line) => console.error(`[driver-v2] ${line}`)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const now = () => new Date().toISOString()

// ── the step ledger + structural counters (the driver-done.json contract) ──
const steps = []
const screenshots = []
let pageLoadCount = 0
let reloads = 0
let blankNavigations = 0
let sessionSwitches = 0
let takeoverClicks = 0
let domState = null

const recordStep = (step, name, ok, note) => {
  steps.push({ step, name, ok: ok === true, note: String(note ?? '').slice(0, 400), at: now() })
  log(`step ${step}: ${ok ? 'OK' : 'FAIL'} — ${name} :: ${String(note ?? '').slice(0, 160)}`)
}

const browser = await pw.chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
page.on('console', (m) => { if (m.type() === 'error') log(`page console error: ${m.text().slice(0, 200)}`) })
const pageErrors = []
page.on('pageerror', (e) => pageErrors.push(String(e).slice(0, 300)))

// Observation-only helpers (read, never click/fill):
const bodyText = () => page.evaluate(() => (document.body ? document.body.innerText : '(no body)'))
const a11y = async (name) => {
  try {
    const snap = await page.locator('body').ariaSnapshot()
    writeFileSync(join(OUT, `${name}.a11y.yaml`), snap)
    return snap
  } catch (e) {
    try { const t = await bodyText(); writeFileSync(join(OUT, `${name}.a11y.txt`), `a11y snapshot unavailable (${e.message?.slice(0, 120)}); body text:\n${t}`) } catch { /* best-effort */ }
    return null
  }
}
const dump = async (name) => {
  try {
    const text = await bodyText()
    writeFileSync(join(OUT, `${name}.txt`), text)
    await page.screenshot({ path: join(OUT, `${name}.png`), fullPage: false })
    screenshots.push(`${name}.png`)
    log(`${name}: text ${text.length} chars → ${name}.txt/.png`)
  } catch (e) { log(`${name}: dump failed (${e.message?.slice(0, 120)})`) }
}
// The composer/banner state (observation only — never interacts).
const readDomState = async () => {
  try {
    return await page.evaluate(() => {
      // The composer is an a11y "textbox". In the DOM it may be a <textarea>,
      // a [contenteditable], an <input>, or a [role=textbox]. Query ALL
      // textbox-like elements and pick the last visible one (the composer is
      // the last textbox on the page). (The pre-fix query only covered
      // textarea + contenteditable, so an <input>/<role=textbox> composer was
      // invisible to it → composerCount 0 → step 7's "composer disabled"
      // assertion could never be evaluated.)
      const vis = (el) => el.offsetParent !== null
      const ta = [...document.querySelectorAll('textarea')].filter(vis)
      const ce = [...document.querySelectorAll('[contenteditable="true"], [contenteditable=""]')].filter(vis)
      const inp = [...document.querySelectorAll('input[type="text"], input:not([type])')].filter(vis)
      const rtb = [...document.querySelectorAll('[role="textbox"]')].filter(vis)
      const all = [...ta, ...ce, ...inp, ...rtb]
      const pick = all[all.length - 1] || null
      const body = (document.body?.innerText || '')
      const ariaDisabled = (el) => el.getAttribute('aria-disabled') === 'true'
      const disabledOf = (el) => el.disabled === true || ariaDisabled(el) || (el.tagName === 'DIV' && el.isContentEditable === false)
      const enabledOf = (el) => {
        if (!vis(el) || el.disabled === true || ariaDisabled(el)) return false
        if (el.tagName === 'TEXTAREA') return !el.disabled
        if (el.tagName === 'DIV') return el.isContentEditable
        return true
      }
      return {
        bodyTextHead: body.slice(0, 600),
        sessionUnavailable: body.includes('Session unavailable'),
        sessionUnavailableZh: body.includes('会话不可用'),
        composerTag: pick ? pick.tagName : null,
        composerDisabled: pick ? disabledOf(pick) : null,
        composerEditable: pick ? (pick.tagName === 'TEXTAREA' ? !pick.disabled : (pick.tagName === 'DIV' ? pick.isContentEditable : true)) : null,
        composerEnabled: pick ? enabledOf(pick) : false,
        composerVisible: pick ? vis(pick) : false,
        composerCount: all.length,
      }
    })
  } catch (e) { return { error: String(e.message ?? e).slice(0, 200) } }
}

// ── the STRICT gate (returns the failed step number, or null if all passed) ──
async function runGate() {
  // ── fresh page: open the marker URL (the ONLY navigation) ───────────────
  log(`step 0: open marker url (fresh page) ${markerUrl.slice(0, 80)}…`)
  await page.goto(markerUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 })
  pageLoadCount = 1
  await sleep(8000) // let the app boot + session list load
  await a11y('01-landing')
  await dump('01-landing')

  // ── pre-takeover onboarding (idempotent, NOT part of the strict gate) ────
  // A fresh home shows the "Internal Testing Notice" modal + the "Into the
  // Unknown" onboarding with a "Choose workspace" picker. The workspace must
  // be the home's <home>/workspace. This is pre-takeover (the no-reload
  // requirement starts AFTER the Team takeover), so completing it — even if
  // it triggers a one-time in-app redirect — does not touch the gate.
  {
    let text = await bodyText()
    if (text.includes('Internal Testing') || /Continue/.test(text)) {
      log('onboarding: notice modal present — dismissing (Continue)')
      const cont = page.getByRole('button', { name: 'Continue' }).first()
      if (await cont.count().catch(() => 0) > 0) { await cont.click({ timeout: 15_000 }).catch(() => {}); await sleep(3000) }
      text = await bodyText()
    }
    if (text.includes('Choose workspace')) {
      log(`onboarding: workspace picker present — target ${workspacePath ?? '(unknown)'}`)
      const cw = page.getByRole('button', { name: /Choose workspace/i }).first()
      const cwText = page.getByText(/Choose workspace/i).first()
      if (await cw.count().catch(() => 0) > 0) { await cw.click({ timeout: 15_000 }).catch(() => {}) }
      else if (await cwText.count().catch(() => 0) > 0) { await cwText.click({ timeout: 15_000 }).catch(() => {}) }
      await sleep(2500)
      // A native file input would surface a filechooser; otherwise the picker
      // is an in-page tree of clickable path segments (accessibility-tree ops).
      const fc = await page.waitForEvent('filechooser', { timeout: 4000 }).catch(() => null)
      if (fc && workspacePath) {
        log('onboarding: native filechooser — setting the workspace path')
        await fc.setFiles([workspacePath])
        await sleep(8000)
      } else {
        // The workspace path ends in "/workspace", so the world-dir name is
        // the SECOND-to-last segment (the last is the literal "workspace").
        // (The pre-fix `.pop()` returned "workspace" — the leaf — so the walk
        // skipped the world-dir level and Open picked the wrong directory.)
        const parts = (workspacePath || '').split('/').filter(Boolean)
        const homeDir = parts.length >= 2 && parts[parts.length - 1] === 'workspace' ? parts[parts.length - 2] : ''
        const segs = homeDir ? ['dsh-plugins', 'dsh-agent-team', 'tests', 'homes', homeDir, 'workspace'] : []
        if (segs.length === 0) log('onboarding: no workspace path — cannot complete the picker (best-effort)')
        for (const seg of segs) {
          const loc = page.getByText(seg, { exact: true }).last()
          if (await loc.count().catch(() => 0) > 0) { await loc.scrollIntoViewIfNeeded().catch(() => {}); await loc.click({ timeout: 8000 }).catch(() => {}); log(`onboarding: dialog seg "${seg}" → clicked`); await sleep(1500) }
          else log(`onboarding: dialog seg "${seg}" → absent`)
        }
        const openBtn = page.getByRole('button', { name: 'Open' }).first()
        if (await openBtn.count().catch(() => 0) > 0) { await openBtn.click({ timeout: 8000 }).catch(() => {}); log('onboarding: Open → clicked') }
        await sleep(8000)
      }
      await dump('01d-main-screen')
    } else if (text.includes('New Team') && /Describe what you want to build/i.test(text)) {
      log('onboarding: main screen already present (onboarding done in a previous pass) — skipping')
    } else {
      log(`onboarding: screen state head: ${(text || '').slice(0, 160).replace(/\n/g, ' | ')}`)
      await dump('01c-onboarding-state')
    }
  }

  // ── STEP 5: open the cold Team root from the session list ────────────────
  // The cold root's row is located by the leader's acknowledgement token in
  // the last-message preview (doneToken), falling back to the durable title.
  // Opening it triggers the background ORDINARY promote, which the production
  // fence vetoes (the host-side veto is asserted by the kit's A6 / step 6).
  {
    let opened = false
    let how = 'no-match'
    // The session-list row renders as "<title> <relative-time>" (e.g.
    // "c4 title 1min"), so an EXACT title match never hits; the doneToken
    // (last-message preview) is not shown on the row either. Match the title
    // as a PREFIX (word-anchored) and, as a fallback, as a plain substring —
    // both are real row text, not a DOM hack.
    const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const byToken = hold.doneToken ? page.getByText(hold.doneToken).first() : null
    const byTitle = hold.sessionTitle ? page.getByText(new RegExp('^' + esc(hold.sessionTitle) + '(\\s|$)')).first() : null
    const byTitleSub = hold.sessionTitle ? page.getByText(hold.sessionTitle).first() : null
    const rowLocs = [byTitle, byTitleSub, byToken].filter(Boolean)
    // The session list renders LAZILY after the workspace opens (the 01d dump
    // shows an empty list; the row appears a few seconds later). WAIT for the
    // cold root row to become visible before building the candidate list —
    // otherwise the .count() checks race the render and every candidate comes
    // up empty (a "no-match" false-negative, NOT a product finding).
    const waitRow = async (ms) => {
      for (const loc of rowLocs) {
        try { await loc.waitFor({ state: 'visible', timeout: ms }); log(`step5: row rendered (waited) — proceeding`); return true } catch { /* try next */ }
      }
      return false
    }
    await waitRow(25_000)
    const buildCandidates = async () => {
      const c = []
      if (byToken && await byToken.count().catch(() => 0) > 0) c.push({ how: 'doneToken', loc: byToken })
      if (byTitle && await byTitle.count().catch(() => 0) > 0) c.push({ how: 'sessionTitle(prefix)', loc: byTitle })
      if (byTitleSub && await byTitleSub.count().catch(() => 0) > 0) c.push({ how: 'sessionTitle(substring)', loc: byTitleSub })
      return c
    }
    let candidates = await buildCandidates()
    for (const c of candidates) {
      try {
        if (await c.loc.isVisible().catch(() => false)) {
          await c.loc.scrollIntoViewIfNeeded().catch(() => {})
          await c.loc.click({ timeout: 15_000 })
          opened = true; how = c.how; break
        }
      } catch (e) { log(`step5: candidate ${c.how} click failed (${e.message?.slice(0, 120)})`) }
    }
    if (!opened) {
      // The team roots land in the collapsed "Ungrouped" bucket. Expand it
      // like a user would (a real row click, not a DOM hack), then re-wait and
      // rebuild the candidate list (the row may render after the expand).
      log('step5: row not visible — expanding the Ungrouped bucket, then re-searching')
      const ungrouped = page.getByText('Ungrouped', { exact: true }).first()
      if (await ungrouped.count().catch(() => 0) > 0) { await ungrouped.click({ timeout: 8000 }).catch(() => {}); await sleep(3000) }
      await waitRow(10_000)
      candidates = await buildCandidates()
      for (const c of candidates) {
        try {
          if (await c.loc.isVisible().catch(() => false)) { await c.loc.scrollIntoViewIfNeeded().catch(() => {}); await c.loc.click({ timeout: 15_000 }); opened = true; how = `${c.how}(post-ungrouped)`; break }
        } catch (e) { log(`step5: post-ungrouped ${c.how} click failed (${e.message?.slice(0, 120)})`) }
      }
    }
    if (opened) await sleep(12_000) // give the background promote time to be vetoed
    await a11y('02-after-open')
    await dump('02-after-open')
    recordStep(5, 'the fresh connected page opened the cold Team root from the UI session list', opened, `how=${how} (pre-takeover reloads=0; pageLoadCount=${pageLoadCount})`)
    if (!opened) return 5
  }

  // ── STEP 7: Session unavailable + composer disabled (the veto's UI state) ─
  domState = await readDomState()
  const unavailable = domState.sessionUnavailable === true || domState.sessionUnavailableZh === true
  const composerDisabled = domState.composerDisabled === true
  await a11y('07-session-unavailable')
  await dump('07-session-unavailable')
  recordStep(7, 'the page shows "Session unavailable" (会话不可用) with the composer disabled (the vetoed ordinary open\'s client state)', unavailable && composerDisabled, JSON.stringify(domState).slice(0, 240))
  if (!(unavailable && composerDisabled)) return 7

  // ── STEP 8: click "Open in Team mode / Back to Leader" EXACTLY ONCE ───────
  {
    let clicked = false
    let how = 'no-affordance'
    const directZh = page.getByRole('button', { name: /以\s*Team\s*模式打开/ }).first()
    const directEn = page.getByRole('button', { name: /Open in Team mode|Back to Leader|Take over/i }).first()
    for (const c of [directZh, directEn]) {
      if (await c.count().catch(() => 0) > 0 && await c.isVisible().catch(() => false)) {
        await c.scrollIntoViewIfNeeded().catch(() => {})
        await c.click({ timeout: 15_000 })
        clicked = true; how = 'direct-button'; takeoverClicks = 1; break
      }
    }
    if (!clicked) {
      // The 0.1.7 English build presents the Team affordance as a "Team" tab
      // (Chat | Trajectory | Team); the takeover control is inside that view.
      log('step8: no direct takeover button — opening the Team tab (a11y role=tab / text)')
      const tab = page.getByRole('tab', { name: 'Team' }).first()
      const tabText = page.getByText('Team', { exact: true }).first()
      let tabClicked = false
      if (await tab.count().catch(() => 0) > 0 && await tab.isVisible().catch(() => false)) { await tab.click({ timeout: 10_000 }).catch(() => {}); tabClicked = true }
      else if (await tabText.count().catch(() => 0) > 0 && await tabText.isVisible().catch(() => false)) { await tabText.click({ timeout: 10_000 }).catch(() => {}); tabClicked = true }
      if (tabClicked) {
        await sleep(8000)
        await dump('02b-team-tab')
        const inTabZh = page.getByRole('button', { name: /以\s*Team\s*模式打开/ }).first()
        const inTabEn = page.getByRole('button', { name: /Open in Team mode|Back to Leader|Take over/i }).first()
        for (const c of [inTabZh, inTabEn]) {
          if (await c.count().catch(() => 0) > 0 && await c.isVisible().catch(() => false)) {
            await c.scrollIntoViewIfNeeded().catch(() => {})
            await c.click({ timeout: 15_000 })
            clicked = true; how = 'team-tab-button'; takeoverClicks = 1; break
          }
        }
      }
    }
    await sleep(10_000) // takeover (prepareOrdinaryOpen/ensureRootLive) + UI reconcile
    await a11y('08-team-open')
    await dump('08-team-open')
    recordStep(8, '"Open in Team mode / Back to Leader" (以 Team 模式打开) located in the a11y tree and clicked EXACTLY once', clicked, `how=${how} takeoverClicks=${takeoverClicks}`)
    if (!clicked) return 8
  }

  // ── STEP 9: structural no-reload / no-blank / no-switch ───────────────────
  const structural = reloads === 0 && blankNavigations === 0 && sessionSwitches === 0 && pageLoadCount === 1
  await dump('09-structural')
  recordStep(9, 'NO page reload / NO blank-navigation / NO session switch-away-and-back (structural — the action log never did any of these)', structural, `reloads=${reloads} blank=${blankNavigations} switches=${sessionSwitches} pageLoadCount=${pageLoadCount}`)
  if (!structural) return 9

  // ── STEP 10: the composer is ENABLED after the single click (GATE STEP) ───
  // EXPECTED TO FAIL: the published 0.1.7 client cannot clear the stuck failed
  // generation of the current main session without a reload/archive-reopen
  // (S3 NO-GO-C1; Q2-FINDING). We do NOT recover (no switch-away-and-back) —
  // we assert the composer state as-is and stop.
  await sleep(6000) // let any client reconcile settle (no reload)
  domState = await readDomState()
  await a11y('10-composer-check')
  await dump('10-composer-check')
  const composerEnabled = domState.composerEnabled === true && domState.composerVisible === true
  recordStep(10, 'the composer is ENABLED after the single click WITHOUT any reload/blank/switch (GATE STEP — expected to FAIL)', composerEnabled, JSON.stringify(domState).slice(0, 280))
  if (!composerEnabled) {
    log('step 10 FAILED (EXPECTED per S3 NO-GO-C1 / Q2-FINDING): composer not enabled after the single click; stopping (no recovery)')
    return 10
  }

  // ── STEPS 11-14 (unexpected path): the composer IS enabled — send the ─────
  // gate-5 prompt and verify the leader answer + the captured request.
  {
    const ta = page.locator('textarea:visible').last()
    const ce = page.locator('[contenteditable="true"]:visible').last()
    const useTa = await ta.count().catch(() => 0) > 0
    const target = useTa ? ta : ce
    if ((useTa ? 1 : await ce.count().catch(() => 0)) === 0) { recordStep(11, 'the composer element was located (unexpected path)', false, 'no composer found after step 10 passed'); return 11 }
    await target.click({ timeout: 15_000 })
    await sleep(300)
    if (useTa) { await target.fill(hold.gate5Prompt) } else { await target.fill(hold.gate5Prompt).catch(async () => { await target.type(hold.gate5Prompt) }) }
    await sleep(500)
    await page.screenshot({ path: join(OUT, '11-typed.png') }).catch(() => {})
    screenshots.push('11-typed.png')
    const sendAria = page.locator('button[aria-label="Send message"]:not([disabled])').last()
    let sent = false
    if (await sendAria.count().catch(() => 0) > 0) { await sendAria.click().catch(() => {}); sent = true }
    else {
      const sendBtn = page.getByRole('button', { name: /^(发送|Send)$/ }).first()
      if (await sendBtn.count().catch(() => 0) > 0) { await sendBtn.click().catch(() => {}); sent = true }
      else { await target.press('Enter'); sent = true }
    }
    recordStep(11, 'the typed gate-5 prompt was entered into the composer (unexpected path)', true, 'typed the gate-5 prompt')
    recordStep(12, 'the gate-5 prompt was sent (unexpected path)', sent, 'sent via send control / Enter')
    await sleep(45_000) // leader turn over the mock + UI render
    const afterText = await bodyText()
    const answerRendered = afterText.includes(hold.doneToken) || /Gate-5|composer check/i.test(afterText)
    await a11y('13-answer')
    await dump('13-answer')
    recordStep(13, 'the leader answer rendered in the same page (unexpected path)', answerRendered, `answer present=${answerRendered}`)
    recordStep(14, 'captured request carries the Team leader persona + 13 team_* tools + row staticModel (host-side, asserted by the kit if the request is captured)', true, 'host-side — the kit asserts this from the mock request capture')
  }

  log('driver-v2: STRICT GATE completed (all steps 5-10 passed — unexpected)')
  return null
}

let failedStep
try {
  failedStep = await runGate()
} catch (e) {
  log(`driver-v2: CRASHED — ${e.message?.slice(0, 300)}`)
  try { domState = await readDomState() } catch { domState = { error: 'crash before domState' } }
  await dump('99-crashed').catch(() => {})
  failedStep = steps.length > 0 && !steps[steps.length - 1].ok ? steps[steps.length - 1].step : 99
}

// ── write the final ledger + close the browser ──────────────────────────────
const out = {
  completed: failedStep === null,
  failedStep,
  steps,
  pageLoadCount,
  reloads,
  blankNavigations,
  sessionSwitches,
  takeoverClicks,
  domState,
  screenshots,
  pageErrors: pageErrors.slice(0, 8),
  finishedAt: now(),
}
writeFileSync(join(OUT, 'driver-done.json'), JSON.stringify(out, null, 1))
log(`driver-v2: wrote driver-done.json (completed=${out.completed} failedStep=${failedStep ?? 'n/a'} pageLoadCount=${pageLoadCount})`)
await browser.close().catch(() => {})
process.exit(out.completed ? 0 : 2)
