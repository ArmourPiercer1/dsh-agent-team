import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import ToolRuntime from '@deepseek-ai/dsh-tools'
import { ToolCallId } from '@deepseek-ai/dsh-llm'
const load = async (file: string) => import(new URL(`../../tools/agent-control-family/src/${file}`, import.meta.url).href)

/** Native output schemas copied from the pinned Host 639ed01539 definitions. */
const NATIVE = {
  list_agents: { type: 'array', items: { oneOf: [
    { type: 'object', additionalProperties: false, properties: { kind: { type: 'string', required: true, enum: ['child'] }, id: { type: 'string', required: true }, label: { type: 'string', required: true }, status: { type: 'string', required: true, enum: ['running', 'inactive'] }, parent: { type: 'string' }, depth: { type: 'number' } } },
    { type: 'object', additionalProperties: false, properties: { kind: { type: 'string', required: true, enum: ['diagnostic'] }, id: { type: 'string', required: true }, reason: { type: 'string', required: true, enum: ['corrupt', 'unsupported', 'unavailable'] }, parent: { type: 'string' }, depth: { type: 'number' } } },
  ] } },
  list_subagent_models: { type: 'string' },
  send_message: { type: 'object', additionalProperties: false, properties: { messageId: { type: 'string', required: true } } },
  interrupt_agent: { type: 'object', additionalProperties: false, properties: { accepted: { type: 'boolean', required: true } } },
  subagent: { oneOf: [
    { type: 'object', additionalProperties: false, properties: { kind: { type: 'string', required: true, const: 'background' }, jobId: { type: 'string', required: true } } },
    { type: 'object', additionalProperties: false, properties: { kind: { type: 'string', required: true, const: 'continuable' }, subagentId: { type: 'string', required: true } } },
    { type: 'object', additionalProperties: false, properties: { kind: { type: 'string', required: true, const: 'foreground' }, runId: { type: 'string', required: true }, output: { type: 'array', required: true, items: {} } } },
  ] },
  subagent_fork: null as Schema | null,
  workflow: { oneOf: [
    { type: 'object', additionalProperties: false, properties: { kind: { type: 'string', required: true, const: 'background' }, jobId: { type: 'string', required: true }, runId: { type: 'string', required: true } } },
    { type: 'object', additionalProperties: false, properties: { kind: { type: 'string', required: true, const: 'foreground' }, runId: { type: 'string', required: true }, agentsStarted: { type: 'integer', required: true }, result: { type: 'object' } } },
  ] },
}
NATIVE.subagent_fork = NATIVE.subagent

const SOURCES = {
  subagent: ['tests/deepseek-harness-test-use/packages/subagent/tool-subagent/src/index.ts', 'f7a1227d625d32dec5523d6a4f7b34dde5bba38c516a88fe08a1657679ac6aea'],
  list_subagent_models: ['tests/deepseek-harness-test-use/packages/subagent/tool-subagent/src/list-models.ts', '90e8adaa3188aca4b1f1437b43094969a069324de84e44bdbb5dccaf96198067'],
  list_agents: ['tests/deepseek-harness-test-use/packages/subagent/tool-subagent-control/src/list-agents.ts', 'dc4d2bc603dfb954ea0f90c8eb9655c767a4b4ab458fb70d359d9d2e066d7add'],
  send_message: ['tests/deepseek-harness-test-use/packages/subagent/tool-subagent-control/src/index.ts', '8da3b00799be6a2781a18d6849770a61c5c103a2d54d31a369d42320287cb3a2'],
  workflow: ['tests/deepseek-harness-test-use/packages/workflow/tool-workflow/src/index.ts', 'be42a318b61c5d8515272c06bae7b014f1bddab9ad257e5efe967b7490b56ee7'],
} as const

