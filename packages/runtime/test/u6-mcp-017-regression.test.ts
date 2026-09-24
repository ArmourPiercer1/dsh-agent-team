/**
 * U6 (0.1.7-rc.1 upgrade, plan §9) — MCP / capability compatibility.
 *
 * Two layers of evidence, both at the PUBLIC seam boundary (no private
 * module reach; the only double is the host Cordis ctx — the exact surface
 * `agentCtx.plugin(mcpClient, config)` provides in production, pinned here
 * so any future upstream drift fails LOUD at the unit layer instead of
 * surfacing as a runtime surprise — the same typecheck-blind class the
 * client sessions seam taught in U5):
 *
 * 1. SEAM PIN — the `@deepseek-ai/dsh-mcp-client` 0.1.7 namespace-plugin
 *    surface: `name`, `inject = ['tools']`, callable `apply`, and a `Config`
 *    schema that ACCEPTS the exact six-field streamable-http literal the
 *    production mount passes (`agent-bindings.mjs` reconcileMcpSet, the
 *    `state.mcpMountCtx.plugin(mcpClient, {...})` call — the only upstream
 *    MCP surface the plugin consumes; `mcp-facet.ts` / `mcp-adapter.ts`
 *    are pure modules with zero upstream imports, verified by scan).
 *
 * 2. LIVE DISCOVERY — the REAL `apply()` (real plugin code + real MCP SDK
 *    v2 client + real HTTP) against the three plan §9.3 mini-MCP variants:
 *      - 'single'    — the legacy one-tool endpoint (one tool discovered);
 *      - 'paginated' — a tools/list cursor sequence (page 1 [alpha] +
 *        nextCursor, page 2 [beta]); the 0.1.7 SDK aggregates the pages —
 *        BOTH tools must be discovered (pagination must not break
 *        discovery);
 *      - 'none'      — an empty tool list; `apply` must RESOLVE (a server
 *        without tools must not crash Team initialization — the mount
 *        succeeds with zero tools, no startup error).
 *
 * The full-host half (per-agent visibility through a real live Team,
 * single-live-Team stability) is the U8 real-host vertical (plan §9.2 asks
 * only for single-live-Team stability this round; multi-Team shared-server
 * is explicitly out of the upgrade blocking gate).
 */
import { describe, expect, it } from 'vitest'

import * as mcpClient from '@deepseek-ai/dsh-mcp-client'
import { closeMiniServer, startMiniMcpServer } from '../root-binding/harness/mini-mcp.mjs'

/**
 * The exact production mount config literal (agent-bindings.mjs
 * reconcileMcpSet — the only fields the plugin passes; 0.1.7 added the
 * OPTIONAL `maxInstructionBytes` / `reconnect` which the plugin omits by
 * design and the schema defaults).
 */
function productionConfig(serverName: string, port: number) {
  return {
    transport: 'streamable-http' as const,
    serverName,
    url: `http://127.0.0.1:${port}/mcp`,
    headers: {},
    toolCallTimeoutMs: 15_000,
    failOnStartupError: true,
  }
}

/** One registered tool as observed through the ctx double. */
interface RegisteredTool {
  readonly name: string
}

/**
 * The minimal-but-faithful host Cordis ctx double: the exact surface the
 * 0.1.7 mcp-client plugin reads during `apply` + the initial tool sync
 * (verified against the 0.1.7 source, file:line in mcp-regression.log):
 * `root` (the scope owner fallback when `scopeOf` is untagged),
 * `tools.register` (the injected `tools` service), `logger`, `effect`
 * (fiber-scoped setup with a returned disposer), `on` (the unload hook),
 * `get` (attachments/llm — the tool-CALL path only, never reached by
 * discovery), and `inject` (the server-context service contributions:
 * mcpResources + systemPrompt).
 */
function makeHostCtx() {
  const registered: RegisteredTool[] = []
  const disposers: Array<() => void> = []
  const effects: string[] = []
  const events: Array<{ event: string; global: boolean }> = []
  const root: object = {}
  const ctx: Record<string, unknown> = {
    root,
    fiber: { uid: null },
    tools: {
      register: (definition: { readonly name: string }): (() => void) => {
        registered.push({ name: definition.name })
        const dispose = (): void => {
          const i = registered.findIndex((t) => t.name === definition.name)
          if (i >= 0) registered.splice(i, 1)
        }
        disposers.push(dispose)
        return dispose
      },
    },
    logger: {
      info: (..._args: unknown[]): void => {},
      warn: (..._args: unknown[]): void => {},
      error: (..._args: unknown[]): void => {},
      debug: (..._args: unknown[]): void => {},
    },
    get: (): undefined => undefined,
    effect: (setup: () => unknown, label?: string): void => {
      if (label !== undefined) effects.push(label)
      const dispose = setup()
      if (typeof dispose === 'function') disposers.push(dispose as () => void)
    },
    on: (event: string, _fn: unknown, opts?: { global?: boolean }): void => {
      events.push({ event, global: opts?.global === true })
    },
    inject: (_names: readonly string[], compose: (inner: Record<string, unknown>) => void): void => {
      const inner: Record<string, unknown> = {
        mcpResources: { register: (_server: string, _provider: unknown): void => {} },
        systemPrompt: {
          section: (_options: unknown): void => {},
          getSectionOrder: (_group: string): number => 100,
        },
      }
      compose(inner)
    },
  }
  return {
    ctx,
    registered,
    effects,
    events,
    /** Teardown: dispose every effect registration (reverse order). */
    disposeAll: (): void => {
      for (const dispose of [...disposers].reverse()) {
        try {
          dispose()
        } catch {
          // a dying generation is expected at teardown
        }
      }
    },
  }
}

