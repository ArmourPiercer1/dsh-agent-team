/**
 * Alpha.3 PR5 — the DELIVERY BINDING (parent GO, inject-only ruling). The
 * binding is the receipt-time seam between the awareness layer and one
 * PUBLIC upstream Agent surface member: `Agent.inject(message)` — the one
 * input whose upstream implementation never wakes and never latches
 * (pristine 0.1.7-rc.1: packages/core/agent-loop/src/agent.ts:153-171 —
 * `inject = send('next-step', /* wake= *\/false) with the sole wake call
 * at :159; packages/core/agent/src/runtime-types.ts:233-241 — "without
 * waking the driver"). `steer` / `followup` are FORBIDDEN here: both pass
 * wake=true, and an idle target starts a turn (runtime-types.ts:225-231)
 * — sequencing cannot fix that, only the non-waking member can.
 *
 * Pinned classes (parent GO (a)-(e)):
 * (a) RUNNING target receives: exactly one inject of the rendered
 *     generation-tagged awareness text, as a model-visible user message;
 * (b) idle / cold / closing / lifecycle-blocked / identity-mismatch →
 *     DROP at the receipt gate, zero inbox writes, zero wake touches;
 * (c) active→idle RACE while the async authority read is in flight → the
 *     sync receipt gate drops at RECEIPT time (the advisory liveness read
 *     lied — the guarantee lives in the gate, not the pre-check);
 * (d) cancel-while-running: the module touches ONLY `status` + `inject`
 *     (a wake-capable member is not even nameable through the binding's
 *     structural agent type); upstream parking/no-wake semantics are
 *     source-pinned above, not re-implemented here;
 * (e) ack independence: dispatch DETACHED from the committed ack — slow,
 *     faulting, or never-settling delivery never delays, reorders, or
 *     alters an ack (content + order asserted).
 *
 * The receipt gate is a FULLY SYNCHRONOUS function — gates and the one
 * inject share a single tick, so no interleaving can slip between the
 * final check and the send (the strongest form of the parent's "no await
 * between the final check and inject"). Host durable-inbox semantics are
 * the upstream's own and ALLOWED AS-IS: an inject may miss the current
 * batch or wait for an unrelated future wake; this layer invents no
 * queue, no retry state, and no second delivery path.
 *
 * Offline, host-free, no ports. The agent is a recording fake; the ONLY
 * production binding is the PENDING final splice (same gating as the rest
 * of the lane — see the module README).
 *
 * @module @dsh-agent-team/runtime/test/a3p5-permission-delivery-binding
 */

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import type { UserMessage } from '@deepseek-ai/dsh-llm'
import {
  createPermissionChangeNotifier,
  createPermissionDeliveryAdapter,
  createPermissionDeliveryBinding,
  detachPermissionNotice,
  permissionChangeNotificationFromSnapshot,
  PermissionNoticeDropped,
  renderPermissionChangeNotification,
} from '../permission-notification/index.js'
import type {
  PermissionAgentLivenessPort,
  PermissionLiveHandle,
  PermissionNotificationDeliveryPort,
  PermissionNotificationOutcome,
  PermissionNoticeReceipt,
} from '../permission-notification/index.js'
import type { PermissionOverlaySnapshot } from '../permission-governance/types.js'
import {
  FIXTURE_INSTANCE_ID,
  FIXTURE_TEAM_SESSION_ID,
  cloneRows,
  fixtureKey,
  openWorld,
  rawOverlayRows,
  snapshotInput,
} from './permission-overlay-helpers.js'

const HERE = dirname(fileURLToPath(import.meta.url))

// ---------------------------------------------------------------------------
// Fakes. The recording AGENT proxy makes every wake-capable member a
// landmine: `steer`, `followup`, `whenIdle`, `cancel`, `send`, `resume`,
// `dispose` — touching any of them is recorded, and the legs assert the
// record stays EMPTY. The lookup is a pure owned-pair map read — it never
// creates, resumes, or adopts anything (a cold pair is simply absent).
// ---------------------------------------------------------------------------

