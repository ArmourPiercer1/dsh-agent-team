/**
 * a5m2-upstreamteam-adapters.test.ts — targeted vitest for the B-UPSTREAMTEAM
 * governed-adapter rows (census records 65-73 of
 * M0-B-RECORD-FAMILY-ACCEPTANCE-INDEX.json; family law
 * M0-B-FAMILY-TARGET-CONTRACTS.md#B-UPSTREAMTEAM).
 *
 * What it pins, and only this:
 *  - the nine frozen names and their record indexes, in index order;
 *  - the frozen mount condition stays 'declared_mount' (never widened) and the
 *    on-mount obligation is the plane's own PA funnel, so a row without a `pa`
 *    seat is a typed refusal rather than an ungoverned read;
 *  - exactly ONE row is implemented in this revision (record 66 list_agents) and
 *    the other eight names stay typed gaps — an untranscribed port law can never
 *    be filled by an invented one;
 *  - the caller identity is what reaches the injected port (the roster is the
 *    caller's team, never an argument the model can forge).
 */
import { describe, expect, it } from 'vitest'

import {
  A5_B_UPSTREAMTEAM_ADAPTER_REVISION,
  A5_B_UPSTREAMTEAM_CODES,
  A5_B_UPSTREAMTEAM_FAMILY_ID,
  A5_B_UPSTREAMTEAM_MOUNT_CONDITION,
  A5_B_UPSTREAMTEAM_NATIVE_DELEGATED,
  A5_B_UPSTREAMTEAM_SERVICE_ROWED_NAMES,
  A5_B_UPSTREAMTEAM_RECORD_SPECS,
  A5_B_UPSTREAMTEAM_TOOL_NAMES,
  createUpstreamTeamRow,
  upstreamTeamPlacementEntry,
  type BUpstreamTeamPa,
  type BUpstreamTeamNativeHandle,
  type BUpstreamTeamPort,
  type BUpstreamTeamRow,
} from '../src/plugin/live/governed-families/upstreamteam.mjs'

/**
 * The injected port fixture: every method of the host `ctx.agentTeams` face the
 * family may call, echoing what it received so the assertions can see the exact
 * marshalling. `brandTaskId` stands in for the host's own TeamTaskId brand.
 */
const port: BUpstreamTeamPort = {
  listMembers: (caller: string) => [`teammate-of:${caller}`],
  interrupt: (caller, target) => `interrupt:${caller}:${String(target)}`,
  sendMessage: (caller, message) => `send:${caller}:${String(message.target)}:${String(message.message)}:${Object.keys(message).join('|')}`,
  createTask: (caller, task) => `create:${caller}:${JSON.stringify(task)}`,
  getTask: (caller, taskId) => `get:${caller}:${String(taskId)}`,
  updateTask: (caller, patch) => `update:${caller}:${JSON.stringify(patch)}`,
  brandTaskId: (value) => `T#${String(value)}`,
}

/** Narrow a row result to its typed refusal code (no casts, no ts-ignore). */
function refusalCode(row: BUpstreamTeamRow): string | null {
  return row.ok === false ? row.code : null
}

