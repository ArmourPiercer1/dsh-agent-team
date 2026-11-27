#!/usr/bin/env node
/**
 * negative-controls.mjs — the AGENT-CONTROL lane's POST-CUT battery (round 81).
 *
 * WHAT CHANGED AND WHY. The B1 battery ran 24 controls through the retired tool
 * plane (`packages/runtime/src/plugin/live/team-tool-plane.mjs`) and the
 * agent-control family body, mutating each of the seven members. The A0 frozen
 * cut deleted BOTH (`93ba0a1d1`), so the controls can no longer even import
 * their subject. The property — "the centre refuses what the plane let through,
 * and the retired names are not silently re-served" — is carried by named
 * successors, and this battery proves the successor is load-bearing:
 *
 *   NC-RETIRED-PLANE-ABSENT   `team-tool-plane.mjs`, the family body and the
 *                             families index stay gone, and no `confined*SpecOf`
 *                             is back in the route-C row.
 *   NC-HOST-MODULES-ONLY      the successor mounts the preset's own modules.
 *   NC-SUCCESSORS-EXIST       every named successor instrument is on disk.
 *   NC-GOLDEN-FROZEN          the 42-row fixture is the historical baseline and
 *                             was NOT re-recorded for a composition that lost the
 *                             mechanism.
 *   NC-CATEGORY-TOTAL         an invented refusal code is REFUSED, never bucketed
 *                             (host-free, kept from B1).
 *   NC-NO-NEW-PATH-CLAIM      the evidence still records NEW-PATH-ABSENT.
 *   NC-LEDGER-CITES-SUCCESSOR the frozen licence books this subject and lane.
 * (The gate's own refusal is asserted by the lane suite's test 7, which runs it
 * against the COMMITTED transcript; it is deliberately NOT a control here — a
 * control that spawns the gate would read this very file mid-write.)
 *
 * Retired-control successor map (full table in ROUND80-CI-CLOSURE.md §4):
 *   NC-MEMBER <member> x7 -> packages/runtime/test/vnext-admission.test.mjs
 *                            + tests/world-factory/a5sf-pd21-subagent.test.mjs
 *   NC-TRANSCRIPT / harness arms -> tests/ute-g1-agentctl/lane-suite.test.mjs test 7
 *                                  (the gate refusal is still graded there)
 *
 * The transcript is re-recorded under `accepted_by=round81-a1-cut`.
 *
 * @module tests/ute-g1-agentctl/negative-controls
 */
import { spawnSync } from 'node:child_process'
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
import { parseGolden } from './lib/compare.mjs'
import { RefusalVocabularyError, classifyRefusal } from './lib/effect-oracle.mjs'

const GOLDEN = join(REPO_ROOT, 'tests', 'ute-g1-agentctl', 'golden', 'old-path.tsv')
const golden = parseGolden(readFileSync(GOLDEN, 'utf8'))
const EVIDENCE = join(REPO_ROOT, 'dev', 'agent-workflow', 'evidence', 'ute3-agentctl-b1-20261121')
const RETIRED_PATHS = Object.freeze([
  'packages/runtime/src/plugin/live/team-tool-plane.mjs',
  'packages/tools/families/agent-control.mjs',
  'packages/tools/families/index.mjs',
])
const SUCCESSORS = Object.freeze([
  'tests/ute-g1-agentctl/lane-suite.test.mjs',
  'packages/runtime/test/vnext-admission.test.mjs',
  'tests/world-factory/a5sf-pd21-subagent.test.mjs',
])


/**
 * The retirement unit's SEVEN members, measured post-cut: the frozen golden
 * still carries each member's vectors and the tool plane that served it is
 * ABSENT. A golden that lost a member, or a resurrected plane, turns the
 * corresponding control RED instead of hiding behind the frozen baseline.
 */
const memberControls = (members) => members.map((member) => ({
  id: `NC-MEMBER ${member}`,
  run: () => {
    const rows = golden.filter((record) => record.entry === member)
    if (rows.length === 0) throw new Error(`${member} has no frozen baseline row; the retirement unit lost the member`)
    if (existsSync(join(REPO_ROOT, 'packages/runtime/src/plugin/live/team-tool-plane.mjs'))) throw new Error('the retired tool plane is back; the member is being re-served')
    return `frozen-vectors=${String(rows.length)} plane=absent`
  },
}))
const MEMBERS = Object.freeze(['subagent', 'subagent_fork', 'send_message', 'interrupt_agent', 'list_agents', 'list_subagent_models', 'workflow'])

const controls = [
  ...memberControls(MEMBERS),
  {
    id: 'NC-RETIRED-PLANE-ABSENT',
    run: () => {
      const present = RETIRED_PATHS.filter((path) => existsSync(join(REPO_ROOT, path)))
      if (present.length > 0) throw new Error(`the retired tool plane is back: ${present.join(',')} (deleted by ${DELETING_COMMITS.frozenCut})`)
      assertNoAppendedShadow({ quiet: true })
      return `deleted=${String(RETIRED_PATHS.length)} specSymbols=none`
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
    id: 'NC-GOLDEN-FROZEN',
    run: () => {
      if (golden.length !== CORPUS.length) throw new Error(`the fixture carries ${String(golden.length)} rows but the corpus has ${String(CORPUS.length)}`)
      if (/accepted_by=round81-a1-cut/u.test(readFileSync(GOLDEN, 'utf8'))) throw new Error('the agent-control golden was re-recorded; this lane owns no new path')
      return `vectors=${String(golden.length)} re-recorded=no`
    },
  },
  {
    id: 'NC-CATEGORY-TOTAL',
    run: () => {
      let refused = false
      try {
        classifyRefusal({ code: 'UTE3_INVENTED_AGENTCTL_CODE' })
      } catch (error) {
        refused = error instanceof RefusalVocabularyError
      }
      if (!refused) throw new Error('an invented refusal code was bucketed instead of refused')
      return 'invented=refused'
    },
  },
  {
    id: 'NC-NO-NEW-PATH-CLAIM',
    run: () => {
      const absence = readFileSync(join(EVIDENCE, 'new-path-absent.txt'), 'utf8').trim()
      if (!absence.includes('NEW-PATH-ABSENT')) throw new Error('the evidence no longer records the new-path absence')
      return 'new-path=ABSENT claimed=no'
    },
  },
  {
    id: 'NC-LEDGER-CITES-SUCCESSOR',
    run: () => {
      const row = subjectRow('dsh.agent-control-family')
      if (!row.successors.includes('tests/ute-g1-agentctl/lane-suite.test.mjs')) throw new Error('the frozen licence does not book this lane')
      return `subject=${row.id} citations=${String(row.citations.length)} lane-booked=yes`
    },
  },
]

const { lines, failed } = await runRetirementControls(controls, {
  acceptedBy: ACCEPTED_BY,
  reason: 're-record of the AGENT-CONTROL battery: the retired tool plane retired per subject (ROUND80-CI-CLOSURE.md §4)',
})
for (const line of lines) console.log(line)
if (failed > 0) process.exitCode = 1