interface FakeAgent {
  readonly calls: { readonly inject: UserMessage[]; readonly touched: string[] }
  readonly agent: unknown
  status: 'idle' | 'running'
  injectBehavior: 'ok' | 'throw'
}

function makeFakeAgent(initial: { status?: 'idle' | 'running'; injectBehavior?: 'ok' | 'throw' } = {}): FakeAgent {
  const calls = { inject: [] as UserMessage[], touched: [] as string[] }
  let status: 'idle' | 'running' = initial.status ?? 'running'
  let injectBehavior: 'ok' | 'throw' = initial.injectBehavior ?? 'ok'
  const landmine = (name: string): (() => never) => (): never => {
    calls.touched.push(name)
    throw new Error(`wake-capable surface touched: ${name}`)
  }
  const target: Record<string, unknown> = {
    get status(): 'idle' | 'running' {
      return status
    },
    inject(message: UserMessage): void {
      if (injectBehavior === 'throw') throw new Error('inject fault')
      calls.inject.push(message)
    },
    steer: landmine('steer'),
    followup: landmine('followup'),
    whenIdle: landmine('whenIdle'),
    cancel: landmine('cancel'),
    send: landmine('send'),
    resume: landmine('resume'),
    dispose: landmine('dispose'),
  }
  const agent = new Proxy(target, {
    get(obj, key) {
      if (typeof key === 'string') calls.touched.push(key)
      return Reflect.get(obj, key)
    },
  })
  return {
    calls,
    agent,
    get status() {
      return status
    },
    set status(next: 'idle' | 'running') {
      status = next
    },
    get injectBehavior() {
      return injectBehavior
    },
    set injectBehavior(next: 'ok' | 'throw') {
      injectBehavior = next
    },
  }
}

interface BindingHarness {
  readonly binding: ReturnType<typeof createPermissionDeliveryBinding>
  state: { closing: boolean; lifecycleActive: boolean }
  readonly lookups: { count: number }
}

function makeBindingHarness(agent: FakeAgent): BindingHarness {
  const state = { closing: false, lifecycleActive: true }
  const lookups = { count: 0 }
  const binding = createPermissionDeliveryBinding({
    closing: () => state.closing,
    liveHandle: (identity) => {
      lookups.count += 1
      if (identity.memberInstanceId !== FIXTURE_INSTANCE_ID) return undefined
      return {
        teamSessionId: identity.teamSessionId,
        memberInstanceId: FIXTURE_INSTANCE_ID,
        agent: agent.agent as PermissionLiveHandle['agent'],
      }
    },
    lifecycleActive: () => state.lifecycleActive,
  })
  return { binding, state, lookups }
}

function makeWorldBindingHarness(
  handles: Map<string, PermissionLiveHandle>,
  state: { closing: boolean; lifecycleActive: boolean } = { closing: false, lifecycleActive: true },
): { binding: ReturnType<typeof createPermissionDeliveryBinding>; state: typeof state } {
  const binding = createPermissionDeliveryBinding({
    closing: () => state.closing,
    liveHandle: (identity) => handles.get(`${identity.teamSessionId}\u0000${identity.memberInstanceId}`),
    lifecycleActive: () => state.lifecycleActive,
  })
  return { binding, state }
}

async function commitFirst(worldDirName: string): Promise<{
  snapshot: PermissionOverlaySnapshot
  notice: { teamSessionId: string; memberInstanceId: string }
  text: string
  destroy: () => void
}> {
  const world = await openWorld(worldDirName)
  const ack = await world.port.append(snapshotInput(1, { rules: [{ operation: 'write', resource: 'output/secret-path.json', effect: 'allow' }] }))
  const notification = permissionChangeNotificationFromSnapshot(ack)
  const text = renderPermissionChangeNotification(notification, 'current')
  return {
    snapshot: ack,
    notice: { teamSessionId: notification.teamSessionId, memberInstanceId: notification.memberInstanceId },
    text,
    destroy: world.destroy,
  }
}

