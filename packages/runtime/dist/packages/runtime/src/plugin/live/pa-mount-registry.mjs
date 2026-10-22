/**
 * PR358-B (CENTER half): the narrow (teamRoot, instanceId) → CURRENT mount
 * index plus the call-level facts adapter the ONE injected PA verifier
 * awaits per gate. Deliberately NOT an authority ledger: entries exist only
 * while a mount is published, carry only the trusted references the fact
 * readers need, and every read re-answers them fresh (no cached facts, no
 * long-lived tuple).
 *
 * Facts law (root ruling B; contract = control/types.ts PaCallFacts):
 *  - binding is the dispatcher's CURRENT entry (`dispatcher.surface
 *    .entryOf(toolName)`): verified + ACTIVE, real ToolBinding (revision,
 *    definitionIdentity, realm) — a synthetic `plane-row` binding is NEVER
 *    an authority; the manifest's snapshot is CONTRASTED against it, never
 *    believed;
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
 * The call-level facts reader (contract: control/types.ts `PaCallFacts`).
 * `mount.readers` is wired by agentSetup from the REAL seams:
 * { permissionPlane (live ref), overlaySnapshot (async durable latest),
 *   teamHardEnvelope, permissionEnvelope, providerVersion }.
 */
export async function readPaCallFacts({ rootSessionId, requestId, manifest, decider, stage, mount }) {
  void stage
  void decider // the REAL decider rides PaEffectsVerifierInput, never the facts
  if (!rootSessionId || !requestId || manifest === undefined) return undefined
  // 9e fix-2 (AUTH signature exchange): the PARSED manifest is FLAT — top-
  // level `callId`, `member{teamSessionId,instanceId}`, `binding.toolName`.
  // There is NO `request.*` wrapper and NO beneficiary self-report field;
  // guessing either was the review finding (it silently answered undefined).
  if (!rootSessionId || !requestId || manifest === undefined) return undefined
  const m = mount ?? resolvePaMount(rootSessionId, manifest?.member?.instanceId ?? '')
  if (m === undefined) return undefined
  // 9e fix-2 (AUTH audit (e)): `entryOf` is keyed by the DISPATCHER name
  // space while `manifest.binding.toolName` carries the BACKEND name
  // (`bash` ≠ dispatcher `team_bash`) — using the manifest name misses the
  // entry for every renamed row, and the native `read` coincidence would
  // hide exactly that. The binding authority is resolved by the binding's
  // OWN identity: the manifest snapshot carries `bindingId`, and a binding
  // id family is name-unique on the surface (revise keeps the family,
  // re-bind under another family is refused). So: the unique dispatcher
  // entry whose bindingId equals the snapshot's — a durable, namespaced
  // key; zero or ambiguous candidates ⇒ undefined (never a guess). Drift
  // (revision/definition/provider changes) stays fully strict: the
  // verifier performs the 11-field full-tuple + assurance comparison.
  const dispatcher = m.guard?.dispatcher
  const snapshotBindingId = manifest?.binding?.bindingId
  if (typeof snapshotBindingId !== 'string' || snapshotBindingId.length === 0) return undefined
  const surface = dispatcher?.surface
  const candidateNames = [...new Set([
    String(manifest?.binding?.toolName ?? ''),
    ...(typeof surface?.names === 'function' ? surface.names() : []),
  ])].filter((n) => n.length > 0)
  const candidates = candidateNames
    .map((n) => surface?.entryOf?.(n))
    .filter((e) => e !== undefined && e?.verified === true && e?.binding?.status === 'ACTIVE'
      && e?.binding?.bindingId === snapshotBindingId)
  if (candidates.length !== 1) return undefined
  const entry = candidates[0]
  const entryBinding = entry.binding
  if (typeof entryBinding.revision !== 'number' || entryBinding.revision < 1) return undefined
  if (typeof entryBinding.definitionIdentity !== 'string' || entryBinding.definitionIdentity.length === 0) return undefined
  // one governed lane: the binding's realm must BE the manifest's realm.
  if (m.plane?.realmId === undefined || m.plane.realmId !== manifest?.realmId) return undefined
  // beneficiary: the mount's DURABLE attribution ONLY (the manifest carries
  // no such field to compare — comparing a non-existent self-report was
  // the bug; the pure core trusts the verifier's own rung comparison).
  const beneficiary = m.beneficiaryAuthority
  if (beneficiary !== 'leader' && beneficiary !== 'member') return undefined
  // durable member attribution of the mount vs the manifest's member.
  const member = { teamSessionId: String(rootSessionId), instanceId: String(m.instanceId) }
  const manifestMember = manifest?.member
  if (manifestMember === undefined) return undefined
  if (String(manifestMember.teamSessionId ?? '') !== member.teamSessionId) return undefined
  if (String(manifestMember.instanceId ?? '') !== member.instanceId) return undefined
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
  // effects + plan snapshot: the mount's LIVE PA plan for this call.
  const livePlan = m.plane?.livePaPlan?.get?.(String(manifest?.callId ?? ''))
  if (livePlan === undefined) return undefined
  const effects = livePlan.requestedEffects
  if (effects === null || typeof effects !== 'object' || !Array.isArray(effects.effects)) return undefined
  if (typeof livePlan.effectSetFingerprint !== 'string' || livePlan.effectSetFingerprint.length === 0) return undefined
  if (!Array.isArray(livePlan.perEffectRequired) || livePlan.perEffectRequired.length !== effects.effects.length) return undefined
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
    planSnapshot: {
      approvalCaseId: String(livePlan.approvalCaseId ?? ''),
      effectSetFingerprint: livePlan.effectSetFingerprint,
      perEffectRequired: livePlan.perEffectRequired,
    },
    authorityGeneration,
  }
}
