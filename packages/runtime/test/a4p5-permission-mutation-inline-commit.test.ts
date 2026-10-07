/**
 * a4p5-permission-mutation-inline-commit.test.ts — A4-PR5 lane B: the INLINE
 * commit by retry-discovery (spec §8.5, ADR A1-8/A1-9, freeze §2).
 *
 * The commit is not a callback: the approval is durable, and the NEXT call of
 * the SAME mutation (same fingerprint, same base pair) discovers the decision
 * and revalidates EVERYTHING at the commit boundary before appending:
 *
 *   lifecycle live -> base pair equal -> plan still changes -> the planned
 *   rule set and the RISE DIGEST still equal the approved ones -> the
 *   recomputed required rung still sits at or under the approved rung ->
 *   ONE `overlay.append` (commit-before-ack).
 *
 * Every drift in that chain answers `mutation-stale` with ZERO writes — the
 * approval covered the mutation as it was, never as it has become (A1-8).
 * `denied` is terminal at the base; the escalation with no rung left renders
 * the failure truthfully ("the rise failed"), never "awaiting <successor>".
 *
 * The worlds are real (overlay durable world + REAL ControlService over the
 * durable TeamDomain world); only the injected lane facts (hard slot, static
 * layers, containment, lifecycle) are harness-owned, because they are exactly
 * what the drift legs move.
 *
 * @module @dsh-agent-team/runtime/test/a4p5-permission-mutation-inline-commit
 */

import { describe, expect, it } from 'vitest'
import * as approvalLane from '../governance/permission-approval.js'
import {
  createGovernanceMutationService,
  type GovernanceMutationService,
  type GovernancePermissionMutationArgs,
  type PermissionResourceMatcher,
  type PermissionStaticLayerFacts,
} from '../governance/index.js'
import type { PermissionAuthorityCeilingContext } from '../governance/types.js'
import { createGovernanceProposalStore } from '../governance/proposal-store.js'
import { createTeamOperationCoordinator } from '../coordination/index.js'
import type { OverrideRecordView, OverrideStorePort, PolicyReader } from '../mutation/index.js'
import type { PolicyStateTransitionRecord } from '../mutation/types.js'
import type { GovernanceTransitionCache, GovernanceTransitionCommit } from '../governance/types.js'
import { LEADER_INSTANCE_ID } from '../../contracts/src/index.js'
import type { ActionCaller } from '../admission/types.js'
import type { AuthorityDocumentSlot, AuthorityEnvelopeDocuments } from '../governance/authority-ceiling.js'
import type { AuthorityEnvelope } from '../../domain/authority-envelope/src/index.js'
import { createP6T4Service, createP6T4World, destroyP6T1World, humanCaller, leaderCaller, P6T4_ROOT, P6T4_SEEDS } from './p6t4-helpers.js'
import { openWorld, snapshotInput } from './permission-overlay-helpers.js'
import { renderPermissionResourceText as approvalLane_render } from '../governance/index.js'
import { createS6RemoteDispatcher, createS6RemotePorts } from '../src/plugin/s6-remote.js'
import { REMOTE_CONTRACT_VERSION_V7 } from '../../remote/src/index.js'
import { createTeamDomain } from '../../storage/repositories/index.js'
import { destroyDir, FileStorageSeam, scratchDir } from '../../testkit/fault-injection/file-seam.mjs'
import { APPROVAL_CASE_IDENTITY_PROBLEMS, CONTROL_REQUEST_KINDS } from '../control/index.js'

const WORKER_ID = String(P6T4_SEEDS.worker.instanceId)
const NOW = '2026-10-07T09:00:00.000Z'
const FILE_A = 'output/a.json'
const FILE_C = 'output/c.json'

const exact = (resource: string): PermissionResourceMatcher => ({ kind: 'exact', resource })
const subtree = (resource: string): PermissionResourceMatcher => ({ kind: 'subtree', resource })

class NoopOverrides implements OverrideStorePort {
  async list(_rootSessionId: string): Promise<readonly OverrideRecordView[]> {
    return []
  }
  async put(record: unknown): Promise<unknown> {
    return record
  }
}
class NoopTransitions implements GovernanceTransitionCache {
  appendTransition(_teamSessionId: string, _transition: PolicyStateTransitionRecord): void {}
  listTransitions(_teamSessionId: string): readonly PolicyStateTransitionRecord[] {
    return []
  }
}
class NoopCommit implements GovernanceTransitionCommit {
  async commit(_rootSessionId: string, _transition: PolicyStateTransitionRecord): Promise<void> {}
}
const NEVER_CONSULTED: PolicyReader = {
  readBlueprintEnvelope(): never {
    throw new Error('fixture: capability envelope read')
  },
  readTemplatePolicy(): never {
    throw new Error('fixture: template policy read')
  },
  readExternalFacts(): never {
    throw new Error('fixture: external facts read')
  },
}

function envelope(
  ...rules: { matcher: PermissionResourceMatcher; effect: 'allow' | 'ask' | 'deny' }[]
): AuthorityEnvelope {
  return {
    rules: rules.map((rule) => ({
      operationClass: 'write',
      matcher: rule.matcher,
      maximumEffect: rule.effect,
    })),
  } as AuthorityEnvelope
}

const CARRIER_ALLOW = envelope(
  { matcher: exact(FILE_A), effect: 'allow' },
  { matcher: subtree('output'), effect: 'allow' },
)

