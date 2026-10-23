/**
 * governed-families/subagent-spawn-wiring.mjs — A5M2 B-SUBAGENT SPAWN-SIDE
 * PRODUCTION WIRING (root-approved isolated multi-writer, 21:0x round): the
 * mount-side seat that connects the PURE adapter module
 * (./subagent-spawn-adapters.mjs, records 39-43, DELEGATION mode, reviewed
 * @ f165faa3a) to the ONE real PA walk and the ONE placement feed the plane
 * already owns. This file adds NO row law: it imports exactly ONE project
 * module and supplies the two production seams the adapter module declares
 * but never implements —
 *
 *  1. THE ADMIT SEAT → THE PLANE'S PA WALK. Every placed spawn call awaits
 *     `admit` before the captured body runs (the adapter's L10); here that
 *     seat calls the plane's OWN `paAdmit` (team-tool-plane paAdmitPartA →
 *     paAdmitEdge, the ONE funnel every governed production call passes)
 *     with the REAL public 639 call identity (`exec.callId` — a missing one
 *     fails closed typed, this wiring synthesizes no correlation), the
 *     closed effect envelope `[{kind:'tool-invoke', toolName, resource:
 *     null}]` (the exact vocabulary todo.mjs :233 carries), the plan's OWN
 *     `parametersFingerprint` (never recomputed here), and the family
 *     P-adds {familyId, adapterRevision, providerIdentity, targetManifest:
 *     plan.target} that pa-control-bridge.ts demands of a BOUND family
 *     (`family-review-facts-incomplete` denies a partial carrier BEFORE the
 *     durable row — the same bytes the registration table answers with).
 *     ANSWER MAPPING (no rewriting of PA's verdicts): the REAL protocol —
 *     `kind:'allow'` WITH the kernel's one-shot `consumedProof` admits (the
 *     witness is DEMANDED: a bare allow is refusing, not self-attesting →
 *     ADMIT_PROOF_ABSENT); PA's own `allow+cancelled` (already-aborted call,
 *     zero backend) → typed CALL_CANCELLED refusal; `deny` travels with PA's
 *     OWN code/detail bytes; anything unrecognizable fails closed. The
 *     wiring CATCHES NOTHING: a throwing paAdmit propagates verbatim,
 *     exactly as the adapter's no-catch law demands.
 *  2. THE PLACEMENT FEED → PASSED THROUGH. `familyRegistrations()` (the
 *     adapter's mount-moment registration) reads the plane's `placementFeed`
 *     — the lazy `def#N` identities the public install pass mints for the
 *     PLACED definitions — AFTER publish; ABSENT/MOVED keys throw through
 *     the adapter's own codes. This file never builds a key.
 *
 * THE PLACED DEFINITIONS ARE THE ADAPTER'S (which spread the CAPTURED
 * native complete and replace ONLY execute — root 8b4 law); the team-tool-
 * plane spawn block merges `wiring.definitions` into `allDefs` under the
 * zero-flip law so the placement feed, the Guard bindingFeed and the
 * family registration all cover them through the SAME machinery every
 * other row rides. NO unadmitted path exists: `paAdmit`, `realmId` and
 * `placementFeed` are REQUIRED at assembly; a mount missing any one is
 * refused here, not demoted.
 *
 * HONEST BOUNDARY: this is the WIRING layer, not C2. The named gaps of the
 * adapter module (pre-spawn CENTER closed world, per-call provider/target
 * adjudication, provider envelope, fork seed, model-route freshness, plan-
 * once) are unchanged by wiring; the real driver capabilities behind
 * subagent_codex / subagent_claude_code and the CENTER child-factory stay
 * open obligations. Doubles answered the services in the specs; no Host.
 *
 * @module @dsh-agent-team/runtime/plugin/live/governed-families/subagent-spawn-wiring
 */
