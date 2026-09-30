/**
 * F15 — MCP live-loss zero-core upgrade: the §9 unit matrix (GREEN).
 *
 * Plan: docs/plans/active/pre-alpha3-F15-MCP-live-loss-zero-core-upgrade-plan.md
 * (§5 witness/retirement, §6 probe wiring, §7 V1 authority, §9 test plan,
 * §11 telemetry semantics). Companion to
 * `f15-mcp-live-loss-characterization.test.ts` (commit 1 — the RED gap
 * probe, now green by this suite's product closure).
 *
 * Legs (plan §9.3 + §9.4 + §9.5 + §11):
 *
 *   L1   normal — the mounted fiber with its live tool surface is
 *        `reachable`; the live mount carries the explicit short reconnect
 *        policy (the §9.2 behavior witness — the double records the
 *        config the glue passed, verbatim).
 *   §9.4 re-sync transient — a successful tool-generation swap
 *        (`syncTools()`: dispose previous registrations → register the new
 *        generation, plan §7) must NOT classify as a loss: the boundary
 *        pull-probe after the swap sees the non-empty surface, no
 *        telemetry, no retirement (pins the future event-watcher
 *        regression).
 *   L2   permanent loss — the upstream post-budget-exhaustion withdrawal
 *        (the bridge double's `withdrawTools()`, the public-seam model of
 *        connection.d.ts: "Exhaustion unregisters the server's tools and
 *        stops; disposal … is the only way back") is classified
 *        `unreachable` + `confirmedLoss` at the probe; the exhausted
 *        fiber is retired in the SAME owned step (the failed slot is
 *        stamped now — the 30 s cooldown blocks a same-boundary remount);
 *        exactly ONE durable `capability-lost` telemetry
 *        (`mcp-public-tool-surface` provenance, plan §11).
 *   L6   idempotence — a repeat probe is a total no-op: no double
 *        dispose, no second telemetry, no attempt advance, no slot
 *        rewrite (plan §5.3).
 *   L7   recovery after confirmed loss — the cooldown blocks the SAME
 *        boundary; after it elapses, the next boundary's reconcile
 *        remounts a FRESH client instance (new fiber, tools restored,
 *        `reachable`, the witness re-seeded) and writes exactly ONE
 *        `mount-restored` telemetry (plan §4f / §11).
 *   L3   zero-tool — a server that never bore a tool (a zero-tool mount)
 *        degrades to `unknown` (observation unavailable) — NEVER a
 *        fabricated `unreachable`, never a retirement (plan §5.1-B).
 *   L4   policy deny — the allow → deny boundary is a policy-driven
 *        unmount: NO `capability-lost`, NO `MCP_PUBLIC_TOOL_SURFACE_WITHDRAWN`
 *        (plan §5.2 special test / §3.4).
 *   L5   teardown close — `close()` disposes the fiber with NO
 *        runtime-loss telemetry (plan §3.4).
 *   §9.5 multi-MCP isolation — a confirmed loss on one server leaves the
 *        other reachable and mounted (no cross-server contamination).
 *
 *   §9.2 static witness — the glue has exactly ONE production mcp mount
 *   call site and it passes the plugin-owned `MCP_UPSTREAM_RECONNECT_POLICY`
 *   (no drift, no second call site that forgets the policy).
 *
 * World notes: the t12a-live-bridge doubles — no real ports (the 3991+
 * band, the established unit-test fake-port band), no real mcp-client
 * (the fiber double's `withdrawTools()`/`swapTools()` model the
 * documented upstream supervisor effects at the public-seam level —
 * CORE PATCH BUDGET = 0). The `capabilityTelemetry` hook is the world's
 * recording stand-in for the production durable `capability-runtime-event`
 * write (the glue's `capabilityTelemetry` dep — a no-op when absent).
 *
 * @module @dsh-agent-team/runtime/test/f15-mcp-live-loss
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { scopeOf } from '@deepseek-ai/dsh-scope'
import { parseBlueprint } from '../../domain/blueprint/src/index.js'
import { parseGovernanceOverride, type GovernanceOverrideRecord } from '../../storage/schema/index.js'
import {
  createAgentPresetsDouble,
  createLiveWorld,
  type AgentCtxDouble,
} from './t12a-live-bridge.mjs'
import { createP6T6World } from '../../tools/test/p6t6-helpers.js'
import { destroyDir, scratchDir } from '../../testkit/fault-injection/file-seam.mjs'

// ── the durable mcp deny override (the L4 policy tighten — the same shape ───
// ── the mcp-blueprint-initial-grant B4 leg uses) ────────────────────────────
function teamMcpDeny(rootSessionId: string, recordId: string): GovernanceOverrideRecord {
  return parseGovernanceOverride({
    schemaVersion: 2,
    kind: 'human-override',
    recordId,
    scope: 'team',
    rootSessionId,
    values: { mcp: { kind: 'deny' } },
    generation: 1,
    updatedAt: '2026-09-20T00:00:00.000Z',
  })
}

// ── identities (doubles — no real ports; the 3991+ band is the unit-test ────
// ── fake-port band established by mcp-blueprint-initial-grant.test.ts) ─────
const WORLD_NAME = 'f15-mcp-live-loss'
const MAIN_ROOT = 'f15-main-root'
const MAIN_SERVER = 'mcp-f15-main'
const MAIN_TOOL = `mcp__${MAIN_SERVER}__ping`
const Z_ROOT = 'f15-z-root'
const Z_SERVER = 'mcp-f15-z'
const D_ROOT = 'f15-d-root'
const D_SERVER = 'mcp-f15-d'
const D_TOOL = `mcp__${D_SERVER}__ping`
const C_ROOT = 'f15-c-root'
const C_SERVER = 'mcp-f15-c'
const C_TOOL = `mcp__${C_SERVER}__ping`
const M_ROOT = 'f15-m-root'
const M_A = 'mcp-f15-a'
const M_A_TOOL = `mcp__${M_A}__ping`
const M_B = 'mcp-f15-b'
const M_B_TOOL = `mcp__${M_B}__alpha`

// ── shared team-tools substrate (one p6t6 world, many team worlds) ─────────
// Pre-create cleanup: a leftover world dir (a crashed previous run) would
// break createTeamDomain with TEAM_DOMAIN_EXISTS (the p7t7 pattern).
destroyDir(scratchDir(WORLD_NAME))
const p6t6 = await createP6T6World(WORLD_NAME)

// ── world factory ────────────────────────────────────────────────────────────
interface TelemetryEvent {
  readonly kind: string
  readonly capabilityType: string
  readonly capabilityName: string
  readonly verdict: string
  readonly source?: string
  readonly observedAt: string
  readonly attempt?: number
  readonly reason?: string
}
interface F15World {
  readonly world: Awaited<ReturnType<typeof createLiveWorld>>
  readonly events: TelemetryEvent[]
  readonly overrides: GovernanceOverrideRecord[]
}
function makeBlueprint(teamId: string, serverNames: readonly string[]): {
  doc: string
  ref: { blueprintId: string; revision: string; contentHash: string }
} {
  const items =
    serverNames.length === 0 ? '      items: []' : serverNames.map((n) => `        - ${n}`).join('\n')
  const doc = [
    '---',
    'schemaVersion: 1',
    `blueprintId: team.${teamId}`,
    'revision: "1"',
    'leader:',
    '  templateId: leader',
    `  persona: "You are the leader of the ${teamId} team."`,
    '  capabilities:',
    '    teamTools:',
    '      kind: deny',
    '    builtinToolDeny: []',
    '    skills:',
    '      kind: allow',
    '      items: []',
    '    mcp:',
    '      kind: allow',
    '      items:',
    items,
    'members: []',
    'requirements: []',
    'memberEnvelopes: []',
    'policyStates: []',
    'metadata: {}',
    '---',
    '',
  ].join('\n')
  const parsed = parseBlueprint(doc)
  return {
    doc,
    ref: { blueprintId: parsed.blueprintId, revision: parsed.revision, contentHash: parsed.contentHash },
  }
}
async function makeWorld(args: {
  teamId: string
  root: string
  servers: ReadonlyArray<{ name: string; port: number }>
  tools: Record<string, string[]>
}): Promise<F15World> {
  const bp = makeBlueprint(args.teamId, args.servers.map((s) => s.name))
  const overrides: GovernanceOverrideRecord[] = []
  const events: TelemetryEvent[] = []
  const world = await createLiveWorld({
    rootSessionId: args.root,
    teamTools: { tools: p6t6.tools },
    agentPresets: createAgentPresetsDouble(),
    teamSessions: [
      {
        rootSessionId: args.root,
        sessionId: args.root,
        blueprintId: bp.ref.blueprintId,
        generation: 1,
        blueprint: bp.ref,
      },
    ],
    blueprintSources: [
      { blueprintId: bp.ref.blueprintId, revision: bp.ref.revision, source: bp.doc },
    ],
    mcpToolNames: args.tools,
    overrides,
    configOverrides: {
      mcpServer: null,
      mcpServers: args.servers.map((s) => ({ name: s.name, port: s.port })),
      blueprintSource: bp.doc,
    },
    // The recording stand-in for the production durable
    // capability-runtime-event write (the glue's capabilityTelemetry dep).
    capabilityTelemetry: (_rootSessionId: string, event: TelemetryEvent) => {
      events.push(event)
    },
  })
  await world.binding.boot()
  return { world, events, overrides }
}

// ── state access helpers (the consumption state is a plain record) ──────────
interface F15FiberDouble {
  disposed: boolean
  disposeCount: number
  options?: { reconnect?: unknown }
  withdrawTools?: () => void
  swapTools?: (names: string[]) => void
}
interface F15Slot {
  status: string
  attempts?: number
  lastAttemptAt?: number
  reason?: string
}
interface F15StateShape {
  readonly mcpFibers?: Map<string, F15FiberDouble>
  readonly mcpMaterialization?: Map<string, F15Slot>
  readonly mcpViews?: Record<string, { allowed?: boolean }>
  readonly mcpToolWitness?: Map<string, { everToolBearing: boolean; lastObservedNames: string[] }>
  readonly mcpMountCtx?: AgentCtxDouble & { readonly root?: unknown }
}
function f15State(binding: object, sessionId: string): F15StateShape | undefined {
  const get = (binding as { getConsumptionState?: (sid: string) => unknown }).getConsumptionState
  return get === undefined ? undefined : (get.call(binding, sessionId) as F15StateShape | undefined)
}
/** The agent-scoped public tool surface, filtered to one server's
 *  `mcp__<serverName>__*` names (the public-seam observation the witness
 *  consumes — plan §5/§7). */
