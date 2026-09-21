/**
 * artifact-read-permission-lane.test.ts — Strict-read + Core-spill
 * Phase B: the artifact-grant lane of the pre-execute adapter
 * (implementation guide §9 + §13; architecture §12) — the 8 mandated
 * adapter cases:
 *
 *  G1  explicit deny + valid grant → DENY (the grant is never consulted
 *      — an explicit rule deny is the ceiling);
 *  G2  explicit ask + valid grant → ALLOW with ZERO control requests;
 *  G3  default deny + valid grant → ALLOW with ZERO control requests
 *      (the strict-read core use case: the producer reads back its own
 *      out-of-workspace artifact) — and the exec is marked in the
 *      existing `authorizedExecutions` WeakSet (the end-cap guard
 *      abstains — NO second guard is introduced);
 *  G4  external hard + valid grant → DENY (the SAME last-mile
 *      recheck as the static-allow path — invariant 34);
 *  G5  grants are consumed by `read` ONLY: a `bash` call with a "valid"
 *      grant port never consults the port (the unchanged pipeline
 *      decides — default deny here → DENY);
 *  G6  default deny + INVALID grant (port false — no candidate) → the
 *      unchanged pipeline (DENY; zero requests);
 *  G7  default ASK + invalid grant → the unchanged pipeline ENTERS THE
 *      ASK PATH (a control request is created — the grant port was
 *      consulted and declined, nothing else changed);
 *  G8  a faulting port fails closed: the read proceeds through the
 *      unchanged pipeline (default deny → DENY; no crash, no grant).
 *
 * The test runs the REAL adapter (installParameterPermissionListener)
 * over a fake agent ctx + a deterministic fake resolver (mirroring the
 * A2C-7 production glue: key + display + the opaque handle) + a
 * recording fake control service (requestControl records + throws —
 * any request in a grant-allowed case is a test failure by
 * construction; checkExternalOperation is the configured verdict).
 *
 * @module @dsh-agent-team/runtime/test/artifact-read-permission-lane
 */
import { describe, expect, it } from 'vitest'
import {
  END_CAP_DENIAL_REASON,
  installParameterPermissionListener,
} from '../operation-permission/index.js'
import type {
  PreExecuteExec,
  PreToolDecisionLike,
} from '../operation-permission/index.js'
import type { ControlService } from '../control/index.js'
import type { ActionCaller } from '../admission/index.js'
import type { TemplatePermissionPolicy } from '../../domain/blueprint/src/index.js'

// --- fake agent ctx (the a5a minimal double) -------------------------------------

type PreExecuteListener = (
  exec: PreExecuteExec,
  next: () => Promise<PreToolDecisionLike>,
) => Promise<PreToolDecisionLike>

type GuardFn = (exec: { readonly name: string }) => string | undefined

interface FakeAgentCtx {
  readonly on: (event: string, listener: PreExecuteListener) => () => void
  readonly tools: { guard(guard: GuardFn): () => void }
  trigger: (exec: PreExecuteExec, next: () => Promise<PreToolDecisionLike>) => Promise<PreToolDecisionLike>
  /** The ACTIVE end-cap guard (for the marking checks). */
  activeGuard: () => GuardFn | undefined
}

function makeFakeAgentCtx(): FakeAgentCtx {
  const listeners: PreExecuteListener[] = []
  const guards: Array<{ fn: GuardFn; disposed: boolean }> = []
  const on = (event: string, listener: PreExecuteListener): (() => void) => {
    listeners.push(listener)
    return (): void => {
      const index = listeners.indexOf(listener)
      if (index >= 0) listeners.splice(index, 1)
    }
  }
  const guard = (fn: GuardFn): (() => void) => {
    const entry = { fn, disposed: false }
    guards.push(entry)
    return (): void => {
      entry.disposed = true
    }
  }
  return {
    on,
    tools: { guard },
    trigger: async (exec, next) => {
      const listener = listeners[0]
      if (listener === undefined) throw new Error('no listener registered')
      return listener(exec, next)
    },
    activeGuard: () => guards.find((g) => !g.disposed)?.fn,
  }
}

// --- fake resolver (the A2C-7 glue shape: key + display + handle) ------------------

interface ResolverWorld {
  /** path → opaque identity (the targetKey). Absent path = resolution failure. */
  readonly files: Map<string, { targetKey: string }>
  readonly calls: string[]
}

