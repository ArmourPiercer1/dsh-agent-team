/**
 * F15 — MCP live-loss zero-core upgrade: the CHARACTERIZATION (RED) suite.
 *
 * Plan: docs/plans/active/pre-alpha3-F15-MCP-live-loss-zero-core-upgrade-plan.md
 * (§0 verdict, §2 upstream public behaviors, §5 witness/retirement, §7 V1
 * authority, §9 test matrix).
 *
 * THE GAP THIS SUITE CHARACTERIZES (plan §0/§1):
 *
 *   The production MCP readiness probe (host.ts `capabilityReadiness`,
 *   the `mcpServer` probe port) classifies a named MCP server
 *   `reachable` when ANY live session carries a LIVE FIBER for it —
 *   fiber presence alone. But the upstream 0.1.7-rc.1 mcp-client
 *   connection supervisor (public contract,
 *   tests/deepseek-harness-test-use/packages/mcp/mcp-client/lib/types/
 *   connection.d.ts) documents the post-budget-exhaustion behavior:
 *
 *     "One outage shares one attempt budget (maxAttempts consecutive
 *      failed attempts, delays doubling from initialDelayMs up to
 *      maxDelayMs). … Exhaustion unregisters the server's tools and
 *      stops; disposal (including HMR) is the only way back from that
 *      state."
 *
 *   i.e. a PERMANENTLY lost MCP server (the reconnect budget exhausted
 *   upstream) leaves its fiber/handle LIVE while its public tool
 *   surface (`mcp__<serverName>__*` on the agent scope) is WITHDRAWN.
 *   The fiber-presence probe keeps answering `reachable` on that dead
 *   capability: a stale positive. The requirement gate (which runs
 *   BEFORE the boundary reconcile, so no boundary-observed witness can
 *   catch it in time) then admits requests that must be BLOCKED — and
 *   no code path ever retires the exhausted fiber, so the server stays
 *   a permanent dead slot (never re-mOUNTed, because the cooldown
 *   machinery only retries `failed` slots, and nothing marks it
 *   `failed`).
 *
 * HOW THE WITHDRAWAL IS TRIGGERED HERE (public-seam level, CORE PATCH
 * BUDGET = 0): the t12a-live-bridge agents double gains a
 * `withdrawTools()` method on its MCP fiber record (this file's world
 * reads the fiber from the live consumption state and triggers it). It
 * models EXACTLY the documented upstream exhaustion effect at the
 * public-seam level — the server's tools disappear from the agent
 * scope while the handle stays live. It is NOT a mock fiber deletion:
 * the fiber record remains in `state.mcpFibers`, `disposed` stays
 * false, and `disposeCount` stays 0 (asserted below).
 *
 * RED CONTRACT (the TDD arc of this task):
 *
 *   - The EVIDENCE `it` passes TODAY (commit 1) and KEEPS passing after
 *     the product closure (commit 2): it documents the gap using a
 *     frozen re-implementation of the pre-upgrade probe semantics
 *     (the `legacyFiberPresenceProbeOracle`), which is a pure
 *     function of the state shape and therefore independent of the
 *     product behavior it characterizes.
 *   - The RED `it` FAILS TODAY: the post-upgrade public witness seam
 *     (`observeMcpOperationalWitness` on the live bundle, consumed by
 *     the host probe port per plan §6) does not exist yet, and even
 *     where it does, the fiber-presence classification must be
 *     REPLACED by the public-tool-surface witness (plan §7 V1: the
 *     boundary pull-probe is the authority; `tools/change` is only a
 *     dirty/recheck signal, never a classifier).
 *
 *   Commit 2 lands the product closure (plan §4-§8); THIS SAME FILE
 *   then goes green — the red→green arc is the acceptance of the
 *   characterization. The §9 L1–L7 legs (plus §9.4 re-sync and §9.5
 *   multi-MCP isolation) live in the companion suite
 *   `f15-mcp-live-loss.test.ts` (commit 2).
 *
 * @module @dsh-agent-team/runtime/test/f15-mcp-live-loss-characterization
 */
import { describe, expect, it } from 'vitest'
import { scopeOf } from '@deepseek-ai/dsh-scope'
import { parseBlueprint } from '../../domain/blueprint/src/index.js'
import {
  createAgentPresetsDouble,
  createLiveWorld,
  type AgentCtxDouble,
} from './t12a-live-bridge.mjs'
import { createP6T6World } from '../../tools/test/p6t6-helpers.js'
import { destroyDir, scratchDir } from '../../testkit/fault-injection/file-seam.mjs'

// ── identities (doubles — no real ports; the 3991 band is the unit-test ────
// ── fake-port band established by mcp-blueprint-initial-grant.test.ts) ─────
const F15_ROOT = 'f15-char-root'
const F15_SERVER = 'mcp-f15'
const F15_TOOL = 'mcp__mcp-f15__ping'
const F15_PORT = 3991
const F15_PREFIX = `mcp__${F15_SERVER}__`

