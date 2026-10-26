/**
 * U6 PR4 — ARC-C: the jobs bridge ON the governance kernel.
 *
 * Five groups, one claim each:
 *  A) THE MOVE LAW — the bridge body moved VERBATIM (sha-pinned), the old
 *     home keeps only a re-export edge, and the bridge module imports
 *     NOTHING that could hand it a second authority.
 *  B) THE CLOSED SCHEMA — the contribution is provider-backed, so the
 *     schema forces it through the NAMED bridge; every digest binds real
 *     source; the wiring refuses a forged/absent bridge BEFORE the schema.
 *  C) ONE KERNEL, ONE LEDGER — a real mount registers the jobs family as a
 *     THIRD candidate on the SAME kernel and the SAME approval table the
 *     read/shell names ride; the kernel-ownership predicate, the pb §6 feed
 *     and the bind-ONCE invalidation law are shared data, not a parallel
 *     mechanism; a bridgeless `jobsEnabled` mount contributes NO candidate
 *     (the shut rows are not a kernel claim).
 *  D) THE SAME ADMISSION PATH, END TO END — real plane + real gateway
 *     assembly + real bridge + counting host-service double: the gateway's
 *     definition pins are fed FROM THE KERNEL TABLE (one identity, two
 *     readers), the owner fence measures ZERO host reach, the un-attributed
 *     pass-through is the disclosed host-fence law, a kill is a REQUEST,
 *     and no trio call ever touches the approval lane (no second ledger).
 *  E) THE MOUNT-GENERATION LAW (CI-08) — pa-mount-registry imported
 *     UNMODIFIED (source sha-pinned): the old disposer cannot drop the new
 *     mount; the plant shows what the naive disposer would have destroyed.
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import { approvingControlLeg } from './a5-m1-control-legs.mjs'

const sha256 = (text: string): string => createHash('sha256').update(text, 'utf8').digest('hex')

/** node:fs accepts a node:url URL; the lib URL type of new URL() is a DIFFERENT
 *  interface for tsc — convert to a path at the read edge. */
const readSrc = (u: URL): string => readFileSync(fileURLToPath(u as Parameters<typeof fileURLToPath>[0]), 'utf8')
const BRIDGE_PATH = new URL('../src/plugin/live/jobs-family-bridge.mjs', import.meta.url)
const BACKENDS_PATH = new URL('../src/plugin/live/plane-effect-backends.mjs', import.meta.url)
const BINDINGS_PATH = new URL('../src/plugin/live/agent-bindings.mjs', import.meta.url)
const MOUNT_REGISTRY_PATH = new URL('../src/plugin/live/pa-mount-registry.mjs', import.meta.url)
const GATEWAY_PATH = new URL('../src/plugin/live/jobs-gateway-assembly.mjs', import.meta.url)

/** sup-b PoC-3 (g1fb-jobs-bridge.mjs PART 1) measured this digest over the
 *  master 3288567d3 extract (sed -n '1579,1850p'); the SAME region re-extracted
 *  from master 8337e52cf (sed -n '595,866p') hashes IDENTICAL — the PR2/PR3
 *  moves did not touch it. This file's moved region must keep hashing it. */
const MOVED_BODY_SHA = '71705d6eb1aaa9d0ae3fd22541f788a5dfb8dd07e6f96827db49e40283a9b29f'

/** The frozen bytes of the two files PR4 must import UNMODIFIED. */
const PA_MOUNT_REGISTRY_SHA = 'fa1d831d559d1016f6ee99e43436d3155b3f0c493a76fda021cc228f4c14510d'
const GATEWAY_ASSEMBLY_SHA = 'c99ecaadf2d34f8c313e539aee6ab9e247aad6e32b6087d29f12edaa08158b53'

const REALM = 'u6-pr4-arc-c-realm'
const ROOT = 'session-u6pr4-team-root'

type PlaneAssemblyResult =
  | { ok: true; value: PlaneValue }
  | { ok: false; code: string; message?: string }
interface PlaneModule { createTeamToolPlaneAssembly(input: Record<string, unknown>): PlaneAssemblyResult }
const planeModule = async (): Promise<PlaneModule> =>
  (await import(new URL('../src/plugin/live/team-tool-plane.mjs', import.meta.url).href)) as PlaneModule