function sourceRoot(): string { return process.cwd() }
function driftGuard(): void {
  for (const [name, [path, expected]] of Object.entries(SOURCES)) {
    const digest = createHash('sha256').update(readFileSync(`${sourceRoot()}/${path}`)).digest('hex')
    expect(digest, `native schema source drift: ${name} (${path})`).toBe(expected)
  }
}

type Schema = Record<string, unknown>
function valid(schema: Schema | null | undefined, value: unknown, path = 'value'): string[] {
  if (schema === undefined || schema === null) return [`${path}: schema missing`]
  const errors: string[] = []
  if (Array.isArray(schema.oneOf)) {
    const branches = schema.oneOf as Schema[]
    if (!branches.some((branch) => valid(branch, value, path).length === 0)) errors.push(`${path}: no oneOf branch matched`)
    return errors
  }
  const type = schema.type
  if (type === 'json') return errors
  if (type === 'array') {
    if (!Array.isArray(value)) return [`${path}: expected array`]
    const itemSchema = schema.items as Schema | undefined
    return value.flatMap((item, i) => valid(itemSchema, item, `${path}[${i}]`))
  }
  if (type === 'object') {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return [`${path}: expected object`]
    const object = value as Record<string, unknown>
    const properties = (schema.properties ?? {}) as Record<string, Schema>
    for (const key of (schema.required as string[] | undefined) ?? []) if (!(key in object)) errors.push(`${path}.${key}: required`)
    if (schema.additionalProperties === false) for (const key of Object.keys(object)) if (!(key in properties)) errors.push(`${path}.${key}: additional property`)
    for (const [key, child] of Object.entries(properties)) if (key in object) errors.push(...valid(child, object[key], `${path}.${key}`))
    return errors
  }
  if (type === 'string' && typeof value !== 'string') errors.push(`${path}: expected string`)
  if (type === 'boolean' && typeof value !== 'boolean') errors.push(`${path}: expected boolean`)
  if (type === 'number' && (typeof value !== 'number' || !Number.isFinite(value))) errors.push(`${path}: expected number`)
  if (type === 'integer' && (typeof value !== 'number' || !Number.isSafeInteger(value))) errors.push(`${path}: expected integer`)
  if (schema.const !== undefined && value !== schema.const) errors.push(`${path}: const mismatch`)
  if (Array.isArray(schema.enum) && !(schema.enum as unknown[]).includes(value)) errors.push(`${path}: enum mismatch`)
  return errors
}

const exec = { correlation: 'c1-native-schema' }

