/**
 * a3p2-permission-assembler-precedence.test.ts — Alpha.3 PR2 MUST-TEST
 * (implementation plan `PR2 → Tests`: "overlay overrides static deny;
 * fallback; same-layer deny/ask/allow; provenance") — the LAYER SEMANTICS
 * half; provenance and MemberInstance isolation live in
 * `a3p2-permission-assembler-provenance.test.ts`.
 *
 * Pinned contract (ADR §4 / design §3.1, verbatim):
 *
 *     MemberInstance overlay  >  Template static permission  >  Blueprint baseline
 *     within one layer:  deny > ask > allow
 *     "Do not implement global deny precedence."
 *
 * so the decision rule is: a HIGHER layer whose rules MATCH the operation
 * wins over every lower layer; only WITHIN one layer does `deny > ask > allow`
 * apply; ABSENCE of a match falls through to the next lower layer. The naive
 * readings design §3.1 calls incorrect — field-level overwrite of one merged
 * rule set, and "all denies globally override all allows" — are pinned here in
 * the strong sense: each leg is built so that either naive reading would
 * produce a DIFFERENT answer than the frozen one.
 *
 * The matching itself is not re-implemented: every per-layer outcome is the
 * frozen Alpha.2 resolver's own answer for that layer (one
 * `resolveOperationPermission` call per layer, matched-vs-default read off
 * `provenance.source`). One leg pins that equivalence directly against the
 * resolver.
 *
 * Offline, host-free, in-memory: no store, no seam, no port binding, no model,
 * no network. Canonical rules are opaque-key literals (canonicalization is
 * A5's, per the A3 input contract).
 *
 * SELF-CLEANLINESS: inside the P4-T6 whole-tree scanner's scope; carries zero
 * denylist vocabulary.
 *
 * @module @dsh-agent-team/runtime/test/a3p2-permission-assembler-precedence
 */
import { describe, expect, it } from 'vitest'
import { resolveOperationPermission } from '../operation-permission/index.js'
import { assembleEffectivePermission } from '../effective-policy/index.js'
import {
  a1PolicyOf,
  anyRule,
  exactRule,
  fileOp,
  INSTANCE_A,
  overlayLayer,
  overlayRule,
  shellOp,
  snapshot,
  staticLayer,
  subtreeRule,
  TEAM_SESSION,
} from './effective-permission-assembler-helpers.js'

const KEY_A = 'fskey:/workspace/a.txt'
const KEY_B = 'fskey:/workspace/b.txt'
const SUB_ROOT = 'fskey:/workspace/sub'

const WRITE_A = fileOp('write', KEY_A)

