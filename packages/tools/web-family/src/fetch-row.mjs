/**
 * web-family/src/fetch-row.mjs — the governed `web_fetch` ROW Definition +
 * presentation face (u7-f). The Family owns the Definition (name,
 * description, parameter schema, execute transport, presentation); the
 * native spelling is the takeover law's requirement (§ CI-04 — the same
 * FIXED-native precedent the fs lane carries for `write`/`edit`/
 * `read_image` and the jobs lane for the `job_*` trio: a seam family's
 * fixed claims ride the reviewed-manifest law, not the four configurable
 * Gate 0b rows).
 *
 * SAME NAME, SAME MEANING: the parameter surface (`{url}`) and the result
 * envelope (`{url, statusCode, body:{kind,content}, truncated}`) mirror
 * the native web_fetch at the host pin. Disclosed deviations (PR body,
 * verbatim): the governed row BOUNDS what the native does freely —
 * response bytes are capped (overrun refuses WHOLE, so `truncated` is
 * always false and a real success never lies about partial content), the
 * call has a wall-time bound, redirects are hop-bounded and stay inside
 * the approved origin, the scheme allowlist is https by default, and a
 * URL carrying userinfo is refused rather than stripped. A 4xx/5xx
 * response DELIVERS with its honest status, exactly like the native.
 *
 * @module web-family/fetch-row
 */
import { WEB_FETCH_NATIVE_NAME } from './web-mechanics.mjs'

/** The row's presentation face: schema + a stable text render. */
export const FETCH_ROW_PRESENTATION_FACE = Object.freeze({
  schema: Object.freeze({
    type: 'object',
    properties: Object.freeze({
      url: Object.freeze({ type: 'string' }),
      statusCode: Object.freeze({ type: 'integer' }),
      body: Object.freeze({
        type: 'object',
        properties: Object.freeze({
          kind: Object.freeze({ type: 'string', enum: Object.freeze(['html', 'text']) }),
          content: Object.freeze({ type: 'string' }),
        }),
        required: Object.freeze(['kind', 'content']),
        additionalProperties: false,
      }),
      truncated: Object.freeze({ type: 'boolean' }),
    }),
    required: Object.freeze(['url', 'statusCode', 'body', 'truncated']),
    additionalProperties: false,
  }),
  render: (_args, value) => {
    const status = typeof value?.statusCode === 'number' ? value.statusCode : 0
    const url = typeof value?.url === 'string' ? value.url : ''
    const content = typeof value?.body?.content === 'string' ? value.body.content : ''
    return [{
      type: 'text',
      text: `<url>${url}</url>\n<status>${String(status)}</status>\n<content>\n${content}\n</content>`,
    }]
  },
  presentationMeta: (_args, value) => ({
    url: value.url,
    statusCode: value.statusCode,
    bodyKind: value.body?.kind ?? 'text',
    truncated: value.truncated === true,
  }),
})

/**
 * Build the governed web_fetch row Definition for one mount.
 *
 * @param {object} input
 * @param {string} input.name — the takeover spelling the DESCRIPTOR
 *   claims (the fixed native `web_fetch`; the reviewed manifest, not a
 *   model argument or a Gate 0b row, is what validates this claim).
 * @param {(raw: unknown, corr: object) => Promise<unknown>} input.fetchExecutor
 *   — the governed fetch executor (effect body + injected PA edge).
 */
export function buildFetchRowDefinition({ name = WEB_FETCH_NATIVE_NAME, fetchExecutor }) {
  return Object.freeze({
    name,
    description: 'Fetch one page over the network through the governed web family. HTTPS only (unless this mount explicitly opted into loopback HTTP), one hop chain bounded to one approved origin, responses size- and time-bounded, credentials in URLs refused. Every call is admitted per-destination by the Team authority chain; a refused call performs no network effect at all.',
    parameters: {
      type: 'object',
      // Native parity at the host pin (fetch.ts): exactly one required
      // `url` — no maxChars/timeout lanes (bounds are trusted
      // construction, never model arguments).
      properties: {
        url: { type: 'string', description: 'the absolute URL to fetch (https by default)' },
      },
      required: ['url'],
    },
    // Transfer law (fs rows): SUCCESS returns the result object; a
    // CANCELLED invocation is a presented row-form fact; a refusal is a
    // THROW of the verbatim refusal text — stable, model-visible, no stack.
    execute: async (raw, exec) => {
      const corr = {
        ...(exec?.token === undefined ? {} : { token: exec.token }),
        ...(typeof exec?.tokenKey === 'string' && exec.tokenKey.length > 0 ? { correlation: exec.tokenKey } : {}),
        ...(exec?.signal === undefined ? {} : { signal: exec.signal }),
      }
      const outcome = await fetchExecutor(raw, corr)
      if (outcome !== null && typeof outcome === 'object' && outcome.kind === 'ok') {
        return {
          url: outcome.url,
          statusCode: outcome.statusCode,
          body: { kind: outcome.body.kind, content: outcome.body.content },
          truncated: outcome.truncated === true,
        }
      }
      if (outcome !== null && typeof outcome === 'object' && outcome.kind === 'cancelled') {
        return { cancelled: true, content: [{ type: 'text', text: 'web_fetch · cancelled' }], meta: { cancelled: true } }
      }
      const text = outcome !== null && typeof outcome === 'object' && typeof outcome.text === 'string'
        ? outcome.text
        : 'refused-io executor-unavailable — the governed web_fetch executor produced no outcome'
      throw new Error(text)
    },
    output: FETCH_ROW_PRESENTATION_FACE,
  })
}
