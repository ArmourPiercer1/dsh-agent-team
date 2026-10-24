/**
 * governed-families/team-wiring.mjs — A5M2-B-TEAM-WIRE: the RUNNABLE THIN
 * BRIDGE that wires the root-reviewed B-TEAM member-operation adapter
 * (team-adapters.mjs rev.1, records 74–82 + 86, owner series
 * 705742ad5 → ec97ab2ff → 88ad3cf37 — imported VERBATIM, edited by NOBODY
 * on this lane) into the production mount + PA consumption faces, exactly
 * the way the landed B-SESSION-QUERY bridge does it
 * (g6-session-query-wiring.mjs is the house pattern; a5m2-g6-plane-mount-c1
 * is the house proof shape).
 *
 * WHAT THIS BRIDGE DOES:
 *  - the adapter's REAL factory `createTeamAdapterAssembly` builds the ten
 *    governed rows (the closed set is the adapter's own
 *    `A5_B_TEAM_RECORD_SPECS` / `A5_B_TEAM_TOOL_NAMES` — ten names, records
 *    74–82 + 86, MEASURED from the adapter, no subset ruling exists for
 *    this family and none is invented here; every adapter law — L1 honest
 *    declared rows, L2 only-execute-replaced, L3 capture/delegate pairing,
 *    L4 per-call caller identity, L5 the pure argument mirror, L6 no error
 *    duck-coding, L7 per-dispatch edge re-verify, L8 the plan memo, L9 drain
 *    semantics, L10 no unadmitted path, L11 no registration — stands as the
 *    adapter itself spells it; this file restates NONE of it);
 *  - THE SEAT IS THE REAL PA WALK (root 18:11: a factory plus
 *    `input.admit({ok:true})` is factory assembly, NOT wiring). The adapter's
 *    REQUIRED `admit` seam is occupied here by the plane's production
 *    `paAdmit` chain — the CALLABLE carrying `open` / `edge` / `closePlan`
 *    (team-tool-plane.mjs:1214-area / :1874 / :1908 / :1909), accepted in
 *    exactly that published shape or as an equivalent plain methods record,
 *    and nothing else poses as it: the walk is
 *    `pa.open(walk) -> pa.edge({...walk, grant, ...}) -> witness -> admitted`,
 *    and the execution edge's one-shot `consumedProof` witness is DEMANDED
 *    before the seat answers `{ok:true}` (the todo-row consume law,
 *    team-tool-plane.mjs:2186-area) — no witness, no admission, zero
 *    delegate entry, never a self-attested consume;
 *  - ONE CONSUMPTION PER PLAN at this edge: the deep-frozen plan OBJECT the
 *    adapter classifies is admitted at most once; a second admission of the
 *    SAME plan answers P_B_TEAM_WIRE_ALREADY_ADMITTED with zero port entry.
 *    This is the wiring's memo discipline — the durable one-shot
 *    consumed-proof is the PA edge above and the lane's own requestToken
 *    idempotency INSIDE the delegated chain (the adapter's PLAN_ONCE_MEMO
 *    named gap, carried verbatim, never worded closed here);
 *  - EVERY REFUSAL settles with ZERO PORT ENTRY: a mint refusal, a missing
 *    issued call identity, a cancelled/`deny`/unsettled open, a missing
 *    consume witness or a replay all answer the adapter's `admit` seam with
 *    `{ok:false, code, detail}` — the adapter's own execute then throws those
 *    bytes BEFORE `row.delegate` is reached, so the governed chain
 *    (createTeamTools → makeDefinition → caller-root binding → service role
 *    checks → last-mile guard → facade/messaging/activity) is never entered;
 *  - THE FAMILY CLAIM rides the walk at FULL VALUE (载荷法): familyId /
 *    adapterRevision / providerIdentity from the adapter's own family facts,
 *    and `targetManifest` = the lossless FLAT projection of the adapter's
 *    MEASURED `plan.target` (mintTarget's nine leaves, leaf for leaf:
 *    contract, action, root.claim, root.adjudication, the member claim +
 *    adjudication — the two-branch delegate law and the 'no member
 *    addressed' literal included — object, revision, effect, face). Nothing
 *    invented, nothing dropped, no rewrite: `root.claim` / the member claim
 *    ride `null` exactly as measured (an un-adjudicated claim is a measured
 *    null, never a sentinel);
 *  - THE CALL IDENTITY IS ISSUED, never invented: an injected
 *    `correlationOf (exec, toolName) => string | null` seam (the plane mounts
 *    its a5p5/paAdmit mount law there — per-mount nonce + seq + execution-
 *    token single-flight) or an execution that already answers a non-empty
 *    `callId`. No issued identity, no admission;
 *  - THE LIVE HANDS ARE LIVE (adapter L7, the sibling root ② law): `captured`
 *    rides the ONE-CAPTURE memo (the seam is read AT MOST once per name and
 *    the SAME object serves the row capture and the placed definition's
 *    spread), while `liveNative` rides the FRESH member-scoped read the
 *    mount owner supplies. `teamDelegates` / `liveTeamDelegates` are
 *    COMPOSED by this bridge from the live lane set (`teamSet()`): the bound
 *    delegates object answers every dispatch while the live set still
 *    answers the captured executes, and the moment the lane set moves under
 *    the mount the live read answers a DIFFERENT object, which the adapter
 *    refuses as P_B_TEAM_PORT_DRIFT with zero delegate entry — a bind-time
 *    constant compared against itself is structurally impossible here;
 *  - THE MOUNT-MOMENT REGISTRATION is the adapter's OWN
 *    `familyRegistrations()` face (keys read FRESH through the placement
 *    feed at mount moment): a silent feed THROWS
 *    `P_B_TEAM_PLACEMENT_KEY_ABSENT`, a moved identity THROWS
 *    `P_B_TEAM_PLACEMENT_KEY_MOVED` — never a guessed key, never a silent
 *    skip. This module calls `registerA5GovernedFamily` NOTHING: the shared
 *    post-publish writer in agent-bindings does (adapter L11; the settled
 *    single-fill-point law).
 *
 * WHAT THIS BRIDGE IS NOT:
 *  - it is NOT the Team service and adds no second gate to the delegated
 *    chain: role/ownership/quota/envelope checks, the Leader-gate, the
 *    last-mile guard and the lifecycle FSM are the chain's own (adapter
 *    NAMED GAP SERVICE_ENTRY_DELEGATION);
 *  - it is NOT a PA backend and never mints a grant: `pa` is the seat the
 *    plane's real `paAdmit` occupies in production;
 *  - it enables NOTHING the adapter did not mint: a name whose member-scoped
 *    native face is absent, or whose face fails the REAL registration
 *    minimum-entry shape law, is left as the adapter's own honest
 *    DECLARED-INACTIVE census row — no definition, no registration, native
 *    untouched (a half-capture is never emitted for the real host entry to
 *    reject).
 *
 * NAMED GAPS (carried VERBATIM on every plan through this bridge, never
 *  worded closed HERE): the adapter's A5_B_TEAM_NAMED_GAPS —
 *  SERVICE_ENTRY_DELEGATION, CALLER_IDENTITY, PLAN_ONCE_MEMO,
 *  GUARD_AND_LIFECYCLE — plus TWO wiring-side facts this lane MEASURED and
 *  reports instead of papering over:
 *   1. PA CONSUMPTION BRIDGE COMPLETION (the grammar gate, MEASURED):
 *      `PA_FAMILY_TARGET_RULES` (packages/runtime/control/types.ts:1215)
 *      carries NO 'B-TEAM' entry — the measured key set is
 *      ['B-SESSION','B-IMAGE','B-WRITE','B-CONTROL','B-INSPECT'] — and TWO
 *      of the nine measured leaves (`root.claim`, the member claim) are a
 *      string-OR-null union that NO existing closed kind types
 *      ('string' requires length>0; the vocabulary is string/boolean/
 *      nonNegativeInt/countsTriple/obligations). Inventing a kind is
 *      forbidden, so the rule entry stays UNLANDED and every real B-TEAM
 *      durable claim fails CLOSED at the bridge with the bridge's own bytes
 *      (`familyId: no target structure is registered for 'B-TEAM'`, or the
 *      lossless deny ahead of it). The exact delta — ONE strict
 *      nullable-string kind plus the nine measured leaves — is REPORTED TO
 *      CENTER (the same shape the B-SCHEDULE lane reported for its
 *      `taskId` leaf); the spec pins those refusal strings through the REAL
 *      published checkers.
 *   2. THE TEAM EFFECT DIMENSION: the closed RESOURCE_KINDS vocabulary has
 *      no Team-object kind, so the §B-TEAM I+S labels are comment-side
 *      contract labels; the call rides the ONE effect the grammar admits —
 *      `tool-invoke` over the mounted tool name — and the durable
 *      member/message/activity writes are adjudicated INSIDE the delegated
 *      chain (the same class of named residual the G6 bridge carries for
 *      session history). A Team resource kind is the CENTER's grammar close,
 *      never an invention here.
 *
 * STATUS: wiring bridge; production-reachable through the plane's REAL
 * paAdmit, and NOT Host-tested — no Host, no ports, no tests/homes, no
 * network on this lane. The four-tier row for B-TEAM stays 未接线 until a
 * Host-accepted acceptance leg lands; nothing here claims it.
 *
 * @module @dsh-agent-team/runtime/plugin/live/governed-families/team-wiring
 */
