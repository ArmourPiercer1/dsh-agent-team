/**
 * BOUNDED REPAIR — directed regressions for the external P1 batch (design v2).
 *
 * The former witness suite (raw: evidence
 * `external-p1-probe-revoke-reveal.log`) is now inverted into the DIRECTED
 * contract, per the parent's minimum regression list:
 *  (a) exact ask under an overlay-matching allow = tightening, accepted with
 *      NO envelope and NO static context (snapshot-provable case i);
 *  (b) removing a shadowing deny so a REMAINING overlay rule answers allow
 *      requires allow-ceiling coverage (reveal channel: remaining overlay);
 *  (c) removing a deny that reveals a STATIC allow likewise (ladder-strict:
 *      revealing ask needs ceiling-ask; revealing an equal-or-stricter answer
 *      is no rise);
 *  (d) equal-or-stricter fallback reveal is legal with no grant — the
 *      DECLARED-NONE facts case (`{ layers: [] }`) is DECIDABLE and distinct
 *      from unknown (`undefined`), which types as EFFECT_CONTEXT_UNAVAILABLE;
 *  (e) a broad subtree with an envelope covering ONE child must not pass the
 *      other expansion regions (width-conservative, all-or-nothing);
 *  (f) nested exception legs (a non-rising child region cannot rescue the
 *      rising residual; the ceiling must reach the RISEN EFFECTIVE effect).
 *
 * EVERY before/after answer below is asserted through the REAL merged PR2
 * assembler (the arbiter) over the REAL PR1 durable store, with the PR3
 * service as the ONLY writer. Ladder-strict per ADR §6: deny→ask is
 * expansion VERBATIM.
 *
 * @module @dsh-agent-team/runtime/test/a3p3-revoke-reveal-semantics
 */

import { describe, expect, it } from 'vitest'
import { createTeamOperationCoordinator } from '../coordination/index.js'
import {
  createGovernanceMutationService,
  isPermissionMutationError,
  PERMISSION_MUTATION_ERROR_CODES,
  type GovernanceMutationServiceDeps,
  type GovernancePermissionMutationArgs,
  type PermissionMutationEnvelope,
  type PermissionStaticLayerFacts,
} from '../governance/index.js'
// A4-PR2 lane B: the extracted rise classification is an INTERNAL lane interface
// (its consumer is `governance/service.ts`, same directory), so it is imported
// from its module rather than through the barrel — the barrel's exported subset is
// pinned in `a3p3-governance-lane-hygiene.test.ts` and PR2 has no business growing
// it for a symbol nothing outside the lane calls.
import { authorizeLeaderPermissionMutation, classifyPermissionRise } from '../governance/permission-mutation.js'
import { assembleEffectivePermission } from '../effective-policy/index.js'
/** A4-PR7 §7.5: this suite's world now DECLARES the Team authority ceiling its
 *  reveal/revoke drives need. See the helper for why the declaration is a cell set
 *  and never an `any` wildcard, and why the two `subtree` cells appear only in a
 *  world that wired the containment predicate. */
import { ceilingOverCells, declaredCeilingReader } from './a4p7-ceiling-world-helpers.js'
import type {
  EffectivePermissionAssemblyInput,
  EffectivePermissionOverlayLayer,
} from '../effective-policy/index.js'
import type { CanonicalOperation } from '../operation-permission/types.js'
import type { CanonicalRule, CanonicalRules } from '../operation-permission/permission-resolver.js'
import type { OverrideRecordView, OverrideStorePort } from '../mutation/override-admission.js'
import type { PermissionOverlaySnapshot } from '../permission-governance/types.js'
import { openWorld, type World } from './permission-overlay-helpers.js'

const FILE_KEY = 'file:/srv/worlds/a3p3/out.txt'
const SUBTREE_ROOT = 'file:/srv/worlds/a3p3'
const OTHER_KEY = `${FILE_KEY}.other`

const OPERATION: CanonicalOperation = {
  tool: 'write',
  resource: { kind: 'file', key: FILE_KEY, display: FILE_KEY },
  fingerprint: 'sha256:' + 'c'.repeat(64),
}

class NoopOverrides implements OverrideStorePort {
  async list(): Promise<readonly OverrideRecordView[]> {
    return []
  }
  async put(record: unknown): Promise<unknown> {
    return record
  }
}

/** The three states of the lower-layer context (parent req 3): ABSENT reader
 *  and an ABSTAINING reader are both UNKNOWN; DECLARED carries the facts —
 *  including `{ layers: [] }`, the decidable declared-none case. */
type FactsState =
  | { readonly kind: 'absent' }
  | { readonly kind: 'abstain' }
  | { readonly kind: 'declared'; readonly facts: PermissionStaticLayerFacts }

let worldSeq = 0

async function world(options: {
  readonly envelopeRules?: unknown[]
  readonly facts?: FactsState
  /** Fixture-defect repair (external round 2): the FIRST batch ALWAYS injected
   *  containment, so the unknown-subtree-relation class was untested. `no`
   *  builds the lane WITHOUT `subtreeContains` — every subtree-vs-X relation
   *  is then genuinely unknown. */
  readonly containment?: 'yes' | 'no'
}): Promise<{ w: World; service: ReturnType<typeof createGovernanceMutationService> }> {
  worldSeq += 1
  const w = await openWorld(`region-${String(worldSeq)}`)
  const envelopeRulesRaw = options.envelopeRules
  const factsState = options.facts
  const deps: GovernanceMutationServiceDeps = {
    chain: createTeamOperationCoordinator(),
    overrides: new NoopOverrides(),
    transitions: { appendTransition(): void {}, listTransitions: () => [] },
    transitionCommit: { commit: async () => {} },
    policy: {
      readBlueprintEnvelope: () => { throw new Error('capability plane must not be consulted') },
      readTemplatePolicy: () => { throw new Error('capability plane must not be consulted') },
      readExternalFacts: () => { throw new Error('capability plane must not be consulted') },
    },
    registeredMembers: async () => [],
    policyStates: () => ['default'],
    now: () => '2026-10-05T12:00:00.000Z',
    permissionLane: {
      overlay: w.port,
      ...(options.containment === 'no'
        ? {}
        : { subtreeContains: (root: string, child: string) => child === root || child.startsWith(`${root}/`) }),
      ...(envelopeRulesRaw === undefined
        ? {}
        // Untrusted pass-through: the SERVICE validates (typed refusal).
        : { permissionEnvelope: () => ({ rules: envelopeRulesRaw }) as unknown as PermissionMutationEnvelope }),
      // A4-PR7 §7.5 prerequisite 3 — THE WORLD THIS SUITE NEVER DECLARED. Its seeds
      // (`seed-s6a`, `seed-s7-shadow`, `seed-x3-deny`, …) grant a SUBTREE DENY, and
      // revoking it is what reveals the static allow underneath: the reveal IS a
      // rise, and before that commit the rise was never ceiling-checked at all. The
      // declared world grants `write` over this suite's own cells so the reveal law,
      // the envelope law and the unknown-relation law keep deciding — never the
      // wiring. Subtree cells only where the predicate exists, because without one a
      // subtree-vs-exact question is undecidable and would un-decide every exact cell
      // of the class (`evaluateMatches` step 2).
      authorityCeiling: declaredCeilingReader({
        hardCeiling: ceilingOverCells([
          { operationClass: 'write', matcher: { kind: 'exact', resource: FILE_KEY } },
          { operationClass: 'write', matcher: { kind: 'exact', resource: OTHER_KEY } },
          ...(options.containment === 'no'
            ? []
            : [{ operationClass: 'write', matcher: { kind: 'subtree' as const, resource: SUBTREE_ROOT } }]),
        ]),
        // The SAME carrier document the lane injects, mirrored into the context. A
        // Leader is capped by BOTH documents (`BOUND_AUTHORITY_DOCUMENTS`), so an
        // empty context carrier would silently become a SECOND, narrower envelope
        // over the one each leg deliberately chose — and `S1b`/`S3`/`S6`/`S7b` are
        // precisely the legs that vary that document to ask whether the ceiling
        // reaches. Mirroring makes the v3 meet equal to the carrier law, never below
        // it; where a leg injects no carrier the context says `{ rules: [] }`, which
        // the ceiling gate decides as the declared zero — the refusal the pre-§7.5
        // Leader path used to issue before the gate, now issued by the gate itself.
        ...(envelopeRulesRaw === undefined
          ? {}
          : { carrier: () => ({ rules: envelopeRulesRaw }) as unknown as PermissionMutationEnvelope }),
      }),
      ...(factsState === undefined || factsState.kind === 'absent'
        ? {}
        : factsState.kind === 'abstain'
          ? { staticLayers: () => undefined }
          : { staticLayers: () => factsState.facts }),
    },
  }
  return { w, service: createGovernanceMutationService(deps) }
}

