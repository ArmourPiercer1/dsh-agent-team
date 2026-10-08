/**
 * a4p7-descendant-change-proposal-valid.test.ts — A4-PR7 §7.6 row 6, the
 * half `dev/agent-workflow/evidence/a4-pr7/7-6-closure/SCENARIOS.md` proved
 * has no leg: root identity drift -> `mutation-stale` is pinned by
 * `a4p5-permission-mutation-inline-commit > drift after approval ->
 * mutation-stale with ZERO writes > matcher ROOT drift ...`; the COMPLEMENT
 * ("same root + changed descendants -> the proposal remains valid") had none,
 * so the frozen proposal's binding boundary was only half-asserted.
 *
 * THE LAW, quoted from the documents this leg is derived from (never from
 * observed behaviour):
 *
 * - spec §6.2 (alpha4-permission-governance-spec.md, the frozen-binding list):
 *   a frozen proposal binds "matcher kind, canonical root identity ...
 *   operation class, target MemberInstance, requested effect" and
 *   "A subtree proposal does not bind to the then-current descendants."
 * - spec §6.3 (the drift table): "If descendants change while root identity
 *   stays stable: proposal remains valid" / "containment is recomputed live".
 * - spec §21.3 (the §21.3 row this row closes): "same root + changed
 *   descendants -> proposal remains valid".
 * - ADR-alpha4-hard-governance.md §8: "A subtree matcher freezes its canonical
 *   root identity, not the current set of descendants" — its worked example
 *   creates `A/sub-A-2` AFTER the grant and concludes that with the root's
 *   canonical identity intact the new descendant "may become covered by A/**".
 *
 * The boundary this file pins is therefore NOT "everything survives": the two
 * legs below differ in EXACTLY ONE variable — whether the changed descendant
 * set moves an approved rise — and the two verdicts differ with it. A
 * descendant the seam newly reaches whose own lower-layer answer already
 * equals what the grant gives it moves no rise, so the approved mutation
 * commits; the same descendant arriving with a lower-layer `deny` under it
 * adds a rising region the approval never covered, and the same world answers
 * `mutation-stale` with ZERO writes. The frozen identity binds the matcher
 * root/kind and the approved rise; the descendant set is not an input.
 *
 * WHAT IS REAL AND WHAT IS FIXED HERE: the durable PermissionOverlay world
 * (a FileStorageSeam scratch medium under a real store handle), the REAL
 * ControlService over the durable TeamDomain world (the approval is a durable
 * case with a durable leg), the real proposal store, and the production
 * mutation kernel + commit boundary. Only the INJECTED lane facts are
 * harness-owned — the static layer and the containment predicate — because
 * they are exactly the inputs the law says the drift check reads. The
 * descendant set is changed through the injected containment predicate, which
 * is the ONLY channel through which this lane can ever observe a descendant:
 * the kernel partitions matcher-regions with a binary predicate and has no
 * resource-enumeration seam at all (`cellsForRegion`,
 * `packages/runtime/governance/permission-mutation.ts`).
 *
 * @module @dsh-agent-team/runtime/test/a4p7-descendant-change-proposal-valid
 */

import { describe, expect, it } from 'vitest'
import * as approvalLane from '../governance/permission-approval.js'
import {
  createGovernanceMutationService,
  permissionEffectiveAnswer,
  type GovernanceMutationService,
  type GovernancePermissionMutationArgs,
  type PermissionResourceMatcher,
  type PermissionStaticLayerFacts,
} from '../governance/index.js'
import type { PermissionAuthorityCeilingContext } from '../governance/types.js'
import { createGovernanceProposalStore, type ProposalReadRecord } from '../governance/proposal-store.js'
import { createTeamOperationCoordinator } from '../coordination/index.js'
import type { OverrideRecordView, OverrideStorePort, PolicyReader } from '../mutation/index.js'
import type { PolicyStateTransitionRecord } from '../mutation/types.js'
import type { GovernanceTransitionCache, GovernanceTransitionCommit } from '../governance/types.js'
import type { PermissionOverlayRule } from '../permission-governance/types.js'
import type { AuthorityDocumentSlot, AuthorityEnvelopeDocuments } from '../governance/authority-ceiling.js'
import type { AuthorityEnvelope } from '../../domain/authority-envelope/src/index.js'
import {
  createP6T4Service,
  createP6T4World,
  destroyP6T1World,
  leaderCaller,
  P6T4_ROOT,
  P6T4_SEEDS,
} from './p6t4-helpers.js'
import { openWorld, type World } from './permission-overlay-helpers.js'

