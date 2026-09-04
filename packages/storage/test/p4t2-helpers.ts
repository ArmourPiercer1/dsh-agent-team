/**
 * p4t2-helpers — shared fixtures for the P4-T2 (OperationJournal /
 * idempotency protocol) tests.
 *
 * Reuses the P4-T1 in-memory seam fake (`InMemoryStorageSeam`) and fixture
 * identities (`P4_FIXTURE`, `memberInstanceInput`); adds the P4-T2
 * provisioning scenario: one TeamSession, one operation
 * `create-member-instance` with TWO idempotent effects (session binding,
 * member instance) mirroring Development Plan §17.4 (TeamDomain write A →
 * external DSH Session/Agent creation → TeamDomain write B), where every
 * effect is check-then-apply through the TeamDomain repositories so a
 * re-drive after a crash SKIPS what a previous attempt already wrote.
 *
 * Test-only module: never imported by production code.
 * @module @dsh-agent-team/storage/test/p4t2-helpers
 */

import {
  createMemberInstanceRecord,
  parseChildSessionId,
  parseInstanceId,
  parseRootSessionId,
  serializeMemberInstanceRecord,
  type ChildSessionId,
  type RemoteSafeRecord,
  type RootSessionId,
} from '../../contracts/src/index.js'
import {
  createOperationJournal,
  type EffectsResolver,
  type JournalContext,
  type OperationJournal,
  type OperationRequest,
} from '../operations/index.js'
import { createTeamDomain, type TeamDomain } from '../repositories/index.js'
import { isTeamDomainError, teamDomainError, type OperationRecord } from '../schema/index.js'
import { InMemoryStorageSeam, P4_FIXTURE, memberInstanceInput, teamSessionInput } from './p4-helpers.js'

/** The provisioning operation's durable identity (stable across all p4t2 tests). */
export const P4T2_PROVISION = {
  operationId: 'op-p4t2prov01',
  idempotencyKey: 'p4t2-provision-alpha',
  intentType: 'create-member-instance',
  payload: {
    childSessionId: 'session-child-1',
    instanceId: 'inst-alpha',
  },
} as const

/**
 * The provisioning request: the SAME logical operation re-submitted by a
 * retry. `overrides` deep-copies each field, so callers can derive conflict
 * variants (different key / intent) without mutating the canonical one.
 */
export function provisionRequest(
  overrides: {
    operationId?: string
    idempotencyKey?: string
    intentType?: string
    payload?: RemoteSafeRecord
    childSessionId?: ChildSessionId
  } = {},
): OperationRequest {
  return {
    operationId: overrides.operationId ?? P4T2_PROVISION.operationId,
    idempotencyKey: overrides.idempotencyKey ?? P4T2_PROVISION.idempotencyKey,
    intent: {
      type: overrides.intentType ?? P4T2_PROVISION.intentType,
      payload: overrides.payload ?? { ...P4T2_PROVISION.payload },
    },
    ...(overrides.childSessionId !== undefined ? { childSessionId: overrides.childSessionId } : {}),
  }
}

/**
 * Effect 1 — the session binding (TeamDomain write A of the provisioning
 * flow). Idempotent: an existing identical team-member binding is SKIPPED;
 * a conflicting binding fails with the typed repository conflict
 * (never overwritten).
 */
export function bindingEffect(): { name: string; apply(ctx: JournalContext): Promise<{ applied: boolean }> } {
  return {
    name: 'session-binding',
    async apply(ctx) {
      const childSessionId = String(ctx.operation.intent.payload['childSessionId'])
      const instanceId = String(ctx.operation.intent.payload['instanceId'])
      const rootSessionId = String(ctx.rootSessionId)
      const existing = ctx.domain.repositories.sessionBindings.get(childSessionId)
      if (existing !== undefined) {
        if (
          existing.kind === 'team-member' &&
          String(existing.rootSessionId) === rootSessionId &&
          String(existing.instanceId) === instanceId
        ) {
          return { applied: false }
        }
        throw makeSeamConflict(childSessionId)
      }
      await ctx.domain.repositories.sessionBindings.put({
        instanceId,
        kind: 'team-member',
        rootSessionId,
        schemaVersion: 1,
        sessionId: childSessionId,
      })
      return { applied: true }
    },
  }
}

/**
 * Effect 2 — the member instance (TeamDomain write B). Idempotent: an
 * existing byte-identical record is SKIPPED; a differing record falls
 * through to the typed repository duplicate conflict.
 */
