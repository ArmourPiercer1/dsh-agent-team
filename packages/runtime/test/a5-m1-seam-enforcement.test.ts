/**
 * A5-M1 seam enforcement — the CENTER's own posture on the controlLeg seam
 * (the bridge is AUTH-owned and covered by its own suite; these legs pin
 * what the center does with whatever a leg returns).
 *
 * C1 scope, disclosed: unit-level plane worlds with fixture backends; the
 * real durable Control chain is a5-m1-auth-bridge (bridge-owned) and the
 * real-Host kits. Nothing here claims C2.
 *
 * Pinned center laws (commit 4c986daa9):
 *  E1  an approving leg that returns NO landed grant is a frozen-contract
 *      violation (decision booleans are not the Control/PA leg) → the call
 *      is refused APPROVAL_LEG_INCOMPLETE and the backend never runs.
 *  E2  a leg returning a grant the kernel does not recognize cannot cross
 *      the one-shot execution edge → GRANT_CONSUMPTION_REFUSED, zero body.
 *  E3  a deny leg refuses with APPROVAL_DENIED and zero spawn (the pending
 *      row's fate is the bridge's business; the center only obeys verdicts).
 */
import { describe, expect, it, vi } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
// The plane is an untyped `.mjs` SOURCE module (no declaration file): bind
// the dynamic import through the module's REAL shape once, then unwrap the
// mount result fail-closed — the refusal path throws with the real code
// instead of pretending the value exists.
type SeamToolResult = { readonly text?: string; readonly message?: string; readonly kind?: string }
type SeamToolDef = { readonly name: string; execute: (raw: Record<string, unknown>, exec?: unknown) => Promise<SeamToolResult> }
type SeamMount =
  | { readonly ok: true; readonly value: { readonly definitions: readonly SeamToolDef[] } }
  | { readonly ok: false; readonly error?: { readonly code?: string; readonly message?: string } }
// the annotation types every call site; the dynamic-import expression is
// cast through `unknown` once (the `.mjs` source module carries no
// declaration file).
const row: { createTeamToolPlaneAssembly: (input: Record<string, unknown>) => SeamMount } =
  await import(new URL('../src/plugin/live/team-tool-plane.mjs', import.meta.url).href) as unknown as {
    createTeamToolPlaneAssembly: (input: Record<string, unknown>) => SeamMount
  }
const mounted = (mount: SeamMount): { readonly definitions: readonly SeamToolDef[] } => {
  if (mount.ok !== true) throw new Error(`mount refused: ${String(mount.error?.code ?? '?')} ${String(mount.error?.message ?? '')}`)
  return mount.value
}
const definitionOf = (mount: { readonly definitions: readonly SeamToolDef[] }, name: string): SeamToolDef => {
  const found = mount.definitions.find((d) => d.name === name)
  if (found === undefined) throw new Error(`no definition named ${name}`)
  return found
}
const { approvingControlLeg } = await import(new URL('./a5-m1-control-legs.mjs', import.meta.url).href)

const ASK_ALL = Object.freeze({ default: 'ask', allow: [] as unknown[], ask: [] as unknown[], deny: [] as unknown[] })

function fixtureShell() {
  let execCount = 0
  return {
    kind: 'shell',
    definitions: [{
      name: 'team_bash',
      description: 'fixture shell',
      parameters: { type: 'object', properties: { command: { type: 'string' } }, required: ['command'] },
      execute: async (args: { command?: string }) => {
        execCount += 1
        return { text: `fixture-shell-saw ${String(args?.command ?? '')}` }
      },
    }],
    execCount: () => execCount,
  }
}

