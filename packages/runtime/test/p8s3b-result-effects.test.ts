/**
 * P8-S3b (v2 D2, task C2) — the live glue's delivered-turn read + the
 * effect carriers of the frozen WorkDeliveryResult (C1 contract).
 *
 * This file is the C2 half of the D2 minimal result closure. C1 froze the
 * shared DTO (WorkDeliveryResult) and the chain-level carry (C1 pinned on
 * `executeWorkChain`, `p8s3-work-chain.test.ts`); C2 consumes it:
 *
 * - GLUE (the real `agent-bindings.mjs` over DSH service doubles, the
 *   t12a live-bridge module loader): `workDelivery.deliver` reads the
 *   delivered turn back through the public session seam
 *   (`Session.ownEvents()`) and normalizes it into the frozen
 *   WorkDeliveryResult — correlation by the token-prefixed user message
 *   the glue itself builds (`[team-work requestToken=<token>]`), the
 *   turn's `turn/end` reason as the authoritative outcome, and the turn's
 *   last non-empty `assistant/message` text as the business body.
 * - EFFECTS (`effects.ts`): the `work-admitted` and `member-activated`
 *   RuntimeActionEffect carriers expose the chain's `memberResult` to the
 *   Leader (the lossless tool/remote envelopes carry it verbatim), and
 *   `runWorkChainOn` propagates `ctx.request.signal` into the chain
 *   (frozen C1 decision; the delegate-create path already did).
 *
 * Pinned (the task C2 acceptance matrix):
 * - G1  succeeded: completed turn + readable non-empty assistant body ->
 *        status=succeeded + the business body (the Leader-facing effect
 *        carries it, E1/E2);
 * - G2  unavailable: completed-without-body -> status=unavailable
 *        (WORK_NO_ASSISTANT_BODY), NEVER succeeded;
 * - G3  failed: turn reason error (code from the carried LlmFailure;
 *        WORK_TURN_ERROR when none) / aborted (WORK_TURN_ABORTED) /
 *        max-tokens (WORK_TURN_MAX_TOKENS) / blocked (WORK_TURN_BLOCKED);
 * - G7  requestToken correlation: the echoed token equals the request
 *        token; a multi-turn child log correlates the result to THIS
 *        delivery's message, not the last turn;
 * - G8  defensive unreadability (no attributable turn) -> unavailable
 *        with a stable code, never succeeded, never a throw;
 * - G9  the fail-closed throw contract is unchanged: a whenIdle rejection
 *        (and a pre-aborted signal, which cancels the live turn) still
 *        rejects — no result is formed on the throw path;
 * - G10 the delivered text is unchanged (token prefix + attached-context
 *        block) — the correlation point is exactly the message the glue
 *        builds;
 * - E1  delegate success: the member-activated effect carries
 *        status=succeeded + the member business body;
 * - E2  follow-up success: the work-admitted effect carries it;
 * - E3  delivery failure: status=failed with the stable code rides the
 *        effect;
 * - E4  unavailable: completed-without-body maps to unavailable, NOT
 *        succeeded, on the effect;
 * - E5  requestToken echo: the effect's memberResult echoes the request
 *        token verbatim;
 * - E6  replay: an already-settled token yields the SAME synthesized
 *        unavailable/WORK_REPLAYED result with no double delivery;
 * - E7  settled separation: the control-plane settled flag never by
 *        itself produces succeeded (failed/unavailable/replay effects all
 *        carry settled=true with status !== 'succeeded').
 *
 * House pattern of the runtime package: async world construction and
 * action execution at the TOP LEVEL (one bare block per scenario); every
 * `it` below asserts the captured constants synchronously (the plain-node
 * shim supports no async `it`).
 *
 * The glue-level doubles mirror the t12a live-bridge surface (agents /
 * sessionPersistence / domain) with ONE addition this file needs: the
 * handle's `session` double exposes `ownEvents()` returning the scripted
 * session-log events — the exact public read seam A4 identified
 * (references/deepseek-harness-test-use @ 76fda729:
 * `packages/core/session/src/index.ts:615`). The shared bridge file is
 * NOT modified: this file imports its exported `loadGlueModule` and
 * `createDomainDouble` and carries its own scripted agents double.
 *
 * @module @dsh-agent-team/runtime/test/p8s3b-result-effects
 */

import { describe, expect, it } from 'vitest'
import { createTeamRuntime } from '../action-router/index.js'
import type {
  RuntimeActionEffect,
  TeamRuntime,
  TeamRuntimeActionOutcome,
  WorkDeliveryPort,
  WorkDeliveryResult,
} from '../admission/index.js'
import { createWorkActivityWriter } from '../activity/index.js'
import { destroyP6T1World } from './p6t1-helpers.js'
import type { P6T1World } from './p6t1-helpers.js'
import {
  P6T2_NOW,
  P6T2_ROOT,
  P6T2_SEEDS,
  createFakeLifecycleCommitPort,
  createP6T2World,
  makeActionRequest,
} from './p6t2-helpers.js'
import { createDomainDouble, loadGlueModule } from './t12a-live-bridge.mjs'

const WORKER_ID = String(P6T2_SEEDS.worker.instanceId)

/** The work-delivery port fake (records the exact submit calls and
 *  returns the armed WorkDeliveryResult — the v2 C1 frozen shape). */
interface FakeDeliveryPort {
  readonly port: WorkDeliveryPort
  readonly calls: {
    readonly rootSessionId: string
    readonly instanceId: string
    readonly childSessionId: string
    readonly requestToken: string
    readonly prompt: string
    readonly attachedContext?: string
    readonly signal?: unknown
  }[]
  /** Arm the exact result the next successful delivery returns (default:
   *  a succeeded result with a deterministic business body). */
  armResult(result: WorkDeliveryResult): void
}

function createFakeDeliveryPort(): FakeDeliveryPort {
  const calls: FakeDeliveryPort['calls'] = []
  let armed: WorkDeliveryResult | undefined
  const port: WorkDeliveryPort = {
    async deliver(args) {
      calls.push({ ...args })
      return (
        armed ?? {
          requestToken: args.requestToken,
          status: 'succeeded',
          body: 'fake member business body',
        }
      )
    },
  }
  return {
    port,
    calls,
    armResult(result: WorkDeliveryResult) {
      armed = result
    },
  }
}

