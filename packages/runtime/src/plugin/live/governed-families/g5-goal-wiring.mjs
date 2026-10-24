/**
 * A5M2 G5 B-SESSION (records 27/28/29) — PRODUCTION WIRING BRIDGE.
 *
 * This module is the BRIDGE between the committed G5 goal-service adapter
 * (`governed-families/g5-goal-service.mjs`, rows g5 rev.1 — imported VERBATIM,
 * no row law restated, no gate added here) and the production team-tool
 * plane's ONE PA admission seat. It follows the audited G6 bridge law
 * (`g6-session-query-wiring.mjs`) and the B-TEAM registration-pairing law
 * (root ⑤, `team-wiring.mjs`):
 *
 *  1. CLOSED input surface: a known key set, nothing else enters; a defective
 *     inject is answered `{ ok: false, code }` (the PLANE turns that into its
 *     own typed mount refusal) — never a partial mount, never a guess.
 *  2. ONE CAPTURE per native name: the member-scoped capture seam is read AT
 *     MOST once per tool name; the SAME object serves the adapter's row
 *     capture and the placed definition's spread. An uncaptured native is
 *     the adapter's own honest INACTIVE census — NO def, NO registration,
 *     native untouched.
 *  3. THE REAL PA SEAT: `pa` is the plane's published `paAdmit` face — a
 *     CALLABLE carrying `open` / `edge` / `closePlan` (team-tool-plane law)
 *     or an equivalent plain methods object. Nothing else poses as the seat.
 *  4. THE FULL WALK per call, in the row body: the row's OWN classify (arm,
 *     pure) → the four P-adds at FULL VALUE → `pa.open` → the landed grant →
 *     `pa.edge` → the ONE-SHOT consumedProof DEMAND → the row's OWN
 *     `runPlan` on the approved plan (which itself re-classifies, re-verifies
 *     capture/port identity, and enforces plan-once — the row's law, run
 *     through this bridge unchanged) → the row's canonical goalValue served
 *     VERBATIM. Refusal at any leg before runPlan is ZERO PORT ENTRY.
 *     `pa.closePlan` rides the walk's own finally.
 *  5. THE REGISTRATION PAIRING (root ⑤): when the mount publishes a
 *     `registrationOf`, the version it carries must match the claim this
 *     seat composes (adapterRevision + providerIdentity) — checked BEFORE
 *     the PA question opens and AGAIN after the grant landed. A mismatch
 *     refuses with the seat's own existing codes; no new refusal vocabulary.
 *  6. EFFECTS (design §4.2, the B-TEAM bridge law): the walk carries exactly
 *     the census effect `tool-invoke` over the mounted tool name. The row
 *     itself mints no second effect vocabulary and this bridge adds none.
 *  7. POST-PUBLISH REGISTRATION keyed by the placement feed's RUNTIME
 *     identity: `familyRegistrations()` reads placementFeed(name) FRESH and
 *     THROWS (PLACEMENT_KEY_ABSENT / PLACEMENT_KEY_MOVED) rather than guess
 *     or skip. This module registers NOTHING itself.
 *  8. DRAIN is the adapter's own law (new-call prohibition only; settles
 *     nothing, rolls nothing back) — the plane's dispose rides it.
 *
 * NAMED GAPS (carried VERBATIM from the adapter, never worded closed —
 * 实缺口, not fake-closed):
 *  1. AUTHORITY ADJUDICATION — requireDirectHuman / completionAuthority
 *     (tool-goal/src/authority.ts:80-118) ride as the row's UNOBSERVED
 *     executionAuthority fact unless the mount injects `readExecutionFacts`.
 *     This bridge NEVER turns an unobserved authority into a pass; the
 *     unobserved fact travels in the durable targetManifest as-is.
 *  2. GOAL-ROUND WRAP-UP — the terminal update actions' `exec.deferContext`
 *     wrap-up context (exec face + wrapup.ts:17-41) is not mountable through
 *     the GoalService port; the row discloses it and this bridge fabricates
 *     nothing in its place.
 *  3. CALLING-AGENT AUTHENTICATION — goalToolExecution + GoalService.
 *     assertLive stay native/port-side; the row hands the Agent object by
 *     reference and mirrors only the observable presence law.
 *  4. THE SIGNED B-SESSION RULES TABLE — the production PA bridge validates
 *     a family's typed plan against the REGISTERED signed structure for
 *     'B-SESSION' (pa-control-bridge law). That table is the rules lane's
 *     closed map and does NOT yet carry the three goal-tool variants; until
 *     the rules lane extends it, production paAdmit refuses these plans at
 *     the family-target check. That refusal is the EXPECTED production
 *     behavior of this wiring today and is disclosed, never bypassed: the
 *     walk, the seat and the census below are real; the table entry is the
 *     named gap the rules lane owns. No Host enablement, no C2 claim.
 *
 * STATUS: wiring bridge; NOT C2 — no Host, no ports beyond the injected
 * live GoalService face, no tests/homes, no network. The adapter spec
 * (a5m2-g5-goal-service-c1.test.ts) owns the row laws; THIS lane's spec
 * (a5m2-g5-goal-wiring.test.ts) owns the assembly facts: adapter reuse
 * verbatim, walk composition and witness law, feed-keyed registration,
 * the pairing law at both points, and the named gaps pinned at their
 * carried bytes.
 *
 * @module @dsh-agent-team/runtime/plugin/live/governed-families/g5-goal-wiring
 */
