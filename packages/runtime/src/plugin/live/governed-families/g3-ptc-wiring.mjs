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
 */
import { parseRequestedEffectSet } from '../../../../../domain/tool-governance/src/index.js'
import {
  A5_G3_ADAPTER_REVISION,
  A5_G3_FAMILIES,
  createGovernedRunCodeArm,
} from './g3-fsproc-adapters.mjs'

export const A5_G3_PTC_WIRING_REVISION = 1

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
    maxParallelSubCalls: channel.maxParallelSubCalls,
    runDispatchBudget: channel.runDispatchBudget,
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
  const paSeatOk = isRecord(pa) && typeof pa.open === 'function' && typeof pa.edge === 'function' && typeof pa.closePlan === 'function'
  if (!paSeatOk) {
    return wiringRefuse(A5_G3_PTC_WIRING_CODES.INPUT_INVALID, 'pa is REQUIRED in its published shape — the plane\'s paAdmit face (callable or plain object) with open / edge / closePlan methods; with no admission seat no governed call may enter the body — never a duck, never input.admit{ok:true}')
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
    observe({ event: 'g3-ptc-wire:declared', name: A5_G3_RUN_CODE_TOOL_NAME, reason: native === undefined ? 'capture-absent' : 'registration-face-incomplete' })
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
    observe({ event: 'g3-ptc-wire:mounted', name: A5_G3_RUN_CODE_TOOL_NAME })
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
        adapterRevision: A5_G3_ADAPTER_REVISION,
        providerIdentity: providerId,
      }),
    })
  }))

  const assembly = Object.freeze({
    ok: true,
    familyId: A5_G3_FAMILIES.PTC,
    revision: A5_G3_PTC_WIRING_REVISION,
    adapterRevision: A5_G3_ADAPTER_REVISION,
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
