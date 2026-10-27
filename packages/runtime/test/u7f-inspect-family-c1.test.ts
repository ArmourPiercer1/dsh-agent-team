/**
 * u7f-inspect-family-c1 — the INSPECT family (governed skill loader +
 * governed cordis_inspect list/query) at the C1 (offline) level, U7-F.
 *
 * LAW PROVEN HERE (all of it against the REAL seam: the descriptor is
 * mounted through `createTeamToolPlaneAssembly` with the reviewed family
 * manifest, so registration rides the closed schema + checkBuiltFamily +
 * kernel-capability law):
 *  1. ZERO-FLIP: without `planeCfg.inspectFamilyEnabled` the mount places
 *     EXACTLY the seven master names; the family is invisible.
 *  2. POSITIVES: authorized skill load executes and observes; inspect list
 *     and inspect query execute through the injected host face.
 *  3. REFUSAL ARMS with zero effect: out-of-root skill path (grammar +
 *     config), symlink escape, unknown skill, unknown provider / unknown
 *     method (refusals LIST what is available), schema-invalid input (zero
 *     dispatch), query TIMEOUT, cancel-during-pending (`call-aborted`), and
 *     the LATE-RESULT law (a value landing after timeout/abort is NEVER
 *     delivered); mutation-shaped requests (extra parameters) refused at
 *     the schema edge with ZERO PA walk.
 *  4. READ-ONLY PROOF: across every executed call the PA request set's
 *     effect kinds are only ever {tool-invoke, read, meta} — no mutation
 *     kind is ever requested.
 *  5. MUTATION CONTROLS: planted bugs on the transformed REAL sources (drop
 *     the symlink-alias arm; deliver the late result after timeout) turn
 *     the matching vectors RED — the vectors pin the law, not the mood.
 *
 * The row-invocation legs drive the DESCRIPTOR with faked `decide`/`pa`
 * faces (the seam-injected authority edges): these legs prove the LANE's
 * law (what it declares to PA, what it does before/after the edge). The
 * mount legs prove the SEAM integration (schema, names, kernel capability).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, rmSync, writeFileSync, symlinkSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const REPO = fileURLToPath(new URL('../../../', import.meta.url).href)
const LAUNCHER = join(REPO, 'packages/runtime/sandbox-provider/launcher/landlock-prelauncher.py')
const LAUNCHER_SHA = createHash('sha256').update(readFileSync(LAUNCHER)).digest('hex')
const WORLD = join(REPO, 'tests/homes', `u7f-c1-${Date.now().toString(36)}`)
const ROOT_DIR = join(WORLD, 'root')
const SKILL_ROOT = join(WORLD, 'skills')
const OUTSIDE = join(WORLD, 'outside-secret.txt')
const REALM = 'u7f-c1-realm'
const LANE = join(REPO, 'packages/tools/inspect-family/src')

interface PlaneRow {
  createTeamToolPlaneAssembly: (input: Record<string, unknown>) => {
    ok: boolean
    code?: string
    message?: string
    value?: { definitions: ReadonlyArray<{ name: string }>; mount: (agentCtx: unknown) => { ok: boolean; code?: string; name?: string; dispose?: () => void } }
  }
}
let plane: PlaneRow
let descriptor: {
  familyAssembly: {
    claims: (cap: Record<string, unknown>) => string[]
    enabled: (cap: Record<string, unknown>) => boolean
    disabledOwned: (cap: Record<string, unknown>) => string[]
    build: (cap: Record<string, unknown>) => {
      definitions?: ReadonlyArray<{ name: string; description: string; parameters: Record<string, unknown>; execute: (raw: Record<string, unknown>, exec: Record<string, unknown>) => Promise<unknown>, output: Record<string, unknown> }>
      contribution?: Record<string, unknown>
      refused?: { code: string; message: string }
    }
  }
}

const confinedProvider = () => ({
  trustRoot: `sha256:${LAUNCHER_SHA.slice(0, 16)}#${LAUNCHER}`,
  assembly: { launcherPath: LAUNCHER, launcherSha256: LAUNCHER_SHA, minAbiVersion: 3 },
})
const MASTER_SEVEN = ['edit', 'read', 'read_image', 'team_bash', 'team_glob', 'team_grep', 'write']

const planeInput = (planeCfg: Record<string, unknown> = {}) => ({
  dispatcherLifecycle: { inflight: () => 0 },
  permissionPolicy: { default: 'ask', allow: [], ask: [], deny: [] },
  realmId: REALM, templateId: 't', role: 'member', instanceId: 'i',
  plane: {
    fsInstance: { fs: 'c', rootDir: ROOT_DIR, realmId: REALM, kind: 'absolute-path' },
    confinedProvider: confinedProvider(),
    ...planeCfg,
  },
  teamSessionId: 'u7f-c1-team',
})

/** Fake host `cordisInspect` registry face with dispatch accounting. */
function fakeInspectFace(overrides: Record<string, unknown> = {}) {
  const calls = { list: 0, query: 0, queries: [] as unknown[][] }
  const providers = [{
    platform: 'host', id: 'p.one',
    methods: [{ name: 'echo', inputSchema: { type: 'object', properties: { x: { type: 'string' } }, required: ['x'] } }],
  }, {
    platform: 'client', id: 'page.theme',
    methods: [{ name: 'tokens', inputSchema: {} }],
  }]
  const face = {
    list: () => { calls.list += 1; return Array.isArray(overrides.list) ? overrides.list : providers },
    query: (platform: string, provider: string, method: string, input: unknown, agent: unknown, signal: AbortSignal) => {
      calls.query += 1
      calls.queries.push([platform, provider, method, input, agent, signal])
      if (typeof overrides.query === 'function') return (overrides.query as (...a: unknown[]) => unknown)(platform, provider, method, input, agent, signal)
      return Promise.resolve({ echo: input ?? null })
    },
  }
  return { face, calls }
}

