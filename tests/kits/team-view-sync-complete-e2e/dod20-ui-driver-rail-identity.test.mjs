/**
 * dod20-ui-driver-rail-identity.test.mjs — OFFLINE faithful-DOM tests for the
 * three locator-IDENTITY defects found in the first rail repair (parent commit
 * 4bd13a9a580b177151d1769da3a38142e01211b8, reviewed). node --test only: no
 * browser executable, no host, no network, no port.
 *
 * WHAT IS WRONG AT 4bd13a9a, in the reviewer's own three items:
 *
 *  (1) POSITIONAL TRAVERSAL. navigate() expanded `collapsedGroupRows(…)[0]`
 *      (up to 3) and clicked the FIRST `aria-expanded=false` overflow row
 *      anywhere. With the frozen fixture world that happens to reach the right
 *      group only because the Ungrouped row is rendered first; with four
 *      unrelated collapsed groups in front of it, the driver would open
 *      strangers. The fixture membership is knowable read-only BEFORE any
 *      browser leg: the pinned product derives a session's group with
 *      owningGroupKey() (tree.ts:27-32) = the first Workspace whose
 *      `sessionIds` contains the id, else UNGROUPED_KEY = '' (tree.ts:19), and
 *      the store behind it is `storages/workspace.json`
 *      (global.workspaceIds + tables.workspaces[<id>].sessionIds). So the
 *      driver must CARRY that key and click only `workspace:<key>` /
 *      `overflow:<key>`.
 *
 *  (2) UNSCOPED COLLECTOR. railCollectorSource() walked the whole document and
 *      called ANY `data-row-key` prefix a rail row. The pinned product renders
 *      the row list inside AnimatedRows, which emits `role="tree"`
 *      (AnimatedRows.tsx:171-176) — and it renders a SECOND, distinct tree for
 *      search results (WorkspaceBrowser.tsx:790). A keyed element outside a
 *      real tree (main column, dialog, hover card) is not a session row; two
 *      distinct real trees carrying the same key are ambiguity, not "take the
 *      first". (The previous fixture omitted the tree container, which is why
 *      the unscoped collector looked fine offline — fixed in the harness.)
 *
 *  (3) LEAVES ARE NOT ROWS. locateSessionRow() counted matching-title LEAVES.
 *      One row legitimately renders several leaves (slot/title/time/actions —
 *      Rows.tsx renders the title and the elapsed-time spans inside the same
 *      SessionNodeItem), while two DISTINCT row containers can share one
 *      canonical `data-row-key`: if only one of them still carries the
 *      canonical title, 4bd resolved FOUND and clicked. Row identity must come
 *      from a per-snapshot row-container identity, so duplicate canonical rows
 *      are AMBIGUOUS before any click regardless of their titles. The original
 *      duplicate-TITLE policy stays too: two real rows with equal titles and
 *      different ids remain AMBIGUOUS (reported, not weakened).
 *
 * Like the sibling suite, this drives THE LIVE SEAMS: the exported
 * railCollectorSource() string executed verbatim in the repo's own jsdom, and
 * the exported navigate() clicking by coordinates that bubble to real
 * listeners. There is no second navigation model to go green.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import * as D from './dod20-ui-driver.mjs'
import { MEMBER_ID, MEMBER_TITLE, ROOT_ID, ROOT_TITLE } from './dod20-ui-driver-fixtures.mjs'
import { CLS, TARGET_MEMBER, TARGET_ROOT, defaultState, mountRail, otherGroup, runNavigate } from './dod20-ui-rail-harness.mjs'
import { FailClosed } from './dod20-ui-driver.mjs'

// The canonical fixture identity: the retained acceptance world's member and
// root sessions are accounted by NO workspace (workspace.json holds exactly one
// workspace, `ws`, whose sessionIds list one unrelated session), so their group
// key is UNGROUPED_KEY === ''. Carried explicitly from here on — never inferred
// from which row happens to be first.
const UNGROUPED = { groupKey: '', groupKeyProven: true }
const WS_OTHER = { groupKey: 'ws-40d5679e', groupKeyProven: true }
// FailClosed carries its reason in Error.message (this kit's own convention:
// `assert.match(e.reason || e.message, …)` in the sibling suites).
const why = (e) => String((e && (e.reason || e.message)) || e)

const member = (extra = {}) => ({ ...TARGET_MEMBER, ...UNGROUPED, ...extra })
const root = (extra = {}) => ({ ...TARGET_ROOT, ...UNGROUPED, ...extra })

const c = CLS('aB3xYz')
/** A keyed element with a session key but WITHOUT role=treeitem — a shape the
 *  pinned product does not emit; proves the driver gates on the role. */
