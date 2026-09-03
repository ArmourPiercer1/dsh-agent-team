/**
 * P9-T10 (P9-S7) — the member command flow: pending → remote → projection.
 *
 * Coverage (plan §P9-S7 "Command flows"): a `member.send` issued through
 * the frozen Team Remote client settles exactly once through the wire,
 * and the projection store is never touched by the command itself:
 *
 *   1. while the send is PENDING, the store snapshot reference is stable
 *      (no optimistic authority patch — Gate P9-G5: "no optimistic
 *      authority patch is applied before the response lands");
 *   2. the local request token (`send-1` from the frozen generator) is
 *      carried verbatim in the wire params;
 *   3. the typed outcome is preserved verbatim by
 *      `parseMemberCommandOutcome` (a success is exactly `{ ok: true }` —
 *      it carries no further UI state);
 *   4. resolving the send does NOT touch the projection (the snapshot
 *      reference is still the pre-send one after the response lands);
 *   5. the change arrives ONLY via the next projection frame: the
 *      follow-up `pull` applies generation 2 (the member row now SETTLED)
 *      — the final state is projection-driven, never command-driven.
 *
 * The carrier is scripted: `team.getProjection` #1 answers with the gen-1
 * frame (member RUNNING), `member.send` answers with a DEFERRED envelope
 * (resolved explicitly by the scenario), `team.getProjection` #2 answers
 * with the gen-2 frame (member SETTLED).
 *
 * Shim-constrained spec (run-tests.mjs): the `it()` bodies are
 * synchronous assertions on captured scenario state; the async scenario
 * runs at module level (top-level await, the P8-T3 round-trip pattern).
 * Microtask-only: no timers (the retry scheduler is manual and never
 * fires — the scenario has no transport loss).
 * Matchers used: toBe / toEqual / toBeGreaterThan (+ .not) only.
 */
import { describe, expect, it } from 'vitest'
import {
  REMOTE_CONTRACT_VERSION,
  REMOTE_RPC_CHANNEL,
  buildRemoteSuccess,
  type RemoteProjectionValue,
  type RemoteResponse,
} from '../../remote/src/index.js'
import {
  buildMemberSendParams,
  createRequestTokenGenerator,
  parseMemberCommandOutcome,
} from '../src/model/team-member-commands.js'
import { createTeamProjectionStore } from '../src/state/team-projection-store.js'
import { createTeamRemoteClient } from '../src/transport/team-remote-client.js'
import type { TeamRpcCarrier } from '../src/transport/host-seams.js'

const TEAM = 'team-1'
const PROJECTION_METHOD = 'team.getProjection'

/** One minimal member row (the wire is plain JSON — no branded ids). */
function wireMember(lifecycle: string): Record<string, unknown> {
  return {
    instanceId: 'i1',
    templateId: 'tpl-1',
    label: 'Alpha',
    childSessionId: 'child-1',
    workspace: 'wsp',
    createdAt: '2026-08-29T00:00:00.000Z',
    lifecycle,
    contextPolicy: 'persistent',
    effectiveConfig: { model: 'm', workspace: 'wsp', permissions: {}, autonomy: 'full' },
    liveActivity: null,
  }
}

/** One minimal 9-field wire projection at `generation` (member at `lifecycle`). */
function wireFrame(generation: number, lifecycle: string): RemoteProjectionValue {
  return {
    schemaVersion: 1,
    teamSessionId: TEAM,
    blueprint: { blueprintId: 'bp-1', revision: 2, contentHash: 'sha-1' },
    generation,
    generatedAt: '2026-08-29T00:00:00.000Z',
    root: {
      teamSessionId: TEAM,
      createdAt: '2026-08-29T00:00:00.000Z',
      policyState: 'open',
      compatibility: {
        status: 'OPEN',
        probeGeneration: 1,
        requirementFingerprint: 'rf-1',
        environmentFingerprint: 'ef-1',
        warningCount: 0,
        fatalCount: 0,
        acknowledgedWarningCount: 0,
      },
      creationBudgetConsumed: true,
    },
    templates: [],
    members: [wireMember(lifecycle)],
    ledger: {
      latestSequence: 0,
      totalEntries: 0,
      byCategory: {
        team: 0,
        member: 0,
        lifecycle: 0,
        message: 0,
        control: 0,
        policy: 0,
        compatibility: 0,
        progress: 0,
      },
      pendingControlCount: 0,
    },
  } as unknown as RemoteProjectionValue
}

/** One frozen `team.getProjection` success envelope (G8 provenance intact). */
function projectionSuccess(generation: number, lifecycle: string): RemoteResponse {
  return buildRemoteSuccess(
    { projection: wireFrame(generation, lifecycle) },
    {
      method: PROJECTION_METHOD,
      endpoint: PROJECTION_METHOD,
      contractVersion: REMOTE_CONTRACT_VERSION,
      requestToken: null,
      projectionGeneration: generation,
    },
  )
}

/** One frozen `member.send` success envelope (the token echoes in provenance). */
function memberSendSuccess(requestToken: string): RemoteResponse {
  return buildRemoteSuccess(
    { instanceId: 'i1' },
    {
      method: 'member.send',
      endpoint: 'member.send',
      contractVersion: REMOTE_CONTRACT_VERSION,
      requestToken,
    },
  )
}