import {
  A5_B_SUBAGENT_SPAWN_ADAPTER_REVISION,
  A5_B_SUBAGENT_SPAWN_FAMILY_ID,
  A5_B_SUBAGENT_SPAWN_TOOL_NAMES,
  createSubagentSpawnAdapterAssembly,
} from './subagent-spawn-adapters.mjs'

export const A5_B_SPAWN_WIRING_REVISION = 1

/** Typed codes OWNED by this wiring layer (P_B_SPAWN_WIRE_*). The ADAPTER's
 *  refusals keep their own P_B_SPAWN_* codes verbatim; PA verdict codes
 *  travel as PA's own bytes — never rewritten into this namespace. */
export const A5_B_SPAWN_WIRING_CODES = Object.freeze({
  INPUT_INVALID: 'P_B_SPAWN_WIRE_INPUT_INVALID',
  ADMISSION_ABSENT: 'P_B_SPAWN_WIRE_ADMISSION_ABSENT',
  CALL_IDENTITY_ABSENT: 'P_B_SPAWN_WIRE_CALL_IDENTITY_ABSENT',
  CALL_CANCELLED: 'P_B_SPAWN_WIRE_CALL_CANCELLED',
  ADMIT_PROOF_ABSENT: 'P_B_SPAWN_WIRE_ADMIT_PROOF_ABSENT',
  PA_ANSWER_UNRECOGNIZED: 'P_B_SPAWN_WIRE_PA_ANSWER_UNRECOGNIZED',
})

const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)
const deepFreeze = (value) => {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child)
    Object.freeze(value)
  }
  return value
}
const refuseAssembly = (code, message) => deepFreeze({ ok: false, code, message })

/**
 * Production wiring factory for the B-SUBAGENT spawn-side subset.
 *
 * @param input {{
 *   providerId?: string,                                    // registration providerIdentity
 *   realmId: string,                                        // THIS plane's realm (PA pairing key)
 *   captured: Record<string, { native: object, definitionIdentity: string }>,
 *       // COMPLETE captured natives (capture seam owns the shape; the
 *       // adapter re-verifies it) — identity feeds the family review P-adds
 *   liveNative: (name: string) => unknown,                  // member-scoped CURRENT read (drift law)
 *   spawnDelegates: Record<string, Function>,               // {name -> captured native execute}
 *   liveSpawnDelegates: () => Record<string, Function>,     // CURRENT delegates object (verified-handle law)
 *   placementFeed: (name: string) => { definitionIdentity?: string, realmId?: string } | undefined,
 *       // the PLANE's own feed (team-tool-plane placementFeed) — passed through untouched
 *   paAdmit: (req: object) => Promise<unknown>,             // the PLANE's own paAdmit (Part A + execution edge)
 *   observe?: (row: unknown) => void,
 * }} input
 */
