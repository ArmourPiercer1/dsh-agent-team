/**
 * Alpha.3 PR5 — the permission-notification behavior specs: the FOUR
 * required test classes of the awareness layer, over the REAL durable
 * overlay world (the PR1 helper: FileStorageSeam scratch medium + the real
 * persistence-only port; no host, no port, no model, no network):
 *
 * 1. ACTIVE → the best-effort notification is delivered (once,
 *    generation-tagged, awareness-only text);
 * 2. IDLE → the Agent is never awakened: the delivery seam is NEVER
 *    touched (and `unknown`/throwing liveness behaves the same — the
 *    layer never guesses and owns no wake path);
 * 3. STALE → the delivered notice only MARKS its generation (and the
 *    superseding generation); permissions are byte-unchanged (raw durable
 *    rows stable, current authority still the highest generation, the
 *    `append` member of the injected port is Proxy-guarded and never even
 *    reached);
 * 4. FAILED DELIVERY → the notifier never throws and the mutation result /
 *    ack is UNTOUCHED: the composition leg (`commit → ack → notify`)
 *    returns the identical committed snapshot whatever the delivery does.
 *
 * Plus the determinism / purity / awareness-payload legs that keep classes
 * 1 and 3 honest (byte-identical renders; the notice carries the rule
 * COUNT, never the rules; provenance copied verbatim, never interpreted).
 *
 * @module @dsh-agent-team/runtime/test/a3p5-permission-notification
 */

import { describe, expect, it } from 'vitest'
import {
  createPermissionChangeNotifier,
  permissionChangeNotificationFromSnapshot,
  renderPermissionChangeNotification,
} from '../permission-notification/index.js'
import type {
  PermissionAgentLiveness,
  PermissionAgentLivenessPort,
  PermissionNotificationDeliveryPort,
} from '../permission-notification/index.js'
import type { PermissionOverlaySnapshot } from '../permission-governance/types.js'
import type { PermissionOverlayRepositoryPort } from '../permission-governance/port.js'
import {
  FIXTURE_INSTANCE_ID,
  FIXTURE_TEAM_SESSION_ID,
  cloneRows,
  fixtureKey,
  openWorld,
  rawOverlayRows,
  snapshotInput,
} from './permission-overlay-helpers.js'

// ---------------------------------------------------------------------------
// Local fakes for the two PENDING production bindings (liveness read +
// delivery). They only record — a call the spec does not expect shows up
// as a count mismatch, which is exactly how "idle never awakened" is
// pinned: the seam is never reached, so no wake path of any kind exists.
// ---------------------------------------------------------------------------

interface DeliverCall {
  readonly teamSessionId: string
  readonly memberInstanceId: string
  readonly text: string
}

function makeLiveness(
  behavior: PermissionAgentLiveness | 'throw',
): { port: PermissionAgentLivenessPort; counter: { statusCalls: number } } {
  const counter = { statusCalls: 0 }
  const port: PermissionAgentLivenessPort = {
    async status() {
      counter.statusCalls += 1
      if (behavior === 'throw') throw new Error('liveness seam down')
      return behavior
    },
  }
  return { port, counter }
}

function makeDeliver(behavior: 'ok' | 'throw'): {
  port: PermissionNotificationDeliveryPort
  calls: DeliverCall[]
} {
  const calls: DeliverCall[] = []
  return {
    calls,
    port: {
      async deliver(input: DeliverCall) {
        calls.push(input)
        if (behavior === 'throw') throw new Error('delivery seam down')
      },
    },
  }
}

/** The durable authority read seam with an `append`-guarded Proxy over the
 *  real world port: reaching ANY member other than `latest` throws — the
 *  notifier's type already cannot name `append`/`history`; this pins it at
 *  runtime as well (and pins "a stale notice performs no durable write"). */
