/**
 * pre-alpha3 PR-B — EFFECTIVE-POLICY SINGLE SOURCE (plan §B.3, key
 * assertions 1 + 2): the canonical read (`readEffectivePolicy`) is the ONE
 * public entry through which every consumer obtains a member's effective
 * policy from the durable facts, and the consumers derive from that SAME
 * read — no consumer re-assembles policy itself:
 *
 * - A1 (PolicyState changes model/MCP live consumption): the frozen layer
 *   order is `blueprint < policyState < template` (plan §B.2), so a
 *   committed PolicyState VALUE cell for `model` and `mcp` flips the
 *   resolved cell from the blueprint baseline to the state value — the
 *   NEXT read over the same durable facts reflects the new committed state.
 *   The synthetic template deliberately does NOT grant model/mcp (a
 *   template grant would SHADOW the policyState cell), so the committed
 *   state value is the deciding layer.
 * - A2 (inspect and the actual request surface are same-source): the model
 *   the request surface installs (the `modelConsumptionView` over the
 *   canonical read's policy) is EXACTLY the model the canonical read
 *   resolved — the inspect and the request read one policy, not two.
 *
 * The read is pure (no I/O): the synthetic {@link PolicyReader} supplies the
 * static layers, and the durable PolicyState transitions are an in-memory
 * array (admission order). The runner executes this file under plain Node:
 * all work runs in the top-level block; the `it` bodies assert
 * synchronously.
 *
 * @module @dsh-agent-team/runtime/test/effective-policy-single-source
 */

import { describe, expect, it } from 'vitest'
import { readEffectivePolicy } from '../effective-policy/index.js'
import { modelConsumptionView } from '../agent-setup/model/index.js'
import type { PolicyReader, PolicyStateTransitionRecord } from '../mutation/index.js'
import type { PolicyEntry } from '../../domain/policy/src/index.js'

const ROOT = 'session-ep-single-source'
const INSTANCE = 'inst-epss'
const BLUEPRINT_MODEL = 'prov/model-bp'
const BLUEPRINT_MCP = 'srv/bp'
const STATE_MODEL = 'prov/model-strict'
const STATE_MCP = 'srv/strict'

/**
 * The synthetic static-facts authority: the blueprint grants the model/mcp
 * baseline (the LOWEST value layer); the template grants ONLY `tools` (it
 * does not speak to model/mcp, so it never shadows the committed
 * policyState value cell). No `autonomyEnvelope` — the policyState value
 * cell is not envelope-checked (it is an explicitly switched Team boundary
 * value, not an agent overlay).
 */
const reader: PolicyReader = {
  readBlueprintEnvelope: () => ({
    values: {
      model: { kind: 'allow', items: [BLUEPRINT_MODEL] },
      mcp: { kind: 'allow', items: [BLUEPRINT_MCP] },
    },
  }),
  readTemplatePolicy: () => ({
    values: { tools: { kind: 'allow', items: ['tool-x'] } },
  }),
  readExternalFacts: () => ({ hard: {}, capabilityExists: {} }),
}

const baseline = { provider: 'prov', model: 'prov-default' }

// --- the baseline read (no committed transition, no overrides) ---------------
const baselineRead = readEffectivePolicy({
  rootSessionId: ROOT,
  instanceId: INSTANCE,
  policy: reader,
  transitions: [],
  overrides: [],
})

// --- a committed PolicyState that pins model + mcp value cells ---------------
const strictTransition: PolicyStateTransitionRecord = {
  entryId: 'ps-strict-0',
  origin: 'human',
  state: {
    stateId: 'strict',
    cells: {
      model: { value: { kind: 'allow', items: [STATE_MODEL] } as PolicyEntry },
      mcp: { value: { kind: 'allow', items: [STATE_MCP] } as PolicyEntry },
    },
  },
  requestedAtStep: 0,
  effectiveFromStep: 1,
}

// --- the read AFTER the committed transition (live consumption) --------------
const strictRead = readEffectivePolicy({
  rootSessionId: ROOT,
  instanceId: INSTANCE,
  policy: reader,
  transitions: [strictTransition],
  overrides: [],
})

describe('PR-B effective-policy single source — the canonical read is the one entry', () => {
  it('the baseline read resolves the blueprint model + mcp (committed state = default, no record-backed winner)', () => {
    expect(baselineRead.policyState.stateId).toBe('default')
    expect(baselineRead.policyStateTransition).toBeNull()
    expect(baselineRead.committedGeneration).toBe(0)
    expect(baselineRead.policy.cells['model'].effective).toEqual({ kind: 'allow', items: [BLUEPRINT_MODEL] })
    expect(baselineRead.policy.cells['model'].team.layer).toBe('blueprint')
    expect(baselineRead.policy.cells['mcp'].effective).toEqual({ kind: 'allow', items: [BLUEPRINT_MCP] })
    expect(baselineRead.policy.cells['mcp'].team.layer).toBe('blueprint')
  })

  it('A1: a committed PolicyState value cell flips model + mcp live consumption to the state value', () => {
    // The committed state is the LAST durable transition in admission order.
    expect(strictRead.policyState.stateId).toBe('strict')
    expect(strictRead.policyStateTransition).not.toBeNull()
    if (strictRead.policyStateTransition === null) throw new Error('no committed transition')
    expect(strictRead.policyStateTransition.entryId).toBe('ps-strict-0')
    // The model + mcp cells now resolve at the policyState layer (the state
    // value beats the blueprint baseline) — the SAME read a request boundary
    // would run sees the new values.
    expect(strictRead.policy.cells['model'].effective).toEqual({ kind: 'allow', items: [STATE_MODEL] })
    expect(strictRead.policy.cells['model'].team.layer).toBe('policyState')
    expect(strictRead.policy.cells['mcp'].effective).toEqual({ kind: 'allow', items: [STATE_MCP] })
    expect(strictRead.policy.cells['mcp'].team.layer).toBe('policyState')
  })

  it('A2: the request surface installs EXACTLY the model the canonical read resolved (inspect and request are same-source)', () => {
    // The request surface derives its selection from the SAME policy object
    // the canonical read returned — no second assembly.
    const requestModel = modelConsumptionView(strictRead.policy, baseline)
    expect(requestModel.selection).toEqual({ provider: 'prov', model: 'model-strict' })
    // Single source: the installed selection is the first item of the
    // canonical read's model cell (parsed), not an independently derived value.
    const resolvedEff = strictRead.policy.cells['model'].effective
    if (resolvedEff.kind !== 'allow') throw new Error('expected an allow model cell')
    const resolvedFirst = resolvedEff.items[0]
    expect(resolvedFirst).toBe(STATE_MODEL)
    if (resolvedFirst === undefined) throw new Error('empty model cell')
    const [prov, ...rest] = resolvedFirst.split('/')
    expect(requestModel.selection?.provider).toBe(prov)
    expect(requestModel.selection?.model).toBe(rest.join('/'))
    // The baseline read surfaces the baseline model the same way (the
    // blueprint model is a valid provider/model selection).
    const baselineModel = modelConsumptionView(baselineRead.policy, baseline)
    expect(baselineModel.selection).toEqual({ provider: 'prov', model: 'model-bp' })
  })
})
