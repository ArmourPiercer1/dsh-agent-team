/**
 * a4p7-approved-retry-ceiling-at-commit.test.ts — the CEILING is re-asked at the
 * commit boundary of an approved retry, at EVERY point the rise claims.
 * (A4-PR7 §7.3 review, BLOCKING-1.)
 *
 * ---------------------------------------------------------------------------
 * THE CLAIM, AND WHAT THE MEASUREMENT SAID
 * ---------------------------------------------------------------------------
 * A4-PR5's inline commit is a RETRY: the direct gate refuses a decided-insufficient
 * rise, that refusal becomes a durable ask, and the next call of the same mutation
 * revalidates everything from fresh reads before ONE append. Its law is that the
 * approval buys the RUNG, and the ceiling keeps the width.
 *
 * The review's blocking finding was that the retry revalidates the APPROVAL but
 * never re-asks the CEILING, so a durable allow could commit a width the ceiling
 * stopped reaching. Both halves of that were tested here, and they came out
 * differently:
 *
 *  - THE WORLD MOVING UNDER AN APPROVAL IS REAL, and the arm that catches it is the
 *    RUNG comparison in `resolveDiscoveredApprovalCase`, priced from fresh reads.
 *    It was unpinned: nothing in the suite had ever tightened or unreadabled the
 *    documents between `resolveControl(allow)` and the retry. The legs below move
 *    the world and pin what comes back — with the terminal semantics the review
 *    asked to be decided rather than inherited.
 *  - THE WIDTH-VERSUS-CELL PRICING IS NOT A HOLE ON THIS PLANE, and the second
 *    describe block pins why. The rung is now priced over the same
 *    `permissionRiseClaimedPoints` set the ceiling gate judges, and measured across
 *    six document shapes that is the SAME rung the cell alone asked: the approval
 *    plane reads a non-matching rule as no narrowing, so a cap on a width is a cap
 *    on the cell inside it, and the batch asks the maximum. The shared helper is
 *    therefore a drift guard, not a second fix, and this file says so instead of
 *    letting the change look like one.
 *
 * ---------------------------------------------------------------------------
 * WHAT "RE-ASK THE CEILING" MEANS HERE, AND WHAT IT CANNOT MEAN (measured)
 * ---------------------------------------------------------------------------
 * The literal reading — run `authorizeCeilingBoundedPermissionRise` over the fresh
 * rise before the append — was implemented first, and A4-PR5's own suite refuted
 * it: the ask exists BECAUSE that gate refused (A1-8 routes a decided-insufficient
 * rise to a durable proposal precisely because `no-authority` on the expansion
 * plane means "not impossible: a PROPOSAL"), so asking the unapproved gate again
 * after the approval refuses again and NO approved commit can ever land. Three
 * pinned legs of `a4p5-permission-mutation-inline-commit.test.ts` went red,
 * starting with "commits EXACTLY ONE snapshot with the planned rules" (transcript
 * `37-b1-literal-reask-breaks-pr5-inline-commit.txt`).
 *
 * The ceiling law an approval lane may use is the RUNG law: which authority, at
 * what rung, reaches this rise at these points, TODAY. Priced over the claimed
 * points, `fresh.required` is that re-ask, and the already-pinned
 * `ceiling-narrowed-past-approved-rung` / `approved-rise-no-longer-provable` arms
 * are its refusal identities — no new vocabulary, no second gate.
 *
 * ---------------------------------------------------------------------------
 * THE TERMINAL SEMANTICS OF A COMMIT-TIME REFUSAL (decided, not inherited)
 * ---------------------------------------------------------------------------
 *  - The durable case KEEPS its terminal `resolved(allow)`. A reviewer's decision
 *    is durable state this lane does not rewrite, and burning it here would turn
 *    the refusal into a silently-consumed approval — an approval spent on a commit
 *    that never happened, which is the laundering shape this lane exists to close.
 *  - Nothing appends, so nothing can append twice: the refusals below leave the
 *    overlay chain at generation zero, and the retry that finally matches the
 *    ceiling commits EXACTLY ONE snapshot.
 *  - Nothing re-mints: the commit-time arms are returns inside the retry, not
 *    throws escaping the minting catch, and the proposal rows stay where they were.
 *  - The caller receives `mutation-stale` naming the problem, never `changed: true`
 *    and never a pending reason; a retry against an unchanged world says the same
 *    thing again. An approval that is consumable-but-silently-no-op is a fresh
 *    laundering surface, and this is exactly the lane that must not leave one.
 *
 * The worlds are real: durable overlay chain + REAL ControlService over the durable
 * TeamDomain world. Only the injected lane facts are harness-owned, because they are
 * exactly what these legs move between the approval and the retry.
 *
 * @module @dsh-agent-team/runtime/test/a4p7-approved-retry-ceiling-at-commit
 */

