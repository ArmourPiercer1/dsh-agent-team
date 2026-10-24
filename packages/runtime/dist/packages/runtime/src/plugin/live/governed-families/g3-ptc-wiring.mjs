/**
 * A5M2 G3 B-PTC — PRODUCTION WIRING BRIDGE for the single `run_code` row
 * (root 04:4x throughput card, reassigned to this lane; the e78 handoff
 * fact list [A]-[E]).
 *
 * This module is the run_code instance of the audited G3 bridge law
 * (`g3-terminal-wiring.mjs`, verbatim pattern): the BRIDGE between the
 * committed B-PTC family adapter (`governed-families/g3-fsproc-adapters.mjs`
 * — `createGovernedRunCodeArm`, imported AS-IS, never edited here) and the
 * production team-tool plane's ONE PA admission. The adapter's own doc
 * names the gap this closes: CENTER captures the registry-minted native
 * definition and wires THIS arm; the arm never answers an escalation and
 * never grants nested calls anything (the escalation adjudication stays
 * EXCLUSIVELY on the ptc-escalation-row, untouched).
 *
 * Laws carried from the terminal bridge, unchanged:
 *  1. CLOSED input surface — unknown keys refuse typed, never widen.
 *  2. ONE CAPTURE through the member-scoped seam (the 85 exact-capture law:
 *     the captured instance serves BOTH the arm bind and the placed def;
 *     no global fallback, no parent layer). `undefined` is a legal answer
 *     and lands the honest DECLARED-INACTIVE census — NO def, NO
 *     registration, the native transport stays untouched.
 *  3. THE REAL PA SEAT — the plane's own `paAdmit` (callable with open /
 *     edge / closePlan) or an equivalent methods object; no seat, no walk.
 *  4. THE FULL WALK per call: classify (arm, pure) → open → edge → the
 *     ONE-SHOT consumedProof DEMAND → prepare(grant) → execute → the
 *     captured body's answer RETURNED VERBATIM. Every refusal before
 *     arm.execute is ZERO PORT ENTRY; the body here IS the registry-minted
 *     native transport (controlPort is null — the B-PTC executor is the
 *     host's own run_code transport behind the grant witness).
 *  5. ARMS BOUND AT THE PLACEMENT MOMENT through `identityOf(placedDef)`;
 *     the entry re-verify rides the LIVE placement feed.
 *  6. POST-PUBLISH REGISTRATION keyed by the placement feed's RUNTIME
 *     identity — THROWS on absent/moved keys, registers nothing itself.
 *  7. DRAIN is the adapter's own law (new-call prohibition only).
 *
 * The envelope/budget honesty lives in the ADAPTER (validateRunCode): a
 * ptcFacts reader whose supply faces are absent answers null or a partial
 * fact set and the arm refuses EVERY run typed (P_PTC_ENVELOPE_UNEVIDENCED
 * / P_PTC_TARGET_UNEVIDENCED naming the missing fact) — the bridge never
 * launders a half-fed fact set into a mount.
 *
 * MODULE ENTRIES (root FINAL LIMITED ruling on run_code, 2026-10-25):
 *  ① buildG3RunCodeWiring — the def-PLACEMENT bridge: RETIRED and
 *     UNMOUNTED FOREVER (the P1 fact below stands; the anti-reintroduction
 *     pins in the spec keep it red if anyone re-adds the placement path).
 *  ② buildG3RunCodeGuard — the GUARD-SEAM entry WIRED per the ruling: one
 *     scope-filtered `tools/pre-execute` listener over the PUBLIC seam,
 *     classify → PA open → edge ONE consume → allow → the RESERVED native
 *     runs untouched. TIER: 接线未测 (wired, not Host-tested).
 *
 * MOUNT STATUS ① — UNMOUNTED, P1 (root independent review, consolidated
 * run_code card): the HOST 639 UNCONDITIONALLY reserves the name —
 * registering or shadowing `run_code` THROWS (core/tools/src/index.ts:
 * 1080-1081 "reserved for the PTC mode presentation transport and cannot
 * be registered or shadowed"), so a definition-placement arm would hit the
 * plane's PLANE_PLACEMENT_CONFLICT and roll back the ENTIRE plane, not
 * just the run. The plane/bindings placement path was therefore REVERTED
 * (forward commits); this module and `createGovernedRunCodeArm` stay
 * PRESENT UNMOUNTED under the declared-inactive discipline as the audited
 * evidence of the discovered conflict. The legitimate shape (root-allowed,
 * NEXT card) interposes the EXISTING Guard/PA over the REAL public seams
 * (`tools/pre-execute`, `tools.guard`, `tools/execute` next-waterfall —
 * core/tools/src/index.ts:153/164/1136/1605), consumes the ONE grant, and
 * then lets the RESERVED native `next()` run with its OWN guarantees
 * mirrored by NOTHING (concurrency ptc.ts:334/495/660; cancellation
 * rootCallId/parentToken/agent/signal :538-555; timeout+sandbox prepare
 * :622, schemas :689, runtime.resolve/run :697-708). Zero shadow
 * registration, zero new scheduling accounts. OBLIGATION LAW — ACTUAL
 * MAPPING per the final limited ruling: the per-run TOTAL dispatch cap is
 * NOT IMPLEMENTED (zero face anywhere in the 639 tree), it is DISCLOSED
 * through the manifest leaf (A5_G3_PTC_TOTAL_DISPATCH_CAP_DISCLOSURE) and
 * is explicitly NOT a self-issued release gate; the old every-run mandatory
 * refusal was adapter-side over-specification and is WITHDRAWN. Channel
 * facts, the envelope answer, per-nested A, parent cancellation and
 * one-consume each STAY mandatory every run.
 */
import { parseRequestedEffectSet } from '../../../../../domain/tool-governance/src/index.js'
import {
  A5_G3_FAMILIES,
  A5_G3_PTC_ADAPTER_REVISION,
  A5_G3_PTC_TOTAL_DISPATCH_CAP_DISCLOSURE,
  createGovernedRunCodeArm,
} from './g3-fsproc-adapters.mjs'

export const A5_G3_PTC_WIRING_REVISION = 1

/** THE MOUNT CENSUS (root consolidated run_code card, P1): this bridge is
 *  PRESENT UNMOUNTED — the host reserves `run_code` against registration
 *  or shadowing (639 core/tools/src/index.ts:1080-1081), so the
 *  definition-placement path would roll back the WHOLE plane at the
 *  unified registration (PLANE_PLACEMENT_CONFLICT), and the mount status
 *  rides EVERY census observation of this module so no consumer can read a
 *  quiet "mounted" story. The obligation law (total dispatch budget
 *  listed as the real functional gap, native guarantees untouched) is in
 *  the header. */
export const A5_G3_PTC_MOUNT_STATUS = Object.freeze({
  mounted: false,
  code: 'P1-HOST-FORBIDDEN-REGISTRATION',
  evidence: '639 core/tools/src/index.ts:1080-1081 — "reserved for the PTC mode presentation transport and cannot be registered or shadowed"; unified-registration whole-plane rollback via PLANE_PLACEMENT_CONFLICT',
  nextShape: 'scope-filtered tools/pre-execute + tools.guard + tools/execute(next) interposition, one consume, then the reserved native next() (root-allowed, next card)',
})

/** The one row this bridge mounts (the PLANE_RESERVED_NATIVE spelling,
 *  team-tool-plane.mjs C-16; this bridge places NOTHING under any other
 *  name). */
export const A5_G3_RUN_CODE_TOOL_NAME = 'run_code'