import { parseRequestedEffectSet } from '../../../../../domain/tool-governance/src/index.js'
import {
  A5_G5_ADAPTER_REVISION,
  A5_G5_FAMILY_ID,
  A5_G5_GOAL_TOOL_NAMES,
  createG5GoalServiceAdapter,
} from './g5-goal-service.mjs'

export const A5_G5_GOAL_WIRING_REVISION = 1

/** Typed codes OWNED by this wiring layer (P_G5_WIRE_*). Adapter refusals
 *  keep the row's own A5_G5_* codes verbatim — never rewritten here. */
export const A5_G5_GOAL_WIRING_CODES = Object.freeze({
  INPUT_INVALID: 'P_G5_WIRE_INPUT_INVALID',
  CALL_ID_ABSENT: 'P_G5_WIRE_CALL_ID_ABSENT',
  EFFECTS_UNPARSABLE: 'P_G5_WIRE_EFFECTS_UNPARSABLE',
  ADMISSION_CANCELLED: 'P_G5_WIRE_ADMISSION_CANCELLED',
  APPROVAL_NOT_LANDED: 'P_G5_WIRE_APPROVAL_NOT_LANDED',
  EDGE_CANCELLED: 'P_G5_WIRE_EDGE_CANCELLED',
  CONSUME_PROOF_MISSING: 'P_G5_WIRE_CONSUME_PROOF_MISSING',
  PLAN_INTEGRITY: 'P_G5_WIRE_PLAN_INTEGRITY',
  PLACEMENT_KEY_ABSENT: 'P_G5_WIRE_PLACEMENT_KEY_ABSENT',
  PLACEMENT_KEY_MOVED: 'P_G5_WIRE_PLACEMENT_KEY_MOVED',
})

const deepFreeze = (value) => {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value)
    for (const child of Object.values(value)) deepFreeze(child)
  }
  return value
}

const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)

/** Carry a typed refusal (row's own or this layer's) as a throw, keeping the
 *  code and detail VERBATIM on the error object (the plane's refusal-carry
 *  idiom — `refused-* CODE — detail`). */
const refusalToThrow = (refusal) => {
  const error = new Error(`${String(refusal?.code ?? 'REFUSED')} — ${String(refusal?.detail ?? 'refused without detail')}`)
  error.code = String(refusal?.code ?? 'REFUSED')
  return error
}

const wiringRefuse = (code, detail) => deepFreeze({ ok: false, code, detail })

/** The REAL registration minimum-entry gate (mirrored SHAPE check only —
 *  schema SEMANTICS stay owned by the host's own validator): a definition is
 *  emittable only if the captured native face carries the mandatory `output`
 *  face with function render (and function presentationMeta when present),
 *  a function execute, and a positive finite timeoutMs when present. A
 *  half-capture is never emitted for the real host entry to reject; the row
 *  stays an honest DECLARED-INACTIVE census entry. */
const registrationFaceComplete = (native) => {
  const output = isRecord(native) ? native.output : undefined
  return isRecord(native)
    && typeof native.name === 'string' && native.name.length > 0
    && typeof native.description === 'string'
    && isRecord(native.parameters)
    && typeof native.execute === 'function'
    && isRecord(output) && output.schema !== undefined
    && typeof output.render === 'function'
    && (output.presentationMeta === undefined || typeof output.presentationMeta === 'function')
    && (native.timeoutMs === undefined || (Number.isFinite(native.timeoutMs) && native.timeoutMs > 0))
}

