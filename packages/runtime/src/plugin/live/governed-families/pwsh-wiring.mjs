/**
 * pwsh-wiring.mjs — the pwsh governed MOUNT bridge (CENTER pwsh source card
 * continuation, root FIXED scope 2026-10-25: "WHEN DECLARED-MOUNTED it must
 * be REAL foreground/background PowerShell execution"; tier 接线未测).
 *
 * The route-record target for pwsh (route-records-v3c.json FC-SHL-P) is
 * GOVERNED_TAKEOVER_HOST_BODY: the governed row classifies through the ARM
 * CLASS (./pwsh-arm.mjs, 6d80b7886 — closed keys both directions, the closed
 * FC-SHL-P census effect vocabulary, the honest ENV refusal classes), walks
 * THIS plane's ONE PA admission (open → edge → one-shot consumedProof — the
 * G3-terminal walk law verbatim; a boolean is never a witness), and the
 * BODY is the CAPTURED NATIVE def's execute, verbatim (保留原生: the native
 * PowerShell tool's word is the answer — its foreground path runs the real
 * command, its background path is the jobs mount; no invented executor).
 *
 * Arms ONLY on the declared mount: no declaration or an uncaptured native
 * lands the honest DECLARED-INACTIVE census (no def, zero registration,
 * native untouched — on the Linux pin639 world the native pwsh is
 * disabled-unless-win32, so the capture is absent and THIS is the truthful
 * census; the win32 acceptance leg stays ENV-NOT-AVAILABLE until a real
 * environment, skip ≠ pass).
 *
 * The PA walk requests the G1-baseline effect face
 * `[{ kind: 'tool-invoke', toolName: 'pwsh', resource: null }]` (the closed
 * EFFECT_KINDS grammar, effects.ts:43 — the FC-SHL-P census names are the
 * family's CENSUS effects and ride the targetManifest as the S-side record,
 * never as an invented PA kind).
 */

import { parseRequestedEffectSet } from '../../../../../domain/tool-governance/src/index.js'
import { createGovernedPwshArm, PWSH_FAMILY_ID, PWSH_ADAPTER_REVISION } from './pwsh-arm.mjs'

export const A5_PWSH_MOUNT_NAME = 'pwsh'
export const A5_PWSH_WIRING_CODES = Object.freeze({
  INPUT_INVALID: 'PWSH_WIRE_INPUT_INVALID',
  PA_SEAT_INVALID: 'PWSH_WIRE_PA_SEAT_INVALID',
  IDENTITY_UNBOUND: 'PWSH_WIRE_IDENTITY_UNBOUND',
  ADMISSION_CANCELLED: 'PWSH_WIRE_ADMISSION_CANCELLED',
  APPROVAL_NOT_LANDED: 'PWSH_WIRE_APPROVAL_NOT_LANDED',
  EDGE_CANCELLED: 'PWSH_WIRE_EDGE_CANCELLED',
  CONSUME_PROOF_MISSING: 'PWSH_WIRE_CONSUME_PROOF_MISSING',
  PLACEMENT_DRIFT: 'PWSH_WIRE_PLACEMENT_DRIFT',
  EFFECTS_UNPARSABLE: 'PWSH_WIRE_EFFECTS_UNPARSABLE',
  NATIVE_EXECUTE_DRIFT: 'PWSH_WIRE_NATIVE_EXECUTE_DRIFT',
  PLACEMENT_KEY_ABSENT: 'PWSH_WIRE_PLACEMENT_KEY_ABSENT',
  PLACEMENT_KEY_MOVED: 'PWSH_WIRE_PLACEMENT_KEY_MOVED',
})

function isRecord (v) { return v !== null && typeof v === 'object' && !Array.isArray(v) }
function wiringRefuse (code, detail) { return Object.freeze({ ok: false, refused: true, code, detail }) }
function refusalToThrow (refusal) { return Object.assign(new Error(`${refusal.code}: ${refusal.detail}`), { refusal }) }

/**
 * @param {object} input closed keys
 *   realmId, providerId, memberAgentId, sessionHeaderId  : identity facts
 *   readNative        : (name) => def — the MEMBER-SCOPED native capture seam
 *                       (agentCtx.tools.get(name, runtimeAgent) law; the
 *                       global face is NOT a fallback)
 *   declaredMount     : true ONLY when the host deployment declares the pwsh
 *                       mount (config law both directions)
 *   jobsMounted       : () => boolean — the background capability
 *   placementFeed     : (name) => {definitionIdentity, realmId} | undefined
 *   identityOf        : (def) => string | null — the plane's own seam
 *   pa                : the plane's published paAdmit seat
 *   observe           : (row) => void
 */
