/**
 * u7-w0b S2 — the ONE approval-entry binder carries the bind-once law for
 * EVERY migrated family (it replaced five per-family near-copies; see
 * dev/agent-workflow/evidence/u7-w0b-20261026/S1-MAP.md §2).
 *
 * Clauses, each pinned per family and per claimed name:
 *  B1 BIND ONCE — the first consult binds a (scopeKey, name) entry; a
 *     re-consult answers the SAME entry (same identity, same generation).
 *  B2 FAMILY FROM THE DESCRIPTOR — the bound familyId is the one the
 *     registered descriptor that claims the name carries; the binder takes
 *     no familyId argument at all.
 *  B3 PRE-MINT IS NOT LATCHED — an unminted identity answers null and a
 *     later consult in the same mount still binds.
 *  B4 INVALIDATION GOES SILENT — after the family's entries are dropped, or
 *     the family is revoked and RE-REGISTERED, the name answers null for
 *     the rest of the mount (never re-mints, never resurrects), and the
 *     other families' entries are untouched.
 *  B5 UNCLAIMED NAMES NEVER BIND — a name no registered candidate claims
 *     answers null without touching the kernel and without latching.
 *
 * Layer P runs B1/B2/B4 through the REAL plane mount (all four families,
 * the jobs bridge registered). Layer U runs B1–B5 against the binder over a
 * REAL kernel + registry (B3 needs a controllable mint). Layer M plants
 * broken binders and proves the Layer-U law catches each one.
 */
import { describe, expect, it } from 'vitest'
import { approvingControlLeg } from './a5-m1-control-legs.mjs'
import { definitionIdentityOf } from '../tool-dispatch/index.js'
import { createGovernanceKernel, createGovernedFamilyRegistry } from '../governance-center/index.js'

const REALM = 'u7w0b-realm'
const ROOT = 'u7w0b-team-root'

const FAMILIES = Object.freeze({
  'dsh.fs-family': ['read', 'write', 'edit', 'read_image'],
  'dsh.process-family': ['team_bash'],
  'dsh.search-family': ['team_grep', 'team_glob'],
  'dsh.jobs-family': ['job_output', 'job_list', 'job_kill'],
} as const)
type FamilyId = keyof typeof FAMILIES
const FAMILY_IDS = Object.keys(FAMILIES) as FamilyId[]

type Entry = { definitionIdentity: string; familyId: string; scopeKey: string; addedGeneration: number }
interface Kernel {
  approvalFor(scopeKey: string, name: string): Entry | undefined
  addApprovalEntry(e: Record<string, unknown>): { ok: boolean; code?: string }
  dropApprovalsForFamily(familyId: string): number
  publish(): { ok: boolean; code?: string }
}
interface Registry {
  register(c: unknown, o?: { origin?: string }): { ok: boolean; code?: string; detail?: string }
  revoke(familyId: string, reason: string): { ok: boolean }
  candidateFor(name: string): { familyId: string; contribution: unknown } | undefined
  generation(): number
}
interface PlaneValue {
  readonly definitions: ReadonlyArray<{ name: string }>
  readonly placementFeed: (name: string) => { definitionIdentity: string; realmId: string } | undefined
  readonly kernelGuard: { owns(name: string): boolean; identityFor(name: string): string | null }
  readonly centerKernel: { kernel: Kernel; registry: Registry; scopeKey: string; familyIds: readonly string[] }
}
type Binder = (name: string) => Entry | null
type BinderFactory = (deps: {
  kernel: Kernel
  scopeKey: string
  claimOf: (name: string) => string | undefined
  placedDefinition: (name: string) => object | undefined
  identityOf: (d: object) => string | null
}) => Binder
interface BinderModule {
  createApprovalEntryBinder: BinderFactory
  claimTableOf(registry: unknown): ReadonlyMap<string, string>
}

const binderModule = async (): Promise<BinderModule> =>
  (await import(new URL('../src/plugin/live/approval-entry-binder.mjs', import.meta.url).href)) as BinderModule

