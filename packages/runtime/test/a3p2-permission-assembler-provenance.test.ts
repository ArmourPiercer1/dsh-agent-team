/**
 * a3p2-permission-assembler-provenance.test.ts — Alpha.3 PR2 MUST-TEST, the
 * PROVENANCE + ISOLATION + fail-closed half (the layer-precedence half is
 * `a3p2-permission-assembler-precedence.test.ts`).
 *
 * Pinned contract:
 *
 * - design §2 `EffectivePermissionAssembler`: "combine static and dynamic
 *   permission; produce effective policy; PRESERVE SOURCE PROVENANCE" — the
 *   effective answer must name the layer, and for the overlay layer the exact
 *   snapshot it came from, verbatim (`snapshotId`, `generation`, `actor`,
 *   `mutationId`, `timestamp`, `reason`) plus which rule of it decided;
 * - ADR §2: the current authority is the HIGHEST-generation snapshot, history
 *   is audit-only; ADR §7: provenance is audit data and never a resolver
 *   precedence (a Human-attributed rule wins only because its LAYER matches
 *   first, never because of who wrote it);
 * - the coordinator's isolation requirement: two MemberInstances' overlays
 *   never cross — a snapshot whose identity differs from the assembly identity
 *   is REFUSED (fail closed), not silently filtered;
 * - no production wiring: PR2 assembles and explains, it does not execute —
 *   pinned by a static call-site witness over the production source trees.
 *
 * Offline, host-free, in-memory (the PR1 port is consumed through an
 * in-memory stub typed as the port interface: no store, no seam, no durable
 * world).
 *
 * SELF-CLEANLINESS: inside the P4-T6 whole-tree scanner's scope; carries zero
 * denylist vocabulary.
 *
 * @module @dsh-agent-team/runtime/test/a3p2-permission-assembler-provenance
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  assembleEffectivePermission,
  assembleEffectivePermissionPolicy,
  EFFECTIVE_PERMISSION_ASSEMBLY_ERROR_CODES,
  EFFECTIVE_PERMISSION_ASSEMBLY_ERROR_CODE_VALUES,
  EFFECTIVE_PERMISSION_LAYERS,
  EFFECTIVE_PERMISSION_LOOKUP_ORDER,
} from '../effective-policy/index.js'
import type { EffectivePermissionAssemblyInput } from '../effective-policy/index.js'
import {
  capture,
  deepClone,
  errorCode,
  errorDetail,
  errorProblem,
  exactRule,
  fileOp,
  INSTANCE_A,
  INSTANCE_B,
  isDeepFrozen,
  OTHER_TEAM_SESSION,
  overlayLayer,
  overlayRule,
  snapshot,
  staticLayer,
  stubOverlayPort,
  TEAM_SESSION,
} from './effective-permission-assembler-helpers.js'

/** This spec's directory: the roots of the wiring witness are relative to it. */
const HERE = dirname(fileURLToPath(import.meta.url))

const KEY_A = 'fskey:/workspace/a.txt'
const KEY_B = 'fskey:/workspace/b.txt'
const WRITE_A = fileOp('write', KEY_A)

const BLUEPRINT = staticLayer({ label: 'bp-defaults', default: 'deny', deny: [exactRule('write', KEY_A)] })
const TEMPLATE = staticLayer({ label: 'tpl-worker', default: 'deny', ask: [exactRule('write', KEY_A)] })

