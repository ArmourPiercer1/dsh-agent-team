/**
 * governed-families/schedule-wiring.mjs — A5M2 B-SCHEDULE CONTROLLED WIRING
 * for the list/delete subset (census records 32 schedule_list and 31
 * schedule_delete; root 17:38 ruling on the f541 narrow-PASSed adapter:
 * list/delete MAY enter controlled wiring; create/update (30/33) may NOT be
 * enabled — the TRIGGER_GOVERNANCE gap stays open — and the required
 * deliverables may NOT be deleted).
 *
 * THE ADAPTER IS REUSED VERBATIM. This file imports exactly TWO project
 * modules — `./schedule-adapters.mjs` (the owner's rev-2 family module,
 * READ-ONLY to this lane) and `../pa-mount-registry.mjs` (the ONE governed-
 * family table) — and mounts every row THROUGH the adapter's own
 * `createScheduleAdapterAssembly`. No adapter law (the L1 capture law, the
 * L3 real-service delegation, the L4 reference-owner law, the classify/
 * delegate state machine, the named gaps) is restated, widened or routed
 * around here; a refusal this candidate surfaces from adapter legs IS the
 * adapter module's own refusal bytes.
 *
 * THE SUBSET IS CLOSED BY LAW, NOT TASTE: exactly schedule_list and
 * schedule_delete. A capture presented for schedule_create or schedule_delete's
 * never-enabled sibling schedule_update is refused here
 * (P_B_SCHEDULE_WIRE_NON_SUBSET_CAPTURE) BEFORE the adapter ever sees it —
 * never silently dropped, never half-mounted. The create/update PLACED DEFS
 * and their record specs remain in the adapter module, untouched (the root
 * ruling: required deliverables are not deletable); through THIS wiring they
 * exist only as the adapter's own honest declared/INACTIVE rows, they get no
 * definition, no registration, and their family claim falls closed at the
 * table (no registration ⇒ the family gate and the target grammar deny).
 *
 * THE THREE CAPTURE LAWS ARE REQUIRED FACTORY INPUTS (adapter rev-2 law,
 * forwarded to the adapter factory VERBATIM — this layer adds no defaults
 * and never re-checks them itself, so the refusal that answers an omission
 * is the ADAPTER's own P_B_SCHEDULE_INPUT_INVALID):
 *  1. capturedAgent — the SAME live owner Agent object the host's own
 *     registerScheduleTools binds (tools.ts:405/:411 @639ed01539). The owner
 *     law is the host's REFERENCE identity: `exec.agent !== capturedAgent →
 *     internal_error` — a look-alike Agent object with EQUAL id/session
 *     bytes is refused exactly like the host refuses it (root ②; id strings
 *     are never the pairing fact).
 *  2. liveScheduleService — the trusted live ctx.schedule, RE-READ at every
 *     dispatch edge exactly where the host bodies resolve rootCtx.schedule
 *     afresh (tools.ts:443/:460/:484/:515); a service replaced underneath
 *     the mount is PORT_DRIFT, refused with zero port entry.
 *  3. ScheduleInputError — the REAL published error class (packages/tools
 *     schedule lib, src/index.ts:36 @639ed01539, the same class identity
 *     the host bodies throw). The L6 error mirror runs ONLY
 *     `instanceof` against this injected class — never a duck (root ③).
 *
 * THE PA CLAIM EDGE (the seat this wiring owns): the adapter's placed
 * execute runs classify → admit → dispatch exactly once per call; this
 * module supplies the `admit` seat to the adapter and FORWARDS it, enriched,
 * to the injected admission — the plane's PA walk occupies the injected end
 * at integration (the g1 wiring seat law). On the way in the seat mints the
 * family claim's TARGET MANIFEST as a lossless FLAT projection of the
 * adapter's MEASURED plan.target (root ① contract §B-SCHEDULE fidelity:
 * every measured leaf rides, nothing invented, nothing dropped):
 *   contract, ownerKind, ownerSessionId, action, taskId, revision,
 *   timerNamespace, timerEffect, destinationSessionId, destinationPath,
 *   destinationWake
 * with C1 enforced at the projection: destinationSessionId must equal
 * ownerSessionId (every published ScheduleService face is session-scoped to
 * the bound owner; a cross-session destination is refused here,
 * P_B_SCHEDULE_WIRE_TARGET_MINT, never claimed). taskId rides EXACTLY as
 * measured: the validated id for an admitted delete, null for list and for
 * id-law-refused delete answers — the projection never rewrites a measured
 * fact. ONE CONSUMPTION per plan object at this edge (the second admit of
 * the same plan refuses P_B_SCHEDULE_WIRE_ALREADY_ADMITTED with zero port
 * entry — the wiring's own memo discipline; the durable one-shot consumed-
 * proof stays the plane's consume-for-execution edge, exactly as the
 * adapter's PLAN_ONCE_MEMO gap words it — never closed here). A refusal
 * from the injected admission settles the call as a refusal (the adapter
 * throws the typed bytes; zero port entries); only {ok:true} settles as a
 * commit (the single dispatch the adapter performs).
 *
 * GRAMMAR HONESTY (measured, disclosed, NOT papered over): as of this lane
 * NO 'B-SCHEDULE' entry exists in PA_FAMILY_TARGET_RULES (packages/runtime/
 * control/types.ts). The measured list/delete targets share ONE key set,
 * and every leaf except taskId answers the existing 'string' kind; taskId
 * answers null (list; id-law-refused delete) or a non-empty string (admitted
 * delete) and NO existing closed kind types that union ('string' requires
 * length>0; the vocabulary is string/boolean/nonNegativeInt/countsTriple/
 * obligations). Inventing a kind or a sentinel is forbidden (the
 * family-rules round-3 precedent), so the rule key stays UNLANDED and every
 * real B-SCHEDULE claim fails closed at the grammar gate
 * (`familyId: no target structure is registered for 'B-SCHEDULE'`) — pinned
 * live by test/a5m2-schedule-wiring.test.ts. The exact minimal contract
 * delta (ONE strict nullable-string kind, then the 11 measured leaves) is
 * REPORTED to center, not implemented here.
 *
 * NAMED GAPS CARRIED VERBATIM (adapter A5_B_SCHEDULE_NAMED_GAPS rides every
 * plan through this wiring unchanged): TIMER_ARM, TRIGGER_GOVERNANCE,
 * PLAN_ONCE_MEMO, INPUT_ERROR_CLASS, PERSISTENCE_ORDER. The delete/update
 * revocation path stays the durable `status === 'active'` scan law
 * (runtime.ts:90/:155 @639ed01539) — it is NEVER worded as policy auto-
 * revocation anywhere here, and nothing granted through these rows
 * authorizes any later invocation. NO Host, NO plane seat, NO glue, NO real
 * trigger/timer leg exists in this module; those dimensions stay exactly
 * the named gaps the adapter carries.
 *
 * @module @dsh-agent-team/runtime/src/plugin/live/governed-families/schedule-wiring
 */

