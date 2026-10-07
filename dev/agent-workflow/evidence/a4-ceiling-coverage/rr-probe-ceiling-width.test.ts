/**
 * PROBE (read-only investigation, throwaway): does the v3 authority-ceiling path
 * enforce the three conditions `leaderEnvelopeCoverage` enforces?
 *
 * NOT a deliverable test — an experiment. Each `it` prints the observed refusal
 * code for one input mutation, through the production entry `mutatePermission`,
 * in BOTH wirings: no `authorityCeiling` reader (the v1/v2 / unwired branch,
 * where the ceiling gate never runs) and a v3 ceiling context.
 */

import { describe, expect, it } from 'vitest'
import { createTeamOperationCoordinator } from '../coordination/index.js'
import {
  createGovernanceMutationService,
  PERMISSION_MUTATION_ERROR_CODES,
  type GovernanceMutationServiceDeps,
  type GovernancePermissionMutationArgs,
  type PermissionMutationEnvelope,
  type PermissionResourceMatcher,
  type PermissionStaticLayerFacts,
} from '../governance/index.js'
import type { OverrideRecordView, OverrideStorePort, PolicyReader } from '../mutation/index.js'
import type { PolicyStateTransitionRecord } from '../mutation/types.js'
import type { GovernanceTransitionCache, GovernanceTransitionCommit } from '../governance/types.js'
import type { PermissionAuthorityCeilingContext } from '../governance/types.js'
import type { AuthorityEnvelopeDocuments, AuthorityDocumentSlot } from '../governance/authority-ceiling.js'
import {
  authorizeCeilingBoundedPermissionRise,
  classifyPermissionRise,
} from '../governance/permission-mutation.js'
import { createPermissionAuthorityCeilingJudge } from '../governance/service.js'
import {
  FIXTURE_INSTANCE_ID,
  FIXTURE_TEAM_SESSION_ID,
  openWorld,
  type World,
} from './permission-overlay-helpers.js'

class NoopOverrides implements OverrideStorePort {
  async list(_rootSessionId: string): Promise<readonly OverrideRecordView[]> {
    return []
  }
  async put(record: unknown): Promise<unknown> {
    return record
  }
}
class NoopTransitions implements GovernanceTransitionCache {
  appendTransition(_teamSessionId: string, _t: PolicyStateTransitionRecord): void {}
  listTransitions(_teamSessionId: string): readonly PolicyStateTransitionRecord[] {
    return []
  }
}
class NoopCommit implements GovernanceTransitionCommit {
  async commit(_rootSessionId: string, _t: PolicyStateTransitionRecord): Promise<void> {}
}
const NEVER_CONSULTED: PolicyReader = {
  readBlueprintEnvelope: (): never => {
    throw new Error('unused')
  },
  readTemplatePolicy: (): never => {
    throw new Error('unused')
  },
  readExternalFacts: (): never => {
    throw new Error('unused')
  },
}

const FILE = 'file:/srv/probe/a.txt'
const SUB = 'file:/srv/probe'
const FILE_OUT = 'file:/srv/other/b.txt'
const FP = `sha256:${'a'.repeat(64)}`
const LEADER = { kind: 'leader' } as const

const exact = (r: string): PermissionResourceMatcher => ({ kind: 'exact', resource: r })
const subtree = (r: string): PermissionResourceMatcher => ({ kind: 'subtree', resource: r })
const fingerprint = (r: string): PermissionResourceMatcher => ({ kind: 'fingerprint', resource: r })
const contains = (root: string, child: string): boolean => child === root || child.startsWith(`${root}/`)

const STATIC_SUBTREE_ALLOW: PermissionStaticLayerFacts = {
  layers: [{ label: 'template', default: 'deny', rules: [{ operationClass: 'write', matcher: subtree(SUB), effect: 'allow' }] }],
}

/** The fixture that makes the rise land in EXACTLY ONE narrow cell: the lower
 *  layer answers `allow` across SUB but `deny` at FILE (most-restrictive rule in
 *  one layer answers), so a broad overlay grant at `subtree SUB` raises ONLY the
 *  FILE cell — the one cell the narrow carrier does cover. Width is the only
 *  thing that can refuse it. */
