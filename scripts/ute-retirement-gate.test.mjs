#!/usr/bin/env node
/**
 * ute-retirement-gate.test.mjs — the retirement gate's controls.
 *
 * The gate's whole claim is "a ledger row is not evidence; a COMMITTED FILE that
 * states the claimed verdict is". So every control here runs against a real git
 * repository: a fixture repo under `.artifacts/tmp/` for the synthetic family,
 * and the real repository for the seeded `fs` row. A fixture that is merely
 * "written to disk" would prove nothing — `defaultIsTracked` would refuse it,
 * which is exactly one of the controls (`NC-6`).
 *
 * CONTROLS (each RED without its check, GREEN with it):
 *   P1  a fully satisfied synthetic family is ALLOWED (the gate is not a
 *       refuse-everything machine)
 *   NC-1 UTE_OLD_BASELINE_MISSING
 *   NC-2 UTE_NEW_PATH_UNVERIFIED
 *   NC-3 UTE_SEMANTIC_DIFFERENCES_UNRESOLVED (blocking difference, no approval)
 *   NC-4 UTE_NEGATIVE_CONTROLS_FAILING
 *   NC-5 UTE_LEDGER_UNKNOWN_FAMILY
 *   NC-6 UTE_EVIDENCE_UNREADABLE (pointer missing, and a present-but-uncommitted file)
 *   NC-7 UTE_EVIDENCE_CONTRADICTED (file present but silent on the claim, and a
 *        file that contradicts it verbatim)
 *   NC-8 UTE_STATE_CONTRADICTED (both directions: state can neither fabricate a
 *        pass nor silently suppress one)
 *   NC-9 UTE_LEDGER_SCHEMA (could-not-grade, never a pass)
 *   NC-10 fabricated owner approval (a record that does not name the approver)
 *   REAL the seeded fs row is REFUSED with UTE_SEMANTIC_DIFFERENCES_UNRESOLVED
 *
 * Every control prints `UTE-MUTATION …` so the run itself is the mutation
 * transcript (captured verbatim in dev/agent-workflow/evidence/ute0-contract-20261120/).
 *
 * Run: node --test scripts/ute-retirement-gate.test.mjs
 */
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import {
  LEDGER_REL,
  checkRetirement,
  loadLedger,
} from './ute-retirement-gate.mjs'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const TMP_ROOT = join(ROOT, '.artifacts', 'tmp', 'ute-retirement-gate')

/** A committed fixture repo: evidence files exist, are readable, and git knows them. */
function makeFixtureRepo() {
  mkdirSync(TMP_ROOT, { recursive: true })
  const dir = mkdtempSync(join(TMP_ROOT, 'repo-'))
  execFileSync('git', ['-C', dir, 'init', '-q'])
  execFileSync('git', ['-C', dir, 'config', 'user.email', 'ute0@example.invalid'])
  execFileSync('git', ['-C', dir, 'config', 'user.name', 'UTE-0'])
  mkdirSync(join(dir, 'evidence'), { recursive: true })
  writeFileSync(join(dir, 'evidence', 'old.tsv'), 'vector\tverdict\nv1\tOLD-BASELINE-OK\n')
  writeFileSync(join(dir, 'evidence', 'new.txt'), 'NEW-PATH-OK vectors=10 failed=0\n')
  writeFileSync(join(dir, 'evidence', 'sem.md'), 'DIFFERENCE RECORDED\nretirement-blocking   YES\n')
  writeFileSync(join(dir, 'evidence', 'nc.txt'), 'NC-OK controls=4 failed=0\n')
  writeFileSync(join(dir, 'evidence', 'approval.md'), 'approved-by: owner\napproved-on: 2026-11-20\nscope: synthetic-fs/d1\n')
  execFileSync('git', ['-C', dir, 'add', '-A'])
  execFileSync('git', ['-C', dir, 'commit', '-qm', 'fixture: committed evidence'])
  return dir
}