/** design §2 + plan §PR2 "overlay overrides static deny". */
describe('overlay overrides static deny (ADR §4, design §2)', () => {
  it('an overlay ALLOW wins over a template deny AND a blueprint deny on the same operation', () => {
    const overlay = snapshot(1, [overlayRule('write', KEY_A, 'allow')])
    const { decision } = assembleEffectivePermission(
      {
        teamSessionId: TEAM_SESSION,
        memberInstanceId: INSTANCE_A,
        blueprint: staticLayer({ default: 'deny', deny: [exactRule('write', KEY_A)] }),
        template: staticLayer({ label: 'tpl-worker', default: 'deny', deny: [exactRule('write', KEY_A)] }),
        overlays: [overlayLayer(overlay)],
      },
      WRITE_A,
    )
    expect(decision.decision).toBe('allow')
    expect(decision.winningLayer).toBe('overlay')
    expect(decision.source).toBe('rule')
  })

  it('the design §2 example verbatim: blueprint ask, overlay allow → allow (source = the Leader mutation)', () => {
    const overlay = snapshot(1, [overlayRule('write', 'output/result.json', 'allow')], {
      actor: 'leader:inst-root',
      mutationId: 'mut-1',
    })
    const { decision } = assembleEffectivePermission(
      {
        teamSessionId: TEAM_SESSION,
        memberInstanceId: INSTANCE_A,
        blueprint: staticLayer({ default: 'deny', ask: [exactRule('write', 'output/result.json')] }),
        overlays: [overlayLayer(overlay)],
      },
      fileOp('write', 'output/result.json'),
    )
    expect(decision.decision).toBe('allow')
    expect(decision.provenance?.overlayAuthority?.mutationId).toBe('mut-1')
    expect(decision.provenance?.overlayAuthority?.actor).toBe('leader:inst-root')
  })

  it('a higher layer wins in every effect direction (overlay ask > template allow, template deny > blueprint allow)', () => {
    const overlay = snapshot(1, [overlayRule('write', KEY_A, 'ask')])
    const askWins = assembleEffectivePermission(
      {
        teamSessionId: TEAM_SESSION,
        memberInstanceId: INSTANCE_A,
        template: staticLayer({ default: 'deny', allow: [exactRule('write', KEY_A)] }),
        overlays: [overlayLayer(overlay)],
      },
      WRITE_A,
    ).decision
    expect(askWins.decision).toBe('ask')
    expect(askWins.winningLayer).toBe('overlay')

    const templateWins = assembleEffectivePermission(
      {
        teamSessionId: TEAM_SESSION,
        memberInstanceId: INSTANCE_A,
        blueprint: staticLayer({ default: 'deny', allow: [exactRule('write', KEY_A)] }),
        template: staticLayer({ default: 'deny', deny: [exactRule('write', KEY_A)] }),
      },
      WRITE_A,
    ).decision
    expect(templateWins.decision).toBe('deny')
    expect(templateWins.winningLayer).toBe('template')
  })

  it('NO global-deny shortcut: a lower-layer deny never suppresses a higher-layer allow', () => {
    // design §3.1 "Incorrect: all denies globally override all allows" would
    // answer `deny` here. Under a merged-flat-rule-set reading the deny and
    // ask lanes of BOTH lower layers are also in the set, so that reading
    // answers deny too; only the frozen layer order answers allow.
    const overlay = snapshot(1, [overlayRule('write', KEY_A, 'allow')])
    const first = assembleEffectivePermission(
      {
        teamSessionId: TEAM_SESSION,
        memberInstanceId: INSTANCE_A,
        blueprint: staticLayer({ default: 'deny', deny: [exactRule('write', KEY_A)] }),
        template: staticLayer({
          default: 'deny',
          deny: [exactRule('write', KEY_A)],
          ask: [exactRule('write', KEY_A)],
        }),
        overlays: [overlayLayer(overlay)],
      },
      WRITE_A,
    ).decision
    expect(first.decision).toBe('allow')
    expect(first.winningLayer).toBe('overlay')
    // Both lower layers matched and lost — recorded, in precedence order.
    expect(first.overriddenLower.map((entry) => entry.layer)).toEqual(['template', 'blueprint'])
    expect(first.overriddenLower.map((entry) => entry.lane)).toEqual(['deny', 'deny'])
    const templateOutcome = first.layers.find((layer) => layer.layer === 'template')
    expect(templateOutcome?.matchedLanes).toEqual(['deny', 'ask'])
  })

  it('a higher-layer rule that does not address this operation never shadows the lower deny', () => {
    // The regression guard for "merge into one flat rule set, then decide":
    // the overlay rule addresses KEY_B, so for KEY_A the overlay layer has NO
    // match and the lower deny must decide. A merged-set reading would let
    // KEY_B's allow into the same decision.
    const overlay = snapshot(1, [overlayRule('write', KEY_B, 'allow')])
    const { decision } = assembleEffectivePermission(
      {
        teamSessionId: TEAM_SESSION,
        memberInstanceId: INSTANCE_A,
        template: staticLayer({ default: 'deny', deny: [exactRule('write', KEY_A)] }),
        overlays: [overlayLayer(overlay)],
      },
      WRITE_A,
    )
    expect(decision.decision).toBe('deny')
    expect(decision.winningLayer).toBe('template')
    expect(decision.layers.find((layer) => layer.layer === 'overlay')?.matched).toBe(false)
  })
})