interface MutableWorld {
  readonly governance: GovernanceMutationService
  readonly control: ReturnType<typeof createP6T4Service>
  readonly proposals: ReturnType<typeof createGovernanceProposalStore>
  readonly overlay: Awaited<ReturnType<typeof openWorld>>
  readonly hard: { slot: AuthorityDocumentSlot }
  readonly staticFacts: { facts: PermissionStaticLayerFacts }
  readonly contains: { roots: Map<string, Set<string>> }
  readonly lifecycle: { state: 'live' | 'archived' | 'disposed' }
  readonly close: () => Promise<void>
  mutate: (
    args: Partial<GovernancePermissionMutationArgs> & {
      rules: readonly { operationClass: string; matcher: PermissionResourceMatcher; effect: 'allow' | 'ask' | 'deny' }[]
    },
  ) => Promise<Record<string, unknown>>
  seedOverlay: (rules: { operation: string; resource: string; effect: 'allow' | 'ask' | 'deny' }[], generation: number) => Promise<unknown>
  /** Corrupt-writer injector: when set, the lane's `requestApprovalLeg`
   *  persists THIS string as the leg summary (review item 2: the commit
   *  boundary's structural-equality arm takes the durable summary as its
   *  input — testing the CONSUMER requires injecting the corruption, not
   *  probing the pure parser). */
  readonly summaryTamper: { value: string | undefined }
  /** Fault injector (review item 6): when set, the targetGuard throws THIS
   *  instead of its lifecycle refusal — a fault wearing the guard's stack. */
  readonly guardFault: { value: unknown }
  /** Lying-reader injector (review item 7a): when set, it is merged over the
   *  durable case identity read back from the approval port — the injected
   *  boundary's answer must be VERIFIED at the commit boundary, not trusted. */
  readonly identityTamper: { value: Record<string, unknown> | undefined }
}

async function openWorld2(name: string, initialHard: AuthorityDocumentSlot = { status: 'absent' }): Promise<MutableWorld> {
  const p6 = await createP6T4World(`a4p5b-${name}`)
  const overlay = await openWorld(`a4p5b-${name}`)
  const proposals = createGovernanceProposalStore({ ledger: p6.domain.repositories.ledger as never, now: () => NOW })
  const control = createP6T4Service(p6)
  const controlRef: { current: ReturnType<typeof createP6T4Service> | undefined } = { current: control }
  const port = approvalLane.lateBoundPermissionMutationApprovalPort(
    controlRef as unknown as { current: approvalLane.PermissionMutationApprovalPort | undefined },
  )
  // Corrupt-writer injector at the PORT BOUNDARY (review item 2): whatever
  // `summaryTamper.value` holds is what reaches the durable leg row. The
  // commit boundary re-derives the rise digest from fresh reads and compares
  // it to this durable summary; a corrupt or mismatched digest must fail the
  // arm closed — never commit.
  const summaryTamper: { value: string | undefined } = { value: undefined }
  const guardFault: { value: unknown } = { value: undefined }
  const identityTamper: { value: Record<string, unknown> | undefined } = { value: undefined }
  const tamperedPort: approvalLane.PermissionMutationApprovalPort = {
    ...port,
    requestApprovalLeg: (input) =>
      port.requestApprovalLeg(
        summaryTamper.value === undefined ? input : { ...input, summary: summaryTamper.value },
      ),
    readApprovalCaseState: async (input) => {
      const read = await port.readApprovalCaseState(input)
      if (identityTamper.value === undefined || read.kind !== 'case') return read
      return {
        ...read,
        state: { ...read.state, identity: { ...read.state.identity, ...identityTamper.value } },
      }
    },
  }
  const hard = { slot: initialHard }
  const staticFacts = { facts: { layers: [] } as PermissionStaticLayerFacts }
  const contains = { roots: new Map<string, Set<string>>([['output', new Set([FILE_A, FILE_C])]]) }
  const lifecycle = { state: 'live' as 'live' | 'archived' | 'disposed' }
  const governance = createGovernanceMutationService({
    chain: createTeamOperationCoordinator(),
    overrides: new NoopOverrides(),
    transitions: new NoopTransitions(),
    transitionCommit: new NoopCommit(),
    policy: NEVER_CONSULTED,
    registeredMembers: async () => [],
    policyStates: () => ['default'],
    now: () => NOW,
    permissionLane: {
      overlay: overlay.port,
      permissionEnvelope: () => CARRIER_ALLOW,
      staticLayers: () => staticFacts.facts,
      // A subtree root contains ITSELF (the same containment contract the
      // production seam honours — a matcher never excludes its own root).
      subtreeContains: (root: string, child: string) =>
        root === child || contains.roots.get(root)?.has(child) === true,
      authorityCeiling: async (_t: string, m: string, actor: 'leader' | 'human'): Promise<PermissionAuthorityCeilingContext> => ({
        beneficiaryAuthority: 'member',
        initiatorAuthority: actor === 'leader' ? 'leader' : 'human-user',
        documents: {
          teamHardEnvelope: hard.slot,
          permissionMutationEnvelope: { status: 'declared', document: CARRIER_ALLOW },
        } satisfies AuthorityEnvelopeDocuments,
      }),
      targetGuard: async () => {
        // Review item 6: a FAULT on the guard's stack must propagate as
        // itself — the decider below does not certify it.
        if (guardFault.value !== undefined) throw guardFault.value
        if (lifecycle.state !== 'live') {
          const error = new Error(`fixture lifecycle refusal: ${lifecycle.state}`)
          ;(error as Error & { code?: string }).code = 'INSTANCE_LIFECYCLE_REFUSED'
          throw error
        }
      },
      // The fixture's own decider, mirroring the production law's shape
      // (production: `instanceof PermissionLifecycleError`): it certifies
      // ONLY the lifecycle refusal this fixture throws.
      isLifecycleRefusal: (error: unknown) =>
        (error as { code?: string } | null)?.code === 'INSTANCE_LIFECYCLE_REFUSED',
    },
    approval: tamperedPort,
    proposals,
  })
  let counter = 0
  return {
    governance,
    control,
    proposals,
    summaryTamper,
    guardFault,
    identityTamper,
    overlay,
    hard,
    staticFacts,
    contains,
    lifecycle,
    close: async () => {
      await overlay.store.close()
      overlay.destroy()
      await destroyP6T1World(p6)
    },
    mutate: async (args) =>
      (await governance.mutatePermission({
        authority: { kind: 'leader' },
        teamSessionId: P6T4_ROOT,
        memberInstanceId: WORKER_ID,
        kind: 'grant_instance',
        mutationId: `mut-${String(++counter)}`,
        reason: 'fixture',
        ...args,
      })) as unknown as Record<string, unknown>,
    seedOverlay: (rules, generation) =>
      overlay.port.append(
        snapshotInput(generation, {
          teamSessionId: P6T4_ROOT,
          memberInstanceId: WORKER_ID,
          // The PR1 store shape with the PR3 CARRIER grammar: the resource
          // is the rendered matcher text (`exact:...`), unrendered text is a
          // foreign grammar and the lane refuses the whole row (exactly the
          // law the seed must honor to be a plausible out-of-band commit).
          rules: rules.map((rule) => ({
            operation: rule.operation,
            resource: approvalLane_render({ kind: 'exact', resource: rule.resource }),
            effect: rule.effect,
          })) as never,
        }) as never,
      ),
  }
}

