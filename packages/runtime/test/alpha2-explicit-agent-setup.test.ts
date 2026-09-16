/**
 * fix/alpha2-explicit-agent-setup-compat — the explicit-Agent Setup
 * compatibility spec (T1–T5).
 *
 * What this file proves (the plan's test legs):
 *
 * T1 (0.1.5 style, the real blocker): the DSH 0.1.5+ AgentSetup contract
 *    `setup(agentCtx, agent)` — the setup ctx carries NO `agent` back-
 *    reference (0.1.5 removed the reverse association) AND no plugin-
 *    readable scope tag (a second @deepseek-ai/dsh-scope package instance
 *    cannot read the module-private Symbol tag) — while the bound template
 *    declares `capabilities.permissions`. The Permission Coverage Gate
 *    must enumerate the surface through the EXPLICIT Agent (recorded
 *    `tools.schemas(scope)` argument === the explicit agent) and the
 *    agent boots: no `alpha2-permission-coverage-surface-unavailable`.
 *
 * T2 (legacy 0.1.2 style stays): the one-argument `setup(agentCtx)` call
 *    with the 0.1.2-era `agentCtx.agent` back-reference + scope tag — the
 *    Coverage Gate and the permission resolver's cwd basis still work
 *    through the legacy seams (the plugin's pinned 0.1.2-rc.1 dependencies
 *    keep working).
 *
 * T3 (precedence pin): three DISTINCT identities at once — explicit agent
 *    A, `agentCtx.agent` = B, `scopeOf(agentCtx)` = C. The gate MUST read
 *    `tools.schemas(A)` and the cwd basis MUST be `A.session.header.cwd`
 *    (0.1.5 style wins over every implicit seam).
 *
 * T4 (fail-closed preserved): NO identity reachable (one-argument call,
 *    no back-reference, no tag) — the strict setup rejects with the typed
 *    `alpha2-permission-coverage-surface-unavailable` error and the
 *    updated message (`no runtime Agent identity is available`), exactly
 *    as before the fix (a permissions agent never runs on a surface the
 *    gate cannot verify).
 *
 * T5 (cwd basis under 0.1.5 style): the permission resolver's lazy
 *    `session.header.cwd` read tracks the EXPLICIT agent's live header
 *    (rewritten between drives) — never captured at install, never a
 *    legacy seam.
 *
 * Method: the real live glue over the t12a bridge doubles — the bridge's
 *   `agents` options select the host contract per world (`passExplicit-
 *   Agent` / `legacyCtxAgent` / `mintScope` / `identityOverride`), and
 *   the `tools.schemas(scope)` argument is recorded on the ctx double
 *   (`schemaScopeArgs`) so the identity the gate used is assertable.
 *   The plain-node runner constraint (synchronous `it` bodies) means
 *   every world is built and every listener leg is driven at MODULE TOP
 *   LEVEL (top-level await) and the `it` blocks assert on the captured
 *   state (the a6a pattern).
 *
 * Zero Team SessionEvent vocabulary (the p4t6 denylist): this file
 * carries none (the committed scanner scans it).
 */
import { describe, expect, it } from 'vitest'
import type { Context } from '@deepseek-ai/cordis'
import { scopeOf } from '@deepseek-ai/dsh-scope'
import {
  createLiveWorld,
  type AgentCtxDouble,
  type LiveWorld,
} from './t12a-live-bridge.mjs'

/**
 * The plugin-readable scope tag of one bridge ctx double (the same
 * public seam the glue's resolver reads; the double is structurally a
 * Context for the tag read — `scopeOf` only touches the symbol-keyed
 * tag property).
 */
function scopeTagOf(ctx: AgentCtxDouble): object | undefined {
  return scopeOf(ctx as unknown as Context)
}

// ── the world identities ───────────────────────────────────────────────────
const ROOT = 'session-a2x-root'

/**
 * The leader-only permissions blueprint (the closed-v1 leader declaration:
 * all four alpha.1 sub-fields + the alpha.2 `permissions` block — the
 * EXACT trigger of the real blocker: `Leader template declares
 * capabilities.permissions`). No members (the world boots the root only).
 */