/** A ledger shape whose four terms are all established for `synthetic-fs`. */
function goodLedger() {
  return {
    schema: 'ute-retirement/1',
    families: [
      {
        family: 'synthetic-fs',
        state: 'RETIREABLE',
        terms: {
          oldBaseline: {
            verdict: true,
            evidence: { path: 'evidence/old.tsv', expect: ['OLD-BASELINE-OK'], contradicts: [] },
          },
          newPathVerified: {
            verdict: true,
            evidence: { path: 'evidence/new.txt', expect: ['NEW-PATH-OK', 'failed=0'], contradicts: [] },
          },
          semanticDifferencesResolved: {
            verdict: true,
            differences: [
              {
                id: 'd1',
                blocking: true,
                approval: { by: 'owner', on: '2026-11-20', record: 'evidence/approval.md' },
              },
            ],
            evidence: { path: 'evidence/sem.md', expect: ['DIFFERENCE RECORDED'], contradicts: [] },
          },
          negativeControlsPass: {
            verdict: true,
            evidence: { path: 'evidence/nc.txt', expect: ['NC-OK', 'failed=0'], contradicts: [] },
          },
        },
      },
    ],
  }
}

const codes = (verdict) => [...new Set(verdict.findings.map((f) => f.code))]

function transcript(id, mutation, expected, observed, recovered) {
  console.log(`UTE-MUTATION id=${id} mutation=${JSON.stringify(mutation)} expected=${expected} observed=${observed.join(',') || 'ALLOWED'} recovered=${recovered}`)
}

/**
 * One control: baseline is allowed; the mutation is refused with the expected
 * code; restoring the input is allowed again (the check, not the fixture, is
 * what refused).
 */
function control(id, mutation, expected, mutate) {
  return test(`${id} — ${mutation} → ${expected}`, () => {
    const repo = makeFixtureRepo()
    try {
      const baseline = checkRetirement({ ledger: goodLedger(), family: 'synthetic-fs', root: repo })
      assert.equal(baseline.allowed, true, `baseline must be allowed: ${JSON.stringify(codes(baseline))}`)

      const mutated = goodLedger()
      mutate(mutated)
      const refused = checkRetirement({ ledger: mutated, family: 'synthetic-fs', root: repo })
      assert.equal(refused.allowed, false, 'the mutation must be refused')
      assert.ok(codes(refused).includes(expected), `expected ${expected}, got ${JSON.stringify(codes(refused))}`)
      transcript(id, mutation, `REFUSED:${expected}`, codes(refused), baseline.allowed ? 'ALLOWED' : 'REFUSED')
    } finally {
      rmSync(repo, { recursive: true, force: true })
    }
  })
}

test('P1 — a fully satisfied synthetic family is ALLOWED (positive control)', () => {
  const repo = makeFixtureRepo()
  try {
    const verdict = checkRetirement({ ledger: goodLedger(), family: 'synthetic-fs', root: repo })
    assert.equal(verdict.allowed, true)
    assert.deepEqual(verdict.findings, [])
    assert.equal(verdict.state, 'RETIREABLE')
    transcript('P1', 'none (all four terms satisfied by committed evidence)', 'ALLOWED', [], 'ALLOWED')
  } finally {
    rmSync(repo, { recursive: true, force: true })
  }
})

control('NC-1', 'oldBaseline.verdict=false', 'UTE_OLD_BASELINE_MISSING', (l) => {
  l.families[0].terms.oldBaseline.verdict = false
})

control('NC-2', 'newPathVerified.verdict=false', 'UTE_NEW_PATH_UNVERIFIED', (l) => {
  l.families[0].terms.newPathVerified.verdict = false
})

control('NC-3', 'blocking difference without an approval', 'UTE_SEMANTIC_DIFFERENCES_UNRESOLVED', (l) => {
  l.families[0].terms.semanticDifferencesResolved.differences[0].approval = null
})

