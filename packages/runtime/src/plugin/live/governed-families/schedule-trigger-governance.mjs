/**
 * schedule-trigger-governance.mjs — the B-SCHEDULE TRIGGER-GOVERNANCE
 * SEMANTICS BLOCK (center card 2026-10-26; frozen law ALPHA5-EFFECTIVE-
 * BACKLOG.md :67 verbatim: "create/update 触发缺口未闭不可启用亦必交不删;
 * TRIGGER_GOVERNANCE (runtime.ts:101 resolveAgent→:123 followup 无公开
 * pre-delivery 治理 seam) / PLAN_ONCE_MEMO 逐字携带; delete/update =
 * revocation path 注释 ≠ policy 自动撤销").
 *
 * WHAT THE MEASURED 639 SOURCE SAYS (read-only evidence, pinned by spec):
 * the firing path is `sessionController.resolveAgent(task.sessionId)`
 * (packages/schedule/schedule/src/runtime.ts:101) straight into
 * `resolved.agent.followup(message)` (:123) — clock admission and framing
 * sit between, and NO PUBLIC pre-delivery governance seam exists on that
 * path. The TOOL path (registerScheduleTools: tools.ts:408; schedule_create
 * :417, schedule_update :493; caller law: agent.session.id binds the
 * ORIGINAL Session, update pre-reads ownership via list :515-522, create
 * validates EXACTLY ONE selector :250-253) is governable with the family's
 * PROVEN laws — the trigger path is not, until a public seam exists.
 *
 * THE FROZEN DECISION THIS BLOCK ENCODES (never re-decided here, never
 * loosened by inference):
 *  - CONTRACT DELIVERED: schedule_create/schedule_update governance rows
 *    are BUILT and WIRED (the pair rides the list/delete tested law:
 *    bind-after-def + per-name facade capture, same-Agent native hook, PA
 *    final consume, native body verbatim with its original scheduling
 *    validation and caller constraints).
 *  - NOT ENABLED: while the public seam face answers ABSENT (the measured
 *    today), every create/update dispatch refuses with the typed
 *    TRIGGER_GOVERNANCE_OPEN refusal BEFORE any admission or body entry.
 *    Enabling requires a PUBLIC pre-delivery seam fact plus explicit root
 *    GO — the block never infers enablement, never defaults to allow,
 *    never caches across generations.
 *  - NEVER DELETE: the rows, this block and their wiring are contractual
 *    deliverables (必交不删); removal is out of scope for every future card.
 *  - PLAN_ONCE_MEMO (逐字携带, verbatim carry): one-shot delivery records
 *    commit status inactive + appendDelivery at the delivery moment
 *    (runtime.ts:124-128) — a governance row never re-plans a once memo;
 *    recurring framing/occurrence law stays with the native runtime.
 *  - delete/update revocation-path annotations are comments about a code
 *    path, NOT policy auto-revocation.
 *
 * REUSED LAWS (原样复用, my family's own proven semantics): the generation
 * epoch (the provider GENERATION is the currentness law — inject-callback
 * boundary id, host scheduleLifecycle), the ACTIVE gate (answer only while
 * the lifecycle says so; unknown = CLOSED, fail-closed, never allow), and
 * the token discipline (no dispatch without the final consume — the same
 * PA one-shot witness the list/delete pair rides). Zero private unwrap;
 * the block reads only the PUBLIC seam/lifecycle faces the host publishes.
 *
 * Tier: 接线未测 (no boot/Host here). win32-irrelevant.
 */

export const A5_SCHEDULE_TRIGGER_CODES = Object.freeze({
  INPUT_INVALID: 'A5_TRIG_INPUT_INVALID',
  SEAM_ABSENT: 'A5_TRIG_SEAM_ABSENT',
  LIFECYCLE_UNOBSERVABLE: 'A5_TRIG_LIFECYCLE_UNOBSERVABLE',
  NOT_ACTIVE: 'A5_TRIG_NOT_ACTIVE',
})

/** The frozen law strings the block carries VERBATIM (spec pins them). */
export const A5_SCHEDULE_TRIGGER_LAWS = Object.freeze({
  FROZEN_DECISION: 'create/update 触发缺口未闭不可启用亦必交不删',
  TRIGGER_GOVERNANCE: 'TRIGGER_GOVERNANCE（runtime.ts:101 resolveAgent→:123 followup 无公开 pre-delivery 治理 seam）',
  PLAN_ONCE_MEMO: 'PLAN_ONCE_MEMO 逐字携带',
  REVOCATION: 'delete/update=revocation path 注释≠policy自动撤销',
  /** The measured public facts of the firing path (639 source, read-only). */
  TRIGGER_PATH: Object.freeze({
    resolveAgent: 'packages/schedule/schedule/src/runtime.ts:101',
    followup: 'packages/schedule/schedule/src/runtime.ts:123',
    publicPreDeliveryGovernanceSeam: null, // MEASURED ABSENT — not a TODO guess
  }),
  /** The tool path the pair mounts (639 source, read-only). */
  TOOL_PATH: Object.freeze({
    register: 'packages/schedule/schedule/src/tools.ts:408',
    create: 'packages/schedule/schedule/src/tools.ts:417',
    update: 'packages/schedule/schedule/src/tools.ts:493',
    callerLaw: 'agent.session.id binds the ORIGINAL Session; update pre-reads ownership via list; create validates EXACTLY ONE selector',
  }),
  /** The two names this block governs activation for (the delivered pair). */
  GATED_NAMES: Object.freeze(['schedule_create', 'schedule_update']),
})

