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

/**
 * Flatten a message/tool-result `content` to TEXT, decoding each part EXACTLY
 * once.
 *
 * THE BUG THIS CLOSES (independent review of PR #62, 2026-10-03): on
 * 0.2.0-rc.2 a tool result's `content` is an ARRAY of parts —
 * `[{ "type": "text", "text": "{\"targetInstanceId\":\"inst-…\"}" }]` — and the
 * naive `JSON.stringify(content)` produced by the first version escaped the
 * inner JSON's quotes (`\"targetInstanceId\"`), so every field regex downstream
 * missed, and a fallback that then matched a bare `inst-…` returned an
 * unmatched capture group (`undefined`) instead of failing. A text part's
 * `text` is therefore unwrapped VERBATIM here — never re-encoded — which is
 * what makes one extractor behave identically on both generations:
 *   - 0.1.x: `content` is the JSON string itself;
 *   - 0.2:   `content` is parts whose text IS that same JSON string.
 */
export function flattenContent(content, depth = 0) {
  if (content === null || content === undefined) return ''
  if (typeof content === 'string') return content
  if (depth > 6) return JSON.stringify(content)
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (part === null || part === undefined) return ''
        if (typeof part === 'string') return part
        if (typeof part.text === 'string') return part.text
        if (typeof part.json === 'string') return part.json
        // A CONTAINER part (0.2 `tool_result`: its payload is itself parts,
        // nested one level deeper) — descend instead of serializing the shell,
        // or every field inside the payload comes back quote-escaped.
        if (part.content !== undefined) return flattenContent(part.content, depth + 1)
        return JSON.stringify(part)
      })
      .filter((s) => s !== '')
      .join('\n')
  }
  if (typeof content === 'object') {
    // A structured payload with no array wrapper (some adapters hand the tool's
    // JSON object straight through): serialize once.
    if (typeof content.text === 'string') return content.text
    if (content.content !== undefined) return flattenContent(content.content, depth + 1)
    return JSON.stringify(content)
  }
  return String(content)
}

/** Textual payload of one tool result, whatever the generation's encoding. */
export function toolResultText(result) {
  if (result === null || result === undefined) return ''
  const content = typeof result === 'object' && 'content' in result ? result.content : result
  return flattenContent(content)
}

/** `is_error` in both spellings, classic message or content part. */
export function isErrorResult(result) {
  if (result === null || typeof result !== 'object') return false
  return result.is_error === true || result.isError === true
}

/**
 * The tool results of one request, decoded and paired with their metadata:
 * `[{ toolUseId, text, isError, item }]`. This is what a scripted chain should
 * read — `items` alone leaves every caller to re-implement the flattening,
 * which is exactly where the escaping bug lived.
 */
export function toolResultEntries(body, context = {}) {
  const c = assertWireShape(body, context)
  return c.toolResults.map((r) => ({
    toolUseId: r.toolUseId,
    text: toolResultText(r.item),
    isError: isErrorResult(r.item),
    item: r.item,
  }))
}

const INSTANCE_ID_PATTERNS = [
  /"targetInstanceId"\s*:\s*"([^"]+)"/,
  /"instanceId"\s*:\s*"([^"]+)"/,
  /\b(inst-[A-Za-z0-9][A-Za-z0-9_-]{3,64})\b/,
]

/**
 * The instance id of a `team_create_member` / `team_delegate` result — STRICT,
 * and it throws rather than returning null/undefined/empty.
 *
 * Returning a sentinel was the defect: the caller's `id === null` test let
 * `undefined` (an unmatched fallback capture group) travel into
 * `team_delegate`'s `targetInstanceId`, so the failure surfaced later as a
 * missing-argument rejection instead of at the decode site. An error result, an
 * empty result, and a result with no id are all loud failures here, and the
 * caller cannot construct a delegation with them.
 */
export function extractInstanceId(source, context = {}) {
  const isResultObject = source !== null && typeof source === 'object' && !Array.isArray(source)
  if (isErrorResult(source)) {
    throw new WireShapeError(
      `tool result is an error result (${context.label ?? 'instance id'}); refusing to derive an instance id from it`,
      { ...context, text: toolResultText(source).slice(0, 400) },
    )
  }
  const text = isResultObject && 'content' in source ? toolResultText(source) : flattenContent(source)
  if (typeof text !== 'string' || text.trim() === '') {
    throw new WireShapeError(
      `empty tool result (${context.label ?? 'instance id'}); refusing to derive an instance id`,
      { ...context, sourceType: typeof source, isArray: Array.isArray(source) },
    )
  }
  // Structured first: the tool's payload is JSON, and a parsed field is the
  // strongest evidence (no quoting/escaping games).
  const trimmed = text.trim()
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed)
      const candidates = Array.isArray(parsed) ? parsed : [parsed]
      for (const entry of candidates) {
        if (entry === null || typeof entry !== 'object') continue
        for (const field of ['targetInstanceId', 'instanceId']) {
          const value = entry[field]
          if (typeof value === 'string' && value.trim() !== '') return value.trim()
        }
        const inner = entry.result ?? entry.data
        if (inner !== null && typeof inner === 'object') {
          for (const field of ['targetInstanceId', 'instanceId']) {
            const value = inner[field]
            if (typeof value === 'string' && value.trim() !== '') return value.trim()
          }
        }
      }
    } catch {
      /* not pure JSON (a prose envelope around it): fall through to patterns */
    }
  }
  for (const re of INSTANCE_ID_PATTERNS) {
    const m = re.exec(text)
    const value = m === null ? null : (m[1] ?? m[0])
    if (typeof value === 'string' && value.trim() !== '') return value.trim()
  }
  throw new WireShapeError(
    `tool result carries no usable instance id (${context.label ?? 'instance id'}); refusing to delegate with a missing targetInstanceId`,
    { ...context, textHead: text.slice(0, 400) },
  )
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
    // `flattenContent`, not JSON.stringify: a text part contributes ITS TEXT
    // (verbatim), non-text parts contribute one serialized line each. Markers
    // are found either way, but the evidence stays readable and a JSON-escaped
    // payload can never make a field pattern miss.
    .map((m) => flattenContent(m.content))
    .join('\n')
}

