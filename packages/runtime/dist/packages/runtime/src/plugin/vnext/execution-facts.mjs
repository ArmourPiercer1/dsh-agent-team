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
 * TWO OBSERVATION POINTS, ONE FACT LAW. `tools/result` is the pipeline's own announcement and stays
 * the primary one. rc.5's batch scheduler can cancel a call BEFORE dispatch and never run the
 * pipeline at all, so it announces those calls only in the value `tools.execute` returns; the second
 * entry point reads exactly that value (see `pre-dispatch-abort.mjs`) and writes the same shape of
 * fact. Both points share ONE dedupe map keyed by the product's ExecutionId, so a call that two
 * paths happen to report is still one execution with one fact.
 *
 * @module packages/runtime/src/plugin/vnext/execution-facts
 */

import { isPreDispatchAbort, preDispatchAbortsOf } from './pre-dispatch-abort.mjs'

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
 * The centre's execution-fact writer. One callId, one fact; the dedupe key is the product's
 * ExecutionId whenever the caller supplied an id scheme, because that is the identity the settlement
 * store joins on.
 *
 * @param {object} input
 * @param {(fact: object) => void} input.record - the durable sink. Called at most once per execution.
 * @param {(callId: string) => object|undefined} [input.admissionOf] - the centre's admission record
 *   for that callId, when one was written. Its presence is what distinguishes a refusal from a
 *   body failure.
 * @param {(callId: string) => string} [input.executionIdOf] - the SETTLEMENT identity for the
 *   physical attempt. Supplied rather than derived so the centre uses the product's own
 *   `dispatchExecutionId(provenance, callId)` instead of making a second id scheme.
 * @param {(fact: object, exec: object) => void} [input.onFact] - pipeline-path consumer (the
 *   settlement writer).
 * @param {(fact: object, exec: object) => void} [input.onPreDispatchAbort] - the pre-dispatch path's
 *   own consumer. Kept SEPARATE from `onFact` because the two paths owe different settlement work: a
 *   pipeline abort is an in-flight Stop, a pre-dispatch abort is a Stop that closed nothing.
 * @param {(fact: object, error: unknown) => void} [input.onUnrecordable] - called when the durable
 *   sink REFUSES a pre-dispatch fact (the product ledger refuses an execution it cannot join to an
 *   admission record). The refusal is reported, never converted into a fabricated record and never
 *   allowed to break the host's call.
 * @returns {{ observeHostResult: Function, observePreDispatchAbort: Function, observeExecutorCompletion: Function, has: Function }}
 */
