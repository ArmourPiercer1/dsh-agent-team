/**
 * semantic-differences.mjs — the differences that BLOCK a silent retirement.
 *
 * A family is only retireable when its old path is gone AND the replacement is
 * verified AND every semantic difference is resolved. This lane delivers the
 * baseline and the controls; it does NOT deliver a replacement, so every
 * difference below stays BLOCKING and unapproved (`approval: null` in the
 * ledger row). Each entry is MEASURED at test time — a claim whose evidence
 * stopped being true turns the suite red rather than ageing into folklore.
 *
 * @module tests/ute-g1-uistate/lib/semantic-differences
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { PRISTINE_ROOT, REPO_ROOT } from './paths.mjs'

const read = (rel) => readFileSync(join(REPO_ROOT, rel), 'utf8')
const readHost = (rel) => readFileSync(join(PRISTINE_ROOT, rel), 'utf8')

/**
 * ROUND 81: the MEASUREMENT below lived on the governed family bodies
 * (`packages/tools/{ui,agent-state}-family`), deleted by the A0 frozen cut
 * (`5d1349767`/`93ba0a1d1`). The declaration stays binding — every difference is
 * still blocking and unapproved — but `assertMeasured` can no longer be derived
 * from those sources. The historical measurement is the B1 composition probe
 * (`dev/agent-workflow/evidence/ute3-uistate-b1-20261121/composition-probe.txt`).
 */
export const SEMANTIC_MEASUREMENT_RETIRED = Object.freeze({
  by: '5d1349767+93ba0a1d1',
  sources: Object.freeze([
    'packages/tools/families/ui.mjs',
    'packages/tools/families/agent-state.mjs',
    'packages/tools/agent-state-family/src/executors.mjs',
  ]),
  historicalEvidence: 'dev/agent-workflow/evidence/ute3-uistate-b1-20261121/composition-probe.txt',
})

