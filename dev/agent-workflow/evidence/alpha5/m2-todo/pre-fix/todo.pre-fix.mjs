/**
 * governed-families/todo.mjs — A5-M2 B-SESSION `todo_write` arm: the governed
 * PRE-TAKEOVER over the PINNATIVE host tool (family contract
 * `docs/plans/active/alpha5-tool-io-governance/m0-closure-v3/M0-B-FAMILY-TARGET-CONTRACTS.md`
 * §3 B-SESSION: owner/revision checks BEFORE the E session service commits,
 * 保留原生 — this module assembles NO new I/O face, re-implements NO host law,
 * and re-looks-up NO body by name after approval: the ONLY path to the native
 * `todo_write` body is the definition object captured at bind time, reached
 * only through a consumed prepare-ticket (no native fallback exists by
 * construction — §1.2 BASE.C3 `binding DRAINING 后不得 native fallback`).
 *
 * STAGES (§1 FamilyAdapter, todo arm):
 *   classify(args, trustedCtx)  — PURE parse: closed operation set
 *     (`replace-list`, the single public operation), frozen §1.1 vocabulary
 *     effects ONLY (`{kind:'tool-invoke', toolName:'todo_write', resource:null}`
 *     — the I arm; the `@<definitionIdentity>` half rides the bind-time
 *     `definitionIdentity` the factory pins, which the closed-world Guard
 *     re-compares per call; S(current session incarnation, exact todo action)
 *     is manifest + precheck + the host commit entry
 *     (`exec.agent.session.append('todo/write')`, host index.ts:199 @639ed01539),
 *     NOT a PA effect (§1.1 zero new kind). Unknown TOP-LEVEL keys, unknown
 *     item keys, non-array todos, blank content, off-enum status ⇒ typed
 *     refusals — this is the cell the host schema layer does NOT refuse
 *     (implicit open object root, host src index.ts:138-157; the host stays
 *     zero-byte, the refusal lives here).
 *   prepare(plan)               — admitted-phase only; issues the ONE-SHOT
 *     ticket. No business write happens here (todo has no prepare effect: the
 *     only durable effect is the execute-time session append — Ask-pending
 *     therefore provably writes zero because prepare/execute are unreachable
 *     without the ticket).
 *   execute(ticket, exec)       — owner/revision precheck (typed: absent or
 *     foreign identity ⇒ refusal, replacing the host's bare Error at
 *     index.ts:194-197 on the GOVERNED path; the native plane keeps the host
 *     law untouched), CURRENT-vs-target confusion check (the caller
 *     incarnation must equal the incarnation the plan was classified for),
 *     single-claim (a consumed ticket never re-fires), then the bound native
 *     definition's own execute — the canonical list and every host value law
 *     (trim/dup/single-active) stay the host body's, verbatim.
 *   cancel(planOrTicket)        — reports the TRUE race settlement, never a
 *     retroactive rewrite: CANCELLED-BEFORE-ADMISSION / CANCELLED-AFTER-
 *     ADMISSION (both zero append) / ALREADY-COMMITTED (the commit already
 *     rode the session log; §1.2 C3 "取消与提交赛跑必须报告哪个先发生").
 *
 * What this file is NOT: the registration/placement/mask side (CENTER's
 * `agent-bindings.mjs` / takeover ledger glue, see
 * dev/agent-workflow/evidence/alpha5/m2-todo/p-takeover-proposal.md), the
 * admission kernel (A owns Control/PA consumption; this module only enforces
 * that nothing reaches the body without its ticket), or a second permission
 * layer (§1.1: the effects it emits are the tool's own tool-invoke effect).
 *
 * @module runtime/plugin/live/governed-families/todo
 */
import { createHash } from 'node:crypto'

/** Family/arm identity (§1 reviewPayload P-additions: familyId + adapterRevision). */
export const A5_TODO_FAMILY_ID = 'B-SESSION'
export const A5_TODO_TOOL_NAME = 'todo_write'
/** The single public operation of todo_write (whole-list replacement). */
export const A5_TODO_OPERATION = 'replace-list'
export const A5_TODO_ADAPTER_REVISION = 1

/** The status enum mirror of the host law (host index.ts:26 @639ed01539). */
const STATUSES = ['pending', 'in_progress', 'completed']

/**
 * Typed refusal codes for the governed path. P-proposed codes: naming belongs
 * to the governance error family (AUTH/CENTER), the STRINGS are pinned by the
 * lane fixture (`packages/runtime/test/a5-m2-todo-write-c1.test.ts`).
 */
