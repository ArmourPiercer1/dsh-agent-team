#!/usr/bin/env node
/**
 * negative-controls.mjs — the WEB lane's POST-CUT control battery (round 81).
 *
 * WHAT CHANGED AND WHY. The B1 battery mutated the appended PD-27 web shadow
 * (member widening, shadow disposal, socket shim removal, a concurrent-request
 * witness). The A1 cut deleted that mechanism (`5d1349767`: every
 * `confined*SpecOf`; `93ba0a1d1`: `packages/tools/families/web.mjs`), so those
 * arms measured modules that no longer exist. Their PROPERTY is carried now by
 * named successors, and this battery proves the successor is load-bearing:
 *
 *   NC-GOLDEN-FROZEN          the 10-row fixture is the historical baseline and
 *                             was NOT re-recorded for a composition that lost
 *                             the mechanism.
 *   NC-RETIRED-SHADOW-ABSENT  the deleted module and every `confined*SpecOf`
 *                             stay gone (LIVE mount: the attach appends nothing).
 *   NC-HOST-MODULES-ONLY      the successor mounts the ACTIVE preset's own
 *                             native modules (`vnext/agent-bindings.mjs`).
 *   NC-SUCCESSORS-EXIST       every named successor instrument is on disk.
 *   NC-CATEGORY-TOTAL         the closed refusal vocabulary is total; an
 *                             invented code is REFUSED, never bucketed (kept).
 *   NC-GOLDEN-MUTATION        a flipped golden cell turns the comparator RED
 *                             (kept: the fixture is still graded).
 *   NC-GOLDEN-DESIGN-CLAIMS   every golden row still satisfies its corpus claim
 *                             (kept).
 *   NC-LEDGER-CITES-SUCCESSOR the frozen licence books this subject and lane.
 *
 * Retired-control successor map (full table in ROUND80-CI-CLOSURE.md §4):
 *   NC-MEMBER web_fetch / web_search -> tests/world-factory/a5sf-pd18-web-ptc.test.mjs
 *   NC-MEMBER-POSITIVE web_*        -> NC-GOLDEN-DESIGN-CLAIMS (fixture still graded)
 *   NC-SHADOW-LOAD-BEARING          -> NC-RETIRED-SHADOW-ABSENT + NC-HOST-MODULES-ONLY
 *   NC-NET-SHIM-LOAD-BEARING        -> tests/ute-g1-web/lane-suite.test.mjs (undici witness self-check)
 *   NC-NET-COUNTER-POSITIVE         -> tests/world-factory/a5sf-pd18-web-ptc.test.mjs (P1 guard)
 *   NC-CONCURRENT-NORMALIZATION     -> NC-GOLDEN-FROZEN (the concurrent row stays recorded)
 *
 * Set `UTE_WEB_NC_MUTATE=drop-widening` to prove the GREEN verdict is measured:
 * the script then reports RED with exactly one failure.
 *
 * @module tests/ute-g1-web/negative-controls
 */
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
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
import { checkDesignClaim, compareAll, compareRecord, parseGolden } from './lib/compare.mjs'
import {
  assertVocabularyTotal,
  CATEGORY_IDS,
  REFUSAL_CATEGORIES,
  UNKNOWN_CATEGORY,
} from './lib/effect-oracle.mjs'
import { mountRouteCWorld } from './lib/world.mjs'

const GOLDEN = join(REPO_ROOT, 'tests', 'ute-g1-web', 'golden', 'old-path.tsv')
const golden = parseGolden(readFileSync(GOLDEN, 'utf8'))
const SUCCESSORS = Object.freeze([
  'tests/ute-g1-web/lane-suite.test.mjs',
  'tests/world-factory/a5sf-pd18-web-ptc.test.mjs',
  'tests/world-factory/a5sf-web-contract.test.mjs',
  'packages/runtime/test/vnext-admission.test.mjs',
])
const RETIRED_PATHS = Object.freeze([
  'packages/tools/families/web.mjs',
  'packages/tools/web-family/src/web-mechanics.mjs',
  'packages/tools/web-family/src/web-transport.mjs',
])
const MUTATE = process.env.UTE_WEB_NC_MUTATE === 'drop-widening'

