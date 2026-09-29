/**
 * pre-alpha3 PR-E (plan §E.6/§E.7/§E.9) — E.11 suite
 * `requirement-authority-negatives`: the TEN authority negatives of the
 * requirement/recovery model. The authority is closed and fail-closed in
 * BOTH directions — the startup preflight (which outcome a degraded world
 * classifies to) and the per-action gate (which impact class a blocked
 * scope blocks). The negatives pin the FAIL-CLOSED edges:
 *
 *   1. Team scope required down → `fatal` (the Team cannot run).
 *   2. Team scope required down + a DISABLED template → STILL `fatal`
 *      (a Team-level required down CANNOT be bypassed by disabling a
 *      template — the Team itself cannot run).
 *   3. Team scope required down + a consent for the fatal → STILL `fatal`
 *      (consent is for OPTIONAL (warning) downgrades — it never unblocks a
 *      required (fatal) requirement).
 *   4. A required TEMPLATE down (not disabled) → `fixOrDisable` (the human
 *      must fix + recheck, or disable the template).
 *   5. A required template down that is ALREADY disabled → `proceed`
 *      (a disabled template is RESOLVED — its required work will not
 *      start).
 *   6. An OPTIONAL (warning) down WITHOUT consent → `consentRequired`
 *      (the human must consent to run degraded).
 *   7. An optional (warning) down WITH consent → `proceed` (the durable
 *      consent resolves the warning).
 *   8. A team FATAL + a warning down → `fatal` (the fatal WINS over the
 *      warning — the warning is not reported in a fatal outcome).
 *   9. A recovery marker on a NON-blocked scope → allowed as NORMAL work
 *      (the marker is a NO-OP — a present marker without a blocked scope
 *      does NOT grant the recovery classification; the gate falls back to
 *      the normal-work allowed verdict).
 *  10. (LIVE) The durable consent + template-availability facts SURVIVE a
 *      restart (the close/reopen re-reads the same durable ledger — the
 *      degradation consent and the template disable are NOT reset).
 *
 * @module @dsh-agent-team/runtime/test/requirement-authority-negatives
 */

import { afterEach, describe, expect, it } from 'vitest'

import {
  gateAction,
  recoveryWorkImpact,
  startupPreflight,
  teamScope,
  templateScope,
  scopeKey,
  optionalRequirementAcceptedPayload,
  templateAvailabilitySetPayload,
  writeRequirementFact,
  GATE_REASONS,
  PREFLIGHT_OUTCOMES,
  type EvaluationInput,
  type RequirementVerdict,
} from '../requirements/index.js'
import { readRequirementFacts } from '../admission/requirement-gate.js'
import { createP6T2World, P6T2_ROOT, P6T2_NOW } from './p6t2-helpers.js'
import { destroyP6T1World, restartP6T1World } from './p6t1-helpers.js'
import type { P6T1World } from './p6t1-helpers.js'

function v(requirementId: string, outcome: RequirementVerdict['outcome'], complete = false): RequirementVerdict {
  return {
    requirementId,
    complete,
    outcome,
    unavailableSubjects: outcome === 'pass' ? [] : [requirementId],
  }
}

const TEAM_FATAL: EvaluationInput = {
  scopeVerdicts: {
    [scopeKey(teamScope())]: [v('team.required', 'fatal', true)],
  },
}
const TEAM_FATAL_AND_WARNING: EvaluationInput = {
  scopeVerdicts: {
    [scopeKey(teamScope())]: [v('team.required', 'fatal', true), v('team.optional', 'warning')],
  },
}
const TEMPLATE_FATAL: EvaluationInput = {
  scopeVerdicts: {
    [scopeKey(teamScope())]: [v('team.a', 'pass')],
    [scopeKey(templateScope('worker'))]: [v('worker.required', 'fatal', true)],
  },
}
const WARNING_ONLY: EvaluationInput = {
  scopeVerdicts: {
    [scopeKey(teamScope())]: [v('team.optional', 'warning')],
  },
}

