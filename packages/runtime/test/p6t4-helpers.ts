/**
 * P6-T4 — the durable control/approval plane test world: the P6-T1
 * durable world with the P6-T4 fixture blueprint (envelopes deliberately
 * shaped so every MUST-TEST and every negative is addressable), the
 * control-service wiring, and the fake last-mile tool pipeline (the P6-T6
 * wiring model: the guard is consulted BEFORE the DSH tool pipeline
 * executes the operation, which runs ONLY on `allowed: true`).
 *
 * Envelope surface (deliberate, per file):
 * - team envelope: ALL nine mutation ops — the leader can always
 *   request/resolve, so an envelope never masks a control-plane rejection;
 * - `worker` template: carries `resolve-control` — the self-approval
 *   negative proves the resolver ROLE CLOSURE beats the envelope
 *   (invariant 37: a member is never a resolver, even with the op);
 * - `scout` template: `request-control` but no `resolve-control`;
 * - `scribe` template: NO `request-control` (the requester-envelope
 *   negative).
 *
 * The P6-T4 world is otherwise the P6-T1 durable world (a REAL TeamDomain
 * over a scratch dir; `restartP6T1World` re-opens the repositories over
 * the SAME scratch dir — the unit-restart model: re-instantiate +
 * re-open, no in-memory state is authority, invariant 45).
 */

import {
  parseChildSessionId,
  parseInstanceId,
  parseTemplateId,
} from '../../contracts/src/index.js'
import type {
  MemberInstanceRecordDto,
  MemberInstanceRecordInput,
  MemberLifecycleState,
} from '../../contracts/src/index.js'
import type { LedgerEntry } from '../../storage/schema/index.js'
import type { ExternalPolicyFacts } from '../../domain/policy/src/index.js'
import {
  LEADER_INSTANCE_ID,
  P6T1_FIXTURE,
  createP6T1World,
} from './p6t1-helpers.js'
import type {
  P6T1World,
  P6T1WorldOptions,
} from './p6t1-helpers.js'
import {
  createControlService,
  isControlError,
} from '../control/index.js'
import type {
  ControlError,
  ControlGuardVerdict,
  ControlOperationScope,
  ControlService,
} from '../control/index.js'
import {
  isTeamRuntimeError,
} from '../admission/index.js'
import type {
  ActionCaller,
  TeamRuntimeError,
} from '../admission/index.js'

// The P6-T1 world lifecycle helpers are the unit-restart model itself
// (re-instantiate + re-open repositories over the SAME durable store);
// the P6-T4 suites consume them through this module's surface.
export { destroyP6T1World, restartP6T1World } from './p6t1-helpers.js'

/** The P6-T4 team (root) session id (string form of the P6-T1 fixture root). */
export const P6T4_ROOT = String(P6T1_FIXTURE.rootSessionId)

/** The frozen clock of the P6-T4 worlds (deterministic row timestamps). */
export const P6T4_NOW = '2026-09-01T09:00:00Z'

/**
 * The P6-T4 fixture blueprint source (own ids, quotas and the deliberate
 * envelope surface documented in the file header).
 */
