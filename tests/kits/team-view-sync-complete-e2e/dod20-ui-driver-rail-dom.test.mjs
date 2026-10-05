/**
 * dod20-ui-driver-rail-dom.test.mjs — OFFLINE faithful-DOM tests for the RAIL
 * NAVIGATION seam (node --test; no browser executable, no host, no network).
 *
 * WHY THIS FILE EXISTS (raw acceptance 2026-10-05T18-50-45Z, job bash-2336):
 * the one live v4 run reached E2 but E1 and E3/E5 died BEFORE their product
 * windows with `locate-not_found`, hits 0 and railRowCount 0. The captured
 * failure carried no rail DOM, and every offline rail test up to that point
 * drove a hand-written markup/class model that the product cannot produce:
 *   * `W0d-vW_title` exists NOWHERE in the pinned 0.2.0-rc.2 tree (grep over
 *     tests/deepseek-harness-test-use returns only this kit's own files) —
 *     `css.title` in rows/Rows.module.css is a CSS-module class whose shipped
 *     name is compiler-generated, so a captured hash is not an identifier;
 *   * the rows carry stable semantics the model ignored: role=treeitem,
 *     data-row-key="session:<id>" / "workspace:<key>" / "overflow:<key>",
 *     aria-expanded (Rows.tsx ProjectRowItem, WorkspaceBrowser.tsx:585);
 *   * group state is `aria-expanded`, NEVER inferable from "no rows rendered"
 *     (a collapsed group legitimately renders zero session rows:
 *     WorkspaceBrowser.tsx:423 + expandedGroups :331);
 *   * every label is localized (`group.ungrouped` = Ungrouped/未分组,
 *     `sessions.expand` = "Show {n} more sessions"/展开其余 {n} 个会话), so an
 *     English regex is a locale assumption;
 *   * the sidebar is 264..420px wide (ui-layout/src/client/columns.ts
 *     SIDEBAR_MIN/DEFAULT/MAX), so a fixed x bound cannot be row identity.
 *
 * These tests therefore run THE SAME code the live lane runs:
 *   - the driver's exported railCollectorSource() STRING, executed verbatim
 *     inside the repo's own jsdom (tests/paths.mjs TEST_USE runtime) over
 *     markup transcribed from the pinned upstream JSX, with a fake layout
 *     engine supplying real getBoundingClientRect() geometry;
 *   - the driver's exported navigate() — the actual navigation seam — against
 *     a page whose collectLeaves/clickLeaf go through that DOM, clicking by
 *     COORDINATES exactly like createPlaywrightPage().clickLeaf does, and
 *     letting the click BUBBLE to a real listener on the real row element;
 *   - the same NetworkLog + wire-text response path identity verification
 *     already uses.
 * There is deliberately NO second navigation model here: delete the driver's
 * structural navigation and these tests fail.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { ROOT_ID, ROOT_TITLE, MEMBER_ID, MEMBER_TITLE, MEMBER_INSTANCE, loadRepoJsdom } from './dod20-ui-driver-fixtures.mjs'
import { createNetworkLog, FailClosed, navigate, railCollectorSource } from './dod20-ui-driver.mjs'

// Frozen upstream i18n literals (client/ui-workspace/src/client/locales.ts
// :10/:32/:33 en+zh). Verbatim, because a locale-dependent locator is a defect.
const L = {
  en: { ungrouped: 'Ungrouped', expand: (n) => `Show ${n} more sessions`, collapse: 'Show less', newSession: 'New Session' },
  zh: { ungrouped: '未分组', expand: (n) => `展开其余 ${n} 个会话`, collapse: '收起', newSession: '新会话' },
}

// CSS-module class names are compiler output. Every fixture renders them from
// this parameter so ANY dependence on a particular shipped hash reddens.
const CLS = (h) => ({
  projectRow: `${h}_projectRow`, sessionRow: `${h}_sessionRow`, title: `${h}_title`, time: `${h}_time`,
  projectText: `${h}_projectText`, slot: `${h}_slot`, overflow: `${h}_sessionOverflowButton`, selected: `${h}_selected`,
})

/** Faithful row markup, transcribed from Rows.tsx ProjectRowItem (role=treeitem,
 *  data-row-key, aria-expanded) and SessionNodeItem (role=treeitem,
 *  data-row-key="session:<id>", aria-selected) and WorkspaceBrowser.tsx:583-601
 *  (overflow button, data-row-key="overflow:<key>", aria-expanded). */