control('NC-4', 'negativeControlsPass.verdict=false', 'UTE_NEGATIVE_CONTROLS_FAILING', (l) => {
  l.families[0].terms.negativeControlsPass.verdict = false
})

test('NC-5 — an unknown family is refused by name, never graded as absent-green', () => {
  const repo = makeFixtureRepo()
  try {
    const verdict = checkRetirement({ ledger: goodLedger(), family: 'pty', root: repo })
    assert.equal(verdict.allowed, false)
    assert.deepEqual(codes(verdict), ['UTE_LEDGER_UNKNOWN_FAMILY'])
    transcript('NC-5', 'request family=pty (only synthetic-fs is in the ledger)', 'REFUSED:UTE_LEDGER_UNKNOWN_FAMILY', codes(verdict), 'n/a (unknown family has no green state)')
  } finally {
    rmSync(repo, { recursive: true, force: true })
  }
})

test('NC-6 — evidence must be a real COMMITTED file (missing and untracked both refuse)', () => {
  const repo = makeFixtureRepo()
  try {
    const missing = goodLedger()
    missing.families[0].terms.oldBaseline.evidence.path = 'evidence/does-not-exist.tsv'
    const v1 = checkRetirement({ ledger: missing, family: 'synthetic-fs', root: repo })
    assert.equal(v1.allowed, false)
    assert.ok(codes(v1).includes('UTE_EVIDENCE_UNREADABLE'))
    assert.ok(codes(v1).includes('UTE_OLD_BASELINE_MISSING') === false, 'the term itself is still true — only its evidence is unreadable')

    // A file that exists on disk but was never committed: a cold clone cannot
    // open it, so it is not evidence.
    writeFileSync(join(repo, 'evidence', 'untracked.txt'), 'OLD-BASELINE-OK\n')
    const untracked = goodLedger()
    untracked.families[0].terms.oldBaseline.evidence.path = 'evidence/untracked.txt'
    const v2 = checkRetirement({ ledger: untracked, family: 'synthetic-fs', root: repo })
    assert.equal(v2.allowed, false)
    assert.ok(codes(v2).includes('UTE_EVIDENCE_UNREADABLE'))

    // The committed pointers themselves stay green (control is not vacuous).
    const honest = checkRetirement({ ledger: goodLedger(), family: 'synthetic-fs', root: repo })
    assert.equal(honest.allowed, true)
    transcript('NC-6', 'evidence pointer → missing file; and → present-but-uncommitted file', 'REFUSED:UTE_EVIDENCE_UNREADABLE', [...new Set([...codes(v1), ...codes(v2)])], 'ALLOWED')
  } finally {
    rmSync(repo, { recursive: true, force: true })
  }
})

test('NC-7 — a file that does not state the claimed verdict is CONTRADICTED evidence', () => {
  const repo = makeFixtureRepo()
  try {
    // (a) the pointer resolves and is committed, but the claimed token is absent.
    const silent = goodLedger()
    silent.families[0].terms.oldBaseline.evidence.expect = ['OLD-BASELINE-OK', 'PROTOTYPE-VERDICT GREEN']
    const v1 = checkRetirement({ ledger: silent, family: 'synthetic-fs', root: repo })
    assert.equal(v1.allowed, false)
    assert.ok(codes(v1).includes('UTE_EVIDENCE_CONTRADICTED'))

    // (b) the file says the opposite: a `contradicts` token is present verbatim.
    const opposite = goodLedger()
    opposite.families[0].terms.oldBaseline.evidence.contradicts = ['OLD-BASELINE-OK']
    const v2 = checkRetirement({ ledger: opposite, family: 'synthetic-fs', root: repo })
    assert.equal(v2.allowed, false)
    assert.ok(codes(v2).includes('UTE_EVIDENCE_CONTRADICTED'))
    assert.match(v2.findings.find((f) => f.code === 'UTE_EVIDENCE_CONTRADICTED').detail, /contradicts the claimed verdict/)

    // (c) a ledger whose evidence pointers all resolve and state the verdict
    //     is still allowed — the check bites the lie, not the author.
    assert.equal(checkRetirement({ ledger: goodLedger(), family: 'synthetic-fs', root: repo }).allowed, true)
    transcript('NC-7', 'expect token absent; and a verbatim contradicts token present', 'REFUSED:UTE_EVIDENCE_CONTRADICTED', [...new Set([...codes(v1), ...codes(v2)])], 'ALLOWED')
  } finally {
    rmSync(repo, { recursive: true, force: true })
  }
})

