/**
 * RC2-A6 (0.1.5-rc.2 compatibility repair) — leader last-mile guard
 * liveness: A6-T1..T4.
 *
 * The bug (plan §2.1, confirmed root cause): `guardOperation` folded the
 * Leader into the ordinary-member liveness check. The Leader is a
 * schema-v2 special record (invariant 15: the v2 LeaderInstance record
 * carries NO `lifecycle` and no `childSessionId` — a lifecycle key is
 * contract-rejected), so for `target = LEADER_INSTANCE_ID` the old
 * compound check read `String(member.lifecycle) === 'undefined'` — never
 * in `GUARD_LIVE_LIFECYCLES` — and the leader's ask→approve operations
 * were PERMANENTLY `target-stale`.
 *
 * The invariant implemented (plan §2.2):
 * - leader live   <=> TeamSession(root) exists (no member-row check);
 * - member live   <=> TeamSession(root) exists AND the member row exists
 *                     AND lifecycle ∈ {CREATED, RUNNING, SETTLED}.
 *
 * World-shape note (verified while writing, 2026-09-17):
 *
 * The STOCK P6T4 world seeds the leader row in the P6-era v1-STYLE —
 * `p6t4Seed('leader')` (p6t4-helpers.ts) carries
 * `childSessionId: 'session-child-p6t4-leader'` AND `lifecycle:
 * 'RUNNING'`, and the contracts union factory
 * (`isLeaderInstanceRecordInput`, packages/contracts/src/dto/
 * member-instance-record.ts) routes to the v2 LeaderInstance mint ONLY
 * when BOTH keys are ABSENT — so the stock world's leader row is stored
 * as a v1 member record (`schemaVersion: 1`, lifecycle 'RUNNING'). That
 * v1 style is a legacy test convenience still used by the p6t4-* suites;
 * p6t4-helpers.ts is deliberately NOT modified here.
 *
 * Production mints the v2 shape: the P8-S2 root-binding mint writes the
 * honest LeaderInstance record (schemaVersion 2, no lifecycle, no
 * childSessionId — invariant 15), and THAT is the row the A6 bug hits.
 * On the stock v1 row the bug is MASKED (lifecycle 'RUNNING' is in
 * GUARD_LIVE_LIFECYCLES), so a test built on the stock row would not
 * discriminate. This suite therefore REPLACES the world's leader row
 * with the production v2 shape through the world's own PUBLIC repository
 * API only (`memberInstances.delete` + `put` with an honest
 * LeaderInstanceRecordInput — no storage-level writes, no bypassed
 * validation). The ordinary member rows are used untouched.
 *
 * RED→GREEN proof (evidence:
 * dev/agent-workflow/evidence/rc2-repair/a6/): the EXACT A6-T1 sequence
 * on the UNFIXED base 3b4912a returned
 * `{ allowed: false, reason: 'target-stale' }` for the v2 leader row;
 * after the liveness split it returns `allowed: true`.
 *
 * Test pattern of this repo: every async scenario runs at MODULE level
 * (top-level await, the p6t4/f9 pattern) and captures its results; the
 * `it` bodies are pure synchronous assertions.
 *
 * Matchers: toBe/toEqual/toBeGreaterThan (+.not) only.
 *
 * @module @dsh-agent-team/runtime/test/control-guard-leader
 */

import { describe, expect, it } from 'vitest'
import {
  LEADER_INSTANCE_ID,
  parseInstanceId,
  parseRootSessionId,
  parseTemplateId,
} from '../../contracts/src/index.js'
import type { MemberInstanceRecordDto } from '../../contracts/src/index.js'
import {
  CONTROL_DECISION_VALUES,
  CONTROL_GUARD_BLOCK_REASONS,
  CONTROL_REQUEST_KINDS,
} from '../control/index.js'
import type {
  ControlDecisionRecord,
  ControlGuardVerdict,
  ControlRequestRecord,
  ControlService,
} from '../control/index.js'
import type { P6T1World } from './p6t1-helpers.js'
import {
  P6T4_ROOT,
  P6T4_NOW,
  P6T4_SEEDS,
  createP6T4Service,
  createP6T4World,
  deleteMember,
  destroyP6T1World,
  flipLifecycle,
  leaderCaller,
  makeScope,
  memberCaller,
} from './p6t4-helpers.js'

const LEADER_ID = String(LEADER_INSTANCE_ID)
const WORKER_ID = String(P6T4_SEEDS.worker.instanceId)