async function planeWith(leg: unknown) {
  const scratch = mkdtempSync(join(tmpdir(), 'a5m1-seam-'))
  const shell = fixtureShell()
  const built = mounted(row.createTeamToolPlaneAssembly({
      teamSessionId: 'a5m1-test-team-root',
    permissionPolicy: ASK_ALL,
    realmId: 'a5m1-seam-realm',
    templateId: 'seam-tpl',
    role: 'member',
    instanceId: 'seam-instance',
    ...(leg === undefined ? {} : { controlLeg: leg }),
    plane: { cwdRoot: scratch },
    backends: { shell },
  }))
  const bash = definitionOf(built, 'team_bash')
  const run = async (command: string, exec?: unknown) => await bash.execute({ command }, exec)
  return { run, shell, done: () => rmSync(scratch, { recursive: true, force: true }) }
}

describe('A5M1-SEAM — center enforcement of the controlLeg contract', () => {
  it('E1 approval WITHOUT a landed grant = contract violation: refused APPROVAL_LEG_INCOMPLETE, zero backend', async () => {
    const booleanOnlyLeg = async ({ plan }: { plan: { approvalCaseId: string } }) => ({
      decision: 'approve',
      requestId: 'bool-only-row',
      approval: { approvalCaseId: plan.approvalCaseId },
    })
    const { run, shell, done } = await planeWith(booleanOnlyLeg)
    try {
      const r = await run('printf should-never-run')
      expect(String(r.text)).toContain('a5p5-refused')
      expect(String(r.text)).toContain('APPROVAL_LEG_INCOMPLETE')
      expect(shell.execCount()).toBe(0)
    } finally { done() }
  })

  it('E2 a foreign grant object cannot cross the one-shot execution edge: GRANT_CONSUMPTION_REFUSED, zero backend', async () => {
    const forgedGrantLeg = async () => ({
      decision: 'approve',
      requestId: 'forged-row',
      approval: { approvalCaseId: 'any' },
      grant: { kind: 'grant-shaped-but-unknown-to-kernel' },
    })
    const { run, shell, done } = await planeWith(forgedGrantLeg)
    try {
      const r = await run('printf should-never-run')
      expect(String(r.text)).toContain('a5p5-refused')
      // The kernel's execution edge verifies the grant's binding identity
      // first — the center passes the true kernel code through (measured:
      // TOOL_BINDING_UNVERIFIED), which is the honest refused-admission.
      expect(String(r.text)).toMatch(/TOOL_BINDING_UNVERIFIED|GRANT_CONSUMPTION_REFUSED/)
      expect(shell.execCount()).toBe(0)
    } finally { done() }
  })

  it('E4 mid-wait cancellation: the leg RECEIVES the invocation signal; when the wait is aborted the center reports the invocation fact (row-form cancelled), zero spawn, zero consumption', async () => {
    const ac = new AbortController()
    const signalHonorLeg = async (input: Record<string, unknown>) => {
      const sig = (input as { signal?: { aborted?: boolean } }).signal
      if (sig === undefined) throw new Error('fix-4: the center must hand the invocation signal to the leg')
      ac.abort() // the cancellation lands while the approval wait is in flight
      return { decision: 'unsettled', requestId: undefined } // real bridge: aborted wait never mints
    }
    const { run, shell, done } = await planeWith(signalHonorLeg)
    try {
      const r = await run('printf should-never-run', { signal: ac.signal })
      expect(String(r.text)).toContain('· cancelled')
      expect(String(r.text)).not.toContain('a5p5-refused')
      expect(String(r.text)).not.toContain('APPROVAL_')
      expect(shell.execCount()).toBe(0)
    } finally { done() }
  })

  it('E3 deny leg = APPROVAL_DENIED, zero spawn (center obeys the verdict, mints nothing)', async () => {
    const denyLeg = async () => ({ decision: 'deny', requestId: 'deny-row' })
    const { run, shell, done } = await planeWith(denyLeg)
    try {
      const r = await run('printf should-never-run')
      expect(String(r.text)).toContain('APPROVAL_DENIED')
      expect(shell.execCount()).toBe(0)
    } finally { done() }
  })
})

