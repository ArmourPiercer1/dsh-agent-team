/**
 * template-disable-no-requirements-gate.test.ts — finding I (P2) regression:
 * a DISABLED template with NO requirements (a normal template whose
 * requirement set is empty — a v2 template scope that declares no capability
 * rows) can still execute.
 *
 * The defect: `gateAction` derived the disabled set from the EXISTING
 * verdicts (`refs.filter(v => v !== undefined ...)`), and a template with no
 * requirements produces NO verdict row at all (`scopeRequirementInputsOf`
 * skips empty template scopes; the live gate evaluates only declared scopes)
 * — so a disabled, requirement-free template was absent from `disabledRefs`
 * and its normal work (delegate / follow-up) was ADMITTED. The existing
 * `template-disable-enable.test.ts` masked the case by handcrafting a verdict
 * for the disabled template.
 *
 * This suite pins the REAL chain (no handcrafted verdicts):
 *
 * - the fixture is a REAL schema-v2 blueprint: a REQUIRED team-level
 *   `skill/base` (passing) + a WORKER template that declares NO requirements
 *   (its scope produces no verdict — the exact empty case);
 * - the disable/enable goes through the PRODUCTION durable writer
 *   (`setTemplateAvailabilityFact` — the same writer the production root's
 *   `requirementAuthority.setTemplateAvailability` service calls), read back
 *   by the gate's durable fold (`readRequirementFacts`);
 * - the admission is the AUTHORITATIVE requirement gate
 *   (`enforceRequirementGate` — the step-5 admission path the action router
 *   runs for delegate / follow-up) with the delegate's real impact
 *   (`actionImpactOf('delegate', 'worker', false)` = the Team scope + the
 *   target template scope).
 *
 * Expected (the fix): a disabled template blocks its normal work REGARDLESS
 * of its requirement set (reason `templateDisabled`, availability — never a
 * policy denial); re-enabling resumes the work through the same checks
 * (the requirement set is still empty — the admission keys on availability,
 * not on the presence of requirements).
 *
 * @module @dsh-agent-team/runtime/test/template-disable-no-requirements-gate
 */

import { afterEach, describe, expect, it } from 'vitest'

import {
  enforceRequirementGate,
  actionImpactOf,
  readRequirementFacts,
  TEAM_RUNTIME_ERROR_CODES,
} from '../admission/index.js'
import type { EnvironmentFact } from '../../domain/compatibility/src/index.js'
import {
  createRuntimeRequirementFactsProvider,
  requirementFactScopeRoleOf,
  type RequirementFactsPorts,
} from '../requirement-facts/index.js'
import {
  scopeRequirementInputsOf,
  setTemplateAvailabilityFact,
  scopeKey,
} from '../requirements/index.js'
import { PROBE_VERDICTS, type CapabilityReadinessProvider, type ProbeVerdict } from '../readiness/index.js'
import { destroyP6T1World } from './p6t1-helpers.js'
import type { P6T1World } from './p6t1-helpers.js'
import { createP6T2World, P6T2_NOW, P6T2_ROOT } from './p6t2-helpers.js'
import type { TeamBlueprint } from '../../domain/blueprint/src/index.js'

/**
 * The document version this fixture declares, and why it is 3 now.
 *
 * §7.4 (lane B-runtime-semantics-A) deliberately LEFT this digit at 2 and put
 * it on a typed code position, because at that SHA the §E.2 structured-
 * requirement grammar was read by production only behind
 * `blueprint.schemaVersion === 2` (requirements/scope-requirements.ts,
 * requirements/creation-preflight.ts, admission/requirement-gate.ts,
 * compatibility/blueprint.ts, activation/provider.ts). Their recorded trial —
 * "promoting the digit reddens N of this file's tests" — was a true measurement
 * of that tree, and §7.3 option A (3b253775, PR #161) consumed it: the five
 * comparisons are gone and the grammar is now a property of the blueprint SHAPE,
 * not of its version digit.
 *
 * So the flip is a no-op for this file's CLAIM, and that was re-measured here
 * rather than assumed: at schemaVersion 3 plus the two authority documents v3
 * requires (below), this file is fully green — the same legs, asserting the same
 * facts. §7.3's narrowing of `TeamBlueprint['schemaVersion']` is what forces the
 * digit to move in the same commit as the cutover instead of drifting.
 */
