/**
 * host-surface-refusal.mjs — the centre's EXPLICIT UNAVAILABILITY for the three capabilities that
 * have no member I/O axis to be admitted on.
 *
 * WHY THIS MODULE EXISTS (round 55, C stage). The A1 cut's law is "an unwired controlled call is
 * refused with a code that names why, never forwarded to a second authority". Three capabilities
 * were not on either side of that law: the S6 remote surface, Alpha.6 review routing and PTC
 * escalation. They are real host capabilities with real machinery, but no axis in the compiled
 * member contract can judge them:
 *
 *  - a remote command is issued by an EXTERNAL caller authorized by the server-derived principal,
 *    not by a member binding, so there is no lane (and no binding) for the centre to judge;
 *  - Alpha.6 review routing decides WHO may review WHOM from the trusted review facts; it is a
 *    governance decision that precedes any tool call and has no I/O locator;
 *  - a PTC escalation asks the HOST sandbox to widen the process lane, which this contract does not
 *    compile at all (`CONTRACT-CHANGE-REQUEST-process-lane.md`), and the surviving escalation row
 *    mints its own one-shot grants outside the centre.
 *
 * Each therefore ends EXPLICITLY UNAVAILABLE rather than silently absorbed by whichever surface
 * happened to answer first. The refusal is one closed table (so the three codes cannot collapse into
 * one generic "unavailable"), it records the SAME two durable shapes every other centre decision
 * records (an invocation-authority fact with the enforced decision, and a settlement record closed
 * REFUSED with `dispatch`/`bodyOutcome` `not-started`), and it is taken BEFORE the surface body.
 *
 * WHAT THIS MODULE IS NOT. It is not a new axis, not a second authority and not a compatibility
 * layer: the axis it records is the subject's existing one (`team.control` for a command the team
 * control plane owns, `host.service` for a host-service decision, `process.exec` for the shell
 * family), and the settlement writer is the product's own. It decides nothing a surface could
 * overrule: the caller refuses, and the record says so.
 *
 * @module packages/runtime/src/plugin/vnext/host-surface-refusal
 */

import { randomUUID } from 'node:crypto'
import { createSettlementWriter } from './settlement-port.mjs'
import { openFactLedger } from './fact-ledger.mjs'

/**
 * The closed capability table. `missing` is the reason, not a TODO: it names the axis the contract
 * does not have and the shape that would be needed to change this row (never invented here).
 */
export const HOST_SURFACE_REFUSALS = Object.freeze({
  remote: Object.freeze({
    code: 'ADMISSION_REMOTE_UNAVAILABLE',
    axis: 'team.control',
    subject: 'S6 remote command',
    missing: 'no remote-command axis exists: the S6 dispatcher is a host admin surface authorized by the server-derived principal, not by a bound member, so the compiled ceiling the centre judges cannot speak for it',
  }),
  alpha6: Object.freeze({
    code: 'ADMISSION_ALPHA6_UNAVAILABLE',
    axis: 'host.service',
    subject: 'Alpha.6 review-routing decision',
    missing: 'no review-routing axis exists: Alpha.6 decides who may review whom from the trusted review facts before any tool call, so there is no locator or lane for the centre to judge, and the decision would otherwise be made by a second governance authority',
  }),
  ptc: Object.freeze({
    code: 'ADMISSION_PTC_UNAVAILABLE',
    axis: 'process.exec',
    subject: 'PTC escalation',
    missing: 'no process lane is compiled (CONTRACT-CHANGE-REQUEST-process-lane.md) and the surviving escalation row (createPtcEscalationRouter) mints its own one-shot grants outside the centre, so admitting it would be a second execution authority',
  }),
})

/** The capability names, CLOSED. A fourth capability must be added here or it cannot be refused. */
export const HOST_SURFACE_CAPABILITIES = Object.freeze(Object.keys(HOST_SURFACE_REFUSALS))

/**
 * The ONE product-side decision helper: refuse through the point (recording both durable shapes) and
 * tell the caller the surface must NOT run. `undefined` point (a row that never configured the
 * centre) is the no-op path, and it is the SAME branch the product takes — the arm drives this
 * function, not a copy of the rule.
 *
 * @param {{refuse: (input: object) => object}|undefined} point
 * @param {object} input - the refusal detail (see {@link createHostSurfaceRefusalPoint}).
 * @returns {boolean} true when the caller must not build/run the surface.
 */
export function refuseHostSurfaceBefore (point, input) {
  if (point === undefined || point === null) return false
  point.refuse(input)
  return true
}

/** The refusal for one capability, as the centre's own `Admission` vocabulary. */
export function hostSurfaceRefusal (capability, detail) {
  const entry = HOST_SURFACE_REFUSALS[capability]
  if (entry === undefined) {
    throw new TypeError(`host-surface-refusal: ${JSON.stringify(String(capability))} is not a capability of the closed table (${HOST_SURFACE_CAPABILITIES.join(', ')})`)
  }
  const extra = typeof detail === 'string' && detail !== '' ? ` (${detail})` : ''
  return {
    kind: 'deny',
    code: entry.code,
    reason: `${entry.subject} is explicitly unavailable in the A1 cut: ${entry.missing}${extra}`,
  }
}

