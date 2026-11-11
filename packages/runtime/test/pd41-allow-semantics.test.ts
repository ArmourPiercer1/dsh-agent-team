/**
 * pd41-allow-semantics.test.ts — PD-41 (owner ruling 2026-11-11): a human
 * `allow` authorises ONE constrained dispatch attempt, not a guarantee of
 * execution.
 *
 * A TOOL BINDING FAILURE IS A TYPED REFUSAL. The dispatch door refuses with
 * `ToolDispatchRefusalError` carrying `code: 'TOOL_BINDING_UNVERIFIED'`, the
 * measured `reason`, and the byte-identical Guard sentence; the other refusal
 * classes (`TEAM_TOOL_UNGOVERNED`, `ADAPTER_DRAINING`) keep their own codes, so
 * a recovery path can tell "repair the Binding, then raise a NEW approval
 * request" apart from "declare the tool" / "wait for assembly". The Body
 * provably never runs on any of them.
 *
 * The execution-fact classification this authorisation law pairs with
 * (cancelled/timed-out => `unknown`) lives with the lane that owns the
 * observation: the governed tool lane's own execution-outcome spec.
 *
 * @module test/pd41-allow-semantics
 */
import { describe, expect, it } from 'vitest'
import {
  installScopedToolGuard,
  isToolBindingRefusal,
  ToolDispatchRefusalError,
  type ScopedGuardAgentCtx,
} from '../tool-dispatch/index.js'

// ─────────────────────────────────────────────────────────────────────────────
// B. The typed dispatch refusal
// ─────────────────────────────────────────────────────────────────────────────

interface FakeCtxOptions {
  readonly surface?: readonly string[]
  /** The trusted GLOBAL view. Empty = the measured web-profile world, where
   *  every inherited native name binds UNVERIFIED (the F-4 shape). */
  readonly globalSurface?: readonly string[]
}

function fakeCtx(options: FakeCtxOptions = {}) {
  const surface = [...(options.surface ?? ['read', 'bash'])]
  const globalSurface = [...(options.globalSurface ?? [])]
  const definitions = new Map<string, { name: string; execute: () => unknown }>()
  for (const name of surface) definitions.set(name, { name, execute: () => `native:${name}` })
  const guards: ((exec: { name: string; agent?: unknown }) => string | undefined)[] = []
  const listeners = new Map<string, ((...args: never[]) => unknown)[]>()
  let bodyExecs = 0
  const ctx = {
    tools: {
      guard: (guard: (exec: { name: string; agent?: unknown }) => string | undefined) => {
        guards.push(guard)
        return () => {
          const at = guards.indexOf(guard)
          if (at >= 0) guards.splice(at, 1)
        }
      },
      schemas: (scope?: unknown) => (scope === undefined ? globalSurface : surface).map((name) => ({ name })),
      get: (name: string, scope?: unknown) => (scope === undefined ? undefined : definitions.get(name)),
    },
    on: (event: string, listener: (...args: never[]) => unknown) => {
      const list = listeners.get(event) ?? []
      list.push(listener)
      listeners.set(event, list)
      return () => {
        const at = list.indexOf(listener)
        if (at >= 0) list.splice(at, 1)
      }
    },
  } as unknown as ScopedGuardAgentCtx
  /** Drive ONLY the `tools/execute` waterfall (the dispatch DOOR): the stage
   *  whose refusal this test is about. The `tools/guard` stage is the same
   *  decision one step earlier and is exercised by its own suites. */
  const driveExecute = (input: { callId: string; name: string; agent?: unknown }, body: () => Promise<unknown>) => {
    const exec = input.agent === undefined ? { ...input, agent: { id: 'agent-m1' } } : input
    const list = listeners.get('tools/execute') ?? []
    let index = 0
    const next = async (): Promise<unknown> => {
      const listener = list[index]
      index += 1
      if (listener === undefined) {
        bodyExecs += 1
        return await body()
      }
      return await (listener as unknown as (...a: unknown[]) => Promise<unknown>)(exec, next)
    }
    return next()
  }
  return {
    ctx,
    bodyExecs: () => bodyExecs,
    /** Drive one call the way the pinned registry does: the `tools/guard` stage
     *  first, then the `tools/execute` waterfall, then the Body. */
    runDoor: driveExecute,
    runExecute: async (input: { callId: string; name: string; agent?: unknown }, body: () => Promise<unknown>) => {
      const exec = input.agent === undefined ? { ...input, agent: { id: 'agent-m1' } } : input
      for (const guard of [...guards]) {
        const denial = guard(exec as { name: string; agent?: unknown })
        if (denial !== undefined) throw new Error(denial)
      }
      const drive = (event: string, inner: () => Promise<unknown>): Promise<unknown> => {
        const list = listeners.get(event) ?? []
        let index = 0
        const next = async (): Promise<unknown> => {
          const listener = list[index]
          index += 1
          if (listener === undefined) return await inner()
          return await (listener as unknown as (...a: unknown[]) => Promise<unknown>)(exec, next)
        }
        return next()
      }
      const run = async (): Promise<unknown> => {
        bodyExecs += 1
        return await body()
      }
      return await drive('tools/execute', run)
    },
  }
}

