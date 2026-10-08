/**
 * a4p7-ceiling-no-port-refusal.test.ts — A4-PR7 §7.5 PREREQUISITE 3, PINNED:
 * a governance lane that wired NO authority-ceiling reader REFUSES a rising
 * mutation instead of committing it.
 *
 * ---------------------------------------------------------------------------
 * THE LAW, AND WHY IT IS A REFUSAL RATHER THAN A SILENT COMMIT
 * ---------------------------------------------------------------------------
 * Until this commit the v3 ceiling gate was entered only
 * `if (lane.authorityCeiling !== undefined)`. Absence of the port was therefore
 * not a fact the kernel could see: the gate simply was not there, and a batch
 * that RAISED the effective effect appended, carrying no ceiling at all. The
 * §7.6 census counts 17 `createTeamProductionRoot` call sites — 1 production
 * producer, 16 test worlds — and NOT ONE of the 16 injected the port, so every
 * "assembled lane" test in the repository was asserting behaviour through an
 * open gate. Absence of a reader is a statement about the WIRING; wiring cannot
 * widen authority, and it certainly cannot impersonate the one fact that is
 * allowed to skip the gate — a DECIDED pre-v3 (v1/v2) binding answering
 * `undefined` from the reader, which A5-12 keeps as the only existential skip
 * (leg N5 pins that this commit left it standing).
 *
 * So the refusal is typed as the CONTEXT fault it is:
 * `PERMISSION_EFFECT_CONTEXT_UNAVAILABLE` with
 * `details.problem === 'authority-ceiling-port-absent'` — never
 * `AUTHORITY_CEILING_INSUFFICIENT`, which would put an authorization verdict on
 * a ceiling nobody read (A3-3's error-identity law) and would feed the A4-PR5
 * proposal catch, minting a durable proposal out of an unread document.
 *
 * ---------------------------------------------------------------------------
 * WHY THE REFUSAL IS RISE-SCOPED
 * ---------------------------------------------------------------------------
 * A batch that REMOVES authority commits even here (leg N2). Refusing
 * tightenings would trade one unsound default for another — it would make a
 * mis-wired lane unable to revoke anything, and it would teach operators to
 * delete the lane rather than wire it. The classification is run with the same
 * pure inputs the port-present branch uses, so "is this batch rising?" is
 * answered identically on both sides of the flip; and when the classification
 * itself cannot answer (subtree relations with no predicate injected) ITS
 * refusal propagates as itself (leg N4), because a lane that cannot establish
 * that it is not rising has not established anything.
 *
 * Every leg drives the real `createGovernanceMutationService` against a stub
 * overlay port that COUNTS appends, so "zero write" is measured, not asserted
 * from the throw.
 */
import { describe, expect, it } from 'vitest'
import { createTeamOperationCoordinator } from '../coordination/index.js'
import { PERMISSION_MUTATION_ERROR_CODES } from '../governance/permission-mutation.js'
import { createGovernanceMutationService } from '../governance/index.js'
import type { AuthorityEnvelopeDocuments } from '../governance/authority-ceiling.js'
import type {
  GovernanceMutationServiceDeps,
  GovernancePermissionMutationArgs,
  PermissionMutationEnvelope,
} from '../governance/index.js'
import type { OverrideRecordView, OverrideStorePort, PolicyReader } from '../mutation/index.js'
import type { PolicyStateTransitionRecord } from '../mutation/types.js'
import type {
  GovernanceTransitionCache,
  GovernanceTransitionCommit,
  PermissionAuthorityCeilingContext,
} from '../governance/types.js'
import { FIXTURE_INSTANCE_ID, FIXTURE_TEAM_SESSION_ID } from './permission-overlay-helpers.js'

const NOW = '2026-10-08T00:00:00.000Z'
/** The cell every leg mutates. A FINGERPRINT matcher is deliberate: the algebra
 *  is decidable with no workspace and no subtree predicate, so a leg that
 *  expects a refusal can only be refused by the ceiling law — never by the
 *  classification's own missing-predicate refusal (which leg N4 wants on
 *  purpose, with a subtree matcher). */
const CELL = `sha256:${'a'.repeat(64)}`
const DECLARED_NONE = { layers: [] }

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
  readBlueprintEnvelope: (): never => {
    throw new Error('the permission lane must not read the capability envelope')
  },
  readTemplatePolicy: (): never => {
    throw new Error('the permission lane must not read template policy')
  },
  readExternalFacts: (): never => {
    throw new Error('the permission lane must not read external hard facts')
  },
}

/** The documents a FULLY wired v3 lane would answer, reused so that the only
 *  difference between a control lane and the lane under test is the PORT. */
