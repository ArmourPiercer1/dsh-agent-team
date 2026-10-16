/**
 * a5p1-guard-install.test.ts — Alpha.5 PR1 (plan §4, design §4.1): the
 * INSTALL of the Guard on one Team Agent's public seams, driven by a fake
 * agent ctx that behaves like the pinned host's `ToolRuntime` surface
 * (`tools.guard` / `tools.schemas(scope)` / `on('tools/change')` /
 * `on('tools/execute')`, all documented in the pinned
 * `packages/core/tools/lib/types/index.d.ts`).
 *
 * The three things a unit test can prove and a Host smoke cannot isolate:
 *  1. the ORDER (Guard armed before the mask exists; the mask lifted only at
 *     RELEASED, with the Guard removed last);
 *  2. the required-service failure (a silently PENDING fiber is not an
 *     assembled dependency — the Guard install must REFUSE, not half-arm);
 *  3. the in-flight self-count: a `tools/execute` body that has not returned
 *     keeps the teardown stopped with the mask and the Guard still armed,
 *     even after the host's own dispose has returned.
 *
 * @module test/a5p1-guard-install
 */
import { describe, expect, it } from 'vitest'
import { installScopedToolGuard, requireService, type ScopedGuardAgentCtx } from '../tool-dispatch/index.js'

interface FakeCtxOptions {
  readonly surface?: string[]
  readonly withGuard?: boolean
  readonly withSchemas?: boolean
}

/** A fake agent ctx: registries are arrays so an order assertion is possible. */
function fakeCtx(options: FakeCtxOptions = {}) {
  const surface = [...(options.surface ?? ['read', 'bash'])]
  const guards: ((exec: { name: string; agent?: unknown }) => string | undefined)[] = []
  const listeners = new Map<string, ((...args: never[]) => unknown)[]>()
  const order: string[] = []
  const ctx = {
    tools: {
      ...(options.withGuard === false
        ? {}
        : {
            guard: (guard: (exec: { name: string; agent?: unknown }) => string | undefined) => {
              guards.push(guard)
              order.push('guard')
              return () => {
                const at = guards.indexOf(guard)
                if (at >= 0) guards.splice(at, 1)
                order.push('guard-off')
              }
            },
          }),
      schemas:
        options.withSchemas === false
          ? undefined
          : (scope?: unknown) => {
              if (scope === undefined) return [] // the global view is never a substitute
              return surface.map((name) => ({ name }))
            },
    },
    on: (event: string, listener: (...args: never[]) => unknown) => {
      const list = listeners.get(event) ?? []
      list.push(listener)
      listeners.set(event, list)
      order.push(`on:${event}`)
      return () => {
        const at = list.indexOf(listener)
        if (at >= 0) list.splice(at, 1)
      }
    },
  } as unknown as ScopedGuardAgentCtx

  return {
    ctx,
    surface,
    order,
    /** Run the registered guard chain the way the registry does. */
    runGuards: (exec: { name: string; agent?: unknown }) => {
      for (const guard of [...guards]) {
        const denial = guard(exec)
        if (denial !== undefined) return denial
      }
      return undefined
    },
    /** Drive one call the way the PINNED registry does (measured, not assumed:
     *  `a5p1-order-hazard.mjs` re-measures this on the real registry):
     *  `tools/pre-execute` waterfall -> `tools/execute` waterfall -> Body ->
     *  `tools/post-execute` waterfall (which fires with the result in hand,
     *  including an errored one, and is where this Dispatcher ends its lease).
     *  A listener that throws short-circuits, exactly like a Guard denial: the
     *  Body is skipped, and `post-execute` still runs with the error result. */
    runExecute: async (exec: { callId: string; name: string; agent?: unknown }, body: () => Promise<unknown>) => {
      const drive = (event: string, inner: () => Promise<unknown>, args: unknown[] = [exec]): Promise<unknown> => {
        const list = listeners.get(event) ?? []
        let index = 0
        const next = async (): Promise<unknown> => {
          const listener = list[index]
          index += 1
          if (listener === undefined) return await inner()
          return await (listener as unknown as (...a: unknown[]) => Promise<unknown>)(...args, next)
        }
        return next()
      }
      let result: unknown
      try {
        result = await drive('tools/pre-execute', () => drive('tools/execute', body))
      } catch (error) {
        result = { isError: true, text: String((error as Error)?.message ?? error) }
        await drive('tools/post-execute', async () => result, [exec, result])
        throw error
      }
      await drive('tools/post-execute', async () => result, [exec, result])
      return result
    },
    fireChange: () => {
      for (const listener of listeners.get('tools/change') ?? []) (listener as () => void)()
    },
  }
}

function install(host: ReturnType<typeof fakeCtx>, over: Record<string, unknown> = {}) {
  return installScopedToolGuard({
    agentCtx: host.ctx,
    runtimeAgent: { id: 'agent-m1', session: { header: { id: 'session-m1' } } },
    agentScopeKey: 'session-m1',
    trustedIdentities: ['session-m1', 'agent-m1'],
    ...over,
  })
}

