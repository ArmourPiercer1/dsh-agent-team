/**
 * refusal-categories.test.mjs — the proof obligations for the closed refusal
 * vocabulary adopted by the 2026-11-20 owner ruling (B+C route).
 *
 * WHAT MAKES THESE TESTS EVIDENCE RATHER THAN ASSERTIONS
 *   1. The corpus half is DERIVED: the legacy classes are read out of the
 *      committed golden TSV and the corpus source, and the native codes are
 *      extracted from the recorded evidence files. A new corpus value that the
 *      map does not know therefore turns this suite red (the
 *      `REFUSAL_VOCABULARY_INCOMPLETE` contract) instead of being absorbed.
 *   2. The last case is a REAL MUTATION run: four defects are injected into a
 *      facade of the real module and the same probes are re-run. The printed
 *      `REFUSAL-CATEGORY-MUTANTS total=N red=N` is computed from that run —
 *      there is no hand-written PASS anywhere in this file.
 *
 * Host-free: no boot, no port, no DSH_HOME. Plain `node --test`.
 *
 * @module tests/ute-g1-fs/lib/refusal-categories.test
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'

import { CORPUS } from './corpus.mjs'
import {
  CATEGORY_IDS,
  CORPUS_VOCABULARY_BASELINE,
  LEGACY_REFUSAL_MAP,
  NATIVE_FS_ERROR_MAP,
  REFUSAL_CATEGORIES,
  RefusalVocabularyError,
  assertCorpusVocabularyComplete,
  auditCorpus,
  categoryOfLegacyRefusal,
  categoryOfNativeFsError,
  compareRefusal,
  isNoRefusal,
  selfCheck,
} from './refusal-categories.mjs'

const ROOT = process.cwd()
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8')

// ─────────────────────────────────────────────────────────────────────────────
// The corpus is the source of truth for the legacy classes/codes. Derive them.
// ─────────────────────────────────────────────────────────────────────────────

/** @returns {{classes: string[], codes: string[]}} */
function goldenVocabulary() {
  const lines = read('tests/ute-g1-fs/golden/old-path.tsv').trimEnd().split('\n')
  const header = lines[0].split('\t')
  const refusalAt = header.indexOf('refusal')
  const codesAt = header.indexOf('codes')
  assert.notEqual(refusalAt, -1, 'the golden TSV must keep a `refusal` column')
  assert.notEqual(codesAt, -1, 'the golden TSV must keep a `codes` column')
  const classes = []
  const codes = []
  for (const line of lines.slice(1)) {
    const cells = line.split('\t')
    if (!isNoRefusal(cells[refusalAt])) classes.push(cells[refusalAt])
    if (!isNoRefusal(cells[codesAt])) codes.push(...cells[codesAt].split(','))
  }
  return { classes, codes }
}

