#!/usr/bin/env node
/**
 * ui-observe.test.mjs — pure/lightweight unit tests for the PR-E kit's opt-in
 * UI observe hold-point helpers (`ui-observe.mjs`). Run ONLY this file:
 *   node --test tests/kits/pr-e-requirement-recovery-smoke/ui-observe.test.mjs
 * No host, no browser, no network, no kit execution — the live-host matrix
 * stays the env's job (TEST_METHODS).
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, symlinkSync, realpathSync, lstatSync, chmodSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import {
  UI_CLAIMS, MAX_UI_HOLD_MS, DEFAULT_UI_HOLD_MS, ObserveFlagError,
  sha256Hex, canonicalJson, reviewPayloadDigestOf,
  parseObserveFlags, validateAccessRecordPath, readMarkerHint,
  verifyUiTruth, planUiHoldStep, summarizeUiObserve,
  UI_CLIENT_ROW_ID, uiClientShimIndexHref, uiClientBundlePath, uiClientPatchLines,
  UI_LEDGER_READ_BUDGET_MS, evaluateUiReadResult, writePrivateAccessRecord,
} from './ui-observe.mjs'

// ── fixtures ────────────────────────────────────────────────────────────────

function mkTmp(prefix = 'uio-') {
  return mkdtempSync(join(tmpdir(), prefix))
}

/** A fake repo shape: <root>/tests/homes/<world>, <root>/packages. */
function mkFakeRepo() {
  const root = mkTmp('uio-repo-')
  mkdirSync(join(root, 'tests', 'homes', 'world-1'), { recursive: true })
  mkdirSync(join(root, 'packages'), { recursive: true })
  return { root, homes: join(root, 'tests', 'homes'), world: join(root, 'tests', 'homes', 'world-1') }
}

function throwsCode(fn, code, msg) {
  assert.throws(fn, (err) => {
    assert.ok(err instanceof ObserveFlagError || err instanceof Error, 'typed error')
    assert.equal(err.code, code, `expected code ${code}, got ${err.code} (${err.message})`)
    return true
  }, msg)
}

const SAMPLE = { b: 1, a: [2, { d: null, c: 'x' }], z: 'ünïcode ✓' }

// ── 1. flag-off identity ────────────────────────────────────────────────────

test('flags: OFF by default — disabled shape, no fs effects (byte-identical old behavior)', () => {
  const { root, world } = mkFakeRepo()
  const dflt = parseObserveFlags([], { workspaceRoot: root, worldDir: world })
  assert.deepEqual(dflt, { enabled: false, observeDir: null, holdMs: 0 })
  // other kit flags must not enable it
  const other = parseObserveFlags(['--worktree', root, '--testuse', root], { workspaceRoot: root, worldDir: world })
  assert.deepEqual(other, { enabled: false, observeDir: null, holdMs: 0 })
})

test('flags: ON parses dir (realpath) + holdMs; default hold > the 120s abort seam', () => {
  const { root, world } = mkFakeRepo()
  // the coordinator-authorized shape: a CONTROLLED dir INSIDE the workspace
  const obs = join(root, '.worktrees', '.scratch-logs', 'pr54-ui-observe')
  const on = parseObserveFlags(['--ui-observe', obs], { workspaceRoot: root, worldDir: world })
  assert.equal(on.enabled, true)
  assert.equal(on.observeDir, join(realpathSync(root), '.worktrees', '.scratch-logs', 'pr54-ui-observe'))
  assert.equal(on.holdMs, DEFAULT_UI_HOLD_MS)
  assert.ok(DEFAULT_UI_HOLD_MS > 120_000 && DEFAULT_UI_HOLD_MS <= MAX_UI_HOLD_MS)
  const held = parseObserveFlags(['--ui-observe', obs, '--ui-hold-ms', '5000'], { workspaceRoot: root, worldDir: world })
  assert.equal(held.holdMs, 5000)
  assert.equal(parseObserveFlags(['--ui-observe', obs, '--ui-hold-ms', String(MAX_UI_HOLD_MS)], { workspaceRoot: root, worldDir: world }).holdMs, MAX_UI_HOLD_MS)
})

