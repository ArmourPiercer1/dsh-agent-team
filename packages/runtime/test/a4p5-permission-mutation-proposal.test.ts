/**
 * a4p5-permission-mutation-proposal.test.ts — A4-PR5 lane A: the durable
 * permission-mutation PROPOSAL (spec §8, ADR A1-8/A1-9/A1-12, interface freeze §2).
 *
 * What is pinned here, law by law, with the refusing entrance each law has:
 *
 *  1. THE FINGERPRINT (spec §8.4, §24.5; X4): binds mutation identity — team,
 *     target, beneficiary position, mutation kind, the canonicalized rule set
 *     (operationClass + matcher root + effect) and the bound-Blueprint anchor.
 *     It EXCLUDES `mutationId` and `reason` (provenance, not identity) and the
 *     base pair (the correlation carries that, so a denied fingerprint at the
 *     same base stays discoverable — A1-9).
 *  2. THE ROUTING (spec §7.4 dual-plane semantics): the hard envelope silent on
 *     a scope means NO expansion authority on the expansion plane but NO
 *     NARROWING on the approval plane — so a rise there is not impossible, it
 *     is a PROPOSAL at the first rung whose approval ceiling reaches
 *     (`evaluateAuthorityCeiling`, frozen PR2 law, reused, never re-implemented).
 *     The batch requires ONE rung: the max over its rising regions.
 *  3. ONE durable proposal per rule (`governance-proposal-recorded`, PR0 store,
 *     grouped by `caseFingerprint`) + ONE approval case (`envelope-mutation`,
 *     inline coupling), written ONLY when the case is fresh.
 *  4. `requiredAuthority = human-admin` has NO proposal rows and NO pending
 *     surface: `requestApprovalLeg`'s A1-12 branch (amended F2, born-terminal
 *     leg + durable deny) answers `authority-unavailable` — the mutation
 *     TERMINATED, it never waits.
 *  5. Member initiation refuses BEFORE any proposal machinery (the 2a authority
 *     closure runs outside the chain — zero rows, zero cases).
 *  6. With the approval lane UNWIRED the PR2 refusal is byte-identical
 *     (`PERMISSION_AUTHORITY_CEILING_INSUFFICIENT` throw) — the capability is
 *     additive, never a silent re-shaping of teams that did not enable it.
 *
 * The worlds are the real ones: the durable overlay world
 * (`permission-overlay-helpers`) + the durable TeamDomain world driving the
 * REAL ControlService (`p6t4-helpers`). No control law is faked here; the
 * adapter under test is six delegating methods over a late-bound ref.
 *
 * @module @dsh-agent-team/runtime/test/a4p5-permission-mutation-proposal
 */

import { describe, expect, it } from 'vitest'
import * as approvalLane from '../governance/permission-approval.js'
import {
  createGovernanceMutationService,
  isPermissionMutationError,
  PERMISSION_MUTATION_ERROR_CODES,
  type GovernanceMutationService,
  type GovernancePermissionMutationArgs,
  type PermissionResourceMatcher,
  type PermissionStaticLayerFacts,
} from '../governance/index.js'
import type { PermissionAuthorityCeilingContext } from '../governance/types.js'
import { createGovernanceProposalStore } from '../governance/proposal-store.js'
import type { GovernanceProposalStore } from '../governance/proposal-store.js'
import { LEADER_INSTANCE_ID } from '../../contracts/src/index.js'
import { createTeamOperationCoordinator } from '../coordination/index.js'
import type { OverrideRecordView, OverrideStorePort, PolicyReader } from '../mutation/index.js'
import type { PolicyStateTransitionRecord } from '../mutation/types.js'
import type { GovernanceTransitionCache, GovernanceTransitionCommit } from '../governance/types.js'
import { CONTROL_REQUEST_KINDS, CONTROL_EXECUTION_COUPLINGS } from '../control/index.js'
import type {
  ApprovalCaseIdentityInput,
  ControlService,
} from '../control/index.js'
import { TERMINAL_MUTATION_OUTCOMES } from '../intervention/derivation.js'
import type { AuthorityEnvelopeDocuments, AuthorityDocumentSlot } from '../governance/authority-ceiling.js'
import type { AuthorityEnvelope } from '../../domain/authority-envelope/src/index.js'
import type { PermissionMutationProposalFingerprintInput } from '../governance/index.js'
import type { ActionCaller } from '../admission/types.js'
import {
  P6T4_ROOT,
  P6T4_SEEDS,
  createP6T4Service,
  createP6T4World,
  destroyP6T1World,
  humanCaller,
  leaderCaller,
} from './p6t4-helpers.js'
import type { P6T1World } from './p6t1-helpers.js'
import { openWorld, type World } from './permission-overlay-helpers.js'
import { createAuthorityCeilingReader } from '../src/plugin/permission-plane.js'

const WORKER_ID = String(P6T4_SEEDS.worker.instanceId)
const NOW = '2026-10-07T09:00:00.000Z'

const FILE_A = 'output/a.json'
const FILE_B = 'output/b.json'
const SUBTREE_A = 'output/a'

const exact = (resource: string): PermissionResourceMatcher => ({ kind: 'exact', resource })
const subtree = (resource: string): PermissionResourceMatcher => ({ kind: 'subtree', resource })

