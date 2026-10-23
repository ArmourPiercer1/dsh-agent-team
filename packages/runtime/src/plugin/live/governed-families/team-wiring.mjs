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

export const A5_B_TEAM_WIRING_REVISION = 1

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
  // A durable QUERY claim that no public Team read answers is not admitted.
  CLAIM_UNVERIFIED: 'P_B_TEAM_WIRE_CLAIM_UNVERIFIED',
  FACTS_ABSENT: 'P_B_TEAM_WIRE_FACTS_ABSENT',
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
function mintTargetManifest (plan) {
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
/**
 * THE DURABLE ROSTER READER (root 20:15 ①): the seat's verification of a
 * QUERY target reads the PUBLIC durable Team roster — `memberInstances.list`
 * over this Team's root, the same published read four other production sites
 * already use (agent-bindings:1088 / :2053 / :3563 / :4791). It answers facts
 * DERIVED FROM THE ROW'S OWN CONTENT (the row's `instanceId`, its
 * `childSessionId` pairing, its `templateId`), never a count standing in for
 * identity and never a caller-supplied answer.
 *
 * `listMemberInstances` is injected as the published seam itself, so the
 * reader holds no state, caches nothing, and reads the store again on every
 * call (a roster that moved between calls is read as it now is).
 */
export function createTeamRosterFacts (input) {
  const teamRoot = isRecord(input) ? input.teamRoot : undefined
  const listMemberInstances = isRecord(input) ? input.listMemberInstances : undefined
  if (typeof teamRoot !== 'string' || teamRoot.length === 0 || typeof listMemberInstances !== 'function') {
    throw new Error(String(WIRE.INPUT_INVALID) + ': the roster reader needs the durable teamRoot and the published memberInstances.list seam')
  }
  const rowsFor = (root) => (root === teamRoot ? listMemberInstances() : [])
  return Object.freeze({
    isTeamRoot: (root) => root === teamRoot,
    memberExists: (root, instanceId) => {
      for (const row of rowsFor(root)) {
        if (isRecord(row) && String(row.instanceId ?? '') === instanceId) return true
      }
      return false
    },
    // The row's own durable content, for the leaf mint's identity fields (NOT
    // a size, NOT a synthesized id): undefined when the roster does not carry
    // the instance at all.
    memberRow: (root, instanceId) => {
      for (const row of rowsFor(root)) {
        if (isRecord(row) && String(row.instanceId ?? '') === instanceId) {
          const childSessionId = String(row.childSessionId ?? '')
          const templateId = String(row.templateId ?? '')
          return Object.freeze({
            instanceId: String(row.instanceId),
            ...(childSessionId.length === 0 ? {} : { childSessionId }),
            ...(templateId.length === 0 ? {} : { templateId }),
          })
        }
      }
      return undefined
    },
    rosterRows: (root) => rowsFor(root).filter((row) => isRecord(row) && typeof row.instanceId === 'string' && row.instanceId.length > 0)
      .map((row) => String(row.instanceId)),
  })
}

export function buildTeamOpsWiring (input = {}) {
  if (!isRecord(input)) return wiringRefuse(WIRE.INPUT_INVALID, 'the wiring bridge takes one input record')
  const knownInput = new Set(['realmId', 'providerId', 'readNative', 'liveNative', 'teamSet', 'placementFeed', 'definitionIdentityOf', 'correlationOf', 'pa', 'observe', 'durableFacts'])
  for (const key of Object.keys(input)) {
    if (!knownInput.has(key)) {
      return wiringRefuse(WIRE.INPUT_INVALID, `unknown wiring input '${key}' — the bridge takes exactly {realmId, providerId, readNative, liveNative, teamSet, placementFeed, definitionIdentityOf, correlationOf, pa, observe}`)
    }
  }
  const { realmId, providerId, readNative, liveNative: liveNativeSeam, teamSet, placementFeed, pa, observe = () => {}, durableFacts } = input
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
  const stats = { admits: 0, admittedOnce: 0, admissionRefusals: 0, mintRefusals: 0, toolLawValues: 0, walks: 0, edges: 0, witnessed: 0 }

  // The three pure-read rows whose durable target is ALREADY a fact of this
  // Team (root 20:07's mature subset): the roster, the bound template set, one
  // member's durable config view. Their claims are verifiable from the
  // published reads, so they are verified. The seven write rows are NOT
  // claimed tested here — their targets carry the write dimension and the
  // named gaps, and no label is forced onto them.
  const DURABLE_QUERY_NAMES = new Set(['team_list_members', 'team_list_templates', 'team_inspect_config'])

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
    // ROOT 20:11 (74/75/76 first): a durable QUERY target is verified against
    // the PUBLISHED Team reads before any PA question is minted — the caller's
    // root/member claim is an ASSERTION, and the durable roster is the
    // authority (root 20:07: the claims still ride raw). No public answer, no
    // admission: not a wider gate on the writes, exactly the three read rows
    // whose targets are already durable facts of this Team.
    if (DURABLE_QUERY_NAMES.has(String(name))) {
      if (durableFacts === undefined || durableFacts === null) {
        stats.admissionRefusals += 1
        observe({ event: 'b-team-wire:claim-facts-ABSENT', name, paEntry: false })
        return wiringRefuse(WIRE.FACTS_ABSENT, `'${String(name)}': a durable query target cannot be admitted while this world publishes no Team roster read — an unverified durable claim is never a pass (zero PA entry)`)
      }
      const rootClaim = isRecord(plan.target) && isRecord(plan.target.root) ? plan.target.root.claim : undefined
      const memberClaim = isRecord(plan.target) && isRecord(plan.target.member) ? plan.target.member.claim : undefined
      const rootOk = typeof rootClaim === 'string' && durableFacts.isTeamRoot(rootClaim) === true
      const memberOk = String(name) !== 'team_inspect_config'
        ? true
        : typeof memberClaim === 'string' && durableFacts.memberExists(String(rootClaim), memberClaim) === true
      if (!rootOk || !memberOk) {
        stats.admissionRefusals += 1
        observe({ event: 'b-team-wire:claim-UNVERIFIED', name, scope: rootOk ? 'member' : 'root', paEntry: false })
        return wiringRefuse(WIRE.CLAIM_UNVERIFIED, `'${String(name)}': the ${rootOk ? 'member' : 'root'} claim ${rootOk ? String(memberClaim) : String(rootClaim)} is not answered by the published Team roster — the durable target of a query is verified, not trusted (zero PA entry)`)
      }
    }
    const targetManifest = mintTargetManifest(plan)
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
        adapterRevision: A5_B_TEAM_ADAPTER_REVISION,
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
    /** THE SEAT ITSELF — the exact function the adapter was handed above,
     *  published so the mount owner's spec drives the REAL seat (never a
     *  stub of it) leg by leg. Production dispatch reaches it only through
     *  the adapter's own `admit` call inside the placed definition. */
    admitSeat: wireAdmit,
  })
  observe({ event: 'b-team-wire:assembled', adapterRevision: A5_B_TEAM_ADAPTER_REVISION, mounted: adapterResult.definitions.map((definition) => definition.name) })
  return assembly
}
