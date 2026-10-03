/**
 * wire-shape.mjs — model-request decoder for the rc2 real-host smoke kit.
 *
 * WHY THIS MODULE EXISTS
 *
 * The kit scripts a Leader turn by reading the requests the host sends to the
 * mock model endpoint: which user text is present, how many tool RESULTS have
 * come back, whose persona is in the instruction surface. Those reads encode
 * an assumption about the host's wire format, and the assumption is not stable
 * across host generations:
 *
 *  - 0.1.x wire: instruction carried as `role:'system'` MESSAGES, tool results
 *    as dedicated `role:'tool'` messages;
 *    bodyKeys `["model","messages","stream","stream_options","thinking",
 *    "max_tokens","dsh_plugin_packages"]`.
 *  - 0.2.0-rc.2 wire (`639ed01539`): content-PARTS wire — the instruction is
 *    the top-level `system` string, the assistant's call is a `tool_use` part,
 *    the executed result is a `tool_result` part
 *    (`{type,tool_use_id,content,is_error}`) inside an ordinary `user`
 *    message, and an auxiliary dispatch (session-title generation) is a
 *    toolless request interleaved with the agent turns;
 *    bodyKeys `["model","stream","messages","max_tokens","thinking",
 *    "output_config","system","tools","dsh_session_log","dsh_plugin_packages"]`.
 *
 * Reading the 0.2 wire with the 0.1.x assumption is not a harmless miss: the
 * chain never advances, the scripted branch repeats forever and the run burns
 * thousands of model calls (observed: ~1 800 in one wait). So every read here
 * CLASSIFIES the request first, and an encoding this module does not know
 * RAISES `WireShapeError` with the observed shape instead of quietly returning
 * an empty list. A kit must fail diagnostically on an unknown wire shape — a
 * fallback that keeps going is what turns a shape change into a resource storm.
 *
 * The decoders are pure functions of the request body so they can be verified
 * against recorded envelopes without a host: see
 * `packages/testkit/test/rc2-kit-wire-shape.test.ts` and the desensitized
 * fixtures under `fixtures/`.
 */

export const WIRE_CLASSIC = 'classic'
export const WIRE_PARTS = 'parts'
export const WIRE_NONE = 'none'
export const WIRE_MIXED = 'mixed'
export const WIRE_UNKNOWN = 'unknown'

/** Roles the two known generations use for model-request messages. */
const KNOWN_ROLES = new Set(['system', 'user', 'assistant', 'tool'])
/** Content-part types the two known generations use. Closed on purpose: a
 * new part type must surface as a diagnostic, not be ignored. */
const KNOWN_PART_TYPES = new Set([
  'text',
  'image',
  'audio',
  'document',
  'thinking',
  'redacted_thinking',
  'reasoning',
  'refusal',
  'tool_use',
  'tool-call',
  'tool_result',
  'tool-result',
])
const TOOL_RESULT_TYPES = new Set(['tool_result', 'tool-result'])
const TOOL_USE_TYPES = new Set(['tool_use', 'tool-call'])

/** Auxiliary (non-agent) dispatch markers, both known phrasings. */
const TITLE_MARKERS = ['Create a concise title', 'Generate the session title']

export class WireShapeError extends Error {
  constructor(message, info) {
    super(message)
    this.name = 'WireShapeError'
    this.info = info
  }
}

/**
 * Accept either a mock RECORD (`{seq, body, …}`) or a bare parsed body: the
 * kit's waits pass records, `decide` receives the body itself.
 */
export function bodyOf(recordOrBody) {
  if (recordOrBody === null || typeof recordOrBody !== 'object') return null
  return 'body' in recordOrBody ? (recordOrBody.body ?? null) : recordOrBody
}

/** One human-readable token per message: `role:kind+kind` (or `role:string`). */
export function messageShapes(body) {
  return ((body?.messages) ?? []).map((m) => {
    const content = m?.content
    const kind = typeof content === 'string'
      ? 'string'
      : Array.isArray(content)
        ? content.map((p) => (p !== null && typeof p === 'object' ? String(p.type ?? '?') : typeof p)).join('+')
        : typeof content
    return `${String(m?.role ?? '?')}:${kind}`
  })
}