function groupHtml (group, c, loc) {
  const rows = group.visible.map((s) => `
      <div class="${c.sessionRow}${s.id === group.selectedId ? ' ' + c.selected : ''}" data-row-key="session:${s.id}" role="treeitem" aria-selected="${s.id === group.selectedId}">
        <span class="${c.slot}"></span>
        <span class="${c.title}">${s.title ?? ''}</span>
        <span class="${c.time}">1h</span>
      </div>`).join('')
  const overflow = group.hiddenCount > 0 || group.limit > 5
    ? `<button type="button" class="${c.overflow}" data-row-key="overflow:${group.key}" aria-expanded="${group.limit === Infinity}">${group.limit === Infinity ? loc.collapse : loc.expand(group.hiddenCount)}</button>`
    : ''
  const hidden = group.hiddenDuplicate
    ? `<div class="${c.sessionRow}" data-row-key="session:${group.hiddenDuplicate}" data-hidden="true" role="treeitem" aria-selected="false"><span class="${c.title}">${group.sessions[0].title}</span><span class="${c.time}">1h</span></div>`
    : ''
  return `
    <div class="${c.projectRow}" data-row-key="workspace:${group.key}" role="treeitem" aria-expanded="${group.expanded}">
      <span class="${c.slot}"></span><span class="${c.slot}"></span>
      <span class="${c.projectText}"><span class="${c.title}">${group.label}</span></span>
    </div>
    ${group.expanded ? rows : ''}
    ${group.expanded && group.hiddenDuplicate
      ? `<div class="${c.sessionRow}" style="display:none" data-row-key="session:${group.hiddenDuplicate}" role="treeitem" aria-selected="false"><span class="${c.slot}"></span><span class="${c.title}">${group.hiddenTitle || MEMBER_TITLE}</span></div>`
      : ''}
    ${group.expanded ? overflow : ''}`
}

/** A whole app frame: sidebar column (WorkspaceBrowser) + main column. The
 *  main column carries the session header h1 with the RAW session id, exactly
 *  as probe3-after-rowclick proved and verifySelection requires. */
function frameHtml (state, c, loc) {
  const groups = state.groups.map((g) => groupHtml(g, c, loc)).join('')
  const header = state.selectedSession
    ? `<div class="sessionHeader"><h1>${state.selectedSession.id}</h1></div>`
    : '<div class="sessionHeader"><h1>dsh</h1></div>'
  return `
  <div class="frame">
    <div class="sidebarCol" style="width:${state.sidebarWidth}px">
      <div class="panel">
        <span class="newSessionLabel">${loc.newSession}</span>
        <span class="panelTitle">Plugins</span>
        <span class="sectionLabel">Workspaces</span>
        ${groups}
        ${state.extraRail || ''}
        <span class="triggerLabel">Settings</span>
      </div>
    </div>
    <div class="centerCol">${header}${state.extraMain || ''}</div>
  </div>`
}

/** Default fixture world: one collapsed Ungrouped group holding nine sessions
 *  (the canonical member and root among them, hidden past the 5-row idle
 *  quota), plus one expanded named workspace whose sessions are visible. */