// --- world construction: the production v2 leader row -------------------------------

/**
 * Replace the world's P6-era v1-style leader seed with the honest v2
 * LeaderInstance record (the production P8-S2 root-binding mint shape —
 * no `lifecycle`, no `childSessionId`). Public repository API only:
 * `delete` + `put` with an honest LeaderInstanceRecordInput (the
 * contracts union factory mints `schemaVersion: 2` exactly for this
 * input shape).
 *
 * @param world - the open P6T4 world.
 */
async function installV2LeaderRow(world: P6T1World): Promise<void> {
  const repository = world.domain.repositories.memberInstances
  const parsed = parseInstanceId(LEADER_ID)
  await repository.delete(P6T4_ROOT, String(parsed))
  await repository.put({
    rootSessionId: parseRootSessionId(P6T4_ROOT),
    instanceId: parsed,
    templateId: parseTemplateId('leader'),
    label: 'leader',
    createdAt: P6T4_NOW,
    activityVersion: 1,
  })
}

/** The stored-shape evidence for the leader row (fresh durable read). */
function leaderRowShape(world: P6T1World): {
  readonly present: boolean
  readonly schemaVersion: number
  readonly hasLifecycleKey: boolean
  readonly hasChildSessionIdKey: boolean
} {
  const record: MemberInstanceRecordDto | undefined = world.domain.repositories.memberInstances.get(
    P6T4_ROOT,
    LEADER_ID,
  )
  if (record === undefined) {
    return { present: false, schemaVersion: -1, hasLifecycleKey: false, hasChildSessionIdKey: false }
  }
  return {
    present: true,
    schemaVersion: Number(record.schemaVersion),
    hasLifecycleKey: Object.prototype.hasOwnProperty.call(record, 'lifecycle'),
    hasChildSessionIdKey: Object.prototype.hasOwnProperty.call(record, 'childSessionId'),
  }
}

/**
 * One ordinary-member leg: request (the LEADER asks leader-approval of
 * the member's operation — the p6t4-stale pattern: a live member could
 * also request its own operation, but the leader requester keeps every
 * leg identical even when the member is ARCHIVED, where a stale member
 * caller cannot request), resolve allow (the leader — a valid resolver
 * for the leader-approval kind), then guard.
 *
 * @param service - the control service over the world.
 * @param correlation - the leg's fresh correlation (a new logical
 *   request per leg).
 * @returns the captured leg results.
 */
async function memberAllowAndGuard(
  service: ControlService,
  correlation: string,
): Promise<{
  readonly request: ControlRequestRecord
  readonly decision: ControlDecisionRecord
  readonly verdict: ControlGuardVerdict
}> {
  const scope = makeScope({ correlation })
  const request = await service.requestControl({
    rootSessionId: P6T4_ROOT,
    caller: leaderCaller(),
    kind: CONTROL_REQUEST_KINDS.LEADER_APPROVAL,
    targetInstanceId: WORKER_ID,
    actionName: scope.actionName,
    toolName: scope.toolName,
    correlation,
  })
  const decision = await service.resolveControl({
    rootSessionId: P6T4_ROOT,
    caller: leaderCaller(),
    requestId: request.requestId,
    decision: 'allow',
  })
  const verdict = await service.guardOperation(scope)
  return { request, decision, verdict }
}

// --- scenario T1: live leader (v2 row) + allow -> allowed ---------------------------
// THE RED→GREEN CORE: on the unfixed code this exact sequence returned
// target-stale (the v2 leader row has no lifecycle;
// GUARD_LIVE_LIFECYCLES.includes('undefined') === false).
let T1: {
  readonly rowShape: ReturnType<typeof leaderRowShape>
  readonly request: ControlRequestRecord
  readonly decision: ControlDecisionRecord
  readonly verdict: ControlGuardVerdict
  readonly consumptions: number
}
{
  const world = await createP6T4World('a6-ld-t1', ['leader', 'worker'])
  try {
    await installV2LeaderRow(world)
    const service = createP6T4Service(world)
    const scope = makeScope({ targetInstanceId: LEADER_ID, correlation: 'corr-a6-ld-t1' })
    const request = await service.requestControl({
      rootSessionId: P6T4_ROOT,
      caller: leaderCaller(),
      kind: CONTROL_REQUEST_KINDS.LEADER_APPROVAL,
      targetInstanceId: LEADER_ID,
      actionName: scope.actionName,
      toolName: scope.toolName,
      correlation: scope.correlation,
    })
    const decision = await service.resolveControl({
      rootSessionId: P6T4_ROOT,
      caller: leaderCaller(),
      requestId: request.requestId,
      decision: 'allow',
    })
    const verdict = await service.guardOperation(scope)
    const state = await service.listControlState(P6T4_ROOT)
    T1 = {
      rowShape: leaderRowShape(world),
      request,
      decision,
      verdict,
      consumptions: state.consumptions.length,
    }
  } finally {
    await destroyP6T1World(world)
  }
}