import { describe, expect, it } from 'vitest'
import * as approvalLane from '../governance/permission-approval.js'
import { createGovernanceMutationService } from '../governance/index.js'
import type {
  GovernanceMutationService,
  GovernancePermissionMutationArgs,
  PermissionResourceMatcher,
  PermissionStaticLayerFacts,
} from '../governance/index.js'
import { createGovernanceProposalStore } from '../governance/proposal-store.js'
import { planPermissionMutationApproval } from '../governance/permission-approval.js'
import { createTeamOperationCoordinator } from '../coordination/index.js'
import type { OverrideRecordView, OverrideStorePort, PolicyReader } from '../mutation/index.js'
import type { PolicyStateTransitionRecord } from '../mutation/types.js'
import type {
  GovernanceTransitionCache,
  GovernanceTransitionCommit,
  PermissionAuthorityCeilingContext,
} from '../governance/types.js'
import type { AuthorityDocumentSlot, AuthorityEnvelopeDocuments } from '../governance/authority-ceiling.js'
import type { AuthorityEnvelope } from '../../domain/authority-envelope/src/index.js'
import type { ActionCaller } from '../admission/types.js'
import {
  createP6T4Service,
  createP6T4World,
  destroyP6T1World,
  humanCaller,
  leaderCaller,
  P6T4_ROOT,
  P6T4_SEEDS,
} from './p6t4-helpers.js'
import { openWorld } from './permission-overlay-helpers.js'

const WORKER_ID = String(P6T4_SEEDS.worker.instanceId)
const NOW = '2026-10-09T09:00:00.000Z'
const FILE_A = 'output/a.json'
const SUB = 'output'

const exact = (resource: string): PermissionResourceMatcher => ({ kind: 'exact', resource })
const subtree = (resource: string): PermissionResourceMatcher => ({ kind: 'subtree', resource })

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

/** The Leader's carrier, and the ceiling's permission-mutation document. It covers
 *  the WHOLE claimed matcher on purpose: Alpha.3's coverage law must NOT be the
 *  thing that refuses here, so every refusal below is attributable to the ceiling. */
const CARRIER = envelope(
  { matcher: exact(FILE_A), effect: 'allow' },
  { matcher: subtree(SUB), effect: 'allow' },
)

/** The lower facts that confine the rise to ONE cell while the mutation claims the
 *  subtree: inside a layer the most restrictive matching rule answers, so the
 *  template denies FILE_A and allows the rest of SUB. The classifier therefore
 *  yields a single rising region whose `region` is `exact output/a.json` and whose
 *  `mutationMatcher` is `subtree output`. */
const TEMPLATE_DENY_AT_A: PermissionStaticLayerFacts = {
  layers: [
    {
      label: 'template',
      default: 'deny',
      rules: [
        { operationClass: 'write', matcher: exact(FILE_A), effect: 'deny' },
        { operationClass: 'write', matcher: subtree(SUB), effect: 'allow' },
      ],
    },
  ],
}