/** The INSTRUCTION surface: 0.2 top-level `system`, 0.1.x system messages. */
export function systemText(body) {
  const top = body?.system
  const topText = flattenContent(top)
  const messageText = ((body?.messages) ?? [])
    .filter((m) => m?.role === 'system')
    .map((m) => flattenContent(m.content))
    .join('\n')
  return `${topText}\n${messageText}`
}

/**
 * Purpose attribution.
 *
 * Toollessness is NOT a valid auxiliary test on 0.2.0-rc.2: the compaction
 * summarizer (`packages/compaction/compaction-basic/src/summarizer.ts:145-161`)
 * replays the conversation's own system prompt, leading messages AND `tools`
 * and appends one user message carrying `COMPACTION_INSTRUCTION`, so a
 * compaction dispatch is structurally indistinguishable from an agent turn
 * except for that instruction (the internal `purpose: 'compaction'` option is
 * not put on the wire). Since a compaction request replays the conversation,
 * it satisfies ordinary marker/count predicates — a kit that does not exclude
 * it can advance a chain step on the wrong request.
 *
 * The purposes are therefore a CLOSED marker list, most specific first, and a
 * request that matches none is an error rather than something to answer
 * neutrally: an unrecognized purpose must surface while the evidence is hot.
 */
export const PURPOSE_AGENT = 'agent'
export const PURPOSE_TITLE = 'title'
export const PURPOSE_COMPACTION = 'compaction'
export const PURPOSE_UNKNOWN = 'unknown'

const COMPACTION_MARKERS = [
  'You are now acting as a compaction engine',
  'automatically generated checkpoint condensing',
  '<compacted-summary>',
]

/**
 * Classify WHY the host issued this request.
 * `compaction` wins over everything (it also carries tools and the whole
 * conversation); `title` requires the absence of a tool surface; `agent`
 * requires one; anything else is `unknown`.
 */
export function classifyPurpose(body) {
  const c = classifyRequest(body)
  const haystack = `${systemText(body)}\n${userText(body)}`
  const markers = []
  for (const marker of COMPACTION_MARKERS) {
    if (haystack.includes(marker)) markers.push(marker)
  }
  if (markers.length > 0) return { purpose: PURPOSE_COMPACTION, markers, agentTurn: c.agentTurn }
  const titleMarkers = TITLE_MARKERS.filter((marker) => haystack.includes(marker))
  if (titleMarkers.length > 0 && !c.agentTurn) return { purpose: PURPOSE_TITLE, markers: titleMarkers, agentTurn: false }
  if (c.agentTurn) return { purpose: PURPOSE_AGENT, markers: [], agentTurn: true }
  return { purpose: PURPOSE_UNKNOWN, markers: [], agentTurn: false }
}

/** The strict purpose gate: an unattributable request is a diagnostic. */
export function assertPurpose(body, context = {}) {
  const p = classifyPurpose(body)
  if (p.purpose !== PURPOSE_UNKNOWN) return p
  throw new WireShapeError(
    `toolless model request with no known purpose marker (${context.label ?? 'request'}) — the auxiliary-purpose list is closed on purpose; classify it from the host source and extend it deliberately, do not answer it neutrally`,
    { ...context, shape: classifyRequest(body).shape, bodyKeys: Object.keys(body ?? {}), messageShapes: messageShapes(body) },
  )
}

/**
 * Should this request be considered by the scripted AGENT chain? A compaction
 * or title dispatch replays/derives from the same conversation and would
 * otherwise satisfy a chain predicate (marker present, tool-result count
 * matching a historical step) with the wrong request.
 */
export function isChainTurn(body) {
  return classifyPurpose(body).purpose === PURPOSE_AGENT
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
  return classifyPurpose(body).purpose === PURPOSE_TITLE
}

/** Deterministic signature of a scripted reply (ignores random call ids). */
export function replySig(reply) {
  if (reply === null || typeof reply !== 'object') return String(reply)
  if (reply.kind === 'tool-call') {
    return `tool:${(reply.toolCalls ?? []).map((t) => `${t.name}(${JSON.stringify(t.arguments ?? {})})`).join(',')}`
  }
  return `text:${String(reply.content ?? '').slice(0, 200)}`
}
