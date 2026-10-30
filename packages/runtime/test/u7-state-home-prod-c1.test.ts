/**
 * U7-R3 STATE-HOME PRODUCTION C1 (V1) — the two-arm home law of
 * `resolveAgentStateHome` per the narrowed R-STATE-HOME-1 ruling
 * (USER-RULING-20261031 §2, route R1; design note
 * `docs/plans/memo/unified-baseline-alpha5-20261025/state-home/PRODUCTION-HOME-DESIGN.md`).
 *
 * The discriminator is the assembly-set boolean `teamToolPlane.testHomeGuard`
 * (DEFAULT = production, guard off; every test World sets it true at its
 * row-config choke point). This suite pins the LAW deterministically with no
 * boot (V1 only — the live V2 arm is a separately pre-registered C2 lane):
 *
 *  P  the PRODUCTION arm answers EXACTLY the upstream trusted home API:
 *     `resolveDshHome()` / `defaultDshHome()` from the PUBLIC export
 *     `@deepseek-ai/dsh-home-paths` (unset → `~/.dsh` default ACCEPTED as the
 *     host's own home; explicit `~/.dsh` ACCEPTED — design (a) rows 1–2; the
 *     plugin never reimplements the priority, it delegates to the package),
 *     with the existing realpath + exists + is-directory validation still run
 *     (design (d)-2) and the plugin-owned namespace
 *     `<home>/team-state/agent-state/<realmId>/` under it (design (c));
 *  T  the TEST arm (`testHomeGuard: true`) reproduces EVERY shipped refusal
 *     byte-for-byte — unset/blank → `HOME_MISSING`, relative/nonexistent →
 *     `HOME_INVALID` (never cwd-resolved), the operator's live `~/.dsh` →
 *     `HOME_INVALID` (design (c) bullet 1; the shipped H1/H2/H3 legs of
 *     `u7-agentstate-fs-store-c1.test.ts` stay the primary pin, this arm pins
 *     the same refusals through the discriminator parameter);
 *  D  the discriminator matrix at the assembly layer: flag × env × `~/.dsh`
 *     shape, each cell asserting its typed outcome through the REAL
 *     descriptor + the REAL closed-world config law;
 *  H  the fake-operator-home control: the real `~/.dsh` of this machine is
 *     NEVER consulted or written. Legs that need `os.homedir()` to answer a
 *     fake operator run in a PRISTINE CHILD PROCESS spawned with
 *     `HOME=<scratch operator>` (measured fact of this vitest world: a
 *     `process.env.HOME` write inside a worker is NOT visible to
 *     `os.homedir()` in-process — a child env is the honest, non-destructive
 *     fake; `process.env` is never mutated at all on those legs). All other
 *     legs pass explicit env OBJECTS.
 *  W  every refusal cell leaves ZERO new files anywhere in the scratch tree,
 *     nothing is ever created against the cwd, and ACCEPTED cells create
 *     nothing either (homes are resolved, never created).
 *
 * Disclosed interpretation choices (the PR body carries both verbatim):
 *  - blank raw `DSH_HOME` in the PRODUCTION arm follows upstream's documented
 *    semantics ("an empty or whitespace-only `$DSH_HOME` is treated as unset",
 *    `home-paths/src/index.ts`), i.e. the default arm activates — design (d)-1
 *    parenthetical: "production's default arm activates only when the raw env
 *    is genuinely absent/blank". It never resolves to the cwd either way.
 *  - a resolved home that does not EXIST stays refused in BOTH arms (the
 *    store never creates its home; on a real install the Host creates `~/.dsh`
 *    before any plugin mounts — the "must exist" refusal matches upstream
 *    reality and keeps every refusal typed).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { spawnSync } from 'node:child_process'
import { closeSync, existsSync, mkdirSync, mkdtempSync, openSync, readdirSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { isAbsolute, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { defaultDshHome, resolveDshHome } from '@deepseek-ai/dsh-home-paths'

type Refusal = { ok: false, code: string, detail: string }
type HomeOk = { ok: true, home: string }
type HomeAnswer = HomeOk | Refusal
type RootAnswer = { ok: true, rootDir: string } | Refusal
type LaneModule = {
  resolveAgentStateHome: (opts?: { env?: Record<string, string | undefined>, realHome?: string, testHomeGuard?: boolean }) => HomeAnswer
  storeRootFor: (home: string, realmId: string) => RootAnswer
  STATE_STORE_SUBTREE: readonly string[]
}
type DescriptorModule = {
  familyAssembly: {
    config: Record<string, string>
    build: (cap: unknown) => { refused?: { code: string, message: string }, diagnostics?: { agentStateStore?: { name: string, rootDir: string } } }
  }
}
type FamilyAssemblyModule = {
  checkFamilyConfig: (descriptor: unknown, planeConfig: unknown) => { ok: true } | { ok: false, code: string, message: string }
}

const lane = await (import(new URL('../../tools/agent-state-family/src/index.mjs', import.meta.url).href) as unknown as Promise<LaneModule>)
const descriptorMod = await (import(new URL('../../tools/families/agent-state.mjs', import.meta.url).href) as unknown as Promise<DescriptorModule>)
const familyAssemblyModule = await (import(new URL('../src/plugin/live/family-assembly.mjs', import.meta.url).href) as unknown as Promise<FamilyAssemblyModule>)
const descriptor = descriptorMod.familyAssembly

// The package's minimal node shim (src/plugin/node-min.d.ts) types neither
// `process.env`, `process.env.HOME`, nor `process.execPath`; a narrow local
// view, not a shim edit.
const proc = process as unknown as { env: Record<string, string | undefined>, execPath: string }

const REALM = 'u7shp-realm'
const POLICY = Object.freeze({ default: 'ask', allow: [], ask: [], deny: [] })

// ── pristine-child probe machinery (the fake-`HOME` control, see header H) ──
// The child runs with RAW node resolution (no vite `.js`→`.ts` rewrite), so
// the unit probe imports the store module DIRECTLY (its face is `node:*` +
// the upstream home package) and the assembly probe imports the SHIPPED DIST
// MIRROR of the descriptor — the same face the production entry mounts, whose
// repo-relative edges resolve identically inside the mirror (placement law,
// scripts/dist-placements/110-agent-state.json). The mirror is a committed
// byte-copy of src (checked by `pnpm check:artifacts`), so the child probes
// grade the same bytes the in-process legs read.
const require_ = createRequire(import.meta.url)
const STORE_URL = new URL('../../tools/agent-state-family/src/fs-state-store.mjs', import.meta.url).href
const FAMILY_DIST_URL = new URL('../dist/packages/tools/families/agent-state.mjs', import.meta.url).href
const HOME_PATHS_URL = pathToFileURL(require_.resolve('@deepseek-ai/dsh-home-paths')).href
const CHILD_PRELUDE =
  `const lane = await import(${JSON.stringify(STORE_URL)});` +
  `const homePaths = await import(${JSON.stringify(HOME_PATHS_URL)});`
/** Run `expr` (an expression over `lane` and `homePaths`, may await) in a
 *  FRESH node process whose env is the parent env plus `env` — the one honest
 *  way in this world to give `os.homedir()` a fake operator home without ever
 *  mutating `process.env` of any live process. */
