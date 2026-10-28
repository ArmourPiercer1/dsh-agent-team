/**
 * agent-control-family/src/list-models-row.mjs — the governed
 * `list_subagent_models` ROW Definition (U7-F). READ-ONLY ENUMERATION
 * (law (a)): `tool-invoke` + `meta(model-routes)` — no spawn authority is
 * declared or requested; listing routes never authorizes using one.
 *
 * @module agent-control-family/list-models-row
 */
import { nativeOutputSchemas } from './native-output-schemas.mjs'

export function buildListModelsRowDefinition({ name, listModelsExecutor }) {
  return Object.freeze({
    name,
    output: { schema: nativeOutputSchemas.list_subagent_models, render: (_args, result) => [{ type: 'text', text: result }] },
    description: 'Discover LLM routes for subagents without changing the current Agent. Call with no arguments to list providers, with provider to list its advertised models, or with provider and model to inspect that exact model and its reasoning efforts.',
    parameters: {
      type: 'object',
      properties: {
        provider: { type: 'string', description: 'Exact provider id to inspect; omit to list providers.' },
        model: { type: 'string', description: 'Exact model id to inspect. Requires provider; omit to list that provider\'s advertised models.' },
      },
      additionalProperties: false,
    },
    execute: async (raw, exec) => {
      const corr = {
        ...(typeof exec?.tokenKey === 'string' && exec.tokenKey.length > 0 ? { correlation: exec.tokenKey } : {}),
        ...(exec?.signal === undefined ? {} : { signal: exec.signal }),
        ...(exec?.agent === null || exec?.agent === undefined ? {} : { agent: exec.agent }),
      }
      const outcome = await listModelsExecutor(raw ?? {}, corr)
      if (outcome.kind === 'ok') {
        if (typeof outcome.value === 'string') return outcome.value
        if (outcome.value?.ok === true && Array.isArray(outcome.value.models)) return JSON.stringify(outcome.value)
        throw new Error('refused-agent-control — the governed list_subagent_models executor returned a value outside the native result schema')
      }
      if (outcome.kind === 'cancelled') throw new Error('list_subagent_models was cancelled')
      throw new Error(outcome.text ?? 'refused-agent-control — the governed list_subagent_models executor produced no outcome')
    },
  })
}
