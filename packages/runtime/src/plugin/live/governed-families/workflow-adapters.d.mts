/**
 * workflow-adapters.d.mts — the tsc type surface of
 * `workflow-adapters.mjs` (the same `.mjs` + adjacent `.d.mts` pattern as
 * the schedule / team / subagent / subagent-spawn siblings; only `.mjs`
 * loads at runtime).
 *
 * SCOPE HONESTY: the MINIMAL surface consumed by the shared PAIRED
 * registration writer and `test/a5m2-workflow-adapters.test.ts`. The
 * SERVICE VALUES (WorkflowRun, WorkflowResult, WorkflowEngine, the tool
 * result unions) stay structurally opaque — they are published by the host
 * packages' own d.ts and are NOT restated here. Never `any`.
 *
 * @module @dsh-agent-team/runtime/src/plugin/live/governed-families/workflow-adapters (type surface)
 */

export interface BOrchestrationRecordSpec {
  readonly recordIndex: number
  readonly mountCondition: 'always' | 'declared_mount'
  readonly operation: string
}

export interface BOrchestrationOutputFace {
  readonly schema: unknown
  readonly render: (...args: never[]) => unknown
  readonly presentationMeta?: (...args: never[]) => unknown
}

export interface BOrchestrationDefinition {
  readonly [face: string]: unknown
  readonly name: string
  readonly description: string
  readonly output: BOrchestrationOutputFace
  readonly parameters?: Record<string, unknown>
  readonly timeoutMs?: number
  readonly execute: (args: unknown, exec: Record<string, unknown>) => Promise<unknown>
}

export interface BOrchestrationNativeCapture {
  readonly native: {
    readonly [face: string]: unknown
    readonly name: string
    readonly description: string
    readonly output: BOrchestrationOutputFace
    readonly parameters?: unknown
    readonly timeoutMs?: number
    readonly execute: (args: unknown, exec: unknown) => Promise<unknown>
  }
  readonly definitionIdentity: string
}

export interface BOrchestrationPlanTarget {
  readonly contract: string
  readonly parent: string
  readonly child: { readonly claim: null; readonly adjudication: string }
  readonly action: string
  readonly revision: string
  readonly effect: string
  readonly budget: string
  readonly script: string
}

export interface BOrchestrationPlan {
  readonly rowName: string
  readonly recordIndex: number
  readonly operation: string
  readonly target: BOrchestrationPlanTarget
  readonly args: Readonly<Record<string, unknown>>
  readonly parametersFingerprint: string
  readonly namedGaps: Readonly<Record<string, string>>
}

export interface BOrchestrationRefusal {
  readonly ok: false
  readonly code: string
  readonly detail: string
}

export interface BOrchestrationRow {
  readonly name: string
  readonly familyId: 'B-ORCHESTRATION'
  readonly recordIndex: number
  readonly mountCondition: 'always' | 'declared_mount'
  readonly active: boolean
  readonly capturePresent: boolean
  readonly description: string | null
  readonly parameters: Record<string, unknown> | null
  readonly outputSchema: unknown
  readonly definitionIdentity: string | null
  readonly effectDelta?: string
  readonly namedGaps: Readonly<Record<string, string>>
  readonly classify: (rawArgs: unknown) => { ok: true; plan: BOrchestrationPlan } | BOrchestrationRefusal
  readonly delegate: (
    plan: BOrchestrationPlan,
    ctx: { readonly exec?: unknown },
  ) => Promise<{ ok: true; settled: 'delegated'; value: unknown } | BOrchestrationRefusal>
}

export interface BOrchestrationAdmitContext {
  readonly name: string
  readonly recordIndex: number
  readonly familyId: 'B-ORCHESTRATION'
  readonly classified: { ok: true; plan: BOrchestrationPlan } | BOrchestrationRefusal
  readonly exec: unknown
}
export type BOrchestrationAdmitAnswer = { ok: boolean; code?: string; detail?: string }
export type BOrchestrationAdmit = (ctx: BOrchestrationAdmitContext) => Promise<BOrchestrationAdmitAnswer>

/** Factory input — DELEGATION mode: `workflowDelegates[name]` must BE the
 *  captured native execute (L3 pairing); `liveWorkflowDelegates` REQUIRED. */
export interface BOrchestrationAssemblyInput {
  readonly providerId?: string
  readonly captured?: Readonly<Record<string, BOrchestrationNativeCapture>>
  readonly liveNative?: (name: string) => unknown
  readonly workflowDelegates?: Readonly<Record<string, (args: unknown, exec: unknown) => unknown>>
  readonly liveWorkflowDelegates?: () => unknown
  readonly placementFeed?: (
    name: string,
  ) => { readonly definitionIdentity?: string; readonly realmId?: string } | undefined
  readonly admit?: BOrchestrationAdmit
  readonly observe?: (row: unknown) => void
}

export interface BOrchestrationFamilyRegistration {
  readonly name: string
  readonly recordIndex: number
  readonly definitionIdentity: string
  readonly entry: {
    readonly familyId: 'B-ORCHESTRATION'
    readonly adapterRevision: number
    readonly providerIdentity: string
  }
}

export interface BOrchestrationAssembly {
  readonly ok: true
  readonly familyId: 'B-ORCHESTRATION'
  readonly revision: number
  readonly providerId: string
  readonly subset: string
  readonly placementNames: readonly string[]
  readonly definitions: readonly BOrchestrationDefinition[]
  readonly declared: readonly {
    readonly name: string
    readonly recordIndex: number
    readonly familyId: 'B-ORCHESTRATION'
    readonly status: 'DECLARED-INACTIVE'
    readonly reason: string
    readonly captureReportedIgnored: boolean
  }[]
  readonly rowOf: (name: string) => BOrchestrationRow | undefined
  readonly drain: () => { readonly event: string; readonly semantics: string }
  readonly inFlight: () => { readonly dispatches: number; readonly refuses: number }
  readonly familyRegistrations: () => readonly BOrchestrationFamilyRegistration[]
}

export type BOrchestrationAssemblyResult =
  | BOrchestrationAssembly
  | { readonly ok: false; readonly code: string; readonly message: string }

export declare const A5_B_ORCHESTRATION_FAMILY_ID: 'B-ORCHESTRATION'
export declare const A5_B_ORCHESTRATION_ADAPTER_REVISION: number
export declare const A5_B_ORCHESTRATION_RECORD_SPECS: Readonly<Record<string, BOrchestrationRecordSpec>>
export declare const A5_B_ORCHESTRATION_TOOL_NAMES: readonly string[]
export declare const A5_B_ORCHESTRATION_EFFECT_LABELS: Readonly<Record<string, string>>
export declare const A5_B_ORCHESTRATION_CODES: Readonly<Record<string, string>>
export declare const A5_B_ORCHESTRATION_NAMED_GAPS: Readonly<Record<string, string>>

export declare function createWorkflowAdapterAssembly(input?: BOrchestrationAssemblyInput): BOrchestrationAssemblyResult
