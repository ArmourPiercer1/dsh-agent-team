/**
 * leader-disable-no-requirements-initial-work.test.ts — finding I residual
 * (P2, external finding 2026-10-01) regression: an accepted durable LEADER
 * disable (`available:false`) on a requirement-free leader template was
 * ignored at the initial-work boundary.
 *
 * The defect (a SECOND instance of the finding-I root cause):
 * `leaderTemplateScopeRefs` (action-router/root-initial-work.ts L183–193)
 * added the LEADER template scope to the initial-work gate's scope refs
 * ONLY WHEN `leader.requirements` was non-empty. A requirement-free leader
 * produced NO scope ref at all — and the finding-I fix derives the disabled
 * set from the action's scope refs + the durable availability (INDEPENDENT
 * of the verdicts: a template with no requirements produces no verdict row)
 * — so a disabled requirement-free leader was invisible to the disabled
 * set, `team.admitInitialWork` returned allowed, and the initial
 * model/work proceeded into a disabled leader. The existing finding-I
 * suite (template-disable-no-requirements-gate.test.ts) covers only the
 * WORKER delegate path — the initial-work LEADER path was untested.
 *
 * This suite pins the REAL wiring (the same production chain as the tcm-m3
 * root initial-work suite — no handcrafted impact objects):
 *
 * - the fixture is a REAL schema-v2 blueprint: a REQUIRED team-level
 *   `skill/base` (passing — the Team scope stays healthy) + a LEADER
 *   template and a WORKER template that each declare NO requirements
 *   (the leader scope carries no requirement inputs at all — the exact
 *   empty case);
 * - the disable/enable goes through the PRODUCTION durable writer
 *   `setTemplateAvailabilityFact` (the SAME writer the production root's
 *   `requirementAuthority.setTemplateAvailability` service calls), read
 *   back by the gate's durable fold (`readRequirementFacts`);
 * - the initial-work admission is the PRODUCTION closure
 *   `createAdmitRootInitialWork` (Phase A gate + admission under
 *   withTeamLock, Phase B the root delivery with the chain released,
 *   Phase C the terminal fact) — only the model-visible delivery port is
 *   a fake (it records the exact submission);
 * - the SUBSEQUENT root-boundary admission is the PRODUCTION router
 *   (`createP6T2Runtime` → `performAction(follow-up, target=inst-leader)`
 *   → the step-5 requirement gate with the follow-up's real impact —
 *   `newWorkTargetTemplateId` resolves the addressed leader row's
 *   templateId, unconditional of its requirement set);
 * - the CONTROL lane (the gate blocks WORK — model/work — not control):
 *   the router's `list-members` (read) and `report-progress`
 *   (coordination — "this is how recovery is reviewed") still execute
 *   with the leader disabled, and the gate-level `controlImpact` /
 *   `recoveryWorkImpact` consults on the leader scope stay allowed.
 *
 * Legs:
 *   IL1 (RED pre-fix): a disabled requirement-free leader BLOCKS
 *     `admitInitialWork` (typed COMPATIBILITY_BLOCKED,
 *     `gateReason: 'templateDisabled'`, `blockedScopes:
 *     ['template:leader']`) with ZERO model and ZERO work (zero delivery
 *     calls, zero Root work facts — the gate runs BEFORE the admission);
 *   IL2: the SUBSEQUENT root-boundary admission (the follow-up to the
 *     leader instance) is BLOCKED the same way (the same typed block;
 *     zero work facts for that token — the gate blocks before the Phase A
 *     admission);
 *   IL3: with the leader disabled the legitimate control/recovery lanes
 *     still function (the non-work lanes are not the work-admission seam);
 *   IL4 (RED pre-fix): re-enable RESUMES the initial work through the
 *     SAME checks (the same production chain admits again — fresh
 *     admission + delivery + terminal fact).
 *
 * House pattern of the requirement-gate suites: async world construction
 * at the top of the `it` body, teardown in `afterEach`.
 *
 * @module @dsh-agent-team/runtime/test/leader-disable-no-requirements-initial-work
 */

import { afterEach, describe, expect, it } from 'vitest'

