/**
 * Scripted model adapter — a deterministic stand-in for the model I/O boundary.
 *
 * WHAT THIS IS
 *   An {@link LlmAdapter} that replays a pre-declared `agent-script/1` turn
 *   list. It replaces ONLY the model: the caller still drives the real
 *   router/executor/permission path with the chunks this adapter emits.
 *
 * WHAT IT REFUSES (the whole point — a script that silently drifts is a test
 * that stops testing what it claims):
 *   - a request that does not carry the tools / text the next turn declares
 *     (`SCRIPT_UNEXPECTED_REQUEST`);
 *   - a stream call after the script ran out (`SCRIPT_EXHAUSTED`);
 *   - a script with turns nobody consumed (`SCRIPT_UNCONSUMED_TURN`);
 *   - a malformed script (`SCRIPT_INVALID`).
 *
 * MATCHING IS STRUCTURAL, NEVER SEQUENCE-NUMBERED. The turn says what the
 * request must contain (`tools_include`, `contains_text`); it never asserts a
 * request counter, because retries and routing may replay a request and a
 * number-only assertion would pass on the wrong call.
 *
 * DEVIATIONS FROM THE WRITTEN SPEC (forced by the real dsh-llm types):
 *   - the tool block type is `'tool-call'`, not `'tool_use'` — the wire
 *     vocabulary is `ContentBlockMap['tool-call']` / `ContentBlockType`;
 *   - chunk order is `usage` before the terminal `finish`, as documented on
 *     `StreamChunk` ("Adapters emit usage before the terminal finish and
 *     nothing afterward");
 *   - `Usage` is `TokenUsage` in the real API.
 *
 * @module @dsh-agent-team/testkit/scripted-model
 */
import { LlmAdapter } from '@deepseek-ai/dsh-llm'
import type {
  ContentBlock,
  FinishReason,
  GenerateOptions,
  StreamChunk,
  TokenUsage,
  ToolCallId,
} from '@deepseek-ai/dsh-llm'

/** Version tag of the agent-script document. */
export const AGENT_SCRIPT_SCHEMA = 'agent-script/1' as const

/** Structural expectation attached to one scripted turn. */
export interface AgentScriptRequestExpectation {
  /** Every tool name here must be present in `GenerateOptions.tools`. */
  tools_include?: string[]
  /** This literal must appear in the JSON-serialized request messages. */
  contains_text?: string
}

/** What the scripted model answers for one turn. */
export type AgentScriptResponse =
  | { kind: 'text'; text: string }
  | { kind: 'tool-call'; name: string; args: unknown }

/** One scripted model interaction. */
export interface AgentScriptTurn {
  expect_request?: AgentScriptRequestExpectation
  respond: AgentScriptResponse
}

/** A complete `agent-script/1` document. */
export interface AgentScript {
  schema: typeof AGENT_SCRIPT_SCHEMA
  world?: string
  actor?: string
  turns: AgentScriptTurn[]
  /**
   * Whether {@link assertComplete} rejects leftover turns. Defaults to true;
   * an explicit `false` is the one opt-out and must be written in the script.
   */
  assert_no_unconsumed_turns?: boolean
}

/** Machine-readable failure taxonomy of the scripted model. */
export type ScriptedModelErrorCode =
  | 'SCRIPT_INVALID'
  | 'SCRIPT_EXHAUSTED'
  | 'SCRIPT_UNEXPECTED_REQUEST'
  | 'SCRIPT_UNCONSUMED_TURN'

/** A scripted-model failure that names its stable code. */
export class ScriptedModelError extends Error {
  constructor(
    public code: ScriptedModelErrorCode,
    message: string,
  ) {
    super(message)
    this.name = 'ScriptedModelError'
  }
}

// --------------------------------------------------------------- validation

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function invalid(path: string, expected: string): never {
  throw new ScriptedModelError('SCRIPT_INVALID', `${path}: ${expected}`)
}