/** The caller-owned canonical views of the snapshot rules for THIS operation
 *  (the A3 input contract; `containsOperation` is the live POINT judgement —
 *  the only place a point judgement legitimately appears). */
function overlayLayer(snapshot: PermissionOverlaySnapshot): EffectivePermissionOverlayLayer {
  return {
    snapshot,
    rules: snapshot.state.rules.map((rule, ruleIndex) => {
      const [kind, ...rest] = rule.resource.split(':')
      const identity = rest.join(':')
      const canonical: CanonicalRule =
        kind === 'exact'
          ? { tool: rule.operation as CanonicalRule['tool'], resource: { kind: 'exact', key: identity } }
          : {
              tool: rule.operation as CanonicalRule['tool'],
              resource: {
                kind: 'subtree',
                rootKey: identity,
                containsOperation: OPERATION.resource.key === identity || OPERATION.resource.key.startsWith(`${identity}/`),
              },
            }
      return { ruleIndex, lane: rule.effect, rule: canonical }
    }),
  }
}

function staticLayerWith(lanes: CanonicalRules, fallback: 'ask' | 'deny', label: string) {
  return { label, default: fallback, rules: lanes }
}

const EXACT_ALLOW: CanonicalRules = { allow: [{ tool: 'write', resource: { kind: 'exact', key: FILE_KEY } }], ask: [], deny: [] }
const EXACT_DENY: CanonicalRules = { allow: [], ask: [], deny: [{ tool: 'write', resource: { kind: 'exact', key: FILE_KEY } }] }
const EXACT_ASK: CanonicalRules = { allow: [], ask: [{ tool: 'write', resource: { kind: 'exact', key: FILE_KEY } }], deny: [] }
const EMPTY_LANES: CanonicalRules = { allow: [], ask: [], deny: [] }

/** The merged PR2 assembler is the ARBITER of what "effective" means. */
function effective(
  template: ReturnType<typeof staticLayerWith> | undefined,
  overlay: EffectivePermissionOverlayLayer | undefined,
): { readonly decision: string; readonly winningLayer: string | null } {
  const input: EffectivePermissionAssemblyInput = {
    teamSessionId: 'session-root-1',
    memberInstanceId: 'inst-alpha',
    ...(template === undefined ? {} : { template }),
    ...(overlay === undefined ? {} : { overlays: [overlay] }),
  }
  const { decision } = assembleEffectivePermission(input, OPERATION)
  return { decision: decision.decision, winningLayer: decision.winningLayer ?? null }
}

async function latest(w: World): Promise<PermissionOverlaySnapshot | undefined> {
  return w.port.latest({ teamSessionId: 'session-root-1', memberInstanceId: 'inst-alpha' })
}

function humanGrant(
  rules: GovernancePermissionMutationArgs['rules'],
  mutationId: string,
): GovernancePermissionMutationArgs {
  return {
    authority: { kind: 'operator' },
    teamSessionId: 'session-root-1',
    memberInstanceId: 'inst-alpha',
    kind: 'grant_instance',
    mutationId,
    reason: 'human seed',
    rules,
  }
}

function leaderMutation(
  args: Omit<GovernancePermissionMutationArgs, 'authority' | 'teamSessionId' | 'memberInstanceId' | 'reason'> & { reason?: string },
): GovernancePermissionMutationArgs {
  return {
    authority: { kind: 'leader' },
    teamSessionId: 'session-root-1',
    memberInstanceId: 'inst-alpha',
    reason: 'leader bounded repair',
    ...args,
  }
}

const TEMPLATE_ALLOW_DENY = staticLayerWith(EXACT_ALLOW, 'deny', 'tmpl-allow')
const TEMPLATE_ASK_DENY = staticLayerWith(EXACT_ASK, 'deny', 'tmpl-ask')
const TEMPLATE_DENY_DENY = staticLayerWith(EXACT_DENY, 'deny', 'tmpl-deny')
const TEMPLATE_EMPTY_ASK = staticLayerWith(EMPTY_LANES, 'ask', 'tmpl-fallback-ask')

const DECLARED_NONE: FactsState = { kind: 'declared', facts: { layers: [] } }
const FACTS_ALLOW: FactsState = {
  kind: 'declared',
  facts: { layers: [{ label: 'tmpl', default: 'deny', rules: [{ operationClass: 'write', matcher: { kind: 'exact', resource: FILE_KEY }, effect: 'allow' }] }] },
}
const FACTS_ASK: FactsState = {
  kind: 'declared',
  facts: { layers: [{ label: 'tmpl', default: 'deny', rules: [{ operationClass: 'write', matcher: { kind: 'exact', resource: FILE_KEY }, effect: 'ask' }] }] },
}
const FACTS_DENY: FactsState = {
  kind: 'declared',
  facts: { layers: [{ label: 'tmpl', default: 'deny', rules: [{ operationClass: 'write', matcher: { kind: 'exact', resource: FILE_KEY }, effect: 'deny' }] }] },
}
const ENVELOPE_EXACT_ALLOW = [{ operationClass: 'write', matcher: { kind: 'exact', resource: FILE_KEY }, maximumEffect: 'allow' }]
const ENVELOPE_EXACT_ASK = [{ operationClass: 'write', matcher: { kind: 'exact', resource: FILE_KEY }, maximumEffect: 'ask' }]
const ENVELOPE_SUBTREE_ALLOW = [{ operationClass: 'write', matcher: { kind: 'subtree', resource: SUBTREE_ROOT }, maximumEffect: 'allow' }]
const ENVELOPE_SUBTREE_ASK = [{ operationClass: 'write', matcher: { kind: 'subtree', resource: SUBTREE_ROOT }, maximumEffect: 'ask' }]

const revokeExactDeny = {
  kind: 'revoke_permission' as const,
  rules: [{ operationClass: 'write', matcher: { kind: 'exact' as const, resource: FILE_KEY }, effect: 'deny' as const }],
}

async function expectRefusedWith(
  run: () => Promise<unknown>,
  code: (typeof PERMISSION_MUTATION_ERROR_CODES)[keyof typeof PERMISSION_MUTATION_ERROR_CODES],
): Promise<void> {
  const outcome = await run().catch((error: unknown) => error)
  expect(isPermissionMutationError(outcome), `expected typed refusal ${code}`).toBe(true)
  expect((outcome as { code: string }).code).toBe(code)
}

