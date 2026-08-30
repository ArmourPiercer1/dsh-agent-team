/**
 * p4t4-adapter — the provisioning public surface (pure tests, no TeamDomain
 * world): the closed stage and diagnostic vocabularies, the deterministic
 * operation/idempotency identity derivation (Architecture §18.2), and the
 * fake adapter's idempotency + scriptable-failure contract (ruling R20:
 * the fake external effect is the only adapter implementation in P4).
 *
 * @module @dsh-agent-team/storage/test/p4t4-adapter
 */

import { describe, expect, it } from 'vitest'

import { OPERATION_ID_PATTERN } from '../schema/index.js'
import {
  FakeAgentFactoryAdapter,
  PROVISIONING_DIAGNOSTIC_CODE_VALUES,
  PROVISIONING_DIAGNOSTIC_CODES,
  PROVISIONING_STAGE_VALUES,
  PROVISIONING_STAGES,
  PROVISIONING_TERMINAL_STAGE,
  createProvisioningDiagnostic,
  deterministicToken,
  isFakeAdapterError,
  isProvisioningDiagnosticCode,
  isProvisioningStage,
  provisioningIdempotencyKey,
  provisioningOperationId,
} from '../provisioning/index.js'
import { P4_FIXTURE, capture } from './p4-helpers.js'

const ROOT = String(P4_FIXTURE.rootSessionId)
const OTHER_ROOT = String(P4_FIXTURE.otherRootSessionId)
const INSTANCE = String(P4_FIXTURE.instanceId)
const SECOND_INSTANCE = String(P4_FIXTURE.secondInstanceId)

// ---------------------------------------------------- fake adapter: captured async work (module level)

const idemRequest = {
  rootSessionId: P4_FIXTURE.rootSessionId,
  instanceId: P4_FIXTURE.instanceId,
  templateId: P4_FIXTURE.templateId,
  label: 'Alpha',
}
const idemAdapter = new FakeAgentFactoryAdapter()
const idemFirst = await idemAdapter.createChildSession(idemRequest)
const idemSecond = await idemAdapter.createChildSession(idemRequest)
const restartedAdapter = new FakeAgentFactoryAdapter()
const rederived = await restartedAdapter.createChildSession(idemRequest)

const distinctAdapter = new FakeAgentFactoryAdapter()
const distinctA = await distinctAdapter.createChildSession({
  rootSessionId: P4_FIXTURE.rootSessionId,
  instanceId: P4_FIXTURE.instanceId,
  templateId: P4_FIXTURE.templateId,
  label: 'Alpha',
})
const distinctB = await distinctAdapter.createChildSession({
  rootSessionId: P4_FIXTURE.rootSessionId,
  instanceId: P4_FIXTURE.secondInstanceId,
  templateId: P4_FIXTURE.templateId,
  label: 'Beta',
})

const failAdapter = new FakeAgentFactoryAdapter()
failAdapter.failNext(2)
const failFirst = await capture(() => failAdapter.createChildSession(idemRequest))
const failSecond = await capture(() => failAdapter.createChildSession(idemRequest))
const failThird = await failAdapter.createChildSession(idemRequest)

const gateAdapter = new FakeAgentFactoryAdapter()
gateAdapter.failAlwaysFail()
const gateFailed = await capture(() => gateAdapter.createChildSession(idemRequest))
gateAdapter.clearFailures()
const gateOk = await gateAdapter.createChildSession(idemRequest)

describe('provisioning stages (the internal provisioning state, Architecture §18)', () => {
  it('is the closed set NONE + the four durable protocol stages', () => {
    expect(PROVISIONING_STAGE_VALUES).toEqual([
      'NONE',
      'ALLOCATED',
      'CHILD_SESSION_CREATED',
      'CHILD_BOUND',
      'INSTANCE_COMMITTED',
    ])
    expect(PROVISIONING_STAGES.NONE).toBe('NONE')
    expect(PROVISIONING_STAGES.ALLOCATED).toBe('ALLOCATED')
    expect(PROVISIONING_STAGES.CHILD_SESSION_CREATED).toBe('CHILD_SESSION_CREATED')
    expect(PROVISIONING_STAGES.CHILD_BOUND).toBe('CHILD_BOUND')
    expect(PROVISIONING_STAGES.INSTANCE_COMMITTED).toBe('INSTANCE_COMMITTED')
    expect(PROVISIONING_TERMINAL_STAGE).toBe(PROVISIONING_STAGES.INSTANCE_COMMITTED)
    expect(isProvisioningStage(PROVISIONING_STAGES.CHILD_BOUND)).toBe(true)
    expect(isProvisioningStage('PROVISIONING')).toBe(false)
    expect(isProvisioningStage(undefined)).toBe(false)
  })
})

