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
 *   REAL the seeded fs row is REFUSED with the unit-coverage codes, and a
 *        fabricated "UNIT-MEMBER read_image covered" note changes nothing
 *
 *   UNIT-1 no `unit` block                          → UTE_UNIT_UNDECLARED
 *   UNIT-2 familyId not booked in the census        → UTE_UNIT_UNKNOWN_FAMILY
 *   UNIT-3 declared members drop read_image         → UTE_UNIT_UNDERCLAIMED
 *   UNIT-4 declared members add a tool              → UTE_UNIT_OVERCLAIMED
 *   UNIT-5 census absent / unparseable              → UTE_UNIT_UNGRADABLE
 *   COV-1 baseline TSV without `id` or `entry`      → UTE_UNIT_UNGRADABLE
 *   COV-2 read_image has no baseline vector         → UTE_MEMBER_UNCOVERED (oldBaseline)
 *   COV-3 a ledger note claiming coverage is inert  → same refusal, not a pass
 *   COV-4 new path misses / FAILs one vector        → UTE_VECTOR_UNREPRODUCED
 *   COV-5 negative controls omit a member           → UTE_MEMBER_UNCOVERED (negativeControlsPass)
 *   APPR-1 approval with by/on/record but no reference → UTE_APPROVAL_UNREFERENCED
 *   APPR-2 reference to a 40-hex that does not exist   → UTE_APPROVAL_UNREFERENCED
 *   APPR-3 reference to a commit that is not an ancestor (injected) → same
 *   OP-1 a declared old-path file absent while not allowed → UTE_OLD_PATH_PARTIALLY_REMOVED
 *   OP-2 the same absence while ALLOWED → no finding (that is retirement)
 *   OP-3 no `oldPath` block → UTE_OLD_PATH_UNDECLARED
 *
 * MUTANTS: for every new rule the suite copies the gate module, removes that one
 * rule from the copy, and asserts the corresponding control goes RED. The run
 * prints `UTE-RETIREMENT-GATE-MUTANTS total=<n> red=<n>` from the actual results
 * (no hand-written pass); a surviving mutant fails the test.
 *
 * Run: node --test scripts/ute-retirement-gate.test.mjs
 */
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'
import {
  LEDGER_REL,
  checkRetirement,
  loadLedger,
} from './ute-retirement-gate.mjs'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const TMP_ROOT = join(ROOT, '.artifacts', 'tmp', 'ute-retirement-gate')
const GATE_SRC = readFileSync(join(ROOT, 'scripts', 'ute-retirement-gate.mjs'), 'utf8')