describe('class (a) — RUNNING target receives through inject only', () => {
  it('delivers the rendered awareness text as ONE model-visible user message', async () => {
    const agent = makeFakeAgent()
    const harness = makeBindingHarness(agent)
    const committed = await commitFirst('binding-a1')
    try {
      const receipt = harness.binding.deliver({ ...committed.notice, text: committed.text })
      expect(receipt).toEqual({ delivered: true })
      expect(agent.calls.inject).toHaveLength(1)
      const message = agent.calls.inject[0] as UserMessage
      expect(message.role).toBe('user')
      // SOURCE PROVENANCE (PR61 review BLOCK): role 'user' is the host
      // MESSAGE CARRIER only — the SOURCE must be the plugin's own v4
      // producer kind, never human 'user' attribution (pinned glue
      // precedent agent-bindings.mjs:4078-4081).
      expect(message.source).toEqual({ kind: 'plugin:dsh-agent-team' })
      const rendered = JSON.stringify(message)
      expect(rendered).toContain('[team-perm-changed team=')
      expect(rendered).toContain('generation=1')
      expect(rendered).toContain('AWARENESS ONLY')
      // The rule payload never rides the notice — only the rule COUNT.
      expect(rendered).not.toContain('output/secret-path.json')
      // Only the two allowed members were ever touched on the agent.
      expect([...new Set(agent.calls.touched)].sort()).toEqual(['inject', 'status'])
    } finally {
      committed.destroy()
    }
  })

  it('each attempt carries a fresh message id (no park-collision by construction)', async () => {
    const agent = makeFakeAgent()
    const harness = makeBindingHarness(agent)
    const committed = await commitFirst('binding-a2')
    try {
      expect(harness.binding.deliver({ ...committed.notice, text: committed.text })).toEqual({ delivered: true })
      expect(harness.binding.deliver({ ...committed.notice, text: committed.text })).toEqual({ delivered: true })
      expect(agent.calls.inject).toHaveLength(2)
      expect(agent.calls.inject[0]?.id).not.toBe(agent.calls.inject[1]?.id)
    } finally {
      committed.destroy()
    }
  })

  it('the notice never satisfies the upstream USER-source predicate that refills the wake budget', async () => {
    // The consecutive-wake budget consumer (pristine 46a7f68b09
    // packages/jobs/tool-jobs/src/index.ts): the budget is SPENT at
    // :295-305 (wake-delivery followup while `spent < wakeBudget`) and
    // refills EXACTLY on user-sourced claims at :211-215 —
    //   ctx.on('agent/inbox/claimed', ({ agent, message }) => {
    //     if (message.source.kind === 'user') spentWakes.delete(agent)
    //   })
    // A plugin notice wearing `kind: 'user'` would therefore REFILL the
    // Human pathway it just spent. Every injected notice must fail that
    // predicate: the carrier role stays 'user' (createUserMessage), the
    // source kind is the plugin's own v4 producer kind — which v4
    // admission accepts (only the retired shared 'plugin' wrapper is
    // rejected, session-format-v3-to-v4 src/message-sources.ts:8-11) and
    // which MessageSourceMap admits by design (dsh-llm message.d.ts:
    // 95-107, merge-extensible, "no shared catch-all plugin kind").
    const agent = makeFakeAgent()
    const harness = makeBindingHarness(agent)
    const committed = await commitFirst('binding-a-provenance')
    try {
      expect(harness.binding.deliver({ ...committed.notice, text: committed.text })).toEqual({ delivered: true })
      expect(harness.binding.deliver({ ...committed.notice, text: committed.text })).toEqual({ delivered: true })
      expect(agent.calls.inject).toHaveLength(2)
      for (const message of agent.calls.inject) {
        expect(message.role).toBe('user') // carrier role — not the source
        expect(message.source.kind).toBe('plugin:dsh-agent-team')
        // The EXACT predicate the upstream reset branch consumes:
        expect(message.source.kind === 'user').toBe(false)
      }
    } finally {
      committed.destroy()
    }
  })

  it('the REAL notifier through the REAL adapter delivers end-to-end to a running target', async () => {
    const agent = makeFakeAgent()
    const world = await openWorld('binding-a3')
    try {
      const ack = await world.port.append(snapshotInput(1))
      const handles = new Map<string, PermissionLiveHandle>([[
        `${FIXTURE_TEAM_SESSION_ID}\u0000${FIXTURE_INSTANCE_ID}`,
        {
          teamSessionId: FIXTURE_TEAM_SESSION_ID,
          memberInstanceId: FIXTURE_INSTANCE_ID,
          agent: agent.agent as PermissionLiveHandle['agent'],
        },
      ]])
      const { binding } = makeWorldBindingHarness(handles)
      const notifier = createPermissionChangeNotifier({
        authority: { latest: async () => ack },
        liveness: { async status() { return 'active' } },
        deliver: createPermissionDeliveryAdapter(binding),
      })
      const outcome = await notifier.notifyPermissionCommit(ack)
      expect(outcome).toEqual({ delivered: true, staleness: 'current' })
      expect(agent.calls.inject).toHaveLength(1)
      // The COMPOSED path (notifier → adapter → binding) carries the same
      // producer provenance as the direct leg — the notice the real
      // pipeline emits is plugin-sourced, never human-sourced.
      expect((agent.calls.inject[0] as UserMessage).source).toEqual({ kind: 'plugin:dsh-agent-team' })
      expect([...new Set(agent.calls.touched)].sort()).toEqual(['inject', 'status'])
    } finally {
      world.destroy()
    }
  })
})

