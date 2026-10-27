/**
 * agent-state-family/src/agent-state-law.mjs — the PINNED state law of the
 * governed agent-state members (U7-F B).
 *
 * This module is LAW, not convenience: every leg below is derived from the
 * pinned host tree `tests/deepseek-harness-test-use` @ `639ed015397290b3745d163aafe02ffee4aa3f84`
 * (0.2.0-rc.2), and the citations name the exact source line the leg mirrors.
 * A test pins the whole table (`u7-f-agentb-agent-state-c1.test.ts`, T-table);
 * an illegal transition answers as a TYPED refusal with the host's own stable
 * code and sentence — never a silent accept, never a reworded invention.
 *
 * Citation map (host pin 639ed01539):
 *  - `packages/goal/tool-goal/src/index.ts`   :145-149 goalRef shape law
 *                                               :195/:207/:234 the three rows
 *                                               :224  create requires direct human
 *                                               :263  edit   requires direct human
 *                                               :265  blocked_reason only-with-blocked (edit leg)
 *                                               :271  pause/resume require direct human
 *                                               :273-277 field legs (objective/cap edit-only, reason blocked-only)
 *                                               :279-285 resume-from-paused is the USER's act (GOAL_TOOL_RESUME_PAUSED)
 *                                               :291  complete/blocked need completionAuthority
 *                                               :294-303 field legs on the completion leg
 *                                               :305-313 blocked round threshold (GOAL_TOOL_BLOCK_THRESHOLD)
 *  - `packages/goal/tool-goal/src/authority.ts` :51/:37 agent + open-turn requirements
 *                                               :100-102 direct-human sentence
 *                                               :111-117 completion-authority sentence
 *  - `packages/goal/goal/src/index.ts`         :307-308 create needs no/complete current (GOAL_ALREADY_EXISTS)
 *                                               :334  edit needs at least one replacement (GOAL_INVALID_EDIT)
 *                                               :353  pause   from ['active']
 *                                               :368  resume  from ['active','paused','blocked']
 *                                               :372-373 resume of an already active+armed goal refuses
 *                                               :376-378 resume on an exhausted round budget refuses
 *                                               :396  complete from ['active','paused','blocked']
 *                                               :413-414 block  from ['active'] only
 *                                               :457  no current goal (GOAL_NOT_FOUND)
 *                                               :457-462 exact id+revision CAS (GOAL_STALE_REVISION)
 *                                               :545-548 the transition sentence `cannot <op> goal "<id>" from phase "<phase>"; expected <list>`
 *  - `packages/goal/goal/src/fold.ts`          the durable fold: revision advances EXACTLY one
 *  - `packages/todo/tool-todo/src/index.ts`    :26/:71/:97 list law (statuses, trimmed-unique, at-most-one in_progress)
 *                                               :37-42  allowParallelInProgress is a REQUIRED deployment choice
 *                                               :199 durable write = session.append('todo/write')
 *  - `packages/plan/plan-mode/src/index.ts`    :296 a calling agent is required
 *                                               :298 exit is only available in plan mode
 *                                               :300-301 the plan must open with a `# ` heading
 *
 * Purity: no `node:*`, no I/O, no clock (the fold receives `nowIso` from the
 * caller; the store owns its own persistence clock).
 *
 * @module tools/agent-state-family/law
 */

/** The closed action vocabulary (host tool-goal/src/index.ts UPDATE_ACTIONS). */
export const GOAL_ACTIONS = Object.freeze(['edit', 'pause', 'resume', 'complete', 'blocked'])
export const GOAL_PHASES = Object.freeze(['active', 'paused', 'blocked', 'complete'])
export const TODO_STATUSES = Object.freeze(['pending', 'in_progress', 'completed'])

/** The host's configured default for the blocked-round threshold
 *  (tool-goal config `blockedAfterConsecutiveRounds`, default 3). */
export const BLOCKED_AFTER_CONSECUTIVE_ROUNDS_DEFAULT = 3

/**
 * THE PINNED TRANSITION TABLE (law, not comment): every row is one
 * `update_goal`/`create_goal` leg with its host citation and its typed
 * refusal. The table test walks this structure itself — a silent accept of
 * any listed refusal is RED at the table, not at the call site.
 */
