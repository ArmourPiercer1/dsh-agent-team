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
 * SCOPE (M7-A, stated so it is not over-claimed): this adapter lives INSIDE the
 * caller's process. It can drive an in-process host/composition, but it cannot
 * by construction reach a separate `dsh web` child process. The same
 * `agent-script/1` document is replayed at the host's model WIRE boundary by
 * `createWireScriptDriver` (`./wire-script.ts`) for a real DSH process; the
 * schema and the matching law are shared (`./agent-script.ts`).
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
import {
  ScriptedModelError,
  describeTurn,
  matchAgentScriptRequest,
  validateAgentScript,
} from './agent-script.js'
import type { AgentScript, AgentScriptTurn } from './agent-script.js'

// The script schema, its validation and its error taxonomy are shared with the
// wire transport; re-exported here because this module was their first home and
// is what the package entrypoint / existing tests import.
export { AGENT_SCRIPT_SCHEMA, ScriptedModelError, validateAgentScript } from './agent-script.js'
export type {
  AgentScript,
  AgentScriptRequestExpectation,
  AgentScriptResponse,
  AgentScriptTurn,
  ScriptedModelErrorCode,
} from './agent-script.js'

/**
 * Raise the standard abort error when `signal` is already aborted.
 * @param signal - the caller's cancellation signal, if any.
 */
function throwIfAborted(signal: AbortSignal | undefined): void {
  if (!signal?.aborted) return
  const error = new Error('scripted model call aborted')
  error.name = 'AbortError'
  throw error
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
 * required it.
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
    // The adapter contract requires honouring options.signal. A scripted turn is
    // already-decided text, but a cancelled call must still stop: an ignored
    // abort would let a turn be consumed and a tool call emitted after
    // cancellation, which is exactly the behaviour a cancellation test looks for.
    throwIfAborted(options.signal)
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

    throwIfAborted(options.signal)
    if (turn.respond.kind === 'text') {
      const text = turn.respond.text
      // Blocks are addressed by index; the text block is index 0.
      throwIfAborted(options.signal)
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
    throwIfAborted(options.signal)
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
    matchAgentScriptRequest(turn, index, {
      toolNames: (options.tools ?? []).map((tool) => tool.name),
      serializedMessages: serializeMessages(options),
    })
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
  const validated: AgentScript = validateAgentScript(script)
  const adapter = new ScriptedModelAdapter(validated)
  return { adapter, assertComplete: () => assertComplete(adapter) }
}
