/**
 * pre-alpha3 PR-E (plan §E.5) — the durable RequirementAuthority facts:
 * closed vocabulary + fail-closed parsers + the deep-frozen payload builders
 * + the writer (allocateSequence then put). All four facts land under the
 * FROZEN `compatibility` category (NO new ledger category).
 *
 * @module @dsh-agent-team/runtime/test/requirement-facts
 */

import { describe, expect, it } from 'vitest'

import {
  isRequirementFactType,
  OPTIONAL_REQUIREMENT_ACCEPTED_FACT_TYPE,
  OPTIONAL_REQUIREMENT_ACCEPTED_FIELDS,
  parseOptionalRequirementAccepted,
  parseRecoveryIncidentClosed,
  parseRecoveryIncidentOpened,
  parseTemplateAvailabilitySet,
  RECOVERY_INCIDENT_CLOSED_FACT_TYPE,
  RECOVERY_INCIDENT_CLOSED_FIELDS,
  RECOVERY_INCIDENT_OPENED_FACT_TYPE,
  RECOVERY_INCIDENT_OPENED_FIELDS,
  recoveryIncidentClosedPayload,
  recoveryIncidentOpenedPayload,
  REQUIREMENT_FACT_CATEGORY,
  REQUIREMENT_FACT_TYPES,
  REQUIREMENT_FACT_TYPE_VALUES,
  optionalRequirementAcceptedPayload,
  templateAvailabilitySetPayload,
  TEMPLATE_AVAILABILITY_SET_FACT_TYPE,
  TEMPLATE_AVAILABILITY_SET_FIELDS,
  writeRequirementFact,
} from '../requirements/index.js'

describe('E.5 the closed fact vocabulary', () => {
  it('has exactly the four PR-E requirement fact types', () => {
    expect([...REQUIREMENT_FACT_TYPE_VALUES].sort()).toEqual(
      [
        'optional-requirement-accepted',
        'recovery-incident-closed',
        'recovery-incident-opened',
        'template-availability-set',
      ].sort(),
    )
  })

  it('isRequirementFactType guards the closed set', () => {
    for (const t of REQUIREMENT_FACT_TYPE_VALUES) expect(isRequirementFactType(t)).toBe(true)
    expect(isRequirementFactType('nope')).toBe(false)
    expect(isRequirementFactType(123)).toBe(false)
    expect(isRequirementFactType(null)).toBe(false)
  })

  it('every PR-E fact lands in the FROZEN compatibility category (no new category)', () => {
    expect(REQUIREMENT_FACT_CATEGORY).toBe('compatibility')
  })

  it('the frozen payload field sets are the exact closed shapes', () => {
    // Finding J (2026-10-01) — ADDITIVE contract change (disclosed): the
    // consent fact gains its key fields (the scope + bound blueprint content
    // hash the consent binds to, ADR-12). Legacy rows (written before the
    // keying) carry neither and remain LEGAL — the keyed matching honors a
    // legacy row only in a legacy (hash-unmodeled) evaluation, fail-closed
    // otherwise (it must be re-granted).
    expect([...OPTIONAL_REQUIREMENT_ACCEPTED_FIELDS].sort()).toEqual(
      ['consentedAt', 'consentedBy', 'contentHash', 'generation', 'requirementId', 'scopeKey'].sort(),
    )
    expect([...TEMPLATE_AVAILABILITY_SET_FIELDS].sort()).toEqual(['at', 'available', 'templateId'].sort())
    expect([...RECOVERY_INCIDENT_OPENED_FIELDS].sort()).toEqual(['openedAt', 'requirementIds', 'scope'].sort())
    expect([...RECOVERY_INCIDENT_CLOSED_FIELDS].sort()).toEqual(['closedAt', 'requirementIds', 'scope'].sort())
  })
})

