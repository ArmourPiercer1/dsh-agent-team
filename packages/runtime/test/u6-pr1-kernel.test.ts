/**
 * U6 PR1 C1 — the GovernanceKernel units: the §5 state machine (slice-plan
 * "state-machine unit"; CI-08 release law), the CENTER-OWNED approval table
 * (sup-a §5 condition 1: "The caller (a Family) cannot approve itself into
 * it" — condition 7: the family face carries no authority), and the ONE-SHOT
 * consume through the injected `consumeForExecution` port (no re-implemented
 * grant logic; replay never re-presents to the port).
 *
 * FIX-K (2026-10-26, external audit remediation) retargets this suite to the
 * FIXED kernel contract — the PR1 shapes these legs asserted are exactly the
 * four findings (see u6-fixk-kernel-safety.test.ts for the RED-first proofs):
 * every entry carries (scopeKey, nativeName) + the bound owning candidate
 * (K1/K4); the legal walk releases only on a SELF-COUNTED zero, so `fresh()`
 * injects a counted-zero lifecycle port (K3); a FAILED port presentation now
 * burns the id (K2 — a presentation, not its outcome, is the one-shot event).
 */
import { describe, expect, it } from 'vitest'
import {
  KERNEL_STATES,
  createGovernedFamilyRegistry,
  createGovernanceKernel,
  type GovernedFamilyRegistry,
  type GrantConsumePort,
} from '../governance-center/index.js'

function fresh() {
  const registry = createGovernedFamilyRegistry({ kernelManifest: { capabilities: {} } })
  // K3: release() counts only what a lifecycle port counted — the legal walk
  // runs on a counted zero.
  const kernel = createGovernanceKernel({ registry, ports: { lifecycle: { inflight: () => 0 } } })
  return { registry, kernel }
}

/** Register one reviewed family claiming `nativeName` so approval entries
 *  have a live candidate to bind to (FIX-K K1). */
function bindFamily(registry: GovernedFamilyRegistry, familyId: string, nativeName: string, hex = 'a') {
  const digest = hex.repeat(64)
  const landed = registry.register({
    schemaVersion: { major: 1, minor: 0, patch: 0 },
    familyId,
    familyVersion: '1.0.0',
    source: { kind: 'family-owned', selector: `lane:pr1:${familyId}`, digest },
    provider: { id: 'provider.pr1', digest },
    requiredCapabilities: [],
    optionalCapabilities: [],
    visibility: { owner: 'family', nativeNames: [nativeName], aliases: [], profileRequirements: [] },
    definition: { owner: 'family', inputContractDigest: digest, outputContractDigest: digest, normalization: 'pure' },
    effects: { declared: false, kinds: [], targets: [] },
    execution: { declared: false, via: 'family-body' },
    lifecycle: { owner: 'kernel', drain: 'kernel-owned', cancelBoundary: 'host-signal' },
    result: { envelope: 'host', correlation: 'kernel' },
    obligations: { admission: 'kernel', grantMint: 'kernel', grantConsume: 'kernel' },
  })
  if (!landed.ok) throw new Error(`fixture: register failed: ${landed.detail}`)
  return landed.value
}

const SCOPE = 'root-pr1:inst-1'