/** Descriptor-level cap with capturing pa (records every request set). */
function descriptorCap(extra: Record<string, unknown> = {}) {
  const paCalls: { callId: string; effects: Array<Record<string, unknown>>; kinds: string[] }[] = []
  const cap: Record<string, unknown> = {
    realmId: REALM,
    planeConfig: { inspectFamilyEnabled: true, skillRoots: [SKILL_ROOT], ...(extra.planeConfig as object ?? {}) },
    permissionPolicy: { default: 'ask', allow: [], ask: [], deny: [] },
    decide: () => ({ kind: 'allow' }),
    pa: async (call: { callId: string; requestedEffects: { effects: Array<Record<string, unknown>> } }) => {
      const effects = call.requestedEffects.effects
      paCalls.push({ callId: call.callId, effects, kinds: effects.map((e) => String(e.kind)) })
      return (extra.gate as object ?? { kind: 'allow' })
    },
    hostService: () => undefined,
    injected: {},
    logBackend: () => () => {},
    ...extra,
  }
  return { cap, paCalls }
}

function buildRows(cap: Record<string, unknown>) {
  const built = descriptor.familyAssembly.build(cap)
  if (built.refused !== undefined) throw new Error(`build refused: ${JSON.stringify(built.refused)}`)
  const rows = new Map((built.definitions ?? []).map((d) => [d.name, d]))
  const row = (name: string) => {
    const def = rows.get(name)
    if (def === undefined) throw new Error(`row ${name} not mounted`)
    return def
  }
  return { built, row, names: [...rows.keys()] }
}

const errorText = async (promise: Promise<unknown>): Promise<string> => {
  try {
    await promise
    return '(RESOLVED — expected a typed refusal)'
  } catch (error) {
    return String((error as Error)?.message ?? error)
  }
}

beforeAll(async () => {
  plane = (await import(new URL('../src/plugin/live/team-tool-plane.mjs', import.meta.url).href)) as PlaneRow
  descriptor = await import(new URL('../../tools/families/inspect.mjs', import.meta.url).href) as typeof descriptor
  mkdirSync(join(SKILL_ROOT, 'demo-skill'), { recursive: true })
  mkdirSync(join(SKILL_ROOT, 'link-skill'), { recursive: true })
  mkdirSync(join(SKILL_ROOT, 'quiet-skill'), { recursive: true })
  mkdirSync(join(ROOT_DIR), { recursive: true })
  writeFileSync(join(SKILL_ROOT, 'demo-skill', 'SKILL.md'), '---\nname: demo-skill\ndescription: a demo skill\n---\n\nDo the demo.\n')
  writeFileSync(join(SKILL_ROOT, 'quiet-skill', 'SKILL.md'), '---\nname: quiet-skill\ndescription: hidden\n\ndisable-model-invocation: true\n---\n\nquiet\n')
  writeFileSync(OUTSIDE, '---\nname: link-skill\ndescription: planted outside the anchor\n---\n\nTOP-SECRET-OUTSIDE-THE-ANCHOR\n')
  symlinkSync(OUTSIDE, join(SKILL_ROOT, 'link-skill', 'SKILL.md'))
})
afterAll(() => { rmSync(WORLD, { recursive: true, force: true }) })