function createWorkChainRuntime(
  world: P6T1World,
  delivery: WorkDeliveryPort,
): TeamRuntime {
  return createTeamRuntime({
    teamDomain: world.domain,
    activationProvider: world.provider,
    blueprintCatalog: world.catalog,
    environmentFacts: world.ports.environmentFacts,
    externalPolicyFacts: world.ports.externalPolicyFacts,
    now: () => P6T2_NOW,
    lifecycleCommit: createFakeLifecycleCommitPort(world),
    workDelivery: delivery,
    workActivity: createWorkActivityWriter({ teamDomain: world.domain, now: () => P6T2_NOW }),
  })
}

function asWorkAdmitted(outcome: TeamRuntimeActionOutcome): Extract<RuntimeActionEffect, { readonly kind: 'work-admitted' }> {
  const effect = outcome.effect
  if (effect.kind !== 'work-admitted') {
    throw new Error(`asWorkAdmitted: expected work-admitted, got ${effect.kind}`)
  }
  return effect
}

function asMemberActivated(outcome: TeamRuntimeActionOutcome): Extract<RuntimeActionEffect, { readonly kind: 'member-activated' }> {
  const effect = outcome.effect
  if (effect.kind !== 'member-activated') {
    throw new Error(`asMemberActivated: expected member-activated, got ${effect.kind}`)
  }
  return effect
}

function ledgerCount(world: P6T1World): number {
  return world.domain.repositories.ledger.list().length
}

// ── the scripted agents double (the glue-level read seam) ─────────────────────

/** The session-log event envelope (upstream `SessionEvent`: `{ type, seq,
 *  time, data }` — the payload rides in `data`). */
interface ScriptedEvent {
  readonly type: string
  readonly seq: number
  readonly time: number
  readonly data: Record<string, unknown>
}

function makeEventFactory(): { ev: (type: string, data: Record<string, unknown>) => ScriptedEvent } {
  let seq = 0
  return {
    ev(type: string, data: Record<string, unknown>): ScriptedEvent {
      return { type, seq: seq++, time: 1, data }
    },
  }
}

function userMessageData(text: string): Record<string, unknown> {
  return {
    id: `msg-${Math.random().toString(36).slice(2)}`,
    role: 'user',
    content: [{ type: 'text', text }],
    source: { kind: 'user' },
  }
}

/** One assistant-message payload; `text === null` scripts an EMPTY content
 *  array (the completed-without-body case). */
function assistantMessageData(turn: number, step: number, text: string | null): Record<string, unknown> {
  return {
    turn,
    step,
    message: {
      id: `msg-${Math.random().toString(36).slice(2)}`,
      role: 'assistant',
      content: text === null ? [] : [{ type: 'text', text }],
      source: { kind: 'model' },
    },
  }
}

/** One agent-scoped ctx double (the same surface the t12a bridge uses —
 *  the glue's agentSetup callback consumes on/plugin/tools/systemPrompt). */
function makeAgentCtx(globalSections: readonly { name: string; order: number; text: string }[]) {
  const listeners: { event: string; listener: unknown; active: boolean }[] = []
  const registeredTools: unknown[] = []
  const plugins: unknown[] = []
  const scopedSections: { name: string; order: number; text: string; disposed: boolean }[] = []
  return {
    listeners,
    on(event: string, listener: unknown) {
      const entry = { event, listener, active: true }
      listeners.push(entry)
      return () => {
        entry.active = false
      }
    },
    plugin(pluginSpec: unknown) {
      plugins.push(pluginSpec)
      const fiber = {
        then(onfulfilled: (value: unknown) => unknown) {
          return Promise.resolve(fiber).then(onfulfilled)
        },
        catch() {
          return Promise.resolve(fiber)
        },
      }
      return fiber
    },
    tools: {
      register(def: unknown) {
        registeredTools.push(def)
        return () => {
          const i = registeredTools.indexOf(def)
          if (i !== -1) registeredTools.splice(i, 1)
        }
      },
      execute(call: unknown) {
        return Promise.resolve({ ok: true, callId: (call as { callId?: unknown })?.callId })
      },
    },
    systemPrompt: {
      globals: globalSections,
      section(spec: { name: string; order: number; text: unknown }) {
        const existing = scopedSections.find((entry) => !entry.disposed && entry.name === spec.name)
        if (existing !== undefined) {
          throw new Error(`systemPrompt.section: duplicate scoped section name '${spec.name}' in one agent scope`)
        }
        const entry = { name: spec.name, order: spec.order, text: String(spec.text ?? ''), disposed: false }
        scopedSections.push(entry)
        return () => {
          entry.disposed = true
        }
      },
      assemble() {
        type SectionView = { name: string; order: number; text: string; scope: 'global' | 'scoped' }
        const globalViews: SectionView[] = globalSections.map((section) => ({ ...section, scope: 'global' as const }))
        const scopedViews: SectionView[] = scopedSections
          .filter((entry) => !entry.disposed)
          .map((entry) => ({ name: entry.name, order: entry.order, text: entry.text, scope: 'scoped' as const }))
        return [...globalViews, ...scopedViews].sort((a, b) => a.order - b.order)
      },
    },
  }
}

/** The agents service double with the scripted session read seam: the
 *  handle's `session` exposes the PUBLIC `ownEvents()` read (upstream
 *  `Session.ownEvents`, core/session src/index.ts:615) returning the
 *  events scripted per session id. */
