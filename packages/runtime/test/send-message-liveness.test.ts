/**
 * team_send_message liveness (acceptance boundary) — the regression suite
 * for the messaging success-boundary fix (the team_send_message workflow
 * liveness guide, docs/plans/active/team_send_message_liveness_fix_guide.md).
 *
 * The defect: the PRODUCTION SessionInputPort (agent-bindings.mjs)
 * implemented `submitAttributedInput` as `followup` + `await whenIdle()` —
 * so a `team_send_message` returned only after the recipient Agent's ENTIRE
 * model turn completed and the recipient was idle again. A recipient with a
 * long turn (reasoning / long tool calls / approval) hung the sender, and a
 * recipient that replied mid-turn formed a cross-Agent lifecycle wait cycle
 * (Leader waits Member idle ↔ Member waits Leader idle — permanent).
 *
 * The semantics under test (frozen by the fix):
 *
 *   team_send_message (messaging):
 *     success boundary = recipient INPUT ACCEPTANCE
 *     (the durable intent + durable confirmation semantics are unchanged;
 *      acceptance failure stays fail-closed)
 *
 *   team_delegate / team_follow_up (sync):
 *     success boundary = work completion (UNCHANGED — a different port,
 *     `workDelivery.deliver`, which still awaits whenIdle + materializes)
 *
 * Coverage (contract rows SML-T1…SML-T4, per the guide §11):
 * - T1 (the live glue; red pre-fix = the send hangs on the recipient's
 *   never-settling idle): the REAL agent-bindings.mjs
 *   `sessionInput.submitAttributedInput` over the t12a-live-bridge doubles
 *   with a NEVER-settling `whenIdleBehavior` deferred — post-fix the
 *   submit RESOLVES while the recipient is still "working" (the deferred
 *   is still pending), exactly ONE followup is recorded on the member
 *   session with the submitted text verbatim, `whenIdle` is never even
 *   CALLED, and no steer/inject is issued;
 * - T2 (the coordinator boundary; the recipient's long turn does not hold
 *   the sender): with a port whose acceptance resolves immediately and the
 *   recipient's turn settling 25 ms later, `sendTeamMessage` returns
 *   `delivered` BEFORE the turn has completed — the durable intent +
 *   confirmation facts are written at send time, and the later turn
 *   settlement writes NOTHING further (no second confirmation);
 * - T3 (the two-agent reply cycle; red pre-fix at the glue level = the
 *   Leader/Member idle-wait cycle): Leader → A is accepted; A's
 *   message-triggered turn (after acceptance, asynchronously) replies to
 *   the Leader; the Leader's new turn (after acceptance, asynchronously)
 *   sends one follow-up back to A — ALL THREE sends complete, each with
 *   exactly one intent and one confirmation (a watchdog timeout is a
 *   deterministic failure: the cycle must terminate);
 * - T4 (acceptance failure stays fail-closed, unchanged by the fix): a
 *   rejecting port → `MESSAGING_DELIVERY_FAILED`, ZERO inputs submitted,
 *   the intent fact REMAINS durable and NO confirmation fact exists; the
 *   restart-recovery scan then delivers + confirms it (the documented
 *   roll-forward recovery, one code path).
 *
 * House pattern of the runtime package: async world construction and
 * action execution at the TOP LEVEL (one bare block per scenario, each
 * destroyed in its finally); every `it` below asserts the captured
 * constants synchronously (the plain-node shim supports no async `it`).
 *
 * @module @dsh-agent-team/runtime/test/send-message-liveness
 */

import { describe, expect, it } from 'vitest'
import { LEADER_INSTANCE_ID } from '../../contracts/src/index.js'
import {
  MESSAGING_ERROR_CODES,
  MESSAGING_FACT_COORDINATION,
  MESSAGING_FACT_DELIVERED,
} from '../messaging/index.js'
import type {
  AttributedSessionInput,
  SendTeamMessageOutcome,
  SessionInputPort,
} from '../messaging/index.js'
import { destroyP6T1World } from './p6t1-helpers.js'
import {
  createP6T3Coordinator,
  createP6T3World,
  expectMessagingRejection,
  FakeSessionInputPort,
  findFacts,
  leaderCaller,
  makeSendRequest,
  memberCaller,
  P6T3_ROOT,
  P6T3_SEEDS,
} from './p6t3-helpers.js'
import {
  WORKTREE_ROOT,
  createLiveWorld,
  removeFixtureHome,
  withDshHome,
  writeDurableFixture,
} from './t12a-live-bridge.mjs'
import { destroyDir, scratchDir } from '../../testkit/fault-injection/file-seam.mjs'

