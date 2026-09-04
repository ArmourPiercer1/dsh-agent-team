/**
 * S8-C browser driver (Playwright, standalone — no vitest).
 *
 * Modes:
 *   node s8-browser.mjs recon    — open the GUI, capture shell/Team-tab/New-Team
 *                                  DOM + element inventory + console/network.
 *   node s8-browser.mjs vertical — full S8 scenario (selectors set after recon).
 *
 * Evidence: <EV>/browser/{recon,vertical}-*.html/.png/.json + trace json.
 * Reads <EV>/state.json (token/cookie/origin) — the S8 boot kit must be READY.
 */

import { readFileSync, mkdirSync, writeFileSync, appendFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const EV = dirname(fileURLToPath(import.meta.url))
const OUT = join(EV, 'browser')
const STATE_FILE = join(EV, 'state.json')
const TEST_USE_WEB = join(EV, '..', '..', '..', '..', '..', 'references', 'deepseek-harness-test-use', 'apps', 'web')

const MODE = process.argv[2]
if (MODE !== 'recon' && MODE !== 'vertical') {
  console.error('usage: node s8-browser.mjs recon|vertical')
  process.exit(2)
}

function die(msg) {
  console.error(`FAIL — ${msg}`)
  // Fail-loud but keep the evidence: write the accumulated console + network
  // trace so a failed step still leaves the RPC facts behind.
  try {
    writeFileSync(join(OUT, `${MODE}-console.json`), JSON.stringify({ consoleEvents, pageErrors }, null, 2))
    writeFileSync(join(OUT, `${MODE}-trace.json`), JSON.stringify(netTrace, null, 2))
  } catch { /* evidence write is best-effort; the die message still lands */ }
  process.exit(1)
}
const step = (line) => console.log(`[s8-browser] ${line}`)

const state = JSON.parse(readFileSync(STATE_FILE, 'utf8'))
const origin = `http://127.0.0.1:${state.port}`
const token = state.token
if (!token) die('state.json has no token')
mkdirSync(OUT, { recursive: true })

// ── playwright resolution (per S8 driver decision) ──────────────────────────
const requireFromWeb = createRequire(join(TEST_USE_WEB, 'package.json'))
const { chromium } = requireFromWeb('playwright')

// ── evidence accumulators ───────────────────────────────────────────────────
const consoleEvents = []
const pageErrors = []
const netTrace = []
let stepNo = 0

async function screenshot(page, tag) {
  const p = join(OUT, `${MODE}-${String(stepNo).padStart(2, '0')}-${tag}.png`)
  await page.screenshot({ path: p, fullPage: false })
  step(`screenshot → ${p}`)
}
async function domDump(page, tag) {
  const p = join(OUT, `${MODE}-${String(stepNo).padStart(2, '0')}-${tag}.html`)
  const html = await page.content()
  writeFileSync(p, html)
  step(`dom dump → ${p} (${html.length} chars)`)
  return html
}
function elementInventory(page) {
  return page.evaluate(() => {
    const out = []
    const sel = 'button, a, [role="button"], [role="tab"], [role="dialog"], select, input, textarea, [data-team-dock], [data-dock-title], [data-team-leaf], [data-team-row]'
    for (const el of document.querySelectorAll(sel)) {
      const data = {}
      for (const attr of el.attributes) {
        if (attr.name.startsWith('data-team') || attr.name.startsWith('data-dock') || attr.name === 'role' || attr.name === 'aria-label' || attr.name === 'title') {
          data[attr.name] = attr.value
        }
      }
      out.push({
        tag: el.tagName.toLowerCase(),
        text: (el.textContent ?? '').trim().slice(0, 120),
        data,
        disabled: el.disabled === true || el.getAttribute('aria-disabled') === 'true' || null,
      })
    }
    return out
  })
}

async function main() {
  const browser = await chromium.launch({ headless: true })
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await ctx.newPage()

  page.on('console', (msg) => {
    consoleEvents.push({ type: msg.type(), text: msg.text().slice(0, 500) })
  })
  page.on('pageerror', (err) => {
    pageErrors.push(String(err).slice(0, 1000))
  })
  page.on('response', async (res) => {
    const u = new URL(res.url())
    const entry = {
      method: res.request().method(),
      url: res.url().slice(0, 300),
      status: res.status(),
      t: Date.now(),
      kind: u.pathname.startsWith('/team-remote') ? 'team-remote'
        : u.pathname.startsWith('/api') ? 'api'
        : u.pathname.startsWith('/plugins') ? 'plugins'
        : u.pathname.startsWith('/__p6t6') ? 'p6t6'
        : 'other',
    }
    if (['team-remote', 'api', 'p6t6'].includes(entry.kind)) {
      try {
        const body = await res.text()
        entry.responseBody = body.slice(0, 2000)
      } catch { /* not readable */ }
    }
    netTrace.push(entry)
  })
  page.on('request', (req) => {
    if (req.method() !== 'GET') {
      const u = new URL(req.url())
      if (u.pathname.startsWith('/team-remote') || u.pathname.startsWith('/api')) {
        try {
          const post = req.postData()
          if (post) {
            // Attach to the matching trace entry by rpcId when possible.
            const parsed = JSON.parse(post)
            const target = [...netTrace].reverse().find((e) => e.rpcId === undefined && (e.url.includes(u.pathname) || e.url === req.url().slice(0, 300)))
            if (target) {
              target.rpcId = parsed.rpcId ?? null
              target.requestBody = post.slice(0, 2000)
            } else {
              netTrace.push({ method: req.method(), url: req.url().slice(0, 300), status: null, t: Date.now(), kind: u.pathname.startsWith('/team-remote') ? 'team-remote' : 'api', requestBody: post.slice(0, 2000), rpcId: JSON.parse(post).rpcId ?? null, note: 'request-only (response pending/failed)' })
            }
          }
        } catch { /* non-JSON */ }
      }
    }
  })

  const prefix = MODE === 'recon' ? 'recon' : 'v'

  // ── open the GUI (token in URL → 303 → cookie) ────────────────────────────
  stepNo = 1
  step('open ' + origin + ' (launch-token param set)')
  const launchUrl = new URL(origin)
  launchUrl.searchParams.set('token', token)
  const resp = await page.goto(launchUrl.href, { waitUntil: 'domcontentloaded', timeout: 60_000 })
  step(`initial response: ${resp?.status()} → ${page.url()}`)
  // Wait for the shell to be interactive (session list or an app root).
  await page.waitForSelector('button, [role="tab"]', { timeout: 60_000 })
  await page.waitForTimeout(2500)
  await screenshot(page, 'shell')
  await domDump(page, 'shell')
  step(`shell inventory (${(await elementInventory(page)).length} interactive elements)`)

  // ── first-run notice + open a native session ──────────────────────────────
  // The team UI (P9 client) mounts into the conversation view of an OPEN
  // session (conversation.view tab, id 'team'); a zero-session instance only
  // shows the native composer, so a session must be opened first.
  const betaBtn = page.locator('button:has-text("继续")').first()
  if (await betaBtn.isVisible().catch(() => false)) {
    await betaBtn.click()
    await page.waitForTimeout(1500)
    step('first-run notice dismissed (继续)')
  } else {
    step('no first-run notice present')
  }
  // ── workspace: the composer stays inert until a workspace exists ──────────
  // The instance home starts with no workspaces. The S8 patch pins the
  // in-app -browse directory picker (the auto chooser would resolve to the
  // renderless -native OS dialog on win32 + loopback, unautomatable).
  const wsBtn = page.locator('button[aria-label="选择工作区"]').first()
  // Guard on the inert-composer placeholder: once a workspace is adopted the
  // composer is active and the button (if still present) opens the switcher
  // MENU, not the browse dialog — so the browse flow runs only while no
  // workspace exists yet (fresh home).
  const composerInert = await page.getByText('选择一个工作区开始').first().isVisible().catch(() => false)
  if (composerInert && (await wsBtn.count() > 0) && await wsBtn.isEnabled().catch(() => false)) {
    // With an empty workspace list the picker opens the directory flow
    // directly (the menu degenerates: adding is the only possible action).
    await wsBtn.click()
    await page.waitForTimeout(1500)
    const dialog = page.locator('[role="dialog"]').last()
    await dialog.waitFor({ state: 'visible', timeout: 15_000 })
    await page.locator('button[aria-label="编辑路径"]').first().click()
    const pathInput = page.locator('input[aria-label="编辑路径"]').first()
    await pathInput.waitFor({ state: 'visible', timeout: 10_000 })
    await pathInput.fill(state.workspaceDir)
    await page.waitForTimeout(300)
    await pathInput.press('Enter')
    await page.waitForTimeout(2500)
    await dialog.locator('button:has-text("打开")').first().click()
    await page.waitForTimeout(3000)
    await screenshot(page, 'workspace-created')
    step(`workspace adopted: ${state.workspaceDir}`)
  } else {
    step('workspace already adopted or picker absent — skipping browse flow')
  }

  const teamTabProbe = page.getByRole('tab', { name: '团队' }).first()
  const newSessionBtn = page.locator('button:has-text("新会话")').first()
  let teamTabVisible = false
  if ((await newSessionBtn.count() > 0) && await newSessionBtn.isEnabled().catch(() => false)) {
    await newSessionBtn.click()
    await page.waitForTimeout(3000)
    teamTabVisible = await teamTabProbe.isVisible().catch(() => false)
    step(`session opened via 新会话; 团队 tab visible=${teamTabVisible}`)
  } else {
    step('新会话 button absent or disabled — falling back to first message')
  }
  if (!teamTabVisible) {
    // Fallback: the button may only focus the draft composer — the first sent
    // message creates the session (mock model answers on :3493).
    step('团队 tab not visible — sending an initial message to create the session')
    const composer = page.locator('textarea, [contenteditable="true"]').last()
    await composer.click()
    if ((await composer.evaluate((el) => el.tagName).catch(() => '')) === 'TEXTAREA') {
      await composer.fill('S8 vertical session')
    } else {
      await composer.type('S8 vertical session')
    }
    await page.locator('button[aria-label="发送消息"]').first().click()
    await teamTabProbe.waitFor({ state: 'visible', timeout: 60_000 })
    step('session created via first message; 团队 tab now visible')
  }

  if (MODE === 'recon') {
    // Navigate to the Team tab and the New-Team panel for selector discovery.
    stepNo = 2
    const teamTab = page.getByRole('tab', { name: '团队' }).first()
    if (await teamTab.count() > 0) {
      await teamTab.click()
      await page.waitForTimeout(1500)
      await screenshot(page, 'team-tab')
      await domDump(page, 'team-tab')
      step(`team-tab inventory: ${JSON.stringify((await elementInventory(page)).slice(0, 80), null, 1).slice(0, 4000)}`)
    } else {
      step('no 团队 tab found at role=tab — searching any element')
      const anyTeam = page.locator('text=团队').first()
      if (await anyTeam.count() > 0) {
        await anyTeam.click()
        await page.waitForTimeout(1500)
        await screenshot(page, 'team-tab')
        await domDump(page, 'team-tab')
        step(`team element clicked; inventory: ${JSON.stringify((await elementInventory(page)).slice(0, 80), null, 1).slice(0, 4000)}`)
      } else {
        step('NO 团队 element anywhere — team slot not mounted?')
      }
    }

    stepNo = 3
    const startHere = page.locator('text=从此处开始团队').first()
    if (await startHere.count() > 0) {
      await startHere.click()
      await page.waitForTimeout(2000)
      await screenshot(page, 'new-team')
      await domDump(page, 'new-team')
      step(`new-team inventory: ${JSON.stringify((await elementInventory(page)).slice(0, 120), null, 1).slice(0, 6000)}`)
    } else {
      step('no 从此处开始团队 entry — the ordinary session shows the view.zero empty state (expected for a non-team session)')
      const zero = page.locator('text=当前会话未加入任何团队')
      step(`view.zero empty state present: ${await zero.count() > 0}`)
    }

    if (process.env.S8_PROBE === '1') {
      await runProbe(page, 'recon')
    }
  }

  if (MODE === 'vertical') {
    await runVertical(page)
  }

  // ── evidence write-out ────────────────────────────────────────────────────
  writeFileSync(join(OUT, `${MODE}-console.json`), JSON.stringify({ consoleEvents, pageErrors }, null, 2))
  writeFileSync(join(OUT, `${MODE}-trace.json`), JSON.stringify(netTrace, null, 2))
  const errors = consoleEvents.filter((e) => e.type === 'error')
  step(`console errors=${errors.length} pageErrors=${pageErrors.length} netEntries=${netTrace.length}`)
  if (errors.length > 0) step(`console error sample: ${JSON.stringify(errors.slice(0, 5))}`)
  if (pageErrors.length > 0) step(`pageError sample: ${JSON.stringify(pageErrors.slice(0, 3))}`)

  await browser.close()
  step(`${MODE.toUpperCase()} DONE`)
}

// ── S8 probe (debug variant only): read window.__s8Probe, call
// agentPresets.list() live at panel-mount time, and report leaf facts. ────
async function runProbe(page, label) {
  await page.waitForTimeout(3000)
  const probeOut = await page.evaluate(async () => {
    const p = window.__s8Probe
    if (!p) return { hook: 'absent' }
    const callList = await p.callList()
    return { hook: 'present', diag: p.diag, nsKeys: p.nsKeys(), callList }
  }).catch((e) => ({ hook: 'error', message: String(e && e.message) }))
  writeFileSync(join(OUT, `probe-${label}.json`), JSON.stringify(probeOut, null, 2))
  step(`probe(${label}): ${JSON.stringify(probeOut).slice(0, 1200)}`)
}

// ── the S8 vertical scenario (selectors refined after recon) ────────────────

async function runVertical(page) {
  const expect = async (label, cond, extra) => {
    if (!cond) die(`vertical assertion failed: ${label}${extra ? ` — ${extra}` : ''}`)
    step(`assert OK: ${label}`)
  }

  // ── S1: an ordinary session stays ordinary — the team tab is mounted in
  //    the conversation view, the default view is native chat, and no team
  //    content is fabricated ─────────────────────────────────────────────
  stepNo = 2
  const teamTabS1 = page.getByRole('tab', { name: '团队' }).first()
  await expect('conversation view mounted: 团队 tab present', await teamTabS1.count() > 0)
  const zeroS1 = page.locator('text=当前会话未加入任何团队')
  await expect('default view is native (team zero state not shown until tab active)', (await zeroS1.count()) === 0)
  await screenshot(page, 's1-ordinary')

  // ── S2: Team tab → New Team flow ─────────────────────────────────────────
  stepNo = 3
  await page.getByRole('tab', { name: '团队' }).first().click()
  await page.waitForTimeout(800)
  const startHere = page.locator('text=从此处开始团队').first()
  await expect('New Team entry visible (从此处开始团队)', await startHere.count() > 0)
  await startHere.click()
  await page.waitForTimeout(1200)
  await expect('New Team panel: 新建团队', await page.locator('text=新建团队').count() > 0)
  await expect('blueprint field 团队蓝图', await page.locator('text=团队蓝图').count() > 0)
  await screenshot(page, 's2-new-team')
  await domDump(page, 's2-new-team')

  if (process.env.S8_PROBE === '1') {
    await runProbe(page, 'vertical-s2')
  }

  // ── S3: pick blueprint (catalog lists s8v-bp-1), compatibility ready ─────
  stepNo = 4
  const bpSelect = page.locator('select').first()
  const hasSelect = await bpSelect.count() > 0
  if (hasSelect) {
    const opts = await bpSelect.locator('option').allTextContents()
    step(`blueprint options: ${JSON.stringify(opts)}`)
    // The catalog lists exactly one blueprint with no placeholder option,
    // so select by matching the s8v-bp-1 label rather than a fixed index.
    const bpOpt = opts.find((o) => o.includes('s8v-bp-1'))
    if (!bpOpt) die('no s8v-bp-1 option in blueprint select: ' + JSON.stringify(opts))
    await bpSelect.selectOption({ label: bpOpt })
  } else {
    // custom listbox: click the 选择蓝图… control, pick the first option
    await page.locator('text=选择蓝图…').first().click()
    await page.waitForTimeout(800)
    const opt = page.locator('[role="option"]').first()
    await expect('blueprint option available', await opt.count() > 0)
    await opt.click()
  }
  // Wait for the compatibility check to settle (✓ 就绪 expected for s8v-bp-1).
  const ready = page.locator('text=✓ 就绪')
  let readyVisible = false
  try {
    await ready.waitFor({ state: 'visible', timeout: 60_000 })
    readyVisible = true
  } catch {
    readyVisible = false
  }
  if (!readyVisible) {
    await screenshot(page, 's3-not-ready')
    await domDump(page, 's3-not-ready')
    step('compatibility NOT ready — s3-not-ready evidence captured')
  }
  await expect('compatibility ready (✓ 就绪)', readyVisible)
  await screenshot(page, 's3-blueprint-ready')

  // ── S4: 创建团队 → native root session opens ──────────────────────────────
  stepNo = 5
  await page.locator('button:has-text("创建团队")').first().click()
  await page.waitForTimeout(500)
  const creating = page.locator('text=正在创建…')
  if (await creating.count() > 0) step('creating (正在创建…) shown')
  // The handoff completion opens the NEW root session (native conversation
  // view, default 对话 tab) and delivers the frozen context there. The Team
  // tab must be activated in the new session before the projection panel
  // renders (spec: "native root Session opens -> Team tab loads Projection
  // over public Remote") — capture s4 evidence if the root never opens.
  let rootOpened = false
  try {
    await page.locator('text=handoff-ctx').first().waitFor({ state: 'visible', timeout: 30_000 })
    rootOpened = true
  } catch {
    rootOpened = false
  }
  await expect('native root session opened (handoff-ctx in sidebar)', rootOpened)
  await page.waitForTimeout(2000)
  const teamTabAfterCreate = page.getByRole('tab', { name: '团队' }).first()
  if (await teamTabAfterCreate.count() > 0) {
    await teamTabAfterCreate.click()
    await page.waitForTimeout(1500)
    step('Team tab activated in the new root session')
  } else {
    step('NO 团队 tab in the new root session — capture s4 evidence')
  }
  // The root session opens and the Team tab shows the projection. The create
  // is a live RPC chain (sessions.create + team.create + the projection cold
  // read), so wait for the projection's members section (the data-team-section
  // attribute — stable; the 团队成员配置 heading belongs to the settings
  // section, not the live projection view) instead of a fixed sleep; capture
  // s4 evidence if it never mounts (the panel failure state, if any, is in
  // the dump plus the die() trace write).
  const teamView = page.locator('[data-team-section="members"]').first()
  let viewMounted = false
  try {
    await teamView.waitFor({ state: 'visible', timeout: 45_000 })
    viewMounted = true
  } catch {
    viewMounted = false
  }
  if (!viewMounted) {
    await screenshot(page, 's4-not-mounted')
    await domDump(page, 's4-not-mounted')
    step('team projection NOT mounted — s4-not-mounted evidence captured')
  }
  await expect('team projection mounted (members section)', viewMounted)
  await screenshot(page, 's4-team-created')
  await domDump(page, 's4-team-created')

  // ── S5: create the first member instance — the §17 fixed template row.
  //    Bug #5 (commit 48d7330): the zero-instance template now renders its
  //    "尚无实例" row plus the "+" entry (UI doc §16.1/§17.1; §17.3
  //    "explicit create vs delegate-and-create" — the explicit entry). ────
  stepNo = 6
  const membersSection = page.locator('[data-team-section="members"]').first()
  const emptyGroup = membersSection.locator('[data-member-group]:has([data-member-no-instances])').first()
  await expect('worker template row present (尚无实例 expansion)', await emptyGroup.count() > 0)
  const createBtn = emptyGroup.locator('[data-member-create-instance]')
  await expect('§17 "+" entry (创建成员实例) on the zero-instance template row', await createBtn.count() > 0)
  await createBtn.click()
  await page.waitForTimeout(600)
  const createDialog = page.locator('[data-member-create-dialog]')
  await expect('member create dialog open (template/label fields)', (await createDialog.count()) === 1)
  await createDialog.locator('[data-member-create-label]').fill('s8v-worker-1')
  // The workspace select stays on its placeholder: the instance inherits the
  // team defaultWorkspace (stamped by F1-lite v2).
  await createDialog.locator('[data-member-create-submit]').click()
  // The worker's instance row, addressed STRUCTURALLY: the row never renders
  // the instance label (legacy-inherited layout — dot/status/action only; the
  // model documents the label as "the dialog copy"), so a text match on the
  // entered label can never hit. The non-leader group is the template group
  // (the leader group row carries [data-leader]).
  const workerRowSel = '[data-member-group]:not(:has([data-leader])) [data-member-instance]'
  const workerRow = membersSection.locator(workerRowSel).first()
  let memberMounted = false
  try {
    await workerRow.waitFor({ state: 'visible', timeout: 45_000 })
    memberMounted = true
  } catch {
    memberMounted = false
  }
  if (!memberMounted) {
    await screenshot(page, 's5-member-not-visible')
    await domDump(page, 's5-member-not-visible')
    step('member row NOT visible — s5-member-not-visible evidence captured')
  }
  await expect('member row visible (instance row in the worker group from refreshed Projection)', memberMounted)
  // Identity pin: the entered label IS rendered by the governance card
  // (memberName) — ties the new row to the instance this run created.
  await expect(
    'created member identity rendered (label s8v-worker-1 in governance card)',
    (await page.locator('text=s8v-worker-1').count()) > 0,
  )
  await screenshot(page, 's5-member-created')
  await domDump(page, 's5-member-created')

  // ── S6: first work (member.send) + member perspective (D7) ─────────────
  // attempt-27 blocker root cause: the member child Session is BLANK at
  // creation (lifecycle CREATED, 0 messages). The upstream shell hides the
  // WHOLE session chrome — header + tab list incl. the 团队 conversation.
  // view tab — while `session.blank && phase === 'blank'` (ui-conversation
  // ConversationSessionHeader L77). The 团队 tab is therefore legitimately
  // absent in the just-opened blank child (attempt-27
  // vertical-07-s6-no-team-tab.png: the child is current + highlighted in
  // the sidebar, the hero is shown, the header hidden), and CORE PATCH
  // BUDGET = 0 forbids patching the shell to show it.
  //
  // Faithful flow (spec order adjusted — reason recorded):
  //   6a. dispatch the first work from the ROOT perspective (the 团队 tab
  //       is open here and the root session is non-blank) through the
  //       worker row's §40 FOLLOWUP action — the work channel: the frozen
  //       FOLLOW_UP router action runs the P8-S3 work chain (ADMIT_WORK
  //       CREATED→RUNNING → team-work-admitted → delivery + observed turn
  //       completion → SETTLE); the child session becomes non-blank, the
  //       lifecycle changes, and the ledger grows. (The §40 SEND action is
  //       the coordination chat channel — member.send → send-message:
  //       delivered to the child, a turn runs, but NO work lifecycle.)
  //   6b. open the member child Session (D9 nav) — now non-blank, so the
  //       团队 tab is present;
  //   6c. verify the MEMBER perspective (UI §13.2, D7 highlight of the
  //       current member's row).
  // The spec's "submit/follow-up work" is moved BEFORE "open member child
  // Session" for exactly this blank-chrome reason; every spec check still
  // runs (open child -> perspective change -> work -> ledger/activity).
  stepNo = 7
  // The member.create provisioning fact is durable (server-written): wait
  // for it to land in the Team Events section before taking the baseline
  // count — the client re-pulls the ledger page on the projection
  // generation advance, which is an async round trip.
  await page.locator('[data-team-section="ledger"] [data-ledger-row]').first().waitFor({ state: 'visible', timeout: 20_000 })
  const ledgerBefore = await page.locator('[data-team-section="ledger"] [data-ledger-row]').count()
  // 6a. dispatch the first work from the root (the worker row in the root
  //     view) through the WORK channel. Driver gap #5 (attempt-29 die):
  //     the §40 send action on a CREATED row is the coordination CHAT
  //     channel (member.send → send-message: delivered to the child, a
  //     turn runs, but NO work lifecycle — the frozen §29 FSM advances
  //     only via the work chain, so the later archive failed
  //     LIFECYCLE_ILLEGAL_STATE 'CREATED'→'ARCHIVED'). The work channel
  //     is the followup action (发送跟进): member.followup → FOLLOW_UP →
  //     work chain (ADMIT_WORK → RUNNING → delivery → SETTLED). It opens
  //     the work-prompt dialog.
  const workBtnS6 = workerRow.locator('[data-member-action-button="followup"]')
  await expect('followup (work) action present on the worker row (root perspective)', await workBtnS6.count() > 0)
  await workBtnS6.click()
  await page.waitForTimeout(600)
  const promptDialog = page.locator('[data-member-prompt-dialog]')
  const messageDialog = page.locator('[data-member-message-dialog]')
  if ((await promptDialog.count()) === 1) {
    await promptDialog.locator('[data-member-prompt-input]').fill('S8-VERTICAL-WORK-1')
    await promptDialog.locator('[data-member-prompt-submit]').click()
  } else if ((await messageDialog.count()) === 1) {
    await messageDialog.locator('[data-member-message-body]').fill('S8-VERTICAL-WORK-1')
    await messageDialog.locator('[data-member-message-submit]').click()
  } else {
    await screenshot(page, 's6-no-work-dialog')
    await domDump(page, 's6-no-work-dialog')
    die('vertical: no work dialog opened from the worker send action')
  }
  // Wait for the lifecycle to move off 已创建 (the mock turn ends quickly).
  let workStatus = ''
  for (let i = 0; i < 45; i++) {
    await page.waitForTimeout(1000)
    workStatus = (await workerRow.locator('[data-member-status-text]').first().innerText().catch(() => '')) || ''
    if (workStatus !== '' && workStatus !== '已创建') break
  }
  // The work facts (work admitted + message delivered) are durable; the
  // client re-pulls the ledger page on the generation advance — poll for
  // the row growth (the mock reply + status change already settled).
  let ledgerAfter = ledgerBefore
  for (let i = 0; i < 30; i++) {
    ledgerAfter = await page.locator('[data-team-section="ledger"] [data-ledger-row]').count()
    if (ledgerAfter > ledgerBefore) break
    await page.waitForTimeout(500)
  }
  await expect('ledger grew after create+work (durable facts)', ledgerAfter > ledgerBefore, `before=${ledgerBefore} after=${ledgerAfter}`)
  step(`work dispatched from root; worker status=${workStatus}; ledger rows ${ledgerBefore} -> ${ledgerAfter}`)
  await screenshot(page, 's6-work-sent')
  await domDump(page, 's6-work-sent')

  // 6b/6c. open the member child Session (D9) — non-blank now, so the 团队
  // tab is present — and verify the MEMBER perspective (UI §13.2, D7).
  await workerRow.locator('[data-member-instance-nav]').first().click()
  await page.waitForTimeout(1500)
  const teamTabS6 = page.getByRole('tab', { name: '团队' }).first()
  if (await teamTabS6.count() === 0) {
    await screenshot(page, 's6-no-team-tab')
    await domDump(page, 's6-no-team-tab')
    die('vertical: 团队 tab still absent in the member child session after work delivery (the blank-chrome hypothesis is falsified — product-bug candidate)')
  }
  await teamTabS6.click()
  await page.waitForTimeout(2000)
  const workerRowS6 = page.locator('[data-team-section="members"] [data-member-group]:not(:has([data-leader])) [data-member-instance]').first()
  const currentAttr = await workerRowS6.getAttribute('data-current')
  await expect('perspective switched: worker row highlighted in the member child session (D7)', currentAttr !== null && currentAttr !== '')
  step(`member perspective verified: D7 data-current="${currentAttr}"`)
  await screenshot(page, 's6-member-perspective')
  await domDump(page, 's6-member-perspective')

  // ── S7: lifecycle archive/restore on the worker (the §23 matrix) ─────────
  stepNo = 8
  // GAP #6 (attempt-30 autopsy): S7 must run from the TEAM-ROOT session view.
  // The archive succeeds only while the plugin residency (agent-bindings
  // liveAgents) is bound to the member's child session — bound at
  // provisioning, released by the archive itself. On success,
  // release-residency disposes the child handle and the HOST unregisters +
  // removes that session from its live store (agent-bindings.mjs L1225-1228):
  // if the page is displaying that child session (the 6c D7 view), the whole
  // conversation view — 团队 tab included — unmounts and the polled row
  // detaches (the attempt-30 death). Probes s7forensic1-4 (attempt-30) prove:
  //   - a FAILED archive keeps the row in the child view (loud typed error,
  //     LIFECYCLE_LIVE_EFFECT_FAILED 'no live agent', zero durable writes);
  //   - the row detaches only after a SUCCESSFUL archive in the child view;
  //   - the root session is a separate host session, untouched by the
  //     member's residency release — the row updates in place there.
  const ungroupedS7 = page.locator('[role="treeitem"]').filter({ hasText: '未分组' }).first()
  const rootRowS7 = page.locator('[role="treeitem"]').filter({ hasText: 'handoff-ctx' }).first()
  if ((await rootRowS7.count()) === 0 && (await ungroupedS7.count()) > 0) {
    await ungroupedS7.click() // the 未分组 group may have collapsed
    await page.waitForTimeout(1200)
  }
  if ((await rootRowS7.count()) > 0) {
    await rootRowS7.click()
    await page.waitForTimeout(2500)
    const teamTabS7 = page.getByRole('tab', { name: '团队' }).first()
    if ((await teamTabS7.count()) > 0) {
      await teamTabS7.click()
      await page.waitForTimeout(2000)
    }
    step('S7 runs from the team root session view (the child view unmounts on residency release — GAP #6)')
  } else {
    await screenshot(page, 's7-no-root-row')
    await domDump(page, 's7-no-root-row')
    die('vertical: the team root session row is absent from the sidebar (未分组 collapsed or the row missing) — cannot run S7 from the root view')
  }
  const workerRowS7 = page.locator('[data-team-section="members"] [data-member-group]:not(:has([data-leader])) [data-member-instance]').first()
  let rowReadyS7 = false
  for (let i = 0; i < 20 && !rowReadyS7; i++) {
    rowReadyS7 = (await workerRowS7.count()) === 1
    if (!rowReadyS7) await page.waitForTimeout(500)
  }
  await expect('worker row rendered in the root view before S7', rowReadyS7)
  const archiveBtn = workerRowS7.locator('[data-member-action-button="archive"]')
  if (await archiveBtn.count() === 0) {
    await screenshot(page, 's7-no-archive-action')
    await domDump(page, 's7-no-archive-action')
    die('vertical: no archive action on the worker row (the §40 matrix offers archive on every live state)')
  }
  await archiveBtn.click()
  await page.waitForTimeout(800)
  const confirmDialog = page.locator('[data-member-confirm-dialog]')
  await expect('archive confirmation dialog (§23.2)', (await confirmDialog.count()) === 1)
  await confirmDialog.locator('[data-member-confirm-ok]').click()
  let archived = false
  for (let i = 0; i < 30 && !archived; i++) {
    await page.waitForTimeout(1000)
    archived = (await workerRowS7.getAttribute('data-status')) === 'archived'
  }
  await expect('member archived (data-status=archived)', archived)
  await screenshot(page, 's7-archived')
  const restoreBtn = workerRowS7.locator('[data-member-action-button="restore"]')
  await expect('restore action on the archived row', await restoreBtn.count() > 0)
  await restoreBtn.click() // §23.4: direct click, no confirmation
  let restored = false
  for (let i = 0; i < 30 && !restored; i++) {
    await page.waitForTimeout(1000)
    restored = (await workerRowS7.getAttribute('data-status')) !== 'archived'
  }
  await expect('member restored (data-status != archived)', restored)
  await screenshot(page, 's7-restored')

  // ── S8: navigate root → reload/reconnect — same generation & history ─────
  stepNo = 9
  // "navigate root" (spec): S7 already runs from the team root session view
  // (GAP #6); re-assert the root row here before the reload. Both sessions
  // live in the team's defaultWorkspace (unregistered as a workspace), so
  // both rows sit in the sidebar's 未分组 group.
  const rootRowS8 = page.locator('[role="treeitem"]').filter({ hasText: 'handoff-ctx' }).first()
  if ((await rootRowS8.count()) === 0) {
    const ungroupedS8 = page.locator('[role="treeitem"]').filter({ hasText: '未分组' }).first()
    if ((await ungroupedS8.count()) > 0) {
      await ungroupedS8.click()
      await page.waitForTimeout(1200)
    }
  }
  if ((await rootRowS8.count()) > 0) {
    await rootRowS8.click()
    await page.waitForTimeout(2500)
    const teamTabRootS8 = page.getByRole('tab', { name: '团队' }).first()
    if ((await teamTabRootS8.count()) > 0) {
      await teamTabRootS8.click()
      await page.waitForTimeout(2000)
    }
    step('navigated back to the team root session (团队 tab re-opened) before reload')
  } else {
    step('root row not found in sidebar — reloading in the current session instead')
  }
  const before = await page.locator('text=s8v-worker-1').count()
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForSelector('button, [role="tab"]', { timeout: 60_000 })
  await page.waitForTimeout(3000)
  // After reload the Team tab may not be active again — re-open it so the
  // projection (and the member row) is in the DOM.
  const teamTabS8 = page.getByRole('tab', { name: '团队' }).first()
  if (await teamTabS8.count() > 0) {
    await teamTabS8.click()
    await page.waitForTimeout(2000)
  }
  const memberAfter = page.locator('text=s8v-worker-1').first()
  let memberAfterVisible = false
  try {
    await memberAfter.waitFor({ state: 'visible', timeout: 30_000 })
    memberAfterVisible = true
  } catch {
    memberAfterVisible = false
  }
  const after = await memberAfter.count()
  await expect('member survives reload (s8v-worker-1 present)', after > 0, `before=${before} after=${after} visible=${memberAfterVisible}`)
  await screenshot(page, 's8-reloaded')

  // ── S9: typed failure — invalid/disallowed op → Remote typed error →
  //    UI loud error → no fabricated state (plan S8: 至少另做一个 typed failure) ──
  stepNo = 10
  // Part 1 (UI-driven — the plan-mandatory "UI loud error"): the
  // member-message dialog guards only the EMPTY body client-side; the frozen
  // 1..200000 bound is enforced host-side (remote parseRemoteBody → typed
  // `malformed-params`) and a violation "surfaces as the verbatim typed error
  // note" (TeamMemberDialogs JSDoc). Submit a 200001-char body through the
  // real UI path.
  let workerRowS9 = page.locator('[data-team-section="members"] [data-member-group]:not(:has([data-leader])) [data-member-instance]').first()
  let sendAction = workerRowS9.locator('[data-member-action-button="send"]')
  if (await sendAction.count() === 0) {
    // After reload the Team tab may not be active again — re-open it.
    const teamTab = page.getByRole('tab', { name: '团队' }).first()
    if (await teamTab.count() > 0) {
      await teamTab.click()
      await page.waitForTimeout(2000)
    }
    workerRowS9 = page.locator('[data-team-section="members"] [data-member-group]:not(:has([data-leader])) [data-member-instance]').first()
    sendAction = workerRowS9.locator('[data-member-action-button="send"]')
  }
  await expect('send action present on the worker row', await sendAction.count() > 0)
  const rowsBefore = await page.locator('[data-member-instance]').count()
  const statusesBefore = await page.locator('[data-member-instance]').evaluateAll((els) => els.map((e) => e.getAttribute('data-status')))
  await sendAction.first().click()
  await page.waitForTimeout(500)
  const msgDialog = page.locator('[data-member-message-dialog]')
  await expect('member message dialog open', (await msgDialog.count()) === 1)
  await msgDialog.locator('textarea').last().fill('S'.repeat(200001))
  await msgDialog.locator('[data-member-message-submit]').click()
  const failNote = page.locator('[data-member-command-error]')
  await failNote.first().waitFor({ timeout: 30_000 })
  const failText = (await failNote.first().innerText()).trim()
  step(`UI typed error note: ${failText.slice(0, 300)}`)
  await expect('loud error is the verbatim typed note (命令失败： + malformed-params)', failText.includes('命令失败：') && failText.includes('malformed-params'))
  await screenshot(page, 's9a-ui-typed-failure')
  await domDump(page, 's9a-ui-typed-failure')
  // No fabricated state: identical rows, identical statuses, no waiting badge.
  const rowsAfter = await page.locator('[data-member-instance]').count()
  const statusesAfter = await page.locator('[data-member-instance]').evaluateAll((els) => els.map((e) => e.getAttribute('data-status')))
  const pendingBadges = await page.locator('[data-member-waiting]').count()
  await expect('no fabricated state (row count unchanged)', rowsBefore === rowsAfter, `before=${rowsBefore} after=${rowsAfter}`)
  await expect('no fabricated state (row statuses unchanged)', JSON.stringify(statusesBefore) === JSON.stringify(statusesAfter), `before=${JSON.stringify(statusesBefore)} after=${JSON.stringify(statusesAfter)}`)
  step(`no fabricated state: rows=${rowsAfter} statuses=${JSON.stringify(statusesAfter)} pendingBadges=${pendingBadges}`)

  // Part 2 (contract-level probe): an invalid TARGET through the public
  // channel. Frozen contract semantics: typed errors are HTTP 200 with the
  // typed error block in `result` (the dispatcher never rejects); a token
  // that parses as an instance id but resolves to no record is
  // INSTANCE_NOT_FOUND (runtime admission resolve.ts).
  let teamSessionId = 's8v-root'
  const teamCreateEntry = netTrace.filter((e) => e.kind === 'team-remote' && e.url.includes('team.create')).pop()
  try {
    const parsed = JSON.parse(teamCreateEntry?.responseBody ?? 'null')
    teamSessionId = parsed?.result?.data?.teamSessionId ?? parsed?.result?.teamSessionId ?? teamSessionId
  } catch { /* keep default */ }
  const absentProbe = await page.evaluate(async ({ teamSessionId }) => {
    const r = await fetch('/team-remote/member.send', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        type: 'client-request',
        rpcId: `s8v-ft-${Date.now()}`,
        method: 'member.send',
        payload: {
          version: 1,
          params: {
            teamSessionId,
            caller: { kind: 'human', humanId: teamSessionId },
            recipientInstanceId: 'inst-s8vnonexistent1',
            body: 'S8 typed-failure probe (expect INSTANCE_NOT_FOUND)',
            requestToken: `s8v-ft-${Date.now()}`,
          },
        },
      }),
    })
    const text = await r.text()
    return { status: r.status, body: text.slice(0, 1500) }
  }, { teamSessionId })
  let absentCode = null
  try { absentCode = JSON.parse(absentProbe.body)?.result?.error?.code ?? null } catch { /* unparseable */ }
  step(`absent-target probe: status=${absentProbe.status} code=${absentCode} body=${absentProbe.body.slice(0, 300)}`)
  await screenshot(page, 's9b-contract-probe')

  // ── summary ───────────────────────────────────────────────────────────────
  const teamRemoteCalls = netTrace.filter((e) => e.kind === 'team-remote')
  writeFileSync(join(OUT, 'vertical-summary.json'), JSON.stringify({
    mode: 'vertical',
    finishedAt: new Date().toISOString(),
    teamRemoteCalls: teamRemoteCalls.map((e) => ({ url: e.url, status: e.status, rpcId: e.rpcId ?? null })),
    consoleErrorCount: consoleEvents.filter((e) => e.type === 'error').length,
    pageErrorCount: pageErrors.length,
    failProbe: {
      uiTypedError: {
        note: failText.slice(0, 500),
        rowsBefore, rowsAfter,
        statusesBefore, statusesAfter,
        pendingBadges,
      },
      absentTarget: { teamSessionId, status: absentProbe.status, code: absentCode, body: absentProbe.body },
    },
  }, null, 2))
  step(`vertical complete — teamRemoteCalls=${teamRemoteCalls.length}`)
}

main().catch((e) => die(String(e?.stack ?? e)))
