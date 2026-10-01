#!/usr/bin/env node
/**
 * dod20-ui-driver.mjs — deterministic DDoD20 UI driver for the team-view
 * E1/E2/E3/E5 browser legs (test-driver repair, PR #55 side-branch).
 * NON-PRODUCT test tooling. The LIVE lane is gated on external review: this
 * file refuses to run without `--confirm-live`, and until then nothing here is
 * executed — the accepted evidence for this change is the OFFLINE test:
 *
 *   node --test tests/kits/team-view-sync-complete-e2e/dod20-ui-driver.test.mjs
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
 *      show the canonical SESSION ID (proven by probe3-after-rowclick.png)
 *      AND a FRESH team.getReadState must carry that exact sessionId (plus
 *      the expected relation in its body as corroboration). At most ONE
 *      re-click of the SAME located row; still unverified => NOT_RUN.
 *
 * LEG SEMANTICS are ported VERBATIM from dod20-driver3.mjs /
 * dod20-driver2.mjs (the wp9b-round frozen expectations; the kit header in
 * browser-smoke-host.mjs states E1–E5). The ONLY verdict-discipline change:
 * an assertion window the navigation never verifiably reached records
 * NOT_RUN (driver defect), never FAIL (v3's E2 mislabel). E4 stays an
 * explicit not_run entry (unit/E2E layer; no browser oracle is invented).
 *
 * AUTH HYGIENE: the raw launch URL is read ONLY from the world's private 0600
 * browser-access.json at runtime (never printed, never copied into output —
 * redactOut() strips launchUrl keys and scrubEvidence() masks token=, lt-v1
 * values and liveToken fields). Credential redaction reuses the merged kit module
 * live-token-redact.mjs. The two kit raw instance.log files flagged in the
 * evidence index each carry one dead-host launch URL and are NEVER staged.
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
import { redactLiveTokenFields, redactLiveTokenText } from './live-token-redact.mjs'

// ══════════════════════════════ PURE CORE (tested offline) ══════════════════

/** Minimal leaf-element tokenizer over a STATIC HTML STRING (fixtures only).
 *  A leaf = element with non-empty DIRECT text and no child elements.
 *  Returns [{tag, cls, role, text}] in document order. Geometry-free by
 *  design; the live lane feeds the same-shaped records from the real DOM. */
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