export const GOAL_TRANSITION_LAW = Object.freeze({
  hostPin: '639ed015397290b3745d163aafe02ffee4aa3f84',
  create: Object.freeze({
    requiresCurrent: Object.freeze({ cite: 'goal/src/index.ts:307-308', refuse: 'none-or-complete', code: 'GOAL_ALREADY_EXISTS' }),
    authority: Object.freeze({ cite: 'tool-goal/src/index.ts:224', arm: 'direct-human', code: 'GOAL_TOOL_NOT_DIRECT_HUMAN' }),
    objective: Object.freeze({ cite: 'goal/src/index.ts:209', code: 'GOAL_INVALID_OBJECTIVE' }),
    roundCap: Object.freeze({ cite: 'goal/src/index.ts:201', code: 'GOAL_INVALID_MAX_ROUNDS' }),
    foldsTo: Object.freeze({ phase: 'active', revision: 1, roundsStarted: 0 }),
  }),
  actions: Object.freeze({
    edit: Object.freeze({
      authority: Object.freeze({ cite: 'tool-goal/src/index.ts:263', arm: 'direct-human', code: 'GOAL_TOOL_NOT_DIRECT_HUMAN' }),
      phase: Object.freeze({ cite: 'goal/src/index.ts:328-334', from: ['active', 'paused', 'blocked', 'complete'], code: null }),
      fields: Object.freeze({ cite: 'tool-goal/src/index.ts:265', objective: 'allowed', cap: 'allowed', reason: 'refused', code: 'GOAL_TOOL_INVALID_UPDATE' }),
      emptyEdit: Object.freeze({ cite: 'goal/src/index.ts:334', code: 'GOAL_INVALID_EDIT' }),
    }),
    pause: Object.freeze({
      authority: Object.freeze({ cite: 'tool-goal/src/index.ts:271', arm: 'direct-human', code: 'GOAL_TOOL_NOT_DIRECT_HUMAN' }),
      phase: Object.freeze({ cite: 'goal/src/index.ts:353', from: ['active'], code: 'GOAL_INVALID_TRANSITION' }),
      fields: Object.freeze({ cite: 'tool-goal/src/index.ts:273-277', objective: 'refused', cap: 'refused', reason: 'refused', code: 'GOAL_TOOL_INVALID_UPDATE' }),
    }),
    resume: Object.freeze({
      authority: Object.freeze({ cite: 'tool-goal/src/index.ts:271', arm: 'direct-human', code: 'GOAL_TOOL_NOT_DIRECT_HUMAN' }),
      pausedModelLeg: Object.freeze({ cite: 'tool-goal/src/index.ts:279-285', when: 'current is paused at the referenced revision', code: 'GOAL_TOOL_RESUME_PAUSED', sentence: 'the model cannot resume a paused goal; the user must resume it' }),
      phase: Object.freeze({ cite: 'goal/src/index.ts:368', from: ['active', 'paused', 'blocked'], code: 'GOAL_INVALID_TRANSITION' }),
      alreadyArmed: Object.freeze({ cite: 'goal/src/index.ts:372-373', code: 'GOAL_INVALID_TRANSITION', sentence: 'goal "<id>" is already active and armed' }),
      budget: Object.freeze({ cite: 'goal/src/index.ts:376-378', code: 'GOAL_INVALID_TRANSITION' }),
      fields: Object.freeze({ cite: 'tool-goal/src/index.ts:273-277', objective: 'refused', cap: 'refused', reason: 'refused', code: 'GOAL_TOOL_INVALID_UPDATE' }),
    }),
    complete: Object.freeze({
      authority: Object.freeze({ cite: 'tool-goal/src/index.ts:291', arm: 'completion', code: 'GOAL_TOOL_NO_COMPLETION_AUTHORITY' }),
      phase: Object.freeze({ cite: 'goal/src/index.ts:396', from: ['active', 'paused', 'blocked'], code: 'GOAL_INVALID_TRANSITION' }),
      fields: Object.freeze({ cite: 'tool-goal/src/index.ts:294-299', objective: 'refused', cap: 'refused', reason: 'refused', code: 'GOAL_TOOL_INVALID_UPDATE' }),
    }),
    blocked: Object.freeze({
      authority: Object.freeze({ cite: 'tool-goal/src/index.ts:291', arm: 'completion', code: 'GOAL_TOOL_NO_COMPLETION_AUTHORITY' }),
      threshold: Object.freeze({ cite: 'tool-goal/src/index.ts:305-313', when: 'goal-round arm below the configured round minimum', code: 'GOAL_TOOL_BLOCK_THRESHOLD' }),
      phase: Object.freeze({ cite: 'goal/src/index.ts:413-414', from: ['active'], code: 'GOAL_INVALID_TRANSITION' }),
      fields: Object.freeze({ cite: 'tool-goal/src/index.ts:301-303', objective: 'refused', cap: 'refused', reason: 'required', code: 'GOAL_TOOL_INVALID_UPDATE' }),
    }),
  }),
  cas: Object.freeze({ cite: 'goal/src/index.ts:457-462', noCurrent: 'GOAL_NOT_FOUND', mismatch: 'GOAL_STALE_REVISION' }),
  fold: Object.freeze({ cite: 'goal/src/fold.ts:194', rule: 'revision advances exactly one per applied transition' }),
})