type Rules = readonly { operationClass: string; matcher: PermissionResourceMatcher; effect: 'allow' | 'ask' | 'deny' }[]

/** Propose `rules`; returns the pending arm's case id + leg requestId. */
async function propose(w: MutableWorld, rules: Rules) {
  const pending = await w.mutate({ rules })
  expect(pending['reason']).toBe(approvalLane.PERMISSION_MUTATION_PENDING_REASON)
  const approvalCaseId = pending['approvalCaseId'] as string
  const read = await w.control.readApprovalCaseState({ rootSessionId: P6T4_ROOT, approvalCaseId })
  if (read.kind !== 'case' || read.state.currentLeg === undefined) throw new Error('fixture: no leg')
  return { approvalCaseId, requestId: read.state.currentLeg.requestId }
}

async function decide(w: MutableWorld, requestId: string, decision: 'allow' | 'deny', caller: ActionCaller = leaderCaller()) {
  return w.control.resolveControl({ rootSessionId: P6T4_ROOT, caller, requestId, decision })
}

const GRANT_A = [{ operationClass: 'write', matcher: exact(FILE_A), effect: 'allow' as const }]

describe('allowed proposal -> inline commit, fully revalidated', () => {
  it('commits EXACTLY ONE snapshot with the planned rules', async () => {
    const w = await openWorld2('commit')
    try {
      const { requestId } = await propose(w, GRANT_A)
      await decide(w, requestId, 'allow')
      const result = await w.mutate({ rules: GRANT_A })
      expect(result['changed']).toBe(true)
      const snapshot = result['snapshot'] as { state: { rules: unknown[] }; metadata: { generation: number } }
      expect(snapshot.metadata.generation).toBe(1)
      expect(snapshot.state.rules.length).toBe(1)
      const latest = await w.overlay.port.latest({ teamSessionId: P6T4_ROOT, memberInstanceId: WORKER_ID })
      expect(latest?.metadata.generation).toBe(1)
      // The decided case stays decided; a THIRD identical call is now a plain
      // no-change (the desired state already holds — the case is not re-opened).
      const again = await w.mutate({ rules: GRANT_A })
      expect(again['reason']).toBe('no-change')
    } finally {
      await w.close()
    }
  })

  it('a risen second leg (escalation to Human User) carries the commit: the higher allow commits', async () => {
    const w = await openWorld2('escalated-commit')
    try {
      const { requestId } = await propose(w, GRANT_A)
      const escalated = await w.control.escalateApprovalLeg({
        rootSessionId: P6T4_ROOT,
        caller: leaderCaller(),
        requestId,
        reason: 'deferring to the human',
      })
      expect(escalated.caseOutcome).toBe('escalated')
      if (escalated.nextLeg === undefined) throw new Error('fixture: no risen leg')
      await decide(w, escalated.nextLeg.requestId, 'allow', humanCaller())
      const result = await w.mutate({ rules: GRANT_A })
      expect(result['changed']).toBe(true)
    } finally {
      await w.close()
    }
  })

  it('an unrelated lower-layer change that moves NO approved rise still commits', async () => {
    const w = await openWorld2('benign-drift')
    try {
      const { requestId } = await propose(w, GRANT_A)
      await decide(w, requestId, 'allow')
      // A static deny at a cell outside the approved regions (not under the
      // exact matcher of A): the approved rise is untouched.
      w.staticFacts.facts = {
        layers: [
          {
            source: 'template',
            default: 'deny',
            rules: [{ operationClass: 'write', matcher: exact('output/zz.json'), effect: 'deny' }],
          },
        ],
      } as unknown as PermissionStaticLayerFacts
      const result = await w.mutate({ rules: GRANT_A })
      expect(result['changed']).toBe(true)
    } finally {
      await w.close()
    }
  })
})

