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
 *     runtime mirror);
 *  S5 the GLOB refusal arm — the offline C1 mirror of the live
 *     `arca:search-refusal-zero-effect` case. That live case
 *     (tests/world-factory/suites/040-u6-arc-a.mjs, judged by
 *     lib/u6-arc-a-assembly.mjs judgeU6ArcA) drives team_GREP at /etc only;
 *     no committed RUN record grades a live glob refusal, so the u7 ledger
 *     row (dev/agent-workflow/ledgers/u7-tool-acceptance.json,
 *     tool=team_glob, L3-refusal) stays NOT_VERIFIED and this arm is C1
 *     ONLY: it proves the refusal LOGIC plus the zero-effect witness
 *     plane-side with C1 STAND-IN answers (a5-m1-control-legs), NEVER L3.
 *     The approval-deny lane refuses team_glob TYPED (code=APPROVAL_DENIED)
 *     before any backend runs — mirroring the shell family's a5-m1-bash-c1
 *     deny legs (typed refusal + backend execCount 0). The zero-effect
 *     witness is the search family's own harness pattern, two precedents
 *     copied: the ARMED fixture backend of alpha5-g1-deny-lane.test.ts
 *     createFixtureBackend (reaching the backend bumps a counter AND writes
 *     a sentinel — a shut face would make "the backend never ran" vacuously
 *     true), and the stat-stamped tree census of the glob-targeted root
 *     (the live suite's fixtureCensus, extended with per-file
 *     mtime/ctime/atime stamps — the "no observable read" half; atime is
 *     coarse under relatime, disclosed, so the binding zero-effect proof is
 *     census + armed counter + the claims-never-echoed law). The positive
 *     control moves ALL THREE witnesses, so the refusal arms' zeros are
 *     MEASURED, never vacuous; the lane-deny arm pins the DISCRIMINATION
 *     (one code per lane: template-deny-lane ≠ APPROVAL_DENIED ≠ the shut
 *     face's IO_POLICY_UNSUPPORTED landing — the run8 honesty law the live
 *     judge carries as `admissionRefused`: a landing is never refusal
 *     evidence).
 */