/** plan §PR2 "fallback": no higher-layer match falls to the next lower layer. */
describe('fallback (absence falls through, it never inherits)', () => {
  it('no overlay match → the template decides; no template match → the blueprint decides', () => {
    const overlay = snapshot(1, [overlayRule('read', KEY_B, 'allow')])
    const args = {
      teamSessionId: TEAM_SESSION,
      memberInstanceId: INSTANCE_A,
      blueprint: staticLayer({
        default: 'deny',
        deny: [exactRule('read', KEY_A)],
        allow: [exactRule('write', KEY_B)],
      }),
      template: staticLayer({ default: 'deny', ask: [exactRule('read', KEY_A)] }),
      overlays: [overlayLayer(overlay)],
    }
    const templateDecides = assembleEffectivePermission(args, fileOp('read', KEY_A)).decision
    expect(templateDecides.decision).toBe('ask')
    expect(templateDecides.winningLayer).toBe('template')

    const blueprintDecides = assembleEffectivePermission(args, fileOp('write', KEY_B)).decision
    expect(blueprintDecides.decision).toBe('allow')
    expect(blueprintDecides.winningLayer).toBe('blueprint')
  })

  it('an absent layer is skipped, not treated as a deny', () => {
    const { decision } = assembleEffectivePermission(
      {
        teamSessionId: TEAM_SESSION,
        memberInstanceId: INSTANCE_A,
        blueprint: staticLayer({ default: 'deny', allow: [exactRule('write', KEY_A)] }),
      },
      WRITE_A,
    )
    expect(decision.decision).toBe('allow')
    expect(decision.winningLayer).toBe('blueprint')
    expect(decision.layers.map((layer) => layer.layer)).toEqual(['blueprint'])
  })

  it('every layer is consulted (so the audit names what lost), but precedence picks the highest match', () => {
    const overlay = snapshot(1, [overlayRule('write', KEY_A, 'allow')])
    const { decision } = assembleEffectivePermission(
      {
        teamSessionId: TEAM_SESSION,
        memberInstanceId: INSTANCE_A,
        blueprint: staticLayer({ default: 'deny', deny: [exactRule('write', KEY_A)] }),
        template: staticLayer({ default: 'deny', deny: [exactRule('write', KEY_A)] }),
        overlays: [overlayLayer(overlay)],
      },
      WRITE_A,
    )
    expect(decision.layers.map((layer) => [layer.layer, layer.matched])).toEqual([
      ['overlay', true],
      ['template', true],
      ['blueprint', true],
    ])
    expect(decision.winningLayer).toBe('overlay')
    expect(decision.overriddenLower.map((entry) => entry.layer)).toEqual(['template', 'blueprint'])
  })
})

/** plan §PR2 "same-layer deny/ask/allow" — only WITHIN the winning layer. */
describe('same-layer priority deny > ask > allow (and only within one layer)', () => {
  it('a template layer with matching deny + ask + allow decides deny, provenance names the deny lane', () => {
    const { decision } = assembleEffectivePermission(
      {
        teamSessionId: TEAM_SESSION,
        memberInstanceId: INSTANCE_A,
        template: staticLayer({
          default: 'ask',
          allow: [exactRule('write', KEY_A)],
          ask: [exactRule('write', KEY_A)],
          deny: [exactRule('write', KEY_A)],
        }),
      },
      WRITE_A,
    )
    expect(decision.decision).toBe('deny')
    expect(decision.provenance?.lane).toBe('deny')
    expect(decision.provenance?.ruleIndexInLane).toBe(0)
  })

  it('matching ask + allow (no matching deny) decides ask; matching allow only decides allow', () => {
    const askLayer = {
      teamSessionId: TEAM_SESSION,
      memberInstanceId: INSTANCE_A,
      template: staticLayer({
        default: 'deny',
        allow: [exactRule('write', KEY_A)],
        ask: [exactRule('write', KEY_A)],
      }),
    }
    expect(assembleEffectivePermission(askLayer, WRITE_A).decision.decision).toBe('ask')
    const allowOnly = {
      teamSessionId: TEAM_SESSION,
      memberInstanceId: INSTANCE_A,
      template: staticLayer({ default: 'deny', allow: [exactRule('write', KEY_A)] }),
    }
    expect(assembleEffectivePermission(allowOnly, WRITE_A).decision.decision).toBe('allow')
  })

  it('the same-layer priority applies INSIDE the overlay layer too (matching allow + deny in one snapshot → deny)', () => {
    // PR1's structural gate forbids two rules on ONE (operation, resource)
    // pair, so the fixture spells the tightening as a second resource token
    // that the overlay interpretation maps onto the same operation (e.g. a
    // subtree tightening of the same grant).
    const overlay = snapshot(1, [
      overlayRule('write', KEY_A, 'allow'),
      overlayRule('write', `${KEY_A}#tightening`, 'deny'),
    ])
    const { decision } = assembleEffectivePermission(
      {
        teamSessionId: TEAM_SESSION,
        memberInstanceId: INSTANCE_A,
        template: staticLayer({ default: 'ask', allow: [exactRule('write', KEY_A)] }),
        overlays: [
          overlayLayer(overlay, {
            view: (rule, ruleIndex) => ({
              ruleIndex,
              lane: rule.effect,
              rule: exactRule('write', KEY_A),
            }),
          }),
        ],
      },
      WRITE_A,
    )
    expect(decision.decision).toBe('deny')
    expect(decision.winningLayer).toBe('overlay')
    expect(decision.provenance?.lane).toBe('deny')
    expect(decision.provenance?.sourceIndex).toBe(1)
    // The losing overlay allow lost INSIDE its own layer; `overriddenLower`
    // is the cross-layer set, so it carries the template only.
    expect(decision.overriddenLower.map((entry) => entry.layer)).toEqual(['template'])
  })

  it('the first matching rule in the winning lane decides (declaration order)', () => {
    const { decision } = assembleEffectivePermission(
      {
        teamSessionId: TEAM_SESSION,
        memberInstanceId: INSTANCE_A,
        template: staticLayer({
          default: 'deny',
          allow: [exactRule('write', KEY_B), exactRule('write', KEY_A)],
        }),
      },
      WRITE_A,
    )
    expect(decision.decision).toBe('allow')
    expect(decision.provenance?.ruleIndexInLane).toBe(1)
    expect(decision.provenance?.sourceIndex).toBe(1)
  })
})