test('NC-8 — state is a mirror, not a second authority (both directions refuse)', () => {
  const repo = makeFixtureRepo()
  try {
    const suppressed = goodLedger()
    suppressed.families[0].state = 'NOT_RETIREABLE'
    const v1 = checkRetirement({ ledger: suppressed, family: 'synthetic-fs', root: repo })
    assert.equal(v1.allowed, false)
    assert.deepEqual(codes(v1), ['UTE_STATE_CONTRADICTED'])

    const fabricated = goodLedger()
    fabricated.families[0].state = 'RETIREABLE'
    fabricated.families[0].terms.negativeControlsPass.verdict = false
    const v2 = checkRetirement({ ledger: fabricated, family: 'synthetic-fs', root: repo })
    assert.equal(v2.allowed, false)
    assert.ok(codes(v2).includes('UTE_NEGATIVE_CONTROLS_FAILING'))
    assert.ok(codes(v2).includes('UTE_STATE_CONTRADICTED'), 'editing the state string must not out-shout the term')

    assert.equal(checkRetirement({ ledger: goodLedger(), family: 'synthetic-fs', root: repo }).allowed, true)
    transcript('NC-8', 'state=NOT_RETIREABLE with all terms true; state=RETIREABLE with a failed term', 'REFUSED:UTE_STATE_CONTRADICTED', [...new Set([...codes(v1), ...codes(v2)])], 'ALLOWED')
  } finally {
    rmSync(repo, { recursive: true, force: true })
  }
})

test('NC-9 — a ledger that cannot be graded exits NON-ZERO (never a pass)', () => {
  const repo = makeFixtureRepo()
  try {
    const wrongSchema = goodLedger()
    wrongSchema.schema = 'ute-retirement/0'
    const v = checkRetirement({ ledger: wrongSchema, family: 'synthetic-fs', root: repo })
    assert.equal(v.allowed, false)
    assert.equal(v.couldNotGrade, 'UTE_LEDGER_SCHEMA')
    transcript('NC-9', 'schema=ute-retirement/0', 'REFUSED:UTE_LEDGER_SCHEMA', codes(v), 'ALLOWED (correct schema)')
  } finally {
    rmSync(repo, { recursive: true, force: true })
  }
})

test('NC-10 — a fabricated owner approval record is contradicted evidence', () => {
  const repo = makeFixtureRepo()
  try {
    const fabricated = goodLedger()
    // The record exists and is committed, but it does not name the claimed
    // approver — an approval nobody signed.
    fabricated.families[0].terms.semanticDifferencesResolved.differences[0].approval = {
      by: 'owner',
      on: '2026-11-20',
      record: 'evidence/old.tsv',
    }
    const v = checkRetirement({ ledger: fabricated, family: 'synthetic-fs', root: repo })
    assert.equal(v.allowed, false)
    assert.ok(codes(v).includes('UTE_EVIDENCE_CONTRADICTED'))
    assert.ok(codes(v).includes('UTE_SEMANTIC_DIFFERENCES_UNRESOLVED'))
    assert.equal(checkRetirement({ ledger: goodLedger(), family: 'synthetic-fs', root: repo }).allowed, true)
    transcript('NC-10', 'approval.record points at a committed file that never names the approver', 'REFUSED:UTE_EVIDENCE_CONTRADICTED', codes(v), 'ALLOWED')
  } finally {
    rmSync(repo, { recursive: true, force: true })
  }
})

