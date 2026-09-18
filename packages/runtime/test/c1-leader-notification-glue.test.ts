/**
 * C1 (leader-approval reachability) — the live-glue
 * `deliverRootControlNotification` tests (plan §9.3):
 *
 *   G1. stable requestId prefix: the renderer's text leads with
 *       `[team-control requestId=<id>]` and is deterministic per record;
 *   G2. correct root session target + root-input seam REUSE: the
 *       notification lands as ONE attributed input on the Leader root
 *       through the SAME private `deliverRootInput` path the delegate
 *       work uses (the agents double's followup record, verbatim text);
 *   G3. zero authority: the delivery writes no TeamDomain state (the
 *       domain double's member-instance/override rows are untouched —
 *       no coordination fact, no envelope mutation, no request row);
 *   G4. rejection propagation: empty-field and unknown-root inputs
 *       REJECT to the notifier layer (where the control service treats
 *       them as non-fatal liveness failures — the 9.2 suite proves the
 *       service side);
 *   G5. the notifier factory binds the renderer to the glue port:
 *       `notifyLeaderRequest(record)` delivers the rendered text for
 *       that record's root (the production wiring shape).
 *
 * Harness: the t12a-live-bridge doubles driving the REAL
 * agent-bindings.mjs (the same boundary the tcm-d4 suite asserts on).
 */

import { describe, expect, it } from 'vitest'

import {
  createLeaderControlNotifier,
  renderLeaderApprovalNotification,
} from '../control/index.js'
import type { ControlRequestRecord } from '../control/index.js'
import { createLiveWorld } from './t12a-live-bridge.mjs'

const ROOT = 'session-c1-glue-root'

const RECORD: ControlRequestRecord = {
  requestId: 'ctl-c1-glue-demo',
  rootSessionId: ROOT,
  kind: 'leader-approval',
  requester: { kind: 'instance', instanceId: 'inst-c1worker', role: 'member' },
  targetInstanceId: 'inst-c1worker',
  actionName: 'tool-execute',
  toolName: 'bash',
  correlation: 'corr-c1-glue-1',
  status: 'pending',
  createdAt: '2026-09-18T00:00:00Z',
  requestSequence: 7,
  summary: 'bash [cwd=/workspace] echo c1-glue',
}

const S = await (async () => {
  const world = await createLiveWorld({ rootSessionId: ROOT })
  await world.binding.boot()

  // (G1) the renderer: stable prefix + determinism + closed fields.
  const text = renderLeaderApprovalNotification(RECORD)
  const textAgain = renderLeaderApprovalNotification(RECORD)

  // (G2) the glue delivery: one attributed input on the ROOT, verbatim.
  const followsBefore = world.records.followups.length
  await world.binding.deliverRootControlNotification({
    rootSessionId: ROOT,
    requestId: RECORD.requestId,
    text,
  })
  const added = world.records.followups.slice(followsBefore)

  // (G3) zero durable state: the domain double's rows are untouched by
  // the delivery (no request row, no override, no member mutation).
  const domainStateBefore = JSON.stringify({
    members: world.domain.repositories.memberInstances.list(ROOT),
    overrides: world.domain.repositories.overrides.list(ROOT),
  })
  await world.binding.deliverRootControlNotification({
    rootSessionId: ROOT,
    requestId: RECORD.requestId,
    text,
  })
  const domainStateAfter = JSON.stringify({
    members: world.domain.repositories.memberInstances.list(ROOT),
    overrides: world.domain.repositories.overrides.list(ROOT),
  })

  // (G4) rejection propagation to the notifier layer.
  async function captureReject(fn: () => Promise<void>): Promise<unknown> {
    try {
      await fn()
      return undefined
    } catch (error) {
      return error
    }
  }
  const rejectEmptyRequest = await captureReject(() =>
    world.binding.deliverRootControlNotification({
      rootSessionId: ROOT,
      requestId: '',
      text,
    }),
  )
  const rejectEmptyRoot = await captureReject(() =>
    world.binding.deliverRootControlNotification({
      rootSessionId: '',
      requestId: RECORD.requestId,
      text,
    }),
  )
  const rejectUnknownRoot = await captureReject(() =>
    world.binding.deliverRootControlNotification({
      rootSessionId: 'session-c1-glue-unknown-root',
      requestId: RECORD.requestId,
      text,
    }),
  )

  // (G5) the notifier factory over the glue port (the production shape):
  // notifyLeaderRequest renders + delivers for the record's own root.
  const notifier = createLeaderControlNotifier({
    deliver: world.binding.deliverRootControlNotification,
  })
  const followsBeforeFactory = world.records.followups.length
  await notifier.notifyLeaderRequest(RECORD)
  const factoryAdded = world.records.followups.slice(followsBeforeFactory)

  await world.binding.close()

  return {
    text,
    textAgain,
    added,
    domainStateBefore,
    domainStateAfter,
    rejectEmptyRequest,
    rejectEmptyRoot,
    rejectUnknownRoot,
    factoryAdded,
  }
})()

describe('deliverRootControlNotification (C1) — the live Leader liveness delivery', () => {
  it('G1: the renderer text leads with the stable token prefix and is deterministic', () => {
    expect(S.text).toContain('[team-control requestId=ctl-c1-glue-demo]')
    expect(S.text).toContain('team_resolve_control')
    expect(S.text).toContain('team_list_pending_control')
    expect(S.text).toContain('requester: inst-c1worker')
    expect(S.text).toContain('tool: bash')
    expect(S.text).toContain('summary: bash [cwd=/workspace] echo c1-glue')
    // deterministic per record (a redelivery is recognizable)
    expect(S.text).toBe(S.textAgain)
    // it asks the Leader to REVIEW and decide — never "approve this"
    expect(S.text.toLowerCase()).not.toContain('approve this request')
  })

  it('G2: the delivery lands as ONE attributed input on the Leader root, verbatim (root-input seam reuse)', () => {
    expect(S.added).toHaveLength(1)
    expect(S.added[0]!.sessionId).toBe(ROOT)
    const msg = S.added[0]!.message as unknown as {
      role: string
      content: Array<{ type: string; text: string }>
    }
    expect(msg.role).toBe('user')
    expect(msg.content).toHaveLength(1)
    expect(msg.content[0]!.text).toBe(S.text)
  })

  it('G3: the delivery writes no TeamDomain state (non-authority)', () => {
    expect(S.domainStateAfter).toBe(S.domainStateBefore)
  })

  it('G4: invalid inputs REJECT to the notifier layer (non-fatal at the service)', () => {
    expect(S.rejectEmptyRequest).toBeInstanceOf(Error)
    expect(S.rejectEmptyRoot).toBeInstanceOf(Error)
    expect(S.rejectUnknownRoot).toBeInstanceOf(Error)
  })

  it('G5: the notifier factory binds the renderer to the glue port (record-root targeted, rendered text)', () => {
    expect(S.factoryAdded).toHaveLength(1)
    expect(S.factoryAdded[0]!.sessionId).toBe(ROOT)
    const msg = S.factoryAdded[0]!.message as unknown as {
      content: Array<{ text: string }>
    }
    expect(msg.content[0]!.text).toBe(S.text)
  })
})