/** The frozen fallback of the whole assembly. */
describe('default (no layer matched at all)', () => {
  it('the LOWEST layer that declares a fallback answers it (blueprint wins over template)', () => {
    const { decision } = assembleEffectivePermission(
      {
        teamSessionId: TEAM_SESSION,
        memberInstanceId: INSTANCE_A,
        blueprint: staticLayer({ default: 'ask' }),
        template: staticLayer({ default: 'deny' }),
      },
      WRITE_A,
    )
    expect(decision.decision).toBe('ask')
    expect(decision.source).toBe('default')
    expect(decision.winningLayer).toBe(null)
    expect(decision.provenance).toBe(null)
    expect(decision.fallbackSource).toEqual({ layer: 'blueprint', effect: 'ask' })
  })

  it('with no blueprint layer the template fallback answers', () => {
    const { decision } = assembleEffectivePermission(
      {
        teamSessionId: TEAM_SESSION,
        memberInstanceId: INSTANCE_A,
        template: staticLayer({ default: 'deny', allow: [exactRule('read', KEY_A)] }),
      },
      WRITE_A,
    )
    expect(decision.decision).toBe('deny')
    expect(decision.fallbackSource).toEqual({ layer: 'template', effect: 'deny' })
  })

  it('an overlay never supplies the fallback: it carries no default, so the static fallback answers', () => {
    const overlay = snapshot(1, [overlayRule('write', KEY_B, 'allow')])
    const { decision } = assembleEffectivePermission(
      {
        teamSessionId: TEAM_SESSION,
        memberInstanceId: INSTANCE_A,
        template: staticLayer({ default: 'ask' }),
        overlays: [overlayLayer(overlay)],
      },
      WRITE_A,
    )
    expect(decision.decision).toBe('ask')
    expect(decision.source).toBe('default')
    expect(decision.fallbackSource).toEqual({ layer: 'template', effect: 'ask' })
  })

  it('no static layer at all fails closed to deny', () => {
    const overlay = snapshot(1, [overlayRule('read', KEY_B, 'allow')])
    const { decision } = assembleEffectivePermission(
      {
        teamSessionId: TEAM_SESSION,
        memberInstanceId: INSTANCE_A,
        overlays: [overlayLayer(overlay)],
      },
      WRITE_A,
    )
    expect(decision.decision).toBe('deny')
    expect(decision.source).toBe('default')
    expect(decision.fallbackSource).toEqual({ layer: null, effect: 'deny' })
  })
})

