/**
 * A5M2-G1 trustedTopology SUPPLY contract controls (ROOT 01:01 contract:
 * 同次真实读、交集授权、完整规范化摘要、确定性内容版本 revision、fail-closed
 * 守卫原样、绝不缓存/常数/伪事件/ABA声明).
 *
 *  (A) arm law: no public inspect face -> INSPECT_ABSENT; no live authorized
 *      scope reader -> AUTHORIZED_ABSENT (publicly visible is NOT authorized;
 *      no allow-all default ships here);
 *  (B) intersection truth: allowed = the same-read directory triples ∩ the
 *      mount scope, EXACT (visible-but-unauthorized excluded,
 *      authorized-but-not-visible absent), frozen canonical-sorted;
 *  (C) value law: the whole face equals an INDEPENDENT spec-side recomputation
 *      (canonical sha256 full summary + revision = first 52 bits of the SAME
 *      digest, a non-negative safe integer); deterministic across two
 *      independent supplies over the same content (content version, not
 *      mount identity);
 *  (D) lifecycle without ABA claims: adding a merely-VISIBLE provider leaves
 *      the face byte-equal; authorizing+moving content moves BOTH facts;
 *      returning the content returns the SAME pair exactly (M0 equality =
 *      same normalized content — no monotonic/hidden-substitution claim);
 *  (E) THROUGH THE SIGNED WIRING: a full face mounts the real B-INSPECT row
 *      (admit walks once, native runs once, answer topology-constrained); an
 *      absent/malformed source answers undefined and the row refuses with the
 *      adapter's OWN P_G1_TRUSTED_TOPOLOGY_ABSENT — zero admits, zero native
 *      entry (the signed guard, identity unmoved);
 *  (F) freshness: every current() performs exactly one fresh read of BOTH
 *      public sources — zero cache;
 *  (G) source-text controls: closure exactly ['node:crypto']; no constant
 *      revision/digest literal; no lane/host edges; no private symbols.
 *
 * DISCLOSED STAND-INS: the cordisInspect double mirrors the REAL public face
 * at 639 (synchronous list() answering {platform,id,methods:[{name}]} views —
 * synchronicity is what makes the cacheless synchronous current() honest);
 * the authorized-scope reader stands in for the mount's owner-held scope
 * facts (its REAL source is the mount's own block, outside this lane); the
 * native execute body in (E) is a recorded double. Not C2; 接线未测 until the
 * 44ece mount-arm wires it (无 Host).
 *
 * @module @dsh-agent-team/runtime/test/a5m2-g1-trusted-topology-supply
 */
import { describe, it, expect } from 'vitest'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import type {
  A5_G1_TRUSTED_TOPOLOGY_SUPPLY_CODES,
  G1TrustedTopologyFace,
  G1TrustedTopologySupply,
  G1TrustedTopologySupplyResult,
  G1TopologyTriple,
} from '../src/plugin/live/governed-families/g1-trusted-topology-supply.d.mts'

const TOPO = (await import(new URL('../src/plugin/live/governed-families/g1-trusted-topology-supply.mjs', import.meta.url).href)) as {
  A5_G1_TRUSTED_TOPOLOGY_SUPPLY_REVISION: number
  A5_G1_TRUSTED_TOPOLOGY_SUPPLY_CODES: typeof A5_G1_TRUSTED_TOPOLOGY_SUPPLY_CODES
  // the arm-law leg FEEDS BROKEN FACES ON PURPOSE (runtime validation is the
  // contract), so this cast widens the mount facts to unknown — positive
  // callers keep the d.mts typed surfaces.
  createG1TrustedTopologySupply: (input?: { inspect?: unknown; authorized?: unknown; observe?: (row: unknown) => void }) => G1TrustedTopologySupplyResult
}
const WIRE = (await import(new URL('../src/plugin/live/governed-families/g1-query-wiring.mjs', import.meta.url).href)) as {
  createG1QueryWiring: (input: Record<string, unknown>) => { ok: boolean; code?: string; message?: string; definitions?: Array<{ name: string; execute: (args: unknown, exec: Record<string, unknown>) => Promise<unknown> }> }
}

type View = { platform: string; id: string; methods: Array<{ name: string }> }

/** A mutable directory behind the PUBLIC face shape the 639 service answers
 *  (synchronous list(), fresh view copies per read — plus read counters). */
