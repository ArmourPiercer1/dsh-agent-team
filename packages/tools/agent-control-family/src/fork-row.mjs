/**
 * agent-control-family/src/fork-row.mjs — the governed `subagent_fork` ROW
 * Definition (U7-F). Law (e): the fork inherits the mount's CONVERSATION
 * CONTEXT as DATA — the context never travels through this row (the model
 * cannot even express a context arm: the grammar has none), the assembly's
 * context source supplies it, the executor scans it for authority shapes,
 * and the child receives data, never grants.
 *
 * @module agent-control-family/fork-row
 */

const NATIVE_OUTPUT = Object.freeze({
  schema: { oneOf: [
    { type: 'object', additionalProperties: false, required: ['kind', 'jobId'], properties: { kind: { type: 'string', const: 'background' }, jobId: { type: 'string' } } },
    { type: 'object', additionalProperties: false, required: ['kind', 'subagentId'], properties: { kind: { type: 'string', const: 'continuable' }, subagentId: { type: 'string' } } },
    { type: 'object', additionalProperties: false, required: ['kind', 'runId', 'output'], properties: { kind: { type: 'string', const: 'foreground' }, runId: { type: 'string' }, output: { type: 'array', items: {} } } },
  ] },
  render: (_args, value) => [{ type: 'text', text: value.kind === 'background' ? `started background subagent job ${value.jobId}` : value.kind === 'continuable' ? `started subagent ${value.subagentId}` : JSON.stringify(value.output) }],
})

export function buildForkRowDefinition({ name, forkExecutor }) {
  return Object.freeze({
    name,
    output: NATIVE_OUTPUT,
    description: 'Delegate a task to a governed child that inherits this conversation as DATA. Inherited context is never inherited authority: the child carries no grants, approvals, or permissions from the parent, and the spawn stays bounded by the caller\'s own authority.',
    parameters: {
      type: 'object',
      properties: {
        description: { type: 'string', description: 'A short (3-5 word) description of the delegated task.' },
        prompt: { type: 'string', description: 'The task for the child; it already sees this conversation\'s completed turns.' },
        run_in_background: { type: 'boolean', description: 'Whether the child runs in the background.' },
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
      const outcome = await forkExecutor(raw ?? {}, corr)
      if (outcome.kind === 'ok') {
        const value = outcome.value
        if (value !== null && typeof value === 'object') {
          if (value.kind === 'background' && typeof value.jobId === 'string') return { kind: 'background', jobId: value.jobId }
          if (value.kind === 'continuable' && typeof value.subagentId === 'string') return { kind: 'continuable', subagentId: value.subagentId }
          if (value.kind === 'foreground' && typeof value.runId === 'string' && Array.isArray(value.output)) {
            return { kind: 'foreground', runId: value.runId, output: value.output }
          }
        }
        throw new Error('refused-agent-control — the governed fork executor returned a value outside the native subagent result schema')
      }
      if (outcome.kind === 'cancelled') throw new Error('subagent_fork run was cancelled')
      throw new Error(outcome.text ?? 'refused-agent-control — the governed fork executor produced no outcome')
    },
  })
}
