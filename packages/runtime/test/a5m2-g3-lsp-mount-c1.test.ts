/**
 * A5M2-G3-LSP-MOUNT-C1 (center LSP mount leg; the B-TERMINAL plane-mount
 * discipline verbatim) — the spec of the B-LSP blocks THIS lane owns in
 * `agent-bindings.mjs` (capture arm, union guard + spread row, registration
 * ring, awaited realm drain) and in `team-tool-plane.mjs` (closed gate,
 * issued identity, placement, seat, teardown census). The plane is the REAL
 * `createTeamToolPlaneAssembly`; the placement is the REAL `mount()`; the
 * realm supply is the REAL `createA5LspRealmSupply` over the REAL
 * `createLspRealmAssembly` (shipped product — root 限施工裁决: reuse, not a
 * fork); the seat is the REAL plane-owned `paAdmit`; the registry is the
 * PRODUCTION `pa-mount-registry`.
 *
 * Legs:
 *  (a) ZERO FLIP BOTH DIRECTIONS: no `backends.lsp` = face OMITTED (not
 *      undefined), no 'lsp' placement; WITH the inject the face + the row
 *      land. Plus the bindings static audit (the 760364998 lost-row class):
 *      the guard NAMES a5LspInject, the spread row EXISTS terminal-adjacent,
 *      the capture block + registration ring + awaited drain are PAIRED.
 *  (b) the inject law: the typed LSP_ARM_INJECT_INVALID refusal TABLE
 *      (config is law, not wiring — every defect refuses the MOUNT);
 *  (c) REAL placement + lazy feed keys + PRODUCTION registry round-trip
 *      (placement identity, never the capture identity; the captured face
 *      verbatim, ONLY execute replaced);
 *  (d) REAL durable walk at FULL VALUE: the kernel mints through the
 *      disclosed seam, the family block rides the leg (realm/server/document
 *      facts from the REAL supply over REAL temp files), the served value is
 *      the captured body's OWN, and the token-replay single-flight refuses;
 *  (e) the REALM LIFECYCLE through the mount: a policyChange generation move
 *      makes the mount (still naming its armed realm) REFUSE every row
 *      P_LSP_REALM_SCOPE_ESCAPED with zero body — by construction;
 *  (f) teardown: mount dispose drains the WIRING (the row's own DRAINING
 *      bytes, zero port entry) and the supply's drainAll (the awaited
 *      close-chain half) settles the realm NET-ZERO (assembly size 0, the
 *      canned pids signaled).
 *
 * DISCLOSED STAND-INS (author side, 接线未测 — no Host, no boot, no ports):
 * the realm transport is the CANNED launcher fake (deps.spawnStream per the
 * a5lsp2-streaming precedent; the fake honors the provider's observed-death
 * settle law); the native 'lsp' definition is a recording double carrying the
 * pinned @639 parameter grammar (the four operations, one-based line/char);
 * the positive walk rides the kernel's OWN mint edge (issueApprovedGrant —
 * the same disclosed seam as the terminal mount spec's leg (e)); the
 * bindingFacts seam answers the PLANE'S OWN rev-0 row tuple (pairing law,
 * verbatim from the terminal spec's disclosure). The PLANE, its paAdmit, the
 * admission kernel, the placement feed, the registry, the supply and the
 * realm assembly are REAL production code. controlPort is NOT mounted on
 * this route (absent = the adapter's faithful captured-body delegate).
 *
 * @module @dsh-agent-team/runtime/test/a5m2-g3-lsp-mount-c1
 */
import { describe, expect, it } from 'vitest'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Readable, Writable } from 'node:stream'

import { definitionIdentityOf } from '../tool-dispatch/index.js'
import { createLspRealmAssembly } from '../sandbox-provider/lsp-assembly.js'