function makeInspect(initial: View[] = [
  { platform: 'host', id: 'host-providers', methods: [{ name: 'list' }, { name: 'other' }] },
  { platform: 'client', id: 'slot-tree', methods: [{ name: 'list_slots' }] },
]) {
  const table = [...initial]
  let listCalls = 0
  return {
    face: {
      list: () => {
        listCalls += 1
        return table.map((view) => ({ platform: view.platform, id: view.id, methods: view.methods.map((m) => ({ name: m.name })) }))
      },
    },
    listCalls: () => listCalls,
    add: (view: View) => { table.push(view) },
    remove: (id: string) => { const at = table.findIndex((v) => v.id === id); if (at >= 0) table.splice(at, 1) },
    rename: (id: string, from: string, to: string) => { const view = table.find((v) => v.id === id); const method = view?.methods.find((m) => m.name === from); if (method !== undefined) method.name = to },
  }
}

function makeAuthorized(initial: Array<{ platform: string; provider: string; method: string }> = [
  { platform: 'host', provider: 'host-providers', method: 'list' },
]) {
  const scope = [...initial]
  let calls = 0
  const reader = () => { calls += 1; return scope.map((entry) => ({ ...entry })) }
  return {
    reader,
    calls: () => calls,
    add: (entry: { platform: string; provider: string; method: string }) => { scope.push(entry) },
    remove: (entry: { platform: string; provider: string; method: string }) => { const at = scope.findIndex((e) => e.platform === entry.platform && e.provider === entry.provider && e.method === entry.method); if (at >= 0) scope.splice(at, 1) },
    poison: () => { scope.push({ platform: 'host' } as unknown as { platform: string; provider: string; method: string }) },
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
const canonical = (value: unknown): string => JSON.stringify(value, (_key, item: unknown) => (
  isRecord(item) ? Object.fromEntries(Object.keys(item).sort().map((key) => [key, item[key]])) : item
))
/** spec-side INDEPENDENT mint of the whole expected face (root 01:01 laws). */
function expectedFace(allowedInput: readonly G1TopologyTriple[]): G1TrustedTopologyFace {
  const allowed = [...allowedInput].sort((a, b) => a.platform.localeCompare(b.platform) || a.provider.localeCompare(b.provider) || a.method.localeCompare(b.method))
  const digestHex = createHash('sha256').update(canonical(allowed)).digest('hex')
  return Object.freeze({
    topologyRevision: Number.parseInt(digestHex.slice(0, 13), 16),
    topologyDigest: `sha256:${digestHex}`,
    allowed: Object.freeze(allowed.map((t) => Object.freeze({ ...t }))),
  })
}

function unwrap(result: G1TrustedTopologySupplyResult): G1TrustedTopologySupply {
  if (result.ok !== true) throw new Error(`supply must answer ok (fixture): ${JSON.stringify(result)}`)
  return result.supply
}
function faceOf(supply: G1TrustedTopologySupply): G1TrustedTopologyFace {
  const answer = supply.current()
  if (answer === undefined) throw new Error('fixture sources are well-formed — the supply must answer the face, not undefined')
  return answer
}

describe('a5m2-g1-trusted-topology-supply: same-read intersection, canonical full-summary digest, deterministic content-version revision', () => {
  it('(A) arm law: no inspect face -> INSPECT_ABSENT; no live authorized reader -> AUTHORIZED_ABSENT', () => {
    for (const bad of [{}, { inspect: 7 }, { inspect: {} }]) {
      const refused = TOPO.createG1TrustedTopologySupply({ ...bad, authorized: () => [] })
      expect(refused.ok).toBe(false)
      expect(refused.ok === false && refused.code).toBe(TOPO.A5_G1_TRUSTED_TOPOLOGY_SUPPLY_CODES.INSPECT_ABSENT)
    }
    for (const bad of [{}, { authorized: [] }, { authorized: 'snapshot' }]) {
      const refused = TOPO.createG1TrustedTopologySupply({ inspect: makeInspect().face, ...bad })
      expect(refused.ok).toBe(false)
      expect(refused.ok === false && refused.code).toBe(TOPO.A5_G1_TRUSTED_TOPOLOGY_SUPPLY_CODES.AUTHORIZED_ABSENT)
    }
  })

  it('(B) allowed is the same-read INTERSECTION: visible-but-unauthorized excluded, authorized-but-not-visible absent, frozen and sorted', () => {
    const inspect = makeInspect()
    const authorized = makeAuthorized([
      { platform: 'host', provider: 'host-providers', method: 'list' },
      { platform: 'client', provider: 'ghost-provider', method: 'list' }, // authorized but NOT visible
    ])
    const supply = unwrap(TOPO.createG1TrustedTopologySupply({ inspect: inspect.face, authorized: authorized.reader }))
    const face = faceOf(supply)
    expect([...face.allowed]).toEqual([{ platform: 'host', provider: 'host-providers', method: 'list' }])
    expect(face.allowed.some((t) => t.provider === 'other' || t.provider === 'slot-tree' || t.provider === 'ghost-provider')).toBe(false)
    expect(Object.isFrozen(face.allowed)).toBe(true)
    expect(Object.isFrozen(face.allowed[0])).toBe(true)
    expect(supply.revision).toBe(TOPO.A5_G1_TRUSTED_TOPOLOGY_SUPPLY_REVISION)
  })

  it('(B2) ROOT 14575 collision control: separator-injected cross-field triples never authorize each other; exotic strings keep FULL values', () => {
    // host validateManifest imposes NO character grammar (only non-blank),
    // so control characters ARE reachable directory/scope strings. The old
    // NUL-join keys collided across field boundaries; the JSON-tuple encoding
    // is injective — these two distinct triples must never match:
    const inspect = makeInspect([
      { platform: 'host', id: 'a', methods: [{ name: 'b\u0000c' }] }, // directory triple: (host, 'a', 'b\0c')
    ])
    const collidingScope = makeAuthorized([
      { platform: 'host', provider: 'a\u0000b', method: 'c' }, // a DIFFERENT triple with the same old NUL-join key
    ])
    const collided = unwrap(TOPO.createG1TrustedTopologySupply({ inspect: inspect.face, authorized: collidingScope.reader }))
    expect([...faceOf(collided).allowed]).toEqual([]) // NOT authorized — the collision must fail closed
    // and the EXACT exotic triple still authorizes with values kept FULL
    // (no trim, no normalization, no field drop):
    const exactWrong = makeAuthorized([
      { platform: 'host', provider: 'a', method: 'b\u0000c ' }, // trailing space must NOT be trimmed away
    ])
    const wrongSupply = unwrap(TOPO.createG1TrustedTopologySupply({ inspect: inspect.face, authorized: exactWrong.reader }))
    expect([...faceOf(wrongSupply).allowed]).toEqual([])
    const exactRight = makeAuthorized([
      { platform: 'host', provider: 'a', method: 'b\u0000c' },
    ])
    const exact = unwrap(TOPO.createG1TrustedTopologySupply({ inspect: inspect.face, authorized: exactRight.reader }))
    expect([...faceOf(exact).allowed]).toEqual([{ platform: 'host', provider: 'a', method: 'b\u0000c' }])
  })

  it('(C) the whole face equals an independent recomputation, and the revision is the deterministic content-version safe int (two supplies, same content, same pair)', () => {
    const a = unwrap(TOPO.createG1TrustedTopologySupply({ inspect: makeInspect().face, authorized: makeAuthorized().reader }))
    const b = unwrap(TOPO.createG1TrustedTopologySupply({ inspect: makeInspect().face, authorized: makeAuthorized().reader }))
    const face = faceOf(a)
    expect(JSON.parse(JSON.stringify(face))).toEqual(JSON.parse(JSON.stringify(expectedFace([{ platform: 'host', provider: 'host-providers', method: 'list' }]))))
    expect(Number.isSafeInteger(face.topologyRevision) && face.topologyRevision >= 0).toBe(true)
    // deterministic CONTENT version: independent mounts over the same content
    // answer the identical pair (revision is never mount identity or a count)
    expect(face.topologyRevision).toBe(faceOf(b).topologyRevision)
    expect(face.topologyDigest).toBe(faceOf(b).topologyDigest)
    // the revision is a derivative of the SAME canonical digest — it never
    // carries information the full-summary digest does not
    expect(face.topologyRevision).toBe(Number.parseInt(face.topologyDigest.slice('sha256:'.length, 'sha256:'.length + 13), 16))
  })

  it('(D) lifecycle without ABA claims: merely-VISIBLE additions leave the face equal; content movement moves both facts; returning the content returns the SAME pair', () => {
    const inspect = makeInspect()
    const authorized = makeAuthorized()
    const supply = unwrap(TOPO.createG1TrustedTopologySupply({ inspect: inspect.face, authorized: authorized.reader }))
    const before = faceOf(supply)
    // publicly visible is NOT authorized: a new UNAUTHORIZED provider changes nothing
    inspect.add({ platform: 'client', id: 'page-state', methods: [{ name: 'current' }] })
    const afterVisible = faceOf(supply)
    expect(afterVisible.topologyDigest).toBe(before.topologyDigest)
    expect(afterVisible.topologyRevision).toBe(before.topologyRevision)
    // authorizing + a directory removal moves BOTH facts together
    inspect.remove('slot-tree')
    authorized.add({ platform: 'client', provider: 'page-state', method: 'current' })
    const afterContent = faceOf(supply)
    expect(afterContent.topologyDigest).not.toBe(before.topologyDigest)
    expect(afterContent.topologyRevision).not.toBe(before.topologyRevision)
    expect([...afterContent.allowed]).toEqual([
      { platform: 'client', provider: 'page-state', method: 'current' },
      { platform: 'host', provider: 'host-providers', method: 'list' },
    ])
    // returning the SAME normalized content returns the SAME pair — M0
    // equality semantics, explicitly no monotonic/ABA guarantee either way
    inspect.remove('page-state')
    authorized.remove({ platform: 'client', provider: 'page-state', method: 'current' })
    const restored = faceOf(supply)
    expect(restored.topologyDigest).toBe(before.topologyDigest)
    expect(restored.topologyRevision).toBe(before.topologyRevision)
    // a method rename inside an authorized provider moves the digest
    inspect.rename('host-providers', 'list', 'list_v2')
    authorized.remove({ platform: 'host', provider: 'host-providers', method: 'list' })
    authorized.add({ platform: 'host', provider: 'host-providers', method: 'list_v2' })
    expect(faceOf(supply).topologyDigest).not.toBe(before.topologyDigest)
  })

  it('(E1) THROUGH THE SIGNED WIRING: the full face mounts the real B-INSPECT row — one walk, one native run, topology-constrained answer', async () => {
    const inspect = makeInspect()
    const authorized = makeAuthorized()
    const supply = unwrap(TOPO.createG1TrustedTopologySupply({ inspect: inspect.face, authorized: authorized.reader }))
    const nativeCalls: unknown[] = []
    let admits = 0
    const native = {
      name: 'cordis_inspect_list',
      description: 'captured native face for the topology contract control',
      parameters: {},
      output: { schema: { type: 'object', properties: {}, additionalProperties: false }, render: () => [] },
      timeoutMs: 60000,
      async execute() {
        nativeCalls.push(1)
        return {
          providers: [
            { platform: 'host', id: 'host-providers', methods: [{ name: 'list' }, { name: 'not-authorized-method' }] },
            { platform: 'client', id: 'rogue-unauthorized', methods: [{ name: 'list_slots' }] },
          ],
        }
      },
    }
    const wiring = WIRE.createG1QueryWiring({
      providerId: 'g1-topo-contract-p1',
      captured: { cordis_inspect_list: Object.freeze({ native, definitionIdentity: 'g1-capture@g1-topo-contract-p1@cordis_inspect_list#contract' }) },
      placementFeed: () => undefined,
      trusted: { memberAgentId: 'agent-1', sessionHeaderId: 'session-1', realmId: 'realm-topo', owner: 'owner-1', profileId: 'profile-1' },
      bindingFacts: () => ({ bindingId: 'binding-1', bindingRevision: 1, policyGeneration: 1, authorityGeneration: 1 }),
      ports: Object.freeze({ trustedTopology: supply }),
      admit: async () => { admits += 1; return { ok: true } },
    })
    if (wiring.ok !== true || wiring.definitions === undefined) throw new Error(`wiring must mount the supply face: ${JSON.stringify(wiring)}`)
    const row = wiring.definitions[0]
    if (row === undefined) throw new Error('fixture wiring must carry the inspect_list row')
    const value = await row.execute({}, { callId: 'call-topo-1', agent: {} }) as Record<string, unknown>
    expect(admits).toBe(1)
    expect(nativeCalls.length).toBe(1)
    // the answer is constrained to the CURRENT authorized topology (list law):
    // methods and providers outside `allowed` never appear
    expect(JSON.stringify(value)).toContain('host-providers')
    expect(JSON.stringify(value)).not.toContain('rogue-unauthorized')
    expect(JSON.stringify(value)).not.toContain('not-authorized-method')
  })

  it('(E2) an absent or ill-shaped source answers undefined and the real row refuses with the adapter\'s OWN P_G1_TRUSTED_TOPOLOGY_ABSENT — zero admits, zero native entry', async () => {
    const absentDir = unwrap(TOPO.createG1TrustedTopologySupply({ inspect: { list: () => undefined }, authorized: makeAuthorized().reader }))
    expect(absentDir.current()).toBeUndefined()
    const poisoned = unwrap(TOPO.createG1TrustedTopologySupply({ inspect: makeInspect().face, authorized: (() => { const a = makeAuthorized(); a.poison(); return a.reader })() }))
    expect(poisoned.current()).toBeUndefined()
    const halfMethod = unwrap(TOPO.createG1TrustedTopologySupply({ inspect: { list: () => [{ platform: 'host', id: 'x', methods: [{ label: 'no name' }] }] }, authorized: makeAuthorized().reader }))
    expect(halfMethod.current()).toBeUndefined()

    const nativeCalls: unknown[] = []
    let admits = 0
    const wiring = WIRE.createG1QueryWiring({
      providerId: 'g1-topo-contract-p2',
      captured: { cordis_inspect_list: Object.freeze({ native: {
        name: 'cordis_inspect_list',
        description: 'captured native face',
        parameters: {},
        output: { schema: { type: 'object', properties: {}, additionalProperties: false }, render: () => [] },
        timeoutMs: 60000,
        async execute() { nativeCalls.push(1); return {} },
      }, definitionIdentity: 'g1-capture@g1-topo-contract-p2@cordis_inspect_list#contract' }) },
      placementFeed: () => undefined,
      trusted: { memberAgentId: 'agent-1', sessionHeaderId: 'session-1', realmId: 'realm-topo', owner: 'owner-1', profileId: 'profile-1' },
      bindingFacts: () => ({ bindingId: 'binding-1', bindingRevision: 1, policyGeneration: 1, authorityGeneration: 1 }),
      ports: Object.freeze({ trustedTopology: absentDir }),
      admit: async () => { admits += 1; return { ok: true } },
    })
    if (wiring.ok !== true || wiring.definitions === undefined) throw new Error(`wiring must mount: ${JSON.stringify(wiring)}`)
    const row = wiring.definitions[0]
    if (row === undefined) throw new Error('fixture wiring must carry the inspect_list row')
    await expect(row.execute({}, { callId: 'call-topo-2', agent: {} })).rejects.toThrow(/P_G1_TRUSTED_TOPOLOGY_ABSENT/)
    expect(admits).toBe(0)
    expect(nativeCalls.length).toBe(0)
  })

  it('(F) every current() reads BOTH public sources exactly once — zero cache', () => {
    const inspect = makeInspect()
    const authorized = makeAuthorized()
    const supply = unwrap(TOPO.createG1TrustedTopologySupply({ inspect: inspect.face, authorized: authorized.reader }))
    expect(inspect.listCalls()).toBe(0)
    expect(authorized.calls()).toBe(0)
    faceOf(supply); faceOf(supply); faceOf(supply)
    expect(inspect.listCalls()).toBe(3)
    expect(authorized.calls()).toBe(3)
  })

  describe('(G) source-text controls', () => {
    const source = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../src/plugin/live/governed-families/g1-trusted-topology-supply.mjs'), 'utf8')
    it('the static closure is exactly [node:crypto]; no lane, host, or dynamic specifier; no private symbols', () => {
      const statics = [...source.matchAll(/^\s*import\s+(?:[\s\S]*?)\s*from\s*'([^']+)'/gm)].map((m) => String(m[1]))
      expect([...new Set(statics)].sort()).toEqual(['node:crypto'])
      expect(source.match(/(^|[^.\w])import\s*\(/m)).toBeNull()
      expect(/\bSymbol\s*\./.test(source)).toBe(false)
      expect(/(?:^|[\s{,])#\w/.test(source)).toBe(false)
      // ROOT 14575 regression guard: no separator-join identity may return —
      // triple identity stays the injective JSON tuple encoding.
      expect(source.includes('\\u0000')).toBe(false)
      expect(source.includes('JSON.stringify([t.platform')).toBe(true)
    })

    it('no constant revision/digest literal can stand in for the derived values; no adapter/plane/bindings edge', () => {
      expect(/(?:topology)?[Rr]evision\s*[:=]\s*\d/.test(source)).toBe(false)
      expect(/sha256:[0-9a-f]/.test(source)).toBe(false)
      for (const banned of ['g1-surface-adapters', 'g1-query-wiring', 'g1-query-assembly', 'team-tool-plane', 'agent-bindings', 'deepseek-harness-test-use', '@deepseek-ai']) {
        expect(new RegExp(`from\\s*'[^']*${banned}[^']*'`).test(source), `forbidden import specifier reaches the source: ${banned}`).toBe(false)
      }
    })
  })
})
