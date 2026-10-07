/**
 * a4p7-ceiling-no-context-refusal.test.ts — A4-PR7 §7.3 prerequisite 3: the
 * ceiling reader's NO-CONTEXT branch is a REFUSAL, never a silent commit.
 *
 * ---------------------------------------------------------------------------
 * THE DEFECT, IN ONE SENTENCE
 * ---------------------------------------------------------------------------
 * `createAuthorityCeilingReader` had two answers — a context, or `undefined` — and
 * `governance/service.ts:1158` read `undefined` as "no v3 ceiling gate for this
 * target" and went straight to the append. But `undefined` was answering TWO
 * different questions: the seam declares `blueprintSchemaVersion` as
 * "`undefined` when the binding is UNKNOWN (no resolvable bound Blueprint)"
 * (`src/plugin/permission-plane.ts:447-455`), so a resolvable v1/v2 Blueprint
 * answers `1` or `2` and NEVER reaches that branch. What reached it was a Team
 * whose binding could not be read at all, and the law it got was the law meant for
 * a Team that has no ceiling documents because it predates them.
 *
 * That is a fail-open, and it is live TODAY on the operator surface: measured on
 * the wiring as shipped (`host.ts:2703` wires this reader unconditionally), a
 * mutation that RISES, for a Team whose bound Blueprint cannot be resolved,
 * arrived with no authority law standing on it at all. The Alpha.3 Leader block
 * (`governance/service.ts:1104`) is `actor === 'leader'` only, so the operator path
 * reached the append with the ceiling gate skipped outright; and for a Leader whose
 * carrier COVERS the claimed cell, Alpha.3 had nothing to refuse either, so the
 * Leader committed under the same unreadable binding (measured: leg 8 below was a
 * commit at base). Where a Leader was caught at all it was caught by
 * `leaderEnvelopeCoverage` — the aggregate A4-PR7 §7.3 DELETES, and only in the
 * narrow case where the carrier fails to cover — so the abstention was one deletion
 * away from being unbounded in every branch (`dev/agent-workflow/evidence/a4-ceiling-coverage/FINDINGS.md` cases
 * (f)/(h): "refused | **COMMITTED** | fail-open inside production wiring").
 *
 * ---------------------------------------------------------------------------
 * THE LAW THIS FILE PINS
 * ---------------------------------------------------------------------------
 * Three answers, and the middle one refuses:
 *   1. a DECIDED v1/v2 binding (1 or 2) → `undefined`, the existential branch,
 *      Alpha.3 behaviour byte-identical (leg 5 — the leg that must stay green, and
 *      the leg that goes red if anyone collapses the two answers again);
 *   2. an UNREADABLE binding (`undefined` version, or a v3 version whose content
 *      hash no longer resolves) → a context whose document slots are BOTH
 *      `unavailable`, which the existing ceiling law turns into
 *      `PERMISSION_EFFECT_CONTEXT_UNAVAILABLE` with ZERO WRITE (legs 1-3);
 *   3. a resolvable v3 binding with its anchor → the real context, unchanged
 *      (leg 6 — the control that proves the refusal is specific, not a blanket).
 *
 * WHY A CONTEXT AND NOT A NEW SIGNAL: `unavailable` is this repository's existing
 * vocabulary for "the read FAULTED: refuse, never widen"
 * (`governance/authority-ceiling.ts:173-175`), and the mapping from it to a refusal
 * already exists and is already pinned (A3-3: an unavailable read must never wear
 * an authorization label). So the ONLY product change is what the reader answers;
 * the refusal law, its code, its ordering after the Leader block, and the
 * no-proposal-from-an-unavailable-read law (the A4-PR5 catch at
 * `governance/service.ts:1186-1193`) are all pre-existing and are re-pinned here
 * rather than restated. And the abstention context carries NO anchor — a refusal
 * mints no fingerprint, so the anchorless-proposal law stays unreachable from
 * production for a stronger reason than the silent skip ever gave.
 *
 * Refusal is asserted BY BEHAVIOUR at the real entry (`mutatePermission` over the
 * durable overlay world): the mutation does not resolve, the durable snapshot is
 * still `undefined`, and a TIGHTENING under the same unreadable binding still
 * commits (leg 4) — otherwise the refusal would punish exactly the mutations that
 * reduce authority, which is the inverted incentive the plan forbids.
 *
 * @module @dsh-agent-team/runtime/test/a4p7-ceiling-no-context-refusal
 */

