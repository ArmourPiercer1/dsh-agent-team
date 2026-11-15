/**
 * Wire script driver — the SAME `agent-script/1` turns, replayed at the real
 * host's model WIRE boundary instead of inside the caller's process.
 *
 * WHY THIS EXISTS (M7-A): {@link import('./scripted-model.js').ScriptedModelAdapter}
 * is an `LlmAdapter` object. Injecting it into a separate `dsh web` child would
 * be a different (and unproven) composition. The public seam that actually
 * exists for a real host process is the provider endpoint: `DEEPSEEK_BASE_URL`
 * + `DEEPSEEK_API_KEY` are read by the shipped DeepSeek adapter
 * (`packages/llm/llm-deepseek/src/config.ts` in the pinned host tree) from the
 * trusted environment layer. `tests/world-factory/lib/world-factory.mjs` points
 * that seam at an in-process, deterministic OpenAI-compatible mock
 * (`packages/tools/harness/mock-deepseek.mjs`), whose `decide` callback selects
 * every reply.
 *
 * This module is that callback's script engine: it validates the same
 * `agent-script/1` document as the in-process adapter, enforces the same
 * structural `expect_request` law, and refuses to drift (exhausted / unexpected
 * / unconsumed). What it does NOT do is claim the in-process adapter ran: the
 * host crossed a real HTTP model boundary, and the turns were replayed there.
 *
 * AUX REQUESTS ARE NOT TURNS. The host also calls its provider for title
 * generation / compaction; those requests carry no tool list. They are answered
 * with a neutral text and consume nothing, so a script can never be spent on
 * traffic that was not the agent turn it describes.
 *
 * @module @dsh-agent-team/testkit/wire-script
 */
import {
  ScriptedModelError,
  describeTurn,
  matchAgentScriptRequest,
  validateAgentScript,
} from './agent-script.js'
import type { AgentScript, AgentScriptTurn } from './agent-script.js'

/** The subset of a captured model request this driver looks at. */
export interface WireModelRequest {
  /** Tool definitions as the host advertised them (either wire dialect). */
  tools?: Array<{ function?: { name?: unknown }; name?: unknown } | null> | null
  /** Chat messages (or a Responses-style `input`) — matched as JSON. */
  messages?: unknown
  input?: unknown
  [key: string]: unknown
}

/** One reply in the mock provider's vocabulary. */
export type WireScriptReply =
  | { kind: 'text'; content: string }
  | { kind: 'tool-call'; toolCalls: Array<{ id: string; name: string; arguments: unknown }> }

/** One consumed turn, for evidence (which request took which turn). */
export interface WireScriptConsumption {
  turnIndex: number
  requestSeq: number | undefined
  callId: string | null
  respondKind: 'text' | 'tool-call'
}

/** The driver the mock provider calls as `decide`. */
export interface WireScriptDriver {
  readonly script: AgentScript
  readonly consumedTurns: number
  readonly pendingTurns: readonly AgentScriptTurn[]
  /** Turns consumed so far, in order (evidence, not control flow). */
  readonly consumed: readonly WireScriptConsumption[]
  /** Replay one request. Rejects on any script violation. */
  decide(input: { seq?: number; req: WireModelRequest }): Promise<WireScriptReply>
  /** Throw `SCRIPT_UNCONSUMED_TURN` when turns remain (opt-out in the script). */
  assertComplete(): void
}

/** Tool names as advertised by either wire dialect, dropping unusable rows. */
export function wireToolNames(req: WireModelRequest | null | undefined): string[] {
  const tools = Array.isArray(req?.tools) ? req.tools : []
  const names: string[] = []
  for (const tool of tools) {
    const name = tool?.function?.name ?? tool?.name
    if (typeof name === 'string' && name.length > 0) names.push(name)
  }
  return names
}

/** Serialized request messages — the structural matching surface. */
export function wireSerializedMessages(req: WireModelRequest | null | undefined): string {
  return JSON.stringify(req?.messages ?? req?.input ?? [])
}

/**
 * Validate an untrusted script and build its wire driver.
 *
 * @param script - untrusted `agent-script/1` value.
 * @param opts.callIdPrefix - prefix for synthesized tool-call ids (default
 *   `wire-script`); the per-turn suffix is the turn index, so ids are stable.
 */
export function createWireScriptDriver(
  script: unknown,
  opts: { callIdPrefix?: string } = {},
): WireScriptDriver {
  const validated = validateAgentScript(script)
  const prefix = opts.callIdPrefix ?? 'wire-script'
  let consumed = 0
  const log: WireScriptConsumption[] = []

  return {
    script: validated,
    get consumedTurns() {
      return consumed
    },
    get pendingTurns() {
      return validated.turns.slice(consumed)
    },
    consumed: log,
    async decide({ seq, req }) {
      const toolNames = wireToolNames(req)
      // No tool list = aux traffic (title / compaction). Never consume a turn.
      if (toolNames.length === 0) return { kind: 'text', content: 'WIRE-AUX' }

      const index = consumed
      const turn = validated.turns[index]
      if (turn === undefined) {
        throw new ScriptedModelError(
          'SCRIPT_EXHAUSTED',
          `wire script received an extra agent request (seq ${String(seq)}): all ${validated.turns.length} turn(s) were already consumed`,
        )
      }
      // Consume before matching: a mismatched request fails instead of silently
      // retrying the same turn and hiding the drift.
      consumed += 1
      matchAgentScriptRequest(turn, index, { toolNames, serializedMessages: wireSerializedMessages(req) })

      const callId = turn.respond.kind === 'tool-call' ? `${prefix}-${index}` : null
      log.push({ turnIndex: index, requestSeq: seq, callId, respondKind: turn.respond.kind })

      if (turn.respond.kind === 'text') return { kind: 'text', content: turn.respond.text }
      return {
        kind: 'tool-call',
        toolCalls: [{ id: `${prefix}-${index}`, name: turn.respond.name, arguments: turn.respond.args }],
      }
    },
    assertComplete() {
      if (validated.assert_no_unconsumed_turns === false) return
      const pending = validated.turns.slice(consumed)
      if (pending.length === 0) return
      const listed = pending.map((turn, offset) => describeTurn(turn, consumed + offset)).join('; ')
      throw new ScriptedModelError(
        'SCRIPT_UNCONSUMED_TURN',
        `${pending.length} unconsumed wire turn(s): ${listed}`,
      )
    },
  }
}