const PLANE_ROW = (await import(new URL('../src/plugin/live/team-tool-plane.mjs', import.meta.url).href)) as {
  createTeamToolPlaneAssembly: (input: Record<string, unknown>) => Built
}
const REGISTRY = (await import(new URL('../src/plugin/live/pa-mount-registry.mjs', import.meta.url).href)) as {
  registerA5GovernedFamily: (key: string, entry: Record<string, unknown>) => void
  a5GovernedFamilyFor: (key: string) => Record<string, unknown> | undefined
}
const SUPPLY = (await import(new URL('../src/plugin/live/governed-families/lsp-realm-supply.mjs', import.meta.url).href)) as {
  createA5LspRealmSupply: (input: Record<string, unknown>) => Supply
  a5LspRealmId: (memberId: string, generation: string) => string
}
const BINDINGS_SRC = await import('node:fs').then((fs) => fs.readFileSync(
  new URL('../src/plugin/live/agent-bindings.mjs', import.meta.url), 'utf8')) as string
const PLANE_SRC = await import('node:fs').then((fs) => fs.readFileSync(
  new URL('../src/plugin/live/team-tool-plane.mjs', import.meta.url), 'utf8')) as string

interface Supply {
  facts: Record<string, unknown>
  realmIdOf: (generation: string) => string
  syncGeneration: (generation: string) => Promise<{ ok: boolean, status: string }>
  drainAll: () => Promise<{ ok: boolean }>
}
interface Definition {
  name: string
  description: string
  parameters: unknown
  output: unknown
  execute: (args: Record<string, unknown>, exec: Record<string, unknown>) => Promise<unknown>
}
interface PlaneValue {
  definitions: Definition[]
  placementNames: readonly string[]
  lsp?: {
    familyId: string
    placementNames: readonly string[]
    declared: ReadonlyArray<{ name: string, status: string, reason: string }>
    familyRegistrations: () => Array<{ name: string, definitionIdentity: string, entry: Record<string, unknown> }>
    syncGeneration: (generation: string) => Promise<{ ok: boolean, status: string }>
    drainAll: () => Promise<{ ok: boolean }>
  }
  mount: (agentCtx: unknown) => { ok: boolean, code?: string, dispose?: () => void }
}
type Built = { ok: true, value: PlaneValue } | { ok: false, code: string, message: string }

const REALM = 'lsp-plane-realm'
const PROVIDER = 'g3-lsp-plane-provider'
const TEMPLATE = 'lsp-tpl'
const MEMBER = 'agent-member-1'
const HEADER = 's-header-1'
const GENERATION = 'g1'

const root = mkdtempSync(join(tmpdir(), 'dsh-lsp-mount-'))
const WS = join(root, 'ws')
mkdirSync(join(WS, 'src'), { recursive: true })
writeFileSync(join(WS, 'src', 'a.ts'), 'export const a = 1\n', 'utf8')
mkdirSync(join(root, 'scratch'), { recursive: true })
const AGENT = Object.freeze({ id: MEMBER, session: Object.freeze({ header: Object.freeze({ id: HEADER, cwd: WS }) }) })