function serverToolSurface(state: F15StateShape | undefined, serverName: string): string[] {
  const ctx = state?.mcpMountCtx
  if (ctx === undefined || ctx === null || typeof ctx.tools?.schemas !== 'function') return []
  const scope = scopeOf(ctx as never) ?? (ctx as { root?: unknown }).root
  const schemas = (ctx.tools as { schemas: (s?: unknown) => Array<{ name: string }> }).schemas(scope)
  return schemas.map((t) => t.name).filter((n) => n.startsWith(`mcp__${serverName}__`))
}
async function witnessOf(binding: object, root: string, serverName: string) {
  return (binding as {
    observeMcpOperationalWitness: (sid: string, name: string) => Promise<{
      verdict: 'unknown' | 'reachable' | 'unreachable'
      reason?: string
      confirmedLoss?: boolean
    }>
  }).observeMcpOperationalWitness(root, serverName)
}

// ── World MAIN: the L1 → §9.4 → L2 → L6 → L7 story arc (one world) ──────────
const main = await makeWorld({
  teamId: 'f15main',
  root: MAIN_ROOT,
  servers: [{ name: MAIN_SERVER, port: 3991 }],
  tools: { [MAIN_SERVER]: [MAIN_TOOL] },
})
const mainBinding = main.world.binding
const mainFiberAtMount = f15State(mainBinding, MAIN_ROOT)!.mcpFibers!.get(MAIN_SERVER)!

