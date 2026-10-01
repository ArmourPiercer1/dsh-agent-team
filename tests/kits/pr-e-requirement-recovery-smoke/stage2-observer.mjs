#!/usr/bin/env node
/**
 * stage2-observer.mjs — PR-E stage-2 READ-ONLY UI observer (PR #54 stage-2).
 *
 * PURPOSE: during the kit's `--ui-observe` hold, view the ONE pending
 * recovery-class control request in the REAL Team UI and prove, field by
 * field, that the screen renders the SAME durable facts the kit holds:
 *   (a) the visible requestId === --rid;
 *   (b) the rendered FULL wire digest === the expected digest (from the SAME
 *       durable request fact, never hand-typed twice) and matches
 *       ^sha256:[0-9a-f]{64}$;
 *   (c) the payload <pre> JSON-parses deep-equal to --payload-file;
 *   (d) in a narrow viewport pass the values stay FULLY READABLE (digest
 *       computed white-space normal per the PR #56 frozen batch #3 CSS pin;
 *       payload pre wraps (pre-wrap per TeamLedger.module.css); no ellipsis;
 *       DOM text length equals the full expected length; no overflow clip).
 * ANY mismatch/missing field is FAIL-CLOSED: non-zero exit, NOTHING written
 * to the marker dir. Only after ALL checks pass an ATOMIC `marker.json`
 * (tmp + rename, mode 0600) lands: { requestId, digest, claimed, ts } with
 * claimed = 'observed-pending' — the lawful completion signal (FIX-4
 * coordinator ruling), taken from the kit's EXPORTED closed set UI_CLAIMS,
 * never a remembered literal. The marker is a HINT ONLY — the kit re-verifies
 * durable truth itself (ui-observe.mjs verifyUiTruth).
 *
 * READ-ONLY GUARANTEE: navigation + observation only. The single sanctioned
 * click is the Team tab activation the coordinator pinned (2026-10-02):
 * scope `[data-conversation-tabs][role=tablist]` -> the unique
 * button[role=tab] whose accessible label is EXACTLY 'Team'/'团队' INSIDE the
 * tablist (never any-leaf text — the 55 live run counted E3.teamTabHits=2
 * because a conversation tab label and the TeamDock label span both matched;
 * reusing that bad selector is forbidden). After activation the script
 * ASSERTS aria-selected='true' on that tab AND [data-team-view] visible.
 * It NEVER clicks allow/deny, refresh, filters, or any other control.
 *
 * SELECTOR PROVENANCE (verified from actual client source, NOT guessed —
 * this lane's base 6be8e95b carries the panel shell WITHOUT the digest/
 * payload fields; the reviewed-payload surface is the PR #56 client line,
 * which is what the stage-2 observation observes):
 *  - packages/client/src/ui/TeamLedger.tsx @ origin/task/pre-alpha3-pr56-client-panel
 *    (aa677a3457fae353ab18957d4a34b39b2453fb5f):
 *      panel root               L484-487  [data-ledger-resolve-bar][data-request-id][data-control-surface]
 *      visible requestId dd     L576-579  [data-control-detail-request-id] dd
 *      render mode              L584      [data-control-detail-render-mode][data-render-mode]
 *      full wire digest         L593-598  [data-control-detail-digest][data-digest-source="ledger-wire"] dd.controlDigestValue
 *      full reviewPayload pre   L606-613  [data-control-detail-payload] dd > pre.controlPayload
 *                                         (React TEXT NODE = JSON.stringify(value, null, 2), L160-167)
 *      allow / deny buttons     L628-641  data-ledger-resolve-allow / data-ledger-resolve-deny — NEVER CLICKED
 *  - TeamLedger.module.css @ same ref: `.controlField dd` ellipsis trio
 *    L298-306; `.controlField dd.controlDigestValue` white-space:normal
 *    (0,1,2 override, frozen batch #3) L339-344; `.controlPayload`
 *    white-space:pre-wrap + overflow:auto L347-360.
 *  - TestUse ConversationSession.tsx @ 46a7f68b09 L143-154:
 *    div[role=tablist][data-conversation-tabs] > button[role=tab][aria-selected].
 *  - packages/client/src/ui/TeamView.tsx @ 6be8e95b: div[data-team-view]
 *    L1295; section[data-team-section="ledger"] L1366 -> <TeamLedger> L1368.
 *  - packages/client/src/plugin/team-mount-core.ts @ 6be8e95b: the
 *    conversation.view slot id 'team', label t('view.team') L1219-1228;
 *    locales.ts 'view.team' = '团队' L292 / 'Team' L551.
 *
 * PRIVACY: the private 0600 access record (--access, the kit's
 * browser-access.json inside tests/homes/<world>) NEVER enters evidence: the
 * evidence writer scans every artifact for the launch token AND any
 * `?token=`-style URL query BEFORE writing anything (typed refusal). The
 * page URL is never recorded — only the access record's `origin`.
 *
 * PLAYWRIGHT: imported via createRequire over the fixed TestUse apps/web
 * PUBLIC entry (`<testuse>/apps/web/package.json` → 'playwright' — the
 * package that declares it). NO hardcoded .pnpm paths, NO installs/aliases.
 * `--testuse <dir>` overrides the TestUse tree root; the default resolves
 * through tests/paths.mjs (the single path source).
 *
 * EXIT: 0 = all checks passed + marker written; 2 = a fail-closed validation/
 * comparison refusal (no marker); 1 = infrastructure error (no marker).
 *
 * Offline contract tests (host-free, jsdom mirrors of the pins above):
 *   node --test tests/kits/pr-e-requirement-recovery-smoke/stage2-observer.test.mjs
 */

