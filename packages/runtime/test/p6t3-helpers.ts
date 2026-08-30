/**
 * P6-T3 — shared fixtures for the messaging-coordination suites.
 *
 * Reuses the P6-T1 durable world (REAL TeamDomain over a fresh scratch dir
 * with the team-root binding, REAL blueprint catalog, mock-first ports)
 * with a P6-T3 fixture blueprint of its own ids/envelopes and the seeded
 * member constants the coordinator tests address by instanceId
 * (invariant 18). The session input port is a RECORDING FAKE with fault
 * injection (the real public Session input API integrates at P6-T6).
 *
 * Deliberate test surface of `P6T3_BLUEPRINT_SOURCE`:
 * - `teamEnvelope.allow` holds 8 of the 9 mutation ops (incl.
 *   `send-message`; `dispose-member` deliberately absent, as in P6-T2);
 * - the worker template envelope allows `send-message` +
 *   `report-progress`; the scout template adds `request-control`;
 * - the MUTED template envelope allows `report-progress` ONLY — a muted
 *   member sending is ENVELOPE_OUT_OF_BOUNDS (the facade envelope is
 *   authoritative; mediation never grants authority);
 * - quotas: team 6/6 (headroom — this task never creates members; the
 *   quota boundary tests are P6-T2's) and per-template 2/2.
 *
 * The P6-T3 clock differs from P6-T2's (`P6T3_NOW`) so durable facts from
 * this task are distinguishable in the ledger.
 */

import {
  parseChildSessionId,
  parseInstanceId,
  parseTemplateId,
} from '../../contracts/src/index.js'
import type { MemberInstanceRecordDto } from '../../contracts/src/index.js'
import type { GovernanceOverrideRecord } from '../../storage/schema/index.js'
import type { LedgerEntry } from '../../storage/schema/index.js'
import type { ActionCaller, TeamRuntime } from '../admission/index.js'
import { createTeamRuntime } from '../action-router/index.js'
import {
  PEER_DIRECT_GRANT_KEY,
  createMessagingCoordinator,
  isMessagingError,
} from '../messaging/index.js'
import type {
  AttributedSessionInput,
  MessagingCoordinator,
  MessagingError,
  SessionInputPort,
  SendTeamMessageRequest,
} from '../messaging/index.js'
import {
  P6T1_FIXTURE,
  createP6T1World,
} from './p6t1-helpers.js'
import type {
  P6T1World,
  P6T1WorldOptions,
} from './p6t1-helpers.js'

/** The P6-T3 world's team root (the P6-T1 fixture root: one world, one team). */
export const P6T3_ROOT = String(P6T1_FIXTURE.rootSessionId)

/** The frozen clock of the P6-T3 worlds. */
export const P6T3_NOW = '2026-09-01T09:00:00Z'

/**
 * The P6-T3 fixture blueprint source (own ids/envelopes — see the file
 * header for the deliberate test surface).
 */
export const P6T3_BLUEPRINT_SOURCE = [
  '---',
  'schemaVersion: 1',
  'blueprintId: P6T3-BP',
  'revision: "1"',
  'leader:',
  '  templateId: leader',
  '  persona: You lead the P6T3 team.',
  'members:',
  '  - templateId: worker',
  '    displayName: Worker',
  '    persona: You do the P6T3 work.',
  '  - templateId: scout',
  '    displayName: Scout',
  '    persona: You scout for the P6T3 team.',
  '    contextPolicy: fresh_per_delegation',
  '  - templateId: muted',
  '    displayName: Muted',
  '    persona: You observe the P6T3 team.',
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
  '  - templateId: muted',
  '    envelope:',
  '      allow:',
  '        - report-progress',
  '      deny: []',
  'policyStates:',
  '  - id: default',
  '    description: The P6T3 default state.',
  'quotas:',
  '  team:',
  '    maxInstances: 6',
  '    maxConcurrent: 6',
  '  members:',
  '    maxInstances: 2',
  '    maxConcurrent: 2',
  'metadata: {}',
  '---',
].join('\n')

/** The P6-T3 seeded member constants (instance-first addressing surface). */
export const P6T3_SEEDS = {
  leader: {
    instanceId: 'inst-leader',
    templateId: 'leader',
    label: 'leader',
    childSessionId: 'session-child-p6t3-leader',
  },
  worker: {
    instanceId: 'inst-p6t3seedw01',
    templateId: 'worker',
    label: 'existing-worker',
    childSessionId: 'session-child-p6t3-w1',
  },
  worker2: {
    instanceId: 'inst-p6t3seedw02',
    templateId: 'worker',
    label: 'second-worker',
    childSessionId: 'session-child-p6t3-w2',
  },
  scout: {
    instanceId: 'inst-p6t3seeds01',
    templateId: 'scout',
    label: 'existing-scout',
    childSessionId: 'session-child-p6t3-s1',
  },
  muted: {
    instanceId: 'inst-p6t3seedm01',
    templateId: 'muted',
    label: 'existing-muted',
    childSessionId: 'session-child-p6t3-m1',
  },
} as const

