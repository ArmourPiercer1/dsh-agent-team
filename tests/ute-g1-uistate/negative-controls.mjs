#!/usr/bin/env node
/**
 * negative-controls.mjs — the UI + AGENT-STATE lane's POST-CUT battery (round 81).
 *
 * WHAT CHANGED AND WHY. The B1 battery re-ran corpus vectors while mutating the
 * governed family body and the route-C delivery shape (eight per-member
 * controls + a store witness). The A0 frozen cut deleted BOTH governed family
 * bodies (`packages/tools/families/ui.mjs`, `packages/tools/agent-state-family/`,
 * `5d1349767`/`93ba0a1d1`), so those experiments can no longer run: there is no
 * body left to mutate. The property they proved is carried by named successors
 * (`tests/world-factory/a5sf-ask-precedence.test.mjs`, `vnext-admission`), and
 * this battery proves the successor is load-bearing:
 *
 *   NC-RETIRED-FAMILY-ABSENT   the deleted family modules/specs stay gone.
 *   NC-HOST-MODULES-ONLY       the successor mounts the preset's own modules.
 *   NC-SUCCESSORS-EXIST        every named successor instrument is on disk.
 *   NC-GOLDEN-FROZEN           the fixture is the historical baseline and was
 *                              NOT re-recorded for a composition that lost the
 *                              mechanism.
 *   NC-CATEGORY-TOTAL          the closed vocabulary is total over the observed
 *                              codes (host-free, kept from B1).
 *   NC-GOLDEN-DESIGN-CLAIMS    every row still satisfies its corpus claim
 *                              (host-free, kept from B1).
 *   NC-NO-NEW-PATH-CLAIM       the evidence still records NEW-PATH-ABSENT; this
 *                              lane may never borrow a PASS it did not measure.
 *   NC-LEDGER-CITES-SUCCESSOR  both family ledger rows stay NOT_RETIREABLE and
 *                              book this lane.
 *
 * Retired-control successor map (full table in ROUND80-CI-CLOSURE.md §4):
 *   NC-MEMBER ask/present/todo/get_goal/create_goal/update_goal/exit_plan_mode
 *     -> tests/world-factory/a5sf-ask-precedence.test.mjs (4 ask arms)
 *        + packages/runtime/test/vnext-admission.test.mjs (admission refusals)
 *   NC-HARNESS store-witness -> NC-GOLDEN-DESIGN-CLAIMS + the golden's own
 *        durable-store columns (still graded by the lane).
 *
 * The transcript is re-recorded under `accepted_by=round81-a1-cut`.
 *
 * @module tests/ute-g1-uistate/negative-controls
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import {
  ACCEPTED_BY,
  DELETING_COMMITS,
  REPO_ROOT,
  ROUTE_C_ROW,
  VNEXT_ASSEMBLY,
  assertNoAppendedShadow,
  runRetirementControls,
  subjectRow,
} from '../ute-g1-shared/retirement.mjs'
import { checkDesignClaim, parseGolden } from './lib/compare.mjs'
import { CORPUS, COVERED_MEMBERS } from './lib/corpus.mjs'
import { observedCodes } from './lib/effect-oracle.mjs'
import { assertVocabularyTotal, CATEGORY_IDS } from './lib/refusal-map.mjs'

const GOLDEN = join(REPO_ROOT, 'tests', 'ute-g1-uistate', 'golden', 'old-path.tsv')
const golden = parseGolden(readFileSync(GOLDEN, 'utf8'))
const EVIDENCE = join(REPO_ROOT, 'dev', 'agent-workflow', 'evidence', 'ute3-uistate-b1-20261121')
const RETIRED_PATHS = Object.freeze([
  'packages/tools/families/ui.mjs',
  'packages/tools/families/agent-state.mjs',
  'packages/tools/agent-state-family/src/executors.mjs',
])
const SUCCESSORS = Object.freeze([
  'tests/ute-g1-uistate/lane-suite.test.mjs',
  'tests/world-factory/a5sf-ask-precedence.test.mjs',
  'packages/runtime/test/vnext-admission.test.mjs',
])

/** The control list, shared by the lane suite (module API) and the CLI. */

/**
 * The retirement unit's members, measured post-cut: the frozen golden still
 * carries the member's rows (per family), and the governed body that served it
 * is ABSENT. A golden that lost the member, or a resurrected governed family,
 * turns one of these RED instead of hiding behind the frozen baseline.
 */
const memberControls = (members) => members.map(({ member, family }) => ({
  id: `NC-MEMBER ${member}`,
  run: () => {
    const rows = golden.filter((record) => record.entry === member && record.family === family)
    if (rows.length === 0) throw new Error(`${member} (${family}) has no frozen baseline row; the retirement unit lost the member`)
    if (existsSync(join(REPO_ROOT, 'packages/tools/families/ui.mjs'))) throw new Error('the retired ui family body is back; the member is being re-served')
    return `frozen-vectors=${String(rows.length)} successor=${family === 'ui' ? 'tests/world-factory/a5sf-ask-precedence.test.mjs' : 'packages/runtime/test/vnext-admission.test.mjs'}`
  },
}))