/** The ADR §2 provenance of the winning rule, as first-class output. */
describe('provenance: the winning rule is explainable', () => {
  it('an overlay win names layer + derived snapshotId + generation + actor + mutationId + timestamp + reason + the deciding snapshot rule', () => {
    const overlay = snapshot(2, [overlayRule('read', KEY_B, 'allow'), overlayRule('write', KEY_A, 'allow')], {
      actor: 'human:operator',
      mutationId: 'mut-77',
      reason: 'release the result file for the report',
      timestamp: '2026-10-02T08:15:30.000Z',
    })
    const { decision } = assembleEffectivePermission(
      {
        teamSessionId: TEAM_SESSION,
        memberInstanceId: INSTANCE_A,
        blueprint: BLUEPRINT,
        template: TEMPLATE,
        overlays: [overlayLayer(overlay)],
      },
      WRITE_A,
    )
    const provenance = decision.provenance
    expect(provenance).not.toBe(null)
    expect(provenance?.layer).toBe('overlay')
    expect(provenance?.precedence).toBe(2)
    expect(provenance?.lane).toBe('allow')
    // Both overlay rules sit in the `allow` lane; the deciding one is the
    // second of that lane and the second rule of the snapshot.
    expect(provenance?.ruleIndexInLane).toBe(1)
    expect(provenance?.sourceIndex).toBe(1)
    expect(provenance?.overlayRule).toEqual({ operation: 'write', resource: KEY_A })
    expect(provenance?.overlayAuthority).toEqual({
      snapshotId: `${TEAM_SESSION}#${INSTANCE_A}#2`,
      generation: 2,
      previousSnapshotId: `${TEAM_SESSION}#${INSTANCE_A}#1`,
      actor: 'human:operator',
      mutationId: 'mut-77',
      timestamp: '2026-10-02T08:15:30.000Z',
      reason: 'release the result file for the report',
    })
  })

  it('the overlay authority block is the snapshot sections verbatim (never rewritten or summarized)', () => {
    const overlay = snapshot(1, [overlayRule('write', KEY_A, 'ask')], {
      actor: 'leader:inst-root',
      mutationId: 'mut-verbatim',
      reason: '',
    })
    const { decision } = assembleEffectivePermission(
      { teamSessionId: TEAM_SESSION, memberInstanceId: INSTANCE_A, overlays: [overlayLayer(overlay)] },
      WRITE_A,
    )
    expect(decision.provenance?.overlayAuthority?.snapshotId).toBe(overlay.snapshotId)
    expect(decision.provenance?.overlayAuthority?.generation).toBe(overlay.metadata.generation)
    expect(decision.provenance?.overlayAuthority?.previousSnapshotId).toBe(overlay.metadata.previousSnapshotId)
    expect(decision.provenance?.overlayAuthority?.actor).toBe(overlay.provenance.actor)
    expect(decision.provenance?.overlayAuthority?.mutationId).toBe(overlay.provenance.mutationId)
    expect(decision.provenance?.overlayAuthority?.timestamp).toBe(overlay.provenance.timestamp)
    // An empty audit reason is carried as the empty string, never replaced by
    // a placeholder — the provenance is the snapshot's, not the assembler's.
    expect(decision.provenance?.overlayAuthority?.reason).toBe('')
  })

  it('a static win names its layer + label + lane + lane index and carries no overlay block', () => {
    const { decision } = assembleEffectivePermission(
      { teamSessionId: TEAM_SESSION, memberInstanceId: INSTANCE_A, blueprint: BLUEPRINT },
      WRITE_A,
    )
    expect(decision.provenance?.layer).toBe('blueprint')
    expect(decision.provenance?.layerLabel).toBe('bp-defaults')
    expect(decision.provenance?.lane).toBe('deny')
    expect(decision.provenance?.sourceIndex).toBe(0)
    expect(decision.provenance?.overlayAuthority).toBe(undefined)
    expect(decision.provenance?.overlayRule).toBe(undefined)
    expect(decision.provenance?.rule).toEqual(exactRule('write', KEY_A))
  })

  it('a default decision has no winning provenance and names the layer whose fallback answered', () => {
    const { decision } = assembleEffectivePermission(
      { teamSessionId: TEAM_SESSION, memberInstanceId: INSTANCE_A, template: TEMPLATE },
      fileOp('write', KEY_B),
    )
    expect(decision.source).toBe('default')
    expect(decision.provenance).toBe(null)
    expect(decision.winningLayer).toBe(null)
    expect(decision.fallbackSource).toEqual({ layer: 'template', effect: 'deny' })
  })

  it('overriddenLower names the deciding rule of each lower layer that MATCHED (never a non-matching layer)', () => {
    const overlay = snapshot(1, [overlayRule('write', KEY_A, 'allow')])
    const { decision } = assembleEffectivePermission(
      {
        teamSessionId: TEAM_SESSION,
        memberInstanceId: INSTANCE_A,
        // The blueprint carries no rule for this operation at all.
        blueprint: staticLayer({ label: 'bp-quiet', default: 'deny', deny: [exactRule('read', KEY_B)] }),
        template: TEMPLATE,
        overlays: [overlayLayer(overlay)],
      },
      WRITE_A,
    )
    expect(decision.overriddenLower.length).toBe(1)
    expect(decision.overriddenLower[0]?.layer).toBe('template')
    expect(decision.overriddenLower[0]?.lane).toBe('ask')
    expect(decision.overriddenLower[0]?.layerLabel).toBe('tpl-worker')
  })

  it('the explanation is deterministic and names the winning layer, the effect and the mutation', () => {
    const overlay = snapshot(1, [overlayRule('write', KEY_A, 'allow')], { mutationId: 'mut-explain' })
    const args = {
      teamSessionId: TEAM_SESSION,
      memberInstanceId: INSTANCE_A,
      template: TEMPLATE,
      overlays: [overlayLayer(overlay)],
    }
    const first = assembleEffectivePermission(args, WRITE_A).decision.explanation
    const second = assembleEffectivePermission(args, WRITE_A).decision.explanation
    expect(second).toBe(first)
    expect(first).toContain('allow')
    expect(first).toContain('overlay')
    expect(first).toContain('mut-explain')
  })

  it('ADR §7: a Human-attributed rule wins by LAYER, not by actor — the same rule attributed to a Leader decides identically', () => {
    const byHuman = snapshot(1, [overlayRule('write', KEY_A, 'allow')], { actor: 'human:operator' })
    const byLeader = snapshot(1, [overlayRule('write', KEY_A, 'allow')], { actor: 'leader:inst-root' })
    const human = assembleEffectivePermission(
      { teamSessionId: TEAM_SESSION, memberInstanceId: INSTANCE_A, template: TEMPLATE, overlays: [overlayLayer(byHuman)] },
      WRITE_A,
    ).decision
    const leader = assembleEffectivePermission(
      { teamSessionId: TEAM_SESSION, memberInstanceId: INSTANCE_A, template: TEMPLATE, overlays: [overlayLayer(byLeader)] },
      WRITE_A,
    ).decision
    expect(leader.decision).toBe(human.decision)
    expect(leader.decision).toBe('allow')
    // The only difference is the audit attribution.
    expect(human.provenance?.overlayAuthority?.actor).toBe('human:operator')
    expect(leader.provenance?.overlayAuthority?.actor).toBe('leader:inst-root')
  })
})

