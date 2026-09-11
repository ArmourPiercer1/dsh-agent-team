/**
 * issue2-capability-permission-precedence.test.ts — I2-P4 (plan §13)
 * precedence regression for the alpha.2 Issue #2 permission repair:
 * the CAPABILITY layer (the per-member `builtinToolDeny` mask) must win
 * over the OPERATION-PERMISSION layer (the template policy + control
 * pipeline) — a tool the member is not ALLOWED TO HAVE cannot be
 * re-admitted by a policy `allow` rule or an approval `ask` flow.
 *
 * The four lanes (plan §13):
 *
 *   P4-A  hidden read  + static allow  → the tool is ABSENT from the
 *         agent's model surface, the dispatch is REJECTED (the tool body
 *         never runs — "rejected before successful execution"), and the
 *         ALLOW lane leaves zero ControlRequest / ControlDecision /
 *         ControlConsumption rows.
 *         RECORDED DEVIATION (plan §13 P4-A "zero authorization marker"):
 *         the upstream pipeline order is `tools/pre-execute` waterfall →
 *         monotonic guards → dispatch/resolution (dsh-tools
 *         `prepareExecution` runs the gate BEFORE `dispatchToolBody`'s
 *         `resolveExecution`), so the permission listener DOES run for a
 *         hidden tool: it canonicalizes, resolves the static allow, and
 *         marks the exec authorized — and only then does the dispatch
 *         resolve the name and fail `unknown tool`. The marker is inert
 *         (nothing executes without the body). The plan's mask-first
 *         ordering is not achievable with CORE PATCH BUDGET = 0 (the
 *         pipeline order is upstream); the enforcement invariant the
 *         plan exists to protect — a denied tool body can NEVER run —
 *         holds and is pinned here (the mask is enforced in the
 *         operation that performs it, per the upstream enforcement rule).
 *   P4-B  hidden write + ask rule      → the tool is ABSENT from the
 *         surface and the body NEVER runs ("no file effect") even when
 *         the leader APPROVES the ask — the mask is the final authority.
 *         RECORDED DEVIATION (plan §13 P4-B "no ask request"): for the
 *         same pipeline-order reason the ask lane DOES create the
 *         durable leader-approval request (the pipeline runs before the
 *         resolution); after the leader allow the last-mile guard
 *         check-and-reserve runs and the dispatch still fails
 *         `unknown tool` with the body count at zero.
 *   P4-C  visible read + allow         → the full allow lane works
 *         exactly as before the deny existed: canonicalize → resolve
 *         allow (observed) → mark authorized → body executes exactly
 *         once, zero control rows (the allow lane never touches the
 *         durable control state).
 *   P4-D  visible write + ask          → the full ask lane works exactly
 *         as before: the request row is created (kind leader-approval,
 *         the member routing), the body does NOT run while the request
 *         is pending, the leader's durable allow → the decision row →
 *         the EXACT guardOperation check-and-reserve (guard-verdict
 *         allowed, the consumption row exists exactly once) → the
 *         authorization marker → the body runs exactly once.
 *
 * SEAM: the real pipeline end to end — the real ToolRuntime registry
 * (tools registered on the root ctx, resolved per agent scope), the REAL
 * capability mask (`applyBuiltInToolDeny` from @dsh-agent-team/tools,
 * applied to the agent scope BEFORE the listener, exactly the glue
 * install order), the REAL pre-execute permission adapter
 * (`installParameterPermissionListener` from this runtime's
 * operation-permission module, installed LAST), and the REAL control
 * service over a REAL P6-T4 team world (durable request/decision/
 * consumption rows). Dispatch goes through `ctx.tools.execute` — the
 * same entry the production pipeline uses.
 *
 * RUNNER CONSTRAINTS (this repo's plain-node shim — see the a5a/h1a
 * headers): every async scenario runs at MODULE level (top-level await)
 * and captures its results; the `it` bodies are pure synchronous
 * assertions. Shim matchers used: toBe / toEqual / toBeGreaterThan
 * (+.not) only.
 *
 * SELF-CLEANLINESS: this file is inside the P4-T6 whole-tree scanner's
 * scope (`packages/**`), so no legacy Team SessionEvent denylist token
 * may appear in this source — none does.
 *
 * @module @dsh-agent-team/runtime/test/issue2-capability-permission-precedence
 */
