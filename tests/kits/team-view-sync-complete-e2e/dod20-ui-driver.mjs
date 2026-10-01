#!/usr/bin/env node
/**
 * dod20-ui-driver.mjs — deterministic DDoD20 UI driver for the team-view
 * E1/E2/E3/E5 browser legs (test-driver repair, PR #55 side-branch).
 * NON-PRODUCT test tooling. The LIVE lane is gated on external review: this
 * file refuses to run without `--confirm-live`, and until then nothing here is
 * executed — the accepted evidence for this change is the OFFLINE suites:
 *
 *   node --test tests/kits/team-view-sync-complete-e2e/dod20-ui-driver.test.mjs                  # pure core
 *   node --test tests/kits/team-view-sync-complete-e2e/dod20-ui-driver-orchestration.test.mjs     # leg orchestration via injected fakes
 *
 * WHY THIS DRIVER EXISTS (failure chain, evidence
 * dev/agent-workflow/evidence/dod20-browser-20261001/2026-10-01T15-13-44/):
 *  - v1: the Internal Testing Notice stayed open and the rail stayed
 *    collapsed => net=0, zero cases (driver-out.json).
 *  - probe3 (probe-ui3.mjs): the notice closes via a REAL mouse click on
 *    getByRole('button', Continue); the sidebar 'Ungrouped' group renders
 *    ZERO session rows until its header is clicked (probe-ui3.mjs:50,
 *    probe-ui3-out.json rail-after-notice / rail-after-ungrouped); the first
 *    click renders five rows + a 'Show N more sessions' overflow button —
 *    THE OVERFLOW BUTTON ONLY EXISTS AFTER THE GROUP EXPANSION; a row click
 *    fires team.getReadState / getProjection / getLedgerPage (cold round).
 *  - v2 (dod20-driver2.mjs:67) had the group click but mapped rows by
 *    click-order + pop() fallback => contaminated map, MAP-FAIL.
 *  - v3 (dod20-driver3.mjs) LOST the group click (zero 'Ungrouped' hits);
 *    its overflow-only ensureListExpanded() was a silent no-op => E1/E3/E5
 *    locate.found=false, E2 judged FAIL on a window the driver never reached.
 *    All four legs are NOT_RUN — a DRIVER defect, not a product verdict.
 *
 * FIXED NAVIGATION ORDER (no fallbacks, fail-closed):
 *   1. dismiss the Internal Testing Notice IF present (real button click,
 *      assert-gone; present-but-undismissable = fail-closed);
 *   2. expand the sidebar Ungrouped group (the probe3:50 click, exactly once,
 *      skipped only when rows are ALREADY rendered — the click is a toggle);
 *   3. click the 'Show N more sessions' overflow button while visible
 *      (it can only be visible post-expansion);
 *   4. locate the target by EXACT canonical title textContent (canonical
 *      (id,title) pairs derived read-only from the world's projcache records
 *      + the smoke-host identity). 0 hits => NOT_RUN fail-closed; >1 hits =>
 *      AMBIGUOUS fail-closed. NEVER a pop-up pick, a last-match, a positional
 *      neighbor, or any target-changing retry;
 *   5. BEFORE any leg action, verify selection: the main-pane header must
 *      show the canonical SESSION ID EXACTLY (probe3-after-rowclick.png) AND
 *      a SUCCESS team.getReadState response CORRELATED to the fresh request
 *      for exactly that sessionId — the wire envelope is
 *      { rpcId, result: { ok, value: { data } } } (packages/remote/src/
 *      contracts/response.ts + push/types.ts: "the correlation id of the
 *      answered request"), so the response is accepted only when its rpcId
 *      matches THAT request, status is 2xx, result.ok is true, and the parsed
 *      data carries the expected relation (member: + memberInstanceId). A
 *      late/foreign/failed/uncorrelated response NEVER authenticates. At most
 *      ONE re-click of the SAME located row; still unverified => NOT_RUN.
 *
 * WINDOW BOUNDARIES (external review P1/P3): every boundary is a sequence or
 * timestamp captured at the exact real event —
 *  - E1 preClick counts requests with seq <= the seq captured BEFORE the
 *    verified target click (the frozen v3 oracle 'preClick must be 0: fresh
 *    context, no auto session'); the click's own cold round is NOT preClick,
 *    and the reload window starts at the captured lt0.
 *  - the E3 stable window STARTS at the cold-open click (clickT) — the very
 *    cold projection/ledger the oracle requires are the ones the navigation
 *    produced; E5's window starts at its refresh click.
 *  - E3 cadence comes from the PRODUCT config (tickMs in
 *    packages/client/src/plugin/team-mount-core.ts — frozen default 3000,
 *    team-refresh-coordinator.ts:153/331), read at runtime; the historical
 *    2995–3008ms deltas are recorded, never hardcoded as the spec.
 *
 * E2 WORKSPACE AUTHORIZATION (external review P6): --test-workspace and
 * --authorized-root are REQUIRED, explicit, absolute inputs; BEFORE any
 * browser leg opens, both are realpath()-ed and the workspace must be
 * CONTAINED (realpath) under the authorized root, which must itself not be
 * the private home (name/parent matching is not authorization). The dialog is
 * driven from REAL DOM state (snapshot + per-level crumb verification,
 * shot-E2-ordinary-v3.png), so NESTED fixtures under the approved root are
 * reached level-by-level — a direct-child-of-home rule is gone, and nothing
 * ever falls back to a wider directory. Post-Open, the created session's
 * identity.cwd is re-verified from the world's projcache record.
 *
 * VERDICT DISCIPLINE (external review P7): a driver-side failure is NOT_RUN
 * (never a product FAIL); the parent E3E5 record never stamps the nested E3/E5
 * verdicts; summarize() fails the run on fatal (exit 3) or any FAIL (exit 1)
 * and NEVER treats NOT_RUN as a pass (exit 2); E4 stays an explicit not_run
 * entry (unit/E2E tier; no browser oracle invented).
 *
 * AUTH HYGIENE: the raw launch URL is read ONLY from the world's private 0600
 * browser-access.json at runtime (never printed, never copied into output —
 * redactOut() strips launchUrl keys and scrubEvidence() masks token=, lt-v1
 * values and liveToken fields — lt-v1 is a freshness hash rather than a
 * credential, but it is masked anyway as defense-in-depth). Credential
 * redaction reuses the merged kit module live-token-redact.mjs. The two kit
 * raw instance.log files flagged in the evidence index each carry one
 * dead-host launch URL and are NEVER staged.
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
import { redactLiveTokenFields, redactLiveTokenText } from './live-token-redact.mjs'

// ══════════════════════════ PURE CORE (tested offline) ══════════════════════

/** Minimal leaf-element tokenizer over a STATIC HTML STRING (FIXTURES ONLY —
 *  the live lane never feeds page text through this; the dialog uses real DOM
 *  state, the rail uses the in-page collector). A leaf = element with
 *  non-empty DIRECT text and no child elements. Returns [{tag, cls, role,
 *  text}] in document order. */
export function htmlLeaves (html) {
  const VOID = new Set(['br', 'hr', 'img', 'input', 'meta', 'link'])
  const src = String(html)
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, '')
  const leaves = []
  const stack = []
  const push = (text) => {
    if (stack.length === 0) return
    const top = stack[stack.length - 1]
    top.text += text
  }
  const tagRe = /<(\/)?([a-zA-Z][\w:-]*)((?:"[^"]*"|'[^']*'|[^>])*?)(\/)?>/g
  const attrRe = /([a-zA-Z_:][-\w:.]*)\s*=\s*("([^"]*)"|'([^']*)')/g
  let last = 0
  let m
  while ((m = tagRe.exec(src)) !== null) {
    push(decodeEntities(src.slice(last, m.index)))
    last = tagRe.lastIndex
    const [, closing, rawTag, rawAttrs, , selfClose] = m
    const tag = rawTag.toLowerCase()
    if (closing) {
      for (let i = stack.length - 1; i >= 0; i -= 1) {
        if (stack[i].tag === tag) {
          const el = stack.splice(i)[0]
          const text = el.text.replace(/\s+/g, ' ').trim()
          if (text !== '' && !el.hasChild) {
            leaves.push({ tag, cls: el.cls, role: el.role, text })
          }
          if (stack.length > 0) stack[stack.length - 1].hasChild = true
          break
        }
      }
    } else if (!VOID.has(tag) && !selfClose) {
      const attrs = {}
      let a
      while ((a = attrRe.exec(rawAttrs || '')) !== null) attrs[a[1].toLowerCase()] = a[3] ?? a[4] ?? ''
      stack.push({ tag, cls: attrs.class || '', role: attrs.role || '', text: '', hasChild: false })
    }
  }
  push(src.slice(last))
  return leaves
}

function decodeEntities (s) {
  return s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
}

const GROUP_TITLE = 'Ungrouped'
const ROW_CLUE = 'W0d-vW_title'
const OVERFLOW_RE = /^Show \d+ more sessions$/

/** Rail chrome labels (probe3 rail dumps) that are never session rows. */
export const CHROME_TEXTS = Object.freeze(['New Session', 'Plugins', 'Workspaces', GROUP_TITLE, 'New Team', 'Settings', 'DSH Local Build'])

/** The group-header leaf (exact 'Ungrouped' text on a row-class span). */
export function groupHeaderLeaf (leaves) {
  return leaves.find((l) => l.text === GROUP_TITLE && String(l.cls || '').includes(ROW_CLUE)) || null
}

/** True when the group header is visible but NO session row has rendered —
 *  the probe3 'rail-after-notice' state that made v3's locate impossible. */
export function groupCollapsed (leaves) {
  if (!groupHeaderLeaf(leaves)) return false
  return !leaves.some((l) => String(l.cls || '').includes(ROW_CLUE) && l.text !== GROUP_TITLE)
}

/** The overflow button is visible (only ever AFTER group expansion). */
export function overflowPending (leaves) {
  return leaves.some((l) => l.tag === 'button' && OVERFLOW_RE.test(l.text))
}

/** The fixed navigation script for one fresh context, as data. The ORDER is
 *  frozen; each step carries a runtime predicate, never an alternate target. */
export function navPlan ({ hasNotice, railLeaves }) {
  const steps = []
  if (hasNotice) steps.push({ step: 'dismiss-notice', how: 'real click on getByRole(button, Continue), assert gone' })
  steps.push({ step: 'expand-ungrouped-group', how: 'one real click on the Ungrouped group header, skipped ONLY when rows already rendered (click is a toggle); no rows after => fail-closed' })
  if (overflowPending(railLeaves)) steps.push({ step: 'expand-overflow', how: 'one real click on the Show N more sessions button (exists only post-expansion)' })
  return steps
}

/** EXACT-title locate among leaf records. status: FOUND | AMBIGUOUS |
 *  NOT_FOUND. Callers MUST treat anything but FOUND as fail-closed. */