describe('E.11 requirement-authority-negatives: the ten fail-closed authority edges', () => {
  it('1. Team scope required down → fatal (the Team cannot run)', () => {
    const result = startupPreflight(TEAM_FATAL)
    expect(result.outcome).toBe(PREFLIGHT_OUTCOMES.fatal)
    expect(result.fatalRequirementIds).toEqual(['team.required'])
  })

  it('2. Team scope required down + a disabled template → STILL fatal (a disable cannot bypass the Team fatal)', () => {
    const result = startupPreflight({
      ...TEMPLATE_FATAL,
      scopeVerdicts: {
        ...TEAM_FATAL.scopeVerdicts,
        [scopeKey(templateScope('worker'))]: [v('worker.required', 'fatal', true)],
      },
      availability: [{ templateId: 'worker', available: false }],
    })
    expect(result.outcome).toBe(PREFLIGHT_OUTCOMES.fatal)
    expect(result.fatalRequirementIds).toEqual(['team.required'])
  })

  it('3. Team scope required down + a consent for the fatal → STILL fatal (consent never unblocks a required)', () => {
    const result = startupPreflight({
      ...TEAM_FATAL,
      consents: [{ requirementId: 'team.required', generation: 1, consentedAt: 1, consentedBy: 'human-1' }],
    })
    expect(result.outcome).toBe(PREFLIGHT_OUTCOMES.fatal)
    expect(result.fatalRequirementIds).toEqual(['team.required'])
  })

  it('4. A required template down (not disabled) → fixOrDisable', () => {
    const result = startupPreflight(TEMPLATE_FATAL)
    expect(result.outcome).toBe(PREFLIGHT_OUTCOMES.fixOrDisable)
    expect(result.fixOrDisableRequirementIds).toEqual(['worker.required'])
  })

  it('5. A required template down that is already disabled → proceed (the disable resolves it)', () => {
    const result = startupPreflight({
      ...TEMPLATE_FATAL,
      availability: [{ templateId: 'worker', available: false }],
    })
    expect(result.outcome).toBe(PREFLIGHT_OUTCOMES.proceed)
    expect(result.fixOrDisableRequirementIds).toEqual([])
  })

  it('6. An optional (warning) down WITHOUT consent → consentRequired', () => {
    const result = startupPreflight(WARNING_ONLY)
    expect(result.outcome).toBe(PREFLIGHT_OUTCOMES.consentRequired)
    expect(result.consentRequiredRequirementIds).toEqual(['team.optional'])
  })

  it('7. An optional (warning) down WITH consent → proceed (the consent resolves the warning)', () => {
    const result = startupPreflight({
      ...WARNING_ONLY,
      consents: [{ requirementId: 'team.optional', generation: 1, consentedAt: 1, consentedBy: 'human-1' }],
    })
    expect(result.outcome).toBe(PREFLIGHT_OUTCOMES.proceed)
    expect(result.consentRequiredRequirementIds).toEqual([])
  })

  it('8. A team fatal + a warning down → fatal (the fatal wins; the warning is not reported)', () => {
    const result = startupPreflight(TEAM_FATAL_AND_WARNING)
    expect(result.outcome).toBe(PREFLIGHT_OUTCOMES.fatal)
    expect(result.fatalRequirementIds).toEqual(['team.required'])
    expect(result.consentRequiredRequirementIds).toEqual([])
  })

  it('9. A recovery marker on a NON-blocked scope → allowed as normal work (the marker is a no-op)', () => {
    const healthy: EvaluationInput = {
      scopeVerdicts: {
        [scopeKey(teamScope())]: [v('team.a', 'pass')],
      },
    }
    const decision = gateAction(recoveryWorkImpact([teamScope()]), healthy)
    expect(decision.allowed).toBe(true)
    // The marker grants NOTHING extra on a healthy scope — the gate falls
    // back to the normal-work allowed verdict (not the recoveryAllowed
    // classification).
    expect(decision.reason).toBe(GATE_REASONS.allowed)
    expect(decision.recoveryScopes).toBeUndefined()
  })

  it('10. (LIVE) the durable consent + template-availability facts SURVIVE a restart', async () => {
    const world = await createP6T2World('pr-e-authority-neg-restart', ['leader', 'worker'], {
      environmentFacts: () => Promise.resolve([]),
    })
    try {
      const ledger = world.domain.repositories.ledger
      const now = () => P6T2_NOW
      // Write the two durable degradation facts (the consent + the disable).
      await writeRequirementFact(
        ledger,
        P6T2_ROOT,
        'optional-requirement-accepted',
        optionalRequirementAcceptedPayload({
          requirementId: 'team.optional',
          generation: 1,
          consentedAt: 1,
          consentedBy: 'human-1',
        }),
        now,
      )
      await writeRequirementFact(
        ledger,
        P6T2_ROOT,
        'template-availability-set',
        templateAvailabilitySetPayload({ templateId: 'worker', available: false, at: 1 }),
        now,
      )

      // Pre-restart: both facts are readable.
      const before = readRequirementFacts(world.domain.repositories, P6T2_ROOT)
      expect(before.consents.map((c) => c.requirementId)).toEqual(['team.optional'])
      expect(before.availability).toEqual([{ templateId: 'worker', available: false }])

      // RESTART — close the durable domain, reopen the SAME scratch dir.
      const world2 = await restartP6T1World(world)
      try {
        // Post-restart: the SAME facts are readable (the durable ledger
        // persists — the degradation consent and the template disable are
        // NOT reset by the restart).
        const after = readRequirementFacts(world2.domain.repositories, P6T2_ROOT)
        expect(after.consents.map((c) => c.requirementId)).toEqual(['team.optional'])
        expect(after.availability).toEqual([{ templateId: 'worker', available: false }])
      } finally {
        await destroyP6T1World(world2).catch(() => {})
      }
    } finally {
      await destroyP6T1World(world).catch(() => {})
    }
  })
})
