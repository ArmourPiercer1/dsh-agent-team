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
 *       payload pre wraps (pre-wrap per TeamLedger.module.css); length
 *       expectations come from the DURABLE source, never the rendered text;
 *       EFFECTIVE clipping decides readability — a COMPUTED text-overflow:
 *       ellipsis is ACCEPTED when the reviewed cascade neutralizes it).
 *   EXTERNAL REVIEW BATCH (2026-10-02, four frozen items): (1) every error
 *   printed by ANY boundary passes the shared secret scrub (launch secrets +
 *   token= values; un-scrubbable uncertainty prints ONLY a typed code);
 *   (2) BOTH viewport passes run the FULL durable-source field checks (the
 *   narrow pass is checked independently, not just measured against itself);
 *   (3) layout readability follows the REAL committed cascade (see
 *   checkNarrowLegibility); (4) Team activation waits on a BOOLEAN predicate
 *   via waitUntilTruthy + post-wait positive re-validation — the object-
 *   returning helper can no longer be a wait expression (truthy {ok:false}
 *   resolved instantly and skipped the wait).
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
 * BATCH-3 (2026-10-02, two security-config blocks):
 *  BLOCK-A: the browser launches ONLY as the verified system Chrome with the
 *  chromium SANDBOX ENABLED over the pipe transport — buildLaunchOptions
 *  returns {headless:true, executablePath, chromiumSandbox:true, pipe:true}
 *  with NO args array at all (nothing can pass --no-sandbox); the chrome path
 *  (default /opt/google/chrome/chrome, --chrome override) is verified to be a
 *  regular non-symlink file BEFORE launch (S2O_CHROME_MISSING/NOT_FILE).
 *  BLOCK-B: the root session is NEVER assumed — the SAME durable fact row's
 *  rootSessionId (kit seedFact L785-797; resolveExpected binds it) is the
 *  only key; the pinned checkout has NO URL-level session selection, so the
 *  entry goes through the real session-browser row (Rows.tsx @46a7f68b09:
 *  L571 data-row-key="session:<id>", L577-578 role=treeitem+aria-selected,
 *  L580 click opens by id) — selected via the second sanctioned click, then
 *  POSITIVELY verified (boolean ready wait + typed re-validation) before any
 *  Team-tab work; every mismatch is a typed fail-closed with no marker.
 *
 * BATCH-4 (2026-10-02, external real-entry BLOCK — entry model changed for
 * SESSION CONTINUITY, driven by the real auto-collapse behavior cited below):
 * ONE context/page at the normal viewport (login ONCE, root row selected
 * once at wide width where the session list exists); the narrow pass RESIZES
 * the same page (page.setViewportSize) — at width < SIDEBAR_AUTO_COLLAPSE
 * (1024) the sidebar auto-collapses (ui-layout/src/client/columns.ts L23;
 * AppFrame.tsx L178-182; stores.ts fresh narrowExpanded:false) and the
 * session list is wide-only, so below the breakpoint ZERO treeitems render
 * (ui-workspace rows/WorkspaceBrowser.tsx L1275-1278): a fresh 380px context
 * could never re-select the root. The narrow re-check demands NOTHING
 * invisible and asserts NO header text (runtime ruling @23a43f20: the header
 * shows the display TITLE, not the raw sessionId, inside ancestry): Team
 * stays active + same RID + full wire digest + reviewPayload deep-equal —
 * payload.rootSessionId is bound whenever the durable reviewed payload
 * carries it — all re-verified against the durable source. ALL per-viewport checks stay; none loosened. Fail-closed
 * typing: any narrow failure ⇒ typed error, NO marker; exactly ONE marker
 * only after BOTH passes pass.
 *
 * EXIT: 0 = all checks passed + marker written; 2 = a fail-closed validation/
 * comparison refusal (no marker); 1 = infrastructure error (no marker).
 *
 * Offline contract tests (host-free, jsdom mirrors of the pins above):
 *   node --test tests/kits/pr-e-requirement-recovery-smoke/stage2-observer.test.mjs
 */