function createScriptedAgentsDouble(options: {
  readonly whenIdleBehavior?: (agent: object) => Promise<void>
  /** Script the session double WITHOUT the log-read seam (the defensive
   *  seam-unavailable case: the glue must map it to explicit unavailable). */
  readonly sessionWithoutOwnEvents?: boolean
} = {}) {
  const creates: { sessionId: string; meta: unknown; setupProvided: boolean }[] = []
  const resumes: { sessionId: string; setupProvided: boolean }[] = []
  const followups: { sessionId: string; message: unknown }[] = []
  const cancels: { sessionId: string; args: unknown }[] = []
  const eventsBySession = new Map<string, readonly ScriptedEvent[]>()
  const whenIdleBehavior = options.whenIdleBehavior ?? (() => Promise.resolve())
  const globalSections: { name: string; order: number; text: string }[] = [
    { name: 'harness:identity', order: -1000, text: 'You are an AI agent powered by DeepSeek Harness.' },
    { name: 'deployment:persona', order: 0, text: '' },
  ]
  function makeHandle(sessionId: string) {
    const ctx = makeAgentCtx(globalSections)
    const session = options.sessionWithoutOwnEvents === true
      ? { id: sessionId }
      : {
          id: sessionId,
          ownEvents(): readonly ScriptedEvent[] {
            return eventsBySession.get(sessionId) ?? []
          },
        }
    const agent = {
      session,
      ctx,
      followup(message: unknown) {
        followups.push({ sessionId, message })
      },
      whenIdle() {
        return whenIdleBehavior(agent)
      },
      cancel(args: unknown) {
        cancels.push({ sessionId, args })
      },
    }
    return { agent, dispose: () => Promise.resolve() }
  }
  return {
    creates,
    resumes,
    followups,
    cancels,
    eventsBySession,
    scriptEvents(sessionId: string, events: readonly ScriptedEvent[]) {
      eventsBySession.set(sessionId, events)
    },
    async create(req: { sessionId: unknown; meta?: unknown; setup?: (ctx: unknown) => Promise<void> | void }) {
      const sessionId = String(req.sessionId)
      creates.push({ sessionId, meta: req.meta, setupProvided: req.setup !== undefined })
      const handle = makeHandle(sessionId)
      if (req.setup !== undefined) await req.setup(handle.agent.ctx)
      return handle
    },
    async resume(req: { resumeSessionId: unknown; setup?: (ctx: unknown) => Promise<void> | void }) {
      const sessionId = String(req.resumeSessionId)
      resumes.push({ sessionId, setupProvided: req.setup !== undefined })
      const handle = makeHandle(sessionId)
      if (req.setup !== undefined) await req.setup(handle.agent.ctx)
      return handle
    },
  }
}

/** One glue world: the REAL agent-bindings.mjs over the doubles. */
interface GlueWorld {
  readonly rootSessionId: string
  readonly binding: {
    createRootAgent(rootSessionId: string): Promise<void>
    readonly workDelivery: {
      deliver(args: {
        rootSessionId: string
        instanceId: string
        childSessionId: string
        requestToken: string
        prompt: string
        attachedContext?: string
        signal?: unknown
      }): Promise<unknown>
    }
  }
  readonly agents: ReturnType<typeof createScriptedAgentsDouble>
  readonly sessionPersistence: { readonly materialized: string[] }
}

async function createGlueWorld(params: {
  readonly rootSessionId: string
  readonly events?: (factory: { ev: (type: string, data: Record<string, unknown>) => ScriptedEvent }) => readonly ScriptedEvent[]
  readonly whenIdleBehavior?: (agent: object) => Promise<void>
  readonly sessionWithoutOwnEvents?: boolean
}): Promise<GlueWorld> {
  const glue = await loadGlueModule()
  const rootSessionId = params.rootSessionId
  const agents = createScriptedAgentsDouble({
    whenIdleBehavior: params.whenIdleBehavior,
    sessionWithoutOwnEvents: params.sessionWithoutOwnEvents,
  })
  const sessionPersistence = {
    materialized: [] as string[],
    ensureMaterialized(session: { id: unknown }) {
      sessionPersistence.materialized.push(String(session.id))
      return Promise.resolve()
    },
  }
  const domain = await createDomainDouble({
    teamSession: {
      rootSessionId,
      sessionId: rootSessionId,
      blueprintId: 'team.p8s3b',
      generation: 1,
      defaultWorkspace: '/ws/p8s3b',
    },
  })
  const config = {
    bootPhase: 'create',
    rootSessionId,
    blueprintSource: [
      '---',
      'schemaVersion: 1',
      'blueprintId: team.p8s3b',
      'revision: "1"',
      'leader:',
      '  templateId: leader',
      '  persona: "You are the leader of the p8s3b test team."',
      'members:',
      '  - templateId: tpl-p8s3b',
      '    persona: "You are member tpl-p8s3b of the p8s3b test team."',
      'requirements: []',
      'memberEnvelopes: []',
      'policyStates: []',
      'metadata: {}',
      '---',
      '',
    ].join('\n'),
    generation: 1,
    defaultWorkspace: '/cfg/p8s3b-default',
    seedMembers: [],
    staticModel: { provider: 'p8s3b-baseline', model: 'p8s3b-baseline-model' },
    deniedSelection: { provider: 'p8s3b-denied', model: 'p8s3b-denied-model' },
    mcpServer: { name: 'p8s3b-mini-mcp', port: 3999 },
    environmentFacts: [],
    externalPolicyFacts: { hard: {}, capabilityExists: {} },
  }
  const teamToolsRef = { current: undefined }
  const now = () => '2026-08-31T00:00:00.000Z'
  const binding = glue.createAgentBindings({
    agents,
    sessionPersistence,
    domain,
    config,
    teamToolsRef,
    now,
  })
  if (params.events !== undefined) {
    agents.scriptEvents(rootSessionId, params.events(makeEventFactory()))
  }
  return { rootSessionId, binding: binding as GlueWorld['binding'], agents, sessionPersistence }
}

function deliveredText(world: GlueWorld, index: number): string {
  const entry = world.agents.followups[index]
  if (entry === undefined) {
    throw new Error(`deliveredText(${index}): only ${world.agents.followups.length} followups recorded`)
  }
  const content = (entry.message as { content?: readonly { text?: string }[] }).content
  return content?.[0]?.text ?? '(no text part)'
}

/** The frozen replay synthesis (task C1; the identical literal the chain
 *  synthesizes for every replay of an already-settled token). */
function frozenReplayResult(requestToken: string): WorkDeliveryResult {
  return {
    requestToken,
    status: 'unavailable',
    error: {
      code: 'WORK_REPLAYED',
      message: 'work unit already settled (settlement fact present); original result not re-reported',
    },
  }
}

// ── captured cases (house pattern: top-level execution, sync assertions) ──────

/** G1: succeeded with the business body (the last non-empty assistant text). */
interface G1Case {
  readonly result: unknown
  readonly followups: number
  readonly materialized: number
}
/** G2: completed-without-body -> unavailable, never succeeded. */
interface G2Case {
  readonly noMessage: unknown
  readonly emptyBody: unknown
}
/** G3: failed with the stable code (LlmFailure code honored; default
 *  WORK_TURN_ERROR when the failure carries none). */