/** The seedable member names. */
export type P6T3SeedName = keyof typeof P6T3_SEEDS

/**
 * Build one P6-T3 seed member (default lifecycle RUNNING).
 * @param name - the seed constant to use.
 * @param overrides - field overrides (e.g. a non-live lifecycle).
 * @returns the seed member record input.
 */
export function p6t3Seed(
  name: P6T3SeedName,
  overrides: Partial<MemberInstanceRecordDto> = {},
): Partial<MemberInstanceRecordDto> {
  const seed = P6T3_SEEDS[name]
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
 * Build a P6-T3 world: the P6-T1 durable world with the P6-T3 blueprint
 * source and the named seed members (leader included by default — caller
 * resolution requires the acting member record to exist).
 *
 * @param basename - the scratch dir basename (unique per test).
 * @param seedNames - which seed members to install (default leader+worker).
 * @param options - the P6-T1 world options (ports, extra seeds, ...).
 * @returns the seeded P6-T3 world.
 */
export async function createP6T3World(
  basename: string,
  seedNames: readonly P6T3SeedName[] = ['leader', 'worker'],
  options: P6T1WorldOptions = {},
): Promise<P6T1World> {
  return createP6T1World(basename, {
    blueprintSource: P6T3_BLUEPRINT_SOURCE,
    ...options,
    seedMembers: [
      ...seedNames.map((name) => p6t3Seed(name)),
      ...(options.seedMembers ?? []),
    ],
  })
}

/**
 * Build the P6-T3 TeamRuntime over one world (the production wiring:
 * the injected ports, no lifecycle commit port — the P6-T2 default).
 *
 * @param world - the P6-T3 world.
 * @returns the action router facade.
 */
export function createP6T3Runtime(world: P6T1World): TeamRuntime {
  return createTeamRuntime({
    teamDomain: world.domain,
    activationProvider: world.provider,
    blueprintCatalog: world.catalog,
    environmentFacts: world.ports.environmentFacts,
    externalPolicyFacts: world.ports.externalPolicyFacts,
    now: () => P6T3_NOW,
  })
}

/**
 * The RECORDING session input port fake (the only external effect in the
 * unit world; the real public Session input API integrates at P6-T6).
 *
 * Fault injection: `setFailures(n)` makes the next n submissions throw
 * (the commit-or-throws contract: a failed submit delivered nothing);
 * `setFailSession(sessionId)` makes every submit to one session throw
 * (for the recovery-abort test: the first pending delivery succeeds, the
 * second fails).
 */
export class FakeSessionInputPort implements SessionInputPort {
  /** Every successfully submitted input, in order. */
  readonly inputs: AttributedSessionInput[] = []
  /** The number of submissions still failing (then healthy again). */
  private failuresRemaining = 0
  /** The session id whose submissions fail (or undefined: none). */
  private failSession: string | undefined

  /** Make the next `count` submissions throw. */
  setFailures(count: number): void {
    this.failuresRemaining = count
  }

  /** Make every submission to `sessionId` throw (undefined clears). */
  setFailSession(sessionId: string | undefined): void {
    this.failSession = sessionId
  }

  /** The submitted inputs addressed to one session, in order. */
  inputsFor(sessionId: string): AttributedSessionInput[] {
    return this.inputs.filter((input) => input.sessionId === sessionId)
  }

  async submitAttributedInput(input: AttributedSessionInput): Promise<void> {
    if (this.failuresRemaining > 0) {
      this.failuresRemaining -= 1
      throw new Error('injected-fault: the session input seam is unavailable')
    }
    if (this.failSession !== undefined && input.sessionId === this.failSession) {
      throw new Error(
        `injected-fault: the session input seam is unavailable for '${input.sessionId}'`,
      )
    }
    this.inputs.push(input)
  }
}

/**
 * Build the P6-T3 messaging coordinator over one world (a FRESH facade +
 * coordinator per world — after a restart, wire the new world; the
 * coordinator's locks and the facade's locks are per-wiring).
 *
 * @param world - the P6-T3 world.
 * @param sessionInput - the recording session input port.
 * @returns the messaging surface.
 */
export function createP6T3Coordinator(
  world: P6T1World,
  sessionInput: SessionInputPort,
): MessagingCoordinator {
  return createMessagingCoordinator({
    teamRuntime: createP6T3Runtime(world),
    teamDomain: world.domain,
    sessionInput,
    now: () => P6T3_NOW,
  })
}

/** A LeaderInstance caller. */
export function leaderCaller(): ActionCaller {
  return { kind: 'instance', instanceId: 'inst-leader' }
}

/** An arbitrary member caller. */
export function memberCaller(instanceId: string): ActionCaller {
  return { kind: 'instance', instanceId }
}

/** A human (team owner) caller. */
export function humanCaller(humanId = 'human-p6t3-owner'): ActionCaller {
  return { kind: 'human', humanId }
}

/**
 * Build a P6-T3 send request with the defaults (a leader send to the
 * worker); every field is overridable.
 *
 * @param overrides - the per-test overrides.
 * @returns the send request.
 */
export function makeSendRequest(
  overrides: Partial<SendTeamMessageRequest> = {},
): SendTeamMessageRequest {
  return {
    rootSessionId: P6T3_ROOT,
    caller: leaderCaller(),
    recipientInstanceId: P6T3_SEEDS.worker.instanceId,
    body: 'default body',
    requestToken: 'tok-p6t3-default',
    ...overrides,
  }
}

function describeError(error: unknown): string {
  return error instanceof Error ? `${error.name}: ${error.message}` : String(error)
}

/**
 * Assert that `error` is a MessagingError with exactly `code` (test
 * failure otherwise) and return the typed code + a copy of the details.
 *
 * @param error - the thrown/rejected value.
 * @param code - the expected closed error code.
 * @returns the checked code and details.
 */
export function assertMessagingCode(
  error: unknown,
  code: string,
): { readonly code: string; readonly details?: Record<string, unknown> } {
  if (!isMessagingError(error)) {
    throw new Error(
      `assertMessagingCode: expected MessagingError '${code}', got ${describeError(error)}`,
    )
  }
  if (error.code !== code) {
    throw new Error(
      `assertMessagingCode: expected '${code}', got '${error.code}': ${error.message}`,
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
 * Expect one send to be REJECTED with `code` (test failure when the send
 * is delivered instead); resolves to the typed error + code + details.
 *
 * @param coordinator - the messaging coordinator under test.
 * @param request - the send request.
 * @param code - the expected rejection code.
 * @returns the rejected MessagingError with its code and details.
 */
export function expectMessagingRejection(
  coordinator: MessagingCoordinator,
  request: SendTeamMessageRequest,
  code: string,
): Promise<{
  readonly error: MessagingError
  readonly code: string
  readonly details?: Record<string, unknown>
}> {
  return coordinator.sendTeamMessage(request).then(
    (outcome) => {
      throw new Error(
        `expectMessagingRejection('${code}'): the send was delivered (confirmation sequence ${outcome.deliveredSequence})`,
      )
    },
    (error: unknown) => {
      const checked = assertMessagingCode(error, code)
      const result: {
        error: MessagingError
        code: string
        details?: Record<string, unknown>
      } = { error: error as MessagingError, code: checked.code }
      if (checked.details !== undefined) {
        result.details = checked.details
      }
      return result
    },
  )
}

/**
 * List the durable ledger facts of one family for the P6-T3 team root
 * (optionally filtered on the payload).
 *
 * @param world - the P6-T3 world.
 * @param factType - the fact family discriminator.
 * @param filter - the optional payload filter.
 * @returns the matching facts (ledger order).
 */
export function findFacts(
  world: P6T1World,
  factType: string,
  filter?: (payload: Record<string, unknown>) => boolean,
): LedgerEntry[] {
  return world.domain.repositories.ledger.list().filter((entry) => {
    if (entry.factType !== factType) return false
    if (String(entry.rootSessionId) !== P6T3_ROOT) return false
    return filter === undefined || filter(entry.payload)
  })
}

/**
 * Put one instance-scoped autonomy overlay (the authority-recorded grant
 * / mutation surface; in the unit world the test plays the other
 * authority — invariant 37's no-self-escalation is the P4 store's job).
 *
 * @param world - the P6-T3 world.
 * @param instanceId - the member instance the overlay binds to.
 * @param recordId - the overlay record identity (stable per grant line).
 * @param options - the optional generation / values / origin overrides
 *  (defaults: generation 1, values `{ messagingPeerDirect: true }`,
 *  origin `leader`).
 * @returns the frozen stored record.
 */
export function putP6T3Overlay(
  world: P6T1World,
  instanceId: string,
  recordId: string,
  options: {
    readonly generation?: number
    readonly values?: Record<string, unknown>
    readonly origin?: 'leader' | 'member'
  } = {},
): Promise<GovernanceOverrideRecord> {
  return world.domain.repositories.overrides.put({
    schemaVersion: 1,
    kind: 'autonomy-overlay',
    recordId,
    scope: 'instance',
    rootSessionId: P6T3_ROOT,
    instanceId,
    origin: options.origin ?? 'leader',
    values: options.values ?? { [PEER_DIRECT_GRANT_KEY]: true },
    generation: options.generation ?? 1,
    updatedAt: P6T3_NOW,
  })
}