describe('u6-pr1 kernel — §5 state machine', () => {
  it('the legal walk: PREPARING → ACTIVE → DRAINING → TOMBSTONED → RELEASED', () => {
    const { kernel } = fresh()
    expect(kernel.state()).toBe('PREPARING')
    expect(kernel.publish().ok).toBe(true)
    expect(kernel.state()).toBe('ACTIVE')
    expect(kernel.beginDrain().ok).toBe(true)
    expect(kernel.state()).toBe('DRAINING')
    expect(kernel.tombstone().ok).toBe(true)
    expect(kernel.state()).toBe('TOMBSTONED')
    expect(kernel.release().ok).toBe(true)
    expect(kernel.state()).toBe('RELEASED')
    expect(KERNEL_STATES).toContain(kernel.state())
  })

  it('illegal transitions are typed refusals that change nothing (including the whole skipping matrix)', () => {
    const { kernel } = fresh()
    // from PREPARING:
    expect(kernel.beginDrain().ok).toBe(false)
    expect(kernel.tombstone().ok).toBe(false)
    const skipRelease = kernel.release()
    expect(skipRelease.ok).toBe(false)
    if (skipRelease.ok === false) expect(skipRelease.code).toBe('ILLEGAL_TRANSITION')
    expect(kernel.state()).toBe('PREPARING')
    // double publish:
    expect(kernel.publish().ok).toBe(true)
    const rePublish = kernel.publish()
    expect(rePublish.ok).toBe(false)
    if (rePublish.ok === false) expect(rePublish.code).toBe('ILLEGAL_TRANSITION')
    expect(kernel.state()).toBe('ACTIVE')
    // terminal states admit nothing:
    expect(kernel.beginDrain().ok).toBe(true)
    expect(kernel.tombstone().ok).toBe(true)
    expect(kernel.fail('late').ok).toBe(false) // TOMBSTONED -> FAILED is not legal
    expect(kernel.state()).toBe('TOMBSTONED')
    expect(kernel.release().ok).toBe(true)
    expect(kernel.release().ok).toBe(false)
    expect(kernel.fail('x').ok).toBe(false)
    expect(kernel.state()).toBe('RELEASED')
  })

  it('FAILED is terminal and reachable from every open state', () => {
    for (const path of [
      [],
      ['publish'],
      ['publish', 'beginDrain'],
    ] as const) {
      const { kernel } = fresh()
      for (const step of path) {
        if (step === 'publish') kernel.publish()
        else if (step === 'beginDrain') kernel.beginDrain()
        else kernel.tombstone()
      }
      expect(kernel.fail('boom').ok).toBe(true)
      expect(kernel.state()).toBe('FAILED')
      expect(kernel.publish().ok).toBe(false)
      expect(kernel.beginDrain().ok).toBe(false)
      expect(kernel.fail('again').ok).toBe(false)
      expect(kernel.state()).toBe('FAILED')
    }
  })

  it('CI-08: release() refuses while the lifecycle port still counts in-flight work, and succeeds at zero', () => {
    const registry = createGovernedFamilyRegistry({ kernelManifest: { capabilities: {} } })
    let inflight = 1
    const kernel = createGovernanceKernel({ registry, ports: { lifecycle: { inflight: () => inflight } } })
    kernel.publish()
    kernel.beginDrain()
    kernel.tombstone()
    const held = kernel.release()
    expect(held.ok).toBe(false)
    if (held.ok === false) expect(held.code).toBe('LEASE_OPEN')
    expect(kernel.state()).toBe('TOMBSTONED')
    inflight = 0
    expect(kernel.release().ok).toBe(true)
  })
})