function makeResolver(world: ResolverWorld) {
  return async (path: string): Promise<{ key: string; display: string; handle: unknown }> => {
    world.calls.push(path)
    const file = world.files.get(path)
    if (file === undefined) throw new Error(`fake fs: cannot resolve '${path}'`)
    return { key: file.targetKey, display: path, handle: { targetKey: file.targetKey, displayPath: path } }
  }
}

// --- fake control service (recording; external verdict configurable) ---------------

interface ControlWorld {
  readonly requestCalls: unknown[]
  externalAllowed: boolean
  externalReason: string
  externalFault: boolean
}

function makeControl(world: ControlWorld): ControlService {
  const notUsed = async (): Promise<never> => {
    throw new Error('fake control: method must not be reached in this scenario')
  }
  return {
    async requestControl(args: unknown) {
      world.requestCalls.push(args)
      // Fail loud: a control request in a grant-authorized case is a
      // test failure; in the G7 fall-through case the recorded call is
      // the assertion (the subsequent error maps to the adapter's
      // typed deny — a fake artifact, not pipeline behavior).
      throw new Error(`fake control: requestControl reached (call ${world.requestCalls.length})`)
    },
    resolveControl: notUsed,
    listControlState: notUsed,
    guardOperation: notUsed,
    checkExternalOperation: async () => {
      if (world.externalFault) throw new Error('fake control: external check fault')
      return world.externalAllowed
        ? { allowed: true }
        : { allowed: false, reason: `external hard denies (configured: ${world.externalReason})` }
    },
    awaitControlDecision: notUsed,
  } as unknown as ControlService
}

// --- the install environment ---------------------------------------------------------

const ROOT = 'team-root-g'
const INSTANCE = 'inst-worker-g'
const CALLER: ActionCaller = { kind: 'instance', instanceId: INSTANCE }

interface GrantEnvOptions {
  readonly policy: TemplatePermissionPolicy
  /** The grant port's configured verdict (per rawPath, or a constant). */
  readonly grantVerdict?: (rawPath: string) => boolean
  /** The grant port fault flag (G8). */
  readonly grantFault?: boolean
  readonly externalAllowed?: boolean
  readonly externalReason?: string
  readonly externalFault?: boolean
}

interface GrantEnv {
  readonly ctx: FakeAgentCtx
  readonly resolverWorld: ResolverWorld
  readonly controlWorld: ControlWorld
  /** The grant port calls, in order (rawPath + the canonical key it received). */
  readonly grantCalls: Array<{ rawPath: string; canonicalResourceKey: string; instanceId: string }>
  readonly observations: Record<string, unknown>[]
}

function makeGrantEnv(options: GrantEnvOptions): GrantEnv {
  const ctx = makeFakeAgentCtx()
  const resolverWorld: ResolverWorld = { files: new Map(), calls: [] }
  const controlWorld: ControlWorld = {
    requestCalls: [],
    externalAllowed: options.externalAllowed ?? true,
    externalReason: options.externalReason ?? 'test',
    externalFault: options.externalFault ?? false,
  }
  const grantCalls: GrantEnv['grantCalls'] = []
  const observations: Record<string, unknown>[] = []
  installParameterPermissionListener(ctx, {
    policy: options.policy,
    resolveTarget: makeResolver(resolverWorld),
    controlService: makeControl(controlWorld),
    rootSessionId: ROOT,
    caller: CALLER,
    targetInstanceId: INSTANCE,
    isLeader: false,
    onObserve: (observation) => {
      observations.push(observation)
    },
    ...(options.grantVerdict !== undefined || options.grantFault !== undefined
      ? {
          authorizeArtifactRead: async ({
            instanceId,
            rawPath,
            canonicalResourceKey,
          }: {
            instanceId: string
            rawPath: string
            canonicalResourceKey: string
            targetHandle: unknown
          }): Promise<boolean> => {
            grantCalls.push({ rawPath, canonicalResourceKey, instanceId })
            if (options.grantFault === true) throw new Error('grant port fault (G8)')
            return options.grantVerdict === undefined ? false : options.grantVerdict(rawPath)
          },
        }
      : {}),
  })
  return { ctx, resolverWorld, controlWorld, grantCalls, observations }
}

function makeExec(args: { name: string; arguments?: unknown; callId: string }): PreExecuteExec {
  return {
    callId: args.callId,
    name: args.name,
    arguments: args.arguments ?? {},
    signal: new AbortController().signal,
  }
}

function makeNext(): { fn: () => Promise<PreToolDecisionLike>; calls: () => number } {
  let count = 0
  return {
    fn: async (): Promise<PreToolDecisionLike> => {
      count += 1
      return { kind: 'allow' }
    },
    calls: () => count,
  }
}