import {
  constants, chmodSync, closeSync, existsSync, fstatSync, lstatSync, mkdirSync,
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
/** Item-4 wait driver cadence (bounded by OBSERVE_TIMEOUT_MS). */
const TEAM_WAIT_POLL_MS = 250

// ── BATCH-6: FRESH-BOOT ENTRY ACTIVATION + ENTRY-STAGE FAILURE DUMP ─────────
// The stage-2 LIVE run @2026-10-01T20-10-50 died S2O_ROOT_ROW_MISSING after
// the token goto: the fresh context lands on a rail whose 'Ungrouped' group
// COLLAPSES BY DEFAULT (PINNED host apps/web/tests/agent-preset-selection.
// e2e.ts:382-383 @46a7f68b09 — "the group collapses by default", its own e2e
// clicks getByRole('treeitem', { name: /^Ungrouped/ }) before any session
// row exists), and a FRESH profile additionally fronts the WelcomeNotice
// (locales.ts L107 'Internal Testing Notice' / L109 welcomeContinue
// 'Continue' @46a7f68b09). The PR55 driver LIVE-proved the navigation order
// (tests/kits/team-view-sync-complete-e2e/dod20-ui-driver.mjs @46043f78
// header: dismiss-notice → expand-ungrouped-group → expand-overflow, ONE
// scoped real click per step, fail-closed after). Reusing exactly that
// semantics here: each step is a ROLE-SCOPED locator (never a generic text
// search), runs at most once, and only ever INSIDE the rootCount===0 branch
// — a page whose rows already rendered takes the pre-BATCH-6 path untouched.
// The entry click budget grows from 2 to at most 5 (notice + group + overflow
// are all conditional); every refusal stays typed and markerless.
const WELCOME_CONTINUE = 'Continue'
const UNGROUPED_GROUP_NAME = /^Ungrouped/
const OVERFLOW_BUTTON_NAME = /^Show \d+ more sessions$/
/** Entry-failure dump bound (chars of sanitized DOM). */
const ENTRY_DUMP_MAX_CHARS = 262_144

export class ObserverError extends Error {
  constructor(code, message) {
    super(message)
    this.name = 'ObserverError'
    this.code = code
  }
}

// ── CLI ─────────────────────────────────────────────────────────────────────

const CLI_FLAGS = Object.freeze(['access', 'rid', 'digest', 'digest-file', 'payload-file', 'evidence', 'viewport', 'marker-dir', 'testuse', 'chrome', 'member-session', 'team-domain'])
const CLI_REQUIRED = Object.freeze(['access', 'rid', 'payload-file', 'evidence', 'viewport', 'marker-dir'])

// PARENT-AUTHORIZED MEMBER-PERSPECTIVE ENTRY (test-lane only). The member
// session id must be a child-session id of THIS world (live durable shape:
// session-team-child-<32 hex>, verified @prereq-2026-10-01T20-10-50); the
// team-domain file is this world's storages/team_domain.json, from which the
// member→instance→root binding is verified DURABLY before any UI action.
const MEMBER_SESSION_RE = /^session-team-child-[0-9a-f]{32}$/
const MEMBER_INSTANCE_ID_RE = /^inst-[0-9a-z]{4,32}$/
// The structured diagnostic only ever echoes world-shaped synthetic ids.
const DIAG_ID_RE = /^(?:session-prereq-|session-team-child-)/
const TEAM_DOMAIN_MAX_BYTES = 16 * 1024 * 1024

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
    // BATCH-3: optional system-Chrome override; existence/regularity are
    // verified at launch (buildLaunchOptions), not at parse time.
    chromePath: values.has('chrome') ? resolve(values.get('chrome')) : null,
    // PARENT-AUTHORIZED MEMBER PERSPECTIVE (both together or neither; the
    // durable binding is verified from --team-domain BEFORE any UI action).
    memberSessionId: null,
    teamDomainPath: null,
  }
  if (values.has('member-session') || values.has('team-domain')) {
    if (!values.has('member-session')) throw new ObserverError('CLI_MISSING_MEMBER_SESSION', '--team-domain without --member-session: the member entry must name the child session whose binding is checked')
    if (!values.has('team-domain')) throw new ObserverError('CLI_MISSING_TEAM_DOMAIN', '--member-session without --team-domain: member entry MUST be proven from this world\'s durable storages/team_domain.json, never from the CLI id alone')
    const memberId = values.get('member-session')
    if (!MEMBER_SESSION_RE.test(memberId)) throw new ObserverError('CLI_MEMBER_SESSION_SHAPE', `--member-session must match ${MEMBER_SESSION_RE}: ${memberId}`)
    opts.memberSessionId = memberId
    opts.teamDomainPath = requireRegularFile(values.get('team-domain'), '--team-domain')
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

/** BATCH-3 BLOCK-B: collect every rootSessionId leaf in a fact document
 *  (the durable ledger ROW carries it at top level; nested copies count as
 *  candidates too — a conflict fails closed, never first-wins). */
function collectRootCandidates(parsed) {
  const found = []
  const queue = [parsed]
  while (queue.length > 0) {
    const node = queue.shift()
    if (node === null || typeof node !== 'object') continue
    if (!Array.isArray(node) && Object.prototype.hasOwnProperty.call(node, 'rootSessionId')) found.push(node.rootSessionId)
    for (const value of Object.values(node)) queue.push(value)
  }
  return found
}

const ROOT_ID_RE = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/

export function resolveExpected({ rid, digestRaw = null, digestFile = null, payloadFile }) {
  let payloadValue
  try {
    payloadValue = JSON.parse(readFileSync(payloadFile, 'utf8'))
  } catch (error) {
    throw new ObserverError('S2O_PAYLOAD_NOT_JSON', `--payload-file is not parseable JSON: ${String(error?.message ?? error)}`)
  }
  let expectedDigest = digestRaw
  let factDoc = null
  if (digestFile !== null) {
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
  // BATCH-3 BLOCK-B: the root session identity, bound to the SAME durable
  // document (row-carried rootSessionId and/or the payload). Absent → null
  // (runObservation fails closed — no default-session guessing); conflicting
  // values → typed refusal (never first-wins).
  const rootCandidates = factDoc !== null ? collectRootCandidates(factDoc) : []
  if (payloadValue !== null && typeof payloadValue === 'object' && !Array.isArray(payloadValue)
    && Object.prototype.hasOwnProperty.call(payloadValue, 'rootSessionId')) {
    rootCandidates.push(payloadValue.rootSessionId)
  }
  for (const candidate of rootCandidates) {
    if (typeof candidate !== 'string' || !ROOT_ID_RE.test(candidate)) {
      throw new ObserverError('S2O_ROOT_ID_SHAPE', `a durable rootSessionId candidate is not a valid session id: ${String(candidate).slice(0, 40)}`)
    }
  }
  const rootDistinct = [...new Set(rootCandidates)]
  if (rootDistinct.length > 1) {
    throw new ObserverError('S2O_ROOT_ID_AMBIGUOUS', `the fact document carries CONFLICTING rootSessionId values (${rootDistinct.slice(0, 3).join(', ')}) — refusing to guess`)
  }
  return { expectedDigest, payloadValue, rootSessionId: rootDistinct.length === 1 ? rootDistinct[0] : null }
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
 *  WRAP (real CSS: pre-wrap), DOM text length equals the FULL (durable-
 *  source) expected length, and EFFECTIVE CLIPPING governs readability
 *  (EXTERNAL BATCH ITEM-3): the reviewed PR #56 CSS KEEPS text-overflow:
 *  'ellipsis' computed on the digest dd (the `.controlField dd` trio L298-306
 *  is never reset — the L339-344 override neutralizes it via overflow:visible
 *  + white-space:normal; `.controlPayload` keeps pre-wrap + overflow:auto
 *  L347-360). A computed ellipsis is therefore ACCEPTED; a field fails when
 *  it does not wrap (un-neutralized trio = real truncation regime), when
 *  geometry shows horizontal overflow, or when wrapped content is vertically
 *  unreachable (overflow hidden + clipped height). Product CSS is NEVER
 *  adjusted to satisfy this check — the check follows the committed cascade. */
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
  const fitsX = (el) => el.scrollWidth <= el.clientWidth + 1
  const wrappable = (style) => style.whiteSpace === 'normal' || style.whiteSpace === 'pre-wrap' || style.whiteSpace === 'pre-line' || style.whiteSpace === 'break-spaces'
  // Per-axis overflow with cascade honesty: an explicit non-visible longhand
  // wins; otherwise parse the shorthand (jsdom does NOT expand `overflow`
  // into overflowX/Y — the real browser may report either form).
  const axis = (style, which) => {
    const long = style[which]
    if (typeof long === 'string' && long !== '' && long !== 'visible') return long
    const ov = String(style.overflow ?? '').trim()
    if (ov === '' || ov === 'visible') return typeof long === 'string' && long !== '' ? long : 'visible'
    const parts = ov.split(/\s+/)
    if (parts.length >= 2) return which === 'overflowX' ? parts[0] : parts[1]
    return parts[0]
  }
  const reachableY = (el, style) => {
    const y = axis(style, 'overflowY')
    return y === 'visible' || y === 'auto' || y === 'scroll' || el.scrollHeight <= el.clientHeight + 1
  }
  // EFFECTIVE-clip (item 3): a WRAPPING field is readable iff nothing is
  // clipped out of reach. text-overflow:'ellipsis' COMPUTED is accepted —
  // with wrapping + visible/auto overflow it never bites (the reviewed
  // cascade's exact state). A non-wrapping field is the un-neutralized base
  // trio regime (real truncation) → fail closed.
  const effectiveClip = (el, style) => ({
    ok: wrappable(style) && fitsX(el) && reachableY(el, style),
    detail: `whiteSpace=${style.whiteSpace} overflow=${String(style.overflow ?? '')}/${axis(style, 'overflowX')}/${axis(style, 'overflowY')} textOverflow=${style.textOverflow} (computed ellipsis ACCEPTED when neutralized) scrollWidth=${el.scrollWidth} clientWidth=${el.clientWidth} scrollHeight=${el.scrollHeight} clientHeight=${el.clientHeight}`,
  })

  const ridEl = panel.querySelector('[data-control-detail-request-id] dd')
  if (ridEl === null) {
    push('NARROW_RID_PRESENT', false, 'missing [data-control-detail-request-id] dd')
  } else {
    const style = styleOf(ridEl)
    push('NARROW_RID_LENGTH', (ridEl.textContent ?? '').length === expected.ridLen, `len=${(ridEl.textContent ?? '').length} expected=${expected.ridLen}`)
    // The requestId field carries the BASE .controlField dd ellipsis CSS —
    // readable iff it WRAPS or fully FITS (an ellipsis only bites when the
    // text overflows, which the FIT measurement catches).
    push('NARROW_RID_READABLE', wrappable(style) || fitsX(ridEl), `whiteSpace=${style.whiteSpace} textOverflow=${style.textOverflow} scrollWidth=${ridEl.scrollWidth} clientWidth=${ridEl.clientWidth}`)
  }

  const digestEl = panel.querySelector('[data-digest-source="ledger-wire"] dd')
  if (digestEl === null) {
    push('NARROW_DIGEST_PRESENT', false, 'missing [data-digest-source="ledger-wire"] dd')
  } else {
    const style = styleOf(digestEl)
    push('NARROW_DIGEST_WHITESPACE', style.whiteSpace === 'normal', `whiteSpace=${style.whiteSpace} (frozen batch #3 pin: normal)`)
    const clip = effectiveClip(digestEl, style)
    push('NARROW_DIGEST_EFFECTIVE_CLIP', clip.ok, clip.detail)
    push('NARROW_DIGEST_LENGTH', (digestEl.textContent ?? '').length === expected.digestLen, `len=${(digestEl.textContent ?? '').length} expected=${expected.digestLen} (durable source)`)
  }

  const pre = panel.querySelector('[data-control-detail-payload] pre')
  if (pre === null) {
    push('NARROW_PAYLOAD_PRESENT', false, 'missing [data-control-detail-payload] pre')
  } else {
    const style = styleOf(pre)
    // The real controlPayload CSS is white-space:pre-wrap + overflow:auto
    // (TeamLedger.module.css L347-360) — wrapping IS the source-verified
    // "fully readable" shape; nowrap/clip fails closed.
    push('NARROW_PAYLOAD_WHITESPACE', wrappable(style), `whiteSpace=${style.whiteSpace} (pinned: pre-wrap)`)
    const clip = effectiveClip(pre, style)
    push('NARROW_PAYLOAD_EFFECTIVE_CLIP', clip.ok, clip.detail)
    push('NARROW_PAYLOAD_LENGTH', (pre.textContent ?? '').length === expected.payloadLen, `len=${(pre.textContent ?? '').length} expected=${expected.payloadLen} (durable source)`)
  }
  return { ok: rows.every((row) => row.ok), rows }
}

/** PARENT-ORDERED GEOMETRY READS (PR #54 round, additive ONLY — the
 *  readability predicates above are byte-kept and never relaxed): the minimal
 *  evidence to PROVE (1) container/field widths at the pass viewport (bar
 *  box, dl[data-control-detail], the dd/pre content boxes) and (2) clipping:
 *  the Allow/Deny buttons fully inside the resolve-bar box and every
 *  activity row's element children right/left edges inside the rows box
 *  (parent of the first [data-ledger-row], TeamLedger.tsx L639). A
 *  layout-less host (jsdom fixtures) reports ZERO box widths EVERYWHERE —
 *  there geometry is UNASSERTED (never asserted-false): a live browser
 *  always renders the bar (run5's panel box was >0 while the VALUE track
 *  collapsed to 0px), so the unasserted branch cannot mask a real collapse.
 *  Rows ride the existing comparisons {name,ok,detail} shape — zero new
 *  artifacts, zero new viewports. */
export function checkGeometryDom(arg) {
  const doc = globalThis.document
  const rows = []
  const push = (name, ok, detail) => rows.push({ name, ok, detail })
  const all = Array.from(doc.querySelectorAll('[data-ledger-resolve-bar][data-request-id]'))
  const matches = all.filter((el) => el.getAttribute('data-request-id') === arg.rid)
  if (matches.length !== 1) {
    push('GEO_PANEL_UNIQUE', false, `matchCount=${matches.length}`)
    return { ok: false, rows }
  }
  const panel = matches[0]
  const cw = (el) => (el != null && Number.isFinite(el.clientWidth) ? el.clientWidth : null)
  const rect = (el) => {
    try {
      const r = el.getBoundingClientRect()
      return r != null && Number.isFinite(r.left) && Number.isFinite(r.right) ? r : null
    } catch { return null }
  }
  const widths = {
    panel: cw(panel),
    dl: cw(panel.querySelector('[data-control-detail]')),
    ridDd: cw(panel.querySelector('[data-control-detail-request-id] dd')),
    digestDd: cw(panel.querySelector('[data-digest-source="ledger-wire"] dd')),
    payloadPre: cw(panel.querySelector('[data-control-detail-payload] pre')),
  }
  if (widths.panel === null || widths.panel <= 0) {
    push('GEO_FIELD_WIDTHS', true, `unasserted (panel box width ${String(widths.panel)} — layout-less host, no real geometry here) ${JSON.stringify(widths)}`)
    push('GEO_RESOLVE_BUTTONS_FIT', true, 'unasserted (layout-less host)')
    push('GEO_ROWS_CHILDREN_FIT', true, 'unasserted (layout-less host)')
    return { ok: true, rows }
  }
  const collapsed = Object.entries(widths).filter(([, v]) => v === null || v <= 0).map(([k]) => k)
  push('GEO_FIELD_WIDTHS', collapsed.length === 0, `widths=${JSON.stringify(widths)}${collapsed.length > 0 ? ` collapsed=[${collapsed}] (a rendered bar whose field content-box is 0px IS the run5 collapse)` : ''}`)
  const barRect = rect(panel)
  const btns = [['allow', panel.querySelector('[data-ledger-resolve-allow]')], ['deny', panel.querySelector('[data-ledger-resolve-deny]')]]
  const present = btns.filter(([, el]) => el != null)
  if (barRect === null || present.length === 0) {
    push('GEO_RESOLVE_BUTTONS_FIT', true, 'unasserted (no rects/buttons in this host)')
  } else {
    const over = present.filter(([, el]) => {
      const r = rect(el)
      return r !== null && (r.right > barRect.right + 1 || r.left < barRect.left - 1)
    }).map(([name]) => name)
    const absent = btns.filter(([, el]) => el == null).map(([name]) => name)
    push('GEO_RESOLVE_BUTTONS_FIT', over.length === 0, `bar=[${barRect.left},${barRect.right}] overflow=[${over}] absent=[${absent}] (presence itself is other legs' ground; fit is asserted for PRESENT ones)`)
  }
  const rowEls = Array.from(doc.querySelectorAll('[data-ledger-row]'))
  if (rowEls.length === 0) {
    push('GEO_ROWS_CHILDREN_FIT', true, 'unasserted (activity rows=0 at this moment)')
  } else {
    const boxR = rect(rowEls[0].parentElement)
    if (boxR === null) push('GEO_ROWS_CHILDREN_FIT', true, 'unasserted (no rows-box rect)')
    else {
      const over = []
      rowEls.forEach((rowEl, i) => Array.from(rowEl.children).forEach((child) => {
        const cr = rect(child)
        if (cr !== null && (cr.right > boxR.right + 1 || cr.left < boxR.left - 1)) {
          over.push(`row${i}:${child.getAttribute('data-ledger-summary') !== null ? 'summary' : child.getAttribute('data-ledger-actor') !== null ? 'actor' : 'child'}`)
        }
      }))
      push('GEO_ROWS_CHILDREN_FIT', over.length === 0, `rows=${rowEls.length} box=[${boxR.left},${boxR.right}] overflow=[${over}]`)
    }
  }
  return { ok: rows.every((r) => r.ok), rows }
}

/** ROUND-5 STABILITY GATE (parent CODE GO). MECHANISM (weighted per the
 *  parent's independent pins): the host tracks the viewport through a
 *  rAF-throttled ResizeObserver — AppFrame.tsx L151-168 — and admits "The JS
 *  solve lags the viewport by a ResizeObserver + rAF frame" (L252-258), so a
 *  resize lands the responsive auto-collapse ONE frame late; the CSS grid
 *  easing (AppFrame.module.css L16, --ds-transition-duration-slow=0.3s at
 *  ui-theme base.css L14) is a TOGGLE-ONLY path (the viewportChanged guard,
 *  L218-224, deliberately skips easing for resize-driven collapses). Expected
 *  settle: 1-3 samples. The gate keys STRICTLY on consecutive-identical
 *  GEOMETRY samples (never on oracle results — waiting for a PASS is
 *  forbidden); bounded ~50ms polls inside the existing OBSERVE_TIMEOUT_MS
 *  deadline; the deadline is typed fail-closed with NO marker. All original
 *  oracles then run ONCE against the settled layout, byte-kept. */
export function sampleFrameGeometryDom(arg) {
  const doc = globalThis.document
  const win = globalThis.window
  const rect4 = (el) => {
    try {
      const r = el.getBoundingClientRect()
      return [Math.round(r.left * 2) / 2, Math.round(r.top * 2) / 2, Math.round(r.width * 2) / 2, Math.round(r.height * 2) / 2]
    } catch { return null }
  }
  const chainOf = (start) => {
    const out = []
    let el = start
    let i = 0
    while (el != null && el.tagName !== 'HTML' && i < 24) {
      let trans = null
      try {
        const cs = win.getComputedStyle(el)
        trans = `${String(cs.transitionProperty)}|${String(cs.transitionDuration)}`
      } catch { /* computed style unavailable — the sample stays structural */ }
      out.push({
        tag: String(el.tagName),
        cls: String(el.getAttribute('class') ?? '').slice(0, 40),
        rect: rect4(el),
        trans,
        animating: typeof el.hasAttribute === 'function' && el.hasAttribute('data-animating')
          ? String(el.getAttribute('data-animating') ?? 'true') : null,
      })
      el = el.parentElement
      i += 1
    }
    return out
  }
  const bars = Array.from(doc.querySelectorAll('[data-ledger-resolve-bar][data-request-id]'))
    .filter((el) => el.getAttribute('data-request-id') === arg.rid)
  const panel = bars.length === 1 ? bars[0] : null
  let sidebarCollapsed = null
  try {
    const n = doc.querySelector('[data-sidebar-collapsed]')
    sidebarCollapsed = n === null ? null : String(n.getAttribute('data-sidebar-collapsed'))
  } catch { /* never fatal */ }
  const railRow = doc.querySelector('[data-row-key]')
  return {
    viewport: [Number.isFinite(win.innerWidth) ? win.innerWidth : null, Number.isFinite(win.innerHeight) ? win.innerHeight : null],
    sidebarCollapsed,
    panelChain: chainOf(panel),
    railChain: railRow === null ? [] : chainOf(railRow),
  }
}

/** Driver: poll sample→sleep→sample until TWO consecutive samples are
 *  byte-identical (easing/relayout is monotonic — equal consecutive samples
 *  means the layout quiesced). Every pre-stability (transient) sample is
 *  kept (bounded) as raw evidence so a future run6-style race is PROVABLE
 *  from the raws. The deadline never degrades into a blind sleep or a
 *  pass-wait: it throws S2O_GEOMETRY_UNSTABLE. */
export async function waitForStableFrameGeometry({ evaluateSample, nowFn, sleepFn, deadlineAt, pollMs = 50, maxPreSamples = 10 }) {
  const preSamples = []
  let prev = await evaluateSample()
  let polls = 1
  for (;;) {
    await sleepFn(pollMs)
    const next = await evaluateSample()
    polls += 1
    if (next === prev) return { gated: true, stable: true, polls, preSamples, settled: next }
    if (preSamples.length < maxPreSamples) preSamples.push(String(next).slice(0, 600))
    if (nowFn() >= deadlineAt) {
      throw new ObserverError('S2O_GEOMETRY_UNSTABLE', `frame geometry never quiesced (${polls} consecutive samples still differing at the bounded deadline) — refusing to measure a mid-relayout state (fail closed, no marker)`)
    }
    prev = next
  }
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

/** EXTERNAL BATCH ITEM-4: the BOOLEAN wait expression. The object-returning
 *  teamViewActivatedDom is a TRAP for any wait predicate — {ok:false} is
 *  TRUTHY, so waitForFunction-style polling resolves instantly on it. The
 *  wait sites therefore poll THIS function (strict true/false, false while
 *  not ready) through waitUntilTruthy, and ONLY AFTER it resolves run the
 *  object helper again as positive re-validation. */
export function teamViewReadyDom(index) {
  const doc = globalThis.document
  const list = doc.querySelector('[data-conversation-tabs][role="tablist"]')
  if (list === null) return false
  const tab = list.querySelectorAll('button[role="tab"]')[index]
  if (tab === undefined || tab.getAttribute('aria-selected') !== 'true') return false
  return doc.querySelector('[data-team-view]') !== null
}

/** Node-side bounded polling driver (host-free and testable — the live run
 *  and the offline suite share this exact body). Resolves true the first
 *  probe returns STRICT true; false at the deadline. Never assumes truthy
 *  objects mean ready (probe results are compared with === true). */
export async function waitUntilTruthy({ probe, deadlineAt, sleepFn, nowFn = () => Date.now() }) {
  for (;;) {
    const value = await probe()
    if (value === true) return true
    if (nowFn() >= deadlineAt) return false
    await sleepFn(TEAM_WAIT_POLL_MS)
  }
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

/** BATCH-6 steps 1–3, PR55-frozen order (dod20-ui-driver.mjs @46043f78 nav
 *  order: dismiss-notice → expand-ungrouped-group → expand-overflow), ONE
 *  scoped role locator per step, each acting at most once, fail-closed after.
 *  A page whose rows already rendered takes ONLY step 1 (count 0 → no click)
 *  and then the untouched pre-BATCH-6 path — the group click is a TOGGLE, so
 *  it may fire ONLY while zero session rows are rendered. */
async function activateFreshBootRail(page, { rootSessionId, nowFn, sleep, onStage = async () => {} }) {
  // step 1 — WelcomeNotice (fresh profile): dismiss via the Continue button,
  // assert-gone; present-but-undismissable and ambiguous are typed refusals.
  await onStage('pre-notice')
  const notice = page.getByRole('button', { name: WELCOME_CONTINUE, exact: true })
  const noticeCount = await notice.count()
  if (noticeCount > 1) throw new ObserverError('S2O_NOTICE_AMBIGUOUS', `${noticeCount} Continue buttons — refusing to guess which dismisses the notice`)
  if (noticeCount === 1) {
    await notice.click()
    const gone = await waitUntilTruthy({
      probe: async () => (await notice.count()) === 0,
      deadlineAt: nowFn() + OBSERVE_TIMEOUT_MS,
      nowFn,
      sleepFn: sleep,
    })
    await onStage('post-notice')
    if (gone !== true) throw new ObserverError('S2O_NOTICE_NOT_DISMISSED', 'the Continue click never dismissed the WelcomeNotice (fail closed, no marker)')
  }
  // steps 2–3 run ONLY while the root row is absent.
  if ((await page.evaluate(rootSessionRowsDom, rootSessionId)) > 0) return
  // step 2 — the collapsed-by-default group header (host e2e
  // agent-preset-selection.e2e.ts:382-383 @46a7f68b09 does exactly this).
  await onStage('pre-group')
  if ((await page.evaluate(sessionRowsAnyDom)) === 0) {
    const group = page.getByRole('treeitem', { name: UNGROUPED_GROUP_NAME })
    const groupCount = await group.count()
    if (groupCount > 1) throw new ObserverError('S2O_GROUP_AMBIGUOUS', `${groupCount} Ungrouped headers — refusing to guess which group holds the root`)
    if (groupCount === 1) {
      await group.click()
      const rowsOn = await waitUntilTruthy({
        probe: async () => (await page.evaluate(sessionRowsAnyDom)) > 0,
        deadlineAt: nowFn() + OBSERVE_TIMEOUT_MS,
        nowFn,
        sleepFn: sleep,
      })
      await onStage('post-group')
      if (rowsOn !== true) throw new ObserverError('S2O_GROUP_EXPAND_NO_ROWS', 'the group header click rendered ZERO session rows — refusing to observe an unopened rail (no positional guessing, no marker)')
    }
    // groupCount === 0: no Ungrouped header (sessions may live under a named
    // workspace group already open) — fall through; the EXACT root-row demand
    // below stays the arbiter and refuses typed if nothing carries it. The
    // structured diagnostic EVIDENCES this state (ungroupedCount=0) without
    // the activation ever guessing a target.
  }
  // step 3 — the post-expansion overflow (PR55: "THE OVERFLOW BUTTON ONLY
  // EXISTS AFTER THE GROUP EXPANSION"); bounded loop, each click must remove
  // the button it acted on, and the loop stops the moment the root appears.
  await onStage('pre-overflow')
  for (let opened = 0; opened < 5; opened += 1) {
    if ((await page.evaluate(rootSessionRowsDom, rootSessionId)) > 0) return
    const more = page.getByRole('button', { name: OVERFLOW_BUTTON_NAME })
    const moreCount = await more.count()
    if (moreCount === 0) return
    if (moreCount > 1) throw new ObserverError('S2O_OVERFLOW_AMBIGUOUS', `${moreCount} overflow buttons visible at once — refusing to guess which list to expand`)
    await more.click()
    await onStage('post-overflow')
  }
  throw new ObserverError('S2O_OVERFLOW_UNBOUNDED', 'the session overflow kept offering more pages past the bounded 5 expansions — refusing an unbounded rail walk')
}

/** PARENT-AUTHORIZED MEMBER PERSPECTIVE: bounded durable provenance check
 *  (member session → member instance → Tmain root) over THIS world's
 *  storages/team_domain.json — the exact shape verified live at
 *  tests/homes/prereq-2026-10-01T20-10-50 (@2026-10-01): tables.session_bindings
 *  [sessionId] = JSON string {instanceId, kind:'team-member', rootSessionId,
 *  schemaVersion, sessionId}; tables.member_instances is keyed by the JSON
 *  string {"instanceId","rootSessionId"} and its value carries childSessionId.
 *  ZERO UI involvement, ZERO writes; every refusal typed. NEVER a fallback to
 *  "first visible row" — the binding is the ONLY entry authority. */
export function resolveMemberBinding({ teamDomainPath, memberSessionId, expectedRootSessionId }) {
  if (!MEMBER_SESSION_RE.test(String(memberSessionId))) {
    throw new ObserverError('CLI_MEMBER_SESSION_SHAPE', `--member-session must match ${MEMBER_SESSION_RE}`)
  }
  let st = null
  try { st = lstatSync(teamDomainPath) } catch { /* typed below */ }
  if (st === null || !st.isFile() || st.isSymbolicLink()) {
    throw new ObserverError('S2O_MEMBER_DOMAIN_SHAPE', `--team-domain must be a regular file (the world's storages/team_domain.json): ${teamDomainPath}`)
  }
  if (st.size > TEAM_DOMAIN_MAX_BYTES) {
    throw new ObserverError('S2O_MEMBER_DOMAIN_SHAPE', `--team-domain is ${st.size}B > ${TEAM_DOMAIN_MAX_BYTES}B bound — refusing to parse a domain file this large`)
  }
  let doc = null
  try { doc = JSON.parse(readFileSync(teamDomainPath, 'utf8')) } catch {
    throw new ObserverError('S2O_MEMBER_DOMAIN_SHAPE', `--team-domain is not parseable JSON: ${teamDomainPath}`)
  }
  const bindings = doc?.tables?.session_bindings
  const instances = doc?.tables?.member_instances
  if (!isPlainObjectDoc(bindings) || !isPlainObjectDoc(instances)) {
    throw new ObserverError('S2O_MEMBER_DOMAIN_SHAPE', 'team_domain.json lacks tables.session_bindings / tables.member_instances (this is not a team_domain file)')
  }
  const rawBinding = bindings[memberSessionId]
  if (typeof rawBinding !== 'string') {
    throw new ObserverError('S2O_MEMBER_NOT_IN_BINDINGS', `no session_bindings row exists for ${memberSessionId} — the member session is not a durable child of THIS world (no guessing, no fallback row)`)
  }
  let binding = null
  try { binding = JSON.parse(rawBinding) } catch { /* typed below */ }
  if (binding === null || typeof binding !== 'object') {
    throw new ObserverError('S2O_MEMBER_BINDING_MISMATCH', `the session_bindings row for ${memberSessionId} is not a JSON object — refusing`)
  }
  if (binding.kind !== 'team-member' || binding.sessionId !== memberSessionId || binding.rootSessionId !== expectedRootSessionId || !MEMBER_INSTANCE_ID_RE.test(String(binding.instanceId))) {
    throw new ObserverError('S2O_MEMBER_BINDING_MISMATCH', `the durable binding of ${memberSessionId} does not name kind=team-member / itself / the expected rootSessionId / a shaped instanceId — the member belongs to a DIFFERENT world or root (fail closed, no marker)`)
  }
  let matches = 0
  for (const [rawKey, rawVal] of Object.entries(instances)) {
    let key = null
    let val = null
    try { key = JSON.parse(rawKey); val = JSON.parse(String(rawVal)) } catch { continue }
    if (key?.instanceId === binding.instanceId && key?.rootSessionId === expectedRootSessionId && val?.childSessionId === memberSessionId) matches += 1
  }
  if (matches !== 1) {
    throw new ObserverError('S2O_MEMBER_BINDING_MISMATCH', `member_instances holds ${matches} row(s) for {instance:${binding.instanceId}, root:expected} → child ${memberSessionId} (exactly 1 required) — the durable provenance chain is not singular (fail closed, no marker)`)
  }
  return { memberInstanceId: binding.instanceId, memberRootSessionId: binding.rootSessionId, memberSessionId }
}

function isPlainObjectDoc(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v)
}

/** PARENT-AUTHORIZED STRUCTURED ENTRY DIAGNOSTIC — replaces the sanitized-DOM
 *  dump CONTENT (0600 atomic first-writer writer byte-kept; still NO PNG per
 *  the external-found ruling). Values come ONLY from entryDiagnosticDom's
 *  whitelist (booleans / integers / closed enums) plus kind, typed code and
 *  the already-held rootSessionId — secrets are structurally impossible. The
 *  residual scanForSecrets tripwire STAYS as-is (defense-in-depth): clean by
 *  construction means it should never fire, weakening it is not on the table.
 *  Fully best-effort: a diagnostic failure never masks the typed failure. */
function captureEntryFailureDiagnostic({ evidenceDir, secrets, code, stages, rootSessionId, entrySessionId }) {
  try {
    // Bounded ids ONLY: the world-shaped synthetic prefixes; anything else
    // serializes as null (the shape stays structural, never arbitrary text).
    const diagId = (v) => (typeof v === 'string' && DIAG_ID_RE.test(v) ? v : null)
    const payload = {
      kind: 's2o-entry-diagnostic',
      code: String(code).replace(/[^\w.:-]/g, '_').slice(0, 64),
      rootSessionId: diagId(rootSessionId),
      entrySessionId: diagId(entrySessionId),
      stages,
    }
    while (JSON.stringify(payload).length > ENTRY_DUMP_MAX_CHARS && payload.stages.length > 1) payload.stages.pop()
    let text = JSON.stringify(payload, null, 2)
    if (scanForSecrets(text, secrets).length > 0) text = '{"kind":"s2o-entry-diagnostic","suppressed":"tripwire"}'
    writeEntryDumpAtomic({ dir: evidenceDir, text })
  } catch { /* the diagnostic NEVER masks or replaces the typed failure */ }
}

export async function runObservation(opts, { launch = null, nowFn = () => Date.now(), sleepFn = null } = {}) {
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
  // Item-1: from this line on, EVERY error boundary (cliMain included)
  // scrubs the launch URL and its token values from printed text.
  setLaunchSecrets(secrets)
  // BATCH-3 BLOCK-B: the root identity is a durable prerequisite — refuse
  // BEFORE touching the browser if the same fact doc does not carry it.
  const rootSessionId = expected.rootSessionId
  if (typeof rootSessionId !== 'string') {
    throw new ObserverError('S2O_ROOT_ID_MISSING', 'the durable fact carries no rootSessionId — the root session to open MUST come from the same durable request (--digest-file with the ledger row); no default-session guessing')
  }
  // PARENT-AUTHORIZED MEMBER PERSPECTIVE (test-lane): the DEFAULT entry is
  // the root row (unchanged); --member-session switches the entry TARGET to
  // the durable child session — but ONLY after the member→instance→Tmain
  // provenance chain has been verified from this world's team_domain.json,
  // BEFORE any browser launch. The reviewPayload (live-verified) carries a
  // top-level rootSessionId; member mode demands it equal the durable root,
  // or the member perspective would be unprovable. No fallback, ever.
  const memberMode = typeof opts.memberSessionId === 'string'
  let memberBinding = null
  if (memberMode) {
    memberBinding = resolveMemberBinding({
      teamDomainPath: opts.teamDomainPath,
      memberSessionId: opts.memberSessionId,
      expectedRootSessionId: rootSessionId,
    })
    if (expected.payloadValue === null || typeof expected.payloadValue !== 'object' || expected.payloadValue.rootSessionId !== rootSessionId) {
      throw new ObserverError('S2O_MEMBER_BINDING_MISMATCH', 'member mode requires the durable reviewPayload to carry a rootSessionId EQUAL to the durable root — the observed perspective would be unprovable (fail closed, no marker)')
    }
  }
  const entrySessionId = memberMode ? opts.memberSessionId : rootSessionId
  const sleep = sleepFn ?? ((ms) => new Promise((done) => setTimeout(done, ms)))
  const testuseDir = opts.testuse ?? defaultTestuseRoot()
  // BATCH-3 BLOCK-A: the verified config (system Chrome, sandbox ON, pipe) is
  // built HERE — the seam receives it too, so an injected launcher can never
  // mask what the real branch would have used.
  const launchOptions = buildLaunchOptions({ chromePath: opts.chromePath ?? DEFAULT_CHROME_PATH })
  const browser = typeof launch === 'function'
    ? await launch(launchOptions)
    : await (async () => { const { chromium } = loadPlaywrightFrom(testuseDir); return chromium.launch(launchOptions) })()
  try {
    // Item-2: ONE durable expectation for BOTH viewport passes — RID length,
    // FULL wire-digest length, and the DURABLE payload JSON length (never a
    // viewport's own rendered text).
    const durableLens = narrowExpectedLengths({
      rid: opts.rid, expectedDigest: expected.expectedDigest, payloadValue: expected.payloadValue,
    })
    const passes = {}
    // BATCH-4 (single-page entry — SESSION CONTINUITY): ONE context/page at
    // the normal viewport, login ONCE, root row selected once at wide width;
    // the narrow pass RESIZES the same page. A fresh 380px context could
    // never re-select the root — below SIDEBAR_AUTO_COLLAPSE=1024 the sidebar
    // auto-collapses (ui-layout/src/client/columns.ts L23; AppFrame.tsx
    // L178-182 `narrow ⇒ !narrowExpanded`; stores.ts fresh narrowExpanded:
    // false) and the session list is WIDE-ONLY, rendering ZERO treeitems
    // below the breakpoint (ui-workspace/.../WorkspaceBrowser.tsx L1275-1278
    // "the list itself is wide-only"). The narrow pass demands NOTHING
    // invisible and re-proves identity from the open session's HEADER.
    const context = await browser.newContext({ viewport: opts.viewport })
    try {
        const page = await context.newPage()
        // Item-1: Playwright navigation failures embed the launch URL (token
        // query) in their message/stack — route them through the scrub and a
        // typed code BEFORE anything can print them.
        try {
          await page.goto(access.launchUrl, { waitUntil: 'domcontentloaded', timeout: BOOT_TIMEOUT_MS })
        } catch (error) {
          const scrubbed = scrubErrorText(error?.message ?? String(error), secrets)
          throw new ObserverError('S2O_NAV_FAILED', `navigation refused: ${scrubbed.suppressed ? '[suppressed by token tripwire]' : scrubbed.text.slice(0, 300)}`)
        }
        // BATCH-3 BLOCK-B + BATCH-6: EXPLICIT root entry. BATCH-6 LIVE FACT
        // (@2026-10-01T20-10-50): a FRESH context lands on a rail whose group
        // collapses by default (host e2e agent-preset-selection.e2e.ts:382
        // @46a7f68b09) behind a WelcomeNotice — the pre-BATCH-6 path demanded
        // the root row there and died S2O_ROOT_ROW_MISSING. The PR55-proven
        // activation (dismiss-notice → expand-group → expand-overflow, one
        // scoped click each) now runs BEFORE the exact-row demand; every
        // refusal stays typed, and any ENTRY-stage failure first writes ONE
        // structured whitelisted diagnostic into the evidence dir (parent-
        // authorized; read-only snapshots, NO behavior influence).
        const entryStages = []
        const snapEntryStage = async (stage) => {
          entryStages.push({ stage, ...(await page.evaluate(entryDiagnosticDom, entrySessionId)) })
        }
        try {
          await snapEntryStage('nav')
          await page.waitForSelector('[role="treeitem"]', { timeout: OBSERVE_TIMEOUT_MS })
          await activateFreshBootRail(page, { rootSessionId: entrySessionId, nowFn, sleep, onStage: snapEntryStage })
          const rootCount = await page.evaluate(rootSessionRowsDom, entrySessionId)
          if (rootCount === 0) {
            throw new ObserverError('S2O_ROOT_ROW_MISSING', `no session-browser row carries data-row-key="session:${entrySessionId}" even after the bounded fresh-boot activation (notice/group/overflow) — refusing to observe whatever session the page landed on (entry perspective: ${memberMode ? 'member' : 'root'})`)
          }
          if (rootCount > 1) {
            throw new ObserverError('S2O_ROOT_ROW_AMBIGUOUS', `${rootCount} rows carry the root session id — refusing to pick one`)
          }
          const rootRow = await page.$(`[data-row-key="session:${entrySessionId.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"]`)
          if (rootRow === null) throw new ObserverError('S2O_ROOT_ROW_MISSING', 'the entry row vanished between count and click')
          // THE entry selection click (coordinator ruling 2026-10-02; the
          // notice/group/overflow clicks above are the PR55-proven activation
          // steps, each scoped + at-most-once). Never allow/deny/refresh.
          await rootRow.click()
          const rootReady = await waitUntilTruthy({
            probe: () => page.evaluate(rootSessionReadyDom, entrySessionId),
            deadlineAt: nowFn() + OBSERVE_TIMEOUT_MS,
            nowFn,
            sleepFn: sleep,
          })
          if (rootReady !== true) {
            throw new ObserverError('S2O_ROOT_NEVER_SELECTED', `the entry row never reached aria-selected=true within ${OBSERVE_TIMEOUT_MS}ms (fail closed, no marker)`)
          }
          const rootCheck = await page.evaluate(rootSessionValidatedDom, entrySessionId)
          if (rootCheck.ok !== true) {
            throw new ObserverError(`S2O_${rootCheck.code}`, `entry identity verification refused: ${rootCheck.code}`)
          }
        } catch (error) {
          captureEntryFailureDiagnostic({
            evidenceDir: opts.evidenceDir, secrets, code: error?.code ?? 'ENTRY_UNTYPED',
            stages: entryStages, rootSessionId, entrySessionId,
          })
          throw error
        }
        await page.waitForSelector('[data-conversation-tabs][role="tablist"] button[role="tab"]', { timeout: OBSERVE_TIMEOUT_MS })
        const tab = await page.evaluate(resolveTeamTabDom, TEAM_TAB_LABELS)
        if (tab.ok !== true) throw new ObserverError(`S2O_${tab.code}`, `Team tab activation refused: ${tab.code}`)
        const handles = await page.$('[data-conversation-tabs][role="tablist"]')
          .then((list) => (list === null ? [] : list.$$('button[role="tab"]')))
        // THE single sanctioned click (coordinator-pinned Team-entry
        // activation). Never allow/deny, never refresh, never any other control.
        await handles[tab.index].click()
        // Item-4: the wait polls the BOOLEAN predicate (false while not
        // ready — the old object-return {ok:false} was TRUTHY and made the
        // wait a no-op). Timeout = typed fail-closed, nothing written.
        const ready = await waitUntilTruthy({
          probe: () => page.evaluate(teamViewReadyDom, tab.index),
          deadlineAt: nowFn() + OBSERVE_TIMEOUT_MS,
          nowFn,
          sleepFn: sleep,
        })
        if (ready !== true) {
          throw new ObserverError('S2O_TEAM_TAB_NEVER_ACTIVATED', `the Team tab never reached aria-selected=true with [data-team-view] visible within ${OBSERVE_TIMEOUT_MS}ms (fail closed, no marker)`)
        }
        // Post-resolve POSITIVE re-validation with the typed object helper.
        const activated = await page.evaluate(teamViewActivatedDom, tab.index)
        if (activated.ok !== true) {
          throw new ObserverError(`S2O_TEAM_ACTIVATION_INVALID`, `post-activation validation refused: ${activated.code}`)
        }
        await page.locator('[data-team-view]').first().waitFor({ state: 'visible', timeout: OBSERVE_TIMEOUT_MS })
        await page.waitForSelector(`[data-ledger-resolve-bar][data-request-id="${opts.rid}"]`, { timeout: OBSERVE_TIMEOUT_MS })
        // Wide pass: NO gate (no resize happened) — ONE whitelisted geometry
        // diagnostic sample per the round-5 ruling (1440/380 only, no ladder).
        const geometryNormalSample = await page.evaluate(sampleFrameGeometryDom, { rid: opts.rid })
        const fields = await page.evaluate(extractPanelFields, opts.rid)
        const narrow = await page.evaluate(checkNarrowLegibility, { rid: opts.rid, expected: durableLens })
        // GEOMETRY READS ride the SAME narrow-rows array (shape unchanged);
        // readability predicates above are byte-kept, this only ANDs in.
        const geoNormal = await page.evaluate(checkGeometryDom, { rid: opts.rid })
        const shotFull = await page.screenshot({ fullPage: true })
        const shotPanel = await page.locator(`[data-ledger-resolve-bar][data-request-id="${opts.rid}"]`).screenshot()
        passes.normal = { fields, narrow: { ok: narrow.ok === true && geoNormal.ok === true, rows: [...narrow.rows, ...geoNormal.rows] }, geometry: { gated: false, samples: [geometryNormalSample] }, shotFull, shotPanel }
        // ── narrow pass: RESIZE the SAME page (no re-navigation, no re-login,
        // no sidebar demand). ROOT BINDING on narrow = the PANEL, not header
        // text (external runtime ruling @23a43f20: the header renders the
        // display TITLE, never the raw sessionId, for sessions inside
        // ancestry — asserting raw-id header text is a known-fail live path).
        // Same RID + full wire digest + reviewPayload DEEP-EQUAL (which
        // includes payload.rootSessionId whenever the durable reviewed payload
        // carries it), all re-verified against the durable source below; the
        // wide pass remains the root-ENTRY proof (two sanctioned clicks +
        // typed re-validation on this same page/session).
        await page.setViewportSize({ width: opts.narrow.width, height: opts.narrow.height })
        const tabStill = await waitUntilTruthy({
          probe: () => page.evaluate(teamViewReadyDom, tab.index),
          deadlineAt: nowFn() + OBSERVE_TIMEOUT_MS,
          nowFn,
          sleepFn: sleep,
        })
        if (tabStill !== true) {
          throw new ObserverError('S2O_TEAM_TAB_NEVER_ACTIVATED', 'the Team view is no longer active on the resized page (fail closed, no marker)')
        }
        const activatedNarrow = await page.evaluate(teamViewActivatedDom, tab.index)
        if (activatedNarrow.ok !== true) {
          throw new ObserverError('S2O_TEAM_ACTIVATION_INVALID', `post-resize activation validation refused: ${activatedNarrow.code}`)
        }
        await page.locator('[data-team-view]').first().waitFor({ state: 'visible', timeout: OBSERVE_TIMEOUT_MS })
        await page.waitForSelector(`[data-ledger-resolve-bar][data-request-id="${opts.rid}"]`, { timeout: OBSERVE_TIMEOUT_MS })
        // ROUND-5 STABILITY GATE (run6): wait for the RESIZED layout to
        // QUIESCE (two consecutive identical geometry samples — keyed ONLY
        // on geometry identity, never on oracle results) before any oracle
        // is evaluated; bounded deadline is typed fail-closed, no marker.
        const stabilityNarrow = await waitForStableFrameGeometry({
          evaluateSample: async () => JSON.stringify(await page.evaluate(sampleFrameGeometryDom, { rid: opts.rid })),
          nowFn,
          sleepFn: sleep,
          deadlineAt: nowFn() + OBSERVE_TIMEOUT_MS,
        })
        const fieldsNarrow = await page.evaluate(extractPanelFields, opts.rid)
        const narrowNarrow = await page.evaluate(checkNarrowLegibility, { rid: opts.rid, expected: durableLens })
        const geoNarrow = await page.evaluate(checkGeometryDom, { rid: opts.rid })
        const shotFullNarrow = await page.screenshot({ fullPage: true })
        const shotPanelNarrow = await page.locator(`[data-ledger-resolve-bar][data-request-id="${opts.rid}"]`).screenshot()
        passes.narrow = { fields: fieldsNarrow, narrow: { ok: narrowNarrow.ok === true && geoNarrow.ok === true, rows: [...narrowNarrow.rows, ...geoNarrow.rows] }, geometry: { gated: stabilityNarrow.gated, stable: stabilityNarrow.stable, polls: stabilityNarrow.polls, preSamples: stabilityNarrow.preSamples, settled: stabilityNarrow.settled }, shotFull: shotFullNarrow, shotPanel: shotPanelNarrow }
    } finally {
        await context.close()
    }
    // Item-2: the gate — BOTH viewports deep-equal the durable source AND
    // BOTH layout passes hold, or nothing ships.
    const verdict = evaluatePasses({
      phases: passes,
      expected: { rid: opts.rid, expectedDigest: expected.expectedDigest, payloadValue: expected.payloadValue },
    })
    const allPassed = verdict.ok === true
    // PARENT P1 (BINDING ORDERING LAW): the marker is an ATOMIC PUBLICATION
    // a LIVE kit can consume the instant it exists — so EVERY required
    // verification (all comparison oracles above, the durable-binding drift
    // recheck and the marker-content guard here) completes BEFORE the
    // publication point; after writeMarkerIfAllPass NOTHING required remains,
    // and a typed failure can therefore never coexist with a marker it
    // rejects. (The earlier "an orphan marker is never consumed" reasoning is
    // RETRACTED — it is false for live consumers.) Runs only on the publish
    // branch (allPassed) — a failed verdict publishes nothing anyway.
    if (memberMode && allPassed) {
      const recheck = resolveMemberBinding({
        teamDomainPath: opts.teamDomainPath,
        memberSessionId: opts.memberSessionId,
        expectedRootSessionId: rootSessionId,
      })
      if (JSON.stringify(recheck) !== JSON.stringify(memberBinding)) {
        throw new ObserverError('S2O_MEMBER_BINDING_MISMATCH', 'the durable member binding CHANGED between entry and the pre-publication recheck — provenance drift (fail closed, NOTHING published)')
      }
      // Marker-content guard: the exact values about to be published are
      // re-verified against the durable access record BEFORE the write —
      // same pending RID + durable digest, never after.
      if (access.requestId !== opts.rid || (typeof access.reviewPayloadDigest === 'string' && access.reviewPayloadDigest !== expected.expectedDigest)) {
        throw new ObserverError('S2O_MEMBER_BINDING_MISMATCH', 'the marker content guard refused the pending RID / durable digest pair BEFORE publication (fail closed, NOTHING published)')
      }
    }
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
        normal: { fields: verdict.normalChecks.checks, narrow: passes.normal.narrow.rows, geometry: passes.normal.geometry ?? null },
        narrow: { fields: verdict.narrowChecks.checks, narrow: passes.narrow.narrow.rows, geometry: passes.narrow.geometry ?? null },
      }, null, 2),
      'shot-normal.png': passes.normal.shotFull,
      'shot-narrow.png': passes.narrow.shotFull,
      'panel-normal.png': passes.normal.shotPanel,
      'panel-narrow.png': passes.narrow.shotPanel,
    }
    const evidence = writeEvidenceBundle(opts.evidenceDir, {
      ...evidenceFiles,
      'meta.json': JSON.stringify({
        ...JSON.parse(evidenceFiles['meta.json']),
        entryPerspective: memberMode ? 'member' : 'root', // HONEST (DoD f): never claimed leader
        entrySessionId: typeof entrySessionId === 'string' && DIAG_ID_RE.test(entrySessionId) ? entrySessionId : null,
        memberInstanceId: memberBinding?.memberInstanceId ?? null,
      }, null, 2),
    }, secrets)
    const marker = writeMarkerIfAllPass({
      allPassed, markerDir: opts.markerDir, requestId: opts.rid, digest: expected.expectedDigest,
    })
    if (marker.ok !== true) {
      throw new ObserverError('S2O_CHECKS_FAILED', `observation refused the marker (${marker.reason}) — see ${join(evidence.dir, 'comparisons.json')}`)
    }
    // P1 ORDERING: the marker write above is the LAST consequential action;
    // nothing required follows it — only the result handoff.
    return {
      ok: true, markerPath: marker.path, evidenceDir: evidence.dir,
      entryPerspective: memberMode ? 'member' : 'root',
      memberInstanceId: memberBinding?.memberInstanceId ?? null,
    }
  } finally {
    await browser.close()
  }
}

