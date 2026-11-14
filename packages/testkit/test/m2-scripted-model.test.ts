/**
 * TINF M2 — scripted model negative controls.
 *
 * These tests pin the properties that make a scripted model useful as a
 * deterministic safety input: the exact chunk protocol it emits, structural
 * request matching, and refusals for extra calls / extra turns / bad scripts.
 */
import { describe, expect, it } from 'vitest'

import type { GenerateOptions, StreamChunk, ToolSchema } from '@deepseek-ai/dsh-llm'

import {
  ScriptedModelError,
  assertComplete,
  createScriptedModel,
  validateAgentScript,
} from '../src/index.js'

/** Collect a chunk stream; the adapter's refusals surface here. */
async function collect(iterable: AsyncIterable<StreamChunk>): Promise<StreamChunk[]> {
  const chunks: StreamChunk[] = []
  for await (const chunk of iterable) chunks.push(chunk)
  return chunks
}

const BASH_TOOL: ToolSchema = {
  name: 'bash',
  description: 'run a shell command',
  parameters: { type: 'object', properties: { command: { type: 'string' } } },
}

/** A minimal real request; `messages` carries a text block the script can match. */
function request(overrides: Partial<GenerateOptions> = {}): GenerateOptions {
  return {
    provider: 'scripted',
    model: 'scripted-1',
    messages: [{ role: 'user', content: [{ type: 'text', text: 'please deploy the build' }] }],
    ...overrides,
  }
}

/** Run `fn` and return the ScriptedModelError code it threw. */
function thrownCode(fn: () => unknown): string {
  try {
    fn()
  } catch (error) {
    expect(error).toBeInstanceOf(ScriptedModelError)
    return (error as ScriptedModelError).code
  }
  throw new Error('expected the call to throw')
}

describe('TINF M2 scripted model: chunk protocol', () => {
  it('happy path: a text turn streams one text block, usage, then stop', async () => {
    const { adapter } = createScriptedModel({
      schema: 'agent-script/1',
      turns: [{ respond: { kind: 'text', text: 'all done' } }],
    })

    const chunks = await collect(adapter.stream(request()))

    expect(chunks[0]).toEqual({ type: 'block-start', index: 0, blockType: 'text' })
    const deltas = chunks.filter((chunk) => chunk.type === 'text-delta')
    expect(deltas.length).toBeGreaterThan(0)
    expect(deltas.map((chunk) => (chunk.type === 'text-delta' ? chunk.text : '')).join('')).toBe('all done')

    const blockEnd = chunks.find((chunk) => chunk.type === 'block-end')
    expect(blockEnd).toEqual({ type: 'block-end', index: 0, block: { type: 'text', text: 'all done' } })

    // The adapter contract is usage before the terminal finish, nothing after.
    expect(chunks.at(-2)?.type).toBe('usage')
    expect(chunks.at(-1)).toEqual({ type: 'finish', reason: { kind: 'stop' } })
    expect(chunks.some((chunk) => chunk.type === 'tool-call-delta')).toBe(false)
    assertComplete(adapter)
  })

  it('happy path: a tool-call turn streams one tool-call block and finishes tool-calls', async () => {
    const args = { command: 'printf test > /outside/forbidden' }
    const { adapter } = createScriptedModel({
      schema: 'agent-script/1',
      turns: [{ expect_request: { tools_include: ['bash'] }, respond: { kind: 'tool-call', name: 'bash', args } }],
    })

    const chunks = await collect(adapter.stream(request({ tools: [BASH_TOOL] })))

    // Real wire vocabulary: blockType and block.type are `tool-call`; the
    // scripted turn addresses it at index 1 per the M2 design.
    expect(chunks[0]).toEqual({ type: 'block-start', index: 1, blockType: 'tool-call' })
    const deltas = chunks.filter((chunk) => chunk.type === 'tool-call-delta')
    expect(deltas.length).toBeGreaterThan(0)
    expect(deltas.map((chunk) => (chunk.type === 'tool-call-delta' ? chunk.argumentsDelta : '')).join('')).toBe(
      JSON.stringify(args),
    )
    const callId = deltas[0]?.type === 'tool-call-delta' ? deltas[0].id : undefined
    expect(callId).toBe('call_scripted_0')

    const blockEnd = chunks.find((chunk) => chunk.type === 'block-end')
    expect(blockEnd).toEqual({
      type: 'block-end',
      index: 1,
      block: { type: 'tool-call', id: callId, name: 'bash', arguments: JSON.stringify(args) },
    })

    expect(chunks.at(-2)?.type).toBe('usage')
    expect(chunks.at(-1)).toEqual({ type: 'finish', reason: { kind: 'tool-calls' } })
    expect(chunks.some((chunk) => chunk.type === 'text-delta')).toBe(false)
    assertComplete(adapter)
  })

  it('matches contains_text against the serialized messages', async () => {
    const { adapter } = createScriptedModel({
      schema: 'agent-script/1',
      turns: [
        { expect_request: { contains_text: 'deploy' }, respond: { kind: 'text', text: 'ok' } },
      ],
    })
    await expect(collect(adapter.stream(request()))).resolves.toBeDefined()
  })
})

