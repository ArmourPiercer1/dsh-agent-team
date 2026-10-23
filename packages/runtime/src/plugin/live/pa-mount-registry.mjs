/**
 * PR358-B (CENTER half): the narrow (teamRoot, instanceId) → CURRENT mount
 * index plus the call-level facts adapter the ONE injected PA verifier
 * awaits per gate. Deliberately NOT an authority ledger: entries exist only
 * while a mount is published, carry only the trusted references the fact
 * readers need, and every read re-answers them fresh (no cached facts, no
 * long-lived tuple).
 *
 * Facts law (root ruling B; contract = control/types.ts PaCallFacts):
 *  - binding is the dispatcher's CURRENT entry, found by the binding's OWN
 *    identity (`matchUniqueBindingEntry` below): verified + ACTIVE, real
 *    ToolBinding (revision, definitionIdentity, realm) — a synthetic
 *    `plane-row` binding is NEVER an authority; the manifest's snapshot is
 *    CONTRASTED against it, never believed, and NO name lookup is believed
 *    either (a seeded name only points at a family, the family decides);
 *  - policy/blueprint/ceiling facts come from the ONE authority the
 *    permission plane already reads (currentBinding tuple, durable overlay
 *    generation via overlay.latest, the envelope readers) — references
 *    only, never a stringify of any policy reader;
 *  - effects/planSnapshot come from the mount's LIVE PA plan for this call
 *    (the same canonical identity the plan walked); no live plan = this
 *    mount is not answering this call = undefined;
 *  - beneficiary is the mount's DURABLE attribution; the manifest's
 *    self-report must match or the facts are refused;
 *  - ANY missing, unhealthy, or contradicting source ⇒ undefined ⇒
 *    `authority-undetermined`. There is no 0/1/empty-envelope fallback.
 */

const mounts = new Map() // teamRoot -> Map(instanceId -> entry)

// ── A5-M2 (root ruling, fix-2 round): THE governed-family registration table ──
// The trusted family fact must reach BOTH consumption points through ONE
// write: the actual call-level facts (the plane awaits these on every PA
// path) AND the durable Control verifier (root.ts injects the same read into
// the ONE verifier). Both points resolve the live binding inside
// `readCallAuthorityFacts` below — so THAT is the single fill site, and the
// table lives here, next to the fill, not in one caller's closure. A fill
// kept private to one caller (the previous bindings-local wrapper) left the
// durable verifier permanently reading "no registration" — every governed row
// would answer DRIFT the moment its family was checked against current facts.
// MOUNT-TIME law (unchanged): the table starts EMPTY — an unmounted world
// keeps its exact bytes, writes nothing, and neither reader answers — and an
// entry is written by the setup keyed by the RUNTIME definition identity the
// seam's install pass minted for the placed row (read back through the
// plane's `placementFeed` AFTER publish). One identity, one family: a second
// DIFFERENT claim on the same identity is a config defect and fails the
// setup, never a replacement. The leg's `governedFamilies` gate reads THIS
// same object — one table, three readers, zero second sources.
export const A5_GOVERNED_FAMILIES = Object.create(null)

/** Write ONE mount-time family registration (idempotent for an identical
 *  claim; a conflicting claim throws — see the table law above). */