/** THE mutation: one rule, claiming the subtree, rising one cell. */
const GRANT_SUBTREE = [
  { operationClass: 'write', matcher: subtree(SUB), effect: 'allow' as const },
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

interface World {
  readonly governance: GovernanceMutationService
  readonly control: ReturnType<typeof createP6T4Service>
  readonly proposals: ReturnType<typeof createGovernanceProposalStore>
  readonly overlay: Awaited<ReturnType<typeof openWorld>>
  /** MUTABLE on purpose: the whole point of this file is that the documents move
   *  between the approval and the retry, and the commit must answer the world it
   *  is appending into, not the one the reviewer read. */
  readonly hard: { slot: AuthorityDocumentSlot }
  readonly close: () => Promise<void>
  mutate: (
    rules: readonly { operationClass: string; matcher: PermissionResourceMatcher; effect: 'allow' | 'ask' | 'deny' }[],
  ) => Promise<Record<string, unknown>>
  /** The durable rows the mint path appends: one per rule, plus nothing else. */
  proposalRows: () => Promise<unknown[]>
  latestGeneration: () => Promise<number | undefined>
  /** Open the durable ask the same way the retry does, then have a reviewer decide
   *  it. Returns the case id so the legs can read the case back afterwards. */
  mintAndAllow: (
    rules: typeof GRANT_SUBTREE,
    reviewer?: 'leader' | 'human',
  ) => Promise<{ approvalCaseId: string; pending: Record<string, unknown> }>
}

async function openApprovalWorld(name: string, initialHard: AuthorityDocumentSlot = { status: 'absent' }): Promise<World> {
  const p6 = await createP6T4World(`a4p7commit-${name}`)
  const overlay = await openWorld(`a4p7commit-${name}`)
  const proposals = createGovernanceProposalStore({ ledger: p6.domain.repositories.ledger as never, now: () => NOW })
  const control = createP6T4Service(p6)
  const controlRef: { current: ReturnType<typeof createP6T4Service> | undefined } = { current: control }
  const port = approvalLane.lateBoundPermissionMutationApprovalPort(
    controlRef as unknown as { current: approvalLane.PermissionMutationApprovalPort | undefined },
  )
  const hard = { slot: initialHard }
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
      permissionEnvelope: () => CARRIER,
      staticLayers: () => TEMPLATE_DENY_AT_A,
      subtreeContains: (root: string, child: string) => child === root || child.startsWith(`${root}/`),
      authorityCeiling: async (_t: string, _m: string, actor: 'leader' | 'human'): Promise<PermissionAuthorityCeilingContext> => ({
        beneficiaryAuthority: 'member',
        initiatorAuthority: actor === 'leader' ? 'leader' : 'human-user',
        documents: {
          teamHardEnvelope: hard.slot,
          permissionMutationEnvelope: { status: 'declared', document: CARRIER },
        } satisfies AuthorityEnvelopeDocuments,
      }),
    },
    approval: port,
    proposals,
  })
  const world: World = {
    governance,
    control,
    proposals,
    overlay,
    hard,
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
        rules,
      } as Partial<GovernancePermissionMutationArgs> as GovernancePermissionMutationArgs)) as unknown as Record<string, unknown>,
    proposalRows: async () =>
      (await proposals.listProposals({ teamSessionId: P6T4_ROOT })).filter((entry) => entry.kind === 'record'),
    latestGeneration: async () => {
      const latest = await overlay.port.latest({ teamSessionId: P6T4_ROOT, memberInstanceId: WORKER_ID })
      return latest?.metadata.generation
    },
    mintAndAllow: async (rules, reviewer = 'leader') => {
      const pending = await world.mutate(rules)
      expect(pending['reason']).toBe(approvalLane.PERMISSION_MUTATION_PENDING_REASON)
      const approvalCaseId = pending['approvalCaseId'] as string
      const read = await control.readApprovalCaseState({ rootSessionId: P6T4_ROOT, approvalCaseId })
      if (read.kind !== 'case' || read.state.currentLeg === undefined) throw new Error('fixture: no leg to decide')
      const caller: ActionCaller = reviewer === 'leader' ? leaderCaller() : humanCaller()
      await control.resolveControl({
        rootSessionId: P6T4_ROOT,
        caller,
        requestId: read.state.currentLeg.requestId,
        decision: 'allow',
      })
      return { approvalCaseId, pending }
    },
  }
  return world
}

/**
 * THE ALGEBRA THIS FILE DEPENDS ON, PINNED AT THE PLANNER SEAM.
 *
 * The review asked for the ceiling to be re-asked at the claimed width on the
 * approved retry, on the theory that a rung priced at the CELL can be spent on a
 * WIDTH it never reached. At the ceiling gate that theory is exactly right (the
 * expansion plane reads an unmatched scope as `no-authority`, so a rise confined
 * to one cell used to commit a subtree the documents say nothing about — P1). On
 * the APPROVAL plane it is the other way round, and these six shapes are the
 * measurement: the rung planner returns the SAME rung priced at the cell alone
 * and priced at the cell plus the width.
 *
 * The reason is structural, not lucky. An envelope rule that caps a width also
 * caps every cell inside it (containment is the matcher relation), the approval
 * plane reads a rule that does NOT match as no narrowing rather than as no
 * authority, and the batch asks the HIGHEST rung any matcher needs. So the cell
 * is always the stricter question, and a durable ask can never be priced below
 * what its committed width needs. That is why `permissionRiseClaimedPoints` is
 * shared here rather than merely duplicated: it keeps the two lanes on one point
 * algebra — measured behaviour-neutral on the approval plane today, and unable to
 * drift if a matcher kind ever makes the relation table non-monotone.
 */