// ── the isolated worlds (one concern each) ──────────────────────────────────
const zeroWorld = await makeWorld({
  teamId: 'f15zero',
  root: Z_ROOT,
  servers: [{ name: Z_SERVER, port: 3994 }],
  tools: { [Z_SERVER]: [] }, // a zero-tool server (L3)
})
const denyWorld = await makeWorld({
  teamId: 'f15deny',
  root: D_ROOT,
  servers: [{ name: D_SERVER, port: 3995 }],
  tools: { [D_SERVER]: [D_TOOL] },
})
const closeWorld = await makeWorld({
  teamId: 'f15close',
  root: C_ROOT,
  servers: [{ name: C_SERVER, port: 3996 }],
  tools: { [C_SERVER]: [C_TOOL] },
})
const multiWorld = await makeWorld({
  teamId: 'f15multi',
  root: M_ROOT,
  servers: [
    { name: M_A, port: 3992 },
    { name: M_B, port: 3993 },
  ],
  tools: { [M_A]: [M_A_TOOL], [M_B]: [M_B_TOOL] },
})

describe('F15 §9 — the MCP live-loss unit matrix (plan §9.3/§9.4/§9.5/§11)', () => {
  it('L1 (normal): the mounted fiber with its live tool surface is reachable — and the live mount carries the explicit short reconnect policy (the §9.2 behavior witness)', async () => {
    const st = f15State(mainBinding, MAIN_ROOT)!
    expect(mainFiberAtMount.disposed).toBe(false)
    expect(mainFiberAtMount.disposeCount).toBe(0)
    expect(serverToolSurface(st, MAIN_SERVER)).toEqual([MAIN_TOOL])
    expect(st.mcpViews?.[MAIN_SERVER]?.allowed).toBe(true)
    // §9.2 behavior witness: the double records the config the glue passed
    // VERBATIM — every production mount carries the explicit policy (the
    // 0.1.7 defaults are never relied on, plan §5.1-A).
    expect(mainFiberAtMount.options).toBeDefined()
    expect(mainFiberAtMount.options?.reconnect).toEqual({
      enabled: true,
      initialDelayMs: 500,
      maxDelayMs: 2_000,
      maxAttempts: 3,
    })
    const w = await witnessOf(mainBinding, MAIN_ROOT, MAIN_SERVER)
    expect(w.verdict).toBe('reachable')
    expect(w.confirmedLoss).toBeFalsy()
    // the ephemeral witness record was seeded tool-bearing at the mount
    expect(st.mcpToolWitness?.get(MAIN_SERVER)).toEqual({
      everToolBearing: true,
      lastObservedNames: [MAIN_TOOL],
    })
    // no telemetry on the normal path
    expect(main.events).toEqual([])
  })

  it('§9.4 (re-sync transient): a successful tool-generation swap is NOT a loss — the pull-probe after the swap sees the new non-empty surface, no telemetry, no retirement', async () => {
    const st = f15State(mainBinding, MAIN_ROOT)!
    const fiber = st.mcpFibers!.get(MAIN_SERVER)!
    // The upstream `syncTools()` generation swap (plan §7): dispose the
    // previous registrations, register the new generation — the tool list
    // CHANGES (ping -> pong); the handle stays live.
    fiber.swapTools!([`mcp__${MAIN_SERVER}__pong`])
    expect(serverToolSurface(st, MAIN_SERVER)).toEqual([`mcp__${MAIN_SERVER}__pong`])
    expect(fiber.disposed).toBe(false)
    expect(fiber.disposeCount).toBe(0)
    const w = await witnessOf(mainBinding, MAIN_ROOT, MAIN_SERVER)
    expect(
      w.verdict,
      'a successful re-sync with a non-empty final surface must stay reachable (MUST NOT classify as capability loss)',
    ).toBe('reachable')
    expect(w.confirmedLoss).toBeFalsy()
    // the witness record tracks the new generation
    expect(st.mcpToolWitness?.get(MAIN_SERVER)).toEqual({
      everToolBearing: true,
      lastObservedNames: [`mcp__${MAIN_SERVER}__pong`],
    })
    // no telemetry from the re-sync
    expect(main.events).toEqual([])
  })

  it('L2 (permanent loss): the withdrawn tool surface is a CONFIRMED LOSS — unreachable + the exhausted fiber retired in the same step + exactly one capability-lost telemetry (mcp-public-tool-surface provenance)', async () => {
    const st = f15State(mainBinding, MAIN_ROOT)!
    const fiber = st.mcpFibers!.get(MAIN_SERVER)!
    // THE WITHDRAWAL (the public-seam model of the upstream
    // post-budget-exhaustion supervisor — connection.d.ts: "Exhaustion
    // unregisters the server's tools and stops; disposal … is the only
    // way back"): the tools leave the agent scope; the handle stays.
    fiber.withdrawTools!()
    expect(fiber.disposed, 'the withdrawal must NOT dispose the fiber (the upstream handle survives)').toBe(false)
    expect(st.mcpFibers!.has(MAIN_SERVER), 'before the probe the fiber record is still live').toBe(true)
    expect(serverToolSurface(st, MAIN_SERVER)).toEqual([])

    const w = await witnessOf(mainBinding, MAIN_ROOT, MAIN_SERVER)
    expect(w.verdict, 'a previously tool-bearing server whose public surface is withdrawn is UNREACHABLE (never the fiber-presence reachable)').toBe('unreachable')
    expect(w.confirmedLoss).toBe(true)
    expect(w.reason).toBe('MCP_PUBLIC_TOOL_SURFACE_WITHDRAWN')

    // The retirement ran in the SAME owned step (plan §5.3 — the
    // requirement gate of the same boundary sees the failed slot):
    expect(st.mcpFibers!.has(MAIN_SERVER), 'the exhausted fiber must be deleted from the live set').toBe(false)
    expect(fiber.disposed).toBe(true)
    expect(fiber.disposeCount).toBe(1)
    const slot = st.mcpMaterialization!.get(MAIN_SERVER)!
    expect(slot.status).toBe('failed')
    expect(
      slot.attempts,
      'the failed slot keeps the mount attempt (retirement NEVER advances the attempt counter)',
    ).toBe(1)
    expect(slot.reason).toBe('MCP_PUBLIC_TOOL_SURFACE_WITHDRAWN')
    expect(typeof slot.lastAttemptAt).toBe('number')
    // lastAttemptAt = now: the existing 30 s retry cooldown blocks a
    // same-boundary remount (asserted in L7a).
    expect(slot.lastAttemptAt!).toBeLessThanOrEqual(Date.now())
    expect(slot.lastAttemptAt!).toBeGreaterThan(Date.now() - 5_000)
    // the witness record drops with the fiber (a fresh remount re-seeds it)
    expect(st.mcpToolWitness?.has(MAIN_SERVER)).toBe(false)
    // §11: confirmed loss EXACTLY ONCE, mcp-public-tool-surface provenance.
    expect(main.events, 'exactly one durable loss telemetry').toHaveLength(1)
    expect(main.events[0]).toMatchObject({
      kind: 'capability-lost',
      capabilityType: 'mcpServer',
      capabilityName: MAIN_SERVER,
      verdict: 'unreachable',
      source: 'mcp-public-tool-surface',
      reason: 'MCP_PUBLIC_TOOL_SURFACE_WITHDRAWN',
      attempt: 1,
    })
  })

  it('L6 (idempotence): a repeat probe is a total no-op — no double dispose, no second telemetry, no attempt advance, no slot rewrite (plan §5.3)', async () => {
    const st = f15State(mainBinding, MAIN_ROOT)!
    const slotBefore = st.mcpMaterialization!.get(MAIN_SERVER)!
    const lastBefore = slotBefore.lastAttemptAt!
    const w = await witnessOf(mainBinding, MAIN_ROOT, MAIN_SERVER)
    // No live fiber in this session anymore: the witness DEFERS (unknown +
    // the unavailable reason) — the probe port folds the failed slot into
    // the legacy unreachable path.
    expect(w).toEqual({ verdict: 'unknown', reason: 'MCP_LIVE_WITNESS_UNAVAILABLE' })
    expect(w.confirmedLoss).toBeFalsy()
    // IDEMPOTENT: the retirement is a no-op on the repeat call.
    expect(mainFiberAtMount.disposeCount, 'no double dispose').toBe(1)
    expect(mainFiberAtMount.disposed).toBe(true)
    expect(main.events, 'no second capability-lost').toHaveLength(1)
    const slot = st.mcpMaterialization!.get(MAIN_SERVER)!
    expect(slot.attempts, 'no attempt advance').toBe(1)
    expect(slot.lastAttemptAt, 'no slot rewrite').toBe(lastBefore)
  })

  it('L7 (recovery after confirmed loss): the cooldown blocks the SAME boundary; after it elapses the next boundary remounts a FRESH instance — tools restored, reachable, exactly one mount-restored', async () => {
    const st = f15State(mainBinding, MAIN_ROOT)!
    // (a) SAME boundary: the 30 s retry cooldown (slot.lastAttemptAt = now
    //     from the retirement) blocks the remount — the failure is not
    //     "washed away" by an immediate fresh mount (plan §5.3).
    await mainBinding.prepareAgentForRequest(MAIN_ROOT, MAIN_ROOT)
    expect(st.mcpFibers!.has(MAIN_SERVER), 'the same boundary must NOT remount (cooldown)').toBe(false)
    let slot = st.mcpMaterialization!.get(MAIN_SERVER)!
    expect(slot.status).toBe('failed')
    expect(slot.attempts).toBe(1)

    // (b) COOLDOWN ELAPSED (state manipulation — the plugin's own ephemeral
    //     slot; the real wall-clock elapse is the kit's R3 leg): the next
    //     boundary's reconcile remounts.
    slot.lastAttemptAt = Date.now() - 31_000
    await mainBinding.prepareAgentForRequest(MAIN_ROOT, MAIN_ROOT)
    const fresh = st.mcpFibers!.get(MAIN_SERVER)
    expect(fresh, 'the fresh remount must re-mount the fiber').toBeDefined()
    expect(fresh, 'the remount is a NEW client instance (the exhausted fiber was disposed)').not.toBe(mainFiberAtMount)
    expect(fresh!.disposed).toBe(false)
    expect(fresh!.disposeCount).toBe(0)
    // the fresh mount carries the policy too (every production mount)
    expect(fresh!.options?.reconnect).toEqual({
      enabled: true,
      initialDelayMs: 500,
      maxDelayMs: 2_000,
      maxAttempts: 3,
    })
    slot = st.mcpMaterialization!.get(MAIN_SERVER)!
    expect(slot.status).toBe('mounted')
    expect(slot.attempts, 'the remount is attempt 2 (the counter advanced exactly once on the MOUNT, not on the retirement)').toBe(2)
    // tools restored on the agent scope (the gate re-opens at the next
    // boundary — the gate-level half is the kit's R3 leg)
    expect(serverToolSurface(st, MAIN_SERVER)).toEqual([MAIN_TOOL])
    // the witness record was re-seeded by the fresh mount
    expect(st.mcpToolWitness?.get(MAIN_SERVER)).toEqual({
      everToolBearing: true,
      lastObservedNames: [MAIN_TOOL],
    })
    const w = await witnessOf(mainBinding, MAIN_ROOT, MAIN_SERVER)
    expect(w.verdict).toBe('reachable')
    expect(w.confirmedLoss).toBeFalsy()
    // §11: fresh remount recovery EXACTLY ONCE (the existing failed ->
    // mounted transition emit — the C.10 restore path).
    expect(main.events.map((e) => e.kind)).toEqual(['capability-lost', 'mount-restored'])
    expect(main.events[1]).toMatchObject({
      kind: 'mount-restored',
      capabilityName: MAIN_SERVER,
      verdict: 'reachable',
      source: 'mcp-fiber',
      attempt: 2,
    })
  })

  it('L3 (zero-tool): a server that never bore a tool degrades to unknown — NEVER a fabricated unreachable, never a retirement (plan §5.1-B)', async () => {
    const binding = zeroWorld.world.binding
    const st = f15State(binding, Z_ROOT)!
    const fiber = st.mcpFibers!.get(Z_SERVER)
    expect(fiber, 'the zero-tool server mounts cleanly (no startup error)').toBeDefined()
    expect(fiber!.disposed).toBe(false)
    expect(fiber!.disposeCount).toBe(0)
    expect(serverToolSurface(st, Z_SERVER), 'the surface is empty from the first observation').toEqual([])
    const w = await witnessOf(binding, Z_ROOT, Z_SERVER)
    expect(
      w.verdict,
      'a zero-tool server is observation-unavailable (unknown) — the live-loss capability degrades explicitly, never a fabricated unreachable',
    ).toBe('unknown')
    expect(w.reason).toBe('MCP_LIVE_WITNESS_UNAVAILABLE')
    expect(w.confirmedLoss).toBeFalsy()
    expect(st.mcpFibers!.has(Z_SERVER), 'no retirement of a zero-tool server').toBe(true)
    expect(fiber!.disposeCount).toBe(0)
    expect(st.mcpToolWitness?.get(Z_SERVER)).toEqual({ everToolBearing: false, lastObservedNames: [] })
    // stable across repeat observations
    const w2 = await witnessOf(binding, Z_ROOT, Z_SERVER)
    expect(w2.verdict).toBe('unknown')
    expect(zeroWorld.events).toEqual([])
  })

  it('L4 (policy deny): the allow -> deny boundary is a policy-driven unmount — NO capability-lost, NO mount-failed, NO MCP_PUBLIC_TOOL_SURFACE_WITHDRAWN (plan §5.2 special test)', async () => {
    const binding = denyWorld.world.binding
    const st = f15State(binding, D_ROOT)!
    const fiber = st.mcpFibers!.get(D_SERVER)!
    expect(fiber.disposeCount).toBe(0)
    const w0 = await witnessOf(binding, D_ROOT, D_SERVER)
    expect(w0.verdict).toBe('reachable') // the pre-deny baseline
    // THE DURABLE DENY (the mutable override array the domain double re-reads
    // on every boundary — the B4 tighten pattern).
    denyWorld.overrides.push(teamMcpDeny(D_ROOT, 'f15-deny-1'))
    await binding.prepareAgentForRequest(D_ROOT, D_ROOT)
    // policy-driven unmount (the deny-first reconcile path):
    expect(fiber.disposed, 'the deny disposes the fiber').toBe(true)
    expect(fiber.disposeCount).toBe(1)
    expect(st.mcpFibers!.has(D_SERVER)).toBe(false)
    expect(st.mcpViews?.[D_SERVER]?.allowed, 'the last-applied view records the denial').toBe(false)
    // NO runtime-loss telemetry from the intentional removal:
    expect(denyWorld.events, 'the policy deny produces ZERO capability telemetry').toEqual([])
    const obs = (binding as { observations: readonly string[] }).observations.join('\n')
    expect(obs).not.toContain('mcp fiber retired')
    expect(obs).not.toContain('MCP_PUBLIC_TOOL_SURFACE_WITHDRAWN')
    // a later probe of the denied server defers (unknown) — never unreachable:
    const w1 = await witnessOf(binding, D_ROOT, D_SERVER)
    expect(w1).toEqual({ verdict: 'unknown', reason: 'MCP_LIVE_WITNESS_UNAVAILABLE' })
    expect(denyWorld.events).toEqual([])
  })

  it('L5 (teardown close): close() disposes the fiber with NO runtime-loss telemetry (plan §3.4)', async () => {
    const binding = closeWorld.world.binding
    const st = f15State(binding, C_ROOT)!
    const fiber = st.mcpFibers!.get(C_SERVER)!
    const w0 = await witnessOf(binding, C_ROOT, C_SERVER)
    expect(w0.verdict).toBe('reachable') // the pre-close baseline
    await binding.close()
    expect(fiber.disposed, 'close disposes the fiber (the row stop)').toBe(true)
    expect(fiber.disposeCount).toBe(1)
    expect(st.mcpFibers!.size, 'the fiber map is cleared with the state teardown').toBe(0)
    expect(closeWorld.events, 'the row stop produces ZERO runtime-loss telemetry').toEqual([])
    // a post-close probe defers — never unreachable, never telemetry:
    const w1 = await witnessOf(binding, C_ROOT, C_SERVER)
    expect(w1.verdict).toBe('unknown')
    expect(closeWorld.events).toEqual([])
  })

  it('§9.5 (multi-MCP isolation): a confirmed loss on one server leaves the other reachable and mounted (no cross-server contamination)', async () => {
    const binding = multiWorld.world.binding
    const st = f15State(binding, M_ROOT)!
    const fiberA = st.mcpFibers!.get(M_A)!
    const fiberB = st.mcpFibers!.get(M_B)!
    expect(serverToolSurface(st, M_A)).toEqual([M_A_TOOL])
    expect(serverToolSurface(st, M_B)).toEqual([M_B_TOOL])
    // THE CONFIRMED LOSS on A only:
    fiberA.withdrawTools!()
    const wA = await witnessOf(binding, M_ROOT, M_A)
    expect(wA.verdict).toBe('unreachable')
    expect(wA.confirmedLoss).toBe(true)
    expect(fiberA.disposed).toBe(true)
    expect(fiberA.disposeCount).toBe(1)
    expect(st.mcpFibers!.has(M_A)).toBe(false)
    // B is untouched — reachable, mounted, live handle:
    const wB = await witnessOf(binding, M_ROOT, M_B)
    expect(wB.verdict, 'the healthy sibling server stays reachable').toBe('reachable')
    expect(wB.confirmedLoss).toBeFalsy()
    expect(fiberB.disposed).toBe(false)
    expect(fiberB.disposeCount).toBe(0)
    expect(st.mcpFibers!.has(M_B)).toBe(true)
    expect(serverToolSurface(st, M_B)).toEqual([M_B_TOOL])
    expect(st.mcpMaterialization!.get(M_B)!.status).toBe('mounted')
    // telemetry: exactly one loss event, for A only.
    expect(multiWorld.events).toHaveLength(1)
    expect(multiWorld.events[0]!.capabilityName).toBe(M_A)
    expect(multiWorld.events[0]!.kind).toBe('capability-lost')
  })
})