const WORKER_ID = String(P6T4_SEEDS.worker.instanceId)
const NOW = '2026-10-07T09:00:00.000Z'

/** The subtree the mutation grants and the frozen matcher root names. */
const ROOT = 'output'
/** A descendant that exists the whole time (the predicate reaches it at once). */
const FILE_A = 'output/a.json'
/** THE descendant of this file: it comes to exist UNDER the root while the
 *  approval is pending — ADR §8's `A/sub-A-2`. */
const LATE = 'output/late.json'
/** A resource under no granted root (the live-recompute contrast probe). */
const OUTSIDE = 'archive/outside.json'

const exact = (resource: string): PermissionResourceMatcher => ({ kind: 'exact', resource })
const subtree = (resource: string): PermissionResourceMatcher => ({ kind: 'subtree', resource })

/** THE mutation under test: one subtree grant over the stable root. Both legs
 *  of the pair drive it, before and after the descendant set changes. */
const GRANT_ROOT: Rules = [
  { operationClass: 'write', matcher: subtree(ROOT), effect: 'allow' },
]

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
/** The static/template plane is read by the lane only through this port, and
 *  this fixture's static facts are injected — reading this port would be a
 *  SECOND source of lower-layer truth, so it is loud. */
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

/** The Leader's CARRIER: the granted subtree is inside its reach, so the only
 *  question the mutation raises is WHO may approve the rise, not whether the
 *  envelope permits the width. */
const CARRIER_ALLOW = envelope(
  { matcher: exact(FILE_A), effect: 'allow' },
  { matcher: subtree(ROOT), effect: 'allow' },
)

type Rules = readonly {
  operationClass: string
  matcher: PermissionResourceMatcher
  effect: 'allow' | 'ask' | 'deny'
}[]

interface DescendantWorld {
  readonly governance: GovernanceMutationService
  readonly control: ReturnType<typeof createP6T4Service>
  readonly proposals: ReturnType<typeof createGovernanceProposalStore>
  readonly overlay: World
  /** The harness-owned resource population: which existing resources the
   *  canonical subtree root reaches. Creating a descendant = adding to it. */
  readonly descendants: Map<string, Set<string>>
  /** The SAME answer the injected predicate gives the kernel, for the test's
   *  own before/after proof of what changed. */
  readonly contains: (root: string, child: string) => boolean
  /** The injected lower-layer facts (the lane's only static plane). */
  readonly staticFacts: { facts: PermissionStaticLayerFacts }
  close: () => Promise<void>
  mutate: (rules: Rules) => Promise<Record<string, unknown>>
}

/**
 * The real lane: governance mutation service -> real approval CaseService over
 * the durable TeamDomain world -> real durable PermissionOverlay store, with
 * the kernel's injected context (carrier, ceiling, static facts, containment)
 * held by the harness because those are the facts the drift law reads.
 *
 * @param name - scratch-dir basename for this `it`'s worlds.
 * @param lateEffect - the lower-layer effect at {@link LATE} BEFORE the
 *   descendant exists (both legs declare it up front, so the frozen approval
 *   saw the rule and the ONLY later change is the descendant itself).
 */