function childProbe(env: Record<string, string>, expr: string): Record<string, unknown> {
  const script = `${CHILD_PRELUDE}process.stdout.write(JSON.stringify(await (${expr})));`
  const merged = { ...proc.env, ...env }
  const cleanEnv = Object.fromEntries(Object.entries(merged).filter(([, v]) => v !== undefined) as Array<[string, string]>)
  const r = spawnSync(proc.execPath, ['--input-type=module', '-e', script], {
    env: cleanEnv,
    encoding: 'utf8',
    timeout: 30_000,
  })
  // Node echoes the whole (long) -e script before the error, so the TAIL of
  // stderr holds the actual failure; keep a short head too for spawn errors.
  if (r.status !== 0) {
    const err = String(r.stderr)
    throw new Error(`child probe failed (${String(r.status)}): ${err.length > 1600 ? `${err.slice(0, 160)} … ` : ''}${err.slice(-1400)}`)
  }
  return JSON.parse(r.stdout) as Record<string, unknown>
}

let scratch = ''
let savedHome: string | undefined
let savedDsh: string | undefined
beforeEach(() => {
  // Every fixture lives under a REALPATHED scratch tree, so a resolved path
  // under it is byte-stable (`realpath === path`) for the equality legs.
  scratch = realpathSync(mkdtempSync(join(tmpdir(), 'u7shp-')))
  savedHome = proc.env.HOME
  savedDsh = proc.env.DSH_HOME
  delete proc.env.DSH_HOME
})
afterEach(() => {
  if (savedHome === undefined) delete proc.env.HOME
  else proc.env.HOME = savedHome
  if (savedDsh === undefined) delete proc.env.DSH_HOME
  else proc.env.DSH_HOME = savedDsh
  rmSync(scratch, { recursive: true, force: true })
})