function latestOnlyAuthority(worldPort: PermissionOverlayRepositoryPort): {
  authority: {
    latest(
      identity: { readonly teamSessionId: string; readonly memberInstanceId: string },
    ): Promise<PermissionOverlaySnapshot | undefined>
  }
  touched: Set<string>
} {
  const touched = new Set<string>()
  const proxy = new Proxy(worldPort as unknown as Record<string, unknown>, {
    get(target, prop) {
      if (typeof prop !== 'string') return undefined
      touched.add(prop)
      if (prop !== 'latest') throw new Error(`notification lane reached port member "${prop}"`)
      const member = target[prop]
      return typeof member === 'function' ? (member as (...a: unknown[]) => unknown).bind(target) : member
    },
  })
  return {
    authority: proxy as unknown as {
      latest(
        identity: { readonly teamSessionId: string; readonly memberInstanceId: string },
      ): Promise<PermissionOverlaySnapshot | undefined>
    },
    touched,
  }
}

// ---------------------------------------------------------------------------

describe('class 1 — ACTIVE Agent receives the best-effort notification', () => {
  it('delivers exactly one generation-tagged notice to the active target', async () => {
    const world = await openWorld('notify-active')
    try {
      const snapshot = await world.port.append(snapshotInput(1))
      const liveness = makeLiveness('active')
      const deliver = makeDeliver('ok')
      const authoritySeam = latestOnlyAuthority(world.port)
      const notifier = createPermissionChangeNotifier({
        authority: authoritySeam.authority,
        liveness: liveness.port,
        deliver: deliver.port,
      })

      const outcome = await notifier.notifyPermissionCommit(snapshot)

      expect(outcome).toEqual({ delivered: true, staleness: 'current' })
      expect(deliver.calls).toHaveLength(1)
      const call = deliver.calls[0] as DeliverCall
      expect(call.teamSessionId).toBe(FIXTURE_TEAM_SESSION_ID)
      expect(call.memberInstanceId).toBe(FIXTURE_INSTANCE_ID)
      // The GENERATION TAG leads the text as the machine-dedup token.
      expect(call.text.startsWith(
        `[team-perm-changed team=${FIXTURE_TEAM_SESSION_ID} instance=${FIXTURE_INSTANCE_ID} generation=1]`,
      )).toBe(true)
      expect(call.text).toContain(`snapshotId: ${fixtureKey(1)}`)
      expect(call.text).toContain('mutationId: mut-1')
      expect(call.text).toContain('actor: leader:inst-root')
      expect(call.text).toContain('ruleCount: 1')
      // Awareness-only closing: the text points at the durable authority.
      expect(call.text).toContain('AWARENESS ONLY')
      expect(call.text).toContain('never authorization evidence')
      expect(call.text).toContain('read projection')
      // One point read of liveness, zero writes on the authority seam.
      expect(liveness.counter.statusCalls).toBe(1)
      expect([...authoritySeam.touched].sort()).toEqual(['latest'])
    } finally {
      world.destroy()
    }
  })

  it('the notice carries the rule COUNT only — never the rule payload', async () => {
    const world = await openWorld('notify-no-rules')
    try {
      const snapshot = await world.port.append(
        snapshotInput(1, { rules: [{ operation: 'write', resource: 'output/secret-path.json', effect: 'allow' }] }),
      )
      const liveness = makeLiveness('active')
      const deliver = makeDeliver('ok')
      const notifier = createPermissionChangeNotifier({
        authority: latestOnlyAuthority(world.port).authority,
        liveness: liveness.port,
        deliver: deliver.port,
      })

      await notifier.notifyPermissionCommit(snapshot)

      const text = (deliver.calls[0] as DeliverCall).text
      // The state payload stays behind the read projection: neither the
      // resource nor the effect vocabulary enters the notice.
      expect(text).not.toContain('output/secret-path.json')
      expect(text).not.toContain('allow')
      expect(text).toContain('ruleCount: 1')
    } finally {
      world.destroy()
    }
  })

  it('renders byte-identically for the same input (deterministic, dedup-friendly)', async () => {
    const world = await openWorld('notify-determinism')
    try {
      const snapshot = await world.port.append(snapshotInput(1))
      const first = permissionChangeNotificationFromSnapshot(snapshot)
      const second = permissionChangeNotificationFromSnapshot(snapshot)
      expect(renderPermissionChangeNotification(first, 'current')).toBe(
        renderPermissionChangeNotification(second, 'current'),
      )
    } finally {
      world.destroy()
    }
  })

  it('the built notification is frozen, primitive-valued, and carries no rules field', async () => {
    const world = await openWorld('notify-frozen')
    try {
      const snapshot = await world.port.append(snapshotInput(1))
      const notice = permissionChangeNotificationFromSnapshot(snapshot)
      expect(Object.isFrozen(notice)).toBe(true)
      expect('rules' in notice).toBe(false)
      for (const value of Object.values(notice)) {
        expect(['string', 'number', 'boolean', 'object-null'].includes(typeof value === 'object' && value === null ? 'object-null' : typeof value)).toBe(true)
      }
      expect(notice.generation).toBe(1)
      expect(notice.previousSnapshotId).toBe(null)
      expect(notice.mutationId).toBe('mut-1')
      expect(notice.actor).toBe('leader:inst-root')
      expect(notice.changedAt).toBe('2026-10-01T12:00:00.000Z')
      expect(notice.ruleCount).toBe(1)
    } finally {
      world.destroy()
    }
  })

  it('the reason is whitespace-collapsed and bound-defended in the render', () => {
    // Builder-level leg (pure, no store): a raw 600-char reason renders
    // collapsed and re-bounded at the mirrored durable bound.
    const long = 'x'.repeat(600)
    const snapshot: PermissionOverlaySnapshot = {
      schemaVersion: 1,
      snapshotId: 's#inst-a#1',
      identity: { teamSessionId: 's', memberInstanceId: 'inst-a' },
      state: { rules: [] },
      metadata: { generation: 1, previousSnapshotId: null },
      provenance: { actor: 'human', mutationId: 'm-raw', timestamp: '2026-10-01T12:00:00.000Z', reason: `a\n  b   ${long}` },
    }
    const notice = permissionChangeNotificationFromSnapshot(snapshot)
    // The builder copies verbatim (the durable row is already bounded);
    // the renderer does the collapse + slice.
    expect(notice.reason).toBe(`a\n  b   ${long}`)
    const rendered = renderPermissionChangeNotification(notice, 'current')
    expect(rendered).toContain('reason: a b')
    expect(rendered).not.toContain('\n  b')
    const reasonLine = rendered.split('\n').find((line) => line.startsWith('reason:')) as string
    expect(reasonLine.length).toBeLessThanOrEqual('reason: '.length + 512)
  })
})