// ── the world (blueprint mcp allow [F15_SERVER]; zero overrides) ────────────
// Pre-create cleanup: a leftover world dir (a crashed previous run) would
// break createTeamDomain with TEAM_DOMAIN_EXISTS (the p7t7 pattern).
destroyDir(scratchDir('f15-mcp-live-loss-characterization'))
const p6t6 = await createP6T6World('f15-mcp-live-loss-characterization')

// A4-PR7 §7.4 (lane B-runtime-semantics-A): this fixture document rides the
// supported version, and the two envelope documents that version REQUIRES are
// declared — in their zero form `rules: []`, which is a POSITION: on the
// expansion plane a no-match answers `no-authority` (the document claims no
// expansion authority for its Leader), on the approval plane a no-match is
// identity (it removes no rung). The zeros are honest here rather than
// convenient: this world is built root-direct, and the only production producer
// of `permissionAuthorityCeiling` is the plugin host, so no ceiling reader ever
// consults these documents. (The same disposition covers every document below.)
const F15_BLUEPRINT = [
  '---',
  'schemaVersion: 3',
  'blueprintId: team.f15',
  'revision: "1"',
  'leader:',
  '  templateId: leader',
  '  persona: "You are the leader of the f15 characterization team."',
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
  `        - ${F15_SERVER}`,
  'members: []',
  'requirements: []',
  'memberEnvelopes: []',
  'policyStates: []',
  'metadata: {}',
  'permissionMutationEnvelope:',
  '  rules: []',
  'teamHardEnvelope:',
  '  rules: []',
  '---',
  '',
].join('\n')

// The bound snapshot ref (the BP6 chain: the row's blueprint field must
// parse to the same contentHash — the bridge resolver verifies).
const F15_REF = (() => {
  const parsed = parseBlueprint(F15_BLUEPRINT)
  return { blueprintId: parsed.blueprintId, revision: parsed.revision, contentHash: parsed.contentHash }
})()

const world = await createLiveWorld({
  rootSessionId: F15_ROOT,
  teamTools: { tools: p6t6.tools },
  agentPresets: createAgentPresetsDouble(),
  teamSessions: [
    {
      rootSessionId: F15_ROOT,
      sessionId: F15_ROOT,
      blueprintId: F15_REF.blueprintId,
      generation: 1,
      blueprint: F15_REF,
    },
  ],
  blueprintSources: [
    { blueprintId: F15_REF.blueprintId, revision: F15_REF.revision, source: F15_BLUEPRINT },
  ],
  mcpToolNames: { [F15_SERVER]: [F15_TOOL] },
  configOverrides: {
    mcpServer: null,
    mcpServers: [{ name: F15_SERVER, port: F15_PORT }],
    blueprintSource: F15_BLUEPRINT,
  },
})
await world.binding.boot()

// ── state access helpers (the consumption state is a plain record) ─────────
interface McpFiberDouble {
  disposed: boolean
  disposeCount: number
  withdrawnToolCount?: number
  withdrawTools?: () => void
}
interface F15StateShape {
  readonly mcpFibers?: Map<string, unknown>
  readonly mcpMaterialization?: Map<string, { readonly status: string; readonly reason?: string }>
  readonly mcpViews?: Record<string, { allowed?: boolean }>
  readonly mcpMountCtx?: AgentCtxDouble & { readonly root?: unknown }
}
function f15State(sessionId: string): F15StateShape | undefined {
  const get = (world.binding as { getConsumptionState?: (sid: string) => unknown }).getConsumptionState
  return get === undefined ? undefined : (get.call(world.binding, sessionId) as F15StateShape | undefined)
}

/** The agent-scoped public tool surface of the MCP mount ctx, filtered to
 *  one server's `mcp__<serverName>__*` names (the public-seam observation
 *  the F15 witness consumes — plan §5/§7). */
function serverToolSurface(state: F15StateShape): string[] {
  const ctx = state.mcpMountCtx
  if (ctx === undefined || ctx === null || typeof ctx.tools?.schemas !== 'function') return []
  const scope = scopeOf(ctx as never) ?? (ctx as { root?: unknown }).root
  const schemas = (ctx.tools as { schemas: (s?: unknown) => Array<{ name: string }> }).schemas(scope)
  return schemas.map((t) => t.name).filter((n) => n.startsWith(F15_PREFIX))
}

/**
 * THE GAP ORACLE — a frozen re-implementation of the PRE-UPGRADE
 * production probe semantics (host.ts `capabilityReadiness`, the
 * `mcpServer` probe port, the code block this task replaces):
 *
 *   fiber present on any live session  -> `reachable`
 *   else a failed materialization slot -> `unreachable`
 *   else                               -> `unknown`
 *
 * It is a pure function of the consumption-state shape (never of the
 * product behavior), so it keeps answering `reachable` on the
 * post-withdrawal world FOREVER — the stale positive, documented.
 */