describe('u7f-c1 mount seam (real plane + reviewed manifest)', () => {
  it('M1 zero-flip: without the enable flag the mount places EXACTLY the seven master names', () => {
    const built = plane.createTeamToolPlaneAssembly(planeInput())
    expect(built.ok).toBe(true)
    const names = (built.value?.definitions ?? []).map((d) => d.name).sort()
    expect(names).toEqual(MASTER_SEVEN)
  })
  it('M2 the flag mounts the three alias rows through the seam (closed schema + kernel capability accept)', () => {
    const built = plane.createTeamToolPlaneAssembly(planeInput({ inspectFamilyEnabled: true, skillRoots: [SKILL_ROOT] }))
    expect(built.ok).toBe(true)
    const names = (built.value?.definitions ?? []).map((d) => d.name).sort()
    expect(names).toEqual([...MASTER_SEVEN, 'team_cordis_inspect_list', 'team_cordis_inspect_query', 'team_skill'].sort())
    const placed: string[] = []
    const fakeCtx = { tools: { register: (def: { name: string }) => { placed.push(def.name); return () => {} } }, get: () => undefined }
    const mounted = built.value?.mount(fakeCtx)
    expect(mounted?.ok).toBe(true)
    expect(placed.sort()).toEqual(names)
    mounted?.dispose?.()
  })
  it('M3 a malformed skillRoots is a config defect: the WHOLE family refuses (PLANE_INSPECT_ROOTS_INVALID)', () => {
    const built = plane.createTeamToolPlaneAssembly(planeInput({ inspectFamilyEnabled: true, skillRoots: ['relative/path'] }))
    expect(built.ok).toBe(false)
    expect(`${String(built.code ?? '')} ${String(built.message ?? '')}`.toUpperCase()).toContain('INSPECT')
  })
  it('M4 enabled() is trusted config only; the disabled family owns NO names', async () => {
    const mod = await import(new URL('../../tools/families/inspect.mjs', import.meta.url).href) as typeof descriptor
    const d = mod.familyAssembly
    expect(d.enabled({ planeConfig: {} })).toBe(false)
    expect(d.enabled({ planeConfig: { inspectFamilyEnabled: 'yes' } })).toBe(false)
    expect(d.enabled({ planeConfig: { inspectFamilyEnabled: true } })).toBe(true)
    expect(d.disabledOwned({ planeConfig: {} })).toEqual([])
  })
  it('M5 the descriptor is in the reviewed manifest and digests verify (gen-family-index --check law)', async () => {
    const manifest = JSON.parse(readFileSync(join(REPO, 'packages/tools/families/manifest.json'), 'utf8')) as { families: { module: string; sha256: string }[]; kernelCapabilities: Record<string, { backsExecution: string }> }
    const entry = manifest.families.find((f) => f.module === 'inspect.mjs')
    expect(entry).toBeDefined()
    expect(entry?.sha256).toBe(createHash('sha256').update(readFileSync(join(REPO, 'packages/tools/families/inspect.mjs'))).digest('hex'))
    expect(manifest.kernelCapabilities['inspect-read']?.backsExecution).toBe('family-body')
  })
})