const keyedNoRole = (id) => `<div class="${c.sessionRow}" data-row-key="session:${id}"><span class="${c.title}">${MEMBER_TITLE}</span></div>`
/** The same key rendered in the main column (a details-pane affordance, a
 *  dialog row …): visible, keyed, but outside every tree. */
const mainSpoof = (id) => `<div class="${c.sessionRow}" data-row-key="session:${id}" role="treeitem" aria-selected="false"><span class="${c.title}">${MEMBER_TITLE}</span></div>`

// ── (1) target identity, not positional traversal ───────────────────────────
test('identity: four unrelated collapsed groups in front — only workspace:<expectedKey> is opened', async () => {
  const target = {
    key: '', label: 'Ungrouped', expanded: false, limit: 5, selectedId: null,
    sessions: defaultState({}).groups[0].sessions,
  }
  const strangers = [1, 2, 3, 4].map((i) => otherGroup(i))
  const h = mountRail({ groups: [...strangers, target] })
  const { res } = await runNavigate(h, member())
  assert.deepEqual(h.state.groups.filter((g) => g.key !== '').map((g) => g.expanded), [false, false, false, false],
    'an unrelated group may never be opened just because it renders first: ' + JSON.stringify(h.state.groups.map((g) => [g.key, g.expanded])))
  assert.deepEqual(h.state.clicks.filter((k) => k.startsWith('workspace:')), ['workspace:'], 'exactly the expected group row is clicked')
  assert.ok(h.state.clicks.includes('session:' + MEMBER_ID))
  assert.ok(res.clickSeq > 0 || res.clickT >= 0, 'the click boundary is still returned for the leg oracles')
})

test('identity: a foreign group\'s overflow row is never clicked — only overflow:<expectedKey>', async () => {
  const foreign = {
    key: 'ws-foreign-overflow', label: 'foreign', expanded: true, limit: 5, selectedId: null,
    sessions: Array.from({ length: 8 }, (_, i) => ({ id: `session-foreign-${i}`, title: `foreign session ${i}` })),
  }
  const target = {
    key: '', label: 'Ungrouped', expanded: true, limit: 5, selectedId: null,
    sessions: defaultState({}).groups[0].sessions,
  }
  const h = mountRail({ groups: [foreign, target] })
  await runNavigate(h, member())
  assert.equal(foreign.limit, 5, 'the stranger group keeps its idle quota — its overflow was clicked by 4bd')
  const overflowClicks = h.state.clicks.filter((k) => k.startsWith('overflow:'))
  assert.deepEqual(overflowClicks, new Array(overflowClicks.length).fill('overflow:'), 'only the target group\'s overflow: ' + overflowClicks.join(','))
  assert.ok(h.state.clicks.includes('session:' + MEMBER_ID))
})

test('identity: the expected group in ANOTHER workspace is opened by its exact key, strangers untouched', async () => {
  const target = {
    key: 'ws-40d5679e', label: 'ws', expanded: false, limit: Infinity, selectedId: null,
    sessions: [{ id: MEMBER_ID, title: MEMBER_TITLE }],
  }
  const h = mountRail({ groups: [otherGroup(1), otherGroup(2), target] })
  await runNavigate(h, member(WS_OTHER))
  assert.equal(target.expanded, true)
  assert.deepEqual([1, 2].map((i) => h.state.groups.find((g) => g.key === 'ws-other-' + i).expanded), [false, false])
  assert.deepEqual(h.state.clicks.filter((k) => k.startsWith('workspace:')), ['workspace:ws-40d5679e'])
})

test('identity: a MISSING expected group row fails closed with diagnostics, never a substitute group', async () => {
  const h = mountRail({ groups: [otherGroup(1, { sessions: 6 }), otherGroup(2, { sessions: 6 })], withoutWorkspaceGroup: false })
  await assert.rejects(() => runNavigate(h, member({ groupKey: 'ws-does-not-exist', groupKeyProven: true })), (e) => {
    assert.ok(e instanceof FailClosed, 'fail-closed: ' + e)
    assert.match(why(e), /group-not_found/, 'the reason must name the missing GROUP identity, not a generic locate miss: ' + why(e))
    assert.equal(e.diag.expectedGroupKey, 'ws-does-not-exist')
    assert.ok(Array.isArray(e.diag.rail.groups) && e.diag.rail.groups.length >= 2, 'diagnostics list the groups that WERE there')
    return true
  })
  assert.ok(!h.state.clicks.some((k) => k.startsWith('workspace:')), 'no stranger group row may be clicked: ' + h.state.clicks.join(','))
})

