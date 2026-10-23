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
import { registerA5GovernedFamily } from '../pa-mount-registry.mjs'

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
    for (const registration of registrations) {
      registerA5GovernedFamily(registration.definitionIdentity, registration.entry)
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