describe('base movement after approval -> the approved mutation never commits', () => {
  it('the SAME mutation at a moved base is a FRESH ask (A1-9 recovery); the allowed-at-old-base case never commits', async () => {
    const w = await openWorld2('base-moved')
    try {
      const { approvalCaseId, requestId } = await propose(w, GRANT_A)
      // A directly-committable tightening moves the base (0 -> 1).
      await w.mutate({ rules: [{ operationClass: 'write', matcher: exact('output/zz.json'), effect: 'deny' }] })
      await decide(w, requestId, 'allow')
      // The identity correlation names the base pair: at the NEW base the
      // same fingerprint is a NEW question, and the answered-at-old-base
      // case is inert — nothing commits into a base the approval never saw.
      const reasked = await w.mutate({ rules: GRANT_A })
      expect(reasked['reason']).toBe(approvalLane.PERMISSION_MUTATION_PENDING_REASON)
      expect(reasked['approvalCaseId']).not.toBe(approvalCaseId)
      const old = await w.control.readApprovalCaseState({ rootSessionId: P6T4_ROOT, approvalCaseId })
      expect(old.kind === 'case' ? old.state.status : old.kind).toBe('decided')
      const latest = await w.overlay.port.latest({ teamSessionId: P6T4_ROOT, memberInstanceId: WORKER_ID })
      expect(latest?.metadata.generation).toBe(1) // the tightening only
      const rows = (await w.proposals.listProposals({ teamSessionId: P6T4_ROOT })).filter((r) => r.kind === 'record')
      expect(rows.length).toBe(2) // one per ask, never a re-append into the answered case
    } finally {
      await w.close()
    }
  })

  it('an explicit expectedGeneration pinned at the approved base conflicts typed with ZERO writes', async () => {
    const w = await openWorld2('cas-conflict')
    try {
      const { requestId } = await propose(w, GRANT_A)
      await w.mutate({ rules: [{ operationClass: 'write', matcher: exact('output/zz.json'), effect: 'deny' }] })
      await decide(w, requestId, 'allow')
      let code: unknown
      try {
        await w.mutate({ rules: GRANT_A, expectedGeneration: 0 })
      } catch (error) {
        code = (error as { code?: string }).code
      }
      expect(code).toBe('PERMISSION_OVERLAY_GENERATION_CONFLICT')
      const latest = await w.overlay.port.latest({ teamSessionId: P6T4_ROOT, memberInstanceId: WORKER_ID })
      expect(latest?.metadata.generation).toBe(1)
    } finally {
      await w.close()
    }
  })
})

describe('drift after approval -> mutation-stale with ZERO writes', () => {
  it('lifecycle drift: an archived target answers mutation-stale (never a lifecycle throw, never a commit)', async () => {
    const w = await openWorld2('lifecycle')
    try {
      const { requestId } = await propose(w, GRANT_A)
      await decide(w, requestId, 'allow')
      w.lifecycle.state = 'archived'
      const stale = await w.mutate({ rules: GRANT_A })
      expect(stale['reason']).toBe(approvalLane.PERMISSION_MUTATION_TERMINAL_OUTCOMES.MUTATION_STALE)
      expect(await w.overlay.port.latest({ teamSessionId: P6T4_ROOT, memberInstanceId: WORKER_ID })).toBeUndefined()
    } finally {
      await w.close()
    }
  })

  it('proposal creation on an archived target still refuses typed BEFORE any row', async () => {
    const w = await openWorld2('lifecycle-propose')
    try {
      w.lifecycle.state = 'archived'
      let code: unknown
      try {
        await w.mutate({ rules: GRANT_A })
      } catch (error) {
        code = (error as { code?: string }).code
      }
      expect(code).toBe('INSTANCE_LIFECYCLE_REFUSED')
      const rows = (await w.proposals.listProposals({ teamSessionId: P6T4_ROOT })).filter((r) => r.kind === 'record')
      expect(rows.length).toBe(0)
    } finally {
      await w.close()
    }
  })

  it('matcher ROOT drift (containment retarget under the same canonical key) -> stale', async () => {
    const w = await openWorld2('root-drift')
    try {
      const rules = [{ operationClass: 'write', matcher: subtree('output'), effect: 'allow' as const }]
      const { requestId } = await propose(w, rules)
      await decide(w, requestId, 'allow')
      // The subtree root's coverage moves: the SAME key now reaches a cell the
      // approval never saw (a retarget), so the recomputed region set differs
      // from the approved one.
      w.contains.roots.set('output', new Set([FILE_A, 'output/deep/under-new-root.json']))
      w.staticFacts.facts = {
        layers: [
          {
            source: 'template',
            default: 'deny',
            rules: [
              {
                operationClass: 'write',
                matcher: exact('output/deep/under-new-root.json'),
                effect: 'deny',
              },
            ],
          },
        ],
      } as unknown as PermissionStaticLayerFacts
      const stale = await w.mutate({ rules })
      expect(stale['reason']).toBe(approvalLane.PERMISSION_MUTATION_TERMINAL_OUTCOMES.MUTATION_STALE)
      expect(await w.overlay.port.latest({ teamSessionId: P6T4_ROOT, memberInstanceId: WORKER_ID })).toBeUndefined()
    } finally {
      await w.close()
    }
  })

  it('the ceiling NARROWS after approval (required now above approved) -> stale', async () => {
    const w = await openWorld2('ceiling-narrowed')
    try {
      const { requestId } = await propose(w, GRANT_A)
      await decide(w, requestId, 'allow')
      // The Team retroactively caps the approved scope at `ask` on BOTH planes:
      // the approved rung (leader) no longer reaches what the mutation now needs.
      w.hard.slot = {
        status: 'declared',
        document: envelope({ matcher: exact(FILE_A), effect: 'ask' }),
      }
      const stale = await w.mutate({ rules: GRANT_A })
      expect(stale['reason']).toBe(approvalLane.PERMISSION_MUTATION_TERMINAL_OUTCOMES.MUTATION_STALE)
      expect(await w.overlay.port.latest({ teamSessionId: P6T4_ROOT, memberInstanceId: WORKER_ID })).toBeUndefined()
    } finally {
      await w.close()
    }
  })
})

