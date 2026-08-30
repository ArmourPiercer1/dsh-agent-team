/**
 * P6-T1 S-checks — unit tests for the admission/provisioning check functions
 * (DevPlan §19.2 check order, the pieces the integration suites only see
 * through the provider):
 *
 *  - C1 the stable operation identity: the NUL-joined key, determinism,
 *    the token hygiene rules (empty / >256 / NUL → REQUEST_MALFORMED),
 *    the deterministic instance-id allocation;
 *  - C2 source admission: the closed vocabulary passes, an unknown source
 *    fails loud (SOURCE_NOT_ADMITTED);
 *  - C3 the quota gates: absent quota = unlimited; every bound fails with
 *    its exact code (team maxInstances / maxConcurrent, member
 *    maxInstances / maxConcurrent);
 *  - C4 in-flight reservation counting: a PREPARED provision operation is
 *    counted in the quota totals (real journal row over a scratch world);
 *  - C5 the creation fields: workspace inheritance (explicit > team default
 *    > absent), the frozen contextPolicy, the unknown-policy fail-closed
 *    (TEMPLATE_CONTEXT_POLICY_UNKNOWN);
 *  - C6 the overlay bounds: team allow ∩ template allow minus both denies,
 *    fail-closed empty (the fixture worker is bound to nothing);
 *  - C7 the durable-error mapping (mapActivationDurableError): the two
 *    typed protocol problems map to their activation codes, everything
 *    else is rethrown, and it ALWAYS throws;
 *  - C8 the compatibility gate: a requirement in an unknown domain fails
 *    closed (COMPATIBILITY_BLOCKED_FATAL).
 *
 * @module @dsh-agent-team/runtime/test/p6t1-checks
 */

import { describe, expect, it } from 'vitest'
import {
  ACTIVATION_ERROR_CODES,
  ACTIVATION_SOURCES,
  ACTIVATION_SOURCE_VALUES,
  ACTIVATION_TOKEN_MAX_LENGTH,
  activationOperationIdentity,
  activationOperationKey,
  allocateActivationInstanceId,
  admitSource,
  checkQuota,
  computeOverlayBounds,
  countTeamQuota,
  evaluateActivationCompatibility,
  mapActivationDurableError,
  resolveCreationFields,
} from '../activation/index.js'
import type { ActivationSource } from '../activation/index.js'
import { parseBlueprint } from '../../domain/blueprint/src/index.js'
import {
  TEAM_DOMAIN_ERROR_CODES,
  TeamDomainError,
} from '../../storage/schema/index.js'
import { createOperationJournal } from '../../storage/operations/index.js'
import { PROVISION_INTENT_TYPE } from '../../storage/provisioning/index.js'
import {
  P6T1_FIXTURE,
  parseFixtureBlueprint,
  createP6T1World,
  destroyP6T1World,
} from './p6t1-helpers.js'

const ROOT = String(P6T1_FIXTURE.rootSessionId)
const SOURCE = ACTIVATION_SOURCES.LEADER_EXPLICIT

