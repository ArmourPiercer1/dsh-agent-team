/**
 * tests/world-factory/lib/model-transcript.mjs — ONE normalised view of what the
 * model emitted and what was returned to it, in BOTH model modes.
 *
 * WHY IT EXISTS. The acceptance driver used to locate its evidence by the
 * scripted mock's fixed call ids (`call-d4-worker-write`, …). Those ids exist
 * only because the mock writes them; a real model emits ids of its own. This
 * module turns the two observation sources (the mock's request log and the
 * provider-boundary recorder of `./model-call-recorder.mjs`) into the SAME
 * `{turns, toolUses, toolResults}` shape, so every judge can locate its evidence
 * by a PREDICATE over the observed transcript — tool name, argument shape, and
 * ordering relative to the previous step — and fail loudly (a named
 * `DISCOVERY-MISS`) when the predicate matches nothing.
 *
 * WHAT A TURN IS. One model call: the assistant text/tool_use blocks the
 * provider returned, plus the tool results that the NEXT request carried back
 * to the model. `turns()` is ordered by call sequence, so `nth`/`after`
 * predicates express causality ("the second `team_resolve_control` for this
 * requestId", "a `write` after the delegation result").
 *
 * SCRIPTED MODE IS NOT CHANGED BY THIS MODULE. It is an additional index over
 * the same mock requests; the driver's scripted gates keep their marker test.
 *
 * @module tests/world-factory/lib/model-transcript
 */

const truncate = (value, limit = 4000) => {
  const text = String(value ?? '')
  return text.length > limit ? `${text.slice(0, limit)}<TRUNCATED ${text.length - limit} chars>` : text
}

function contentText(content) {
  if (typeof content === 'string') return content
  if (Array.isArray(content)) return content.map((block) => (typeof block === 'string' ? block : String(block?.text ?? ''))).join('')
  if (content === null || content === undefined) return ''
  return JSON.stringify(content)
}

function safeJson(value) {
  if (typeof value !== 'string') return null
  try { return JSON.parse(value) } catch { return null }
}

/** OpenAI-shaped tool results (`role: 'tool'`) AND Anthropic blocks, in one list. */
function toolResultsOfMessages(messages) {
  const out = []
  for (const message of Array.isArray(messages) ? messages : []) {
    const content = message?.content
    for (const block of Array.isArray(content) ? content : []) {
      if (block?.type !== 'tool_result') continue
      out.push({
        toolUseId: block?.tool_use_id ?? null,
        isError: block?.is_error === true,
        text: contentText(block?.content),
      })
    }
    if (String(message?.role ?? '') === 'tool' && message?.tool_call_id !== undefined) {
      out.push({ toolUseId: message.tool_call_id, isError: false, text: contentText(content) })
    }
  }
  return out
}

/**
 * The error EVERY missed discovery raises. The slot and the human-readable
 * predicate travel with it, so a judge's failure names the evidence it looked
 * for instead of reporting "no verdict".
 */
export class DiscoveryMissError extends Error {
  constructor(slot, predicateText, observedTurns) {
    super(`DISCOVERY-MISS(${slot}): ${predicateText} matched no observed tool_use block in ${String(observedTurns)} observed turn(s)`)
    this.name = 'DiscoveryMissError'
    this.code = 'DISCOVERY-MISS'
    this.slot = slot
    this.predicateText = predicateText
    this.observedTurns = observedTurns
  }
}

/**
 * A predicate over one observed tool_use block.
 *
 * @param {object} spec
 * @param {string} [spec.name] exact tool name
 * @param {string} [spec.argPath] dotted path inside the call input (e.g. `file_path`)
 * @param {unknown} [spec.argValue] exact value at `argPath`
 * @param {string} [spec.argIncludes] substring the value at `argPath` must carry
 * @param {string} [spec.anyArgIncludes] substring the JSON of the whole input must carry
 * @param {number} [spec.nth] which match (0-based) once the predicate has filtered, in call order
 * @param {number} [spec.afterTurn] only blocks whose turn index is > this
 * @param {number} [spec.beforeTurn] only blocks whose turn index is < this
 * @returns {(block: {id: string|null, name: string|null, input: unknown, turnIndex: number}) => boolean}
 */