import {
  constants, closeSync, existsSync, fstatSync, lstatSync, mkdirSync,
  openSync, readFileSync, renameSync, rmSync, writeSync,
} from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
// THE approved contract (read-only use — the kit owns the claim set, the
// canonicalJson/sha256 single implementation and the marker reader):
import { UI_CLAIMS, reviewPayloadDigestOf } from './ui-observe.mjs'
import { findTestRepoRoot, TEST_USE_REL } from '../../paths.mjs'

// ── constants ───────────────────────────────────────────────────────────────

/** The lawful completion signal — looked up FROM the kit's exported CLOSED
 *  SET (FIX-4: 'observed-pending'); refuses to load if the set ever drops it
 *  (fail fast, never a remembered literal). */
export const OBSERVED_PENDING_CLAIM = UI_CLAIMS.find((claim) => claim === 'observed-pending')
if (typeof OBSERVED_PENDING_CLAIM !== 'string') {
  throw new Error('stage2-observer: UI_CLAIMS (ui-observe.mjs) no longer carries observed-pending — refusing to load')
}

/** The Team tab's accessible labels — team-mount-core.ts L1226 registers
 *  conversation.view id 'team' with label t('view.team'); locales.ts L292/L551
 *  bind it to 团队/Team. Exact-label matching ONLY (scoped to the tablist). */
export const TEAM_TAB_LABELS = Object.freeze(['Team', '团队'])

const DIGEST_RE = /^sha256:[0-9a-f]{64}$/
const RID_RE = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/
const VIEWPORT_RE = /^([1-9][0-9]{1,4})x([1-9][0-9]{1,4})$/
/** The narrow pass viewport (contract (d)): the real panel ellipsis trio +
 *  the PR #56 frozen-batch-3 digest override are exactly what a narrow panel
 *  stresses; 380px is below the CSS module's narrow-panel test width. */
const NARROW_WIDTH = 380
const BOOT_TIMEOUT_MS = 60_000
const OBSERVE_TIMEOUT_MS = 45_000

export class ObserverError extends Error {
  constructor(code, message) {
    super(message)
    this.name = 'ObserverError'
    this.code = code
  }
}

// ── CLI ─────────────────────────────────────────────────────────────────────

const CLI_FLAGS = Object.freeze(['access', 'rid', 'digest', 'digest-file', 'payload-file', 'evidence', 'viewport', 'marker-dir', 'testuse'])
const CLI_REQUIRED = Object.freeze(['access', 'rid', 'payload-file', 'evidence', 'viewport', 'marker-dir'])

function flagCode(name) {
  return `CLI_MISSING_${name.toUpperCase().replace(/-/g, '_')}`
}

function requireRegularFile(path, label) {
  if (!existsSync(path)) throw new ObserverError('CLI_MISSING_FILE', `${label} does not exist: ${path}`)
  const st = lstatSync(path)
  if (st.isSymbolicLink() || !st.isFile()) {
    throw new ObserverError('CLI_NOT_REGULAR_FILE', `${label} must be an existing REGULAR file (no symlink, no dir): ${path}`)
  }
  return path
}

function requireOrMakeDir(path, label) {
  if (existsSync(path)) {
    const st = lstatSync(path)
    if (st.isSymbolicLink() || !st.isDirectory()) {
      throw new ObserverError('CLI_NOT_DIR', `${label} must be a real directory: ${path}`)
    }
    return path
  }
  mkdirSync(path, { recursive: true })
  return path
}

