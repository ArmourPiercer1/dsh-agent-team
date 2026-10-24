/**
 * a5m2-g1-present-c1.test.ts — B-PRESENT wiring slice spec (author side).
 * REAL-MINT: the `present` native face registers out of the pristine
 * 639ed01539 tool-present lib; fs/projections are spied, the DEFINITION and
 * the body (fs gates, turn-boundary law, {turn, files} shape) are the
 * host's own. The commit witness law is the consumed row's: the append is
 * the commit; an arbitrary integer is no witness.
 */
import { describe, it, expect } from 'vitest'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { findTestRepoRoot, TEST_USE_REL } from '../../../tests/paths.mjs'

const REPO = findTestRepoRoot(dirname(fileURLToPath(import.meta.url)))
if (REPO === null) throw new Error('a5m2-g1-present-c1: no repo root carrying the test-use tree — failing closed')
const HOST = join(REPO, TEST_USE_REL)

const W = (await import(new URL('../src/plugin/live/governed-families/present.mjs', import.meta.url).href)) as {
  A5_G1_PRESENT_FAMILY: string
  A5_G1_PRESENT_FAMILY_ENTRY: Record<string, unknown>
  A5_G1_PRESENT_WIRING_CODES: Record<string, string>
  createG1PresentWiring: (input?: Record<string, unknown>) => Record<string, unknown>
}
const SLOT = (await import(new URL('../src/plugin/live/governed-families/g1-present-arm.mjs', import.meta.url).href)) as Record<string, unknown>
const C = W.A5_G1_PRESENT_WIRING_CODES

const PRESENT_LIB = pathToFileURL(join(HOST, 'packages', 'deliverables', 'tool-present', 'lib', 'index.js')).href

interface Mint { native: Record<string, unknown>, appends: Array<{ kind: string, payload: Record<string, unknown> }> }
async function mintPresentNative (opts: { openTurn?: boolean, lastTurn?: number } = {}): Promise<Mint> {
  const lib = (await import(PRESENT_LIB)) as { apply: (ctx: Record<string, unknown>, config: Record<string, unknown>) => void }
  let captured: Record<string, unknown> | undefined
  const appends: Mint['appends'] = []
  lib.apply({
    tools: { register: (def: Record<string, unknown>) => { captured = def } },
    on: () => { /* the host's own tools/result listener — the harness append leg rides the trusted agent below */ },
    fs: {
      lstat: async () => ({ type: 'file' }),
      resolve: async (p: string) => `/work/${p}`,
      stat: async () => ({ type: 'file' }),
    },
    sessionProjections: {
      stateOf: () => opts.openTurn === false
        ? undefined
        : ({ openTurnStartSeq: 10, lastTurn: opts.lastTurn ?? 7 }),
    },
  }, { maxFiles: 4 })
  if (captured === undefined) throw new Error('REAL-MINT failed: the host present tool never registered')
  return { native: captured, appends }
}

const trusted = () => ({ memberAgentId: 'agent-p', sessionHeaderId: 'sess-p', realmId: 'realm-p', owner: 'o', profileId: 'p' })
const agentFace = (appends: Mint['appends']) => ({
  session: {
    header: { cwd: '/work' },
    append: (kind: string, payload: Record<string, unknown>) => { appends.push({ kind, payload }) },
  },
})

const paDouble = () => {
  const calls: string[] = []
  const grant = { grantId: 'g-p' }
  const seat = (async () => {}) as unknown as Record<string, unknown> & { calls: string[] }
  seat.calls = calls
  seat.open = async () => { calls.push('open'); return { kind: 'approved', grant } }
  seat.edge = async () => { calls.push('edge'); return { kind: 'allow', consumedProof: { grant } } }
  seat.closePlan = async () => { calls.push('closePlan') }
  return seat
}

interface Built { ok: unknown, code?: string, detail?: string, recordIndex?: number, row?: Record<string, unknown>, execute: (a: unknown, o: { callId: string, signal: AbortSignal }) => Promise<Record<string, unknown> & { commitWitness?: (w: Record<string, unknown>) => Record<string, unknown>, settled?: string, value?: { turn: number, files: Array<Record<string, unknown>> } }> }
const wiring = (native: Record<string, unknown>, appends: Mint['appends'], pa = paDouble()): Built =>
  W.createG1PresentWiring({
    realmId: 'realm-p', providerId: 'plugin-p', name: 'present',
    native, definitionIdentity: 'plugin-p@639ed01#present#1',
    trusted: trusted(), bindingFacts: () => ({}), agent: agentFace(appends), pa,
  }) as unknown as Built