/**
 * Assemble the G5 goal wiring over the REAL adapter factory.
 *
 * @param input {{
 *   realmId: string, providerId: string,
 *   readNative: (name: string) => object | undefined | null, // production: name => ctx.tools.get(name, scope)
 *   goals: object,                    // the LIVE ctx.goals GoalService face — the adapter's own port law decides per-record INACTIVE
 *   blockedAfterConsecutiveRounds?: number,                   // host Config fact (tool-goal default 3)
 *   readExecutionFacts?: () => { kind: 'direct-human' } | { kind: 'goal-round' },     // authority seam; ABSENT = UNOBSERVED, never a pass
 *   registrationOf?: () => { adapterRevision: number, providerIdentity: string },     // the version the PUBLISHED family registration carries (root ⑤)
 *   correlationOf?: (exec: object, toolName: string) => string | null,                // issued call identity (plane mount law)
 *   placementFeed: (name: string) => { definitionIdentity?: string, realmId?: string } | undefined,
 *   pa: paAdmit-shaped seat — CALLABLE with { open, edge, closePlan } methods (production) or a plain methods object,
 *   observe?: (event: object) => void,
 * }}
 * @returns wiring assembly `{ ok: true, ... }` or a frozen `{ ok: false, code, detail }` refusal.
 */