describe('class (b) — idle / cold / closing / lifecycle / mismatch DROP, zero inbox writes', () => {
  async function expectDrop(
    label: string,
    setup: () => Promise<{ receipt: PermissionNoticeReceipt; agent: FakeAgent; cleanup: () => void }>,
  ): Promise<void> {
    const { receipt, agent, cleanup } = await setup()
    try {
      expect(receipt, label).not.toEqual({ delivered: true })
      expect(agent.calls.inject).toHaveLength(0)
      expect(agent.calls.touched.filter((name) => !['status', 'inject'].includes(name))).toEqual([])
    } finally {
      cleanup()
    }
  }

  it('idle target drops as not-running', async () => {
    await expectDrop('idle', async () => {
      const agent = makeFakeAgent({ status: 'idle' })
      const harness = makeBindingHarness(agent)
      const committed = await commitFirst('binding-b1')
      return { receipt: harness.binding.deliver({ ...committed.notice, text: committed.text }), agent, cleanup: committed.destroy }
    })
  })

  it('cold (no owned live handle) drops as not-live', async () => {
    const agent = makeFakeAgent()
    const handles = new Map<string, PermissionLiveHandle>()
    const { binding } = makeWorldBindingHarness(handles)
    const committed = await commitFirst('binding-b2')
    try {
      const receipt = binding.deliver({ ...committed.notice, text: committed.text })
      expect(receipt).toEqual({ delivered: false, drop: 'not-live' })
      expect(agent.calls.inject).toHaveLength(0)
    } finally {
      committed.destroy()
    }
  })

  it('closing glue drops BEFORE any handle lookup', async () => {
    const agent = makeFakeAgent()
    const harness = makeBindingHarness(agent)
    harness.state.closing = true
    const committed = await commitFirst('binding-b3')
    try {
      const receipt = harness.binding.deliver({ ...committed.notice, text: committed.text })
      expect(receipt).toEqual({ delivered: false, drop: 'closing' })
      expect(harness.lookups.count).toBe(0)
      expect(agent.calls.touched).toHaveLength(0)
    } finally {
      committed.destroy()
    }
  })

  it('lifecycle-blocked member drops without touching the agent', async () => {
    const agent = makeFakeAgent()
    const harness = makeBindingHarness(agent)
    harness.state.lifecycleActive = false
    const committed = await commitFirst('binding-b4')
    try {
      const receipt = harness.binding.deliver({ ...committed.notice, text: committed.text })
      expect(receipt).toEqual({ delivered: false, drop: 'lifecycle-blocked' })
      expect(agent.calls.touched).toHaveLength(0)
    } finally {
      committed.destroy()
    }
  })

  it('a handle whose identity is not the EXACT addressed pair drops', async () => {
    const agent = makeFakeAgent()
    const handles = new Map<string, PermissionLiveHandle>([[
      `${FIXTURE_TEAM_SESSION_ID}\u0000${FIXTURE_INSTANCE_ID}`,
      {
        teamSessionId: FIXTURE_TEAM_SESSION_ID,
        memberInstanceId: 'inst-someone-else',
        agent: agent.agent as PermissionLiveHandle['agent'],
      },
    ]])
    const { binding } = makeWorldBindingHarness(handles)
    const committed = await commitFirst('binding-b5')
    try {
      const receipt = binding.deliver({ ...committed.notice, text: committed.text })
      expect(receipt).toEqual({ delivered: false, drop: 'identity-mismatch' })
      expect(agent.calls.touched).toHaveLength(0)
    } finally {
      committed.destroy()
    }
  })

  it('the adapter surfaces every drop as a rejection carrying the closed reason', async () => {
    const agent = makeFakeAgent({ status: 'idle' })
    const harness = makeBindingHarness(agent)
    const port = createPermissionDeliveryAdapter(harness.binding)
    const committed = await commitFirst('binding-b6')
    try {
      await expect(port.deliver({ ...committed.notice, text: committed.text })).rejects.toBeInstanceOf(PermissionNoticeDropped)
      await expect(port.deliver({ ...committed.notice, text: committed.text })).rejects.toMatchObject({ drop: 'not-running' })
      expect(agent.calls.inject).toHaveLength(0)
    } finally {
      committed.destroy()
    }
  })
})