const STATIC_TEMPLATE_NARROW_DENY: PermissionStaticLayerFacts = {
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

interface Probe {
  readonly label: string
  readonly envelope: PermissionMutationEnvelope
  readonly hard: PermissionMutationEnvelope
  readonly staticFacts: PermissionStaticLayerFacts
  readonly withPredicate: boolean
  /** Mutation #1 (the seed that makes the later rise confined to a narrow cell). */
  readonly seed?: readonly { operationClass: string; matcher: PermissionResourceMatcher; effect: 'allow' | 'ask' | 'deny' }[]
  readonly rules: readonly { operationClass: string; matcher: PermissionResourceMatcher; effect: 'allow' | 'ask' | 'deny' }[]
}

async function runOnce(p: Probe, wireCeiling: boolean): Promise<{ code: string; detail?: Record<string, unknown> } | 'COMMITTED'> {
  const world: World = await openWorld(`rrprobe-${Math.random().toString(36).slice(2, 8)}`)
  const docs: AuthorityEnvelopeDocuments = {
    teamHardEnvelope: { status: "declared", document: p.hard } as unknown as AuthorityDocumentSlot,
    permissionMutationEnvelope: { status: "declared", document: p.envelope } as unknown as AuthorityDocumentSlot,
  }
  const deps: GovernanceMutationServiceDeps = {
    chain: createTeamOperationCoordinator(),
    overrides: new NoopOverrides(),
    transitions: new NoopTransitions(),
    transitionCommit: new NoopCommit(),
    policy: NEVER_CONSULTED,
    registeredMembers: async () => [],
    policyStates: () => ['default'],
    now: () => '2026-10-08T00:00:00.000Z',
    permissionLane: {
      overlay: world.port,
      permissionEnvelope: () => p.envelope,
      staticLayers: () => p.staticFacts,
      ...(p.withPredicate ? { subtreeContains: contains } : {}),
      ...(wireCeiling
        ? {
            authorityCeiling: async (_t: string, _m: string, actor: 'leader' | 'human'): Promise<PermissionAuthorityCeilingContext> => ({
              beneficiaryAuthority: 'member',
              initiatorAuthority: actor === 'leader' ? 'leader' : 'human-user',
              documents: docs,
              blueprintContentHash: `sha256:${'c'.repeat(64)}`,
            }),
          }
        : {}),
    },
  }
  const service = createGovernanceMutationService(deps)
  let n = 0
  const mutate = async (
    rules: Probe['rules'],
  ): Promise<{ code: string; detail?: Record<string, unknown> } | 'COMMITTED'> => {
    const args = {
      authority: LEADER,
      teamSessionId: FIXTURE_TEAM_SESSION_ID,
      memberInstanceId: FIXTURE_INSTANCE_ID,
      kind: 'grant_instance',
      mutationId: `mut-${String(++n)}`,
      reason: 'probe',
      rules,
    } as GovernancePermissionMutationArgs
    try {
      await service.mutatePermission(args)
      return 'COMMITTED'
    } catch (error) {
      const e = error as { code?: string; details?: Record<string, unknown> }
      return { code: String(e.code ?? (error as Error).message), detail: e.details }
    }
  }
  try {
    if (p.seed !== undefined) {
      const s = await mutate(p.seed)
      if (s !== 'COMMITTED') return { code: `SEED-REFUSED:${s.code}` }
    }
    return await mutate(p.rules)
  } finally {
    await world.store.close()
    world.destroy()
  }
}

function pureCeilingComposition(p: Probe): { code: string } | 'CEILING-SILENT' {
  // The exact composition service.ts performs AFTER authorizeLeaderPermissionMutation.
  const latestRules = p.seed === undefined ? [] : p.seed.map((r) => ({ operation: r.operationClass, resource: render(r.matcher), effect: r.effect }))
  const plannedRules = [...latestRules, ...p.rules.map((r) => ({ operation: r.operationClass, resource: render(r.matcher), effect: r.effect }))]
  const input = {
    latestRules,
    plannedRules,
    mutationRules: p.rules,
    envelope: { rules: [] },
    staticFacts: p.staticFacts,
    ...(p.withPredicate ? { subtreeContains: contains } : {}),
  }
  let rising
  try {
    rising = classifyPermissionRise(input).rising
  } catch (error) {
    return { code: `CLASSIFY:${String((error as { code?: string }).code ?? (error as Error).message)}` }
  }
  const judge = createPermissionAuthorityCeilingJudge(p.withPredicate ? { subtreeContains: contains } : {})
  const ctx: PermissionAuthorityCeilingContext = {
    beneficiaryAuthority: 'member',
    initiatorAuthority: 'leader',
    documents: {
      teamHardEnvelope: { status: "declared", document: p.hard } as unknown as AuthorityDocumentSlot,
      permissionMutationEnvelope: { status: "declared", document: p.envelope } as unknown as AuthorityDocumentSlot,
    },
  }
  try {
    authorizeCeilingBoundedPermissionRise(rising, (region) => judge(ctx, region))
    return 'CEILING-SILENT'
  } catch (error) {
    const e = error as { code?: string; details?: Record<string, unknown> }
    return { code: `${String(e.code)}${e.details?.problem === undefined ? '' : `/${String(e.details.problem)}`}` }
  }
}

function render(m: PermissionResourceMatcher): string {
  return `${m.kind}:${m.kind === 'any' ? '' : m.resource}`
}

const PROBES: readonly Probe[] = [
  {
    label: '(a) operationClass mismatch: carrier says write, mutation says bash',
    envelope: { rules: [{ operationClass: 'write', matcher: exact(FILE), maximumEffect: 'allow' }] },
    hard: { rules: [{ operationClass: 'write', matcher: exact(FILE), maximumEffect: 'allow' }] },
    staticFacts: { layers: [] },
    withPredicate: false,
    rules: [{ operationClass: 'bash', matcher: fingerprint(FP), effect: 'allow' }],
  },
  {
    label: '(b) effect shortfall: carrier maximumEffect=ask, risen effect=allow',
    envelope: { rules: [{ operationClass: 'write', matcher: exact(FILE), maximumEffect: 'ask' }] },
    hard: { rules: [{ operationClass: 'write', matcher: exact(FILE), maximumEffect: 'ask' }] },
    staticFacts: { layers: [] },
    withPredicate: false,
    rules: [{ operationClass: 'write', matcher: exact(FILE), effect: 'allow' }],
  },
  {
    label: '(c) WIDTH: carrier exact FILE, mutation claims subtree SUB, ONLY FILE rises',
    envelope: { rules: [{ operationClass: 'write', matcher: exact(FILE), maximumEffect: 'allow' }] },
    hard: { rules: [{ operationClass: 'write', matcher: exact(FILE), maximumEffect: 'allow' }] },
    staticFacts: STATIC_TEMPLATE_NARROW_DENY,
    withPredicate: true,
    rules: [{ operationClass: 'write', matcher: subtree(SUB), effect: 'allow' }],
  },
  {
    label: '(c2) WIDTH control: same rises, carrier is the subtree root (width satisfied)',
    envelope: { rules: [{ operationClass: 'write', matcher: subtree(SUB), maximumEffect: 'allow' }] },
    hard: { rules: [{ operationClass: 'write', matcher: subtree(SUB), maximumEffect: 'allow' }] },
    staticFacts: STATIC_TEMPLATE_NARROW_DENY,
    withPredicate: true,
    rules: [{ operationClass: 'write', matcher: subtree(SUB), effect: 'allow' }],
  },
  {
    label: '(c3) WIDTH with the whole subtree rising (carrier exact FILE)',
    envelope: { rules: [{ operationClass: 'write', matcher: exact(FILE), maximumEffect: 'allow' }] },
    hard: { rules: [{ operationClass: 'write', matcher: subtree(SUB), maximumEffect: 'allow' }] },
    staticFacts: { layers: [] },
    withPredicate: true,
    rules: [{ operationClass: 'write', matcher: subtree(SUB), effect: 'allow' }],
  },
  {
    label: '(g) NARROW mutation (exact FILE) inside a broad carrier (control, should commit)',
    envelope: { rules: [{ operationClass: 'write', matcher: subtree(SUB), maximumEffect: 'allow' }] },
    hard: { rules: [{ operationClass: 'write', matcher: subtree(SUB), maximumEffect: 'allow' }] },
    staticFacts: STATIC_TEMPLATE_NARROW_DENY,
    withPredicate: true,
    rules: [{ operationClass: 'write', matcher: exact(FILE), effect: 'allow' }],
  },
  {
    label: '(d) coverage-unknown: subtree carrier, exact mutation, NO subtreeContains injected',
    envelope: { rules: [{ operationClass: 'write', matcher: subtree(SUB), maximumEffect: 'allow' }] },
    hard: { rules: [{ operationClass: 'write', matcher: subtree(SUB), maximumEffect: 'allow' }] },
    staticFacts: { layers: [] },
    withPredicate: false,
    rules: [{ operationClass: 'write', matcher: exact(FILE), effect: 'allow' }],
  },
  {
    label: '(e) control: exact carrier, exact mutation, allow reaches (should commit today)',
    envelope: { rules: [{ operationClass: 'write', matcher: exact(FILE), maximumEffect: 'allow' }] },
    hard: { rules: [{ operationClass: 'write', matcher: exact(FILE), maximumEffect: 'allow' }] },
    staticFacts: { layers: [] },
    withPredicate: false,
    rules: [{ operationClass: 'write', matcher: exact(FILE), effect: 'allow' }],
  },
  {
    label: '(f) carrier covers nothing (empty), mutation rises',
    envelope: { rules: [] },
    hard: { rules: [] },
    staticFacts: { layers: [] },
    withPredicate: false,
    rules: [{ operationClass: 'write', matcher: exact(FILE_OUT), effect: 'allow' }],
  },
]

describe('PROBE: leader-envelope coverage vs the v3 ceiling gate', () => {
  for (const p of PROBES) {
    it(`${p.label}`, async () => {
      const unwired = await runOnce(p, false)
      const wired = await runOnce(p, true)
      const ceilingOnly = pureCeilingComposition(p)
      const show = (v: { code: string; detail?: Record<string, unknown> } | 'COMMITTED' | 'CEILING-SILENT'): string =>
        typeof v === 'string' ? v : `${v.code}${v.detail?.problem === undefined ? '' : `/${String(v.detail.problem)}`}`
      console.info(
        [
          `\n### ${p.label}`,
          `  no ceiling reader (v1/v2/unwired): ${show(unwired)}`,
          `  v3 ceiling context           : ${show(wired)}`,
          `  ceiling gate ALONE (pure)    : ${show(ceilingOnly)}`,
        ].join('\n'),
      )
      expect(true).toBe(true)
    })
  }
})
