/**
 * PARITY MATRIX — the kernel's pure effective-answer semantics vs the REAL
 * merged PR2 assembler (`effective-policy/permission-assembler.ts`).
 *
 * The kernel classifies Leader mutations by EFFECTIVE before/after; its
 * restatement of the layer semantics (overlay > template > blueprint,
 * within-layer most-restrictive, fall-through, LOWEST-declared fallback,
 * declared-none fail-closed deny) is only trustworthy if it equals the
 * merged arbiter. Every row: same overlay rules + same static layer + same
 * operation through BOTH surfaces, asserted equal. `containsOperation` in
 * the assembler input is the live resolver's POINT judgement — legitimate
 * here (this is the decision side); the kernel side answers the same
 * question through the injected WHOLE-MATCHER predicate.
 *
 * @module @dsh-agent-team/runtime/test/a3p3-effective-parity
 */

import { describe, expect, it } from 'vitest'
import {
  permissionEffectiveAnswer,
  type PermissionStaticLayerFacts,
} from '../governance/index.js'
import { PERMISSION_OVERLAY_SCHEMA_VERSION } from '../permission-governance/index.js'
import { assembleEffectivePermission } from '../effective-policy/index.js'
import type { EffectivePermissionAssemblyInput } from '../effective-policy/index.js'
import type { CanonicalOperation, PermissionTool } from '../operation-permission/types.js'
import type { CanonicalRules } from '../operation-permission/permission-resolver.js'
import type { PermissionOverlayRule, PermissionOverlaySnapshot } from '../permission-governance/types.js'

const TEAM = 'session-root-1'
const MEMBER = 'inst-alpha'
const FILE_KEY = 'file:/srv/worlds/a3p3/out.txt'
const SUBTREE_ROOT = 'file:/srv/worlds/a3p3'

const OPERATION: CanonicalOperation = {
  tool: 'write',
  resource: { kind: 'file', key: FILE_KEY, display: FILE_KEY },
  fingerprint: 'sha256:' + 'd'.repeat(64),
}

const contains = (root: string, child: string): boolean => child === root || child.startsWith(`${root}/`)

interface Carrier {
  readonly operation: string
  readonly resource: string
  readonly effect: 'allow' | 'ask' | 'deny'
}

function carriers(rules: readonly Carrier[]): readonly PermissionOverlayRule[] {
  return rules.map((rule) => rule) as unknown as readonly PermissionOverlayRule[]
}

function snapshotOf(rules: readonly Carrier[]): PermissionOverlaySnapshot {
  return {
    snapshotId: `${TEAM}#${MEMBER}#1`,
    schemaVersion: PERMISSION_OVERLAY_SCHEMA_VERSION,
    identity: { teamSessionId: TEAM, memberInstanceId: MEMBER },
    state: { rules },
    metadata: { generation: 1, previousSnapshotId: null },
    provenance: { actor: 'human', mutationId: 'parity-seed', timestamp: '2026-10-05T12:00:00.000Z', reason: 'parity fixture' },
  } as unknown as PermissionOverlaySnapshot
}

function staticView(lanes: CanonicalRules, fallback: 'ask' | 'deny', label: string) {
  return { label, default: fallback, rules: lanes }
}

function assemblerAnswer(
  overlayRules: readonly Carrier[],
  template: ReturnType<typeof staticView> | undefined,
  blueprint: ReturnType<typeof staticView> | undefined,
): { readonly decision: string; readonly winningLayer: string | null } {
  const input: EffectivePermissionAssemblyInput = {
    teamSessionId: TEAM,
    memberInstanceId: MEMBER,
    ...(blueprint === undefined ? {} : { blueprint }),
    ...(template === undefined ? {} : { template }),
    ...(overlayRules.length === 0 ? {} : {
      overlays: [
        {
          snapshot: snapshotOf(overlayRules),
          rules: overlayRules.map((rule, ruleIndex) => {
            const [kind, ...rest] = rule.resource.split(':')
            const identity = rest.join(':')
            return {
              ruleIndex,
              lane: rule.effect,
              rule:
                kind === 'exact'
                  ? { tool: rule.operation as PermissionTool, resource: { kind: 'exact' as const, key: identity } }
                  : {
                      tool: rule.operation as PermissionTool,
                      resource: {
                        kind: 'subtree' as const,
                        rootKey: identity,
                        containsOperation: contains(identity, FILE_KEY),
                      },
                    },
            }
          }),
        },
      ],
    }),
  }
  const { decision } = assembleEffectivePermission(input, OPERATION)
  return { decision: decision.decision, winningLayer: decision.winningLayer ?? null }
}

