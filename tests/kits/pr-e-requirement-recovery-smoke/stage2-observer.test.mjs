#!/usr/bin/env node
/**
 * stage2-observer.test.mjs — host-free offline contract tests for the PR-E
 * stage-2 read-only UI observer (`stage2-observer.mjs`). Run ONLY this file:
 *   node --test tests/kits/pr-e-requirement-recovery-smoke/stage2-observer.test.mjs
 *
 * NO host, NO browser, NO network, NO kit execution, NO ports. The DOM
 * adapters tested here are the SAME function bodies the live observation runs
 * inside the page via page.evaluate (globalThis.document/window are swapped to
 * a jsdom document per test — the real adapter chain, never a fake schema).
 *
 * The jsdom fixtures MIRROR the real client DOM shape. Source pins:
 *  - packages/client/src/ui/TeamLedger.tsx @ origin/task/pre-alpha3-pr56-client-panel
 *    (aa677a3457fae353ab18957d4a34b39b2453fb5f, PR #56 — the ONLY source that
 *    renders the reviewed payload + full wire digest; this branch's base
 *    1385f1ee/6be8e95b carries the panel shell WITHOUT the digest/payload
 *    fields — selectors verified against the real source, NOT guessed):
 *      panel root                L484-487  div[data-ledger-resolve-bar][data-request-id][data-control-surface]
 *      visible requestId field   L576-579  div[data-control-detail-request-id] > dd
 *      render mode               L584      div[data-control-detail-render-mode][data-render-mode]
 *      full wire digest          L593-598  div[data-control-detail-digest][data-digest-source="ledger-wire"] > dd.controlDigestValue
 *      full reviewPayload <pre>  L606-613  div[data-control-detail-payload] > dd > pre.controlPayload
 *                                          (React TEXT NODE, JSON.stringify(value,null,2) — L160-167)
 *      allow / deny buttons      L628-641  data-ledger-resolve-allow / data-ledger-resolve-deny (NEVER clicked)
 *  - TeamLedger.module.css @ same ref: `.controlField dd` ellipsis trio (0,1,1)
 *    L298-306; `.controlField dd.controlDigestValue` white-space:normal
 *    (0,1,2, frozen batch #3) L339-344; `.controlPayload` white-space:pre-wrap
 *    + overflow:auto L347-360.
 *  - TestUse ConversationSession.tsx @ 46a7f68b09 L143-154: div[role=tablist]
 *    [data-conversation-tabs] > button[role=tab][aria-selected] (label child).
 *  - packages/client/src/ui/TeamView.tsx @ 6be8e95b: root div[data-team-view]
 *    L1295; section[data-team-section="ledger"] L1366 with <TeamLedger> L1368.
 *  - packages/client/src/plugin/team-mount-core.ts @ 6be8e95b: conversation.view
 *    slot id 'team' label t('view.team') L1219-1228; locales.ts 'view.team'
 *    = '团队' (L292 zh) / 'Team' (L551 en).
 *  - ui-observe.mjs @ 6be8e95b: UI_CLAIMS closed set incl. 'observed-pending'
 *    (FIX-4 coordinator ruling); readMarkerHint/verifyUiTruth = the kit-side
 *    marker reader the roundtrip test drives directly.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync,
  symlinkSync, chmodSync, lstatSync, rmSync, existsSync, statSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { createHash } from 'node:crypto'

// jsdom is a DECLARED devDependency of packages/client (package.json L37,
// "jsdom": "^30.0.1") — resolved through that package's own manifest via
// createRequire (same sanctioned pattern as the Playwright import; NO
// hardcoded .pnpm paths, NO installs).
const CLIENT_PKG = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'packages', 'client', 'package.json')
const requireFromClient = createRequire(CLIENT_PKG)
const { JSDOM } = requireFromClient('jsdom')

import {
  OBSERVED_PENDING_CLAIM, TEAM_TAB_LABELS, ObserverError,
  parseCli, validatePrivateAccessFile, resolveExpected, deepJsonEqual,
  extractPanelFields, checkNarrowLegibility, resolveTeamTabDom, teamViewActivatedDom,
  checkFields, scanForSecrets, writeEvidenceBundle, writeMarkerAtomic,
  writeMarkerIfAllPass,
  narrowExpectedLengths, evaluatePasses, scrubErrorText, setLaunchSecrets, cliMain,
  waitUntilTruthy, teamViewReadyDom, runObservation,
  buildLaunchOptions, DEFAULT_CHROME_PATH, rootSessionRowsDom, rootSessionReadyDom, rootSessionValidatedDom,
} from './stage2-observer.mjs'
// the kit's OWN exported contract (the marker reader the roundtrip must satisfy):
import { UI_CLAIMS, reviewPayloadDigestOf, readMarkerHint, verifyUiTruth } from './ui-observe.mjs'

// ── helpers ─────────────────────────────────────────────────────────────────

function mkTmp(prefix = 's2o-') {
  return mkdtempSync(join(tmpdir(), prefix))
}

function throwsCode(fn, code) {
  assert.throws(fn, (err) => {
    assert.ok(err instanceof ObserverError, `expected ObserverError, got ${err && err.name}: ${err && err.message}`)
    assert.equal(err.code, code)
    return true
  })
}

/** Swap globalThis.document/window to a jsdom doc, run fn, restore. The
 *  transportable DOM adapters read globalThis — this exercises the EXACT
 *  function bodies page.evaluate serializes in the live run. */
function withDom(html, fn) {
  const dom = new JSDOM(`<!doctype html><html><body>${html}</body></html>`)
  const prevDoc = globalThis.document
  const prevWin = globalThis.window
  globalThis.document = dom.window.document
  globalThis.window = dom.window
  try {
    return fn(dom.window)
  } finally {
    if (prevDoc === undefined) delete globalThis.document; else globalThis.document = prevDoc
    if (prevWin === undefined) delete globalThis.window; else globalThis.window = prevWin
  }
}

const RID = 'pr-e-s9-recovery-dispatch-0123456789abcdef'
// BATCH-3 BLOCK-B: the root session identity from the SAME durable fact row.
// MEMBER-ROUND rename: the fixture root mirrors the REAL kit world's shape
// ('session-prereq-main-…') so the structured diagnostic's bounded id
// whitelist (^session-prereq-|^session-team-child-) is exercised FOR REAL.
const ROOT = 'session-prereq-main-fixture-01'
// PARENT-AUTHORIZED member mode: the child-session id shape of the live
// durable world (session-team-child-<32 hex> @prereq-2026-10-01T20-10-50).
const MEMBER = 'session-team-child-f47ac10b58cc4372a5670e02b2c3d479'
// LIVE FACT (prereq evidence): a delegate reviewPayload carries a TOP-LEVEL
// rootSessionId (pendingSeen[].reviewPayload keys verified) — the member-mode
// cross-check needs it, so the fixture payload mirrors that shape.
const PAYLOAD = { schema: 'recovery-dispatch/v1', instanceId: 'inst-7', note: 'ünïcode ✓', rootSessionId: ROOT }
const DECOY = 'session-pr-e-decoy-other'
// EXTERNAL runtime fact (review @23a43f20): the header shows the session's
// DISPLAY TITLE, never the raw sessionId, whenever the session is inside
// ancestry. P1-round correction: the LIVE kit text is 'prereq smoke session'
// (kit source L936, verified this round) — the earlier 'prreq' typo mirrored
// nothing and is fixed HERE, not hidden.
const FIXTURE_TITLE = 'prereq smoke session'
const WRONG_ROOT = 'session-pr-e-root-02'
const DIGEST = reviewPayloadDigestOf(PAYLOAD) // sha256:<64hex> via the kit's SINGLE canonical impl

/** Panel mirror of TeamLedger.tsx @ aa677a34 (pins in the file header).
 *  EXTERNAL-BATCH ITEM-3: styles carry the REAL cascade the browser sees —
 *  the digest dd gets the base trio THEN the override (source order):
 *  computed = overflow:visible + white-space:normal + word-break:break-all
 *  with text-overflow STAYING 'ellipsis' (the reviewed override does NOT
 *  reset it — ellipsis is neutralized by overflow:visible, not removed).
 *  (jsdom probe: the shorthand cascade resolves identically; jsdom does NOT
 *  expand overflow into overflowX/Y, so checks read the shorthand.) */
const DD_BASE = 'overflow:hidden;white-space:nowrap;text-overflow:ellipsis' // .controlField dd trio L298-306
const DD_BASE_GENERIC = `${DD_BASE};min-width:0` // base trio as committed (min-width:0)
const DD_OVERRIDE = 'overflow:visible;white-space:normal;word-break:break-all' // .controlField dd.controlDigestValue L339-344
const DD_GENERIC = DD_BASE_GENERIC
const DD_DIGEST = `${DD_BASE};${DD_OVERRIDE}` // cascade: computed normal/visible + textOverflow STILL ellipsis
const PRE_PAYLOAD = 'overflow:auto;white-space:pre-wrap;word-break:break-all' // .controlPayload L347-360
const DD_REAL_CLIP = `${DD_BASE};height:1.2em` // real clipping: trio + short fixed height, NO override

function panelHtml({
  rid = RID, digest = DIGEST, payloadValue = PAYLOAD, renderMode = 'recovery-v1',
  omitDigest = false, omitPayload = false, omitRequestIdField = false,
  digestStyle = DD_DIGEST, preStyle = PRE_PAYLOAD, requestIdText = null,
  payloadTextRaw = undefined,
} = {}) {
  const payloadText = payloadTextRaw !== undefined
    ? payloadTextRaw
    : ((omitPayload || payloadValue === undefined) ? null : JSON.stringify(payloadValue, null, 2))
  return `
    <div class="resolveBar" data-ledger-resolve-bar data-request-id="${rid}" data-control-surface="enabled">
      <dl data-control-detail>
        ${omitRequestIdField ? '' : `<div class="controlField" data-control-detail-request-id><dt>Request ID</dt><dd style="${DD_GENERIC}">${requestIdText ?? rid}</dd></div>`}
        <div class="controlField" data-control-detail-render-mode data-render-mode="${renderMode}"><dt>Render mode</dt><dd style="${DD_GENERIC}">recovery payload</dd></div>
        ${omitDigest ? '' : `<div class="controlField" data-control-detail-digest data-digest-source="ledger-wire"><dt>ledger wire: reviewPayloadDigest</dt><dd class="controlDigestValue" style="${digestStyle}">${digest}</dd></div>`}
        ${payloadText === null ? '' : `<div class="controlField controlFieldWide" data-control-detail-payload><dt>Reviewed payload</dt><dd style="overflow:visible;white-space:normal"><pre class="controlPayload" style="${preStyle}">${payloadText}</pre></dd></div>`}
      </dl>
      <button type="button" data-ledger-resolve-allow>Allow</button>
      <button type="button" data-ledger-resolve-deny>Deny</button>
    </div>`
}

function teamViewHtml(panelsHtml) {
  return `
    <div data-team-view>
      <div data-team-view-status="ready"></div>
      <section data-team-section="ledger">
        <div data-team-ledger">${panelsHtml}</div>
      </section>
    </div>`
}

/** tablist mirror of ConversationSession.tsx @46a7f68b09 L143-154. */
function tablistHtml(labels, { active = labels[0] } = {}) {
  return `<div class="tabs" role="tablist" data-conversation-tabs="">${labels.map((l) => `
        <button type="button" role="tab" aria-selected="${l === active}">${l}</button>`).join('')}</div>`
}

function goodHtml(opts = {}) {
  const panels = Array.from({ length: opts.extraPanels ?? 1 }, (_, i) => (i === 0
    ? panelHtml(opts)
    : panelHtml({ ...opts, rid: `${RID}-other-${i}` }))).join('')
  return teamViewHtml(opts.panels ?? panels)
}

function goodFields(opts) {
  return withDom(goodHtml(opts), () => extractPanelFields(RID))
}

// ── 0. claim constant comes from the kit's exported CLOSED SET ─────────────

test('01 claim: OBSERVED_PENDING_CLAIM is the exported-set member (FIX-4 lawful signal), never a remembered literal', () => {
  assert.equal(OBSERVED_PENDING_CLAIM, 'observed-pending')
  assert.ok(UI_CLAIMS.includes(OBSERVED_PENDING_CLAIM), 'must be a member of the kit UI_CLAIMS closed set')
})

// ── 1. CLI parsing / path validation (fail closed) ──────────────────────────

function baseArgs(paths) {
  return ['--access', paths.access, '--rid', RID, '--digest-file', paths.digestFile,
    '--payload-file', paths.payloadFile, '--evidence', paths.evidence,
    '--viewport', '1440x900', '--marker-dir', paths.markerDir]
}

/** MEMBER-MODE durable world file, mirroring the LIVE shape verified at
 *  tests/homes/prereq-2026-10-01T20-10-50/storages/team_domain.json:
 *  tables.session_bindings[sessionId] = JSON string {instanceId, kind:
 *  'team-member', rootSessionId, schemaVersion, sessionId}; member_instances
 *  is keyed by the JSON string {"instanceId","rootSessionId"} and its value
 *  carries childSessionId. Overrides exist ONLY to stage typed-refusal legs. */
function mkTeamDomainJson({ member = MEMBER, root = ROOT, instanceId = 'inst-a1b2c3', bindingOverride = null, omitBinding = false, childOverride = null } = {}) {
  const binding = { instanceId, kind: 'team-member', rootSessionId: root, schemaVersion: 1, sessionId: member }
  const bindings = omitBinding ? {} : { [member]: JSON.stringify(bindingOverride === null ? binding : { ...binding, ...bindingOverride }) }
  const instKey = JSON.stringify({ instanceId, rootSessionId: root })
  const inst = { childSessionId: childOverride ?? member, instanceId, rootSessionId: root, label: 'w-b1', lifecycle: 'SETTLED', templateId: 'worker', schemaVersion: 1 }
  return JSON.stringify({ unit: { name: 'team_domain', version: 2 }, global: null, tables: { session_bindings: bindings, member_instances: { [instKey]: JSON.stringify(inst) } } })
}

function mkCliFixture({ mode = 0o600, digestMode = 'file', member = false, payloadOverride = null, domainJson = null } = {}) {
  const dir = mkTmp('s2o-cli-')
  const access = join(dir, 'browser-access.json')
  const payloadFile = join(dir, 'payload.json')
  const digestFile = join(dir, 'fact.json')
  const payloadValue = payloadOverride ?? PAYLOAD
  const digest = reviewPayloadDigestOf(payloadValue)
  writeFileSync(access, JSON.stringify({
    launchUrl: 'http://127.0.0.1:3181/?token=PRIVATE-tok-launch', origin: 'http://127.0.0.1:3181',
    requestId: RID, reviewPayloadDigest: digest, world: '/x/tests/homes/w',
  }))
  chmodSync(access, mode)
  writeFileSync(payloadFile, JSON.stringify(payloadValue))
  // BATCH-3: ledger-ROW shape (mirrors seedFact: {factType,createdAt,payload,
  // rootSessionId,schemaVersion,sequence} — the root identity rides the SAME
  // durable row; findRequestFact BFS reaches the payload leaves).
  writeFileSync(digestFile, JSON.stringify({
    factType: 'control-request-recorded', createdAt: '2026-10-02T00:00:00.000Z', sequence: '42',
    schemaVersion: 2, rootSessionId: ROOT, payload: { requestId: RID, reviewPayloadDigest: digest, reviewPayload: payloadValue },
  }))
  // MEMBER-MODE: this world's durable team_domain (member→instance→root).
  const domain = join(dir, 'team_domain.json')
  if (member) writeFileSync(domain, domainJson ?? mkTeamDomainJson())
  const evidence = join(dir, 'evidence')
  const markerDir = join(dir, 'marker')
  // BATCH-3 BLOCK-A: a REGULAR FILE standing in for the system chrome binary
  // (buildLaunchOptions verifies existence + regular-file BEFORE launch).
  const chrome = join(dir, 'fake-chrome')
  writeFileSync(chrome, '#!/bin/sh\n')
  chmodSync(chrome, 0o755)
  return {
    dir, access, payloadFile, digestFile, evidence, markerDir, chrome, domain,
    args: (digestMode === 'file'
      ? baseArgs({ access, digestFile, payloadFile, evidence, markerDir })
      : ['--access', access, '--rid', RID, '--digest', digest, '--payload-file', payloadFile,
        '--evidence', evidence, '--viewport', '1440x900', '--marker-dir', markerDir]
    ).concat(['--chrome', chrome], member ? ['--member-session', MEMBER, '--team-domain', domain] : []),
  }
}

