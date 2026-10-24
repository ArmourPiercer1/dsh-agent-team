/**
 * schedule-bind-after-def — ISOLATED semantic block (center 00:3x directive).
 *
 * Binds our governed consumption of the native schedule pair AFTER the
 * ORIGINAL definition appears; it NEVER registers a definition of its own,
 * NEVER touches the upstream service's private attach/WeakSet, NEVER deletes
 * a pair check, and keeps NO ledger (in-memory effect state only).
 *
 * Host seam map (upstream 639 pristine, read-only reference; src TS view —
 * the same public interfaces the source-built launch runs):
 *   packages/core/tools/src/index.ts
 *     :154  'tools/pre-execute'  waterfall (allow/deny/cancel/ask; agent-scoped via dsh-scope)
 *     :164  'tools/execute'      around-dispatch waterfall
 *     :176  'tools/post-execute' waterfall (accept/replace/enrich/block of the normalized result)
 *     :1126-1135 guard() monotonic, agent.ctx-scoped when registered through the agent; disposer-returned
 *     :1864-1884 normalizeDispatchResult — around-wrapper results pass the OWNING output contract
 *   @deepseek-ai/dsh-schedule lib/index.js (upstream auto-registrar — left EXACTLY where it is)
 *     :2660 ctx.on("agent/created", attach)   ← the def's first appearance is AFTER this settles
 *     :2655-2659 attach guard (!stopping, WeakSet, roots().includes)
 *     :2116+ registerScheduleTools: toolCtx.tools.register(defineTool ...) for all four tools
 * Lane binding law honored here: bind only AFTER the original def appears (no
 * setup-time early fetch); exact Agent + original def + execute/live service
 * identity; real family definitionIdentity + PA consume-for-execution; a
 * guard alone NEVER substitutes for PA; sameAgent scope around dispatch is
 * govern-then-next.
 */

export const SCHEDULE_AFTER_DEF_BIND_POINTS = Object.freeze({
  preExecuteEvent: 'packages/core/tools/src/index.ts:154',
  executeEvent: 'packages/core/tools/src/index.ts:164',
  postExecuteEvent: 'packages/core/tools/src/index.ts:176',
  guardFace: 'packages/core/tools/src/index.ts:1126-1135',
  resultNormalization: 'packages/core/tools/src/index.ts:1864-1884',
  upstreamDefFirstAppears: '@deepseek-ai/dsh-schedule lib/index.js:2660→2116 (agent/created)',
})

const PAIR = Object.freeze(['schedule_list', 'schedule_delete'])

/** Precise interface-breakpoint report (card: expected vs actual, file:line). */
function breakpoint(kind, expected, actual, where) {
  const error = new Error(`schedule-bind-after-def: ${kind} — expected ${expected}, actual ${actual} (${where})`)
  error.code = 'a5m2-schedule-bind-breakpoint'
  error.breakpoint = { kind, expected, actual, where }
  return error
}

/**
 * @param deps - {
 *   readToolDefinition(name, agent)   // public agent tool-face read (tools.get)
 *   subscribeAgentCreated(listener)   // public agent/created subscription, returns disposer
 *   agentEvents                       // the agent-scoped public events face (pre/execute/post)
 *   registerGuard(guardFn)            // agent.ctx tools.guard() → disposer
 *   scheduleServiceFeed()             // raw ctx.schedule handle feed (live re-read each call)
 *   consumePa(callId, definitionIdentity) // PA consume-for-execution; truthy = consumed
 *   observe(row)
 * }
 */
