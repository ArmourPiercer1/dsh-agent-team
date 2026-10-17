/**
 * a5p7-mcp-rebind-chain.test.ts — the C-BIND chain as a fixture test
 * (INTERFACES-v1 §C-BIND, owner PR1r Lane; consumed here by Lane F):
 *
 *   MCP tool registered → call in flight (definition identity PINNED)
 *   → MCP withdraw + re-registration (same name, new definition)
 *   → `tools/change` fires (INFORMATION channel, no payload)
 *   → per in-flight job, re-read ITS OWN (scope, name) to judge identity
 *   → result attribution stays with the definition VALIDATED AT EXECUTION TIME
 *
 * The registry double is deliberately minimal (a scope-keyed layer with late
 * Body resolution and a synchronous change emit, per the measured PR1r
 * double's shape). The chain asserted here is the CONSUMER chain: the
 * channel's security claims are none, scope filtering only prevents
 * friendly fire, and a later definition never claims an earlier job.
 *
 * @module test/a5p7-mcp-rebind-chain
 */
import { describe, expect, it } from 'vitest'
import { createJobsGateway, jobOwnerKey } from '../jobs-gateway/index.js'
import type { DefinitionIdentityProbe } from '../jobs-gateway/index.js'

const OWNER_A = { rootSessionId: 'session-a', instanceId: 'inst-1' }

interface McpDouble {
  register(scope: string, name: string, identity: string): void
  withdraw(scope: string, name: string): void
  probe: DefinitionIdentityProbe
  changeTicks: number
}

function createMcpDouble(onChange: () => void): McpDouble {
  const layers = new Map<string, Map<string, string>>() // scope → name → identity
  const touch = (): void => {
    double.changeTicks += 1
    onChange()
  }
  const double: McpDouble = {
    register: (scope, name, identity) => {
      const layer = layers.get(scope) ?? new Map<string, string>()
      layer.set(name, identity)
      layers.set(scope, layer)
      touch() // like the real registry: every change emits `tools/change` synchronously
    },
    withdraw: (scope, name) => {
      layers.get(scope)?.delete(name)
      touch()
    },
    probe: (scope, name) => {
      const identity = layers.get(scope)?.get(name)
      return identity === undefined ? { ok: false, identity: 'absent' } : { ok: true, identity }
    },
    changeTicks: 0,
  }
  return double
}

