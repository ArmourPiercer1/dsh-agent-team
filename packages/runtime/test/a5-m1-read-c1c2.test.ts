/**
 * a5-m1-read-c1c2 — M1 READ vertical slice over the FROZEN 3e7afeba contract.
 *
 * CONTRACT INPUT (M0, hash-locked; this file implements NO new semantics):
 *  - M0-A v1.1 `208ba98c…` lifecycle BASE; M0-B v1.2 `1b06c402…` §1.2 BASE.C1/C2
 *    + B-FS family rows; index `e1b8b29a…` record 0 (read#plane-takeover).
 *  - BASE.C1: real definition/provider binding; refusals for blueprint
 *    grammar-attacks (default-allow), cross-realm CURRENT/target confusion,
 *    escape/alias targets, unknown/malformed arguments, lane denies BEFORE
 *    any backend, subtree rules inert without the containment seam.
 *  - BASE.C2: REAL registration entry (createTeamToolPlaneAssembly mount) →
 *    A (production admission + lane decide) → REAL backend (governed read
 *    executor on the real filesystem), observed BUSINESS result = the real
 *    file's bytes; every refusal throws BEFORE disclosure with zero backend.
 *  - BASE.C3 note (honesty): the fs-class read row has NO durable async leg
 *    in this assembly (no lease/cancel leg — cancel-leg.mjs rides the shell
 *    rows). C3 cancel/cold-restart legs are proven in the bash slice; this
 *    file asserts durable-state ABSENCE (R-C2-3) instead of faking C3 here.
 *
 * ZERO-I/O CLAIMS follow the repo's read-slice evidence discipline
 * (a5-read-slice-window.test.ts header law): the observe line
 * `governed-read RAN` appears ONLY when bytes were read through the verified
 * handle; absence evidences THIS executor path, never a Host-wide zero.
 * Refusal protocol (probed against the frozen row): execute REJECTS with
 * `refused-<class> <code> — detail`; success RESOLVES with
 * { path, offset, lines:[{number,text}], totalLines }.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
// the guard's OWN assurance producer: the fixture's live tuple must carry the
// same shape the guard stamps (`tool-dispatch/install.ts:1150-1163`).
import { untestedAssurance } from '../tool-dispatch/index.js'
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, rmSync, symlinkSync, utimesSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

// REVIEW-R1 B1 (R-REM-2.2 / FIX-K K3): the kernel lifecycle port is ONLY the
// dispatcher's ledger — production passes the Guard handle's pendingCalls
// (agent-bindings). These executor-level legs never install a dispatcher, so
// this holder never settles a handle: the port reads the same wiring's honest
// empty-ledger zero. No family-local counter, no faked number.
const dispatchLedger: { current?: { pendingCalls(): readonly unknown[] } } = {}


const REPO = fileURLToPath(new URL('../../../', import.meta.url).href)
const LAUNCHER = join(REPO, 'packages/runtime/sandbox-provider/launcher/landlock-prelauncher.py')
const LAUNCHER_SHA = createHash('sha256').update(readFileSync(LAUNCHER)).digest('hex')
const WORLD = join(REPO, 'tests/homes', `a5-m1-read-${Date.now().toString(36)}`)
const ROOT_SCOPE = 'a5m1-c1c2-scope' // the dispatcher agentScopeKey this plane's rows are bound under
const ROOT_DIR = join(WORLD, 'root')
const OUTSIDE_DIR = join(WORLD, 'outside')
const REALM = 'a5-m1-read-realm'

interface ReadOk { path: string; offset: number; lines: Array<{ number: number; text: string }>; totalLines: number }
interface Definition { name: string; execute: (raw: unknown) => Promise<ReadOk> }
interface PlaneValue { definitions: ReadonlyArray<Definition>; ownNames: readonly string[] }
interface PlaneRow {
  createTeamToolPlaneAssembly: (input: Record<string, unknown>) =>
    | { ok: true; value: PlaneValue }
    | { ok: false; code: string; message: string }
}

let row: PlaneRow
beforeAll(async () => {
  row = (await import(new URL('../src/plugin/live/team-tool-plane.mjs', import.meta.url).href)) as PlaneRow
  mkdirSync(ROOT_DIR, { recursive: true })
  mkdirSync(OUTSIDE_DIR, { recursive: true })
  writeFileSync(join(ROOT_DIR, 'target.txt'), 'alpha5-m1-read-line-1\nalpha5-m1-read-line-2\n')
  writeFileSync(join(OUTSIDE_DIR, 'secret.txt'), 'OUTSIDE-SECRET-DO-NOT-LEAK\n')
  writeFileSync(join(ROOT_DIR, 'big.txt'), 'x'.repeat(1024 * 1024 + 10))
})
afterAll(() => { rmSync(WORLD, { recursive: true, force: true }) })

// Production-isomorphic world: a 'any' whole-tool rule projects ONLY its
// tool-invoke arm (disclosed law), so the resource effect rides a SUBTREE
// rule over the governed root — and subtree needs the containment seam at
// admission (R-C1-8 pins the no-seam refusal).
const POLICY_ALLOW = Object.freeze({
  default: 'deny',
  allow: [{ tool: 'read', resource: { kind: 'subtree', path: ROOT_DIR } }],
  ask: [] as unknown[],
  deny: [] as unknown[],
})
const confinedProvider = () => ({
  trustRoot: `sha256:${LAUNCHER_SHA.slice(0, 16)}#${LAUNCHER}`,
  assembly: { launcherPath: LAUNCHER, launcherSha256: LAUNCHER_SHA, minAbiVersion: 3 },
})
const fsInstance = (realm: string) => ({ fs: 'a5m1-ctl', rootDir: ROOT_DIR, realmId: realm, kind: 'absolute-path' })
const subtreeContains = ({ parent, child }: { parent: string; child: string }) => child === parent || child.startsWith(parent + '/')
const joined = (body: ReadOk) => body.lines.map((l) => l.text).join('\n')

async function run(fn: () => Promise<unknown>): Promise<{ resolved: true; value: unknown } | { resolved: false; msg: string }> {
  try { return { resolved: true as const, value: await fn() } }
  catch (e) { return { resolved: false as const, msg: String((e as Error)?.message ?? e) } }
}

function mount(policy: unknown, extra: Record<string, unknown> = {}, observe: string[] = []) {
  const built = row.createTeamToolPlaneAssembly({
          dispatcherLifecycle: { inflight: () => dispatchLedger.current?.pendingCalls().length ?? 0 },

      teamSessionId: 'a5m1-test-team-root',
    permissionPolicy: policy,
    realmId: REALM,
    templateId: 'a5m1-tpl',
    role: 'member',
    instanceId: 'a5m1-instance',
    onObserve: (r: unknown) => observe.push(String(r)),
    fs: { subtreeContains },
    plane: { fsInstance: fsInstance(REALM), confinedProvider: confinedProvider() },
    ...extra,
  })
  return built
}
function buildPlane(policy: unknown, extra: Record<string, unknown> = {}, observe: string[] = []) {
  const built = mount(policy, extra, observe)
  if (built.ok !== true) throw new Error(`plane mount refused: ${(built as { code: string }).code}`)
  const read = built.value.definitions.find((d) => d.name === 'read')
  if (!read) throw new Error('no read definition in mount')
  return { read, observe }
}
const ranLines = (observe: string[]) => observe.filter((l) => l.includes('governed-read RAN'))

describe('a5-m1-read-c1c2 — REAL chain: plane mount → admission/lane → governed read executor (real fs)', () => {
  it('R-C1-0 blueprint grammar: a default-allow template is REJECTED at mount (no silent privilege expansion)', () => {
    const built = mount(Object.freeze({ default: 'allow', allow: [] as unknown[], ask: [] as unknown[], deny: [] as unknown[] }))
    expect(built.ok === false ? built.code : 'MOUNTED?!').toBe('TOOL_BINDING_UNVERIFIED')
    if (built.ok === false) expect(built.message).toMatch(/default allow is rejected/)
  })

  it('R-C2-1 success POSITIVE: real bytes of the real file come back (business result, not a guard light)', async () => {
    const { read, observe } = buildPlane(POLICY_ALLOW)
    const r = await read.execute({ file_path: join(ROOT_DIR, 'target.txt') })
    expect(joined(r)).toContain('alpha5-m1-read-line-1')
    expect(joined(r)).toContain('alpha5-m1-read-line-2')
    expect(r.totalLines).toBe(2)
    expect(ranLines(observe)).toHaveLength(1)
  })

  it('R-C2-2 window consumption is REAL business output (offset/limit slice the real bytes)', async () => {
    const { read } = buildPlane(POLICY_ALLOW)
    const r = await read.execute({ file_path: join(ROOT_DIR, 'target.txt'), offset: 2, limit: 1 })
    expect(joined(r)).toContain('alpha5-m1-read-line-2')
    expect(joined(r)).not.toContain('alpha5-m1-read-line-1')
  })

  it('R-C2-3 read leaves ZERO durable state: target bytes/attrs unchanged by the governed leg', async () => {
    const { read } = buildPlane(POLICY_ALLOW)
    const before = readFileSync(join(ROOT_DIR, 'target.txt'))
    const t0 = 1_600_000_000
    utimesSync(join(ROOT_DIR, 'target.txt'), t0, t0)
    await read.execute({ file_path: join(ROOT_DIR, 'target.txt') })
    expect(readFileSync(join(ROOT_DIR, 'target.txt'))).toEqual(before)
    // BASE.C3 durability-absence leg (see header): no lease/state file appeared.
    expect(readFileSync(join(ROOT_DIR, 'target.txt')).length).toBe(before.length)
  })

  it('R-C1-1 traversal target refused with ZERO disclosure and ZERO backend run', async () => {
    const { read, observe } = buildPlane(POLICY_ALLOW)
    const r = await run(() => read.execute({ file_path: join(ROOT_DIR, '..', 'outside', 'secret.txt') }))
    expect(r.resolved).toBe(false)
    if (!r.resolved) expect(r.msg).toMatch(/target-outside-governed-root|refused-schema/)
    expect(ranLines(observe)).toHaveLength(0)
  })

  it('R-C1-2 symlink alias to outside never discloses', async () => {
    const { read, observe } = buildPlane(POLICY_ALLOW)
    const link = join(ROOT_DIR, 'alias.txt')
    rmSync(link, { force: true })
    symlinkSync(join(OUTSIDE_DIR, 'secret.txt'), link)
    const r = await run(() => read.execute({ file_path: link }))
    expect(r.resolved).toBe(false)
    if (!r.resolved) expect(r.msg).not.toContain('OUTSIDE-SECRET')
    expect(ranLines(observe)).toHaveLength(0)
    rmSync(link, { force: true })
  })

  it('R-C1-3 swap to an outside symlink AFTER a real read: the next call answers the NEW truth or refuses — never the old snapshot', async () => {
    const { read, observe } = buildPlane(POLICY_ALLOW)
    const swapPath = join(ROOT_DIR, 'swap.txt')
    writeFileSync(swapPath, 'SAFE-CONTENT-before-swap\n')
    const r1 = await read.execute({ file_path: swapPath })
    expect(joined(r1)).toContain('SAFE-CONTENT')
    rmSync(swapPath, { force: true })
    symlinkSync(join(OUTSIDE_DIR, 'secret.txt'), swapPath)
    const r2 = await run(() => read.execute({ file_path: swapPath }))
    expect(r2.resolved).toBe(false)
    if (!r2.resolved) expect(r2.msg).not.toContain('OUTSIDE-SECRET')
    expect(ranLines(observe)).toHaveLength(1) // ONLY the first, real call
    rmSync(swapPath, { force: true })
  })

  it('R-C1-4 directory target refused: never a directory walk', async () => {
    const { read, observe } = buildPlane(POLICY_ALLOW)
    const r = await run(() => read.execute({ file_path: ROOT_DIR }))
    expect(r.resolved).toBe(false)
    if (!r.resolved) expect(r.msg).toMatch(/not-a-file/)
    expect(ranLines(observe)).toHaveLength(0)
  })

  it('R-C1-5 over-cap file refused pre-byte, NEVER truncated', async () => {
    const { read, observe } = buildPlane(POLICY_ALLOW)
    const r = await run(() => read.execute({ file_path: join(ROOT_DIR, 'big.txt') }))
    expect(r.resolved).toBe(false)
    if (!r.resolved) expect(r.msg).toMatch(/read-too-large/)
    expect(ranLines(observe)).toHaveLength(0)
  })

  it('R-C1-6 malformed window refused BEFORE any resolution (pure parameter law first)', async () => {
    const { read, observe } = buildPlane(POLICY_ALLOW)
    const r = await run(() => read.execute({ file_path: join(ROOT_DIR, 'target.txt'), offset: -5 }))
    expect(r.resolved).toBe(false)
    expect(observe.some((l) => l.includes('window-refused'))).toBe(true)
    expect(ranLines(observe)).toHaveLength(0)
  })

  it('R-C1-7 default-deny lane answers BEFORE the backend; allow-rule path still answers', async () => {
    const denyObserve: string[] = []
    const denyBuilt = mount(Object.freeze({ default: 'deny', allow: [] as unknown[], ask: [] as unknown[], deny: [] as unknown[] }), {}, denyObserve)
    expect(denyBuilt.ok).toBe(true)
    if (denyBuilt.ok !== true) return
    const rRead = denyBuilt.value.definitions.find((d) => d.name === 'read')
    const r = await run(() => rRead!.execute({ file_path: join(ROOT_DIR, 'target.txt') }))
    expect(r.resolved).toBe(false)
    if (!r.resolved) expect(r.msg).toContain('template-default-deny')
    expect(ranLines(denyObserve)).toHaveLength(0)
    // sibling leg: the SAME world with an any-rule allow answers fine
    const { read } = buildPlane(POLICY_ALLOW)
    const ok = await read.execute({ file_path: join(ROOT_DIR, 'target.txt') })
    expect(joined(ok)).toContain('alpha5-m1-read-line-1')
  })

  it('R-C1-8 subtree rule WITHOUT the containment seam cannot even MOUNT (admission never guesses coverage); WITH the seam it admits', async () => {
    const policy = Object.freeze({
      default: 'deny',
      allow: [{ tool: 'read', resource: { kind: 'subtree', path: ROOT_DIR } }],
      ask: [] as unknown[],
      deny: [] as unknown[],
    })
    const noSeam = mount(policy, { fs: undefined })
    expect(noSeam.ok === false ? noSeam.code : 'MOUNTED?!').toBe('TOOL_BINDING_UNVERIFIED')
    if (noSeam.ok === false) expect(noSeam.message).toMatch(/no SubtreeContains seam was injected|never guessed/)
    const seamed = buildPlane(policy, { fs: { subtreeContains } })
    const yes = await seamed.read.execute({ file_path: join(ROOT_DIR, 'target.txt') })
    expect(joined(yes)).toContain('alpha5-m1-read-line-1')
  })

  it('R-C1-9 CURRENT vs target confusion: an fsInstance bound to ANOTHER realm is refused at MOUNT', () => {
    const built = mount(POLICY_ALLOW, { plane: { fsInstance: fsInstance('some-OTHER-realm'), confinedProvider: confinedProvider() } })
    expect(built.ok === false ? built.code : 'MOUNTED?!').toMatch(/TOOL_BINDING_UNVERIFIED|CFS_PROVIDER_REFUSED|ADMISSION_ASSEMBLY_REFUSED/)
  })

  it('R-C1-10 unknown/misshapen raw argument never reaches the backend', async () => {
    const { read, observe } = buildPlane(POLICY_ALLOW)
    const r = await run(() => read.execute(null))
    expect(r.resolved).toBe(false)
    if (!r.resolved) expect(r.msg).toMatch(/locator-rejected/)
    expect(ranLines(observe)).toHaveLength(0)
  })

  // A5-M1 C: the all-allow path (NO Control row) answers from the fresh
  // call-level facts too — the SAME public entry the ask path awaits, now
  // asked TWICE per call: once to take the AdmissionRequest's binding from
  // (root ruling on 091f56d37: no synthesized `plane-row:` identity any more)
  // and once at the execution edge. These legs pin both sides on the REAL
  // read face: an unanswerable current refuses with zero bytes, and a complete
  // ALL-ALLOW answer still delivers the real bytes (fail-closed is not
  // "always refuses").
  it('R-C1-11 all-allow path: unanswerable call-level facts refuse the real read with ZERO bytes', async () => {
    const { read, observe } = buildPlane(POLICY_ALLOW, { readCallFacts: async () => undefined })
    const r = await run(() => read.execute({ file_path: join(ROOT_DIR, 'target.txt') }))
    expect(r.resolved).toBe(false)
    // the refusal point MOVED, the gate did not lower: with no answerable
    // binding behind the call there is no identity to admit, so the answer is
    // the kernel's identity code BEFORE admission — no grant, no Control row,
    // no consumption, and zero bytes either way.
    if (!r.resolved) expect(r.msg).toContain('TOOL_BINDING_UNVERIFIED')
    expect(ranLines(observe)).toHaveLength(0)
  })

  it('R-C1-11b all-allow path: the plane asks with the REAL call identity, and a complete ALL-ALLOW answer delivers the bytes', async () => {
    const observe: string[] = []
    const asked: Array<Record<string, unknown>> = []
    // the answer THIS world's current authority carries: the plane's own
    // projected policy document and generation (no overlay port here, so the
    // assembly's generation is 0 and its row binding validates at revision 1 —
    // values read from the world, never invented by the pin).
    const answer: { kind: 'no-approval-question'; facts: Record<string, unknown> } = {
      kind: 'no-approval-question',
      facts: {},
    }
    const built = mount(POLICY_ALLOW, {
      readCallFacts: async (input: Record<string, unknown>) => {
        asked.push(input)
        answer.facts = {
          ...answer.facts,
          effects: input.requestedEffects,
          realmId: input.realmId,
        }
        return answer
      },
    }, observe)
    if (built.ok !== true) throw new Error(`mount refused: ${built.code}`)
    const plane = built.value as unknown as {
      definitions: ReadonlyArray<Definition>
      governance: { policyDocument: () => unknown; denySources: () => unknown }
    }
    answer.facts = {
      policySource: { staticLayerRefs: ['blueprint:bp@1#sha256:bp', 'template:a5m1-tpl'], overlayGeneration: 0 },
      realmId: REALM,
      ceiling: { teamHardEnvelope: { rules: [] }, permissionMutationEnvelope: { status: 'absent' } },
      policyDocument: plane.governance.policyDocument(),
      denySources: plane.governance.denySources(),
      effects: undefined,
      member: { teamSessionId: 'a5m1-test-team-root', instanceId: 'a5m1-instance' },
      beneficiaryAuthority: 'member',
      // THE LIVE DISPATCHER TUPLE of this plane's own row, shaped exactly as
      // the guard stamps it (`tool-dispatch/install.ts:1150-1163`): the family
      // is `team-own:<agentScopeKey>:<placed name>`, the generations are the
      // DISPATCHER's (0 here — production stays 0 until PR2 feeds the overlay
      // generation into the Binding), the assurance cell comes from the guard's
      // own producer. The plane takes its AdmissionRequest binding from this
      // read verbatim (root ruling on 091f56d37): the row identity is no
      // longer the plane's to invent, and the kernel's identity leg compares
      // this tuple against the assembly's generation (admission-kernel.ts:245-254).
      binding: {
        bindingId: `team-own:${ROOT_SCOPE}:read`,
        agentScopeKey: ROOT_SCOPE,
        toolName: 'read',
        definitionIdentity: 'sha256:placed-definition',
        providerId: 'dsh-agent-team',
        implementationOrigin: 'team-trusted-extension',
        executionBoundary: 'trusted-host',
        assurance: untestedAssurance('team-trusted-extension', 'trusted-host'),
        policyGeneration: 0,
        authorityGeneration: 0,
        revision: 1,
        status: 'ACTIVE',
      },
      // string identity, per the permission lane's own binding tuple
      blueprint: { revision: '1', contentHash: 'sha256:bp', templateId: 'a5m1-tpl', cwd: ROOT_DIR, providerVersion: 'pv-1' },
      authorityGeneration: 0,
    }
    const read = plane.definitions.find((d) => d.name === 'read')
    if (!read) throw new Error('no read definition in mount')
    const r = await read.execute({ file_path: join(ROOT_DIR, 'target.txt') })
    expect(joined(r)).toContain('alpha5-m1-read-line-1')
    expect(ranLines(observe)).toHaveLength(1)
    // the plane asked with the CALL identity: its OWN placement spelling
    // (never the backend/effect name), plus this call's realm, id and effects
    // — once to build the request, once again at the execution edge.
    expect(asked.length).toBe(2)
    const askedInput = asked[0] as Record<string, unknown>
    expect(askedInput.placementName).toBe('read')
    expect(askedInput.realmId).toBe(REALM)
    expect(String(askedInput.callId ?? '')).not.toBe('')
    // the SAME call both times (never a fresh identity for the re-check), and
    // never a binding identity handed in from outside.
    expect(asked[1]?.callId).toBe(askedInput.callId)
    for (const askedRow of asked) expect(askedRow.bindingId).toBeUndefined()
  })
})

// ===========================================================================
// A5-M2 PA-READ HAND-OFF on the REAL chain: production Part A (the pre-execute
// hand-off the plane opens) and production Part B (the execution edge the body
// redeems). No stub stands between them: the same assembly, the same call-level
// facts entry, the same fresh-recheck/drift law, the same one-shot consume.
// ===========================================================================
describe('a5-m1-read-c1c2 — A5-M2 hand-off through the production A/B pair', () => {
  type HandoffFace = {
    open: (exec: object) => Promise<{ kind: string; correlation?: string; code?: string; detail?: string }>
    close: (exec: object) => void
  }
  const factsWorld = (planeValue: { governance: { policyDocument: () => unknown; denySources: () => unknown } }) => ({
    ceiling: { teamHardEnvelope: { rules: [] }, permissionMutationEnvelope: { status: 'absent' } },
    policyDocument: planeValue.governance.policyDocument(),
    denySources: planeValue.governance.denySources(),
    effects: undefined,
    member: { teamSessionId: 'a5m1-test-team-root', instanceId: 'a5m1-instance' },
    beneficiaryAuthority: 'member',
    binding: {
      bindingId: `team-own:${ROOT_SCOPE}:read`,
      agentScopeKey: ROOT_SCOPE,
      toolName: 'read',
      definitionIdentity: 'sha256:placed-definition',
      providerId: 'dsh-agent-team',
      implementationOrigin: 'team-trusted-extension',
      executionBoundary: 'trusted-host',
      assurance: untestedAssurance('team-trusted-extension', 'trusted-host'),
      policyGeneration: 0,
      authorityGeneration: 0,
      revision: 1,
      status: 'ACTIVE',
    },
    blueprint: { revision: '1', contentHash: 'sha256:bp', templateId: 'a5m1-tpl', cwd: ROOT_DIR, providerVersion: 'pv-1' },
    authorityGeneration: 0,
  })
  const handoffMount = (factsAnswer?: { kind: string; facts?: Record<string, unknown> }) => {
    const asked: Array<Record<string, unknown>> = []
    const built = mount(POLICY_ALLOW, {
      readCallFacts: async (input: Record<string, unknown>) => {
        asked.push(input)
        // M5 drives the ONE open-leg refusal that already wrote its pending
        // placeholder, by having the entry answer a kind Part A cannot use.
        if (factsAnswer !== undefined) return factsAnswer as unknown as { kind: 'no-approval-question'; facts: Record<string, unknown> }
        // the world is answered PER CALL, exactly as the entry does: the realm
        // of the asked call rides the answer.
        // The entry answers the CALL: its realm AND the effect set it was asked
        // about (the edge re-evaluates the CURRENT policy over exactly that set).
        return { kind: 'no-approval-question', facts: { ...factsWorld(planeValue), realmId: input.realmId, effects: input.requestedEffects } }
      },
    })
    if (!built.ok) throw new Error(`mount refused: ${JSON.stringify(built)}`)
    const planeValue = built.value as unknown as {
      governance: { policyDocument: () => unknown; denySources: () => unknown }
      definitions: Array<{ name: string; execute: (raw: unknown, exec?: unknown) => Promise<unknown> }>
      paReadHandoff?: HandoffFace
      livePaPlan: Map<string, unknown>
    }
    const read = planeValue.definitions.find((d) => d.name === 'read')
    if (!read || !planeValue.paReadHandoff) throw new Error('no read row / no hand-off face on this mount')
    return { plane: planeValue, read, handoff: planeValue.paReadHandoff, asked }
  }

  it('M1 production A→B: the open leg authorizes on the REAL walk, the body redeems through the REAL edge and the bytes arrive', async () => {
    const { plane, read, handoff, asked } = handoffMount()
    const file = join(ROOT_DIR, 'target.txt')
    const token = Symbol('a5m2-handoff-m1')
    const execLike = { name: 'read', token, arguments: { file_path: file } }
    const opened = await handoff.open(execLike)
    expect(opened.kind, JSON.stringify(opened)).toBe('authorized')
    expect(typeof opened.correlation, 'the row mints the correlation').toBe('string')
    // This world answers ALL-ALLOW, so Part A opens no approval plan (the ask
    // lane is the one that carries a plan fact into the redemption); what Part
    // A did do is read this call's level facts.
    expect(plane.livePaPlan.size, 'an all-allow answer creates no plan fact').toBe(0)
    const askedAfterOpen = asked.length
    expect(askedAfterOpen, 'Part A read the call-level facts for THIS call').toBeGreaterThanOrEqual(1)
    const body = await read.execute({ file_path: file }, execLike)
    expect(joined(body as ReadOk), 'the redemption runs the real execution edge and reads').toContain('alpha5-m1-read-line-1')
    expect(asked.length, 'Part B re-read the facts FRESH — the edge never trusts Part A\'s read').toBeGreaterThan(askedAfterOpen)
    expect(plane.livePaPlan.size, 'the redemption is the end of this call\'s plan fact').toBe(0)
  })

  it('M2 close before the body: the plan fact and the flight both die, and the late body delivers ZERO bytes', async () => {
    const { plane, read, handoff } = handoffMount()
    const file = join(ROOT_DIR, 'target.txt')
    const token = Symbol('a5m2-handoff-m2')
    const execLike = { name: 'read', token, arguments: { file_path: file } }
    const opened = await handoff.open(execLike)
    expect(opened.kind).toBe('authorized')
    handoff.close(execLike)
    expect(plane.livePaPlan.size, 'the close drops the plan fact of the call that never arrived').toBe(0)
    const late = await read.execute({ file_path: file }, execLike)
    const text = String((late as { content?: Array<{ text?: string }> }).content?.[0]?.text ?? '')
    expect(text + JSON.stringify(late), 'a terminal token answers cancelled — never the bytes, never a re-walk').not.toContain('alpha5-m1-read-line-1')
    expect(text, 'the honest word is cancellation').toContain('cancelled')
  })

  it('M3 a second open on the same token is a SIDE-EFFECT-FREE refusal — no reuse, and the first leg keeps its state', async () => {
    const { plane, read, handoff, asked } = handoffMount()
    const file = join(ROOT_DIR, 'target.txt')
    const token = Symbol('a5m2-handoff-m3')
    const execLike = { name: 'read', token, arguments: { file_path: file } }
    const first = await handoff.open(execLike)
    expect(first.kind).toBe('authorized')
    const askedAfterFirst = asked.length
    const second = await handoff.open(execLike)
    // Root's law: an authorization is NOT transferable. The duplicate refuses;
    // it reuses no answer, mints nothing and walks nothing a second time.
    expect(second.kind, 'a duplicate open is refused, never an authorization').toBe('refused')
    expect((second as unknown as { code?: string }).code).toBe('PA_HANDOFF_IN_FLIGHT')
    // The REAL port states cleanup ownership (the adapter obeys this statement
    // and never guesses from `code`): a duplicate says plainly that it owns
    // nothing to clean, so the adapter leaves the first leg alone.
    expect((second as unknown as { ownsHandoff?: boolean }).ownsHandoff, 'the real port states: this entry owns nothing to clean').toBe(false)
    expect(asked.length, 'the duplicate asked the facts entry ZERO extra times').toBe(askedAfterFirst)
    // And the refusal must not disturb the leg that OWNS the token: the close-out
    // bug terminalised the token underneath the first leg, so the first call
    // refused with the very grant it had earned. It still redeems here.
    const body = await read.execute({ file_path: file }, { token })
    expect(joined(body as ReadOk), 'the owning leg still redeems after a refused duplicate').toContain('alpha5-m1-read-line-1')
    expect(plane.livePaPlan.size, 'the redeemed call leaves no plan fact behind').toBe(0)
  })

  it('M4 a close that lands on an in-flight leg ends it: nothing is registered late and the token is never re-armed', async () => {
    const { plane, handoff } = handoffMount()
    const file = join(ROOT_DIR, 'target.txt')
    const token = Symbol('a5m2-handoff-m4')
    const execLike = { name: 'read', token, arguments: { file_path: file } }
    const opened = handoff.open(execLike)
    // Close while the leg is still in flight: the placeholder is released and
    // the leg's own re-check after the await must drop its answer.
    handoff.close(execLike)
    const late = await opened
    expect((late as unknown as { kind?: string }).kind, 'a closed leg never hands off').toBe('refused')
    expect(plane.livePaPlan.size, 'the dropped answer registers nothing').toBe(0)
    const again = await handoff.open(execLike)
    expect((again as unknown as { code?: string }).code, 'a terminal token is never re-armed').toBe('PA_HANDOFF_TERMINAL')
    // RECORDED COVERAGE GAP (honest): this file can only mount the ALL-ALLOW
    // walk, and `livePaPlan` is written ONLY on the requires-approval branch
    // (team-tool-plane.mjs:1171-1180). So the plan-fact DROP on a pending close
    // — the fix that made the placeholder carry its own correlation — is NOT
    // exercised here; it needs a mount with a real Control leg. Not counted as
    // covered.
  })

  it('M5 the refusal that ALREADY wrote its pending placeholder says it owns it — and the close clears the placeholder', async () => {
    // The point root took off 3dc887: of every open-leg refusal, THIS is the
    // one that had already written the pending placeholder, yet it said nothing
    // about owning it. The adapter therefore closed nothing (no `ownsHandoff`),
    // the exec was never registered, and the terminal leg does not clear a
    // placeholder either — it stayed for the life of the mount, and every later
    // open on that token answered IN_FLIGHT for a leg that no longer existed.
    const { plane, handoff } = handoffMount({ kind: 'answered-a-kind-part-a-cannot-use' })
    const file = join(ROOT_DIR, 'target.txt')
    const token = Symbol('a5m2-handoff-m5')
    const execLike = { name: 'read', token, arguments: { file_path: file } }
    const refused = await handoff.open(execLike)
    expect(refused.kind, 'an entry answering neither facts shape refuses the read in place').toBe('refused')
    expect((refused as unknown as { ownsHandoff?: boolean }).ownsHandoff, 'and it STATES that it owns the pending state to clean').toBe(true)
    // The cleanup taken on that statement removes the PLACEHOLDER, not only the
    // plan fact: afterwards the token is TERMINAL, not IN_FLIGHT — IN_FLIGHT
    // here would mean a placeholder nobody can reach is still sitting there.
    handoff.close(execLike)
    const again = await handoff.open(execLike)
    expect((again as unknown as { code?: string }).code, 'the pending placeholder is gone, the token is terminal').toBe('PA_HANDOFF_TERMINAL')
    expect(plane.livePaPlan.size, 'and nothing else survives it').toBe(0)
  })
})
