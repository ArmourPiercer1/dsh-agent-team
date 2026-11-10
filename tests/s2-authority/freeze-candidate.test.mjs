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
//      new field cannot hide from the diff.
//
// Run with: node tests/s2-authority/freeze-candidate.test.mjs

import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { manifestDigest, diffManifests } from '../../scripts/freeze-candidate.mjs'

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

rmSync(tmp, { recursive: true, force: true })
console.log(fails === 0 ? `ALL GREEN (${ran} cases)` : `RED (${fails}/${ran} failing)`)
process.exit(fails === 0 ? 0 : 1)
