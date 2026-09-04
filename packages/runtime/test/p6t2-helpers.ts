/**
 * P6-T2 — shared fixtures for the TeamRuntime action-router suites.
 *
 * Reuses the P6-T1 durable world (REAL TeamDomain over a fresh scratch dir
 * with the team-root binding, REAL blueprint catalog, mock-first ports)
 * with a P6-T2 fixture blueprint of its own ids/quotas/envelopes and the
 * seeded member constants the router tests address by instanceId
 * (invariant 18). `p6t1-helpers.ts` stays the world source of truth; this
 * file only pins the P6-T2 surface on top of it.
 *
 * Deliberate test surface of `P6T2_BLUEPRINT_SOURCE`:
 * - `teamEnvelope.allow` holds 8 of the 9 mutation ops — `dispose-member`
 *   is deliberately ABSENT: the leader disposing a member is
 *   ENVELOPE_OUT_OF_BOUNDS (invariant 36), while the human owner is
 *   unbounded and may dispose (invariant 34);
 * - the worker template envelope allows `send-message` + `report-progress`
 *   only (no `request-control`: a worker asking for control on itself is
 *   out of envelope; no `assign-task`: a worker self-escalation via
 *   follow-up is out of envelope — invariant 37);
 * - the scout template envelope allows `send-message` + `report-progress`
 *   + `request-control`;
 * - quotas: team 4/4 and per-template 2/2, so the team boundary and the
 *   template boundary are independently reachable by a single extra
 *   creation; `maxConcurrent` is never the binding constraint.
 */

import {
  parseChildSessionId,
  parseInstanceId,
  parseTemplateId,
} from '../../contracts/src/index.js'
import type { MemberInstanceRecordDto } from '../../contracts/src/index.js'
import type { CompatibilityStatus } from '../../storage/schema/index.js'
import {
  LEADER_INSTANCE_ID,
  P6T1_FIXTURE,
  createP6T1World,
  makeEnvironmentFacts,
} from './p6t1-helpers.js'
import type {
  P6T1World,
  P6T1WorldOptions,
} from './p6t1-helpers.js'
import {
  createTeamRuntime,
} from '../action-router/index.js'
import {
  isTeamRuntimeError,
} from '../admission/index.js'
import type {
  ActionCaller,
  LifecycleCommitPort,
  TeamRuntime,
  TeamRuntimeActionRequest,
  TeamRuntimeError,
} from '../admission/index.js'

/** The P6-T2 world's team root (the P6-T1 fixture root: one world, one team). */
export const P6T2_ROOT = String(P6T1_FIXTURE.rootSessionId)

/** The frozen clock of the P6-T2 worlds. */
export const P6T2_NOW = '2026-08-31T12:00:00Z'

/**
 * The P6-T2 fixture blueprint source (own ids, quotas and envelopes — see
 * the file header for the deliberate test surface).
 */
