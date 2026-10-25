/**
 * U6 PR2 resumed — R-REM-2 on the READ lane (GATE-LEDGER remediation row;
 * REMEDIATION-REVIEW-R1 items 3/5/6). Every leg drives the REAL machinery
 * the read path walks — the FIX-K kernel + registry, the pinned scoped
 * registry double, and the real `installScopedToolGuard` door — wired the
 * way `team-tool-plane.mjs` wires it: the pb §6 feed and the kernel guard
 * BOTH answer from the ONE approval table, every consult scoped.
 *
 * The six R-REM-2 proofs:
 *   RR1 revoke ⇒ REFUSED BEFORE THE BODY (`kernel-pre-body-table-refusal`,
 *       zero bodies) — and the kernel says why: CANDIDATE_REVOKED;
 *   RR2 a cross-scope approval NEVER applies: the entry is
 *       (scopeKey, nativeName)-keyed, a foreign scope sees nothing, and a
 *       call on a lane whose table answer is another scope's row never
 *       reaches a Body;
 *   RR3 a FOREIGN same-name source never inherits the entry: after revoke +
 *       re-registration by another family the old binding reads GONE
 *       (pre-body refusal), the stale addApprovalEntry is NO_CANDIDATE, and
 *       only a fresh owner act bound to the foreign family re-authorizes;
 *   RR4 CONCURRENT consume presents to the port EXACTLY ONCE (FIX-K K2):
 *       the second in-flight call refuses `GRANT_IN_FLIGHT` with
 *       `portCalled:false`;
 *   RR5 a consume that FAILS still burns the id — no retry path exists on
 *       the read lane, and the kernel makes one impossible (`GRANT_REPLAY`,
 *       `portCalled:false`, portCalls stays 1);
 *   RR6 an ENFORCING kernel without the lifecycle port THROWS at
 *       construction, and a port reporting live work refuses `release()`
 *       (`LEASE_OPEN`) — no uncounted zero is ever claimed.
 */
import { describe, expect, it } from 'vitest'
import { installScopedToolGuard, definitionIdentityOf } from '../tool-dispatch/index.js'
import {
  createGovernedFamilyRegistry,
  createGovernanceKernel,
  type GovernedFamilyRegistry,
  type GovernanceKernel,
  type GrantConsumePort,
} from '../governance-center/index.js'
import { scopedRegistryDouble, type ScopedRegistryDouble } from './a5p1r-scoped-registry-double.js'

const REALM = 'u6pr2-rrem2-realm'
const SCOPE = 'u6pr2-rrem2-team-root:u6pr2-instance'
const FAMILY = 'dsh.fs-family'

type Guard = Extract<ReturnType<typeof installScopedToolGuard>, { ok: true }>['value']

/** A closed-schema contribution claiming `nativeNames` (FIX-K fixture form,
 *  source digest per hex char so a re-registration is digest-different). */
function contributionFor(familyId: string, nativeNames: readonly string[], hexChar: string) {
  const digest = hexChar.repeat(64)
  return {
    schemaVersion: { major: 1, minor: 0, patch: 0 },
    familyId,
    familyVersion: '1.0.0',
    source: { kind: 'family-owned' as const, selector: `lane:u6pr2:${familyId}`, digest },
    provider: { id: 'provider.u6pr2', digest },
    requiredCapabilities: [],
    optionalCapabilities: [],
    visibility: { owner: 'family' as const, nativeNames: [...nativeNames], aliases: [], profileRequirements: [] },
    definition: { owner: 'family' as const, inputContractDigest: digest, outputContractDigest: digest, normalization: 'pure' as const },
    effects: { declared: false, kinds: [], targets: [] },
    execution: { declared: false, via: 'family-body' as const },
    lifecycle: { owner: 'kernel' as const, drain: 'kernel-owned' as const, cancelBoundary: 'host-signal' },
    result: { envelope: 'host' as const, correlation: 'kernel' as const },
    obligations: { admission: 'kernel' as const, grantMint: 'kernel' as const, grantConsume: 'kernel' as const },
  }
}