describe('reveals are expansions (ladder-strict) — static reveal channel', () => {
  it('S1: revoke revealing a STATIC allow refuses under an empty envelope, with ZERO write', async () => {
    const { w, service } = await world({ envelopeRules: [], facts: FACTS_ALLOW })
    try {
      expect((await service.mutatePermission(humanGrant([{ operationClass: 'write', matcher: { kind: 'exact', resource: FILE_KEY }, effect: 'deny' }], 'seed-s1'))).changed).toBe(true)
      const generationBefore = (await latest(w))?.metadata.generation
      const before = effective(TEMPLATE_ALLOW_DENY, overlayLayer((await latest(w)) as PermissionOverlaySnapshot))
      await expectRefusedWith(
        () => service.mutatePermission(leaderMutation({ ...revokeExactDeny, mutationId: 's1-revoke' })),
        PERMISSION_MUTATION_ERROR_CODES.AUTHORITY_CEILING_INSUFFICIENT,
      )
      expect((await latest(w))?.metadata.generation).toBe(generationBefore) // zero write
      expect(before).toEqual({ decision: 'deny', winningLayer: 'overlay' })
      // …and the AFTER the refused revoke WOULD have produced is the P1 answer:
      expect(effective(TEMPLATE_ALLOW_DENY, undefined)).toEqual({ decision: 'allow', winningLayer: 'template' })
    } finally {
      await w.store.close()
      w.destroy()
    }
  })

  it('S1b: the same revoke passes ONLY with allow-ceiling coverage of the WHOLE matcher', async () => {
    const { w, service } = await world({ envelopeRules: ENVELOPE_EXACT_ALLOW, facts: FACTS_ALLOW })
    try {
      await service.mutatePermission(humanGrant([{ operationClass: 'write', matcher: { kind: 'exact', resource: FILE_KEY }, effect: 'deny' }], 'seed-s1b'))
      const result = await service.mutatePermission(leaderMutation({ ...revokeExactDeny, mutationId: 's1b-revoke' }))
      expect(result.changed).toBe(true)
      expect(effective(TEMPLATE_ALLOW_DENY, overlayLayer((await latest(w)) as PermissionOverlaySnapshot))).toEqual({ decision: 'allow', winningLayer: 'template' })
    } finally {
      await w.store.close()
      w.destroy()
    }
  })

  it('S3: deny->ASK reveal is expansion VERBATIM (ADR §6): refused without ceiling, accepted at ceiling-ask', async () => {
    const a = await world({ envelopeRules: [], facts: FACTS_ASK })
    try {
      await a.service.mutatePermission(humanGrant([{ operationClass: 'write', matcher: { kind: 'exact', resource: FILE_KEY }, effect: 'deny' }], 'seed-s3a'))
      await expectRefusedWith(
        () => a.service.mutatePermission(leaderMutation({ ...revokeExactDeny, mutationId: 's3a-revoke' })),
        PERMISSION_MUTATION_ERROR_CODES.AUTHORITY_CEILING_INSUFFICIENT,
      )
      expect(effective(TEMPLATE_ASK_DENY, overlayLayer((await latest(a.w)) as PermissionOverlaySnapshot))).toEqual({ decision: 'deny', winningLayer: 'overlay' })
    } finally {
      await a.w.store.close()
      a.w.destroy()
    }
    const b = await world({ envelopeRules: ENVELOPE_EXACT_ASK, facts: FACTS_ASK })
    try {
      await b.service.mutatePermission(humanGrant([{ operationClass: 'write', matcher: { kind: 'exact', resource: FILE_KEY }, effect: 'deny' }], 'seed-s3b'))
      expect((await b.service.mutatePermission(leaderMutation({ ...revokeExactDeny, mutationId: 's3b-revoke' }))).changed).toBe(true)
      expect(effective(TEMPLATE_ASK_DENY, undefined)).toEqual({ decision: 'ask', winningLayer: 'template' })
    } finally {
      await b.w.store.close()
      b.w.destroy()
    }
  })

  it('S2: deny revealing DENY (equal) is legal with no envelope', async () => {
    const { w, service } = await world({ envelopeRules: [], facts: FACTS_DENY })
    try {
      await service.mutatePermission(humanGrant([{ operationClass: 'write', matcher: { kind: 'exact', resource: FILE_KEY }, effect: 'deny' }], 'seed-s2'))
      expect((await service.mutatePermission(leaderMutation({ ...revokeExactDeny, mutationId: 's2-revoke' }))).changed).toBe(true)
      expect(effective(TEMPLATE_DENY_DENY, undefined)).toEqual({ decision: 'deny', winningLayer: 'template' })
    } finally {
      await w.store.close()
      w.destroy()
    }
  })

  it('S4: DECLARED-NONE facts (declared deny fallback) is DECIDABLE — reveal-equal is legal…', async () => {
    const { w, service } = await world({ envelopeRules: [], facts: DECLARED_NONE })
    try {
      await service.mutatePermission(humanGrant([{ operationClass: 'write', matcher: { kind: 'exact', resource: FILE_KEY }, effect: 'deny' }], 'seed-s4'))
      expect((await service.mutatePermission(leaderMutation({ ...revokeExactDeny, mutationId: 's4-revoke' }))).changed).toBe(true)
      const after = await latest(w)
      expect(after?.state.rules).toEqual([])
      // the assembler agrees: with no overlay and no static layer it fails closed to deny
      expect(effective(undefined, undefined).decision).toBe('deny')
    } finally {
      await w.store.close()
      w.destroy()
    }
  })

  it('S4b: …but UNKNOWN facts refuse EFFECT_CONTEXT_UNAVAILABLE even when the envelope would cover (unknown ≠ declared-none; the envelope cannot substitute for facts)', async () => {
    for (const facts of [{ kind: 'absent' }, { kind: 'abstain' }] as const) {
      const { w, service } = await world({ envelopeRules: ENVELOPE_EXACT_ALLOW, facts })
      try {
        await service.mutatePermission(humanGrant([{ operationClass: 'write', matcher: { kind: 'exact', resource: FILE_KEY }, effect: 'deny' }], 'seed-s4b'))
        const generationBefore = (await latest(w))?.metadata.generation
        await expectRefusedWith(
          () => service.mutatePermission(leaderMutation({ ...revokeExactDeny, mutationId: 's4b-revoke' })),
          PERMISSION_MUTATION_ERROR_CODES.EFFECT_CONTEXT_UNAVAILABLE,
        )
        expect((await latest(w))?.metadata.generation).toBe(generationBefore)
      } finally {
        await w.store.close()
        w.destroy()
      }
    }
  })

  it('S5: revoking an ALLOW rule can never raise anything — legal WITHOUT any facts (provable case iii)', async () => {
    const { w, service } = await world({ envelopeRules: [] }) // no facts reader at all
    try {
      await service.mutatePermission(humanGrant([{ operationClass: 'write', matcher: { kind: 'exact', resource: FILE_KEY }, effect: 'allow' }], 'seed-s5'))
      const result = await service.mutatePermission(
        leaderMutation({
          kind: 'revoke_permission',
          mutationId: 's5-revoke',
          rules: [{ operationClass: 'write', matcher: { kind: 'exact', resource: FILE_KEY }, effect: 'allow' }],
        }),
      )
      expect(result.changed).toBe(true)
      expect(effective(TEMPLATE_DENY_DENY, undefined).decision).toBe('deny') // the reveal is a tightening
    } finally {
      await w.store.close()
      w.destroy()
    }
  })
})