import {
  A5_B_SCHEDULE_ADAPTER_REVISION,
  A5_B_SCHEDULE_FAMILY_ID,
  A5_B_SCHEDULE_RECORD_SPECS,
  createScheduleAdapterAssembly,
} from './schedule-adapters.mjs'
import { A5_GOVERNED_FAMILIES, a5GovernedFamilyFor, registerA5GovernedFamily } from '../pa-mount-registry.mjs'

export const A5_B_SCHEDULE_WIRING_REVISION = 1

/** Typed codes OWNED by this wiring layer (P_B_SCHEDULE_WIRE_*). Adapter
 *  refusals keep their own P_B_SCHEDULE_* codes verbatim — never rewritten. */
export const A5_B_SCHEDULE_WIRING_CODES = Object.freeze({
  INPUT_INVALID: 'P_B_SCHEDULE_WIRE_INPUT_INVALID',
  NON_SUBSET_CAPTURE: 'P_B_SCHEDULE_WIRE_NON_SUBSET_CAPTURE',
  TARGET_MINT: 'P_B_SCHEDULE_WIRE_TARGET_MINT',
  ALREADY_ADMITTED: 'P_B_SCHEDULE_WIRE_ALREADY_ADMITTED',
})
const WIRE_CODES = A5_B_SCHEDULE_WIRING_CODES

/** THE CLOSED SUBSET: exactly the two operations the root ruling lets enter
 *  controlled wiring. Derived from the adapter's own record specs (the names
 *  are the adapter's; the SUBSET is the ruling), never a parallel table. */
