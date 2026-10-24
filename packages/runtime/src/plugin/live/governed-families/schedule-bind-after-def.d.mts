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
  /** PUBLIC provider lifecycle (the G6-0655 shape): the CURRENT ACTIVE
   *  generation `{ id, service: facade }`, or null when the observer fiber
   *  is absent/non-ACTIVE. Supplied = the CURRENTNESS law is the provider
   *  GENERATION (Cordis 639 answers a fresh tracker proxy per ctx.get, so
   *  object identity across reads is not a world-carried fact); omitted =
   *  the non-proxy world keeps the object-identity law. A replacement
   *  generation or non-ACTIVE INVALIDATES the bound capture (typed
   *  refusal); same-generation in-place method swaps are NOT promised to
   *  be observed (the i6 law — bound handles keep serving). */
  serviceGeneration?: () => { id: number, service: unknown } | null
  /** ② continuation card: wiring the gate ARMS schedule_create/schedule_update
   *  on the same law; undefined keeps the frozen list/delete pair alone. */
  triggerGate?: { evaluateDispatch: (name: string) => { enabled?: boolean, code?: string, detail?: string } }
  /** Root residuals 1/2: the safe point is only complete when this answers
   *  true for BOTH pair names — the wiring reads the REAL Guard dispatcher
   *  surface (entryOf → ACTIVE binding of the bound def identity). */
  nativeReady?: (name: string, definition: unknown) => boolean
  /** ROOT b4: establish the tuple ONCE, explicitly, through the assembly's
   *  ORIGINAL dispatcher bind/verification — called by the safe point after
   *  the defs appear and before the tuple check; failure is a typed refusal
   *  (native-bind-refused), never a stretched poll. */
  establishNative?: (entries: Array<{ name: string, definition: unknown }>) => { ok: boolean, detail?: string } | Promise<{ ok: boolean, detail?: string }>
  /** Root residual 3: the plane's existing governedTokenLedger narrow face.
   *  take BEFORE any PA entry; settle in the flight's finally. false take =
   *  token replay, refused with zero PA entry. */
  takePaToken?: (exec: unknown) => boolean | Promise<boolean>
  settlePaToken?: (exec: unknown) => void
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
