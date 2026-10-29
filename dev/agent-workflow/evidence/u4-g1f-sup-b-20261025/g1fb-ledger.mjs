/**
 * g1fb-ledger.mjs — the ONE shared lifecycle ledger/grant mechanism (PoC-2 /
 * CA-02 / ARC-B): allow / ask→approve→one-shot consume (replay refused) / deny
 * (zero effect) / revoke-between-ask-and-execute, over ONE state machine used
 * by every governed family (read + grep + bash + write + edit + the Jobs
 * bridge rows). This is deliberately the only approval state in the PoC set:
 * the Jobs bridge (g1fb-jobs-bridge.mjs) NEVER calls approve/consume — it
 * rides the same guard-level admit(), which is the "no second approval
 * ledger" proof (CI-06: the Family/bridge receives a decision, it cannot
 * mint, approve, consume, or reuse a Grant).
 *
 * Semantics implemented here (architecture memo §5 state machine, minimal):
 *   BIND/PLAN: policy(args) -> lane allow|ask|deny (a family declares its
 *     policy function at registration; the ENGINE and the state machine are
 *     center-owned only — CI-06).
 *   allow    -> decision 'execute'            (no Grant needed)
 *   ask      -> no consumable grant exists    -> 'pending'  (+ request row)
 *   ask      -> issued grant                  -> ONE-SHOT consume -> 'execute'
 *   ask      -> consumed grant replayed       -> 'replay-refused' (body 0)
 *   ask      -> revoked before consume        -> 'revoked-refused' (body 0)
 *   deny     -> 'refused'                     (body 0, zero effect)
 *   unknown name / missing policy             -> 'refused' (template-default-deny)
 *
 * @module dev/agent-workflow/evidence/u4-g1f-sup-b-20261025/g1fb-ledger
 */
import { record, fingerprint } from './g1fb-lib.mjs'

let ledgerSeq = 0

export function createCenterLedger({ centerId, flags }) {
  ledgerSeq += 1
  const instanceId = `${centerId}#ledger-${String(ledgerSeq)}` // ONE instance per center: every family rides this object
  /** policies: name -> { family, policy(args) -> {lane, key?} } */
  const policies = new Map()
  /** grants by key (name + parametersFingerprint): {requestId, state, name} */
  const grants = new Map()
  let reqSeq = 0

  return {
    instanceId,
    registerPolicy(name, family, policy) {
      const held = policies.get(name)
      if (held !== undefined) {
        // Same family = regeneration (a fresh policy for the next generation).
        // A foreign family claiming the name is the collision — refused.
        if (held.family !== family) return false
        policies.set(name, { family, policy })
        record({ leg: 'policy', phase: 'replaced-regeneration', ledger: instanceId, name, family })
        return true
      }
      policies.set(name, { family, policy })
      return true
    },
    unregisterPolicy(name) {
      policies.delete(name)
    },
    /** The single admission entry the guard calls for EVERY governed call,
     *  including every Jobs-bridge row call. Deny = return BEFORE the body. */
    admit(name, args, ctx = {}) {
      const p = policies.get(name)
      if (p === undefined) {
        record({ leg: 'admit', ledger: instanceId, name, decision: 'refused', reason: 'no-policy-default-deny', ...ctx })
        return { decision: 'refused', reason: 'no-policy-default-deny' }
      }
      let lane = null
      try {
        lane = p.policy(args ?? {})
      } catch (error) {
        record({ leg: 'admit', ledger: instanceId, name, decision: 'refused', reason: `policy-threw:${String(error?.message ?? error)}`, ...ctx })
        return { decision: 'refused', reason: 'policy-threw' }
      }
      if (lane === null || typeof lane !== 'object' || !['allow', 'ask', 'deny'].includes(lane.lane)) {
        record({ leg: 'admit', ledger: instanceId, name, decision: 'refused', reason: 'invalid-lane', ...ctx })
        return { decision: 'refused', reason: 'invalid-lane' }
      }
      // SENSITIVITY PLANT switch (test-side only): ledgerEnabled=false models
      // the ABSENCE of the shared lifecycle — every call answers as if the
      // policy said allow. The plants prove the ledger cells are non-vacuous.
      if (flags.ledgerEnabled === false) {
        record({ leg: 'admit', ledger: instanceId, name, decision: 'execute', reason: 'PLANT-ledger-disabled', lane: lane.lane, ...ctx })
        return { decision: 'execute', plant: true }
      }
      if (lane.lane === 'deny') {
        record({ leg: 'admit', ledger: instanceId, name, decision: 'refused', reason: 'deny-lane', lane: 'deny', ...ctx })
        return { decision: 'refused', reason: 'deny-lane' }
      }
      if (lane.lane === 'allow') {
        record({ leg: 'admit', ledger: instanceId, name, decision: 'execute', lane: 'allow', ...ctx })
        return { decision: 'execute' }
      }
      // ask lane — the one Grant state machine
      const key = `${name}::${lane.key ?? fingerprint(args ?? {})}`
      let g = grants.get(key)
      if (g === undefined) {
        reqSeq += 1
        g = { requestId: `g1fb-req-${String(reqSeq).padStart(3, '0')}`, state: 'pending', name, key }
        grants.set(key, g)
        record({ leg: 'grant', phase: 'requested', ledger: instanceId, name, requestId: g.requestId, grantKey: key, ...ctx })
        return { decision: 'pending', requestId: g.requestId }
      }
      if (g.state === 'pending') {
        record({ leg: 'grant', phase: 'pending-reaffirmed', ledger: instanceId, name, requestId: g.requestId, ...ctx })
        return { decision: 'pending', requestId: g.requestId }
      }
      if (g.state === 'issued') {
        g.state = 'consumed' // ONE-SHOT consume at the fresh-recheck edge, before the body
        record({ leg: 'grant', phase: 'consumed', ledger: instanceId, name, requestId: g.requestId, grantKey: key, ...ctx })
        return { decision: 'execute', requestId: g.requestId }
      }
      if (g.state === 'consumed') {
        record({ leg: 'grant', phase: 'replay-refused', ledger: instanceId, name, requestId: g.requestId, ...ctx })
        return { decision: 'replay-refused', requestId: g.requestId }
      }
      record({ leg: 'grant', phase: 'revoked-refused', ledger: instanceId, name, requestId: g.requestId, ...ctx })
      return { decision: 'revoked-refused', requestId: g.requestId }
    },
    approve(requestId) {
      const g = [...grants.values()].find((x) => x.requestId === requestId)
      if (g === undefined || g.state !== 'pending') return { ok: false, detail: `no pending request ${requestId}` }
      g.state = 'issued'
      record({ leg: 'grant', phase: 'approved', ledger: instanceId, name: g.name, requestId })
      return { ok: true, detail: `issued:${requestId}` }
    },
    revoke(requestId) {
      const g = [...grants.values()].find((x) => x.requestId === requestId)
      if (g === undefined || !['pending', 'issued'].includes(g.state)) return { ok: false, detail: `not revocable ${requestId}` }
      g.state = 'revoked'
      record({ leg: 'grant', phase: 'revoked', ledger: instanceId, name: g.name, requestId })
      return { ok: true, detail: `revoked:${requestId}` }
    },
    dump() {
      return [...grants.values()].map(({ requestId, state, name }) => ({ requestId, state, name }))
    },
  }
}