export function createSubagentSpawnWiring(input = {}) {
  if (!isRecord(input)) return refuseAssembly(A5_B_SPAWN_WIRING_CODES.INPUT_INVALID, 'the wiring factory takes one input record')
  if (typeof input.placementFeed !== 'function') {
    return refuseAssembly(A5_B_SPAWN_WIRING_CODES.INPUT_INVALID, 'placementFeed is REQUIRED and is the PLANE\'S OWN feed (the lazy def#N identities the install pass mints for the placed rows) — this wiring never builds a registration key')
  }
  if (typeof input.paAdmit !== 'function') {
    return refuseAssembly(A5_B_SPAWN_WIRING_CODES.ADMISSION_ABSENT, 'paAdmit is REQUIRED — the adapter ships no unadmitted path, and this wiring connects its admit seat to the ONE plane PA walk (paAdmitPartA → paAdmitEdge); a mount without it is refused at assembly, never mounted open')
  }
  if (typeof input.realmId !== 'string' || input.realmId.length === 0) {
    return refuseAssembly(A5_B_SPAWN_WIRING_CODES.INPUT_INVALID, 'realmId (the plane realm the PA walk pairs against) is REQUIRED as a non-empty string')
  }
  if (!isRecord(input.captured)) {
    return refuseAssembly(A5_B_SPAWN_WIRING_CODES.INPUT_INVALID, 'captured {name -> {native, definitionIdentity}} is REQUIRED — the family review P-adds carry the captured definition identity of THIS row')
  }
  const capturedIdentities = new Map(Object.entries(input.captured).map(([name, capture]) => [name, isRecord(capture) ? capture.definitionIdentity : undefined]))

  // THE ADMIT SEAT → THE PLANE'S PA WALK (the module's ONE added function).
  const admit = async ({ name, familyId, classified, exec }) => {
    const plan = isRecord(classified) && classified.ok === true && isRecord(classified.plan) ? classified.plan : null
    if (plan === null) {
      return deepFreeze({ ok: false, code: A5_B_SPAWN_WIRING_CODES.PA_ANSWER_UNRECOGNIZED, detail: `the adapter handed the admit seat an unclassified call ('${String(name)}') — no PA walk is opened for a call with no plan` })
    }
    // THE PUBLIC 639 CALL IDENTITY: `exec.callId` is the public call-level
    // correlation (ToolExecution at the pin = token/callId/rootCallId/signal/
    // agent) the whole PA walk keys on. A missing one is a broken execution
    // surface: fail closed typed, never a synthesized correlation.
    const callId = typeof exec?.callId === 'string' && exec.callId.length > 0 ? exec.callId : null
    if (callId === null) {
      return deepFreeze({ ok: false, code: A5_B_SPAWN_WIRING_CODES.CALL_IDENTITY_ABSENT, detail: `'${String(name)}' carries no public exec.callId — the PA walk keys the durable row, the grant and the consumed witness on the public call identity; this wiring fabricates none` })
    }
    // The CLOSED effect envelope vocabulary (todo.mjs :233 verbatim shape).
    const requestedEffects = deepFreeze({ effects: [{ kind: 'tool-invoke', toolName: String(name), resource: null }] })
    const definitionIdentity = capturedIdentities.get(name)
    // THE TYPED TARGET, PA-PROJECTED (root 20:41 fix 3): the family's
    // PA_FAMILY_TARGET_RULES['B-SUBAGENT'] entry (control/types.ts) pairs
    // field-for-field with the adapter's typed plan target; the durable
    // schema wants the FLAT lossless string view the closed kinds carry —
    // the nested `child` pair travels as childClaim/childAdjudication, and
    // the target's constant `child.claim: null` (the child identity is
    // minted by the SERVICE, never claimed at this seam) encodes as the
    // sentinel below. Nothing is dropped or re-spelled: every adapter
    // target fact names exactly one manifest field, losslessly.
    const target = plan.target
    const targetManifest = deepFreeze({
      operation: String(plan.operation),
      contract: String(target.contract),
      parent: String(target.parent),
      childClaim: target.child.claim === null
        ? 'service-mints-child-identity (claim not carried at this seam)'
        : String(target.child.claim),
      childAdjudication: String(target.child.adjudication),
      action: String(target.action),
      revision: String(target.revision),
      effect: String(target.effect),
      model: String(target.model),
      depth: String(target.depth),
    })
    const family = deepFreeze({
      familyId: typeof familyId === 'string' && familyId.length > 0 ? familyId : A5_B_SUBAGENT_SPAWN_FAMILY_ID,
      adapterRevision: A5_B_SUBAGENT_SPAWN_ADAPTER_REVISION,
      providerIdentity: typeof input.providerId === 'string' && input.providerId.length > 0 ? input.providerId : 'b-subagent-spawn',
      definitionIdentity,
      targetManifest,
    })
    // NO catch: the plane walk's own throws are the call's throws (adapter L6).
    const answer = await input.paAdmit({
      realmId: input.realmId,
      callId,
      parametersFingerprint: plan.parametersFingerprint, // the adapter plan's OWN digest — never recomputed
      requestedEffects,
      toolName: String(name),
      ...(isRecord(exec) && typeof exec.signal === 'object' && exec.signal !== null ? { signal: exec.signal } : {}),
      family,
    })
    // THE REAL ANSWER PROTOCOL (root 20:41 fix 2): the plane's walk answers
    // `{kind:'allow', consumedProof}` on the consumption-success branch
    // (team-tool-plane :1695-1697 — the kernel's one-shot witness rides
    // additively), `{kind:'allow'}` on the non-witness branch, its own
    // `{kind:'allow', cancelled:true}` for a dead invocation, and
    // `{kind:'deny', code, detail}`. `ok:true` is NOT the protocol —
    // accepting it left a REAL consumed call landing as unrecognized
    // AFTER the spend. The witness is DEMANDED (the plane's own law: "a
    // row that proceeds without the proof is refusing, not self-attesting").
    if (answer?.kind === 'allow' && answer.cancelled === true) {
      // PA's OWN zero-backend answer for an already-cancelled invocation.
      return deepFreeze({ ok: false, code: A5_B_SPAWN_WIRING_CODES.CALL_CANCELLED, detail: `PA answered this '${String(name)}' call CANCELLED at the governance edge (zero backend, zero consume) — the captured spawn body is never entered for a dead invocation` })
    }
    if (answer?.kind === 'allow') {
      const proof = answer.consumedProof
      const proofPresent = (typeof proof === 'object' && proof !== null) || (typeof proof === 'string' && proof.length > 0)
      if (proofPresent !== true) {
        return deepFreeze({ ok: false, code: A5_B_SPAWN_WIRING_CODES.ADMIT_PROOF_ABSENT, detail: `PA answered 'allow' for '${String(name)}' WITHOUT the kernel's one-shot consume witness — a governed spawn row proceeding on a bare allow would be self-attesting; refused with zero native entry` })
      }
      return deepFreeze({ ok: true, callId, consumedProof: proof })
    }
    if (answer?.kind === 'deny') {
      // PA's verdict travels with PA's OWN bytes (never re-coded here).
      const denyCode = typeof answer.code === 'string' && answer.code.length > 0 ? answer.code : 'PA_DENIED'
      const denyDetail = typeof answer.detail === 'string' && answer.detail.length > 0
        ? answer.detail
        : `the PA walk denied this '${String(name)}' call without a detail — fail closed with zero native entry`
      return deepFreeze({ ok: false, code: denyCode, detail: denyDetail })
    }
    return deepFreeze({
      ok: false,
      code: A5_B_SPAWN_WIRING_CODES.PA_ANSWER_UNRECOGNIZED,
      detail: `the PA walk answered this '${String(name)}' call with no recognizable verdict (kind=${String(answer?.kind ?? 'none')}) — fail closed with zero native entry`,
    })
  }

  const assembly = createSubagentSpawnAdapterAssembly({
    providerId: input.providerId,
    captured: input.captured,
    liveNative: input.liveNative,
    spawnDelegates: input.spawnDelegates,
    liveSpawnDelegates: input.liveSpawnDelegates,
    placementFeed: input.placementFeed,
    admit,
    observe: input.observe,
  })
  if (assembly?.ok !== true) return assembly

  return deepFreeze({
    ok: true,
    wiring: {
      familyId: A5_B_SUBAGENT_SPAWN_FAMILY_ID,
      adapterRevision: A5_B_SUBAGENT_SPAWN_ADAPTER_REVISION,
      wiringRevision: A5_B_SPAWN_WIRING_REVISION,
      providerId: assembly.providerId,
      realmId: input.realmId,
      mountNames: A5_B_SUBAGENT_SPAWN_TOOL_NAMES,
      definitions: assembly.definitions,
      declared: assembly.declared,
      rowOf: assembly.rowOf,
      drain: assembly.drain,
      inFlight: assembly.inFlight,
      familyRegistrations: assembly.familyRegistrations,
      wiringCodes: A5_B_SPAWN_WIRING_CODES,
      namedGaps: assembly.namedGaps,
    },
  })
}