import { describe, expect, it } from 'vitest'
import { approvingControlLeg, denyingControlLeg } from './a5-m1-control-legs.mjs'
import { definitionIdentityOf } from '../tool-dispatch/index.js'
import { existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

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

// ── S5 the GLOB refusal arm (offline C1 mirror of arca:search-refusal-zero-effect) ──
// Worlds live under `tests/homes/` (TEST_METHODS §5/§7, self-removed below);
// three INDEPENDENT governed roots — one per arm — so one arm's evidence can
// never leak into another's census.
const REPO = fileURLToPath(new URL('../../../', import.meta.url).href)
const WORLD = join(REPO, 'tests', 'homes', `u6pr5-s5-${Date.now().toString(36)}`)
const ROOT_ASK = join(WORLD, 'ask') // S5a: the approval-deny arm (the ledger-named refusal)
const ROOT_DENY = join(WORLD, 'deny') // S5b: the lane-deny discriminator
const ROOT_POS = join(WORLD, 'pos') // S5c: the positive control (witness armability)
const CLAIM_ALPHA = 'U6PR5S5_CLAIM_ALPHA'
const CLAIM_BETA = 'U6PR5S5_CLAIM_BETA'
const BACKEND_MARK = 'U6PR5S5-BACKEND-RAN'

interface S5Fixture {
  readonly backendId: string
  run: (call?: unknown) => Promise<unknown>
  execCount(): number
  readonly lastStageTrace: readonly string[]
}

/** THE ARMED ZERO-EFFECT WITNESS — copied from the family's own precedent,
 * `createFixtureBackend` (alpha5-g1-deny-lane.test.ts): reaching this search
 * backend bumps the counter AND leaves an observable sentinel; the refusal
 * arms must see NEITHER. Injecting it through the kit `backends` seam is
 * what makes `execCount === 0` a MEASUREMENT: the shut production face
 * answers without ever executing (`a5-effect-face-pending`), so a refusal
 * witnessed against it could not tell "refused before backend" from "landed
 * on a face that happens to do nothing" — the landing-vs-refusal law the
 * live judge learned in run8. */
function createS5GlobFixture(sentinel: string): S5Fixture {
  let n = 0
  return {
    backendId: 'u6pr5-s5-fixture-glob',
    run: async () => {
      n += 1
      writeFileSync(sentinel, `reached-${String(n)}`)
      return {
        ok: true,
        settlement: { kind: 'completed' as const },
        // The REAL glob row's outcome shape (glob-backend.mjs: outputMode
        // 'files_with_matches' — inside the closed search render set).
        outcome: {
          outputMode: 'files_with_matches' as const,
          matches: [],
          counts: [],
          files: [`${BACKEND_MARK}.txt`],
          totalMatches: 1,
          truncated: false,
        },
      }
    },
    execCount: () => n,
    lastStageTrace: Object.freeze([]),
  }
}

/** The census witness, copied from the live suite's `fixtureCensus`
 * (040-u6-arc-a.mjs) and extended with per-file mtime/ctime/atime stamps —
 * the glob-targeted tree must not merely KEEP its bytes, it must show NO
 * observable touch. Disclosed: atime granularity follows the mount's
 * relatime/strict-atime semantics; the binding zero-effect proof is the
 * stamp-census + the armed counter + the claims-never-echoed law below. */
function census(dir: string): string {
  const out: string[] = []
  const walk = (d: string, rel: string): void => {
    for (const e of readdirSync(d, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      if (e.isDirectory()) walk(join(d, e.name), `${rel}${e.name}/`)
      else {
        // the lane shim (src/plugin/node-min.d.ts) types statSync
        // structurally; the stamp read rides the a5b3-cancel-leg cast (:305).
        const st = statSync(join(d, e.name)) as unknown as { size: number; mtimeMs: number; ctimeMs: number; atimeMs: number }
        out.push(`${rel}${e.name}:${String(st.size)}:${String(st.mtimeMs)}:${String(st.ctimeMs)}:${String(st.atimeMs)}`)
      }
    }
  }
  walk(dir, '')
  return out.join('|')
}

function seedTree(dir: string): void {
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'u6pr5-s5-alpha.txt'), `${CLAIM_ALPHA}\n`)
  writeFileSync(join(dir, 'u6pr5-s5-beta.txt'), `${CLAIM_BETA}\n`)
}

interface S5PlaneValue {
  readonly definitions: ReadonlyArray<{ name: string; execute: (raw: unknown) => Promise<{ text: string }> }>
  readonly backends: Record<string, { backendId?: unknown } | undefined>
}

/** The S5 mount: the SAME typed plane path S1–S4 grade (createTeamToolPlaneAssembly
 * → kernel-enforced mount → the glob row's execute), plus (i) a REAL governed
 * root as `plane.fsInstance` — the anchored glob arm then claims LIST on
 * exactly this root (effects-schema anchored form: "glob → tool-invoke(glob)
 * + list on the GOVERNED ROOT"), i.e. the resource the glob targets — and
 * (ii) the armed fixture glob backend through the kit `backends` seam. */
async function mountS5(input: {
  rootDir: string
  controlLeg: unknown
  permissionPolicy: unknown
  backends: Record<string, unknown>
}): Promise<S5PlaneValue> {
  const built = (await planeModule()).createTeamToolPlaneAssembly({
    dispatcherLifecycle: { inflight: () => dispatchLedger.current?.pendingCalls().length ?? 0 },
    teamSessionId: 'u6-pr5-test-team-root',
    controlLeg: input.controlLeg,
    permissionPolicy: input.permissionPolicy,
    realmId: REALM,
    templateId: 'u6pr5-tpl',
    role: 'member',
    instanceId: 'u6pr5-s5-instance',
    onObserve: () => {},
    plane: { fsInstance: { fs: 'u6pr5-ctl', rootDir: input.rootDir, realmId: REALM, kind: 'absolute-path' } },
    backends: input.backends,
  })
  if (built.ok !== true) throw new Error(`assembly refused: ${built.code} ${built.message ?? ''}`)
  return built.value as S5PlaneValue
}

