/**
 * `ExecutionLease` — the authorization scope of an EXECUTING instance
 * (design §4.2: 后台执行实例、进程树/远端 Job + scope + 取消语义;
 * "不会扩大原 Grant").
 *
 * THE TWO FACTS THIS KEEPS APART (design §4.3, §3.6):
 *
 *  1. a Grant says what an operation MAY do; a Lease says what an ALIVE
 *     execution instance currently IS. Grant invalidation and lease
 *     termination are recorded SEPARATELY ("Grant 失效与 Lease 的终止保证要
 *     分开记录").
 *  2. `cancel requested ≠ terminated`. A cancellation request moves the lease
 *     to `cancelling`; only a settlement — a confirmation the provider owes —
 *     moves it to `terminated`. A settlement that cannot confirm moves it to
 *     `termination-unconfirmed`, which is exactly where the §5 error
 *     `EXECUTION_TERMINATION_UNCONFIRMED` belongs: the side effect may still
 *     be happening. `terminated` is absorbing: once confirmed, the lease
 *     never reopens.
 *
 * A lease never widens its grant: its scope IS the granted effect set (the
 * equality is checked by both the constructor and the parser — narrowing
 * happens per-effect at execution, not by rewriting the lease).
 *
 * Purity: no `node:*`, no I/O.
 *
 * @module @dsh-agent-team/domain/tool-governance/lease
 */

import { effectsAreSubset, parseRequestedEffectSet, type RequestedEffectSet } from './effects.js'
import type { MemberRef, OperationGrant } from './grant.js'
import {
  closeRecordKeys,
  finish,
  isRecord,
  reqFingerprint,
  reqString,
  type ParseResult,
  type ProblemSink,
} from './parse-util.js'

/** What kind of execution instance a lease holds (design §4.2). */
export const EXECUTION_LEASE_KINDS = ['background-instance', 'process-tree', 'remote-job'] as const

/** One execution-instance kind. */
export type ExecutionLeaseKind = (typeof EXECUTION_LEASE_KINDS)[number]

/** The lease lifecycle (cancellation is a REQUEST; settlement decides). */
export const LEASE_STATUSES = ['active', 'cancelling', 'termination-unconfirmed', 'terminated'] as const

/** One lease status. */
export type LeaseStatus = (typeof LEASE_STATUSES)[number]

/** One execution lease (deep-frozen by the parser/constructor). */
export interface ExecutionLease {
  readonly leaseId: string
  readonly grantId: string
  /** The canonical fingerprint of the GRANTED effect set this lease may not exceed. */
  readonly grantFingerprint: string
  readonly bindingId: string
  readonly member: MemberRef
  readonly realmId: string
  readonly executionKind: ExecutionLeaseKind
  readonly scope: RequestedEffectSet
  readonly status: LeaseStatus
}

/** A lease lifecycle outcome — typed, never thrown. */
export type LeaseAdvance =
  | { readonly ok: true; readonly lease: ExecutionLease }
  | { readonly ok: false; readonly problems: readonly { code: string; path: string; detail: string }[] }

function shapeChecks(
  fields: { grantFingerprint: string; executionKind: unknown; scope: RequestedEffectSet; grantEffects: RequestedEffectSet },
  problems: ProblemSink,
): void {
  if (!(EXECUTION_LEASE_KINDS as readonly string[]).includes(String(fields.executionKind))) {
    problems.push({ code: 'value-outside-closed-set', path: '$.executionKind', detail: `executionKind must be one of ${EXECUTION_LEASE_KINDS.join(' | ')}` })
  }
  if (!effectsAreSubset(fields.scope, fields.grantEffects) || !effectsAreSubset(fields.grantEffects, fields.scope)) {
    problems.push({
      code: 'lease-extends-grant',
      path: '$.scope',
      detail: 'a lease carries EXACTLY the granted effect set (it never widens it; narrowing is per-effect at execution)',
    })
  }
}

/** Open a lease for a consumed grant with the grant's own effect scope.
 *  Parses like every other constructor in the lane (`ParseResult` shape);
 *  the LIFECYCLE advances below carry the lease under `.lease`. */
export function openExecutionLease(input: {
  readonly leaseId: string
  readonly grant: OperationGrant
  readonly executionKind: ExecutionLeaseKind
  readonly scope: RequestedEffectSet
}): ParseResult<ExecutionLease> {
  const problems: ProblemSink = []
  const { leaseId, grant, executionKind, scope } = input
  if (leaseId.trim().length === 0) problems.push({ code: 'empty-string', path: '$.leaseId', detail: '`leaseId` must be non-empty' })
  shapeChecks(
    { grantFingerprint: grant.effects.fingerprint, executionKind, scope, grantEffects: grant.effects },
    problems,
  )
  if (scope.fingerprint !== grant.effects.fingerprint) {
    problems.push({ code: 'lease-extends-grant', path: '$.scope.fingerprint', detail: 'the lease scope fingerprint must equal the granted effect-set fingerprint' })
  }
  return finish(problems, () => Object.freeze({
    leaseId,
    grantId: grant.grantId,
    grantFingerprint: grant.effects.fingerprint,
    bindingId: grant.bindingId,
    member: grant.member,
    realmId: grant.realmId,
    executionKind,
    scope,
    status: 'active' as const,
  }))
}

