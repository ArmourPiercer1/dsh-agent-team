#!/usr/bin/env node
/**
 * negative-controls.mjs — the per-member controls the retirement predicate
 * requires, plus the family-level controls that show the lane's own checks
 * bite.
 *
 * Every control is a MEASURED experiment: it changes exactly one load-bearing
 * fact (the port, the governed root, the lane verdict, the execution arm, the
 * seeded state, the store) and then re-runs the SAME corpus vector. The control
 * PASSES only when the resulting row diverges from the frozen golden row in the
 * field the control claims to move — a control that cannot turn the suite red
 * proves nothing and is reported as a failure.
 *
 * The output lines the retirement gate greps are exactly:
 *   NC-MEMBER <member>                      (one per census member)
 *   NC-HARNESS <control> GREEN|RED
 *   NC-VERDICT GREEN controls=<n> failed=0
 *
 * Usage: node tests/ute-g1-uistate/negative-controls.mjs
 *
 * @module tests/ute-g1-uistate/negative-controls
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { compareRecord, parseGolden } from './lib/compare.mjs'
import { COVERED_MEMBERS, CORPUS } from './lib/corpus.mjs'
import { CATEGORY_EXCLUSIONS, categoricalCoverage, classifyRecord } from './lib/effect-oracle.mjs'
import { REPO_ROOT } from './lib/paths.mjs'
import { categoryOfFamilyRefusal } from './lib/refusal-map.mjs'
import { disposeFixtures, runVector } from './lib/world.mjs'

const GOLDEN = join(REPO_ROOT, 'tests', 'ute-g1-uistate', 'golden', 'old-path.tsv')
const golden = parseGolden(readFileSync(GOLDEN, 'utf8'))
const byId = (id) => {
  const row = golden.find((record) => record.id === id)
  if (row === undefined) throw new Error(`the golden has no vector ${id}`)
  return row
}
const vectorOf = (id) => {
  const vector = CORPUS.find((candidate) => candidate.id === id)
  if (vector === undefined) throw new Error(`the corpus has no vector ${id}`)
  return vector
}

/**
 * The per-member controls. Each names the member it guards, the vector it
 * re-runs, the ONE fact it changes, and the field that must move.
 */
export const MEMBER_CONTROLS = Object.freeze([
  {
    member: 'ask_user_question',
    id: 'ask-port-removed',
    vectorId: 'UI-A1-single-answer',
    change: 'remove the injected interaction port from an otherwise successful ask',
    override: { port: 'absent' },
    mustMove: ['outcome', 'refusal', 'facts'],
  },
  {
    member: 'present',
    id: 'present-root-widened',
    vectorId: 'UI-P3-outside-root',
    change: 'widen the governed root to the fixture base so the out-of-lane target becomes in-lane',
    override: { rootDir: 'base' },
    mustMove: ['outcome', 'refusal'],
  },
  {
    member: 'todo_write',
    id: 'todo-lane-allowed',
    vectorId: 'AS-T6-lane-deny',
    change: 'turn the lane verdict from deny to allow',
    override: { decide: undefined },
    mustMove: ['outcome', 'effects', 'facts'],
  },
  {
    member: 'get_goal',
    id: 'get-goal-other-scope',
    vectorId: 'AS-G3-cross-scope',
    change: 'call as the agent the goal was planted under (the scope is the only reason the read is empty)',
    override: { agent: 'agent-ute3-other' },
    mustMove: ['effects'],
  },
  {
    member: 'create_goal',
    id: 'create-arm-direct-human',
    vectorId: 'AS-C2-model-arm',
    change: 'give the model arm the direct-human origin (authority is the only reason the create is withheld)',
    override: { arm: 'direct-human' },
    mustMove: ['outcome', 'refusal', 'effects', 'facts'],
  },
  {
    member: 'update_goal',
    id: 'update-revision-current',
    vectorId: 'AS-U8-stale-revision',
    change: 'send the CURRENT revision instead of the stale one (the CAS is the only reason the edit is withheld)',
    override: { args: { goal_id: 'goal-seed-1', revision: 1, action: 'edit', objective: 'Stale edit' }, seedGoal: {} },
    mustMove: ['outcome', 'refusal', 'effects', 'facts'],
  },
  {
    member: 'exit_plan_mode',
    id: 'exit-plan-mode-seeded',
    vectorId: 'AS-E2-not-in-plan-mode',
    change: 'plant plan mode active (the mode is the only reason the exit is withheld)',
    override: { seedPlanMode: true },
    mustMove: ['outcome', 'refusal', 'effects', 'facts'],
  },
])

/**
 * Family-level controls: the harness's own witnesses. Each returns a problem
 * list (empty = GREEN).
 */
