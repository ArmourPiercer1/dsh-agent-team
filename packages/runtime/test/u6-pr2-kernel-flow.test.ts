/**
 * U6 PR2 — the CENTER ASSEMBLY rides the governed read mount (kernel-flow).
 *
 * sup-a §5 conditions 1 (ONE center approval table), 3 (next()-delegation —
 * the plane keeps answering the dispatch seam), 7 (the table binds a REAL
 * definition identity, minted by the Guard's own minter), and the PR1-open
 * port binding (kernel grantConsume → the existing tool-admission one-shot
 * face). These legs prove the LAWS at the assembly surface — the end-to-end
 * admit→ask→consume→execute→settle chain through the SAME kernel-routed
 * consume edge is `a5-m1-read-c1c2.test.ts` (which now passes over the
 * kernel path), and the plant/sensitivity legs are
 * `u6-pr2-kernel-guard-plants.test.ts`.
 */
import { describe, expect, it } from 'vitest'
import { approvingControlLeg } from './a5-m1-control-legs.mjs'
import { definitionIdentityOf } from '../tool-dispatch/index.js'
import { createGovernanceKernel, createGovernedFamilyRegistry } from '../governance-center/index.js'

const REALM = 'u6-pr2-kernel-unit-realm'

/* The live plane row and the family contribution builder are untyped .mjs
 * (no sibling declaration by design — the lane's typed surface is
 * read-normalizer.ts + governance-center/index.ts). The PR1 precedent
 * (u6-pr1-shadow-inert.test.ts:43) loads them through `await import(new
 * URL(...))` behind a declared structural face; these casts are that face,
 * and they are the ONLY casts in this file. */
type PlaneAssemblyResult =
  | { ok: true; value: unknown }
  | { ok: false; code: string; message?: string }
interface PlaneModule {
  createTeamToolPlaneAssembly(input: Record<string, unknown>): PlaneAssemblyResult
}
interface FamilyModule {
  buildFsReadContribution(input: Record<string, unknown>): unknown
}
const planeModule = async (): Promise<PlaneModule> =>
  (await import(new URL('../src/plugin/live/team-tool-plane.mjs', import.meta.url).href)) as PlaneModule
const familyModule = async (): Promise<FamilyModule> =>
  (await import(new URL('../../tools/fs-family/src/fs-read-contribution.mjs', import.meta.url).href)) as FamilyModule

/** Structural face of the plane value the kernel legs observe (the .mjs row
 *  is untyped; this is the ONLY cast in the file, and it stays an `unknown`
 *  bridge into a declared shape — never `any`). */
interface KernelPlaneValue {
  readonly definitions: ReadonlyArray<{ name: string }>
  readonly ownNames: readonly string[]
  readonly placementFeed: (name: string) => { definitionIdentity: string; realmId: string } | undefined
  readonly centerKernel?: {
    readonly kernel: {
      state(): string
      approvalFor(name: string): { definitionIdentity: string; addedGeneration: number } | undefined
    }
    readonly registry: { view(): { candidates: ReadonlyArray<{ familyId: string }> }; generation(): number }
  }
  readonly kernelGuard?: {
    owns(name: string): boolean
    identityFor(name: string): string | null
  }
}
const planeFace = (v: unknown): KernelPlaneValue => v as KernelPlaneValue

async function planeValue(over: Record<string, unknown> = {}): Promise<KernelPlaneValue> {
  const built = (await planeModule()).createTeamToolPlaneAssembly({
    teamSessionId: 'u6-pr2-test-team-root',
    controlLeg: approvingControlLeg(),
    fs: { subtreeContains: ({ parent, child }: { parent: string; child: string }) => child === parent || child.startsWith(parent + '/') },
    permissionPolicy: { default: 'deny', allow: [{ tool: 'read', resource: { kind: 'any' } }], ask: [], deny: [] },
    realmId: REALM,
    templateId: 'u6pr2-tpl',
    role: 'member',
    instanceId: 'u6pr2-instance',
    onObserve: () => {},
    plane: { fsInstance: { fs: 'u6pr2-ctl', rootDir: '/u6pr2-unit-root', realmId: REALM, kind: 'absolute-path' }, ...over },
  })
  if (!built.ok) throw new Error(`assembly refused: ${built.code} ${built.message}`)
  return planeFace(built.value)
}