test('02 cli: full valid argv parses (digest-file mode); evidence/marker dirs created', () => {
  const f = mkCliFixture()
  const opts = parseCli(f.args)
  assert.equal(opts.rid, RID)
  assert.equal(opts.digestFile, f.digestFile)
  assert.equal(opts.viewport.width, 1440)
  assert.equal(opts.viewport.height, 900)
  assert.equal(existsSync(f.evidence), true)
  assert.equal(existsSync(f.markerDir), true)
})

test('03 cli: digest-mode vs digest-file-mode are mutually exclusive and one is required', () => {
  const f = mkCliFixture()
  throwsCode(() => parseCli([...f.args, '--digest', DIGEST]), 'CLI_DIGEST_AMBIGUOUS')
  throwsCode(() => parseCli(f.args.filter((a) => a !== f.digestFile && a !== '--digest-file')), 'CLI_DIGEST_MISSING')
  parseCli(f.args.filter((a) => a !== f.digestFile && a !== '--digest-file').concat(['--digest', DIGEST])) // ok
})

test('04 cli: --digest must match ^sha256:[0-9a-f]{64}$ (fail closed)', () => {
  const f = mkCliFixture()
  const bare = f.args.filter((a) => a !== f.digestFile && a !== '--digest-file')
  throwsCode(() => parseCli([...bare, '--digest', 'sha256:deadbeef']), 'CLI_DIGEST_SHAPE')
  throwsCode(() => parseCli([...bare, '--digest', 'dead' + DIGEST.slice(6)]), 'CLI_DIGEST_SHAPE')
  throwsCode(() => parseCli([...bare, '--digest', `sha256:${DIGEST.slice(7).toUpperCase()}`]), 'CLI_DIGEST_SHAPE')
})

test('05 cli: required flags, unknown flags, malformed viewport / rid fail closed', () => {
  const f = mkCliFixture()
  throwsCode(() => parseCli(f.args.slice(2)), 'CLI_MISSING_ACCESS')
  throwsCode(() => parseCli(f.args.filter((a) => a !== '--nope' && a !== 'x').concat(['--nope', 'x'])), 'CLI_UNKNOWN_FLAG')
  throwsCode(() => parseCli(f.args.map((a) => (a === '1440x900' ? '1440-900' : a))), 'CLI_VIEWPORT')
  throwsCode(() => parseCli(f.args.map((a) => (a === RID ? 'bad rid with spaces' : a))), 'CLI_RID_SHAPE')
  throwsCode(() => parseCli(f.args.concat(['--rid', RID])), 'CLI_DUPLICATE_FLAG')
})

test('06 cli: every input path must be an EXISTING REGULAR file; dirs/symlinks/absent refused', () => {
  const f = mkCliFixture()
  mkdirSync(f.evidence)
  throwsCode(() => parseCli(f.args.map((a) => (a === f.payloadFile ? f.evidence : a))), 'CLI_NOT_REGULAR_FILE')
  throwsCode(() => parseCli(f.args.map((a) => (a === f.digestFile ? join(f.dir, 'ghost.json') : a))), 'CLI_MISSING_FILE')
  const linkPath = join(f.dir, 'payload-link.json')
  symlinkSync(f.payloadFile, linkPath)
  throwsCode(() => parseCli(f.args.map((a) => (a === f.payloadFile ? linkPath : a))), 'CLI_NOT_REGULAR_FILE')
})

// ── 2. private access record (mode / symlink fail-closed) ───────────────────

test('07 access: 0600 regular record parses; launchUrl/requestId/digest fields required', () => {
  const f = mkCliFixture()
  const rec = validatePrivateAccessFile(f.access)
  assert.equal(rec.requestId, RID)
  assert.equal(rec.reviewPayloadDigest, DIGEST)
  assert.match(rec.launchUrl, /^http:\/\/127\.0\.0\.1:\d+\/\?token=/)
})

test('08 access: mode 0644 (any looser-than-0600) is REJECTED', () => {
  const f = mkCliFixture({ mode: 0o644 })
  throwsCode(() => validatePrivateAccessFile(f.access), 'S2O_ACCESS_MODE')
})

test('09 access: symlink leaf is REJECTED (never followed) even when the target is a perfect 0600 record', () => {
  const f = mkCliFixture()
  const link = join(f.dir, 'escape.json')
  symlinkSync(f.access, link)
  throwsCode(() => validatePrivateAccessFile(link), 'S2O_ACCESS_SYMLINK')
  // symlink escaping the world via a directory link is equally refused (leaf still symlinked through realpath drift):
  const real = join(f.dir, 'real-record.json')
  writeFileSync(real, readFileSync(f.access))
  chmodSync(real, 0o600)
  validatePrivateAccessFile(real) // control: identical real file passes
})

test('10 access: directory / malformed JSON / missing launchUrl refused', () => {
  const f = mkCliFixture()
  throwsCode(() => validatePrivateAccessFile(f.dir), 'S2O_ACCESS_NOT_FILE')
  const bad = join(f.dir, 'bad.json')
  writeFileSync(bad, '{not json')
  chmodSync(bad, 0o600)
  throwsCode(() => validatePrivateAccessFile(bad), 'S2O_ACCESS_NOT_JSON')
  const noUrl = join(f.dir, 'nourl.json')
  writeFileSync(noUrl, JSON.stringify({ requestId: RID, reviewPayloadDigest: DIGEST }))
  chmodSync(noUrl, 0o600)
  throwsCode(() => validatePrivateAccessFile(noUrl), 'S2O_ACCESS_SHAPE')
})

// ── 3. expected digest/payload resolution (same durable source, never typed twice) ──

test('11 digest-file: flat request-fact extraction resolves; requestId cross-checks the --rid', () => {
  const f = mkCliFixture()
  const out = resolveExpected({ rid: RID, digestFile: f.digestFile, payloadFile: f.payloadFile })
  assert.equal(out.expectedDigest, DIGEST)
  assert.deepEqual(out.payloadValue, PAYLOAD)
})

test('12 digest-file: nested ledger-entry extraction shape accepted (fact under .payload)', () => {
  const f = mkCliFixture()
  const nested = join(f.dir, 'entry.json')
  writeFileSync(nested, JSON.stringify({
    sequence: 41, factType: 'control-request-recorded',
    payload: { requestId: RID, reviewPayloadDigest: DIGEST, reviewPayload: PAYLOAD },
  }))
  const out = resolveExpected({ rid: RID, digestFile: nested, payloadFile: f.payloadFile })
  assert.equal(out.expectedDigest, DIGEST)
})

test('13 digest-file: requestId drift from --rid fails closed (different durable request)', () => {
  const f = mkCliFixture()
  const other = join(f.dir, 'other.json')
  writeFileSync(other, JSON.stringify({ requestId: 'rid-of-a-DIFFERENT-request', reviewPayloadDigest: DIGEST }))
  throwsCode(() => resolveExpected({ rid: RID, digestFile: other, payloadFile: f.payloadFile }), 'S2O_FACT_RID_MISMATCH')
})

test('14 digest/payload CROSS-CHECK: the expected digest MUST equal reviewPayloadDigestOf(payload-file) — the kit truth recomputation pins it', () => {
  const f = mkCliFixture()
  const tampered = join(f.dir, 'tampered.json')
  writeFileSync(tampered, JSON.stringify({ requestId: RID, reviewPayloadDigest: `sha256:${'0'.repeat(64)}` }))
  throwsCode(() => resolveExpected({ rid: RID, digestFile: tampered, payloadFile: f.payloadFile }), 'S2O_DIGEST_PAYLOAD_UNBOUND')
  // --digest hand mode is equally bound to the payload source:
  throwsCode(() => resolveExpected({ rid: RID, digestRaw: `sha256:${'1'.repeat(64)}`, payloadFile: f.payloadFile }), 'S2O_DIGEST_PAYLOAD_UNBOUND')
  const ok = resolveExpected({ rid: RID, digestRaw: DIGEST, payloadFile: f.payloadFile })
  assert.equal(ok.expectedDigest, DIGEST)
})

test('15 digest-file carrying reviewPayload must deep-equal the payload-file (same durable request, never hand-typed twice)', () => {
  const f = mkCliFixture()
  const fact = join(f.dir, 'fact-full.json')
  writeFileSync(fact, JSON.stringify({ requestId: RID, reviewPayloadDigest: DIGEST, reviewPayload: { ...PAYLOAD, note: 'DRIFTED' } }))
  throwsCode(() => resolveExpected({ rid: RID, digestFile: fact, payloadFile: f.payloadFile }), 'S2O_FACT_PAYLOAD_MISMATCH')
})

test('16 payload:null is legal (PR #56 frozen batch #1) and binds to sha256(canonicalJson(null))', () => {
  const dir = mkTmp('s2o-null-')
  const payloadFile = join(dir, 'p.json')
  const factFile = join(dir, 'f.json')
  writeFileSync(payloadFile, 'null')
  const nullDigest = reviewPayloadDigestOf(null)
  writeFileSync(factFile, JSON.stringify({ requestId: RID, reviewPayloadDigest: nullDigest }))
  const out = resolveExpected({ rid: RID, digestFile: factFile, payloadFile })
  assert.equal(out.expectedDigest, nullDigest)
  assert.equal(out.payloadValue, null)
})

// ── 4. DOM extraction + field checks (fail-closed matrix, REAL adapters) ────

test('17 extract: panel found by rid; requestId/digest/payload fields extracted verbatim', () => {
  const res = goodFields()
  assert.equal(res.matchCount, 1)
  assert.equal(res.fields.ridAttr, RID)
  assert.equal(res.fields.requestIdText, RID)
  assert.equal(res.fields.digestText, DIGEST)
  assert.deepEqual(JSON.parse(res.fields.payloadText), PAYLOAD)
})

test('18 checks: all-pass on the faithful fixture', () => {
  const res = checkFields({ fields: goodFields(), expectedRid: RID, expectedDigest: DIGEST, payloadValue: PAYLOAD })
  assert.equal(res.ok, true, JSON.stringify(res.checks.filter((c) => !c.ok)))
})

test('19 fail-closed: requestId dd drifts from --rid → RID_TEXT mismatch', () => {
  const res = checkFields({ fields: goodFields({ requestIdText: 'req-E5-STALE-OTHER' }), expectedRid: RID, expectedDigest: DIGEST, payloadValue: PAYLOAD })
  assert.equal(res.ok, false)
  assert.ok(res.checks.some((c) => !c.ok && c.name === 'RID_TEXT_VISIBLE'))
})

test('20 fail-closed: digest shape-invalid (rendered) → DIGEST_SHAPE', () => {
  const res = checkFields({ fields: goodFields({ digest: 'sha256:XYZ' }), expectedRid: RID, expectedDigest: DIGEST, payloadValue: PAYLOAD })
  assert.equal(res.ok, false)
  assert.ok(res.checks.some((c) => !c.ok && c.name === 'DIGEST_SHAPE'))
})

test('21 fail-closed: digest mismatch (valid shape, wrong value) → DIGEST_EXACT', () => {
  const res = checkFields({ fields: goodFields({ digest: `sha256:${'a'.repeat(64)}` }), expectedRid: RID, expectedDigest: DIGEST, payloadValue: PAYLOAD })
  assert.equal(res.ok, false)
  assert.ok(res.checks.some((c) => !c.ok && c.name === 'DIGEST_EXACT'))
})

test('22 fail-closed: payload deep-inequality (one nested leaf) → PAYLOAD_DEEP_EQUAL', () => {
  const res = checkFields({
    fields: goodFields({ payloadValue: { ...PAYLOAD, nested: { deep: 'rendered' } } }),
    expectedRid: RID, expectedDigest: DIGEST, payloadValue: { ...PAYLOAD, nested: { deep: 'expected' } },
  })
  assert.equal(res.ok, false)
  assert.ok(res.checks.some((c) => !c.ok && c.name === 'PAYLOAD_DEEP_EQUAL'))
})

test('23 fail-closed: payload <pre> text not JSON-parseable → PAYLOAD_PARSE', () => {
  const html = teamViewHtml(panelHtml({}).replace('<pre class="controlPayload"', '<pre data-nonjson="1" class="controlPayload"').replace(/(<pre[^>]*>)[\s\S]*?(<\/pre>)/, '$1NOT-JSON{$2'))
  const fields = withDom(html, () => extractPanelFields(RID))
  const res = checkFields({ fields, expectedRid: RID, expectedDigest: DIGEST, payloadValue: PAYLOAD })
  assert.equal(res.ok, false)
  assert.ok(res.checks.some((c) => !c.ok && c.name === 'PAYLOAD_PARSE'))
})

test('24 fail-closed: MISSING panel (no resolve-bar for the rid) → PANEL_PRESENT', () => {
  const res = checkFields({ fields: goodFields({ rid: 'unrelated-rid' }), expectedRid: RID, expectedDigest: DIGEST, payloadValue: PAYLOAD })
  assert.equal(res.ok, false)
  assert.ok(res.checks.some((c) => !c.ok && c.name === 'PANEL_PRESENT'))
})

test('25 fail-closed: EXTRA duplicate panel for the SAME rid is ambiguous → PANEL_PRESENT', () => {
  const dup = teamViewHtml(panelHtml() + panelHtml())
  const fields = withDom(dup, () => extractPanelFields(RID))
  assert.equal(fields.matchCount, 2)
  const res = checkFields({ fields, expectedRid: RID, expectedDigest: DIGEST, payloadValue: PAYLOAD })
  assert.equal(res.ok, false)
})

test('26 other-rid panels are ignored (multiple pending controls is legal UI; only the target must be unique)', () => {
  const multi = teamViewHtml(panelHtml() + panelHtml({ rid: 'other-control-1' }) + panelHtml({ rid: 'other-control-2' }))
  const fields = withDom(multi, () => extractPanelFields(RID))
  assert.equal(fields.panelTotal, 3)
  assert.equal(fields.matchCount, 1)
  assert.equal(checkFields({ fields, expectedRid: RID, expectedDigest: DIGEST, payloadValue: PAYLOAD }).ok, true)
})

test('27 fail-closed: digest field absent (data-digest-source="ledger-wire" missing) → DIGEST_PRESENT', () => {
  const res = checkFields({ fields: goodFields({ omitDigest: true }), expectedRid: RID, expectedDigest: DIGEST, payloadValue: PAYLOAD })
  assert.equal(res.ok, false)
  assert.ok(res.checks.some((c) => !c.ok && c.name === 'DIGEST_PRESENT'))
})

test('28 fail-closed: payload block absent (pre missing) → PAYLOAD_PRESENT', () => {
  const res = checkFields({ fields: goodFields({ omitPayload: true }), expectedRid: RID, expectedDigest: DIGEST, payloadValue: PAYLOAD })
  assert.equal(res.ok, false)
  assert.ok(res.checks.some((c) => !c.ok && c.name === 'PAYLOAD_PRESENT'))
})

test('29 payload:null renders as text "null" and deep-equals parsed null (PR #56 legal shape)', () => {
  const nullDigest = reviewPayloadDigestOf(null)
  const fields = goodFields({ payloadValue: null, digest: nullDigest })
  const res = checkFields({ fields, expectedRid: RID, expectedDigest: nullDigest, payloadValue: null })
  assert.equal(res.ok, true, JSON.stringify(res.checks.filter((c) => !c.ok)))
})

// ── 5. Team tab activation (coordinator-pinned scoped resolution) ───────────

test('30 tab: unique exact-label tab INSIDE the tablist wins over decoy labels outside it (E3.teamTabHits=2 trap)', () => {
  const html = `
    <span class="dock-label">Team</span>
    <div role="presentation"><span>Team</span></div>
    ${tablistHtml(['Chat', 'Team'])}
    <span class="teamdock">Team</span>`
  const out = withDom(html, () => resolveTeamTabDom(TEAM_TAB_LABELS))
  assert.equal(out.ok, true)
  assert.equal(out.label, 'Team')
  assert.equal(out.index, 1)
})