/** /team-remote wire envelope -> params (probe3 net sample shape). */
export function parseParams (post) {
  try {
    const j = JSON.parse(post)
    return j && j.payload ? j.payload.params ?? null : (j && j.params) || null
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

/** Detect the blocking workspace-directory dialog (shot-E2-ordinary-v3.png). */
export function detectBlockingModal (html) {
  const leaves = htmlLeaves(html)
  const title = leaves.find((l) => l.text === 'Select Workspace Directory')
  if (!title) return { blocking: false, title: null, rootLabel: null, folders: [], buttons: [] }
  return {
    blocking: true,
    title: title.text,
    rootLabel: leaves.find((l) => String(l.cls || '').includes('crumb'))?.text ?? null,
    folders: leaves.filter((l) => String(l.cls || '').includes('folderName')).map((l) => l.text),
    buttons: leaves.filter((l) => l.tag === 'button').map((l) => l.text),
  }
}

/** The dialog root label the live world uses for the host home directory
 *  (shot-E2-ordinary-v3.png breadcrumb). The authorized workspace must sit
 *  directly under it — anything else is a foreign root and fail-closed. */
export const DIALOG_HOME_LABEL = 'Home'

/** The fixed E2 dialog script under the AUTHORIZED-WORKSPACE ruling: the
 *  folder is the basename of the explicit `--test-workspace` ABSOLUTE path,
 *  matched EXACTLY (a same-prefix/suffix lookalike is a rejection, never a
 *  pick), under the EXACTLY authorized parent, and after Open the created
 *  session's workspace is re-verified from the world's projcache record
 *  (record.identity.cwd). Any miss is a fail-closed NOT_RUN reason. */
export function e2WorkspaceSteps ({ dialog, testWorkspace, resolvedHome = '/home/user' }) {
  if (!dialog || !dialog.blocking) return { ok: false, reason: 'workspace dialog not open (Select Workspace Directory never appeared)' }
  if (typeof testWorkspace !== 'string' || !testWorkspace.startsWith('/')) return { ok: false, reason: `--test-workspace must be an absolute authorized path (got ${JSON.stringify(testWorkspace)})` }
  const folder = testWorkspace.slice(testWorkspace.lastIndexOf('/') + 1)
  const parent = testWorkspace.slice(0, testWorkspace.lastIndexOf('/')) || '/'
  if (dialog.rootLabel !== DIALOG_HOME_LABEL) return { ok: false, reason: `dialog root label ${JSON.stringify(dialog.rootLabel)} is not the authorized '${DIALOG_HOME_LABEL}' — foreign root, never browse into it` }
  if (parent !== resolvedHome) return { ok: false, reason: `authorized workspace parent ${JSON.stringify(parent)} is not the dialog root ${JSON.stringify(resolvedHome)} — exact-path match required before Open` }
  if (!folder) return { ok: false, reason: 'authorized path carries no folder name' }
  if (!dialog.folders.includes(folder)) return { ok: false, reason: `authorized workspace folder '${folder}' not offered by the dialog (never pick a neighbor or near-miss folder)` }
  if (!dialog.buttons.includes('Open')) return { ok: false, reason: 'dialog offers no exact Open button' }
  return { ok: true, folder, steps: [`click-folder:${folder}`, 'click-open', 'assert-dialog-closed', `verify-session-cwd:${testWorkspace}`] }
}

/** Fail-closed BEFORE Open => leave the modal UNCONFIRMED via the asserted
 *  Cancel path (coordinator ruling: Cancel is acceptable, and closed). */
export function e2AbortSteps ({ dialog, failedBeforeOpen }) {
  if (!failedBeforeOpen || !dialog || !dialog.blocking) return { steps: [] }
  if (!dialog.buttons.includes('Cancel')) return { steps: ['assert-dialog-still-open-recorded'], note: 'no Cancel button offered — record and let the leg die fail-closed' }
  return { steps: ['click-cancel', 'assert-dialog-closed'] }
}

/** Post-action workspace state: the created session's projcache record
 *  (record.identity.cwd — signal verified read-only against the retained
 *  world, see fixtures) must equal the authorized path EXACTLY. A missing
 *  record is not a pass. */
export function assertSessionCwd ({ record, expectedPath }) {
  if (!record || !record.record || !record.record.identity) return { ok: false, reason: 'created session projcache record not found (cwd unverifiable — fail-closed)' }
  const cwd = record.record.identity.cwd
  if (cwd !== expectedPath) return { ok: false, reason: `created session cwd ${JSON.stringify(cwd)} does not equal the authorized workspace ${JSON.stringify(expectedPath)}` }
  return { ok: true, cwd }
}

/** SELECTION VERIFICATION: the frozen discipline is BOTH the selected header
 *  (the pane header shows the raw canonical session id) AND the observed
 *  network (a FRESH team.getReadState for exactly that sessionId, with the
 *  expected relation corroborated in a fresh response body). Either alone is
 *  NOT a verified selection. */
export function verifySelection ({ headerLeaves, freshRequests, freshBodies, expected, clickT = 0 }) {
  const headerOk = (headerLeaves || []).some((l) => l.text.includes(expected.sessionId))
  const req = (freshRequests || []).find((e) => e.kind === 'req' && e.m === 'team.getReadState' && e.t >= clickT && e.p && e.p.sessionId === expected.sessionId)
  const relationSeen = (freshBodies || []).some((s) => s.t >= clickT && s.body.includes('"' + expected.relation + '"'))
  const networkOk = !!req && relationSeen
  return { verified: headerOk && networkOk, headerOk, networkOk, relationSeen, reqSeq: req ? req.seq ?? null : null }
}

// ── leg oracles, ported VERBATIM from dod20-driver3.mjs / v2 (neither
//    weakened nor tightened) ────────────────────────────────────────────────

const reqsOf = (net, m) => (net || []).filter((e) => e.kind === 'req' && (!m || e.m === m))

/** E1 — fresh context, member-first cold reload window: preClick=0, first
 *  readState is the member, exactly ONE projection (on the root), 1 ledger,
 *  >=3 readStates, member relation face with its instance id. */
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

/** E3 — stable root page: >=7 readStates, deltas in the 2.7–3.3 s band
 *  (all but at most one), exactly-1 COLD projection, 1 ledger. */
export function evalE3 ({ net, expectedRootId, t0 }) {
  const win = (net || []).filter((e) => e.t >= t0)
  const rs = reqsOf(win, 'team.getReadState')
  const pj = reqsOf(win, 'team.getProjection')
  const lg = reqsOf(win, 'team.getLedgerPage')
  const deltas = []
  for (let i = 1; i < rs.length; i += 1) deltas.push(rs[i].t - rs[i - 1].t)
  const inBand = deltas.filter((d) => d >= 2700 && d <= 3300).length
  const verdict = (rs.length >= 7 && pj.length === 1 && lg.length === 1 && inBand >= Math.max(1, deltas.length - 1)) ? 'PASS' : 'FAIL'
  return { verdict, measured: { readStates: rs.length, deltasMs: deltas, deltasIn3sBand: inBand, projections: pj.length, ledger: lg.length, note: '2995-3008ms was the historical measurement; actual deltas reported, cadence band asserted' } }
}

/** E5 — one manual refresh click => exactly 1 ledger{afterSequence:0,
 *  limit:50}, >=1 readState reprobe, >=1 listRoots, 0 projections. */
export function evalE5 ({ after, expectedRootId }) {
  const lg = reqsOf(after, 'team.getLedgerPage')
  const pj = reqsOf(after, 'team.getProjection')
  const rs = reqsOf(after, 'team.getReadState')
  const lr = reqsOf(after, 'team.listRoots')
  const shape = lg.length > 0 && lg.every((e) => e.p && e.p.afterSequence === 0 && e.p.limit === 50)
  const verdict = (lg.length === 1 && shape && rs.length >= 1 && lr.length >= 1 && pj.length === 0) ? 'PASS' : 'FAIL'
  return { verdict, measured: { ledger: lg.length, ledgerShapeOk: shape, reprobes: rs.length, listRoots: lr.length, projectionsAfter: pj.length, note: '16ms latency was historical; latency reported, not required' } }
}

/** E2 — ordinary (UI-created) session: >=2 readStates in window, ZERO
 *  projections for the WHOLE leg, a none-relation body carrying the
 *  liveToken:null cell, >=1 listRoots. */
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

// ── credential hygiene ──────────────────────────────────────────────────────

/** Mask every credential-shaped substring on the way OUT of this process. */
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

// ══════════════════════════ LIVE LANE (gated on review) ═════════════════════
// Everything below only executes under an explicit `--confirm-live` in the
// REAL acceptance environment (the carrier world booted by the merged
// browser-smoke-host kit). Nothing in this section runs for the offline tests.

export const ALLOWED_TAB_NAMES = Object.freeze(['Team', '团队'])
export const ALLOWED_REFRESH_NAMES = Object.freeze(['刷新团队视图', 'Refresh team view'])
const WEAK = ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu-sandbox', '--disable-web-security', '--disable-features=Sandbox', '--disable-seccomp-filter-sandbox']

class FailClosed extends Error {
  constructor (reason, diag) { super(reason); this.name = 'FailClosed'; this.diag = diag ?? null }
}

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
    // The EXPLICIT AUTHORIZED test workspace for this round (coordinator
    // ruling 2026-10-01): an absolute path whose parent is the dialog's Home
    // root (/home/user in the carrier env — its listing is visible in
    // shot-E2-ordinary-v3.png as bin / deepseek-harness / workspace). Exact
    // name + exact parent match before Open; post-Open the created session's
    // record.identity.cwd is re-verified against it.
    testWorkspace: get('test-workspace', '/home/user/workspace'),
    railMaxX: Number(get('rail-max-x', '260')),
  }
}