export function locateTitle (leaves, title, { exclude = [] } = {}) {
  const want = String(title).trim()
  const matches = leaves.filter((l) => l.text === want && !exclude.includes(l.text))
  if (matches.length === 0) return { status: 'NOT_FOUND', leaf: null, matches: [] }
  if (matches.length > 1) return { status: 'AMBIGUOUS', leaf: null, matches }
  const rows = leaves.filter((l) => String(l.cls || '').includes(ROW_CLUE) && l.text !== GROUP_TITLE && !exclude.includes(l.text))
  return { status: 'FOUND', leaf: matches[0], matches, index: rows.indexOf(matches[0]) }
}

/** /team-remote client-request envelope -> params (probe3 wire shape). */
export function parseParams (post) {
  try {
    const j = JSON.parse(post)
    return j && j.payload ? j.payload.params ?? null : (j && j.params) || null
  } catch { return null }
}

/** The frozen request envelope: { type:'client-request', rpcId, method,
 *  payload:{ version, params } } (packages/remote/src/contracts/request.ts). */
export function parseRequestEnvelope (post) {
  try {
    const j = JSON.parse(String(post))
    if (!j || typeof j !== 'object') return null
    const params = j.payload && typeof j.payload === 'object' ? j.payload.params ?? null : j.params ?? null
    return { rpcId: j.rpcId ?? null, method: j.method ?? null, params }
  } catch { return null }
}

/** The frozen server-response envelope (contracts/response.ts + push/types.ts
 *  SeamServerResponse): { rpcId, result: { ok:true, value:{ data, provenance } }
 *  | { ok:false, error } }. Anything that does not parse as this envelope is
 *  UNCORRELATED (null) and can never authenticate a selection. */
export function parseServerResponseEnvelope (text) {
  try {
    const j = JSON.parse(String(text))
    if (!j || typeof j !== 'object') return null
    if (!Object.prototype.hasOwnProperty.call(j, 'rpcId')) return null
    if (!j.result || typeof j.result !== 'object' || typeof j.result.ok !== 'boolean') return null
    const data = j.result.ok === true && j.result.value && typeof j.result.value === 'object' ? j.result.value.data ?? null : null
    return { rpcId: j.rpcId, ok: j.result.ok === true, data, error: j.result.ok === false && j.result.error && typeof j.result.error === 'object' ? j.result.error.code ?? 'error' : null }
  } catch { return null }
}

/** Canonical (id, title) targets from the world's projcache title map
 *  (record.rows.title.val per session id). Fail-closed on a missing/null
 *  title or any duplicate anywhere in the map — an ambiguous world title
 *  cannot be disambiguated in the rail. */
export function canonicalTargets ({ projcache, rootId, memberIds }) {
  const titleOf = (id) => projcache[id]
  const pick = (id) => {
    const t = titleOf(id)
    if (typeof t !== 'string' || t.trim() === '') return { ok: false, reason: `canonical title missing/null for ${id} (a null title is never a matchable row)` }
    return { ok: true, title: t }
  }
  const root = pick(rootId)
  if (!root.ok) return { ok: false, reason: root.reason }
  const members = []
  for (const id of memberIds) {
    const m = pick(id)
    if (!m.ok) return { ok: false, reason: m.reason }
    members.push({ id, title: m.title })
  }
  const wanted = [rootId, ...memberIds].map((id) => ({ id, title: titleOf(id) }))
  for (const w of wanted) {
    const collisions = Object.entries(projcache).filter(([, t]) => t === w.title)
    if (collisions.length > 1) {
      return { ok: false, reason: `ambiguous duplicate title ${JSON.stringify(w.title)} shared by ${collisions.map(([id]) => id).join(', ')} — fail-closed before launch` }
    }
  }
  return { ok: true, targets: { root: { id: rootId, title: root.title }, member: members[0] || null, members } }
}

// ── dialog state: the REAL DirectoryBrowser structure (external review P2,
// round 2) ───────────────────────────────────────────────────────────────────
// The probe below mirrors the pinned upstream component STRUCTURE, read at
// tests/deepseek-harness-test-use @ 46a7f68b09,
// packages/client/ui-directory-picker-browse/src/client/DirectoryBrowser.tsx:
//  - the crumb trail is a [role=navigation] region of INDEPENDENT crumb
//    BUTTONS (one per ancestor, chevron icons between; :818) — flattening the
//    trail's textContent welds the ancestors into one string, so the probe
//    reads the BUTTON LABELS as an ordered array;
//  - a selected row keeps its selection on the ROW'S OWN BUTTON through
//    aria-current (:238) — NOT on the [role=listitem] wrapper;
//  - clicking a row selects immediately, but the selected folder's own
//    listing (and therefore the crumb trail, which is derived from
//    child ?? parent; :506, :688) arrives ASYNC — the consumer must bounded-
//    WAIT for the exact crumb path, never snapshot-on-click;
//  - i18n (src/client/index.ts:39-62): title EN 'Select Workspace Directory'
//    / ZH '选择工作区目录'; home crumb 'Home' / '主目录'; Open 'Open'/'打开';
//    Cancel 'Cancel'/'取消'. The allowlists below are EXACT values of this
//    frozen table — no substring matching.
export const DIALOG_TITLES = Object.freeze(['Select Workspace Directory', '选择工作区目录'])
export const DIALOG_HOME_LABELS = Object.freeze(['Home', '主目录'])
export const DIALOG_OPEN_LABELS = Object.freeze(['Open', '打开'])
export const DIALOG_CANCEL_LABELS = Object.freeze(['Cancel', '取消'])

/** THE dialog-state probe — the ONE dialog-state implementation: the live
 *  adapter evaluates it verbatim inside the page over REAL DOM (embedded in
 *  DIALOG_STATE_SOURCE below), and the offline faithful-markup fixtures are
 *  read through the SAME serialized source under a real DOM implementation
 *  (jsdom from the repo's own test-use runtime — no hand-rolled DOM shim).
 *  It uses only standard DOM APIs (querySelector/querySelectorAll on tag and
 *  [role=...] selectors, getAttribute, textContent) — if a DOM engine cannot
 *  run these selectors the test FAILS; nothing is stubbed.
 *  Rows carry their Miller COLUMN level (each [role=list] is one level), so
 *  the consumer always acts on the CURRENT (deepest) listing.
 *  @returns { open, title, crumbLabels: string[], rows: [{level, name, selected}], buttons: string[] } */
export function dialogStateFrom (dlg) {
  const TITLES = ['Select Workspace Directory', '选择工作区目录']
  const all = (root, sel) => Array.prototype.slice.call((root && root.querySelectorAll(sel)) || [])
  const txt = (el) => ((el && el.textContent) || '').replace(/\s+/g, ' ').trim()
  const heads = all(dlg, 'h1, h2, h3, [role="heading"]').map(txt)
  const title = heads.find((t) => TITLES.includes(t)) || (heads.length ? heads[0] : null)
  const open = title !== null && TITLES.includes(title)
  const nav = (dlg.querySelector && dlg.querySelector('[role="navigation"]')) || null
  const crumbLabels = nav ? all(nav, 'button').map(txt).filter(Boolean) : []
  const rows = []
  all(dlg, '[role="list"]').forEach((col, level) => {
    all(col, '[role="listitem"]').forEach((li) => {
      const btn = li.querySelector && li.querySelector('button')
      rows.push({ level, name: txt(btn || li), selected: !!btn && btn.getAttribute('aria-current') === 'true' })
    })
  })
  const buttons = all(dlg, 'button').map(txt).filter(Boolean)
  return { open, title, crumbLabels, rows, buttons }
}

/** The dialog root label the live world uses for the host home directory
 *  (shot-E2-ordinary-v3.png breadcrumb; EN value of t('browser.home')).
 *  Authorization compares against DIALOG_HOME_LABELS (exact, i18n-aware). */
export const DIALOG_HOME_LABEL = 'Home'

/** FILESYSTEM authorization (external review P6): authorization is REALPATH
 *  CONTAINMENT under an explicit authorized root — an exact name or parent
 *  LABEL match is not authorization. The root itself may not be the private
 *  home (too broad), the workspace may not be the home, and the workspace
 *  must live under the dialog's Home root (the UI browses from Home; there is
 *  no wider browse). Returns the level-by-level plan inputs derived from the
 *  REAL path: ancestors + folder. All inputs must already be realpath()-ed. */
export function authorizeWorkspace ({ testWorkspaceReal, authorizedRootReal, homeReal }) {
  for (const [name, p] of [['--test-workspace (realpath)', testWorkspaceReal], ['--authorized-root (realpath)', authorizedRootReal], ['home (realpath)', homeReal]]) {
    if (typeof p !== 'string' || !p.startsWith('/')) return { ok: false, reason: `${name} must be an absolute realpath string (got ${JSON.stringify(p)})` }
  }
  if (authorizedRootReal === homeReal) return { ok: false, reason: `--authorized-root resolves to the private home itself (${homeReal}) — too broad; approve a dedicated fixture root, never the home` }
  const rel = path.relative(authorizedRootReal, testWorkspaceReal)
  if (!rel || rel === '..' || rel.startsWith('..' + path.sep) || path.isAbsolute(rel)) {
    return { ok: false, reason: `realpath containment FAILED: ${testWorkspaceReal} is not inside the authorized root ${authorizedRootReal} — authorization is the resolved filesystem position, not a name/parent match` }
  }
  const relHome = path.relative(homeReal, testWorkspaceReal)
  if (!relHome || relHome === '..' || relHome.startsWith('..' + path.sep) || path.isAbsolute(relHome)) {
    return { ok: false, reason: `the workspace dialog browses from the home root (${homeReal}); ${testWorkspaceReal} is not under it — no wider browse is ever attempted` }
  }
  const segments = relHome.split(path.sep).filter(Boolean)
  const folder = segments[segments.length - 1]
  if (!folder) return { ok: false, reason: `realpath ${testWorkspaceReal} carries no folder name` }
  return { ok: true, ancestors: segments.slice(0, -1), folder, testWorkspaceReal, authorizedRootReal, homeReal }
}

/** The fixed E2 dialog plan (pure): steps generated from the REAL-path
 *  authorization + the CURRENT dialog state. The dialog state is the output of
 *  the REAL probe (dialogStateFrom over the served DOM — crumb BUTTON labels,
 *  rows with aria-current selection). Only the current level can be
 *  listing-checked here — the live loop re-verifies EVERY deeper level from
 *  real DOM state before clicking and BOUNDED-WAITS for the exact crumb path
 *  (the listing is async: click selects now, the child listing/crumbs land
 *  later), and anything unexpected is a fail-closed Cancel, never an Open on
 *  a broader directory. */
