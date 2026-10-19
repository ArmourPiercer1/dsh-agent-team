/**
 * jobs-gateway-assembly.mjs — the GLUE-5 LIVE ROW for the PR7 jobs gateway
 * (pc-CONTRACT.md §3, drafted by the P-C lane; this file is the landing the
 * contract said the GLUE owner would hand-place: "import 边即 PR7 的
 * production import 边，由 GLUE 亲手落").
 *
 * Import-edge law (pc-CONTRACT §3 checklist item 1): the gateway enters ONLY
 * through the committed dist mirror (`../../../jobs-gateway/index.js` from
 * the placed dist copy resolves to
 * `packages/runtime/dist/packages/runtime/jobs-gateway/index.js`). No source
 * path, no second copy.
 *
 * The three injected sources are the production class's own enforcement
 * points (pc-CONTRACT §0): the row no longer holds truth —
 *
 *  - `identity` — durable `MemberInstance` rows of THIS team root are the
 *    identity authority. An unconfirmed claim is refused `owner-not-durable`
 *    BEFORE the lease is taken (zero registration: no token, no job record,
 *    only the alarm). Claims naming another root are NOT confirmed here
 *    (stricter than the §1.1 sample on purpose: this assembly speaks for ONE
 *    team root, so a cross-root claim is unknown attribution ⇒ fail closed).
 *  - `lease` — the assembly owns the window; teardown (drain/release/giveUp)
 *    acts on the SAME object the gateway drives (W6 `assemblyOwnsWindow`).
 *  - `resolveDefinition` — admit-time pin + C-BIND re-read. DISCLOSURE
 *    (pc-CONTRACT §1 row 3): the host today exposes no public seam for the
 *    assembly to read the DEFINITION of a scope it does not own, so the live
 *    row injects a row-local store. It starts EMPTY, which is the closed
 *    world the contract prescribes: a pin-less admit against an unreadable
 *    definition is refused `mapping-rejected` — the empty store never
 *    "supplies" an identity, and a change re-check with no readable entry
 *    treats the definition as moved. A host seam replaces this reader in one
 *    line when it exists; until then no caller-declared pin can bypass it.
 *
 * Effect-face honesty (pc-CONTRACT §1 `jobs` row): the host `jobs` registry
 * coverage for `job_*` is OUT OF PLAN and the operations adapter is missing
 * (w7m2 缺项 1, on the register). As of B-ACT-1-PR C1 this row carries the
 * ACTUATOR-SHAPE legs — `attributeBackgroundJob` (creation attribution,
 * creating-lane pin), `checkManagementAccess` (pure owner fence over
 * job_output/job_list/job_kill, with the disclosed `corded:false` pass-
 * through for jobs the Team lane never attributed) and `noteKillRequested`
 * ('requested' marks the request, never a settlement). The GLUE mount that
 * drives them (placement flip + `ctx.get('jobs')` bridge, `jobsLaneEnabled`
 * default-off) is C2; until it lands, no production caller exists and the
 * governed team's user-facing jobs capability remains the HOST public face.
 * This row never fakes a host jobs capability.
 *
 * `final_declaration` stays null; this file makes no production-readiness
 * claim.
 *
 * @module runtime/plugin/live/jobs-gateway-assembly
 */
import { createJobsGateway, createLeaseWindow, jobOwnerKey } from '../../../jobs-gateway/index.js'

/**
 * The durable-identity source over ONE team root's MemberInstance rows
 * (pc-CONTRACT §1.1 ①). `domain` is the OPENED TeamDomain the glue already
 * holds; `rootSessionId` is THIS assembly's root — a claim naming any other
 * root is unknown attribution and is not confirmed.
 */
export function durableMemberIdentitySource(domain, rootSessionId) {
  const rootKey = String(rootSessionId)
  return {
    resolve: (claimed) => {
      try {
        if (claimed === null || claimed === undefined) return null
        if (String(claimed.rootSessionId ?? '') !== rootKey) return null
        const rows = domain.repositories.memberInstances.list(rootKey)
        const hit = rows.find((m) => String(m.instanceId) === String(claimed.instanceId))
        return hit === undefined ? null : { rootSessionId: rootKey, instanceId: String(hit.instanceId) } // AUTHORITY COPY
      } catch {
        return null // unreadable = not confirmed (closed world)
      }
    },
  }
}

/**
 * The disclosed row-local definition store (see header). The assembly hands
 * the gateway a reader over it; `register` is exposed ONLY for the (future)
 * host-seam replacement point and test pins — production callers today have
 * no path that writes it, so every pin-less admit fail-closes.
 */
