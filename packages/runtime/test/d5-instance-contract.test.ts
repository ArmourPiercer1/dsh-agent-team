import { describe, expect, it } from 'vitest'
import {
  ACTIVATION_SOURCES,
  activationOperationIdentity,
  allocateActivationInstanceId,
} from '../activation/index.js'
import {
  ACTION_NAMES,
  CALLER_ROLES,
} from '../admission/index.js'
import type { ActionCaller, TeamRuntimeActionRequest, TeamRuntimeActionOutcome } from '../admission/index.js'
import { INSTANCE_ID_PATTERN, LEADER_INSTANCE_ID } from '../../contracts/src/index.js'
import { createTeamTools } from '../../tools/src/index.js'
import type { TeamToolsOptions } from '../../tools/src/index.js'

const ROOT = 'session-d5-root'

function toolOptions(): TeamToolsOptions {
  return {
    teamRuntime: undefined,
    controlService: undefined,
    messaging: undefined,
    activity: undefined,
    resolveCaller: undefined,
  } as unknown as TeamToolsOptions
}

describe('D5 activation instance contract', () => {
  it('replays the same request token to the same instance identity', () => {
    const first = activationOperationIdentity(ROOT, ACTIVATION_SOURCES.LEADER_EXPLICIT, 'd5-replay')
    const second = activationOperationIdentity(ROOT, ACTIVATION_SOURCES.LEADER_EXPLICIT, 'd5-replay')
    expect(second).toEqual(first)
  })

  it('allocates distinct instances for distinct request tokens', () => {
    const first = allocateActivationInstanceId(ROOT, ACTIVATION_SOURCES.LEADER_EXPLICIT, 'd5-a')
    const second = allocateActivationInstanceId(ROOT, ACTIVATION_SOURCES.LEADER_EXPLICIT, 'd5-b')
    expect(first).not.toBe(second)
  })

  it('keeps same-template parallel operations collision-free', () => {
    const ids = ['d5-p1', 'd5-p2', 'd5-p3'].map((token) =>
      allocateActivationInstanceId(ROOT, ACTIVATION_SOURCES.HUMAN_UI, token),
    )
    expect(new Set(ids).size).toBe(3)
  })

  it('reserves inst-leader for the team leader', () => {
    const allocated = allocateActivationInstanceId(ROOT, ACTIVATION_SOURCES.HUMAN_UI, 'd5-leader-guard')
    expect(allocated).not.toBe(LEADER_INSTANCE_ID)
    expect(LEADER_INSTANCE_ID).toBe('inst-leader')
  })

  it('rejects caller-controlled instanceId as an unknown create-member field', () => {
    const createMember = createTeamTools(toolOptions()).tools.find((tool) => tool.name === 'team_create_member')
    if (createMember === undefined) throw new Error('team_create_member tool missing')
    expect(Object.prototype.hasOwnProperty.call(createMember.parameters.properties, 'instanceId')).toBe(false)
    expect(createMember.parameters.additionalProperties).toBe(false)
  })

  // ---------------------------------------------------------------------------
  // B4 (v2) extensions — D5 regression confirmation (TEAM_D1-D6_REPAIR_PLAN_V2
  // §8/B4): the deterministic provider-owned instanceId contract must hold.
  // These assertions extend the five v1 tests where coverage was missing;
  // the allocation algorithm is NOT modified by this task.
  // ---------------------------------------------------------------------------

  it('a caller-controlled instanceId never reaches the constructed create-member request (does not take effect)', async () => {
    const captured: TeamRuntimeActionRequest[] = []
    const options = {
      teamRuntime: {
        performAction: async (request: TeamRuntimeActionRequest): Promise<TeamRuntimeActionOutcome> => {
          captured.push(request)
          return {
            status: 'executed',
            action: ACTION_NAMES.CREATE_MEMBER,
            rootSessionId: ROOT,
            callerRole: CALLER_ROLES.HUMAN,
            effect: { kind: 'none' },
            requestToken: 'd5-inject',
          }
        },
      },
      controlService: undefined,
      messaging: undefined,
      activity: undefined,
      resolveCaller: async (): Promise<ActionCaller> => ({ kind: 'human', humanId: 'd5-human' }),
    }
    const createMember = createTeamTools(options as unknown as TeamToolsOptions).tools.find(
      (tool) => tool.name === 'team_create_member',
    )
    if (createMember === undefined) throw new Error('team_create_member tool missing')
    const result = await createMember.execute(
      {
        rootSessionId: ROOT,
        requestToken: 'd5-inject',
        delegationTemplateId: 'tpl-d5',
        label: 'worker',
        // A caller-controlled instance id. The closed schema (asserted in the
        // v1 test above: no instanceId property, additionalProperties: false)
        // rejects such a call at the host pipeline; at the tool layer the
        // field must at minimum NOT take effect — it is not part of the valid
        // request and must never reach the runtime action request.
        instanceId: 'inst-evil000000',
      },
      { agent: { id: 'agent-d5' } },
    )
    expect(result.status).toBe('executed')
    expect(captured).toHaveLength(1)
    const request = captured[0]
    if (request === undefined) throw new Error('create-member request not captured')
    expect(Object.prototype.hasOwnProperty.call(request, 'instanceId')).toBe(false)
    expect(Object.prototype.hasOwnProperty.call(request.payload ?? {}, 'instanceId')).toBe(false)
    expect(JSON.stringify(request)).not.toContain('inst-evil000000')
    // The provider-owned allocation for this logical operation is derived
    // solely from (root, source, token) — the caller's value is not part of
    // the activation key and cannot steer the allocation.
    expect(allocateActivationInstanceId(ROOT, ACTIVATION_SOURCES.HUMAN_UI, 'd5-inject')).not.toBe(
      'inst-evil000000',
    )
  })

  it('two parallel same-template creates allocate distinct deterministic instanceIds', () => {
    // Two logical operations for the same template (the same source path),
    // allocated in parallel: distinct ids.
    const a1 = allocateActivationInstanceId(ROOT, ACTIVATION_SOURCES.LEADER_EXPLICIT, 'd5-par-a')
    const b1 = allocateActivationInstanceId(ROOT, ACTIVATION_SOURCES.LEADER_EXPLICIT, 'd5-par-b')
    expect(a1).not.toBe(b1)
    // Deterministic: re-executing each logical operation (retry / parallel
    // re-drive) converges on the IDENTICAL id (Architecture §18.2).
    expect(allocateActivationInstanceId(ROOT, ACTIVATION_SOURCES.LEADER_EXPLICIT, 'd5-par-a')).toBe(a1)
    expect(allocateActivationInstanceId(ROOT, ACTIVATION_SOURCES.LEADER_EXPLICIT, 'd5-par-b')).toBe(b1)
    // The activation key is (rootSessionId, source, requestToken): the same
    // token under a DIFFERENT source is a different logical operation and
    // must not collapse onto the first allocation.
    expect(allocateActivationInstanceId(ROOT, ACTIVATION_SOURCES.HUMAN_UI, 'd5-par-a')).not.toBe(a1)
  })

  it('the reserved inst-leader id is never allocated across the swept key space', () => {
    const sources = [
      ACTIVATION_SOURCES.LEADER_EXPLICIT,
      ACTIVATION_SOURCES.LEADER_DELEGATE,
      ACTIVATION_SOURCES.HUMAN_UI,
    ]
    const allocated: string[] = []
    for (const source of sources) {
      for (let i = 0; i < 64; i++) {
        const id = allocateActivationInstanceId(ROOT, source, `d5-sweep-${i}`)
        allocated.push(id)
        expect(id).not.toBe(LEADER_INSTANCE_ID)
        // Well-formed contracts-v1 member instance id: 'inst-' (5) + 12 base36.
        expect(INSTANCE_ID_PATTERN.test(id)).toBe(true)
        expect(id.length).toBe(17)
      }
    }
    // The reservation holds per-team as well: other roots, all sources.
    for (const root of ['session-d5-root-b', 'session-d5-root-c']) {
      for (const source of sources) {
        const id = allocateActivationInstanceId(root, source, 'd5-sweep-root')
        allocated.push(id)
        expect(id).not.toBe(LEADER_INSTANCE_ID)
      }
    }
    expect(allocated).toHaveLength(3 * 64 + 6)
    for (const id of allocated) {
      expect(id).not.toBe(LEADER_INSTANCE_ID)
    }
  })

  it('replay of the same requestToken converges to the same instance (no second allocation)', () => {
    // Deterministic re-allocation: the same logical operation always
    // allocates the same instance id.
    const first = allocateActivationInstanceId(ROOT, ACTIVATION_SOURCES.LEADER_EXPLICIT, 'd5-conv')
    const replay = allocateActivationInstanceId(ROOT, ACTIVATION_SOURCES.LEADER_EXPLICIT, 'd5-conv')
    expect(replay).toBe(first)
    // The durable operation identity (the journal convergence inputs —
    // operationId + idempotencyKey) is invariant across the replay, so the
    // provider re-drives the EXISTING durable operation instead of
    // allocating a second instance (admit-once; the durable re-drive path is
    // exercised end-to-end by the P6-T1 recovery tests R1/R5).
    const idFirst = activationOperationIdentity(ROOT, ACTIVATION_SOURCES.LEADER_EXPLICIT, 'd5-conv')
    const idReplay = activationOperationIdentity(ROOT, ACTIVATION_SOURCES.LEADER_EXPLICIT, 'd5-conv')
    expect(idFirst.instanceId).toBe(first)
    expect(idReplay.instanceId).toBe(idFirst.instanceId)
    expect(idReplay.operationId).toBe(idFirst.operationId)
    expect(idReplay.idempotencyKey).toBe(idFirst.idempotencyKey)
    // A DIFFERENT token is a different logical operation: it allocates a
    // second instance (no over-convergence).
    expect(
      allocateActivationInstanceId(ROOT, ACTIVATION_SOURCES.LEADER_EXPLICIT, 'd5-conv-2'),
    ).not.toBe(first)
  })
})