// --- scenario T2: leader row lingers, the TeamSession is gone -> target-stale -------
// Leader liveness is TeamSession existence: with the team row deleted
// the guard blocks the leader EVEN THOUGH the leader row still exists.
let T2: {
  readonly teamDeleted: boolean
  readonly leaderRowLingers: boolean
  readonly verdict: ControlGuardVerdict
}
{
  const world = await createP6T4World('a6-ld-t2', ['leader', 'worker'])
  try {
    await installV2LeaderRow(world)
    const service = createP6T4Service(world)
    const scope = makeScope({ targetInstanceId: LEADER_ID, correlation: 'corr-a6-ld-t2' })
    const request = await service.requestControl({
      rootSessionId: P6T4_ROOT,
      caller: leaderCaller(),
      kind: CONTROL_REQUEST_KINDS.LEADER_APPROVAL,
      targetInstanceId: LEADER_ID,
      actionName: scope.actionName,
      toolName: scope.toolName,
      correlation: scope.correlation,
    })
    await service.resolveControl({
      rootSessionId: P6T4_ROOT,
      caller: leaderCaller(),
      requestId: request.requestId,
      decision: 'allow',
    })

    // The team session vanishes while the leader row lingers.
    const teamDeleted = await world.domain.repositories.teamSessions.delete(P6T4_ROOT)
    const verdict = await service.guardOperation(scope)
    T2 = {
      teamDeleted,
      leaderRowLingers: world.domain.repositories.memberInstances.get(P6T4_ROOT, LEADER_ID) !== undefined,
      verdict,
    }
  } finally {
    await destroyP6T1World(world)
  }
}

// --- scenario T3: the ordinary-member matrix is UNCHANGED ---------------------------
// The member half of the liveness predicate is untouched: live
// lifecycles (CREATED / RUNNING / SETTLED) pass, ARCHIVED blocks, and a
// missing member row (team still exists) blocks — mirroring the matrix
// the p6t4-stale suite pins.
let T3: {
  readonly running: { readonly decision: ControlDecisionRecord; readonly verdict: ControlGuardVerdict }
  readonly archived: { readonly decision: ControlDecisionRecord; readonly verdict: ControlGuardVerdict }
  readonly settled: { readonly decision: ControlDecisionRecord; readonly verdict: ControlGuardVerdict }
  readonly created: { readonly decision: ControlDecisionRecord; readonly verdict: ControlGuardVerdict }
  readonly missing: { readonly decision: ControlDecisionRecord; readonly verdict: ControlGuardVerdict }
}
{
  const world = await createP6T4World('a6-ld-t3', ['leader', 'worker'])
  try {
    await installV2LeaderRow(world)
    const service = createP6T4Service(world)

    // Leg A: RUNNING (the seed's default lifecycle) + allow -> passes.
    const running = await memberAllowAndGuard(service, 'corr-a6-ld-t3-running')

    // Leg B: ARCHIVED + allow -> target-stale (suspended targets cannot
    // execute; request/resolve time tolerate ARCHIVED — p6t4-stale s4).
    await flipLifecycle(world, WORKER_ID, 'ARCHIVED')
    const archived = await memberAllowAndGuard(service, 'corr-a6-ld-t3-archived')

    // Leg C: SETTLED + allow -> passes (quiescent, not gone).
    await flipLifecycle(world, WORKER_ID, 'SETTLED')
    const settled = await memberAllowAndGuard(service, 'corr-a6-ld-t3-settled')

    // Leg D: CREATED + allow -> passes.
    await flipLifecycle(world, WORKER_ID, 'CREATED')
    const created = await memberAllowAndGuard(service, 'corr-a6-ld-t3-created')

    // Leg E: the member row vanishes (the team still exists) + a live
    // allow already recorded -> target-stale (liveness precedes request
    // state — the p6t4-stale s5 pattern, with the allow in place).
    await flipLifecycle(world, WORKER_ID, 'RUNNING')
    const missing = await memberAllowAndGuard(service, 'corr-a6-ld-t3-missing')
    await deleteMember(world, WORKER_ID)
    const missingVerdict = await service.guardOperation(
      makeScope({ correlation: 'corr-a6-ld-t3-missing' }),
    )

    T3 = {
      running: { decision: running.decision, verdict: running.verdict },
      archived: { decision: archived.decision, verdict: archived.verdict },
      settled: { decision: settled.decision, verdict: settled.verdict },
      created: { decision: created.decision, verdict: created.verdict },
      missing: { decision: missing.decision, verdict: missingVerdict },
    }
  } finally {
    await destroyP6T1World(world)
  }
}