const globRow = (value: S5PlaneValue) => {
  const d = value.definitions.find((x) => x.name === 'team_glob')
  if (d === undefined) throw new Error('the glob row is not placed')
  return d
}

/** Every refusal arm answers through the SAME presentation face: a typed
 * `a5p5-refused … code=…` text. The per-arm code is asserted by the caller;
 * this pins what NO refusal may ever be (a backend landing, an echo of the
 * targeted tree's claims, or the fixture marker). */
function assertTypedRefusal(text: string, code: string, notCodes: readonly string[]): void {
  expect(text, 'the refusal is typed through the a5p5 face').toContain('a5p5-refused')
  expect(text).toContain(`code=${code}`)
  for (const other of notCodes) expect(text, `a refusal code must name ITS lane only (${other} is another lane's answer)`).not.toContain(`code=${other}`)
  // The shut face's landing is NEVER refusal evidence (the run8 law); the
  // fixture mark is only ever produced by the backend actually running.
  expect(text).not.toContain('IO_POLICY_UNSUPPORTED')
  expect(text).not.toContain(BACKEND_MARK)
  // Zero INFORMATION EFFECT: a refusal that echoed the targeted tree's
  // claims would leak exactly what the refusal promised to prevent.
  expect(text).not.toContain(CLAIM_ALPHA)
  expect(text).not.toContain(CLAIM_BETA)
}