// ---------------------------------------------------------------------------
// The legacy-lane noops (same discipline as a3p3-permission-mutation-authority)
// ---------------------------------------------------------------------------

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
    throw new Error('the permission-mutation path must not read the capability envelope')
  },
  readTemplatePolicy(): never {
    throw new Error('the permission-mutation path must not read template policy')
  },
  readExternalFacts(): never {
    throw new Error('the permission-mutation path must not read external hard facts')
  },
}

// ---------------------------------------------------------------------------
// Documents
// ---------------------------------------------------------------------------

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

const DECLARED = (document: AuthorityEnvelope): AuthorityDocumentSlot => ({
  status: 'declared',
  document,
})

/** The Leader's own carrier: full coverage, `allow` ceiling (Alpha.3's law
 *  passes; the Team's hard envelope is the only thing left standing between
 *  the Leader and a direct commit). */
const CARRIER_ALLOW = envelope(
  { matcher: exact(FILE_A), effect: 'allow' },
  { matcher: exact(FILE_B), effect: 'allow' },
  { matcher: subtree(SUBTREE_A), effect: 'allow' },
)

/** The containment contract these worlds live under: a subtree root contains
 *  ITSELF and (the one fact the carrier's subtree rule needs) `output/a`
 *  contains `output/a.json`. Absent-when-asked is a DIFFERENT world (the
 *  undecided test opts out via `containment: 'absent'`) — a seam that never
 *  answers is how A3-3's undecided arm is reached, never a default here. */
const defaultContains = (root: string, child: string): boolean =>
  root === child || (root === SUBTREE_A && child === FILE_A)

// ---------------------------------------------------------------------------
// The world: overlay + TeamDomain (REAL ControlService) + proposal store +
// the late-bound approval adapter (the same six delegating methods root.ts
// wires; `controlRef.current === undefined` must behave as unwired).
// ---------------------------------------------------------------------------

interface ApprovalWorldOptions {
  readonly hard: AuthorityDocumentSlot
  readonly carrier?: AuthorityEnvelope
  readonly staticFacts?: PermissionStaticLayerFacts
  readonly subtreeContains?: (root: string, child: string) => boolean
  /** 'absent' wires NO containment seam at all — the world where subtree
   *  coverage is UNDECIDED (the fail-closed arm). Default: `defaultContains`. */
  readonly containment?: 'wired' | 'absent'
  /** Wire the approval lane at all (false pins the PR2 byte-identity). */
  readonly approvalWired?: boolean
}

async function openApprovalWorld(name: string, options: ApprovalWorldOptions): Promise<{
  readonly governance: GovernanceMutationService
  readonly proposals: GovernanceProposalStore
  readonly control: ControlService
  readonly p6: P6T1World
  readonly overlay: World
  readonly lifecycle: { state: 'live' | 'archived' | 'disposed' }
  readonly close: () => Promise<void>
  readonly controlWrites: () => number
  mutate: (args: Partial<GovernancePermissionMutationArgs> & {
    rules: readonly { operationClass: string; matcher: PermissionResourceMatcher; effect: 'allow' | 'ask' | 'deny' }[]
    authority?: GovernancePermissionMutationArgs['authority']
    approvalCaller?: ActionCaller
  }) => Promise<Record<string, unknown>>
}> {
  const p6 = await createP6T4World(`a4p5a-${name}`)
  const overlay = await openWorld(`a4p5a-${name}`)
  const proposals = createGovernanceProposalStore({
    ledger: p6.domain.repositories.ledger as never,
    now: () => NOW,
  })
  const control = createP6T4Service(p6)
  const controlRef: { current: ControlService | undefined } = { current: control }
  const wired = options.approvalWired !== false
  const approvalPort = wired
    ? approvalLane.lateBoundPermissionMutationApprovalPort(controlRef as {
        current: approvalLane.PermissionMutationApprovalPort | undefined
      })
    : undefined
  const lifecycle: { state: 'live' | 'archived' | 'disposed' } = { state: 'live' }
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
      permissionEnvelope: () => options.carrier ?? CARRIER_ALLOW,
      staticLayers: () => options.staticFacts ?? { layers: [] },
      ...(options.containment === 'absent'
        ? {}
        : { subtreeContains: options.subtreeContains ?? defaultContains }),
      authorityCeiling: async (
        _team: string,
        _member: string,
        actor: 'leader' | 'human',
      ): Promise<PermissionAuthorityCeilingContext> => ({
        // The production reader hardcodes `member` (reported); the service must
        // DERIVE the leader position for a leader target regardless of this
        // field — `a4p5-self-mutation.test.ts` pins that derivation.
        beneficiaryAuthority: 'member',
        initiatorAuthority: actor === 'leader' ? 'leader' : 'human-user',
        documents: {
          teamHardEnvelope: options.hard,
          permissionMutationEnvelope: DECLARED(options.carrier ?? CARRIER_ALLOW),
        },
      } satisfies PermissionAuthorityCeilingContext),
      targetGuard: async () => {
        if (lifecycle.state !== 'live') {
          const error = new Error(`fixture lifecycle refusal: ${lifecycle.state}`)
          ;(error as Error & { code?: string }).code = 'INSTANCE_LIFECYCLE_REFUSED'
          throw error
        }
      },
    },
    ...(approvalPort === undefined ? {} : { approval: approvalPort, proposals }),
  })
  let mutationCounter = 0
  return {
    governance,
    proposals,
    control,
    p6,
    overlay,
    lifecycle,
    controlWrites: () => p6.seam.writeCount - p6.seedWriteCount,
    close: async () => {
      await overlay.store.close()
      overlay.destroy()
      await destroyP6T1World(p6)
    },
    mutate: async (args) =>
      (await governance.mutatePermission({
        authority: args.authority ?? { kind: 'leader' },
        teamSessionId: P6T4_ROOT,
        memberInstanceId: args.memberInstanceId ?? WORKER_ID,
        kind: args.kind ?? 'grant_instance',
        mutationId: args.mutationId ?? `mut-${String(++mutationCounter)}`,
        reason: args.reason ?? 'fixture mutation',
        rules: args.rules,
        ...(args.expectedGeneration === undefined
          ? {}
          : { expectedGeneration: args.expectedGeneration }),
        ...(args.approvalCaller === undefined ? {} : { approvalCaller: args.approvalCaller }),
      } as GovernancePermissionMutationArgs)) as unknown as Record<string, unknown>,
  } as ReturnType<typeof openApprovalWorld> extends never
    ? never
    : Awaited<ReturnType<typeof openApprovalWorld>>
}