// ══ T1 — the LIVE glue's SessionInputPort (the real agent-bindings.mjs) ══
//
// The production port is exercised at its ACTUAL boundary (the t12a-live
// bridge loads the real glue in-chain): a member cold-resume (the durable
// fixture home stands in for the on-disk session), then ONE
// submitAttributedInput while the agent's `whenIdle` is a NEVER-settling
// deferred (the recipient's "turn" is still running). Post-fix the submit
// resolves at inbox acceptance; pre-fix it hangs on the deferred (the
// watchdog below turns the hang into a deterministic failure).

const T1_ROOT = 'session-sml-t1-root'
const T1_MEMBER = {
  instanceId: 'inst-smlworker1',
  templateId: 't12a-worker',
  label: 'sml-worker',
  childSessionId: 'session-child-sml-t1-w1',
}
const T1_TEXT = 'leader ping for the acceptance boundary probe'

let t1WhenIdleCalls = 0
let t1IdleGateResolve: (() => void) | undefined
const t1IdleGate = new Promise<void>((resolve) => {
  t1IdleGateResolve = resolve
})

destroyDir(scratchDir('sml-t1'))
const t1World = await createLiveWorld({
  rootSessionId: T1_ROOT,
  // The durable member row (production shape: the cold resume resolves the
  // owning root from it) + the boot root's TeamSession row (the
  // resolveBoundBlueprint fallback parses the world's blueprintSource).
  members: [
    {
      childSessionId: T1_MEMBER.childSessionId,
      instanceId: T1_MEMBER.instanceId,
      templateId: T1_MEMBER.templateId,
    },
  ],
  teamSession: {
    rootSessionId: T1_ROOT,
    sessionId: T1_ROOT,
    blueprintId: 'team.t12a',
    generation: 1,
  },
  configOverrides: { mcpServer: null },
  agents: {
    whenIdleBehavior: () => {
      t1WhenIdleCalls += 1
      return t1IdleGate
    },
  },
})
await t1World.binding.boot()

const t1Home = `${WORKTREE_ROOT}/.tmp-sml-t1-home`
let t1RaceOutcome: string
let t1SubmitError: unknown
{
  await withDshHome(t1Home, async () => {
    writeDurableFixture(t1Home, T1_MEMBER.childSessionId)
    const submit = t1World.binding.sessionInput.submitAttributedInput({
      sessionId: T1_MEMBER.childSessionId,
      text: T1_TEXT,
      attribution: {
        kind: 'team-relay',
        fromInstanceId: LEADER_INSTANCE_ID,
        intendedForInstanceId: T1_MEMBER.instanceId,
        correlation: { requestToken: 'tok-sml-t1', factSequence: 1 },
      },
    })
    t1RaceOutcome = await Promise.race([
      submit.then(
        () => 'submit-resolved',
        (error: unknown) => {
          t1SubmitError = error
          return 'submit-rejected'
        },
      ),
      t1IdleGate.then(() => 'idle-settled-first'),
      new Promise<string>((resolve) => setTimeout(() => resolve('watchdog-timeout'), 3000)),
    ])
  })
}
removeFixtureHome(t1Home)

const t1Followup = t1World.records.followups.find((f) => f.sessionId === T1_MEMBER.childSessionId)
const t1FollowupText = t1Followup !== undefined
  ? (
      t1Followup.message as unknown as { readonly content: readonly { readonly text?: string }[] }
    ).content[0]?.text
  : undefined
const t1Resumed = t1World.records.resumes.some(
  (r) => r.sessionId === T1_MEMBER.childSessionId && r.setupProvided === true,
)
// Release the never-settling deferred (hygiene: nothing awaits it anymore —
// post-fix the port never calls whenIdle at all).
t1IdleGateResolve?.()
await t1World.binding.close()