/** A committed fixture repo: evidence files exist, are readable, and git knows them. */
function makeFixtureRepo() {
  mkdirSync(TMP_ROOT, { recursive: true })
  const dir = mkdtempSync(join(TMP_ROOT, 'repo-'))
  execFileSync('git', ['-C', dir, 'init', '-q'])
  execFileSync('git', ['-C', dir, 'config', 'user.email', 'ute0@example.invalid'])
  execFileSync('git', ['-C', dir, 'config', 'user.name', 'UTE-0'])
  mkdirSync(join(dir, 'evidence'), { recursive: true })
  mkdirSync(join(dir, 'src'), { recursive: true })
  mkdirSync(join(dir, 'dev', 'agent-workflow', 'ledgers'), { recursive: true })

  // The census is the reviewed booking the unit is derived from. The synthetic
  // family has four members on purpose: read/write/edit are easy to cover and
  // read_image is the member the external review found missing from the FS
  // corpus, so the fixture can stage exactly that gap.
  writeFileSync(join(dir, 'dev', 'agent-workflow', 'ledgers', 'arc-a-family-census.json'), JSON.stringify({
    schema: 'u6-arc-a-family-census/1',
    families: [{
      familyId: 'dsh.synthetic-family',
      lane: 'packages/tools/synthetic-family',
      mount: 'product',
      contributionPaths: ['packages/tools/synthetic-family/src/synthetic-contribution.mjs'],
      nativeNames: [
        '(bound-definition) read',
        '(bound-definition) write',
        '(bound-definition) edit',
        '(bound-definition) read_image',
      ],
    }],
  }, null, 2) + '\n')

  const baseline = (rows) => ['id\tentry\tverdict', ...rows].join('\n') + '\n'
  writeFileSync(join(dir, 'evidence', 'old.tsv'), baseline([
    'FS-1-read\tread\tOLD-BASELINE-OK',
    'FS-2-write\twrite\tOLD-BASELINE-OK',
    'FS-3-edit\tedit\tOLD-BASELINE-OK',
    'FS-4-image\tread_image\tOLD-BASELINE-OK',
  ]))
  // The measured gap: three members have vectors, read_image has none.
  writeFileSync(join(dir, 'evidence', 'old-no-image.tsv'), baseline([
    'FS-1-read\tread\tOLD-BASELINE-OK',
    'FS-2-write\twrite\tOLD-BASELINE-OK',
    'FS-3-edit\tedit\tOLD-BASELINE-OK',
  ]))
  // A header with no `entry` column: the gate must refuse to guess.
  writeFileSync(join(dir, 'evidence', 'bad-entry.tsv'), 'id\tverdict\nS1\tOLD-BASELINE-OK\n')
  // A header with no `id` column.
  writeFileSync(join(dir, 'evidence', 'bad-id.tsv'), 'vector\tentry\nS1\tread\n')

  const vectors = ['FS-1-read', 'FS-2-write', 'FS-3-edit', 'FS-4-image']
  writeFileSync(join(dir, 'evidence', 'new.txt'), [...vectors.map((id) => `NEW-PATH-VECTOR ${id} PASS`), 'NEW-PATH-OK vectors=4 failed=0'].join('\n') + '\n')
  writeFileSync(join(dir, 'evidence', 'new-missing.txt'), [...vectors.slice(0, 3).map((id) => `NEW-PATH-VECTOR ${id} PASS`), 'NEW-PATH-OK vectors=3 failed=0'].join('\n') + '\n')
  writeFileSync(join(dir, 'evidence', 'nc.txt'), ['NC-MEMBER read ok', 'NC-MEMBER write ok', 'NC-MEMBER edit ok', 'NC-MEMBER read_image ok', 'NC-OK controls=4 failed=0'].join('\n') + '\n')
  writeFileSync(join(dir, 'evidence', 'nc-no-image.txt'), ['NC-MEMBER read ok', 'NC-MEMBER write ok', 'NC-MEMBER edit ok', 'NC-OK controls=3 failed=0'].join('\n') + '\n')

  writeFileSync(join(dir, 'evidence', 'sem.md'), 'DIFFERENCE RECORDED\nretirement-blocking   YES\n')
  writeFileSync(join(dir, 'evidence', 'approval.md'), 'approved-by: owner\napproved-on: 2026-11-20\nscope: synthetic-fs/d1\n')
  writeFileSync(join(dir, 'src', 'keep.mjs'), 'export const keep = true\n')
  execFileSync('git', ['-C', dir, 'add', '-A'])
  execFileSync('git', ['-C', dir, 'commit', '-qm', 'fixture: committed evidence'])
  const sha = execFileSync('git', ['-C', dir, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
  return { root: dir, sha }
}

/** A ledger shape whose four terms are all established for `synthetic-fs`. */
function goodLedger(sha) {
  return {
    schema: 'ute-retirement/1',
    families: [
      {
        family: 'synthetic-fs',
        unit: { familyId: 'dsh.synthetic-family' },
        oldPath: { files: ['src/keep.mjs'] },
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
                approval: {
                  by: 'owner',
                  on: '2026-11-20',
                  record: 'evidence/approval.md',
                  reference: `PR #1 @ ${sha}`,
                },
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
const hasFinding = (verdict, code, term) => verdict.findings.some((f) => f.code === code && (term === undefined || f.term === term))

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
    const { root: repo, sha } = makeFixtureRepo()
    try {
      const baseline = checkRetirement({ ledger: goodLedger(sha), family: 'synthetic-fs', root: repo })
      assert.equal(baseline.allowed, true, `baseline must be allowed: ${JSON.stringify(codes(baseline))}`)

      const mutated = goodLedger(sha)
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
  const { root: repo, sha } = makeFixtureRepo()
  try {
    const verdict = checkRetirement({ ledger: goodLedger(sha), family: 'synthetic-fs', root: repo })
    assert.equal(verdict.allowed, true)
    assert.deepEqual(verdict.findings, [])
    assert.equal(verdict.state, 'RETIREABLE')
    assert.deepEqual(verdict.unit.members, ['read', 'write', 'edit', 'read_image'])
    assert.deepEqual(verdict.coverage.oldBaseline, ['read', 'write', 'edit', 'read_image'])
    transcript('P1', 'none (unit fully covered, all four terms satisfied by committed evidence)', 'ALLOWED', [], 'ALLOWED')
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
  const { root: repo, sha } = makeFixtureRepo()
  try {
    const verdict = checkRetirement({ ledger: goodLedger(sha), family: 'pty', root: repo })
    assert.equal(verdict.allowed, false)
    assert.deepEqual(codes(verdict), ['UTE_LEDGER_UNKNOWN_FAMILY'])
    transcript('NC-5', 'request family=pty (only synthetic-fs is in the ledger)', 'REFUSED:UTE_LEDGER_UNKNOWN_FAMILY', codes(verdict), 'n/a (unknown family has no green state)')
  } finally {
    rmSync(repo, { recursive: true, force: true })
  }
})

test('NC-6 — evidence must be a real COMMITTED file (missing and untracked both refuse)', () => {
  const { root: repo, sha } = makeFixtureRepo()
  try {
    const missing = goodLedger(sha)
    missing.families[0].terms.oldBaseline.evidence.path = 'evidence/does-not-exist.tsv'
    const v1 = checkRetirement({ ledger: missing, family: 'synthetic-fs', root: repo })
    assert.equal(v1.allowed, false)
    assert.ok(codes(v1).includes('UTE_EVIDENCE_UNREADABLE'))
    assert.ok(codes(v1).includes('UTE_OLD_BASELINE_MISSING') === false, 'the term itself is still true — only its evidence is unreadable')

    // A file that exists on disk but was never committed: a cold clone cannot
    // open it, so it is not evidence.
    writeFileSync(join(repo, 'evidence', 'untracked.txt'), 'OLD-BASELINE-OK\n')
    const untracked = goodLedger(sha)
    untracked.families[0].terms.oldBaseline.evidence.path = 'evidence/untracked.txt'
    const v2 = checkRetirement({ ledger: untracked, family: 'synthetic-fs', root: repo })
    assert.equal(v2.allowed, false)
    assert.ok(codes(v2).includes('UTE_EVIDENCE_UNREADABLE'))

    // The committed pointers themselves stay green (control is not vacuous).
    const honest = checkRetirement({ ledger: goodLedger(sha), family: 'synthetic-fs', root: repo })
    assert.equal(honest.allowed, true)
    transcript('NC-6', 'evidence pointer → missing file; and → present-but-uncommitted file', 'REFUSED:UTE_EVIDENCE_UNREADABLE', [...new Set([...codes(v1), ...codes(v2)])], 'ALLOWED')
  } finally {
    rmSync(repo, { recursive: true, force: true })
  }
})

test('NC-7 — a file that does not state the claimed verdict is CONTRADICTED evidence', () => {
  const { root: repo, sha } = makeFixtureRepo()
  try {
    // (a) the pointer resolves and is committed, but the claimed token is absent.
    const silent = goodLedger(sha)
    silent.families[0].terms.oldBaseline.evidence.expect = ['OLD-BASELINE-OK', 'PROTOTYPE-VERDICT GREEN']
    const v1 = checkRetirement({ ledger: silent, family: 'synthetic-fs', root: repo })
    assert.equal(v1.allowed, false)
    assert.ok(codes(v1).includes('UTE_EVIDENCE_CONTRADICTED'))

    // (b) the file says the opposite: a `contradicts` token is present verbatim.
    const opposite = goodLedger(sha)
    opposite.families[0].terms.oldBaseline.evidence.contradicts = ['OLD-BASELINE-OK']
    const v2 = checkRetirement({ ledger: opposite, family: 'synthetic-fs', root: repo })
    assert.equal(v2.allowed, false)
    assert.ok(codes(v2).includes('UTE_EVIDENCE_CONTRADICTED'))
    assert.match(v2.findings.find((f) => f.code === 'UTE_EVIDENCE_CONTRADICTED').detail, /contradicts the claimed verdict/)

    // (c) a ledger whose evidence pointers all resolve and state the verdict
    //     is still allowed — the check bites the lie, not the author.
    assert.equal(checkRetirement({ ledger: goodLedger(sha), family: 'synthetic-fs', root: repo }).allowed, true)
    transcript('NC-7', 'expect token absent; and a verbatim contradicts token present', 'REFUSED:UTE_EVIDENCE_CONTRADICTED', [...new Set([...codes(v1), ...codes(v2)])], 'ALLOWED')
  } finally {
    rmSync(repo, { recursive: true, force: true })
  }
})

test('NC-8 — state is a mirror, not a second authority (both directions refuse)', () => {
  const { root: repo, sha } = makeFixtureRepo()
  try {
    const suppressed = goodLedger(sha)
    suppressed.families[0].state = 'NOT_RETIREABLE'
    const v1 = checkRetirement({ ledger: suppressed, family: 'synthetic-fs', root: repo })
    assert.equal(v1.allowed, false)
    assert.deepEqual(codes(v1), ['UTE_STATE_CONTRADICTED'])

    const fabricated = goodLedger(sha)
    fabricated.families[0].state = 'RETIREABLE'
    fabricated.families[0].terms.negativeControlsPass.verdict = false
    const v2 = checkRetirement({ ledger: fabricated, family: 'synthetic-fs', root: repo })
    assert.equal(v2.allowed, false)
    assert.ok(codes(v2).includes('UTE_NEGATIVE_CONTROLS_FAILING'))
    assert.ok(codes(v2).includes('UTE_STATE_CONTRADICTED'), 'editing the state string must not out-shout the term')

    assert.equal(checkRetirement({ ledger: goodLedger(sha), family: 'synthetic-fs', root: repo }).allowed, true)
    transcript('NC-8', 'state=NOT_RETIREABLE with all terms true; state=RETIREABLE with a failed term', 'REFUSED:UTE_STATE_CONTRADICTED', [...new Set([...codes(v1), ...codes(v2)])], 'ALLOWED')
  } finally {
    rmSync(repo, { recursive: true, force: true })
  }
})

test('NC-9 — a ledger that cannot be graded exits NON-ZERO (never a pass)', () => {
  const { root: repo, sha } = makeFixtureRepo()
  try {
    const wrongSchema = goodLedger(sha)
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
  const { root: repo, sha } = makeFixtureRepo()
  try {
    const fabricated = goodLedger(sha)
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
    assert.equal(checkRetirement({ ledger: goodLedger(sha), family: 'synthetic-fs', root: repo }).allowed, true)
    transcript('NC-10', 'approval.record points at a committed file that never names the approver', 'REFUSED:UTE_EVIDENCE_CONTRADICTED', codes(v), 'ALLOWED')
  } finally {
    rmSync(repo, { recursive: true, force: true })
  }
})

test('REAL — the seeded fs row is refused for new-path reproduction and unresolved differences, and fabricated claims change nothing', () => {
  const loaded = loadLedger({ root: ROOT })
  assert.equal(loaded.refused, undefined, `the committed ledger must be gradable: ${loaded.detail ?? ''}`)
  const verdict = checkRetirement({ ledger: loaded.ledger, family: 'fs', root: ROOT })
  assert.equal(verdict.allowed, false, 'fs must NOT be retireable while both differences are unapproved')
  assert.deepEqual(verdict.unit.members, ['read', 'write', 'edit', 'read_image'], 'the unit is derived from the census, not chosen by the row')
  // UTE-3 PR B1 added the read_image baselines and one control per member, and PR B2
  // closed the last axis: the NEW path now reproduces all sixteen vectors, so every
  // axis is 4/4 and the row is refused for the unapproved differences alone.
  assert.deepEqual(verdict.coverage.oldBaseline, ['read', 'write', 'edit', 'read_image'], 'every member has a baseline vector')
  assert.deepEqual(verdict.coverage.negativeControlsPass, ['read', 'write', 'edit', 'read_image'], 'every member has its own NC-MEMBER control')
  assert.equal(hasFinding(verdict, 'UTE_MEMBER_UNCOVERED', 'oldBaseline'), false, 'read_image HAS a baseline vector')
  assert.equal(hasFinding(verdict, 'UTE_MEMBER_UNCOVERED', 'negativeControlsPass'), false, 'each member HAS its own control')
  // PR B2 (2026-11-20) reproduced ALL SIXTEEN vectors on the new path, read_image
  // included, and deleted the declared-pending channel. So the reproduction axes are
  // complete for every member and the row is now refused for ONE reason only: the two
  // blocking semantic differences still have no owner approval. This arm asserts the
  // completeness POSITIVELY (every member reproduced) and the refusal NARROWLY (exactly
  // one code), so a future regression that quietly drops a member cannot hide inside a
  // still-refused row.
  assert.deepEqual(verdict.coverage.newPathVerified, ['read', 'write', 'edit', 'read_image'], 'every member is reproduced on the new path')
  assert.equal(hasFinding(verdict, 'UTE_MEMBER_UNCOVERED', 'newPathVerified'), false, 'no member is uncovered on the new path')
  assert.ok(codes(verdict).includes('UTE_VECTOR_UNREPRODUCED') === false, 'no baseline vector is unreproduced')
  assert.deepEqual([...new Set(codes(verdict))], ['UTE_SEMANTIC_DIFFERENCES_UNRESOLVED'], 'the ONLY remaining refusal is the unapproved difference')
  assert.equal(verdict.unit.members.length, verdict.coverage.newPathVerified.length, 'the unit is 4/4: every member of the census unit is reproduced')
  assert.ok(codes(verdict).includes('UTE_SEMANTIC_DIFFERENCES_UNRESOLVED'))
  assert.ok(codes(verdict).includes('UTE_OLD_BASELINE_MISSING') === false, 'the old baseline IS established for all four members')
  assert.ok(codes(verdict).includes('UTE_NEW_PATH_UNVERIFIED') === false, 'the prototype path IS verified for the ten recorded vectors')
  assert.ok(codes(verdict).includes('UTE_NEGATIVE_CONTROLS_FAILING') === false, 'the FS negative controls DO pass at family level')

  // A fabricated coverage sentence must move nothing: the gate reads the TSV's
  // `entry` column, not the row's prose. This is the review finding verbatim.
  const fabricated = JSON.parse(JSON.stringify(loaded.ledger))
  const row = fabricated.families.find((f) => f.family === 'fs')
  row.note = `${row.note} UNIT-MEMBER read_image covered; UNIT-MEMBER newPathVerified PASS; UNIT-MEMBER negativeControlsPass PASS`
  row.unit.selfAssertedCoverage = ['read', 'write', 'edit', 'read_image']
  row.coverage = { oldBaseline: 4, newPathVerified: 4, negativeControlsPass: 4 }
  const after = checkRetirement({ ledger: fabricated, family: 'fs', root: ROOT })
  assert.equal(after.allowed, false)
  const signature = (v) => v.findings.map((f) => `${f.code}@${f.term ?? '-'}`).sort().join(';')
  assert.equal(signature(after), signature(verdict), 'a fabricated UNIT-MEMBER claim must not change the verdict')
  console.log(`UTE-MUTATION id=REAL mutation=${JSON.stringify(`seeded ${LEDGER_REL} row fs with a fabricated UNIT-MEMBER coverage note`)} expected=REFUSED:UTE_MEMBER_UNCOVERED,UTE_SEMANTIC_DIFFERENCES_UNRESOLVED observed=${codes(after).join(',')} recovered=same verdict as the honest row`)
})

// ─── unit controls ──────────────────────────────────────────────────────────

control('UNIT-1', 'no `unit` block at all', 'UTE_UNIT_UNDECLARED', (l) => {
  delete l.families[0].unit
})

control('UNIT-2', 'unit.familyId names a family the census does not book', 'UTE_UNIT_UNKNOWN_FAMILY', (l) => {
  l.families[0].unit.familyId = 'dsh.no-such-family'
})

control('UNIT-3', 'declared unit drops read_image (the review finding shape)', 'UTE_UNIT_UNDERCLAIMED', (l) => {
  l.families[0].unit.members = ['read', 'write', 'edit']
})

control('UNIT-4', 'declared unit adds a tool the census does not book', 'UTE_UNIT_OVERCLAIMED', (l) => {
  l.families[0].unit.members = ['read', 'write', 'edit', 'read_image', 'bash']
})

test('UNIT-5 — a missing or unparseable census fails closed (the unit cannot be invented)', () => {
  const { root: repo, sha } = makeFixtureRepo()
  const censusRel = join(repo, 'dev', 'agent-workflow', 'ledgers', 'arc-a-family-census.json')
  try {
    // Unparseable but committed: a broken booking must not license anything.
    writeFileSync(censusRel, '{ not json\n')
    execFileSync('git', ['-C', repo, 'add', '-A'])
    execFileSync('git', ['-C', repo, 'commit', '-qm', 'fixture: broken census'])
    const v1 = checkRetirement({ ledger: goodLedger(sha), family: 'synthetic-fs', root: repo })
    assert.equal(v1.allowed, false)
    assert.ok(codes(v1).includes('UTE_UNIT_UNGRADABLE'), `expected UTE_UNIT_UNGRADABLE, got ${JSON.stringify(codes(v1))}`)

    // Deleted from the working tree: "unbooked" is not "a smaller unit".
    rmSync(censusRel)
    const v2 = checkRetirement({ ledger: goodLedger(sha), family: 'synthetic-fs', root: repo })
    assert.equal(v2.allowed, false)
    assert.ok(codes(v2).includes('UTE_UNIT_UNGRADABLE'))
    transcript('UNIT-5', 'census rewritten as invalid JSON / deleted from the tree', 'REFUSED:UTE_UNIT_UNGRADABLE', [...new Set([...codes(v1), ...codes(v2)])], 'ALLOWED (valid committed census)')
  } finally {
    rmSync(repo, { recursive: true, force: true })
  }
})

// ─── coverage controls ──────────────────────────────────────────────────────

test('COV-1 — a baseline TSV without `id` or `entry` is UNGRADABLE (never guessed)', () => {
  const { root: repo, sha } = makeFixtureRepo()
  try {
    for (const bad of ['evidence/bad-entry.tsv', 'evidence/bad-id.tsv']) {
      const ledger = goodLedger(sha)
      ledger.families[0].terms.oldBaseline.evidence.path = bad
      const v = checkRetirement({ ledger, family: 'synthetic-fs', root: repo })
      assert.equal(v.allowed, false)
      assert.ok(codes(v).includes('UTE_UNIT_UNGRADABLE'), `${bad}: expected UTE_UNIT_UNGRADABLE, got ${JSON.stringify(codes(v))}`)
    }
    transcript('COV-1', 'baseline header `id|verdict` (no entry) and `vector|entry` (no id)', 'REFUSED:UTE_UNIT_UNGRADABLE', ['UTE_UNIT_UNGRADABLE'], 'ALLOWED (header has id and entry)')
  } finally {
    rmSync(repo, { recursive: true, force: true })
  }
})

test('COV-2 — read_image with no baseline vector is UTE_MEMBER_UNCOVERED on oldBaseline and newPathVerified', () => {
  const { root: repo, sha } = makeFixtureRepo()
  try {
    const ledger = goodLedger(sha)
    ledger.families[0].terms.oldBaseline.evidence.path = 'evidence/old-no-image.tsv'
    ledger.families[0].state = 'NOT_RETIREABLE'
    const v = checkRetirement({ ledger, family: 'synthetic-fs', root: repo })
    assert.equal(v.allowed, false)
    assert.ok(hasFinding(v, 'UTE_MEMBER_UNCOVERED', 'oldBaseline'))
    assert.ok(v.findings.some((f) => f.code === 'UTE_MEMBER_UNCOVERED' && f.term === 'oldBaseline' && f.detail.includes('read_image')))
    assert.ok(hasFinding(v, 'UTE_MEMBER_UNCOVERED', 'newPathVerified'))
    assert.equal(v.terms.oldBaseline, false, 'a term whose unit was not measured is NOT established')
    assert.equal(v.terms.newPathVerified, false)
    transcript('COV-2', 'baseline TSV covers read/write/edit but has no read_image row', 'REFUSED:UTE_MEMBER_UNCOVERED', codes(v), 'ALLOWED (four-member baseline)')
  } finally {
    rmSync(repo, { recursive: true, force: true })
  }
})

test('COV-3 — a ledger note claiming "read_image covered" is inert (coverage is measured)', () => {
  const { root: repo, sha } = makeFixtureRepo()
  try {
    const honest = goodLedger(sha)
    honest.families[0].terms.oldBaseline.evidence.path = 'evidence/old-no-image.tsv'
    honest.families[0].state = 'NOT_RETIREABLE'
    const before = checkRetirement({ ledger: honest, family: 'synthetic-fs', root: repo })

    const fabricated = JSON.parse(JSON.stringify(honest))
    fabricated.families[0].note = 'UNIT-MEMBER read_image covered / oleBaseline full'
    fabricated.families[0].unit.selfAssertedCoverage = ['read', 'write', 'edit', 'read_image']
    const after = checkRetirement({ ledger: fabricated, family: 'synthetic-fs', root: repo })
    assert.equal(after.allowed, false)
    const signature = (v) => v.findings.map((f) => `${f.code}@${f.term ?? '-'}`).sort().join(';')
    assert.equal(signature(after), signature(before), 'a fabricated coverage note must not change the findings')
    assert.ok(hasFinding(after, 'UTE_MEMBER_UNCOVERED', 'oldBaseline'))
    transcript('COV-3', 'ledger note + selfAssertedCoverage name read_image, baseline has no vector', 'REFUSED:UTE_MEMBER_UNCOVERED', codes(after), 'ALLOWED (real read_image vector)')
  } finally {
    rmSync(repo, { recursive: true, force: true })
  }
})

test('COV-4 — a baseline vector the new path did not reproduce is UTE_VECTOR_UNREPRODUCED', () => {
  const { root: repo, sha } = makeFixtureRepo()
  try {
    const missing = goodLedger(sha)
    missing.families[0].terms.newPathVerified.evidence.path = 'evidence/new-missing.txt'
    missing.families[0].state = 'NOT_RETIREABLE'
    const v1 = checkRetirement({ ledger: missing, family: 'synthetic-fs', root: repo })
    assert.equal(v1.allowed, false)
    assert.ok(codes(v1).includes('UTE_VECTOR_UNREPRODUCED'))
    assert.ok(v1.findings.some((f) => f.code === 'UTE_VECTOR_UNREPRODUCED' && f.detail.includes('FS-4-image')))

    // A vector present but marked FAIL does not satisfy the literal PASS token.
    writeFileSync(join(repo, 'evidence', 'new-fail.txt'), 'NEW-PATH-VECTOR FS-1-read FAIL\n')
    const failed = goodLedger(sha)
    failed.families[0].terms.newPathVerified.evidence.path = 'evidence/new-fail.txt'
    failed.families[0].state = 'NOT_RETIREABLE'
    const v2 = checkRetirement({ ledger: failed, family: 'synthetic-fs', root: repo })
    assert.ok(codes(v2).includes('UTE_VECTOR_UNREPRODUCED'))
    transcript('COV-4', 'new-path transcript omits FS-4-image / marks FS-1-read FAIL', 'REFUSED:UTE_VECTOR_UNREPRODUCED', [...new Set([...codes(v1), ...codes(v2)])], 'ALLOWED (all four PASS lines)')
  } finally {
    rmSync(repo, { recursive: true, force: true })
  }
})

test('COV-5 — a member with baseline evidence but no NC-MEMBER control is uncovered', () => {
  const { root: repo, sha } = makeFixtureRepo()
  try {
    const ledger = goodLedger(sha)
    ledger.families[0].terms.negativeControlsPass.evidence.path = 'evidence/nc-no-image.txt'
    ledger.families[0].state = 'NOT_RETIREABLE'
    const v = checkRetirement({ ledger, family: 'synthetic-fs', root: repo })
    assert.equal(v.allowed, false)
    assert.ok(hasFinding(v, 'UTE_MEMBER_UNCOVERED', 'negativeControlsPass'))
    assert.ok(v.findings.some((f) => f.code === 'UTE_MEMBER_UNCOVERED' && f.term === 'negativeControlsPass' && f.detail.includes('read_image')))
    assert.equal(v.terms.negativeControlsPass, false)
    transcript('COV-5', 'NC transcript has no `NC-MEMBER read_image` line', 'REFUSED:UTE_MEMBER_UNCOVERED', codes(v), 'ALLOWED (one NC-MEMBER line per covered member)')
  } finally {
    rmSync(repo, { recursive: true, force: true })
  }
})

// ─── approval binding controls ──────────────────────────────────────────────

test('APPR-1 — an approval with by/on/record but no reference is UNREFERENCED', () => {
  const { root: repo, sha } = makeFixtureRepo()
  try {
    const ledger = goodLedger(sha)
    delete ledger.families[0].terms.semanticDifferencesResolved.differences[0].approval.reference
    const v = checkRetirement({ ledger, family: 'synthetic-fs', root: repo })
    assert.equal(v.allowed, false)
    assert.ok(codes(v).includes('UTE_APPROVAL_UNREFERENCED'))
    assert.equal(v.terms.semanticDifferencesResolved, false)

    const malformed = goodLedger(sha)
    malformed.families[0].terms.semanticDifferencesResolved.differences[0].approval.reference = 'PR #1 @ deadbeef'
    const v2 = checkRetirement({ ledger: malformed, family: 'synthetic-fs', root: repo })
    assert.ok(codes(v2).includes('UTE_APPROVAL_UNREFERENCED'))
    transcript('APPR-1', 'approval reference absent; and "PR #1 @ deadbeef"', 'REFUSED:UTE_APPROVAL_UNREFERENCED', [...new Set([...codes(v), ...codes(v2)])], 'ALLOWED (bound 40-hex)')
  } finally {
    rmSync(repo, { recursive: true, force: true })
  }
})

test('APPR-2 — a 40-hex that does not exist in the repository is UNREFERENCED', () => {
  const { root: repo, sha } = makeFixtureRepo()
  try {
    const ledger = goodLedger(sha)
    ledger.families[0].terms.semanticDifferencesResolved.differences[0].approval.reference = `PR #1 @ ${'0'.repeat(40)}`
    const v = checkRetirement({ ledger, family: 'synthetic-fs', root: repo })
    assert.equal(v.allowed, false)
    assert.ok(codes(v).includes('UTE_APPROVAL_UNREFERENCED'))
    assert.match(v.findings.find((f) => f.code === 'UTE_APPROVAL_UNREFERENCED').detail, /does not exist/)
    transcript('APPR-2', 'reference to 000…0 (no such commit)', 'REFUSED:UTE_APPROVAL_UNREFERENCED', codes(v), 'ALLOWED (the fixture commit sha)')
  } finally {
    rmSync(repo, { recursive: true, force: true })
  }
})

test('APPR-3 — a commit that exists but is not an ancestor of HEAD is UNREFERENCED', () => {
  const { root: repo, sha } = makeFixtureRepo()
  try {
    const ledger = goodLedger(sha)
    const v = checkRetirement({ ledger, family: 'synthetic-fs', root: repo, isAncestor: () => false })
    assert.equal(v.allowed, false)
    assert.ok(codes(v).includes('UTE_APPROVAL_UNREFERENCED'))
    assert.match(v.findings.find((f) => f.code === 'UTE_APPROVAL_UNREFERENCED').detail, /not an ancestor/)
    // The same row is allowed when the injected ancestry holds, so the refusal
    // is the ancestry rule and not the fixture.
    assert.equal(checkRetirement({ ledger: goodLedger(sha), family: 'synthetic-fs', root: repo, isAncestor: () => true }).allowed, true)
    transcript('APPR-3', 'injected isAncestor()=false for the bound commit', 'REFUSED:UTE_APPROVAL_UNREFERENCED', codes(v), 'ALLOWED (ancestor)')
  } finally {
    rmSync(repo, { recursive: true, force: true })
  }
})

// ─── old-path deletion controls ─────────────────────────────────────────────

test('OP-1 — a declared old-path file absent while the row is not allowed is PARTIALLY_REMOVED', () => {
  const { root: repo, sha } = makeFixtureRepo()
  try {
    const ledger = goodLedger(sha)
    ledger.families[0].oldPath.files = ['src/keep.mjs', 'src/gone.mjs']
    ledger.families[0].terms.negativeControlsPass.verdict = false
    ledger.families[0].state = 'NOT_RETIREABLE'
    const v = checkRetirement({ ledger, family: 'synthetic-fs', root: repo })
    assert.equal(v.allowed, false)
    assert.ok(codes(v).includes('UTE_OLD_PATH_PARTIALLY_REMOVED'))
    assert.ok(v.findings.some((f) => f.code === 'UTE_OLD_PATH_PARTIALLY_REMOVED' && f.detail.includes('src/gone.mjs')))
    transcript('OP-1', 'src/gone.mjs deleted from the tree while negativeControlsPass fails', 'REFUSED:UTE_OLD_PATH_PARTIALLY_REMOVED', codes(v), 'row still not allowed, file present → no old-path finding')
  } finally {
    rmSync(repo, { recursive: true, force: true })
  }
})

test('OP-2 — the same absence while the row is ALLOWED is retirement, not a finding', () => {
  const { root: repo, sha } = makeFixtureRepo()
  try {
    const ledger = goodLedger(sha)
    ledger.families[0].oldPath.files = ['src/keep.mjs', 'src/gone.mjs']
    const v = checkRetirement({ ledger, family: 'synthetic-fs', root: repo })
    assert.equal(v.allowed, true, `an allowed row may delete its old path: ${JSON.stringify(codes(v))}`)
    assert.equal(codes(v).includes('UTE_OLD_PATH_PARTIALLY_REMOVED'), false)
    transcript('OP-2', 'src/gone.mjs absent while the row is allowed', 'ALLOWED', codes(v), 'ALLOWED (retirement is the expected absence)')
  } finally {
    rmSync(repo, { recursive: true, force: true })
  }
})

control('OP-3', 'no `oldPath` block at all', 'UTE_OLD_PATH_UNDECLARED', (l) => {
  delete l.families[0].oldPath
})

// ─── CLI ────────────────────────────────────────────────────────────────────

test('CLI — --family fs exits 1 and prints JSON; --all never hides a refusal', () => {
  const run = (args) => {
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
  assert.deepEqual(payload.refused[0].codes, ['UTE_SEMANTIC_DIFFERENCES_UNRESOLVED'], 'the CLI reports exactly one remaining refusal for fs')
  assert.deepEqual(payload.refused[0].unit.members, ['read', 'write', 'edit', 'read_image'])
  assert.deepEqual(payload.refused[0].coverage.oldBaseline, ['read', 'write', 'edit', 'read_image'])
  assert.deepEqual(payload.refused[0].coverage.negativeControlsPass, ['read', 'write', 'edit', 'read_image'])
  assert.deepEqual(payload.refused[0].coverage.newPathVerified, ['read', 'write', 'edit', 'read_image'])
  assert.equal(payload.verdicts[0].allowed, false)

  // `--all` now grades FIVE seeded families (fs + search + web + inspect +
  // agent-control). The SEARCH row (UTE-3 PR B1) moved this from `requested=1`
  // to `requested=2`, the WEB row to `requested=3`, the INSPECT row (single-
  // implementation proof) to `requested=4`, and the AGENT-CONTROL row (seven
  // dual implementations, full baseline) to `requested=5`, so the arm pins the
  // NEW seeded state EXACTLY — and derives the summary's counts from the printed
  // `UTE-RETIREMENT-REFUSED` lines instead of trusting the constant, so a sixth
  // family added to the ledger can never be absorbed silently by a stale number
  // here. Changing a family or its code list means updating THIS arm: silence
  // is not an option, and a looser match would be the regression.
  const all = run(['--all'])
  assert.equal(all.status, 1)
  const refusedLines = all.stdout.split('\n').filter((line) => line.startsWith('UTE-RETIREMENT-REFUSED family='))
  assert.deepEqual(
    refusedLines.map((line) => line.match(/family=(\S+)/u)[1]).sort(),
    ['agent-control', 'fs', 'inspect', 'search', 'web'],
    `--all must refuse exactly the seeded families; it refused ${JSON.stringify(refusedLines.length)}`,
  )
  const codesFor = (family) => {
    const line = refusedLines.find((candidate) => candidate.startsWith(`UTE-RETIREMENT-REFUSED family=${family} `))
    assert.ok(line !== undefined, `no UTE-RETIREMENT-REFUSED line for family=${family}`)
    const match = line.match(/ codes=(\S+) state=/u)
    assert.ok(match !== null, `family=${family} line carries no code list: ${line}`)
    assert.match(line, / unit=(?:\d+\/\d+)$/u, `family=${family} line carries no unit strip: ${line}`)
    return { line, codes: match[1].split(',').sort() }
  }
  // Findings are printed under their family's refusal line without repeating
  // the family name, so the scoped assertions below read ONE family's block.
  const blockFor = (family) => {
    const lines = all.stdout.split('\n')
    const start = lines.findIndex((line) => line.startsWith(`UTE-RETIREMENT-REFUSED family=${family} `))
    assert.ok(start >= 0, `no refusal block for family=${family}`)
    const end = lines.findIndex((line, index) => index > start
      && (line.startsWith('UTE-RETIREMENT-REFUSED ') || line.startsWith('UTE-RETIREMENT-SUMMARY')))
    return lines.slice(start, end === -1 ? undefined : end).join('\n')
  }
  // fs — PR B2 reproduced all sixteen vectors, so the coverage axes are complete and the
  // ONLY remaining refusal is the unapproved difference. Asserted as an exact set: a
  // regression that drops a member would add a code and red here rather than hide inside
  // a still-refused row.
  const fs = codesFor('fs')
  assert.deepEqual(fs.codes, ['UTE_SEMANTIC_DIFFERENCES_UNRESOLVED'])
  assert.match(fs.line, /state=NOT_RETIREABLE unit=4\/4$/u)
  // The SEARCH row legitimately still reports both codes (it has no new path at all), so
  // the assertion is scoped to FS evidence: a finding that names an FS vector or the
  // read_image member is what must be gone. Scoping by family beats dropping the check —
  // an unscoped `includes` would either be false for the right reason or pass vacuously.
  const fsFindings = all.stdout.split('\n').filter((line) => line.includes('FS-') || line.includes('read_image'))
  assert.equal(
    fsFindings.some((line) => line.includes('UTE_VECTOR_UNREPRODUCED') || line.includes('term=newPathVerified')),
    false,
    `no FS evidence is unreproduced any more: ${JSON.stringify(fsFindings)}`,
  )
  // search — UTE-3 PR B2 reproduced all fifteen vectors on the pinned rc.5 host,
  // so the new-path axis and BOTH members are covered and the ONLY remaining
  // refusal is the unapproved difference. Asserted as an exact set: a regression
  // that drops a vector or a member would add a code and red here instead of
  // hiding inside a still-refused row.
  const search = codesFor('search')
  assert.deepEqual(search.codes, ['UTE_SEMANTIC_DIFFERENCES_UNRESOLVED'])
  assert.match(search.line, /state=NOT_RETIREABLE unit=2\/2$/u)
  // The new-path axis must produce NO finding at all now: no unreproduced vector
  // and no uncovered member. Scoping the assertion to the term is what keeps it
  // biting (a still-uncovered unit would print exactly these two codes).
  // WEB legitimately still reports both codes (it has no new path at all), so a
  // stdout-wide `includes` check would be wrong in both directions. Grade the
  // structured verdict instead: per family, the code list IS the statement.
  const asJson = JSON.parse(run(['--all', '--json']).stdout)
  const codesIn = (family) => (asJson.refused.find((row) => row.family === family) ?? { codes: [] }).codes
  assert.deepEqual(codesIn('fs'), ['UTE_SEMANTIC_DIFFERENCES_UNRESOLVED'], 'fs: only the unapproved difference remains')
  assert.deepEqual(codesIn('search'), ['UTE_SEMANTIC_DIFFERENCES_UNRESOLVED'], 'search: only the unapproved difference remains')
  assert.match(all.stdout, /term=semanticDifferencesResolved[^\n]*SD-SEARCH-1-grep-path-default/)
  assert.match(all.stdout, /term=semanticDifferencesResolved[^\n]*SD-SEARCH-2-grep-vcs-ignore/)
  assert.match(all.stdout, /term=semanticDifferencesResolved[^\n]*SD-SEARCH-3-refusal-surface/)
  // web — its OWN code list, asserted as an exact set. WEB has an old-path
  // baseline and per-member controls, so its refusal may NOT look like SEARCH's
  // predecessor "nothing measured yet": the codes are the two coverage axes it
  // genuinely lacks (no new path at all) plus the three unapproved blocking
  // differences. A regression that dropped a member, a vector or a difference
  // changes this set and reds here.
  const web = codesFor('web')
  assert.deepEqual(web.codes, ['UTE_MEMBER_UNCOVERED', 'UTE_NEW_PATH_UNVERIFIED', 'UTE_SEMANTIC_DIFFERENCES_UNRESOLVED', 'UTE_VECTOR_UNREPRODUCED'])
  assert.match(web.line, /state=NOT_RETIREABLE unit=0\/2$/u)
  // The baseline term must be ESTABLISHED for web (it is not one of the codes):
  // an UTE_MEMBER_UNCOVERED on the oldBaseline axis would mean the golden lost a
  // member, and that is exactly the FS `read_image` failure mode.
  assert.equal(web.line.includes('UTE_OLD_PATH_UNDECLARED') || web.line.includes('UTE_UNIT_UNDECLARED'), false)
  assert.match(all.stdout, /term=newPathVerified[^\n]*member \S*web_fetch/)
  assert.match(all.stdout, /term=newPathVerified[^\n]*member \S*web_search/)
  assert.match(all.stdout, /UTE_VECTOR_UNREPRODUCED[^\n]*WB-F11-destination-forbidden/)
  assert.match(all.stdout, /UTE_VECTOR_UNREPRODUCED[^\n]*WB-S3-search-unavailable/)
  assert.match(all.stdout, /term=semanticDifferencesResolved[^\n]*SD-WEB-1-native-name-claim-collision/)
  assert.match(all.stdout, /term=semanticDifferencesResolved[^\n]*SD-WEB-2-redirect-ownership/)
  assert.match(all.stdout, /term=semanticDifferencesResolved[^\n]*SD-WEB-3-refusal-surface/)
  // No WEB finding may consume the baseline axis or the controls axis: those two
  // are the terms this stage establishes, and a finding there is a REGRESSION
  // hidden inside a still-refused row.
  const webFindings = all.stdout.split('\n').filter((line) => line.includes('WB-') && line.startsWith('  UTE-RETIREMENT-FINDING'))
  assert.equal(
    webFindings.some((line) => line.includes('term=oldBaseline') || line.includes('term=negativeControlsPass')),
    false,
    `the web baseline/control axes must stay established: ${JSON.stringify(webFindings.filter((line) => line.includes('term=oldBaseline') || line.includes('term=negativeControlsPass')))}`,
  )
  // inspect — UTE-3 B1 measured, in its Stage-0 probe, that each booked member
  // has EXACTLY ONE implementation (the governed family body) and that the
  // native/service side serves the capability under DIFFERENT names. No baseline
  // effect table and no new path exist, so every term is false. The exact set is
  // pinned: OLD_BASELINE_MISSING (the required refusal), NEW_PATH_UNVERIFIED,
  // SEMANTIC_DIFFERENCES_UNRESOLVED (the alias→native name change, approval
  // null), NEGATIVE_CONTROLS_FAILING, and UTE_UNIT_UNGRADABLE because the
  // evidence pointer is the non-retirement record, not a parseable baseline TSV
  // (there is no corpus to parse; that is the measured shape, not a schema bug).
  const inspect = codesFor('inspect')
  assert.deepEqual(inspect.codes, [
    'UTE_NEGATIVE_CONTROLS_FAILING',
    'UTE_NEW_PATH_UNVERIFIED',
    'UTE_OLD_BASELINE_MISSING',
    'UTE_SEMANTIC_DIFFERENCES_UNRESOLVED',
    'UTE_UNIT_UNGRADABLE',
  ])
  assert.match(inspect.line, /state=NOT_RETIREABLE unit=0\/3$/u)
  const inspectBlock = blockFor('inspect')
  assert.match(inspectBlock, /term=semanticDifferencesResolved[^\n]*alias-to-native-name-change/)
  assert.match(inspectBlock, /code=UTE_OLD_BASELINE_MISSING term=oldBaseline/u)
  // agent-control — UTE-3 B1 measured SEVEN dual implementations (Stage-0
  // probe: 7 two-implementation / 0 single), so this family gets a REAL 42-vector
  // baseline and 24 controls, and is refused for the two axes it genuinely
  // lacks: no confined new path at B1 (every vector unreproduced, every member
  // uncovered on that axis) and three unapproved blocking differences. The exact
  // set is pinned so a dropped member or a fabricated new-path token reds here.
  const agentctl = codesFor('agent-control')
  assert.deepEqual(agentctl.codes, [
    'UTE_MEMBER_UNCOVERED',
    'UTE_NEW_PATH_UNVERIFIED',
    'UTE_SEMANTIC_DIFFERENCES_UNRESOLVED',
    'UTE_VECTOR_UNREPRODUCED',
  ])
  assert.match(agentctl.line, /state=NOT_RETIREABLE unit=0\/7$/u)
  const agentctlBlock = blockFor('agent-control')
  assert.match(agentctlBlock, /term=semanticDifferencesResolved[^\n]*SD-AGENTCTL-1-route-c-unserved/u)
  assert.match(agentctlBlock, /term=semanticDifferencesResolved[^\n]*SD-AGENTCTL-2-native-name-claim-not-graded/u)
  assert.match(agentctlBlock, /term=semanticDifferencesResolved[^\n]*SD-AGENTCTL-3-governed-admission-surface/u)
  assert.match(agentctlBlock, /term=newPathVerified[^\n]*member \S*workflow/u)
  // The baseline and control axes must stay ESTABLISHED for agent-control: a
  // finding on either axis would mean the 42-vector baseline or the per-member
  // controls regressed while the row still looked refused.
  const agentctlFindings = agentctlBlock.split('\n').filter((line) => line.startsWith('  UTE-RETIREMENT-FINDING'))
  assert.equal(
    agentctlFindings.some((line) => line.includes('term=oldBaseline') || line.includes('term=negativeControlsPass')),
    false,
    `the agent-control baseline/control axes must stay established: ${JSON.stringify(agentctlFindings.filter((line) => line.includes('term=oldBaseline') || line.includes('term=negativeControlsPass')))}`,
  )
  // the summary is DERIVED from the printed refusals, never a constant.
  const summary = all.stdout.match(/UTE-RETIREMENT-SUMMARY requested=(\d+) allowed=(\d+) refused=(\d+)/u)
  assert.ok(summary !== null, 'the summary line is absent')
  assert.equal(Number(summary[1]), refusedLines.length, 'requested must equal the number of printed refusals')
  assert.equal(Number(summary[3]), refusedLines.length, 'refused must equal the number of printed refusals')
  assert.equal(Number(summary[2]), 0, 'no seeded family may be allowed')
  assert.match(all.stdout, /UTE-RETIREMENT-SUMMARY requested=5 allowed=0 refused=5/)

  const unknown = run(['--family', 'mcp'])
  assert.equal(unknown.status, 1)
  assert.match(unknown.stdout, /UTE_LEDGER_UNKNOWN_FAMILY/)
})

test('CLI — a committed, fully satisfied synthetic family is ALLOWED (exit 0)', () => {
  // scripts/fixtures/ute-retirement-selftest/** is committed on purpose: this
  // is the "the gate can say yes" arm of the CLI contract, with evidence a cold
  // clone can actually read (the UNIT controls above use a throwaway repo). Its
  // approval references a real ancestor commit, so the reference binding is
  // exercised against this repository, not an injected stub.
  const out = execFileSync(
    process.execPath,
    ['scripts/ute-retirement-gate.mjs', '--family', 'synthetic-selftest', '--ledger', 'scripts/fixtures/ute-retirement-selftest/ledger.json'],
    { cwd: ROOT, encoding: 'utf8' },
  )
  assert.match(out, /UTE-RETIREMENT-ALLOW family=synthetic-selftest terms=4\/4 unit=1\/1 state=RETIREABLE/)
  assert.match(out, /UTE-RETIREMENT-SUMMARY requested=1 allowed=1 refused=0/)
  console.log('UTE-MUTATION id=CLI-ALLOW mutation="none (committed synthetic fixture, unit fully covered, approval bound to a real ancestor)" expected=ALLOWED observed=ALLOWED recovered=ALLOWED')
})

// ─── mutation lines ─────────────────────────────────────────────────────────
/**
 * Each entry removes ONE new rule from a copy of the module and stages the input
 * that rule refuses. `probe` returns true when the mutated module FAILS to refuse
 * (i.e. the control went RED). A probe that throws also counts as RED: removing
 * a guard may crash, and a crash is not a green.
 */
const MUTANTS = [
  {
    id: 'M1', rule: 'UTE_UNIT_UNDECLARED',
    from: "if (typeof familyId !== 'string' || familyId.length === 0) {", to: 'if (false) {',
    probe: ({ gate, root, sha }) => !codes(gate.checkRetirement({ ledger: (() => { const l = goodLedger(sha); delete l.families[0].unit; return l })(), family: 'synthetic-fs', root })).includes('UTE_UNIT_UNDECLARED'),
  },
  {
    id: 'M2', rule: 'UTE_UNIT_UNKNOWN_FAMILY',
    from: "const entry = book.families.find((f) => f !== null && typeof f === 'object' && f.familyId === familyId)",
    to: "const entry = book.families.find((f) => f !== null && typeof f === 'object' && (familyId !== undefined || f.familyId === familyId))",
    probe: ({ gate, root, sha }) => !codes(gate.checkRetirement({ ledger: (() => { const l = goodLedger(sha); l.families[0].unit.familyId = 'dsh.no-such-family'; return l })(), family: 'synthetic-fs', root })).includes('UTE_UNIT_UNKNOWN_FAMILY'),
  },
  {
    id: 'M3', rule: 'UTE_UNIT_UNDERCLAIMED',
    // Scoped to the unit comparison: `if (missing.length > 0)` also guards the
    // evidence-token check, and mutating that one would stage the wrong rule.
    from: "      if (missing.length > 0) {\n        findings.push({\n          code: 'UTE_UNIT_UNDERCLAIMED',",
    to: "      if (false) {\n        findings.push({\n          code: 'UTE_UNIT_UNDERCLAIMED',",
    probe: ({ gate, root, sha }) => !codes(gate.checkRetirement({ ledger: (() => { const l = goodLedger(sha); l.families[0].unit.members = ['read', 'write', 'edit']; return l })(), family: 'synthetic-fs', root })).includes('UTE_UNIT_UNDERCLAIMED'),
  },
  {
    id: 'M4', rule: 'UTE_UNIT_OVERCLAIMED',
    from: 'if (extra.length > 0) {', to: 'if (false) {',
    probe: ({ gate, root, sha }) => !codes(gate.checkRetirement({ ledger: (() => { const l = goodLedger(sha); l.families[0].unit.members = ['read', 'write', 'edit', 'read_image', 'bash']; return l })(), family: 'synthetic-fs', root })).includes('UTE_UNIT_OVERCLAIMED'),
  },
  {
    id: 'M5', rule: 'UTE_UNIT_UNGRADABLE (baseline header)',
    from: "const entryIndex = header.indexOf('entry')",
    to: "const entryIndex = header.indexOf('entry') === -1 ? 0 : header.indexOf('entry')",
    probe: ({ gate, root, sha }) => !codes(gate.checkRetirement({ ledger: (() => { const l = goodLedger(sha); l.families[0].terms.oldBaseline.evidence.path = 'evidence/bad-entry.tsv'; return l })(), family: 'synthetic-fs', root })).includes('UTE_UNIT_UNGRADABLE'),
  },
  {
    id: 'M6', rule: 'UTE_MEMBER_UNCOVERED (oldBaseline)',
    from: 'if (baselineEntries.has(member))', to: 'if (true)',
    probe: ({ gate, root, sha }) => !hasFinding(gate.checkRetirement({ ledger: (() => { const l = goodLedger(sha); l.families[0].terms.oldBaseline.evidence.path = 'evidence/old-no-image.tsv'; l.families[0].state = 'NOT_RETIREABLE'; return l })(), family: 'synthetic-fs', root }), 'UTE_MEMBER_UNCOVERED', 'oldBaseline'),
  },
  {
    id: 'M7', rule: 'UTE_VECTOR_UNREPRODUCED',
    from: 'if (newPath.text.includes(token)) reproduced.add(vector.id)', to: 'if (true) reproduced.add(vector.id)',
    probe: ({ gate, root, sha }) => !codes(gate.checkRetirement({ ledger: (() => { const l = goodLedger(sha); l.families[0].terms.newPathVerified.evidence.path = 'evidence/new-missing.txt'; l.families[0].state = 'NOT_RETIREABLE'; return l })(), family: 'synthetic-fs', root })).includes('UTE_VECTOR_UNREPRODUCED'),
  },
  {
    id: 'M8', rule: 'UTE_MEMBER_UNCOVERED (newPathVerified)',
    from: 'if (mine.some((v) => reproduced.has(v.id))) coverage.newPathVerified.push(member)', to: 'if (true) coverage.newPathVerified.push(member)',
    probe: ({ gate, root, sha }) => !hasFinding(gate.checkRetirement({ ledger: (() => { const l = goodLedger(sha); l.families[0].terms.oldBaseline.evidence.path = 'evidence/old-no-image.tsv'; l.families[0].state = 'NOT_RETIREABLE'; return l })(), family: 'synthetic-fs', root }), 'UTE_MEMBER_UNCOVERED', 'newPathVerified'),
  },
  {
    id: 'M9', rule: 'UTE_MEMBER_UNCOVERED (negativeControlsPass)',
    from: 'if (token.test(nc.text)) coverage.negativeControlsPass.push(member)', to: 'if (true) coverage.negativeControlsPass.push(member)',
    probe: ({ gate, root, sha }) => !hasFinding(gate.checkRetirement({ ledger: (() => { const l = goodLedger(sha); l.families[0].terms.negativeControlsPass.evidence.path = 'evidence/nc-no-image.txt'; l.families[0].state = 'NOT_RETIREABLE'; return l })(), family: 'synthetic-fs', root }), 'UTE_MEMBER_UNCOVERED', 'negativeControlsPass'),
  },
  {
    id: 'M10', rule: 'UTE_APPROVAL_UNREFERENCED (shape)',
    from: "const match = typeof reference === 'string' ? APPROVAL_REFERENCE.exec(reference) : null",
    to: (sha) => `const match = ['', '${sha}']`,
    probe: ({ gate, root, sha }) => !codes(gate.checkRetirement({ ledger: (() => { const l = goodLedger(sha); delete l.families[0].terms.semanticDifferencesResolved.differences[0].approval.reference; return l })(), family: 'synthetic-fs', root })).includes('UTE_APPROVAL_UNREFERENCED'),
  },
  {
    id: 'M11', rule: 'UTE_APPROVAL_UNREFERENCED (ancestry)',
    from: 'if (!exists || !ancestor) {', to: 'if (false) {',
    probe: ({ gate, root, sha }) => !codes(gate.checkRetirement({ ledger: goodLedger(sha), family: 'synthetic-fs', root, isAncestor: () => false })).includes('UTE_APPROVAL_UNREFERENCED'),
  },
  {
    id: 'M12', rule: 'UTE_OLD_PATH_UNDECLARED',
    from: 'if (!Array.isArray(files) || files.length === 0 || !files.every(safeRelPath)) {', to: 'if (false) {',
    probe: ({ gate, root, sha }) => !codes(gate.checkRetirement({ ledger: (() => { const l = goodLedger(sha); delete l.families[0].oldPath; return l })(), family: 'synthetic-fs', root })).includes('UTE_OLD_PATH_UNDECLARED'),
  },
  {
    id: 'M13', rule: 'UTE_OLD_PATH_PARTIALLY_REMOVED',
    from: 'if (missing.length > 0 && !allowed) {', to: 'if (false) {',
    probe: ({ gate, root, sha }) => !codes(gate.checkRetirement({ ledger: (() => { const l = goodLedger(sha); l.families[0].oldPath.files = ['src/keep.mjs', 'src/gone.mjs']; l.families[0].terms.negativeControlsPass.verdict = false; l.families[0].state = 'NOT_RETIREABLE'; return l })(), family: 'synthetic-fs', root })).includes('UTE_OLD_PATH_PARTIALLY_REMOVED'),
  },
  {
    id: 'M14', rule: 'coverage finding demotes its term',
    from: 'if (TERMS.includes(finding.term)) establishedByTerm[finding.term] = false', to: 'if (false) establishedByTerm[finding.term] = false',
    probe: ({ gate, root, sha }) => {
      const v = gate.checkRetirement({ ledger: (() => { const l = goodLedger(sha); l.families[0].terms.oldBaseline.evidence.path = 'evidence/old-no-image.tsv'; l.families[0].state = 'NOT_RETIREABLE'; return l })(), family: 'synthetic-fs', root })
      return v.terms?.oldBaseline === true
    },
  },
]

let mutantSeq = 0
async function loadMutant(from, to) {
  assert.ok(GATE_SRC.includes(from), `mutation does not apply — the guarded line changed: ${from}`)
  const mutated = GATE_SRC.replace(from, to)
  assert.notEqual(mutated, GATE_SRC, 'mutation must change the module')
  const dir = join(TMP_ROOT, 'mutants')
  mkdirSync(dir, { recursive: true })
  const file = join(dir, `gate-mutant-${String(++mutantSeq)}.mjs`)
  writeFileSync(file, mutated)
  return import(pathToFileURL(file).href)
}

test('MUTANTS — every new rule has a mutation that turns its control RED', async () => {
  const survivors = []
  for (const mutant of MUTANTS) {
    const { root, sha } = makeFixtureRepo()
    let red = false
    try {
      const replacement = typeof mutant.to === 'function' ? mutant.to(sha) : mutant.to
      const gate = await loadMutant(mutant.from, replacement)
      red = mutant.probe({ gate, root, sha }) === true
    } catch {
      // Removing a guard can crash the mutated module. A crash is RED (the
      // control no longer passes), never a green.
      red = true
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
    console.log(`UTE-MUTANT id=${mutant.id} rule=${JSON.stringify(mutant.rule)} mutation-applied=true control=${red ? 'RED' : 'STILL-GREEN'}`)
    if (!red) survivors.push(`${mutant.id}:${mutant.rule}`)
  }
  console.log(`UTE-RETIREMENT-GATE-MUTANTS total=${MUTANTS.length} red=${MUTANTS.length - survivors.length}`)
  assert.deepEqual(survivors, [], `mutants survived (their rule is not load-bearing): ${survivors.join(', ')}`)
})
