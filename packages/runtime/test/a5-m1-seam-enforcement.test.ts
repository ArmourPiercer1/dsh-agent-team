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
// the guard's own assurance producer: the fixture's live tuple must be the
// shape the guard stamps (tool-dispatch/install.ts:1150-1163), never a hand-made one.
import { untestedAssurance } from '../tool-dispatch/index.js'

// REVIEW-R1 B1 (R-REM-2.2 / FIX-K K3): the kernel lifecycle port is ONLY the
// dispatcher's ledger — production passes the Guard handle's pendingCalls
// (agent-bindings). These executor-level legs never install a dispatcher, so
// this holder never settles a handle: the port reads the same wiring's honest
// empty-ledger zero. No family-local counter, no faked number.
const dispatchLedger: { current?: { pendingCalls(): readonly unknown[] } } = {}


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
          dispatcherLifecycle: { inflight: () => dispatchLedger.current?.pendingCalls().length ?? 0 },

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
          dispatcherLifecycle: { inflight: () => dispatchLedger.current?.pendingCalls().length ?? 0 },

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
  // final edge (the whole-object policy JSON compare against the mount's own
  // policy reader, and `readProviderIdentity()` compared with itself), and
  // M1-D deleted the single-name `entryOf(toolName)` lookup. What answers
  // NOW, at BOTH the request construction and the final edge, is the
  // registry's public call-level entry — keyed by the CALL identity, seeded
  // ONLY by this plane's own placement spelling. Root ruling on 091f56d37:
  // the AdmissionRequest carries the REAL dispatcher binding read at THIS
  // call (never the synthesized `plane-row:` identity), and the durable
  // manifest is only ever COMPARED afterwards — a correct manifest may never
  // become the precondition for reading the real binding.
  //
  // These legs drive the seam directly (the center's own consumption law);
  // every refusal leg pins zero body / zero grant / zero Control row, every
  // pass leg pins exactly one body. DISCLOSED, not bent: the real tuple
  // carries the DISPATCHER's generations (tool-dispatch/install.ts:1160 —
  // production 0 until PR2 feeds the overlay generation into the Binding),
  // while the kernel's identity leg compares it against THIS assembly's
  // durable overlay generation (tool-admission/admission-kernel.ts:245-254).
  // So these worlds answer generation 0 (the real durable state of a team
  // with no permission-overlay row); a world with an overlay row refuses at
  // admission with `authority-generation-drift` — production Ask is live
  // end-to-end only in a generation-0 world until PR2.
  const GEN = 0
  const EPOCH = 7
  const SCOPE = 'a5m1-c-scope'
  type SeamAnswer = { kind: 'call-facts' | 'no-approval-question'; facts: Record<string, unknown> } | undefined
  type SeamInput = Record<string, unknown>
  type PlaneFace = {
    definitions: readonly SeamToolDef[]
    governance?: { policyDocument: () => unknown; denySources: () => unknown }
    livePaPlan?: Map<string, unknown>
  }
  const planeOf = (mount: SeamMount): PlaneFace => {
    if (mount.ok !== true) throw new Error(`mount refused: ${String(mount.error?.code ?? '?')} ${String(mount.error?.message ?? '')}`)
    return mount.value as unknown as PlaneFace
  }
  /** The LIVE dispatcher tuple of this plane's own `read` row, field for
   *  field as the guard stamps it (tool-dispatch/install.ts:1150-1163) — the
   *  identity family is `team-own:<agentScopeKey>:<placed name>`, revision
   *  comes from what is in force, the generations are the dispatcher's. */
  const liveBinding = (generation: number, over: Record<string, unknown> = {}): Record<string, unknown> => ({
    bindingId: `team-own:${SCOPE}:read`,
    agentScopeKey: SCOPE,
    toolName: 'read',
    definitionIdentity: 'sha256:placed-definition',
    providerId: 'dsh-agent-team',
    implementationOrigin: 'team-trusted-extension',
    executionBoundary: 'trusted-host',
    assurance: untestedAssurance('team-trusted-extension', 'trusted-host'),
    policyGeneration: 0,
    // the DISPATCHER's counter — what the guard stamped at install (the
    // awaited durable read, A1) and what a refresh republishes (A3).
    authorityGeneration: generation,
    revision: 3,
    status: 'ACTIVE',
    ...over,
  })
  interface SeamWorld {
    /** the world's DURABLE overlay generation, as the one overlay port answers
     *  it; a leg advances it the way a real overlay write does. */
    readonly gen: { value: number; fault: 'none' | 'throw' | 'malformed' }
    /** What the LIVE dispatcher bindings of this scope carry — what the Guard
     *  was installed with, and what the owner's publish batch moves. Every
     *  revise bumps that entry's revision, exactly as
     *  `tool-dispatch/scoped-dispatcher.ts:296-335` does. */
    readonly scope: { value: number; revision: number }
    /** The fixture's stand-in for the ASSEMBLY OWNER's publish
     *  (`publishAuthorityGeneration` in agent-bindings): `publish: false` is a
     *  scope nobody refreshed, `fault: 'throw'` is a leg that refuses, `names`
     *  is what its synchronous batch covers. */
    readonly owner: { publish: boolean; fault: 'none' | 'throw'; names: string[] }
    /** ONE ordered log of every seam event — `durable-read`, `entry-read`,
     *  `leg:<g>`, `leg:<g>:threw`, `revalidate`, `revise:<name>` — because every
     *  ordering law below (leg BEFORE the entry read, revalidate BEFORE the
     *  batch, NOTHING after the verifier's read) is an ordering law. */
    readonly events: string[]
    /** set by a leg to park a call INSIDE the Control leg (the concurrency
     *  fixture: a second call's publish landing while the first waits). */
    readonly gate: { fn: (() => Promise<void>) | undefined }
    readonly plane: PlaneFace
    readonly scratch: string
    readonly target: string
    readonly observe: string[]
    /** every input the plane handed the call-level entry, in call order */
    readonly asked: SeamInput[]
    /** every AdmissionRequest the row path reached the leg with */
    readonly requests: Record<string, unknown>[]
    setSeam: (fn: (input: SeamInput, read: number) => SeamAnswer | Promise<SeamAnswer>) => void
    readonly done: () => void
  }
  async function seamWorld(opts: {
    readonly lane: 'ask' | 'allow'
    readonly rowManifestBinding?: Record<string, unknown>
    readonly legOverrides?: Record<string, unknown>
    readonly resurrectDeletedReaders?: boolean
    /** `false` = this world has NO assembly owner mounted to publish (the shape
     *  of a plane mounted without a Guard): the leg is not passed at all. */
    readonly withLeg?: boolean
  }): Promise<SeamWorld> {
    const scratch = mkdtempSync(join(tmpdir(), 'a5m1-c-'))
    const target = join(scratch, 'target.txt')
    writeFileSync(target, 'alpha5-m1-seam-bytes\n')
    const observe: string[] = []
    const asked: SeamInput[] = []
    const requests: Record<string, unknown>[] = []
    const gen = { value: GEN, fault: 'none' as 'none' | 'throw' | 'malformed' }
    const scope = { value: GEN, revision: 3 }
    const owner = { publish: true, fault: 'none' as 'none' | 'throw', names: ['read', 'team_bash', 'team_grep'] }
    const events: string[] = []
    const gate: { fn: (() => Promise<void>) | undefined } = { fn: undefined }
    let seam: (input: SeamInput, read: number) => SeamAnswer | Promise<SeamAnswer> = () => undefined
    // production-isomorphic read world (a5-m1-read-c1c2's law): an `any`
    // whole-tool rule projects ONLY its tool-invoke arm, so the resource
    // effect rides a SUBTREE rule over the governed root, with the
    // containment seam wired below. `lane: 'allow'` admits WITHOUT a Control
    // row; `lane: 'ask'` opens the durable ask for the same set.
    const readRule = { tool: 'read', resource: { kind: 'subtree', path: scratch } }
    const policy = opts.lane === 'ask'
      ? { default: 'deny', allow: [] as unknown[], ask: [readRule] as unknown[], deny: [] as unknown[] }
      : { default: 'deny', allow: [readRule] as unknown[], ask: [] as unknown[], deny: [] as unknown[] }
    // the C1 stand-in leg (no durable row, real kernel landing) wrapped so the
    // AdmissionRequest it was handed stays inspectable, and so a leg can
    // hand back a manifest binding of ANOTHER family (the C11 falsifier).
    const inner = approvingControlLeg()
    const leg = async (input: Record<string, unknown>) => {
      requests.push(input.request as Record<string, unknown>)
      const result = await inner(input)
      // the concurrency fixture parks a call AFTER its grant landed and BEFORE
      // the plane consumes it: a MINTED, UNSPENT grant crossing a publish.
      if (gate.fn !== undefined && (result as Record<string, unknown> | undefined)?.grant !== undefined) await gate.fn()
      return opts.rowManifestBinding === undefined
        ? result
        : { ...(result as Record<string, unknown>), manifest: { binding: opts.rowManifestBinding } }
    }
    const plane = planeOf(row.createTeamToolPlaneAssembly({
          dispatcherLifecycle: { inflight: () => dispatchLedger.current?.pendingCalls().length ?? 0 },

      teamSessionId: 'a5m1-test-team-root',
      permissionPolicy: policy,
      realmId: 'a5m1-c-realm', templateId: 'c-tpl', role: 'member', instanceId: 'c-instance',
      controlLeg: leg,
      // the ONE durable overlay port — the same source the assembly's
      // authorityGeneration is configured with; the final edge re-reads it FOR
      // THIS call and the fresh facts must agree with it.
      // THE durable overlay port of this world: one answer per read, and it
      // can fault exactly the way a real one does (throw / malformed row).
      authorityFacts: {
        overlayGeneration: async () => {
          events.push('durable-read')
          if (gen.fault === 'throw') throw new Error('overlay latest refused (fixture)')
          if (gen.fault === 'malformed') return 'generation-seventeen' as unknown as number
          return gen.value
        },
        // THE NAMED assembly-write leg of production
        // (`authorityFacts.ensureAuthorityCurrent`, a SIBLING of the reader
        // above): the plane hands it the generation THIS admission just read,
        // and the owner answers by revalidating and revising the whole scope.
        // Standing number unchanged ⇒ ZERO action, exactly like the real
        // `publishAuthorityGeneration`; the batch is synchronous here because it
        // is synchronous there.
        ...(opts.withLeg === false ? {} : {
          ensureAuthorityCurrent: async (teamSessionId: string, memberInstanceId: string, g: number) => {
            if (teamSessionId !== 'a5m1-test-team-root' || memberInstanceId !== 'c-instance') {
              throw new Error(`fixture leg was asked for ${teamSessionId}/${memberInstanceId} — this mount is published under a5m1-test-team-root/c-instance`)
            }
            if (owner.fault === 'throw') {
              events.push(`leg:${String(g)}:threw`)
              throw new Error('fixture leg: the owner refused to publish (no binding moves)')
            }
            events.push(`leg:${String(g)}`)
            if (!owner.publish || scope.value === g) return
            events.push('revalidate')
            for (const name of owner.names) {
              events.push(`revise:${name}`)
              scope.revision += 1
            }
            scope.value = g
          },
        }),
      },
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
      // A5-M1 B/C/D: the ONE public call-level entry (agent-bindings wires
      // exactly this function). The plane hands it the CALL identity and its
      // own placement spelling; every input it receives is recorded here so
      // the anti-circular law (never a row bindingId as a read input) is a
      // fact this file can falsify.
      readCallFacts: async (input: SeamInput) => {
        events.push('entry-read')
        asked.push(input)
        return await seam(input, asked.length)
      },
      fs: { subtreeContains: ({ parent, child }: { parent: string; child: string }) => child === parent || child.startsWith(`${parent}/`) },
      plane: { fsInstance: { fs: 'c', rootDir: scratch, realmId: 'a5m1-c-realm', kind: 'absolute-path' } },
      onObserve: (r: unknown) => { observe.push(String(r)) },
    }))
    return {
      plane, scratch, target, observe, asked, requests, gen, scope, owner, events,
      gate,
      setSeam: (fn) => { seam = fn },
      done: () => rmSync(scratch, { recursive: true, force: true }),
    }
  }
  /** A COMPLETE answer for the call the seam was asked about: the live
   *  dispatcher tuple of this plane's own row plus the plane's own live plan
   *  (never an invented approval identity). `over` is the single member the
   *  leg drifts — the failure under test. */
  const answerFor = (world: SeamWorld, input: SeamInput, kind: 'call-facts' | 'no-approval-question', over: Record<string, unknown> = {}): SeamAnswer => {
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
      binding: liveBinding(world.scope.value, { revision: world.scope.revision }),
      // string identity, per the permission lane's own binding tuple
      blueprint: { revision: '1', contentHash: 'sha256:bp', templateId: 'c-tpl', cwd: '/work', providerVersion: 'pv-1' },
      authorityGeneration: world.gen.value,
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
  /** the seam answer that carries a DRIFTED live tuple (one field moved) */
  const driftedAnswer = (world: SeamWorld, input: SeamInput, kind: 'call-facts' | 'no-approval-question', over: Record<string, unknown>): SeamAnswer =>
    answerFor(world, input, kind, { binding: liveBinding(world.gen.value, over) })

  const outcome = async (fn: () => Promise<unknown>): Promise<string> => {
    try { return JSON.stringify(await fn()) } catch (error) { return `REJECT:${String((error as Error)?.message ?? error)}` }
  }
  const ranReads = (world: SeamWorld) => world.observe.filter((l) => l.includes('governed-read RAN')).length
  const runRead = async (world: SeamWorld, command = 'alpha5-probe') =>
    await outcome(async () => await definitionOf(world.plane, 'read').execute({ file_path: world.target, note: command }))

  it('C0 positive: the row path runs on the REAL binding the entry answered', async () => {
    const world = await seamWorld({ lane: 'ask' })
    world.setSeam((input) => answerFor(world, input, 'call-facts'))
    try {
      const wire = await runRead(world)
      expect(wire).toContain('alpha5-m1-seam-bytes')
      expect(ranReads(world)).toBe(1)
      // THE construction law: the AdmissionRequest the leg landed the grant on
      // carries the live dispatcher tuple — the family, the revision IN FORCE,
      // the placed definition identity — not the synthesized row identity and
      // not the constant revision 1.
      expect(world.requests.length).toBe(1)
      const binding = world.requests[0]?.binding as Record<string, unknown>
      expect(binding.bindingId).toBe(`team-own:${SCOPE}:read`)
      expect(binding.revision).toBe(3)
      expect(binding.definitionIdentity).toBe('sha256:placed-definition')
      expect(binding.status).toBe('ACTIVE')
      // ...and the durable row's manifest therefore agrees with the facts the
      // Control verifier compares against (pa-control-bridge.ts:742-753).
      // ANTI-CIRCULAR: no read input ever carried a row/manifest bindingId —
      // both reads were seeded by the plane's own placement spelling.
      expect(world.asked.length).toBeGreaterThanOrEqual(2)
      for (const askedInput of world.asked) expect(askedInput.bindingId).toBeUndefined()
      expect(world.asked[0]?.placementName).toBe('read')
    } finally { world.done() }
  })

  it('C1 the approved question moved (fresh planSnapshot names another case) => GRANT_STALE, zero bytes', async () => {
    const world = await seamWorld({ lane: 'ask' })
    world.setSeam((input, read) => read === 1
      ? answerFor(world, input, 'call-facts')
      : answerFor(world, input, 'call-facts', { planSnapshot: { approvalCaseId: 'a-different-case', effectSetFingerprint: 'sha256:other', perEffectRequired: ['member'] } }))
    try {
      const wire = await runRead(world)
      expect(wire).toContain('GRANT_STALE')
      expect(wire).not.toContain('alpha5-m1-seam-bytes')
      expect(ranReads(world)).toBe(0)
    } finally { world.done() }
  })

  it('C2 the rungs the approval covers are not the rungs standing now => GRANT_STALE (never a retroactive widening)', async () => {
    const world = await seamWorld({ lane: 'ask' })
    world.setSeam((input, read) => read === 1
      ? answerFor(world, input, 'call-facts')
      : answerFor(world, input, 'call-facts', { planSnapshot: { approvalCaseId: '', effectSetFingerprint: '', perEffectRequired: [] } }))
    try {
      const wire = await runRead(world)
      expect(wire).toContain('GRANT_STALE')
      expect(ranReads(world)).toBe(0)
    } finally { world.done() }
  })

  it('C3 no answerable binding behind this call: refused at CONSTRUCTION with the kernel identity code — zero admission, zero grant, zero Control row, zero body', async () => {
    const world = await seamWorld({ lane: 'ask' })
    world.setSeam(() => undefined)
    try {
      const wire = await runRead(world)
      expect(wire).toContain('TOOL_BINDING_UNVERIFIED')
      expect(wire).not.toContain('GRANT_STALE') // there is no grant to be stale
      expect(ranReads(world)).toBe(0)
      // zero Control row: the leg (the only path to a grant) was never reached
      expect(world.requests).toHaveLength(0)
      // one read only — the refusal happens before any admission work
      expect(world.asked).toHaveLength(1)
    } finally { world.done() }
  })

  it("C4 the facts generation disagrees with this call's durable re-read => GRANT_STALE (the last confirmed value is never carried over)", async () => {
    const world = await seamWorld({ lane: 'ask' })
    world.setSeam((input, read) => read === 1
      ? answerFor(world, input, 'call-facts')
      : answerFor(world, input, 'call-facts', { authorityGeneration: GEN + 5 }))
    try {
      const wire = await runRead(world)
      expect(wire).toContain('GRANT_STALE')
      expect(ranReads(world)).toBe(0)
    } finally { world.done() }
  })

  it('C5 the binding moved between the two reads (revision/identity drift) => GRANT_STALE; the tuple that crosses the consume edge is the one admitted', async () => {
    const world = await seamWorld({ lane: 'ask' })
    // first read (construction) r3, second read (final edge) r99 — a moved
    // identity is re-assembly, never consumption of the old grant.
    world.setSeam((input, read) => read === 1
      ? answerFor(world, input, 'call-facts')
      : driftedAnswer(world, input, 'call-facts', { revision: 99 }))
    try {
      const wire = await runRead(world)
      expect(wire).toContain('GRANT_STALE')
      expect(ranReads(world)).toBe(0)
      // the grant WAS minted (the leg ran) and was never spent
      expect(world.requests).toHaveLength(1)
      expect((world.requests[0]?.binding as Record<string, unknown>).revision).toBe(3)
    } finally { world.done() }
  })

  it('C5b a moved definition identity between the reads is stale too (a re-placed Definition is not the admitted one)', async () => {
    const world = await seamWorld({ lane: 'ask' })
    world.setSeam((input, read) => read === 1
      ? answerFor(world, input, 'call-facts')
      : driftedAnswer(world, input, 'call-facts', { definitionIdentity: 'sha256:some-other-placement' }))
    try {
      const wire = await runRead(world)
      expect(wire).toContain('GRANT_STALE')
      expect(ranReads(world)).toBe(0)
    } finally { world.done() }
  })

  it('C6 all-allow path (NO Control row): the fresh facts must still answer ALL-ALLOW for the WHOLE set', async () => {
    const world = await seamWorld({ lane: 'allow' })
    world.setSeam((input) => answerFor(world, input, 'no-approval-question', { policyDocument: { rules: [] } }))
    try {
      const wire = await runRead(world)
      expect(wire).toContain('GRANT_STALE')
      expect(wire).not.toContain('alpha5-m1-seam-bytes')
      expect(ranReads(world)).toBe(0)
    } finally { world.done() }
  })

  it('C6b all-allow path with a complete ALL-ALLOW answer runs the real body exactly once', async () => {
    const world = await seamWorld({ lane: 'allow' })
    world.setSeam((input) => answerFor(world, input, 'no-approval-question'))
    try {
      const wire = await runRead(world)
      expect(wire).toContain('alpha5-m1-seam-bytes')
      expect(ranReads(world)).toBe(1)
      // no row exists on this path: the entry was asked twice (construction +
      // final edge), both times by call identity + placement name only.
      expect(world.asked).toHaveLength(2)
      expect(world.requests).toHaveLength(0)
    } finally { world.done() }
  })

  it('C7 the DELETED authorities stay deleted: a wired policy getter / name lookup is never consulted', async () => {
    const world = await seamWorld({ lane: 'allow', resurrectDeletedReaders: true })
    world.setSeam((input) => answerFor(world, input, 'no-approval-question'))
    try {
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
          dispatcherLifecycle: { inflight: () => dispatchLedger.current?.pendingCalls().length ?? 0 },

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

  it('C9 the request identity comes from the live read, not from the row: a foreign manifest bindingId is COMPARED and refused, never used to look the binding up', async () => {
    // The leg hands back a manifest whose binding belongs to ANOTHER family
    // (exactly the 091f production shape, where the row rode `plane-row:…`).
    // The reads were already answered from the live surface, so the call
    // cannot be staled for lack of a binding — it is staled because the row
    // names a binding this call does not stand on.
    const world = await seamWorld({ lane: 'ask', rowManifestBinding: { bindingId: 'plane-row:c-tpl:read', revision: 1 } })
    world.setSeam((input) => answerFor(world, input, 'call-facts'))
    try {
      const wire = await runRead(world)
      expect(wire).toContain('GRANT_STALE')
      expect(ranReads(world)).toBe(0)
      // falsifier for "read the binding THROUGH the row": the manifest's
      // bindingId never appears as an input to the entry.
      for (const askedInput of world.asked) {
        expect(askedInput.bindingId).toBeUndefined()
        expect(JSON.stringify(askedInput)).not.toContain('plane-row:')
      }
      // and the request the grant was minted on is still the live tuple
      expect((world.requests[0]?.binding as Record<string, unknown>).bindingId).toBe(`team-own:${SCOPE}:read`)
    } finally { world.done() }
  })

  it('C10 an unverifiable carrier (no answer at the second read) never consumes the admitted grant', async () => {
    const world = await seamWorld({ lane: 'ask' })
    world.setSeam((input, read) => read === 1 ? answerFor(world, input, 'call-facts') : undefined)
    try {
      const wire = await runRead(world)
      expect(wire).toContain('GRANT_STALE')
      expect(ranReads(world)).toBe(0)
      expect(world.requests).toHaveLength(1)
    } finally { world.done() }
  })
  // ── THE generation seam (root ruling, same HEAD as the real-binding
  // replacement). The Guard's bindings and this assembly's generation come from
  // ONE durable reader; the kernel's equality leg stays EXACT
  // (tool-admission/admission-kernel.ts:245-254, unrelaxed); and a new
  // admission never rides a generation an earlier call read.
  //
  // THE GAP THESE LEGS CLOSE (Host639): the delivery boundary
  // (`prepareAgentForRequest`) runs only where a NEW INPUT is delivered, while
  // `paAdmitBody` is the ONE funnel every governed call passes — so the 2nd..N-th
  // LLM step of one turn, and every wake that reaches admission without a
  // delivery, used to capture its AdmissionRequest on a binding the Guard had
  // stamped with a generation the overlay had already moved past, and the kernel
  // refused it until the next user input. The fix is the NAMED assembly-write leg
  // `authorityFacts.ensureAuthorityCurrent` (a SIBLING of the `overlayGeneration`
  // reader, never folded into it): the plane hands the mount's owner the
  // generation THIS call just read, and the owner publishes it — before the
  // call-level entry is asked, so the tuple this call admits on is already the
  // standing one.
  it('G1 the SAME TURN: a second admission reads its own generation, the owner publishes it BEFORE the entry read, and the old generation is gone from its request', async () => {
    const world = await seamWorld({ lane: 'ask' })
    world.setSeam((input) => answerFor(world, input, 'call-facts'))
    try {
      expect(await runRead(world, 'first')).toContain('alpha5-m1-seam-bytes')
      // the overlay moves mid-turn (a real permission-overlay row is written).
      world.gen.value = 5
      expect(await runRead(world, 'second')).toContain('alpha5-m1-seam-bytes')
      // a THIRD admission with nothing moved: the leg is asked and does NOTHING
      // (the standing number already answers it) — no revision churn.
      expect(await runRead(world, 'third')).toContain('alpha5-m1-seam-bytes')
      expect(ranReads(world)).toBe(3)

      const generations = world.requests.map((r) => (r.binding as Record<string, unknown>).authorityGeneration)
      expect(generations).toEqual([0, 5, 5])
      // the OLD confirmed value never rides a new request: after the advance,
      // nothing this call hands the kernel still says 0.
      expect(JSON.stringify(world.requests[1]?.binding)).not.toContain('"authorityGeneration":0')
      expect(JSON.stringify(world.requests[2]?.binding)).not.toContain('"authorityGeneration":0')

      // THE ORDER, pinned as one exact sequence (no leg, no revalidate, no revise
      // may appear anywhere else):
      //  · `durable-read` twice per call — the construction read and the
      //    execution edge's mandated fresh re-read, and the leg adds NO third
      //    read (the leg is served from the number construction read);
      //  · `leg:<g>` strictly BEFORE the call-level entry read, with the number
      //    that read just answered;
      //  · `revalidate` strictly BEFORE the batch, and the batch CONTIGUOUS over
      //    the whole scope (`team_bash`/`team_grep` move although this turn only
      //    ever called `read` — refreshing `read` alone would leave `bash`
      //    refused forever) with no read interleaved (a synchronous batch);
      //  · NOTHING after the last `entry-read`: the verifier only reads, it never
      //    publishes its own drift away.
      expect(world.events).toEqual([
        // the mount's one-shot preflight kick (a read, never a carried value)
        'durable-read',
        'durable-read', 'leg:0', 'entry-read', 'durable-read', 'entry-read',
        'durable-read', 'leg:5', 'revalidate', 'revise:read', 'revise:team_bash', 'revise:team_grep', 'entry-read', 'durable-read', 'entry-read',
        'durable-read', 'leg:5', 'entry-read', 'durable-read', 'entry-read',
      ])
    } finally { world.done() }
  })

  it('G2 the overlay advanced and NOBODY republished this scope: the kernel identity leg REFUSES (the plane never re-stamps a generation to make a pair)', async () => {
    const world = await seamWorld({ lane: 'ask' })
    world.owner.publish = false
    world.setSeam((input) => answerFor(world, input, 'call-facts'))
    world.gen.value = 5
    try {
      const wire = await runRead(world)
      expect(wire).toContain('TOOL_BINDING_UNVERIFIED')
      expect(wire).toMatch(/generation/i)
      expect(ranReads(world)).toBe(0)
      // no grant, no Control row: the leg was never reached
      expect(world.requests).toHaveLength(0)
    } finally { world.done() }
  })

  it('G2b a plane with NO assembly owner mounted to publish answers the same refusal (the absent leg is not a licence to pair)', async () => {
    const world = await seamWorld({ lane: 'ask', withLeg: false })
    world.setSeam((input) => answerFor(world, input, 'call-facts'))
    world.gen.value = 5
    try {
      const wire = await runRead(world)
      expect(wire).toContain('TOOL_BINDING_UNVERIFIED')
      expect(ranReads(world)).toBe(0)
      expect(world.requests).toHaveLength(0)
      // nothing was ever published in this world
      expect(world.events.filter((e) => e.startsWith('revise:'))).toHaveLength(0)
    } finally { world.done() }
  })

  it('G3 a faulting durable read at admission refuses, WITHDRAWS the confirmed generation, and the next successful read answers its own g', async () => {
    const world = await seamWorld({ lane: 'ask' })
    world.setSeam((input) => answerFor(world, input, 'call-facts'))
    try {
      expect(await runRead(world, 'first')).toContain('alpha5-m1-seam-bytes')
      world.gen.fault = 'throw'
      const refused = await runRead(world, 'while-faulting')
      expect(refused).toContain('TOOL_BINDING_UNVERIFIED')
      expect(refused).toMatch(/previously confirmed value is withdrawn/)
      expect(ranReads(world)).toBe(1) // the second call ran nothing
      // the fault did NOT leave generation 0 in place, and it left no leg behind
      // either: the read-back advances and that call admits on 7 (never on the
      // earlier confirmation, and never on a value the faulting read half-gave).
      world.gen.fault = 'none'
      world.gen.value = 7
      expect(await runRead(world, 'after')).toContain('alpha5-m1-seam-bytes')
      expect((world.requests[1]?.binding as Record<string, unknown>).authorityGeneration).toBe(7)
      expect(ranReads(world)).toBe(2)
      expect(world.events.filter((e) => e.startsWith('leg:'))).toEqual(['leg:0', 'leg:7'])
    } finally { world.done() }
  })

  it('G4 a malformed durable generation is never read as 0: the admission refuses', async () => {
    const world = await seamWorld({ lane: 'ask' })
    world.setSeam((input) => answerFor(world, input, 'call-facts'))
    world.gen.fault = 'malformed'
    try {
      const wire = await runRead(world)
      expect(wire).toContain('TOOL_BINDING_UNVERIFIED')
      expect(wire).toMatch(/never read as generation 0/)
      expect(ranReads(world)).toBe(0)
      expect(world.requests).toHaveLength(0)
      // a refused read never even reaches the publish leg
      expect(world.events.filter((e) => e.startsWith('leg:'))).toHaveLength(0)
    } finally { world.done() }
  })

  it('G5 a publish landing WHILE another call waits never renews THAT call: its minted grant is stale, never spent under the new generation', async () => {
    const world = await seamWorld({ lane: 'ask' })
    world.setSeam((input) => answerFor(world, input, 'call-facts'))
    let release: () => void = () => {}
    const held = new Promise<void>((resolve) => { release = resolve })
    let markParked: () => void = () => {}
    const parked = new Promise<void>((resolve) => { markParked = resolve })
    let armed = true
    // park ONLY the first call, inside the Control leg, after its grant request.
    world.gate.fn = async () => {
      if (!armed) return
      armed = false
      markParked()
      await held
    }
    try {
      const first = runRead(world, 'first') // admitted on g0 / the r3 tuple, grant LANDED
      await parked
      world.gen.value = 5 // the overlay moved mid-turn...
      // ...and THIS call's construction leg publishes it scope-wide, bumping the
      // revision of every binding in the family on the way.
      const second = await runRead(world, 'second')
      expect(second).toContain('alpha5-m1-seam-bytes')
      release()
      const firstWire = await first
      expect(firstWire).toContain('GRANT_STALE')
      // the minted grant was NEVER consumed under the republished identity: only
      // the second call ran a body, though both minted.
      expect(ranReads(world)).toBe(1)
      expect(world.requests).toHaveLength(2)
      expect((world.requests[0]?.binding as Record<string, unknown>).authorityGeneration).toBe(0)
    } finally { world.done() }
  })

  it('G6 a publish the owner REFUSES leaves the call UNPAIRED: the kernel answers it, and nothing moved', async () => {
    const world = await seamWorld({ lane: 'ask' })
    world.owner.fault = 'throw'
    world.setSeam((input) => answerFor(world, input, 'call-facts'))
    world.gen.value = 5
    try {
      const wire = await runRead(world)
      expect(wire).toContain('TOOL_BINDING_UNVERIFIED')
      expect(ranReads(world)).toBe(0)
      expect(world.requests).toHaveLength(0)
      // the fault is OBSERVED (not absorbed): the leg was asked, it threw, and no
      // binding moved — the call went on unpaired and the identity leg refused it.
      expect(world.events.filter((e) => e.includes(':threw'))).toHaveLength(1)
      expect(world.events.filter((e) => e.startsWith('revise:'))).toHaveLength(0)
      expect(world.observe.filter((l) => l.includes('a5m1-authority-leg'))).toHaveLength(1)
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
          dispatcherLifecycle: { inflight: () => dispatchLedger.current?.pendingCalls().length ?? 0 },

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
