/**
 * governed-families/subagent-wiring.mjs — A5M2-B-SUBAGENT-WIRE (root 20:02):
 * the REAL PA WIRING for the B-SUBAGENT control trio (census records 44
 * interrupt_agent / 45 list_agents / 46 send_message), riding the EXISTING
 * production walk. This file imports exactly ONE project module
 * (`./subagent-adapters.mjs`, the frozen, root-signed adapter @0c28ff22) and
 * occupies the assembly's REQUIRED `admit` seat (adapter L10) with the real
 * open → edge → consumedProof lifecycle. NO adapter law is restated, widened
 * or routed around here: every classify/delegate/drift/verbatim-refusal law
 * stays owned by the adapter module, and every native definition, service
 * port, trusted caller/address relation fact rides through UNCHANGED.
 *
 * THE WALK IS REUSED, NEVER RE-IMPLEMENTED (root 20:02: 复用现
 * open→edge→consumedProof→同冻结plan原生→dispose；不造admit ok或平行ledger):
 *  - the ONE production funnel is the injected `pa` face — the plane's
 *    `paAdmit` (team-tool-plane.mjs :1214/:1660): Part A (fresh policy +
 *    generation recheck + approval), then the ONE `consumeForExecution`
 *    execution edge (admission-kernel consumeForExecution), then the answer.
 *    This module asks the funnel EXACTLY ONCE per call, never opens a second
 *    question, never consumes a grant itself and mints NO grant, NO token,
 *    NO ledger of its own (不造平行ledger): the one-shot consumption ledger
 *    lives in the kernel/grant ledger alone.
 *  - THE WALK INPUT is the frozen plane shape (:2365-2378 write-row law):
 *    { realmId, callId, parametersFingerprint, requestedEffects, toolName,
 *      family: { familyId, adapterRevision, providerIdentity,
 *      targetManifest }, signal? }. The parametersFingerprint is the
 *    FROZEN PLAN's own value (adapter plan :554) — the same value the row's
 *    delegate pairing re-checks; open and edge see ONE value (the pairing
 *    consistency law, plane :2891). `callId` is the live exec.callId, never
 *    a minted constant. `realmId` is the placement feed's live fact.
 *  - THE EFFECTS ARE THE REAL CONTRACT (root 20:39 FIX 1): the raw request
 *    is `[{ kind: 'tool-invoke', toolName, resource: null }]` (the same
 *    single-effect set the todo arm's payload law carries) but the WALK
 *    rides `parseRequestedEffectSet`'s canonical `{ effects, fingerprint }`
 *    VALUE — the exact parsedEffects.value shape the plane itself walks
 *    (:2360-2365) — an unparsable set refuses with the parser's own
 *    problems, zero PA entry.
 *  - THE ANSWER LAWS (plane :1449-1713 measured):
 *      · `cancelled === true` IS NOT PERMISSION: zero consumption claim,
 *        zero service entry; an aborted signal BEFORE the walk never opens.
 *      · a DENY rides with the funnel's OWN code+detail bytes (L6 no error
 *        map at this seat too — nothing is re-coded here).
 *      · `allow` MUST carry the one-shot `consumedProof` witness (plane
 *        :1650-1657: the witness is emitted ONLY on the consume-ok branch;
 *        "a row that proceeds without the proof is refusing, not
 *        self-attesting") — an allow WITHOUT it refuses
 *        P_B_SUBAGENT_WIRE_PROOF_ABSENT with zero service entry. With it,
 *        the proof is DEMANDED, NOT HELD: nothing stores a grant, a proof or
 *        a per-call receipt (no parallel ledger; the funnel owns the spent
 *        state).
 *  - THE SAME FROZEN PLAN RUNS THE NATIVE PATH: admit answers ok ONLY for
 *    the exact call whose plan was classified BEFORE the walk; the adapter's
 *    own delegate then re-derives classify on the frozen snapshot and
 *    re-checks the fingerprint (adapter :576) before the SAME frozen plan
 *    reaches the service. A torn-down mount or a leg closed while PA was
 *    being asked drops the answer (post-await world RE-CHECK, write-row law
 *    :2394-2432): the leg refuses, `pa.closePlan(callId)` ends the plan fact
 *    best-effort, and NOTHING enters the service.
 *  - DISPOSE (jobs-row law :3470-3532): `mount(agentCtx)` registers every
 *    placed definition and collects the disposers; a register failure rolls
 *    back what it already placed, reversed and best-effort, and answers the
 *    typed placement conflict. `dispose()` runs the adapter's own drain
 *    FIRST (new-call prohibition; committed effects stay committed — the
 *    adapter's DRAIN_SEMANTICS, never restated here), then the disposers,
 *    reversed, each exactly once. After dispose, the seat refuses with
 *    zero PA entry.
 *
 * WHAT THIS MODULE IS NOT: not the PA kernel (the real assembly at
 * runtime/tool-admission owns approval + the one-shot grant ledger), not the
 * plane (its writer mounts THIS wiring's definitions through its own
 * placement block), not a second permission layer, and NOT a re-open of the
 * frozen adapter (root 20:02: 不再重开adapter). The spawn side (records
 * 39–43) and workflow families belong to other owners and are NOT mounted,
 * NOT walked and NOT named here.
 *
 * @module @dsh-agent-team/runtime/plugin/live/governed-families/subagent-wiring
 */