// ── BATCH-3 BLOCK-A: verified system Chrome + sandbox ON + pipe transport ───

/** The user's explicit stage-2 condition: run the VERIFIED system Chrome with
 *  the chromium sandbox ENABLED over Playwright's pipe transport. Playwright
 *  defaults are the opposite (its own cached browser, sandbox off) — so the
 *  options are built HERE, explicitly, and the call site takes nothing else. */
export const DEFAULT_CHROME_PATH = '/opt/google/chrome/chrome'

export function buildLaunchOptions({ chromePath = DEFAULT_CHROME_PATH } = {}) {
  if (typeof chromePath !== 'string' || chromePath === '') {
    throw new ObserverError('S2O_CHROME_MISSING', 'chromePath must be a non-empty string')
  }
  if (!existsSync(chromePath)) {
    throw new ObserverError('S2O_CHROME_MISSING', `system Chrome not found at ${chromePath} — the verified-system-Chrome condition is unmet (pass --chrome <path>) — refusing to launch (fail closed)`)
  }
  const st = lstatSync(chromePath) // lstat: a SYMLINK is not a regular file
  if (!st.isFile()) {
    throw new ObserverError('S2O_CHROME_NOT_FILE', `${chromePath} is not a regular file (symlink/dir refused)`)
  }
  // NO args array at all: nothing can carry --no-sandbox/--disable-gpu-sandbox.
  return { headless: true, executablePath: chromePath, chromiumSandbox: true, pipe: true }
}