/** The governed todo law config the row carries. The host requires an
 *  explicit deployment choice (tool-todo/src/index.ts:37-42); the governed
 *  row's shipped posture is the STRICT one (at most one in_progress) and a
 *  mount may loosen it explicitly. */
export const DEFAULT_TODO_CONFIG = Object.freeze({ allowParallelInProgress: false })

const isPlainRecord = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)
const hasText = (v) => typeof v === 'string' && v.trim().length > 0
const isRoundCap = (v) => Number.isSafeInteger(v) && v > 0

const refusal = (code, detail) => ({ ok: false, code, detail })

/** CLOSED parameter parsing for `get_goal` (host row :195 — no parameters). */
export function parseGetGoalArgs(raw) {
  if (raw === undefined || raw === null) return { ok: true, args: {} }
  if (!isPlainRecord(raw)) return refusal('AGENT_STATE_ARGS_INVALID', 'get_goal takes no arguments')
  if (Object.keys(raw).length > 0) return refusal('AGENT_STATE_ARGS_UNKNOWN', `get_goal carries no parameters — unknown field(s): ${Object.keys(raw).join(',')}`)
  return { ok: true, args: {} }
}

/** CLOSED parameter parsing for `create_goal` (host row :207-:231). */
export function parseCreateGoalArgs(raw) {
  if (!isPlainRecord(raw)) return refusal('AGENT_STATE_ARGS_INVALID', 'create_goal arguments must be a record')
  const unknown = Object.keys(raw).filter((k) => k !== 'objective' && k !== 'max_goal_rounds')
  if (unknown.length > 0) return refusal('AGENT_STATE_ARGS_UNKNOWN', `create_goal received unknown field(s): ${unknown.join(',')}`)
  if (!hasText(raw.objective)) return refusal('GOAL_INVALID_OBJECTIVE', 'goal objective must be a non-empty string')
  if (raw.max_goal_rounds !== undefined && !isRoundCap(raw.max_goal_rounds)) {
    return refusal('GOAL_INVALID_MAX_ROUNDS', 'maxGoalRounds must be a positive safe integer')
  }
  return {
    ok: true,
    args: {
      objective: raw.objective.trim(),
      ...(raw.max_goal_rounds === undefined ? {} : { maxGoalRounds: raw.max_goal_rounds }),
    },
  }
}

/** CLOSED parameter parsing + the field-leg law for `update_goal`
 *  (host row :234-:319: goalRef :145-149, field legs :265/:273-277/:294-303). */
