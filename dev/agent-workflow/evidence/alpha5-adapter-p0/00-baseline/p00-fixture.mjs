/**
 * p00-fixture.mjs — Alpha.5 P0-0 baseline fixture (Team-owned, PoC only).
 *
 * Plan: docs/plans/memo/alpha5-tool-io-governance/P0-independent-adapter-poc-implementation-guide.md §3 P0-0.
 * WHAT THIS IS: a plain-node ToolRuntime fixture over the PREBUILT public
 * libs of the pristine 0.2.0-rc.2 test-use checkout (import mechanism =
 * the established t12a-live-bridge.mjs junction pattern; the test-use tree
 * is NEVER modified — docs/TEST_METHODS.md §3). No model keys. No Host
 * server. "Native" tools here are TEST DEFINITIONS that stand in for the
 * production natives; per plan §0 this only narrows the experiment scope,
 * and P0-6 re-proves the selected families on the real pinned host.
 *
 * Observation model (plan P0-0): every tool BODY invocation appends
 * { event:'body', name, scopeId, callId, identity } to `obs`; every
 * fixture action appends an 'action' entry. Body counters are computed
 * from `obs` — the counters are the primary evidence channel, not return
 * text (plan §1.2: "仅依赖返回文本 … 不能算安全测试 PASS").
 *
 * @module evidence/alpha5-adapter-p0/00-baseline/p00-fixture
 */
import { lstatSync, mkdirSync, symlinkSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
export const WORKTREE_ROOT = resolve(HERE, '..', '..', '..', '..', '..') // dev/agent-workflow/evidence/alpha5-adapter-p0/00-baseline -> worktree root
const TEST_USE = resolve(WORKTREE_ROOT, 'tests', 'deepseek-harness-test-use')

/** Package dirs of the pristine checkout (paths pinned by SHA, see runner header). */
const PKG_LINKS = [
  ['cordis', ['vendor', 'cordis']],
  ['dsh-scope', ['packages', 'core', 'scope']],
  ['dsh-system-prompt', ['packages', 'core', 'system-prompt']],
  ['dsh-tools', ['packages', 'core', 'tools']],
  ['dsh-llm', ['packages', 'llm', 'llm']],
]

export function ensureResolvable() {
  const scopeDir = join(WORKTREE_ROOT, 'node_modules', '@deepseek-ai')
  for (const [name, parts] of PKG_LINKS) {
    const dir = join(scopeDir, name)
    let exists = false
    try { lstatSync(dir); exists = true } catch { exists = false }
    if (exists) continue
    const target = join(TEST_USE, ...parts)
    try { lstatSync(join(target, 'package.json')) } catch {
      throw new Error(`p00-fixture: pristine package dir missing: ${target} (is the test-use checkout built?)`)
    }
    mkdirSync(scopeDir, { recursive: true })
    symlinkSync(target, dir, 'junction')
  }
}

/** Identity tag for a ToolDefinition so observations can say WHICH body ran. */
let identitySeq = 0
export function tag(def, identity) {
  Object.defineProperty(def, '__p00Identity', { value: identity ?? `def#${String(++identitySeq)}` })
  return def
}
export const identityOf = (def) => def?.__p00Identity ?? 'untagged'

/** Minimal well-formed ToolDefinition (schema per scoped.spec.ts recipe). */
export function countingTool(obs, name, identity, opts = {}) {
  const def = {
    name,
    description: `p00 ${identity}`,
    parameters: { type: 'object', properties: {} },
    output: {
      schema: { type: 'string' },
      render: (_args, value) => [{ type: 'text', text: String(value) }],
    },
    execute: async (_args, exec) => {
      obs.push({ event: 'body', at: Date.now(), name, identity: identityOf(def), scopeId: exec?.agent?.id ?? '(agentless)', callId: String(exec?.callId ?? '?'), parentPresent: exec?.parent !== undefined })
      if (opts.throwOnCall !== undefined && obs.filter((o) => o.event === 'body' && o.identity === identityOf(def)).length >= opts.throwOnCall) {
        throw new Error(`p00 fixture body failure (${identity})`)
      }
      if (opts.gate) await opts.gate.promise // deterministic pause point (plan: 事件栅栏, never sleep-lottery)
      return `ran:${name}@${identityOf(def)}`
    },
  }
  return tag(def, identity)
}

/**
 * Mount ToolRuntime + SystemPrompt on a fresh cordis Context and mint agent
 * scopes. mintAgentScope mirrors the pinned host test recipe (scoped.spec.ts
 * mount()/mintAgentScope(), pristine SHA recorded by the runner).
 */
export async function makeFixture() {
  ensureResolvable()
  const { Context } = await import('@deepseek-ai/cordis')
  const { bindScopeParent, createScope } = await import('@deepseek-ai/dsh-scope')
  const SystemPrompt = (await import('@deepseek-ai/dsh-system-prompt')).default
  const ToolRuntime = (await import('@deepseek-ai/dsh-tools')).default
  const { ToolCallId } = await import('@deepseek-ai/dsh-llm')

  const ctx = new Context()
  await ctx.plugin(SystemPrompt, {})
  await ctx.plugin(ToolRuntime)

  const obs = []
  /** Mint a scope whose key doubles as a minimal Agent-like object. */
  async function mintScope(name, inject = ['tools', 'systemPrompt']) {
    const key = { id: name }
    let scope
    await ctx.plugin(Object.assign((inner) => { scope = createScope(inner, key) }, { inject }))
    return { scope, key }
  }

  let callSeq = 0
  async function run(name, agent) {
    const callId = ToolCallId(`p00-c${String(++callSeq)}`)
    const before = obs.length
    let result
    try {
      result = await ctx.tools.execute({ signal: new AbortController().signal, callId, name, arguments: {}, ...(agent ? { agent } : {}) })
    } catch (err) {
      obs.push({ event: 'action', at: Date.now(), action: 'execute-threw', name, scopeId: agent?.id ?? '(agentless)', callId: String(callId), message: String(err?.message ?? err) })
      return { threw: String(err?.message ?? err), bodies: obs.slice(before) }
    }
    const first = result?.content?.[0]
    const text = first?.type === 'text' ? first.text : JSON.stringify(result?.content ?? result)
    return { text, isError: result?.isError === true, bodies: obs.slice(before) }
  }

  const counters = (identity) => obs.filter((o) => o.event === 'body' && o.identity === identity).length
  const resolution = (name, agent) => {
    const def = ctx.tools.get(name, agent)
    return def === undefined ? 'UNKNOWN' : identityOf(def)
  }

  return { ctx, obs, mintScope, bindScopeParent, run, counters, resolution, ToolCallId }
}
