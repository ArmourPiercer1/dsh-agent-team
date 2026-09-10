/**
 * t12a-live-bridge.d.mts — the tsc type surface of `t12a-live-bridge.mjs`
 * (the same `.mjs` + adjacent `.d.mts` pattern as the testkit
 * `session-event-scan` harness): tsc (NodeNext) resolves these
 * declarations for the `./t12a-live-bridge.mjs` import specifier, while
 * the plain-node runner loads the `.mjs` natively.
 *
 * The doubles are typed structurally against ONLY the service surface the
 * live glue consumes — see the `.mjs` module header for the exact
 * contracts and the self-provisioning rationale.
 *
 * @module t12a-live-bridge
 */

/** One recorded agents.create request (sessionId + the passed meta). */
export interface RecordedCreate {
  readonly sessionId: string
  readonly meta: Record<string, unknown> | undefined
  readonly setupProvided: boolean
}

/** One recorded agents.resume request. */
export interface RecordedResume {
  readonly sessionId: string
  readonly setupProvided: boolean
}

/** One recorded followup message (the session id + the LLM message). */
export interface RecordedFollowup {
  readonly sessionId: string
  readonly message: unknown
}

/** One recorded cancel call (the session id + the cancel args). */
export interface RecordedCancel {
  readonly sessionId: string
  readonly args: unknown
}

/** One active listener registration on the agent ctx double. */
export interface AgentListenerEntry {
  readonly event: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- waterfall listeners are positional
  listener: (...args: any[]) => unknown
  active: boolean
}

/** One global prompt-layer section (the DSH service registrations). */
export interface GlobalPromptSection {
  readonly name: string
  readonly order: number
  readonly text: string
}

/** One assembled prompt section (scoped entries shadow same-named globals). */
export interface AssembledPromptSection {
  readonly name: string
  readonly order: number
  readonly text: string
  readonly scope: 'global' | 'scoped'
}

/** One recorded tools.restrict({ deny }) call on the ctx double (alpha.1). */
export interface ToolRestrictionEntry {
  readonly deny: readonly string[]
}

/** One recorded skills register(def) entry on the ctx double (alpha.1). */
export interface RegisteredSkillEntry {
  readonly def: unknown
  disposed: boolean
}

/** The agent-scoped ctx double (the service surface the live glue consumes). */
export interface AgentCtxDouble {
  readonly listeners: AgentListenerEntry[]
  /** Every agentCtx.plugin() fiber recorded (the mini-MCP mount point). */
  readonly plugins: unknown[]
  /** Every live tools.register(def) recorded, in order (disposers remove). */
  readonly registeredTools: unknown[]
  /** alpha.1: every tools.restrict({ deny }) call recorded on THIS ctx
   *  (sibling-inert; one entry per call, the seam accumulates). */
  readonly toolRestrictions: ToolRestrictionEntry[]
  /** P0-3 (hardening §5): the unified operation-order log — the SEQUENCE of
   *  tools.register / tools.restrict calls on THIS ctx (verifies the frozen
   *  setup ordering: builtin deny BEFORE the team tool registrations). */
  readonly opLog: ReadonlyArray<{ op: 'register' | 'restrict'; toolName: string }>
  /** alpha.1: every skills register(def) entry recorded on THIS ctx
   *  (disposers flip `disposed`). */
  readonly registeredSkills: RegisteredSkillEntry[]
  on(event: string, listener: AgentListenerEntry['listener']): () => void
  /** alpha.1: the DSH service accessor (the 'skills' registration seam).
   *  register returns the SkillRegistrationDisposer OBJECT ({ dispose() }),
   *  matching the T3 skill-adapter contract. */
  get(key: string): { register(def: unknown): { dispose(): void } } | undefined
  plugin(pluginSpec: unknown, options?: unknown): unknown
  readonly tools: {
    register(def: unknown): () => void
    execute(name: string, args: unknown, callId?: string): Promise<unknown>
    /** alpha.1: the public Agent-scoped restriction seam. P0-2 (hardening
     *  §4): the real seam returns the exact disposer that lifts this
     *  restriction (the adapter captures + invokes it on close). */
    restrict(opts: { deny: string[] }): () => void
  }
  /** The DSH systemPrompt builtin double (T12-M2: the persona layer). */
  readonly systemPrompt: {
    /** The world's shared global prompt layer (asserted untouched). */
    readonly globals: GlobalPromptSection[]
    /** Register an agent-scoped section (duplicate scoped name throws). */
    section(spec: { name: string; order: number; text: string | (() => string) }): () => void
    /** The composed prompt layer (globals + active scoped, ordered). */
    assemble(): AssembledPromptSection[]
  }
}

