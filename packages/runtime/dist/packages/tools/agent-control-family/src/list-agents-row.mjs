/**
 * agent-control-family/src/list-agents-row.mjs — the governed `list_agents`
 * ROW Definition (U7-F). READ-ONLY ENUMERATION (law (a)): this row's effect
 * world is `tool-invoke` + `meta` ONLY — it never derives the domain-ref arm
 * and therefore never requests a mutation effect (the C1 leg pins it from
 * the PA request the row actually carries).
 *
 * @module agent-control-family/list-agents-row
 */
export function buildListAgentsRowDefinition({ name, listAgentsExecutor }) {
  return Object.freeze({
    name,
    description: 'List the subagents this session started (its own subagent catalog). Read-only enumeration: it declares no mutation effect and reaches no spawn, steer, or interrupt face of the runtime.',
    parameters: {
      type: 'object',
      properties: {
        scope: { type: 'string', enum: ['children', 'descendants'], description: 'children (default) lists your direct children only; descendants walks the complete tree below you.' },
      },
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
      const outcome = await listAgentsExecutor(raw ?? {}, corr)
      if (outcome.kind === 'ok') return outcome.value ?? { agents: [] }
      if (outcome.kind === 'cancelled') return { cancelled: true, content: [{ type: 'text', text: 'list_agents · cancelled' }], meta: { cancelled: true } }
      throw new Error(outcome.text ?? 'refused-agent-control — the governed list_agents executor produced no outcome')
    },
  })
}