/** Read the canonical title map, READ-ONLY, from the world's projcache. */
export function readProjcacheTitles (worldDir) {
  const dir = path.join(worldDir, 'storages', 'session_projcache', 'sessions')
  const map = {}
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.json')) continue
    try {
      const rec = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'))
      map[f.slice(0, -'.json'.length)] = rec?.record?.rows?.title?.val ?? null
    } catch { map[f.slice(0, -5)] = null }
  }
  return map
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

export function loadPlaywright (testuseDir) {
  const req = createRequire(path.join(testuseDir, 'package.json'))
  return req('playwright')
}

export async function runLiveDriver (cfg, { log = (m) => process.stdout.write(m + '\n') } = {}) {
  if (!cfg.access || !cfg.smokeHost || !cfg.world || !cfg.out) throw new Error('--access --smoke-host --world --out are all required')
  const { chromium } = loadPlaywright(cfg.testuse)
  // The private 0600 record is read here and NOWHERE else; its value goes
  // straight into the launch, never into out/log (redactOut strips launchUrl).
  const access = JSON.parse(fs.readFileSync(cfg.access, 'utf8'))
  const launchUrl = access.launchUrl
  if (typeof launchUrl !== 'string' || !launchUrl.includes('?token=')) throw new Error('access record has no launchUrl with a token — refusing')
  const host = JSON.parse(fs.readFileSync(cfg.smokeHost, 'utf8'))
  const projcache = readProjcacheTitles(cfg.world)
  const targets = canonicalTargets({ projcache, rootId: host.t1, memberIds: [host.t1MemberSession] })
  if (!targets.ok) { log(scrubEvidence('FATAL ' + targets.reason)); return { fatal: targets.reason } }

  const out = { ok: false, startedAt: new Date().toISOString(), cfg: { accessRecordPath: cfg.access, smokeHost: cfg.smokeHost, world: cfg.world, testWorkspace: cfg.testWorkspace, railMaxX: cfg.railMaxX }, env: {}, net: [], bodies: {}, legs: {}, errors: [] }
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
  let seq = 0
  const reqs = (leg, m) => out.net.filter((e) => e.leg === leg && e.kind === 'req' && (!m || e.m === m))
  const attach = (ctx, leg) => {
    ctx.on('request', (r) => {
      const u = r.url(); if (!u.includes('/team-remote/')) return
      let post = null; try { post = r.postData() } catch { /* ignore */ }
      out.net.push({ seq: ++seq, leg, kind: 'req', t: Date.now(), m: (u.split('/team-remote/')[1] || '').split('?')[0], p: parseParams(post) })
    })
    ctx.on('response', async (res) => {
      const u = res.url(); if (!u.includes('/team-remote/')) return
      const key = (u.split('/team-remote/')[1] || '').split('?')[0]
      try {
        const b = await res.body()
        const s = out.bodies[leg + ':' + key] = out.bodies[leg + ':' + key] || []
        if (s.length < 12) s.push({ t: Date.now(), body: b.toString('utf8', 0, 640) })
      } catch { /* ignore */ }
    })
  }
  const listChrome = () => { const r = []; for (const x of fs.readdirSync('/proc')) { if (/^\d+$/.test(x)) { try { const c = fs.readFileSync(`/proc/${x}/cmdline`, 'utf8'); if (c.includes(cfg.chrome)) r.push({ pid: Number(x), argv: c.split('\0').filter(Boolean) }) } catch { /* ignore */ } } } return r }

  const leavesOf = async (page) => page.evaluate(railCollectorSource(cfg.railMaxX))
  const railLeaves = (leaves) => leaves.filter((l) => l.region === 'rail')
  const mainLeaves = (leaves) => leaves.filter((l) => l.region === 'main')

  async function realClickLeaf (page, leaf) {
    await page.mouse.click(leaf.x + Math.min(40, leaf.w / 2), leaf.y + leaf.h / 2)
  }

  /** THE fixed navigation (v1/v3 killer steps 1–3 + exact locate + verify). */
  async function navigate (page, leg, label, expected) {
    const steps = []
    await page.goto(launchUrl, { waitUntil: 'load', timeout: 60000 })
    await page.waitForTimeout(4500)
    // 1) notice, if present
    const notice = page.getByRole('button', { name: 'Continue' }).first()
    if (await notice.isVisible().catch(() => false)) {
      const box = await notice.boundingBox().catch(() => null)
      if (!box) throw new FailClosed('notice-present-but-undismissable')
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
      await page.waitForTimeout(1500)
      if (await page.getByRole('button', { name: 'Continue' }).first().isVisible().catch(() => false)) throw new FailClosed('notice-still-visible-after-click')
      steps.push('dismiss-notice')
    }
    // 2) expand the Ungrouped group — THE probe3:50 step v3 lost. Skipped
    //    only when rows already rendered (the header is a toggle); if after a
    //    click no row renders, fail closed — locating would be hopeless.
    let leaves = railLeaves(await leavesOf(page))
    steps.push('expand-ungrouped-group')
    if (groupCollapsed(leaves)) {
      const header = locateTitle(leaves, 'Ungrouped', { exclude: [] }).status === 'FOUND'
        ? locateTitle(leaves, 'Ungrouped', { exclude: [] }).leaf
        : locateTitle(leaves, 'Ungrouped', { exclude: [] }).matches?.[0] || leaves.find((l) => l.text === 'Ungrouped')
      if (!header) throw new FailClosed('ungrouped-group-header-missing')
      await realClickLeaf(page, header)
      await page.waitForTimeout(1500)
      leaves = railLeaves(await leavesOf(page))
      if (groupCollapsed(leaves)) throw new FailClosed('ungrouped-still-collapsed-after-click')
    }
    // 3) the overflow button, while visible (post-expansion only)
    let guard = 0
    while (overflowPending(leaves) && guard < 3) {
      const btn = leaves.find((l) => l.tag === 'button' && /^Show \d+ more sessions$/.test(l.text))
      await realClickLeaf(page, btn)
      await page.waitForTimeout(1200)
      leaves = railLeaves(await leavesOf(page))
      steps.push('expand-overflow')
      guard += 1
    }
    if (!expected) return { steps, leaves }
    // 4) exact canonical-title locate, fail-closed
    await page.mouse.move(cfg.railMaxX + 400, 400) // park the mouse (anti-tooltip)
    await page.waitForTimeout(300)
    leaves = railLeaves(await leavesOf(page))
    const hit = locateTitle(leaves, expected.title, { exclude: ['Ungrouped'] })
    if (hit.status !== 'FOUND') throw new FailClosed(`locate-${hit.status.toLowerCase()}`, { title: expected.title, hits: hit.matches?.length ?? 0, railRowCount: leaves.filter((l) => l.cls.includes('W0d-vW_title') && l.text !== 'Ungrouped').length })
    // 5) click ONCE, then the BOTH header+network verification (one same-row
    //    retry at most; a different target is NEVER tried)
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      const clickT = Date.now()
      await realClickLeaf(page, hit.leaf)
      await page.waitForTimeout(800)
      let verified = null
      const t0 = Date.now()
      while (Date.now() - t0 < 8000) {
        verified = verifySelection({
          headerLeaves: mainLeaves(await leavesOf(page)).filter((l) => l.y < 120),
          freshRequests: reqs(leg),
          freshBodies: out.bodies[leg + ':team.getReadState'] || [],
          expected,
          clickT,
        })
        if (verified.verified) break
        await sleep(400)
      }
      out.legs[label] = out.legs[label] || {}
      out.legs[label]['verifyAttempt' + attempt] = { ...verified, clickT }
      if (verified.verified) return { steps, leaves, clickT }
      if (attempt === 1) await page.screenshot({ path: path.join(cfg.out, `shot-${label}-verify-anomaly.png`) }).catch(() => {})
    }
    throw new FailClosed('selection-unverified-after-one-same-row-retry', out.legs[label])
  }

  let browser = null
  const tree = []
  const open = []
  const legWrap = async (name, fn) => {
    out.legs[name] = out.legs[name] || {}
    try { await fn(); if (!out.legs[name].verdict) out.legs[name].verdict = 'NOT_RUN'; if (!out.legs[name].reason) out.legs[name].reason = 'leg ended without an assertion window' } catch (e) {
      // Driver-side failure = NOT_RUN (a driver defect is NOT a product FAIL —
      // the v2/v3 mislabels this). Never a partial-FAIL on an unreached window.
      out.legs[name].verdict = 'NOT_RUN'
      out.legs[name].reason = e instanceof FailClosed ? `fail-closed: ${e.message}` : `driver-error: ${String(e.message || e).slice(0, 300)}`
      if (e instanceof FailClosed && e.diag) out.legs[name].diag = e.diag
      log(scrubEvidence(`[${name}] ${out.legs[name].reason}`))
    }
  }
  try {
    fs.mkdirSync(cfg.out, { recursive: true })
    const baseline = new Set(listChrome().map((p) => p.pid))
    browser = await chromium.launch({ executablePath: cfg.chrome, headless: true, chromiumSandbox: true, timeout: 30000 })
    const launched = listChrome().filter((p) => !baseline.has(p.pid))
    for (const p of launched) tree.push(p.pid)
    const mainProc = launched.find((p) => !(p.argv || []).some((a) => a.startsWith('--type='))) || launched[0]
    const argv = (mainProc && mainProc.argv) || []
    out.env = {
      launchArgvScrubbed: scrubEvidence(argv.join(' ')).slice(0, 1200),
      weakFlagsFound: WEAK.filter((w) => argv.some((a) => a === w || a.startsWith(w + '='))),
      pipeTransport: { remoteDebuggingPipe: argv.includes('--remote-debugging-pipe'), remoteDebuggingPort: argv.some((a) => a.startsWith('--remote-debugging-port')) },
      chromeTree: tree.slice(),
    }
    if (out.env.weakFlagsFound.length || out.env.pipeTransport.remoteDebuggingPort) throw new Error('launch argv guard FAILED')

    // ── E1: fresh context; preClick=0; member-first; reload window ──────────
    await legWrap('E1', async () => {
      const ctx = await browser.newContext(); attach(ctx, 'E1'); open.push(ctx)
      const page = await ctx.newPage()
      const beforeNav = out.net.filter((e) => e.leg === 'E1').length
      const nav = await navigate(page, 'E1', 'E1', { sessionId: targets.targets.member.id, title: targets.targets.member.title, relation: 'team-member' })
      const preClick = out.net.filter((e) => e.leg === 'E1' && e.kind === 'req').length - beforeNav
      out.legs.E1.navSteps = nav.steps
      out.legs.E1.preClickNavReqs = preClick // nav clicks must not produce /team-remote traffic
      await page.waitForTimeout(2500)
      const lt0 = Date.now()
      await page.reload({ waitUntil: 'load', timeout: 60000 })
      const n2 = page.getByRole('button', { name: 'Continue' }).first()
      if (await n2.isVisible().catch(() => false)) { const b = await n2.boundingBox(); await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2); await page.waitForTimeout(1500) }
      await page.waitForTimeout(10000)
      await page.screenshot({ path: path.join(cfg.out, 'shot-E1-member-pure.png') }).catch(() => {})
      Object.assign(out.legs.E1, evalE1({
        net: out.net.filter((e) => e.leg === 'E1'),
        bodies: out.bodies['E1:team.getReadState'] || [],
        expectedMember: { sessionId: targets.targets.member.id, instance: host.t1MemberInstance },
        expectedRootId: host.t1, preClick, t0: lt0,
      }))
    })

    // ── E3+E5: fresh context; root cold round, >=6 ticks, manual refresh ────
    await legWrap('E3E5', async () => {
      const ctx = await browser.newContext(); attach(ctx, 'E3'); open.push(ctx)
      const page = await ctx.newPage()
      const nav = await navigate(page, 'E3', 'E3E5', { sessionId: targets.targets.root.id, title: targets.targets.root.title, relation: 'team-root' })
      out.legs.E3E5.navSteps = nav.steps
      const w0 = Date.now()
      await page.waitForTimeout(10000)
      const tabHits = mainLeaves(await leavesOf(page)).filter((l) => ALLOWED_TAB_NAMES.includes(l.text))
      out.legs.E3E5.teamTabHits = tabHits.length
      if (tabHits.length === 1) { await realClickLeaf(page, tabHits[0]); await page.waitForTimeout(1200) }
      await page.waitForTimeout(6 * 3000 + 1000)
      await page.screenshot({ path: path.join(cfg.out, 'shot-E3-root-team.png') }).catch(() => {})
      out.legs.E3E5.E3 = evalE3({ net: out.net.filter((e) => e.leg === 'E3'), expectedRootId: host.t1, t0: w0 })
      const rfHits = mainLeaves(await leavesOf(page)).filter((l) => l.tag === 'button' && ALLOWED_REFRESH_NAMES.includes(l.text))
      if (rfHits.length !== 1) {
        out.legs.E3E5.E5 = { verdict: 'NOT_RUN', reason: rfHits.length === 0 ? 'refresh-control-not-found (exact-name allowlist, zero hits)' : 'refresh-control-ambiguous (exact-name allowlist, multiple hits — fail-closed)' }
        await page.screenshot({ path: path.join(cfg.out, 'shot-E5-control-anomaly.png') }).catch(() => {})
      } else {
        const t5 = Date.now()
        await realClickLeaf(page, rfHits[0])
        await page.waitForTimeout(6500)
        await page.screenshot({ path: path.join(cfg.out, 'shot-E5-refresh.png') }).catch(() => {})
        const after = out.net.filter((e) => e.leg === 'E3' && e.kind === 'req' && e.t >= t5)
        const ledRes = out.net.filter((e) => e.leg === 'E3' && e.kind === 'res' && e.m === 'team.getLedgerPage' && e.t > t5)[0]
        out.legs.E3E5.E5 = { ...evalE5({ after, expectedRootId: host.t1 }), measuredExtra: { ledgerResponseLatencyMs: ledRes ? ledRes.t - t5 : null } }
      }
    })

    // ── E2: fresh context; UI-created ordinary session (zero-state) ─────────
    await legWrap('E2', async () => {
      const ctx = await browser.newContext(); attach(ctx, 'E2'); open.push(ctx)
      const page = await ctx.newPage()
      const nav = await navigate(page, 'E2', 'E2', null)
      out.legs.E2.navSteps = nav.steps
      // 'New Session' is a rail chrome control, located by EXACT text — not a
      // session row, so locateTitle-with-exclude does not apply here.
      const rail = railLeaves(await leavesOf(page))
      const ns = rail.filter((l) => l.text === 'New Session')
      if (ns.length !== 1) throw new FailClosed('new-session-control-not-unique', { hits: ns.length })
      await realClickLeaf(page, ns[0])
      // The proven blocker: the Select Workspace Directory dialog.
      let dialog = null
      for (let w = 0; w < 12; w += 1) {
        await page.waitForTimeout(500)
        const probe = detectBlockingModal(await page.evaluate('document.body.innerText'))
        if (probe.blocking) { dialog = probe; break }
      }
      if (!dialog) {
        // v1 body text shows the 'Choose workspace' affordance BEFORE a dialog.
        const wsBtn = mainLeaves(await leavesOf(page)).filter((l) => l.text === 'Choose workspace')
        if (wsBtn.length === 1) {
          await realClickLeaf(page, wsBtn[0])
          for (let w = 0; w < 12; w += 1) {
            await page.waitForTimeout(500)
            const probe = detectBlockingModal(await page.evaluate('document.body.innerText'))
            if (probe.blocking) { dialog = probe; break }
          }
        }
      }
      const plan = e2WorkspaceSteps({ dialog: dialog || { blocking: false }, testWorkspace: cfg.testWorkspace, resolvedHome: fs.realpathSync(os.homedir()) })
      if (!plan.ok) {
        // Fail-closed BEFORE Open: leave the modal UNCONFIRMED via Cancel,
        // asserted closed (coordinator ruling — Cancel is acceptable).
        const abort = e2AbortSteps({ dialog: dialog || { blocking: false }, failedBeforeOpen: true })
        for (const step of abort.steps) {
          if (step === 'click-cancel') {
            const cancel = mainLeaves(await leavesOf(page)).filter((l) => l.tag === 'button' && l.text === 'Cancel')
            if (cancel.length === 1) await realClickLeaf(page, cancel[0])
          }
          if (step === 'assert-dialog-closed') {
            for (let w = 0; w < 10; w += 1) {
              await page.waitForTimeout(400)
              if (!detectBlockingModal(await page.evaluate('document.body.innerText')).blocking) break
            }
          }
        }
        await page.screenshot({ path: path.join(cfg.out, 'shot-E2-workspace-anomaly.png') }).catch(() => {})
        throw new FailClosed('e2-workspace-dialog: ' + plan.reason)
      }
      out.legs.E2.workspacePlan = plan.steps
      const all = await leavesOf(page)
      const folder = mainLeaves(all).filter((l) => l.text === plan.folder)
      if (folder.length !== 1) throw new FailClosed('e2-folder-not-unique', { hits: folder.length })
      await realClickLeaf(page, folder[0])
      const openBtn = mainLeaves(await leavesOf(page)).filter((l) => l.tag === 'button' && l.text === 'Open')
      if (openBtn.length !== 1) throw new FailClosed('e2-open-button-not-unique', { hits: openBtn.length })
      const openT = Date.now()
      await realClickLeaf(page, openBtn[0])
      for (let w = 0; w < 10; w += 1) {
        await page.waitForTimeout(500)
        if (!detectBlockingModal(await page.evaluate('document.body.innerText')).blocking) break
        if (w === 9) throw new FailClosed('e2-dialog-did-not-close')
      }
      const input = page.locator('textarea, [contenteditable="true"]').first()
      if (!await input.isVisible().catch(() => false)) throw new FailClosed('e2-composer-missing')
      await input.click(); await input.fill('ping'); await page.keyboard.press('Enter')
      const composerT = Date.now()
      // POST-ACTION WORKSPACE STATE (coordinator ruling): the created
      // session's workspace must equal the AUTHORIZED path. Signal source:
      // the world's projcache record <world>/storages/session_projcache/
      // sessions/<newSessionId>.json -> record.identity.cwd (field shape
      // verified read-only against the retained world; see fixtures). The
      // new session id comes from the leg's own fresh getReadState traffic.
      const freshIds = reqs('E2', 'team.getReadState').filter((e) => e.t >= openT && e.p && e.p.sessionId).map((e) => e.p.sessionId)
      const newId = freshIds.find((id) => id !== targets.targets.root.id && id !== targets.targets.member.id) || null
      let cwdCheck = { ok: false, reason: 'no fresh readState identified the created session' }
      if (newId) {
        const recPath = path.join(cfg.world, 'storages', 'session_projcache', 'sessions', newId + '.json')
        for (let w = 0; w < 40; w += 1) {
          if (fs.existsSync(recPath)) break
          await sleep(500)
        }
        let rec = null
        try { rec = JSON.parse(fs.readFileSync(recPath, 'utf8')) } catch { rec = null }
        cwdCheck = assertSessionCwd({ record: rec, expectedPath: fs.realpathSync(cfg.testWorkspace) })
        cwdCheck.signal = 'session_projcache record.identity.cwd'
        cwdCheck.sessionId = newId
      }
      out.legs.E2.workspaceCwdCheck = cwdCheck
      if (!cwdCheck.ok) throw new FailClosed('e2-workspace-cwd: ' + cwdCheck.reason, cwdCheck)
      await page.waitForTimeout(7000)
      const w0 = Date.now()
      const tabHits = mainLeaves(await leavesOf(page)).filter((l) => ALLOWED_TAB_NAMES.includes(l.text))
      if (tabHits.length === 1) { await realClickLeaf(page, tabHits[0]); await page.waitForTimeout(1200) }
      await page.waitForTimeout(9000)
      await page.screenshot({ path: path.join(cfg.out, 'shot-E2-ordinary.png') }).catch(() => {})
      const legNet = out.net.filter((e) => e.leg === 'E2' && e.kind === 'req')
      out.legs.E2 = { ...out.legs.E2, ...evalE2({ net: { window: legNet.filter((e) => e.t >= w0), wholeLeg: legNet }, bodies: out.bodies['E2:team.getReadState'] || [], t0: w0 }) }
    })

    out.legs.E4 = e4NotRun()
    out.ok = true
  } catch (e) {
    out.errors.push('fatal: ' + String(e.message || e).slice(0, 500))
  } finally {
    for (const c of open) { try { await c.close() } catch { /* ignore */ } }
    if (browser) { try { await browser.close() } catch { /* ignore */ } }
    await sleep(1500)
    for (const p of tree) { try { process.kill(p, 'SIGKILL') } catch { /* ignore */ } }
    out.env.processGone = tree.map((p) => ({ pid: p, alive: (() => { try { process.kill(p, 0); return true } catch { return false } })() }))
    out.finishedAt = new Date().toISOString()
    fs.writeFileSync(path.join(cfg.out, 'dod20-driver-out.json'), JSON.stringify(redactOut(out), null, 1))
    log('driver done ok=' + out.ok + ' legs=' + JSON.stringify(Object.fromEntries(Object.entries(out.legs).map(([k, v]) => [k, v.verdict || v.E3?.verdict || 'partial']))))
  }
  return out
}

// ── entry point (LIVE lane only under an explicit gate) ─────────────────────
const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)
if (invokedDirectly) {
  const argv = process.argv.slice(2)
  if (!argv.includes('--confirm-live')) {
    process.stderr.write('REFUSED: the DoD20 live lane is gated on external review (PR #55). Run `node --test .../dod20-ui-driver.test.mjs` for the offline suite. Pass --confirm-live ONLY in the carrier acceptance environment.\n')
    process.exit(2)
  }
  runLiveDriver(parseArgs(argv)).then((o) => process.exit(o && o.fatal ? 3 : 0)).catch((e) => { process.stderr.write(scrubEvidence('unhandled: ' + String(e.stack || e)) + '\n'); process.exit(3) })
}