import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { createScope } from '@deepseek-ai/dsh-scope'
import type { Scope } from '@deepseek-ai/dsh-scope'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import ToolRuntime from '@deepseek-ai/dsh-tools'
import type { ToolDefinition, ToolExecutionResult, ToolRunContext } from '@deepseek-ai/dsh-tools'
import { ToolCallId } from '@deepseek-ai/dsh-llm'
import type { SessionId } from '@deepseek-ai/dsh-session'
import type { Agent } from '@deepseek-ai/dsh-agent'
import { CONTROL_REQUEST_KINDS, createControlService } from '../control/index.js'
import type { ControlRequestRecord, ControlService } from '../control/index.js'
import {
  installParameterPermissionListener,
} from '../operation-permission/index.js'
import type { TemplatePermissionPolicy } from '../../domain/blueprint/src/index.js'
import { applyBuiltInToolDeny } from '../../tools/src/index.js'
import type { P6T1World } from './p6t1-helpers.js'
import {
  P6T4_ROOT,
  P6T4_NOW,
  P6T4_SEEDS,
  createP6T4World,
  destroyP6T1World,
  leaderCaller,
  memberCaller,
} from './p6t4-helpers.js'

// ---------------------------------------------------------------------------
// Constants.
// ---------------------------------------------------------------------------

const WORKER_ID = String(P6T4_SEEDS.worker.instanceId)

/**
 * P4-A's policy (plan §13 template): an EXPLICIT static allow for the
 * read tool on ANY resource — the strongest allow. If the capability
 * mask could be bypassed by the permission layer (the B2 class of
 * defect in the reverse direction), this lane would execute the body
 * despite the deny.
 */
const ALLOW_READ_POLICY: TemplatePermissionPolicy = {
  default: 'deny',
  allow: [{ tool: 'read', resource: { kind: 'any' } }],
  ask: [],
  deny: [],
}

/** P4-B/P4-D's policy (plan §13 template): an ask rule for the write tool on ANY resource. */
const ASK_WRITE_POLICY: TemplatePermissionPolicy = {
  default: 'deny',
  allow: [],
  ask: [{ tool: 'write', resource: { kind: 'any' } }],
  deny: [],
}

/** The body-call counters (module-level; every probe captures DELTAS). */
let readBodyCalls = 0
let writeBodyCalls = 0

// ---------------------------------------------------------------------------
// The real upstream composition (the h1a/scoped.spec recipe).
// ---------------------------------------------------------------------------

/** Mount the registry (with its systemPrompt dependency) on a fresh context. */
async function mountUpstream(): Promise<Context> {
  const ctx = new Context()
  await ctx.plugin(SystemPrompt, {})
  await ctx.plugin(ToolRuntime)
  return ctx
}

/** Mint an agent scope whose key doubles as a minimal Agent-like object. */
async function mintAgentScope(ctx: Context, name: string): Promise<{ scope: Scope; key: Agent }> {
  const key = { id: name as SessionId } as Agent
  let scope!: Scope
  await ctx.plugin(
    Object.assign((inner: Context) => {
      scope = createScope(inner, key)
    }, { inject: ['tools', 'systemPrompt'] }),
  )
  return { scope, key }
}

/** One managed tool definition (the body counts invocations). */
function makeTool(
  name: string,
  reply: string,
  onBody: (exec: ToolRunContext) => void,
): ToolDefinition {
  return {
    name,
    description: `i2-p4 managed ${name}`,
    parameters: { type: 'object', properties: {} },
    output: {
      schema: { type: 'string' },
      render: (_args, value) => [{ type: 'text', text: value as string }],
    },
    execute: (_args, exec): Promise<string> => {
      onBody(exec)
      return Promise.resolve(reply)
    },
  }
}

/** The managed tools registered on the ROOT ctx (visible to every agent scope). */
function registerManagedTools(ctx: Context): void {
  ctx.tools.register(
    makeTool('read', 'ran:read', () => {
      readBodyCalls += 1
    }),
  )
  ctx.tools.register(
    makeTool('write', 'ran:write', () => {
      writeBodyCalls += 1
    }),
  )
  ctx.tools.register(
    makeTool('web_fetch', 'ran:web_fetch', () => {
      /* no counter needed for the P4 lanes */
    }),
  )
}

// ---------------------------------------------------------------------------
// The deterministic fake resolver (a5a/h1a pattern — stable `file:///` keys).
// ---------------------------------------------------------------------------

