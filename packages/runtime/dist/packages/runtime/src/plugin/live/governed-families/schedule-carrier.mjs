/**
 * A5M2 B-SCHEDULE TRIGGER CARRIER — the SHARED BINDING INTERFACE (root ruling
 * 2026-10-24, contract-owner task; the TRIGGER_CONSUMER_CARRIER_BREAKPOINT is
 * CLOSED by this module, not by synthesis):
 *
 * LAW (root, verbatim scope): "受信事件来源→同一PA/Guard内部binding→真实target，
 * 绑定实际fork consumer/generation及真实owner；调用方/模型不可提供冒充，不借
 * create/delete binding、不仅造callId、不新增可调用逃逸工具/平行账。每触发现
 * policy/owner边界，同一token贯穿两phase/一次consume/flight回收。"
 * Plus the final precision: zero wake ≠ zero resolve — the pre-resolve phase
 * admits resolveAgent + setupAndPublish MAINTENANCE ONLY (no model input, no
 * reminder turn); the FINAL PA EDGE rides immediately before the actual
 * followup; the two phases must NOT each consume — ONE consume per flight.
 *
 * The TRUSTED SOURCE is the mount closure itself: this factory is called from
 * the schedule wiring's mount line with the plane's OWN paAdmit/paTokenLedger
 * closures. The returned `admit` is handed to the fork's PUBLIC
 * registerTriggerAdmission seam and to nothing else — no model surface, no
 * tool row (SCHEDULE_CARRIER_TOOL_NAME is a CARRIER label, never a placed
 * row: the placementName reader resolves names ONLY through actually-placed
 * lists, and nothing ever places this label). A caller/model cannot supply
 * this binding: the facts it reads are the fork's DURABLE row identity
 * (owner/target/occurrence), never a model string (the L3b law: every
 * published ScheduleService face is session-scoped and the wake resolves
 * exactly task.sessionId — so the carrier enforces destination === owner).
 *
 * NOT a second ledger: `openFlights` is ONE-token-per-occurrence FLIGHT
 * CUSTODY (token object + the granted construction binding, mount-lifetime,
 * zero durable writes) exactly like the hook-route consumers that "take
 * BEFORE any PA entry and settle in the flight's finally". `consumed` is the
 * one-consume memory (settled occurrences never re-arm — the ledger's own
 * replay law, kept here because the fork may retry admit after delivery).
 *
 * The durable row schema is NOT touched: the fingerprint this carrier demands
 * is computed IN MEMORY from the fired group's full records (root: first
 * taskId + groupSize + revision:null + scheduledAt is NOT an occurrence).
 * If a closed target grammar ever cannot express a field this carrier needs,
 * the contract owner answers with an exact field diff — never a preemptive
 * schema-change claim (root 2026-10-24 final note).
 */

export const SCHEDULE_CARRIER_REVISION = 1
export const SCHEDULE_CARRIER_TOOL_NAME = 'schedule.trigger-carrier'

const INTENT_KEYS = Object.freeze(['ownerSessionId', 'taskId', 'revision', 'occurrence', 'destination', 'groupSize', 'phase', 'carrierFingerprint'])

const isNonEmptyString = (v) => typeof v === 'string' && v.length > 0
const parsesAsIso = (v) => isNonEmptyString(v) && !Number.isNaN(Date.parse(v))
const deny = (code, detail) => Object.freeze({ ok: false, code, detail })

/**
 * @param deps - ALL supplied by the schedule wiring's mount line:
 *  - plane: the LIVE a5PlaneValue (paAdmit open/edge + paTokenLedger); a
 *    missing face fails every admit closed (typed, zero PA entry).
 *  - realmId: this plane's realm id (the walk's own field).
 *  - familyFacts: {familyId, adapterRevision, providerIdentity} — the REAL
 *    B-SCHEDULE facts, never fabricated at firing time.
 *  - consumerProbe: () => { mounted: boolean, generation: string } — answers
 *    the CURRENT fork mount (public registerTriggerAdmission discriminator)
 *    and a non-empty generation identity (facade identity captured by the
 *    wiring at the mount line; drift = typed refuse, zero PA entry).
 *  - observations: the existing audit carrier (no new sink).
 */
