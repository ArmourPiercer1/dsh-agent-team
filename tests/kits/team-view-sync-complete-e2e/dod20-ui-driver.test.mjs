/**
 * dod20-ui-driver.test.mjs — OFFLINE tests for the DDoD20 UI driver's pure
 * navigation/locator/verdict core (node --test; no browser, no host, no
 * network, no jsdom). Run:
 *
 *   node --test tests/kits/team-view-sync-complete-e2e/dod20-ui-driver.test.mjs
 *
 * Every fixture is a static HTML string hand-modeled on the read-only env
 * evidence (see dod20-ui-driver-fixtures.mjs). The tests encode the failure
 * lessons of driver v1–v3:
 *  - v1: the Internal Testing Notice stayed open and the list stayed collapsed
 *    => zero traffic, zero cases.
 *  - v2: expandList had the Ungrouped click (dod20-driver2.mjs:67) but mapped
 *    rows by click-order + pop() fallback => contaminated title→id map,
 *    MAP-FAIL.
 *  - v3: openContext LOST the Ungrouped click (zero 'Ungrouped' hits in
 *    dod20-driver3.mjs); the overflow button only exists after expansion, so
 *    its overflow-only "expand" was a silent no-op => four legs NOT_RUN with
 *    zero /team-remote traffic — a driver defect, and worse, E2 recorded FAIL
 *    on a window the driver never reached. This driver must record NOT_RUN for
 *    any leg its navigation did not verifiably reach.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  htmlLeaves,
  navPlan,
  locateTitle,
  groupCollapsed,
  overflowPending,
  parseParams,
  canonicalTargets,
  detectBlockingModal,
  e2WorkspaceSteps,
  e2AbortSteps,
  assertSessionCwd,
  verifySelection,
  evalE1,
  evalE2,
  evalE3,
  evalE5,
  e4NotRun,
  scrubEvidence,
  redactOut,
} from './dod20-ui-driver.mjs'
import * as F from './dod20-ui-driver-fixtures.mjs'

// ── DOM leaf parsing (pure, over static fixture HTML) ──────────────────────
test('htmlLeaves: collapsed rail renders the Ungrouped header and ZERO session rows', () => {
  const leaves = htmlLeaves(F.RAIL_COLLAPSED)
  const un = leaves.find((l) => l.text === 'Ungrouped')
  assert.ok(un, 'Ungrouped group header must be present (probe3 rail-after-notice)')
  assert.equal(un.cls.includes('W0d-vW_title'), true)
  assert.equal(groupCollapsed(leaves), true, 'no session-row leaf may exist pre-expansion')
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
test('navPlan: strict order notice → ungrouped-expand → overflow, and expand precedes overflow click', () => {
  const plan = navPlan({ hasNotice: true, railLeaves: htmlLeaves(F.RAIL_EXPANDED) })
  assert.deepEqual(plan.map((s) => s.step), ['dismiss-notice', 'expand-ungrouped-group', 'expand-overflow'])
  const collapsedPlan = navPlan({ hasNotice: false, railLeaves: htmlLeaves(F.RAIL_COLLAPSED) })
  assert.deepEqual(collapsedPlan.map((s) => s.step), ['expand-ungrouped-group'],
    'a collapsed rail schedules the group click; overflow is only re-planned AFTER rows render')
})

test('navPlan: no notice => no dismiss step (never clicks a phantom button)', () => {
  const plan = navPlan({ hasNotice: false, railLeaves: htmlLeaves(F.RAIL_EXPANDED_ALL) })
  assert.deepEqual(plan.map((s) => s.step), ['expand-ungrouped-group'],
    'group click is UNCONDITIONAL — probe3 proved it is required; skipping it is the v3 regression')
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

test('locateTitle: duplicate title (hover tooltip) => AMBIGUOUS fail-closed, never first-match', () => {
  const leaves = htmlLeaves(F.RAIL_DUPLICATE_TITLE)
  const hit = locateTitle(leaves, F.MEMBER_TITLE, { exclude: ['Ungrouped'] })
  assert.equal(hit.status, 'AMBIGUOUS')
  assert.equal(hit.matches.length, 2)
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

// ── canonical identity plumbing ────────────────────────────────────────────
test('parseParams: /team-remote client-request envelope yields the params (probe3 wire shape)', () => {
  const post = '{"type":"client-request","rpcId":"1dc93440","method":"team.getReadState","payload":{"version":6,"params":{"sessionId":"session-team-child-52860b"}}}'
  assert.deepEqual(parseParams(post), { sessionId: 'session-team-child-52860b' })
  assert.equal(parseParams('not json'), null)
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

// ── E2 workspace picker (shot-E2-ordinary-v3.png root cause) ───────────────
test('detectBlockingModal: the Select Workspace Directory dialog is detected as a blocker', () => {
  const d = detectBlockingModal(F.MODAL_WORKSPACE_PICKER)
  assert.equal(d.blocking, true)
  assert.equal(d.title, 'Select Workspace Directory')
  assert.equal(d.rootLabel, 'Home')
})

// ── E2 authorized-workspace discipline (coordinator ruling 2026-10-01) ─────
// The folder picked MUST be the EXPLICIT AUTHORIZED test workspace passed as
// a driver input (exact name under the exact authorized parent) — never the
// modal's first item, never a neighbor, never a personal directory.
const AUTH_WS = '/home/user/workspace'

test('e2WorkspaceSteps: authorized dir present under the authorized root => OK, exact-name click + post-action cwd verify', () => {
  const s = e2WorkspaceSteps({ dialog: detectBlockingModal(F.MODAL_WORKSPACE_PICKER), testWorkspace: AUTH_WS })
  assert.equal(s.ok, true)
  assert.deepEqual(s.steps, ['click-folder:workspace', 'click-open', 'assert-dialog-closed', 'verify-session-cwd:' + AUTH_WS])
})

test('e2WorkspaceSteps: authorized dir absent from the listing => NOT_RUN (no neighbor pick)', () => {
  const s = e2WorkspaceSteps({ dialog: detectBlockingModal(F.MODAL_WORKSPACE_PICKER_NO_FOLDER), testWorkspace: AUTH_WS })
  assert.equal(s.ok, false)
  assert.match(s.reason, /workspace folder|folder/i)
})

test('e2WorkspaceSteps: near-miss names (same prefix / suffix / spaced copy) are REJECTED', () => {
  const s = e2WorkspaceSteps({ dialog: detectBlockingModal(F.MODAL_WORKSPACE_PICKER_NEAR_MISS), testWorkspace: AUTH_WS })
  assert.equal(s.ok, false)
  assert.match(s.reason, /never pick/i)
})

test('e2WorkspaceSteps: dialog browsed to a foreign root => NOT_RUN (exact-parent discipline, even when the folder name is offered)', () => {
  const s = e2WorkspaceSteps({ dialog: detectBlockingModal(F.MODAL_WORKSPACE_PICKER_FOREIGN_ROOT), testWorkspace: AUTH_WS })
  assert.equal(s.ok, false)
  assert.match(s.reason, /root/i)
})

test('e2WorkspaceSteps: a testWorkspace outside the dialog root parent is rejected before Open', () => {
  const s = e2WorkspaceSteps({ dialog: detectBlockingModal(F.MODAL_WORKSPACE_PICKER), testWorkspace: '/somewhere/else/workspace' })
  assert.equal(s.ok, false)
  assert.match(s.reason, /parent|root/i)
})

test('e2WorkspaceSteps: a relative testWorkspace path is rejected (absolute paths only)', () => {
  const s = e2WorkspaceSteps({ dialog: detectBlockingModal(F.MODAL_WORKSPACE_PICKER), testWorkspace: 'workspace' })
  assert.equal(s.ok, false)
  assert.match(s.reason, /absolute/i)
})

test('e2AbortSteps: fail-closed BEFORE Open leaves the modal UNCONFIRMED via the asserted Cancel path', () => {
  const s = e2WorkspaceSteps({ dialog: detectBlockingModal(F.MODAL_WORKSPACE_PICKER_NO_FOLDER), testWorkspace: AUTH_WS })
  const a = e2AbortSteps({ dialog: detectBlockingModal(F.MODAL_WORKSPACE_PICKER_NO_FOLDER), failedBeforeOpen: !s.ok })
  assert.deepEqual(a.steps, ['click-cancel', 'assert-dialog-closed'])
  assert.equal(e2AbortSteps({ dialog: { blocking: false }, failedBeforeOpen: true }).steps.length, 0, 'nothing to cancel when no dialog is open')
  assert.equal(e2AbortSteps({ dialog: detectBlockingModal(F.MODAL_WORKSPACE_PICKER), failedBeforeOpen: false }).steps.length, 0, 'after Open there is no modal to cancel')
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

// ── selection verification: BOTH header and network, or nothing ────────────
const expectedMember = { sessionId: F.MEMBER_ID, relation: 'team-member', title: F.MEMBER_TITLE }
const freshReq = [{ kind: 'req', t: 2000, m: 'team.getReadState', p: { sessionId: F.MEMBER_ID } }]
const freshBodies = [{ t: 2001, body: '{"relation":"team-member","memberInstanceId":"inst-0iin89s0dvix","liveToken":null}' }]

test('verifySelection: header id + fresh readState(id) + relation corroboration => verified', () => {
  const v = verifySelection({
    headerLeaves: htmlLeaves(F.sessionHeaderHtml(F.MEMBER_ID)),
    freshRequests: freshReq,
    freshBodies,
    expected: expectedMember,
  })
  assert.equal(v.verified, true)
  assert.equal(v.headerOk, true)
  assert.equal(v.networkOk, true)
})

test('verifySelection: header alone is NOT a verified selection', () => {
  const v = verifySelection({ headerLeaves: htmlLeaves(F.sessionHeaderHtml(F.MEMBER_ID)), freshRequests: [], freshBodies: [], expected: expectedMember })
  assert.equal(v.verified, false)
  assert.equal(v.headerOk, true)
  assert.equal(v.networkOk, false)
})

test('verifySelection: network alone is NOT a verified selection', () => {
  const v = verifySelection({ headerLeaves: htmlLeaves('<header><h1>ack something</h1></header>'), freshRequests: freshReq, freshBodies, expected: expectedMember })
  assert.equal(v.verified, false)
  assert.equal(v.headerOk, false)
  assert.equal(v.networkOk, true)
})

test('verifySelection: a fresh readState for a DIFFERENT session id is not the target', () => {
  const v = verifySelection({
    headerLeaves: htmlLeaves(F.sessionHeaderHtml(F.MEMBER_ID)),
    freshRequests: [{ kind: 'req', t: 2000, m: 'team.getReadState', p: { sessionId: 'session-team-child-259520eccdc5502ef43ef3f0762921e6' } }],
    freshBodies,
    expected: expectedMember,
  })
  assert.equal(v.verified, false)
})

test('verifySelection: stale events (t < click time) never verify the selection', () => {
  const v = verifySelection({
    headerLeaves: htmlLeaves(F.sessionHeaderHtml(F.MEMBER_ID)),
    freshRequests: [{ kind: 'req', t: 900, m: 'team.getReadState', p: { sessionId: F.MEMBER_ID } }],
    freshBodies,
    expected: expectedMember,
    clickT: 1000,
  })
  assert.equal(v.networkOk, false)
  assert.equal(v.verified, false)
})

// ── leg oracles, ported verbatim from v2/v3 (NEITHER weakened nor tightened) ─
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

test('evalE3: >=7 readStates, ~3s band, exactly-1 cold projection, 1 ledger', () => {
  const net = [pj(0, F.ROOT_ID), lg(1, F.ROOT_ID)]
  for (let i = 0; i < 7; i += 1) net.push(rs(10 + i * 3000, F.ROOT_ID))
  const v = evalE3({ net, expectedRootId: F.ROOT_ID, t0: -1 })
  assert.equal(v.verdict, 'PASS')
  assert.equal(v.measured.projections, 1)
})

test('evalE3: a second (periodic) projection FAILs — cold-read-only semantics preserved', () => {
  const net = [pj(0, F.ROOT_ID), lg(1, F.ROOT_ID)]
  for (let i = 0; i < 7; i += 1) net.push(rs(10 + i * 3000, F.ROOT_ID))
  net.push(pj(9000, F.ROOT_ID))
  assert.equal(evalE3({ net, expectedRootId: F.ROOT_ID, t0: -1 }).verdict, 'FAIL')
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

// ── credential hygiene ─────────────────────────────────────────────────────
test('scrubEvidence masks token=, lt-v1-*, and liveToken JSON fields', () => {
  const s = scrubEvidence('GET /?token=SECRETabc123 | {"liveToken":"lt-v1-SECRETxyz789"} | tail lt-v1-ANOTHERsecret9')
  assert.ok(!s.includes('SECRETabc123'))
  assert.ok(!s.includes('SECRETxyz789'))
  assert.ok(!s.includes('ANOTHERsecret9'))
})

test('redactOut: a serialized fake access record NEVER carries its fake launch token; the 0600 path pointer stays', () => {
  const access = JSON.parse(F.fakeAccessRecord())
  const out = redactOut({
    accessRecordPath: '/worlds/fake/browser-access.json',
    origin: access.origin,
    note: 'opened via the private record',
  })
  const text = JSON.stringify(out)
  assert.ok(!text.includes('FAKEt0kenValueForTestsOnly'), 'launch token must never appear in output')
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