function makeFakeResolver(): {
  readonly resolver: (path: string) => Promise<{ readonly key: string; readonly display: string }>
} {
  const normalize = (path: string): string =>
    path.replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/{2,}/g, '/')
  return {
    resolver: async (path: string): Promise<{ readonly key: string; readonly display: string }> =>
      ({ key: `file:///${normalize(path)}`, display: path }),
  }
}

// ---------------------------------------------------------------------------
// The install environments (real control worlds + real scope installs).
// ---------------------------------------------------------------------------

interface ControlWorld {
  readonly world: P6T1World
  readonly service: ControlService
}

async function createControlWorld(basename: string): Promise<ControlWorld> {
  const world = await createP6T4World(basename, ['leader', 'worker'])
  const service = createControlService({
    teamDomain: world.domain,
    blueprintCatalog: world.catalog,
    externalPolicyFacts: world.ports.externalPolicyFacts,
    now: () => P6T4_NOW,
    waitPollIntervalMs: 10,
  })
  return { world, service }
}

/**
 * The glue's base-tool block in its production install order: the
 * capability deny (REAL adapter) FIRST, the operation-permission
 * listener (REAL adapter) LAST. Returns the two disposers (the glue
 * drains both at agent close).
 */
function installGlueBlock(
  scope: Scope,
  service: ControlService,
  policy: TemplatePermissionPolicy,
  deny: readonly string[],
  resolver: ReturnType<typeof makeFakeResolver>,
  observations: Record<string, unknown>[],
): () => void {
  const denyDisposer = applyBuiltInToolDeny(scope.ctx as never, deny)
  const listenerDisposer = installParameterPermissionListener(scope.ctx, {
    policy,
    resolveTarget: resolver.resolver,
    controlService: service,
    rootSessionId: P6T4_ROOT,
    caller: memberCaller(WORKER_ID),
    targetInstanceId: WORKER_ID,
    isLeader: false,
    onObserve: (observation) => {
      observations.push(observation)
    },
  })
  return () => {
    listenerDisposer()
    denyDisposer.dispose()
  }
}

// ---------------------------------------------------------------------------
// Result / state helpers.
// ---------------------------------------------------------------------------

/** The first text block of one result (the model-visible projection). */
function textOf(result: ToolExecutionResult): string {
  const first = result.content[0]
  return first !== undefined && first.type === 'text' ? first.text : JSON.stringify(result.content)
}

/** Poll the durable control state until the request for a correlation
 *  appears (or the timeout — a test failure with the captured state). */
async function waitForRequest(
  service: ControlService,
  correlation: string,
): Promise<ControlRequestRecord> {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const state = await service.listControlState(P6T4_ROOT)
    const found = state.requests.find((r) => r.correlation === correlation)
    if (found !== undefined) return found
    await new Promise((resolve) => setTimeout(resolve, 5))
  }
  throw new Error(`i2-p4: no durable control request for correlation '${correlation}' after 1 s`)
}

interface ControlRowCounts {
  readonly requests: number
  readonly decisions: number
  readonly consumptions: number
}

async function rowCounts(service: ControlService): Promise<ControlRowCounts> {
  const state = await service.listControlState(P6T4_ROOT)
  return {
    requests: state.requests.length,
    decisions: state.decisions.length,
    consumptions: state.consumptions.length,
  }
}

/** One driven execution (the real pipeline, agent-scoped). */
async function drive(
  ctx: Context,
  key: Agent,
  callId: string,
  name: string,
  args: Record<string, unknown>,
): Promise<ToolExecutionResult> {
  const controller = new AbortController()
  return await ctx.tools.execute({
    signal: controller.signal,
    callId: ToolCallId(callId) as never,
    name,
    arguments: args,
    agent: key,
  })
}

/** The observations one install emitted for one callId. */
function observationsFor(
  observations: readonly Record<string, unknown>[],
  callId: string,
): Record<string, unknown>[] {
  return observations.filter((row) => row['callId'] === callId)
}

// ===========================================================================
// WORLD MAIN (module level — the shim constraint).
// ===========================================================================