export function createScheduleTriggerCarrier(deps) {
  const openFlights = new Map()
  const consumed = new Set()
  let disposed = false

  const occurrenceKeyOf = (intent) => {
    const f = intent.carrierFingerprint
    return `${f.kind}|${intent.taskId}|${f.occurrenceAt}|${f.groupTaskIds.join(',')}`
  }

  const validateShape = (intent) => {
    if (intent === null || typeof intent !== 'object') return deny('P_SCHEDULE_CARRIER_INTENT_UNTYPED', 'the carrier admits exactly ScheduleTriggerIntent+carrierFingerprint plain objects')
    const keys = Object.keys(intent).sort()
    if (keys.length !== INTENT_KEYS.length || keys.some((k, i) => k !== [...INTENT_KEYS].sort()[i])) {
      return deny('P_SCHEDULE_CARRIER_INTENT_KEYS', 'the intent key set is closed (root: the fork card adds carrierFingerprint; nothing else)')
    }
    if (!isNonEmptyString(intent.ownerSessionId) || !isNonEmptyString(intent.taskId)) return deny('P_SCHEDULE_CARRIER_STRINGS', 'ownerSessionId/taskId must be non-empty strings')
    if (intent.revision !== null) return deny('P_SCHEDULE_CARRIER_REVISION', 'revision is null verbatim (639 durable rows carry none — never fabricated)')
    if (intent.phase !== 'pre-resolve' && intent.phase !== 'pre-followup') return deny('P_SCHEDULE_CARRIER_PHASE', 'phase is exactly pre-resolve|pre-followup')
    if (!parsesAsIso(intent.occurrence?.scheduledAt) || !parsesAsIso(intent.occurrence?.occurrenceAt)) return deny('P_SCHEDULE_CARRIER_OCCURRENCE_ISO', 'occurrence.scheduledAt/occurrenceAt must parse as dates')
    if (!isNonEmptyString(intent.destination?.sessionId)) return deny('P_SCHEDULE_CARRIER_DESTINATION', 'destination.sessionId must be a non-empty string')
    if (!Number.isInteger(intent.groupSize) || intent.groupSize < 1) return deny('P_SCHEDULE_CARRIER_GROUPSIZE', 'groupSize must be a positive integer')
    const f = intent.carrierFingerprint
    if (f === null || typeof f !== 'object') return deny('P_SCHEDULE_CARRIER_OCCURRENCE_INSUFFICIENT', 'first taskId + groupSize + revision:null + scheduledAt is NOT an occurrence (root ruling): the fired group\'s full-records fingerprint is required')
    if (f.kind !== 'once' && f.kind !== 'recurring') return deny('P_SCHEDULE_CARRIER_FINGERPRINT_KIND', 'carrierFingerprint.kind is once|recurring')
    const ids = f.groupTaskIds
    if (!Array.isArray(ids) || ids.length === 0 || ids.some((id) => !isNonEmptyString(id))) return deny('P_SCHEDULE_CARRIER_FINGERPRINT_IDS', 'carrierFingerprint.groupTaskIds is the COMPLETE group record-id set')
    if (new Set(ids).size !== ids.length) return deny('P_SCHEDULE_CARRIER_FINGERPRINT_DUP', 'groupTaskIds must be unique')
    if (ids.length !== intent.groupSize) return deny('P_SCHEDULE_CARRIER_FINGERPRINT_SIZE', 'groupTaskIds.length must equal groupSize (same flight, full group)')
    if (!ids.includes(intent.taskId)) return deny('P_SCHEDULE_CARRIER_FINGERPRINT_TASK', 'the head taskId must be a member of the full group set')
    if (f.scheduledAt !== intent.occurrence.scheduledAt) return deny('P_SCHEDULE_CARRIER_FINGERPRINT_SCHED', 'fingerprint.scheduledAt must equal occurrence.scheduledAt verbatim')
    if (f.occurrenceAt !== intent.occurrence.occurrenceAt) return deny('P_SCHEDULE_CARRIER_FINGERPRINT_OCC', 'fingerprint.occurrenceAt must equal occurrence.occurrenceAt verbatim (the REAL resolved occurrence)')
    if (f.kind === 'once' && f.occurrenceAt !== f.scheduledAt) return deny('P_SCHEDULE_CARRIER_FINGERPRINT_ONCE', 'a once row\'s occurrenceAt is its scheduledAt')
    return null
  }

  // policy/owner boundary — re-run at EVERY phase of EVERY trigger (root: 每触发现
  // policy/owner边界). Zero PA entry on every refusal below.
  const boundaryCheck = (intent) => {
    if (disposed) return deny('P_SCHEDULE_CARRIER_DISPOSED', 'the carrier is disposed; its flights were reclaimed')
    const mount = (() => { try { return deps.consumerProbe() } catch { return { mounted: false, generation: '' } } })()
    if (mount?.mounted !== true || !isNonEmptyString(mount.generation)) {
      return deny('P_SCHEDULE_CARRIER_CONSUMER_ABSENT', 'the bound fork consumer/generation is not currently mounted — the carrier rides no other consumer (single-timer law)')
    }
    // REAL owner: the 639 delivery law (L3b above) — the wake resolves exactly
    // task.sessionId; any destination other than the owner session is refused
    // closed. The facts arrive from the fork's DURABLE rows, not from a model.
    if (intent.destination.sessionId !== intent.ownerSessionId) {
      return deny('P_SCHEDULE_CARRIER_OWNER_MISMATCH', 'every published ScheduleService face is session-scoped: the destination IS the owner session; a cross-session carrier does not exist')
    }
    const plane = deps.plane
    if (typeof plane?.paAdmit?.open !== 'function' || typeof plane?.paAdmit?.edge !== 'function') {
      return deny('P_SCHEDULE_CARRIER_PLANE_EDGE_ABSENT', 'the mounted plane answers no paAdmit open/edge — zero entry')
    }
    if (typeof plane?.paTokenLedger?.take !== 'function' || typeof plane?.paTokenLedger?.settle !== 'function') {
      return deny('P_SCHEDULE_CARRIER_LEDGER_ABSENT', 'the plane answers no paTokenLedger take/settle — one-ledger law, zero entry (no second ledger is ever substituted)')
    }
    return null
  }

  const admit = async (intent) => {
    const shape = validateShape(intent)
    if (shape !== null) return shape
    const boundary = boundaryCheck(intent)
    if (boundary !== null) return boundary
    const key = occurrenceKeyOf(intent)
    if (consumed.has(key)) return deny('P_SCHEDULE_CARRIER_ALREADY_CONSUMED', 'this exact occurrence already consumed its one PA edge; a second delivery of one occurrence is refused (one-consume law)')
    const plane = deps.plane
    if (intent.phase === 'pre-resolve') {
      const prior = openFlights.get(key)
      if (prior !== undefined) {
        // flight reclaim: an open flight whose followup leg never arrived
        // (crash/refusal between phases) is settled and re-opened — the SAME
        // occurrence may still deliver exactly once, never twice.
        plane.paTokenLedger.settle(prior.token)
        openFlights.delete(key)
        deps.observations?.(`schedule-carrier: RECLAIMED open flight ${key} before re-open`)
      }
      const token = Symbol(`a5m2-schedule-carrier:${key}`)
      if (plane.paTokenLedger.take(token, `a5m2-schedule-carrier:${deps.realmId}:${key}:flight`) !== true) {
        return deny('P_SCHEDULE_CARRIER_TOKEN_TAKE_REFUSED', 'the ONE ledger refused this flight token (replay law) — zero PA entry')
      }
      const carrierFlightId = `schedule-carrier|${key}`
      const parametersFingerprint = carrierFlightId
      const walk = Object.freeze({
        realmId: deps.realmId,
        callId: carrierFlightId, // the durable identity IS the ledger-allocated correlation of this flight (plane 5309 law: two identities, renamed by nobody); this string is a DERIVED occurrence label, not an issued tool callId
        parametersFingerprint,
        requestedEffects: Object.freeze([{ kind: 'tool-invoke', toolName: SCHEDULE_CARRIER_TOOL_NAME, resource: null }]),
        toolName: SCHEDULE_CARRIER_TOOL_NAME,
        family: Object.freeze({ ...deps.familyFacts }),
      })
      let opened
      try {
        opened = await plane.paAdmit.open(walk)
      } catch (error) {
        plane.paTokenLedger.settle(token)
        return deny('P_SCHEDULE_CARRIER_OPEN_THREW', `the plane open threw: ${String(error?.message ?? error)}`)
      }
      if (opened?.cancelled === true) { plane.paTokenLedger.settle(token); return deny('P_SCHEDULE_CARRIER_OPEN_CANCELLED', 'the admission was cancelled at open; resolve was not admitted') }
      if (opened?.kind !== 'approved' || opened.grant === undefined || opened.grant === null) {
        plane.paTokenLedger.settle(token)
        return opened ?? deny('P_SCHEDULE_CARRIER_APPROVAL_NOT_LANDED', 'the admission answered nothing; zero resolve admitted')
      }
      // GRANTED (pre-resolve): resolveAgent + setupAndPublish MAINTENANCE ONLY
      // (idle context; NO model input, NO reminder turn — root final note).
      // The grant + full construction binding ride custody VERBATIM to the
      // final edge (the D2 lesson: never an edge that drops them).
      openFlights.set(key, { token, opened })
      return true
    }
    const flight = openFlights.get(key)
    if (flight === undefined) return deny('P_SCHEDULE_CARRIER_NOT_OPEN', 'the final edge never borrows: an occurrence consumes only on the token its own pre-resolve opened')
    const { token, opened } = flight
    const walk = Object.freeze({
      realmId: deps.realmId,
      callId: `schedule-carrier|${key}`,
      parametersFingerprint: `schedule-carrier|${key}`,
      requestedEffects: Object.freeze([{ kind: 'tool-invoke', toolName: SCHEDULE_CARRIER_TOOL_NAME, resource: null }]),
      toolName: SCHEDULE_CARRIER_TOOL_NAME,
      family: Object.freeze({ ...deps.familyFacts }),
    })
    let edge
    try {
      edge = await plane.paAdmit.edge(Object.freeze({
        ...walk,
        grant: opened.grant,
        ...(opened.paDurableMint === undefined ? {} : { paDurableMint: opened.paDurableMint }),
        ...(opened.request === undefined ? {} : { request: opened.request }),
        ...(opened.placementName === undefined ? {} : { placementName: opened.placementName }),
        ...(opened.paConstructionBinding === undefined ? {} : { paConstructionBinding: opened.paConstructionBinding }),
      }))
    } catch (error) {
      plane.paTokenLedger.settle(token)
      openFlights.delete(key)
      return deny('P_SCHEDULE_CARRIER_EDGE_THREW', `the final edge threw; the flight was reclaimed: ${String(error?.message ?? error)}`)
    }
    plane.paTokenLedger.settle(token)
    openFlights.delete(key)
    if (edge?.kind !== 'approved') return edge ?? deny('P_SCHEDULE_CARRIER_EDGE_REFUSED', 'the final PA edge refused; no followup was made and none is claimed')
    consumed.add(key)
    return true
  }

  const dispose = () => {
    if (disposed) return
    disposed = true
    const plane = deps.plane
    for (const [, flight] of openFlights) {
      try { plane?.paTokenLedger?.settle?.(flight.token) } catch { /* best-effort reclaim; custody is still dropped */ }
    }
    openFlights.clear()
  }

  return Object.freeze({ admit, dispose, SCHEDULE_CARRIER_REVISION })
}