export const A5_G3_PTC_WIRING_CODES = Object.freeze({
  INPUT_INVALID: 'RUNCODE_WIRE_INPUT_INVALID',
  CALL_ID_ABSENT: 'RUNCODE_WIRE_CALL_ID_ABSENT',
  EFFECTS_UNPARSABLE: 'RUNCODE_WIRE_EFFECTS_UNPARSABLE',
  ADMISSION_CANCELLED: 'RUNCODE_WIRE_ADMISSION_CANCELLED',
  APPROVAL_NOT_LANDED: 'RUNCODE_WIRE_APPROVAL_NOT_LANDED',
  EDGE_CANCELLED: 'RUNCODE_WIRE_EDGE_CANCELLED',
  CONSUME_PROOF_MISSING: 'RUNCODE_WIRE_CONSUME_PROOF_MISSING',
  PREPARE_REFUSED: 'RUNCODE_WIRE_PREPARE_REFUSED',
  IDENTITY_UNBOUND: 'RUNCODE_WIRE_IDENTITY_UNBOUND',
  PLACEMENT_KEY_ABSENT: 'RUNCODE_WIRE_PLACEMENT_KEY_ABSENT',
  PLACEMENT_KEY_MOVED: 'RUNCODE_WIRE_PLACEMENT_KEY_MOVED',
})

const deepFreeze = (value) => {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value)
    for (const child of Object.values(value)) deepFreeze(child)
  }
  return value
}

const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)

/* The 受审编码 (reviewed encoding, the B-TERMINAL precedent at
 * g3-terminal-wiring.mjs:148-158 — canonical JSON over the original leaf,
 * keys sorted recursively, 'absent' for null/missing): the FULL VALUE rides
 * the durable row leaf-closed. Same encoding, no new table kind. */
const rcCanonicalJson = (value) => {
  if (value === null || value === undefined) return 'absent'
  const sortDeep = (v) => (Array.isArray(v)
    ? v.map(sortDeep)
    : (v !== null && typeof v === 'object'
      ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, sortDeep(v[k])]))
      : v))
  return JSON.stringify(sortDeep(value))
}

/** THE B-PTC CLOSED-TABLE FLAT VIEW (the a5G3PaTargetFlat law, this family):
 *  PA_FAMILY_TARGET_RULES['B-PTC'] in control/types.ts is its counterpart.
 *  Every leaf maps ONE-FOR-ONE from the adapter's CLASSIFY manifest at FULL
 *  VALUE; object/array leaves ride under the reviewed encoding. A manifest
 *  this view does not recognize passes THROUGH unchanged — the grammar
 *  refusal names it, nothing is invented here. */
export function a5G3PtcPaTargetFlat(manifest) {
  if (!isRecord(manifest) || manifest.operation !== 'program-run') return manifest
  const interp = manifest.interpreterTarget
  const env = manifest.effectiveEnvelope
  const channel = manifest.childChannel
  if (!isRecord(interp) || !isRecord(env) || !isRecord(channel)
    || !Array.isArray(channel.capabilityList)) return manifest
  return Object.freeze({
    operation: manifest.operation,
    toolName: manifest.toolName,
    realmId: manifest.realmId,
    agentId: manifest.agentId,
    sessionHeaderId: manifest.sessionHeaderId,
    paramFingerprint: manifest.paramFingerprint,
    interpreterRuntimeIdentity: interp.runtimeIdentity,
    interpreterLanguage: interp.language,
    envelopeMode: env.mode,
    envelopeEnforcement: env.enforcement,
    timeoutPolicyJson: rcCanonicalJson(manifest.timeoutPolicy),
    capabilityList: channel.capabilityList,
    capabilityCount: channel.capabilityCount,
    channelDigest: channel.channelDigest,
    // ACTUAL mapping (root final limited ruling): canonical-JSON string
    // ONLY for a real supplier observation; the total-count cap leaf
    // carries the disclosure constant verbatim (never a fake number).
    maxParallelSubCalls: Number.isFinite(channel.maxParallelSubCalls) ? JSON.stringify(channel.maxParallelSubCalls) : null,
    runDispatchBudget: Number.isFinite(channel.runDispatchBudget) ? JSON.stringify(channel.runDispatchBudget) : A5_G3_PTC_TOTAL_DISPATCH_CAP_DISCLOSURE,
    lineageFacts: channel.lineageFacts,
    codeDigest: manifest.codeDigest,
    descriptionDigest: manifest.descriptionDigest,
    timeoutMsJson: rcCanonicalJson(manifest.timeoutMs),
    requestedSandboxMode: manifest.requestedSandboxMode ?? null,
    justificationDigest: manifest.justificationDigest ?? null,
    effectDelta: manifest.effectDelta,
  })
}

const refusalToThrow = (refusal) => {
  const error = new Error(`refused-run_code ${String(refusal?.code ?? 'REFUSED')} — ${String(refusal?.detail ?? 'refused without detail')}`)
  if (typeof refusal?.code === 'string') error.code = refusal.code
  return error
}

const wiringRefuse = (code, detail) => deepFreeze({ ok: false, code, detail })

/** The CAPTURED registration face (the G6/terminal law, same bytes): a
 *  name is mountable only when the captured object carries the complete
 *  published presentation face. */
const registrationFaceComplete = (native) => {
  const output = isRecord(native) ? native.output : undefined
  return isRecord(native)
    && typeof native.description === 'string' && native.description.length > 0
    && isRecord(native.parameters)
    && isRecord(output)
    && typeof output.render === 'function'
    && (output.presentationMeta === undefined || typeof output.presentationMeta === 'function')
    && typeof native.execute === 'function'
}

/**
 * Build the ONE governed run_code row. Returns the assembly the plane
 * places: `{ ok, familyId, placementNames, definitions, declared, rows,
 * drain, familyRegistrations }` — the same surface shape the terminal
 * bridge publishes, so the plane's fill-point registration and union-c1
 * pairing ride one law for both keys.
 */