export const A5_B_SCHEDULE_WIRING_SUBSET = Object.freeze(
  Object.keys(A5_B_SCHEDULE_RECORD_SPECS)
    .filter((name) => name === 'schedule_list' || name === 'schedule_delete')
    .map((name) => Object.freeze({ name, recordIndex: A5_B_SCHEDULE_RECORD_SPECS[name].recordIndex, familyId: A5_B_SCHEDULE_FAMILY_ID })),
)

/** The measured plan.target leaf law (MEASURED by running the adapter's
 *  classify for list+delete — this is what the projection accepts, leaf for
 *  leaf; anything else is drift, never a guess). */
const nonEmptyString = (value) => typeof value === 'string' && value.length > 0
const measuredTaskId = (value) => value === null || nonEmptyString(value)

const deepFreeze = (value) => {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child)
    Object.freeze(value)
  }
  return value
}

const isRecord = (value) => typeof value === 'object' && value !== null && !Array.isArray(value)

const refuseAssembly = (code, message) => Object.freeze({ ok: false, code, message })

/** The lossless flat projection of the adapter's measured plan.target.
 *  Refusals here are CLAIM-COMPOSITION refusals (before any durable fact,
 *  zero port entry): the measured shape moved, or C1 would break. */
function mintTargetManifest(plan) {
  const target = isRecord(plan) ? plan.target : undefined
  const owner = isRecord(target) ? target.owner : undefined
  const timer = isRecord(target) ? target.timer : undefined
  const destination = isRecord(target) ? target.destination : undefined
  if (!isRecord(target) || !isRecord(owner) || !isRecord(timer) || !isRecord(destination)) {
    return refuseAssembly(WIRE_CODES.TARGET_MINT, 'the adapter plan carries no measured target shape to project — the claim mints nothing it did not measure')
  }
  if (owner.kind !== 'bound-live-agent-reference' || !nonEmptyString(owner.sessionId)) {
    return refuseAssembly(WIRE_CODES.TARGET_MINT, 'the measured owner leaf (bound-live-agent-reference + owner session) moved — the L4 owner reference is the claim, a drifted owner leaf never rides it')
  }
  if (!nonEmptyString(destination.sessionId) || destination.sessionId !== owner.sessionId) {
    return refuseAssembly(WIRE_CODES.TARGET_MINT, `C1: the destination session (${JSON.stringify(destination.sessionId)}) is not the bound owner session (${JSON.stringify(owner.sessionId)}) — every published ScheduleService face is session-scoped to the bound owner and the wake resolves exactly task.sessionId; this family opens NO cross-session path and this edge mints no cross-session claim`)
  }
  const leaf = (holder, key) => {
    const value = holder[key]
    return nonEmptyString(value) ? value : refuseAssembly(WIRE_CODES.TARGET_MINT, `the measured leaf target.${key} is not the measured non-empty string — nothing is invented to fill it`)
  }
  const contract = leaf(target, 'contract')
  if (isRecord(contract)) return contract
  const action = leaf(target, 'action')
  if (isRecord(action)) return action
  const revision = leaf(target, 'revision')
  if (isRecord(revision)) return revision
  const timerNamespace = leaf(timer, 'namespace')
  if (isRecord(timerNamespace)) return timerNamespace
  const timerEffect = leaf(timer, 'effect')
  if (isRecord(timerEffect)) return timerEffect
  const destinationPath = leaf(destination, 'path')
  if (isRecord(destinationPath)) return destinationPath
  const destinationWake = leaf(destination, 'wake')
  if (isRecord(destinationWake)) return destinationWake
  if (!measuredTaskId(target.taskId)) {
    return refuseAssembly(WIRE_CODES.TARGET_MINT, 'taskId must ride exactly as measured (null, or the validated non-empty id) — never a sentinel, never a rewrite')
  }
  return deepFreeze({
    contract,
    ownerKind: owner.kind,
    ownerSessionId: owner.sessionId,
    action,
    taskId: target.taskId,
    revision,
    timerNamespace,
    timerEffect,
    destinationSessionId: destination.sessionId,
    destinationPath,
    destinationWake,
  })
}