function defaultState (o = {}) {
  const ungrouped = {
    key: '', // tree.ts UNGROUPED_KEY === ''
    label: (o.locale && L[o.locale].ungrouped) || L.en.ungrouped,
    expanded: o.ungroupedExpanded ?? false,
    limit: o.ungroupedLimit ?? 5,
    selectedId: null,
    hiddenDuplicate: o.hiddenDuplicate || null,
    sessions: o.ungroupedSessions ?? [
      { id: 'session-mpr-expert', title: 'ack:role-expert:pre:mpr-2026-10-01T13-21-34' },
      { id: 'session-mpr-role-b', title: 'ack:role-b:mpr-2026-10-01T13-21-34' },
      { id: 'session-mpr-b-leader', title: 'ack:role-b-leader:mpr-2026-10-01T13-21-34' },
      { id: 'session-mpr-role-a', title: 'ack:role-a:mpr-2026-10-01T13-21-34' },
      { id: 'session-mpr-a-leader', title: 'ack:role-a-leader:mpr-2026-10-01T13-21-34' },
      { id: 'session-mpr-global-default', title: 'ack:global-default:mpr-2026-10-01T13-21-34' },
      { id: MEMBER_ID, title: o.memberTitle ?? MEMBER_TITLE },
      { id: 'session-mpr-worker-create', title: 'ack:role-worker:create:mpr-2026-10-01T13-21-34' },
      { id: ROOT_ID, title: o.rootTitle ?? ROOT_TITLE },
    ],
  }
  const ws = {
    key: 'ws-40d5679e', label: 'ws', expanded: o.wsExpanded ?? true, limit: Infinity, selectedId: null,
    sessions: o.wsSessions ?? [{ id: 'session-a3b9157c', title: 'smoke host: no work expected' }],
  }
  const groups = o.groups ?? (o.withoutWorkspaceGroup ? [ungrouped] : [ungrouped, ws])
  return {
    groups,
    sidebarWidth: o.sidebarWidth ?? 280, // columns.ts SIDEBAR_DEFAULT
    rowPad: o.rowPad ?? 0, // full-bleed rows: right edge === sidebar width
    selectedSession: null,
    extraMain: o.extraMain ?? '',
    extraRail: o.extraRail ?? '',
    silentSelect: o.silentSelect ?? false,
    locale: o.locale ?? 'en',
    hash: o.hash ?? 'W0d-vW',
    noOpClicks: o.noOpClicks ?? false,
    noWireRound: o.noWireRound ?? false,
    clickCount: 0,
  }
}

/** The product-side behaviour these tests are allowed to assume, itemised with
 *  the upstream line that states it. Everything else is the driver's problem. */
function materialize (g) {
  const rows = g.limit === Infinity ? g.sessions : g.sessions.slice(0, g.limit)
  g.visible = rows
  g.hiddenCount = g.sessions.length - rows.length
}

/** Build a real jsdom document from the state, lay it out with a fake geometry
 *  engine, and wire REAL click listeners on the real row elements. */