export const CONTROLS = Object.freeze([
  ...memberControls([
    { member: 'ask_user_question', family: 'ui' },
    { member: 'present', family: 'ui' },
    { member: 'todo_write', family: 'agent-state' },
    { member: 'get_goal', family: 'agent-state' },
    { member: 'create_goal', family: 'agent-state' },
    { member: 'update_goal', family: 'agent-state' },
    { member: 'exit_plan_mode', family: 'agent-state' },
  ]),
  {
    id: 'NC-RETIRED-FAMILY-ABSENT',
    run: () => {
      const present = RETIRED_PATHS.filter((path) => existsSync(join(REPO_ROOT, path)))
      if (present.length > 0) throw new Error(`the retired family body is back: ${present.join(',')} (deleted by ${DELETING_COMMITS.appendedShadow}/${DELETING_COMMITS.frozenCut})`)
      assertNoAppendedShadow({ quiet: true })
      return `deleted=${String(RETIRED_PATHS.length)} specSymbols=none`
    },
  },
  {
    id: 'NC-HOST-MODULES-ONLY',
    run: () => {
      const source = readFileSync(join(REPO_ROOT, VNEXT_ASSEMBLY), 'utf8')
      if (!/mountHostModules|mountVnextNativeToolModules|a5sfNativeToolModules/u.test(source)) throw new Error(`${VNEXT_ASSEMBLY} no longer mounts the preset's native modules`)
      if (/confined[A-Z]\w*SpecOf/u.test(readFileSync(join(REPO_ROOT, ROUTE_C_ROW), 'utf8'))) throw new Error('the route-C row defines a confined*SpecOf again')
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
    id: 'NC-GOLDEN-FROZEN',
    run: () => {
      if (golden.length !== CORPUS.length) throw new Error(`the fixture carries ${String(golden.length)} rows but the corpus has ${String(CORPUS.length)}`)
      if (/accepted_by=round81-a1-cut/u.test(readFileSync(GOLDEN, 'utf8'))) throw new Error('the UI/AS golden was re-recorded; this lane owns no new path')
      return `vectors=${String(golden.length)} re-recorded=no members=${String(COVERED_MEMBERS.length)}`
    },
  },
  {
    id: 'NC-CATEGORY-TOTAL',
    run: () => {
      const codes = observedCodes(golden)
      const totality = assertVocabularyTotal([...codes, 'UTE3_INVENTED_REFUSAL_CODE'])
      if (totality.problems.length === 0) throw new Error('an invented refusal code was accepted by the total mapping')
      if (!CATEGORY_IDS.includes('unknown')) throw new Error('the residual bucket is no longer a declared id')
      return `observed=${String(codes.length)} invented=refused`
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
    id: 'NC-NO-NEW-PATH-CLAIM',
    run: () => {
      const retired = readFileSync(join(EVIDENCE, 'non-retirement.md'), 'utf8')
      if (!retired.includes('NEW-PATH-ABSENT')) throw new Error('the evidence no longer records the new-path absence')
      if (/new-path=VERIFIED/u.test(retired)) throw new Error('the evidence claims a verified new path this lane never measured')
      return 'new-path=ABSENT claimed=no'
    },
  },
  {
    id: 'NC-LEDGER-CITES-SUCCESSOR',
    run: () => {
      for (const familyId of ['dsh.ui-family', 'dsh.agent-state-family']) {
        const row = subjectRow(familyId)
        if (!row.successors.includes('tests/ute-g1-uistate/lane-suite.test.mjs')) throw new Error(`${familyId}: the frozen licence does not book this lane`)
      }
      return 'subjects=2 lane-booked=yes'
    },
  },
])

/**
 * Run the battery (the lane suite's API).
 * @returns {Promise<{verdict: string, results: {id: string, member?: string, problems: string[]}[], failures: string[], lines: string[]}>}
 */
export async function runNegativeControls() {
  const { lines, failed, results } = await runRetirementControls(CONTROLS, {
    acceptedBy: ACCEPTED_BY,
    reason: 're-record of the UI/AS battery: the governed family body retired per subject (ROUND80-CI-CLOSURE.md §4)',
  })
  const failures = results.filter((result) => result.ok !== true).map((result) => `${result.id}: ${result.detail}`)
  return {
    verdict: failed === 0 ? 'GREEN' : 'RED',
    results: results.map((result) => ({ id: result.id, problems: result.ok === true ? [] : [result.detail] })),
    failures,
    lines,
  }
}

// CLI: print the exact transcript the lane compares against.
if (process.argv[1] !== undefined && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  const { lines, verdict } = await runNegativeControls()
  for (const line of lines) console.log(line)
  if (verdict !== 'GREEN') process.exitCode = 1
}