export const P6T2_BLUEPRINT_SOURCE = [
  '---',
  'schemaVersion: 1',
  'blueprintId: P6T2-BP',
  'revision: "1"',
  'leader:',
  '  templateId: leader',
  '  persona: You lead the P6T2 team.',
  'members:',
  '  - templateId: worker',
  '    displayName: Worker',
  '    persona: You do the P6T2 work.',
  '  - templateId: scout',
  '    displayName: Scout',
  '    persona: You scout for the P6T2 team.',
  '    contextPolicy: fresh_per_delegation',
  'requirements:',
  '  - domain: tool',
  '    name: web',
  '    optional: true',
  '  - domain: skill',
  '    name: base',
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
  '  - templateId: scout',
  '    envelope:',
  '      allow:',
  '        - send-message',
  '        - report-progress',
  '        - request-control',
  '      deny: []',
  'policyStates:',
  '  - id: default',
  '    description: The P6T2 default state.',
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

/** The P6-T2 seeded member constants (instance-first addressing surface). */
export const P6T2_SEEDS = {
  leader: {
    instanceId: 'inst-leader',
    templateId: 'leader',
    label: 'leader',
    childSessionId: 'session-child-p6t2-leader',
  },
  worker: {
    instanceId: 'inst-p6t2seedw01',
    templateId: 'worker',
    label: 'existing-worker',
    childSessionId: 'session-child-p6t2-w1',
  },
  worker2: {
    instanceId: 'inst-p6t2seedw02',
    templateId: 'worker',
    label: 'second-worker',
    childSessionId: 'session-child-p6t2-w2',
  },
  scout: {
    instanceId: 'inst-p6t2seeds01',
    templateId: 'scout',
    label: 'existing-scout',
    childSessionId: 'session-child-p6t2-s1',
  },
} as const

/** The seedable member names. */
export type P6T2SeedName = keyof typeof P6T2_SEEDS

/**
 * Build one P6-T2 seed member (default lifecycle RUNNING; the stale/
 * lifecycle tests override it).
 *
 * @param name - the seed constant to use.
 * @param overrides - field overrides (e.g. a non-live lifecycle).
 * @returns the seed member record input.
 */
export function p6t2Seed(
  name: P6T2SeedName,
  overrides: Partial<MemberInstanceRecordDto> = {},
): Partial<MemberInstanceRecordDto> {
  const seed = P6T2_SEEDS[name]
  return {
    instanceId: parseInstanceId(seed.instanceId),
    templateId: parseTemplateId(seed.templateId),
    label: seed.label,
    childSessionId: parseChildSessionId(seed.childSessionId),
    lifecycle: 'RUNNING',
    ...overrides,
  }
}

/**
 * Build a P6-T2 world: the P6-T1 durable world with the P6-T2 blueprint
 * source and the named seed members (leader included by default — caller
 * resolution requires the acting member record to exist).
 *
 * @param basename - the scratch dir basename (unique per test).
 * @param seedNames - which seed members to install (default leader+worker).
 * @param options - the P6-T1 world options (ports, extra seeds, ...).
 * @returns the seeded P6-T2 world.
 */
export async function createP6T2World(
  basename: string,
  seedNames: readonly P6T2SeedName[] = ['leader', 'worker'],
  options: P6T1WorldOptions = {},
): Promise<P6T1World> {
  return createP6T1World(basename, {
    blueprintSource: P6T2_BLUEPRINT_SOURCE,
    ...options,
    seedMembers: [
      ...seedNames.map((name) => p6t2Seed(name)),
      ...(options.seedMembers ?? []),
    ],
  })
}

/**
 * Build a P6-T2 world whose live environment probe reports the `skill`/
 * `base` requirement unavailable (live compatibility BLOCKED_FATAL).
 *
 * @param basename - the scratch dir basename (unique per test).
 * @param seedNames - which seed members to install.
 * @returns the compat-blocked P6-T2 world.
 */
export async function createP6T2CompatBlockedWorld(
  basename: string,
  seedNames: readonly P6T2SeedName[] = ['leader', 'worker'],
): Promise<P6T1World> {
  return createP6T2World(basename, seedNames, {
    environmentFacts: () =>
      Promise.resolve(
        makeEnvironmentFacts([
          { domain: 'skill', subject: 'base', available: false, generation: 2 },
        ]),
      ),
  })
}

/**
 * Install a DURABLE compatibility state for the P6-T2 team root (the
 * durable-state branch of the compatibility gate).
 *
 * @param world - the P6-T2 world (fresh: the store has no row yet).
 * @param status - the durable status to install.
 * @returns the frozen stored record.
 */
export async function putDurableCompatibilityState(
  world: P6T1World,
  status: CompatibilityStatus,
) {
  return world.domain.repositories.compatibility.put({
    schemaVersion: 1,
    rootSessionId: P6T1_FIXTURE.rootSessionId,
    status,
    fingerprint: 'fp-p6t2-durable',
    generation: 1,
    outcomes: {},
    acknowledgements: [],
    computedAt: P6T2_NOW,
  })
}

/**
 * The optional P6-T2 runtime wiring: the lifecycle commit port (the P7-T3
 * lifecycle module's surface; absent in the default P6-T2 wiring — the
 * production contract under test).
 */
export interface P6T2RuntimeOptions {
  /** The injected lifecycle transition commit port (test fake or absent). */
  readonly lifecycleCommit?: LifecycleCommitPort
}

/**
 * Build the P6-T2 TeamRuntime over one world (the production wiring:
 * the injected ports, no router-owned counters; the lifecycle commit port
 * is optional — its absence IS the P6-T2 default wiring under test).
 *
 * @param world - the P6-T2 world.
 * @param options - the optional lifecycle commit port.
 * @returns the action router facade.
 */
export function createP6T2Runtime(
  world: P6T1World,
  options: P6T2RuntimeOptions = {},
): TeamRuntime {
  return createTeamRuntime({
    teamDomain: world.domain,
    activationProvider: world.provider,
    blueprintCatalog: world.catalog,
    environmentFacts: world.ports.environmentFacts,
    externalPolicyFacts: world.ports.externalPolicyFacts,
    now: () => P6T2_NOW,
    ...(options.lifecycleCommit !== undefined
      ? { lifecycleCommit: options.lifecycleCommit }
      : {}),
  })
}

/** One recorded lifecycle commit call (test observation). */
export interface P6T2LifecycleCommitCall {
  readonly rootSessionId: string
  readonly instanceId: string
  readonly expectedActivityVersion: number
  readonly from: string
  readonly operation: string
  readonly to: string
}

/**
 * A FAKE lifecycle commit port for the P6-T2 suites: since P8-S3 (R4/
 * CR-10) it commits through the REAL repository CAS
 * (`memberInstances.commitTransition` with the expected activityVersion +
 * from-state check), not the P8-S2-era delete+put pattern that lost to
 * concurrent writers. It records every call for assertions. Test-only
 * double — the production durable commit (quiesce-then-commit,
 * Architecture §30) is the P7-T3 lifecycle module.
 *
 * @param world - the P6-T2 world whose member store the port commits to.
 * @returns the port plus the recorded calls.
 */
export function createFakeLifecycleCommitPort(
  world: P6T1World,
): LifecycleCommitPort & { readonly calls: P6T2LifecycleCommitCall[] } {
  const calls: P6T2LifecycleCommitCall[] = []
  const port: LifecycleCommitPort = {
    async commitTransition(args) {
      calls.push({
        rootSessionId: args.rootSessionId,
        instanceId: args.instanceId,
        expectedActivityVersion: args.expectedActivityVersion,
        from: args.from,
        operation: args.operation,
        to: args.to,
      })
      const repo = world.domain.repositories.memberInstances
      const current = repo.get(args.rootSessionId, args.instanceId)
      if (current === undefined) {
        throw new Error(
          `fake-lifecycle-port: member '${args.instanceId}' vanished between validation and commit`,
        )
      }
      await repo.commitTransition({
        rootSessionId: args.rootSessionId,
        instanceId: args.instanceId,
        expectedActivityVersion: args.expectedActivityVersion,
        from: args.from,
        operation: args.operation,
        to: args.to,
      })
    },
  }
  return { ...port, calls }
}

/** A LeaderInstance caller. */
export function leaderCaller(): ActionCaller {
  return { kind: 'instance', instanceId: String(LEADER_INSTANCE_ID) }
}

/** An arbitrary member caller. */
export function memberCaller(instanceId: string): ActionCaller {
  return { kind: 'instance', instanceId }
}

/** A human (team owner) caller. */
export function humanCaller(humanId = 'human-p6t2-owner'): ActionCaller {
  return { kind: 'human', humanId }
}

/**
 * Build a P6-T2 action request with the defaults (a leader follow-up to
 * the default token); every field is overridable.
 *
 * The default `payload.prompt` conforms to the P8-S3 R2 work-request
 * contract (explicit prompt, no transcript inheritance) so the historical
 * follow-up/delegate suites keep expressing their ORIGINAL subject (which
 * was never the payload). Tests that exercise the payload contract itself
 * must build the request explicitly (bypassing this helper's default) or
 * override `payload`.
 *
 * @param overrides - the per-test overrides.
 * @returns the action request.
 */
export function makeActionRequest(
  overrides: Partial<TeamRuntimeActionRequest> = {},
): TeamRuntimeActionRequest {
  return {
    rootSessionId: P6T2_ROOT,
    action: 'follow-up',
    caller: leaderCaller(),
    requestToken: 'tok-p6t2-default',
    payload: { prompt: 'p6t2 default work prompt' },
    ...overrides,
  }
}

function describeError(error: unknown): string {
  return error instanceof Error ? `${error.name}: ${error.message}` : String(error)
}

/**
 * Assert that `error` is a TeamRuntimeError with exactly `code` (test
 * failure otherwise) and return the typed code + a copy of the details.
 *
 * @param error - the thrown/rejected value.
 * @param code - the expected closed error code.
 * @returns the checked code and details.
 */
export function assertRuntimeCode(
  error: unknown,
  code: string,
): { readonly code: string; readonly details?: Record<string, unknown> } {
  if (!isTeamRuntimeError(error)) {
    throw new Error(
      `assertRuntimeCode: expected TeamRuntimeError '${code}', got ${describeError(error)}`,
    )
  }
  if (error.code !== code) {
    throw new Error(
      `assertRuntimeCode: expected '${code}', got '${error.code}': ${error.message}`,
    )
  }
  const result: { code: string; details?: Record<string, unknown> } = {
    code: error.code,
  }
  if (error.details !== undefined) {
    result.details = { ...error.details }
  }
  return result
}

/**
 * Expect one action to be REJECTED with `code` (test failure when the
 * action executes instead); resolves to the typed error + code + details.
 *
 * @param runtime - the TeamRuntime under test.
 * @param request - the action request.
 * @param code - the expected rejection code.
 * @returns the rejected TeamRuntimeError with its code and details.
 */
export function expectRejection(
  runtime: TeamRuntime,
  request: TeamRuntimeActionRequest,
  code: string,
): Promise<{
  readonly error: TeamRuntimeError
  readonly code: string
  readonly details?: Record<string, unknown>
}> {
  return runtime.performAction(request).then(
    (outcome) => {
      throw new Error(
        `expectRejection('${code}'): the action executed with effect '${outcome.effect.kind}'`,
      )
    },
    (error: unknown) => {
      const checked = assertRuntimeCode(error, code)
      const result: {
        error: TeamRuntimeError
        code: string
        details?: Record<string, unknown>
      } = { error: error as TeamRuntimeError, code: checked.code }
      if (checked.details !== undefined) {
        result.details = checked.details
      }
      return result
    },
  )
}

/** List the P6-T2 team's member records (fresh durable view). */
export function memberList(world: P6T1World): MemberInstanceRecordDto[] {
  return world.domain.repositories.memberInstances.list(P6T2_ROOT)
}

/** Count the members of one template (quota boundary arithmetic). */
export function membersByTemplate(
  world: P6T1World,
  templateId: string,
): MemberInstanceRecordDto[] {
  return memberList(world).filter(
    (member) => String(member.templateId) === templateId,
  )
}