describe('u7f-c1 skill row', () => {
  it('S1 positive load: the body runs AFTER the PA walk and answers the native-shaped value', async () => {
    const { cap, paCalls } = descriptorCap()
    const { row } = buildRows(cap)
    const value = await row('team_skill').execute({ name: 'demo-skill' }, {}) as Record<string, unknown>
    expect(value).toMatchObject({ name: 'demo-skill', provider: 'filesystem', content: 'Do the demo.' })
    expect(value.resourceBase).toEqual({ kind: 'directory', path: join(SKILL_ROOT, 'demo-skill') })
    expect(paCalls).toHaveLength(1)
    expect(paCalls[0]?.kinds).toContain('read')
    const render = (row('team_skill').output as { render: (a: unknown, v: unknown) => { text: string }[] }).render(null, value)
    expect(render[0]?.text).toContain('<skill_content name="demo-skill">')
    expect(render[0]?.text).toContain('Do the demo.')
  })
  it('S2 out-of-root spellings die at the GRAMMAR edge with zero PA walk', async () => {
    const { cap, paCalls } = descriptorCap()
    const { row } = buildRows(cap)
    for (const hostile of ['../etc/passwd', 'a/../../b', '..', 'SKILL.md', 'Demo', 'x'.repeat(200)]) {
      const text = await errorText(row('team_skill').execute({ name: hostile }, {}))
      expect(text).toContain('invalid-skill-name')
    }
    expect(paCalls).toHaveLength(0)
  })
  it('S3 symlink escape: the anchor law refuses; the outside target is never loaded', async () => {
    const { cap } = descriptorCap()
    const { row } = buildRows(cap)
    const text = await errorText(row('team_skill').execute({ name: 'link-skill' }, {}))
    expect(text).toContain('symlink-alias')
    expect(text).not.toContain('TOP-SECRET')
  })
  it('S4 unknown skill = typed refusal (no guess, no fallback)', async () => {
    const { cap } = descriptorCap()
    const { row } = buildRows(cap)
    const text = await errorText(row('team_skill').execute({ name: 'no-such-skill' }, {}))
    expect(text).toContain('skill-unknown')
  })
  it('S5 disable-model-invocation is the native law: refused for model loads', async () => {
    const { cap } = descriptorCap()
    const { row } = buildRows(cap)
    const text = await errorText(row('team_skill').execute({ name: 'quiet-skill' }, {}))
    expect(text).toContain('skill-not-model-invocable')
  })
  it('S6 mutation-shaped requests are refused at the schema edge (zero PA walk)', async () => {
    const { cap, paCalls } = descriptorCap()
    const { row } = buildRows(cap)
    const text = await errorText(row('team_skill').execute({ name: 'demo-skill', effects: ['write'], content: 'x' }, {}))
    expect(text).toContain('unexpected-parameter')
    expect(paCalls).toHaveLength(0)
  })
  it('S7 without sanctioned roots the skill row mounts SHUT: typed per-call refusal, zero read', async () => {
    const { cap, paCalls } = descriptorCap({ planeConfig: { inspectFamilyEnabled: true, skillRoots: undefined } })
    const { names, row } = buildRows(cap)
    expect(names.sort()).toEqual(['team_cordis_inspect_list', 'team_cordis_inspect_query', 'team_skill'])
    const text = await errorText(row('team_skill').execute({ name: 'demo-skill' }, {}))
    expect(text).toContain('skill-roots-unmounted')
    // the real skill file exists on disk — the shut face reads NOTHING:
    expect(paCalls).toHaveLength(0)
  })
  it('S8 PA deny / PA cancel at the edge answer typed refusal / cancelled with no read', async () => {
    const denied = descriptorCap({ gate: { kind: 'deny', code: 'POLICY_DENIED', detail: 'no' } })
    const t1 = await errorText(buildRows(denied.cap).row('team_skill').execute({ name: 'demo-skill' }, {}))
    expect(t1).toContain('POLICY_DENIED')
    const cancelled = descriptorCap({ gate: { kind: 'allow', cancelled: true } })
    expect(await buildRows(cancelled.cap).row('team_skill').execute({ name: 'demo-skill' }, {}))
      .toMatchObject({ cancelled: true })
  })
})