const W = await (async () => {
  const out: Record<string, unknown> = {}
  const control = await createControlWorld('i2-p4')
  const resolver = makeFakeResolver()
  try {
    const ctx = await mountUpstream()
    registerManagedTools(ctx)

    // ── P4-A — hidden read + static allow (precedence: deny wins) ──────
    const a = await (async () => {
      const { scope, key } = await mintAgentScope(ctx, 'i2-p4-a')
      const obs: Record<string, unknown>[] = []
      const dispose = installGlueBlock(scope, control.service, ALLOW_READ_POLICY, ['read'], resolver, obs)
      const surface = ctx.tools.schemas(key as never).map((s) => s.name).sort()
      const rowsBefore = await rowCounts(control.service)
      const readBefore = readBodyCalls
      const result = await drive(ctx, key, 'i2-p4a-read', 'read', { file_path: 'fileA.txt' })
      const rowsAfter = await rowCounts(control.service)
      dispose()
      return {
        surface,
        rowsBefore,
        rowsAfter,
        readDelta: readBodyCalls - readBefore,
        isError: result.isError,
        text: textOf(result),
        obs,
      }
    })()
    out.A = a

    // ── P4-B — hidden write + ask rule (the mask is the final authority) ─
    const b = await (async () => {
      const { scope, key } = await mintAgentScope(ctx, 'i2-p4-b')
      const obs: Record<string, unknown>[] = []
      const dispose = installGlueBlock(scope, control.service, ASK_WRITE_POLICY, ['write'], resolver, obs)
      const surface = ctx.tools.schemas(key as never).map((s) => s.name).sort()
      const rowsBefore = await rowCounts(control.service)
      const writeBefore = writeBodyCalls

      let settled = false
      const resultPromise = drive(ctx, key, 'i2-p4b-write', 'write', { file_path: 'fileB.txt', content: 'payload' }).then(
        (result) => {
          settled = true
          return result
        },
      )
      const request = await waitForRequest(control.service, 'i2-p4b-write')
      const pausedBeforeResolve = !settled
      const writeAtPause = writeBodyCalls - writeBefore

      // The leader APPROVES — the strongest case: the full permission
      // pipeline authorizes, and the mask must still win.
      await control.service.resolveControl({
        rootSessionId: P6T4_ROOT,
        caller: leaderCaller(),
        requestId: request.requestId,
        decision: 'allow',
      })
      const result = await resultPromise
      const rowsAfter = await rowCounts(control.service)
      const stateAfter = await control.service.listControlState(P6T4_ROOT)
      dispose()
      return {
        surface,
        rowsBefore,
        rowsAfter,
        pausedBeforeResolve,
        writeAtPause,
        writeDelta: writeBodyCalls - writeBefore,
        request,
        isError: result.isError,
        text: textOf(result),
        obs,
        consumptionForRequest: stateAfter.consumptions.filter((c2) => c2.requestId === request.requestId).length,
      }
    })()
    out.B = b

    // ── P4-C — visible read + allow (the allow lane is intact) ─────────
    const c = await (async () => {
      const { scope, key } = await mintAgentScope(ctx, 'i2-p4-c')
      const obs: Record<string, unknown>[] = []
      const dispose = installGlueBlock(scope, control.service, ALLOW_READ_POLICY, [], resolver, obs)
      const surface = ctx.tools.schemas(key as never).map((s) => s.name).sort()
      const rowsBefore = await rowCounts(control.service)
      const readBefore = readBodyCalls
      const result = await drive(ctx, key, 'i2-p4c-read', 'read', { file_path: 'fileA.txt' })
      const rowsAfter = await rowCounts(control.service)
      dispose()
      return {
        surface,
        rowsBefore,
        rowsAfter,
        readDelta: readBodyCalls - readBefore,
        isError: result.isError,
        text: textOf(result),
        obs,
      }
    })()
    out.C = c

    // ── P4-D — visible write + ask (the ask lane is intact, end to end) ─
    const d = await (async () => {
      const { scope, key } = await mintAgentScope(ctx, 'i2-p4-d')
      const obs: Record<string, unknown>[] = []
      const dispose = installGlueBlock(scope, control.service, ASK_WRITE_POLICY, [], resolver, obs)
      const surface = ctx.tools.schemas(key as never).map((s) => s.name).sort()
      const rowsBefore = await rowCounts(control.service)
      const writeBefore = writeBodyCalls

      let settled = false
      const resultPromise = drive(ctx, key, 'i2-p4d-write', 'write', { file_path: 'fileB.txt', content: 'payload' }).then(
        (result) => {
          settled = true
          return result
        },
      )
      const request = await waitForRequest(control.service, 'i2-p4d-write')
      const pausedBeforeResolve = !settled
      const writeAtPause = writeBodyCalls - writeBefore
      const rowsAtPause = await rowCounts(control.service)

      await control.service.resolveControl({
        rootSessionId: P6T4_ROOT,
        caller: leaderCaller(),
        requestId: request.requestId,
        decision: 'allow',
      })
      const result = await resultPromise
      const rowsAfter = await rowCounts(control.service)
      const stateAfter = await control.service.listControlState(P6T4_ROOT)
      dispose()
      return {
        surface,
        rowsBefore,
        rowsAfter,
        rowsAtPause,
        writeDelta: writeBodyCalls - writeBefore,
        writeAtPause,
        pausedBeforeResolve,
        request,
        isError: result.isError,
        text: textOf(result),
        obs,
        consumptionForRequest: stateAfter.consumptions.filter((c2) => c2.requestId === request.requestId).length,
        decisionForRequest: stateAfter.decisions.filter((dc) => dc.requestId === request.requestId).length,
      }
    })()
    out.D = d
  } finally {
    await destroyP6T1World(control.world)
  }
  return out
})()

