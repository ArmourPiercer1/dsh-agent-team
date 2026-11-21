/**
 * execution-facts.mjs — one physical execution, one canonical fact.
 *
 * UTE-15 says a single execution produces exactly one durable fact, and UTE-16 says the fact's
 * outcome must keep its provenance separate: "the body failed" and "the call was refused before the
 * body" are different events, and a record that merges them makes a governed refusal look like a
 * bug in a tool.
 *
 * Both are easy to get wrong in the same way: listen to the host's `tools/result` and write what
 * arrives. That double-counts (the admission point already recorded an authority fact for the same
 * callId), and it loses the provenance the host cannot know — only the centre knows whether it
 * refused the call at admission. So this observer JOINS the two: the execution fact carries the
 * host's outcome and the centre's admission verdict, and a second event for a callId it has already
 * recorded is a REFUSAL, not a merge. A duplicate callId is either a replay or two executions
 * sharing an identity; both must be visible as such, never silently collapsed.
 *
 * @module packages/runtime/src/plugin/vnext/execution-facts
 */

export class ExecutionFactsError extends TypeError {
  constructor (code, message) {
    super(`execution-facts: ${message}`)
    this.name = 'ExecutionFactsError'
    this.code = code
  }
}

/** How the call ended, with the provenance kept apart from the outcome. */
export const OUTCOME_KINDS = Object.freeze(['admission-refusal', 'approval-refused', 'aborted', 'failed', 'completed'])

/**
 * @param {object} input
 * @param {object} input.ctx - the agent-scoped context that owns `tools`.
 * @param {(fact: object) => void} input.record - the durable sink. Called exactly once per callId.
 * @param {(callId: string) => object|undefined} [input.admissionOf] - the centre's admission record
 *   for that callId, when one was written. Its presence is what distinguishes a refusal from a
 *   body failure.
 * @param {(callId: string) => string} [input.executionIdOf] - the SETTLEMENT identity for the
 *   physical attempt. Supplied rather than derived so the centre uses the product's own
 *   `dispatchExecutionId(provenance, callId)` instead of making a second id scheme.
 * @returns {() => void} the disposer.
 */
export function installExecutionFacts ({ ctx, record, admissionOf, executionIdOf, onFact }) {
  if (ctx === null || typeof ctx !== 'object' || typeof ctx.on !== 'function') {
    throw new ExecutionFactsError('CTX_MISSING', 'no agent context to observe')
  }
  if (typeof record !== 'function') throw new ExecutionFactsError('RECORD_MISSING', 'record must be a function: an execution without a fact is unreviewable')

  /** callId -> the fact already written. Its size is also the bound on "one fact per execution". */
  const written = new Map()

  const dispose = ctx.on('tools/result', (exec, result) => {
    const callId = exec?.callId
    if (typeof callId !== 'string' || callId === '') {
      throw new ExecutionFactsError('CALL_ID_MISSING', 'the host executed a tool without a callId; a fact that cannot be keyed cannot be joined to its authority record')
    }
    if (written.has(callId)) {
      const previous = written.get(callId)
      throw new ExecutionFactsError(
        'EXECUTION_FACT_DUPLICATE',
        `callId ${JSON.stringify(callId)} already produced a fact (${previous.outcome}); a second one is a replay or two executions sharing an identity, neither of which may be merged into one record`,
      )
    }
    const admission = typeof admissionOf === 'function' ? admissionOf(callId) : undefined
    const refusedAtAdmission = admission !== undefined && admission.decision === 'deny'
    const isError = result?.isError === true
    const fact = Object.freeze({
      callId,
      ...(typeof executionIdOf === 'function' ? { executionId: executionIdOf(callId) } : {}),
      toolName: exec.name,
      agentId: typeof exec.agent?.id === 'string' ? exec.agent.id : '',
      turn: exec.turn,
      step: exec.step,
      // The outcome is the HOST's; the provenance is the CENTRE's. A refusal that reached the body
      // would be a governance defect, so it is reported as a refusal and not as a tool error.
      // Neither a Stop nor a refused approval is a tool failure, and collapsing them into 'failed'
      // makes an operator's decision indistinguishable from a crash in every report that follows.
      outcome: refusedAtAdmission
        ? 'admission-refusal'
        : exec.signal?.aborted === true
          ? 'aborted'
          : admission?.decision === 'ask' && isError
            ? 'approval-refused'
            : isError ? 'failed' : 'completed',
      isError,
      ...(refusedAtAdmission ? { refusalCode: admission.refusalCode ?? 'ADMISSION_REFUSED' } : {}),
      ...(isError && !refusedAtAdmission && typeof result?.error?.message === 'string' ? { errorMessage: result.error.message } : {}),
      ...(admission?.policyGeneration === undefined ? {} : { policyGeneration: admission.policyGeneration }),
    })
    written.set(callId, fact)
    record(fact)
    // The settlement writer reads the SAME fact the ledger got: one observation, two consumers, and
    // no second judgement about what the call did.
    if (typeof onFact === 'function') onFact(fact, exec)
  })

  if (typeof dispose !== 'function') throw new ExecutionFactsError('DISPOSER_MISSING', 'ctx.on() returned no disposer')
  return dispose
}
