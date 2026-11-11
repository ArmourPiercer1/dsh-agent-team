#!/usr/bin/env node
// Candidate verifier — HOST-FREE negative-path tests (no DSH boot).
//
// A verifier whose negative path is untested is not a verifier. This file pins:
//   1. the committed manifest verifies (CLI exit 0);
//   2. a tampered digest is a MISMATCH (CLI exit 1);
//   3. THE REFUSAL: a cited record that CLAIMS candidate eligibility without a
//      matching candidateCommit/candidateSha is REFUSED (exit 1), never warned;
//   4. a wrong-commit claim, a claim from a DEV-LIVE record, and an unknown
//      recordClass are all REFUSED;
//   5. a matching CANDIDATE-C2 record and a preserved DEV-LIVE record PASS;
//   6. every verdict object has exactly the verifiedFor shape {edge, verdict, detail}.
//
// Run with: node tests/s2-authority/verify-candidate.test.mjs

import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { manifestDigest } from '../../scripts/freeze-candidate.mjs'
import { verifyManifest } from '../../scripts/verify-candidate.mjs'

const ROOT = fileURLToPath(new URL('../..', import.meta.url)).replace(/\/$/, '')
const VERIFIER = join(ROOT, 'scripts/verify-candidate.mjs')
const MANIFEST = join(ROOT, 'dev/engineering/candidates/cand-v0.1.6-1.json')
const CAND = readFileSync(MANIFEST, 'utf8') ? JSON.parse(readFileSync(MANIFEST, 'utf8')) : null
const CAND_SHA = CAND.candidate_commit

const tmp = mkdtempSync(join(tmpdir(), 'verify-candidate-test-'))
let seq = 0
let fails = 0
let ran = 0

const t = (name, fn) => {
  ran += 1
  try { fn(); console.log(`PASS ${name}`) }
  catch (e) { fails += 1; console.log(`FAIL ${name}: ${e.message}`) }
}
const assert = (cond, msg) => { if (!cond) throw new Error(msg) }

const run = (args) => spawnSync(process.execPath, [VERIFIER, ...args], { cwd: ROOT, encoding: 'utf8' })
const clone = () => JSON.parse(JSON.stringify(CAND))

/** Write a run record + a manifest that cites it (digest re-signed, so the ONLY
 *  red left is the evidence edge under test). */
function citing(record, extra = {}) {
  seq += 1
  const recordPath = join(tmp, `record-${seq}.json`)
  writeFileSync(recordPath, `${JSON.stringify(record, null, 2)}\n`)
  const m = clone()
  m.evidence.status = 'CITED'
  m.evidence.run_records = [{ path: recordPath, ...extra }]
  m.content_digest = manifestDigest(m)
  const manifestPath = join(tmp, `manifest-${seq}.json`)
  writeFileSync(manifestPath, `${JSON.stringify(m, null, 2)}\n`)
  return { manifest: m, manifestPath, recordPath }
}

const evidenceEdges = (result) => result.verdicts.filter((v) => v.edge.startsWith('evidence.'))

// ── 1. positive: the committed manifest verifies ────────────────────────────────────
t('committed manifest verifies through the CLI (exit 0, VERIFIED)', () => {
  const r = run(['--manifest', MANIFEST])
  assert(r.status === 0, `expected exit 0, got ${r.status}; stderr=${r.stderr}\n${r.stdout.split('\n').filter((l) => !l.startsWith('PASS')).join('\n')}`)
  assert(/^VERIFIED cand-v0\.1\.6-1 @ /m.test(r.stdout), 'expected a VERIFIED summary line')
  assert(!/^(MISMATCH|MISSING|REFUSED|UNVERIFIABLE)/m.test(r.stdout), 'no non-PASS edge expected on the committed manifest')
})

t('every verdict object has exactly the verifiedFor shape {edge, verdict, detail}', () => {
  const result = verifyManifest({ root: ROOT, manifest: clone() })
  assert(result.verdicts.length > 0, 'expected verdicts')
  for (const v of result.verdicts) {
    assert(JSON.stringify(Object.keys(v).sort()) === JSON.stringify(['detail', 'edge', 'verdict']), `bad verdict shape: ${JSON.stringify(v)}`)
    assert(typeof v.edge === 'string' && v.edge !== '' && typeof v.detail === 'string', `empty edge/detail: ${JSON.stringify(v)}`)
  }
})

