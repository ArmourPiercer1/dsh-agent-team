#!/usr/bin/env node
/**
 * version-gate-verify.test.mjs — NEGATIVE CONTROLS for the version-gate verifier.
 *
 * WHY THIS FILE EXISTS. The verifier is the freeze check: a vacuous pass here would
 * let a version declare PRODUCT-PROVEN on nothing. Every control below plants ONE
 * defect and requires the verifier to refuse with its OWN named code. The positive
 * control is a receipt produced by the real writer from a verdict shaped exactly
 * like `scripts/candidate-acceptance-gate.mjs`'s own output (same schema, same
 * `perHost[].drivers[].judges[]` records, the one enumerated known-refuted id).
 *
 * COLLECTED, NOT ORPHANED. The suite is declared by the `version-gate-verify-unit`
 * dispatch leg in `dev/ci/eb3-ci-manifest.json` (knownNonRequired) and executed by
 * `.github/workflows/candidate-acceptance.yml`; `test-catalog` therefore classifies
 * it DISCOVERED_AND_COLLECTED instead of UNCOLLECTED.
 *
 * Temp files only: the controls never write under the repository and never touch a
 * committed receipt (a receipt for an unfrozen SHA must not be mistakable for a
 * freeze).
 */
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, relative, resolve } from 'node:path'
import { after, before, describe, it } from 'node:test'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import { KNOWN_REFUTED_IDS } from './candidate-acceptance-known-refuted.mjs'
import { GATE_VERDICT_SCHEMA, RECEIPT_KIND, RECEIPT_SCHEMA_VERSION, receiptFromVerdict, writeReceipt } from './version-gate-receipt.mjs'
import { VERIFY_CODES, validateReceiptSchema, verifyValues, verifyVersionGate } from './version-gate-verify.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const HEAD = 'a'.repeat(40)
const OTHER = 'b'.repeat(40)
const REFUTED_ID = 'd4:ask-execute-process'

/** A verdict with the gate's exact shape: 2 hosts x (1 PROVEN + 1 enumerated REFUTED). */
function verdictFixture({ head = HEAD, verdict = 'pass', refuted = [REFUTED_ID], envLimited = 0 } = {}) {
  const perHost = ['legacy', 'next'].map((host) => ({
    host,
    verdict,
    drivers: [
      {
        id: 'd4',
        verdict,
        judges: [
          { id: 'd4:routed-wake', verdict: 'PROVEN' },
          ...refuted.map((id) => ({ id, verdict: 'REFUTED' })),
        ],
      },
    ],
    counts: { judges: 1 + refuted.length, proven: 1, knownRefuted: refuted.length, envLimited },
  }))
  const totals = {
    judges: perHost.reduce((n, h) => n + h.counts.judges, 0),
    proven: perHost.reduce((n, h) => n + h.counts.proven, 0),
    knownRefuted: perHost.reduce((n, h) => n + h.counts.knownRefuted, 0),
    envLimited: perHost.reduce((n, h) => n + h.counts.envLimited, 0),
  }
  return {
    schema: GATE_VERDICT_SCHEMA,
    at: '2026-11-25T00:00:00.000Z',
    head,
    branch: 'vnext/a1-cut',
    hosts: ['legacy', 'next'],
    verdict,
    totals,
    perHost,
  }
}

let dir
let seq = 0
function paths() {
  seq += 1
  const base = join(dir, `case-${String(seq)}`)
  mkdirSync(base, { recursive: true })
  return { base, verdict: join(base, 'verdict.json'), receipt: join(base, 'version-gate-receipt.json') }
}