export function memberEffect(): { name: string; apply(ctx: JournalContext): Promise<{ applied: boolean }> } {
  return {
    name: 'member-instance',
    async apply(ctx) {
      const rootSessionId = String(ctx.rootSessionId)
      const instanceId = String(ctx.operation.intent.payload['instanceId'])
      const childSessionId = String(ctx.operation.intent.payload['childSessionId'])
      const input = memberInstanceInput(parseRootSessionId(rootSessionId), parseInstanceId(instanceId), parseChildSessionId(childSessionId))
      const existing = ctx.domain.repositories.memberInstances.get(rootSessionId, instanceId)
      if (existing !== undefined) {
        if (serializeMemberInstanceRecord(existing) === serializeMemberInstanceRecord(createMemberInstanceRecord(input))) {
          return { applied: false }
        }
        // Differing existing record: fall through — the repository raises the typed conflict.
      }
      await ctx.domain.repositories.memberInstances.put(input)
      return { applied: true }
    },
  }
}

/**
 * The provisioning effects resolver: BOTH effects only apply to the
 * `create-member-instance` intent (every other intent is a no-op effect
 * list — the journal then commits an effects-less operation).
 */
export function provisioningEffects(): EffectsResolver {
  const binding = bindingEffect()
  const member = memberEffect()
  return (intent) => (intent.type === P4T2_PROVISION.intentType ? [binding, member] : [])
}

/** A TeamDomain with its TEAM-scoped operation journal attached (test convenience). */
export interface P4t2Domain extends TeamDomain {
  readonly journal: OperationJournal
}

/** Build a TEAM-scoped journal over a freshly CREATED domain (default provisioning effects). */
export async function createP4t2Journal(
  seam: InMemoryStorageSeam,
  rootSessionId: RootSessionId | string = P4_FIXTURE.rootSessionId,
  effects: EffectsResolver | undefined = provisioningEffects(),
): Promise<P4t2Domain> {
  const domain = await createTeamDomain(seam)
  // G8-S1 (R60): every new ledger fact now also advances the TeamSession's
  // generation stamp, and a fact for a missing team row is a loud
  // SEAM_FAILURE (invariant: facts belong to an existing team). The factory
  // therefore seeds the team row the journal's root addresses, before any
  // test captures its write-count base.
  await domain.repositories.teamSessions.put(teamSessionInput(parseRootSessionId(String(rootSessionId))))
  return { ...domain, journal: createOperationJournal(domain, rootSessionId, effects) }
}

/** A typed TeamDomainError for the binding-conflict case (mirrors the repository's). */
function makeSeamConflict(sessionId: string) {
  return teamDomainError('RECORD_DUPLICATE', `session '${sessionId}' is already bound to another member`, {
    store: 'session_bindings',
    key: sessionId,
    problem: 'session-already-bound',
  })
}

/** True when `error` is a SEAM_FAILURE TeamDomainError (the crash fake's surface). */
export function isSeamFailure(error: unknown): boolean {
  return isTeamDomainError(error) && error.code === 'SEAM_FAILURE'
}

/** The number of seam writes (optionally restricted to one table) in `seam.writeLog`. */
export function countWrites(seam: InMemoryStorageSeam, table?: string): number {
  return seam.writeLog.filter((entry) => (table === undefined ? true : entry.table === table)).length
}

/**
 * Arm the crash AFTER exactly `n` writes: the first `n` writes succeed,
 * every later write rejects with `FakeCrashError` (STICKY — call
 * `seam.clearCrash()` before the re-drive). `base` is the caller's
 * `seam.writeCount` snapshot taken immediately before the call under test.
 */
export function armCrashAt(seam: InMemoryStorageSeam, base: number, offset: number): void {
  seam.setCrashAfterWrites(base + offset)
}

/**
 * The semantic durable result of one committed provisioning operation
 * (what "converges to the same durable result" compares): phase, key,
 * canonical intent, recorded child, ledger sequence — deliberately
 * EXCLUDING the attempt-dependent audit fields (`updatedAt`, `generation`)
 * which legitimately differ per crash history.
 */
export function durableOutcomeShape(result: {
  record: OperationRecord
  phase: string
  ledgerSequence: number | undefined
}): {
  operationId: string
  phase: string
  idempotencyKey: string
  intent: string
  childSessionId: string | null
  ledgerSequence: number | null
} {
  return {
    operationId: result.record.operationId,
    phase: result.phase,
    idempotencyKey: result.record.idempotencyKey,
    intent: JSON.stringify({ payload: result.record.intent.payload, type: result.record.intent.type }),
    childSessionId: result.record.childSessionId === undefined ? null : String(result.record.childSessionId),
    ledgerSequence: result.ledgerSequence === undefined ? null : result.ledgerSequence,
  }
}
