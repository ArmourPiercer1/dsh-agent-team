#!/usr/bin/env node
// Candidate freeze generator — HOST-FREE regression tests (no DSH boot).
//
// What is pinned here:
//   1. the F0 manifest digest convention still reproduces the hand-written
//      predecessor's digest (so the generator did not quietly invent a new law);
//   2. `--check` is CLEAN against the committed manifest (the reviewer entry point);
//   3. `--check` DETECTS a tampered tree/blob digest and exits 1 (not 2 — drift is
//      a finding, not an environment error);
//   4. `--check` DETECTS a tampered content_digest;
//   5. the leaf differ reports additions and removals too, so an emptied map or a
//      new field cannot hide from the diff;
//   6. `evidence.record_root` is DERIVED from `--candidate-id` (the defect two
//      independent C2 adjudicators filed as FAIL: the literal
//      `…/evidence/candidate-v0.1.6-1` was emitted for every candidate from -2 on),
//      with a negative control that no `candidate-v0.1.6-1` string can appear in a
//      manifest frozen under another id.
//
// Run with: node tests/s2-authority/freeze-candidate.test.mjs

import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { manifestDigest, diffManifests, recordRootFor, EVIDENCE_ROOT_REL } from '../../scripts/freeze-candidate.mjs'

const ROOT = fileURLToPath(new URL('../..', import.meta.url)).replace(/\/$/, '')
const GENERATOR = join(ROOT, 'scripts/freeze-candidate.mjs')
const MANIFEST_REL = 'dev/engineering/candidates/cand-v0.1.6-1.json'
const MANIFEST = join(ROOT, MANIFEST_REL)
const PREDECESSOR = join(ROOT, 'dev/engineering/candidates/cand-a5sf-fs-search-1.json')

const tmp = mkdtempSync(join(tmpdir(), 'freeze-candidate-test-'))
let fails = 0
let ran = 0

const t = (name, fn) => {
  ran += 1
  try { fn(); console.log(`PASS ${name}`) }
  catch (e) { fails += 1; console.log(`FAIL ${name}: ${e.message}`) }
}
const assert = (cond, msg) => { if (!cond) throw new Error(msg) }

const run = (args) => spawnSync(process.execPath, [GENERATOR, ...args], { cwd: ROOT, encoding: 'utf8' })
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'))

// ── 1. the digest convention is unchanged ───────────────────────────────────────────
t('manifestDigest reproduces the hand-written predecessor manifest digest (F0 unchanged)', () => {
  const old = readJson(PREDECESSOR)
  assert(old.content_digest === manifestDigest(old), `predecessor digest changed: ${manifestDigest(old)} != ${old.content_digest}`)
})

// ── 2. --check clean against the committed manifest ─────────────────────────────────
t('--check is CLEAN against the committed cand-v0.1.6-1 manifest (exit 0)', () => {
  const r = run(['--check', '--manifest', MANIFEST])
  assert(r.status === 0, `expected exit 0, got ${r.status}; stderr=${r.stderr}\n${r.stdout.split('\n').slice(-6).join('\n')}`)
  assert(/^CLEAN /m.test(r.stdout), 'expected a CLEAN summary line')
  assert(/^DIGEST .* OK$/m.test(r.stdout), 'expected the content_digest line to verify')
  assert(!/^DRIFT /m.test(r.stdout), 'no DRIFT lines expected on a clean check')
})

// ── 3. a tampered tree digest is DETECTED ──────────────────────────────────────────
t('--check DETECTS a tampered product.trees.packages digest (exit 1, DRIFT names the field)', () => {
  const m = readJson(MANIFEST)
  m.product.trees.packages = '0'.repeat(40)
  const p = join(tmp, 'tampered-tree.json')
  writeFileSync(p, `${JSON.stringify(m, null, 2)}\n`)
  const r = run(['--check', '--manifest', p])
  assert(r.status === 1, `expected exit 1 (drift), got ${r.status}; stderr=${r.stderr}`)
  assert(/^DRIFT product\.trees\.packages /m.test(r.stdout), `expected DRIFT product.trees.packages; got:\n${r.stdout.split('\n').filter((l) => !l.startsWith('OK')).join('\n')}`)
  assert(/^DRIFT /m.test(r.stdout) && !/^CLEAN /m.test(r.stdout), 'a tampered manifest must never print CLEAN')
})