test('identity: a DUPLICATE expected group row fails closed as group-ambiguous', async () => {
  const target = { key: '', label: 'Ungrouped', expanded: false, limit: 5, selectedId: null, sessions: defaultState({}).groups[0].sessions }
  const h = mountRail({ groups: [target] })
  // A second row claiming the same group key, inside a second real tree: an
  // anomaly the product must never produce, and one the driver may not arbitrate.
  h.state.extraTree = { groups: [{ key: '', label: 'Ungrouped (mirror)', expanded: false, limit: 5, selectedId: null, sessions: [] }] }
  h.reRender()
  await assert.rejects(() => runNavigate(h, member()), (e) => {
    assert.ok(e instanceof FailClosed)
    assert.match(why(e), /group-ambiguous/, 'duplicate group identity must be named: ' + why(e))
    return true
  })
  assert.equal(h.state.groups[0].expanded, false, 'nothing was toggled')
})

test('identity: an UNPROVEN expected group fails closed before a single rail click', async () => {
  const h = mountRail({})
  // The same canonical target, with the proven group identity REMOVED: the
  // driver must refuse rather than open whichever group renders first.
  const { groupKey, groupKeyProven, groupKeySource, ...unprovenTarget } = TARGET_MEMBER
  await assert.rejects(() => runNavigate(h, unprovenTarget), (e) => {
    assert.ok(e instanceof FailClosed)
    assert.match(why(e), /group-identity-missing/, 'no group identity => no positional guess: ' + why(e))
    return true
  })
  assert.equal(h.state.clicks.length, 0, 'the rail is untouched: ' + h.state.clicks.join(','))
})

test('identity: navPlan schedules the group step only for the EXPECTED group row', async () => {
  const target = { key: '', label: 'Ungrouped', expanded: true, limit: Infinity, selectedId: null, sessions: defaultState({}).groups[0].sessions }
  const h = mountRail({ groups: [otherGroup(1), otherGroup(2), target] })
  const leaves = await h.page.collectLeaves()
  assert.deepEqual(D.navPlan({ hasNotice: false, railLeaves: leaves, groupKey: '', groupKeyProven: true }).map((s) => s.step), [],
    'two strangers report collapsed while the target is open => no group step')
  const closed = await mountRail({ groups: [otherGroup(1), { ...target, expanded: false, limit: 5 }] }).page.collectLeaves()
  assert.deepEqual(D.navPlan({ hasNotice: false, railLeaves: closed, groupKey: '', groupKeyProven: true }).map((s) => s.step), ['expand-group'])
})

// ── membership derived from the read-only fixture data (before any browser) ──
const wsDoc = (workspaces, extraGlobal = {}) => ({
  unit: { name: 'workspace', version: 2 },
  global: { initialized: true, workspaceIds: Object.keys(workspaces), archivedSessionIds: [], pinnedSessionIds: [], ...extraGlobal },
  tables: { workspaces },
})
const wsRecord = (sessionIds, title = 'ws') => ({ path: '/fixture/ws', title, sessionIds, createdAt: '2026-10-05T18:51:17.695Z', updatedAt: '2026-10-05T18:51:17.724Z' })
const stubFs = (doc) => ({
  existsSync: () => doc !== undefined,
  readFileSync: () => { if (doc === undefined) { const e = new Error('ENOENT: no such file or directory'); throw e } return JSON.stringify(doc) },
})

test('membership: unaccounted sessions are Ungrouped, accounted ones are their workspaceId', () => {
  const doc = wsDoc({ '40d5679e-12f5-4f35-b417-0eab81103e1b': wsRecord(['session-a3b9157c-d45b-425f-9e74-1a2c4b5567cb']) })
  const a = D.deriveGroupKey({ membership: doc, sessionId: MEMBER_ID })
  assert.equal(a.ok, true, JSON.stringify(a))
  assert.equal(a.groupKey, '', 'tree.ts UNGROUPED_KEY === ""')
  const b = D.deriveGroupKey({ membership: doc, sessionId: 'session-a3b9157c-d45b-425f-9e74-1a2c4b5567cb' })
  assert.equal(b.ok, true)
  assert.equal(b.groupKey, '40d5679e-12f5-4f35-b417-0eab81103e1b', 'owningGroupKey returns the WORKSPACE ID (tree.ts:27-32), which is the data-row-key suffix')
})

