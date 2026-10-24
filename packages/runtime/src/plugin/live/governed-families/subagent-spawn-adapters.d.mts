/**
 * subagent-spawn-adapters.d.mts — the tsc type surface of
 * `subagent-spawn-adapters.mjs` (the same `.mjs` + adjacent `.d.mts` pattern
 * as the schedule / team / subagent siblings; only `.mjs` loads at runtime).
 *
 * SCOPE HONESTY: the MINIMAL surface consumed by the shared PAIRED
 * registration writer and `test/a5m2-subagent-spawn-adapters.test.ts`. The
 * SERVICE VALUES (SubagentRun, SubagentProvider, ModelSelectionPolicy, the
 * tool result union) stay structurally opaque — they are published by the
 * host package's own d.ts and are NOT restated here. Never `any`.
 *
 * @module @dsh-agent-team/runtime/src/plugin/live/governed-families/subagent-spawn-adapters (type surface)
 */

export interface BSubagentSpawnRecordSpec {
  readonly recordIndex: number
  readonly mountCondition: 'always' | 'declared_mount'
  readonly operation: string
}

export interface BSubagentSpawnOutputFace {
  readonly schema: unknown
  readonly render: (...args: never[]) => unknown
  readonly presentationMeta?: (...args: never[]) => unknown
}

export interface BSubagentSpawnDefinition {
  readonly [face: string]: unknown
  readonly name: string
  readonly description: string
  readonly output: BSubagentSpawnOutputFace
  readonly parameters?: Record<string, unknown>
  readonly timeoutMs?: number
  readonly execute: (args: unknown, exec: Record<string, unknown>) => Promise<unknown>
}

export interface BSubagentSpawnNativeCapture {
  readonly native: {
    readonly [face: string]: unknown
    readonly name: string
    readonly description: string
    readonly output: BSubagentSpawnOutputFace
    readonly parameters?: unknown
    readonly timeoutMs?: number
    readonly execute: (args: unknown, exec: unknown) => Promise<unknown>
  }
  readonly definitionIdentity: string
}

export interface BSubagentSpawnPlanTarget {
  readonly contract: string
  readonly parent: string
  readonly child: { readonly claim: string | null; readonly adjudication: string }
  readonly action: string
  readonly revision: string
  readonly effect: string
  readonly model: string
  readonly depth: string
}

export interface BSubagentSpawnPlan {
  readonly rowName: string
  readonly recordIndex: number
  readonly operation: string
  readonly target: BSubagentSpawnPlanTarget
  readonly args: Readonly<Record<string, unknown>>
  readonly parametersFingerprint: string
  readonly namedGaps: Readonly<Record<string, string>>
}

export interface BSubagentSpawnRefusal {
  readonly ok: false
  readonly code: string
  readonly detail: string
}

export interface BSubagentSpawnRow {
  readonly name: string
  readonly familyId: 'B-SUBAGENT'
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
  readonly classify: (rawArgs: unknown) => { ok: true; plan: BSubagentSpawnPlan } | BSubagentSpawnRefusal
  readonly delegate: (
    plan: BSubagentSpawnPlan,
    ctx: { readonly exec?: unknown },
  ) => Promise<{ ok: true; settled: 'delegated'; value: unknown } | BSubagentSpawnRefusal>
}

export interface BSubagentSpawnAdmitContext {
  readonly name: string
  readonly recordIndex: number
  readonly familyId: 'B-SUBAGENT'
  readonly classified: { ok: true; plan: BSubagentSpawnPlan } | BSubagentSpawnRefusal
  readonly exec: unknown
}
export type BSubagentSpawnAdmitAnswer = { ok: boolean; code?: string; detail?: string }
export type BSubagentSpawnAdmit = (ctx: BSubagentSpawnAdmitContext) => Promise<BSubagentSpawnAdmitAnswer>

/** Factory input — DELEGATION mode: `spawnDelegates[name]` must BE the
 *  captured native execute (L3 pairing); `liveSpawnDelegates` is REQUIRED. */
export interface BSubagentSpawnAssemblyInput {
  readonly providerId?: string
  readonly captured?: Readonly<Record<string, BSubagentSpawnNativeCapture>>
  readonly liveNative?: (name: string) => unknown
  readonly spawnDelegates?: Readonly<Record<string, (args: unknown, exec: unknown) => unknown>>
  readonly liveSpawnDelegates?: () => unknown
  readonly placementFeed?: (
    name: string,
  ) => { readonly definitionIdentity?: string; readonly realmId?: string } | undefined
  readonly admit?: BSubagentSpawnAdmit
  readonly observe?: (row: unknown) => void
}

export interface BSubagentSpawnFamilyRegistration {
  readonly name: string
  readonly recordIndex: number
  readonly definitionIdentity: string
  readonly entry: {
    readonly familyId: 'B-SUBAGENT'
    readonly adapterRevision: number
    readonly providerIdentity: string
  }
}

export interface BSubagentSpawnAssembly {
  readonly ok: true
  readonly familyId: 'B-SUBAGENT'
  readonly revision: number
  readonly providerId: string
  readonly subset: string
  readonly placementNames: readonly string[]
  readonly definitions: readonly BSubagentSpawnDefinition[]
  readonly declared: readonly {
    readonly name: string
    readonly recordIndex: number
    readonly familyId: 'B-SUBAGENT'
    readonly status: 'DECLARED-INACTIVE'
    readonly reason: string
    readonly captureReportedIgnored: boolean
  }[]
  readonly rowOf: (name: string) => BSubagentSpawnRow | undefined
  readonly drain: () => { readonly event: string; readonly semantics: string }
  readonly inFlight: () => { readonly dispatches: number; readonly refuses: number }
  readonly familyRegistrations: () => readonly BSubagentSpawnFamilyRegistration[]
}

export type BSubagentSpawnAssemblyResult =
  | BSubagentSpawnAssembly
  | { readonly ok: false; readonly code: string; readonly message: string }

export declare const A5_B_SUBAGENT_SPAWN_FAMILY_ID: 'B-SUBAGENT'
export declare const A5_B_SUBAGENT_SPAWN_ADAPTER_REVISION: number
export declare const A5_B_SUBAGENT_SPAWN_RECORD_SPECS: Readonly<Record<string, BSubagentSpawnRecordSpec>>
export declare const A5_B_SUBAGENT_SPAWN_TOOL_NAMES: readonly string[]
export declare const A5_B_SUBAGENT_SPAWN_EFFECT_LABELS: Readonly<Record<string, string>>
export declare const A5_B_SUBAGENT_SPAWN_CODES: Readonly<Record<string, string>>
export declare const A5_B_SUBAGENT_SPAWN_NAMED_GAPS: Readonly<Record<string, string>>

/** The lane's ONE canonicalizer (joint encoding, root 21:20): full canonical
 *  JSON — the algebra behind parametersFingerprint and the manifest's
 *  argsCanonical/namedGapsCanonical. Pure, deterministic, export-additive. */
export declare const A5_B_SUBAGENT_SPAWN_CANONICAL_JSON: (value: unknown) => string

export declare function createSubagentSpawnAdapterAssembly(input?: BSubagentSpawnAssemblyInput): BSubagentSpawnAssemblyResult