interface RowLike {
  name: string
  execute(input: Record<string, unknown>, ctx: { agent?: { id: string } }): Promise<{ text: string }>
}
interface PlaneValue {
  readonly definitions: ReadonlyArray<RowLike>
  readonly kernelGuard: { owns(name: string): boolean; identityFor(name: string): string | null | undefined }
  readonly placementFeed: (name: string) => { definitionIdentity: string } | undefined
  readonly centerKernel: {
    readonly kernel: {
      approvalFor(scopeKey: string, name: string):
        { definitionIdentity: string; familyId: string; scopeKey: string } | undefined
      dropApprovalsForFamily(familyId: string): unknown
    }
    readonly registry: {
      register(input: unknown, opts?: { origin?: string }): { ok: boolean; code?: string; schemaCode?: string; detail?: string }
      revoke(familyId: string, reason?: string): unknown
      generation(): number
    }
    readonly scopeKey: string
    readonly familyIds: readonly string[]
  }
}
interface BridgeModule {
  createGovernedJobsBridge(opts: Record<string, unknown>): unknown
  ci05GovernedGatewayRow(asm: unknown): unknown
  buildJobsManagementRowDefs(o: Record<string, unknown>): RowLike[]
  buildJobsBridgeContribution(o: Record<string, unknown>): Record<string, unknown>
}
interface GatewayAssembly {
  attributeBackgroundJob(o: Record<string, unknown>): { ok: boolean; code?: string }
  definitions: { register(scopeKey: string, name: string, identity: string): unknown }
  observations(): string[]
  checkManagementAccess(o: { jobId: string; viewer: Record<string, unknown> }):
    { ok: boolean; corded?: boolean; code?: string; detail?: string }
}
interface GatewayModule {
  createLiveJobsGatewayAssembly(cfg: Record<string, unknown>): GatewayAssembly
  jobsBridgeScopeKey(o: Record<string, unknown>): string
}
const bridgeModule = async (): Promise<BridgeModule> =>
  (await import(BRIDGE_PATH.href)) as BridgeModule
const gatewayModule = async (): Promise<GatewayModule> =>
  (await import(GATEWAY_PATH.href)) as GatewayModule
const digestsOf = (c: Record<string, unknown>): { source: string; provider: string } => ({
  source: String((c.source as { digest?: string }).digest),
  provider: String((c.provider as { digest?: string }).digest),
})

/** A real mount; `over` reaches `input.plane`. Returns the plane value plus
 *  a controlLeg call counter (the approval lane's ONLY door — every PA
 *  approval leg lands there). */
async function mountValue(over: Record<string, unknown> = {}, bridge: unknown = null): Promise<{
  value: PlaneValue
  legCalls: () => number
}> {
  let legs = 0
  const leg = approvingControlLeg()
  const built = (await planeModule()).createTeamToolPlaneAssembly({
    dispatcherLifecycle: { inflight: () => 0 },
    teamSessionId: ROOT,
    controlLeg: async (input: unknown) => {
      legs += 1
      return await leg(input as never)
    },
    fs: { subtreeContains: ({ parent, child }: { parent: string; child: string }) => child === parent || child.startsWith(parent + '/') },
    permissionPolicy: { default: 'deny', allow: [{ tool: 'read', resource: { kind: 'any' } }], ask: [], deny: [] },
    realmId: REALM,
    templateId: 'u6pr4-tpl',
    role: 'member',
    instanceId: String(over.instanceId ?? 'u6pr4-instance'),
    onObserve: () => {},
    plane: {
      fsInstance: { fs: 'u6pr4-ctl', rootDir: '/u6pr4-unit-root', realmId: REALM, kind: 'absolute-path' },
      ...(over.plane as object | undefined ?? {}),
    },
    ...(bridge === null ? {} : { backends: { jobs: bridge } }),
  })
  if (!built.ok) throw new Error(`assembly refused: ${built.code} ${built.message ?? ''}`)
  return { value: built.value, legCalls: () => legs }
}