describe('u7f-c1 inspect rows', () => {
  it('I1 list: parameters {} → tool-invoke + meta arms; body = the registry listing', async () => {
    const { face } = fakeInspectFace()
    const { cap, paCalls } = descriptorCap({ injected: { inspect: face } })
    const { row } = buildRows(cap)
    const value = await row('team_cordis_inspect_list').execute({}, {}) as { providers: unknown[] }
    expect(value.providers).toHaveLength(2)
    expect(paCalls).toHaveLength(1)
    expect(paCalls[0]?.kinds.sort()).toEqual(['meta', 'tool-invoke'])
  })
  it('I2 query positive: closed parameters, meta arms, native-shaped result', async () => {
    const { face, calls } = fakeInspectFace()
    const { cap } = descriptorCap({ injected: { inspect: face } })
    const { row } = buildRows(cap)
    const value = await row('team_cordis_inspect_query').execute({ platform: 'host', provider: 'p.one', method: 'echo', input: { x: 'y' } }, { agent: {} }) as Record<string, unknown>
    expect(value).toEqual({ platform: 'host', provider: 'p.one', method: 'echo', data: { echo: { x: 'y' } } })
    expect(calls.query).toBe(1)
  })
  it('I3 unknown provider/method: typed refusal LISTING what is available, ZERO dispatch', async () => {
    const { face, calls } = fakeInspectFace()
    const { cap } = descriptorCap({ injected: { inspect: face } })
    const { row } = buildRows(cap)
    const badProvider = await errorText(row('team_cordis_inspect_query').execute({ platform: 'host', provider: 'p.nope', method: 'echo' }, { agent: {} }))
    expect(badProvider).toContain('inspect-provider-unknown')
    expect(badProvider).toContain('p.one')
    const badMethod = await errorText(row('team_cordis_inspect_query').execute({ platform: 'host', provider: 'p.one', method: 'nope' }, { agent: {} }))
    expect(badMethod).toContain('inspect-method-unknown')
    expect(badMethod).toContain('echo')
    expect(calls.query).toBe(0)
  })
  it('I4 schema-invalid input: refused BEFORE dispatch (the declared schema decides, zero dispatch)', async () => {
    const { face, calls } = fakeInspectFace()
    const { cap } = descriptorCap({ injected: { inspect: face } })
    const { row } = buildRows(cap)
    const text = await errorText(row('team_cordis_inspect_query').execute({ platform: 'host', provider: 'p.one', method: 'echo', input: { x: 7 } }, { agent: {} }))
    expect(text).toContain('inspect-input-invalid')
    expect(text).toContain('input.x')
    expect(calls.query).toBe(0)
  })
  it('I5 timeout leg: typed refusal at the bound, and the LATE value is NEVER delivered', async () => {
    let releaseQuery: ((v: unknown) => void) | undefined
    const { face } = fakeInspectFace({ query: () => new Promise((resolve) => { releaseQuery = resolve }) })
    const { cap } = descriptorCap({ injected: { inspect: face } })
    void cap
    // the row's bound is the lane constant; drive the executor factory directly for timing.
    const { createGovernedInspectQueryExecutor } = await import(new URL('../../tools/inspect-family/src/inspect-executor.mjs', import.meta.url).href) as {
      createGovernedInspectQueryExecutor: (o: Record<string, unknown>) => (raw: Record<string, unknown>, corr: Record<string, unknown>) => Promise<Record<string, unknown>>
    }
    const executor = createGovernedInspectQueryExecutor({
      realmId: REALM, policy: { default: 'ask' }, decide: () => ({ kind: 'allow' }),
      pa: async () => ({ kind: 'allow' }), inspectFace: face, queryBudgetMs: 40, observe: () => {},
    })
    const outcome = await executor({ platform: 'host', provider: 'p.one', method: 'echo' }, { agent: {} })
    expect(outcome.kind).toBe('refused')
    expect(String(outcome.code)).toBe('inspect-query-timeout')
    // the late value lands AFTER the refusal — it must reach nothing.
    releaseQuery?.({ LATE: true })
    await new Promise((resolve) => setImmediate(resolve))
    expect(String(outcome.code)).toBe('inspect-query-timeout')
    expect(JSON.stringify(outcome)).not.toContain('LATE')
  })
  it('I6 cancel-during-pending: typed call-aborted refusal, downstream signal aborted, NO late delivery', async () => {
    let releaseQuery: ((v: unknown) => void) | undefined
    let downstream: AbortSignal | undefined
    const { face } = fakeInspectFace({
      query: (_p: string, _id: string, _m: string, _i: unknown, _a: unknown, signal: AbortSignal) => {
        downstream = signal
        return new Promise((resolve) => { releaseQuery = resolve })
      },
    })
    const { createGovernedInspectQueryExecutor } = await import(new URL('../../tools/inspect-family/src/inspect-executor.mjs', import.meta.url).href) as {
      createGovernedInspectQueryExecutor: (o: Record<string, unknown>) => (raw: Record<string, unknown>, corr: Record<string, unknown>) => Promise<Record<string, unknown>>
    }
    const executor = createGovernedInspectQueryExecutor({
      realmId: REALM, policy: { default: 'ask' }, decide: () => ({ kind: 'allow' }),
      pa: async () => ({ kind: 'allow' }), inspectFace: face, queryBudgetMs: 60_000, observe: () => {},
    })
    const controller = new AbortController()
    const pending = executor({ platform: 'host', provider: 'p.one', method: 'echo' }, { agent: {}, signal: controller.signal })
    await new Promise((resolve) => setImmediate(resolve))
    controller.abort()
    const outcome = await pending
    expect(outcome.kind).toBe('refused')
    expect(String(outcome.code)).toBe('call-aborted')
    expect(downstream?.aborted).toBe(true)
    releaseQuery?.({ LATE: true })
    await new Promise((resolve) => setImmediate(resolve))
    expect(JSON.stringify(outcome)).not.toContain('LATE')
  })
  it('I7 mutation-shaped query requests die at the schema edge (zero PA walk, zero dispatch)', async () => {
    const { face, calls } = fakeInspectFace()
    const { cap, paCalls } = descriptorCap({ injected: { inspect: face } })
    const { row } = buildRows(cap)
    const text = await errorText(row('team_cordis_inspect_query').execute({ platform: 'host', provider: 'p.one', method: 'echo', effects: ['write'], command: 'rm -rf /' }, { agent: {} }))
    expect(text).toContain('unexpected-parameter')
    expect(paCalls).toHaveLength(0)
    expect(calls.query).toBe(0)
  })
  it('I8 absent host seam = typed unmounted refusal, never a bypass or a fake', async () => {
    const { cap } = descriptorCap()
    const { row } = buildRows(cap)
    const t1 = await errorText(row('team_cordis_inspect_list').execute({}, {}))
    const t2 = await errorText(row('team_cordis_inspect_query').execute({ platform: 'host', provider: 'p.one', method: 'echo' }, { agent: {} }))
    expect(t1).toContain('inspect-service-unmounted')
    expect(t2).toContain('inspect-service-unmounted')
  })
  it('I9 read-only proof: EVERY PA request set this family can produce carries only {tool-invoke, read, meta}', async () => {
    const { face } = fakeInspectFace()
    const { cap, paCalls } = descriptorCap({ injected: { inspect: face } })
    const { row } = buildRows(cap)
    await row('team_skill').execute({ name: 'demo-skill' }, {})
    await row('team_cordis_inspect_list').execute({}, {})
    await row('team_cordis_inspect_query').execute({ platform: 'host', provider: 'p.one', method: 'echo' }, { agent: {} })
    expect(paCalls.length).toBeGreaterThan(2)
    for (const call of paCalls) {
      for (const kind of call.kinds) {
        expect(['tool-invoke', 'read', 'meta']).toContain(kind)
      }
      for (const effect of call.effects) {
        if (effect.kind === 'tool-invoke') expect(effect.resource).toBeNull()
        else expect(['absolute-path', 'metadata']).toContain(String((effect.resource as Record<string, unknown>).kind))
      }
    }
  })
  it('I10 placement-spelling law (C2 boot-3 measured): the tool-invoke arm carries the MOUNTED name', async () => {
    // The call-level facts entry resolves the call's placement through
    // paPlacementNameOf, whose seam arm accepts exactly the placement names
    // the seam placed (team-tool-plane.mjs :957-970, the U7-9a family-blind
    // law). Live boot-3 refused a native-class spelling verbatim:
    // `entry-cause=no-placement-name` → TOOL_BINDING_UNVERIFIED, zero
    // effect. The fs rows spell native classes ONLY because they mount at
    // native spellings; this family mounts at aliases, so an effect arm
    // spelling 'skill' / 'cordis_inspect_*' is a regression of a law
    // already paid for in live boots — it must turn RED here, not there.
    const { face } = fakeInspectFace()
    const { cap, paCalls } = descriptorCap({ injected: { inspect: face } })
    const { row } = buildRows(cap)
    const arms: Record<string, string> = {
      team_skill: 'team_skill',
      team_cordis_inspect_list: 'team_cordis_inspect_list',
      team_cordis_inspect_query: 'team_cordis_inspect_query',
    }
    for (const [rowName, mounted] of Object.entries(arms)) {
      paCalls.length = 0
      await row(rowName).execute(rowName === 'team_skill' ? { name: 'demo-skill' } : rowName === 'team_cordis_inspect_query' ? { platform: 'host', provider: 'p.one', method: 'echo' } : {}, { agent: {} })
      const invoke = paCalls.flatMap((c) => c.effects).find((e) => e.kind === 'tool-invoke')
      expect(invoke?.toolName, rowName).toBe(mounted)
    }
  })
})