describe('the other terminals on the retry path', () => {
  it('denied is terminal: every later call says denied, no new case, no write', async () => {
    const w = await openWorld2('denied-terminal')
    try {
      const { requestId } = await propose(w, GRANT_A)
      await decide(w, requestId, 'deny')
      const first = await w.mutate({ rules: GRANT_A })
      const second = await w.mutate({ rules: GRANT_A, mutationId: 'mut-later' })
      expect(first['reason']).toBe(approvalLane.PERMISSION_MUTATION_TERMINAL_OUTCOMES.DENIED)
      expect(second['reason']).toBe(approvalLane.PERMISSION_MUTATION_TERMINAL_OUTCOMES.DENIED)
      expect(first['approvalCaseId']).toBe(second['approvalCaseId'])
      expect(await w.overlay.port.latest({ teamSessionId: P6T4_ROOT, memberInstanceId: WORKER_ID })).toBeUndefined()
    } finally {
      await w.close()
    }
  })

  it('the rise that failed renders authority-unavailable — never "awaiting a successor"', async () => {
    const w = await openWorld2('rise-failed')
    try {
      // A LEADER-beneficiary rise starts the walk at Human User: escalating
      // that leg has no resolvable successor rung (Alpha.4 has no Human Admin),
      // so the case terminates with deny-reason-escalated and no risen leg.
      const rules = GRANT_A
      const pending = await w.mutate({
        rules,
        memberInstanceId: LEADER_INSTANCE_ID,
      })
      expect(pending['reason']).toBe(approvalLane.PERMISSION_MUTATION_PENDING_REASON)
      expect(pending['requiredAuthority']).toBe('human-user')
      const approvalCaseId = pending['approvalCaseId'] as string
      const read = await w.control.readApprovalCaseState({ rootSessionId: P6T4_ROOT, approvalCaseId })
      if (read.kind !== 'case' || read.state.currentLeg === undefined) throw new Error('fixture: no leg')
      const outcome = await w.control.escalateApprovalLeg({
        rootSessionId: P6T4_ROOT,
        caller: humanCaller(),
        requestId: read.state.currentLeg.requestId,
        reason: 'no higher rung exists',
      })
      expect(outcome.caseOutcome).toBe('authority-unavailable')
      const failed = await w.mutate({ rules, memberInstanceId: LEADER_INSTANCE_ID })
      expect(failed['reason']).toBe(approvalLane.PERMISSION_MUTATION_TERMINAL_OUTCOMES.AUTHORITY_UNAVAILABLE)
      const open = await w.control.listOpenApprovalCases({ rootSessionId: P6T4_ROOT })
      expect(open.length).toBe(0)
      expect(await w.overlay.port.latest({ teamSessionId: P6T4_ROOT, memberInstanceId: LEADER_INSTANCE_ID })).toBeUndefined()
    } finally {
      await w.close()
    }
  })

  it('desired state reached after approval -> plain no-change, the case untouched', async () => {
    const w = await openWorld2('desired-reached')
    try {
      const { approvalCaseId } = await propose(w, GRANT_A)
      // Another authorized lane committed the desired state out-of-band.
      await w.seedOverlay([{ operation: 'write', resource: FILE_A, effect: 'allow' }], 1)
      const result = await w.mutate({ rules: GRANT_A })
      expect(result['reason']).toBe('no-change')
      const read = await w.control.readApprovalCaseState({ rootSessionId: P6T4_ROOT, approvalCaseId })
      expect(read.kind === 'case' ? read.state.status : read.kind).toBe('open')
    } finally {
      await w.close()
    }
  })

  // The probe and the ARM are two different laws and now have two different
  // tests (review item 2: the previous single test was NAMED "corrupt rise
  // summary … fails closed (stale, zero write)", injected NO corruption, and
  // asserted `changed === true` — a commit. A test whose name asserts a law
  // its body does not test is worse than a missing test: it made the
  // service arm (unparseable/mismatched digest -> stale, never a commit)
  // survivable in reverse, i.e. flipping the arm to commit kept the suite
  // green. Proven flipped: with the arm bypassed both tests below go red.
  it('the rise-summary parse law is PURE (probes only — the commit-boundary arm is the two tests below)', async () => {
    const digest = approvalLane.parseRiseSummary(`pmut-rise:${'0'.repeat(64)}`)
    expect(typeof digest).toBe('string')
    expect(approvalLane.parseRiseSummary('not-a-summary')).toBeUndefined()
  })

  it('an UNPARSEABLE rise summary on the allowed leg fails the arm closed: stale, ZERO write, never a commit', async () => {
    const w = await openWorld2('corrupt-summary')
    try {
      w.summaryTamper.value = 'tampered row — not a rise digest'
      const { requestId } = await propose(w, GRANT_A)
      w.summaryTamper.value = undefined
      await decide(w, requestId, 'allow')
      const result = await w.mutate({ rules: GRANT_A })
      expect(result['changed']).toBe(false)
      expect(result['reason']).toBe(approvalLane.PERMISSION_MUTATION_TERMINAL_OUTCOMES.MUTATION_STALE)
      expect((result['detail'] as Record<string, unknown>)['problem']).toBe('rise-structure-drift')
      // ZERO write: the funnel never ran.
      expect(await w.overlay.port.latest({ teamSessionId: P6T4_ROOT, memberInstanceId: WORKER_ID })).toBeUndefined()
    } finally {
      await w.close()
    }
  })

  it('a WELL-FORMED summary naming a DIFFERENT rise structure fails the same arm closed (A1-8 structural equality, not format)', async () => {
    const w = await openWorld2('digest-mismatch')
    try {
      // Valid shape, wrong digest: a retargeted root / flipped risen effect
      // durable as a well-formed lie. Format-legal is not truth — the arm
      // compares DIGESTS, so this is stale too.
      w.summaryTamper.value = approvalLane.encodeRiseSummary('f'.repeat(64))
      const { requestId } = await propose(w, GRANT_A)
      w.summaryTamper.value = undefined
      await decide(w, requestId, 'allow')
      const result = await w.mutate({ rules: GRANT_A })
      expect(result['changed']).toBe(false)
      expect(result['reason']).toBe(approvalLane.PERMISSION_MUTATION_TERMINAL_OUTCOMES.MUTATION_STALE)
      expect((result['detail'] as Record<string, unknown>)['problem']).toBe('rise-structure-drift')
      expect(await w.overlay.port.latest({ teamSessionId: P6T4_ROOT, memberInstanceId: WORKER_ID })).toBeUndefined()
    } finally {
      await w.close()
    }
  })
})