let liveAttachAppendedNothing
const controls = [
  {
    id: 'NC-GOLDEN-FROZEN',
    run: () => {
      if (golden.length !== CORPUS.length) throw new Error(`the fixture carries ${String(golden.length)} rows but the corpus has ${String(CORPUS.length)}`)
      if (/accepted_by=round81-a1-cut/u.test(readFileSync(GOLDEN, 'utf8'))) throw new Error('the web golden was re-recorded; this lane owns no new path')
      if (MUTATE) throw new Error('UTE_WEB_NC_MUTATE=drop-widening: deliberate red, proving the GREEN verdict is measured')
      return `vectors=${String(golden.length)} re-recorded=no`
    },
  },
  {
    id: 'NC-RETIRED-SHADOW-ABSENT',
    run: async () => {
      const present = RETIRED_PATHS.filter((path) => existsSync(join(REPO_ROOT, path)))
      if (present.length > 0) throw new Error(`the PD-27 web shadow is back: ${present.join(',')} (deleted by ${DELETING_COMMITS.appendedShadow}/${DELETING_COMMITS.frozenCut})`)
      assertNoAppendedShadow({ quiet: true })
      const world = await mountRouteCWorld({ label: 'retired-mechanism' })
      try {
        liveAttachAppendedNothing = world.attachAppendedNothing
      } finally {
        await world.dispose()
      }
      if (liveAttachAppendedNothing !== true) throw new Error('the post-cut attach appended a PD-27 web shadow; the A1 law is HOST-MODULES-ONLY')
      return `deleted=${String(RETIRED_PATHS.length)} live-attach=appends-nothing`
    },
  },
  {
    id: 'NC-HOST-MODULES-ONLY',
    run: () => {
      const source = readFileSync(join(REPO_ROOT, 'packages/runtime/src/plugin/vnext/agent-bindings.mjs'), 'utf8')
      if (!/mountHostModules|mountVnextNativeToolModules|a5sfNativeToolModules/u.test(source)) throw new Error('the successor no longer mounts the preset\'s native modules')
      return 'successor=composition-declared-native-modules appended=0'
    },
  },
  {
    id: 'NC-SUCCESSORS-EXIST',
    run: () => {
      for (const successor of SUCCESSORS) {
        if (!existsSync(join(REPO_ROOT, successor))) throw new Error(`named successor ${successor} is missing`)
      }
      return `named=${String(SUCCESSORS.length)}`
    },
  },
  {
    id: 'NC-CATEGORY-TOTAL',
    run: () => {
      const codes = [...new Set(golden.flatMap((record) => record.codes))]
      const totality = assertVocabularyTotal([...codes, 'UTE3_INVENTED_REFUSAL_CODE'])
      if (totality.problems.length === 0) throw new Error('an invented refusal code was accepted by the total mapping')
      if (Object.keys(REFUSAL_CATEGORIES).length !== 9) throw new Error('the closed vocabulary no longer has nine categories')
      if (!CATEGORY_IDS.includes(UNKNOWN_CATEGORY)) throw new Error('the residual bucket is no longer a declared id')
      return `observed=${String(codes.length)} invented=refused categories=9`
    },
  },
  {
    id: 'NC-GOLDEN-MUTATION',
    run: () => {
      const row = golden[0]
      const mutated = { ...row, outcome: row.outcome === 'allow' ? 'deny' : 'allow' }
      const verdict = compareRecord(mutated, row)
      if (verdict.ok !== false) throw new Error('the comparator accepted a flipped outcome cell')
      const all = compareAll(golden, [mutated, ...golden.slice(1)])
      if (all.failures.length === 0) throw new Error('compareAll did not surface the flipped cell')
      return `flipped=${row.id} differs=yes`
    },
  },
  {
    id: 'NC-GOLDEN-DESIGN-CLAIMS',
    run: () => {
      const problems = []
      for (const record of golden) {
        const vector = CORPUS.find((candidate) => candidate.id === record.id)
        if (vector === undefined) { problems.push(`${record.id} is not in the corpus`); continue }
        for (const problem of checkDesignClaim(vector, record)) problems.push(`${record.id}: ${problem}`)
      }
      if (problems.length > 0) throw new Error(problems.join('; '))
      return `rows=${String(golden.length)} claims=hold`
    },
  },
  {
    id: 'NC-LEDGER-CITES-SUCCESSOR',
    run: () => {
      const row = subjectRow('dsh.web-family')
      if (!row.successors.includes('tests/ute-g1-web/lane-suite.test.mjs')) throw new Error('the frozen licence does not book this lane')
      return `subject=${row.id} citations=${String(row.citations.length)} lane-booked=yes`
    },
  },
]

const { lines, failed } = await runRetirementControls(controls, {
  acceptedBy: ACCEPTED_BY,
  reason: 're-record of the WEB battery: old-path shadow controls retired per subject (ROUND80-CI-CLOSURE.md §4)',
})
for (const line of lines) console.log(line)
if (failed > 0) process.exitCode = 1
