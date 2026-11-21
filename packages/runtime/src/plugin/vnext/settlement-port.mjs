/**
 * settlement-port.mjs — the centre's settlement writer, on the product's own store.
 *
 * WHY A WRITER AND NOT A WRAPPER. The retired route wrapped a ToolDefinition to observe the body.
 * That is a Shadow Definition, and the cut removed it. The observation point in this architecture is
 * the host's own `tools/result` event, so the centre learns the outcome the same way every other
 * consumer does - and it writes the product's `ExecutionSettlementStore`, which owns the transition
 * law (`ADMITTED → RUNNING → terminal`) and refuses to re-drive a terminal state.
 *
 * WHAT THIS MODULE DECIDES. Nothing. It maps an already-made admission decision and an already-made
 * execution outcome onto the store's vocabulary. The store's constructor takes a directory and no
 * policy precisely so that a writer cannot become a second authority.
 *
 * @module packages/runtime/src/plugin/vnext/settlement-port
 */

import { createHash } from 'node:crypto'

/** Stable digest of the decision a record references; the store only cross-checks it. */
// 64 hex chars exactly: the store validates the digest's LENGTH, and a `sha256:` prefix would be a
// 71-character string it refuses. The algorithm is the writer's business, the shape is the store's.
const digestOf = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex')

/**
 * What a settlement observation looks like for one call. `dispatch`/`bodyOutcome`/`effectEvidence`
 * are the product's own closed sets: a call that never reached the body must not claim effects.
 */
const observationOf = (executionId, phase) => {
  if (phase === 'admitted') {
    return { executionId, dispatch: 'not-started', bodyOutcome: 'not-started', effectEvidence: 'none-confirmed', observedEffects: [] }
  }
  if (phase === 'running') {
    return { executionId, dispatch: 'started', bodyOutcome: 'not-started', effectEvidence: 'none-confirmed', observedEffects: [] }
  }
  if (phase.refused === true) {
    // A refusal never reached the body, so it must not claim that anything was dispatched or quiesced.
    return { executionId, dispatch: 'not-started', bodyOutcome: 'not-started', effectEvidence: 'none-confirmed', observedEffects: [] }
  }
  return { executionId, dispatch: 'quiesced', bodyOutcome: phase.bodyOutcome, effectEvidence: phase.effectEvidence, observedEffects: [] }
}

/** The terminal state an outcome maps to. A Stop is CANCELLED, a refusal is REFUSED. */
export const settlementStateOf = (outcome) => {
  switch (outcome) {
    case 'completed': return 'COMPLETED'
    case 'failed': return 'FAILED'
    case 'aborted': return 'CANCELLED'
    case 'admission-refusal': return 'REFUSED'
    case 'approval-refused': return 'REFUSED'
    default: return 'UNKNOWN'
  }
}

/**
 * Create the settlement writer for one agent.
 *
 * @param {object} input
 * @param {object} input.store - the product's `ExecutionSettlementStore` (already open).
 * @param {(exec: object) => {executionId: string, actorId: string, worldId: string}} input.identityOf
 *   - the SETTLEMENT identity. Supplied by the caller so the centre never invents a second id scheme.
 * @param {() => string} [input.clock] - injectable clock (ISO-8601 UTC).
 * @param {(error: unknown, context: object) => void} [input.onFault] - every fault is reported, never
 *   swallowed: a settlement that silently failed would read as one that never had to happen.
 */