export const A5_TODO_TYPED_CODES = Object.freeze({
  UNKNOWN_PARAMETER: 'P_TODO_CLASSIFY_UNKNOWN_PARAMETER',
  INVALID_ARGUMENTS: 'P_TODO_CLASSIFY_INVALID_ARGUMENTS',
  NO_OWNING_SESSION: 'P_TODO_CLASSIFY_NO_OWNING_SESSION',
  FOREIGN_SESSION: 'P_TODO_CLASSIFY_FOREIGN_SESSION',
  NOT_ADMITTED: 'P_TODO_NOT_ADMITTED',
  ALREADY_CONSUMED: 'P_TODO_ALREADY_CONSUMED',
  CANCELLED: 'P_TODO_CANCELLED',
  DRAINING: 'P_TODO_DRAINING',
})

const CODES = A5_TODO_TYPED_CODES

const refuse = (code, detail) => ({ ok: false, code, detail })

/**
 * The one governed todo_write arm over ONE captured native definition.
 *
 * @param deps - bind-time inputs, validated hard (a config defect refuses at
 *   assembly, never silently defaults — the jobsEnabled law family).
 * @param {object} deps.nativeDefinition - the native `todo_write` definition
 *   OBJECT captured at bind time (never re-read by name).
 * @param {string} deps.definitionIdentity - `definitionIdentityOf` of that
 *   object at bind time (tool-dispatch/install.ts) — the `@` half of the I arm.
 * @param {string} deps.providerId - the trusted assembly placing this arm.
 * @param {string} deps.agentScopeKey - the Agent scope this arm serves.
 * @param {readonly string[]} deps.trustedIdentities - identities counting as
 *   THIS agent (the Guard scope family).
 * @param {boolean} deps.allowParallelInProgress - the config choice in force
 *   (manifest-reported policy fact; the enforcement law stays in the host body).
 * @param {(row: {event: string, correlation: string, detail?: string}) => void} [deps.observe]
 *   - the §1.2 minimal backend log: backend-start / backend-commit /
 *   backend-end (+ classify/admit/consume facts) with the invocation
 *   correlation; the backend-opened face is the bound native definition.
 * @returns the arm handle.
 */