import {
  A5_B_SUBAGENT_ADAPTER_REVISION,
  A5_B_SUBAGENT_EFFECT_LABELS,
  A5_B_SUBAGENT_FAMILY_ID,
  A5_B_SUBAGENT_NAMED_GAPS,
  A5_B_SUBAGENT_RECORD_SPECS,
  createSubagentAdapterAssembly,
} from './subagent-adapters.mjs'
// THE REAL EFFECT CONTRACT (root 20:39 FIX 1): the canonical effect-set
// grammar is domain-owned and the plane walks with parseRequestedEffectSet's
// OWN parsed value (team-tool-plane :2360-2365, paAdmit reads
// requestedEffects.effects). This wiring reuses the SAME parser and rides
// its canonical `{ effects, fingerprint }` struct — never a self-invented
// effect envelope.
import { parseRequestedEffectSet } from '../../../../../domain/tool-governance/src/index.js'
// THE CANONICAL LEAF LAW (root 21:20 joint card + the 9d968 mint-owner
// handoff at feat/a5m2-family-rules @4e96decc6, leaf "argsCanonical = your
// OWN canonicalJson"): the sorted-key JSON.stringify law of the controls
// module subagent-adapters.mjs :234-238 IS the law — copied here verbatim
// (the handoff: "same helper, spawn side may copy the law"), so
// argsCanonical/namedGapsCanonical are complete reversible canonical JSON
// under the SAME law the family's parametersFingerprint is minted over:
// full message/prompt text, unknown-but-legal args keys, array order,
// nulls and empty strings all survive; key ORDER is deterministically
// normalized by this helper — the leaf carries content, not spelling.
const canonicalJson = (value) => JSON.stringify(value, (_k, v) => (
  v !== null && typeof v === 'object' && !Array.isArray(v)
    ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, v[k]]))
    : v
))

// Bumped 1→2 with the root-21:20 UNION ENCODING round (the control mint now
// emits the common-required + control-addition manifest with FULL canonical
// JSON; an OLD-shape mint is not produced anywhere and a previously reviewed
// manifest bytes are NOT silently retranslated — every dispatch re-mints from
// the frozen plan under the new law). Bumped 2→3 with the 9d968 mint-owner
// handoff (@4e96decc6, root 21:33): the canonical leaves are minted under
// this module's OWN copy of the controls-module :234-238 sorted-key law (the
// handoff names that helper as the law) instead of the domain canonical
// helper — AND the root-21:37 scoped addressClaim correction (list_agents'
// manifest claim is the operation's true no-address NULL; a foreign unknown
// agent_id key is never interpreted as an address; args stay whole; the
// frozen adapter is NOT reopened and the table's nullableString is NOT
// widened) — a VISIBLE mint change per the pairing rules, never a silent
// translation of approved revisions. Registration pairs same-round: the
// adapter stays at its signed A5_B_SUBAGENT_ADAPTER_REVISION (not reopened;
// the table entry pairs adapter rev 1 at the measured pins); the table
// entry's own revision pairing belongs to the 9d968 family-rule owner lane.
export const A5_B_SUBAGENT_WIRING_REVISION = 3

/** Typed codes OWNED by this wiring layer (P_B_SUBAGENT_WIRE_*). Funnel and
 *  adapter refusals keep THEIR OWN bytes — this seat never re-codes them. */