// ══ T2 — coordinator: the send returns delivered before the long turn ends ══
//
// The port models the ACCEPTANCE boundary: it records + resolves the input
// immediately, then the recipient's "turn" settles 25 ms later
// (independently). The coordinator must return `delivered` at acceptance —
// and the later turn settlement must not touch the ledger again.

destroyDir(scratchDir('sml-t2'))
const t2World = await createP6T3World('sml-t2', ['leader', 'worker'])
let t2TurnCompleted = false
let t2TurnGateResolve: (() => void) | undefined
const t2TurnGate = new Promise<void>((resolve) => {
  t2TurnGateResolve = resolve
})
class AcceptanceBoundaryPort implements SessionInputPort {
  readonly inputs: AttributedSessionInput[] = []
  async submitAttributedInput(input: AttributedSessionInput): Promise<void> {
    this.inputs.push(input)
    // The recipient's turn runs independently AFTER acceptance (it may call
    // tools / send messages / wait approval); it settles well after the
    // sender's call has already returned.
    setTimeout(() => {
      t2TurnCompleted = true
      t2TurnGateResolve?.()
    }, 25)
  }
}
const t2Port = new AcceptanceBoundaryPort()
const t2Coordinator = createP6T3Coordinator(t2World, t2Port)
const t2Outcome = await t2Coordinator.sendTeamMessage(
  makeSendRequest({ requestToken: 'tok-sml-t2' }),
)
const t2TurnCompletedAtSend = t2TurnCompleted
await t2TurnGate
const t2IntentFacts = findFacts(t2World, MESSAGING_FACT_COORDINATION, (p) => p['requestToken'] === 'tok-sml-t2')
const t2ConfirmFacts = findFacts(t2World, MESSAGING_FACT_DELIVERED, (p) => p['requestToken'] === 'tok-sml-t2')
await destroyP6T1World(t2World)

// ══ T3 — the two-agent reply cycle (no cross-Agent lifecycle wait) ════════
//
// The reply cycle of the bug report, driven through the coordinator with
// ports that accept immediately and whose recipients act (reply)
// asynchronously DURING their message-triggered turn:
//
//   send 1: Leader → A (tok-sml-t3-l2a)
//   A's turn (post-acceptance): A → Leader (tok-sml-t3-a2l)
//   Leader's turn (post-acceptance): Leader → A (tok-sml-t3-l2a-2)
//
// All three must complete (watchdog: a hang is a deterministic failure);
// each with exactly one intent + one confirmation.

destroyDir(scratchDir('sml-t3'))
const t3World = await createP6T3World('sml-t3', ['leader', 'worker', 'worker2'])
const t3Nested: Promise<SendTeamMessageOutcome>[] = []
const t3Accepts: string[] = []
const t3Port: SessionInputPort = {
  async submitAttributedInput(input: AttributedSessionInput): Promise<void> {
    t3Accepts.push(input.attribution.correlation.requestToken)
    const token = input.attribution.correlation.requestToken
    if (token === 'tok-sml-t3-l2a') {
      // A's message-triggered turn: A replies to the leader (during the
      // turn — asynchronously, after acceptance).
      setTimeout(() => {
        t3Nested.push(
          t3Coordinator.sendTeamMessage({
            rootSessionId: P6T3_ROOT,
            caller: memberCaller(P6T3_SEEDS.worker.instanceId),
            recipientInstanceId: LEADER_INSTANCE_ID,
            body: 'A replies to the leader',
            requestToken: 'tok-sml-t3-a2l',
          }),
        )
      }, 10)
    } else if (token === 'tok-sml-t3-a2l') {
      // The Leader's new turn: one follow-up back to A (this turn must not
      // block A's turn — the cycle terminates).
      setTimeout(() => {
        t3Nested.push(
          t3Coordinator.sendTeamMessage({
            rootSessionId: P6T3_ROOT,
            caller: leaderCaller(),
            recipientInstanceId: P6T3_SEEDS.worker.instanceId,
            body: 'Leader follows up to A',
            requestToken: 'tok-sml-t3-l2a-2',
          }),
        )
      }, 10)
    }
  },
}
const t3Coordinator = createP6T3Coordinator(t3World, t3Port)
async function t3WaitForNested(count: number): Promise<void> {
  const deadline = Date.now() + 5000
  for (;;) {
    if (t3Nested.length >= count) return
    if (Date.now() > deadline) throw new Error(`T3: timeout waiting for nested send #${count} (reply cycle stalled)`)
    await new Promise((resolve) => setTimeout(resolve, 5))
  }
}
let t3CycleError: unknown
let t3First: SendTeamMessageOutcome | undefined
try {
  t3First = await Promise.race([
    (async () => {
      const first = await t3Coordinator.sendTeamMessage(
        makeSendRequest({ requestToken: 'tok-sml-t3-l2a' }),
      )
      await t3WaitForNested(1)
      await Promise.all(t3Nested)
      await t3WaitForNested(2)
      await Promise.all(t3Nested)
      return first
    })(),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('T3 watchdog: the reply cycle did not terminate (cross-Agent wait)')), 10000),
    ),
  ])
} catch (error) {
  t3CycleError = error
}
const t3Intents = findFacts(t3World, MESSAGING_FACT_COORDINATION)
const t3Confirms = findFacts(t3World, MESSAGING_FACT_DELIVERED)
const t3Tokens = (facts: { readonly payload: Record<string, unknown> }[]) =>
  facts.map((f) => String(f.payload['requestToken'] ?? ''))
