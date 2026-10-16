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
  /** Names visible in the GLOBAL view (everything else on the agent surface is
   *  scope-local, i.e. contributed to THIS agent and never inherited as native). */
  readonly globalSurface?: string[]
  /** Definitions the public `tools.get(name, scope)` seam resolves, by name. */
  readonly definitions?: Record<string, string>
  /** Refuse to register one edge (the R3 assembly-atomicity tests). */
  readonly throwOn?: string
  /** Do not register one edge at all (the R3 required-seam test). */
  readonly drop?: string
  /** Hide a public seam entirely (`on`, or `get`). */
  readonly without?: 'on' | 'get'
}

/** A fake agent ctx: registries are arrays so an order assertion is possible. */
function fakeCtx(options: FakeCtxOptions = {}) {
  const surface = [...(options.surface ?? ['read', 'bash'])]
  const globalSurface = options.globalSurface ?? surface
  // The registry hands back the SAME definition object for repeated reads of
  // one registration, so the doubles must too — otherwise the definition check
  // would see a new Body on every read for the wrong reason.
  const definitions = new Map<string, { name: string; execute: () => unknown }>()
  const defineRow = (name: string, identity: string): void => {
    definitions.set(name, { name, execute: () => identity })
  }
  /** A name on the surface HAS a registered definition; reading it twice
   *  returns the SAME object, exactly like the registry's layer lookup. */
  let seamBroken = false
  const definitionOf = (name: string): { name: string; execute: () => unknown } | undefined => {
    if (seamBroken) return undefined
    const existing = definitions.get(name)
    if (existing !== undefined) return existing
    if (!surface.includes(name)) return undefined
    defineRow(name, `def:${name}`)
    return definitions.get(name)
  }
  for (const name of surface) defineRow(name, `def:${name}`)
  for (const [name, identity] of Object.entries(options.definitions ?? {})) defineRow(name, identity)
  const fired: string[] = []
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
              // The GLOBAL view (no scope) is a real, public read — F1's native
              // provenance is measured against it; it is never a substitute for
              // the agent-scoped surface.
              if (scope === undefined) return globalSurface.map((name) => ({ name }))
              return surface.map((name) => ({ name }))
            },
      ...(options.without === 'get'
        ? {}
        : {
            /** The pinned Host's public definition accessor. */
            get: (name: string, scope?: unknown) =>
              scope === undefined ? undefined : definitionOf(name),
          }),
    },
    ...(options.without === 'on'
      ? {}
      : {
    on: (event: string, listener: (...args: never[]) => unknown) => {
      if (options.throwOn === event || options.drop === event) throw new Error(`fixture: refusing to register ${event}`)
      const list = listeners.get(event) ?? []
      list.push(listener)
      listeners.set(event, list)
      order.push(`on:${event}`)
      return () => {
        const at = list.indexOf(listener)
        if (at >= 0) list.splice(at, 1)
      }
    },
      }),
  } as unknown as ScopedGuardAgentCtx

  return {
    ctx,
    surface,
    globalSurface,
    order,
    guards,
    listeners,
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
    runExecute: async (input: { callId: string; name: string; agent?: unknown }, body: () => Promise<unknown>) => {
      // The agent loop always sets `exec.agent`; a call that reaches the
      // registry without one is refused on identity, so the double supplies the
      // Team Agent by default (a test that wants the identity-less shape says
      // `agent: null` explicitly).
      const exec = input.agent === undefined ? { ...input, agent: { id: 'agent-m1' } } : input
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
      // The `tools/guard` stage runs before any waterfall (measured): a denial
      // there skips `tools/execute` and the Body entirely, and the call still
      // settles through `post-execute` and `tools/result`.
      const denial = guards.reduce<string | undefined>(
        (acc, guardFn) => (acc !== undefined ? acc : guardFn(exec as { name: string; agent?: unknown })),
        undefined,
      )
      if (denial !== undefined) {
        const refused = { isError: true, text: denial }
        await drive('tools/post-execute', async () => refused, [exec, refused])
        for (const listener of listeners.get('tools/result') ?? []) {
          await (listener as unknown as (...a: unknown[]) => unknown)(exec, refused)
        }
        throw new Error(denial)
      }
      let result: unknown
      try {
        result = await drive('tools/pre-execute', () => drive('tools/execute', body))
      } catch (error) {
        result = { isError: true, text: String((error as Error)?.message ?? error) }
        await drive('tools/post-execute', async () => result, [exec, result])
        // The registry finalizes an errored outcome the same way and notifies
        // it (`finalizeScheduledExecution` catch → `finishScheduledExecution`
        // → `notifyResult`), so the settled edge fires for it too.
        for (const listener of listeners.get('tools/result') ?? []) {
          await (listener as unknown as (...a: unknown[]) => unknown)(exec, result)
        }
        throw error
      }
      await drive('tools/post-execute', async () => result, [exec, result])
      // `tools/result` is an EMIT edge, dispatched by the registry after the
      // body settled and after `tools/post-execute` ran (measured against
      // `packages/core/tools/src/index.ts`: body → postExecute →
      // finishScheduledExecution → notifyResult). It carries no `next`.
      fired.push('tools/result')
      for (const listener of listeners.get('tools/result') ?? []) {
        await (listener as unknown as (...a: unknown[]) => unknown)(exec, result)
      }
      return result
    },
    /** Fire only the `tools/post-execute` edge (a result exists, the body
     *  return is NOT yet proven) — the R4 test needs that window. */
    firePostExecuteOnly: async (input: { callId: string; name: string }, result: unknown) => {
      const exec = { ...input, agent: { id: 'agent-m1' } }
      await (async () => {
        const list = listeners.get('tools/post-execute') ?? []
        let index = 0
        const next = async (): Promise<unknown> => {
          const listener = list[index]
          index += 1
          if (listener === undefined) return result
          return await (listener as unknown as (...a: unknown[]) => Promise<unknown>)(exec, result, next)
        }
        await next()
      })()
    },
    /** Fire the settled edge by hand (a LATE callback after a teardown). */
    fireResultSettled: async (input: { callId: string; name: string }, result: unknown) => {
      const exec = { ...input, agent: { id: 'agent-m1' } }
      for (const listener of listeners.get('tools/result') ?? []) {
        await (listener as unknown as (...a: unknown[]) => unknown)(exec, result)
      }
    },
    /** Swap what the public `tools.get` seam resolves for one name (the same
     *  Scope, the same name, a DIFFERENT body — the R2 hazard). */
    swapDefinition: (name: string, identity: string) => {
      defineRow(name, identity)
    },
    /** Make the public definition seam unreadable for every name. */
    breakDefinitionSeam: () => {
      seamBroken = true
      definitions.clear()
    },
    fireChange: () => {
      for (const listener of listeners.get('tools/change') ?? []) (listener as () => void)()
    },
  }
}