/**
 * Assembly-time controlled wiring for the B-SCHEDULE list/delete subset.
 *
 * @param input {{
 *   providerId?: string,
 *   declaredService?: { present?: boolean },
 *   captured?: Record<string, { native: object, definitionIdentity: string }>,
 *       // ONLY schedule_list / schedule_delete may be presented — a
 *       // schedule_create / schedule_update capture is refused
 *       // P_B_SCHEDULE_WIRE_NON_SUBSET_CAPTURE before the adapter sees it
 *   liveNative: (name: string) => object | undefined,
 *   scheduleService: object,                     // the ctx.schedule-shaped port
 *   liveScheduleService: () => object,           // CAPTURE LAW 2 (required)
 *   capturedAgent: object,                       // CAPTURE LAW 1 (required)
 *   ScheduleInputError: Function,                // CAPTURE LAW 3 (required)
 *   placementFeed: (name: string) => { definitionIdentity?: string, realmId?: string } | undefined,
 *   admit: (ctx: object) => Promise<{ ok: boolean, code?: string, detail?: string }>,
 *   observe?: (row: unknown) => void,
 * }} input
 * @returns a frozen `{ ok: true, wiring }` (definitions, rows, familyRegistrations,
 *          mountGovernedFamilies) or a frozen `{ ok: false, code, message }` —
 *          an omitted capture law answers the ADAPTER's own P_B_SCHEDULE_INPUT_INVALID.
 */
