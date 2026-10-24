/**
 * governed-families/job-wiring.mjs — the B-JOB governed CALL bridge: one real
 * PA walk per management call over the frozen plan (open → one-shot
 * consumedProof; a boolean is never a witness), then the LANDED jobs bridge
 * body through the VERIFIED handle only. The walk shape is the plane's frozen
 * law ({realmId, callId, parametersFingerprint, requestedEffects, toolName,
 * family:{familyId, adapterRevision, providerIdentity, targetManifest}} — the
 * B-SUBAGENT walk law verbatim); the requestedEffects face is the G1 baseline
 * `tool-invoke` (effects.ts closed grammar) — the FC-JOB census names are the
 * family's CENSUS effects and ride the targetManifest as the S-side record,
 * never as an invented PA kind (pwsh law).
 *
 * ROOT 22:02 REVISION CONSISTENCY HOLDS FROM FOUNDATION: the PA family block
 * AND the registration face BOTH stamp A5_B_JOB_WIRING_REVISION — the ONE
 * family-claim revision the real path mints with — so stale claims REFUSE at
 * the registry's one-identity law and are never silently translated; the
 * frozen adapter's own capture/classification revision stays its reported
 * fact on the surface (adapterRevision: 1), two honest facts never conflated.
 *
 * REFUSAL TRANSPORT LAW (zero-flip): this seat answers the jobs rows' EXISTING
 * closed { text: 'refused: CODE — detail' } envelope — no throw, no new error
 * surface; the P_JOB_* code NAMES are the visible delta (disclosed here, and
 * the detail passes the funnel's own bytes UNTOUCHED when it has any).
 *
 * tier 接线未测: this landing is adapter+wiring; the real-plane injection +
 * agent-bindings family registration is the paired follow-up slice.
 */

import { parseRequestedEffectSet } from '../../../../../domain/tool-governance/src/index.js'
import {
  A5_B_JOB_FAMILY_ID,
  A5_B_JOB_ADAPTER_REVISION,
  A5_B_JOB_RECORD_SPECS,
  createBJobGovernedAssembly,
} from './job-adapters.mjs'

// FOUNDING REVISION 1 (root M0 unowned-row assignment via the CENTER
// whole-family card; FP-E +1 reported before building): the ONE family-claim
// revision the real path carries — the PA family block and the registration
// face BOTH stamp this number (22:02 consistency law from day one). A VISIBLE
// bump accompanies every mint-encoding change; an approved revision is never
// silently retranslated.
export const A5_B_JOB_WIRING_REVISION = 1

export const A5_B_JOB_WIRING_CODES = Object.freeze({
  INPUT_INVALID: 'P_JOB_WIRE_INPUT_INVALID',
  CALLER_ABSENT: 'P_JOB_WIRE_CALLER_ABSENT',
  CALL_ID_ABSENT: 'P_JOB_WIRE_CALL_ID_ABSENT',
  REALM_ABSENT: 'P_JOB_WIRE_REALM_ABSENT',
  EFFECTS_UNPARSABLE: 'P_JOB_WIRE_EFFECTS_UNPARSABLE',
  CANCELLED: 'P_JOB_WIRE_CANCELLED',
  DISPOSED: 'P_JOB_WIRE_DISPOSED',
  PA_FAULT: 'P_JOB_WIRE_PA_FAULT',
  PA_REFUSED: 'P_JOB_WIRE_PA_REFUSED',
  PROOF_ABSENT: 'P_JOB_WIRE_PROOF_ABSENT',
  // NO BRIDGE_DRIFT code here on purpose: the drift seat is the ADAPTER's
  // verifyBridge (the bound handles are its bind) and its
  // JOB_ADAPTER_BRIDGE_DRIFT is propagated VERBATIM — a re-coded refusal
  // would be a second voice for one fact.
})

const isRecord = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)

/** The mint's OWN canonical law (the family's single canonical seat). */
const canonicalJson = (value) => JSON.stringify(value, (_k, v) => (
  v !== null && typeof v === 'object' && !Array.isArray(v)
    ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, v[k]]))
    : v
))

function deepFreeze (v) {
  if (v !== null && typeof v === 'object' && !Object.isFrozen(v)) {
    Object.freeze(v)
    for (const child of Object.values(v)) deepFreeze(child)
  }
  return v
}

const rawEffectsFor = (name) => [{ kind: 'tool-invoke', resource: null, toolName: name }]

/** The row's refusal transport: the bridge's OWN envelope grammar, kept
 *  byte-shaped so the client cards and the shut-face consumers never move. */
const envelopeRefusal = (code, detail) => ({ text: `refused: ${code} — ${String(detail).slice(0, 200)}` })