describe('provisioning diagnostics (the closed v1 vocabulary, Development Plan §17.4)', () => {
  it('is the closed set of the two v1 codes', () => {
    expect(PROVISIONING_DIAGNOSTIC_CODE_VALUES).toEqual(['orphaned-child-session', 'member-not-provisioned'])
    expect(PROVISIONING_DIAGNOSTIC_CODES.ORPHANED_CHILD_SESSION).toBe('orphaned-child-session')
    expect(PROVISIONING_DIAGNOSTIC_CODES.MEMBER_NOT_PROVISIONED).toBe('member-not-provisioned')
    expect(isProvisioningDiagnosticCode('orphaned-child-session')).toBe(true)
    expect(isProvisioningDiagnosticCode('silent-loss')).toBe(false)
  })

  it('builds a frozen, remote-safe diagnostic with the stable branch fields', () => {
    const diagnostic = createProvisioningDiagnostic(
      PROVISIONING_DIAGNOSTIC_CODES.ORPHANED_CHILD_SESSION,
      ROOT,
      INSTANCE,
      PROVISIONING_STAGES.CHILD_BOUND,
      'stalled',
      { operationId: 'op-abc', childSessionId: 'session-child-x', context: { missing: ['commit'] } },
    )
    expect(diagnostic.code).toBe('orphaned-child-session')
    expect(diagnostic.rootSessionId).toBe(ROOT)
    expect(diagnostic.instanceId).toBe(INSTANCE)
    expect(diagnostic.stage).toBe(PROVISIONING_STAGES.CHILD_BOUND)
    expect(diagnostic.operationId).toBe('op-abc')
    expect(diagnostic.childSessionId).toBe('session-child-x')
    expect(diagnostic.context).toEqual({ missing: ['commit'] })
    // Deep-frozen: the diagnostic and its context are immutable values.
    expect(Object.isFrozen(diagnostic)).toBe(true)
    expect(Object.isFrozen(diagnostic.context)).toBe(true)
  })

  it('carries no childSessionId for a non-orphan diagnostic', () => {
    const diagnostic = createProvisioningDiagnostic(
      PROVISIONING_DIAGNOSTIC_CODES.MEMBER_NOT_PROVISIONED,
      ROOT,
      INSTANCE,
      PROVISIONING_STAGES.NONE,
      'nothing created',
    )
    expect(diagnostic.code).toBe('member-not-provisioned')
    expect(diagnostic.childSessionId).toBe(undefined)
    expect(diagnostic.operationId).toBe(undefined)
    expect(diagnostic.context).toBe(undefined)
  })
})