export function buildG3RunCodeWiring (input = {}) {
  const knownInput = new Set([
    'realmId', 'providerId', 'memberAgentId', 'sessionHeaderId', 'readNative',
    'ptcFacts', 'bindingFacts', 'correlationOf', 'placementFeed', 'identityOf',
    'pa', 'observe',
  ])
  for (const key of Object.keys(input)) {
    if (!knownInput.has(key)) {
      return wiringRefuse(A5_G3_PTC_WIRING_CODES.INPUT_INVALID, `unknown input key '${key}' — the wiring surface is closed; an unrecognized knob never silently widens the mount`)
    }
  }
  const {
    realmId, providerId, memberAgentId, sessionHeaderId, readNative,
    ptcFacts, bindingFacts, placementFeed, identityOf, pa, observe = () => {},
  } = input
  if (typeof realmId !== 'string' || realmId.length === 0) return wiringRefuse(A5_G3_PTC_WIRING_CODES.INPUT_INVALID, 'realmId is REQUIRED (the placement realm joins every resource identity)')
  if (typeof providerId !== 'string' || providerId.length === 0) return wiringRefuse(A5_G3_PTC_WIRING_CODES.INPUT_INVALID, 'providerId is REQUIRED (the family registration carries the provider identity verbatim)')
  if (typeof memberAgentId !== 'string' || memberAgentId.length === 0) return wiringRefuse(A5_G3_PTC_WIRING_CODES.INPUT_INVALID, 'memberAgentId is REQUIRED — the arm owns state through the EXACT member Agent (exec.agent.id), never a name lookup')
  if (typeof sessionHeaderId !== 'string' || sessionHeaderId.length === 0) return wiringRefuse(A5_G3_PTC_WIRING_CODES.INPUT_INVALID, 'sessionHeaderId is REQUIRED — the durable session header (exec.agent.session.header.id) is the ownership leg')
  if (typeof readNative !== 'function') return wiringRefuse(A5_G3_PTC_WIRING_CODES.INPUT_INVALID, 'readNative (name) => definition | undefined is REQUIRED — the member-scoped capture seam (the 85 exact-capture law: the global face is NOT a fallback); `undefined` is a legal answer landing the honest DECLARED-INACTIVE census')
  if (typeof ptcFacts !== 'function') return wiringRefuse(A5_G3_PTC_WIRING_CODES.INPUT_INVALID, 'ptcFacts () => facts | null is REQUIRED — the LIVE supplier of interpreter/effectiveEnvelope/timeout/childChannel; an absent supply face answers null and the arm refuses every run TYPED (never a half-fed fact set laundered into a mount)')
  if (typeof bindingFacts !== 'function') return wiringRefuse(A5_G3_PTC_WIRING_CODES.INPUT_INVALID, "bindingFacts (toolName) => {bindingId, bindingRevision, policyGeneration, authorityGeneration} is REQUIRED — the CURRENT dispatcher binding of THAT tool's entry, read LIVE (the todo/write arm reader law)")
  if (typeof identityOf !== 'function') return wiringRefuse(A5_G3_PTC_WIRING_CODES.INPUT_INVALID, 'identityOf (placedDef) => string | null is REQUIRED — the plane\'s definitionIdentityOf seam; the arm binds the identity of the definition THIS mount places')
  if (typeof placementFeed !== 'function') return wiringRefuse(A5_G3_PTC_WIRING_CODES.INPUT_INVALID, 'placementFeed (name) => {definitionIdentity, realmId} | undefined is REQUIRED — the LAZY placement read; the entry re-verify and the registration key both ride it')
  // THE REAL PA SEAT (P1 fix, root consolidated card): the plane's own
  // `paAdmit` is an async FUNCTION carrying open / edge / closePlan as
  // properties, passed through AS-IS on every row mount (`pa: paAdmit` —
  // the plane types and hands it exactly so). A typeof-object check would
  // trip RUNCODE_WIRE_INPUT_INVALID on the GENUINE seat and block the
  // whole plane BEFORE any other law applies. The check therefore mirrors
  // the real callable shape — never a fake plain object, never a duck,
  // and the PA subject itself is never altered.
  const paSeatOk = typeof pa === 'function' && typeof pa.open === 'function' && typeof pa.edge === 'function' && typeof pa.closePlan === 'function'
  if (!paSeatOk) {
    return wiringRefuse(A5_G3_PTC_WIRING_CODES.INPUT_INVALID, 'pa is REQUIRED in the REAL published shape — the plane\'s paAdmit: a CALLABLE seat carrying open / edge / closePlan (typeof function + the three members; a plain-object duck or a memberless function is garbage and refuses); with no admission seat no governed call may enter the body — never input.admit{ok:true}')
  }
  const correlationOf = input.correlationOf === undefined
    ? (exec) => (isRecord(exec) && typeof exec.callId === 'string' && exec.callId.length > 0 ? exec.callId : null)
    : typeof input.correlationOf === 'function' ? input.correlationOf : null
  if (correlationOf === null) {
    return wiringRefuse(A5_G3_PTC_WIRING_CODES.INPUT_INVALID, 'correlationOf, when supplied, must be (exec, toolName) => string | null — the ISSUED call identity seam; a non-function never substitutes')
  }

  // ONE CAPTURE (the 85 exact-capture law): the seam is read AT MOST once;
  // the SAME object serves the arm bind-time capture and the placed def.
  const capturedOnce = new Map()
  const readNativeOnce = (name) => {
    if (capturedOnce.has(name)) return capturedOnce.get(name)
    const captured = readNative(name)
    capturedOnce.set(name, captured === null || captured === undefined ? undefined : captured)
    return capturedOnce.get(name)
  }

  // THE LATE ARM HOLDER (the terminal law verbatim): the def's execute
  // closes over `arm`, bound below at the placement moment; no def can run
  // against an unbound arm (no native fallback, no degraded lane).
  let arm = null

  const rows = new Map()
  const declared = []
  const definitions = []
  let boundIdentity = null

  const native = readNativeOnce(A5_G3_RUN_CODE_TOOL_NAME)
  if (native === undefined || !registrationFaceComplete(native)) {
    // Honest DECLARED-INACTIVE census: NO definition, NO registration.
    rows.set(A5_G3_RUN_CODE_TOOL_NAME, Object.freeze({
      status: 'DECLARED-INACTIVE',
      reason: native === undefined ? 'capture-absent' : 'registration-face-incomplete',
    }))
    declared.push(Object.freeze({
      name: A5_G3_RUN_CODE_TOOL_NAME,
      familyId: A5_G3_FAMILIES.PTC,
      status: 'DECLARED-INACTIVE',
      reason: native === undefined ? 'capture-absent' : 'registration-face-incomplete',
    }))
    observe({ event: 'g3-ptc-wire:declared', name: A5_G3_RUN_CODE_TOOL_NAME, reason: native === undefined ? 'capture-absent' : 'registration-face-incomplete', mount: A5_G3_PTC_MOUNT_STATUS })
  } else {
    const execute = async (args, exec) => {
      if (arm === null) {
        throw new Error('refused-run_code arm-unavailable — no governed B-PTC arm is placed on this mount (or it was torn down); there is no native fallback and no degraded lane')
      }
      const callId = correlationOf(exec, A5_G3_RUN_CODE_TOOL_NAME)
      if (typeof callId !== 'string' || callId.length === 0) {
        throw refusalToThrow(wiringRefuse(A5_G3_PTC_WIRING_CODES.CALL_ID_ABSENT, 'run_code: the execution answered no ISSUED call identity — the PA walk has no single-flight key; a guessed correlation is forbidden (zero port entry)'))
      }
      // ① the arm's OWN classify — the REAL captured definition's parameter
      // surface plus the adapter's budget/envelope laws: every constraint is
      // the arm's, never a restatement. A refusal here entered NOTHING.
      const classified = arm.classify(args, exec, callId)
      if (classified.ok !== true) {
        observe({ event: 'g3-ptc-wire:classify-REFUSED', name: A5_G3_RUN_CODE_TOOL_NAME, code: classified.code })
        throw refusalToThrow(classified)
      }
      const parsedEffects = parseRequestedEffectSet(classified.effects)
      if (parsedEffects.ok !== true) {
        throw refusalToThrow(wiringRefuse(A5_G3_PTC_WIRING_CODES.EFFECTS_UNPARSABLE, `run_code: the arm's effect set is not the frozen closed vocabulary (${String(parsedEffects.problems?.[0]?.detail ?? 'parse refused')}) (zero port entry)`))
      }
      const signal = isRecord(exec) ? exec.signal : undefined
      // THE REAL CANCEL SUPPLY (the terminal law, carried): every abort
      // routes through the arm's OWN cancel law; detached in the finally.
      const signalTarget = isRecord(signal)
        && typeof signal.addEventListener === 'function'
        && typeof signal.removeEventListener === 'function' ? signal : null
      const routeAbort = () => { arm.cancel(classified.plan) }
      if (signalTarget !== null) signalTarget.addEventListener('abort', routeAbort)
      const payload = classified.reviewPayload
      const walk = Object.freeze({
        realmId,
        callId,
        parametersFingerprint: classified.parametersFingerprint,
        requestedEffects: parsedEffects.value,
        toolName: A5_G3_RUN_CODE_TOOL_NAME,
        // 载荷法: the four P-adds at FULL VALUE from the arm's own payload;
        // the B-PTC targetManifest rides as the PA CLOSED-TABLE flat view
        // (a5G3PtcPaTargetFlat — the B-CONTROL one-for-one FLAT LEAVES law;
        // a manifest shape the view does not recognize passes THROUGH).
        family: Object.freeze({
          familyId: payload.familyId,
          adapterRevision: payload.adapterRevision,
          providerIdentity: payload.providerIdentity,
          targetManifest: a5G3PtcPaTargetFlat(payload.targetManifest),
        }),
        ...(signal === undefined ? {} : { signal }),
      })
      try {
        const opened = await pa.open(walk)
        if (opened?.cancelled === true) {
          throw refusalToThrow(wiringRefuse(A5_G3_PTC_WIRING_CODES.ADMISSION_CANCELLED, 'run_code: cancelled at the PA open edge before admission — zero port entry'))
        }
        if (opened?.kind === 'deny') throw refusalToThrow(opened)
        if (opened?.kind !== 'approved' || opened.grant === undefined || opened.grant === null) {
          throw refusalToThrow(wiringRefuse(A5_G3_PTC_WIRING_CODES.APPROVAL_NOT_LANDED, `run_code: the admission answered ${String(opened?.kind ?? 'unsettled')} without a landed grant — internal state never substitutes for the kernel answer (zero port entry)`))
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
          throw refusalToThrow(wiringRefuse(A5_G3_PTC_WIRING_CODES.EDGE_CANCELLED, 'run_code: cancelled at the execution edge — the approval stays unspent and is never replayed; zero port entry'))
        }
        if (edge?.kind === 'deny') throw refusalToThrow(edge)
        const proof = edge?.consumedProof
        if (!isRecord(proof) || !isRecord(proof.grant) || typeof proof.grant.grantId !== 'string') {
          throw refusalToThrow(wiringRefuse(A5_G3_PTC_WIRING_CODES.CONSUME_PROOF_MISSING, 'run_code: the execution edge answered allow without its one-shot consume witness — the row never substitutes a self-attested consumption; the body did not run and zero port entries were made'))
        }
        // THE NAMED race (fix-3 law): consumed grant is ledger truth, never
        // rolled back; the body is entered ZERO times on a post-consume abort.
        if (signal?.aborted === true) {
          const settled = arm.cancel(classified.plan)
          throw new Error(`run_code · cancelled — the call was aborted after the execution edge consumed the grant and before the body began (the consumption is a settled fact and is never rolled back; arm settle: ${String(settled?.settled ?? settled?.code ?? 'n/a')}; zero port entries)`)
        }
        const prepared = arm.prepare(classified.plan, proof.grant)
        if (prepared?.ok !== true) {
          observe({ event: 'g3-ptc-wire:prepare-REFUSED', name: A5_G3_RUN_CODE_TOOL_NAME, code: prepared?.code })
          throw refusalToThrow(isRecord(prepared) && typeof prepared.code === 'string'
            ? prepared
            : wiringRefuse(A5_G3_PTC_WIRING_CODES.PREPARE_REFUSED, 'run_code: the arm refused to record the kernel grant — zero port entry'))
        }
        // ② the arm's OWN execute: the grant pairing, the LIVE re-verify
        // (placement identity through the feed, CURRENT binding facts), then
        // the CAPTURED BODY — the registry-minted run_code transport — and
        // its answer commits.
        const ran = await arm.execute(classified.plan, { consumed: true, grant: proof.grant })
        if (ran?.ok !== true) {
          observe({ event: 'g3-ptc-wire:execute-REFUSED', name: A5_G3_RUN_CODE_TOOL_NAME, code: ran?.code })
          throw refusalToThrow(ran)
        }
        observe({ event: 'g3-ptc-wire:served', name: A5_G3_RUN_CODE_TOOL_NAME, callId })
        // THE ANSWER TRAVELS VERBATIM: it IS the native transport's word.
        return ran.value
      } finally {
        if (signalTarget !== null) signalTarget.removeEventListener('abort', routeAbort)
        pa.closePlan(callId)
      }
    }
    // root 8b4: the captured native definition travels COMPLETE — every
    // presentation face verbatim and by reference; ONLY execute is replaced.
    const definition = Object.freeze({ ...native, execute })
    const identity = identityOf(definition)
    if (typeof identity !== 'string' || identity.length === 0) {
      throw new Error(`${A5_G3_PTC_WIRING_CODES.IDENTITY_UNBOUND}: 'run_code' — the definitionIdentityOf seam answered no identity for the definition this mount places; the arm cannot bind (a guessed or null identity is forbidden — the image-arm law, carried to the B-PTC row)`)
    }
    boundIdentity = identity
    arm = createGovernedRunCodeArm({
      nativeDefinition: native,
      definitionIdentity: identity,
      liveDispatcher: () => {
        const fed = placementFeed(A5_G3_RUN_CODE_TOOL_NAME)
        return isRecord(fed) && typeof fed.definitionIdentity === 'string' && fed.definitionIdentity.length > 0 ? fed : null
      },
      providerId,
      memberAgentId,
      sessionHeaderId,
      realmId,
      bindingFacts: () => bindingFacts(A5_G3_RUN_CODE_TOOL_NAME),
      ptcFacts,
      // controlPort stays ABSENT: the B-PTC body IS the host run_code
      // transport (adapter doc, :144) — the grant witness above is the only
      // gate this bridge adds around it.
      observe: (event) => { observe({ source: 'g3-ptc-adapter', ...event }) },
    })
    rows.set(A5_G3_RUN_CODE_TOOL_NAME, Object.freeze({ status: 'ACTIVE', definition, definitionIdentity: identity }))
    definitions.push(definition)
    observe({ event: 'g3-ptc-wire:mounted', name: A5_G3_RUN_CODE_TOOL_NAME, mount: A5_G3_PTC_MOUNT_STATUS })
  }

  // THE MOUNT-MOMENT REGISTRATION (the terminal law verbatim): the key is
  // the placement feed's RUNTIME identity of the PLACED definition, read
  // fresh; THROWS on absent/moved — never a guessed key, never a skip.
  const mountedKeys = new Map()
  const familyRegistrations = () => Object.freeze(definitions.map((definition) => {
    const fed = placementFeed(definition.name)
    const key = isRecord(fed) && typeof fed.definitionIdentity === 'string' && fed.definitionIdentity.length > 0
      ? fed.definitionIdentity
      : null
    if (key === null) {
      throw new Error(`${A5_G3_PTC_WIRING_CODES.PLACEMENT_KEY_ABSENT}: the placed row 'run_code' answered no definition identity through the placement feed — the family registration has no trusted key; a guessed key is forbidden and an unobserved silent skip is the drift the family gate measures`)
    }
    if (boundIdentity !== null && boundIdentity !== key) {
      throw new Error(`${A5_G3_PTC_WIRING_CODES.PLACEMENT_KEY_MOVED}: the placement identity of 'run_code' moved between the mount bind and the registration read (${boundIdentity} -> ${key}) — a placed definition's identity does not float; the mount is broken and re-registers nothing`)
    }
    const seen = mountedKeys.get(definition.name)
    if (seen !== undefined && seen !== key) {
      throw new Error(`${A5_G3_PTC_WIRING_CODES.PLACEMENT_KEY_MOVED}: the placement identity of 'run_code' moved between mount reads (${seen} -> ${key}) — a placed definition's identity does not float; the mount is broken and re-registers nothing`)
    }
    mountedKeys.set(definition.name, key)
    return Object.freeze({
      name: definition.name,
      definitionIdentity: key,
      entry: Object.freeze({
        // the adapter's OWN family bytes — never re-typed here
        familyId: A5_G3_FAMILIES.PTC,
        adapterRevision: A5_G3_PTC_ADAPTER_REVISION,
        providerIdentity: providerId,
      }),
    })
  }))

  const assembly = Object.freeze({
    ok: true,
    familyId: A5_G3_FAMILIES.PTC,
    revision: A5_G3_PTC_WIRING_REVISION,
    adapterRevision: A5_G3_PTC_ADAPTER_REVISION,
    providerId,
    placementNames: Object.freeze(definitions.map((definition) => definition.name)),
    definitions: Object.freeze(definitions),
    rows: Object.freeze(Object.fromEntries([...rows.entries()])),
    declared: Object.freeze(declared),
    rowOf: (name) => rows.get(name),
    drain: () => {
      if (arm !== null) arm.drain()
      return deepFreeze({ event: 'g3-ptc-wire:drain', semantics: 'new-call prohibition only — no resource is settled by this word' })
    },
    familyRegistrations,
  })
  return assembly
}