/** A manual retry scheduler (never fires — the scenario has no loss). */
function makeManualScheduler() {
  interface Task {
    readonly due: number
    readonly task: () => void
  }
  const tasks = new Map<number, Task>()
  let handle = 1
  let clock = 0
  return {
    schedule: (delayMs: number, task: () => void) => {
      const h = handle++
      tasks.set(h, { due: clock + delayMs, task })
      return h
    },
    cancel: (h: number) => {
      void tasks.delete(h)
    },
    advance: (ms: number) => {
      clock += ms
      const ready = [...tasks.entries()]
        .filter(([, t]) => t.due <= clock)
        .sort((a, b) => a[1].due - b[1].due || a[0] - b[0])
      for (const [h, t] of ready) {
        tasks.delete(h)
        t.task()
      }
    },
    pending: () => tasks.size,
  }
}

/**
 * The scripted carrier: projection #1 → gen-1 frame (RUNNING);
 * `member.send` → the DEFERRED envelope; projection #2 → gen-2 frame
 * (SETTLED). Records every call.
 */
function makeScriptedCarrier() {
  const calls: { readonly endpoint: string; readonly payload: unknown }[] = []
  let projectionCount = 0
  let resolveSend: (response: RemoteResponse) => void = () => undefined
  const deferredSend = new Promise<RemoteResponse>((resolve) => {
    resolveSend = resolve
  })
  const carrier: TeamRpcCarrier = {
    call: async (channel, endpoint, payload) => {
      if (channel !== REMOTE_RPC_CHANNEL) {
        throw new Error(`command flow: unexpected channel ${String(channel)}`)
      }
      calls.push({ endpoint, payload })
      if (endpoint === PROJECTION_METHOD) {
        projectionCount += 1
        return projectionCount === 1
          ? projectionSuccess(1, 'RUNNING')
          : projectionSuccess(2, 'SETTLED')
      }
      if (endpoint === 'member.send') {
        return deferredSend
      }
      throw new Error(`command flow: unexpected endpoint ${String(endpoint)}`)
    },
  }
  return { carrier, calls, resolveSend }
}

/** Microtask flush (no timers). */
async function flush(turns = 16): Promise<void> {
  for (let i = 0; i < turns; i += 1) await Promise.resolve()
}

// ---------------------------------------------------------------------------
// Module-level scenario
// ---------------------------------------------------------------------------

const flow = await (async () => {
  const { carrier, calls, resolveSend } = makeScriptedCarrier()
  const client = createTeamRemoteClient(carrier)
  const store = createTeamProjectionStore({
    getProjection: (id) => client.getProjection(id),
    scheduler: makeManualScheduler(),
  })

  // 1) the first pull applies the gen-1 frame (member RUNNING)
  await store.pull(TEAM)
  const before = store.getState()

  // 2) the local token + the frozen param builder
  const nextToken = createRequestTokenGenerator('send')
  const token = nextToken()
  const params = buildMemberSendParams({
    teamSessionId: TEAM,
    recipientInstanceId: 'i1',
    requestToken: token,
    body: 'check in',
  })

  // 3) issue the send — it stays PENDING on the deferred envelope
  const pendingSend = client.memberSend(params)
  await flush()
  const whilePending = store.getState()

  // 4) resolve the send and parse the outcome
  resolveSend(memberSendSuccess(token))
  const response = await pendingSend
  const outcome = parseMemberCommandOutcome(response)
  const afterResolve = store.getState()

  // 5) the follow-up pull applies the gen-2 frame (member SETTLED)
  await store.pull(TEAM)
  const after = store.getState()

  return { calls, token, params, before, whilePending, outcome, afterResolve, after }
})()

// ---------------------------------------------------------------------------
// Assertions
// ---------------------------------------------------------------------------

describe('P9-T10 (P9-S7) command flows — member.send: pending → remote → projection', () => {
  it('the gen-1 frame is applied before the command (the flow starts at generation 1)', () => {
    const { before } = flow
    expect(before.appliedGeneration).toBe(1)
    const frame = before.frame
    if (frame === null) throw new Error('missing: gen-1 frame')
    const member = frame.projection.members[0]
    if (member === undefined) throw new Error('missing: gen-1 member row')
    expect(member.lifecycle).toBe('RUNNING')
  })

  it('while member.send is pending, the snapshot reference is stable (no optimistic state)', () => {
    expect(flow.whilePending).toBe(flow.before)
  })

  it('the request token is carried verbatim in the wire params', () => {
    expect(flow.token).toBe('send-1')
    const call = flow.calls[1]
    if (call === undefined) throw new Error('missing: member.send call')
    expect(call.endpoint).toBe('member.send')
    expect((call.payload as { params: unknown }).params).toEqual(flow.params)
    expect((call.payload as { params: { requestToken: string } }).params.requestToken).toBe(flow.token)
  })

  it('the typed outcome is preserved verbatim (a success is exactly { ok: true })', () => {
    expect(flow.outcome).toEqual({ ok: true })
  })

  it('resolving the send does not touch the projection (reference stable after the response lands)', () => {
    expect(flow.afterResolve).toBe(flow.before)
  })

  it('the change arrives only via the frame: the follow-up pull applies generation 2', () => {
    const { after, before } = flow
    expect(after).not.toBe(before)
    expect(after.appliedGeneration).toBe(2)
    const frame = after.frame
    if (frame === null) throw new Error('missing: gen-2 frame')
    const member = frame.projection.members[0]
    if (member === undefined) throw new Error('missing: gen-2 member row')
    expect(member.lifecycle).toBe('SETTLED')
  })
})