t('--check DETECTS a tampered product.judges blob (exit 1)', () => {
  const m = readJson(MANIFEST)
  const firstJudge = Object.keys(m.product.judges)[0]
  m.product.judges[firstJudge] = '1'.repeat(40)
  const p = join(tmp, 'tampered-judge.json')
  writeFileSync(p, `${JSON.stringify(m, null, 2)}\n`)
  const r = run(['--check', '--manifest', p])
  assert(r.status === 1, `expected exit 1 (drift), got ${r.status}`)
  assert(new RegExp(`^DRIFT product\\.judges\\.${firstJudge.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} `, 'm').test(r.stdout), 'expected DRIFT on the tampered judge')
})

// ── 4. a tampered content_digest is DETECTED ───────────────────────────────────────
t('--check DETECTS a tampered content_digest (exit 1, DIGEST MISMATCH)', () => {
  const m = readJson(MANIFEST)
  m.content_digest = `sha256:${'f'.repeat(64)}`
  const p = join(tmp, 'tampered-digest.json')
  writeFileSync(p, `${JSON.stringify(m, null, 2)}\n`)
  const r = run(['--check', '--manifest', p])
  assert(r.status === 1, `expected exit 1, got ${r.status}`)
  assert(/^DIGEST .* MISMATCH$/m.test(r.stdout), 'expected DIGEST ... MISMATCH')
})

t('--check also recomputes content_digest over every other field (a silent field edit breaks it)', () => {
  const m = readJson(MANIFEST)
  m.authority.snapshot_baseline = '0'.repeat(40)
  const p = join(tmp, 'tampered-field.json')
  writeFileSync(p, `${JSON.stringify(m, null, 2)}\n`)
  const r = run(['--check', '--manifest', p])
  assert(r.status === 1, `expected exit 1, got ${r.status}`)
  assert(/^DRIFT authority\.snapshot_baseline /m.test(r.stdout), 'expected DRIFT on the edited field')
  assert(/^DIGEST .* MISMATCH$/m.test(r.stdout), 'expected the F0 digest to catch the silent edit too')
})

// ── 5. a missing manifest is an environment error (exit 2), not drift ───────────────
t('--check on a missing manifest exits 2 (drift and read failure are distinct exits)', () => {
  const r = run(['--check', '--manifest', join(tmp, 'does-not-exist.json')])
  assert(r.status === 2, `expected exit 2, got ${r.status}`)
})

// ── 6. the leaf differ sees additions and removals ─────────────────────────────────
t('diffManifests reports NEW and GONE leaves, not only changed values', () => {
  const a = { x: { y: 1, z: 2 }, list: [1] }
  const b = { x: { y: 1 }, list: [1], added: true }
  const d = diffManifests(a, b)
  assert(d.missing === 1 && d.extra === 1 && d.drift === 0, `expected 1 GONE + 1 NEW, got ${JSON.stringify({ missing: d.missing, extra: d.extra, drift: d.drift })}`)
  assert(d.lines.some((l) => l.startsWith('GONE  x.z')), 'expected GONE x.z')
  assert(d.lines.some((l) => l.startsWith('NEW   added')), 'expected NEW added')
})

// ── 7. record_root is derived from the candidate id ───────────────────────────────
t('recordRootFor derives one evidence directory per candidate id (never a constant)', () => {
  // The directory convention the track has used since candidate 1: `cand-v0.1.6-4`
  // produces `evidence/candidate-v0.1.6-4/` — which is exactly the directory the
  // cand-v0.1.6-4 C2 records were produced in.
  const cases = [
    ['cand-v0.1.6-1', `${EVIDENCE_ROOT_REL}/candidate-v0.1.6-1`],
    ['cand-v0.1.6-2', `${EVIDENCE_ROOT_REL}/candidate-v0.1.6-2`],
    ['cand-v0.1.6-4', `${EVIDENCE_ROOT_REL}/candidate-v0.1.6-4`],
    ['cand-a5sf-fs-search-1', `${EVIDENCE_ROOT_REL}/candidate-a5sf-fs-search-1`],
    // An id without the `cand-` prefix is used verbatim rather than embellished.
    ['a5sf-fs-search-1', `${EVIDENCE_ROOT_REL}/a5sf-fs-search-1`],
  ]
  for (const [id, expected] of cases) {
    const root = recordRootFor(id)
    assert(root === expected, `recordRootFor(${id}) = ${root}, expected ${expected}`)
  }
  assert(recordRootFor('cand-v0.1.6-4') !== recordRootFor('cand-v0.1.6-1'), 'two candidates must not share a record root')
})