function validateTurn(value: unknown, index: number): AgentScriptTurn {
  const path = `turns[${index}]`
  if (!isRecord(value)) invalid(path, 'must be an object')

  let expectRequest: AgentScriptRequestExpectation | undefined
  if (value.expect_request !== undefined) {
    if (!isRecord(value.expect_request)) invalid(`${path}.expect_request`, 'must be an object')
    const raw = value.expect_request
    expectRequest = {}
    if (raw.tools_include !== undefined) {
      if (!Array.isArray(raw.tools_include)) invalid(`${path}.expect_request.tools_include`, 'must be an array of tool names')
      const tools: string[] = []
      for (const [i, name] of raw.tools_include.entries()) {
        if (typeof name !== 'string' || name.length === 0) {
          invalid(`${path}.expect_request.tools_include[${i}]`, 'must be a non-empty string')
        }
        tools.push(name)
      }
      expectRequest.tools_include = tools
    }
    if (raw.contains_text !== undefined) {
      if (typeof raw.contains_text !== 'string') {
        invalid(`${path}.expect_request.contains_text`, 'must be a string')
      }
      expectRequest.contains_text = raw.contains_text
    }
  }

  if (!isRecord(value.respond)) invalid(`${path}.respond`, 'is required and must be an object')
  const respond = value.respond
  const kind = respond.kind
  if (kind === 'text') {
    if (typeof respond.text !== 'string') invalid(`${path}.respond.text`, 'must be a string')
    return { ...(expectRequest === undefined ? {} : { expect_request: expectRequest }), respond: { kind, text: respond.text } }
  }
  if (kind === 'tool-call') {
    if (typeof respond.name !== 'string' || respond.name.length === 0) {
      invalid(`${path}.respond.name`, 'must be a non-empty string')
    }
    if (!('args' in respond)) invalid(`${path}.respond.args`, 'is required for a tool-call response')
    let serialized: string | undefined
    try {
      serialized = JSON.stringify(respond.args)
    } catch {
      serialized = undefined
    }
    if (serialized === undefined) invalid(`${path}.respond.args`, 'must be JSON-serializable')
    return {
      ...(expectRequest === undefined ? {} : { expect_request: expectRequest }),
      respond: { kind, name: respond.name, args: respond.args },
    }
  }
  return invalid(`${path}.respond.kind`, `unknown response kind ${JSON.stringify(kind)}; expected "text" or "tool-call"`)
}

/**
 * Validate an untrusted `agent-script/1` document and return it narrowed.
 *
 * @param input - parsed JSON (or any value claiming to be a script).
 * @returns the validated script, with unknown extra fields dropped.
 * @throws {ScriptedModelError} code `SCRIPT_INVALID` on any schema violation.
 */
export function validateAgentScript(input: unknown): AgentScript {
  if (!isRecord(input)) invalid('script', 'must be an object')
  if (input.schema !== AGENT_SCRIPT_SCHEMA) {
    invalid('schema', `must equal ${JSON.stringify(AGENT_SCRIPT_SCHEMA)} (got ${JSON.stringify(input.schema)})`)
  }
  if (input.world !== undefined && typeof input.world !== 'string') invalid('world', 'must be a string')
  if (input.actor !== undefined && typeof input.actor !== 'string') invalid('actor', 'must be a string')
  if (input.assert_no_unconsumed_turns !== undefined && typeof input.assert_no_unconsumed_turns !== 'boolean') {
    invalid('assert_no_unconsumed_turns', 'must be a boolean')
  }
  if (!Array.isArray(input.turns)) invalid('turns', 'must be an array')
  if (input.turns.length === 0) invalid('turns', 'must not be empty')

  const turns = input.turns.map((turn, index) => validateTurn(turn, index))
  return {
    schema: AGENT_SCRIPT_SCHEMA,
    ...(input.world === undefined ? {} : { world: input.world }),
    ...(input.actor === undefined ? {} : { actor: input.actor }),
    turns,
    ...(input.assert_no_unconsumed_turns === undefined
      ? {}
      : { assert_no_unconsumed_turns: input.assert_no_unconsumed_turns }),
  }
}

// ---------------------------------------------------------------- adapter

/** Split a payload into at least one delta fragment without changing its text. */
function fragments(payload: string): string[] {
  if (payload.length === 0) return []
  if (payload.length === 1) return [payload]
  const head = Math.ceil(payload.length / 2)
  return [payload.slice(0, head), payload.slice(head)]
}

/** Serialize the model-visible request as the matching surface. */
function serializeMessages(options: GenerateOptions): string {
  return JSON.stringify(options.messages)
}

function describeTurn(turn: AgentScriptTurn, index: number): string {
  const respond =
    turn.respond.kind === 'text'
      ? `text ${JSON.stringify(turn.respond.text.slice(0, 40))}`
      : `tool-call ${turn.respond.name}`
  return `turn[${index}] ${respond}`
}

/** Deterministic token usage for one replay; not a billing claim. */
function usageFor(options: GenerateOptions, output: string): TokenUsage {
  const inputTokens = Math.ceil(serializeMessages(options).length / 4)
  return { inputTokens, outputTokens: Math.ceil(output.length / 4) }
}

/**
 * A model adapter that replays one validated script.
 *
 * The base `LlmAdapter.providerInfo()` already returns valid metadata
 * (`{ id: provider, name: provider }`), so this class deliberately does not
 * override it — the spec only asked for an override if the base contract
 * required one.
 */
export class ScriptedModelAdapter extends LlmAdapter {
  readonly script: AgentScript
  /** Provider route this adapter describes; also the default registration key. */
  readonly provider: string
  #consumed = 0

  /**
   * @param script - validated script (use {@link createScriptedModel} for
   *   untrusted input; this constructor trusts its argument).
   * @param provider - provider route key; defaults to `'scripted'`.
   */
  constructor(script: AgentScript, provider = 'scripted') {
    super()
    this.script = script
    this.provider = provider
  }