test('flags: malformed values fail closed (typed errors)', () => {
  const { root, world } = mkFakeRepo()
  const obs = join(root, 'ui-observe')
  throwsCode(() => parseObserveFlags(['--ui-observe'], { workspaceRoot: root, worldDir: world }), 'UI_OBSERVE_MISSING_VALUE')
  throwsCode(() => parseObserveFlags(['--ui-observe', '--ui-hold-ms'], { workspaceRoot: root, worldDir: world }), 'UI_OBSERVE_MISSING_VALUE')
  throwsCode(() => parseObserveFlags(['--ui-hold-ms', '5000'], { workspaceRoot: root, worldDir: world }), 'UI_OBSERVE_HOLD_WITHOUT_MODE')
  for (const bad of ['0', '-1', 'abc', '1.5', String(MAX_UI_HOLD_MS + 1)]) {
    throwsCode(() => parseObserveFlags(['--ui-observe', obs, '--ui-hold-ms', bad], { workspaceRoot: root, worldDir: world }), 'UI_OBSERVE_HOLD_INVALID', `holdMs=${bad}`)
  }
})

// ── 2. observe-dir placement guards (coordinator ruling 2026-10-01: the dir
//     must live INSIDE the authorized workspace, fully separated from the
//     tests/homes private 0600 auth world) ──────────────────────────────────

test('observe dir: must resolve INSIDE the authorized workspace (/tmp and the root itself rejected)', () => {
  const { root, world } = mkFakeRepo()
  const ok = parseObserveFlags(['--ui-observe', join(root, 'ui-observe')], { workspaceRoot: root, worldDir: world })
  assert.equal(ok.enabled, true)
  // a not-yet-created dir inside the workspace passes via nearest-existing-ancestor realpath
  const future = parseObserveFlags(['--ui-observe', join(root, 'dev', 'run-1', 'ui-observe')], { workspaceRoot: root, worldDir: world })
  assert.equal(future.enabled, true)
  assert.equal(future.observeDir, join(realpathSync(root), 'dev', 'run-1', 'ui-observe'))
  // absolute-outside is rejected (prefix + realpath)
  throwsCode(() => parseObserveFlags(['--ui-observe', mkTmp('uio-elsewhere-')], { workspaceRoot: root, worldDir: world }), 'UI_OBSERVE_OUTSIDE_WORKSPACE')
  throwsCode(() => parseObserveFlags(['--ui-observe', tmpdir()], { workspaceRoot: root, worldDir: world }), 'UI_OBSERVE_OUTSIDE_WORKSPACE')
  throwsCode(() => parseObserveFlags(['--ui-observe', root], { workspaceRoot: root, worldDir: world }), 'UI_OBSERVE_IS_WORKSPACE_ROOT')
})

test('observe dir: rejected identical-to / inside the world, and anywhere under tests/homes', () => {
  const { root, world } = mkFakeRepo()
  throwsCode(() => parseObserveFlags(['--ui-observe', world], { workspaceRoot: root, worldDir: world }), 'UI_OBSERVE_IDENTICAL_TO_WORLD')
  throwsCode(() => parseObserveFlags(['--ui-observe', join(world, 'ui-observe')], { workspaceRoot: root, worldDir: world }), 'UI_OBSERVE_INSIDE_WORLD')
  throwsCode(() => parseObserveFlags(['--ui-observe', join(root, 'tests', 'homes')], { workspaceRoot: root, worldDir: world }), 'UI_OBSERVE_INSIDE_HOME')
  throwsCode(() => parseObserveFlags(['--ui-observe', join(root, 'tests', 'homes', 'other-world')], { workspaceRoot: root, worldDir: world }), 'UI_OBSERVE_INSIDE_HOME')
})

test('observe dir: ".." escape rejected at the raw-arg level', () => {
  const { root, world } = mkFakeRepo()
  // NOTE: literal strings — path.join would NORMALIZE the '..' away; the raw
  // argv segment is what the guard must refuse (fail closed, no resolution).
  throwsCode(() => parseObserveFlags(['--ui-observe', `${root}/ui-observe/../elsewhere`], { workspaceRoot: root, worldDir: world }), 'UI_OBSERVE_PATH_ESCAPE')
  // an arg that TEXTUALLY rides out of the workspace on '..' is still refused
  throwsCode(() => parseObserveFlags(['--ui-observe', `${join(root, 'tests', 'homes', 'world-1')}/../../../../elsewhere`], { workspaceRoot: root, worldDir: world }), 'UI_OBSERVE_PATH_ESCAPE')
})