export function parseUpdateGoalArgs(raw) {
  if (!isPlainRecord(raw)) return refusal('AGENT_STATE_ARGS_INVALID', 'update_goal arguments must be a record')
  const closed = ['goal_id', 'revision', 'action', 'objective', 'max_goal_rounds', 'blocked_reason']
  const unknown = Object.keys(raw).filter((k) => !closed.includes(k))
  if (unknown.length > 0) return refusal('AGENT_STATE_ARGS_UNKNOWN', `update_goal received unknown field(s): ${unknown.join(',')}`)
  if (!hasText(raw.goal_id) || !isRoundCap(raw.revision)) {
    return refusal('GOAL_TOOL_INVALID_UPDATE', 'goal_id must be non-empty and revision must be a positive safe integer')
  }
  if (typeof raw.action !== 'string' || !GOAL_ACTIONS.includes(raw.action)) {
    return refusal('GOAL_TOOL_INVALID_UPDATE', `action must be one of ${GOAL_ACTIONS.join(', ')}`)
  }
  const args = { goalId: raw.goal_id, revision: raw.revision, action: raw.action }
  const hasObjective = hasText(raw.objective)
  const hasCap = raw.max_goal_rounds !== undefined
  const hasReason = raw.blocked_reason !== undefined && String(raw.blocked_reason).length > 0
  if (raw.max_goal_rounds !== undefined && !isRoundCap(raw.max_goal_rounds)) {
    return refusal('GOAL_INVALID_MAX_ROUNDS', 'maxGoalRounds must be a positive safe integer')
  }
  // Field legs, mirrored VERBATIM in code and order from the host legs
  // :265 (edit), :273-277 (pause/resume), :294-303 (completion leg).
  if (args.action === 'edit' && hasReason) return refusal('GOAL_TOOL_INVALID_UPDATE', 'blocked_reason is valid only with action blocked')
  if ((args.action === 'pause' || args.action === 'resume') && (hasObjective || hasCap || hasReason)) {
    return refusal('GOAL_TOOL_INVALID_UPDATE', 'objective and max_goal_rounds are valid only with action edit; blocked_reason is valid only with action blocked')
  }
  if ((args.action === 'complete' || args.action === 'blocked') && (hasObjective || hasCap)) {
    return refusal('GOAL_TOOL_INVALID_UPDATE', 'objective and max_goal_rounds are valid only with action edit')
  }
  if (args.action === 'complete' && hasReason) return refusal('GOAL_TOOL_INVALID_UPDATE', 'blocked_reason is valid only with action blocked')
  if (args.action === 'blocked' && (!hasText(raw.blocked_reason) || String(raw.blocked_reason).trim().length === 0)) {
    return refusal('GOAL_TOOL_INVALID_UPDATE', 'blocked_reason is required with action blocked')
  }
  if (args.action === 'edit') {
    const replacements = {}
    if (hasObjective) replacements.objective = raw.objective.trim()
    if (hasCap) replacements.maxGoalRounds = raw.max_goal_rounds
    if (Object.keys(replacements).length === 0) return refusal('GOAL_INVALID_EDIT', 'goal edit requires objective and/or maxGoalRounds')
    args.replacements = replacements
  }
  if (args.action === 'blocked') args.blockedReason = String(raw.blocked_reason).trim()
  return { ok: true, args }
}

/** The todo-list law (host tool-todo/src/index.ts:26/:71/:97): whole-list
 *  replacement; closed {content,status} records; trimmed non-empty UNIQUE
 *  content; at most one `in_progress` unless the mount declared otherwise. */
export function parseTodoWriteArgs(raw, config = DEFAULT_TODO_CONFIG) {
  if (!isPlainRecord(raw) || !Array.isArray(raw.todos)) return refusal('AGENT_STATE_ARGS_INVALID', 'todo_write arguments must be { todos: [...] }')
  const unknown = Object.keys(raw).filter((k) => k !== 'todos')
  if (unknown.length > 0) return refusal('AGENT_STATE_ARGS_UNKNOWN', `todo_write received unknown field(s): ${unknown.join(',')}`)
  const seen = new Set()
  const todos = []
  for (const [i, item] of raw.todos.entries()) {
    if (!isPlainRecord(item)) return refusal('AGENT_STATE_ARGS_INVALID', `todos[${String(i)}] must be a record`)
    const itemKeys = Object.keys(item)
    if (itemKeys.some((k) => k !== 'content' && k !== 'status')) {
      return refusal('AGENT_STATE_ARGS_UNKNOWN', `todos[${String(i)}] carries unknown field(s): ${itemKeys.filter((k) => k !== 'content' && k !== 'status').join(',')}`)
    }
    if (typeof item.content !== 'string' || item.content.trim().length === 0) {
      return refusal('AGENT_STATE_ARGS_INVALID', `invalid todos: content must be a non-empty string`)
    }
    const content = item.content.trim()
    if (seen.has(content)) return refusal('AGENT_STATE_ARGS_INVALID', 'invalid todos: content must be unique')
    seen.add(content)
    if (typeof item.status !== 'string' || !TODO_STATUSES.includes(item.status)) {
      return refusal('AGENT_STATE_ARGS_INVALID', `invalid status: ${String(item.status)}`)
    }
    todos.push({ content, status: item.status })
  }
  const active = todos.filter((t) => t.status === 'in_progress').length
  if (active > 1 && config.allowParallelInProgress !== true) {
    return refusal('AGENT_STATE_ARGS_INVALID', `invalid todos: at most one task may be in_progress (got ${String(active)})`)
  }
  return { ok: true, args: { todos } }
}