function publish({ head = HEAD, verdict = verdictFixture({ head }) } = {}) {
  const p = paths()
  writeFileSync(p.verdict, `${JSON.stringify(verdict, null, 2)}\n`)
  const written = writeReceipt({ verdictPath: p.verdict, requestedHead: head })
  assert.equal(written.ok, true, `the writer must publish the positive control: ${JSON.stringify(written)}`)
  return { ...p, receipt: written.path }
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

function verify(receiptPath, head = HEAD) {
  return verifyVersionGate({ receiptPath, head, root: ROOT })
}

function assertRefusal(result, code) {
  assert.equal(result.ok, false, `expected a refusal, got ${JSON.stringify(result)}`)
  assert.equal(result.code, code, `expected ${code}, got ${result.code}: ${result.detail}`)
  assert.equal(typeof result.detail, 'string')
  assert.ok(result.detail.length > 0, 'a refusal must carry a detail string')
}

before(() => { dir = mkdtempSync(join(tmpdir(), 'version-gate-')) })
after(() => { if (dir !== undefined) rmSync(dir, { recursive: true, force: true }) })

describe('version-gate verifier — positive control', () => {

  it('accepts a receipt the real writer published from a green verdict', () => {
    const p = publish()
    const result = verify(p.receipt)
    assert.equal(result.ok, true, JSON.stringify(result))
    assert.equal(result.summary.head, HEAD)
    assert.deepEqual(result.summary.judges, { proven: 2, knownRefuted: 2, envLimited: 0 })
  })

  it('binds the verdict file by path + sha256 digest, not by a copy', () => {
    const p = publish()
    const receipt = readJson(p.receipt)
    // A path inside the checkout is stored repo-relative; a temp path (this control)
    // stays absolute. Either way it must resolve to the exact file that was digested.
    const bound = receipt.verdictFile.path
    assert.equal(resolve(ROOT, bound), resolve(p.verdict))
    assert.ok(bound === p.verdict || bound === relative(ROOT, p.verdict).split('\\').join('/'))
    const digest = `sha256:${createHash('sha256').update(readFileSync(p.verdict)).digest('hex')}`
    assert.equal(receipt.verdictFile.digest, digest)
  })

  it('the writer refuses to publish a receipt for a failed verdict', () => {
    const p = paths()
    writeFileSync(p.verdict, `${JSON.stringify(verdictFixture({ verdict: 'fail' }), null, 2)}\n`)
    const written = writeReceipt({ verdictPath: p.verdict })
    assert.equal(written.ok, false)
    assert.equal(written.code, 'VERSION_GATE_VERDICT_NOT_PASS')
  })
})

describe('version-gate verifier — negative controls (each names its own code)', () => {
  it('NC-1 missing receipt', () => {
    assertRefusal(verify(join(dir, 'does-not-exist', 'version-gate-receipt.json')), VERIFY_CODES.RECEIPT_MISSING)
  })

  it('NC-2 wrong head (the receipt speaks only for its own frozen SHA)', () => {
    const p = publish()
    assertRefusal(verify(p.receipt, OTHER), VERIFY_CODES.HEAD_MISMATCH)
  })

  it('NC-3 receipt says verdict != pass (tampered after publication)', () => {
    const p = publish()
    const receipt = { ...readJson(p.receipt), verdict: 'fail' }
    writeFileSync(p.receipt, `${JSON.stringify(receipt, null, 2)}\n`)
    assertRefusal(verify(p.receipt), VERIFY_CODES.VERDICT_NOT_PASS)
  })

  it('NC-4 an unexpected known-refuted id may not travel with the receipt', () => {
    const p = publish()
    const receipt = readJson(p.receipt)
    receipt.knownRefutedIds = [...receipt.knownRefutedIds, 'd4:routed-wake']
    writeFileSync(p.receipt, `${JSON.stringify(receipt, null, 2)}\n`)
    assertRefusal(verify(p.receipt), VERIFY_CODES.KNOWN_REFUTED_UNEXPECTED)
  })

  it('NC-4b a verdict that refutes a judge outside the enumeration is refused', () => {
    const p = publish()
    const verdict = readJson(p.verdict)
    verdict.perHost[0].drivers[0].judges.push({ id: 'd4:routed-wake', verdict: 'REFUTED' })
    writeFileSync(p.verdict, `${JSON.stringify(verdict, null, 2)}\n`)
    // The receipt now binds stale bytes: the digest check fires first, by design.
    assertRefusal(verify(p.receipt), VERIFY_CODES.VERDICT_DIGEST_MISMATCH)

    // Re-publishing from the tampered verdict is refused by the writer (the set is
    // derived from the verdict, and the enumeration is the gate's own literal map).
    const written = writeReceipt({ verdictPath: p.verdict })
    assert.equal(written.ok, true, 'the writer publishes what the verdict says; the VERIFIER is the enumeration gate')
    assertRefusal(verify(written.path), VERIFY_CODES.KNOWN_REFUTED_UNEXPECTED)
  })

  it('NC-5 schema drift: an unknown key', () => {
    const p = publish()
    const receipt = { ...readJson(p.receipt), extraField: true }
    writeFileSync(p.receipt, `${JSON.stringify(receipt, null, 2)}\n`)
    assertRefusal(verify(p.receipt), VERIFY_CODES.SCHEMA_DRIFT)
  })

  it('NC-5b schema drift: a missing key', () => {
    const p = publish()
    const receipt = readJson(p.receipt)
    delete receipt.gateVersion
    writeFileSync(p.receipt, `${JSON.stringify(receipt, null, 2)}\n`)
    assertRefusal(verify(p.receipt), VERIFY_CODES.SCHEMA_DRIFT)
  })

  it('NC-5c schema drift: a wrong type and a non-ISO time', () => {
    const wrongType = publish()
    writeFileSync(wrongType.receipt, `${JSON.stringify({ ...readJson(wrongType.receipt), judges: { proven: '2', knownRefuted: 2, envLimited: 0 } }, null, 2)}\n`)
    assertRefusal(verify(wrongType.receipt), VERIFY_CODES.SCHEMA_DRIFT)

    const badTime = publish()
    writeFileSync(badTime.receipt, `${JSON.stringify({ ...readJson(badTime.receipt), startedAt: 'yesterday' }, null, 2)}\n`)
    assertRefusal(verify(badTime.receipt), VERIFY_CODES.TIME_INVALID)
  })

  it('NC-5d an unsupported schemaVersion is not silently accepted', () => {
    const p = publish()
    const receipt = { ...readJson(p.receipt), schemaVersion: 2 }
    writeFileSync(p.receipt, `${JSON.stringify(receipt, null, 2)}\n`)
    assertRefusal(verify(p.receipt), VERIFY_CODES.SCHEMA_VERSION_UNSUPPORTED)
  })

  it('NC-6 tampered verdict bytes (digest mismatch)', () => {
    const p = publish()
    const verdict = readJson(p.verdict)
    verdict.head = HEAD
    verdict.totals.proven += 1
    writeFileSync(p.verdict, `${JSON.stringify(verdict, null, 2)}\n`)
    assertRefusal(verify(p.receipt), VERIFY_CODES.VERDICT_DIGEST_MISMATCH)
  })

  it('NC-7 the referenced verdict file is gone', () => {
    const p = publish()
    rmSync(p.verdict)
    assertRefusal(verify(p.receipt), VERIFY_CODES.VERDICT_FILE_MISSING)
  })

  it('NC-8 envLimited > 0 is never a version-gate pass', () => {
    const p = publish()
    const receipt = readJson(p.receipt)
    receipt.judges.envLimited = 1
    writeFileSync(p.receipt, `${JSON.stringify(receipt, null, 2)}\n`)
    assertRefusal(verify(p.receipt), VERIFY_CODES.ENV_LIMITED_NONZERO)
  })

  it('NC-9 an enumerated known-refuted id may not be dropped from the set', () => {
    const p = publish()
    const receipt = { ...readJson(p.receipt), knownRefutedIds: [] }
    writeFileSync(p.receipt, `${JSON.stringify(receipt, null, 2)}\n`)
    assertRefusal(verify(p.receipt), VERIFY_CODES.KNOWN_REFUTED_MISSING)
  })

  it('NC-10 a receipt whose head is not a SHA is refused before any comparison', () => {
    const p = publish()
    const receipt = { ...readJson(p.receipt), head: 'HEAD' }
    writeFileSync(p.receipt, `${JSON.stringify(receipt, null, 2)}\n`)
    assertRefusal(verify(p.receipt), VERIFY_CODES.HEAD_INVALID)
  })

  it('NC-11 the receipt judges must partition (judges = proven + knownRefuted + envLimited)', () => {
    const p = publish()
    const receipt = { ...readJson(p.receipt), judges: { proven: 99, knownRefuted: 2, envLimited: 0 } }
    writeFileSync(p.receipt, `${JSON.stringify(receipt, null, 2)}\n`)
    // The receipt's own judges disagree with the digest-bound verdict.
    assertRefusal(verify(p.receipt), VERIFY_CODES.JUDGES_MISMATCH)
  })
})

describe('version-gate verifier — pure surface', () => {
  it('the schema validator rejects a non-object and a null', () => {
    assert.equal(validateReceiptSchema(null).code, VERIFY_CODES.SCHEMA_DRIFT)
    assert.equal(validateReceiptSchema([]).code, VERIFY_CODES.SCHEMA_DRIFT)
  })

  it('the receipt schema constant is the one the writer emits', () => {
    const p = publish()
    const receipt = readJson(p.receipt)
    assert.equal(receipt.schemaVersion, RECEIPT_SCHEMA_VERSION)
    assert.equal(receipt.kind, RECEIPT_KIND)
    assert.deepEqual(receipt.knownRefutedIds, KNOWN_REFUTED_IDS)
  })

  it('verifyValues is total: no receipt/verdict pair throws', () => {
    const p = publish()
    const receipt = readJson(p.receipt)
    const verdict = readJson(p.verdict)
    assert.equal(verifyValues({ receipt, verdict, head: HEAD }).ok, true)
    assert.equal(verifyValues({ receipt, verdict, head: 'not-a-sha' }).code, VERIFY_CODES.HEAD_INVALID)
    assert.equal(verifyValues({ receipt: {}, verdict, head: HEAD }).code, VERIFY_CODES.SCHEMA_DRIFT)
  })

  it('a receipt built by the pure builder is schema-valid', () => {
    const p = paths()
    writeFileSync(p.verdict, `${JSON.stringify(verdictFixture(), null, 2)}\n`)
    const built = receiptFromVerdict({ verdict: verdictFixture(), verdictPath: p.verdict })
    assert.equal(built.ok, true)
    assert.equal(validateReceiptSchema(built.receipt).ok, true)
  })
})

// ── ROUND 127: the graded head must be the TRIGGERING commit, for workflow_dispatch too.
// These controls bind the rule the workflow now applies (`scripts/version-gate-head-binding.mjs`):
// a dispatch at commit A may not certify commit B, and the refusal is typed, not a generic error.
describe('version-gate head binding (round 127)', () => {
  it('binds only when the requested head EQUALS github.sha', async () => {
    const { bindVersionGateHead, VERSION_GATE_SHA_BINDING_REFUSED, VERSION_GATE_HEAD_NOT_SHA, FROZEN_SHA_SUPPORTED_PATH } = await import('./version-gate-head-binding.mjs')
    const same = bindVersionGateHead({ eventName: 'workflow_dispatch', requestedSha: HEAD, githubSha: HEAD })
    assert.deepEqual(same, { ok: true, sha: HEAD })
    // A push event at the same SHA is the documented frozen-SHA path: same binding, different trigger.
    assert.deepEqual(bindVersionGateHead({ eventName: 'push', requestedSha: HEAD, githubSha: HEAD }), { ok: true, sha: HEAD })

    const drift = bindVersionGateHead({ eventName: 'workflow_dispatch', requestedSha: OTHER, githubSha: HEAD })
    assert.equal(drift.ok, false)
    assert.equal(drift.code, VERSION_GATE_SHA_BINDING_REFUSED, 'a dispatch naming another commit is the binding refusal, not a format error')
    assert.match(drift.message, /github\.sha/u)
    assert.ok(drift.message.includes(FROZEN_SHA_SUPPORTED_PATH), 'the refusal must name the supported frozen-SHA path, not just say no')

    const bad = bindVersionGateHead({ eventName: 'workflow_dispatch', requestedSha: 'abc', githubSha: HEAD })
    assert.equal(bad.code, VERSION_GATE_HEAD_NOT_SHA)
    assert.equal(bindVersionGateHead({ eventName: 'push', requestedSha: HEAD, githubSha: '' }).code, VERSION_GATE_HEAD_NOT_SHA)
  })

  it('the real workflow executes the binding script, and the shape check reds when it stops', async () => {
    const { checkVersionGateBinding, HEAD_BINDING_SCRIPT } = await import('./version-gate-head-binding.mjs')
    const { readFileSync } = await import('node:fs')
    const workflow = readFileSync(resolve(ROOT, '.github/workflows/candidate-acceptance.yml'), 'utf8')
    assert.ok(workflow.includes(HEAD_BINDING_SCRIPT), 'the version-gate workflow must execute the binding script, not re-implement the rule in prose')
    assert.deepEqual(checkVersionGateBinding({ text: workflow }), [])
    assert.deepEqual(checkVersionGateBinding({}), [{ code: 'CI_VERSION_GATE_SHA_BINDING_MISSING', detail: checkVersionGateBinding({})[0].detail }])
  })
})