export function createScheduleWiring(input = {}) {
  if (!isRecord(input)) return refuseAssembly(WIRE_CODES.INPUT_INVALID, 'the wiring factory takes one input record')
  // The subset gate runs FIRST and over the raw captured key set: a
  // create/update capture presented to this factory is a config defect and a
  // root-ruling breach (those operations may NOT be enabled), refused — never
  // silently dropped (a silent drop would let the same mount present it again
  // at the next seam and call the row wired).
  const capturedIn = isRecord(input.captured) ? input.captured : {}
  for (const key of Object.keys(capturedIn)) {
    if (key !== 'schedule_list' && key !== 'schedule_delete') {
      return refuseAssembly(WIRE_CODES.NON_SUBSET_CAPTURE, `'${key}' is outside the controlled wiring subset {schedule_list, schedule_delete} (root 17:38: create/update may NOT be enabled — the TRIGGER_GOVERNANCE gap is open). The adapter module keeps their placed defs and record specs (required deliverables, not deletable); THIS wiring never mounts, registers or defines them, and their claim falls closed (no registration ⇒ the family gate and the target grammar deny)`)
    }
  }
  const observe = typeof input.observe === 'function' ? input.observe : () => {}
  const wiringProviderIdentity = typeof input.providerId === 'string' && input.providerId.length > 0 ? input.providerId : 'b-schedule'

  // ONE consumption at this edge: the plan object admitted {ok:true} once is
  // spent; a second admission of the SAME plan refuses with zero port entry.
  // This is the wiring's memo discipline — the durable one-shot consumed-proof
  // is the plane's consume-for-execution edge (the adapter's PLAN_ONCE_MEMO gap,
  // carried verbatim, never claimed closed here).
  const admittedPlans = new WeakSet()
  const stats = { admits: 0, admissionRefusals: 0, admittedOnce: 0, claimMintRefusals: 0 }

  const wireAdmit = async (ctx) => {
    const classified = isRecord(ctx) ? ctx.classified : undefined
    const plan = isRecord(classified) ? classified.plan : undefined
    if (classified?.ok !== true || !isRecord(plan)) {
      // Not this layer's judgment to make — the adapter only reaches this
      // seat with an ok classification; refuse typed, never call through.
      stats.admissionRefusals += 1
      return refuseAssembly(WIRE_CODES.INPUT_INVALID, 'the admission seat saw no ok-classified plan — the adapter composes the classified call before the seat; nothing forwards blind')
    }
    if (admittedPlans.has(plan)) {
      stats.admissionRefusals += 1
      observe({ event: 'b-schedule-wire:already-admitted', name: ctx.name, callId: plan.callId ?? null })
      return Object.freeze({ ok: false, code: WIRE_CODES.ALREADY_ADMITTED, detail: `plan for '${ctx.name}' was already admitted once at this edge — one consumption per plan, the replay is refused with zero port entry` })
    }
    const targetManifest = mintTargetManifest(plan)
    if (targetManifest.ok === false) {
      stats.claimMintRefusals += 1
      observe({ event: 'b-schedule-wire:claim-mint-refused', name: ctx.name, code: targetManifest.code })
      return Object.freeze({ ok: false, code: targetManifest.code, detail: targetManifest.message })
    }
    // The family claim rides the seat with the four P-adds at FULL VALUE
    // (载荷法, the settled plane law): the injected PA walk (the plane occupies
    // the injected end) composes its durable question from these bytes.
    const family = deepFreeze({
      familyId: A5_B_SCHEDULE_FAMILY_ID,
      adapterRevision: A5_B_SCHEDULE_ADAPTER_REVISION,
      providerIdentity: wiringProviderIdentity,
      targetManifest,
    })
    stats.admits += 1
    const answer = await input.admit(Object.freeze({ ...ctx, targetManifest, family }))
    if (answer?.ok === true) {
      admittedPlans.add(plan)
      stats.admittedOnce += 1
      observe({ event: 'b-schedule-wire:admitted', name: ctx.name })
    } else {
      stats.admissionRefusals += 1
      observe({ event: 'b-schedule-wire:admission-refused', name: ctx.name, code: String(answer?.code ?? 'ADMISSION_REFUSED') })
    }
    return answer
  }

  // Everything else forwards VERBATIM: the three capture laws, the L1
  // declared proof, the captures, the port, the feeds. An omission answers
  // the adapter's OWN refusal bytes (P_B_SCHEDULE_INPUT_INVALID et al.) —
  // this layer adds no second gate that could mask them.
  const adapterResult = createScheduleAdapterAssembly({ ...input, captured: capturedIn, observe, admit: wireAdmit })
  if (adapterResult.ok !== true) {
    observe({ event: 'b-schedule-wire:assembly-refused', code: adapterResult.code })
    return Object.freeze({ ...adapterResult })
  }

  // THE MOUNT-MOMENT REGISTRATION (the settled agent-bindings law): the key
  // is the placement feed's RUNTIME identity of the PLACED definition, read
  // fresh; a silent feed THROWS (P_B_SCHEDULE_PLACEMENT_KEY_ABSENT) and a
  // moved identity THROWS (P_B_SCHEDULE_PLACEMENT_KEY_MOVED) — the adapter's
  // familyRegistrations() answers every placed row BEFORE returning, so a
  // throw leaves the registry untouched: no partial registration, ever.
  const mountGovernedFamilies = () => {
    const registrations = adapterResult.familyRegistrations()
    // ATOMIC family write (root 308 law): a conflict on the SECOND key must
    // not leave the FIRST behind. PREFLIGHT every key BEFORE any write (a
    // conflicting prior claim refuses the whole family with zero bytes
    // entered), then write; an unexpected mid-write throw unwinds exactly
    // the keys this mount wrote (the writer's own rollback — never a
    // half-registered family answering the gate).
    for (const registration of registrations) {
      const prior = a5GovernedFamilyFor(registration.definitionIdentity)
      if (prior !== undefined) {
        const error = new Error(`P_B_SCHEDULE_REGISTRATION_CONFLICT — the placement identity of '${registration.name}' is already claimed by family '${String(prior.familyId)}'; the whole B-SCHEDULE family write is refused BEFORE any key is entered (atomicity law: the second conflict never leaves the first)`)
        error.code = 'P_B_SCHEDULE_REGISTRATION_CONFLICT'
        throw error
      }
    }
    const written = []
    try {
      for (const registration of registrations) {
        registerA5GovernedFamily(registration.definitionIdentity, registration.entry)
        written.push(registration.definitionIdentity)
      }
    } catch (error) {
      for (const key of written) {
        delete A5_GOVERNED_FAMILIES[key]
      }
      throw error
    }
    return deepFreeze(registrations.map((registration) => ({
      name: registration.name,
      recordIndex: registration.recordIndex,
      definitionIdentity: registration.definitionIdentity,
      entry: registration.entry,
    })))
  }

  const wiring = deepFreeze({
    ok: true,
    familyId: A5_B_SCHEDULE_FAMILY_ID,
    wiringRevision: A5_B_SCHEDULE_WIRING_REVISION,
    adapterRevision: A5_B_SCHEDULE_ADAPTER_REVISION,
    providerId: adapterResult.providerId,
    subset: A5_B_SCHEDULE_WIRING_SUBSET,
    /** The mounted placed definitions (list/delete only): the COMPLETE
     *  captured definitions with ONLY execute replaced — the plane places
     *  these verbatim (the adapter's own 真实 register 最低入口核 law). */
    definitions: adapterResult.definitions,
    /** Per-record report: the two subset rows ACTIVE; create/update stay the
     *  adapter's own DECLARED-INACTIVE rows (capture never presented here —
     *  required deliverable intact, no definition, no registration). */
    rows: adapterResult.rows,
    declared: adapterResult.declared,
    rowOf: adapterResult.rowOf,
    drain: adapterResult.drain,
    inFlight: adapterResult.inFlight,
    /** THE family registration face (mount moment, AFTER publish). Reads the
     *  placement feed fresh; THROWS absent/moved keys per the registry law. */
    familyRegistrations: adapterResult.familyRegistrations,
    /** THE mount-moment write: familyRegistrations() → registerA5Governed-
     *  Family, list/delete rows ONLY. Throws before writing anything. */
    mountGovernedFamilies,
    /** This edge's claim ledger (admits / refusals / one-consumption count).
     *  The adapter's inFlight() keeps reporting port dispatch truth. */
    claimStats: () => deepFreeze({ ...stats }),
  })
  observe({ event: 'b-schedule-wire:assembled', adapterRevision: A5_B_SCHEDULE_ADAPTER_REVISION, mounted: adapterResult.definitions.map((definition) => definition.name) })
  return wiring
}