const LEADER_PERMISSIONS_BLUEPRINT = [
  '---',
  'schemaVersion: 1',
  'blueprintId: team.a2x',
  'revision: "1"',
  'leader:',
  '  templateId: leader',
  '  persona: "You are the leader of the a2x test team."',
  '  capabilities:',
  '    teamTools:',
  '      kind: allow',
  '      items:',
  '        - team_send_message',
  '        - team_list_members',
  '    builtinToolDeny: []',
  '    skills:',
  '      kind: allow',
  '      items: []',
  '    mcp:',
  '      kind: allow',
  '      items: []',
  '    permissions:',
  '      default: ask',
  '      allow:',
  '        - tool: read',
  '          resource:',
  '            kind: any',
  '      ask:',
  '        - tool: write',
  '          resource:',
  '            kind: any',
  '      deny:',
  '        - tool: bash',
  '          resource:',
  '            kind: any',
  'requirements: []',
  'memberEnvelopes: []',
  'policyStates: []',
  'metadata: {}',
  '---',
  '',
].join('\n')

const TOOL_CATALOG = {
  tools: [{ name: 'team_send_message' }, { name: 'team_list_members' }],
}

// ── the allow-all spy control service (the A4 surface the adapter consumes) ─
function makeAllowSpy() {
  const service = {
    requests: [] as unknown[],
    waits: [] as unknown[],
    guards: [] as unknown[],
    checks: [] as unknown[],
    async requestControl(args: unknown) {
      service.requests.push(args)
      return { requestId: `a2x-req-${service.requests.length}`, kind: (args as { kind: string }).kind }
    },
    async awaitControlDecision(input: { rootSessionId: string; requestId: string }) {
      service.waits.push({ rootSessionId: input.rootSessionId, requestId: input.requestId })
      return { requestId: input.requestId, decision: 'allow' as const, decisionSequence: 1 }
    },
    async guardOperation(scope: unknown) {
      service.guards.push({ ...(scope as object) })
      return { allowed: true, requestId: `a2x-req-${service.requests.length}`, decisionSequence: 1 }
    },
    async checkExternalOperation(input: unknown) {
      service.checks.push({ ...(input as object) })
      return { allowed: true }
    },
    requestIdFor(correlation: unknown) {
      return undefined
    },
  }
  return service
}

// ── assertion helpers ───────────────────────────────────────────────────────
function activePreExecute(ctx: AgentCtxDouble): number {
  return ctx.listeners.filter((l) => l.event === 'tools/pre-execute' && l.active).length
}
/** The allow decision the driven `next` continuation returns. */
const NEXT_ALLOW = { kind: 'allow' } as const
/**
 * Drive the REGISTERED listener of one agent ctx with one pre-execute
 * payload (the same payload shape the upstream pipeline dispatches —
 * `exec.agent` is absent on the bridge double by design; the A5 adapter
 * never reads it).
 */
async function drivePreExecute(
  ctx: AgentCtxDouble,
  callId: string,
  name: string,
  args: unknown,
): Promise<{ decision: { kind: string; reason?: string }; nextCalls: number }> {
  const entry = ctx.listeners.find((l) => l.event === 'tools/pre-execute' && l.active)
  if (entry === undefined) {
    throw new Error('drivePreExecute: no active tools/pre-execute listener on the ctx')
  }
  let nextCalls = 0
  const decision = (await entry.listener(
    { callId, name, arguments: args, signal: new AbortController().signal },
    async () => {
      nextCalls += 1
      return NEXT_ALLOW
    },
  )) as { kind: string; reason?: string }
  return { decision, nextCalls }
}

/** The shared world options (root-only, permissions blueprint, filled ref). */
function baseWorldOptions(agentsOptions: Record<string, unknown> | undefined) {
  return {
    rootSessionId: ROOT,
    teamTools: TOOL_CATALOG,
    controlServiceRef: { current: makeAllowSpy() },
    ...(agentsOptions !== undefined ? { agents: agentsOptions } : {}),
    configOverrides: {
      bootPhase: 'create',
      blueprintSource: LEADER_PERMISSIONS_BLUEPRINT,
    },
  }
}