describe('class (c) — active→idle RACE across the async authority read', () => {
  it('idle-at-receipt DROPS at the gate although the advisory liveness read said active', async () => {
    const agent = makeFakeAgent()
    const world = await openWorld('binding-c1')
    try {
      const ack = await world.port.append(snapshotInput(1))
      const handles = new Map<string, PermissionLiveHandle>([[
        `${FIXTURE_TEAM_SESSION_ID}\u0000${FIXTURE_INSTANCE_ID}`,
        {
          teamSessionId: FIXTURE_TEAM_SESSION_ID,
          memberInstanceId: FIXTURE_INSTANCE_ID,
          agent: agent.agent as PermissionLiveHandle['agent'],
        },
      ]])
      const { binding } = makeWorldBindingHarness(handles)
      let releaseGate: () => void = () => undefined
      const gate = new Promise<void>((resolve) => {
        releaseGate = resolve
      })
      const notified = createPermissionChangeNotifier({
        // Advisory pre-check: lies ACTIVE (a stale read is legal — the
        // guarantee must NOT depend on it).
        liveness: { async status() { return 'active' } },
        // The async window: the authority read is in flight while the
        // target transitions to idle — exactly the race the receipt gate
        // must absorb.
        authority: {
          latest: async () => {
            await gate
            return ack
          },
        },
        deliver: createPermissionDeliveryAdapter(binding),
      })
      const running = notified.notifyPermissionCommit(ack)
      await Promise.resolve()
      await Promise.resolve()
      agent.status = 'idle' // the race lands DURING the awaited read
      releaseGate()
      const outcome = await running
      expect(outcome).toEqual({ delivered: false, skip: 'delivery-failed' })
      expect(agent.calls.inject).toHaveLength(0)
      expect(agent.calls.touched.filter((n) => !['status', 'inject'].includes(n))).toEqual([])
    } finally {
      world.destroy()
    }
  })

  it('direct binding leg: the synchronous gate + inject share one tick (no interleaving point exists)', async () => {
    const agent = makeFakeAgent()
    const harness = makeBindingHarness(agent)
    const committed = await commitFirst('binding-c2')
    try {
      // After a plain await the flip happens; the SYNC deliver then reads
      // status and injects (or drops) in the same tick — no await exists
      // between them, so this observed sequence IS the race resolution.
      await Promise.resolve()
      agent.status = 'idle'
      const receipt = harness.binding.deliver({ ...committed.notice, text: committed.text })
      expect(receipt).toEqual({ delivered: false, drop: 'not-running' })
      expect(agent.calls.inject).toHaveLength(0)
      agent.status = 'running'
      expect(harness.binding.deliver({ ...committed.notice, text: committed.text })).toEqual({ delivered: true })
    } finally {
      committed.destroy()
    }
  })
})