// ---------------------------------------------------------------------------
// CANNED transport (the a5lsp2-streaming / supply-spec precedent)
// ---------------------------------------------------------------------------
let pidSeq = 43000
function fakeProcess (payloadPid: number) {
  const handshake = new Readable({ read() {} })
  handshake.push(Buffer.from(JSON.stringify({ stream: true, pid: payloadPid }) + '\n', 'utf8'))
  handshake.push(null)
  let resolveExit: (v: { code: number | null, signal: string | null }) => void = () => {}
  const exit = new Promise<{ code: number | null, signal: string | null }>((r) => { resolveExit = r })
  const proc = {
    pid: payloadPid - 1,
    stdin: new Writable({ write(_c, _e, cb) { cb() } }),
    stdout: new Readable({ read() {} }),
    stderr: Readable.from((async function* () { /* canned */ })()),
    handshake,
    signals: [] as string[],
    dead: false,
    kill(signal?: string | number): boolean {
      const s = String(signal ?? 'SIGTERM')
      if (!proc.signals.includes(s)) proc.signals.push(s)
      if (!proc.dead) {
        proc.dead = true
        resolveExit({ code: null, signal: s })
      }
      return true
    },
    exit,
  }
  return proc
}
function fakeDepsOf (spawned: Array<ReturnType<typeof fakeProcess>>) {
  const byPid = new Map<number, ReturnType<typeof fakeProcess>>()
  return {
    availability: () => ({ rows: [{ subject: 'python3', present: true, note: 'canned transport: fake injected' }] }),
    run: () => ({ rc: 0, stdout: '', stderr: '' }),
    probeFacts: () => ({
      abiVersion: 4,
      legs: {
        selective: { leg: 'selective', verdict: 'ENFORCE-CONFIRMED', rc: 0, checks: [] },
        denyall: { leg: 'denyall', verdict: 'ENFORCE-CONFIRMED', rc: 0, checks: [] },
        badhandled: { leg: 'badhandled', verdict: 'DEMO-CONFIRMED', rc: 0, checks: [] },
      },
    }),
    spawnStream: () => {
      const proc = fakeProcess(++pidSeq)
      spawned.push(proc)
      byPid.set(proc.pid + 1, proc)
      return { ok: true, value: proc }
    },
    signalProcess: (pid: number, signal: 'SIGTERM' | 'SIGKILL') => {
      const proc = byPid.get(pid)
      if (proc === undefined) return false
      proc.kill(signal)
      return true
    },
    pidAlive: (pid: number) => {
      const proc = byPid.get(pid)
      return proc !== undefined && !proc.dead
    },
  }
}

const POLICY = {
  generation: GENERATION,
  bindingId: 'lsp-pol-bind-1',
  grantFingerprint: 'lsp-pol-grant-1',
  argv: ['/srv/fake-langserver', '--stdio'],
  cwd: WS,
}

/** The supply world, built the way the BINDINGS capture arm builds it (the
 *  real assembly + the real supply over the ONE issued policy), with the
 *  canned transport injected (author side). */
function makeSupplyWorld () {
  const spawned: Array<ReturnType<typeof fakeProcess>> = []
  // the author-side deployment map carries the ONE armed generation PLUS one
  // moved generation, so leg (e) can drive the REAL R-2 destroy/rebuild
  // through the supply's own policyChange discipline (the production capture
  // arm publishes ONE; the mount-named realm refuses EITHER WAY — the moved
  // answer is what leg (e) pins).
  const gens: Record<string, { grant: string, bind: string }> = {
    [GENERATION]: { grant: POLICY.grantFingerprint, bind: POLICY.bindingId },
    'g2-moved': { grant: 'lsp-pol-grant-2', bind: 'lsp-pol-bind-2' },
  }
  const assembly = createLspRealmAssembly({
    assembly: { minAbiVersion: 3 },
    trustRoot: null,
    scratchRoot: join(root, 'scratch'),
    policyFor: (memberId: string, generation: string) => {
      const g = gens[generation]
      if (memberId !== MEMBER || g === undefined) {
        throw new Error(`the mounted deployment carries NO policy for ('${memberId}','${generation}')`)
      }
      return { grantFingerprint: g.grant, bindingId: g.bind, argv: POLICY.argv, cwd: POLICY.cwd, env: [] }
    },
    deps: fakeDepsOf(spawned) as never,
    ready: async () => true,
    terminateGraceMs: 50,
    terminateDeadlineMs: 1_000,
  })
  const supply = SUPPLY.createA5LspRealmSupply({
    assembly,
    memberId: MEMBER,
    serverIdentityOf: (_m: string, g: string) => (gens[g] !== undefined ? POLICY.argv[0] : null),
  }) as Supply & { ok: boolean }
  return { supply, assembly, spawned }
}

const PARAMS = {
  type: 'object',
  properties: {
    operation: { type: 'string', enum: ['goToDefinition', 'findReferences', 'goToImplementation', 'hover'] },
    file_path: { type: 'string' },
    line: { type: 'number' },
    character: { type: 'number' },
  },
  required: ['operation', 'file_path', 'line', 'character'],
  additionalProperties: false,
}