/** The Stage-1 artifact (ADR §3): the layered effective policy. */
describe('the assembled policy: layers in precedence order, provenance attached', () => {
  it('layers are carried ASCENDING by precedence with the overlay authority attached', () => {
    const overlay = snapshot(3, [overlayRule('write', KEY_A, 'allow')])
    const policy = assembleEffectivePermissionPolicy({
      teamSessionId: TEAM_SESSION,
      memberInstanceId: INSTANCE_A,
      blueprint: BLUEPRINT,
      template: TEMPLATE,
      overlays: [overlayLayer(overlay)],
    })
    expect(policy.teamSessionId).toBe(TEAM_SESSION)
    expect(policy.memberInstanceId).toBe(INSTANCE_A)
    expect(policy.layers.map((layer) => layer.layer)).toEqual(['blueprint', 'template', 'overlay'])
    expect(policy.layers.map((layer) => layer.precedence)).toEqual([0, 1, 2])
    expect(policy.layers.map((layer) => layer.origin)).toEqual(['static', 'static', 'overlay'])
    // Only the static layers carry a fallback (an overlay has none).
    expect(policy.layers.map((layer) => layer.fallback)).toEqual(['deny', 'deny', null])
    expect(policy.layers[0]?.label).toBe('bp-defaults')
    const overlayLayerView = policy.layers[2]
    expect(overlayLayerView?.authority?.generation).toBe(3)
    expect(overlayLayerView?.ruleCount).toBe(1)
    expect(overlayLayerView?.rules.allow[0]?.overlayRule).toEqual({ operation: 'write', resource: KEY_A })
    expect(policy.fallback).toEqual({ layer: 'blueprint', effect: 'deny' })
  })

  it('the layer vocabulary and the lookup order are the frozen ADR §4 order', () => {
    expect(EFFECTIVE_PERMISSION_LAYERS).toEqual(['blueprint', 'template', 'overlay'])
    expect(EFFECTIVE_PERMISSION_LOOKUP_ORDER).toEqual(['overlay', 'template', 'blueprint'])
  })

  it('an absent static layer simply is not in the policy, and an empty overlay snapshot is', () => {
    const empty = snapshot(1, [])
    const policy = assembleEffectivePermissionPolicy({
      teamSessionId: TEAM_SESSION,
      memberInstanceId: INSTANCE_A,
      template: TEMPLATE,
      overlays: [overlayLayer(empty)],
    })
    expect(policy.layers.map((layer) => layer.layer)).toEqual(['template', 'overlay'])
    expect(policy.layers[1]?.ruleCount).toBe(0)
    expect(policy.fallback).toEqual({ layer: 'template', effect: 'deny' })
  })
})