describe('TINF M2 scripted model: refusals', () => {
  it('an extra stream call is SCRIPT_EXHAUSTED', async () => {
    const { adapter } = createScriptedModel({
      schema: 'agent-script/1',
      turns: [{ respond: { kind: 'text', text: 'once' } }],
    })
    await collect(adapter.stream(request()))
    await expect(collect(adapter.stream(request()))).rejects.toMatchObject({ code: 'SCRIPT_EXHAUSTED' })
  })

  it('a wrong tools_include is SCRIPT_UNEXPECTED_REQUEST naming expected and seen', async () => {
    const { adapter } = createScriptedModel({
      schema: 'agent-script/1',
      turns: [
        { expect_request: { tools_include: ['bash'] }, respond: { kind: 'text', text: 'never' } },
      ],
    })
    const wrongTool: ToolSchema = { ...BASH_TOOL, name: 'read_file' }
    const failure = collect(adapter.stream(request({ tools: [wrongTool] })))
    await expect(failure).rejects.toMatchObject({ code: 'SCRIPT_UNEXPECTED_REQUEST' })
    await expect(failure).rejects.toThrow(/bash/)
    await expect(failure).rejects.toThrow(/read_file/)
    // The mismatched turn was consumed: it is not silently retried later.
    expect(adapter.consumedTurns).toBe(1)
  })

  it('a leftover turn is SCRIPT_UNCONSUMED_TURN listing it', async () => {
    const { adapter, assertComplete: check } = createScriptedModel({
      schema: 'agent-script/1',
      turns: [
        { respond: { kind: 'text', text: 'first' } },
        { respond: { kind: 'tool-call', name: 'bash', args: { command: 'true' } } },
      ],
    })
    await collect(adapter.stream(request()))
    expect(() => check()).toThrowError(/turn\[1\]/)
    expect(() => check()).toThrowError(/tool-call bash/)
    expect(thrownCode(() => check())).toBe('SCRIPT_UNCONSUMED_TURN')
  })

  it('assert_no_unconsumed_turns: false is the only opt-out', () => {
    const { adapter, assertComplete: check } = createScriptedModel({
      schema: 'agent-script/1',
      assert_no_unconsumed_turns: false,
      turns: [{ respond: { kind: 'text', text: 'unused' } }],
    })
    expect(() => check()).not.toThrow()
    expect(adapter.pendingTurns).toHaveLength(1)
  })

  it('invalid scripts are SCRIPT_INVALID across every schema violation', () => {
    const invalidScripts: unknown[] = [
      { schema: 'agent-script/2', turns: [{ respond: { kind: 'text', text: 'x' } }] },
      { schema: 'agent-script/1', turns: [] },
      { schema: 'agent-script/1', turns: [{ expect_request: { tools_include: ['bash'] } }] },
      { schema: 'agent-script/1', turns: [{ respond: { kind: 'shout', text: 'x' } }] },
      { schema: 'agent-script/1', turns: [{ respond: { kind: 'text', text: 'x' } , expect_request: { tools_include: 'bash' } }] },
      { schema: 'agent-script/1', turns: [{ respond: { kind: 'tool-call', name: 'bash' } }] },
      { schema: 'agent-script/1', turns: [{ respond: { kind: 'text', text: 1 } }] },
      { schema: 'agent-script/1', turns: 'not-an-array' },
      null,
    ]
    for (const script of invalidScripts) {
      expect(thrownCode(() => validateAgentScript(script))).toBe('SCRIPT_INVALID')
      expect(thrownCode(() => createScriptedModel(script))).toBe('SCRIPT_INVALID')
    }
  })
})

describe('TINF M2 scripted model: cancellation', () => {
  it('an already-aborted signal refuses the call and consumes no turn', async () => {
    const { adapter } = createScriptedModel({
      schema: 'agent-script/1',
      turns: [{ respond: { kind: 'tool-call', name: 'bash', args: { command: 'touch /outside/x' } } }],
    })
    const controller = new AbortController()
    controller.abort()

    // The adapter contract requires honouring options.signal (dsh-llm
    // index.d.ts): emitting a tool call after cancellation would be exactly the
    // behaviour a cancellation test is looking for.
    await expect(collect(adapter.stream(request({ signal: controller.signal })))).rejects.toThrow(/abort/i)
    // Nothing was consumed: the cancelled call never became a turn.
    expect(adapter.pendingTurns).toHaveLength(1)
    expect(() => assertComplete(adapter)).toThrow(/unconsumed scripted turn/)
  })
})
