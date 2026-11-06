/**
 * A run record is evidence only when it says WHICH TREE and WHICH HOST produced
 * it — and that has to be enforced where the record is written, not only where
 * it is graded.
 *
 * History: three separate DEV-LIVE lanes (`a5sf-sub-devlive`, `a5sf-pd12-fix`,
 * and one more before them) wrote records whose verdicts were real but whose
 * `bindings.teamSha`/`hostSha` were absent. Every one passed locally (the
 * non-strict manifest lane says nothing) and every one went red in CI's strict
 * `--new` lane with `RUN_SOURCE_UNRESOLVED` + `RUN_SCHEMA`, then was patched by
 * hand. The class is an instrument defect: a writer that can emit a record no
 * gate can bind.
 *
 * The negative controls below are the point of the file: if `finalize()` ever
 * stops refusing an unbound record, these go red.
 */
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import { UnboundRunRecordError, assertBoundRecord, createRunRecord } from './lib/run-record.mjs'

const TEAM = '3313bdf08919313d03abf78e57dcfb6c6ff957c9'
const HOST = '639ed015397290b3745d163aafe02ffee4aa3f84'

function recorder(bindings, extra = {}) {
  return createRunRecord({
    runId: 'binding-test',
    suite: 'binding-test',
    selectedCases: ['c1'],
    bindings,
    ...extra,
  })
}

test('BOUND: a record with a full tree and host sha finalizes and writes', () => {
  const dir = mkdtempSync(join(tmpdir(), 'run-record-bound-'))
  try {
    const r = recorder({ teamSha: TEAM, hostSha: HOST })
    r.addCase('c1', 'PASS')
    const out = r.finalize()
    assert.equal(out.overall, 'PASS')
    const p = r.write(join(dir, 'run-record.json'))
    assert.equal(JSON.parse(readFileSync(p, 'utf8')).bindings.teamSha, TEAM)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('UNBOUND: a record with no bindings at all refuses to finalize (code RUN_RECORD_UNBOUND)', () => {
  const r = recorder({})
  r.addCase('c1', 'PASS')
  assert.throws(() => r.finalize(), (err) => {
    assert.equal(err.code, 'RUN_RECORD_UNBOUND')
    assert.ok(err instanceof UnboundRunRecordError)
    // BOTH problems are reported, not just the first: a caller who fixes
    // teamSha alone should not have to run the gate to discover hostSha.
    assert.equal(err.problems.length, 2)
    assert.match(err.message, /teamSha/)
    assert.match(err.message, /hostSha/)
    return true
  })
})

test('UNBOUND: a short or non-hex teamSha refuses (a branch name is not a tree)', () => {
  for (const bad of ['master', TEAM.slice(0, 12), `${TEAM.slice(0, 39)}g`, 42, null]) {
    assert.throws(() => assertBoundRecord({ bindings: { teamSha: bad, hostSha: HOST } }), UnboundRunRecordError, `accepted teamSha=${JSON.stringify(bad)}`)
  }
})

test('UNBOUND: a missing hostSha refuses even when the tree is bound', () => {
  assert.throws(() => assertBoundRecord({ bindings: { teamSha: TEAM } }), (err) => {
    assert.equal(err.problems.length, 1)
    assert.match(err.problems[0], /hostSha/)
    return true
  })
})

test('UNBOUND: write() refuses too, so no unbound record reaches disk even without an explicit finalize()', () => {
  const dir = mkdtempSync(join(tmpdir(), 'run-record-unbound-'))
  try {
    const r = recorder({ teamSha: TEAM })
    r.addCase('c1', 'PASS')
    assert.throws(() => r.write(join(dir, 'run-record.json')), UnboundRunRecordError)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('the DEV-LIVE claim rule still refuses a candidate claim (unchanged by this guard)', () => {
  const r = recorder({ teamSha: TEAM, hostSha: HOST }, { recordClass: 'DEV-LIVE', candidateClaim: { verifiedAtBaseline: true } })
  r.addCase('c1', 'PASS')
  assert.throws(() => r.finalize(), (err) => {
    assert.notEqual(err.code, 'RUN_RECORD_UNBOUND', 'the binding guard must not mask the claim rule')
    return true
  })
})