async function openDescendantWorld(
  name: string,
  lateEffect: 'allow' | 'ask' | 'deny',
): Promise<DescendantWorld> {
  const p6 = await createP6T4World(`a4p7r6-${name}`)
  const overlay = await openWorld(`a4p7r6-${name}`)
  const proposals = createGovernanceProposalStore({
    ledger: p6.domain.repositories.ledger as never,
    now: () => NOW,
  })
  const control = createP6T4Service(p6)
  const controlRef: { current: ReturnType<typeof createP6T4Service> | undefined } = { current: control }
  const port = approvalLane.lateBoundPermissionMutationApprovalPort(
    controlRef as unknown as { current: approvalLane.PermissionMutationApprovalPort | undefined },
  )
  const staticFacts: { facts: PermissionStaticLayerFacts } = {
    facts: {
      layers: [
        {
          source: 'template',
          default: 'deny',
          // Declared from the FIRST call: the rule at LATE is part of the state
          // the approval covered. What the legs change later is whether that
          // path EXISTS under the root, never the rule.
          rules: [{ operationClass: 'write', matcher: exact(LATE), effect: lateEffect }],
        },
      ],
    } as unknown as PermissionStaticLayerFacts,
  }
  const descendants = new Map<string, Set<string>>([[ROOT, new Set([FILE_A])]])
  const contains = (root: string, child: string): boolean =>
    root === child || descendants.get(root)?.has(child) === true
  let counter = 0
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
      // A subtree root contains ITS OWN identity (the containment contract the
      // production seam honours — a matcher never excludes its own root).
      subtreeContains: (root: string, child: string) => contains(root, child),
      authorityCeiling: async (
        _team: string,
        _member: string,
        actor: 'leader' | 'human',
      ): Promise<PermissionAuthorityCeilingContext> => ({
        beneficiaryAuthority: 'member',
        initiatorAuthority: actor === 'leader' ? 'leader' : 'human-user',
        documents: {
          teamHardEnvelope: { status: 'absent' } satisfies AuthorityDocumentSlot,
          permissionMutationEnvelope: { status: 'declared', document: CARRIER_ALLOW },
        } satisfies AuthorityEnvelopeDocuments,
      }),
      targetGuard: async () => {},
      isLifecycleRefusal: (error: unknown) =>
        (error as { code?: string } | null)?.code === 'INSTANCE_LIFECYCLE_REFUSED',
    },
    approval: port,
    proposals,
  })
  return {
    governance,
    control,
    proposals,
    overlay,
    descendants,
    contains,
    staticFacts,
    close: async () => {
      await overlay.store.close()
      overlay.destroy()
      await destroyP6T1World(p6)
    },
    mutate: async (rules) =>
      (await governance.mutatePermission({
        authority: { kind: 'leader' },
        teamSessionId: P6T4_ROOT,
        memberInstanceId: WORKER_ID,
        kind: 'grant_instance',
        mutationId: `mut-${String(++counter)}`,
        reason: 'fixture',
        rules: rules as GovernancePermissionMutationArgs['rules'],
      })) as unknown as Record<string, unknown>,
  }
}

/** The frozen fingerprints of the durable proposal rows, sound rows only (a
 *  corrupt row is reported, never skipped silently — see the store's read
 *  outcome, so a leg that counts rows and a leg that reads fingerprints both
 *  see it). */
function frozenFingerprints(w: DescendantWorld): { sequences: number[]; fingerprints: string[] } {
  const rows = w.proposals.listProposals({ teamSessionId: P6T4_ROOT })
  const records = rows.filter((row): row is ProposalReadRecord => row.kind === 'record')
  expect(rows).toHaveLength(records.length) // no corrupt row slipped through
  return {
    sequences: records.map((row) => row.sequence),
    fingerprints: records.map((row) => row.proposal.caseFingerprint),
  }
}

/** Propose and have the Leader allow it. Returns the frozen identity read back
 *  from the durable case, plus the durable proposal fingerprint. */
async function proposeAndAllow(w: DescendantWorld, rules: Rules) {
  const pending = await w.mutate(rules)
  expect(pending['reason']).toBe(approvalLane.PERMISSION_MUTATION_PENDING_REASON)
  const approvalCaseId = pending['approvalCaseId'] as string
  const read = await w.control.readApprovalCaseState({ rootSessionId: P6T4_ROOT, approvalCaseId })
  if (read.kind !== 'case' || read.state.currentLeg === undefined) throw new Error('fixture: no leg')
  const requestId = read.state.currentLeg.requestId
  await w.control.resolveControl({
    rootSessionId: P6T4_ROOT,
    caller: leaderCaller(),
    requestId,
    decision: 'allow',
  })
  const frozen = frozenFingerprints(w)
  return { approvalCaseId, requestId, frozen }
}