async function mountAll(): Promise<PlaneValue> {
  const plane = (await import(new URL('../src/plugin/live/team-tool-plane.mjs', import.meta.url).href)) as {
    createTeamToolPlaneAssembly(i: Record<string, unknown>): { ok: boolean; value?: unknown; code?: string; message?: string }
  }
  const bridgeMod = (await import(new URL('../src/plugin/live/jobs-family-bridge.mjs', import.meta.url).href)) as {
    createGovernedJobsBridge(o: Record<string, unknown>): unknown
  }
  const bridge = bridgeMod.createGovernedJobsBridge({
    scopeKey: 'u7w0b-scope', viewer: { rootSessionId: ROOT, instanceId: 'u7w0b-instance' },
    gatewayRow: () => null, planeRow: () => null, jobsService: () => undefined,
  })
  const built = plane.createTeamToolPlaneAssembly({
    dispatcherLifecycle: { inflight: () => 0 },
    teamSessionId: ROOT,
    controlLeg: approvingControlLeg(),
    permissionPolicy: { default: 'deny', allow: [], ask: [], deny: [] },
    realmId: REALM,
    templateId: 'u7w0b-tpl',
    role: 'member',
    instanceId: 'u7w0b-instance',
    onObserve: () => {},
    plane: { fsInstance: { fs: 'u7w0b-ctl', rootDir: '/u7w0b-unit-root', realmId: REALM, kind: 'absolute-path' }, jobsEnabled: true },
    backends: { jobs: bridge },
  })
  if (built.ok !== true) throw new Error(`assembly refused: ${String(built.code)} ${String(built.message ?? '')}`)
  return built.value as PlaneValue
}

describe('u7-w0b P — the plane binds every family through the ONE binder', () => {
  it('P0 the mount registers all four families on ONE kernel (the universe the law is checked over)', async () => {
    const v = await mountAll()
    expect([...v.centerKernel.familyIds]).toEqual(FAMILY_IDS)
  })

  for (const familyId of FAMILY_IDS) {
    for (const name of FAMILIES[familyId]) {
      it(`P1/P2 ${familyId} :: ${name} binds ONCE to the claiming descriptor's family`, async () => {
        const v = await mountAll()
        const { kernel, registry, scopeKey } = v.centerKernel
        expect(v.kernelGuard.owns(name)).toBe(true)
        const fed = v.placementFeed(name)
        const def = v.definitions.find((d) => d.name === name)
        if (def === undefined || fed === undefined) throw new Error(`${name}: not placed / not fed`)
        expect(fed.definitionIdentity).toBe(definitionIdentityOf(def))
        const entry = kernel.approvalFor(scopeKey, name)
        expect(entry?.familyId).toBe(familyId)
        expect(entry?.familyId).toBe(registry.candidateFor(name)?.familyId)
        const gen = entry?.addedGeneration
        // re-consult through BOTH doors: same entry, no re-mint
        expect(v.kernelGuard.identityFor(name)).toBe(fed.definitionIdentity)
        expect(v.placementFeed(name)?.definitionIdentity).toBe(fed.definitionIdentity)
        expect(kernel.approvalFor(scopeKey, name)?.addedGeneration).toBe(gen)
      })
    }

    it(`P4 ${familyId}: drop → SILENT forever; revoke + re-register → never resurrects; siblings untouched`, async () => {
      const v = await mountAll()
      const { kernel, registry, scopeKey } = v.centerKernel
      for (const n of Object.values(FAMILIES).flat()) expect(v.placementFeed(n), `${n} binds first`).toBeDefined()
      const contribution = registry.candidateFor(FAMILIES[familyId][0])?.contribution
      kernel.dropApprovalsForFamily(familyId)
      for (const n of FAMILIES[familyId]) {
        expect(v.placementFeed(n)).toBeUndefined()
        expect(v.kernelGuard.identityFor(n)).toBeNull()
        expect(kernel.approvalFor(scopeKey, n)).toBeUndefined()
      }
      // the same reviewed descriptor comes back under a NEW generation: the
      // mount still never re-binds (only a fresh mount approves).
      expect(registry.revoke(familyId, 'u7w0b law test').ok).toBe(true)
      expect(registry.register(contribution, { origin: 'reviewed-manifest' }).ok).toBe(true)
      for (const n of FAMILIES[familyId]) {
        expect(v.placementFeed(n)).toBeUndefined()
        expect(v.kernelGuard.identityFor(n)).toBeNull()
        expect(kernel.approvalFor(scopeKey, n)).toBeUndefined()
      }
      for (const other of FAMILY_IDS.filter((f) => f !== familyId)) {
        for (const n of FAMILIES[other]) expect(v.placementFeed(n), `${other} :: ${n} untouched`).toBeDefined()
      }
    })
  }
})