function mountRail (o = {}) {
  const state = defaultState(o)
  const c = CLS(state.hash)
  const loc = L[state.locale]
  for (const g of state.groups) materialize(g)
  const { JSDOM } = loadRepoJsdom()
  const dom = new JSDOM(`<!doctype html><html><body>${frameHtml(state, c, loc)}</body></html>`)
  const win = dom.window
  const doc = win.document

  // ── fake layout engine: ui-layout columns, vertical stacking, real rects ──
  let rectOf = new WeakMap() // reassigned per layout: WeakMap has no clear()
  const R = (x, y, w, h) => ({ x, y, width: w, height: h, left: x, top: y, right: x + w, bottom: y + h, toJSON () { return this } })
  const layout = () => {
    rectOf = new WeakMap()
    let y = 24
    const sidebar = doc.querySelector('.sidebarCol')
    rectOf.set(sidebar, R(0, 0, state.sidebarWidth, 1200))
    for (const el of sidebar.querySelectorAll('*')) {
      if (el.classList.contains('newSessionLabel') || el.classList.contains('panelTitle') || el.classList.contains('sectionLabel') || el.classList.contains('triggerLabel')) {
        rectOf.set(el, R(state.rowPad, y, state.sidebarWidth - 2 * state.rowPad, 20)); y += 28; continue
      }
      if (isHidden(el)) { // a display:none subtree has NO boxes at all
        rectOf.set(el, R(0, 0, 0, 0))
        for (const kid of el.querySelectorAll('*')) rectOf.set(kid, R(0, 0, 0, 0))
        continue // the collector cannot see it, exactly as in a real browser
      }
      const rowKey = el.getAttribute && el.getAttribute('data-row-key')
      if (rowKey) {
        rectOf.set(el, R(state.rowPad, y, state.sidebarWidth - 2 * state.rowPad, 30))
        let ix = state.rowPad + 24
        for (const kid of el.children) { rectOf.set(kid, R(ix, y + 4, 8, 16)); ix += 12 }
        const title = el.querySelector && el.querySelector('[class$="_title"]')
        if (title) rectOf.set(title, R(state.rowPad + 28, y + 4, state.sidebarWidth - 2 * state.rowPad - 60, 16))
        const time = el.querySelector && el.querySelector('[class$="_time"]')
        if (time) rectOf.set(time, R(state.sidebarWidth - 50, y + 4, 30, 16))
        y += 34
        if (el.tagName === 'BUTTON') y += 4
        continue
      }
      if (!el.children.length && (el.getAttribute('class') || '').includes('_title')) {
        // a title span that is not inside a row (never happens upstream, kept
        // so a stray title cannot masquerade as a row)
        rectOf.set(el, R(state.rowPad, y, 100, 16)); y += 20
      }
    }
    const center = doc.querySelector('.centerCol')
    rectOf.set(center, R(state.sidebarWidth, 0, 900, 1200))
    let cy = 20
    for (const el of center.querySelectorAll('*')) {
      if (!el.children.length && (el.textContent || '').trim()) { rectOf.set(el, R(state.sidebarWidth + 16, cy, 500, 22)); cy += 30 }
    }
    for (const el of doc.querySelectorAll('[data-hidden="true"]')) {
      rectOf.set(el, R(0, 0, 0, 0))
      for (const kid of el.querySelectorAll('*')) rectOf.set(kid, R(0, 0, 0, 0))
    }
  }
  const isHidden = (el) => !!(el.closest && (el.closest('[style*="display:none"]') || el.closest('[style*="display: none"]')))
  win.Element.prototype.getBoundingClientRect = function () {
    return rectOf.get(this) || R(0, 0, 0, 0)
  }

  // ── render + reRender exactly like a reRender of the React tree ─────────
  const reRender = () => {
    for (const g of state.groups) materialize(g)
    doc.body.innerHTML = frameHtml(state, c, loc)
    layout()
    bind()
  }
  const fireNetFor = (session) => {
    const rpcId = 'rpc-' + state.clickCount
    const req = state.net.recordRequest({ leg: state.leg, m: 'team.getReadState', rpcId, p: { sessionId: session.id }, t: state.clock.v })
    state.net.recordResponse({
      leg: state.leg, m: 'team.getReadState', req, status: 200, t: state.clock.v + 5,
      bodyText: JSON.stringify({ rpcId, result: { ok: true, value: { data: { relation: session.relation, memberInstanceId: session.relation === 'team-member' ? MEMBER_INSTANCE : undefined, disposed: false } } } }),
    })
  }
  const onClick = (ev) => {
    const row = ev.target.closest('[data-row-key]')
    if (!row) return
    const key = row.getAttribute('data-row-key')
    state.clicks.push(key)
    state.clickCount += 1
    if (state.noOpClicks) return // the row exists but the click does nothing
    if (key.startsWith('workspace:')) {
      const g = state.groups.find((x) => 'workspace:' + x.key === key)
      if (!g) return
      if (g.expanded) g.limit = 5 // WorkspaceBrowser.tsx:503-506
      g.expanded = !g.expanded
      reRender(); return
    }
    if (key.startsWith('overflow:')) {
      const g = state.groups.find((x) => 'overflow:' + x.key === key)
      if (!g) return
      g.limit = (g.limit === Infinity ? 5 : g.limit) + 5 // COLLAPSED_SESSION_LIMIT step
      reRender(); return
    }
    if (key.startsWith('session:')) {
      const id = key.slice('session:'.length)
      for (const g of state.groups) {
        const s = g.sessions.find((x) => x.id === id)
        if (!s) continue
        g.selectedId = id
        state.selectedSession = { id, relation: id === ROOT_ID ? 'team-root' : 'team-member' }
        if (!state.silentSelect) fireNetFor(state.selectedSession)
        reRender(); return
      }
    }
  }
  function bind () {
    for (const row of doc.querySelectorAll('[data-row-key]')) row.addEventListener('click', onClick)
  }

  layout()
  bind()

  // ── the fake UiPage: SAME collector source, SAME coordinate click ─────────
  const railMaxX = o.railMaxX ?? 260
  const clock = { v: 0 }
  state.clock = clock
  state.net = null
  state.leg = null
  state.clicks = []
  const pointTarget = (x, y) => {
    let best = null
    for (const el of doc.querySelectorAll('*')) {
      const r = rectOf.get(el)
      if (!r || r.width === 0 || r.height === 0) continue
      if (x >= r.x && x <= r.right && y >= r.y && y <= r.bottom) best = el
    }
    return best
  }
  const page = {
    collectCalls: 0,
    shots: [],
    async gotoApp () { clock.v += 50 },
    async wait (ms) { clock.v += ms },
    async screenshot (name) { this.shots.push(name) },
    async parkMouse () { clock.v += 5 },
    async dismissNoticeIfVisible () { return o.notice ? 'dismissed' : 'absent' },
    async collectLeaves () {
      this.collectCalls += 1
      // THE live collector source string, verbatim, against this real document
      // (the same execute-a-exported-source-under-jsdom seam probeMarkup uses).
      return new Function('document', 'return (' + railCollectorSource(railMaxX) + ')')(doc)
    },
    async clickLeaf (l) {
      const x = l.x + Math.min(40, l.w / 2)
      const y = l.y + l.h / 2
      const el = pointTarget(x, y)
      if (!el) return
      el.dispatchEvent(new win.MouseEvent('click', { bubbles: true, cancelable: true, clientX: x, clientY: y }))
      clock.v += 20
    },
  }
  const io = { now: () => clock.v, sleep: async (ms) => { clock.v += ms }, log: () => {} }
  return { state, page, io, doc, win, layout: () => layout(), reRender: () => reRender() }
}

