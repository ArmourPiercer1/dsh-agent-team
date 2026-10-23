/**
 * governed-families/todo.mjs — A5-M2 B-SESSION `todo_write` arm: the governed
 * PRE-TAKEOVER over the PINNATIVE host tool (family contract
 * `docs/plans/active/alpha5-tool-io-governance/m0-closure-v3/M0-B-FAMILY-TARGET-CONTRACTS.md`
 * §3 B-SESSION: owner/revision checks BEFORE the E session service commits,
 * 保留原生 — this module assembles NO new I/O face, re-implements NO host law,
 * and holds NO authority of its own: the real M1 A assembly
 * (`runtime/tool-admission` — open → planApproval/prepare → the ONE
 * `consumeForExecution` edge) owns admission; the arm's plan state is INTERNAL
 * bookkeeping, never a permission source (root card 07:2x: ticket 只是内部
 * 状态，不是权限来源；不得新账本). The ONLY path to the native `todo_write`
 * body is the definition + its `execute` FUNCTION captured at BIND time plus
 * the caller's session APPEND snapshotted at classify time (the approval
 * window is entered afterwards); at the execution edge the arm RE-CHECKS the
 * M1/Guard binding generations and the captured definition identity/function
 * before the commit, and the commit runs through the SNAPSHOT only (root card
 * ③: 执行期不得再向可变对象取身份或 body).
 *
 * IDENTITY (root card ① — real Host shapes ONLY, no invented words, no shim):
 *   pairing = `exec.agent.id` (Agent.id — Session-backed Agent identity,
 *   core/agent types.d.ts:13) ↔ the arm's bind-time memberAgentId, AND
 *   `exec.agent.session.header.id` (Session.header.id — the durable header's
 *   single copy, core/session types.d.ts:64-65) ↔ the arm's bind-time
 *   sessionHeaderId. TWO independent real facts (agent ↔ member, durable
 *   header ↔ session), not one value checked twice. Binding generations ride
 *   the edge: the glue injects `bindingFacts()` (the SAME M1/Guard facts the
 *   plane reads per call: bindingId/revision/policyGeneration/
 *   authorityGeneration); the arm mints no business revision of its own.
 *
 * STATE MACHINE (root card ② — 未执行者绝不可称 commit; report ≡ append truth):
 *   CLASSIFIED → PREPARED(grant issued) → CLAIMED(edge consumed, body not yet
 *   entered) → EXECUTING(body entered) → COMMITTED | FAILED-UNKNOWN;
 *   CANCELLED reachable while the body can still be stopped. The cancel/drain
 *   re-check runs AT THE COMMIT EDGE (the microtask that enters the body): a
 *   same-tick cancel therefore yields CANCELLED-BEFORE-EXECUTION with append=0
 *   — consistent by construction. Once EXECUTING the append boundary lives
 *   INSIDE the native body and the arm reports UNKNOWN-IN-FLIGHT — never
 *   ALREADY-COMMITTED (that word appears only after the body resolved), never
 *   zero (the append may ride). COMMITTED ⇒ cancellation cannot retract.
 *
 * PAYLOAD (contract 载荷法 — M0 严格载荷): classify answers a deep-FROZEN
 * `reviewPayload` = {familyId, adapterRevision, providerIdentity,
 * definitionIdentity, targetManifest} + the §1.1 effects
 * (`{kind:'tool-invoke', toolName:'todo_write', resource:null}` ONLY), and an
 * `parametersFingerprint` over the FULL VALUES (never digest-only): this is the
 * `parametersFingerprint` the A request carries and the consumed grant must
 * answer with verbatim — the grant therefore binds the exact payload the body
 * runs. `todosDigest` stays a manifest SUMMARY, never the identity.
 *
 * What this file is NOT: the registration/placement/mask side (CENTER's
 * `agent-bindings.mjs` / takeover ledger glue — see
 * dev/agent-workflow/evidence/alpha5/m2-todo/p-takeover-proposal.md), the
 * admission kernel (A owns Control/PA consumption; the arm merely consumes
 * ITS consumed-proof at the edge), or a second permission layer.
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
  DEFINITION_DRIFT: 'P_TODO_DEFINITION_DRIFT',
  GRANT_MISMATCH: 'P_TODO_GRANT_MISMATCH',
})

const CODES = A5_TODO_TYPED_CODES

const refuse = (code, detail) => ({ ok: false, code, detail })

const canonicalJson = (value) => JSON.stringify(value, (_k, v) => (
  v !== null && typeof v === 'object' && !Array.isArray(v)
    ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, v[k]]))
    : v
))

const sha256 = (text) => createHash('sha256').update(text, 'utf8').digest('hex')

/** Deep-freeze a plain JSON tree (载荷法: 冻结 payload). */
function deepFreeze(value) {
  if (value !== null && typeof value === 'object') {
    for (const inner of Object.values(value)) deepFreeze(inner)
    Object.freeze(value)
  }
  return value
}