const DECLARED_DOCUMENT_VERSION: TeamBlueprint['schemaVersion'] = 3

/**
 * The finding-I fixture (schema v2): a REQUIRED team-level `skill/base`
 * (passing — the Team scope stays healthy) + a WORKER template that declares
 * NO requirements at all (the empty-requirements case — its scope produces
 * no verdict row). The leader declares none either (the delegate targets the
 * worker, not the leader).
 */
const FINDING_I_BLUEPRINT_SOURCE = [
  '---',
  `schemaVersion: ${DECLARED_DOCUMENT_VERSION}`,
  'blueprintId: FNDI-BP',
  'revision: "1"',
  'leader:',
  '  templateId: leader',
  '  persona: You lead the FNDI team.',
  'members:',
  '  - templateId: worker',
  '    displayName: Worker',
  '    persona: You do the FNDI work.',
  'requirements: []',
  'teamRequirements:',
  '  - requirementId: req-team-core',
  '    type: skill',
  '    subjects: [base]',
  '    complete: true',
  'teamEnvelope:',
  '  allow:',
  '    - assign-task',
  '    - create-member',
  '    - send-message',
  '    - report-progress',
  '    - request-control',
  '    - resolve-control',
  '    - archive-member',
  '    - restore-member',
  '  deny:',
  '    - delete-team',
  'memberEnvelopes:',
  '  - templateId: worker',
  '    envelope:',
  '      allow:',
  '        - send-message',
  '        - report-progress',
  '      deny: []',
  'policyStates:',
  '  - id: default',
  '    description: The FNDI default state.',
  'quotas:',
  '  team:',
  '    maxInstances: 4',
  '    maxConcurrent: 4',
  '  members:',
  '    maxInstances: 2',
  '    maxConcurrent: 2',
    // §7.3 v3-only: the two authority documents version 3 REQUIRES, at the honest
    // zero `rules: []`. No test in this file mutates permissions, so nothing here
    // asks to expand; a filler rule would write a wide grant into a fixture that no
    // test would notice (ADR §5.1 forbids the implicit ceiling just as much).
  'permissionMutationEnvelope:',
  '  rules: []',
  'teamHardEnvelope:',
  '  rules: []',
  'metadata: {}',
  '---',
].join('\n')

/** A mutable (type, subject) → verdict readiness table (the live probe). */
function mutableReadiness(initial: Record<string, ProbeVerdict>): {
  readonly provider: CapabilityReadinessProvider
  readonly set: (key: string, verdict: ProbeVerdict) => void
} {
  const table = { ...initial }
  return {
    provider: {
      probe: async (type, name) => ({
        capabilityType: type,
        capabilityName: name,
        verdict: table[`${type}\u0000${name}`] ?? PROBE_VERDICTS.unknown,
        source: 'test-live-probe',
        observedAt: P6T2_NOW,
      }),
    },
    set: (key, verdict: ProbeVerdict) => {
      table[key] = verdict
    },
  }
}

/** The live provider over a (toggleable) readiness table. */
function livePorts(readiness: CapabilityReadinessProvider): RequirementFactsPorts {
  const plan = {
    root: {
      presetId: 'standard',
      persona: { kind: 'standard' as const, source: 'effective-composition' as const },
    },
    member: {
      presetId: 'standard',
      persona: { kind: 'standard' as const, source: 'effective-composition' as const },
    },
  }
  return {
    configuredMcpServers: [],
    readiness,
    substratePlan: async () => plan,
    now: () => P6T2_NOW,
  }
}

const TEAM_BASE = 'skill\u0000base'

/** The team-scope live feed (the production root's identical thunk shape). */
function teamFeedOf(
  world: P6T1World,
  provider: ReturnType<typeof createRuntimeRequirementFactsProvider>,
): () => Promise<readonly EnvironmentFact[]> {
  return async () =>
    (
      await provider.resolveFacts({
        requirements: scopeRequirementInputsOf(world.blueprint).team,
        scope: { kind: 'team' },
      })
    ).environmentFacts
}

