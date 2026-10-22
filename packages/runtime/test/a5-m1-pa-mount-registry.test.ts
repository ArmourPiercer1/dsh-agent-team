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
// 9e (identity law): publish HANDS BACK the mount identity and revoke
// REQUIRES it — the test's binding states that contract, so the arity is
// checked here rather than discovered at runtime.
interface CallLevelAnswer { kind: 'call-facts' | 'no-approval-question'; facts: Record<string, unknown> }
const { publishPaMount, revokePaMount, readPaCallFacts, readPaCallFactsForCall } = mod as {
  publishPaMount: (root: string, id: string, entry: Record<string, unknown>) => unknown
  revokePaMount: (root: string, id: string, identity: unknown) => boolean
  readPaCallFacts: (input: Record<string, unknown>) => Promise<Record<string, unknown> | undefined>
  readPaCallFactsForCall: (input: Record<string, unknown>) => Promise<CallLevelAnswer | undefined>
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
  // a parsed set carries its canonical fingerprint (domain/tool-governance);
  // the public call-level entry contrasts it against the live plan's own.
  const requestedEffects = { effects: [{ kind: 'tool-invoke', toolName: 'team_bash' }, { kind: 'fs-read', resource: '/work/a' }], fingerprint: 'sha256:effects' }
  return {
    instanceId: 'member-1',
    guard: {
      dispatcher: {
        surface: {
          names: () => ['team_bash', 'team_grep', 'team_glob', 'read'],
          entryOf: (name: string) => (name === 'team_bash' ? { verified: true, revision: 3, binding }
            : name === 'read' ? { verified: true, revision: 3, binding: { ...binding, bindingId: 'team:scope:read', toolName: 'read' } }
            : undefined),
        },
      },
    },
    plane: {
      realmId: 'realm-x',
      // 9e-2 (AUTH fact list): the generation reader lives on the PLANE
      // FACE (the same `() => number` source the assembly config was built
      // with) — the ProductionAdmissionAssembly face has no such getter and
      // none may be invented.
      authorityGeneration: () => 4,
      assembly: {
        policyDocument: () => ({ rules: [] }),
        denySources: () => ([]),
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
  binding: { bindingId: 'team:scope:team_bash', toolName: 'bash', definitionIdentity: 'sha256:real-definition', revision: 3, providerId: 'dsh-agent-team' },
  // AUTH audit (e) pin: the snapshot's toolName is the BACKEND name; the
  // dispatcher key lookup must go by the bindingId family, never toolName.
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

  it('B2: unverified/non-ACTIVE, ambiguous, or off-family entries all ⇒ undefined', async () => {
    const m = healthyMount()
    ;(m.guard.dispatcher.surface as { entryOf: (n: string) => unknown }).entryOf = () => ({ verified: false, revision: 3, binding: {} })
    expect(await base(m)).toBeUndefined()
    const m2 = healthyMount()
    ;(m2.plane as { realmId: string }).realmId = 'realm-other'
    expect(await base(m2)).toBeUndefined()
    // AUTH (e) pin: the BACKEND toolName is never a dispatcher key — an
    // entry only under the backend name does NOT satisfy the family lookup
    // unless its bindingId family matches (it never does across namespaces).
    const m3 = healthyMount()
    const surf = m3.guard.dispatcher.surface as { entryOf: (n: string) => unknown }
    surf.entryOf = (n: string) => (n === 'bash'
      ? { verified: true, revision: 3, binding: { bindingId: 'backend:family', toolName: 'bash', definitionIdentity: 'sha256:real-definition', status: 'ACTIVE' } }
      : undefined)
    expect(await base(m3)).toBeUndefined()
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
    const brokenGen = healthyMount() as ReturnType<typeof healthyMount> & { plane: { authorityGeneration: () => number } }
    brokenGen.plane.authorityGeneration = () => {
      throw new Error('generation unanswerable')
    }
    expect(await base(brokenGen)).toBeUndefined()
  })
})

// ── A5-M1 B: the PUBLIC call-level entry (no durable row, no manifest) ──────
// The plane's execution edge must await the SAME read on BOTH PA paths, and
// the all-allow path mints no Control row at all. These pins are exactly that
// difference: same facts law, no requestId, no manifest, live plan keyed by
// the CALL identity.
describe('A5M1-B2 — the public call-level entry (A5-M1 B/D)', () => {
  const callEffects = { effects: [{ kind: 'tool-invoke', toolName: 'team_bash' }, { kind: 'fs-read', resource: '/work/a' }], fingerprint: 'sha256:effects' }
  const call = (mount: unknown, over: Record<string, unknown> = {}) => readPaCallFactsForCall({
    rootSessionId: 'root-b',
    instanceId: 'member-1',
    realmId: 'realm-x',
    callId: 'call-1',
    requestedEffects: callEffects,
    placementName: 'team_bash',
    mount,
    ...over,
  })

  it('B7: a live call answers with NO requestId and NO manifest (the row path is not implied)', async () => {
    const a = await call(healthyMount())
    expect(a?.kind).toBe('call-facts')
    const f = a?.facts as Record<string, unknown>
    expect(Object.keys(f)).toEqual([
      'policySource', 'realmId', 'ceiling', 'policyDocument', 'denySources', 'effects',
      'member', 'beneficiaryAuthority', 'binding', 'blueprint', 'planSnapshot', 'authorityGeneration',
    ]) // the complete named contract, same order the durable path answers
    expect(f.planSnapshot).toEqual({ approvalCaseId: 'case-1', effectSetFingerprint: 'sha256:effects', perEffectRequired: ['member', 'member'] })
    expect(f.authorityGeneration).toBe(4)
    // the identity that answered is the binding FAMILY's carrier, not the name:
    expect((f.binding as { bindingId: string }).bindingId).toBe('team:scope:team_bash')
  })

  it('B8: a call that walked NO approval question answers the named facts MINUS planSnapshot — stated, never synthesized', async () => {
    const m = healthyMount() as ReturnType<typeof healthyMount> & { plane: { livePaPlan: Map<string, unknown> } }
    m.plane.livePaPlan.delete('call-1') // the all-allow case: this call opened no case
    const a = await call(m)
    expect(a?.kind).toBe('no-approval-question')
    const f = a?.facts as Record<string, unknown>
    expect('planSnapshot' in f).toBe(false) // never an empty/ fabricated snapshot
    expect(Object.keys(f)).toHaveLength(11)
    expect(f.realmId).toBe('realm-x')
    expect(f.authorityGeneration).toBe(4)
  })

  it('B9: the binding is the UNIQUE carrier of the family — zero, ambiguous, or off-family answers undefined (M1-D)', async () => {
    // (a) a placement name the surface does not carry ⇒ no family ⇒ undefined
    expect(await call(healthyMount(), { placementName: 'team_nope' })).toBeUndefined()
    // (b) AMBIGUOUS family: TWO entries carry the same bindingId — which one
    //     is the call's binding is not this lane's to guess (never "first")
    const amb = healthyMount()
    const surf = amb.guard.dispatcher.surface as { names: () => string[]; entryOf: (n: string) => unknown }
    const carrier = (amb.guard.dispatcher.surface as unknown as { entryOf: (n: string) => { binding: unknown } }).entryOf('team_bash')
    surf.names = () => ['team_bash', 'team_bash_alias']
    surf.entryOf = (n: string) => (n === 'team_bash' || n === 'team_bash_alias' ? carrier : undefined)
    expect(await call(amb)).toBeUndefined()
    // (c) an entry that is not VERIFIED (or not ACTIVE) never answers
    const unverified = healthyMount()
    ;(unverified.guard.dispatcher.surface as { entryOf: (n: string) => unknown }).entryOf = (n: string) =>
      (n === 'team_bash' ? { verified: false, binding: { bindingId: 'team:scope:team_bash', status: 'ACTIVE', revision: 3, definitionIdentity: 'sha256:real-definition' } } : undefined)
    expect(await call(unverified)).toBeUndefined()
    // (d) the call's OWN binding identity wins and must be the carrier: a row
    //     from another family never resolves through the placement seed
    expect(await call(healthyMount(), { bindingId: 'some:other:family' })).toBeUndefined()
  })

  it('B10: one call, one identity — a conflicting effect set, realm, member, or mount answers undefined', async () => {
    // the live plan recorded ANOTHER effect set than the call asked about
    expect(await call(healthyMount(), { requestedEffects: { effects: callEffects.effects, fingerprint: 'sha256:some-other-set' } })).toBeUndefined()
    expect(await call(healthyMount(), { realmId: 'realm-z' })).toBeUndefined()
    expect(await call(healthyMount(), { instanceId: 'member-OTHER' })).toBeUndefined()
    expect(await call(healthyMount(), { mount: undefined, rootSessionId: 'root-unpublished-9e' })).toBeUndefined()
    expect(await call(healthyMount(), { callId: '' })).toBeUndefined()
    // a missing generation reader ⇒ undefined, never the constant 0 (B6 law)
    const noGen = healthyMount()
    ;(noGen.plane as unknown as { authorityGeneration: unknown }).authorityGeneration = undefined
    expect(await call(noGen)).toBeUndefined()
  })
})