// ---------------------------------------------------------------------------
// C1 — the stable operation identity
// ---------------------------------------------------------------------------
describe('P6-T1 C1: the stable operation identity (admit-once key)', () => {
  it('the key is the NUL-joined (root, source, token) triple', () => {
    expect(activationOperationKey(ROOT, SOURCE, 'tok-a')).toBe(
      `${ROOT}\u0000${SOURCE}\u0000tok-a`,
    )
  })

  it('the key and the allocation are deterministic (same logical op → same identity)', () => {
    const a = activationOperationIdentity(ROOT, SOURCE, 'tok-det')
    const b = activationOperationIdentity(ROOT, SOURCE, 'tok-det')
    expect(activationOperationKey(ROOT, SOURCE, 'tok-det')).toBe(
      activationOperationKey(ROOT, SOURCE, 'tok-det'),
    )
    expect(a.instanceId).toBe(b.instanceId)
    expect(a.operationId).toBe(b.operationId)
    expect(a.idempotencyKey).toBe(b.idempotencyKey)
    expect(/^inst-[a-z0-9]{12}$/.test(a.instanceId)).toBe(true)
    expect(allocateActivationInstanceId(ROOT, SOURCE, 'tok-det')).toBe(a.instanceId)
  })

  it('different tokens allocate different instances; different sources too', () => {
    const a = activationOperationIdentity(ROOT, SOURCE, 'tok-x')
    const b = activationOperationIdentity(ROOT, SOURCE, 'tok-y')
    const c = activationOperationIdentity(ROOT, ACTIVATION_SOURCES.HUMAN_UI, 'tok-x')
    expect(a.instanceId).not.toBe(b.instanceId)
    expect(a.instanceId).not.toBe(c.instanceId)
  })

  it('an empty token fails REQUEST_MALFORMED', () => {
    let error: unknown
    try {
      activationOperationKey(ROOT, SOURCE, '')
    } catch (e) {
      error = e
    }
    const record = error as { name?: unknown; code?: unknown }
    expect(record.name).toBe('ActivationError')
    expect(record.code).toBe(ACTIVATION_ERROR_CODES.REQUEST_MALFORMED)
  })

  it(`a token longer than ${ACTIVATION_TOKEN_MAX_LENGTH} characters fails REQUEST_MALFORMED`, () => {
    let error: unknown
    try {
      activationOperationKey(ROOT, SOURCE, 't'.repeat(ACTIVATION_TOKEN_MAX_LENGTH + 1))
    } catch (e) {
      error = e
    }
    const record = error as { name?: unknown; code?: unknown }
    expect(record.name).toBe('ActivationError')
    expect(record.code).toBe(ACTIVATION_ERROR_CODES.REQUEST_MALFORMED)
  })

  it('a token containing NUL fails REQUEST_MALFORMED', () => {
    let error: unknown
    try {
      activationOperationKey(ROOT, SOURCE, 'a\u0000b')
    } catch (e) {
      error = e
    }
    const record = error as { name?: unknown; code?: unknown }
    expect(record.name).toBe('ActivationError')
    expect(record.code).toBe(ACTIVATION_ERROR_CODES.REQUEST_MALFORMED)
  })
})

// ---------------------------------------------------------------------------
// C2 — source admission (closed vocabulary)
// ---------------------------------------------------------------------------
describe('P6-T1 C2: source admission is a closed vocabulary', () => {
  it('every closed-vocabulary source is admitted', () => {
    for (const source of ACTIVATION_SOURCE_VALUES as readonly ActivationSource[]) {
      let threw = false
      try {
        admitSource(source)
      } catch {
        threw = true
      }
      expect(threw).toBe(false)
    }
  })

  it('a source outside the closed vocabulary fails SOURCE_NOT_ADMITTED', () => {
    let error: unknown
    try {
      admitSource('bogus' as unknown as ActivationSource)
    } catch (e) {
      error = e
    }
    const record = error as { name?: unknown; code?: unknown }
    expect(record.name).toBe('ActivationError')
    expect(record.code).toBe(ACTIVATION_ERROR_CODES.SOURCE_NOT_ADMITTED)
  })
})