/** The coordinator isolation requirement + the PR1 port consumption shape. */
describe('MemberInstance isolation (two overlays never cross)', () => {
  it('the overlay of instance A changes A only; instance B keeps the static answer', () => {
    const overlayA = snapshot(1, [overlayRule('write', KEY_A, 'allow')], {
      memberInstanceId: INSTANCE_A,
      mutationId: 'mut-for-a',
    })
    const overlayB = snapshot(1, [overlayRule('write', KEY_A, 'deny')], {
      memberInstanceId: INSTANCE_B,
      mutationId: 'mut-for-b',
    })
    const args = {
      teamSessionId: TEAM_SESSION,
      blueprint: BLUEPRINT,
      template: TEMPLATE,
    }
    const a = assembleEffectivePermission(
      { ...args, memberInstanceId: INSTANCE_A, overlays: [overlayLayer(overlayA)] },
      WRITE_A,
    ).decision
    const b = assembleEffectivePermission(
      { ...args, memberInstanceId: INSTANCE_B, overlays: [overlayLayer(overlayB)] },
      WRITE_A,
    ).decision
    expect(a.decision).toBe('allow')
    expect(a.provenance?.overlayAuthority?.mutationId).toBe('mut-for-a')
    expect(b.decision).toBe('deny')
    expect(b.provenance?.overlayAuthority?.mutationId).toBe('mut-for-b')
    expect(a.overriddenLower.length).toBe(2)
    expect(b.overriddenLower.length).toBe(2)
  })

  it('a snapshot of another MemberInstance is REFUSED, not filtered out (fail closed)', () => {
    const foreign = snapshot(1, [overlayRule('write', KEY_A, 'allow')], { memberInstanceId: INSTANCE_B })
    const thrown = capture(() =>
      assembleEffectivePermission(
        {
          teamSessionId: TEAM_SESSION,
          memberInstanceId: INSTANCE_A,
          template: TEMPLATE,
          overlays: [overlayLayer(foreign)],
        },
        WRITE_A,
      ),
    )
    expect(thrown.ok).toBe(false)
    if (thrown.ok) return
    expect(errorCode(thrown.error)).toBe('EFFECTIVE_PERMISSION_IDENTITY_MISMATCH')
    expect(errorProblem(thrown.error)).toBe('overlay-identity-mismatch')
  })

  it('a snapshot of another TeamSession is refused too (no cross-session leak)', () => {
    const foreign = snapshot(1, [overlayRule('write', KEY_A, 'allow')], {
      teamSessionId: OTHER_TEAM_SESSION,
      memberInstanceId: INSTANCE_A,
    })
    const thrown = capture(() =>
      assembleEffectivePermission(
        {
          teamSessionId: TEAM_SESSION,
          memberInstanceId: INSTANCE_A,
          template: TEMPLATE,
          overlays: [overlayLayer(foreign)],
        },
        WRITE_A,
      ),
    )
    expect(thrown.ok).toBe(false)
    if (thrown.ok) return
    expect(errorCode(thrown.error)).toBe('EFFECTIVE_PERMISSION_IDENTITY_MISMATCH')
  })

  it('the decision and the policy both carry the identity they were assembled for', () => {
    const { policy, decision } = assembleEffectivePermission(
      { teamSessionId: TEAM_SESSION, memberInstanceId: INSTANCE_B, template: TEMPLATE },
      WRITE_A,
    )
    expect(policy.memberInstanceId).toBe(INSTANCE_B)
    expect(decision.memberInstanceId).toBe(INSTANCE_B)
    expect(decision.teamSessionId).toBe(TEAM_SESSION)
  })

  it('consumes the PR1 port output shape: `latest` is the authority, `history` is audit-only', async () => {
    const generation1 = snapshot(1, [overlayRule('write', KEY_A, 'allow')], { mutationId: 'mut-old' })
    const generation2 = snapshot(2, [overlayRule('write', KEY_A, 'deny')], { mutationId: 'mut-new' })
    const port = stubOverlayPort([generation1, generation2])
    const identity = { teamSessionId: TEAM_SESSION, memberInstanceId: INSTANCE_A }
    const authority = await port.latest(identity)
    if (authority === undefined) {
      throw new Error('the stub port must answer `latest` for the fixture identity')
    }
    expect(authority.snapshotId).toBe(`${TEAM_SESSION}#${INSTANCE_A}#2`)
    const history = await port.history(identity)
    expect(history.map((row) => row.metadata.generation)).toEqual([1, 2])

    const fromLatest = assembleEffectivePermission(
      { ...identity, template: TEMPLATE, overlays: [overlayLayer(authority)] },
      WRITE_A,
    ).decision
    expect(fromLatest.decision).toBe('deny')
    expect(fromLatest.provenance?.overlayAuthority?.mutationId).toBe('mut-new')

    // Handing the whole history in does not fold it: the highest generation
    // decides, exactly as `latest` did.
    const fromHistory = assembleEffectivePermission(
      { ...identity, template: TEMPLATE, overlays: history.map((row) => overlayLayer(row)) },
      WRITE_A,
    ).decision
    expect(fromHistory.decision).toBe(fromLatest.decision)
    expect(fromHistory.provenance).toEqual(fromLatest.provenance)
  })
})