/** A fake operator home under the scratch tree — the real `~/.dsh` of this
 *  machine is NEVER consulted or written by any leg (TEST_METHODS red line). */
function fakeOperator(withDsh = true): { op: string, dsh: string } {
  const op = join(scratch, 'operator')
  const dsh = join(op, '.dsh')
  if (withDsh) mkdirSync(dsh, { recursive: true })
  else mkdirSync(op, { recursive: true })
  return { op, dsh }
}

/** Run with HOME pointed at a scratch directory — saved and restored, never
 *  a destructive mutation of `process.env` (the H1 hygiene pin). */
function withHome<T>(home: string, run: () => T): T {
  const saved = proc.env.HOME
  proc.env.HOME = home
  try { return run() } finally {
    if (saved === undefined) delete proc.env.HOME
    else proc.env.HOME = saved
  }
}

/** Every file path under `dir`, recursively (the write census). */
function treeOf(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name)
    if (entry.isDirectory()) treeOf(p, out)
    else out.push(p)
  }
  return out
}

/** The minimal capability the production-store arm of the REAL descriptor
 *  consumes (same shape the shipped H6 leg drives). */
const buildCap = (planeConfig: Record<string, unknown>) => ({
  realmId: REALM,
  injected: {},
  hostService: () => undefined,
  logBackend: () => () => {},
  permissionPolicy: POLICY,
  decide: () => ({ kind: 'allow' }),
  pa: async () => ({ kind: 'allow' }),
  presentationFace: {},
  planeConfig: { agentStateEnabled: true, ...planeConfig },
})
/** The child-side twin of `buildCap` (plain data + closures, inlined). */
const childBuildCap = (planeConfig: string) =>
  `({ realmId: ${JSON.stringify(REALM)}, injected: {}, hostService: () => undefined, logBackend: () => () => {}, ` +
  `permissionPolicy: ${JSON.stringify(POLICY)}, decide: () => ({ kind: 'allow' }), pa: async () => ({ kind: 'allow' }), ` +
  `presentationFace: {}, planeConfig: { agentStateEnabled: true, ${planeConfig} } })`