import { parseRequestedEffectSet } from '../../../../../domain/tool-governance/src/index.js'
import {
  A5_B_TEAM_ADAPTER_REVISION,
  A5_B_TEAM_FAMILY_ID,
  A5_B_TEAM_RECORD_SPECS,
  A5_B_TEAM_TOOL_NAMES,
  createTeamAdapterAssembly,
} from './team-adapters.mjs'

export const A5_B_TEAM_WIRING_REVISION = 2

/** Typed codes OWNED by this wiring layer (P_B_TEAM_WIRE_*). Adapter refusals
 *  keep the row's own P_B_TEAM_* codes verbatim — never rewritten here. */
export const A5_B_TEAM_WIRING_CODES = Object.freeze({
  INPUT_INVALID: 'P_B_TEAM_WIRE_INPUT_INVALID',
  TARGET_MINT: 'P_B_TEAM_WIRE_TARGET_MINT',
  CALL_ID_ABSENT: 'P_B_TEAM_WIRE_CALL_ID_ABSENT',
  EFFECTS_UNPARSABLE: 'P_B_TEAM_WIRE_EFFECTS_UNPARSABLE',
  ADMISSION_CANCELLED: 'P_B_TEAM_WIRE_ADMISSION_CANCELLED',
  APPROVAL_NOT_LANDED: 'P_B_TEAM_WIRE_APPROVAL_NOT_LANDED',
  EDGE_CANCELLED: 'P_B_TEAM_WIRE_EDGE_CANCELLED',
  CONSUME_PROOF_MISSING: 'P_B_TEAM_WIRE_CONSUME_PROOF_MISSING',
  ALREADY_ADMITTED: 'P_B_TEAM_WIRE_ALREADY_ADMITTED',
})
const WIRE = A5_B_TEAM_WIRING_CODES

const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)
const nonEmptyString = (value) => typeof value === 'string' && value.length > 0

const deepFreeze = (value) => {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child)
    Object.freeze(value)
  }
  return value
}

const wiringRefuse = (code, detail) => deepFreeze({ ok: false, code, detail })

/** The REAL registration minimum-entry gate (the SHAPE mirror only — schema
 *  SEMANTICS stay the host validator's): a half-capture is never emitted for
 *  the host entry to reject, it stays an honest DECLARED-INACTIVE census. */
const registrationFaceComplete = (native) => {
  const output = isRecord(native) ? native.output : undefined
  return isRecord(native)
    && native.name !== undefined && typeof native.name === 'string' && native.name.length > 0
    && typeof native.description === 'string'
    && typeof native.execute === 'function'
    && isRecord(output) && output.schema !== undefined
    && typeof output.render === 'function'
    && (output.presentationMeta === undefined || typeof output.presentationMeta === 'function')
    && (native.timeoutMs === undefined || (Number.isFinite(native.timeoutMs) && native.timeoutMs > 0))
}

/** The MEASURED target leaf law (what mintTarget actually answers — this is
 *  what the projection accepts, leaf for leaf; anything else is drift, never
 *  a guess). `claim` is a measured string OR the measured null. */
const measuredClaim = (value) => value === null || nonEmptyString(value)
const measuredText = (value) => nonEmptyString(value)

/**
 * THE TARGET MANIFEST: the lossless FLAT projection of the adapter's measured
 * `plan.target` (root ① §B-TEAM fidelity: every measured leaf rides, nothing
 * invented, nothing dropped). A refusal here is a CLAIM-COMPOSITION refusal
 * before any durable fact and with zero port entry: the measured shape moved.
 */