function createRowLocalDefinitionStore() {
  const store = new Map()
  const key = (scopeKey, name) => `${String(scopeKey)}\u0000${String(name)}`
  return {
    register: (scopeKey, name, identity) => {
      store.set(key(scopeKey, name), String(identity))
    },
    resolveDefinition: (scopeKey, name) => {
      const k = key(scopeKey, name)
      return store.has(k)
        ? { ok: true, identity: store.get(k) }
        : { ok: false, identity: 'never-registered' }
    },
  }
}

/**
 * Create the live jobs-gateway assembly for ONE team root
 * (pc-CONTRACT §3 `createLiveJobsGatewayAssembly`).
 *
 * Teardown law (checklist item 4): the assembly lifecycle owns the window —
 * the caller drains/releases/gives up on `lease`, the SAME object the
 * gateway drives; a re-assembly after teardown gets a NEW window (the kit
 * proved both generations).
 */
export function createLiveJobsGatewayAssembly({ teamRoot, rootSessionId, onObserve } = {}) {
  if (teamRoot === null || teamRoot === undefined || typeof rootSessionId === 'undefined') {
    throw new TypeError('createLiveJobsGatewayAssembly: teamRoot (the OPENED TeamDomain) and rootSessionId are required')
  }
  const ledger = []
  const emit = (o) => {
    ledger.push(o)
    if (typeof onObserve === 'function') onObserve(o)
  }
  const lease = createLeaseWindow(emit)
  const definitionStore = createRowLocalDefinitionStore()
  const gateway = createJobsGateway({
    identity: durableMemberIdentitySource(teamRoot, rootSessionId),
    lease,
    resolveDefinition: definitionStore.resolveDefinition,
    onObserve: emit,
  })
  return {
    gateway,
    lease,
    /** The TeamPermit leg only — see the effect-face honesty note above. */
    admitTeamJob: (input) => gateway.admitJob(input),
    /**
     * CREATION ATTRIBUTION (B-ACT-1-PR C1; PR7 row: "创建时 Grant/
     * ExecutionLease"). The bash background arm registers the receipt's
     * host jobId here so the job gains a durable member owner BEFORE any
     * management call. The definition pinned is the CREATING lane's own
     * (default 'bash') — the C-BIND re-read tracks the lane the job was
     * born under; with no readable creating-lane definition the closed
     * world refuses (`mapping-rejected`) and attribution inventes NOTHING
     * (admitJob's zero-state-delta stands).
     */
    attributeBackgroundJob: ({ hostJobId, owner, scopeKey, toolName = 'bash' }) =>
      gateway.admitJob({ jobId: hostJobId, owner, scopeKey, toolName }),
    /**
     * MANAGEMENT-PATH OWNER FENCE (job_output/job_list/job_kill). A PURE
     * read over the owner law — no lease moves: a record owned by the
     * viewer passes CORDed with the record; a record owned by another
     * member scope is the same typed `owner-mismatch` refusal the Web
     * fence gives (static detail, never the owner's identity — C-GW);
     * a jobId with NO team record is the DISCLOSED pass-through
     * `corded: false` — the host's caller-session fence is authoritative
     * for jobs the Team lane never attributed, and this row never invents
     * ownership after the fact (pc-CONTRACT two-fence law, each layer
     * answering only for itself).
     */
    checkManagementAccess: ({ jobId, viewer }) => {
      const records = gateway.job(jobId)
      if (records.length === 0) return { ok: true, corded: false, record: null }
      const record = records[0]
      if (record.ownerKey !== jobOwnerKey({ rootSessionId: viewer.rootSessionId, instanceId: viewer.instanceId })) {
        return { ok: false, code: 'owner-mismatch', detail: 'this viewer is not the owning member scope of the job' }
      }
      return { ok: true, corded: true, record }
    },
    /**
     * KILL IS A REQUEST (PR7 row: "Cancel requested vs terminated"; host
     * JobRegistry.kill answers 'requested' | 'already-finished' @639ed01539).
     * Marking the request never settles anything: the lease token stands
     * until the plane's settlement edge (PR1 Gate R4). Reuses the frozen
     * `gateway-cancel-requested` observation name — no new vocabulary.
     */
    noteKillRequested: (jobId) => {
      const records = gateway.job(jobId)
      if (records.length === 0) return { ok: false, code: 'unknown-job' }
      records[0].cancelRequested = true
      emit({ event: 'gateway-cancel-requested', jobId, reason: 'host-kill-requested' })
      return { ok: true }
    },
    /** The disclosed row-local store; `register` is the host-seam slot. */
    definitions: definitionStore,
    observations: () => ledger.slice(),
    drain: () => lease.drain(),
    release: () => lease.release(),
    giveUp: (why) => lease.giveUp(why),
  }
}