/** One settled live-agent handle (the DSH handle seam the glue stores). */
export interface LiveAgentHandle {
  readonly agent: {
    readonly session: { readonly id: string }
    readonly ctx: AgentCtxDouble
    followup(message: unknown): void
    whenIdle(): Promise<void>
    cancel(args?: unknown): void
  }
  dispose(): Promise<void>
}

/** The agents service double (the DSH agents create/resume seam). */
export interface AgentsDouble {
  readonly creates: RecordedCreate[]
  readonly resumes: RecordedResume[]
  readonly disposals: string[]
  readonly followups: RecordedFollowup[]
  readonly cancels: RecordedCancel[]
  readonly handles: Map<string, LiveAgentHandle>
  /** The world's shared global prompt layer (T12-M2). */
  readonly globalSections: GlobalPromptSection[]
  create(req: { sessionId: unknown; meta?: Record<string, unknown>; setup?: (ctx: object) => unknown }): Promise<object>
  resume(req: { resumeSessionId: unknown; setup?: (ctx: object) => unknown }): Promise<object>
}

/** The agents-double options (see the `.mjs` createAgentsDouble). */
export interface AgentsDoubleOptions {
  /** The per-agent whenIdle() behavior (default: resolves immediately). */
  readonly whenIdleBehavior?: (agent: object) => Promise<void>
  /** The world's global prompt layer (T12-M2; default: the DSH service pair). */
  readonly systemPromptGlobals?: GlobalPromptSection[]
}

/** The sessionPersistence service double (records materializations). */
export interface SessionPersistenceDouble {
  readonly materialized: string[]
  ensureMaterialized(session: { id: string }): Promise<void>
}

/** The opened-TeamDomain double (repository lists + REAL resolvers). */
export interface DomainDouble {
  readonly repositories: {
    readonly memberInstances: { list(rootSessionId: string): object[] }
    readonly overrides: { list(rootSessionId: string): object[] }
    readonly teamSessions: { get(rootSessionId: string): object | undefined; list(rootSessionId: string): object[] }
  }
  readonly consumption: {
    readonly model: {
      resolveDurableModelSelection(args: object): {
        readonly policy: unknown
        readonly view: { readonly selection: { readonly provider: string; readonly model: string } | undefined; readonly [k: string]: unknown }
      }
    }
    readonly capability: {
      resolveDurableMcpFacet(args: object): {
        readonly policy: unknown
        readonly view: { readonly allowed: boolean; readonly [k: string]: unknown }
      }
    }
  }
}

/** The domain-double params. */
export interface DomainDoubleParams {
  /** memberInstance rows of the default (boot) root. */
  readonly members?: object[]
  /** TCM-D4: per-root member rows for non-default roots. */
  readonly membersByRoot?: Record<string, object[]>
  /** governance override rows of the default (boot) root. */
  readonly overrides?: object[]
  /** TCM-D4: per-root override rows for non-default roots. */
  readonly overridesByRoot?: Record<string, object[]>
  /** The durable TeamSession row (T12-M2: exposed as repositories.teamSessions). */
  readonly teamSession?: object
  /** TCM-D4: the durable TeamSession rows of every team root (multi-root). */
  readonly teamSessions?: object[]
}

/** The subagents service double options (see the `.mjs` createSubagentsDouble). */
export interface SubagentsDoubleOptions {
  /** `'reject'` makes drainContinuableDescendants reject (aggregate failure). */
  readonly drainBehavior?: 'reject'
  readonly drainErrorMessage?: string
  /** The listDescendants result entries (the descendant tree). */
  readonly descendants?: object[]
}

/** The subagents service double (the SubagentRuntime drain surface). */
export interface SubagentsDouble {
  readonly drainCalls: unknown[][]
  readonly listCalls: string[]
  drainContinuableDescendants(parents: readonly unknown[]): Promise<void>
  listDescendants(rootSessionId: string): Promise<readonly object[]>
}