export function parseCli(argv) {
  const values = new Map()
  for (let i = 0; i < argv.length; i += 1) {
    const token = String(argv[i])
    if (!token.startsWith('--')) throw new ObserverError('CLI_STRAY_ARGUMENT', `unexpected positional argument: ${token}`)
    const name = token.slice(2)
    if (!CLI_FLAGS.includes(name)) throw new ObserverError('CLI_UNKNOWN_FLAG', `unknown flag: --${name}`)
    if (values.has(name)) throw new ObserverError('CLI_DUPLICATE_FLAG', `duplicate flag: --${name}`)
    const value = argv[i + 1]
    if (typeof value !== 'string' || value === '' || value.startsWith('--')) {
      throw new ObserverError(flagCode(name), `--${name} requires a value`)
    }
    values.set(name, value)
    i += 1
  }
  for (const name of CLI_REQUIRED) {
    if (!values.has(name)) throw new ObserverError(flagCode(name), `--${name} is required`)
  }
  const hasDigest = values.has('digest')
  const hasDigestFile = values.has('digest-file')
  if (hasDigest && hasDigestFile) throw new ObserverError('CLI_DIGEST_AMBIGUOUS', 'exactly one of --digest / --digest-file (the digest must come from the durable request, never twice)')
  if (!hasDigest && !hasDigestFile) throw new ObserverError('CLI_DIGEST_MISSING', 'one of --digest / --digest-file is required')
  const rid = values.get('rid')
  if (!RID_RE.test(rid)) throw new ObserverError('CLI_RID_SHAPE', `--rid must match ${RID_RE}: ${rid}`)
  const digestRaw = hasDigest ? values.get('digest') : null
  if (digestRaw !== null && !DIGEST_RE.test(digestRaw)) {
    throw new ObserverError('CLI_DIGEST_SHAPE', `--digest must match ^sha256:[0-9a-f]{64}$: ${digestRaw.slice(0, 24)}…`)
  }
  const viewportMatch = VIEWPORT_RE.exec(values.get('viewport'))
  if (viewportMatch === null) throw new ObserverError('CLI_VIEWPORT', `--viewport must be <WxH> (digits): ${values.get('viewport')}`)
  const viewport = { width: Number(viewportMatch[1]), height: Number(viewportMatch[2]) }
  const opts = {
    accessPath: requireRegularFile(values.get('access'), '--access'),
    rid,
    digestRaw,
    digestFile: hasDigestFile ? requireRegularFile(values.get('digest-file'), '--digest-file') : null,
    payloadFile: requireRegularFile(values.get('payload-file'), '--payload-file'),
    evidenceDir: requireOrMakeDir(resolve(values.get('evidence')), '--evidence'),
    markerDir: requireOrMakeDir(resolve(values.get('marker-dir')), '--marker-dir'),
    viewport,
    narrow: { width: Math.min(NARROW_WIDTH, viewport.width), height: viewport.height },
    testuse: values.has('testuse') ? resolve(values.get('testuse')) : null,
  }
  return opts
}

// ── private access record (0600 ONLY — the kit's browser-access.json) ───────

export function validatePrivateAccessFile(path) {
  let st
  try {
    st = lstatSync(path) // lstat: a symlinked leaf must surface AS a symlink, never be followed
  } catch {
    throw new ObserverError('S2O_ACCESS_MISSING', `access record does not exist: ${path}`)
  }
  if (st.isSymbolicLink()) throw new ObserverError('S2O_ACCESS_SYMLINK', `the access record is a symlink — refused, never followed (no symlink escape from the world): ${path}`)
  if (!st.isFile()) throw new ObserverError('S2O_ACCESS_NOT_FILE', `the access record must be a regular file: ${path}`)
  if ((st.mode & 0o777) !== 0o600) {
    throw new ObserverError('S2O_ACCESS_MODE', `the private access record must be mode 0600, got 0o${(st.mode & 0o777).toString(8)}: ${path}`)
  }
  let parsed
  try {
    parsed = JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    throw new ObserverError('S2O_ACCESS_NOT_JSON', 'the access record is not valid JSON')
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)
    || typeof parsed.launchUrl !== 'string' || !/^https?:\/\//.test(parsed.launchUrl)
    || typeof parsed.origin !== 'string' || parsed.origin === '') {
    throw new ObserverError('S2O_ACCESS_SHAPE', 'the access record needs launchUrl + origin (the kit writes origin/launchUrl/requestId/reviewPayloadDigest)')
  }
  return parsed
}

/** Every string the launch pipeline could leak into evidence: the raw launch
 *  URL itself and ALL of its query values (the token rides there). */
function collectLaunchSecrets(access) {
  const secrets = [access.launchUrl]
  try {
    const url = new URL(access.launchUrl)
    for (const [, value] of url.searchParams) if (typeof value === 'string' && value.length >= 8) secrets.push(value)
  } catch { /* launchUrl shape already validated; nothing more to collect */ }
  return secrets.filter((s) => typeof s === 'string' && s.length >= 8)
}

// ── expected digest + payload (the SAME durable request, never typed twice) ─

function deepJsonEqualInner(a, b) {
  if (a === b) return true
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return false
  if (Array.isArray(a) !== Array.isArray(b)) return false
  if (Array.isArray(a)) {
    if (a.length !== b.length) return false
    for (let i = 0; i < a.length; i += 1) if (!deepJsonEqualInner(a[i], b[i])) return false
    return true
  }
  const ka = Object.keys(a)
  const kb = Object.keys(b)
  if (ka.length !== kb.length) return false
  for (const key of ka) {
    if (!Object.prototype.hasOwnProperty.call(b, key)) return false
    if (!deepJsonEqualInner(a[key], b[key])) return false
  }
  return true
}

export function deepJsonEqual(a, b) {
  return deepJsonEqualInner(a, b)
}

/** Locate the request fact (requestId + reviewPayloadDigest) anywhere in an
 *  extraction document (flat leaf, ledger entry .payload, nested pages) —
 *  deterministic BFS, fail closed when no such fact exists. */
function findRequestFact(parsed) {
  const queue = [{ node: parsed, depth: 0 }]
  while (queue.length > 0) {
    const { node, depth } = queue.shift()
    if (node === null || typeof node !== 'object') continue
    if (!Array.isArray(node)
      && typeof node.requestId === 'string' && node.requestId !== ''
      && typeof node.reviewPayloadDigest === 'string') {
      return node
    }
    if (depth >= 6) continue
    for (const value of Object.values(node)) queue.push({ node: value, depth: depth + 1 })
  }
  return null
}

