/**
 * SCRATCH PROBE (A4-75-delete lane, throwaway — deleted before any census):
 * re-run of `dev/agent-workflow/evidence/a4-ceiling-coverage/rr-probe-ceiling-width.test.ts`
 * on the post-§7.5-prerequisites base (2f06bb44). With the probe-mutant env flag
 * OFF this measures BASE behaviour; with `DSH_PROBE_NEUTER_LEADER_COVERAGE=1`
 * the Leader coverage judge answers `covered` always — behaviourally exactly the
 * §7.5 deletion. Any case that REFUSES with flag OFF and COMMITTED with flag ON
 * is a permission widening (hard stop).
 *
 * Four wirings per probe, all through the production entry `mutatePermission`:
 *   unwired   — no `authorityCeiling` port (fail-closed law since PR #185)
 *   wired     — a v3 ceiling context (the shipped production shape, host.ts)
 *   abstain   — the reader answers `undefined` (the decided pre-v3 skip; the
 *               branch round-23 case (h) measured — pinned DEAD in the shipped
 *               composition by R1-R4, observable at this seam)
 *   pure      — the exact post-Leader composition service.ts performs
 *               (classify without judge + ceiling gate), no storage.
 */

import { describe, expect, it } from 'vitest'
import { createTeamOperationCoordinator } from '../coordination/index.js'
import {
  createGovernanceMutationService,
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
const HUMAN = { kind: 'operator' } as const

const exact = (r: string): PermissionResourceMatcher => ({ kind: 'exact', resource: r })
const subtree = (r: string): PermissionResourceMatcher => ({ kind: 'subtree', resource: r })
const contains = (root: string, child: string): boolean => child === root || child.startsWith(`${root}/`)

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
  readonly seed?: readonly { operationClass: string; matcher: PermissionResourceMatcher; effect: 'allow' | 'ask' | 'deny' }[]
  readonly rules: readonly { operationClass: string; matcher: PermissionResourceMatcher; effect: 'allow' | 'ask' | 'deny' }[]
}

type Wiring = 'unwired' | 'wired' | 'abstain'
type Outcome = { code: string; detail?: Record<string, unknown> } | 'COMMITTED'

async function runOnce(p: Probe, wiring: Wiring, actor: 'leader' | 'human'): Promise<Outcome> {
  const world: World = await openWorld(`a475probe-${Math.random().toString(36).slice(2, 8)}`)
  const docs: AuthorityEnvelopeDocuments = {
    teamHardEnvelope: { status: 'declared', document: p.hard } as unknown as AuthorityDocumentSlot,
    permissionMutationEnvelope: { status: 'declared', document: p.envelope } as unknown as AuthorityDocumentSlot,
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
      ...(wiring === 'unwired'
        ? {}
        : wiring === 'abstain'
          ? { authorityCeiling: async (): Promise<PermissionAuthorityCeilingContext | undefined> => undefined }
          : {
              authorityCeiling: async (_t: string, _m: string, a: 'leader' | 'human'): Promise<PermissionAuthorityCeilingContext> => ({
                beneficiaryAuthority: 'member',
                initiatorAuthority: a === 'leader' ? 'leader' : 'human-user',
                documents: docs,
                blueprintContentHash: `sha256:${'c'.repeat(64)}`,
              }),
            }),
    },
  }
  const service = createGovernanceMutationService(deps)
  let n = 0
  const mutate = async (rules: Probe['rules']): Promise<Outcome> => {
    const args = {
      authority: actor === 'leader' ? LEADER : HUMAN,
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

function render(m: PermissionResourceMatcher): string {
  return `${m.kind}:${m.kind === 'any' ? '' : m.resource}`
}

function pureCeilingComposition(p: Probe): Outcome {
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
      teamHardEnvelope: { status: 'declared', document: p.hard } as unknown as AuthorityDocumentSlot,
      permissionMutationEnvelope: { status: 'declared', document: p.envelope } as unknown as AuthorityDocumentSlot,
    },
  }
  try {
    authorizeCeilingBoundedPermissionRise(rising, (region) => judge(ctx, region))
    return 'COMMITTED' // ceiling silent ⇒ service appends
  } catch (error) {
    const e = error as { code?: string; details?: Record<string, unknown> }
    return { code: String(e.code), detail: e.details }
  }
}

const PROBES: readonly Probe[] = [
  {
    label: '(a) operationClass mismatch: carrier says write, mutation says bash',
    envelope: { rules: [{ operationClass: 'write', matcher: exact(FILE), maximumEffect: 'allow' }] },
    hard: { rules: [{ operationClass: 'write', matcher: exact(FILE), maximumEffect: 'allow' }] },
    staticFacts: { layers: [] },
    withPredicate: false,
    rules: [{ operationClass: 'bash', matcher: fingerprintLike(FP), effect: 'allow' }],
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
    label: '(c2) WIDTH control: carrier is the subtree root (width satisfied, should commit)',
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

function fingerprintLike(fp: string): PermissionResourceMatcher {
  return { kind: 'fingerprint', resource: fp }
}

function show(v: Outcome): string {
  return v === 'COMMITTED' ? 'COMMITTED' : `${v.code}${v.detail?.problem === undefined ? '' : `/${String(v.detail.problem)}`}`
}

describe('PROBE a475: leader-envelope coverage vs the v3 ceiling gate (post-prereq re-measure)', () => {
  for (const p of PROBES) {
    it(`leader: ${p.label}`, async () => {
      const flag = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.['DSH_PROBE_NEUTER_LEADER_COVERAGE'] === '1' ? 'MUTANT' : 'BASE'
      const unwired = await runOnce(p, 'unwired', 'leader')
      const wired = await runOnce(p, 'wired', 'leader')
      const abstain = await runOnce(p, 'abstain', 'leader')
      const pure = pureCeilingComposition(p)
      console.info(
        [
          `\n### [${flag}] leader ${p.label}`,
          `  unwired (port absent): ${show(unwired)}`,
          `  wired   (v3 context) : ${show(wired)}`,
          `  abstain (undefined)  : ${show(abstain)}`,
          `  ceiling ALONE (pure) : ${show(pure)}`,
        ].join('\n'),
      )
      expect(true).toBe(true)
    })
    it(`human: ${p.label}`, async () => {
      const flag = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.['DSH_PROBE_NEUTER_LEADER_COVERAGE'] === '1' ? 'MUTANT' : 'BASE'
      const wired = await runOnce(p, 'wired', 'human')
      const abstain = await runOnce(p, 'abstain', 'human')
      console.info(
        [
          `\n### [${flag}] human ${p.label}`,
          `  wired   (v3 context) : ${show(wired)}`,
          `  abstain (undefined)  : ${show(abstain)}`,
        ].join('\n'),
      )
      expect(true).toBe(true)
    })
  }
})
