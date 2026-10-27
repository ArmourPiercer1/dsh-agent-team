/**
 * agent-control-family/src/interrupt-row.mjs — the governed
 * `interrupt_agent` ROW Definition (U7-F). Same owner fence as
 * `send_message` (law (d)): an agent id outside the caller's own scope gets
 * the typed refusal with ZERO reach — no roster probe of the foreign agent,
 * no runtime call, no state read.
 *
 * @module agent-control-family/interrupt-row
 */
export function buildInterruptRowDefinition({ name, interruptExecutor }) {
  return Object.freeze({
    name,
    output: { schema: { type: 'object', additionalProperties: false, required: ['accepted'], properties: { accepted: { type: 'boolean' } } }, render: (args) => [{ type: 'text', text: `interrupt requested for agent ${args.agent_id}` }] },
    description: 'Request cancellation of one agent\'s current turn inside THIS session scope. Foreign-scope targets are refused with zero reach; the request rides the runtime\'s own cancel leg and never settles cancellation itself.',
    parameters: {
      type: 'object',
      properties: {
        agent_id: { type: 'string', description: 'Target agent id inside this scope (or this scope\'s own `scope:id` form).' },
        reason: { type: 'string', description: 'Optional short reason recorded with the request.' },
      },
      required: ['agent_id'],
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
      const outcome = await interruptExecutor(raw ?? {}, corr)
      if (outcome.kind === 'ok') {
        const value = outcome.value
        if (value !== null && typeof value === 'object' && typeof value.accepted === 'boolean') return { accepted: value.accepted }
        throw new Error('refused-agent-control — the governed interrupt executor returned a value outside the native result schema')
      }
      if (outcome.kind === 'cancelled') throw new Error('interrupt_agent was cancelled')
      throw new Error(outcome.text ?? 'refused-agent-control — the governed interrupt executor produced no outcome')
    },
  })
}