export const A5_B_SUBAGENT_WIRING_CODES = Object.freeze({
  INPUT_INVALID: 'P_B_SUBAGENT_WIRE_INPUT_INVALID',
  ADMISSION_SEAT_OWNED: 'P_B_SUBAGENT_WIRE_ADMISSION_SEAT_OWNED',
  PA_ABSENT: 'P_B_SUBAGENT_WIRE_PA_ABSENT',
  PA_FAULT: 'P_B_SUBAGENT_WIRE_PA_FAULT',
  PA_REFUSED: 'P_B_SUBAGENT_WIRE_PA_REFUSED',
  PROOF_ABSENT: 'P_B_SUBAGENT_WIRE_PROOF_ABSENT',
  CANCELLED: 'P_B_SUBAGENT_WIRE_CANCELLED',
  DISPOSED: 'P_B_SUBAGENT_WIRE_DISPOSED',
  CALL_ID_ABSENT: 'P_B_SUBAGENT_WIRE_CALL_ID_ABSENT',
  REALM_ABSENT: 'P_B_SUBAGENT_WIRE_REALM_ABSENT',
  EFFECTS_UNPARSABLE: 'P_B_SUBAGENT_WIRE_EFFECTS_UNPARSABLE',
  MOUNT_ALREADY_PLACED: 'P_B_SUBAGENT_WIRE_MOUNT_ALREADY_PLACED',
  PLACEMENT_CONFLICT: 'P_B_SUBAGENT_WIRE_PLACEMENT_CONFLICT',
})

const CODES = A5_B_SUBAGENT_WIRING_CODES

const refuse = (code, detail) => ({ ok: false, code, detail })
const refuseAssembly = (code, message) => Object.freeze({ ok: false, code, message })

const isRecord = (value) => typeof value === 'object' && value !== null && !Array.isArray(value)

function deepFreeze(value) {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child)
    Object.freeze(value)
  }
  return value
}

/** THE RAW EFFECT REQUEST (closed, pinned by spec): the invoked tool itself
 *  — `tool-invoke` ONLY, resource null (todo.mjs §PAYLOAD vocabulary). This
 *  is only the parser's INPUT; the WALK rides parseRequestedEffectSet's
 *  canonicalized `{ effects, fingerprint }` VALUE (root 20:39 FIX 1 — the
 *  real PA contract shape, the plane's own parsedEffects.value). */
const rawEffectsFor = (toolName) => [{ kind: 'tool-invoke', toolName, resource: null }]

/**
 * Assembly-time wiring factory: mounts the frozen adapter VERBATIM and
 * occupies its required `admit` seat with the real PA walk.
 *
 * @param input {{
 *   providerId?: string,
 *   captured?: Record<string, { native: object, definitionIdentity: string }>,
 *   liveNative?: (name: string) => object | undefined,
 *   subagentService?: object, liveSubagentService?: () => object,
 *   agentsRegistry?: { get: (id: unknown) => unknown },
 *   liveAgentsRegistry?: () => { get: (id: unknown) => unknown },
 *   isAdjacentAgentSendMessageTool?: (definition: unknown) => boolean,
 *   markAdjacentAgentSendMessageTool?: (definition: unknown) => unknown,
 *   placementFeed: (name: string) => { definitionIdentity?: string, realmId?: string } | undefined,
 *   pa: ((walk: object) => Promise<object>) & { closePlan?: (callId: string) => void },
 *       // THE production PA funnel (plane paAdmit :1214/:1660): ONE call per
 *       // invocation runs Part A + the consumeForExecution edge; the answer
 *       // carries kind allow/deny, cancelled, and — on the consume-ok
 *       // branch ONLY — the one-shot consumedProof witness. closePlan ends
 *       // a never-completed leg's plan fact (plane :1713).
 *   observe?: (row: object) => void,
 * }} input
 * @returns a frozen `{ ok: true, wiring }` (definitions +
 *          familyRegistrations + mount/dispose) or the adapter's/factory's
 *          own frozen `{ ok: false, code, message }` assembly refusal.
 */
