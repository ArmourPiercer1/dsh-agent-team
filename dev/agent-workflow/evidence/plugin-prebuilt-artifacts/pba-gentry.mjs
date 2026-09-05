/**
 * PBA-GENTRY browser driver (Playwright, standalone — no vitest).
 *
 * plugin-prebuilt-artifacts D5-equivalent step 4 (copy of the PBF d5-gentry.mjs
 * kit; PBA world prefix): the same G0–G4 browser
 * gentry as the R125 verified kit, run against the BUNDLE-FORM install
 * (pba-setup.mjs + pba-boot.mjs). Derived from s8-gentry-r125.mjs — audited
 * replacements only:
 *   - state file: <EV>/pba-state-<stamp>.json (pba-boot's output; newest
 *     matches the world, or PBA_STAMP env pins it);
 *   - TEST_USE_WEB: 4 ups from this evidence dir (sibling of the
 *     P9-master-closure dir — same depth, no correction needed);
 *   - blueprint id: `my-team-bp-1` (the SHIPPED bundle-layer default
 *     blueprint, not the R125 world's hand-written s8v-bp-1) — G3's
 *     explicit-pick flow exercises exactly what the bundle doc ships.
 * Everything else (steps, gates, evidence, die/teardown) is byte-identical.
 *
 * Steps:
 *   G0 shell + first-run + workspace adoption + sidebar global New Team entry present
 *   G1 entry click -> Team-owned creation overlay (R118): panel mounted WITHOUT
 *      any handoff block, blueprint select in loud unselected state (R119-1:
 *      value '' + disabled placeholder option), create disabled
 *   G2 cancel -> overlay closes
 *   G3 entry click again -> fresh draft (R121: workspace select prefilled
 *      from the current session's workspace) -> explicit blueprint pick ->
 *      probe OPEN (✓ 就绪) -> create ENABLED -> click -> team.create ok,
 *      overlay closes, lands on the new team root — §4.3 boundary "no Root
 *      turn yet": the 团队 tab row is message-gated, so send the FIRST
 *      message to materialize the tab row, then open the 团队 tab and assert
 *      the created team is bound (zero state gone); also assert the created
 *      Root row appears in the adopted workspace sidebar (R121 no-orphan)
 *   G4 second session (empty -> first message unlocks the tab row, §4.3)
 *      -> 团队 tab zero state -> 从此处开始团队 -> panel with handoff face:
 *      placeholder state (R119-1 on the session path), enable handoff, wait
 *      for the FIRST prepare to settle, type two initial-work changes,
 *      assert handoff.prepare was called EXACTLY ONCE and the summary stays
 *      stable (R119-2 flicker regression, browser-level)
 *
 * Evidence: <EV>/browser/gentry-*.png/.html + gentry-report.json.
 * Reads <EV>/pba-state-<stamp>.json (token/workspaceDir) — pba-boot must be PBA-READY.
 */

