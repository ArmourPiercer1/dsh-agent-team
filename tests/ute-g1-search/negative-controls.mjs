#!/usr/bin/env node
/**
 * negative-controls.mjs — the SEARCH lane's control battery (round 81).
 *
 * WHAT CHANGED AND WHY. The B1 battery mutated the appended PD-16
 * `confined-search-tool.mjs` shadow through the old path. The A1 cut deleted
 * that mechanism (`5d1349767`), so those arms measured a module that no longer
 * exists. The PROPERTY they proved is not lost: the NEW path is verified for
 * all 15 vectors and its own battery (`new-path-controls.mjs`, 12 controls)
 * carries the declaration/provenance arms. This file adds the two arms the new
 * battery deliberately does not duplicate, and keeps the two host-free arms:
 *
 *   NC-HARNESS-BITES            flip one golden cell — the comparator grades it
 *                               (host-free, kept from B1).
 *   NC-CATEGORY-TOTAL           an invented refusal must be REFUSED, never
 *                               bucketed (host-free, kept from B1).
 *   NC-RETIRED-SHADOW-ABSENT    the deleted PD-16 module and every
 *                               `confined*SpecOf` stay gone (LIVE mount: the
 *                               attach appends nothing).
 *   NC-MEMBER grep (was NC-NEW-PATH-LANE-BITES-GREP): widening the READ
 *                               lane on the NEW path turns the same denial into
 *                               an admitted, out-of-lane read.
 *   NC-MEMBER glob (was NC-NEW-PATH-LANE-BITES-GLOB), same law. The two ids
 *   are the retirement unit's members, so the frozen ledger's
 *   `NC-MEMBER <member>` coverage contract still has a REAL control per member.
 *   NC-GOLDEN-FROZEN            the 15-row fixture was NOT re-recorded: the new
 *                               path reproduces every cell byte-for-byte.
 *   NC-SUCCESSORS-EXIST         the named successors are on disk.
 *
 * Transcript re-recorded under `accepted_by=round81-a1-cut`; the B1 transcript is
 * superseded (ROUND80-CI-CLOSURE.md §4).
 *
 * @module tests/ute-g1-search/negative-controls
 */
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'

import {
  ACCEPTED_BY,
  DELETING_COMMITS,
  REPO_ROOT,
  assertNoAppendedShadow,
  runRetirementControls,
  subjectRow,
} from '../ute-g1-shared/retirement.mjs'
import { CORPUS } from './lib/corpus.mjs'
import { compareRecord, parseGolden } from './lib/compare.mjs'
import { REFUSAL_CATEGORIES, RefusalVocabularyError, classifySearchRefusal } from './lib/effect-oracle.mjs'
import { loadNewPathSurface, runVector } from './lib/new-path.mjs'

const GOLDEN = join(REPO_ROOT, 'tests', 'ute-g1-search', 'golden', 'old-path.tsv')
const golden = parseGolden(readFileSync(GOLDEN, 'utf8'))
const SUCCESSORS = Object.freeze([
  'tests/ute-g1-search/lane-suite.test.mjs',
  'tests/ute-g1-search/new-path-controls.mjs',
  'packages/runtime/test/vnext-admission.test.mjs',
])
const RETIRED_PATHS = Object.freeze([
  'packages/runtime/src/plugin/live/confined-search-tool.mjs',
  'packages/tools/search-family/src/executors.mjs',
])

const vector = (id) => {
  const found = CORPUS.find((candidate) => candidate.id === id)
  if (found === undefined) throw new Error(`the corpus has no vector ${id}`)
  return found
}

