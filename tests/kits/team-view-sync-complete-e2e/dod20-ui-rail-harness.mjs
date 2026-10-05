/**
 * dod20-ui-rail-harness.mjs — (repair round 2; reviewed parent commit
 * 4bd13a9a580b177151d1769da3a38142e01211b8 — see dod20-ui-driver.mjs header) the SHARED faithful-DOM rail harness for the
 * offline (node --test, no browser) rail suites. Extracted verbatim from
 * dod20-ui-driver-rail-dom.test.mjs so the identity suite added on
 * 2026-10-05 (corrective round) drives EXACTLY the same world: same markup
 * builder, same fake layout engine, same product-side click model, same
 * fake UiPage — and therefore the SAME serialized collector
 * (railCollectorSource) and the SAME navigation seam (navigate) as the live
 * lane. Nothing here reimplements navigation.
 *
 * FAITHFUL-MARKUP CORRECTION (2026-10-05, reviewer item 2): the pinned
 * product renders the sidebar row list inside AnimatedRows, whose render()
 * emits `<div role="tree" aria-label={t('section.sessions')}>`
 * (tests/deepseek-harness-test-use @ 639ed015
 * packages/client/ui-workspace/src/client/rows/AnimatedRows.tsx:171-176), and
 * the search panel renders its OWN separate tree
 * (rows/WorkspaceBrowser.tsx:790, aria-label t('search.results.aria')). The
 * earlier fixture omitted the container, which is why an unscoped
 * whole-document collector could pass offline. Rows are therefore rendered
 * inside a real [role=tree] here, and a second real tree / a main-column
 * spoof can be requested for the negative cases.
 */
import { MEMBER_ID, MEMBER_INSTANCE, MEMBER_TITLE, ROOT_ID, ROOT_TITLE, loadRepoJsdom } from './dod20-ui-driver-fixtures.mjs'
import { createNetworkLog, navigate, railCollectorSource } from './dod20-ui-driver.mjs'

/** Frozen upstream i18n literals (client/ui-workspace/src/client/locales.ts
 *  :10/:19/:32/:33/:42/:129/:138/:151/:161 en+zh). Verbatim, because a
 *  locale-dependent locator is a defect. */
export const L = {
  en: { ungrouped: 'Ungrouped', expand: (n) => `Show ${n} more sessions`, collapse: 'Show less', newSession: 'New Session', sessionsSection: 'Sessions', searchAria: 'Search results' },
  zh: { ungrouped: '未分组', expand: (n) => `展开其余 ${n} 个会话`, collapse: '收起', newSession: '新会话', sessionsSection: '会话', searchAria: '搜索结果' },
}

// CSS-module class names are compiler output. Every fixture renders them from
// this parameter so ANY dependence on a particular shipped hash reddens.
export const CLS = (h) => ({
  projectRow: `${h}_projectRow`, sessionRow: `${h}_sessionRow`, title: `${h}_title`, time: `${h}_time`,
  projectText: `${h}_projectText`, slot: `${h}_slot`, overflow: `${h}_sessionOverflowButton`, selected: `${h}_selected`,
})

/** Faithful row markup, transcribed from Rows.tsx ProjectRowItem (role=treeitem,
 *  data-row-key, aria-expanded, :245-247), SessionNodeItem (role=treeitem,
 *  data-row-key="session:<id>", aria-selected, :589-597) and
 *  WorkspaceBrowser.tsx:583-601 (overflow button, data-row-key="overflow:<key>",
 *  aria-expanded). */
/** `group.extraInner` is a HOSTILE-ONLY injection rendered inside the real
 *  [role=tree] container: a non-upstream element shape used to prove the driver
 *  gates on role/ancestry and not on a bare data-row-key attribute. Upstream
 *  emits exactly four data-row-key shapes (empty / overflow:* / workspace:* /
 *  session:*), verified by grep over the pinned tree. */