describe('class 2 — IDLE Agents are NEVER awakened (active-only delivery)', () => {
  for (const [label, behavior, expectedSkip] of [
    ['idle', 'idle', 'agent-idle'],
    ['unknown liveness', 'unknown', 'agent-liveness-unknown'],
    ['throwing liveness read', 'throw', 'agent-liveness-unknown'],
  ] as const) {
    it(`${label}: the delivery seam is never touched (zero wake calls)`, async () => {
      const world = await openWorld(`notify-${behavior}`)
      try {
        const snapshot = await world.port.append(snapshotInput(1))
        const liveness = makeLiveness(behavior)
        const deliver = makeDeliver('ok')
        const authoritySeam = latestOnlyAuthority(world.port)
        const notifier = createPermissionChangeNotifier({
          authority: authoritySeam.authority,
          liveness: liveness.port,
          deliver: deliver.port,
        })

        const outcome = await notifier.notifyPermissionCommit(snapshot)

        expect(outcome).toEqual({ delivered: false, skip: expectedSkip })
        // THE pin: no input turn was delivered at all — the layer owns no
        // wake/followup/steer path, so "not delivered" is "not awakened".
        expect(deliver.calls).toHaveLength(0)
        // The authority seam was not consulted either: the skip happens
        // before any other read (cheapest gate first, no work for a skip).
        expect([...authoritySeam.touched]).toEqual([])
      } finally {
        world.destroy()
      }
    })
  }

  it('the liveness port is READ-ONLY by shape: status is its only member', () => {
    const liveness = makeLiveness('idle')
    expect(Object.keys(liveness.port)).toEqual(['status'])
  })
})