/* ── PRODUCTION ARM SURFACE (root 18:11 continuation) ──────────────────────
 * The 59a factory above stays byte-intact as the assembly asset; these
 * exports make the family PRODUCTION-REACHABLE through the plane's REAL PA
 * edges (paAdmit.open → paAdmit.edge → the ONE consumeForExecution witness
 * → the governed body → dispose). The body law is the root ruling verbatim:
 * the governed row's BODY is the CAPTURED NATIVE definition's own execute —
 * "capture必须实际register owner同Agent、live ctx.schedule、同Host错误类"
 * is answered BY the native closure itself:
 *  - owner同Agent: the native was registered for exactly the member Agent
 *    object (registerScheduleTools(rootCtx, toolCtx, agent) @639ed01539), the
 *    row passes the call's REAL exec through, and the arm re-asserts the
 *    host's own `exec.agent !== agent → internal_error` VALUE pre-entry;
 *  - live ctx.schedule: the native body resolves `rootCtx.schedule` AFRESH at
 *    every dispatch (tools.ts :443/:460/:484/:515) — the strongest possible
 *    liveness read, one the plugin could not fabricate; the inert port below
 *    is NOT a stand-in service, it is a refusal object: production traffic
 *    that ever reaches it is drift and it answers loudly;
 *  - 同Host错误类: the arm mirrors `instanceof` ONLY against the REAL
 *    published class imported from '@deepseek-ai/dsh-schedule' (the same
 *    module identity the native bodies throw — ScheduleId mints land here).
 * The 11-leaf projection (mintTargetManifest above) is the ONE claim face —
 * production arms and the 59a seat share it byte-for-byte; taskId rides
 * null-or-exact as measured (the nullable kind stays root's single signed
 * column); create/update have NO arm, NO row, NO registration (the trigger
 * gap is open — they are not enabled). */

/** The host's own identity/signal refusal VALUE (schedule tools lib
 *  internalError() @639ed01539) — the arm answers this pre-entry, never a
 *  typed code the host would not answer. */
const HOST_INTERNAL_ERROR_VALUE = Object.freeze({ code: 'internal_error', message: 'The schedule operation failed.' })

/** The PRODUCTION-LEGAL inert port: every published ScheduleService method
 *  exists (the factory's shape law) and every call REFUSES loudly. The
 *  governed production body is the native execute; nothing dispatches
 *  through a port in production, and anything that ever tries is drift. */