export function groupHtml (group, c, loc) {
  const rows = group.visible.map((s) => `
      <div class="${c.sessionRow}${s.id === group.selectedId ? ' ' + c.selected : ''}" data-row-key="session:${s.id}" role="treeitem" aria-selected="${s.id === group.selectedId}">
        <span class="${c.slot}"></span>
        <span class="${c.title}">${s.title ?? ''}</span>
        <span class="${c.time}">1h</span>
        <span class="${c.slot} actions"></span>
      </div>`).join('')
  const overflow = group.hiddenCount > 0 || group.limit > 5
    ? `<button type="button" class="${c.overflow}" data-row-key="overflow:${group.key}" aria-expanded="${group.limit === Infinity}">${group.limit === Infinity ? loc.collapse : loc.expand(group.hiddenCount)}</button>`
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
    ${group.expanded ? overflow : ''}
    ${group.extraInner || ''}`
}

/** One whole tree container exactly as AnimatedRows renders it (:171-176). */
function treeHtml (groups, c, loc, extra) {
  return `<div class="list${extra && extra.cls ? ' ' + extra.cls : ''}" role="tree" aria-label="${extra && extra.aria ? extra.aria : loc.sessionsSection}"${extra && extra.attr ? ' ' + extra.attr : ''}>${groups.map((g) => groupHtml(g, c, loc)).join('')}${(extra && extra.inner) || ''}</div>`
}

/** A whole app frame: sidebar column (WorkspaceBrowser) + main column. The
 *  main column carries the session header h1 with the RAW session id, exactly
 *  as probe3-after-rowclick proved and verifySelection requires. */
export function frameHtml (state, c, loc) {
  const header = state.selectedSession
    ? `<div class="sessionHeader"><h1>${state.selectedSession.id}</h1></div>`
    : '<div class="sessionHeader"><h1>dsh</h1></div>'
  const extraTree = state.extraTree
    ? `<div class="searchPanel">${treeHtml(state.extraTree.groups, c, { sessionsSection: loc.searchAria }, { cls: 'searchTree', aria: loc.searchAria, inner: state.extraTree.inner || '' })}</div>`
    : ''
  return `
  <div class="frame">
    <div class="sidebarCol" style="width:${state.sidebarWidth}px">
      <div class="panel">
        <span class="newSessionLabel">${loc.newSession}</span>
        <span class="panelTitle">Plugins</span>
        <span class="sectionLabel">Workspaces</span>
        ${treeHtml(state.groups, c, loc)}
        ${state.extraRail || ''}
        <span class="triggerLabel">Settings</span>
      </div>
      ${extraTree}
    </div>
    <div class="centerCol">${header}${state.extraMain || ''}</div>
  </div>`
}

/** Default fixture world: one collapsed Ungrouped group holding nine sessions
 *  (the canonical member and root among them, hidden past the 5-row idle
 *  quota), plus one expanded named workspace whose sessions are visible. */
export function defaultState (o = {}) {
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
    extraTree: o.extraTree ?? null,
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
export function materialize (g) {
  const rows = g.limit === Infinity ? g.sessions : g.sessions.slice(0, g.limit)
  g.visible = rows
  g.hiddenCount = g.sessions.length - rows.length
}

/** Build a real jsdom document from the state, lay it out with a fake geometry
 *  engine, and wire REAL click listeners on the real row elements. */
export function mountRail (o = {}) {
  const state = defaultState(o)
  const c = CLS(state.hash)
  const loc = L[state.locale]
  for (const g of state.groups) materialize(g)
  if (state.extraTree) for (const g of state.extraTree.groups) materialize(g)
  const { JSDOM } = loadRepoJsdom()
  const dom = new JSDOM(`<!doctype html><html><body>${frameHtml(state, c, loc)}</body></html>`)
  const win = dom.window
  const doc = win.document

  // ── fake layout engine: ui-layout columns, vertical stacking, real rects ──
  let rectOf = new WeakMap() // reassigned per layout: WeakMap has no clear()
  const R = (x, y, w, h) => ({ x, y, width: w, height: h, left: x, top: y, right: x + w, bottom: y + h, toJSON () { return this } })
  const isHidden = (el) => !!(el.closest && (el.closest('[style*="display:none"]') || el.closest('[style*="display: none"]')))
  const layout = () => {
    rectOf = new WeakMap()
    let y = 24
    const sidebar = doc.querySelector('.sidebarCol')
    rectOf.set(sidebar, R(0, 0, state.sidebarWidth, 1200))
    for (const el of sidebar.querySelectorAll('*')) {
      if (el.classList.contains('newSessionLabel') || el.classList.contains('panelTitle') || el.classList.contains('sectionLabel') || el.classList.contains('triggerLabel')) {
        rectOf.set(el, R(state.rowPad, y, state.sidebarWidth - 2 * state.rowPad, 20)); y += 28; continue
      }
      if (el.classList.contains('list')) rectOf.set(el, R(0, y, state.sidebarWidth, 1200 - y))
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
  win.Element.prototype.getBoundingClientRect = function () {
    return rectOf.get(this) || R(0, 0, 0, 0)
  }

  // ── render + reRender exactly like a reRender of the React tree ─────────
  const reRender = () => {
    for (const g of state.groups) materialize(g)
    if (state.extraTree) for (const g of state.extraTree.groups) materialize(g)
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
      if (state.allowOrphanSelect && !state.groups.some((g) => g.sessions.some((x) => x.id === id))) {
        // A row rendered by another real tree (e.g. the search panel) still
        // belongs to a real Session: selecting it must produce the same wire
        // round. Without this the scope tests would measure plumbing, not scope.
        state.selectedSession = { id, relation: id === ROOT_ID ? 'team-root' : 'team-member' }
        if (!state.silentSelect) fireNetFor(state.selectedSession)
        reRender(); return
      }
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

/** The canonical fixture targets, WITH the group identity the read-only fixture
 *  data proves: in the retained acceptance world (storages/workspace.json =
 *  exactly one workspace, `ws`, whose sessionIds list one unrelated session)
 *  neither target is accounted by any workspace, so owningGroupKey() yields
 *  UNGROUPED_KEY === '' (tree.ts:19, :27-32) and the rail row to open is
 *  `data-row-key="workspace:"`. navigate() refuses to expand ANY group without
 *  this, instead of opening whichever row comes first. */
const UNGROUPED_PROOF = {
  groupKey: '',
  groupKeyProven: true,
  groupKeySource: 'world storages/workspace.json → no workspace accounts for the session → tree.ts UNGROUPED_KEY',
}
export const TARGET_MEMBER = { sessionId: MEMBER_ID, title: MEMBER_TITLE, relation: 'team-member', instance: MEMBER_INSTANCE, ...UNGROUPED_PROOF }
export const TARGET_ROOT = { sessionId: ROOT_ID, title: ROOT_TITLE, relation: 'team-root', ...UNGROUPED_PROOF }

/** Drive the REAL navigate() seam against a mounted world. */
export async function runNavigate (harness, expected, { leg = 'E1', label = 'E1' } = {}) {
  const net = createNetworkLog()
  harness.state.net = net
  harness.state.leg = leg
  const out = { legs: {} }
  const res = await navigate(harness.page, net, leg, label, expected, harness.io, out)
  return { res, net, out }
}

/** A group that is NOT the target: used to prove no unrelated group is opened. */
export function otherGroup (i, { expanded = false, sessions = 3 } = {}) {
  return {
    key: `ws-other-${i}`, label: `other-${i}`, expanded, limit: Infinity, selectedId: null,
    sessions: Array.from({ length: sessions }, (_, k) => ({ id: `session-other-${i}-${k}`, title: `other ${i} session ${k}` })),
  }
}
