/**
 * pre-alpha3 PR-B — EFFECTIVE-POLICY POLICY-STATE LIVE (plan §B.3, key
 * assertions 1 + 4): the committed PolicyState is the LAST durable
 * transition in admission order, and the production READ SOURCE is the
 * durable ledger (`listDurablePolicyStateTransitions`) — not a
 * process-local cache. As committed switches accumulate, every new read
 * over the durable facts reflects the new committed state (the next
 * request uses the new committed policy):
 *
 * - the durable ledger row is the source of truth (a fresh
 *   `listDurablePolicyStateTransitions` re-reads it in sequence order);
 * - switch #1 commits state A (model + mcp value cells) -> the read
 *   resolves state A;
 * - switch #2 commits state B -> the SAME read entry now resolves state B
 *   (last in admission order wins); the step clock is NOT a decision source
 *   (both transitions carry the pinned (0, 1) stamp, yet admission order
 *   alone decides).
 *
 * The runner executes this file under plain Node: all async work runs in
 * the top-level block (one scratch world, destroyed before the first
 * assertion); the `it` bodies assert synchronously.
 *
 * @module @dsh-agent-team/runtime/test/effective-policy-policy-state-live
 */

import { describe, expect, it } from 'vitest'
import {
  createTeamDomain,
  type TeamDomainRepositories,
} from '../../storage/repositories/index.js'
import { teamSessionInput } from '../../storage/test/p4-helpers.js'
import { FileStorageSeam, destroyDir, scratchDir } from '../../testkit/fault-injection/file-seam.mjs'
import {
  listDurablePolicyStateTransitions,
  writePolicyStateTransitionRow,
} from '../src/plugin/durable-mutation-store.js'
import { readEffectivePolicy } from '../effective-policy/index.js'
import type { PolicyReader, PolicyStateTransitionRecord } from '../mutation/index.js'
import type { PolicyEntry } from '../../domain/policy/src/index.js'

const ROOT = 'session-ep-ps-live'
const INSTANCE = 'inst-eppl'
const NOW = '2026-09-29T00:00:00.000Z'
const now = () => NOW

const BASELINE_MODEL = 'prov/model-bp'
const BASELINE_MCP = 'srv/bp'
const STATE_A_MODEL = 'prov/model-a'
const STATE_A_MCP = 'srv/a'
const STATE_B_MODEL = 'prov/model-b'
const STATE_B_MCP = 'srv/b'

/**
 * The synthetic static-facts authority: the blueprint grants the model/mcp
 * baseline (the LOWEST value layer); the template grants ONLY `tools` (it
 * does not speak to model/mcp, so it never shadows the committed policyState
 * value cell — the frozen layer order is `blueprint < policyState <
 * template`).
 */
const reader: PolicyReader = {
  readBlueprintEnvelope: () => ({
    values: {
      model: { kind: 'allow', items: [BASELINE_MODEL] },
      mcp: { kind: 'allow', items: [BASELINE_MCP] },
    },
  }),
  readTemplatePolicy: () => ({
    values: { tools: { kind: 'allow', items: ['tool-x'] } },
  }),
  readExternalFacts: () => ({ hard: {}, capabilityExists: {} }),
}

const transitionOf = (
  entryId: string,
  stateId: string,
  model: string,
  mcp: string,
): PolicyStateTransitionRecord => ({
  entryId,
  origin: 'human',
  state: {
    stateId,
    cells: {
      model: { value: { kind: 'allow', items: [model] } as PolicyEntry },
      mcp: { value: { kind: 'allow', items: [mcp] } as PolicyEntry },
    },
  },
  // The pinned (0, 1) legacy stamp: a RECORD field, not a decision input.
  requestedAtStep: 0,
  effectiveFromStep: 1,
})

const transitionA = transitionOf('ps-a-0', 'state-a', STATE_A_MODEL, STATE_A_MCP)
const transitionB = transitionOf('ps-b-1', 'state-b', STATE_B_MODEL, STATE_B_MCP)

