/**
 * a5m2-g1-present-arm.test.ts — the B-PRESENT resource-arm SLOT spec
 * (center REAL-GAP SOURCE CARD + TERRITORY PIN). The slot's whole law is
 * that it NEVER arms: supply facts answer typed, the passed supply gate is
 * recorded, and every path is a citable refusal with zero native entry
 * (禁冒升; the native Body must never be a silent fallback).
 */
import { describe, it, expect } from 'vitest'

const ARM = (await import(new URL('../src/plugin/live/governed-families/g1-present-arm.mjs', import.meta.url).href)) as {
  A5_G1_PRESENT_ARM_REVISION: number
  A5_G1_PRESENT_ARM_FAMILY: string
  A5_G1_PRESENT_ARM_CODES: { SUPPLY_INVALID: string, NOT_MATURE: string }
  g1PresentArmRecordSpec: () => Record<string, unknown>
  mountG1PresentSurfaceArm: (deps?: Record<string, unknown>) => Record<string, unknown>
}
const ADAPTERS = (await import(new URL('../src/plugin/live/governed-families/g1-surface-adapters.mjs', import.meta.url).href)) as {
  A5_G1_RECORD_SPECS: Record<string, Record<string, unknown>>
}

const SC = ARM.A5_G1_PRESENT_ARM_CODES

let nativeCalls = 0
const nativeFace = () => ({
  name: 'present',
  description: 'present selected files as deliverables (native face double — must NEVER be entered)',
  execute: () => { nativeCalls += 1; return [] },
})
const trusted = () => ({
  memberAgentId: 'agent-m1', sessionHeaderId: 'sess-h1', realmId: 'realm-g1', owner: 'owner-1', profileId: 'prof-1',
})
const fullSupply = (): Record<string, unknown> => ({
  native: nativeFace(),
  providerId: 'plugin-g1test',
  definitionIdentity: 'plugin-g1test@deadbeef#present#h1',
  trusted: trusted(),
  bindingFacts: () => 'rev-1',
})

const isRefusal = (out: Record<string, unknown>) => {
  expect(out['ok']).toBe(false)
  expect(typeof out['code']).toBe('string')
  expect(typeof out['detail']).toBe('string')
}

describe('a5m2-g1-present-arm — the slot never arms (B-PRESENT resource arm)', () => {
  it('byte law: the export face is exactly the closed slot vocabulary', () => {
    expect(Object.keys(ARM).sort()).toStrictEqual([
      'A5_G1_PRESENT_ARM_CODES',
      'A5_G1_PRESENT_ARM_FAMILY',
      'A5_G1_PRESENT_ARM_REVISION',
      'g1PresentArmRecordSpec',
      'mountG1PresentSurfaceArm',
    ])
    expect(ARM.A5_G1_PRESENT_ARM_REVISION).toBe(1)
    expect(ARM.A5_G1_PRESENT_ARM_FAMILY).toBe('B-PRESENT')
    expect(Object.isFrozen(ARM.A5_G1_PRESENT_ARM_CODES)).toBe(true)
    expect(SC).toStrictEqual({
      SUPPLY_INVALID: 'P_G1_PRESENT_ARM_SUPPLY_INVALID',
      NOT_MATURE: 'P_G1_PRESENT_ARM_NOT_MATURE',
    })
  })

  it('single source law: the record spec is the CONSUMED frozen object, not a second table', () => {
    const spec = ARM.g1PresentArmRecordSpec()
    expect(spec).toBe(ADAPTERS.A5_G1_RECORD_SPECS['present'])
    expect(spec['recordIndex']).toBe(51)
    expect(spec['family']).toBe('B-PRESENT')
    expect(spec['commitLaw']).toBe('session-append')
    // the consumed block is untouched by this lane: no present-arm symbol
    // exists there (anti-duplication, territory pin = read-only reference)
    expect(Object.keys(ADAPTERS).some((k) => /PresentArm/i.test(k))).toBe(false)
  })

  it('supply gate: non-record input and unknown deps keys refuse typed (closed supply face)', () => {
    for (const bad of [null, undefined, 7, 'x', []]) {
      const out = ARM.mountG1PresentSurfaceArm(bad as never)
      isRefusal(out)
      expect(out!['code']).toBe(SC.SUPPLY_INVALID)
    }
    const out = ARM.mountG1PresentSurfaceArm({ bogus: 1 })
    isRefusal(out)
    expect(out['code']).toBe(SC.SUPPLY_INVALID)
    expect(String(out['detail'])).toContain('bogus')
  })

  it('supply gate: a defective supply face answers the CONSUMED mount law typed (trusted face missing)', () => {
    const out = ARM.mountG1PresentSurfaceArm({ native: nativeFace() })
    isRefusal(out)
    expect(out['code']).toBe(SC.SUPPLY_INVALID)
    expect(String(out['detail'])).toContain('mountG1SurfaceAdapter')
    expect(nativeCalls).toBe(0)
  })

  it('禁冒升 law: a FULLY valid supply still refuses NOT_MATURE — the gate passes and is recorded, nothing arms, zero native entry', () => {
    const out = ARM.mountG1PresentSurfaceArm(fullSupply())
    isRefusal(out)
    expect(out['code']).toBe(SC.NOT_MATURE)
    const detail = String(out['detail'])
    // citable contract: the frozen backlog row, the row's own commit law, and
    // the blocking-item law (native-Body fallback) all ride the refusal
    expect(detail).toContain('record 51·B-PRESENT·plugin-g1test')
    expect(detail).toContain('G1 dependency/plugin/present 资源臂 | 未开发 | 治理实现仍实质缺口（无成熟适配可交付；禁冒升）')
    expect(detail).toContain('deliverables/presented')
    expect(detail).toContain('原生 Body 回落=阻断项')
    expect(detail).toContain('an inert supply row (never surfaced, never entered)')
    // nothing arms: no row/adapter face ever surfaces from the slot
    expect(Object.keys(out).sort()).toStrictEqual(['code', 'detail', 'ok'])
    expect(nativeCalls).toBe(0)
  })

  it('no path to ok:true exists across every supply shape (typed refusal is the closed answer set)', () => {
    const shapes: Array<Record<string, unknown> | null | undefined | number | string> = [
      undefined, null, {}, { trusted: trusted() }, fullSupply(),
    ]
    for (const shape of shapes) {
      const out = ARM.mountG1PresentSurfaceArm(shape as never)
      isRefusal(out)
      expect([SC.SUPPLY_INVALID, SC.NOT_MATURE]).toContain(out['code'])
    }
    expect(nativeCalls).toBe(0)
  })
})