interface G3Case {
  readonly withFailureCode: unknown
  readonly withoutFailureCode: unknown
}
/** G4/G5/G6: the explicit failed reasons. */
interface G456Case {
  readonly aborted: unknown
  readonly maxTokens: unknown
  readonly blocked: unknown
}
/** G7: token correlation across a multi-turn child log. */
interface G7Case {
  readonly mine: unknown
  readonly other: unknown
}
/** G8: defensive unreadability -> unavailable, stable code, no throw. */
interface G8Case {
  readonly noDeliveredMessage: unknown
  readonly noTurnEnd: unknown
}
/** G9: the fail-closed throw contract is unchanged. */
interface G9Case {
  readonly idleRejectError: string
  readonly idleRejectMaterialized: number
  readonly preAbortedError: string
  readonly preAbortedCancels: number
}
/** G10: the delivered text is unchanged (the correlation point). */
interface G10Case {
  readonly plainText: string
  readonly attachedText: string
}
/** G11: a session handle without the log-read seam -> explicit unavailable
 *  (the seam cannot determine the outcome; never succeeded, never a throw). */
interface G11Case {
  readonly result: unknown
}

/** E1: the Leader-facing member-activated effect carries the succeeded
 *  result + body. */
interface E1Case {
  readonly status: string | undefined
  readonly body: string | undefined
  readonly token: string | undefined
  readonly errorAbsent: boolean
  readonly workSettled: boolean | undefined
}
/** E2: the Leader-facing work-admitted effect carries the succeeded
 *  result + body. */
interface E2Case {
  readonly status: string | undefined
  readonly body: string | undefined
  readonly token: string | undefined
  readonly errorAbsent: boolean
  readonly settled: boolean | undefined
}
/** E3/E4/E7: failed + unavailable ride the effect; settled separation. */
interface E34Case {
  readonly failedStatus: string | undefined
  readonly failedCode: string | undefined
  readonly failedMessage: string | undefined
  readonly failedBody: string | undefined
  readonly failedToken: string | undefined
  readonly failedSettled: boolean | undefined
  readonly unavailableStatus: string | undefined
  readonly unavailableCode: string | undefined
  readonly unavailableBody: string | undefined
  readonly unavailableToken: string | undefined
  readonly unavailableSettled: boolean | undefined
}
/** E6: replay = the SAME synthesized result, exactly once, no re-delivery. */
interface E6Case {
  readonly firstStatus: string | undefined
  readonly firstBody: string | undefined
  readonly firstSettled: boolean | undefined
  readonly firstReplayed: boolean | undefined
  readonly secondStatus: string | undefined
  readonly secondReplayed: boolean | undefined
  readonly secondSettled: boolean | undefined
  readonly secondResult: WorkDeliveryResult | undefined
  readonly secondEqualsFrozen: boolean
  readonly deliveries: number
  readonly ledgerUnchanged: boolean
  readonly sameSequence: boolean
}

let g1: G1Case
let g2: G2Case
let g3: G3Case
let g456: G456Case
let g7: G7Case
let g8: G8Case
let g9: G9Case
let g10: G10Case
let g11: G11Case
let e1: E1Case
let e2: E2Case
let e34: E34Case
let e6: E6Case

// ── G1: succeeded with the business body ─────────────────────────────────────

{
  const world = await createGlueWorld({
    rootSessionId: 'session-p8s3b-g1',
    events: ({ ev }) => [
      ev('turn/start', { turn: 1 }),
      ev('user/message', userMessageData('[team-work requestToken=tok-p8s3b-g1] answer the brief')),
      ev('assistant/message', assistantMessageData(1, 1, 'the member business answer')),
      ev('turn/end', { turn: 1, reason: { kind: 'completed' } }),
    ],
  })
  await world.binding.createRootAgent(world.rootSessionId)
  const result = await world.binding.workDelivery.deliver({
    rootSessionId: world.rootSessionId,
    instanceId: 'inst-leader',
    childSessionId: world.rootSessionId,
    requestToken: 'tok-p8s3b-g1',
    prompt: 'answer the brief',
  })
  g1 = {
    result,
    followups: world.agents.followups.length,
    materialized: world.sessionPersistence.materialized.length,
  }
}

// ── G2: completed-without-body -> unavailable (never succeeded) ──────────────

{
  const world = await createGlueWorld({
    rootSessionId: 'session-p8s3b-g2',
    events: ({ ev }) => [
      // turn 1: completed, NO assistant message at all
      ev('turn/start', { turn: 1 }),
      ev('user/message', userMessageData('[team-work requestToken=tok-p8s3b-g2a] first bodyless turn')),
      ev('turn/end', { turn: 1, reason: { kind: 'completed' } }),
      // turn 2: completed, assistant message with EMPTY text content
      ev('turn/start', { turn: 2 }),
      ev('user/message', userMessageData('[team-work requestToken=tok-p8s3b-g2b] second bodyless turn')),
      ev('assistant/message', assistantMessageData(2, 1, null)),
      ev('turn/end', { turn: 2, reason: { kind: 'completed' } }),
    ],
  })
  await world.binding.createRootAgent(world.rootSessionId)
  const noMessage = await world.binding.workDelivery.deliver({
    rootSessionId: world.rootSessionId,
    instanceId: 'inst-leader',
    childSessionId: world.rootSessionId,
    requestToken: 'tok-p8s3b-g2a',
    prompt: 'first bodyless turn',
  })
  const emptyBody = await world.binding.workDelivery.deliver({
    rootSessionId: world.rootSessionId,
    instanceId: 'inst-leader',
    childSessionId: world.rootSessionId,
    requestToken: 'tok-p8s3b-g2b',
    prompt: 'second bodyless turn',
  })
  g2 = { noMessage, emptyBody }
}

// ── G3: failed — turn reason error (LlmFailure code honored / default) ───────

{
  const world = await createGlueWorld({
    rootSessionId: 'session-p8s3b-g3',
    events: ({ ev }) => [
      ev('turn/start', { turn: 1 }),
      ev('user/message', userMessageData('[team-work requestToken=tok-p8s3b-g3a] failing turn with code')),
      ev('turn/end', {
        turn: 1,
        reason: { kind: 'error', error: { message: 'upstream provider exploded', code: 'PROVIDER_UNAVAILABLE' } },
      }),
      ev('turn/start', { turn: 2 }),
      ev('user/message', userMessageData('[team-work requestToken=tok-p8s3b-g3b] failing turn without code')),
      ev('turn/end', {
        turn: 2,
        reason: { kind: 'error', error: { message: 'the model call failed without a stable code' } },
      }),
    ],
  })
  await world.binding.createRootAgent(world.rootSessionId)
  const withFailureCode = await world.binding.workDelivery.deliver({
    rootSessionId: world.rootSessionId,
    instanceId: 'inst-leader',
    childSessionId: world.rootSessionId,
    requestToken: 'tok-p8s3b-g3a',
    prompt: 'failing turn with code',
  })
  const withoutFailureCode = await world.binding.workDelivery.deliver({
    rootSessionId: world.rootSessionId,
    instanceId: 'inst-leader',
    childSessionId: world.rootSessionId,
    requestToken: 'tok-p8s3b-g3b',
    prompt: 'failing turn without code',
  })
  g3 = { withFailureCode, withoutFailureCode }
}

