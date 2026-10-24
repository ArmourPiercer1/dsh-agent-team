/** Type surface for the ISOLATED bind-after-def module (center 00:3x law;
 *  ROOT limited-fix card #2 + addenda A/B: canonical gate, real plane-edge
 *  proof — never a boolean, per-dispatch identity, around-chain boundary). */

export interface ScheduleBindBreakpoint {
  kind: string
  expected: string
  actual: string
  where: string
}

/** The RAW plane-edge answer the wiring hands back (paAdmit.open →
 *  paAdmit.edge shape; team-tool-plane paAdmitEdge / g3-ptc-wiring.mjs
 *  :299-378 reference). A boolean is NEVER a legal answer. */
export interface SchedulePlaneEdgeAnswer {
  kind?: 'allow' | 'deny' | 'approved' | string
  cancelled?: boolean
  stage?: 'open' | 'edge'
  code?: string
  detail?: string
  consumedProof?: { grant?: { grantId?: string } & Record<string, unknown> } & Record<string, unknown>
  [key: string]: unknown
}

export interface ScheduleBindGateInput {
  agent: unknown
  definitions: ReadonlyArray<{ name: string, definition: unknown }>
  service: unknown
}

export interface ScheduleBindDeps {
  readToolDefinition: (name: string, agent: unknown) => unknown
  subscribeAgentCreated: (listener: (payload: { agent: unknown }) => void | Promise<unknown>) => () => void
  agentEventsFor?: (agent: unknown) => { on: (event: string, handler: (...args: never[]) => unknown) => unknown }
  agentEvents?: { on: (event: string, handler: (...args: never[]) => unknown) => unknown }
  registerGuardFor?: (agent: unknown) => ((guard: (exec: unknown) => string | undefined) => (() => void) | undefined) | undefined
  registerGuard?: ((guard: (exec: unknown) => string | undefined) => (() => void) | undefined) | undefined
  scheduleServiceFeed?: () => unknown
  /** CANONICAL gate: family registration + REAL arm build. ONLY an
   *  {ok:true} answer lets the bind proceed (card #2 law A). */
  onBinded?: (input: ScheduleBindGateInput) => { ok: boolean } | Promise<{ ok: boolean }>
  /** Pair-close: delete EXACTLY the keys the gate wrote (law A). */
  onBindClose?: (info: { reason: string, error?: unknown }) => void
  /** THE body-boundary plane-edge walk (open→edge→consumedProof); answers
   *  the raw plane object — a boolean is rejected by the module (不能bool true). */
  consumePaAtBody?: (exec: unknown, definition: unknown) => SchedulePlaneEdgeAnswer | null | undefined | Promise<SchedulePlaneEdgeAnswer | null | undefined>
  onBindRefused?: (error: Error & { breakpoint?: ScheduleBindBreakpoint }) => void
  /** Published-def safe point (law 5): bounded re-read until the ORIGINAL
   *  pair is publicly visible. wait is injectable for tests. */
  wait?: (ms: number) => Promise<void>
  defSettleAttempts?: number
  defSettleTickMs?: number
  observe?: (row: { event: string; [key: string]: unknown }) => void
}

export interface ScheduleBindHandle {
  start: (runtimeAgent: unknown) => void
  dispose: () => void
  isBound: () => boolean
  bindPoints: Readonly<Record<string, string>>
}

export declare function createScheduleBindAfterDef (deps: ScheduleBindDeps): ScheduleBindHandle