// ── 8. a candidate id cannot escape its own evidence directory ────────────────────
t('recordRootFor rejects ids that would make the evidence root something other than a child named after it', () => {
  for (const bad of ['../candidate-1', 'a/b', 'a\\b', ' ', '', '.', '..', 'cand v0.1.6', undefined, null, 7]) {
    let threw = false
    try { recordRootFor(bad) } catch { threw = true }
    assert(threw, `expected recordRootFor(${JSON.stringify(bad)}) to throw`)
  }
})

// ── 9. the GENERATED manifest carries the derived root (end-to-end) ───────────────
t('generate --stdout writes evidence.record_root for the id it was given, and no -1 string for another id', () => {
  // The live pointer's snapshot_version, read from the tracked pointer (two keys),
  // so the case does not pin a snapshot the repository is free to move.
  const pointer = readJson(join(ROOT, 'dev/engineering/current-authority.json'))
  const commit = '0d31f9121308a43030701fe6d56c316100782419'
  const frozen1 = readJson(MANIFEST)
  assert(frozen1.candidate_commit !== undefined, 'fixture manifest must carry a candidate_commit')

  const gen = (candidateId) => {
    const r = run([
      '--candidate-id', candidateId,
      '--ref', 'candidate/v0.1.6-4',
      '--commit', commit,
      '--authority-snapshot', pointer.snapshot_version,
      '--stdout',
    ])
    assert(r.status === 0, `generate ${candidateId} exited ${r.status}: ${r.stderr}`)
    return JSON.parse(r.stdout)
  }

  const m4 = gen('cand-v0.1.6-4')
  assert(m4.evidence.record_root === `${EVIDENCE_ROOT_REL}/candidate-v0.1.6-4`, `got ${m4.evidence.record_root}`)

  // Negative control: for a different id the frozen literal of the -1 era must be
  // absent from the WHOLE emitted manifest, not only from record_root.
  const m5 = gen('cand-v0.1.6-5')
  assert(m5.evidence.record_root === `${EVIDENCE_ROOT_REL}/candidate-v0.1.6-5`, `got ${m5.evidence.record_root}`)
  const text = JSON.stringify(m5)
  assert(!text.includes('candidate-v0.1.6-1'), 'a manifest frozen under another id must not name candidate-v0.1.6-1 anywhere')
  assert(m5.candidate_id === 'cand-v0.1.6-5', 'candidate_id must be the id it was asked for')
})

// ── 10. the already-frozen manifests are history and stay byte-identical ──────────
t('existing manifests keep their frozen record_root text (the fix is not applied retroactively)', () => {
  // cand-v0.1.6-2..-4 carry the -1 root the pre-fix generator wrote. Rewriting a
  // frozen manifest would move its F0 digest and invalidate every record that cites
  // it, so the wrong text must stay exactly where it was frozen.
  for (const id of ['cand-v0.1.6-2', 'cand-v0.1.6-3', 'cand-v0.1.6-4']) {
    const m = readJson(join(ROOT, `dev/engineering/candidates/${id}.json`))
    assert(m.candidate_id === id, `${id}.json names ${m.candidate_id}`)
    assert(m.evidence.record_root === `${EVIDENCE_ROOT_REL}/candidate-v0.1.6-1`, `${id}.json is expected to KEEP the pre-fix root; if this changed, a frozen manifest was rewritten`)
    assert(m.content_digest === manifestDigest(m), `${id}.json digest must still match its own bytes`)
  }
})

rmSync(tmp, { recursive: true, force: true })
console.log(fails === 0 ? `ALL GREEN (${ran} cases)` : `RED (${fails}/${ran} failing)`)
process.exit(fails === 0 ? 0 : 1)