describe('a4p7 §7.6 row 6 — same canonical subtree root, descendants changed (spec §6.3 / §21.3, ADR §8)', () => {
  it('a descendant the seam newly reaches that moves NO approved rise leaves the allowed proposal VALID: same case, byte-identical frozen fingerprint, one commit', async () => {
    // Derivation: spec §6.2 "A subtree proposal does not bind to the
    // then-current descendants"; spec §6.3 "If descendants change while root
    // identity stays stable: proposal remains valid"; spec §21.3 "same root +
    // changed descendants -> proposal remains valid"; ADR §8 "A subtree matcher
    // freezes its canonical root identity, not the current set of descendants".
    const w = await openDescendantWorld('valid', 'allow')
    try {
      // The population BEFORE: LATE does not exist under the root.
      expect(w.contains(ROOT, LATE)).toBe(false)
      const { frozen } = await proposeAndAllow(w, GRANT_ROOT)
      expect(frozen.sequences).toHaveLength(1)
      const frozenBefore = frozen.fingerprints[0]!
      expect(frozenBefore).toMatch(/^mutfp-[0-9a-f]{64}$/)

      // THE ONLY CHANGE: the runtime creates the descendant under the SAME
      // canonical root (ADR §8's `A/sub-A-2`). The matcher root is untouched:
      // same resource, same kind, same case, no re-grant, no re-ask.
      w.descendants.get(ROOT)!.add(LATE)
      expect(w.contains(ROOT, LATE)).toBe(true) // the descendant really appeared
      expect(w.contains(ROOT, FILE_A)).toBe(true) // and the root did NOT move

      // The same mutation, re-driven: retry-discovery finds the ANSWERED case
      // and the commit boundary revalidates. The frozen identity must not have
      // moved either — the descendant set is not an input to it.
      const result = await w.mutate(GRANT_ROOT)
      expect(result['changed']).toBe(true)
      const snapshot = result['snapshot'] as {
        state: { rules: PermissionOverlayRule[] }
        metadata: { generation: number }
      }
      expect(snapshot.metadata.generation).toBe(1)
      expect(snapshot.state.rules).toHaveLength(1)

      // Zero second ask: one durable proposal row, still the SAME frozen
      // fingerprint, byte for byte, after the population changed.
      const frozenAfter = frozenFingerprints(w)
      expect(frozenAfter.fingerprints).toEqual([frozenBefore])
      expect(frozenAfter.sequences).toEqual(frozen.sequences)
      const latest = await w.overlay.port.latest({ teamSessionId: P6T4_ROOT, memberInstanceId: WORKER_ID })
      expect(latest?.metadata.generation).toBe(1)

      // ...and containment IS recomputed live (spec §6.3): with the just
      // committed rules, the descendant that did not exist when the human
      // approved is answered by the committed subtree grant, at ask time,
      // while a resource the root does not reach still falls to the layer.
      const answered = permissionEffectiveAnswer({
        overlayRules: snapshot.state.rules,
        staticFacts: w.staticFacts.facts,
        operationClass: 'write',
        region: exact(LATE),
        subtreeContains: (root, child) => w.contains(root, child),
      })
      expect(answered).toEqual({ status: 'decided', effect: 'allow', source: 'overlay' })
      const untouched = permissionEffectiveAnswer({
        overlayRules: snapshot.state.rules,
        staticFacts: w.staticFacts.facts,
        operationClass: 'write',
        region: exact(OUTSIDE),
        subtreeContains: (root, child) => w.contains(root, child),
      })
      expect(untouched).toEqual({ status: 'decided', effect: 'deny', source: 'fallback' })
    } finally {
      await w.close()
    }
  })

  it('the boundary: the SAME descendant arriving where it moves an approved rise answers mutation-stale with ZERO writes (one variable separates the halves)', async () => {
    // Derivation: spec §6.3 (root stable, descendants changed -> valid) is the
    // NON-invalidation half; the invalidation half stays "the approval covered
    // the mutation as it was, never as it has become" (ADR A1-8). The two legs
    // differ ONLY in the lower-layer effect at the descendant that appears, so
    // what reddens this one is the moved rise, not a moved root and not the
    // fact that descendants changed.
    const w = await openDescendantWorld('stale', 'deny')
    try {
      expect(w.contains(ROOT, LATE)).toBe(false)
      const { approvalCaseId, frozen } = await proposeAndAllow(w, GRANT_ROOT)
      const frozenBefore = frozen.fingerprints[0]!

      w.descendants.get(ROOT)!.add(LATE)
      expect(w.contains(ROOT, LATE)).toBe(true)

      const stale = await w.mutate(GRANT_ROOT)
      expect(stale['reason']).toBe(
        approvalLane.PERMISSION_MUTATION_TERMINAL_OUTCOMES.MUTATION_STALE,
      )
      expect(await w.overlay.port.latest({ teamSessionId: P6T4_ROOT, memberInstanceId: WORKER_ID })).toBeUndefined()

      // The frozen identity did NOT move here either — the descendant set is
      // not an input on this half either. What the approval cannot do is commit
      // a rise it never covered, so the answered case stays answered and
      // nothing is written into it.
      const frozenAfter = frozenFingerprints(w)
      expect(frozenAfter.fingerprints).toEqual([frozenBefore])
      expect(frozenAfter.sequences).toEqual(frozen.sequences)
      const answered = await w.control.readApprovalCaseState({ rootSessionId: P6T4_ROOT, approvalCaseId })
      expect(answered.kind === 'case' ? answered.state.status : answered.kind).toBe('decided')
    } finally {
      await w.close()
    }
  })
})