test('31 REJECT: a second in-tablist tab with the same exact label is ambiguous → fail closed', () => {
  const html = tablistHtml(['Chat', 'Team', 'Team'])
  const out = withDom(html, () => resolveTeamTabDom(TEAM_TAB_LABELS))
  assert.equal(out.ok, false)
  assert.equal(out.code, 'TEAM_TAB_AMBIGUOUS')
})

test('32 REJECT: label-matching elements OUTSIDE the tablist never qualify; missing in-tablist tab → fail closed', () => {
  const html = '<span class="dock-label">Team</span><span>团队</span>' + tablistHtml(['Chat', 'Files'])
  const out = withDom(html, () => resolveTeamTabDom(TEAM_TAB_LABELS))
  assert.equal(out.ok, false)
  assert.equal(out.code, 'TEAM_TAB_NOT_FOUND')
})

test('33 tab: locale label 团队 (locales.ts L292) is equally accepted; tablist missing → fail closed', () => {
  const ok = withDom(tablistHtml(['聊天', '团队'], { active: '聊天' }), () => resolveTeamTabDom(TEAM_TAB_LABELS))
  assert.equal(ok.ok, true)
  assert.equal(ok.label, '团队')
  const none = withDom('<div>nothing</div>', () => resolveTeamTabDom(TEAM_TAB_LABELS))
  assert.equal(none.ok, false)
  assert.equal(none.code, 'TEAM_TABLIST_MISSING')
})

test('33b tab: LAYOUT-AGNOSTIC predicate (coordinator final wording) — the UNIQUE exact-label [role=tab] under [data-conversation-tabs] wins whatever group it sits in: a two-group mirror (strip tabs + separator + team-action group), Team placed in EITHER group, never any first/last or group requirement', () => {
  // Two-group DOM mirror for realism (strip group + separator + team-action
  // group, per the coordinator-pinned host shape). The pinned 46a7f68b09
  // checkout itself renders ONE flat tabs.map under the tablist (verified
  // by grep: teamTabAction/tabsSeparator = 0 source hits at the pin) — the
  // predicate MUST resolve identically on both layouts: scoped descendant
  // query + exact-label UNIQUENESS, zero ordering/group assumptions.
  const grouped = (teamIn) => `
    <div role="tablist" data-conversation-tabs="">
      <div class="tabsStrip">${['Chat', ...(teamIn === 'strip' ? ['Team'] : [])].map((l) => `<button type="button" role="tab" aria-selected="false">${l}</button>`).join('')}</div>
      <div class="tabsSeparator"></div>
      <div class="teamTabAction">${['TeamDock', ...(teamIn === 'action' ? ['Team'] : [])].map((l) => `<button type="button" role="tab" aria-selected="${l === 'Team'}">${l}</button>`).join('')}</div>
    </div>
    <span class="dock-label">Team</span>`
  const inStrip = withDom(grouped('strip'), () => resolveTeamTabDom(TEAM_TAB_LABELS))
  assert.equal(inStrip.ok, true, JSON.stringify(inStrip))
  assert.equal(inStrip.label, 'Team')
  const inAction = withDom(grouped('action'), () => resolveTeamTabDom(TEAM_TAB_LABELS))
  assert.equal(inAction.ok, true, JSON.stringify(inAction))
  assert.equal(inAction.label, 'Team')
  // the decoy 'TeamDock' button INSIDE the tablist never qualifies (exact-label);
  // and Team in BOTH groups is the unlawful duplicate → fail closed on uniqueness
  const both = withDom(`
    <div role="tablist" data-conversation-tabs="">
      <div class="tabsStrip"><button type="button" role="tab" aria-selected="false">Chat</button><button type="button" role="tab" aria-selected="false">Team</button></div>
      <div class="tabsSeparator"></div>
      <div class="teamTabAction"><button type="button" role="tab" aria-selected="false">Team</button></div>
    </div>`, () => resolveTeamTabDom(TEAM_TAB_LABELS))
  assert.equal(both.ok, false)
  assert.equal(both.code, 'TEAM_TAB_AMBIGUOUS')
  // post-click contract on the grouped DOM: aria-selected flip + [data-team-view]
  const activated = withDom(grouped('action') + teamViewHtml(panelHtml()), () => teamViewActivatedDom(inAction.index))
  assert.equal(activated.ok, true)
})

test('34 activation state: aria-selected=true on the resolved tab + [data-team-view] present; both required', () => {
  const html = tablistHtml(['Chat', 'Team'], { active: 'Team' }) + teamViewHtml(panelHtml())
  const ok = withDom(html, () => teamViewActivatedDom(1))
  assert.equal(ok.ok, true)
  const notSelected = withDom(tablistHtml(['Chat', 'Team'], { active: 'Chat' }) + teamViewHtml(''), () => teamViewActivatedDom(1))
  assert.equal(notSelected.ok, false)
  assert.equal(notSelected.code, 'TEAM_TAB_NOT_SELECTED')
  const noView = withDom(tablistHtml(['Chat', 'Team'], { active: 'Team' }), () => teamViewActivatedDom(1))
  assert.equal(noView.ok, false)
  assert.equal(noView.code, 'TEAM_VIEW_MISSING')
})

// ── 6. narrow pass (legibility, fail-closed) ────────────────────────────────

function narrowCheck(opts) {
  const payloadValue = opts.payloadValue ?? PAYLOAD
  const expected = {
    ridLen: RID.length,
    digestLen: (opts.digest ?? DIGEST).length,
    payloadLen: JSON.stringify(payloadValue, null, 2).length,
  }
  // single-argument shape = exactly what page.evaluate serializes in the live run
  return withDom(goodHtml(opts), () => checkNarrowLegibility({ rid: RID, expected }))
}

test('35 narrow: faithful CSS (digest white-space:normal, payload pre-wrap) passes', () => {
  const out = narrowCheck({})
  assert.equal(out.ok, true, JSON.stringify(out.rows.filter((r) => !r.ok)))
})

test('36 fail-closed narrow: digest loses its CSS override (frozen batch #3 regression: white-space:nowrap + ellipsis)', () => {
  const out = narrowCheck({ digestStyle: DD_GENERIC })
  assert.equal(out.ok, false)
  assert.ok(out.rows.some((r) => !r.ok && /DIGEST/.test(r.name)))
})

test('37 fail-closed narrow: payload pre switched to nowrap+ellipsis (truncation) fails', () => {
  const out = narrowCheck({ preStyle: 'white-space:nowrap;text-overflow:ellipsis;overflow:hidden' })
  assert.equal(out.ok, false)
  assert.ok(out.rows.some((r) => !r.ok && /PAYLOAD/.test(r.name)))
})

test('38 fail-closed narrow: DOM text shorter than the full expected length (any truncation) fails', () => {
  const fields = { ridLen: RID.length, digestLen: DIGEST.length, payloadLen: JSON.stringify(PAYLOAD, null, 2).length + 50 }
  const out = withDom(goodHtml({}), () => checkNarrowLegibility({ rid: RID, expected: fields }))
  assert.equal(out.ok, false)
  assert.ok(out.rows.some((r) => !r.ok && /LENGTH/.test(r.name)))
})

// ── 7. token-scrubbed evidence writer ───────────────────────────────────────

const SECRET = 'tok-PRIVATELAUNCH'
const SECRETS = [SECRET, `http://127.0.0.1:3181/?token=${SECRET}`]

test('39 scan: raw token AND any URL-with-token query are caught; clean text passes', () => {
  assert.ok(scanForSecrets(`see http://h/?token=${SECRET}`, SECRETS).length > 0)
  assert.ok(scanForSecrets('a bare ?token=abc query even without the exact secret', SECRETS).length > 0)
  assert.deepEqual(scanForSecrets('digest sha256:abc… requestId only', SECRETS), [])
})

test('40 fail-closed: a leaking evidence bundle is REFUSED and NOTHING is written', () => {
  const dir = join(mkTmp('s2o-ev-'), 'evidence')
  throwsCode(() => writeEvidenceBundle(dir, {
    'comparisons.json': JSON.stringify({ note: `boot at http://127.0.0.1:3181/?token=${SECRET}` }),
    'dom-normal.json': JSON.stringify({ ok: true }),
  }, SECRETS), 'S2O_EVIDENCE_TOKEN_LEAK')
  assert.equal(existsSync(dir), false, 'the writer must not even create the dir on leak')
})

test('41 evidence: clean bundle writes every file + sha256 manifest that verifies', () => {
  const dir = join(mkTmp('s2o-ev-'), 'evidence')
  const files = {
    'comparisons.json': JSON.stringify({ checks: [{ name: 'DIGEST_EXACT', ok: true }], requestId: RID, digest: DIGEST }),
    'dom-normal.json': JSON.stringify({ matchCount: 1 }),
    'shot-normal.png': Buffer.from([0x89, 0x50, 0x4e, 0x47]),
  }
  const manifest = writeEvidenceBundle(dir, files, SECRETS)
  const listed = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8'))
  assert.equal(listed.files.length, Object.keys(files).length)
  for (const row of listed.files) {
    const buf = readFileSync(join(dir, row.file))
    assert.equal(row.sha256, createHash('sha256').update(buf).digest('hex'))
  }
  assert.equal(manifest.dir, dir)
})

// ── 8. marker: atomic write + the kit reader roundtrip + no-marker-on-failure ──

test('42 marker: atomic tmp+rename write, mode 0600, exact contract shape', () => {
  const dir = join(mkTmp('s2o-mk-'), 'marker')
  const path = writeMarkerAtomic({ markerDir: dir, requestId: RID, digest: DIGEST })
  assert.equal(path, join(dir, 'marker.json'))
  const st = lstatSync(path)
  assert.equal(st.mode & 0o777, 0o600)
  const parsed = JSON.parse(readFileSync(path, 'utf8'))
  assert.deepEqual(Object.keys(parsed).sort(), ['claimed', 'digest', 'requestId', 'ts'])
  assert.equal(parsed.requestId, RID)
  assert.equal(parsed.digest, DIGEST)
  assert.equal(parsed.claimed, OBSERVED_PENDING_CLAIM)
  assert.ok(!Number.isNaN(Date.parse(parsed.ts)))
  assert.deepEqual(readdirSync(dir).filter((f) => f !== 'marker.json'), [], 'no tmp residue')
})

test('43 KIT-READER ROUNDTRIP: readMarkerHint accepts the marker; verifyUiTruth accepts the observed-pending claim against pending durable facts', () => {
  const dir = join(mkTmp('s2o-mk-'), 'marker')
  writeMarkerAtomic({ markerDir: dir, requestId: RID, digest: DIGEST })
  const hint = readMarkerHint(dir)
  assert.equal(hint.ok, true, `kit reader rejected the marker: ${hint.reason}`)
  assert.equal(hint.hint.claimed, 'observed-pending')
  assert.ok(UI_CLAIMS.includes(hint.hint.claimed))
  const ledgerFacts = [
    { sequence: 40, factType: 'control-request-recorded', payload: { requestId: RID, reviewPayloadDigest: DIGEST, reviewPayload: PAYLOAD } },
  ]
  const truth = verifyUiTruth({ marker: hint.hint, ledgerFacts, expectedRequestId: RID, expectedDigest: DIGEST })
  assert.equal(truth.ok, true, `kit truth rejected the claim: ${truth.reason}`)
  assert.equal(truth.claim, 'observed-pending')
  // and the durable-effect refusals still fire on the SAME marker:
  const decided = verifyUiTruth({
    marker: hint.hint,
    ledgerFacts: [...ledgerFacts, { sequence: 41, factType: 'control-decision-recorded', payload: { requestId: RID, decision: 'allow' } }],
    expectedRequestId: RID, expectedDigest: DIGEST,
  })
  assert.equal(decided.ok, false)
  assert.equal(decided.reason, 'DECIDED_EXISTS')
  const abandoned = verifyUiTruth({
    marker: hint.hint,
    ledgerFacts: [...ledgerFacts, { sequence: 41, factType: 'control-request-abandoned', payload: { requestId: RID } }],
    expectedRequestId: RID, expectedDigest: DIGEST,
  })
  assert.equal(abandoned.ok, false)
  assert.equal(abandoned.reason, 'ABANDONED_EXISTS')
})

test('44 no-marker-on-failure: any failed check → the marker dir stays EMPTY (fail closed)', () => {
  const dir = join(mkTmp('s2o-mk-'), 'marker')
  const res = writeMarkerIfAllPass({ allPassed: false, markerDir: dir, requestId: RID, digest: DIGEST })
  assert.equal(res.ok, false)
  assert.equal(res.reason, 'CHECKS_FAILED')
  assert.equal(existsSync(join(dir, 'marker.json')), false)
  assert.deepEqual(readdirSync(dir), [])
  const ok = writeMarkerIfAllPass({ allPassed: true, markerDir: dir, requestId: RID, digest: DIGEST })
  assert.equal(ok.ok, true)
  assert.equal(readMarkerHint(dir).ok, true)
})

test('45 deepJsonEqual: structural equality regardless of key order; nested arrays; leaf type strictness', () => {
  assert.equal(deepJsonEqual({ a: 1, b: { c: [1, 2] } }, { b: { c: [1, 2] }, a: 1 }), true)
  assert.equal(deepJsonEqual({ a: 1 }, { a: '1' }), false)
  assert.equal(deepJsonEqual([1, 2], [2, 1]), false)
  assert.equal(deepJsonEqual(null, null), true)
  assert.equal(deepJsonEqual(null, {}), false)
})

// ── EXTERNAL REVIEW BATCH (frozen 4 items) + WIRE-LEVEL TESTS ───────────────
// Items: 1 error-path secret scrub; 2 BOTH viewports deep-equal the durable
// source; 3 layout check vs the REAL cascade (ellipsis computed is accepted
// when neutralized — real clipping fails); 4 waitForFunction BOOLEAN wiring
// (the old object-return {ok:false} is TRUTHY and must never gate again).
// The wiring tests drive the REAL runObservation end-to-end with a duck-typed
// fake page + REAL jsdom DOM probe path — no chromium, no ports, no host.

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47])

// — item 2 units: durable lengths + both-viewport verdict —

test('46 narrowExpectedLengths derives EVERY length from the DURABLE source (never from rendered text)', () => {
  const lens = narrowExpectedLengths({ rid: RID, expectedDigest: DIGEST, payloadValue: PAYLOAD })
  assert.deepEqual(lens, {
    ridLen: RID.length,
    digestLen: DIGEST.length,
    payloadLen: JSON.stringify(PAYLOAD, null, 2).length,
  })
})

test('47 fail-closed: narrow-ONLY truncated payload (normal full, narrow clipped) — durable lengths FAIL where self-length was tautological; verdict refuses the marker', () => {
  const durableText = JSON.stringify(PAYLOAD, null, 2)
  const clipped = durableText.slice(0, durableText.length - 12) // cut mid-JSON
  const narrowHtmlClip = goodHtml({ payloadTextRaw: clipped })
  const narrowExtraction = withDom(narrowHtmlClip, () => extractPanelFields(RID))
  const durableLens = narrowExpectedLengths({ rid: RID, expectedDigest: DIGEST, payloadValue: PAYLOAD })
  const narrowRows = withDom(narrowHtmlClip, () => checkNarrowLegibility({ rid: RID, expected: durableLens }))
  assert.equal(narrowRows.rows.some((r) => !r.ok && r.name === 'NARROW_PAYLOAD_LENGTH'), true)
  // THE TAUTOLOGY, DOCUMENTED: the pre-fix code fed the narrow's OWN rendered
  // length as the expectation — the same clipped DOM then passes the length row.
  const selfRows = withDom(narrowHtmlClip, () => checkNarrowLegibility({ rid: RID, expected: { ridLen: RID.length, digestLen: DIGEST.length, payloadLen: clipped.length } }))
  assert.equal(selfRows.rows.find((r) => r.name === 'NARROW_PAYLOAD_LENGTH').ok, true, 'self-length tautology is real — durable lengths are the fix')
  const verdict = evaluatePasses({
    expected: { rid: RID, expectedDigest: DIGEST, payloadValue: PAYLOAD },
    phases: {
      normal: { fields: goodFields(), narrow: { ok: true, rows: [] } },
      narrow: { fields: narrowExtraction, narrow: narrowRows },
    },
  })
  assert.equal(verdict.ok, false)
  assert.ok(verdict.narrowChecks.checks.some((c) => !c.ok && (c.name === 'PAYLOAD_PARSE' || c.name === 'PAYLOAD_DEEP_EQUAL')))
  const dir = join(mkTmp('s2o-v-'), 'marker')
  assert.equal(writeMarkerIfAllPass({ allPassed: verdict.ok, markerDir: dir, requestId: RID, digest: DIGEST }).ok, false)
  assert.deepEqual(readdirSync(dir), [])
})