describe('the install order IS the security property', () => {
  it('I1 the Guard is armed before the mask exists, on the public tools.guard seam', () => {
    const host = fakeCtx()
    const outcome = install(host, { maskedNames: ['bash'] })
    expect(outcome.ok).toBe(true)
    // Nothing has been published yet, but the Guard is already live.
    expect(host.order).toContain('guard')
    expect(host.order.indexOf('guard')).toBeLessThan(host.order.indexOf('on:tools/execute'))
    expect(host.runGuards({ name: 'read', agent: { id: 'agent-m1' } })).toContain('not ACTIVE')
  })

  it('I2 a missing tools.guard seam refuses the install (no half-armed agent)', () => {
    const host = fakeCtx({ withGuard: false })
    const outcome = install(host)
    expect(outcome.ok).toBe(false)
    if (outcome.ok) return
    expect(outcome.error.code).toBe('IO_POLICY_UNSUPPORTED')
    expect(outcome.error.message).toContain('tools.guard')
    expect(host.order).toEqual(['on:tools/change', 'on:tools/execute'].filter((o) => host.order.includes(o)))
    expect(host.order).not.toContain('guard')
  })

  it('I3 requireService turns an absent dependency into a typed refusal', () => {
    expect(requireService(undefined, 'subprocess').ok).toBe(false)
    expect(requireService(null, 'fs', (v) => typeof (v as { contains?: unknown }).contains === 'function').ok).toBe(false)
    const resolved = requireService({ contains: () => true }, 'fs', (v) => typeof v.contains === 'function')
    expect(resolved.ok).toBe(true)
    if (!resolved.ok) return
    expect(resolved.value).toEqual({ contains: expect.any(Function) })
  })

  it('I4 publish reads the AGENT-scoped surface and nothing dispatches before it', async () => {
    const host = fakeCtx({ surface: ['read', 'bash', 'team_delegate'] })
    const outcome = install(host)
    if (!outcome.ok) throw new Error(outcome.error.message)
    const handle = outcome.value
    expect(handle.dispatcher.state()).toBe('PREPARING')
    // The outer state gate refuses before the body — and before the lease: an
    // unpublished Agent has no dispatchable surface at all.
    expect(await host.runExecute({ callId: 'c0', name: 'read' }, async () => 'RAN').catch((e: Error) => e.message)).toContain(
      'not ACTIVE',
    )
    expect(handle.dispatcher.inFlight()).toBe(0)
    expect(handle.publish().ok).toBe(true)
    expect(handle.dispatcher.state()).toBe('ACTIVE')
    expect(handle.dispatcher.surface.names()).toEqual(['bash', 'read', 'team_delegate'])
    expect(await host.runExecute({ callId: 'c1', name: 'read' }, async () => 'RAN')).toBe('RAN')
  })

  it('I5 a surface that cannot be read fails the assembly (no partial publish)', () => {
    const host = fakeCtx({ withSchemas: false })
    const outcome = install(host)
    if (!outcome.ok) throw new Error(outcome.error.message)
    const published = outcome.value.publish()
    expect(published.ok).toBe(false)
    if (published.ok) return
    expect(published.error.code).toBe('IO_POLICY_UNSUPPORTED')
    expect(outcome.value.dispatcher.state()).toBe('UNBOUND')
  })
})

describe('the closed world over real registrations', () => {
  it('I6 a name registered AFTER setup is denied until the Team binds it', () => {
    const host = fakeCtx({ surface: ['read'] })
    const outcome = install(host)
    if (!outcome.ok) throw new Error(outcome.error.message)
    const handle = outcome.value
    expect(handle.publish().ok).toBe(true)
    // The handle exposes no way to allow a call: every door it has is a bind,
    // a diagnostic or a refusal.
    expect(Object.keys(handle).sort()).toEqual([
      'bindMcpTools',
      'bindOwnTools',
      'dispatcher',
      'disposeOrdered',
      'observations',
      'publish',
      'revalidate',
      'surfaceNames',
    ])

    // The dyn probe appears on the surface (an own-layer registration).
    host.surface.push('a5p1_dyn_probe')
    host.fireChange()
    const denial = host.runGuards({ name: 'a5p1_dyn_probe', agent: { id: 'agent-m1' } })
    expect(denial).toContain('no Team Tool Binding')
    expect(denial).toContain('TEAM_TOOL_UNGOVERNED'.toLowerCase() === 'x' ? 'x' : 'closed world')
    const revalidated = handle.revalidate()
    expect(revalidated.denied).toContain('a5p1_dyn_probe')

    // The trusted assembly binds it (an MCP reconcile, a Team registration):
    expect(handle.bindMcpTools(['a5p1_dyn_probe']).ok).toBe(true)
    expect(host.runGuards({ name: 'a5p1_dyn_probe', agent: { id: 'agent-m1' } })).toBeUndefined()
  })

  it('I7 foreign and identity-less calls are refused on a governed name', () => {
    const host = fakeCtx({ surface: ['read'] })
    const outcome = install(host)
    if (!outcome.ok) throw new Error(outcome.error.message)
    expect(outcome.value.publish().ok).toBe(true)
    expect(host.runGuards({ name: 'read', agent: { id: 'agent-somebody-else' } })).toContain('Agent identity')
    expect(host.runGuards({ name: 'read' })).toContain('without any Agent identity')
    expect(host.runGuards({ name: 'read', agent: { id: 'agent-m1' } })).toBeUndefined()
  })
})