await destroyP6T1World(t3World)

// ══ T4 — acceptance failure stays fail-closed (unchanged by the fix) ══════
//
// A rejecting port: the send maps to MESSAGING_DELIVERY_FAILED, ZERO
// inputs are submitted, the intent fact REMAINS durable, NO confirmation
// fact exists; the recovery scan then delivers + confirms it.

destroyDir(scratchDir('sml-t4'))
const t4World = await createP6T3World('sml-t4', ['leader', 'worker'])
const t4Port = new FakeSessionInputPort()
t4Port.setFailures(1)
const t4Coordinator = createP6T3Coordinator(t4World, t4Port)
const t4Rejection = await expectMessagingRejection(
  t4Coordinator,
  makeSendRequest({ requestToken: 'tok-sml-t4' }),
  MESSAGING_ERROR_CODES.MESSAGING_DELIVERY_FAILED,
)
// The input count at the moment of the rejection (the recovery delivery
// below legitimately submits to the same port — it is counted separately).
const t4InputCountAtRejection = t4Port.inputs.length
const t4IntentFacts = findFacts(t4World, MESSAGING_FACT_COORDINATION, (p) => p['requestToken'] === 'tok-sml-t4')
const t4ConfirmBeforeRecovery = findFacts(
  t4World,
  MESSAGING_FACT_DELIVERED,
  (p) => p['requestToken'] === 'tok-sml-t4',
)
const t4Recovery = await t4Coordinator.recoverPendingDeliveries(P6T3_ROOT)
const t4ConfirmAfterRecovery = findFacts(
  t4World,
  MESSAGING_FACT_DELIVERED,
  (p) => p['requestToken'] === 'tok-sml-t4',
)
await destroyP6T1World(t4World)

// ── the contract rows ─────────────────────────────────────────────────────

