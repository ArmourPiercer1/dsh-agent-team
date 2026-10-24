/**
 * a5m2-g1-skill-c1.test.ts — B-SKILL wiring slice spec (author side).
 * REAL-MINT: the `skill` native face registers out of the pristine
 * 639ed01539 tool-skill lib (tests/paths.mjs = unique pin source); the
 * catalog/skills channel behind it is spied — the model-invocable DOUBLE
 * GATE and the '#'-catalog shape stay the HOST's own law, propagated.
 */
import { describe, it, expect } from 'vitest'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { findTestRepoRoot, TEST_USE_REL } from '../../../tests/paths.mjs'

const REPO = findTestRepoRoot(dirname(fileURLToPath(import.meta.url)))
if (REPO === null) throw new Error('a5m2-g1-skill-c1: no repo root carrying the test-use tree — failing closed')
const HOST = join(REPO, TEST_USE_REL)

const K = (await import(new URL('../src/plugin/live/governed-families/skill.mjs', import.meta.url).href)) as {
  A5_G1_SKILL_FAMILY: string
  A5_G1_SKILL_FAMILY_ENTRY: Record<string, unknown>
  A5_G1_SKILL_WIRING_CODES: Record<string, string>
  createG1SkillWiring: (input?: Record<string, unknown>) => Record<string, unknown>
}
const ADAPTERS = (await import(new URL('../src/plugin/live/governed-families/g1-surface-adapters.mjs', import.meta.url).href)) as {
  A5_G1_ADAPTER_REVISION: number
}
const C = K.A5_G1_SKILL_WIRING_CODES

const SKILL_LIB = pathToFileURL(join(HOST, 'packages', 'skill', 'tool-skill', 'lib', 'index.js')).href

interface SpyEntry { name: string, provider: string, invocation: { modelInvocable: boolean }, content?: string }
async function mintSkillNative (entries: SpyEntry[]): Promise<{ native: Record<string, unknown>, listCalls: number, getCalls: string[] }> {
  const lib = (await import(SKILL_LIB)) as { apply: (ctx: Record<string, unknown>, config?: Record<string, unknown>) => void }
  let captured: Record<string, unknown> | undefined
  const getCalls: string[] = []
  let listCalls = 0
  lib.apply({
    tools: { register: (def: Record<string, unknown>) => { captured = def } },
    // the lib also mounts its durable catalog listener (ctx.on) — inert here
    on: () => { /* no-op listener mount for the REAL-MINT probe */ },
    skills: {
      list: async () => { listCalls += 1; return entries.map(({ name, provider, invocation }) => ({ name, provider, invocation })) },
      get: async (name: string) => { getCalls.push(name); const hit = entries.find((e) => e.name === name); return hit === undefined ? null : { ...hit } },
    },
  }, {})
  if (captured === undefined) throw new Error('REAL-MINT failed: the host skill tool never registered')
  return { native: captured, listCalls, getCalls }
}

const trusted = () => ({ memberAgentId: 'a-s', sessionHeaderId: 'sess-s', realmId: 'realm-s', owner: 'o', profileId: 'p' })

const paDouble = (opts: { deny?: Record<string, unknown> } = {}) => {
  const calls: string[] = []
  const grant = { grantId: 'g-s' }
  const seat = (async () => {}) as unknown as Record<string, unknown> & { calls: string[] }
  seat.calls = calls
  seat.open = async () => { calls.push('open'); return opts.deny !== undefined ? opts.deny : { kind: 'approved', grant } }
  seat.edge = async () => { calls.push('edge'); return { kind: 'allow', consumedProof: { grant } } }
  seat.closePlan = async () => { calls.push('closePlan') }
  return seat
}

const catalogPort = (mutable: { rev: number, names: string[] }) => ({
  trustedCatalog: { current: () => ({ catalogRevision: mutable.rev, catalogDigest: `digest-${String(mutable.rev)}`, names: [...mutable.names] }) },
})

const wiring = (native: Record<string, unknown>, ports: Record<string, unknown>, pa: Record<string, unknown>) =>
  K.createG1SkillWiring({
    realmId: 'realm-s', providerId: 'plugin-s', name: 'skill',
    native, definitionIdentity: 'plugin-s@639ed01#skill#1',
    trusted: trusted(), bindingFacts: () => ({}), ports, pa,
  }) as unknown as { ok: unknown, code?: string, detail?: string, recordIndex?: number, row?: Record<string, unknown>, execute: (a: Record<string, unknown>, o: { callId: string }) => Promise<Record<string, unknown>> }