export function registerA5GovernedFamily(definitionIdentity, entry) {
  if (typeof definitionIdentity !== 'string' || definitionIdentity.length === 0) {
    throw new TypeError('A5 governed-family registration: the runtime definition identity must be a non-empty string (keying on anything else is a second identity system)')
  }
  if (entry === null || typeof entry !== 'object'
    || typeof entry.familyId !== 'string' || entry.familyId.length === 0
    || !Number.isInteger(entry.adapterRevision) || entry.adapterRevision < 0
    || typeof entry.providerIdentity !== 'string' || entry.providerIdentity.length === 0) {
    throw new TypeError('A5 governed-family registration: {familyId, adapterRevision, providerIdentity} is the frozen registration shape (the leg compares exactly these three fields)')
  }
  const existing = A5_GOVERNED_FAMILIES[definitionIdentity]
  if (existing !== undefined) {
    if (existing.familyId === entry.familyId && existing.adapterRevision === entry.adapterRevision && existing.providerIdentity === entry.providerIdentity) return
    throw new Error(`A5 governed-family registration: definition identity '${definitionIdentity}' is already governed as family '${existing.familyId}'; a second different claim ('${entry.familyId}') on one identity is a config defect, never a re-mount to paper over`)
  }
  A5_GOVERNED_FAMILIES[definitionIdentity] = Object.freeze({ ...entry })
}

/** The single read accessor of the table (a fill is an answer, never a
 *  guess: an identity that was never registered answers undefined). */
export function a5GovernedFamilyFor(definitionIdentity) {
  if (typeof definitionIdentity !== 'string' || definitionIdentity.length === 0) return undefined
  return A5_GOVERNED_FAMILIES[definitionIdentity]
}

/** Publish the CURRENT mount for (teamRoot, instanceId). Called by
 *  agentSetup AFTER bindOwnTools + publish succeeded. Returns the MOUNT
 *  IDENTITY — the opaque handle the matching revoke must present; a key
 *  alone never revokes somebody else's mount (9e review: an old disposer
 *  must not delete the newer mount for the same pair). */
export function publishPaMount(teamRoot, instanceId, entry) {
  const root = String(teamRoot)
  const id = String(instanceId)
  if (!mounts.has(root)) mounts.set(root, new Map())
  const mount = Object.freeze({ ...entry, identity: Symbol(`pa-mount:${root}:${id}`) })
  mounts.get(root).set(id, mount)
  return mount.identity
}

/** Revoke by IDENTITY (teardown start). The live mount for the pair is
 *  removed ONLY when the presented identity is the one currently published
 *  for that pair; a stale disposer (old identity) clears nothing. */
export function revokePaMount(teamRoot, instanceId, identity) {
  const bucket = mounts.get(String(teamRoot))
  if (bucket === undefined) return false
  const live = bucket.get(String(instanceId))
  if (live === undefined || identity === undefined || live.identity !== identity) return false
  return bucket.delete(String(instanceId))
}

/** The live mount for the pair, or undefined. */
export function resolvePaMount(teamRoot, instanceId) {
  return mounts.get(String(teamRoot))?.get(String(instanceId))
}

function toSlot(value) {
  // The closed ceiling-slot vocabulary: a real document, a stated
  // `absent`, or a stated `declared` wrapper. Anything else (including the
  // lane's `unavailable` abstention) is NOT a slot — the caller fails the
  // whole facts answer closed.
  if (value === null || typeof value !== 'object') return undefined
  if (value.status === 'absent') return { status: 'absent' }
  if (value.status === 'unavailable') return undefined
  if (value.status === 'declared' && value.document !== null && typeof value.document === 'object') return value
  if (Array.isArray(value.rules) || typeof value.version === 'number' || typeof value.scope === 'string') return value
  return undefined
}

async function readCeiling(readers, teamSessionId, instanceId) {
  // The two ceiling slots, read through the ONE facts object's readers.
  // An abstained/unavailable read (the lane's own UNKNOWN marker) is NOT a
  // slot value — the whole facts answer becomes undefined (fail closed).
  const [hard, expansion] = await Promise.all([
    readers?.teamHardEnvelope?.(teamSessionId, instanceId),
    readers?.permissionEnvelope?.(teamSessionId, instanceId),
  ])
  if (hard === undefined || expansion === undefined) return undefined
  const teamHardEnvelope = toSlot(hard)
  const permissionMutationEnvelope = toSlot(expansion)
  if (teamHardEnvelope === undefined || permissionMutationEnvelope === undefined) return undefined
  return { teamHardEnvelope, permissionMutationEnvelope }
}