const COVERING: PermissionMutationEnvelope = {
  rules: [{ operationClass: 'bash', matcher: { kind: 'fingerprint', resource: CELL }, maximumEffect: 'allow' }],
}

type CeilingWiring =
  /** The branch under test: no port on the lane at all. */
  | { readonly kind: 'absent-port' }
  /** The one answer allowed to skip the gate: the reader's existential NO for a
   *  DECIDED pre-v3 binding. */
  | { readonly kind: 'reader-answers-undefined' }
  /** Control: a fully wired lane whose documents cover the rise. */
  | { readonly kind: 'wired-covering' }

/**
 * One service, one counted overlay, three wirings.
 *
 * `appends()` is the durable-effect witness: every refusal leg must leave it
 * empty, and the commit legs must leave exactly one snapshot in it.
 */
function openLaneWorld(
  wiring: CeilingWiring,
  options: { readonly injectSubtreePredicate?: boolean } = {},
) {
  const appended: unknown[] = []
  const documents: AuthorityEnvelopeDocuments = {
    teamHardEnvelope: { status: 'declared', document: COVERING } as AuthorityEnvelopeDocuments['teamHardEnvelope'],
    permissionMutationEnvelope: {
      status: 'declared',
      document: COVERING,
    } as AuthorityEnvelopeDocuments['permissionMutationEnvelope'],
  }
  const lane: GovernanceMutationServiceDeps['permissionLane'] = {
    overlay: {
      latest: async () => undefined,
      append: async (input: unknown) => {
        appended.push(input)
        return input
      },
    } as never,
    permissionEnvelope: () => COVERING,
    staticLayers: () => DECLARED_NONE,
    ...(options.injectSubtreePredicate === false
      ? {}
      : { subtreeContains: (root: string, child: string) => child === root || child.startsWith(`${root}/`) }),
    ...(wiring.kind === 'absent-port'
      ? {}
      : {
          authorityCeiling: async (
            _team: string,
            _member: string,
            actor: 'leader' | 'human',
          ): Promise<PermissionAuthorityCeilingContext | undefined> =>
            wiring.kind === 'reader-answers-undefined'
              ? undefined
              : {
                  beneficiaryAuthority: 'member',
                  initiatorAuthority: actor === 'leader' ? 'leader' : 'human-user',
                  documents,
                  blueprintContentHash: `sha256:${'c'.repeat(64)}`,
                },
        }),
  }
  const service = createGovernanceMutationService({
    chain: createTeamOperationCoordinator(),
    overrides: new NoopOverrides(),
    transitions: new NoopTransitions(),
    transitionCommit: new NoopCommit(),
    policy: NEVER_CONSULTED,
    registeredMembers: async () => [],
    policyStates: () => ['default'],
    now: () => NOW,
    permissionLane: lane,
  })
  let counter = 0
  const mutate = (
    rules: readonly { operationClass: string; matcher: unknown; effect: 'allow' | 'ask' | 'deny' }[],
    actor: 'operator' | 'leader' = 'operator',
  ) =>
    service.mutatePermission({
      authority: actor === 'leader' ? { kind: 'leader' } : { kind: 'operator' },
      teamSessionId: FIXTURE_TEAM_SESSION_ID,
      memberInstanceId: FIXTURE_INSTANCE_ID,
      kind: 'grant_instance',
      mutationId: `mut-a474np-${String(++counter)}`,
      reason: 'a4-74 fail-closed lane: no ceiling port is not an absent ceiling',
      rules,
    } as unknown as GovernancePermissionMutationArgs)
  return {
    /** A batch that RAISES the effective effect at CELL (statics deny, grant allows). */
    rise: (actor?: 'operator' | 'leader') =>
      mutate([{ operationClass: 'bash', matcher: { kind: 'fingerprint', resource: CELL }, effect: 'allow' }], actor),
    /** A batch that REMOVES authority at the same cell (statics deny, so nothing
     *  rises: the ceiling question does not arise at all). */
    tighten: () =>
      mutate([{ operationClass: 'bash', matcher: { kind: 'fingerprint', resource: CELL }, effect: 'deny' }]),
    /** A subtree-shaped rise on a lane with NO containment predicate. The class
     *  is `write` because the exec family is fingerprint-ONLY (a subtree matcher
     *  on `bash` is malformed input, not an unknown relation — a leg that
     *  confuses the two is measuring the parser). */
    riseUndecidable: () =>
      mutate([{ operationClass: 'write', matcher: { kind: 'subtree', resource: '/srv/a474-noport' }, effect: 'allow' }]),
    appends: () => appended.length,
  }
}