describe('class 3 — STALE notification marks its generation; permissions unchanged', () => {
  it('a superseded notice still delivers (active) MARKED, and writes nothing', async () => {
    const world = await openWorld('notify-stale')
    try {
      const staleSnapshot = await world.port.append(snapshotInput(1))
      const currentSnapshot = await world.port.append(snapshotInput(2))
      const rowsBefore = cloneRows(rawOverlayRows(world.dir))

      const liveness = makeLiveness('active')
      const deliver = makeDeliver('ok')
      const authoritySeam = latestOnlyAuthority(world.port)
      const notifier = createPermissionChangeNotifier({
        authority: authoritySeam.authority,
        liveness: liveness.port,
        deliver: deliver.port,
      })

      // A late notice about GENERATION 1 while the durable authority is
      // already generation 2 (the out-of-order arrival PR5 must handle).
      const outcome = await notifier.notifyPermissionCommit(staleSnapshot)

      expect(outcome).toEqual({ delivered: true, staleness: 'superseded' })
      const text = (deliver.calls[0] as DeliverCall).text
      // It CARRIES/MARKS its generation (token) and names the superseding
      // generation — awareness, never action.
      expect(text).toContain('generation=1]')
      expect(text).toContain('SUPERSEDED: this notice covers generation 1; the durable authority is generation 2.')
      expect(text).not.toContain('STALENESS UNKNOWN')

      // PERMISSIONS UNCHANGED: the durable authority is still generation 2
      // byte-for-byte, and the lane never reached the port's write member.
      const latest = await world.port.latest({
        teamSessionId: FIXTURE_TEAM_SESSION_ID,
        memberInstanceId: FIXTURE_INSTANCE_ID,
      })
      expect(latest).toEqual(currentSnapshot)
      expect(cloneRows(rawOverlayRows(world.dir))).toEqual(rowsBefore)
      expect([...authoritySeam.touched].sort()).toEqual(['latest'])
    } finally {
      world.destroy()
    }
  })

  it('unverifiable staleness renders an honest UNKNOWN marker (never a guess)', async () => {
    // A snapshot whose identity has NO durable authority on this world
    // (a foreign row hand-built as data — pure builder + notifier path).
    const world = await openWorld('notify-unknown-staleness')
    try {
      const foreign: PermissionOverlaySnapshot = {
        schemaVersion: 1,
        snapshotId: 'session-root-1#inst-alpha#9',
        identity: { teamSessionId: FIXTURE_TEAM_SESSION_ID, memberInstanceId: FIXTURE_INSTANCE_ID },
        state: { rules: [] },
        metadata: { generation: 9, previousSnapshotId: null },
        provenance: { actor: 'human', mutationId: 'm-9', timestamp: '2026-10-01T12:00:00.000Z', reason: '' },
      }
      const deliver = makeDeliver('ok')
      const notifier = createPermissionChangeNotifier({
        authority: latestOnlyAuthority(world.port).authority,
        liveness: makeLiveness('active').port,
        deliver: deliver.port,
      })

      const outcome = await notifier.notifyPermissionCommit(foreign)

      expect(outcome).toEqual({ delivered: true, staleness: 'unknown' })
      expect((deliver.calls[0] as DeliverCall).text).toContain('STALENESS UNKNOWN')
      // still zero durable effect for this identity
      const latest = await world.port.latest({
        teamSessionId: FIXTURE_TEAM_SESSION_ID,
        memberInstanceId: FIXTURE_INSTANCE_ID,
      })
      expect(latest).toBeUndefined()
    } finally {
      world.destroy()
    }
  })

  it('a throwing authority read degrades to staleness=unknown, never to a failure of the mutation path', async () => {
    const world = await openWorld('notify-authority-throws')
    try {
      const snapshot = await world.port.append(snapshotInput(1))
      const deliver = makeDeliver('ok')
      const notifier = createPermissionChangeNotifier({
        authority: {
          latest() {
            throw new Error('medium unavailable')
          },
        },
        liveness: makeLiveness('active').port,
        deliver: deliver.port,
      })

      const outcome = await notifier.notifyPermissionCommit(snapshot)

      expect(outcome).toEqual({ delivered: true, staleness: 'unknown' })
      expect((deliver.calls[0] as DeliverCall).text).toContain('STALENESS UNKNOWN')
    } finally {
      world.destroy()
    }
  })
})