test('48 fail-closed: narrow-ONLY SAME-LENGTH wrong digest → deep equality (not length) catches it', () => {
  const wrong = `sha256:${DIGEST[7] === 'a' ? 'b' : 'a'}${DIGEST.slice(8)}`
  assert.equal(wrong.length, DIGEST.length)
  assert.ok(!verifyUiTruthDigestEq(wrong)) // not equal, same shape
  const narrowExtraction = goodFields({ digest: wrong })
  const verdict = evaluatePasses({
    expected: { rid: RID, expectedDigest: DIGEST, payloadValue: PAYLOAD },
    phases: {
      normal: { fields: goodFields(), narrow: { ok: true, rows: [] } },
      narrow: { fields: narrowExtraction, narrow: { ok: true, rows: [] } },
    },
  })
  assert.equal(verdict.ok, false)
  assert.ok(verdict.narrowChecks.checks.some((c) => !c.ok && c.name === 'DIGEST_EXACT'))
  const dir = join(mkTmp('s2o-v-'), 'marker')
  assert.equal(writeMarkerIfAllPass({ allPassed: verdict.ok, markerDir: dir, requestId: RID, digest: DIGEST }).ok, false)
  assert.equal(existsSync(join(dir, 'marker.json')), false)
})
function verifyUiTruthDigestEq(d) { return d === DIGEST }

test('49 verdict: BOTH viewports deep-equal + layout rows green → all-pass (and nothing relaxed)', () => {
  const extraction = goodFields()
  const lens = narrowExpectedLengths({ rid: RID, expectedDigest: DIGEST, payloadValue: PAYLOAD })
  const rows = withDom(goodHtml({}), () => checkNarrowLegibility({ rid: RID, expected: lens }))
  const verdict = evaluatePasses({
    expected: { rid: RID, expectedDigest: DIGEST, payloadValue: PAYLOAD },
    phases: {
      normal: { fields: extraction, narrow: rows },
      narrow: { fields: goodFields(), narrow: rows },
    },
  })
  assert.equal(verdict.ok, true, JSON.stringify({ n: verdict.normalChecks.checks.filter((c) => !c.ok), m: verdict.narrowChecks.checks.filter((c) => !c.ok), rows: rows.rows.filter((r) => !r.ok) }))
})

// — item 1 units: the shared secret scrub —

const LAUNCH_URL = 'http://127.0.0.1:3181/?token=PRIVATE-tok-launch'
const LAUNCH_SECRET = 'PRIVATE-tok-launch'

test('50 scrubErrorText: known launch secrets AND unknown token= VALUES are scrubbed; residual uncertainty SUPPRESSES the text', () => {
  setLaunchSecrets([LAUNCH_URL, LAUNCH_SECRET])
  const nasty = `page.goto: Timeout exceeded.\n navigating to "${LAUNCH_URL}" waiting until "load" (also ?token=anothersecretvalue987654321 in headers)`
  const out = scrubErrorText(nasty)
  assert.equal(out.suppressed, false)
  assert.ok(!out.text.includes(LAUNCH_SECRET))
  assert.ok(!out.text.includes('anothersecretvalue987654321'))
  assert.ok(out.text.includes('Timeout exceeded'))
  // un-scrubbable uncertainty (empty-valued token= marker): suppress entirely
  const weird = scrubErrorText('weird ?token=&y=1 remainder of a message')
  assert.equal(weird.suppressed, true)
  setLaunchSecrets([])
})

test('51 cliMain (the REAL top-level handler): unknown error with token-bearing stack → exit 1, output scrubbed; ObserverError → exit 2 typed; suppressed branch keeps no message body', async () => {
  const f = mkCliFixture()
  const sink = []
  setLaunchSecrets([LAUNCH_URL, LAUNCH_SECRET])
  const code1 = await cliMain({
    argv: f.args,
    run: async () => {
      const e = new Error(`page.goto: Timeout 60000ms exceeded.\nnavigating to "${LAUNCH_URL}"`)
      e.name = 'TimeoutError'
      e.stack = `TimeoutError: page.goto\n  navigating to "${LAUNCH_URL}"\n  at runObservation`
      throw e
    },
    stdout: (s) => sink.push(String(s)),
    stderr: (s) => sink.push(String(s)),
  })
  assert.equal(code1, 1)
  const joined1 = sink.join('')
  assert.ok(joined1.includes('STAGE2_OBSERVER_FATAL'))
  assert.ok(joined1.includes('Timeout'))
  assert.ok(!joined1.includes(LAUNCH_SECRET), 'the token value must never reach the output boundary')
  const sink2 = []
  const code2 = await cliMain({
    argv: f.args,
    run: async () => { throw new ObserverError('S2O_NAV_FAILED', 'navigation refused: [scrubbed]') },
    stdout: (s) => sink2.push(String(s)),
    stderr: (s) => sink2.push(String(s)),
  })
  assert.equal(code2, 2)
  assert.ok(sink2.join('').includes('STAGE2_OBSERVER_FAIL S2O_NAV_FAILED'))
  const sink3 = []
  const code3 = await cliMain({
    argv: f.args,
    run: async () => { throw new Error('weird ?token=&y=1 secret tail') },
    stdout: (s) => sink3.push(String(s)),
    stderr: (s) => sink3.push(String(s)),
  })
  assert.equal(code3, 1)
  assert.ok(sink3.join('').includes('[suppressed by token tripwire]'))
  assert.ok(!sink3.join('').includes('secret tail'))
  setLaunchSecrets([])
})

// — item 3 units: real cascade PASS (computed ellipsis ACCEPTED) vs real clip FAIL —

test('52 narrow layout vs the REAL cascade: digest with base trio + override (computed white-space normal, overflow visible, text-overflow STILL ellipsis, full-height) PASSES; real clipping (trio + short fixed height) fails typed', () => {
  const lens = narrowExpectedLengths({ rid: RID, expectedDigest: DIGEST, payloadValue: PAYLOAD })
  const good = withDom(goodHtml({}), () => checkNarrowLegibility({ rid: RID, expected: lens }))
  // sanity that the fixture really carries the conflict the browser sees:
  const computedEllipsis = withDom(goodHtml({}), () => {
    const dd = globalThis.document.querySelector('[data-digest-source="ledger-wire"] dd')
    return globalThis.window.getComputedStyle(dd).textOverflow
  })
  assert.equal(computedEllipsis, 'ellipsis', 'fixture must carry the real cascade (ellipsis computed, neutralized by overflow:visible)')
  assert.equal(good.ok, true, JSON.stringify(good.rows.filter((r) => !r.ok)))
  const clipped = withDom(goodHtml({ digestStyle: DD_REAL_CLIP }), () => checkNarrowLegibility({ rid: RID, expected: lens }))
  assert.equal(clipped.ok, false)
  assert.ok(clipped.rows.some((r) => !r.ok && /NARROW_DIGEST_(WHITESPACE|EFFECTIVE_CLIP)/.test(r.name)))
})

// — item 4 units: BOOLEAN wait predicate + wait driver —

test('53 teamViewReadyDom is BOOLEAN (never the truthy-object trap); waitUntilTruthy polls false→false→true and times out honestly', async () => {
  const html = tablistHtml(['Chat', 'Team']) + teamViewHtml(panelHtml())
  const readyFalse = withDom(html, () => teamViewReadyDom(1))
  assert.equal(readyFalse, false, 'wait expression must return a BOOLEAN false while not ready')
  const activated = withDom(html, (win) => {
    const tabs = win.document.querySelectorAll('[data-conversation-tabs] button[role="tab"]')
    tabs[1].setAttribute('aria-selected', 'true')
    return teamViewReadyDom(1)
  })
  assert.equal(activated, true)
  assert.ok(teamViewActivatedDom !== undefined, 'the object helper remains for post-wait POSITIVE validation')
  const polls = [false, false, true]
  let now = 0
  const ok = await waitUntilTruthy({
    probe: async () => polls.shift(),
    deadlineAt: 10_000,
    nowFn: () => now,
    sleepFn: async (ms) => { now += ms },
  })
  assert.equal(ok, true)
  let now2 = 0
  const never = await waitUntilTruthy({
    probe: async () => false,
    deadlineAt: 1000,
    nowFn: () => now2,
    sleepFn: async (ms) => { now2 += ms },
  })
  assert.equal(never, false)
})

// — WIRE-LEVEL: the REAL runObservation with a duck-typed fake page + REAL DOM probe —

/** Session-browser mirror of Rows.tsx @46a7f68b09: rows carry
 *  data-row-key="session:<id>" (L571), role=treeitem + aria-selected
 *  (L577-578, currentId from WorkspaceBrowser L506), click opens by id
 *  (L580). NO URL-level session selection exists in the pinned checkout
 *  (apps/web/src/main.ts boots AppWebEntry with no query/route session
 *  param; zero URLSearchParams in packages/client/web/src). */
function sessionTreeHtml(ids, { selected = null } = {}) {
  return `<div role="tree" data-workspace-browser>${ids.map((id) => `
    <div data-row-key="session:${id}" role="treeitem" aria-selected="${id === selected}"><span class="title">${id}</span></div>`).join('')}</div>`
}

/** Header mirror of ConversationSession.tsx @46a7f68b09 AS IT RENDERS FOR
 *  THIS WORLD (external runtime fact): the displayed crumb is the session's
 *  DISPLAY TITLE — crumbCurrent's raw-sessionId branch (L125) applies only
 *  when ancestry.length === 0, which does NOT hold here. NO narrow-pass
 *  assertion may depend on the header carrying the id. */
function headerHtml(shown = FIXTURE_TITLE) {
  return `<div data-fixture-header><nav aria-label="hierarchy"><span data-fixture-crumb>${shown}</span></nav><div data-conversation-header-corner=""></div></div>`
}

function wireHtml(panelOpts = {}, { rootRow = true, shown = FIXTURE_TITLE } = {}) {
  const ids = rootRow ? [ROOT, DECOY] : ['session-unrelated-1', 'session-unrelated-2']
  return headerHtml(shown) + sessionTreeHtml(ids, { selected: DECOY }) + tablistHtml(['Chat', 'Team']) + goodHtml(panelOpts)
}

/** FRESH-BOOT rail mirror of the PINNED host + PR55 probe3 facts: the
 *  'Ungrouped' group header renders as a treeitem but the group COLLAPSES BY
 *  DEFAULT ("the group collapses by default" — apps/web/tests/
 *  agent-preset-selection.e2e.ts:382 @46a7f68b09; its own e2e clicks the group
 *  header BEFORE any session row exists), so ZERO session rows are rendered;
 *  a fresh profile additionally shows the WelcomeNotice (locales.ts
 *  L107/L109 welcomeTitle 'Internal Testing Notice' / welcomeContinue
 *  'Continue' @46a7f68b09). canary= goes into an href INSIDE the tree so the
 *  entry-failure dump proves query/token sanitization against live DOM. */
function collapsedTreeHtml({ notice = false, canary = null, groupLabel = 'Ungrouped' } = {}) {
  const noticeHtml = notice ? '<div data-welcome-notice><p>Internal Testing Notice</p><button>Continue</button></div>' : ''
  const canaryHtml = canary === null ? '' : `<a href="${canary}">launch</a>`
  return `${noticeHtml}<div role="tree" data-workspace-browser><div role="treeitem" aria-label="${groupLabel}" aria-expanded="false">${groupLabel}</div>${canaryHtml}</div>`
}
function wireCollapsedHtml(opts = {}) {
  return headerHtml(FIXTURE_TITLE) + collapsedTreeHtml(opts) + tablistHtml(['Chat', 'Team']) + goodHtml({})
}
/** P-b family: the session lives under a NAMED workspace group — NO
 *  'Ungrouped' header exists at all; the structured diagnostic must EVIDENCE
 *  that (ungroupedCount=0) while activation keeps refusing to guess. */
function wireNamedGroupHtml() {
  return headerHtml(FIXTURE_TITLE) + collapsedTreeHtml({ groupLabel: 'dsh-agent-team' }) + tablistHtml(['Chat', 'Team']) + goodHtml({})
}
/** BLANK-ROOT WORLD (journal truth: Tmain has ZERO turn/start — its row is
 *  permanently invisible, and the pinned host returns null chrome for blank
 *  roots): the root row does NOT render at all; the DURABLY BOUND member
 *  child session row is visible and is the lawful entry. */
function wireMemberHtml(panelOpts = {}) {
  return headerHtml(FIXTURE_TITLE) + sessionTreeHtml([DECOY, MEMBER], { selected: DECOY }) + tablistHtml(['Chat', 'Team']) + goodHtml(panelOpts)
}
/** Rows rendered (group already open) but the root rides behind the
 *  'Show N more sessions' overflow — a button that exists ONLY post-
 *  expansion (PR55 driver header @46043f78: "THE OVERFLOW BUTTON ONLY EXISTS
 *  AFTER THE GROUP EXPANSION"). */
function wireOverflowHtml() {
  const tree = `<div role="tree" data-workspace-browser><div role="treeitem" aria-label="Ungrouped">Ungrouped</div>
    <div data-row-key="session:${DECOY}" role="treeitem" aria-selected="false"><span class="title">${DECOY}</span></div>
    <button>Show 1 more sessions</button></div>`
  return headerHtml(FIXTURE_TITLE) + tree + tablistHtml(['Chat', 'Team']) + goodHtml({})
}