describe('a5m2-g1-present-c1 — B-PRESENT wiring (PA before exposure; the APPEND is the commit)', () => {
  it('byte law + family entry; the refusal slot module stays present alongside (anti-冒升 floor)', () => {
    expect(Object.keys(W).sort()).toStrictEqual([
      'A5_G1_PRESENT_FAMILY',
      'A5_G1_PRESENT_FAMILY_ENTRY',
      'A5_G1_PRESENT_WIRING_CODES',
      'A5_G1_PRESENT_WIRING_REVISION',
      'createG1PresentWiring',
    ])
    const e = W.A5_G1_PRESENT_FAMILY_ENTRY
    expect(e['records']).toStrictEqual({ present: 51 })
    expect(String(e['commitLaw'])).toContain('an arbitrary integer is no witness')
    expect(typeof SLOT['mountG1PresentSurfaceArm']).toBe('function')
  })

  it('input gates: cross-family name, missing seat, and a missing trusted agent CONFIG face all refuse typed', () => {
    const base = { realmId: 'realm-p', providerId: 'plugin-p', pa: paDouble() }
    let out = W.createG1PresentWiring({ ...base, name: 'skill' })
    expect(out['code']).toBe(C.INPUT_INVALID)
    out = W.createG1PresentWiring({ ...base, name: 'present', pa: {} })
    expect(out['code']).toBe(C.INPUT_INVALID)
    out = W.createG1PresentWiring({ ...base, name: 'present', agent: {} })
    expect(out['code']).toBe(C.INPUT_INVALID)
    expect(String(out['detail'])).toContain('session.append')
  })

  it('REAL-MINT @639ed01539: host present face pins (files grammar, additionalProperties-false items) and arms', async () => {
    const mint = await mintPresentNative()
    expect(mint.native['name']).toBe('present')
    const params = mint.native['parameters'] as Record<string, unknown>
    expect(params['required']).toStrictEqual(['files'])
    const built = wiring(mint.native, mint.appends)
    expect(built.ok, `wiring refused: ${String(built.code)} ${String(built.detail)}`).toBe(true)
    expect(built.recordIndex).toBe(51)
  })

  it('happy: expose runs the REAL body ({turn, files} from the host turn-boundary), stays PENDING-SESSION-APPEND, and the right witness COMMITS (wrong witness refuses; one commit only)', async () => {
    const mint = await mintPresentNative()
    const pa = paDouble()
    const built = wiring(mint.native, mint.appends, pa)
    const controller = new AbortController()
    const out = await built.execute({ files: [{ path: 'a.md', description: 'd' }] }, { callId: 'pr-1', signal: controller.signal })
    expect(out['ok']).toBe(true)
    expect(out['settled']).toBe('RESULT-PENDING-SESSION-APPEND')
    expect(out['value']).toStrictEqual({ turn: 7, files: [{ path: 'a.md', description: 'd' }] })
    expect(typeof out['commitWitness']).toBe('function')
    const wrong = out['commitWitness']!({ callId: 'pr-1', turn: 99, sessionHeaderId: 'sess-p' })
    expect(wrong['ok']).toBe(false) // arbitrary integer is no witness
    const committed = out['commitWitness']!({ callId: 'pr-1', turn: 7, sessionHeaderId: 'sess-p' })
    expect(committed['ok']).toBe(true)
    expect(committed['settled']).toBe('COMMITTED')
    const again = out['commitWitness']!({ callId: 'pr-1', turn: 7, sessionHeaderId: 'sess-p' })
    expect(again['ok']).toBe(false)
    expect(pa.calls).toStrictEqual(['open', 'edge', 'closePlan'])
  })

  it('no OPEN turn: the host body\'s own refusal PROPAGATES (present rides an open turn; the bridge swallows nothing)', async () => {
    const mint = await mintPresentNative({ openTurn: false })
    const built = wiring(mint.native, mint.appends)
    const controller = new AbortController()
    await expect(built.execute({ files: [{ path: 'a.md' }] }, { callId: 'pr-2', signal: controller.signal })).rejects.toThrow(/open turn/)
  })

  it('effects grammar: classify carries tool-invoke PLUS the per-deliverable effects over the trusted realm (present is NOT read-only)', async () => {
    const mint = await mintPresentNative()
    const built = wiring(mint.native, mint.appends)
    const row = built.row as { classify: (a: unknown, c: string) => Record<string, unknown> }
    const classified = row.classify({ files: [{ path: 'a.md' }] }, 'pr-3')
    expect(classified['ok']).toBe(true)
    const effects = classified['effects'] as Array<Record<string, unknown>>
    expect(effects.some((e) => e['kind'] === 'tool-invoke')).toBe(true)
    expect(effects.filter((e) => e['kind'] !== 'tool-invoke').length).toBeGreaterThanOrEqual(1)
    expect(JSON.stringify(effects)).toContain('a.md')
  })
})