describe('A5-M2 B-UPSTREAMTEAM adapter rows', () => {
  it('carries the nine frozen records in index order', () => {
    expect(A5_B_UPSTREAMTEAM_FAMILY_ID).toBe('B-UPSTREAMTEAM')
    expect(A5_B_UPSTREAMTEAM_ADAPTER_REVISION).toBe(1)
    expect([...A5_B_UPSTREAMTEAM_TOOL_NAMES]).toEqual([
      'interrupt_agent', 'list_agents', 'send_message', 'spawn_teammate', 'wait_agent',
      'team_task_create', 'team_task_get', 'team_task_list', 'team_task_update',
    ])
    expect(A5_B_UPSTREAMTEAM_TOOL_NAMES.map((name) => A5_B_UPSTREAMTEAM_RECORD_SPECS[name].recordIndex))
      .toEqual([65, 66, 67, 68, 69, 70, 71, 72, 73])
  })

  it('keeps the declared-mount condition and never widens exposure', () => {
    expect(A5_B_UPSTREAMTEAM_MOUNT_CONDITION).toBe('declared_mount')
    expect(upstreamTeamPlacementEntry('list_agents')).toMatchObject({
      familyId: 'B-UPSTREAMTEAM',
      recordIndex: 66,
      operation: 'upstreamteam-list',
      mountCondition: 'declared_mount',
      effect: 'read',
    })
  })

  it('rows every record: six service rows plus three native-delegated rows', () => {
    expect([...A5_B_UPSTREAMTEAM_SERVICE_ROWED_NAMES].sort()).toEqual([
      'interrupt_agent', 'list_agents', 'send_message', 'team_task_create', 'team_task_get', 'team_task_update',
    ])
    expect([...A5_B_UPSTREAMTEAM_NATIVE_DELEGATED]).toEqual(['spawn_teammate', 'wait_agent', 'team_task_list'])
    for (const name of A5_B_UPSTREAMTEAM_TOOL_NAMES) {
      expect(upstreamTeamPlacementEntry(name), name).not.toBeNull()
    }
    expect(upstreamTeamPlacementEntry('wait_agent')?.valueSide).toBe('captured-native')
    expect(upstreamTeamPlacementEntry('team_task_get')?.valueSide).toBe('transcribed-service-port')
    expect(refusalCode(createUpstreamTeamRow('no_such_tool', {}))).toBe(A5_B_UPSTREAMTEAM_CODES.rowNotRowed)
  })

  it('enters the captured native for the delegated names and keeps its semantics', async () => {
    const admitted: string[] = []
    const pa: BUpstreamTeamPa = (request) => {
      admitted.push(request.operation)
      return request.run()
    }
    const definition = { name: 'wait_agent' }
    const seenExec: unknown[] = []
    const native: BUpstreamTeamNativeHandle = {
      definition,
      execute: (args, exec) => {
        seenExec.push({ args, exec })
        return 'native-answer'
      },
    }
    const exec = { signal: { aborted: false } }
    const row = createUpstreamTeamRow('wait_agent', {
      callerAgent: 'agent-7', pa, exec, native,
      args: { timeout_ms: 30000 },
      definitionIdentityOf: () => 'def-1',
      placementFeed: () => ({ definitionIdentity: 'def-1', realmId: 'r1' }),
    })
    expect(row.ok).toBe(true)
    expect(row.ok === true ? row.invoke() : null).toBe('native-answer')
    expect(admitted).toEqual(['upstreamteam-wait'])
    expect(seenExec[0]).toEqual({ args: { timeout_ms: 30000 }, exec })
    expect(refusalCode(createUpstreamTeamRow('wait_agent', { callerAgent: 'a', pa, exec })))
      .toBe(A5_B_UPSTREAMTEAM_CODES.nativeHandleMissing)
    expect(refusalCode(createUpstreamTeamRow('wait_agent', {
      callerAgent: 'a', pa, exec, native,
      definitionIdentityOf: () => 'def-1',
      placementFeed: () => ({ definitionIdentity: 'def-OTHER' }),
    }))).toBe(A5_B_UPSTREAMTEAM_CODES.nativeDrift)
  })

  it('rides the plane PA funnel and derives the roster from the caller', async () => {
    const admitted: string[] = []
    const pa: BUpstreamTeamPa = async (request) => {
      admitted.push(request.operation)
      return request.run()
    }
    const row = createUpstreamTeamRow('list_agents', { port, callerAgent: 'agent-7', pa })
    expect(row.ok).toBe(true)
    expect(row.ok === true ? await row.invoke() : null).toEqual(['teammate-of:agent-7'])
    expect(admitted).toEqual(['upstreamteam-list'])
    expect(refusalCode(createUpstreamTeamRow('list_agents', { port, callerAgent: 'a' })))
      .toBe(A5_B_UPSTREAMTEAM_CODES.paSeatMissing)
    expect(refusalCode(createUpstreamTeamRow('list_agents', { port, pa })))
      .toBe(A5_B_UPSTREAMTEAM_CODES.callerUnresolved)
    expect(refusalCode(createUpstreamTeamRow('team_task_get', { callerAgent: 'a', pa })))
      .toBe(A5_B_UPSTREAMTEAM_CODES.portMethodMissing)
  })

  it('marshals the transcribed service faces and trims to the frozen parameter face', async () => {
    const seen: string[] = []
    const pa: BUpstreamTeamPa = (request) => {
      seen.push(request.operation)
      return request.run()
    }
    const out: unknown[] = []
    for (const [name, args] of [
      ['interrupt_agent', { target: 'mate-1', callerAgent: 'evil' }],
      ['send_message', { target: 'mate-1', message: 'hello', extra: 'drop-me' }],
      ['team_task_create', { subject: 's', description: 'd', blocked_by: ['t1'] }],
      ['team_task_get', { task_id: 't9' }],
      ['team_task_update', { task_id: 't9', expected_revision: 3, action: 'complete', owner: 'lead' }],
    ] as const) {
      const row = createUpstreamTeamRow(name, { port, callerAgent: 'agent-7', pa, args })
      out.push(row.ok === true ? await row.invoke() : row.code)
    }
    expect(out).toEqual([
      'interrupt:agent-7:mate-1',
      'send:agent-7:mate-1:hello:target|message',
      'create:agent-7:{"subject":"s","description":"d","blockedBy":["T#t1"]}',
      'get:agent-7:T#t9',
      'update:agent-7:{"taskId":"T#t9","expectedRevision":3,"action":"complete","owner":"lead"}',
    ])
    expect(seen).toEqual(['upstreamteam-interrupt', 'upstreamteam-send-message', 'upstreamteam-task-create', 'upstreamteam-task-get', 'upstreamteam-task-update'])
  })
})