/** One recorded agentPresets.mount call (D1 v2: the member base tools). */
export interface RecordedPresetMount {
  readonly agentCtx: unknown
  /** The preset id passed through (undefined = the deployment default). */
  readonly presetId: string | undefined
}

/** The agentPresets-double options (see the `.mjs` createAgentPresetsDouble). */
export interface AgentPresetsDoubleOptions {
  /** `'reject'` makes mount() reject (the real service rejects an unknown preset id). */
  readonly mountBehavior?: 'reject'
  readonly mountErrorMessage?: string
}

/** The agentPresets service double (the DSH AgentPresets public service — the
 *  ordinary-preset base-tool substrate for member agents, D1 v2). */
export interface AgentPresetsDouble {
  readonly mounts: RecordedPresetMount[]
  mount(agentCtx: unknown, presetId?: string): Promise<object>
}

/** One live-binding test world (see the `.mjs` createLiveWorld). */
export interface LiveWorld {
  readonly rootSessionId: string
  readonly config: Record<string, unknown>
  /** The real glue bundle (structurally the TeamAgentBindings surface). */
  readonly binding: object & {
    childSessionIdFor(rootSessionId: string, instanceId: string): string
    readonly childFactory: {
      createChildSession(request: {
        rootSessionId?: string
        instanceId: string
        templateId: string
        label: string
        workspace?: string
      }): Promise<{ childSessionId: string }>
    }
    drainDescendants(childSessionId: string): Promise<{ drained: number; quiescent: boolean }>
    resolveConsumptionViews(sessionId: string): {
      readonly instanceId: string
      readonly modelView: { readonly selection: { readonly provider: string; readonly model: string } | undefined; readonly [k: string]: unknown }
      readonly mcpView: { readonly allowed: boolean; readonly [k: string]: unknown } | null
    }
    readonly observations: readonly string[]
    /** The REAL scoped-prompt persona surface (T12-M2). */
    readonly personaSurface: {
      installScopedPersona(sessionId: string, identity: unknown): void
      restoreScopedPersona(sessionId: string): void
    }
    /** The caller map (SD-CALLER: the tool layer LOOKS UP the identity here). */
    resolveCaller(sessionId: string): Promise<{ readonly kind: 'instance'; readonly instanceId: string }>
    /** The SessionInputPort over live agents (attributed relay delivery). */
    readonly sessionInput: {
      submitAttributedInput(input: {
        readonly sessionId: string
        readonly text: string
        readonly attribution: unknown
      }): Promise<void>
    }
    /** The work-delivery port (the ONLY model-visible work path). */
    readonly workDelivery: {
      deliver(args: {
        readonly childSessionId: string
        readonly requestToken: string
        readonly prompt: string
        readonly attachedContext?: string
      }): Promise<void>
    }
    /** Route one tool call onto the session's live agent (the request boundary runs first). */
    executeTool(
      sessionId: string,
      request: { readonly name: string; readonly args?: Record<string, unknown>; readonly callId?: string },
    ): Promise<{ readonly ok: boolean; readonly callId?: string }>
    /** Forget + dispose one live handle ({dropped, disposeError?}). */
    dropResidency(sessionId: string): Promise<{ readonly dropped: boolean; readonly disposeError?: string }>
    /** Whether the session has a live agent (the liveAgents map). */
    hasLive(sessionId: string): boolean
    /** The live-agent-or-resume resolver (creates on demand, cold-resumes over durable sessions). */
    ensureLiveAgent(sessionId: string): Promise<LiveAgentHandle>
    /** The Root initial-work delivery (token-leading text into the root agent, no dedupe). */
    deliverRootWork(input: {
      readonly rootSessionId: string
      readonly requestToken: string
      readonly prompt: string
      readonly attachedContext?: string
    }): Promise<void>
    /** The B6 handoff port: start (or re-attach) the team root's REAL DSH Agent (T12-GLUE). */
    createRootAgent(rootSessionId: string): Promise<void>
    /** The B6 handoff port: deliver the frozen context as a REAL model-visible input turn (T12-GLUE). */
    deliverRootContext(input: {
      readonly rootSessionId: string
      readonly contextToken: string
      readonly text: string
    }): Promise<void>
    /** TCM-M3: the creation-time Root initial work port — one token-leading REAL model-visible input turn (the shared `deliverRootInput` path; the durable replay/retry side is the Root initial-work strategy's). */
    deliverRootWork(input: {
      readonly rootSessionId: string
      readonly requestToken: string
      readonly prompt: string
      readonly attachedContext?: string
    }): Promise<void>
    boot(): Promise<void>
    close(): Promise<void>
    [k: string]: unknown
  }
  readonly agents: AgentsDouble
  readonly sessionPersistence: SessionPersistenceDouble
  readonly domain: DomainDouble
  readonly teamToolsRef: { current: unknown }
  readonly subagents: SubagentsDouble | undefined
  /** D1 v2: the agentPresets service double (absent = the host seam not wired: a
   *  member setup fails closed with the typed member-base-tools-unavailable). */
  readonly agentPresets: AgentPresetsDouble | undefined
  readonly records: {
    readonly creates: RecordedCreate[]
    readonly resumes: RecordedResume[]
    readonly disposals: string[]
    readonly followups: RecordedFollowup[]
    readonly cancels: RecordedCancel[]
    readonly materialized: string[]
  }
}