/** The native codes the corpus/evidence actually RECORDS, extracted from it. */
function recordedNativeCodes() {
  const sources = [
    ['tests/ute-g1-fs/lib/prototype-provider.mjs', /\b(FS_[A-Z][A-Z0-9_]+)\b/g],
    ['tests/ute1-fs/lib/fake-host.mjs', /new FakeFsError\([^\n]*?'(FS_[A-Z][A-Z0-9_]+)'/g],
    ['tests/world-factory/lib/a5sf-fs-contract-world.mjs', /code:\s*'(FS_[A-Z][A-Z0-9_]+)'/g],
    ['tests/ute-g1-fs/golden/SEMANTIC-DIFFERENCES.md', /\b(FS_[A-Z][A-Z0-9_]+)\b/g],
    ['dev/agent-workflow/evidence/a5sf-fs-face/README.md', /\b(FS_[A-Z][A-Z0-9_]+)\b/g],
  ]
  const found = new Set()
  for (const [rel, pattern] of sources) {
    const text = read(rel)
    for (const match of text.matchAll(pattern)) found.add(match[1])
  }
  return [...found].sort()
}

/** Every legacy value the corpus records or claims (classes + codes + prose). */
function recordedLegacyValues() {
  const golden = goldenVocabulary()
  const claims = CORPUS.map((vector) => vector.expect?.refusal).filter((value) => !isNoRefusal(value))
  return [...new Set([...golden.classes, ...golden.codes, ...claims])]
}

const sorted = (values) => [...values].sort()

// ─────────────────────────────────────────────────────────────────────────────
// 1. the vocabulary's own integrity
// ─────────────────────────────────────────────────────────────────────────────

test('the vocabulary self-check passes: definitions, reachability, samples, citations', () => {
  const result = selfCheck()
  for (const finding of result.findings) console.log(`REFUSAL-CATEGORY-FINDING code=${finding.code} detail=${finding.detail}`)
  assert.equal(result.ok, true, 'the closed vocabulary must pass its own integrity check')
  assert.ok(CATEGORY_IDS.length >= 8, 'the adopted vocabulary must keep at least the eight recorded categories')
})

test('no category definition bakes in a model-facing code or prose', () => {
  const bakeIn = /\b(?:FS|IO|PATH)_[A-Z][A-Z0-9_]+\b|outside every allow subtree|has not been read|changed since it was read/u
  for (const id of CATEGORY_IDS) {
    const definition = REFUSAL_CATEGORIES[id].definition
    assert.match(definition, /\S/u, `category ${id} must have a definition`)
    assert.equal(bakeIn.test(definition), false, `category ${id}'s definition must describe the CONDITION, not a surface string`)
  }
})

test('every category is reachable from at least one explicit mapping entry', () => {
  const reachable = new Set([...LEGACY_REFUSAL_MAP.map((entry) => entry.category), ...Object.values(NATIVE_FS_ERROR_MAP)])
  for (const id of CATEGORY_IDS) assert.equal(reachable.has(id), true, `category ${id} is dead vocabulary: no entry produces it`)
})

// ─────────────────────────────────────────────────────────────────────────────
// 2. total legacy map — classes, typed codes, measured prose
// ─────────────────────────────────────────────────────────────────────────────

test('every legacy refusal CLASS the corpus records maps to its category', () => {
  const expected = {
    'lane-read': 'denied-by-lane',
    'lane-write': 'denied-by-lane',
    'lane-deny': 'denied-by-lane',
    'write-requires-read': 'read-before-write',
    'stale-version': 'stale-version',
    other: 'unknown',
  }
  for (const [value, category] of Object.entries(expected)) {
    assert.deepEqual(categoryOfLegacyRefusal(value), { category, kind: 'class', matched: value })
  }
  // the classes the golden fixture actually contains are a subset of these
  for (const value of goldenVocabulary().classes) {
    assert.equal(Object.hasOwn(expected, value), true, `the golden fixture recorded an undeclared class ${JSON.stringify(value)}`)
  }
})

test('every measured legacy PROSE sentence maps to its category (in order)', () => {
  const expected = {
    stale: 'stale-version',
    unread: 'read-before-write',
    coupling: 'read-before-write',
    lane: 'denied-by-lane',
    denySubtree: 'denied-by-lane',
    ask: 'denied-by-lane',
    symlink: 'denied-by-lane',
    missing: 'missing-path',
  }
  const pick = (needle) => LEGACY_REFUSAL_MAP.find((entry) => entry.kind === 'text' && entry.match.source.includes(needle))
  const probes = {
    stale: pick('changed since'),
    unread: pick('has not been read'),
    coupling: pick('must read'),
    lane: pick('outside every allow'),
    denySubtree: pick('inside an explicit deny'),
    ask: pick('disposition'),
    symlink: pick('dangling symlink'),
    missing: pick("read target '.+' does not exist"),
  }
  for (const [key, entry] of Object.entries(probes)) {
    assert.ok(entry !== undefined, `the ${key} prose entry must be declared`)
    assert.equal(categoryOfLegacyRefusal(entry.sample).category, expected[key], `prose ${key} misclassified`)
  }
})

test('every legacy TYPED code (TeamIoDenial + compiled path decisions) maps to its category', () => {
  const expected = {
    IO_READ_DENIED: 'denied-by-lane',
    IO_WRITE_DENIED: 'denied-by-lane',
    IO_ASK_REQUIRES_APPROVAL: 'denied-by-lane',
    IO_WRITE_REQUIRES_READ: 'read-before-write',
    IO_POLICY_UNSUPPORTED: 'unsupported-mode',
    PATH_NOT_ALLOWED: 'denied-by-lane',
    PATH_EXPLICITLY_DENIED: 'denied-by-lane',
    PATH_SYMLINK_ESCAPE: 'denied-by-lane',
    PATH_NOT_FOUND: 'missing-path',
    PATH_RESOLUTION_UNSUPPORTED: 'unsupported-mode',
  }
  for (const [value, category] of Object.entries(expected)) {
    assert.equal(categoryOfLegacyRefusal(value).category, category, `legacy code ${value} misclassified`)
    assert.equal(categoryOfLegacyRefusal(value).kind, 'code', `${value} must resolve as a code, not a prose search`)
  }
})

test('matching ORDER: a stale-edit remedy is not mistaken for read-before-write', () => {
  // "re-read the file, then retry" CONTAINS "read the file, then retry"; the
  // stale pattern must be tried first or a stale edit is silently reclassified.
  const staleSample = LEGACY_REFUSAL_MAP.find((entry) => entry.kind === 'text' && entry.match.source.includes('changed since')).sample
  assert.match(staleSample, /read the file, then retry/u, 'the sample must actually contain the shadowing substring')
  assert.equal(categoryOfLegacyRefusal(staleSample).category, 'stale-version')
})

// ─────────────────────────────────────────────────────────────────────────────
// 3. total native map
// ─────────────────────────────────────────────────────────────────────────────

test('every native FsError code maps to its category', () => {
  const expected = {
    FS_SANDBOX_DENIED: 'denied-by-lane',
    FS_PERMISSION_DENIED: 'denied-by-lane',
    FS_NOT_OBSERVED: 'read-before-write',
    FS_STALE_VERSION: 'stale-version',
    FS_NOT_FOUND: 'missing-path',
    FS_EDIT_NOT_FOUND: 'missing-path',
    FS_AMBIGUOUS_EDIT: 'invalid-argument',
    FS_ABORTED: 'cancelled',
  }
  assert.deepEqual(sorted(Object.keys(NATIVE_FS_ERROR_MAP)), sorted(Object.keys(expected)), 'the native map and the recorded code set must agree exactly')
  for (const [code, category] of Object.entries(expected)) {
    assert.equal(categoryOfNativeFsError(code).category, category, `native code ${code} misclassified`)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// 4. comparison semantics
// ─────────────────────────────────────────────────────────────────────────────

test('cross-category pairs are INCOMPATIBLE and never receive a default category', () => {
  const pairs = [
    ['lane-deny', 'FS_NOT_FOUND'],
    ["authored locator '/w/outside.txt' is outside every allow subtree of the lane", 'FS_NOT_FOUND'],
    ['write-requires-read', 'FS_STALE_VERSION'],
    ['stale-version', 'FS_NOT_OBSERVED'],
    ['IO_POLICY_UNSUPPORTED', 'FS_PERMISSION_DENIED'],
    ['lane-deny', 'FS_ABORTED'],
    ['lane-deny', 'FS_AMBIGUOUS_EDIT'],
    ['other', 'FS_PERMISSION_DENIED'],
  ]
  for (const [legacy, native] of pairs) {
    const result = compareRefusal({ legacy, native })
    assert.equal(result.compatible, false, `${legacy} vs ${native} must NOT be compatible`)
    assert.equal(result.category, null, 'an incompatible comparison must not name a shared category')
    assert.match(result.reason, /different refusal conditions/u)
  }
})

test('same-category cross-surface pairs ARE compatible (that is the whole ruling)', () => {
  const pairs = [
    ['lane-deny', 'FS_PERMISSION_DENIED'],
    ['lane-deny', 'FS_SANDBOX_DENIED'],
    ["authored locator '/w/x' is outside every allow subtree of the lane", 'FS_PERMISSION_DENIED'],
    ['IO_WRITE_DENIED', 'FS_PERMISSION_DENIED'],
    ['write-requires-read', 'FS_NOT_OBSERVED'],
    ['IO_WRITE_REQUIRES_READ', 'FS_NOT_OBSERVED'],
    ['stale-version', 'FS_STALE_VERSION'],
  ]
  for (const [legacy, native] of pairs) {
    const result = compareRefusal({ legacy, native })
    assert.equal(result.compatible, true, `${legacy} vs ${native} must be compatible`)
    assert.equal(result.category, result.legacyCategory, 'the shared category is the compared category')
    assert.equal(result.category, result.nativeCategory)
  }
})

test('an unmapped legacy value is REFUSED, never defaulted to unknown', () => {
  for (const value of ['a refusal nobody mapped', 'lane-rearranged', 'IO_TELEPORTED']) {
    assert.throws(() => categoryOfLegacyRefusal(value), (error) => error instanceof RefusalVocabularyError && error.code === 'REFUSAL_VOCABULARY_INCOMPLETE')
    assert.throws(() => compareRefusal({ legacy: value, native: 'FS_PERMISSION_DENIED' }), (error) => error.code === 'REFUSAL_VOCABULARY_INCOMPLETE')
  }
})

test('an unmapped native code is REFUSED, never defaulted to unknown', () => {
  for (const code of ['FS_NEW_UNRECORDED', 'FS_PERMISSION_DENIE', 'TEAM_IO_DENIED']) {
    assert.throws(() => categoryOfNativeFsError(code), (error) => error instanceof RefusalVocabularyError && error.code === 'REFUSAL_VOCABULARY_INCOMPLETE')
  }
})

test('a "no refusal" sentinel is not a category and is skipped by the audit', () => {
  for (const sentinel of ['-', '', null, undefined, '']) {
    assert.equal(isNoRefusal(sentinel), true)
    assert.throws(() => categoryOfLegacyRefusal(sentinel), (error) => error.code === 'REFUSAL_VOCABULARY_INCOMPLETE')
  }
  const audit = auditCorpus({ legacy: ['-', null, 'lane-deny'], native: [] })
  assert.equal(audit.ok, true, 'an allow sentinel must not be reported as an incomplete vocabulary')
})

test('a comparison needs both sides — one side against nothing is vacuous', () => {
  assert.throws(() => compareRefusal({ legacy: 'lane-deny' }), (error) => error.code === 'REFUSAL_COMPARISON_INVALID')
  assert.throws(() => compareRefusal({ native: 'FS_PERMISSION_DENIED' }), (error) => error.code === 'REFUSAL_COMPARISON_INVALID')
})

// ─────────────────────────────────────────────────────────────────────────────
// 5. exhaustiveness over the corpus (derived, not declared)
// ─────────────────────────────────────────────────────────────────────────────

test('the corpus vocabulary is exhaustive today (classes, codes and prose all map)', () => {
  const legacy = recordedLegacyValues()
  const native = recordedNativeCodes()
  assert.deepEqual(sorted(legacy), sorted([...CORPUS_VOCABULARY_BASELINE.legacyClasses, ...CORPUS_VOCABULARY_BASELINE.legacyCodes]),
    'the derived legacy class/code vocabulary drifted from the recorded baseline')
  const proseSamples = LEGACY_REFUSAL_MAP.filter((entry) => entry.kind === 'text').map((entry) => entry.sample)
  assert.equal(auditCorpus({ legacy: proseSamples, native: [] }).findings.length, 0, 'every declared prose sample must map')
  assert.deepEqual(native, sorted(CORPUS_VOCABULARY_BASELINE.recordedNativeCodes), 'the derived native vocabulary drifted from the recorded baseline')
  assert.equal(assertCorpusVocabularyComplete({ legacy, native }), true)
  assert.equal(auditCorpus({ legacy, native }).findings.length, 0)
})

test('the corpus audit REFUSES a value the corpus gains later (the contract, before the mutation)', () => {
  const audit = auditCorpus({
    legacy: [...recordedLegacyValues(), 'lane-rearranged'],
    native: [...recordedNativeCodes(), 'FS_NEW_UNRECORDED'],
  })
  assert.equal(audit.ok, false)
  assert.deepEqual(sorted(audit.findings.map((finding) => finding.value)), ['FS_NEW_UNRECORDED', 'lane-rearranged'])
  for (const finding of audit.findings) assert.equal(finding.code, 'REFUSAL_VOCABULARY_INCOMPLETE')
  assert.throws(
    () => assertCorpusVocabularyComplete({ legacy: ['lane-rearranged'], native: [] }),
    (error) => error.code === 'REFUSAL_VOCABULARY_INCOMPLETE',
  )
})

// ─────────────────────────────────────────────────────────────────────────────
// 6. REAL MUTATIONS — a defence that cannot be shown to bite is not evidence
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Each mutant injects ONE defect into a facade over the real module. A mutant
 * is RED (killed) when the probe catches the defect on the real module and the
 * SAME probe no longer catches it on the mutated facade. The counts printed
 * below are computed from these runs.
 */
const MUTANTS = [
  {
    id: 'corpus-gains-unmapped-native-code',
    probe(facade) {
      const audit = facade.auditCorpus({ legacy: [], native: ['FS_NEW_UNRECORDED'] })
      return audit.ok === false
        && audit.findings.some((finding) => finding.code === 'REFUSAL_VOCABULARY_INCOMPLETE' && finding.value === 'FS_NEW_UNRECORDED')
    },
    mutate: () => ({ auditCorpus: () => ({ ok: true, findings: [] }) }),
  },
  {
    id: 'comparator-default-buckets-unknown-values',
    probe(facade) {
      try {
        const resolved = facade.categoryOfNativeFsError('FS_NEW_UNRECORDED')
        return resolved.category !== 'unknown' && false // a resolved default is the defect, never a catch
      } catch (error) {
        return error instanceof RefusalVocabularyError && error.code === 'REFUSAL_VOCABULARY_INCOMPLETE'
      }
    },
    mutate: () => ({ categoryOfNativeFsError: () => Object.freeze({ category: 'unknown' }) }),
  },
  {
    id: 'drop-a-category',
    probe(facade) {
      const categories = { ...facade.REFUSAL_CATEGORIES }
      delete categories.cancelled
      const result = facade.selfCheck({ categories })
      return result.ok === false && result.findings.length > 0
    },
    mutate: () => ({ selfCheck: () => ({ ok: true, findings: [] }) }),
  },
  {
    id: 'shadow-a-prose-entry-by-reordering',
    probe(facade) {
      const map = [...facade.LEGACY_REFUSAL_MAP]
      const stale = map.find((entry) => entry.kind === 'text' && entry.match.source.includes('changed since'))
      const unread = map.find((entry) => entry.kind === 'text' && entry.match.source.includes('has not been read'))
      if (stale === undefined || unread === undefined) return false
      const reordered = map.filter((entry) => entry !== stale)
      reordered.splice(reordered.indexOf(unread) + 1, 0, stale)
      const result = facade.selfCheck({ legacyMap: reordered })
      return result.ok === false && result.findings.some((finding) => /shadowing|reclassifies/u.test(finding.detail))
    },
    mutate: () => ({ selfCheck: () => ({ ok: true, findings: [] }) }),
  },
]

test('REAL MUTATIONS: every injected defect is caught by the probes above', async () => {
  const real = {
    auditCorpus,
    categoryOfNativeFsError,
    selfCheck,
    REFUSAL_CATEGORIES,
    LEGACY_REFUSAL_MAP,
  }
  const results = []
  for (const mutant of MUTANTS) {
    const realCatches = mutant.probe(real) === true
    const facade = { ...real, ...mutant.mutate(real) }
    const mutantCaught = mutant.probe(facade) === true
    const red = realCatches && !mutantCaught
    results.push({ id: mutant.id, realCatches, mutantCaught, red })
    console.log(`REFUSAL-CATEGORY-MUTANT id=${mutant.id} real_catches=${realCatches} mutant_catches=${mutantCaught} red=${red}`)
  }
  const total = results.length
  const red = results.filter((result) => result.red).length
  console.log(`REFUSAL-CATEGORY-MUTANTS total=${total} red=${red}`)
  assert.equal(realCatchesAll(results), true, 'a probe that does not catch the defect on the REAL module is vacuous')
  assert.equal(red, total, `every injected defect must be caught (red=${red}/${total})`)
})

function realCatchesAll(results) {
  return results.every((result) => result.realCatches === true)
}