function makeInject (supply: Supply) {
  const native: Definition = {
    name: 'lsp',
    description: 'native lsp production description',
    parameters: PARAMS,
    execute: async (args: Record<string, unknown>) => {
      await new Promise((r) => setTimeout(r, 0)) // await a tick (the real body is async)
      return { served: String(args.operation ?? '?') }
    },
    output: { schema: { type: 'object' }, render: (v: unknown) => JSON.stringify(v) },
  }
  return Object.freeze({
    providerId: PROVIDER,
    memberAgentId: MEMBER,
    sessionHeaderId: HEADER,
    realmId: supply.realmIdOf(GENERATION),
    readNative: (name: string) => (name === 'lsp' ? native : undefined),
    bindingFacts: (toolName: string) => ({
      // THE PLANE'S OWN rev-0 row tuple (the terminal spec's pairing law
      // verbatim): a production dispatcher tuple would MIS-PAIR the minted
      // grant here; pairing honestly, not staging.
      bindingId: `plane-row:${TEMPLATE}:${toolName}`,
      bindingRevision: 1,
      policyGeneration: 0,
      authorityGeneration: 0,
    }),
    lspFacts: supply.facts,
    lifecycle: Object.freeze({
      syncGeneration: (g: string) => supply.syncGeneration(g),
      drainAll: () => supply.drainAll(),
    }),
  })
}

function buildPlane (extra: Record<string, unknown> = {}): Built {
  return PLANE_ROW.createTeamToolPlaneAssembly({
    teamSessionId: 'lsp-plane-team',
    permissionPolicy: Object.freeze({ default: 'ask', allow: [], ask: [], deny: [] }),
    realmId: REALM,
    templateId: TEMPLATE,
    role: 'member',
    instanceId: 'lsp-instance',
    onObserve: () => {},
    ...extra,
  }) as Built
}

/** The control-leg SEAM double (the terminal spec's disclosed seam verbatim):
 *  the kernel's OWN landing (issueApprovedGrant) driven with an approval
 *  composed from the kernel's own plan facts. */
function mintingControlLeg (seen: Array<Record<string, unknown>>) {
  return async (input: { request: unknown, family?: Record<string, unknown>, plan: Record<string, unknown>, assembly: { issueApprovedGrant: (r: unknown, a: unknown) => Promise<{ ok: boolean, value?: unknown }> } }) => {
    seen.push({ family: input.family ?? null })
    const plan = input.plan as { approvalCaseId: string, effectSetFingerprint: string }
    const approval = Object.freeze({
      approvalCaseId: plan.approvalCaseId,
      reviewerAuthority: 'human-user',
      beneficiaryAuthority: 'leader',
      requiredAuthorityAtCreation: 'leader',
      effectSetFingerprint: plan.effectSetFingerprint,
      authorityGenerationAtCreation: 0,
    })
    const issued = await input.assembly.issueApprovedGrant(input.request, approval)
    if (issued.ok !== true || issued.value === undefined) return { decision: 'deny', detail: 'the kernel refused the mint' }
    return { decision: 'approve', requestId: 'lsp-spec-control-row-1', approval, grant: issued.value, manifest: null }
  }
}

const fakeAgentCtx = (registered: string[]) => ({
  tools: {
    register: (def: Definition) => { registered.push(def.name); return () => { /* disposer */ } },
  },
})

const refusalOf = async (promise: Promise<unknown>): Promise<{ code: string, message: string }> => {
  try {
    await promise
    throw new Error('expected a refusal, got a resolve')
  } catch (error) {
    const e = error as { code?: string, message?: string }
    return { code: String(e.code ?? ''), message: String(e.message ?? '') }
  }
}