const TARGET_MEMBER = { sessionId: MEMBER_ID, title: MEMBER_TITLE, relation: 'team-member', instance: MEMBER_INSTANCE }
const TARGET_ROOT = { sessionId: ROOT_ID, title: ROOT_TITLE, relation: 'team-root' }

async function runNavigate (harness, expected) {
  const net = createNetworkLog()
  harness.state.net = net
  harness.state.leg = 'E1'
  const out = { legs: {} }
  const res = await navigate(harness.page, net, 'E1', 'E1', expected, harness.io, out)
  return { res, net, out }
}

// ── the live failure shape: fresh context, collapsed group, hashed classes ──
test('rail DOM (real collector, real navigate): locates the member past a COLLAPSED Ungrouped group and verifies selection', async () => {
  const h = mountRail({})
  const { res } = await runNavigate(h, TARGET_MEMBER)
  assert.ok(res.clickT > 0, 'navigation must end on a verified click')
  assert.ok(h.state.clicks.includes('session:' + MEMBER_ID), 'the click must land on the canonical session row: ' + h.state.clicks.join(','))
  assert.equal(h.state.groups[0].expanded, true, 'the group must be expanded before the row can exist')
  assert.equal(res.steps[0], 'expand-ungrouped-group', 'the group the product reported collapsed is expanded first: ' + JSON.stringify(res.steps))
  assert.ok(!h.state.clicks.slice(0, h.state.clicks.indexOf('session:' + MEMBER_ID)).some((k) => k.startsWith('session:')), 'no session row may be clicked before the tree opened')
})

test('rail DOM: a changed CSS-module hash for css.title changes nothing (no shipped class is an identifier)', async () => {
  for (const hash of ['aB3-xY', 'zz9-NEW', 'W0d-vW']) {
    const h = mountRail({ hash })
    const { res } = await runNavigate(h, TARGET_ROOT)
    assert.ok(res.clickT > 0, 'class hash ' + hash + ' must not affect navigation')
    assert.ok(h.state.clicks.includes('session:' + ROOT_ID))
  }
})

test('rail DOM: every supported sidebar width finds the row (SIDEBAR_MIN 264 / DEFAULT 280 / MAX 420)', async () => {
  for (const sidebarWidth of [264, 280, 420]) {
    const h = mountRail({ sidebarWidth })
    const { res } = await runNavigate(h, TARGET_MEMBER)
    assert.ok(res.clickT > 0, 'sidebarWidth ' + sidebarWidth + ' must not hide the rail rows')
    assert.ok(h.state.clicks.includes('session:' + MEMBER_ID))
  }
})

test('rail DOM: Chinese locale expands the group and reveals the overflow with localized labels', async () => {
  const h = mountRail({ locale: 'zh' })
  const { res } = await runNavigate(h, TARGET_MEMBER)
  assert.ok(res.clickT > 0, 'zh locale must navigate')
  assert.ok(h.state.clicks.some((k) => k.startsWith('overflow:')), 'overflow must be clicked structurally, not by an English regex: ' + h.state.clicks.join(','))
})

test('rail DOM: overflow reveal is bounded and structural (data-row-key=overflow:*), and the collapse label is never clicked as an expander', async () => {
  const h = mountRail({})
  const { res } = await runNavigate(h, TARGET_ROOT) // root is the LAST of nine rows
  assert.ok(res.clickT > 0)
  const overflowClicks = h.state.clicks.filter((k) => k.startsWith('overflow:'))
  assert.ok(overflowClicks.length >= 1 && overflowClicks.length <= 3, 'bounded overflow clicks: ' + overflowClicks.length)
})