export function e2WorkspaceSteps ({ dialog, authz, absPath }) {
  if (!dialog || !dialog.open) return { ok: false, reason: 'workspace dialog not open (Select Workspace Directory never appeared)' }
  if (!DIALOG_TITLES.includes(dialog.title)) return { ok: false, reason: `workspace dialog title ${JSON.stringify(dialog.title)} is not the proven '${DIALOG_TITLES[0]}' (shot-E2-ordinary-v3.png; ZH title also accepted)` }
  const rootLabel = (dialog.crumbLabels || [])[0] ?? null
  if (!DIALOG_HOME_LABELS.includes(rootLabel)) return { ok: false, reason: `dialog root crumb ${JSON.stringify(rootLabel)} is not the authorized home crumb (${DIALOG_HOME_LABELS.join('/')}) — foreign root, never browse into it` }
  if (!authz || !Array.isArray(authz.ancestors) || !authz.folder) return { ok: false, reason: 'no filesystem authorization was resolved (run authorizeWorkspace first)' }
  if (typeof absPath !== 'string' || !absPath.startsWith('/')) return { ok: false, reason: `authorized workspace must be an absolute realpath (got ${JSON.stringify(absPath)})` }
  const want = authz.ancestors[0] ?? authz.folder
  const hits = (dialog.rows || []).filter((r) => r.name === want).length
  if (hits === 0) return { ok: false, reason: `authorized workspace folder '${want}' not offered by the dialog (never pick a neighbor or near-miss folder)` }
  if (hits > 1) return { ok: false, reason: `'${want}' rendered ${hits} times — ambiguous listing, fail closed before Open` }
  if (!(dialog.buttons || []).some((b) => DIALOG_OPEN_LABELS.includes(b))) return { ok: false, reason: 'dialog offers no exact Open button' }
  if (!(dialog.buttons || []).some((b) => DIALOG_CANCEL_LABELS.includes(b))) return { ok: false, reason: 'dialog offers no exact Cancel button (fail-closed abort unavailable)' }
  const steps = [...authz.ancestors.map((a) => 'cd:' + a), 'select:' + authz.folder, 'open', 'assert-dialog-closed', 'verify-session-cwd:' + absPath]
  return { ok: true, folder: authz.folder, rootLabel, steps }
}

/** Fail-closed BEFORE Open => leave the modal UNCONFIRMED via the asserted
 *  Cancel path (coordinator ruling: Cancel is acceptable, and closed). */
export function e2AbortSteps ({ dialog, failedBeforeOpen }) {
  if (!failedBeforeOpen || !dialog || !dialog.open) return { steps: [] }
  if (!(dialog.buttons || []).some((b) => DIALOG_CANCEL_LABELS.includes(b))) return { steps: ['assert-dialog-still-open-recorded'], note: 'no Cancel button offered — record and let the leg die fail-closed' }
  return { steps: ['click-cancel', 'assert-dialog-closed'] }
}

/** Post-action workspace state: the created session's projcache record
 *  (record.identity.cwd — signal verified read-only against the retained
 *  world, see fixtures) must equal the authorized realpath EXACTLY. A missing
 *  record is not a pass. */
export function assertSessionCwd ({ record, expectedPath }) {
  if (!record || !record.record || !record.record.identity) return { ok: false, reason: 'created session projcache record not found (cwd unverifiable — fail-closed)' }
  const cwd = record.record.identity.cwd
  if (cwd !== expectedPath) return { ok: false, reason: `created session cwd ${JSON.stringify(cwd)} does not equal the authorized workspace ${JSON.stringify(expectedPath)}` }
  return { ok: true, cwd }
}

/** SELECTION VERIFICATION (external review P4): BOTH
 *  - the selected header leaf whose text is EXACTLY the canonical session id
 *    (substring matches accept decoration/foreign ids — forbidden), and
 *  - a SUCCESS response CORRELATED to one fresh readState request for exactly
 *    that sessionId: r.reqSeq === req.seq (transport-level binding),
 *    r.rpcId === req.rpcId (wire correlation), 2xx, envelope result.ok, and
 *    the parsed data carrying the expected relation (member: memberInstanceId
 *    must equal the expected instance; root: relation team-root).
 *  A late/foreign/failed/mis-correlated response can never verify anything. */
export function verifySelection ({ headerLeaves, freshRequests, freshResponses, expected, clickT = 0 }) {
  const headerOk = (headerLeaves || []).some((l) => String(l.text).trim() === expected.sessionId)
  const req = (freshRequests || []).find((e) => e.kind === 'req' && e.m === 'team.getReadState' && e.t >= clickT && e.p && e.p.sessionId === expected.sessionId)
  let networkOk = false
  let why = req ? null : 'no-fresh-readstate-request'
  let resSeq = null
  if (req) {
    const res = (freshResponses || []).find((r) => r.kind === 'res' && r.m === 'team.getReadState' && r.reqSeq === req.seq && r.t >= req.t)
    if (!res) why = 'no-bound-response'
    else if (res.rpcId == null || req.rpcId == null || String(res.rpcId) !== String(req.rpcId)) why = 'rpcid-mismatch-or-uncorrelated'
    else if (!(res.status >= 200 && res.status < 300)) why = 'status-' + res.status
    else if (res.ok !== true) why = 'envelope-not-success'
    else if (!res.data) why = 'no-parsed-data'
    else if (res.data.relation !== expected.relation) why = 'relation-mismatch'
    else if (expected.relation === 'team-member' && expected.instance && res.data.memberInstanceId !== expected.instance) why = 'member-instance-mismatch'
    else { networkOk = true; resSeq = res.seq }
  }
  return { verified: headerOk && networkOk, headerOk, networkOk, relationSeen: networkOk, why, reqSeq: req ? req.seq : null, resSeq }
}

/** The created-session id (E2) comes from a SUCCESS relation-none readState
 *  response CORRELATED to its own request — never from popping/last/exclusion
 *  guessing over an id array (external review P4). Round-2 strictness (frozen
 *  item 5): BOTH sides must be FRESH (request.t AND response.t >= afterT, so
 *  a PRE-Open request of an old ordinary session can never have its
 *  late-arriving response impersonate the created session), the wire rpcId
 *  must be NON-NULL and EQUAL on both sides (a response without rpcId never
 *  authenticates — symmetric with verifySelection), and every session id seen
 *  in requests BEFORE the Open boundary (excludeSeenBefore) is refused — the
 *  created session is brand-new, an already-polled id is by definition not
 *  it. Ambiguous => fail-closed. */
export function findCreatedSession ({ responses = [], requests = [], excludeIds = [], excludeSeenBefore = [], afterT = 0 }) {
  const reqById = new Map(requests.map((r) => [r.seq, r]))
  const ids = new Set()
  for (const r of responses) {
    if (r.kind !== 'res' || r.m !== 'team.getReadState') continue
    if (!(r.t >= afterT) || r.ok !== true) continue
    if (!(r.status >= 200 && r.status < 300)) continue
    if (!r.data || r.data.relation !== 'none') continue
    if (r.reqSeq == null || r.rpcId == null) continue
    const q = reqById.get(r.reqSeq)
    if (!q || !q.p || typeof q.p.sessionId !== 'string') continue
    if (!(q.t >= afterT)) continue
    if (q.rpcId == null || String(q.rpcId) !== String(r.rpcId)) continue
    if (excludeIds.includes(q.p.sessionId) || excludeSeenBefore.includes(q.p.sessionId)) continue
    ids.add(q.p.sessionId)
  }
  if (ids.size === 0) return { ok: false, reason: 'no fresh correlated relation-none readState response identified the created session' }
  if (ids.size > 1) return { ok: false, reason: `ambiguous created-session candidates (${[...ids].join(', ')}) — fail closed, never pick one` }
  return { ok: true, sessionId: [...ids][0] }
}

// ── leg oracles ──────────────────────────────────────────────────────────────

const reqsOf = (net, m) => (net || []).filter((e) => e.kind === 'req' && (!m || e.m === m))

/** E1 — fresh context, member-first cold reload window: preClick=0 (measured
 *  AT the click — the caller passes the boundary seq count), first readState
 *  is the member, exactly ONE projection (on the root), 1 ledger, >=3
 *  readStates, member relation face with its instance id. FROZEN from the
 *  v2/v3 round (neither weakened nor tightened). */
export function evalE1 ({ net, bodies, expectedMember, expectedRootId, preClick, t0 }) {
  const win = (net || []).filter((e) => e.kind === 'req' && e.t >= t0)
  const rs = win.filter((e) => e.m === 'team.getReadState')
  const pj = win.filter((e) => e.m === 'team.getProjection')
  const lg = win.filter((e) => e.m === 'team.getLedgerPage')
  const firstMember = rs[0] && rs[0].p && rs[0].p.sessionId === expectedMember.sessionId
  const projOnceRoot = pj.length === 1 && pj[0].p && pj[0].p.teamSessionId === expectedRootId
  const memberFace = (bodies || []).some((s) => s.t >= t0 && s.body.includes('"relation":"team-member"') && s.body.includes(expectedMember.instance))
  const ledgerOnce = lg.length === 1
  const verdict = (preClick === 0 && firstMember && projOnceRoot && ledgerOnce && rs.length >= 3 && memberFace) ? 'PASS' : 'FAIL'
  return { verdict, measured: { preClickTeamReqs: preClick, readStates: rs.length, projections: pj.length, ledger: lg.length, firstIsMember: !!firstMember, projOnceOnRoot: !!projOnceRoot, memberFaceSeen: memberFace } }
}

/** E3 — root cold round + stable page: the window starts at the cold-open
 *  click so the COLD projection/ledger the oracle counts are the ones the
 *  navigation produced (external review P3). The cadence band is DERIVED from
 *  the product tickMs (packages/client/src/plugin/team-mount-core.ts; frozen
 *  default 3000 in team-refresh-coordinator.ts) — the historical 2995–3008ms
 *  is a recorded observation, not the spec (external review P5). Every
 *  readState must carry the EXPECTED ROOT id. >=7 readStates = the cold read
 *  + >=6 target ticks; all but at most ONE delta inside interval ± tolerance
 *  (the frozen leniency is kept, not weakened); exactly-1 cold projection and
 *  1 ledger, both on the root. */
export function evalE3 ({ net, expectedRootId, t0, intervalMs, toleranceMs }) {
  if (!Number.isFinite(intervalMs) || intervalMs <= 0) throw new Error('evalE3: intervalMs must come from the product config — a hardcoded cadence band is what review P5 rejected')
  const tol = Number.isFinite(toleranceMs) && toleranceMs >= 0 ? toleranceMs : Math.max(300, Math.round(intervalMs * 0.1))
  const win = (net || []).filter((e) => e.kind === 'req' && e.t >= t0)
  const rs = reqsOf(win, 'team.getReadState')
  const pj = reqsOf(win, 'team.getProjection')
  const lg = reqsOf(win, 'team.getLedgerPage')
  const rootIdentityOk = rs.length > 0 && rs.every((e) => e.p && e.p.sessionId === expectedRootId)
  const deltas = []
  for (let i = 1; i < rs.length; i += 1) deltas.push(rs[i].t - rs[i - 1].t)
  const inBand = deltas.filter((d) => Math.abs(d - intervalMs) <= tol).length
  const projOnceRoot = pj.length === 1 && pj[0].p && pj[0].p.teamSessionId === expectedRootId
  const ledgerOnceRoot = lg.length === 1 && lg[0].p && lg[0].p.teamSessionId === expectedRootId
  const verdict = (rootIdentityOk && rs.length >= 7 && deltas.length >= 6 && inBand >= deltas.length - 1 && projOnceRoot && ledgerOnceRoot) ? 'PASS' : 'FAIL'
  return { verdict, measured: { readStates: rs.length, deltasMs: deltas, deltasInBand: inBand, intervalMs, toleranceMs, rootIdentityOk, projections: pj.length, ledger: lg.length, note: 'intervalMs comes from the product tickMs config; actual deltas reported (the historical 2995-3008ms is an observation, not a spec)' } }
}