/**
 * Classify one model request. Never throws: the caller decides whether an
 * unknown shape is fatal (it is — see `assertWireShape`).
 *
 * Returns:
 *   shape        WIRE_CLASSIC | WIRE_PARTS | WIRE_NONE | WIRE_MIXED | WIRE_UNKNOWN
 *   agentTurn    true when the request carries a tool surface (an auxiliary
 *                dispatch has none — that structural difference is what keeps
 *                the interleaved title call out of the scripted chain)
 *   toolResults  [{ toolUseId, item, via }] in conversation order
 *   toolUses     [{ id, name, item }] — calls the model already made
 *   unknownRoles / unknownPartTypes  diagnostics for unrecognized encodings
 *   notes        human-readable classification notes
 */
export function classifyRequest(body) {
  const out = {
    shape: WIRE_UNKNOWN,
    agentTurn: false,
    toolResults: [],
    toolUses: [],
    unknownRoles: [],
    unknownPartTypes: [],
    notes: [],
  }
  if (body === null || typeof body !== 'object' || !Array.isArray(body.messages)) {
    out.notes.push('no-messages-array')
    return out
  }
  out.agentTurn = Array.isArray(body.tools) && body.tools.length > 0
  for (const m of body.messages) {
    const role = m?.role
    if (typeof role !== 'string' || !KNOWN_ROLES.has(role)) {
      out.unknownRoles.push(String(role))
      continue
    }
    const content = m?.content
    // OpenAI-style assistant tool calls (`message.tool_calls` with a null
    // content) are a recognized encoding of the same thing the parts wire
    // carries as a `tool_use` part.
    if (Array.isArray(m?.tool_calls)) {
      for (const call of m.tool_calls) {
        out.toolUses.push({ id: call?.id ?? null, name: call?.function?.name ?? call?.name ?? null, item: call })
      }
    }
    if (typeof content === 'string') {
      if (role === 'tool') out.toolResults.push({ toolUseId: m.tool_call_id ?? m.toolCallId ?? m.id ?? null, item: m, via: WIRE_CLASSIC })
      continue
    }
    if (content === null || content === undefined) continue
    if (!Array.isArray(content)) {
      out.notes.push(`content-${typeof content}-on-${role}`)
      continue
    }
    let sawToolResultPart = false
    for (const p of content) {
      if (p === null || typeof p !== 'object') {
        out.unknownPartTypes.push(`${role}:${typeof p}`)
        continue
      }
      const type = String(p.type ?? '')
      if (!KNOWN_PART_TYPES.has(type)) {
        out.unknownPartTypes.push(`${role}:${type || '(no-type)'}`)
        continue
      }
      if (TOOL_RESULT_TYPES.has(type)) {
        sawToolResultPart = true
        out.toolResults.push({ toolUseId: p.tool_use_id ?? p.toolUseId ?? p.tool_call_id ?? null, item: p, via: WIRE_PARTS })
      } else if (TOOL_USE_TYPES.has(type)) {
        out.toolUses.push({ id: p.id ?? null, name: p.name ?? null, item: p })
      }
    }
    // A `role:'tool'` message is ONE result whatever its content encoding —
    // record it once, not once per part.
    if (role === 'tool' && !sawToolResultPart) {
      out.toolResults.push({ toolUseId: m.tool_call_id ?? m.toolCallId ?? m.id ?? null, item: m, via: WIRE_CLASSIC })
    }
  }
  const classicCount = out.toolResults.filter((r) => r.via === WIRE_CLASSIC).length
  const partsCount = out.toolResults.length - classicCount
  out.shape = classicCount > 0 && partsCount > 0
    ? WIRE_MIXED
    : classicCount > 0
      ? WIRE_CLASSIC
      : partsCount > 0
        ? WIRE_PARTS
        : WIRE_NONE
  if (out.unknownRoles.length > 0 || out.unknownPartTypes.length > 0 || out.notes.some((n) => n.startsWith('content-'))) {
    out.shape = WIRE_UNKNOWN
  }
  return out
}

/**
 * The strict gate. Throws `WireShapeError` when the request cannot be read
 * with the two documented shapes, or — when `expectToolResult` is true (the
 * caller knows the model already issued calls, e.g. this request echoes a
 * `tool_use` back) — when no tool result can be found in any recognized
 * encoding. Callers must surface this, never swallow it.
 */