async function refusalOf(run: Promise<unknown>): Promise<Record<string, unknown>> {
  try {
    const result = await run
    throw new Error(`expected a refusal, got a commit: ${JSON.stringify(result)}`)
  } catch (error) {
    const shaped = error as { code?: string; message?: string; details?: Record<string, unknown> }
    if (shaped.code === undefined) throw error
    return { code: shaped.code, message: shaped.message ?? '', ...(shaped.details ?? {}) }
  }
}

describe('A4-PR7 §7.5 prerequisite 3 — a lane with no authority-ceiling port refuses a rise (it does not commit it)', () => {
  it('N1 a rising batch on a port-less lane REFUSES with the CONTEXT code and the port-absent problem, and appends NOTHING', async () => {
    const w = openLaneWorld({ kind: 'absent-port' })
    const refusal = await refusalOf(w.rise())
    expect(refusal['code'], JSON.stringify(refusal)).toBe(PERMISSION_MUTATION_ERROR_CODES.EFFECT_CONTEXT_UNAVAILABLE)
    // The context label, never the authorization label: the remedy is "wire the
    // ceiling", not "ask a higher rung" (A3-3).
    expect(refusal['code']).not.toBe(PERMISSION_MUTATION_ERROR_CODES.AUTHORITY_CEILING_INSUFFICIENT)
    expect(refusal['problem']).toBe('authority-ceiling-port-absent')
    // The refusal is LOCALISED: the operator is told which cell rose unassessed.
    expect(String(refusal['message'])).toContain('no authority-ceiling reader')
    expect(refusal['appends'] ?? w.appends()).toBe(0)
    expect(w.appends()).toBe(0)
  })

  it('N2 the same port-less lane still COMMITS a tightening (the refusal is rise-scoped, not a lane-wide ban)', async () => {
    const w = openLaneWorld({ kind: 'absent-port' })
    const committed = await w.tighten()
    expect((committed as { changed?: boolean }).changed).toBe(true)
    expect(w.appends()).toBe(1)
  })

  it('N3 the refusal is not actor-scoped: a LEADER whose carrier covers the cell is refused too (wiring cannot widen)', async () => {
    // The carrier covers the rise, so the Alpha.3 aggregate is satisfied and the
    // ONLY thing left standing is the ceiling — which this lane never asked.
    const w = openLaneWorld({ kind: 'absent-port' })
    const refusal = await refusalOf(w.rise('leader'))
    expect(refusal['code'], JSON.stringify(refusal)).toBe(PERMISSION_MUTATION_ERROR_CODES.EFFECT_CONTEXT_UNAVAILABLE)
    expect(refusal['problem']).toBe('authority-ceiling-port-absent')
    expect(w.appends()).toBe(0)
  })

  it('N4 when the classification itself cannot answer, ITS refusal propagates as itself — never relabelled as the port-absent fault', async () => {
    // A subtree matcher with no containment predicate: the lane cannot even
    // establish that it is not rising, and the refusal the operator deserves is
    // `subtree-relation-unknown` (inject the predicate), not "wire a ceiling".
    const w = openLaneWorld({ kind: 'absent-port' }, { injectSubtreePredicate: false })
    const refusal = await refusalOf(w.riseUndecidable())
    expect(refusal['code']).toBe(PERMISSION_MUTATION_ERROR_CODES.EFFECT_CONTEXT_UNAVAILABLE)
    expect(refusal['problem']).not.toBe('authority-ceiling-port-absent')
    expect(refusal['problem']).toBe('subtree-relation-unknown')
    expect(w.appends()).toBe(0)
  })

  it('N5 the ONLY answer that may still skip the gate is the reader existential NO for a pre-v3 binding, and it is untouched (A5-12)', async () => {
    // Not an endorsement of that branch — a PIN that THIS commit did not quietly
    // widen it into the port-absent case. Its production reachability after the
    // §7.3 flip is a separate ruling, recorded in 7-4-failclosed/HANDOFF.md.
    const w = openLaneWorld({ kind: 'reader-answers-undefined' })
    const committed = await w.rise()
    expect((committed as { changed?: boolean }).changed).toBe(true)
    expect(w.appends()).toBe(1)
  })

  it('N6 the control that makes N1 mean something: the SAME rise on a fully wired lane commits, so the refusal is caused by the missing port', async () => {
    const w = openLaneWorld({ kind: 'wired-covering' })
    const committed = await w.rise()
    expect((committed as { changed?: boolean }).changed).toBe(true)
    expect(w.appends()).toBe(1)
  })
})