/** E5 — one manual refresh click => exactly 1 ledger{afterSequence:0,
 *  limit:50}, >=1 readState reprobe, >=1 listRoots, 0 projections. FROZEN
 *  shape — plus the frozen round-2 tightening (item 6): every request in the
 *  post-refresh window must target the VERIFIED target root (ledger
 *  p.teamSessionId === expectedRootId, readState p.sessionId ===
 *  expectedRootId). Without an expectedRootId the refresh cannot be bound to
 *  the verified session at all — FAIL, never a silent any-root pass (a T1
 *  refresh fetching T2's ledger is a product FAIL, not a PASS). */
export function evalE5 ({ after, expectedRootId }) {
  const lg = reqsOf(after, 'team.getLedgerPage')
  const pj = reqsOf(after, 'team.getProjection')
  const rs = reqsOf(after, 'team.getReadState')
  const lr = reqsOf(after, 'team.listRoots')
  const shape = lg.length > 0 && lg.every((e) => e.p && e.p.afterSequence === 0 && e.p.limit === 50)
  const rootBound = typeof expectedRootId === 'string' && expectedRootId.length > 0
  const ledgerOnRoot = rootBound && lg.length > 0 && lg.every((e) => e.p && e.p.teamSessionId === expectedRootId)
  const reprobesOnRoot = rootBound && rs.length >= 1 && rs.every((e) => e.p && e.p.sessionId === expectedRootId)
  const verdict = (lg.length === 1 && shape && ledgerOnRoot && reprobesOnRoot && rs.length >= 1 && lr.length >= 1 && pj.length === 0) ? 'PASS' : 'FAIL'
  return { verdict, measured: { ledger: lg.length, ledgerShapeOk: shape, ledgerOnExpectedRoot: ledgerOnRoot, reprobesOnExpectedRoot: reprobesOnRoot, reprobes: rs.length, listRoots: lr.length, projectionsAfter: pj.length, note: '16ms latency was historical; latency reported, not required' } }
}

/** E2 — ordinary (UI-created) session: >=2 readStates in window, ZERO
 *  projections for the WHOLE leg, a none-relation body carrying the
 *  liveToken:null cell, >=1 listRoots. FROZEN. */
export function evalE2 ({ net, bodies, t0 }) {
  const window = (net.window || []).filter((e) => e.t >= t0)
  const rs = reqsOf(window, 'team.getReadState')
  const lr = reqsOf(window, 'team.listRoots')
  const pj = reqsOf(net.wholeLeg || net.window, 'team.getProjection')
  const noneClosed = (bodies || []).some((s) => s.t >= t0 && s.body.includes('"relation":"none"') && s.body.includes('"liveToken":null'))
  const verdict = (rs.length >= 2 && pj.length === 0 && noneClosed && lr.length >= 1) ? 'PASS' : 'FAIL'
  return { verdict, measured: { readStates: rs.length, listRoots: lr.length, projectionsWholeLeg: pj.length, noneClosedSixFields: noneClosed } }
}

/** E4 — frozen record: no browser-level original assertion exists; the
 *  unit/E2E tier is retained. An explicit entry, never an invented oracle. */
export function e4NotRun () {
  return { verdict: 'NOT_RUN', reason: 'frozen record: unit/E2E layer only; no browser-level original assertion exists in the frozen tree; coordinator ruling 2026-10-01' }
}

/** CONSISTENT AGGREGATION (external review P7): fatal => exit 3; any FAIL =>
 *  exit 1; any NOT_RUN browser leg => exit 2 (NOT_RUN is NEVER a PASS);
 *  exit 0 only when E1/E2/E3/E5 are all PASS. The E3E5 parent record never
 *  stamps nested verdicts — a missing nested entry is materialized as
 *  NOT_RUN here. E4 is the declared non-browser tier: reported, never a
 *  failure and never a PASS contributor. */
export function summarize (out) {
  const legs = (out && out.legs) || {}
  const x35 = legs.E3E5 || {}
  const verdicts = {
    E1: legs.E1?.verdict || 'NOT_RUN',
    E2: legs.E2?.verdict || 'NOT_RUN',
    E3: x35.E3?.verdict || 'NOT_RUN',
    E5: x35.E5?.verdict || 'NOT_RUN',
    E4: legs.E4?.verdict || 'NOT_RUN',
  }
  const reasons = []
  if (out && out.fatal) reasons.push('fatal: ' + out.fatal)
  for (const e of (out && out.errors) || []) reasons.push(String(e))
  if (reasons.length) return { ok: false, exitCode: 3, verdicts, reasons }
  const browser = ['E1', 'E2', 'E3', 'E5']
  for (const k of browser) if (verdicts[k] !== 'PASS' && verdicts[k] !== 'FAIL') reasons.push(`${k}: ${verdicts[k]} — ${legs[k]?.reason ?? x35.reason ?? 'no assertion window recorded'}`)
  const fails = browser.filter((k) => verdicts[k] === 'FAIL')
  const notRun = browser.filter((k) => verdicts[k] !== 'PASS')
  const exitCode = fails.length ? 1 : notRun.length ? 2 : 0
  for (const k of fails) reasons.push(`${k}: FAIL — ${JSON.stringify(legs[k]?.measured ?? x35[k]?.measured ?? null)}`)
  return { ok: exitCode === 0, exitCode, verdicts, reasons }
}

// ── credential hygiene ───────────────────────────────────────────────────────

/** Mask every credential-shaped substring on the way OUT of this process.
 *  (lt-v1 is a freshness hash rather than a credential, but it is masked as
 *  defense-in-depth — the old "hard credential" characterization is
 *  withdrawn.) */
export function scrubEvidence (text) {
  const masked = redactLiveTokenText(String(text).replace(/token=[A-Za-z0-9_-]+/g, 'token=SCRUBBED'))
  return masked.replace(/"liveToken"\s*:\s*("(\\.|[^"\\])*")/g, '"liveToken":"lt-v1-REDACTED"')
}

/** Deep copy for persisted output: strips any launchUrl key (the raw launch
 *  URL must never be copied), redacts liveToken fields, masks token= strings. */
export function redactOut (value) {
  const strip = (v) => {
    if (Array.isArray(v)) return v.map(strip)
    if (v === null || typeof v !== 'object') return typeof v === 'string' ? scrubEvidence(v) : v
    const out = {}
    for (const [k, item] of Object.entries(v)) {
      if (k === 'launchUrl') continue
      out[k] = strip(item)
    }
    return out
  }
  return redactLiveTokenFields(strip(value))
}

// ══════════════════ ORCHESTRATION CORE (offline-tested via fakes) ═══════════
// runDriverCore owns the leg orchestration and talks to the outside ONLY
// through `io` — openLeg(name, net) hands out the 14-method UiPage seam the
// Playwright adapter implements; fs/clock/log/tickMs come from the host. The
// offline suite injects scripted worlds through the SAME seams, so the legs
// under test here are the ones the live lane runs.

export class FailClosed extends Error {
  constructor (reason, diag) { super(reason); this.name = 'FailClosed'; this.diag = diag ?? null }
}
class Fatal extends Error {
  constructor (reason) { super(reason); this.name = 'Fatal' }
}

/** Correlated request/response recorder. Requests carry {seq, rpcId, params}.
 *  Round-2 frozen item 1 (representation unification): the recorder's ONLY
 *  response input is the RAW wire body TEXT — the same bytes the served
 *  transport sent. parseServerResponseEnvelope is the SINGLE parse point, so
 *  the offline fakes (which feed real wire JSON text) and the live Playwright
 *  callback (which feeds response.text()) exercise the identical parse→entry
 *  chain; a caller can no longer hand in a pre-parsed object that diverges
 *  from what the real parser accepts (the round-1 live defect: the fake's raw
 *  {result:{ok,value}} records passed while the adapter's flat parse recorded
 *  ok:false on every real success). Responses bind to THEIR request via the
 *  transport-level request object at record time and the wire rpcId. */
export function createNetworkLog () {
  const entries = []
  let seq = 0
  return {
    entries,
    lastSeq: () => seq,
    byId: (s) => entries.find((e) => e.seq === s) || null,
    recordRequest ({ leg, m, rpcId, p, t }) {
      const e = { seq: ++seq, leg, kind: 'req', t, m, rpcId: rpcId ?? null, p: p ?? null }
      entries.push(e)
      return e
    },
    recordResponse ({ leg, m, req, status, t, bodyText }) {
      const raw = bodyText == null ? '' : String(bodyText)
      const env = parseServerResponseEnvelope(raw)
      const e = {
        seq: ++seq, leg, kind: 'res', t, m: m || (req && req.m) || null,
        reqSeq: req ? req.seq : null, rpcId: env ? env.rpcId : null, status,
        ok: !!env && env.ok === true, data: env && env.ok === true ? env.data : null,
        error: env && env.ok === false ? env.error : (env ? null : 'unparseable-envelope'),
        body: raw.slice(0, 640),
      }
      entries.push(e)
      return e
    },
    reqs (leg, m) { return entries.filter((e) => e.kind === 'req' && e.leg === leg && (!m || e.m === m)) },
    resps (leg, m) { return entries.filter((e) => e.kind === 'res' && e.leg === leg && (!m || e.m === m)) },
    bodiesFor (leg, m) { return entries.filter((e) => e.kind === 'res' && e.leg === leg && e.m === m).map((e) => ({ t: e.t, body: e.body })) },
  }
}

const railLeavesOf = (leaves) => (leaves || []).filter((l) => l.region === 'rail')
const mainLeavesOf = (leaves) => (leaves || []).filter((l) => l.region === 'main')

/** THE fixed navigation (v1/v3 killer steps 1–3 + exact locate + verified
 *  selection). Returns the click boundary (clickT + clickSeq) the leg
 *  oracles use to delimit windows — navigation NEVER contributes to preClick
 *  after the click boundary (P1). */
