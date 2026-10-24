/**
 * g5-goal-service.d.mts — the declaration half of `g5-goal-service.mjs` (an
 * untyped `.mjs` SOURCE module), MINIMAL by contract: it declares ONLY the
 * surface a consumer of the G5 goal-service adapter touches — the injected
 * goal-service port law and the governed-row face the plane/glue consumes.
 * Everything below is DESCRIBED FROM the implementation + the pinned 639
 * host sources (tool-goal/src/index.ts, goal/src/index.ts, goal/src/types.ts
 * @639ed01539 — see the module header for the ledger); nothing is invented.
 *
 * The port types MIRROR the host domain vocabulary
 * (`@deepseek-ai/dsh-goal` goal/src/types.ts) structurally: the plugin never
 * imports host-internal modules at runtime; the live `ctx.goals` OBJECT is
 * injected and must answer these shapes.
 *
 * @module @dsh-agent-team/runtime/plugin/live/governed-families/g5-goal-service
 */

/** Mirror of GoalId (goal/src/types.ts:17, branded at the host; opaque here). */
export type GoalId = string

/** Mirror of GoalActivation (goal/src/types.ts:72). */
export type GoalActivation = 'armed' | 'disarmed'

/** Mirror of GoalPhase (goal/src/types.ts:45-49). */
export type GoalPhase = 'active' | 'paused' | 'blocked' | 'complete'

/** Mirror of GoalRef (goal/src/types.ts:20-25) — compare-and-set identity. */
export interface GoalRef {
  readonly id: GoalId
  readonly revision: number
}

/** Mirror of GoalBlockReason (goal/src/types.ts:52-57). */
export interface GoalBlockReason {
  readonly code: string
  readonly message: string
}

/** Mirror of GoalSnapshot (goal/src/types.ts:60-69). */
export interface GoalSnapshot extends GoalRef {
  readonly objective: string
  readonly phase: GoalPhase
  readonly blockedReason?: GoalBlockReason
  readonly maxGoalRounds: number
}

/** Mirror of GoalView (goal/src/types.ts:90-99) — what every port mutation
 *  method returns; `activation` is process-local, never persisted. */
export interface GoalView extends GoalSnapshot {
  readonly roundsStarted: number
  readonly createdAt: number
  readonly updatedAt: number
  readonly activation: GoalActivation
}

/** Mirror of CreateGoalRequest (goal/src/types.ts:28-31). */
export interface CreateGoalRequest {
  readonly objective: string
  readonly maxGoalRounds?: number
}

/** Mirror of EditGoalRequest (goal/src/types.ts:39-42). */
export interface EditGoalRequest {
  readonly objective?: string
  readonly maxGoalRounds?: number
}

/** The Agent identity the port methods take BY REFERENCE (host `Agent`; the
 *  adapter never inspects it — GoalService.assertLive, goal/src/index.ts:
 *  469-473, owns the live-identity law on the real port). */
export interface GoalAgentRef {
  readonly id: string
  readonly [key: string]: unknown
}

/**
 * THE INJECTED PORT — mirrors the REAL GoalService methods the three host
 * tool bodies call (names/arity/return pinned to goal/src/index.ts:277,
 * :303, :329, :352, :364, :391, :409 @639ed01539). Production injects the
 * live `ctx.goals`; methods are SYNCHRONOUS host-side and stay synchronous
 * in the type.
 */
export interface GoalServicePort {
  get(agent: GoalAgentRef): GoalView | undefined
  create(agent: GoalAgentRef, request: CreateGoalRequest): GoalView
  edit(agent: GoalAgentRef, ref: GoalRef, request: EditGoalRequest): GoalView
  pause(agent: GoalAgentRef, ref: GoalRef): GoalView
  resume(agent: GoalAgentRef, ref: GoalRef): GoalView
  complete(agent: GoalAgentRef, ref: GoalRef): GoalView
  block(agent: GoalAgentRef, ref: GoalRef, reason: GoalBlockReason): GoalView
  [method: string]: unknown
}

/** The canonical tool result (GoalToolValue, tool-goal/src/index.ts:59-72). */
export type GoalToolValue =
  | { goal: null }
  | {
    goal: {
      id: string
      revision: number
      objective: string
      phase: GoalPhase
      roundsStarted: number
      maxGoalRounds: number
      blockedReason?: GoalBlockReason
    }
    activation: GoalActivation
  }