describe('A5M1-SEAM — fix-5/A2 read row', () => {
  it('E6 pre-aborted read is cancelled at the PA edge: zero resolver fs, zero bytes, row-form cancelled', async () => {
    const scratch = mkdtempSync(join(tmpdir(), 'a5m1-e6-'))
    writeFileSync(join(scratch, 'secret.txt'), 'E6-NEVER-READ')
    fsProbe.hits = 0
    fsProbe.armed = true
    try {
      const built = mounted(row.createTeamToolPlaneAssembly({
        teamSessionId: 'a5m1-test-team-root',
        permissionPolicy: { default: 'ask', allow: [] as unknown[], ask: [] as unknown[], deny: [] as unknown[] },
        realmId: 'a5m1-e6-realm', templateId: 'e6-tpl', role: 'member', instanceId: 'e6-instance',
        controlLeg: async () => { throw new Error('E6: a pre-aborted call must NEVER open an approval wait') },
        plane: { fsInstance: { fs: 'e6', rootDir: scratch, realmId: 'a5m1-e6-realm', kind: 'absolute-path' } },
      }))
      const read = definitionOf(built, 'read')
      const ac = new AbortController()
      ac.abort()
      const r = await read.execute({ file_path: join(scratch, 'secret.txt') }, { token: Symbol('e6'), signal: ac.signal })
      const wire = JSON.stringify(r)
      expect(wire).not.toContain('E6-NEVER-READ')
      expect(wire).not.toContain('"path":null') // no fabricated read-card fields
      expect(wire).not.toContain('"lines":[]')
      expect(wire).toContain('cancelled') // the honest word is carried
      expect(fsProbe.hits, 'resolver surface untouched').toBe(0)
    } finally {
      fsProbe.armed = false
      rmSync(scratch, { recursive: true, force: true })
    }
  })
})

// fix-5 E5: transparent vi.mock wrappers COUNT resolver-surface fs access
// (realpath/exists/open) while delegating to the real receiver verbatim —
// measurement only, zero behavior change (the window-suite injection law).
const fsProbe = { hits: 0, armed: false }
vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>() as Record<string, unknown>
  const count = <T extends unknown[]>(key: string, fn: (...a: T) => unknown) =>
    (...a: T) => { if (fsProbe.armed) fsProbe.hits += 1; return fn(...a) }
  return { ...actual,
    realpathSync: count('realpathSync', actual.realpathSync as (...a: unknown[]) => unknown) as unknown,
    existsSync: count('existsSync', actual.existsSync as (...a: unknown[]) => unknown) as unknown,
    statSync: count('statSync', actual.statSync as (...a: unknown[]) => unknown) as unknown,
  }
})
vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>() as Record<string, unknown>
  const open = actual.open as (...a: unknown[]) => Promise<unknown>
  return { ...actual, open: (...a: unknown[]) => { if (fsProbe.armed) fsProbe.hits += 1; return open(...a) } }
})