async function navigate (page, net, leg, label, expected, io, out) {
  const steps = []
  const notice = await page.dismissNoticeIfVisible()
  if (notice === 'present-undismissable') throw new FailClosed('notice-present-but-undismissable')
  if (notice === 'dismissed') steps.push('dismiss-notice')
  let leaves = railLeavesOf(await page.collectLeaves())
  steps.push('expand-ungrouped-group')
  if (groupCollapsed(leaves)) {
    const header = groupHeaderLeaf(leaves) || leaves.find((l) => l.text === GROUP_TITLE)
    if (!header) throw new FailClosed('ungrouped-group-header-missing')
    await page.clickLeaf(header)
    await page.wait(1500)
    leaves = railLeavesOf(await page.collectLeaves())
    if (groupCollapsed(leaves)) throw new FailClosed('ungrouped-still-collapsed-after-click')
  }
  let guard = 0
  while (overflowPending(leaves) && guard < 3) {
    const btn = leaves.find((l) => l.tag === 'button' && OVERFLOW_RE.test(l.text))
    await page.clickLeaf(btn)
    await page.wait(1200)
    leaves = railLeavesOf(await page.collectLeaves())
    steps.push('expand-overflow')
    guard += 1
  }
  if (!expected) return { steps, leaves }
  await page.parkMouse()
  await page.wait(300)
  leaves = railLeavesOf(await page.collectLeaves())
  const hit = locateTitle(leaves, expected.title, { exclude: [GROUP_TITLE] })
  if (hit.status !== 'FOUND') {
    throw new FailClosed(`locate-${hit.status.toLowerCase()}`, { title: expected.title, hits: (hit.matches || []).length, railRowCount: leaves.filter((l) => String(l.cls || '').includes(ROW_CLUE) && l.text !== GROUP_TITLE).length })
  }
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const clickSeq = net.lastSeq() // preClick boundary: every entry BEFORE the click
    const clickT = io.now()
    await page.clickLeaf(hit.leaf)
    await page.wait(800)
    let verified = null
    const t0 = io.now()
    while (io.now() - t0 < 8000) {
      verified = verifySelection({
        headerLeaves: mainLeavesOf(await page.collectLeaves()).filter((l) => l.y < 120),
        freshRequests: net.reqs(leg),
        freshResponses: net.resps(leg),
        expected,
        clickT,
      })
      if (verified.verified) break
      await io.sleep(400)
    }
    out.legs[label] = out.legs[label] || {}
    out.legs[label]['verifyAttempt' + attempt] = { ...verified, clickT, clickSeq }
    if (verified.verified) return { steps, leaves, clickT, clickSeq }
    if (attempt === 1) await page.screenshot(`shot-${label}-verify-anomaly.png`)
  }
  throw new FailClosed('selection-unverified-after-one-same-row-retry', out.legs[label])
}

async function waitForDialog (page, io, tries = 12) {
  for (let w = 0; w < tries; w += 1) {
    await io.sleep(500)
    const s = await page.dialogSnapshot()
    if (s && s.open) return s
  }
  return null
}

async function waitForDialogClosed (page, io, tries = 10) {
  for (let w = 0; w < tries; w += 1) {
    const s = await page.dialogSnapshot()
    if (!s || !s.open) return true
    await io.sleep(400)
  }
  return false
}

async function abortDialog (page, io, dialog) {
  const abort = e2AbortSteps({ dialog: dialog || { open: false }, failedBeforeOpen: true })
  for (const step of abort.steps) {
    if (step === 'click-cancel') {
      const cancel = ((dialog && dialog.buttons) || []).find((b) => DIALOG_CANCEL_LABELS.includes(b)) || DIALOG_CANCEL_LABELS[0]
      await page.dialogClickButton(cancel)
    }
    if (step === 'assert-dialog-closed') await waitForDialogClosed(page, io)
  }
}

// Bounded async dialog waits (frozen round-2 item 3). The REAL component
// selects a row immediately but loads the selected folder's listing ASYNC
// (DirectoryBrowser.tsx select() -> launchListing -> scan.then), and the
// crumb trail only follows once that listing lands (:688 crumbSource =
// child ?? parent). Snapshot-on-click would Cancel a legitimately-lagging
// listing; a fixed blind sleep is forbidden. The pattern below is a BOUNDED
// DEADLINE POLL: re-probe the real DOM state until the exact expected state
// is observed, fail closed (asserted Cancel) at the budget — never Open on
// unconfirmed state. The budget is generous for local listing latency and
// the wait ENDS as soon as the state is reached.
const DIALOG_LISTING_BUDGET_MS = 15000
const samePath = (a, b) => Array.isArray(a) && a.length === b.length && a.every((x, i) => x === b[i])

async function waitForDialogState (page, io, predicate, { ms = DIALOG_LISTING_BUDGET_MS, label }) {
  const deadline = io.now() + ms
  let last = null
  for (;;) {
    last = await page.dialogSnapshot()
    if (last && predicate(last)) return last
    if (io.now() >= deadline) {
      const seen = last ? { open: last.open, crumbs: last.crumbLabels, selected: (last.rows || []).filter((r) => r.selected).map((r) => r.name) } : null
      throw new FailClosed(`e2-workspace-dialog: ${label} not reached within ${ms}ms bounded wait (last state ${JSON.stringify(seen)}) — fail closed before Open`)
    }
    await io.sleep(400)
  }
}

/** Live execution of the workspace plan: every level (ancestors THEN the
 *  workspace folder) must be uniquely offered on the CURRENT (deepest)
 *  listing column, is clicked, and the click must produce — each within its
 *  own bounded wait — (a) the aria-current selection on that row and (b) the
 *  EXACT full crumb path ending at that folder (async listing). Any
 *  divergence fails CLOSED via the asserted Cancel path — a broader directory
 *  is NEVER opened. */
async function runWorkspacePlan (page, io, plan, authz) {
  const open0 = await page.dialogSnapshot()
  if (!open0 || !open0.open) throw new FailClosed('e2-workspace-dialog: dialog not open at plan start')
  const rootLabel = (open0.crumbLabels || [])[0] ?? null
  if (!DIALOG_HOME_LABELS.includes(rootLabel)) throw new FailClosed(`e2-workspace-dialog: root crumb ${JSON.stringify(rootLabel)} is not the authorized home crumb`)
  let expect = [rootLabel]
  for (const seg of [...authz.ancestors, authz.folder]) {
    const deepestRows = (s) => {
      const rows = s.rows || []
      const deepest = rows.reduce((m, r) => Math.max(m, r.level | 0), 0)
      return rows.filter((r) => (r.level | 0) === deepest)
    }
    await waitForDialogState(page, io, (s) => s.open && deepestRows(s).filter((r) => r.name === seg).length === 1,
      { label: `cd:${seg} uniquely offered at crumb ${expect[expect.length - 1]}` })
    await page.dialogClickFolder(seg)
    // selection lands on the CLICKED row (its own level — the new column may
    // already be present by the time we re-probe, so match by name+aria-current)
    await waitForDialogState(page, io, (s) => s.open && (s.rows || []).some((r) => r.name === seg && r.selected === true),
      { label: `select:${seg} aria-current on its row button` })
    expect = [...expect, seg]
    await waitForDialogState(page, io, (s) => s.open && samePath(s.crumbLabels, expect),
      { label: `crumb path to exact ${JSON.stringify(expect.join('/'))} (async listing)` })
  }
}

/** Parse the product tick cadence from the frozen mount config source.
 *  No fallback constant: unresolved cadence is a fail-closed FATAL. */
export function parseTickMsSource (src) {
  const m = /tickMs:\s*(\d+)/.exec(String(src))
  return m ? Number(m[1]) : null
}

export function readProductTickMs (repoRoot, fsx = fs) {
  const p = path.join(repoRoot, 'packages', 'client', 'src', 'plugin', 'team-mount-core.ts')
  try { return parseTickMsSource(fsx.readFileSync(p, 'utf8')) } catch { return null }
}

/** Read the canonical title map, READ-ONLY, from the world's projcache. */
export function readProjcacheTitles (worldDir, fsx = fs) {
  const dir = path.join(worldDir, 'storages', 'session_projcache', 'sessions')
  const map = {}
  for (const f of fsx.readdirSync(dir)) {
    if (!f.endsWith('.json')) continue
    try {
      const rec = JSON.parse(fsx.readFileSync(path.join(dir, f), 'utf8'))
      map[f.slice(0, -'.json'.length)] = rec?.record?.rows?.title?.val ?? null
    } catch { map[f.slice(0, -5)] = null }
  }
  return map
}

/**
 * The leg orchestration. cfg = { accessPath, smokeHostPath, world, out,
 * testWorkspace, authorizedRoot, railMaxX?, tickMs }; io = { fs, realpathSync,
 * homedir, now, sleep, log, openLeg(name, net) -> {page, close} }.
 * Returns the record (out); exit-code/ok semantics: see summarize().
 */