export function assertWireShape(body, context = {}) {
  const c = classifyRequest(body)
  const info = {
    ...context,
    shape: c.shape,
    agentTurn: c.agentTurn,
    bodyKeys: Object.keys(body ?? {}),
    messageShapes: messageShapes(body),
    unknownRoles: c.unknownRoles,
    unknownPartTypes: c.unknownPartTypes,
    notes: c.notes,
    toolResults: c.toolResults.length,
    toolUses: c.toolUses.length,
  }
  if (c.shape === WIRE_UNKNOWN) {
    throw new WireShapeError(
      `unrecognized model-request wire shape (${context.label ?? 'request'}): unknownRoles=[${c.unknownRoles.join(',')}] unknownPartTypes=[${c.unknownPartTypes.join(',')}] notes=[${c.notes.join(',')}] shapes=[${info.messageShapes.join(' | ')}]`,
      info,
    )
  }
  if (c.shape === WIRE_MIXED) {
    throw new WireShapeError(
      `model-request mixes 0.1.x role:'tool' messages and 0.2 content-part tool_results (${context.label ?? 'request'}) — counting either would shift the scripted chain; shapes=[${info.messageShapes.join(' | ')}]`,
      info,
    )
  }
  if (context.expectToolResult === true && c.toolResults.length === 0) {
    throw new WireShapeError(
      `model-request carries ${c.toolUses.length} assistant tool_use part(s) but no tool result in any recognized encoding (${context.label ?? 'request'}); shape=${c.shape} shapes=[${info.messageShapes.join(' | ')}] bodyKeys=[${info.bodyKeys.join(',')}]`,
      info,
    )
  }
  return c
}

/** Strict tool-result read: throws on an unreadable shape (see above). */
export function toolResultsOf(body, context = {}) {
  const c = assertWireShape(body, context)
  return { shape: c.shape, items: c.toolResults.map((r) => r.item), count: c.toolResults.length }
}

/** Textual payload of one tool result, whatever the generation's encoding. */
export function toolResultText(result) {
  if (result === null || result === undefined) return ''
  const content = typeof result === 'object' && 'content' in result ? result.content : result
  return typeof content === 'string' ? content : JSON.stringify(content ?? '')
}

/**
 * The CONVERSATION text surface (user turns, assistant turns, tool results):
 * used for marker matching. Strings and content parts both contribute; the
 * instruction surface is separate (`systemText`) so a persona can never be
 * confused with conversation content.
 */
export function userText(body) {
  return ((body?.messages) ?? [])
    .filter((m) => m?.role !== 'system')
    .map((m) => (typeof m.content === 'string' ? m.content : JSON.stringify(m.content ?? '')))
    .join('\n')
}

/** The INSTRUCTION surface: 0.2 top-level `system`, 0.1.x system messages. */
export function systemText(body) {
  const top = body?.system
  const topText = typeof top === 'string' ? top : JSON.stringify(top ?? '')
  const messageText = ((body?.messages) ?? [])
    .filter((m) => m?.role === 'system')
    .map((m) => (typeof m.content === 'string' ? m.content : JSON.stringify(m.content ?? '')))
    .join('\n')
  return `${topText}\n${messageText}`
}

/**
 * Is this the host's auxiliary session-title dispatch rather than an agent
 * turn? Structural first (no tool surface — every agent turn has one), marker
 * second (both known phrasings, in either instruction encoding). Answering it
 * neutrally is what keeps a marker-carrying title payload from driving the
 * scripted chain; a toolless AGENT turn cannot hide here, because a real agent
 * turn carries tools and would then fail its own chain step loudly.
 */
export function isTitleDispatch(body) {
  if (body === null || typeof body !== 'object') return false
  const hasToolSurface = Array.isArray(body.tools) && body.tools.length > 0
  if (hasToolSurface) return false
  const haystack = `${systemText(body)}\n${userText(body)}`
  return TITLE_MARKERS.some((marker) => haystack.includes(marker))
}

/** Deterministic signature of a scripted reply (ignores random call ids). */
export function replySig(reply) {
  if (reply === null || typeof reply !== 'object') return String(reply)
  if (reply.kind === 'tool-call') {
    return `tool:${(reply.toolCalls ?? []).map((t) => `${t.name}(${JSON.stringify(t.arguments ?? {})})`).join(',')}`
  }
  return `text:${String(reply.content ?? '').slice(0, 200)}`
}