test('REAL — the seeded fs row is refused today (semantic differences unresolved)', () => {
  const loaded = loadLedger({ root: ROOT })
  assert.equal(loaded.refused, undefined, `the committed ledger must be gradable: ${loaded.detail ?? ''}`)
  const verdict = checkRetirement({ ledger: loaded.ledger, family: 'fs', root: ROOT })
  assert.equal(verdict.allowed, false, 'fs must NOT be retireable while both differences are blocking and unapproved')
  assert.ok(codes(verdict).includes('UTE_SEMANTIC_DIFFERENCES_UNRESOLVED'))
  assert.ok(codes(verdict).includes('UTE_OLD_BASELINE_MISSING') === false, 'the old baseline IS established for fs')
  assert.ok(codes(verdict).includes('UTE_NEW_PATH_UNVERIFIED') === false, 'the prototype path IS verified for fs')
  assert.ok(codes(verdict).includes('UTE_NEGATIVE_CONTROLS_FAILING') === false, 'the FS negative controls DO pass')
  console.log(`UTE-MUTATION id=REAL mutation=${JSON.stringify(`seeded ${LEDGER_REL} row fs, no input mutated`)} expected=REFUSED:UTE_SEMANTIC_DIFFERENCES_UNRESOLVED observed=${codes(verdict).join(',')} recovered=fs is NOT_RETIREABLE`)
})

test('CLI — --family fs exits 1 and prints JSON; --all never hides a refusal', () => {  const run = (args) => {
    try {
      const stdout = execFileSync(process.execPath, ['scripts/ute-retirement-gate.mjs', ...args], { cwd: ROOT, encoding: 'utf8' })
      return { status: 0, stdout }
    } catch (e) {
      return { status: e.status, stdout: String(e.stdout ?? '') }
    }
  }
  const json = run(['--family', 'fs', '--json'])
  assert.equal(json.status, 1)
  const payload = JSON.parse(json.stdout)
  assert.equal(payload.schema, 'ute-retirement-verdict/1')
  assert.deepEqual(payload.allowed, [])
  assert.equal(payload.refused[0].family, 'fs')
  assert.ok(payload.refused[0].codes.includes('UTE_SEMANTIC_DIFFERENCES_UNRESOLVED'))

  const all = run(['--all'])
  assert.equal(all.status, 1)
  assert.match(all.stdout, /UTE-RETIREMENT-REFUSED family=fs codes=UTE_SEMANTIC_DIFFERENCES_UNRESOLVED/)

  const unknown = run(['--family', 'mcp'])
  assert.equal(unknown.status, 1)
  assert.match(unknown.stdout, /UTE_LEDGER_UNKNOWN_FAMILY/)
})

test('CLI — a committed, fully satisfied synthetic family is ALLOWED (exit 0)', () => {
  // scripts/fixtures/ute-retirement-selftest/** is committed on purpose: this
  // is the "the gate can say yes" arm of the CLI contract, with evidence a cold
  // clone can actually read (the UNIT controls above use a throwaway repo).
  const out = execFileSync(
    process.execPath,
    ['scripts/ute-retirement-gate.mjs', '--family', 'synthetic-selftest', '--ledger', 'scripts/fixtures/ute-retirement-selftest/ledger.json'],
    { cwd: ROOT, encoding: 'utf8' },
  )
  assert.match(out, /UTE-RETIREMENT-ALLOW family=synthetic-selftest terms=4\/4 state=RETIREABLE/)
  assert.match(out, /UTE-RETIREMENT-SUMMARY requested=1 allowed=1 refused=0/)
  console.log('UTE-MUTATION id=CLI-ALLOW mutation="none (committed synthetic fixture, all four terms satisfied)" expected=ALLOWED observed=ALLOWED recovered=ALLOWED')
})
