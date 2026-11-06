/**
 * a5sf-pd15-face-bound-proof.test.mjs — PD-15: a network-enforcement proof is
 * bound to the FACE that consumes it, not merely to the realm that produced it.
 *
 * THE HOLE (#645's finding). BL-42 gave the confined subprocess lane an honest
 * `enforced` answer: a per-child network namespace, measured by a control/deny
 * pair through a loopback listener. The confined `web` face admitted a
 * `network: deny` call on ANY backend whose capability row said `enforced`
 * (with a mechanism and an evidence reference). Nothing tied that evidence to
 * the face; a composition that handed the web transport the SUBPROCESS lane's
 * realm-bound proof would have admitted a deny `web_fetch` into ordinary host
 * egress, because the web transport runs IN-PROCESS and never enters the
 * launcher's namespace. No in-tree composition did that, so it was latent.
 *
 * WHAT THIS FILE MEASURES (host-free, no boot, no socket):
 *
 *   P0  the defect pin: a web provider handed the subprocess face's proof is
 *       ADMITTED. Green before the fix, red after it (gated by
 *       `A5SF_PD15_PIN=1` so a committed red test cannot rot the normal gate).
 *   D1  the same provider is refused with the typed
 *       `NETWORK_PROOF_FACE_MISMATCH` after the fix, before any provider call.
 *   D2  an `enforced` ROW with no face-bound proof is refused as
 *       `NETWORK_UNCONFINED_REALM`: a level is not a proof on this face either.
 *   A1  a correctly face-bound `web` proof is ADMITTED (the fix is not
 *       "refuse everything").
 *   A2  a correctly face-bound `subprocess` proof still admits on the
 *       subprocess face through the SAME evaluator.
 *   A3  a `subprocess` proof with no measured namespace identity is refused.
 *   T1  tampering the `face` field (or removing it, or naming an unknown face)
 *       reds the admission instead of defaulting to the consumer.
 *
 * WHAT IT DOES NOT CLAIM. A `web`-face proof is a SERVICE-LEVEL statement: the
 * in-process transport has no OS boundary, and no proof shape gives it one. The
 * BL-42 end-to-end lane (real launcher, real child, real netns) is the separate
 * negative control for "the subprocess face still works"; it lives in
 * `a5sf-bl42-netdeny.test.mjs` and is run in the same gate.
 *
 * Run: node --test tests/world-factory/a5sf-pd15-face-bound-proof.test.mjs
 * Pin: A5SF_PD15_PIN=1 node --test tests/world-factory/a5sf-pd15-face-bound-proof.test.mjs
 */
import assert from 'node:assert/strict'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import test from 'node:test'

import {
  DECLARED_URL,
  WEB_IDENTITY,
  effectiveOf,
  fakeWebBoundary,
  loadWebSeams,
  makeFace,
  refusalCode,
} from './lib/a5sf-web-arms.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..', '..')
const PIN = process.env['A5SF_PD15_PIN'] === '1'

const seams = await loadWebSeams(REPO)
const network = await import(pathToFileURL(join(REPO, 'packages', 'runtime', 'sandbox-provider', 'network.ts')).href)

/** The subprocess lane's own proof: a measured netns pair, face named. */
function subprocessProof() {
  return Object.freeze({
    face: 'subprocess',
    mechanism: network.NETNS_MECHANISM,
    evidence: 'evidence://a5p4/probe/realm-subprocess/stamp',
    netNsInode: 4026532407,
    hostNetNsInode: 4026531833,
  })
}

/**
 * The web face's own proof. There is no such measurement in this tree: the web
 * transport is in-process, so this fixture is deliberately a SERVICE-LEVEL
 * statement with no namespace identity, used only to prove the guard admits a
 * proof minted for the face that is asking.
 */
function webFaceProof(overrides = {}) {
  return Object.freeze({
    face: 'web',
    mechanism: 'service-level web transport (in-process; no OS boundary)',
    evidence: 'evidence://a5p4/probe/realm-web/service-level',
    netNsInode: null,
    hostNetNsInode: null,
    ...overrides,
  })
}