describe('u7f-c1 mutation controls (planted bugs turn the vectors RED)', () => {
  const MUT_DIR = join(WORLD, 'mutants')
  // Mutants live OUTSIDE the source tree (tests/homes, gitignored); their
  // relative specifiers are rewired to ABSOLUTE repo/lane paths — same
  // bytes, same law, only the module addresses move.
  const rewire = (source: string) => source
    .replaceAll("'../../../domain/", `'${join(REPO, 'packages/domain')}/`)
    .replaceAll("'../../fs-family/", `'${join(REPO, 'packages/tools/fs-family')}/`)
    .replaceAll("'../../search-family/", `'${join(REPO, 'packages/tools/search-family')}/`)
    .replaceAll("'./skill-mechanics.mjs'", `'${LANE}/skill-mechanics.mjs'`)
    .replaceAll("'./inspect-mechanics.mjs'", `'${LANE}/inspect-mechanics.mjs'`)
    .replaceAll("'./row-names.mjs'", `'${LANE}/row-names.mjs'`)

  const importMutant = async (file: string, mutate: (source: string) => string) => {
    mkdirSync(MUT_DIR, { recursive: true })
    const source = readFileSync(join(LANE, file), 'utf8')
    const mutated = mutate(source)
    if (mutated === source) throw new Error(`planted mutation found no target in ${file}`)
    const target = join(MUT_DIR, `mut-${file}`)
    writeFileSync(target, rewire(mutated))
    return import(pathToFileURL(target).href) as Promise<Record<string, unknown>>
  }

  it('X1 dropping the root anchor makes the escape vectors RED (the planted "no anchor" bug)', async () => {
    // The planted bug is the exact one the law forbids: replacing the
    // anchored resolution with the raw lexical path. The mutant then reads
    // THROUGH the planted symlink to the outside file — the vectors that
    // the honest lane passes (typed symlink-alias refusal, zero outside
    // bytes) FAIL against this mutant, which is what makes them law pins.
    const mod = await importMutant('skill-executor.mjs', (s) => s
      .replaceAll('const resolved = resolveAnchoredPath(candidate.root, relative)', 'const resolved = { ok: true, path: candidate.locator, isFile: true }')
      .replaceAll('const stat = await lstat(resolved.path)', "const stat = await import('node:fs/promises').then((m) => m.stat(resolved.path))"))
    const executor = (mod.createGovernedSkillExecutor as (o: Record<string, unknown>) => (raw: Record<string, unknown>, corr: Record<string, unknown>) => Promise<Record<string, unknown>>)({
      realmId: REALM, skillRoots: [SKILL_ROOT], policy: { default: 'ask' },
      decide: () => ({ kind: 'allow' }), pa: async () => ({ kind: 'allow' }), observe: () => {},
    })
    const outcome = await executor({ name: 'link-skill' }, {})
    // The mutant LOADED the outside file (the bug): the vector's expectation
    // (typed symlink-alias refusal) FAILS against it — proven here.
    expect(outcome.kind).toBe('ok')
    expect(JSON.stringify(outcome)).toContain('TOP-SECRET')
  })
  it('X2 delivering the late result after timeout makes the timeout vector RED', async () => {
    const mod = await importMutant('inspect-executor.mjs', (s) => s
      .replaceAll("winner.timedOut === true) {", "winner.timedOut === true) {\n        const late = await queryPromise; if (late?.settled === true && late.ok === true) return { kind: 'ok', value: late.value };"))
    const executor = (mod.createGovernedInspectQueryExecutor as (o: Record<string, unknown>) => (raw: Record<string, unknown>, corr: Record<string, unknown>) => Promise<Record<string, unknown>>)({
      realmId: REALM, policy: { default: 'ask' }, decide: () => ({ kind: 'allow' }),
      pa: async () => ({ kind: 'allow' }), queryBudgetMs: 30, observe: () => {},
      inspectFace: {
        list: () => [{ platform: 'host', id: 'p.one', methods: [{ name: 'echo' }] }],
        query: () => new Promise((resolve) => { setTimeout(() => resolve({ LATE: true }), 80) }),
      },
    })
    const outcome = await executor({ platform: 'host', provider: 'p.one', method: 'echo' }, { agent: {} })
    // The mutant DELIVERS the late value (the bug): the no-late-delivery
    // vector's expectation (final timeout refusal) FAILS against it.
    expect(outcome.kind).toBe('ok')
    expect(JSON.stringify(outcome)).toContain('LATE')
  })
})
