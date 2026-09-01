/**
 * P6-T1 S-explicit — the explicit-activation path (TaskDoc §11.7 P6-T1;
 * DevPlan §19.2 check order): leader-explicit + human-ui funnels, the
 * full admission/provisioning order with the durable write sequence as the
 * ordering proof channel, the idempotent same-token replay, the loud
 * same-token different-template conflict, the complete negative matrix
 * (every reject carries ZERO durable writes), the ack-able compatibility
 * WARNING, and the invariant-26 proof (every provider-created member has a
 * matching COMMITTED operation row).
 *
 * Mock-first (ruling R28): the surface / durability / child-session factory
 * are the P5/P6 fakes; the durable layer is REAL (P4 repositories over the
 * testkit `FileStorageSeam`, the REAL provisioning coordinator, the REAL
 * ActivationProvider). The seam `writeLog` is the zero-write + ordering
 * evidence channel.
 *
 * Top-level-await pattern (plain-node shim: `it()` bodies are synchronous):
 * every scenario runs at module top level, its observables are captured
 * into a plain snapshot, the world is destroyed in `finally`; the `it`
 * bodies assert only over the captured data.
 *
 * @module @dsh-agent-team/runtime/test/p6t1-explicit
 */

import { describe, expect, it } from 'vitest'
import {
  ACTIVATION_ERROR_CODES,
  activationOperationIdentity,
  toActivationRequirements,
} from '../activation/index.js'
import type { ActivationResult, MemberActivationRequest } from '../activation/index.js'
import { parseInstanceId, parseTemplateId } from '../../contracts/src/index.js'
import { evaluateCompatibility } from '../../domain/compatibility/src/index.js'
import { OPERATION_PHASES } from '../../storage/schema/index.js'
import {
  P6T1_FIXTURE,
  LEADER_INSTANCE_ID,
  assertActivationCode,
  createP6T1World,
  destroyP6T1World,
  makeRequest,
  parseFixtureBlueprint,
} from './p6t1-helpers.js'
import type { P6T1World, SeamWrite } from './p6t1-helpers.js'

const ROOT = String(P6T1_FIXTURE.rootSessionId)

async function runActivate(
  world: P6T1World,
  request: MemberActivationRequest,
): Promise<{ result: ActivationResult | undefined; error: unknown }> {
  try {
    return { result: await world.provider.activate(request), error: undefined }
  } catch (error) {
    return { result: undefined, error }
  }
}

// ---------------------------------------------------------------------------
// S1 — leader-explicit happy path (the full order + write sequence)
// ---------------------------------------------------------------------------
let s1: {
  readonly result: ActivationResult | undefined
  readonly error: unknown
  readonly tables: string[]
  readonly writes: SeamWrite[]
  readonly projections: number
  readonly memberLabel: string | undefined
  readonly memberLifecycle: string | undefined
  readonly bindingKind: string | undefined
  readonly opPhase: string | undefined
  readonly ledgerEntryKeys: string[]
  readonly distinctChildren: number
}
{
  const world = await createP6T1World('p6t1x-s1')
  try {
    const { result, error } = await runActivate(world, makeRequest())
    const writes = world.writesSinceSeed()
    const instanceId = result?.kind === 'activated' ? result.instanceId : ''
    const childSessionId = result?.kind === 'activated' ? result.childSessionId : ''
    const member = instanceId !== ''
      ? world.domain.repositories.memberInstances.get(ROOT, instanceId)
      : undefined
    const binding = childSessionId !== ''
      ? world.domain.repositories.sessionBindings.get(childSessionId)
      : undefined
    const op =
      result?.kind === 'activated'
        ? world.domain.repositories.operations.get(result.operationId)
        : undefined
    s1 = {
      result,
      error,
      tables: writes.map((w) => w.table),
      writes,
      projections: world.projections.length,
      memberLabel: member?.label,
      memberLifecycle: member?.lifecycle,
      bindingKind: binding?.kind,
      opPhase: op?.phase,
      ledgerEntryKeys: writes
        .filter((w) => w.table === 'ledger' && /^\d+$/.test(w.key))
        .map((w) => w.key),
      distinctChildren: world.childFactory.distinctChildren,
    }
  } finally {
    await destroyP6T1World(world)
  }
}

