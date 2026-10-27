/**
 * web-family/src/search-row.mjs — the governed `web_search` ROW Definition
 * + presentation face (u7-f). Fixed native spelling (§ CI-04 takeover law,
 * same fixed-native precedent as the fs mutation rows and the jobs trio).
 *
 * SAME NAME, SAME MEANING: parameters `{queries: string[]}` (1–8) and the
 * result envelope `{content?, sources:[{url,title?,snippet?,publishedAt?}],
 * truncated}` mirror the native web_search at the host pin. The governed
 * difference is the authority chain (per-call PA over the provider's
 * declared connect destinations) and the honest absence rule: NO provider
 * mounted → typed `WEB_SEARCH_NO_PROVIDER` refusal, zero network — the
 * row never invents a provider and never fakes results.
 *
 * @module web-family/search-row
 */
import { WEB_SEARCH_NATIVE_NAME } from './web-mechanics.mjs'

/** The row's presentation face. */
export const SEARCH_ROW_PRESENTATION_FACE = Object.freeze({
  schema: Object.freeze({
    type: 'object',
    properties: Object.freeze({
      content: Object.freeze({ type: 'string' }),
      sources: Object.freeze({
        type: 'array',
        items: Object.freeze({
          type: 'object',
          properties: Object.freeze({
            url: Object.freeze({ type: 'string' }),
            title: Object.freeze({ type: 'string' }),
            snippet: Object.freeze({ type: 'string' }),
            publishedAt: Object.freeze({ type: 'string' }),
          }),
          required: Object.freeze(['url']),
          additionalProperties: false,
        }),
      }),
      truncated: Object.freeze({ type: 'boolean' }),
    }),
    required: Object.freeze(['sources', 'truncated']),
    additionalProperties: false,
  }),
  render: (_args, value) => {
    const parts = []
    if (typeof value?.content === 'string' && value.content.length > 0) parts.push(value.content)
    const sources = Array.isArray(value?.sources) ? value.sources : []
    for (const [i, s] of sources.entries()) {
      const title = typeof s?.title === 'string' && s.title.length > 0 ? s.title : s?.url ?? ''
      parts.push(`${String(i + 1)}. ${title} — ${String(s?.url ?? '')}`)
    }
    return [{ type: 'text', text: parts.join('\n') }]
  },
  presentationMeta: (_args, value) => ({
    sources: Array.isArray(value?.sources) ? value.sources.length : 0,
    truncated: value?.truncated === true,
  }),
})

/**
 * Build the governed web_search row Definition for one mount.
 *
 * @param {object} input
 * @param {string} input.name — the fixed native spelling the descriptor
 *   claims.
 * @param {(raw: unknown, corr: object) => Promise<unknown>} input.searchExecutor
 *   — the governed search executor (effect body + injected PA edge).
 */
export function buildSearchRowDefinition({ name = WEB_SEARCH_NATIVE_NAME, searchExecutor }) {
  return Object.freeze({
    name,
    description: 'Search the web through this mount\'s governed search provider. Without a configured provider the call is refused typed and nothing leaves the machine. With one, every call is admitted per-destination by the Team authority chain before the provider is contacted.',
    parameters: {
      type: 'object',
      // Native parity at the host pin (search.ts): `queries`, 1–max.
      properties: {
        queries: {
          type: 'array',
          items: { type: 'string' },
          minItems: 1,
          maxItems: 8,
          description: 'one to eight search queries',
        },
      },
      required: ['queries'],
    },
    execute: async (raw, exec) => {
      const corr = {
        ...(exec?.token === undefined ? {} : { token: exec.token }),
        ...(typeof exec?.tokenKey === 'string' && exec.tokenKey.length > 0 ? { correlation: exec.tokenKey } : {}),
        ...(exec?.signal === undefined ? {} : { signal: exec.signal }),
      }
      const outcome = await searchExecutor(raw, corr)
      if (outcome !== null && typeof outcome === 'object' && outcome.kind === 'ok') {
        return {
          ...(typeof outcome.content === 'string' ? { content: outcome.content } : {}),
          sources: outcome.sources,
          truncated: outcome.truncated === true,
        }
      }
      if (outcome !== null && typeof outcome === 'object' && outcome.kind === 'cancelled') {
        return { cancelled: true, content: [{ type: 'text', text: 'web_search · cancelled' }], meta: { cancelled: true } }
      }
      const text = outcome !== null && typeof outcome === 'object' && typeof outcome.text === 'string'
        ? outcome.text
        : 'refused-io executor-unavailable — the governed web_search executor produced no outcome'
      throw new Error(text)
    },
    output: SEARCH_ROW_PRESENTATION_FACE,
  })
}
