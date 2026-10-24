/**
 * schedule-bind-after-def — ISOLATED semantic block (center 00:3x directive;
 * ROOT limited-fix card #2 + addenda A/B, same round).
 *
 * Binds our governed consumption of the native schedule pair AFTER the
 * ORIGINAL definition appears; it NEVER registers a definition of its own,
 * NEVER touches the upstream service's private attach/WeakSet, NEVER deletes
 * a pair check, and keeps NO ledger (in-memory effect state only — the ONE
 * durable/flight ledger stays the plane's own).
 *
 * CARD #2 LAWS (root 07:0x + addenda, encoded below):
 *  1. BOUND ONLY ON CANONICAL SUCCESS: bound=true happens ONLY after the
 *     wiring's canonical gate (family registration + arm build, deps.onBinded)
 *     answered {ok:true}; every failure path CLOSES the pair (listeners,
 *     guard, and the keys the gate wrote via deps.onBindClose) — never a
 *     half-bound (addendum A).
 *  2. THE PROOF IS NEVER A BOOLEAN (不能bool true): the execute boundary
 *     accepts ONLY the REAL plane-edge answer {kind:'allow', consumedProof:
 *     {grant:{grantId}}} (the run_code shape, g3-ptc-wiring.mjs:299-378
 *     verbatim law); a boolean, a scalar, or an allow without its one-shot
 *     consume witness refuses the body.
 *  3. THE TRUE-NATIVE BOUNDARY (addendum B): downstream around-hooks may
 *     still await AFTER this handler nominally proceeds — so the pre-body
 *     checks run LAST-MOMENT before exactly-one next(), the post-AWAIT
 *     recheck (bound/abort/def/service) runs after the consume like the old
 *     adapter's body-entry bounds, and the around-chain post-check runs when
 *     the full downstream chain (their awaits + the native body) settles,
 *     refusing ACCEPTANCE of a result produced under a closed pair or a
 *     drifted live face.
 *  4. PER-DISPATCH IDENTITY: CURRENT native definition object + its
 *     execute + the live service object + the bound list/delete METHOD
 *     identities are re-read at every dispatch (root card 3).
 *  5. CREATED-BIND IS AN EVENT, NOT A SETTLED PROOF: the created listener
 *     reaches a SAFE POINT by bounded re-read until the ORIGINAL Schedule
 *     listener's def is publicly visible (the published-def safe point);
 *     budget exhausted = typed refusal, never a bind on hope.
 *
 * Host seam map (upstream 639 pristine, read-only reference; src TS view):
 *   packages/core/tools/src/index.ts
 *     :153/:154 'tools/pre-execute' waterfall — PREPARE ONLY (D1)
 *     :164  'tools/execute'      around waterfall — the BODY BOUNDARY (D2/D3)
 *     :176  'tools/post-execute' waterfall (result normalization :1864-1884)
 *     :1126-1135 guard() monotonic, deny-only; disposer-returned
 *     :326-398 ToolExecution {callId, rootCallId, name, arguments, agent,
 *              token, signal} — the ISSUED call identity is exec.callId
 *   @deepseek-ai/dsh-schedule lib/index.js (upstream auto-registrar — left EXACTLY where it is)
 *     :2660 ctx.on("agent/created", attach) → :2116+ registerScheduleTools
 */

export const SCHEDULE_AFTER_DEF_BIND_POINTS = Object.freeze({
  preExecuteEvent: 'packages/core/tools/src/index.ts:154',
  executeEvent: 'packages/core/tools/src/index.ts:164',
  postExecuteEvent: 'packages/core/tools/src/index.ts:176',
  guardFace: 'packages/core/tools/src/index.ts:1126-1135',
  resultNormalization: 'packages/core/tools/src/index.ts:1864-1884',
  upstreamDefFirstAppears: '@deepseek-ai/dsh-schedule lib/index.js:2660→2116 (agent/created)',
  planeEdgeReference: 'packages/runtime/src/plugin/live/governed-families/g3-ptc-wiring.mjs:299-378 (run_code D1-D4 reference shape)',
})

