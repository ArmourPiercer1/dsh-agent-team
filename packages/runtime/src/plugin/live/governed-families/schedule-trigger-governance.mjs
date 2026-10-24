/**
 * schedule-trigger-governance.mjs — the B-SCHEDULE TRIGGER-GOVERNANCE gap
 * record + dispatch gate (root correction 2026-10-26: NO invented seam /
 * root-GO boolean proof; this module carries the MEASURED 639 source gap
 * and gates the delivered create/update arms on it — closure requires a
 * root ruling (public seam vs fork), not a flag flip here).
 *
 * MEASURED SOURCE GAP (639 pristine baseline, read-only; spec pins lines):
 *  G1 FIRING PATH, provider-internal, NO hook:
 *     packages/schedule/schedule/src/runtime.ts:51  drive runs inside
 *       ctx.agents.withoutInitiator(...) — the authority plane sees NO
 *       initiator for a firing task;
 *     runtime.ts:101  ctx.sessionController.resolveAgent(task.sessionId)
 *       (public controller read, allowed);
 *     runtime.ts:123  resolved.agent.followup(message) DIRECTLY —
 *       core/agent-loop/src/agent.ts:163-165: followup -> send(input,
 *       'next-turn', true) -> this.inbox.splice(...) + wakeDriver():
 *       NO event emitted, NO middleware, NO next, NO signal, NO return.
 *       There is no `workspace/session-activity`-style middleware
 *       (schedule's own index.ts:211 rides that pattern) around delivery.
 *  G2 THE API ADMISSION IS UNREACHABLE AND IS NOT PERMISSION GOVERNANCE:
 *     packages/api/session-controller/src/commands.ts:338-365 — the RPC
 *     prompt path admits via ctx.attachments.admitPromptContent +
 *     fileUploads receipts + disposal re-check, THEN agent.followup.
 *     That seam is (a) RPC-only (a provider firing internally cannot
 *     route through it), (b) attachment/liveness admission, NOT PA /
 *     permission admission. No public PA seam exists on any trigger path.
 *  G3 ATTRIBUTION: the task row binds the ORIGINAL Session (tools.ts:437
 *     create via agent.session.id; update pre-reads ownership :515-522);
 *     at firing, source={kind:'schedule'} is a label only — the message
 *     is delivered as a USER message with no initiator (G1).
 *  G4 PARENT CANCELLATION: agent.cancel (agent-loop agent.ts:176-183)
 *     clears the inbox (!keepInbox) — a queued-but-unconsumed reminder is
 *     SILENTLY DROPPED, no governance trace; not-yet-fired rows die at
 *     workspace/session-stop (schedule index.ts:221 -> stopSessionTasks,
 *     the archive-stop law the source comment itself states). Neither is
 *     a pre-delivery decision point.
 *  G5 PERMISSION SUPPLY: the woken Agent's TOOL CALLS ride the existing
 *     governed tools/execute path (the family's tested law) — what is NOT
 *     governed anywhere is the injection decision itself (may this
 *     reminder enter this Session at this moment).
 *
 * CONSEQUENCE (frozen law ALPHA5-EFFECTIVE-BACKLOG.md :67 verbatim:
 * "create/update 触发缺口未闭不可启用亦必交不删; TRIGGER_GOVERNANCE
 * (runtime.ts:101 resolveAgent→:123 followup 无公开 pre-delivery 治理
 * seam) / PLAN_ONCE_MEMO 逐字携带; delete/update=revocation path 注释
 * ≠policy自动撤销"): the create/update governance ARMS are BUILT and
 * WIRED (the pair rides the list/delete tested law: same-Agent native
 * hook, PA final consume, per-name facade capture, native body verbatim
 * with its original scheduling validation + caller constraints) while
 * dispatch refuses with the typed TRIGGER_GOVERNANCE_OPEN citing G1-G5.
 * This block offers NO enablement flag: closure is a ROOT ruling (upstream
 * public seam vs fork of the provider) recorded by a FUTURE card with the
 * chosen public/fork facts — never a boolean flipped here.
 *
 * REUSED LAWS (原样复用): generation epoch + ACTIVE gate read through the
 * SAME public lifecycle face the facade feed rides (host
 * scheduleLifecycle.currentGeneration() shape); epoch unobservable or
 * non-ACTIVE refuses BEFORE the gap fact is even consulted (fail closed);
 * nothing is cached across dispatches. PLAN_ONCE_MEMO 逐字携带: one-shot
 * records commit status inactive + appendDelivery at delivery
 * (runtime.ts:124-128); a governed row never re-plans a once memo.
 * delete/update revocation-path annotations remain comments, NOT policy
 * auto-revocation.
 *
 * Tier: 接线未测 (no boot/Host). win32-irrelevant.
 */

export const A5_SCHEDULE_TRIGGER_CODES = Object.freeze({
  INPUT_INVALID: 'A5_TRIG_INPUT_INVALID',
  LIFECYCLE_UNOBSERVABLE: 'A5_TRIG_LIFECYCLE_UNOBSERVABLE',
  NOT_ACTIVE: 'A5_TRIG_NOT_ACTIVE',
  OPEN: 'TRIGGER_GOVERNANCE_OPEN',
})

/** The measured gap, as PUBLIC SOURCE FACTS (file:line, verified read-only
 *  against the pinned baseline by the paired spec; skip != pass where the
 *  checkout is absent). */