export function buildG5GoalWiring (input = {}) {
  if (!isRecord(input)) return wiringRefuse(A5_G5_GOAL_WIRING_CODES.INPUT_INVALID, 'wiring input must be one object')
  const knownInput = new Set(['realmId', 'providerId', 'readNative', 'goals', 'blockedAfterConsecutiveRounds', 'readExecutionFacts', 'registrationOf', 'correlationOf', 'placementFeed', 'pa', 'observe'])
  for (const key of Object.keys(input)) {
    if (!knownInput.has(key)) {
      return wiringRefuse(A5_G5_GOAL_WIRING_CODES.INPUT_INVALID, `unknown wiring input '${key}' — the bridge takes exactly {realmId, providerId, readNative, goals, blockedAfterConsecutiveRounds, readExecutionFacts, registrationOf, correlationOf, placementFeed, pa, observe}`)
    }
  }
  const { realmId, providerId, readNative, goals, placementFeed, pa, observe = () => {} } = input
  if (typeof realmId !== 'string' || realmId.length === 0) return wiringRefuse(A5_G5_GOAL_WIRING_CODES.INPUT_INVALID, 'realmId is required (non-empty string)')
  if (typeof providerId !== 'string' || providerId.length === 0) return wiringRefuse(A5_G5_GOAL_WIRING_CODES.INPUT_INVALID, 'providerId is required (non-empty string)')
  if (typeof readNative !== 'function') return wiringRefuse(A5_G5_GOAL_WIRING_CODES.INPUT_INVALID, 'readNative (name) => definition | undefined is REQUIRED — the same bind-time capture seam the adapter itself reads')
  if (!isRecord(goals)) {
    // The port is the LIVE ctx.goals service. A missing/foreign port object
    // fails the mount closed HERE; a service MISSING an individual method is
    // the ADAPTER's richer per-record INACTIVE census, decided record by
    // record below — never a partial substitution made here.
    return wiringRefuse(A5_G5_GOAL_WIRING_CODES.INPUT_INVALID, 'goals is REQUIRED and must be the LIVE ctx.goals GoalService object — the port law (A5_G5_GOAL_SERVICE_METHODS) decides each record; an invented stand-in is forbidden')
  }
  if (input.blockedAfterConsecutiveRounds !== undefined
    && !(Number.isSafeInteger(input.blockedAfterConsecutiveRounds) && input.blockedAfterConsecutiveRounds > 0)) {
    return wiringRefuse(A5_G5_GOAL_WIRING_CODES.INPUT_INVALID, 'blockedAfterConsecutiveRounds, when supplied, must be a positive safe integer (the tool-goal Config fact, default 3)')
  }
  if (input.readExecutionFacts !== undefined && typeof input.readExecutionFacts !== 'function') {
    return wiringRefuse(A5_G5_GOAL_WIRING_CODES.INPUT_INVALID, 'readExecutionFacts, when supplied, must be () => execution facts — the authority plane seam; without it the authority fact rides UNOBSERVED, which is never a pass')
  }
  if (input.registrationOf !== undefined && typeof input.registrationOf !== 'function') {
    return wiringRefuse(A5_G5_GOAL_WIRING_CODES.INPUT_INVALID, 'registrationOf, when supplied, must be () => { adapterRevision, providerIdentity } — the version the PUBLISHED family registration carries (root ⑤ pairing); this bridge compares it against every claim it composes and again at the edge')
  }
  if (typeof placementFeed !== 'function') {
    return wiringRefuse(A5_G5_GOAL_WIRING_CODES.INPUT_INVALID, 'placementFeed (name) => {definitionIdentity, realmId} | undefined is REQUIRED — the family key is the runtime identity the seam minted for the PLACED definition (pb §6), never a hand-spelled string')
  }
  const paSeatOk = (pa !== null && (typeof pa === 'object' || typeof pa === 'function')
    && typeof pa.open === 'function' && typeof pa.edge === 'function' && typeof pa.closePlan === 'function')
  if (!paSeatOk) {
    return wiringRefuse(A5_G5_GOAL_WIRING_CODES.INPUT_INVALID, 'pa is REQUIRED in its published shape — the plane\'s paAdmit face (a CALLABLE with open / edge / closePlan methods) or an equivalent plain {open, edge, closePlan} methods object; with no admission seat no governed call may enter the port')
  }
  const correlationOf = input.correlationOf === undefined
    ? (exec) => (isRecord(exec) && typeof exec.callId === 'string' && exec.callId.length > 0 ? exec.callId : null)
    : typeof input.correlationOf === 'function' ? input.correlationOf : null
  if (correlationOf === null) {
    return wiringRefuse(A5_G5_GOAL_WIRING_CODES.INPUT_INVALID, 'correlationOf, when supplied, must be (exec, toolName) => string | null — the ISSUED call identity seam (the plane\'s mount law); a non-function never substitutes')
  }

  // ONE CAPTURE (the G6 law): the seam is read AT MOST once per tool name;
  // the SAME object serves the adapter's row capture and the placed
  // definition's spread — reading twice and publishing a second object is
  // structurally impossible on this wiring. The adapter's own capture law
  // and port law decide ACTIVE vs the honest INACTIVE census; a placement
  // defect it throws is carried verbatim (assembly defects THROW).
  const capturedOnce = new Map()
  const readNativeOnce = (name) => {
    if (capturedOnce.has(name)) return capturedOnce.get(name)
    const captured = readNative(name)
    capturedOnce.set(name, captured === null ? undefined : captured)
    return capturedOnce.get(name)
  }
  const adapter = createG5GoalServiceAdapter({
    realmId,
    providerId,
    readNative: readNativeOnce,
    goals,
    ...(input.blockedAfterConsecutiveRounds === undefined ? {} : { blockedAfterConsecutiveRounds: input.blockedAfterConsecutiveRounds }),
    ...(input.readExecutionFacts === undefined ? {} : { readExecutionFacts: input.readExecutionFacts }),
    observe: (event) => { observe({ source: 'g5-adapter', ...event }) },
  })

  const registrationMismatch = (name, where, published) => {
    if (!isRecord(published)) return undefined
    if (published.adapterRevision === A5_G5_ADAPTER_REVISION
      && published.providerIdentity === providerId) return undefined
    return `${name}: the ${where} carries adapterRevision ${JSON.stringify(published.adapterRevision)} / providerIdentity ${JSON.stringify(published.providerIdentity)} while this claim composes under ${String(A5_G5_ADAPTER_REVISION)} / ${JSON.stringify(providerId)} — a claim is never minted, and never forwarded to the lane, on a registration this claim does not match`
  }

  const rows = new Map()
  const declared = []
  const definitions = []
  for (const toolName of A5_G5_GOAL_TOOL_NAMES) {
    const row = adapter[toolName]
    const native = readNativeOnce(toolName)
    if (row.active !== true) {
      // Honest INACTIVE census (the adapter's own row, blocker bytes
      // verbatim): NO definition, NO registration — a def masking the native
      // name with nothing behind it is the plane's own refused class.
      const reason = row.mountState === 'INACTIVE-CAPTURE-ABSENT' ? 'declared-mount-absent' : 'goals-port-incomplete'
      rows.set(toolName, Object.freeze({ status: 'DECLARED-INACTIVE', reason, row }))
      declared.push(Object.freeze({ name: toolName, familyId: A5_G5_FAMILY_ID, status: 'DECLARED-INACTIVE', reason }))
      observe({ event: 'g5-wire:declared', name: toolName, reason })
      continue
    }
    if (row.captured() !== true || !registrationFaceComplete(native)) {
      const reason = row.captured() !== true ? 'capture-absent' : 'registration-face-incomplete'
      rows.set(toolName, Object.freeze({ status: 'DECLARED-INACTIVE', reason, row }))
      declared.push(Object.freeze({ name: toolName, familyId: A5_G5_FAMILY_ID, status: 'DECLARED-INACTIVE', reason }))
      observe({ event: 'g5-wire:declared', name: toolName, reason })
      continue
    }

    const execute = async (args, exec) => {
      // ① the row's OWN classify — typed plan products verbatim (captured
      // parameter law, per-tool dispatch set, targetManifest with the
      // executionAuthority fact at its OBSERVED or UNOBSERVED value, the
      // parametersFingerprint over the full canonical value).
      const classified = await row.classify(args)
      if (classified.ok !== true) {
        observe({ event: 'g5-wire:classify-REFUSED', name: toolName, code: classified.code })
        throw refusalToThrow(classified)
      }
      // BODY BINDING: the APPROVED plan is the row's own deep-frozen
      // actualArgs snapshot + its parametersFingerprint. From this line on,
      // the caller-side args object never re-enters the row: the body runs
      // the APPROVED snapshot or nothing (the row re-classifies the frozen
      // snapshot itself inside runPlan — plan-once and drift law are the
      // row's, run through this bridge unchanged).
      const approvedPlan = classified
      const approvedFingerprint = classified.parametersFingerprint
      const callId = correlationOf(exec, toolName)
      if (typeof callId !== 'string' || callId.length === 0) {
        throw refusalToThrow(wiringRefuse(A5_G5_GOAL_WIRING_CODES.CALL_ID_ABSENT, `${toolName}: the execution answered no ISSUED call identity — the PA walk has no single-flight key; a guessed correlation is forbidden; zero port entry`))
      }
      // EFFECTS (design §4.2, the B-TEAM bridge law): the census effect,
      // over the mounted tool name — nothing else, never caller-shaped.
      const parsedEffects = parseRequestedEffectSet([Object.freeze({ kind: 'tool-invoke', toolName, resource: null })])
      if (parsedEffects.ok !== true) {
        throw refusalToThrow(wiringRefuse(A5_G5_GOAL_WIRING_CODES.EFFECTS_UNPARSABLE, `${toolName}: the minted effect set is not the frozen closed vocabulary (${String(parsedEffects.problems?.[0]?.detail ?? 'parse refused')}); zero port entry`))
      }
      // THE VERSION PAIRING, at the first real point (root ⑤): the
      // registration the mount publishes vs the claim this seat composes.
      const published = typeof input.registrationOf === 'function' ? input.registrationOf() : undefined
      {
        const mismatch = registrationMismatch(toolName, 'published registration', published)
        if (mismatch !== undefined) {
          observe({ event: 'g5-wire:registration-claim-MISMATCH', name: toolName, stage: 'pre-pa', paEntry: false })
          throw refusalToThrow(wiringRefuse(A5_G5_GOAL_WIRING_CODES.ADMISSION_CANCELLED, `${mismatch}; zero port entry`))
        }
      }
      const signal = isRecord(exec) ? exec.signal : undefined
      const walk = Object.freeze({
        realmId,
        callId,
        parametersFingerprint: approvedFingerprint,
        requestedEffects: parsedEffects.value,
        toolName,
        // 载荷法: the four P-adds at FULL VALUE, from the row's own plan.
        family: Object.freeze({
          familyId: approvedPlan.familyId,
          adapterRevision: approvedPlan.adapterRevision,
          providerIdentity: providerId,
          targetManifest: approvedPlan.targetManifest,
        }),
        ...(signal === undefined ? {} : { signal }),
      })
      try {
        const opened = await pa.open(walk)
        if (opened?.cancelled === true) {
          throw refusalToThrow(wiringRefuse(A5_G5_GOAL_WIRING_CODES.ADMISSION_CANCELLED, `${toolName}: cancelled at the PA open edge before admission — zero port entry`))
        }
        if (opened?.kind === 'deny') throw refusalToThrow(opened)
        if (opened?.kind !== 'approved' || opened.grant === undefined || opened.grant === null) {
          throw refusalToThrow(wiringRefuse(A5_G5_GOAL_WIRING_CODES.APPROVAL_NOT_LANDED, `${toolName}: the admission answered ${String(opened?.kind ?? 'unsettled')} without a landed grant — internal state never substitutes for the kernel answer`))
        }
        const edge = await pa.edge(Object.freeze({
          ...walk,
          grant: opened.grant,
          ...(opened.paDurableMint === undefined ? {} : { paDurableMint: opened.paDurableMint }),
          ...(opened.request === undefined ? {} : { request: opened.request }),
          ...(opened.placementName === undefined ? {} : { placementName: opened.placementName }),
          ...(opened.paConstructionBinding === undefined ? {} : { paConstructionBinding: opened.paConstructionBinding }),
        }))
        if (edge?.cancelled === true) {
          throw refusalToThrow(wiringRefuse(A5_G5_GOAL_WIRING_CODES.EDGE_CANCELLED, `${toolName}: cancelled at the execution edge — the approval stays unspent and is never replayed; zero port entry`))
        }
        if (edge?.kind === 'deny') throw refusalToThrow(edge)
        const proof = edge?.consumedProof
        if (!isRecord(proof) || !isRecord(proof.grant) || typeof proof.grant.grantId !== 'string') {
          // The body NEVER self-attests consumption: no witness, no port entry.
          throw refusalToThrow(wiringRefuse(A5_G5_GOAL_WIRING_CODES.CONSUME_PROOF_MISSING, `${toolName}: the execution edge answered allow without its one-shot consume witness — the row never substitutes a self-attested consumption; the body did not run and zero port entries were made`))
        }
        // Same comparison, AFTER the grant landed (root ⑤): a registration
        // that moved under a walk opened against the old one stops here.
        {
          const current = typeof input.registrationOf === 'function' ? input.registrationOf() : undefined
          const stale = isRecord(current)
            && (current.adapterRevision !== A5_G5_ADAPTER_REVISION || current.providerIdentity !== providerId)
          if (stale) {
            observe({ event: 'g5-wire:registration-claim-MISMATCH', name: toolName, stage: 'post-grant', laneEntry: false })
            throw refusalToThrow(wiringRefuse(A5_G5_GOAL_WIRING_CODES.EDGE_CANCELLED, `${registrationMismatch(toolName, 'registration at the edge', current)}; zero port entry`))
          }
        }
        // ② the row's OWN governed body, run on the APPROVED plan: freshness
        // re-classify, capture/port identity re-verify, agent presence, the
        // exact per-tool port calls — all the row's law (L4-L8), through
        // this bridge unchanged. exec rides as given: the Agent object goes
        // to the port BY REFERENCE (the named gap AGENT_AUTH stays
        // native/port-side).
        const ran = await row.runPlan(approvedPlan, isRecord(exec) ? exec : {})
        if (ran?.ok !== true) {
          observe({ event: 'g5-wire:runPlan-REFUSED', name: toolName, code: ran?.code })
          throw refusalToThrow(ran)
        }
        // RESULT PAIRING: what served must BE the approved plan — the same
        // fingerprint; a body that answered a different plan never rides
        // this grant.
        if (!isRecord(ran.plan) || ran.plan.parametersFingerprint !== approvedFingerprint) {
          observe({ event: 'g5-wire:plan-INTEGRITY', name: toolName, callId })
          throw refusalToThrow(wiringRefuse(A5_G5_GOAL_WIRING_CODES.PLAN_INTEGRITY, `${toolName}: the row answered a plan that is not the approved one — the served value is withheld (zero provided bytes)`))
        }
        observe({ event: 'g5-wire:served', name: toolName, callId })
        // The canonical goalValue JSON value, verbatim (the host's own
        // compact Native JSON; timestamps dropped by the row's projection).
        return ran.value
      } finally {
        // The walk's own close handle (idempotent with the edge's own
        // plan-fact close): every path that opened this plan fact ends it
        // here — the same law the G6 bridge carries.
        pa.closePlan(callId)
      }
    }
    // root 8b4: the captured native definition travels COMPLETE — every
    // presentation face verbatim and by reference; ONLY execute is replaced.
    const definition = Object.freeze({ ...native, execute })
    rows.set(toolName, Object.freeze({ status: 'ACTIVE', row, definition, captureIdentity: row.captureIdentity }))
    definitions.push(definition)
    observe({ event: 'g5-wire:mounted', name: toolName })
  }

  // THE MOUNT-MOMENT REGISTRATION (agent-bindings law, post publish): the
  // key is the placement feed's RUNTIME identity of the PLACED definition,
  // read fresh, never cached, never hand-spelled. The shared writer hands
  // each entry to registerA5GovernedFamily — this module registers nothing.
  const mountedKeys = new Map()
  const familyRegistrations = () => Object.freeze(definitions.map((definition) => {
    const fed = placementFeed(definition.name)
    const key = isRecord(fed) && typeof fed.definitionIdentity === 'string' && fed.definitionIdentity.length > 0
      ? fed.definitionIdentity
      : null
    if (key === null) {
      throw new Error(`${A5_G5_GOAL_WIRING_CODES.PLACEMENT_KEY_ABSENT}: the placed row '${definition.name}' answered no definition identity through the placement feed — the family registration has no trusted key; a guessed key is forbidden and an unobserved silent skip is the drift the family gate measures`)
    }
    const seen = mountedKeys.get(definition.name)
    if (seen !== undefined && seen !== key) {
      throw new Error(`${A5_G5_GOAL_WIRING_CODES.PLACEMENT_KEY_MOVED}: the placement identity of '${definition.name}' moved between mount reads (${seen} -> ${key}) — a placed definition's identity does not float; the mount is broken and re-registers nothing`)
    }
    mountedKeys.set(definition.name, key)
    const rowEntry = rows.get(definition.name)
    return Object.freeze({
      name: definition.name,
      definitionIdentity: key,
      entry: Object.freeze({
        // the adapter row's OWN bytes — never re-typed here
        familyId: rowEntry.row.familyId,
        adapterRevision: rowEntry.row.adapterRevision,
        providerIdentity: providerId,
      }),
    })
  }))

  const activeEntries = [...rows.values()].filter((entry) => entry.status === 'ACTIVE')
  const assembly = Object.freeze({
    ok: true,
    familyId: A5_G5_FAMILY_ID,
    revision: A5_G5_GOAL_WIRING_REVISION,
    adapterRevision: A5_G5_ADAPTER_REVISION,
    providerId,
    /** The ACTIVE rows' placement-moment names (definition order). */
    placementNames: Object.freeze(definitions.map((definition) => definition.name)),
    /** ToolDefinition faces for the ACTIVE rows — the COMPLETE captured
     *  natives with ONLY execute replaced (classify -> open -> edge ->
     *  consumedProof -> runPlan). The plane places these verbatim. */
    definitions: Object.freeze(definitions),
    /** Per-tool wiring report: ACTIVE (mounted) or DECLARED-INACTIVE
     *  (no def, no registration — honest census, native untouched). */
    rows: Object.freeze(Object.fromEntries([...rows.entries()])),
    declared: Object.freeze(declared),
    rowOf: (name) => rows.get(name)?.row,
    /** The adapter's shared stats face (dispatches/refuses/driftRejects) —
     *  the row law's own counters, never a second ledger. */
    stats: adapter.stats,
    /** L9 new-call prohibition ONLY — the adapter's own drain law per row;
     *  settles nothing, rolls nothing back. The semantics bytes ride the
     *  row's own disclosed face verbatim. */
    drain: () => {
      for (const entry of rows.values()) entry.row.drain()
      return deepFreeze({
        event: 'g5-wire:drain',
        semantics: activeEntries[0]?.row.drainSemantics
          ?? (activeEntries.length === 0 ? 'drain = NEW-CALL PROHIBITION (no ACTIVE row mounted; every INACTIVE row was already serving nothing)' : 'unsettled'),
      })
    },
    /** THE family registration face — call at the mount moment (AFTER
     *  publish); the PAIRED registration writer feeds each entry to
     *  registerA5GovernedFamily. Throws PLACEMENT_KEY_ABSENT /
     *  PLACEMENT_KEY_MOVED instead of guessing or skipping. */
    familyRegistrations,
  })
  return assembly
}