test('observe dir: symlink escapes rejected via realpath (out of workspace / into homes)', () => {
  const { root, world } = mkFakeRepo()
  const outside = mkTmp('uio-outside-')
  const linkIntoRoot = join(root, 'link-out')
  symlinkSync(outside, linkIntoRoot) // inside the tree, real target OUTSIDE the workspace
  throwsCode(() => parseObserveFlags(['--ui-observe', linkIntoRoot], { workspaceRoot: root, worldDir: world }), 'UI_OBSERVE_OUTSIDE_WORKSPACE')
  const linkIntoHomes = join(root, 'link-homes')
  symlinkSync(join(root, 'tests', 'homes'), linkIntoHomes)
  throwsCode(() => parseObserveFlags(['--ui-observe', linkIntoHomes], { workspaceRoot: root, worldDir: world }), 'UI_OBSERVE_INSIDE_HOME')
  const linkIntoWorld = join(root, 'link-world')
  symlinkSync(world, linkIntoWorld)
  throwsCode(() => parseObserveFlags(['--ui-observe', linkIntoWorld], { workspaceRoot: root, worldDir: world }), 'UI_OBSERVE_IDENTICAL_TO_WORLD')
})

// ── 3. access-record placement guard (test-home ONLY) ───────────────────────

test('access record: accepts ONLY tests/homes/<world>/browser-access.json', () => {
  const { root, world } = mkFakeRepo()
  const p = validateAccessRecordPath({ repoRoot: root, worldDir: world })
  assert.equal(p, join(realpathSync(world), 'browser-access.json'))
})

test('access record: rejects repo paths outside homes, /tmp worlds, ".." and symlink-escaped worlds', () => {
  const { root, world } = mkFakeRepo()
  throwsCode(() => validateAccessRecordPath({ repoRoot: root, worldDir: join(root, 'packages') }), 'UI_ACCESS_NOT_IN_HOMES')
  throwsCode(() => validateAccessRecordPath({ repoRoot: root, worldDir: join(root, 'dev') }), 'UI_ACCESS_NOT_IN_HOMES')
  throwsCode(() => validateAccessRecordPath({ repoRoot: root, worldDir: mkTmp('uio-elsewhere-') }), 'UI_ACCESS_NOT_IN_HOMES')
  throwsCode(() => validateAccessRecordPath({ repoRoot: root, worldDir: join(root, 'tests', 'homes') }), 'UI_ACCESS_WORLD_IS_HOMES_ROOT')
  throwsCode(() => validateAccessRecordPath({ repoRoot: root, worldDir: `${join(root, 'tests', 'homes')}/../packages` }), 'UI_ACCESS_PATH_ESCAPE')
  const elsewhere = mkTmp('uio-realworld-')
  const link = join(root, 'tests', 'homes', 'sneaky-link')
  symlinkSync(elsewhere, link)
  throwsCode(() => validateAccessRecordPath({ repoRoot: root, worldDir: link }), 'UI_ACCESS_NOT_IN_HOMES')
})

// ── 4. marker hint is a HINT (tolerant read, never truth) ───────────────────

test('readMarkerHint: tolerant read, schema-lite, never throws, never trusts', () => {
  const dir = mkTmp('uio-hint-')
  assert.equal(readMarkerHint(dir).ok, false) // no marker yet
  assert.equal(readMarkerHint(join(dir, 'does-not-exist')).ok, false)
  writeFileSync(join(dir, 'marker.json'), '{not json')
  assert.equal(readMarkerHint(dir).ok, false)
  writeFileSync(join(dir, 'marker.json'), JSON.stringify({ requestId: 'r-1' })) // missing fields
  assert.equal(readMarkerHint(dir).ok, false)
  writeFileSync(join(dir, 'marker.json'), JSON.stringify({ requestId: 'r-1', digest: 'sha256:aa', claimed: 'auto-allow', ts: 1 }))
  assert.equal(readMarkerHint(dir).ok, false) // claim OUTSIDE the closed set
  writeFileSync(join(dir, 'marker.json'), JSON.stringify([1, 2]))
  assert.equal(readMarkerHint(dir).ok, false)
  const hint = { requestId: 'r-1', digest: 'sha256:aa', claimed: 'resolved:deny', ts: 123 }
  writeFileSync(join(dir, 'marker.json'), JSON.stringify(hint))
  const res = readMarkerHint(dir)
  assert.equal(res.ok, true)
  assert.deepEqual(res.hint, hint) // shape passthrough — STILL only a hint
  for (const c of UI_CLAIMS) {
    writeFileSync(join(dir, 'marker.json'), JSON.stringify({ requestId: 'r', digest: 'sha256:a', claimed: c }))
    assert.equal(readMarkerHint(dir).ok, true, `claim ${c} is in the closed set`)
  }
})

