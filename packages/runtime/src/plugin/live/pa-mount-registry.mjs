/**
 * PR358-B (CENTER half): the narrow (teamRoot, instanceId) → CURRENT mount
 * index the root uses to build the ONE paEffectsVerifier injection. It is
 * deliberately NOT an authority ledger: entries exist only while a mount is
 * published, carry only the trusted references the fact readers need, and
 * every read re-answers them fresh (no cached facts, no long-lived tuple).
 *
 * Facts law (root ruling B):
 *  - binding identity is the dispatcher's CURRENT entry (`dispatcher.surface
 *    .entryOf(toolName)`): verified + ACTIVE, real revision, real
 *    definitionIdentity/realm — a synthetic `plane-row` binding is NEVER an
 *    authority (the plane's own manifest-snapshot binding is a fact to
 *    CONTRAST against, never the source);
 *  - policy/blueprint facts come from the injected permission-plane face
 *    (`currentCallFacts`) — the same tuple source the permission lane reads
 *    (static layers + overlay generation); never JSON.stringify(PolicyReader);
 *  - beneficiary is the mount's DURABLE attribution (leader = the root is
 *    its own session; member = a durable member row existed at setup),
 *    never the manifest's self-report;
 *  - ANY missing/contradicting reader ⇒ undefined ⇒ the service answers
 *    `authority-undetermined`. There is no 0/1/empty-envelope fallback.
 */

const mounts = new Map() // teamRoot -> Map(instanceId -> entry)

/** Publish the CURRENT mount for (teamRoot, instanceId). Called by
 *  agentSetup AFTER bindOwnTools + publish succeeded. */
export function publishPaMount(teamRoot, instanceId, entry) {
  const root = String(teamRoot)
  const id = String(instanceId)
  if (!mounts.has(root)) mounts.set(root, new Map())
  mounts.get(root).set(id, Object.freeze({ ...entry }))
}

/** Revoke THIS mount only (teardown start; a stale disposer never clears a
 *  newer mount for the same key). Returns true when it removed the live one. */
export function revokePaMount(teamRoot, instanceId) {
  const bucket = mounts.get(String(teamRoot))
  if (bucket === undefined) return false
  return bucket.delete(String(instanceId))
}

/** The live mount for the pair, or undefined. */
export function resolvePaMount(teamRoot, instanceId) {
  return mounts.get(String(teamRoot))?.get(String(instanceId))
}

function tupleOf(permissionPlane, teamRoot, instanceId) {
  const plane = typeof permissionPlane === 'function' ? permissionPlane() : permissionPlane
  const face = plane?.currentCallFacts
  if (typeof face !== 'function') return undefined
  try {
    const t = face(String(teamRoot), String(instanceId))
    return t === null || typeof t !== 'object' ? undefined : t
  } catch {
    return undefined
  }
}

/**
 * The call-level facts reader the (async) service orchestration awaits
 * BEFORE the pure core runs. `mount.readers` is wired by agentSetup/root
 * from the REAL seams: { permissionPlane (live ref), policySnapshot }.
 */