import { readFileSync, mkdirSync, writeFileSync, existsSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const EV = dirname(fileURLToPath(import.meta.url))
const OUT = join(EV, 'browser')
// D5 VARIANT: pba-boot writes pba-state-<stamp>.json (newest by default,
// PBA_STAMP pins it).
function resolveStateFile() {
  if (process.env.PBA_STAMP) return join(EV, `pba-state-${process.env.PBA_STAMP}.json`)
  const files = readdirSync(EV).filter((f) => /^pba-state-.+\.json$/.test(f)).sort()
  if (files.length === 0) throw new Error('no pba-state-*.json in EV — run pba-boot.mjs boot first')
  return join(EV, files[files.length - 1])
}
const STATE_FILE = resolveStateFile()
// D5 VARIANT: the test-use checkout lives in the MAIN repository (this
// evidence dir may sit in a task worktree, whose checkout carries no
// untracked references/ entries) — walk up to the ancestor that carries it.
function findMainRepoRoot(start) {
  let dir = start
  for (;;) {
    if (existsSync(join(dir, 'references', 'deepseek-harness-test-use'))) return dir
    const parent = dirname(dir)
    if (parent === dir) throw new Error(`no ancestor of ${start} contains references/deepseek-harness-test-use`)
    dir = parent
  }
}
const MAIN_REPO = findMainRepoRoot(EV)
const TEST_USE_WEB = join(MAIN_REPO, 'references', 'deepseek-harness-test-use', 'apps', 'web')

const state = JSON.parse(readFileSync(STATE_FILE, 'utf8'))
const origin = `http://127.0.0.1:${state.port}`
const token = state.token
if (!token) die(`${STATE_FILE} has no token`)
mkdirSync(OUT, { recursive: true })

// ── playwright resolution (per S8 driver decision) ──────────────────────────
const requireFromWeb = createRequire(join(TEST_USE_WEB, 'package.json'))
const { chromium } = requireFromWeb('playwright')

// ── evidence accumulators ───────────────────────────────────────────────────
const consoleEvents = []
const pageErrors = []
const netTrace = []
let stepNo = 0
// Populated by main() so die() can persist a PARTIAL report (failures so
// far + results so far) — a hard die used to skip the report write entirely.
let partialState = null

function die(msg) {
  console.error(`FAIL — ${msg}`)
  try {
    writeFileSync(join(OUT, 'gentry-console.json'), JSON.stringify({ consoleEvents, pageErrors }, null, 2))
    writeFileSync(join(OUT, 'gentry-trace.json'), JSON.stringify(netTrace, null, 2))
    if (partialState) {
      const report = {
        at: new Date().toISOString(),
        origin,
        failures: partialState.failures,
        results: partialState.results,
        rpcs: netTrace.filter((e) => e.kind === 'team-remote').map((e) => ({
          url: e.url,
          status: e.status,
          method: e.requestBody ? e.requestBody.slice(0, 120) : null,
        })),
        consoleErrors: consoleEvents.filter((e) => e.type === 'error'),
        pageErrors,
        partial: true,
      }
      writeFileSync(join(OUT, 'gentry-report.json'), JSON.stringify(report, null, 2))
    }
  } catch { /* evidence write is best-effort */ }
  process.exit(1)
}
const step = (line) => console.log(`[pba-gentry] ${line}`)

async function screenshot(page, tag) {
  const p = join(OUT, `gentry-${String(stepNo).padStart(2, '0')}-${tag}.png`)
  await page.screenshot({ path: p, fullPage: false })
  step(`screenshot → ${p}`)
}
async function domDump(page, tag) {
  const p = join(OUT, `gentry-${String(stepNo).padStart(2, '0')}-${tag}.html`)
  const html = await page.content()
  writeFileSync(p, html)
  step(`dom dump → ${p} (${html.length} chars)`)
  return html
}

// Team-remote RPC calls observed on the wire (POST /team-remote, JSON body
// carries the method name, e.g. "handoff.prepare").
function rpcCalls(method) {
  return netTrace.filter(
    (e) => e.kind === 'team-remote' && e.requestBody && e.requestBody.includes(method),
  )
}

async function main() {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  const failures = []
  const results = {}
  partialState = { failures, results }
  const expect = async (label, cond, extra) => {
    const ok = !!cond
    if (!ok) failures.push(label)
    step(`${ok ? 'PASS' : 'FAIL'} — ${label}${extra !== undefined ? ` (${JSON.stringify(extra)})` : ''}`)
    return ok
  }

  page.on('console', (msg) => consoleEvents.push({ type: msg.type(), text: msg.text().slice(0, 500) }))
  page.on('pageerror', (err) => pageErrors.push(String(err).slice(0, 1000)))
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
        : 'other',
    }
    if (entry.kind === 'team-remote') {
      try {
        const body = await res.text()
        entry.responseBody = body.slice(0, 2000)
      } catch { /* not readable */ }
    }
    netTrace.push(entry)
  })
  page.on('request', (req) => {
    if (req.method() !== 'POST') return
    const u = new URL(req.url())
    if (u.pathname.startsWith('/team-remote')) {
      try {
        const post = req.postData()
        if (post) {
          const parsed = JSON.parse(post)
          const target = [...netTrace].reverse().find((e) => e.kind === 'team-remote' && e.requestBody === undefined && e.url === req.url().slice(0, 300))
          if (target) target.requestBody = post.slice(0, 2000)
          else netTrace.push({ method: 'POST', url: req.url().slice(0, 300), status: null, t: Date.now(), kind: 'team-remote', requestBody: post.slice(0, 2000), note: 'request-only' })
        }
      } catch { /* non-JSON */ }
    }
  })

  // ── G0: shell + first-run + workspace + global entry present ──────────────
  stepNo = 1
  step('open ' + origin)
  const launchUrl = new URL(origin)
  launchUrl.searchParams.set('token', token)
  const resp = await page.goto(launchUrl.href, { waitUntil: 'domcontentloaded', timeout: 60_000 })
  step(`initial response: ${resp?.status()} → ${page.url()}`)
  await page.waitForSelector('button, [role="tab"]', { timeout: 60_000 })
  await page.waitForTimeout(2500)
  await screenshot(page, 'shell')

  const betaBtn = page.locator('button:has-text("继续")').first()
  if (await betaBtn.isVisible().catch(() => false)) {
    await betaBtn.click()
    await page.waitForTimeout(1500)
    step('first-run notice dismissed (继续)')
  } else {
    step('no first-run notice present')
  }

  // Workspace adoption (fresh home: composer inert until a workspace exists).
  const wsBtn = page.locator('button[aria-label="选择工作区"]').first()
  const composerInert = await page.getByText('选择一个工作区开始').first().isVisible().catch(() => false)
  if (composerInert && (await wsBtn.count() > 0) && await wsBtn.isEnabled().catch(() => false)) {
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

  // R118: the ALWAYS-DISCOVERABLE global New Team entry in the sidebar footer
  // (independent of any open session). Try the pinned label forms.
  stepNo = 2
  const entryCandidates = [
    ['aria-label 新建团队', page.locator('button[aria-label="新建团队"]').first()],
    ['aria-label New Team', page.locator('button[aria-label="New Team"]').first()],
    ['text 新建团队 (button)', page.locator('button:has-text("新建团队")').first()],
    ['text New Team (button)', page.locator('button:has-text("New Team")').first()],
  ]
  let entry = null
  let entrySel = null
  for (const [name, loc] of entryCandidates) {
    if (await loc.isVisible().catch(() => false)) {
      entry = loc
      entrySel = name
      break
    }
  }
  await expect('R118 global entry visible in sidebar footer (before any session)', entry !== null, { tried: entryCandidates.map((c) => c[0]), hit: entrySel })
  if (!entry) {
    await domDump(page, 'no-entry')
    die('global New Team entry not found — dumping shell DOM')
  }
  await screenshot(page, 'entry-visible')

  // ── G1: open overlay — R118 shape + R119-1 loud unselected state ──────────
  stepNo = 3
  await entry.click()
  await page.waitForTimeout(1500)
  const createBtn = page.locator('[data-intent-create]').first()
  let panelOpen = false
  try {
    await createBtn.waitFor({ state: 'visible', timeout: 15_000 })
    panelOpen = true
  } catch { /* not open */ }
  await expect('overlay: TeamCreationPanel mounted after entry click', panelOpen)
  if (!panelOpen) {
    await domDump(page, 'overlay-not-open')
    die('creation overlay did not open')
  }
  await expect('R118 overlay has NO handoff block (no source session)', (await page.locator('[data-intent-handoff]').count()) === 0, { handoffBlocks: await page.locator('[data-intent-handoff]').count() })

  const bpSelect = page.locator('select[data-intent-blueprint]').first()
  await expect('R119-1 blueprint select present in overlay', (await bpSelect.count()) > 0)
  const bpValue = await bpSelect.evaluate((el) => el.value).catch(() => null)
  const bpOptions = await bpSelect.locator('option').evaluateAll((els) => els.map((o) => ({ value: o.value, text: o.textContent, disabled: o.disabled }))).catch(() => null)
  await expect('R119-1 unselected state is LOUD: select.value === ""', bpValue === '', { bpValue, options: bpOptions })
  const placeholder = (bpOptions ?? []).find((o) => o.value === '')
  await expect('R119-1 disabled placeholder option rendered (选择蓝图…/Select a blueprint…)', !!placeholder && placeholder.disabled === true && /选择蓝图…|Select a blueprint…/.test(placeholder.text), { placeholder })
  await expect('create button disabled while unselected', (await createBtn.isEnabled().catch(() => true)) === false)
  await expect('catalog.list observed on the wire', rpcCalls('catalog.list').length > 0, { n: rpcCalls('catalog.list').length })
  await screenshot(page, 'overlay-unselected')
  await domDump(page, 'overlay-unselected')
  results.g1 = { bpValue, bpOptions, createEnabled: await createBtn.isEnabled().catch(() => true) }

  // ── G2: cancel closes the overlay ─────────────────────────────────────────
  stepNo = 4
  const cancelBtn = page.locator('[data-intent-cancel]').first()
  await cancelBtn.click()
  await page.waitForTimeout(1000)
  const gone = await createBtn.isVisible().catch(() => false)
  await expect('cancel closes the overlay', gone === false, { stillVisible: gone })
  await screenshot(page, 'overlay-cancelled')

  // ── G3: reopen -> fresh draft -> pick -> probe OPEN -> create ─────────────
  stepNo = 5
  await entry.click()
  await page.waitForTimeout(1500)
  await createBtn.waitFor({ state: 'visible', timeout: 15_000 })
  const bpValue2 = await page.locator('select[data-intent-blueprint]').first().evaluate((el) => el.value).catch(() => null)
  await expect('reopened overlay has a FRESH draft (value "")', bpValue2 === '', { bpValue2 })

  // R121 (live-trial finding): the fresh draft's workspace select must be
  // prefilled from the shell's current selection (the workspace containing
  // the current session) — otherwise the create lands the Root in the
  // native Default (process-cwd) workspace and orphans the created team
  // from the user's workspace sidebar/mirror.
  const wsSel = page.locator('select[data-intent-workspace]').first()
  const wsPrefill = await wsSel.evaluate((el) => el.value).catch(() => null)
  await expect('R121 fresh draft workspace prefilled (non-empty)', typeof wsPrefill === 'string' && wsPrefill !== '', { wsPrefill })

  const sel = page.locator('select[data-intent-blueprint]').first()
  const opts = await sel.locator('option').allTextContents().catch(() => [])
  step(`blueprint options: ${JSON.stringify(opts)}`)
  // D5 VARIANT: the shipped bundle-layer default blueprint (my-team-bp-1)
  // — G3's explicit pick exercises exactly what the bundle doc ships.
  const bpOpt = opts.find((o) => o.includes('my-team-bp-1'))
  await expect('my-team-bp-1 option available (shipped bundle blueprint)', !!bpOpt, { opts })
  if (!bpOpt) die('no my-team-bp-1 option')
  await sel.selectOption({ label: bpOpt })
  step('blueprint picked explicitly (my-team-bp-1, shipped)')

  const ready = page.locator('text=✓ 就绪')
  let readyVisible = false
  try {
    await ready.waitFor({ state: 'visible', timeout: 60_000 })
    readyVisible = true
  } catch { readyVisible = false }
  await expect('compatibility settles at ✓ 就绪 (probe OPEN)', readyVisible)
  await expect('create button ENABLED after probe OPEN', (await createBtn.isEnabled().catch(() => false)) === true)
  await expect('intent.probe observed on the wire', rpcCalls('intent.probe').length > 0, { n: rpcCalls('intent.probe').length })
  await screenshot(page, 'ready-to-create')

  const createBefore = rpcCalls('team.create').length
  await createBtn.click()
  step('create clicked; waiting for team.create + overlay close')
  let overlayClosed = false
  try {
    await createBtn.waitFor({ state: 'hidden', timeout: 60_000 })
    overlayClosed = true
  } catch { overlayClosed = false }
  await page.waitForTimeout(2500)
  const createCalls = rpcCalls('team.create')
  await expect('team.create observed on the wire', createCalls.length > createBefore, { before: createBefore, after: createCalls.length })
  // Grade the RESPONSE entry (carries responseBody). Event-ordering artifact:
  // when the request event is processed before the response event, the
  // response entry never gets a backfilled requestBody and rpcCalls() (which
  // matches on requestBody) excludes it — so search netTrace directly.
  const createResp = [...netTrace].reverse().find((e) => e.kind === 'team-remote' && (e.url ?? '').includes('/team.create') && e.responseBody !== undefined) ?? createCalls[createCalls.length - 1]
  const createOk = !!createResp && createResp.status === 200 && !/error/i.test(createResp.responseBody ?? '')
  await expect('team.create response ok', createOk, createResp ? { status: createResp.status, body: (createResp.responseBody ?? '').slice(0, 300) } : null)
  await expect('overlay closed after successful create', overlayClosed, { overlayClosed })

  // The created Root session id, from the team.create REQUEST params (always
  // present — the panel sends it), response body as fallback — used below to
  // assert the client mirror probes EXACTLY this session.
  let rootSessionId = null
  try {
    const reqEntry = createCalls.find((c) => c.requestBody)
    rootSessionId = (reqEntry?.requestBody ?? '').match(/"rootSessionId"\s*:\s*"([^"]+)"/)?.[1] ?? null
    if (!rootSessionId && createResp?.responseBody) {
      rootSessionId = createResp.responseBody.match(/"rootSessionId"\s*:\s*"([^"]+)"/)?.[1] ?? null
    }
  } catch { rootSessionId = null }
  await expect('rootSessionId recoverable from team.create request', !!rootSessionId, { rootSessionId })

  // R121 no-orphan check (part 1): snapshot the adopted workspace's sidebar
  // section BEFORE the first message. Note (empirical, fresh world): native
  // sidebar rows for zero-message sessions only materialize once the session
  // has a turn, so the decisive count (part 2) runs AFTER the first message.
  // Without the workspace prefill the Root lands in the native Default
  // (process-cwd) workspace and that section never gains the Root's row.
  // Sidebar structure (probe5): each jpBoma_*groupSection holds wrapper
  // spans, each wrapping ONE [role=treeitem] row (workspace projectRow and
  // per-session sessionRow); hashed class tails ('groupSection',
  // 'sessionRow') are stable CSS-module local names.
  const wsTitle = state.workspaceDir.split(/[\\/]/).filter(Boolean).pop()
  const countWsSessions = () => page.evaluate((title) => {
    const titleSpans = Array.from(document.querySelectorAll('span'))
      .filter((el) => el.textContent.trim() === title)
    const sec = titleSpans.map((t) => t.closest('[class*="groupSection"]')).find(Boolean)
    if (!sec) return { found: false, n: -1, texts: [], selectedIn: -1 }
    const rows = Array.from(sec.querySelectorAll('[role="treeitem"][class*="sessionRow"]'))
    return {
      found: true,
      n: rows.length,
      texts: rows.map((el) => el.textContent.trim().slice(0, 40)),
      selectedIn: rows.filter((el) => el.getAttribute('aria-selected') === 'true').length,
    }
  }, wsTitle)
  const wsBefore = await countWsSessions().catch(() => ({ found: false, n: -1, texts: [], selectedIn: -1 }))

  const teamTab = page.getByRole('tab', { name: '团队' }).first()

  // §4.3 boundary: the created Root has NO turn yet — the native tab row
  // (incl. 团队) is message-gated, so the team tab is correctly ABSENT here.
  let tabAbsentAtBoundary = true
  try {
    await teamTab.waitFor({ state: 'hidden', timeout: 5_000 })
  } catch { tabAbsentAtBoundary = false }
  await expect('§4.3 boundary: no 团队 tab before the first Root turn (message-gated tab row)', tabAbsentAtBoundary)

  // The team officially starts on the FIRST message (frozen §4.3): send it.
  const composer = page.locator('textarea, [contenteditable="true"]').last()
  await composer.click()
  if ((await composer.evaluate((el) => el.tagName).catch(() => '')) === 'TEXTAREA') {
    await composer.fill('S8 gentry team first message')
  } else {
    await composer.type('S8 gentry team first message')
  }
  await page.locator('button[aria-label="发送消息"]').first().click()
  step('first message sent to the created Root (§4.3: the team starts here)')

  let teamTabVisible = false
  try {
    await teamTab.waitFor({ state: 'visible', timeout: 60_000 })
    teamTabVisible = true
  } catch { teamTabVisible = false }
  await expect('团队 tab appears after the first Root message', teamTabVisible, { teamTabVisible })
  if (teamTabVisible) {
    await teamTab.click()
    await page.waitForTimeout(2000)
    const zeroStateG3 = (await page.locator('[data-intent-start-here]').count()) > 0
      || (await page.getByText('当前会话未加入任何团队').first().isVisible().catch(() => false))
    await expect('created team is bound in the Root (team view rendered, zero state gone)', !zeroStateG3, { zeroStateG3 })
    const projForRoot = rpcCalls('team.getProjection').filter((c) => (c.requestBody ?? '').includes(rootSessionId ?? '∅'))
    await expect('team.getProjection observed for the created Root session', projForRoot.length > 0, { n: projForRoot.length, rootSessionId })

    // R121 no-orphan check (part 2, DECISIVE): now that the created Root has
    // its first turn, its sidebar row must exist INSIDE the adopted
    // workspace's section (and be the selected row — the Root is the current
    // session). Without the workspace prefill the row would appear under the
    // native Default (process-cwd) workspace instead, and this section stays
    // empty.
    await page.waitForFunction((title) => {
      const titleSpans = Array.from(document.querySelectorAll('span'))
        .filter((el) => el.textContent.trim() === title)
      const sec = titleSpans.map((t) => t.closest('[class*="groupSection"]')).find(Boolean)
      if (!sec) return false
      const rows = Array.from(sec.querySelectorAll('[role="treeitem"][class*="sessionRow"]'))
      return rows.length >= 1
    }, wsTitle, { timeout: 15_000 }).catch(() => {})
    const wsAfterFirstMessage = await countWsSessions().catch(() => ({ found: false, n: -1, texts: [], selectedIn: -1 }))
    await expect('R121 created Root row appears in the adopted workspace sidebar (selected, after first message)', wsAfterFirstMessage.found && wsAfterFirstMessage.n >= 1 && wsAfterFirstMessage.selectedIn >= 1, { before: wsBefore, after: wsAfterFirstMessage })
  }
  await screenshot(page, 'team-created')
  await domDump(page, 'team-created')
  results.g3 = { createBefore, createAfter: createCalls.length, createOk, overlayClosed, rootSessionId, wsPrefill, wsBefore, tabAbsentAtBoundary, teamTabVisible }

  // ── G4: second session -> team-tab zero state -> R119-1 + R119-2 ──────────
  stepNo = 6
  // Second session in the adopted workspace: prefer the per-workspace
  // 新建会话 button (explicit workspace scope; rc.1 label: 在“X”中新建会话),
  // fall back to the generic 新会话 / 新建会话 buttons, and lastly to the
  // first-message fallback.
  const newSessionBtn = page.locator('button[aria-label*="中新建会话"]').first()
  const newSessionBtnAlt = page.locator('button:has-text("新会话"), button[aria-label="新建会话"]').first()
  let made = false
  for (const btn of [newSessionBtn, newSessionBtnAlt]) {
    if ((await btn.count()) > 0 && await btn.isVisible().catch(() => false) && await btn.isEnabled().catch(() => false)) {
      await btn.click()
      await page.waitForTimeout(3000)
      made = true
      step('second session opened (新建会话/新会话)')
      break
    }
  }
  if (!made) {
    step('新会话 absent/disabled — first-message fallback')
    const composer = page.locator('textarea, [contenteditable="true"]').last()
    await composer.click()
    if ((await composer.evaluate((el) => el.tagName).catch(() => '')) === 'TEXTAREA') {
      await composer.fill('S8 gentry session 2')
    } else {
      await composer.type('S8 gentry session 2')
    }
    await page.locator('button[aria-label="发送消息"]').first().click()
  }
  // §4.3: an empty session has no tab row (native message gating). If the
  // 团队 tab is not up within a short window, send the first message to
  // materialize the tab row before proceeding.
  let teamTab2Visible = false
  try {
    await teamTab.waitFor({ state: 'visible', timeout: 4000 })
    teamTab2Visible = true
  } catch { teamTab2Visible = false }
  if (!teamTab2Visible) {
    step('second session empty (§4.3 no turn yet) — sending first message to unlock the tab row')
    const composer2 = page.locator('textarea, [contenteditable="true"]').last()
    await composer2.click()
    if ((await composer2.evaluate((el) => el.tagName).catch(() => '')) === 'TEXTAREA') {
      await composer2.fill('S8 gentry session 2')
    } else {
      await composer2.type('S8 gentry session 2')
    }
    await page.locator('button[aria-label="发送消息"]').first().click()
    await page.waitForTimeout(1500)
  }
  try {
    await teamTab.waitFor({ state: 'visible', timeout: 60_000 })
    teamTab2Visible = true
  } catch { teamTab2Visible = false }
  await expect('second session shows the 团队 tab (after first message, §4.3)', teamTab2Visible)
  await teamTab.click()
  await page.waitForTimeout(1500)

  const startHere = page.locator('[data-intent-start-here]').first()
  await expect('zero state 从此处开始团队 present', (await startHere.count()) > 0)
  await startHere.click()
  await page.waitForTimeout(1500)
  const createBtn2 = page.locator('[data-intent-create]').first()
  await createBtn2.waitFor({ state: 'visible', timeout: 15_000 })
  await expect('R118 overlay shape on session path: handoff block PRESENT', (await page.locator('[data-intent-handoff]').count()) > 0, { handoffBlocks: await page.locator('[data-intent-handoff]').count() })
  const sel2 = page.locator('select[data-intent-blueprint]').first()
  const bpValue3 = await sel2.evaluate((el) => el.value).catch(() => null)
  const bpOptions3 = await sel2.locator('option').evaluateAll((els) => els.map((o) => ({ value: o.value, text: o.textContent, disabled: o.disabled }))).catch(() => null)
  await expect('R119-1 session path: loud unselected state', bpValue3 === '', { bpValue3, options: bpOptions3 })
  await expect('R119-1 session path: disabled placeholder option', !!((bpOptions3 ?? []).find((o) => o.value === '' && o.disabled)), { options: bpOptions3 })
  await screenshot(page, 'session-panel-unselected')

  // Enable handoff (checkbox) -> the FIRST prepare must settle.
  const handoffCb = page.locator('[data-intent-handoff-checkbox]').first()
  if ((await handoffCb.count()) > 0 && !(await handoffCb.isChecked().catch(() => false))) {
    await handoffCb.click()
    await page.waitForTimeout(500)
    step('handoff checkbox enabled')
  }
  const ready2 = page.locator('[data-intent-handoff-ready]').first()
  let handoffReady = false
  try {
    await ready2.waitFor({ state: 'visible', timeout: 60_000 })
    handoffReady = true
  } catch { handoffReady = false }
  await expect('first handoff.prepare settled (summary ready)', handoffReady)
  // The summary preview body renders lazily (behind the 预览 button — the
  // user-facing flow), so open it before reading the title text.
  await page.locator('[data-intent-handoff-preview]').first().click().catch(() => {})
  await page.waitForTimeout(300)
  const summaryText1 = await page.locator('[data-intent-handoff-summary-title]').first().textContent().catch(() => null)
  const prepareN1 = rpcCalls('handoff.prepare').length
  await expect('handoff.prepare called exactly once before typing', prepareN1 === 1, { prepareN1 })

  // R119-2 regression: two initial-work changes (keystroke-equivalents) must
  // NOT re-fire prepare and must NOT disturb the settled summary.
  const iw = page.locator('[data-intent-initial-work]').first()
  await expect('initial-work textarea present', (await iw.count()) > 0)
  await iw.fill('trial regression typing A')
  await page.waitForTimeout(400)
  const midPreparing = await page.locator('[data-intent-handoff-preparing]').count().catch(() => -1)
  await iw.fill('trial regression typing AB')
  await page.waitForTimeout(1200)
  const prepareN2 = rpcCalls('handoff.prepare').length
  const summaryText2 = await page.locator('[data-intent-handoff-summary-title]').first().textContent().catch(() => null)
  const stillReady = await ready2.isVisible().catch(() => false)
  await expect('R119-2 prepare NOT re-fired by keystrokes (still exactly once)', prepareN2 === 1, { before: prepareN1, after: prepareN2 })
  await expect('R119-2 summary text stable across typing', summaryText2 === summaryText1 && summaryText1 !== null, { summaryText1, summaryText2 })
  await expect('R119-2 handoff block stays ready (no flicker back to preparing)', stillReady, { stillReady, midPreparing })
  await screenshot(page, 'no-flicker-after-typing')
  await domDump(page, 'no-flicker-after-typing')
  results.g4 = { prepareN1, prepareN2, summaryText1, summaryText2, stillReady, midPreparing }

  // ── report ────────────────────────────────────────────────────────────────
  const report = {
    at: new Date().toISOString(),
    origin,
    failures,
    results,
    rpcs: netTrace.filter((e) => e.kind === 'team-remote').map((e) => ({
      url: e.url,
      status: e.status,
      method: e.requestBody ? e.requestBody.slice(0, 120) : null,
    })),
    consoleErrors: consoleEvents.filter((e) => e.type === 'error'),
    pageErrors,
  }
  writeFileSync(join(OUT, 'gentry-report.json'), JSON.stringify(report, null, 2))
  step(`report → ${join(OUT, 'gentry-report.json')}`)
  step(`team-remote RPCs: ${report.rpcs.length}; failures: ${failures.length ? JSON.stringify(failures) : 'none'}`)

  await browser.close()
  if (failures.length > 0) {
    console.error(`GENTRY FAILURES: ${failures.length}`)
    process.exit(1)
  }
  step('GENTRY COMPLETE — all checks passed')
}

main().catch((e) => die(String(e?.stack ?? e)))
