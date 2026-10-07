/**
 * prf-inspect-same-source.test.ts — pre-alpha3 PR-F (plan §F.4) MUST-TEST:
 * `team_inspect_config` is the SAME-SOURCE read surface (the UI/leader
 * display must agree with the runtime authority — no re-probe, no
 * conflation).
 *
 * Frozen acceptance (this file):
 *
 *   S1  the `config-inspected` payload carries the four new same-source
 *       fields: `effective` over the closed set MINUS the generic
 *       `permissions` cell (the fake five-domain cell — the alpha.2
 *       operation-permission authority is the independent
 *       `operationPermissions` field), `policyState` (the COMMITTED
 *       state: `blueprint-default` when no durable transition was ever
 *       committed), `requirement` (the durable PR-E facts: consents /
 *       template availability / the compatibility verdict), and
 *       `recovery` (DERIVED from the durable incident facts: `active`
 *       false when no incident is open).
 *   S2  the durable facts are read VERBATIM from the TeamDomain — a
 *       compatibility record, the LATEST consent per requirement, the
 *       LATEST availability fact per template (sequence order — the
 *       last row wins), and the DERIVED recovery state (a scope whose
 *       latest incident fact is `opened` is open; `closed` is the
 *       durable exit record, not live state).
 *   S3  the `policyState` field is the SAME durable read the production
 *       root's projection runs (`committedPolicyState` over the injected
 *       transition rows): a committed transition surfaces
 *       `source: 'durable-transition'` + the entryId/origin + the
 *       committed cells.
 *
 * House pattern (the model-inspect-config suite): one durable P6-T1
 * world per scenario, the action driven at TOP LEVEL (the plain shim
 * supports no async `it`), the `it` bodies assert the captured
 * plain-data effect.
 *
 * @module @dsh-agent-team/runtime/test/prf-inspect-same-source
 */

import { describe, expect, it } from 'vitest'

import { parseChildSessionId, parseInstanceId, parseTemplateId } from '../../contracts/src/index.js'
import { createTeamRuntime } from '../action-router/index.js'
import type {
  ConfigInspectedPolicyStateView,
  ConfigInspectedRecoveryView,
  ConfigInspectedRequirementView,
  TeamRuntimeActionOutcome,
} from '../admission/index.js'
import type { PolicyStateTransitionRecord } from '../mutation/index.js'
import {
  optionalRequirementAcceptedPayload,
  recoveryIncidentClosedPayload,
  recoveryIncidentOpenedPayload,
  templateAvailabilitySetPayload,
  writeRequirementFact,
} from '../requirements/index.js'
import { P6T1_FIXTURE, createP6T1World, destroyP6T1World, type P6T1World } from './p6t1-helpers.js'

const ROOT = String(P6T1_FIXTURE.rootSessionId)
const LEADER_CALLER = { kind: 'instance', instanceId: 'inst-leader' } as const
const WORKER_ID = 'inst-worker'
const PRF_NOW = P6T1_FIXTURE.createdAt

// §7.4 (pre-flip): a v3 document declares BOTH authority documents; both are
// `rules: []`, which is the honest zero this fixture always meant (an absent
// pre-v3 carrier already reads as `{rules: []}`, and an empty hard envelope
// narrows nothing). No test here reaches the permission-mutation lane, so the
// v3 ceiling gate stays unspent — the document moved, this fixture's claim did not.
/** The P6-T1 world blueprint (the same shape the model-inspect suite pins). */
function blueprintSource(): string {
  return [
    '---',
    'schemaVersion: 3',
    'permissionMutationEnvelope:',
    '  rules: []',
    'teamHardEnvelope:',
    '  rules: []',
    'blueprintId: PRF-IC-BP',
    'revision: "1"',
    'leader:',
    '  templateId: leader',
    '  persona: You lead the PR-F same-source team.',
    'members:',
    '  - templateId: worker',
    '    displayName: Worker',
    '    persona: You do the PR-F same-source work.',
    'requirements:',
    '  - domain: tool',
    '    name: web',
    '    optional: true',
    'teamEnvelope:',
    '  allow:',
    '    - create-member',
    '    - assign-task',
    '  deny:',
    '    - delete-team',
    'memberEnvelopes:',
    '  - templateId: worker',
    '    envelope:',
    '      allow:',
    '        - web.search',
    '      deny: []',
    'policyStates:',
    '  - id: default',
    '    description: The PR-F same-source default state.',
    '  - id: strict-mode',
    '    description: The PR-F strict state (test transition target).',
    'quotas:',
    '  team:',
    '    maxInstances: 4',
    '    maxConcurrent: 3',
    '  members:',
    '    maxInstances: 2',
    'metadata: {}',
    '---',
    '',
  ].join('\n')
}

async function createWorld(basename: string): Promise<P6T1World> {
  return createP6T1World(basename, {
    blueprintSource: blueprintSource(),
    seedMembers: [
      {
        instanceId: parseInstanceId('inst-leader'),
        templateId: parseTemplateId('leader'),
        childSessionId: parseChildSessionId(`session-child-${basename}-leader`),
      },
      {
        instanceId: parseInstanceId(WORKER_ID),
        templateId: parseTemplateId('worker'),
        childSessionId: parseChildSessionId(`session-child-${basename}-worker`),
      },
    ],
  })
}

