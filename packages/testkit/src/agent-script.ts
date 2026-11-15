/**
 * `agent-script/1` — the script schema shared by BOTH model transports.
 *
 * WHY THIS MODULE EXISTS (M7-A): a scripted model can meet the host on two
 * different boundaries, and they must be the same document:
 *
 *   1. {@link ScriptedModelAdapter} in `./scripted-model.ts` — an in-process
 *      {@link import('@deepseek-ai/dsh-llm').LlmAdapter}; it never crosses a
 *      process boundary, so it cannot drive a separate `dsh web` process.
 *   2. `createWireScriptDriver` in `./wire-script.ts` — the same turns replayed
 *      at the host's model WIRE boundary (the public `DEEPSEEK_BASE_URL`
 *      provider seam, see `packages/llm/llm-deepseek/src/config.ts`), which is
 *      how a real DSH process is driven with a deterministic model.
 *
 * Everything here is pure: no `@deepseek-ai/*` import, no I/O, no host types.
 * That is deliberate — the real-host harness imports this module under plain
 * `node` (type stripping), so a dependency on the host LLM package would make
 * the whole design unreachable from a bare checkout.
 *
 * @module @dsh-agent-team/testkit/agent-script
 */

/** Version tag of the agent-script document. */
export const AGENT_SCRIPT_SCHEMA = 'agent-script/1' as const

/** Structural expectation attached to one scripted turn. */
export interface AgentScriptRequestExpectation {
  /** Every tool name here must be present in the request's tool list. */
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
   * Whether the completion check rejects leftover turns. Defaults to true; an
   * explicit `false` is the one opt-out and must be written in the script.
   */
  assert_no_unconsumed_turns?: boolean
}

/** Machine-readable failure taxonomy of a scripted model. */
export type ScriptedModelErrorCode =
  | 'SCRIPT_INVALID'
  | 'SCRIPT_EXHAUSTED'
  | 'SCRIPT_UNEXPECTED_REQUEST'
  | 'SCRIPT_UNCONSUMED_TURN'

/** A scripted-model failure that names its stable code. */
export class ScriptedModelError extends Error {
  code: ScriptedModelErrorCode

  // Erasable-syntax constructor on purpose: TypeScript parameter properties are
  // rejected by node's strip-only mode, and this module is imported by the
  // real-host harness under plain `node`.
  constructor(code: ScriptedModelErrorCode, message: string) {
    super(message)
    this.name = 'ScriptedModelError'
    this.code = code
  }
}

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

/** One-line human description of a turn, used by the leftover-turn error. */
export function describeTurn(turn: AgentScriptTurn, index: number): string {
  const respond =
    turn.respond.kind === 'text'
      ? `text ${JSON.stringify(turn.respond.text.slice(0, 40))}`
      : `tool-call ${turn.respond.name}`
  return `turn[${index}] ${respond}`
}

/** The request facts BOTH transports can supply (no host types). */
export interface AgentScriptRequestFacts {
  /** Tool names the request declared, in request order. */
  toolNames: readonly string[]
  /** JSON-serialized request messages (the matching surface). */
  serializedMessages: string
}

/**
 * Enforce one turn's `expect_request` against a request. Structural, never
 * sequence-numbered: the turn says what the request must CONTAIN.
 *
 * @throws {ScriptedModelError} code `SCRIPT_UNEXPECTED_REQUEST`.
 */
export function matchAgentScriptRequest(
  turn: AgentScriptTurn,
  index: number,
  facts: AgentScriptRequestFacts,
): void {
  const expected = turn.expect_request
  if (expected === undefined) return
  const missing = (expected.tools_include ?? []).filter((name) => !facts.toolNames.includes(name))
  if (missing.length > 0) {
    throw new ScriptedModelError(
      'SCRIPT_UNEXPECTED_REQUEST',
      `turn[${index}] expected tools ${JSON.stringify(expected.tools_include)} but the request declared [${facts.toolNames.join(', ')}]; missing ${JSON.stringify(missing)}`,
    )
  }
  if (expected.contains_text !== undefined && !facts.serializedMessages.includes(expected.contains_text)) {
    throw new ScriptedModelError(
      'SCRIPT_UNEXPECTED_REQUEST',
      `turn[${index}] expected request text ${JSON.stringify(expected.contains_text)} but the serialized messages did not contain it`,
    )
  }
}