test('membership: two workspaces claiming one session fail closed (no first-wins)', () => {
  const doc = wsDoc({ 'ws-a': wsRecord([MEMBER_ID], 'a'), 'ws-b': wsRecord([MEMBER_ID], 'b') })
  const r = D.deriveGroupKey({ membership: doc, sessionId: MEMBER_ID })
  assert.equal(r.ok, false)
  assert.match(r.reason, /claim|duplicate/i)
})

test('membership: an absent or unreadable workspace store fails closed — never a silent Ungrouped', () => {
  const r = D.deriveGroupKey({ membership: undefined, sessionId: MEMBER_ID })
  assert.equal(r.ok, false, JSON.stringify(r))
  assert.match(r.reason, /workspace|membership|unreadable|missing/i)
  const notObject = D.deriveGroupKey({ membership: { unit: { name: 'workspace' } }, sessionId: MEMBER_ID })
  assert.equal(notObject.ok, false, 'a store without tables is not proof of anything')
})

test('membership: readWorkspaceGroups reads storages/workspace.json from the world dir only', () => {
  const doc = wsDoc({ 'ws-1': wsRecord(['session-x']) })
  const seen = []
  const fsx = { existsSync: (p) => { seen.push(p); return true }, readFileSync: (p) => { seen.push(p); return JSON.stringify(doc) } }
  const out = D.readWorkspaceGroups('/fixture/world', fsx)
  assert.equal(out.ok, true, JSON.stringify(out))
  assert.equal(out.membership.tables.workspaces['ws-1'].sessionIds[0], 'session-x')
  assert.ok(seen.every((p) => p.includes('storages') && p.endsWith('workspace.json')), 'path stays inside the world: ' + seen.join(' '))
  assert.ok(!seen.some((p) => /credentials|browser-access|auth/i.test(p)), 'never touches credential material')
  const missing = D.readWorkspaceGroups('/fixture/world', stubFs(undefined))
  assert.equal(missing.ok, false)
})

test('membership: canonicalTargets carries the group key onto every target (or refuses)', () => {
  const projcache = { [ROOT_ID]: ROOT_TITLE, [MEMBER_ID]: MEMBER_TITLE, 'session-other': 'unrelated' }
  const membership = wsDoc({ '40d5679e-12f5-4f35-b417-0eab81103e1b': wsRecord(['session-a3b9157c']) })
  const ok = D.canonicalTargets({ projcache, rootId: ROOT_ID, memberIds: [MEMBER_ID], membership })
  assert.equal(ok.ok, true, JSON.stringify(ok))
  assert.equal(ok.targets.member.groupKey, '')
  assert.equal(ok.targets.member.groupKeyProven, true)
  assert.equal(ok.targets.root.groupKey, '')
  const owned = D.canonicalTargets({ projcache, rootId: MEMBER_ID, memberIds: [MEMBER_ID], membership: wsDoc({ 'ws-owner': wsRecord([MEMBER_ID]) }) })
  assert.equal(owned.targets.member.groupKey, 'ws-owner')
  const dup = D.canonicalTargets({ projcache, rootId: ROOT_ID, memberIds: [MEMBER_ID], membership: wsDoc({ a: wsRecord([MEMBER_ID]), b: wsRecord([MEMBER_ID]) }) })
  assert.equal(dup.ok, false, 'a member whose membership is ambiguous is refused BEFORE any browser launch')
  assert.match(dup.reason, /claim|duplicate/i)
})

// ── (2) rows live inside a real [role=tree] ─────────────────────────────────
test('scope: the rail rows are collected WITH their tree ancestor (faithful markup)', async () => {
  const h = mountRail({ ungroupedExpanded: true, ungroupedLimit: Infinity, wsExpanded: true })
  const leaves = await h.page.collectLeaves()
  const rows = leaves.filter((l) => String(l.key || '').startsWith('session:'))
  assert.ok(rows.length > 0, 'the faithful markup must produce session rows')
  assert.ok(rows.every((l) => l.role === 'treeitem'), 'every session row leaf reports the owning row role')
  assert.ok(rows.every((l) => Number.isInteger(l.treeSeq)), 'every session row leaf reports WHICH tree it is in (treeSeq)')
  assert.ok(rows.every((l) => Number.isInteger(l.rowSeq)), 'every session row leaf reports its row-container identity (rowSeq)')
})

