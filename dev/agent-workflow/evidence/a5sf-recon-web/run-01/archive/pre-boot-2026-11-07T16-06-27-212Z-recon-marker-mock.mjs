/**
 * recon-marker-mock.mjs — the MARKER-ROUTED mock script for the D-face (Web)
 * recon, plus the pure routing function its host-free check exercises.
 *
 * WHY MARKERS. A live Host sends title-generation requests, the Leader's
 * post-delegate request (whose history contains the delegation prompt) and the
 * Member's own follow-up turns. An ordinal script would hand the fetch script to
 * whichever request arrived first. Every reply here is keyed on a marker the
 * driver places in a prompt/persona, and:
 *   - a title/compaction request is answered harmlessly (never consumes a lane);
 *   - a request whose LAST user message names a marker is routed by that marker
 *     (this is what stops the Leader's post-delegate request from consuming the
 *     Member's lane);
 *   - a request whose last user message carries no text (a tool-result turn)
 *     falls back to the whole-turn marker, because that is the Member's own
 *     continuation;
 *   - each lane's script is a FIXED SEQUENCE: turn 1 = `web_fetch`, turn 2 =
 *     `web_search`, turn 3+ = a final text line. The sequence is what makes the
 *     two tools observable inside ONE governed Member turn.
 *
 * Wire shape: the same `decide(req) -> reply` callback contract the shipped
 * `packages/tools/harness/mock-deepseek.mjs` server consumes. `reply` is
 * `{ kind: 'text', text }` or `{ kind: 'tool-call', toolCalls: [{ name,
 * arguments }] }` — the only legal tool dialect.
 *
 * @module dev/agent-workflow/evidence/a5sf-recon-web/recon-marker-mock
 */

/** The markers the driver must place in its prompts/personas. */
export const RECON_MARKERS = Object.freeze({
  discovery: 'MK_RECON_WEB_DISC',
  create: 'MK_RECON_WEB_CREATE',
  allow: 'MK_RECON_WEB_ALLOW',
  deny: 'MK_RECON_WEB_DENY',
})

const HARMLESS = Object.freeze({
  discovery: 'Surface discovery acknowledged. No tool call.',
  title: 'A5SF recon web run',
  fallback: 'Acknowledged. No tool call.',
  exhausted: 'The recon web lane already ran its two tool calls; no further call.',
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

export function turnTextOf(request) {
  return messagesOf(request).map(textOf).join('\n')
}

export function lastUserTextOf(request) {
  const messages = messagesOf(request)
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i]?.role === 'user') return textOf(messages[i])
  }
  return ''
}

/**
 * Classify one request into a routing key. PURE: no order, no clock.
 *
 * @param {unknown} request the mock's recorded request (`{ body: { messages } }`) or a bare body
 * @returns {'title'|'discovery'|'create'|'allow'|'deny'|'fallback'}
 */
export function routeKindOf(request) {
  const whole = turnTextOf(request)
  if (/Generate the session title/i.test(whole)) return 'title'
  const lastUser = lastUserTextOf(request)
  if (lastUser.includes(RECON_MARKERS.allow)) return 'allow'
  if (lastUser.includes(RECON_MARKERS.deny)) return 'deny'
  if (lastUser.includes(RECON_MARKERS.create)) return 'create'
  if (lastUser.includes(RECON_MARKERS.discovery)) return 'discovery'
  if (whole.includes(RECON_MARKERS.allow)) return 'allow'
  if (whole.includes(RECON_MARKERS.deny)) return 'deny'
  if (whole.includes(RECON_MARKERS.create)) return 'create'
  if (whole.includes(RECON_MARKERS.discovery)) return 'discovery'
  return 'fallback'
}

/**
 * Build the `decide` callback the shipped mock server consumes.
 *
 * @param {{ endpoint: string, routingLog?: object[], onDecision?: (d: object) => void }} options
 * @returns {(request: unknown) => object} one reply per request
 */
export function makeReconDecide({ endpoint, routingLog = [], onDecision }) {
  const served = new Map()
  return function decide(request) {
    const kind = routeKindOf(request)
    const count = (served.get(kind) ?? 0) + 1
    served.set(kind, count)
    let reply
    let disposition = 'harmless-text'
    if (kind === 'title') {
      reply = { kind: 'text', text: HARMLESS.title }
    } else if (kind === 'discovery') {
      reply = { kind: 'text', text: HARMLESS.discovery }
    } else if (kind === 'fallback') {
      reply = { kind: 'text', text: HARMLESS.fallback }
    } else if (kind === 'create') {
      reply = { kind: 'text', text: 'Team created. Delegate the recon probes.' }
    } else if (count === 1) {
      reply = { kind: 'tool-call', toolCalls: [{ name: 'web_fetch', arguments: { url: `${endpoint}/page` } }] }
      disposition = 'tool-call-fetch'
    } else if (count === 2) {
      // Two queries on the deny lane and one on the allow lane: the shared
      // preflight's locator-uniqueness rule needs the two lanes to declare
      // different query counts, and the second query is a real provider call.
      const queries = kind === 'deny'
        ? ['a5sf recon web deny a', 'a5sf recon web deny b']
        : [`a5sf recon web ${kind}`]
      reply = { kind: 'tool-call', toolCalls: [{ name: 'web_search', arguments: { queries } }] }
      disposition = 'tool-call-search'
    } else {
      reply = { kind: 'text', text: `RECON_WEB_MEMBER_DONE lane=${kind}` }
      disposition = 'final-text'
    }
    const decision = {
      seq: routingLog.length + 1,
      at: new Date().toISOString(),
      kind,
      servedCount: count,
      disposition,
      replyKind: reply.kind,
      toolName: reply.kind === 'tool-call' ? reply.toolCalls[0].name : null,
    }
    routingLog.push(decision)
    if (typeof onDecision === 'function') onDecision(decision)
    return reply
  }
}