/** Nothing is guessed: every ambiguous authority input is a typed refusal. */
describe('fail-closed validation (no silent authority)', () => {
  it('a view that misstates the snapshot effect is refused', () => {
    const overlay = snapshot(1, [overlayRule('write', KEY_A, 'deny')])
    const thrown = capture(() =>
      assembleEffectivePermission(
        {
          teamSessionId: TEAM_SESSION,
          memberInstanceId: INSTANCE_A,
          overlays: [
            overlayLayer(overlay, {
              view: (rule, ruleIndex) => ({ ruleIndex, lane: 'allow', rule: exactRule('write', rule.resource) }),
            }),
          ],
        },
        WRITE_A,
      ),
    )
    expect(thrown.ok).toBe(false)
    if (thrown.ok) return
    expect(errorCode(thrown.error)).toBe('EFFECTIVE_PERMISSION_OVERLAY_EFFECT_MISMATCH')
    expect(errorProblem(thrown.error)).toBe('overlay-effect-mismatch')
  })

  it('a rule view addressing a snapshot rule that does not exist is refused', () => {
    const overlay = snapshot(1, [overlayRule('write', KEY_A, 'allow')])
    const thrown = capture(() =>
      assembleEffectivePermission(
        {
          teamSessionId: TEAM_SESSION,
          memberInstanceId: INSTANCE_A,
          overlays: [{ snapshot: overlay, rules: [{ ruleIndex: 7, lane: 'allow', rule: exactRule('write', KEY_A) }] }],
        },
        WRITE_A,
      ),
    )
    expect(thrown.ok).toBe(false)
    if (thrown.ok) return
    expect(errorCode(thrown.error)).toBe('EFFECTIVE_PERMISSION_OVERLAY_RULE_REFERENCE_INVALID')
    expect(errorProblem(thrown.error)).toBe('overlay-rule-index-out-of-range')
  })

  it('the same snapshot rule addressed twice is refused (an ambiguous lane entry)', () => {    const overlay = snapshot(1, [overlayRule('write', KEY_A, 'allow')])
    const view = { ruleIndex: 0, lane: 'allow' as const, rule: exactRule('write', KEY_A) }
    const thrown = capture(() =>
      assembleEffectivePermission(
        {
          teamSessionId: TEAM_SESSION,
          memberInstanceId: INSTANCE_A,
          overlays: [{ snapshot: overlay, rules: [view, view] }],
        },
        WRITE_A,
      ),
    )
    expect(thrown.ok).toBe(false)
    if (thrown.ok) return
    expect(errorCode(thrown.error)).toBe('EFFECTIVE_PERMISSION_OVERLAY_RULE_REFERENCE_INVALID')
    expect(errorProblem(thrown.error)).toBe('overlay-rule-index-duplicate')
  })

  it('an OMITTED view of a snapshot rule is refused: a FULL snapshot is read in full', () => {
    // The durable snapshot carries two rules (PR1 rejects a repeated
    // (operation, resource) pair, so the second row carries a distinct carrier
    // token; both canonicalize onto the SAME key, which is what makes the pair a
    // real allow/deny tension for this operation). Supplying only the `allow`
    // view is not a smaller overlay — it is a truncated reading that would
    // silently retire the snapshot's `deny` row and answer `allow` while still
    // reporting that the overlay layer decided.
    const overlay = snapshot(1, [overlayRule('write', KEY_A, 'allow'), overlayRule('write', `${KEY_A}#row-2`, 'deny')])
    const allowOnly = { ruleIndex: 0, lane: 'allow' as const, rule: exactRule('write', KEY_A) }
    const thrown = capture(() =>
      assembleEffectivePermission(
        {
          teamSessionId: TEAM_SESSION,
          memberInstanceId: INSTANCE_A,
          template: staticLayer({ label: 'tpl-worker', default: 'deny', allow: [], ask: [], deny: [] }),
          overlays: [{ snapshot: overlay, rules: [allowOnly] }],
        },
        WRITE_A,
      ),
    )
    expect(thrown.ok).toBe(false)
    if (thrown.ok) return
    expect(errorCode(thrown.error)).toBe('EFFECTIVE_PERMISSION_OVERLAY_RULE_REFERENCE_INVALID')
    expect(errorProblem(thrown.error)).toBe('overlay-rule-view-incomplete')
    // The refusal names exactly what was left out, so a caller fixing the view
    // does not have to diff the snapshot by hand.
    expect(errorDetail(thrown.error, 'missingRuleIndexes')).toEqual([1])
    expect(errorDetail(thrown.error, 'snapshotRuleCount')).toBe(2)
    expect(errorDetail(thrown.error, 'viewCount')).toBe(1)
  })

  it('empty views against a non-empty snapshot are refused (the overlay cannot vanish)', () => {
    // The smallest legal form of the same defect: ONE durable deny rule, no view
    // for it, and a Template that allows the operation. Without the coverage
    // check the dynamic layer assembles EMPTY, the snapshot's deny never applies,
    // and the answer is the template's `allow` — a durable deny silently
    // inverted by an omission three lines from the call site.
    const overlay = snapshot(1, [overlayRule('write', KEY_A, 'deny')])
    const input = {
      teamSessionId: TEAM_SESSION,
      memberInstanceId: INSTANCE_A,
      template: staticLayer({ label: 'tpl-worker', default: 'deny', allow: [exactRule('write', KEY_A)], ask: [], deny: [] }),
    }
    const thrown = capture(() =>
      assembleEffectivePermission({ ...input, overlays: [{ snapshot: overlay, rules: [] }] }, WRITE_A),
    )
    expect(thrown.ok).toBe(false)
    if (thrown.ok) return
    expect(errorCode(thrown.error)).toBe('EFFECTIVE_PERMISSION_OVERLAY_RULE_REFERENCE_INVALID')
    expect(errorProblem(thrown.error)).toBe('overlay-rule-view-incomplete')
    expect(errorDetail(thrown.error, 'missingRuleIndexes')).toEqual([0])
    expect(errorDetail(thrown.error, 'generation')).toBe(1)

    // Full coverage of the same snapshot is unaffected: the overlay deny still
    // beats the template allow (the behaviour every other leg relies on).
    const { decision } = assembleEffectivePermission({ ...input, overlays: [overlayLayer(overlay)] }, WRITE_A)
    expect(decision.decision).toBe('deny')
    expect(decision.winningLayer).toBe('overlay')
  })

  it('an overlay snapshot that carries no rules at all still assembles, with no views', () => {
    // The coverage rule is exact, not "non-empty": 0 rows read by 0 views is a
    // complete (if empty) reading of the authority, and the layer stays present
    // with its authority for the audit trail.
    const empty = snapshot(2, [])
    const policy = assembleEffectivePermissionPolicy({
      teamSessionId: TEAM_SESSION,
      memberInstanceId: INSTANCE_A,
      template: staticLayer({ label: 'tpl-worker', default: 'deny', allow: [exactRule('write', KEY_A)], ask: [], deny: [] }),
      overlays: [overlayLayer(empty)],
    })
    const layer = policy.layers.find((entry) => entry.layer === 'overlay')
    expect(layer?.ruleCount).toBe(0)
    expect(layer?.authority?.generation).toBe(2)
  })

  it('two different snapshots claiming ONE generation are an ambiguous authority and are refused', () => {
    const first = snapshot(1, [overlayRule('write', KEY_A, 'allow')], { mutationId: 'mut-x' })
    const second = snapshot(1, [overlayRule('write', KEY_B, 'allow')], { mutationId: 'mut-y' })
    const thrown = capture(() =>
      assembleEffectivePermission(
        {
          teamSessionId: TEAM_SESSION,
          memberInstanceId: INSTANCE_A,
          overlays: [overlayLayer(first), overlayLayer(second)],
        },
        WRITE_A,
      ),
    )
    expect(thrown.ok).toBe(false)
    if (thrown.ok) return
    expect(errorCode(thrown.error)).toBe('EFFECTIVE_PERMISSION_AUTHORITY_CONFLICT')
    expect(errorProblem(thrown.error)).toBe('generation-claims-two-snapshots')
  })

  it('the identical snapshot handed in twice is the same authority and is accepted', () => {
    const only = snapshot(1, [overlayRule('write', KEY_A, 'allow')])
    const { decision } = assembleEffectivePermission(
      {
        teamSessionId: TEAM_SESSION,
        memberInstanceId: INSTANCE_A,
        template: TEMPLATE,
        overlays: [overlayLayer(only), overlayLayer(only)],
      },
      WRITE_A,
    )
    expect(decision.decision).toBe('allow')
    expect(decision.provenance?.overlayAuthority?.snapshotId).toBe(only.snapshotId)
  })

  it('the same snapshot supplied twice with a DIFFERENT canonical view is refused', () => {
    const only = snapshot(1, [overlayRule('write', KEY_A, 'allow')])
    const thrown = capture(() =>
      assembleEffectivePermission(
        {
          teamSessionId: TEAM_SESSION,
          memberInstanceId: INSTANCE_A,
          overlays: [
            overlayLayer(only),
            overlayLayer(only, {
              view: (rule, ruleIndex) => ({ ruleIndex, lane: rule.effect, rule: exactRule('write', 'fskey:/other') }),
            }),
          ],
        },
        WRITE_A,
      ),
    )
    expect(thrown.ok).toBe(false)
    if (thrown.ok) return
    expect(errorCode(thrown.error)).toBe('EFFECTIVE_PERMISSION_AUTHORITY_CONFLICT')
    expect(errorProblem(thrown.error)).toBe('overlay-authority-view-mismatch')
  })

  it('the same canonical mapping supplied in a DIFFERENT ORDER is the same authority', () => {
    // Lane contents are normalized to the snapshot's declaration order before
    // they are compared (and before they reach the matcher), so the ORDER the
    // caller happened to hand the views over in carries no meaning. Reading it
    // as a conflict would make a purely cosmetic difference — a caller iterating
    // its canonicalization map the other way round — look like two
    // irreconcilable interpretations of one authority.
    const many = snapshot(1, [
      overlayRule('write', KEY_A, 'allow'),
      overlayRule('write', KEY_B, 'ask'),
      overlayRule('read', KEY_A, 'deny'),
    ])
    const forward = overlayLayer(many)
    const reversed = overlayLayer(many, { rules: [...forward.rules].reverse() })
    const { decision } = assembleEffectivePermission(
      {
        teamSessionId: TEAM_SESSION,
        memberInstanceId: INSTANCE_A,
        template: TEMPLATE,
        overlays: [forward, reversed],
      },
      WRITE_A,
    )
    expect(decision.decision).toBe('allow')
    expect(decision.winningLayer).toBe('overlay')
    // The assembled layer is byte-identical either way: order never reaches the
    // matcher, so neither the answer nor the audit can depend on it.
    const policy = assembleEffectivePermissionPolicy({
      teamSessionId: TEAM_SESSION,
      memberInstanceId: INSTANCE_A,
      template: TEMPLATE,
      overlays: [forward],
    })
    const policyReversed = assembleEffectivePermissionPolicy({
      teamSessionId: TEAM_SESSION,
      memberInstanceId: INSTANCE_A,
      template: TEMPLATE,
      overlays: [reversed],
    })
    expect(policy).toEqual(policyReversed)
  })

  it('the same snapshot supplied twice with a DIFFERENT canonical view is still refused', () => {
    // Order-insensitive, content-SENSITIVE: a second copy that maps a row onto a
    // different canonical rule is a genuine second interpretation, and it stays
    // a typed conflict.
    const only = snapshot(1, [overlayRule('write', KEY_A, 'allow'), overlayRule('write', KEY_B, 'allow')])
    const first = overlayLayer(only)
    const remapped = overlayLayer(only, {
      rules: first.rules.map((view, index) =>
        index === 0 ? { ...view, rule: exactRule('write', 'fskey:/other') } : view,
      ),
    })
    const thrown = capture(() =>
      assembleEffectivePermission(
        {
          teamSessionId: TEAM_SESSION,
          memberInstanceId: INSTANCE_A,
          overlays: [first, remapped],
        },
        WRITE_A,
      ),
    )
    expect(thrown.ok).toBe(false)
    if (thrown.ok) return
    expect(errorCode(thrown.error)).toBe('EFFECTIVE_PERMISSION_AUTHORITY_CONFLICT')
    expect(errorProblem(thrown.error)).toBe('overlay-authority-view-mismatch')
  })

  it('the exported layer vocabulary cannot be mutated in place', () => {
    // The layer order is the ADR §4 rule itself. `as const` is a TYPE-level
    // promise: one consumer calling `.sort()` / `.reverse()` on the exported
    // array would silently invert the precedence for every other caller in the
    // process, with no error anywhere. Frozen, that call is a no-op (strict mode)
    // instead of a process-wide precedence edit.
    expect(Object.isFrozen(EFFECTIVE_PERMISSION_LAYERS)).toBe(true)
    expect(Object.isFrozen(EFFECTIVE_PERMISSION_LOOKUP_ORDER)).toBe(true)
    expect(Object.isFrozen(EFFECTIVE_PERMISSION_ASSEMBLY_ERROR_CODE_VALUES)).toBe(true)
    expect(Object.isFrozen(EFFECTIVE_PERMISSION_ASSEMBLY_ERROR_CODES)).toBe(true)
    expect(EFFECTIVE_PERMISSION_ASSEMBLY_ERROR_CODE_VALUES).toContain(
      'EFFECTIVE_PERMISSION_OVERLAY_RULE_REFERENCE_INVALID',
    )
    const orderBefore = [...EFFECTIVE_PERMISSION_LOOKUP_ORDER]
    try {
      ;(EFFECTIVE_PERMISSION_LOOKUP_ORDER as string[]).sort()
    } catch {
      // frozen arrays in strict mode: sorted in place is a TypeError — either
      // outcome must leave the vocabulary untouched.
    }
    expect(EFFECTIVE_PERMISSION_LOOKUP_ORDER).toEqual(orderBefore)
    expect(EFFECTIVE_PERMISSION_LOOKUP_ORDER).toEqual(['overlay', 'template', 'blueprint'])
    expect(EFFECTIVE_PERMISSION_LAYERS).toEqual(['blueprint', 'template', 'overlay'])
  })

  it('a malformed canonical rule is refused (the matcher input is validated, not guessed)', () => {
    const overlay = snapshot(1, [overlayRule('write', KEY_A, 'allow')])
    const badResource = capture(() =>
      assembleEffectivePermission(
        {
          teamSessionId: TEAM_SESSION,
          memberInstanceId: INSTANCE_A,
          overlays: [
            {
              snapshot: overlay,
              rules: [
                {
                  ruleIndex: 0,
                  lane: 'allow',
                  rule: { tool: 'write', resource: { kind: 'prefix', path: KEY_A } } as never,
                },
              ],
            },
          ],
        },
        WRITE_A,
      ),
    )
    expect(badResource.ok).toBe(false)
    if (badResource.ok) return
    expect(errorCode(badResource.error)).toBe('EFFECTIVE_PERMISSION_RULE_MALFORMED')
    expect(errorProblem(badResource.error)).toBe('rule-resource-kind-unknown')

    const badKey = capture(() =>
      assembleEffectivePermission(
        {
          teamSessionId: TEAM_SESSION,
          memberInstanceId: INSTANCE_A,
          overlays: [{ snapshot: overlay, rules: [{ ruleIndex: 0, lane: 'allow', rule: exactRule('write', '') }] }],
        },
        WRITE_A,
      ),
    )
    expect(badKey.ok).toBe(false)
    if (badKey.ok) return
    expect(errorCode(badKey.error)).toBe('EFFECTIVE_PERMISSION_RULE_MALFORMED')
    expect(errorProblem(badKey.error)).toBe('rule-exact-key-empty')
  })

  it('a malformed static layer is refused', () => {
    const badDefault = capture(() =>
      assembleEffectivePermission(
        {
          teamSessionId: TEAM_SESSION,
          memberInstanceId: INSTANCE_A,
          template: { default: 'allow' as never, rules: { allow: [], ask: [], deny: [] } },
        },
        WRITE_A,
      ),
    )
    expect(badDefault.ok).toBe(false)
    if (badDefault.ok) return
    expect(errorCode(badDefault.error)).toBe('EFFECTIVE_PERMISSION_LAYER_MALFORMED')
    expect(errorProblem(badDefault.error)).toBe('layer-default-outside-closed-set')

    const badLane = capture(() =>
      assembleEffectivePermission(
        {
          teamSessionId: TEAM_SESSION,
          memberInstanceId: INSTANCE_A,
          blueprint: { default: 'deny', rules: { allow: 'nope' as never, ask: [], deny: [] } },
        },
        WRITE_A,
      ),
    )
    expect(badLane.ok).toBe(false)
    if (badLane.ok) return
    expect(errorCode(badLane.error)).toBe('EFFECTIVE_PERMISSION_LAYER_MALFORMED')
    expect(errorProblem(badLane.error)).toBe('layer-lane-not-an-array')
  })

  it('a malformed assembly identity is refused before any decision is produced', () => {
    const thrown = capture(() =>
      assembleEffectivePermission(
        { teamSessionId: '', memberInstanceId: INSTANCE_A, template: TEMPLATE },
        WRITE_A,
      ),
    )
    expect(thrown.ok).toBe(false)
    if (thrown.ok) return
    expect(errorCode(thrown.error)).toBe('EFFECTIVE_PERMISSION_ASSEMBLY_INPUT_MALFORMED')
    expect(errorProblem(thrown.error)).toBe('assembly-identity-malformed')
  })
})

