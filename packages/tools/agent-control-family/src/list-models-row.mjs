/**
 * agent-control-family/src/list-models-row.mjs — the governed
 * `list_subagent_models` ROW Definition (U7-F). READ-ONLY ENUMERATION
 * (law (a)): `tool-invoke` + `meta(model-routes)` — no spawn authority is
 * declared or requested; listing routes never authorizes using one.
 *
 * @module agent-control-family/list-models-row
 */
export function buildListModelsRowDefinition({ name, listModelsExecutor }) {
  return Object.freeze({
    name,
    description: 'List the LLM providers/models advertised to this mount, optionally filtered by provider. Read-only enumeration of the route catalogue; it declares no mutation effect and spawns nothing.',
    parameters: {
      type: 'object',
      properties: { provider: { type: 'string', description: 'Exact provider id to inspect; omit to list providers.' } },
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
      const outcome = await listModelsExecutor(raw ?? {}, corr)
      if (outcome.kind === 'ok') {
        if (typeof outcome.value === 'string') return outcome.value
        throw new Error('refused-agent-control — the governed list_subagent_models executor returned a value outside the native result schema')
      }
      if (outcome.kind === 'cancelled') throw new Error('list_subagent_models was cancelled')
      throw new Error(outcome.text ?? 'refused-agent-control — the governed list_subagent_models executor produced no outcome')
    },
  })
}