  /** Number of turns already consumed by a `stream()` call. */
  get consumedTurns(): number {
    return this.#consumed
  }

  /** Turns that no `stream()` call has consumed yet. */
  get pendingTurns(): readonly AgentScriptTurn[] {
    return this.script.turns.slice(this.#consumed)
  }

  override async *stream(options: GenerateOptions): AsyncIterable<StreamChunk> {
    const index = this.#consumed
    const turn = this.script.turns[index]
    if (turn === undefined) {
      throw new ScriptedModelError(
        'SCRIPT_EXHAUSTED',
        `scripted model received an extra request: all ${this.script.turns.length} turn(s) were already consumed`,
      )
    }
    // Consume before matching: a mismatched request fails the call instead of
    // silently retrying the same turn and hiding the drift.
    this.#consumed += 1
    this.#matchRequest(turn, index, options)

    if (turn.respond.kind === 'text') {
      const text = turn.respond.text
      // Blocks are addressed by index; the text block is index 0.
      yield { type: 'block-start', index: 0, blockType: 'text' }
      for (const piece of fragments(text)) yield { type: 'text-delta', index: 0, text: piece }
      const block: ContentBlock = { type: 'text', text }
      yield { type: 'block-end', index: 0, block }
      yield { type: 'usage', usage: usageFor(options, text) }
      const reason: FinishReason = { kind: 'stop' }
      yield { type: 'finish', reason }
      return
    }

    const argumentsJson = JSON.stringify(turn.respond.args) ?? '{}'
    // The provider-issued call id is a branded string; the brand is a
    // compile-time marker only, so a documented cast is the honest way to
    // synthesize one in a mock. It stays stable per turn for correlation.
    const callId = `call_scripted_${index}` as ToolCallId
    yield { type: 'block-start', index: 1, blockType: 'tool-call' }
    for (const argumentsDelta of fragments(argumentsJson)) {
      yield { type: 'tool-call-delta', index: 1, id: callId, name: turn.respond.name, argumentsDelta }
    }
    const block: ContentBlock = {
      type: 'tool-call',
      id: callId,
      name: turn.respond.name,
      arguments: argumentsJson,
    }
    yield { type: 'block-end', index: 1, block }
    yield { type: 'usage', usage: usageFor(options, argumentsJson) }
    const reason: FinishReason = { kind: 'tool-calls' }
    yield { type: 'finish', reason }
  }

  #matchRequest(turn: AgentScriptTurn, index: number, options: GenerateOptions): void {
    const expected = turn.expect_request
    if (expected === undefined) return
    const seenTools = (options.tools ?? []).map((tool) => tool.name)
    const missing = (expected.tools_include ?? []).filter((name) => !seenTools.includes(name))
    if (missing.length > 0) {
      throw new ScriptedModelError(
        'SCRIPT_UNEXPECTED_REQUEST',
        `turn[${index}] expected tools ${JSON.stringify(expected.tools_include)} but the request declared [${seenTools.join(', ')}]; missing ${JSON.stringify(missing)}`,
      )
    }
    if (expected.contains_text !== undefined) {
      const serialized = serializeMessages(options)
      if (!serialized.includes(expected.contains_text)) {
        throw new ScriptedModelError(
          'SCRIPT_UNEXPECTED_REQUEST',
          `turn[${index}] expected request text ${JSON.stringify(expected.contains_text)} but the serialized messages did not contain it`,
        )
      }
    }
  }
}

/**
 * Fail when the script still has turns nobody consumed.
 *
 * @param adapter - the adapter to inspect.
 * @throws {ScriptedModelError} code `SCRIPT_UNCONSUMED_TURN` listing the
 *   leftover turns. The script's `assert_no_unconsumed_turns: false` opts out.
 */
export function assertComplete(adapter: ScriptedModelAdapter): void {
  if (adapter.script.assert_no_unconsumed_turns === false) return
  const pending = adapter.pendingTurns
  if (pending.length === 0) return
  const listed = pending.map((turn, offset) => describeTurn(turn, adapter.consumedTurns + offset)).join('; ')
  throw new ScriptedModelError(
    'SCRIPT_UNCONSUMED_TURN',
    `${pending.length} unconsumed scripted turn(s): ${listed}`,
  )
}

/**
 * Validate an untrusted script and build its adapter plus the completion check.
 *
 * @param script - untrusted `agent-script/1` value.
 * @returns the adapter and a bound {@link assertComplete}.
 */
export function createScriptedModel(script: unknown): {
  adapter: ScriptedModelAdapter
  assertComplete(): void
} {
  const validated = validateAgentScript(script)
  const adapter = new ScriptedModelAdapter(validated)
  return { adapter, assertComplete: () => assertComplete(adapter) }
}