/**
 * Install with the assembly's trust declared the way the real assembly declares
 * it: a name is native only if the GLOBAL public view also shows it, so a
 * scope-local contribution (a Team tool, an MCP tool, anything a row registered
 * for this one Agent) can never inherit a native Binding by accident.
 */
function install(host: ReturnType<typeof fakeCtx>, over: Record<string, unknown> = {}) {
  return installScopedToolGuard({
    agentCtx: host.ctx,
    runtimeAgent: { id: 'agent-m1', session: { header: { id: 'session-m1' } } },
    agentScopeKey: 'session-m1',
    trustedIdentities: ['session-m1', 'agent-m1'],
    // What the real assembly passes: the names the Host's GLOBAL public view
    // also shows. A name that only this Agent can see is not a native.
    nativeNames: host.globalSurface,
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
    // PR1 GATE R4 re-cast (a strengthening, recorded in the PR body): a settled
    // callback that arrives after the drain began is refused as termination
    // evidence, so the lease is still outstanding and the second attempt still
    // refuses. The half-state keeps the mask and the Guard armed rather than
    // disarming on a termination it cannot prove it observed.
    expect(handle.dispatcher.inFlight()).toBe(1)
    expect(handle.observations().some((o) => String(o.event) === 'dispatcher-late-settled-after-teardown')).toBe(true)
    const second = handle.disposeOrdered()
    expect(second.ok).toBe(false)
    expect(lifted).toBe(0)
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
    // The refusal now arrives at the EARLIEST door — the Guard stage, before
    // the waterfalls — so its text is the closed-world one; the state it
    // refused from is asserted separately, so the DRAINING-specific claim the
    // test made before is still on the record.
    expect(String(raced)).toContain('not ACTIVE')
    expect(handle.dispatcher.state()).toBe('DRAINING')
    // The refusal took no lease: the drain is not blocked by calls it turned
    // away, only by work it actually admitted.
    expect(handle.dispatcher.inFlight()).toBe(1)
    // And the Guard denies it too, independently of the counter.
    expect(host.runGuards({ name: 'read', agent: { id: 'agent-m1' } })).toContain('not ACTIVE')

    releaseBody()
    expect(await running).toBe('RAN')
  })
})