/**
 * THE ONE binding-identity matcher (9e AUTH audit (e) law; A5-M1 D).
 *
 * A dispatcher entry IS the call's binding only when its bindingId FAMILY is
 * carried by exactly ONE verified + ACTIVE entry on the surface: a revise
 * keeps the family, a re-bind under another family is refused, so the family
 * is a name-unique, durable-ish key that survives a backend/namespace rename
 * (`bash` ≠ dispatcher `team_bash`) which a name lookup never does.
 *
 * `seedNames` only POINT AT the family (the manifest's backend toolName, the
 * plane's own placement spelling); no seed is ever believed — an entry found
 * under a seed still has to be the unique carrier of `family`. Zero or
 * ambiguous candidates ⇒ `undefined`: never a guess, never "first wins".
 */
function matchUniqueBindingEntry(surface, { family, seedNames = [] }, report) {
  if (surface === null || typeof surface !== 'object') { report?.('no-surface'); return undefined }
  if (typeof surface.entryOf !== 'function') { report?.('surface-no-entry-of'); return undefined }
  if (typeof family !== 'string' || family.length === 0) { report?.('no-binding-family'); return undefined }
  const names = [...new Set([
    ...seedNames,
    ...(typeof surface.names === 'function' ? surface.names() ?? [] : []),
  ])].filter((n) => typeof n === 'string' && n.length > 0)
  const candidates = names
    .map((n) => surface.entryOf(n))
    .filter((e) => e !== undefined && e?.verified === true && e?.binding?.status === 'ACTIVE'
      && e?.binding?.bindingId === family)
  if (candidates.length !== 1) {
    if (report !== undefined) {
      // A5-M1-D, report-only: the verdict is ALREADY fixed (this branch returns
      // what it always returned). A reader that asked gets the one fact this line
      // can see — no carrier of the family at all, a carrier the surface has not
      // verified, a carrier that is no longer ACTIVE, or more than one carrier of
      // one family (which this matcher refuses to arbitrate). The second look is
      // a filter over the same `names`, never a new candidate rule.
      const carriers = candidates.length > 1 ? null : names.map((n) => surface.entryOf(n)).filter((e) => e?.binding?.bindingId === family)
      report(candidates.length > 1
        ? `ambiguous-family:${String(candidates.length)}`
        : carriers.length === 0
          ? 'no-entry-for-placement'
          : carriers.every((e) => e.verified !== true) ? 'entry-not-verified' : 'binding-not-active')
    }
    return undefined
  }
  return candidates[0]
}

/** Resolve the binding FAMILY one call answers to, from the ONE trust input
 *  this entry takes: the CALLER's own placement spelling (the plane's own row
 *  name), read through the live surface. The seed is never the authority —
 *  `matchUniqueBindingEntry` still has to find the family's unique carrier.
 *  A5-M1 root ruling on 091f56d37: an identity SUPPLIED BY A CALLER (e.g. the
 *  bindingId a durable row carries) is NOT an input here at all — a correct
 *  manifest may never become the precondition for reading the real binding,
 *  and a foreign one must never steer the read. Callers that need to verify a
 *  row COMPARE the row's binding afterwards (`readPaCallFacts` does exactly
 *  that, against the tuple this read answered). Unresolvable ⇒ undefined. */
function bindingFamilyOf(surface, { placementName }, report) {
  if (typeof placementName !== 'string' || placementName.length === 0) { report?.('no-placement-name'); return undefined }
  const seed = surface?.entryOf?.(placementName)
  if (seed === undefined) { report?.('no-seed-entry'); return undefined }
  const family = seed?.binding?.bindingId
  if (typeof family === 'string' && family.length > 0) return family
  // A5-M1-D: the seed EXISTS and still answered no family — that is a fact of its
  // own, and it is the only thing this line can see.
  report?.('seed-no-binding-id')
  return undefined
}