// ---------------------------------------------------------------------------
// C3 — the quota gates
// ---------------------------------------------------------------------------
describe('P6-T1 C3: the quota gates (absent = unlimited; each bound has its code)', () => {
  const ZERO = { teamTotal: 0, teamActive: 0, templateTotal: 0, templateActive: 0 }

  it('an absent quota spec admits everything', () => {
    let threw = false
    try {
      checkQuota(undefined, { ...ZERO, teamTotal: 10_000, teamActive: 10_000, templateTotal: 10_000, templateActive: 10_000 }, 'worker')
    } catch {
      threw = true
    }
    expect(threw).toBe(false)
  })

  it('team maxInstances fails QUOTA_TEAM_MAX_INSTANCES at current+1 > max', () => {
    let error: unknown
    try {
      checkQuota(
        { team: { maxInstances: 4 } },
        { ...ZERO, teamTotal: 4 },
        'worker',
      )
    } catch (e) {
      error = e
    }
    const record = error as { name?: unknown; code?: unknown; details?: Record<string, unknown> }
    expect(record.code).toBe(ACTIVATION_ERROR_CODES.QUOTA_TEAM_MAX_INSTANCES)
    expect(record.details?.['maxInstances']).toBe(4)
    // One below the bound admits.
    let ok = true
    try {
      checkQuota({ team: { maxInstances: 4 } }, { ...ZERO, teamTotal: 3 }, 'worker')
    } catch {
      ok = false
    }
    expect(ok).toBe(true)
  })

  it('team maxConcurrent fails QUOTA_TEAM_MAX_CONCURRENT at active+1 > max', () => {
    let error: unknown
    try {
      checkQuota(
        { team: { maxConcurrent: 3 } },
        { ...ZERO, teamTotal: 10, teamActive: 3 },
        'worker',
      )
    } catch (e) {
      error = e
    }
    expect((error as { code?: unknown }).code).toBe(ACTIVATION_ERROR_CODES.QUOTA_TEAM_MAX_CONCURRENT)
  })

  it('member maxInstances fails QUOTA_MEMBER_MAX_INSTANCES for the template', () => {
    let error: unknown
    try {
      checkQuota(
        { members: { maxInstances: 2 } },
        { ...ZERO, templateTotal: 2, teamTotal: 2 },
        'worker',
      )
    } catch (e) {
      error = e
    }
    const record = error as { code?: unknown; details?: Record<string, unknown> }
    expect(record.code).toBe(ACTIVATION_ERROR_CODES.QUOTA_MEMBER_MAX_INSTANCES)
    expect(record.details?.['templateId']).toBe('worker')
  })

  it('member maxConcurrent fails QUOTA_MEMBER_MAX_CONCURRENT for the template', () => {
    let error: unknown
    try {
      checkQuota(
        { members: { maxConcurrent: 1 } },
        { ...ZERO, templateTotal: 5, templateActive: 1, teamTotal: 5, teamActive: 1 },
        'worker',
      )
    } catch (e) {
      error = e
    }
    expect((error as { code?: unknown }).code).toBe(ACTIVATION_ERROR_CODES.QUOTA_MEMBER_MAX_CONCURRENT)
  })
})

// ---------------------------------------------------------------------------
// C4 — in-flight reservation counting (real journal row)
// ---------------------------------------------------------------------------
let c4: {
  readonly counts: {
    teamTotal: number
    teamActive: number
    templateTotal: number
    templateActive: number
  }
  readonly opPhase: string | undefined
}
{
  const world = await createP6T1World('p6t1x-c4')
  try {
    // One committed member (seeded) + one in-flight provision (journal PREPARED).
    const identity = activationOperationIdentity(ROOT, SOURCE, 'tok-p6t1-inflight')
    const journal = createOperationJournal(world.domain, ROOT)
    await journal.prepare({
      operationId: identity.operationId,
      idempotencyKey: identity.idempotencyKey,
      intent: {
        type: PROVISION_INTENT_TYPE,
        payload: {
          label: 'inflight',
          instanceId: identity.instanceId,
          rootSessionId: ROOT,
          templateId: 'worker',
        },
      },
    })
    const members = world.domain.repositories.memberInstances.list(ROOT)
    const operations = world.domain.repositories.operations.list()
    c4 = {
      counts: countTeamQuota({ members, operations }, ROOT, 'worker'),
      opPhase: world.domain.repositories.operations.get(identity.operationId)?.phase,
    }
  } finally {
    await destroyP6T1World(world)
  }
}