// ── 5. verifyUiTruth: durable fact is the ONLY truth (forged-marker matrix) ──

const RP = { schema: 'dsh-agent-team/recovery-dispatch/v1', action: 'delegate', templateId: 'worker' }
const RID = 'req-0001'
const EXPECTED_DIGEST = reviewPayloadDigestOf(RP)

function ledgerWith(...facts) {
  return [{ factType: 'control-request-recorded', payload: { requestId: RID, reviewPayload: RP, reviewPayloadDigest: EXPECTED_DIGEST } }, ...facts]
}
function markerFor(claimed, over = {}) {
  return { requestId: RID, digest: EXPECTED_DIGEST, claimed, ts: Date.now(), ...over }
}

test('verifyUiTruth: claims match ONLY when the durable fact says so', () => {
  const denyLedger = ledgerWith({ factType: 'control-decision-recorded', payload: { requestId: RID, decision: 'deny' } })
  const allowLedger = ledgerWith({ factType: 'control-decision-recorded', payload: { requestId: RID, decision: 'allow' } })
  const abandonLedger = ledgerWith({ factType: 'control-request-abandoned', payload: { requestId: RID } })

  assert.deepEqual(
    (({ ok, decision }) => ({ ok, decision }))(verifyUiTruth({ marker: markerFor('resolved:deny'), ledgerFacts: denyLedger, expectedRequestId: RID, expectedDigest: EXPECTED_DIGEST })),
    { ok: true, decision: 'deny' })
  assert.equal(verifyUiTruth({ marker: markerFor('resolved:allow'), ledgerFacts: allowLedger, expectedRequestId: RID, expectedDigest: EXPECTED_DIGEST }).ok, true)
  assert.equal(verifyUiTruth({ marker: markerFor('abandon-observed'), ledgerFacts: abandonLedger, expectedRequestId: RID, expectedDigest: EXPECTED_DIGEST }).decision, 'abandoned')
})

test('verifyUiTruth: FORGED markers rejected — wrong requestId / digest mismatch / claim w/o durable fact', () => {
  const bare = ledgerWith()
  const base = { expectedRequestId: RID, expectedDigest: EXPECTED_DIGEST }
  let r = verifyUiTruth({ marker: markerFor('resolved:deny', { requestId: 'req-FORGED' }), ledgerFacts: ledgerWith({ factType: 'control-decision-recorded', payload: { requestId: RID, decision: 'deny' } }), ...base })
  assert.equal(r.ok, false)
  assert.match(r.reason, /REQUEST_ID/)
  r = verifyUiTruth({ marker: markerFor('resolved:deny', { digest: 'sha256:deadbeef' }), ledgerFacts: ledgerWith({ factType: 'control-decision-recorded', payload: { requestId: RID, decision: 'deny' } }), ...base })
  assert.equal(r.ok, false)
  assert.match(r.reason, /DIGEST/)
  r = verifyUiTruth({ marker: markerFor('resolved:deny'), ledgerFacts: bare, ...base })
  assert.equal(r.ok, false)
  assert.match(r.reason, /NO_DURABLE_FACT/)
  r = verifyUiTruth({ marker: markerFor('resolved:allow'), ledgerFacts: ledgerWith({ factType: 'control-decision-recorded', payload: { requestId: RID, decision: 'deny' } }), ...base })
  assert.equal(r.ok, false)
  assert.match(r.reason, /MISMATCH/)
  r = verifyUiTruth({ marker: markerFor('abandon-observed'), ledgerFacts: bare, ...base })
  assert.equal(r.ok, false)
  assert.match(r.reason, /NO_DURABLE_FACT/)
  // a tampered RECORDED fact (its own reviewPayloadDigest no longer matches the recomputation) is rejected
  const tampered = [{ factType: 'control-request-recorded', payload: { requestId: RID, reviewPayload: RP, reviewPayloadDigest: 'sha256:tampered' } },
    { factType: 'control-decision-recorded', payload: { requestId: RID, decision: 'deny' } }]
  r = verifyUiTruth({ marker: markerFor('resolved:deny'), ledgerFacts: tampered, ...base })
  assert.equal(r.ok, false)
  assert.match(r.reason, /DIGEST/)
  // a marker whose claim is outside the closed set is rejected outright
  r = verifyUiTruth({ marker: { requestId: RID, digest: EXPECTED_DIGEST, claimed: 'auto-allow' }, ledgerFacts: bare, ...base })
  assert.equal(r.ok, false)
})

