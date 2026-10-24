/**
 * A5M2 B-ORCHESTRATION EXECUTION-ARM closure (records 47 workflow / 48
 * ralph): the contract-listed 未开发治理执行臂 = the EXECUTION CONSUMER
 * side. This module is the contract-legal completion: a TYPED
 * DECLARED_INACTIVE block — the frozen backlog row's own clause governs
 * its shape ("workflow 若 abstract start() 复核成立则交付
 * un-landable-without-[公开 run-control 接口] 证据不假完整", ALPHA5-
 * EFFECTIVE-BACKLOG B-ORCHESTRATION line). The abstract start() recheck
 * HOLDs (freshly re-measured at the pinned venue this round — citations
 * below), so a consumer whose ONLY production walk could enter nothing
 * but typed refusals would be 假完整; what lands instead is the real
 * consumer FACE in its gated state: ONE typed refusal is its execution
 * surface, the supply gate is named CLOSED, and when (and only when) the
 * gate items land the paired card flips it — this module ships NO flip
 * API, NO delegate, NO path to the engine.
 *
 * Zero-flip law (root): ralph stays declared_mount, host-preset-off in
 * every shipped preset; nothing here can flip any mount condition — the
 * mount conditions are restated as FACT, not governed from here.
 *
 * FRESH RECHECK @ tests/deepseek-harness-test-use (pinned 639ed01539):
 *  - `export abstract class WorkflowEngine extends Service` —
 *    packages/workflow/workflow/src/index.ts:157
 *  - `abstract start(request: WorkflowStartRequest): WorkflowRun` — :168
 *    (the PUBLISHED face is EXACTLY this one method; no status, no
 *    cancel, no child census, no per-child admission fact)
 *  - bodies hand their requests to `ctx.workflowEngine.start(...)`:
 *    tool-workflow/src/index.ts:282 and :433; tool-ralph/src/index.ts:445
 *    (ralph additionally carries subagentProvider/maxTotalAgents).
 * The adapter census (workflow-adapters.mjs, frozen @a749cd4cb family;
 * NAMED GAPS PRE_ENGINE_CHILD_FACTORY :149 + CHILD_ADMISSION :150) states
 * the consumer's obligations CANNOT be expressed or verified outside the
 * concrete engine CENTER built before the tool was callable.
 *
 * @module @dsh-agent-team/runtime/plugin/live/governed-families/workflow-execution-consumer
 */

export const A5_B_ORCH_EXEC_RECORDS = Object.freeze(['workflow', 'ralph'])

/** The one state both arms carry at this tip — typed, per record. */
export const A5_B_ORCH_EXEC_STATES = Object.freeze({
  workflow: Object.freeze({
    record: 47,
    state: 'DECLARED_INACTIVE',
    mountCondition: 'always (host-preset-on)',
    reasonCode: 'P_B_ORCH_EXEC_UNLANDABLE_RUN_CONTROL',
    why: 'the execution consumer needs run facts BEYOND the settled answer (run status, per-child admission, cancel convergence) to govern; the published engine face is EXACTLY abstract start() (workflow/workflow/src/index.ts:157,168 @639ed01539, re-measured this round) — a governance consumer over that face would govern NOTHING and claim more than it verifies (contract: 不假完整)',
    citations: Object.freeze([
      'workflow/workflow/src/index.ts:157 export abstract class WorkflowEngine extends Service',
      'workflow/workflow/src/index.ts:168 abstract start(request: WorkflowStartRequest): WorkflowRun',
      'workflow/tool-workflow/src/index.ts:282 run = ctx.workflowEngine.start({',
      'workflow/tool-workflow/src/index.ts:433 const run = ctx.workflowEngine.start({',
    ]),
  }),
  ralph: Object.freeze({
    record: 48,
    state: 'DECLARED_INACTIVE',
    mountCondition: 'declared_mount (host-preset-off in every shipped preset — ZERO-FLIP law restated as fact)',
    reasonCode: 'P_B_ORCH_EXEC_UNLANDABLE_RUN_CONTROL',
    why: 'same engine-face absence as record 47, PLUS the ralph-specific supply facts the consumer would have to govern blind: the FIXED RALPH_SCRIPT/RALPH_META loop and the fresh-provider body law (tool-ralph/src/index.ts:83/:163/:218) live inside the body+engine; the row may only passthrough what the body answers',
    citations: Object.freeze([
      'workflow/tool-ralph/src/index.ts:445 const run = ctx.workflowEngine.start({',
      'workflow/workflow/src/index.ts:157 export abstract class WorkflowEngine extends Service; :168 abstract start(request: WorkflowStartRequest): WorkflowRun (the same published face)',
      'workflow-adapters.mjs:149 PRE_ENGINE_CHILD_FACTORY + :150 CHILD_ADMISSION (frozen named gaps)',
    ]),
  }),
})

/** The CLOSED supply gate: the paired card may land the execution arm
 *  when — and only when — every item below exists as a PUBLIC fact. The
 *  list is frozen data; this module offers NO flip, NO registration, NO
 *  delegate, NO execute. */
export const A5_B_ORCH_EXEC_SUPPLY_GATE = Object.freeze({
  closed: true,
  items: Object.freeze([
    'a PUBLIC run-control interface on/next to the WorkflowEngine face (status/cancel/child facts the consumer can actually read) — absent at 639ed01539 (start() is the published face)',
    'a PLACED B-ORCHESTRATION family rule for the plane PA funnel (measured at tip: the familyId string exists ONLY in workflow-adapters.* and this module — agent-bindings, team-tool-plane and the domain rule tables carry NO B-ORCHESTRATION rule) — without it a consumer walk enters typed refusals at the funnel',
    'the existing frozen adapter chain stays UNTOUCHED beneath any future flip (a749cd4cb adapters + 9826881c fail-closed cancel; supply-gate discipline unchanged: capture + liveNative + delegates + REAL pa funnel, admit seat owned by the wiring, zero unadmitted path)',
  ]),
})

/** The ONLY execution surface of both arms at this tip: a typed refusal.
 *  It never touches a delegate, a native, or the engine; ok is false for
 *  EVERY input, including names inside the family (they are records, not
 *  doors). */
export function refuseBOrchExecution (name) {
  const rec = A5_B_ORCH_EXEC_STATES[typeof name === 'string' ? name : '']
  return Object.freeze({
    ok: false,
    code: rec?.reasonCode ?? 'P_B_ORCH_EXEC_UNKNOWN_RECORD',
    detail: rec === undefined
      ? `'${String(name)}' is not a B-ORCHESTRATION record (the family is EXACTLY workflow|ralph) — no path, no guess`
      : `${String(name)}: execution arm DECLARED_INACTIVE (record ${rec.record}). ${rec.why} Supply gate CLOSED: a paired card with the named PUBLIC facts lands it; until then this refusal IS the governance.`,
  })
}