function mintTargetManifest (plan, readQueryFacts) {
  const QUERY_DURABLE_GROUPS = new Set(['team-list-members', 'team-list-templates', 'team-inspect-config'])
  const read = typeof readQueryFacts === 'function' ? readQueryFacts : () => undefined
  const target = isRecord(plan) ? plan.target : undefined
  const root = isRecord(target) ? target.root : undefined
  const member = isRecord(target) ? target.member : undefined
  if (!isRecord(target) || !isRecord(root)) {
    return wiringRefuse(WIRE.TARGET_MINT, 'the adapter plan carries no measured target shape to project — the claim mints nothing it did not measure')
  }
  if (!measuredClaim(root.claim) || !measuredText(root.adjudication)) {
    return wiringRefuse(WIRE.TARGET_MINT, 'the measured root leaf (claim = string|null + adjudication = non-empty string) moved — the caller-root binding is adjudicated INSIDE the delegated chain and its claim rides exactly as measured')
  }
  // member is EITHER the measured literal 'no member addressed' (a string)
  // OR a {claim, adjudication} record (the two-branch delegate law included).
  const memberIsLiteral = typeof member === 'string'
  const memberClaim = memberIsLiteral ? null : (isRecord(member) ? member.claim : undefined)
  const memberAdjudication = memberIsLiteral ? member : (isRecord(member) ? member.adjudication : undefined)
  if (!measuredClaim(memberClaim) || !measuredText(memberAdjudication)) {
    return wiringRefuse(WIRE.TARGET_MINT, `the measured member leaf moved (string|null claim + non-empty adjudication, or the measured 'no member addressed' literal) — got ${JSON.stringify(String(memberClaim ?? member).slice(0, 48))}`)
  }
  const leaf = (key) => {
    const value = target[key]
    if (!measuredText(value)) {
      return { refusal: wiringRefuse(WIRE.TARGET_MINT, `the measured leaf target.${key} is not the measured non-empty string — nothing is invented to fill it`) }
    }
    return { value }
  }
  const contract = leaf('contract')
  if (contract.refusal !== undefined) return contract.refusal
  const action = leaf('action')
  if (action.refusal !== undefined) return action.refusal
  const object = leaf('object')
  if (object.refusal !== undefined) return object.refusal
  const revision = leaf('revision')
  if (revision.refusal !== undefined) return revision.refusal
  const effect = leaf('effect')
  if (effect.refusal !== undefined) return effect.refusal
  const face = leaf('face')
  if (face.refusal !== undefined) return face.refusal
  // THE DURABLE QUERY LEAVES (rev 2, paired with the family table's six adds):
  // the three read rows carry the facts their target IS, read through the
  // owner's published authority queries. This is the SAME composition law as
  // every leaf above — a leaf the read cannot answer is a claim this bridge
  // does not mint, refused before any durable question with zero port entry —
  // and it replaces nothing: the lane's rejected VALUE, the classifier and the
  // caller's ordering all ran, and still run, in front of it. Absence is
  // minted as `null` (the FACT of absence), never as an invented row value.
  const group = action.value
  if (!QUERY_DURABLE_GROUPS.has(group)) {
    return deepFreeze({
    contract: contract.value,
    operation: action.value,
    rootClaim: root.claim,
    rootAdjudication: root.adjudication,
    memberClaim,
    memberAdjudication,
    targetObject: object.value,
    revisionLaw: revision.value,
    effectLabel: effect.value,
    argumentLawFace: face.value,
  })
  }
  const facts = read(group, memberClaim)
  const stringsOf = (value) => Array.isArray(value) && value.every((item) => typeof item === 'string')
  const nullable = (value) => value === null || typeof value === 'string'
  if (!isRecord(facts)) {
    return wiringRefuse(WIRE.TARGET_MINT, `the durable target read for '${group}' answered nothing — a query claim mints no leaf the published read did not answer`)
  }
  const durable = {}
  if (group === 'team-list-members') {
    if (!stringsOf(facts.rosterMemberIds)) {
      return wiringRefuse(WIRE.TARGET_MINT, 'the roster read returned no array of member-instance ids — the roster leaves are not minted from anything else')
    }
    if (typeof facts.rosterFingerprint !== 'string' || facts.rosterFingerprint.length === 0) {
      return wiringRefuse(WIRE.TARGET_MINT, 'the roster read returned no digest of the id set it answered with')
    }
    durable.rosterMemberIds = Object.freeze([...facts.rosterMemberIds])
    durable.rosterFingerprint = facts.rosterFingerprint
  }
  if (group === 'team-list-templates') {
    if (!stringsOf(facts.templateIds)) {
      return wiringRefuse(WIRE.TARGET_MINT, 'the bound-blueprint read returned no array of member templateIds — no catalog-wide set is substituted for this session\'s blueprint')
    }
    durable.templateIds = Object.freeze([...facts.templateIds])
  }
  if (group === 'team-inspect-config') {
    if (typeof memberClaim !== 'string') {
      return wiringRefuse(WIRE.TARGET_MINT, 'an inspect claim with no addressed member mints no member leaves')
    }
    if ((facts.memberTemplateId !== undefined && !nullable(facts.memberTemplateId))
      || (facts.memberChildSessionId !== undefined && !nullable(facts.memberChildSessionId))) {
      return wiringRefuse(WIRE.TARGET_MINT, 'the addressed member read answered templateId/childSessionId outside string|null — absence is minted as null, not as a guess')
    }
    durable.memberInstanceId = memberClaim
    durable.memberTemplateId = facts.memberTemplateId ?? null
    durable.memberChildSessionId = facts.memberChildSessionId ?? null
  }
  return deepFreeze({
    contract: contract.value,
    operation: action.value,
    rootClaim: root.claim,
    rootAdjudication: root.adjudication,
    memberClaim,
    memberAdjudication,
    targetObject: object.value,
    revisionLaw: revision.value,
    effectLabel: effect.value,
    argumentLawFace: face.value,
    ...durable,
  })
}