function kernelAnswer(
  overlayRules: readonly Carrier[],
  facts: PermissionStaticLayerFacts,
): { readonly effect: string; readonly source: string } {
  const answer = permissionEffectiveAnswer({
    overlayRules: carriers(overlayRules),
    staticFacts: facts,
    operationClass: 'write',
    region: { kind: 'exact', resource: FILE_KEY },
    subtreeContains: contains,
  })
  expect(answer.status).toBe('decided')
  if (answer.status !== 'decided') throw new Error('unreachable')
  return { effect: answer.effect, source: answer.source }
}

/** Kernel source -> assembler winningLayer. */
function asWinningLayer(source: string): string | null {
  return source === 'overlay' ? 'overlay' : source === 'layer' ? 'template' : null
}

// Assembler-side lane view (the merged PR2 input contract).
const emptyLanes: CanonicalRules = { allow: [], ask: [], deny: [] }
const allowExact: CanonicalRules = { allow: [{ tool: 'write', resource: { kind: 'exact', key: FILE_KEY } }], ask: [], deny: [] }
const denyExact: CanonicalRules = { allow: [], ask: [], deny: [{ tool: 'write', resource: { kind: 'exact', key: FILE_KEY } }] }
// Kernel-side static-layer view of the SAME facts (the kernel's matcher-array
// grammar — a deliberately DISTINCT vocabulary; bridging these two views of
// one layer is exactly the boundary this matrix proves equivalent).
const kAllowExactRule = { operationClass: 'write', matcher: { kind: 'exact' as const, resource: FILE_KEY }, effect: 'allow' as const }
const kDenyExactRule = { operationClass: 'write', matcher: { kind: 'exact' as const, resource: FILE_KEY }, effect: 'deny' as const }
const tmplAllow: PermissionStaticLayerFacts['layers'][number] = { label: 'tmpl', default: 'deny', rules: [kAllowExactRule] }
const tmplDeny: PermissionStaticLayerFacts['layers'][number] = { label: 'tmpl', default: 'deny', rules: [kDenyExactRule] }