test('scope: a keyed session row OUTSIDE every tree is never the target (NOT_FOUND, no click)', async () => {
  // Ungrouped is expanded but renders NO rows; the only element carrying the
  // canonical key is a visible row in the main column. 4bd found it and clicked.
  const h = mountRail({
    ungroupedExpanded: true,
    ungroupedSessions: [{ id: 'session-unrelated', title: 'ack:other:mpr-2026-10-01T13-21-34' }],
    extraMain: mainSpoof(MEMBER_ID),
  })
  await assert.rejects(() => runNavigate(h, member()), (e) => {
    assert.ok(e instanceof FailClosed)
    assert.match(why(e), /locate-not_found/, 'the spoof must not become the target: ' + why(e))
    assert.equal(e.diag.keyHits, 0, 'a keyed element outside the tree is not a row hit — it is recorded separately')
    assert.ok(e.diag.rail.unscopedKeyed >= 1, '…but it IS visible in the diagnostics')
    return true
  })
  assert.ok(!h.state.clicks.some((k) => k.startsWith('session:')), 'nothing clicked: ' + h.state.clicks.join(','))
})

test('scope: a keyed element without role=treeitem inside the tree is not a row either', async () => {
  const h = mountRail({ ungroupedExpanded: true, ungroupedSessions: [{ id: 'session-unrelated', title: 'ack:other:mpr-2026-10-01T13-21-34' }] })
  h.state.groups[0].extraInner = keyedNoRole(MEMBER_ID)
  h.reRender()
  await assert.rejects(() => runNavigate(h, member()), (e) => {
    assert.ok(e instanceof FailClosed)
    assert.match(why(e), /locate-not_found/, 'a bare data-row-key is not row identity: ' + why(e))
    return true
  })
  assert.ok(!h.state.clicks.some((k) => k.startsWith('session:')))
})

test('scope: the SAME key in two distinct real trees stays AMBIGUOUS (the first tree is not preferred)', async () => {
  const h = mountRail({ ungroupedExpanded: true, ungroupedLimit: Infinity })
  h.state.extraTree = {
    groups: [],
    inner: `<div class="${c.sessionRow}" data-row-key="session:${MEMBER_ID}" role="treeitem" aria-selected="false"><span class="${c.title}">${MEMBER_TITLE}</span><span class="${c.time}">1h</span></div>`,
  }
  h.reRender()
  const leaves = await h.page.collectLeaves()
  const hit = D.locateSessionRow(leaves, { sessionId: MEMBER_ID, title: MEMBER_TITLE })
  assert.equal(hit.status, 'AMBIGUOUS', 'two trees both rendering the canonical row is ambiguity: ' + JSON.stringify(hit.trees))
  assert.ok(new Set(hit.matches.map((l) => l.treeSeq)).size >= 2, 'the two candidates are in DIFFERENT trees')
  const err = await runNavigate(h, member()).then(() => null, (e) => e)
  assert.ok(err instanceof FailClosed && /locate-ambiguous/.test(why(err)), 'navigate refuses to arbitrate: ' + why(err))
  assert.ok(!h.state.clicks.some((k) => k.startsWith('session:')))
})

test('scope: the search tree alone may hold a row — and it is still a real tree, so it is found', async () => {
  const h = mountRail({ ungroupedExpanded: true, ungroupedSessions: [{ id: 'session-unrelated', title: 'ack:other:mpr-2026-10-01T13-21-34' }] })
  h.state.extraTree = {
    groups: [],
    inner: `<div class="${c.sessionRow}" data-row-key="session:${MEMBER_ID}" role="treeitem" aria-selected="false"><span class="${c.title}">${MEMBER_TITLE}</span><span class="${c.time}">1h</span></div>`,
  }
  h.state.allowOrphanSelect = true
  h.reRender()
  await runNavigate(h, member())
  assert.ok(h.state.clicks.includes('session:' + MEMBER_ID), 'scoping is about REAL trees, not about which panel is the sidebar')
})