function liveDefinition(double: ScopedRegistryDouble): object {
  const get = double.ctx.tools.get as unknown as (name: string, scope?: unknown) => unknown
  const found = get('read', { id: 'agent-m1' }) ?? get('read', 'agent-m1') ?? get('read')
  if (found === undefined || found === null) throw new Error('rrem2: tools.get resolved no read definition')
  return found as object
}

type Lane = {
  double: ScopedRegistryDouble
  handle: Guard
  registry: GovernedFamilyRegistry
  kernel: GovernanceKernel
  identity: string
  observations: () => readonly string[]
}

/**
 * The plane's read mount, reproduced at the SAME seams the production glue
 * uses: a live registry candidate for `dsh.fs-family`, an ACTIVE ENFORCING
 * kernel (with a lifecycle port — construction fails without one), and the
 * feed + guard answering from the table, scoped. `scopeKey` overrides WHICH
 * scope the lane binds for (RR2's foreign-scope lane).
 */
function lane(opts: { scopeKey?: string; inflight?: () => number } = {}): Lane {
  const scopeKey = opts.scopeKey ?? SCOPE
  const double = scopedRegistryDouble({ globalNames: ['grep'] })
  double.registerOwn('read', 'V1.read')
  const registry = createGovernedFamilyRegistry({ kernelManifest: { capabilities: {} } })
  const kernel = createGovernanceKernel({
    registry,
    mode: 'enforcing',
    ports: { lifecycle: { inflight: opts.inflight ?? (() => 0) } },
  })
  const published = kernel.publish()
  if (!published.ok) throw new Error(`rrem2: kernel publish refused: ${published.code}`)
  const landed = registry.register(contributionFor(FAMILY, ['read'], 'a'), { origin: 'reviewed-manifest' })
  if (!landed.ok) throw new Error(`rrem2: fixture register refused: ${landed.detail}`)
  const identity = definitionIdentityOf(liveDefinition(double))!
  // bind-ONCE, exactly like the plane's ensureReadApprovalEntry.
  let attempted = false
  const tableEntry = () => {
    const existing = kernel.approvalFor(scopeKey, 'read')
    if (existing !== undefined) return existing
    if (attempted) return undefined
    attempted = true
    const added = kernel.addApprovalEntry({ scopeKey, nativeName: 'read', definitionIdentity: identity, familyId: FAMILY })
    if (!added.ok) return undefined
    return kernel.approvalFor(scopeKey, 'read')
  }
  const globalSchemas = (double.ctx.tools.schemas as (scope?: unknown) => readonly { name: string }[])(undefined)
  const outcome = installScopedToolGuard({
    agentCtx: double.ctxFor('agent-m1'),
    runtimeAgent: { id: 'agent-m1' },
    agentScopeKey: 's-agent-m1',
    trustedIdentities: ['agent-m1'],
    nativeNames: (globalSchemas ?? []).map((row) => row.name),
    maskedNames: [],
    assemblyOwnedNames: ['read'],
    realmId: REALM,
    bindingFeed: (name) =>
      name === 'read' && tableEntry() !== undefined
        ? { definitionIdentity: tableEntry()!.definitionIdentity, realmId: REALM }
        : undefined,
    kernelGuard: {
      owns: (name: string) => name === 'read',
      identityFor: (name: string) => (name === 'read' ? kernel.approvalFor(scopeKey, name)?.definitionIdentity ?? null : null),
    },
  })
  if (!outcome.ok) throw new Error(`rrem2 plant install refused: ${outcome.error.code} ${outcome.error.message}`)
  const boundOwn = outcome.value.bindOwnTools(['read'])
  if (!boundOwn.ok) throw new Error(`rrem2 bind refused: ${boundOwn.error.message}`)
  const pub = outcome.value.publish()
  if (!pub.ok) throw new Error(`rrem2 publish refused: ${pub.error.message}`)
  return {
    double,
    handle: outcome.value,
    registry,
    kernel,
    identity,
    observations: () => outcome.value.observations().map((row) => String(row.event)),
  }
}