describe('kernel effective-answer == merged assembler (matrix)', () => {
  it('P1: matching overlay deny wins over a template allow (overlay precedence)', () => {
    const overlay: readonly Carrier[] = [{ operation: 'write', resource: `exact:${FILE_KEY}`, effect: 'deny' }]
    const facts: PermissionStaticLayerFacts = { layers: [tmplAllow] }
    expect(assemblerAnswer(overlay, staticView(allowExact, 'deny', 'tmpl'), undefined)).toEqual({ decision: 'deny', winningLayer: 'overlay' })
    expect(kernelAnswer(overlay, facts).effect).toBe('deny')
    expect(asWinningLayer(kernelAnswer(overlay, facts).source)).toBe('overlay')
  })

  it('P2: within one overlay layer the MOST RESTRICTIVE matching rule answers (deny shadows a surviving subtree… child pair)', () => {
    const overlay: readonly Carrier[] = [
      { operation: 'write', resource: `subtree:${SUBTREE_ROOT}`, effect: 'deny' },
      { operation: 'write', resource: `exact:${FILE_KEY}`, effect: 'allow' },
    ]
    const facts: PermissionStaticLayerFacts = { layers: [tmplAllow] }
    expect(assemblerAnswer(overlay, staticView(allowExact, 'deny', 'tmpl'), undefined).decision).toBe('deny')
    expect(kernelAnswer(overlay, facts).effect).toBe('deny')
  })

  it('P3: overlay silent, template allow answers', () => {
    const facts: PermissionStaticLayerFacts = { layers: [tmplAllow] }
    expect(assemblerAnswer([], staticView(allowExact, 'deny', 'tmpl'), undefined)).toEqual({ decision: 'allow', winningLayer: 'template' })
    expect(kernelAnswer([], facts)).toEqual({ effect: 'allow', source: 'layer' })
  })

  it('P4: template denies over a blueprint allow (layer precedence, template higher)', () => {
    const facts: PermissionStaticLayerFacts = {
      layers: [
        { label: 'bp', default: 'deny', rules: [{ operationClass: 'write', matcher: { kind: 'exact', resource: FILE_KEY }, effect: 'allow' }] },
        tmplDeny,
      ],
    }
    expect(assemblerAnswer([], staticView(denyExact, 'deny', 'tmpl'), staticView(allowExact, 'deny', 'bp'))).toEqual({ decision: 'deny', winningLayer: 'template' })
    expect(kernelAnswer([], facts)).toEqual({ effect: 'deny', source: 'layer' })
  })

  it('P5: no rule matches ANYWHERE — the LOWEST declared layer default answers (blueprint deny over template ask)', () => {
    const facts: PermissionStaticLayerFacts = {
      layers: [
        { label: 'bp', default: 'deny', rules: [] },
        { label: 'tmpl', default: 'ask', rules: [] },
      ],
    }
    expect(assemblerAnswer([], staticView(emptyLanes, 'ask', 'tmpl'), staticView(emptyLanes, 'deny', 'bp'))).toEqual({ decision: 'deny', winningLayer: null })
    expect(kernelAnswer([], facts)).toEqual({ effect: 'deny', source: 'fallback' })
  })

  it('P6: DECLARED-NONE (no static layer) fails closed to deny exactly like the assembler', () => {
    expect(assemblerAnswer([], undefined, undefined)).toEqual({ decision: 'deny', winningLayer: null })
    expect(kernelAnswer([], { layers: [] })).toEqual({ effect: 'deny', source: 'fallback' })
  })

  it('P7: a static `any` rule answers its whole class', () => {
    const anyAllow: CanonicalRules = { allow: [{ tool: 'write', resource: { kind: 'any' } }], ask: [], deny: [] }
    const facts: PermissionStaticLayerFacts = {
      layers: [{ label: 'tmpl', default: 'deny', rules: [{ operationClass: 'write', matcher: { kind: 'any' }, effect: 'allow' }] }],
    }
    expect(assemblerAnswer([], staticView(anyAllow, 'deny', 'tmpl'), undefined)).toEqual({ decision: 'allow', winningLayer: 'template' })
    expect(kernelAnswer([], facts)).toEqual({ effect: 'allow', source: 'layer' })
  })

  it('P8: reveal-by-remaining-overlay — the surviving child allow answers', () => {
    const overlay: readonly Carrier[] = [{ operation: 'write', resource: `exact:${FILE_KEY}`, effect: 'allow' }]
    const facts: PermissionStaticLayerFacts = { layers: [tmplDeny] }
    expect(assemblerAnswer(overlay, staticView(denyExact, 'deny', 'tmpl'), undefined)).toEqual({ decision: 'allow', winningLayer: 'overlay' })
    expect(kernelAnswer(overlay, facts)).toEqual({ effect: 'allow', source: 'overlay' })
  })

  it('P9: a subtree overlay rule covers the point via containment (predicate == the live containsOperation verdict)', () => {
    const overlay: readonly Carrier[] = [{ operation: 'write', resource: `subtree:${SUBTREE_ROOT}`, effect: 'deny' }]
    const facts: PermissionStaticLayerFacts = { layers: [tmplAllow] }
    expect(assemblerAnswer(overlay, staticView(allowExact, 'deny', 'tmpl'), undefined)).toEqual({ decision: 'deny', winningLayer: 'overlay' })
    expect(kernelAnswer(overlay, facts)).toEqual({ effect: 'deny', source: 'overlay' })
  })

  it('P10: UNKNOWN facts is its OWN state — context-unavailable, never a decided deny/ask/allow', () => {
    const answer = permissionEffectiveAnswer({
      overlayRules: [],
      staticFacts: undefined,
      operationClass: 'write',
      region: { kind: 'exact', resource: FILE_KEY },
      subtreeContains: contains,
    })
    expect(answer).toEqual({ status: 'context-unavailable' })
  })

  it('P11: exec fingerprint answers by EXACT identity only (kernel side; exec canonicalization is exact-equality by design)', () => {
    const fp = `sha256:${'a'.repeat(64)}`
    const other = `sha256:${'b'.repeat(64)}`
    const overlay = carriers([{ operation: 'bash', resource: `fingerprint:${fp}`, effect: 'deny' }] as const as readonly Carrier[])
    const hit = permissionEffectiveAnswer({ overlayRules: overlay, staticFacts: { layers: [] }, operationClass: 'bash', region: { kind: 'fingerprint', resource: fp } })
    expect(hit).toMatchObject({ status: 'decided', effect: 'deny', source: 'overlay' })
    const miss = permissionEffectiveAnswer({ overlayRules: overlay, staticFacts: { layers: [] }, operationClass: 'bash', region: { kind: 'fingerprint', resource: other } })
    expect(miss).toEqual({ status: 'decided', effect: 'deny', source: 'fallback' }) // declared-none fail-closed, NOT the overlay rule
  })
})