// ===========================================================================
// ASSERTIONS (synchronous `it` bodies — the shim constraint).
// ===========================================================================

describe('I2-P4 capability > operation-permission precedence (plan §13)', () => {
  it('P4-A: the hidden read is ABSENT from the agent\'s model surface', () => {
    const A = W['A'] as Record<string, unknown>
    expect((A['surface'] as string[]).includes('read')).toBe(false)
  })

  it('P4-A: the dispatch of the hidden read is REJECTED (the tool body never runs — an explicit policy allow does NOT re-admit it)', () => {
    const A = W['A'] as Record<string, unknown>
    expect(A['isError']).toBe(true)
    const text = A['text'] as string
    expect(text.includes('unknown tool')).toBe(true)
    expect(text.includes('read')).toBe(true)
    expect(A['readDelta']).toBe(0)
  })

  it('P4-A: the allow lane leaves zero new control rows (no request, no decision, no consumption)', () => {
    const A = W['A'] as Record<string, unknown>
    const before = A['rowsBefore'] as ControlRowCounts
    const after = A['rowsAfter'] as ControlRowCounts
    expect(after.requests).toBe(before.requests)
    expect(after.decisions).toBe(before.decisions)
    expect(after.consumptions).toBe(before.consumptions)
    const obs = A['obs'] as Record<string, unknown>[]
    expect(obs.some((row) => row['stage'] === 'request-created')).toBe(false)
  })

  it('P4-A (recorded deviation): the pipeline runs before the resolution — the allow resolved and marked (observed), yet the body never ran', () => {
    const A = W['A'] as Record<string, unknown>
    const obs = A['obs'] as Record<string, unknown>[]
    const canonicalized = obs.filter((row) => row['stage'] === 'canonicalized')
    const decisionRows = obs.filter((row) => row['stage'] === 'decision')
    expect(canonicalized.length).toBe(1)
    expect(decisionRows.length).toBe(1)
    expect(decisionRows[0]?.['decision']).toBe('allow')
    expect(A['readDelta']).toBe(0)
  })

  it('P4-B: the hidden write is ABSENT from the agent\'s model surface', () => {
    const B = W['B'] as Record<string, unknown>
    expect((B['surface'] as string[]).includes('write')).toBe(false)
  })

  it('P4-B (recorded deviation): the ask lane creates the durable leader-approval request and PAUSES — the body does not run while pending', () => {
    const B = W['B'] as Record<string, unknown>
    const request = B['request'] as ControlRequestRecord
    expect(request.kind).toBe(CONTROL_REQUEST_KINDS.LEADER_APPROVAL)
    expect(request.correlation).toBe('i2-p4b-write')
    expect(B['pausedBeforeResolve']).toBe(true)
    expect(B['writeAtPause']).toBe(0)
  })

  it('P4-B: even with the leader\'s APPROVAL the mask is the final authority — the dispatch is rejected, the body NEVER runs (no file effect), and the last-mile guard consumed exactly once', () => {
    const B = W['B'] as Record<string, unknown>
    expect(B['isError']).toBe(true)
    const text = B['text'] as string
    expect(text.includes('unknown tool')).toBe(true)
    expect(text.includes('write')).toBe(true)
    expect(B['writeDelta']).toBe(0)
    const before = B['rowsBefore'] as ControlRowCounts
    const after = B['rowsAfter'] as ControlRowCounts
    expect(after.requests).toBe(before.requests + 1)
    expect(after.decisions).toBe(before.decisions + 1)
    expect(after.consumptions).toBe(before.consumptions + 1)
    expect(B['consumptionForRequest']).toBe(1)
    const obs = B['obs'] as Record<string, unknown>[]
    expect(obs.some((row) => row['stage'] === 'request-created' && row['kind'] === CONTROL_REQUEST_KINDS.LEADER_APPROVAL)).toBe(true)
    expect(obs.some((row) => row['stage'] === 'decision-arrived' && row['decision'] === 'allow')).toBe(true)
    const guard = obs.filter((row) => row['stage'] === 'guard-verdict')
    expect(guard.length).toBe(1)
    expect(guard[0]?.['allowed']).toBe(true)
  })

  it('P4-C: the visible read keeps its full surface', () => {
    const C = W['C'] as Record<string, unknown>
    expect((C['surface'] as string[]).includes('read')).toBe(true)
  })

  it('P4-C: the allow lane runs exactly as before — canonicalize→resolve allow (observed) → body executes EXACTLY ONCE, zero control rows', () => {
    const C = W['C'] as Record<string, unknown>
    expect(C['isError']).toBe(false)
    expect(C['text']).toBe('ran:read')
    expect(C['readDelta']).toBe(1)
    const before = C['rowsBefore'] as ControlRowCounts
    const after = C['rowsAfter'] as ControlRowCounts
    expect(after.requests).toBe(before.requests)
    expect(after.decisions).toBe(before.decisions)
    expect(after.consumptions).toBe(before.consumptions)
    const decisionRows = observationsFor(C['obs'] as Record<string, unknown>[], 'i2-p4c-read')
      .filter((row) => row['stage'] === 'decision')
    expect(decisionRows.length).toBe(1)
    expect(decisionRows[0]?.['decision']).toBe('allow')
  })

  it('P4-D: the visible write keeps its full surface', () => {
    const D = W['D'] as Record<string, unknown>
    expect((D['surface'] as string[]).includes('write')).toBe(true)
  })

  it('P4-D: the ask lane creates the durable leader-approval request and PAUSES — the body does not run while pending', () => {
    const D = W['D'] as Record<string, unknown>
    const request = D['request'] as ControlRequestRecord
    expect(request.kind).toBe(CONTROL_REQUEST_KINDS.LEADER_APPROVAL)
    expect(request.correlation).toBe('i2-p4d-write')
    expect(D['pausedBeforeResolve']).toBe(true)
    expect(D['writeAtPause']).toBe(0)
    const atPause = D['rowsAtPause'] as ControlRowCounts
    const before = D['rowsBefore'] as ControlRowCounts
    expect(atPause.requests).toBeGreaterThan(before.requests)
  })

  it('P4-D: the leader\'s durable allow → decision row → EXACT guardOperation check-and-reserve → body runs EXACTLY ONCE (the consumption row exists exactly once)', () => {
    const D = W['D'] as Record<string, unknown>
    expect(D['isError']).toBe(false)
    expect(D['text']).toBe('ran:write')
    expect(D['writeDelta']).toBe(1)
    expect(D['decisionForRequest']).toBe(1)
    expect(D['consumptionForRequest']).toBe(1)
    const request = D['request'] as ControlRequestRecord
    const after = D['rowsAfter'] as ControlRowCounts
    const before = D['rowsBefore'] as ControlRowCounts
    expect(after.requests).toBe(before.requests + 1)
    expect(after.decisions).toBe(before.decisions + 1)
    expect(after.consumptions).toBe(before.consumptions + 1)
    const obs = observationsFor(D['obs'] as Record<string, unknown>[], 'i2-p4d-write')
    expect(obs.some((row) => row['stage'] === 'request-created')).toBe(true)
    expect(obs.some((row) => row['stage'] === 'decision-arrived' && row['decision'] === 'allow')).toBe(true)
    const guard = obs.filter((row) => row['stage'] === 'guard-verdict')
    expect(guard.length).toBe(1)
    expect(guard[0]?.['allowed']).toBe(true)
    expect(guard[0]?.['requestId']).toBe(request.requestId)
  })
})