describe('reveals via the REMAINING overlay rule (S7) and same-layer specificity (B1/B2)', () => {
  it('S7: lifting a shadowing subtree deny so a surviving child ALLOW answers needs allow-ceiling coverage — refused at empty envelope (reveal channel: the REMAINING overlay rule, under declared-none facts)', async () => {
    // DECLARED_NONE facts make the RESIDUAL decidable (reveal = deny, no
    // rise): the refusal below is driven PURELY by the surviving child
    // allow answering the child cell (deny -> allow).
    const { w, service } = await world({ envelopeRules: [], facts: DECLARED_NONE })
    try {
      await service.mutatePermission(humanGrant([{ operationClass: 'write', matcher: { kind: 'subtree', resource: SUBTREE_ROOT }, effect: 'deny' }], 'seed-s7-shadow'))
      await service.mutatePermission(humanGrant([{ operationClass: 'write', matcher: { kind: 'exact', resource: FILE_KEY }, effect: 'allow' }], 'seed-s7-child'))
      const before = effective(TEMPLATE_DENY_DENY, overlayLayer((await latest(w)) as PermissionOverlaySnapshot))
      await expectRefusedWith(
        () =>
          service.mutatePermission(
            leaderMutation({
              kind: 'revoke_permission',
              mutationId: 's7-revoke',
              rules: [{ operationClass: 'write', matcher: { kind: 'subtree', resource: SUBTREE_ROOT }, effect: 'deny' }],
            }),
          ),
        PERMISSION_MUTATION_ERROR_CODES.AUTHORITY_CEILING_INSUFFICIENT,
      )
      expect(before).toEqual({ decision: 'deny', winningLayer: 'overlay' })
    } finally {
      await w.store.close()
      w.destroy()
    }
  })

  it('S7c: the SAME revoke under UNKNOWN facts refuses EFFECT_CONTEXT_UNAVAILABLE — the subtree RESIDUAL reveal is genuinely undecidable and is never assumed harmless', async () => {
    const { w, service } = await world({ envelopeRules: ENVELOPE_SUBTREE_ALLOW }) // envelope present: facts still required
    try {
      await service.mutatePermission(humanGrant([{ operationClass: 'write', matcher: { kind: 'subtree', resource: SUBTREE_ROOT }, effect: 'deny' }], 'seed-s7c-shadow'))
      await service.mutatePermission(humanGrant([{ operationClass: 'write', matcher: { kind: 'exact', resource: FILE_KEY }, effect: 'allow' }], 'seed-s7c-child'))
      const generationBefore = (await latest(w))?.metadata.generation
      await expectRefusedWith(
        () =>
          service.mutatePermission(
            leaderMutation({
              kind: 'revoke_permission',
              mutationId: 's7c-revoke',
              rules: [{ operationClass: 'write', matcher: { kind: 'subtree', resource: SUBTREE_ROOT }, effect: 'deny' }],
            }),
          ),
        PERMISSION_MUTATION_ERROR_CODES.EFFECT_CONTEXT_UNAVAILABLE,
      )
      expect((await latest(w))?.metadata.generation).toBe(generationBefore)
    } finally {
      await w.store.close()
      w.destroy()
    }
  })

  it('S7b: the same revoke with envelope coverage of the removed matcher (ceiling allow) commits; the surviving allow now ANSWERS', async () => {
    const { w, service } = await world({ envelopeRules: ENVELOPE_SUBTREE_ALLOW, facts: DECLARED_NONE })
    try {
      await service.mutatePermission(humanGrant([{ operationClass: 'write', matcher: { kind: 'subtree', resource: SUBTREE_ROOT }, effect: 'deny' }], 'seed-s7b-shadow'))
      await service.mutatePermission(humanGrant([{ operationClass: 'write', matcher: { kind: 'exact', resource: FILE_KEY }, effect: 'allow' }], 'seed-s7b-child'))
      const result = await service.mutatePermission(
        leaderMutation({
          kind: 'revoke_permission',
          mutationId: 's7b-revoke',
          rules: [{ operationClass: 'write', matcher: { kind: 'subtree', resource: SUBTREE_ROOT }, effect: 'deny' }],
        }),
      )
      expect(result.changed).toBe(true)
      expect(effective(TEMPLATE_DENY_DENY, overlayLayer((await latest(w)) as PermissionOverlaySnapshot))).toEqual({ decision: 'allow', winningLayer: 'overlay' })
    } finally {
      await w.store.close()
      w.destroy()
    }
  })

  it('B1 (BUG2): exact ask under an overlay-matching subtree allow is a TIGHTENING — accepted with no envelope and no facts, for EVERY fallback hypothesis', async () => {
    const variants: readonly FactsState[] = [
      { kind: 'absent' },
      { kind: 'abstain' },
      DECLARED_NONE,
      { kind: 'declared', facts: { layers: [{ default: 'ask', rules: [] }] } },
      { kind: 'declared', facts: { layers: [{ default: 'deny', rules: [{ operationClass: 'write', matcher: { kind: 'exact', resource: OTHER_KEY }, effect: 'allow' }] }] } },
      { kind: 'declared', facts: { layers: [{ default: 'deny', rules: [{ operationClass: 'write', matcher: { kind: 'exact', resource: FILE_KEY }, effect: 'allow' }] }] } },
    ]
    for (const [index, facts] of variants.entries()) {
      const { w, service } = await world({ envelopeRules: [], facts })
      try {
        await service.mutatePermission(humanGrant([{ operationClass: 'write', matcher: { kind: 'subtree', resource: SUBTREE_ROOT }, effect: 'allow' }], `seed-b1-${String(index)}`))
        const before = effective(TEMPLATE_DENY_DENY, overlayLayer((await latest(w)) as PermissionOverlaySnapshot))
        const result = await service.mutatePermission(
          leaderMutation({
            kind: 'update_permission',
            mutationId: `b1-ask-${String(index)}`,
            rules: [{ operationClass: 'write', matcher: { kind: 'exact', resource: FILE_KEY }, effect: 'ask' }],
          }),
        )
        expect(result.changed, `variant ${String(index)}`).toBe(true)
        expect(before.decision).toBe('allow')
        const after = await latest(w)
        expect(effective(TEMPLATE_DENY_DENY, overlayLayer(after as PermissionOverlaySnapshot))).toEqual({ decision: 'ask', winningLayer: 'overlay' })
      } finally {
        await w.store.close()
        w.destroy()
      }
    }
  })

  it('B2 (unknown): a first-ever overlay rule over UNKNOWN lower facts refuses CONTEXT — never a deny-masquerade EXPANSION label', async () => {
    const { w, service } = await world({ envelopeRules: [], facts: { kind: 'absent' } })
    try {
      await service.mutatePermission(humanGrant([{ operationClass: 'write', matcher: { kind: 'exact', resource: OTHER_KEY }, effect: 'deny' }], 'seed-b2'))
      await expectRefusedWith(
        () =>
          service.mutatePermission(
            leaderMutation({
              kind: 'grant_instance',
              mutationId: 'b2-ask',
              rules: [{ operationClass: 'write', matcher: { kind: 'exact', resource: FILE_KEY }, effect: 'ask' }],
            }),
          ),
        PERMISSION_MUTATION_ERROR_CODES.EFFECT_CONTEXT_UNAVAILABLE,
      )
    } finally {
      await w.store.close()
      w.destroy()
    }
  })

  it('B2c (declared deny): over DECLARED-NONE facts the same ask grant IS a real deny->ask expansion — envelope-coded refusal', async () => {
    const { w, service } = await world({ envelopeRules: [], facts: DECLARED_NONE })
    try {
      await expectRefusedWith(
        () =>
          service.mutatePermission(
            leaderMutation({
              kind: 'grant_instance',
              mutationId: 'b2c-ask',
              rules: [{ operationClass: 'write', matcher: { kind: 'exact', resource: FILE_KEY }, effect: 'ask' }],
            }),
          ),
        PERMISSION_MUTATION_ERROR_CODES.AUTHORITY_CEILING_INSUFFICIENT,
      )
    } finally {
      await w.store.close()
      w.destroy()
    }
  })

  it('B2b (known allow): over a STATIC allow layer the same ask grant is a KNOWN tightening — accepted', async () => {
    const { w, service } = await world({ envelopeRules: [], facts: FACTS_ALLOW })
    try {
      const result = await service.mutatePermission(
        leaderMutation({
          kind: 'grant_instance',
          mutationId: 'b2b-ask',
          rules: [{ operationClass: 'write', matcher: { kind: 'exact', resource: FILE_KEY }, effect: 'ask' }],
        }),
      )
      expect(result.changed).toBe(true)
      expect(effective(TEMPLATE_ALLOW_DENY, overlayLayer((await latest(w)) as PermissionOverlaySnapshot))).toEqual({ decision: 'ask', winningLayer: 'overlay' })
    } finally {
      await w.store.close()
      w.destroy()
    }
  })
})