// --- the s6 remote seam: every proposal arm through the REAL throw-proof
// dispatcher. WHY this group exists (parent rule-4 round): the pending arm
// is the outcome most at risk of being LOST at the closed v7 projection —
// a projection that drops it, or a refusal that arrives as INTERNAL_ERROR,
// leaves an approval on the floor. These tests pin the honest carry: the
// reason slot tells the truth, the closed field set stays closed, the
// derived caller (not a claim) reaches the lane as approvalCaller, and a
// committed retry still projects `changed:true`.
// ---------------------------------------------------------------------------
describe('the s6 remote seam carries every proposal arm through the closed v7 projection', () => {
  interface SeamWorld {
    readonly dispatch: (envelope: Record<string, unknown>) => Promise<{
      ok: boolean
      value?: { data?: Record<string, unknown> }
      error?: { code?: string; message?: string }
    }>
    readonly laneCalls: Record<string, unknown>[]
    setArm: (arm: Record<string, unknown>) => void
    close: () => void
  }
  async function openSeamWorld(): Promise<SeamWorld> {
    const base = scratchDir(`a4p5seam-${Math.random().toString(36).slice(2, 8)}`)
    destroyDir(base)
    const seam = new FileStorageSeam(base)
    const domain = await createTeamDomain(seam)
    const laneCalls: Record<string, unknown>[] = []
    let arm: Record<string, unknown> = {}
    // The lane behind the seam is the SAME slot the root injects
    // (`permissionLaneMutate`); the mock captures what the seam FORWARDED
    // and answers with the arm the governance service would have returned.
    const permission = {
      canonicalizeExecIntent: async () => `sha256:${'a'.repeat(64)}`,
      mutatePermission: async (args: Record<string, unknown>) => {
        laneCalls.push(args)
        return { ...arm }
      },
    }
    const ports = createS6RemotePorts({
      rootSessionId: P6T4_ROOT,
      repositories: domain.repositories,
      isOwnedRoot: (sid: string) => sid === P6T4_ROOT,
      governance: {
        mutatePermission: async () => {
          throw new Error('unused: the permission lane answers this method')
        },
      },
      permission,
    } as never)
    const asHuman = () => Promise.resolve({ kind: 'human', humanId: 'operator-a4p5seam' } as never)
    const dispatch = createS6RemoteDispatcher(ports as never, asHuman as never)
    return {
      dispatch: (envelope) => dispatch('override.mutatePermission', envelope as never) as never,
      laneCalls,
      setArm: (next) => {
        arm = next
      },
      close: () => {
        destroyDir(base)
      },
    }
  }
  // An EXEC-matcher rule keeps the world minimal: its fingerprint
  // canonicalizes through the injected exec seam (no durable workspace row
  // is read on that path), so the group tests the PROJECTION, nothing else.
  const seamParams = (mutationId: string): Record<string, unknown> => ({
    version: REMOTE_CONTRACT_VERSION_V7,
    params: {
      teamSessionId: P6T4_ROOT,
      memberInstanceId: P6T4_SEEDS.worker.instanceId,
      kind: 'grant_instance',
      mutationId,
      reason: 'a4p5 seam leg',
      actor: { kind: 'human' },
      rules: [
        {
          operationClass: 'exec',
          matcher: { kind: 'exec', intent: { tool: 'bash', command: 'echo a4p5' } },
          effect: 'allow',
        },
      ],
    },
  })

  it('a pending proposal crosses HONESTLY: changed:false + the named reason, closed field set, nothing dropped', async () => {
    const w = await openSeamWorld()
    try {
      w.setArm({
        changed: false,
        reason: approvalLane.PERMISSION_MUTATION_PENDING_REASON,
        approvalCaseId: 'ap-case-1',
        requestId: 'req-1',
        requiredAuthority: 'leader',
        proposalFingerprint: `mutfp-${'0'.repeat(64)}`,
      })
      const response = await w.dispatch(seamParams('a4p5-seam-pending'))
      expect(response.ok, JSON.stringify(response.error ?? {})).toBe(true)
      const data = response.value?.data ?? {}
      expect(data['changed']).toBe(false)
      expect(data['reason']).toBe(approvalLane.PERMISSION_MUTATION_PENDING_REASON)
      // The v7 closed projection stays CLOSED: the case handle does not
      // smuggle through (its recovery is the approval lane).
      expect(Object.keys(data).sort()).toEqual(['changed', 'reason'])
      expect(w.laneCalls).toHaveLength(1)
    } finally {
      w.close()
    }
  })

  it('terminal arms ride the same reason slot (denied passes through with changed:false)', async () => {
    const w = await openSeamWorld()
    try {
      w.setArm({ changed: false, reason: approvalLane.PERMISSION_MUTATION_TERMINAL_OUTCOMES.DENIED })
      const response = await w.dispatch(seamParams('a4p5-seam-denied'))
      expect(response.ok, JSON.stringify(response.error ?? {})).toBe(true)
      const data = response.value?.data ?? {}
      expect(data['changed']).toBe(false)
      expect(data['reason']).toBe(approvalLane.PERMISSION_MUTATION_TERMINAL_OUTCOMES.DENIED)
    } finally {
      w.close()
    }
  })

  it('the DERIVED caller — never a wire claim — reaches the lane as approvalCaller', async () => {
    const w = await openSeamWorld()
    try {
      w.setArm({ changed: true })
      const response = await w.dispatch(seamParams('a4p5-seam-caller'))
      expect(response.ok, JSON.stringify(response.error ?? {})).toBe(true)
      expect(response.value?.data?.['changed']).toBe(true)
      expect(w.laneCalls[0]?.['approvalCaller']).toEqual({ kind: 'human', humanId: 'operator-a4p5seam' })
    } finally {
      w.close()
    }
  })
})