export function createExecutionFacts ({ record, admissionOf, executionIdOf, onFact, onPreDispatchAbort, onUnrecordable }) {
  if (typeof record !== 'function') throw new ExecutionFactsError('RECORD_MISSING', 'record must be a function: an execution without a fact is unreviewable')

  /** ExecutionId (or callId when no id scheme exists) -> the fact already written. */
  const written = new Map()
  const executionIdOfCall = (callId) => (typeof executionIdOf === 'function' ? executionIdOf(callId) : callId)

  const write = (exec, result, { outcome: forcedOutcome, abortPhase, tolerateRecordRefusal = false } = {}) => {
    const callId = exec?.callId
    if (typeof callId !== 'string' || callId === '') {
      throw new ExecutionFactsError('CALL_ID_MISSING', 'the host executed a tool without a callId; a fact that cannot be keyed cannot be joined to its authority record')
    }
    const executionId = executionIdOfCall(callId)
    if (written.has(executionId)) {
      const previous = written.get(executionId)
      throw new ExecutionFactsError(
        'EXECUTION_FACT_DUPLICATE',
        `execution ${JSON.stringify(executionId)} (callId ${JSON.stringify(callId)}) already produced a fact (${previous.outcome}); a second one is a replay or two executions sharing an identity, neither of which may be merged into one record`,
      )
    }
    const admission = typeof admissionOf === 'function' ? admissionOf(callId) : undefined
    // A refusal can happen at TWO points and both are the CENTRE's, not the tool's: at admission
    // (`decision: 'deny'`), and at the guard's post-approval RECHECK - where the decision WAS an
    // allow and the authority was revoked before the body. The guard's verdict reaches this event only
    // as the tool error carrying the centre's own stable code, so the prefix is matched deliberately
    // and the code is kept in the fact instead of being reduced to prose.
    const isError = result?.isError === true
    const guardCode = isError
      ? (/^(ADMISSION_[A-Z_]+):/u.exec(String(result?.error?.message ?? result?.errorMessage ?? result?.text ?? ''))?.[1])
      : undefined
    const refusedAtAdmission = (admission !== undefined && admission.decision === 'deny') || guardCode !== undefined
    const fact = Object.freeze({
      callId,
      ...(typeof executionIdOf === 'function' ? { executionId } : {}),
      toolName: exec.name,
      agentId: typeof exec.agent?.id === 'string' ? exec.agent.id : '',
      ...(typeof exec.turn === 'number' ? { turn: exec.turn } : {}),
      ...(typeof exec.step === 'number' ? { step: exec.step } : {}),
      // The outcome is the HOST's; the provenance is the CENTRE's. A refusal that reached the body
      // would be a governance defect, so it is reported as a refusal and not as a tool error.
      // Neither a Stop nor a refused approval is a tool failure, and collapsing them into 'failed'
      // makes an operator's decision indistinguishable from a crash in every report that follows.
      outcome: forcedOutcome ?? (refusedAtAdmission
        ? 'admission-refusal'
        : exec.signal?.aborted === true
          ? 'aborted'
          : admission?.decision === 'ask' && isError
            ? 'approval-refused'
            : isError ? 'failed' : 'completed'),
      isError,
      // WHERE the Stop landed. On the completion path the pipeline never saw the call, so no
      // `exec.signal` exists; on the pipeline path the host's own result carries the same code. Both
      // are the HOST's evidence that the body was never dispatched, and recording it is what keeps a
      // pre-dispatch Stop distinguishable from an in-flight one in every later report.
      ...(abortPhase === undefined && !isPreDispatchAbort(result) ? {} : { abortPhase: abortPhase ?? 'pre-dispatch' }),
      // The guard's own code when the refusal happened there (the decision was an allow), otherwise
      // the admission record's code. A recheck refusal with no code would be indistinguishable from a
      // body failure in every later report.
      ...(guardCode !== undefined
        ? { refusalCode: guardCode }
        : refusedAtAdmission ? { refusalCode: admission.refusalCode ?? 'ADMISSION_REFUSED' } : {}),
      ...(isError && !refusedAtAdmission && typeof result?.error?.message === 'string' ? { errorMessage: result.error.message } : {}),
      ...(admission?.policyGeneration === undefined ? {} : { policyGeneration: admission.policyGeneration }),
    })
    try {
      record(fact)
    } catch (error) {
      // The durable sink is the one that owns "no fabrication" for records: the product ledger
      // refuses an execution it cannot join to an admission record (LEDGER_EXECUTION_UNBOUND). For
      // the pre-dispatch path that refusal is a REPORT, not a reason to fail the host's call - and
      // never a reason to write the fact into the in-memory dedupe map as if it had been recorded.
      if (!tolerateRecordRefusal) throw error
      if (typeof onUnrecordable === 'function') onUnrecordable(fact, error)
      return Object.freeze({ fact, recorded: false })
    }
    written.set(executionId, fact)
    // The settlement writer reads the SAME fact the ledger got: one observation, two consumers, and
    // no second judgement about what the call did.
    if (typeof onFact === 'function') onFact(fact, exec)
    return Object.freeze({ fact, recorded: true })
  }

  /** The pipeline's own `tools/result` announcement. A duplicate here is a replay and is refused. */
  const observeHostResult = (exec, result) => write(exec, result).fact

  /**
   * An abort the host announced at the executor completion boundary instead of in the pipeline.
   *
   * IDEMPOTENT BY ExecutionId, unlike the pipeline path: this observation point is fed by whatever
   * owns the `tools.execute` call site, and a caller that re-delivers the same completion (or a
   * host generation on which BOTH points report the same call) must not create a second fact or a
   * second settlement. It returns what it did so the caller can report the dedupe instead of
   * swallowing it.
   *
   * @param {{callId: string, toolName: string, result: object, agent?: object, turn?: number, step?: number}} entry
   * @returns {{observed: boolean, deduped: boolean, fact?: object}} the observation result.
   */
  const observePreDispatchAbort = (entry) => {
    const callId = entry?.callId
    if (typeof callId !== 'string' || callId === '') {
      throw new ExecutionFactsError('CALL_ID_MISSING', 'a pre-dispatch abort arrived with no callId; it cannot be joined to any admission record')
    }
    const executionId = executionIdOfCall(callId)
    if (written.has(executionId)) return Object.freeze({ observed: true, deduped: true })
    const exec = {
      callId,
      name: entry.toolName,
      ...(entry.agent === undefined ? {} : { agent: entry.agent }),
      ...(entry.turn === undefined ? {} : { turn: entry.turn }),
      ...(entry.step === undefined ? {} : { step: entry.step }),
    }
    const { fact, recorded } = write(exec, entry.result, { outcome: 'aborted', abortPhase: 'pre-dispatch', tolerateRecordRefusal: true })
    // A fact the durable sink refused is still reported to the caller, but nothing is settled for it:
    // settling an execution that has no record would be the fabrication this whole path refuses.
    if (recorded && typeof onPreDispatchAbort === 'function') onPreDispatchAbort(fact, exec)
    return Object.freeze({ observed: true, deduped: false, recorded, fact })
  }

  /**
   * Read one executor completion and record every pre-dispatch cancellation it reports.
   *
   * The ONLY thing this looks at is the pinned hosts' own `TOOL_ABORTED_BEFORE_DISPATCH` code, so a
   * call that entered the pipeline (completed, failed, refused, aborted mid-flight) is never
   * observed here. Returns counts, not silence: a caller can assert that the observation happened.
   *
   * @param {{calls: readonly object[], completion: object, agent?: object, turn?: number, step?: number}} input
   * @returns {{observed: number, recorded: number, deduped: number}} what the completion carried.
   */
  const observeExecutorCompletion = ({ calls, completion, agent, turn, step }) => {
    const aborts = preDispatchAbortsOf({ calls, completion })
    let recorded = 0
    let deduped = 0
    let unrecordable = 0
    for (const abort of aborts) {
      const outcome = observePreDispatchAbort({ ...abort, agent, turn, step })
      if (outcome.deduped) deduped += 1
      else if (outcome.recorded === false) unrecordable += 1
      else recorded += 1
    }
    return Object.freeze({ observed: aborts.length, recorded, deduped, unrecordable })
  }

  /** Whether an execution already has a fact (the dedupe answer, by the product's identity). */
  const has = (callId) => written.has(executionIdOfCall(callId))

  return Object.freeze({ observeHostResult, observePreDispatchAbort, observeExecutorCompletion, has })
}

