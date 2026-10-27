/**
 * inspect-family/src/inspect-rows.mjs — the two governed inspect row
 * Definitions (plain Definition transport, like the skill row).
 *
 * Same-meaning law: descriptions, parameters and the JSON-pretty render
 * mirror the native `cordis_inspect_list` / `cordis_inspect_query` tool
 * shapes (tool-cordis/src/index.ts @639ed01539); the governed rows mount
 * under the family's alias spellings (row-names.mjs states why), add PA
 * admission, the lane law, typed refusals, and the bounded settle/cancel
 * leg, and keep the closed read-only contract: inspect is never a business
 * Service call and can never carry a mutation.
 *
 * @module inspect-family/inspect-rows
 */
import { INSPECT_LIST_ROW_NAME, INSPECT_QUERY_ROW_NAME } from './row-names.mjs'

const jsonRender = (_args, value) => [{ type: 'text', text: JSON.stringify(value, null, 2) }]

export function buildInspectRowDefinitions({ inspectListExecutor, inspectQueryExecutor, listName = INSPECT_LIST_ROW_NAME, queryName = INSPECT_QUERY_ROW_NAME }) {
  const listRow = Object.freeze({
    name: listName,
    description: 'List every Cordis Inspect Provider currently known to the Host, governed: the listing is read through the host registry public face after PA admission. Each entry includes its platform, purpose, read-only methods, and input/output schemas. Call this tool before configuring a plugin, then select the provider and method for team_cordis_inspect_query from its result. Do not guess names or treat an Inspect method as a business Service that plugin code can call.',
    parameters: Object.freeze({ type: 'object', properties: Object.freeze({}), additionalProperties: false }),
    execute: async (_raw, exec) => {
      const corr = {
        ...(exec?.token === undefined ? {} : { token: exec.token }),
        ...(typeof exec?.tokenKey === 'string' && exec.tokenKey.length > 0 ? { correlation: exec.tokenKey } : {}),
        ...(exec?.signal === undefined ? {} : { signal: exec.signal }),
        ...(exec?.agent === undefined ? {} : { agent: exec.agent }),
      }
      const outcome = await inspectListExecutor({}, corr)
      if (outcome !== null && typeof outcome === 'object' && outcome.kind === 'ok') return outcome.value
      if (outcome !== null && typeof outcome === 'object' && outcome.kind === 'cancelled') {
        return { cancelled: true, content: [{ type: 'text', text: 'team_cordis_inspect_list · cancelled' }], meta: { cancelled: true } }
      }
      const text = outcome !== null && typeof outcome === 'object' && typeof outcome.text === 'string'
        ? outcome.text
        : 'refused-io executor-unavailable — the governed inspect-list executor produced no outcome'
      throw new Error(text)
    },
    // Any-JSON output node: the host's enforced schema subset expresses
    // unconstrained JSON by OMITTING `type` (core/tools/json-schema.ts
    // @639ed01539 — 'json' is the native extension DSL's spelling, not a
    // node type the registration path accepts).
    output: Object.freeze({ schema: Object.freeze({ description: 'The provider directory as a JSON value.' }), render: jsonRender }),
  })
  const queryRow = Object.freeze({
    name: queryName,
    description: 'Run a read-only query declared by an Inspect Provider, governed: platform, provider, and method must come from team_cordis_inspect_list, and input must satisfy that method\'s schema (invalid or unverifiable input is refused before dispatch). The query waits under a bounded settle race: on timeout or cancellation the call answers a typed refusal and a late result is NEVER delivered. This tool cannot invoke business Service methods or modify the runtime.',
    parameters: Object.freeze({
      type: 'object',
      properties: Object.freeze({
        platform: Object.freeze({ type: 'string', enum: Object.freeze(['host', 'client']), description: 'Runtime platform that owns the Provider.' }),
        provider: Object.freeze({ type: 'string', description: 'Exact Provider ID returned by team_cordis_inspect_list.' }),
        method: Object.freeze({ type: 'string', description: 'Exact method name declared by the Provider manifest.' }),
        input: Object.freeze({ description: 'Optional query input; it must satisfy the method input schema. (Any JSON value; a node without `type` is the host subset\'s unconstrained form.)' }),
      }),
      required: Object.freeze(['platform', 'provider', 'method']),
      additionalProperties: false,
    }),
    execute: async (raw, exec) => {
      const corr = {
        ...(exec?.token === undefined ? {} : { token: exec.token }),
        ...(typeof exec?.tokenKey === 'string' && exec.tokenKey.length > 0 ? { correlation: exec.tokenKey } : {}),
        ...(exec?.signal === undefined ? {} : { signal: exec.signal }),
        ...(exec?.agent === undefined ? {} : { agent: exec.agent }),
      }
      const outcome = await inspectQueryExecutor(raw ?? {}, corr)
      if (outcome !== null && typeof outcome === 'object' && outcome.kind === 'ok') return outcome.value
      if (outcome !== null && typeof outcome === 'object' && outcome.kind === 'cancelled') {
        return { cancelled: true, content: [{ type: 'text', text: 'team_cordis_inspect_query · cancelled' }], meta: { cancelled: true } }
      }
      const text = outcome !== null && typeof outcome === 'object' && typeof outcome.text === 'string'
        ? outcome.text
        : 'refused-io executor-unavailable — the governed inspect-query executor produced no outcome'
      throw new Error(text)
    },
    output: Object.freeze({ schema: Object.freeze({ description: 'The provider method result as a JSON value.' }), render: jsonRender }),
  })
  return [listRow, queryRow]
}
