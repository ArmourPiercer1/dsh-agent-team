/**
 * Governance model (P9-T8, S5-C; plan S5-C + Gate P9-G5; UI doc
 * §10/§18/§19/§21): the closed re-probe trigger set, the §10.2 badge
 * map, the frozen param builders (the human actor convention, the
 * scope/targetInstanceId pairing), the TWO distinct compatibility wire
 * shapes (the aggregate `compatibility.get` state vs the flat re-derived
 * verdict), the override value parser, the policy-state view parser +
 * the verbatim state-id display, and the §18.3 effective-config lane
 * rows (distinct state words, v2 additive flags) with the §19
 * hard-policy display rule.
 *
 * Legacy spec evidence: NEW module (the legacy fork has no vNext
 * governance object model — the config/override/policy-state/
 * compatibility objects are vNext-only and ride the frozen Remote wire);
 * no legacy test to migrate or drop.
 */
import { describe, expect, it } from 'vitest'
import type {
  RemotePolicyEntry,
  RemoteSafeRecord,
} from '../../remote/src/index.js'
import {
  COMPATIBILITY_BADGE_MARKS,
  GOVERNANCE_REPROBE_TRIGGERS,
  HUMAN_RECHECK_TRIGGER,
  compatibilityAckParams,
  compatibilityBadge,
  compatibilityGetParams,
  compatibilityReprobeParams,
  effectiveConfigLanes,
  hardPolicyDisplay,
  isReprobeTrigger,
  overrideGetParams,
  overrideResetParams,
  overrideSetParams,
  parseCompatibilityStateValue,
  parseCompatibilityVerdictValue,
  parseOverrideValue,
  parsePolicyStateValue,
  policyStateGetParams,
  policyStateLabel,
  policyStateSetParams,
  type EffectiveConfigLanesInput,
} from '../src/model/team-governance.js'

describe('re-probe trigger closed set', () => {
  it('exposes exactly the five frozen DevPlan §20.1 triggers', () => {
    expect([...GOVERNANCE_REPROBE_TRIGGERS].sort()).toEqual([
      'CAPABILITY_GENERATION_CHANGE',
      'MEMBER_COLD_RESUME',
      'NEW_ACTIVATION',
      'ROOT_COLD_RESUME',
      'STALE_GENERATION_BEFORE_NEW_WORK',
    ])
  })

  it('accepts every frozen trigger and rejects everything else', () => {
    for (const trigger of GOVERNANCE_REPROBE_TRIGGERS) {
      expect(isReprobeTrigger(trigger)).toBe(true)
    }
    expect(isReprobeTrigger('RECHECK')).toBe(false)
    expect(isReprobeTrigger('')).toBe(false)
    expect(isReprobeTrigger(42)).toBe(false)
  })

  it('maps the human Recheck (§10.4) to CAPABILITY_GENERATION_CHANGE', () => {
    expect(HUMAN_RECHECK_TRIGGER).toBe('CAPABILITY_GENERATION_CHANGE')
  })

  it('rejects a non-frozen trigger in the params builder (no wire round-trip spent)', () => {
    expect(() => compatibilityReprobeParams('team-root', 'RECHECK')).toThrow(
      "GOVERNANCE_MALFORMED: compatibility.reprobe trigger 'RECHECK' is outside the frozen closed set",
    )
  })

  it('builds the reprobe params verbatim for a frozen trigger', () => {
    expect(compatibilityReprobeParams('team-root', 'ROOT_COLD_RESUME')).toEqual({
      teamSessionId: 'team-root',
      trigger: 'ROOT_COLD_RESUME',
    })
  })
})