/**
 * THE SHARED CALL-LEVEL READ: current facts + the unique binding identity,
 * over ONE resolved mount. No durable Control row is involved: `callId` is a
 * CALL identity (the plane's own live plan key), not a row id. Both entries
 * below (the durable Control adapter and the public call-level entry) are
 * thin identity-derivation wrappers around this — there is exactly one
 * implementation of the facts law in this module.
 *
 * Returns `{ facts, planSnapshot, authorityGeneration }` where `facts` are
 * the ten named members that precede `planSnapshot` in the contract, in
 * contract order, or `undefined` for ANY missing / unhealthy / contradicting
 * source. `planSnapshot` is `undefined` only when the call carries no
 * approval question (the all-allow case: `requireApprovalPlan: false`) — a
 * stated absence, never a synthesized snapshot; with `requireApprovalPlan`
 * the row path fails closed exactly as before.
 */
async function readCallAuthorityFacts({ m, member, realmId, callId, bindingFamily, bindingSeeds, callEffects, requireApprovalPlan, report }) {
  // binding: the CURRENT dispatcher entry under the call's binding family.
  const surface = m.guard?.dispatcher?.surface
  const entry = matchUniqueBindingEntry(surface, { family: bindingFamily, seedNames: bindingSeeds }, report)
  if (entry === undefined) return undefined // the matcher named WHICH arm of its own law
  const entryBinding = entry.binding
  if (typeof entryBinding.revision !== 'number' || entryBinding.revision < 1) { report?.('bad-binding-revision'); return undefined }
  if (typeof entryBinding.definitionIdentity !== 'string' || entryBinding.definitionIdentity.length === 0) { report?.('bad-definition-identity'); return undefined }
  // one governed lane: the plane the mount answers for must BE the call's realm.
  // A5-M1-D: the two attribution arms on this branch, each naming what THIS line
  // sees (no realm on the mount vs. a realm that is not this call's).
  if (m.plane?.realmId === undefined) { report?.('no-mount-realm'); return undefined }
  if (m.plane.realmId !== realmId) { report?.('realm-mismatch'); return undefined }
  // beneficiary: the mount's DURABLE attribution ONLY (the manifest carries
  // no such field to compare — comparing a non-existent self-report was
  // the bug; the pure core trusts the verifier's own rung comparison).
  const beneficiary = m.beneficiaryAuthority
  // The VALUE is never printed (it is durable attribution, not an identity face);
  // the code says only that the mount carries no member/leader attribution.
  if (beneficiary !== 'leader' && beneficiary !== 'member') { report?.('bad-beneficiary-authority'); return undefined }
  // tuple + blueprint facts: the permission lane's OWN currentBinding
  // source, read fresh; unhealthy lane ⇒ undefined (never a stale answer).
  const plane = typeof m.readers?.permissionPlane === 'function' ? m.readers.permissionPlane() : m.readers?.permissionPlane
  const callFacts = plane?.currentCallFacts?.(member.teamSessionId, member.instanceId)
  // A5-M1-D: this early exit runs BEFORE the tuple block below, so it needs its
  // own name or the first failure of a call would be blamed on the tuple. Two
  // different facts on this one line: the lane answered nothing, or the lane
  // STATED it is not healthy. Neither is explained here — the lane owns why.
  if (callFacts === undefined) { report?.('no-call-facts-answer'); return undefined }
  if (callFacts.healthy !== true) { report?.('unhealthy-call-facts'); return undefined }
  const tuple = callFacts.tuple
  if (
    tuple === undefined || typeof tuple !== 'object'
    || typeof tuple.blueprintId !== 'string' || tuple.blueprintId.length === 0
    || typeof tuple.contentHash !== 'string' || tuple.contentHash.length === 0
    // A5-M1-D-fix: the tuple's revision is the blueprint revision AS THE LANE
    // PRODUCES IT — `permission-plane.ts:684` emits `revision:
    // String(blueprint.revision)` and its `BindingTuple` declares
    // `readonly revision: string` (`:508`). Asking for a number here made every
    // production call fail this conjunct and the read answer undefined. The
    // contract is the REAL string identity, compared exactly (no coercion: a
    // number, a blank string or a non-string never becomes a revision).
    || typeof tuple.revision !== 'string' || tuple.revision.length === 0
    || typeof tuple.templateId !== 'string' || tuple.templateId.length === 0
    || typeof tuple.cwd !== 'string' || tuple.cwd.length === 0
  ) {
    // A5-M1-D, report-only: the verdict is the block's own conjuncts (untouched
    // order, untouched outcome). The name is emitted ONLY when the revision
    // conjunct itself is what failed — type versus empty value are two different
    // facts and both are observable here; when a different member of the tuple
    // failed, nothing is claimed (that arm stays uncoded by ruling).
    if (report !== undefined && (typeof tuple?.revision !== 'string' || tuple.revision.length === 0)) {
      report(typeof tuple?.revision === 'string' ? 'bad-tuple-revision-empty' : 'bad-tuple-revision-not-a-string')
    }
    return undefined
  }
  const providerVersion = callFacts.providerVersion
  if (typeof providerVersion !== 'string' || providerVersion.length === 0) return undefined
  // durable overlay generation (the decision lane's OWN `latest` source:
  // the highest generation IS the authority; no row = generation 0 as the
  // REAL durable state, a throwing read = undefined, never a fallback).
  let overlayGeneration
  try {
    const snapshot = await m.readers?.overlaySnapshot?.(member.teamSessionId, member.instanceId)
    if (snapshot === null) return undefined
    overlayGeneration = snapshot === undefined ? 0 : Number(snapshot?.metadata?.generation)
  } catch {
    return undefined
  }
  if (!Number.isFinite(overlayGeneration) || overlayGeneration < 0) return undefined
  // ceiling pair: the TWO current realm-scoped documents through the ONE
  // facts readers; any abstention ⇒ undefined.
  const ceiling = await readCeiling(m.readers, member.teamSessionId, member.instanceId)
  if (ceiling === undefined) return undefined
  // the CURRENT expansion-plane policy document + deny projection: the
  // mount's OWN production assembly derived them from the REAL template
  // policy (the same sources the admission gates walk).
  const assembly = m.plane?.assembly
  if (typeof assembly?.policyDocument !== 'function' || typeof assembly?.denySources !== 'function') return undefined
  let policyDocument
  let denySources
  try {
    policyDocument = assembly.policyDocument()
    denySources = assembly.denySources()
  } catch {
    return undefined
  }
  if (policyDocument === null || typeof policyDocument !== 'object') return undefined
  if (!Array.isArray(denySources)) return undefined // EMPTY means empty; a broken reader is undefined
  // effects + plan snapshot: the mount's LIVE PA plan for this call. The
  // plan is keyed by the CALL identity; a call that walked no approval
  // question has NO plan row — and that is a stated absence, not a missing
  // source (the all-allow path answers through `planSnapshot: undefined`).
  const livePlan = m.plane?.livePaPlan?.get?.(String(callId ?? ''))
  if (livePlan === undefined && requireApprovalPlan === true) return undefined
  let effects = livePlan !== undefined ? livePlan.requestedEffects : callEffects
  if (livePlan !== undefined && callEffects !== undefined) {
    // ONE call, ONE effect set: the identity this call walked and the
    // identity the live plan recorded must be the same set, or the mount is
    // answering a different call than the one asking.
    if (livePlan.requestedEffects?.fingerprint !== callEffects.fingerprint) return undefined
    effects = livePlan.requestedEffects
  }
  if (effects === null || typeof effects !== 'object' || !Array.isArray(effects.effects)) return undefined
  let planSnapshot
  if (livePlan !== undefined) {
    if (typeof livePlan.effectSetFingerprint !== 'string' || livePlan.effectSetFingerprint.length === 0) return undefined
    if (!Array.isArray(livePlan.perEffectRequired) || livePlan.perEffectRequired.length !== effects.effects.length) return undefined
    planSnapshot = {
      approvalCaseId: String(livePlan.approvalCaseId ?? ''),
      effectSetFingerprint: livePlan.effectSetFingerprint,
      perEffectRequired: livePlan.perEffectRequired,
    }
  }
  // 9e-2 (AUTH fact list): `assembly.authorityGeneration()` DOES NOT exist
  // on the ProductionAdmissionAssembly face (kernel holds the generator in
  // a private closure — nothing reads back). The current generation is read
  // from the PLANE-LOCAL READER: the SAME `() => number` source function
  // the root injected into the assembly's config (one source, verified by
  // construction), surfaced on the plane's mount face. Never synthesized.
  let authorityGeneration
  try {
    const reader = m.plane?.authorityGeneration
    if (typeof reader !== 'function') return undefined
    authorityGeneration = reader()
  } catch {
    return undefined
  }
  if (typeof authorityGeneration !== 'number' || !Number.isInteger(authorityGeneration) || authorityGeneration < 0) return undefined
  // A5-M2 (root fix-2 round): THE trusted registration fact rides the ONE read.
  // Keyed by the live binding entry's OWN definitionIdentity — the same identity
  // the leg gate and the registration write both speak — so the actual call-level
  // facts and the durable verifier can never disagree about which family (if any)
  // governs this binding. Unregistered ⇒ no field (the verifier's own law reads
  // an absent registration as absent, never as a stale statement).
  const governedFamily = a5GovernedFamilyFor(entryBinding.definitionIdentity)
  // 9e (AUTH ruling 3): NO bindingSnapshotDrift output — the named contract
  // is exactly the 12 fields; the verifier performs the 11-field full-tuple
  // + assurance comparison itself. A pre-computed flag here would invite
  // trusting the flag over the real comparison.
  return {
    facts: {
      ...(governedFamily === undefined ? {} : { governedFamily }),
      policySource: {
        staticLayerRefs: Object.freeze([
          `blueprint:${String(tuple.blueprintId)}@${String(tuple.revision)}#${String(tuple.contentHash)}`,
          `template:${String(tuple.templateId)}`,
        ]),
        overlayGeneration,
      },
      realmId: m.plane.realmId,
      ceiling,
      policyDocument,
      denySources,
      effects,
      member,
      beneficiaryAuthority: beneficiary,
      binding: entryBinding,
      blueprint: {
        revision: tuple.revision,
        contentHash: tuple.contentHash,
        templateId: tuple.templateId,
        cwd: tuple.cwd,
        providerVersion,
      },
    },
    planSnapshot,
    authorityGeneration,
  }
}

