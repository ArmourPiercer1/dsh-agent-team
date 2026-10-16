/**
 * Alpha.5 PR0 — pure contracts & immutable authorization algebra (plan §3).
 *
 * POSITIVE half of the contract suite: the contract shapes parse, the binding
 * state machine walks its legal path, the Assurance triple stays three
 * independent dimensions, snapshots are immutable, and the PR3/PR4 interface
 * freeze points typecheck against closed Result/Error vocabularies.
 *
 * The NEGATIVE halves live in the sibling `a5p0-*-negatives` /
 * `a5p0-grant-replay` / `a5p0-planes` files (RED-first: they were written and
 * observed failing BEFORE any code under test existed).
 *
 * Semantic sources (verbatim where quoted):
 *  - post-poc-technical-design.md §2.1 (three independent dimensions), §4.1
 *    (binding state machine), §4.2 (internal contract shapes), §5 (error set).
 *  - alpha4-permission-governance-spec.md §5.2 / §24.3 (rank semantics and the
 *    two planes — REUSED through `domain/authority-envelope`, never restated).
 *  - S0-SELECTION-MATRIX.md §3 (polysemy normalization table).
 *
 * @module test/a5p0-contracts
 */
import { describe, expect, it } from 'vitest'

import {
  ASSURANCE_DIMENSIONS,
  ASSURANCE_LEVELS,
  BINDING_STATES,
  BINDING_TRANSITIONS,
  EFFECT_KINDS,
  EXECUTION_BOUNDARIES,
  EXECUTION_LEASE_KINDS,
  GOVERNANCE_ERROR_CODES,
  IMPLEMENTATION_ORIGINS,
  LEASE_STATUSES,
  RESOURCE_KINDS,
  RESOURCE_RIGHTS,
  advanceBindingStatus,
  assuranceSatisfies,
  openExecutionLease,
  parseAssuranceContract,
  parseExecutionLease,
  parseOperationGrant,
  parseRequestedEffectSet,
  parseResourceRef,
  parseToolBinding,
  parseToolPolicyDocument,
  requestLeaseCancellation,
  settleLeaseTermination,
  type AssuranceContract,
  type ControlledFs,
  type ConfinedProcessProvider,
  type ExecutionLease,
  type GovernanceResult,
  type MemberRef,
  type OperationAdmission,
  type OperationGrant,
  type ProviderGateway,
  type RequestedEffectSet,
  type ResourceRef,
  type ToolBinding,
} from '../tool-governance/src/index.js'

const ok = <T>(r: { ok: true; value: T } | { ok: false; problems: unknown }): T => {
  if (!r.ok) throw new Error(`expected ok, got: ${JSON.stringify(r)}`)
  return r.value
}

export const realm = 'realm:team-alpha:ws-1'

export const workspaceRead: ResourceRef = ok(
  parseResourceRef({ realmId: realm, kind: 'workspace', canonicalLocator: 'src/main.ts', rights: ['read'] }),
)

const homeFile: ResourceRef = ok(
  parseResourceRef({ realmId: realm, kind: 'realm-home', canonicalLocator: '~/.netrc', rights: ['meta'] }),
)

const netDest: ResourceRef = ok(
  parseResourceRef({ realmId: realm, kind: 'network-destination', canonicalLocator: 'https://example.com:443', rights: ['connect'] }),
)

const assuranceRaw = {
  implementationOrigin: 'team-trusted-extension',
  executionBoundary: 'confined-subprocess',
  assurance: {
    'content-read': 'enforced',
    'directory-metadata': 'partial',
    write: 'enforced',
    alias: 'partial',
    'network-destination': 'unsupported',
    'inherit-cancel': 'enforced',
  },
}

const bindingRaw = {
  bindingId: 'bind-0001',
  agentScopeKey: 'team:ts-1:member:inst-a1b2c3',
  toolName: 'read',
  definitionIdentity: 'def:sha256:aaaa',
  providerId: 'team-controlled-fs',
  implementationOrigin: 'team-trusted-extension',
  executionBoundary: 'confined-subprocess',
  assurance: assuranceRaw,
  policyGeneration: 4,
  authorityGeneration: 9,
  revision: 3,
  status: 'ACTIVE',
}