/** classify() plan or typed refusal. */
export interface G5GoalPlan {
  ok: true
  correlation: string
  familyId: string
  adapterRevision: number
  toolName: string
  recordIndex: number
  operation: string
  captureIdentity: string
  parametersFingerprint: string
  actualArgs: Record<string, unknown>
  targetManifest: Record<string, unknown>
}
export interface G5GoalRefusal {
  ok: false
  code: string
  detail: string
}

/** invoke()/runPlan() outcome. */
export interface G5GoalDispatch { method: string; source: string }
export interface G5GoalOutcome {
  ok: true
  value: GoalToolValue
  plan: G5GoalPlan
  dispatch: readonly G5GoalDispatch[]
  authorityObserved: boolean
}

/** The governed row face consumed by the plane/glue. */
export interface G5GoalRow {
  readonly familyId: string
  readonly adapterRevision: number
  readonly recordIndex: number
  readonly toolName: 'create_goal' | 'get_goal' | 'update_goal'
  readonly operation: string
  readonly mountCondition: string
  readonly mountState: string
  readonly realmId: string
  readonly providerId: string
  readonly active: boolean
  captured(): boolean
  readonly description: string | null
  readonly parametersSchema: Record<string, unknown> | null
  readonly outputSchema: Record<string, unknown> | null
  readonly portMethods: readonly string[]
  readonly namedGaps: Readonly<Record<string, string>>
  readonly blocker?: string
  classify(args: unknown): Promise<G5GoalPlan | G5GoalRefusal>
  invoke(args: unknown, exec: { agent?: GoalAgentRef }): Promise<G5GoalOutcome | G5GoalRefusal>
  runPlan(plan: unknown, exec: { agent?: GoalAgentRef }): Promise<G5GoalOutcome | G5GoalRefusal>
  readonly drainSemantics: string
  drain(): void
  draining(): boolean
}

/** The execution-authority reader shape (optional; see namedGaps.AUTHORITY). */
export type G5ExecutionFacts = { kind: 'direct-human' } | { kind: 'goal-round' }

/** Factory inputs. A config defect THROWS TypeError at assembly. */
export interface G5GoalAdapterDeps {
  realmId: string
  providerId: string
  /** Capture seam — production: `name => ctx.tools.get(name, scope)`. */
  readNative(name: string): unknown
  /** The GoalService-shaped port (production: the live `ctx.goals`). */
  goals: GoalServicePort
  /** Tool-Config mirror; host default 3 (tool-goal/src/index.ts:38-40). */
  blockedAfterConsecutiveRounds?: number
  readExecutionFacts?: () => G5ExecutionFacts
  observe?: (event: Record<string, unknown>) => void
}

export interface G5GoalAdapter {
  readonly get_goal: G5GoalRow
  readonly create_goal: G5GoalRow
  readonly update_goal: G5GoalRow
  readonly adapterLaw: Record<string, unknown>
  stats(): { dispatches: number; refuses: number; driftRejects: number }
  drain(): void
  draining(): boolean
  [key: string]: unknown
}

export declare function createG5GoalServiceAdapter(deps: G5GoalAdapterDeps): G5GoalAdapter
export declare function goalValue(goal: GoalView | undefined): GoalToolValue
export declare const A5_G5_FAMILY_ID: string
export declare const A5_G5_ADAPTER_REVISION: number
export declare const A5_G5_GOAL_RECORDS: Readonly<Record<string, { readonly recordIndex: number; readonly family: string; readonly operation: string }>>
export declare const A5_G5_GOAL_TOOL_NAMES: readonly ('get_goal' | 'create_goal' | 'update_goal')[]
export declare const A5_G5_GOAL_SERVICE_METHODS: Readonly<Record<string, { readonly arity: number; readonly signature: string; readonly source: string }>>
export declare const A5_G5_GOAL_CODES: Readonly<Record<string, string>>
export declare const A5_G5_GOAL_NAMED_GAPS: Readonly<{ AUTHORITY: string; WRAPUP: string; AGENT_AUTH: string }>