export function resolveExpected({ rid, digestRaw = null, digestFile = null, payloadFile }) {
  let payloadValue
  try {
    payloadValue = JSON.parse(readFileSync(payloadFile, 'utf8'))
  } catch (error) {
    throw new ObserverError('S2O_PAYLOAD_NOT_JSON', `--payload-file is not parseable JSON: ${String(error?.message ?? error)}`)
  }
  let expectedDigest = digestRaw
  if (digestFile !== null) {
    let factDoc
    try {
      factDoc = JSON.parse(readFileSync(digestFile, 'utf8'))
    } catch (error) {
      throw new ObserverError('S2O_DIGEST_FILE_NOT_JSON', `--digest-file is not parseable JSON: ${String(error?.message ?? error)}`)
    }
    const fact = findRequestFact(factDoc)
    if (fact === null) throw new ObserverError('S2O_FACT_NOT_FOUND', '--digest-file carries no request fact (needs requestId + reviewPayloadDigest leaves)')
    if (fact.requestId !== rid) {
      throw new ObserverError('S2O_FACT_RID_MISMATCH', `--digest-file names a DIFFERENT request (${fact.requestId}) than --rid (${rid}) — the digest must come from the SAME durable request`)
    }
    if (Object.prototype.hasOwnProperty.call(fact, 'reviewPayload') && !deepJsonEqual(fact.reviewPayload, payloadValue)) {
      throw new ObserverError('S2O_FACT_PAYLOAD_MISMATCH', 'the request fact carries a reviewPayload that does NOT deep-equal --payload-file — same durable request, never hand-typed twice')
    }
    expectedDigest = fact.reviewPayloadDigest
  }
  if (!DIGEST_RE.test(expectedDigest)) throw new ObserverError('S2O_DIGEST_SHAPE', `the expected digest must match ^sha256:[0-9a-f]{64}$: ${String(expectedDigest).slice(0, 24)}…`)
  // THE source binding: the expected digest must equal the kit's own truth
  // recomputation over the payload-file (reviewPayloadDigestOf = the ONE
  // canonicalJson/sha256Hex implementation, ui-observe.mjs L33-52).
  const recomputed = reviewPayloadDigestOf(payloadValue)
  if (recomputed !== expectedDigest) {
    throw new ObserverError('S2O_DIGEST_PAYLOAD_UNBOUND', 'the expected digest does NOT match reviewPayloadDigestOf(payload-file) — digest and payload must come from the SAME durable request')
  }
  return { expectedDigest, payloadValue }
}

// ── transportable DOM adapters (the EXACT bodies page.evaluate serializes) ──
// Self-contained: globalThis.document/window only, single JSON arg. The
// offline tests run THESE SAME BODIES against jsdom mirrors of the pinned
// client source (stage2-observer.test.mjs header pins).

/** Extract the control-panel fields for one requestId (fail-closed counts). */
export function extractPanelFields(rid) {
  const doc = globalThis.document
  const all = Array.from(doc.querySelectorAll('[data-ledger-resolve-bar][data-request-id]'))
  const matches = all.filter((el) => el.getAttribute('data-request-id') === rid)
  if (matches.length !== 1) {
    return { panelTotal: all.length, matchCount: matches.length, fields: null }
  }
  const panel = matches[0]
  const ddText = (sel) => {
    const el = panel.querySelector(sel)
    return el === null ? null : String(el.textContent ?? '')
  }
  const digestField = panel.querySelector('[data-digest-source="ledger-wire"]')
  const digestValue = digestField === null ? null : digestField.querySelector('dd')
  const pre = panel.querySelector('[data-control-detail-payload] pre')
  const renderModeEl = panel.querySelector('[data-control-detail-render-mode]')
  const requestIdText = ddText('[data-control-detail-request-id] dd')
  return {
    panelTotal: all.length,
    matchCount: 1,
    fields: {
      ridAttr: panel.getAttribute('data-request-id'),
      controlSurface: panel.getAttribute('data-control-surface'),
      requestIdText: requestIdText === null ? null : requestIdText.trim(),
      digestPresent: digestField !== null,
      digestText: digestValue === null ? null : String(digestValue.textContent ?? '').trim(),
      payloadPresent: pre !== null,
      payloadText: pre === null ? null : String(pre.textContent ?? ''),
      renderMode: renderModeEl === null ? null : renderModeEl.getAttribute('data-render-mode'),
    },
  }
}

/** Narrow-pass legibility (contract (d)): the digest must compute to
 *  white-space NORMAL (the frozen-batch-3 CSS pin), the payload pre must
 *  WRAP (real CSS: pre-wrap), neither ellipsized, DOM text length equals the
 *  full expected length, and no overflow clip. */
