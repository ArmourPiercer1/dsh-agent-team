/**
 * a5p4-network-closure — the network-dimension closed set (C-PROC: 网络维度闭集)
 * and the no-overclaim law from PoC-4b: the Landlock TCP-port bits (ABI v4)
 * are NOT a general "no network" guarantee, and a `deny`/`restricted` profile
 * is refused BEFORE the process exists (`IO_POLICY_UNSUPPORTED`) until a real
 * destination-filtering / netns-seccomp Provider demonstrates it.
 *
 * @module packages/runtime/test/a5p4-network-closure.test
 */

import { describe, expect, it } from 'vitest'
import {
  evaluateNetworkRequirement,
  LANDLOCK_TCP_NOTE,
  NETWORK_PROFILES,
  networkProbeRow,
} from '../sandbox-provider/network.js'

describe('a5p4 network dimension closed set', () => {
  it('names exactly deny | restricted — there is NO unconfined arm', () => {
    expect([...NETWORK_PROFILES]).toEqual(['deny', 'restricted'])
  })

  it('an absent profile is accepted and makes NO network claim (dimension stays honest)', () => {
    const r = evaluateNetworkRequirement(undefined, 'realm-a')
    expect(r.ok).toBe(true)
    const row = networkProbeRow(4)
    expect(row.level).toBe('unsupported')
    expect(row.dimension).toBe('network-destination')
  })

  it('deny is refused pre-spawn with IO_POLICY_UNSUPPORTED while no provider demonstrates full deny', () => {
    const r = evaluateNetworkRequirement('deny', 'realm-a')
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.error.code).toBe('IO_POLICY_UNSUPPORTED')
      expect(r.error.message).toContain('PoC-4b')
    }
  })

  it('restricted is refused until the destination-filter/DNS/redirect Provider lands (separate reason)', () => {
    const r = evaluateNetworkRequirement('restricted', 'realm-a')
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.error.code).toBe('IO_POLICY_UNSUPPORTED')
      expect(r.error.message).toContain('destination')
    }
  })

  it('a name outside the closed set is a value-outside-closed-set refusal', () => {
    const r = evaluateNetworkRequirement('allow-but-quiet' as never, 'realm-a')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error.message.toLowerCase()).toContain('outside')
  })

  it('the TCP note states what ABI v4 does and does NOT cover, and never says "no network"', () => {
    expect(LANDLOCK_TCP_NOTE).toContain('TCP')
    const lower = LANDLOCK_TCP_NOTE.toLowerCase()
    expect(lower).toContain('udp')
    expect(lower).toContain('unix')
    expect(lower).not.toMatch(/\bno network\b/)
    expect(lower).not.toMatch(/\bnetwork[- ]denied\b/)
    const row = networkProbeRow(4)
    expect(row.note).toContain(LANDLOCK_TCP_NOTE)
  })

  it('below ABI v4 the note still records no network capability (honest, not invented)', () => {
    const row = networkProbeRow(1)
    expect(row.level).toBe('unsupported')
    expect(row.note).toContain(LANDLOCK_TCP_NOTE)
  })
})