describe('a5m2-g1-skill-c1 — B-SKILL wiring (trusted CURRENT catalog facts; host double-gate kept)', () => {
  it('byte law + family entry (record 24, consumed adapter revision)', () => {
    expect(Object.keys(K).sort()).toStrictEqual([
      'A5_G1_SKILL_FAMILY',
      'A5_G1_SKILL_FAMILY_ENTRY',
      'A5_G1_SKILL_WIRING_CODES',
      'A5_G1_SKILL_WIRING_REVISION',
      'createG1SkillWiring',
    ])
    const e = K.A5_G1_SKILL_FAMILY_ENTRY
    expect(e['records']).toStrictEqual({ skill: 24 })
    expect(e['contractRef']).toBe('M0-B-FAMILY-TARGET-CONTRACTS.md#B-SKILL')
    expect((e['consumedAdapter'] as Record<string, unknown>)['revision']).toBe(ADAPTERS.A5_G1_ADAPTER_REVISION)
  })

  it('input gates: cross-family name, missing seat, and the catalog port all refuse typed', () => {
    const base = { realmId: 'realm-s', providerId: 'plugin-s', pa: paDouble() }
    let out = K.createG1SkillWiring({ ...base, name: 'ask_user_question' })
    expect(out['code']).toBe(C.INPUT_INVALID)
    out = K.createG1SkillWiring({ ...base, name: 'skill', pa: {} })
    expect(out['code']).toBe(C.INPUT_INVALID)
    out = K.createG1SkillWiring({ ...base, name: 'skill', ports: {} })
    expect(out['code']).toBe(C.PORT_ABSENT)
    expect(String(out['detail'])).toContain('trustedCatalog')
  })

  it('REAL-MINT @639ed01539: host skill face pins (name/required grammar) and arms; happy path loads through the host body', async () => {
    const entries: SpyEntry[] = [{ name: 'alpha', provider: 'prov-a', invocation: { modelInvocable: true }, content: 'ALPHA-BODY' }]
    const mint = await mintSkillNative(entries)
    const native = mint.native
    expect(native['name']).toBe('skill')
    const params = native['parameters'] as Record<string, unknown>
    expect(params['required']).toStrictEqual(['name'])
    const pa = paDouble()
    const built = wiring(native, catalogPort({ rev: 1, names: ['alpha'] }), pa)
    expect(built.ok, `wiring refused: ${String(built.code)} ${String(built.detail)}`).toBe(true)
    expect(built.recordIndex).toBe(24)
    const out = await built.execute({ name: 'alpha' }, { callId: 'sk-1' })
    expect(out['ok']).toBe(true)
    expect((out['value'] as Record<string, unknown>)['content']).toBe('ALPHA-BODY')
    expect(mint.getCalls).toContain('alpha')
    expect(pa.calls).toStrictEqual(['open', 'edge', 'closePlan'])
  })

  it('no CURRENT catalog facts: the row refuses BEFORE the PA seat (captured snapshot never justifies a get)', async () => {
    const mint = await mintSkillNative([{ name: 'alpha', provider: 'p', invocation: { modelInvocable: true }, content: 'X' }])
    const pa = paDouble()
    const dead = { trustedCatalog: { current: () => undefined } }
    const built = wiring(mint.native, dead, pa)
    expect(built.ok).toBe(true)
    const out = await built.execute({ name: 'alpha' }, { callId: 'sk-2' })
    expect(out['ok']).toBe(false)
    expect(pa.calls).toStrictEqual([])
  })

  it('name outside the CURRENT trusted catalog refuses typed; the skills channel is never touched', async () => {
    const mint = await mintSkillNative([{ name: 'alpha', provider: 'p', invocation: { modelInvocable: true }, content: 'X' }])
    const built = wiring(mint.native, catalogPort({ rev: 1, names: ['other'] }), paDouble())
    const out = await built.execute({ name: 'alpha' }, { callId: 'sk-3' })
    expect(out['ok']).toBe(false)
    expect(mint.getCalls).toStrictEqual([])
  })

  it('C1 kind:user not model-forgeable: the HOST double gate refuses behind the delegate and the throw PROPAGATES unchanged (the bridge swallows nothing)', async () => {
    const mint = await mintSkillNative([{ name: 'secret', provider: 'p', invocation: { modelInvocable: false }, content: 'S' }])
    const built = wiring(mint.native, catalogPort({ rev: 1, names: ['secret'] }), paDouble())
    await expect(built.execute({ name: 'secret' }, { callId: 'sk-4' })).rejects.toThrow(/not available for model invocation/)
  })

  it('catalog revision moves between classify and the consumption edge: the row re-verifies and refuses stale — zero get after the move', async () => {
    const mint = await mintSkillNative([{ name: 'alpha', provider: 'p', invocation: { modelInvocable: true }, content: 'X' }])
    let flipped = false
    const ports = {
      trustedCatalog: {
        current: () => {
          if (!flipped) { flipped = true; return { catalogRevision: 1, catalogDigest: 'digest-1', names: ['alpha'] } }
          return { catalogRevision: 2, catalogDigest: 'digest-2', names: ['alpha'] }
        },
      },
    }
    const built = wiring(mint.native, ports, paDouble())
    const out = await built.execute({ name: 'alpha' }, { callId: 'sk-5' })
    expect(out['ok']).toBe(false)
    expect(mint.getCalls).toStrictEqual([])
  })
})