describe('compatibilityBadge (UI §10.2)', () => {
  it('maps the four frozen AdmissionStates to their marks', () => {
    expect(compatibilityBadge('OPEN')).toEqual({ state: 'OPEN', mark: 'pass' })
    expect(compatibilityBadge('DEGRADED_ACKNOWLEDGED')).toEqual({
      state: 'DEGRADED_ACKNOWLEDGED',
      mark: 'warning',
    })
    expect(compatibilityBadge('BLOCKED_WARNING')).toEqual({
      state: 'BLOCKED_WARNING',
      mark: 'warning',
    })
    expect(compatibilityBadge('BLOCKED_FATAL')).toEqual({
      state: 'BLOCKED_FATAL',
      mark: 'fatal',
    })
  })

  it('returns null for a status outside the frozen vocabulary', () => {
    expect(compatibilityBadge('bogus')).toBe(null)
    expect(compatibilityBadge('')).toBe(null)
  })

  it('covers all four states with no unmarked entries', () => {
    expect(Object.keys(COMPATIBILITY_BADGE_MARKS).length).toBe(4)
  })
})

describe('override param builders', () => {
  const allow: RemotePolicyEntry = { kind: 'allow', items: ['Bash'] }
  const deny: RemotePolicyEntry = { kind: 'deny' }

  it('get: no scope omits scope AND targetInstanceId', () => {
    expect(overrideGetParams('team-root', 'tools')).toEqual({
      teamSessionId: 'team-root',
      capability: 'tools',
    })
  })

  it('get: instance scope carries the target instance', () => {
    expect(overrideGetParams('team-root', 'model', 'instance', 'inst-1')).toEqual({
      teamSessionId: 'team-root',
      capability: 'model',
      scope: 'instance',
      targetInstanceId: 'inst-1',
    })
  })

  it('get: a scope without a target drops the target (target present iff scope is instance)', () => {
    expect(overrideGetParams('team-root', 'model', 'instance')).toEqual({
      teamSessionId: 'team-root',
      capability: 'model',
      scope: 'instance',
    })
  })

  it('set: the human actor + the value are preserved verbatim', () => {
    expect(
      overrideSetParams('team-root', 'permissions', allow, 'instance', 'inst-1'),
    ).toEqual({
      teamSessionId: 'team-root',
      capability: 'permissions',
      value: { kind: 'allow', items: ['Bash'] },
      actor: { kind: 'human' },
      scope: 'instance',
      targetInstanceId: 'inst-1',
    })
  })

  it('set: deny entries carry no items key', () => {
    const params = overrideSetParams('team-root', 'mcp', deny)
    expect(params.value).toEqual({ kind: 'deny' })
    expect('scope' in params).toBe(false)
  })

  it('reset: the human actor, same scope/target pairing', () => {
    expect(
      overrideResetParams('team-root', 'skills', 'instance', 'inst-2'),
    ).toEqual({
      teamSessionId: 'team-root',
      capability: 'skills',
      actor: { kind: 'human' },
      scope: 'instance',
      targetInstanceId: 'inst-2',
    })
    expect('targetInstanceId' in overrideResetParams('team-root', 'skills')).toBe(false)
  })
})

describe('policyState param builders', () => {
  it('get: the teamSessionId only', () => {
    expect(policyStateGetParams('team-root')).toEqual({ teamSessionId: 'team-root' })
  })

  it('set: target carries the current stateId (from the projection) + cells, human actor', () => {
    expect(
      policyStateSetParams('team-root', 'exploration', {
        model: { value: { kind: 'deny' } },
        mcp: { locked: true },
        permissions: { value: { kind: 'allow', items: ['Read'] } },
        skills: {},
        tools: { value: { kind: 'allow', items: ['Read', 'Grep'] } },
      }),
    ).toEqual({
      teamSessionId: 'team-root',
      target: {
        stateId: 'exploration',
        cells: {
          model: { value: { kind: 'deny' } },
          mcp: { locked: true },
          permissions: { value: { kind: 'allow', items: ['Read'] } },
          skills: {},
          tools: { value: { kind: 'allow', items: ['Read', 'Grep'] } },
        },
      },
      actor: { kind: 'human' },
    })
  })

  it('set: a partial cell map is wire-legal (the frozen schema validates provided keys only)', () => {
    expect(
      policyStateSetParams('team-root', 'exploration', {
        tools: { value: { kind: 'allow', items: ['Read'] } },
      }),
    ).toEqual({
      teamSessionId: 'team-root',
      target: {
        stateId: 'exploration',
        cells: { tools: { value: { kind: 'allow', items: ['Read'] } } },
      },
      actor: { kind: 'human' },
    })
  })

  it('set: omitted cells stay absent from the target (no invented cells)', () => {
    expect(policyStateSetParams('team-root', 'default').target).toEqual({
      stateId: 'default',
    })
  })
})