describe('u6-pr1 kernel — the center-owned approval table (conditions 1 + 7)', () => {
  it('decide() defers with NO kernel opinion while the table is empty; refuses while not ACTIVE', () => {
    const { registry, kernel } = fresh()
    // STATE FIRST: before ACTIVE, the kernel has no verdict to offer.
    const early = kernel.decide({ nativeName: 'tool_alpha' })
    expect(early.outcome).toBe('refuse')
    if (early.outcome === 'refuse') expect(early.code).toBe('KERNEL_NOT_ACTIVE')
    kernel.publish()
    bindFamily(registry, 'u6.pr1.alpha', 'tool_alpha')
    kernel.addApprovalEntry({ scopeKey: SCOPE, nativeName: 'tool_alpha', definitionIdentity: 'def#1', familyId: 'u6.pr1.alpha' })
    // entry EXISTS, but with no observable identity the call refuses (CI-04);
    // with no entry at all the kernel defers — the PR1 shadow truth.
    const unverified = kernel.decide({ scopeKey: SCOPE, nativeName: 'tool_alpha' })
    expect(unverified.outcome).toBe('refuse')
    if (unverified.outcome === 'refuse') expect(unverified.code).toBe('IDENTITY_UNVERIFIED')
    const defer = kernel.decide({ scopeKey: SCOPE, nativeName: 'tool_unknown', definitionIdentity: 'def#9' })
    expect(defer.outcome).toBe('defer')
    if (defer.outcome === 'defer') expect(defer.code).toBe('NO_APPROVAL_ENTRY')
  })

  it('identity algebra: matching identity allows; mismatch refuses; a re-bound entry follows the new identity', () => {
    const { registry, kernel } = fresh()
    kernel.publish()
    bindFamily(registry, 'u6.pr1.alpha', 'tool_alpha')
    kernel.addApprovalEntry({ scopeKey: SCOPE, nativeName: 'tool_alpha', definitionIdentity: 'def#1', familyId: 'u6.pr1.alpha' })
    expect(kernel.decide({ scopeKey: SCOPE, nativeName: 'tool_alpha', definitionIdentity: 'def#1' }).outcome).toBe('allow')
    const swapped = kernel.decide({ scopeKey: SCOPE, nativeName: 'tool_alpha', definitionIdentity: 'def#EVIL' })
    expect(swapped.outcome).toBe('refuse')
    if (swapped.outcome === 'refuse') expect(swapped.code).toBe('IDENTITY_MISMATCH')
    // rebind needs the kernel-OWNER face AND the current generation:
    const stale = kernel.replaceApprovalEntry({ scopeKey: SCOPE, nativeName: 'tool_alpha', definitionIdentity: 'def#2', familyId: 'u6.pr1.alpha', expectedGeneration: 99 })
    expect(stale.ok).toBe(false)
    if (stale.ok === false) expect(stale.code).toBe('STALE_GENERATION')
    const ok = kernel.replaceApprovalEntry({ scopeKey: SCOPE, nativeName: 'tool_alpha', definitionIdentity: 'def#2', familyId: 'u6.pr1.alpha', expectedGeneration: registry.generation() })
    expect(ok.ok).toBe(true)
    expect(kernel.decide({ scopeKey: SCOPE, nativeName: 'tool_alpha', definitionIdentity: 'def#2' }).outcome).toBe('allow')
    expect(kernel.decide({ scopeKey: SCOPE, nativeName: 'tool_alpha', definitionIdentity: 'def#1' }).outcome).toBe('refuse')
  })

  it('duplicate entries refuse; the table refuses empty identities', () => {
    const { registry, kernel } = fresh()
    kernel.publish()
    bindFamily(registry, 'u6.pr1.alpha', 'tool_alpha')
    expect(kernel.addApprovalEntry({ scopeKey: SCOPE, nativeName: 'tool_alpha', definitionIdentity: 'def#1', familyId: 'u6.pr1.alpha' }).ok).toBe(true)
    const dup = kernel.addApprovalEntry({ scopeKey: SCOPE, nativeName: 'tool_alpha', definitionIdentity: 'def#2', familyId: 'u6.pr1.alpha' })
    expect(dup.ok).toBe(false)
    if (dup.ok === false) expect(dup.code).toBe('DUP_APPROVAL_ENTRY')
    expect(kernel.addApprovalEntry({ scopeKey: SCOPE, nativeName: 'tool_beta', definitionIdentity: '', familyId: 'u6.pr1.alpha' }).ok).toBe(false)
  })

  it('condition 1 + 7: a Family face carries NO authority surface — no decide, approve, consume, or table write', () => {
    const { kernel } = fresh()
    const face = kernel.familyFace()
    expect(Object.keys(face)).toEqual([])
    expect(Object.isFrozen(face)).toBe(true)
    for (const forbidden of ['decide', 'approve', 'consume', 'consumeOnce', 'addApprovalEntry', 'register', 'allow'] as const) {
      expect((face as Record<string, unknown>)[forbidden]).toBeUndefined()
    }
  })

  it('condition 9: a dynamically added, not-revalidated candidate refuses with NOT_VERIFIED_SOURCE', () => {
    const { registry, kernel } = fresh()
    kernel.publish()
    const digest = 'b'.repeat(64)
    const contribution = {
      schemaVersion: { major: 1, minor: 0, patch: 0 },
      familyId: 'u6.family.dynamic',
      familyVersion: '0.0.1',
      source: { kind: 'family-owned', selector: 'lane:dynamic', digest },
      provider: { id: 'provider.dynamic', digest },
      requiredCapabilities: [],
      optionalCapabilities: [],
      visibility: { owner: 'family', nativeNames: ['tool_dynamic'], aliases: [], profileRequirements: [] },
      definition: { owner: 'family', inputContractDigest: digest, outputContractDigest: digest, normalization: 'pure' },
      effects: { declared: false, kinds: [], targets: [] },
      execution: { declared: false, via: 'family-body' },
      lifecycle: { owner: 'kernel', drain: 'kernel-owned', cancelBoundary: 'host-signal' },
      result: { envelope: 'host', correlation: 'kernel' },
      obligations: { admission: 'kernel', grantMint: 'kernel', grantConsume: 'kernel' },
    }
    const landed = registry.register(contribution, { origin: 'dynamic-source' })
    expect(landed.ok).toBe(true)
    kernel.addApprovalEntry({ scopeKey: SCOPE, nativeName: 'tool_dynamic', definitionIdentity: 'def#d', familyId: 'u6.family.dynamic' })
    // Even a PRESENT approval entry cannot launder an un-revalidated source:
    const verdict = kernel.decide({ scopeKey: SCOPE, nativeName: 'tool_dynamic', definitionIdentity: 'def#d' })
    expect(verdict.outcome).toBe('refuse')
    if (verdict.outcome === 'refuse') expect(verdict.code).toBe('NOT_VERIFIED_SOURCE')
  })
})

