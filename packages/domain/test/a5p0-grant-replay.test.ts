/**
 * Alpha.5 PR0 — OPERATION GRANT NEGATIVES (plan §3: "过期 generation、重放
 * Grant 拒收"; design §4.2: "Grant 不能做为模型可持有的可重放 Bearer").
 *
 * RED-FIRST FILE. `validateGrantForCall` is pure: durability (who consumed
 * what) is PR2's ledger, injected here as an immutable read-only VIEW. PR0
 * itself persists NOTHING — there is no second ApprovalCase and no new
 * standing permission anywhere in this module.
 *
 * @module test/a5p0-grant-replay
 */
import { describe, expect, it } from 'vitest'

import {
  GRANT_REFUSAL_REASONS,
  grantRefusalErrorCode,
  parseOperationGrant,
  parseRequestedEffectSet,
  parseResourceRef,
  validateGrantForCall,
  type GrantConsumptionLedgerView,
  type OperationGrant,
} from '../tool-governance/src/index.js'

const ok = <T>(r: { ok: true; value: T } | { ok: false }): T => {
  if (!r.ok) throw new Error(`expected ok: ${JSON.stringify(r)}`)
  return r.value
}

const realm = 'realm:team-alpha:ws-1'
const member = { teamSessionId: 'ts-1', instanceId: 'inst-a1b2c3' }
const otherMember = { teamSessionId: 'ts-1', instanceId: 'inst-zz9' }

const effects = ok(
  parseRequestedEffectSet([
    { kind: 'tool-invoke', toolName: 'read', resource: null },
    { kind: 'read', resource: ok(parseResourceRef({ realmId: realm, kind: 'workspace', canonicalLocator: 'a', rights: ['read'] })) },
  ]),
)

const grantRaw = {
  grantId: 'grant-1',
  member,
  callId: 'call-1',
  realmId: realm,
  bindingId: 'bind-1',
  bindingRevision: 3,
  authorityGeneration: 9,
  parametersFingerprint: 'sha256:aaaa',
  effects,
  singleUse: true,
  issuedAt: 1000,
  expiresAt: 5000,
}

const grant: OperationGrant = ok(parseOperationGrant(grantRaw))

const freshLedger = (consumed: readonly string[] = []): GrantConsumptionLedgerView => ({
  isConsumed: (id: string) => consumed.includes(id),
})

const callFor = (over: Partial<Parameters<typeof validateGrantForCall>[1]> = {}): Parameters<typeof validateGrantForCall>[1] => ({
  now: 2000,
  currentAuthorityGeneration: 9,
  member,
  callId: 'call-1',
  realmId: realm,
  bindingId: 'bind-1',
  bindingRevision: 3,
  parametersFingerprint: 'sha256:aaaa',
  requestedEffects: effects,
  ...over,
})

describe('a well-formed single-use grant validates once', () => {
  it('positive control (every negative below shares this environment)', () => {
    expect(validateGrantForCall(grant, callFor(), freshLedger())).toEqual({ ok: true })
  })
})

describe('replay is refused (一次性)', () => {
  it('a grant the ledger reports consumed never validates again — even on an identical call', () => {
    const after = validateGrantForCall(grant, callFor(), freshLedger(['grant-1']))
    expect(after.ok).toBe(false)
    if (!after.ok) expect(after.reason).toBe('grant-consumed')
  })
  it('the closed reason vocabulary exists and maps onto the §5 error set', () => {
    expect(GRANT_REFUSAL_REASONS).toContain('grant-consumed')
    expect(grantRefusalErrorCode('grant-consumed')).toBe('APPROVAL_STALE')
    expect(grantRefusalErrorCode('binding-revision-mismatch')).toBe('TOOL_BINDING_UNVERIFIED')
  })
})

describe('staleness is refused (过期 generation / 到期)', () => {
  it('authority generation moved on ⇒ APPROVAL_STALE', () => {
    const r = validateGrantForCall(grant, callFor({ currentAuthorityGeneration: 10 }), freshLedger())
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toBe('authority-generation-stale')
  })
  it('wall-clock expiry is refused', () => {
    const r = validateGrantForCall(grant, callFor({ now: 5001 }), freshLedger())
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toBe('grant-expired')
  })
  it('null expiry means no expiry, not expiry-at-zero', () => {
    const never = ok(parseOperationGrant({ ...grantRaw, expiresAt: null }))
    expect(validateGrantForCall(never, callFor({ now: 10 ** 12 }), freshLedger()).ok).toBe(true)
  })
  it('a grant bound to binding revision 3 does not cover revision 4', () => {
    const r = validateGrantForCall(grant, callFor({ bindingRevision: 4 }), freshLedger())
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toBe('binding-revision-mismatch')
  })
})

describe('identity and parameter mismatches are refused', () => {
  it('cross-member use is refused (交叉使用不同 Member Grant 是红线)', () => {
    const r = validateGrantForCall(grant, callFor({ member: otherMember }), freshLedger())
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toBe('member-mismatch')
  })
  it('another call identity is refused', () => {
    const r = validateGrantForCall(grant, callFor({ callId: 'call-2' }), freshLedger())
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toBe('call-identity-mismatch')
  })
  it('different parameters never ride an approved fingerprint', () => {
    const r = validateGrantForCall(grant, callFor({ parametersFingerprint: 'sha256:other' }), freshLedger())
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toBe('parameters-fingerprint-mismatch')
  })
})

describe('effect containment (审批者必须合法覆盖全部效果)', () => {
  it('a request WIDER than the granted effect set is refused', () => {
    const wider = ok(
      parseRequestedEffectSet([
        ...effects.effects,
        {
          kind: 'write',
          resource: ok(parseResourceRef({ realmId: realm, kind: 'workspace', canonicalLocator: 'a', rights: ['write'] })),
        },
      ]),
    )
    const r = validateGrantForCall(grant, callFor({ requestedEffects: wider }), freshLedger())
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toBe('effect-outside-grant')
  })
  it('a request with a cross-realm resource is refused with the realm reason', () => {
    const crossRealm = ok(
      parseRequestedEffectSet([
        { kind: 'read', resource: ok(parseResourceRef({ realmId: 'realm:other', kind: 'workspace', canonicalLocator: 'a', rights: ['read'] })) },
      ]),
    )
    const r = validateGrantForCall(grant, callFor({ requestedEffects: crossRealm }), freshLedger())
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toBe('realm-mismatch')
  })
})

describe('the parser itself keeps bearer-properties impossible', () => {
  it('singleUse must be the literal true', () => {
    expect(parseOperationGrant({ ...grantRaw, singleUse: false }).ok).toBe(false)
  })
  it('an expiry before issuance is a contradiction, refused', () => {
    expect(parseOperationGrant({ ...grantRaw, issuedAt: 5000, expiresAt: 4999 }).ok).toBe(false)
  })
})
