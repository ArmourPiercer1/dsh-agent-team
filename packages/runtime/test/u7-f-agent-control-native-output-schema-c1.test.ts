import { existsSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import ToolRuntime from '@deepseek-ai/dsh-tools'
import { ToolCallId } from '@deepseek-ai/dsh-llm'
const load = async (file: string) => import(new URL(`../../tools/agent-control-family/src/${file}`, import.meta.url).href)

/**
 * Read compiled output schemas from the pinned Host's built native definitions.
 * This intentionally imports host lib/ESM entries (not the public package
 * entry and not a copied author spec): `defineTool` has already compiled each
 * author schema into `definition.output.schema`. Therefore any host source
 * change that alters a schema changes this value and fails the row comparison
 * until the row is deliberately updated.
 */
const nativeSchemas = async (): Promise<Record<string, Schema | null>> => {
  const { TEST_USE_REL } = await import(new URL('../../../tests/paths.mjs', import.meta.url).href)
  const root = process.cwd()
  const pristine = `${root}/${TEST_USE_REL}`
  if (!existsSync(pristine)) throw new Error(`native-schema C1 requires the pristine test-use checkout at ${TEST_USE_REL}`)
  const definitions: Record<string, { output: { schema: Schema } }> = {}
  const capture = (definition: { name: string; output: { schema: Schema } }) => { definitions[definition.name] = definition }
  const control = await import(`${pristine}/packages/subagent/tool-subagent-control/lib/index.js`)
  control.apply({ tools: { register: (d: { name: string; output: { schema: Schema } }) => { capture(d); return () => {} } }, subagents: { sendMessage: () => {}, interrupt: () => {} } })
  const agents = await import(`${pristine}/packages/subagent/tool-subagent-control/lib/types/list-agents.js`)
  agents.apply({ tools: { register: (d: { name: string; output: { schema: Schema } }) => { capture(d); return () => {} } }, subagents: {}, agents: {} })
  const models = await import(`${pristine}/packages/subagent/tool-subagent/lib/types/list-models.js`)
  models.registerListSubagentModels({ tools: { register: (d: { name: string; output: { schema: Schema } }) => { capture(d); return () => {} } } }, { routes: [] })
  const subagent = await import(`${pristine}/packages/subagent/tool-subagent/lib/index.js`)
  const provider = { name: 'p', capabilities: { depthLimit: true, agentOptions: true }, inheritsParentContext: false }
  subagent.apply({ tools: { register: (d: { name: string; output: { schema: Schema } }) => { capture(d); return () => {} } }, sessionProjections: { register: () => {} }, subagents: { resolveMaxDepth: () => undefined, getProvider: () => provider }, on: () => {} }, { provider: 'p', maxDepth: 'provider-managed', modelSelectionSettings: false, enableRunInBackground: true, backgroundMode: 'one-shot' })
  const workflow = await import(`${pristine}/packages/workflow/tool-workflow/lib/index.js`)
  workflow.apply({ tools: { register: (d: { name: string; output: { schema: Schema } }) => { capture(d); return () => {} } }, systemPrompt: { section: () => {}, getSectionOrder: () => 0 }, on: () => {}, get: () => undefined, workflowEngine: {} }, { toolName: 'workflow', maxResultChars: 1000, enableRunInBackground: true })
  return Object.fromEntries(['list_agents', 'list_subagent_models', 'send_message', 'interrupt_agent', 'subagent', 'workflow'].map((name) => [name, definitions[name]?.output.schema ?? null]).concat([['subagent_fork', definitions.subagent?.output.schema ?? null]]))
}
const NATIVE = await nativeSchemas()
async function driftGuard(): Promise<void> {
  const schemas = await load('native-output-schemas.mjs')
  for (const [name, schema] of Object.entries(NATIVE)) expect(schemas.nativeOutputSchemas[name], `compiled native output schema: ${name}`).toEqual(schema)
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
    await driftGuard()
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

  it('rejects one invalid native output per governed row', async () => {
    const schemas = await load('native-output-schemas.mjs')
    for (const name of Object.keys(NATIVE)) {
      const invalid = name === 'list_subagent_models' ? 42 : name === 'list_agents' ? [{}] : name === 'interrupt_agent' ? { accepted: 'yes' } : name === 'send_message' ? {} : { kind: 'foreground', runId: 1 }
      expect(valid(schemas.nativeOutputSchemas[name], invalid), name).not.toEqual([])
    }
  })

  it('renders workflow foreground scalar, array, null, and object results', async () => {
    const workflow = await load('workflow-row.mjs')
    for (const result of ['scalar', [1, 2], null, { ok: true }]) {
      const row = workflow.buildWorkflowRowDefinition({ name: 'workflow', workflowExecutor: async () => ({ kind: 'ok', value: { kind: 'foreground', runId: 'w1', agentsStarted: 0, result } }) })
      const value = await row.execute({ description: 'd', prompt: 'p' }, exec)
      expect(valid(NATIVE.workflow, value)).toEqual([])
      expect(row.output.render({}, value)[0]?.type).toBe('text')
    }
  })

  it('registers all seven rows in the real ToolRuntime and validates rendered outputs', async () => {
    await driftGuard()
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