describe('purity, determinism, and zero production wiring', () => {
  /** A full three-layer fixture built fresh each call (fresh-but-equal inputs). */
  function fixture(): EffectivePermissionAssemblyInput {
    const overlay = snapshot(2, [overlayRule('write', KEY_A, 'allow'), overlayRule('read', KEY_B, 'ask')])
    return {
      teamSessionId: TEAM_SESSION,
      memberInstanceId: INSTANCE_A,
      blueprint: BLUEPRINT,
      template: TEMPLATE,
      overlays: [overlayLayer(overlay)],
    }
  }

  it('the same input yields a deeply-equal decision, across fresh-but-equal input objects', () => {
    const first = assembleEffectivePermission(fixture(), WRITE_A).decision
    const second = assembleEffectivePermission(fixture(), WRITE_A).decision
    expect(second).toEqual(first)
    expect(second.explanation).toBe(first.explanation)
  })

  it('nothing is mutated: the snapshots and the caller-owned lane arrays are byte-stable across assembly', () => {
    const input = fixture()
    const before = deepClone(input)
    const snapshotBefore = deepClone(input.overlays?.[0]?.snapshot ?? null)
    assembleEffectivePermission(input, WRITE_A)
    expect(deepClone(input)).toEqual(before)
    expect(deepClone(input.overlays?.[0]?.snapshot ?? null)).toEqual(snapshotBefore)
  })

  it('both outputs are deeply frozen (the Alpha.2 resolver convention)', () => {
    const { policy, decision } = assembleEffectivePermission(fixture(), WRITE_A)
    expect(isDeepFrozen(policy)).toBe(true)
    expect(isDeepFrozen(decision)).toBe(true)
  })

  it('the input snapshot object is the PR1 frozen record — the assembler keeps it that way (no copy-on-read rewrite of authority)', () => {
    const input = fixture()
    const original = input.overlays?.[0]?.snapshot
    expect(Object.isFrozen(original)).toBe(true)
    const { policy } = assembleEffectivePermission(input, WRITE_A)
    const view = policy.layers[2]?.authority
    expect(view?.snapshotId).toBe(original?.snapshotId)
  })

  it('PR2 wires NOTHING: no production source imports the assembler or calls it', () => {
    const roots = [
      '../../runtime/src',
      '../../runtime/operation-permission',
      '../../runtime/permission-governance',
      '../../tools/src',
      '../../remote/src',
      '../../client/src',
    ]
    const needles = ['permission-assembler', 'assembleEffectivePermission', 'assembleEffectivePermissionPolicy']
    const offenders: string[] = []
    for (const root of roots) {
      const stack = [join(HERE, root)]
      while (stack.length > 0) {
        const current = stack.pop()
        if (current === undefined) continue
        for (const entry of readdirSync(current)) {
          if (entry === 'dist' || entry === 'node_modules') continue
          const path = join(current, entry)
          if (statSync(path).isDirectory()) {
            stack.push(path)
            continue
          }
          if (!/\.(?:ts|tsx|mts|mjs)$/.test(entry)) continue
          const text = readFileSync(path, 'utf8')
          if (needles.some((needle) => text.includes(needle))) {
            offenders.push(path)
          }
        }
      }
    }
    expect(offenders).toEqual([])
  })
})
