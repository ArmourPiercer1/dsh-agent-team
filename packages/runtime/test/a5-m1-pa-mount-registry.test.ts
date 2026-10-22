/**
 * PR358-B (CENTER): the narrow mount index + call-level facts adapter
 * (contract = control/types.ts PaCallFacts). Pins (counterexamples; no
 * production hooks):
 *  1. no published mount ⇒ facts undefined (the port fail-closes);
 *  2. an UNVERIFIED / non-ACTIVE dispatcher entry ⇒ undefined;
 *  3. realm mismatch (manifest ≠ live mount plane) ⇒ undefined;
 *  4. beneficiary contradiction (manifest claims a rung the durable mount
 *     attribution does not carry) ⇒ undefined — never the manifest's word;
 *  5. a healthy mount ⇒ the FULL named PaCallFacts (real tuple refs, real
 *     overlay generation, ceiling pair, assembly policy/deny, live plan,
 *     entry binding) and drift contrast computed;
 *  6. abstaining sources (throwing overlay read / unavailable ceiling) ⇒
 *     undefined — NEVER a 0/empty-envelope fallback.
 */
import { describe, expect, it } from 'vitest'

const mod = await import(new URL('../src/plugin/live/pa-mount-registry.mjs', import.meta.url).href)
const { publishPaMount, revokePaMount, readPaCallFacts } = mod as {
  publishPaMount: (root: string, id: string, entry: Record<string, unknown>) => void
  revokePaMount: (root: string, id: string) => boolean
  readPaCallFacts: (input: Record<string, unknown>) => Promise<Record<string, unknown> | undefined>
}

const TUPLE = { blueprintId: 'bp-1', revision: 9, contentHash: 'sha256:bp', templateId: 'tmpl-1', cwd: '/work', providerVersion: 'pv-1' }

function healthyMount() {
  const binding = {
    bindingId: 'team:scope:team_bash',
    agentScopeKey: 'scope',
    toolName: 'team_bash',
    definitionIdentity: 'sha256:real-definition',
    providerId: 'dsh-agent-team',
    implementationOrigin: 'team-trusted-extension',
    executionBoundary: 'trusted-host',
    assurance: {},
    policyGeneration: 17,
    authorityGeneration: 4,
    revision: 3,
    status: 'ACTIVE',
  }
  const requestedEffects = { effects: [{ kind: 'tool-invoke', toolName: 'team_bash' }, { kind: 'fs-read', resource: '/work/a' }] }
  return {
    instanceId: 'member-1',
    guard: {
      dispatcher: {
        surface: { entryOf: (name: string) => (name === 'team_bash' ? { verified: true, revision: 3, binding } : undefined) },
      },
    },
    plane: {
      realmId: 'realm-x',
      assembly: {
        policyDocument: () => ({ rules: [] }),
        denySources: () => ([]),
        authorityGeneration: () => 4,
      },
      livePaPlan: new Map([[
        'call-1',
        { approvalCaseId: 'case-1', effectSetFingerprint: 'sha256:effects', perEffectRequired: ['member', 'member'], requestedEffects },
      ]]),
    },
    beneficiaryAuthority: 'member',
    readers: {
      permissionPlane: () => ({ currentCallFacts: () => ({ tuple: TUPLE, blueprintId: 'bp-1', providerVersion: 'pv-1', healthy: true }) }),
      overlaySnapshot: async () => ({ metadata: { generation: 2 } }),
      teamHardEnvelope: async () => ({ status: 'absent' }),
      permissionEnvelope: async () => ({ rules: [], scope: 'x' }),
    },
  }
}

const manifest = {
  realmId: 'realm-x',
  beneficiaryAuthority: 'member',
  member: { teamSessionId: 'root-b', instanceId: 'member-1' },
  binding: { toolName: 'team_bash', definitionIdentity: 'sha256:real-definition', revision: 3, providerId: 'dsh-agent-team' },
  // 9e fix-2 pin: the PARSED manifest is FLAT — top-level callId, member.*.
  callId: 'call-1',
}

const base = (mount: unknown, over: Record<string, unknown> = {}) =>
  readPaCallFacts({ rootSessionId: 'root-b', requestId: 'r1', manifest, decider: { kind: 'human', humanId: 'u' }, stage: 'guard', mount, ...over })

