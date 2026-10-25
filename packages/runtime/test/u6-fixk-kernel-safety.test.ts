/**
 * FIX-K (U6 kernel safety, external audit 2026-10-26) — the four kernel-side
 * findings, each RED-first against master @ 2db321f63:
 *
 *  K1 REVOKE-BINDING: `decide()` never consulted registry state, so an
 *     approval entry survived `registry.revoke()` and even a re-registration
 *     at a new generation. Fix contract: every entry is bound to its owning
 *     candidate (familyId + registeredGeneration + source digest); a
 *     tombstoned/missing owner refuses `CANDIDATE_REVOKED`, a re-registration
 *     refuses `STALE_GENERATION`, and the kernel-owner surface can drop a
 *     family's entries (`dropApprovalsForFamily`).
 *  K2 CONSUME WINDOW: `consumeOnce()` burned the grant id only AFTER the
 *     awaited port resolved, so two concurrent calls both reached the port.
 *     Fix contract: the id is RESERVED synchronously before the await (an
 *     in-flight set); a second call while in flight refuses `GRANT_IN_FLIGHT`
 *     without touching the port; once PRESENTED the id is burned
 *     unconditionally (fail-closed — a presentation is one-shot, never an
 *     outcome-dependent one).
 *  K3 LIFECYCLE PORT: `release()` counted an absent lifecycle port as zero
 *     in-flight. Fix contract: an absent port refuses `LIFECYCLE_PORT_MISSING`
 *     (detail records `UNCOUNTED` — no clean zero is ever claimed for work
 *     that was never counted) in every mode; and the FACTORY refuses to build
 *     an `mode: 'enforcing'` kernel without the port at all.
 *  K4 SCOPE KEYING: the entries Map was keyed by nativeName alone, so an
 *     approval minted in one agent scope authorized the same name in every
 *     scope, and a re-registered different-family source inherited it. Fix
 *     contract: the key is (scopeKey, nativeName); `CallFacts` carries the
 *     scopeKey produced by the HostSurfaceAdapter's scoped resolution — an
 *     absent scope refuses `SCOPE_UNVERIFIED`.
 *
 * The tests assert the FIXED contract; on pre-fix code each K*-marked leg
 * fails (that RED output is the evidence; see dev/agent-workflow/evidence/
 * u6-fixk-20261026/). Regression legs that must stay green in both states are
 * marked `regression:`.
 */
import { describe, expect, it } from 'vitest'
import {
  createGovernedFamilyRegistry,
  createGovernanceKernel,
  type GovernedFamilyRegistry,
  type GovernanceKernel,
  type GrantConsumePort,
} from '../governance-center/index.js'