export function createScheduleInertPort () {
  const refuseMethod = async () => {
    throw new Error('P_B_SCHEDULE_PRODUCTION_PORT_INERT — the governed production body is the captured native execute (live rootCtx.schedule is ITS per-call read); nothing dispatches through a port here — a call reaching this port is drift, not a route')
  }
  return Object.freeze({
    create: refuseMethod,
    list: refuseMethod,
    catalog: refuseMethod,
    history: refuseMethod,
    delete: refuseMethod,
    update: refuseMethod,
  })
}

/** The 11-leaf measured projection as the ONE production claim face (the
 *  59a seat's own mintTargetManifest, byte-identical by construction). */
export function mintScheduleTargetManifest (plan) {
  return mintTargetManifest(plan)
}

/**
 * One governed production arm for ONE enabled name ('schedule_list' or
 * 'schedule_delete'). The PLANE calls this at the placement moment with the
 * definition it ACTUALLY places (the image law: identity binds off the
 * placed def, never a glue-time snapshot).
 *
 * @param input {{
 *   name: string,
 *   assembly: object,              // a successful createScheduleWiring result
 *   nativeDefinition: object,      // the captured native face (agentCtx.tools.get)
 *   capturedAgent: object,         // the member Agent object (owner同Agent)
 *   ScheduleInputError: Function,  // the REAL published class (同Host错误类)
 *   definitionIdentity: string,    // definitionIdentityOf(placedDef) at placement
 *   providerId: string,
 *   observe?: (row: object) => void,
 * }} input
 * @returns a frozen `{ ok: true, arm }` (classify / execute / drain) or a
 *          frozen `{ ok: false, code, message }` refusal.
 */