describe('P6-T1 C4: an in-flight PREPARED provision operation counts in the quotas', () => {
  it('the fresh world has the PREPARED row and the in-flight counts (0 committed + 1 in-flight)', () => {
    expect(c4.opPhase).toBe('PREPARED')
    expect(c4.counts).toEqual({ teamTotal: 1, teamActive: 1, templateTotal: 1, templateActive: 1 })
  })

  it('the reservation is what makes the quota race exact (counts feed checkQuota)', () => {
    let error: unknown
    try {
      checkQuota(
        { members: { maxInstances: 1 } },
        c4.counts,
        'worker',
      )
    } catch (e) {
      error = e
    }
    expect((error as { code?: unknown }).code).toBe(ACTIVATION_ERROR_CODES.QUOTA_MEMBER_MAX_INSTANCES)
  })
})

// ---------------------------------------------------------------------------
// C5 — creation fields (workspace inheritance, frozen contextPolicy)
// ---------------------------------------------------------------------------
let c5: {
  readonly explicit: string | undefined
  readonly inherited: string | undefined
  readonly absent: unknown
  readonly freshPolicy: string
  readonly defaultPolicy: string
  readonly unknownPolicy: unknown
}
{
  const world = await createP6T1World('p6t1x-c5')
  try {
    const teamSession = world.domain.repositories.teamSessions.get(ROOT)
    if (teamSession === undefined) throw new Error('C5: missing team session')
    const baseRequest = {
      rootSessionId: ROOT,
      source: SOURCE,
      templateId: 'worker',
      label: 'fields-member',
      requestToken: 'tok-p6t1-c5',
    }
    const explicit = resolveCreationFields(
      teamSession,
      { ...baseRequest, workspace: 'C:/explicit/p6t1' },
      { contextPolicy: 'persistent' },
    )
    const inherited = resolveCreationFields(teamSession, baseRequest, { contextPolicy: 'persistent' })
    const noDefault = resolveCreationFields(
      { ...teamSession, defaultWorkspace: undefined },
      baseRequest,
      { contextPolicy: 'persistent' },
    )
    const freshPolicy = resolveCreationFields(
      teamSession,
      baseRequest,
      { contextPolicy: 'fresh_per_delegation' },
    )
    const defaultPolicy = resolveCreationFields(teamSession, baseRequest, {})
    let unknownPolicy: unknown
    try {
      resolveCreationFields(teamSession, baseRequest, { contextPolicy: 'bogus_policy' })
    } catch (error) {
      unknownPolicy = error
    }
    c5 = {
      explicit: explicit.workspace,
      inherited: inherited.workspace,
      absent: noDefault.workspace,
      freshPolicy: freshPolicy.contextPolicy,
      defaultPolicy: defaultPolicy.contextPolicy,
      unknownPolicy,
    }
  } finally {
    await destroyP6T1World(world)
  }
}

describe('P6-T1 C5: creation fields are frozen at creation', () => {
  it('workspace inheritance: explicit > team default > absent', () => {
    expect(c5.explicit).toBe('C:/explicit/p6t1')
    expect(c5.inherited).toBe(P6T1_FIXTURE.defaultWorkspace)
    expect(c5.absent).toBe(undefined)
  })

  it('the contextPolicy is frozen from the template (fresh kept, absent → persistent)', () => {
    expect(c5.freshPolicy).toBe('fresh_per_delegation')
    expect(c5.defaultPolicy).toBe('persistent')
  })

  it('an unknown template contextPolicy token fails TEMPLATE_CONTEXT_POLICY_UNKNOWN', () => {
    const record = c5.unknownPolicy as { name?: unknown; code?: unknown }
    expect(record.name).toBe('ActivationError')
    expect(record.code).toBe(ACTIVATION_ERROR_CODES.TEMPLATE_CONTEXT_POLICY_UNKNOWN)
  })
})