/** Capture a rejection without aborting the scenario. */
async function refusal(
  fn: () => Promise<unknown>,
): Promise<{ readonly threw: boolean; readonly error?: unknown; readonly value?: unknown }> {
  try {
    return { threw: false, value: await fn() }
  } catch (error) {
    return { threw: true, error }
  }
}

function grantA(effect: 'allow' | 'ask' | 'deny' = 'allow') {
  return [{ operationClass: 'write', matcher: exact(FILE_A), effect }]
}

// ---------------------------------------------------------------------------
// 1. The fingerprint law
// ---------------------------------------------------------------------------

const baseFingerprintInput: PermissionMutationProposalFingerprintInput = {
  teamSessionId: P6T4_ROOT,
  targetMemberInstanceId: WORKER_ID,
  beneficiaryAuthority: 'member' as const,
  mutationKind: 'grant_instance' as const,
  rules: [
    { operationClass: 'write', matcherKind: 'exact', matcherResource: FILE_A, effect: 'allow' as const },
  ],
  blueprintContentHash: null,
}

describe('the PRODUCTION fingerprint anchor (rebase-round pin: a bound value, never silently skipped)', () => {
  const ANCHOR = `sha256:${'a'.repeat(64)}`
  // The production assembler ITSELF under test (not a re-statement of its
  // shape): documents pass through, so a minimal v3 fact set is sufficient for
  // what this group reads.
  const productionReader = (hash: string | undefined) =>
    createAuthorityCeilingReader({
      facts: {
        blueprintSchemaVersion: () => 3,
        blueprintContentHash: () => hash,
        teamHardEnvelope: async () => ({ status: 'declared', document: { rules: [] } }),
        permissionEnvelope: async () => ({ rules: [] }),
      } as never,
    })

  it('a production v3 context carries the REAL bound hash and the TARGET-DERIVED beneficiary', async () => {
    const read = productionReader(ANCHOR)
    const memberCtx = await read(P6T4_ROOT, WORKER_ID, 'human')
    expect(memberCtx, 'v3 facts must answer a context').toBeDefined()
    expect(memberCtx?.blueprintContentHash, 'a v3 context without the bound hash is what "silently skipped" would look like').toBe(ANCHOR)
    expect(memberCtx?.beneficiaryAuthority).toBe('member')
    const leaderCtx = await read(P6T4_ROOT, LEADER_INSTANCE_ID, 'human')
    // The beneficiary derives from the TARGET IDENTITY through the law the ask
    // path applies — now at the ONE reader, so plane and ask cannot disagree.
    // A leader-targeted read answers `leader`, never the pre-PR5 flat `member`
    // (the self-approval rung), and never `human-admin` (the ladder crowns
    // nobody here).
    expect(leaderCtx?.beneficiaryAuthority).toBe('leader')
    expect(leaderCtx?.blueprintContentHash).toBe(ANCHOR)
    // The service maps the context onto the fingerprint at
    // `ctx.blueprintContentHash ?? null` (governance/service.ts): with a
    // production context the null branch is UNREACHABLE, and — pinned below —
    // the anchored and anchorless fingerprints are DIFFERENT values, so "bound
    // to the bound Blueprint" and "skipped the anchor" stay distinguishable in
    // every durable row, forever.
    const anchored = approvalLane.permissionMutationProposalFingerprint({ ...baseFingerprintInput, blueprintContentHash: ANCHOR })
    const skipped = approvalLane.permissionMutationProposalFingerprint(baseFingerprintInput) // null anchor
    expect(anchored).toMatch(/^mutfp-[0-9a-f]{64}$/)
    expect(anchored).not.toBe(skipped)
  })

  it('a v3 binding resolving WITHOUT a content hash answers an unreadable ceiling — an anchorless proposal still cannot exist', async () => {
    // INVERTED by A4-PR7 §7.5 prerequisite 3, with what it asserted quoted where it
    // stood:
    //
    //   expect(await productionReader(undefined)(P6T4_ROOT, WORKER_ID, 'human')).toBeUndefined()
    //
    // The LAW this leg guards is untouched and is served better: the fingerprint law
    // keeps `null` as a DISTINCT bound value for pre-PR5 rows, and PRODUCTION cannot
    // reach it. It used to be unreachable because the reader abstained into the
    // pre-v3 branch — which also skipped the ceiling gate entirely, so the same
    // answer let a RISE commit with no ceiling evaluated (measured at the entry:
    // `a4p7-ceiling-no-context-refusal.test.ts` legs 1-3). Now the answer is an
    // unreadable ceiling, which no rise can pass and no fingerprint can be minted
    // from: there is still no anchorless durable row, and now there is no
    // unevaluated one either. The anchor itself stays absent — nothing resolvable
    // exists to anchor to.
    const context = await productionReader(undefined)(P6T4_ROOT, WORKER_ID, 'human')
    expect(context, 'a v3 binding that cannot be read is not a pre-v3 Team').toBeDefined()
    expect(context?.documents).toEqual({
      teamHardEnvelope: { status: 'unavailable' },
      permissionMutationEnvelope: { status: 'unavailable' },
    })
    expect(context?.blueprintContentHash).toBeUndefined()
  })
})