describe('u7shp P — the production arm answers EXACTLY the upstream home API (route R1)', () => {
  it('P1 unset → the default home is ACCEPTED as the host\'s own home, byte-identical to resolveDshHome()/defaultDshHome(), namespace under it (pristine child, HOME=<scratch operator>, DSH_HOME absent)', () => {
    const { op, dsh } = fakeOperator()
    // DSH_HOME was deleted from process.env in beforeEach, so the child's
    // inherited env genuinely lacks the key.
    const out = childProbe({ HOME: op },
      `({ home: lane.resolveAgentStateHome({ testHomeGuard: false }), upstream: homePaths.resolveDshHome(), upstreamDefault: homePaths.defaultDshHome() })`)
    const home = out.home as HomeAnswer
    expect(home.ok, JSON.stringify(home)).toBe(true)
    expect((home as HomeOk).home).toBe(out.upstream)
    expect((home as HomeOk).home).toBe(out.upstreamDefault)
    expect((home as HomeOk).home).toBe(dsh)
    const root = lane.storeRootFor((home as HomeOk).home, REALM)
    expect(root.ok).toBe(true)
    expect((root as { rootDir: string }).rootDir).toBe(join(dsh, ...lane.STATE_STORE_SUBTREE, REALM))
  })

  it('P2 blank raw DSH_HOME follows upstream semantics in the PRODUCTION arm — treated as unset, the default arm activates, byte-equal to resolveDshHome (pristine child)', () => {
    const { op, dsh } = fakeOperator()
    for (const blank of ['', '   ']) {
      const out = childProbe({ HOME: op, DSH_HOME: blank },
        `({ home: lane.resolveAgentStateHome({ testHomeGuard: false }), upstream: homePaths.resolveDshHome() })`)
      const home = out.home as HomeAnswer
      expect(home.ok, JSON.stringify(blank)).toBe(true)
      expect((home as HomeOk).home).toBe(out.upstream)
      expect((home as HomeOk).home).toBe(dsh)
    }
  })

  it('P3 relative raw DSH_HOME stays refused in the PRODUCTION arm (the shape law is preserved both modes; upstream\'s own cwd-resolved answer is pinned as the thing we refuse)', () => {
    const rel = 'relative/home'
    // Upstream WOULD cwd-resolve this shape — pinned so the refusal is read as
    // the DELIBERATE preserved divergence (design (d)-1: "never cwd-resolved").
    expect(isAbsolute(resolveDshHome(undefined, { DSH_HOME: rel }))).toBe(true)
    expect(resolveDshHome(undefined, { DSH_HOME: rel })).toBe(resolve(rel))
    const r = lane.resolveAgentStateHome({ env: { DSH_HOME: rel }, testHomeGuard: false })
    expect(r.ok).toBe(false)
    expect((r as Refusal).code).toBe('AGENT_STATE_STORE_HOME_INVALID')
    expect(existsSync(resolve(rel)), 'a refused home must never be created against the cwd').toBe(false)
  })

  it('P4 absolute nonexistent → HOME_INVALID in the PRODUCTION arm too (must-exist law; the store never creates its home)', () => {
    const missing = join(scratch, 'does-not-exist')
    const r = lane.resolveAgentStateHome({ env: { DSH_HOME: missing }, testHomeGuard: false })
    expect(r.ok).toBe(false)
    expect((r as Refusal).code).toBe('AGENT_STATE_STORE_HOME_INVALID')
    expect(existsSync(missing)).toBe(false)
  })

  it('P5 explicit absolute existing home → accepted; the accepted value is upstream\'s own resolved answer (no plugin re-spelling)', () => {
    const world = join(scratch, 'world-home')
    mkdirSync(world)
    const r = lane.resolveAgentStateHome({ env: { DSH_HOME: world }, testHomeGuard: false })
    expect(r.ok, JSON.stringify(r)).toBe(true)
    expect((r as HomeOk).home).toBe(resolveDshHome(undefined, { DSH_HOME: world }))
    expect((r as HomeOk).home).toBe(world)
  })

  it('P6 explicit DSH_HOME spelling the operator\'s ~/.dsh is ACCEPTED in the PRODUCTION arm (design (a) row 2: it IS the host\'s own home)', () => {
    const { dsh } = fakeOperator()
    const r = lane.resolveAgentStateHome({ env: { DSH_HOME: dsh }, testHomeGuard: false })
    expect(r.ok, JSON.stringify(r)).toBe(true)
    expect((r as HomeOk).home).toBe(resolveDshHome(undefined, { DSH_HOME: dsh }))
    const root = lane.storeRootFor((r as HomeOk).home, REALM)
    expect((root as { rootDir: string }).rootDir).toBe(join(dsh, ...lane.STATE_STORE_SUBTREE, REALM))
  })

  it('P7 a symlink whose realpath lands in the host home is ACCEPTED in the PRODUCTION arm (the sameOrUnder refusal is test-mode-only; realpath validation still runs)', () => {
    const { dsh } = fakeOperator()
    const into = join(scratch, 'innocent-looking')
    symlinkSync(dsh, into)
    const r = lane.resolveAgentStateHome({ env: { DSH_HOME: into }, testHomeGuard: false })
    expect(r.ok, JSON.stringify(r)).toBe(true)
    expect((r as HomeOk).home).toBe(dsh)
  })

  it('P8 a regular FILE as DSH_HOME refuses with the is-directory law in BOTH arms (design (d)-2 unchanged)', () => {
    const file = join(scratch, 'a-file')
    const fd = openSync(file, 'w')
    try { writeFileSync(fd, 'x') } finally { closeSync(fd) }
    for (const guard of [true, false] as const) {
      const r = lane.resolveAgentStateHome({ env: { DSH_HOME: file }, testHomeGuard: guard })
      expect(r.ok, `guard=${String(guard)}`).toBe(false)
      expect((r as Refusal).code).toBe('AGENT_STATE_STORE_HOME_INVALID')
      expect((r as Refusal).detail).toBe('DSH_HOME is not a directory')
    }
  })
})