describe('u6-pr2 center assembly: the read mount carries a live kernel', () => {
  it('K1 the mounted read row publishes a center kernel + registry, both ACTIVE, guard port shaped', async () => {
    const value = await planeValue()
    const center = value.centerKernel
    if (center === undefined) throw new Error('center kernel absent')
    expect(center, 'a plane with the read row carries its center kernel').toBeDefined()
    expect(center.kernel.state()).toBe('ACTIVE')
    const view = center.registry.view()
    const family = view.candidates.find((row) => row.familyId === 'dsh.fs-family')
    expect(family, 'the family contribution is registered').toBeDefined()
    // cond 9: a reviewed manifest, never a dynamic source.
    expect(String(JSON.stringify(family))).toContain('reviewed-manifest')
    const guard = value.kernelGuard
    expect(typeof guard?.owns, 'a kernel plane exposes its guard').toBe('function')
    expect(typeof guard?.identityFor).toBe('function')
    if (guard === undefined) throw new Error('kernelGuard absent')
    expect(guard.owns('read')).toBe(true)
    expect(guard.owns('grep')).toBe(false)
    expect(guard.identityFor('grep')).toBeNull()
  })

  it('K2 the approval TABLE is the feed for the owned name: one minter, one identity, one entry (cond 1/7)', async () => {
    const value = await planeValue()
    const readDef = value.definitions.find((d: { name: string }) => d.name === 'read')
    expect(readDef).toBeDefined()
    // The pb §6 lookup-time law, unchanged: the feed consult MINTS the
    // placement identity through the ONE minter (`definitionIdentityOf`) and
    // binds it into the table — for the owned name the mint and the TABLE
    // entry are the same event, so the identity the Guard binds can only
    // ever be the table's identity.
    const fed = value.placementFeed('read')
    const identity = definitionIdentityOf(readDef)
    expect(identity).toMatch(/^def#\d+$/)
    expect(fed).toEqual({ definitionIdentity: identity, realmId: REALM })
    const center = value.centerKernel
    if (center === undefined) throw new Error('center kernel absent')
    const guard = value.kernelGuard
    if (guard === undefined) throw new Error('kernelGuard absent')
    const entry = center.kernel.approvalFor('read')
    expect(entry?.definitionIdentity).toBe(identity)
    expect(entry?.addedGeneration).toBe(center.registry.generation())
    // The guard's answer IS the table's answer.
    expect(guard.identityFor('read')).toBe(identity)
    // And it never re-binds on re-consult: the table is mounted truth.
    expect(value.placementFeed('read')?.definitionIdentity).toBe(identity)
    expect(guard.identityFor('read')).toBe(identity)
    // Trio names stay on the plain minter feed — the table owns only what it owns.
    const trioName = (value.ownNames as string[]).find((n) => n !== 'read')
    expect(trioName, 'the plane places trio rows besides read').toBeDefined()
    expect(value.placementFeed(trioName!)).toEqual({ definitionIdentity: expect.stringMatching(/^def#\d+$/), realmId: REALM })
    expect(center.kernel.approvalFor(trioName!)).toBeUndefined()
  })

  it('K3 a plane WITHOUT the read row omits the kernel faces entirely (presence = capability)', async () => {
    const built = (await planeModule()).createTeamToolPlaneAssembly({
      teamSessionId: 'u6-pr2-test-team-root',
      controlLeg: approvingControlLeg(),
      permissionPolicy: { default: 'deny', allow: [], ask: [], deny: [] },
      realmId: REALM,
      templateId: 'u6pr2-tpl',
      role: 'member',
      instanceId: 'u6pr2-instance',
      onObserve: () => {},
      plane: {},
    })
    expect(built.ok, JSON.stringify(built)).toBe(true)
    if (!built.ok) return
    const value = planeFace(built.value)
    expect(value.centerKernel).toBeUndefined()
    expect(value.kernelGuard).toBeUndefined()
    expect(value.definitions.find((d: { name: string }) => d.name === 'read')).toBeUndefined()
  })

  it('K4 the consume port is ONE-SHOT at the kernel edge: replay is refused BEFORE the port, never re-spending (cond 4/9 law)', async () => {
    // Direct port-binding unit: the SAME kernel + consumeOnce the plane
    // mounts, with a capture port standing in for the tool-admission face.
    const registry = createGovernedFamilyRegistry({
      kernelManifest: { capabilities: { 'fs-read': { backsExecution: 'family-body' } } },
    })
    const registered = registry.register(
      (await familyModule()).buildFsReadContribution({
        definition: { name: 'read', parameters: { type: 'object' }, execute: async () => ({ ok: true }) },
        executorFactory: async function unitExecutor() { return null },
        mechanics: { unitLaw: () => 1 },
        presentation: {},
        cancelBoundary: 'unit',
      }),
      { origin: 'reviewed-manifest' },
    )
    expect(registered.ok, JSON.stringify(registered)).toBe(true)
    let portCalls = 0
    const kernel = createGovernanceKernel({
      registry,
      ports: {
        grantConsume: {
          consumeForExecution: async () => {
            portCalls += 1
            return { ok: true }
          },
        },
      },
    })
    expect(kernel.publish().ok).toBe(true)
    const first = await kernel.consumeOnce({ grantId: 'g-1' }, 'g-1', {})
    expect(first).toMatchObject({ ok: true, portCalled: true })
    const replay = await kernel.consumeOnce({ grantId: 'g-1' }, 'g-1', {})
    expect(replay.ok).toBe(false)
    expect(replay.code).toBe('GRANT_REPLAY')
    expect(replay.portCalled).toBe(false)
    expect(portCalls, 'the port saw EXACTLY one presentation').toBe(1)
    // An empty grant id never reaches the port either.
    const anon = await kernel.consumeOnce({}, '', {})
    expect(anon.ok).toBe(false)
    expect(anon.portCalled).toBe(false)
    expect(portCalls).toBe(1)
  })
})
