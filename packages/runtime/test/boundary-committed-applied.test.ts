/**
 * pre-alpha3 PR-B — BOUNDARY COMMITTED / APPLIED (plan §B.3, key
 * assertions 3 + 4 + 6): the committed/applied split is expressed by the
 * durable facts, not by a fake runtime clock. An IN-FLIGHT request holds
 * the effective policy it read at its boundary (a frozen snapshot of the
 * durable facts it was given); a RETROACTIVE mutation committed during the
 * request does not rewrite the in-flight policy; the NEXT request (a fresh
 * read over the updated durable facts) uses the new committed policy:
 *
 * - A3 (in-flight request is not retroactively rewritten): the in-flight
 *   read is derived from the transitions captured at its boundary; a new
 *   committed transition added afterward does NOT change the in-flight
 *   policy (the read is pure over the facts it was given).
 * - A4 (next request uses the new committed policy): a fresh read over the
 *   updated durable facts resolves the newly committed state.
 * - A6 (materialization failure does not roll back the governance intent):
 *   a malformed stored payload makes the canonical read FAIL CLOSED (the
 *   typed frozen error), but the durable facts — the committed governance
 *   override / transition — are left intact (a failing read is pure and
 *   never rolls back a committed intent).
 *
 * The read is pure (no I/O): in-memory transition + override arrays. The
 * runner executes this file under plain Node; the `it` bodies assert
 * synchronously.
 *
 * @module @dsh-agent-team/runtime/test/boundary-committed-applied
 */

import { describe, expect, it } from 'vitest'
import { readEffectivePolicy, committedPolicyState } from '../effective-policy/index.js'
import { isActivationError, ACTIVATION_ERROR_CODES } from '../activation/errors.js'
import type { PolicyReader, PolicyStateTransitionRecord } from '../mutation/index.js'
import type { GovernanceOverrideRecord } from '../../storage/schema/index.js'
import type { RootSessionId } from '../../contracts/src/ids/session-id.js'
import type { PolicyEntry } from '../../domain/policy/src/index.js'

const ROOT = 'session-ep-boundary'
const INSTANCE = 'inst-epb'
const BASELINE_MODEL = 'prov/model-bp'

/**
 * The synthetic static-facts authority: the blueprint grants the model
 * baseline (the LOWEST value layer); the template grants ONLY `tools` (it
 * does not speak to model, so it never shadows the committed policyState
 * model value cell — the frozen layer order is `blueprint < policyState <
 * template`).
 */
const reader: PolicyReader = {
  readBlueprintEnvelope: () => ({
    values: { model: { kind: 'allow', items: [BASELINE_MODEL] } },
  }),
  readTemplatePolicy: () => ({
    values: { tools: { kind: 'allow', items: ['tool-x'] } },
  }),
  readExternalFacts: () => ({ hard: {}, capabilityExists: {} }),
}

const transitionOf = (entryId: string, stateId: string, model: string): PolicyStateTransitionRecord => ({
  entryId,
  origin: 'human',
  state: { stateId, cells: { model: { value: { kind: 'allow', items: [model] } as PolicyEntry } } },
  requestedAtStep: 0,
  effectiveFromStep: 1,
})

const committedT1 = transitionOf('ps-t1-0', 'state-t1', 'prov/model-t1')
const committedT2 = transitionOf('ps-t2-1', 'state-t2', 'prov/model-t2')

// --- A3/A4: the committed/applied split --------------------------------------
// The in-flight request captured its boundary at T1.
const inFlightRead = readEffectivePolicy({
  rootSessionId: ROOT,
  instanceId: INSTANCE,
  policy: reader,
  transitions: [committedT1],
  overrides: [],
})
// A retroactive mutation commits T2 DURING the in-flight request.
// The in-flight read is a frozen snapshot of the T1 facts — it is NOT
// re-derived, so it is not rewritten.
// The next request re-reads the durable facts (now including T2).
const nextRequestRead = readEffectivePolicy({
  rootSessionId: ROOT,
  instanceId: INSTANCE,
  policy: reader,
  transitions: [committedT1, committedT2],
  overrides: [],
})

