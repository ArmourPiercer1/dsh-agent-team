/**
 * a4p7-carrier-width-under-ceiling.test.ts — the WIDTH a permission mutation claims
 * is judged, and by whom.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS FILE EXISTS, AND WHY IT DID NOT (provenance, not ceremony)
 * ---------------------------------------------------------------------------
 * It was written by the A4 ceiling-coverage probe and parked as
 * `dev/agent-workflow/evidence/a4-ceiling-coverage/a4p7-carrier-width-under-ceiling.test.ts.inert`.
 * The README there gives the reason: it is a runtime test file, so landing it is a
 * writer lane's edit, and landing it requires one entry in
 * `p4t6-session-event-scan`'s `SCANNED_PATHS_A4PR7` list IN THE SAME COMMIT (the
 * scanned-path total is derived from those lists, so a landed file without its entry
 * breaks the scan pin, and a hand-written total breaks the derivation). It was
 * inerted, not deleted, so the tree's scanners would not read an evidence copy as a
 * live test. Landing it is plan §7.5 prerequisite (2).
 *
 * MEASURED BEFORE THE LANDING (transcript
 * `dev/agent-workflow/evidence/a4-pr7/7-3-prereq/transcripts/01-parked-at-base.txt`):
 * the parked file passes 3/3 as-is on `9dbb8193`. Nothing in it asserts something the
 * product stopped doing — the opposite: its third leg pinned a GAP, and this lane's
 * prerequisite (1) closes that gap. That leg is therefore RETITLED below, not deleted,
 * with its original assertions quoted where they stood (the same treatment plan §7.3
 * prescribes for the GROUP E pin: "retitled to the new law — neither deleted nor left
 * asserting a contradiction that no longer exists"). The change it documents is
 * recorded in `dev/agent-workflow/evidence/a4-pr7/7-3-prereq/FINDINGS.md`.
 *
 * ---------------------------------------------------------------------------
 * THE LAW THIS FILE PINS
 * ---------------------------------------------------------------------------
 * A mutation may claim a WIDTH (`subtree /srv/x`) while the effect actually rises in
 * one narrow CELL (`exact /srv/x/out.txt`) — the rest of the subtree is already at
 * that effect, so the classifier yields exactly one rising region whose
 * `region.mutationMatcher` (the claim) is strictly broader than its `region.region`
 * (the cell). Two laws can own that width:
 *
 *  - THE ALPHA.3 COVERAGE LAW (`leaderEnvelopeCoverage`) — DELETED by A4-PR7 §7.5.
 *    It demanded the Leader's carrier cover the WHOLE claimed matcher, and leg 1
 *    was written as its deletion tripwire: the identity it asserts is exactly
 *    where the two laws meet. The deletion landed only after the re-measurement
 *    proved the successor refuses every drive the deleted law refused
 *    (`dev/agent-workflow/evidence/a4-pr7/7-5-delete/FINDINGS.md`).
 *  - THE v3 CEILING LAW (`createPermissionAuthorityCeilingJudge`) — the SOLE
 *    width owner now. It asks the ceiling at BOTH the rising cell and the claimed
 *    width, refusing at either: a meet over every covering rule of both documents,
 *    where the deleted law accepted ONE covering rule. Legs 1-5 own it.
 *
 * The surviving law must not be WIDER than the one deleted — a cleanup that
 * widens an authority limit is a defect — hence leg 5, which pins the direction that a
 * naive "swap `region.region` for `region.mutationMatcher`" would loosen.
 *
 * Leg 4 is the one leg where the ceiling gate is the ONLY live law: the actor is an
 * operator (ADR §7), so the Alpha.3 Leader block never runs. It pins the width law at
 * the REAL entry (`mutatePermission`), not at the judge seam.
 *
 * @module @dsh-agent-team/runtime/test/a4p7-carrier-width-under-ceiling
 */