/** The plan-mode exit law (host plan-mode/src/index.ts:296-:301). The
 *  plan-mode ACTIVE leg is state, so it lives in `planModeExitStateLeg`. */
export function parseExitPlanModeArgs(raw) {
  if (!isPlainRecord(raw)) return refusal('AGENT_STATE_ARGS_INVALID', 'exit_plan_mode arguments must be a record')
  const unknown = Object.keys(raw).filter((k) => k !== 'plan')
  if (unknown.length > 0) return refusal('AGENT_STATE_ARGS_UNKNOWN', `exit_plan_mode received unknown field(s): ${unknown.join(',')}`)
  if (typeof raw.plan !== 'string' || !/^#\s+\S/.test(raw.plan.trim())) {
    return refusal('PLAN_MODE_PLAN_INVALID', 'exit_plan_mode requires a non-empty markdown plan starting with a # heading')
  }
  return { ok: true, args: { plan: raw.plan } }
}

/** The state leg of the exit: plan mode must be the calling agent's live
 *  mode (host :298 — "exit_plan_mode is only available in plan mode"). */
export function planModeExitStateLeg(planMode) {
  if (planMode?.active !== true) return refusal('PLAN_MODE_NOT_ACTIVE', 'exit_plan_mode is only available in plan mode')
  return { ok: true }
}

/** The authority leg (host authority.ts:100-117 + tool legs :224/:263/:271/:291).
 *  `arm` is the execution-origin fact the injected store resolves for the
 *  CALLING agent: {kind:'model'} | {kind:'direct-human'} |
 *  {kind:'goal-round', goalId, revision, round}. */
export function goalAuthorityLeg({ action, arm, current, blockedAfterConsecutiveRounds = BLOCKED_AFTER_CONSECUTIVE_ROUNDS_DEFAULT }) {
  const needsDirect = action === 'create' || action === 'edit' || action === 'pause' || action === 'resume'
  if (needsDirect) {
    if (arm?.kind !== 'direct-human') {
      return refusal('GOAL_TOOL_NOT_DIRECT_HUMAN', 'this goal operation requires a direct human turn on a top-level agent')
    }
    return { ok: true }
  }
  // complete / blocked: direct human OR the exact current goal round.
  const completion = arm?.kind === 'direct-human'
    || (arm?.kind === 'goal-round' && current !== null
      && arm.goalId === current.goalId && arm.revision === current.revision && arm.round === current.roundsStarted)
  if (completion !== true) {
    return refusal('GOAL_TOOL_NO_COMPLETION_AUTHORITY', 'complete and blocked require a direct human turn or the current goal round')
  }
  if (action === 'blocked' && arm?.kind === 'goal-round' && (current?.roundsStarted ?? 0) < blockedAfterConsecutiveRounds) {
    return refusal('GOAL_TOOL_BLOCK_THRESHOLD', `blocked requires at least ${String(blockedAfterConsecutiveRounds)} consecutive goal rounds; current round is ${String(current?.roundsStarted ?? 0)}`)
  }
  return { ok: true }
}

/** The CAS + phase legs (host goal/src/index.ts:457-462 + per-action sets;
 *  the transition sentence at :545-548). Runs POST-CONSUME on FRESH state —
 *  the approved facts are never rewritten here, a moved state answers STALE. */