export function checkNarrowLegibility(arg) {
  const doc = globalThis.document
  const win = globalThis.window
  const rid = arg.rid
  const expected = arg.expected
  const rows = []
  const push = (name, ok, detail) => { rows.push({ name, ok, detail }) }
  const all = Array.from(doc.querySelectorAll('[data-ledger-resolve-bar][data-request-id]'))
  const matches = all.filter((el) => el.getAttribute('data-request-id') === rid)
  if (matches.length !== 1) {
    push('NARROW_PANEL_UNIQUE', false, `matchCount=${matches.length}`)
    return { ok: false, rows }
  }
  const panel = matches[0]
  const styleOf = (el) => win.getComputedStyle(el)
  const fits = (el) => el.scrollWidth <= el.clientWidth + 1
  const wrappable = (style) => style.whiteSpace === 'normal' || style.whiteSpace === 'pre-wrap' || style.whiteSpace === 'pre-line' || style.whiteSpace === 'break-spaces'

  const ridEl = panel.querySelector('[data-control-detail-request-id] dd')
  if (ridEl === null) {
    push('NARROW_RID_PRESENT', false, 'missing [data-control-detail-request-id] dd')
  } else {
    const style = styleOf(ridEl)
    push('NARROW_RID_LENGTH', (ridEl.textContent ?? '').length === expected.ridLen, `len=${(ridEl.textContent ?? '').length} expected=${expected.ridLen}`)
    // The requestId field carries the BASE .controlField dd ellipsis CSS —
    // readable iff it WRAPS or fully FITS (an ellipsis only bites when the
    // text overflows, which the FIT measurement catches).
    push('NARROW_RID_READABLE', wrappable(style) || fits(ridEl), `whiteSpace=${style.whiteSpace} textOverflow=${style.textOverflow} scrollWidth=${ridEl.scrollWidth} clientWidth=${ridEl.clientWidth}`)
  }

  const digestEl = panel.querySelector('[data-digest-source="ledger-wire"] dd')
  if (digestEl === null) {
    push('NARROW_DIGEST_PRESENT', false, 'missing [data-digest-source="ledger-wire"] dd')
  } else {
    const style = styleOf(digestEl)
    push('NARROW_DIGEST_WHITESPACE', style.whiteSpace === 'normal', `whiteSpace=${style.whiteSpace} (frozen batch #3 pin: normal)`)
    push('NARROW_DIGEST_NO_ELLIPSIS', style.textOverflow !== 'ellipsis', `textOverflow=${style.textOverflow}`)
    push('NARROW_DIGEST_LENGTH', (digestEl.textContent ?? '').length === expected.digestLen, `len=${(digestEl.textContent ?? '').length} expected=${expected.digestLen}`)
    push('NARROW_DIGEST_FIT', wrappable(style) || fits(digestEl), `scrollWidth=${digestEl.scrollWidth} clientWidth=${digestEl.clientWidth}`)
  }

  const pre = panel.querySelector('[data-control-detail-payload] pre')
  if (pre === null) {
    push('NARROW_PAYLOAD_PRESENT', false, 'missing [data-control-detail-payload] pre')
  } else {
    const style = styleOf(pre)
    // The real controlPayload CSS is white-space:pre-wrap (TeamLedger.module.css
    // L347-360) — wrapping IS the source-verified "fully readable" shape;
    // nowrap/clip fails closed.
    push('NARROW_PAYLOAD_WHITESPACE', wrappable(style), `whiteSpace=${style.whiteSpace} (pinned: pre-wrap)`)
    push('NARROW_PAYLOAD_NO_ELLIPSIS', style.textOverflow !== 'ellipsis', `textOverflow=${style.textOverflow}`)
    push('NARROW_PAYLOAD_LENGTH', (pre.textContent ?? '').length === expected.payloadLen, `len=${(pre.textContent ?? '').length} expected=${expected.payloadLen}`)
    push('NARROW_PAYLOAD_FIT', wrappable(style) || fits(pre), `scrollWidth=${pre.scrollWidth} clientWidth=${pre.clientWidth}`)
  }
  return { ok: rows.every((row) => row.ok), rows }
}

/** The coordinator-pinned Team-entry resolution (final wording 2026-10-02):
 *  the UNIQUE button[role=tab] UNDER [data-conversation-tabs] whose accessible
 *  label is EXACTLY one of TEAM_TAB_LABELS. LAYOUT-AGNOSTIC: the scoped
 *  descendant query covers any group layout (the pinned 46a7f68b09 checkout
 *  renders one flat tabs.map under the tablist — teamTabAction/tabsSeparator
 *  have ZERO source hits at the pin; hypothetical strip/team-action group
 *  layouts resolve identically through the same predicate). NO css-group
 *  requirement, NO first/last ordering assertion — those can wrongly reject a
 *  legal Team placement or wrongly accept a decoy. Decoy labels outside the
 *  tablist (TeamDock spans — the 55 live run's E3.teamTabHits=2 trap) and
 *  non-exact labels inside it ('TeamDock') NEVER qualify; ambiguity fails
 *  closed (never silently take the first). */
export function resolveTeamTabDom(labels) {
  const doc = globalThis.document
  const list = doc.querySelector('[data-conversation-tabs][role="tablist"]')
  if (list === null) return { ok: false, code: 'TEAM_TABLIST_MISSING' }
  const tabs = Array.from(list.querySelectorAll('button[role="tab"]'))
  const label = (el) => String(el.textContent ?? '').trim()
  const matches = tabs
    .map((el, index) => ({ el, index }))
    .filter((entry) => labels.includes(label(entry.el)))
  if (matches.length === 0) return { ok: false, code: 'TEAM_TAB_NOT_FOUND', tabCount: tabs.length }
  if (matches.length > 1) return { ok: false, code: 'TEAM_TAB_AMBIGUOUS', count: matches.length, tabCount: tabs.length }
  return { ok: true, index: matches[0].index, label: label(matches[0].el), tabCount: tabs.length }
}