// ─────────────────────────────────────────────────────────────────────────
// THE GUARD-SEAM ENTRY (root FINAL LIMITED ruling on run_code, 2026-10-25).
// The def-PLACEMENT builder above stays RETIRED and UNMOUNTED (the P1 fact
// stands forever: the host FORBIDS registering or shadowing 'run_code' —
// core/tools/src/index.ts:1080-1081, PR355 §2.3; a placement arm would
// roll back the whole plane). What the ruling WIRES instead is this second
// entry, which never registers, never shadows, and never wraps the body:
//
//   ONE scope-filtered listener on the PUBLIC `tools/pre-execute` waterfall
//   (639 index.ts:153; every dispatch — INCLUDING the reserved native
//   transport, index.ts:1216 — rides the SAME funnel at :1505-1507). The
//   listener matches exactly `exec.name === 'run_code'` AND
//   `exec.agent.id === memberAgentId`; everything else passes through
//   `next()` byte-untouched (zero effect). For a matching call it walks the
//   SAME governed law the retired def used to walk internally — classify →
//   pa.open → pa.edge ONE consume → arm.prepare — and then:
//     · REFUSE  → return the typed decision BEFORE ever calling next():
//       zero body entry, the reserved transport never dispatches;
//     · ALLOW   → return next(): the waterfall continues (the sibling
//       listeners still decide, the terminal answers allow) and the
//       RESERVED NATIVE runs UNTOUCHED — its concurrency
//       (ptc.ts:316-317/:447-452/:495/:660), parent cancellation and drain
//       (:538-555), timeout + sandbox (:697-708 + NodePtcRuntime clamp/
//       wall-timer) and per-child registry rides (:620-624/:687-691) are
//       HOST-side facts this seam never mirrors, replaces, or re-accounts.
//
// The plan record closes when THIS admission walk settles — at whichever
// seat the walk settles in: the pre listener closes refusals and downstream
// non-dispatch exits; the execute listener (the actual body boundary) owns
// every walk that reaches consumption (the grant consumed at the edge is a
// settled fact; the body's fate is the native's own word). TWO scope-
// filtered listeners, zero new scheduling accounts, zero placement, zero
// registration of the reserved name. TIER: WIRED (接线) — 接线未测;
// real-Host acceptance is a later card. ─────────────────────────────────
export const A5_G3_PTC_GUARD_STATUS = Object.freeze({
  entry: 'TWO listeners, public seams only: tools/pre-execute = admission/Ask preparation (classify -> PA open -> the arm RECORDS the grant); tools/execute = THE BODY BOUNDARY (ONE edge consume with placementName + paConstructionBinding forwarded, the REAL liveVerdict recheck, then next() exactly once). Never a registration.',
  timingLaw: 'FINAL TIMING LAW (root 2026-10-25): the pre-execute next() may continue into a downstream Ask — pre is NOT the body entry and never claims body-adjacent safety; the one-consume + liveVerdict + exactly-once next() ride the actual dispatch boundary',
  tier: 'WIRED-NOT-TESTED (root final limited ruling 2026-10-25; 已测试 needs the real-Host acceptance)',
  registrationBan: 'ABSOLUTE — 639 core/tools/src/index.ts:1080-1081 (PR355 §2.3); the reserved native is never registered, shadowed, or wrapped',
  nativeUntouched: 'concurrency ptc.ts:316-317/:447-452/:495/:660; parent cancel :538-555; timeout+sandbox :697-708; sub-calls ride the original registry :620-624/:687-691',
})