test('rail DOM: an already-expanded group is never clicked (a toggle would collapse it)', async () => {
  const h = mountRail({ ungroupedExpanded: true })
  const { res } = await runNavigate(h, TARGET_MEMBER)
  assert.ok(res.clickT > 0)
  assert.ok(!h.state.clicks.includes('workspace:'), 'must not toggle the group closed: ' + h.state.clicks.join(','))
})

test('rail DOM: expansion state is read from aria-expanded, never from a row count', async () => {
  // A group that is EXPANDED but legitimately holds zero session rows must not
  // be clicked again (the old groupCollapsed() model could not tell them apart).
  const h = mountRail({ ungroupedExpanded: true, ungroupedSessions: [{ id: MEMBER_ID, title: MEMBER_TITLE }] })
  const { res } = await runNavigate(h, TARGET_MEMBER)
  assert.ok(res.clickT > 0)
  assert.ok(!h.state.clicks.includes('workspace:'), JSON.stringify(h.state.clicks))
})

test('rail DOM: a target in ANOTHER workspace is reached — no Ungrouped assumption (groups are opened in DOM order, each verified by aria-expanded)', async () => {
  const h = mountRail({ groups: [
    { key: '', label: L.en.ungrouped, expanded: false, limit: 5, selectedId: null, sessions: [{ id: 'session-x1', title: 'other one' }] },
    { key: 'ws-40d5679e', label: 'ws', expanded: false, limit: 5, selectedId: null, sessions: [{ id: MEMBER_ID, title: MEMBER_TITLE }] },
  ] })
  const { res } = await runNavigate(h, TARGET_MEMBER)
  assert.ok(res.clickT > 0, 'must open the collapsed groups until the canonical row renders')
  assert.equal(h.state.groups[1].expanded, true, 'the group carrying the target is opened')
  assert.ok(h.state.clicks.includes('session:' + MEMBER_ID), 'only the id-matching row is clicked: ' + h.state.clicks.join(','))
  assert.ok(!h.state.clicks.some((k) => k === 'session:session-x1'), 'a row of another group is never a substitute target')
})

test('rail DOM: a no-op / still-collapsed click fails closed, it never clicks an arbitrary row', async () => {
  const h = mountRail({ noOpClicks: true })
  await assert.rejects(() => runNavigate(h, TARGET_MEMBER), (e) => {
    assert.ok(e instanceof FailClosed, 'fail-closed error: ' + e)
    assert.match(e.reason || e.message, /collapse|locate/i)
    return true
  })
  assert.ok(!h.state.clicks.some((k) => k.startsWith('session:')), 'no session row may be clicked while nothing expanded')
})

test('rail DOM: a missing target is locate-not_found fail-closed AND leaves scrubbed rail diagnostics plus one failure screenshot', async () => {
  const h = mountRail({ rootTitle: 'something else entirely' })
  await assert.rejects(() => runNavigate(h, TARGET_ROOT), (e) => {
    assert.ok(e instanceof FailClosed)
    assert.match(e.message, /locate-not_found/)
    const rail = e.diag && e.diag.rail
    assert.ok(rail && typeof rail === 'object', 'bounded rail diagnostics expected: ' + JSON.stringify(e.diag))
    assert.ok(rail.sessionRows > 0, 'the snapshot must say whether rows rendered at all: ' + JSON.stringify(rail))
    assert.ok(Array.isArray(rail.sample) && rail.sample.length > 0 && rail.sample.length <= 12, 'sample is BOUNDED: ' + rail.sample.length)
    assert.ok(rail.sample.every((r) => r.key && !('cls' in r) && !('html' in r)), 'structural records only — no class hashes, no HTML: ' + JSON.stringify(rail.sample[0]))
    assert.ok(rail.groups.every((g) => 'expanded' in g), 'group aria-expanded is part of the snapshot')
    return true
  })
  assert.ok(h.page.shots.some((s) => /locate/.test(s)), 'failure screenshot on initial locate failure: ' + h.page.shots.join(','))
})