describe('compatibility param builders', () => {
  it('get: the teamSessionId only', () => {
    expect(compatibilityGetParams('team-root')).toEqual({ teamSessionId: 'team-root' })
  })

  it('ack: the note is omitted when undefined and trimmed-present when given', () => {
    expect(compatibilityAckParams('team-root', 'req-1', 'team-root')).toEqual({
      teamSessionId: 'team-root',
      requirementId: 'req-1',
      acknowledgedBy: 'team-root',
    })
    expect(compatibilityAckParams('team-root', 'req-1', 'team-root', 'repaired')).toEqual({
      teamSessionId: 'team-root',
      requirementId: 'req-1',
      acknowledgedBy: 'team-root',
      note: 'repaired',
    })
  })
})

describe('parseCompatibilityStateValue (the aggregate get shape)', () => {
  it('parses the frozen durable-state wire value', () => {
    const wire: RemoteSafeRecord = {
      status: 'BLOCKED_WARNING',
      environmentFingerprint: 'fp-1',
      generation: 7,
      recordedAt: '2026-08-29T10:00:00.000Z',
      counts: { pass: 3, warning: 2, fatal: 0, unackedWarning: 1, staleAcknowledgement: 1 },
    }
    expect(parseCompatibilityStateValue(wire)).toEqual({
      status: 'BLOCKED_WARNING',
      generation: 7,
      environmentFingerprint: 'fp-1',
      recordedAt: '2026-08-29T10:00:00.000Z',
      pass: 3,
      warning: 2,
      fatal: 0,
      unackedWarning: 1,
      staleAcknowledgement: 1,
    })
  })

  it('throws the stable malformed prefix when the counts block is absent', () => {
    expect(() =>
      parseCompatibilityStateValue({
        status: 'OPEN',
        environmentFingerprint: 'fp-1',
        generation: 1,
        recordedAt: 't',
      }),
    ).toThrow('GOVERNANCE_MALFORMED: counts must be an object')
  })

  it('throws on a non-integer generation', () => {
    expect(() =>
      parseCompatibilityStateValue({
        status: 'OPEN',
        environmentFingerprint: 'fp-1',
        generation: 1.5,
        recordedAt: 't',
        counts: { pass: 0, warning: 0, fatal: 0, unackedWarning: 0, staleAcknowledgement: 0 },
      }),
    ).toThrow('GOVERNANCE_MALFORMED: generation must be a safe integer')
  })

  it('throws when the top-level value is not an object', () => {
    expect(() => parseCompatibilityStateValue('not-an-object')).toThrow(
      'GOVERNANCE_MALFORMED: value must be an object',
    )
  })
})

describe('parseCompatibilityVerdictValue (the flat re-derived shape)', () => {
  it('parses the reprobe verdict (flat counters + the producing trigger)', () => {
    const wire: RemoteSafeRecord = {
      recordedAt: '2026-08-29T11:00:00.000Z',
      generation: 8,
      environmentFingerprint: 'fp-2',
      status: 'OPEN',
      pass: 4,
      warning: 0,
      fatal: 0,
      unackedWarning: 0,
      trigger: 'CAPABILITY_GENERATION_CHANGE',
    }
    expect(parseCompatibilityVerdictValue(wire)).toEqual({
      status: 'OPEN',
      generation: 8,
      environmentFingerprint: 'fp-2',
      recordedAt: '2026-08-29T11:00:00.000Z',
      pass: 4,
      warning: 0,
      fatal: 0,
      unackedWarning: 0,
      staleAcknowledgement: 0,
      trigger: 'CAPABILITY_GENERATION_CHANGE',
    })
  })

  it('parses the ack verdict (no trigger → null, not absent)', () => {
    const wire: RemoteSafeRecord = {
      recordedAt: 't',
      generation: 9,
      environmentFingerprint: 'fp-3',
      status: 'DEGRADED_ACKNOWLEDGED',
      pass: 3,
      warning: 1,
      fatal: 0,
      unackedWarning: 0,
    }
    expect(parseCompatibilityVerdictValue(wire).trigger).toBe(null)
  })

  it('throws on a non-integer flat counter', () => {
    expect(() =>
      parseCompatibilityVerdictValue({
        recordedAt: 't',
        generation: 1,
        environmentFingerprint: 'fp',
        status: 'OPEN',
        pass: 'many',
        warning: 0,
        fatal: 0,
        unackedWarning: 0,
      }),
    ).toThrow('GOVERNANCE_MALFORMED: pass must be a safe integer')
  })

  it('throws when the top-level value is not an object', () => {
    expect(() => parseCompatibilityVerdictValue(null)).toThrow(
      'GOVERNANCE_MALFORMED: value must be an object',
    )
  })
})