describe('class (d) — cancel-while-running: the module touches status + inject ONLY', () => {
  it('an aborted-but-still-running target gets exactly one inject; no wake member is nameable or touched', async () => {
    const agent = makeFakeAgent()
    const harness = makeBindingHarness(agent)
    const committed = await commitFirst('binding-d1')
    try {
      // Upstream truth (source-pinned, NOT re-implemented here): send with
      // wake=false neither wakes nor latches — agent.ts:153-159 + :213-221 —
      // so an aborted running target merely PARKES the notice (host
      // durable-inbox semantics, allowed as-is; no new turn starts).
      const receipt = harness.binding.deliver({ ...committed.notice, text: committed.text })
      expect(receipt).toEqual({ delivered: true })
      expect(agent.calls.inject).toHaveLength(1)
      // Parked notices keep the same producer provenance — whatever the
      // host inbox later surfaces is never human-attributed.
      expect((agent.calls.inject[0] as UserMessage).source).toEqual({ kind: 'plugin:dsh-agent-team' })
      expect(agent.calls.touched.filter((n) => !['status', 'inject'].includes(n))).toEqual([])
    } finally {
      committed.destroy()
    }
  })

  it('the binding module source never names a wake-capable call site', () => {
    const source = readFileSync(join(HERE, '..', 'permission-notification', 'binding.ts'), 'utf8')
    const code = source
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .split('\n')
      .filter((line) => !/^\s*\/\//.test(line))
      .join('\n')
    for (const forbidden of [
      /\.steer\s*\(/,
      /\.followup\s*\(/,
      /\.whenIdle\s*\(/,
      /\.cancel\s*\(/,
      /\.send\s*\(/,
      /ensureLiveAgent/,
      /\bresum(?:e|ing)Agent\b/,
      /\badopt\b/,
      /\bcreateChildSession\b/,
      /\bretry\b/i,
    ]) {
      expect(code, `binding.ts matched ${String(forbidden)}`).not.toMatch(forbidden)
    }
    // The structural agent type is the two-member Pick — a wake member is
    // not even NAMEABLE through the binding types.
    expect(source).toMatch(/Pick<\s*Agent\s*,\s*'status'\s*\|\s*'inject'\s*>/)
  })
})

describe('class (e) — ack independence under detached dispatch', () => {
  function makeDetachedCommitter(deps: {
    deliver: PermissionNotificationDeliveryPort
  }): {
    events: string[]
    mutateThenNotify(world: { port: { append(input: ReturnType<typeof snapshotInput>): Promise<PermissionOverlaySnapshot> } }, generation: number): Promise<string>
  } {
    const events: string[] = []
    const liveness: PermissionAgentLivenessPort = { async status() { return 'active' } }
    const notifier = createPermissionChangeNotifier({
      authority: { latest: async () => undefined },
      liveness,
      deliver: deps.deliver,
    })
    return {
      events,
      async mutateThenNotify(world, generation) {
        const ack = await world.port.append(snapshotInput(generation))
        events.push(`ack:${String(generation)}`)
        detachPermissionNotice(async () => {
          const outcome = await notifier.notifyPermissionCommit(ack)
          events.push(outcome.delivered ? 'notify:delivered' : `notify:${outcome.skip}`)
        })
        return ack.snapshotId
      },
    }
  }

  it('slow delivery never delays or reorders the acks', async () => {
    const world = await openWorld('binding-e1')
    try {
      const committer = makeDetachedCommitter({
        deliver: {
          async deliver() {
            await new Promise((resolve) => setTimeout(resolve, 25))
          },
        },
      })
      const first = await committer.mutateThenNotify(world, 1)
      const second = await committer.mutateThenNotify(world, 2)
      expect(first).toBe(fixtureKey(1))
      expect(second).toBe(fixtureKey(2))
      // Both acks completed BEFORE any delivery settled.
      expect(committer.events).toEqual(['ack:1', 'ack:2'])
      await new Promise((resolve) => setTimeout(resolve, 60))
      expect(committer.events).toEqual(['ack:1', 'ack:2', 'notify:delivered', 'notify:delivered'])
    } finally {
      world.destroy()
    }
  })

  it('a never-settling delivery leaves the ack settled and the next mutation unaffected', async () => {
    const world = await openWorld('binding-e2')
    try {
      const committer = makeDetachedCommitter({
        deliver: {
          deliver: () => new Promise<never>(() => undefined),
        },
      })
      const first = await committer.mutateThenNotify(world, 1)
      const second = await committer.mutateThenNotify(world, 2)
      expect(first).toBe(fixtureKey(1))
      expect(second).toBe(fixtureKey(2))
      expect(committer.events).toEqual(['ack:1', 'ack:2'])
    } finally {
      world.destroy()
    }
  })

  it('a faulting inject byte-equals the no-notification durable result (ack content untouched)', async () => {
    const golden = await openWorld('binding-e3-golden')
    const faulted = await openWorld('binding-e3-faulted')
    try {
      const acksGolden: string[] = []
      for (const generation of [1, 2, 3]) {
        acksGolden.push((await golden.port.append(snapshotInput(generation))).snapshotId)
      }
      const agent = makeFakeAgent({ injectBehavior: 'throw' })
      const handles = new Map<string, PermissionLiveHandle>([[
        `${FIXTURE_TEAM_SESSION_ID}\u0000${FIXTURE_INSTANCE_ID}`,
        {
          teamSessionId: FIXTURE_TEAM_SESSION_ID,
          memberInstanceId: FIXTURE_INSTANCE_ID,
          agent: agent.agent as PermissionLiveHandle['agent'],
        },
      ]])
      const { binding } = makeWorldBindingHarness(handles)
      const outcomes: PermissionNotificationOutcome[] = []
      const committer = makeDetachedCommitter({
        deliver: {
          async deliver(input) {
            const receipt = binding.deliver(input)
            if (!receipt.delivered && receipt.drop === 'inject-fault') outcomes.push({ delivered: false, skip: 'delivery-failed' })
          },
        },
      })
      const acksFaulted: string[] = []
      for (const generation of [1, 2, 3]) {
        acksFaulted.push(await committer.mutateThenNotify(faulted, generation))
      }
      await Promise.resolve()
      expect(acksFaulted).toEqual(acksGolden)
      expect(cloneRows(rawOverlayRows(faulted.dir))).toEqual(cloneRows(rawOverlayRows(golden.dir)))
      expect(outcomes).toHaveLength(3)
      expect(agent.calls.inject).toHaveLength(0)
    } finally {
      golden.destroy()
      faulted.destroy()
    }
  })

  it('detachPermissionNotice swallows even a synchronously throwing dispatch', () => {
    expect(() => detachPermissionNotice(() => { throw new Error('dispatch exploded') })).not.toThrow()
    expect(detachPermissionNotice(async () => Promise.reject(new Error('later')))).toBeUndefined()
  })
})