export function createSettlementWriter ({ store, identityOf, clock = () => new Date().toISOString(), onFault }) {
  if (store === undefined || store === null || typeof store.settle !== 'function') {
    throw new TypeError('settlement-port: a writer needs the product ExecutionSettlementStore')
  }
  if (typeof identityOf !== 'function') throw new TypeError('settlement-port: identityOf must be a function of the execution')

  const fault = (error, context) => { if (typeof onFault === 'function') onFault(error, context) }

  return Object.freeze({
    /** The admission decision the ControlService already made, referenced - never re-decided. */
    admitted ({ exec, callId, admission }) {
      try {
        const identity = identityOf(exec)
        const decision = { kind: admission.kind, code: admission.code, reason: admission.reason }
        const written = store.recordAdmission({
          identity: { executionId: identity.executionId, toolName: exec.name, actorId: identity.actorId, worldId: identity.worldId },
          admission: {
            admissionKind: 'control-decision',
            decisionId: `admission:${callId}`,
            decisionDigest: digestOf(decision),
            decision: admission.kind === 'deny' ? 'deny' : 'allow',
            decisionKind: admission.kind,
            subjectExecutionId: identity.executionId,
            decidedAt: clock(),
          },
          at: clock(),
          ...(admission.kind === 'deny' ? { reason: `${admission.code}: ${admission.reason}` } : {}),
        })
        // A refusal is a TERMINAL fact, and the store opens every record at ADMITTED. Leaving it there
        // would report a refused call as "still admitted", which is a state that never existed.
        if (admission.kind === 'deny') {
          store.settle({
            executionId: identity.executionId,
            state: 'REFUSED',
            observation: observationOf(identity.executionId, { refused: true }),
            at: clock(),
            reason: `${admission.code}: ${admission.reason}`,
          })
        }
        return written
      } catch (error) {
        fault(error, { phase: 'admission', callId, toolName: exec?.name })
        throw error
      }
    },
    /** The body is about to run. Before this line nothing has happened physically. */
    running ({ exec }) {
      try {
        const identity = identityOf(exec)
        return store.enterRunning({ executionId: identity.executionId, observation: observationOf(identity.executionId, 'running'), at: clock() })
      } catch (error) {
        fault(error, { phase: 'running', toolName: exec?.name })
        throw error
      }
    },
    /**
     * A Stop was recorded against this execution. The store keeps stops as a SEPARATE additive list
     * precisely so that a stop never rewrites an outcome - and the phase says whether it arrived
     * before the body, during it, or after the effect.
     */
    stop ({ exec, phase, stopId }) {
      try {
        const identity = identityOf(exec)
        if (store.read(identity.executionId) === null) return null
        return store.recordStop({ executionId: identity.executionId, stopId: stopId ?? `stop:${identity.executionId}`, at: clock(), phase })
      } catch (error) {
        fault(error, { phase: 'terminal', toolName: exec?.name })
        throw error
      }
    },
    /**
     * Close an OPEN record for a call that was refused BEFORE its body ran, when the refusal is the
     * ADMISSION's own decision (the record's admission reference already says `deny`).
     *
     * Idempotent: an already-terminal record is returned unchanged.
     *
     * THE CASE THIS DELIBERATELY DOES NOT PAPER OVER. When a call was admitted as `allow` and refused
     * LATER (the post-approval recheck), the frozen settlement contract has NO state for it: REFUSED is
     * forbidden against a recorded allow (`SETTLEMENT_ADMISSION_MISMATCH`), CANCELLED requires a recorded
     * Stop (`STOP_EVIDENCE_MISSING` - and fabricating an authority signal is not an option), the only
     * path out of ADMITTED into FAILED is via RUNNING, and UNKNOWN would claim the effect was merely
     * unobserved when the body provably never ran. Rather than write a state that lies, this reports the
     * gap as a fault and leaves the record to recovery (UNKNOWN), and the durable execution FACT still
     * carries `admission-refusal` + the refusal code. See
     * `dev/agent-workflow/evidence/ute-a1/CONTRACT-CHANGE-REQUEST-settlement-recheck.md` - this is an
     * escalation (a settlement invariant would have to be relaxed), not something to invent around.
     */
    refused ({ exec, code, reason }) {
      try {
        const identity = identityOf(exec)
        const existing = store.read(identity.executionId)
        if (existing === null) return null
        if (existing.state !== 'ADMITTED' && existing.state !== 'RUNNING') return existing
        try {
          return store.settle({
            executionId: identity.executionId,
            state: 'REFUSED',
            observation: observationOf(identity.executionId, { refused: true, bodyOutcome: 'not-started', effectEvidence: 'none-confirmed' }),
            at: clock(),
            reason: `${code ?? 'ADMISSION_REFUSED'}: ${reason ?? 'the call was refused before its body ran'}`,
          })
        } catch (error) {
          if (error?.code !== 'SETTLEMENT_ADMISSION_MISMATCH') throw error
          const gap = new Error(`SETTLEMENT_CONTRACT_GAP: ${identity.executionId} was admitted as allow and refused before its body (${code ?? 'ADMISSION_REFUSED'}); the frozen settlement contract has no terminal state for that (REFUSED is forbidden against an allow, CANCELLED needs a Stop) - the record stays ${existing.state} and recovery will mark it UNKNOWN, while the execution fact carries the refusal`)
          gap.code = 'SETTLEMENT_CONTRACT_GAP'
          fault(gap, { phase: 'terminal', executionId: identity.executionId, toolName: exec?.name, refusalCode: code })
          return existing
        }
      } catch (error) {
        fault(error, { phase: 'terminal', toolName: exec?.name })
        throw error
      }
    },
    /** The host settled the call. `outcome` is the centre's own vocabulary, not the store's. */
    settled ({ exec, outcome, missingEvidence }) {
      try {
        const identity = identityOf(exec)
        // NO FABRICATION. A call that was aborted before the admission point never opened a record;
        // settling it would invent an admission decision nobody made. It is reported as a fault -
        // visibly - and the execution fact still carries 'aborted'.
        if (store.read(identity.executionId) === null) {
          fault(new Error(`no settlement record for ${identity.executionId}: the call ended before admission`), { phase: 'terminal', executionId: identity.executionId, toolName: exec?.name })
          return null
        }
        const state = settlementStateOf(outcome)
        return store.settle({
          executionId: identity.executionId,
          state,
          observation: observationOf(identity.executionId, {
            ...(state === 'REFUSED' ? { refused: true } : {}),
            bodyOutcome: state === 'COMPLETED' ? 'completed' : state === 'FAILED' ? 'failed' : 'unknown',
            // The centre has no trusted effect observer wired yet, so it claims NO effects. Claiming
            // 'observed' without one would be exactly the unearned assertion this project refuses.
            effectEvidence: state === 'UNKNOWN' ? 'unknown' : 'none-confirmed',
          }),
          at: clock(),
          reason: `tools/result: ${outcome}`,
          ...(missingEvidence === undefined ? {} : { missingEvidence }),
        })
      } catch (error) {
        fault(error, { phase: 'terminal', toolName: exec?.name })
        throw error
      }
    },
    /**
     * A Stop landed AFTER admission and BEFORE the body. The record was opened with the admission
     * decision it references (`allow` for an approved ask or an allowed call), so `REFUSED` is
     * forbidden by the frozen contract (`SETTLEMENT_ADMISSION_MISMATCH`); CANCELLED is the store's own
     * state for a Stop and it requires a recorded `pre-dispatch` Stop. That Stop is not fabricated: the
     * caller observed the host's abort signal on this very execution, which is the authority signal.
     *
     * Nothing has run, so the observation says so: `dispatch` and `bodyOutcome` are `not-started` and
     * the effect evidence is `none-confirmed`. The record is terminal, never UNKNOWN.
     *
     * Idempotent: a terminal record is returned unchanged.
     */
    stoppedBeforeBody ({ exec, stopId, phase = 'pre-dispatch' }) {
      try {
        const identity = identityOf(exec)
        const existing = store.read(identity.executionId)
        if (existing === null) return null
        if (existing.state !== 'ADMITTED') return existing
        store.recordStop({
          executionId: identity.executionId,
          stopId: stopId ?? `stop:${identity.executionId}:${phase}`,
          at: clock(),
          phase,
        })
        return store.settle({
          executionId: identity.executionId,
          state: 'CANCELLED',
          observation: observationOf(identity.executionId, { refused: true, bodyOutcome: 'not-started' }),
          at: clock(),
          reason: `stop: the call was stopped before its body ran (${phase})`,
        })
      } catch (error) {
        fault(error, { phase: 'terminal', toolName: exec?.name })
        throw error
      }
    },
    /**
     * Reconcile what a previous process left open. A record still RUNNING after a crash is UNKNOWN -
     * the centre was not there to see the effect, so it must not report success OR failure - and it
     * is never replayed.
     */
    recover () {
      try {
        return store.recoverUnsettled(clock())
      } catch (error) {
        fault(error, { phase: 'fallback' })
        throw error
      }
    },
  })
}