import type { LedgerEntry } from '../../storage/schema/index.js'
import { createAdmitRootInitialWork } from '../action-router/index.js'
import type { AdmitRootInitialWork, RootWorkDeliveryPort } from '../action-router/index.js'
import { leaderTemplateScopeRefs } from '../action-router/root-initial-work.js'
import {
  TEAM_RUNTIME_ERROR_CODES,
  enforceRequirementGate,
  isTeamRuntimeError,
  readRequirementFacts,
  resolveCaller,
} from '../admission/index.js'
import type { ResolvedCaller } from '../admission/index.js'
import {
  controlImpact,
  recoveryWorkImpact,
  scopeKey,
  scopeRequirementInputsOf,
  setTemplateAvailabilityFact,
} from '../requirements/index.js'
import { destroyP6T1World } from './p6t1-helpers.js'
import type { P6T1World } from './p6t1-helpers.js'
import {
  P6T2_NOW,
  P6T2_ROOT,
  P6T2_SEEDS,
  createP6T2Runtime,
  createP6T2World,
  leaderCaller,
  makeActionRequest,
  memberCaller,
} from './p6t2-helpers.js'
import type { TeamBlueprint } from '../../domain/blueprint/src/index.js'

// --- the fixture (schema v2: NO template requirements — the empty case) ------------

/**
 * The version this fixture's document declares is the SUBJECT of the file, not
 * a formality, so §7.4 (lane B-runtime-semantics-A) leaves it at 2 and gives it
 * a home here instead of in the fence's sight: production compiles the
 * requirement scopes this document declares only when the document declares
 * version 2 — five sites compare the declared version against 2
 * (requirements/scope-requirements.ts:108, requirements/creation-preflight.ts:217,
 * admission/requirement-gate.ts:460, compatibility/blueprint.ts:81,
 * activation/provider.ts:821). Raising the digit therefore does not upgrade the
 * fixture, it deletes the surface the fixture observes: the trial promotion to the supported version reddened the file's premise test (1 of 5, all green at base): the leader scope had no verdict inputs left to read. 
 * dev/agent-workflow/evidence/a4-pr7/7-4-b2a/trial-v2/. The YAML bytes this file
 * emits are byte-for-byte what they were; only the carrier moved. And the
 * carrier is typed, so when §7.3 narrows TeamBlueprint['schemaVersion'] to the
 * surviving version this line stops compiling and names THIS FILE — which is the
 * loud failure §7.4 exists to arrange, in place of a document that would
 * otherwise become a silent parse refusal.
 */
const DECLARED_DOCUMENT_VERSION: TeamBlueprint['schemaVersion'] = 2
/**
 * The finding-I-residual fixture: a REQUIRED team-level `skill/base`
 * (passing — the Team scope stays healthy) + a LEADER template and a
 * WORKER template that each declare NO requirements at all (the leader
 * scope produces no verdict row — the exact case the scope refs must
 * still carry, because the scope exists because the template exists in
 * the blueprint, not because it has requirements).
 */
const FNLI_BLUEPRINT_SOURCE = [
  '---',
  `schemaVersion: ${DECLARED_DOCUMENT_VERSION}`,
  'blueprintId: FNLI-BP',
  'revision: "1"',
  'leader:',
  '  templateId: leader',
  '  persona: You lead the FNLI team.',
  'members:',
  '  - templateId: worker',
  '    displayName: Worker',
  '    persona: You do the FNLI work.',
  'requirements: []',
  'teamRequirements:',
  '  - requirementId: req-team-core',
  '    type: skill',
  '    subjects:',
  '      - base',
  '    complete: true',
  'teamEnvelope:',
  '  allow:',
  '    - assign-task',
  '    - create-member',
  '    - send-message',
  '    - report-progress',
  '    - request-control',
  '    - resolve-control',
  '    - archive-member',
  '    - restore-member',
  '  deny:',
  '    - delete-team',
  'memberEnvelopes:',
  '  - templateId: worker',
  '    envelope:',
  '      allow:',
  '        - send-message',
  '        - report-progress',
  '      deny: []',
  'policyStates:',
  '  - id: default',
  '    description: The FNLI default state.',
  'quotas:',
  '    team:',
  '      maxInstances: 4',
  '      maxConcurrent: 4',
  '    members:',
  '      maxInstances: 2',
  '      maxConcurrent: 2',
  'metadata: {}',
  '---',
].join('\n')