/** The live-world options (see the `.mjs` createLiveWorld). */
export interface LiveWorldOptions {
  readonly rootSessionId?: string
  /** memberInstance rows of the world's default (boot) root. */
  readonly members?: object[]
  /** TCM-D4: per-root member rows for non-boot roots. */
  readonly membersByRoot?: Record<string, object[]>
  /** governance override rows of the world's default (boot) root. */
  readonly overrides?: object[]
  /** TCM-D4: per-root override rows for non-boot roots. */
  readonly overridesByRoot?: Record<string, object[]>
  /** The durable TeamSession row of the world's default (boot) root (T12-M2). */
  readonly teamSession?: object
  /** TCM-D4: the durable TeamSession rows of every team root (multi-root). */
  readonly teamSessions?: object[]
  /** The world's global prompt layer (T12-M2; default: the DSH service pair). */
  readonly systemPromptGlobals?: GlobalPromptSection[]
  readonly configOverrides?: Record<string, unknown>
  readonly teamTools?: { readonly tools: readonly unknown[] }
  readonly agents?: AgentsDoubleOptions
  readonly subagents?: SubagentsDouble
  /** D1 v2: the agentPresets service double (the member base-tool substrate). */
  readonly agentPresets?: AgentPresetsDouble
}

/** The worktree root (the bridge lives at packages/runtime/test). */
export const WORKTREE_ROOT: string

/** Idempotently provision the @deepseek-ai/* junction links. */
export declare function ensureGlueResolvable(): void

/** Import the real glue module (provisions the links first; cached). */
export declare function loadGlueModule(): Promise<{
  createAgentBindings(deps: object): object
  [k: string]: unknown
}>

/** Build the agents service double. */
export declare function createAgentsDouble(options?: AgentsDoubleOptions): AgentsDouble

/** Build the sessionPersistence service double. */
export declare function createSessionPersistenceDouble(): SessionPersistenceDouble

/** Build the opened-TeamDomain double (loads the REAL resolvers). */
export declare function createDomainDouble(params?: DomainDoubleParams): Promise<DomainDouble>

/** Build the subagents service double. */
export declare function createSubagentsDouble(options?: SubagentsDoubleOptions): SubagentsDouble

/** Build the agentPresets service double (the ordinary-preset base-tool substrate, D1 v2). */
export declare function createAgentPresetsDouble(options?: AgentPresetsDoubleOptions): AgentPresetsDouble

/**
 * Invoke the real `system-prompt/assemble` waterfall listener the glue's
 * agentSetup registered through installModelSelection: the ACTUAL agent
 * boundary. Returns the assembled payload — `variables.provider` /
 * `variables.model` carry the installed selection, or are absent when no
 * model may be selected.
 */
export declare function observeAssembly(agentCtx: AgentCtxDouble): Promise<{
  readonly variables?: Record<string, unknown>
} | undefined>

/** Build the full live-binding world (real glue over the doubles). */
export declare function createLiveWorld(options?: LiveWorldOptions): Promise<LiveWorld>

/** Run `fn` with DSH_HOME pointed at `home` (restored afterwards). */
export declare function withDshHome<T>(home: string, fn: () => T | Promise<T>): Promise<T>

/** Write an empty durable-session fixture under a fake DSH_HOME. */
export declare function writeDurableFixture(home: string, sessionId: string, profile?: string): string

/** Remove a whole fixture home tree (idempotent). */
export declare function removeFixtureHome(home: string): void