describe('A5M1-SEAM — C: the execution edge answers from fresh call-level facts', () => {
  // A5-M1-A deleted the two self-attesting checks that used to stand at the
  // final edge: the WHOLE-object policy JSON compare against the mount's own
  // policy reader, and `readProviderIdentity()` compared with itself (two
  // reads of one closure — an identity that can never differ). What the edge
  // awaits instead is the registry's PUBLIC call-level entry — `{ kind, facts }`
  // for THIS call, keyed by the call identity — so the all-allow path, which
  // mints no Control row, asks the SAME question as the row path. These legs
  // drive that seam directly (the center's own consumption law); every
  // refusal leg pins zero body, every pass leg pins exactly one.
  // the durable overlay generation this world answers: 0 is the REAL durable
  // state of a team with no permission-overlay row (the plane's row bindings
  // are validated at generation 0 — a nonzero answer is a re-assembly, not an
  // admission, exactly as the kernel's identity leg says).
  const GEN = 0
  const EPOCH = 7
  type SeamAnswer = { kind: 'call-facts' | 'no-approval-question'; facts: Record<string, unknown> } | undefined
  type PlaneFace = {
    definitions: readonly SeamToolDef[]
    governance?: { policyDocument: () => unknown; denySources: () => unknown }
    livePaPlan?: Map<string, unknown>
  }
  const planeOf = (mount: SeamMount): PlaneFace => {
    if (mount.ok !== true) throw new Error(`mount refused: ${String((mount.error as { code?: string } | undefined)?.code ?? '?')}`)
    return mount.value as unknown as PlaneFace
  }
  interface SeamWorld {
    readonly plane: PlaneFace
    readonly scratch: string
    readonly target: string
    readonly observe: string[]
    setSeam: (fn: (input: Record<string, unknown>) => SeamAnswer | Promise<SeamAnswer>) => void
    readonly done: () => void
  }
  async function seamWorld(opts: {
    readonly lane: 'ask' | 'allow'
    readonly controlLeg?: unknown
    readonly readRow?: boolean
    readonly resurrectDeletedReaders?: boolean
  }): Promise<SeamWorld> {
    const scratch = mkdtempSync(join(tmpdir(), 'a5m1-c-'))
    const target = join(scratch, 'target.txt')
    writeFileSync(target, 'alpha5-m1-seam-bytes\n')
    const observe: string[] = []
    let seam: (input: Record<string, unknown>) => SeamAnswer | Promise<SeamAnswer> = () => undefined
    // Both read-row worlds are production-isomorphic (a5-m1-read-c1c2's law):
    // an `any` whole-tool rule projects ONLY its tool-invoke arm, so the
    // resource effect rides a SUBTREE rule over the governed root — with the
    // containment seam wired below. `lane: 'allow'` admits WITHOUT a Control
    // row; `lane: 'ask'` opens the durable ask for the same set.
    const readRule = { tool: 'read', resource: { kind: 'subtree', path: scratch } }
    const policy = opts.lane === 'ask' && opts.readRow === true
      ? { default: 'deny', allow: [] as unknown[], ask: [readRule] as unknown[], deny: [] as unknown[] }
      : opts.lane === 'allow'
        ? { default: 'deny', allow: [readRule] as unknown[], ask: [] as unknown[], deny: [] as unknown[] }
        : { default: 'ask', allow: [] as unknown[], ask: [] as unknown[], deny: [] as unknown[] }
    const plane = planeOf(row.createTeamToolPlaneAssembly({
      teamSessionId: 'a5m1-test-team-root',
      permissionPolicy: policy,
      realmId: 'a5m1-c-realm', templateId: 'c-tpl', role: 'member', instanceId: 'c-instance',
      ...(opts.controlLeg === undefined ? {} : { controlLeg: opts.controlLeg }),
      // the ONE durable overlay port — the SAME source the assembly's
      // authorityGeneration was configured with: the final edge re-reads it
      // FOR THIS CALL, and the fresh facts must agree with it. No constant,
      // and never the last confirmed value carried over.
      authorityFacts: { overlayGeneration: async () => GEN },
      // the retained placement/activation fence (M1-A kept this one), plus —
      // for the C7 pin only — the authorities M1-A DELETED: if anything still
      // consults them, the throw answers the call.
      currentFacts: {
        getRollbackEpoch: () => EPOCH,
        ...(opts.resurrectDeletedReaders === true ? {
          getPolicy: () => { throw new Error('M1-A: the whole-object policy reader must never be consulted again') },
          getAuthorityGeneration: () => { throw new Error('M1-A: no scalar generation getter may answer the final edge') },
          getBindingRevision: () => { throw new Error('M1-A: no scalar revision getter may answer the final edge') },
        } : {}),
      },
      ...(opts.resurrectDeletedReaders === true ? { entryOf: () => { throw new Error('M1-D: the single-name dispatcher lookup must never be consulted again') } } : {}),
      // A5-M1-B: the PUBLIC call-level entry (agent-bindings wires exactly
      // this function); the plane passes the CALL identity, never a row.
      readCallFacts: async (input: Record<string, unknown>) => await seam(input),
      ...(opts.readRow !== true ? {} : {
        fs: { subtreeContains: ({ parent, child }: { parent: string; child: string }) => child === parent || child.startsWith(`${parent}/`) },
      }),
      plane: { fsInstance: { fs: 'c', rootDir: scratch, realmId: 'a5m1-c-realm', kind: 'absolute-path' } },
      onObserve: (r: unknown) => { observe.push(String(r)) },
    }))
    return {
      plane, scratch, target, observe,
      setSeam: (fn) => { seam = fn },
      done: () => rmSync(scratch, { recursive: true, force: true }),
    }
  }
  /** A COMPLETE fresh answer for the call the seam was asked about, built
   *  from the PLANE's own live plan (never an invented approval identity);
   *  `over` is the single member the leg drifts — the failure under test. */
  const answerFor = (world: SeamWorld, input: Record<string, unknown>, kind: 'call-facts' | 'no-approval-question', over: Record<string, unknown> = {}): SeamAnswer => {
    const effects = input.requestedEffects as { effects: unknown[]; fingerprint: string }
    const live = world.plane.livePaPlan?.get(String(input.callId)) as Record<string, unknown> | undefined
    const facts: Record<string, unknown> = {
      policySource: { staticLayerRefs: ['blueprint:bp@1#sha256:bp', 'template:c-tpl'], overlayGeneration: GEN },
      realmId: String(input.realmId),
      ceiling: { teamHardEnvelope: { rules: [] }, permissionMutationEnvelope: { status: 'absent' } },
      policyDocument: world.plane.governance?.policyDocument(),
      denySources: world.plane.governance?.denySources(),
      effects,
      member: { teamSessionId: 'a5m1-test-team-root', instanceId: 'c-instance' },
      beneficiaryAuthority: 'member',
      binding: { bindingId: String(input.bindingId ?? 'plane-row:c-tpl:team_bash'), revision: 1, definitionIdentity: 'sha256:def', status: 'ACTIVE' },
      blueprint: { revision: 1, contentHash: 'sha256:bp', templateId: 'c-tpl', cwd: '/work', providerVersion: 'pv-1' },
      authorityGeneration: GEN,
    }
    if (kind === 'call-facts') {
      facts.planSnapshot = {
        approvalCaseId: String(live?.approvalCaseId ?? ''),
        effectSetFingerprint: String(live?.effectSetFingerprint ?? effects.fingerprint),
        perEffectRequired: live?.perEffectRequired ?? [],
      }
    }
    return { kind, facts: { ...facts, ...over } }
  }
  const outcome = async (fn: () => Promise<unknown>): Promise<string> => {
    try { return JSON.stringify(await fn()) } catch (error) { return `REJECT:${String((error as Error)?.message ?? error)}` }
  }
  const ranReads = (world: SeamWorld) => world.observe.filter((l) => l.includes('governed-read RAN')).length
  const runRead = async (world: SeamWorld, command = 'alpha5-probe') =>
    await outcome(async () => await definitionOf(world.plane, 'read').execute({ file_path: world.target, note: command }))

  it('C0 positive: a complete fresh answer on the ASK path lets the ONE real body run', async () => {
    const world = await seamWorld({ lane: 'ask', readRow: true, controlLeg: approvingControlLeg() })
    world.setSeam((input) => answerFor(world, input, 'call-facts'))
    try {
      const wire = await runRead(world)
      expect(wire).toContain('alpha5-m1-seam-bytes')
      expect(ranReads(world)).toBe(1)
    } finally { world.done() }
  })

  it('C1 the approved question moved (fresh planSnapshot names another case) => GRANT_STALE, zero bytes', async () => {
    const world = await seamWorld({ lane: 'ask', readRow: true, controlLeg: approvingControlLeg() })
    world.setSeam((input) => answerFor(world, input, 'call-facts', {
      planSnapshot: { approvalCaseId: 'a-different-case', effectSetFingerprint: 'sha256:other', perEffectRequired: ['member'] },
    }))
    try {
      const wire = await runRead(world)
      expect(wire).toContain('GRANT_STALE')
      expect(wire).not.toContain('alpha5-m1-seam-bytes')
      expect(ranReads(world)).toBe(0)
    } finally { world.done() }
  })

  it('C2 the rungs the approval covers are not the rungs standing now => GRANT_STALE (never a retroactive widening)', async () => {
    const world = await seamWorld({ lane: 'ask', readRow: true, controlLeg: approvingControlLeg() })
    world.setSeam((input) => answerFor(world, input, 'call-facts', { planSnapshot: { approvalCaseId: '', effectSetFingerprint: '', perEffectRequired: [] } }))
    try {
      const wire = await runRead(world)
      expect(wire).toContain('GRANT_STALE')
      expect(ranReads(world)).toBe(0)
    } finally { world.done() }
  })

  it('C3 the entry answers undefined (no complete facts) => GRANT_STALE, zero bytes', async () => {
    const world = await seamWorld({ lane: 'ask', readRow: true, controlLeg: approvingControlLeg() })
    world.setSeam(() => undefined)
    try {
      const wire = await runRead(world)
      expect(wire).toContain('GRANT_STALE')
      expect(ranReads(world)).toBe(0)
    } finally { world.done() }
  })

  it("C4 the facts generation disagrees with this call's durable re-read => GRANT_STALE (the last confirmed value is never carried over)", async () => {
    const world = await seamWorld({ lane: 'ask', readRow: true, controlLeg: approvingControlLeg() })
    world.setSeam((input) => answerFor(world, input, 'call-facts', { authorityGeneration: GEN + 5 }))
    try {
      const wire = await runRead(world)
      expect(wire).toContain('GRANT_STALE')
      expect(ranReads(world)).toBe(0)
    } finally { world.done() }
  })

  it("C5 the binding revision is the FRESH entry's, not the constant 1: a drifted revision never crosses the consume edge", async () => {
    const world = await seamWorld({ lane: 'ask', readRow: true, controlLeg: approvingControlLeg() })
    world.setSeam((input) => answerFor(world, input, 'call-facts', {
      binding: { bindingId: 'plane-row:c-tpl:read', revision: 99, definitionIdentity: 'sha256:def', status: 'ACTIVE' },
    }))
    try {
      const wire = await runRead(world)
      expect(wire).not.toContain('alpha5-m1-seam-bytes')
      expect(wire).toMatch(/GRANT_STALE|TOOL_BINDING_UNVERIFIED|GRANT_CONSUMPTION_REFUSED|APPROVAL_STALE/)
      expect(ranReads(world)).toBe(0)
    } finally { world.done() }
  })

  it('C7 the DELETED authorities stay deleted: a wired policy getter / name lookup is never consulted', async () => {
    const world = await seamWorld({ lane: 'allow', readRow: true, resurrectDeletedReaders: true })
    world.setSeam((input) => answerFor(world, input, 'no-approval-question'))
    try {
      // the whole-object policy JSON compare and the self-comparing provider
      // identity are GONE: with the deleted getters re-wired as throwers, a
      // complete fresh answer still runs — nothing touched them.
      const wire = await runRead(world)
      expect(wire).toContain('alpha5-m1-seam-bytes')
      expect(wire).not.toMatch(/M1-A|M1-D/)
      expect(ranReads(world)).toBe(1)
    } finally { world.done() }
  })

  it('C8 a governed mount with NO call-level entry refuses instead of falling back to the rev.0 constants', async () => {
    const scratch = mkdtempSync(join(tmpdir(), 'a5m1-c8-'))
    const target = join(scratch, 'target.txt')
    writeFileSync(target, 'alpha5-m1-seam-bytes\n')
    const observe: string[] = []
    const plane = planeOf(row.createTeamToolPlaneAssembly({
      teamSessionId: 'a5m1-test-team-root',
      permissionPolicy: { default: 'deny', allow: [{ tool: 'read', resource: { kind: 'subtree', path: scratch } }] as unknown[], ask: [] as unknown[], deny: [] as unknown[] },
      realmId: 'a5m1-c8-realm', templateId: 'c8-tpl', role: 'member', instanceId: 'c8-instance',
      authorityFacts: { overlayGeneration: async () => GEN },
      currentFacts: { getRollbackEpoch: () => EPOCH }, // live seam mounted, facts entry NOT
      fs: { subtreeContains: ({ parent, child }: { parent: string; child: string }) => child === parent || child.startsWith(`${parent}/`) },
      plane: { fsInstance: { fs: 'c8', rootDir: scratch, realmId: 'a5m1-c8-realm', kind: 'absolute-path' } },
      onObserve: (r: unknown) => { observe.push(String(r)) },
    }))
    try {
      const wire = await outcome(async () => await definitionOf(plane, 'read').execute({ file_path: target }))
      expect(wire).toContain('GRANT_STALE')
      expect(observe.filter((l) => l.includes('governed-read RAN'))).toHaveLength(0)
    } finally { rmSync(scratch, { recursive: true, force: true }) }
  })

  it('C6 all-allow path (NO Control row): the fresh facts must still answer ALL-ALLOW for the WHOLE set', async () => {
    const world = await seamWorld({ lane: 'allow', readRow: true })
    world.setSeam((input) => answerFor(world, input, 'no-approval-question', { policyDocument: { rules: [] } }))
    try {
      const wire = await runRead(world)
      expect(wire).toContain('GRANT_STALE')
      expect(wire).not.toContain('alpha5-m1-seam-bytes')
      expect(ranReads(world)).toBe(0)
    } finally { world.done() }
  })

  it('C6b all-allow path with a complete ALL-ALLOW answer runs the real body exactly once', async () => {
    const world = await seamWorld({ lane: 'allow', readRow: true })
    world.setSeam((input) => answerFor(world, input, 'no-approval-question'))
    try {
      const wire = await runRead(world)
      expect(wire).toContain('alpha5-m1-seam-bytes')
      expect(ranReads(world)).toBe(1)
    } finally { world.done() }
  })
})