// --- the test plumbing -------------------------------------------------------------

/** The fake model-visible delivery port of the Root initial work (records the
 *  exact submissions — the ONLY fake in the chain). */
interface FakeRootDelivery {
  readonly port: RootWorkDeliveryPort
  readonly calls: {
    readonly rootSessionId: string
    readonly requestToken: string
    readonly prompt: string
  }[]
}

function createFakeRootDelivery(): FakeRootDelivery {
  const calls: FakeRootDelivery['calls'] = []
  const port: RootWorkDeliveryPort = {
    async deliverRootWork(input) {
      calls.push({
        rootSessionId: input.rootSessionId,
        requestToken: input.requestToken,
        prompt: input.prompt,
      })
    },
  }
  return { port, calls }
}

/**
 * Build the production Root initial-work closure over one world (the plan
 * §15.8 shape: the shared team-lock chain + the real repositories + the
 * world's environment-facts port + the injected delivery port) — the same
 * wiring the tcm-m3 suite drives.
 */
function createRootAdmit(
  world: P6T1World,
  delivery: RootWorkDeliveryPort,
  teamLocks: Map<string, Promise<unknown>>,
): AdmitRootInitialWork {
  return createAdmitRootInitialWork({
    teamLocks,
    repositories: world.domain.repositories,
    environmentFacts: world.ports.environmentFacts,
    now: () => P6T2_NOW,
    deliverRootWork: delivery,
  })
}

/** The resolved Leader caller of one world (the honest resolution). */
function worldCaller(world: P6T1World): ResolvedCaller {
  return resolveCaller(world.domain.repositories, P6T2_ROOT, leaderCaller())
}

/** All durable Root initial-work facts (the `targetKind: 'root'` pair). */
function rootWorkFacts(world: P6T1World): LedgerEntry[] {
  return world.domain.repositories.ledger.list().filter(
    (entry) =>
      entry.rootSessionId === P6T2_ROOT &&
      (entry.factType === 'team-work-admitted' || entry.factType === 'team-root-work-delivered') &&
      entry.payload['targetKind'] === 'root',
  )
}

/** Every durable fact carrying one request token (the zero-work probe). */
function factsForToken(world: P6T1World, token: string): LedgerEntry[] {
  return world.domain.repositories.ledger.list().filter(
    (entry) => entry.rootSessionId === P6T2_ROOT && entry.payload['requestToken'] === token,
  )
}

/** Durably disable/enable the leader template (the production writer). */
async function setLeaderAvailability(world: P6T1World, available: boolean): Promise<void> {
  await setTemplateAvailabilityFact({
    ledger: world.domain.repositories.ledger,
    blueprint: world.blueprint,
    rootSessionId: P6T2_ROOT,
    templateId: 'leader',
    available,
    now: () => P6T2_NOW,
  })
}

/** Create one FNLI world (leader + worker rows seeded; the v2 fixture). */
async function createFnliWorld(basename: string): Promise<P6T1World> {
  return createP6T2World(basename, ['leader', 'worker'], { blueprintSource: FNLI_BLUEPRINT_SOURCE })
}

// --- the legs ------------------------------------------------------------------------