/** Run one deny fetch through a fake boundary and collect the refusal. */
async function denyFetch({ probeLevel = 'enforced', networkProof = null } = {}) {
  const effective = effectiveOf(seams, { network: 'deny' })
  const boundary = fakeWebBoundary({ probeLevel, networkProof })
  const { face, facts } = makeFace(seams, { effective, boundary })
  let error = null
  try {
    await face.fetch({ url: DECLARED_URL })
  } catch (caught) {
    error = caught
  }
  return { error, facts, boundary }
}

/** Assert the refusal happened BEFORE the provider boundary was entered. */
function assertNoEgress(boundary) {
  assert.equal(boundary.fetches.length, 0, 'zero provider fetches')
  assert.equal(boundary.dnsLookups, 0, 'zero DNS lookups')
  assert.equal(boundary.connects, 0, 'zero connects')
  assert.equal(boundary.proxyLookups, 0, 'zero proxy resolutions')
}

// ---------------------------------------------------------------------------
// P0 — the defect pin. Asserts the PRE-FIX behaviour verbatim: this is the
// hole. Gated so the normal gate stays green; the flip is recorded in
// `dev/agent-workflow/evidence/a5sf-pd15-face-bound-proof/pin-before.log` /
// `pin-after.log`.
// ---------------------------------------------------------------------------

test('P0 PD-15 defect pin (PRE-FIX): a web provider handed the SUBPROCESS face\'s proof is admitted', { skip: !PIN }, async () => {
  const { error, boundary } = await denyFetch({ probeLevel: 'enforced', networkProof: subprocessProof() })
  assert.equal(error, null, 'PRE-FIX: the deny web call was admitted on another face\'s proof')
  assert.equal(boundary.fetches.length, 1, 'PRE-FIX: the admitted call reached ordinary host egress')
})

// ---------------------------------------------------------------------------
// D1/D2 — the fix: face-bound proof required, and a mismatch is typed.
// ---------------------------------------------------------------------------

test('D1 FACE-MISMATCH: the subprocess face\'s proof does NOT admit a deny web fetch; typed NETWORK_PROOF_FACE_MISMATCH before any provider call', async () => {
  const { error, facts, boundary } = await denyFetch({ probeLevel: 'enforced', networkProof: subprocessProof() })
  assert.ok(error !== null, 'the deny web call must be refused')
  assert.equal(refusalCode(error), 'NETWORK_PROOF_FACE_MISMATCH')
  assert.equal(error.memberIdentity, WEB_IDENTITY.memberInstanceId)
  assert.equal(error.method, 'web:fetch')
  assert.equal(error.target, DECLARED_URL)
  assertNoEgress(boundary)
  assert.equal(facts.length, 1, 'one guard fact on the same transport')
  assert.equal(facts[0].decision, 'deny')
  assert.equal(facts[0].decidedBy, 'NETWORK_PROOF_FACE_MISMATCH')
})

test('D2 LEVEL-ALONE: an `enforced` row with no face-bound proof is refused as NETWORK_UNCONFINED_REALM (a level is not a proof)', async () => {
  const { error, facts, boundary } = await denyFetch({ probeLevel: 'enforced' })
  assert.ok(error !== null, 'the deny web call must be refused')
  assert.equal(refusalCode(error), 'NETWORK_UNCONFINED_REALM')
  assertNoEgress(boundary)
  assert.equal(facts[0].decidedBy, 'NETWORK_UNCONFINED_REALM')
})

// ---------------------------------------------------------------------------
// A1/A2 — the negative controls that prove the fix is not "refuse everything".
// ---------------------------------------------------------------------------

test('A1 WEB-FACE-PROOF-ADMITS: a proof minted for the web face admits the call on that face (service-level statement)', async () => {
  const { error, facts, boundary } = await denyFetch({ probeLevel: 'enforced', networkProof: webFaceProof() })
  assert.equal(error, null)
  assert.equal(boundary.fetches.length, 1, 'exactly one provider fetch')
  assert.equal(boundary.dnsLookups, 1)
  assert.equal(boundary.connects, 1)
  assert.equal(facts.length, 1)
  assert.equal(facts[0].decision, 'allow')
})