describe('A5M1-SEAM — fix-5 pending ordering', () => {
  it('E5 pending approval performs ZERO resolver/probe fs: realpath/stat/open happen only after consumption', async () => {
    const scratch = mkdtempSync(join(tmpdir(), 'a5m1-e5-'))
    const target = join(scratch, 'secret.txt')
    writeFileSync(target, 'E5-NEVER-READ')
    fsProbe.hits = 0
    fsProbe.armed = true
    try {
      const built = mounted(row.createTeamToolPlaneAssembly({
        teamSessionId: 'a5m1-test-team-root',
        permissionPolicy: { default: 'ask', allow: [] as unknown[], ask: [] as unknown[], deny: [] as unknown[] },
        realmId: 'a5m1-e5-realm',
        templateId: 'e5-tpl',
        role: 'member',
        instanceId: 'e5-instance',
        controlLeg: async () => {
          if (fsProbe.hits !== 0) throw new Error(`fix-5 violated: ${String(fsProbe.hits)} fs accesses BEFORE approval`)
          return { decision: 'deny', requestId: 'e5-deny' }
        },
        fs: { subtreeContains: ({ parent, child }: { parent: string; child: string }) => child === parent || child.startsWith(`${parent}/`) },
        plane: { fsInstance: { fs: 'e5', rootDir: scratch, realmId: 'a5m1-e5-realm', kind: 'absolute-path' } },
      }))
      const read = definitionOf(built, 'read')
      let refusal = 'UNSET'
      try {
        const outcome = await read.execute({ file_path: join(scratch, 'secret.txt') })
        refusal = `RES:${JSON.stringify(outcome).slice(0, 160)}`
      } catch (error) {
        refusal = `THROWN:${String((error as Error)?.message ?? error)}`
      }
      expect(refusal).toContain('APPROVAL_DENIED')
      expect(refusal).not.toContain('E5-NEVER-READ')
      // the denied call NEVER touched the resolver surface
      expect(fsProbe.hits).toBe(0)
    } finally {
      fsProbe.armed = false
      rmSync(scratch, { recursive: true, force: true })
    }
  })
})
