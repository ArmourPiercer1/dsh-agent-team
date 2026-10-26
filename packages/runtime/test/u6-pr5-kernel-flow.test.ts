/**
 * U6 PR5 — the SEARCH family rides the SAME Governance Kernel as read and
 * bash (center-assembly-architecture §10.2's trace-shape law, now with the
 * third family; the PR2 read / PR3 shell precedents `u6-pr2-kernel-flow` /
 * `u6-pr3-kernel-flow`): ONE kernel, ONE approval table, and for
 * `team_grep`/`team_glob` the TABLE is the feed — bind ONCE per name, bound
 * to the search candidate, never silently re-bound, and invalidation leaves
 * the door SILENT (no feed → refusal BEFORE any backend exists).
 *
 *  S1 the mount ledger: three families registered on ONE kernel in the
 *     stable order (read → shell → search), each entry (scopeKey, name)-
 *     keyed and bound to its OWN candidate; grep/glob carry DIFFERENT
 *     definition identities (one entry is not the other's twin);
 *  S2 one minter per (scope, name): a forged second bind is refused and
 *     the table keeps answering the first identity (cond 6 — a live/feed
 *     disagreement never silently rebinds);
 *  S3 the invalidation shape: drop the search family and both rows answer
 *     the table's absence — feed undefined, guard identity null, the latch
 *     never re-binds inside this mount (the bind-ONCE law's negative face);
 *  S4 the trace-shape law with THREE families: on the same kernel drained
 *     of every family, deciding read / team_bash / team_grep / team_glob
 *     produces the IDENTICAL outcome+code shape — one decision path, four
 *     names, zero family-specific branches in the Kernel (fitness law 2's
 *     runtime mirror).
 */
import { describe, expect, it } from 'vitest'
import { approvingControlLeg } from './a5-m1-control-legs.mjs'
import { definitionIdentityOf } from '../tool-dispatch/index.js'

const dispatchLedger: { current?: { pendingCalls(): readonly unknown[] } } = {}

const REALM = 'u6-pr5-arc-a-realm'

type PlaneAssemblyResult =
  | { ok: true; value: unknown }
  | { ok: false; code: string; message?: string }
interface PlaneModule {
  createTeamToolPlaneAssembly(input: Record<string, unknown>): PlaneAssemblyResult
}
interface KernelPlaneValue {
  readonly definitions: ReadonlyArray<{ name: string }>
  readonly ownNames: readonly string[]
  readonly placementFeed: (name: string) => { definitionIdentity: string; realmId: string } | undefined
  readonly centerKernel?: {
    readonly kernel: {
      state(): string
      mode(): string
      approvalFor(scopeKey: string, name: string):
        { definitionIdentity: string; familyId: string; scopeKey: string; addedGeneration: number } | undefined
      addApprovalEntry(input: Record<string, unknown>): { ok: boolean; code?: string }
      decide(call: { nativeName: string; scopeKey?: string; definitionIdentity?: string }):
        { outcome: string; code: string }
      dropApprovalsForFamily(familyId: string): unknown
    }
    readonly registry: { generation(): number }
    readonly scopeKey: string
    readonly familyIds: readonly string[]
  }
  readonly kernelGuard?: { owns(name: string): boolean; identityFor(name: string): string | null }
}
const planeModule = async (): Promise<PlaneModule> =>
  (await import(new URL('../src/plugin/live/team-tool-plane.mjs', import.meta.url).href)) as PlaneModule

async function mountValue(over: Record<string, unknown> = {}): Promise<KernelPlaneValue> {
  const built = (await planeModule()).createTeamToolPlaneAssembly({
    dispatcherLifecycle: { inflight: () => dispatchLedger.current?.pendingCalls().length ?? 0 },
    teamSessionId: 'u6-pr5-test-team-root',
    controlLeg: approvingControlLeg(),
    permissionPolicy: { default: 'deny', allow: [], ask: [], deny: [] },
    realmId: REALM,
    templateId: 'u6pr5-tpl',
    role: 'member',
    instanceId: 'u6pr5-instance',
    onObserve: () => {},
    plane: { fsInstance: { fs: 'u6pr5-ctl', rootDir: '/u6pr5-unit-root', realmId: REALM, kind: 'absolute-path' }, ...over },
  })
  if (built.ok !== true) throw new Error(`assembly refused: ${built.code} ${built.message ?? ''}`)
  return built.value as KernelPlaneValue
}

const needCenter = (value: KernelPlaneValue) => {
  const center = value.centerKernel
  const guard = value.kernelGuard
  if (center === undefined || guard === undefined) throw new Error('center assembly absent')
  return { center, guard }
}