/**
 * The block. deps (ALL public faces; anything else refuses at build):
 *  - seamFace(): unknown — the PUBLIC pre-delivery governance seam the host
 *    would publish. The measured 639 world answers ABSENT; the block never
 *    fabricates one. A FUTURE public seam (root-GO'd) answers a function
 *    and the enablement law below evaluates it.
 *  - lifecycleFace(): { id: number, active: boolean } | null | undefined —
 *    the same GENERATION epoch the family's facade feed rides (host
 *    scheduleLifecycle.currentGeneration() shape: id + observability);
 *    null/undefined = unobservable = CLOSED (fail-closed, never allow).
 */
export function createScheduleTriggerGovernance (deps = {}) {
  if (deps === null || typeof deps !== 'object' || Array.isArray(deps)) {
    return { ok: false, code: A5_SCHEDULE_TRIGGER_CODES.INPUT_INVALID, detail: 'deps object required' }
  }
  const seamFace = deps.seamFace
  const lifecycleFace = deps.lifecycleFace
  if (typeof seamFace !== 'function' || typeof lifecycleFace !== 'function') {
    return { ok: false, code: A5_SCHEDULE_TRIGGER_CODES.INPUT_INVALID, detail: 'seamFace and lifecycleFace are REQUIRED public faces — the block never mounts without the public observation points its law reads' }
  }

  // EVALUATION IS PER-CALL, PER-GENERATION: nothing is cached across the
  // epoch (the facade-feed law); each dispatch re-reads BOTH public faces.
  function evaluateDispatch (name) {
    if (typeof name !== 'string' || !A5_SCHEDULE_TRIGGER_LAWS.GATED_NAMES.includes(name)) {
      return { enabled: false, code: A5_SCHEDULE_TRIGGER_CODES.INPUT_INVALID, detail: `evaluateDispatch answers only the gated pair (${A5_SCHEDULE_TRIGGER_LAWS.GATED_NAMES.join('/')}); every other name rides its own family law` }
    }
    const gen = lifecycleFace()
    if (gen === null || gen === undefined || typeof gen.id !== 'number') {
      return { enabled: false, code: A5_SCHEDULE_TRIGGER_CODES.LIFECYCLE_UNOBSERVABLE, detail: `the provider generation epoch is unobservable — unknowable NEVER becomes allow (${A5_SCHEDULE_TRIGGER_LAWS.FROZEN_DECISION})` }
    }
    if (gen.active !== true) {
      return { enabled: false, code: A5_SCHEDULE_TRIGGER_CODES.NOT_ACTIVE, detail: `generation ${String(gen.id)} is not ACTIVE — rows never serve off a non-ACTIVE capture (the family ACTIVE gate, 原样复用)` }
    }
    const seam = seamFace()
    if (seam === undefined || seam === null) {
      // THE MEASURED TODAY (the frozen law's fact): no public pre-delivery
      // governance seam on runtime.ts:101→:123. Contract delivered, NOT
      // enabled — the typed refusal stands BEFORE any admission/body entry.
      return {
        enabled: false,
        generationId: gen.id,
        code: 'TRIGGER_GOVERNANCE_OPEN',
        detail: `${A5_SCHEDULE_TRIGGER_LAWS.TRIGGER_GOVERNANCE}: the ${name} governance row is CONTRACT-DELIVERED (必交不删) but NOT ENABLED while the public seam face answers absent — dispatch refuses before any admission or native entry. Enabling requires a public seam fact plus explicit root GO; this block never infers either.`,
        law: A5_SCHEDULE_TRIGGER_LAWS.FROZEN_DECISION,
      }
    }
    if (typeof seam !== 'function') {
      return { enabled: false, code: A5_SCHEDULE_TRIGGER_CODES.SEAM_ABSENT, detail: `the seam face answered a non-function (${String(seam)}) — a malformed seam is CLOSED, never a duck (the family never-silent-allow law)` }
    }
    // A REAL public seam fact is present: enablement additionally requires
    // the explicit root GO carried as a public dep fact (never inferred),
    // and even then dispatch keeps the FULL pair law (same-Agent native
    // hook + PA final consume + native body verbatim) — this block gates,
    // it never executes.
    const rootGo = typeof deps.rootGo === 'function' ? deps.rootGo() : undefined
    if (rootGo !== true) {
      return { enabled: false, generationId: gen.id, code: 'TRIGGER_GOVERNANCE_OPEN', detail: `a public seam exists but the explicit root GO fact is absent — ${A5_SCHEDULE_TRIGGER_LAWS.FROZEN_DECISION} stands until both public facts are observed in the SAME generation (${String(gen.id)})` }
    }
    return { enabled: true, generationId: gen.id, seam, detail: `public seam + root GO observed in generation ${String(gen.id)} — the pair law (same-Agent hook + PA final consume + native verbatim) governs the dispatch; this block never executes and never re-plans (PLAN_ONCE_MEMO 逐字携带)` }
  }

  return {
    ok: true,
    evaluateDispatch,
    /** The frozen law face for observers/receipts (read-only strings). */
    laws: A5_SCHEDULE_TRIGGER_LAWS,
  }
}