// VIEWPORT-HONEST fake — models the PINNED layout rule (all verified at
// 46a7f68b09 this session via git show):
//   * sidebar auto-collapses below SIDEBAR_AUTO_COLLAPSE = 1024
//     (packages/client/ui-layout/src/client/columns.ts L23; AppFrame.tsx
//     L178-182 `narrow = viewport < SIDEBAR_AUTO_COLLAPSE;
//     sidebarCollapsed = narrow ? !layoutInfo.narrowExpanded : …`; stores.ts
//     fresh-state narrowExpanded:false — cite behavior, line drifts);
//   * the session LIST is wide-only — below the breakpoint ZERO treeitems
//     render, on a FRESH narrow context AND after a resize
//     (packages/client/ui-workspace/src/client/rows/WorkspaceBrowser.tsx
//     L1275-1278: "the list itself is wide-only").
// The header crumb (ConversationSession.tsx L125 raw sessionId) tracks
// whichever session this fake actually opened — landing shows the decoy.
function makeFakeBrowser({ html, gotoError = null, neverActivate = false, activateAfterPolls = 0, neverSelectRoot = false, narrowTransform = null, groupExpand = 'render', expandIds = null, overflowHidden = null } = {}) {
  const SIDEBAR_AUTO_COLLAPSE = 1024 // mirrors columns.ts L23
  const calls = { gotos: [], evaluates: 0, clicks: 0, contexts: 0, pages: 0, resizes: [] }
  const activateTeamTab = (doc) => {
    const tabs = Array.from(doc.querySelectorAll('[data-conversation-tabs] button[role="tab"]'))
    for (const t of tabs) t.setAttribute('aria-selected', String(TEAM_TAB_LABELS.includes(t.textContent.trim())))
  }
  const makeHandle = (el, doc) => ({
    async $$(sel) { return Array.from(el.querySelectorAll(sel)).map((child) => makeHandle(child, doc)) },
    async click() {
      calls.clicks += 1
      if (el.getAttribute('role') === 'treeitem') {
        if (neverSelectRoot) return
        const siblings = el.parentElement === null ? [] : Array.from(el.parentElement.querySelectorAll('[role="treeitem"]'))
        for (const r of siblings) r.setAttribute('aria-selected', String(r === el))
        return
      }
      if (neverActivate) return
      const tabs = Array.from(doc.querySelectorAll('[data-conversation-tabs] button[role="tab"]'))
      for (const t of tabs) t.setAttribute('aria-selected', String(t === el))
    },
  })
  const buildPage = (viewport) => {
    const dom = new JSDOM(`<!doctype html><html><body>${html}</body></html>`)
    const win = dom.window
    const doc = win.document
    let pending = activateAfterPolls
    const dropTree = () => {
      for (const tree of Array.from(doc.querySelectorAll('[role="tree"]'))) tree.remove()
    }
    if (viewport !== undefined && viewport.width < SIDEBAR_AUTO_COLLAPSE) dropTree()
    const page = {
      async goto(url) {
        calls.gotos.push(url)
        if (gotoError !== null && gotoError !== undefined) throw gotoError
      },
      async setViewportSize(v) {
        calls.resizes.push({ ...v })
        if (v.width < SIDEBAR_AUTO_COLLAPSE) {
          dropTree() // wide-only list: the treeitems CANNOT exist below the breakpoint
          if (narrowTransform !== null) narrowTransform(doc)
        }
      },
      async waitForSelector(sel) {
        if (doc.querySelector(sel) === null) throw new Error(`fake page: selector not found: ${sel}`)
        return true
      },
      async evaluate(fn, arg) {
        calls.evaluates += 1
        if (pending > 0 && calls.evaluates >= pending) { pending = -1; activateTeamTab(doc) }
        const prevDoc = globalThis.document
        const prevWin = globalThis.window
        globalThis.document = doc
        globalThis.window = win
        try {
          return await fn(arg)
        } finally {
          if (prevDoc === undefined) delete globalThis.document; else globalThis.document = prevDoc
          if (prevWin === undefined) delete globalThis.window; else globalThis.window = prevWin
        }
      },
      async waitForFunction(fn, arg) {
        // Playwright semantics: resolves on the FIRST TRUTHY value — an
        // object-returning predicate ALWAYS resolves (the ITEM-4 bug).
        const v = await page.evaluate(fn, arg)
        if (v) return true
        throw new Error('waitForFunction predicate false')
      },
      async $(sel) {
        const el = doc.querySelector(sel)
        return el === null ? null : makeHandle(el, doc)
      },
      locator(sel) {
        return {
          first: () => ({ async waitFor() { if (doc.querySelector(sel) === null) throw new Error(`fake locator missing: ${sel}`) } }),
          async screenshot() { return PNG },
          async waitFor() { if (doc.querySelector(sel) === null) throw new Error(`fake locator missing: ${sel}`) },
        }
      },
      // Mirrors Playwright getByRole used by the PR55-proven driver and the
      // PINNED host's own e2e (agent-preset-selection.e2e.ts:382-383 clicks
      // getByRole('treeitem', { name: /^Ungrouped/ }) because "the group
      // collapses by default"). Accessible name = aria-label else trimmed
      // text — role-SCOPED only, never a generic text search.
      getByRole(role, opts = {}) {
        const { name = null, exact = false } = opts
        const matches = () => {
          const sel = role === 'button' ? 'button, [role="button"]' : `[role="${role}"]`
          return Array.from(doc.querySelectorAll(sel)).filter((el) => {
            if (name === null) return true
            const acc = String(el.getAttribute('aria-label') ?? el.textContent ?? '').trim()
            return name instanceof RegExp ? name.test(acc) : (exact ? acc === name : acc.includes(name))
          })
        }
        const rowHtml = (id) => `<div data-row-key="session:${id}" role="treeitem" aria-selected="false"><span class="title">${id}</span></div>`
        return {
          async count() { return matches().length },
          async click() {
            const els = matches()
            if (els.length === 0) throw new Error(`fake getByRole: empty match set for ${role}`)
            calls.clicks += 1
            const el = els[0]
            const acc = String(el.getAttribute('aria-label') ?? el.textContent ?? '').trim()
            const tree = (typeof el.closest === 'function' ? el.closest('[role="tree"]') : null) ?? el.parentElement
            const noticeBox = typeof el.closest === 'function' ? el.closest('[data-welcome-notice]') : null
            if (el.tagName === 'BUTTON' && noticeBox !== null) { noticeBox.remove(); return }
            if (/^Ungrouped/.test(acc)) {
              if (groupExpand === 'render') {
                // honest toggle: the header's OWN aria-expanded flips and the
                // rows append — the structured diagnostic reads exactly this.
                el.setAttribute('aria-expanded', 'true')
                tree.insertAdjacentHTML('beforeend', (expandIds ?? [ROOT, DECOY]).map(rowHtml).join(''))
              }
              return
            }
            if (/^Show \d+ more sessions$/.test(acc)) {
              tree.innerHTML += (overflowHidden ?? []).map(rowHtml).join('')
              el.remove()
            }
          },
        }
      },
      async screenshot() { return PNG },
    }
    return page
  }
  return {
    calls,
    async newContext({ viewport } = {}) {
      calls.contexts += 1
      return { async newPage() { calls.pages += 1; return buildPage(viewport) }, async close() {} }
    },
    async close() {},
  }
}

function fakeClock() {
  let now = 0
  return { nowFn: () => now, sleepFn: async (ms) => { now += ms } }
}

test('55 WIRING happy path: REAL runObservation end-to-end (fake page + real DOM probe, both viewports) → marker written ONCE, 0600, kit-reader accepts', async () => {
  const f = mkCliFixture()
  const browser = makeFakeBrowser({ html: wireHtml() })
  const clock = fakeClock()
  const res = await runObservation(parseCli(f.args), { launch: async () => browser, ...clock })
  assert.equal(res.ok, true)
  assert.equal(browser.calls.contexts, 1, 'SINGLE context — both passes share one session')
  assert.equal(browser.calls.pages, 1)
  assert.equal(browser.calls.gotos.length, 1, 'one login/navigation, narrow pass is a RESIZE')
  assert.deepEqual(browser.calls.resizes, [{ width: 380, height: 900 }])
  const markers = readdirSync(f.markerDir)
  assert.deepEqual(markers, ['marker.json'], 'exactly one marker, no tmp residue')
  assert.equal(lstatSync(join(f.markerDir, 'marker.json')).mode & 0o777, 0o600)
  const hint = readMarkerHint(f.markerDir)
  assert.equal(hint.ok, true)
  assert.equal(hint.hint.claimed, 'observed-pending')
  const comparisons = JSON.parse(readFileSync(join(f.evidence, 'comparisons.json'), 'utf8'))
  assert.equal(comparisons.allPassed, true)
  assert.equal(existsSync(join(f.evidence, 'manifest.json')), true)
})

test('56 WIRING item-1: token-bearing goto rejection through the REAL CLI boundary → scrubbed stdout/stderr, exit 2, no marker', async () => {
  const f = mkCliFixture()
  const navErr = new Error('page.goto: Timeout 60000ms exceeded.\nCall log:\n navigating to "http://127.0.0.1:3181/?token=PRIVATE-tok-launch", waiting until "domcontentloaded"')
  navErr.name = 'TimeoutError'
  navErr.stack = `TimeoutError: page.goto: Timeout\n  navigating to "http://127.0.0.1:3181/?token=PRIVATE-tok-launch"\n  at runObservation`
  const browser = makeFakeBrowser({ html: wireHtml(), gotoError: navErr })
  const clock = fakeClock()
  const sink = []
  const code = await cliMain({
    argv: f.args,
    run: (opts) => runObservation(opts, { launch: async () => browser, ...clock }),
    stdout: (s) => sink.push(String(s)),
    stderr: (s) => sink.push(String(s)),
  })
  const joined = sink.join('')
  assert.ok(joined.includes('S2O_NAV_FAILED'), `typed reason must remain useful: ${joined}`)
  assert.ok(!joined.includes('PRIVATE-tok-launch'), 'token value NEVER crosses the output boundary')
  assert.equal(code, 2)
  assert.deepEqual(readdirSync(f.markerDir), [], 'no marker on the rejection path')
})

test('57 WIRING item-2: same page until RESIZE, then the narrow render diverges (same-LENGTH WRONG digest) → deep equality fails INSIDE runObservation, no marker', async () => {
  const wrong = `sha256:${DIGEST[7] === 'a' ? 'b' : 'a'}${DIGEST.slice(8)}`
  const f = mkCliFixture()
  const browser = makeFakeBrowser({
    html: wireHtml(),
    narrowTransform: (doc) => {
      const el = doc.querySelector('[data-control-detail-digest] dd')
      if (el !== null) el.textContent = wrong
    },
  })
  const clock = fakeClock()
  await assert.rejects(
    () => runObservation(parseCli(f.args), { launch: async () => browser, ...clock }),
    (err) => { assert.ok(err instanceof ObserverError); assert.equal(err.code, 'S2O_CHECKS_FAILED'); return true },
  )
  assert.equal(existsSync(join(f.markerDir, 'marker.json')), false, 'no marker when only the NARROW pass content is wrong')
  const comparisons = JSON.parse(readFileSync(join(f.evidence, 'comparisons.json'), 'utf8'))
  assert.equal(comparisons.allPassed, false)
  assert.ok(comparisons.normal.fields.every((r) => r.ok === true), 'the NORMAL pass was fully green — only the resized pass diverged')
  assert.ok(JSON.stringify(comparisons).includes('DIGEST_EXACT'), 'the narrow field comparison is logged')
})

test('58 WIRING item-3: REAL-clipping narrow render (trio + short fixed height appearing ONLY after resize) fails typed through the real check sequence; the real-cascade fixture (computed ellipsis, neutralized) passes — see 55', async () => {
  const f = mkCliFixture()
  const browser = makeFakeBrowser({
    html: wireHtml(),
    narrowTransform: (doc) => {
      const el = doc.querySelector('[data-control-detail-digest] dd')
      if (el !== null) el.setAttribute('style', DD_REAL_CLIP)
    },
  })
  const clock = fakeClock()
  await assert.rejects(
    () => runObservation(parseCli(f.args), { launch: async () => browser, ...clock }),
    (err) => { assert.equal(err.code, 'S2O_CHECKS_FAILED'); return true },
  )
  assert.equal(existsSync(join(f.markerDir, 'marker.json')), false)
})

test('59 WIRING item-4: never-active tab → typed timeout failure through runObservation (no marker); transient inactive→active PROCEEDS', async () => {
  const f1 = mkCliFixture()
  const never = makeFakeBrowser({ html: wireHtml(), neverActivate: true })
  const clock1 = fakeClock()
  await assert.rejects(
    () => runObservation(parseCli(f1.args), { launch: async () => never, ...clock1 }),
    (err) => { assert.equal(err.code, 'S2O_TEAM_TAB_NEVER_ACTIVATED'); return true },
  )
  assert.deepEqual(readdirSync(f1.markerDir), [], 'the timeout path writes NOTHING to the marker dir')
  const f2 = mkCliFixture()
  const transient = makeFakeBrowser({ html: wireHtml(), neverActivate: true, activateAfterPolls: 4 })
  const clock2 = fakeClock()
  const res = await runObservation(parseCli(f2.args), { launch: async () => transient, ...clock2 })
  assert.equal(res.ok, true, 'first polls false, later true ⇒ proceeds (the boolean wait REALLY waits)')
})

// ── BATCH-3 BLOCK-A: verified system Chrome + chromiumSandbox + pipe ────────

test('61 buildLaunchOptions: EXACT verified-config shape (sandbox ON, system executablePath, pipe transport, NO args array); missing/symlink chrome fails closed', () => {
  assert.equal(DEFAULT_CHROME_PATH, '/opt/google/chrome/chrome')
  const dir = mkTmp('s2o-chrome-')
  const chrome = join(dir, 'chrome')
  writeFileSync(chrome, '#!/bin/sh\n')
  chmodSync(chrome, 0o755)
  const opts = buildLaunchOptions({ chromePath: chrome })
  assert.deepEqual(opts, { headless: true, executablePath: chrome, chromiumSandbox: true, pipe: true })
  assert.ok(!('args' in opts), 'no args array at all (nothing can disable the sandbox)')
  assert.ok(!JSON.stringify(opts).includes('--no-sandbox') && !JSON.stringify(opts).includes('--disable-gpu-sandbox'))
  throwsCode(() => buildLaunchOptions({ chromePath: join(dir, 'nope') }), 'S2O_CHROME_MISSING')
  const link = join(dir, 'link-chrome')
  symlinkSync(chrome, link)
  throwsCode(() => buildLaunchOptions({ chromePath: link }), 'S2O_CHROME_NOT_FILE')
})