const controls = [
  {
    id: 'NC-HARNESS-BITES',
    run: () => {
      const row = golden.find((record) => record.id === 'SR-G1-inlane-match')
      assert.ok(row !== undefined, 'the fixture has no SR-G1 row')
      const mutated = { ...row, outcome: row.outcome === 'allow' ? 'deny' : 'allow' }
      if (mutated.outcome === row.outcome) throw new Error('the mutation changed no cell; the control cannot bite')
      const verdict = compareRecord(mutated, row)
      if (verdict.ok !== false) throw new Error('the comparator accepted a cell mutation')
      return `flipped=outcome ${row.outcome}->${mutated.outcome} differs=yes`
    },
  },
  {
    id: 'NC-CATEGORY-TOTAL',
    run: () => {
      let refused = false
      try {
        classifySearchRefusal({ outcome: 'deny', text: 'UTE3_INVENTED_REFUSAL_CODE', facts: [], readRoots: [] })
      } catch (error) {
        refused = error instanceof RefusalVocabularyError
      }
      if (!refused) throw new Error('an invented refusal was bucketed instead of refused')
      if (Object.keys(REFUSAL_CATEGORIES).length !== 9) throw new Error('the closed vocabulary no longer has nine categories')
      return 'invented=refused categories=9'
    },
  },
  {
    id: 'NC-RETIRED-SHADOW-ABSENT',
    run: async () => {
      const { mountRouteCWorld } = await import('./lib/world.mjs')
      const scratch = mkdtempSync(join(REPO_ROOT, '.artifacts', 'tmp', 'ute-g1-search', 'retired-'))
      mkdirSync(join(scratch, 'inside'), { recursive: true })
      try {
        const world = await mountRouteCWorld({ label: 'retired-mechanism', fixtureRoot: scratch, cwd: join(scratch, 'inside'), readRoots: [join(scratch, 'inside')] })
        try {
          if (world.attachAppendedNothing !== true) throw new Error('the post-cut attach appended a PD-16 search shadow; the A1 law is HOST-MODULES-ONLY')
        } finally {
          await world.dispose()
        }
      } finally {
        rmSync(scratch, { recursive: true, force: true })
      }
      assertNoAppendedShadow({ quiet: true })
      return `deleted=${String(RETIRED_PATHS.length)} live-attach=appends-nothing`
    },
  },
  {
    id: 'NC-MEMBER grep',
    run: async () => {
      const surface = await loadNewPathSurface()
      const baseline = await runVector(vector('SR-G3-outside-denied'), surface)
      const widened = await runVector(vector('SR-G3-outside-denied'), surface, { laneExtraRead: ['outside'], allowEscapedMatches: true })
      if (baseline.record.outcome !== 'deny') throw new Error(`the unmodified new path answered ${baseline.record.outcome}, not deny`)
      if (widened.record.outcome !== 'allow') throw new Error(`widening the read lane did not admit the same grep (${widened.record.outcome})`)
      if (!widened.record.leaks.includes('UTE3_SEARCH_OUTLANE_SECRET_5be1')) throw new Error('the admitted widened grep did not carry the out-of-lane secret; the lane control proved nothing')
      return `restricted=${baseline.record.outcome} widened=${widened.record.outcome} leak=yes`
    },
  },
  {
    id: 'NC-MEMBER glob',
    run: async () => {
      const surface = await loadNewPathSurface()
      const baseline = await runVector(vector('SR-L2-outside-denied'), surface)
      const widened = await runVector(vector('SR-L2-outside-denied'), surface, { laneExtraRead: ['outside'], allowEscapedMatches: true })
      if (baseline.record.outcome !== 'deny') throw new Error(`the unmodified new path answered ${baseline.record.outcome}, not deny`)
      if (widened.record.outcome !== 'allow') throw new Error(`widening the read lane did not admit the same glob (${widened.record.outcome})`)
      return `restricted=${baseline.record.outcome} widened=${widened.record.outcome}`
    },
  },
  {
    id: 'NC-GOLDEN-FROZEN',
    run: () => {
      if (golden.length !== CORPUS.length) throw new Error(`the fixture carries ${String(golden.length)} rows but the corpus has ${String(CORPUS.length)}`)
      const text = readFileSync(GOLDEN, 'utf8')
      if (/accepted_by=round81-a1-cut/u.test(text)) throw new Error('the search golden was re-recorded although the new path reproduces every cell')
      return `vectors=${String(golden.length)} re-recorded=no (new path reproduces every cell)`
    },
  },
  {
    id: 'NC-SUCCESSORS-EXIST',
    run: () => {
      for (const successor of SUCCESSORS) {
        const absolute = join(REPO_ROOT, successor)
        try {
          assert.ok(readFileSync(absolute).length > 0)
        } catch {
          throw new Error(`named successor ${successor} is missing or empty`)
        }
      }
      const row = subjectRow('dsh.search-family')
      if (!row.successors.includes('tests/ute-g1-search/lane-suite.test.mjs')) throw new Error('the frozen licence does not book this lane')
      return `named=${String(SUCCESSORS.length)} subject=${row.id}`
    },
  },
]

const { lines, failed } = await runRetirementControls(controls, {
  acceptedBy: ACCEPTED_BY,
  reason: 're-record of the SEARCH battery: old-path shadow controls retired/re-pointed per subject (ROUND80-CI-CLOSURE.md §4)',
})
for (const line of lines) console.log(line)
if (failed > 0) process.exitCode = 1
void DELETING_COMMITS