// ── 2. a tampered digest is drift, not a warning ──────────────────────────────────
t('a tampered product tree is MISMATCH (CLI exit 1)', () => {
  const m = clone()
  m.product.trees.packages = '0'.repeat(40)
  delete m.content_digest
  m.content_digest = manifestDigest(m)
  const p = join(tmp, 'drifted-manifest.json')
  writeFileSync(p, `${JSON.stringify(m, null, 2)}\n`)
  const r = run(['--manifest', p])
  assert(r.status === 1, `expected exit 1, got ${r.status}`)
  assert(/^MISMATCH\s+product\.trees\.packages:/m.test(r.stdout), `expected MISMATCH on product.trees.packages:\n${r.stdout}`)
})

t('a tampered content_digest is MISMATCH (CLI exit 1)', () => {
  const m = clone()
  m.content_digest = `sha256:${'a'.repeat(64)}`
  const p = join(tmp, 'bad-digest-manifest.json')
  writeFileSync(p, `${JSON.stringify(m, null, 2)}\n`)
  const r = run(['--manifest', p])
  assert(r.status === 1, `expected exit 1, got ${r.status}`)
  assert(/^MISMATCH\s+content_digest:/m.test(r.stdout), 'expected MISMATCH on content_digest')
})

// ── 3. THE REFUSAL PATH ────────────────────────────────────────────────────────────
t('REFUSES a cited record claiming candidate eligibility with NO candidateCommit/candidateSha', () => {
  const { manifest } = citing({
    runId: 'synthetic-refusal-1',
    recordClass: 'CANDIDATE-C2',
    overall: 'PASS',
    candidateClaimEligibility: { eligible: true, code: null, reason: 'synthetic' },
  })
  const result = verifyManifest({ root: ROOT, manifest })
  assert(result.ok === false, 'verifier must NOT be ok on a commitless eligibility claim')
  const [edge] = evidenceEdges(result)
  assert(edge && edge.verdict === 'REFUSED', `expected the evidence edge REFUSED, got ${JSON.stringify(edge)}`)
  assert(/without candidateCommit\/candidateSha/.test(edge.detail), `refusal detail should name the missing commit, got: ${edge.detail}`)
})

t('REFUSES a cited record claiming eligibility for a DIFFERENT commit', () => {
  const { manifest } = citing({
    runId: 'synthetic-refusal-2',
    recordClass: 'CANDIDATE-C2',
    candidateClaimEligibility: { eligible: true },
    candidateCommit: '0'.repeat(40),
  })
  const result = verifyManifest({ root: ROOT, manifest })
  assert(result.ok === false, 'wrong-commit claim must not verify')
  const [edge] = evidenceEdges(result)
  assert(edge.verdict === 'REFUSED' && /bound to one SHA/.test(edge.detail), `expected REFUSED/bound-to-one-SHA, got ${JSON.stringify(edge)}`)
})

t('REFUSES an eligibility claim from a DEV-LIVE record (class rule)', () => {
  const { manifest } = citing({
    runId: 'synthetic-refusal-3',
    recordClass: 'DEV-LIVE',
    candidateClaimEligibility: { eligible: true },
    candidateCommit: CAND_SHA,
  })
  const result = verifyManifest({ root: ROOT, manifest })
  assert(result.ok === false, 'a DEV-LIVE record must never satisfy a candidate claim')
  const [edge] = evidenceEdges(result)
  assert(edge.verdict === 'REFUSED' && /only CANDIDATE-C2 may/.test(edge.detail), `expected the record-class refusal, got ${JSON.stringify(edge)}`)
})

t('REFUSES a record with a recordClass outside the closed set', () => {
  const { manifest } = citing({
    runId: 'synthetic-refusal-4',
    recordClass: 'LOOKS-LEGIT',
    candidateClaimEligibility: { eligible: false },
  })
  const result = verifyManifest({ root: ROOT, manifest })
  assert(result.ok === false, 'unknown class must not pass')
  const [edge] = evidenceEdges(result)
  assert(edge.verdict === 'REFUSED' && /outside the closed set/.test(edge.detail), `expected closed-set refusal, got ${JSON.stringify(edge)}`)
})