// --- scenario T4: the one-shot allow is consumed EXACTLY ONCE, both paths -----------
// Leader path: the successful guard consumes the allow; a second
// identical guard -> allow-consumed (the f9-control-exactly-once
// pattern). Member path: the same sequence on a live member.
type T4LeaderLeg = {
  readonly request: ControlRequestRecord
  readonly first: ControlGuardVerdict
  readonly second: ControlGuardVerdict
  readonly consumptions: number
}
type T4MemberLeg = {
  readonly first: ControlGuardVerdict
  readonly second: ControlGuardVerdict
  readonly consumptions: number
}
let T4: {
  readonly leader: T4LeaderLeg
  readonly member: T4MemberLeg
}
{
  // Leader path (v2 leader row).
  const worldL = await createP6T4World('a6-ld-t4a', ['leader', 'worker'])
  let leader: T4LeaderLeg
  try {
    await installV2LeaderRow(worldL)
    const service = createP6T4Service(worldL)
    const scope = makeScope({ targetInstanceId: LEADER_ID, correlation: 'corr-a6-ld-t4' })
    const request = await service.requestControl({
      rootSessionId: P6T4_ROOT,
      caller: leaderCaller(),
      kind: CONTROL_REQUEST_KINDS.LEADER_APPROVAL,
      targetInstanceId: LEADER_ID,
      actionName: scope.actionName,
      toolName: scope.toolName,
      correlation: scope.correlation,
    })
    await service.resolveControl({
      rootSessionId: P6T4_ROOT,
      caller: leaderCaller(),
      requestId: request.requestId,
      decision: 'allow',
    })
    const first = await service.guardOperation(scope)
    const second = await service.guardOperation(scope)
    const state = await service.listControlState(P6T4_ROOT)
    leader = { request, first, second, consumptions: state.consumptions.length }
  } finally {
    await destroyP6T1World(worldL)
  }

  // Member path (live worker).
  const worldM = await createP6T4World('a6-ld-t4b', ['leader', 'worker'])
  let member: T4MemberLeg
  try {
    await installV2LeaderRow(worldM)
    const service = createP6T4Service(worldM)
    const scope = makeScope({ correlation: 'corr-a6-ld-t4m' })
    const request = await service.requestControl({
      rootSessionId: P6T4_ROOT,
      caller: memberCaller(WORKER_ID),
      kind: CONTROL_REQUEST_KINDS.LEADER_APPROVAL,
      targetInstanceId: WORKER_ID,
      actionName: scope.actionName,
      toolName: scope.toolName,
      correlation: scope.correlation,
    })
    await service.resolveControl({
      rootSessionId: P6T4_ROOT,
      caller: leaderCaller(),
      requestId: request.requestId,
      decision: 'allow',
    })
    const first = await service.guardOperation(scope)
    const second = await service.guardOperation(scope)
    const state = await service.listControlState(P6T4_ROOT)
    member = { first, second, consumptions: state.consumptions.length }
  } finally {
    await destroyP6T1World(worldM)
  }

  T4 = { leader, member }
}

// --- assertions (synchronous `it` bodies over the captured results) ------------------

describe('RC2-A6 T1: a live leader (v2 LeaderInstance row, no lifecycle) passes the last-mile guard after a leader-approval allow (RED→GREEN core)', () => {
  it('the world carries the PRODUCTION leader row shape: schemaVersion 2, no lifecycle key, no childSessionId key (the stock P6T4 v1-style seed is replaced, not modified)', () => {
    expect(T1.rowShape.present).toBe(true)
    expect(T1.rowShape.schemaVersion).toBe(2)
    expect(T1.rowShape.hasLifecycleKey).toBe(false)
    expect(T1.rowShape.hasChildSessionIdKey).toBe(false)
  })

  it('request (leader asks, leader target, leader-approval kind) + allow decision are durable', () => {
    expect(T1.request.status).toBe('pending')
    expect(T1.request.targetInstanceId).toBe(LEADER_ID)
    expect(T1.decision.requestId).toBe(T1.request.requestId)
    expect(T1.decision.decision).toBe(CONTROL_DECISION_VALUES.ALLOW)
  })

  it('the guard returns allowed: true for the live leader (unfixed code returned target-stale here)', () => {
    expect(T1.verdict.allowed).toBe(true)
    if (T1.verdict.allowed === true) {
      expect(T1.verdict.requestId).toBe(T1.request.requestId)
    }
  })

  it('the successful guard consumed the one-shot allow exactly once', () => {
    expect(T1.consumptions).toBe(1)
  })
})

