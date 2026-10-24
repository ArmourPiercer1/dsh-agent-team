/**
 * THE CHILD IDENTITY BRIDGE — trusted identity ROUTING / lifecycle index
 * ONLY (root ruling 2026-10-26 item A). It stores NO second copy of any
 * permission decision: the child's tool calls still resolve through the
 * ORIGINAL member's valid envelope, the ORIGINAL Provider and the Guard
 * (agent-bindings resolveCaller :9094-9123 — the durable-ledger law — and
 * the governedTokenLedger seat); the bridge only answers the routing
 * question "which real owning member, under which root, on behalf of
 * which admitted call, at which authority generation" plus the lifecycle
 * state, so a provider child (which holds NO independent member powers)
 * is addressable BEFORE the fail-closed throw without ever becoming a
 * durable member (no new member activation, no parallel ledger, no
 * parent-envelope widening).
 *
 * THE LAWS:
 *  1. INSTALL BEFORE PUBLISH — install() must run after the controlled
 *     create/setup yielded the REAL child id and BEFORE the handle is
 *     published to any consumer; an install failure rolls the attempt
 *     back (the caller disposes the fresh handle and refuses — nothing
 *     publishes unrouted).
 *  2. ROUTING FACTS ONLY — the record is { rootSessionId,
 *     owningMemberInstanceId, admittedCallId, generation, state }. No
 *     grants, no tokens, no allow-lists, no decisions: per-child
 *     admission stays the provider's independent PA walk
 *     (`<admittedCallId>#child-N`), which never copies a grant.
 *  3. DRAIN BEFORE RETIRE — owner cancellation/regeneration and every
 *     run settlement cancel first (beginDrain), then reclaim
 *     (dispose/cleanup), then retire(). retire() from 'active' is
 *     REFUSED: there is no reclaim path that skips the drain.
 *  4. QUOTA/EXPOSURE UNCHANGED — the bridge counts nothing and bans
 *     nothing: tool exposure and quotas follow the original native and
 *     the current policy (the real counting faces are the engine's
 *     per-run maxTotalAgents / maxConcurrentAgents / maxItemsPerCall);
 *     no "children have no team_*" and no per-call quota semantics are
 *     implied or stored here (root explicitly did NOT approve those).
 */

const BRIDGE_STATE = Object.freeze({ ACTIVE: 'active', DRAINING: 'draining', RETIRED: 'retired' })

const bridgeThrow = (code, detail) => {
  const error = new Error(`child-identity-bridge: ${code} — ${detail}`)
  error.code = code
  return error
}

const requireText = (value, what) => (typeof value === 'string' && value.length > 0 ? value : (() => { throw bridgeThrow('CIB_INPUT_INVALID', `${what} must be a non-empty string`) })())

/**
 * One bridge per team-root bindings factory (the same scope that owns
 * resolveCaller): the child session id is the key (the REAL id produced
 * by this controlled create — never a prediction).
 */