// ── G4/G5/G6: the explicit failed reasons ────────────────────────────────────

{
  const world = await createGlueWorld({
    rootSessionId: 'session-p8s3b-g456',
    events: ({ ev }) => [
      ev('turn/start', { turn: 1 }),
      ev('user/message', userMessageData('[team-work requestToken=tok-p8s3b-g4] aborted turn')),
      ev('turn/end', { turn: 1, reason: { kind: 'aborted', reason: { kind: 'user' } } }),
      ev('turn/start', { turn: 2 }),
      ev('user/message', userMessageData('[team-work requestToken=tok-p8s3b-g5] truncated turn')),
      ev('turn/end', { turn: 2, reason: { kind: 'max-tokens' } }),
      ev('turn/start', { turn: 3 }),
      ev('user/message', userMessageData('[team-work requestToken=tok-p8s3b-g6] blocked turn')),
      ev('turn/end', { turn: 3, reason: { kind: 'blocked' } }),
    ],
  })
  await world.binding.createRootAgent(world.rootSessionId)
  const aborted = await world.binding.workDelivery.deliver({
    rootSessionId: world.rootSessionId,
    instanceId: 'inst-leader',
    childSessionId: world.rootSessionId,
    requestToken: 'tok-p8s3b-g4',
    prompt: 'aborted turn',
  })
  const maxTokens = await world.binding.workDelivery.deliver({
    rootSessionId: world.rootSessionId,
    instanceId: 'inst-leader',
    childSessionId: world.rootSessionId,
    requestToken: 'tok-p8s3b-g5',
    prompt: 'truncated turn',
  })
  const blocked = await world.binding.workDelivery.deliver({
    rootSessionId: world.rootSessionId,
    instanceId: 'inst-leader',
    childSessionId: world.rootSessionId,
    requestToken: 'tok-p8s3b-g6',
    prompt: 'blocked turn',
  })
  g456 = { aborted, maxTokens, blocked }
}

// ── G7: requestToken correlation across a multi-turn child log ───────────────

{
  const world = await createGlueWorld({
    rootSessionId: 'session-p8s3b-g7',
    events: ({ ev }) => [
      ev('turn/start', { turn: 1 }),
      ev('user/message', userMessageData('[team-work requestToken=tok-p8s3b-other] other request')),
      ev('assistant/message', assistantMessageData(1, 1, 'other body')),
      ev('turn/end', { turn: 1, reason: { kind: 'completed' } }),
      ev('turn/start', { turn: 2 }),
      ev('user/message', userMessageData('[team-work requestToken=tok-p8s3b-g7] my request')),
      ev('assistant/message', assistantMessageData(2, 1, 'mine body')),
      ev('turn/end', { turn: 2, reason: { kind: 'completed' } }),
    ],
  })
  await world.binding.createRootAgent(world.rootSessionId)
  const mine = await world.binding.workDelivery.deliver({
    rootSessionId: world.rootSessionId,
    instanceId: 'inst-leader',
    childSessionId: world.rootSessionId,
    requestToken: 'tok-p8s3b-g7',
    prompt: 'my request',
  })
  const other = await world.binding.workDelivery.deliver({
    rootSessionId: world.rootSessionId,
    instanceId: 'inst-leader',
    childSessionId: world.rootSessionId,
    requestToken: 'tok-p8s3b-other',
    prompt: 'other request',
  })
  g7 = { mine, other }
}

// ── G8: defensive unreadability -> unavailable, stable code, no throw ────────

{
  const worldNoMsg = await createGlueWorld({
    rootSessionId: 'session-p8s3b-g8a',
    events: ({ ev }) => [
      ev('turn/start', { turn: 1 }),
      ev('user/message', userMessageData('an ordinary message without the team-work prefix')),
      ev('assistant/message', assistantMessageData(1, 1, 'ordinary answer')),
      ev('turn/end', { turn: 1, reason: { kind: 'completed' } }),
    ],
  })
  await worldNoMsg.binding.createRootAgent(worldNoMsg.rootSessionId)
  const noDeliveredMessage = await worldNoMsg.binding.workDelivery.deliver({
    rootSessionId: worldNoMsg.rootSessionId,
    instanceId: 'inst-leader',
    childSessionId: worldNoMsg.rootSessionId,
    requestToken: 'tok-p8s3b-g8a',
    prompt: 'a prompt that never reached the log',
  })

  const worldNoEnd = await createGlueWorld({
    rootSessionId: 'session-p8s3b-g8b',
    events: ({ ev }) => [
      ev('turn/start', { turn: 1 }),
      ev('user/message', userMessageData('[team-work requestToken=tok-p8s3b-g8b] a turn that never closed')),
      ev('assistant/message', assistantMessageData(1, 1, 'a dangling answer')),
    ],
  })
  await worldNoEnd.binding.createRootAgent(worldNoEnd.rootSessionId)
  const noTurnEnd = await worldNoEnd.binding.workDelivery.deliver({
    rootSessionId: worldNoEnd.rootSessionId,
    instanceId: 'inst-leader',
    childSessionId: worldNoEnd.rootSessionId,
    requestToken: 'tok-p8s3b-g8b',
    prompt: 'a turn that never closed',
  })

  g8 = { noDeliveredMessage, noTurnEnd }
}

// ── G9: the fail-closed throw contract is unchanged ──────────────────────────