export const A5_SCHEDULE_TRIGGER_GAP = Object.freeze({
  G1_firing_no_hook: Object.freeze({
    drive: 'packages/schedule/schedule/src/runtime.ts:51 (ctx.agents.withoutInitiator)',
    resolve: 'packages/schedule/schedule/src/runtime.ts:101 (sessionController.resolveAgent)',
    followup: 'packages/schedule/schedule/src/runtime.ts:123 (resolved.agent.followup)',
    impl: 'packages/core/agent-loop/src/agent.ts:163-165 (followup->send->inbox.splice+wakeDriver; no event/middleware/next/signal)',
  }),
  G2_api_admission_not_permission: Object.freeze({
    seam: 'packages/api/session-controller/src/commands.ts:338-365 (attachments.admitPromptContent + receipts + disposal re-check)',
    law: 'RPC-only path; attachment/liveness admission, NOT PA permission admission; unreachable from a provider firing internally',
  }),
  G3_attribution: Object.freeze({
    row_binding: 'packages/schedule/schedule/src/tools.ts:437 create via agent.session.id; update pre-reads ownership :515-522',
    firing: 'source={kind:schedule} label only; delivery is a USER message with no initiator',
  }),
  G4_parent_cancellation: Object.freeze({
    queued_drop: 'packages/core/agent-loop/src/agent.ts:176-183 (cancel clears inbox silently unless keepInbox)',
    armed_drop: 'packages/schedule/schedule/src/index.ts:221 (workspace/session-stop -> stopSessionTasks deletes rows)',
    law: 'neither is a pre-delivery decision point',
  }),
  G5_permission_supply: Object.freeze({
    woken_tools: 'governed via the existing tools/execute PA path (family law)',
    ungoverned: 'the injection decision itself (may this reminder enter this Session now)',
  }),
  PLAN_ONCE_MEMO: 'one-shot delivery commits status inactive + appendDelivery (runtime.ts:124-128); governed rows never re-plan a once memo',
  REVOCATION: 'delete/update=revocation path 注释≠policy自动撤销',
  GATED_NAMES: Object.freeze(['schedule_create', 'schedule_update']),
})

/** Frozen Chinese law strings carried VERBATIM (spec pins vs the backlog). */
export const A5_SCHEDULE_TRIGGER_LAWS = Object.freeze({
  FROZEN_DECISION: 'create/update 触发缺口未闭不可启用亦必交不删',
  TRIGGER_GOVERNANCE: 'TRIGGER_GOVERNANCE（runtime.ts:101 resolveAgent→:123 followup 无公开 pre-delivery 治理 seam）',
  PLAN_ONCE_MEMO: 'PLAN_ONCE_MEMO 逐字携带',
})

/**
 * The gate. deps (public faces only):
 *  - lifecycleFace(): { id: number, active: boolean } | null | undefined —
 *    the SAME public generation face the family facade feed rides; unknown
 *    = CLOSED (never allow), non-ACTIVE = CLOSED.
 * There is deliberately NO seam face, NO enablement flag, NO root-GO boolean input:
 * while the measured gap stands, evaluateDispatch ALWAYS refuses the gated
 * pair with TRIGGER_GOVERNANCE_OPEN citing G1-G5; when root rules (public
 * seam vs fork), a FUTURE card replaces this gate with the ruled public
 * facts — this file never self-closes.
 */
export function createScheduleTriggerGovernance (deps = {}) {
  if (deps === null || typeof deps !== 'object' || Array.isArray(deps) || typeof deps.lifecycleFace !== 'function') {
    return { ok: false, code: A5_SCHEDULE_TRIGGER_CODES.INPUT_INVALID, detail: 'lifecycleFace (the public generation face) is REQUIRED — the block never mounts without its observation point' }
  }
  function evaluateDispatch (name) {
    if (typeof name !== 'string' || !A5_SCHEDULE_TRIGGER_GAP.GATED_NAMES.includes(name)) {
      return { enabled: false, code: A5_SCHEDULE_TRIGGER_CODES.INPUT_INVALID, detail: `this gate answers only ${A5_SCHEDULE_TRIGGER_GAP.GATED_NAMES.join('/')} (the delivered pair); every other name rides its own family law` }
    }
    const gen = deps.lifecycleFace()
    if (gen === null || gen === undefined || typeof gen.id !== 'number') {
      return { enabled: false, code: A5_SCHEDULE_TRIGGER_CODES.LIFECYCLE_UNOBSERVABLE, detail: 'the provider generation epoch is unobservable — unknowable never becomes allow' }
    }
    if (gen.active !== true) {
      return { enabled: false, code: A5_SCHEDULE_TRIGGER_CODES.NOT_ACTIVE, detail: `generation ${String(gen.id)} is not ACTIVE — rows never serve off a non-ACTIVE capture (family ACTIVE gate, 原样复用)` }
    }
    return {
      enabled: false,
      generationId: gen.id,
      code: A5_SCHEDULE_TRIGGER_CODES.OPEN,
      detail: `the ${name} governed arm is BUILT and WIRED, but the trigger gap G1-G5 stands: firing delivers agent.followup (runtime.ts:123 -> agent-loop agent.ts:163) with no event/middleware/PA seam, the API admission (commands.ts:338-365) is RPC-only and non-permission, parent cancellation drops reminders silently (agent.ts:176-183 / index.ts:221), and the injection decision itself is ungoverned. Closure is a ROOT ruling (public seam vs fork) recorded by a future card with those facts — never a flag here.`,
      gap: A5_SCHEDULE_TRIGGER_GAP,
      law: A5_SCHEDULE_TRIGGER_LAWS.FROZEN_DECISION,
    }
  }
  return { ok: true, evaluateDispatch, gap: A5_SCHEDULE_TRIGGER_GAP, laws: A5_SCHEDULE_TRIGGER_LAWS }
}