describe('regions: subtree partition, width conservatism, all-or-nothing', () => {
  it('S6: subtree-deny removal revealing a STATIC allow under its root is refused at empty envelope, needs subtree-ceiling-allow coverage', async () => {
    const a = await world({ envelopeRules: [], facts: FACTS_ALLOW })
    try {
      await a.service.mutatePermission(humanGrant([{ operationClass: 'write', matcher: { kind: 'subtree', resource: SUBTREE_ROOT }, effect: 'deny' }], 'seed-s6a'))
      const before = effective(TEMPLATE_ALLOW_DENY, overlayLayer((await latest(a.w)) as PermissionOverlaySnapshot))
      await expectRefusedWith(
        () =>
          a.service.mutatePermission(
            leaderMutation({
              kind: 'revoke_permission',
              mutationId: 's6a-revoke',
              rules: [{ operationClass: 'write', matcher: { kind: 'subtree', resource: SUBTREE_ROOT }, effect: 'deny' }],
            }),
          ),
        PERMISSION_MUTATION_ERROR_CODES.AUTHORITY_CEILING_INSUFFICIENT,
      )
      expect(before).toEqual({ decision: 'deny', winningLayer: 'overlay' })
    } finally {
      await a.w.store.close()
      a.w.destroy()
    }
    const b = await world({ envelopeRules: ENVELOPE_SUBTREE_ALLOW, facts: FACTS_ALLOW })
    try {
      await b.service.mutatePermission(humanGrant([{ operationClass: 'write', matcher: { kind: 'subtree', resource: SUBTREE_ROOT }, effect: 'deny' }], 'seed-s6b'))
      expect((await b.service.mutatePermission(
        leaderMutation({
          kind: 'revoke_permission',
          mutationId: 's6b-revoke',
          rules: [{ operationClass: 'write', matcher: { kind: 'subtree', resource: SUBTREE_ROOT }, effect: 'deny' }],
        }),
      )).changed).toBe(true)
      expect(effective(TEMPLATE_ALLOW_DENY, undefined)).toEqual({ decision: 'allow', winningLayer: 'template' })
    } finally {
      await b.w.store.close()
      b.w.destroy()
    }
  })

  it('S6c: coverage of the matcher with a too-LOW ceiling refuses (the reveal rises to allow, the envelope says ask)', async () => {
    const { w, service } = await world({ envelopeRules: ENVELOPE_SUBTREE_ASK, facts: FACTS_ALLOW })
    try {
      await service.mutatePermission(humanGrant([{ operationClass: 'write', matcher: { kind: 'subtree', resource: SUBTREE_ROOT }, effect: 'deny' }], 'seed-s6c'))
      await expectRefusedWith(
        () =>
          service.mutatePermission(
            leaderMutation({
              kind: 'revoke_permission',
              mutationId: 's6c-revoke',
              rules: [{ operationClass: 'write', matcher: { kind: 'subtree', resource: SUBTREE_ROOT }, effect: 'deny' }],
            }),
          ),
        PERMISSION_MUTATION_ERROR_CODES.AUTHORITY_CEILING_INSUFFICIENT,
      )
    } finally {
      await w.store.close()
      w.destroy()
    }
  })

  it('S6d: fallback-ASK region (no rule below, declared ask fallback): subtree-deny removal rises deny->ask — needs ceiling-ask', async () => {
    const facts: FactsState = { kind: 'declared', facts: { layers: [{ label: 'tmpl', default: 'ask', rules: [] }] } }
    const a = await world({ envelopeRules: [], facts })
    try {
      await a.service.mutatePermission(humanGrant([{ operationClass: 'write', matcher: { kind: 'subtree', resource: SUBTREE_ROOT }, effect: 'deny' }], 'seed-s6da'))
      await expectRefusedWith(
        () =>
          a.service.mutatePermission(
            leaderMutation({
              kind: 'revoke_permission',
              mutationId: 's6da-revoke',
              rules: [{ operationClass: 'write', matcher: { kind: 'subtree', resource: SUBTREE_ROOT }, effect: 'deny' }],
            }),
          ),
        PERMISSION_MUTATION_ERROR_CODES.AUTHORITY_CEILING_INSUFFICIENT,
      )
      expect(effective(TEMPLATE_EMPTY_ASK, undefined)).toEqual({ decision: 'ask', winningLayer: null })
    } finally {
      await a.w.store.close()
      a.w.destroy()
    }
    const b = await world({ envelopeRules: ENVELOPE_SUBTREE_ASK, facts })
    try {
      await b.service.mutatePermission(humanGrant([{ operationClass: 'write', matcher: { kind: 'subtree', resource: SUBTREE_ROOT }, effect: 'deny' }], 'seed-s6db'))
      expect((await b.service.mutatePermission(
        leaderMutation({
          kind: 'revoke_permission',
          mutationId: 's6db-revoke',
          rules: [{ operationClass: 'write', matcher: { kind: 'subtree', resource: SUBTREE_ROOT }, effect: 'deny' }],
        }),
      )).changed).toBe(true)
    } finally {
      await b.w.store.close()
      b.w.destroy()
    }
  })

  it('(e) WIDTH-conservative: an envelope covering ONE child of a granted subtree does not pass the other rising regions', async () => {
    const { w, service } = await world({ envelopeRules: ENVELOPE_EXACT_ALLOW, facts: DECLARED_NONE })
    try {
      const generationBefore = (await latest(w))?.metadata.generation
      await expectRefusedWith(
        () =>
          service.mutatePermission(
            leaderMutation({
              kind: 'grant_instance',
              mutationId: 'e-grant',
              rules: [{ operationClass: 'write', matcher: { kind: 'subtree', resource: SUBTREE_ROOT }, effect: 'allow' }],
            }),
          ),
        PERMISSION_MUTATION_ERROR_CODES.AUTHORITY_CEILING_INSUFFICIENT,
      )
      expect((await latest(w))?.metadata.generation).toBe(generationBefore) // all-or-nothing: zero write
    } finally {
      await w.store.close()
      w.destroy()
    }
  })

  it('(f) nested exception: a non-rising child region cannot rescue the rising residual — ceiling ask refuses, ceiling allow passes', async () => {
    // The static layer ALLOWS the child point; the subtree grant therefore
    // rises only in the residual (deny -> allow), whose risen effect is
    // `allow`: the ask-ceiling envelope refuses, the allow-ceiling passes.
    const a = await world({ envelopeRules: ENVELOPE_SUBTREE_ASK, facts: FACTS_ALLOW })
    try {
      await expectRefusedWith(
        () =>
          a.service.mutatePermission(
            leaderMutation({
              kind: 'grant_instance',
              mutationId: 'f-grant-ask',
              rules: [{ operationClass: 'write', matcher: { kind: 'subtree', resource: SUBTREE_ROOT }, effect: 'allow' }],
            }),
          ),
        PERMISSION_MUTATION_ERROR_CODES.AUTHORITY_CEILING_INSUFFICIENT,
      )
    } finally {
      await a.w.store.close()
      a.w.destroy()
    }
    const b = await world({ envelopeRules: ENVELOPE_SUBTREE_ALLOW, facts: FACTS_ALLOW })
    try {
      expect((await b.service.mutatePermission(
        leaderMutation({
          kind: 'grant_instance',
          mutationId: 'f-grant-allow',
          rules: [{ operationClass: 'write', matcher: { kind: 'subtree', resource: SUBTREE_ROOT }, effect: 'allow' }],
        }),
      )).changed).toBe(true)
    } finally {
      await b.w.store.close()
      b.w.destroy()
    }
  })

  it('all-or-nothing across mutation rules: one uncovered rising class refuses the WHOLE mutation, zero write', async () => {
    const facts: FactsState = {
      kind: 'declared',
      facts: {
        layers: [
          {
            label: 'tmpl',
            default: 'deny',
            rules: [
              { operationClass: 'write', matcher: { kind: 'exact', resource: FILE_KEY }, effect: 'deny' },
              { operationClass: 'read', matcher: { kind: 'exact', resource: OTHER_KEY }, effect: 'deny' },
            ],
          },
        ],
      },
    }
    const { w, service } = await world({
      envelopeRules: [{ operationClass: 'write', matcher: { kind: 'exact', resource: FILE_KEY }, maximumEffect: 'ask' }],
      facts,
    })
    try {
      const generationBefore = (await latest(w))?.metadata.generation
      await expectRefusedWith(
        () =>
          service.mutatePermission(
            leaderMutation({
              kind: 'grant_instance',
              mutationId: 'mixed-grant',
              rules: [
                { operationClass: 'write', matcher: { kind: 'exact', resource: FILE_KEY }, effect: 'ask' }, // covered: deny->ask at ceiling ask
                { operationClass: 'read', matcher: { kind: 'exact', resource: OTHER_KEY }, effect: 'allow' }, // uncovered: deny->allow
              ],
            }),
          ),
        PERMISSION_MUTATION_ERROR_CODES.AUTHORITY_CEILING_INSUFFICIENT,
      )
      expect((await latest(w))?.metadata.generation).toBe(generationBefore)
    } finally {
      await w.store.close()
      w.destroy()
    }
  })
})