// --- A6: a failing read does not roll back the durable governance intent -----
// A committed governance override (the durable intent) + a malformed
// template payload (the materialization failure).
// A human-override carries NO origin (agent-authority origin is autonomy-
// overlay only) and its rootSessionId is a branded RootSessionId.
const committedOverride: GovernanceOverrideRecord = {
  schemaVersion: 2,
  recordId: 'ovr-model-team-g1',
  rootSessionId: ROOT as RootSessionId,
  scope: 'team',
  kind: 'human-override',
  generation: 1,
  values: { model: { kind: 'allow', items: ['prov/model-ovr'] } },
  updatedAt: '2026-09-29T00:00:00.000Z',
}
const overridesFacts: GovernanceOverrideRecord[] = [committedOverride]
const malformedReader: PolicyReader = {
  readBlueprintEnvelope: () => ({}),
  // An explicit empty allow is malformed for the frozen resolver (the
  // materialization failure).
  readTemplatePolicy: () => ({ values: { tools: { kind: 'allow', items: [] } } }),
  readExternalFacts: () => ({ hard: {}, capabilityExists: {} }),
}
const failingReadAttempt = (): unknown =>
  readEffectivePolicy({
    rootSessionId: ROOT,
    instanceId: INSTANCE,
    policy: malformedReader,
    transitions: [committedT1],
    overrides: overridesFacts,
  })
let failingReadError: unknown
try {
  failingReadAttempt()
} catch (error) {
  failingReadError = error
}

describe('PR-B boundary committed/applied — the split is expressed by the durable facts', () => {
  it('A3: the in-flight request is NOT retroactively rewritten by a mutation committed during the request', () => {
    // The in-flight read committed at its boundary (T1): it resolves state T1.
    expect(inFlightRead.policyState.stateId).toBe('state-t1')
    expect(inFlightRead.policy.cells['model'].effective).toEqual({
      kind: 'allow',
      items: ['prov/model-t1'],
    })
    // The retroactive T2 commit does not touch the in-flight policy: the
    // in-flight read still resolves the model it committed with.
    const inFlightEff = inFlightRead.policy.cells['model'].effective
    if (inFlightEff.kind !== 'allow') throw new Error('expected an allow model cell')
    expect(inFlightEff.items[0]).toBe('prov/model-t1')
    expect(inFlightRead.policyState.stateId).toBe('state-t1')
  })

  it('A4: the next request uses the NEW committed policy (a fresh read over the updated durable facts)', () => {
    // The next request re-reads the durable facts (T1 + T2) and resolves the
    // newly committed state (T2 — last in admission order).
    expect(nextRequestRead.policyState.stateId).toBe('state-t2')
    expect(nextRequestRead.policy.cells['model'].effective).toEqual({
      kind: 'allow',
      items: ['prov/model-t2'],
    })
    // The committed-state helper agrees: the last durable transition wins.
    const committed = committedPolicyState([committedT1, committedT2])
    expect(committed.state.stateId).toBe('state-t2')
    expect(committed.transition).not.toBeNull()
    if (committed.transition === null) throw new Error('no committed transition')
    expect(committed.transition.entryId).toBe('ps-t2-1')
  })

  it('A6: a materialization failure fails closed (typed error) and does NOT roll back the committed governance intent', () => {
    // The malformed stored payload makes the canonical read fail closed with
    // the typed frozen error (the SAME error type the consumers catch).
    expect(failingReadError).not.toBe(null)
    expect(isActivationError(failingReadError)).toBe(true)
    if (isActivationError(failingReadError)) {
      expect(failingReadError.code).toBe(ACTIVATION_ERROR_CODES.POLICY_RESOLUTION_FAILED)
    }
    // The durable governance intent (the committed override + transition) is
    // intact — a failing read is pure and never rolls back a committed
    // intent (the next attempt re-reads the SAME durable facts).
    expect(overridesFacts).toHaveLength(1)
    expect(overridesFacts[0]?.recordId).toBe('ovr-model-team-g1')
    expect(overridesFacts[0]?.values['model']).toEqual({
      kind: 'allow',
      items: ['prov/model-ovr'],
    })
    // The committed transition is likewise untouched.
    expect(committedT1.entryId).toBe('ps-t1-0')
  })
})