describe('PR1 Gate R3 / R4 — install atomicity and the body-return-proven edge', () => {
  it('R3 a missing ctx.on is an assembly failure that leaves nothing armed', () => {
    const host = fakeCtx({ surface: ['read'], without: 'on' })
    const outcome = install(host)
    expect(outcome.ok).toBe(false)
    if (outcome.ok) return
    expect(outcome.error.code).toBe('IO_POLICY_UNSUPPORTED')
    expect(outcome.error.message).toContain('tools/pre-execute')
    // ZERO residue: the Guard that was already installed is disposed again.
    expect(host.guards).toHaveLength(0)
    expect(host.order).toContain('guard-off')
  })

  it('R3b a pre-execute registration that throws is an assembly failure, not a degraded Guard', () => {
    const host = fakeCtx({ surface: ['read'], throwOn: 'tools/pre-execute' })
    const outcome = install(host)
    expect(outcome.ok).toBe(false)
    if (outcome.ok) return
    expect(outcome.error.message).toContain('tools/pre-execute')
    expect(host.guards).toHaveLength(0)
    expect([...host.listeners.values()].flat()).toHaveLength(0)
  })

  it('R3c a required seam that cannot be armed fails the install (a missing door is never a silent RELEASED)', () => {
    const host = fakeCtx({ surface: ['read'], drop: 'tools/result' })
    const outcome = install(host)
    expect(outcome.ok).toBe(false)
    if (outcome.ok) return
    expect(outcome.error.message).toContain('tools/result')
    expect(host.guards).toHaveLength(0)
  })

  it('R3d the armed-seam count is asserted, not assumed', () => {
    const host = fakeCtx({ surface: ['read'] })
    const outcome = install(host)
    if (!outcome.ok) throw new Error(outcome.error.message)
    expect(outcome.value.dispatcher.requiredSeams()).toBe(5)
    expect(outcome.value.dispatcher.seamsArmed()).toHaveLength(5)
    expect(outcome.value.publish().ok).toBe(true)
  })

  it('R4 the settled edge ends a lease; post-execute alone proves nothing about the body', async () => {
    const host = fakeCtx({ surface: ['read'] })
    const outcome = install(host)
    if (!outcome.ok) throw new Error(outcome.error.message)
    const handle = outcome.value
    expect(handle.publish().ok).toBe(true)

    let settleBody: (value: unknown) => void = () => {}
    const body = new Promise<unknown>((resolve) => {
      settleBody = resolve
    })
    const driving = host.runExecute({ callId: 'c1', name: 'read' }, () => body)
    await Promise.resolve()
    expect(handle.dispatcher.inFlight()).toBe(1)

    // A result exists while the body is still alive: the drain must NOT be
    // allowed to conclude that nothing is running.
    await host.firePostExecuteOnly({ callId: 'c1', name: 'read' }, { text: 'early result' })
    expect(handle.dispatcher.inFlight()).toBe(1)

    settleBody('RAN')
    await driving
    expect(handle.dispatcher.inFlight()).toBe(0)
  })

  it('R4b a call whose body has not returned keeps the mask and the Guard armed through the teardown', async () => {
    const host = fakeCtx({ surface: ['read'] })
    let lifted = 0
    const outcome = install(host, { maskPort: { lift: () => { lifted += 1 } } })
    if (!outcome.ok) throw new Error(outcome.error.message)
    const handle = outcome.value
    expect(handle.publish().ok).toBe(true)

    let settleBody: (value: unknown) => void = () => {}
    const body = new Promise<unknown>((resolve) => {
      settleBody = resolve
    })
    const driving = host.runExecute({ callId: 'c2', name: 'read' }, () => body)
    await Promise.resolve()

    const stopped = handle.disposeOrdered()
    expect(stopped.ok).toBe(false)
    if (stopped.ok) return
    expect(stopped.error.code).toBe('EXECUTION_TERMINATION_UNCONFIRMED')
    expect(lifted).toBe(0)
    expect(host.guards).toHaveLength(1)

    // A Body that returns AFTER the drain began is not retroactive proof that
    // the drain may finish: the half-state keeps the mask and the Guard armed
    // forever rather than disarming on an unproven termination (PR1 Gate R4,
    // "绝不撤防"). The caller is left with the typed refusal as its evidence.
    settleBody('RAN')
    await driving
    const after = handle.disposeOrdered()
    expect(after.ok).toBe(false)
    if (after.ok) return
    expect(after.error.code).toBe('EXECUTION_TERMINATION_UNCONFIRMED')
    expect(handle.dispatcher.state()).toBe('TOMBSTONED')
    expect(lifted).toBe(0)
    expect(host.guards).toHaveLength(1)
  })

  it('R4c a late settled callback after TOMBSTONED never lifts the mask and never revives the scope', async () => {
    const host = fakeCtx({ surface: ['read'] })
    let lifted = 0
    const outcome = install(host, { maskPort: { lift: () => { lifted += 1 } } })
    if (!outcome.ok) throw new Error(outcome.error.message)
    const handle = outcome.value
    expect(handle.publish().ok).toBe(true)

    let settleBody: (value: unknown) => void = () => {}
    const body = new Promise<unknown>((resolve) => {
      settleBody = resolve
    })
    const driving = host.runExecute({ callId: 'c3', name: 'read' }, () => body)
    await Promise.resolve()
    const first = handle.disposeOrdered()
    expect(first.ok).toBe(false)

    // The Agent scope is gone; a callback that arrives afterwards must be
    // refused and recorded, never treated as proof that the drain may finish.
    await host.fireResultSettled({ callId: 'c3', name: 'read' }, { text: 'late' })
    expect(handle.dispatcher.state()).toBe('TOMBSTONED')
    expect(lifted).toBe(0)
    expect(handle.dispatcher.inFlight()).toBe(1)
    expect(handle.observations().some((o) => String(o.event).includes('late-settled-after'))).toBe(true)

    settleBody('RAN')
    await driving
  })

  it('R4d the caller may declare the drain given up: the half-state stays armed (the lane reads no clock)', () => {
    const host = fakeCtx({ surface: ['read'] })
    let lifted = 0
    const outcome = install(host, { maskPort: { lift: () => { lifted += 1 } } })
    if (!outcome.ok) throw new Error(outcome.error.message)
    const handle = outcome.value
    expect(handle.publish().ok).toBe(true)
    expect(handle.dispatcher.beginCall('c4', 'read').ok).toBe(true)
    expect(handle.dispatcher.beginDrain().ok).toBe(true)
    expect(handle.dispatcher.noteDrainGiveUp('teardown wait exhausted').ok).toBe(true)
    const released = handle.dispatcher.release()
    expect(released.ok).toBe(false)
    if (released.ok) return
    expect(released.error.code).toBe('EXECUTION_TERMINATION_UNCONFIRMED')
    expect(handle.dispatcher.state()).toBe('DRAINING')
    expect(lifted).toBe(0)
  })

  it('R2 the same name resolving to a different body is refused at the seam', async () => {
    const host = fakeCtx({ surface: ['read'] })
    const outcome = install(host)
    if (!outcome.ok) throw new Error(outcome.error.message)
    expect(outcome.value.publish().ok).toBe(true)
    expect(await host.runExecute({ callId: 'r2-a', name: 'read' }, async () => 'RAN')).toBe('RAN')

    host.swapDefinition('read', 'def:read:attacker')
    let swappedBodyRan = false
    const raced = await host
      .runExecute({ callId: 'r2-b', name: 'read' }, async () => {
        swappedBodyRan = true
        return 'SHOULD NOT RUN'
      })
      .catch((error: Error) => error.message)
    expect(swappedBodyRan).toBe(false)
    // The refusal names the precise fact: the definition it resolves to is not
    // the one the Binding pinned.
    expect(String(raced)).toContain('definition')
    // …and the withdrawal is PERMANENT: the next call is still refused (now as
    // an unverified Binding), so only an explicit re-bind can bring the name
    // back — there is no "second call looks fine again" path.
    expect(String(host.runGuards({ name: 'read', agent: { id: 'agent-m1' } }))).toContain('cannot be verified')
    // The refusal took no lease: a turned-away call never blocks a teardown.
    expect(outcome.value.dispatcher.inFlight()).toBe(0)
  })

  it('R2b an unreadable definition seam refuses instead of assuming nothing changed', () => {
    // (the `read` name is a trusted native here, so it reaches the definition
    //  check instead of stopping at an earlier refusal)
    const host = fakeCtx({ surface: ['read'] })
    const outcome = install(host)
    if (!outcome.ok) throw new Error(outcome.error.message)
    expect(outcome.value.publish().ok).toBe(true)
    host.breakDefinitionSeam()
    const denial = host.runGuards({ name: 'read', agent: { id: 'agent-m1' } })
    expect(denial).toContain('definition')
    expect(denial).toContain('unreadable')
  })

  it('R2c a definition seam absent at install time is a PUBLIC-seam gap that stops the publish', () => {
    const host = fakeCtx({ surface: ['read'], without: 'get' })
    const outcome = install(host)
    expect(outcome.ok).toBe(false)
    if (outcome.ok) return
    expect(outcome.error.message).toContain('tools.get')
    expect(host.guards).toHaveLength(0)
  })

  it('R1 a scope-local name present at publish is NOT bound as a verified native', () => {
    const host = fakeCtx({ surface: ['read', 'evil_own_tool'], globalSurface: ['read'] })
    const outcome = install(host)
    if (!outcome.ok) throw new Error(outcome.error.message)
    expect(outcome.value.publish().ok).toBe(true)
    expect(host.runGuards({ name: 'read', agent: { id: 'agent-m1' } })).toBeUndefined()
    const denial = host.runGuards({ name: 'evil_own_tool', agent: { id: 'agent-m1' } })
    expect(denial).toContain('team tool guard')
    // The Binding it got is the honest one: observed and unattributed, never a
    // `native:` family that the name did not earn.
    expect(outcome.value.dispatcher.surface.entryOf('evil_own_tool')?.binding.bindingId).toBe(
      'unbound-observed:session-m1:evil_own_tool',
    )
    expect(outcome.value.observations().some((o) => String(o.event).includes('unverified'))).toBe(true)
  })
})