test('rail DOM: a duplicate row carrying the SAME canonical id is AMBIGUOUS, never "pick the first"', async () => {
  const dup = [
    { id: 'session-a', title: 'first' },
    { id: MEMBER_ID, title: MEMBER_TITLE },
    { id: MEMBER_ID, title: MEMBER_TITLE },
    { id: 'session-b', title: 'second' },
    { id: 'session-c', title: 'third' },
    { id: 'session-d', title: 'fourth' },
    { id: 'session-e', title: 'fifth' },
  ]
  const h = mountRail({ ungroupedSessions: dup })
  await assert.rejects(() => runNavigate(h, TARGET_MEMBER), (e) => {
    assert.match(e.message, /locate-ambiguous/)
    return true
  })
})

test('rail DOM: a repeated TITLE outside the session tree (hover card, header) cannot make the locate ambiguous', async () => {
  // Faithful HoverCard/toast text carries the same title but no data-row-key.
  const h = mountRail({ extraMain: `<div class="hoverContent"><span>${MEMBER_TITLE}</span><span>1h ago</span></div>` })
  const { res } = await runNavigate(h, TARGET_MEMBER)
  assert.ok(res.clickT > 0, 'text duplicates must not defeat an id-scoped locate')
})

test('rail DOM: a hidden duplicate row (zero box, display:none) is not a candidate', async () => {
  const h = mountRail({ hiddenDuplicate: MEMBER_ID })
  const { res } = await runNavigate(h, TARGET_MEMBER)
  assert.ok(res.clickT > 0, 'a zero-box duplicate must never produce AMBIGUOUS')
  assert.ok(h.state.clicks.includes('session:' + MEMBER_ID))
})

test('rail DOM: two SIMULTANEOUSLY rendered rows with the SAME canonical id are AMBIGUOUS, never a silent pick', async () => {
  const c = CLS('qZ9tT2')
  const h = mountRail({
    ungroupedExpanded: true,
    ungroupedLimit: Infinity,
    extraRail: `
    <div class="${c.sessionRow}" data-row-key="session:${MEMBER_ID}" role="treeitem" aria-selected="false">
      <span class="${c.title}">${MEMBER_TITLE}</span><span class="${c.time}">1h</span>
    </div>`,
  })
  await assert.rejects(() => runNavigate(h, TARGET_MEMBER), (e) => {
    assert.match(e.message, /locate-ambiguous/)
    return true
  })
  assert.ok(!h.state.clicks.includes('session:' + MEMBER_ID), 'nothing may be clicked on an ambiguous tree')
})

test('rail DOM: a second RENDERED row with the same canonical key anywhere in the document is AMBIGUOUS — the driver never picks one (upstream hover cards carry NO data-row-key, so a duplicated key is an anomaly, not a duplicate label)', async () => {
  const c = CLS('qZ9tT2')
  const h = mountRail({
    ungroupedExpanded: true,
    ungroupedLimit: Infinity,
    extraMain: `<div class="${c.sessionRow}" data-row-key="session:${MEMBER_ID}" role="treeitem" aria-selected="false"><span class="${c.title}">${MEMBER_TITLE}</span></div>`,
  })
  await assert.rejects(() => runNavigate(h, TARGET_MEMBER), (e) => {
    assert.match(e.message, /locate-ambiguous/)
    return true
  })
  assert.ok(!h.state.clicks.includes('session:' + MEMBER_ID), 'fail-closed means no click, in either region')
})

test('rail DOM: the exact canonical title is required — a same-id row with a different title fails closed', async () => {
  const h = mountRail({ memberTitle: 'renamed by a human mid-run' })
  await assert.rejects(() => runNavigate(h, TARGET_MEMBER), (e) => {
    assert.match(e.message, /locate-not_found/)
    return true
  })
  assert.ok(!h.state.clicks.some((k) => k === 'session:' + MEMBER_ID), 'never click a row whose title left the canonical value')
})

test('rail DOM: selection identity stays correlated — a row that renders but never produces a fresh readState round is unverified, never a navigation', async () => {
  const h = mountRail({ silentSelect: true })
  await assert.rejects(() => runNavigate(h, TARGET_MEMBER), (e) => {
    assert.ok(e instanceof FailClosed)
    assert.match(e.message, /selection-unverified/)
    return true
  })
  assert.equal(h.state.selectedSession && h.state.selectedSession.id, MEMBER_ID, 'the row did render as selected — the reject is the missing wire correlation')
  assert.ok(h.page.shots.some((s) => /verify-anomaly/.test(s)), 'the retry must still leave a screenshot: ' + h.page.shots.join(','))
})