/**
 * The one governed todo_write arm over ONE captured native definition.
 *
 * @param deps - bind-time inputs, validated hard (a config defect refuses at
 *   assembly, never silently defaults — the jobsEnabled law family).
 * @param {object} deps.nativeDefinition - the native `todo_write` definition
 *   OBJECT captured at bind time (never re-read by name).
 * @param {string} deps.definitionIdentity - `definitionIdentityOf` of that
 *   object at bind time — the `@` half of the I arm; RE-VERIFIED at the edge.
 * @param {string} deps.providerId - the trusted assembly placing this arm.
 * @param {string} deps.memberAgentId - the member's REAL `Agent.id` (pairing
 *   target for `exec.agent.id`).
 * @param {string} deps.sessionHeaderId - the durable `session.header.id`
 *   single copy (pairing target for `exec.agent.session.header.id`).
 * @param {() => {bindingId: string, bindingRevision: number, policyGeneration: number, authorityGeneration: number}} deps.bindingFacts
 *   - the injected M1/Guard binding-generation reader (the same facts the
 *   plane reads per call); snapshot at classify, RE-CHECKED at the edge.
 * @param {boolean} deps.allowParallelInProgress - the config choice in force
 *   (manifest-reported policy fact; the enforcement law stays in the host body).
 * @param {(row: {event: string, correlation: string, detail?: string}) => void} [deps.observe]
 *   - the §1.2 minimal backend log with the invocation correlation.
 */