/**
 * THE PUBLIC CALL-LEVEL ENTRY (A5-M1 B): the CURRENT facts of ONE live call,
 * keyed by the REAL call identity — realmId, callId, the effect set this call
 * walked, the caller's OWN dispatcher placement (which resolves to the binding
 * family behind the call), the member/beneficiary attribution and the mount.
 * The placement spelling is the ONLY identity input: a caller-supplied
 * `bindingId` (the identity a row carries) is not read, never a precondition
 * and never a steer — the row's binding is COMPARED afterwards.
 *
 * NO durable Control row is required: no `requestId`, no manifest, no row.
 * That is the whole point — the plane's execution edge must be able to await
 * the SAME read on the all-allow path, where no row was ever minted (and on
 * the ask path, where it verifies the standing approval). The durable
 * Control verifier keeps its own entry (`readPaCallFacts`), which layers the
 * row's manifest validation on top of the same shared read.
 *
 * Answer shape (never a partial `PaCallFacts`):
 *  - `{ kind: 'call-facts', facts }` — the complete 12-field contract (the
 *    call walked an approval question, so `planSnapshot` has a real source);
 *  - `{ kind: 'no-approval-question', facts }` — the same named facts
 *    MINUS `planSnapshot`, stated as what it is: this call has no approval
 *    case, so that source does not exist. It is never synthesized to make a
 *    12th field appear;
 *  - `undefined` — ANY missing / unhealthy / contradicting source, exactly
 *    the facts law (the caller fails closed; there is no defaulted shape).
 */