export function createGovernedTodoArm({
  nativeDefinition,
  definitionIdentity,
  providerId,
  agentScopeKey,
  trustedIdentities,
  allowParallelInProgress,
  observe = () => {},
}) {
  if (nativeDefinition === null || typeof nativeDefinition?.execute !== 'function') {
    throw new TypeError('governed-families/todo: nativeDefinition must be the captured definition object with an execute function (bind-time capture, never a name, never a lazy registry guess)')
  }
  if (typeof definitionIdentity !== 'string' || definitionIdentity.length === 0) {
    throw new TypeError('governed-families/todo: definitionIdentity must be a non-empty string (the I arm binds through it; an unbound arm is a config defect)')
  }
  if (typeof providerId !== 'string' || providerId.length === 0) {
    throw new TypeError('governed-families/todo: providerId must be a non-empty string (the placing assembly identifies itself)')
  }
  if (typeof agentScopeKey !== 'string' || agentScopeKey.length === 0 || !Array.isArray(trustedIdentities) || trustedIdentities.length === 0) {
    throw new TypeError('governed-families/todo: agentScopeKey and non-empty trustedIdentities are required (the owner/revision precheck has no otherwise)')
  }
  if (typeof allowParallelInProgress !== 'boolean') {
    throw new TypeError('governed-families/todo: allowParallelInProgress must be an explicit boolean (the host Config has NO default; the arm mirrors that law at assembly)')
  }
  const trusted = new Set(trustedIdentities)

  /** plan/ticket state lives HERE and only here: CLASSIFIED → PREPARED → CONSUMED | CANCELLED. */
  const plans = new WeakMap()
  const tickets = new WeakMap()
  let correlationSeq = 0
  let draining = false

  const nextCorrelation = (paramFingerprint) => {
    correlationSeq += 1
    return `todo.r${A5_TODO_ADAPTER_REVISION}.${correlationSeq}.${paramFingerprint.slice(0, 12)}`
  }

  /** PURE parse. Reads NO disk/network/service; the only facts in are the
   * frozen model argument and the trusted context the caller layer supplies. */
  function classify(args, ctx) {
    if (draining) return refuse(CODES.DRAINING, 'the arm is DRAINING: no call reaches any body, native included (there is no native fallback to fall back to)')
    if (args === null || typeof args !== 'object' || Array.isArray(args)) {
      return refuse(CODES.INVALID_ARGUMENTS, 'arguments must be an object')
    }
    const unknownTop = Object.keys(args).filter((k) => k !== 'todos')
    if (unknownTop.length > 0) {
      return refuse(CODES.UNKNOWN_PARAMETER, `undeclared top-level parameter(s): ${unknownTop.join(', ')} — the governed root is closed (the host schema layer does not refuse these; this arm does)`)
    }
    if (!Array.isArray(args.todos)) {
      return refuse(CODES.INVALID_ARGUMENTS, '"todos" must be an array')
    }
    const agentIdentity = typeof ctx?.agentIdentity === 'string' && ctx.agentIdentity.length > 0 ? ctx.agentIdentity : null
    if (agentIdentity === null) return refuse(CODES.NO_OWNING_SESSION, 'no exec.agent: the list is per-agent-session state and this caller owns no session')
    if (!trusted.has(agentIdentity)) return refuse(CODES.FOREIGN_SESSION, `caller identity is not this scope (${JSON.stringify(agentIdentity)})`)
    const incarnation = typeof ctx.sessionIncarnation === 'string' && ctx.sessionIncarnation.length > 0 ? ctx.sessionIncarnation : null
    if (incarnation === null || incarnation !== agentIdentity) {
      return refuse(CODES.FOREIGN_SESSION, 'the current session incarnation does not match the calling agent (CURRENT vs target confusion is a refusal, not a fallback)')
    }
    const canonical = []
    for (let i = 0; i < args.todos.length; i++) {
      const item = args.todos[i]
      if (item === null || typeof item !== 'object' || Array.isArray(item)) {
        return refuse(CODES.INVALID_ARGUMENTS, `todos[${i}] must be an object`)
      }
      const extra = Object.keys(item).filter((k) => k !== 'content' && k !== 'status')
      if (extra.length > 0) return refuse(CODES.UNKNOWN_PARAMETER, `todos[${i}].${extra.join(', ')} not declared`)
      if (typeof item.content !== 'string' || item.content.trim().length === 0) {
        return refuse(CODES.INVALID_ARGUMENTS, `todos[${i}].content must be a non-empty string`)
      }
      if (!STATUSES.includes(item.status)) {
        return refuse(CODES.INVALID_ARGUMENTS, `todos[${i}].status must be one of ${STATUSES.join('|')}`)
      }
      // duplicate content and the single-active policy are the HOST BODY's
      // value laws (index.ts:80-101): pure classify does NOT re-implement them
      // (§1.1 no parallel law); the digest and the native validation carry it.
      canonical.push({ content: item.content.trim(), status: item.status })
    }
    const todosDigest = createHash('sha256').update(JSON.stringify(canonical)).digest('hex')
    const plan = Object.freeze({
      familyId: A5_TODO_FAMILY_ID,
      adapterRevision: A5_TODO_ADAPTER_REVISION,
      toolName: A5_TODO_TOOL_NAME,
      definitionIdentity,
      providerIdentity: providerId,
      effects: Object.freeze([Object.freeze({ kind: 'tool-invoke', toolName: A5_TODO_TOOL_NAME, resource: null })]),
      manifest: Object.freeze({
        operation: A5_TODO_OPERATION,
        sessionIncarnation: incarnation,
        todosDigest,
        counts: Object.freeze({
          pending: canonical.filter((t) => t.status === 'pending').length,
          inProgress: canonical.filter((t) => t.status === 'in_progress').length,
          completed: canonical.filter((t) => t.status === 'completed').length,
        }),
        allowParallelPolicy: allowParallelInProgress,
        paramFingerprint: todosDigest,
      }),
      canonical: Object.freeze(canonical.map((t) => Object.freeze({ content: t.content, status: t.status }))),
    })
    plans.set(plan, { state: 'CLASSIFIED', correlation: nextCorrelation(todosDigest) })
    observe({ event: 'classify', correlation: plans.get(plan).correlation, detail: todosDigest })
    return { ok: true, plan, effects: plan.effects, manifest: plan.manifest }
  }

  /** Admitted-phase entry. Issues the ONE-SHOT ticket; writes no business state. */
  function prepare(plan) {
    if (draining) return refuse(CODES.DRAINING, 'DRAINING: no admission is admitted, no ticket is issued')
    const entry = plans.get(plan)
    if (entry === undefined) return refuse(CODES.NOT_ADMITTED, 'unknown plan: prepare answers only to a plan this arm classified')
    if (entry.state !== 'CLASSIFIED') return refuse(CODES.NOT_ADMITTED, `plan is ${entry.state}, not classifiable-for-admission`)
    entry.state = 'PREPARED'
    const ticket = Object.freeze({ plan })
    tickets.set(ticket, entry)
    observe({ event: 'admit', correlation: entry.correlation, detail: plan.manifest.todosDigest })
    return { ok: true, ticket }
  }

  /**
   * Consumed-phase entry: precheck → single-claim → the BOUND native body.
   * The append rides `exec.agent.session.append('todo/write')` inside the host
   * body (E commit, host index.ts:199); this arm writes nothing itself.
   */
  function execute(ticket, exec) {
    if (draining) return Promise.resolve(refuse(CODES.DRAINING, 'DRAINING: no body is reachable (no native fallback exists by construction)'))
    const entry = tickets.get(ticket)
    if (entry === undefined) return Promise.resolve(refuse(CODES.NOT_ADMITTED, 'unknown ticket: execute answers only to a prepare-issued ticket (Ask-pending/denied calls never hold one)'))
    if (entry.state === 'CANCELLED') return Promise.resolve(refuse(CODES.CANCELLED, 'the plan was cancelled before consumption: zero append is the truth, not a race'))
    if (entry.state !== 'PREPARED') return Promise.resolve(refuse(entry.state === 'CONSUMED' ? CODES.ALREADY_CONSUMED : CODES.NOT_ADMITTED, `ticket is ${entry.state}`))
    const plan = ticket.plan
    const agentIdentity = typeof exec?.agent?.identity === 'string' && exec.agent.identity.length > 0
      ? exec.agent.identity
      : typeof exec?.agentIdentity === 'string' ? exec.agentIdentity : null
    if (agentIdentity === null) {
      // The typed replacement of the host bare Error (:194-197) ON THIS PATH.
      return Promise.resolve(refuse(CODES.NO_OWNING_SESSION, 'no exec.agent: refused here, before the native body would bare-throw'))
    }
    if (!trusted.has(agentIdentity) || agentIdentity !== plan.manifest.sessionIncarnation) {
      return Promise.resolve(refuse(CODES.FOREIGN_SESSION, 'the consuming caller is not the incarnation this plan was classified for (no CURRENT/target laundering)'))
    }
    entry.state = 'CONSUMED' // single-claim BEFORE the body: a re-fire can never double-commit
    const args = { todos: plan.canonical.map((t) => ({ content: t.content, status: t.status })) }
    observe({ event: 'backend-start', correlation: entry.correlation, detail: plan.definitionIdentity })
    return Promise.resolve()
      .then(() => nativeDefinition.execute(args, exec))
      .then(
        (value) => {
          entry.settled = 'COMMITTED'
          observe({ event: 'backend-commit', correlation: entry.correlation, detail: plan.manifest.todosDigest })
          observe({ event: 'backend-end', correlation: entry.correlation, detail: 'ok' })
          return { ok: true, value }
        },
        (error) => {
          // The commit boundary of a rejected native body is unknowable from
          // here (the append happens synchronously before the return, but a
          // throw after it is possible): report which, never rewrite.
          entry.settled = 'COMMIT-UNKNOWN'
          observe({ event: 'backend-end', correlation: entry.correlation, detail: 'error' })
          throw error
        },
      )
  }

  /** The honest race report. §1.2 C3: it states WHICH happened first. */
  function cancel(planOrTicket) {
    const entry = plans.get(planOrTicket) ?? tickets.get(planOrTicket)
    if (entry === undefined) return refuse(CODES.NOT_ADMITTED, 'cancel answers only to a plan/ticket this arm issued')
    if (entry.state === 'CONSUMED') {
      return { ok: true, settled: entry.settled === 'COMMIT-UNKNOWN' ? 'COMMIT-UNKNOWN' : 'ALREADY-COMMITTED', appendOutcome: entry.settled === 'COMMIT-UNKNOWN' ? 'unknown — the native body reported no commit boundary' : 'the todo/write append rode the session log; cancellation cannot retract it' }
    }
    const wasAdmitted = entry.state === 'PREPARED'
    entry.state = 'CANCELLED'
    observe({ event: 'cancel', correlation: entry.correlation, detail: wasAdmitted ? 'after-admission' : 'before-admission' })
    return { ok: true, settled: wasAdmitted ? 'CANCELLED-AFTER-ADMISSION' : 'CANCELLED-BEFORE-ADMISSION', appendOutcome: 'zero — no ticket was consumed, the body is unreachable without one' }
  }

  /** C3 DRAINING: after this, every stage refuses typed; nothing reaches any body. */
  function drain() {
    draining = true
  }

  return {
    familyId: A5_TODO_FAMILY_ID,
    adapterRevision: A5_TODO_ADAPTER_REVISION,
    definitionIdentity,
    providerId,
    classify,
    prepare,
    execute,
    cancel,
    drain,
  }
}