export async function readPaCallFacts({ rootSessionId, requestId, manifest, decider, stage, mount }) {
  void stage
  if (!rootSessionId || !requestId || manifest === undefined) return undefined
  const m = mount ?? resolvePaMount(rootSessionId, manifest?.request?.instanceId ?? '')
  if (m === undefined) return undefined
  const guard = m.guard
  const dispatcher = guard?.dispatcher
  const entry = dispatcher?.surface?.entryOf?.(manifest?.request?.toolName ?? manifest?.binding?.toolName ?? '')
  // binding authority: the CURRENT dispatcher entry — verified, ACTIVE.
  const entryBinding = entry?.binding ?? {}
  if (entry === undefined || entry.verified !== true) return undefined
  if (entryBinding.status !== 'ACTIVE') return undefined
  if (typeof entryBinding.revision !== 'number' || entryBinding.revision < 1) return undefined
  if (typeof entryBinding.definitionIdentity !== 'string' || entryBinding.definitionIdentity.length === 0) return undefined
  // the binding's realm must BE the manifest's realm (one governed lane);
  // a realm mismatch is not this call's authority.
  if (m.plane?.realmId === undefined || m.plane.realmId !== manifest?.realmId) return undefined
  // beneficiary: the mount's DURABLE attribution, never the manifest's.
  const beneficiary = m.beneficiaryAuthority
  if (beneficiary !== 'leader' && beneficiary !== 'member') return undefined
  if (beneficiary !== manifest?.beneficiaryAuthority) {
    // The manifest claims a rung the durable attribution does not carry:
    // this is drift, not a question to answer — the caller denies.
    return undefined
  }
  const policyGeneration = dispatcher?.policyGeneration?.()
  const authorityGeneration = dispatcher?.authorityGeneration?.()
  if (typeof policyGeneration !== 'number' || typeof authorityGeneration !== 'number') return undefined
  // policy/blueprint facts: the permission lane's OWN tuple source (static
  // layers + overlay generation), read fresh and returned by reference.
  const tuple = tupleOf(m.readers?.permissionPlane, rootSessionId, m.instanceId)
  if (tuple === undefined) return undefined
  // contrast the plane's binding snapshot against the CURRENT entry: a
  // drift between the two is a fact the pure core must weigh, and it is
  // carried HERE (the reader's answer), never self-proved by the manifest.
  const snapshot = manifest?.binding
  const bindingDrift = snapshot !== undefined && (
    snapshot.definitionIdentity !== entryBinding.definitionIdentity
    || snapshot.revision !== entry.revision
    || snapshot.providerId !== entryBinding.providerId
  )
  const plane = m.plane
  const providerEntry = plane?.backends?.[manifest?.request?.toolName === 'read' ? 'read' : manifest?.request?.toolName === 'team_bash' ? 'shell' : manifest?.request?.toolName === 'team_grep' ? 'search' : 'glob']
  return {
    identity: { rootSessionId: String(rootSessionId), requestId: String(requestId), callId: String(manifest?.request?.callId ?? '') },
    binding: {
      bindingId: entryBinding.bindingId,
      definitionIdentity: entryBinding.definitionIdentity,
      providerId: entryBinding.providerId,
      revision: entry.revision,
      realmId: m.plane.realmId,
      status: entryBinding.status,
    },
    bindingSnapshotDrift: bindingDrift === true,
    policy: {
      policyGeneration,
      authorityGeneration,
      tuple,
      livePolicy: typeof m.readers?.policySnapshot === 'function' ? m.readers.policySnapshot() : undefined,
    },
    beneficiaryAuthority: beneficiary,
    // provider association: current definition → THIS mount's backend →
    // plan; the providerId namespace stays the definition owner's (B5).
    provider: {
      providerId: entryBinding.providerId,
      backendId: providerEntry?.backendId ?? providerEntry?.kind ?? 'unknown',
    },
    decider: decider === undefined ? undefined : decider,
  }
}

/** The service-injection dispatcher: ONE port object the root injects into
 *  createControlService; it resolves the live mount per call. Construction
 *  of the pure verifier is the AUTH export's job (createPaEffectsVerifier);
 *  `verify` is injected by the root once AUTH's async orchestration lands —
 *  until then the port fail-closes with undefined facts (undetermined). */
export function createPaEffectsVerifierDispatcher({ verify }) {
  return async (input) => {
    const mount = resolvePaMount(input?.rootSessionId, input?.manifest?.request?.instanceId ?? '')
    if (typeof verify !== 'function') {
      return { ok: false, reason: 'authority-undetermined', detail: 'no pure verifier wired at the root injection point' }
    }
    const facts = await readPaCallFacts({ ...input, mount })
    if (facts === undefined) {
      return { ok: false, reason: 'authority-undetermined', detail: 'current call facts unanswerable (no live mount / entry / tuple / beneficiary)' }
    }
    try {
      return await verify({ ...input, facts, mount })
    } catch {
      return { ok: false, reason: 'authority-undetermined', detail: 'the pure verifier threw; fail closed' }
    }
  }
}