export function matchToolUse(spec = {}) {
  const readPath = (input) => {
    if (spec.argPath === undefined) return undefined
    let cursor = input
    for (const key of String(spec.argPath).split('.')) {
      if (cursor === null || typeof cursor !== 'object') return undefined
      cursor = cursor[key]
    }
    return cursor
  }
  const predicate = (block) => {
    if (spec.name !== undefined && String(block?.name ?? '') !== spec.name) return false
    if (spec.afterTurn !== undefined && !(block?.turnIndex > spec.afterTurn)) return false
    if (spec.beforeTurn !== undefined && !(block?.turnIndex < spec.beforeTurn)) return false
    if (spec.argValue !== undefined && readPath(block?.input) !== spec.argValue) return false
    if (spec.argIncludes !== undefined) {
      const value = readPath(block?.input)
      if (typeof value !== 'string' || !value.includes(spec.argIncludes)) return false
    }
    if (spec.anyArgIncludes !== undefined) {
      let json = ''
      try { json = JSON.stringify(block?.input ?? null) } catch { json = '' }
      if (!json.includes(spec.anyArgIncludes)) return false
    }
    return true
  }
  predicate.spec = spec
  predicate.describe = () => {
    const parts = []
    if (spec.name !== undefined) parts.push(`name=${spec.name}`)
    if (spec.argPath !== undefined) parts.push(`${spec.argPath}=${JSON.stringify(spec.argValue ?? null)}`)
    if (spec.argIncludes !== undefined) parts.push(`${spec.argPath ?? 'input'} contains ${JSON.stringify(spec.argIncludes)}`)
    if (spec.anyArgIncludes !== undefined) parts.push(`input contains ${JSON.stringify(spec.anyArgIncludes)}`)
    if (spec.afterTurn !== undefined) parts.push(`after turn ${String(spec.afterTurn)}`)
    if (spec.beforeTurn !== undefined) parts.push(`before turn ${String(spec.beforeTurn)}`)
    if (spec.nth !== undefined) parts.push(`occurrence #${String(spec.nth + 1)}`)
    return parts.join(' && ') || 'any tool_use'
  }
  return predicate
}

/** Normalise one SCRIPTED-mock request record (OpenAI chat shape). */
export function turnFromMockRequest(record, index) {
  const body = record?.body ?? record ?? {}
  const reply = record?.reply ?? {}
  const toolUses = []
  if (String(reply?.kind ?? '') === 'tool-call') {
    for (const call of Array.isArray(reply.toolCalls) ? reply.toolCalls : [reply.toolCalls]) {
      if (call === null || call === undefined) continue
      toolUses.push({
        id: call?.id === undefined || call?.id === null ? null : String(call.id),
        name: call?.name === undefined || call?.name === null ? null : String(call.name),
        input: call?.arguments ?? null,
      })
    }
  }
  return {
    index,
    source: 'mock',
    seq: Number.isInteger(record?.seq) ? record.seq : index,
    at: record?.at ?? null,
    model: body?.model ?? null,
    toolNames: Array.isArray(body?.tools) ? body.tools.map((tool) => String(tool?.name ?? tool?.function?.name ?? '')) : [],
    messageRoles: (Array.isArray(body?.messages) ? body.messages : []).map((message) => String(message?.role ?? '')),
    text: String(reply?.kind ?? '') === 'text' ? String(reply?.content ?? '') : '',
    toolUses,
    toolResults: toolResultsOfMessages(body?.messages),
  }
}

/** Normalise one PROVIDER-BOUNDARY recorder record. */
export function turnFromRecorderRecord(record, index) {
  const toolUses = (Array.isArray(record?.reply?.toolUses) ? record.reply.toolUses : []).map((block) => ({
    id: block?.id === undefined || block?.id === null ? null : String(block.id),
    name: block?.name === undefined || block?.name === null ? null : String(block.name),
    input: block?.input ?? null,
  }))
  // The recorder stores a SUMMARY per message with `toolResults` already extracted (it never keeps
  // the raw body), so the results are read from that summary rather than from a message body.
  const toolResults = []
  for (const message of Array.isArray(record?.messages) ? record.messages : []) {
    for (const result of Array.isArray(message?.toolResults) ? message.toolResults : []) {
      toolResults.push({
        toolUseId: result?.toolUseId ?? null,
        isError: result?.isError === true,
        text: String(result?.text ?? ''),
      })
    }
  }
  return {
    index,
    source: 'recorder',
    seq: Number.isInteger(record?.seq) ? record.seq : index,
    at: record?.at ?? null,
    model: record?.model ?? null,
    toolNames: Array.isArray(record?.toolNames) ? record.toolNames.map(String) : [],
    messageRoles: Array.isArray(record?.messageRoles) ? record.messageRoles.map(String) : [],
    text: String(record?.reply?.text ?? ''),
    thinking: String(record?.reply?.thinking ?? ''),
    toolUses,
    toolResults,
  }
}

/**
 * An ordered, queryable view of the observed model calls.
 *
 * Constructed with a THUNK so a live run can re-snapshot between queries; every
 * reader method materialises the current turns.
 */