export const HARNESS_CONTROLS = Object.freeze([
  {
    id: 'compare-bites',
    description: 'a single flipped cell makes the golden comparison fail, and it fails on exactly that vector',
    run() {
      const row = byId('AS-T1-write-three')
      const mutated = { ...row, effects: `${row.effects};@tampered` }
      const verdict = compareRecord(row, mutated)
      return verdict.ok === false && verdict.diffs.length === 1 && verdict.diffs[0].field === 'effects'
        ? []
        : [`the comparison accepted a tampered effects cell: ${JSON.stringify(verdict)}`]
    },
  },
  {
    id: 'category-vocabulary-total',
    description: 'an unmapped code raises REFUSAL_VOCABULARY_INCOMPLETE instead of landing in a default bucket',
    run() {
      try {
        categoryOfFamilyRefusal('NOT_A_REAL_CODE')
        return ['an unmapped refusal code was accepted; the vocabulary has a default bucket']
      } catch (error) {
        return error?.code === 'REFUSAL_VOCABULARY_INCOMPLETE' ? [] : [`the vocabulary raised ${String(error?.code)} instead of REFUSAL_VOCABULARY_INCOMPLETE`]
      }
    },
  },
  {
    id: 'category-coverage-declared',
    description: 'every category is either reached by the corpus or printed as an exclusion; dropping an exclusion turns the check red',
    run() {
      const records = golden.map((row) => ({ ...row }))
      const declared = categoricalCoverage(records)
      if (declared.missing.length !== 0) return [`categories neither reached nor excluded: ${declared.missing.join(',')}`]
      // Drop the exclusion list and the same corpus MUST report those categories
      // as unaccounted for. That is the control: the declaration is load-bearing.
      const reached = new Set(records.map((row) => row.refusal).filter((refusal) => refusal !== null))
      const unaccounted = Object.keys(CATEGORY_EXCLUSIONS).filter((category) => !reached.has(category))
      return unaccounted.length === Object.keys(CATEGORY_EXCLUSIONS).length
        ? []
        : ['the exclusion set does not correspond to unreached categories']
    },
  },
  {
    id: 'store-witness-load-bearing',
    description: 'faulting the durable store turns an admitted todo_write into AGENT_STATE_STORE_FAULT with zero writes',
    async run() {
      const vector = vectorOf('AS-T1-write-three')
      try {
        const raw = await runVector({ ...vector, storeFault: true })
        const record = classifyRecord(vector, raw)
        const problems = []
        if (record.outcome !== 'deny') problems.push(`faulted store still reported ${record.outcome}`)
        if (record.code !== 'AGENT_STATE_STORE_FAULT') problems.push(`faulted store answered ${record.code}`)
        if (record.facts.durableWrites !== 0) problems.push(`faulted store committed ${String(record.facts.durableWrites)} write(s)`)
        return problems
      } finally {
        disposeFixtures()
      }
    },
  },
  {
    id: 'effect-witness-load-bearing',
    description: 'an admitted sticky claim without its port token is caught by the design claim (the port log is the witness)',
    run() {
      const row = byId('UI-P1-one-file')
      const problems = []
      if (!row.effects.includes('@published:')) problems.push('an admitted present row carries no independent publication witness')
      if (!row.effects.includes('@ask:') && row.entry === 'ask_user_question' && row.outcome === 'allow') problems.push('an admitted ask row carries no port witness')
      const stripped = { ...row, effects: row.effects.split(';').filter((part) => !part.startsWith('@published:')).join(';') }
      if (stripped.effects !== row.effects) {
        const verdict = compareRecord(row, stripped)
        if (verdict.ok !== false) problems.push('stripping the publication witness did not fail the comparison')
      }
      return problems
    },
  },
  {
    id: 'durable-readback-load-bearing',
    description: 'an allow row must carry a durable record readback that a refusal row does not',
    run() {
      const problems = []
      for (const row of golden) {
        if (row.family !== 'agent-state') continue
        const hasRecord = row.effects.includes('@record:')
        if (row.outcome === 'allow' && row.facts.durableWrites > 0 && !hasRecord) problems.push(`${row.id} committed but carries no durable readback`)
      }
      return problems
    },
  },
])

/** Run every control and print the machine tokens. */
export async function runNegativeControls() {
  const results = []
  const failures = []
  for (const control of MEMBER_CONTROLS) {
    const vector = vectorOf(control.vectorId)
    const expected = byId(control.vectorId)
    let problems = []
    try {
      const raw = await runVector({ ...vector, ...control.override })
      const observed = classifyRecord(vector, raw)
      const verdict = compareRecord(expected, observed)
      const moved = new Set(verdict.diffs.map((diff) => diff.field))
      if (verdict.ok) problems.push(`control "${control.id}" did not move any graded field (the guarded behaviour is not load-bearing)`)
      for (const field of control.mustMove) {
        if (!moved.has(field)) problems.push(`control "${control.id}" did not move required field "${field}" (moved: ${[...moved].join(',') || 'none'})`)
      }
    } catch (error) {
      problems.push(`control "${control.id}" threw instead of measuring: ${String(error?.message ?? error)}`)
    } finally {
      disposeFixtures()
    }
    results.push({ kind: 'member', member: control.member, id: control.id, problems })
  }
  for (const control of HARNESS_CONTROLS) {
    let problems = []
    try {
      problems = (await control.run()) ?? []
    } catch (error) {
      problems = [`control "${control.id}" threw: ${String(error?.message ?? error)}`]
    } finally {
      disposeFixtures()
    }
    results.push({ kind: 'harness', id: control.id, problems })
  }
  for (const result of results) {
    if (result.kind === 'member') console.log(`NC-MEMBER ${result.member} control=${result.id} ${result.problems.length === 0 ? 'GREEN' : 'RED'}`)
    else console.log(`NC-HARNESS ${result.id} ${result.problems.length === 0 ? 'GREEN' : 'RED'}`)
    for (const problem of result.problems) {
      console.error(`NC-FAIL ${result.kind}:${result.id} ${problem}`)
      failures.push(`${result.kind}:${result.id}`)
    }
  }
  // Every census member must carry a control: a missing member is a failure,
  // never a silently smaller control set.
  const guarded = new Set(MEMBER_CONTROLS.map((control) => control.member))
  for (const member of COVERED_MEMBERS) {
    if (!guarded.has(member)) {
      console.error(`NC-FAIL member:${member} no negative control guards this member`)
      failures.push(`member:${member}`)
    }
  }
  const verdict = failures.length === 0 ? 'GREEN' : 'RED'
  console.log(`NC-VERDICT ${verdict} controls=${String(results.length)} failed=${String(failures.length)}`)
  return { verdict, results, failures }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { verdict } = await runNegativeControls()
  if (verdict !== 'GREEN') process.exitCode = 1
}