import { describe, expect, it } from 'vitest'
import { createTeamOperationCoordinator } from '../coordination/index.js'
import { PERMISSION_MUTATION_ERROR_CODES } from '../governance/permission-mutation.js'
import { createGovernanceMutationService } from '../governance/index.js'
import type {
  GovernanceMutationServiceDeps,
  GovernancePermissionMutationArgs,
  PermissionMutationEnvelope,
  PermissionResourceMatcher,
  PermissionStaticLayerFacts,
} from '../governance/index.js'
import type { OverrideRecordView, OverrideStorePort, PolicyReader } from '../mutation/index.js'
import type { PolicyStateTransitionRecord } from '../mutation/types.js'
import type { GovernanceTransitionCache, GovernanceTransitionCommit } from '../governance/types.js'
import { createAuthorityCeilingReader } from '../src/plugin/permission-plane.js'
import type { AuthorityHardCeilingRead } from '../src/plugin/permission-plane.js'
import { FIXTURE_INSTANCE_ID, FIXTURE_TEAM_SESSION_ID, openWorld } from './permission-overlay-helpers.js'

const FILE = 'file:/srv/a4p7-noctx/out.txt'
const OTHER = 'file:/srv/a4p7-noctx/other.txt'
const ANCHOR = `sha256:${'c'.repeat(64)}`
const NOW = '2026-10-08T00:00:00.000Z'

const exact = (resource: string): PermissionResourceMatcher => ({ kind: 'exact', resource })
const contains = (root: string, child: string): boolean => child === root || child.startsWith(`${root}/`)
const oneRule = (resource: string, maximumEffect: 'allow' | 'ask' | 'deny'): PermissionMutationEnvelope => ({
  rules: [{ operationClass: 'write', matcher: exact(resource), maximumEffect }],
})

/** Everything the Team says is `deny`, so a grant at FILE is a RISE on every leg. */
const TEMPLATE_DENY: PermissionStaticLayerFacts = { layers: [{ label: 'template', default: 'deny', rules: [] }] }
/** A static layer's fallback is the closed set `ask | deny` (a static layer may
 *  never DEFAULT to `allow` — `static-layer-fallback-closed-set`), so the
 *  tightening leg grants the one cell it intends to take away, explicitly. */
const TEMPLATE_ALLOW_AT_OTHER: PermissionStaticLayerFacts = {
  layers: [
    {
      label: 'template',
      default: 'deny',
      rules: [{ operationClass: 'write', matcher: exact(OTHER), effect: 'allow' }],
    },
  ],
}

const RISE = [{ operationClass: 'write', matcher: exact(FILE), effect: 'allow' as const }]
const TIGHTEN = [{ operationClass: 'write', matcher: exact(OTHER), effect: 'deny' as const }]

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

/** What the caller controls about the binding: its version and its content hash,
 *  read through the SAME production seam shape `host.ts:849-852` wires
 *  (`(t) => deps.resolveBlueprint(t)?.schemaVersion`, and the same resolution for
 *  the hash). Both are `undefined` for a binding that cannot be resolved — that is
 *  the seam's own documented meaning, not this file's invention. */
interface BindingFacts {
  readonly schemaVersion: number | undefined
  readonly contentHash: string | undefined
}

/**
 * THE REAL ENTRY: the production `createAuthorityCeilingReader` (the same
 * expression `host.ts:2703` wires) inside a real `createGovernanceMutationService`
 * over the real durable overlay port. Nothing here restates the reader's logic.
 */