describe('finding I residual: a disabled requirement-free LEADER blocks the initial-work boundary', () => {
  let world: P6T1World | undefined

  afterEach(() => {
    if (world !== undefined) {
      destroyP6T1World(world)
      world = undefined
    }
  })

  it('premise: the leader template declares NO requirements (its scope has no verdict inputs)', async () => {
    world = await createFnliWorld('fnli-premise')
    const inputs = scopeRequirementInputsOf(world.blueprint)
    // The team scope carries the ONLY requirement (passing).
    expect(inputs.team.map((input) => input.requirementId)).toEqual(['req-team-core'])
    // The leader (and the worker) declare nothing: NO template requirement
    // inputs, NO template scope in the extraction (the empty case the
    // scope refs must still cover).
    expect(inputs.templates['leader']).toBeUndefined()
    expect(inputs.templates['worker']).toBeUndefined()
    expect(inputs.scopes.map((scope) => scopeKey(scope))).toEqual(['team'])
    // The bound blueprint is v2 (the gate's template-scope surface is live)
    // and the leader templateId is `leader`.
    // The witness constant, not a second digit: the assertion proves the runtime
    // read the version this file declares (the file's own carrier, see above).
    expect(world.blueprint.schemaVersion).toBe(DECLARED_DOCUMENT_VERSION)
    expect(world.blueprint.leader.templateId).toBe('leader')
  })

  it('IL1: a DISABLED requirement-free leader BLOCKS admitInitialWork (zero model, zero work)', async () => {
    world = await createFnliWorld('fnli-il1')
    await setLeaderAvailability(world, false)
    const durable = readRequirementFacts(world.domain.repositories, P6T2_ROOT)
    expect(durable.availability).toEqual([{ templateId: 'leader', available: false }])

    const delivery = createFakeRootDelivery()
    const admit = createRootAdmit(world, delivery.port, new Map())
    const result = await admit({
      rootSessionId: P6T2_ROOT,
      caller: worldCaller(world),
      requestToken: 'tok-fnli-il1',
      prompt: 'Do the FNLI initial work.',
      blueprint: world.blueprint,
    }).then(
      () => {
        throw new Error('expected the disabled leader to BLOCK the initial work')
      },
      (error: unknown) => error,
    )
    // The typed block names the leader scope (availability, not a policy
    // denial — the finding-I gateReason).
    expect(isTeamRuntimeError(result)).toBe(true)
    if (!isTeamRuntimeError(result)) return
    expect(result.code).toBe(TEAM_RUNTIME_ERROR_CODES.COMPATIBILITY_BLOCKED)
    expect(result.details?.['source']).toBe('requirement-gate')
    expect(result.details?.['status']).toBe('BLOCKED_FATAL')
    expect(result.details?.['gateReason']).toBe('templateDisabled')
    expect(result.details?.['blockedScopes']).toEqual(['template:leader'])
    expect(result.details?.['recoveryDispatchAvailable']).toBe(false)
    // ZERO model + ZERO work: the gate ran BEFORE the admission — no
    // delivery call, no Root work fact (neither the admission nor the
    // terminal).
    expect(delivery.calls).toEqual([])
    expect(rootWorkFacts(world)).toEqual([])
  })

  it('IL2: the SUBSEQUENT root-boundary admission (follow-up to the leader instance) is blocked the same way', async () => {
    world = await createFnliWorld('fnli-il2')
    await setLeaderAvailability(world, false)

    // The production router's step-5 gate for the follow-up: the target
    // resolves to the seeded leader row → the impact is normal work on
    // [team, template:leader] (newWorkTargetTemplateId — unconditional of
    // the requirement set).
    const runtime = createP6T2Runtime(world)
    const outcome = await runtime
      .performAction(
        makeActionRequest({
          action: 'follow-up',
          targetInstanceId: String(P6T2_SEEDS.leader.instanceId),
          requestToken: 'tok-fnli-il2',
          payload: { prompt: 'Follow up on the FNLI work.' },
        }),
      )
      .then(
        () => {
          throw new Error('expected the disabled leader to BLOCK the follow-up')
        },
        (error: unknown) => error,
      )
    expect(isTeamRuntimeError(outcome)).toBe(true)
    if (!isTeamRuntimeError(outcome)) return
    expect(outcome.code).toBe(TEAM_RUNTIME_ERROR_CODES.COMPATIBILITY_BLOCKED)
    expect(outcome.details?.['source']).toBe('requirement-gate')
    expect(outcome.details?.['gateReason']).toBe('templateDisabled')
    expect(outcome.details?.['blockedScopes']).toEqual(['template:leader'])
    // Zero work: the gate blocked BEFORE the Phase A admission (no fact
    // carries the token — no admission, no delivery, no terminal).
    expect(factsForToken(world, 'tok-fnli-il2')).toEqual([])
  })

  it('IL3: with the leader disabled the legitimate control/recovery lanes still function', async () => {
    world = await createFnliWorld('fnli-il3')
    await setLeaderAvailability(world, false)
    const runtime = createP6T2Runtime(world)

    // (a) the read lane: list-members executes (a read — not a work
    //     admission; the gate is never consulted for it).
    const list = await runtime.performAction(makeActionRequest({ action: 'list-members' }))
    expect(list.status).toBe('executed')
    expect(list.action).toBe('list-members')

    // (b) the coordination lane: the worker's report-progress executes
    //     (pure coordination — the recovery review lane; it never wakes
    //     work and never gates on the leader scope).
    const workerId = String(P6T2_SEEDS.worker.instanceId)
    const progress = await runtime.performAction(
      makeActionRequest({
        action: 'report-progress',
        caller: memberCaller(workerId),
        targetInstanceId: workerId,
        requestToken: 'tok-fnli-il3-progress',
        payload: { progress: 'in-progress' },
      }),
    )
    expect(progress.status).toBe('executed')
    expect(progress.action).toBe('report-progress')

    // (c) the gate-level CONTROL / RECOVERY impacts on the leader scope
    //     stay allowed: the gate blocks WORK (normal work — model/work),
    //     never control or recovery (the target-design §10 matrix:
    //     "control resolution / archive-restore-dispose / human
    //     recheck-governance → none → keep available"; recovery work is
    //     allowed on the reduced original authority).
    const refs = leaderTemplateScopeRefs(world.blueprint)
    const gateOptions = {
      repositories: world.domain.repositories,
      blueprint: world.blueprint,
      rootSessionId: P6T2_ROOT,
      environmentFacts: world.ports.environmentFacts,
      externalPolicyFacts: world.ports.externalPolicyFacts,
      now: () => P6T2_NOW,
    }
    const control = await enforceRequirementGate(gateOptions, controlImpact(refs))
    expect(control.reason).toBe('alwaysAllowed')
    const recovery = await enforceRequirementGate(gateOptions, recoveryWorkImpact(refs))
    expect(recovery.reason).toBe('allowed')
  })

  it('IL4: re-enable RESUMES the initial work through the same checks (allowed again)', async () => {
    world = await createFnliWorld('fnli-il4')
    // Disable first (the same production writer): the initial work is
    // blocked (the same typed block as IL1 — zero work).
    await setLeaderAvailability(world, false)
    const delivery = createFakeRootDelivery()
    const admit = createRootAdmit(world, delivery.port, new Map())
    const blocked = await admit({
      rootSessionId: P6T2_ROOT,
      caller: worldCaller(world),
      requestToken: 'tok-fnli-il4-pre',
      prompt: 'Do the FNLI initial work.',
      blueprint: world.blueprint,
    }).then(
      () => {
        throw new Error('expected the disabled leader to BLOCK the initial work')
      },
      (error: unknown) => error,
    )
    expect(isTeamRuntimeError(blocked)).toBe(true)
    if (!isTeamRuntimeError(blocked)) return
    expect(blocked.code).toBe(TEAM_RUNTIME_ERROR_CODES.COMPATIBILITY_BLOCKED)
    expect(blocked.details?.['gateReason']).toBe('templateDisabled')
    expect(blocked.details?.['blockedScopes']).toEqual(['template:leader'])
    expect(delivery.calls).toEqual([])
    expect(rootWorkFacts(world)).toEqual([])

    // The human re-enables (the same production writer — latest wins on
    // the durable fold).
    await setLeaderAvailability(world, true)
    const durable = readRequirementFacts(world.domain.repositories, P6T2_ROOT)
    expect(durable.availability).toEqual([{ templateId: 'leader', available: true }])

    // The re-drive admits through the SAME production chain: the leader is
    // STILL requirement-free — the admission keys on availability, not on
    // the presence of requirements.
    const admitted = await admit({
      rootSessionId: P6T2_ROOT,
      caller: worldCaller(world),
      requestToken: 'tok-fnli-il4',
      prompt: 'Do the FNLI initial work.',
      blueprint: world.blueprint,
    })
    expect(admitted.mode).toBe('fresh')
    expect(admitted.delivered).toBe(true)
    expect(delivery.calls).toEqual([
      {
        rootSessionId: P6T2_ROOT,
        requestToken: 'tok-fnli-il4',
        prompt: 'Do the FNLI initial work.',
      },
    ])
    // The durable two-fact pair (the admission + the terminal).
    const facts = rootWorkFacts(world)
    expect(facts).toHaveLength(2)
    const types = facts.map((entry) => entry.factType).sort()
    expect(types).toEqual(['team-root-work-delivered', 'team-work-admitted'])
  })
})
