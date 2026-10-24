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
  const inactive = (reason) => ({
    ok: true,
    familyId: PWSH_FAMILY_ID,
    adapterRevision: PWSH_ADAPTER_REVISION,
    definitions: Object.freeze([]),
    placementNames: Object.freeze([]),
    familyRegistrations: Object.freeze([]),
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
  const arm = createGovernedPwshArm({
    declared: () => true,
    jobsFace: typeof input.jobsMounted === 'function' ? input.jobsMounted : () => false,
    // The MOUNT's env truth is the CAPTURE ITSELF: reaching here means the
    // win32-gated native was captured; the arm class's own gates stay the
    // standalone component's law (pwsh-arm spec legs (c)/(f)).
    platform: () => 'win32',
    resolveBinary: () => A5_PWSH_MOUNT_NAME,
  })
  const observe = typeof input.observe === 'function' ? input.observe : () => {}
  const boundIdentity = input.identityOf(native)
  if (typeof boundIdentity !== 'string' && boundIdentity !== null && boundIdentity !== undefined) {
    throw refusalToThrow(wiringRefuse(A5_PWSH_WIRING_CODES.IDENTITY_UNBOUND, 'identityOf answered a non-identity — an unbound arm would drift-refuse every call while LOOKING mounted; the seam answers string or null'))
  }
  if (boundIdentity === null || boundIdentity === undefined) {
    return { ok: false, code: A5_PWSH_WIRING_CODES.IDENTITY_UNBOUND, detail: 'identityOf could not answer an identity for the captured native def — the placement moment binds or refuses, never mounts blind' }
  }

  async function execute (...forwardArgs) {
    const exec = forwardArgs[1]
    const callId = isRecord(exec) && typeof exec.callId === 'string' ? exec.callId : `pwsh-${String(Date.now())}`
    // sameAgent scope, exact: the row answers ONLY its own member Agent.
    if (!isRecord(exec) || exec.agent?.id !== input.memberAgentId) {
      throw refusalToThrow(wiringRefuse(A5_PWSH_WIRING_CODES.INPUT_INVALID, `${A5_PWSH_MOUNT_NAME}: the row is scoped to member '${String(input.memberAgentId).slice(0, 8)}…' — exec.agent.id answered ${JSON.stringify(exec?.agent?.id ?? null)}`))
    }
    // LOOKUP-time placement re-verify (never an eager snapshot): the def THIS
    // mount placed must still BE the placement under the plane's own feed.
    const placement = input.placementFeed(A5_PWSH_MOUNT_NAME)
    if (!isRecord(placement) || placement.definitionIdentity !== boundIdentity || placement.realmId !== input.realmId) {
      throw refusalToThrow(wiringRefuse(A5_PWSH_WIRING_CODES.PLACEMENT_DRIFT, `${A5_PWSH_MOUNT_NAME}: the CURRENT placement record is not this mount's bound identity — a replaced/removed placement never keeps serving off the old capture`))
    }
    // ① the ARM's own classify (closed keys per mount shape, the closed
    // FC-SHL-P census effects, typed ENV refusals) — pure pre-edge.
    const args = forwardArgs[0]
    const classified = arm.classify(args)
    if (classified.ok !== true) {
      observe({ event: 'pwsh-wire:classify-REFUSED', name: A5_PWSH_MOUNT_NAME, code: classified.code })
      throw refusalToThrow(wiringRefuse(classified.code, `${A5_PWSH_MOUNT_NAME}: the arm's classify refused (${String(classified.detail ?? '')}) (zero PA entry)`)
      )
    }
    const plan = classified.plan
    const signal = exec.signal
    // THE G1-baseline PA effect face; the FC-SHL-P census names ride the
    // targetManifest as the family's recorded S-side effects (a manifest
    // shape the closed table does not recognize passes THROUGH unchanged).
    const walk = Object.freeze({
      realmId: input.realmId,
      callId,
      parametersFingerprint: plan.parametersFingerprint,
      requestedEffects: Object.freeze([Object.freeze({ kind: 'tool-invoke', toolName: A5_PWSH_MOUNT_NAME, resource: null })]),
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
      const ran = await native.execute(...forwardArgs)
      observe({ event: 'pwsh-wire:served', name: A5_PWSH_MOUNT_NAME, callId, mode: plan.background ? 'background' : 'foreground' })
      return ran
    } finally {
      pa.closePlan(callId)
    }
  }

  const definition = Object.freeze({ ...native, execute })
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