async function openWorldAtEntry(
  binding: BindingFacts,
  options: {
    readonly staticFacts?: PermissionStaticLayerFacts
    /** Alpha.3's coverage law reads THIS document (`permissionLane.permissionEnvelope`)
     *  for a Leader mutation; it is not a ceiling and the operator path never
     *  consults it. Default covers the claimed cell, so Alpha.3 has nothing to say
     *  and the ceiling gate is the only law left standing. */
    readonly carrier?: PermissionMutationEnvelope
  } = {},
) {
  const world = await openWorld(`a4p7nc-${Math.random().toString(36).slice(2, 8)}`)
  const staticFacts = options.staticFacts ?? TEMPLATE_DENY
  const hardCeiling: AuthorityHardCeilingRead = { status: 'declared', document: oneRule(FILE, 'allow') }
  const carrier: PermissionMutationEnvelope = options.carrier ?? oneRule(FILE, 'allow')
  const facts = {
    blueprintSchemaVersion: () => binding.schemaVersion,
    blueprintContentHash: () => binding.contentHash,
    teamHardEnvelope: async (): Promise<AuthorityHardCeilingRead> => hardCeiling,
    permissionEnvelope: async () => carrier,
  }
  const reader = createAuthorityCeilingReader({ facts })
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
      staticLayers: () => staticFacts,
      subtreeContains: contains,
      authorityCeiling: reader,
    },
  }
  const service = createGovernanceMutationService(deps)
  let counter = 0
  const mutate = (
    authority: { kind: 'leader' } | { kind: 'operator' },
    rules: readonly { operationClass: string; matcher: PermissionResourceMatcher; effect: 'allow' | 'ask' | 'deny' }[],
  ) =>
    service
      .mutatePermission({
        authority,
        teamSessionId: FIXTURE_TEAM_SESSION_ID,
        memberInstanceId: FIXTURE_INSTANCE_ID,
        kind: 'grant_instance',
        mutationId: `mut-a4p7nc-${String(++counter)}`,
        reason: 'no-context refusal pin',
        rules,
      } as GovernancePermissionMutationArgs)
      .then(() => undefined, (raised: unknown) => raised as { code?: string; details?: Record<string, unknown> })
  return {
    reader,
    /** The durable authority snapshot of the target — `undefined` proves ZERO WRITE. */
    listRules: () => world.port.latest(world.identity),
    close: async () => {
      await world.store.close()
      world.destroy()
    },
    /** The ADR §7 surface: the Alpha.3 Leader block never runs, so the ceiling
     *  gate is the ONLY authority law between this mutation and the append. */
    mutateOperator: (rules: typeof RISE | typeof TIGHTEN) => mutate({ kind: 'operator' }, rules),
    mutateLeader: (rules: typeof RISE | typeof TIGHTEN) => mutate({ kind: 'leader' }, rules),
  }
}

/** The binding states this file cares about, spelled once. */
const UNREADABLE: BindingFacts = { schemaVersion: undefined, contentHash: undefined }
const V2_DECIDED: BindingFacts = { schemaVersion: 2, contentHash: undefined }
const V3_WITHOUT_ANCHOR: BindingFacts = { schemaVersion: 3, contentHash: undefined }
const V3_ANCHORED: BindingFacts = { schemaVersion: 3, contentHash: ANCHOR }