export async function readPaCallFactsForCall(input = {}) {
  const { mount, rootSessionId, instanceId, realmId, callId, requestedEffects, placementName, diagnose } = input
  // A5-M1-D: one LOCAL sink for the ONE question a caller cannot answer from an
  // `undefined` answer — which arm of THIS call's own identity did not hold.
  // Output-only by construction: it is called on the branch that is already
  // returning `undefined`, nothing reads it back, it holds no state between
  // calls, and a sink that throws is swallowed here so it can never reach the
  // verdict. It covers the arms a call must cross to reach its own binding: the
  // six input guards, the mount lookup, the placement → family → unique-carrier
  // resolution, the binding tuple fields, and the mount's own realm / beneficiary
  // attribution. Everything from the permission lane onward (that lane, the
  // blueprint tuple, the provider version, the durable overlay, the ceiling pair,
  // the policy projection, the live plan, the generation reader) keeps answering
  // plain `undefined` EXACTLY as the baseline — so an `entry-cause` that names
  // nothing AFTER a call that did resolve its binding is itself the localisation:
  // the refusal came from that untouched block. This delta does not narrate the
  // whole facts protocol, and it decides nothing.
  const report = typeof diagnose !== 'function' ? undefined : (code) => {
    try {
      diagnose({ code })
    } catch {
      // never the verdict's problem
    }
  }
  // A5-M1-D: these six arms fire before anything is read, so they are named too
  // — each one is the fact this very line checks (a missing/blank identity, a
  // non-array effect set, an absent fingerprint), nothing more.
  if (typeof rootSessionId !== 'string' || rootSessionId.length === 0) { report?.('no-root-session-id'); return undefined }
  if (typeof instanceId !== 'string' || instanceId.length === 0) { report?.('no-instance-id'); return undefined }
  if (typeof realmId !== 'string' || realmId.length === 0) { report?.('no-realm-id'); return undefined }
  if (typeof callId !== 'string' || callId.length === 0) { report?.('no-call-id'); return undefined }
  if (requestedEffects === null || typeof requestedEffects !== 'object' || !Array.isArray(requestedEffects.effects)) { report?.('bad-call-effects'); return undefined }
  if (typeof requestedEffects.fingerprint !== 'string' || requestedEffects.fingerprint.length === 0) { report?.('bad-effect-fingerprint'); return undefined }
  const m = mount ?? resolvePaMount(rootSessionId, instanceId)
  if (m === undefined) { report?.('no-mount'); return undefined }
  const member = { teamSessionId: String(rootSessionId), instanceId: String(m.instanceId) }
  if (member.instanceId !== String(instanceId)) { report?.('mount-instance-mismatch'); return undefined }
  const surface = m.guard?.dispatcher?.surface
  const bindingFamily = bindingFamilyOf(surface, { placementName }, report)
  if (bindingFamily === undefined) return undefined // bindingFamilyOf named its own arm
  const read = await readCallAuthorityFacts({
    m,
    member,
    realmId: String(realmId),
    callId: String(callId),
    bindingFamily,
    bindingSeeds: [placementName],
    callEffects: requestedEffects,
    requireApprovalPlan: false,
    report,
  })
  if (read === undefined) return undefined
  if (read.planSnapshot === undefined) {
    return { kind: 'no-approval-question', facts: { ...read.facts, authorityGeneration: read.authorityGeneration } }
  }
  return { kind: 'call-facts', facts: { ...read.facts, planSnapshot: read.planSnapshot, authorityGeneration: read.authorityGeneration } }
}