/** The differences, each with the measurement that kept it honest. */
export const SEMANTIC_DIFFERENCES = Object.freeze([
  {
    id: 'two-implementations',
    klass: 'definition-surface',
    blocking: true,
    statement: 'SIX of the SEVEN booked spellings are declared twice AND mounted on the product preset: by a governed family body (packages/tools/{ui,agent-state}-family) and by the pinned host package the Member preset mounts (present + the four agent-state rows). `ask_user_question` is the exception: both sides DECLARE the name, but the preset does NOT mount tool-ask-user (PD-25), so the host implementation is unreachable. Retiring the governed body would not remove the six mounted host implementations, and those host rows would not adopt the governed law.',
    evidence: [
      'dev/agent-workflow/evidence/ute3-uistate-b1-20261121/composition-probe.txt (PROBE-UISTATE … two-implementations=yes, one line per member)',
      'packages/tools/ui-family/src/{ask-row,present-row}.mjs + packages/tools/agent-state-family/src/executors.mjs (governed name declarations)',
      'tests/deepseek-harness-test-use/packages/{interaction/tool-ask-user,deliverables/tool-present,todo/tool-todo,goal/tool-goal,plan/plan-mode}/lib/index.js (host name declarations)',
    ],
    assertMeasured({ sites }) {
      const problems = []
      for (const [member, fact] of Object.entries(sites)) {
        if (fact.governedBody.length === 0) problems.push(`${member}: no governed-body declaration`)
        if (fact.hostDefinition.length === 0) problems.push(`${member}: no host declaration`)
      }
      return problems
    },
  },
  {
    id: 'refusal-vocabulary',
    klass: 'refusal-code',
    blocking: true,
    statement: 'The governed rows answer TYPED codes from the family vocabulary (ask-unknown-parameter, GOAL_STALE_REVISION, template-default-deny, …) for BOTH their own pre-flight law and the lane/PA edges they walk; the host ask row has no pre-flight at all (no closed-parameter law beyond the schema, no lane, no admission edge) and the host present row throws plain Error sentences. A caller migrated from the host implementation cannot match on the governed codes without changing its handling, and cannot observe the same refusals on the host path because they do not exist there.',
    evidence: [
      'tests/deepseek-harness-test-use/packages/interaction/tool-ask-user/src/index.ts (no decide/approval/closed-parameter leg; delegates to ctx.userQuestions.ask)',
      'tests/deepseek-harness-test-use/packages/deliverables/tool-present/src/index.ts:79 (throw new Error(\'present requires an open turn\'))',
      'packages/tools/ui-family/src/{ask-executor,present-executor}.mjs (the governed pre-flight + lane + PA walk)',
      'tests/ute-g1-uistate/golden/old-path.tsv code column (the governed vocabulary the corpus observed)',
    ],
    assertMeasured({ codes }) {
      const problems = []
      if (codes.length < 25) problems.push(`the corpus observed only ${String(codes.length)} typed codes; the vocabulary claim needs the measured set`)
      const hostAsk = readHost('packages/interaction/tool-ask-user/src/index.ts')
      if (/decide\(|approval|requestedEffects/.test(hostAsk)) problems.push('the host ask row now walks a lane/PA edge; re-measure the refusal difference')
      if (!/ctx\.userQuestions\.ask\(/.test(hostAsk)) problems.push('the host ask row no longer delegates to the userQuestions service')
      if (!/throw new Error\('present requires an open turn'\)/.test(readHost('packages/deliverables/tool-present/src/index.ts'))) {
        problems.push('the host present row no longer throws the open-turn sentence; re-measure')
      }
      return problems
    },
  },
  {
    id: 'result-envelope',
    klass: 'result-shape',
    blocking: true,
    statement: 'The agent-state rows return the plane\'s closed `{text}` envelope (JSON stringified into `text`, refusals as `refused: <CODE> — …` inside it), while the host rows return structured objects. A model or caller reading the result sees a different shape for the same operation.',
    evidence: [
      'packages/tools/agent-state-family/src/executors.mjs (const accepted = (value) => ({ text: JSON.stringify(value) }))',
      'packages/runtime/src/plugin/live/team-tool-plane.mjs:146-152 (the plane presentation face is a closed {text} schema)',
      'tests/deepseek-harness-test-use/packages/todo/tool-todo/src/index.ts:199 (host returns the canonical list object)',
    ],
    assertMeasured() {
      const problems = []
      if (!/const accepted = \(value\) => \(\{ text: JSON\.stringify\(value\) \}\)/.test(read('packages/tools/agent-state-family/src/executors.mjs'))) {
        problems.push('the governed rows no longer return the {text} envelope; re-measure the result-shape difference')
      }
      return problems
    },
  },
  {
    id: 'present-receipt-turn',
    klass: 'lifecycle',
    blocking: true,
    statement: 'The governed present requires the injected presentation face to return an INTEGER receipt turn and treats a success without one as failed; the host present derives the turn from the host\'s own `sessionProjections` turn-boundary projection. The governed row never reads that host service.',
    evidence: [
      'packages/tools/ui-family/src/present-executor.mjs (UI_PRESENT_RECEIPT_INVALID)',
      'tests/deepseek-harness-test-use/packages/deliverables/tool-present/src/index.ts:61,:79 (turn: integer required; stateOf(…, \'turnBoundary\'))',
      'tests/ute-g1-uistate/golden/old-path.tsv (UI-P10-receipt-without-turn)',
    ],
    assertMeasured() {
      const host = readHost('packages/deliverables/tool-present/src/index.ts')
      const problems = []
      if (!/stateOf\([\s\S]{0,80}'turnBoundary'\)/.test(host)) problems.push('the host present no longer derives the turn from sessionProjections')
      if (!/UI_PRESENT_RECEIPT_INVALID/.test(read('packages/tools/ui-family/src/present-executor.mjs'))) problems.push('the governed receipt law moved; re-measure')
      return problems
    },
  },
  {
    id: 'timed-pending-shape',
    klass: 'deadline',
    blocking: true,
    statement: 'The governed timed ask answers an expired wait with `{pending:true, callId, message}` and DROPS any answers the port attached to the pending result; the host timed tool answers its own pending shape. The pending outcome is never a fabricated answer on either path, but the payload a caller sees differs.',
    evidence: [
      'packages/tools/ui-family/src/ask-executor.mjs (the pending branch, answers dropped)',
      'tests/deepseek-harness-test-use/packages/interaction/tool-ask-user/src/timed.ts (host timed pending, bundled into lib/index.js)',
      'tests/ute-g1-uistate/golden/old-path.tsv (UI-A10-timed-pending)',
    ],
    assertMeasured() {
      const executor = read('packages/tools/ui-family/src/ask-executor.mjs')
      const problems = []
      if (!/pending: true, callId, message: PENDING_NOTICE/.test(executor)) problems.push('the governed pending payload moved; re-measure')
      if (!/pending/.test(readHost('packages/interaction/tool-ask-user/src/timed.ts'))) problems.push('the host timed tool no longer answers a pending outcome')
      return problems
    },
  },
  {
    id: 'state-sink',
    klass: 'state-sink',
    blocking: true,
    statement: 'The governed agent-state family persists to its own durable JSON records under the harness home (goal/todos/plan-mode per scope, with an O_EXCL applyId ledger); the host persists todos and goals through session events. The two sinks are not interchangeable, so state written by one is invisible to the other.',
    evidence: [
      'packages/tools/agent-state-family/src/fs-state-store.mjs (per-scope records + attempts.jsonl/writes.jsonl)',
      'tests/deepseek-harness-test-use/packages/todo/tool-todo/src/index.ts:199 (session.append(\'todo/write\'))',
      'tests/ute-g1-uistate/golden/old-path.tsv (@write/@attempt/@ledger effect tokens)',
    ],
    assertMeasured({ golden }) {
      const problems = []
      if (!/session\.append\('todo\/write'/.test(readHost('packages/todo/tool-todo/src/index.ts'))) problems.push('the host todo sink moved; re-measure')
      if (!golden.some((row) => row.effects.includes('@write:goal/apply'))) problems.push('the corpus no longer records the governed goal sink')
      if (!golden.some((row) => row.effects.includes('@ledger:'))) problems.push('the corpus no longer records the governed write ledger')
      return problems
    },
  },
  {
    id: 'product-route-absent',
    klass: 'unit-ownership',
    blocking: true,
    statement: 'The governed family BODY is not mounted on product route-C, but the NAMES are not all absent: the BARE route (a deliberately configured composition with no native tool modules) registers none of the seven names (`unknown tool`), while the shipped preset serves `present` on the preset scope (route-C host shadow) plus the four agent-state names from HOST packages, and `ask_user_question` is deliberately absent from the Member preset (PD-25). What is absent is the bare route registering any of them, not product route-C reachability: 5 of the 7 names are reachable there, served by host preset rows, while the governed body that would be retired is never reached.',
    evidence: [
      'dev/agent-workflow/evidence/ute3-uistate-b1-20261121/composition-probe.txt (PROBE-ROUTE-C-BARE / PROBE-ROUTE-C-PRESET / PROBE-DISPOSITION)',
      'cordis.patch.yml:302+ (preset-a5sf-governed-member: no tool-ask-user row)',
      'packages/runtime/src/plugin/live/a5sf-realm-row.mjs:1405 hostPresentSpecOf (the only route-C ui shadow)',
    ],
    assertMeasured() {
      const preset = read('cordis.patch.yml')
      const problems = []
      // A MOUNTED row, not a comment: the preset's plugin entries are
      // `- id: <row>` / `name: <pkg>` pairs.
      if (/^\s*- id:\s*["']?tool-ask-user/m.test(preset)) problems.push('the Member preset now mounts tool-ask-user; PD-25 changed and the route measurement must be redone')
      if (!/^\s*- id:\s*["']?tool-present/m.test(preset)) problems.push('the Member preset no longer mounts tool-present')
      if (!/^\s*- id:\s*["']?tool-goal/m.test(preset)) problems.push('the Member preset no longer mounts tool-goal')
      return problems
    },
  },
])

/** The printable form of one difference (stable, greppable). */
export function semanticDifferenceLines(differences = SEMANTIC_DIFFERENCES) {
  return differences.map((difference) => `SEMANTIC-DIFF ${difference.id} klass=${difference.klass} blocking=${String(difference.blocking)} approval=${difference.approval === null || difference.approval === undefined ? 'none' : 'recorded'}`)
}

/** Re-derive every measurement the difference list rests on. */
export function assertDifferencesMeasured(context) {
  const problems = []
  for (const difference of SEMANTIC_DIFFERENCES) {
    for (const problem of difference.assertMeasured(context)) problems.push(`${difference.id}: ${problem}`)
  }
  return problems
}