function createChildIdentityBridge () {
  /** @type {Map<string, { rootSessionId: string, owningMemberInstanceId: string, admittedCallId: string, generation: number, state: string }>} */
  const routes = new Map()

  return Object.freeze({
    /** LAW 1 — install before publish; idempotent for the IDENTICAL
     * binding, typed-refused for a conflicting one (a child session id
     * routes to exactly one owning reality). */
    install (binding) {
      const childSessionId = requireText(binding?.childSessionId, 'childSessionId')
      const rootSessionId = requireText(binding?.rootSessionId, 'rootSessionId')
      const owningMemberInstanceId = requireText(binding?.owningMemberInstanceId, 'owningMemberInstanceId')
      const admittedCallId = requireText(binding?.admittedCallId, 'admittedCallId')
      const generation = Number(binding?.generation)
      if (!Number.isFinite(generation) || generation < 0) throw bridgeThrow('CIB_INPUT_INVALID', `generation must be a finite non-negative number (the authority generation READ at bind time, never folded to zero); got ${String(binding?.generation)}`)
      const existing = routes.get(childSessionId)
      if (existing !== undefined) {
        const same = existing.rootSessionId === rootSessionId && existing.owningMemberInstanceId === owningMemberInstanceId && existing.admittedCallId === admittedCallId
        if (same && existing.state !== BRIDGE_STATE.RETIRED) return Object.freeze({ ...existing })
        throw bridgeThrow('CIB_ROUTE_CONFLICT', `child session '${childSessionId}' already routes to ${existing.owningMemberInstanceId}/${existing.admittedCallId} (state ${existing.state}) — re-binding it to ${owningMemberInstanceId}/${admittedCallId} would forge a second owning reality`)
      }
      const record = { childSessionId, rootSessionId, owningMemberInstanceId, admittedCallId, generation, state: BRIDGE_STATE.ACTIVE }
      routes.set(childSessionId, record)
      return Object.freeze({ ...record })
    },
    /** ROUTING read: answers the owning facts for resolveCaller (and any
     * lifecycle-aware consumer); undefined = unrouted (the consumer keeps
     * its own fail-closed law — the bridge never decides). RETIRED routes
     * answer undefined: a reclaimed child is not addressable. */
    resolve (childSessionId) {
      const record = routes.get(String(childSessionId))
      if (record === undefined || record.state === BRIDGE_STATE.RETIRED) return undefined
      return Object.freeze({ ...record })
    },
    /** LAW 3 — cancel first: owner cancellation/regeneration or run
     * settlement marks the route draining (in-flight work may still
     * resolve so the owner's cancel reaches it; new admissions stop at
     * the consumers' own gates — the bridge still decides nothing). */
    beginDrain (childSessionId, reason) {
      const record = routes.get(String(childSessionId))
      if (record === undefined) return undefined
      if (record.state === BRIDGE_STATE.ACTIVE) {
        record.state = BRIDGE_STATE.DRAINING
        record.drainReason = typeof reason === 'string' ? reason : 'unspecified'
      }
      return Object.freeze({ ...record })
    },
    /** LAW 3 — retire only AFTER the drain ran (reclaim completed). */
    retire (childSessionId) {
      const record = routes.get(String(childSessionId))
      if (record === undefined) return undefined
      if (record.state === BRIDGE_STATE.ACTIVE) throw bridgeThrow('CIB_RETIRE_WITHOUT_DRAIN', `child session '${childSessionId}' is still active — the law is cancel -> drain -> reclaim -> retire, never a skip`)
      record.state = BRIDGE_STATE.RETIRED
      return Object.freeze({ ...record })
    },
    /** Owner-cancellation / regeneration port: mark EVERY active child of
     * one owning member draining (optionally only below a generation).
     * Returns the drained ids so the caller runs the cancel/drain/reclaim
     * over them and retires each after its reclaim. */
    drainByOwner (rootSessionId, owningMemberInstanceId, opts) {
      const below = Number.isFinite(opts?.belowGeneration) ? Number(opts.belowGeneration) : undefined
      const drained = []
      for (const record of routes.values()) {
        if (record.rootSessionId !== String(rootSessionId) || record.owningMemberInstanceId !== String(owningMemberInstanceId)) continue
        if (record.state !== BRIDGE_STATE.ACTIVE) continue
        if (below !== undefined && !(record.generation < below)) continue
        record.state = BRIDGE_STATE.DRAINING
        record.drainReason = typeof opts?.reason === 'string' ? opts.reason : 'owner-cancel-or-regeneration'
        drained.push(Object.freeze({ ...record }))
      }
      return Object.freeze(drained)
    },
    /** The settle order of ONE child, run by the holder of the handle
     * (the childChain wrapper's dispose): beginDrain -> await the REAL
     * reclaim -> retire. A reclaim fault still drains, never silently
     * leaves the route active. */
    async settle (childSessionId, reclaim) {
      const child = String(childSessionId)
      this.beginDrain(child, 'run-settlement')
      try {
        return await reclaim()
      } finally {
        const record = routes.get(child)
        if (record !== undefined && record.state === BRIDGE_STATE.DRAINING) record.state = BRIDGE_STATE.RETIRED
      }
    },
    size () {
      let n = 0
      for (const record of routes.values()) if (record.state !== BRIDGE_STATE.RETIRED) n += 1
      return n
    },
    STATES: BRIDGE_STATE,
  })
}

export { createChildIdentityBridge, BRIDGE_STATE }