/**
 * @param {object} input closed keys
 *   providerId      : the family entry's provider identity (verbatim)
 *   bridge / liveBridge / probe / placementFeed : carried to the assembly
 *   pa              : the plane's published PA admit seat (funnel; also
 *                     carries closePlan — the wiring never holds proofs)
 *   observe         : (row) => void
 */
export function createBJobControlWiring (input = {}) {
  const pa = input.pa
  if (typeof pa !== 'function') {
    return Object.freeze({ ok: false, code: A5_B_JOB_WIRING_CODES.INPUT_INVALID, message: 'the plane\'s PA admit seat is required — a boolean is never a witness and a missing seat is never an approval' })
  }
  const observe = typeof input.observe === 'function' ? input.observe : () => undefined
  const state = { disposed: false, walks: 0 }

  const adapterInput = { ...input }
  delete adapterInput.pa
  delete adapterInput.observe
  const assembly = createBJobGovernedAssembly(adapterInput)
  if (assembly.ok !== true) return assembly
  const wiringProviderId = assembly.providerId

  function closePlan (callId) {
    if (typeof pa.closePlan !== 'function') return
    try { pa.closePlan(callId) } catch { /* best-effort: the funnel's own finally is idempotent */ }
  }

  /** ONE governed management call: classify → probe facts → mint → walk →
   *  verified bridge. Every refusal answers the row's { text } envelope. */
  const dispatch = async (name, args, exec) => {
    if (state.disposed) return envelopeRefusal(A5_B_JOB_WIRING_CODES.DISPOSED, 'the wiring is disposed — no PA walk opens, no bridge entry')
    const caller = typeof exec?.agent?.id === 'string' && exec.agent.id.length > 0 ? exec.agent.id : null
    if (caller === null) return envelopeRefusal(A5_B_JOB_WIRING_CODES.CALLER_ABSENT, 'the dispatch named no caller (exec.agent?.id) — an unnamed caller would query the fences UNFILTERED; this mount never un-fences')
    const classified = assembly.classifyArgs(name, args)
    if (classified.ok !== true) return envelopeRefusal(classified.code, classified.detail)
    const callId = typeof exec?.callId === 'string' && exec.callId.length > 0 ? exec.callId : null
    if (callId === null) return envelopeRefusal(A5_B_JOB_WIRING_CODES.CALL_ID_ABSENT, 'exec.callId is absent — the walk pairs on the live call id; a minted constant would decouple open from the edge (plane pairing law)')
    const signal = exec.signal
    if (signal?.aborted === true) return envelopeRefusal(A5_B_JOB_WIRING_CODES.CANCELLED, `the signal was already aborted before the walk opened — cancellation is not permission: zero PA entry, zero bridge entry (call ${callId})`)
    const fed = typeof input.placementFeed === 'function' ? input.placementFeed(name) : undefined
    const realmId = isRecord(fed) && typeof fed.realmId === 'string' && fed.realmId.length > 0 ? fed.realmId : null
    if (realmId === null) return envelopeRefusal(A5_B_JOB_WIRING_CODES.REALM_ABSENT, `the placement feed answered no realmId for '${name}' — the walk's realm is a live placement fact, never a guessed constant`)
    const parsedEffects = parseRequestedEffectSet(rawEffectsFor(name))
    if (parsedEffects.ok !== true) {
      return envelopeRefusal(A5_B_JOB_WIRING_CODES.EFFECTS_UNPARSABLE, `the derived effect set is not the frozen closed vocabulary (${JSON.stringify(parsedEffects.problems ?? null).slice(0, 200)}) — the wiring never walks a malformed effect set`)
    }
    // The PURE fence/projection probe (the wiring's seat over the gateway's
    // checkManagementAccess and the JobRegistry get projection). Its failure
    // is NEVER an invented answer: mintBJobTarget degrades absent facts to
    // 'probe-unavailable'/'unobserved' — the walk still walks, the body still
    // fences, and the manifest records what was actually observable.
    let facts = { caller }
    if (typeof input.probe === 'function') {
      try {
        const probed = await input.probe(name, caller, classified.snapshot)
        if (isRecord(probed)) facts = { ...facts, ...probed, caller }
      } catch { /* honest absence — see above */ }
    }
    const target = assembly.mintTarget(name, classified.snapshot, facts)
    // The ONE operation-discriminated family entry's mint: shared spine +
    // this family's adds, argsCanonical/namedGapsCanonical FULL reversible
    // canonical JSON (never digests); job-list's jobIdClaim is the
    // operation's TRUE no-address NULL (the never-claim law), foreign args
    // keys ride argsCanonical COMPLETELY to the body.
    const targetManifest = deepFreeze({
      operation: A5_B_JOB_RECORD_SPECS[name].operation,
      contract: target.contract,
      action: target.action,
      revision: target.revision,
      effect: target.effect,
      depth: target.depth,
      argsCanonical: canonicalJson(classified.snapshot),
      namedGapsCanonical: canonicalJson(assembly.namedGaps),
      caller: target.caller,
      jobIdClaim: target.address.claim,
      ownerRelation: target.address.relation,
      ownerAdjudication: target.address.adjudication,
      producerIncarnation: target.producerIncarnation,
      budget: target.budget,
      effectDelta: A5_B_JOB_RECORD_SPECS[name].effectDelta,
      recordIndex: A5_B_JOB_RECORD_SPECS[name].recordIndex,
    })
    const payload = deepFreeze({
      realmId,
      callId,
      parametersFingerprint: classified.parametersFingerprint,
      requestedEffects: parsedEffects.value,
      toolName: name,
      family: {
        familyId: A5_B_JOB_FAMILY_ID,
        adapterRevision: A5_B_JOB_WIRING_REVISION,
        providerIdentity: wiringProviderId,
        targetManifest,
      },
    })
    const walk = signal === undefined ? payload : Object.freeze({ ...payload, signal })
    state.walks += 1
    observe({ event: 'b-job:wire:open', name, callId })
    let opened
    try {
      opened = await pa(walk)
    } catch (error) {
      closePlan(callId)
      observe({ event: 'b-job:wire:fault', name, callId })
      return envelopeRefusal(A5_B_JOB_WIRING_CODES.PA_FAULT, `the PA walk THREW and is never treated as an authorization: ${String(error?.message ?? error).slice(0, 180)}`)
    }
    if (state.disposed) {
      closePlan(callId)
      return envelopeRefusal(A5_B_JOB_WIRING_CODES.DISPOSED, 'the wiring was disposed while PA was being asked; the answer is dropped and nothing is authorized')
    }
    if (opened?.cancelled === true) {
      return envelopeRefusal(A5_B_JOB_WIRING_CODES.CANCELLED, `the PA walk answered this invocation cancelled (call ${callId}): zero consumption, zero bridge entry — cancellation is not permission`)
    }
    if (signal?.aborted === true) {
      return envelopeRefusal(A5_B_JOB_WIRING_CODES.CANCELLED, `the signal aborted while PA was being asked (call ${callId}): this leg enters nothing; a grant consumed at the edge stays spent there — never rewound here`)
    }
    if (opened?.kind !== 'allow') {
      return envelopeRefusal(String(opened?.code ?? A5_B_JOB_WIRING_CODES.PA_REFUSED), typeof opened?.detail === 'string' ? opened.detail : 'the PA walk refused this invocation without a detail')
    }
    if (opened.consumedProof === undefined || opened.consumedProof === null) {
      return envelopeRefusal(A5_B_JOB_WIRING_CODES.PROOF_ABSENT, `allow WITHOUT the one-shot consumedProof witness (call ${callId}) — proceeding without it would be self-attestation; zero bridge entry`)
    }
    // AFTER the await the world is RE-CHECKED: the bound bridge handle again.
    const verified = assembly.verifyBridge(name)
    if (verified.ok !== true) {
      closePlan(callId)
      return envelopeRefusal(verified.code, verified.detail)
    }
    observe({ event: 'b-job:wire:consumed', name, callId })
    try {
      if (name === 'job_output') return await verified.methods.jobOutput(classified.snapshot, caller, signal)
      if (name === 'job_list') return await verified.methods.jobList(caller)
      return await verified.methods.jobKill(classified.snapshot, caller)
    } finally {
      closePlan(callId)
    }
  }

  return Object.freeze({
    ok: true,
    familyId: A5_B_JOB_FAMILY_ID,
    wiringRevision: A5_B_JOB_WIRING_REVISION,
    adapterRevision: A5_B_JOB_ADAPTER_REVISION,
    providerId: wiringProviderId,
    placementNames: assembly.placementNames,
    dispatch,
    walks: () => state.walks,
    // ROOT 22:02 REVISION CONSISTENCY (registration face): the mounted family
    // CLAIM is spoken by the mount path, and it carries the ONE revision the
    // real path mints with — the SAME number the PA family block stamps. The
    // entry's familyId/providerIdentity and name/recordIndex/
    // definitionIdentity travel VERBATIM; the adapter's PLACEMENT_KEY_ABSENT/
    // MOVED throw law runs UNTOUCHED (the inner call throws before this map).
    familyRegistrations: () => assembly.familyRegistrations().map((registration) => Object.freeze({
      ...registration,
      entry: Object.freeze({
        familyId: registration.entry.familyId,
        adapterRevision: A5_B_JOB_WIRING_REVISION,
        providerIdentity: registration.entry.providerIdentity,
      }),
    })),
    dispose: () => { state.disposed = true },
  })
}