/** Seed one out-of-workspace artifact path + the strict-read policy fixture. */
const STRICT_READ_POLICY: TemplatePermissionPolicy = {
  default: 'deny',
  allow: [],
  ask: [],
  deny: [],
}

const ARTIFACT = '/home/user/dsh-spill/session-1/tool-bash-0001.log'
const TK_ARTIFACT = 'fs-local:/home/user/dsh-spill/session-1/tool-bash-0001.log'

// --- the 8 mandated cases ------------------------------------------------------------

describe('artifact-grant lane (implementation guide §9)', () => {
  it('G1: explicit rule deny + valid grant → DENY (the grant is never consulted)', async () => {
    const env = makeGrantEnv({
      policy: {
        default: 'deny',
        allow: [],
        ask: [],
        deny: [{ tool: 'read', resource: { kind: 'exact', path: ARTIFACT } }],
      },
      grantVerdict: () => true,
    })
    env.resolverWorld.files.set(ARTIFACT, { targetKey: TK_ARTIFACT })
    const next = makeNext()
    const decision = await env.ctx.trigger(
      makeExec({ name: 'read', arguments: { file_path: ARTIFACT }, callId: 'g1' }),
      next.fn,
    )
    expect(decision.kind).toBe('deny')
    if (decision.kind === 'deny') {
      expect(decision.reason).toContain('the template\'s deny rule 0')
    }
    // the grant port was NEVER consulted (explicit deny is the ceiling)
    expect(env.grantCalls.length).toBe(0)
    expect(next.calls()).toBe(0)
    expect(env.controlWorld.requestCalls.length).toBe(0)
  })

  it('G2: explicit ask + valid grant → ALLOW with ZERO control requests', async () => {
    const env = makeGrantEnv({
      policy: {
        default: 'deny',
        allow: [],
        ask: [{ tool: 'read', resource: { kind: 'exact', path: ARTIFACT } }],
        deny: [],
      },
      grantVerdict: () => true,
    })
    env.resolverWorld.files.set(ARTIFACT, { targetKey: TK_ARTIFACT })
    const next = makeNext()
    const decision = await env.ctx.trigger(
      makeExec({ name: 'read', arguments: { file_path: ARTIFACT }, callId: 'g2' }),
      next.fn,
    )
    expect(decision).toEqual({ kind: 'allow' })
    expect(env.grantCalls.length).toBe(1)
    expect(env.grantCalls[0]!.instanceId).toBe(INSTANCE)
    expect(env.grantCalls[0]!.rawPath).toBe(ARTIFACT)
    expect(env.grantCalls[0]!.canonicalResourceKey).toBe(TK_ARTIFACT)
    // no control request (the grant authorizes WITHOUT the ask flow)
    expect(env.controlWorld.requestCalls.length).toBe(0)
    expect(next.calls()).toBe(1)
  })

  it('G3: default deny + valid grant → ALLOW, zero requests, exec marked (no second guard)', async () => {
    const env = makeGrantEnv({
      policy: STRICT_READ_POLICY,
      grantVerdict: () => true,
    })
    env.resolverWorld.files.set(ARTIFACT, { targetKey: TK_ARTIFACT })
    const next = makeNext()
    const exec = makeExec({ name: 'read', arguments: { file_path: ARTIFACT }, callId: 'g3' })
    const decision = await env.ctx.trigger(exec, next.fn)
    expect(decision).toEqual({ kind: 'allow' })
    expect(env.grantCalls.length).toBe(1)
    expect(env.controlWorld.requestCalls.length).toBe(0)
    expect(next.calls()).toBe(1)
    // the exec object was marked in the EXISTING authorizedExecutions
    // WeakSet: the end-cap guard (the same one the adapter always
    // registered) abstains for it — no second guard was introduced.
    const endCap = env.ctx.activeGuard()
    expect(endCap).toBeDefined()
    expect(endCap!(exec)).toBeUndefined()
  })

  it('G4: external hard + valid grant → DENY (the shared last-mile recheck)', async () => {
    const env = makeGrantEnv({
      policy: STRICT_READ_POLICY,
      grantVerdict: () => true,
      externalAllowed: false,
      externalReason: 'tools.read is externally hard-denied',
    })
    env.resolverWorld.files.set(ARTIFACT, { targetKey: TK_ARTIFACT })
    const next = makeNext()
    const exec = makeExec({ name: 'read', arguments: { file_path: ARTIFACT }, callId: 'g4' })
    const decision = await env.ctx.trigger(exec, next.fn)
    expect(decision.kind).toBe('deny')
    if (decision.kind === 'deny') {
      expect(decision.reason).toContain('the external hard policy no longer allows read')
    }
    // NOT marked: the end-cap would deny it (zero effect until authorized)
    const endCap = env.ctx.activeGuard()
    expect(endCap!(exec)).toBe(END_CAP_DENIAL_REASON)
    expect(next.calls()).toBe(0)
  })

  it('G5: grants are consumed by `read` ONLY — bash never consults the port', async () => {
    const env = makeGrantEnv({
      policy: STRICT_READ_POLICY,
      grantVerdict: () => true,
    })
    const next = makeNext()
    const decision = await env.ctx.trigger(
      makeExec({
        name: 'bash',
        arguments: { command: 'ls /tmp', description: 'list' },
        callId: 'g5',
      }),
      next.fn,
    )
    // the unchanged pipeline decides (default deny for bash): DENY
    expect(decision.kind).toBe('deny')
    // the grant port was never consulted for a non-read tool
    expect(env.grantCalls.length).toBe(0)
    expect(env.controlWorld.requestCalls.length).toBe(0)
  })

  it('G6: default deny + INVALID grant (no candidate) → unchanged pipeline (DENY)', async () => {
    const env = makeGrantEnv({
      policy: STRICT_READ_POLICY,
      grantVerdict: () => false,
    })
    env.resolverWorld.files.set(ARTIFACT, { targetKey: TK_ARTIFACT })
    const next = makeNext()
    const decision = await env.ctx.trigger(
      makeExec({ name: 'read', arguments: { file_path: ARTIFACT }, callId: 'g6' }),
      next.fn,
    )
    expect(decision.kind).toBe('deny')
    if (decision.kind === 'deny') {
      expect(decision.reason).toContain('the template\'s default (deny)')
    }
    expect(env.grantCalls.length).toBe(1) // consulted, declined
    expect(env.controlWorld.requestCalls.length).toBe(0)
    expect(next.calls()).toBe(0)
  })

  it('G7: default ask + invalid grant → the unchanged pipeline ENTERS THE ASK PATH', async () => {
    const env = makeGrantEnv({
      policy: { default: 'ask', allow: [], ask: [], deny: [] },
      grantVerdict: () => false,
    })
    env.resolverWorld.files.set(ARTIFACT, { targetKey: TK_ARTIFACT })
    const next = makeNext()
    const decision = await env.ctx.trigger(
      makeExec({ name: 'read', arguments: { file_path: ARTIFACT }, callId: 'g7' }),
      next.fn,
    )
    // the ask path was entered: the fake control service RECORDED the
    // request (then threw — a fake artifact; the adapter maps the fault
    // to its typed request-failed deny, unchanged pipeline behavior).
    expect(env.controlWorld.requestCalls.length).toBe(1)
    expect(env.grantCalls.length).toBe(1)
    expect(decision.kind).toBe('deny')
    if (decision.kind === 'deny') {
      expect(decision.reason).toContain('permission request failed')
    }
    expect(next.calls()).toBe(0)
  })

  it('G8: a faulting grant port fails closed — the unchanged pipeline decides', async () => {
    const env = makeGrantEnv({
      policy: STRICT_READ_POLICY,
      grantFault: true,
    })
    env.resolverWorld.files.set(ARTIFACT, { targetKey: TK_ARTIFACT })
    const next = makeNext()
    const decision = await env.ctx.trigger(
      makeExec({ name: 'read', arguments: { file_path: ARTIFACT }, callId: 'g8' }),
      next.fn,
    )
    expect(decision.kind).toBe('deny')
    if (decision.kind === 'deny') {
      expect(decision.reason).toContain('the template\'s default (deny)')
    }
    expect(env.controlWorld.requestCalls.length).toBe(0)
    expect(next.calls()).toBe(0)
  })

  it('G9 (additive): no grant port installed — the pipeline is byte-for-byte unchanged', async () => {
    // the option is absent entirely (backward compatibility): a
    // strict-read default-deny read denies exactly as before, with no
    // grant consultation surface at all.
    const env = makeGrantEnv({ policy: STRICT_READ_POLICY })
    env.resolverWorld.files.set(ARTIFACT, { targetKey: TK_ARTIFACT })
    const next = makeNext()
    const decision = await env.ctx.trigger(
      makeExec({ name: 'read', arguments: { file_path: ARTIFACT }, callId: 'g9' }),
      next.fn,
    )
    expect(decision.kind).toBe('deny')
    expect(env.grantCalls.length).toBe(0)
    expect(next.calls()).toBe(0)
  })
})
