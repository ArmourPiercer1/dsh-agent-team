/**
 * agent-state-family/src/executors.mjs — the five governed agent-state rows.
 *
 * ONE walk shape for all five rows (the fs-mutation precedent, composed for
 * session state): CLOSED parameter parse → the pure state-law legs (zero
 * store touch) → the honest effect set → the lane deny fast path → the
 * default-deny fail-closed leg → the Kernel's PA edge (admission, ask, the
 * one-shot consume — all inside; the returned `allow` IS the consumed
 * proof) → ONLY THEN the store legs: the execution-origin arm fact, the
 * fresh state read, the authority/transition/CAS legs against THAT fresh
 * fact, and the durable apply keyed by the call's OWN correlation (a
 * consumed grant never applies twice).
 *
 * SCOPE LAW (the family's own, above the kernel's): the state scope is
 * derived EXCLUSIVELY from the dispatch's calling agent —
 * `exec.agent.id`, the same public dispatch fact the jobs bridge consumes —
 * NEVER from tool arguments. There is therefore no argument-shaped path to
 * another agent's state: a call that NAMES another agent's goal (an
 * update_goal against a foreign goal_id) meets the calling scope's own
 * fresh state and answers the typed CAS refusal with ZERO touches on the
 * foreign scope — the recording store proves the zero-reach fact.
 *
 * READ vs MUTATION (effect law (a), visible in BOTH the contribution's
 * declaration and every per-call PA request):
 *  - `get_goal` is a READ: its requested set is the metadata `meta` arm of
 *    the calling agent's goal view ONLY — no mutation-bearing arm is ever
 *    requested, and the row performs exactly one bounded store read.
 *  - the four mutation tools request their own `tool-invoke` arm (the law
 *    vocabulary's honest carrier of a session-state mutation — the closed
 *    resource vocabulary gives `metadata` the `meta` right only, so a
 *    fabricated fs-write arm would be a LIE, and the domain law makes
 *    `tool-invoke` act on its own arm) PLUS the metadata `meta` arm of the
 *    state resource the call observes for its precondition/CAS legs.
 *
 * READS ARE BOUNDED: `get_goal` reads exactly ONE snapshot of exactly ONE
 * scope (the caller's); the port exposes no enumeration, and this lane never
 * asks for more.
 *
 * @module tools/agent-state-family/executors
 */
import { parseRequestedEffectSet } from '../../../domain/tool-governance/src/index.js'
import {
  DEFAULT_TODO_CONFIG,
  foldGoal,
  goalAuthorityLeg,
  goalStateLeg,
  parseCreateGoalArgs,
  parseExitPlanModeArgs,
  parseGetGoalArgs,
  parseTodoWriteArgs,
  parseUpdateGoalArgs,
  planModeExitStateLeg,
  projectGoal,
  projectTodos,
} from './agent-state-law.mjs'

/** The five governed names — fixed native spellings (the fs/jobs precedent:
 *  never the configurable names map). One list; the descriptor claims, the
 *  contribution visibility and the row definitions all consume THIS list. */
export const AGENT_STATE_NAMES = Object.freeze(['todo_write', 'create_goal', 'get_goal', 'update_goal', 'exit_plan_mode'])

const refused = (code, detail) => ({ text: `refused: ${String(code)} — ${String(detail)}`, refusal: { code, detail } })
const accepted = (value) => ({ text: JSON.stringify(value) })

/** The default-deny fail-closed leg: the agent-state effect class is not
 *  nameable by the closed permission rule grammar (six file/shell tools +
 *  the trusted mount's frozen row-class law), so under a default-DENY
 *  template NO projected rule can ever cover these arms — the row answers
 *  the kernel's own grammar before PA, exactly as every uncovered effect
 *  answers at the kernel's coverage gate. Zero state touch, zero PA entry. */
const templateDenyLeg = (policy) => policy?.default === 'deny'
  ? refused('IO_POLICY_UNSUPPORTED', 'template-default-deny: an effect the policy never names is not an effect the policy allows (the agent-state effect class carries no rule-grammar spelling on this mount; extending the rule grammar is a named center-interface change, never a family self-authorization)')
  : null

/**
 * @param {object} input
 * @param {string} input.realmId
 * @param {object} input.policy - the mount's normalized permission policy.
 * @param {(x: {effects: unknown[]}) => {kind: string, code?: string}} input.decide
 * @param {(paCall: object) => Promise<object>} input.pa
 * @param {object} input.store - the injected state-store port (validated).
 * @param {(line: string) => void} [input.observe]
 * @param {{allowParallelInProgress?: boolean}} [input.todoConfig]
 */