/**
 * The DURABLE call-level facts reader — the ONE entry the injected Control
 * verifier awaits per gate (contract: control/types.ts `PaCallFacts`).
 * `mount.readers` is wired by agentSetup from the REAL seams:
 * { permissionPlane (live ref), overlaySnapshot (async durable latest),
 *   teamHardEnvelope, permissionEnvelope, providerVersion }.
 *
 * This entry adds the ROW's identity on top of the shared read and NOTHING
 * else: the row must exist (requestId + parsed manifest), the manifest's
 * member/realm snapshots must still hold against the durable reads, and the
 * row implies an approval question (no live plan ⇒ undefined). The shared
 * read itself lives in `readCallAuthorityFacts` — the public entry above
 * uses the same implementation, so the two can never drift.
 *
 * The row's bindingId is used here as a LOOKUP KEY only, and that is the one
 * shape in which a row identity may be used at all: the read still has to find
 * a unique verified+ACTIVE carrier of that family plus every other live
 * source, so a row that names a family nothing carries — or a family whose
 * live tuple differs from what the row recorded — answers `undefined` /
 * answers a tuple the verifier then rejects (`pa-control-bridge.ts` compares
 * the binding field by field). A row can therefore only ever FAIL here, never
 * authorize: the authority stays the live surface, exactly as the public
 * entry has it.
 */