describe('the permission-mutation proposal fingerprint (spec 8.4, 24.5)', () => {
  it('is deterministic, id-shaped, and order-insensitive over the rule set', () => {
    const first = approvalLane.permissionMutationProposalFingerprint(baseFingerprintInput)
    expect(first).toMatch(/^mutfp-[0-9a-f]{64}$/)
    expect(approvalLane.permissionMutationProposalFingerprint(baseFingerprintInput)).toBe(first)
    const reordered = approvalLane.permissionMutationProposalFingerprint({
      ...baseFingerprintInput,
      rules: [
        { operationClass: 'read', matcherKind: 'exact', matcherResource: FILE_B, effect: 'ask' as const },
        { operationClass: 'write', matcherKind: 'exact', matcherResource: FILE_A, effect: 'allow' as const },
      ],
    })
    const alsoReordered = approvalLane.permissionMutationProposalFingerprint({
      ...baseFingerprintInput,
      rules: [
        { operationClass: 'write', matcherKind: 'exact', matcherResource: FILE_A, effect: 'allow' as const },
        { operationClass: 'read', matcherKind: 'exact', matcherResource: FILE_B, effect: 'ask' as const },
      ],
    })
    expect(reordered).toBe(alsoReordered)
  })

  const variants: readonly (readonly [string, (input: PermissionMutationProposalFingerprintInput) => PermissionMutationProposalFingerprintInput])[] = [
    ['team', (input: typeof baseFingerprintInput) => ({ ...input, teamSessionId: 'session-other' })],
    ['target', (input: typeof baseFingerprintInput) => ({ ...input, targetMemberInstanceId: 'inst-other' })],
    ['beneficiary', (input: typeof baseFingerprintInput) => ({ ...input, beneficiaryAuthority: 'leader' as const })],
    ['kind', (input: typeof baseFingerprintInput) => ({ ...input, mutationKind: 'revoke_permission' as const })],
    [
      'requested effect',
      (input: typeof baseFingerprintInput) => ({
        ...input,
        rules: [{ ...input.rules[0]!, effect: 'ask' as const }],
      }),
    ],
    [
      'matcher kind (root identity class)',
      (input: typeof baseFingerprintInput) => ({
        ...input,
        rules: [{ ...input.rules[0]!, matcherKind: 'subtree' }],
      }),
    ],
    [
      'matcher root',
      (input: typeof baseFingerprintInput) => ({
        ...input,
        rules: [{ ...input.rules[0]!, matcherResource: FILE_B }],
      }),
    ],
    [
      'operation class',
      (input: typeof baseFingerprintInput) => ({
        ...input,
        rules: [{ ...input.rules[0]!, operationClass: 'read' }],
      }),
    ],
    ['blueprint anchor', (input: typeof baseFingerprintInput) => ({ ...input, blueprintContentHash: 'sha256:aa' })],
  ]
  for (const [name, mutate] of variants) {
    it(`binds the ${name} — changing it changes the fingerprint`, () => {
      expect(approvalLane.permissionMutationProposalFingerprint(mutate(baseFingerprintInput))).not.toBe(
        approvalLane.permissionMutationProposalFingerprint(baseFingerprintInput),
      )
    })
  }

  it('EXCLUDES provenance: mutationId / reason / base / actor are not identity (24.5)', () => {
    const withOne = approvalLane.permissionMutationProposalFingerprint({
      ...baseFingerprintInput,
      mutationId: 'mut-1',
      reason: 'because one',
      baseGeneration: 0,
      actor: LEADER_INSTANCE_ID,
    } as never)
    const withTwo = approvalLane.permissionMutationProposalFingerprint({
      ...baseFingerprintInput,
      mutationId: 'mut-2',
      reason: 'because two',
      baseGeneration: 7,
      actor: 'human:someone',
    } as never)
    expect(withOne).toBe(withTwo)
    expect(withOne).toBe(approvalLane.permissionMutationProposalFingerprint(baseFingerprintInput))
  })
})

