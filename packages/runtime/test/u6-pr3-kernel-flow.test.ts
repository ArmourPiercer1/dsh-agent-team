/**
 * U6 PR3 — ARC-B: read and bash share ONE Governance Kernel, ONE approval
 * table, ONE state-transition trace (center-assembly-architecture §10.2:
 * "read and bash share the same Kernel state transition trace … different
 * Executors but the same decision/settlement path").
 *
 * Three faces, three groups:
 *  A) the MOUNT surface — one kernel object owns BOTH governed names, the
 *     entries are (scopeKey, name)-keyed siblings bound to their own family
 *     candidates (one ledger, observable);
 *  B) the DECIDE matrix — the SAME refusal-code sequence for 'read' and
 *     'bash' through identically built kernels (the trace-shape law: an
 *     execution trace only shows codes, entryKey and generation — equal
 *     codes + equal shape = the same state transitions; only entryKey/
 *     familyId legitimately differ);
 *  C) the CONSUME edge — the shell contribution's grant rides the SAME
 *     consumeOnce one-shot laws (K2 sync in-flight, outcome-independent
 *     burn, replay refused BEFORE the port).
 */
import { describe, expect, it } from 'vitest'
import { approvingControlLeg } from './a5-m1-control-legs.mjs'
import { createGovernanceKernel, createGovernedFamilyRegistry } from '../governance-center/index.js'

const dispatchLedger: { current?: { pendingCalls(): readonly unknown[] } } = {}

const REALM = 'u6-pr3-arc-b-realm'

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
        { definitionIdentity: string; familyId: string; scopeKey: string } | undefined
      addApprovalEntry(input: Record<string, unknown>): { ok: boolean; code?: string }
      decide(call: { nativeName: string; scopeKey?: string; definitionIdentity?: string }):
        { outcome: string; code: string }
      consumeOnce(grant: Record<string, unknown>, grantId: string, facts: Record<string, unknown>):
        Promise<{ ok: boolean; code?: string; portCalled: boolean }>
      dropApprovalsForFamily(familyId: string): unknown
      beginDrain(): unknown
      tombstone(): unknown
      release(): unknown
    }
    readonly registry: {
      register(input: unknown, opts?: { origin?: string }): { ok: boolean; code?: string; detail?: string }
      revoke(familyId: string, reason?: string): unknown
      generation(): number
    }
    readonly scopeKey: string
    readonly familyIds: readonly string[]
  }
  readonly kernelGuard?: { owns(name: string): boolean; identityFor(name: string): string | null }
}
const planeModule = async (): Promise<PlaneModule> =>
  (await import(new URL('../src/plugin/live/team-tool-plane.mjs', import.meta.url).href)) as PlaneModule
const fsContributionModule = async () =>
  (await import(new URL('../../tools/fs-family/src/fs-read-contribution.mjs', import.meta.url).href)) as {
    buildFsReadContribution(input: Record<string, unknown>): unknown
  }
const procContributionModule = async () =>
  (await import(new URL('../../tools/process-family/src/bash-contribution.mjs', import.meta.url).href)) as {
    buildProcessShellContribution(input: Record<string, unknown>): Record<string, unknown>
  }

async function mountValue(over: Record<string, unknown> = {}): Promise<KernelPlaneValue> {
  const built = (await planeModule()).createTeamToolPlaneAssembly({
    dispatcherLifecycle: { inflight: () => dispatchLedger.current?.pendingCalls().length ?? 0 },
    teamSessionId: 'u6-pr3-test-team-root',
    controlLeg: approvingControlLeg(),
    fs: { subtreeContains: ({ parent, child }: { parent: string; child: string }) => child === parent || child.startsWith(parent + '/') },
    permissionPolicy: { default: 'deny', allow: [{ tool: 'read', resource: { kind: 'any' } }], ask: [], deny: [] },
    realmId: REALM,
    templateId: 'u6pr3-tpl',
    role: 'member',
    instanceId: 'u6pr3-instance',
    onObserve: () => {},
    plane: { fsInstance: { fs: 'u6pr3-ctl', rootDir: '/u6pr3-unit-root', realmId: REALM, kind: 'absolute-path' }, ...over },
  })
  if (!built.ok) throw new Error(`assembly refused: ${built.code} ${built.message ?? ''}`)
  return built.value as KernelPlaneValue
}

