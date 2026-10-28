/**
 * agent-control-family/src/list-agents-row.mjs — the governed `list_agents`
 * ROW Definition (U7-F). READ-ONLY ENUMERATION (law (a)).
 * @module agent-control-family/list-agents-row
 */
import { nativeOutputSchemas } from './native-output-schemas.mjs'

export function buildListAgentsRowDefinition({ name, listAgentsExecutor }) {
  return Object.freeze({
    name,
    output: { schema: nativeOutputSchemas.list_agents, render: (_args, entries) => [{ type: 'text', text: entries.length === 0 ? '(no subagents)' : entries.map((entry) => `${entry.id} [${entry.kind === 'child' ? entry.status : `diagnostic: ${entry.reason}`}]`).join('\\n') }] },
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
        ...(exec?.agent === null || exec?.agent === undefined ? {} : { agent: exec.agent }),
      }
      const outcome = await listAgentsExecutor(raw ?? {}, corr)
      if (outcome.kind === 'ok') {
        const value = outcome.value
        if (Array.isArray(value)) return value
        if (value?.ok === true && Array.isArray(value.agents)) return value.agents
        throw new Error('refused-agent-control — the governed list_agents executor returned a value outside the native list_agents result schema')
      }
      if (outcome.kind === 'cancelled') throw new Error('list_agents was cancelled')
      throw new Error(outcome.text ?? 'refused-agent-control — the governed list_agents executor produced no outcome')
    },
  })
}