describe('the base-pair correlation and the derived beneficiary', () => {
  it('names only the base pair: same base = same correlation, new base = new one (A1-9)', () => {
    const atZero = approvalLane.permissionMutationCorrelation({ baseGeneration: 0, baseSnapshotId: null })
    expect(approvalLane.permissionMutationCorrelation({ baseGeneration: 0, baseSnapshotId: null })).toBe(atZero)
    expect(atZero).not.toBe(approvalLane.permissionMutationCorrelation({ baseGeneration: 1, baseSnapshotId: 'snap-1' }))
    expect(atZero).not.toBe(approvalLane.permissionMutationCorrelation({ baseGeneration: 0, baseSnapshotId: 'snap-x' }))
  })

  it('derives the leader position from the TARGET identity, and the signature admits NOTHING else (A5-1, review item 7b)', () => {
    // The one-argument signature IS the law: an earlier shape carried an
    // optional ceiling-context label the derivation never read; review item
    // 7b deleted it, so no call site can even offer a label to move the
    // answer. What remains is the whole of it:
    expect(approvalLane.beneficiaryAuthorityForTarget(LEADER_INSTANCE_ID)).toBe('leader')
    expect(approvalLane.beneficiaryAuthorityForTarget(WORKER_ID)).toBe('member')
    expect(approvalLane.beneficiaryAuthorityForTarget.length).toBe(1)
  })
})

describe('the approval rung plan (spec 7.4 walk, reused not re-implemented)', () => {
  const documents: AuthorityEnvelopeDocuments = {
    teamHardEnvelope: { status: 'absent' },
    permissionMutationEnvelope: DECLARED(CARRIER_ALLOW),
  }
  const regions = [
    { operationClass: 'write', matcher: exact(FILE_A), risenEffect: 'allow' as const },
  ]

  it('names the first approval rung that reaches (hard silent -> leader for a member rise)', () => {
    const plan = approvalLane.planPermissionMutationApproval({
      beneficiaryAuthority: 'member',
      documents,
      regions,
      subtreeContains: defaultContains,
    })
    expect(plan.status).toBe('required')
    if (plan.status !== 'required') return
    expect(plan.requiredAuthority).toBe('leader')
    expect(plan.requestedEffect).toBe('allow')
  })

  it('the batch is the MAX rung over its rising regions (all-or-nothing)', () => {
    // A MIXED batch with rungs that genuinely DIFFER, ordered so FIRST and
    // MAX disagree (a first-wins walk answers `leader` here — the flip that
    // drops the max must fail): FILE_B rises through the silent carrier
    // (-> leader), FILE_A is capped by the hard envelope (-> human-admin,
    // the hard envelope's own law). One proposal for the whole batch means
    // ONE case at the HIGHEST rung the batch needs — a lower case could
    // never lawfully commit the capped region's rule (all-or-nothing).
    const plan = approvalLane.planPermissionMutationApproval({
      beneficiaryAuthority: 'member',
      documents: {
        teamHardEnvelope: DECLARED(envelope({ matcher: exact(FILE_A), effect: 'ask' })),
        permissionMutationEnvelope: DECLARED(CARRIER_ALLOW),
      },
      regions: [
        { operationClass: 'write', matcher: exact(FILE_B), risenEffect: 'allow' as const },
        { operationClass: 'write', matcher: exact(FILE_A), risenEffect: 'allow' as const },
      ],
      subtreeContains: defaultContains,
    })
    expect(plan.status).toBe('required')
    if (plan.status !== 'required') return
    expect(plan.requiredAuthority).toBe('human-admin')
  })

  it('an undecided ceiling is UNDETERMINED, never a guessed rung', () => {
    const plan = approvalLane.planPermissionMutationApproval({
      beneficiaryAuthority: 'member',
      documents: {
        teamHardEnvelope: { status: 'unavailable' },
        permissionMutationEnvelope: DECLARED(CARRIER_ALLOW),
      },
      regions,
      subtreeContains: defaultContains,
    })
    expect(plan.status).toBe('unavailable')
  })

  it('a capped hard envelope pushes the ask above the ladder -> human-admin', () => {
    const plan = approvalLane.planPermissionMutationApproval({
      beneficiaryAuthority: 'member',
      documents: {
        teamHardEnvelope: DECLARED(envelope({ matcher: exact(FILE_A), effect: 'ask' })),
        permissionMutationEnvelope: DECLARED(CARRIER_ALLOW),
      },
      regions,
      subtreeContains: defaultContains,
    })
    expect(plan.status).toBe('required')
    if (plan.status !== 'required') return
    expect(plan.requiredAuthority).toBe('human-admin')
  })
})

describe('the frozen-outcome mirror', () => {
  it('mirrors intervention TERMINAL_MUTATION_OUTCOMES without importing it', () => {
    // EXACTLY the four outcomes this lane can terminate with — a stub or a
    // silent drift fails here, not at a consumer.
    expect([...Object.values(approvalLane.PERMISSION_MUTATION_TERMINAL_OUTCOMES)].sort()).toEqual([
      TERMINAL_MUTATION_OUTCOMES.AUTHORITY_UNAVAILABLE,
      TERMINAL_MUTATION_OUTCOMES.AUTHORITY_UNDETERMINED,
      TERMINAL_MUTATION_OUTCOMES.DENIED,
      TERMINAL_MUTATION_OUTCOMES.MUTATION_STALE,
    ].sort())
    // The pending reason is NOT a terminal outcome (it parks; it does not end).
    expect(Object.values(TERMINAL_MUTATION_OUTCOMES)).not.toContain(approvalLane.PERMISSION_MUTATION_PENDING_REASON)
    expect(approvalLane.PERMISSION_MUTATION_PENDING_REASON).toBe('mutation-proposal-pending')
  })
})