test('A2 SUBPROCESS-FACE-PROOF-STILL-ADMITS: the same evaluator admits a correctly bound subprocess proof on the subprocess face', async () => {
  const ok = network.evaluateNetworkRequirement('deny', 'realm-subprocess', subprocessProof(), 'subprocess')
  assert.equal(ok.ok, true, JSON.stringify(ok))
  // and the web proof does not admit on the subprocess face either
  const cross = network.evaluateNetworkRequirement('deny', 'realm-subprocess', webFaceProof(), 'subprocess')
  assert.equal(cross.ok, false)
  assert.equal(cross.error.details?.refusal, network.NETWORK_PROOF_FACE_MISMATCH)
})

test('A3 SUBPROCESS-PROOF-NEEDS-NAMESPACE: a subprocess proof with no measured namespace identity is refused', async () => {
  const incomplete = network.evaluateNetworkRequirement('deny', 'realm-subprocess',
    { face: 'subprocess', mechanism: network.NETNS_MECHANISM, evidence: 'evidence://x/1', netNsInode: null, hostNetNsInode: null },
    'subprocess')
  assert.equal(incomplete.ok, false)
  assert.equal(incomplete.error.code, 'IO_POLICY_UNSUPPORTED')
  const sameInode = network.evaluateNetworkRequirement('deny', 'realm-subprocess',
    { face: 'subprocess', mechanism: network.NETNS_MECHANISM, evidence: 'evidence://x/1', netNsInode: 7, hostNetNsInode: 7 },
    'subprocess')
  assert.equal(sameInode.ok, false, 'a proof that the deny child shares the host namespace is not a proof')
})

// ---------------------------------------------------------------------------
// T1 — tampering, and the "no face is refused, not defaulted" law.
// ---------------------------------------------------------------------------

test('T1 TAMPER: changing or removing the face field reds the admission; no face is NOT defaulted to the consumer', async () => {
  // (a) a web proof with its face tampered to `subprocess` no longer admits on
  // the face it was minted for; the face field is load-bearing, not decorative.
  const tampered = network.evaluateNetworkRequirement('deny', 'realm-web',
    { ...webFaceProof(), face: 'subprocess' }, 'web')
  assert.equal(tampered.ok, false, 'a tampered face must not admit')
  assert.equal(tampered.error.details?.refusal, network.NETWORK_PROOF_FACE_MISMATCH)

  // (b) the web guard sees a proof whose face was tampered to `subprocess`
  const guardTampered = await denyFetch({ probeLevel: 'enforced', networkProof: { ...webFaceProof(), face: 'subprocess' } })
  assert.equal(refusalCode(guardTampered.error), 'NETWORK_PROOF_FACE_MISMATCH')
  assertNoEgress(guardTampered.boundary)

  // (c) a proof with NO face is refused, not defaulted
  const base = subprocessProof()
  const noFace = {
    mechanism: base.mechanism,
    evidence: base.evidence,
    netNsInode: base.netNsInode,
    hostNetNsInode: base.hostNetNsInode,
  }
  const unnamed = network.evaluateNetworkRequirement('deny', 'realm-web', noFace, 'web')
  assert.equal(unnamed.ok, false, 'an unnamed proof must not be defaulted to the consumer face')
  assert.equal(unnamed.error.details?.refusal, network.NETWORK_PROOF_FACE_MISMATCH)

  // (d) an unknown face string is outside the closed set
  const unknown = network.evaluateNetworkRequirement('deny', 'realm-web',
    { ...webFaceProof(), face: 'terminals' }, 'web')
  assert.equal(unknown.ok, false)

  // (e) a consumer that cannot name its own face cannot have a proof checked
  const noConsumer = network.evaluateNetworkRequirement('deny', 'realm-web', webFaceProof())
  assert.equal(noConsumer.ok, false)
  assert.equal(noConsumer.error.details?.refusal, network.NETWORK_PROOF_FACE_MISMATCH)
})
