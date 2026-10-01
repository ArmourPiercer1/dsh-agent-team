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

/**
 * The finding-I fixture (schema v2): a REQUIRED team-level `skill/base`
 * (passing — the Team scope stays healthy) + a WORKER template that declares
 * NO requirements at all (the empty-requirements case — its scope produces
 * no verdict row). The leader declares none either (the delegate targets the
 * worker, not the leader).
 */
const FINDING_I_BLUEPRINT_SOURCE = [
  '---',
  'schemaVersion: 2',
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
        scope: { kind: 'template', templateId },
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
