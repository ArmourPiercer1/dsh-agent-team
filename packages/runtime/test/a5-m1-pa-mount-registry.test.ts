/**
 * PR358-B (CENTER): the narrow mount index + call-level facts adapter.
 * Pins (counterexamples, no production hooks):
 *  1. no published mount ⇒ facts undefined (the root port fail-closes);
 *  2. an UNVERIFIED dispatcher entry ⇒ undefined (a synthetic/failed
 *     binding is never an authority);
 *  3. realm mismatch (manifest ≠ live mount plane) ⇒ undefined;
 *  4. beneficiary contradiction (manifest claims a rung the durable mount
 *     attribution does not carry) ⇒ undefined — never the manifest's word;
 *  5. a healthy mount ⇒ real facts (CURRENT entry revision/realm/provider,
 *     the tuple read, generations from the dispatcher — never 0/1 constants).
 */
import { describe, expect, it } from 'vitest'

const mod = await import(new URL('../src/plugin/live/pa-mount-registry.mjs', import.meta.url).href)
const { publishPaMount, revokePaMount, readPaCallFacts } = mod as {
  publishPaMount: (root: string, id: string, entry: Record<string, unknown>) => void
  revokePaMount: (root: string, id: string) => boolean
  readPaCallFacts: (input: Record<string, unknown>) => Promise<Record<string, unknown> | undefined>
}

function healthyMount(over: Record<string, unknown> = {}) {
  const binding = {
    bindingId: 'team:scope:team_bash',
    definitionIdentity: 'sha256:real-definition',
    providerId: 'dsh-agent-team',
    status: 'ACTIVE',
    revision: 3,
  }
  return {
    instanceId: 'member-1',
    guard: {
      dispatcher: {
        surface: { entryOf: (name: string) => (name === 'team_bash' ? { verified: true, revision: 3, binding, ...((over.entryExtra as Record<string, unknown>) ?? {}) } : undefined) },
        policyGeneration: () => 17,
        authorityGeneration: () => 5,
      },
    },
    plane: { realmId: 'realm-x', backends: { shell: { backendId: 'confined-shell-v1' } } },
    beneficiaryAuthority: 'member',
    readers: {
      permissionPlane: () => ({
        currentCallFacts: () => ({ tuple: { blueprintId: 'bp-1', revision: '9', contentHash: 'h', templateId: 't', cwd: '/w', providerVersion: 'pv' }, blueprintId: 'bp-1', healthy: true }),
      }),
      policySnapshot: () => ({ default: 'ask' }),
    },
    ...(over.entry as Record<string, unknown>),
  }
}

const manifest = {
  realmId: 'realm-x',
  beneficiaryAuthority: 'member',
  binding: { toolName: 'team_bash', definitionIdentity: 'sha256:real-definition', revision: 3, providerId: 'dsh-agent-team' },
  request: { toolName: 'team_bash', callId: 'call-1', instanceId: 'member-1' },
}

describe('A5M1-B — PA mount registry (center call-level facts)', () => {
  it('B1: no published mount ⇒ facts undefined', async () => {
    const facts = await readPaCallFacts({ rootSessionId: 'root-none', requestId: 'r1', manifest, decider: { kind: 'human', humanId: 'u' }, stage: 'guard', mount: undefined })
    expect(facts).toBeUndefined()
  })

  it('B2: unverified / non-ACTIVE current entry ⇒ undefined (never an authority)', async () => {
    const m = healthyMount()
    ;(m.guard.dispatcher.surface as { entryOf: (n: string) => unknown }).entryOf = () => ({ verified: false, revision: 3, binding: {} })
    const facts = await readPaCallFacts({ rootSessionId: 'root-b2', requestId: 'r2', manifest, decider: undefined, stage: 'guard', mount: m })
    expect(facts).toBeUndefined()
    const m2 = healthyMount()
    ;(m2.guard.dispatcher.surface as { entryOf: (n: string) => unknown }).entryOf = (n: string) =>
      n === 'team_bash' ? { verified: true, revision: 3, binding: { bindingId: 'b', definitionIdentity: 'd', providerId: 'p', status: 'RETIRED', revision: 3 } } : undefined
    expect(await readPaCallFacts({ rootSessionId: 'root-b2b', requestId: 'r2', manifest, decider: undefined, stage: 'guard', mount: m2 })).toBeUndefined()
  })

  it('B3: realm mismatch between the manifest and the LIVE mount ⇒ undefined', async () => {
    const m = healthyMount()
    ;(m.plane as { realmId: string }).realmId = 'realm-other'
    expect(await readPaCallFacts({ rootSessionId: 'root-b3', requestId: 'r3', manifest, decider: undefined, stage: 'guard', mount: m })).toBeUndefined()
  })

  it('B4: beneficiary is the mount DURABLE attribution — a manifest claiming a different rung is refused, not believed', async () => {
    const m = healthyMount()
    expect(await readPaCallFacts({ rootSessionId: 'root-b4', requestId: 'r4', manifest: { ...manifest, beneficiaryAuthority: 'leader' }, decider: undefined, stage: 'guard', mount: m })).toBeUndefined()
  })

  it('B5: healthy mount ⇒ REAL facts (current revision 3, generations 17/5, tuple, provider) and drift contrast computed', async () => {
    const m = healthyMount()
    const facts = await readPaCallFacts({ rootSessionId: 'root-b5', requestId: 'r5', manifest, decider: undefined, stage: 'guard', mount: m })
    expect(facts).toBeDefined()
    expect(facts?.binding).toMatchObject({ revision: 3, definitionIdentity: 'sha256:real-definition', realmId: 'realm-x', providerId: 'dsh-agent-team' })
    const policy = facts?.policy as Record<string, unknown>
    expect(policy.policyGeneration).toBe(17)
    expect(policy.authorityGeneration).toBe(5)
    expect((policy.tuple as { blueprintId: string }).blueprintId).toBe('bp-1')
    expect(facts?.bindingSnapshotDrift).toBe(false)
    const drifted = { ...manifest, binding: { ...manifest.binding, revision: 2 } }
    const f2 = await readPaCallFacts({ rootSessionId: 'root-b5', requestId: 'r6', manifest: drifted, decider: undefined, stage: 'guard', mount: m })
    expect(f2?.bindingSnapshotDrift).toBe(true) // the reader CARRIES the drift fact; the pure core weighs it
    expect(revokePaMount('root-b5', 'member-1')).toBe(false) // never published — stale revoke clears nothing
    publishPaMount('root-b5', 'member-1', healthyMount())
    expect(revokePaMount('root-b5', 'member-1')).toBe(true)
    expect(revokePaMount('root-b5', 'member-1')).toBe(false) // disposer runs once against the live entry
  })
})