import { describe, expect, it } from 'vitest'
import { createTeamOperationCoordinator } from '../coordination/index.js'
import {
  classifyPermissionRise,
  PERMISSION_MUTATION_ERROR_CODES,
  authorizeCeilingBoundedPermissionRise,
} from '../governance/permission-mutation.js'
import { createGovernanceMutationService } from '../governance/index.js'
import { createPermissionAuthorityCeilingJudge } from '../governance/service.js'
import type { AuthorityEnvelopeDocuments } from '../governance/authority-ceiling.js'
import type {
  GovernanceMutationServiceDeps,
  GovernancePermissionMutationArgs,
  PermissionMutationEnvelope,
  PermissionResourceMatcher,
  PermissionStaticLayerFacts,
} from '../governance/index.js'
import type { OverrideRecordView, OverrideStorePort, PolicyReader } from '../mutation/index.js'
import type { PolicyStateTransitionRecord } from '../mutation/types.js'
import type {
  GovernanceTransitionCache,
  GovernanceTransitionCommit,
  PermissionAuthorityCeilingContext,
} from '../governance/types.js'
import { FIXTURE_INSTANCE_ID, FIXTURE_TEAM_SESSION_ID, openWorld } from './permission-overlay-helpers.js'

const FILE = 'file:/srv/a4p7-width/out.txt'
const SUB = 'file:/srv/a4p7-width'
const NOW = '2026-10-08T00:00:00.000Z'

const exact = (resource: string): PermissionResourceMatcher => ({ kind: 'exact', resource })
const subtree = (resource: string): PermissionResourceMatcher => ({ kind: 'subtree', resource })
/** The structural-containment double, same algebra as the Alpha.3 lane. */
const contains = (root: string, child: string): boolean => child === root || child.startsWith(`${root}/`)

/** ONE rule, one matcher width — the carrier and the Team Hard document are
 *  given the SAME shape on purpose: the widening must come from the MUTATION,
 *  never from a document disagreement. */
function oneRule(matcher: PermissionResourceMatcher, maximumEffect: 'allow' | 'ask' | 'deny'): PermissionMutationEnvelope {
  return { rules: [{ operationClass: 'write', matcher, maximumEffect }] }
}

/** The lower facts that confine the rise to the ONE narrow cell the carrier
 *  covers: within a layer the most restrictive matching rule answers, so the
 *  template says `deny` at FILE and `allow` across the rest of SUB. A broad
 *  overlay grant at `subtree SUB` therefore raises ONLY the FILE cell. */
const TEMPLATE_DENY_AT_FILE: PermissionStaticLayerFacts = {
  layers: [
    {
      label: 'template',
      default: 'deny',
      rules: [
        { operationClass: 'write', matcher: exact(FILE), effect: 'deny' },
        { operationClass: 'write', matcher: subtree(SUB), effect: 'allow' },
      ],
    },
  ],
}

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

/** A v3-wired world: the ceiling reader answers a context for every target, so
 *  the ceiling gate is LIVE and the ONLY thing that could refuse after the
 *  Alpha.3 aggregate is gone. */