function armedGuard(world: ReturnType<typeof fakeCtx>, over: Record<string, unknown> = {}) {
  const outcome = installScopedToolGuard({
    agentCtx: world.ctx,
    runtimeAgent: { id: 'agent-m1', session: { header: { id: 'session-m1' } } },
    agentScopeKey: 'session-m1',
    trustedIdentities: ['session-m1', 'agent-m1'],
    // The measured web-profile fact: the trusted GLOBAL view is EMPTY, so the
    // inherited-native lane cannot verify anything (bind-diag law, F-4 world).
    nativeNames: [],
    ...over,
  })
  if (!outcome.ok) throw new Error(outcome.error.message)
  const published = outcome.value.publish()
  if (!published.ok) throw new Error(published.error.message)
  return outcome.value
}

const VERBATIM_BASH_REFUSAL =
  'team tool guard: the Tool Binding for "bash" cannot be verified at dispatch time (no fallback to the native body)'

describe('PD-41 B — a Tool Binding failure is an explicit TYPED refusal', () => {
  it('the dispatch door throws ToolDispatchRefusalError with the Binding code, the measured reason and the VERBATIM sentence', async () => {
    const world = fakeCtx()
    armedGuard(world)
    let caught: unknown
    try {
      await world.runDoor({ callId: 'pd41-door-1', name: 'bash' }, async () => 'body-ran')
    } catch (error) {
      caught = error
    }
    expect(caught).toBeInstanceOf(ToolDispatchRefusalError)
    if (!(caught instanceof ToolDispatchRefusalError)) throw new Error('unreachable')
    expect(caught.code).toBe('TOOL_BINDING_UNVERIFIED')
    expect(caught.reason).toBe('binding-unverified')
    expect(caught.toolName).toBe('bash')
    // byte-identical sentence + the existing positional suffix
    expect(caught.message).toBe(`${VERBATIM_BASH_REFUSAL} [refused at the dispatch door, the stage nearest the Body]`)
    // distinguishable by the ONE question a recovery path asks
    expect(isToolBindingRefusal(caught)).toBe(true)
    // and the Body provably never ran
    expect(world.bodyExecs()).toBe(0)
  })

  it('the other refusal classes keep their own codes (never flattened into the Binding code)', async () => {
    // (1) never governed → TEAM_TOOL_UNGOVERNED
    const ungovernedWorld = fakeCtx({ surface: ['read'] })
    armedGuard(ungovernedWorld)
    let ungoverned: unknown
    try {
      await ungovernedWorld.runDoor({ callId: 'pd41-door-ghost', name: 'ghost' }, async () => 'body-ran')
    } catch (error) {
      ungoverned = error
    }
    expect(ungoverned).toBeInstanceOf(ToolDispatchRefusalError)
    if (!(ungoverned instanceof ToolDispatchRefusalError)) throw new Error('unreachable')
    expect(ungoverned.code).toBe('TEAM_TOOL_UNGOVERNED')
    expect(isToolBindingRefusal(ungoverned)).toBe(false)
    expect(ungovernedWorld.bodyExecs()).toBe(0)

    // (2) dispatcher draining → ADAPTER_DRAINING (assembly state, not a Binding)
    const drainingWorld = fakeCtx()
    const handle = armedGuard(drainingWorld)
    const draining = handle.dispatcher.beginDrain()
    if (!draining.ok) throw new Error(draining.error.message)
    let caught: unknown
    try {
      await drainingWorld.runDoor({ callId: 'pd41-door-drain', name: 'bash' }, async () => 'body-ran')
    } catch (error) {
      caught = error
    }
    expect(caught).toBeInstanceOf(ToolDispatchRefusalError)
    if (!(caught instanceof ToolDispatchRefusalError)) throw new Error('unreachable')
    expect(caught.code).toBe('ADAPTER_DRAINING')
    expect(caught.reason).toBe('dispatcher-not-active')
    expect(isToolBindingRefusal(caught)).toBe(false)
    expect(drainingWorld.bodyExecs()).toBe(0)
  })

  it('the host `tools.guard` seam keeps returning the same PROSE (the typed form is additive)', () => {
    const world = fakeCtx()
    const handle = armedGuard(world)
    // `tools.guard` is `(exec) => string | undefined` upstream; the typed shape
    // is a second accessor on the dispatcher handle, never a change to the seam.
    expect(handle.dispatcher.guard({ name: 'bash', agentIdentity: 'agent-m1' })).toBe(VERBATIM_BASH_REFUSAL)
    expect(handle.dispatcher.denial({ name: 'bash', agentIdentity: 'agent-m1' })).toEqual({
      toolName: 'bash',
      code: 'TOOL_BINDING_UNVERIFIED',
      reason: 'binding-unverified',
      message: VERBATIM_BASH_REFUSAL,
    })
    expect(handle.dispatcher.guard({ name: 'bash', agentIdentity: 'agent-m1', })?.includes('refused at the dispatch door')).toBe(false)
  })
})