describe('P6-T1 S1: leader-explicit happy path (full admission/provisioning order)', () => {
  it('activates with the closed activated result (identity, frozen fields, gates)', () => {
    expect(s1.error).toBe(undefined)
    const result = s1.result
    expect(result === undefined).toBe(false)
    if (result?.kind !== 'activated') throw new Error(`S1: not activated: ${String(result)}`)
    const identity = activationOperationIdentity(ROOT, 'leader-explicit', 'tok-p6t1-default')
    expect(result.source).toBe('leader-explicit')
    expect(result.requestToken).toBe('tok-p6t1-default')
    expect(result.templateId).toBe('worker')
    expect(result.instanceId).toBe(identity.instanceId)
    expect(result.operationId).toBe(identity.operationId)
    expect(/^inst-[a-z0-9]{12}$/.test(result.instanceId)).toBe(true)
    expect(result.childSessionId).toBe(`session-child-p6t1-${identity.instanceId.slice(5)}`)
    expect(result.replayed).toBe(false)
    expect(result.contextPolicy).toBe('persistent')
    expect(result.workspace).toBe(P6T1_FIXTURE.defaultWorkspace)
    expect(result.compatibilityStatus).toBe('OPEN')
    expect(result.policyStateId).toBe('default')
    expect(result.ledgerSequence).toBeGreaterThan(0)
    expect(result.admission.admitted).toBe(true)
    expect(result.admission.code).toBe('ADMISSION_OPEN')
    expect(result.projection.published).toBe(true)
    expect(result.member.label).toBe('p6t1-member')
    expect(result.member.lifecycle).toBe('CREATED')
  })

  it('persists the durable write sequence: compatibility → team_sessions (probe) → operations → operations → member → binding → (ledger) → team_sessions → operations', () => {
    // P8-S4A: step 6 now consults the SINGLE compatibility authority, whose
    // first-ever evaluation re-probes inline (DevPlan §20.1 trigger 5) — the
    // probe's compatibility row + generation-stamp writes precede the first
    // activation write. The activation sequence after the probe is unchanged.
    const tables = s1.tables.filter((t) => t !== 'ledger')
    expect(tables).toEqual([
      'compatibility',
      'team_sessions',
      'operations',
      'operations',
      'member_instances',
      'session_bindings',
      'team_sessions',
      'operations',
    ])
    // The ledger writes (counter + the committed fact) and the G8-S1
    // generation-stamp write sit strictly between the binding write and the
    // terminal operations write.
    const bindingIdx = s1.tables.lastIndexOf('session_bindings')
    const lastOpsIdx = s1.tables.lastIndexOf('operations')
    const ledgerIdxs = s1.tables
      .map((t, i) => (t === 'ledger' ? i : -1))
      .filter((i) => i >= 0)
    expect(ledgerIdxs.length).toBeGreaterThan(0)
    for (const i of ledgerIdxs) {
      expect(i > bindingIdx).toBe(true)
      expect(i < lastOpsIdx).toBe(true)
    }
    // Exactly one committed ledger fact for the activation.
    expect(s1.ledgerEntryKeys.length).toBe(1)
  })

  it('writes the probe stamp + the G8-S1 stamp to team_sessions and exactly ONE compatibility row (P8-S4A)', () => {
    // P8-S4A: the single compatibility authority's first-ever evaluation
    // re-probes inline (DevPlan §20.1 trigger 5), so the happy path now
    // writes the probe's compatibility row + generation stamp BEFORE the
    // activation order, then the G8-S1 stamp. Two team_sessions stamp
    // writes + exactly one compatibility write; still NOTHING to overrides.
    const stampWrites = s1.tables.filter((t) => t === 'team_sessions')
    expect(stampWrites.length).toBe(2)
    const compatWrites = s1.tables.filter((t) => t === 'compatibility')
    expect(compatWrites.length).toBe(1)
    for (const t of s1.tables) {
      expect(t === 'overrides').toBe(false)
    }
  })

  it('leaves the durable team state: one member record + one team-member binding + one COMMITTED operation', () => {
    expect(s1.memberLabel).toBe('p6t1-member')
    expect(s1.memberLifecycle).toBe('CREATED')
    expect(s1.bindingKind).toBe('team-member')
    expect(s1.opPhase).toBe(OPERATION_PHASES.COMMITTED)
    expect(s1.distinctChildren).toBe(1)
  })

  it('publishes exactly one projection event for the activation', () => {
    expect(s1.projections).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// S2 — human-ui funnel (+ the closed-grammar rejects)
// ---------------------------------------------------------------------------
let s2: {
  readonly humanOk: { result: ActivationResult | undefined; error: unknown }
  readonly humanWithDelegation: { result: ActivationResult | undefined; error: unknown }
  readonly writesAfterReject: number
}
{
  const world = await createP6T1World('p6t1x-s2')
  try {
    const humanOk = await runActivate(
      world,
      makeRequest({
        source: 'human-ui',
        callerId: 'human-principal-p6t1',
        requestToken: 'tok-p6t1-human',
      }),
    )
    const writesBefore = world.seam.writeCount
    const humanWithDelegation = await runActivate(
      world,
      makeRequest({
        source: 'human-ui',
        requestToken: 'tok-p6t1-human-deleg',
        templateId: undefined,
        delegation: { templateId: 'worker' },
      }),
    )
    s2 = {
      humanOk,
      humanWithDelegation,
      writesAfterReject: world.seam.writeCount - writesBefore,
    }
  } finally {
    await destroyP6T1World(world)
  }
}

describe('P6-T1 S2: the human-ui funnel goes through the SAME provider', () => {
  it('a human-ui explicit activation succeeds (no agent-authority requirement)', () => {
    expect(s2.humanOk.error).toBe(undefined)
    const result = s2.humanOk.result
    if (result?.kind !== 'activated') {
      throw new Error(`S2: human-ui not activated: ${String(result)}`)
    }
    expect(result.source).toBe('human-ui')
    expect(/^inst-[a-z0-9]{12}$/.test(result.instanceId)).toBe(true)
    expect(result.replayed).toBe(false)
  })

  it('a human-ui request with delegation addressing fails the closed grammar with ZERO durable writes', () => {
    assertActivationCode(s2.humanWithDelegation.error, ACTIVATION_ERROR_CODES.REQUEST_MALFORMED)
    expect(s2.humanWithDelegation.result).toBe(undefined)
    expect(s2.writesAfterReject).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// S3 — idempotent same-token replay (zero durable writes, projection re-published)
// ---------------------------------------------------------------------------
let s3: {
  readonly first: ActivationResult | undefined
  readonly second: ActivationResult | undefined
  readonly error: unknown
  readonly newWritesOnReplay: number
  readonly projections: number
  readonly memberCount: number
}
{
  const world = await createP6T1World('p6t1x-s3')
  try {
    const request = makeRequest()
    const firstRun = await runActivate(world, request)
    const writesBeforeReplay = world.seam.writeCount
    const secondRun = await runActivate(world, request)
    s3 = {
      first: firstRun.result,
      second: secondRun.result,
      error: firstRun.error ?? secondRun.error,
      newWritesOnReplay: world.seam.writeCount - writesBeforeReplay,
      projections: world.projections.length,
      memberCount: world.domain.repositories.memberInstances.list(ROOT).length,
    }
  } finally {
    await destroyP6T1World(world)
  }
}

describe('P6-T1 S3: the same logical operation (same token) converges idempotently', () => {
  it('replays the durable result: activated + replayed, same instance/child/operation', () => {
    expect(s3.error).toBe(undefined)
    const first = s3.first
    const second = s3.second
    if (first?.kind !== 'activated' || second?.kind !== 'activated') {
      throw new Error(`S3: expected two activated results: ${String(first)} / ${String(second)}`)
    }
    expect(first.replayed).toBe(false)
    expect(second.replayed).toBe(true)
    expect(second.instanceId).toBe(first.instanceId)
    expect(second.childSessionId).toBe(first.childSessionId)
    expect(second.operationId).toBe(first.operationId)
  })

  it('performs ZERO durable writes on the replay and keeps exactly one member', () => {
    expect(s3.newWritesOnReplay).toBe(0)
    expect(s3.memberCount).toBe(1)
  })

  it('re-publishes the projection (the replay is a re-application of the terminal fact)', () => {
    expect(s3.projections).toBe(2)
  })
})

// ---------------------------------------------------------------------------
// S4 — same token, different template: the loud idempotency conflict
// ---------------------------------------------------------------------------
let s4: {
  readonly first: ActivationResult | undefined
  readonly conflict: { result: ActivationResult | undefined; error: unknown }
  readonly newWrites: number
}
{
  const world = await createP6T1World('p6t1x-s4')
  try {
    const token = 'tok-p6t1-conflict'
    const first = await runActivate(world, makeRequest({ requestToken: token }))
    const writesBefore = world.seam.writeCount
    const conflict = await runActivate(
      world,
      makeRequest({ requestToken: token, templateId: String(P6T1_FIXTURE.scoutTemplateId) }),
    )
    s4 = {
      first: first.result,
      conflict,
      newWrites: world.seam.writeCount - writesBefore,
    }
  } finally {
    await destroyP6T1World(world)
  }
}

describe('P6-T1 S4: a token replay under a DIFFERENT template fails loudly (admit-once)', () => {
  it('raises IDEMPOTENCY_CONFLICT with the admitted + requested templates', () => {
    expect(s4.first?.kind).toBe('activated')
    const code = assertActivationCode(s4.conflict.error, ACTIVATION_ERROR_CODES.IDEMPOTENCY_CONFLICT)
    expect(code.details?.['storedTemplateId']).toBe('worker')
    expect(code.details?.['requestedTemplateId']).toBe('scout')
  })

  it('performs ZERO durable writes on the conflict (the admitted row is untouched)', () => {
    expect(s4.newWrites).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// S5 — the negative matrix (every reject carries zero durable writes)
// ---------------------------------------------------------------------------
const s5: {
  teamSessionNotFound: unknown
  blueprintUnresolved: unknown
  blueprintHashMismatch: unknown
  templateNotFound: unknown
  callerAuthorityDenied: unknown
  compatibilityFatal: unknown
  compatibilityWarning: unknown
  quotaTeamMaxInstances: unknown
  quotaTeamMaxConcurrent: unknown
  quotaMemberMaxInstances: unknown
  invalidLabel: unknown
  invalidWorkspace: unknown
  invalidGroupId: unknown
  malformedMissingTemplate: unknown
  malformedBothAddressing: unknown
  malformedDelegationBoth: unknown
  malformedDelegationNeither: unknown
  malformedEmptyToken: unknown
  malformedBadRoot: unknown
  writesTeamSession: number
  writesTemplate: number
  writesCompat: number
  writesQuotaTeam: number
  writesFields: number
  writesMalformed: number
} = {
  teamSessionNotFound: undefined,
  blueprintUnresolved: undefined,
  blueprintHashMismatch: undefined,
  templateNotFound: undefined,
  callerAuthorityDenied: undefined,
  compatibilityFatal: undefined,
  compatibilityWarning: undefined,
  quotaTeamMaxInstances: undefined,
  quotaTeamMaxConcurrent: undefined,
  quotaMemberMaxInstances: undefined,
  invalidLabel: undefined,
  invalidWorkspace: undefined,
  invalidGroupId: undefined,
  malformedMissingTemplate: undefined,
  malformedBothAddressing: undefined,
  malformedDelegationBoth: undefined,
  malformedDelegationNeither: undefined,
  malformedEmptyToken: undefined,
  malformedBadRoot: undefined,
  writesTeamSession: -1,
  writesTemplate: -1,
  writesCompat: -1,
  writesQuotaTeam: -1,
  writesFields: -1,
  writesMalformed: -1,
}
{
  // 5a: TEAM_SESSION_NOT_FOUND
  const worldA = await createP6T1World('p6t1x-s5a')
  try {
    const before = worldA.seam.writeCount
    const run = await runActivate(
      worldA,
      makeRequest({ rootSessionId: 'session-root-unknown-p6t1', requestToken: 'tok-p6t1-s5a' }),
    )
    s5.teamSessionNotFound = run.error
    s5.writesTeamSession = worldA.seam.writeCount - before
  } finally {
    await destroyP6T1World(worldA)
  }
  // 5b: BLUEPRINT_UNRESOLVED (bound revision not in the catalog)
  const blueprint = parseFixtureBlueprint()
  const worldB = await createP6T1World('p6t1x-s5b', {
    blueprintRef: {
      blueprintId: String(blueprint.blueprintId),
      revision: '9',
      contentHash: String(blueprint.contentHash),
    },
  })
  try {
    const run = await runActivate(worldB, makeRequest({ requestToken: 'tok-p6t1-s5b' }))
    s5.blueprintUnresolved = run.error
  } finally {
    await destroyP6T1World(worldB)
  }
  // 5c: BLUEPRINT_HASH_MISMATCH (bound content hash differs from the catalog)
  const worldC = await createP6T1World('p6t1x-s5c', {
    blueprintRef: {
      blueprintId: String(blueprint.blueprintId),
      revision: String(blueprint.revision),
      contentHash: 'sha256:deadbeef',
    },
  })
  try {
    const run = await runActivate(worldC, makeRequest({ requestToken: 'tok-p6t1-s5c' }))
    s5.blueprintHashMismatch = run.error
  } finally {
    await destroyP6T1World(worldC)
  }
  // 5d: TEMPLATE_NOT_FOUND + 5e: CALLER_AUTHORITY_DENIED
  const worldD = await createP6T1World('p6t1x-s5d')
  try {
    const before = worldD.seam.writeCount
    const templateNotFound = await runActivate(
      worldD,
      makeRequest({ templateId: 'ghost', requestToken: 'tok-p6t1-s5d' }),
    )
    const callerDenied = await runActivate(
      worldD,
      makeRequest({ callerId: 'member-not-leader', requestToken: 'tok-p6t1-s5e' }),
    )
    s5.templateNotFound = templateNotFound.error
    s5.callerAuthorityDenied = callerDenied.error
    s5.writesTemplate = worldD.seam.writeCount - before
  } finally {
    await destroyP6T1World(worldD)
  }
  // 5f: compatibility FATAL (required skill unavailable)
  const fatalWorld = await createP6T1World('p6t1x-s5f', {
    environmentFacts: async () => [
      { domain: 'tool' as const, subject: 'web', available: true, generation: 1 },
      { domain: 'skill' as const, subject: 'base', available: false, generation: 1 },
    ],
  })
  try {
    const before = fatalWorld.seam.writeCount
    const fatal = await runActivate(fatalWorld, makeRequest({ requestToken: 'tok-p6t1-s5f' }))
    s5.compatibilityFatal = fatal.error
    s5.writesCompat = fatalWorld.seam.writeCount - before
  } finally {
    await destroyP6T1World(fatalWorld)
  }
  // 5g: compatibility WARNING (optional tool unavailable, no ack)
  const warningWorld = await createP6T1World('p6t1x-s5g', {
    environmentFacts: async () => [
      { domain: 'tool' as const, subject: 'web', available: false, generation: 1 },
      { domain: 'skill' as const, subject: 'base', available: true, generation: 1 },
    ],
  })
  try {
    const before = warningWorld.seam.writeCount
    const warning = await runActivate(warningWorld, makeRequest({ requestToken: 'tok-p6t1-s5g' }))
    s5.compatibilityWarning = warning.error
    // P8-S4A: the single compatibility authority re-probes inline on the
    // first-ever evaluation (DevPlan §20.1 trigger 5) — the probe's
    // compatibility row + generation stamp are written before the BLOCKED
    // verdict is surfaced (was 0 under the read-only preflight).
    expect(warningWorld.seam.writeCount - before).toBe(2)
  } finally {
    await destroyP6T1World(warningWorld)
  }
  // 5h: quota TEAM maxInstances (4 seeded = max 4)
  const quotaWorld = await createP6T1World('p6t1x-s5h', {
    seedMembers: [
      { instanceId: parseInstanceId('inst-p6t1seed0001'), templateId: parseTemplateId('worker'), label: 'seed-1' },
      { instanceId: parseInstanceId('inst-p6t1seed0002'), templateId: parseTemplateId('worker'), label: 'seed-2' },
      { instanceId: parseInstanceId('inst-p6t1seed0003'), templateId: parseTemplateId('scout'), label: 'seed-3' },
      { instanceId: parseInstanceId('inst-p6t1seed0004'), templateId: parseTemplateId('scout'), label: 'seed-4' },
    ],
  })
  try {
    const before = quotaWorld.seam.writeCount
    const teamMax = await runActivate(quotaWorld, makeRequest({ requestToken: 'tok-p6t1-s5h' }))
    s5.quotaTeamMaxInstances = teamMax.error
    s5.writesQuotaTeam = quotaWorld.seam.writeCount - before
  } finally {
    await destroyP6T1World(quotaWorld)
  }
  // 5i: quota TEAM maxConcurrent (3 active seeded = max 3)
  const concurrentWorld = await createP6T1World('p6t1x-s5i', {
    seedMembers: [
      { instanceId: parseInstanceId('inst-p6t1seed0101'), templateId: parseTemplateId('worker'), label: 'cc-1' },
      { instanceId: parseInstanceId('inst-p6t1seed0102'), templateId: parseTemplateId('scout'), label: 'cc-2' },
      { instanceId: parseInstanceId('inst-p6t1seed0103'), templateId: parseTemplateId('scout'), label: 'cc-3' },
    ],
  })
  try {
    const concurrent = await runActivate(concurrentWorld, makeRequest({ requestToken: 'tok-p6t1-s5i' }))
    s5.quotaTeamMaxConcurrent = concurrent.error
  } finally {
    await destroyP6T1World(concurrentWorld)
  }
  // 5j: quota MEMBER maxInstances (2 workers seeded = max 2)
  const memberQuotaWorld = await createP6T1World('p6t1x-s5j', {
    seedMembers: [
      { instanceId: parseInstanceId('inst-p6t1seed0201'), templateId: parseTemplateId('worker'), label: 'mq-1' },
      { instanceId: parseInstanceId('inst-p6t1seed0202'), templateId: parseTemplateId('worker'), label: 'mq-2' },
    ],
  })
  try {
    const memberQuota = await runActivate(memberQuotaWorld, makeRequest({ requestToken: 'tok-p6t1-s5j' }))
    s5.quotaMemberMaxInstances = memberQuota.error
  } finally {
    await destroyP6T1World(memberQuotaWorld)
  }
  // 5k/5l/5m: invalid label / workspace / groupId
  const worldK = await createP6T1World('p6t1x-s5k')
  try {
    const before = worldK.seam.writeCount
    const badLabel = await runActivate(
      worldK,
      makeRequest({ label: 'x'.repeat(129), requestToken: 'tok-p6t1-s5k' }),
    )
    const badWorkspace = await runActivate(
      worldK,
      makeRequest({ workspace: 'C:/bad\u0000workspace', requestToken: 'tok-p6t1-s5l' }),
    )
    const badGroup = await runActivate(
      worldK,
      makeRequest({ groupId: 'g'.repeat(129), requestToken: 'tok-p6t1-s5m' }),
    )
    s5.invalidLabel = badLabel.error
    s5.invalidWorkspace = badWorkspace.error
    s5.invalidGroupId = badGroup.error
    s5.writesFields = worldK.seam.writeCount - before
  } finally {
    await destroyP6T1World(worldK)
  }
  // 5n: closed-grammar (REQUEST_MALFORMED) variants
  const worldN = await createP6T1World('p6t1x-s5n')
  try {
    const before = worldN.seam.writeCount
    const missingTemplate = await runActivate(
      worldN,
      makeRequest({ templateId: undefined, requestToken: 'tok-p6t1-s5n1' }),
    )
    const bothAddressing = await runActivate(
      worldN,
      makeRequest({
        templateId: 'worker',
        delegation: { templateId: 'worker' },
        requestToken: 'tok-p6t1-s5n2',
      }),
    )
    const delegateBoth = await runActivate(
      worldN,
      {
        rootSessionId: ROOT,
        source: 'leader-delegate',
        delegation: { explicitInstanceId: 'inst-p6t1seed0001', templateId: 'worker' },
        label: 'both',
        requestToken: 'tok-p6t1-s5n3',
        callerId: String(LEADER_INSTANCE_ID),
      },
    )
    const delegateNeither = await runActivate(
      worldN,
      {
        rootSessionId: ROOT,
        source: 'leader-delegate',
        delegation: {},
        label: 'neither',
        requestToken: 'tok-p6t1-s5n4',
        callerId: String(LEADER_INSTANCE_ID),
      },
    )
    const emptyToken = await runActivate(worldN, makeRequest({ requestToken: '' }))
    const badRoot = await runActivate(
      worldN,
      makeRequest({ rootSessionId: 'not a root id', requestToken: 'tok-p6t1-s5n6' }),
    )
    s5.malformedMissingTemplate = missingTemplate.error
    s5.malformedBothAddressing = bothAddressing.error
    s5.malformedDelegationBoth = delegateBoth.error
    s5.malformedDelegationNeither = delegateNeither.error
    s5.malformedEmptyToken = emptyToken.error
    s5.malformedBadRoot = badRoot.error
    s5.writesMalformed = worldN.seam.writeCount - before
  } finally {
    await destroyP6T1World(worldN)
  }
}

describe('P6-T1 S5: the negative matrix (every reject carries ZERO durable writes)', () => {
  it('step 1: an unknown root is TEAM_SESSION_NOT_FOUND (zero writes)', () => {
    assertActivationCode(s5.teamSessionNotFound, ACTIVATION_ERROR_CODES.TEAM_SESSION_NOT_FOUND)
    expect(s5.writesTeamSession).toBe(0)
  })
  it('step 2: a bound revision missing from the catalog is BLUEPRINT_UNRESOLVED', () => {
    assertActivationCode(s5.blueprintUnresolved, ACTIVATION_ERROR_CODES.BLUEPRINT_UNRESOLVED)
  })
  it('step 2: a bound content hash different from the catalog is BLUEPRINT_HASH_MISMATCH', () => {
    assertActivationCode(s5.blueprintHashMismatch, ACTIVATION_ERROR_CODES.BLUEPRINT_HASH_MISMATCH)
  })
  it('step 3: a template the blueprint does not declare is TEMPLATE_NOT_FOUND (zero writes)', () => {
    assertActivationCode(s5.templateNotFound, ACTIVATION_ERROR_CODES.TEMPLATE_NOT_FOUND)
    expect(s5.writesTemplate).toBe(0)
  })
  it('step 4: a non-leader caller on a leader source is CALLER_AUTHORITY_DENIED', () => {
    assertActivationCode(s5.callerAuthorityDenied, ACTIVATION_ERROR_CODES.CALLER_AUTHORITY_DENIED)
  })
  it('step 6: an unavailable REQUIRED capability is COMPATIBILITY_BLOCKED_FATAL (probe writes only)', () => {
    // P8-S4A: the single compatibility authority re-probes inline on the
    // first-ever evaluation (DevPlan §20.1 trigger 5) — the probe's
    // compatibility row + generation stamp are written before the BLOCKED
    // verdict is surfaced (was 0 under the read-only preflight).
    assertActivationCode(s5.compatibilityFatal, ACTIVATION_ERROR_CODES.COMPATIBILITY_BLOCKED_FATAL)
    expect(s5.writesCompat).toBe(2)
  })
  it('step 6: an unavailable OPTIONAL capability without an ack is COMPATIBILITY_BLOCKED_WARNING', () => {
    assertActivationCode(s5.compatibilityWarning, ACTIVATION_ERROR_CODES.COMPATIBILITY_BLOCKED_WARNING)
  })
  it('step 7: the team instance quota is QUOTA_TEAM_MAX_INSTANCES (probe writes only)', () => {
    // P8-S4A: step 6 (the single compatibility authority) runs before step 7
    // and re-probes inline on the first-ever evaluation — the 2 probe writes
    // land before the quota rejection (was 0 under the read-only preflight).
    assertActivationCode(s5.quotaTeamMaxInstances, ACTIVATION_ERROR_CODES.QUOTA_TEAM_MAX_INSTANCES)
    expect(s5.writesQuotaTeam).toBe(2)
  })
  it('step 7: the team concurrent quota is QUOTA_TEAM_MAX_CONCURRENT', () => {
    assertActivationCode(s5.quotaTeamMaxConcurrent, ACTIVATION_ERROR_CODES.QUOTA_TEAM_MAX_CONCURRENT)
  })
  it('step 7: the per-template quota is QUOTA_MEMBER_MAX_INSTANCES', () => {
    assertActivationCode(s5.quotaMemberMaxInstances, ACTIVATION_ERROR_CODES.QUOTA_MEMBER_MAX_INSTANCES)
  })
  it('step 10: structurally invalid label / workspace / groupId fields fail closed (probe writes only)', () => {
    // P8-S4A: the FIRST of the three attempts triggers the inline re-probe
    // (DevPlan §20.1 trigger 5) — 2 probe writes before the field rejection;
    // the second/third attempts find the fresh durable state and add none
    // (was 0 under the read-only preflight).
    assertActivationCode(s5.invalidLabel, ACTIVATION_ERROR_CODES.INVALID_LABEL_FIELD)
    assertActivationCode(s5.invalidWorkspace, ACTIVATION_ERROR_CODES.INVALID_WORKSPACE_FIELD)
    assertActivationCode(s5.invalidGroupId, ACTIVATION_ERROR_CODES.INVALID_GROUP_ID_FIELD)
    expect(s5.writesFields).toBe(2)
  })
  it('step 0: the closed grammar rejects every malformed shape (zero writes)', () => {
    assertActivationCode(s5.malformedMissingTemplate, ACTIVATION_ERROR_CODES.REQUEST_MALFORMED)
    assertActivationCode(s5.malformedBothAddressing, ACTIVATION_ERROR_CODES.REQUEST_MALFORMED)
    assertActivationCode(s5.malformedDelegationBoth, ACTIVATION_ERROR_CODES.REQUEST_MALFORMED)
    assertActivationCode(s5.malformedDelegationNeither, ACTIVATION_ERROR_CODES.REQUEST_MALFORMED)
    assertActivationCode(s5.malformedEmptyToken, ACTIVATION_ERROR_CODES.REQUEST_MALFORMED)
    assertActivationCode(s5.malformedBadRoot, ACTIVATION_ERROR_CODES.REQUEST_MALFORMED)
    expect(s5.writesMalformed).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// S5b — the ack-able WARNING admits (DEGRADED_ACKNOWLEDGED)
// ---------------------------------------------------------------------------
let s5b: {
  readonly result: ActivationResult | undefined
  readonly error: unknown
}
{
  const facts = [
    { domain: 'tool' as const, subject: 'web', available: false, generation: 1 },
    { domain: 'skill' as const, subject: 'base', available: true, generation: 1 },
  ]
  const world = await createP6T1World('p6t1x-s5ack', {
    environmentFacts: async () => facts,
  })
  try {
    const blueprint = parseFixtureBlueprint()
    const warningResult = evaluateCompatibility({
      requirements: toActivationRequirements(blueprint),
      environmentFacts: facts,
    })
    const warning = warningResult.requirements.find((r) => r.outcome === 'WARNING')
    if (warning === undefined) {
      throw new Error('S5b: no WARNING requirement in the fixture evaluation')
    }
    const { result, error } = await runActivate(
      world,
      makeRequest({
        requestToken: 'tok-p6t1-ack',
        acknowledgements: [
          {
            requirementId: warning.requirementId,
            mismatchFingerprint: warning.mismatchFingerprint ?? '',
            environmentFingerprint: warningResult.environmentFingerprint,
            acknowledgedBy: 'human-ack-p6t1',
            acknowledgedAt: '2026-08-30T09:00:00Z',
          },
        ],
      }),
    )
    s5b = { result, error }
  } finally {
    await destroyP6T1World(world)
  }
}

describe('P6-T1 S5b: an acknowledged WARNING admits (the degradation is reported, not silent)', () => {
  it('activates with compatibilityStatus DEGRADED_ACKNOWLEDGED', () => {
    expect(s5b.error).toBe(undefined)
    const result = s5b.result
    if (result?.kind !== 'activated') throw new Error(`S5b: not activated: ${String(result)}`)
    expect(result.compatibilityStatus).toBe('DEGRADED_ACKNOWLEDGED')
    expect(result.replayed).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// S6 — invariant 26: EVERY provider-created member has a COMMITTED operation
// ---------------------------------------------------------------------------
let s6: {
  readonly members: { instanceId: string; templateId: string }[]
  readonly ops: { instanceId: string; phase: string }[]
  readonly allCommitted: boolean
  readonly everyMemberHasOp: boolean
  readonly everyOpHasMember: boolean
}
{
  const world = await createP6T1World('p6t1x-s6')
  try {
    const runs = [
      await runActivate(world, makeRequest({ requestToken: 'tok-p6t1-inv-a' })),
      await runActivate(
        world,
        makeRequest({
          templateId: String(P6T1_FIXTURE.scoutTemplateId),
          requestToken: 'tok-p6t1-inv-b',
        }),
      ),
      await runActivate(
        world,
        {
          rootSessionId: ROOT,
          source: 'leader-delegate',
          delegation: { templateId: 'scout' },
          label: 'delegated',
          requestToken: 'tok-p6t1-inv-c',
          callerId: String(LEADER_INSTANCE_ID),
        },
      ),
    ]
    for (const run of runs) {
      if (run.error !== undefined) throw new Error(`S6 setup failed: ${String(run.error)}`)
    }
    const members = world.domain.repositories.memberInstances.list(ROOT).map((m) => ({
      instanceId: String(m.instanceId),
      templateId: String(m.templateId),
    }))
    const ops = world.domain
      .repositories.operations.list()
      .map((op) => ({
        instanceId: String(op.intent.payload['instanceId']),
        phase: op.phase,
      }))
      .filter((op) => op.instanceId !== '')
    s6 = {
      members,
      ops,
      allCommitted: ops.every((op) => op.phase === OPERATION_PHASES.COMMITTED),
      everyMemberHasOp: members.every((m) =>
        ops.some(
          (op) => op.instanceId === m.instanceId && op.phase === OPERATION_PHASES.COMMITTED,
        ),
      ),
      everyOpHasMember: ops.every((op) => members.some((m) => m.instanceId === op.instanceId)),
    }
  } finally {
    await destroyP6T1World(world)
  }
}

describe("P6-T1 S6: invariant 26 — no new Member exists without the provider's committed operation", () => {
  it('created three members across the three sources, each with a matching COMMITTED operation', () => {
    expect(s6.members.length).toBe(3)
    expect(s6.ops.length).toBe(3)
    expect(s6.allCommitted).toBe(true)
    expect(s6.everyMemberHasOp).toBe(true)
    expect(s6.everyOpHasMember).toBe(true)
  })
})