describe('parseOverrideValue', () => {
  it('null override → no override recorded', () => {
    expect(parseOverrideValue({ override: null })).toEqual({ override: null })
  })

  it('an override record passes through untouched (never re-shaped)', () => {
    const record: RemoteSafeRecord = { kind: 'allow', items: ['Read'] }
    expect(parseOverrideValue({ override: record }).override).toBe(record)
  })

  it('an array override is malformed', () => {
    expect(() => parseOverrideValue({ override: [] })).toThrow(
      'GOVERNANCE_MALFORMED: override must be an object or null',
    )
  })

  it('throws when the top-level value is not an object', () => {
    expect(() => parseOverrideValue(42)).toThrow(
      'GOVERNANCE_MALFORMED: value must be an object',
    )
  })
})

describe('parsePolicyStateValue', () => {
  it('parses the view with cells sorted by capability (allow items / deny / locked / no value)', () => {
    const wire: RemoteSafeRecord = {
      stateId: 'exploration',
      cells: {
        tools: { value: { kind: 'allow', items: ['Read', 'Grep'] } },
        model: { locked: true },
        permissions: { value: { kind: 'deny' } },
      },
    }
    expect(parsePolicyStateValue(wire)).toEqual({
      stateId: 'exploration',
      cells: [
        { capability: 'model', locked: true, entry: null },
        { capability: 'permissions', locked: false, entry: { kind: 'deny' } },
        { capability: 'tools', locked: false, entry: { kind: 'allow', items: ['Read', 'Grep'] } },
      ],
    })
  })

  it('absent cells → an empty cell list (the state id alone is a valid view)', () => {
    expect(parsePolicyStateValue({ stateId: 'default' })).toEqual({
      stateId: 'default',
      cells: [],
    })
  })

  it('rejects a cell entry with an unknown kind', () => {
    expect(() =>
      parsePolicyStateValue({
        stateId: 's',
        cells: { tools: { value: { kind: 'maybe' } } },
      }),
    ).toThrow("GOVERNANCE_MALFORMED: cells['tools'].value.kind must be 'allow' or 'deny'")
  })

  it('throws when the top-level value is not an object', () => {
    expect(() => parsePolicyStateValue([])).toThrow(
      'GOVERNANCE_MALFORMED: value must be an object',
    )
  })
})

describe('policyStateLabel (the §21 display mapping)', () => {
  it('shows the state id verbatim (open blueprint-defined vocabulary)', () => {
    expect(policyStateLabel('exploration')).toBe('exploration')
    expect(policyStateLabel('deep-work-v2')).toBe('deep-work-v2')
  })
})