const PAIR = Object.freeze(['schedule_list', 'schedule_delete'])

const isRecord = (value) => value !== null && typeof value === 'object'

/** Precise interface-breakpoint report (card: expected vs actual, file:line). */
function breakpoint(kind, expected, actual, where) {
  const error = new Error(`schedule-bind-after-def: ${kind} — expected ${expected}, actual ${actual} (${where})`)
  error.code = 'a5m2-schedule-bind-breakpoint'
  error.breakpoint = { kind, expected, actual, where }
  return error
}

/**
 * @param deps - {
 *   readToolDefinition(name, agent)         // public tools.get face (bind-moment + per-dispatch re-read)
 *   subscribeAgentCreated(listener)         // public agent/created subscription → disposer
 *   agentEventsFor?(agent) | agentEvents    // agent-scoped pre/execute/post waterfall face
 *   registerGuardFor?(agent) | registerGuard// agent.ctx tools.guard() → disposer (DENY-ONLY)
 *   scheduleServiceFeed()                   // live ctx.schedule handle (re-read at bind and per dispatch)
 *   onBinded({agent, definitions}) → {ok}   // CANONICAL gate (family registration + arm build);
 *                                           // anything but an {ok:true} answer FAILS the bind
 *   onBindClose(reason)                     // unwinds the gate's writes when registration fails after it
 *   consumePaAtBody(exec, definition)       // the REAL plane-edge walk (pa.open → pa.edge); answers
 *                                           // the raw plane object — NEVER a boolean
 *   onBindRefused?(error)                   // production fail-closed deny lane (else the throw stands)
 *   wait?(ms) | defSettleAttempts | defSettleTickMs // published-def safe point (bounded)
 *   observe(row)
 * }
 */
