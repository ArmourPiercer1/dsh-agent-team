/**
 * candidate-status.test.mjs — the algebra of the frozen-candidate state report.
 * `report()` is pure, so every case is a hand-built entry; the live
 * filesystem/git half is exercised by running the tool on the real tree.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { acceptanceOf, derivedRecordRoot, report } from './candidate-status.mjs'

const V1 = 'cand-v0.1.6-1'
const V2 = 'cand-v0.1.6-2'
const V3 = 'cand-v0.1.6-3'

const A = (sha, eligible = false) => ({ class: 'C2-A', sha, eligible })
const B = (sha, eligible = false) => ({ class: 'C2-B', sha, eligible })

function entry(id, over = {}) {
  return {
    manifest: {
      kind: 'frozen-candidate',
      candidate_id: id,
      candidate_commit: over.commit ?? 'c1',
      candidate_ref: `refs/heads/candidate/${id}`,
      status: 'FROZEN',
      content_digest: 'sha256:x',
      frozen_at_utc: over.at ?? '2026-11-10T00:00:00Z',
      evidence: { record_root: over.root ?? derivedRecordRoot(id), ...(over.evidence ?? {}) },
      ancestry: { candidate_is_ancestor_of_origin_master: over.claimedAncestry ?? true },
      immutability: { supersedes: over.supersedes ?? null },
    },
    rootExists: over.rootExists ?? true,
    records: over.records ?? [A(over.commit ?? 'c1')],
    recordsRoot: over.recordsRoot ?? null,
    refExists: over.refExists ?? true,
  }
}

const noAncestor = () => null

test('two ordered candidates of one line with recorded lineage are clean', () => {
  const r = report([
    entry(V1, { at: '2026-11-10T00:00:00Z', commit: 'c1' }),
    entry(V2, { at: '2026-11-11T00:00:00Z', commit: 'c2', supersedes: V1 }),
  ], { isAncestor: (a, b) => (a === 'c1' && b === 'c2' ? true : null) })
  assert.deepEqual(r.defects, [])
  assert.equal(r.rows[1].chain, 'AFTER')
  assert.equal(r.rows[0].acceptance, 'C2_A_ONLY')
})

test('a same-line predecessor with supersedes:null is LINEAGE_UNRECORDED', () => {
  const r = report([
    entry(V1, { at: '2026-11-10T00:00:00Z', commit: 'c1' }),
    entry(V2, { at: '2026-11-11T00:00:00Z', commit: 'c2' }),
  ], { isAncestor: (a, b) => (a === 'c1' && b === 'c2' ? true : null) })
  assert.ok(r.defects.some((d) => d.code === 'LINEAGE_UNRECORDED' && d.id === V2))
})

test('a jump to another candidate line is a family change, not missing lineage', () => {
  const r = report([
    entry('cand-a5sf-fs-search-1', { at: '2026-11-05T00:00:00Z', commit: 'c1' }),
    entry(V1, { at: '2026-11-10T00:00:00Z', commit: 'c2' }),
  ], { isAncestor: (a, b) => (a === 'c1' && b === 'c2' ? true : null) })
  assert.equal(r.defects.filter((d) => d.code === 'LINEAGE_UNRECORDED').length, 0)
  assert.ok(r.notes.some((n) => n.code === 'LINEAGE_FAMILY_CHANGE' && n.id === V1))
})

test('a record_root that does not exist is a defect when not awaiting C2', () => {
  const r = report([entry(V1, { rootExists: false, records: [] })], { isAncestor: noAncestor })
  assert.ok(r.defects.some((d) => d.code === 'RECORD_ROOT_MISSING'))
  assert.equal(r.rows[0].acceptance, 'C2_NOT_RUN')
})

test('a record_root that does not exist yet is a pending note under AWAITING_C2', () => {
  const r = report([entry(V1, { rootExists: false, records: [], evidence: { status: 'AWAITING_C2' } })], { isAncestor: noAncestor })
  assert.equal(r.defects.filter((d) => d.code === 'RECORD_ROOT_MISSING').length, 0)
  assert.ok(r.notes.some((n) => n.code === 'RECORD_ROOT_NOT_YET_CREATED'))
})

test('a record_root that disagrees with the candidate id is a stale-path defect', () => {
  const r = report([entry(V2, { root: derivedRecordRoot(V1), rootExists: true })], { isAncestor: noAncestor })
  assert.ok(r.defects.some((d) => d.code === 'RECORD_ROOT_STALE_PATH'))
})

test('a record naming another commit is foreign', () => {
  const r = report([entry(V1, { records: [A('deadbeef')] })], { isAncestor: noAncestor })
  assert.ok(r.defects.some((d) => d.code === 'RECORD_FOREIGN'))
})

test('freeze order that git contradicts is a broken chain', () => {
  const r = report([
    entry(V1, { at: '2026-11-10T00:00:00Z', commit: 'c1' }),
    entry(V2, { at: '2026-11-11T00:00:00Z', commit: 'c2' }),
  ], { isAncestor: (a, b) => (a === 'c2' && b === 'c1' ? true : null) })
  assert.equal(r.rows[1].chain, 'BEFORE')
  assert.ok(r.defects.some((d) => d.code === 'ANCESTRY_CHAIN_BROKEN'))
})

test('unrelated commits are a separate line, not a broken chain', () => {
  const r = report([
    entry(V1, { at: '2026-11-10T00:00:00Z', commit: 'c1' }),
    entry(V2, { at: '2026-11-11T00:00:00Z', commit: 'c2' }),
  ], { isAncestor: () => false })
  assert.equal(r.rows[1].chain, 'SEPARATE_LINE')
  assert.equal(r.defects.filter((d) => d.code === 'ANCESTRY_CHAIN_BROKEN').length, 0)
  assert.ok(r.notes.some((n) => n.code === 'SEPARATE_LINE'))
})

test('a manifest ancestry claim git contradicts is a defect', () => {
  const r = report([entry(V1, { claimedAncestry: true })], { isAncestor: (a, b) => (b === 'origin/master' ? false : null) })
  assert.ok(r.defects.some((d) => d.code === 'ANCESTRY_MANIFEST_DISAGREES'))
})

test('a missing candidate ref is a defect; null (no ref) is not checked', () => {
  assert.ok(report([entry(V1, { refExists: false })], { isAncestor: noAncestor }).defects.some((d) => d.code === 'REF_MISSING'))
  assert.equal(report([entry(V1, { refExists: null })], { isAncestor: noAncestor }).defects.length, 0)
})

test('a stale manifest still reports the evidence that exists at the derived root', () => {
  const r = report([entry(V3, {
    commit: 'c3',
    root: derivedRecordRoot(V1),
    rootExists: false,
    recordsRoot: derivedRecordRoot(V3),
    records: [A('c3')],
  })], { isAncestor: noAncestor })
  assert.equal(r.rows[0].acceptance, 'C2_A_ONLY')
  assert.ok(r.notes.some((n) => n.code === 'EVIDENCE_AT_DERIVED_ROOT'))
  assert.ok(r.defects.some((d) => d.code === 'RECORD_ROOT_STALE_PATH'))
})

test('acceptance needs both records and both eligible flags', () => {
  const m = { evidence: {} }
  assert.equal(acceptanceOf(m, []), 'C2_NOT_RUN')
  assert.equal(acceptanceOf(m, [A('s')]), 'C2_A_ONLY')
  assert.equal(acceptanceOf(m, [A('s'), B('s')]), 'C2_A_AND_B')
  assert.equal(acceptanceOf(m, [A('s', true), B('s', true)]), 'CANDIDATE_ELIGIBLE')
  assert.equal(acceptanceOf({ evidence: { overall: 'PASS 11/11' } }, []), 'RECORDED_RUN_PASS')
})

test('a non-FROZEN manifest is not reported as identity-locked', () => {
  const e = entry(V1)
  e.manifest.status = 'AWAITING_C2'
  assert.equal(report([e], { isAncestor: noAncestor }).rows[0].identity, 'NOT_FROZEN')
})

test('the CLI self-test runs without network', () => {
  const r = spawnSync(process.execPath, ['scripts/candidate-status.mjs', '--self-test'], { encoding: 'utf8' })
  assert.equal(r.status, 0, r.stdout + r.stderr)
  assert.match(r.stdout, /DSH-CANDIDATE-STATUS-SELFTEST PASS/)
})