// ---------------------------------------------------------------------------
// C6 — overlay bounds (team allow ∩ template allow minus denies)
// ---------------------------------------------------------------------------
const P6T1_OVERLAY_BLUEPRINT_SOURCE = [
  '---',
  'schemaVersion: 1',
  'blueprintId: P6T1-OVERLAY',
  'revision: "1"',
  'leader:',
  '  templateId: leader',
  '  persona: You lead the overlay team.',
  'members:',
  '  - templateId: worker',
  '    displayName: Worker',
  '    persona: Overlay worker.',
  'requirements: []',
  'teamEnvelope:',
  '  allow:',
  '    - op-a',
  '    - op-b',
  '    - op-c',
  '  deny: []',
  'memberEnvelopes:',
  '  - templateId: worker',
  '    envelope:',
  '      allow:',
  '        - op-a',
  '      deny:',
  '        - op-b',
  'policyStates:',
  '  - id: default',
  '    description: Default.',
  'metadata: {}',
  '---',
  '',
].join('\n')

const P6T1_OVERLAY_TEAM_DENY_SOURCE = [
  '---',
  'schemaVersion: 1',
  'blueprintId: P6T1-OVERLAY-TD',
  'revision: "1"',
  'leader:',
  '  templateId: leader',
  '  persona: You lead the overlay deny team.',
  'members:',
  '  - templateId: worker',
  '    displayName: Worker',
  '    persona: Overlay worker.',
  'requirements: []',
  'teamEnvelope:',
  '  allow:',
  '    - op-a',
  '  deny:',
  '    - op-b',
  'memberEnvelopes:',
  '  - templateId: worker',
  '    envelope:',
  '      allow:',
  '        - op-a',
  '        - op-b',
  '      deny: []',
  'policyStates:',
  '  - id: default',
  '    description: Default.',
  'metadata: {}',
  '---',
  '',
].join('\n')

describe('P6-T1 C6: overlay bounds are fail-closed intersections', () => {
  it('the fixture worker is bound to NOTHING (its template allow misses the team allow)', () => {
    const fixture = parseFixtureBlueprint()
    expect(computeOverlayBounds(fixture, 'worker')).toEqual([])
  })

  it('unknown template → fail-closed empty', () => {
    const fixture = parseFixtureBlueprint()
    expect(computeOverlayBounds(fixture, 'ghost')).toEqual([])
  })

  it('team allow ∩ template allow minus the template deny (fail-closed on the template miss)', () => {
    const overlay = parseBlueprint(P6T1_OVERLAY_BLUEPRINT_SOURCE)
    // team allow {op-a, op-b, op-c} ∩ template allow {op-a} \ template deny {op-b} = {op-a}
    // (op-b is admitted by the team but denied by the template → fail-closed;
    //  op-c is admitted by the team but not offered by the template → fail-closed)
    expect(computeOverlayBounds(overlay, 'worker')).toEqual(['op-a'])
  })

  it('the team allow list is the outer bound (template-offered ops the team does not allow are excluded)', () => {
    const overlay = parseBlueprint(P6T1_OVERLAY_TEAM_DENY_SOURCE)
    // team allow {op-a} \ team deny {op-b} ∩ template allow {op-a, op-b} = {op-a}
    // (op-b is offered by the template but not carried by the team allow list → fail-closed)
    // Note: the `!teamDeny` branch in computeOverlayBounds is defensive — the blueprint
    // validator enforces allow ∩ deny = ∅ per envelope, so no valid blueprint can put an
    // operation in BOTH the team allow and the team deny.
    expect(computeOverlayBounds(overlay, 'worker')).toEqual(['op-a'])
  })
})