export function createBSubagentControlWiring(input = {}) {
  if (!isRecord(input)) return refuseAssembly(CODES.INPUT_INVALID, 'the wiring factory takes one input record')
  if (typeof input.admit === 'function' || 'admit' in input) {
    return refuseAssembly(CODES.ADMISSION_SEAT_OWNED, 'the admit seat is OWNED by this wiring (the real PA walk occupies it — root 20:02); a hand-supplied admit is exactly the fabricated admit-ok this card forbids (不造admit ok)')
  }
  if (typeof input.pa !== 'function') {
    return refuseAssembly(CODES.PA_ABSENT, 'pa is REQUIRED — this wiring ships NO unadmitted path (the real PA funnel — Part A + the one consumeForExecution edge — occupies this seam; the adapter below would itself refuse without admit, and this layer never substitutes a stub)')
  }
  const knownInput = new Set(['providerId', 'captured', 'liveNative', 'subagentService', 'liveSubagentService', 'agentsRegistry', 'liveAgentsRegistry', 'isAdjacentAgentSendMessageTool', 'markAdjacentAgentSendMessageTool', 'placementFeed', 'pa', 'observe'])
  for (const key of Object.keys(input)) {
    if (!knownInput.has(key)) {
      return refuseAssembly(CODES.INPUT_INVALID, `unknown wiring input '${key}' — the candidate takes the adapter inputs minus 'admit' plus 'pa' and nothing else (spawn-side/resource arms are other owners' faces)`)
    }
  }
  const pa = input.pa
  const observe = typeof input.observe === 'function' ? input.observe : () => {}
  const state = { disposed: false, mountDisposers: null, walks: 0 }

  // THE ADMIT SEAT — the real walk, once per call, over the frozen plan.
  const admit = async (envelope) => {
    if (state.disposed) return refuse(CODES.DISPOSED, 'the wiring is disposed — no PA walk opens, no service entry, committed effects stay committed')
    const { name, recordIndex, familyId, classified, exec } = envelope
    const plan = classified?.plan
    if (classified?.ok !== true || !isRecord(plan) || typeof plan.parametersFingerprint !== 'string') {
      return refuse(CODES.INPUT_INVALID, 'the admit seat takes the adapter\'s own classified plan (the frozen parametersFingerprint is the walk pairing value)')
    }
    const callId = typeof exec?.callId === 'string' && exec.callId.length > 0 ? exec.callId : null
    if (callId === null) return refuse(CODES.CALL_ID_ABSENT, 'exec.callId is absent — the walk pairs on the live call id; a minted constant would decouple open from the edge (plane pairing law :2891)')
    const signal = exec.signal
    if (signal?.aborted === true) return refuse(CODES.CANCELLED, `the signal was already aborted before the walk opened — cancellation is not permission: zero PA entry, zero service entry (call ${callId})`)
    const fed = input.placementFeed(name)
    const realmId = isRecord(fed) && typeof fed.realmId === 'string' && fed.realmId.length > 0 ? fed.realmId : null
    if (realmId === null) return refuse(CODES.REALM_ABSENT, `the placement feed answered no realmId for '${name}' — the walk's realm is a live placement fact, never a guessed constant`)
    // FIX 1 (root 20:39): the REAL effect contract — parse through the
    // domain's canonical parser and ride ITS value (the plane's exact
    // :2360-2365 walk: parse → parsedEffects.value with {effects,
    // fingerprint}); an unparsable set is the plane's EFFECTS_UNPARSABLE
    // posture: refuse with the parser's own problems, zero PA entry.
    const parsedEffects = parseRequestedEffectSet(rawEffectsFor(name))
    if (parsedEffects.ok !== true) {
      return refuse(CODES.EFFECTS_UNPARSABLE, `the derived effect set is not the frozen closed vocabulary (${JSON.stringify(parsedEffects.problems ?? null).slice(0, 200)}) — the wiring never walks a malformed effect set`)
    }
    // UNION ENCODING (root 21:20 joint card, control-mint side): the ONE
    // operation-discriminated family entry's CONTROL mint. Common required
    // strings (operation/contract/action/revision/effect/depth/
    // argsCanonical/namedGapsCanonical) + the control additions
    // (caller/addressRelation/addressAdjudication/budget/effectDelta strings,
    // addressClaim NULLABLE string, recordIndex the existing nonNegativeInt).
    // argsCanonical / namedGapsCanonical are FULL canonical JSON — never a
    // hash summary: the full message/prompt text, unknown-but-legal args
    // keys, array order, nulls and empty strings survive (pinned by spec
    // round-trip). The complete plan.target is LOSSLESSLY RECONSTRUCTIBLE
    // from these leaves (contract/caller/address{claim,relation,adjudication}/
    // action/revision/depth/budget) — labels never stand in for the target.
    // operation and action BOTH bind to the record's frozen original
    // operation (subagent-interrupt / subagent-list / subagent-send-message).
    // DISCLOSED single-source facts: this seam holds ONE census effect fact
    // per control record (A5_B_SUBAGENT_EFFECT_LABELS is the inventory's
    // recordEffectDelta), so `effect` and `effectDelta` carry the SAME census
    // string — no second truth is invented at this seam.
    const subagentTargetManifestControl = deepFreeze({
      operation: A5_B_SUBAGENT_RECORD_SPECS[name].operation,
      contract: plan.target.contract,
      action: plan.target.action,
      revision: plan.target.revision,
      effect: plan.target.effect,
      depth: plan.target.depth,
      argsCanonical: canonicalJson(plan.args),
      namedGapsCanonical: canonicalJson(A5_B_SUBAGENT_NAMED_GAPS),
      caller: plan.target.caller,
      addressRelation: plan.target.address.relation,
      addressAdjudication: plan.target.address.adjudication,
      // ROOT 21:37 SCOPED CORRECTION (mine, control-mint seat): the LIST
      // operation addresses NOTHING — its true address fact is NULL. A
      // list_agents call may legally carry an UNKNOWN key named agent_id (open
      // object root — Host accepts it); that is NOT an address designation and
      // the nullableString law must not see it folded into a claim (the
      // adapter's internal plan.target.address.claim mirror stays the faithful
      // `snapshot.agent_id ?? null` byte — NOT reopened, root 20:02 — but the
      // MANIFEST this validator reads answers the operation's real no-address
      // fact). interrupt / send_message keep their native address field
      // unchanged. The unknown key still rides argsCanonical COMPLETELY and
      // reaches the native untouched — nothing is deleted, no new kind, no
      // nullable→any widening.
      addressClaim: name === 'list_agents' ? null : plan.target.address.claim,
      budget: plan.target.budget,
      effectDelta: A5_B_SUBAGENT_EFFECT_LABELS[name],
      recordIndex,
    })
    const payload = deepFreeze({
      realmId,
      callId,
      parametersFingerprint: plan.parametersFingerprint,
      requestedEffects: parsedEffects.value,
      toolName: name,
      family: {
        familyId,
        adapterRevision: A5_B_SUBAGENT_ADAPTER_REVISION,
        providerIdentity: wiringProviderId,
        targetManifest: subagentTargetManifestControl,
      },
    })
    // FIX 4 (root 20:39): freeze ONLY the wiring's own JSON payload. The
    // caller's AbortSignal rides BY REFERENCE unfrozen — deep-freezing it
    // would break abort during the PA wait (the signal is the caller's
    // live object, not part of the reviewed payload).
    const walk = signal === undefined ? payload : Object.freeze({ ...payload, signal })
    state.walks += 1
    observe({ event: 'b-subagent:wire:open', name, callId })
    let opened
    try {
      opened = await pa(walk)
    } catch (error) {
      closePlan(callId)
      observe({ event: 'b-subagent:wire:fault', name, callId })
      return refuse(CODES.PA_FAULT, `the PA walk THREW and is never treated as an authorization (plane :2382 law): ${String(error?.message ?? error).slice(0, 180)}`)
    }
    // AFTER the await the world is RE-CHECKED, not assumed (write-row law
    // :2394-2432): a teardown landing while PA was asked voids the leg.
    if (state.disposed) {
      closePlan(callId)
      observe({ event: 'b-subagent:wire:dropped', name, callId, detail: 'mount-torn-during-walk' })
      return refuse(CODES.DISPOSED, 'the wiring was disposed while PA was being asked; the answer is dropped and nothing is authorized (a consumed grant, if any, stays spent in the kernel ledger — never rewound here)')
    }
    if (opened?.cancelled === true) {
      return refuse(CODES.CANCELLED, `the PA walk answered this invocation cancelled (call ${callId}): zero consumption, zero service entry — cancellation is not permission`)
    }
    if (signal?.aborted === true) {
      return refuse(CODES.CANCELLED, `the signal aborted while PA was being asked (call ${callId}): this leg enters nothing; if the kernel had consumed at the edge the grant stays spent there — never rewound, never re-armed here`)
    }
    if (opened?.kind !== 'allow') {
      // The funnel's OWN bytes ride VERBATIM (root 20:39 accuracy fix): the
      // detail passes through UNTOUCHED — nothing is appended to it while
      // the seat claims fidelity, and nothing is re-coded (L6 posture).
      // Only where the funnel OMITS a field does a typed fallback name the
      // absence; our words never join the funnel's own words.
      return {
        ok: false,
        code: String(opened?.code ?? CODES.PA_REFUSED),
        detail: typeof opened?.detail === 'string' ? opened.detail : 'the PA walk refused this invocation without a detail',
      }
    }
    if (opened.consumedProof === undefined || opened.consumedProof === null) {
      return refuse(CODES.PROOF_ABSENT, `allow WITHOUT the one-shot consumedProof witness (call ${callId}) — the witness is emitted only on the consume-ok branch (plane :1650-1657); proceeding without it would be self-attestation, so this leg refuses with zero service entry`)
    }
    // The proof is DEMANDED, NOT HELD: nothing here stores grants, proofs or
    // receipts — the kernel's one-shot ledger owns the spent state.
    observe({ event: 'b-subagent:wire:consumed', name, callId })
    return { ok: true }
  }

  function closePlan(callId) {
    if (typeof pa.closePlan !== 'function') return
    try {
      pa.closePlan(callId)
    } catch {
      /* best-effort: the plan fact's terminal close is idempotent with the funnel's own finally */
    }
  }

  const adapterInput = { ...input }
  delete adapterInput.pa // the funnel is THIS layer's face; the adapter never sees it
  const assembly = createSubagentAdapterAssembly({ ...adapterInput, admit })
  if (assembly.ok !== true) return assembly
  const wiringProviderId = assembly.providerId

  const wiring = Object.freeze({
    ok: true,
    familyId: A5_B_SUBAGENT_FAMILY_ID,
    wiringRevision: A5_B_SUBAGENT_WIRING_REVISION,
    adapterRevision: A5_B_SUBAGENT_ADAPTER_REVISION,
    providerId: wiringProviderId,
    subset: assembly.subset,
    // VERBATIM travel: the placed definitions and registration face are the
    // assembly's OWN objects — this layer re-wraps nothing.
    definitions: assembly.definitions,
    placementNames: assembly.placementNames,
    rows: assembly.rows,
    declared: assembly.declared,
    rowOf: assembly.rowOf,
    familyRegistrations: assembly.familyRegistrations,
    inFlight: assembly.inFlight,
    /** The jobs-row placement law (:3470-3496): register every placed def,
     *  collect disposers, roll back reversed+best-effort on failure.
     *  FIX 3 (root 20:39): a SECOND successful mount is REFUSED — a re-mount
     *  would re-register every name and overwrite the first mount's
     *  disposers, leaking the first registration with no handle. The first
     *  mount's disposers stay the ONLY ones dispose() runs. (A FAILED mount
     *  rolled its own placements back and stays retryable — nothing was
     *  left holding.) */
    mount: (agentCtx) => {
      if (state.disposed) return refuseAssembly(CODES.DISPOSED, 'mount after dispose is refused — the wiring is closed')
      if (state.mountDisposers !== null) {
        return Object.freeze({ ok: false, code: CODES.MOUNT_ALREADY_PLACED, message: 'this wiring is already placed — a second mount would re-register every name and orphan the first mount\'s disposers; unmount (dispose) first, or use a new wiring' })
      }
      const disposers = []
      for (const definition of assembly.definitions) {
        try {
          disposers.push(agentCtx.tools.register(definition))
        } catch (error) {
          for (const d of disposers.reverse()) {
            try {
              if (typeof d === 'function') d()
              else if (typeof d?.dispose === 'function') d.dispose()
            } catch {
              /* rollback best-effort: the mount fails closed regardless */
            }
          }
          observe({ event: 'b-subagent:wire:placement-refused', name: definition.name })
          return Object.freeze({ ok: false, code: CODES.PLACEMENT_CONFLICT, name: definition.name, message: String(error?.message ?? error) })
        }
      }
      state.mountDisposers = disposers
      observe({ event: 'b-subagent:wire:placed', names: assembly.placementNames })
      return Object.freeze({ ok: true, dispose: () => dispose() })
    },
    /** Drain FIRST (adapter semantics, never restated), then the disposers
     *  reversed, each exactly once; idempotent. */
    dispose: () => dispose(),
  })
  function dispose() {
    if (state.disposed) return Object.freeze({ event: 'b-subagent:wire:dispose', semantics: 'already disposed — nothing re-runs' })
    state.disposed = true
    assembly.drain()
    const run = (state.mountDisposers ?? []).slice().reverse()
    state.mountDisposers = null
    for (const d of run) {
      try {
        if (typeof d === 'function') d()
        else if (typeof d?.dispose === 'function') d.dispose()
      } catch {
        /* teardown best-effort: every disposer runs regardless of a sibling's throw */
      }
    }
    observe({ event: 'b-subagent:wire:dispose', disposers: run.length })
    return Object.freeze({ event: 'b-subagent:wire:dispose', disposers: run.length, semantics: 'new-call prohibition + placed masks disposed; committed effects stay committed' })
  }
  return wiring
}