describe('vocabulary closed sets are the design’s frozen enumerations', () => {
  it('Effect kinds: tool invoke / read / write / list / meta / connect / domain-ref (design §4.2)', () => {
    expect(EFFECT_KINDS).toEqual(['tool-invoke', 'read', 'write', 'list', 'meta', 'connect', 'domain-ref'])
  })

  it('resource kinds distinguish workspace / Realm Home / absolute path / directory / metadata / network destination (design §4.2)', () => {
    expect(RESOURCE_KINDS).toEqual([
      'workspace',
      'realm-home',
      'absolute-path',
      'directory',
      'metadata',
      'network-destination',
    ])
    expect(RESOURCE_RIGHTS).toEqual(['read', 'write', 'list', 'meta', 'connect'])
  })

  it('the three assurance dimensions keep the design §2.1 value sets verbatim', () => {
    expect(IMPLEMENTATION_ORIGINS).toEqual([
      'dsh-native',
      'team-trusted-extension',
      'standalone-runner',
      'remote-provider',
    ])
    expect(EXECUTION_BOUNDARIES).toEqual(['trusted-host', 'confined-subprocess', 'delegated-remote'])
    expect(ASSURANCE_LEVELS).toEqual(['enforced', 'author-trusted', 'partial', 'unsupported', 'untested'])
    expect(ASSURANCE_DIMENSIONS).toEqual([
      'content-read',
      'directory-metadata',
      'write',
      'alias',
      'network-destination',
      'inherit-cancel',
    ])
  })

  it('binding states are the §4.1 assembly machine, in order', () => {
    expect(BINDING_STATES).toEqual(['UNBOUND', 'PREPARING', 'ACTIVE', 'DRAINING', 'TOMBSTONED', 'RELEASED'])
    // §4.1: no back-edges out of DRAINING/TOMBSTONED; RELEASED absorbs.
    expect(BINDING_TRANSITIONS.DRAINING).toEqual(['TOMBSTONED'])
    expect(BINDING_TRANSITIONS.TOMBSTONED).toEqual(['RELEASED'])
    expect(BINDING_TRANSITIONS.RELEASED).toEqual([])
    // PREPARING may abort back to UNBOUND ("任一失败不发布该 Agent") but ACTIVE
    // is reached only through a fresh PREPARING — never re-entered from DRAINING.
    expect(BINDING_TRANSITIONS.PREPARING).toEqual(['ACTIVE', 'UNBOUND'])
    expect(BINDING_TRANSITIONS.ACTIVE).toEqual(['DRAINING'])
  })

  it('the §5 error suggestion set is carried VERBATIM (spelling from the design source)', () => {
    expect([...GOVERNANCE_ERROR_CODES].sort()).toEqual(
      [
        'ADAPTER_DRAINING',
        'APPROVAL_STALE',
        'DOMAIN_DENIED',
        'EXECUTION_TERMINATION_UNCONFIRMED',
        'IO_POLICY_UNSUPPORTED',
        'SANDBOX_UNAVAILABLE',
        'TEAM_TOOL_UNGOVERNED',
        'TOOL_BINDING_UNVERIFIED',
      ].sort(),
    )
  })
})

describe('ResourceRef: kinds, rights matrix, immutable snapshots', () => {
  it('parses the filesystem-flavoured kinds and the network kind', () => {
    expect(workspaceRead.kind).toBe('workspace')
    expect(homeFile.canonicalLocator).toBe('~/.netrc')
    expect(netDest.rights).toEqual(['connect'])
    expect(Object.isFrozen(netDest) && Object.isFrozen(netDest.rights)).toBe(true)
  })

  it('normalizes rights to a canonical order and deduplicates them', () => {
    const r = ok(
      parseResourceRef({ realmId: realm, kind: 'directory', canonicalLocator: 'src', rights: ['meta', 'list', 'list', 'read'] }),
    )
    expect(r.rights).toEqual(['read', 'list', 'meta'])
  })
})

describe('RequestedEffectSet: canonical effects with a Fingerprint', () => {
  it('a set with all seven effect kinds canonicalizes and fingerprints', () => {
    const grantEffects = ok(
      parseRequestedEffectSet([
        { kind: 'tool-invoke', toolName: 'read', resource: null },
        { kind: 'read', resource: workspaceRead },
        {
          kind: 'write',
          resource: ok(
            parseResourceRef({ realmId: realm, kind: 'workspace', canonicalLocator: 'out.log', rights: ['write'] }),
          ),
        },
        {
          kind: 'list',
          resource: ok(parseResourceRef({ realmId: realm, kind: 'directory', canonicalLocator: 'src', rights: ['list'] })),
        },
        { kind: 'meta', resource: homeFile },
        { kind: 'connect', resource: netDest },
        { kind: 'domain-ref', domainAuthorityId: 'domain:hpc-cas', resource: null },
      ]),
    )
    expect(grantEffects.effects).toHaveLength(7)
    expect(grantEffects.fingerprint).toMatch(/^sha256:[0-9a-f]{64}$/)
    expect(Object.isFrozen(grantEffects) && Object.isFrozen(grantEffects.effects)).toBe(true)
    // Re-parse of the canonical value round-trips and the fingerprint re-verifies.
    const again = ok(parseRequestedEffectSet(grantEffects))
    expect(again.fingerprint).toBe(grantEffects.fingerprint)
  })
})