describe('u6-pr1 kernel — one-shot consume via the injected port (CI-06, no re-implemented grant logic)', () => {
  it('the port is called EXACTLY ONCE per grant id: replay refuses kernel-side without touching it', async () => {
    let portCalls = 0
    const grantConsume: GrantConsumePort = {
      async consumeForExecution() {
        portCalls += 1
        return { ok: true }
      },
    }
    const registry = createGovernedFamilyRegistry({ kernelManifest: { capabilities: {} } })
    const kernel = createGovernanceKernel({ registry, ports: { grantConsume } })
    const first = await kernel.consumeOnce({ id: 'grant-1' } as unknown, 'grant-1', { callId: 'c1' })
    expect(first.ok).toBe(true)
    expect(first.portCalled).toBe(true)
    const replay = await kernel.consumeOnce({ id: 'grant-1' } as unknown, 'grant-1', { callId: 'c2' })
    expect(replay.ok).toBe(false)
    expect(replay.code).toBe('GRANT_REPLAY')
    expect(replay.portCalled).toBe(false)
    expect(portCalls).toBe(1)
    // sensitivity plant: the replay refusal must be the kernel's one-shot law,
    // not a dead port — a DIFFERENT id still reaches the port.
    const other = await kernel.consumeOnce({ id: 'grant-2' } as unknown, 'grant-2')
    expect(other.ok).toBe(true)
    expect(portCalls).toBe(2)
  })

  it('a presented port consume is BURNED whatever the port answered (FIX-K K2: fail-closed, never re-presented)', async () => {
    // PR1 pinned "a FAILED port consume does not burn the id"; FIX-K retired
    // that semantics (audit finding K2): the port's ledger is not observable
    // from the kernel, a refused presentation may still have committed there,
    // so the PRESENTATION — not its outcome — is the one-shot event. The
    // kernel never re-presents; the port's own refusal is returned verbatim.
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
    expect(portCalls).toBe(1)
  })

  it('no port injected → NO_CONSUME_PORT: PR1 ships no grant authority of its own', async () => {
    const { kernel } = fresh()
    const result = await kernel.consumeOnce({}, 'grant-any')
    expect(result.ok).toBe(false)
    expect(result.portCalled).toBe(false)
    if (result.code !== undefined) expect(result.code).toBe('NO_CONSUME_PORT')
  })
})
