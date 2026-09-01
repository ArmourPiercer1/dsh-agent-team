/**
 * agent-bindings.d.mts — the type surface of `agent-bindings.mjs` (the
 * live world module; loaded only through the dynamic `import()` in
 * `host.ts`).
 *
 * The returned bundle is the live agent layer of {@link TeamLivePorts}
 * (packages/runtime/src/plugin/types.ts): it carries everything EXCEPT
 * `storageSeam` (the `storage-seam.mjs` module), `legacyHome`
 * (`legacy-fs-port.mjs`), and the handoff surface ports
 * (`team-creation.mjs` / the injected summarizer) — `host.ts` combines
 * the modules into the full bundle.
 */

import type {
  ActionCaller,
  TeamLivePorts,
} from '../../types.js'

/** The live agent layer returned by `buildAgentBindings`. */
export interface LiveAgentBindings {
  readonly liveSessions: Map<string, { readonly agent: unknown }>
  readonly consumptionSnapshot: (
    sessionId: string,
  ) => Record<string, unknown> | undefined
  readonly liveObservations: () => readonly string[]
  readonly agentSetup: (sessionId: string) => (agentCtx: unknown) => Promise<void>
  readonly childFactory: TeamLivePorts['childFactory']
  readonly ensureLiveAgent: (
    sessionId: string,
  ) => Promise<{ readonly agent: unknown }>
  readonly instanceIdForSession: (sessionId: string) => string
  readonly sessionInput: TeamLivePorts['sessionInput']
  readonly workDelivery: TeamLivePorts['workDelivery']
  readonly lifecyclePorts: TeamLivePorts['lifecyclePorts']
  readonly sessionDurability: TeamLivePorts['sessionDurability']
  readonly residency: TeamLivePorts['residency']
  readonly resolveCaller: (sessionId: string) => Promise<ActionCaller>
  readonly bootAgents: () => Promise<void>
  readonly close: () => Promise<void>
  readonly bindRoot: (root: unknown) => void
}

/**
 * Build the live agent bindings of one production Team plugin instance.
 * @param args - `config` (the TeamPluginConfig), `domain` (the opened
 *   TeamDomain), `agents` (the DSH agents service),
 *   `sessionPersistence` (the DSH sessionPersistence service), and the
 *   optional `observationSink`.
 */
export declare function buildAgentBindings(args: {
  readonly config: import('../../types.js').TeamPluginConfig
  readonly domain: import('../../types.js').TeamProductionRoot['teamDomain']
  readonly agents: unknown
  readonly sessionPersistence: unknown
  readonly observationSink?: (note: string) => void
}): LiveAgentBindings