describe('u7shp T — the TEST arm reproduces every shipped refusal byte-for-byte', () => {
  const SHIPPED_MISSING_DETAIL = 'DSH_HOME is not set, so this mount has no durable home to write governed agent state into (refused — an invented default would write outside the sanctioned root)'

  it('T1 unset → HOME_MISSING with the shipped code AND detail', () => {
    const r = lane.resolveAgentStateHome({ env: {}, testHomeGuard: true })
    expect(r.ok).toBe(false)
    expect((r as Refusal).code).toBe('AGENT_STATE_STORE_HOME_MISSING')
    expect((r as Refusal).detail).toBe(SHIPPED_MISSING_DETAIL)
  })

  it('T2 blank → HOME_MISSING with the shipped detail, both blank shapes', () => {
    for (const blank of ['', '   ']) {
      const r = lane.resolveAgentStateHome({ env: { DSH_HOME: blank }, testHomeGuard: true })
      expect(r.ok, JSON.stringify(blank)).toBe(false)
      expect((r as Refusal).code).toBe('AGENT_STATE_STORE_HOME_MISSING')
      expect((r as Refusal).detail).toBe(SHIPPED_MISSING_DETAIL)
    }
  })

  it('T3 relative → HOME_INVALID with the shipped detail (never resolved against the cwd)', () => {
    const rel = 'relative/home'
    const r = lane.resolveAgentStateHome({ env: { DSH_HOME: rel }, testHomeGuard: true })
    expect(r.ok).toBe(false)
    expect((r as Refusal).code).toBe('AGENT_STATE_STORE_HOME_INVALID')
    expect((r as Refusal).detail).toBe(`DSH_HOME must be an absolute path — got ${JSON.stringify(rel)} (refused, never resolved against the cwd)`)
    expect(existsSync(resolve(rel))).toBe(false)
  })

  it('T4 nonexistent absolute → HOME_INVALID with the shipped detail shape', () => {
    const missing = join(scratch, 'does-not-exist')
    const r = lane.resolveAgentStateHome({ env: { DSH_HOME: missing }, testHomeGuard: true })
    expect(r.ok).toBe(false)
    expect((r as Refusal).code).toBe('AGENT_STATE_STORE_HOME_INVALID')
    expect((r as Refusal).detail.startsWith('DSH_HOME does not resolve to an existing directory:')).toBe(true)
  })

  it('T5 the fake operator\'s live .dsh, a dir under it, and a symlink into it are ALL refused (mirrors the shipped H2 exactly)', () => {
    const { op, dsh } = fakeOperator()
    const intoLive = join(scratch, 'innocent-looking')
    symlinkSync(dsh, intoLive)
    mkdirSync(join(dsh, 'nested'))
    for (const candidate of [dsh, join(dsh, 'nested'), intoLive]) {
      const r = lane.resolveAgentStateHome({ env: { DSH_HOME: candidate }, realHome: op, testHomeGuard: true })
      expect(r.ok, candidate).toBe(false)
      expect((r as Refusal).code).toBe('AGENT_STATE_STORE_HOME_INVALID')
      expect((r as Refusal).detail.startsWith(`DSH_HOME resolves to the operator's live harness home (${dsh})`)).toBe(true)
    }
  })

  it('T6 a .dsh-NAMED dir that is NOT the fake operator\'s live home stays a plain accepted home (the guard is the live home, not the spelling)', () => {
    const { op } = fakeOperator(false)
    const elsewhere = join(scratch, 'elsewhere', '.dsh')
    mkdirSync(elsewhere, { recursive: true })
    const r = lane.resolveAgentStateHome({ env: { DSH_HOME: elsewhere }, realHome: op, testHomeGuard: true })
    expect(r.ok, JSON.stringify(r)).toBe(true)
    expect((r as HomeOk).home).toBe(elsewhere)
  })

  it('T7 the TEST arm reads the live home through the ENV (pristine child, HOME=<scratch operator>): DSH_HOME=<that home\'s .dsh> is refused, never consulted against a hardcoded real path', () => {
    const { op, dsh } = fakeOperator()
    const out = childProbe({ HOME: op, DSH_HOME: dsh },
      `lane.resolveAgentStateHome({ testHomeGuard: true })`)
    const r = out as unknown as HomeAnswer
    expect(r.ok).toBe(false)
    expect((r as Refusal).code).toBe('AGENT_STATE_STORE_HOME_INVALID')
    expect((r as Refusal).detail.startsWith(`DSH_HOME resolves to the operator's live harness home (${dsh})`)).toBe(true)
  })
})