export function createScheduleBindAfterDef(deps) {
  const disposers = []
  const originalDefs = new Map() // name -> the ORIGINAL definition object (never copied, never replaced)
  let bound = false
  let disposed = false
  let gateOpenedBy = null // the gate's {ok:true} proof while the pair is closing (audit line)
  const note = (event, extra) => deps.observe?.({ event, ...(extra ?? {}) })
  const wait = deps.wait ?? ((ms) => new Promise((resolve) => { globalThis.setTimeout(resolve, ms) }))

  function captureOriginalDefs(agent) {
    for (const name of PAIR) {
      let def
      try {
        def = deps.readToolDefinition(name, agent)
      } catch (error) {
        throw breakpoint('tool-face-unreadable', `public tools.get('${name}', agent) to answer`, `threw ${String(error?.message ?? error).slice(0, 140)}`, SCHEDULE_AFTER_DEF_BIND_POINTS.upstreamDefFirstAppears)
      }
      if (def === null || typeof def !== 'object' || typeof def.execute !== 'function') {
        throw breakpoint('def-absent-post-created', `original '${name}' definition (with execute) visible post-created via the public face`, `absent/incomplete (${String(def)})`, SCHEDULE_AFTER_DEF_BIND_POINTS.upstreamDefFirstAppears)
      }
      if (originalDefs.has(name) && originalDefs.get(name) !== def) {
        throw breakpoint('def-identity-drift', 'the same original definition object', 'a different object after the def appeared', `pair:${name}`)
      }
      originalDefs.set(name, def)
    }
    // BIND-MOMENT RE-READ (gate b): a look-alike copy that answers the SECOND
    // read of the same name is refused here, before any listener exists.
    for (const name of PAIR) {
      const again = deps.readToolDefinition(name, agent)
      if (again !== originalDefs.get(name)) {
        throw breakpoint('def-identity-drift', 'the same original definition object at the bind-moment re-read', 'a different object (look-alike copy)', `pair:${name}`)
      }
    }
    return true
  }

  /** PER-DISPATCH identity law (card 3): CURRENT def object, CURRENT execute,
   *  CURRENT service object and the BOUND list/delete METHOD identities. */
  function verifyLive(agent, name, bindMethods) {
    const current = deps.readToolDefinition(name, agent)
    const def = originalDefs.get(name)
    if (current !== def || current?.execute !== def?.execute) {
      throw breakpoint('native-definition-drift', 'the CURRENT native def/execute to still BE the bound original', 'the def or its execute changed', `per-dispatch:${name}`)
    }
    // The feed is re-asked HERE (root ② law: a bind-time constant compared
    // against itself proves nothing) — the CURRENT live object is the answer.
    const live = deps.scheduleServiceFeed?.()
    if (live !== bindMethods.service) {
      throw breakpoint('service-identity-drift', 'the SAME live service object as at bind time', 'a different object underneath', 'per-dispatch service')
    }
    if (live.list !== bindMethods.list || live.delete !== bindMethods.delete) {
      throw breakpoint('service-method-drift', 'the bound list/delete METHOD identities', 'the service methods changed under the same object', 'per-dispatch methods')
    }
  }

  async function bindExecutions(agent) {
    const serviceAtBind = deps.scheduleServiceFeed?.()
    if (!isRecord(serviceAtBind)
      || typeof serviceAtBind.list !== 'function' || typeof serviceAtBind.delete !== 'function') {
      throw breakpoint('service-shape', 'full ScheduleService-shaped live handle (list/delete)', String(serviceAtBind), 'execute/live service identity')
    }
    const bindMethods = Object.freeze({ service: serviceAtBind, list: serviceAtBind.list, delete: serviceAtBind.delete })
    // (1) CANONICAL GATE FIRST: the wiring's family registration + arm build
    // must answer {ok:true} BEFORE this module opens any waterfall face.
    // Any failure needs no pair-closing here — none exists yet (law A).
    let gate
    try {
      gate = deps.onBinded ? await Promise.resolve(deps.onBinded({
        agent,
        definitions: Object.freeze([...originalDefs.entries()].map(([name, definition]) => Object.freeze({ name, definition }))),
        service: serviceAtBind,
      })) : { ok: true }
    } catch (error) {
      throw breakpoint('canonical-bind-fault', 'the canonical gate (family registration + arm build) to answer {ok:true}', `threw ${String(error?.message ?? error).slice(0, 160)}`, 'onBinded gate')
    }
    if (!isRecord(gate) || gate.ok !== true) {
      throw breakpoint('canonical-bind-refused', 'the canonical gate to answer {ok:true} (family SUCCESS + real arms)', gate === null || gate === undefined ? String(gate) : `answer ${JSON.stringify(Object.keys(gate)).slice(0, 120)}`, 'onBinded gate')
    }
    gateOpenedBy = gate
    // (2) open the governed faces; if ANY registration faults, CLOSE the pair
    // — the keys the gate just wrote are deleted via deps.onBindClose (law A).
    const events = deps.agentEventsFor ? deps.agentEventsFor(agent) : deps.agentEvents
    const registerGuard = deps.registerGuardFor ? deps.registerGuardFor(agent) : deps.registerGuard
    const isOurs = (exec) => exec?.agent === agent && originalDefs.has(exec?.name)
    try {
      // pre-execute: PREPARE ONLY (run_code D1) — scope observation, zero
      // consume: consuming a ticket here would leave the downstream Ask
      // stages uncovered (D2). This leg may DENY fail-closed, never permit.
      disposers.push(events.on('tools/pre-execute', (exec, next) => {
        if (!isOurs(exec)) return next()
        note('governed-pre', { name: exec.name })
        return next()
      }))
      // execute = THE BODY BOUNDARY (D2/D3): all identity checks last-moment,
      // then the REAL plane-edge consume (open→edge→consumedProof), then the
      // post-await recheck, then EXACTLY ONE next().
      disposers.push(events.on('tools/execute', async (exec, next) => {
        if (!isOurs(exec)) return next()
        if (typeof deps.consumePaAtBody !== 'function') {
          throw breakpoint('plane-edge-unwired', 'the wiring to supply the REAL plane-edge consume (pa.open→pa.edge) at bind time', 'no consumePaAtBody dep', 'tools/execute body boundary')
        }
        const def = originalDefs.get(exec.name)
        verifyLive(agent, exec.name, bindMethods)
        let answer
        try {
          answer = await deps.consumePaAtBody(exec, def)
        } catch (error) {
          note('pa-consume-fault', { name: exec.name, detail: String(error?.message ?? error).slice(0, 140) })
          throw breakpoint('pa-consume-fault', 'the plane-edge walk to answer cleanly', `threw ${String(error?.message ?? error).slice(0, 140)}`, 'tools/execute body boundary')
        }
        // THE PROOF IS NEVER A BOOLEAN (root verbatim: 不能bool true):
        if (typeof answer !== 'object' || answer === null) {
          throw breakpoint('pa-consume-proof-invalid', 'the raw plane-edge answer OBJECT ({kind:"allow", consumedProof:{grant:{grantId}}})', `answered ${typeof answer} (${String(answer)})`, 'tools/execute body boundary')
        }
        if (answer.cancelled === true) {
          throw breakpoint('pa-cancelled', 'no cancellation before the body (the grant stays unspent and is never replayed)', `cancelled at the ${answer.stage === 'edge' ? 'execution edge' : 'PA open'} stage`, 'tools/execute body boundary')
        }
        if (answer.kind !== 'allow') {
          throw breakpoint('pa-edge-refused', 'the execution edge to answer kind:"allow"', `kind ${String(answer.kind)} code ${String(answer.code ?? 'n/a')}`, 'tools/execute body boundary')
        }
        const proof = answer.consumedProof
        if (!isRecord(proof) || !isRecord(proof.grant) || typeof proof.grant.grantId !== 'string') {
          throw breakpoint('pa-consume-proof-missing', 'an allow answered WITH its one-shot consume witness (consumedProof.grant.grantId) — never a self-attested consumption', 'allow without the witness', 'tools/execute body boundary')
        }
        // POST-AWAIT recheck (old adapter body-entry bounds, carried): the
        // consumed grant is ledger truth, NEVER rolled back; the body is
        // entered ZERO times on dispose or a post-consume abort.
        if (disposed) {
          throw breakpoint('disposed-during-consume', 'the pair to still stand after the consume', 'the bind closed during the PA await (consumption stays settled, body never entered)', 'tools/execute post-consume')
        }
        if (exec.signal?.aborted === true) {
          throw breakpoint('cancelled-before-body', 'no abort between the consume and the body (the consumption is settled fact and is never rolled back)', 'signal aborted after the edge', 'tools/execute post-consume')
        }
        verifyLive(agent, exec.name, bindMethods)
        // (3) EXACTLY ONE next(): the downstream around chain (their awaits)
        // runs INSIDE this await, then the true native body; the boundary
        // continues after it (addendum B).
        const result = await next()
        if (disposed) {
          throw breakpoint('disposed-around-chain', 'the pair to stand for the whole downstream around chain', 'the bind closed while downstream hooks/body ran — the settled result is NOT accepted', 'tools/execute around-chain')
        }
        const liveAfter = deps.scheduleServiceFeed?.()
        if (liveAfter !== bindMethods.service || liveAfter?.list !== bindMethods.list) {
          throw breakpoint('service-identity-drift-post-body', 'the bound live face to stand through the whole chain', 'the service changed while downstream ran — the result is not accepted', 'tools/execute around-chain')
        }
        return result
      }))
      // post-execute: ACCEPT (observe only) — the owning registry normalizes
      // through its output contract (:1864-1884); replacing is out of scope.
      disposers.push(events.on('tools/post-execute', (exec, result, next) => {
        if (isOurs(exec)) note('governed-result', { name: exec.name, isError: result?.isError === true })
        return next()
      }))
      // guard: monotonic agent-scoped DENY-lane only (defense-in-depth: the
      // guard alone never permits, and denies when the plane edge is absent).
      disposers.push(registerGuard((exec) => (isOurs(exec) && typeof deps.consumePaAtBody !== 'function')
        ? 'a5m2-schedule: no plane-edge consume supply is wired — governed deny (never silent allow)'
        : undefined))
    } catch (error) {
      // Pair-closing: the gate's writes die with the failed bind (law A).
      while (disposers.length > 0) { try { disposers.pop()() } catch { /* idempotent */ } }
      try { deps.onBindClose?.({ reason: 'bind-registration-fault', error }) } catch { /* the refuse lane still answers */ }
      gateOpenedBy = null
      throw breakpoint('bind-registration-fault', 'the governed face registration to succeed after the gate', `threw ${String(error?.message ?? error).slice(0, 160)}`, 'pair-closed')
    }
    bound = true
    note('bound-after-def', { defs: [...originalDefs.keys()], serviceCaptured: true, gate: 'ok' })
  }

  /** Published-def SAFE POINT (law 5): the created announce is an EVENT, not
   *  a settled proof that the upstream Schedule listener registered the pair.
   *  Bounded re-read until the ORIGINAL defs are publicly visible; the
   *  fast path (defs already present) binds synchronously with zero waits. */
  async function bindAfterDefSafePoint(agent) {
    const attempts = Math.max(1, deps.defSettleAttempts ?? 40)
    const tickMs = Math.max(1, deps.defSettleTickMs ?? 25)
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      if (disposed || bound) return
      originalDefs.clear()
      let missing = false
      try {
        captureOriginalDefs(agent)
      } catch (error) {
        if (error?.breakpoint?.kind !== 'def-absent-post-created') throw error
        missing = true
      }
      if (!missing) {
        await bindExecutions(agent)
        return
      }
      await wait(tickMs)
    }
    throw breakpoint('def-never-appeared', `the ORIGINAL pair to become publicly visible within ${String(attempts)}×${String(tickMs)}ms (the published-def safe point)`, 'no def at the end of the bounded window', SCHEDULE_AFTER_DEF_BIND_POINTS.upstreamDefFirstAppears)
  }

  /** Start: NO capture at setup; the first read happens only post-created. */
  function start(runtimeAgent) {
    if (typeof runtimeAgent !== 'object' || runtimeAgent === null) {
      throw breakpoint('agent-unreadable', 'the exact member Agent object', String(runtimeAgent), 'bind target')
    }
    disposers.push(deps.subscribeAgentCreated(({ agent }) => {
      if (agent !== runtimeAgent || bound || disposed) return
      const run = bindAfterDefSafePoint(agent).catch((error) => {
        note('bind-refused', { detail: String(error?.message ?? error).slice(0, 220), breakpoint: error?.breakpoint ?? null })
        // In production the wiring owns the fail-closed DENY lane (typed,
        // zero-effect); re-throwing inside the host's awaited created announce
        // would fault the member's turn for a governance-only refusal.
        if (deps.onBindRefused) deps.onBindRefused(error)
        else throw error
      })
      // The created announce is AWAITED and serial (S1 timing law): the
      // bounded safe-point wait rides that await, never a detached race.
      return run
    }))
    note('awaiting-def', { law: 'no setup-time fetch; bind only at the published-def safe point' })
  }

  function closePair(reason) {
    while (disposers.length > 0) { try { disposers.pop()() } catch { /* idempotent teardown */ } }
    if (gateOpenedBy !== null) {
      try { deps.onBindClose?.({ reason }) } catch { /* teardown keeps closing */ }
      gateOpenedBy = null
    }
    originalDefs.clear()
    bound = false
  }

  function dispose() {
    disposed = true
    closePair('dispose')
  }

  return Object.freeze({ start, dispose, isBound: () => bound, bindPoints: SCHEDULE_AFTER_DEF_BIND_POINTS })
}