export function createGovernedTodoArm({
  nativeDefinition,
  definitionIdentity,
  providerId,
  memberAgentId,
  sessionHeaderId,
  bindingFacts,
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
  if (typeof memberAgentId !== 'string' || memberAgentId.length === 0 || typeof sessionHeaderId !== 'string' || sessionHeaderId.length === 0) {
    throw new TypeError('governed-families/todo: memberAgentId and sessionHeaderId are required (the REAL Host identity pairing has no otherwise)')
  }
  if (typeof bindingFacts !== 'function') {
    throw new TypeError('governed-families/todo: bindingFacts must be the injected M1/Guard reader (the arm mints no generations of its own)')
  }
  if (typeof allowParallelInProgress !== 'boolean') {
    throw new TypeError('governed-families/todo: allowParallelInProgress must be an explicit boolean (the host Config has NO default; the arm mirrors that law at assembly)')
  }

  /** BIND-TIME SNAPSHOT of the body (root card ③): the function VALUE, so a
   * later property replacement on the definition cannot redirect the call. */
  const bindExecute = nativeDefinition.execute
  const plans = new WeakMap()
  let correlationSeq = 0
  let draining = false

  const generationFacts = () => {
    const facts = bindingFacts()
    return {
      definitionIdentity,
      providerId,
      bindingId: facts.bindingId,
      bindingRevision: facts.bindingRevision,
      policyGeneration: facts.policyGeneration,
      authorityGeneration: facts.authorityGeneration,
    }
  }

  /** REAL Host-shape identity read (card ①): exactly the public runtime-face
   * paths `exec.agent.id` and `exec.agent.session.header.id`; ANY other word
   * is simply unreadable here (an `identity`/`agentIdentity` field is NOT read
   * — no compatibility shim, by ruling). */
  const readIdentity = (exec) => {
    const agentId = typeof exec?.agent?.id === 'string' && exec.agent.id.length > 0 ? exec.agent.id : null
    const headerId = typeof exec?.agent?.session?.header?.id === 'string' && exec.agent.session.header.id.length > 0 ? exec.agent.session.header.id : null
    return { agentId, headerId }
  }

  /** PURE parse + snapshot. Reads NO disk/network/service; the only inputs are
   * the frozen model argument and the REAL exec the host dispatched with. */
  function classify(args, exec, callId) {
    if (draining) return refuse(CODES.DRAINING, 'the arm is DRAINING: no call reaches any body, native included (there is no native fallback to fall back to)')
    if (typeof callId !== 'string' || callId.length === 0) {
      return refuse(CODES.INVALID_ARGUMENTS, 'the A invocation correlation (callId) is required at classify time')
    }
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
    const { agentId, headerId } = readIdentity(exec)
    if (agentId === null || headerId === null) {
      return refuse(CODES.NO_OWNING_SESSION, 'no real exec.agent.id / exec.agent.session.header.id: the list is per-agent-session state and this caller owns no session (the host body would bare-throw at :194-197; this path refuses typed)')
    }
    if (agentId !== memberAgentId || headerId !== sessionHeaderId) {
      return refuse(CODES.FOREIGN_SESSION, `identity pairing failed against the bind-time facts (agent ${JSON.stringify(agentId)} vs ${JSON.stringify(memberAgentId)}, session.header ${JSON.stringify(headerId)} vs ${JSON.stringify(sessionHeaderId)})`)
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
    const todosDigest = sha256(canonicalJson(canonical))
    const effects = deepFreeze([{ kind: 'tool-invoke', toolName: A5_TODO_TOOL_NAME, resource: null }])
    const targetManifest = deepFreeze({
      operation: A5_TODO_OPERATION,
      agentId,
      sessionHeaderId: headerId,
      todosDigest,
      counts: {
        pending: canonical.filter((t) => t.status === 'pending').length,
        inProgress: canonical.filter((t) => t.status === 'in_progress').length,
        completed: canonical.filter((t) => t.status === 'completed').length,
      },
      allowParallelPolicy: allowParallelInProgress,
      paramFingerprint: todosDigest,
    })
    const generations = generationFacts()
    const reviewPayload = deepFreeze({
      familyId: A5_TODO_FAMILY_ID,
      adapterRevision: A5_TODO_ADAPTER_REVISION,
      providerIdentity: providerId,
      definitionIdentity,
      targetManifest,
    })
    // ROOT RULING (closed): TWO fingerprint layers, NEVER merged or replaced.
    //   parametersFingerprint = the independent digest of THIS call's full
    //   canonicalized values (载荷法: FULL VALUES, never digest-only; the
    //   frozen GRANT GRAMMAR $.parametersFingerprint field-type demands the
    //   `sha256:<hex64>` form — prefix part of the VALUE; hit live by the
    //   lane legs). This is what the A request carries and what the consumed
    //   grant must answer with verbatim — the arm pairs against it.
    //   operationFingerprint = the strict-MANIFEST canonical digest, computed
    //   by the PA center (`canonicalJsonFingerprint(manifest)` with the four
    //   P-adds carried WHOLE via PaControlLegInput.family @ pa-control-bridge
    //   .ts:395-417, fail-closed `family-review-facts-incomplete` BEFORE the
    //   durable row/mint/consume). The arm NEVER computes or self-defines it.
    const parametersFingerprint = `sha256:${sha256(canonicalJson({
      ...generations,
      callId,
      effects,
      reviewPayload,
    }))}`
    const plan = deepFreeze({
      familyId: A5_TODO_FAMILY_ID,
      adapterRevision: A5_TODO_ADAPTER_REVISION,
      toolName: A5_TODO_TOOL_NAME,
      definitionIdentity,
      providerId,
      callId,
      effects,
      reviewPayload,
      parametersFingerprint,
      canonical,
      generationsAtClassify: Object.freeze(generations),
    })
    // APPROVAL-WINDOW SNAPSHOT (root card ③): the commit runs through THESE
    // values only. The append function is captured BOUND to its session; the
    // exec facade is a frozen value-tree over the real ids — later replacement
    // of exec.agent / session / header on the live object reaches nothing.
    const append = exec.agent.session.append
    const sessionForAppend = exec.agent.session
    const snapshot = {}
    snapshot.appendBound = typeof append === 'function' ? append.bind(sessionForAppend) : null
    snapshot.facade = Object.freeze({
      agent: Object.freeze({
        id: agentId,
        session: Object.freeze({
          header: Object.freeze({ id: headerId }),
          append: (type, data) => {
            if (snapshot.appendBound === null) throw new Error('todo_write requires an owning agent session')
            return snapshot.appendBound(type, data)
          },
        }),
      }),
    })
    correlationSeq += 1
    const correlation = `todo.r${A5_TODO_ADAPTER_REVISION}.${correlationSeq}.${callId}`
    plans.set(plan, { state: 'CLASSIFIED', correlation, snapshot })
    observe({ event: 'classify', correlation, detail: parametersFingerprint })
    return { ok: true, plan, effects, reviewPayload, parametersFingerprint, manifest: targetManifest }
  }

  /** The grant-issued hook (A answered allow/approve): internal state only —
   * authority lives in the kernel's grant, never here. Writes no business state. */
  function prepare(plan, grant) {
    if (draining) return refuse(CODES.DRAINING, 'DRAINING: no admission is admitted, no execution will start')
    const entry = plans.get(plan)
    if (entry === undefined) return refuse(CODES.NOT_ADMITTED, 'unknown plan: prepare answers only to a plan this arm classified')
    if (entry.state !== 'CLASSIFIED') return refuse(CODES.NOT_ADMITTED, `plan is ${entry.state}, not open-for-admission`)
    if (grant === null || typeof grant !== 'object' || typeof grant.grantId !== 'string') {
      return refuse(CODES.NOT_ADMITTED, 'prepare takes the kernel grant object (admission answered allow/approve); a plan without a grant never proceeds')
    }
    entry.state = 'PREPARED'
    entry.grantId = grant.grantId
    observe({ event: 'admit', correlation: entry.correlation, detail: grant.grantId })
    return { ok: true }
  }

  /**
   * The consumed-edge entry: the glue calls this ONLY after the REAL A edge
   * (`assembly.consumeForExecution`) answered with a consumed grant. The arm
   * re-verifies pairing + generations + the body snapshot, runs the COMMIT-EDGE
   * cancel/drain re-check, then enters the body through SNAPSHOT VALUES ONLY.
   */
  function execute(plan, consumed) {
    const entry = plans.get(plan)
    if (entry === undefined) return Promise.resolve(refuse(CODES.NOT_ADMITTED, 'unknown plan: execute answers only to a plan this arm classified'))
    if (entry.state === 'CANCELLED') return Promise.resolve(refuse(CODES.CANCELLED, 'the plan was cancelled before the edge: zero append is the truth, not a race'))
    if (entry.state !== 'PREPARED') {
      const spent = entry.state === 'CLAIMED' || entry.state === 'EXECUTING' || entry.state === 'COMMITTED'
      return Promise.resolve(refuse(spent ? CODES.ALREADY_CONSUMED : CODES.NOT_ADMITTED, `plan is ${entry.state}`))
    }
    const grant = consumed?.grant
    if (consumed?.consumed !== true || grant === null || typeof grant !== 'object' || typeof grant.grantId !== 'string') {
      return Promise.resolve(refuse(CODES.NOT_ADMITTED, 'execute takes the REAL consumed-proof of the A execution edge ({grant, consumed:true}); internal state never substitutes for it'))
    }
    // PAIRING: the consumed grant must answer to THIS plan's payload and call.
    if (
      grant.callId !== plan.callId
      || grant.parametersFingerprint !== plan.parametersFingerprint
      || grant.bindingId !== plan.generationsAtClassify.bindingId
      || grant.bindingRevision !== plan.generationsAtClassify.bindingRevision
    ) {
      return Promise.resolve(refuse(CODES.GRANT_MISMATCH, 'the consumed grant does not answer to this plan (callId / parametersFingerprint / binding-generation pairing): a grant spent for one payload never runs another'))
    }
    // EDGE RE-CHECK ③: definition identity + the captured function value.
    const current = generationFacts()
    if (current.definitionIdentity !== plan.definitionIdentity || nativeDefinition.execute !== bindExecute) {
      return Promise.resolve(refuse(CODES.DEFINITION_DRIFT, 'the placed definition or its execute function moved since bind time: the governed call refuses here; there is no replacement-body path and no native fallback'))
    }
    if (
      current.bindingRevision !== plan.generationsAtClassify.bindingRevision
      || current.policyGeneration !== plan.generationsAtClassify.policyGeneration
      || current.authorityGeneration !== plan.generationsAtClassify.authorityGeneration
    ) {
      return Promise.resolve(refuse(CODES.GRANT_MISMATCH, `binding generations moved between classify and the edge (${JSON.stringify(plan.generationsAtClassify)} -> ${JSON.stringify(current)}): a stale approval never rides a new generation`))
    }
    // STATE: CLAIMED = consumed-edge reached, body NOT yet entered.
    entry.state = 'CLAIMED'
    const args = { todos: plan.canonical.map((t) => ({ content: t.content, status: t.status })) }
    return Promise.resolve()
      .then(() => {
        // COMMIT-EDGE RE-CHECK ②: a cancel/drain that landed in the same tick
        // (or any time before the body is entered) stops the body HERE — which
        // is why a same-tick cancellation report and the append count can
        // never disagree.
        if (entry.state === 'CANCELLED') {
          const edge = new Error('cancelled at the commit edge')
          edge.a5Edge = 'CANCELLED'
          throw edge
        }
        if (draining) {
          const edge = new Error('drained at the commit edge')
          edge.a5Edge = 'DRAINING'
          throw edge
        }
        entry.state = 'EXECUTING'
        observe({ event: 'backend-start', correlation: entry.correlation, detail: plan.definitionIdentity })
        // SNAPSHOT EXECUTION ONLY (card ③): bindExecute (function VALUE from
        // bind time) against the frozen facade (captured at classify time).
        return bindExecute.call(nativeDefinition, args, entry.snapshot.facade)
      })
      .then(
        (value) => {
          entry.state = 'COMMITTED'
          observe({ event: 'backend-commit', correlation: entry.correlation, detail: plan.parametersFingerprint })
          observe({ event: 'backend-end', correlation: entry.correlation, detail: 'ok' })
          return { ok: true, value }
        },
        (error) => {
          if (error?.a5Edge === 'CANCELLED') {
            // The body NEVER ran: the append count stays at zero — report and
            // count agree by construction (card ②).
            entry.state = 'CANCELLED'
            observe({ event: 'backend-end', correlation: entry.correlation, detail: 'cancelled-at-edge' })
            return refuse(CODES.CANCELLED, 'cancelled before the body: zero append (the commit-edge re-check stopped it)')
          }
          if (error?.a5Edge === 'DRAINING') {
            entry.state = 'DRAINED-AT-EDGE'
            observe({ event: 'backend-end', correlation: entry.correlation, detail: 'drained-at-edge' })
            return refuse(CODES.DRAINING, 'drained before the body: zero append (the commit-edge re-check stopped it); no native fallback exists')
          }
          // The native body threw AFTER entry: the append boundary lives
          // inside it; honesty reports unknown, never a claim either way.
          entry.state = 'FAILED-UNKNOWN'
          observe({ event: 'backend-end', correlation: entry.correlation, detail: 'error' })
          throw error
        },
      )
  }

  /** The honest race report (②): the words below are true OF THE STATE AT
   * THIS INSTANT and agree with the observable append count at this instant. */
  function cancel(plan) {
    const entry = plans.get(plan)
    if (entry === undefined) return refuse(CODES.NOT_ADMITTED, 'cancel answers only to a plan this arm issued')
    if (entry.state === 'COMMITTED') {
      return { ok: true, settled: 'ALREADY-COMMITTED', appendOutcome: 'one — the todo/write append rode the session log; cancellation cannot retract it' }
    }
    if (entry.state === 'EXECUTING') {
      return { ok: true, settled: 'UNKNOWN-IN-FLIGHT', appendOutcome: 'unknown — the native body has been entered and its append boundary is inside it; this arm claims neither zero nor committed (await the execution result)' }
    }
    if (entry.state === 'FAILED-UNKNOWN') {
      return { ok: true, settled: 'COMMIT-UNKNOWN', appendOutcome: 'unknown — the body was entered and reported failure; the boundary is inside the native body' }
    }
    const edgeReached = entry.state === 'CLAIMED'
    const wasAdmitted = edgeReached || entry.state === 'PREPARED'
    entry.state = 'CANCELLED'
    observe({ event: 'cancel', correlation: entry.correlation, detail: edgeReached ? 'at-edge' : wasAdmitted ? 'after-admission' : 'before-admission' })
    return {
      ok: true,
      settled: edgeReached ? 'CANCELLED-BEFORE-EXECUTION' : wasAdmitted ? 'CANCELLED-AFTER-ADMISSION' : 'CANCELLED-BEFORE-ADMISSION',
      appendOutcome: 'zero — the body never ran (a CLAIMED plan is stopped by the commit-edge re-check; a PREPARED/CLASSIFIED plan never reaches an edge)',
    }
  }

  /** C3 DRAINING: after this, no NEW call reaches any body; an entered body is
   * not rewound (honesty), and nothing falls back to native (there is nowhere
   * to fall back to). */
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