describe('AssuranceContract is derived-capability vocabulary, not a second permission switch', () => {
  it('parses all six dimensions and answers capability coverage honestly', () => {
    const contract = ok(parseAssuranceContract(assuranceRaw))
    // Hard (OS-enforced) requirement on a dimension the contract marks 'partial'
    // must fail — Assurance must never be read as an authorization widen.
    const hard = assuranceSatisfies(contract, { 'directory-metadata': 'hard' })
    expect(hard.ok).toBe(false)
    expect(hard.failing).toEqual(['directory-metadata'])
    const soft = assuranceSatisfies(contract, {
      'content-read': 'hard',
      write: 'hard',
      'inherit-cancel': 'authoritative',
    })
    expect(soft.ok).toBe(true)
  })

  it('refuses a missing dimension (the Provider must state EVERY dimension it claims)', () => {
    const partial = { ...assuranceRaw.assurance } as Record<string, string>
    delete partial['alias']
    expect(parseAssuranceContract({ ...assuranceRaw, assurance: partial }).ok).toBe(false)
  })
})

describe('ToolBinding: state machine + three-dimension consistency', () => {
  it('parses a live ACTIVE binding', () => {
    const b = ok(parseToolBinding(bindingRaw))
    expect(b.status).toBe('ACTIVE')
    expect(b.revision).toBe(3)
  })

  it('the assurance dimensions must agree with the binding’s own origin/boundary fields', () => {
    expect(parseToolBinding({ ...bindingRaw, executionBoundary: 'trusted-host' }).ok).toBe(false)
    expect(
      parseToolBinding({
        ...bindingRaw,
        assurance: { ...assuranceRaw, implementationOrigin: 'dsh-native' },
      }).ok,
    ).toBe(false)
  })

  it('walks UNBOUND→PREPARING→ACTIVE→DRAINING→TOMBSTONED→RELEASED as pure transitions', () => {
    let b = ok(parseToolBinding({ ...bindingRaw, status: 'UNBOUND' }))
    for (const next of ['PREPARING', 'ACTIVE', 'DRAINING', 'TOMBSTONED', 'RELEASED'] as const) {
      const advanced = advanceBindingStatus(b, next)
      expect(advanced.ok, `UNBOUND→…→${next}`).toBe(true)
      if (advanced.ok) {
        b = advanced.binding
        expect(b.status).toBe(next)
      }
    }
    // terminal: RELEASED has no successor; the refusal is typed, not a throw.
    expect(advanceBindingStatus(b, 'UNBOUND').ok).toBe(false)
  })
})