describe('the ceiling no-context branch is a refusal (A4-PR7 §7.3 prerequisite 3)', () => {
  it('1. an UNREADABLE binding refuses a rising operator mutation with ZERO WRITE', async () => {
    // THE fail-open, closed. At base this leg is RED on both assertions: the
    // mutation RESOLVES (no error) and the durable snapshot is WRITTEN — the
    // ceiling gate was skipped because the reader answered `undefined`, and the
    // Alpha.3 Leader block does not run for an operator.
    const w = await openWorldAtEntry(UNREADABLE)
    try {
      const error = await w.mutateOperator(RISE)
      expect(error, 'a rise under an unreadable ceiling must not commit').toBeDefined()
      expect(await w.listRules(), 'the refusal must be non-cosmetic: zero write').toBeUndefined()
    } finally {
      await w.close()
    }
  })

  it('2. the refusal is the CONTEXT law, not an authorization law, and it mints nothing', async () => {
    // A3-3's ordering, re-pinned at the entry: a read that FAULTED refuses as
    // `PERMISSION_EFFECT_CONTEXT_UNAVAILABLE` (the remedy is "fix the read"), never
    // as `AUTHORITY_CEILING_INSUFFICIENT` (which would say "ask a higher rung") —
    // and because it is not the insufficient code, the A4-PR5 catch at
    // `governance/service.ts:1186-1193` propagates it instead of minting a durable
    // proposal from documents nobody could read (ADR A1-7).
    const w = await openWorldAtEntry(UNREADABLE)
    try {
      const error = await w.mutateOperator(RISE)
      expect(error?.code).toBe(PERMISSION_MUTATION_ERROR_CODES.EFFECT_CONTEXT_UNAVAILABLE)
      expect(error?.code).not.toBe(PERMISSION_MUTATION_ERROR_CODES.AUTHORITY_CEILING_INSUFFICIENT)
      expect(error?.details?.['authorityCeilingCode']).toBe('AUTHORITY_CEILING_DOCUMENT_UNAVAILABLE')
      expect(await w.listRules()).toBeUndefined()
    } finally {
      await w.close()
    }
  })

  it('3. a v3 binding whose ANCHOR vanished takes the same refusal, not the skip', async () => {
    // The second abstention arm: `schemaVersion === 3` resolved, then the content
    // hash did not. It used to fall through to the existential branch, which is how
    // a v3 Team — the ONLY kind the cutover leaves behind — could reach the append
    // with no ceiling evaluated. It also carried the anchor law: production must
    // never stamp an ANCHORLESS fingerprint. A refusal mints no fingerprint at all,
    // so that law is served strictly better; leg 7 pins the absent anchor.
    const w = await openWorldAtEntry(V3_WITHOUT_ANCHOR)
    try {
      const error = await w.mutateOperator(RISE)
      expect(error, 'an anchorless v3 read must not commit a rise').toBeDefined()
      expect(error?.code).toBe(PERMISSION_MUTATION_ERROR_CODES.EFFECT_CONTEXT_UNAVAILABLE)
      expect(await w.listRules()).toBeUndefined()
    } finally {
      await w.close()
    }
  })

  it('4. a TIGHTENING under the same unreadable binding still commits', async () => {
    // The refusal is RISE-scoped. If it also blocked a mutation that REMOVES
    // authority, the cheapest way to satisfy an operator would be to stop
    // tightening — the inverted incentive the plan names explicitly. The ceiling
    // gate has always been silent on a batch with no rising region, and this leg
    // keeps that fact observable at the entry rather than in a unit test.
    const w = await openWorldAtEntry(UNREADABLE, { staticFacts: TEMPLATE_ALLOW_AT_OTHER })
    try {
      const error = await w.mutateOperator(TIGHTEN)
      expect(error).toBeUndefined()
      const snapshot = await w.listRules()
      expect(snapshot?.state.rules.some((rule) => rule.resource === `exact:${OTHER}` && rule.effect === 'deny')).toBe(true)
    } finally {
      await w.close()
    }
  })

  it('5. a DECIDED v1/v2 binding still answers NO context and the same rise commits (A5-12 existential)', async () => {
    // THE leg that must not be traded away. A resolvable v1/v2 Blueprint answers
    // `2` (or `1`) at the seam, takes the existential branch, and the ceiling gate
    // is skipped exactly as Alpha.3 shipped it. This is the ONLY answer allowed to
    // skip the gate, and it is a fact about the DOCUMENT — it dies with the cutover,
    // when nothing below 3 can be bound at all. Red here means the two answers were
    // collapsed into one, which is the A5-12 failure this file exists to keep apart.
    const w = await openWorldAtEntry(V2_DECIDED)
    try {
      expect(await w.reader(FIXTURE_TEAM_SESSION_ID, FIXTURE_INSTANCE_ID, 'leader')).toBeUndefined()
      const error = await w.mutateOperator(RISE)
      expect(error).toBeUndefined()
      expect(await w.listRules(), 'the Alpha.3 path is byte-identical: it writes').toBeDefined()
    } finally {
      await w.close()
    }
  })

  it('6. a readable, anchored v3 binding commits the same rise (the refusal is specific)', async () => {
    // The control. Without it, leg 1 could be satisfied by a blanket "never write
    // when the ceiling cannot be fully proven", which is not the law.
    const w = await openWorldAtEntry(V3_ANCHORED)
    try {
      const error = await w.mutateOperator(RISE)
      expect(error).toBeUndefined()
      expect(await w.listRules()).toBeDefined()
    } finally {
      await w.close()
    }
  })

  it('7. the reader has THREE answers, and the abstention is not the existential one', async () => {
    // The seam-level statement of the same law, so a future reader of
    // `permission-plane.ts` cannot re-merge the branches without a red test:
    // `undefined` means "this Team predates the ceiling"; the unavailable-document
    // context means "nobody can tell", and it invents nothing — no documents
    // (both slots declared `unavailable`, never `absent`, never `{rules: []}`) and
    // no anchor (a refusal mints no fingerprint, so the anchorless-proposal branch
    // stays unreachable from production).
    const unreadable = await openWorldAtEntry(UNREADABLE)
    const decided = await openWorldAtEntry(V2_DECIDED)
    try {
      const abstention = await unreadable.reader(FIXTURE_TEAM_SESSION_ID, FIXTURE_INSTANCE_ID, 'leader')
      expect(abstention, 'an unreadable binding is not a pre-v3 Team').toBeDefined()
      expect(abstention?.documents.teamHardEnvelope).toEqual({ status: 'unavailable' })
      expect(abstention?.documents.permissionMutationEnvelope).toEqual({ status: 'unavailable' })
      expect(abstention?.blueprintContentHash, 'no resolvable Blueprint, so no anchor').toBeUndefined()
      // The positions it names are functions of inputs the caller already had (the
      // target identity and the acting surface) — not authority facts read from a
      // document nobody could open.
      expect(abstention?.beneficiaryAuthority).toBe('member')
      const existential = await decided.reader(FIXTURE_TEAM_SESSION_ID, FIXTURE_INSTANCE_ID, 'leader')
      expect(existential).toBeUndefined()
      expect(existential).not.toEqual(abstention)
      const anchoredWorld = await openWorldAtEntry(V3_ANCHORED)
      try {
        const declared = await anchoredWorld.reader(FIXTURE_TEAM_SESSION_ID, FIXTURE_INSTANCE_ID, 'leader')
        expect(declared?.documents.teamHardEnvelope).toMatchObject({ status: 'declared' })
        expect(declared?.blueprintContentHash).toBe(ANCHOR)
      } finally {
        await anchoredWorld.close()
      }
    } finally {
      await unreadable.close()
      await decided.close()
    }
  })

  it('8. a Leader rise the carrier COVERS also refused (the fail-open was not operator-only)', async () => {
    // Measured at base, and it is worse than the operator leg: with a carrier that
    // covers the claimed cell, Alpha.3's coverage law had nothing to refuse, the
    // ceiling was skipped as `undefined`, and the Leader's rise COMMITTED under an
    // unreadable binding too. So `leaderEnvelopeCoverage` was never the guard here —
    // it only ever spoke where the carrier FAILED to cover, which is precisely the
    // case §7.3's deletion removes from the vocabulary. After the prerequisite both
    // surfaces refuse with the same CONTEXT law.
    const w = await openWorldAtEntry(UNREADABLE)
    try {
      const error = await w.mutateLeader(RISE)
      expect(error, 'a Leader rise under an unreadable ceiling must not commit').toBeDefined()
      expect(error?.code).toBe(PERMISSION_MUTATION_ERROR_CODES.EFFECT_CONTEXT_UNAVAILABLE)
      expect(await w.listRules()).toBeUndefined()
    } finally {
      await w.close()
    }
  })

  it('9. a Leader rise Alpha.3 itself refuses keeps its OWN refusal identity (ordering untouched)', async () => {
    // This prerequisite moves no law. The Alpha.3 Leader block
    // (`governance/service.ts:1104`) still runs BEFORE the ceiling gate (`:1158`),
    // so a Leader whose carrier does not cover the claim still meets
    // `PERMISSION_ENVELOPE_EXPANSION_DENIED` — with NO ceiling code in its details,
    // which is the observable proof that the ceiling was never consulted. WHICH
    // identity survives is §7.3's retitle decision (the deletion of
    // `leaderEnvelopeCoverage`), not this prerequisite's, and
    // `a4p7-carrier-width-under-ceiling.test.ts` legs 3-5 are why the ceiling gate
    // can take the law over when that deletion lands.
    const w = await openWorldAtEntry(UNREADABLE, { carrier: oneRule(OTHER, 'allow') })
    try {
      const error = await w.mutateLeader(RISE)
      expect(error?.code).toBe('PERMISSION_ENVELOPE_EXPANSION_DENIED')
      expect(error?.details?.['authorityCeilingCode'], 'refused before the ceiling was consulted').toBeUndefined()
      expect(await w.listRules()).toBeUndefined()
    } finally {
      await w.close()
    }
  })
})