describe('u6-pr2 R-REM-2 — the read lane on the FIXED kernel', () => {
  it('RR1 revoke invalidates the binding: the NEXT call is refused BEFORE its Body (zero effects)', async () => {
    const l = lane()
    // Positive control first: with the binding live, the Body runs once.
    const before = await l.double.runCall({ callId: 'rr1-a', name: 'read' })
    expect(before.bodies).toEqual(['V1.read'])
    // The owner-surface revoke — the act `dropApprovalsForFamily` mirrors at
    // dispose. The table entry is candidate-bound, so it now reads GONE.
    expect(l.registry.revoke(FAMILY, 'rrem2: RR1 revoke').ok).toBe(true)
    expect(l.kernel.approvalFor(SCOPE, 'read')).toBeUndefined()
    const after = await l.double.runCall({ callId: 'rr1-b', name: 'read' })
    expect(after.bodies, 'a revoked approval executes NOTHING').toEqual([])
    expect(after.threw).toContain('center approval table no longer backs')
    expect(l.observations()).toContain('kernel-pre-body-table-refusal')
    // and the kernel states the cause, scoped:
    const verdict = l.kernel.decide({ scopeKey: SCOPE, nativeName: 'read', definitionIdentity: l.identity })
    expect(verdict.outcome).toBe('refuse')
    if (verdict.outcome === 'refuse') expect(verdict.code).toBe('CANDIDATE_REVOKED')
  })

  it('RR2 an approval minted in one scope never applies to another (keyed by (scopeKey, name))', async () => {
    const l = lane()
    // The lane scope's entry exists (bound at install through the feed).
    expect(l.kernel.approvalFor(SCOPE, 'read')?.definitionIdentity).toBe(l.identity)
    // A call whose scoped resolution is a DIFFERENT scopeKey — same name,
    // same identity string — has no entry: no allow, ever, and the scoped
    // read surface is silent for it.
    const verdict = l.kernel.decide({ scopeKey: 'victim-scope:other-inst', nativeName: 'read', definitionIdentity: l.identity })
    expect(verdict.outcome).not.toBe('allow')
    if (verdict.outcome === 'defer') expect(verdict.code).toBe('NO_APPROVAL_ENTRY')
    expect(l.kernel.approvalFor('victim-scope:other-inst', 'read')).toBeUndefined()
    // A lane that can only see the FOREIGN scope's row (no entry of its own)
    // never binds: the guard's bind-time check refuses, so no call of that
    // lane ever reaches a Body.
    const foreign = createGovernedFamilyRegistry({ kernelManifest: { capabilities: {} } })
    foreign.register(contributionFor(FAMILY, ['read'], 'a'), { origin: 'reviewed-manifest' })
    const foreignKernel = createGovernanceKernel({ registry: foreign, mode: 'enforcing', ports: { lifecycle: { inflight: () => 0 } } })
    foreignKernel.publish()
    expect(foreignKernel.addApprovalEntry({ scopeKey: 'root-A:inst-1', nativeName: 'read', definitionIdentity: l.identity, familyId: FAMILY }).ok).toBe(true)
    const double = scopedRegistryDouble({ globalNames: ['grep'] })
    double.registerOwn('read', 'V1.read')
    const globalSchemas = (double.ctx.tools.schemas as (scope?: unknown) => readonly { name: string }[])(undefined)
    const outcome = installScopedToolGuard({
      agentCtx: double.ctxFor('agent-m1'),
      runtimeAgent: { id: 'agent-m1' },
      agentScopeKey: 's-agent-m1',
      trustedIdentities: ['agent-m1'],
      nativeNames: (globalSchemas ?? []).map((row) => row.name),
      maskedNames: [],
      assemblyOwnedNames: ['read'],
      realmId: REALM,
      bindingFeed: (name) =>
        name === 'read'
          ? { definitionIdentity: foreignKernel.approvalFor(SCOPE, 'read')?.definitionIdentity ?? 'def#never-bound', realmId: REALM }
          : undefined,
      kernelGuard: { owns: (n: string) => n === 'read', identityFor: (n: string) => foreignKernel.approvalFor(SCOPE, n)?.definitionIdentity ?? null },
    })
    expect(outcome.ok).toBe(true)
    if (!outcome.ok) return
    const boundOwn = outcome.value.bindOwnTools(['read'])
    expect(boundOwn.ok, 'a feed pointing at another scope\'s (absent) row cannot bind').toBe(false)
    const run = await double.runCall({ callId: 'rr2-run', name: 'read' })
    expect(run.bodies).toEqual([])
  })

  it('RR3 a foreign same-name source never inherits the old entry; only a fresh bound owner act re-authorizes', async () => {
    const l = lane()
    const before = await l.double.runCall({ callId: 'rr3-a', name: 'read' })
    expect(before.bodies).toEqual(['V1.read'])
    expect(l.registry.revoke(FAMILY, 'rrem2: RR3 revoke').ok).toBe(true)
    // A DIFFERENT family re-claims the same native name (its own reviewed
    // registration, its own source digest).
    const foreignReg = l.registry.register(contributionFor('foreign.read-shop', ['read'], 'c'), { origin: 'reviewed-manifest' })
    expect(foreignReg.ok).toBe(true)
    // The old (scope, name) binding reads GONE — never auto-rebound by the
    // lookup, never inherited across the source change:
    expect(l.kernel.approvalFor(SCOPE, 'read')).toBeUndefined()
    const run = await l.double.runCall({ callId: 'rr3-b', name: 'read' })
    expect(run.bodies, 'the foreign source is NOT covered by the old family\'s approval').toEqual([])
    // An owner attempt re-binding the OLD family is dead authority:
    const stale = l.kernel.addApprovalEntry({ scopeKey: SCOPE, nativeName: 'read', definitionIdentity: l.identity, familyId: FAMILY })
    expect(stale.ok).toBe(false)
    // Either refusal shape is the SAME law said at a different moment: the
    // dead family's candidate is gone (NO_CANDIDATE), or its invalidated row
    // still HOLDS the (scope, name) key and blocks resurrection (DUP) — in
    // both cases the old approval cannot come back through `add`; a reviewed
    // re-approval is `replaceApprovalEntry` with the NEW candidate bound.
    if (stale.ok === false) expect(['NO_CANDIDATE', 'DUP_APPROVAL_ENTRY']).toContain(stale.code)
    // Only a fresh owner act re-authorizes — and it is TWO owner-surface
    // acts, which is the point: the deterministic family drop (what the
    // plane's dispose runs next to `revoke`) clears the dead row that still
    // HOLDS the (scope, name) key, then a NEW approval bound to the FOREIGN
    // candidate re-binds. A lookup can never take either shortcut.
    expect(l.kernel.dropApprovalsForFamily(FAMILY)).toBe(1)
    const fresh = l.kernel.addApprovalEntry({ scopeKey: SCOPE, nativeName: 'read', definitionIdentity: l.identity, familyId: 'foreign.read-shop' })
    expect(fresh.ok).toBe(true)
    const verdict = l.kernel.decide({ scopeKey: SCOPE, nativeName: 'read', definitionIdentity: l.identity })
    expect(verdict.outcome).toBe('allow')
  })

  it('RR4 two CONCURRENT consumes of one grant id present to the port EXACTLY once', async () => {
    // The SAME call the read consume site makes (`kernel.consumeOnce(grant,
    // grantId, facts)`), against the same FIXED kernel the plane mounts.
    let portCalls = 0
    let releaseGate: (v: { ok: boolean }) => void = () => undefined
    const gate = new Promise<{ ok: boolean }>((resolve) => { releaseGate = resolve })
    const grantConsume: GrantConsumePort = {
      async consumeForExecution() {
        portCalls += 1
        return gate
      },
    }
    const registry = createGovernedFamilyRegistry({ kernelManifest: { capabilities: {} } })
    const kernel = createGovernanceKernel({ registry, mode: 'enforcing', ports: { grantConsume, lifecycle: { inflight: () => 0 } } })
    kernel.publish()
    registry.register(contributionFor(FAMILY, ['read'], 'a'), { origin: 'reviewed-manifest' })
    const first = kernel.consumeOnce({ grantId: 'grant-rr4' }, 'grant-rr4', { name: 'read' })
    const second = kernel.consumeOnce({ grantId: 'grant-rr4' }, 'grant-rr4', { name: 'read' })
    const PENDING = Symbol('pending')
    const raced = await Promise.race([second, new Promise((r) => setTimeout(() => r(PENDING), 25))])
    expect(raced === PENDING).toBe(false)
    if (raced !== PENDING) {
      expect(raced.ok).toBe(false)
      expect(raced.code).toBe('GRANT_IN_FLIGHT')
      expect(raced.portCalled).toBe(false)
    }
    releaseGate({ ok: true })
    const firstDone = await first
    expect(firstDone.ok).toBe(true)
    expect(firstDone.portCalled).toBe(true)
    expect(portCalls).toBe(1)
  })

  it('RR5 a DENIED consume burns the id — the read lane has no retry and the kernel makes one impossible', async () => {
    let portCalls = 0
    const grantConsume: GrantConsumePort = {
      async consumeForExecution() {
        portCalls += 1
        return { ok: false, reason: 'APPROVAL_STALE:grant moved' }
      },
    }
    const registry = createGovernedFamilyRegistry({ kernelManifest: { capabilities: {} } })
    const kernel = createGovernanceKernel({ registry, mode: 'enforcing', ports: { grantConsume, lifecycle: { inflight: () => 0 } } })
    kernel.publish()
    const denied = await kernel.consumeOnce({ grantId: 'grant-rr5' }, 'grant-rr5', { name: 'read' })
    expect(denied.ok).toBe(false)
    expect(denied.portCalled).toBe(true)
    // The read consume site maps ANY non-portCalled verdict to a deny — it
    // never loops, never re-presents. A second consume (the shape any retry
    // WOULD take) is burned: `GRANT_REPLAY`, the port untouched.
    const retry = await kernel.consumeOnce({ grantId: 'grant-rr5' }, 'grant-rr5', { name: 'read' })
    expect(retry.ok).toBe(false)
    expect(retry.code).toBe('GRANT_REPLAY')
    expect(retry.portCalled).toBe(false)
    expect(portCalls).toBe(1)
  })

  it('RR6 enforcing WITHOUT the lifecycle port throws; WITH live work, release refuses (never a fake zero)', () => {
    const registry = createGovernedFamilyRegistry({ kernelManifest: { capabilities: {} } })
    expect(() => createGovernanceKernel({ registry, mode: 'enforcing' })).toThrow(/LIFECYCLE_PORT_MISSING/)
    expect(() => createGovernanceKernel({ registry, mode: 'enforcing', ports: {} })).toThrow(/LIFECYCLE_PORT_MISSING/)
    // A port that counts REAL work: release at a non-zero count refuses
    // LEASE_OPEN — the self-counted-zero law (CI-08) is the port's answer,
    // never an absence read as zero.
    let inflight = 2
    const kernel = createGovernanceKernel({ registry, mode: 'enforcing', ports: { lifecycle: { inflight: () => inflight } } })
    kernel.publish()
    kernel.beginDrain()
    kernel.tombstone()
    const blocked = kernel.release()
    expect(blocked.ok).toBe(false)
    if (blocked.ok === false) expect(blocked.code).toBe('LEASE_OPEN')
    expect(kernel.state()).toBe('TOMBSTONED')
    inflight = 0
    const released = kernel.release()
    expect(released.ok).toBe(true)
  })
})