export function buildAgentStateRowDefinitions({
  realmId, policy, decide, pa, store, observe = () => {},
  todoConfig = DEFAULT_TODO_CONFIG,
  mountNonce = String(globalThis.crypto?.randomUUID?.() ?? `n-${Date.now()}`),
}) {
  let seq = 0
  // Replay law (the write-executor's, composed for state): one host token
  // owns ONE call — an in-flight replay is refused outright; a settled
  // token answers under an already-aborted signal (the PA edge settles
  // `cancelled`; the body never runs twice for one execution).
  const tokenLedger = new Map()
  const settledSignals = new WeakMap()
  const settledSignal = (token) => {
    let s = settledSignals.get(token)
    if (s === undefined) {
      s = { aborted: true, reason: 'exec-token-terminal', addEventListener: () => {}, removeEventListener: () => {} }
      settledSignals.set(token, s)
    }
    return s
  }
  const scopeOf = (exec) => {
    const id = exec?.agent?.id
    // Review R1 F-2: the scope key is BYTE-EXACT — no trim, no fold. The
    // host mints opaque branded ids verbatim (`brandString<SessionId>(
    // \`session-${randomUUID()}\`)`, session-controller/src/commands.ts:109)
    // and resolves them by exact Map lookup (`this.ctx.agents.get(
    // request.sessionId)`, commands.ts:450) — no canonicalisation law
    // exists anywhere on the identity path. Trimming would ALIAS distinct
    // identities ("a" / "a " / " a") into one durable scope — the opposite
    // of calling-agent ownership. Only shape (string, non-empty) is checked.
    return typeof id === 'string' && id.length > 0 ? `agent:${id}` : null
  }
  const metaArm = (scope, resource) => ({
    kind: 'meta',
    resource: { realmId, kind: 'metadata', canonicalLocator: `agent-state/${scope}/${resource}`, rights: ['meta'] },
  })

  const run = async ({ toolName, exec, parse, effectsFor, body, missingAgent }) => {
    // ── scope from the CALLER only (never from arguments) ───────────────
    const scope = scopeOf(exec)
    if (scope === null) return refused(...missingAgent)
    const token = exec?.token
    const tokenKey = (typeof token === 'object' && token !== null) || typeof token === 'symbol' ? token : undefined
    if (tokenKey !== undefined) {
      const prior = tokenLedger.get(tokenKey)
      if (prior !== undefined && !prior.settled) {
        observe(`${toolName} exec-token-replay refusal scope=${scope}`)
        return refused('exec-token-replay', 'this host execution already owns an in-flight governed agent-state call')
      }
    }
    // ── PURE front: closed args + the state-law legs that need no state ──
    const parsed = parse()
    if (parsed.ok !== true) return refused(parsed.code, parsed.detail)
    const effects = effectsFor(scope)
    const set = parseRequestedEffectSet(effects)
    if (!set.ok) return refused('effect-set-rejected', JSON.stringify(set.problems).slice(0, 200))
    const verdict = decide({ effects })
    if (verdict.kind === 'deny') {
      observe(`${toolName} lane-denied code=${String(verdict.code)} scope=${scope}`)
      return refused(String(verdict.code), 'the template lane denies this agent-state effect')
    }
    const denyLeg = templateDenyLeg(policy)
    if (denyLeg !== null) {
      observe(`${toolName} default-deny refusal scope=${scope} (zero state access)`)
      return denyLeg
    }
    if (typeof pa !== 'function') return refused('PA_EDGE_UNAVAILABLE', 'this mount carries no PA admission edge, so no agent-state call may run')
    seq += 1
    let correlation
    let replaySettled = false
    if (tokenKey !== undefined) {
      const prior = tokenLedger.get(tokenKey)
      if (prior !== undefined && prior.settled) {
        correlation = prior.correlation
        replaySettled = true
      } else {
        correlation = `plane-agent-state:${mountNonce}:${String(seq)}`
        tokenLedger.set(tokenKey, { correlation, settled: false })
      }
    } else {
      correlation = exec?.tokenKey ?? `plane-agent-state:${mountNonce}:${String(seq)}`
    }
    const signal = replaySettled && tokenKey !== undefined ? settledSignal(tokenKey) : exec?.signal
    const gate = await pa({
      realmId,
      callId: correlation,
      ...(signal === undefined ? {} : { signal }),
      parametersFingerprint: set.value.fingerprint,
      requestedEffects: set.value,
      toolName,
    })
    if (gate.kind === 'deny') {
      observe(`${toolName} pa-refused code=${String(gate.code)} scope=${scope} (zero state access)`)
      return refused(String(gate.code), String(gate.detail ?? 'the PA execution edge refused this call'))
    }
    if (gate.kind === 'allow' && gate.cancelled === true) {
      observe(`${toolName} cancelled-at-pa-edge scope=${scope}`)
      return refused('CANCELLED', 'the invocation was cancelled before execution; nothing persisted')
    }
    // ── POST-CONSUME: fresh state facts run the pinned law; applyId is the
    // consumed call's own correlation (idempotence anchor). ───────────────
    try {
      const outcome = await body({ scope, args: parsed.args, applyId: correlation })
      if (tokenKey !== undefined) {
        const entry = tokenLedger.get(tokenKey)
        if (entry !== undefined) entry.settled = true
      }
      return outcome
    } catch (error) {
      observe(`${toolName} store-fault code=AGENT_STATE_STORE_FAULT scope=${scope}`)
      return refused('AGENT_STATE_STORE_FAULT', `the state store faulted: ${String(error?.message ?? error).slice(0, 160)}`)
    }
  }

  // ── get_goal — the READ row ─────────────────────────────────────────────
  const getGoal = (raw, exec) => run({
    toolName: 'get_goal',
    exec,
    parse: () => parseGetGoalArgs(raw),
    effectsFor: (scope) => [metaArm(scope, 'goal')],
    missingAgent: ['GOAL_TOOL_AGENT_REQUIRED', 'goal tools require a calling agent'],
    body: async ({ scope }) => {
      const snapshot = await store.readGoal(scope) // the ONE bounded read
      observe(`agent-state get_goal RAN scope=${scope}`)
      return accepted(projectGoal(snapshot))
    },
  })

  // ── create_goal / update_goal — the goal MUTATION rows ─────────────────
  const goalMutation = (toolName, parse, makeAction) => (raw, exec) => run({
    toolName,
    exec,
    parse: () => parse(raw),
    effectsFor: (scope) => [{ kind: 'tool-invoke', toolName, resource: null }, metaArm(scope, 'goal')],
    missingAgent: ['GOAL_TOOL_AGENT_REQUIRED', 'goal tools require a calling agent'],
    body: async ({ scope, args, applyId }) => {
      const action = makeAction(args)
      const current = await store.readGoal(scope) // fresh fact, post-consume
      const arm = store.armFor(scope)
      const authority = goalAuthorityLeg({ action: action === 'create' ? 'create' : action, arm, current })
      if (authority.ok !== true) {
        observe(`${toolName} authority-refusal code=${authority.code} scope=${scope}`)
        return refused(authority.code, authority.detail)
      }
      const state = goalStateLeg({ action, current, goalId: action === 'create' ? undefined : args.goalId, revision: action === 'create' ? undefined : args.revision })
      if (state.ok !== true) {
        observe(`${toolName} state-refusal code=${state.code} scope=${scope}`)
        return refused(state.code, state.detail)
      }
      const next = foldGoal(current, { action, args, goalId: action === 'create' ? undefined : args.goalId, nowIso: new Date().toISOString() })
      const applied = await store.applyGoal(scope, { expectedRevision: action === 'create' ? null : args.revision, next, applyId })
      if (applied.ok !== true) {
        observe(`${toolName} apply-refusal code=${applied.code} scope=${scope}`)
        return refused(applied.code, applied.detail)
      }
      observe(`${toolName} RAN scope=${scope} goalId=${next.goalId} revision=${String(next.revision)} phase=${next.phase}`)
      return accepted(projectGoal(applied.snapshot))
    },
  })

  // ── todo_write — the list MUTATION row (whole-list replacement) ────────
  const todoWrite = (raw, exec) => run({
    toolName: 'todo_write',
    exec,
    parse: () => parseTodoWriteArgs(raw, todoConfig),
    effectsFor: (scope) => [{ kind: 'tool-invoke', toolName: 'todo_write', resource: null }, metaArm(scope, 'todos')],
    missingAgent: ['TODO_WRITE_AGENT_REQUIRED', 'todo_write requires an owning agent session'],
    body: async ({ scope, args, applyId }) => {
      const applied = await store.applyTodos(scope, { todos: args.todos, applyId })
      if (applied.ok !== true) {
        observe(`todo_write apply-refusal code=${applied.code} scope=${scope}`)
        return refused(applied.code, applied.detail)
      }
      observe(`todo_write RAN scope=${scope} count=${String(args.todos.length)}`)
      return accepted(projectTodos(applied.todos))
    },
  })

  // ── exit_plan_mode — the plan-mode MUTATION row ────────────────────────
  // Same-meaning note (DISCLOSED): the native exit commits only when the
  // user APPROVES the review question; the governed row's human approval IS
  // the PA ApprovalCase this class always walks (its arms are not
  // rule-nameable, so no governed path admits it silently), and the commit
  // lands only post-consume. The pending-intent event shape differs (the
  // row records the approved plan on the store; the native appends a
  // `plan/mode` session event) — recorded honestly, never claimed equal.
  const exitPlanMode = (raw, exec) => run({
    toolName: 'exit_plan_mode',
    exec,
    parse: () => parseExitPlanModeArgs(raw),
    effectsFor: (scope) => [{ kind: 'tool-invoke', toolName: 'exit_plan_mode', resource: null }, metaArm(scope, 'plan-mode')],
    missingAgent: ['EXIT_PLAN_MODE_AGENT_REQUIRED', 'exit_plan_mode requires a calling agent (no session to switch)'],
    body: async ({ scope, args, applyId }) => {
      const planMode = await store.readPlanMode(scope)
      const leg = planModeExitStateLeg(planMode)
      if (leg.ok !== true) {
        observe(`exit_plan_mode state-refusal code=${leg.code} scope=${scope}`)
        return refused(leg.code, leg.detail)
      }
      const applied = await store.applyPlanModeExit(scope, { plan: args.plan, applyId })
      if (applied.ok !== true) {
        observe(`exit_plan_mode apply-refusal code=${applied.code} scope=${scope}`)
        return refused(applied.code, applied.detail)
      }
      observe(`exit_plan_mode RAN scope=${scope}`)
      return accepted({ exited: true, planMode: { active: false } })
    },
  })

  return Object.freeze([
    Object.freeze({
      name: 'todo_write',
      description: 'Record and update the structured task list for the current work. Send the ENTIRE list every call — it REPLACES the previous list. Track multi-step work and show progress. Mark each task done the moment it is done.',
      parameters: {
        type: 'object',
        description: 'The COMPLETE task list, replacing any previous list.',
        properties: {
          todos: {
            type: 'array',
            description: 'The complete task list.',
            items: {
              type: 'object',
              properties: {
                content: { type: 'string', description: 'What the task is — a short imperative line.' },
                status: { type: 'string', enum: ['pending', 'in_progress', 'completed'], description: 'pending | in_progress | completed.' },
              },
              required: ['content', 'status'],
              additionalProperties: false,
            },
          },
        },
        required: ['todos'],
        additionalProperties: false,
      },
      execute: todoWrite,
    }),
    Object.freeze({
      name: 'create_goal',
      description: 'Create one persisted same-session completion goal when the current direct human request is a long-running objective that should continue across rounds. Do not use for trivial single-turn work.',
      parameters: {
        type: 'object',
        properties: {
          objective: { type: 'string', description: 'The concrete completion objective inferred from the direct human request.' },
          max_goal_rounds: { type: 'number', description: 'Optional positive safe-integer limit on automatic continuation rounds.' },
        },
        required: ['objective'],
        additionalProperties: false,
      },
      execute: goalMutation('create_goal', parseCreateGoalArgs, () => 'create'),
    }),
    Object.freeze({
      name: 'get_goal',
      description: 'Read the current same-session goal, including its exact id/revision, objective, phase, completed continuation rounds, round limit and arming.',
      parameters: { type: 'object', properties: {}, additionalProperties: false },
      execute: getGoal,
    }),
    Object.freeze({
      name: 'update_goal',
      description: 'Update the exact current goal revision. edit | pause | resume require a direct human request; complete and blocked are also allowed during the current goal round. Illegal transitions answer typed refusals, never silent accepts.',
      parameters: {
        type: 'object',
        properties: {
          goal_id: { type: 'string', description: 'Exact id returned by get_goal.' },
          revision: { type: 'number', description: 'Exact positive revision returned by get_goal.' },
          action: {
            type: 'string',
            enum: ['edit', 'pause', 'resume', 'complete', 'blocked'],
            description: 'edit, pause, and resume require a direct top-level human request. complete and blocked are also allowed during an automatic continuation of this goal; blocked is rejected before the configured minimum round count.',
          },
          objective: { type: 'string', description: 'Replacement objective; valid only with action edit.' },
          max_goal_rounds: { type: 'number', description: 'Replacement cap; valid only with action edit.' },
          blocked_reason: { type: 'string', description: 'Required only with action blocked.' },
        },
        required: ['goal_id', 'revision', 'action'],
        additionalProperties: false,
      },
      execute: goalMutation('update_goal', parseUpdateGoalArgs, (args) => args.action),
    }),
    Object.freeze({
      name: 'exit_plan_mode',
      description: 'Present your plan for the user\'s review and, on approval, leave plan mode. Send the COMPLETE plan as markdown, starting with a # heading that names it.',
      parameters: {
        type: 'object',
        properties: {
          plan: { type: 'string', description: 'The complete plan, as markdown, starting with a # heading that names it.' },
        },
        required: ['plan'],
        additionalProperties: false,
      },
      execute: exitPlanMode,
    }),
  ])
}