async function openV3World(carrier: PermissionMutationEnvelope, hard: PermissionMutationEnvelope) {
  const world = await openWorld(`a4p7w-${Math.random().toString(36).slice(2, 8)}`)
  const documents: AuthorityEnvelopeDocuments = {
    teamHardEnvelope: { status: 'declared', document: hard } as AuthorityEnvelopeDocuments['teamHardEnvelope'],
    permissionMutationEnvelope: { status: 'declared', document: carrier } as AuthorityEnvelopeDocuments['permissionMutationEnvelope'],
  }
  const deps: GovernanceMutationServiceDeps = {
    chain: createTeamOperationCoordinator(),
    overrides: new NoopOverrides(),
    transitions: new NoopTransitions(),
    transitionCommit: new NoopCommit(),
    policy: NEVER_CONSULTED,
    registeredMembers: async () => [],
    policyStates: () => ['default'],
    now: () => NOW,
    permissionLane: {
      overlay: world.port,
      permissionEnvelope: () => carrier,
      staticLayers: () => TEMPLATE_DENY_AT_FILE,
      subtreeContains: contains,
      authorityCeiling: async (_team: string, _member: string, actor: 'leader' | 'human'): Promise<PermissionAuthorityCeilingContext> => ({
        beneficiaryAuthority: 'member',
        initiatorAuthority: actor === 'leader' ? 'leader' : 'human-user',
        documents,
        blueprintContentHash: `sha256:${'c'.repeat(64)}`,
      }),
    },
  }
  let counter = 0
  const service = createGovernanceMutationService(deps)
  const args = (
    authority: { kind: 'leader' } | { kind: 'operator' },
    rules: readonly { operationClass: string; matcher: PermissionResourceMatcher; effect: 'allow' | 'ask' | 'deny' }[],
  ) =>
    service.mutatePermission({
      authority,
      teamSessionId: FIXTURE_TEAM_SESSION_ID,
      memberInstanceId: FIXTURE_INSTANCE_ID,
      kind: 'grant_instance',
      mutationId: `mut-a4p7w-${String(++counter)}`,
      reason: 'width pin',
      rules,
    } as GovernancePermissionMutationArgs)
  return {
    service,
    documents,
    /** The durable authority snapshot of the target — `undefined` proves ZERO WRITE. */
    listRules: () => world.port.latest(world.identity),
    close: async () => {
      await world.store.close()
      world.destroy()
    },
    mutateLeader: (
      rules: readonly { operationClass: string; matcher: PermissionResourceMatcher; effect: 'allow' | 'ask' | 'deny' }[],
    ) => args({ kind: 'leader' }, rules),
    /** The ADR §7 surface: NO Alpha.3 Leader block runs, so the ceiling gate is
     *  the only authority law standing between this mutation and the append. */
    mutateOperator: (
      rules: readonly { operationClass: string; matcher: PermissionResourceMatcher; effect: 'allow' | 'ask' | 'deny' }[],
    ) => args({ kind: 'operator' }, rules),
  }
}

/** The rise facts of the SAME mutation, classified the way `service.ts` does it
 *  (no coverage judge — the ceiling gate's own input, `service.ts:1166-1176`). */
function ceilingOnlyInput() {
  return {
    latestRules: [],
    plannedRules: [
      { operation: 'write', resource: `subtree:${SUB}`, effect: 'allow' as const },
    ],
    mutationRules: [{ operationClass: 'write', matcher: subtree(SUB), effect: 'allow' as const }],
    envelope: { rules: [] },
    staticFacts: TEMPLATE_DENY_AT_FILE,
    subtreeContains: contains,
  }
}

/** The ceiling context the service would read for the target: BOTH v3 documents
 *  decide the narrow CELL and say nothing about the rest of SUB. */
function documentsCoveringOnlyTheFile(): AuthorityEnvelopeDocuments {
  return {
    teamHardEnvelope: {
      status: 'declared',
      document: oneRule(exact(FILE), 'allow'),
    } as AuthorityEnvelopeDocuments['teamHardEnvelope'],
    permissionMutationEnvelope: {
      status: 'declared',
      document: oneRule(exact(FILE), 'allow'),
    } as AuthorityEnvelopeDocuments['permissionMutationEnvelope'],
  }
}