/** Post-activation assertion (coordinator-pinned): aria-selected='true' on
 *  the resolved tab AND the Team view present in the DOM. */
export function teamViewActivatedDom(index) {
  const doc = globalThis.document
  const list = doc.querySelector('[data-conversation-tabs][role="tablist"]')
  if (list === null) return { ok: false, code: 'TEAM_TABLIST_MISSING' }
  const tab = list.querySelectorAll('button[role="tab"]')[index]
  if (tab === undefined || tab.getAttribute('aria-selected') !== 'true') return { ok: false, code: 'TEAM_TAB_NOT_SELECTED' }
  if (doc.querySelector('[data-team-view]') === null) return { ok: false, code: 'TEAM_VIEW_MISSING' }
  return { ok: true }
}

// ── field comparisons (pure — run in Node over the extracted DOM JSON) ─────

export function checkFields({ fields: extraction, expectedRid, expectedDigest, payloadValue }) {
  const rows = []
  const push = (name, ok, detail) => { rows.push({ name, ok, detail }) }
  const core = extraction !== null && typeof extraction === 'object' ? extraction.fields : null
  const present = extraction !== null && typeof extraction === 'object'
    && extraction.matchCount === 1 && core !== null && typeof core === 'object'
  push('PANEL_PRESENT', present === true, `panelTotal=${extraction?.panelTotal ?? 0} matchCount=${extraction?.matchCount ?? 0}`)
  if (!present) return { ok: false, checks: rows }
  push('RID_ATTR_BINDING', core.ridAttr === expectedRid, `attr=${core.ridAttr}`)
  push('RID_TEXT_VISIBLE', typeof core.requestIdText === 'string' && core.requestIdText === expectedRid,
    `rendered=${String(core.requestIdText).slice(0, 96)}`)
  push('DIGEST_PRESENT', core.digestPresent === true && typeof core.digestText === 'string' && core.digestText !== '', `present=${core.digestPresent}`)
  const shapeOk = typeof core.digestText === 'string' && DIGEST_RE.test(core.digestText)
  push('DIGEST_SHAPE', shapeOk, shapeOk ? 'sha256:<64hex>' : `rendered=${String(core.digestText).slice(0, 24)}…`)
  push('DIGEST_EXACT', core.digestText === expectedDigest,
    `rendered=${String(core.digestText).slice(0, 18)}… expected=${expectedDigest.slice(0, 18)}…`)
  push('PAYLOAD_PRESENT', core.payloadPresent === true && typeof core.payloadText === 'string', `present=${core.payloadPresent}`)
  let parsed = undefined
  if (typeof core.payloadText === 'string') {
    try {
      parsed = JSON.parse(core.payloadText)
      push('PAYLOAD_PARSE', true, `len=${core.payloadText.length}`)
    } catch {
      push('PAYLOAD_PARSE', false, '<pre> text is not JSON')
    }
  } else {
    push('PAYLOAD_PARSE', false, 'no <pre> text')
  }
  push('PAYLOAD_DEEP_EQUAL', parsed !== undefined && deepJsonEqual(parsed, payloadValue),
    parsed === undefined ? 'unparsed' : `renderedLen=${core.payloadText.length} expectedLen=${JSON.stringify(payloadValue, null, 2).length}`)
  return { ok: rows.every((row) => row.ok), checks: rows }
}

// ── token-scrubbed evidence writer (auth-free BY CONSTRUCTION) ──────────────

export function scanForSecrets(text, secrets) {
  const hits = []
  for (const secret of secrets) {
    if (typeof secret === 'string' && secret.length >= 8 && text.includes(secret)) hits.push('launch-secret')
  }
  if (/token\s*=/i.test(text)) hits.push('token-query')
  return hits
}

/** Scan-then-write: EVERY artifact (binary screens included, latin1 view) is
 *  scanned for the launch secrets and any `?token=` URL query BEFORE the dir
 *  is even created; a leak is a typed refusal that writes NOTHING. Then the
 *  files + a sha256 manifest (over every other written file) land. */