/** The template-scope live feed (per-templateId — the delegate target). */
function templateFeedOf(
  world: P6T1World,
  provider: ReturnType<typeof createRuntimeRequirementFactsProvider>,
): (templateId: string) => Promise<readonly EnvironmentFact[]> {
  const templates = scopeRequirementInputsOf(world.blueprint).templates
  return async (templateId: string) =>
    (
      await provider.resolveFacts({
        requirements: templates[templateId] ?? [],
        // PR #46 ROLE CONTRACT (audit site T1, 2026-10-01 master-sync round 2):
        // the template scope carries its role identity, DERIVED from this
        // world's bound blueprint leader template identity — the leader
        // template -> 'leader' (its own / root observation), any other
        // template -> 'member'. Never hardcoded: the thunk is generic over
        // templateId (this world's delegate target 'worker' -> 'member').
        // Pre-merge note: the helper import resolves from the master-sync
        // merge onward (the PR #46 contract); at the pre-merge tip this
        // file's collection is intentionally RED (see fix-report).
        scope: {
          kind: 'template',
          templateId,
          role: requirementFactScopeRoleOf(world.blueprint.leader.templateId, templateId),
        },
      })
    ).environmentFacts
}

/** The finding-I world: the real v2 fixture blueprint (worker = no requirements). */
async function createFindingIWorld(basename: string): Promise<P6T1World> {
  return createP6T2World(basename, ['leader', 'worker'], {
    blueprintSource: FINDING_I_BLUEPRINT_SOURCE,
  })
}

/** Run the authoritative gate for a DELEGATE to the worker (the real impact). */
async function gateDelegateToWorker(world: P6T1World): Promise<
  | { readonly allowed: true; readonly reason: string }
  | { readonly allowed: false; readonly code: string; readonly details: Record<string, unknown> }
> {
  const readiness = mutableReadiness({ [TEAM_BASE]: PROBE_VERDICTS.reachable })
  const provider = createRuntimeRequirementFactsProvider(livePorts(readiness.provider))
  try {
    const outcome = await enforceRequirementGate(
      {
        repositories: world.domain.repositories,
        blueprint: world.blueprint,
        rootSessionId: P6T2_ROOT,
        environmentFacts: teamFeedOf(world, provider),
        templateEnvironmentFacts: templateFeedOf(world, provider),
        now: () => P6T2_NOW,
      },
      actionImpactOf('delegate', 'worker', false),
    )
    return { allowed: true, reason: outcome.reason }
  } catch (error) {
    const typed = error as { code?: string; details?: Record<string, unknown> }
    return { allowed: false, code: String(typed.code), details: typed.details ?? {} }
  }
}

