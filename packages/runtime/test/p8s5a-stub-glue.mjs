/**
 * p8s5a-stub-glue.mjs — the test-owned stand-in for the live-agent glue
 * bundle (`src/plugin/live/agent-bindings.mjs`), consumed by the T1
 * production-assembly test through the production entry's
 * `config.glueUrl` channel (exactly the row-owned loading path).
 *
 * Contract: exports `createAgentBindings(deps)` returning the 23-key
 * `TeamAgentBindings` shape (types.ts) with shape parity to the real glue:
 *
 *   - the runtime ports (childFactory / sessionDurability / surface /
 *     sessionInput / workDelivery / interrupt / drainDescendants /
 *     residency / resolveCaller) are present; the ones the T1 world never
 *     exercises THROW with a loud stub message when called (an unexpected
 *     call during assembly/boot is a wiring bug the test must catch);
 *   - `surface` is a real recording surface (the binder's only agent
 *     contact — the T1 probes assert through its recorded state);
 *   - `sessionDurability.ensureDurable` resolves (the durability barrier is
 *     a no-op in the T1 world);
 *   - `boot`/`close` are counting no-ops (the root's own seeding and
 *     rehydration are the T1 boot content);
 *   - `__t1` exposes the recorded state to the test (diagnostics only).
 *
 * Plain `.mjs` (ruling R22); no `node:` imports needed at all.
 * @module @dsh-agent-team/runtime/test/p8s5a-stub-glue
 */

/** Build one throwing proxy port (any method call names itself). */
function throwingPort(name) {
  return new Proxy(
    {},
    {
      get(_target, prop) {
        if (typeof prop !== 'string') return undefined
        return (..._args) => {
          throw new Error(`p8s5a stub glue: ${name}.${prop}() is not available in the T1 world`)
        }
      },
    },
  )
}

/**
 * The stub bundle factory (same signature as the real glue).
 * @param {object} deps — `{ agents, sessionPersistence, domain, config, teamToolsRef, now }`.
 * @returns {object} the 23-key TeamAgentBindings-shaped bundle (+ `__t1`).
 */
export function createAgentBindings(deps) {
  const { config, teamToolsRef } = deps
  const rootSid = config.rootSessionId
  const state = {
    bootCount: 0,
    closeCount: 0,
    live: new Set(),
    slots: new Map(),
    events: [],
    restored: [],
  }

  const surface = {
    getInstalledSlots: (sessionId) => state.slots.get(sessionId) ?? [],
    installOverlay: (sessionId, slot) => {
      const list = state.slots.get(sessionId) ?? []
      if (!list.includes(slot)) list.push(slot)
      state.slots.set(sessionId, list)
    },
    restoreScope: (sessionId, scope) => {
      state.restored.push({ sessionId, slots: (scope && scope.slots) || [] })
    },
    recordSessionEvent: (sessionId, event) => {
      state.events.push({ sessionId, name: event && event.name })
    },
  }

  const throwingFn = (name) => (..._args) => {
    throw new Error(`p8s5a stub glue: ${name}() is not available in the T1 world`)
  }

  return {
    // --- the runtime ports (held by the root's node wiring) ---
    childFactory: throwingPort('childFactory'),
    sessionDurability: { ensureDurable: async () => {} },
    surface,
    sessionInput: throwingPort('sessionInput'),
    workDelivery: throwingPort('workDelivery'),
    interrupt: throwingFn('interrupt'),
    drainDescendants: throwingFn('drainDescendants'),
    residency: {
      hasResidency: (sessionId) => state.live.has(sessionId),
      dropResidency: (sessionId) => state.live.delete(sessionId),
    },
    resolveCaller: async () => ({ kind: 'human', humanId: 'p8s5a-operator' }),

    // --- boot + observability ---
    boot: async () => {
      state.bootCount += 1
    },
    listLiveSessions: () => [...state.live],
    hasLive: (sessionId) => state.live.has(sessionId),
    ensureLiveAgent: throwingFn('ensureLiveAgent'),
    prepareAgentForRequest: throwingFn('prepareAgentForRequest'),
    executeTool: throwingFn('executeTool'),
    getConsumptionState: () => ({
      provider: config.staticModel.provider,
      model: config.staticModel.model,
    }),
    resolveConsumptionViews: () => ({ model: config.staticModel }),
    observations: ['p8s5a-stub-glue'],
    dropResidency: async (sessionId) => ({ dropped: state.live.delete(sessionId) }),
    governanceAuthority: (asSessionId) =>
      asSessionId === rootSid ? { kind: 'operator' } : undefined,
    close: async () => {
      state.closeCount += 1
    },

    // --- harness-facing extras (shape parity with the real bundle) ---
    agentSetup: () => ({ tools: (teamToolsRef && teamToolsRef.current && teamToolsRef.current.tools) || [] }),
    rootSessionId: rootSid,

    // --- T1 diagnostics ---
    __t1: state,
  }
}