describe('U7-F C1 native Host output schemas', () => {
  it('guards the pinned schema source and validates every governed row output', async () => {
    driftGuard()
    const spawn = await load('spawn-row.mjs')
    const fork = await load('fork-row.mjs')
    const steer = await load('steer-row.mjs')
    const interrupt = await load('interrupt-row.mjs')
    const agents = await load('list-agents-row.mjs')
    const models = await load('list-models-row.mjs')
    const workflow = await load('workflow-row.mjs')
    const rows = [
      ['subagent', spawn.buildSpawnRowDefinition({ name: 'subagent', spawnExecutor: async () => ({ kind: 'ok', value: { kind: 'foreground', runId: 'r1', output: [{ type: 'text', text: 'done' }] } }) })],
      ['subagent_fork', fork.buildForkRowDefinition({ name: 'subagent_fork', forkExecutor: async () => ({ kind: 'ok', value: { kind: 'continuable', subagentId: 'a1' } }) })],
      ['send_message', steer.buildSteerRowDefinition({ name: 'send_message', steerExecutor: async () => ({ kind: 'ok', value: { messageId: 'm1' } }) })],
      ['interrupt_agent', interrupt.buildInterruptRowDefinition({ name: 'interrupt_agent', interruptExecutor: async () => ({ kind: 'ok', value: { accepted: true } }) })],
      ['list_agents', agents.buildListAgentsRowDefinition({ name: 'list_agents', listAgentsExecutor: async () => ({ kind: 'ok', value: [{ kind: 'child', id: 'a1', label: 'child', status: 'inactive' }] }) })],
      ['list_subagent_models', models.buildListModelsRowDefinition({ name: 'list_subagent_models', listModelsExecutor: async () => ({ kind: 'ok', value: '(no LLM providers)' }) })],
      ['workflow', workflow.buildWorkflowRowDefinition({ name: 'workflow', workflowExecutor: async () => ({ kind: 'ok', value: { kind: 'foreground', runId: 'w1', agentsStarted: 0, result: {} } }) })],
    ] as const
    for (const [name, row] of rows) {
      const value = await row.execute(name === 'list_agents' || name === 'list_subagent_models' ? {} : name === 'send_message' || name === 'interrupt_agent' ? { agent_id: 'a1', ...(name === 'send_message' ? { message: 'x' } : {}) } : { description: 'd', prompt: 'p' }, exec)
      expect(valid(NATIVE[name], value), name).toEqual([])
    }
  })

  it('registers all seven rows in the real ToolRuntime and validates rendered outputs', async () => {
    driftGuard()
    const ctx = new Context()
    await ctx.plugin(SystemPrompt, {})
    await ctx.plugin(ToolRuntime)
    const spawn = await load('spawn-row.mjs')
    const fork = await load('fork-row.mjs')
    const steer = await load('steer-row.mjs')
    const interrupt = await load('interrupt-row.mjs')
    const agents = await load('list-agents-row.mjs')
    const models = await load('list-models-row.mjs')
    const workflow = await load('workflow-row.mjs')
    const rows = [
      ['subagent', spawn.buildSpawnRowDefinition({ name: 'subagent', spawnExecutor: async () => ({ kind: 'ok', value: { kind: 'foreground', runId: 'r1', output: [{ type: 'text', text: 'done' }] } }) }), {}],
      ['subagent_fork', fork.buildForkRowDefinition({ name: 'subagent_fork', forkExecutor: async () => ({ kind: 'ok', value: { kind: 'continuable', subagentId: 'a1' } }) }), {}],
      ['send_message', steer.buildSteerRowDefinition({ name: 'send_message', steerExecutor: async () => ({ kind: 'ok', value: { messageId: 'm1' } }) }), { agent_id: 'a1', message: 'x' }],
      ['interrupt_agent', interrupt.buildInterruptRowDefinition({ name: 'interrupt_agent', interruptExecutor: async () => ({ kind: 'ok', value: { accepted: true } }) }), { agent_id: 'a1' }],
      ['list_agents', agents.buildListAgentsRowDefinition({ name: 'list_agents', listAgentsExecutor: async () => ({ kind: 'ok', value: [{ kind: 'child', id: 'a1', label: 'child', status: 'inactive' }] }) }), {}],
      ['list_subagent_models', models.buildListModelsRowDefinition({ name: 'list_subagent_models', listModelsExecutor: async () => ({ kind: 'ok', value: '(no LLM providers)' }) }), {}],
      ['workflow', workflow.buildWorkflowRowDefinition({ name: 'workflow', workflowExecutor: async () => ({ kind: 'ok', value: { kind: 'foreground', runId: 'w1', agentsStarted: 0, result: {} } }) }), { description: 'orchestrate', prompt: 'p' }],
    ] as const
    const disposers = rows.map(([, definition]) => ctx.tools.register(definition))
    try {
      expect(rows.map(([name]) => ctx.tools.get(name as string)?.name)).toEqual(rows.map(([name]) => name))
      for (const [name, , args] of rows) {
        const result = await ctx.tools.execute({ signal: new AbortController().signal, callId: ToolCallId(`registry-${name}`), name, arguments: args })
        expect(result.isError, name).toBe(false)
        expect(result.content[0]?.type, name).toBe('text')
      }
    } finally {
      for (const dispose of disposers.reverse()) dispose()
    }
  })
})
