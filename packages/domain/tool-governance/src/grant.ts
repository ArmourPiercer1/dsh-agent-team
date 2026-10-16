/**
 * `OperationGrant` — the single-use authorization of ONE operation
 * (design §4.2: Member + call identity + parameter Fingerprint + Binding
 * revision + authority generation + effects + one-shot + optional expiry).
 *
 * WHAT THIS IS NOT (design §4.2, verbatim intent): "Grant 不能做为模型可持有
 * 的重放 Bearer" — a grant is not a bearer token, is not model-visible, and is
 * not renewable. It is not a second ApprovalCase and creates no standing
 * permission (plan §0.4 / §3): PR0 carries NO persistence; consumption lives
 * in PR2's durable ledger, which reaches this pure validation only as an
 * immutable read-only VIEW ({@link GrantConsumptionLedgerView}).
 *
 * The checks below are the ones the PR2 kernel will need, stated once, in the
 * domain layer, so no lane re-spells them with different precedence.
 *
 * Purity: no `node:*`, no I/O, no clock (`now` is injected per call).
 *
 * @module @dsh-agent-team/domain/tool-governance/grant
 */

import { parseRequestedEffectSet, effectsAreSubset, type RequestedEffectSet } from './effects.js'
import {
  closeRecordKeys,
  finish,
  isRecord,
  reqFingerprint,
  reqNonNegativeInt,
  reqString,
  type ParseResult,
  type ProblemSink,
} from './parse-util.js'

/** A Member identity as the domain states it (contracts brands erased). */
export interface MemberRef {
  readonly teamSessionId: string
  readonly instanceId: string
}

/** The single-use operation grant (deep-frozen by the parser). */
export interface OperationGrant {
  readonly grantId: string
  readonly member: MemberRef
  readonly callId: string
  readonly realmId: string
  readonly bindingId: string
  readonly bindingRevision: number
  readonly authorityGeneration: number
  readonly parametersFingerprint: string
  readonly effects: RequestedEffectSet
  /** Type-level AND runtime-level literal `true` — renewal is unrepresentable. */
  readonly singleUse: true
  readonly issuedAt: number
  /** `null` means NO expiry — never an expiry at zero. */
  readonly expiresAt: number | null
}

/** The immutable consumption view PR2's ledger presents to this validation. */
export interface GrantConsumptionLedgerView {
  readonly isConsumed: (grantId: string) => boolean
}

/** The closed refusal reasons of one grant validation. */
export const GRANT_REFUSAL_REASONS = [
  'member-mismatch',
  'call-identity-mismatch',
  'realm-mismatch',
  'authority-generation-stale',
  'binding-revision-mismatch',
  'parameters-fingerprint-mismatch',
  'effect-outside-grant',
  'grant-expired',
  'grant-consumed',
] as const

/** One grant refusal reason. */
export type GrantRefusalReason = (typeof GRANT_REFUSAL_REASONS)[number]

/** The frozen reason → §5 error-code mapping PR2 surfaces to callers. */
const REFUSAL_ERROR_CODES: Readonly<Record<GrantRefusalReason, string>> = Object.freeze({
  'member-mismatch': 'TOOL_BINDING_UNVERIFIED',
  'call-identity-mismatch': 'TOOL_BINDING_UNVERIFIED',
  'realm-mismatch': 'TOOL_BINDING_UNVERIFIED',
  'authority-generation-stale': 'APPROVAL_STALE',
  'binding-revision-mismatch': 'TOOL_BINDING_UNVERIFIED',
  'parameters-fingerprint-mismatch': 'APPROVAL_STALE',
  'effect-outside-grant': 'TOOL_BINDING_UNVERIFIED',
  'grant-expired': 'APPROVAL_STALE',
  'grant-consumed': 'APPROVAL_STALE',
})

/** Which §5 error code a refusal surfaces (the mapping is frozen in PR0). */
export function grantRefusalErrorCode(reason: GrantRefusalReason): string {
  return REFUSAL_ERROR_CODES[reason]
}

/** One validated call against one grant. */
export interface GrantCallContext {
  /** Injected wall clock (the module owns no clock). */
  readonly now: number
  readonly currentAuthorityGeneration: number
  readonly member: MemberRef
  readonly callId: string
  readonly realmId: string
  readonly bindingId: string
  readonly bindingRevision: number
  readonly parametersFingerprint: string
  readonly requestedEffects: RequestedEffectSet
}

/** A grant validation outcome. */
export type GrantValidation = { readonly ok: true } | { readonly ok: false; readonly reason: GrantRefusalReason }

function memberEquals(a: MemberRef, b: MemberRef): boolean {
  return a.teamSessionId === b.teamSessionId && a.instanceId === b.instanceId
}

/**
 * Validate a grant for ONE call. Deterministic precedence (stated, so every
 * consumer distinguishes the same way): identity → realm → generation →
 * binding revision → parameter fingerprint → effect containment (realm of
 * each effect resource first, subset second) → expiry → consumption LAST
 * (a stale or wrong call is stale/wrong even after consumption).
 */