describe('ExecutionLease: scopes to the Grant, cancellation ≠ termination', () => {
  const member: MemberRef = { teamSessionId: 'ts-1', instanceId: 'inst-a1b2c3' }

  const effects: RequestedEffectSet = ok(
    parseRequestedEffectSet([
      { kind: 'tool-invoke', toolName: 'bash', resource: null },
      { kind: 'read', resource: workspaceRead },
    ]),
  )

  const grant: OperationGrant = ok(
    parseOperationGrant({
      grantId: 'grant-1',
      member,
      callId: 'call-1',
      realmId: realm,
      bindingId: 'bind-0001',
      bindingRevision: 3,
      authorityGeneration: 9,
      parametersFingerprint: 'sha256:bbbb',
      effects,
      singleUse: true,
      issuedAt: 1000,
      expiresAt: null,
    }),
  )

  it('opens a lease inside the grant scope', () => {
    const lease = ok(openExecutionLease({ leaseId: 'lease-1', grant, executionKind: 'process-tree', scope: effects }))
    expect(lease.status).toBe('active')
    expect(lease.grantFingerprint).toBe(effects.fingerprint)
    expect(LEASE_STATUSES).toEqual(['active', 'cancelling', 'termination-unconfirmed', 'terminated'])
    expect(EXECUTION_LEASE_KINDS).toEqual(['background-instance', 'process-tree', 'remote-job'])
  })

  it('a cancellation is a REQUEST; only settlement says whether the side effect stopped', () => {
    const lease = ok(openExecutionLease({ leaseId: 'lease-2', grant, executionKind: 'remote-job', scope: effects }))
    const cancelling = ok(openExecutionLease({ leaseId: 'lease-2', grant, executionKind: 'remote-job', scope: effects }))
    expect(cancelling.status).toBe('active')
    const requested = requestLeaseCancellation(cancelling)
    expect(requested.ok).toBe(true)
    if (!requested.ok) return
    expect(requested.lease.status).toBe('cancelling') // kill requested != terminated (design §3.6)
    const unconfirmed = settleLeaseTermination(requested.lease, false)
    expect(unconfirmed.ok && unconfirmed.lease.status).toBe('termination-unconfirmed')
    // 'terminated' is absorbing: once confirmed, it never reopens.
    const confirmed = settleLeaseTermination(requested.lease, true)
    expect(confirmed.ok && confirmed.lease.status).toBe('terminated')
    if (confirmed.ok) expect(requestLeaseCancellation(confirmed.lease).ok).toBe(false)
    expect(lease.grantFingerprint).toBe(effects.fingerprint)
  })

  it('parseExecutionLease refuses a lease whose scope contains an effect outside its Grant', () => {
    const wider = ok(
      parseRequestedEffectSet([
        ...effects.effects,
        {
          kind: 'write',
          resource: ok(parseResourceRef({ realmId: realm, kind: 'workspace', canonicalLocator: 'secret', rights: ['write'] })),
        },
      ]),
    )
    const bad = parseExecutionLease({
      leaseId: 'lease-3',
      grantId: grant.grantId,
      grantFingerprint: grant.effects.fingerprint,
      bindingId: grant.bindingId,
      member: grant.member,
      realmId: grant.realmId,
      executionKind: 'process-tree',
      scope: wider,
      status: 'active',
    })
    expect(bad.ok).toBe(false)
  })
})

describe('ToolPolicyDocument parses the realm-scoped rule shape', () => {
  it('accepts realm-bound rules over the seven effect kinds', () => {
    const doc = ok(
      parseToolPolicyDocument({
        rules: [
          { realmId: realm, effectKind: 'read', matcher: { kind: 'exact', resource: 'src/main.ts' }, maximumEffect: 'allow' },
          { realmId: realm, effectKind: 'write', matcher: { kind: 'subtree', resource: 'src' }, maximumEffect: 'ask' },
        ],
      }),
    )
    expect(doc.rules).toHaveLength(2)
  })
})

// ---------------------------------------------------------------------------
// Interface freeze points — compile-time legs.
// Each @ts-expect-error below IS the negative type test: if a frozen shape
// ever widens, the expectation goes unused and the typecheck fails.
// ---------------------------------------------------------------------------

describe('interface freeze points typecheck as closed contracts', () => {
  it('OperationAdmission / ControlledFs / ConfinedProcessProvider / ProviderGateway are nominally implementable', () => {
    const admission: OperationAdmission | null = null
    const cfs: ControlledFs | null = null
    const proc: ConfinedProcessProvider | null = null
    const gw: ProviderGateway | null = null
    expect([admission, cfs, proc, gw]).toEqual([null, null, null, null])

    // The ok-arm carries the value: EXTRACT the discriminated arm and build it.
    type OkArm = Extract<GovernanceResult<number>, { ok: true }>
    const resultOkNarrow: OkArm = { ok: true, value: 7 }
    expect(resultOkNarrow.value).toBe(7)

    // Negative: an 'admitted' decision arm WITHOUT the grant is not assignable.
    // @ts-expect-error — 'admitted' must carry the single-use grant
    const badAdmitted: import('../tool-governance/src/index.js').OperationAdmissionDecision = { kind: 'admitted' }
    expect(typeof badAdmitted).toBe('object')

    // Negative: a lease status outside the closed set is not assignable.
    // @ts-expect-error — 'running' is not a lease status
    const badStatus: ExecutionLease['status'] = 'running'
    expect(badStatus).toBe('running')

    // Negative: the Assurance map must cover ALL six dimensions.
    // @ts-expect-error — missing dimensions are not assignable
    const partialContract: AssuranceContract = { implementationOrigin: 'dsh-native', executionBoundary: 'trusted-host', assurance: { 'content-read': 'enforced' } }
    expect(partialContract).toBeTruthy()

    // Negative: a binding status outside the closed state machine is not assignable.
    // @ts-expect-error — 'PAUSED' is not a binding state
    const badState: ToolBinding['status'] = 'PAUSED'
    expect(badState).toBe('PAUSED')
  })
})