export async function runDriverCore (cfg, io) {
  const fsx = io.fs
  const out = {
    ok: false, fatal: null, startedAt: new Date(io.now()).toISOString(),
    cfg: { accessRecordPath: cfg.accessPath, smokeHost: cfg.smokeHostPath, world: cfg.world, testWorkspace: cfg.testWorkspace, authorizedRoot: cfg.authorizedRoot, railMaxX: cfg.railMaxX ?? 260 },
    net: [], legs: {}, errors: [],
  }
  const closes = []
  let net = null
  const legWrap = async (name, fn, { nested = false } = {}) => {
    out.legs[name] = out.legs[name] || {}
    try {
      await fn()
      if (!nested && !out.legs[name].verdict) { out.legs[name].verdict = 'NOT_RUN'; if (!out.legs[name].reason) out.legs[name].reason = 'leg ended without an assertion window' }
    } catch (e) {
      if (e instanceof Fatal) throw e
      // Driver-side failure = NOT_RUN (a driver defect is NOT a product FAIL —
      // the v2/v3 mislabels this). Never a partial-FAIL on an unreached window.
      if (!nested) out.legs[name].verdict = 'NOT_RUN'
      out.legs[name].reason = e instanceof FailClosed ? `fail-closed: ${e.message}` : `driver-error: ${String(e.message || e).slice(0, 300)}`
      if (e instanceof FailClosed && e.diag) out.legs[name].diag = e.diag
      io.log(scrubEvidence(`[${name}] ${out.legs[name].reason}`))
    }
  }
  try {
    // ── preflight: identity + workspace authorization BEFORE any browser leg ─
    if (typeof cfg.accessPath !== 'string' || typeof cfg.smokeHostPath !== 'string' || typeof cfg.world !== 'string' || typeof cfg.out !== 'string') {
      throw new Fatal('access/smoke-host/world/out are all required')
    }
    let access
    try { access = JSON.parse(fsx.readFileSync(cfg.accessPath, 'utf8')) } catch (e) { throw new Fatal('cannot read the private access record: ' + String(e.message || e).slice(0, 120)) }
    const launchUrl = access?.launchUrl
    if (typeof launchUrl !== 'string' || !launchUrl.includes('?token=')) throw new Fatal('access record has no launchUrl with a token — refusing')
    let host
    try { host = JSON.parse(fsx.readFileSync(cfg.smokeHostPath, 'utf8')) } catch (e) { throw new Fatal('cannot read smoke-host.json: ' + String(e.message || e).slice(0, 120)) }
    const targets = canonicalTargets({ projcache: readProjcacheTitles(cfg.world, fsx), rootId: host.t1, memberIds: [host.t1MemberSession] })
    if (!targets.ok) throw new Fatal(targets.reason)
    if (typeof cfg.testWorkspace !== 'string' || !cfg.testWorkspace.startsWith('/')) {
      throw new Fatal('--test-workspace must be given EXPLICITLY as an absolute path — an unnamed default directory is never authorized (review P6)')
    }
    if (typeof cfg.authorizedRoot !== 'string' || !cfg.authorizedRoot.startsWith('/')) {
      throw new Fatal('--authorized-root must be given EXPLICITLY as an absolute path — the approval boundary of this round')
    }
    let testWorkspaceReal, authorizedRootReal, homeReal
    try {
      testWorkspaceReal = io.realpathSync(cfg.testWorkspace)
      authorizedRootReal = io.realpathSync(cfg.authorizedRoot)
      homeReal = io.realpathSync(io.homedir())
    } catch (e) { throw new Fatal('cannot realpath the workspace authorization inputs (the fixture must exist before the run): ' + String(e.message || e).slice(0, 120)) }
    const authz = authorizeWorkspace({ testWorkspaceReal, authorizedRootReal, homeReal })
    if (!authz.ok) throw new Fatal(authz.reason)
    const tickMs = Number.isFinite(cfg.tickMs) && cfg.tickMs > 0 ? cfg.tickMs : io.tickMs
    if (!Number.isFinite(tickMs) || tickMs <= 0) throw new Fatal('the readState tick interval is unresolved from the product config (packages/client/src/plugin/team-mount-core.ts) — refusing to guess a cadence band')
    out.cfg.tickMs = tickMs
    out.cfg.workspaceAuthz = { testWorkspaceReal, authorizedRootReal, homeReal, ancestors: authz.ancestors, folder: authz.folder }

    net = createNetworkLog()
    out.net = net.entries

    // ── E1: fresh context; preClick boundary AT the click; member-first ─────
    await legWrap('E1', async () => {
      const leg = await io.openLeg('E1', net)
      closes.push(leg.close)
      const page = leg.page
      await page.gotoApp(launchUrl)
      await page.wait(4500)
      const nav = await navigate(page, net, 'E1', 'E1', { sessionId: targets.targets.member.id, title: targets.targets.member.title, relation: 'team-member', instance: host.t1MemberInstance }, io, out)
      const preClick = net.reqs('E1').filter((e) => e.seq <= nav.clickSeq).length
      out.legs.E1.navSteps = nav.steps
      out.legs.E1.clickSeq = nav.clickSeq
      out.legs.E1.preClickNavReqs = preClick // pre-click traffic only — the click's own cold round is NOT preClick (P1)
      // LIVE-INCIDENT FIX (raw 2026-10-01T17-43-09): the product's ticks are
      // armed ONLY while TeamView is ATTACHED (team-refresh-coordinator.ts
      // :7-8/346-351) — the PR#35 original E1 is cold-OPEN-TEAM-TAB + member
      // reload. Activate the REAL conversation tab (role=tab inside
      // [data-conversation-tabs], NOT the same-text dock label) and VERIFY
      // armament (aria-selected=true + [data-team-view]) BEFORE the window.
      // The ≥3-readStates threshold is UNCHANGED — activation is the spec's
      // own precondition, not a bar we lower.
      const act1 = await page.activateTeamTab({ names: ALLOWED_TAB_NAMES, phase: 'E1-pre-reload' })
      out.legs.E1.teamTabActivation = act1
      if (!act1.ok) throw new FailClosed('E1-team-view-not-armed: ' + act1.reason + ' (attach precondition unmet — driver-side NOT_RUN, never attributed to the product)')
      await page.wait(2500)
      const lt0 = io.now()
      await page.reload()
      const nd = await page.dismissNoticeIfVisible()
      if (nd === 'present-undismissable') throw new FailClosed('notice-present-but-undismissable-after-reload')
      const act1b = await page.activateTeamTab({ names: ALLOWED_TAB_NAMES, phase: 'E1-post-reload' }) // idempotent; RE-VERIFIES the restore instead of assuming it
      out.legs.E1.teamTabActivationPostReload = act1b
      if (!act1b.ok) throw new FailClosed('E1-team-view-not-armed-after-reload: ' + act1b.reason)
      await page.wait(10000)
      await page.screenshot('shot-E1-member-pure.png')
      Object.assign(out.legs.E1, evalE1({
        net: net.reqs('E1'),
        bodies: net.bodiesFor('E1', 'team.getReadState'),
        expectedMember: { sessionId: targets.targets.member.id, instance: host.t1MemberInstance },
        expectedRootId: host.t1, preClick, t0: lt0,
      }))
      // phase WALL-CLOCK evidence for the observation window (the network
      // first/last span is NOT a substitute for how long we actually watched)
      out.legs.E1.observationWindow = { startT: lt0, endT: io.now(), wallMs: io.now() - lt0 }
    })

    // ── E3+E5: fresh context; root cold round (window STARTS at the click),
    //    >=6 ticks at the PRODUCT cadence, manual refresh ─────────────────────
    await legWrap('E3E5', async () => {
      const leg = await io.openLeg('E3', net)
      closes.push(leg.close)
      const page = leg.page
      await page.gotoApp(launchUrl)
      await page.wait(4500)
      const nav = await navigate(page, net, 'E3', 'E3E5', { sessionId: targets.targets.root.id, title: targets.targets.root.title, relation: 'team-root' }, io, out)
      out.legs.E3E5.navSteps = nav.steps
      const w0 = nav.clickT // P3: the cold round IS in the window
      // LIVE-INCIDENT FIX (raw: teamTabHits=2 — dock label + role=tab share
      // the text; the old text-count refused and silently never activated).
      // Activate the REAL conversation tab via the seam action (scoped to
      // [data-conversation-tabs] role=tab, verified via aria-selected +
      // [data-team-view]) BEFORE the observation window; ambiguity or a
      // click that never arms is a driver/environment NOT_RUN — never a
      // product FAIL, and never a guessed click.
      const act = await page.activateTeamTab({ names: ALLOWED_TAB_NAMES, phase: 'E3-pre-window' })
      out.legs.E3E5.teamTabActivation = act
      if (!act.ok) {
        out.legs.E3E5.E3 = { verdict: 'NOT_RUN', reason: 'team-view-not-armed: ' + act.reason + ' (attach precondition — never attributed to the product)' }
        out.legs.E3E5.E5 = { verdict: 'NOT_RUN', reason: 'team-view-not-armed (E3 window never opened)' }
        await page.screenshot('shot-E3-team-tab-anomaly.png')
        return
      }
      const w3Start = io.now()
      await page.wait(10000)
      await page.wait(6 * tickMs + 1000)
      await page.screenshot('shot-E3-root-team.png')
      out.legs.E3E5.E3WindowWall = { startT: w3Start, endT: io.now(), wallMs: io.now() - w3Start } // phase wall-clock evidence
      out.legs.E3E5.E3 = evalE3({ net: net.reqs('E3'), expectedRootId: host.t1, t0: w0, intervalMs: tickMs })
      // E5: the refresh control is button[data-team-refresh] INSIDE
      // [data-team-view] (TeamView.tsx:1321-1329) — scoped stable attributes,
      // label still checked against the exact-name allowlist; TeamView-ready
      // is a precondition, its absence is NOT_RUN with reason.
      const rf = await page.teamRefreshControl({ names: ALLOWED_REFRESH_NAMES })
      out.legs.E3E5.teamRefresh = rf
      if (!rf.ok) {
        out.legs.E3E5.E5 = { verdict: 'NOT_RUN', reason: 'team-refresh-control: ' + rf.reason }
        await page.screenshot('shot-E5-control-anomaly.png')
        return
      }
      const t5 = io.now()
      const rfClick = await page.teamRefreshControl({ names: ALLOWED_REFRESH_NAMES, click: true })
      if (!rfClick.ok) {
        out.legs.E3E5.E5 = { verdict: 'NOT_RUN', reason: 'team-refresh-control: ' + rfClick.reason }
        return
      }
      await page.wait(6500)
      await page.screenshot('shot-E5-refresh.png')
      const after = net.reqs('E3').filter((e) => e.t >= t5)
      const ledRes = net.resps('E3', 'team.getLedgerPage').find((r) => {
        const q = net.byId(r.reqSeq)
        return r.t > t5 && q && q.t >= t5
      })
      out.legs.E3E5.E5 = { ...evalE5({ after, expectedRootId: host.t1 }), measuredExtra: { ledgerResponseLatencyMs: ledRes ? ledRes.t - t5 : null } }
    }, { nested: true })

    // ── E2: fresh context; UI-created ordinary session (zero-state) ──────────
    await legWrap('E2', async () => {
      const leg = await io.openLeg('E2', net)
      closes.push(leg.close)
      const page = leg.page
      await page.gotoApp(launchUrl)
      await page.wait(4500)
      const nav = await navigate(page, net, 'E2', 'E2', null, io, out)
      out.legs.E2.navSteps = nav.steps
      // 'New Session' is a rail chrome control, located by EXACT text — not a
      // session row, so locateTitle-with-exclude does not apply here.
      const rail = railLeavesOf(await page.collectLeaves())
      const ns = rail.filter((l) => l.text === 'New Session')
      if (ns.length !== 1) throw new FailClosed('new-session-control-not-unique', { hits: ns.length })
      await page.clickLeaf(ns[0])
      // The proven blocker: the Select Workspace Directory dialog — read as
      // REAL dialog state (snapshot + crumb), NEVER innerText through an HTML
      // parser (review P2).
      let dialog = await waitForDialog(page, io)
      if (!dialog) {
        // v1 body text shows the 'Choose workspace' affordance BEFORE a dialog.
        const wsBtn = mainLeavesOf(await page.collectLeaves()).filter((l) => l.text === 'Choose workspace')
        if (wsBtn.length === 1) {
          await page.clickLeaf(wsBtn[0])
          dialog = await waitForDialog(page, io)
        }
      }
      const plan = e2WorkspaceSteps({ dialog: dialog || { open: false }, authz, absPath: testWorkspaceReal })
      if (!plan.ok) {
        await abortDialog(page, io, dialog)
        await page.screenshot('shot-E2-workspace-anomaly.png')
        throw new FailClosed('e2-workspace-dialog: ' + plan.reason)
      }
      out.legs.E2.workspacePlan = plan.steps
      try {
        await runWorkspacePlan(page, io, plan, authz)
      } catch (e) {
        // ANY pre-Open error (including a Playwright action timeout escaping
        // as a plain Error) takes the asserted Cancel path — best-effort,
        // never silently leave the modal up for the context to kill.
        try { await abortDialog(page, io, await page.dialogSnapshot()) } catch { /* best effort */ }
        await page.screenshot('shot-E2-workspace-anomaly.png')
        throw e instanceof FailClosed ? e : new FailClosed('e2-workspace-dialog: ' + String(e.message || e).slice(0, 200))
      }
      const openLabel = ((await page.dialogSnapshot()).buttons || []).find((b) => DIALOG_OPEN_LABELS.includes(b)) || DIALOG_OPEN_LABELS[0]
      const openT = io.now()
      await page.dialogClickButton(openLabel)
      if (!await waitForDialogClosed(page, io)) throw new FailClosed('e2-dialog-did-not-close')
      await page.fillComposer('ping')
      // POST-ACTION WORKSPACE STATE (coordinator ruling): the created
      // session's workspace must equal the AUTHORIZED realpath. The created
      // session id comes from a SUCCESS relation-none correlated response
      // (never an exclusion guess). Signal source: the world's projcache
      // record -> record.identity.cwd (shape verified read-only against the
      // retained world; see fixtures).
      // The created session's readState runs on the product's OWN poll loop
      // (tickMs cadence) after the Open commits, so the fresh correlated
      // relation-none response is awaited on a BOUNDED deadline DERIVED FROM
      // THAT CADENCE (5 ticks + 2s response margin, 400ms re-probes) — not a
      // single-shot read (false-NOT_RUN on normal latency) and not a blind
      // fixed sleep. Bounded wait never fabricates a response: absence fails
      // closed at the budget, and per frozen item 5 a PRE-Open request of an
      // already-known ordinary session can never impersonate the created one
      // (request-side freshness + non-null rpcId + excludeSeenBefore).
      const createdBudgetMs = 5 * io.tickMs + 2000
      const seenBeforeOpen = [...new Set(net.reqs('E2').filter((e) => e.m === 'team.getReadState' && e.t < openT && e.p && typeof e.p.sessionId === 'string').map((e) => e.p.sessionId))]
      const createdDeadline = io.now() + createdBudgetMs
      let found = { ok: false, reason: 'no fresh correlated relation-none readState response identified the created session' }
      let createdWaits = 0
      for (;;) {
        found = findCreatedSession({ responses: net.resps('E2'), requests: net.reqs('E2'), excludeIds: [targets.targets.root.id, targets.targets.member.id], excludeSeenBefore: seenBeforeOpen, afterT: openT })
        if (found.ok) break
        if (io.now() >= createdDeadline) { found = { ok: false, reason: found.reason + ` (bounded ${createdBudgetMs}ms = 5 product ticks + margin exhausted)` }; break }
        createdWaits += 1
        // wait ON THE PAGE: the product's poll loop runs on page timers, so
        // the poll gap is spent as real page time (offline: boundary-accurate
        // virtual ticks), not driver-side time the page never sees.
        await page.wait(400)
      }
      out.legs.E2.createdSessionWait = { budgetMs: createdBudgetMs, polls: createdWaits, ok: found.ok }
      let cwdCheck = found.ok ? { ok: false, reason: 'projcache record unreadable' } : { ok: false, reason: found.reason }
      if (found.ok) {
        const recPath = path.join(cfg.world, 'storages', 'session_projcache', 'sessions', found.sessionId + '.json')
        for (let w = 0; w < 40 && !fsx.existsSync(recPath); w += 1) await io.sleep(500)
        let rec = null
        try { rec = JSON.parse(fsx.readFileSync(recPath, 'utf8')) } catch { rec = null }
        cwdCheck = assertSessionCwd({ record: rec, expectedPath: testWorkspaceReal })
        cwdCheck.sessionId = found.sessionId
      }
      cwdCheck.signal = 'session_projcache record.identity.cwd'
      out.legs.E2.workspaceCwdCheck = cwdCheck
      if (!cwdCheck.ok) throw new FailClosed('e2-workspace-cwd: ' + cwdCheck.reason, cwdCheck)
      await page.wait(7000)
      const w0 = io.now()
      const tabHits = mainLeavesOf(await page.collectLeaves()).filter((l) => ALLOWED_TAB_NAMES.includes(l.text))
      if (tabHits.length === 1) { await page.clickLeaf(tabHits[0]); await page.wait(1200) }
      await page.wait(9000)
      await page.screenshot('shot-E2-ordinary.png')
      const legNet = net.reqs('E2')
      out.legs.E2 = { ...out.legs.E2, ...evalE2({ net: { window: legNet.filter((e) => e.t >= w0), wholeLeg: legNet }, bodies: net.bodiesFor('E2', 'team.getReadState'), t0: w0 }) }
    })

    out.legs.E4 = e4NotRun()
  } catch (e) {
    if (e instanceof Fatal) out.fatal = e.message
    else out.errors.push('fatal: ' + String(e.message || e).slice(0, 500))
  } finally {
    for (const c of closes) { try { await c() } catch { /* ignore */ } }
    const s = summarize(out)
    out.ok = s.ok
    out.finishedAt = new Date(io.now()).toISOString()
    try {
      fsx.mkdirSync(cfg.out, { recursive: true })
      fsx.writeFileSync(path.join(cfg.out, 'dod20-driver-out.json'), JSON.stringify(redactOut(out), null, 1))
    } catch (e) { out.errors.push('out-write failed: ' + String(e.message || e).slice(0, 200)) }
    io.log('driver done ok=' + out.ok + ' exit=' + s.exitCode + ' legs=' + JSON.stringify(Object.fromEntries(Object.entries(s.verdicts).map(([k, v]) => [k, v]))))
  }
  return out
}