/** The Alpha.2 matcher is REUSED, so its answers must be its own. */
describe('Alpha.2 matching semantics reused, not reimplemented', () => {
  it('the per-layer outcome IS resolveOperationPermission for that layer (decision + lane + ruleIndex)', () => {
    const rules = {
      allow: [exactRule('write', KEY_B), exactRule('write', KEY_A)],
      ask: [exactRule('write', KEY_A)],
      deny: [exactRule('read', KEY_A)],
    }
    const layer = staticLayer({ label: 'tpl', default: 'deny', ...rules })
    const { decision } = assembleEffectivePermission(
      { teamSessionId: TEAM_SESSION, memberInstanceId: INSTANCE_A, template: layer },
      WRITE_A,
    )
    const outcome = decision.layers.find((entry) => entry.layer === 'template')
    expect(outcome).not.toBe(undefined)
    const pureAnswer = resolveOperationPermission(a1PolicyOf({ default: layer.default, ...rules }), WRITE_A, rules)
    expect(outcome?.matched).toBe(pureAnswer.provenance.source === 'rule')
    expect(outcome?.winningProvenance?.lane).toBe(pureAnswer.provenance.lane)
    expect(outcome?.winningProvenance?.ruleIndexInLane).toBe(pureAnswer.provenance.ruleIndex)
    expect(decision.decision).toBe(pureAnswer.decision)
  })

  it('an exact rule whose key differs never matches, so the operation falls through to the lower layer', () => {
    const overlay = snapshot(1, [overlayRule('write', `${KEY_A}x`, 'allow')])
    const { decision } = assembleEffectivePermission(
      {
        teamSessionId: TEAM_SESSION,
        memberInstanceId: INSTANCE_A,
        template: staticLayer({ default: 'deny', deny: [exactRule('write', KEY_A)] }),
        overlays: [overlayLayer(overlay)],
      },
      WRITE_A,
    )
    expect(decision.decision).toBe('deny')
    expect(decision.winningLayer).toBe('template')
  })

  it('a subtree rule matches on the caller-supplied containment verdict only (false → fall through)', () => {
    const contained = snapshot(1, [overlayRule('write', SUB_ROOT, 'ask')])
    const hit = assembleEffectivePermission(
      {
        teamSessionId: TEAM_SESSION,
        memberInstanceId: INSTANCE_A,
        template: staticLayer({ default: 'deny', deny: [exactRule('write', KEY_A)] }),
        overlays: [
          overlayLayer(contained, {
            view: (rule, ruleIndex) => ({
              ruleIndex,
              lane: rule.effect,
              rule: subtreeRule('write', rule.resource, true),
            }),
          }),
        ],
      },
      WRITE_A,
    ).decision
    expect(hit.decision).toBe('ask')
    expect(hit.winningLayer).toBe('overlay')

    const notContained = snapshot(1, [overlayRule('write', SUB_ROOT, 'allow')])
    const miss = assembleEffectivePermission(
      {
        teamSessionId: TEAM_SESSION,
        memberInstanceId: INSTANCE_A,
        template: staticLayer({ default: 'deny', deny: [exactRule('write', KEY_A)] }),
        overlays: [
          overlayLayer(notContained, {
            view: (rule, ruleIndex) => ({
              ruleIndex,
              lane: rule.effect,
              rule: subtreeRule('write', rule.resource, false),
            }),
          }),
        ],
      },
      WRITE_A,
    ).decision
    expect(miss.decision).toBe('deny')
    expect(miss.winningLayer).toBe('template')
  })

  it('the shell class keeps its Alpha.2 shape: an `any` overlay rule matches the shell operation, an exact one never does', () => {
    const anyOverlay = snapshot(1, [overlayRule('bash', 'any', 'deny')])
    const { decision } = assembleEffectivePermission(
      {
        teamSessionId: TEAM_SESSION,
        memberInstanceId: INSTANCE_A,
        template: staticLayer({ default: 'deny', allow: [anyRule('bash')] }),
        overlays: [overlayLayer(anyOverlay)],
      },
      shellOp('bash'),
    )
    expect(decision.decision).toBe('deny')
    expect(decision.winningLayer).toBe('overlay')

    const fileOverlay = snapshot(1, [overlayRule('bash', KEY_A, 'deny')])
    const fallsThrough = assembleEffectivePermission(
      {
        teamSessionId: TEAM_SESSION,
        memberInstanceId: INSTANCE_A,
        template: staticLayer({ default: 'deny', allow: [anyRule('bash')] }),
        overlays: [overlayLayer(fileOverlay)],
      },
      shellOp('bash'),
    ).decision
    expect(fallsThrough.decision).toBe('allow')
    expect(fallsThrough.winningLayer).toBe('template')
  })

  it('a rule for another tool never matches (write != edit, bash != pwsh)', () => {
    const overlay = snapshot(1, [overlayRule('edit', KEY_A, 'deny'), overlayRule('pwsh', 'any', 'deny')])
    const { decision } = assembleEffectivePermission(
      {
        teamSessionId: TEAM_SESSION,
        memberInstanceId: INSTANCE_A,
        template: staticLayer({ default: 'deny', allow: [exactRule('write', KEY_A)] }),
        overlays: [overlayLayer(overlay)],
      },
      WRITE_A,
    )
    expect(decision.decision).toBe('allow')
    expect(decision.winningLayer).toBe('template')
    expect(decision.layers.find((layer) => layer.layer === 'overlay')?.matched).toBe(false)
  })
})