describe('A5M2-G3-LSP-MOUNT-C1 — the B-LSP mount: zero flip, typed gate, placement, full-value walk, realm lifecycle, net-zero drain', () => {
  it('(a) ZERO FLIP both ways + the bindings static audit (lost-row class)', () => {
    const bare = buildPlane()
    expect(bare.ok).toBe(true)
    if (bare.ok !== true) return
    expect('lsp' in bare.value, 'the face is OMITTED, not set to undefined').toBe(false)
    expect(bare.value.definitions.some((d) => d.name === 'lsp')).toBe(false)
    // WITH the inject the row + face land (the other direction of the flip)
    const w = makeSupplyWorld()
    const armed = buildPlane({ backends: { lsp: makeInject(w.supply) } })
    expect(armed.ok).toBe(true)
    if (armed.ok !== true) return
    expect(armed.value.lsp?.familyId).toBe('B-LSP')
    expect([...(armed.value.lsp?.placementNames ?? [])]).toEqual(['lsp'])
    // the takeover ledger carries the row (the ledger is module-internal —
    // pinned through the source, the same law the union audit rides)
    expect(PLANE_SRC).toContain("lsp: Object.freeze(['lsp']),")
    // THE BINDINGS AUDIT (the 760364998 lost-row class): guard names the
    // inject; the spread row EXISTS; the capture block, the registration
    // ring and the awaited realm drain are all PRESENT and PAIRED.
    const guardLine = BINDINGS_SRC.split('\n').find((line) => line.includes('a5JobsBridge === null &&') && line.includes('? {} : { backends:'))
    expect(guardLine, 'the shared backends union guard exists').toBeDefined()
    expect(guardLine).toContain('a5LspInject === null')
    expect(BINDINGS_SRC).toContain('...(a5LspInject === null ? {} : { lsp: a5LspInject }),')
    expect(BINDINGS_SRC).toContain("const lspCfg = planeCfg.lsp")
    expect(BINDINGS_SRC).toContain("error.code = 'alpha5-g3-lsp-mount-refused'")
    expect(BINDINGS_SRC).toContain('const lspPlane = a5PlaneValue?.lsp')
    expect(BINDINGS_SRC).toContain('lspRegistrations = lspPlane.familyRegistrations()')
    expect(BINDINGS_SRC).toContain('a5LspInject.lifecycle.drainAll()')
    // the REAL modules are imported (root ruling: reuse, never fork)
    expect(BINDINGS_SRC).toContain("from '../../../sandbox-provider/lsp-assembly.js'")
    expect(BINDINGS_SRC).toContain("from './governed-families/lsp-realm-supply.mjs'")
    // the plane consumed the published face ONLY (no supply/assembly import)
    expect(PLANE_SRC).not.toContain('lsp-realm-supply.mjs')
    expect(PLANE_SRC).not.toContain('sandbox-provider/lsp-assembly.js')
    expect(PLANE_SRC).toContain("import { buildG3LspWiring, A5_G3_LSP_TOOL_NAME } from './governed-families/g3-lsp-wiring.mjs'")
  })

  it('(b) the inject law: every defect refuses the MOUNT with the typed code', () => {
    const w = makeSupplyWorld()
    const base = makeInject(w.supply) as unknown as Record<string, unknown>
    const defects: Array<[string, Record<string, unknown>]> = [
      ['not a record', Object.freeze([]) as never],
      ['unknown key', { ...base, extraPose: 1 }],
      ['missing lifecycle', (() => { const { lifecycle: _drop, ...rest } = base; return rest })()],
      ['fact face missing documentScope', { ...base, lspFacts: Object.freeze({ server: () => null, document: () => null, documentRealm: () => null }) }],
      ['realmId empty', { ...base, realmId: '' }],
      ['providerId empty', { ...base, providerId: '' }],
      ['readNative not a function', { ...base, readNative: 'pose' }],
      ['lifecycle missing drainAll', { ...base, lifecycle: Object.freeze({ syncGeneration: async () => ({}) }) }],
    ]
    for (const [why, inject] of defects) {
      const built = buildPlane({ backends: { lsp: inject } })
      expect(built.ok === false && built.code, `${why} must refuse the mount`).toBe('LSP_ARM_INJECT_INVALID')
    }
  })

  it('(c) REAL placement + lazy feed keys + PRODUCTION registry round-trip (placement identity, never capture identity)', () => {
    const w = makeSupplyWorld()
    const built = buildPlane({ backends: { lsp: makeInject(w.supply) } })
    expect(built.ok).toBe(true)
    if (built.ok !== true) return
    const registered: string[] = []
    const placed = built.value.mount(fakeAgentCtx(registered))
    expect(placed.ok).toBe(true)
    expect(registered).toContain('lsp')
    const regs = built.value.lsp!.familyRegistrations()
    expect(regs.map((r) => r.name)).toEqual(['lsp'])
    const reg = regs[0]
    const placedDef = built.value.definitions.find((d) => d.name === 'lsp') as Definition
    expect(reg.definitionIdentity).toBe(definitionIdentityOf(placedDef))
    expect(a5GovernedFamilyForCheck(reg.definitionIdentity), 'unregistered until the writer pairs it').toBeUndefined()
    // the SAME captured face the bridge spread — only execute differs
    expect(placedDef.parameters).toBe(PARAMS)
    expect(placedDef.description).toBe('native lsp production description')
    REGISTRY.registerA5GovernedFamily(reg.definitionIdentity, reg.entry as never)
    expect(REGISTRY.a5GovernedFamilyFor(reg.definitionIdentity)).toMatchObject({ familyId: 'B-LSP', providerIdentity: PROVIDER })
  })

  it('(d) durable walk at FULL VALUE through the REAL seat; token replay single-flights; zero body on the replay', async () => {
    const w = makeSupplyWorld()
    const seen: Array<Record<string, unknown>> = []
    const built = buildPlane({ backends: { lsp: makeInject(w.supply) }, controlLeg: mintingControlLeg(seen) })
    expect(built.ok).toBe(true)
    if (built.ok !== true) return
    built.value.mount(fakeAgentCtx([]))
    // the realm must be LIVE for the server fact (the LAZY assembly law):
    const ensured = await w.supply.syncGeneration(GENERATION)
    expect(ensured.ok).toBe(true)
    const def = built.value.definitions.find((d) => d.name === 'lsp') as Definition
    const token = { k: 'lsp-one-execution' }
    const served = await def.execute({ operation: 'hover', file_path: 'src/a.ts', line: 7, character: 3 }, { token, agent: AGENT })
    expect(served, 'the captured body answers VERBATIM').toEqual({ served: 'hover' })
    expect(seen.length).toBe(1)
    const family = seen[0]!.family as Record<string, unknown>
    expect(family.familyId).toBe('B-LSP')
    expect(family.providerIdentity).toBe(PROVIDER)
    const manifest = family.targetManifest as Record<string, unknown>
    // THE DURABLE FULL VALUE (载荷法): the walk carries the B-LSP TYPED-PLAN
    // FLAT — every §5.2 fact at full value, from the REAL supply over REAL
    // files (this is exactly what the durable row cross-checks).
    expect(manifest).toMatchObject({
      operation: 'hover',
      realmId: SUPPLY.a5LspRealmId(MEMBER, GENERATION),
      agentId: MEMBER,
      sessionHeaderId: HEADER,
      docKind: 'workspace',
      canonicalLocator: 'src/a.ts',
      serverBinaryIdentity: POLICY.argv[0],
      serverGeneration: GENERATION,
      workspaceCwd: WS,
      oneBasedLine: 7,
      oneBasedCharacter: 3,
    })
    expect(String(manifest.documentRevisionJson), 'the stat revision rode the durable value (full-value encoding)').toMatch(/^"stat:v1:\d+:\d+"$/)
    expect(manifest.paramFingerprint).toBeTypeOf('string')
    // the replay of the SAME execution token single-flights (zero additional mints)
    const replay = await refusalOf(def.execute({ operation: 'hover', file_path: 'src/a.ts', line: 7, character: 3 }, { token, agent: AGENT }))
    expect(replay.code).toBe('P_LSP_WIRE_CALL_ID_ABSENT')
    expect(seen.length, 'the replay never reached the mint').toBe(1)
    await w.supply.drainAll()
  })

  it('(e) realm lifecycle through the mount: a generation move makes every row REFUSE (SCOPE_ESCAPED), zero body', async () => {
    const w = makeSupplyWorld()
    const seen: Array<Record<string, unknown>> = []
    const built = buildPlane({ backends: { lsp: makeInject(w.supply) }, controlLeg: mintingControlLeg(seen) })
    expect(built.ok).toBe(true)
    if (built.ok !== true) return
    built.value.mount(fakeAgentCtx([]))
    expect((await w.supply.syncGeneration(GENERATION)).ok).toBe(true)
    const def = built.value.definitions.find((d) => d.name === 'lsp') as Definition
    const served = await def.execute({ operation: 'goToDefinition', file_path: 'src/a.ts', line: 1, character: 1 }, { token: { k: 'lsp-before-move' }, agent: AGENT })
    expect(served).toEqual({ served: 'goToDefinition' })
    // THE GENERATION MOVE UNDER THE MOUNT (the R-2 destroy/rebuild through
    // the supply's own discipline): the mount still NAMES the realm it
    // armed; the §5.2 documentRealm obligation now reads a DIFFERENT realm
    // -> every row refuses BEFORE the body. (The deployment's policy map
    // carries one generation, so the move goes through the assembly face
    // the supply drives: policyChange to a new generation.)
    const moved = await w.supply.syncGeneration('g2-moved')
    expect(moved.ok, 'the policyChange round is the mount lifecycle (canned realm rebuild)').toBe(true)
    const refusal = await refusalOf(def.execute({ operation: 'hover', file_path: 'src/a.ts', line: 1, character: 1 }, { token: { k: 'lsp-after-move' }, agent: AGENT }))
    expect(refusal.code).toBe('P_LSP_REALM_SCOPE_ESCAPED')
    expect(seen.length, 'the moved realm never reached the seat, zero body').toBe(1)
    await w.supply.drainAll()
  })

  it('(f) teardown: mount dispose drains the WIRING (DRAINING bytes); the awaited drainAll settles the realm NET-ZERO', async () => {
    const w = makeSupplyWorld()
    const built = buildPlane({ backends: { lsp: makeInject(w.supply) } })
    expect(built.ok).toBe(true)
    if (built.ok !== true) return
    const placed = built.value.mount(fakeAgentCtx([]))
    expect((await w.supply.syncGeneration(GENERATION)).ok).toBe(true)
    const def = built.value.definitions.find((d) => d.name === 'lsp') as Definition
    const before = await def.execute({ operation: 'hover', file_path: 'src/a.ts', line: 1, character: 1 }, { token: { k: 'lsp-before-dispose' }, agent: AGENT }).catch((e: Error) => e)
    // pre-dispose the row reaches the SEAT (POLICY_ASK: the refusal is the
    // SEAT's own bytes, proving the row was live)
    expect(String((before as Error).message)).toContain('APPROVAL_REQUEST_UNAVAILABLE')
    placed.dispose?.()
    const refusal = await refusalOf(def.execute({ operation: 'hover', file_path: 'src/a.ts', line: 1, character: 1 }, { token: { k: 'lsp-post-dispose' }, agent: AGENT }))
    expect(refusal.message, 'the row\'s own drain law, carried verbatim').toContain('P_LSP_DRAINING')
    // the awaited close-chain half (the bindings disposer law, mirrored):
    const word = await built.value.lsp!.drainAll()
    expect(word.ok).toBe(true)
    expect((w.assembly as unknown as { size: () => number }).size(), 'net-zero: no realm outlives the mount').toBe(0)
    expect(w.spawned.length, 'every canned realm was signaled').toBeGreaterThan(0)
    for (const proc of w.spawned) expect(proc.dead, 'no live pid behind the mount').toBe(true)
    rmSync(root, { recursive: true, force: true })
  })
})

function a5GovernedFamilyForCheck (key: string): Record<string, unknown> | undefined {
  return REGISTRY.a5GovernedFamilyFor(key)
}