describe('the approval rung is priced over the same point set the ceiling gate uses', () => {
  const CELL = exact(FILE_A)
  const WIDTH = subtree(SUB)
  const SHAPES: readonly [string, readonly { kind: string; resource: string; effect: 'allow' | 'ask' | 'deny' }[]][] = [
    ['silent hard document', []],
    ['a fingerprint rule (opaque, never widens)', [{ kind: 'fingerprint', resource: 'sha256:deadbeef', effect: 'ask' }]],
    ['the width capped at ask', [{ kind: 'subtree', resource: SUB, effect: 'ask' }]],
    ['the width denied outright', [{ kind: 'subtree', resource: SUB, effect: 'deny' }]],
    ['the cell capped below the width', [{ kind: 'exact', resource: FILE_A, effect: 'ask' }]],
    ['an unrelated subtree denied', [{ kind: 'subtree', resource: 'output/other', effect: 'deny' }]],
  ]

  const planAt = (
    hardRules: readonly { kind: string; resource: string; effect: 'allow' | 'ask' | 'deny' }[],
    matchers: readonly PermissionResourceMatcher[],
  ): unknown =>
    planPermissionMutationApproval({
      beneficiaryAuthority: 'member',
      documents: {
        teamHardEnvelope:
          hardRules.length === 0
            ? { status: 'absent' }
            : {
                status: 'declared',
                document: {
                  rules: hardRules.map((rule) => ({
                    operationClass: 'write',
                    matcher: { kind: rule.kind, resource: rule.resource },
                    maximumEffect: rule.effect,
                  })),
                } as unknown as AuthorityEnvelope,
              },
        permissionMutationEnvelope: { status: 'declared', document: CARRIER },
      } satisfies AuthorityEnvelopeDocuments,
      regions: matchers.map((matcher) => ({ operationClass: 'write', matcher, risenEffect: 'allow' as const })),
      subtreeContains: (root: string, child: string) => child === root || child.startsWith(`${root}/`),
    })

  for (const [label, hardRules] of SHAPES) {
    it(`prices ${label} at the SAME rung either way`, () => {
      const atCell = planAt(hardRules, [CELL])
      expect(planAt(hardRules, [CELL, WIDTH])).toEqual(atCell)
    })
  }

  it('and the shape the review needed is the one the algebra forbids', () => {
    // For the laundering to exist there must be a document set where the WIDTH
    // asks a higher rung than the cell. The widest cap a document can put on a
    // subtree is the cap it also puts on the cell inside it, so the cell's rung
    // is the maximum — here is the ceiling of the whole ladder, asked both ways.
    const denied = [{ kind: 'subtree', resource: SUB, effect: 'deny' as const }]
    expect(planAt(denied, [CELL])).toEqual(planAt(denied, [CELL, WIDTH]))
    expect((planAt(denied, [CELL, WIDTH]) as { requiredAuthority?: string }).requiredAuthority).toBe('human-admin')
  })
})