{
  // a whenIdle rejection propagates — no result is formed (the throw IS
  // the signal; the chain settles fail-closed on it).
  const worldIdle = await createGlueWorld({
    rootSessionId: 'session-p8s3b-g9a',
    events: ({ ev }) => [
      ev('turn/start', { turn: 1 }),
      ev('user/message', userMessageData('[team-work requestToken=tok-p8s3b-g9a] doomed turn')),
      ev('turn/end', { turn: 1, reason: { kind: 'completed' } }),
    ],
    whenIdleBehavior: () => Promise.reject(new Error('idle seam down')),
  })
  await worldIdle.binding.createRootAgent(worldIdle.rootSessionId)
  let idleRejectError: string
  try {
    await worldIdle.binding.workDelivery.deliver({
      rootSessionId: worldIdle.rootSessionId,
      instanceId: 'inst-leader',
      childSessionId: worldIdle.rootSessionId,
      requestToken: 'tok-p8s3b-g9a',
      prompt: 'doomed turn',
    })
    idleRejectError = '(did not reject)'
  } catch (error) {
    idleRejectError = error instanceof Error ? error.message : String(error)
  }

  // a pre-aborted signal cancels the live turn and rejects with the
  // caller's reason (explicit failure, never a disguised success).
  const worldAbort = await createGlueWorld({
    rootSessionId: 'session-p8s3b-g9b',
    events: ({ ev }) => [
      ev('turn/start', { turn: 1 }),
      ev('user/message', userMessageData('[team-work requestToken=tok-p8s3b-g9b] aborted turn')),
      ev('turn/end', { turn: 1, reason: { kind: 'aborted', reason: { kind: 'user' } } }),
    ],
  })
  await worldAbort.binding.createRootAgent(worldAbort.rootSessionId)
  let preAbortedError: string
  try {
    await worldAbort.binding.workDelivery.deliver({
      rootSessionId: worldAbort.rootSessionId,
      instanceId: 'inst-leader',
      childSessionId: worldAbort.rootSessionId,
      requestToken: 'tok-p8s3b-g9b',
      prompt: 'aborted turn',
      signal: {
        aborted: true,
        reason: new Error('caller aborted before delivery'),
        addEventListener() {},
        removeEventListener() {},
      },
    })
    preAbortedError = '(did not reject)'
  } catch (error) {
    preAbortedError = error instanceof Error ? error.message : String(error)
  }

  g9 = {
    idleRejectError,
    idleRejectMaterialized: worldIdle.sessionPersistence.materialized.length,
    preAbortedError,
    preAbortedCancels: worldAbort.agents.cancels.length,
  }
}

// ── G10: the delivered text is unchanged (the correlation point) ─────────────

{
  const world = await createGlueWorld({
    rootSessionId: 'session-p8s3b-g10',
    events: ({ ev }) => [
      ev('turn/start', { turn: 1 }),
      ev('user/message', userMessageData('[team-work requestToken=tok-p8s3b-g10] plain prompt')),
      ev('assistant/message', assistantMessageData(1, 1, 'plain answer')),
      ev('turn/end', { turn: 1, reason: { kind: 'completed' } }),
      ev('turn/start', { turn: 2 }),
      ev('user/message', userMessageData('[team-work requestToken=tok-p8s3b-g10b] plain prompt\n\n[attached-context]\nctx-block')),
      ev('assistant/message', assistantMessageData(2, 1, 'attached answer')),
      ev('turn/end', { turn: 2, reason: { kind: 'completed' } }),
    ],
  })
  await world.binding.createRootAgent(world.rootSessionId)
  await world.binding.workDelivery.deliver({
    rootSessionId: world.rootSessionId,
    instanceId: 'inst-leader',
    childSessionId: world.rootSessionId,
    requestToken: 'tok-p8s3b-g10',
    prompt: 'plain prompt',
  })
  const plainText = world.agents.followups.length > 0 ? deliveredText(world, 0) : '(none)'
  await world.binding.workDelivery.deliver({
    rootSessionId: world.rootSessionId,
    instanceId: 'inst-leader',
    childSessionId: world.rootSessionId,
    requestToken: 'tok-p8s3b-g10b',
    prompt: 'plain prompt',
    attachedContext: 'ctx-block',
  })
  const attachedText = world.agents.followups.length > 1 ? deliveredText(world, 1) : '(none)'
  g10 = { plainText, attachedText }
}

// ── G11: a session without the log-read seam -> explicit unavailable ──────────

{
  // The delivered turn COMPLETED (the scripted events prove it), but the
  // handle's session object exposes no ownEvents seam at all — the glue
  // must degrade to an explicit unavailable (the frozen vocabulary's
  // "the seam cannot determine the outcome"), never a throw, never
  // succeeded. This is the defensive seam branch (the production Session
  // always exposes ownEvents; the branch exists so a seam regression
  // cannot crash the settlement or disguise itself as a success).
  const world = await createGlueWorld({
    rootSessionId: 'session-p8s3b-g11',
    events: ({ ev }) => [
      ev('turn/start', { turn: 1 }),
      ev('user/message', userMessageData('[team-work requestToken=tok-p8s3b-g11] seamless turn')),
      ev('assistant/message', assistantMessageData(1, 1, 'an answer that cannot be read')),
      ev('turn/end', { turn: 1, reason: { kind: 'completed' } }),
    ],
    sessionWithoutOwnEvents: true,
  })
  await world.binding.createRootAgent(world.rootSessionId)
  const seamless = await world.binding.workDelivery.deliver({
    rootSessionId: world.rootSessionId,
    instanceId: 'inst-leader',
    childSessionId: world.rootSessionId,
    requestToken: 'tok-p8s3b-g11',
    prompt: 'seamless turn',
  })
  g11 = { result: seamless }
}

// ── E1/E2: the Leader-facing effects carry the succeeded result ──────────────

// ── E1: the Leader-facing member-activated effect (delegate success) ─────────

{
  // leader only: the delegate CREATES the first worker (the activated path
  // of the provider — a seeded worker would be CONTINUED as work-admitted).
  const world = await createP6T2World('p8s3b-e1', ['leader'])
  try {
    const delivery = createFakeDeliveryPort()
    delivery.armResult({
      requestToken: 'tok-p8s3b-e1',
      status: 'succeeded',
      body: 'delegate member answer',
    })
    const runtime = createWorkChainRuntime(world, delivery.port)
    const delegateOutcome = await runtime.performAction(
      makeActionRequest({
        action: 'delegate',
        delegationTemplateId: 'worker',
        requestToken: 'tok-p8s3b-e1',
        payload: { label: 'p8s3b-delegatee', prompt: 'p8s3b delegate prompt' },
      }),
    )
    const delegateEffect = asMemberActivated(delegateOutcome)
    e1 = {
      status: delegateEffect.memberResult?.status,
      body: delegateEffect.memberResult?.body,
      token: delegateEffect.memberResult?.requestToken,
      errorAbsent: delegateEffect.memberResult?.error === undefined,
      workSettled: delegateEffect.workSettled,
    }
  } finally {
    await destroyP6T1World(world)
  }
}

// ── E2: the Leader-facing work-admitted effect (follow-up success) ───────────