describe('u7shp D — the discriminator matrix at the assembly layer (REAL descriptor + REAL closed-world config law)', () => {
  it('D1 the descriptor books the closed boolean pair (agentStateEnabled, testHomeGuard) — no other config key', () => {
    expect(descriptor.config).toEqual({ agentStateEnabled: 'boolean', testHomeGuard: 'boolean' })
  })

  it('D2 checkFamilyConfig: testHomeGuard must be a boolean WHEN PRESENT (PLANE_CONFIG_INCOMPLETE, never coerced); absent is legal (DEFAULT = production)', () => {
    expect(familyAssemblyModule.checkFamilyConfig(descriptor, { agentStateEnabled: true })).toEqual({ ok: true })
    expect(familyAssemblyModule.checkFamilyConfig(descriptor, { agentStateEnabled: true, testHomeGuard: true })).toEqual({ ok: true })
    expect(familyAssemblyModule.checkFamilyConfig(descriptor, { agentStateEnabled: true, testHomeGuard: false })).toEqual({ ok: true })
    const bad = familyAssemblyModule.checkFamilyConfig(descriptor, { agentStateEnabled: true, testHomeGuard: 'yes' })
    expect(bad.ok).toBe(false)
    expect((bad as { code: string }).code).toBe('PLANE_CONFIG_INCOMPLETE')
  })

  it('D3 flag TRUE + DSH_HOME unset → the mount refuses with the shipped HOME_MISSING law (test-world byte-for-byte)', () => {
    const built = descriptor.build(buildCap({ testHomeGuard: true }))
    expect(built.refused?.code).toBe('PLANE_AGENT_STATE_STORE_MISSING')
    expect(built.refused?.message).toContain('AGENT_STATE_STORE_HOME_MISSING')
  })

  it('D4 flag ABSENT (production mount) + DSH_HOME unset + HOME=<fake host home> → the production store mounts at <home>/team-state/agent-state/<realm> and NOTHING is created by the mount (pristine child)', () => {
    const { op, dsh } = fakeOperator()
    const out = childProbe({ HOME: op }, [
      `(async () => {`,
      `  const fs = await import('node:fs');`,
      `  const b = (await import(${JSON.stringify(FAMILY_DIST_URL)})).familyAssembly.build(${childBuildCap('')});`,
      `  return { refused: b.refused ?? null,`,
      `    port: b.diagnostics?.agentStateStore ? { name: b.diagnostics.agentStateStore.name, rootDir: b.diagnostics.agentStateStore.rootDir } : null,`,
      `    namespaceExists: fs.existsSync(${JSON.stringify(join(dsh, 'team-state'))}),`,
      `    homeTree: fs.readdirSync(${JSON.stringify(dsh)}) };`,
      `})()`,
    ].join(' '))
    expect(out.refused).toBeNull()
    expect((out.port as { name: string }).name).toBe('agent-state:fs')
    expect((out.port as { rootDir: string }).rootDir).toBe(join(dsh, ...lane.STATE_STORE_SUBTREE, REALM))
    // building a store must not create anything — the namespace appears only
    // under governed writes, and none happened here.
    expect(out.namespaceExists).toBe(false)
    expect(out.homeTree).toEqual([])
  })

  it('D5 flag ABSENT + DSH_HOME=<explicit host-home spelling> → accepted at the assembly level too (the refusal is gone from production by ruling)', () => {
    const { dsh } = fakeOperator()
    proc.env.DSH_HOME = dsh
    const built = descriptor.build(buildCap({}))
    expect(built.refused).toBeUndefined()
    expect(built.diagnostics?.agentStateStore?.rootDir).toBe(join(dsh, ...lane.STATE_STORE_SUBTREE, REALM))
  })

  it('D6 flag TRUE + DSH_HOME=<host home via HOME> → refused at the assembly level too (the test-mode guard keeps its TEST_METHODS red line; pristine child)', () => {
    const { op, dsh } = fakeOperator()
    const out = childProbe({ HOME: op, DSH_HOME: dsh }, [
      `(async () => {`,
      `  const b = (await import(${JSON.stringify(FAMILY_DIST_URL)})).familyAssembly.build(${childBuildCap('testHomeGuard: true')});`,
      `  return { refused: b.refused ?? null };`,
      `})()`,
    ].join(' '))
    const refused = out.refused as { code: string, message: string } | null
    expect(refused?.code).toBe('PLANE_AGENT_STATE_STORE_MISSING')
    expect(refused?.message).toContain('AGENT_STATE_STORE_HOME_INVALID')
  })

  it('D7 flag ABSENT + relative/nonexistent env shapes refuse typed at the assembly level too (the surviving laws run over the upstream answer)', () => {
    for (const value of ['relative/home', join(scratch, 'does-not-exist')]) {
      proc.env.DSH_HOME = value
      const built = descriptor.build(buildCap({}))
      expect(built.refused?.code, value).toBe('PLANE_AGENT_STATE_STORE_MISSING')
      expect(built.refused?.message, value).toContain('AGENT_STATE_STORE_HOME_INVALID')
    }
  })
})