describe('u6-pr4 A — the move law (byte-identity, one home, no second authority)', () => {
  it('A1 the moved bridge body hashes IDENTICAL to the sup-b PoC-3 master extract', async () => {
    const text = readSrc(BRIDGE_PATH)
    const start = text.indexOf('export function createGovernedJobsBridge')
    expect(start).toBeGreaterThan(0)
    const seam = text.indexOf("/* ── U6 PR4: the bridge's CENTER FACE", start)
    expect(seam).toBeGreaterThan(start)
    // Same measurement as `sed -n '595,866p' … | sha256sum`: whole lines,
    // trailing newline kept.
    const region = text.slice(start, seam).replace(/\s+$/, '')
    const body = `${region}\n`
    expect(sha256(body)).toBe(MOVED_BODY_SHA)
  })

  it('A2 the old home carries NO body — only the re-export edge; production imports the bridge module directly', async () => {
    const backends = readSrc(BACKENDS_PATH)
    expect(backends).not.toContain('export function createGovernedJobsBridge')
    expect(backends).toContain("from './jobs-family-bridge.mjs'")
    const bindings = readSrc(BINDINGS_PATH)
    expect(bindings).toMatch(/import \{ createGovernedJobsBridge \} from '\.\/jobs-family-bridge\.mjs'/)
    expect(bindings).not.toMatch(/import \{ createGovernedJobsBridge \} from '\.\/plane-effect-backends\.mjs'/)
  })

  it('A3 the bridge module imports NOTHING but node:crypto + the contracts barrel (no second authority reachable)', async () => {
    const specifiers = [...readSrc(BRIDGE_PATH).matchAll(/^import [^']*'([^']+)'/gm)].map((m) => m[1])
    expect(specifiers.slice().sort()).toEqual(['../../../../contracts/src/index.js', 'node:crypto'])
  })
})

describe('u6-pr4 B — the closed schema forces the named bridge (and digests bind real source)', () => {
  async function trioDefs(): Promise<{ defs: RowLike[]; bridge: unknown }> {
    const mod = await bridgeModule()
    const bridge = mod.createGovernedJobsBridge({
      scopeKey: 'scope-b', viewer: { rootSessionId: ROOT, instanceId: 'inst-b' },
      gatewayRow: () => null, planeRow: () => null, jobsService: () => undefined,
    })
    const defs = mod.buildJobsManagementRowDefs({
      jobsBridge: bridge,
      shutJobsText: async () => ({ text: 'shut' }),
      PLANE_PRESENTATION_FACE: { schema: { type: 'object' }, render: () => [] },
    })
    return { defs, bridge }
  }

  it('B1 the honest descriptor registers on a jobs-management(named-bridge) manifest', async () => {
    const mod = await bridgeModule()
    const { createGovernedFamilyRegistry } = await import('../governance-center/index.js')
    const { defs, bridge } = await trioDefs()
    const registry = createGovernedFamilyRegistry({
      kernelManifest: { capabilities: { 'jobs-management': { backsExecution: 'named-bridge' } } },
    })
    const first = registry.register(mod.buildJobsBridgeContribution({
      bridge, definitions: defs, hostPin: '0.2.0-rc.2@639ed01539', cancelBoundary: 'request-only, Host settles',
    }), { origin: 'reviewed-manifest' })
    expect(first.ok, JSON.stringify(first)).toBe(true)
    // pure over inputs: the same inputs answer the same digests
    const registry2 = createGovernedFamilyRegistry({
      kernelManifest: { capabilities: { 'jobs-management': { backsExecution: 'named-bridge' } } },
    })
    const second = registry2.register(mod.buildJobsBridgeContribution({
      bridge, definitions: defs, hostPin: '0.2.0-rc.2@639ed01539', cancelBoundary: 'request-only, Host settles',
    }), { origin: 'reviewed-manifest' })
    expect(second.ok).toBe(true)
  })

  it('B2 a host-pin flip is a DIFFERENT contribution (CI-07 drift law)', async () => {
    const mod = await bridgeModule()
    const { defs, bridge } = await trioDefs()
    const a = mod.buildJobsBridgeContribution({ bridge, definitions: defs, hostPin: '0.2.0-rc.2@639ed01539', cancelBoundary: 'x' })
    const b = mod.buildJobsBridgeContribution({ bridge, definitions: defs, hostPin: '0.2.0-rc.3@deadbeef', cancelBoundary: 'x' })
    expect(digestsOf(a).source).not.toBe(digestsOf(b).source)
    expect(digestsOf(a).provider).not.toBe(digestsOf(b).provider)
  })

  it('B3 schema negatives: provider-backed WITHOUT the named bridge, and the capability backed only by a family body, both refuse', async () => {
    const mod = await bridgeModule()
    const { createGovernedFamilyRegistry } = await import('../governance-center/index.js')
    const { defs, bridge } = await trioDefs()
    const base = mod.buildJobsBridgeContribution({ bridge, definitions: defs, hostPin: 'pin@1', cancelBoundary: 'x' })
    const registry = createGovernedFamilyRegistry({
      kernelManifest: { capabilities: { 'jobs-management': { backsExecution: 'named-bridge' } } },
    })
    const noBridge = registry.register({
      ...base,
      execution: { declared: true, via: 'family-body' },
    }, { origin: 'reviewed-manifest' })
    expect(noBridge.ok).toBe(false)
    if (noBridge.ok) throw new Error('unreachable')
    // The registry wraps the schema code (registry.ts:115): the CLOSED-WORLD
    // refusal is INVALID_CONTRIBUTION carrying the schema's own code.
    expect(noBridge.schemaCode).toBe('NAMED_BRIDGE_REQUIRED')
    const familyBacked = createGovernedFamilyRegistry({
      kernelManifest: { capabilities: { 'jobs-management': { backsExecution: 'family-body' } } },
    })
    const unbacked = familyBacked.register(base, { origin: 'reviewed-manifest' })
    expect(unbacked.ok).toBe(false)
    if (unbacked.ok) throw new Error('unreachable')
    expect(unbacked.schemaCode).toBe('CAPABILITY_UNBACKED')
  })

  it('B4 the builder refuses a forged/absent bridge and a mutated name set BEFORE the schema sees anything', async () => {
    const mod = await bridgeModule()
    const { defs, bridge } = await trioDefs()
    expect(() => mod.buildJobsBridgeContribution({ bridge: null, definitions: defs, hostPin: 'p', cancelBoundary: 'x' })).toThrow(TypeError)
    expect(() => mod.buildJobsBridgeContribution({ bridge: { bridgeId: 'other-bridge' }, definitions: defs, hostPin: 'p', cancelBoundary: 'x' })).toThrow(TypeError)
    expect(() => mod.buildJobsBridgeContribution({ bridge, definitions: [defs[0]], hostPin: 'p', cancelBoundary: 'x' })).toThrow(TypeError)
  })
})

describe('u6-pr4 C — ONE kernel, ONE approval table: three families ride it (the no-second-ledger mount face)', () => {
  it('C1 jobsEnabled + a real bridge: a THIRD family on the SAME kernel; the trio entries live in the SAME table', async () => {
    const mod = await bridgeModule()
    const bridge = mod.createGovernedJobsBridge({
      scopeKey: 'scope-c1', viewer: { rootSessionId: ROOT, instanceId: 'u6pr4-instance' },
      gatewayRow: () => null, planeRow: () => null, jobsService: () => undefined,
    })
    const { value } = await mountValue({ plane: { jobsEnabled: true } }, bridge)
    const ck = value.centerKernel
    // MERGE (U6 PR5): the search family registers between shell and jobs on the
    // SAME kernel; registration order is fs, process, search, jobs.
    expect(ck.familyIds).toEqual(['dsh.fs-family', 'dsh.process-family', 'dsh.search-family', 'dsh.jobs-family'])
    const guard = value.kernelGuard
    expect(['read', 'team_bash', 'job_output', 'job_list', 'job_kill'].map((n) => guard.owns(n))).toEqual([true, true, true, true, true])
    expect(guard.owns('grep')).toBe(false)
    expect(guard.owns('job_killx')).toBe(false)
    for (const name of ['job_output', 'job_list', 'job_kill']) {
      const identity = guard.identityFor(name)
      expect(typeof identity).toBe('string')
      // THE table is the identity source: the pb §6 feed answers the SAME identity
      // the approval entry binds (one identity, not two ledgers).
      expect(value.placementFeed(name)?.definitionIdentity).toBe(identity)
      const entry = ck.kernel.approvalFor(ck.scopeKey, name)
      if (entry === undefined) throw new Error(`no kernel entry bound for ${name}`)
      expect(entry.definitionIdentity).toBe(identity)
      expect(entry.familyId).toBe('dsh.jobs-family')
    }
    // ONE ownership predicate drives EVERYTHING: the pb §6 feed arm and the
    // consumeOnce edge both call this same guard.owns (the plane source has
    // no other kernel-ownership test — see the PR4 diff hunks); here: the
    // guard answers the SAME table the entries live in, per name.
    expect(guard.identityFor('read')).toBe(value.placementFeed('read')?.definitionIdentity)
  })

  it('C2 jobsEnabled WITHOUT a bridge: shut rows mount, NO jobs candidate registers, the trio is not kernel-owned', async () => {
    const { value } = await mountValue({ plane: { jobsEnabled: true } })
    expect(value.definitions.map((d: { name: string }) => d.name)).toContain('job_output')
    expect(value.centerKernel.familyIds).toEqual(['dsh.fs-family', 'dsh.process-family', 'dsh.search-family'])
    expect(value.kernelGuard.owns('job_output')).toBe(false)
    const shutRow = value.definitions.find((d) => d.name === 'job_list')
    expect(shutRow, 'the shut trio row still mounts').not.toBeUndefined()
    const shut = await (shutRow as RowLike).execute({}, { agent: { id: 'agent-1' } })
    expect(shut.text).toContain('IO_POLICY_UNSUPPORTED')
  })

  it('C3 the key ABSENT is the zero flip: no trio rows at all', async () => {
    const { value } = await mountValue({})
    const names = value.definitions.map((d: { name: string }) => d.name)
    expect(names).not.toContain('job_output')
    expect(names).not.toContain('job_list')
    expect(names).not.toContain('job_kill')
    expect(value.kernelGuard.owns('job_output')).toBe(false)
  })

  it('C4 invalidation is SILENT and per-family: revoking the jobs family never resurrects an entry and never touches the others', async () => {
    const mod = await bridgeModule()
    const bridge = mod.createGovernedJobsBridge({
      scopeKey: 'scope-c4', viewer: { rootSessionId: ROOT, instanceId: 'u6pr4-instance' },
      gatewayRow: () => null, planeRow: () => null, jobsService: () => undefined,
    })
    const { value } = await mountValue({ plane: { jobsEnabled: true } }, bridge)
    const ck = value.centerKernel
    expect(typeof value.kernelGuard.identityFor('job_kill')).toBe('string')
    ck.registry.revoke('dsh.jobs-family', 'test invalidation')
    ck.kernel.dropApprovalsForFamily('dsh.jobs-family')
    // bind-ONCE: invalidated = gone for this mount, lookup never re-mints.
    expect(value.kernelGuard.identityFor('job_kill')).toBeNull()
    expect(value.placementFeed('job_kill')).toBeUndefined()
    expect(ck.kernel.approvalFor(ck.scopeKey, 'job_kill')).toBeUndefined()
    // the other families keep their own entries (one table, scoped entries).
    expect(typeof value.kernelGuard.identityFor('read')).toBe('string')
    expect(typeof value.kernelGuard.identityFor('team_bash')).toBe('string')
  })
})

describe('u6-pr4 D — the same admission path end to end (real plane + real gateway + real bridge + counting host face)', () => {
  const OWNER_A = { rootSessionId: ROOT, instanceId: 'inst-1' }
  const OWNER_B = { rootSessionId: ROOT, instanceId: 'inst-2' }

  function domainDouble() {
    return {
      repositories: {
        memberInstances: {
          list: (rootKey: string) => (rootKey === ROOT ? [{ instanceId: 'inst-1' }, { instanceId: 'inst-2' }] : []),
        },
      },
    }
  }

  /** The counting stand-in for `ctx.get('jobs')` (JobRegistry @639ed01539):
   *  caller-scoped, kill answers the two native forms, and EVERY touch is
   *  counted so host REACH is measured, never assumed. */
  function countingRegistry() {
    const calls: string[] = []
    const owners = new Map<string, string>([['jb-live', 'agent-inst-1'], ['jb-loose', 'agent-inst-1']])
    const fence = (op: string, jobId: string, caller: string | undefined): void => {
      calls.push(`${op}:${jobId ?? '-'}:${caller ?? 'none'}`)
      if (owners.get(jobId) !== undefined && owners.get(jobId) !== caller) throw new Error('caller-fence: not your job')
    }
    return {
      calls,
      reach: (): number => calls.length,
      list: (caller?: string): unknown[] => {
        calls.push(`list:-:${caller ?? 'none'}`)
        return caller === 'agent-inst-1'
          ? [
            { id: 'jb-live', kind: 'stream', status: 'running', label: 'marker-writer' },
            { id: 'jb-loose', kind: 'stream', status: 'running', label: 'loose-birth' },
          ]
          : []
      },
      read: (id: string, caller?: string): unknown => {
        fence('read', id, caller)
        return { chunks: [{ channel: 'stdout', text: `RING[${id}]` }], job: { status: 'running' } }
      },
      kill: (id: string, caller?: string): string => {
        fence('kill', id, caller)
        return 'requested'
      },
      wait: async (): Promise<unknown> => ({ id: 'jb-live', status: 'running' }),
    }
  }

  interface World {
    asm: GatewayAssembly
    svc: ReturnType<typeof countingRegistry>
    member1: PlaneValue
    member2: PlaneValue
    legs1: () => number
    observations1: string[]
  }

  async function world(
    wrap: (asm: GatewayAssembly) => GatewayAssembly = (a) => a,
  ): Promise<World> {
    const gw = await gatewayModule()
    const mod = await bridgeModule()
    const asm0 = gw.createLiveJobsGatewayAssembly({ teamRoot: domainDouble(), rootSessionId: ROOT })
    const asm = wrap(asm0)
    const svc = countingRegistry()
    const observations1: string[] = []
    let planeValue1: PlaneValue | null = null
    const bridge1 = mod.createGovernedJobsBridge({
      scopeKey: gw.jobsBridgeScopeKey({ realmId: REALM, rootSessionId: ROOT, instanceId: 'inst-1' }),
      viewer: OWNER_A,
      gatewayRow: () => asm,
      planeRow: () => planeValue1,
      jobsService: () => svc,
      observe: (row: string) => observations1.push(String(row)),
    })
    // Shell takeover at the NATIVE spelling: the creating lane ('bash') is a
    // placed, feed-readable lane — the law the gateway's C-BIND checks.
    const m1 = await mountValue({ instanceId: 'inst-1', plane: { jobsEnabled: true, names: { bash: 'bash' } } }, bridge1)
    planeValue1 = m1.value
    const bridge2 = mod.createGovernedJobsBridge({
      scopeKey: gw.jobsBridgeScopeKey({ realmId: REALM, rootSessionId: ROOT, instanceId: 'inst-2' }),
      viewer: OWNER_B,
      gatewayRow: () => asm,
      planeRow: () => m2.value,
      jobsService: () => svc,
      observe: () => {},
    })
    const m2 = await mountValue({ instanceId: 'inst-2', plane: { jobsEnabled: true, names: { bash: 'bash' } } }, bridge2)
    return { asm, svc, member1: m1.value, member2: m2.value, legs1: m1.legCalls, observations1 }
  }

  const row = (plane: PlaneValue, name: string): RowLike => {
    const hit = plane.definitions.find((d) => d.name === name)
    if (hit === undefined) throw new Error(`row ${name} is not mounted`)
    return hit
  }

  it('D1 the gateway pins are fed FROM THE KERNEL TABLE; attribution admits on that pin; the owner trio runs with the approval lane untouched', async () => {
    const w = await world()
    const gw = await gatewayModule()
    const scopeA = gw.jobsBridgeScopeKey({ realmId: REALM, rootSessionId: ROOT, instanceId: 'inst-1' })
    // The attribution-producer hook (production contract for the future
    // creation lane): feed the gateway store from the PLACEMENT FEED — which
    // for the owned names answers from the KERNEL TABLE.
    await row(w.member1, 'job_list').execute({}, { agent: { id: 'agent-inst-1' } })
    expect(w.observations1.filter((o) => o.includes('definition-registered'))).toEqual(
      expect.arrayContaining([
        expect.stringContaining('name=bash'),
        expect.stringContaining('name=job_output'),
      ]),
    )
    const admitted = w.asm.attributeBackgroundJob({ hostJobId: 'jb-live', owner: OWNER_A, scopeKey: scopeA, toolName: 'bash' })
    expect(admitted.ok, JSON.stringify(admitted)).toBe(true)
    const before = w.member1.centerKernel.kernel.approvalFor(w.member1.centerKernel.scopeKey, 'job_output')
    const genBefore = w.member1.centerKernel.registry.generation()
    const legsBefore = w.legs1()
    const listOut = await row(w.member1, 'job_list').execute({}, { agent: { id: 'agent-inst-1' } })
    expect(listOut.text).toContain('jb-live')
    const outOut = await row(w.member1, 'job_output').execute({ job_id: 'jb-live' }, { agent: { id: 'agent-inst-1' } })
    expect(outOut.text).toContain('RING[jb-live]')
    // NO SECOND LEDGER: the trio ran real host effects while the approval
    // table, the registry generation and the PA approval lane did not move.
    expect(w.member1.centerKernel.kernel.approvalFor(w.member1.centerKernel.scopeKey, 'job_output')).toBe(before)
    expect(w.member1.centerKernel.registry.generation()).toBe(genBefore)
    expect(w.legs1()).toBe(legsBefore)
    expect(w.observations1.some((o) => /approval|grant/i.test(o))).toBe(false)
  })

  it('D2 owner fence: a foreign viewer is refused at the TEAM layer with ZERO host-service reach; the unknown corded id never reaches the host either', async () => {
    const w = await world()
    const gw = await gatewayModule()
    const scopeA = gw.jobsBridgeScopeKey({ realmId: REALM, rootSessionId: ROOT, instanceId: 'inst-1' })
    await row(w.member1, 'job_list').execute({}, { agent: { id: 'agent-inst-1' } }) // mint pins for A
    w.asm.attributeBackgroundJob({ hostJobId: 'jb-live', owner: OWNER_A, scopeKey: scopeA, toolName: 'bash' })
    const reachBefore = w.svc.reach()
    const foreign = await row(w.member2, 'job_output').execute({ job_id: 'jb-live' }, { agent: { id: 'agent-inst-2' } })
    expect(foreign.text).toContain('owner-mismatch')
    const foreignKill = await row(w.member2, 'job_kill').execute({ job_id: 'jb-live', reason: 'foreign attempt' }, { agent: { id: 'agent-inst-2' } })
    expect(foreignKill.text).toContain('owner-mismatch')
    expect(w.svc.reach(), 'a team-layer refusal never reaches the host layer').toBe(reachBefore)
    // the mirror direction: member-1 managed against member-2's OWN corded
    // job — same owner-mismatch, still zero host reach.
    const scopeB = gw.jobsBridgeScopeKey({ realmId: REALM, rootSessionId: ROOT, instanceId: 'inst-2' })
    await row(w.member2, 'job_list').execute({}, { agent: { id: 'agent-inst-2' } }) // mint B's pins (a real host list: counted)
    w.asm.attributeBackgroundJob({ hostJobId: 'jb-b', owner: OWNER_B, scopeKey: scopeB, toolName: 'bash' })
    const reachBefore2 = w.svc.reach() // (jb-b joins B's ownerKey; A's viewer must not manage it)
    const reverse = await row(w.member1, 'job_kill').execute({ job_id: 'jb-b', reason: 'cross attempt' }, { agent: { id: 'agent-inst-1' } })
    expect(reverse.text).toContain('owner-mismatch')
    // (the fake host would have ANSWERED the kill — owners map has no entry —
    // so a 'requested cancellation' answer here would prove the team fence leaked to the host)
    expect(reverse.text).not.toContain('requested')
    expect(w.svc.reach()).toBe(reachBefore2)
  })

  it('D3 the RAW region posture (pre-R1): un-attributed ids reach the host fence — WHY the mount wraps the face (F group; the production mount NEVER exposes this pass-through)', async () => {
    const w = await world()
    // 'jb-loose' was NEVER attributed (production has no creation-lane
    // producer yet — the disclosed corded:false world law).
    const reachBefore = w.svc.reach()
    const looseOut = await row(w.member1, 'job_output').execute({ job_id: 'jb-loose' }, { agent: { id: 'agent-inst-1' } })
    expect(looseOut.text).toContain('RING[jb-loose]') // owner reads it: host fence let it through
    const foreignLoose = await row(w.member2, 'job_output').execute({ job_id: 'jb-loose' }, { agent: { id: 'agent-inst-2' } })
    expect(foreignLoose.text).toContain('host-jobs-refused') // the HOST refused (caller fence)
    expect(w.svc.reach()).toBeGreaterThan(reachBefore) // disclosed: the pass-through reaches svc
    expect(foreignLoose.text).not.toContain('RING') // and nothing of the effect leaked
  })

  it('D4 a kill is a REQUEST: the answer is request-vocabulary, never a settlement; the host settles what it settles', async () => {
    const w = await world()
    const gw = await gatewayModule()
    const scopeA = gw.jobsBridgeScopeKey({ realmId: REALM, rootSessionId: ROOT, instanceId: 'inst-1' })
    await row(w.member1, 'job_list').execute({}, { agent: { id: 'agent-inst-1' } })
    w.asm.attributeBackgroundJob({ hostJobId: 'jb-live', owner: OWNER_A, scopeKey: scopeA, toolName: 'bash' })
    const kill = await row(w.member1, 'job_kill').execute({ job_id: 'jb-live', reason: 'done early' }, { agent: { id: 'agent-inst-1' } })
    expect(kill.text).toContain('requested cancellation')
    expect(kill.text.toLowerCase()).not.toContain('cancelled')
    expect(kill.text.toLowerCase()).not.toContain('terminated')
    expect(w.svc.calls).toContain('kill:jb-live:agent-inst-1')
    // the gateway records the REQUEST (never a settle): observation vocabulary is request-worded
    const ledger = w.asm.observations()
    expect(ledger.length).toBeGreaterThan(0)
    expect(JSON.stringify(ledger)).toMatch(/cancel-requested|request/)
    expect(JSON.stringify(ledger).toLowerCase()).not.toMatch(/settl|terminate/)
  })

  it('D5 an unnamed caller is refused by the bridge, never queried unfiltered (no svc reach)', async () => {
    const w = await world()
    const reachBefore = w.svc.reach()
    const anon = await row(w.member1, 'job_list').execute({}, {})
    expect(anon.text).toContain('caller-unresolved')
    expect(w.svc.reach()).toBe(reachBefore)
  })

  // R1 (review): CI-05 — the mount-side law over the D world's real faces.
  describe('u6-pr4 F — the R1 CI-05 mount face: an un-attributed id is refused BEFORE any host reach (governed mounts only)', () => {
  // R1 (review): CI-05 forbids the governed Team lane carrying an
  // un-attributed id to the Host svc. The frozen gateway keeps its
  // disclosed corded:false answer (byte-pinned, CI-08); the MOUNT wraps
  // the face (agent-bindings hands the bridge EXACTLY this wrapped row).
  // These legs drive the real region through the real wrap — the same
  // single authority the production mount uses. (OWNER_A/OWNER_B ride the D world.)
  async function wrappedWorld(): Promise<World> {
    const mod = await bridgeModule()
    return await world((a) => mod.ci05GovernedGatewayRow(a) as GatewayAssembly)
  }

  it('F1 un-attributed id: typed refusal, static detail, ZERO svc reach on BOTH management arms', async () => {
    const w = await wrappedWorld()
    const before = w.svc.reach()
    const out = await row(w.member1, 'job_output').execute({ job_id: 'jb-loose' }, { agent: { id: 'agent-inst-1' } })
    expect(out.text).toContain('refused: unattributed-job')
    expect(out.text).not.toContain('RING')
    const kill = await row(w.member1, 'job_kill').execute({ job_id: 'jb-loose', reason: 'r' }, { agent: { id: 'agent-inst-1' } })
    expect(kill.text).toContain('unattributed-job')
    expect(kill.text).not.toContain('requested cancellation')
    expect(w.svc.reach()).toBe(before) // the D3 pass-through does NOT exist at the governed mount
  })

  it('F2 attributed id: the corded owner trio works THROUGH the wrap (ring bytes, svc reached)', async () => {
    const mod = await bridgeModule()
    const gw = await gatewayModule()
    const w = await wrappedWorld()
    void mod
    await row(w.member1, 'job_list').execute({}, { agent: { id: 'agent-inst-1' } }) // mints the creating-lane pins
    const scopeA = gw.jobsBridgeScopeKey({ realmId: REALM, rootSessionId: ROOT, instanceId: 'inst-1' })
    const admitted = w.asm.attributeBackgroundJob({ hostJobId: 'jb-live', owner: OWNER_A, scopeKey: scopeA, toolName: 'bash' })
    expect(admitted.ok, JSON.stringify(admitted)).toBe(true)
    const out = await row(w.member1, 'job_output').execute({ job_id: 'jb-live' }, { agent: { id: 'agent-inst-1' } })
    expect(out.text).toContain('RING[jb-live]') // attributed → corded:true → host reach IS the law
  })

  it('F3 foreign attributed id: owner-mismatch stands through the wrap with ZERO svc reach', async () => {
    const gw = await gatewayModule()
    const w = await wrappedWorld()
    await row(w.member1, 'job_list').execute({}, { agent: { id: 'agent-inst-1' } })
    const scopeA = gw.jobsBridgeScopeKey({ realmId: REALM, rootSessionId: ROOT, instanceId: 'inst-1' })
    w.asm.attributeBackgroundJob({ hostJobId: 'jb-live', owner: OWNER_A, scopeKey: scopeA, toolName: 'bash' })
    await row(w.member2, 'job_list').execute({}, { agent: { id: 'agent-inst-2' } })
    const before = w.svc.reach()
    const foreign = await row(w.member2, 'job_output').execute({ job_id: 'jb-live' }, { agent: { id: 'agent-inst-2' } })
    expect(foreign.text).toContain('owner-mismatch')
    expect(foreign.text).not.toContain('RING')
    expect(w.svc.reach()).toBe(before) // attribution changed nothing for the wrong viewer
  })

  it('F4 the wrap is a pure law over ONE answer: corded:false flips to unattributed-job, everything else passes IDENTICAL, wrapping is idempotent', async () => {
    const mod = await bridgeModule()
    const gw = await gatewayModule()
    const asm = gw.createLiveJobsGatewayAssembly({ teamRoot: domainDouble(), rootSessionId: ROOT })
    const wrapped = mod.ci05GovernedGatewayRow(asm) as GatewayAssembly
    expect(mod.ci05GovernedGatewayRow(asm)).toBe(wrapped) // WeakMap idempotence — one wrapper per asm
    const loose = wrapped.checkManagementAccess({ jobId: 'jb-none', viewer: OWNER_A as Record<string, unknown> })
    expect(asm.checkManagementAccess({ jobId: 'jb-none', viewer: OWNER_A as Record<string, unknown> }).ok).toBe(true) // frozen gateway unchanged
    expect(loose.ok).toBe(false)
    expect(loose.code).toBe('unattributed-job')
    expect(typeof loose.detail).toBe('string')
    expect(loose.detail).toBe(
      wrapped.checkManagementAccess({ jobId: 'jb-other', viewer: OWNER_A as Record<string, unknown> }).detail,
    ) // STATIC detail — no id, no identity leak (C-GW)
    const scopeA = gw.jobsBridgeScopeKey({ realmId: REALM, rootSessionId: ROOT, instanceId: 'inst-1' })
    // C-BIND law: attribution admits only on the CREATING lane's pin — mint
    // it the way the placement feed would (the store's disclosed register seam).
    asm.definitions.register(scopeA, 'bash', 'u6pr4-f4-def-identity')
    const admitted = asm.attributeBackgroundJob({ hostJobId: 'jb-live', owner: OWNER_A, scopeKey: scopeA, toolName: 'bash' })
    expect(admitted.ok, JSON.stringify(admitted)).toBe(true)
    // corded:true passes UNCHANGED (deep-equal, not identity: the frozen
    // gateway builds a fresh result object per call — both faces answer it).
    expect(wrapped.checkManagementAccess({ jobId: 'jb-live', viewer: OWNER_A as Record<string, unknown> }))
      .toEqual(asm.checkManagementAccess({ jobId: 'jb-live', viewer: OWNER_A as Record<string, unknown> }))
    expect(wrapped.checkManagementAccess({ jobId: 'jb-live', viewer: OWNER_A as Record<string, unknown> }).corded).toBe(true)
    expect(wrapped.checkManagementAccess({ jobId: 'jb-live', viewer: OWNER_B as Record<string, unknown> }).code).toBe('owner-mismatch')
  })

  it('F5 governed job_list answers through the SAME face: un-attributed rows are hidden, the attributed own row survives', async () => {
    const gw = await gatewayModule()
    const w = await wrappedWorld()
    const bare = await row(w.member1, 'job_list').execute({}, { agent: { id: 'agent-inst-1' } })
    expect(bare.text).toContain('(no background jobs)') // jb-live/jb-loose exist HOST-side, none are Team-attributed: the governed viewer sees none
    await row(w.member1, 'job_list').execute({}, { agent: { id: 'agent-inst-1' } })
    const scopeA = gw.jobsBridgeScopeKey({ realmId: REALM, rootSessionId: ROOT, instanceId: 'inst-1' })
    w.asm.attributeBackgroundJob({ hostJobId: 'jb-live', owner: OWNER_A, scopeKey: scopeA, toolName: 'bash' })
    const owned = await row(w.member1, 'job_list').execute({}, { agent: { id: 'agent-inst-1' } })
    expect(owned.text).toContain('jb-live')
    expect(owned.text).not.toContain('jb-loose') // un-attributed stays hidden — one face, one law
  })
  })
})

describe('u6-pr4 E — the mount-generation law (CI-08), pa-mount-registry UNMODIFIED', () => {
  it('E1 the two frozen files are byte-FROZEN for this slice (unmodified import law)', async () => {
    expect(sha256(readSrc(MOUNT_REGISTRY_PATH))).toBe(PA_MOUNT_REGISTRY_SHA)
    expect(sha256(readSrc(GATEWAY_PATH))).toBe(GATEWAY_ASSEMBLY_SHA)
  })

  it('E2 the old disposer cannot drop the new mount; the current identity still can', async () => {
    const mod = await import(MOUNT_REGISTRY_PATH.href)
    const key = { root: 'u6pr4-e2-root', instance: 'u6pr4-e2-instance' }
    const gen1 = mod.publishPaMount(key.root, key.instance, { plane: 'mount-generation-1' })
    const gen2 = mod.publishPaMount(key.root, key.instance, { plane: 'mount-generation-2' })
    expect(mod.resolvePaMount(key.root, key.instance).plane).toBe('mount-generation-2')
    // the OLD mount's disposer: refuses stale, clears NOTHING.
    expect(mod.revokePaMount(key.root, key.instance, gen1)).toBe(false)
    expect(mod.resolvePaMount(key.root, key.instance)?.plane).toBe('mount-generation-2')
    expect(mod.revokePaMount(key.root, key.instance, gen2)).toBe(true)
    expect(mod.resolvePaMount(key.root, key.instance)).toBeUndefined()
  })

  it('E3 the plant (non-vacuity): a naive key-deleting disposer WOULD destroy the current mount — the identity guard is load-bearing', async () => {
    // Counterfactual ONLY, outside the production registry: the same world
    // where teardown deletes BY KEY (what an identity-less disposer does).
    const store = new Map<string, unknown>()
    const key = 'u6pr4-e3-root:u6pr4-e3-instance'
    store.set(key, { plane: 'mount-generation-1' })
    store.set(key, { plane: 'mount-generation-2' }) // remount (same pair)
    const naiveDisposerFromGeneration1 = (): void => {
      store.delete(key)
    }
    naiveDisposerFromGeneration1()
    expect(store.get(key)).toBeUndefined() // the naive disposer just killed the CURRENT mount
    // With the real registry the identical sequence (E2) keeps gen2 alive: the
    // refusal observed there is caused by the identity law, not by the harness.
  })
})