describe('U6 — dsh-mcp-client 0.1.7 public seam pin', () => {
  it('is a namespace plugin named mcp-client injecting the tools service', () => {
    expect(mcpClient.name).toBe('mcp-client')
    expect(mcpClient.inject).toEqual(['tools'])
    expect(typeof (mcpClient as { apply?: unknown }).apply).toBe('function')
  })

  it('accepts the exact production six-field streamable-http config (0.1.7 schema)', async () => {
    // The 0.1.7 `Config` is a Schemastery schema exposing the Standard
    // Schema interface (`~standard.validate`) — not a zod surface.
    const configSchema = (mcpClient as {
      Config?: { '~standard'?: { version: number; validate: (v: unknown) => Promise<unknown> } }
    }).Config
    expect(configSchema).toBeDefined()
    const std = configSchema!['~standard']
    expect(std).toBeDefined()
    expect(std!.version).toBe(1)
    const parsed = (await std!.validate(productionConfig('u6plain', 3981))) as {
      readonly value: Record<string, unknown>
    }
    expect(parsed.value.headers).toEqual({})
    expect(parsed.value.toolCallTimeoutMs).toBe(15_000)
    expect(parsed.value.failOnStartupError).toBe(true)
    // The 0.1.7 optionals the plugin deliberately omits get schema defaults
    // (reconnect policy present, instruction cap at the 32 KiB default).
    expect(parsed.value.maxInstructionBytes).toBe(32_768)
    expect(parsed.value.reconnect).toBeDefined()
  })
})

describe('U6 — real apply() discovery against the plan §9.3 mini-MCP variants', () => {
  it('single: the legacy one-tool endpoint discovers exactly one tool', async () => {
    const mini = await startMiniMcpServer([3981, 3982], { tools: 'single' })
    const host = makeHostCtx()
    try {
      await (mcpClient as { apply: (ctx: unknown, config: unknown) => Promise<void> }).apply(
        host.ctx,
        productionConfig('u6plain', mini.port),
      )
      expect(host.registered.map((t) => t.name)).toEqual(['mcp__u6plain__ping'])
      // The two 0.1.7 effects are registered (serverName reservation + the
      // connection supervisor disposal).
      expect(host.effects).toContain('mcp-client.serverName')
      expect(host.effects).toContain('mcp-client.connection')
      // The unload hook is wired globally (the 0.1.7 close-on-unload path).
      expect(host.events.some((e) => e.event === 'internal/plugin' && e.global)).toBe(true)
    } finally {
      host.disposeAll()
      await closeMiniServer(mini)
    }
  }, 20_000)

  it('paginated: the tools/list cursor sequence is fully aggregated (both tools discovered)', async () => {
    const mini = await startMiniMcpServer([3983, 3984], { tools: 'paginated' })
    const host = makeHostCtx()
    try {
      await (mcpClient as { apply: (ctx: unknown, config: unknown) => Promise<void> }).apply(
        host.ctx,
        productionConfig('u6paged', mini.port),
      )
      // Page 1 (alpha + nextCursor) AND page 2 (beta) must both be live —
      // pagination must not break discovery (plan §9.3).
      expect(host.registered.map((t) => t.name).sort()).toEqual(['mcp__u6paged__alpha', 'mcp__u6paged__beta'])
    } finally {
      host.disposeAll()
      await closeMiniServer(mini)
    }
  }, 20_000)

  it('none: a tool-less server mounts cleanly (zero tools, apply resolves — no init crash)', async () => {
    const mini = await startMiniMcpServer([3985, 3986], { tools: 'none' })
    const host = makeHostCtx()
    try {
      // failOnStartupError: true — a zero-tool server is NOT a startup
      // error: the mount resolves with an empty tool generation.
      await (mcpClient as { apply: (ctx: unknown, config: unknown) => Promise<void> }).apply(
        host.ctx,
        productionConfig('u6none', mini.port),
      )
      expect(host.registered).toEqual([])
    } finally {
      host.disposeAll()
      await closeMiniServer(mini)
    }
  }, 20_000)
})