describe('u6-pr5 S5 — the glob refusal arm (offline C1 mirror of arca:search-refusal-zero-effect)', () => {
  const sentinelAsk = join(ROOT_ASK, 'backend-ran.sentinel')
  const sentinelDeny = join(ROOT_DENY, 'backend-ran.sentinel')
  const sentinelPos = join(ROOT_POS, 'backend-ran.sentinel')

  it('S5a the approval-deny lane refuses team_glob TYPED before the armed backend; the targeted tree shows ZERO effect', async () => {
    seedTree(ROOT_ASK)
    const audit: string[] = []
    const fixture = createS5GlobFixture(sentinelAsk)
    const pre = census(ROOT_ASK)
    const value = await mountS5({
      rootDir: ROOT_ASK,
      controlLeg: denyingControlLeg(audit),
      // The a5-m1-bash WORLD law (B-C1-5): a member world with ASK default
      // and NO covering rule routes the call to the approval lane — the
      // ask lifecycle is Host-PA-owned; the C1 stand-in leg answers deny.
      permissionPolicy: { default: 'ask', allow: [], ask: [], deny: [] },
      backends: { glob: fixture },
    })
    // The witness is ARMED before anything is measured: the mounted glob
    // backend IS the fixture (a shut face would vacuate every zero below).
    expect(String(value.backends.glob?.backendId)).toBe('u6pr5-s5-fixture-glob')

    const r = await globRow(value).execute({ pattern: 'u6pr5-s5-*.txt' })
    assertTypedRefusal(r.text, 'APPROVAL_DENIED', ['template-deny-lane', 'template-default-deny'])
    // The refusal came FROM the approval lane: the leg ran and answered deny.
    expect(audit.some((l) => l.includes('decision=deny')), `the approval lane answered: ${audit.join(' / ') || '(nothing)'}`).toBe(true)
    // ZERO SIDE EFFECTS — no observable read or write anywhere in the
    // glob-targeted tree: the armed backend never ran, its sentinel was
    // never created, and the tree census (bytes + mtime/ctime/atime stamps)
    // is IDENTICAL before/after.
    expect(fixture.execCount(), 'the glob backend never ran').toBe(0)
    expect(existsSync(sentinelAsk), 'no sentinel: the backend never ran').toBe(false)
    expect(census(ROOT_ASK), 'zero effect: the glob-targeted tree is stamp-identical').toBe(pre)
  })

  it('S5b the template lane answers glob refusals in its OWN code: template-deny-lane ≠ APPROVAL_DENIED, the leg never runs', async () => {
    seedTree(ROOT_DENY)
    const audit: string[] = []
    const fixture = createS5GlobFixture(sentinelDeny)
    const pre = census(ROOT_DENY)
    const value = await mountS5({
      rootDir: ROOT_DENY,
      controlLeg: approvingControlLeg(audit),
      // A `read`-class deny rule over the resource the anchored glob arm
      // claims (LIST on the governed root, effects-schema anchored form):
      // the lane fast path refuses BEFORE the approval plane exists.
      permissionPolicy: { default: 'ask', allow: [], ask: [], deny: [{ tool: 'read', resource: { kind: 'exact', path: ROOT_DENY } }] },
      backends: { glob: fixture },
    })
    expect(String(value.backends.glob?.backendId)).toBe('u6pr5-s5-fixture-glob')

    const r = await globRow(value).execute({ pattern: 'u6pr5-s5-*.txt' })
    assertTypedRefusal(r.text, 'template-deny-lane', ['APPROVAL_DENIED', 'template-default-deny'])
    // One code per lane: a lane refusal never consults the approval plane —
    // if the leg ran, the leg's answer (approve) would have OPENED the call.
    expect(audit, 'the approval lane is not consulted on a lane denial').toEqual([])
    expect(fixture.execCount()).toBe(0)
    expect(existsSync(sentinelDeny), 'no sentinel: the backend never ran').toBe(false)
    expect(census(ROOT_DENY), 'zero effect: the glob-targeted tree is stamp-identical').toBe(pre)
  })

  it('S5c positive control — the SAME mount shape reaches the armed glob backend and ALL THREE witnesses MOVE (the refusals\' zeros are measured, never vacuous)', async () => {
    seedTree(ROOT_POS)
    const audit: string[] = []
    const fixture = createS5GlobFixture(sentinelPos)
    const pre = census(ROOT_POS)
    const value = await mountS5({
      rootDir: ROOT_POS,
      controlLeg: approvingControlLeg(audit),
      // The alpha5-g1 SUCCESS-arm shape (over-tightening guard): the
      // read-any rule admits the anchored search arms (invokeClasses law:
      // grep/glob are admitted by a read-class rule over the governed
      // surface) and the call reaches the backend with its success path.
      permissionPolicy: { default: 'ask', allow: [{ tool: 'read', resource: { kind: 'any' } }], ask: [], deny: [] },
      backends: { glob: fixture },
    })
    expect(String(value.backends.glob?.backendId)).toBe('u6pr5-s5-fixture-glob')

    const r = await globRow(value).execute({ pattern: 'u6pr5-s5-*.txt' })
    expect(r.text, JSON.stringify(r)).not.toContain('a5p5-refused')
    expect(r.text).toContain(BACKEND_MARK)
    expect(fixture.execCount(), 'the backend ran').toBe(1)
    expect(existsSync(sentinelPos), 'the sentinel exists: the backend ran').toBe(true)
    const post = census(ROOT_POS)
    expect(post, 'the census witness moves when the backend runs').not.toBe(pre)
    expect(post).toContain('backend-ran.sentinel')
  })

  it('S5d cleanup — the S5 worlds self-remove (TEST_METHODS §7: no test world survives its run)', () => {
    rmSync(WORLD, { recursive: true, force: true })
    expect(existsSync(WORLD)).toBe(false)
  })
})