export class ModelTranscript {
  /**
   * @param {{source: 'mock'|'recorder', turns: () => object[]}} spec
   */
  constructor({ source, turns }) {
    this.source = source
    this.turnsThunk = turns
  }

  static fromMockRequests(requests) {
    return new ModelTranscript({
      source: 'mock',
      turns: () => (Array.isArray(requests) ? requests : []).map(turnFromMockRequest),
    })
  }

  /**
   * @param {object[]|(() => object[])} records recorder records, or a thunk
   */
  static fromRecorderRecords(records) {
    return new ModelTranscript({
      source: 'recorder',
      turns: () => (typeof records === 'function' ? records() : Array.isArray(records) ? records : []).map(turnFromRecorderRecord),
    })
  }

  /** The current snapshot of observed turns. */
  turns() { return this.turnsThunk() }

  /** Every observed tool_use block, in call order, tagged with its turn index. */
  toolUses() {
    const out = []
    for (const turn of this.turns()) {
      for (const block of turn.toolUses) {
        out.push({ id: block.id, name: block.name, input: block.input, turnIndex: turn.index, turn })
      }
    }
    return out
  }

  /** All observed tool_use blocks matching `predicate`, in call order. */
  findAll(predicate) {
    return this.toolUses().filter((block) => predicate(block) === true)
  }

  /**
   * The observed block at the predicate's `nth` occurrence (0 when unspecified), or null.
   * `nth` is applied HERE, not only in `requireToolUse`, so a wait loop and the final lookup
   * select the SAME block — the round-120 self-test caught a version where they disagreed.
   */
  findToolUse(predicate) {
    const matches = this.findAll(predicate)
    const occurrence = predicate?.spec?.nth
    return (Number.isInteger(occurrence) ? matches[occurrence] : matches[0]) ?? null
  }

  /**
   * Locate the ONE piece of evidence a judge needs, or throw a named
   * `DISCOVERY-MISS`. This is the ONLY way a judge in this driver obtains a call
   * id in real mode, so a predicate that matches nothing can never be reported
   * as a pass.
   *
   * @param {string} slot slot name (goes into the failure reason)
   * @param {Function} predicate built with `matchToolUse`
   * @param {string} [predicateText] human description (defaults to the spec)
   */
  requireToolUse(slot, predicate, predicateText = undefined) {
    const described = predicateText ?? (typeof predicate.describe === 'function' ? predicate.describe() : 'predicate')
    const matches = this.findAll(predicate)
    const occurrence = predicate?.spec?.nth
    const chosen = Number.isInteger(occurrence) ? matches[occurrence] : matches[0]
    if (chosen === undefined || chosen === null) {
      throw new DiscoveryMissError(slot, described, this.turns().length)
    }
    return chosen
  }

  /** Optional lookup: null when nothing matches (for arms that record absence). */
  findOptional(slot, predicate) {
    return this.findToolUse(predicate)
  }

  /** Every place the tool result for `toolUseId` was returned to the model. */
  toolResultsFor(toolUseId) {
    const out = []
    for (const turn of this.turns()) {
      for (const result of turn.toolResults) {
        if (String(result.toolUseId ?? '') === String(toolUseId ?? '')) out.push(result)
      }
    }
    return out
  }

  /** Number of observed assistant turns carrying at least one tool_use block. */
  assistantTurnsWithToolUse({ afterTurn = -1 } = {}) {
    return this.turns().filter((turn) => turn.index > afterTurn && turn.toolUses.length > 0).length
  }

  /** Observed turn count (the "zero turns must fail" gate reads this). */
  turnCount() { return this.turns().length }

  /** The union of tool surfaces the observed calls carried, in first-seen order. */
  /** Names of the tools actually CALLED (tool_use blocks), in first-use order. */
  calledToolNames() {
    const out = []
    for (const use of this.toolUses()) if (!out.includes(use.name)) out.push(use.name)
    return out
  }

  /** Names ADVERTISED to the model on each request (the surface), in first-seen order. */
  toolNames() {
    const out = []
    for (const turn of this.turns()) {
      for (const name of turn.toolNames) if (!out.includes(name)) out.push(name)
    }
    return out
  }

  /** A compact, evidence-shaped excerpt for a failure report (never the whole body). */
  excerpt(limit = 6, textLimit = 300) {
    return this.turns().slice(-limit).map((turn) => ({
      index: turn.index,
      at: turn.at,
      text: truncate(turn.text, textLimit),
      toolUses: turn.toolUses.map((block) => ({ id: block.id, name: block.name, input: truncate(JSON.stringify(block.input ?? null), textLimit) })),
      toolResults: turn.toolResults.map((result) => ({ toolUseId: result.toolUseId, isError: result.isError, text: truncate(result.text, textLimit) })),
    }))
  }
}