describe('u6-pr3 A — the mount carries ONE kernel owning BOTH names', () => {
  it('A1 one kernel, one table, two family entries: the ARC-B ledger is observable on the mount surface', async () => {
    const value = await mountValue()
    const center = value.centerKernel
    if (center === undefined) throw new Error('center kernel absent')
    expect(center.kernel.mode()).toBe('enforcing')
    expect(center.familyIds).toEqual(['dsh.fs-family', 'dsh.process-family'])
    const guard = value.kernelGuard
    if (guard === undefined) throw new Error('kernelGuard absent')
    // ONE guard owns BOTH governed spellings and NOTHING else.
    expect(guard.owns('read')).toBe(true)
    expect(guard.owns('team_bash')).toBe(true)
    expect(guard.owns('team_grep')).toBe(false)
    expect(guard.owns('team_glob')).toBe(false)
    expect(guard.owns('job_output')).toBe(false)
    // Feed consults MINT (pb §6) — then BOTH entries bind on the SAME
    // (scopeKey) row of the SAME table, each to its own family candidate.
    const fedRead = value.placementFeed('read')
    const fedBash = value.placementFeed('team_bash')
    expect(fedRead?.definitionIdentity).toMatch(/^def#\d+$/)
    expect(fedBash?.definitionIdentity).toMatch(/^def#\d+$/)
    expect(guard.identityFor('read')).toBe(fedRead?.definitionIdentity)
    expect(guard.identityFor('team_bash')).toBe(fedBash?.definitionIdentity)
    const readEntry = center.kernel.approvalFor(center.scopeKey, 'read')
    const bashEntry = center.kernel.approvalFor(center.scopeKey, 'team_bash')
    expect(readEntry?.familyId).toBe('dsh.fs-family')
    expect(bashEntry?.familyId).toBe('dsh.process-family')
    expect(bashEntry?.scopeKey).toBe(center.scopeKey)
    expect(readEntry?.scopeKey).toBe(center.scopeKey)
    // SIBLING entries, distinct names, distinct identities — one table.
    expect(readEntry?.definitionIdentity).not.toBe(bashEntry?.definitionIdentity)
  })

  it('A2 family-scoped invalidation on the shared table: dropping the shell family never touches the read entry (and revoke never resurrects)', async () => {
    const value = await mountValue()
    const center = value.centerKernel
    if (center === undefined) throw new Error('center kernel absent')
    value.placementFeed('read')
    value.placementFeed('team_bash')
    expect(center.kernel.approvalFor(center.scopeKey, 'team_bash')).toBeDefined()
    center.kernel.dropApprovalsForFamily('dsh.process-family')
    expect(center.kernel.approvalFor(center.scopeKey, 'team_bash'), 'shell entry deterministically dropped').toBeUndefined()
    expect(center.kernel.approvalFor(center.scopeKey, 'read'), 'the read entry is the OTHER family — untouched').toBeDefined()
    // Re-registration never resurrects the dropped shell entries (FIX-K K1).
    center.registry.register((await procContributionModule()).buildProcessShellContribution({
      definition: { name: 'team_bash', parameters: { type: 'object' }, execute: async () => ({ text: '' }) },
      cancelBoundary: 'unit',
    }), { origin: 'reviewed-manifest' })
    expect(center.kernel.approvalFor(center.scopeKey, 'team_bash'), 'a re-registered family never resurrects approvals').toBeUndefined()
  })
})

/** The decide matrix runner: identically built unit kernel for ONE family's
 *  name; returns the ordered code sequence of every state-transition leg. */
async function decideMatrix(name: 'read' | 'bash'): Promise<string[]> {
  const familyId = name === 'read' ? 'dsh.fs-family' : 'dsh.process-family'
  const registry = createGovernedFamilyRegistry({
    kernelManifest: { capabilities: {
      'fs-read': { backsExecution: 'family-body' },
      'process-spawn': { backsExecution: 'family-body' },
    } },
  })
  const contribution = name === 'read'
    ? (await fsContributionModule()).buildFsReadContribution({
        definition: { name, parameters: { type: 'object' }, execute: async () => ({ ok: true }) },
        executorFactory: async function unitExecutor() { return null },
        mechanics: { unitLaw: () => 1 },
        presentation: {},
        cancelBoundary: 'unit',
      })
    : (await procContributionModule()).buildProcessShellContribution({
        definition: { name, parameters: { type: 'object' }, execute: async () => ({ text: '' }) },
        cancelBoundary: 'unit',
      })
  const landed = registry.register(contribution, { origin: 'reviewed-manifest' })
  expect(landed.ok, `initial registration: ${JSON.stringify(landed)}`).toBe(true)
  const codes: string[] = []
  const kernel = createGovernanceKernel({
    registry,
    mode: 'enforcing',
    ports: { lifecycle: { inflight: () => 0 }, grantConsume: { consumeForExecution: async () => ({ ok: true }) } },
  })
  // (1) STATE FIRST: a not-ACTIVE kernel has no opinion for EITHER name.
  codes.push(kernel.decide({ nativeName: name, scopeKey: 'scope-1', definitionIdentity: 'def#1' }).code)
  expect(kernel.publish().ok).toBe(true)
  // (2) no entry for the scope → DEFER (no opinion) — identical posture.
  codes.push(kernel.decide({ nativeName: name, scopeKey: 'scope-1', definitionIdentity: 'def#1' }).code)
  // (3) FIX-K K4: no scope, no scoped opinion.
  codes.push(kernel.decide({ nativeName: name, definitionIdentity: 'def#1' }).code)
  // (4) bind the entry → allow.
  const added = kernel.addApprovalEntry({ scopeKey: 'scope-1', nativeName: name, definitionIdentity: 'def#1', familyId })
  expect(added.ok, `bind entry (${name}): ${JSON.stringify(added)}`).toBe(true)
  codes.push(kernel.decide({ nativeName: name, scopeKey: 'scope-1', definitionIdentity: 'def#1' }).code)
  // (5) identity drift → refusal, never a pass (CI-04).
  codes.push(kernel.decide({ nativeName: name, scopeKey: 'scope-1', definitionIdentity: 'def#2' }).code)
  // (6) unreadable current identity → refusal.
  codes.push(kernel.decide({ nativeName: name, scopeKey: 'scope-1' }).code)
  // (7) revoke → the bound entry dies on the NEXT decide (K1).
  registry.revoke(familyId, 'unit matrix')
  codes.push(kernel.decide({ nativeName: name, scopeKey: 'scope-1', definitionIdentity: 'def#1' }).code)
  // (8) re-registration → the old approval never carries over (STALE).
  const again = name === 'read'
    ? (await fsContributionModule()).buildFsReadContribution({
        definition: { name, parameters: { type: 'object' }, execute: async () => ({ ok: true }) },
        executorFactory: async function unitExecutorB() { return null },
        mechanics: { unitLaw: () => 2 },
        presentation: {},
        cancelBoundary: 'unit',
      })
    : (await procContributionModule()).buildProcessShellContribution({
        definition: { name, parameters: { type: 'object' }, execute: async () => ({ text: '' }) },
        launcherPin: 'unit-pin-b',
        cancelBoundary: 'unit',
      })
  const reReg = registry.register(again, { origin: 'reviewed-manifest' })
  expect(reReg.ok, `re-registration: ${JSON.stringify(reReg)}`).toBe(true)
  codes.push(kernel.decide({ nativeName: name, scopeKey: 'scope-1', definitionIdentity: 'def#1' }).code)
  // (9) dynamic source (never re-validated) → NO execution trust, scope-free.
  // The probe rides a SEPARATE fixture family (one claim per family): the
  // descriptor is the process builder's, re-keyed — the registration
  // validator checks SHAPE, and the NOT_VERIFIED_SOURCE law is about the
  // registration ORIGIN, which is exactly what this leg pins.
  const probe = {
    ...(await procContributionModule()).buildProcessShellContribution({
      definition: { name: 'unit-dyn-probe', parameters: { type: 'object' }, execute: async () => ({ text: '' }) },
      cancelBoundary: 'unit',
    }),
    familyId: 'u6.pr3-dyn-probe',
  }
  expect(registry.register(probe, { origin: 'dynamic-source' }).ok, 'dynamic registration is accepted but NOT_VERIFIED').toBe(true)
  codes.push(kernel.decide({ nativeName: 'unit-dyn-probe', scopeKey: 'scope-1', definitionIdentity: 'def#1' }).code)
  kernel.beginDrain()
  kernel.tombstone()
  kernel.release()
  return codes
}

describe('u6-pr3 B — ARC-B: the decide trace shape is IDENTICAL for read and bash', () => {
  it('B1 the nine-leg refusal-code sequence through the one-kernel decide algebra is the same for both families (only entryKey/familyId differ — invisible to the transition trace)', async () => {
    const readCodes = await decideMatrix('read')
    const bashCodes = await decideMatrix('bash')
    expect(readCodes).toEqual([
      'KERNEL_NOT_ACTIVE',
      'NO_APPROVAL_ENTRY',
      'SCOPE_UNVERIFIED',
      'OK',
      'IDENTITY_MISMATCH',
      'IDENTITY_UNVERIFIED',
      'CANDIDATE_REVOKED',
      'STALE_GENERATION',
      'NOT_VERIFIED_SOURCE',
    ])
    // THE ARC-B PROOF: byte-equal code sequence — read and bash produce the
    // SAME kernel state-transition trace (a trace shows only codes, the
    // (scopeKey, name) entryKey and the generation; identical code algebra
    // per leg = the same decision/settlement path).
    expect(bashCodes).toEqual(readCodes)
  }, 30_000)
})

describe('u6-pr3 C — the consume edge is the SAME one-shot law for the shell grant', () => {
  it('C1 consumeOnce on a shell-contribution grant: in-flight refuses, replay refuses AFTER burn regardless of outcome, the port sees exactly one presentation', async () => {
    const registry = createGovernedFamilyRegistry({
      kernelManifest: { capabilities: { 'process-spawn': { backsExecution: 'family-body' } } },
    })
    const registered = registry.register((await procContributionModule()).buildProcessShellContribution({
      definition: { name: 'bash', parameters: { type: 'object' }, execute: async () => ({ text: '' }) },
      cancelBoundary: 'unit',
    }), { origin: 'reviewed-manifest' })
    expect(registered.ok, JSON.stringify(registered)).toBe(true)
    let portCalls = 0
    let releaseGate: () => void = () => {}
    const gate = new Promise<void>((resolve) => { releaseGate = resolve })
    const kernel = createGovernanceKernel({
      registry,
      mode: 'enforcing',
      ports: {
        lifecycle: { inflight: () => 0 },
        grantConsume: {
          consumeForExecution: async () => {
            portCalls += 1
            await gate // hold the port in flight to exercise the K2 window
            return { ok: false, error: { code: 'APPROVAL_STALE', message: 'deny keeps its full legacy answer' } }
          },
        },
      },
    })
    expect(kernel.publish().ok).toBe(true)
    // K2: a second presentation while the first is IN FLIGHT is refused
    // before the port ever sees it again.
    const first = kernel.consumeOnce({ grantId: 'g-shell' }, 'g-shell', { callId: 'c-1' })
    const inflight = await kernel.consumeOnce({ grantId: 'g-shell' }, 'g-shell', { callId: 'c-2' })
    expect(inflight.ok).toBe(false)
    expect(inflight.code).toBe('GRANT_IN_FLIGHT')
    expect(inflight.portCalled).toBe(false)
    releaseGate()
    const settled = await first
    // The burn is OUTCOME-INDEPENDENT: a DENIED consumption is still spent.
    expect(settled.ok).toBe(false)
    expect(settled.portCalled).toBe(true)
    const replay = await kernel.consumeOnce({ grantId: 'g-shell' }, 'g-shell', { callId: 'c-3' })
    expect(replay.ok).toBe(false)
    expect(replay.code).toBe('GRANT_REPLAY')
    expect(replay.portCalled).toBe(false)
    expect(portCalls, 'the port saw EXACTLY one presentation').toBe(1)
  }, 30_000)

  it('C2 the same kernel burns a read grant and a shell grant INDEPENDENTLY (different grantIds, one ledger)', async () => {
    const registry = createGovernedFamilyRegistry({
      kernelManifest: { capabilities: {
        'fs-read': { backsExecution: 'family-body' },
        'process-spawn': { backsExecution: 'family-body' },
      } },
    })
    expect(registry.register((await fsContributionModule()).buildFsReadContribution({
      definition: { name: 'read', parameters: { type: 'object' }, execute: async () => ({ ok: true }) },
      executorFactory: async function unitExecutor() { return null },
      mechanics: { unitLaw: () => 1 },
      presentation: {},
      cancelBoundary: 'unit',
    }), { origin: 'reviewed-manifest' }).ok).toBe(true)
    expect(registry.register((await procContributionModule()).buildProcessShellContribution({
      definition: { name: 'bash', parameters: { type: 'object' }, execute: async () => ({ text: '' }) },
      cancelBoundary: 'unit',
    }), { origin: 'reviewed-manifest' }).ok).toBe(true)
    const seen: string[] = []
    const kernel = createGovernanceKernel({
      registry,
      mode: 'enforcing',
      ports: {
        lifecycle: { inflight: () => 0 },
        grantConsume: { consumeForExecution: async (_grant, facts) => { seen.push(String(facts?.callId)); return { ok: true } } },
      },
    })
    expect(kernel.publish().ok).toBe(true)
    const r1 = await kernel.consumeOnce({ grantId: 'g-read' }, 'g-read', { callId: 'call-read' })
    const b1 = await kernel.consumeOnce({ grantId: 'g-bash' }, 'g-bash', { callId: 'call-bash' })
    expect([r1.ok, b1.ok]).toEqual([true, true])
    const r2 = await kernel.consumeOnce({ grantId: 'g-read' }, 'g-read', { callId: 'call-read-2' })
    const b2 = await kernel.consumeOnce({ grantId: 'g-bash' }, 'g-bash', { callId: 'call-bash-2' })
    expect([r2.code, b2.code]).toEqual(['GRANT_REPLAY', 'GRANT_REPLAY'])
    expect(seen).toEqual(['call-read', 'call-bash'])
  }, 30_000)
})