describe('deterministic provisioning identity (Architecture §18.2 stable operation identity)', () => {
  it('deterministicToken is a pure base36 token of bounded length', () => {
    const a = deterministicToken(`${ROOT}\u0000${INSTANCE}`, 16)
    const b = deterministicToken(`${ROOT}\u0000${INSTANCE}`, 16)
    expect(a).toBe(b)
    expect(a.length).toBe(16)
    expect(/^[a-z0-9]{16}$/.test(a)).toBe(true)
    // Different input -> (with overwhelming probability) different token.
    expect(deterministicToken(`${ROOT}\u0000${SECOND_INSTANCE}`, 16)).not.toEqual(a)
    // Length is honoured across its allowed range.
    expect(deterministicToken('x', 1).length).toBe(1)
    expect(deterministicToken('x', 56).length).toBe(56)
  })

  it('the operation id is deterministic, pattern-valid, and root-dependent (global operations store, cross-team safe)', () => {
    const opId = provisioningOperationId(ROOT, INSTANCE)
    expect(opId).toBe(provisioningOperationId(ROOT, INSTANCE))
    expect(OPERATION_ID_PATTERN.test(opId)).toBe(true)
    // The SAME instance id under a DIFFERENT team never collides.
    expect(provisioningOperationId(OTHER_ROOT, INSTANCE)).not.toEqual(opId)
    expect(OPERATION_ID_PATTERN.test(provisioningOperationId(OTHER_ROOT, INSTANCE))).toBe(true)
    // A different member under the same team gets a different operation id.
    expect(provisioningOperationId(ROOT, SECOND_INSTANCE)).not.toEqual(opId)
  })

  it('rejects structurally invalid ids loudly (opaque session-id rule for roots, pattern for instances)', () => {
    // Root session ids are OPAQUE (upstream contract): the structural rule
    // is non-empty, <= 255 chars, no control characters, no whitespace.
    const emptyRoot = () => provisioningOperationId('', INSTANCE)
    expect(emptyRoot).toThrow()
    const whitespaceRoot = () => provisioningOperationId('root with space', INSTANCE)
    expect(whitespaceRoot).toThrow()
    // Instance ids are pattern-validated (`inst-[a-z0-9]{1,32}`).
    const badInstance = () => provisioningOperationId(ROOT, 'inst-UPPER')
    expect(badInstance).toThrow()
  })

  it('the idempotency key carries the allocation token and rejects an empty one', () => {
    const key = provisioningIdempotencyKey(ROOT, INSTANCE, 'tok-1')
    expect(key).toBe('provision:session-root-1:inst-alpha:tok-1')
    expect(key).toBe(provisioningIdempotencyKey(ROOT, INSTANCE, 'tok-1'))
    expect(provisioningIdempotencyKey(ROOT, INSTANCE, 'tok-2')).not.toEqual(key)
    expect(() => provisioningIdempotencyKey(ROOT, INSTANCE, '')).toThrow()
  })
})

describe('FakeAgentFactoryAdapter (the deterministic fake external effect, ruling R20)', () => {
  it('mints one deterministic child per member and re-resolves idempotently', () => {
    expect(idemSecond.childSessionId).toBe(idemFirst.childSessionId)
    expect(idemAdapter.createCalls).toBe(2)
    expect(idemAdapter.childrenCreated).toBe(1)
    expect(idemAdapter.memberCount).toBe(1)
    expect(idemAdapter.childSessionIdFor(ROOT, INSTANCE)).toBe(idemFirst.childSessionId)
    expect(/^session-child-[a-z0-9]{16}$/.test(String(idemFirst.childSessionId))).toBe(true)
    // Deterministic across fresh fakes (a "process restart" re-derives the same child).
    expect(rederived.childSessionId).toBe(idemFirst.childSessionId)
    expect(restartedAdapter.childrenCreated).toBe(1)
  })

  it('distinct members get distinct children', () => {
    expect(distinctB.childSessionId).not.toBe(distinctA.childSessionId)
    expect(distinctAdapter.childrenCreated).toBe(2)
    expect(distinctAdapter.memberCount).toBe(2)
  })

  it('scriptable failure: failNext rejects the scripted calls (counted, never minting) until exhausted', () => {
    expect(failFirst.ok).toBe(false)
    expect(isFakeAdapterError(failFirst.error)).toBe(true)
    expect(failSecond.ok).toBe(false)
    expect(failThird.childSessionId).toBe(failAdapter.childSessionIdFor(ROOT, INSTANCE))
    expect(failAdapter.createCalls).toBe(3)
    expect(failAdapter.childrenCreated).toBe(1)
  })

  it('failAlwaysFail / clearFailures gate every call, and FakeAdapterError is typed', () => {
    expect(gateFailed.ok).toBe(false)
    expect(isFakeAdapterError(gateFailed.error)).toBe(true)
    expect((gateFailed.error as Error).name).toBe('FakeAdapterError')
    // clearFailures() un-gated the adapter: the next call minted exactly one child.
    expect(gateOk.childSessionId).toBe(gateAdapter.childSessionIdFor(ROOT, INSTANCE))
    expect(gateAdapter.childrenCreated).toBe(1)
    // failNext rejects on a non-integer / negative count.
    expect(() => gateAdapter.failNext(-1)).toThrow()
    expect(() => gateAdapter.failNext(1.5)).toThrow()
  })
})
