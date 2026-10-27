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

export function buildForkRowDefinition({ name, forkExecutor }) {
  return Object.freeze({
    name,
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
      if (outcome.kind === 'ok') return outcome.value ?? { delegated: true }
      if (outcome.kind === 'cancelled') return { cancelled: true, content: [{ type: 'text', text: 'subagent_fork · cancelled' }], meta: { cancelled: true } }
      throw new Error(outcome.text ?? 'refused-agent-control — the governed fork executor produced no outcome')
    },
  })
}