t('REFUSES a manifest record marked candidate_bound when the record carries no commit', () => {
  const { manifest } = citing({ runId: 'synthetic-refusal-5', recordClass: 'DEV-LIVE', candidateClaimEligibility: { eligible: false } }, { candidate_bound: true })
  const result = verifyManifest({ root: ROOT, manifest })
  const [edge] = evidenceEdges(result)
  assert(edge.verdict === 'REFUSED' && /candidate_bound/.test(edge.detail), `expected candidate_bound refusal, got ${JSON.stringify(edge)}`)
})

// ── 4. legitimate evidence passes ──────────────────────────────────────────────────
t('PASSES a CANDIDATE-C2 record with a matching candidateCommit', () => {
  const { manifest } = citing({
    runId: 'synthetic-c2-ok',
    recordClass: 'CANDIDATE-C2',
    candidateClaimEligibility: { eligible: true, code: null },
    candidateCommit: CAND_SHA,
    candidateSha: CAND_SHA,
  }, { candidate_bound: true })
  const result = verifyManifest({ root: ROOT, manifest })
  const [edge] = evidenceEdges(result)
  assert(edge.verdict === 'PASS', `expected PASS, got ${JSON.stringify(edge)}`)
  assert(result.ok === true, `all other edges should stay green; reds=${JSON.stringify(result.verdicts.filter((v) => v.verdict !== 'PASS'))}`)
})

t('PASSES a preserved DEV-LIVE record that claims no candidate eligibility', () => {
  const { manifest } = citing({
    runId: 'synthetic-devlive',
    recordClass: 'DEV-LIVE',
    candidateClaimEligibility: { eligible: false, code: 'DEV_LIVE_EVIDENCE_NOT_CANDIDATE' },
  })
  const result = verifyManifest({ root: ROOT, manifest })
  const [edge] = evidenceEdges(result)
  assert(edge.verdict === 'PASS' && /preserved reference only/.test(edge.detail), `expected preserved PASS, got ${JSON.stringify(edge)}`)
})

// ── 5. the CLI --record path enforces the same refusal ─────────────────────────────
t('CLI --record REFUSES a commitless eligibility claim (exit 1)', () => {
  const { recordPath } = (() => {
    const p = join(tmp, 'cli-record.json')
    writeFileSync(p, JSON.stringify({ runId: 'cli-refusal', recordClass: 'CANDIDATE-C2', candidateClaimEligibility: { eligible: true } }))
    return { recordPath: p }
  })()
  const r = run(['--manifest', MANIFEST, '--record', recordPath])
  assert(r.status === 1, `expected exit 1, got ${r.status}`)
  assert(/^REFUSED\s+evidence\./m.test(r.stdout), `expected a REFUSED evidence edge:\n${r.stdout}`)
})

t('CLI --json reports the refusal machine-readably', () => {
  const p = join(tmp, 'cli-record-json.json')
  writeFileSync(p, JSON.stringify({ runId: 'cli-refusal-json', recordClass: 'CANDIDATE-C2', candidateClaimEligibility: { eligible: true } }))
  const r = run(['--manifest', MANIFEST, '--record', p, '--json'])
  assert(r.status === 1, `expected exit 1, got ${r.status}`)
  const parsed = JSON.parse(r.stdout)
  assert(parsed.ok === false, 'json.ok must be false')
  assert(parsed.verdicts.some((v) => v.verdict === 'REFUSED'), 'json must carry a REFUSED verdict')
})

// ── 6. evidence absence is disclosed, not silently green ───────────────────────────
t('a manifest citing no run records reports the evidence edge as vacuous (PASS with disclosure)', () => {
  const result = verifyManifest({ root: ROOT, manifest: clone() })
  const edge = result.verdicts.find((v) => v.edge === 'evidence.records')
  assert(edge && edge.verdict === 'PASS' && /vacuously/.test(edge.detail), `expected the vacuous-evidence disclosure, got ${JSON.stringify(edge)}`)
})

rmSync(tmp, { recursive: true, force: true })
console.log(fails === 0 ? `ALL GREEN (${ran} cases)` : `RED (${fails}/${ran} failing)`)
process.exit(fails === 0 ? 0 : 1)