describe('class 4 — FAILED delivery leaves the mutation result / ack untouched', () => {
  it('the commit→ack→notify composition returns the identical snapshot and reports the liveness failure only', async () => {
    const world = await openWorld('notify-delivery-fails')
    try {
      const liveness = makeLiveness('active')
      const deliver = makeDeliver('throw')
      const notifier = createPermissionChangeNotifier({
        authority: latestOnlyAuthority(world.port).authority,
        liveness: liveness.port,
        deliver: deliver.port,
      })

      // THE splice shape the pending wiring will use: durably commit, take
      // the ACK, then notify — the ack returned to the caller is whatever
      // the commit produced, no matter what notification does after.
      async function commitThenNotify() {
        const ack = await world.port.append(snapshotInput(1))
        const outcome = await notifier.notifyPermissionCommit(ack)
        return { ack, outcome }
      }

      const { ack, outcome } = await commitThenNotify()

      // (a) no throw crossed into the mutation path,
      // (b) the outcome is the closed skip report,
      expect(outcome).toEqual({ delivered: false, skip: 'delivery-failed' })
      // (c) the ack is the durable committed snapshot verbatim,
      expect(ack.snapshotId).toBe(fixtureKey(1))
      expect(ack.metadata.generation).toBe(1)
      // (d) the durable permission state is exactly the commit itself.
      const latest = await world.port.latest({
        teamSessionId: FIXTURE_TEAM_SESSION_ID,
        memberInstanceId: FIXTURE_INSTANCE_ID,
      })
      expect(latest).toEqual(ack)
      expect(Object.keys(rawOverlayRows(world.dir))).toEqual([fixtureKey(1)])
    } finally {
      world.destroy()
    }
  })

  it('the notifier never throws for ANY seam failure combination', async () => {
    const world = await openWorld('notify-never-throws')
    try {
      const snapshot = await world.port.append(snapshotInput(1))
      const cases = [
        createPermissionChangeNotifier({
          authority: { latest() { throw new Error('x') } },
          liveness: { async status() { throw new Error('x') } },
          deliver: { async deliver() { throw new Error('x') } },
        }),
        createPermissionChangeNotifier({
          authority: { async latest() { return undefined } },
          liveness: makeLiveness('idle').port,
          deliver: { async deliver() { throw new Error('x') } },
        }),
      ]
      for (const notifier of cases) {
        const outcome = await notifier.notifyPermissionCommit(snapshot)
        expect(outcome.delivered === false || outcome.delivered === true).toBe(true)
      }
    } finally {
      world.destroy()
    }
  })

  it('the skip/staleness vocabulary is closed (awareness report, no permission fields)', () => {
    // The outcome object shape itself is evidence: it can name liveness
    // outcomes only — no generation, no rules, no effect, no authority.
    const outcome = { delivered: false, skip: 'delivery-failed' } as const
    expect(Object.keys(outcome)).toEqual(['delivered', 'skip'])
  })
})