// ---------------------------------------------------------------------------
// 2. The proposal path through the service
// ---------------------------------------------------------------------------

describe('a rise beyond the initiator ceiling inside approval reach -> durable proposal', () => {
  it('creates ONE case + one proposal row per rule, commits NOTHING, and says so', async () => {
    const w = await openApprovalWorld('pending', { hard: { status: 'absent' } })
    try {
      const result = await w.mutate({ rules: grantA() })
      expect(result['changed']).toBe(false)
      expect(result['reason']).toBe(approvalLane.PERMISSION_MUTATION_PENDING_REASON)
      const approvalCaseId = result['approvalCaseId'] as string
      expect(approvalCaseId).toMatch(/^case-/)
      expect(result['requiredAuthority']).toBe('leader')
      expect(typeof result['proposalFingerprint']).toBe('string')

      // Durable: one proposal row per rule, PR0 shape, grouped by the fingerprint.
      const outcome = await w.proposals.listProposals({ teamSessionId: P6T4_ROOT })
      const rows = outcome.filter((entry) => entry.kind === 'record')
      expect(rows.length).toBe(1)
      const row = rows[0]
      if (row === undefined || row.kind !== 'record') return
      expect(row.proposal.targetMemberInstanceId).toBe(WORKER_ID)
      expect(row.proposal.baseGeneration).toBe(0)
      expect(row.proposal.baseSnapshotId).toBeNull()
      expect(row.proposal.desiredEffect).toBe('allow')
      expect(row.proposal.authorityEnvelopeAst).toEqual({ kind: 'exact', path: FILE_A })
      expect(row.proposal.requiredAuthority).toBe('leader')
      expect(row.proposal.caseFingerprint).toBe(result['proposalFingerprint'])

      // Durable: the approval case — envelope-mutation, inline, at the leader rung.
      const read = await w.control.readApprovalCaseState({ rootSessionId: P6T4_ROOT, approvalCaseId })
      expect(read.kind).toBe('case')
      if (read.kind !== 'case') return
      expect(read.state.status).toBe('open')
      const leg = read.state.currentLeg
      expect(leg?.kind).toBe(CONTROL_REQUEST_KINDS.ENVELOPE_MUTATION)
      expect(leg?.reviewAuthority).toBe('leader')
      expect(leg?.executionCoupling).toBe(CONTROL_EXECUTION_COUPLINGS.INLINE)
      expect(leg?.approvalCaseId).toBe(approvalCaseId)
      expect(read.state.identity.mutationProposalFingerprint).toBe(result['proposalFingerprint'])
      expect(read.state.identity.operationFingerprint).toBeUndefined()
      expect(read.state.identity.beneficiaryAuthority).toBe('member')
      expect(read.state.identity.subject).toEqual({ kind: 'instance', instanceId: WORKER_ID })
      expect(leg?.summary).toContain('pmut-rise:')

      // Zero commit: the overlay never moved.
      expect(await w.overlay.port.latest({ teamSessionId: P6T4_ROOT, memberInstanceId: WORKER_ID })).toBeUndefined()
    } finally {
      await w.close()
    }
  })

  it('a retry is idempotent: same case, one leg row, no second proposal set', async () => {
    const w = await openApprovalWorld('idempotent', { hard: { status: 'absent' } })
    try {
      const first = await w.mutate({ rules: grantA(), mutationId: 'mut-1', reason: 'first' })
      const second = await w.mutate({ rules: grantA(), mutationId: 'mut-2', reason: 'second' })
      // mutationId/reason are provenance: the identity (and the case) are the same.
      expect(second['approvalCaseId']).toBe(first['approvalCaseId'])
      const state = await w.control.listControlState(P6T4_ROOT)
      expect(state.requests.length).toBe(1)
      const proposals = (await w.proposals.listProposals({ teamSessionId: P6T4_ROOT })).filter((entry) => entry.kind === 'record')
      expect(proposals.length).toBe(1)
    } finally {
      await w.close()
    }
  })

  it('a different effect asked is a DIFFERENT fingerprint, a DIFFERENT case', async () => {
    const w = await openApprovalWorld('fp-split', { hard: { status: 'absent' } })
    try {
      const allowAsk = await w.mutate({ rules: grantA('allow') })
      const askAsk = await w.mutate({ rules: grantA('ask') })
      expect(askAsk['proposalFingerprint']).not.toBe(allowAsk['proposalFingerprint'])
      expect(askAsk['approvalCaseId']).not.toBe(allowAsk['approvalCaseId'])
    } finally {
      await w.close()
    }
  })

  it('a denied fingerprint at the same base is NOT re-proposable (A1-9): denied is terminal', async () => {
    const w = await openApprovalWorld('denied', { hard: { status: 'absent' } })
    try {
      const pending = await w.mutate({ rules: grantA() })
      const approvalCaseId = pending['approvalCaseId'] as string
      const read = await w.control.readApprovalCaseState({ rootSessionId: P6T4_ROOT, approvalCaseId })
      if (read.kind !== 'case' || read.state.currentLeg === undefined) throw new Error('fixture: no leg')
      await w.control.resolveControl({
        rootSessionId: P6T4_ROOT,
        caller: leaderCaller(),
        requestId: read.state.currentLeg.requestId,
        decision: 'deny',
      })
      const retry = await w.mutate({ rules: grantA(), mutationId: 'mut-retry', reason: 'again' })
      expect(retry['reason']).toBe(approvalLane.PERMISSION_MUTATION_TERMINAL_OUTCOMES.DENIED)
      const open = await w.control.listOpenApprovalCases({ rootSessionId: P6T4_ROOT })
      expect(open.length).toBe(0)
      const proposals = (await w.proposals.listProposals({ teamSessionId: P6T4_ROOT })).filter((entry) => entry.kind === 'record')
      expect(proposals.length).toBe(1)
      expect(await w.overlay.port.latest({ teamSessionId: P6T4_ROOT, memberInstanceId: WORKER_ID })).toBeUndefined()
    } finally {
      await w.close()
    }
  })

  it('a NEW base generation re-asks with a fresh case (A1-9 recovery)', async () => {
    const w = await openApprovalWorld('rebase', { hard: { status: 'absent' } })
    try {
      const pending = await w.mutate({ rules: grantA() })
      const approvalCaseId = pending['approvalCaseId'] as string
      const read = await w.control.readApprovalCaseState({ rootSessionId: P6T4_ROOT, approvalCaseId })
      if (read.kind !== 'case' || read.state.currentLeg === undefined) throw new Error('fixture: no leg')
      await w.control.resolveControl({
        rootSessionId: P6T4_ROOT,
        caller: leaderCaller(),
        requestId: read.state.currentLeg.requestId,
        decision: 'deny',
      })
      // A self-tightening needs no authority and commits directly -> new base.
      await w.mutate({
        rules: [{ operationClass: 'write', matcher: exact(FILE_B), effect: 'deny' }],
        mutationId: 'mut-tighten',
      })
      const reasked = await w.mutate({ rules: grantA(), mutationId: 'mut-rebase', reason: 'new base' })
      expect(reasked['reason']).toBe(approvalLane.PERMISSION_MUTATION_PENDING_REASON)
      expect(reasked['approvalCaseId']).not.toBe(approvalCaseId)
    } finally {
      await w.close()
    }
  })

  it('the requester is the DERIVED principal the lane was given, never a host default', async () => {
    const w = await openApprovalWorld('requester', { hard: { status: 'absent' } })
    try {
      const pending = await w.mutate({
        rules: grantA(),
        authority: { kind: 'operator' },
        approvalCaller: { kind: 'human', humanId: 'human-a4p5' },
      })
      const read = await w.control.readApprovalCaseState({
        rootSessionId: P6T4_ROOT,
        approvalCaseId: pending['approvalCaseId'] as string,
      })
      if (read.kind !== 'case' || read.state.currentLeg === undefined) throw new Error('fixture: no leg')
      expect(read.state.currentLeg.requester).toEqual({ kind: 'human', humanId: 'human-a4p5' })
    } finally {
      await w.close()
    }
  })

  it('an operator rise with NO named approval caller behaves as the unwired lane (PR2 throw)', async () => {
    const w = await openApprovalWorld('callerless', { hard: { status: 'absent' } })
    try {
      const captured = await refusal(() => w.mutate({ rules: grantA(), authority: { kind: 'operator' } }))
      expect(captured.threw).toBe(true)
      expect(isPermissionMutationError(captured.error)).toBe(true)
      expect((captured.error as { code?: string }).code).toBe(
        PERMISSION_MUTATION_ERROR_CODES.AUTHORITY_CEILING_INSUFFICIENT,
      )
      const proposals = (await w.proposals.listProposals({ teamSessionId: P6T4_ROOT })).filter((entry) => entry.kind === 'record')
      expect(proposals.length).toBe(0)
    } finally {
      await w.close()
    }
  })
})