// ---------------------------------------------------------------------------
// THE TWO APPROVAL DOORS NEVER SHARE A CASE (parent design-risk pin, rebase
// round). PR4 now routes OPERATION asks through the same ceiling walk this
// lane's plan reuses, so the question is which door wins for one underlying
// action. The adjudication, measured here: the door is chosen by the ENTRY,
// never by the effect — an operation preflight can only open an
// operation-identity case (PR4's adapter), a ceiling-insufficient grant
// mutation can only open a mutation-proposal-identity case, and the control
// law itself (`fingerprint-cardinality`, control/service.ts:3309-3315:
// EXACTLY ONE of operation/mutation fingerprints) makes a hybrid identity
// unformable: neither lane can forge, join, or double-open the other's case,
// so one attempt never lands behind two open cases. A reviewer approving an
// operation ask grants ONE execution; approving a mutation proposal grants a
// durable rule — different objects, each consumed on its own terms.
// ---------------------------------------------------------------------------
describe('the two approval doors never share a case (mutation lane vs operation lane)', () => {
  it('a blocked mutation opens exactly ONE case, at the mutation door, carrying the mutation fingerprint only', async () => {
    const w = await openWorld2('doors-mutation-only')
    try {
      const pending = await w.mutate({ rules: GRANT_A })
      expect(pending['reason']).toBe(approvalLane.PERMISSION_MUTATION_PENDING_REASON)
      const open = await w.control.listOpenApprovalCases({ rootSessionId: P6T4_ROOT })
      expect(open).toHaveLength(1)
      expect(open[0]?.carrierKind).toBe(CONTROL_REQUEST_KINDS.ENVELOPE_MUTATION)
      // The ask's identity shape, stated: mutation fingerprint present,
      // operation fingerprint ABSENT — the fingerprint the operation door
      // names has no slot in this identity, by type and by the law below.
      const identity = approvalLane.buildPermissionMutationApprovalIdentity({
        targetMemberInstanceId: WORKER_ID,
        beneficiaryAuthority: 'member',
        requestedEffect: 'allow',
        mutationProposalFingerprint: `mutfp-${'1'.repeat(64)}`,
        correlation: approvalLane.permissionMutationCorrelation({ baseGeneration: 1, baseSnapshotId: 'snap-1' }),
      })
      expect(identity.mutationProposalFingerprint).toBeDefined()
      expect((identity as { operationFingerprint?: string }).operationFingerprint).toBeUndefined()
    } finally {
      await w.close()
    }
  })

  it('the control law refuses a hybrid identity AND a fingerprint-less one — the doors cannot forge each other', async () => {
    const w = await openWorld2('doors-hybrid-forbidden')
    try {
      const base = {
        rootSessionId: P6T4_ROOT,
        caller: humanCaller(),
        kind: CONTROL_REQUEST_KINDS.ENVELOPE_MUTATION,
        reviewAuthority: 'leader' as const,
        requiredAuthorityAtCreation: 'leader' as const,
        actionName: 'override.mutatePermission',
      }
      const cardinality = new RegExp(APPROVAL_CASE_IDENTITY_PROBLEMS.FINGERPRINT_CARDINALITY)
      await expect(
        w.control.requestApprovalLeg({
          ...base,
          identity: {
            subject: { kind: 'instance', instanceId: WORKER_ID },
            beneficiaryAuthority: 'member',
            requestedEffect: 'allow',
            mutationProposalFingerprint: `mutfp-${'1'.repeat(64)}`,
            operationFingerprint: 'sha256:an-operation',
            correlation: 'doors-hybrid',
          },
        }),
      ).rejects.toThrow(cardinality)
      await expect(
        w.control.requestApprovalLeg({
          ...base,
          identity: {
            subject: { kind: 'instance', instanceId: WORKER_ID },
            beneficiaryAuthority: 'member',
            requestedEffect: 'allow',
            correlation: 'doors-none',
          },
        }),
      ).rejects.toThrow(cardinality)
      // Zero cases opened by the refused attempts.
      expect(await w.control.listOpenApprovalCases({ rootSessionId: P6T4_ROOT })).toHaveLength(0)
    } finally {
      await w.close()
    }
  })
})

