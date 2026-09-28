/**
 * pre-alpha3 PR-C §C.4 — the CapabilityReadinessProvider (plan §C.4): the
 * SINGLE live-readiness probe surface.
 *
 * Locks the fail-soft contract (plan §C.10 gate 3): a probe that CANNOT run
 * (no port registered for the capability type, or the port rejects) resolves
 * to `unknown` (the capability has not been observed) — NEVER `unreachable`
 * and never a throw. A fresh boot / restart therefore re-probes instead of
 * assuming the capability is down. A probe that RUNS and observes the
 * capability not-live resolves to `unreachable`.
 *
 * Pure test: the ports are the I/O boundary; no real MCP / model / substrate
 * is touched.
 */
import { describe, expect, it } from 'vitest'
import {
  createCapabilityReadinessProvider,
  createCapabilityObservationRegistry,
  PROBE_VERDICTS,
  type CapabilityProbePort,
  type ProbeVerdict,
} from '../readiness/index.js'

const FIXED_NOW = '2026-12-01T00:00:00.000Z'

function mcpPort(verdict: 'reachable' | 'unreachable' | Promise<never>): CapabilityProbePort {
  return {
    source: 'mcp-fiber',
    probe: () => verdict,
  }
}

describe('PR-C C.4 — the capability readiness provider', () => {
  it('a registered port that resolves reachable yields a reachable observation with provenance', async () => {
    const provider = createCapabilityReadinessProvider({
      probes: { mcpServer: mcpPort('reachable') },
      now: () => FIXED_NOW,
    })
    const observation = await provider.probe('mcpServer', 'alpha')
    expect(observation.verdict).toBe('reachable')
    expect(observation.capabilityType).toBe('mcpServer')
    expect(observation.capabilityName).toBe('alpha')
    expect(observation.source).toBe('mcp-fiber')
    expect(observation.observedAt).toBe(FIXED_NOW)
    expect(observation.reason).toBeUndefined()
  })

  it('a registered port that resolves unreachable yields an unreachable observation (the probe observed it down)', async () => {
    const provider = createCapabilityReadinessProvider({
      probes: { mcpServer: mcpPort('unreachable') },
      now: () => FIXED_NOW,
    })
    const observation = await provider.probe('mcpServer', 'alpha')
    expect(observation.verdict).toBe('unreachable')
    expect(observation.reason).toBeUndefined()
  })

  it('a capability type with NO probe port resolves to unknown (fail-soft, never unreachable, never a throw)', async () => {
    const provider = createCapabilityReadinessProvider({
      probes: { mcpServer: mcpPort('reachable') },
      now: () => FIXED_NOW,
    })
    const observation = await provider.probe('modelRoute', 'gpt')
    expect(observation.verdict).toBe('unknown')
    expect(observation.reason).toContain('NO_PROBE_PORT')
    expect(observation.reason).toContain('modelRoute')
  })

  it('a port that REJECTS resolves to unknown with the message as the reason (fail-soft, never a throw)', async () => {
    const provider = createCapabilityReadinessProvider({
      probes: { persona: mcpPort(Promise.reject(new Error('composition unreadable'))) },
      now: () => FIXED_NOW,
    })
    const observation = await provider.probe('persona', 'leader')
    expect(observation.verdict).toBe('unknown')
    expect(observation.reason).toContain('PROBE_REJECTED')
    expect(observation.reason).toContain('composition unreadable')
  })

  it('an async port that resolves is awaited (the verdict reflects the async observation)', async () => {
    const provider = createCapabilityReadinessProvider({
      probes: { skill: { source: 'skill-state', probe: async (): Promise<ProbeVerdict> => 'unreachable' } },
      now: () => FIXED_NOW,
    })
    const observation = await provider.probe('skill', 'research')
    expect(observation.verdict).toBe('unreachable')
    expect(observation.source).toBe('skill-state')
  })

  it('the 3-state vocabulary is exactly unknown | reachable | unreachable (the unknown ≠ unreachable invariant)', () => {
    expect(PROBE_VERDICTS.unknown).not.toBe('unreachable')
    expect(PROBE_VERDICTS.unknown).toBe('unknown')
    expect(PROBE_VERDICTS.reachable).toBe('reachable')
    expect(PROBE_VERDICTS.unreachable).toBe('unreachable')
  })

  it('the observation registry is ephemeral (record/get/all/size/clear; an earlier observation for the same key is replaced)', () => {
    const registry = createCapabilityObservationRegistry()
    registry.record({
      capabilityType: 'mcpServer',
      capabilityName: 'alpha',
      verdict: 'reachable',
      source: 'mcp-fiber',
      observedAt: FIXED_NOW,
    })
    expect(registry.size).toBe(1)
    expect(registry.get('mcpServer', 'alpha')?.verdict).toBe('reachable')
    expect(registry.all().map((o) => o.capabilityName)).toEqual(['alpha'])
    // A re-record for the same (type, name) REPLACES (the registry holds the
    // most recent observation per capability).
    registry.record({
      capabilityType: 'mcpServer',
      capabilityName: 'alpha',
      verdict: 'unreachable',
      source: 'mcp-fiber',
      observedAt: FIXED_NOW,
    })
    expect(registry.size).toBe(1)
    expect(registry.get('mcpServer', 'alpha')?.verdict).toBe('unreachable')
    registry.clear()
    expect(registry.size).toBe(0)
  })
})
