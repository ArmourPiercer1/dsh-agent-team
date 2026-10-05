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
import { ROOT_ID, ROOT_TITLE, MEMBER_ID, MEMBER_TITLE } from './dod20-ui-driver-fixtures.mjs'
import { FailClosed } from './dod20-ui-driver.mjs'
// The world, the fake layout engine, the product-side click model and the
// fake UiPage (SAME railCollectorSource + SAME navigate) live in
// ./dod20-ui-rail-harness.mjs so every offline rail suite drives ONE world.
import { CLS, L, TARGET_MEMBER, TARGET_ROOT, mountRail, runNavigate } from './dod20-ui-rail-harness.mjs'


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

test('rail DOM: a target in ANOTHER workspace is reached by ITS OWN group key — the collapsed stranger stays shut', async () => {
  const h = mountRail({ groups: [
    { key: '', label: L.en.ungrouped, expanded: false, limit: 5, selectedId: null, sessions: [{ id: 'session-x1', title: 'other one' }] },
    { key: 'ws-40d5679e', label: 'ws', expanded: false, limit: 5, selectedId: null, sessions: [{ id: MEMBER_ID, title: MEMBER_TITLE }] },
  ] })
  const { res } = await runNavigate(h, { ...TARGET_MEMBER, groupKey: 'ws-40d5679e', groupKeyProven: true, groupKeySource: 'fixture: the ws group accounts for the member' })
  assert.ok(res.clickT > 0, 'must open the target group until the canonical row renders')
  assert.equal(h.state.groups[1].expanded, true, 'the group carrying the target is opened')
  assert.equal(h.state.groups[0].expanded, false, 'the Ungrouped row is NOT opened on the way there (it is not the target group)')
  assert.deepEqual(h.state.clicks.filter((k) => k.startsWith('workspace:')), ['workspace:ws-40d5679e'], 'exactly one group row is clicked: ' + h.state.clicks.join(','))
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