describe('E.5 payload builders + fail-closed parsers round-trip', () => {
  it('optional-requirement-accepted round-trips', () => {
    const payload = optionalRequirementAcceptedPayload({
      requirementId: 'work.optional-mcp',
      generation: 3,
      consentedAt: 1234567890,
      consentedBy: 'human-42',
    })
    expect(parseOptionalRequirementAccepted(payload, 'optional-requirement-accepted')).toEqual(payload)
  })

  it('optional-requirement-accepted round-trips WITH the consent key (Finding J — additive)', () => {
    // The keyed row: the scope + bound blueprint content hash ride the
    // durable payload (ADR-12 consent key). The key fields are
    // omit-when-absent: a legacy 4-field row still round-trips byte-identical
    // (the test above), a keyed row carries both.
    const keyed = optionalRequirementAcceptedPayload({
      requirementId: 'work.optional-mcp',
      generation: 3,
      consentedAt: 1234567890,
      consentedBy: 'human-42',
      scopeKey: 'template:worker',
      contentHash: 'sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
    })
    expect(parseOptionalRequirementAccepted(keyed, 'optional-requirement-accepted')).toEqual(keyed)
    expect(keyed.scopeKey).toBe('template:worker')
    expect(keyed.contentHash).toBeDefined()
    // A key field PRESENT but malformed = fail-closed (never a silent drop).
    expect(() =>
      parseOptionalRequirementAccepted(
        { requirementId: 'a', generation: 1, consentedAt: 1, consentedBy: 'h', scopeKey: '' },
        'optional-requirement-accepted',
      ),
    ).toThrow(/scopeKey/)
    expect(() =>
      parseOptionalRequirementAccepted(
        { requirementId: 'a', generation: 1, consentedAt: 1, consentedBy: 'h', contentHash: 42 },
        'optional-requirement-accepted',
      ),
    ).toThrow(/contentHash/)
  })

  it('template-availability-set round-trips', () => {
    const payload = templateAvailabilitySetPayload({ templateId: 'worker', available: false, at: 1 })
    expect(parseTemplateAvailabilitySet(payload, 'template-availability-set')).toEqual(payload)
  })

  it('recovery-incident-opened round-trips', () => {
    const payload = recoveryIncidentOpenedPayload({
      scope: 'template:worker',
      requirementIds: ['work.required-mcp'],
      openedAt: 2,
    })
    expect(parseRecoveryIncidentOpened(payload, 'recovery-incident-opened')).toEqual(payload)
  })

  it('recovery-incident-closed round-trips', () => {
    const payload = recoveryIncidentClosedPayload({
      scope: 'team',
      requirementIds: ['team.required-mcp'],
      closedAt: 4,
    })
    expect(parseRecoveryIncidentClosed(payload, 'recovery-incident-closed')).toEqual(payload)
  })
})

describe('E.5 fail-closed parsers reject malformed payloads', () => {
  it('rejects a non-object payload', () => {
    expect(() => parseOptionalRequirementAccepted('x', 'optional-requirement-accepted')).toThrow(
      /must be a plain object/,
    )
  })

  it('rejects a wrong-typed field (present-but-wrong-type)', () => {
    expect(() =>
      parseTemplateAvailabilitySet({ templateId: 'worker', available: 'yes', at: 1 }, 'template-availability-set'),
    ).toThrow(/available must be a boolean/)
    expect(() =>
      parseRecoveryIncidentOpened({ scope: 5, requirementIds: [], openedAt: 0 }, 'recovery-incident-opened'),
    ).toThrow(/scope must be a non-empty string/)
  })

  it('rejects a non-string requirementIds array element', () => {
    expect(() =>
      parseRecoveryIncidentClosed({ scope: 'team', requirementIds: ['a', 1], closedAt: 0 }, 'recovery-incident-closed'),
    ).toThrow(/requirementIds must be an array of strings/)
  })
})

describe('E.5 the writer (allocateSequence then put, under compatibility)', () => {
  it('stamps the row with the fact type + payload + schema version + createdAt', async () => {
    const put: Record<string, unknown>[] = []
    const ledger = {
      allocateSequence: async () => 7,
      put: async (entry: Record<string, unknown>) => {
        put.push(entry)
        return null
      },
    }
    const payload = optionalRequirementAcceptedPayload({
      requirementId: 'a',
      generation: 1,
      consentedAt: 0,
      consentedBy: 'h',
    })
    await writeRequirementFact(
      ledger,
      'root-1',
      OPTIONAL_REQUIREMENT_ACCEPTED_FACT_TYPE,
      payload,
      () => '2026-01-01T00:00:00.000Z',
    )
    expect(put).toHaveLength(1)
    const row = put[0]
    expect(row).toBeDefined()
    if (row === undefined) throw new Error('expected one put row')
    expect(row.factType).toBe('optional-requirement-accepted')
    expect(row.rootSessionId).toBe('root-1')
    expect(row.sequence).toBe(7)
    expect(row.createdAt).toBe('2026-01-01T00:00:00.000Z')
    expect(row.payload).toEqual(payload)
  })

  it('rejects an unknown fact type (closed-set guard)', async () => {
    const ledger = { allocateSequence: async () => 1, put: async () => null }
    await expect(
      writeRequirementFact(ledger, 'root', 'not-a-fact' as never, {}, () => 'now'),
    ).rejects.toThrow(/unknown requirement fact type/)
  })
})