// ---------------------------------------------------------------------------
// EXTERNAL REVIEW ROUND 2 — the UNKNOWN-CONTAINMENT class (parent-briefed).
// With no `subtreeContains` injected, every subtree-vs-X relation is
// genuinely unknown. Unknown must refuse TYPED (EFFECT_CONTEXT_UNAVAILABLE)
// wherever the classification would need the relation — it must never be
// silently dropped as a non-match (the fail-open drop this round proved:
// `overlayEffectForRegion`/`staticEffectForRegion` treated
// `matcherCovers(…).undeterminable` as no-match, and `matcherCovers` marked
// even the provable-BY-IDENTITY equal-subtree pair unknown because its
// `subtreeContains === undefined` check sits BEFORE the equality shortcut).
// Exact-only contexts (no subtree matcher anywhere relevant) keep flowing
// normally — the pre-classification gate must not over-refuse them.
// ---------------------------------------------------------------------------

const FACTS_SUBTREE_ALLOW: FactsState = {
  kind: 'declared',
  facts: { layers: [{ label: 'tmpl', default: 'deny', rules: [{ operationClass: 'write', matcher: { kind: 'subtree', resource: SUBTREE_ROOT }, effect: 'allow' }] }] },
}

describe('unknown subtree relation refuses typed — never a silent non-match (round 2)', () => {
  it('X1 CANONICAL (parent fixture): subtree(R)=allow on a lane with NO subtreeContains; DECLARED-NONE; EMPTY envelope; §7.5 — the unknown relation refuses the SUBTREE GRANT ITSELF, typed, zero write [re-scoped: the state is no longer constructible; the reveal law stays pinned by X1p]', async () => {
    const { w, service } = await world({ envelopeRules: [], facts: DECLARED_NONE, containment: 'no' })
    try {
      // [§7.5 RE-SCOPE, recorded per leg] The scenario this leg used to set up —
      // a subtree-bearing state ESTABLISHED on a lane with no containment predicate,
      // then mutated — is no longer constructible, and that is the law, not a
      // fixture limitation: `classifyPermissionRise` refuses whenever a subtree
      // matcher participates in an affected class and no predicate is injected
      // (`subtree-relation-unknown`), and since §7.5 prerequisite 3 a lane with no
      // authority-ceiling port reaches that classification instead of skipping every
      // authority check. The state therefore cannot be SEEN, let alone revoked. What
      // this leg pins now is the same law met at the earliest point it can be met:
      // the first subtree-bearing mutation refuses TYPED with zero write. The
      // deny->allow / deny->ask reveal arithmetic it also used to pin is pinned,
      // unchanged, by its predicate-bearing twin in this same describe block.
      // THE ORIGINAL ASSERTION, MET ONE STATEMENT EARLIER: the same typed
      // CONTEXT refusal, the same zero write.
      await expectRefusedWith(
        () => service.mutatePermission(humanGrant([{ operationClass: 'write', matcher: { kind: 'subtree', resource: SUBTREE_ROOT }, effect: 'allow' }], 'seed-x1-allow')),
        PERMISSION_MUTATION_ERROR_CODES.EFFECT_CONTEXT_UNAVAILABLE,
      )
      expect(await latest(w)).toBeUndefined()
    } finally {
      await w.store.close()
      w.destroy()
    }
  })

  it('X1p: the SAME revoke WITH the predicate is the decidable deny->allow reveal — EXPANSION-coded refusal (the gate changes nothing when the relation is known)', async () => {
    const { w, service } = await world({ envelopeRules: [], facts: DECLARED_NONE })
    try {
      await service.mutatePermission(humanGrant([{ operationClass: 'write', matcher: { kind: 'subtree', resource: SUBTREE_ROOT }, effect: 'allow' }], 'seed-x1p-allow'))
      await service.mutatePermission(humanGrant([{ operationClass: 'write', matcher: { kind: 'exact', resource: FILE_KEY }, effect: 'deny' }], 'seed-x1p-deny'))
      await expectRefusedWith(
        () =>
          service.mutatePermission(
            leaderMutation({
              kind: 'revoke_permission',
              mutationId: 'x1p-revoke',
              rules: [{ operationClass: 'write', matcher: { kind: 'exact', resource: FILE_KEY }, effect: 'deny' }],
            }),
          ),
        PERMISSION_MUTATION_ERROR_CODES.AUTHORITY_CEILING_INSUFFICIENT,
      )
    } finally {
      await w.store.close()
      w.destroy()
    }
  })

  it('X2 EQUAL-SUBTREE REWRITE (parent addition): subtree(R)=deny with NO predicate; DECLARED-NONE; EMPTY envelope; §7.5 — the equal-subtree grant is refused TYPED before any state exists [re-scoped: the rewrite is no longer reachable; deny->ask VERBATIM stays pinned by X2p]', async () => {
    const { w, service } = await world({ envelopeRules: [], facts: DECLARED_NONE, containment: 'no' })
    try {
      // [§7.5 RE-SCOPE, recorded per leg] The scenario this leg used to set up —
      // a subtree-bearing state ESTABLISHED on a lane with no containment predicate,
      // then mutated — is no longer constructible, and that is the law, not a
      // fixture limitation: `classifyPermissionRise` refuses whenever a subtree
      // matcher participates in an affected class and no predicate is injected
      // (`subtree-relation-unknown`), and since §7.5 prerequisite 3 a lane with no
      // authority-ceiling port reaches that classification instead of skipping every
      // authority check. The state therefore cannot be SEEN, let alone revoked. What
      // this leg pins now is the same law met at the earliest point it can be met:
      // the first subtree-bearing mutation refuses TYPED with zero write. The
      // deny->allow / deny->ask reveal arithmetic it also used to pin is pinned,
      // unchanged, by its predicate-bearing twin in this same describe block.
      // THE ORIGINAL ASSERTION, MET ONE STATEMENT EARLIER: the same typed
      // CONTEXT refusal, the same zero write.
      await expectRefusedWith(
        () => service.mutatePermission(humanGrant([{ operationClass: 'write', matcher: { kind: 'subtree', resource: SUBTREE_ROOT }, effect: 'deny' }], 'seed-x2-deny')),
        PERMISSION_MUTATION_ERROR_CODES.EFFECT_CONTEXT_UNAVAILABLE,
      )
      expect(await latest(w)).toBeUndefined()
    } finally {
      await w.store.close()
      w.destroy()
    }
  })

  it('X2p: the SAME equal-subtree deny->ask WITH the predicate is refused EXPANSION-coded (ladder-strict: deny->ask VERBATIM needs ceiling-ask coverage)', async () => {
    const { w, service } = await world({ envelopeRules: [], facts: DECLARED_NONE })
    try {
      await service.mutatePermission(humanGrant([{ operationClass: 'write', matcher: { kind: 'subtree', resource: SUBTREE_ROOT }, effect: 'deny' }], 'seed-x2p-deny'))
      await expectRefusedWith(
        () =>
          service.mutatePermission(
            leaderMutation({
              kind: 'update_permission',
              mutationId: 'x2p-rewrite',
              rules: [{ operationClass: 'write', matcher: { kind: 'subtree', resource: SUBTREE_ROOT }, effect: 'ask' }],
            }),
          ),
        PERMISSION_MUTATION_ERROR_CODES.AUTHORITY_CEILING_INSUFFICIENT,
      )
    } finally {
      await w.store.close()
      w.destroy()
    }
  })

  it('X3 STATIC subtree allow exposed by a subtree mutation with NO predicate; §7.5 — the refusal is TYPED and the overlay stays EMPTY [re-scoped: the overlay deny can never be written; the static reveal stays pinned by X3p]', async () => {
    const { w, service } = await world({ envelopeRules: [], facts: FACTS_SUBTREE_ALLOW, containment: 'no' })
    try {
      // [§7.5 RE-SCOPE, recorded per leg] The scenario this leg used to set up —
      // a subtree-bearing state ESTABLISHED on a lane with no containment predicate,
      // then mutated — is no longer constructible, and that is the law, not a
      // fixture limitation: `classifyPermissionRise` refuses whenever a subtree
      // matcher participates in an affected class and no predicate is injected
      // (`subtree-relation-unknown`), and since §7.5 prerequisite 3 a lane with no
      // authority-ceiling port reaches that classification instead of skipping every
      // authority check. The state therefore cannot be SEEN, let alone revoked. What
      // this leg pins now is the same law met at the earliest point it can be met:
      // the first subtree-bearing mutation refuses TYPED with zero write. The
      // deny->allow / deny->ask reveal arithmetic it also used to pin is pinned,
      // unchanged, by its predicate-bearing twin in this same describe block.
      // THE ORIGINAL ASSERTION, MET ONE STATEMENT EARLIER: the same typed
      // CONTEXT refusal, the same zero write.
      await expectRefusedWith(
        () => service.mutatePermission(humanGrant([{ operationClass: 'write', matcher: { kind: 'subtree', resource: SUBTREE_ROOT }, effect: 'deny' }], 'seed-x3-deny')),
        PERMISSION_MUTATION_ERROR_CODES.EFFECT_CONTEXT_UNAVAILABLE,
      )
      expect(await latest(w)).toBeUndefined()
    } finally {
      await w.store.close()
      w.destroy()
    }
  })

  it('X3p: the SAME static-subtree reveal WITH the predicate is the decidable deny->allow expansion — EXPANSION-coded refusal', async () => {
    const { w, service } = await world({ envelopeRules: [], facts: FACTS_SUBTREE_ALLOW })
    try {
      await service.mutatePermission(humanGrant([{ operationClass: 'write', matcher: { kind: 'subtree', resource: SUBTREE_ROOT }, effect: 'deny' }], 'seed-x3p-deny'))
      await expectRefusedWith(
        () =>
          service.mutatePermission(
            leaderMutation({
              kind: 'revoke_permission',
              mutationId: 'x3p-revoke',
              rules: [{ operationClass: 'write', matcher: { kind: 'subtree', resource: SUBTREE_ROOT }, effect: 'deny' }],
            }),
          ),
        PERMISSION_MUTATION_ERROR_CODES.AUTHORITY_CEILING_INSUFFICIENT,
      )
    } finally {
      await w.store.close()
      w.destroy()
    }
  })

  it('X4 GATE SPECIFICITY: EXACT-ONLY context with NO predicate flows NORMALLY — decidable tightening accepted, decidable expansion still EXPANSION-coded (the gate never over-refuses what contains no subtree matcher)', async () => {
    const { w, service } = await world({ envelopeRules: [], facts: DECLARED_NONE, containment: 'no' })
    try {
      await service.mutatePermission(humanGrant([{ operationClass: 'write', matcher: { kind: 'exact', resource: FILE_KEY }, effect: 'allow' }], 'seed-x4-allow'))
      // Decidable tightening (overlay answers both sides): accepted, no facts needed either.
      const ok = await service.mutatePermission(
        leaderMutation({
          kind: 'update_permission',
          mutationId: 'x4-tighten',
          rules: [{ operationClass: 'write', matcher: { kind: 'exact', resource: FILE_KEY }, effect: 'deny' }],
        }),
      )
      expect(ok).toBeTruthy()
      // Decidable expansion over declared-none facts (fresh pair, deny
      // fallback -> ask rise): still EXPANSION-coded, NOT the context code.
      await expectRefusedWith(
        () =>
          service.mutatePermission(
            leaderMutation({
              kind: 'grant_instance',
              mutationId: 'x4-expand',
              rules: [{ operationClass: 'write', matcher: { kind: 'exact', resource: OTHER_KEY }, effect: 'ask' }],
            }),
          ),
        PERMISSION_MUTATION_ERROR_CODES.AUTHORITY_CEILING_INSUFFICIENT,
      )
    } finally {
      await w.store.close()
      w.destroy()
    }
  })

  it('X5 ENVELOPE-side unknown coverage is CONTEXT, not a mislabeled EXPANSION: exact grant over declared-none with ONLY a subtree envelope matcher and NO predicate', async () => {
    const { w, service } = await world({ envelopeRules: ENVELOPE_SUBTREE_ALLOW, facts: DECLARED_NONE, containment: 'no' })
    try {
      await expectRefusedWith(
        () =>
          service.mutatePermission(
            leaderMutation({
              kind: 'grant_instance',
              mutationId: 'x5-grant',
              rules: [{ operationClass: 'write', matcher: { kind: 'exact', resource: FILE_KEY }, effect: 'ask' }],
            }),
          ),
        PERMISSION_MUTATION_ERROR_CODES.EFFECT_CONTEXT_UNAVAILABLE,
      )
    } finally {
      await w.store.close()
      w.destroy()
    }
  })
})

