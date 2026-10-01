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
  symlinkSync, chmodSync, lstatSync, rmSync, existsSync,
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
const PAYLOAD = { schema: 'recovery-dispatch/v1', instanceId: 'inst-7', note: 'ünïcode ✓' }
const DIGEST = reviewPayloadDigestOf(PAYLOAD) // sha256:<64hex> via the kit's SINGLE canonical impl

/** Panel mirror of TeamLedger.tsx @ aa677a34 (pins in the file header).
 *  `styles` mirror TeamLedger.module.css @ aa677a34 verbatim (see header). */
const DD_GENERIC = 'overflow:hidden;white-space:nowrap;text-overflow:ellipsis' // .controlField dd L298-306
const DD_DIGEST = 'overflow:visible;white-space:normal;word-break:break-all' // .controlField dd.controlDigestValue L339-344
const PRE_PAYLOAD = 'white-space:pre-wrap;word-break:break-all;overflow:auto' // .controlPayload L347-360

function panelHtml({
  rid = RID, digest = DIGEST, payloadValue = PAYLOAD, renderMode = 'recovery-v1',
  omitDigest = false, omitPayload = false, omitRequestIdField = false,
  digestStyle = DD_DIGEST, preStyle = PRE_PAYLOAD, requestIdText = null,
} = {}) {
  const payloadText = (omitPayload || payloadValue === undefined) ? null : JSON.stringify(payloadValue, null, 2)
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

function mkCliFixture({ mode = 0o600, digestMode = 'file' } = {}) {
  const dir = mkTmp('s2o-cli-')
  const access = join(dir, 'browser-access.json')
  const payloadFile = join(dir, 'payload.json')
  const digestFile = join(dir, 'fact.json')
  writeFileSync(access, JSON.stringify({
    launchUrl: 'http://127.0.0.1:3181/?token=PRIVATE-tok-launch', origin: 'http://127.0.0.1:3181',
    requestId: RID, reviewPayloadDigest: DIGEST, world: '/x/tests/homes/w',
  }))
  chmodSync(access, mode)
  writeFileSync(payloadFile, JSON.stringify(PAYLOAD))
  writeFileSync(digestFile, JSON.stringify({ requestId: RID, reviewPayloadDigest: DIGEST }))
  const evidence = join(dir, 'evidence')
  const markerDir = join(dir, 'marker')
  return {
    dir, access, payloadFile, digestFile, evidence, markerDir,
    args: digestMode === 'file'
      ? baseArgs({ access, digestFile, payloadFile, evidence, markerDir })
      : ['--access', access, '--rid', RID, '--digest', DIGEST, '--payload-file', payloadFile,
        '--evidence', evidence, '--viewport', '1440x900', '--marker-dir', markerDir],
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
