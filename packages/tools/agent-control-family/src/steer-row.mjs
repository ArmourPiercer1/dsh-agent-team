/**
 * agent-control-family/src/steer-row.mjs — the governed `send_message` ROW
 * Definition (U7-F). Owner fence (law (d)): the target must live inside the
 * CALLER's own scope; a foreign-scope target refuses typed with zero reach,
 * mirroring the jobs owner fence.
 *
 * @module agent-control-family/steer-row
 */
export function buildSteerRowDefinition({ name, steerExecutor }) {
  return Object.freeze({
    name,
    description: 'Send one message to another agent inside THIS session scope. Targets outside the caller\'s own scope are refused before any runtime is reached; the call is admission-gated and its execution identity is one-shot (a settled call never re-delivers).',
    parameters: {
      type: 'object',
      properties: {
        agent_id: { type: 'string', description: 'Target agent id inside this scope (or this scope\'s own `scope:id` form).' },
        message: { type: 'string', description: 'The message to deliver.' },
      },
      required: ['agent_id', 'message'],
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
      const outcome = await steerExecutor(raw ?? {}, corr)
      if (outcome.kind === 'ok') return outcome.value ?? { delivered: true }
      if (outcome.kind === 'cancelled') return { cancelled: true, content: [{ type: 'text', text: 'send_message · cancelled' }], meta: { cancelled: true } }
      throw new Error(outcome.text ?? 'refused-agent-control — the governed send_message executor produced no outcome')
    },
  })
}