describe('A5M1-B — PA mount registry (named PaCallFacts contract)', () => {
  it('B1: no published mount ⇒ undefined', async () => {
    expect(await base(undefined, { mount: undefined })).toBeUndefined()
    const identity = publishPaMount('root-b', 'member-1', healthyMount())
    expect(revokePaMount('root-b', 'member-1', undefined)).toBe(false) // identity-less revoke clears NOTHING
    const identity2 = publishPaMount('root-b', 'member-1', healthyMount()) // newer mount published
    expect(revokePaMount('root-b', 'member-1', identity)).toBe(false) // the STALE disposer clears nothing
    expect(revokePaMount('root-b', 'member-1', identity2)).toBe(true) // the owner revokes its own
    expect(revokePaMount('root-b', 'member-1', identity2)).toBe(false) // once
  })

  it('B2: unverified / non-ACTIVE current entry ⇒ undefined', async () => {
    const m = healthyMount()
    ;(m.guard.dispatcher.surface as { entryOf: (n: string) => unknown }).entryOf = () => ({ verified: false, revision: 3, binding: {} })
    expect(await base(m)).toBeUndefined()
    const m2 = healthyMount()
    ;(m2.plane as { realmId: string }).realmId = 'realm-other'
    expect(await base(m2)).toBeUndefined()
  })

  it('B3+B4: realm mismatch and durable-attribution mismatch both refuse', async () => {
    expect(await base(healthyMount(), { manifest: { ...manifest, realmId: 'realm-z' } })).toBeUndefined()
    expect(await base(healthyMount(), { manifest: { ...manifest, member: { teamSessionId: 'root-b', instanceId: 'member-OTHER' } } })).toBeUndefined()
    expect(await base(healthyMount(), { manifest: { ...manifest, member: undefined } })).toBeUndefined()
  })

  it('B5: healthy mount ⇒ the FULL named facts + drift contrast', async () => {
    const f = await base(healthyMount())
    expect(f).toBeDefined()
    expect(f?.policySource).toEqual({ staticLayerRefs: ['blueprint:bp-1@9#sha256:bp', 'template:tmpl-1'], overlayGeneration: 2 })
    expect(f?.realmId).toBe('realm-x')
    expect(f?.ceiling).toEqual({ teamHardEnvelope: { status: 'absent' }, permissionMutationEnvelope: { rules: [], scope: 'x' } })
    expect(f?.policyDocument).toEqual({ rules: [] })
    expect(f?.denySources).toEqual([]) // EMPTY means the read projected nothing — a real answer
    expect((f?.effects as { effects: unknown[] }).effects).toHaveLength(2)
    expect(f?.member).toEqual({ teamSessionId: 'root-b', instanceId: 'member-1' })
    expect(f?.beneficiaryAuthority).toBe('member')
    expect(f?.binding).toMatchObject({ revision: 3, definitionIdentity: 'sha256:real-definition', providerId: 'dsh-agent-team', status: 'ACTIVE' })
    expect(f?.blueprint).toEqual({ revision: 9, contentHash: 'sha256:bp', templateId: 'tmpl-1', cwd: '/work', providerVersion: 'pv-1' })
    expect(f?.planSnapshot).toEqual({ approvalCaseId: 'case-1', effectSetFingerprint: 'sha256:effects', perEffectRequired: ['member', 'member'] })
    expect(f?.authorityGeneration).toBe(4) // the assembly's OWN counter answer
    expect(Object.keys(f as Record<string, unknown>)).toEqual([
      'policySource', 'realmId', 'ceiling', 'policyDocument', 'denySources', 'effects',
      'member', 'beneficiaryAuthority', 'binding', 'blueprint', 'planSnapshot', 'authorityGeneration',
    ]) // exactly the named 12-field contract — no drift flag, no provider extras (AUTH ruling 3)
    // no live plan for this call ⇒ the mount is not answering it ⇒ undefined
    const noPlan = healthyMount() as ReturnType<typeof healthyMount> & { plane: { livePaPlan: Map<string, unknown> } }
    noPlan.plane.livePaPlan.delete('call-1')
    expect(await base(noPlan)).toBeUndefined()
  })

  it('B6: abstaining sources fail closed — never 0/empty-envelope fallbacks', async () => {
    const throwOverlay = healthyMount() as ReturnType<typeof healthyMount> & { readers: Record<string, unknown> }
    throwOverlay.readers.overlaySnapshot = async () => {
      throw new Error('storage fault')
    }
    expect(await base(throwOverlay)).toBeUndefined()
    const unavailableCeiling = healthyMount() as ReturnType<typeof healthyMount> & { readers: Record<string, unknown> }
    unavailableCeiling.readers.teamHardEnvelope = async () => ({ status: 'unavailable' })
    expect(await base(unavailableCeiling)).toBeUndefined()
    const brokenDeny = healthyMount() as ReturnType<typeof healthyMount> & { plane: { assembly: Record<string, unknown> } }
    brokenDeny.plane.assembly.denySources = () => {
      throw new Error('projection fault')
    }
    expect(await base(brokenDeny)).toBeUndefined()
    const brokenGen = healthyMount() as ReturnType<typeof healthyMount> & { plane: { assembly: Record<string, unknown> } }
    brokenGen.plane.assembly.authorityGeneration = () => {
      throw new Error('generation unanswerable')
    }
    expect(await base(brokenGen)).toBeUndefined()
  })
})