export const P6T4_BLUEPRINT_SOURCE = [
  '---',
  'schemaVersion: 1',
  'blueprintId: P6T4-BP',
  'revision: "1"',
  'leader:',
  '  templateId: leader',
  '  persona: You lead the P6T4 team.',
  'members:',
  '  - templateId: worker',
  '    displayName: Worker',
  '    persona: You do the P6T4 work.',
  '  - templateId: scout',
  '    displayName: Scout',
  '    persona: You scout for the P6T4 team.',
  '    contextPolicy: fresh_per_delegation',
  '  - templateId: scribe',
  '    displayName: Scribe',
  '    persona: You write for the P6T4 team.',
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
  '    - dispose-member',
  '  deny:',
  '    - delete-team',
  'memberEnvelopes:',
  '  - templateId: worker',
  '    envelope:',
  '      allow:',
  '        - send-message',
  '        - report-progress',
  '        - request-control',
  '        - resolve-control',
  '      deny: []',
  '  - templateId: scout',
  '    envelope:',
  '      allow:',
  '        - send-message',
  '        - report-progress',
  '        - request-control',
  '      deny: []',
  '  - templateId: scribe',
  '    envelope:',
  '      allow:',
  '        - send-message',
  '        - report-progress',
  '      deny: []',
  'policyStates:',
  '  - id: default',
  '    description: The P6T4 default state.',
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

/** The P6-T4 seeded member constants (instance-first addressing surface). */
export const P6T4_SEEDS = {
  leader: {
    instanceId: 'inst-leader',
    templateId: 'leader',
    label: 'leader',
    childSessionId: 'session-child-p6t4-leader',
  },
  worker: {
    instanceId: 'inst-p6t4seedw01',
    templateId: 'worker',
    label: 'existing-worker',
    childSessionId: 'session-child-p6t4-w1',
  },
  worker2: {
    instanceId: 'inst-p6t4seedw02',
    templateId: 'worker',
    label: 'second-worker',
    childSessionId: 'session-child-p6t4-w2',
  },
  scout: {
    instanceId: 'inst-p6t4seeds01',
    templateId: 'scout',
    label: 'existing-scout',
    childSessionId: 'session-child-p6t4-s1',
  },
  scribe: {
    instanceId: 'inst-p6t4seeds02',
    templateId: 'scribe',
    label: 'existing-scribe',
    childSessionId: 'session-child-p6t4-b1',
  },
} as const

/** The seedable member names. */
export type P6T4SeedName = keyof typeof P6T4_SEEDS

/**
 * Build one P6-T4 seed member (default lifecycle RUNNING; the stale/
 * lifecycle tests override it).
 *
 * @param name - the seed constant to use.
 * @param overrides - field overrides (e.g. a non-live lifecycle).
 * @returns the seed member record input.
 */
export function p6t4Seed(
  name: P6T4SeedName,
  overrides: Partial<MemberInstanceRecordDto> = {},
): Partial<MemberInstanceRecordDto> {
  const seed = P6T4_SEEDS[name]
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
 * Build a P6-T4 world: the P6-T1 durable world with the P6-T4 blueprint
 * source and the named seed members (leader included by default — caller
 * resolution requires the acting member record to exist).
 *
 * @param basename - the scratch dir basename (unique per test).
 * @param seedNames - which seed members to install (default leader+worker).
 * @param options - the P6-T1 world options (ports, extra seeds, ...).
 * @returns the seeded P6-T4 world.
 */
export async function createP6T4World(
  basename: string,
  seedNames: readonly P6T4SeedName[] = ['leader', 'worker'],
  options: P6T1WorldOptions = {},
): Promise<P6T1World> {
  return createP6T1World(basename, {
    blueprintSource: P6T4_BLUEPRINT_SOURCE,
    ...options,
    seedMembers: [
      ...seedNames.map((name) => p6t4Seed(name)),
      ...(options.seedMembers ?? []),
    ],
  })
}

/**
 * Wire the durable control service over the world's open TeamDomain
 * (the same port family the service takes in production; the external
 * policy port is the world's wired port so a test can mutate the facts it
 * serves and have the mutation survive a restart).
 *
 * @param world - the open P6-T4 world.
 * @returns the control service.
 */
export function createP6T4Service(world: P6T1World): ControlService {
  return createControlService({
    teamDomain: world.domain,
    blueprintCatalog: world.catalog,
    externalPolicyFacts: world.ports.externalPolicyFacts,
    now: () => P6T4_NOW,
  })
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
export function humanCaller(humanId = 'human-p6t4-owner'): ActionCaller {
  return { kind: 'human', humanId }
}

/**
 * Build one control operation scope with the P6-T4 defaults (a tool
 * pipeline write addressed to the default worker); every field is
 * overridable.
 *
 * @param overrides - the per-test overrides.
 * @returns the operation scope.
 */
export function makeScope(
  overrides: Partial<ControlOperationScope> = {},
): ControlOperationScope {
  return {
    rootSessionId: P6T4_ROOT,
    targetInstanceId: String(P6T4_SEEDS.worker.instanceId),
    actionName: 'write-file',
    toolName: 'fs.write',
    correlation: 'corr-p6t4-w1',
    ...overrides,
  }
}

// --- the fake last-mile tool pipeline (the P6-T6 wiring model) -----------------------

/** One guarded tool-pipeline attempt (the pipeline's own log row). */
export interface FakeToolExecution {
  /** The guarded tool (empty when the scope carried no toolName). */
  readonly toolName: string
  /** The correlation of the attempt. */
  readonly correlation: string
  /** Did the guard allow the attempt (the operation ran)? */
  readonly allowed: boolean
  /** Present when the guard blocked: the closed block reason. */
  readonly reason?: string
  /** Present when the guard verdict carries the durable request identity
   * (always when allowed; also for the request-pending / request-stale /
   * decision-deny / allow-consumed / scope-mismatch blocks). */
  readonly requestId?: string
  /** Present when the guard verdict carries the durable decision identity
   * (always when allowed; also for the request-stale / decision-deny /
   * allow-consumed / scope-mismatch blocks). */
  readonly decisionSequence?: number
}

/**
 * The fake tool pipeline: every attempt consults the control service's
 * last-mile guard FIRST (the characterized `pre-execute` / TOOL_GUARD
 * seam) and "executes" the tool operation ONLY on `allowed: true` —
 * exactly the composition the P6-T6 tool layer performs.
 */
export interface FakeToolPipeline {
  /** Every guarded attempt in order (allowed and blocked alike). */
  readonly executions: FakeToolExecution[]
  /** The attempts that actually executed the tool operation. */
  executed: () => FakeToolExecution[]
  /**
   * Consult the guard, then execute iff allowed.
   * @param scope - the exact operation scope.
   * @returns the recorded attempt.
   */
  execute: (scope: ControlOperationScope) => Promise<FakeToolExecution>
}

/**
 * Create the fake last-mile tool pipeline over one control service.
 * @param service - the control service whose guard is consulted.
 * @returns the pipeline.
 */
export function createFakeToolPipeline(service: ControlService): FakeToolPipeline {
  const executions: FakeToolExecution[] = []
  return {
    executions,
    executed: (): FakeToolExecution[] => executions.filter((e) => e.allowed),
    async execute(scope: ControlOperationScope): Promise<FakeToolExecution> {
      // pre-execute seam: the guard is consulted BEFORE any execution.
      const verdict: ControlGuardVerdict = await service.guardOperation(scope)
      let execution: FakeToolExecution
      if (verdict.allowed) {
        // Allowed: the tool pipeline executes the operation (exactly once
        // per allow — the guard consumed it).
        execution = {
          toolName: scope.toolName ?? '',
          correlation: scope.correlation,
          allowed: true,
          requestId: verdict.requestId,
          decisionSequence: verdict.decisionSequence,
        }
      } else {
        // Blocked: the log row still carries whatever durable identity the
        // guard verdict reported (the pipeline sees the full verdict).
        execution = {
          toolName: scope.toolName ?? '',
          correlation: scope.correlation,
          allowed: false,
          reason: verdict.reason,
          ...(verdict.requestId !== undefined
            ? { requestId: verdict.requestId }
            : {}),
          ...(verdict.decisionSequence !== undefined
            ? { decisionSequence: verdict.decisionSequence }
            : {}),
        }
      }
      executions.push(execution)
      return execution
    },
  }
}

// --- durable state inspection / corruption construction --------------------------------

/**
 * Append one raw ledger fact to the world's durable store (bypassing the
 * service — for corrupted/ambiguous-state construction; the service's own
 * writers are the only legitimate producers).
 *
 * @param world - the open world.
 * @param factType - the fact family (one of the control fact types).
 * @param payload - the lossless-JSON payload.
 * @returns the ledger sequence of the appended row.
 */
export async function writeRawControlFact(
  world: P6T1World,
  factType: string,
  payload: Record<string, unknown>,
): Promise<number> {
  const repositories = world.domain.repositories
  const sequence = await repositories.ledger.allocateSequence()
  await repositories.ledger.put({
    schemaVersion: 1,
    sequence,
    rootSessionId: P6T4_ROOT,
    factType,
    payload,
    createdAt: P6T4_NOW,
  })
  return sequence
}

/**
 * The world's raw control-plane ledger rows (fresh durable read).
 * @param world - the open world.
 * @param factType - optional fact-family filter.
 * @returns the matching ledger entries (in ledger order).
 */
export function controlFacts(world: P6T1World, factType?: string): LedgerEntry[] {
  return world.domain.repositories
    .ledger.list()
    .filter(
      (entry) =>
        String(entry.rootSessionId) === P6T4_ROOT &&
        (factType === undefined || entry.factType === factType),
    )
}

/**
 * Flip one member's lifecycle directly in the durable store (the fake
 * lifecycle-commit pattern of the P6-T2 suites: delete + fresh put with
 * activityVersion+1; no service call — the control plane never performs
 * lifecycle transitions itself).
 *
 * @param world - the open world.
 * @param instanceId - the member instance id.
 * @param lifecycle - the target lifecycle state.
 */
export async function flipLifecycle(
  world: P6T1World,
  instanceId: string,
  lifecycle: MemberLifecycleState,
): Promise<void> {
  const repository = world.domain.repositories.memberInstances
  const parsed = parseInstanceId(instanceId)
  const current = repository.get(P6T4_ROOT, String(parsed))
  if (current === undefined) {
    throw new Error(
      `flipLifecycle: no member instance '${instanceId}' in team '${P6T4_ROOT}'`,
    )
  }
  const input: MemberInstanceRecordInput = {
    rootSessionId: current.rootSessionId,
    instanceId: current.instanceId,
    templateId: current.templateId,
    label: current.label,
    ...(current.groupId !== undefined ? { groupId: current.groupId } : {}),
    childSessionId: current.childSessionId,
    ...(current.workspace !== undefined ? { workspace: current.workspace } : {}),
    lifecycle,
    createdAt: current.createdAt,
    activityVersion: current.activityVersion + 1,
  }
  await repository.delete(P6T4_ROOT, String(parsed))
  await repository.put(input)
}

/**
 * Delete one member record directly (the "target vanished" construction).
 * @param world - the open world.
 * @param instanceId - the member instance id.
 * @returns whether a record was removed.
 */
export async function deleteMember(world: P6T1World, instanceId: string): Promise<boolean> {
  return world.domain.repositories.memberInstances.delete(
    P6T4_ROOT,
    String(parseInstanceId(instanceId)),
  )
}

// --- the mutable external hard policy port ----------------------------------------------

/**
 * A mutable external hard policy facts holder (the test mutates the facts
 * the port serves; the SAME function reference is wired into the world's
 * ports, so the mutation survives a restart — the live-probe contract,
 * invariant 34: the policy is read at decision time, never cached).
 *
 * @param initial - the initial facts.
 * @returns the holder (`set` mutates, `facts` is the wired port).
 */
export function mutableExternalPolicyFacts(initial: ExternalPolicyFacts): {
  readonly set: (facts: ExternalPolicyFacts) => void
  readonly facts: () => Promise<ExternalPolicyFacts>
} {
  let current = initial
  return {
    set: (facts: ExternalPolicyFacts): void => {
      current = facts
    },
    facts: async (): Promise<ExternalPolicyFacts> => current,
  }
}

// --- assertion helpers -----------------------------------------------------------------

function describeError(error: unknown): string {
  return error instanceof Error ? `${error.name}: ${error.message}` : String(error)
}

/**
 * Assert that `error` is a ControlError with exactly `code` (test failure
 * otherwise) and return the typed code + a copy of the details.
 *
 * @param error - the thrown/rejected value.
 * @param code - the expected closed control error code.
 * @returns the checked code and details.
 */
export function assertControlCode(
  error: unknown,
  code: string,
): { readonly code: string; readonly details?: Record<string, unknown> } {
  if (!isControlError(error)) {
    throw new Error(
      `assertControlCode: expected ControlError '${code}', got ${describeError(error)}`,
    )
  }
  if (error.code !== code) {
    throw new Error(
      `assertControlCode: expected '${code}', got '${error.code}': ${error.message}`,
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
 * Assert that `error` is a TeamRuntimeError (the facade's reused
 * authority-phase codes) with exactly `code` (test failure otherwise).
 *
 * @param error - the thrown/rejected value.
 * @param code - the expected facade error code value.
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
 * Expect one control-service call to be REJECTED with `code` (test
 * failure when the call succeeds instead).
 *
 * @param fn - the control-service call.
 * @param code - the expected closed control error code.
 * @returns the rejected ControlError with its code and details.
 */
export function expectControlRejection(
  fn: () => Promise<unknown>,
  code: string,
): Promise<{
  readonly error: ControlError
  readonly code: string
  readonly details?: Record<string, unknown>
}> {
  return fn().then(
    (value) => {
      throw new Error(
        `expectControlRejection('${code}'): the call succeeded: ${JSON.stringify(value)}`,
      )
    },
    (error: unknown) => {
      const checked = assertControlCode(error, code)
      const result: {
        error: ControlError
        code: string
        details?: Record<string, unknown>
      } = { error: error as ControlError, code: checked.code }
      if (checked.details !== undefined) {
        result.details = checked.details
      }
      return result
    },
  )
}

/**
 * Expect one control-service call to be rejected with a FACADE code
 * (the reused authority-phase steps surface their own typed errors).
 *
 * @param fn - the control-service call.
 * @param code - the expected facade error code value.
 * @returns the rejected TeamRuntimeError with its code and details.
 */
export function expectRuntimeRejection(
  fn: () => Promise<unknown>,
  code: string,
): Promise<{
  readonly error: TeamRuntimeError
  readonly code: string
  readonly details?: Record<string, unknown>
}> {
  return fn().then(
    (value) => {
      throw new Error(
        `expectRuntimeRejection('${code}'): the call succeeded: ${JSON.stringify(value)}`,
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

/**
 * The first element of a non-empty array (test failure when empty) — the
 * noUncheckedIndexedAccess-safe access pattern for the suites.
 *
 * @param array - a non-empty readonly array.
 * @param what - a diagnostic for the failure message.
 * @returns the first element.
 */
export function expectFirst<T>(array: readonly T[], what: string): T {
  const value = array[0]
  if (value === undefined) {
    throw new Error(`expectFirst: no ${what} in the durable state`)
  }
  return value
}