describe('the refusals that must never propose', () => {
  it('a Human User rise above the Team Hard cap terminates authority-unavailable: no rows, no pending, durable deny', async () => {
    const w = await openApprovalWorld('admin-needed', {
      hard: DECLARED(envelope({ matcher: exact(FILE_A), effect: 'ask' })),
    })
    try {
      const result = await w.mutate({
        rules: grantA(),
        authority: { kind: 'operator' },
        approvalCaller: humanCaller(),
      })
      expect(result['changed']).toBe(false)
      expect(result['reason']).toBe(approvalLane.PERMISSION_MUTATION_TERMINAL_OUTCOMES.AUTHORITY_UNAVAILABLE)
      const proposals = (await w.proposals.listProposals({ teamSessionId: P6T4_ROOT })).filter((entry) => entry.kind === 'record')
      expect(proposals.length).toBe(0)
      const open = await w.control.listOpenApprovalCases({ rootSessionId: P6T4_ROOT })
      expect(open.length).toBe(0)
      // Born-terminal (amended F2): the leg row exists, already denied.
      const state = await w.control.listControlState(P6T4_ROOT)
      expect(state.requests.length).toBe(1)
      expect(state.decisions.length).toBe(1)
      expect(state.decisions[0]?.decision).toBe('deny')
      expect(await w.overlay.port.latest({ teamSessionId: P6T4_ROOT, memberInstanceId: WORKER_ID })).toBeUndefined()
    } finally {
      await w.close()
    }
  })

  it('member initiation refuses BEFORE any proposal machinery (zero rows, zero cases)', async () => {
    const w = await openApprovalWorld('member-actor', { hard: { status: 'absent' } })
    try {
      const captured = await refusal(() =>
        w.mutate({ rules: grantA(), authority: { kind: 'member', instanceId: WORKER_ID } }),
      )
      expect(captured.threw).toBe(true)
      expect((captured.error as { code?: string }).code).toBe(PERMISSION_MUTATION_ERROR_CODES.UNAUTHORIZED_ACTOR)
      const proposals = (await w.proposals.listProposals({ teamSessionId: P6T4_ROOT })).filter((entry) => entry.kind === 'record')
      expect(proposals.length).toBe(0)
      const state = await w.control.listControlState(P6T4_ROOT)
      expect(state.requests.length).toBe(0)
    } finally {
      await w.close()
    }
  })

  it('an unreadable hard envelope REFUSES (never absent, never a proposal)', async () => {
    const w = await openApprovalWorld('hard-unavailable', { hard: { status: 'unavailable' } })
    try {
      const captured = await refusal(() => w.mutate({ rules: grantA() }))
      expect(captured.threw).toBe(true)
      const error = captured.error as { code?: string; details?: Record<string, unknown> }
      // A faulted ceiling read is CONTEXT, never an authorization label
      // (PR2's mapping stands untouched by PR5): never "absent", never a proposal.
      expect(error.code).toBe(PERMISSION_MUTATION_ERROR_CODES.EFFECT_CONTEXT_UNAVAILABLE)
      expect(error.details?.['problem']).toBe('authority-ceiling-document-unavailable')
      expect(error.details?.['authorityCeilingCode']).toBe('AUTHORITY_CEILING_DOCUMENT_UNAVAILABLE')
      const proposals = (await w.proposals.listProposals({ teamSessionId: P6T4_ROOT })).filter((entry) => entry.kind === 'record')
      expect(proposals.length).toBe(0)
    } finally {
      await w.close()
    }
  })

  it('an undecided containment is UNDETERMINED — no rung is proposed for an undecided region', async () => {
    const w = await openApprovalWorld('undetermined', { hard: { status: 'absent' }, containment: 'absent' })
    try {
      const captured = await refusal(() =>
        w.mutate({ rules: [{ operationClass: 'write', matcher: subtree(SUBTREE_A), effect: 'allow' }] }),
      )
      expect(captured.threw).toBe(true)
      const error = captured.error as { code?: string; details?: Record<string, unknown> }
      expect(error.code).toBe(PERMISSION_MUTATION_ERROR_CODES.EFFECT_CONTEXT_UNAVAILABLE)
      // The undecided containment refuses at the RISE CLASSIFICATION (the
      // problem token of that shared refusal), before any rung is computed —
      // either way: a typed throw, and nothing proposed, nowhere open.
      expect(error.details?.['problem']).toBe('subtree-relation-unknown')
      const open = await w.control.listOpenApprovalCases({ rootSessionId: P6T4_ROOT })
      expect(open.length).toBe(0)
    } finally {
      await w.close()
    }
  })

  it('with the approval lane UNWIRED the PR2 refusal is byte-identical', async () => {
    const w = await openApprovalWorld('unwired', { hard: DECLARED(envelope({ matcher: exact(FILE_A), effect: 'ask' })), approvalWired: false })
    try {
      const captured = await refusal(() => w.mutate({ rules: grantA() }))
      expect(captured.threw).toBe(true)
      expect((captured.error as { code?: string }).code).toBe(
        PERMISSION_MUTATION_ERROR_CODES.AUTHORITY_CEILING_INSUFFICIENT,
      )
    } finally {
      await w.close()
    }
  })
})