/**
 * @param {object} input
 * @param {object} input.ctx - the agent-scoped context that owns `tools`.
 * @param {(fact: object) => void} input.record - the durable sink. Called exactly once per callId.
 * @param {(callId: string) => object|undefined} [input.admissionOf] - the centre's admission record
 *   for that callId, when one was written.
 * @param {(callId: string) => string} [input.executionIdOf] - the product ExecutionId for the attempt.
 * @param {(fact: object, exec: object) => void} [input.onFact] - pipeline-path consumer.
 * @param {(fact: object, exec: object) => void} [input.onPreDispatchAbort] - pre-dispatch consumer.
 * @param {(fact: object, error: unknown) => void} [input.onUnrecordable] - durable refusal consumer.
 * @returns {{dispose: () => void, observeExecutorCompletion: Function, observePreDispatchAbort: Function, has: Function}} the installed observer.
 */
export function installExecutionFacts ({ ctx, record, admissionOf, executionIdOf, onFact, onPreDispatchAbort, onUnrecordable }) {
  if (ctx === null || typeof ctx !== 'object' || typeof ctx.on !== 'function') {
    throw new ExecutionFactsError('CTX_MISSING', 'no agent context to observe')
  }
  const facts = createExecutionFacts({ record, admissionOf, executionIdOf, onFact, onPreDispatchAbort, onUnrecordable })
  const dispose = ctx.on('tools/result', facts.observeHostResult)
  if (typeof dispose !== 'function') throw new ExecutionFactsError('DISPOSER_MISSING', 'ctx.on() returned no disposer')
  return Object.freeze({
    dispose,
    observeExecutorCompletion: facts.observeExecutorCompletion,
    observePreDispatchAbort: facts.observePreDispatchAbort,
    has: facts.has,
  })
}
