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
// CONTINUATION CARD ② (root 2026-10-26, fork route ruled): the create/update
// GOVERNED ARMS ride the SAME list/delete law (same-Agent native hook, PA
// final consume, per-name capture). They arm ONLY when the wiring supplies
// the trigger-governance gate (deps.triggerGate); while the ruled fork is
// not the mounted provider the gate refuses dispatch (必交不删, 缺口未闭不可
// 启用) BEFORE any PA consume — no grant is spent on a refusal.
const TRIGGER_ARMS = Object.freeze(['schedule_create', 'schedule_update'])

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
  let bindStarted = false
  let establishAttempted = false
  // ROOT b6 handover window: the provisional deny lives OUTSIDE `disposers`
  // on purpose — a pair-close (law A) unwinds FACES but must never lift the
  // shield over a half-mounted pair; it releases on full success, else ONLY
  // at dispose (the pair stays refused until the mount itself is gone).
  let provisionalLift = null
  let disposed = false
  let gateOpenedBy = null // the gate's {ok:true} proof while the pair is closing (audit line)
  const note = (event, extra) => deps.observe?.({ event, ...(extra ?? {}) })
  const wait = deps.wait ?? ((ms) => new Promise((resolve) => { globalThis.setTimeout(resolve, ms) }))

  // list/delete ALWAYS (frozen, no regression); create/update join when the
  // trigger-governance gate is wired (the ② arms).
  function armNames() {
    return deps.triggerGate === undefined || deps.triggerGate === null ? [...PAIR] : [...PAIR, ...TRIGGER_ARMS]
  }

  function captureOriginalDefs(agent) {
    for (const name of armNames()) {
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
    for (const name of armNames()) {
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
    // bindMethods.executes: name -> the execute reference SAVED at bind time.
    const current = deps.readToolDefinition(name, agent)
    const def = originalDefs.get(name)
    if (current !== def) {
      throw breakpoint('native-definition-drift', 'the CURRENT native def to still BE the bound original object', 'a different def object answered', `per-dispatch:${name}`)
    }
    if (current.execute !== bindMethods.executes.get(name)) {
      throw breakpoint('native-execute-drift', `the def's execute to still be the bound reference (captured at bind time)`, 'the def object now carries a DIFFERENT execute', `per-dispatch:${name}`)
    }
    if (bindMethods.generationId !== null) {
      // THE PUBLIC PROVIDER LIFECYCLE LAW (user-approved; the G6-PROVEN
      // 0655a9f4c shape): on Cordis 639 EVERY ctx.get answers a fresh
      // tracker proxy (and every method getter a fresh method proxy), so
      // OBJECT identity across reads is not a fact this world ever carries
      // — the stable public fact is the provider GENERATION: the inject
      // callback firing is the boundary (id++), the facade is child.get
      // bound ONCE, and the answer stands only while the fiber is ACTIVE
      // (fiber.d.ts:67-70). Non-ACTIVE or a replacement generation
      // INVALIDATES the bound capture — that is the drift here; a plain
      // re-proxy read is NOT. Same-generation in-place method swaps are
      // NOT promised to be observed (the i6 law G6 measured): the bound
      // facade keeps serving; nothing here unwraps the proxy privately and
      // nothing caches an old object past its generation.
      const genNow = deps.serviceGeneration === undefined ? null : deps.serviceGeneration()
      if (!isRecord(genNow) || typeof genNow.id !== 'number') {
        throw breakpoint('service-lifecycle-unobservable', 'the PUBLIC provider lifecycle to still be observable (inject fiber ACTIVE)', 'currentGeneration answered null — teardown/replacement without an observable boundary (never allow-by-default)', 'G6-0655 lifecycle law')
      }
      if (genNow.id !== bindMethods.generationId) {
        throw breakpoint('service-generation-drift', `the bound provider generation #${String(bindMethods.generationId)} to still be CURRENT`, `the lifecycle answered generation #${String(genNow.id)} — the old capture is INVALID, never carried into a new provider`, 'G6-0655 lifecycle law')
      }
      if (genNow.service !== bindMethods.service) {
        throw breakpoint('service-generation-drift', 'the generation facade to be exactly the child.get-bound object captured ONCE in its generation', 'the same generation answered a different facade — a broken lifecycle supply', 'G6-0655 lifecycle law')
      }
      return
    }
    // The feed is re-asked HERE (root ② law: a bind-time constant compared
    // against itself proves nothing) — the CURRENT live object is the answer.
    // Identity law applies to the NON-proxy world only; on Cordis 639 the
    // wiring always supplies serviceGeneration and the block above is the law.
    const live = deps.scheduleServiceFeed?.()
    if (live !== bindMethods.service) {
      throw breakpoint('service-identity-drift', 'the SAME live service object as at bind time', 'a different object underneath', 'per-dispatch service')
    }
    if (live.list !== bindMethods.list || live.delete !== bindMethods.delete) {
      throw breakpoint('service-method-drift', 'the bound list/delete METHOD identities', 'the service methods changed under the same object', 'per-dispatch methods')
    }
    if (bindMethods.armed && (live.create !== bindMethods.create || live.update !== bindMethods.update)) {
      throw breakpoint('service-method-drift', 'the bound create/update METHOD identities (the ② arms)', 'the service methods changed under the same object', 'per-dispatch methods')
    }
  }

  async function bindExecutions(agent) {
    // The lifecycle face is ASKED AT THE BOUND (never assumed): a supplied
    // face that cannot answer is a refusal, not a silent fallback to raw
    // reads; no face at all = the non-proxy world keeps the identity law.
    const genAtBind = deps.serviceGeneration === undefined ? undefined : await Promise.resolve(deps.serviceGeneration())
    if (deps.serviceGeneration !== undefined && (!isRecord(genAtBind) || typeof genAtBind.id !== 'number' || !isRecord(genAtBind.service))) {
      throw breakpoint('service-lifecycle-unobservable', 'the PUBLIC provider lifecycle to answer {id, service} at the bind (inject fiber ACTIVE)', 'the wiring supplied the face and it did not answer — fail closed, no raw-feed fallback on the proxy world', 'G6-0655 lifecycle law')
    }
    const serviceAtBind = genAtBind !== undefined ? genAtBind.service : deps.scheduleServiceFeed?.()
    const armed = deps.triggerGate !== undefined && deps.triggerGate !== null
    if (!isRecord(serviceAtBind)
      || typeof serviceAtBind.list !== 'function' || typeof serviceAtBind.delete !== 'function'
      || (armed && (typeof serviceAtBind.create !== 'function' || typeof serviceAtBind.update !== 'function'))) {
      throw breakpoint('service-shape', armed ? 'full ScheduleService-shaped live handle (list/delete + create/update arms)' : 'full ScheduleService-shaped live handle (list/delete)', String(serviceAtBind), 'execute/live service identity')
    }
    const bindMethods = Object.freeze({ service: serviceAtBind, list: serviceAtBind.list, delete: serviceAtBind.delete, create: armed ? serviceAtBind.create : undefined, update: armed ? serviceAtBind.update : undefined, armed, executes: new Map(), generationId: genAtBind?.id ?? null })
    // The bind-time EXECUTE references (root residual 4): current.execute
    // compared against def.execute on the SAME object is a tautology; the
    // comparison runs against these SAVED references instead.
    for (const [name, def] of originalDefs.entries()) bindMethods.executes.set(name, def.execute)
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
    // ROOT b4 addendum: the gate AWAIT is a real await — if the pair was
    // disposed while it ran, the keys the gate just wrote must NOT stand
    // unowned: close them through the SAME pair-close path, refuse, open no
    // faces.
    if (disposed) {
      try {
        deps.onBindClose?.({ reason: 'disposed-during-gate' })
      } catch { /* the close is the obligation; a faulting closer cannot strand faces that never opened */ }
      throw breakpoint('disposed-during-gate', 'the pair to still stand after the canonical gate await', 'the bind was disposed during the gate await — the keys the gate wrote were closed, no faces opened', 'onBinded gate / law A')
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
        // THE ONE-FLIGHT TOKEN (root residual 3): open→edge does NOT arm the
        // plane's governedTokenLedger itself (the ROWS do that around it) —
        // so the flight reuses the SAME ledger through the plane's narrow
        // paTokenLedger face: take BEFORE any PA entry, settle in the finally
        // that wraps the WHOLE governed flight (PA + next). A replayed token
        // refuses with zero PA entry; no new ledger exists anywhere here.
        const ownsFlight = deps.takePaToken
          ? await Promise.resolve(deps.takePaToken(exec)) === true
          : true
        if (!ownsFlight) {
          throw breakpoint('pa-token-replay', 'this execution token to own its FIRST and ONLY governed flight (the plane ledger answers it)', 'the token already owns a flight (in-flight or settled — never re-armed)', 'governedTokenLedger law')
        }
        try {
          verifyLive(agent, exec.name, bindMethods)
          // ② TRIGGER-ARM GATE (before ANY PA consume — a refused arm spends
          // no grant): while the ruled fork is not the mounted governed
          // provider the gate answers TRIGGER_GOVERNANCE_OPEN and the native
          // create/update body is entered ZERO times (必交不删 / 不可启用).
          if (bindMethods.armed && TRIGGER_ARMS.includes(exec.name)) {
            const t = await Promise.resolve(deps.triggerGate.evaluateDispatch(exec.name))
            if (t?.enabled !== true) {
              throw breakpoint('trigger-governance-open', 'the trigger-governance gate to answer enabled (the ruled fork mounted with its admission consumer)', `refused ${String(t?.code ?? 'n/a')}: ${String(t?.detail ?? '').slice(0, 180)}`, 'schedule trigger law (root 2026-10-26)')
            }
          }
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
          // (3) EXACTLY ONE next(). THE TRUE-BOUNDARY ORDERING LAW (root
          // residual 5, measured): cordis composes waterfall listeners
          // OUTERMOST-FIRST in subscription order (vendor/cordis/src/events.ts
          // :229-243 `cbs.shift()` chain; later listener = MORE INNER), and
          // this module registers at the EARLIEST moment the real ACTIVE tuple
          // exists (the bind-moment), so every already-registered downstream
          // hook has already run its pre-await before the checks above — the
          // verification above IS the last moment before the true native for
          // that chain. Under this stable, verified hook composition the
          // boundary IS the pre-next verification — NO promise is made about
          // arbitrary future inner hooks: anything subscribing after the bind
          // runs INSIDE, and the facts below OBSERVE that honestly at result
          // settlement. The flight's finally settles the token either way.
          const result = await next()
          if (disposed) note('post-boundary-pair-closed', { name: exec.name, detail: 'the pair closed while the inner chain ran; the body already ran — the settled result passes through and the fact is OBSERVED' })
          const liveAfter = deps.scheduleServiceFeed?.()
          const driftGen = bindMethods.generationId !== null
            ? (() => { const g = deps.serviceGeneration === undefined ? null : deps.serviceGeneration(); return !isRecord(g) || g.id !== bindMethods.generationId || g.service !== bindMethods.service })()
            : (liveAfter !== bindMethods.service || liveAfter?.list !== bindMethods.list)
          if (driftGen) note('post-boundary-service-drift', { name: exec.name, detail: 'the live service face moved during the inner chain; OBSERVED, the settled result is not retroactively refused' })
          return result
        } finally {
          // ONE settle for the WHOLE governed flight (take→PA→next→finally),
          // also on every refusal path after the take: a refused flight's
          // token is closed, never left armed, never re-armed.
          try { deps.settlePaToken?.(exec) } catch { /* the ledger close is best-effort; the plane ledger entry stays settled-safe */ }
        }
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
    // The hook set is LIVE synchronously above; only now does the provisional
    // shield stand down — deny hands over to governance with no gap.
    if (provisionalLift !== null) {
      const lift = provisionalLift
      provisionalLift = null
      lift()
    }
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
      try {
        captureOriginalDefs(agent)
      } catch (error) {
        if (error?.breakpoint?.kind !== 'def-absent-post-created') throw error
        await wait(tickMs)
        continue
      }
      // ROOT b4 终裁: def visible is NEVER a tuple. The assembly establishes
      // the tuple ONCE, explicitly, through its ORIGINAL dispatcher bind /
      // verification (bindOwnTools — the documented pin-live-definition
      // flow, an establishment, never a claim of Team physical
      // registration), and the tuple check right after is IMMEDIATE — the
      // poll stays only for def visibility and is never stretched here.
      if (!establishAttempted) {
        establishAttempted = true
        const entries = [...originalDefs.entries()].map(([name, definition]) => ({ name, definition }))
        // THE HANDOVER WINDOW (root b6 终裁): bindOwnTools turns BOTH names
        // ACTIVE SYNCHRONOUSLY — the generic unbound refusal is gone from
        // that moment — while the governed hooks exist only after the AWAITED
        // canonical gate and registration. So BEFORE establishing ACTIVE, a
        // PROVISIONAL deny mounts over the EXISTING public guard seam
        // (agent.ctx.tools.guard — the same face the deny lane registers
        // through; no Guard-body change, no new mechanism): sameAgent, exactly
        // the pair names, deny-only. It lifts only on the full hook success
        // below; every failure keeps it refused until dispose.
        const registerProvisional = deps.registerGuardFor ? deps.registerGuardFor(agent) : deps.registerGuard
        if (typeof registerProvisional !== 'function') {
          throw breakpoint('provisional-deny-unavailable', 'the public guard seam (ctx.tools.guard) to answer BEFORE the pair is made ACTIVE — no governed hook exists yet and the unbound refusal ends at bind', 'no guard registration face supplied', 'b6 handover window')
        }
        const provisionalNames = new Set(entries.map((entry) => entry.name))
        const lift = registerProvisional((exec) => (exec?.agent === agent && provisionalNames.has(exec?.name))
          ? 'a5m2-schedule: governed bind in flight — the Tool Binding is ACTIVE while the governed hooks complete their awaited setup; refused for the whole handover window (provisional handover deny; released on success, kept until dispose on failure)'
          : undefined)
        if (typeof lift !== 'function') {
          throw breakpoint('provisional-deny-unavailable', 'the provisional guard registration to answer with its disposer', `answered ${typeof lift}`, 'b6 handover window')
        }
        provisionalLift = lift
        const answer = await Promise.resolve(deps.establishNative
          ? deps.establishNative(entries)
          : { ok: true })
        if (!isRecord(answer) || answer.ok !== true) {
          throw breakpoint('native-bind-refused', 'the assembly to ESTABLISH the tuple for the ORIGINAL pair through the ORIGINAL dispatcher bind/verification (bindOwnTools pin-law) before any hook opens', answer === null || answer === undefined ? String(answer) : String(answer.detail ?? 'establishment refused'), 'install.ts bindAll:1067-1170 / scoped-dispatcher bind:619-628')
        }
        for (const { name, definition } of entries) {
          if (deps.nativeReady?.(name, definition) !== true) {
            throw breakpoint('native-tuple-not-active', 'the just-established REAL Guard-surface entry to answer ACTIVE for exactly the bound def identity (the same fields pa-mount-registry reads)', `entry did not answer for ${name}`, 'pa-mount-registry.mjs bindingFamilyOf/entryOf law')
          }
        }
        await bindExecutions(agent)
        return
      }
      await wait(tickMs)
    }
    throw breakpoint('def-never-appeared', `the ORIGINAL pair to become publicly visible within ${String(attempts)}×${String(tickMs)}ms (the published-def safe point; establishment runs only once the defs exist)`, 'no def at the end of the bounded window', SCHEDULE_AFTER_DEF_BIND_POINTS.upstreamDefFirstAppears)
  }

  /** Start: NO capture at setup; the first read happens only post-created. */
  function start(runtimeAgent) {
    if (typeof runtimeAgent !== 'object' || runtimeAgent === null) {
      throw breakpoint('agent-unreadable', 'the exact member Agent object', String(runtimeAgent), 'bind target')
    }
    disposers.push(deps.subscribeAgentCreated(({ agent }) => {
      if (agent !== runtimeAgent || bound || disposed || bindStarted) return
      bindStarted = true
      // THE SERIAL-QUEUE LAW (root residual 1, Host core/agent/src/index.ts:
      // 549-554 `await ctx.serial(carrier,'agent/created',…)` + cordis serial
      // awaits EACH listener in order): awaiting a poll HERE would block the
      // registrar queued behind us — the def could then never appear. The
      // handler therefore returns SYNCHRONOUSLY and the bounded safe point
      // runs DETACHED: later registrars run, the pair stays CLOSED until the
      // real ACTIVE tuple answers, and a final refusal arms the deny lane.
      void bindAfterDefSafePoint(agent).catch((error) => {
        note('bind-refused', { detail: String(error?.message ?? error).slice(0, 220), breakpoint: error?.breakpoint ?? null })
        // In production the wiring owns the fail-closed DENY lane (typed,
        // zero-effect); re-throwing inside the host's awaited created announce
        // would fault the member's turn for a governance-only refusal.
        if (deps.onBindRefused) deps.onBindRefused(error)
        else throw error
      })
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
    // "failure keeps deny until dispose": the mount is gone, the shield goes
    // with it (teardown-unmounts-native is the shared sibling semantics).
    if (provisionalLift !== null) {
      const lift = provisionalLift
      provisionalLift = null
      try { lift() } catch { /* idempotent teardown */ }
    }
  }

  return Object.freeze({ start, dispose, isBound: () => bound, bindPoints: SCHEDULE_AFTER_DEF_BIND_POINTS })
}