/**
 * Strictly parse a raw lease record against the §4.2 shape. The scope must
 * carry the granted fingerprint verbatim — a widened (or re-spelled) scope is
 * `lease-extends-grant`, because the grant fingerprint is the only anchor a
 * dormant lease can be checked against without the live grant.
 */
export function parseExecutionLease(raw: unknown): ParseResult<ExecutionLease> {
  const problems: ProblemSink = []
  if (!isRecord(raw)) {
    return { ok: false, problems: [{ code: 'not-a-record', path: '$', detail: 'an ExecutionLease must be a record' }] }
  }
  closeRecordKeys(
    raw,
    ['leaseId', 'grantId', 'grantFingerprint', 'bindingId', 'member', 'realmId', 'executionKind', 'scope', 'status'],
    '$',
    problems,
  )
  const leaseId = reqString(raw, 'leaseId', '$', problems)
  const grantId = reqString(raw, 'grantId', '$', problems)
  const grantFingerprint = reqFingerprint(raw, 'grantFingerprint', '$', problems)
  const bindingId = reqString(raw, 'bindingId', '$', problems)
  const memberRaw = raw['member']
  let member: MemberRef | undefined
  if (isRecord(memberRaw) && typeof memberRaw['teamSessionId'] === 'string' && typeof memberRaw['instanceId'] === 'string') {
    closeRecordKeys(memberRaw, ['teamSessionId', 'instanceId'], '$.member', problems)
    member = { teamSessionId: memberRaw['teamSessionId'], instanceId: memberRaw['instanceId'] }
  } else {
    problems.push({ code: 'not-a-record', path: '$.member', detail: '`member` must be a record { teamSessionId, instanceId }' })
  }
  const realmId = reqString(raw, 'realmId', '$', problems)
  const executionKindRaw = raw['executionKind']
  const scopeResult = parseRequestedEffectSet(raw['scope'])
  if (!scopeResult.ok) {
    problems.push(...scopeResult.problems.map((p) => ({ ...p, path: `$.scope${p.path === '$' ? '' : p.path.slice(1)}` })))
  }
  const statusRaw = raw['status']
  if (typeof statusRaw !== 'string' || !(LEASE_STATUSES as readonly string[]).includes(statusRaw)) {
    problems.push({ code: 'value-outside-closed-set', path: '$.status', detail: `status must be one of ${LEASE_STATUSES.join(' | ')}` })
  }
  if (scopeResult.ok && grantFingerprint !== undefined) {
    // The scope's canonical fingerprint must BE the granted fingerprint: the
    // lease never widens, and a dormant lease record carries no wider truth.
    if (scopeResult.value.fingerprint !== grantFingerprint) {
      problems.push({
        code: 'lease-extends-grant',
        path: '$.scope',
        detail: 'the lease scope does not hash to its grantFingerprint (a lease never carries more than its Grant)',
      })
    }
  }
  return finish(problems, () => ({
    leaseId: leaseId as string,
    grantId: grantId as string,
    grantFingerprint: grantFingerprint as string,
    bindingId: bindingId as string,
    member: member as MemberRef,
    realmId: realmId as string,
    executionKind: executionKindRaw as ExecutionLeaseKind,
    scope: scopeResult.ok ? scopeResult.value : ({} as RequestedEffectSet),
    status: statusRaw as LeaseStatus,
  }))
}

/**
 * REQUEST a cancellation (kill requested ≠ terminated, design §3.6). Legal
 * from any non-terminal status; the terminal `terminated` refuses with
 * `lease-terminal`.
 */
export function requestLeaseCancellation(lease: ExecutionLease): LeaseAdvance {
  if (lease.status === 'terminated') {
    return {
      ok: false,
      problems: [{ code: 'lease-terminal', path: '$.status', detail: 'a terminated lease is absorbing; cancellation does not reopen it' }],
    }
  }
  return { ok: true, lease: Object.freeze({ ...lease, status: 'cancelling' as const }) }
}

/**
 * Settle a lease's termination from the provider's confirmation.
 * `confirmed: false` records the HONEST state `termination-unconfirmed` —
 * the §5 error `EXECUTION_TERMINATION_UNCONFIRMED` is the caller's surface
 * for it. `terminated` never reopens.
 */
export function settleLeaseTermination(lease: ExecutionLease, confirmed: boolean): LeaseAdvance {
  if (lease.status === 'terminated') {
    return {
      ok: false,
      problems: [{ code: 'lease-terminal', path: '$.status', detail: 'a terminated lease is absorbing' }],
    }
  }
  if (!confirmed && lease.status === 'active') {
    return {
      ok: false,
      problems: [{ code: 'contradiction', path: '$.status', detail: 'an active lease settles only by completion (confirmed) — first REQUEST the cancellation' }],
    }
  }
  const next: LeaseStatus = confirmed ? 'terminated' : 'termination-unconfirmed'
  return { ok: true, lease: Object.freeze({ ...lease, status: next }) }
}