// --- the real durable world --------------------------------------------------
const dir = scratchDir('ep-ps-live')
destroyDir(dir) // self-cleaning: a crashed prior run may leave a domain behind
const seam = new FileStorageSeam(dir)
const domain = await createTeamDomain(seam)
const repos: TeamDomainRepositories = domain.repositories
// The durable ledger put advances the TeamSession generation stamp — the
// team row must exist (facts belong to an existing team).
await repos.teamSessions.put(teamSessionInput(ROOT as Parameters<typeof teamSessionInput>[0]))

// Before any committed switch: the durable read is empty -> default state.
const preRead = readEffectivePolicy({
  rootSessionId: ROOT,
  instanceId: INSTANCE,
  policy: reader,
  transitions: listDurablePolicyStateTransitions(repos, ROOT),
  overrides: [],
})

// Switch #1: commit state A (the durable ledger row is written first), then
// IMMEDIATELY re-read the durable facts (captured BEFORE switch #2 — the `it`
// bodies run after the whole top-level block, so a re-read there would see
// both transitions).
await writePolicyStateTransitionRow(repos.ledger, ROOT, transitionA, now)
const durableAfterA = listDurablePolicyStateTransitions(repos, ROOT)
const readAfterA = readEffectivePolicy({
  rootSessionId: ROOT,
  instanceId: INSTANCE,
  policy: reader,
  transitions: durableAfterA,
  overrides: [],
})

// Switch #2: commit state B (admission order after A), then re-read.
await writePolicyStateTransitionRow(repos.ledger, ROOT, transitionB, now)
const durableAfterB = listDurablePolicyStateTransitions(repos, ROOT)
const readAfterB = readEffectivePolicy({
  rootSessionId: ROOT,
  instanceId: INSTANCE,
  policy: reader,
  transitions: durableAfterB,
  overrides: [],
})

destroyDir(dir)

describe('PR-B effective-policy policy-state live — the durable ledger is the read source', () => {
  it('the pre-switch read is the template baseline at the implicit default state', () => {
    expect(preRead.policyState.stateId).toBe('default')
    expect(preRead.policyStateTransition).toBeNull()
    expect(preRead.policy.cells['model'].effective).toEqual({
      kind: 'allow',
      items: [BASELINE_MODEL],
    })
    expect(preRead.policy.cells['model'].team.layer).toBe('blueprint')
  })

  it('switch #1 commits: the durable re-read resolves state A (model + mcp value cells win)', () => {
    expect(durableAfterA.map((transition) => transition.entryId)).toEqual(['ps-a-0'])
    expect(readAfterA.policyState.stateId).toBe('state-a')
    expect(readAfterA.policyStateTransition).not.toBeNull()
    if (readAfterA.policyStateTransition === null) throw new Error('no committed transition')
    expect(readAfterA.policyStateTransition.entryId).toBe('ps-a-0')
    expect(readAfterA.policy.cells['model'].effective).toEqual({ kind: 'allow', items: [STATE_A_MODEL] })
    expect(readAfterA.policy.cells['model'].team.layer).toBe('policyState')
    expect(readAfterA.policy.cells['mcp'].effective).toEqual({ kind: 'allow', items: [STATE_A_MCP] })
  })

  it('switch #2 commits: the SAME read entry now resolves state B (last in admission order wins; the step clock is not a decision source)', () => {
    // The durable re-read (captured right after switch #2) returns BOTH
    // transitions in sequence (commit) order.
    expect(durableAfterB.map((transition) => transition.entryId)).toEqual(['ps-a-0', 'ps-b-1'])
    // The committed state is the LAST transition — the next request uses the
    // new committed policy (state B), even though both rows carry the pinned
    // (0, 1) step stamp (admission order alone decides).
    expect(readAfterB.policyState.stateId).toBe('state-b')
    expect(readAfterB.policyStateTransition).not.toBeNull()
    if (readAfterB.policyStateTransition === null) throw new Error('no committed transition')
    expect(readAfterB.policyStateTransition.entryId).toBe('ps-b-1')
    expect(readAfterB.policy.cells['model'].effective).toEqual({ kind: 'allow', items: [STATE_B_MODEL] })
    expect(readAfterB.policy.cells['mcp'].effective).toEqual({ kind: 'allow', items: [STATE_B_MCP] })
  })
})