/**
 * THE FAMILY CLAIM (the registration owner's pre-registration query): which
 * of the ten names THIS bridge will actually capture — computed by the SAME
 * predicate this bridge applies at assembly (the registration minimum-entry
 * face law + the seam's capture-identity mint), over the owner's OWN
 * member-scoped lane set. The registration owner asks this BEFORE it
 * registers anything, so one name keeps exactly one placement (the plane
 * mounts into the same agent tool layer the raw lane registrations live in,
 * and the host refuses a second definition under one name in one layer —
 * packages/core/scope/src/store.ts:43). Divergence between this claim and
 * what the assembly actually mounts is caught fail-closed by the owner's
 * post-publish placement verification, never by a guess here.
 *
 * @param input {{ catalog: readonly unknown[], allowedNames?: readonly string[] | null, definitionIdentityOf: (definition: object) => string | null }}
 * @returns frozen `{ names, census }` — the claimable names and the honest
 *          census of the ones this build cannot carry.
 */
export function claimTeamOpsFamily (input = {}) {
  const catalog = isRecord(input) && Array.isArray(input.catalog) ? input.catalog : []
  const allowed = isRecord(input) && Array.isArray(input.allowedNames) ? new Set(input.allowedNames) : null
  const identityOf = isRecord(input) && typeof input.definitionIdentityOf === 'function' ? input.definitionIdentityOf : () => null
  const byName = new Map()
  for (const def of catalog) if (isRecord(def) && typeof def.name === 'string') byName.set(def.name, def)
  const names = []
  const census = []
  for (const name of A5_B_TEAM_TOOL_NAMES) {
    const recordIndex = A5_B_TEAM_RECORD_SPECS[name].recordIndex
    if (allowed !== null && !allowed.has(name)) {
      census.push(Object.freeze({ name, recordIndex, reason: 'not-allowed-for-this-member' }))
      continue
    }
    const native = byName.get(name)
    if (native === undefined) {
      census.push(Object.freeze({ name, recordIndex, reason: 'capture-absent' }))
      continue
    }
    if (!registrationFaceComplete(native) || native.name !== name) {
      census.push(Object.freeze({ name, recordIndex, reason: 'registration-face-incomplete' }))
      continue
    }
    if (!nonEmptyString(identityOf(native))) {
      census.push(Object.freeze({ name, recordIndex, reason: 'capture-identity-unminted' }))
      continue
    }
    names.push(name)
  }
  return Object.freeze({ names: Object.freeze(names), census: Object.freeze(census) })
}

/** THE ISSUED CALL IDENTITY default (no seam injected): only an execution
 *  that already answers a non-empty callId is admitted — nothing is guessed. */
const defaultCorrelationOf = (exec) => (isRecord(exec) && nonEmptyString(exec.callId) ? exec.callId : null)

/**
 * Assembly-time controlled wiring for the ten B-TEAM member operations.
 *
 * @param input {{
 *   realmId: string,
 *   providerId: string,
 *   readNative: (name: string) => object | undefined,   // ONE-CAPTURE seam
 *   liveNative: (name: string) => object | undefined,    // FRESH member-scoped re-read
 *   teamSet: () => readonly object[] | undefined,        // the LIVE lane tool set
 *   placementFeed: (name: string) => { definitionIdentity?: string, realmId?: string } | undefined,
 *   pa: the plane's paAdmit seat (CALLABLE with open/edge/closePlan) or an equivalent methods record,
 *   correlationOf?: (exec: unknown, toolName: string) => string | null,
 *   observe?: (event: object) => void,
 * }} input
 * @returns a frozen wiring assembly `{ ok: true, ... }` or a frozen
 *          `{ ok: false, code, detail }` refusal (an omitted capture law
 *          answers the ADAPTER's own P_B_TEAM_* bytes, never a stand-in).
 */
