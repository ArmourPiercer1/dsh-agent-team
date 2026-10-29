/**
 * tests/world-factory/arm-verdict.test.mjs — R-ENVBLOCK-1 classification law.
 *
 * Unit home for lib/arm-verdict.mjs, the three-way split every unwitnessed
 * arm of a C2 suite must pass through:
 *
 *   reached the expected step + the witness is absent  → FAIL  (product)
 *   never reached the step, NO environment signal      → NOT_REACHED (harness)
 *   never reached the step, VERIFIED environment signal → ENV_BLOCK (env)
 *
 * The point of the tests below is that ENV_BLOCK is the HARDEST verdict to
 * earn: in-test prose, a paraphrase, a product refusal code, or a quote from
 * a channel nobody captured all fall back to NOT_REACHED — which is a fact
 * about the drive, and is allowed to say nothing at all about the environment.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  NOT_REACHED,
  ENV_SIGNAL_CHANNELS,
  envSignal,
  classifyUnwitnessedArm,
  gateEnvBlock,
} from './lib/arm-verdict.mjs'

const MOUNT_REFUSED = 'a5-plane: mount-REFUSED for s-1 (PLANE_SURFACE_COVERAGE_REFUSED)'
const PROVISION_REFUSED = 'kit-provision REFUSED: no u7-f-web kit could be provisioned for this home'
const PRODUCT_REFUSED = 'governed-web-fetch REFUSED code=PLANE_WEB_PROVIDER_REFUSED dest=https://x.invalid/'

test('T1 reached the step and the witness is absent → FAIL, never an environment verdict', () => {
  const v = classifyUnwitnessedArm({ step: 'the durable PA ask row', reachedStep: true, extra: { askRows: 0 } })
  assert.equal(v.verdict, 'FAIL')
  assert.match(v.detail.reason, /reached the durable PA ask row and the expected witness is absent/)
  assert.equal(v.detail.askRows, 0)
})

test('T2 never reached + no signal → NOT_REACHED, and it states it is not an environment claim', () => {
  const v = classifyUnwitnessedArm({ step: 'the durable PA ask row', reachedStep: false, extra: { stubLedger: { claimHits: 0 } } })
  assert.equal(v.verdict, NOT_REACHED)
  assert.match(v.detail.reason, /NOT an environment claim/)
  assert.equal(v.detail.envSignal, undefined)
})

test('T3 a bare in-test reason is NOT a signal — prose-only writers get NOT_REACHED', () => {
  const v = classifyUnwitnessedArm({
    step: 'the governed fetch',
    reachedStep: false,
    signal: 'no durable ask row reached the ledger face (upstream wall)',
  })
  assert.equal(v.verdict, NOT_REACHED)
})

test('T4 a paraphrased signal (not verbatim in the captured channel) is rejected', () => {
  const sig = envSignal({ channel: 'host-log', text: 'the plane refused to mount the web pair', observed: [MOUNT_REFUSED] })
  assert.equal(sig, null)
  assert.equal(classifyUnwitnessedArm({ step: 'x', reachedStep: false, signal: sig }).verdict, NOT_REACHED)
})

test('T5 a signal from a channel outside the closed set is rejected', () => {
  assert.equal(ENV_SIGNAL_CHANNELS.includes('my-gut'), false)
  const sig = envSignal({ channel: 'my-gut', text: PROVISION_REFUSED, observed: [PROVISION_REFUSED] })
  assert.equal(sig, null)
})

test('T6 a PRODUCT refusal quote never buys ENV_BLOCK (the laundering case)', () => {
  const sig = envSignal({ channel: 'host-log', text: PRODUCT_REFUSED, observed: [PRODUCT_REFUSED] })
  assert.equal(sig, null, 'a governed-web family refusal is product behavior, not environment unavailability')
  assert.equal(classifyUnwitnessedArm({ step: 'x', reachedStep: false, signal: sig }).verdict, NOT_REACHED)
})

test('T7 a verbatim host-log plane-admission refusal IS a signal → ENV_BLOCK quoting it', () => {
  const sig = envSignal({ channel: 'host-log', text: MOUNT_REFUSED, observed: [MOUNT_REFUSED] })
  assert.notEqual(sig, null)
  const v = classifyUnwitnessedArm({ step: 'the governed fetch', reachedStep: false, signal: sig })
  assert.equal(v.verdict, 'ENV_BLOCK')
  assert.equal(v.detail.envSignal.text, MOUNT_REFUSED)
  assert.equal(v.detail.envSignal.channel, 'host-log')
  assert.match(v.detail.reason, /mount-REFUSED/)
})

test('T8 the kit-provision channel is the second sanctioned environment wall', () => {
  const sig = envSignal({ channel: 'kit-provision', text: PROVISION_REFUSED, observed: [PROVISION_REFUSED] })
  assert.notEqual(sig, null)
  assert.equal(classifyUnwitnessedArm({ step: 'x', reachedStep: false, signal: sig }).verdict, 'ENV_BLOCK')
})

test('T9 the sandbox channel needs the pre-flight conjunction, same law as nativeConfinementEnvBlock', () => {
  const line = 'sandbox backend: unusable (probe: no usable launcher)'
  assert.equal(envSignal({ channel: 'sandbox-preflight', text: line, observed: [line] }), null)
  assert.equal(envSignal({ channel: 'sandbox-preflight', text: line, observed: [line], preflight: { backend: 'partial' } }), null)
  const ok = envSignal({ channel: 'sandbox-preflight', text: line, observed: [line], preflight: { backend: 'unusable' } })
  assert.notEqual(ok, null)
  assert.equal(classifyUnwitnessedArm({ step: 'x', reachedStep: false, signal: ok }).verdict, 'ENV_BLOCK')
})

test('T10 gateEnvBlock: the suite-level door demotes a signal-less ENV_BLOCK to NOT_REACHED', () => {
  const bad = gateEnvBlock('ENV_BLOCK', { reason: 'upstream wall' })
  assert.equal(bad.verdict, NOT_REACHED)
  assert.match(bad.detail.reason, /demoted/)
  const genuine = envSignal({ channel: 'host-log', text: MOUNT_REFUSED, observed: [MOUNT_REFUSED] })
  const good = gateEnvBlock('ENV_BLOCK', { reason: 'r', envSignal: genuine })
  assert.equal(good.verdict, 'ENV_BLOCK')
  assert.equal(good.detail.envSignalRecheck.ok, true)
  assert.equal(gateEnvBlock('FAIL', { reason: 'x' }).verdict, 'FAIL')
  assert.equal(gateEnvBlock('PASS', {}).verdict, 'PASS')
})

test('T11 an empty / whitespace-only observed corpus can never produce a signal', () => {
  assert.equal(envSignal({ channel: 'host-log', text: MOUNT_REFUSED, observed: [] }), null)
  assert.equal(envSignal({ channel: 'host-log', text: '', observed: [MOUNT_REFUSED] }), null)
  assert.equal(envSignal({ channel: 'host-log', observed: [MOUNT_REFUSED] }), null)
})

// ── R-ENVBLOCK-2 (finding R446-27b): identity, not shape ───────────────────

test('T12 a shape-identical FORGED signal buys nothing at either door', () => {
  const forged = {
    channel: 'host-log',
    text: MOUNT_REFUSED,
    proof: 'verbatim line 0 of 1 captured on the "host-log" channel',
    observedCount: 1,
  }
  const g = gateEnvBlock('ENV_BLOCK', { reason: 'the host refused the pair', envSignal: forged })
  assert.equal(g.verdict, NOT_REACHED, 'a hand-written lookalike must never be honored as ENV_BLOCK')
  assert.match(g.detail.signalRejected, /unbranded/)
  const c = classifyUnwitnessedArm({ step: 'the governed fetch', reachedStep: false, signal: forged })
  assert.equal(c.verdict, NOT_REACHED)
  assert.match(c.detail.signalRejected, /unbranded/)
  // and it cannot launder a product FAIL into an environment excuse either
  assert.equal(classifyUnwitnessedArm({ step: 'the governed fetch', reachedStep: true, signal: forged }).verdict, 'FAIL')
})

test('T13 a JSON round-trip copy of a GENUINE signal is not a signal', () => {
  const sig = envSignal({ channel: 'host-log', text: MOUNT_REFUSED, observed: [MOUNT_REFUSED] })
  const copy = JSON.parse(JSON.stringify(sig))
  assert.deepEqual(Object.keys(copy).sort(), Object.keys(sig).sort(), 'the copy is shape-identical')
  assert.equal(gateEnvBlock('ENV_BLOCK', { reason: 'r', envSignal: copy }).verdict, NOT_REACHED)
  const c = classifyUnwitnessedArm({ step: 'x', reachedStep: false, signal: copy })
  assert.equal(c.verdict, NOT_REACHED)
  assert.match(c.detail.signalRejected, /unbranded/)
})

test('T14 the gate re-derives CAUSALLY: a quote its corpus no longer contains loses ENV_BLOCK', () => {
  const corpus = [MOUNT_REFUSED, 'governed-web-fetch RAN dest=http://127.0.0.1:3199/claim status=200']
  const sig = envSignal({ channel: 'host-log', text: MOUNT_REFUSED, observed: corpus })
  assert.equal(gateEnvBlock('ENV_BLOCK', { reason: 'r', envSignal: sig }).verdict, 'ENV_BLOCK')
  corpus.splice(0, 1, 'the captured window rotated and the line is gone')
  const after = gateEnvBlock('ENV_BLOCK', { reason: 'r', envSignal: sig })
  assert.equal(after.verdict, NOT_REACHED)
  assert.match(after.detail.signalRejected, /no longer a verbatim member/)
})

test('T15 the suite wire (envSignal → classify → add()/gate) honors a genuine wall, nothing else', () => {
  const logLines = ['governed-web-fetch RAN dest=http://127.0.0.1:3199/claim status=200', MOUNT_REFUSED]
  const envWallSignal = envSignal({
    channel: 'host-log',
    text: logLines.find((l) => /a5-plane: (?:mount|placement)-REFUSED|EADDRINUSE|EACCES|EPERM/.test(l)) ?? null,
    observed: logLines,
  })
  const blocked = classifyUnwitnessedArm({ step: 'the governed web_fetch PA step', reachedStep: false, signal: envWallSignal })
  assert.equal(gateEnvBlock(blocked.verdict, blocked.detail).verdict, 'ENV_BLOCK')
  const noWall = envSignal({
    channel: 'host-log',
    text: logLines.find((l) => /EADDRINUSE|EACCES|EPERM/.test(l)) ?? null,
    observed: logLines,
  })
  assert.equal(noWall, null, 'this log carries no environment wall')
  const arm = classifyUnwitnessedArm({ step: 'the governed web_fetch PA step', reachedStep: false, signal: noWall })
  assert.equal(gateEnvBlock(arm.verdict, arm.detail).verdict, NOT_REACHED)
})

test('T17 (R-ENVBLOCK-2 F-2) the channel is bound at MINT: a post-mutated sig.channel buys nothing', () => {
  const sig = envSignal({ channel: 'host-log', text: MOUNT_REFUSED, observed: [MOUNT_REFUSED] })
  sig.channel = 'sandbox-preflight' // the channel that REQUIRES the pre-flight conjunction
  const c = classifyUnwitnessedArm({ step: 'the governed fetch', reachedStep: false, signal: sig })
  assert.equal(c.verdict, 'ENV_BLOCK', 'judged by the bound host-log channel, not by the flipped field')
  assert.equal(c.detail.envSignalRecheck.boundChannel, 'host-log')
  assert.deepEqual(c.detail.envSignalRecheck.channelMismatch, { claimedChannel: 'sandbox-preflight', boundChannel: 'host-log' })
  assert.equal(gateEnvBlock(c.verdict, c.detail).verdict, 'ENV_BLOCK')
  // the other direction: a sandbox signal cannot be re-ruled by renaming either
  const line = 'sandbox backend: unusable (probe: no usable launcher)'
  const sc = envSignal({ channel: 'sandbox-preflight', text: line, observed: [line], preflight: { backend: 'unusable' } })
  sc.channel = 'host-log'
  const d = classifyUnwitnessedArm({ step: 'x', reachedStep: false, signal: sc })
  assert.equal(d.verdict, 'ENV_BLOCK')
  assert.equal(d.detail.envSignalRecheck.boundChannel, 'sandbox-preflight')
  assert.equal(d.detail.envSignalRecheck.channelMismatch.boundChannel, 'sandbox-preflight')
})
