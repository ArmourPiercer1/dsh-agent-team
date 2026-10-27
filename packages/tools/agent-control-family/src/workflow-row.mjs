/**
 * agent-control-family/src/workflow-row.mjs — the governed `workflow` ROW
 * Definition (U7-F). Law (c): a workflow script reaches other agents ONLY
 * through the executor-supplied, caller-bound spawn/steer delegates, and
 * every leg re-passes the no-amplification and owner fences — the workflow
 * cannot be a back door around either. The row's declared effect set
 * (tool-invoke + domain-ref) covers every spawn the script can make: no
 * leg inside a workflow acquires authority the call did not already carry.
 *
 * @module agent-control-family/workflow-row
 */
export function buildWorkflowRowDefinition({ name, workflowExecutor }) {
  return Object.freeze({
    name,
    description: 'Run a governed orchestration script whose agent legs execute through the caller-bound runtime delegates: every spawn re-passes the no-amplification fence and every steer re-passes the owner fence, so a workflow carries exactly THIS call\'s authority — never more.',
    parameters: {
      type: 'object',
      properties: {
        description: { type: 'string', description: 'A short description of the orchestration.' },
        prompt: { type: 'string', description: 'The closed orchestration request handed to the governed runtime.' },
      },
      required: ['description', 'prompt'],
      additionalProperties: false,
    },
    execute: async (raw, exec) => {
      const corr = {
        ...(typeof exec?.tokenKey === 'string' && exec.tokenKey.length > 0 ? { correlation: exec.tokenKey } : {}),
        ...(exec?.signal === undefined ? {} : { signal: exec.signal }),
        // The DISPATCH-provided caller identity (native callingAgent law):
        // trusted transport data — the model cannot express or restate it.
        ...(exec?.agent === null || exec?.agent === undefined ? {} : { agent: exec.agent }),
      }
      const outcome = await workflowExecutor(raw ?? {}, corr)
      if (outcome.kind === 'ok') {
        const value = outcome.value
        if (value !== null && typeof value === 'object') {
          if (value.kind === 'background' && typeof value.jobId === 'string' && typeof value.runId === 'string') return { kind: 'background', jobId: value.jobId, runId: value.runId }
          if (value.kind === 'foreground' && typeof value.runId === 'string' && Number.isInteger(value.agentsStarted) && 'result' in value) {
            return { kind: 'foreground', runId: value.runId, agentsStarted: value.agentsStarted, result: value.result }
          }
        }
        throw new Error('refused-agent-control — the governed workflow executor returned a value outside the native workflow result schema')
      }
      if (outcome.kind === 'cancelled') throw new Error('workflow was cancelled')
      throw new Error(outcome.text ?? 'refused-agent-control — the governed workflow executor produced no outcome')
    },
  })
}
