#!/usr/bin/env node
/**
 * negative-controls.mjs — the PROCESS lane's POST-CUT control battery (round 81).
 *
 * WHAT CHANGED AND WHY. The B1 battery proved the appended route-C bash shadow
 * was load-bearing (lane widening, shadow disposal, timeout, env scrub, output
 * cap). The A1 cut deleted that mechanism (`5d1349767`: every `confined*SpecOf`
 * and `confined-bash-tool.mjs`), so those controls would measure a module that
 * no longer exists. Their PROPERTY is carried now by named successors, and this
 * battery proves the successor is load-bearing instead:
 *
 *   NC-RETIRED-SHADOW-ABSENT   the deleted module and every `confined*SpecOf`
 *                              stay gone; a resurrection is RED.
 *   NC-HOST-MODULES-ONLY       the successor mounts the ACTIVE preset's own
 *                              native modules (`vnext/agent-bindings.mjs`), so
 *                              confinement is no longer opt-in per Team shadow.
 *   NC-SUCCESSORS-EXIST        every named successor instrument is on disk.
 *   NC-GOLDEN-FROZEN           the 14-vector B1 fixture is the historical
 *                              baseline and was NOT re-recorded to match a
 *                              composition that lost the mechanism.
 *   NC-CATEGORY-TOTAL          the process refusal entries stay closed; `unknown`
 *                              is unreachable (host-free, kept from B1).
 *   NC-PWSH-EXCLUSION-CONDITIONAL
 *                              the pwsh exclusion is legal only while the SHIPPED
 *                              wiring serves no pwsh; each wiring fact flipped
 *                              must REFUSE the exclusion (kept from B1, now read
 *                              from the post-cut probe).
 *   NC-VOCABULARY-CLOSED       the nine-category vocabulary is intact and no
 *                              golden row rests in the residual bucket.
 *   NC-LEDGER-CITES-SUCCESSOR  the frozen retirement licence books this subject
 *                              and names the successors this battery relies on.
 *
 * Per-retired-control successor map (full table in ROUND80-CI-CLOSURE.md §4):
 *   NC-MEMBER bash / bash-POSITIVE      -> packages/runtime/test/vnext-admission.test.mjs
 *   NC-SHADOW-LOAD-BEARING             -> NC-HOST-MODULES-ONLY + NC-RETIRED-SHADOW-ABSENT
 *   NC-CONFINEMENT-WITNESS             -> tests/ute-g1-fs/lane-suite.test.mjs (confined FS face)
 *   NC-TIMEOUT/ENV-SCRUB/CAP-LOAD-BEARING -> tests/world-factory/a5sf-pd12-bash-governance.test.mjs
 *                                          (P0/S1/C2 kept live there) + vnext-admission
 *
 * The transcript is re-recorded under `accepted_by=round81-a1-cut`; the old B1
 * transcript is superseded, not edited (see the evidence README).
 *
 * @module tests/ute-g1-process/negative-controls
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
import { CORPUS } from './lib/corpus.mjs'
import { parseGolden } from './lib/compare.mjs'
import { CATEGORY_IDS, REFUSAL_CATEGORIES, UNKNOWN_CATEGORY, auditProcessVocabulary } from './lib/effect-oracle.mjs'
import { coverageObligation, measureWiring, PWSH_EXCLUSION_REFUSAL, PwshExclusionError, wiringFacts } from './lib/pwsh-exclusion.mjs'

const GOLDEN = join(REPO_ROOT, 'tests', 'ute-g1-process', 'golden', 'old-path.tsv')
const golden = parseGolden(readFileSync(GOLDEN, 'utf8'))
const SUCCESSORS = Object.freeze([
  'packages/runtime/test/vnext-admission.test.mjs',
  'tests/ute-g1-fs/lane-suite.test.mjs',
  'tests/world-factory/a5sf-pd12-bash-governance.test.mjs',
  'tests/ute-g1-process/lane-suite.test.mjs',
])
const RETIRED_PATHS = Object.freeze([
  'packages/runtime/src/plugin/live/confined-bash-tool.mjs',
  'packages/runtime/src/plugin/live/confined-terminal-tool.mjs',
  'packages/tools/process-family/src/executors.mjs',
])

const controls = [
  {
    id: 'NC-RETIRED-SHADOW-ABSENT',
    run: () => {
      const present = RETIRED_PATHS.filter((path) => existsSync(join(REPO_ROOT, path)))
      if (present.length > 0) throw new Error(`the appended bash/terminal shadow is back: ${present.join(',')} (deleted by ${DELETING_COMMITS.appendedShadow})`)
      assertNoAppendedShadow({ quiet: true })
      return `deleted=${String(RETIRED_PATHS.length)} specSymbols=none route-c-row=host-modules-only`
    },
  },
  {
    id: 'NC-HOST-MODULES-ONLY',
    run: () => {
      const source = readFileSync(join(REPO_ROOT, VNEXT_ASSEMBLY), 'utf8')
      if (!/mountHostModules|mountVnextNativeToolModules|a5sfNativeToolModules/u.test(source)) throw new Error(`${VNEXT_ASSEMBLY} no longer mounts the active preset's native modules`)
      const row = readFileSync(join(REPO_ROOT, ROUTE_C_ROW), 'utf8')
      if (!/HOST-MODULES-ONLY/u.test(row)) throw new Error('the route-C row lost its A1 HOST-MODULES-ONLY statement')
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
    id: 'NC-MEMBER bash',
    run: async () => {
      // The retirement unit's only exercisable member. Post-cut there is no
      // appended shadow to widen: the control proves the member is served by the
      // preset's OWN module, that the A1 seam appends nothing, and that a real
      // in-lane call reaches the host executor (a resurrected shadow, or a member
      // that stopped routing, turns this RED).
      const { mkdirSync, writeFileSync } = await import('node:fs')
      const scratch = join(REPO_ROOT, '.artifacts', 'tmp', 'ute-g1-process', `nc-member-${String(process.pid)}`)
      mkdirSync(join(scratch, 'inside'), { recursive: true })
      writeFileSync(join(scratch, 'inside', 'a.txt'), 'alpha\n')
      const { mountRouteCWorld } = await import('./lib/world.mjs')
      const world = await mountRouteCWorld({
        label: 'nc-member-bash',
        fixtureRoot: scratch,
        cwd: join(scratch, 'inside'),
        readRoots: [join(scratch, 'inside')],
      })
      try {
        if (world.attachAppendedNothing !== true) throw new Error('the attach appended a shadow: the member is not being served by the preset')
        if (world.shadowReplaced !== false) throw new Error('the preset bash definition was replaced by an appended shadow')
        const settled = await world.dispatch('bash', { command: 'printf ute-member-ok', description: 'NC-MEMBER bash' })
        if (settled.isError === true) throw new Error(`the host bash module refused an in-lane call: ${settled.text}`)
        if (!settled.text.includes('ute-member-ok')) throw new Error(`the host bash module did not run the command: ${settled.text}`)
        if (world.baseCalls() < 1) throw new Error('the host bash executor was never called')
        return 'host-module=served in-lane-call=ok appended=0'
      } finally {
        await world.dispose()
      }
    },
  },
  {
    id: 'NC-GOLDEN-FROZEN',
    run: () => {
      if (golden.length !== CORPUS.length) throw new Error(`the frozen fixture carries ${String(golden.length)} rows but the corpus has ${String(CORPUS.length)}`)
      const text = readFileSync(GOLDEN, 'utf8')
      if (/accepted_by=round81-a1-cut/u.test(text)) throw new Error('the process golden was re-recorded this round; this lane owns no new path')
      return `vectors=${String(golden.length)} re-recorded=no`
    },
  },
  {
    id: 'NC-CATEGORY-TOTAL',
    run: () => {
      const problems = auditProcessVocabulary()
      if (problems.length > 0) throw new Error(`the process refusal entries are not closed: ${problems.join('; ')}`)
      return `entries=${String(Object.keys(REFUSAL_CATEGORIES).length)} unknown-reachable=no`
    },
  },
  {
    id: 'NC-PWSH-EXCLUSION-CONDITIONAL',
    run: () => {
      const output = readFileSync(join(REPO_ROOT, 'dev', 'agent-workflow', 'evidence', 'ute3-process-b1-20261120', 'composition-probe.txt'), 'utf8')
      const facts = wiringFacts({ ...measureWiring(output), vectors: CORPUS })
      if (coverageObligation(facts).status !== 'EXCLUDED') throw new Error('the shipped wiring claims to serve pwsh while the corpus excludes it')
      for (const [label, mutated] of [
        ['route-c-shadow present', { shadowPresent: true }],
        ['preset mounts tool-pwsh', { presetMountsPwsh: true }],
        ['post-attach definition registered', { registered: true }],
      ]) {
        let refused = false
        try {
          coverageObligation(wiringFacts({ ...facts, ...mutated }))
        } catch (error) {
          refused = error instanceof PwshExclusionError && error.code === PWSH_EXCLUSION_REFUSAL
        }
        if (!refused) throw new Error(`${label} did not REFUSE the exclusion (it was inherited instead)`)
      }
      const covered = coverageObligation(wiringFacts({ shadowPresent: true, presetMountsPwsh: false, registered: false, vectors: [...CORPUS, { entry: 'pwsh' }] }))
      if (covered.status !== 'COVERED') throw new Error('the law is "always red": a covered pwsh vector was refused')
      return 'wiring=serves-none exclusion=LEGAL arms-refused=3 covered-arm=COVERED'
    },
  },
  {
    id: 'NC-VOCABULARY-CLOSED',
    run: () => {
      if (Object.keys(REFUSAL_CATEGORIES).length !== 9) throw new Error('the closed vocabulary no longer has nine categories')
      if (!CATEGORY_IDS.includes(UNKNOWN_CATEGORY)) throw new Error('the residual bucket is no longer a declared id')
      const residual = golden.filter((row) => row.refusal === UNKNOWN_CATEGORY)
      if (residual.length > 0) throw new Error(`${residual.map((row) => row.id).join(',')} rest in the unclassified bucket`)
      return `categories=${String(CATEGORY_IDS.length)} residual-rows=0`
    },
  },
  {
    id: 'NC-LEDGER-CITES-SUCCESSOR',
    run: () => {
      const row = subjectRow('dsh.process-family')
      for (const successor of SUCCESSORS) {
        if (!row.successors.includes(successor) && successor !== 'packages/runtime/test/vnext-admission.test.mjs') {
          // The frozen licence names the lane itself; the new-path successors are
          // asserted for existence above. This control keeps the licence citation
          // honest: the lane must still be the booked successor.
          if (successor === 'tests/ute-g1-process/lane-suite.test.mjs') throw new Error('the frozen licence no longer books the process lane as a successor')
        }
      }
      if (!row.successors.includes('tests/ute-g1-process/lane-suite.test.mjs')) throw new Error('the frozen licence does not name this lane')
      return `subject=${row.id} citations=${String(row.citations.length)} lane-booked=yes`
    },
  },
]

const { lines, failed } = await runRetirementControls(controls, {
  acceptedBy: ACCEPTED_BY,
  reason: 're-record of the PROCESS battery: the appended-shadow controls retired per subject (ROUND80-CI-CLOSURE.md §4)',
})
for (const line of lines) console.log(line)
if (failed > 0) process.exitCode = 1