export function buildTeamOpsWiring (input = {}) {
  if (!isRecord(input)) return wiringRefuse(WIRE.INPUT_INVALID, 'the wiring bridge takes one input record')
  const knownInput = new Set(['realmId', 'providerId', 'readNative', 'liveNative', 'teamSet', 'placementFeed', 'definitionIdentityOf', 'correlationOf', 'pa', 'observe', 'queryFacts', 'callerGate', 'registrationOf'])
  for (const key of Object.keys(input)) {
    if (!knownInput.has(key)) {
      return wiringRefuse(WIRE.INPUT_INVALID, `unknown wiring input '${key}' — the bridge takes exactly {realmId, providerId, readNative, liveNative, teamSet, placementFeed, definitionIdentityOf, correlationOf, pa, observe}`)
    }
  }
  const { realmId, providerId, readNative, liveNative: liveNativeSeam, teamSet, placementFeed, pa, observe = () => {}, queryFacts, callerGate, registrationOf } = input
  if (!nonEmptyString(realmId)) return wiringRefuse(WIRE.INPUT_INVALID, 'realmId is REQUIRED (non-empty string) — the walk has no realm without it')
  if (!nonEmptyString(providerId)) return wiringRefuse(WIRE.INPUT_INVALID, 'providerId is REQUIRED (non-empty string) — the durable family gate compares the provider identity the owner published, and this bridge invents none')
  if (typeof readNative !== 'function') return wiringRefuse(WIRE.INPUT_INVALID, 'readNative (name) => definition | undefined is REQUIRED — the MEMBER-SCOPED capture seam (the agentCtx.tools.get(name, runtimeAgent) law the todo/write/image captures obey; the global face is NOT a fallback)')
  if (typeof liveNativeSeam !== 'function') return wiringRefuse(WIRE.INPUT_INVALID, 'liveNative (name) => definition | undefined is REQUIRED — the per-dispatch L7 re-read must be a FRESH member-scoped read, never the capture memo (a bind-time constant compared against itself proves nothing)')
  if (typeof teamSet !== 'function') return wiringRefuse(WIRE.INPUT_INVALID, 'teamSet () => the CURRENT lane tool set is REQUIRED — the delegate port is a read of the SAME createTeamTools set the capture came from (adapter L3), and the live answer is what L7 compares per dispatch')
  if (typeof placementFeed !== 'function') return wiringRefuse(WIRE.INPUT_INVALID, 'placementFeed (name) => {definitionIdentity, realmId} | undefined is REQUIRED — the family key is the runtime identity the seam minted for the PLACED definition, never a hand-spelled string')
  // THE SEAT, ACCEPTED IN ITS PRODUCTION SHAPE: the real `paAdmit` is a
  // CALLABLE carrying `.open` / `.closePlan` / `.edge` as attached methods
  // (team-tool-plane.mjs:1214-area/:1874/:1908/:1909) — a plain-object test
  // would reject it, so the seat is accepted as exactly a function or object
  // answering all three methods. Nothing else poses as the admission seat.
  const paSeatOk = (pa !== null && (typeof pa === 'object' || typeof pa === 'function')
    && typeof pa.open === 'function' && typeof pa.edge === 'function' && typeof pa.closePlan === 'function')
  if (!paSeatOk) {
    return wiringRefuse(WIRE.INPUT_INVALID, 'pa is REQUIRED in its published shape — the plane\'s paAdmit face (a CALLABLE with open / edge / closePlan methods) or an equivalent plain {open, edge, closePlan} methods record; with no admission seat no governed team call may enter the chain (L10)')
  }
  const correlationOf = input.correlationOf === undefined
    ? defaultCorrelationOf
    : typeof input.correlationOf === 'function' ? input.correlationOf : null
  if (correlationOf === null) {
    return wiringRefuse(WIRE.INPUT_INVALID, 'correlationOf, when supplied, must be (exec, toolName) => string | null — the ISSUED call identity seam (the plane\'s mount law); a non-function never substitutes')
  }

  // ── THE ONE CAPTURE (the G6 defect-② closure, carried to this family): the
  // seam is read AT MOST once per name; the SAME object serves the adapter's
  // row capture and the placed definition's spread.
  const captureMemo = new Map()
  const capturedOnce = (name) => {
    if (captureMemo.has(name)) return captureMemo.get(name)
    const read = readNative(name)
    captureMemo.set(name, read === null ? undefined : read)
    return captureMemo.get(name)
  }
  // THE CAPTURE-SIDE IDENTITY comes from the seam's OWN mint (pb §6, the
  // `definitionIdentityOf` algebra the plane and every sibling capture obeys)
  // — never a hand-spelled string invented here. Absent seam = the capture
  // identity is unmintable and every name stays an honest census row.
  const captureIdentityOf = input.definitionIdentityOf === undefined
    ? () => null
    : typeof input.definitionIdentityOf === 'function' ? input.definitionIdentityOf : null
  if (captureIdentityOf === null) {
    return wiringRefuse(WIRE.INPUT_INVALID, 'definitionIdentityOf, when supplied, must be (definition) => string | null — the seam\'s own capture-side mint; this bridge invents no identity')
  }

  // THE CLOSED SET is the adapter's own record table — the ten names it
  // mints, measured from A5_B_TEAM_TOOL_NAMES / A5_B_TEAM_RECORD_SPECS. No
  // subset ruling exists for B-TEAM, so none is invented: every name the
  // adapter can mount is offered, and each one only actually mounts on a
  // COMPLETE member-scoped capture.
  const captured = {}
  const census = []
  for (const name of A5_B_TEAM_TOOL_NAMES) {
    const native = capturedOnce(name)
    if (native === undefined) {
      census.push(Object.freeze({ name, recordIndex: A5_B_TEAM_RECORD_SPECS[name].recordIndex, reason: 'capture-absent' }))
      continue
    }
    if (!registrationFaceComplete(native) || native.name !== name) {
      census.push(Object.freeze({ name, recordIndex: A5_B_TEAM_RECORD_SPECS[name].recordIndex, reason: 'registration-face-incomplete' }))
      continue
    }
    // THE CAPTURE-SIDE IDENTITY is the seam's OWN mint over the captured
    // native face (pb §6), never a hand-spelled string from this bridge: the
    // mount owner supplies the reader. An unmintable face stays an honest
    // census row — the adapter's own CAPTURE_INCOMPLETE law refuses a
    // half-capture, and inventing a capture identity would be exactly the
    // guessed key the registration law forbids.
    const identity = captureIdentityOf(native)
    if (!nonEmptyString(identity)) {
      census.push(Object.freeze({ name, recordIndex: A5_B_TEAM_RECORD_SPECS[name].recordIndex, reason: 'capture-identity-unminted' }))
      continue
    }
    captured[name] = Object.freeze({ native, definitionIdentity: identity })
  }

  // THE DELEGATE PORT (adapter L3): the name -> governed-execute port of the
  // SAME lane set the capture came from. Bound ONCE from the captured
  // executes; `liveTeamDelegates()` below answers this SAME object while the
  // live lane set still answers those executes, and a DIFFERENT object the
  // moment it moves — which is what makes the adapter's PORT_DRIFT leg a
  // live reading rather than a tautology.
  const boundDelegates = Object.freeze(Object.fromEntries(
    Object.keys(captured).map((name) => [name, captured[name].native.execute]),
  ))
  const liveTeamDelegates = () => {
    const liveSet = teamSet()
    const live = Array.isArray(liveSet) ? liveSet : []
    const byName = new Map()
    for (const def of live) if (isRecord(def) && typeof def.name === 'string') byName.set(def.name, def)
    for (const name of Object.keys(boundDelegates)) {
      const def = byName.get(name)
      if (def === undefined || def.execute !== boundDelegates[name]) return { moved: true, name }
    }
    return boundDelegates
  }
  const liveNative = (name) => {
    const read = liveNativeSeam(name)
    // `null` is a LEGAL answer (a native this host build does not carry or a
    // face that vanished): the adapter's L7 law decides what a moved/absent
    // live face refuses with — never a stand-in object here.
    return read === null ? undefined : read
  }

  // ONE CONSUMPTION at this edge (the wiring's memo discipline): the plan
  // object admitted {ok:true} once is spent; a second admission refuses with
  // zero port entry. The durable one-shot proof is the PA edge's own
  // consumedProof, the lane's requestToken idempotency lives INSIDE the
  // delegated chain (NAMED GAP PLAN_ONCE_MEMO, never closed here).
  const admittedPlans = new WeakSet()
  const stats = { admits: 0, admittedOnce: 0, admissionRefusals: 0, callerGateRefusals: 0, mintRefusals: 0, toolLawValues: 0, walks: 0, edges: 0, witnessed: 0 }

  // ROOT 21:24 — the QUERY target's durable facts, read through the OWNER's
  // published authority queries (the lane's own root resolution, the durable
  // `memberInstances` roster, the bound blueprint). This block RESOLVES and
  // RE-CHECKS; it refuses nothing and rewrites no return value: the lane's
  // native rejected VALUE, the adapter's classification and the caller's
  // ordering stay exactly as they are, and the seven write rows never reach
  // this code (their supply was never forced). The re-check after the
  // approval landed is the SAME source read again, so a roster or blueprint
  // that moved between the walk and the grant is recorded as drift rather
  // than silently vouched for. No cache, no second ledger of record: this is
  // the same store the lane itself reads.
  const QUERY_TARGET_NAMES = new Set(['team_list_members', 'team_list_templates', 'team_inspect_config'])
  const queryFactsLedger = []
  // The read the MINT consumes, captured as the mint consumes it so the
  // post-approval re-check compares against the facts the claim actually
  // carried (not against a later reading of the same store).
  // ② (root 22:35) The facts a CALL minted with are kept in a box created for
  // THAT CALL, never on the assembly: two calls in flight (or a write call
  // between an await and the post-approval read) cannot overwrite each other,
  // and nothing reads a shared variable after an await.
  let mintFactsBox = null
  const readQueryFacts = (group, memberClaim) => {
    const tool = String(group).replace(/-/g, '_')
    if (!QUERY_TARGET_NAMES.has(tool) || typeof queryFacts?.resolve !== 'function') return undefined
    try {
      const facts = queryFacts.resolve(tool, typeof memberClaim === 'string' ? memberClaim : undefined)
      if (mintFactsBox !== null) {
        mintFactsBox.facts = facts
        mintFactsBox.claim = typeof memberClaim === 'string' ? memberClaim : undefined
      }
      return facts
    } catch (error) {
      const fault = String(error?.message ?? error).slice(0, 160)
      if (mintFactsBox !== null) {
        mintFactsBox.fault = fault
        mintFactsBox.claim = typeof memberClaim === 'string' ? memberClaim : undefined
      }
      // The read's own failure stays OBSERVABLE next to the composition
      // refusal that follows from it; an unknown target is never minted as an
      // empty one (root 22:45 boundary).
      observe({ event: 'b-team-wire:query-facts-unresolved', name: tool, fault })
      // An unreadable durable target mints no leaf (the mint's own composition
      // law); the fault is still RECORDED below, so the failure is visible
      // rather than inferred from a generic refusal.
      return undefined
    }
  }
  const readAgain = (group, memberClaim) => {
    const tool = String(group).replace(/-/g, '_')
    if (!QUERY_TARGET_NAMES.has(tool) || typeof queryFacts?.resolve !== 'function') return undefined
    try { return queryFacts.resolve(tool, typeof memberClaim === 'string' ? memberClaim : undefined) } catch { return undefined }
  }
  const stableJson = (facts) => { try { return JSON.stringify(facts ?? null) } catch { return '<unserializable>' } }

  const wireAdmit = async (ctx) => {
    const classified = isRecord(ctx) ? ctx.classified : undefined
    const plan = isRecord(classified) ? classified.plan : undefined
    const name = isRecord(ctx) ? ctx.name : undefined
    if (classified?.ok !== true || !isRecord(plan)) {
      // Not this layer's judgment: the adapter composes the classified call
      // before the seat, so a seat that saw no plan forwards nothing.
      stats.admissionRefusals += 1
      return wiringRefuse(WIRE.INPUT_INVALID, 'the admission seat saw no ok-classified plan — nothing forwards blind, and the governed chain is never entered on an unclassified call')
    }
    if (admittedPlans.has(plan)) {
      stats.admissionRefusals += 1
      observe({ event: 'b-team-wire:already-admitted', name })
      return wiringRefuse(WIRE.ALREADY_ADMITTED, `'${String(name)}': this plan OBJECT was already admitted at this edge — one consumption per plan, zero port entry on the replay (the durable one-shot edge is the PA consumed-proof and the lane's own requestToken idempotency)`)
    }
    // The mirrored pure argument law already answered the LANE'S OWN
    // rejected VALUE: the delegate settles it with zero delegate entry, so
    // no PA question is ever minted for a call the lane itself refuses
    // (zero PA entry, zero port entry — the mirror's answer rides the
    // lane's bytes, never a wiring code).
    if (plan.toolError !== undefined) {
      stats.toolLawValues += 1
      observe({ event: 'b-team-wire:tool-law-value', name, code: plan.toolError.code, paEntry: false })
      return Object.freeze({ ok: true })
    }
    // ④ (root 23:2x): THE CALLER/ROOT GATE runs HERE, before any durable fact
    // is read and before the claim is minted — the SAME rule the native common
    // entry runs, reached through the exported shared helper in packages/tools
    // (no second identity rule, no second error vocabulary). A refusal is the
    // NATIVE typed rejected VALUE carried through verbatim (its own code, its
    // own message, its `details`), with zero PA entry, zero fact read and zero
    // port entry; success falls through untouched. A world that publishes no
    // gate behaves exactly as it did before this seam existed.
    // ④ CLOSED PER ROOT's NARROW REVIEW (67e90): the wrapped refusal this lane
    // used to return was still an EXCEPTION by the time it reached the caller
    // (the adapter's `refusalToThrow`), and reading it back meant catching a
    // thrown error to find a value - which is hiding, and it would also accept
    // any object claiming to be a native VALUE. Now the trusted gate's native
    // failure takes an EXPLICIT DIRECT-RETURN CHANNEL: nothing is minted, no
    // fact is read, no PA question opens, and the seat answers "this layer
    // forwards nothing" ({ok:true}) so the ADAPTER'S OWN delegate - the real
    // native tool - settles the call with its OWN typed rejected VALUE at its
    // :496 gate, before `spec.run` and therefore with zero downstream effect.
    // The caller thus receives the native's bytes because they ARE the
    // native's bytes: this layer invents none and carries none, so a forged
    // `nativeValue` has no path into the answer. Ordinary PA / admission
    // refusals keep their existing exception semantics untouched.
    if (typeof callerGate === 'function') {
      const target = isRecord(plan.target) ? plan.target : undefined
      const rootLeaf = isRecord(target) ? target.root : undefined
      const rootClaim = isRecord(rootLeaf) && typeof rootLeaf.claim === 'string' ? rootLeaf.claim : ''
      const gate = await callerGate(ctx.exec, rootClaim)
      if (gate?.ok !== true) {
        // ROOT 24:0x: the ok:true FORWARD design is BLOCKED, not an authorized
        // answer - the native re-enters its own identity resolution and then
        // `spec.run`, so the call would run past the PA walk. Until the signed
        // adapter offers the explicit private settled-value return at execute
        // (`if (admitted?.settled === true) return admitted.value`, the two-line
        // delta at team-adapters.mjs:817-823 that this seam is waiting on), the
        // refusal stays an ordinary seat refusal: the caller's answer is this
        // seat's OWN code, the native is never re-entered, and nothing is
        // carried as a "native value" (no forged-value path, no fake ok:true,
        // no swallowing of unrelated admission refusals).
        stats.callerGateRefusals += 1
        const value = isRecord(gate) ? gate.result : undefined
        const trusted = isRecord(value) && value.status === 'rejected'
          && typeof value.code === 'string' && value.code.length > 0
          && typeof value.message === 'string'
        observe({
          event: 'b-team-wire:caller-gate-refused',
          name,
          code: trusted ? value.code : undefined,
          paEntry: false,
          factsRead: false,
          minted: false,
          delegateEntry: false,
          settledReturn: trusted,
        })
        // The private settled-value channel (adapter execute): the trusted
        // internal gate's OWN typed rejected VALUE goes back to the caller by
        // reference, with zero PA entry, zero durable read and zero port
        // entry. A gate answer that is not a well-formed rejected VALUE is
        // never smuggled through that channel - it stays an ordinary seat
        // refusal, and no caller-supplied data ever forms it.
        if (trusted) return Object.freeze({ ok: true, settled: true, value })
        return wiringRefuse(WIRE.ADMISSION_CANCELLED, `${String(name)}: the shared caller/root gate refused this call with an answer that is not a well-formed rejected VALUE — zero PA entry, zero durable fact read, zero port entry`)
      }
    }
    const callBox = { facts: undefined, claim: undefined, fault: undefined }
    mintFactsBox = callBox
    const targetManifest = mintTargetManifest(plan, readQueryFacts)
    mintFactsBox = null
    if (targetManifest.ok === false) {
      stats.mintRefusals += 1
      observe({ event: 'b-team-wire:claim-mint-REFUSED', name, code: targetManifest.code })
      return targetManifest
    }
    const callId = correlationOf(ctx.exec, name)
    if (!nonEmptyString(callId)) {
      stats.admissionRefusals += 1
      observe({ event: 'b-team-wire:call-id-ABSENT', name })
      return wiringRefuse(WIRE.CALL_ID_ABSENT, `${String(name)}: the execution answered no ISSUED call identity — the PA walk has no single-flight key and a guessed correlation is forbidden; zero port entry`)
    }
    // ⑤ (root 23:5x) THE VERSION PAIRING, at the two real points: the
    // registration the mount PUBLISHES and the claim this seat COMPOSES must
    // agree, and they are compared again at the edge, after the grant landed.
    // This is the adapter revision the durable row carries (the adapter's own
    // fact) against the identity the registration owner published — NOT the
    // wiring revision, which vouches for nothing. A mismatch answers with the
    // seat's own existing admission / edge cancellation codes (no new refusal
    // vocabulary): before the composition no PA question opens, after the
    // grant the lane is never entered.
    // THE PAIRED VERSION. The claim below mints `pairingRevision`; the same
    // expression is what the mount publishes into the family registration (the
    // adapter's registration face takes its revision from the same constant the
    // claim reads), so a durable approval carries ONE version and the
    // registration carries that same version. Comparing them is therefore a
    // comparison of the claim's version against the registration this mount
    // actually published - not a wiring counter, which revokes nothing.
    const pairingRevision = A5_B_TEAM_ADAPTER_REVISION
    const published = typeof registrationOf === 'function' ? registrationOf() : undefined
    const registrationMismatch = (where) => {
      if (!isRecord(published)) return undefined
      if (published.adapterRevision === pairingRevision && published.providerIdentity === providerId) return undefined
      return `${String(name)}: the ${where} carries adapterRevision ${JSON.stringify(published.adapterRevision)} / providerIdentity ${JSON.stringify(published.providerIdentity)} while this claim mints pairingRevision ${String(pairingRevision)} / ${JSON.stringify(providerId)} — a claim is never minted, and never forwarded to the lane, on a registration it does not match`
    }
    {
      const mismatch = registrationMismatch('published registration')
      if (mismatch !== undefined) {
        stats.admissionRefusals += 1
        observe({ event: 'b-team-wire:registration-claim-MISMATCH', name, stage: 'pre-pa', paEntry: false })
        return wiringRefuse(WIRE.ADMISSION_CANCELLED, mismatch)
      }
    }
    const parsedEffects = parseRequestedEffectSet([Object.freeze({ kind: 'tool-invoke', toolName: name, resource: null })])
    if (parsedEffects.ok !== true) {
      stats.admissionRefusals += 1
      return wiringRefuse(WIRE.EFFECTS_UNPARSABLE, `${String(name)}: the minted effect set is not the frozen closed vocabulary (${String(parsedEffects.problems?.[0]?.detail ?? 'parse refused')}); zero port entry`)
    }
    const signal = isRecord(ctx.exec) ? ctx.exec.signal : undefined
    const walk = Object.freeze({
      realmId,
      callId,
      parametersFingerprint: plan.parametersFingerprint,
      requestedEffects: parsedEffects.value,
      toolName: name,
      // 载荷法: the four P-adds at FULL VALUE, from the adapter's own facts.
      family: Object.freeze({
        familyId: A5_B_TEAM_FAMILY_ID,
        adapterRevision: pairingRevision,
        providerIdentity: providerId,
        targetManifest,
      }),
      ...(signal === undefined ? {} : { signal }),
    })
    stats.walks += 1
    try {
      const opened = await pa.open(walk)
      if (opened?.cancelled === true) {
        stats.admissionRefusals += 1
        return wiringRefuse(WIRE.ADMISSION_CANCELLED, `${String(name)}: cancelled at the PA open edge before admission — zero port entry`)
      }
      if (opened?.kind === 'deny') {
        stats.admissionRefusals += 1
        return deepFreeze({ ok: false, code: String(opened.code ?? 'ADMISSION_REFUSED'), detail: String(opened.detail ?? 'the admission refused this call') })
      }
      if (opened?.kind !== 'approved' || opened.grant === undefined || opened.grant === null) {
        stats.admissionRefusals += 1
        return wiringRefuse(WIRE.APPROVAL_NOT_LANDED, `${String(name)}: the admission answered ${String(opened?.kind ?? 'unsettled')} without a landed grant — internal state never substitutes for the kernel answer; zero port entry`)
      }
      stats.edges += 1
      const edge = await pa.edge(Object.freeze({
        ...walk,
        grant: opened.grant,
        ...(opened.paDurableMint === undefined ? {} : { paDurableMint: opened.paDurableMint }),
        ...(opened.request === undefined ? {} : { request: opened.request }),
        ...(opened.placementName === undefined ? {} : { placementName: opened.placementName }),
        ...(opened.paConstructionBinding === undefined ? {} : { paConstructionBinding: opened.paConstructionBinding }),
      }))
      if (edge?.cancelled === true) {
        stats.admissionRefusals += 1
        return wiringRefuse(WIRE.EDGE_CANCELLED, `${String(name)}: cancelled at the execution edge — the approval stays unspent and is never replayed; zero port entry`)
      }
      if (edge?.kind === 'deny') {
        stats.admissionRefusals += 1
        return deepFreeze({ ok: false, code: String(edge.code ?? 'EDGE_REFUSED'), detail: String(edge.detail ?? 'the execution edge refused this call') })
      }
      const proof = edge?.consumedProof
      if (!isRecord(proof) || !isRecord(proof.grant) || typeof proof.grant.grantId !== 'string') {
        stats.admissionRefusals += 1
        observe({ event: 'b-team-wire:consume-proof-MISSING', name, callId })
        // The seat NEVER self-attests a consumption: no witness, no
        // admission, and the adapter's own execute throws these bytes
        // before row.delegate — zero delegate entry.
        return wiringRefuse(WIRE.CONSUME_PROOF_MISSING, `${String(name)}: the execution edge answered allow without its one-shot consume witness — the seat never substitutes a self-attested consumption; the governed chain was not entered`)
      }
      stats.witnessed += 1
      if (QUERY_TARGET_NAMES.has(String(name))) {
        // ③ (root 22:35) the re-check goes out with the SAME addressed claim
        // the mint used; `undefined` here used to lose the addressed instance
        // and manufacture a drift that never happened.
        const admitFacts = callBox.fault !== undefined
          ? Object.freeze({ unresolved: true, fault: callBox.fault })
          : callBox.facts
        const afterFacts = readAgain(String(name).replace(/_/g, '-'), callBox.claim)
        const drifted = stableJson(admitFacts) !== stableJson(afterFacts)
        queryFactsLedger.push(Object.freeze({
          name: String(name),
          admitFacts: Object.freeze(admitFacts ?? { unresolved: true }),
          // 审批后同源复查: the SAME published query read again after the grant
          // landed, so a roster/blueprint that moved is recorded, not vouched.
          postApprovalFacts: Object.freeze(afterFacts ?? { unresolved: true }),
          drifted,
        }))
        observe({ event: 'b-team-wire:query-facts', name: String(name), drifted })
      }
      {
        // Same comparison, after the grant landed: a registration that moved
        // under a walk that was opened against the old one stops here — the
        // approval is not carried into the lane on a stale version.
        const current = typeof registrationOf === 'function' ? registrationOf() : undefined
        const stale = isRecord(current)
          && (current.adapterRevision !== pairingRevision || current.providerIdentity !== providerId)
        if (stale) {
          stats.admissionRefusals += 1
          observe({ event: 'b-team-wire:registration-claim-MISMATCH', name, stage: 'post-grant', laneEntry: false })
          return wiringRefuse(WIRE.EDGE_CANCELLED, registrationMismatch('registration at the edge'))
        }
      }
      admittedPlans.add(plan)
      stats.admits += 1
      stats.admittedOnce += 1
      observe({ event: 'b-team-wire:admitted', name, callId })
      return Object.freeze({ ok: true })
    } finally {
      // The walk's own close handle (idempotent with the edge's finally):
      // every path that never reached the edge still ends this call's plan
      // fact here — the same law the G6 bridge carries.
      pa.closePlan(callId)
    }
  }

  // Everything else forwards VERBATIM to the adapter's own factory: the
  // captures, the live re-reads, the port, the placement feed, the seat. An
  // omission answers the adapter's OWN refusal bytes — this layer adds no
  // second gate that could mask them.
  const adapterResult = createTeamAdapterAssembly({
    providerId,
    captured,
    liveNative: (name) => liveNative(name),
    teamDelegates: boundDelegates,
    liveTeamDelegates,
    placementFeed,
    admit: wireAdmit,
    observe: (event) => { observe({ source: 'b-team-adapter', ...event }) },
  })
  if (!isRecord(adapterResult) || adapterResult.ok !== true) {
    observe({ event: 'b-team-wire:assembly-REFUSED', code: adapterResult?.code })
    return Object.freeze({ ...adapterResult })
  }

  const assembly = Object.freeze({
    ok: true,
    familyId: A5_B_TEAM_FAMILY_ID,
    wiringRevision: A5_B_TEAM_WIRING_REVISION,
    adapterRevision: A5_B_TEAM_ADAPTER_REVISION,
    providerId,
    /** The family's closed ten (the adapter's own record table). */
    familyNames: A5_B_TEAM_TOOL_NAMES,
    /** The ACTIVE rows' placement names (definition order). */
    placementNames: adapterResult.placementNames,
    /** The COMPLETE captured definitions with ONLY execute replaced (L2). */
    definitions: adapterResult.definitions,
    rows: adapterResult.rows,
    /** The adapter's honest DECLARED-INACTIVE census + this bridge's capture
     *  census (a native face this host build does not carry). */
    declared: adapterResult.declared,
    captureCensus: Object.freeze(census),
    rowOf: adapterResult.rowOf,
    /** L9: new-call prohibition ONLY — durable lane commits stay durable. */
    drain: adapterResult.drain,
    inFlight: adapterResult.inFlight,
    /** THE family registration face (mount moment, AFTER publish): reads the
     *  placement feed FRESH; THROWS P_B_TEAM_PLACEMENT_KEY_ABSENT /
     *  P_B_TEAM_PLACEMENT_KEY_MOVED instead of guessing or skipping. This
     *  bridge registers NOTHING (adapter L11 — the shared writer owns the
     *  single fill point). */
    familyRegistrations: adapterResult.familyRegistrations,
    /** This edge's claim ledger. */
    claimStats: () => deepFreeze({ ...stats }),
    /** The admit ⇄ post-approval same-source readings for the three read rows. */
    queryFactsLedger: () => deepFreeze([...queryFactsLedger]),
    /** The three read rows whose durable target is resolved (74/75/76). */
    queryTargetNames: Object.freeze([...QUERY_TARGET_NAMES]),
    /** THE SEAT ITSELF — the exact function the adapter was handed above,
     *  published so the mount owner's spec drives the REAL seat (never a
     *  stub of it) leg by leg. Production dispatch reaches it only through
     *  the adapter's own `admit` call inside the placed definition. */
    admitSeat: wireAdmit,
  })
  observe({ event: 'b-team-wire:assembled', adapterRevision: A5_B_TEAM_ADAPTER_REVISION, mounted: adapterResult.definitions.map((definition) => definition.name) })
  return assembly
}
