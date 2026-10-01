/**
 * pre-alpha3 PR-E / review fix F1 — the live-MCP-state → probe port →
 * requirement-fact path END TO END (guide §2.3 data flow).
 *
 * This test composes the PRODUCTION pieces over a fake glue state: the
 * `createCapabilityReadinessProvider` (the #40 single probe surface) with a
 * real `mcpServer` probe port reading the glue's ephemeral live MCP state
 * (the per-session fibers + the isolated failure slots — NEVER the durable
 * `capability-runtime-event` telemetry), feeding the
 * `RuntimeRequirementFactsProvider` that resolves the bound requirements.
 *
 * The chain under test:
 *
 * ```text
 * glue live MCP state (ephemeral: fibers / failure slots)
 *         ↓  the mcpServer probe port
 * CapabilityReadinessProvider.probe('mcpServer', name)   (3-state, fail-soft)
 *         ↓  ports.readiness
 * RuntimeRequirementFactsProvider.resolveFacts(requirements, scope)
 *         ↓
 * RequirementObservation (3-state) + EnvironmentFact feed (2-state)
 * ```
 *
 * Scenarios: a live fiber → reachable (the feed `available:true` even
 * against a stale `available:false` seed); a failure slot → unreachable; an
 * empty state (fresh restart) → unknown (re-probe, seed-only bootstrap,
 * never the durable ledger); a rejecting port → unknown (fail-soft); the
 * materialization axis (cold → not-applicable, resuming → pending,
 * resident+mounted → mounted, resident+failed → failed).
 * @module @dsh-agent-team/runtime/test/mcp-live-readiness-to-requirement-fact.test
 */

import { describe, expect, it } from 'vitest'
import {
  createRuntimeRequirementFactsProvider,
  type RequirementObservation,
} from '../requirement-facts/index.js'
import {
  createCapabilityReadinessProvider,
  MEMBER_LIVENESS,
  PROBE_VERDICTS,
  type CapabilityProbePort,
  type MaterializationSlot,
  type ProbeVerdict,
} from '../readiness/index.js'
import type { EnvironmentFact } from '../../domain/compatibility/src/index.js'

const NOW = '2026-10-01T00:00:00.000Z'

/**
 * The glue's EPHEMERAL live MCP state (the production source the probe port
 * reads): the per-session live fibers + the isolated failure slots. This
 * mirrors `agent-bindings.mjs`'s `mcpFibers` / `mcpMaterialization`
 * (in-memory only — the durable telemetry ledger is a SEPARATE surface the
 * provider never reads).
 */
interface GlueMcpState {
  /** The server names with a live mounted fiber (any live session). */
  readonly liveFibers: ReadonlySet<string>
  /** The server names with an isolated failure slot (no live fiber). */
  readonly failureSlots: ReadonlyMap<string, MaterializationSlot>
}

/** The production mcpServer probe port over the glue live state. */
function mcpServerPort(state: GlueMcpState): CapabilityProbePort {
  return {
    source: 'mcp-fiber',
    probe: (name: string): ProbeVerdict => {
      if (state.liveFibers.has(name)) return PROBE_VERDICTS.reachable
      if (state.failureSlots.has(name)) return PROBE_VERDICTS.unreachable
      // No fiber, no failure slot: not observed yet (fresh restart / the
      // server has not been reconciled) → unknown (fail-soft, re-probable).
      return PROBE_VERDICTS.unknown
    },
  }
}

function makeProvider(state: GlueMcpState, args: {
  configured?: readonly string[]
  seed?: readonly EnvironmentFact[]
  liveness?: (typeof MEMBER_LIVENESS)[keyof typeof MEMBER_LIVENESS]
  slots?: Map<string, MaterializationSlot>
  rejectPort?: boolean
}) {
  const probes: Record<string, CapabilityProbePort> = {}
  if (args.rejectPort) {
    probes['mcpServer'] = {
      source: 'mcp-fiber',
      probe: () => {
        throw new Error('glue state unavailable')
      },
    }
  } else {
    probes['mcpServer'] = mcpServerPort(state)
  }
  const readiness = createCapabilityReadinessProvider({ probes, now: () => NOW })
  const liveness = args.liveness
  const slots = args.slots ?? new Map()
  return createRuntimeRequirementFactsProvider({
    configuredMcpServers: args.configured ?? ['github'],
    readiness,
    ...(args.seed !== undefined ? { seedFacts: args.seed } : {}),
    substratePlan: async () => {
      throw new Error('persona not exercised here')
    },
    ...(liveness !== undefined
      ? {
          memberMaterialization: async () => ({
            liveness,
            mcpSlots: slots,
          }),
        }
      : {}),
    now: () => NOW,
  })
}

const GITHUB_REQ = { requirementId: 'req-github', type: 'mcpServer' as const, subjects: ['github'], complete: true }
const TEAM = { kind: 'team' as const }
// Blocker-1: the scope carries its role identity — this suite's `dev`
// template is a MEMBER boundary (the persona lane is never exercised
// here: the substratePlan port throws).
const TEMPLATE = { kind: 'template' as const, templateId: 'dev', role: 'member' as const }