// ── BATCH-3 BLOCK-B: explicit root-session entry (no random-default trust) ──
// Target identity = the SAME durable fact row's rootSessionId (kit seedFact
// L785-797 writes {factType, createdAt, payload, rootSessionId, schemaVersion,
// sequence}; real-world shape 'session-mpr-t1-mpr-2026-10-01T13-21-34').
// The pinned TestUse checkout has NO URL-level session selection
// (apps/web/src/main.ts boots AppWebEntry with no query/route session param),
// so the ONLY supported affordance is the session browser row:
//   packages/client/ui-workspace/src/client/rows/Rows.tsx @46a7f68b09
//     L571  data-row-key={`session:${node.id}`}   (identity carrier)
//     L577  role="treeitem"  L578 aria-selected={node.id === currentId}
//     L580  onClick={() => onOpen(node.id)}       (currentId: WorkspaceBrowser.tsx L506)
// All three adapters are transportable (globalThis.document + JSON arg).

export function rootSessionRowsDom(rootSessionId) {
  const esc = String(rootSessionId).replace(/\\/g, '\\\\').replace(/"/g, '\\"')
  return globalThis.document.querySelectorAll(`[data-row-key="session:${esc}"]`).length
}

/** BOOLEAN wait expression (false while not ready — same discipline as
 *  teamViewReadyDom): exactly ONE row carrying the root id AND selected. */
export function rootSessionReadyDom(rootSessionId) {
  const doc = globalThis.document
  const esc = String(rootSessionId).replace(/\\/g, '\\\\').replace(/"/g, '\\"')
  const rows = doc.querySelectorAll(`[data-row-key="session:${esc}"]`)
  return rows.length === 1 && rows[0].getAttribute('aria-selected') === 'true'
}

/** Post-selection POSITIVE verification (typed). */
export function rootSessionValidatedDom(rootSessionId) {
  const doc = globalThis.document
  const esc = String(rootSessionId).replace(/\\/g, '\\\\').replace(/"/g, '\\"')
  const rows = doc.querySelectorAll(`[data-row-key="session:${esc}"]`)
  if (rows.length === 0) return { ok: false, code: 'ROOT_ROW_MISSING' }
  if (rows.length > 1) return { ok: false, code: 'ROOT_ROW_AMBIGUOUS' }
  if (rows[0].getAttribute('aria-selected') !== 'true') return { ok: false, code: 'ROOT_MISMATCH' }
  return { ok: true }
}

/** BATCH-6 activation predicate: ANY session row rendered (the group is open
 *  — Rows.tsx L571 key convention @46a7f68b09). Transportable adapter. */
export function sessionRowsAnyDom() {
  return globalThis.document.querySelectorAll('[data-row-key^="session:"]').length
}

/** PARENT-AUTHORIZED STRUCTURED ENTRY DIAGNOSTIC (transportable, READ-ONLY —
 *  zero behavior influence). One per-stage snapshot for the entry-failure
 *  artifact. VALUES ARE STRICTLY booleans / integers / closed enums (plus the
 *  rootSessionId the caller already holds in typed form) — secrets are
 *  STRUCTURALLY impossible, so the residual tripwire can simply never fire
 *  (it stays, defense-in-depth, unweakened). The queries reuse the exact
 *  role-scoped predicates the activation itself uses — no new surface. */
export function entryDiagnosticDom(rootSessionId) {
  const doc = globalThis.document
  const esc = String(rootSessionId).replace(/\\/g, '\\\\').replace(/"/g, '\\"')
  const acc = (el) => String(el.getAttribute('aria-label') ?? el.textContent ?? '').trim()
  const continueButtons = Array.from(doc.querySelectorAll('button, [role="button"]')).filter((el) => acc(el) === 'Continue').length
  const ungrouped = Array.from(doc.querySelectorAll('[role="treeitem"]')).filter((el) => /^Ungrouped/.test(acc(el)))
  const match = doc.querySelector(`[data-row-key="session:${esc}"]`)
  let matchGroupState = 'absent'
  if (match !== null) {
    let group = typeof match.closest === 'function' ? match.closest('[role="treeitem"][aria-expanded]') : null
    if (group === null && typeof match.closest === 'function') {
      const tree = match.closest('[role="tree"]')
      group = tree === null ? null : tree.querySelector('[role="treeitem"][aria-expanded]')
    }
    if (group !== null) matchGroupState = group.getAttribute('aria-expanded') === 'true' ? 'expanded' : 'collapsed'
  }
  const sole = ungrouped.length === 1 ? ungrouped[0].getAttribute('aria-expanded') : null
  return {
    welcomeVisible: continueButtons > 0,
    welcomeCount: continueButtons,
    ungroupedCount: ungrouped.length,
    ungroupedExpanded: ungrouped.length === 1 && sole !== null ? sole === 'true' : null,
    treeitemCount: doc.querySelectorAll('[role="treeitem"]').length,
    rowCount: doc.querySelectorAll('[data-row-key^="session:"]').length,
    expectedRootPresent: match !== null,
    matchKeyAttr: match !== null,
    matchGroupState,
  }
}

/** BATCH-6 one-file 0600 artifact, tmp+rename (mirrors writeMarkerAtomic's fd
 *  discipline). First-writer-wins: a later failure never overwrites the
 *  artifact of the FIRST one. Best-effort — a write failure never masks the
 *  typed failure it documents. CONTENT since the parent-authorized structured
 *  diagnostic: whitelisted JSON (s2o-entry-dump.json); the mechanics here are
 *  byte-kept from the sanitized-dump era. */
export function writeEntryDumpAtomic({ dir, text }) {
  const finalPath = join(dir, 's2o-entry-dump.json')
  if (existsSync(finalPath)) return { written: false, path: finalPath }
  const tmpPath = `${finalPath}.tmp-${process.pid}`
  let fd = null
  try {
    fd = openSync(tmpPath, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600)
    writeSync(fd, text)
    closeSync(fd)
    fd = null
    const st = lstatSync(tmpPath)
    if (!st.isFile() || (st.mode & 0o777) !== 0o600) chmodSync(tmpPath, 0o600)
    renameSync(tmpPath, finalPath)
    return { written: true, path: finalPath }
  } catch (error) {
    if (fd !== null) { try { closeSync(fd) } catch { /* best effort */ } }
    try { rmSync(tmpPath, { force: true }) } catch { /* our own tmp only */ }
    return { written: false, path: finalPath, error: String(error?.message ?? error).slice(0, 160) }
  }
}

// ── EXTERNAL BATCH ITEM-2: durable narrow lengths + BOTH-viewport verdict ───

/** Item-2: the narrow-pass length expectations come from the DURABLE source
 *  ONLY (rid CLI value, the durable wire digest, the durable payload JSON) —
 *  NEVER from the narrow viewport's own rendered text (self-length made the
 *  narrow check tautological). Both viewport passes get the SAME object. */
export function narrowExpectedLengths({ rid, expectedDigest, payloadValue }) {
  return {
    ridLen: rid.length,
    digestLen: expectedDigest.length,
    payloadLen: JSON.stringify(payloadValue, null, 2).length,
  }
}

/** Item-2: the pure all-pass gate over BOTH viewport passes — EACH viewport
 *  runs checkFields against the SAME durable expected (RID equality, FULL
 *  wire digest equality, payload deep-equality) AND its layout rows. The
 *  marker may be considered ONLY when every check across BOTH passes holds
 *  (thresholds are never relaxed for the narrow pass). */
export function evaluatePasses({ phases, expected }) {
  const args = { expectedRid: expected.rid, expectedDigest: expected.expectedDigest, payloadValue: expected.payloadValue }
  const normalChecks = checkFields({ fields: phases.normal.fields, ...args })
  const narrowChecks = checkFields({ fields: phases.narrow.fields, ...args })
  const ok = normalChecks.ok === true
    && narrowChecks.ok === true
    && phases.normal.narrow?.ok === true
    && phases.narrow.narrow?.ok === true
  return { ok, normalChecks, narrowChecks }
}

// ── EXTERNAL BATCH ITEM-1: the SHARED secret scrub (every output boundary) ──

/** Launch-time secrets learned when the access record is read (launchUrl and
 *  its query values). Held module-side so ANY error printed later — including
 *  Playwright navigation stacks embedding the URL — passes the same scrub. */
let launchSecrets = []

export function setLaunchSecrets(secrets) {
  launchSecrets = Array.isArray(secrets) ? secrets.filter((s) => typeof s === 'string' && s.length >= 8) : []
}

/** The single scrub used by ALL error-output boundaries: known secret
 *  substrings → '[scrubbed]', any `token=` VALUE → '[scrubbed]'. If ANY
 *  token-shaped uncertainty survives (a `token=` whose value we could not
 *  demonstrably replace), the text is SUPPRESSED — the caller prints only
 *  the typed code, never the underlying message. */
export function scrubErrorText(text, secrets = launchSecrets) {
  let out = String(text ?? '')
  for (const secret of secrets) {
    if (typeof secret === 'string' && secret.length >= 8) out = out.split(secret).join('[scrubbed]')
  }
  out = out.replace(/(\btoken\s*=\s*)(?:%20|\s)*[^\s&;"'`}<>)\],]+/gi, '$1[scrubbed]')
  let suppressed = /\btoken\s*=\s*(?!\[scrubbed\])/i.test(out)
  for (const secret of secrets) {
    if (typeof secret === 'string' && out.includes(secret)) suppressed = true
  }
  return { text: suppressed ? '' : out, suppressed }
}

// ── EXTERNAL BATCH ITEM-1: the REAL CLI boundary (testable, single impl) ────

/** The one CLI boundary: parses, runs, and formats ALL output. EVERY printed
 *  byte passes scrubErrorText; typed ObserverError → exit 2, unknown error
 *  (Playwright timeouts included — their stacks embed the token URL) → exit
 *  1, suppression keeps no message body. main() delegates here; the offline
 *  suite drives THIS function, never a reimplementation. */
export async function cliMain({
  argv, run = runObservation,
  stdout = (s) => process.stdout.write(s),
  stderr = (s) => process.stderr.write(s),
} = {}) {
  try {
    const opts = parseCli(argv)
    const result = await run(opts)
    stdout(`STAGE2_OBSERVE_PASS ${result.markerPath}\n`)
    return 0
  } catch (error) {
    if (error instanceof ObserverError) {
      const scrubbed = scrubErrorText(error.message)
      stderr(`STAGE2_OBSERVER_FAIL ${error.code} :: ${scrubbed.suppressed ? '[suppressed by token tripwire]' : scrubbed.text.slice(0, 400)}\n`)
      return 2
    }
    const scrubbed = scrubErrorText(`${error?.name ?? 'Error'}: ${error?.message ?? ''}\n${error?.stack ?? ''}`)
    stderr(`STAGE2_OBSERVER_FATAL ${scrubbed.suppressed ? '[suppressed by token tripwire]' : scrubbed.text.slice(0, 800)}\n`)
    return 1
  }
}

async function main() {
  process.exitCode = await cliMain({ argv: process.argv.slice(2) })
}

const invokedDirectly = process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (invokedDirectly) {
  main().catch((error) => {
    // Belt for main() itself (cliMain swallows run errors; a fault in the
    // delegation is still scrubbed — NO raw stack ever reaches stderr).
    const scrubbed = scrubErrorText(`${error?.name ?? 'Error'}: ${error?.message ?? ''}\n${error?.stack ?? ''}`)
    process.stderr.write(`STAGE2_OBSERVER_FATAL ${scrubbed.suppressed ? '[suppressed by token tripwire]' : scrubbed.text.slice(0, 800)}\n`)
    process.exitCode = 1
  })
}