export async function readPaCallFacts({ rootSessionId, requestId, manifest, decider, stage, mount }) {
  void stage
  void decider // the REAL decider rides PaEffectsVerifierInput, never the facts
  if (!rootSessionId || !requestId || manifest === undefined) return undefined
  // 9e fix-2 (AUTH signature exchange): the PARSED manifest is FLAT — top-
  // level `callId`, `member{teamSessionId,instanceId}`, `binding.toolName`.
  // There is NO `request.*` wrapper and NO beneficiary self-report field;
  // guessing either was the review finding (it silently answered undefined).
  const m = mount ?? resolvePaMount(rootSessionId, manifest?.member?.instanceId ?? '')
  if (m === undefined) return undefined
  const snapshotBindingId = manifest?.binding?.bindingId
  if (typeof snapshotBindingId !== 'string' || snapshotBindingId.length === 0) return undefined
  // beneficiary / member: the mount's DURABLE attribution, with the
  // manifest's snapshot CONTRASTED against it (never believed).
  const member = { teamSessionId: String(rootSessionId), instanceId: String(m.instanceId) }
  const manifestMember = manifest?.member
  if (manifestMember === undefined) return undefined
  if (String(manifestMember.teamSessionId ?? '') !== member.teamSessionId) return undefined
  if (String(manifestMember.instanceId ?? '') !== member.instanceId) return undefined
  const read = await readCallAuthorityFacts({
    m,
    member,
    realmId: String(manifest?.realmId ?? ''),
    callId: String(manifest?.callId ?? ''),
    bindingFamily: snapshotBindingId,
    // The manifest's toolName is the BACKEND name (`bash` ≠ dispatcher
    // `team_bash`): it only seeds the family scan, it never selects an entry.
    bindingSeeds: [String(manifest?.binding?.toolName ?? '')],
    callEffects: undefined,
    requireApprovalPlan: true,
  })
  if (read === undefined || read.planSnapshot === undefined) return undefined
  // A5-M2 r17 FIX (center): the mount's lexical containment seam rides the
  // RUNTIME facts object ONLY (never the durable contract): the decision-side
  // verifier hands it to the pure core exactly as the production Part A and
  // final edges do, so a subtree rule reads the SAME answer on both sides.
  return {
    ...read.facts,
    planSnapshot: read.planSnapshot,
    authorityGeneration: read.authorityGeneration,
    ...(typeof m.fsSeam?.subtreeContains === 'function' ? { subtreeContains: m.fsSeam.subtreeContains } : {}),
  }
}