/** Drive the SHIPPED inspect-config action against the worker. */
async function driveInspect(
  world: P6T1World,
  token: string,
  options?: {
    readonly policyStateTransitions?: (rootSessionId: string) => readonly PolicyStateTransitionRecord[]
  },
): Promise<TeamRuntimeActionOutcome> {
  const runtime = createTeamRuntime({
    teamDomain: world.domain,
    activationProvider: world.provider,
    blueprintCatalog: world.catalog,
    environmentFacts: world.ports.environmentFacts,
    externalPolicyFacts: world.ports.externalPolicyFacts,
    now: () => PRF_NOW,
    staticModel: { provider: 'qiyuan-self', model: 'qwen3.8-27b' },
    ...(options?.policyStateTransitions !== undefined
      ? { policyStateTransitions: options.policyStateTransitions }
      : {}),
  })
  return await runtime.performAction({
    rootSessionId: ROOT,
    action: 'inspect-config',
    caller: LEADER_CALLER,
    targetInstanceId: WORKER_ID,
    requestToken: token,
  })
}

function inspectEffect(outcome: TeamRuntimeActionOutcome): {
  effective: Record<string, unknown>
  operationPermissions: unknown
  policyState: ConfigInspectedPolicyStateView
  requirement: ConfigInspectedRequirementView
  recovery: ConfigInspectedRecoveryView
} {
  const effect = outcome.effect
  if (effect.kind !== 'config-inspected') {
    throw new Error(`expected config-inspected, got '${effect.kind}'`)
  }
  return effect as unknown as {
    effective: Record<string, unknown>
    operationPermissions: unknown
    policyState: ConfigInspectedPolicyStateView
    requirement: ConfigInspectedRequirementView
    recovery: ConfigInspectedRecoveryView
  }
}

// --- S1: the payload shape + the blueprint-default policyState -------------------

const S1 = await (async () => {
  const world = await createWorld('prf-s1')
  try {
    return await driveInspect(world, 'tok-prf-s1')
  } finally {
    await destroyP6T1World(world)
  }
})()

// --- S2: the durable facts are read verbatim (no re-probe) ------------------------

const S2 = await (async () => {
  const world = await createWorld('prf-s2')
  try {
    const repos = world.domain.repositories
    // The durable compatibility verdict (verbatim in the view).
    await repos.compatibility.put({
      schemaVersion: 2,
      rootSessionId: ROOT,
      status: 'DEGRADED_ACKNOWLEDGED',
      fingerprint: 'fp-prf-s2',
      generation: 3,
      outcomes: { 'req-web': { result: 'MISMATCH', severity: 'warning' } },
      acknowledgements: [
        {
          requirementId: 'req-web',
          mismatchFingerprint: 'fp-prf-s2-mismatch',
          environmentFingerprint: 'fp-prf-s2',
          acknowledgedBy: 'human-1',
          acknowledgedAt: PRF_NOW,
          note: 'ack',
        },
      ],
      computedAt: PRF_NOW,
    })
    // The durable PR-E facts (sequence order: the LATEST row per key wins).
    const now = () => PRF_NOW
    await writeRequirementFact(
      repos.ledger,
      ROOT,
      'optional-requirement-accepted',
      optionalRequirementAcceptedPayload({
        requirementId: 'req-web',
        generation: 1,
        consentedAt: 1700000000001,
        consentedBy: 'human-1',
      }),
      now,
    )
    await writeRequirementFact(
      repos.ledger,
      ROOT,
      'optional-requirement-accepted',
      optionalRequirementAcceptedPayload({
        requirementId: 'req-web',
        generation: 2,
        consentedAt: 1700000000002,
        consentedBy: 'human-2',
      }),
      now,
    )
    await writeRequirementFact(
      repos.ledger,
      ROOT,
      'template-availability-set',
      templateAvailabilitySetPayload({ templateId: 'worker', available: false, at: 1700000000003 }),
      now,
    )
    await writeRequirementFact(
      repos.ledger,
      ROOT,
      'template-availability-set',
      templateAvailabilitySetPayload({ templateId: 'worker', available: true, at: 1700000000004 }),
      now,
    )
    // The incident history: scope-a OPENED (still open); scope-b OPENED then
    // CLOSED (the closed fact is the durable exit record); scope-c CLOSED only.
    await writeRequirementFact(
      repos.ledger,
      ROOT,
      'recovery-incident-opened',
      recoveryIncidentOpenedPayload({ scope: 'scope-a', requirementIds: ['req-web'], openedAt: 1700000000005 }),
      now,
    )
    await writeRequirementFact(
      repos.ledger,
      ROOT,
      'recovery-incident-opened',
      recoveryIncidentOpenedPayload({ scope: 'scope-b', requirementIds: ['req-skill'], openedAt: 1700000000006 }),
      now,
    )
    await writeRequirementFact(
      repos.ledger,
      ROOT,
      'recovery-incident-closed',
      recoveryIncidentClosedPayload({ scope: 'scope-b', requirementIds: ['req-skill'], closedAt: 1700000000007 }),
      now,
    )
    await writeRequirementFact(
      repos.ledger,
      ROOT,
      'recovery-incident-closed',
      recoveryIncidentClosedPayload({ scope: 'scope-c', requirementIds: ['req-mcp'], closedAt: 1700000000008 }),
      now,
    )
    return await driveInspect(world, 'tok-prf-s2')
  } finally {
    await destroyP6T1World(world)
  }
})()