test('verifyUiTruth: stale ts is judged ONLY by the durable fact', () => {
  const denyLedger = ledgerWith({ factType: 'control-decision-recorded', payload: { requestId: RID, decision: 'deny' } })
  const r = verifyUiTruth({ marker: markerFor('resolved:deny', { ts: 1 }), ledgerFacts: denyLedger, expectedRequestId: RID, expectedDigest: EXPECTED_DIGEST })
  assert.equal(r.ok, true)
})

test('verifyUiTruth: surface-close asserts ZERO new fact — NEVER deny/allow/abandon', () => {
  const base = { expectedRequestId: RID, expectedDigest: EXPECTED_DIGEST }
  const r = verifyUiTruth({ marker: markerFor('surface-close'), ledgerFacts: ledgerWith(), ...base })
  assert.equal(r.ok, true)
  assert.equal(r.decision, 'surface-close-zero-effect')
  // any durable effect for the requestId makes surface-close a LIE (fail closed)
  for (const fact of [
    { factType: 'control-decision-recorded', payload: { requestId: RID, decision: 'deny' } },
    { factType: 'control-decision-recorded', payload: { requestId: RID, decision: 'allow' } },
    { factType: 'control-request-abandoned', payload: { requestId: RID } },
  ]) {
    const bad = verifyUiTruth({ marker: markerFor('surface-close'), ledgerFacts: ledgerWith(fact), ...base })
    assert.equal(bad.ok, false, `surface-close must reject durable fact ${fact.factType}/${fact.payload.decision ?? 'abandoned'}`)
    assert.match(bad.reason, /ZERO_EFFECT/)
  }
})

// ── 6. hold-deadline semantics: fail CLOSED, never resolve-on-behalf ────────

test('planUiHoldStep: expired deadline -> fail-closed, NO resolve/auto-allow in the decision', () => {
  const now = 1_000_000
  let step = planUiHoldStep({ nowMs: now, deadlineMs: now - 1, markerSeen: false })
  assert.equal(step.action, 'fail-closed')
  assert.equal(step.autoResolve, false)
  assert.equal(step.reason, 'UI NOT_RUN')
  assert.ok(!('decision' in step) && !('resolve' in step), 'the fail-closed decision must not carry any resolve action')
  step = planUiHoldStep({ nowMs: now, deadlineMs: now - 1, markerSeen: true })
  assert.equal(step.action, 'fail-closed')
  assert.equal(step.autoResolve, false)
  assert.equal(step.reason, 'UI TIMEOUT')
  step = planUiHoldStep({ nowMs: now, deadlineMs: now + 5_000, markerSeen: true })
  assert.deepEqual(step, { action: 'wait', autoResolve: false })
})

// ── 7. canonicalJson / sha256 golden vectors (ONE implementation) ───────────

// Verbatim copy of the kit's ORIGINAL (pre-module) local implementations —
// the golden reference proving the module copy keeps the kit's results
// byte-identical (the kit now imports the module).
function kitSha256Hex(s) {
  return createHash('sha256').update(s, 'utf8').digest('hex')
}
function kitCanonicalJson(value) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean' || typeof value === 'number') {
    return JSON.stringify(value)
  }
  if (Array.isArray(value)) return `[${value.map((item) => kitCanonicalJson(item)).join(',')}]`
  const entries = Object.entries(value).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
  return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${kitCanonicalJson(item)}`).join(',')}}`
}