describe('SML team_send_message liveness (acceptance boundary)', () => {
  it('T1 the LIVE glue port: submit resolves at inbox acceptance — the recipient never needs to be idle (one followup, the text verbatim, whenIdle never called)', () => {
    // The cold resume happened through the production path (ensureLiveAgent
    // → agents.resume with the shared setup): the fixture session was
    // durable, the member row resolved the owning root.
    expect(t1Resumed).toBe(true)
    // THE LIVENESS PIN: the submit resolved while the recipient's turn was
    // still running (the whenIdle deferred never settled). Pre-fix the send
    // hung on the deferred (the watchdog outcome) — a permanent hang for
    // any long recipient turn.
    expect(t1SubmitError).toBeUndefined()
    expect(t1RaceOutcome).toBe('submit-resolved')
    // The port does not OBSERVE the turn at all: whenIdle is never even
    // called (not "called and raced" — never called), and no steer/inject
    // is issued (a plain message is a followup, nothing else).
    expect(t1WhenIdleCalls).toBe(0)
    expect(t1World.records.steers).toEqual([])
    expect(t1World.records.injects).toEqual([])
    // Exactly ONE inbox acceptance on the member session, carrying the
    // submitted text verbatim as an ordinary user message.
    const memberFollowups = t1World.records.followups.filter((f) => f.sessionId === T1_MEMBER.childSessionId)
    expect(memberFollowups).toHaveLength(1)
    expect(t1FollowupText).toBe(T1_TEXT)
  })

  it('T2 the send returns delivered BEFORE the recipient long turn completes (durable intent + confirmation at send time; the later turn settlement writes nothing further)', () => {
    // The send outcome: delivered to the worker's bound session.
    expect(t2Outcome.status).toBe('delivered')
    expect(t2Outcome.rootSessionId).toBe(P6T3_ROOT)
    expect(t2Outcome.deliveredToInstanceId).toBe(P6T3_SEEDS.worker.instanceId)
    expect(t2Outcome.deliveredToSessionId).toBe(P6T3_SEEDS.worker.childSessionId)
    expect(t2Outcome.requestToken).toBe('tok-sml-t2')
    // THE LIVENESS PIN: the turn had NOT completed when the send returned
    // (the acceptance boundary, not the turn boundary).
    expect(t2TurnCompletedAtSend).toBe(false)
    expect(t2Port.inputs).toHaveLength(1)
    // The durable facts: exactly ONE intent + ONE confirmation, correlated
    // by the token + the intent sequence.
    expect(t2IntentFacts).toHaveLength(1)
    expect(t2ConfirmFacts).toHaveLength(1)
    expect(t2ConfirmFacts[0]!.sequence).toBe(t2Outcome.deliveredSequence)
    expect(t2IntentFacts[0]!.sequence).toBe(t2Outcome.factSequence)
  })

  it('T3 the two-agent reply cycle terminates: all three sends delivered, each with exactly one intent + one confirmation (no cross-Agent wait)', () => {
    expect(t3CycleError).toBeUndefined()
    expect(t3First).toBeDefined()
    expect(t3First!.status).toBe('delivered')
    expect(t3First!.deliveredToInstanceId).toBe(P6T3_SEEDS.worker.instanceId)
    // The cycle progressed BOTH directions: the accepts include the
    // Leader→A, the A→Leader reply, AND the Leader→A follow-up.
    expect(t3Accepts).toContain('tok-sml-t3-l2a')
    expect(t3Accepts).toContain('tok-sml-t3-a2l')
    expect(t3Accepts).toContain('tok-sml-t3-l2a-2')
    // Every send produced exactly ONE intent and ONE confirmation (the
    // exactly-once ledger semantics hold under the released Phase B).
    const intentTokens = t3Tokens(t3Intents)
    const confirmTokens = t3Tokens(t3Confirms)
    for (const token of ['tok-sml-t3-l2a', 'tok-sml-t3-a2l', 'tok-sml-t3-l2a-2']) {
      expect(intentTokens.filter((t) => t === token)).toHaveLength(1)
      expect(confirmTokens.filter((t) => t === token)).toHaveLength(1)
    }
    expect(t3Intents).toHaveLength(3)
    expect(t3Confirms).toHaveLength(3)
  })

  it('T4 acceptance failure stays fail-closed: MESSAGING_DELIVERY_FAILED, zero inputs, the intent durable with NO confirmation; recovery then delivers + confirms', () => {
    expect(t4Rejection.code).toBe(MESSAGING_ERROR_CODES.MESSAGING_DELIVERY_FAILED)
    // Nothing reached the session at the moment of the rejection (the
    // commit-or-throw contract).
    expect(t4InputCountAtRejection).toBe(0)
    // The recovery path (one code path with the live send) delivered the
    // input exactly once.
    expect(t4Port.inputs).toHaveLength(1)
    // The intent fact REMAINS durable (the coordination is recoverable);
    // NO confirmation fact exists yet.
    expect(t4IntentFacts).toHaveLength(1)
    expect(t4ConfirmBeforeRecovery).toHaveLength(0)
    // The restart-recovery scan (one code path) delivers + confirms it.
    expect(t4Recovery.recovered).toHaveLength(1)
    expect(t4Recovery.recovered[0]!.requestToken).toBe('tok-sml-t4')
    expect(t4Recovery.recovered[0]!.deliveredToInstanceId).toBe(P6T3_SEEDS.worker.instanceId)
    expect(t4Recovery.skipped).toEqual([])
    expect(t4ConfirmAfterRecovery).toHaveLength(1)
  })
})