describe('u6-pr5 S — the search family rides the ONE kernel', () => {
  it('S1 three families, ONE kernel, own candidates, different identities (the mount ledger)', async () => {
    const value = await mountValue()
    const { center, guard } = needCenter(value)
    expect(center.kernel.mode()).toBe('enforcing')
    // Registration order is deterministic: read → shell → search.
    expect(center.familyIds).toEqual(['dsh.fs-family', 'dsh.process-family', 'dsh.search-family'])

    const grepDef = value.definitions.find((d) => d.name === 'team_grep')
    const globDef = value.definitions.find((d) => d.name === 'team_glob')
    if (grepDef === undefined || globDef === undefined) throw new Error('search rows not placed')
    const grepIdentity = definitionIdentityOf(grepDef)
    const globIdentity = definitionIdentityOf(globDef)
    expect(grepIdentity).toMatch(/^def#\d+$/)
    expect(globIdentity).toMatch(/^def#\d+$/)
    expect(grepIdentity).not.toBe(globIdentity) // two defs are NEVER one identity

    for (const [name, identity] of [['team_grep', grepIdentity], ['team_glob', globIdentity]] as const) {
      expect(guard.owns(name), `the guard owns ${name}`).toBe(true)
      const fed = value.placementFeed(name)
      expect(fed).toEqual({ definitionIdentity: identity, realmId: REALM })
      expect(guard.identityFor(name)).toBe(identity)
      const entry = center.kernel.approvalFor(center.scopeKey, name)
      expect(entry?.definitionIdentity).toBe(identity)
      expect(entry?.familyId).toBe('dsh.search-family')
      expect(entry?.scopeKey).toBe(center.scopeKey)
      expect(entry?.addedGeneration).toBe(center.registry.generation())
      // Cross-scope law: a foreign scope sees NOTHING for the same names.
      expect(center.kernel.approvalFor('other-scope:inst', name)).toBeUndefined()
    }
    // Re-consult never re-mints: the table is mounted truth.
    expect(value.placementFeed('team_grep')?.definitionIdentity).toBe(grepIdentity)
    expect(center.kernel.approvalFor(center.scopeKey, 'team_grep')?.addedGeneration).toBe(center.registry.generation())
  })

  it('S2 one minter per (scope, name): a forged second bind is refused, the table stands', async () => {
    const value = await mountValue()
    const { center } = needCenter(value)
    value.placementFeed('team_grep') // bind the real entry first
    const before = center.kernel.approvalFor(center.scopeKey, 'team_grep')
    if (before === undefined) throw new Error('the real bind did not land')
    const forged = center.kernel.addApprovalEntry({
      scopeKey: center.scopeKey,
      nativeName: 'team_grep',
      definitionIdentity: 'def#9999',
      familyId: 'dsh.search-family',
    })
    expect(forged.ok).toBe(false)
    const after = center.kernel.approvalFor(center.scopeKey, 'team_grep')
    expect(after?.definitionIdentity).toBe(before.definitionIdentity)
    // A foreign family cannot claim the name either (the candidate-binding law).
    const foreign = center.kernel.addApprovalEntry({
      scopeKey: center.scopeKey,
      nativeName: 'team_grep',
      definitionIdentity: 'def#9999',
      familyId: 'dsh.fs-family',
    })
    expect(foreign.ok).toBe(false)
    expect(center.kernel.approvalFor(center.scopeKey, 'team_grep')?.definitionIdentity).toBe(before.definitionIdentity)
  })

  it('S3 invalidation is SILENT and bind-ONCE: a dropped search family never re-binds this mount', async () => {
    const value = await mountValue()
    const { center, guard } = needCenter(value)
    expect(value.placementFeed('team_grep'), 'first consult binds').toBeDefined()
    expect(value.placementFeed('team_glob'), 'and so for glob').toBeDefined()
    center.kernel.dropApprovalsForFamily('dsh.search-family')
    // The table answers nothing; the feed answers nothing (SILENT — no
    // throw, no fallback identity, no native pass-through); the guard says
    // null; the latch forbids ANY re-bind inside this mount, however often
    // the rows re-consult.
    expect(center.kernel.approvalFor(center.scopeKey, 'team_grep')).toBeUndefined()
    expect(value.placementFeed('team_grep')).toBeUndefined()
    expect(value.placementFeed('team_grep')).toBeUndefined()
    expect(guard.identityFor('team_grep')).toBeNull()
    expect(center.kernel.approvalFor(center.scopeKey, 'team_glob')).toBeUndefined()
    expect(guard.identityFor('team_glob')).toBeNull()
    // The OTHER families are untouched by a search-family drop (per-family
    // invalidation — dropping search must never void read).
    expect(value.placementFeed('read'), 'read still table-fed').toBeDefined()
    expect(value.placementFeed('team_bash'), 'bash still table-fed').toBeDefined()
  })

  it('S4 the trace-shape law with three families: four names, one decision path, zero family branches', async () => {
    const value = await mountValue()
    const { center } = needCenter(value)
    // Bind everything first, then drop EVERY family — the kernel answers
    // all four owned names from the same no-entry state machine (PR3 B
    // generalized from {read, bash} to {read, team_bash, team_grep,
    // team_glob}: equal outcome + equal code = the same transitions).
    for (const n of ['read', 'team_bash', 'team_grep', 'team_glob']) value.placementFeed(n)
    for (const f of center.familyIds) center.kernel.dropApprovalsForFamily(f)
    const shapes = (['read', 'team_bash', 'team_grep', 'team_glob'] as const).map((nativeName) => {
      const d = value.definitions.find((x) => x.name === nativeName)
      if (d === undefined) throw new Error(`row ${nativeName} not placed`)
      const r = center.kernel.decide({ nativeName, scopeKey: center.scopeKey, definitionIdentity: definitionIdentityOf(d) ?? undefined })
      return { outcome: r.outcome, code: r.code ?? undefined }
    })
    expect(new Set(shapes.map((s) => `${s.outcome}:${s.code}`)).size, JSON.stringify(shapes)).toBe(1)
    // The uniform answer is the kernel ABSTAINING (defer — the Kernel mints
    // authority for nothing it does not carry); the Guard door turns that
    // into a refusal before the Body. The law that matters is NEGATIVE and
    // family-blind: a drained kernel never answers ALLOW for any of the
    // four names, and no name gets a different answer from the others.
    expect(shapes[0]?.outcome).not.toBe('allow')
    const unowned = center.kernel.decide({ nativeName: 'team_grep', scopeKey: 'nope:nope', definitionIdentity: 'def#1' })
    expect(unowned.outcome).not.toBe('allow')
  })
})