describe('a5p7 C-BIND chain — withdraw → re-register → change → attribution', () => {
  it('a change cancels only the job whose OWN definition moved (no friendly fire)', () => {
    const gw = createJobsGateway()
    const mcp = createMcpDouble(() => {})
    mcp.register('agent:1', 'fs_read', 'v1')
    mcp.register('agent:1', 'other_tool', 'v1')
    mcp.register('agent:2', 'fs_read', 'v1')

    gw.admitJob({ jobId: 'j1', owner: OWNER_A, scopeKey: 'agent:1', toolName: 'fs_read', pinnedIdentity: 'v1' })
    gw.admitJob({ jobId: 'j2', owner: OWNER_A, scopeKey: 'agent:1', toolName: 'other_tool', pinnedIdentity: 'v1' })
    gw.admitJob({ jobId: 'j3', owner: OWNER_A, scopeKey: 'agent:2', toolName: 'fs_read', pinnedIdentity: 'v1' })

    // MCP withdraw + re-registration of ONE definition.
    mcp.withdraw('agent:1', 'fs_read')
    mcp.register('agent:1', 'fs_read', 'v2')

    // One `tools/change`: the gateway re-reads each in-flight job's own pair.
    const cancelled = gw.onRegistryChange(mcp.probe)
    expect(cancelled.map((c) => c.jobId)).toEqual(['j1'])
    expect(cancelled[0]).toMatchObject({ pinnedIdentity: 'v1', currentIdentity: 'v2' })
    // j2 (neighbour name, untouched) and j3 (same name, other scope) stand.
    expect(gw.job('j2')[0]!.cancelRequested).toBe(false)
    expect(gw.job('j3')[0]!.cancelRequested).toBe(false)
  })

  it('an unreadable read counts as MOVED: the closed world credits no read it cannot make', () => {
    const gw = createJobsGateway()
    const mcp = createMcpDouble(() => {})
    mcp.register('agent:1', 'fs_read', 'v1')
    gw.admitJob({ jobId: 'j1', owner: OWNER_A, scopeKey: 'agent:1', toolName: 'fs_read', pinnedIdentity: 'v1' })
    mcp.withdraw('agent:1', 'fs_read') // permanent loss: nothing answers now
    const cancelled = gw.onRegistryChange(mcp.probe)
    expect(cancelled).toHaveLength(1)
    expect(cancelled[0]!.currentIdentity).toContain('unreadable')
  })

  it('with NO reader at all, every in-flight job moves — never "assume unchanged"', () => {
    const gw = createJobsGateway()
    gw.admitJob({ jobId: 'j1', owner: OWNER_A, scopeKey: 'agent:1', toolName: 'fs_read', pinnedIdentity: 'v1' })
    const cancelled = gw.onRegistryChange()
    expect(cancelled).toHaveLength(1)
    expect(cancelled[0]!.currentIdentity).toContain('no-reader')
  })

  it('a swallowed change event cannot corrupt attribution: results pin the EXECUTED-TIME definition', () => {
    const gw = createJobsGateway()
    const mcp = createMcpDouble(() => {})
    mcp.register('agent:1', 'fs_read', 'v1')
    gw.admitJob({ jobId: 'j1', owner: OWNER_A, scopeKey: 'agent:1', toolName: 'fs_read', pinnedIdentity: 'v1' })

    // Re-registration whose change event is SWALLOWED (a listener failure —
    // the channel is information, not security, so this must not corrupt the
    // attribution chain): the Body that ran was v1, and v1 owns the result.
    mcp.register('agent:1', 'fs_read', 'v2')
    gw.observeDispatchEvent({
      event: 'dispatcher-call-terminated-after-body-start',
      callId: 'j1',
      tool: 'fs_read',
      sideEffectPossible: true,
      abortIssuedBy: 'none',
      preservedValue: 'v1-body-result',
    })

    const job = gw.job('j1')[0]!
    expect(job.pinnedIdentity).toBe('v1') // attribution anchor unchanged by v2
    expect(job.outcome?.kind).toBe('terminated-after-start')
    // The owner's view shows the OLD definition's result; the new definition
    // under the same name has no claim to it.
    const view = gw.projectFor(OWNER_A, 'j1')
    expect(view.ok).toBe(true)
    if (view.ok) expect(view.view.pinnedIdentity).toBe('v1')
    // A fresh admission after the re-registration pins the NEW definition.
    gw.admitJob({ jobId: 'j2', owner: OWNER_A, scopeKey: 'agent:1', toolName: 'fs_read', pinnedIdentity: 'v2' })
    expect(gw.job('j2')[0]!.pinnedIdentity).toBe('v2')
    expect(gw.job('j2')[0]!.ownerKey).toBe(jobOwnerKey(OWNER_A))
  })

  it('the chain end-to-end: pin → change → re-read → abort face → terminal outcome not-started', () => {
    const seen: string[] = []
    const gw = createJobsGateway({ onObserve: (o) => seen.push(o.event) })
    const mcp = createMcpDouble(() => {})
    mcp.register('agent:1', 'fs_read', 'v1')
    gw.admitJob({ jobId: 'j1', owner: OWNER_A, scopeKey: 'agent:1', toolName: 'fs_read', pinnedIdentity: 'v1' })

    mcp.withdraw('agent:1', 'fs_read')
    mcp.register('agent:1', 'fs_read', 'v2')
    const cancelled = gw.onRegistryChange(mcp.probe) // the tools/change leg
    expect(cancelled).toHaveLength(1)
    expect(seen).toContain('gateway-cancel-requested')

    // The abort reaches the Host before dispatch: the HOST says not-started.
    gw.observeDispatchEvent({
      event: 'dispatcher-call-cancelled-before-body',
      callId: 'j1',
      tool: 'fs_read',
      sideEffectPossible: false,
      abortIssuedBy: 'lane-definition-move',
    })
    const job = gw.job('j1')[0]!
    expect(job.outcome?.kind).toBe('not-started')
    expect(job.outcome?.evidenceEvent).toBe('dispatcher-call-cancelled-before-body')
    // …and the lease self-count drains to zero.
    gw.lease.drain()
    expect(gw.lease.release()).toEqual({ ok: true })
  })

  it('a change for a job already settled does not re-open it', () => {
    const gw = createJobsGateway()
    const mcp = createMcpDouble(() => {})
    mcp.register('agent:1', 'fs_read', 'v1')
    gw.admitJob({ jobId: 'j1', owner: OWNER_A, scopeKey: 'agent:1', toolName: 'fs_read', pinnedIdentity: 'v1' })
    gw.observeDispatchEvent({
      event: 'dispatcher-call-completed-after-abort',
      callId: 'j1',
      tool: 'fs_read',
      sideEffectPossible: true,
      abortIssuedBy: 'none',
    })
    mcp.withdraw('agent:1', 'fs_read')
    mcp.register('agent:1', 'fs_read', 'v2')
    expect(gw.onRegistryChange(mcp.probe)).toHaveLength(0)
    expect(gw.job('j1')[0]!.outcome?.kind).toBe('executed-despite-cancel')
  })
})