export function goalStateLeg({ action, current, goalId, revision }) {
  if (action === 'create') {
    if (current !== null && current.phase !== 'complete') {
      return refusal('GOAL_ALREADY_EXISTS', `goal "${current.goalId}" already exists with phase "${current.phase}"`)
    }
    return { ok: true }
  }
  if (current === null) return refusal('GOAL_NOT_FOUND', 'no current goal')
  if (current.goalId !== goalId || current.revision !== revision) {
    return refusal('GOAL_STALE_REVISION', `stale goal ref "${goalId}" revision ${String(revision)}; current is "${current.goalId}" revision ${String(current.revision)}`)
  }
  const allowed = action === 'pause' ? ['active']
    : action === 'resume' ? ['active', 'paused', 'blocked']
      : action === 'complete' ? ['active', 'paused', 'blocked']
        : action === 'blocked' ? ['active']
          : ['active', 'paused', 'blocked', 'complete'] // edit: no phase gate host-side beyond existence
  if (!allowed.includes(current.phase)) {
    const operation = action === 'blocked' ? 'block' : action
    return refusal('GOAL_INVALID_TRANSITION', `cannot ${operation} goal "${current.goalId}" from phase "${current.phase}"; expected ${allowed.join(' or ')}`)
  }
  if (action === 'resume') {
    // The tool-level leg (:279-285): a paused goal at the referenced revision
    // is the USER's to resume — the row refuses it under every arm.
    if (current.phase === 'paused') return refusal('GOAL_TOOL_RESUME_PAUSED', 'the model cannot resume a paused goal; the user must resume it')
    if (current.phase === 'active' && current.armed === true) {
      return refusal('GOAL_INVALID_TRANSITION', `goal "${current.goalId}" is already active and armed`)
    }
    if (current.roundsStarted >= (current.maxGoalRounds ?? Number.POSITIVE_INFINITY)) {
      return refusal('GOAL_INVALID_TRANSITION', `goal "${current.goalId}" has exhausted its round budget (${String(current.roundsStarted)}/${String(current.maxGoalRounds)})`)
    }
  }
  return { ok: true }
}

/** The fold (goal/src/fold.ts law): the next snapshot carries revision
 *  EXACTLY one above the current; create folds to revision 1, phase active,
 *  rounds 0. The store persists the fold; nothing else moves a revision. */
export function foldGoal(current, { action, args, goalId, nowIso }) {
  if (action === 'create') {
    return {
      goalId: typeof goalId === 'string' && goalId.length > 0 ? goalId : `goal-${nowIso ?? 't'}-1`,
      objective: args.objective,
      phase: 'active',
      revision: 1,
      roundsStarted: 0,
      ...(args.maxGoalRounds === undefined ? {} : { maxGoalRounds: args.maxGoalRounds }),
      armed: true,
    }
  }
  const next = { ...current, revision: current.revision + 1 }
  switch (action) {
    case 'edit':
      if (args.replacements.objective !== undefined) next.objective = args.replacements.objective
      if (args.replacements.maxGoalRounds !== undefined) next.maxGoalRounds = args.replacements.maxGoalRounds
      break
    case 'pause':
      next.phase = 'paused'
      next.armed = false
      break
    case 'resume':
      next.phase = 'active'
      next.armed = true
      break
    case 'complete':
      next.phase = 'complete'
      next.armed = false
      break
    case 'blocked':
      next.phase = 'blocked'
      next.armed = false
      next.blockedReason = args.blockedReason
      break
    default:
      break
  }
  return next
}

/** The get_goal projection (host goalValue shape, bounded by construction:
 *  ONE snapshot of ONE calling agent — never a list, never a cross-scope
 *  enumeration). */
export function projectGoal(snapshot) {
  if (snapshot === null) return { goal: null }
  return {
    goal: {
      goal_id: snapshot.goalId,
      objective: snapshot.objective,
      phase: snapshot.phase,
      revision: snapshot.revision,
      rounds_started: snapshot.roundsStarted,
      ...(snapshot.maxGoalRounds === undefined ? {} : { max_goal_rounds: snapshot.maxGoalRounds }),
      armed: snapshot.armed === true,
      ...(snapshot.blockedReason === undefined ? {} : { blocked_reason: snapshot.blockedReason }),
    },
  }
}

/** The todo_write receipt shape (host tool-todo return): the canonical list
 *  plus the status counts. */
export function projectTodos(todos) {
  return {
    todos: todos.map((t) => ({ content: t.content, status: t.status })),
    counts: {
      pending: todos.filter((t) => t.status === 'pending').length,
      inProgress: todos.filter((t) => t.status === 'in_progress').length,
      completed: todos.filter((t) => t.status === 'completed').length,
    },
  }
}
