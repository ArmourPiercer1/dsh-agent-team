/**
 * pre-dispatch-abort.mjs — where a call that never entered the tool pipeline is still visible.
 *
 * THE DRIFT THIS EXISTS FOR. On 0.2.0-rc.2 a cancellation before the body still travelled the tool
 * pipeline, so the centre's `tools/result` observer saw it and wrote its execution fact. On
 * 0.2.2-rc.5 the batch scheduler does NOT enter the pipeline for such a call: `executeToolBatch`
 * drains the started calls and then calls `BatchSettlement.skip()` for every remaining model call,
 * which SYNTHESIZES an ordered error result carrying the host's own
 * `TOOL_ABORTED_BEFORE_DISPATCH` (`tests/deepseek-harness-next/packages/core/tools/src/batch.ts:88`,
 * `:225-229`, `:271-280`; the code itself is `contracts.ts#TOOL_ABORTED_BEFORE_DISPATCH`). The
 * batch, including those synthetic results, is returned to the caller of `ToolsService.execute`
 * (`packages/core/tools/src/index.ts:375-377`). Nothing about that path emits `tools/result`, so an
 * event-only centre records NOTHING for a pre-dispatch cancelled call.
 *
 * WHAT THIS MODULE IS. A READER of that returned value, and nothing else. It does not schedule, does
 * not dispatch, does not re-run, and never invents a tool event: the only thing it recognises is the
 * host's own pre-dispatch abort code, on a result the host itself produced. A call that entered the
 * pipeline (completed, failed, refused, aborted mid-flight) never carries that code, so this reader
 * cannot settle it — and even if it were handed the same call twice, the fact sink's ExecutionId
 * dedupe is the authority that decides (see `execution-facts.mjs`).
 *
 * WHERE THE RESULT COMES FROM. The caller of `tools.execute` owns it. In the compositions this repo
 * grades (the A1 slice world, and any product adapter that owns its own `tools.execute` call site)
 * that caller hands the returned batch to the centre's observer. In a real rc.5 agent turn the caller
 * is the host's own agent loop, which the product does not own; wiring an observation into THAT call
 * site would need an upstream seam and is therefore NOT done here (no patch, no wrapped service, no
 * second executor registration). See `RC5-MIGRATION.md` §7 for that residual gap.
 *
 * @module packages/runtime/src/plugin/vnext/pre-dispatch-abort
 */

/**
 * The host's own code for a call the scheduler cancelled before dispatch.
 *
 * A LITERAL, deliberately: the value is the pinned hosts' published contract
 * (`tests/deepseek-harness-next/packages/core/tools/src/contracts.ts:268`, whose exported NAME is
 * `TOOL_ABORTED_BEFORE_DISPATCH` and whose VALUE is `ABORTED_BEFORE_DISPATCH`). Importing a host
 * package from product code to read one constant would bind this module to a host version at load
 * time; a drift in the value is caught by `SLICE-37`, which drives the REAL host and reads the code
 * off the real result.
 */
export const PRE_DISPATCH_ABORT_CODE = 'ABORTED_BEFORE_DISPATCH'

/**
 * Whether a settled tool result is the host's own pre-dispatch cancellation.
 *
 * @param {object|undefined} result - one `ToolExecutionResult` (either host generation).
 * @returns {boolean} true only for the host's explicit pre-dispatch abort code.
 */
export function isPreDispatchAbort (result) {
  return result?.error?.info?.code === PRE_DISPATCH_ABORT_CODE
}

/** The callId a batch input entry is keyed by (`dsh-llm` tool-call blocks or a plain descriptor). */
const callIdOf = (call) => {
  const value = call?.id ?? call?.callId
  return typeof value === 'string' && value !== '' ? value : undefined
}

/**
 * Normalise one executor completion into the pre-dispatch cancellations it reports.
 *
 * TWO HOST GENERATIONS, ONE READER. rc.5 answers a `ToolBatchResult` whose `results[]` pairs each
 * callId with its result; rc.2 answers one `ToolExecutionResult` for the single call it was given.
 * Anything else is refused rather than guessed: a completion this reader cannot key is a completion
 * it cannot record, and inventing a callId would be exactly the fabrication the rule forbids.
 *
 * @param {object} input
 * @param {readonly object[]} input.calls - the calls the batch was made of (the caller's own input).
 * @param {object} input.completion - the value `tools.execute` returned.
 * @returns {ReadonlyArray<{callId: string, toolName: string, result: object}>} the pre-dispatch aborts.
 * @throws {TypeError} when the completion cannot be paired with a callId.
 */
export function preDispatchAbortsOf ({ calls, completion }) {
  if (!Array.isArray(calls)) throw new TypeError('pre-dispatch-abort: calls must be the batch input array')
  const names = new Map()
  for (const call of calls) {
    const callId = callIdOf(call)
    if (callId !== undefined) names.set(callId, typeof call?.name === 'string' ? call.name : '')
  }
  const entries = Array.isArray(completion?.results)
    ? completion.results.map((entry) => ({ callId: entry?.callId, result: entry?.result }))
    : calls.length === 1
      ? [{ callId: callIdOf(calls[0]), result: completion }]
      : []
  const aborts = []
  for (const entry of entries) {
    if (!isPreDispatchAbort(entry.result)) continue
    const callId = typeof entry.callId === 'string' && entry.callId !== ''
      ? entry.callId
      : calls.length === 1 ? callIdOf(calls[0]) : undefined
    if (callId === undefined) {
      throw new TypeError('pre-dispatch-abort: the host reported a pre-dispatch abort for a result that names no callId; a fact that cannot be keyed cannot be joined to its call')
    }
    aborts.push(Object.freeze({ callId, toolName: names.get(callId) ?? '', result: entry.result }))
  }
  return Object.freeze(aborts)
}