// ══════════════════════════════════════════════════════════════════════════
// W1 — T1 + T5: the DSH 0.1.5 world (explicit agent; NO ctx.agent; NO
// plugin-readable scope tag) with the permissions template.
// ══════════════════════════════════════════════════════════════════════════
const world1 = await createLiveWorld(
  baseWorldOptions({ passExplicitAgent: true, legacyCtxAgent: false, mintScope: false }),
)
await world1.binding.boot()
const w1Agent = world1.agents.handles.get(ROOT)!.agent
const w1Ctx = w1Agent.ctx as AgentCtxDouble
// T5: the cwd basis is the EXPLICIT agent's live header — rewrite it
// between drives (never captured at install).
w1Agent.session.header.cwd = '/a2x/ws-1'
const w1Drive1 = await drivePreExecute(w1Ctx, 'a2x-t5-1', 'read', { file_path: 'rel.md' })
w1Agent.session.header.cwd = '/a2x/ws-2'
const w1Drive2 = await drivePreExecute(w1Ctx, 'a2x-t5-2', 'read', { file_path: 'rel.md' })
const w1Active = activePreExecute(w1Ctx)
const w1SchemaArgs = [...w1Ctx.schemaScopeArgs]
const w1FsCalls = [...w1Ctx.fs.calls]
const w1CtxAgent = w1Ctx.agent
const w1ScopeTag = scopeTagOf(w1Ctx)
const w1Created = [...world1.agents.creates]
const w1HandleLive = world1.agents.handles.has(ROOT)
await world1.binding.close()

// ══════════════════════════════════════════════════════════════════════════
// W2 — T2: the legacy 0.1.2 world (one-argument setup call, the ctx.agent
// back-reference + the minted scope tag) with the SAME permissions
// template — the existing compatibility path must stay intact.
// ══════════════════════════════════════════════════════════════════════════
const world2 = await createLiveWorld(baseWorldOptions(undefined))
await world2.binding.boot()
const w2Agent = world2.agents.handles.get(ROOT)!.agent
const w2Ctx = w2Agent.ctx as AgentCtxDouble
w2Agent.session.header.cwd = '/a2x/ws-legacy'
const w2Drive = await drivePreExecute(w2Ctx, 'a2x-t2-1', 'read', { file_path: 'rel.md' })
const w2Active = activePreExecute(w2Ctx)
const w2SchemaArgs = [...w2Ctx.schemaScopeArgs]
const w2FsCalls = [...w2Ctx.fs.calls]
const w2CtxAgent = w2Ctx.agent
const w2ScopeTag = scopeTagOf(w2Ctx)
await world2.binding.close()

// ══════════════════════════════════════════════════════════════════════════
// W3 — T3: three DISTINCT identities (explicit A, ctx.agent = B,
// scopeOf = C) — the precedence pin (A must win everywhere).
// ══════════════════════════════════════════════════════════════════════════
const SENTINEL_B = { session: { header: { cwd: '/a2x/ws-B' } } }
const SENTINEL_C = { session: { header: { cwd: '/a2x/ws-C' } } }
const world3 = await createLiveWorld(
  baseWorldOptions({
    passExplicitAgent: true,
    legacyCtxAgent: true,
    mintScope: true,
    identityOverride: () => ({ ctxAgent: SENTINEL_B, scopeKey: SENTINEL_C }),
  }),
)
await world3.binding.boot()
const w3Agent = world3.agents.handles.get(ROOT)!.agent
const w3Ctx = w3Agent.ctx as AgentCtxDouble
w3Agent.session.header.cwd = '/a2x/ws-A'
const w3Drive = await drivePreExecute(w3Ctx, 'a2x-t3-1', 'read', { file_path: 'rel.md' })
const w3SchemaArgs = [...w3Ctx.schemaScopeArgs]
const w3FsCalls = [...w3Ctx.fs.calls]
const w3CtxAgent = w3Ctx.agent
const w3ScopeTag = scopeTagOf(w3Ctx)
await world3.binding.close()

// ══════════════════════════════════════════════════════════════════════════
// W4 — T4: NO identity reachable (one-argument call, no back-reference,
// no tag) — the strict setup must fail closed exactly as before.
// ══════════════════════════════════════════════════════════════════════════
let w4: LiveWorld | undefined
let w4Error: unknown
try {
  w4 = await createLiveWorld(baseWorldOptions({ passExplicitAgent: false, legacyCtxAgent: false, mintScope: false }))
  await w4.binding.boot()
} catch (error) {
  w4Error = error
}
if (w4 !== undefined) await w4.binding.close().catch(() => {})