/**
 * The ONE recorder for a host-surface refusal.
 *
 * `refuse()` is synchronous and writes BOTH durable shapes in the same order the centre uses:
 * the invocation-authority fact first (a settlement that references a fact nobody can read is
 * worse than none), then the settlement record, which the product store closes REFUSED at birth
 * with `dispatch`/`bodyOutcome` `not-started`. The caller must not run the surface body after
 * calling it.
 *
 * @param {object} input
 * @param {'remote'|'alpha6'|'ptc'} input.capability - one entry of the closed table.
 * @param {object} [input.ledger] - an already-open product fact ledger (`openFactLedger`); absent =
 *   no fact sink. Typed callers (root.ts) use `ledgerPath` instead: the ledger is a plain `.mjs`
 *   with no declaration file, and this module is the ONE place that opens it.
 * @param {string} [input.ledgerPath] - open the ledger at this path (ignored when `ledger` is given).
 * @param {object} [input.store] - the product `ExecutionSettlementStore`; absent = no settlement.
 * @param {(exec: object) => {executionId: string, actorId: string, worldId: string}} [input.identityOf]
 *   - the settlement identity. Required when `store` is given; the centre never invents a second id
 *   scheme, and this module does not either.
 * @param {(error: unknown, context: object) => void} [input.onFault] - every fault is reported.
 * @returns {{capability: object, refuse: (input: object) => {callId: string, admission: object}}}
 */
export function createHostSurfaceRefusalPoint ({ capability, ledger, ledgerPath, store, identityOf, onFault, now } = {}) {
  const entry = HOST_SURFACE_REFUSALS[capability]
  if (entry === undefined) {
    throw new TypeError(`host-surface-refusal: ${JSON.stringify(String(capability))} is not a capability of the closed table (${HOST_SURFACE_CAPABILITIES.join(', ')})`)
  }
  if (store !== undefined && store !== null && typeof identityOf !== 'function') {
    throw new TypeError('host-surface-refusal: a settlement record needs identityOf; this module does not invent a second id scheme')
  }
  const factSink = ledger !== undefined && ledger !== null
    ? ledger
    : typeof ledgerPath === 'string' && ledgerPath !== '' ? openFactLedger({ path: ledgerPath }) : undefined
  const writer = store === undefined || store === null
    ? undefined
    : createSettlementWriter({ store, identityOf, ...(onFault === undefined ? {} : { onFault }) })
  // A refusal that happens before a call exists (a surface that is not installed at all) has no host
  // callId, so the point derives one from a per-install nonce. It is an IDENTITY for the refusal
  // event, never a reuse of an execution's identity: the point never writes a second authority
  // record for a callId a centre already decided.
  const nonce = randomUUID()
  let sequence = 0
  const clock = typeof now === 'function' ? now : () => new Date().toISOString()

  return Object.freeze({
    capability: entry,
    /**
     * Record the refusal and return it. The caller MUST NOT run the surface body afterwards.
     *
     * @param {object} input
     * @param {string} [input.callId] - the surface's own request identity when it has one.
     * @param {string} [input.subject] - what was refused (the endpoint, the route, the tool).
     * @param {string} [input.locator] - what the refusal is about (a root, a server, a mode).
     * @param {string} [input.owner] - the team root the surface would have acted for.
     * @param {string} [input.detail] - a measured detail appended to the fixed reason.
     */
    refuse ({ callId, subject, locator = '', owner = '', detail } = {}) {
      const id = typeof callId === 'string' && callId !== '' ? callId : `${capability}:${nonce}:${sequence++}`
      const admission = hostSurfaceRefusal(capability, detail)
      const toolName = typeof subject === 'string' && subject !== '' ? subject : entry.subject
      const fact = Object.freeze({
        callId: id,
        agentId: owner,
        sessionId: owner,
        instanceGeneration: 0,
        toolName,
        axis: entry.axis,
        locator,
        definitionSource: 'host-surface',
        policyGeneration: '',
        blueprintRevision: '',
        owner,
        decision: 'deny',
        refusalCode: admission.code,
        reason: admission.reason,
      })
      if (factSink !== undefined) {
        try {
          factSink.recordAdmission(fact)
        } catch (error) {
          // A refusal nobody can find is not one this module will pretend to have recorded: report
          // the fault and still refuse (the call is unavailable either way).
          if (typeof onFault === 'function') onFault(error, { phase: 'record', capability, callId: id, toolName })
        }
      }
      if (writer !== undefined) {
        try {
          writer.admitted({ exec: { name: toolName, callId: id }, callId: id, admission })
        } catch (error) {
          if (typeof onFault === 'function') onFault(error, { phase: 'settlement-open', capability, callId: id, toolName })
        }
      }
      return Object.freeze({ callId: id, admission })
    },
    /** The clock this point stamps facts with. Exported for arms; the store stamps its own. */
    clock,
  })
}