describe('the identity the case is opened with', () => {
  it('names the kind EXPLICITLY: a silent LEADER_APPROVAL default can never swallow a mutation case', async () => {
    const w = await openApprovalWorld('kind-explicit', { hard: { status: 'absent' } })
    try {
      const pending = await w.mutate({ rules: grantA() })
      const fingerprint = pending['proposalFingerprint'] as string
      const identity: ApprovalCaseIdentityInput = {
        subject: { kind: 'instance', instanceId: WORKER_ID },
        beneficiaryAuthority: 'member',
        requestedEffect: 'allow',
        mutationProposalFingerprint: fingerprint,
        correlation: approvalLane.permissionMutationCorrelation({ baseGeneration: 0, baseSnapshotId: null }),
      }
      // Same identity WITHOUT the explicit kind can never even ADDRESS the
      // case: the defaulted (leader-approval) question demands an operation
      // fingerprint and rejects the mutation vocabulary typed — the silent
      // default does not answer `none` about the wrong question, it refuses
      // the mix. PR5's discovery always names ENVELOPE_MUTATION explicitly.
      let defaulted: 'threw' | 'none' | 'found' = 'found'
      try {
        const lookup = await w.control.findApprovalCaseByIdentity({ rootSessionId: P6T4_ROOT, identity })
        defaulted = lookup.kind
      } catch {
        defaulted = 'threw'
      }
      const explicit = await w.control.findApprovalCaseByIdentity({
        rootSessionId: P6T4_ROOT,
        identity,
        kind: CONTROL_REQUEST_KINDS.ENVELOPE_MUTATION,
      })
      expect(defaulted).not.toBe('found')
      expect(explicit.kind).toBe('found')
      expect(explicit.kind === 'found' && explicit.approvalCaseId).toBe(pending['approvalCaseId'])
    } finally {
      await w.close()
    }
  })
})