describe('the ceiling is re-asked at the commit boundary, at every claimed point', () => {
  it('a rise is ASKED AT THE RUNG ITS WIDTH NEEDS, not at the rung its cell can pay for', async () => {
    // The hard document authorizes the cell and caps the claimed subtree. Priced at
    // the cell — which is what the mint path did before this change — the rise is a
    // LEADER's question, and a Leader's allow then bought the whole subtree. Priced
    // at every claimed point, the same rise is a `human-admin` question, so the ask
    // that opens is the one the commit would actually need. MEASURED, both numbers,
    // in the fixture family below: the width rise asks `human-admin` and the
    // cell-only rise in the default world asks `leader`.
    const w = await openApprovalWorld('width-rung', {
      status: 'declared',
      document: envelope({ matcher: exact(FILE_A), effect: 'allow' }, { matcher: subtree(SUB), effect: 'deny' }),
    })
    try {
      const refused = await w.mutate(GRANT_SUBTREE)
      // `human-admin` has no resolver in this Team, so the ask is born terminal —
      // rendered truthfully as "the rise failed", never as a pending question a
      // Leader could answer (A1-8's rendering law).
      expect(refused['changed']).toBe(false)
      expect(refused['reason']).toBe('authority-unavailable')
      const detail = refused['detail'] as { problem?: string; requiredAuthority?: string }
      expect(detail.problem).toBe('no-resolver-for-required-rung')
      expect(detail.requiredAuthority).toBe('human-admin')
      // Nothing approvable was minted and nothing was written: the laundering needs
      // a durable ask at a spendable rung, and there is neither.
      expect(await w.proposalRows()).toHaveLength(0)
      expect(await w.latestGeneration()).toBeUndefined()
    } finally {
      await w.close()
    }
    // THE DELTA, PINNED: the same lane, the same harness, a rise that claims only
    // the cell — asked at `leader`, the rung a Leader may spend. Cell and width are
    // two different questions, and the approval lane now tells them apart.
    const cell = await openApprovalWorld('cell-rung')
    try {
      const pending = await cell.mutate([{ operationClass: 'write', matcher: exact(FILE_A), effect: 'allow' }])
      expect(pending['reason']).toBe(approvalLane.PERMISSION_MUTATION_PENDING_REASON)
      const read = await cell.control.readApprovalCaseState({
        rootSessionId: P6T4_ROOT,
        approvalCaseId: pending['approvalCaseId'] as string,
      })
      if (read.kind !== 'case') throw new Error('fixture: cell case unreadable')
      expect(read.state.currentLeg?.reviewAuthority).toBe('leader')
    } finally {
      await cell.close()
    }
  })

  it('documents tightened after the approval: ZERO append — never the refused width', async () => {
    const w = await openApprovalWorld('tightened')
    try {
      const { approvalCaseId } = await w.mintAndAllow(GRANT_SUBTREE)
      const rowsAtApproval = await w.proposalRows()
      // The world moves under the approval: the claimed subtree is now denied by
      // the hard document while the cell is still authorized. The reviewer signed
      // the cell; the append would have written the subtree.
      w.hard.slot = {
        status: 'declared',
        document: envelope({ matcher: exact(FILE_A), effect: 'allow' }, { matcher: subtree(SUB), effect: 'deny' }),
      }
      const refused = await w.mutate(GRANT_SUBTREE)
      // THE assertion the review asked for, flipped from the repro: after
      // `resolveControl(allow)` the snapshot is ABSENT. Not "the width committed
      // anyway", not "the cell committed instead" — nothing.
      expect(refused['changed']).toBe(false)
      expect(await w.latestGeneration()).toBeUndefined()
      expect(refused['reason']).toBe('mutation-stale')
      // The arm that refuses is the RUNG comparison, and it names the rung the
      // reviewer signed: the world now asks above it. MEASURED identity — the
      // commit boundary re-prices the rise from the tightened documents and answers
      // `human-admin`, while the durable allow is a `leader`.
      const detail = refused['detail'] as { problem?: string; approvedRung?: string }
      expect(detail.problem).toBe('ceiling-narrowed-past-approved-rung')
      expect(detail.approvedRung).toBe('leader')
      expect(refused['approvalCaseId']).toBe(approvalCaseId)
      // No re-mint: the refusal is inside the retry, not a new ask.
      expect(await w.proposalRows()).toHaveLength(rowsAtApproval.length)
    } finally {
      await w.close()
    }
  })

  it('an unreadable ceiling at retry time refuses as CONTEXT, and the approval buys nothing past it', async () => {
    // The other way the world moves: not tightened, unreadable. A durable approval
    // is evidence about a world someone read; it is not a licence to append into a
    // world nobody can read. A3-3's mapping law decides the identity — an unreadable
    // authority document is CONTEXT, never "insufficient" (which would tell a
    // healthy-looking operator to ask for authority) and never a commit.
    const w = await openApprovalWorld('unreadable-at-commit')
    try {
      const { approvalCaseId } = await w.mintAndAllow(GRANT_SUBTREE)
      const rowsAtApproval = await w.proposalRows()
      w.hard.slot = { status: 'unavailable' }
      const outcome: { ok: false; error: Error & { code?: string } } | { ok: true; result: Record<string, unknown> } =
        await w.mutate(GRANT_SUBTREE).then(
          (result) => ({ ok: true as const, result }),
          (caught: Error & { code?: string }) => ({ ok: false as const, error: caught }),
        )
      if (outcome.ok) throw new Error(`fixture: expected a typed refusal, got ${JSON.stringify(outcome.result)}`)
      expect(outcome.error.name).toBe('PermissionMutationError')
      expect(outcome.error.code).toBe('PERMISSION_EFFECT_CONTEXT_UNAVAILABLE')
      expect(await w.latestGeneration()).toBeUndefined()
      expect(await w.proposalRows()).toHaveLength(rowsAtApproval.length)
      // And the case is still the reviewer's decided allow, untouched by a refusal
      // it was never asked about.
      const read = await w.control.readApprovalCaseState({ rootSessionId: P6T4_ROOT, approvalCaseId })
      if (read.kind !== 'case') throw new Error('fixture: case unreadable')
      expect(read.state.terminalDecision?.decision).toBe('allow')
    } finally {
      await w.close()
    }
  })

  it('a commit-time refusal consumes NOTHING: the case stays resolved(allow), the retry re-prices and commits once', async () => {
    const w = await openApprovalWorld('not-consumed')
    try {
      const { approvalCaseId } = await w.mintAndAllow(GRANT_SUBTREE)
      const readBefore = await w.control.readApprovalCaseState({ rootSessionId: P6T4_ROOT, approvalCaseId })
      if (readBefore.kind !== 'case') throw new Error('fixture: case unreadable')
      w.hard.slot = {
        status: 'declared',
        document: envelope({ matcher: exact(FILE_A), effect: 'allow' }, { matcher: subtree(SUB), effect: 'deny' }),
      }
      const first = await w.mutate(GRANT_SUBTREE)
      expect(first['reason']).toBe('mutation-stale')
      // A retry against the SAME tightened world says the same thing. It does not
      // degrade into `no-change` (nothing changed) and it does not go pending.
      const second = await w.mutate(GRANT_SUBTREE)
      expect(second['reason']).toBe('mutation-stale')
      expect(await w.latestGeneration()).toBeUndefined()
      // The durable decision is untouched — not rewritten, not re-opened, not
      // extended with a new leg.
      const readAfter = await w.control.readApprovalCaseState({ rootSessionId: P6T4_ROOT, approvalCaseId })
      if (readAfter.kind !== 'case') throw new Error('fixture: case unreadable after the refusal')
      expect(readAfter.state.status).toBe(readBefore.state.status)
      expect(readAfter.state.terminalDecision?.decision).toBe('allow')
      expect(readAfter.state.legs).toHaveLength(readBefore.state.legs.length)
      // Widen the documents back: the NEXT retry re-prices the ceiling and commits
      // — with the ceiling's own consent, on the approval that was never spent.
      w.hard.slot = { status: 'absent' }
      const committed = await w.mutate(GRANT_SUBTREE)
      expect(committed['changed']).toBe(true)
      expect(await w.latestGeneration()).toBe(1)
      // And it appends EXACTLY once: the following call has nothing left to write.
      const again = await w.mutate(GRANT_SUBTREE)
      expect(again['reason']).toBe('no-change')
      expect(await w.latestGeneration()).toBe(1)
    } finally {
      await w.close()
    }
  })

  it('an unchanged world still commits: the re-ask is a guard, not a veto over A4-PR5', async () => {
    // The control leg. Without it the three legs above could be satisfied by a
    // retry path that simply never commits — which is exactly what the literal
    // "re-run the commit gate" reading produced (transcript 37).
    const w = await openApprovalWorld('control')
    try {
      await w.mintAndAllow(GRANT_SUBTREE)
      const committed = await w.mutate(GRANT_SUBTREE)
      expect(committed['changed']).toBe(true)
      expect(await w.latestGeneration()).toBe(1)
      const latest = await w.overlay.port.latest({ teamSessionId: P6T4_ROOT, memberInstanceId: WORKER_ID })
      // The committed rule is the CLAIMED WIDTH, priced at the rung that reaches
      // it — which is what "the approval covers what it bought" means.
      expect(latest?.state.rules.map((rule) => `${String(rule.resource)}=${String(rule.effect)}`)).toEqual([
        `subtree:${SUB}=allow`,
      ])
    } finally {
      await w.close()
    }
  })
})