export function writeEvidenceBundle(dir, files, secrets) {
  const entries = Object.entries(files)
  for (const [name, value] of entries) {
    const text = typeof value === 'string' ? value : Buffer.from(value).toString('latin1')
    const hits = scanForSecrets(text, secrets)
    if (hits.length > 0) {
      throw new ObserverError('S2O_EVIDENCE_TOKEN_LEAK', `refusing to write evidence — ${name} carries ${hits.join('+')}`)
    }
  }
  mkdirSync(dir, { recursive: true })
  const rows = []
  for (const [name, value] of entries) {
    const buf = typeof value === 'string' ? Buffer.from(value, 'utf8') : Buffer.from(value)
    const path = join(dir, name)
    const fd = openSync(path, constants.O_WRONLY | constants.O_CREAT | constants.O_TRUNC | constants.O_NOFOLLOW, 0o644)
    try {
      writeSync(fd, buf)
    } finally {
      closeSync(fd)
    }
    rows.push({ file: name, bytes: buf.length, sha256: createHash('sha256').update(buf).digest('hex') })
  }
  rows.sort((a, b) => (a.file < b.file ? -1 : 1))
  const manifest = { kit: 'pr-e-requirement-recovery-smoke/stage2-observer', at: new Date().toISOString(), files: rows }
  const manifestBuf = Buffer.from(JSON.stringify(manifest, null, 2), 'utf8')
  const mfd = openSync(join(dir, 'manifest.json'), constants.O_WRONLY | constants.O_CREAT | constants.O_TRUNC | constants.O_NOFOLLOW, 0o644)
  try {
    writeSync(mfd, manifestBuf)
  } finally {
    closeSync(mfd)
  }
  return { dir, manifest }
}

// ── the marker: atomic, 0600, ONLY after every check passed ─────────────────

let tmpCounter = 0

export function writeMarkerAtomic({ markerDir, requestId, digest, ts = null }) {
  const payload = JSON.stringify({
    requestId,
    digest,
    claimed: OBSERVED_PENDING_CLAIM,
    ts: ts ?? new Date().toISOString(),
  }, null, 2)
  mkdirSync(markerDir, { recursive: true })
  const markerPath = join(markerDir, 'marker.json')
  tmpCounter += 1
  const tmpPath = join(markerDir, `.marker.json.${process.pid}.${Date.now()}.${tmpCounter}.tmp`)
  const fd = openSync(tmpPath, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600)
  try {
    writeSync(fd, payload)
    const st = fstatSync(fd)
    if (!st.isFile() || (st.mode & 0o777) !== 0o600) {
      throw new ObserverError('S2O_MARKER_MODE', `tmp marker mode 0o${(st.mode & 0o777).toString(8)} is not 0600`)
    }
  } catch (error) {
    try { closeSync(fd) } catch { /* best effort */ }
    try { rmSync(tmpPath, { force: true }) } catch { /* best effort — OUR OWN tmp only */ }
    throw error instanceof ObserverError ? error : new ObserverError('S2O_MARKER_WRITE_FAILED', String(error?.message ?? error))
  }
  closeSync(fd)
  renameSync(tmpPath, markerPath)
  const after = lstatSync(markerPath)
  if (after.isSymbolicLink() || !after.isFile() || (after.mode & 0o777) !== 0o600) {
    throw new ObserverError('S2O_MARKER_MODE', 'the renamed marker leaf is not a 0600 regular file')
  }
  return markerPath
}

/** THE marker gate: on ANY failed check nothing is written to markerDir
 *  (fail closed). On all-pass, the atomic marker lands. */
export function writeMarkerIfAllPass({ allPassed, markerDir, requestId, digest }) {
  mkdirSync(markerDir, { recursive: true })
  if (allPassed !== true) return { ok: false, reason: 'CHECKS_FAILED' }
  const path = writeMarkerAtomic({ markerDir, requestId, digest })
  return { ok: true, path }
}

// ── Playwright (fixed PUBLIC entry import — no hardcoded .pnpm paths) ──────

export function loadPlaywrightFrom(testuseDir) {
  const entry = join(testuseDir, 'apps', 'web', 'package.json')
  if (!existsSync(entry)) {
    throw new ObserverError('S2O_TESTUSE_ENTRY_MISSING', `TestUse apps/web PUBLIC entry not found: ${entry} (pass --testuse <dir>)`)
  }
  try {
    return createRequire(entry)('playwright')
  } catch (error) {
    throw new ObserverError('S2O_PLAYWRIGHT_UNRESOLVABLE', `playwright is not resolvable from ${entry}: ${String(error?.message ?? error)}`)
  }
}

function defaultTestuseRoot() {
  const repoRoot = findTestRepoRoot(dirname(fileURLToPath(import.meta.url)))
  if (repoRoot === null) throw new ObserverError('S2O_TESTUSE_UNRESOLVED', 'tests/paths.mjs found no TestUse checkout — pass --testuse <dir>')
  return join(repoRoot, TEST_USE_REL)
}

// ── the live observation flow (ONLY the env executor runs this; offline
//    tests cover every adapter above as the SAME function bodies) ────────────