// ══════════════════════ LIVE LANE (gated on review) ═════════════════════
// Everything below only executes under an explicit `--confirm-live` in the
// REAL acceptance environment (the carrier world booted by the merged
// browser-smoke-host kit). Nothing in this section runs for the offline tests.

export const ALLOWED_TAB_NAMES = Object.freeze(['Team', '团队'])

/**
 * SHARED team-tab activation routine — THE production algorithm, exported so
 * the offline fakes and the live Playwright adapter exercise the SAME code
 * (external review of b52151ab, point 1: "不能再复制算法"). Pure dependency
 * injection — { now, sleep, countRoleTabs, isTabVisible, clickTab,
 * readAriaSelected, viewVisible } — no DOM framework, no clock of its own.
 * Semantics: bounded DISCOVERY of a unique, visible scoped role=tab inside
 * the absolute budgetMs; >1 at any instant fail-closes ambiguous (never
 * clicks, never guesses); discovery exhaustion and any un-armed outcome are
 * { ok:false, reason } (core turns them into NOT_RUN — never a product
 * FAIL). Point 2 (absolute budget discipline): the click timeout and every
 * success check are bounded by the REMAINING budget; a deadline breach
 * yields NOT_RUN even if the control would arm later (late success refused).
 */
export async function runTeamTabActivation (opts) {
  const { names = [], phase = '', budgetMs = 6000, now, sleep, countRoleTabs, isTabVisible, clickTab, readAriaSelected, viewVisible } = opts
  const t0 = now()
  const left = () => budgetMs - (now() - t0)
  let total = 0
  let which = null
  for (;;) {
    const per = await countRoleTabs(names)
    total = per.reduce((a, b) => a + (b || 0), 0)
    if (total > 1) return { ok: false, phase, hits: total, reason: 'team-tab-ambiguous (' + total + ' role=tab hits) — never guess' }
    if (total === 1) {
      which = names[per.findIndex((c) => c > 0)]
      if (await isTabVisible(which)) break
    }
    if (left() <= 0) return { ok: false, phase, hits: total, reason: 'team-tab-not-found under [data-conversation-tabs] role=tab allowlist (' + names.join('/') + ') — never appeared within ' + budgetMs + 'ms bounded discovery' }
    await sleep(Math.min(250, left()))
  }
  // POINT-2 DISCIPLINE: the click gets only the REMAINING absolute budget
  // (never a fixed 5000 stacking onto discovery), and EVERY success check is
  // preceded by the deadline check — a control that would arm only at/after
  // the budget is NOT_RUN territory: late success is refused.
  const clickBudget = Math.min(5000, left())
  if (clickBudget <= 0) return { ok: false, phase, hits: 1, reason: 'team-tab-not-armed: absolute budget exhausted before click (late success refused; bounded ' + budgetMs + 'ms)' }
  try { await clickTab(which, clickBudget) } catch (e) { return { ok: false, phase, hits: 1, reason: 'team-tab-click-failed: ' + String((e && e.message) || e).slice(0, 140) } }
  let sel = null
  let vis = false
  for (;;) {
    if (left() <= 0) return { ok: false, phase, hits: 1, reason: 'team-tab-not-armed: aria-selected=' + String(sel) + ' data-team-view-visible=' + vis + ' exceeded ' + budgetMs + 'ms absolute budget (late success refused)' }
    sel = await readAriaSelected(which)
    vis = await viewVisible()
    if (sel === 'true' && vis) return { ok: true, phase, hits: 1, armedMs: now() - t0 }
    await sleep(Math.min(250, left()))
  }
}

export const ALLOWED_REFRESH_NAMES = Object.freeze(['刷新团队视图', 'Refresh team view'])
const WEAK = ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu-sandbox', '--disable-web-security', '--disable-features=Sandbox', '--disable-seccomp-filter-sandbox']

export function parseArgs (argv) {
  const get = (name, dflt) => {
    const i = argv.indexOf(`--${name}`)
    if (i === -1) return dflt
    const v = argv[i + 1]
    if (v === undefined || v.startsWith('--')) throw new Error(`--${name} requires a value`)
    return v
  }
  return {
    access: get('access'),
    smokeHost: get('smoke-host'),
    world: get('world'),
    out: get('out'),
    testuse: get('testuse', '/srv/workspace/dsh-plugins/dsh-agent-team/tests/deepseek-harness-test-use'),
    chrome: get('chrome', '/opt/google/chrome/chrome'),
    // EXPLICIT AUTHORIZED inputs for this round (review P6): NO defaults —
    // an unnamed directory is never authorized. Both are realpath-contained
    // against each other before any browser leg opens (runDriverCore).
    testWorkspace: get('test-workspace'),
    authorizedRoot: get('authorized-root'),
    railMaxX: Number(get('rail-max-x', '260')),
  }
}

/** The rail leaf collector injected into the page: geometry-filtered leaf
 *  records shaped exactly like htmlLeaves() output plus x/y/w/h. */
export function railCollectorSource (railMaxX) {
  return `(() => {
    const out = []
    for (const e of document.querySelectorAll('*')) {
      const r = e.getBoundingClientRect()
      if (r.width === 0 || r.height === 0) continue
      if (e.children.length > 0) continue
      const t = (e.textContent || '').replace(/\\s+/g, ' ').trim()
      if (!t || t.length > 200) continue
      const inRail = r.x < ${railMaxX} && r.right <= ${railMaxX} + 8
      const inMain = r.x >= ${railMaxX}
      out.push({ tag: e.tagName.toLowerCase(), cls: String(e.className || '').slice(0, 80), role: e.getAttribute('role') || '', text: t, x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), region: inRail ? 'rail' : 'main' })
    }
    return out
  })()`
}

/** THE single live dialog-state probe: REAL DOM evaluated in-page — the
 *  serialized dialogStateFrom above (the ONE implementation; the offline
 *  faithful-markup tests run the SAME serialized string under jsdom). It
 *  reads the actual DirectoryBrowser structure: crumb BUTTON labels in the
 *  [role=navigation] trail, Miller columns ([role=list]) of [role=listitem]
 *  rows whose inner button carries aria-current when selected, footer
 *  buttons — never innerText through an HTML parser, never class guessing
 *  beyond the frozen i18n allowlists. Actions go through Playwright semantic
 *  locators (getByRole) scoped to the dialog and the DEEPEST listing column. */