describe('the ordered teardown (NEG-1) over the real seams', () => {
  it('I8 with no in-flight work the mask lifts first and the Guard goes last', () => {
    const host = fakeCtx({ surface: ['read'] })
    let lifted = 0
    const outcome = install(host, {
      maskPort: {
        lift: () => {
          lifted += 1
          host.order.push('mask-lift')
        },
      },
    })
    if (!outcome.ok) throw new Error(outcome.error.message)
    const handle = outcome.value
    expect(handle.publish().ok).toBe(true)

    expect(handle.disposeOrdered().ok).toBe(true)
    expect(lifted).toBe(1)
    expect(host.order.indexOf('mask-lift')).toBeLessThan(host.order.indexOf('guard-off'))
    expect(host.order[host.order.length - 1]).toBe('guard-off')
    // After the ordered teardown the scope is genuinely gone.
    expect(host.runGuards({ name: 'read', agent: { id: 'agent-m1' } })).toBeUndefined()
  })

  it('I9 an in-flight body stops RELEASED: the mask AND the Guard stay armed', async () => {
    const host = fakeCtx({ surface: ['read'] })
    let lifted = 0
    const outcome = install(host, {
      maskPort: {
        lift: () => {
          lifted += 1
        },
      },
    })
    if (!outcome.ok) throw new Error(outcome.error.message)
    const handle = outcome.value
    expect(handle.publish().ok).toBe(true)

    let releaseBody!: () => void
    const running = host.runExecute({ callId: 'slow', name: 'read' }, () => new Promise<string>((resolve) => {
      releaseBody = () => resolve('RAN')
    }))

    // The host's own dispose has already returned. It proves nothing.
    handle.dispatcher.noteHostDisposeReturned()
    const disposed = handle.disposeOrdered()
    expect(disposed.ok).toBe(false)
    if (disposed.ok) return
    expect(disposed.error.code).toBe('EXECUTION_TERMINATION_UNCONFIRMED')
    expect(lifted).toBe(0)
    expect(handle.dispatcher.maskMayLift()).toBe(false)
    // A late callback for the same Agent keeps meeting the refusal.
    expect(host.runGuards({ name: 'read', agent: { id: 'agent-m1' } })).toContain('not ACTIVE')

    releaseBody()
    expect(await running).toBe('RAN')
    expect(handle.dispatcher.inFlight()).toBe(0)

    // Second, ordered attempt: now the zero count lets it finish.
    expect(handle.disposeOrdered().ok).toBe(true)
    expect(lifted).toBe(1)
  })

  it('I10 a body that throws still settles its lease (no phantom in-flight)', async () => {
    const host = fakeCtx({ surface: ['read'] })
    const outcome = install(host)
    if (!outcome.ok) throw new Error(outcome.error.message)
    const handle = outcome.value
    expect(handle.publish().ok).toBe(true)
    await expect(
      host.runExecute({ callId: 'boom', name: 'read' }, async () => {
        throw new Error('body exploded')
      }),
    ).rejects.toThrow('body exploded')
    expect(handle.dispatcher.inFlight()).toBe(0)
    expect(handle.disposeOrdered().ok).toBe(true)
  })

  it('I11 a call racing in WHILE draining never runs its body', async () => {
    const host = fakeCtx({ surface: ['read'] })
    const outcome = install(host)
    if (!outcome.ok) throw new Error(outcome.error.message)
    const handle = outcome.value
    expect(handle.publish().ok).toBe(true)

    // One body is in flight; the drain starts around it (the NEG-1 window:
    // the registry's late re-resolution is exactly here).
    let releaseBody!: () => void
    const running = host.runExecute({ callId: 'slow', name: 'read' }, () => new Promise<string>((resolve) => {
      releaseBody = () => resolve('RAN')
    }))
    expect(handle.dispatcher.beginDrain().ok).toBe(true)

    let ran = false
    const raced = await host
      .runExecute({ callId: 'race', name: 'read' }, async () => {
        ran = true
        return 'RAN'
      })
      .catch((error: Error) => error.message)
    expect(ran).toBe(false)
    expect(String(raced)).toContain('DRAINING')
    // The refusal took no lease: the drain is not blocked by calls it turned
    // away, only by work it actually admitted.
    expect(handle.dispatcher.inFlight()).toBe(1)
    // And the Guard denies it too, independently of the counter.
    expect(host.runGuards({ name: 'read', agent: { id: 'agent-m1' } })).toContain('not ACTIVE')

    releaseBody()
    expect(await running).toBe('RAN')
  })
})