{
  const world = await createP6T2World('p8s3b-e2', ['leader', 'worker'])
  try {
    const delivery = createFakeDeliveryPort()
    delivery.armResult({
      requestToken: 'tok-p8s3b-e2',
      status: 'succeeded',
      body: 'follow-up member answer',
    })
    const outcome = await runtime_perform(world, delivery.port, 'tok-p8s3b-e2', 'p8s3b follow-up prompt')
    const followEffect = asWorkAdmitted(outcome)
    e2 = {
      status: followEffect.memberResult?.status,
      body: followEffect.memberResult?.body,
      token: followEffect.memberResult?.requestToken,
      errorAbsent: followEffect.memberResult?.error === undefined,
      settled: followEffect.settled,
    }
  } finally {
    await destroyP6T1World(world)
  }
}

// ── E3/E4/E7: failed + unavailable ride the effect (settled separation) ──────

{
  const world = await createP6T2World('p8s3b-e34', ['leader', 'worker'])
  try {
    const delivery = createFakeDeliveryPort()
    delivery.armResult({
      requestToken: 'tok-p8s3b-e3',
      status: 'failed',
      error: { code: 'WORK_TURN_ERROR', message: 'llm call failed (contained in the turn)' },
    })
    const failedOutcome = await runtime_perform(world, delivery.port, 'tok-p8s3b-e3', 'p8s3b failing prompt')
    delivery.armResult({
      requestToken: 'tok-p8s3b-e4',
      status: 'unavailable',
      error: { code: 'WORK_NO_ASSISTANT_BODY', message: 'no assistant text in the delivered turn' },
    })
    const unavailableOutcome = await runtime_perform(world, delivery.port, 'tok-p8s3b-e4', 'p8s3b bodyless prompt')
    const failedEffect = asWorkAdmitted(failedOutcome)
    const unavailableEffect = asWorkAdmitted(unavailableOutcome)
    e34 = {
      failedStatus: failedEffect.memberResult?.status,
      failedCode: failedEffect.memberResult?.error?.code,
      failedMessage: failedEffect.memberResult?.error?.message,
      failedBody: failedEffect.memberResult?.body,
      failedToken: failedEffect.memberResult?.requestToken,
      failedSettled: failedEffect.settled,
      unavailableStatus: unavailableEffect.memberResult?.status,
      unavailableCode: unavailableEffect.memberResult?.error?.code,
      unavailableBody: unavailableEffect.memberResult?.body,
      unavailableToken: unavailableEffect.memberResult?.requestToken,
      unavailableSettled: unavailableEffect.settled,
    }
  } finally {
    await destroyP6T1World(world)
  }
}

// ── E6: replay = the SAME synthesized result, no double delivery ─────────────

{
  const world = await createP6T2World('p8s3b-e6', ['leader', 'worker'])
  try {
    const delivery = createFakeDeliveryPort()
    delivery.armResult({
      requestToken: 'tok-p8s3b-e6',
      status: 'succeeded',
      body: 'original member answer',
    })
    const runtime = createWorkChainRuntime(world, delivery.port)
    const first = await runtime.performAction(
      makeActionRequest({
        targetInstanceId: WORKER_ID,
        requestToken: 'tok-p8s3b-e6',
        payload: { prompt: 'p8s3b e6 prompt' },
      }),
    )
    const firstEffect = asWorkAdmitted(first)
    const ledgerAfterFirst = ledgerCount(world)
    const second = await runtime.performAction(
      makeActionRequest({
        targetInstanceId: WORKER_ID,
        requestToken: 'tok-p8s3b-e6',
        payload: { prompt: 'p8s3b e6 prompt' },
      }),
    )
    const secondEffect = asWorkAdmitted(second)
    e6 = {
      firstStatus: firstEffect.memberResult?.status,
      firstBody: firstEffect.memberResult?.body,
      firstSettled: firstEffect.settled,
      firstReplayed: firstEffect.replayed,
      secondStatus: secondEffect.memberResult?.status,
      secondReplayed: secondEffect.replayed,
      secondSettled: secondEffect.settled,
      secondResult: secondEffect.memberResult,
      secondEqualsFrozen:
        JSON.stringify(secondEffect.memberResult) === JSON.stringify(frozenReplayResult('tok-p8s3b-e6')),
      deliveries: delivery.calls.length,
      ledgerUnchanged: ledgerCount(world) === ledgerAfterFirst,
      sameSequence: secondEffect.sequence === firstEffect.sequence,
    }
  } finally {
    await destroyP6T1World(world)
  }
}

// ── assertions (synchronous; the shim supports no async `it`) ────────────────