export const DIALOG_STATE_SOURCE = `(() => {
  const dlg = document.querySelector('[role="dialog"], dialog')
  if (!dlg) return { open: false, title: null, crumbLabels: [], rows: [], buttons: [] }
  return (${dialogStateFrom.toString()})(dlg)
})()`

export function loadPlaywright (testuseDir) {
  const req = createRequire(path.join(testuseDir, 'package.json'))
  return req('playwright')
}

/** The UiPage adapter over a real Playwright page — the SAME 14-method seam
 *  the offline fakes implement. */
export function createPlaywrightPage (page, cfg) {
  const dialogScope = () => page.locator('[role="dialog"], dialog').last()
  return {
    gotoApp: (url) => page.goto(url, { waitUntil: 'load', timeout: 60000 }),
    reload: () => page.reload({ waitUntil: 'load', timeout: 60000 }),
    wait: (ms) => page.waitForTimeout(ms),
    screenshot: (name) => page.screenshot({ path: path.join(cfg.out, name) }).catch(() => {}),
    collectLeaves: () => page.evaluate(railCollectorSource(cfg.railMaxX ?? 260)),
    clickLeaf: async (l) => { await page.mouse.click(l.x + Math.min(40, l.w / 2), l.y + l.h / 2) },
    parkMouse: () => page.mouse.move((cfg.railMaxX ?? 260) + 400, 400),
    dismissNoticeIfVisible: async () => {
      const btn = page.getByRole('button', { name: 'Continue' }).first()
      if (!(await btn.isVisible().catch(() => false))) return 'absent'
      const box = await btn.boundingBox().catch(() => null)
      if (!box) return 'present-undismissable'
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
      await page.waitForTimeout(1500)
      const still = await page.getByRole('button', { name: 'Continue' }).first().isVisible().catch(() => false)
      return still ? 'present-undismissable' : 'dismissed'
    },
    // ── team-view activation / ready (LIVE-INCIDENT fix; stable attributes
    // only: [data-conversation-tabs] + role=tab + aria-selected upstream
    // ConversationSession.tsx:143-154; [data-team-view] TeamView.tsx:1295;
    // button[data-team-refresh] TeamView.tsx:1321-1329. The TeamDock's same-
    // text label is OUTSIDE this scope and can never be clicked here.) ──
    activateTeamTab: (o = {}) => runTeamTabActivation({
      names: o.names || [], phase: o.phase || '', budgetMs: o.budgetMs || 6000,
      now: Date.now,
      sleep: (ms) => page.waitForTimeout(ms),
      countRoleTabs: async (names) => { const per = []; for (const n of names) per.push(await page.locator('[data-conversation-tabs]').getByRole('tab', { name: n, exact: true }).count().catch(() => 0)); return per },
      isTabVisible: async (n) => page.locator('[data-conversation-tabs]').getByRole('tab', { name: n, exact: true }).first().isVisible().catch(() => false),
      clickTab: async (n, timeoutMs) => { await page.locator('[data-conversation-tabs]').getByRole('tab', { name: n, exact: true }).first().click({ timeout: Math.max(250, Math.floor(timeoutMs)) }) },
      readAriaSelected: async (n) => page.locator('[data-conversation-tabs]').getByRole('tab', { name: n, exact: true }).first().getAttribute('aria-selected').catch(() => null),
      viewVisible: async () => page.locator('[data-team-view]').first().isVisible().catch(() => false),
    }),
    teamRefreshControl: async ({ names = [], click = false } = {}) => {
      const btn = page.locator('[data-team-view] button[data-team-refresh]').first()
      const n = await page.locator('[data-team-view] button[data-team-refresh]').count().catch(() => 0)
      if (n !== 1) return { ok: false, reason: 'team-refresh-control-' + (n === 0 ? 'not-found' : 'ambiguous(' + n + ' hits)') + ' in [data-team-view] scope — TeamView-ready precondition' }
      if (!(await btn.isVisible().catch(() => false))) return { ok: false, reason: 'team-refresh-control hidden — TeamView not ready' }
      const label = (await btn.innerText().catch(() => '')).trim()
      if (!names.includes(label)) return { ok: false, reason: 'team-refresh-label-not-in-allowlist ' + JSON.stringify(label) }
      if (!click) return { ok: true, label }
      try { await btn.click({ timeout: 5000 }) } catch (e) { return { ok: false, reason: 'team-refresh-click-failed: ' + String(e && e.message || e).slice(0, 140) } }
      return { ok: true, label, clicked: true }
    },
    dialogSnapshot: async () => page.evaluate(DIALOG_STATE_SOURCE),
    // Rows are the listitem BUTTONs of the DEEPEST [role=list] column (the
    // current Miller level — the structure dialogStateFrom reports rows for);
    // footer controls live after the listings in DOM order => last().
    dialogClickFolder: async (name) => { await dialogScope().locator('[role="list"]').last().getByRole('listitem').getByRole('button', { name, exact: true }).first().click({ timeout: 5000 }) },
    dialogClickButton: async (name) => { await dialogScope().getByRole('button', { name, exact: true }).last().click({ timeout: 5000 }) },
    fillComposer: async (text) => {
      const loc = page.locator('textarea, [contenteditable="true"]').first()
      if (!(await loc.isVisible().catch(() => false))) throw new FailClosed('e2-composer-missing')
      await loc.click(); await loc.fill(text); await page.keyboard.press('Enter')
    },
  }
}

export async function runLiveDriver (cfg, { log = (m) => process.stdout.write(m + '\n') } = {}) {
  if (!cfg.access || !cfg.smokeHost || !cfg.world || !cfg.out) throw new Error('--access --smoke-host --world --out are all required')
  if (!cfg.testWorkspace || !cfg.authorizedRoot) throw new Error('--test-workspace and --authorized-root are both required, explicit and absolute (review P6 — no defaults)')
  const { chromium } = loadPlaywright(cfg.testuse)
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
  const listChrome = () => { const r = []; for (const x of fs.readdirSync('/proc')) { if (/^\d+$/.test(x)) { try { const c = fs.readFileSync(`/proc/${x}/cmdline`, 'utf8'); if (c.includes(cfg.chrome)) r.push({ pid: Number(x), argv: c.split('\0').filter(Boolean) }) } catch { /* ignore */ } } } return r }
  const baseline = new Set(listChrome().map((p) => p.pid))
  let browser = null
  const tree = []
  const open = []
  const coreCfg = {
    accessPath: cfg.access, smokeHostPath: cfg.smokeHost, world: cfg.world, out: cfg.out,
    testWorkspace: cfg.testWorkspace, authorizedRoot: cfg.authorizedRoot, railMaxX: cfg.railMaxX,
    tickMs: readProductTickMs(path.resolve(new URL('.', import.meta.url).pathname, '../../..')),
  }
  try {
    browser = await chromium.launch({ executablePath: cfg.chrome, headless: true, chromiumSandbox: true, timeout: 30000 })
    const launched = listChrome().filter((p) => !baseline.has(p.pid))
    for (const p of launched) tree.push(p.pid)
    const mainProc = launched.find((p) => !(p.argv || []).some((a) => a.startsWith('--type='))) || launched[0]
    const argv = (mainProc && mainProc.argv) || []
    if (WEAK.some((w) => argv.some((a) => a === w || a.startsWith(w + '='))) || argv.some((a) => a.startsWith('--remote-debugging-port'))) throw new Error('launch argv guard FAILED')
    const out = await runDriverCore(coreCfg, {
      fs, realpathSync: fs.realpathSync, homedir: os.homedir, now: Date.now, sleep, log,
      tickMs: coreCfg.tickMs,
      openLeg: async (name, net) => {
        const ctx = await browser.newContext()
        open.push(ctx)
        const requestBindings = new Map()
        ctx.on('request', (r) => {
          const u = r.url(); if (!u.includes('/team-remote/')) return
          let post = null; try { post = r.postData() } catch { /* ignore */ }
          const env = parseRequestEnvelope(post)
          const entry = net.recordRequest({ leg: name, m: (u.split('/team-remote/')[1] || '').split('?')[0], rpcId: env?.rpcId ?? null, p: env?.params ?? null, t: Date.now() })
          requestBindings.set(r, entry)
        })
        ctx.on('response', async (res) => {
          const u = res.url(); if (!u.includes('/team-remote/')) return
          let text = ''
          try { text = (await res.body()).toString('utf8') } catch { /* ignore */ }
          // RAW wire text is the single response representation (frozen item
          // 1): recordResponse parses via parseServerResponseEnvelope — the
          // identical chain the offline fakes drive with real wire JSON.
          net.recordResponse({
            leg: name,
            m: (u.split('/team-remote/')[1] || '').split('?')[0],
            req: requestBindings.get(res.request()) ?? null,
            status: res.status(),
            t: Date.now(),
            bodyText: text,
          })
        })
        const page = await ctx.newPage()
        return { page: createPlaywrightPage(page, cfg), close: () => ctx.close() }
      },
    })
    out.env = {
      launchArgvScrubbed: scrubEvidence(argv.join(' ')).slice(0, 1200),
      weakFlagsFound: WEAK.filter((w) => argv.some((a) => a === w || a.startsWith(w + '='))),
      pipeTransport: { remoteDebuggingPipe: argv.includes('--remote-debugging-pipe'), remoteDebuggingPort: argv.some((a) => a.startsWith('--remote-debugging-port')) },
      chromeTree: tree.slice(),
    }
    // core wrote the record under the output dir already — rewrite once more so
    // the on-disk copy carries the env block too (values still scrubbed).
    try { fs.writeFileSync(path.join(cfg.out, 'dod20-driver-out.json'), JSON.stringify(redactOut(out), null, 1)) } catch { /* ignore */ }
    return { out, exitCode: summarize(out).exitCode }
  } finally {
    for (const c of open) { try { await c.close() } catch { /* ignore */ } }
    if (browser) { try { await browser.close() } catch { /* ignore */ } }
    await sleep(1500)
    for (const p of tree) { try { process.kill(p, 'SIGKILL') } catch { /* ignore */ } }
    const gone = tree.map((p) => ({ pid: p, alive: (() => { try { process.kill(p, 0); return true } catch { return false } })() }))
    log('chrome tree gone: ' + JSON.stringify(gone))
  }
}

// ── entry point (LIVE lane only under an explicit gate) ─────────────────────
const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)
if (invokedDirectly) {
  const argv = process.argv.slice(2)
  if (!argv.includes('--confirm-live')) {
    process.stderr.write('REFUSED: the DoD20 live lane is gated on external review (PR #55). Run `node --test .../dod20-ui-driver.test.mjs` and `node --test .../dod20-ui-driver-orchestration.test.mjs` for the offline suites. Pass --confirm-live ONLY in the carrier acceptance environment.\n')
    process.exit(2)
  }
  runLiveDriver(parseArgs(argv))
    .then(({ exitCode }) => process.exit(exitCode))
    .catch((e) => { process.stderr.write(scrubEvidence('unhandled: ' + String(e.stack || e)) + '\n'); process.exit(3) })
}