function legacyFiberPresenceProbeOracle(states: Array<F15StateShape | undefined>, name: string): 'unknown' | 'reachable' | 'unreachable' {
  let mountFailed = false
  for (const state of states) {
    if (state === undefined || state === null) continue
    if (state.mcpFibers !== undefined && state.mcpFibers.has(name)) {
      return 'reachable'
    }
    const slot = state.mcpMaterialization?.get(name)
    if (slot !== undefined && slot.status === 'failed') {
      mountFailed = true
    }
  }
  return mountFailed ? 'unreachable' : 'unknown'
}

// ── the mount (L1 normal path: the initial grant mounts the fiber and ──────
// ── registers its tool on the agent scope — the pre-loss baseline) ─────────
const stateAtMount = f15State(F15_ROOT)
const fiberAtMount = stateAtMount?.mcpFibers?.get(F15_SERVER) as McpFiberDouble | undefined
const surfaceAtMount = serverToolSurface(stateAtMount ?? {})

describe('F15 characterization — the MCP live-loss gap (plan §0/§1)', () => {
  it('EVIDENCE: mounted fiber + live tool surface, then the upstream post-budget-exhaustion withdrawal keeps the FIBER while withdrawing the SURFACE — and the legacy fiber-presence probe still says reachable (the stale positive)', () => {
    // L1 baseline: the initial grant mounted the fiber with its tool.
    expect(fiberAtMount, 'the MCP fiber must be mounted at boot (L1 baseline)').toBeDefined()
    expect(fiberAtMount!.disposed).toBe(false)
    expect(fiberAtMount!.disposeCount).toBe(0)
    expect(surfaceAtMount).toEqual([F15_TOOL])
    expect(stateAtMount!.mcpViews?.[F15_SERVER]?.allowed).toBe(true)

    // THE WITHDRAWAL (the public-seam model of the upstream
    // post-budget-exhaustion supervisor — connection.d.ts: "Exhaustion
    // unregisters the server's tools and stops; disposal … is the only
    // way back"): the tools leave the agent scope; the handle stays.
    expect(typeof fiberAtMount!.withdrawTools, 'the bridge double fiber must expose the F15 withdrawal trigger').toBe('function')
    fiberAtMount!.withdrawTools!()

    // Evidence 1 — the handle survives (this is the upstream behavior,
    // not a mock artifact: no dispose happened).
    expect(fiberAtMount!.disposed, 'withdrawal must NOT dispose the fiber').toBe(false)
    expect(fiberAtMount!.disposeCount, 'withdrawal must NOT count as a dispose').toBe(0)
    expect(f15State(F15_ROOT)?.mcpFibers?.has(F15_SERVER), 'the fiber record must REMAIN in the live state').toBe(true)

    // Evidence 2 — the public tool surface is withdrawn.
    expect(serverToolSurface(f15State(F15_ROOT)!), 'the server tool surface must be empty after the withdrawal').toEqual([])

    // Evidence 3 — THE GAP: the pre-upgrade probe semantics (the frozen
    // oracle of host.ts's current probe port) still classify the
    // server `reachable` on the withdrawn capability.
    const legacyVerdict = legacyFiberPresenceProbeOracle([f15State(F15_ROOT)], F15_SERVER)
    expect(
      legacyVerdict,
      'the legacy fiber-presence probe is a STALE POSITIVE: fiber present -> reachable, despite the withdrawn tool surface',
    ).toBe('reachable')
  })

  it('RED: the post-upgrade public witness seam (plan §5/§6/§7) must classify the withdrawn capability `unreachable` with a confirmed-loss mark — the seam does not exist on this (pre-closure) glue, so this assertion fails by design at commit 1 and goes green with the commit-2 product closure', async () => {
    const binding = world.binding as Record<string, unknown>
    const witnessFn = binding.observeMcpOperationalWitness as
      | ((sessionId: string, serverName: string) => Promise<{
          verdict: 'unknown' | 'reachable' | 'unreachable'
          reason?: string
          confirmedLoss?: boolean
        }>)
      | undefined
    expect(
      typeof witnessFn,
      'F15 post-upgrade witness seam observeMcpOperationalWitness(sessionId, serverName) is ABSENT on the live bundle — the confirmed-loss classification (plan §5) has not landed (RED at commit 1)',
    ).toBe('function')
    const witness = await witnessFn!(F15_ROOT, F15_SERVER)
    expect(witness.verdict, 'a previously tool-bearing server whose public tool surface is withdrawn is a CONFIRMED LOSS — the readiness verdict must be unreachable (never the fiber-presence reachable)').toBe('unreachable')
    expect(witness.confirmedLoss, 'the confirmed-loss mark must ride the observation (the probe port retires the exhausted fiber exactly once)').toBe(true)
  })
})