// ══════════════════════════════════════════════════════════════════════════
// The legs.
// ══════════════════════════════════════════════════════════════════════════
describe('explicit-Agent Setup compatibility (fix/alpha2-explicit-agent-setup-compat)', () => {
  it('T1: the 0.1.5 world (explicit agent, no ctx.agent, no readable tag) boots a permissions agent through the Coverage Gate', async () => {
    // The world IS the 0.1.5 shape: no reverse association, no tag the
    // plugin can read (without the fix, the gate failed closed here).
    expect(w1CtxAgent).toBeUndefined()
    expect(w1ScopeTag).toBeUndefined()
    // The root booted (no rejection — the pre-fix blocker is gone):
    // exactly one agents.create and a settled live handle (captured
    // before close, which drains the live set).
    expect(w1Created.length).toBe(1)
    expect(w1Created[0]?.sessionId).toBe(ROOT)
    expect(w1HandleLive).toBe(true)
    // The strict install happened: exactly one active pre-execute
    // listener (the A5 adapter) — the Coverage Gate passed.
    expect(w1Active).toBe(1)
    // THE GATE READ THE SURFACE THROUGH THE EXPLICIT AGENT: every
    // recorded `tools.schemas(scope)` argument IS the explicit agent.
    expect(w1SchemaArgs.length).toBeGreaterThanOrEqual(1)
    for (const arg of w1SchemaArgs) {
      expect(arg).toBe(w1Agent)
    }
  })

  it('T5: the cwd basis under 0.1.5 style is the explicit agent session header (lazy)', async () => {
    // Both drives ran the static-allow `read` path (the next
    // continuation allowed each).
    expect(w1Drive1.decision.kind).toBe('allow')
    expect(w1Drive1.nextCalls).toBe(1)
    expect(w1Drive2.decision.kind).toBe('allow')
    expect(w1Drive2.nextCalls).toBe(1)
    // The resolver's cwd tracks the EXPLICIT agent's live header,
    // rewritten between drives (lazy read — never captured at install).
    // Both relative drives resolved with their drive-time header value.
    expect(w1FsCalls.some((c) => c.path === 'rel.md' && c.cwd === '/a2x/ws-1')).toBe(true)
    expect(w1FsCalls.some((c) => c.path === 'rel.md' && c.cwd === '/a2x/ws-2')).toBe(true)
  })

  it('T2: the legacy 0.1.2 world (ctx.agent + scope tag, one-argument setup) keeps working end to end', async () => {
    // The legacy world carries both implicit seams.
    expect(w2CtxAgent).toBe(w2Agent)
    expect(w2ScopeTag).toBe(w2Agent)
    // The strict install + gate + drive all succeed.
    expect(w2Active).toBe(1)
    expect(w2SchemaArgs.length).toBeGreaterThanOrEqual(1)
    for (const arg of w2SchemaArgs) {
      expect(arg).toBe(w2Agent)
    }
    expect(w2Drive.decision.kind).toBe('allow')
    expect(w2FsCalls.some((c) => c.path === 'rel.md' && c.cwd === '/a2x/ws-legacy')).toBe(true)
  })

  it('T3: precedence — the explicit agent A wins over ctx.agent B and scopeOf C', async () => {
    // The three identities ARE distinct in this world.
    expect(w3Agent).not.toBe(w3CtxAgent)
    expect(w3Agent).not.toBe(w3ScopeTag)
    expect(w3CtxAgent).toBe(SENTINEL_B)
    expect(w3ScopeTag).toBe(SENTINEL_C)
    // The Coverage Gate read the surface through A (never B, never C).
    expect(w3SchemaArgs.length).toBeGreaterThanOrEqual(1)
    for (const arg of w3SchemaArgs) {
      expect(arg).toBe(w3Agent)
    }
    // The cwd basis is A's header (never B's, never C's).
    expect(w3Drive.decision.kind).toBe('allow')
    expect(w3FsCalls.some((c) => c.path === 'rel.md' && c.cwd === '/a2x/ws-A')).toBe(true)
    expect(w3FsCalls.every((c) => c.cwd !== '/a2x/ws-B' && c.cwd !== '/a2x/ws-C')).toBe(true)
  })

  it('T4: no reachable identity still fails closed with the typed coverage-surface error', async () => {
    // The world CONSTRUCTS (createLiveWorld) but the boot rejects: the
    // typed rejection propagates out of the AgentSetup callback (the real
    // DSH factory rolls the unpublished agent back on a setup rejection
    // — the AgentSetup contract; a permissions agent never runs
    // unguarded).
    expect(w4Error).toBeInstanceOf(Error)
    const error = w4Error as Error & { code?: string }
    expect(error.code).toBe('alpha2-permission-coverage-surface-unavailable')
    expect(error.message).toContain('no runtime Agent identity is available')
    expect(error.message).toContain(`for '${ROOT}'`)
  })
})
