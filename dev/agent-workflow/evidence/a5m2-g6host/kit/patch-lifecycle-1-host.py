import sys
base = '/srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/a5m2-wire-g6/packages/runtime/src/plugin/'
n = 0
def patch(path, ops):
    global n
    s = open(path).read()
    for old, new in ops:
        assert s.count(old) == 1, f'{path}: MISSING/AMBIG: ' + old[:80].replace('\n', '\\n')
        s = s.replace(old, new, 1)
        n += 1
    open(path, 'w').write(s)

# ── host.ts ────────────────────────────────────────────────────────────────
patch(base + 'host.ts', [
  # (1) TeamPluginHostContext: optional public ctx.inject (cordis registry.d.ts:111;
  #     mixed onto ctx per context.d.ts:30). Structural projection, no cordis import.
  ("""  provide(name: string, value: unknown): void
  effect(factory: () => () => void, label?: string): void""",
   """  provide(name: string, value: unknown): void
  effect(factory: () => () => void, label?: string): void
  /**
   * A5M2-G6 lifecycle observer (root ruling 3, lane increment 1): the PUBLIC
   * Cordis child-fiber face — `ctx.inject(deps, callback)` (cordis
   * lib/types/registry.d.ts:111; mixed onto the context per context.d.ts:30).
   * The child fiber loads ONLY while every injected service is available
   * (Base.inject semantics, registry.d.ts:58) and RE-RUNS its callback per
   * public Provider generation (mount/unload/replacement/reload). Structural
   * projection (the entry keeps Cordis-type independence); OPTIONAL — an
   * absent face makes governed currentness unknowable, which fail-closes.
   */
  inject?(
    deps: readonly string[],
    callback: (child: { get(name: string): unknown }, config?: unknown) => void,
  ): { state: number } | PromiseLike<{ state: number }> | null"""),
  # (2) glue deps projection: sessionQueryLifecycle beside sessionQuery.
  ("""    readonly sessionQuery?: () => unknown
    /**
     * A5M2-G6 B-SESSION-QUERY (root 18:58 residual 1, the step-boundary""",
   """    readonly sessionQuery?: () => unknown
    /**
     * A5M2-G6 (root ruling 3, lane increment 1): the PUBLIC Provider
     * lifecycle observer for `sessionQuery`. The governed arm's ONLY
     * currentness source: `currentGeneration()` answers the ACTIVE
     * generation `{ id, service }` whose methods bind ONCE per generation,
     * or null when the observer fiber is absent/non-ACTIVE (fail-closed —
     * unknowable never becomes allow-by-default). NO per-read identity
     * (ctx.get answers a fresh proxy per read — root-verified), NO ctx.set
     * hot-swap promise (ruling (c)); a lifecycle replacement INVALIDATES the
     * previous generation's pinned approvals with typed, log-observable
     * refusals carrying both generation markers.
     */
    readonly sessionQueryLifecycle?: {
      currentGeneration(): { id: number; service: unknown } | null
    }
    /**
     * A5M2-G6 B-SESSION-QUERY (root 18:58 residual 1, the step-boundary"""),
  # (3) observer creation + deps entry.
  ("""  const live: TeamAgentBindings = glue.createAgentBindings({""",
   """  // A5M2-G6 lifecycle observer (root ruling 3, lane increment 1): one
  // optional child fiber on the PUBLIC ctx.inject face; its callback firing
  // IS the generation boundary. Methods bind once per generation downstream;
  // the fiber's public `state` (cordis lib/types/fiber.d.ts:109-110;
  // FiberState.ACTIVE = 2, fiber.d.ts:67-70) answers liveness. Absent face /
  // non-ACTIVE / pre-activation fiber => null => the arm fail-closes.
  const sessionQueryLifecycle = (() => {
    let generation = 0
    let current: { id: number; service: unknown } | null = null
    let fiber: { state: number } | null = null
    let observable = false
    if (typeof ctx.inject === 'function') {
      observable = true
      try {
        const created = ctx.inject(['sessionQuery'], (child) => {
          generation += 1
          current = { id: generation, service: child.get('sessionQuery') }
        })
        fiber = (created ?? null) as { state: number } | null
      } catch {
        observable = false
        fiber = null
        current = null
      }
    }
    return {
      currentGeneration(): { id: number; service: unknown } | null {
        if (!observable || fiber === null) return null
        // FiberState.ACTIVE — cordis lib/types/fiber.d.ts:67-70 (public const
        // enum; the literal rides the structural independence rule).
        if ((fiber as { state: number }).state !== 2) return null
        return current
      },
    }
  })()

  const live: TeamAgentBindings = glue.createAgentBindings({"""),
  ("""    sessionQuery: () => ctx.get('sessionQuery'),""",
   """    sessionQuery: () => ctx.get('sessionQuery'),
    // Root ruling 3: the governed supply binds to a generation of THIS
    // observer, never to a per-read ctx.get identity.
    sessionQueryLifecycle,"""),
])

print(f'host.ts: {n} operations')
