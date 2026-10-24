/**
 * A5M2 the CHILD IDENTITY BRIDGE (root ruling 2026-10-26 item A): a
 * trusted identity ROUTING / lifecycle index ONLY — install before
 * publish, routing facts without decisions, drain-before-retire, and
 * zero quota/exposure semantics (those follow the original native and
 * the current policy). Module-only: no boot, no Host, no engine.
 */
import { describe, it, expect } from 'vitest'
import { createChildIdentityBridge, BRIDGE_STATE } from '../src/plugin/live/governed-families/child-identity-bridge.mjs'

const binding = (over: Record<string, unknown> = {}) => ({ childSessionId: 'sess-child-1', rootSessionId: 'team-root-1', owningMemberInstanceId: 'inst-owner1', admittedCallId: 'orch-1#child-1', generation: 7, ...over })

describe('A5M2 child identity bridge: routing facts, install-before-publish, drain -> reclaim -> retire', () => {
  it('INSTALL BEFORE PUBLISH + ROUTING READ: a real child id routes to the owning member/root/admitted-call/generation; identical re-install is idempotent; a CONFLICT rebind is refused; missing fields and a folded-zero generation typed-refuse', () => {
    const b = createChildIdentityBridge()
    const rec = b.install(binding())
    expect([rec.state, rec.owningMemberInstanceId, rec.rootSessionId, rec.admittedCallId, rec.generation]).toEqual([BRIDGE_STATE.ACTIVE, 'inst-owner1', 'team-root-1', 'orch-1#child-1', 7])
    expect(b.resolve('sess-child-1')?.owningMemberInstanceId).toBe('inst-owner1')
    expect(b.install(binding()).state).toBe(BRIDGE_STATE.ACTIVE)
    expect(() => b.install(binding({ owningMemberInstanceId: 'inst-other' }))).toThrow('CIB_ROUTE_CONFLICT')
    for (const bad of [{ childSessionId: '' }, { rootSessionId: '' }, { admittedCallId: '' }, { generation: undefined }, { generation: -1 }]) {
      expect(() => b.install(binding(bad)), JSON.stringify(bad)).toThrow('CIB_INPUT_INVALID')
    }
    expect(b.resolve('sess-unknown')).toBeUndefined()
  })
  it('DRAIN BEFORE RETIRE: retire from ACTIVE is REFUSED (no reclaim skips the drain); settle runs beginDrain -> the REAL reclaim -> retire IN ORDER and retires even when the reclaim faults; a retired route stops answering (fail-closed consumers keep their throw)', async () => {
    const b = createChildIdentityBridge()
    b.install(binding())
    expect(() => b.retire('sess-child-1')).toThrow('CIB_RETIRE_WITHOUT_DRAIN')
    const order: string[] = []
    const out = await b.settle('sess-child-1', async () => {
      order.push(`reclaim@${String(b.resolve('sess-child-1')?.state)}`)
      return 'reclaimed'
    })
    order.push(`after=${String(b.resolve('sess-child-1'))}`)
    expect(order).toEqual(['reclaim@draining', 'after=undefined'])
    expect(out).toBe('reclaimed')
    b.install(binding({ childSessionId: 'sess-child-2' }))
    await expect(b.settle('sess-child-2', async () => { throw new Error('reclaim fault') })).rejects.toThrow('reclaim fault')
    expect(b.resolve('sess-child-2'), 'a faulted reclaim still retires the route').toBeUndefined()
  })
  it('OWNER CANCELLATION / REGENERATION: drainByOwner marks the owner\'s ACTIVE routes draining (optionally below a generation), answers the drained set for the caller\'s cancel/reclaim pass, and decides NOTHING else; exposure/quota are not this module\'s subject', () => {
    const b = createChildIdentityBridge()
    b.install(binding({ childSessionId: 'c1', generation: 3 }))
    b.install(binding({ childSessionId: 'c2', generation: 8, admittedCallId: 'orch-1#child-2' }))
    b.install(binding({ childSessionId: 'c9', owningMemberInstanceId: 'inst-other-owner' }))
    const drained = b.drainByOwner('team-root-1', 'inst-owner1', { belowGeneration: 7, reason: 'owner-regenerated' })
    expect(drained.map((r: Record<string, unknown>) => r.childSessionId)).toEqual(['c1'])
    expect(b.resolve('c1')?.state).toBe(BRIDGE_STATE.DRAINING)
    expect(b.resolve('c2')?.state).toBe(BRIDGE_STATE.ACTIVE)
    expect(b.resolve('c9')?.state).toBe(BRIDGE_STATE.ACTIVE)
    expect(Object.keys(b.install(binding({ childSessionId: 'c3' }))).sort()).toEqual(['admittedCallId', 'childSessionId', 'generation', 'owningMemberInstanceId', 'rootSessionId', 'state'])
  })
})