describe('live fiber → reachable (overrides a stale static false)', () => {
  it('the feed is available:true even when the seed said available:false', async () => {
    const provider = makeProvider(
      { liveFibers: new Set(['github']), failureSlots: new Map() },
      { seed: [{ domain: 'mcpServer', subject: 'github', available: false, generation: 2 }] },
    )
    const resolution = await provider.resolveFacts({ requirements: [GITHUB_REQ], scope: TEAM })
    const observation = resolution.observations[0]!
    expect(observation.readiness).toBe(PROBE_VERDICTS.reachable)
    expect(observation.readinessSource).toBe('mcp-fiber')
    expect(resolution.environmentFacts).toEqual([{ domain: 'mcpServer', subject: 'github', available: true, generation: 1 }])
  })
})

describe('failure slot → unreachable (the real MCP outage the review closed)', () => {
  it('the feed is available:false (the static seed is overridden)', async () => {
    const provider = makeProvider(
      { liveFibers: new Set(), failureSlots: new Map([['github', { status: 'failed', reason: 'connect ECONNREFUSED', attempts: 3 }]]) },
      { seed: [{ domain: 'mcpServer', subject: 'github', available: true, generation: 5 }] },
    )
    const resolution = await provider.resolveFacts({ requirements: [GITHUB_REQ], scope: TEAM })
    const observation = resolution.observations[0]!
    expect(observation.readiness).toBe(PROBE_VERDICTS.unreachable)
    expect(resolution.environmentFacts).toEqual([{ domain: 'mcpServer', subject: 'github', available: false, generation: 1 }])
  })
})

describe('empty state (fresh restart) → unknown, re-probe (never the durable ledger)', () => {
  it('unknown + no seed → the fact is omitted; the gate re-probes', async () => {
    const provider = makeProvider({ liveFibers: new Set(), failureSlots: new Map() }, {})
    const resolution = await provider.resolveFacts({ requirements: [GITHUB_REQ], scope: TEAM })
    expect(resolution.observations[0]!.readiness).toBe(PROBE_VERDICTS.unknown)
    expect(resolution.environmentFacts).toEqual([])
  })

  it('unknown + a durable-derived seed → the seed feeds ONLY as a marked bootstrap', async () => {
    // The durable telemetry last recorded 'reachable'; it enters (only) as
    // the bootstrap seed — the live unknown verdict is what the gate sees.
    const provider = makeProvider(
      { liveFibers: new Set(), failureSlots: new Map() },
      { seed: [{ domain: 'mcpServer', subject: 'github', available: true, generation: 8 }] },
    )
    const resolution = await provider.resolveFacts({ requirements: [GITHUB_REQ], scope: TEAM })
    expect(resolution.observations[0]!.readiness).toBe(PROBE_VERDICTS.unknown)
    expect(resolution.environmentFacts).toEqual([
      { domain: 'mcpServer', subject: 'github', available: true, generation: 8, detail: 'bootstrap seed (config.environmentFacts) — not runtime truth' },
    ])
  })
})

describe('a rejecting port → unknown (fail-soft, never a throw, never unreachable)', () => {
  it('the port rejection maps to an unknown observation carrying the reason', async () => {
    const provider = makeProvider({ liveFibers: new Set(), failureSlots: new Map() }, { rejectPort: true })
    const resolution = await provider.resolveFacts({ requirements: [GITHUB_REQ], scope: TEAM })
    const observation = resolution.observations[0]!
    expect(observation.readiness).toBe(PROBE_VERDICTS.unknown)
    expect(observation.readinessReason).toContain('glue state unavailable')
    expect(resolution.environmentFacts).toEqual([])
  })
})

describe('the materialization axis (template/instance boundary only)', () => {
  async function materializationFor(liveness: (typeof MEMBER_LIVENESS)[keyof typeof MEMBER_LIVENESS], slots: Map<string, MaterializationSlot>): Promise<RequirementObservation> {
    const provider = makeProvider(
      { liveFibers: new Set(slots.has('github') && slots.get('github')!.status === 'mounted' ? ['github'] : []), failureSlots: new Map(slots.get('github')?.status === 'failed' ? [['github', slots.get('github')!]] : []) },
      { liveness, slots },
    )
    const resolution = await provider.resolveFacts({ requirements: [GITHUB_REQ], scope: TEMPLATE })
    return resolution.observations[0]!
  }

  it('cold → not-applicable (a cold member is never a fabricated failure)', async () => {
    const observation = await materializationFor(MEMBER_LIVENESS.cold, new Map())
    expect(observation.materialization).toBe('not-applicable')
  })

  it('resuming → pending', async () => {
    const observation = await materializationFor(MEMBER_LIVENESS.resuming, new Map())
    expect(observation.materialization).toBe('pending')
  })

  it('resident + mounted slot → mounted (the live fiber is the reachability truth)', async () => {
    const observation = await materializationFor(MEMBER_LIVENESS.resident, new Map([['github', { status: 'mounted' }]]))
    expect(observation.materialization).toBe('mounted')
    expect(observation.readiness).toBe(PROBE_VERDICTS.reachable)
  })

  it('resident + failed slot → failed (blocks that template)', async () => {
    const observation = await materializationFor(MEMBER_LIVENESS.resident, new Map([['github', { status: 'failed', reason: 'connect ECONNREFUSED' }]]))
    expect(observation.materialization).toBe('failed')
    expect(observation.readiness).toBe(PROBE_VERDICTS.unreachable)
  })

  it('resident + no slot yet → pending (the reconcile has not run for it)', async () => {
    const observation = await materializationFor(MEMBER_LIVENESS.resident, new Map())
    expect(observation.materialization).toBe('pending')
  })
})
