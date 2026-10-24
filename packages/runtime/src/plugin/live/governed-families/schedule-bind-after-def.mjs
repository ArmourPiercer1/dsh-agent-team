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
    return true
  }

  function bindExecutions(agent) {
    const serviceAtBind = deps.scheduleServiceFeed?.()
    if (serviceAtBind === null || typeof serviceAtBind !== 'object'
      || typeof serviceAtBind.list !== 'function' || typeof serviceAtBind.delete !== 'function') {
      throw breakpoint('service-shape', 'full ScheduleService-shaped live handle (list/delete)', String(serviceAtBind), 'execute/live service identity')
    }
    const isOurs = (exec) => exec?.agent === agent && originalDefs.has(exec?.name)
    // pre-execute: PA consume-for-execution is MANDATORY (guard alone never
    // substitutes); exact original-def identity + family definitionIdentity.
    disposers.push(deps.agentEvents.on('tools/pre-execute', (exec, next) => {
      if (!isOurs(exec)) return next()
      const def = originalDefs.get(exec.name)
      const consumed = deps.consumePa?.(exec.callId ?? exec.id, def) === true
      if (!consumed) {
        note('pa-not-consumed', { name: exec.name })
        return Promise.resolve({ kind: 'deny', reason: 'a5m2-schedule: PA was not consumed for this execution — the guard lane is defense-in-depth, never the permit' })
      }
      return next()
    }))
    // execute: live service identity must still be the SAME object the bind
    // saw (PORT_DRIFT legs are REAL); name+agent already exact.
    disposers.push(deps.agentEvents.on('tools/execute', (exec, next) => {
      if (!isOurs(exec)) return next()
      const live = deps.scheduleServiceFeed?.()
      if (live !== serviceAtBind) {
        note('service-identity-drift', { name: exec.name })
        return Promise.reject(breakpoint('service-identity-drift', 'the SAME live service object as at bind time', 'a different object underneath execute', 'tools/execute'))
      }
      return next() // never rewrite signal, never touch identity (contract)
    }))
    // post-execute: ACCEPT (observe only) — the owning registry normalizes
    // through its output contract (:1864-1884); replacing is out of scope.
    disposers.push(deps.agentEvents.on('tools/post-execute', (exec, result, next) => {
      if (isOurs(exec)) note('governed-result', { name: exec.name, isError: result?.isError === true })
      return next()
    }))
    // guard: monotonic agent-scoped DENY-lane only (defense-in-depth before
    // the PA lane; a guard alone never permits, per binding law).
    disposers.push(deps.registerGuard((exec) => {
      if (isOurs(exec) && deps.consumePa?.peekConsumed?.(exec.callId ?? exec.id) === 'pending-denial') {
        return 'a5m2-schedule: pending PA denial (guard lane)'
      }
      return undefined
    }))
    bound = true
    note('bound-after-def', { defs: [...originalDefs.keys()], serviceCaptured: true })
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
        throw error
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