/** A closed-schema contribution for one family claiming exactly these names. */
function contributionFor(familyId: string, nativeNames: readonly string[], hexChar: string) {
  const digest = hexChar.repeat(64)
  return {
    schemaVersion: { major: 1, minor: 0, patch: 0 },
    familyId,
    familyVersion: '1.0.0',
    source: { kind: 'family-owned' as const, selector: `lane:fixk:${familyId}`, digest },
    provider: { id: 'provider.fixk', digest },
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

type Harness = {
  registry: GovernedFamilyRegistry
  kernel: GovernanceKernel
}

/** An ACTIVE kernel over a fresh registry, family `familyId` claiming `name`,
 *  one approval entry bound in `scopeKey`. */
function wired(opts: {
  readonly familyId?: string
  readonly name?: string
  readonly hex?: string
  readonly scopeKey?: string
  readonly definitionIdentity?: string
  readonly origin?: 'reviewed-manifest' | 'dynamic-source'
  readonly lifecycle?: { readonly inflight: () => number }
} = {}): Harness & { readonly familyId: string; readonly name: string; readonly scopeKey: string } {
  const familyId = opts.familyId ?? 'u6.fixk.alpha'
  const name = opts.name ?? 'tool_alpha'
  const scopeKey = opts.scopeKey ?? 'root-1:inst-1'
  const registry = createGovernedFamilyRegistry({ kernelManifest: { capabilities: {} } })
  const kernel = createGovernanceKernel({
    registry,
    ...(opts.lifecycle === undefined ? {} : { ports: { lifecycle: opts.lifecycle } }),
  })
  kernel.publish()
  const landed = registry.register(contributionFor(familyId, [name], opts.hex ?? 'a'), { origin: opts.origin ?? 'reviewed-manifest' })
  if (!landed.ok) throw new Error(`fixture register failed: ${landed.detail}`)
  return { registry, kernel, familyId, name, scopeKey }
}

describe('FIX-K K1 — approval entries are bound to their owning candidate', () => {
  it('RED K1: an existing approval entry must REFUSE after registry.revoke() (CANDIDATE_REVOKED)', () => {
    const { registry, kernel, familyId, name, scopeKey } = wired()
    const added = kernel.addApprovalEntry({ scopeKey, nativeName: name, definitionIdentity: 'def#1', familyId })
    expect(added.ok).toBe(true)
    expect(kernel.decide({ scopeKey, nativeName: name, definitionIdentity: 'def#1' }).outcome).toBe('allow')
    expect(registry.revoke(familyId, 'fix-k: K1 revoke').ok).toBe(true)
    const after = kernel.decide({ scopeKey, nativeName: name, definitionIdentity: 'def#1' })
    expect(after.outcome).toBe('refuse')
    if (after.outcome === 'refuse') expect(after.code).toBe('CANDIDATE_REVOKED')
    // the read surface reflects the invalidation too — a stale entry is not authority:
    expect(kernel.approvalFor(scopeKey, name)).toBeUndefined()
  })

  it('RED K1: re-registration at a new generation never resurrects the old entry (STALE_GENERATION until a NEW owner-surface approval)', () => {
    const { registry, kernel, familyId, name, scopeKey } = wired()
    const added = kernel.addApprovalEntry({ scopeKey, nativeName: name, definitionIdentity: 'def#1', familyId })
    expect(added.ok).toBe(true)
    expect(registry.revoke(familyId, 'fix-k: K1 revoke-for-rereg').ok).toBe(true)
    // the kernel dropped the family's entries on the revoke invalidation; even
    // where an entry object survives, it must never authorize the new candidate:
    const reRegistered = registry.register(contributionFor(familyId, [name], 'c'), { origin: 'reviewed-manifest' })
    expect(reRegistered.ok).toBe(true)
    const stale = kernel.decide({ scopeKey, nativeName: name, definitionIdentity: 'def#1' })
    expect(stale.outcome).not.toBe('allow')
    if (stale.outcome === 'refuse') expect(['CANDIDATE_REVOKED', 'STALE_GENERATION']).toContain(stale.code)
    // A NEW approval for the NEW candidate is a fresh owner-surface act:
    const rebind = kernel.addApprovalEntry({ scopeKey, nativeName: name, definitionIdentity: 'def#2', familyId })
    if (rebind.ok === false) {
      // the key is still held by the stale entry — replace (rebind) is the owner path
      const replaced = kernel.replaceApprovalEntry({ scopeKey, nativeName: name, definitionIdentity: 'def#2', familyId, expectedGeneration: registry.generation() })
      expect(replaced.ok).toBe(true)
    }
    expect(kernel.decide({ scopeKey, nativeName: name, definitionIdentity: 'def#2' }).outcome).toBe('allow')
  })

  it('RED K1: dropApprovalsForFamily removes exactly that family entries (kernel-OWNER surface)', () => {
    const { registry, kernel } = wired({ familyId: 'u6.fixk.alpha', name: 'tool_alpha', scopeKey: 's1' })
    const other = registry.register(contributionFor('u6.fixk.beta', ['tool_beta'], 'b'))
    expect(other.ok).toBe(true)
    expect(kernel.addApprovalEntry({ scopeKey: 's1', nativeName: 'tool_alpha', definitionIdentity: 'def#a', familyId: 'u6.fixk.alpha' }).ok).toBe(true)
    expect(kernel.addApprovalEntry({ scopeKey: 's1', nativeName: 'tool_beta', definitionIdentity: 'def#b', familyId: 'u6.fixk.beta' }).ok).toBe(true)
    const dropped = kernel.dropApprovalsForFamily('u6.fixk.alpha')
    expect(dropped).toBe(1)
    expect(kernel.approvalFor('s1', 'tool_alpha')).toBeUndefined()
    // the other family is untouched:
    expect(kernel.approvalFor('s1', 'tool_beta')).toBeDefined()
    // and with the entry gone the kernel has no opinion (defer), never allow:
    expect(kernel.decide({ scopeKey: 's1', nativeName: 'tool_alpha', definitionIdentity: 'def#a' }).outcome).toBe('defer')
  })

  it('regression: a live, reviewed candidate with a matching entry still allows (the positive control stays true)', () => {
    const { kernel, familyId, name, scopeKey } = wired()
    expect(kernel.addApprovalEntry({ scopeKey, nativeName: name, definitionIdentity: 'def#1', familyId }).ok).toBe(true)
    expect(kernel.decide({ scopeKey, nativeName: name, definitionIdentity: 'def#1' }).outcome).toBe('allow')
  })

  it('regression: a not_verified dynamic source still refuses even with a present entry (condition 9)', () => {
    const { kernel, familyId, name, scopeKey } = wired({ familyId: 'u6.fixk.dynamic', name: 'tool_dyn', origin: 'dynamic-source' })
    expect(kernel.addApprovalEntry({ scopeKey, nativeName: name, definitionIdentity: 'def#d', familyId }).ok).toBe(true)
    const verdict = kernel.decide({ scopeKey, nativeName: name, definitionIdentity: 'def#d' })
    expect(verdict.outcome).toBe('refuse')
    if (verdict.outcome === 'refuse') expect(verdict.code).toBe('NOT_VERIFIED_SOURCE')
  })
})

describe('FIX-K K4 — approvals are keyed by (scopeKey, nativeName) with the bound source identity', () => {
  it('RED K4: an approval minted in scope A never reaches scope B', () => {
    const { registry, kernel, familyId, name } = wired({ scopeKey: 'root-A:inst-1' })
    expect(kernel.addApprovalEntry({ scopeKey: 'root-A:inst-1', nativeName: name, definitionIdentity: 'def#1', familyId }).ok).toBe(true)
    expect(kernel.decide({ scopeKey: 'root-A:inst-1', nativeName: name, definitionIdentity: 'def#1' }).outcome).toBe('allow')
    const other = kernel.decide({ scopeKey: 'root-B:inst-2', nativeName: name, definitionIdentity: 'def#1' })
    expect(other.outcome).not.toBe('allow')
    // no entry exists for (B, name): the kernel defers — the call stays with today's path
    if (other.outcome === 'defer') expect(other.code).toBe('NO_APPROVAL_ENTRY')
    void registry
  })

  it('RED K4: a call whose scoped resolution carries no scopeKey refuses SCOPE_UNVERIFIED', () => {
    const { kernel, familyId, name, scopeKey } = wired()
    expect(kernel.addApprovalEntry({ scopeKey, nativeName: name, definitionIdentity: 'def#1', familyId }).ok).toBe(true)
    for (const unscoped of [
      { nativeName: name, definitionIdentity: 'def#1' },
      { nativeName: name, definitionIdentity: 'def#1', scopeKey: '' },
    ]) {
      const verdict = kernel.decide(unscoped)
      expect(verdict.outcome).toBe('refuse')
      if (verdict.outcome === 'refuse') expect(verdict.code).toBe('SCOPE_UNVERIFIED')
    }
  })

  it('RED K4: the same native name re-claimed by a DIFFERENT family does not inherit the old entry', () => {
    const { registry, kernel, familyId, name, scopeKey } = wired()
    expect(kernel.addApprovalEntry({ scopeKey, nativeName: name, definitionIdentity: 'def#1', familyId }).ok).toBe(true)
    expect(registry.revoke(familyId, 'fix-k: K4 handover').ok).toBe(true)
    const beta = registry.register(contributionFor('u6.fixk.beta', [name], 'b'), { origin: 'reviewed-manifest' })
    expect(beta.ok).toBe(true)
    // beta presents the SAME definition identity the old entry bound — keying must
    // be by the bound candidate, not by the name string:
    const inherited = kernel.decide({ scopeKey, nativeName: name, definitionIdentity: 'def#1' })
    expect(inherited.outcome).not.toBe('allow')
    // and beta can be approved only through a fresh owner-surface act bound to beta:
    const drop = kernel.dropApprovalsForFamily(familyId)
    expect(drop).toBeGreaterThanOrEqual(0) // K1 may already have invalidated it
    const added = kernel.addApprovalEntry({ scopeKey, nativeName: name, definitionIdentity: 'def#1', familyId: 'u6.fixk.beta' })
    expect(added.ok).toBe(true)
    expect(kernel.decide({ scopeKey, nativeName: name, definitionIdentity: 'def#1' }).outcome).toBe('allow')
  })

  it('RED K4: addApprovalEntry refuses a name no live candidate claims — an entry without a bound candidate is dead authority (NO_CANDIDATE)', () => {
    const { kernel } = wired()
    const dead = kernel.addApprovalEntry({ scopeKey: 's1', nativeName: 'tool_ghost', definitionIdentity: 'def#g', familyId: 'u6.fixk.alpha' })
    expect(dead.ok).toBe(false)
    if (dead.ok === false) expect(dead.code).toBe('NO_CANDIDATE')
    // a wrong familyId (the candidate does not claim the name) is the same refusal:
    const wrongFamily = kernel.addApprovalEntry({ scopeKey: 's1', nativeName: 'tool_alpha', definitionIdentity: 'def#1', familyId: 'u6.fixk.notevenregistered' })
    expect(wrongFamily.ok).toBe(false)
    if (wrongFamily.ok === false) expect(wrongFamily.code).toBe('NO_CANDIDATE')
  })
})

describe('FIX-K K2 — consumeOnce reserves the grant id IN FLIGHT before any await', () => {
  type ConsumeResult = Awaited<ReturnType<GovernanceKernel['consumeOnce']>>

  it('RED K2: two concurrent consumeOnce calls with the same grantId reach the port EXACTLY once', async () => {
    let portCalls = 0
    let releaseGate: (v: { readonly ok: boolean }) => void = () => undefined
    const gate = new Promise<{ readonly ok: boolean }>((resolve) => {
      releaseGate = resolve
    })
    const grantConsume: GrantConsumePort = {
      async consumeForExecution() {
        portCalls += 1
        return gate
      },
    }
    const registry = createGovernedFamilyRegistry({ kernelManifest: { capabilities: {} } })
    const kernel = createGovernanceKernel({ registry, ports: { grantConsume } })
    const first = kernel.consumeOnce({ id: 'g' }, 'grant-race')
    const second = kernel.consumeOnce({ id: 'g' }, 'grant-race')
    // The second call must refuse IMMEDIATELY (no await on the port):
    const PENDING = Symbol('still-pending')
    const raced: ConsumeResult | typeof PENDING = await Promise.race([second, new Promise<typeof PENDING>((r) => setTimeout(() => r(PENDING), 25))])
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
    const secondDone = await second
    expect(secondDone.ok).toBe(false)
    expect(secondDone.portCalled).toBe(false)
    // THE law: exactly one presentation reached the port.
    expect(portCalls).toBe(1)
  })

  it('RED K2: a FAILED port consume still burns the id — a presentation is one-shot, never re-presentable (fail-closed)', async () => {
    let portCalls = 0
    const grantConsume: GrantConsumePort = {
      async consumeForExecution() {
        portCalls += 1
        return { ok: false, reason: 'expired' }
      },
    }
    const registry = createGovernedFamilyRegistry({ kernelManifest: { capabilities: {} } })
    const kernel = createGovernanceKernel({ registry, ports: { grantConsume } })
    const denied = await kernel.consumeOnce({}, 'grant-x')
    expect(denied.ok).toBe(false)
    expect(denied.portCalled).toBe(true)
    const retry = await kernel.consumeOnce({}, 'grant-x')
    expect(retry.ok).toBe(false)
    expect(retry.code).toBe('GRANT_REPLAY')
    expect(retry.portCalled).toBe(false)
    expect(portCalls).toBe(1) // the kernel NEVER re-presents a grant it already presented
  })

  it('RED K2: a port that THROWS still burns the id and leaves no dangling reservation (unknown outcome = fail closed)', async () => {
    let portCalls = 0
    const grantConsume: GrantConsumePort = {
      async consumeForExecution() {
        portCalls += 1
        throw new Error('port exploded')
      },
    }
    const registry = createGovernedFamilyRegistry({ kernelManifest: { capabilities: {} } })
    const kernel = createGovernanceKernel({ registry, ports: { grantConsume } })
    await expect(kernel.consumeOnce({}, 'grant-throw')).rejects.toThrow('port exploded')
    const retry = await kernel.consumeOnce({}, 'grant-throw')
    expect(retry.ok).toBe(false)
    expect(retry.code).toBe('GRANT_REPLAY')
    expect(retry.portCalled).toBe(false)
    expect(portCalls).toBe(1)
  })

  it('regression: sequential replay after SUCCESS still refuses without touching the port (PR1 law holds)', async () => {
    let portCalls = 0
    const grantConsume: GrantConsumePort = {
      async consumeForExecution() {
        portCalls += 1
        return { ok: true }
      },
    }
    const registry = createGovernedFamilyRegistry({ kernelManifest: { capabilities: {} } })
    const kernel = createGovernanceKernel({ registry, ports: { grantConsume } })
    expect((await kernel.consumeOnce({}, 'g1')).ok).toBe(true)
    const replay = await kernel.consumeOnce({}, 'g1')
    expect(replay.ok).toBe(false)
    expect(replay.code).toBe('GRANT_REPLAY')
    expect(portCalls).toBe(1)
    // a DIFFERENT id is unaffected:
    expect((await kernel.consumeOnce({}, 'g2')).ok).toBe(true)
    expect(portCalls).toBe(2)
  })
})

describe('FIX-K K3 — release() counts only what a lifecycle port actually counted', () => {
  function toTombstoned(kernel: GovernanceKernel): void {
    kernel.beginDrain()
    kernel.tombstone()
  }

  it('RED K3: release() with NO lifecycle port refuses LIFECYCLE_PORT_MISSING and records UNCOUNTED (shadow mode too)', () => {
    const { kernel } = wired()
    toTombstoned(kernel)
    const bad = kernel.release()
    expect(bad.ok).toBe(false)
    if (bad.ok === false) {
      expect(bad.code).toBe('LIFECYCLE_PORT_MISSING')
      expect(bad.detail).toContain('UNCOUNTED')
    }
    expect(kernel.state()).toBe('TOMBSTONED')
  })

  it('RED K3: the factory REFUSES to build an enforcing kernel without the lifecycle port', () => {
    const registry = createGovernedFamilyRegistry({ kernelManifest: { capabilities: {} } })
    expect(() => createGovernanceKernel({ registry, mode: 'enforcing' })).toThrow(/LIFECYCLE_PORT_MISSING/)
    // shadow (the default) builds without it, and says so:
    const shadow = createGovernanceKernel({ registry })
    expect(shadow.mode()).toBe('shadow')
    const enforcing = createGovernanceKernel({ registry, mode: 'enforcing', ports: { lifecycle: { inflight: () => 0 } } })
    expect(enforcing.mode()).toBe('enforcing')
  })

  it('regression: a counted zero releases, a counted non-zero refuses (CI-08 unchanged)', () => {
    let inflight = 1
    const { kernel } = wired({ lifecycle: { inflight: () => inflight } })
    toTombstoned(kernel)
    const held = kernel.release()
    expect(held.ok).toBe(false)
    if (held.ok === false) expect(held.code).toBe('LEASE_OPEN')
    inflight = 0
    expect(kernel.release().ok).toBe(true)
    expect(kernel.state()).toBe('RELEASED')
  })

  it('regression: state legality still precedes the port check (PREPARING release = ILLEGAL_TRANSITION even without a port)', () => {
    const { kernel } = wired()
    const bad = kernel.release()
    expect(bad.ok).toBe(false)
    if (bad.ok === false) expect(bad.code).toBe('ILLEGAL_TRANSITION')
  })
})