test('golden vectors: canonicalJson + sha256Hex pin the kit digest pattern exactly', () => {
  assert.equal(canonicalJson(null), 'null')
  assert.equal(canonicalJson(SAMPLE), '{"a":[2,{"c":"x","d":null}],"b":1,"z":"ünïcode ✓"}')
  assert.equal(sha256Hex(''), 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855')
  assert.equal(reviewPayloadDigestOf(null), 'sha256:74234e98afe7498fb5daf1f36ac2d78acc339464f950703b8c019892f982b90b')
  assert.equal(reviewPayloadDigestOf(SAMPLE), 'sha256:5886179e232cc478a5c2b586236ccf7fa2bfd74ee8c476cb597ca74903917990')
  // parity with the kit's original local implementation across a payload zoo
  const zoo = [null, 0, -0, 1.5, true, false, '', 'x', [], [1, [2, {}]], {}, { b: 1, a: 2 }, { A: 1, a: 2, '0': 3 }, SAMPLE,
    { reviewPayload: { schema: 'dsh-agent-team/recovery-dispatch/v1', nested: { z: [null, { y: 'ü' }] } } }]
  for (const v of zoo) {
    assert.equal(canonicalJson(v), kitCanonicalJson(v))
    assert.equal(reviewPayloadDigestOf(v), `sha256:${kitSha256Hex(kitCanonicalJson(v ?? null))}`)
  }
})

// ── 8. summary.json is token-free by construction ───────────────────────────

test('summarizeUiObserve: scrubbed origin, digest PREFIX only, zero token patterns', () => {
  const full = reviewPayloadDigestOf(SAMPLE)
  const summary = summarizeUiObserve({
    runStamp: 'prereq-test',
    origin: 'http://127.0.0.1:3182/?token=SECRETFAKE&x=1',
    requestId: RID,
    digest: full,
    outcome: 'AWAITING',
    holdMs: 180_000,
    claim: null,
  })
  const json = JSON.stringify(summary)
  assert.equal(summary.origin, 'http://127.0.0.1:3182')
  assert.doesNotMatch(json, /SECRET/)
  assert.doesNotMatch(json, /token/i)
  assert.doesNotMatch(json, /\bsk-[A-Za-z0-9]{24,}/)
  assert.doesNotMatch(json, /\blt-v1-/)
  assert.ok(!json.includes(full), 'the FULL digest never rides on the summary — prefix only')
  assert.equal(summary.digestPrefix, full.slice(0, 18))
  assert.equal(summary.requestId, RID)
  assert.equal(summary.outcome, 'AWAITING')
  assert.equal(summary.holdMs, 180_000)
})

// ── 9. FIX-1: UI bootstrap client row (S8-pattern contract) ─────────────────

test('FIX-1: flag-off — the builder contributes ZERO bytes (patch text byte-identical)', () => {
  assert.deepEqual(uiClientPatchLines({ worktree: '/repo', enabled: false }), [])
  // Assembled-patch golden: with the builder OFF the kit's patch assembly is
  // the current committed form byte-for-byte (the '' trailing entry stays).
  const base = ['# hdr', '# c', '- insert:', '    - id: dsh-agent-team', '    - id: p6t6-team-tools']
  const assemble = (enabled) => [...base,
    ...(enabled ? ['', ...uiClientPatchLines({ worktree: '/repo', enabled })] : []),
    ''].join('\n')
  const legacy = [...base, ''].join('\n')
  assert.equal(assemble(false), legacy)
})

test('FIX-1: client row golden — the S8 contract shape (browser-smoke-host rewriteWorldProfile)', () => {
  const golden = [
    '# browser client row (S8 pattern — the team client half bundle; UI OBSERVE bootstrap):',
    '- insert:',
    '    - id: dsh-agent-team-client',
    '      name: "file:///repo/packages/client/composition-shim/index.js"',
  ].join('\n')
  assert.equal(uiClientPatchLines({ worktree: '/repo', enabled: true }).join('\n'), golden)
  assert.equal(uiClientShimIndexHref('/repo'), 'file:///repo/packages/client/composition-shim/index.js')
  assert.equal(uiClientBundlePath('/repo'), '/repo/packages/client/composition-shim/client-bundle.js')
  assert.equal(UI_CLIENT_ROW_ID, 'dsh-agent-team-client')
})

// ── 10. FIX-2: absolute deadline (a late truth NEVER verifies) ──────────────

test('FIX-2: fake-clock — truth arriving just before the deadline verifies', () => {
  assert.deepEqual(
    evaluateUiReadResult({ readDoneMs: 999, deadlineMs: 1000, truthOk: true, budgetExceeded: false }),
    { action: 'verified', autoResolve: false })
})

test('FIX-2: fake-clock — a ledger read completing AT/PAST the deadline is UI TIMEOUT even with truth.ok', () => {
  for (const readDoneMs of [1000, 1001]) {
    const r = evaluateUiReadResult({ readDoneMs, deadlineMs: 1000, truthOk: true, budgetExceeded: false })
    assert.equal(r.action, 'fail-closed')
    assert.equal(r.reason, 'UI TIMEOUT')
    assert.equal(r.autoResolve, false)
    assert.ok(!('decision' in r) && !('resolve' in r), 'no resolve/auto-allow may ride on a late truth')
  }
})

test('FIX-2: fake-clock — a marker appearing past the deadline is rejected (pre-read boundary)', () => {
  // the kit loop consults planUiHoldStep BEFORE the ledger read: past the
  // boundary there is NO read, NO truth evaluation and NO verified path.
  const step = planUiHoldStep({ nowMs: 1001, deadlineMs: 1000, markerSeen: false })
  assert.equal(step.action, 'fail-closed')
  assert.equal(step.reason, 'UI NOT_RUN')
  // and even a marker+read that crossed the deadline together cannot verify:
  assert.equal(evaluateUiReadResult({ readDoneMs: 1200, deadlineMs: 1000, truthOk: true, budgetExceeded: false }).action, 'fail-closed')
})

test('FIX-2: fake-clock — read-budget overrun is not-yet-verified, never verified', () => {
  const r = evaluateUiReadResult({ readDoneMs: 900, deadlineMs: 1000, truthOk: true, budgetExceeded: true })
  assert.equal(r.action, 'not-verified')
  assert.equal(r.reason, 'READ_BUDGET_EXCEEDED')
  assert.equal(r.autoResolve, false)
  assert.ok(!('decision' in r) && !('resolve' in r))
  assert.ok(UI_LEDGER_READ_BUDGET_MS > 0 && UI_LEDGER_READ_BUDGET_MS < DEFAULT_UI_HOLD_MS)
})

// ── 11. FIX-3: secure auth write (world-only 0600; O_EXCL|O_NOFOLLOW; never
//         follows/rewrites pre-existing leaves; homes pinned inside the repo) ─

test('FIX-3: a tests/homes symlink escaping the authorized repo root is rejected', () => {
  const base = mkTmp('uio-repo2-')
  mkdirSync(join(base, 'tests'), { recursive: true })
  const elsewhere = mkTmp('uio-homesout-')
  symlinkSync(elsewhere, join(base, 'tests', 'homes'))
  // P2-A re-review: the homes ROOT is now PINNED non-symlink (typed, earliest) —
  // an out-of-repo target is refused by the root pin before containment even runs.
  throwsCode(() => validateAccessRecordPath({ repoRoot: base, worldDir: join(base, 'tests', 'homes', 'w1') }), 'UI_ACCESS_HOMES_ROOT_SYMLINK')
})

test('FIX-3: observe dir may NOT contain the world (inverse disjointness)', () => {
  const { root, world } = mkFakeRepo()
  throwsCode(() => parseObserveFlags(['--ui-observe', join(root, 'tests')], { workspaceRoot: root, worldDir: world }), 'UI_OBSERVE_CONTAINS_WORLD')
})

test('FIX-3: leaf symlink + loose-mode leaf refused UNTOUCHED; happy path writes a verified 0600 record', () => {
  const { root, world } = mkFakeRepo()
  const leaf = join(world, 'browser-access.json')
  const payload = { note: 'x', requestId: 'r-1' }
  // (c) pre-existing LEAF symlink — refused, never followed, never rewritten
  const target = join(mkTmp('uio-target-'), 'victim.json')
  writeFileSync(target, 'VICTIM')
  symlinkSync(target, leaf)
  throwsCode(() => writePrivateAccessRecord({ repoRoot: root, worldDir: world, payload }), 'UI_ACCESS_LEAF_SYMLINK')
  assert.ok(lstatSync(leaf).isSymbolicLink(), 'leaf symlink untouched')
  assert.equal(readFileSync(target, 'utf8'), 'VICTIM', 'symlink target untouched')
  rmSync(leaf)
  // (d) pre-existing leaf with looser mode — refused WITHOUT chmod (legacy records are never rewritten)
  writeFileSync(leaf, 'LEGACY')
  chmodSync(leaf, 0o644)
  throwsCode(() => writePrivateAccessRecord({ repoRoot: root, worldDir: world, payload }), 'UI_ACCESS_LEAF_MODE')
  assert.equal(readFileSync(leaf, 'utf8'), 'LEGACY', 'loose-mode leaf content untouched')
  assert.equal(lstatSync(leaf).mode & 0o777, 0o644, 'loose-mode leaf mode untouched (no chmod)')
  rmSync(leaf)
  // (e/f) happy path — NEW record only: O_EXCL|O_NOFOLLOW 0600, fstat+realpath verified
  const written = writePrivateAccessRecord({ repoRoot: root, worldDir: world, payload })
  assert.equal(written.path, join(realpathSync(world), 'browser-access.json'))
  assert.equal(lstatSync(written.path).mode & 0o777, 0o600)
  assert.equal(realpathSync(written.path), written.path)
  assert.deepEqual(JSON.parse(readFileSync(written.path, 'utf8')), payload)
  // this lane only ever writes NEW fixtures it created — a re-write is refused
  throwsCode(() => writePrivateAccessRecord({ repoRoot: root, worldDir: world, payload }), 'UI_ACCESS_LEAF_EXISTS')
  assert.deepEqual(JSON.parse(readFileSync(written.path, 'utf8')), payload, 'refused re-write left the created record intact')
})

// ── 12. RE-REVIEW P2-A: canonical homes pin (in-repo symlink redirect is the
//         reproducible attack) + evidence-segment refusal ─────────────────────

test('P2-A: homes ROOT symlinked to an IN-REPO evidence dir is refused; target stays UNWRITTEN', () => {
  const { root, world } = mkFakeRepo() // real tests/homes
  // rebuild: real homes replaced by a symlink to an in-repo evidence location
  const homes = join(root, 'tests', 'homes')
  rmSync(homes, { recursive: true })
  const evidenceWorlds = join(root, 'dev', 'agent-workflow', 'evidence', 'auth-worlds')
  mkdirSync(join(evidenceWorlds, 'w1'), { recursive: true })
  symlinkSync(evidenceWorlds, homes)
  throwsCode(() => validateAccessRecordPath({ repoRoot: root, worldDir: join(homes, 'w1') }), 'UI_ACCESS_HOMES_ROOT_SYMLINK')
  throwsCode(() => writePrivateAccessRecord({ repoRoot: root, worldDir: join(homes, 'w1'), payload: { launchUrl: 'https://x' } }), 'UI_ACCESS_HOMES_ROOT_SYMLINK')
  // the previous out-of-repo-target coverage is NOT enough — this in-repo
  // evidence target is the one that passed every containment check:
  assert.equal(readdirSync(join(evidenceWorlds, 'w1')).length, 0, 'evidence target dir must stay UNWRITTEN')
  void world
})

test('P2-A: a world whose realpath lands under an .../evidence/... segment is refused even via legitimate layouts', () => {
  const { root } = mkFakeRepo()
  const evidenceWorld = join(root, 'dev', 'agent-workflow', 'evidence', 'auth-worlds', 'w1')
  mkdirSync(evidenceWorld, { recursive: true })
  symlinkSync(evidenceWorld, join(root, 'tests', 'homes', 'w1')) // homes root stays REAL — world alone redirects
  throwsCode(() => validateAccessRecordPath({ repoRoot: root, worldDir: join(root, 'tests', 'homes', 'w1') }), 'UI_ACCESS_WORLD_IN_EVIDENCE')
})

test('P2-A: normal REAL-DIR homes keeps working (pin does not relax or break the happy path)', () => {
  const { root, world } = mkFakeRepo()
  const written = writePrivateAccessRecord({ repoRoot: root, worldDir: world, payload: { ok: 1 } })
  assert.equal(lstatSync(written.path).mode & 0o777, 0o600)
})