/* ── Layer U: the binder over a REAL kernel + registry ─────────────────── */

const SCOPE = 'u7w0b-root:u7w0b-instance'

function contributionFor(familyId: string, nativeNames: readonly string[]) {
  const digest = (familyId.length % 16).toString(16).repeat(64)
  return {
    schemaVersion: { major: 1, minor: 0, patch: 0 },
    familyId,
    familyVersion: '1.0.0',
    source: { kind: 'family-owned' as const, selector: `lane:u7w0b:${familyId}`, digest },
    provider: { id: 'provider.u7w0b', digest },
    requiredCapabilities: [],
    optionalCapabilities: [],
    visibility: { owner: 'family' as const, nativeNames: [...nativeNames], aliases: [], profileRequirements: [] },
    definition: { owner: 'family' as const, inputContractDigest: digest, outputContractDigest: digest, normalization: 'pure' as const },
    effects: { declared: false, kinds: [], targets: [] },
    execution: { declared: false, via: 'family-body' as const },
    lifecycle: { owner: 'kernel' as const, drain: 'kernel-owned' as const, cancelBoundary: 'host-signal' },
    result: { envelope: 'host' as const, correlation: 'kernel' as const },
    obligations: { admission: 'kernel' as const, grantMint: 'kernel' as const, grantConsume: 'kernel' as const },
  }
}

/** A real kernel+registry world with every family registered, a placed
 *  object per claimed name, and a CONTROLLABLE mint (`minted` set). */
async function world(factory: BinderFactory) {
  const mod = await binderModule()
  const registry = createGovernedFamilyRegistry({ kernelManifest: { capabilities: {} } }) as unknown as Registry
  const kernel = createGovernanceKernel({
    registry: registry as never,
    mode: 'enforcing',
    ports: { lifecycle: { inflight: () => 0 } },
  }) as unknown as Kernel
  expect(kernel.publish().ok).toBe(true)
  for (const f of FAMILY_IDS) {
    const r = registry.register(contributionFor(f, FAMILIES[f]), { origin: 'reviewed-manifest' })
    if (!r.ok) throw new Error(`fixture register refused: ${String(r.detail)}`)
  }
  const placed = new Map<string, object>([...Object.values(FAMILIES).flat(), 'unclaimed_row'].map((n) => [n, { name: n }]))
  const minted = new Set<string>(placed.keys())
  const ids = new Map<string, string>([...placed.keys()].map((n, i) => [n, `def#u7w0b-${String(i)}`]))
  let adds = 0
  const countingKernel: Kernel = {
    ...kernel,
    approvalFor: (s, n) => kernel.approvalFor(s, n),
    addApprovalEntry: (e) => {
      adds += 1
      return kernel.addApprovalEntry(e)
    },
    dropApprovalsForFamily: (f) => kernel.dropApprovalsForFamily(f),
    publish: () => kernel.publish(),
  }
  const claims = mod.claimTableOf(registry)
  const bind = factory({
    kernel: countingKernel,
    scopeKey: SCOPE,
    claimOf: (n) => claims.get(n),
    placedDefinition: (n) => placed.get(n),
    identityOf: (d) => {
      const n = (d as { name: string }).name
      return minted.has(n) ? (ids.get(n) ?? null) : null
    },
  })
  return { bind, kernel, registry, minted, ids, adds: () => adds }
}