describe('u7shp W/H — the fake-operator control and the zero-write census', () => {
  it('W1 every refusal cell of the matrix leaves ZERO new files in the scratch tree (nothing created anywhere, nothing against the cwd)', () => {
    const { op, dsh } = fakeOperator()
    const nested = join(dsh, 'nested')
    mkdirSync(nested)
    const missing = join(scratch, 'does-not-exist')
    const before = treeOf(scratch).sort()
    const cwdArtifact = resolve('relative/home')
    for (const guard of [true, false] as const) {
      const envs: Array<Record<string, string | undefined>> = [
        { DSH_HOME: 'relative/home' }, { DSH_HOME: missing },
      ]
      for (const env of envs) {
        for (const realHome of [undefined, op] as const) {
          const r = lane.resolveAgentStateHome({ env, realHome, testHomeGuard: guard })
          expect(r.ok, `guard=${String(guard)} env=${JSON.stringify(env)}`).toBe(false)
        }
      }
      // The unset/blank cells: guard-on refuses; production ACCEPTS by ruling
      // (the default home is the host's own home — asserted by P1/P2/D4).
      for (const env of [{}, { DSH_HOME: '' }, { DSH_HOME: '   ' }] as Array<Record<string, string | undefined>>) {
        const g = lane.resolveAgentStateHome({ env, realHome: op, testHomeGuard: true })
        expect(g.ok, JSON.stringify(env)).toBe(false)
      }
    }
    expect(treeOf(scratch).sort()).toEqual(before)
    expect(existsSync(cwdArtifact)).toBe(false)
  })

  it('W2 the accepted homes of every in-process cell are all under the scratch tree — homes are RESOLVED, never created', () => {
    const { op } = fakeOperator(false)
    const world = join(scratch, 'world-home')
    mkdirSync(world)
    const accepted: string[] = []
    for (const guard of [true, false] as const) {
      const r = lane.resolveAgentStateHome({ env: { DSH_HOME: world }, realHome: op, testHomeGuard: guard })
      expect(r.ok, JSON.stringify(r)).toBe(true)
      accepted.push((r as HomeOk).home)
    }
    for (const home of accepted) expect(home.startsWith(scratch)).toBe(true)
    expect(treeOf(scratch).length).toBe(0)
  })

  it('H1 process.env is restored after every HOME-control helper call, throw included (save/restore, never destructive)', () => {
    const { op } = fakeOperator()
    const before = proc.env.HOME
    withHome(op, () => { expect(proc.env.HOME).toBe(op) })
    expect(proc.env.HOME).toBe(before)
    expect(() => withHome(op, () => { throw new Error('boom') })).toThrow('boom')
    expect(proc.env.HOME).toBe(before)
  })
})