export async function runObservation(opts) {
  const expected = resolveExpected({
    rid: opts.rid, digestRaw: opts.digestRaw, digestFile: opts.digestFile, payloadFile: opts.payloadFile,
  })
  const access = validatePrivateAccessFile(opts.accessPath)
  if (typeof access.requestId === 'string' && access.requestId !== opts.rid) {
    throw new ObserverError('S2O_ACCESS_RID_MISMATCH', 'the access record names a different requestId than --rid (wrong run — fail closed)')
  }
  if (typeof access.reviewPayloadDigest === 'string' && access.reviewPayloadDigest !== expected.expectedDigest) {
    throw new ObserverError('S2O_ACCESS_DIGEST_MISMATCH', 'the access record digest differs from the expected digest (wrong run — fail closed)')
  }
  const secrets = collectLaunchSecrets(access)
  const testuseDir = opts.testuse ?? defaultTestuseRoot()
  const { chromium } = loadPlaywrightFrom(testuseDir)
  const browser = await chromium.launch({ headless: true })
  try {
    const passes = {}
    for (const [phase, viewport] of [['normal', opts.viewport], ['narrow', opts.narrow]]) {
      const context = await browser.newContext({ viewport })
      try {
        const page = await context.newPage()
        await page.goto(access.launchUrl, { waitUntil: 'domcontentloaded', timeout: BOOT_TIMEOUT_MS })
        await page.waitForSelector('[data-conversation-tabs][role="tablist"] button[role="tab"]', { timeout: OBSERVE_TIMEOUT_MS })
        const tab = await page.evaluate(resolveTeamTabDom, TEAM_TAB_LABELS)
        if (tab.ok !== true) throw new ObserverError(`S2O_${tab.code}`, `Team tab activation refused: ${tab.code}`)
        const handles = await page.$('[data-conversation-tabs][role="tablist"]')
          .then((list) => (list === null ? [] : list.$$('button[role="tab"]')))
        // THE single sanctioned click (coordinator-pinned Team-entry
        // activation). Never allow/deny, never refresh, never any other control.
        await handles[tab.index].click()
        await page.waitForFunction(teamViewActivatedDom, tab.index, { timeout: OBSERVE_TIMEOUT_MS })
        await page.locator('[data-team-view]').first().waitFor({ state: 'visible', timeout: OBSERVE_TIMEOUT_MS })
        await page.waitForSelector(`[data-ledger-resolve-bar][data-request-id="${opts.rid}"]`, { timeout: OBSERVE_TIMEOUT_MS })
        const fields = await page.evaluate(extractPanelFields, opts.rid)
        const payloadRendered = typeof fields?.fields?.payloadText === 'string'
          ? fields.fields.payloadText
          : JSON.stringify(expected.payloadValue, null, 2)
        const narrow = await page.evaluate(checkNarrowLegibility, {
          rid: opts.rid,
          expected: {
            ridLen: opts.rid.length,
            digestLen: expected.expectedDigest.length,
            payloadLen: payloadRendered.length,
          },
        })
        const shotFull = await page.screenshot({ fullPage: true })
        const shotPanel = await page.locator(`[data-ledger-resolve-bar][data-request-id="${opts.rid}"]`).screenshot()
        passes[phase] = { fields, narrow, shotFull, shotPanel }
      } finally {
        await context.close()
      }
    }
    const normalChecks = checkFields({
      fields: passes.normal.fields,
      expectedRid: opts.rid,
      expectedDigest: expected.expectedDigest,
      payloadValue: expected.payloadValue,
    })
    const allPassed = normalChecks.ok
      && passes.normal.narrow.ok === true
      && passes.narrow.narrow.ok === true
    const evidenceFiles = {
      'meta.json': JSON.stringify({
        kit: 'pr-e-requirement-recovery-smoke/stage2-observer',
        at: new Date().toISOString(),
        origin: access.origin, // NEVER the launchUrl — the token rides in its query
        requestId: opts.rid,
        digest: expected.expectedDigest,
        viewports: { normal: opts.viewport, narrow: opts.narrow },
        claimed: OBSERVED_PENDING_CLAIM,
      }, null, 2),
      'dom-normal.json': JSON.stringify(passes.normal.fields, null, 2),
      'dom-narrow.json': JSON.stringify(passes.narrow.fields, null, 2),
      'comparisons.json': JSON.stringify({
        allPassed,
        fields: normalChecks.checks,
        narrowNormal: passes.normal.narrow.rows,
        narrowNarrow: passes.narrow.narrow.rows,
      }, null, 2),
      'shot-normal.png': passes.normal.shotFull,
      'shot-narrow.png': passes.narrow.shotFull,
      'panel-normal.png': passes.normal.shotPanel,
      'panel-narrow.png': passes.narrow.shotPanel,
    }
    const evidence = writeEvidenceBundle(opts.evidenceDir, evidenceFiles, secrets)
    const marker = writeMarkerIfAllPass({
      allPassed, markerDir: opts.markerDir, requestId: opts.rid, digest: expected.expectedDigest,
    })
    if (marker.ok !== true) {
      throw new ObserverError('S2O_CHECKS_FAILED', `observation refused the marker (${marker.reason}) — see ${join(evidence.dir, 'comparisons.json')}`)
    }
    return { ok: true, markerPath: marker.path, evidenceDir: evidence.dir }
  } finally {
    await browser.close()
  }
}

async function main() {
  const opts = parseCli(process.argv.slice(2))
  const result = await runObservation(opts)
  process.stdout.write(`STAGE2_OBSERVE_PASS ${result.markerPath}\n`)
  process.exitCode = 0
}

const invokedDirectly = process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (invokedDirectly) {
  main().catch((error) => {
    if (error instanceof ObserverError) {
      process.stderr.write(`STAGE2_OBSERVER_FAIL ${error.code} :: ${String(error.message).slice(0, 400)}\n`)
      process.exitCode = 2
    } else {
      process.stderr.write(`STAGE2_OBSERVER_FATAL ${String(error?.stack ?? error).slice(0, 800)}\n`)
      process.exitCode = 1
    }
  })
}