export function validateGrantForCall(
  grant: OperationGrant,
  call: GrantCallContext,
  ledger: GrantConsumptionLedgerView,
): GrantValidation {
  if (!memberEquals(grant.member, call.member)) return { ok: false, reason: 'member-mismatch' }
  if (grant.callId !== call.callId) return { ok: false, reason: 'call-identity-mismatch' }
  if (grant.realmId !== call.realmId) return { ok: false, reason: 'realm-mismatch' }
  if (grant.authorityGeneration !== call.currentAuthorityGeneration) return { ok: false, reason: 'authority-generation-stale' }
  if (grant.bindingId !== call.bindingId || grant.bindingRevision !== call.bindingRevision) {
    return { ok: false, reason: 'binding-revision-mismatch' }
  }
  if (grant.parametersFingerprint !== call.parametersFingerprint) return { ok: false, reason: 'parameters-fingerprint-mismatch' }
  const foreignRealm = call.requestedEffects.effects.find(
    (effect) => effect.resource !== null && effect.resource.realmId !== grant.realmId,
  )
  if (foreignRealm !== undefined) return { ok: false, reason: 'realm-mismatch' }
  if (!effectsAreSubset(call.requestedEffects, grant.effects)) return { ok: false, reason: 'effect-outside-grant' }
  if (grant.expiresAt !== null && call.now > grant.expiresAt) return { ok: false, reason: 'grant-expired' }
  if (ledger.isConsumed(grant.grantId)) return { ok: false, reason: 'grant-consumed' }
  return { ok: true }
}

function parseMember(raw: unknown, problems: ProblemSink): MemberRef | undefined {
  if (!isRecord(raw)) {
    problems.push({ code: 'not-a-record', path: '$.member', detail: '`member` must be a record { teamSessionId, instanceId }' })
    return undefined
  }
  closeRecordKeys(raw, ['teamSessionId', 'instanceId'], '$.member', problems)
  const teamSessionId = reqString(raw, 'teamSessionId', '$.member', problems)
  const instanceId = reqString(raw, 'instanceId', '$.member', problems)
  if (teamSessionId === undefined || instanceId === undefined) return undefined
  return { teamSessionId, instanceId }
}

/** Strictly parse one raw operation grant. */
export function parseOperationGrant(raw: unknown): ParseResult<OperationGrant> {
  const problems: ProblemSink = []
  if (!isRecord(raw)) {
    return { ok: false, problems: [{ code: 'not-a-record', path: '$', detail: 'an OperationGrant must be a record' }] }
  }
  closeRecordKeys(
    raw,
    [
      'grantId',
      'member',
      'callId',
      'realmId',
      'bindingId',
      'bindingRevision',
      'authorityGeneration',
      'parametersFingerprint',
      'effects',
      'singleUse',
      'issuedAt',
      'expiresAt',
    ],
    '$',
    problems,
  )
  const grantId = reqString(raw, 'grantId', '$', problems)
  const member = parseMember(raw['member'], problems)
  const callId = reqString(raw, 'callId', '$', problems)
  const realmId = reqString(raw, 'realmId', '$', problems)
  const bindingId = reqString(raw, 'bindingId', '$', problems)
  const bindingRevision = reqNonNegativeInt(raw, 'bindingRevision', '$', problems)
  const authorityGeneration = reqNonNegativeInt(raw, 'authorityGeneration', '$', problems)
  const parametersFingerprint = reqFingerprint(raw, 'parametersFingerprint', '$', problems)
  const effectsResult = parseRequestedEffectSet(raw['effects'])
  if (!effectsResult.ok) {
    problems.push(...effectsResult.problems.map((p) => ({ ...p, path: `$.effects${p.path === '$' ? '' : p.path.slice(1)}` })))
  }
  if (raw['singleUse'] !== true) {
    problems.push({ code: 'value-outside-closed-set', path: '$.singleUse', detail: 'a grant is single-use by construction (`singleUse: true`); renewal is unrepresentable' })
  }
  const issuedAtRaw = raw['issuedAt']
  if (typeof issuedAtRaw !== 'number' || !Number.isFinite(issuedAtRaw)) {
    problems.push({ code: 'field-type', path: '$.issuedAt', detail: '`issuedAt` must be a finite number' })
  }
  const expiresRaw = raw['expiresAt']
  let expiresAt: number | null | undefined
  if (expiresRaw === null) {
    expiresAt = null
  } else if (typeof expiresRaw === 'number' && Number.isFinite(expiresRaw)) {
    expiresAt = expiresRaw
  } else {
    problems.push({ code: 'field-type', path: '$.expiresAt', detail: '`expiresAt` must be a finite number or null (no expiry)' })
    expiresAt = undefined
  }
  if (typeof issuedAtRaw === 'number' && typeof expiresAt === 'number' && expiresAt < issuedAtRaw) {
    problems.push({ code: 'contradiction', path: '$.expiresAt', detail: 'expiry before issuance' })
  }
  return finish(problems, () => ({
    grantId: grantId as string,
    member: member as MemberRef,
    callId: callId as string,
    realmId: realmId as string,
    bindingId: bindingId as string,
    bindingRevision: bindingRevision as number,
    authorityGeneration: authorityGeneration as number,
    parametersFingerprint: parametersFingerprint as string,
    effects: effectsResult.ok ? effectsResult.value : ({} as RequestedEffectSet),
    singleUse: true as const,
    issuedAt: issuedAtRaw as number,
    expiresAt: expiresAt as number | null,
  }))
}