export function createScheduleBindAfterDef(deps) {
  const disposers = []
  const originalDefs = new Map() // name -> the ORIGINAL definition object (never copied, never replaced)
  let bound = false
  const note = (event, extra) => deps.observe?.({ event, ...(extra ?? {}) })

  function captureOriginalDefs(agent) {
    for (const name of PAIR) {
      let def
      try {
        def = deps.readToolDefinition(name, agent)
      } catch (error) {
        throw breakpoint('tool-face-unreadable', `public tools.get('${name}', agent) to answer`, `threw ${String(error?.message ?? error).slice(0, 140)}`, SCHEDULE_AFTER_DEF_BIND_POINTS.upstreamDefFirstAppears)
      }
      if (def === null || typeof def !== 'object') {
        // NOT a fetch-time failure: this only runs after created settled, so an
        // absent def here is the real availability breakpoint for the center.
        throw breakpoint('def-absent-post-created', `original '${name}' definition visible post-created via the public face`, `absent (${String(def)})`, SCHEDULE_AFTER_DEF_BIND_POINTS.upstreamDefFirstAppears)
      }
      if (originalDefs.has(name) && originalDefs.get(name) !== def) {
        throw breakpoint('def-identity-drift', 'the same original definition object', 'a different object after the def appeared', `pair:${name}`)
      }
      originalDefs.set(name, def)
    }
    // BIND-MOMENT RE-READ (gate b): a look-alike copy that answers the SECOND
    // read of the same name is refused here, before any listener exists — the
    // binding only ever holds the ORIGINAL objects captured above.
    for (const name of PAIR) {
      const again = deps.readToolDefinition(name, agent)
      if (again !== originalDefs.get(name)) {
        throw breakpoint('def-identity-drift', 'the same original definition object at the bind-moment re-read', 'a different object (look-alike copy)', `pair:${name}`)
      }
    }
    return true
  }

  function bindExecutions(agent) {
    const serviceAtBind = deps.scheduleServiceFeed?.()
    if (serviceAtBind === null || typeof serviceAtBind !== 'object'
      || typeof serviceAtBind.list !== 'function' || typeof serviceAtBind.delete !== 'function') {
      throw breakpoint('service-shape', 'full ScheduleService-shaped live handle (list/delete)', String(serviceAtBind), 'execute/live service identity')
    }
    const events = deps.agentEventsFor ? deps.agentEventsFor(agent) : deps.agentEvents
    const registerGuard = deps.registerGuardFor ? deps.registerGuardFor(agent) : deps.registerGuard
    const isOurs = (exec) => exec?.agent === agent && originalDefs.has(exec?.name)
    // pre-execute: scope + identity checks ONLY — the run_code D2 lesson is
    // law here: consuming a ticket at pre-execute would leave the downstream
    // Ask stages uncovered, so the final PA consume lives AT the execute body
    // boundary below. This leg may still DENY fail-closed, never permit.
    disposers.push(events.on('tools/pre-execute', (exec, next) => {
      if (!isOurs(exec)) return next()
      note('governed-pre', { name: exec.name })
      return next()
    }))
    // execute = THE BODY BOUNDARY: live service identity re-check first,
    // then the FINAL PA consume (one consume per one native dispatch — the
    // witness is taken exactly here and nowhere else), then next() hands the
    // REAL native body to the host's own dispatch. Drift or a missing
    // witness refuse BEFORE any body entry; nothing is consumed on a refusal.
    disposers.push(events.on('tools/execute', async (exec, next) => {
      if (!isOurs(exec)) return next()
      const live = deps.scheduleServiceFeed?.()
      if (live !== serviceAtBind) {
        note('service-identity-drift', { name: exec.name })
        throw breakpoint('service-identity-drift', 'the SAME live service object as at bind time', 'a different object underneath execute', 'tools/execute')
      }
      const def = originalDefs.get(exec.name)
      const consume = deps.consumePaAtBody ?? deps.consumePa
      let witness = false
      try {
        witness = await Promise.resolve(consume?.(exec, def)) === true
      } catch (error) {
        note('pa-consume-fault', { name: exec.name, detail: String(error?.message ?? error).slice(0, 140) })
        throw breakpoint('pa-consume-fault', 'the PA consume at the body boundary to answer cleanly', `threw ${String(error?.message ?? error).slice(0, 140)}`, 'tools/execute body boundary')
      }
      if (witness !== true) {
        note('pa-not-consumed', { name: exec.name })
        throw breakpoint('pa-not-consumed', 'a TRUE PA witness at the execute body boundary (Ask stages covered through this very boundary)', 'no witness consumed', 'tools/execute body boundary')
      }
      note('pa-consumed-at-body', { name: exec.name })
      return next() // never rewrite signal, never touch identity (contract)
    }))
    // post-execute: ACCEPT (observe only) — the owning registry normalizes
    // through its output contract (:1864-1884); replacing is out of scope.
    disposers.push(events.on('tools/post-execute', (exec, result, next) => {
      if (isOurs(exec)) note('governed-result', { name: exec.name, isError: result?.isError === true })
      return next()
    }))
    // guard: monotonic agent-scoped DENY-lane only (defense-in-depth before
    // the PA lane; a guard alone never permits, per binding law).
    disposers.push(registerGuard((exec) => {
      if (isOurs(exec) && deps.consumePa?.peekConsumed?.(exec.callId ?? exec.id) === 'pending-denial') {
        return 'a5m2-schedule: pending PA denial (guard lane)'
      }
      return undefined
    }))
    bound = true
    note('bound-after-def', { defs: [...originalDefs.keys()], serviceCaptured: true })
    // The wiring owns the CANONICAL family registration at this moment (the
    // ORIGINAL def objects just bound are its only trusted key source — no
    // parallel placement identity, no capture-side string).
    deps.onBinded?.({ agent, definitions: Object.freeze([...originalDefs.entries()].map(([name, definition]) => Object.freeze({ name, definition }))) })
  }

  /** Start: NO capture at setup; the first read happens only post-created. */
  function start(runtimeAgent) {
    if (typeof runtimeAgent !== 'object' || runtimeAgent === null) {
      throw breakpoint('agent-unreadable', 'the exact member Agent object', String(runtimeAgent), 'bind target')
    }
    disposers.push(deps.subscribeAgentCreated(({ agent }) => {
      if (agent !== runtimeAgent || bound) return
      try {
        captureOriginalDefs(agent)
        bindExecutions(agent)
      } catch (error) {
        note('bind-refused', { detail: String(error?.message ?? error).slice(0, 220), breakpoint: error?.breakpoint ?? null })
        // In production the wiring owns the fail-closed DENY lane (typed,
        // zero-effect); re-throwing inside the host's awaited created announce
        // would fault the member's turn for a governance-only refusal. With
        // no refuse owner injected, the throw stays (test/factory worlds).
        if (deps.onBindRefused) deps.onBindRefused(error)
        else throw error
      }
    }))
    note('awaiting-def', { law: 'no setup-time fetch; bind only after the original def appears' })
  }

  function dispose() {
    while (disposers.length > 0) { try { disposers.pop()() } catch { /* idempotent teardown */ } }
    originalDefs.clear()
    bound = false
  }

  return Object.freeze({ start, dispose, isBound: () => bound, bindPoints: SCHEDULE_AFTER_DEF_BIND_POINTS })
}