// ---------------------------------------------------------------------------
// C7 — the durable-error mapping (ALWAYS throws)
// ---------------------------------------------------------------------------
describe('P6-T1 C7: mapActivationDurableError maps the typed protocol problems', () => {
  it("a TeamDomainError with problem 'idempotency-conflict' maps to IDEMPOTENCY_CONFLICT", () => {
    const durable = new TeamDomainError(
      TEAM_DOMAIN_ERROR_CODES.RECORD_DUPLICATE,
      'simulated idempotency conflict',
      { problem: 'idempotency-conflict' },
    )
    let error: unknown
    try {
      mapActivationDurableError(durable, { rootSessionId: ROOT })
    } catch (e) {
      error = e
    }
    const record = error as { name?: unknown; code?: unknown; details?: Record<string, unknown> }
    expect(record.name).toBe('ActivationError')
    expect(record.code).toBe(ACTIVATION_ERROR_CODES.IDEMPOTENCY_CONFLICT)
    expect(record.details?.['code']).toBe(TEAM_DOMAIN_ERROR_CODES.RECORD_DUPLICATE)
    expect(record.details?.['rootSessionId']).toBe(ROOT)
  })

  it("a TeamDomainError with problem 'child-session-conflict' maps to CHILD_SESSION_CONFLICT", () => {
    const durable = new TeamDomainError(
      TEAM_DOMAIN_ERROR_CODES.RECORD_DUPLICATE,
      'simulated child session conflict',
      { problem: 'child-session-conflict' },
    )
    let error: unknown
    try {
      mapActivationDurableError(durable, {})
    } catch (e) {
      error = e
    }
    const record = error as { code?: unknown }
    expect(record.code).toBe(ACTIVATION_ERROR_CODES.CHILD_SESSION_CONFLICT)
  })

  it('any other error (including a TeamDomainError with another problem) is rethrown as-is', () => {
    const foreign = new Error('foreign failure')
    let error: unknown
    try {
      mapActivationDurableError(foreign, {})
    } catch (e) {
      error = e
    }
    expect(error).toBe(foreign)
    const otherProblem = new TeamDomainError(
      TEAM_DOMAIN_ERROR_CODES.RECORD_INVALID,
      'unrelated',
      { problem: 'record-invalid' },
    )
    let error2: unknown
    try {
      mapActivationDurableError(otherProblem, {})
    } catch (e) {
      error2 = e
    }
    expect(error2).toBe(otherProblem)
  })
})

// ---------------------------------------------------------------------------
// C8 — the compatibility gate: unknown requirement domain fails closed
// ---------------------------------------------------------------------------
const P6T1_UNKNOWN_DOMAIN_SOURCE = [
  '---',
  'schemaVersion: 1',
  'blueprintId: P6T1-UNKDOMAIN',
  'revision: "1"',
  'leader:',
  '  templateId: leader',
  '  persona: Unknown domain team.',
  'members:',
  '  - templateId: worker',
  '    displayName: Worker',
  '    persona: Worker.',
  'requirements:',
  '  - domain: web',
  '    name: browser',
  'policyStates:',
  '  - id: default',
  '    description: Default.',
  'metadata: {}',
  '---',
  '',
].join('\n')

describe('P6-T1 C8: the compatibility gate fails closed on an unknown requirement domain', () => {
  it('a requirement in domain "web" (no RequirementType mapping) is COMPATIBILITY_BLOCKED_FATAL', () => {
    const blueprint = parseBlueprint(P6T1_UNKNOWN_DOMAIN_SOURCE)
    let error: unknown
    try {
      evaluateActivationCompatibility(blueprint, [], undefined)
    } catch (e) {
      error = e
    }
    const record = error as { name?: unknown; code?: unknown }
    expect(record.name).toBe('ActivationError')
    expect(record.code).toBe(ACTIVATION_ERROR_CODES.COMPATIBILITY_BLOCKED_FATAL)
  })

  it('the fixture blueprint evaluates (known domains map) — the gate is not over-blocking', () => {
    const fixture = parseFixtureBlueprint()
    const facts = [
      { domain: 'tool' as const, subject: 'web', available: true, generation: 1 },
      { domain: 'skill' as const, subject: 'base', available: true, generation: 1 },
    ]
    let result: unknown
    try {
      result = evaluateActivationCompatibility(fixture, facts, undefined)
    } catch (error) {
      result = error
    }
    expect((result as { status?: unknown }).status).toBe('OPEN')
  })
})
