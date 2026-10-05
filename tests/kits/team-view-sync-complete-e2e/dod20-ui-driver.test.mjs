/**
 * dod20-ui-driver.test.mjs — OFFLINE tests for the DDoD20 UI driver's pure
 * navigation/locator/verdict core (node --test; no browser, no host, no
 * network; the dialog-state section runs the real exported probe under the
 * repo's own jsdom runtime — see below). The CALLER-side coverage (the real leg orchestration
 * driven through fake pages/networks) lives in
 * dod20-ui-driver-orchestration.test.mjs — this file is not, and does not
 * claim to be, a substitute for it.
 *
 *   node --test tests/kits/team-view-sync-complete-e2e/dod20-ui-driver.test.mjs
 *
 * Every fixture is a static HTML string or a plain data model hand-modeled on
 * the read-only env evidence (see dod20-ui-driver-fixtures.mjs). The dialog
 * fixtures are FAITHFUL TRANSCRIPTIONS of the pinned upstream DirectoryBrowser
 * structure, and the dialog-state tests execute the driver's REAL exported
 * probe source (DIALOG_STATE_SOURCE) against that markup inside jsdom — the
 * repo's standard DOM engine from the pinned test-use runtime (paths.mjs
 * TEST_USE_REL), NOT a hand-rolled DOM shim: if the engine cannot run the
 * probe, the test fails loudly. This jsdom layer still does NOT substitute
 * for the real Chromium live lane (the live-only gaps stay honestly listed
 * in the PR body); no browser, host, or network is started here.
 * The tests encode the failure lessons of driver v1–v3 AND the external-review
 * P2 list of the PR #55 rounds (correlated responses, product-derived cadence,
 * realpath authorization, consistent aggregation, real-DOM dialog state,
 * response-representation unification).
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  htmlLeaves,
  navPlan,
  locateTitle,
  groupCollapsed,
  groupHeaderLeaf,
  railRows,
  locateSessionRow,
  railDiagnostic,
  overflowPending,
  parseParams,
  parseRequestEnvelope,
  parseServerResponseEnvelope,
  canonicalTargets,
  DIALOG_STATE_SOURCE,
  DIALOG_TITLES,
  DIALOG_HOME_LABELS,
  authorizeWorkspace,
  e2WorkspaceSteps,
  e2AbortSteps,
  assertSessionCwd,
  verifySelection,
  findCreatedSession,
  evalE1,
  evalE2,
  evalE3,
  evalE5,
  e4NotRun,
  summarize,
  parseTickMsSource,
  parseArgs,
  scrubEvidence,
  redactOut,
} from './dod20-ui-driver.mjs'
import * as F from './dod20-ui-driver-fixtures.mjs'

// ── DOM leaf parsing (pure, over static fixture HTML) ──────────────────────
test('htmlLeaves: a collapsed group reports ITSELF collapsed (data-row-key + aria-expanded), and renders ZERO session rows', () => {
  const leaves = htmlLeaves(F.RAIL_COLLAPSED)
  const un = groupHeaderLeaf(leaves)
  assert.ok(un, 'a group row reporting aria-expanded=false must be found (probe3 rail-after-notice)')
  // CORRECTED 2026-10-05: the group is identified by the product's own
  // semantics. The shipped class prefix rotates with the build — asserting it
  // is what made the 2026-10-05T18-50-45Z lane blind (railRowCount 0).
  assert.equal(un.key, 'workspace:', 'the ungrouped bucket key is the empty string (tree.ts:19)')
  assert.equal(un.expanded, 'false', 'aria-expanded is the ONLY collapse evidence')
  assert.equal(railRows(leaves, 'session').length, 0, 'a collapsed group renders no session rows')
  assert.equal(groupCollapsed(leaves), true)
})

test('rail identity is locale-independent: the same collapsed group is found under the Chinese label', () => {
  const zh = F.RAIL_COLLAPSED.replace('>Ungrouped<', '>未分组<')
  const leaves = htmlLeaves(zh)
  assert.equal(groupCollapsed(leaves), true, 'GROUP STATE IS AN ATTRIBUTE, never the English label')
  assert.equal(groupHeaderLeaf(leaves).text, '未分组')
})

test('htmlLeaves: the v3 overflow-only expand is proven a no-op pre-expansion', () => {
  const leaves = htmlLeaves(F.RAIL_COLLAPSED)
  assert.equal(overflowPending(leaves), false,
    'the overflow button does NOT exist while the group is collapsed — v3 clicked only this, forever invisible')
})

test('htmlLeaves: expanding the group renders rows and the overflow button appears', () => {
  const leaves = htmlLeaves(F.RAIL_EXPANDED)
  assert.equal(groupCollapsed(leaves), false)
  assert.equal(overflowPending(leaves), true, "'Show 4 more sessions' matches /^Show \\d+ more sessions$/")
})

// ── fixed navigation plan (no fallbacks, strict order) ─────────────────────
test('navPlan: strict order notice → group-expand → overflow, and expand precedes overflow click', () => {
  const collapsedPlan = navPlan({ hasNotice: true, railLeaves: htmlLeaves(F.RAIL_COLLAPSED) })
  assert.deepEqual(collapsedPlan.map((s) => s.step), ['dismiss-notice', 'expand-group'],
    'a rail reporting aria-expanded=false schedules the group click first')
  const expandedPlan = navPlan({ hasNotice: false, railLeaves: htmlLeaves(F.RAIL_EXPANDED) })
  assert.deepEqual(expandedPlan.map((s) => s.step), ['expand-overflow'],
    'overflow is only scheduled once an aria-expanded=false overflow row actually rendered')
})

test('navPlan: no notice => no dismiss step; an already-expanded group is NEVER scheduled (the row is a toggle)', () => {
  const plan = navPlan({ hasNotice: false, railLeaves: htmlLeaves(F.RAIL_EXPANDED_ALL) })
  assert.deepEqual(plan.map((s) => s.step), [],
    'clicking an aria-expanded=true project row COLLAPSES the tree — the v3 lesson is "open what reports itself closed", not "always click"')
})

// ── title-exact rail location ───────────────────────────────────────────────
test('locateTitle: FOUND only on an exact canonical title match among rendered rows', () => {
  const leaves = htmlLeaves(F.RAIL_EXPANDED_ALL)
  const hit = locateTitle(leaves, F.MEMBER_TITLE, { exclude: ['Ungrouped'] })
  assert.equal(hit.status, 'FOUND')
  assert.equal(hit.leaf.text, F.MEMBER_TITLE)
})

test('locateTitle: group reorder is irrelevant — locate stays title-exact', () => {
  const leaves = htmlLeaves(F.RAIL_REORDERED)
  const hit = locateTitle(leaves, F.ROOT_TITLE, { exclude: ['Ungrouped'] })
  assert.equal(hit.status, 'FOUND')
  assert.equal(hit.index, 0, 'the reordered fixture puts the root row FIRST — a positional driver would break here')
  const member = locateTitle(leaves, F.MEMBER_TITLE, { exclude: ['Ungrouped'] })
  assert.equal(member.status, 'FOUND')
})

test('locateTitle: a hover tooltip repeating the title is NOT a row — an id-scoped locate stays FOUND', () => {
  // The old model needed an exclude list and still went AMBIGUOUS here. Row
  // scope (data-row-key) removes the hazard: the tooltip carries no key.
  const leaves = htmlLeaves(F.RAIL_DUPLICATE_TITLE)
  const hit = locateTitle(leaves, F.MEMBER_TITLE)
  assert.equal(hit.status, 'FOUND', 'the tooltip span is not a session-tree row')
  assert.equal(hit.leaf.key, 'session:' + F.MEMBER_ID)
  const row = locateSessionRow(leaves, { sessionId: F.MEMBER_ID, title: F.MEMBER_TITLE })
  assert.equal(row.status, 'FOUND')
})

test('locateSessionRow: two RENDERED rows with the same canonical key => AMBIGUOUS, never first-match', () => {
  const leaves = htmlLeaves(F.RAIL_DUPLICATE_KEY)
  const hit = locateSessionRow(leaves, { sessionId: F.MEMBER_ID, title: F.MEMBER_TITLE })
  assert.equal(hit.status, 'AMBIGUOUS')
  assert.equal(hit.matches.length, 2)
})

test('locateSessionRow: the canonical id AND the exact canonical title are both required', () => {
  const leaves = htmlLeaves(F.RAIL_EXPANDED_ALL)
  assert.equal(locateSessionRow(leaves, { sessionId: F.MEMBER_ID, title: 'renamed mid-run' }).status, 'NOT_FOUND')
  assert.equal(locateSessionRow(leaves, { sessionId: 'session-does-not-exist', title: F.MEMBER_TITLE }).status, 'NOT_FOUND')
  const ok = locateSessionRow(leaves, { sessionId: F.MEMBER_ID, title: F.MEMBER_TITLE })
  assert.equal(ok.status, 'FOUND')
  assert.equal(ok.leaf.selected, 'false', 'the pre-click row is unselected — selection is proven later, never assumed')
})

test('railDiagnostic: a credential-shaped row text is MASKED, never copied into the snapshot', () => {
  const secret = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ012345'
  const leaves = htmlLeaves(F.RAIL_EXPANDED.replace('>ack:role-a:mpr-2026-10-01T13-21-34<', `>launch?token=${secret}<`))
  const wire = JSON.stringify(railDiagnostic(leaves))
  assert.ok(!wire.includes(secret), 'a token must never be copied out of the DOM')
  assert.match(wire, /token=SCRUBBED/)
  assert.ok(!/launchUrl|"href"/.test(wire), 'the snapshot carries no launch-URL-shaped field')
})

test('railDiagnostic: bounded, structural, never raw markup', () => {
  const leaves = htmlLeaves(F.RAIL_EXPANDED)
  const d = railDiagnostic(leaves)
  assert.equal(d.sessionRows, 5)
  assert.equal(d.groups.length, 1)
  assert.equal(d.groups[0].expanded, 'true')
  assert.equal(d.overflowRows.length, 1)
  assert.equal(d.sample.length, 5)
  assert.ok(d.sample.every((r) => r.key.startsWith('session:') && !('cls' in r) && !('html' in r)))
})

test('locateTitle: prefix/suffix lookalikes never match — exact textContent only', () => {
  const leaves = htmlLeaves(F.RAIL_EXPANDED_ALL)
  const hit = locateTitle(leaves, 'ack:role-a', { exclude: ['Ungrouped'] })
  assert.equal(hit.status, 'NOT_FOUND', 'ack:role-a must not grab ack:role-a-leader (v2-style substring risk)')
})

test('locateTitle: target missing => NOT_FOUND (fail-closed; the neighbor rows exist and are NOT chosen)', () => {
  const leaves = htmlLeaves(F.RAIL_TARGET_MISSING)
  const hit = locateTitle(leaves, F.MEMBER_TITLE, { exclude: ['Ungrouped'] })
  assert.equal(hit.status, 'NOT_FOUND')
})

test('locateTitle: a collapsed rail cannot contain the target => the v3 miss is deterministic, not silent', () => {
  const leaves = htmlLeaves(F.RAIL_COLLAPSED)
  const hit = locateTitle(leaves, F.ROOT_TITLE, { exclude: ['Ungrouped'] })
  assert.equal(hit.status, 'NOT_FOUND')
})

// ── canonical identity plumbing + wire envelopes ───────────────────────────
test('parseParams: /team-remote client-request envelope yields the params (probe3 wire shape)', () => {
  const post = '{"type":"client-request","rpcId":"1dc93440","method":"team.getReadState","payload":{"version":6,"params":{"sessionId":"session-team-child-52860b"}}}'
  assert.deepEqual(parseParams(post), { sessionId: 'session-team-child-52860b' })
  assert.equal(parseParams('not json'), null)
})

test('parseRequestEnvelope: rpcId + params come out of the frozen client-request envelope', () => {
  const env = parseRequestEnvelope('{"type":"client-request","rpcId":"1dc93440","method":"team.getReadState","payload":{"version":6,"params":{"sessionId":"s1"}}}')
  assert.equal(env.rpcId, '1dc93440')
  assert.deepEqual(env.params, { sessionId: 's1' })
  assert.equal(parseRequestEnvelope('nope'), null)
})

test('parseServerResponseEnvelope: the frozen { rpcId, result } envelope; garbage is UNCORRELATED (null)', () => {
  const ok = parseServerResponseEnvelope('{"rpcId":"r7","result":{"ok":true,"value":{"data":{"relation":"team-member","memberInstanceId":"inst-x"},"provenance":{}}}}')
  assert.equal(ok.rpcId, 'r7')
  assert.equal(ok.ok, true)
  assert.equal(ok.data.relation, 'team-member')
  const err = parseServerResponseEnvelope('{"rpcId":"r7","result":{"ok":false,"error":{"code":"internal","message":"m","details":{}}}}')
  assert.equal(err.ok, false)
  assert.equal(err.error, 'internal')
  assert.equal(parseServerResponseEnvelope('{"relation":"team-member"}'), null, 'a bare body without the rpcId/result envelope is NEVER accepted')
})

test('canonicalTargets: unique canonical titles build the (id,title) targets', () => {
  const t = canonicalTargets({ projcache: F.fakeProjcacheTitles(), rootId: F.ROOT_ID, memberIds: [F.MEMBER_ID] })
  assert.equal(t.ok, true)
  assert.equal(t.targets.root.title, F.ROOT_TITLE)
  assert.equal(t.targets.member.title, F.MEMBER_TITLE)
  assert.equal(t.targets.member.id, F.MEMBER_ID)
})

test('canonicalTargets: ambiguous duplicate titles => fatal before any browser launch', () => {
  const t = canonicalTargets({
    projcache: { [F.ROOT_ID]: 'dup', [F.MEMBER_ID]: 'dup', boot: null },
    rootId: F.ROOT_ID,
    memberIds: [F.MEMBER_ID],
  })
  assert.equal(t.ok, false)
  assert.match(t.reason, /ambiguous|duplicate/i)
})

test('canonicalTargets: null title (the boot-row shape) is never a matchable title', () => {
  const t = canonicalTargets({ projcache: F.fakeProjcacheTitles({ memberTitle: null }), rootId: F.ROOT_ID, memberIds: [F.MEMBER_ID] })
  assert.equal(t.ok, false)
  assert.match(t.reason, /title/i)
})

// ── E2 workspace picker (shot-E2-ordinary-v3.png root cause) ═══════════════
// FROZEN ROUND-2 ITEM 2: the dialog MODEL comes from the REAL exported probe.
// probe(markup) executes the driver's exported DIALOG_STATE_SOURCE string,
// verbatim, inside a real jsdom document parsed from FAITHFUL upstream markup
// (fixtures pickerMarkup = transcription of DirectoryBrowser.tsx @46a7f68b09).
// No hand-rolled DOM, no stubbed probe — selector/parent/child/text failures
// would fail here exactly as they would in the page.
const probe = (html) => F.probeMarkup(html, DIALOG_STATE_SOURCE).state

test('probe (real exported source, real jsdom): open/title/crumbs/rows/buttons from faithful DirectoryBrowser markup', () => {
  const d = probe(F.MODAL_WORKSPACE_PICKER)
  assert.equal(d.open, true)
  assert.equal(d.title, 'Select Workspace Directory')
  assert.deepEqual(d.crumbLabels, ['Home'])
  assert.deepEqual(d.rows.map((r) => r.name), ['bin', 'deepseek-harness', 'workspace', 'testhome'])
  assert.equal(d.rows.every((r) => r.selected === false), true, 'nothing selected => no aria-current')
  assert.equal(d.rows.every((r) => r.level === 0), true, 'single Miller column')
  assert.ok(d.buttons.includes('Open') && d.buttons.includes('Cancel') && d.buttons.includes('New folder'))
})

test('probe: crumb trail is an ORDERED ARRAY OF BUTTONS — flattened text welding (Hometesthome) is structurally impossible', () => {
  const { document, state } = F.probeMarkup(F.MODAL_PICKER_DEEP, DIALOG_STATE_SOURCE)
  assert.deepEqual(state.crumbLabels, ['Home', 'testhome'], 'two INDEPENDENT crumb buttons (:818), read per-button')
  const nav = document.querySelector('[role="navigation"]')
  assert.equal(nav.textContent.replace(/\s+/g, ' ').trim(), 'Hometesthome', 'sanity: the flattened text really IS the welded hazard the old single-crumb probe consumed')
  assert.notEqual(state.crumbLabels.join(), undefined)
  assert.equal(state.crumbLabels.length, 2, 'the weld would have produced ONE label; the probe sees two')
  assert.equal(state.rows.find((r) => r.name === 'testhome').selected, true, 'aria-current on the row BUTTON (:238)')
  assert.equal(state.rows.find((r) => r.name === 'fixtures').selected, false)
  assert.equal(state.rows.find((r) => r.name === 'fixtures').level, 1, 'second Miller column = level 1')
})

test('probe: selection marker is the BUTTON aria-current — a listitem-wrapper marker is NOT believed', () => {
  const wrongShape = '<div role="dialog"><h2>Select Workspace Directory</h2><span role="navigation"><button>Home</button></span><div role="list"><span role="listitem" aria-current="true"><button><span class="_rowName_h">ws</span></button></span></div></div>'
  const d = probe(wrongShape)
  assert.equal(d.rows[0].name, 'ws')
  assert.equal(d.rows[0].selected, false, 'the real component marks selection on the row button, never the listitem wrapper (:238) — the probe mirrors the component, not any aria-current')
})

test('probe: ZH exact i18n values open the dialog; foreign titles do not', () => {
  assert.deepEqual([...DIALOG_TITLES], ['Select Workspace Directory', '选择工作区目录'])
  assert.deepEqual([...DIALOG_HOME_LABELS], ['Home', '主目录'])
  const zh = probe(F.MODAL_PICKER_ZH)
  assert.equal(zh.open, true)
  assert.deepEqual(zh.crumbLabels, ['主目录'])
  const plain = probe('<p>plain innerText has no dialog at all — exactly why the live lane reads REAL DOM state</p>')
  assert.equal(plain.open, false)
  assert.equal(plain.title, null)
})

// ── realpath authorization (external review P6) ────────────────────────────
const HOME = '/home/user'

test('authorizeWorkspace: direct child of the approved root passes', () => {
  const a = authorizeWorkspace({ testWorkspaceReal: '/home/user/testhome/ws', authorizedRootReal: '/home/user/testhome', homeReal: HOME })
  assert.equal(a.ok, true)
  assert.deepEqual(a.ancestors, ['testhome'])
  assert.equal(a.folder, 'ws')
})

test('authorizeWorkspace: DEEP nesting under the approved root passes with the full level plan', () => {
  const a = authorizeWorkspace({ testWorkspaceReal: '/home/user/testhome/fixtures/ws', authorizedRootReal: '/home/user/testhome', homeReal: HOME })
  assert.equal(a.ok, true)
  assert.deepEqual(a.ancestors, ['testhome', 'fixtures'])
})

test('authorizeWorkspace: outside the approved root (realpath escape) is REJECTED — a name match is not authorization', () => {
  const a = authorizeWorkspace({ testWorkspaceReal: '/elsewhere/private/testhome-ws', authorizedRootReal: '/home/user/testhome', homeReal: HOME })
  assert.equal(a.ok, false)
  assert.match(a.reason, /containment|not inside/i)
})

test('authorizeWorkspace: the approved root may NOT be the private home itself', () => {
  const a = authorizeWorkspace({ testWorkspaceReal: '/home/user/workspace', authorizedRootReal: HOME, homeReal: HOME })
  assert.equal(a.ok, false)
  assert.match(a.reason, /private home|too broad/i)
})

test('authorizeWorkspace: a workspace above/outside the home is rejected (the dialog browses from Home only)', () => {
  const a = authorizeWorkspace({ testWorkspaceReal: '/srv/fixtures/ws', authorizedRootReal: '/srv/fixtures', homeReal: HOME })
  assert.equal(a.ok, false)
  assert.match(a.reason, /home root|not under/i)
})

// ── E2 dialog plan discipline (coordinator ruling 2026-10-01 + review P6) ──
const AUTH_WS = '/home/user/workspace'
const flatAuthz = { ancestors: [], folder: 'workspace' }

test('e2WorkspaceSteps: authorized dir under the authorized root => OK, exact-name select + post-action cwd verify', () => {
  const s = e2WorkspaceSteps({ dialog: probe(F.MODAL_WORKSPACE_PICKER), authz: flatAuthz, absPath: AUTH_WS })
  assert.equal(s.ok, true)
  assert.deepEqual(s.steps, ['select:workspace', 'open', 'assert-dialog-closed', 'verify-session-cwd:' + AUTH_WS])
})

test('e2WorkspaceSteps: a NESTED approved fixture emits the level-by-level cd plan (no direct-child-of-home rule)', () => {
  const s = e2WorkspaceSteps({
    dialog: probe(F.MODAL_WORKSPACE_PICKER_NESTED),
    authz: { ancestors: ['testhome', 'fixtures'], folder: 'ws' },
    absPath: '/home/user/testhome/fixtures/ws',
  })
  assert.equal(s.ok, true)
  assert.deepEqual(s.steps, ['cd:testhome', 'cd:fixtures', 'select:ws', 'open', 'assert-dialog-closed', 'verify-session-cwd:/home/user/testhome/fixtures/ws'])
})

test('e2WorkspaceSteps: authorized dir absent from the listing => NOT_RUN (no neighbor pick)', () => {
  const s = e2WorkspaceSteps({ dialog: probe(F.MODAL_WORKSPACE_PICKER_NO_FOLDER), authz: flatAuthz, absPath: AUTH_WS })
  assert.equal(s.ok, false)
  assert.match(s.reason, /workspace folder|folder/i)
})

test('e2WorkspaceSteps: near-miss names (same prefix / suffix / spaced copy) are REJECTED', () => {
  const s = e2WorkspaceSteps({ dialog: probe(F.MODAL_WORKSPACE_PICKER_NEAR_MISS), authz: flatAuthz, absPath: AUTH_WS })
  assert.equal(s.ok, false)
  assert.match(s.reason, /never pick/i)
})

test('e2WorkspaceSteps: dialog browsed to a foreign root => NOT_RUN (exact-root discipline, even when the folder name is offered)', () => {
  const s = e2WorkspaceSteps({ dialog: probe(F.MODAL_WORKSPACE_PICKER_FOREIGN_ROOT), authz: flatAuthz, absPath: AUTH_WS })
  assert.equal(s.ok, false)
  assert.match(s.reason, /root/i)
})

test('e2WorkspaceSteps: a non-absolute authorized realpath never reaches Open', () => {
  const s = e2WorkspaceSteps({ dialog: probe(F.MODAL_WORKSPACE_PICKER), authz: flatAuthz, absPath: 'workspace' })
  assert.equal(s.ok, false)
  assert.match(s.reason, /absolute/i)
})

test('e2WorkspaceSteps: no dialog open => NOT_RUN reason', () => {
  const s = e2WorkspaceSteps({ dialog: null, authz: flatAuthz, absPath: AUTH_WS })
  assert.equal(s.ok, false)
  assert.match(s.reason, /not open/i)
})

test('e2AbortSteps: fail-closed BEFORE Open leaves the modal UNCONFIRMED via the asserted Cancel path', () => {
  const s = e2WorkspaceSteps({ dialog: probe(F.MODAL_WORKSPACE_PICKER_NO_FOLDER), authz: flatAuthz, absPath: AUTH_WS })
  const a = e2AbortSteps({ dialog: probe(F.MODAL_WORKSPACE_PICKER_NO_FOLDER), failedBeforeOpen: !s.ok })
  assert.deepEqual(a.steps, ['click-cancel', 'assert-dialog-closed'])
  assert.equal(e2AbortSteps({ dialog: { open: false }, failedBeforeOpen: true }).steps.length, 0, 'nothing to cancel when no dialog is open')
  assert.equal(e2AbortSteps({ dialog: probe(F.MODAL_WORKSPACE_PICKER), failedBeforeOpen: false }).steps.length, 0, 'after Open there is no modal to cancel')
})

test('assertSessionCwd: the created session\'s projcache identity.cwd must equal the authorized path exactly', () => {
  const rec = JSON.parse(F.fakeSessionProjcacheRecord(AUTH_WS))
  const ok = assertSessionCwd({ record: rec, expectedPath: AUTH_WS })
  assert.equal(ok.ok, true)
  const bad = assertSessionCwd({ record: JSON.parse(F.fakeSessionProjcacheRecord('/home/user/deepseek-harness')), expectedPath: AUTH_WS })
  assert.equal(bad.ok, false)
  assert.match(bad.reason, /cwd/i)
  const missing = assertSessionCwd({ record: null, expectedPath: AUTH_WS })
  assert.equal(missing.ok, false, 'no projcache record is NOT a pass (fail-closed)')
})

// ── selection verification: EXACT header + CORRELATED success response ──────
const expectedMember = { sessionId: F.MEMBER_ID, relation: 'team-member', title: F.MEMBER_TITLE, instance: F.MEMBER_INSTANCE }
const req1 = { seq: 1, kind: 'req', t: 2000, m: 'team.getReadState', rpcId: 'r1', p: { sessionId: F.MEMBER_ID } }
const resOk = { seq: 2, kind: 'res', m: 'team.getReadState', reqSeq: 1, rpcId: 'r1', status: 200, ok: true, t: 2001, data: { relation: 'team-member', memberInstanceId: F.MEMBER_INSTANCE, liveToken: 'lt-v1-x' } }

const vWith = (over = {}) => verifySelection({
  headerLeaves: htmlLeaves(F.sessionHeaderHtml(F.MEMBER_ID)),
  freshRequests: [req1],
  freshResponses: [resOk],
  expected: expectedMember,
  ...over,
})

test('verifySelection: header id EXACTLY + fresh readState(id) + correlated SUCCESS response => verified', () => {
  const v = vWith()
  assert.equal(v.verified, true)
  assert.equal(v.headerOk, true)
  assert.equal(v.networkOk, true)
  assert.equal(v.resSeq, 2)
})

test('verifySelection: header alone is NOT a verified selection', () => {
  const v = vWith({ freshResponses: [] })
  assert.equal(v.verified, false)
  assert.equal(v.headerOk, true)
  assert.equal(v.networkOk, false)
  assert.equal(v.why, 'no-bound-response')
})

test('verifySelection: network alone is NOT a verified selection', () => {
  const v = vWith({ headerLeaves: htmlLeaves('<header><h1>ack something</h1></header>') })
  assert.equal(v.verified, false)
  assert.equal(v.headerOk, false)
  assert.equal(v.networkOk, true)
})

test('verifySelection: a SUBSTRING header is not the selection (exact id leaf only)', () => {
  const v = vWith({ headerLeaves: [{ text: 'x' + F.MEMBER_ID + ' — decorated', y: 20 }, { text: 'team notes mention ' + F.MEMBER_ID, y: 40 }] })
  assert.equal(v.headerOk, false, 'decorated/informative leaves containing the id NEVER authenticate (review P4)')
  assert.equal(v.verified, false)
})

test('verifySelection: a fresh readState for a DIFFERENT session id is not the target', () => {
  const v = vWith({
    freshRequests: [{ seq: 9, kind: 'req', t: 2000, m: 'team.getReadState', rpcId: 'r9', p: { sessionId: 'session-team-child-259520eccdc5502ef43ef3f0762921e6' } }],
  })
  assert.equal(v.verified, false)
})

test('verifySelection: stale events (t < click time) never verify the selection', () => {
  const v = vWith({
    freshRequests: [{ seq: 1, kind: 'req', t: 900, m: 'team.getReadState', rpcId: 'r1', p: { sessionId: F.MEMBER_ID } }],
    clickT: 1000,
  })
  assert.equal(v.networkOk, false)
  assert.equal(v.verified, false)
})

test('verifySelection: a response bound to a FOREIGN request or rpcId rejects (late-foreign hazard)', () => {
  assert.equal(vWith({ freshResponses: [{ ...resOk, reqSeq: 77 }] }).verified, false, 'bound to another request')
  assert.equal(vWith({ freshResponses: [{ ...resOk, rpcId: 'ffffffff' }] }).verified, false, 'rpcId does not match the request')
  assert.equal(vWith({ freshResponses: [{ ...resOk, rpcId: null }] }).verified, false, 'uncorrelated body never authenticates')
})

test('verifySelection: failed responses reject — status 500 and envelope ok:false', () => {
  assert.equal(vWith({ freshResponses: [{ ...resOk, status: 500 }] }).verified, false)
  assert.equal(vWith({ freshResponses: [{ ...resOk, ok: false, data: null, error: 'internal' }] }).verified, false)
})

test('verifySelection: wrong relation or a foreign memberInstanceId rejects (parsed-data check)', () => {
  assert.equal(vWith({ freshResponses: [{ ...resOk, data: { relation: 'team-root', liveToken: 'lt-v1-x' } }] }).verified, false)
  assert.equal(vWith({ freshResponses: [{ ...resOk, data: { relation: 'team-member', memberInstanceId: 'inst-OTHER', liveToken: 'lt-v1-x' } }] }).verified, false)
})

test('verifySelection: the root case verifies on the team-root relation of ITS correlated response', () => {
  const v = verifySelection({
    headerLeaves: [{ text: F.ROOT_ID, y: 20, region: 'main' }],
    freshRequests: [{ seq: 3, kind: 'req', t: 10, m: 'team.getReadState', rpcId: 'r3', p: { sessionId: F.ROOT_ID } }],
    freshResponses: [{ seq: 4, kind: 'res', m: 'team.getReadState', reqSeq: 3, rpcId: 'r3', status: 200, ok: true, t: 12, data: { relation: 'team-root', durableGeneration: 32 } }],
    expected: { sessionId: F.ROOT_ID, relation: 'team-root' },
  })
  assert.equal(v.verified, true)
})

// ── created-session discovery (review P4: never an exclusion guess) ─────────
const reqA = { seq: 10, kind: 'req', m: 'team.getReadState', rpcId: 'ra', p: { sessionId: F.MEMBER_ID }, t: 0 }
const reqNew = { seq: 11, kind: 'req', m: 'team.getReadState', rpcId: 'rn', p: { sessionId: 'ses-new-ordinary-1' }, t: 100 }
const resNone = { seq: 12, kind: 'res', m: 'team.getReadState', reqSeq: 11, rpcId: 'rn', status: 200, ok: true, t: 110, data: { relation: 'none', liveToken: null } }

test('findCreatedSession: the SUCCESS relation-none correlated response names the session', () => {
  const f = findCreatedSession({ responses: [resNone], requests: [reqA, reqNew], excludeIds: [F.ROOT_ID, F.MEMBER_ID], afterT: 50 })
  assert.equal(f.ok, true)
  assert.equal(f.sessionId, 'ses-new-ordinary-1')
})

test('findCreatedSession: failed / uncorrelated / stale / ambiguous candidates never resolve to a pick', () => {
  assert.equal(findCreatedSession({ responses: [{ ...resNone, ok: false, data: null }], requests: [reqNew], excludeIds: [], afterT: 0 }).ok, false)
  assert.equal(findCreatedSession({ responses: [{ ...resNone, rpcId: 'ghost' }], requests: [reqNew], excludeIds: [], afterT: 0 }).ok, false, 'rpcId mismatch unbinds the response')
  assert.equal(findCreatedSession({ responses: [{ ...resNone, t: 10 }], requests: [reqNew], excludeIds: [], afterT: 50 }).ok, false, 'before the Open moment')
  const two = findCreatedSession({ responses: [resNone, { ...resNone, seq: 13, reqSeq: 14, rpcId: 'rn2' }], requests: [reqNew, { seq: 14, kind: 'req', m: 'team.getReadState', rpcId: 'rn2', p: { sessionId: 'ses-other' }, t: 105 }], excludeIds: [], afterT: 0 })
  assert.equal(two.ok, false)
  assert.match(two.reason, /ambiguous/)
})

test('findCreatedSession (frozen item 5): the REQUEST must also be fresh — a pre-Open request with a late response never impersonates the created session', () => {
  const staleReq = { seq: 20, kind: 'req', m: 'team.getReadState', rpcId: 'r-old', p: { sessionId: 'session-ordinary-old-1' }, t: 5 }
  const lateRes = { seq: 21, kind: 'res', m: 'team.getReadState', reqSeq: 20, rpcId: 'r-old', status: 200, ok: true, t: 500, data: { relation: 'none', liveToken: null } }
  const f = findCreatedSession({ responses: [lateRes], requests: [staleReq], excludeIds: [], afterT: 100 })
  assert.equal(f.ok, false, 'response-side freshness alone was the round-1 hole: the old ordinary session is NOT the created one')
  assert.match(f.reason, /fresh|correlated/)
  const withSeen = findCreatedSession({ responses: [lateRes], requests: [staleReq], excludeIds: [], excludeSeenBefore: ['session-ordinary-old-1'], afterT: 0 })
  assert.equal(withSeen.ok, false, 'a session id already polled before Open is by definition not brand-new')
})

test('findCreatedSession (frozen item 5): a response without a wire rpcId never authenticates (non-null on BOTH sides)', () => {
  const noRpcRes = { ...resNone, rpcId: null }
  assert.equal(findCreatedSession({ responses: [noRpcRes], requests: [reqNew], excludeIds: [], afterT: 50 }).ok, false, 'null response rpcId — symmetric with verifySelection (:rpcid-mismatch-or-uncorrelated)')
  const reqNull = { ...reqNew, rpcId: null }
  assert.equal(findCreatedSession({ responses: [resNone], requests: [reqNull], excludeIds: [], afterT: 50 }).ok, false, 'null request rpcId cannot correlate either')
})

// ── leg oracles ──────────────────────────────────────────────────────────────
const rs = (t, sessionId) => ({ kind: 'req', t, m: 'team.getReadState', p: { sessionId } })
const pj = (t, teamSessionId) => ({ kind: 'req', t, m: 'team.getProjection', p: { teamSessionId } })
const lg = (t, teamSessionId, afterSequence = 0, limit = 50) => ({ kind: 'req', t, m: 'team.getLedgerPage', p: { teamSessionId, afterSequence, limit } })
const lr = (t) => ({ kind: 'req', t, m: 'team.listRoots', p: {} })

test('evalE1: member-first window PASSes exactly on the frozen shape', () => {
  const net = [
    rs(0, F.MEMBER_ID), pj(10, F.ROOT_ID), lg(20, F.ROOT_ID),
    rs(3000, F.MEMBER_ID), rs(6000, F.MEMBER_ID),
  ]
  const bodies = [{ t: 1, body: '{"relation":"team-member","memberInstanceId":"inst-0iin89s0dvix"}' }]
  const v = evalE1({ net, bodies, expectedMember: { sessionId: F.MEMBER_ID, instance: F.MEMBER_INSTANCE }, expectedRootId: F.ROOT_ID, preClick: 0, t0: -1 })
  assert.equal(v.verdict, 'PASS')
})

test('evalE1: preClick traffic or a second projection FAILs (semantics not weakened)', () => {
  const net = [rs(0, F.MEMBER_ID), pj(10, F.ROOT_ID), lg(20, F.ROOT_ID), rs(3000, F.MEMBER_ID), rs(6000, F.MEMBER_ID)]
  const bodies = [{ t: 1, body: '{"relation":"team-member","memberInstanceId":"inst-0iin89s0dvix"}' }]
  assert.equal(evalE1({ net, bodies, expectedMember: { sessionId: F.MEMBER_ID, instance: F.MEMBER_INSTANCE }, expectedRootId: F.ROOT_ID, preClick: 1, t0: -1 }).verdict, 'FAIL')
  assert.equal(evalE1({ net: [...net, pj(7000, F.ROOT_ID)], bodies, expectedMember: { sessionId: F.MEMBER_ID, instance: F.MEMBER_INSTANCE }, expectedRootId: F.ROOT_ID, preClick: 0, t0: -1 }).verdict, 'FAIL')
})

const e3Net = (root = F.ROOT_ID, interval = 3000) => {
  const net = [pj(0, F.ROOT_ID), lg(1, F.ROOT_ID)]
  for (let i = 0; i < 7; i += 1) net.push(rs(10 + i * interval, root))
  return net
}

test('evalE3: >=7 readStates, cadence from the PRODUCT interval, exactly-1 cold projection, 1 ledger', () => {
  const v = evalE3({ net: e3Net(), expectedRootId: F.ROOT_ID, t0: -1, intervalMs: 3000 })
  assert.equal(v.verdict, 'PASS')
  assert.equal(v.measured.projections, 1)
  assert.equal(v.measured.rootIdentityOk, true)
  assert.ok(v.measured.deltasMs.length >= 6, '>=6 target tick deltas')
})

test('evalE3: a non-default PRODUCT cadence passes at ITS band — the old hardcoded 2700-3300 is gone', () => {
  const fast = evalE3({ net: e3Net(F.ROOT_ID, 1000), expectedRootId: F.ROOT_ID, t0: -1, intervalMs: 1000 })
  assert.equal(fast.verdict, 'PASS', 'the band derives from the injected product tickMs, not from the historical measurement')
  const staleBand = evalE3({ net: e3Net(F.ROOT_ID, 1000), expectedRootId: F.ROOT_ID, t0: -1, intervalMs: 3000 })
  assert.equal(staleBand.verdict, 'FAIL', 'and it still REJECTS a cadence that disagrees with the configured interval')
})

test('evalE3: a second (periodic) projection FAILs — cold-read-only semantics preserved', () => {
  const net = e3Net()
  net.push(pj(9000, F.ROOT_ID))
  assert.equal(evalE3({ net, expectedRootId: F.ROOT_ID, t0: -1, intervalMs: 3000 }).verdict, 'FAIL')
})

test('evalE3: FOREIGN-root readStates FAIL even with perfect cadence (expectedRootId is enforced)', () => {
  assert.equal(evalE3({ net: e3Net('session-OTHER-root'), expectedRootId: F.ROOT_ID, t0: -1, intervalMs: 3000 }).verdict, 'FAIL')
})

test('evalE3: without an injected interval there is NO hardcoded fallback — fail closed', () => {
  assert.throws(() => evalE3({ net: e3Net(), expectedRootId: F.ROOT_ID, t0: -1 }), /product config/)
})

test('parseTickMsSource: the frozen mount-config cadence is READ from the product source', () => {
  assert.equal(parseTickMsSource('export const x = 1\n  tickMs: 3000,\n'), 3000)
  assert.equal(parseTickMsSource('nothing here'), null)
})

test('evalE5: exactly 1 ledger{afterSequence:0,limit:50} + reprobe + listRoots, 0 projections', () => {
  const after = [lg(0, F.ROOT_ID), rs(5, F.ROOT_ID), lr(6)]
  const v = evalE5({ after, expectedRootId: F.ROOT_ID })
  assert.equal(v.verdict, 'PASS')
  assert.equal(v.measured.ledgerShapeOk, true)
})

test('evalE5: wrong ledger shape or an extra projection FAILs', () => {
  assert.equal(evalE5({ after: [lg(0, F.ROOT_ID, 7, 50), rs(5, F.ROOT_ID), lr(6)], expectedRootId: F.ROOT_ID }).verdict, 'FAIL')
  assert.equal(evalE5({ after: [lg(0, F.ROOT_ID), pj(7, F.ROOT_ID), rs(5, F.ROOT_ID), lr(6)], expectedRootId: F.ROOT_ID }).verdict, 'FAIL')
})

test('evalE5 (frozen item 6): the post-refresh window is BOUND to the verified root — T1 refresh fetching T2\'s ledger/reprobe is a FAIL, never an unbound pass', () => {
  const foreignLedger = evalE5({ after: [lg(0, 'session-OTHER-root'), rs(5, F.ROOT_ID), lr(6)], expectedRootId: F.ROOT_ID })
  assert.equal(foreignLedger.verdict, 'FAIL')
  assert.equal(foreignLedger.measured.ledgerOnExpectedRoot, false)
  const foreignReprobe = evalE5({ after: [lg(0, F.ROOT_ID), rs(5, 'session-OTHER-root'), lr(6)], expectedRootId: F.ROOT_ID })
  assert.equal(foreignReprobe.verdict, 'FAIL')
  assert.equal(foreignReprobe.measured.reprobesOnExpectedRoot, false)
  const unbound = evalE5({ after: [lg(0, F.ROOT_ID), rs(5, F.ROOT_ID), lr(6)] })
  assert.equal(unbound.verdict, 'FAIL', 'without an expectedRootId nothing can be bound — the round-1 silently-unused parameter is now mandatory for PASS')
})

test('evalE2: ordinary session zero-state — none relation + liveToken null + ZERO projections', () => {
  const net = [rs(0, 'ses-ordinary'), lr(1), rs(3000, 'ses-ordinary')]
  const bodies = [{ t: 2, body: '{"relation":"none","liveToken":null}' }]
  const v = evalE2({ net: { window: net, wholeLeg: net }, bodies, t0: -1 })
  assert.equal(v.verdict, 'PASS')
})

test('evalE2: any team projection anywhere in the leg FAILs (whole-leg scope)', () => {
  const window = [rs(0, 'ses-ordinary'), lr(1), rs(3000, 'ses-ordinary')]
  const bodies = [{ t: 2, body: '{"relation":"none","liveToken":null}' }]
  const v = evalE2({ net: { window, wholeLeg: [...window, pj(5000, F.ROOT_ID)] }, bodies, t0: -1 })
  assert.equal(v.verdict, 'FAIL')
})

test('evalE2: a none-relation WITHOUT the liveToken:null cell FAILs (six-field zero-state intact)', () => {
  const net = [rs(0, 'ses-ordinary'), lr(1), rs(3000, 'ses-ordinary')]
  const v = evalE2({ net: { window: net, wholeLeg: net }, bodies: [{ t: 2, body: '{"relation":"none"}' }], t0: -1 })
  assert.equal(v.verdict, 'FAIL')
})

test('e4NotRun: E4 is an explicit not_run entry — no browser oracle is invented', () => {
  const e = e4NotRun()
  assert.equal(e.verdict, 'NOT_RUN')
  assert.match(e.reason, /unit\/E2E/i)
})

// ── aggregation (external review P7) ────────────────────────────────────────
const legsOf = (E1, E2, E3, E5, E4 = 'NOT_RUN') => ({
  legs: {
    E1: E1 ? { verdict: E1 } : {},
    E2: E2 ? { verdict: E2 } : {},
    E3E5: { E3: E3 ? { verdict: E3 } : undefined, E5: E5 ? { verdict: E5 } : undefined },
    E4: { verdict: E4 },
  },
})

test('summarize: all browser legs PASS => ok, exit 0; E4 stays NOT_RUN and changes nothing', () => {
  const s = summarize(legsOf('PASS', 'PASS', 'PASS', 'PASS'))
  assert.equal(s.ok, true)
  assert.equal(s.exitCode, 0)
  assert.equal(s.verdicts.E4, 'NOT_RUN')
})

test('summarize: any FAIL => exit 1; FAIL outranks NOT_RUN', () => {
  assert.equal(summarize(legsOf('FAIL', 'PASS', 'PASS', 'PASS')).exitCode, 1)
  assert.equal(summarize(legsOf('FAIL', 'PASS', 'PASS', 'NOT_RUN')).exitCode, 1)
  assert.equal(summarize(legsOf('FAIL', 'PASS', 'PASS', 'PASS')).ok, false)
})

test('summarize: NOT_RUN is NEVER a PASS — exit 2, ok=false, reason recorded', () => {
  const s = summarize(legsOf('PASS', 'PASS', 'PASS', 'NOT_RUN'))
  assert.equal(s.ok, false)
  assert.equal(s.exitCode, 2)
  assert.match(s.reasons.join(' '), /E5/)
})

test('summarize: fatal => exit 3; missing nested E3/E5 materialize as NOT_RUN (no parent stamping)', () => {
  assert.equal(summarize({ fatal: 'boom', legs: {} }).exitCode, 3)
  assert.equal(summarize({ legs: { E3E5: { E3: { verdict: 'PASS' } } } }).verdicts.E5, 'NOT_RUN')
  const s = summarize({ legs: { E1: { verdict: 'PASS' }, E2: { verdict: 'PASS' }, E3E5: { E3: { verdict: 'PASS' } }, E4: e4NotRun() } })
  assert.equal(s.exitCode, 2, 'E5 never recorded is NOT_RUN, not PASS')
})

test('parseArgs: --test-workspace / --authorized-root have NO defaults (review P6)', () => {
  const a = parseArgs(['node', 'dod20-ui-driver.mjs', '--confirm-live', '--access', 'x', '--smoke-host', 'y', '--world', 'z', '--out', 'o'])
  assert.equal(a.testWorkspace, undefined, 'an unnamed default workspace is never authorized')
  assert.equal(a.authorizedRoot, undefined)
  const b = parseArgs(['--test-workspace', '/home/user/testhome/ws', '--authorized-root', '/home/user/testhome'])
  assert.equal(b.testWorkspace, '/home/user/testhome/ws')
  assert.equal(b.authorizedRoot, '/home/user/testhome')
})

// ── credential hygiene ─────────────────────────────────────────────────────
test('scrubEvidence masks token=, lt-v1-*, and liveToken JSON fields', () => {
  const s = scrubEvidence('GET /?token=SECRETabc123 | {"liveToken":"lt-v1-SECRETxyz789"} | tail lt-v1-ANOTHERsecret9')
  assert.ok(!s.includes('SECRETabc123'))
  assert.ok(!s.includes('SECRETxyz789'))
  assert.ok(!s.includes('ANOTHERsecret9'))
})

test('scrubEvidence masks a token= query value end-to-end whatever the value form (spaced-word tail stays prose)', () => {
  const s = scrubEvidence('launch GET http://127.0.0.1:3181/?token=FAKEt0kenValue4Test opened the lane')
  assert.ok(!s.includes('FAKEt0kenValue4Test'), 'the token value must be gone whatever its shape')
  assert.ok(s.includes('token=SCRUBBED'), 'the query parameter keeps a masked marker')
  assert.ok(s.includes('opened the lane'), 'masking is scoped to the value — surrounding prose survives')
})

test('redactOut: a serialized fake access record NEVER carries its fake launch token; the 0600 path pointer stays', () => {
  const access = JSON.parse(F.fakeAccessRecord())
  const out = redactOut({
    accessRecordPath: '/worlds/fake/browser-access.json',
    origin: access.origin,
    // A writer that QUOTES the launch URL into a string field must still be
    // scrubbed end-to-end (value form irrelevant): the fake token is a legal
    // 19-char wire shape kept below strict scanner thresholds on purpose.
    note: 'opened via the private record at ' + access.launchUrl,
  })
  const text = JSON.stringify(out)
  assert.ok(!text.includes('FAKEt0kenValue4Test'), 'launch token must never appear in output')
  assert.ok(text.includes('token=SCRUBBED'), 'the quoted URL survives only in masked form')
  assert.ok(!text.includes('launchUrl'), 'the raw launch URL field must never be copied into output')
  assert.equal(out.accessRecordPath, '/worlds/fake/browser-access.json')
})

test('redactOut keeps criteria-bearing fields byte-identical while masking liveToken', () => {
  const out = redactOut({ relation: 'team-member', memberInstanceId: 'inst-x', liveToken: 'lt-v1-REALSECRET99', disposed: false })
  assert.equal(out.relation, 'team-member')
  assert.equal(out.memberInstanceId, 'inst-x')
  assert.equal(out.disposed, false)
  assert.ok(!JSON.stringify(out).includes('REALSECRET99'))
})

// ───── SHARED activation routine — DIRECT production-function tests
// (external review of b52151ab point 1: tests must hit the REAL routine, not
// a fake re-implementation; point 2: one absolute budget bounds click and
// every success check — a deadline breach is NOT_RUN, late success refused).
import { runTeamTabActivation } from './dod20-ui-driver.mjs'

function activationProbe (script) {
  const p = { clock: 0, maxClock: 0, clicks: 0, clickTimeouts: [] }
  p.now = () => p.clock
  p.sleep = async (ms) => { p.clock += ms; if (p.clock > p.maxClock) p.maxClock = p.clock }
  p.countRoleTabs = async (names) => names.map((n, i) => {
    if (i !== 0 || script.never) return 0
    if (script.ambiguousFrom !== undefined && p.clock >= script.ambiguousFrom) return 2
    return p.clock >= (script.countFrom || 0) ? 1 : 0
  })
  p.isTabVisible = async () => true
  p.clickTab = async (n, timeoutMs) => { p.clicks += 1; p.clickTimeouts.push(timeoutMs) }
  p.readAriaSelected = async () => (p.clock >= (script.readyAt || 0) ? 'true' : 'false')
  p.viewVisible = async () => p.clock >= (script.readyAt || 0)
  return p
}

test('SHARED routine: bounded discovery absorbs a late remount; the click is bounded by the REMAINING absolute budget', async () => {
  const p = activationProbe({ countFrom: 300, readyAt: 400 })
  const r = await runTeamTabActivation({ ...p, names: ['Team', '团队'], phase: 't1', budgetMs: 5000 })
  assert.equal(r.ok, true, 'late tab discovered and armed: ' + JSON.stringify(r))
  assert.equal(r.armedMs, 500)
  assert.equal(p.clicks, 1)
  assert.ok(p.clickTimeouts[0] <= 4500, 'click timeout must not exceed the remaining budget at click time: ' + p.clickTimeouts[0])
})
test('SHARED routine: a never-appearing tab fails closed WITHIN the absolute budget (no clock overrun, reason discriminates)', async () => {
  const p = activationProbe({ never: true })
  const r = await runTeamTabActivation({ ...p, names: ['Team', '团队'], phase: 't2', budgetMs: 5000 })
  assert.equal(r.ok, false)
  assert.match(r.reason, /never appeared within 5000ms bounded discovery/)
  assert.ok(p.maxClock <= 5000, 'discovery must not overrun the budget: ' + p.maxClock)
  assert.equal(p.clicks, 0)
})
test('SHARED routine: ambiguous role=tab fail-closes immediately and NEVER clicks', async () => {
  const p = activationProbe({ ambiguousFrom: 0 })
  const r = await runTeamTabActivation({ ...p, names: ['Team', '团队'], phase: 't3', budgetMs: 5000 })
  assert.equal(r.ok, false)
  assert.match(r.reason, /team-tab-ambiguous \(2 role=tab hits\) — never guess/)
  assert.equal(p.clicks, 0)
})
test('SHARED routine: success that lands only AT/PAST the deadline is REFUSED — the absolute budget is a hard bound, not a hint', async () => {
  const p = activationProbe({ readyAt: 1000 })
  const r = await runTeamTabActivation({ ...p, names: ['Team', '团队'], phase: 't4', budgetMs: 1000 })
  assert.equal(r.ok, false, 'a success exactly at/after the deadline must NOT be accepted: ' + JSON.stringify(r))
  assert.match(r.reason, /team-tab-not-armed/)
  assert.ok(p.maxClock <= 1000, 'verify must not overrun the budget: ' + p.maxClock)
  assert.ok(p.clickTimeouts[0] <= 1000, 'click timeout bounded by the remaining budget: ' + p.clickTimeouts[0])
})
