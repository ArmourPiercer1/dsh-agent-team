/**
 * bl18-marker-mock.mjs — the MARKER-ROUTED mock script for a BL-18 live turn,
 * and the host-free proof that its routing cannot land a script on the wrong
 * session.
 *
 * WHY MARKERS AND NOT ORDER. The BL-17 boot-4 lane made ZERO model requests
 * (A2C-2 refused `team.create`), so its mock script table had never been
 * exercised. A discovery-first driver adds the anchor root's FIRST model
 * request (the surface-discovery turn) BEFORE the leader's create turn, and
 * every later script index shifts by one. An ordinal script — "the first reply
 * is the create tool call" — then answers the discovery turn with the create
 * call, and the item-1 script is consumed by a session that never calls the
 * tool. The boot would report `NOT_REACHED` on every case with a healthy Host.
 *
 * THE RULE THIS FILE ENCODES
 *   1. Every scripted reply is keyed on a marker the CONTENT of the turn
 *      carries (a nonce the driver put in the persona / delegate prompt), never
 *      on a call index.
 *   2. An UNMARKED request (title generation, a summariser, a retry, the
 *      discovery turn) gets a HARMLESS no-tool reply — it can never trigger a
 *      tool call, so it cannot consume another lane's script.
 *   3. The discovery turn's own marker is answered with a no-tool reply even
 *      though it is the first request of the run.
 *   4. Each marker is answered ONCE (a repeated marker gets the exhausted
 *      reply), so a retried request cannot fire the probe twice and a missing
 *      `report-progress` is visible rather than silently duplicated.
 *
 * WHAT IS *NOT* PROVEN HERE. This file proves the ROUTING TABLE, host-free
 * (`mock-routing.mjs` feeds it synthetic request bodies and asserts the
 * decision per turn). It does NOT prove what a booted Host sends: a boot would
 * have to show (a) the discovery request carrying `MK_DISC` exactly once before
 * `team.create`, (b) the created leader's first request carrying `MK_CREATE`,
 * (c) the Member's delegate prompt carrying `MK_ITEM_*`, and (d) `final
 * mock-requests.json` containing exactly those markers in that order. Those
 * four facts are a boot's to produce, not this file's.
 *
 * Wire shape: the same `decide(req) -> reply` callback contract the shipped
 * `packages/tools/harness/mock-deepseek.mjs` server consumes. `reply` is
 * `{ kind: 'text', text }` or `{ kind: 'tool-call', toolCalls: [{ name,
 * arguments }] }` — the ONLY legal tool dialect (an unknown kind closes the
 * stream before `message_stop`).
 *
 * @module dev/agent-workflow/evidence/a5sf-bl18-live/bl18-marker-mock
 */

/** The markers the driver must place in its prompts/personas. */
export const BL18_MARKERS = Object.freeze({
  /** Anchor root's discovery turn (persona of the anchor blueprint). */
  discovery: 'MK_BL18_DISC',
  /** The leader's create turn (delegate prompt / first user message). */
  create: 'MK_BL18_CREATE',
  /** Item 1: the deny-lane fetch on the governed Member. */
  fetch: 'MK_BL18_FETCH',
  /** Item 2: the deny-lane search on the same Member. */
  search: 'MK_BL18_SEARCH',
  /** The collect/fence turn. */
  collect: 'MK_BL18_COLLECT',
})

/** Harmless replies: no tool call, so they can never advance another lane. */
const HARMLESS = Object.freeze({
  discovery: 'Surface discovery acknowledged. No tool call. Continue to team.create.',
  title: 'BL-18 live run',
  fallback: 'Acknowledged. No tool call.',
  exhausted: 'That marker was already answered once; no further tool call.',
})

function messagesOf(request) {
  const body = request?.body ?? request ?? {}
  return Array.isArray(body.messages) ? body.messages : []
}

function textOf(message) {
  if (typeof message?.content === 'string') return message.content
  if (Array.isArray(message?.content)) {
    return message.content.map((part) => (typeof part?.text === 'string' ? part.text : '')).join('\n')
  }
  return ''
}

/** The whole turn text: every message, in order. */
export function turnTextOf(request) {
  return messagesOf(request).map(textOf).join('\n')
}

/** The last user message's text (the turn's own instruction). */
export function lastUserTextOf(request) {
  const messages = messagesOf(request)
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i]?.role === 'user') return textOf(messages[i])
  }
  return ''
}

/**
 * Classify one request into a routing key. PURE — the whole point of the
 * host-free demo is that this function never depends on arrival order.
 *
 * @param {unknown} request - the mock's recorded request (`{ body: { messages } }`) or a bare body.
 * @returns {'title'|'discovery'|'create'|'fetch'|'search'|'collect'|'fallback'}
 */
export function routeKindOf(request) {
  const text = turnTextOf(request)
  // Title generation is a host-internal turn; it must never consume a script.
  if (/Generate the session title/i.test(text)) return 'title'
  if (text.includes(BL18_MARKERS.discovery)) return 'discovery'
  if (text.includes(BL18_MARKERS.fetch)) return 'fetch'
  if (text.includes(BL18_MARKERS.search)) return 'search'
  if (text.includes(BL18_MARKERS.create)) return 'create'
  if (text.includes(BL18_MARKERS.collect)) return 'collect'
  return 'fallback'
}

/** The URL the fetch/search items declare (one fixture, one locator). */
export const DECLARED_URL = 'https://example.test/legal/page'
export const DECLARED_SEARCH = Object.freeze({ queries: ['a5sf bl18 deny lane'] })

/**
 * Build the `decide` callback the shipped mock server consumes.
 *
 * @param {{ served?: Map<string, number> }} [state] - optional shared counter (tests reuse it).
 * @returns {(request: unknown) => object} one reply per request.
 */
export function makeBl18Decide(state = {}) {
  const served = state.served ?? new Map()
  return function decide(request) {
    const kind = routeKindOf(request)
    const count = (served.get(kind) ?? 0) + 1
    served.set(kind, count)
    if (kind === 'title') return { kind: 'text', text: HARMLESS.title }
    if (kind === 'discovery') return { kind: 'text', text: HARMLESS.discovery }
    if (kind === 'fallback') return { kind: 'text', text: HARMLESS.fallback }
    if (count > 1) return { kind: 'text', text: HARMLESS.exhausted }
    if (kind === 'create') {
      return { kind: 'tool-call', toolCalls: [{ name: 'team_create', arguments: { blueprintId: 'team.a5sf.bl18' } }] }
    }
    if (kind === 'fetch') {
      return { kind: 'tool-call', toolCalls: [{ name: 'web_fetch', arguments: { url: DECLARED_URL } }] }
    }
    if (kind === 'search') {
      return { kind: 'tool-call', toolCalls: [{ name: 'web_search', arguments: { queries: [...DECLARED_SEARCH.queries] } }] }
    }
    return { kind: 'tool-call', toolCalls: [{ name: 'team_collect', arguments: {} }] }
  }
}

export const ROUTING_TABLE = Object.freeze({
  title: 'harmless text',
  discovery: 'harmless text',
  create: 'team_create tool call (once)',
  fetch: 'web_fetch tool call (once)',
  search: 'web_search tool call (once)',
  collect: 'team_collect tool call (once)',
  fallback: 'harmless text',
})