test('62 source pin: the default launch branch passes buildLaunchOptions output to chromium.launch — bare options objects are dead', () => {
  const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'stage2-observer.mjs'), 'utf8')
  assert.ok(/const launchOptions = buildLaunchOptions\(/.test(src), 'launch options come from the ONE builder')
  assert.ok(/chromium\.launch\(launchOptions\)/.test(src), 'the call site receives the built options')
  assert.ok(!/chromium\.launch\(\{/.test(src), 'no bare chromium.launch({...}) remains')
})

test('63 WIRING: the fake launch CANNOT mask the real config — captured options carry sandbox+executablePath+pipe verbatim', async () => {
  const f = mkCliFixture()
  let captured = null
  const base = makeFakeBrowser({ html: wireHtml() })
  const clock = fakeClock()
  const res = await runObservation(parseCli(f.args), {
    launch: async (options) => { captured = captured ?? options; return base },
    ...clock,
  })
  assert.equal(res.ok, true)
  assert.deepEqual(captured, { headless: true, executablePath: f.chrome, chromiumSandbox: true, pipe: true })
})

test('64 CLI: --chrome is the ONLY new optional flag (parsed into opts.chromePath); unknown flags stay rejected', () => {
  const f = mkCliFixture()
  const opts = parseCli(f.args)
  assert.equal(opts.chromePath, f.chrome)
  const bare = parseCli(baseArgs({ access: f.access, digestFile: f.digestFile, payloadFile: f.payloadFile, evidence: f.evidence, markerDir: f.markerDir }))
  assert.equal(bare.chromePath, null)
  throwsCode(() => parseCli([...f.args, '--chromex', 'x']), 'CLI_UNKNOWN_FLAG')
})

test('65 WIRING: chrome verification happens BEFORE launch (fail closed, launcher never called, no marker)', async () => {
  const f = mkCliFixture()
  const missing = join(f.dir, 'no-chrome-here')
  const idx = f.args.indexOf('--chrome')
  const args = [...f.args.slice(0, idx + 1), missing]
  const base = makeFakeBrowser({ html: wireHtml() })
  let launched = 0
  const clock = fakeClock()
  await assert.rejects(
    () => runObservation(parseCli(args), { launch: async () => { launched += 1; return base }, ...clock }),
    (err) => { assert.ok(err instanceof ObserverError); assert.equal(err.code, 'S2O_CHROME_MISSING'); return true },
  )
  assert.equal(launched, 0, 'typed refusal BEFORE any launch')
  assert.deepEqual(readdirSync(f.markerDir), [])
})

// ── BATCH-3 BLOCK-B: the root session is EXPLICITLY selected and verified ───

test('66 root adapters (Rows.tsx mirror): exact-id row count, BOOLEAN ready, typed validation object (decoy-selected = MISMATCH)', () => {
  const tree = sessionTreeHtml([ROOT, DECOY], { selected: DECOY })
  assert.equal(withDom(tree, () => rootSessionRowsDom(ROOT)), 1)
  assert.equal(withDom(tree, () => rootSessionRowsDom('session-absent')), 0)
  assert.equal(withDom(sessionTreeHtml([ROOT, ROOT]), () => rootSessionRowsDom(ROOT)), 2)
  assert.equal(withDom(tree, () => rootSessionReadyDom(ROOT)), false, 'decoy selected ⇒ NOT ready (no random-default trust)')
  assert.equal(withDom(tree, () => rootSessionValidatedDom(ROOT)).ok, false)
  assert.equal(withDom(tree, () => rootSessionValidatedDom(ROOT)).code, 'ROOT_MISMATCH')
  const selected = withDom(tree, (win) => {
    const rows = win.document.querySelectorAll('[role="treeitem"]')
    rows[0].setAttribute('aria-selected', 'true')
    rows[1].setAttribute('aria-selected', 'false')
    return rootSessionReadyDom(ROOT)
  })
  assert.equal(selected, true)
  assert.equal(withDom(sessionTreeHtml([DECOY], { selected: DECOY }), () => rootSessionValidatedDom(ROOT)).code, 'ROOT_ROW_MISSING')
  assert.equal(withDom(sessionTreeHtml([ROOT, ROOT]), () => rootSessionValidatedDom(ROOT)).code, 'ROOT_ROW_AMBIGUOUS')
})

test('67 resolveExpected binds rootSessionId from the SAME durable fact doc (row-carried); absent ⇒ null (runObservation fails closed); conflict ⇒ ambiguous', () => {
  const f = mkCliFixture()
  const expected = resolveExpected({ rid: RID, digestFile: f.digestFile, payloadFile: f.payloadFile })
  assert.equal(expected.rootSessionId, ROOT)
  const dir = mkTmp('s2o-root-')
  const flat = join(dir, 'flat.json')
  const pay = join(dir, 'pay.json')
  // MEMBER-ROUND note: the live reviewPayload carries a rootSessionId, so the
  // "absent ⇒ null" leg must use a payload WITHOUT one (the collector binds
  // the root from the row AND the payload — by design).
  const noRoot = { ...PAYLOAD }
  delete noRoot.rootSessionId
  const noRootDigest = reviewPayloadDigestOf(noRoot)
  writeFileSync(pay, JSON.stringify(noRoot))
  writeFileSync(flat, JSON.stringify({ requestId: RID, reviewPayloadDigest: noRootDigest }))
  assert.equal(resolveExpected({ rid: RID, digestFile: flat, payloadFile: pay }).rootSessionId, null)
  const conflict = join(dir, 'conflict.json')
  writeFileSync(conflict, JSON.stringify({
    rootSessionId: 'session-A', rows: [{ requestId: RID, reviewPayloadDigest: noRootDigest, rootSessionId: 'session-B' }],
  }))
  throwsCode(() => resolveExpected({ rid: RID, digestFile: conflict, payloadFile: pay }), 'S2O_ROOT_ID_AMBIGUOUS')
})

test('68 WIRING: NO matching root row in the page ⇒ typed fail-closed, no marker (decoy rows are NEVER opened)', async () => {
  const f = mkCliFixture()
  const browser = makeFakeBrowser({ html: wireHtml({}, { rootRow: false }) })
  const clock = fakeClock()
  await assert.rejects(
    () => runObservation(parseCli(f.args), { launch: async () => browser, ...clock }),
    (err) => { assert.equal(err.code, 'S2O_ROOT_ROW_MISSING'); return true },
  )
  assert.equal(existsSync(join(f.markerDir, 'marker.json')), false)
})

test('69 WIRING: root row present but the click never lands (decoy stays selected) ⇒ typed NEVER_SELECTED timeout, nothing written', async () => {
  const f = mkCliFixture()
  const browser = makeFakeBrowser({ html: wireHtml(), neverSelectRoot: true })
  const clock = fakeClock()
  await assert.rejects(
    () => runObservation(parseCli(f.args), { launch: async () => browser, ...clock }),
    (err) => { assert.equal(err.code, 'S2O_ROOT_NEVER_SELECTED'); return true },
  )
  assert.deepEqual(readdirSync(f.markerDir), [])
})

test('70 WIRING: durable fact without rootSessionId ⇒ S2O_ROOT_ID_MISSING fail-closed (no default-session guessing)', async () => {
  // MEMBER-ROUND note: the payload ALSO carries the root by live shape, so
  // this leg's fixture payload must not carry one — else the binding would
  // (correctly) resolve and the refusal would not fire.
  const noRoot = { ...PAYLOAD }
  delete noRoot.rootSessionId
  const f = mkCliFixture({ payloadOverride: noRoot })
  writeFileSync(f.digestFile, JSON.stringify({ requestId: RID, reviewPayloadDigest: reviewPayloadDigestOf(noRoot) }))
  const browser = makeFakeBrowser({ html: wireHtml() })
  const clock = fakeClock()
  await assert.rejects(
    () => runObservation(parseCli(f.args), { launch: async () => browser, ...clock }),
    (err) => { assert.equal(err.code, 'S2O_ROOT_ID_MISSING'); return true },
  )
  assert.equal(existsSync(join(f.markerDir, 'marker.json')), false)
})

test('71 WIRING happy path WITH root selection: decoy selected on landing, root explicitly opened + verified — still exactly one marker', async () => {
  const f = mkCliFixture()
  const browser = makeFakeBrowser({ html: wireHtml() })
  const clock = fakeClock()
  const res = await runObservation(parseCli(f.args), { launch: async () => browser, ...clock })
  assert.equal(res.ok, true)
  assert.ok(browser.calls.clicks >= 2, 'root row + Team tab clicks happened')
  assert.deepEqual(readdirSync(f.markerDir), ['marker.json'])
})

test('72 viewport-honest fake models the PINNED rule (columns.ts L23, WorkspaceBrowser L1275-1278 wide-only): FRESH narrow context AND resize below 1024 render ZERO treeitems — a fresh 380px context can NEVER select the root', async () => {
  const browser = makeFakeBrowser({ html: wireHtml() })
  const wide = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const pWide = await wide.newPage()
  assert.equal(await pWide.evaluate(rootSessionRowsDom, ROOT), 1)
  assert.equal(withDom(wireHtml(), () => globalThis.document.querySelector('[data-fixture-crumb]').textContent), FIXTURE_TITLE, 'header carries a TITLE, never the raw id (external runtime fact)')
  const freshNarrow = await browser.newContext({ viewport: { width: 380, height: 800 } })
  const pFresh = await freshNarrow.newPage()
  assert.equal(await pFresh.evaluate(rootSessionRowsDom, ROOT), 0, 'wide-only list: ZERO treeitems at 380 — this is WHY the entry is one-page-resize')
  await pWide.setViewportSize({ width: 380, height: 900 })
  assert.equal(await pWide.evaluate(rootSessionRowsDom, ROOT), 0, 'resize collapses the list too — the narrow pass must demand NOTHING invisible')
})

test('73 resize-then-verify: ONE context/page/goto + one resize to 380; both passes deep-equal the durable source (RID+digest+payload incl. rootSessionId), marker EXACTLY once', async () => {
  const f = mkCliFixture()
  const browser = makeFakeBrowser({ html: wireHtml() })
  const clock = fakeClock()
  const res = await runObservation(parseCli(f.args), { launch: async () => browser, ...clock })
  assert.equal(res.ok, true)
  assert.equal(browser.calls.contexts, 1)
  assert.equal(browser.calls.pages, 1)
  assert.equal(browser.calls.gotos.length, 1, 'no re-navigation, no re-login')
  assert.deepEqual(browser.calls.resizes, [{ width: 380, height: 900 }])
  const cmp = JSON.parse(readFileSync(join(f.evidence, 'comparisons.json'), 'utf8'))
  assert.equal(cmp.allPassed, true)
  for (const phase of ['normal', 'narrow']) {
    assert.ok(cmp[phase].fields.length > 0 && cmp[phase].fields.every((r) => r.ok === true), `${phase} field rows all ok`)
    assert.ok(cmp[phase].narrow.length > 0 && cmp[phase].narrow.every((r) => r.ok === true), `${phase} legibility rows all ok`)
  }
  assert.deepEqual(readdirSync(f.markerDir), ['marker.json'], 'exactly one marker after BOTH passes')
})

const durableRow = (payloadValue, expectedDigest) => JSON.stringify({
  factType: 'control-request-recorded', createdAt: '2026-10-02T00:00:00.000Z', sequence: '42',
  schemaVersion: 2, rootSessionId: ROOT, payload: { requestId: RID, reviewPayloadDigest: expectedDigest, reviewPayload: payloadValue },
})

test('74 narrow pass binds the durable root THROUGH THE PANEL: payload.rootSessionId diverging (same length) after resize ⇒ PAYLOAD_DEEP_EQUAL typed fail, no marker', async () => {
  const f = mkCliFixture()
  const PAY2 = { ...PAYLOAD, rootSessionId: ROOT }
  const DIG2 = reviewPayloadDigestOf(PAY2)
  writeFileSync(f.payloadFile, JSON.stringify(PAY2))
  writeFileSync(f.digestFile, durableRow(PAY2, DIG2))
  writeFileSync(f.access, JSON.stringify({ ...JSON.parse(readFileSync(f.access, 'utf8')), reviewPayloadDigest: DIG2 }))
  chmodSync(f.access, 0o600)
  const browser = makeFakeBrowser({
    html: wireHtml({ payloadValue: PAY2, digest: DIG2 }),
    narrowTransform: (doc) => {
      const pre = doc.querySelector('[data-control-detail-payload] pre')
      if (pre !== null) pre.textContent = JSON.stringify({ ...PAY2, rootSessionId: WRONG_ROOT }, null, 2)
    },
  })
  const clock = fakeClock()
  await assert.rejects(
    () => runObservation(parseCli(f.args), { launch: async () => browser, ...clock }),
    (err) => { assert.ok(err instanceof ObserverError); assert.equal(err.code, 'S2O_CHECKS_FAILED'); return true },
  )
  assert.equal(existsSync(join(f.markerDir, 'marker.json')), false)
  const comparisons = JSON.parse(readFileSync(join(f.evidence, 'comparisons.json'), 'utf8'))
  assert.equal(comparisons.allPassed, false)
  assert.ok(comparisons.narrow.fields.some((r) => r.name === 'PAYLOAD_DEEP_EQUAL' && r.ok === false), 'the root/payload binding row is the one that refused')
  assert.ok(comparisons.narrow.fields.filter((r) => r.name === 'RID_ATTR_BINDING' || r.name === 'DIGEST_EXACT').every((r) => r.ok === true), 'RID+digest still matched — payload.rootSessionId alone carried the refusal')
})

test('76 narrow header shows a TITLE (never the raw id) while RID/digest/payload incl. payload.rootSessionId ALL match ⇒ PASS + exactly one marker — zero title/ID dependency in the narrow pass', async () => {
  const f = mkCliFixture()
  const PAY2 = { ...PAYLOAD, rootSessionId: ROOT }
  const DIG2 = reviewPayloadDigestOf(PAY2)
  writeFileSync(f.payloadFile, JSON.stringify(PAY2))
  writeFileSync(f.digestFile, durableRow(PAY2, DIG2))
  writeFileSync(f.access, JSON.stringify({ ...JSON.parse(readFileSync(f.access, 'utf8')), reviewPayloadDigest: DIG2 }))
  chmodSync(f.access, 0o600)
  const html = wireHtml({ payloadValue: PAY2, digest: DIG2 })
  assert.ok(html.includes(`data-fixture-crumb>${FIXTURE_TITLE}<`), 'fixture header really displays the title, not the id')
  const browser = makeFakeBrowser({ html })
  const clock = fakeClock()
  const res = await runObservation(parseCli(f.args), { launch: async () => browser, ...clock })
  assert.equal(res.ok, true, 'title≠id is the REAL product behavior — it must not gate the narrow pass')
  const comparisons = JSON.parse(readFileSync(join(f.evidence, 'comparisons.json'), 'utf8'))
  assert.ok(comparisons.narrow.fields.some((r) => r.name === 'PAYLOAD_DEEP_EQUAL' && r.ok === true), 'payload incl. rootSessionId deep-equals the durable source')
  assert.deepEqual(readdirSync(f.markerDir), ['marker.json'], 'exactly one marker')
})

test('75 source pins: ONE context/page/goto, the narrow pass is a setViewportSize re-check, the per-viewport loop is dead, the treeitem surface is demanded EXACTLY ONCE (normal pass only)', () => {
  const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'stage2-observer.mjs'), 'utf8')
  assert.equal((src.match(/\.goto\(/g) ?? []).length, 1, 'one navigation, two passes')
  assert.equal((src.match(/browser\.newContext\(/g) ?? []).length, 1)
  assert.equal((src.match(/\.newPage\(/g) ?? []).length, 1)
  assert.ok(/page\.setViewportSize\(/.test(src), 'narrow pass resizes the SAME page')
  assert.ok(!/for \(const \[phase, viewport\]/.test(src), 'no per-viewport newContext loop remains')
  // BATCH-6 STRUCTURED DIAGNOSTIC amendment, semantics UNCHANGED: the pin is
  // about WAITING on the treeitem SURFACE (a second wait would re-demand
  // treeitems after resize); the read-only diagnostic adapter legitimately
  // QUERIES the same selector inside page.evaluate, so count WAIT SITES.
  assert.equal((src.match(/waitForSelector\(\s*'\[role="treeitem"\]'/g) ?? []).length, 1, 'the treeitem surface is waited on EXACTLY once (wide pass) — NEVER after resize')
})

test('60 source pin: the OLD object-return can never gate a wait again (wait sites use the BOOLEAN predicate + driver)', () => {
  const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'stage2-observer.mjs'), 'utf8')
  assert.ok(!/waitForFunction\s*\(\s*teamViewActivatedDom/.test(src), 'the object helper must NEVER be a wait expression again')
  assert.ok(/waitUntilTruthy\s*\(/.test(src) && /evaluate\(\s*teamViewReadyDom/.test(src), 'the wait sites use the boolean predicate through the driver')
  assert.ok(/S2O_TEAM_TAB_NEVER_ACTIVATED/.test(src), 'timeout is the typed fail-closed path')
})

// — BATCH-6 (LIVE FAILURE S2O_ROOT_ROW_MISSING): fresh-boot activation —
// PR55-proven navigation order (dod20-ui-driver.mjs @46043f78): dismiss the
// WelcomeNotice IF present → expand the collapsed-by-default Ungrouped group
// (host e2e agent-preset-selection.e2e.ts:382-383 @46a7f68b09) → open the
// post-expansion overflow — then, and only then, demand the EXACT root row.

test('77 collapsed-by-default fresh boot: ONE scoped group-header click reveals the rows; root opens, verifies, observes — exactly one marker, NO entry dump on success', async () => {
  const f = mkCliFixture()
  const browser = makeFakeBrowser({ html: wireCollapsedHtml() })
  const clock = fakeClock()
  const res = await runObservation(parseCli(f.args), { launch: async () => browser, ...clock })
  assert.equal(res.ok, true, 'the collapsed group is host DEFAULT state, not a failure')
  assert.ok(browser.calls.clicks >= 3, 'group + root row + Team tab clicks')
  assert.deepEqual(readdirSync(f.markerDir), ['marker.json'])
  assert.equal(readdirSync(f.evidence).filter((n) => n.startsWith('s2o-entry-dump')).length, 0, 'the structured entry diagnostic is failure-only — success writes NO diagnostic file')
})

test('78 WelcomeNotice present (fresh profile) is dismissed with ONE scoped Continue click BEFORE the group step, then the full pass completes', async () => {
  const f = mkCliFixture()
  const browser = makeFakeBrowser({ html: wireCollapsedHtml({ notice: true }) })
  const clock = fakeClock()
  const res = await runObservation(parseCli(f.args), { launch: async () => browser, ...clock })
  assert.equal(res.ok, true)
  assert.deepEqual(readdirSync(f.markerDir), ['marker.json'])
})

test('79 group header present but click renders NO rows ⇒ typed S2O_GROUP_EXPAND_NO_ROWS fail-closed (no positional guessing, no marker)', async () => {
  const f = mkCliFixture()
  const browser = makeFakeBrowser({ html: wireCollapsedHtml(), groupExpand: 'nothing' })
  const clock = fakeClock()
  await assert.rejects(
    () => runObservation(parseCli(f.args), { launch: async () => browser, ...clock }),
    (err) => { assert.ok(err instanceof ObserverError); assert.equal(err.code, 'S2O_GROUP_EXPAND_NO_ROWS'); return true },
  )
  assert.equal(existsSync(join(f.markerDir, 'marker.json')), false)
})

test('80 root row rides behind the post-expansion overflow: one scoped overflow click reveals it; flow completes — rows already present means NO group click', async () => {
  const f = mkCliFixture()
  const browser = makeFakeBrowser({ html: wireOverflowHtml(), overflowHidden: [ROOT] })
  const clock = fakeClock()
  const res = await runObservation(parseCli(f.args), { launch: async () => browser, ...clock })
  assert.equal(res.ok, true)
  assert.deepEqual(readdirSync(f.markerDir), ['marker.json'])
})

// — parent-authorized STRUCTURED ENTRY DIAGNOSTIC (diagnostic-only; the
// per-stage snapshot adapter is READ-ONLY; secrets are structurally
// impossible: booleans, integers, closed enums, and the already-held
// synthetic rootSessionId; the residual tripwire stays as defense-in-depth).

const STAGE_KEYS = ['expectedRootPresent', 'matchGroupState', 'matchKeyAttr', 'rowCount', 'stage', 'treeitemCount', 'ungroupedCount', 'ungroupedExpanded', 'welcomeCount', 'welcomeVisible']
const GROUP_STATES = ['expanded', 'collapsed', 'absent']

function assertDiagnosticShape(diag, { entry = ROOT } = {}) {
  assert.deepEqual(Object.keys(diag).sort(), ['code', 'entrySessionId', 'kind', 'rootSessionId', 'stages'], 'top level is EXACTLY the whitelist')
  assert.equal(diag.kind, 's2o-entry-diagnostic')
  assert.equal(diag.rootSessionId, ROOT, 'the synthetic root id rides the bounded ^session-prereq- whitelist (null for foreign shapes)')
  assert.equal(diag.entrySessionId, entry, 'entry perspective is EVIDENCED: root-entry echoes the root, member-entry the bounded child id')
  assert.ok(Array.isArray(diag.stages) && diag.stages.length > 0)
  for (const s of diag.stages) {
    assert.deepEqual(Object.keys(s).sort(), STAGE_KEYS, `stage keys EXACTLY whitelisted, zero free-text keys: ${JSON.stringify(Object.keys(s))}`)
    assert.equal(typeof s.stage, 'string')
    assert.equal(typeof s.welcomeVisible, 'boolean')
    assert.equal(typeof s.welcomeCount, 'number')
    assert.equal(typeof s.ungroupedCount, 'number')
    assert.ok(typeof s.ungroupedExpanded === 'boolean' || s.ungroupedExpanded === null, 'expanded is bool/absent')
    assert.equal(typeof s.treeitemCount, 'number')
    assert.equal(typeof s.rowCount, 'number')
    assert.equal(typeof s.expectedRootPresent, 'boolean')
    assert.equal(typeof s.matchKeyAttr, 'boolean')
    assert.ok(GROUP_STATES.includes(s.matchGroupState), 'group state is CLOSED enum')
    for (const v of Object.values(s)) assert.ok(v === null || ['string', 'number', 'boolean'].includes(typeof v), 'no nested objects/arrays')
  }
  return diag.stages
}

function readDiagnostic(f) {
  const path = join(f.evidence, 's2o-entry-dump.json')
  assert.ok(existsSync(path), 'the structured entry diagnostic exists')
  assert.equal(statSync(path).mode & 0o777, 0o600, '0600')
  assert.equal(existsSync(join(f.evidence, 's2o-entry-dump.png')), false, 'still DOM-only: NO PNG (external-found ruling stands)')
  assert.equal(readdirSync(f.evidence).filter((n) => n.startsWith('s2o-entry-dump')).length, 1, 'exactly ONE entry-diagnostic artifact')
  const text = readFileSync(path, 'utf8')
  assert.ok(!text.includes('PRIVATE-tok-launch'), 'the launch token cannot ride a structured value')
  assert.ok(!text.includes('CANARY-QUERY-VALUE'), 'no URL query values in the structured shape')
  assert.ok(!text.includes('http'), 'no URLs at all')
  return text
}

test('81 ENTRY-STAGE failure writes ONE 0600 STRUCTURED diagnostic: exact whitelisted shape, zero free-text keys, canaries structurally absent', async () => {
  const f = mkCliFixture()
  const canary = 'http://127.0.0.1:3181/session?auth=CANARY-QUERY-VALUE&s2o=PRIVATE-tok-launch'
  const browser = makeFakeBrowser({ html: wireCollapsedHtml({ canary }), groupExpand: 'nothing' })
  const clock = fakeClock()
  await assert.rejects(
    () => runObservation(parseCli(f.args), { launch: async () => browser, ...clock }),
    (err) => { assert.ok(err instanceof ObserverError); return true },
  )
  const text = readDiagnostic(f)
  const stages = assertDiagnosticShape(JSON.parse(text))
  const byStage = Object.fromEntries(stages.map((s) => [s.stage, s]))
  assert.equal(byStage['pre-group'].ungroupedCount, 1)
  assert.equal(byStage['pre-group'].ungroupedExpanded, false, 'collapsed-by-default is EVIDENCED before the action')
  assert.equal(byStage['pre-group'].rowCount, 0)
  assert.equal(byStage['post-group'].ungroupedExpanded, false, 'the no-op fake never flipped the toggle')
  assert.equal(byStage['post-group'].expectedRootPresent, false)
  assert.equal(existsSync(join(f.markerDir, 'marker.json')), false)
})

test('82 collapsed-group EVIDENCE: pre-action ungroupedCount=1/expanded=false, POST-action expanded=true with rowCount=0 → GROUP_EXPAND_NO_ROWS carries the evidence', async () => {
  const f = mkCliFixture()
  const browser = makeFakeBrowser({ html: wireCollapsedHtml(), groupExpand: 'render', expandIds: [] })
  const clock = fakeClock()
  await assert.rejects(
    () => runObservation(parseCli(f.args), { launch: async () => browser, ...clock }),
    (err) => { assert.equal(err.code, 'S2O_GROUP_EXPAND_NO_ROWS'); return true },
  )
  const stages = assertDiagnosticShape(JSON.parse(readDiagnostic(f)))
  const byStage = Object.fromEntries(stages.map((s) => [s.stage, s]))
  assert.equal(byStage['pre-group'].ungroupedCount, 1)
  assert.equal(byStage['pre-group'].ungroupedExpanded, false)
  assert.equal(byStage['post-group'].ungroupedExpanded, true, 'the toggle really flipped — the rail is open and EMPTY')
  assert.equal(byStage['post-group'].rowCount, 0)
})

test('83 named-group fixture (P-b family EVIDENCED): ungroupedCount=0 at every stage, treeitemCount=1, activation refuses to guess, typed MISSING', async () => {
  const f = mkCliFixture()
  const browser = makeFakeBrowser({ html: wireNamedGroupHtml() })
  const clock = fakeClock()
  await assert.rejects(
    () => runObservation(parseCli(f.args), { launch: async () => browser, ...clock }),
    (err) => { assert.equal(err.code, 'S2O_ROOT_ROW_MISSING'); return true },
  )
  const stages = assertDiagnosticShape(JSON.parse(readDiagnostic(f)))
  for (const s of stages) {
    assert.equal(s.ungroupedCount, 0, 'no Ungrouped header exists — the diagnostic says so WITHOUT any guessing')
    assert.equal(s.treeitemCount, 1, 'the named group header is the one treeitem')
    assert.equal(s.rowCount, 0)
    assert.equal(s.expectedRootPresent, false)
  }
})

test('84 rows-present-different-key (P-a family EVIDENCED): rowCount>0 with expectedRootPresent=false at every stage, typed MISSING', async () => {
  const f = mkCliFixture()
  const browser = makeFakeBrowser({ html: wireHtml({}, { rootRow: false }) })
  const clock = fakeClock()
  await assert.rejects(
    () => runObservation(parseCli(f.args), { launch: async () => browser, ...clock }),
    (err) => { assert.equal(err.code, 'S2O_ROOT_ROW_MISSING'); return true },
  )
  const stages = assertDiagnosticShape(JSON.parse(readDiagnostic(f)))
  for (const s of stages) {
    assert.equal(s.rowCount, 2, 'rows ARE rendered')
    assert.equal(s.expectedRootPresent, false, 'none carries the expected key')
    assert.equal(s.matchKeyAttr, false)
  }
})

// — PARENT-AUTHORIZED MEMBER-PERSPECTIVE ENTRY (test-lane only; VERIFIED
// FACTS: the root view of a blank-root world is DEAD (zero turn/start on
// Tmain — row permanently invisible), the member child session is the lawful
// entry, and its DURABLE BINDING (storages/team_domain.json, shape verified
// @prereq-2026-10-01T20-10-50) is the ONLY entry authority — no fallback row,
// no product change. entryPerspective=member is stated HONEST everywhere.

test('85 MEMBER MODE (blank-root world): durable binding green ⇒ entry opens the MEMBER row (root row absent), observes, marks — entryPerspective=member HONEST in result AND meta, NO diagnostic on success', async () => {
  const f = mkCliFixture({ member: true })
  const browser = makeFakeBrowser({ html: wireMemberHtml() })
  const clock = fakeClock()
  const res = await runObservation(parseCli(f.args), { launch: async () => browser, ...clock })
  assert.equal(res.ok, true, 'member perspective completes where the root row is invisible (journal truth)')
  assert.equal(res.entryPerspective, 'member', 'NEVER claimed leader/root')
  assert.equal(res.memberInstanceId, 'inst-a1b2c3')
  assert.deepEqual(readdirSync(f.markerDir), ['marker.json'])
  assert.equal(readdirSync(f.evidence).filter((n) => n.startsWith('s2o-entry-dump')).length, 0, 'success writes NO diagnostic')
  const meta = JSON.parse(readFileSync(join(f.evidence, 'meta.json'), 'utf8'))
  assert.equal(meta.entryPerspective, 'member')
  assert.equal(meta.entrySessionId, MEMBER, 'the bounded child id is EVIDENCED in the evidence meta')
  assert.equal(meta.memberInstanceId, 'inst-a1b2c3')
})

test('86 member bound to a FOREIGN root (durable mismatch): typed refusal BEFORE any UI action, browser NEVER touched, zero writes', async () => {
  const f = mkCliFixture({ member: true, domainJson: mkTeamDomainJson({ bindingOverride: { rootSessionId: WRONG_ROOT } }) })
  const browser = makeFakeBrowser({ html: wireMemberHtml() })
  let launches = 0
  await assert.rejects(
    () => runObservation(parseCli(f.args), { launch: async () => { launches += 1; return browser }, ...fakeClock() }),
    (err) => { assert.ok(err instanceof ObserverError); assert.equal(err.code, 'S2O_MEMBER_BINDING_MISMATCH'); return true },
  )
  assert.equal(launches, 0, 'the DURABLE check precedes any UI action')
  assert.deepEqual(readdirSync(f.markerDir), [])
  assert.deepEqual(readdirSync(f.evidence), [])
})

test('87 member NOT in this world\'s session_bindings: S2O_MEMBER_NOT_IN_BINDINGS before any UI, zero writes — never the "first visible row"', async () => {
  const f = mkCliFixture({ member: true, domainJson: mkTeamDomainJson({ omitBinding: true }) })
  const browser = makeFakeBrowser({ html: wireMemberHtml() })
  let launches = 0
  await assert.rejects(
    () => runObservation(parseCli(f.args), { launch: async () => { launches += 1; return browser }, ...fakeClock() }),
    (err) => { assert.equal(err.code, 'S2O_MEMBER_NOT_IN_BINDINGS'); return true },
  )
  assert.equal(launches, 0)
  assert.deepEqual(readdirSync(f.markerDir), [])
  assert.deepEqual(readdirSync(f.evidence), [])
})

test('88 member mode COMPOSES with fresh-boot activation: collapsed group expands, the revealed MEMBER row becomes the entry', async () => {
  const f = mkCliFixture({ member: true })
  const browser = makeFakeBrowser({ html: wireCollapsedHtml(), groupExpand: 'render', expandIds: [MEMBER, DECOY] })
  const clock = fakeClock()
  const res = await runObservation(parseCli(f.args), { launch: async () => browser, ...clock })
  assert.equal(res.ok, true)
  assert.equal(res.entryPerspective, 'member')
})

test('89 durable binding DRIFT between checks is typed (direct resolveMemberBinding — the PRE-PUBLICATION recheck semantics, P1 ordering)', async () => {
  const mod = await import('./stage2-observer.mjs')
  assert.equal(typeof mod.resolveMemberBinding, 'function', 'exported for the reviewer to audit the ONE binding authority')
  const dir = mkTmp('s2o-domain-')
  const p = join(dir, 'team_domain.json')
  writeFileSync(p, mkTeamDomainJson())
  const first = mod.resolveMemberBinding({ teamDomainPath: p, memberSessionId: MEMBER, expectedRootSessionId: ROOT })
  assert.deepEqual(first, { memberInstanceId: 'inst-a1b2c3', memberRootSessionId: ROOT, memberSessionId: MEMBER })
  writeFileSync(p, mkTeamDomainJson({ childOverride: `session-team-child-${'b'.repeat(32)}` }))
  assert.throws(
    () => mod.resolveMemberBinding({ teamDomainPath: p, memberSessionId: MEMBER, expectedRootSessionId: ROOT }),
    (err) => { assert.equal(err.code, 'S2O_MEMBER_BINDING_MISMATCH'); return true },
    'the instance row no longer names OUR child session — provenance broke',
  )
})

test('90 member mode refuses a reviewPayload WITHOUT the durable rootSessionId BEFORE the browser — an unprovable perspective never observes', async () => {
  const noRoot = { schema: 'recovery-dispatch/v1', instanceId: 'inst-7', note: 'ünïcode ✓' }
  const f = mkCliFixture({ member: true, payloadOverride: noRoot })
  let launches = 0
  await assert.rejects(
    () => runObservation(parseCli(f.args), {
      launch: async () => { launches += 1; return makeFakeBrowser({ html: wireMemberHtml({ payloadValue: noRoot }) }) },
      ...fakeClock(),
    }),
    (err) => { assert.equal(err.code, 'S2O_MEMBER_BINDING_MISMATCH'); return true },
  )
  assert.equal(launches, 0)
  assert.deepEqual(readdirSync(f.markerDir), [])
})

test('91 ENTRY failure in member mode: the diagnostic records BOTH bounded ids (root + entry=member), stage shape unchanged', async () => {
  const f = mkCliFixture({ member: true })
  const browser = makeFakeBrowser({ html: wireCollapsedHtml(), groupExpand: 'nothing' })
  await assert.rejects(
    () => runObservation(parseCli(f.args), { launch: async () => browser, ...fakeClock() }),
    (err) => { assert.equal(err.code, 'S2O_GROUP_EXPAND_NO_ROWS'); return true },
  )
  const text = readDiagnostic(f)
  assertDiagnosticShape(JSON.parse(text), { entry: MEMBER })
})

// — PARENT P1 (ORDERING): the marker is an ATOMIC PUBLICATION consumed by a
// LIVE kit the moment it exists — therefore EVERY required verification
// (comparison oracles, durable-binding drift recheck, marker-content guard)
// must complete BEFORE publication, and the marker write is the LAST
// consequential action. Leg 92 orchestrates the REAL flow and injects binding
// drift AFTER the pre-UI resolve but strictly BEFORE the publish point; the
// pre-fix ordering published the marker first and only THEN failed (defect
// proven in the RED raw) — the contract asserted here is the fixed one.

test('92 P1 ORDERING: binding drift injected between pre-UI resolve and the publish point ⇒ typed refusal AND ZERO MARKER ON DISK (marker is published only after ALL verification)', async () => {
  const f = mkCliFixture({ member: true })
  const browser = makeFakeBrowser({ html: wireMemberHtml() })
  let drifted = false
  let evals = 0
  const origNewContext = browser.newContext.bind(browser)
  browser.newContext = async (o) => {
    const ctx = await origNewContext(o)
    const origNewPage = ctx.newPage.bind(ctx)
    ctx.newPage = async () => {
      const p = await origNewPage()
      const origEval = p.evaluate.bind(p)
      p.evaluate = async (...a) => {
        const r = await origEval(...a)
        // ONE injection on the 3rd in-page evaluate — strictly AFTER the
        // pre-UI durable resolve, strictly BEFORE the publish point.
        if ((evals += 1) === 3 && !drifted) {
          drifted = true
          writeFileSync(f.domain, mkTeamDomainJson({ childOverride: `session-team-child-${'c'.repeat(32)}` }))
        }
        return r
      }
      return p
    }
    return ctx
  }
  await assert.rejects(
    () => runObservation(parseCli(f.args), { launch: async () => browser, ...fakeClock() }),
    (err) => { assert.ok(err instanceof ObserverError); assert.equal(err.code, 'S2O_MEMBER_BINDING_MISMATCH'); return true },
  )
  assert.equal(drifted, true, 'the drift really rode the REAL observation path (not a unit mock)')
  assert.ok(evals > 3, 'the flow ran well past the injection point')
  assert.deepEqual(readdirSync(f.markerDir), [], 'NOTHING may be published before required verification completes')
})

test('93 rider (reviewer MINOR): TWO member_instances rows naming the same {instance,root}→child ⇒ matches!==1 typed MISMATCH', async () => {
  const { resolveMemberBinding } = await import('./stage2-observer.mjs')
  const base = JSON.parse(mkTeamDomainJson())
  const k = Object.keys(base.tables.member_instances)[0]
  const v = base.tables.member_instances[k]
  const parts = k.slice(1, -1).split(',') // {"instanceId":…,"rootSessionId":…} — rebuild REVERSED
  const reversed = `{${parts[1]},${parts[0]}}` // different raw key, SAME parsed fields
  base.tables.member_instances[reversed] = v
  const dir = mkTmp('s2o-dup-')
  const p = join(dir, 'team_domain.json')
  writeFileSync(p, JSON.stringify(base))
  assert.throws(
    () => resolveMemberBinding({ teamDomainPath: p, memberSessionId: MEMBER, expectedRootSessionId: ROOT }),
    (err) => { assert.equal(err.code, 'S2O_MEMBER_BINDING_MISMATCH'); return true },
    'exactly-one provenance row is a hard bound — ambiguity never picks',
  )
})

test('94 rider (reviewer MINOR): --team-domain fail-closed branches — unparseable / missing tables / >16MiB cap all typed, symlink refused at parse', async () => {
  const { resolveMemberBinding } = await import('./stage2-observer.mjs')
  const dir = mkTmp('s2o-dom-')
  const bad = join(dir, 'bad.json')
  writeFileSync(bad, 'not json at all {{{')
  assert.throws(() => resolveMemberBinding({ teamDomainPath: bad, memberSessionId: MEMBER, expectedRootSessionId: ROOT }), (err) => { assert.equal(err.code, 'S2O_MEMBER_DOMAIN_SHAPE'); return true })
  const empty = join(dir, 'empty.json')
  writeFileSync(empty, JSON.stringify({ unit: { name: 'team_domain', version: 2 }, global: null, tables: {} }))
  assert.throws(() => resolveMemberBinding({ teamDomainPath: empty, memberSessionId: MEMBER, expectedRootSessionId: ROOT }), (err) => { assert.equal(err.code, 'S2O_MEMBER_DOMAIN_SHAPE'); return true }, 'missing session_bindings/member_instances tables is NOT a team_domain file')
  const huge = join(dir, 'huge.json')
  writeFileSync(huge, `{"pad":"${'x'.repeat(16 * 1024 * 1024 + 1)}"}`)
  assert.throws(() => resolveMemberBinding({ teamDomainPath: huge, memberSessionId: MEMBER, expectedRootSessionId: ROOT }), (err) => { assert.equal(err.code, 'S2O_MEMBER_DOMAIN_SHAPE'); return true }, 'bounded read: a domain file beyond the cap is refused BEFORE parsing')
  const link = join(dir, 'link.json')
  const real = join(dir, 'real.json')
  writeFileSync(real, mkTeamDomainJson())
  symlinkSync(real, link)
  const f = mkCliFixture({ member: true })
  assert.throws(() => parseCli([...f.args.filter((a) => a !== f.domain), link]), (err) => { assert.equal(err.code, 'CLI_NOT_REGULAR_FILE'); return true }, 'symlinked domain files never parse')
})

test('95 rider (reviewer MINOR): forged --member-session shape is CLI-typed, and --team-domain alone (no member) is a typed pairing refusal', () => {
  const f = mkCliFixture({ member: true })
  assert.throws(
    () => parseCli(f.args.map((a) => (a === MEMBER ? 'session-team-child-ZZZZ' : a))),
    (err) => { assert.equal(err.code, 'CLI_MEMBER_SESSION_SHAPE'); return true },
  )
  assert.throws(
    () => parseCli(f.args.filter((a) => a !== f.domain && a !== '--team-domain')),
    (err) => { assert.equal(err.code, 'CLI_MISSING_TEAM_DOMAIN'); return true },
    'member id without the durable file: never trusted',
  )
  assert.throws(
    () => parseCli(f.args.filter((a) => a !== MEMBER && a !== '--member-session')),
    (err) => { assert.equal(err.code, 'CLI_MISSING_MEMBER_SESSION'); return true },
    'the durable file alone never picks an entry session',
  )
})

// — PARENT-ORDERED GEOMETRY READS (this PR #54 round): additive proofs —
// container/field widths and clipping of the resolve-bar buttons and the
// activity rows. jsdom hosts have NO layout engine (clientWidth is 0 for
// EVERY element) → the check must report UNASSERTED there (proven by the
// wiring leg: all pre-existing legs keep their markers). RED fixture models
// the REAL run5 380px geometry read off evidence comparisons.json (bar box
// rendered at 356px while dd boxes collapsed to 0/12px); GREEN fixture
// models the post-PR56-fixed-CSS shape. Offline legs + static reasoning —
// NO live run.

function geometryHtml() {
  return `
  <div data-team-view>
    <div data-ledger-rows-box>
      <div data-ledger-row><span data-ledger-time>21:44</span><span data-ledger-summary>w-b3a delegate</span></div>
    </div>
    <div data-ledger-resolve-bar data-request-id="${RID}" data-control-surface="enabled">
      <dl data-control-detail class="controlDetail">
        <div data-control-detail-request-id><dt>request</dt><dd>${RID}</dd></div>
        <div data-digest-source="ledger-wire"><dt>digest</dt><dd>sha256:abc</dd></div>
        <div data-control-detail-payload><dt>payload</dt><pre>{"a":1}</pre></div>
      </dl>
      <button data-ledger-resolve-allow>Allow</button>
      <button data-ledger-resolve-deny>Deny</button>
    </div>
  </div>`
}

function boxOf(win, selector, { width, left = 0, right = null }) {
  const el = win.document.querySelector(selector)
  assert.ok(el !== null, `fixture element ${selector} present`)
  Object.defineProperty(el, 'clientWidth', { value: width, configurable: true })
  el.getBoundingClientRect = () => ({ left, right: right ?? left + width, width, top: 0, bottom: 0, height: 10, x: left, y: 0 })
}

test('96 GEOMETRY READS: run5-era 380px collapse FAILS widths+buttons+rows; post-fix widths GREEN; layout-less jsdom host UNASSERTED', async () => {
  const { checkGeometryDom } = await import('./stage2-observer.mjs')
  // RED fixture — numbers transcribed from the live run5 comparisons.json
  // (bar rendered, VALUE track collapsed: ridDd 0, digestDd 0, payloadPre 12)
  // + buttons/rows clipped by the same non-collapsing sidebar squeeze.
  const broken = withDom(geometryHtml(), (win) => {
    boxOf(win, '[data-ledger-resolve-bar]', { width: 356 })
    boxOf(win, '[data-control-detail]', { width: 336, left: 10, right: 346 })
    boxOf(win, '[data-control-detail-request-id] dd', { width: 0 })
    boxOf(win, '[data-digest-source="ledger-wire"] dd', { width: 0 })
    boxOf(win, '[data-control-detail-payload] pre', { width: 12, left: 12, right: 24 })
    boxOf(win, '[data-ledger-resolve-allow]', { width: 70, left: 286, right: 356 })
    boxOf(win, '[data-ledger-resolve-deny]', { width: 70, left: 300, right: 370 }) // right PAST the 356 bar
    boxOf(win, '[data-ledger-rows-box]', { width: 340, right: 350 })
    boxOf(win, '[data-ledger-summary]', { width: 300, left: 60, right: 360 }) // clipped past rows box
    return checkGeometryDom({ rid: RID })
  })
  const byName = Object.fromEntries(broken.rows.map((r) => [r.name, r]))
  assert.equal(broken.ok, false, 'run5-era geometry MUST fail the new legs')
  assert.equal(byName.GEO_FIELD_WIDTHS.ok, false)
  assert.match(byName.GEO_FIELD_WIDTHS.detail, /collapsed=\[ridDd,digestDd\]/)
  assert.equal(byName.GEO_RESOLVE_BUTTONS_FIT.ok, false)
  assert.match(byName.GEO_RESOLVE_BUTTONS_FIT.detail, /overflow=\[deny\]/)
  assert.equal(byName.GEO_ROWS_CHILDREN_FIT.ok, false)
  assert.match(byName.GEO_ROWS_CHILDREN_FIT.detail, /overflow=\[row0:summary\]/)
  // GREEN fixture — the post-PR56 shape (fields get real widths, everything fits)
  const fixed = withDom(geometryHtml(), (win) => {
    boxOf(win, '[data-ledger-resolve-bar]', { width: 356 })
    boxOf(win, '[data-control-detail]', { width: 336, left: 10, right: 346 })
    boxOf(win, '[data-control-detail-request-id] dd', { width: 300, left: 40, right: 340 })
    boxOf(win, '[data-digest-source="ledger-wire"] dd', { width: 300, left: 40, right: 340 })
    boxOf(win, '[data-control-detail-payload] pre', { width: 344, left: 12, right: 356 })
    boxOf(win, '[data-ledger-resolve-allow]', { width: 70, left: 190, right: 260 })
    boxOf(win, '[data-ledger-resolve-deny]', { width: 70, left: 266, right: 336 })
    boxOf(win, '[data-ledger-rows-box]', { width: 340, right: 350 })
    boxOf(win, '[data-ledger-summary]', { width: 260, left: 60, right: 320 })
    return checkGeometryDom({ rid: RID })
  })
  assert.equal(fixed.ok, true, `post-fix geometry passes: ${JSON.stringify(fixed.rows)}`)
  // UNASSERTED honesty — a layout-less jsdom host (all-zero widths) never
  // asserts false: only a LIVE browser reports a rendered bar box > 0.
  const unasserted = withDom(geometryHtml(), () => checkGeometryDom({ rid: RID }))
  assert.equal(unasserted.ok, true)
  assert.ok(unasserted.rows.every((r) => /unasserted/.test(r.detail)), 'layout-less host ⇒ every geometry row UNASSERTED, never fake-fail')
})

test('97 GEOMETRY wiring: full runObservation success still emits the marker AND comparisons.json carries the GEO_ rows in the unchanged {name,ok,detail} shape (both phases)', async () => {
  const f = mkCliFixture()
  const browser = makeFakeBrowser({ html: wireHtml() })
  const res = await runObservation(parseCli(f.args), { launch: async () => browser, ...fakeClock() })
  assert.equal(res.ok, true, 'the additive reads never veto a healthy observation')
  const comp = JSON.parse(readFileSync(join(res.evidenceDir, 'comparisons.json'), 'utf8'))
  for (const phase of ['normal', 'narrow']) {
    const names = comp[phase].narrow.map((r) => r.name)
    assert.ok(names.includes('GEO_FIELD_WIDTHS') && names.includes('GEO_RESOLVE_BUTTONS_FIT') && names.includes('GEO_ROWS_CHILDREN_FIT'), `${phase} carries the geometry rows`)
    assert.ok(comp[phase].narrow.every((r) => typeof r.name === 'string' && typeof r.ok === 'boolean' && typeof r.detail === 'string'), 'artifact SHAPE unchanged')
  }
  // the pre-existing legibility legs are BYTE-KEPT in order ahead of the new rows
  assert.equal(comp.narrow.narrow[0].name, 'NARROW_RID_LENGTH')
})

// — STABILITY GATE (round 5, parent CODE GO): the narrow pass must NOT
// measure mid-relayout (run6 proved an RO/rAF-lag transient). Gate keys
// STRICTLY on consecutive-identical GEOMETRY samples (never on oracle
// results), bounded ~50ms polls inside the existing OBSERVE_TIMEOUT
// deadline, typed S2O_GEOMETRY_UNSTABLE fail-closed with NO marker.
// Transient (pre-stability) samples ride the raws as evidence.

function wrapEvaluate(pageLike, { samplerName = 'sampleFrameGeometryDom', scripted }) {
  const orig = pageLike.evaluate.bind(pageLike)
  const order = []
  pageLike.evaluate = async (fn, arg) => {
    const name = typeof fn === 'function' ? fn.name : String(fn)
    order.push(name)
    if (name === samplerName) {
      const s = scripted(name)
      if (s !== undefined) return s
    }
    return orig(fn, arg)
  }
  return order
}

test('98 GATE: transient geometry samples → the gate WAITS (never evaluates mid-ease), then evaluates ONCE the samples are consecutive-identical; transient samples recorded as evidence', async () => {
  const f = mkCliFixture()
  const browser = makeFakeBrowser({ html: wireHtml() })
  const origNewContext = browser.newContext.bind(browser)
  browser.newContext = async (o) => {
    const ctx = await origNewContext(o)
    const baseNewPage = ctx.newPage.bind(ctx)
    ctx.newPage = async () => {
      const p = await baseNewPage()
      let n = 0
      wrapEvaluate(p, {
        scripted: () => {
          n += 1
          // call #1 is the WIDE diagnostic; transients ride calls #2-#3,
          // then REAL (consecutive-identical) samples settle the narrow gate.
          return n >= 2 && n <= 3 ? { transient: n, bar: [327.5 - n, 347.5 - n] } : undefined
        },
      })
      return p
    }
    return ctx
  }
  const res = await runObservation(parseCli(f.args), { launch: async () => browser, ...fakeClock() })
  assert.equal(res.ok, true, 'a transient that SETTLES must still succeed on the settled layout')
  const comp = JSON.parse(readFileSync(join(res.evidenceDir, 'comparisons.json'), 'utf8'))
  const g = comp.narrow.geometry
  assert.equal(g.gated, true)
  assert.ok(g.preSamples.length >= 2, `pre-stability evidence recorded: ${g.preSamples.length}`)
  assert.ok(JSON.stringify(g.preSamples[0]) !== JSON.stringify(g.preSamples[1]), 'transient samples really differed (run6-style window captured in raws)')
  assert.ok(g.polls >= 4, `gate polled through the transient: polls=${g.polls}`)
})

test('99 GATE: geometry that NEVER settles ⇒ typed S2O_GEOMETRY_UNSTABLE at the bounded deadline, ZERO marker on disk (fail-closed; the gate never waits for a PASS)', async () => {
  const f = mkCliFixture()
  const browser = makeFakeBrowser({ html: wireHtml() })
  const origNewContext = browser.newContext.bind(browser)
  browser.newContext = async (o) => {
    const ctx = await origNewContext(o)
    const baseNewPage = ctx.newPage.bind(ctx)
    ctx.newPage = async () => {
      const p = await baseNewPage()
      let n = 0
      wrapEvaluate(p, { scripted: () => ({ always: (n += 1) }) }) // samples NEVER repeat
      return p
    }
    return ctx
  }
  await assert.rejects(
    () => runObservation(parseCli(f.args), { launch: async () => browser, ...fakeClock() }),
    (err) => { assert.ok(err instanceof ObserverError); assert.equal(err.code, 'S2O_GEOMETRY_UNSTABLE'); return true },
  )
  assert.deepEqual(readdirSync(f.markerDir), [], 'no marker may exist when the geometry never quiesced')
})

test('100 GATE: already-stable data (every prior fixture) pays exactly ONE redundant identical pair — verdicts byte-unchanged; geometry diagnostics land BOTH viewports', async () => {
  const f = mkCliFixture()
  const browser = makeFakeBrowser({ html: wireHtml() })
  const res = await runObservation(parseCli(f.args), { launch: async () => browser, ...fakeClock() })
  assert.equal(res.ok, true)
  const comp = JSON.parse(readFileSync(join(res.evidenceDir, 'comparisons.json'), 'utf8'))
  assert.equal(comp.narrow.geometry.gated, true)
  assert.equal(comp.narrow.geometry.polls, 2, 'stable data: sample, poll, identical — exactly one redundant pair')
  assert.deepEqual(comp.narrow.geometry.preSamples, [], 'no transient, no evidence clutter')
  assert.equal(comp.normal.geometry.gated, false, 'wide pass: diagnostic sampling only — it never resized')
  assert.equal(comp.normal.narrow[0].name, 'NARROW_RID_LENGTH', 'oracle rows byte-kept in front')
})