export function createGovernedScheduleArm (input = {}) {
  const name = input.name
  if (name !== 'schedule_list' && name !== 'schedule_delete') {
    return refuseAssembly(WIRE_CODES.INPUT_INVALID, `the production arm exists ONLY for the controlled subset {schedule_list, schedule_delete} — '${String(name)}' is never enabled (TRIGGER_GOVERNANCE gap open for create/update)`)
  }
  const assembly = input.assembly
  if (!isRecord(assembly) || assembly.ok !== true || typeof assembly.rowOf !== 'function') {
    return refuseAssembly(WIRE_CODES.INPUT_INVALID, 'the arm needs a successful createScheduleWiring assembly — no assembly, no classify law, no arm')
  }
  const row = assembly.rowOf(name)
  if (row === undefined || row === null || typeof row.classify !== 'function' || row.active !== true) {
    return refuseAssembly(WIRE_CODES.INPUT_INVALID, `the assembly carries no ACTIVE row for '${name}' — an INACTIVE row gets no production arm, never a degraded one`)
  }
  const native = input.nativeDefinition
  if (!isRecord(native) || native.name !== name || typeof native.execute !== 'function'
    || typeof native.description !== 'string' || native.description.length === 0
    || !isRecord(native.output) || typeof native.output.render !== 'function') {
    return refuseAssembly(WIRE_CODES.INPUT_INVALID, `the captured native '${name}' definition is incomplete (name/description/parameters/output{schema,render}/execute) — the mount IS the native face and has no other source`)
  }
  if (!isRecord(input.capturedAgent) || !isRecord(input.capturedAgent.session) || typeof input.capturedAgent.session.id !== 'string' || input.capturedAgent.session.id.length === 0) {
    return refuseAssembly(WIRE_CODES.INPUT_INVALID, 'the arm demands the live owner Agent OBJECT (session.id non-empty) — the identity law runs on the host reference, never on a session string')
  }
  if (typeof input.ScheduleInputError !== 'function') {
    return refuseAssembly(WIRE_CODES.INPUT_INVALID, "the arm demands the REAL published ScheduleInputError class (import '@deepseek-ai/dsh-schedule') — a duck class cannot mirror the host's own error law (root ③)")
  }
  if (typeof input.definitionIdentity !== 'string' || input.definitionIdentity.length === 0) {
    return refuseAssembly(WIRE_CODES.INPUT_INVALID, 'the arm binds off the definitionIdentity of the definition the plane ACTUALLY placed — never a hand-spelled string')
  }
  const providerId = typeof input.providerId === 'string' && input.providerId.length > 0 ? input.providerId : 'a5p5-plane'
  const observe = typeof input.observe === 'function' ? input.observe : () => {}
  const capturedAgent = input.capturedAgent
  const HostInputError = input.ScheduleInputError
  let drained = false

  const classify = (raw) => {
    if (drained) {
      return { ok: false, code: 'P_B_SCHEDULE_DRAINING', detail: `${name}: draining — new calls are refused (new-call prohibition only; committed durable state is untouched)` }
    }
    const classified = row.classify(raw)
    if (classified.ok !== true) {
      return { ok: false, code: String(classified.code ?? 'P_B_SCHEDULE_CLASSIFY_INVALID'), detail: String(classified.detail ?? 'the adapter classify refused this call') }
    }
    const targetManifest = mintTargetManifest(classified.plan)
    if (targetManifest.ok === false) {
      observe({ event: 'b-schedule-arm:claim-mint-refused', name, code: targetManifest.code })
      return { ok: false, code: targetManifest.code, detail: targetManifest.message }
    }
    // The closed effect set: tool-invoke names THIS row (the todo arm's
    // precedent — the policy decides by tool name; no new resource kind).
    const effects = deepFreeze([{ kind: 'tool-invoke', toolName: name, resource: null }])
    return deepFreeze({
      ok: true,
      plan: classified.plan,
      targetManifest,
      effects,
      // The family block's four P-adds at FULL VALUE (载荷法, the settled
      // plane law): the bridge composes the durable manifest from this and
      // checks it against the mount's own registration.
      reviewPayload: Object.freeze({
        familyId: A5_B_SCHEDULE_FAMILY_ID,
        adapterRevision: A5_B_SCHEDULE_ADAPTER_REVISION,
        providerIdentity: providerId,
        targetManifest,
      }),
    })
  }

  const execute = async (plan, exec) => {
    if (!isRecord(exec)) {
      return { ok: false, code: 'P_B_SCHEDULE_EXEC_UNBOUND', detail: 'the governed body needs the call REAL exec (agent + signal) — nothing dispatches blind' }
    }
    // Owner同Agent PRE-ENTRY (the host's own identity VALUE verbatim): the
    // native would answer exactly this on a reference miss — the arm answers
    // it with ZERO native entry, and a pass still runs the native's own law.
    if (exec.agent !== capturedAgent) {
      observe({ event: 'b-schedule-arm:owner-refusal-value', name })
      return deepFreeze({ ok: true, settled: 'host-identity-value', value: HOST_INTERNAL_ERROR_VALUE })
    }
    try {
      const value = await native.execute(plan.args, exec)
      observe({ event: 'b-schedule-arm:native-settled', name })
      return { ok: true, value }
    } catch (error) {
      // 同Host错误类: ONLY the injected REAL class identity mirrors to its
      // own code (the ScheduleId mint throw rides exactly this path); any
      // other throw refuses typed — and for the durable-mutating delete the
      // side-effect class is declared, never silently dropped (f609c1b law).
      if (error instanceof HostInputError) {
        observe({ event: 'b-schedule-arm:input-error-mirror', name })
        return deepFreeze({ ok: true, settled: 'host-error-mirror', value: Object.freeze({ code: String(error.code), message: String(error.message) }) })
      }
      observe({ event: 'b-schedule-arm:native-threw', name })
      return {
        ok: false,
        code: 'P_B_SCHEDULE_NATIVE_UNEXPECTED',
        detail: `the captured native body threw outside the host's own error law (${String(error?.message ?? error).slice(0, 160)})`,
        ...(name === 'schedule_delete' ? { sideEffectPossible: true } : {}),
      }
    }
  }

  const arm = deepFreeze({
    name,
    familyId: A5_B_SCHEDULE_FAMILY_ID,
    adapterRevision: A5_B_SCHEDULE_ADAPTER_REVISION,
    providerId,
    definitionIdentity: input.definitionIdentity,
    classify,
    execute,
    drain: () => {
      drained = true
      // The assembly's own drain rides: new calls refuse at BOTH legs (the
      // adapter row classify and the arm), committed durable state is
      // untouched (new-call prohibition ONLY, the adapter's DRAIN_SEMANTICS).
      assembly.drain()
    },
  })
  observe({ event: 'b-schedule-arm:created', name, definitionIdentity: String(input.definitionIdentity).slice(0, 32) })
  return deepFreeze({ ok: true, arm })
}