// ── (3) row containers, not leaves ──────────────────────────────────────────
test('rows: one container with slot/title/time/actions leaves is ONE row', async () => {
  const h = mountRail({ ungroupedExpanded: true, ungroupedLimit: Infinity })
  const leaves = await h.page.collectLeaves()
  const mine = leaves.filter((l) => String(l.key || '') === 'session:' + MEMBER_ID)
  assert.ok(mine.length >= 2, 'the faithful row renders several leaves: ' + mine.map((l) => l.text).join('|'))
  assert.equal(new Set(mine.map((l) => l.rowSeq)).size, 1, '…all inside ONE row container')
  const hit = D.locateSessionRow(leaves, { sessionId: MEMBER_ID, title: MEMBER_TITLE })
  assert.equal(hit.status, 'FOUND')
  assert.equal(hit.rowContainers, 1, 'the locate reports ROWS, not leaves')
  assert.equal(hit.titleRows, 1)
})

test('rows: two containers sharing the canonical key are AMBIGUOUS even when only one keeps the canonical title', async () => {
  const h = mountRail({
    ungroupedExpanded: true,
    ungroupedLimit: Infinity,
    ungroupedSessions: [
      { id: 'session-before', title: 'ack:role-a:mpr-2026-10-01T13-21-34' },
      { id: MEMBER_ID, title: 'renamed after the canonical fixture value' },
      { id: MEMBER_ID, title: MEMBER_TITLE },
    ],
  })
  const leaves = await h.page.collectLeaves()
  const hit = D.locateSessionRow(leaves, { sessionId: MEMBER_ID, title: MEMBER_TITLE })
  assert.equal(hit.rowContainers, 2, 'duplicate canonical rows must be counted, not folded into "one match"')
  assert.equal(hit.status, 'AMBIGUOUS', '4bd resolved FOUND here and clicked one of them')
  const err = await runNavigate(h, member()).then(() => null, (e) => e)
  assert.ok(err instanceof FailClosed && /locate-ambiguous/.test(why(err)), 'fail-closed before any click: ' + why(err))
  assert.ok(!h.state.clicks.some((k) => k.startsWith('session:')), 'no click: ' + h.state.clicks.join(','))
})

test('rows: two REAL rows with equal titles and different ids stay AMBIGUOUS (policy preserved, not weakened)', async () => {
  const h = mountRail({
    ungroupedExpanded: true,
    ungroupedLimit: Infinity,
    ungroupedSessions: [
      { id: MEMBER_ID, title: MEMBER_TITLE },
      { id: 'session-twin-of-member', title: MEMBER_TITLE },
    ],
  })
  const leaves = await h.page.collectLeaves()
  const hit = D.locateSessionRow(leaves, { sessionId: MEMBER_ID, title: MEMBER_TITLE })
  assert.equal(hit.titleRows, 2, 'two distinct row containers carry the exact canonical title')
  assert.equal(hit.status, 'AMBIGUOUS', 'the canonical id alone does not buy a click when the title is duplicated by a real row')
  const err = await runNavigate(h, member()).then(() => null, (e) => e)
  assert.ok(err instanceof FailClosed && /locate-ambiguous/.test(why(err)), 'reported behavior: ' + why(err))
  assert.ok(!h.state.clicks.some((k) => k.startsWith('session:')))
})

test('rows: a title repeated by a hover card (no row identity) is still ignored', async () => {
  const h = mountRail({ ungroupedExpanded: true, ungroupedLimit: Infinity, extraMain: `<div class="hoverContent"><span>${MEMBER_TITLE}</span><span>1h ago</span><span>Idle</span></div>` })
  const leaves = await h.page.collectLeaves()
  const hit = D.locateSessionRow(leaves, { sessionId: MEMBER_ID, title: MEMBER_TITLE })
  assert.equal(hit.status, 'FOUND', 'text without row identity is not a second row')
  assert.equal(hit.titleRows, 1)
})

test('rows: a same-id row whose title left the canonical value is NOT_FOUND, with the mismatch reported', async () => {
  const h = mountRail({ ungroupedExpanded: true, ungroupedLimit: Infinity, memberTitle: 'renamed mid-run' })
  const err = await runNavigate(h, member()).then(() => null, (e) => e)
  assert.ok(err instanceof FailClosed && /locate-not_found/.test(why(err)), why(err))
  assert.equal(err.diag.titleMismatch, true, 'the diagnostics distinguish "row exists, title changed" from "no row at all"')
  assert.ok(!h.state.clicks.some((k) => k.startsWith('session:')))
})
