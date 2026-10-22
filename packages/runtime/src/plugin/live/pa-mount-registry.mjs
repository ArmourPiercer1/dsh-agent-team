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
function matchUniqueBindingEntry(surface, { family, seedNames = [] }) {
  if (surface === null || typeof surface !== 'object') return undefined
  if (typeof surface.entryOf !== 'function') return undefined
  if (typeof family !== 'string' || family.length === 0) return undefined
  const names = [...new Set([
    ...seedNames,
    ...(typeof surface.names === 'function' ? surface.names() ?? [] : []),
  ])].filter((n) => typeof n === 'string' && n.length > 0)
  const candidates = names
    .map((n) => surface.entryOf(n))
    .filter((e) => e !== undefined && e?.verified === true && e?.binding?.status === 'ACTIVE'
      && e?.binding?.bindingId === family)
  if (candidates.length !== 1) return undefined
  return candidates[0]
}

/** Resolve the binding FAMILY one call answers to: the identity the call
 *  carries wins; otherwise the caller's OWN placement spelling seeds the
 *  family through the surface (the seed is never the authority — the matcher
 *  above still has to find it UNIQUE). Unresolvable ⇒ undefined. */
function bindingFamilyOf(surface, { bindingId, placementName }) {
  if (typeof bindingId === 'string' && bindingId.length > 0) return bindingId
  if (typeof placementName !== 'string' || placementName.length === 0) return undefined
  const seed = surface?.entryOf?.(placementName)
  const family = seed?.binding?.bindingId
  return typeof family === 'string' && family.length > 0 ? family : undefined
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
async function readCallAuthorityFacts({ m, member, realmId, callId, bindingFamily, bindingSeeds, callEffects, requireApprovalPlan }) {
  // binding: the CURRENT dispatcher entry under the call's binding family.
  const surface = m.guard?.dispatcher?.surface
  const entry = matchUniqueBindingEntry(surface, { family: bindingFamily, seedNames: bindingSeeds })
  if (entry === undefined) return undefined
  const entryBinding = entry.binding
  if (typeof entryBinding.revision !== 'number' || entryBinding.revision < 1) return undefined
  if (typeof entryBinding.definitionIdentity !== 'string' || entryBinding.definitionIdentity.length === 0) return undefined
  // one governed lane: the plane the mount answers for must BE the call's realm.
  if (m.plane?.realmId === undefined || m.plane.realmId !== realmId) return undefined
  // beneficiary: the mount's DURABLE attribution ONLY (the manifest carries
  // no such field to compare — comparing a non-existent self-report was
  // the bug; the pure core trusts the verifier's own rung comparison).
  const beneficiary = m.beneficiaryAuthority
  if (beneficiary !== 'leader' && beneficiary !== 'member') return undefined
  // tuple + blueprint facts: the permission lane's OWN currentBinding
  // source, read fresh; unhealthy lane ⇒ undefined (never a stale answer).
  const plane = typeof m.readers?.permissionPlane === 'function' ? m.readers.permissionPlane() : m.readers?.permissionPlane
  const callFacts = plane?.currentCallFacts?.(member.teamSessionId, member.instanceId)
  if (callFacts === undefined || callFacts.healthy !== true) return undefined
  const tuple = callFacts.tuple
  if (
    tuple === undefined || typeof tuple !== 'object'
    || typeof tuple.blueprintId !== 'string' || tuple.blueprintId.length === 0
    || typeof tuple.contentHash !== 'string' || tuple.contentHash.length === 0
    || typeof tuple.revision !== 'number'
    || typeof tuple.templateId !== 'string' || tuple.templateId.length === 0
    || typeof tuple.cwd !== 'string' || tuple.cwd.length === 0
  ) return undefined
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
  // 9e (AUTH ruling 3): NO bindingSnapshotDrift output — the named contract
  // is exactly the 12 fields; the verifier performs the 11-field full-tuple
  // + assurance comparison itself. A pre-computed flag here would invite
  // trusting the flag over the real comparison.
  return {
    facts: {
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
 * walked, this call's binding identity (the bindingId FAMILY, resolved from
 * the identity the call carries or from the caller's own dispatcher
 * placement), the member/beneficiary attribution and the mount.
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
  const { mount, rootSessionId, instanceId, realmId, callId, requestedEffects, bindingId, placementName } = input
  if (typeof rootSessionId !== 'string' || rootSessionId.length === 0) return undefined
  if (typeof instanceId !== 'string' || instanceId.length === 0) return undefined
  if (typeof realmId !== 'string' || realmId.length === 0) return undefined
  if (typeof callId !== 'string' || callId.length === 0) return undefined
  if (requestedEffects === null || typeof requestedEffects !== 'object' || !Array.isArray(requestedEffects.effects)) return undefined
  if (typeof requestedEffects.fingerprint !== 'string' || requestedEffects.fingerprint.length === 0) return undefined
  const m = mount ?? resolvePaMount(rootSessionId, instanceId)
  if (m === undefined) return undefined
  const member = { teamSessionId: String(rootSessionId), instanceId: String(m.instanceId) }
  if (member.instanceId !== String(instanceId)) return undefined
  const surface = m.guard?.dispatcher?.surface
  const bindingFamily = bindingFamilyOf(surface, { bindingId, placementName })
  if (bindingFamily === undefined) return undefined
  const read = await readCallAuthorityFacts({
    m,
    member,
    realmId: String(realmId),
    callId: String(callId),
    bindingFamily,
    bindingSeeds: [placementName],
    callEffects: requestedEffects,
    requireApprovalPlan: false,
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
  return { ...read.facts, planSnapshot: read.planSnapshot, authorityGeneration: read.authorityGeneration }
}