export function buildPwshGovernedWiring (input = {}) {
  const bad = typeof input.realmId !== 'string' || input.realmId.length === 0
    ? 'realmId is required'
    : typeof input.providerId !== 'string' || input.providerId.length === 0
      ? 'providerId is required (the family entry carries the provider identity verbatim)'
      : typeof input.memberAgentId !== 'string' || input.memberAgentId.length === 0
        ? 'memberAgentId must be the REAL member Agent id — the arm owns state through the exact Agent'
        : typeof input.sessionHeaderId !== 'string' || input.sessionHeaderId.length === 0
          ? 'sessionHeaderId must be the durable session header id'
          : typeof input.readNative !== 'function'
            ? 'readNative (name) => definition is required — the MEMBER-SCOPED native capture seam'
            : typeof input.placementFeed !== 'function'
              ? 'placementFeed (name) => {definitionIdentity, realmId} is required — the LOOKUP-time placement record (never an eager snapshot)'
              : typeof input.identityOf !== 'function'
                ? 'identityOf (def) => identity is required — the plane\'s own definition-identity seam'
                : undefined
  if (bad !== undefined) return { ok: false, code: A5_PWSH_WIRING_CODES.INPUT_INVALID, detail: bad }
  // UNIFIED FACE (root final card item 1): the mount writer ALWAYS calls
  // `familyRegistrations()` (agent-bindings:6353 law — the same call site
  // every sibling face rides), so the INACTIVE census answers the SAME
  // face shape: a FUNCTION answering the empty list. A bare array here
  // made even declared=false mounts die at the registration loop with
  // "familyRegistrations is not a function" — the census is honest
  // precisely by answering empty, not by answering mis-shaped.
  const inactive = (reason) => ({
    ok: true,
    familyId: PWSH_FAMILY_ID,
    adapterRevision: PWSH_ADAPTER_REVISION,
    definitions: Object.freeze([]),
    placementNames: Object.freeze([]),
    familyRegistrations: () => Object.freeze([]),
    declared: Object.freeze([Object.freeze({ name: A5_PWSH_MOUNT_NAME, reason })]),
    drain: () => Object.freeze({ ok: true, served: 0 }),
  })
  if (input.declaredMount !== true) return inactive('MOUNT_NOT_DECLARED — the deployment declares no pwsh mount; no rows, native untouched (config law, both directions)')
  const pa = input.pa
  // THE REAL SEAT (the G6 law as the run_code guard FIXED it — g3-ptc-wiring
  // :251, the same trap already paid): production `paAdmit` is a CALLABLE
  // (a FUNCTION) carrying open / edge / closePlan (team-tool-plane:2057/
  // 2522 define it, :4936 hands it as `pa: paAdmit`). A seat check that
  // required a plain record would refuse the REAL plane seat itself
  // (isRecord excludes functions) — PWSH_ARM_REFUSED on BOTH platforms
  // ahead of any capture (root P1, 2026-10-25). Strictly callable + the
  // three methods; a plain methods object is NO LONGER accepted (不再plain
  // object假); isRecord elsewhere in this module is untouched.
  const paSeatOk = typeof pa === 'function'
    && typeof pa.open === 'function' && typeof pa.edge === 'function' && typeof pa.closePlan === 'function'
  if (!paSeatOk) return { ok: false, code: A5_PWSH_WIRING_CODES.PA_SEAT_INVALID, detail: 'pa is REQUIRED in its published shape — the plane\'s paAdmit face: a CALLABLE function carrying open / edge / closePlan (the real contract the run_code guard measured; a plain object never poses as admission); with no admission seat no governed call may enter the shell — never a duck' }
  const native = input.readNative(A5_PWSH_MOUNT_NAME)
  if (!isRecord(native) || typeof native.execute !== 'function' || typeof native.name !== 'string') {
    return inactive('PWSH_NATIVE_UNCAPTURED_ENV — the member-scoped capture answered no native pwsh def (the pinned 639 loader gates the tool disabled-unless-win32; on this host that is ENV-NOT-AVAILABLE, and a governed row never mounts over an absent body)')
  }
  // ESCALATION capability = the captured native parameter surface verbatim
  // (root final card item 4; the arm validates against the NATIVE's own
  // enum + pairing law — nothing widened, flow preserved).
  const nativeParams = isRecord(native.parameters) ? native.parameters : {}
  const sandboxParamDef = isRecord(nativeParams.sandbox_permissions) ? nativeParams.sandbox_permissions : undefined
  const governedArm = createGovernedPwshArm({
    declared: () => true,
    jobsFace: typeof input.jobsMounted === 'function' ? input.jobsMounted : () => false,
    escalation: Object.freeze({
      parameterKeys: Object.freeze(['sandbox_permissions', 'justification'].filter((k) => Object.prototype.hasOwnProperty.call(nativeParams, k))),
      sandboxEnum: Object.freeze(Array.isArray(sandboxParamDef?.enum) ? [...sandboxParamDef.enum] : []),
    }),
    // The MOUNT's env truth is the CAPTURE ITSELF: reaching here means the
    // win32-gated native was captured; the arm class's own gates stay the
    // standalone component's law (pwsh-arm spec legs (c)/(f)).
    platform: () => 'win32',
    resolveBinary: () => A5_PWSH_MOUNT_NAME,
  })
  const observe = typeof input.observe === 'function' ? input.observe : () => {}

  async function execute (...forwardArgs) {
    const exec = forwardArgs[1]
    const callId = isRecord(exec) && typeof exec.callId === 'string' ? exec.callId : `pwsh-${String(Date.now())}`
    // sameAgent scope, exact: the row answers ONLY its own member Agent.
    if (!isRecord(exec) || exec.agent?.id !== input.memberAgentId) {
      throw refusalToThrow(wiringRefuse(A5_PWSH_WIRING_CODES.INPUT_INVALID, `${A5_PWSH_MOUNT_NAME}: the row is scoped to member '${String(input.memberAgentId).slice(0, 8)}…' — exec.agent.id answered ${JSON.stringify(exec?.agent?.id ?? null)}`))
    }
    // LOOKUP-time placement re-verify (never an eager snapshot): the def THIS
    // mount placed must still BE the placement under the plane's own feed
    // (compared against the PLACED-WRAPPER identity — the wrapper IS what
    // the plane placed; the native def never rides this leg).
    const placement = input.placementFeed(A5_PWSH_MOUNT_NAME)
    if (!isRecord(placement) || placement.definitionIdentity !== boundIdentity || placement.realmId !== input.realmId) {
      throw refusalToThrow(wiringRefuse(A5_PWSH_WIRING_CODES.PLACEMENT_DRIFT, `${A5_PWSH_MOUNT_NAME}: the CURRENT placement record is not this mount's bound PLACED-DEF identity — a replaced/removed placement never keeps serving off the old capture`))
    }
    // THE OTHER BINDING: the native body reference re-verify (typed, its
    // own leg) — the same placement under a swapped execute is drift too.
    if (native.execute !== nativeExecute) {
      throw refusalToThrow(wiringRefuse(A5_PWSH_WIRING_CODES.NATIVE_EXECUTE_DRIFT, `${A5_PWSH_MOUNT_NAME}: the captured native def now carries a DIFFERENT execute than the mount bound — the real body moved under the row (zero PA entry)`))
    }
    // ① the ARM's own classify (closed keys per mount shape, the closed
    // FC-SHL-P census effects, typed ENV refusals) — pure pre-edge.
    const args = forwardArgs[0]
    const classified = governedArm.classify(args)
    if (classified.ok !== true) {
      observe({ event: 'pwsh-wire:classify-REFUSED', name: A5_PWSH_MOUNT_NAME, code: classified.code })
      throw refusalToThrow(wiringRefuse(classified.code, `${A5_PWSH_MOUNT_NAME}: the arm's classify refused (${String(classified.detail ?? '')}) (zero PA entry)`)
      )
    }
    const plan = classified.plan
    const signal = exec.signal
    // THE CANONICAL EFFECT SET (root final card item 3): the REAL kernel
    // reads `requestedEffects.effects` (team-tool-plane:2057 destructures
    // through it) — a bare array starved it. The terminal wiring law
    // verbatim: parseRequestedEffectSet answers the canonical
    // { effects, fingerprint } record and THAT rides the walk; an
    // unparsable set refuses with zero PA entry.
    const parsedEffects = parseRequestedEffectSet([{ kind: 'tool-invoke', toolName: A5_PWSH_MOUNT_NAME, resource: null }])
    if (parsedEffects.ok !== true) {
      throw refusalToThrow(wiringRefuse(A5_PWSH_WIRING_CODES.EFFECTS_UNPARSABLE, `${A5_PWSH_MOUNT_NAME}: the requested effect set is not the frozen closed vocabulary (${String(parsedEffects.problems?.[0]?.detail ?? 'parse refused')}) (zero PA entry)`))
    }
    // The FC-SHL-P census names ride the targetManifest as the family's
    // recorded S-side effects (a manifest shape the closed table does not
    // recognize passes THROUGH unchanged; the manifest NEVER self-attests
    // OS isolation — see the arm's isolation-caliber block).
    const walk = Object.freeze({
      realmId: input.realmId,
      callId,
      parametersFingerprint: plan.parametersFingerprint,
      requestedEffects: parsedEffects.value,
      toolName: A5_PWSH_MOUNT_NAME,
      family: Object.freeze({
        familyId: PWSH_FAMILY_ID,
        adapterRevision: PWSH_ADAPTER_REVISION,
        providerIdentity: input.providerId,
        targetManifest: Object.freeze({
          censusEffects: Object.freeze([...plan.effects]),
          background: plan.background,
          sessionHeaderId: input.sessionHeaderId,
        }),
      },
      ),
      ...(signal === undefined ? {} : { signal }),
    })
    try {
      const opened = await pa.open(walk)
      if (opened?.cancelled === true) throw refusalToThrow(wiringRefuse(A5_PWSH_WIRING_CODES.ADMISSION_CANCELLED, `${A5_PWSH_MOUNT_NAME}: cancelled at the PA open edge — zero shell entry`))
      if (opened?.kind === 'deny') throw refusalToThrow(opened)
      if (opened?.kind !== 'approved' || opened.grant === undefined || opened.grant === null) {
        throw refusalToThrow(wiringRefuse(A5_PWSH_WIRING_CODES.APPROVAL_NOT_LANDED, `${A5_PWSH_MOUNT_NAME}: the admission answered ${String(opened?.kind ?? 'unsettled')} without a landed grant — internal state never substitutes for the kernel answer (zero shell entry)`))
      }
      const edge = await pa.edge(Object.freeze({
        ...walk,
        grant: opened.grant,
        ...(opened.paDurableMint === undefined ? {} : { paDurableMint: opened.paDurableMint }),
        ...(opened.request === undefined ? {} : { request: opened.request }),
        ...(opened.placementName === undefined ? {} : { placementName: opened.placementName }),
        ...(opened.paConstructionBinding === undefined ? {} : { paConstructionBinding: opened.paConstructionBinding }),
      }))
      if (edge?.cancelled === true) throw refusalToThrow(wiringRefuse(A5_PWSH_WIRING_CODES.EDGE_CANCELLED, `${A5_PWSH_MOUNT_NAME}: cancelled at the execution edge — the approval stays unspent and is never replayed; zero shell entry`))
      if (edge?.kind === 'deny') throw refusalToThrow(edge)
      const proof = edge?.consumedProof
      if (!isRecord(proof) || !isRecord(proof.grant) || typeof proof.grant.grantId !== 'string') {
        throw refusalToThrow(wiringRefuse(A5_PWSH_WIRING_CODES.CONSUME_PROOF_MISSING, `${A5_PWSH_MOUNT_NAME}: the execution edge answered allow WITHOUT its one-shot consume witness — the row never self-attests consumption; the body did not run`))
      }
      if (signal?.aborted === true) {
        // post-consume abort: the grant is ledger truth, never rolled back;
        // the native body was entered ZERO times — stated exactly.
        throw Object.assign(new Error(`${A5_PWSH_MOUNT_NAME} · cancelled — aborted after the edge consumed the grant and before the body began (the consumption is settled fact; zero shell entries)`), { postConsumeCancel: true })
      }
      // ② THE REAL BODY: the captured native pwsh def's own execute, VERBATIM
      // (GOVERNED_TAKEOVER_HOST_BODY, 保留原生) — foreground runs the real
      // PowerShell command; with the jobs mount mounted behind the native
      // tool, run_in_background rides its REAL job registration. The row
      // never re-shapes the native answer.
      const ran = await nativeExecute(...forwardArgs)
      observe({ event: 'pwsh-wire:served', name: A5_PWSH_MOUNT_NAME, callId, mode: plan.background ? 'background' : 'foreground' })
      return ran
    } finally {
      pa.closePlan(callId)
    }
  }

  // THE TWO BINDINGS, KEPT APART (root final card item 2, no constant
  // self-attestation): (a) THE PLACEMENT IDENTITY binds the identity of
  // the definition THIS MOUNT PLACES — the WRAPPER def handed to the plane
  // (`identityOf` is the plane's WeakMap algebra: an identity per def
  // OBJECT, so the native and its wrapper carry DISTINCT identities;
  // binding the native here guaranteed placement drift at every dispatch
  // and PLACEMENT_KEY_MOVED at registration); (b) THE NATIVE EXECUTE
  // BINDING pins the captured native body's FUNCTION REFERENCE, re-verified
  // per dispatch — a swapped native body under the same placement is its
  // own typed drift. Each fact is checked against its own source.
  const nativeExecute = native.execute
  const definition = Object.freeze({ ...native, execute })
  const boundIdentity = input.identityOf(definition)
  if (boundIdentity !== null && boundIdentity !== undefined && typeof boundIdentity !== 'string') {
    throw refusalToThrow(wiringRefuse(A5_PWSH_WIRING_CODES.IDENTITY_UNBOUND, 'identityOf answered a non-string, non-null identity — the seam is the plane\'s WeakMap algebra; anything else is a config defect'))
  }
  if (boundIdentity === null || boundIdentity === undefined) {
    return { ok: false, code: A5_PWSH_WIRING_CODES.IDENTITY_UNBOUND, detail: 'identityOf could not answer an identity for the definition THIS mount places — the placement moment binds or refuses, never mounts blind' }
  }
  let mountedKey // fresh-feed law bookkeeping: the identity must not float
  // THE REGISTRATION KEYS LAW (the G3 wiring law verbatim): read
  // placementFeed FRESH at the registration moment; a silent feed THROWS
  // (PLACEMENT_KEY_ABSENT), a moved feed THROWS (PLACEMENT_KEY_MOVED) — no
  // guessed key, no unobserved skip. This module registers NOTHING itself.
  const familyRegistrations = () => {
    const fed = input.placementFeed(A5_PWSH_MOUNT_NAME)
    const key = isRecord(fed) && typeof fed.definitionIdentity === 'string' && fed.definitionIdentity.length > 0
      ? fed.definitionIdentity
      : null
    if (key === null) {
      throw new Error(`${A5_PWSH_MOUNT_NAME}: the placed row answered no definition identity through the placement feed — the family registration has no trusted key (PLACEMENT_KEY_ABSENT); a guessed key is forbidden and a silent skip is the drift the family gate measures`)
    }
    if (key !== boundIdentity) {
      throw new Error(`${A5_PWSH_MOUNT_NAME}: the placement identity moved between the mount bind and the registration read (${String(boundIdentity)} -> ${key}) — a placed definition's identity does not float; the mount is broken and re-registers nothing (PLACEMENT_KEY_MOVED)`)
    }
    if (mountedKey !== undefined && mountedKey !== key) {
      throw new Error(`${A5_PWSH_MOUNT_NAME}: the placement identity of the placed row moved between mount reads (${String(mountedKey)} -> ${key}) — the mount is broken`)
    }
    mountedKey = key
    return Object.freeze([Object.freeze({
      name: A5_PWSH_MOUNT_NAME,
      definitionIdentity: key,
      entry: Object.freeze({
        familyId: PWSH_FAMILY_ID,
        adapterRevision: PWSH_ADAPTER_REVISION,
        providerIdentity: input.providerId,
      }),
    })])
  }
  return {
    ok: true,
    familyId: PWSH_FAMILY_ID,
    adapterRevision: PWSH_ADAPTER_REVISION,
    definitions: Object.freeze([definition]),
    placementNames: Object.freeze([A5_PWSH_MOUNT_NAME]),
    familyRegistrations,
    declared: Object.freeze([]),
    definition,
    boundIdentity,
    drain: () => Object.freeze({ ok: true, served: 0 }),
  }
}