// ---------------------------------------------------------------------------
// A4-PR2 lane B — the rise classification, extracted from the Leader judgement
// ---------------------------------------------------------------------------
// WHY THIS BLOCK IS IN THE ALPHA.3 FILE AND NOT IN A NEW ONE: the plan schedules
// lane B's regression here ("Add RED regression proving Alpha.3 revoke/reveal
// behavior stays identical after extracting rise regions"), and the fact it
// protects is precisely Alpha.3's — the revoke/reveal semantics this file already
// owns. A new file would have had to re-derive this file's world to prove
// something about a refactor of the code this file already exercises.
//
// The refactor moves the closed-region partition and the before/after comparison
// out of `authorizeLeaderPermissionMutation` so the v3 ceiling gate can read the
// SAME rise facts the classification was computed from. Two properties make that
// safe and both are pinned below: the RISE FACTS are unchanged, and the REFUSAL
// ORDER is unchanged — an unevaluable region still refuses as CONTEXT, because
// "we cannot tell" must never be reported as anything else. (A4-PR7 §7.5 deleted
// the coverage judge that used to ride the same classification: the actor-side
// "uncovered" answer no longer exists here — the v3 ceiling decides authority —
// so what agrees below is CONTEXT ⟺ undeterminable, and everything else stays ok.)
describe('A4-PR2 lane B: the extracted rise facts are the facts Alpha.3 refused on', () => {
  const exact = (resource: string) => ({ kind: 'exact' as const, resource })
  const rule = (resource: string, effect: 'allow' | 'ask' | 'deny') => ({
    operation: 'write',
    // The durable carrier grammar (PR3): a matcher renders WITH its kind prefix,
    // so a bare path is an unparsable carrier and refuses before anything is read.
    resource: `exact:${resource}`,
    effect,
  })
  const mutation = (resource: string, effect: 'allow' | 'ask' | 'deny') => ({
    operationClass: 'write',
    matcher: exact(resource),
    effect,
  })
  const envelopeAt = (resource: string, maximumEffect: 'allow' | 'ask' | 'deny') => ({
    rules: [{ operationClass: 'write', matcher: exact(resource), maximumEffect }],
  })
  const NO_STATIC = { layers: [] }

  it('a grant that raises ask->allow is ONE rise region carrying the risen effect and the mutation width', () => {
    const input = {
      latestRules: [rule('file:/root/a', 'ask')],
      plannedRules: [rule('file:/root/a', 'allow')],
      mutationRules: [mutation('file:/root/a', 'allow')],
      envelope: envelopeAt('file:/root/a', 'allow'),
      staticFacts: NO_STATIC,
    }
    const classification = classifyPermissionRise(input)
    expect(classification.rising.length).toBe(1)
    expect(classification.rising[0]).toMatchObject({
      operationClass: 'write',
      risenEffect: 'allow',
      regionText: 'exact:file:/root/a',
    })
    expect(classification.rising[0]?.before).toMatchObject({ status: 'decided', effect: 'ask' })
    expect(classification.rising[0]?.after).toMatchObject({ status: 'decided', effect: 'allow' })
    expect(classification.undeterminable).toEqual([])
    // Since A4-PR7 §7.5 the classification has NO third array: no actor-specific
    // judgement was ever made here (the deleted `unmet` one included), and the
    // closed shape of the fact record is what the ceiling gate consumes.
    expect(Object.keys(classification).sort()).toEqual(['rising', 'undeterminable'])
  })

  it('a tightening and an identity are NOT rises (the region partition reports nothing to gate)', () => {
    const tighten = {
      latestRules: [rule('file:/root/a', 'allow')],
      plannedRules: [rule('file:/root/a', 'ask')],
      mutationRules: [mutation('file:/root/a', 'ask')],
      envelope: envelopeAt('file:/root/a', 'allow'),
      staticFacts: NO_STATIC,
    }
    expect(classifyPermissionRise(tighten).rising).toEqual([])
    const identity = { ...tighten, plannedRules: [rule('file:/root/a', 'allow')], latestRules: [rule('file:/root/a', 'allow')] }
    expect(classifyPermissionRise(identity).rising).toEqual([])
    expect(() => authorizeLeaderPermissionMutation(tighten)).not.toThrow()
  })

  it('a REVEAL (removal that lets a lower rule answer) is a rise the classifier reports, not a no-op', () => {
    // The Alpha.3 reveal case in classification terms: removing the overlay `deny`
    // leaves the static layer's `ask` answering, so the EFFECT rises deny->ask
    // even though the mutation removes authority-looking text. If the extraction
    // lost the reveal path, `rising` would be empty here and the v3 gate would
    // silently stop gating reveals — the exact "no existing test can see it" class.
    const reveal = {
      latestRules: [rule('file:/root/a', 'deny')],
      plannedRules: [],
      mutationRules: [mutation('file:/root/a', 'deny')],
      envelope: envelopeAt('file:/root/a', 'allow'),
      staticFacts: {
        // `default` is required: a static layer always states its fallback.
        layers: [{ default: 'deny' as const, rules: [{ operationClass: 'write', matcher: exact('file:/root/a'), effect: 'ask' as const }] }],
      },
    }
    const classification = classifyPermissionRise(reveal)
    expect(classification.rising.length).toBe(1)
    expect(classification.rising[0]?.risenEffect).toBe('ask')
    // The actor-specific half MOVED (A4-PR7 §7.5): `authorizeLeaderPermissionMutation`
    // no longer consults the envelope at all — the judge that asked "does a rule
    // reach the risen effect" was deleted — so a too-shallow carrier must NOT
    // change the pure step's answer (both shapes pass through it now). The refusal
    // itself survives one gate later, on the v3 ceiling: the world-level legs of
    // this file pin it (S1 refuses `AUTHORITY_CEILING_INSUFFICIENT` at
    // `no-authority`, S6c at a too-low ceiling). What must survive HERE is the
    // FACT the ceiling consumes: the reveal still reports exactly one rise,
    // whatever the carrier document says.
    expect(() => authorizeLeaderPermissionMutation(reveal)).not.toThrow()
    const cannotAsk = { ...reveal, envelope: envelopeAt('file:/root/a', 'deny') }
    expect(() => authorizeLeaderPermissionMutation(cannotAsk)).not.toThrow()
    expect(classifyPermissionRise(cannotAsk).rising.length).toBe(1)
  })

  it('the extracted classifier and the Leader judgement never disagree about the same input', () => {
    // THE regression leg. Across a matrix of revoke/reveal/envelope shapes, the
    // terminal answer of the unchanged entry point must correspond exactly to what
    // the extracted classification reports. POST §7.5 the correspondence is:
    // CONTEXT ⟺ something undeterminable, ok ⟺ nothing undeterminable — an
    // envelope shape can no longer change the pure step's answer at all (the
    // coverage judge that made it possible was deleted; authority moved to the
    // ceiling gate, which world-level legs pin). If a refactor drops a partition
    // branch or an independence rule, this is where the two stop agreeing.
    const cases = [
      { latestRules: [rule('file:/root/a', 'ask')], plannedRules: [rule('file:/root/a', 'allow')], mutationRules: [mutation('file:/root/a', 'allow')], envelope: envelopeAt('file:/root/a', 'allow') },
      { latestRules: [rule('file:/root/a', 'ask')], plannedRules: [rule('file:/root/a', 'allow')], mutationRules: [mutation('file:/root/a', 'allow')], envelope: envelopeAt('file:/root/other', 'allow') },
      { latestRules: [rule('file:/root/a', 'ask')], plannedRules: [rule('file:/root/a', 'allow')], mutationRules: [mutation('file:/root/a', 'allow')], envelope: { rules: [] } },
      { latestRules: [rule('file:/root/a', 'allow')], plannedRules: [rule('file:/root/a', 'deny')], mutationRules: [mutation('file:/root/a', 'deny')], envelope: { rules: [] } },
      { latestRules: [], plannedRules: [rule('file:/root/a', 'allow')], mutationRules: [mutation('file:/root/a', 'allow')], envelope: envelopeAt('file:/root/a', 'allow') },
      { latestRules: [rule('file:/root/a', 'deny')], plannedRules: [], mutationRules: [mutation('file:/root/a', 'deny')], envelope: envelopeAt('file:/root/a', 'allow') },
    ]
    for (const [index, base] of cases.entries()) {
      const input = { ...base, staticFacts: NO_STATIC }
      const classification = classifyPermissionRise(input)
      let code: string | 'ok' = 'ok'
      try {
        authorizeLeaderPermissionMutation(input)
      } catch (error) {
        code = (error as { code?: string }).code ?? 'unknown'
      }
      const expected = classification.undeterminable.length > 0
        ? 'PERMISSION_EFFECT_CONTEXT_UNAVAILABLE'
        : 'ok'
      expect(code, `case ${String(index)}: classifier said ${JSON.stringify({ rising: classification.rising.length, undeterminable: classification.undeterminable.length })}`).toBe(expected)
    }
  })

  it('an undeterminable region still beats a reported rise (the refusal order is data, not luck)', () => {
    // Two mutation rules in one batch over UNKNOWN lower facts: one rises in a
    // region the envelope does not reach, one cannot be evaluated at all (a
    // CONTEXT fact). The pure step refuses CONTEXT — a caller routed on "get
    // your envelope in order" would chase the wrong remedy when the truth is
    // "we cannot evaluate this batch", and post-§7.5 an envelope fact cannot
    // even be reported from here: the rise rides the ceiling gate downstream,
    // the unevaluable one refuses HERE, first, byte-identically.
    const input = {
      latestRules: [rule('file:/root/a', 'ask')],
      plannedRules: [rule('file:/root/a', 'allow'), rule('file:/root/b', 'allow')],
      mutationRules: [mutation('file:/root/a', 'allow'), mutation('file:/root/b', 'allow')],
      envelope: envelopeAt('file:/root/nowhere', 'allow'),
      // UNKNOWN lower facts — never conflated with `{ layers: [] }`.
      staticFacts: undefined,
    }
    const classification = classifyPermissionRise(input)
    expect(classification.rising.length, 'the rising cell must be reported for the ceiling gate downstream').toBe(1)
    expect(classification.undeterminable.length, 'the unevaluable cell must be reported').toBe(1)
    let raised: unknown
    try {
      authorizeLeaderPermissionMutation(input)
    } catch (error) {
      raised = error
    }
    expect((raised as { code?: string }).code).toBe('PERMISSION_EFFECT_CONTEXT_UNAVAILABLE')
    // The problem label travels in the message (PermissionMutationError carries
    // `code` + a message with the `(problem: …)` suffix + a remote-safe detail
    // bag) — pinned here so a later refactor of the refusal cannot quietly
    // retitle a context fault without tripping this leg.
    expect(String((raised as Error).message)).toContain('problem: effect-context-unavailable')
  })
})