describe('P8-S3b (v2 D2, task C2): the glue delivered-turn read', () => {
  it('G1: a completed turn with a readable non-empty body -> succeeded + the business body', () => {
    expect(g1.followups).toBe(1)
    // the post-turn materialization still runs (the invariant-46 barrier)
    expect(g1.materialized).toBe(2)
    expect(g1.result).toEqual({
      requestToken: 'tok-p8s3b-g1',
      status: 'succeeded',
      body: 'the member business answer',
    })
  })

  it('G2: completed-without-body maps to unavailable (WORK_NO_ASSISTANT_BODY), NEVER succeeded', () => {
    expect(g2.noMessage).toEqual({
      requestToken: 'tok-p8s3b-g2a',
      status: 'unavailable',
      error: {
        code: 'WORK_NO_ASSISTANT_BODY',
        message: 'the delivered turn completed but carries no non-empty assistant text',
      },
    })
    expect(g2.emptyBody).toEqual({
      requestToken: 'tok-p8s3b-g2b',
      status: 'unavailable',
      error: {
        code: 'WORK_NO_ASSISTANT_BODY',
        message: 'the delivered turn completed but carries no non-empty assistant text',
      },
    })
  })

  it('G3: turn reason error -> failed, code from the carried LlmFailure (WORK_TURN_ERROR when none)', () => {
    expect(g3.withFailureCode).toEqual({
      requestToken: 'tok-p8s3b-g3a',
      status: 'failed',
      error: { code: 'PROVIDER_UNAVAILABLE', message: 'upstream provider exploded' },
    })
    expect(g3.withoutFailureCode).toEqual({
      requestToken: 'tok-p8s3b-g3b',
      status: 'failed',
      error: { code: 'WORK_TURN_ERROR', message: 'the model call failed without a stable code' },
    })
  })

  it('G4/G5/G6: aborted / max-tokens / blocked -> failed with the stable codes', () => {
    expect(g456.aborted).toEqual({
      requestToken: 'tok-p8s3b-g4',
      status: 'failed',
      error: { code: 'WORK_TURN_ABORTED', message: 'the member turn was aborted before completion' },
    })
    expect(g456.maxTokens).toEqual({
      requestToken: 'tok-p8s3b-g5',
      status: 'failed',
      error: { code: 'WORK_TURN_MAX_TOKENS', message: 'the member turn hit its output token ceiling' },
    })
    expect(g456.blocked).toEqual({
      requestToken: 'tok-p8s3b-g6',
      status: 'failed',
      error: { code: 'WORK_TURN_BLOCKED', message: 'the member turn was blocked' },
    })
  })

  it('G7: the result correlates to THIS delivery via the token prefix (a multi-turn log does not leak)', () => {
    expect(g7.mine).toEqual({
      requestToken: 'tok-p8s3b-g7',
      status: 'succeeded',
      body: 'mine body',
    })
    expect(g7.other).toEqual({
      requestToken: 'tok-p8s3b-other',
      status: 'succeeded',
      body: 'other body',
    })
  })

  it('G8: an unreadable/attributable turn -> unavailable with a stable code (never succeeded, never a throw)', () => {
    expect(g8.noDeliveredMessage).toEqual({
      requestToken: 'tok-p8s3b-g8a',
      status: 'unavailable',
      error: {
        code: 'WORK_TURN_UNREADABLE',
        message: "no delivered user message for requestToken 'tok-p8s3b-g8a' found in the child session log",
      },
    })
    expect(g8.noTurnEnd).toEqual({
      requestToken: 'tok-p8s3b-g8b',
      status: 'unavailable',
      error: {
        code: 'WORK_TURN_UNREADABLE',
        message: "the delivered turn of requestToken 'tok-p8s3b-g8b' has no turn/end in the child session log",
      },
    })
  })

  it('G9: the fail-closed throw contract is unchanged (a whenIdle rejection / pre-aborted signal rejects; no result)', () => {
    expect(g9.idleRejectError).toBe('idle seam down')
    // only the createRootAgent materialization — the failed delivery never
    // reached its post-turn materialization
    expect(g9.idleRejectMaterialized).toBe(1)
    expect(g9.preAbortedError).toBe('caller aborted before delivery')
    expect(g9.preAbortedCancels).toBe(1)
  })

  it('G10: the delivered text is unchanged (token prefix + attached-context block — the correlation point)', () => {
    expect(g10.plainText).toBe('[team-work requestToken=tok-p8s3b-g10] plain prompt')
    expect(g10.attachedText).toBe(
      '[team-work requestToken=tok-p8s3b-g10b] plain prompt\n\n[attached-context]\nctx-block',
    )
  })

  it('G11: a session without the log-read seam -> explicit unavailable (never a throw, never succeeded)', () => {
    expect(g11.result).toEqual({
      requestToken: 'tok-p8s3b-g11',
      status: 'unavailable',
      error: {
        code: 'WORK_TURN_UNREADABLE',
        message: 'the session log read seam (Session.ownEvents) is unavailable on the live session handle',
      },
    })
  })
})

describe('P8-S3b (v2 D2, task C2): the effect carriers of the frozen member result', () => {
  it('E1: delegate success — the Leader-facing member-activated effect carries status=succeeded + the member business body', () => {
    expect(e1.status).toBe('succeeded')
    expect(e1.body).toBe('delegate member answer')
    expect(e1.errorAbsent).toBe(true)
    expect(e1.workSettled).toBe(true)
  })

  it('E2: follow-up success — the work-admitted effect carries the succeeded result', () => {
    expect(e2.status).toBe('succeeded')
    expect(e2.body).toBe('follow-up member answer')
    expect(e2.errorAbsent).toBe(true)
    expect(e2.settled).toBe(true)
  })

  it('E3: delivery failure — status=failed rides the effect with the stable code (no body)', () => {
    expect(e34.failedStatus).toBe('failed')
    expect(e34.failedCode).toBe('WORK_TURN_ERROR')
    expect(e34.failedMessage).toBe('llm call failed (contained in the turn)')
    expect(e34.failedBody).toBeUndefined()
    expect(e34.failedSettled).toBe(true)
  })

  it('E4: unavailable — completed-without-body maps to unavailable on the effect, NOT succeeded', () => {
    expect(e34.unavailableStatus).toBe('unavailable')
    expect(e34.unavailableCode).toBe('WORK_NO_ASSISTANT_BODY')
    expect(e34.unavailableBody).toBeUndefined()
    expect(e34.unavailableSettled).toBe(true)
  })

  it('E5: requestToken echo — the effect memberResult echoes the request token verbatim', () => {
    expect(e1.token).toBe('tok-p8s3b-e1')
    expect(e2.token).toBe('tok-p8s3b-e2')
    expect(e34.failedToken).toBe('tok-p8s3b-e3')
    expect(e34.unavailableToken).toBe('tok-p8s3b-e4')
  })

  it('E6: replay — an already-settled token yields the SAME synthesized unavailable result, no double delivery', () => {
    expect(e6.firstStatus).toBe('succeeded')
    expect(e6.firstBody).toBe('original member answer')
    expect(e6.firstSettled).toBe(true)
    expect(e6.firstReplayed).not.toBe(true)
    expect(e6.secondReplayed).toBe(true)
    expect(e6.secondSettled).toBe(true)
    expect(e6.secondStatus).toBe('unavailable')
    expect(e6.secondResult).toEqual(frozenReplayResult('tok-p8s3b-e6'))
    expect(e6.secondEqualsFrozen).toBe(true)
    expect(e6.deliveries).toBe(1)
    expect(e6.ledgerUnchanged).toBe(true)
    expect(e6.sameSequence).toBe(true)
  })

  it('E7: settled separation — the control-plane settled flag never by itself produces succeeded', () => {
    expect(e34.failedSettled && e34.failedStatus !== 'succeeded').toBe(true)
    expect(e34.unavailableSettled && e34.unavailableStatus !== 'succeeded').toBe(true)
    expect(e6.secondSettled && e6.secondStatus !== 'succeeded').toBe(true)
  })
})

/** Helper: one follow-up performAction on the default worker (the E3/E4
 *  scenarios share one runtime per world). */
async function runtime_perform(
  world: P6T1World,
  delivery: WorkDeliveryPort,
  requestToken: string,
  prompt: string,
): Promise<TeamRuntimeActionOutcome> {
  const runtime = createWorkChainRuntime(world, delivery)
  return runtime.performAction(
    makeActionRequest({
      targetInstanceId: WORKER_ID,
      requestToken,
      payload: { prompt },
    }),
  )
}