/** The Layer-U law, returned as named clause verdicts so Layer M can show
 *  WHICH clause a planted binder breaks. */
async function lawVerdicts(factory: BinderFactory): Promise<Record<string, boolean>> {
  const out: Record<string, boolean> = {}
  const check = async (clause: string, body: () => Promise<void>) => {
    try {
      await body()
      out[clause] = out[clause] ?? true
    } catch {
      out[clause] = false
    }
  }
  for (const f of FAMILY_IDS) {
    for (const name of FAMILIES[f]) {
      await check('B1', async () => {
        const w = await world(factory)
        const first = w.bind(name)
        expect(first?.definitionIdentity).toBe(w.ids.get(name))
        const second = w.bind(name)
        expect(second?.definitionIdentity).toBe(first?.definitionIdentity)
        expect(second?.addedGeneration).toBe(first?.addedGeneration)
        expect(w.adds()).toBe(1)
      })
      await check('B2', async () => {
        const w = await world(factory)
        expect(w.bind(name)?.familyId).toBe(f)
        expect(w.kernel.approvalFor(SCOPE, name)?.familyId).toBe(w.registry.candidateFor(name)?.familyId)
      })
      await check('B3', async () => {
        const w = await world(factory)
        w.minted.delete(name)
        expect(w.bind(name)).toBeNull()
        expect(w.bind(name)).toBeNull()
        expect(w.adds()).toBe(0)
        w.minted.add(name)
        expect(w.bind(name)?.definitionIdentity).toBe(w.ids.get(name))
      })
      await check('B4', async () => {
        const w = await world(factory)
        for (const n of Object.values(FAMILIES).flat()) expect(w.bind(n)).not.toBeNull()
        w.kernel.dropApprovalsForFamily(f)
        expect(w.bind(name)).toBeNull()
        expect(w.registry.revoke(f, 'u7w0b').ok).toBe(true)
        expect(w.registry.register(contributionFor(f, FAMILIES[f]), { origin: 'reviewed-manifest' }).ok).toBe(true)
        expect(w.bind(name)).toBeNull()
        expect(w.bind(name)).toBeNull()
        expect(w.kernel.approvalFor(SCOPE, name)).toBeUndefined()
        for (const other of FAMILY_IDS.filter((x) => x !== f)) {
          for (const n of FAMILIES[other]) expect(w.bind(n)).not.toBeNull()
        }
      })
    }
  }
  await check('B5', async () => {
    const w = await world(factory)
    expect(w.bind('unclaimed_row')).toBeNull()
    expect(w.adds()).toBe(0)
    // also no latch: the claim table is mount-time, so the name stays
    // unclaimed — but a forged claimOf must still not have been consulted
    // into an entry
    expect(w.kernel.approvalFor(SCOPE, 'unclaimed_row')).toBeUndefined()
  })
  return out
}

describe('u7-w0b U — the binder law over a real kernel + registry', () => {
  it('B1–B5 hold for every family and every claimed name', async () => {
    const { createApprovalEntryBinder } = await binderModule()
    expect(await lawVerdicts(createApprovalEntryBinder)).toEqual({ B1: true, B2: true, B3: true, B4: true, B5: true })
  })

  it('the binder accepts no familyId input (B2 by construction)', async () => {
    const src = (await import('node:fs')).readFileSync(new URL('../src/plugin/live/approval-entry-binder.mjs', import.meta.url), 'utf8')
    const sig = /export function createApprovalEntryBinder\(\{([^}]*)\}\)/.exec(src)?.[1] ?? ''
    expect(sig.split(',').map((s) => s.trim()).sort()).toEqual(['claimOf', 'identityOf', 'kernel', 'placedDefinition', 'scopeKey'])
  })
})