/** Snapshot authority is the highest generation, read directly (ADR §2). */
describe('overlay authority: the highest generation, never a fold or a replay', () => {
  it('generation 2 replaces generation 1 completely (a FULL snapshot, not a delta)', () => {
    const generation1 = snapshot(1, [overlayRule('write', KEY_A, 'allow')])
    const generation2 = snapshot(2, [overlayRule('write', KEY_B, 'deny')])
    const { decision } = assembleEffectivePermission(
      {
        teamSessionId: TEAM_SESSION,
        memberInstanceId: INSTANCE_A,
        template: staticLayer({ default: 'deny', ask: [exactRule('write', KEY_A)] }),
        overlays: [overlayLayer(generation1), overlayLayer(generation2)],
      },
      WRITE_A,
    )
    // KEY_A is granted ONLY by generation 1: a fold or a replay would apply
    // it, the highest-generation authority does not see it at all, so the
    // template ask decides.
    expect(decision.decision).toBe('ask')
    expect(decision.winningLayer).toBe('template')
    expect(decision.layers.find((layer) => layer.layer === 'overlay')?.matched).toBe(false)
  })

  it('the highest generation wins where both generations address the same pair', () => {
    const generation1 = snapshot(1, [overlayRule('write', KEY_A, 'allow')])
    const generation2 = snapshot(2, [overlayRule('write', KEY_A, 'deny')], { mutationId: 'mut-g2' })
    const { decision } = assembleEffectivePermission(
      {
        teamSessionId: TEAM_SESSION,
        memberInstanceId: INSTANCE_A,
        template: staticLayer({ default: 'ask', allow: [exactRule('write', KEY_A)] }),
        overlays: [overlayLayer(generation1), overlayLayer(generation2)],
      },
      WRITE_A,
    )
    expect(decision.decision).toBe('deny')
    expect(decision.provenance?.overlayAuthority?.generation).toBe(2)
    expect(decision.provenance?.overlayAuthority?.mutationId).toBe('mut-g2')
  })

  it('the order the snapshots arrive in does not matter', () => {
    const generation1 = snapshot(1, [overlayRule('write', KEY_A, 'allow')])
    const generation2 = snapshot(2, [overlayRule('write', KEY_A, 'ask')])
    const ascending = assembleEffectivePermission(
      {
        teamSessionId: TEAM_SESSION,
        memberInstanceId: INSTANCE_A,
        overlays: [overlayLayer(generation1), overlayLayer(generation2)],
      },
      WRITE_A,
    ).decision
    const descending = assembleEffectivePermission(
      {
        teamSessionId: TEAM_SESSION,
        memberInstanceId: INSTANCE_A,
        overlays: [overlayLayer(generation2), overlayLayer(generation1)],
      },
      WRITE_A,
    ).decision
    expect(descending.decision).toBe(ascending.decision)
    expect(descending.provenance?.overlayAuthority?.generation).toBe(2)
  })
})