export const A5_G3_PTC_GUARD_CODES = Object.freeze({
  INPUT_INVALID: 'RUNCODE_GUARD_INPUT_INVALID',
  IDENTITY_UNBOUND: 'RUNCODE_GUARD_IDENTITY_UNBOUND',
  CALL_ID_ABSENT: 'RUNCODE_GUARD_CALL_ID_ABSENT',
  TOKEN_REPLAY: 'RUNCODE_GUARD_TOKEN_REPLAY',
  NO_ADMISSION: 'RUNCODE_GUARD_NO_ADMISSION',
  CANCELLED: 'RUNCODE_GUARD_CANCELLED',
  DRAINED: 'RUNCODE_GUARD_DRAINED',
  ARM_UNAVAILABLE: 'RUNCODE_GUARD_ARM_UNAVAILABLE',
  KEY_MOVED: 'RUNCODE_GUARD_KEY_MOVED',
})

const refusalToDecision = (refusal) => deepFreeze({
  kind: 'deny',
  reason: `run_code governed refusal ${String(refusal?.code ?? 'REFUSED')} — ${String(refusal?.detail ?? 'refused without detail')}`,
})

export function buildG3RunCodeGuard (input = {}) {
  const knownInput = new Set([
    'realmId', 'providerId', 'memberAgentId', 'sessionHeaderId', 'readNative',
    'ptcFacts', 'bindingFacts', 'identityOf', 'pa', 'observe',
  ])
  for (const key of Object.keys(input)) {
    if (!knownInput.has(key)) {
      return wiringRefuse(A5_G3_PTC_GUARD_CODES.INPUT_INVALID, `unknown input key '${key}' — the guard surface is closed; an unrecognized knob never silently widens the mount`)
    }
  }
  const {
    realmId, providerId, memberAgentId, sessionHeaderId, readNative,
    ptcFacts, bindingFacts, identityOf, pa, observe = () => {},
  } = input
  if (typeof realmId !== 'string' || realmId.length === 0) return wiringRefuse(A5_G3_PTC_GUARD_CODES.INPUT_INVALID, 'realmId is REQUIRED (the realm joins every resource identity)')
  if (typeof providerId !== 'string' || providerId.length === 0) return wiringRefuse(A5_G3_PTC_GUARD_CODES.INPUT_INVALID, 'providerId is REQUIRED (the family entry carries the provider identity verbatim)')
  if (typeof memberAgentId !== 'string' || memberAgentId.length === 0) return wiringRefuse(A5_G3_PTC_GUARD_CODES.INPUT_INVALID, 'memberAgentId is REQUIRED — the listener matches exec.agent.id EXACTLY (the scope face already filters; this is the belt-and-suspenders face), never a name lookup')
  if (typeof sessionHeaderId !== 'string' || sessionHeaderId.length === 0) return wiringRefuse(A5_G3_PTC_GUARD_CODES.INPUT_INVALID, 'sessionHeaderId is REQUIRED — the durable session header (exec.agent.session.header.id) is the ownership leg')
  if (typeof readNative !== 'function') return wiringRefuse(A5_G3_PTC_GUARD_CODES.INPUT_INVALID, "readNative (name) => definition | undefined is REQUIRED — the LIVE member-scoped face (the 85 capture law runs HERE, once; the same face later answers the drift check); a throwing face is honest absence (capture-unreadable), never a fallback")
  if (typeof ptcFacts !== 'function') return wiringRefuse(A5_G3_PTC_GUARD_CODES.INPUT_INVALID, 'ptcFacts () => facts | null is REQUIRED — the LIVE supplier of interpreter/effectiveEnvelope/timeout/childChannel (the ACTUAL budget mapping: absence is honest, a supplied number must be positive finite)')
  if (typeof bindingFacts !== 'function') return wiringRefuse(A5_G3_PTC_GUARD_CODES.INPUT_INVALID, "bindingFacts (toolName) => {bindingId, bindingRevision, policyGeneration, authorityGeneration} is REQUIRED — the CURRENT dispatcher binding of THAT tool's entry, read LIVE")
  if (typeof identityOf !== 'function') return wiringRefuse(A5_G3_PTC_GUARD_CODES.INPUT_INVALID, 'identityOf (definition) => string | null is REQUIRED — the plane definitionIdentityOf seam applied to the CAPTURED RESERVED NATIVE (no placed definition exists; the ledger key is the native identity itself)')
  const paSeatOk = typeof pa === 'function' && typeof pa.open === 'function' && typeof pa.edge === 'function' && typeof pa.closePlan === 'function'
  if (!paSeatOk) {
    return wiringRefuse(A5_G3_PTC_GUARD_CODES.INPUT_INVALID, 'pa is REQUIRED in the REAL published shape — the plane\'s paAdmit: a CALLABLE seat carrying open / edge / closePlan (the P1 item-1 law: a plain-object duck or a memberless function is garbage and refuses)')
  }
  // THE ONE CAPTURE (85 law): exactly one read feeds the arm bind; the face
  // stays LIVE afterwards for the drift check (liveDispatcher re-reads it).
  let captureReads = 0
  let captured
  let captureReason = 'capture-absent'
  try {
    captureReads += 1
    captured = readNative(A5_G3_RUN_CODE_TOOL_NAME)
  } catch (error) {
    captured = undefined
    captureReason = `capture-unreadable (${String(error?.message ?? error).slice(0, 120)})`
  }
  const native = captured === null || captured === undefined ? undefined : captured
  if (native === undefined || !registrationFaceComplete(native)) {
    observe({ event: 'g3-ptc-wire:guard-declared', name: A5_G3_RUN_CODE_TOOL_NAME, reason: native === undefined ? captureReason : 'registration-face-incomplete', mount: A5_G3_PTC_GUARD_STATUS })
    return Object.freeze({
      ok: true,
      kind: 'pre-execute-guard',
      familyId: A5_G3_FAMILIES.PTC,
      providerId,
      armed: false,
      declared: Object.freeze([Object.freeze({ name: A5_G3_RUN_CODE_TOOL_NAME, familyId: A5_G3_FAMILIES.PTC, status: 'DECLARED-INACTIVE', reason: native === undefined ? captureReason : 'registration-face-incomplete' })]),
      onPreExecute: null,
      onExecute: null,
      familyRegistrations: () => Object.freeze([]),
      drain: () => deepFreeze({ event: 'g3-ptc-wire:guard-drain', semantics: 'nothing was armed — the word settles no resource' }),
    })
  }
  const identity = identityOf(native)
  if (typeof identity !== 'string' || identity.length === 0) {
    throw new Error(`${A5_G3_PTC_GUARD_CODES.IDENTITY_UNBOUND}: 'run_code' — the definitionIdentityOf seam answered no identity for the CAPTURED reserved native; the guard cannot bind (a guessed or null identity is forbidden)`)
  }
  const arm = createGovernedRunCodeArm({
    nativeDefinition: native,
    definitionIdentity: identity,
    liveDispatcher: () => {
      // THE LIVE DRIFT FACE: the CURRENT reserved-native definition's
      // identity, read through the SAME member-scoped seam. A moved or
      // unreadable face answers null — the arm's own drift law refuses.
      try {
        const current = readNative(A5_G3_RUN_CODE_TOOL_NAME)
        if (current === null || current === undefined) return null
        const now = identityOf(current)
        return typeof now === 'string' && now.length > 0 ? Object.freeze({ definitionIdentity: now, realmId }) : null
      } catch {
        return null
      }
    },
    providerId,
    memberAgentId,
    sessionHeaderId,
    realmId,
    bindingFacts: () => bindingFacts(A5_G3_RUN_CODE_TOOL_NAME),
    ptcFacts,
    observe: (event) => { observe({ source: 'g3-ptc-adapter', ...event }) },
  })
  let drained = false
  const tokenLedger = new Map()
  const inFlightCalls = new Set()
  // THE TWO-STAGE SHAPE (root FINAL TIMING ruling 2026-10-25, D1/D2): the
  // pre-execute next() may continue into a DOWNSTREAM Ask — pre is NOT the
  // final body entry, and consuming there would claim an
  // "immediately-before-body" safety the seam does not offer. So PRE keeps
  // only the necessary admission/Ask preparation (classify -> PA open ->
  // the arm records the kernel grant); the admitted walk waits HERE for
  // the ACTUAL body boundary — the public `tools/execute` waterfall — where
  // the ONE edge consume, the REAL liveVerdict traversal and the exactly
  // once called next() all live. A grant is one-shot and callId-bound; the
  // token ledger and the one-shot pending map keep any replay impossible
  // while a walk waits.
  const pendingWalks = new Map()
  /** The body-boundary refusal is a FAILURE RESULT, not a decision: at
   *  `tools/execute` the waterfall answers ToolExecutionResult, and never
   *  calling next() IS the zero-body-entry (the reserved native transport
   *  is not dispatched). The typed code travels in the error word. */
  const failureResult = (refusal) => deepFreeze({
    isError: true,
    error: { message: `run_code governed refusal ${String(refusal?.code ?? 'REFUSED')} — ${String(refusal?.detail ?? 'refused at the body boundary')}` },
    content: [{ type: 'text', text: `run_code refused by the A5 governed guard: ${String(refusal?.code ?? 'REFUSED')}` }],
  })
  const onPreExecute = async (exec, next) => {
    if (!isRecord(exec) || exec.name !== A5_G3_RUN_CODE_TOOL_NAME) return next()
    const agent = exec.agent
    if (!isRecord(agent) || agent.id !== memberAgentId) return next()
    if (drained) {
      observe({ event: 'g3-ptc-wire:guard-deny', name: A5_G3_RUN_CODE_TOOL_NAME, code: A5_G3_PTC_GUARD_CODES.DRAINED })
      return refusalToDecision({ code: A5_G3_PTC_GUARD_CODES.DRAINED, detail: 'the guard was drained — new run_code calls refuse TYPED; nothing runs unadmitted and the reserved native is never reached' })
    }
    const callId = typeof exec.callId === 'string' && exec.callId.length > 0 ? exec.callId : null
    if (callId === null) {
      return refusalToDecision({ code: A5_G3_PTC_GUARD_CODES.CALL_ID_ABSENT, detail: 'the execution answered no ISSUED call identity — the PA walk has no single-flight key; a guessed correlation is forbidden (zero body entry)' })
    }
    const rawToken = exec.token
    const tokenKey = (rawToken !== null && typeof rawToken === 'object') || typeof rawToken === 'symbol' ? rawToken : undefined
    if (tokenKey !== undefined && tokenLedger.has(tokenKey)) {
      observe({ event: 'g3-ptc-wire:guard-deny', name: A5_G3_RUN_CODE_TOOL_NAME, code: A5_G3_PTC_GUARD_CODES.TOKEN_REPLAY })
      return refusalToDecision({ code: A5_G3_PTC_GUARD_CODES.TOKEN_REPLAY, detail: 'one governed walk per execution token — a replayed token never opens a second admission walk (zero body entry)' })
    }
    if (tokenKey !== undefined) tokenLedger.set(tokenKey, callId)
    if (inFlightCalls.has(callId)) {
      return refusalToDecision({ code: A5_G3_PTC_GUARD_CODES.TOKEN_REPLAY, detail: `call ${callId} already carries an in-flight admission walk — one walk per issued call identity` })
    }
    inFlightCalls.add(callId)
    const signal = exec.signal
    try {
      if (isRecord(signal) && signal.aborted === true) {
        return deepFreeze({ kind: 'cancel' })
      }
      const classified = arm.classify(exec.arguments, exec, callId)
      if (classified.ok !== true) {
        observe({ event: 'g3-ptc-wire:guard-classify-REFUSED', name: A5_G3_RUN_CODE_TOOL_NAME, code: classified.code })
        return refusalToDecision(classified)
      }
      const parsedEffects = parseRequestedEffectSet(classified.effects)
      if (parsedEffects.ok !== true) {
        return refusalToDecision(wiringRefuse(A5_G3_PTC_WIRING_CODES.EFFECTS_UNPARSABLE, `run_code: the arm's effect set is not the frozen closed vocabulary (${String(parsedEffects.problems?.[0]?.detail ?? 'parse refused')}) (zero body entry)`))
      }
      const payload = classified.reviewPayload
      const walk = Object.freeze({
        realmId,
        callId,
        parametersFingerprint: classified.parametersFingerprint,
        requestedEffects: parsedEffects.value,
        toolName: A5_G3_RUN_CODE_TOOL_NAME,
        family: Object.freeze({
          familyId: payload.familyId,
          adapterRevision: payload.adapterRevision,
          providerIdentity: payload.providerIdentity,
          targetManifest: a5G3PtcPaTargetFlat(payload.targetManifest),
        }),
        ...(signal === undefined ? {} : { signal }),
      })
      const opened = await pa.open(walk)
      // The open was ATTEMPTED: whatever the kernel answered, its plan
      // record for this callId is closed HERE unless the walk parks
      // admitted for the body boundary (the plane finally law carried).
      const closeAfterOpen = () => {
        try { pa.closePlan(callId) } catch { /* the close word never masks a decision */ }
      }
      if (opened?.cancelled === true) {
        closeAfterOpen()
        return refusalToDecision(wiringRefuse(A5_G3_PTC_WIRING_CODES.ADMISSION_CANCELLED, 'run_code: cancelled at the PA open edge before admission — zero body entry'))
      }
      if (opened?.kind === 'deny') {
        closeAfterOpen()
        return refusalToDecision(opened)
      }
      if (opened?.kind !== 'approved' || opened.grant === undefined || opened.grant === null) {
        closeAfterOpen()
        return refusalToDecision(wiringRefuse(A5_G3_PTC_WIRING_CODES.APPROVAL_NOT_LANDED, `run_code: the admission answered ${String(opened?.kind ?? 'unsettled')} without a landed grant — internal state never substitutes for the kernel answer (zero body entry)`))
      }
      // THE ADMISSION RECORD (pre-stage, D1 law): the arm records the kernel
      // grant the open answered — PREPARED, NOT consumed. The consumption
      // and the live-source re-verification belong to the body boundary.
      const prepared = arm.prepare(classified.plan, opened.grant)
      if (prepared?.ok !== true) {
        observe({ event: 'g3-ptc-wire:guard-prepare-REFUSED', name: A5_G3_RUN_CODE_TOOL_NAME, code: prepared?.code })
        try { pa.closePlan(callId) } catch { /* the close word never masks a decision */ }
        return refusalToDecision(isRecord(prepared) && typeof prepared.code === 'string'
          ? prepared
          : wiringRefuse(A5_G3_PTC_WIRING_CODES.PREPARE_REFUSED, 'run_code: the arm refused to record the kernel grant — zero body entry'))
      }
      pendingWalks.set(callId, Object.freeze({
        plan: classified.plan,
        walk,
        grant: opened.grant,
        opened,
        ...(signal === undefined ? {} : { signal }),
      }))
      // PRE-ADMISSION PASSED: hand the call to the downstream chain —
      // sibling listeners and the human Ask still stand between here and
      // the dispatch. The decision travels VERBATIM; nothing here claims a
      // body-entry safety this seat cannot offer.
      const decision = await next()
      if (decision?.kind !== 'allow' && decision?.kind !== 'ask') {
        // Downstream refused/cancelled BEFORE dispatch: tools/execute will
        // never fire for this call, so this listener settles the walk —
        // the arm entry cancels, the kernel plan record closes, zero body.
        pendingWalks.delete(callId)
        arm.cancel(classified.plan)
        try { pa.closePlan(callId) } catch { /* the close word never masks a decision */ }
      }
      // 'ask': the walk (and its one-shot, callId-bound grant) waits for
      // the ACTUAL boundary. If the human allows, tools/execute consumes;
      // if the human refuses, the kernel's own row lifecycle answers — the
      // pre seat never re-presents an unconsumed grant (the token ledger
      // and the one-shot pending map keep any replay impossible).
      observe({ event: decision?.kind === 'allow' ? 'g3-ptc-wire:guard-admitted' : 'g3-ptc-wire:guard-downstream', name: A5_G3_RUN_CODE_TOOL_NAME, callId, kind: String(decision?.kind ?? 'unsettled') })
      return decision
    } finally {
      // The in-flight marker stands from the open until the walk settles —
      // released HERE only when the walk did NOT park pending for the body
      // boundary (refusals and settled non-dispatch exits).
      if (!pendingWalks.has(callId)) inFlightCalls.delete(callId)
    }
  }
  const onExecute = async (exec, next) => {
    // THE BODY BOUNDARY (the public `tools/execute` waterfall): the ONE
    // edge consume, the REAL liveVerdict traversal and the exactly once
    // called next() — the transport dispatches the reserved native with
    // the ORIGINAL exec (identity/signal fused by the registry), and the
    // sub-tool chain rides the original registry untouched.
    if (!isRecord(exec) || exec.name !== A5_G3_RUN_CODE_TOOL_NAME) return next()
    const agent = exec.agent
    if (!isRecord(agent) || agent.id !== memberAgentId) return next()
    const callId = typeof exec.callId === 'string' && exec.callId.length > 0 ? exec.callId : null
    const pending = callId === null ? undefined : pendingWalks.get(callId)
    if (pending === undefined) {
      // FAIL-CLOSED at the boundary: a run_code dispatch WITHOUT an
      // admitted walk (drift, replay, or a dispatch that skipped the pre
      // stage) never touches the body.
      observe({ event: 'g3-ptc-wire:guard-boundary-REFUSED', name: A5_G3_RUN_CODE_TOOL_NAME, code: A5_G3_PTC_GUARD_CODES.NO_ADMISSION, callId: String(callId ?? 'absent') })
      return failureResult({ code: A5_G3_PTC_GUARD_CODES.NO_ADMISSION, detail: 'a run_code dispatch reached the body boundary without an admitted PA walk — the reserved native is not dispatched (zero body entry)' })
    }
    pendingWalks.delete(callId)
    const { plan, walk, opened } = pending
    const signal = isRecord(exec.signal) ? exec.signal : pending.signal
    try {
      if (drained) {
        arm.cancel(plan)
        return failureResult({ code: A5_G3_PTC_GUARD_CODES.DRAINED, detail: 'the guard drained between admission and the body boundary — the admitted walk is cancelled, the reserved native never runs' })
      }
      if (isRecord(signal) && signal.aborted === true) {
        arm.cancel(plan)
        return failureResult({ code: A5_G3_PTC_GUARD_CODES.CANCELLED, detail: 'cancelled before the body boundary — zero body is the truth, not a race' })
      }
      const edge = await pa.edge(Object.freeze({
        ...walk,
        grant: pending.grant,
        ...(opened.paDurableMint === undefined ? {} : { paDurableMint: opened.paDurableMint }),
        ...(opened.request === undefined ? {} : { request: opened.request }),
        // D2 (root narrow review 2026-10-25): the REAL PA edge evaluates
        // its conditional placement/construction-binding validation
        // (plane :2290) ONLY when these fields arrive — omitting them
        // SKIPS the drift law. They pass through EXACTLY as the open
        // answered them; the guard never re-derives or invents either.
        ...(opened.placementName === undefined ? {} : { placementName: opened.placementName }),
        ...(opened.paConstructionBinding === undefined ? {} : { paConstructionBinding: opened.paConstructionBinding }),
      }))
      if (edge?.cancelled === true) {
        arm.cancel(plan)
        return failureResult(wiringRefuse(A5_G3_PTC_WIRING_CODES.EDGE_CANCELLED, 'run_code: cancelled at the execution edge — the approval stays unspent and is never replayed; zero body entry'))
      }
      if (edge?.kind === 'deny') return failureResult(edge)
      const proof = edge?.consumedProof
      if (!isRecord(proof) || !isRecord(proof.grant) || typeof proof.grant.grantId !== 'string') {
        return failureResult(wiringRefuse(A5_G3_PTC_WIRING_CODES.CONSUME_PROOF_MISSING, 'run_code: the execution edge answered allow without its one-shot consume witness — the row never substitutes a self-attested consumption; the reserved native was NOT dispatched (zero body entry)'))
      }
      // D1 AT THE REAL BOUNDARY: the EXISTING liveVerdict machinery (the
      // CURRENT binding facts, the live dispatcher's definition identity,
      // the captured function value, the family's service target facts)
      // re-traversed HERE — drift during the whole admit-wait window,
      // including the downstream Ask, refuses with zero body entry.
      const cleared = await arm.recheckAtEntry(plan, { consumed: true, grant: proof.grant })
      if (cleared?.ok !== true) {
        observe({ event: 'g3-ptc-wire:guard-boundary-REFUSED', name: A5_G3_RUN_CODE_TOOL_NAME, code: cleared?.code, callId })
        return failureResult(cleared)
      }
      // ONE CONSUME spent, the entry EXECUTING: the transport's next()
      // dispatches the RESERVED NATIVE. The result travels VERBATIM — a
      // native error result is the native's own word, never re-wrapped.
      const result = await next()
      arm.settleEntry(plan, result?.isError !== true, result?.isError === true ? 'transport-error-result' : 'transport-ok')
      observe({ event: 'g3-ptc-wire:guard-body-settled', name: A5_G3_RUN_CODE_TOOL_NAME, callId, isError: result?.isError === true })
      return result
    } catch (error) {
      // A throw at the boundary never settles as success: close the arm's
      // account with the error's word and rethrow — the funnel owns the
      // error result; the body already ran (or did not) by the transport's
      // own truth.
      arm.settleEntry(plan, false, `boundary-threw: ${String(error?.message ?? error).slice(0, 160)}`)
      throw error
    } finally {
      // THE PLAN CLOSE moves WITH the walk: this listener owns the kernel
      // plan record once the boundary is reached — closed on EVERY exit.
      inFlightCalls.delete(callId)
      try { pa.closePlan(callId) } catch { /* the close word never masks a decision */ }
    }
  }
  const assembly = Object.freeze({
    ok: true,
    kind: 'two-stage-guard',
    familyId: A5_G3_FAMILIES.PTC,
    revision: A5_G3_PTC_WIRING_REVISION,
    adapterRevision: arm.adapterRevision,
    providerId,
    armed: true,
    declared: Object.freeze([]),
    onPreExecute,
    onExecute,
    familyRegistrations: () => {
      // The ledger key is the CURRENT reserved-native identity through the
      // SAME seam; a MOVED identity throws (identities do not float).
      let now = identity
      try {
        const current = readNative(A5_G3_RUN_CODE_TOOL_NAME)
        if (current !== null && current !== undefined) {
          const fresh = identityOf(current)
          if (typeof fresh === 'string' && fresh.length > 0) now = fresh
        }
      } catch {
        throw new Error(`${A5_G3_PTC_GUARD_CODES.KEY_MOVED}: the reserved-native face is unreadable at the registration moment — a guessed key is forbidden and a silent skip is the drift the family gate measures`)
      }
      if (now !== identity) {
        throw new Error(`${A5_G3_PTC_GUARD_CODES.KEY_MOVED}: the reserved-native identity moved between capture and the registration read (${identity} -> ${now}) — the mount is broken and re-registers nothing`)
      }
      return Object.freeze([Object.freeze({
        name: A5_G3_RUN_CODE_TOOL_NAME,
        definitionIdentity: identity,
        entry: Object.freeze({
          familyId: A5_G3_FAMILIES.PTC,
          // the arm's OWN family bytes (D4 pairing: descriptor/registration/
          // claim carry the SAME value — the B-PTC row rides its own 4)
          adapterRevision: arm.adapterRevision,
          providerIdentity: providerId,
        }),
      })])
    },
    drain: () => {
      drained = true
      // Admitted-but-unconsumed walks cannot stay parked open: each one's
      // arm entry cancels and its kernel plan record closes. The word is
      // still a NEW-CALL PROHIBITION only — no running resource settles.
      for (const parkedCallId of [...pendingWalks.keys()]) {
        const parked = pendingWalks.get(parkedCallId)
        pendingWalks.delete(parkedCallId)
        inFlightCalls.delete(parkedCallId)
        try { arm.cancel(parked.plan) } catch { /* cancel is a word, not a kill */ }
        try { pa.closePlan(parkedCallId) } catch { /* the close word never masks a decision */ }
      }
      if (arm !== null) { arm.drain() }
      return deepFreeze({ event: 'g3-ptc-wire:guard-drain', semantics: 'new-call prohibition only — no resource is settled by this word' })
    },
    mount: A5_G3_PTC_GUARD_STATUS,
    captureReadsAtBuild: captureReads,
  })
  observe({ event: 'g3-ptc-wire:guard-mounted', name: A5_G3_RUN_CODE_TOOL_NAME, identity, mount: A5_G3_PTC_GUARD_STATUS })
  return assembly
}