describe('finding I: a disabled template with NO requirements blocks its work (real chain)', () => {
  let world: P6T1World | undefined

  afterEach(() => {
    if (world !== undefined) {
      destroyP6T1World(world)
      world = undefined
    }
  })

  it('premise: the fixture worker template produces NO requirement inputs / verdicts (the empty case)', async () => {
    world = await createFindingIWorld('fndi-premise')
    const inputs = scopeRequirementInputsOf(world.blueprint)
    // The worker declares no requirements: its template scope is absent from
    // the extraction — hence no verdict row, hence the old verdict-derived
    // disabled set could never see it.
    expect(inputs.templates['worker']).toBeUndefined()
    expect(Object.keys(inputs.templates).sort()).toEqual([])
    // The team scope alone is declared (the passing required skill).
    expect(inputs.scopes.map((scope) => scopeKey(scope))).toEqual(['team'])
  })

  it('control: with the worker ENABLED the delegate is admitted (healthy world, empty worker)', async () => {
    world = await createFindingIWorld('fndi-control-enabled')
    const outcome = await gateDelegateToWorker(world)
    expect(outcome.allowed).toBe(true)
    if (outcome.allowed) expect(outcome.reason).toBe('allowed')
  })

  it('the durable disable BLOCKS the delegate to the worker — regardless of its (empty) requirement set', async () => {
    world = await createFindingIWorld('fndi-disabled-blocks')
    // The PRODUCTION durable disable (the writer behind
    // requirementAuthority.setTemplateAvailability) — the real disable
    // mechanism; the gate reads it back through the durable fold.
    await setTemplateAvailabilityFact({
      ledger: world.domain.repositories.ledger,
      blueprint: world.blueprint,
      rootSessionId: P6T2_ROOT,
      templateId: 'worker',
      available: false,
      now: () => P6T2_NOW,
    })
    const durable = readRequirementFacts(world.domain.repositories, P6T2_ROOT)
    expect(durable.availability).toEqual([{ templateId: 'worker', available: false }])

    const outcome = await gateDelegateToWorker(world)
    expect(outcome.allowed).toBe(false)
    if (!outcome.allowed) {
      expect(outcome.code).toBe(TEAM_RUNTIME_ERROR_CODES.COMPATIBILITY_BLOCKED)
      // The block is the AVAILABILITY block (availability, not a policy
      // denial — authority negative #9) naming the worker scope.
      expect(outcome.details['gateReason']).toBe('templateDisabled')
      expect(outcome.details['blockedScopes']).toEqual(['template:worker'])
    }
  })

  it('the same disable BLOCKS the follow-up to the worker (same normalWork class, same scopeRefs)', async () => {
    world = await createFindingIWorld('fndi-followup-blocks')
    await setTemplateAvailabilityFact({
      ledger: world.domain.repositories.ledger,
      blueprint: world.blueprint,
      rootSessionId: P6T2_ROOT,
      templateId: 'worker',
      available: false,
      now: () => P6T2_NOW,
    })
    // The follow-up's real impact (the router's `actionImpactOf`): the SAME
    // normalWork class with the IDENTICAL scopeRefs as the delegate — the
    // availability block keys on the scope refs, never on the action name.
    const readiness = mutableReadiness({ [TEAM_BASE]: PROBE_VERDICTS.reachable })
    const provider = createRuntimeRequirementFactsProvider(livePorts(readiness.provider))
    const outcome = await enforceRequirementGate(
      {
        repositories: world.domain.repositories,
        blueprint: world.blueprint,
        rootSessionId: P6T2_ROOT,
        environmentFacts: teamFeedOf(world, provider),
        templateEnvironmentFacts: templateFeedOf(world, provider),
        now: () => P6T2_NOW,
      },
      actionImpactOf('follow-up', 'worker', false),
    ).then(
      () => {
        throw new Error('expected the disabled worker to BLOCK the follow-up')
      },
      (error: unknown) => error,
    )
    const typed = outcome as { code?: string; details?: Record<string, unknown> }
    expect(typed.code).toBe(TEAM_RUNTIME_ERROR_CODES.COMPATIBILITY_BLOCKED)
    expect(typed.details?.['gateReason']).toBe('templateDisabled')
    expect(typed.details?.['blockedScopes']).toEqual(['template:worker'])
  })

  it('re-enabling resumes the delegate through the SAME checks (the block did not key on requirements)', async () => {
    world = await createFindingIWorld('fndi-reenabled-resumes')
    await setTemplateAvailabilityFact({
      ledger: world.domain.repositories.ledger,
      blueprint: world.blueprint,
      rootSessionId: P6T2_ROOT,
      templateId: 'worker',
      available: false,
      now: () => P6T2_NOW,
    })
    const blocked = await gateDelegateToWorker(world)
    expect(blocked.allowed).toBe(false)

    // Re-enable (the production writer again — latest wins on the durable
    // fold).
    await setTemplateAvailabilityFact({
      ledger: world.domain.repositories.ledger,
      blueprint: world.blueprint,
      rootSessionId: P6T2_ROOT,
      templateId: 'worker',
      available: true,
      now: () => P6T2_NOW,
    })
    const durable = readRequirementFacts(world.domain.repositories, P6T2_ROOT)
    expect(durable.availability).toEqual([{ templateId: 'worker', available: true }])

    // The worker STILL has no requirements (the admission resumes because
    // the availability flipped, NOT because requirements appeared).
    const outcome = await gateDelegateToWorker(world)
    expect(outcome.allowed).toBe(true)
    if (outcome.allowed) expect(outcome.reason).toBe('allowed')
    expect(scopeRequirementInputsOf(world.blueprint).templates['worker']).toBeUndefined()
  })
})