/* ── Layer M: planted broken binders — the law must catch each ───────── */

const plantedLatchBeforeMint: BinderFactory = ({ kernel, scopeKey, claimOf, placedDefinition, identityOf }) => {
  const attempted = new Set<string>()
  return (name) => {
    const familyId = claimOf(name)
    if (familyId === undefined) return null
    const existing = kernel.approvalFor(scopeKey, name)
    if (existing !== undefined) return existing
    if (attempted.has(name)) return null
    attempted.add(name) // BUG: latches before the mint check
    const d = placedDefinition(name)
    const identity = d === undefined ? null : identityOf(d)
    if (identity === null) return null
    return kernel.addApprovalEntry({ scopeKey, nativeName: name, definitionIdentity: identity, familyId }).ok ? kernel.approvalFor(scopeKey, name) ?? null : null
  }
}
const plantedNoLatch: BinderFactory = ({ kernel, scopeKey, claimOf, placedDefinition, identityOf }) => (name) => {
  const familyId = claimOf(name)
  if (familyId === undefined) return null
  const existing = kernel.approvalFor(scopeKey, name)
  if (existing !== undefined) return existing
  const d = placedDefinition(name)
  const identity = d === undefined ? null : identityOf(d)
  if (identity === null) return null
  // BUG: no latch — an invalidated entry is re-minted on the next consult
  return kernel.addApprovalEntry({ scopeKey, nativeName: name, definitionIdentity: identity, familyId }).ok ? kernel.approvalFor(scopeKey, name) ?? null : null
}
const plantedFixedFamily: BinderFactory = ({ kernel, scopeKey, claimOf, placedDefinition, identityOf }) => {
  const attempted = new Set<string>()
  return (name) => {
    if (claimOf(name) === undefined) return null
    const existing = kernel.approvalFor(scopeKey, name)
    if (existing !== undefined) return existing
    if (attempted.has(name)) return null
    const d = placedDefinition(name)
    const identity = d === undefined ? null : identityOf(d)
    if (identity === null) return null
    attempted.add(name)
    // BUG: a caller-style literal instead of the claiming descriptor's id
    return kernel.addApprovalEntry({ scopeKey, nativeName: name, definitionIdentity: identity, familyId: 'dsh.fs-family' }).ok ? kernel.approvalFor(scopeKey, name) ?? null : null
  }
}
const plantedNoClaimGate: BinderFactory = ({ kernel, scopeKey, claimOf, placedDefinition, identityOf }) => {
  const attempted = new Set<string>()
  return (name) => {
    const familyId = claimOf(name) ?? 'dsh.fs-family' // BUG: unclaimed names get a guessed family
    const existing = kernel.approvalFor(scopeKey, name)
    if (existing !== undefined) return existing
    if (attempted.has(name)) return null
    const d = placedDefinition(name)
    const identity = d === undefined ? null : identityOf(d)
    if (identity === null) return null
    attempted.add(name)
    return kernel.addApprovalEntry({ scopeKey, nativeName: name, definitionIdentity: identity, familyId }).ok ? kernel.approvalFor(scopeKey, name) ?? null : null
  }
}

describe('u7-w0b M — the law is falsifiable (planted binders go RED on the expected clause)', () => {
  it('latch-before-mint breaks B3 (pre-mint must not latch)', async () => {
    expect((await lawVerdicts(plantedLatchBeforeMint)).B3).toBe(false)
  })
  it('no-latch breaks B4 (invalidation must stay silent)', async () => {
    expect((await lawVerdicts(plantedNoLatch)).B4).toBe(false)
  })
  it('a fixed familyId breaks B2 for every non-fs family', async () => {
    expect((await lawVerdicts(plantedFixedFamily)).B2).toBe(false)
  })
  it('a guessed family for unclaimed names breaks B5', async () => {
    expect((await lawVerdicts(plantedNoClaimGate)).B5).toBe(false)
  })
})