describe('effectiveConfigLanes (UI §18)', () => {
  const v1Dto: EffectiveConfigLanesInput = {
    model: { value: 'deepseek-v4', source: 'blueprint', state: 'inherited' },
    workspace: { value: '/ws/a', source: 'instance-creation', state: 'locked' },
    permissions: {
      Bash: { value: null, source: 'explicit-human-override', state: 'overridden' },
      Read: { value: 'allow', source: 'blueprint', state: 'inherited' },
    },
    autonomy: { value: 'full', source: 'policy-state', state: 'degraded' },
  }

  it('flattens the four lanes with sorted permissions and the §18.3 distinct state words', () => {
    const rows = effectiveConfigLanes(v1Dto)
    expect(rows.map(row => row.lane)).toEqual([
      'model',
      'workspace',
      'permissions:Bash',
      'permissions:Read',
      'autonomy',
    ])
    expect(rows[0]).toEqual({
      lane: 'model',
      value: 'deepseek-v4',
      source: 'blueprint',
      state: 'inherited',
      stateWord: 'Inherited',
      suppressed: null,
      unavailable: null,
      deniedBy: null,
      effectiveFrom: null,
      locked: null,
    })
    // §18.3: the distinct words are never unified "Disabled".
    expect(rows.find(row => row.lane === 'workspace')?.stateWord).toBe('Locked')
    expect(rows.find(row => row.lane === 'permissions:Bash')?.stateWord).toBe('Overridden')
    expect(rows.find(row => row.lane === 'autonomy')?.stateWord).toBe('Degraded')
  })

  it('renders pending-next-boundary with its full word', () => {
    const rows = effectiveConfigLanes({
      ...v1Dto,
      model: { value: null, source: 'policy-state', state: 'pending-next-boundary' },
    })
    expect(rows[0]!.stateWord).toBe('Pending next boundary')
  })

  it('carries the v2 additive flags when present (suppressed/unavailable/deniedBy/effectiveFrom/locked)', () => {
    const rows = effectiveConfigLanes({
      model: {
        value: null,
        source: 'external-hard-policy',
        state: 'denied',
        deniedBy: 'Managed policy',
        locked: true,
        effectiveFrom: 12,
      },
      workspace: {
        value: null,
        source: 'capability',
        state: 'unavailable',
        unavailable: true,
      },
      permissions: {
        Bash: {
          value: null,
          source: 'policy-state',
          state: 'suppressed',
          suppressed: true,
        },
      },
      autonomy: { value: 'none', source: 'blueprint', state: 'inherited' },
    })
    const model = rows[0]!
    expect(model.deniedBy).toBe('Managed policy')
    expect(model.locked).toBe(true)
    expect(model.effectiveFrom).toBe(12)
    expect(rows[1]!.unavailable).toBe(true)
    expect(rows[2]!.suppressed).toBe(true)
    expect(rows[3]!.suppressed).toBe(null)
  })
})

describe('hardPolicyDisplay (UI §19)', () => {
  it('denied + deniedBy → the Requested/Effective/Reason display', () => {
    const row = effectiveConfigLanes({
      model: { value: null, source: 'capability', state: 'inherited' },
      workspace: { value: null, source: 'capability', state: 'inherited' },
      permissions: {
        Bash: {
          value: 'allow',
          source: 'explicit-human-override',
          state: 'denied',
          deniedBy: 'Managed policy',
        },
      },
      autonomy: { value: null, source: 'capability', state: 'inherited' },
    })[2]!
    expect(hardPolicyDisplay(row)).toEqual({
      requested: 'allow',
      effective: 'Denied',
      reason: 'Managed policy',
    })
  })

  it('a denied lane without deniedBy gets no display (no invented reason)', () => {
    const row = effectiveConfigLanes({
      model: { value: null, source: 'capability', state: 'inherited' },
      workspace: { value: null, source: 'capability', state: 'inherited' },
      permissions: {
        Bash: { value: 'allow', source: 'explicit-human-override', state: 'denied' },
      },
      autonomy: { value: null, source: 'capability', state: 'inherited' },
    })[2]!
    expect(hardPolicyDisplay(row)).toBe(null)
  })

  it('non-denied lanes never show the hard-policy display', () => {
    const row = effectiveConfigLanes({
      model: { value: 'm', source: 'blueprint', state: 'overridden' },
      workspace: { value: null, source: 'capability', state: 'inherited' },
      permissions: {},
      autonomy: { value: null, source: 'capability', state: 'inherited' },
    })[0]!
    expect(hardPolicyDisplay(row)).toBe(null)
  })
})