// ---------------------------------------------------------------------------
// Review item 6/7a (A3-3's class): the fault-vs-verdict line and the VERIFIED
// durable identity. Both inject through the world's boundary slots; both
// mutation-prove: bypass the guard-decider early-throw and the fault test
// reddens (stale swallows an outage); delete the field-wise durable-identity
// comparison and the lying-reader test reddens (commit proceeds on a case
// whose durable identity is not the ask).
// ---------------------------------------------------------------------------
describe('a fault never wears a verdict, and the durable identity is VERIFIED at the commit boundary (A3-3, review items 6/7a)', () => {
  it('a NON-LIFECYCLE fault thrown on the guard stack propagates as itself — never `mutation-stale`', async () => {
    const w = await openWorld2('guard-fault-propagates')
    try {
      const { requestId } = await propose(w, GRANT_A)
      await decide(w, requestId, 'allow')
      const outage = new Error('fixture storage outage')
      ;(outage as Error & { code?: string }).code = 'STORAGE_OUTAGE'
      w.guardFault.value = outage
      let caught: unknown
      try {
        const result = await w.mutate({ rules: GRANT_A })
        caught = result // NOT a throw — that is the failure mode
      } catch (error) {
        caught = error
      }
      w.guardFault.value = undefined
      expect(caught).toBe(outage) // the fault, itself, untouched — no stale verdict
      expect(await w.overlay.port.latest({ teamSessionId: P6T4_ROOT, memberInstanceId: WORKER_ID })).toBeUndefined()
    } finally {
      await w.close()
    }
  })

  it('a lifecycle refusal STILL reinterprets to mutation-stale (the narrowing kept the law it was for)', async () => {
    const w = await openWorld2('guard-refusal-still-stale')
    try {
      const { requestId } = await propose(w, GRANT_A)
      await decide(w, requestId, 'allow')
      w.lifecycle.state = 'archived'
      const stale = await w.mutate({ rules: GRANT_A })
      expect(stale['reason']).toBe(approvalLane.PERMISSION_MUTATION_TERMINAL_OUTCOMES.MUTATION_STALE)
    } finally {
      await w.close()
    }
  })

  it('an approval reader LYING about the durable identity is refused: stale, ZERO write, never a commit', async () => {
    const w = await openWorld2('lying-reader')
    try {
      const { requestId } = await propose(w, GRANT_A)
      await decide(w, requestId, 'allow')
      // Same case id, different DURABLE identity fields: the reviewer decided
      // something else than what this call asks. The port is injected — its
      // answer is verified field by field, not trusted (a fingerprint-token
      // match alone would let equality rest on one 24-char-shaped token).
      w.identityTamper.value = { mutationProposalFingerprint: `mutfp-${'a'.repeat(64)}` }
      const result = await w.mutate({ rules: GRANT_A })
      w.identityTamper.value = undefined
      expect(result['changed']).toBe(false)
      expect(result['reason']).toBe(approvalLane.PERMISSION_MUTATION_TERMINAL_OUTCOMES.MUTATION_STALE)
      expect((result['detail'] as Record<string, unknown>)['problem']).toBe('durable-identity-not-the-current-ask')
      expect(await w.overlay.port.latest({ teamSessionId: P6T4_ROOT, memberInstanceId: WORKER_ID })).toBeUndefined()
    } finally {
      await w.close()
    }
  })
})