// ── §9.2 static witness — every production mount carries the policy ─────────
describe('F15 §9.2 — the static call-site witness (the explicit short reconnect policy)', () => {
  const glueSource = readFileSync(
    fileURLToPath(new URL('../src/plugin/live/agent-bindings.mjs', import.meta.url).href),
    'utf8',
  )

  it('the glue has exactly ONE production mcp mount call site and it passes MCP_UPSTREAM_RECONNECT_POLICY (no drift, no forgotten second site)', () => {
    const callSites = glueSource.match(/state\.mcpMountCtx\.plugin\(mcpClient,/g) ?? []
    expect(callSites, 'exactly one production mount call site in the glue').toHaveLength(1)
    // the policy is composed from the plugin-owned constants (plan §5.1-A):
    expect(glueSource).toContain('const MCP_UPSTREAM_RECONNECT_INITIAL_MS = 500')
    expect(glueSource).toContain('const MCP_UPSTREAM_RECONNECT_MAX_MS = 2_000')
    expect(glueSource).toContain('const MCP_UPSTREAM_RECONNECT_ATTEMPTS = 3')
    expect(glueSource).toContain('initialDelayMs: MCP_UPSTREAM_RECONNECT_INITIAL_MS,')
    expect(glueSource).toContain('maxDelayMs: MCP_UPSTREAM_RECONNECT_MAX_MS,')
    expect(glueSource).toContain('maxAttempts: MCP_UPSTREAM_RECONNECT_ATTEMPTS,')
    // …and the single call site passes the policy (the behavior half is
    // the L1/L7 assertion on the double's recorded options).
    const siteIdx = glueSource.indexOf('state.mcpMountCtx.plugin(mcpClient,')
    const site = glueSource.slice(siteIdx, siteIdx + 700)
    expect(site, 'the mount call site carries the explicit reconnect policy').toContain('reconnect: MCP_UPSTREAM_RECONNECT_POLICY,')
  })
})