describe('RC2-A6 T2: a lingering leader row with the TeamSession gone -> target-stale (leader liveness IS team existence)', () => {
  it('the TeamSession row was deleted while the leader row lingers', () => {
    expect(T2.teamDeleted).toBe(true)
    expect(T2.leaderRowLingers).toBe(true)
  })

  it('the guard blocks the leader: target-stale (the liveness predicate is TeamSession existence, not a member row)', () => {
    expect(T2.verdict.allowed).toBe(false)
    if (T2.verdict.allowed === false) {
      expect(T2.verdict.reason).toBe(CONTROL_GUARD_BLOCK_REASONS.TARGET_STALE)
    }
  })
})

describe('RC2-A6 T3: the ordinary-member liveness matrix is unchanged (live lifecycles pass, ARCHIVED and missing rows block)', () => {
  it('RUNNING member + allow -> allowed: true', () => {
    expect(T3.running.decision.decision).toBe(CONTROL_DECISION_VALUES.ALLOW)
    expect(T3.running.verdict.allowed).toBe(true)
  })

  it('ARCHIVED member + allow -> target-stale (the suspended target cannot execute)', () => {
    expect(T3.archived.decision.decision).toBe(CONTROL_DECISION_VALUES.ALLOW)
    expect(T3.archived.verdict.allowed).toBe(false)
    if (T3.archived.verdict.allowed === false) {
      expect(T3.archived.verdict.reason).toBe(CONTROL_GUARD_BLOCK_REASONS.TARGET_STALE)
    }
  })

  it('SETTLED member + allow -> allowed: true (quiescent, not gone)', () => {
    expect(T3.settled.decision.decision).toBe(CONTROL_DECISION_VALUES.ALLOW)
    expect(T3.settled.verdict.allowed).toBe(true)
  })

  it('CREATED member + allow -> allowed: true', () => {
    expect(T3.created.decision.decision).toBe(CONTROL_DECISION_VALUES.ALLOW)
    expect(T3.created.verdict.allowed).toBe(true)
  })

  it('a MISSING member row (the team still exists) + a recorded allow -> target-stale (liveness precedes request state)', () => {
    expect(T3.missing.decision.decision).toBe(CONTROL_DECISION_VALUES.ALLOW)
    expect(T3.missing.verdict.allowed).toBe(false)
    if (T3.missing.verdict.allowed === false) {
      expect(T3.missing.verdict.reason).toBe(CONTROL_GUARD_BLOCK_REASONS.TARGET_STALE)
    }
  })
})

describe('RC2-A6 T4: the one-shot allow is consumed exactly once — leader path and member path', () => {
  it('leader path: the first guard allows (consuming the allow), the second identical guard -> allow-consumed, exactly one consumption fact', () => {
    expect(T4.leader.first.allowed).toBe(true)
    if (T4.leader.first.allowed === true) {
      expect(T4.leader.first.requestId).toBe(T4.leader.request.requestId)
    }
    expect(T4.leader.second.allowed).toBe(false)
    if (T4.leader.second.allowed === false) {
      expect(T4.leader.second.reason).toBe(CONTROL_GUARD_BLOCK_REASONS.ALLOW_CONSUMED)
      expect(T4.leader.second.requestId).toBe(T4.leader.request.requestId)
    }
    expect(T4.leader.consumptions).toBe(1)
  })

  it('member path: the same sequence on a live member -> allow-consumed, exactly one consumption fact', () => {
    expect(T4.member.first.allowed).toBe(true)
    expect(T4.member.second.allowed).toBe(false)
    if (T4.member.second.allowed === false) {
      expect(T4.member.second.reason).toBe(CONTROL_GUARD_BLOCK_REASONS.ALLOW_CONSUMED)
    }
    expect(T4.member.consumptions).toBe(1)
  })
})