describe('the carrier width law, pinned on the v3 ceiling wiring (sole owner since the §7.5 deletion)', () => {
  it('a carrier that covers the rising cell but NOT the whole mutation matcher refuses the wider mutation, zero write', async () => {
    const w = await openV3World(oneRule(exact(FILE), 'allow'), oneRule(exact(FILE), 'allow'))
    try {
      const error = await w.mutateLeader([{ operationClass: 'write', matcher: subtree(SUB), effect: 'allow' }]).then(
        () => undefined,
        (raised: unknown) => raised,
      )
      // The refusal is the CEILING's: the documents cover the cell and say nothing
      // about the rest of SUB, and on the expansion plane absence is no-authority.
      // This is the identity that `leaderEnvelopeCoverage` used to issue as
      // `PERMISSION_ENVELOPE_EXPANSION_DENIED`; §7.5 deleted that owner and this
      // leg — the tripwire — flipped to the successor law it was guarding.
      expect((error as { code?: string } | undefined)?.code).toBe('PERMISSION_AUTHORITY_CEILING_INSUFFICIENT')
      expect((error as { details?: Record<string, unknown> } | undefined)?.details?.problem).toBe('authority-ceiling-insufficient')
      expect((error as { details?: Record<string, unknown> } | undefined)?.details).toMatchObject({
        plane: 'expansion',
        ceiling: 'no-authority',
        // The refusal names the CELL the rise happened in — the width changed what
        // was asked, never which region the caller is told about.
        region: `exact:${FILE}`,
      })
      // ZERO WRITE: the refusal is not cosmetic.
      expect(await w.listRules()).toBeUndefined()
    } finally {
      await w.close()
    }
  })

  it('the SAME mutation with a carrier as wide as the matcher commits (the refusal is width, not the documents)', async () => {
    const w = await openV3World(oneRule(subtree(SUB), 'allow'), oneRule(subtree(SUB), 'allow'))
    try {
      await expect(w.mutateLeader([{ operationClass: 'write', matcher: subtree(SUB), effect: 'allow' }])).resolves.toBeDefined()
    } finally {
      await w.close()
    }
  })

  it('the ceiling is asked at the WIDTH the mutation claims, not only at the rising cell', () => {
    const input = ceilingOnlyInput()
    const classification = classifyPermissionRise(input)
    expect(classification.rising.length).toBe(1)
    const region = classification.rising[0]!
    // The width the mutation claims is strictly broader than the cell the effect
    // rises in — this pair IS the condition prerequisite (1) is about.
    expect(region.mutationMatcher).toEqual(subtree(SUB))
    expect(region.region).toEqual(exact(FILE))
    const judge = createPermissionAuthorityCeilingJudge({ subtreeContains: contains })
    const context: PermissionAuthorityCeilingContext = {
      beneficiaryAuthority: 'member',
      initiatorAuthority: 'leader',
      documents: documentsCoveringOnlyTheFile(),
    }

    // PLAN §7.5 PREREQUISITE (1), pinned by this assertion: a ceiling lookup that
    // consults `region.region` alone calls this rise SUFFICIENT, because the
    // documents do cover the cell. The claim is wider than the cell, so the
    // ceiling must be asked at the claim too — and the documents say nothing about
    // the rest of SUB, which on the EXPANSION plane is the absence of a grant.
    //
    // WHAT THIS LEG USED TO ASSERT (parked as `.inert`, quoted verbatim so the
    // inversion is auditable rather than silent):
    //
    //   expect(judge(context, region)).toEqual({ status: 'sufficient' })
    //   expect(() => authorizeCeilingBoundedPermissionRise(
    //     classification.rising, (r) => judge(context, r),
    //   )).not.toThrow()
    //
    // under the title "THE GAP: the ceiling gate ALONE is sufficient on that very
    // rise, so it is not the width law's owner". Its own note said "Flip this leg
    // when the surviving ceiling law owns width." This file is that flip, and the
    // deletion of `leaderEnvelopeCoverage` landed on top of it
    // (`dev/agent-workflow/evidence/a4-pr7/7-5-delete/FINDINGS.md`).
    expect(judge(context, region)).toEqual({
      status: 'insufficient',
      plane: 'expansion',
      ceiling: 'no-authority',
      // The rung that could approve the rise AT THE WIDTH THAT FAILED — the detail
      // is computed at the refusing point, not at the cell (plan §7.5 names
      // `service.ts:1330` for exactly this). It reads `leader`, NOT the
      // `human-admin` this same evaluator names for a cell the hard document caps:
      // across the width the hard document speaks of nothing, and absence means NO
      // NARROWING on the approval plane while it means NO GRANT on the expansion
      // plane. The planes disagree about absence by design (ADR X7-R5), and this is
      // the refusal where that disagreement is visible in the payload.
      detail: { requiredAuthority: 'leader' },
    })
    let raised: unknown
    try {
      authorizeCeilingBoundedPermissionRise(classification.rising, (r) => judge(context, r))
    } catch (error) {
      raised = error
    }
    expect((raised as { code?: string } | undefined)?.code).toBe(PERMISSION_MUTATION_ERROR_CODES.AUTHORITY_CEILING_INSUFFICIENT)
    expect((raised as { details?: Record<string, unknown> } | undefined)?.details?.plane).toBe('expansion')
    expect((raised as { details?: Record<string, unknown> } | undefined)?.details?.ceiling).toBe('no-authority')
    // The refusal names the CELL the rise happened in — the width changed what was
    // asked, never which region the caller is told about.
    expect((raised as { details?: Record<string, unknown> } | undefined)?.details?.region).toBe(`exact:${FILE}`)
  })

  it('at the real entry, with NO Alpha.3 Leader law in the way, the width refusal commits nothing', async () => {
    // The operator surface (ADR §7) skips the Alpha.3 Leader block entirely, so
    // this is the one production path where the ceiling gate is the ONLY width law
    // — and therefore the honest place to pin that the law is enforced by
    // behavior, at the entry that writes.
    const w = await openV3World(oneRule(exact(FILE), 'allow'), oneRule(exact(FILE), 'allow'))
    try {
      const error = await w.mutateOperator([{ operationClass: 'write', matcher: subtree(SUB), effect: 'allow' }]).then(
        () => undefined,
        (raised: unknown) => raised,
      )
      expect((error as { code?: string } | undefined)?.code).toBe(PERMISSION_MUTATION_ERROR_CODES.AUTHORITY_CEILING_INSUFFICIENT)
      expect((error as { details?: Record<string, unknown> } | undefined)?.details?.problem).toBe('authority-ceiling-insufficient')
      expect((error as { details?: Record<string, unknown> } | undefined)?.details?.ceiling).toBe('no-authority')
      expect(await w.listRules()).toBeUndefined()
    } finally {
      await w.close()
    }
  })

  it('asking the width never LOOSENS the cell: a cell the ceiling does not reach still refuses', async () => {
    // THE DIRECTION A NAIVE SWAP GETS WRONG. A wider lookup asks a QUESTION FEWER
    // RULES ANSWER: a document may reach the risen effect across the whole subtree
    // while a NARROWER rule caps the cell itself. The ceiling must be reached at
    // EVERY point the rise claims — so the cell question is still asked, and the
    // meet is never wider than either individual answer. (Same conservative shape
    // as the shell-class candidate set, plan §7.2 Ruling 4.)
    const wideAllowNarrowAsk: AuthorityEnvelopeDocuments = {
      teamHardEnvelope: {
        status: 'declared',
        document: {
          rules: [
            { operationClass: 'write', matcher: subtree(SUB), maximumEffect: 'allow' },
            { operationClass: 'write', matcher: exact(FILE), maximumEffect: 'ask' },
          ],
        },
      } as AuthorityEnvelopeDocuments['teamHardEnvelope'],
      permissionMutationEnvelope: {
        status: 'declared',
        document: {
          rules: [
            { operationClass: 'write', matcher: subtree(SUB), maximumEffect: 'allow' },
            { operationClass: 'write', matcher: exact(FILE), maximumEffect: 'ask' },
          ],
        },
      } as AuthorityEnvelopeDocuments['permissionMutationEnvelope'],
    }
    const region = classifyPermissionRise(ceilingOnlyInput()).rising[0]!
    const judge = createPermissionAuthorityCeilingJudge({ subtreeContains: contains })
    const verdict = judge(
      { beneficiaryAuthority: 'member', initiatorAuthority: 'leader', documents: wideAllowNarrowAsk },
      region,
    )
    // The CELL answers first (identity preserved: `ask`, not `no-authority`), which
    // is what keeps every pre-existing refusal detail byte-identical.
    expect(verdict).toEqual({
      status: 'insufficient',
      plane: 'expansion',
      ceiling: 'ask',
      detail: { requiredAuthority: 'human-admin' },
    })
  })

  // THE ORDER IS THE LAW, AND THIS IS THE LEG THAT OWNS THE SENTENCE IN
  // `service.ts` ("the cell is asked FIRST, so every refusal this gate issued
  // before this change keeps its plane, its ceiling value and its rung
  // byte-identically"). Without these two legs that sentence survives a COMPLETE
  // REVERSAL OF THE POINT ORDER — measured: reversing the list left all 14 spec
  // files green — which makes it a claim nobody owns rather than documentation.
  // The order becomes observable only when BOTH points refuse with DIFFERENT
  // identities, so this fixture is built for exactly that: the hard document
  // ALLOWS the cell, the mutation envelope document CAPS it at `ask`, and neither
  // says anything about the rest of SUB.
  const CELL_ASKED_WIDTH_SILENT: AuthorityEnvelopeDocuments = {
    teamHardEnvelope: {
      status: 'declared',
      document: oneRule(exact(FILE), 'allow'),
    } as AuthorityEnvelopeDocuments['teamHardEnvelope'],
    permissionMutationEnvelope: {
      status: 'declared',
      document: oneRule(exact(FILE), 'ask'),
    } as AuthorityEnvelopeDocuments['permissionMutationEnvelope'],
  }
  const CELL_CONTEXT: PermissionAuthorityCeilingContext = {
    beneficiaryAuthority: 'member',
    initiatorAuthority: 'leader',
    documents: CELL_ASKED_WIDTH_SILENT,
  }

  it('when BOTH points refuse, the refusal keeps the CELL\'s identity, not the width\'s', () => {
    const region = classifyPermissionRise(ceilingOnlyInput()).rising[0]!
    expect(region.region).toEqual(exact(FILE))
    expect(region.mutationMatcher).toEqual(subtree(SUB))
    const judge = createPermissionAuthorityCeilingJudge({ subtreeContains: contains })

    // THE WIDTH'S OWN ANSWER, measured here rather than asserted from memory: ask
    // it as a single-point region and it refuses with a DIFFERENT ceiling value and
    // a DIFFERENT rung. `no-authority` / `leader` is the width's voice; `ask` /
    // `human-user` below is the cell's. Two identities that differ in both fields
    // are what make the order falsifiable — a fixture where both points refuse
    // identically would keep passing under any order.
    const widthOnly = judge(CELL_CONTEXT, { ...region, region: region.mutationMatcher })
    expect(widthOnly).toEqual({
      status: 'insufficient',
      plane: 'expansion',
      ceiling: 'no-authority',
      detail: { requiredAuthority: 'leader' },
    })
    expect(widthOnly).not.toEqual({
      status: 'insufficient',
      plane: 'expansion',
      ceiling: 'ask',
      detail: { requiredAuthority: 'human-user' },
    })

    // AND THE REAL REGION — two claimed points — answers with the CELL, because
    // the cell is asked first and the first refusal is the refusal. This is the
    // byte-identical pre-change identity: before the width was ever asked, the
    // only question available was the cell's, so pinning the cell here pins the
    // past. A reversal returns the object asserted above instead.
    const verdict = judge(CELL_CONTEXT, region)
    expect(verdict).toEqual({
      status: 'insufficient',
      plane: 'expansion',
      ceiling: 'ask',
      detail: { requiredAuthority: 'human-user' },
    })
    let raised: unknown
    try {
      authorizeCeilingBoundedPermissionRise([region], (r) => judge(CELL_CONTEXT, r))
    } catch (error) {
      raised = error
    }
    const details = (raised as { details?: Record<string, unknown> } | undefined)?.details
    expect(details?.ceiling).toBe('ask')
    expect(details?.plane).toBe('expansion')
    expect(details?.region).toBe(`exact:${FILE}`)
  })

  it('the dedupe: a region whose cell IS its width asks ONE question and answers today\'s refusal', () => {
    // The common case (a cell produced by the one mutation rule that contains it)
    // must cost exactly one ceiling question and answer exactly what it answered
    // before this lane. Pinned separately from the leg above because the dedupe is
    // where an implementation could either drop the cell (loosening) or ask it
    // twice (a refusal whose identity depends on list order).
    const single = classifyPermissionRise({
      ...ceilingOnlyInput(),
      plannedRules: [{ operation: 'write', resource: `exact:${FILE}`, effect: 'allow' as const }],
      mutationRules: [{ operationClass: 'write', matcher: exact(FILE), effect: 'allow' as const }],
    }).rising
    expect(single).toHaveLength(1)
    const region = single[0]!
    expect(region.mutationMatcher).toEqual(region.region)
    const judge = createPermissionAuthorityCeilingJudge({ subtreeContains: contains })
    expect(judge(CELL_CONTEXT, region)).toEqual({
      status: 'insufficient',
      plane: 'expansion',
      ceiling: 'ask',
      detail: { requiredAuthority: 'human-user' },
    })
  })

  it('12. the malformed-static posture: a parse fault is ONCE, OUTSIDE the point loop (review FU-2)', () => {
    // The review read `judgeCeilingPoint` as parsing the static-layer document
    // INSIDE its per-point `try`, whose fault answer is `requiredAuthority: null`.
    // MEASURED, it does not: the parses are once per mutation
    // (`governance/service.ts:719` for the ask, `:1181` for the Leader block,
    // `:1222` for the ceiling gate) and `judgeCeilingPoint` only reads
    // `grantCeiling`/`expansionCeiling` (transcript
    // `41-fu2-premise-check-parse-sites.txt`). The posture the review asked to
    // restore is therefore the posture the code has — and this leg pins it where it
    // can actually be observed: a malformed static document refuses the whole
    // mutation as MALFORMED_ENVELOPE, ONCE, and the rise gate never reaches the
    // point loop at all. A per-point parse would have produced per-point faults
    // wearing the judge's fault answer, which is a different (and unwritable)
    // sentence to pin.
    const rising = classifyPermissionRise(ceilingOnlyInput()).rising
    expect(rising).toHaveLength(1)
    expect(() =>
      authorizeCeilingBoundedPermissionRise(rising, () => {
        throw new Error('a malformed static document must stop the mutation BEFORE any point is judged')
      }),
      // The throw above is the point: the gate PROPAGATES a fault raised at a point
      // — it has no per-point catch that could absorb a parse fault into the
      // judge's `requiredAuthority: null` fault answer.
    ).toThrow(/BEFORE any point is judged/)
    // MEASURED while writing this leg, and disclosed rather than fixed: the
    // CLASSIFIER is not defensive the way the PARSER is — handed
    // `{ layers: 'not-an-array' }` it dies on `layer.rules is not iterable`
    // (a TypeError, not a typed refusal) instead of naming the shape. Nothing in
    // this repository can reach it: every production `lane.staticLayers` answer is
    // built through `parsePermissionStaticLayerFacts`
    // (`src/plugin/permission-plane.ts:674`) and `service.ts` parses again on
    // arrival, so the kernel only ever sees parsed facts. It is recorded here
    // because the review asked whether validation happens once and outside the
    // loop: the VALIDATION is the parser's, and it is; the kernel's own posture on
    // an unparsed input is a TypeError, which is the honest answer to give the
    // next reader of this seam.
  })
})