// --- S3: the committed PolicyState (the same durable read as the projection) ------

const S3_TRANSITION: PolicyStateTransitionRecord = {
  entryId: 'entry-prf-s3',
  origin: 'human',
  state: {
    stateId: 'strict-mode',
    cells: { model: { locked: true } },
  },
  requestedAtStep: 0,
  effectiveFromStep: 1,
}

const S3 = await (async () => {
  const world = await createWorld('prf-s3')
  try {
    return await driveInspect(world, 'tok-prf-s3', {
      policyStateTransitions: (rootSessionId) =>
        rootSessionId === ROOT ? [S3_TRANSITION] : [],
    })
  } finally {
    await destroyP6T1World(world)
  }
})()

// --- assertions ------------------------------------------------------------------

describe('PR-F §F.4: team_inspect_config is the same-source read surface', () => {
  it('S1: `effective` is the closed set MINUS the generic `permissions` cell', () => {
    const effect = inspectEffect(S1)
    expect(Object.keys(effect.effective).sort()).toEqual(['mcp', 'model', 'skills', 'tools'])
    expect('permissions' in effect.effective).toBe(false)
    // The independent alpha.2 authority is still carried (A2C-3 untouched).
    expect(effect.operationPermissions).toBeDefined()
  })

  it('S1: `policyState` is the implicit blueprint default when no transition was committed', () => {
    const effect = inspectEffect(S1)
    expect(effect.policyState).toEqual({
      stateId: 'default',
      source: 'blueprint-default',
      cells: {},
    })
  })

  it('S1: `requirement` is empty (never probed / no durable facts) and `recovery` is inactive', () => {
    const effect = inspectEffect(S1)
    expect(effect.requirement.consents).toEqual([])
    expect(effect.requirement.templateAvailability).toEqual([])
    expect('compatibility' in effect.requirement).toBe(false)
    expect(effect.recovery).toEqual({ openIncidents: [], lastClosed: [], active: false })
  })

  it('S2: the compatibility verdict is read VERBATIM from the durable record', () => {
    const effect = inspectEffect(S2)
    expect(effect.requirement.compatibility).toEqual({
      status: 'DEGRADED_ACKNOWLEDGED',
      fingerprint: 'fp-prf-s2',
      generation: 3,
      outcomes: { 'req-web': { result: 'MISMATCH', severity: 'warning' } },
      acknowledgements: [
        {
          requirementId: 'req-web',
          mismatchFingerprint: 'fp-prf-s2-mismatch',
          environmentFingerprint: 'fp-prf-s2',
          acknowledgedBy: 'human-1',
          acknowledgedAt: PRF_NOW,
          note: 'ack',
        },
      ],
      computedAt: PRF_NOW,
    })
  })

  it('S2: the LATEST consent per requirement wins (sequence order)', () => {
    const effect = inspectEffect(S2)
    expect(effect.requirement.consents).toEqual([
      { requirementId: 'req-web', consentedBy: 'human-2', consentedAt: 1700000000002 },
    ])
  })

  it('S2: the LATEST availability fact per template wins (sequence order)', () => {
    const effect = inspectEffect(S2)
    expect(effect.requirement.templateAvailability).toEqual([
      { templateId: 'worker', available: true, at: 1700000000004 },
    ])
  })

  it('S2: `recovery` is DERIVED from the incident facts (open = latest fact is opened)', () => {
    const effect = inspectEffect(S2)
    expect(effect.recovery.active).toBe(true)
    expect(effect.recovery.openIncidents).toEqual([
      { scope: 'scope-a', requirementIds: ['req-web'], openedAt: 1700000000005 },
    ])
    // scope-b's latest fact is `closed` → the durable exit record (history,
    // not live state); scope-c was never open (closed-only history).
    expect(effect.recovery.lastClosed).toEqual([
      { scope: 'scope-b', requirementIds: ['req-skill'], closedAt: 1700000000007 },
      { scope: 'scope-c', requirementIds: ['req-mcp'], closedAt: 1700000000008 },
    ])
  })

  it('S3: a committed transition surfaces `durable-transition` + the entry origin + the committed cells', () => {
    const effect = inspectEffect(S3)
    expect(effect.policyState).toEqual({
      stateId: 'strict-mode',
      source: 'durable-transition',
      cells: { model: { locked: true } },
      transition: { entryId: 'entry-prf-s3', origin: 'human' },
    })
  })
})
