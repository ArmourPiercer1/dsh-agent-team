/**
 * subagent-adapters.d.mts — the tsc type surface of `subagent-adapters.mjs`
 * (the same `.mjs` + adjacent `.d.mts` pattern as `schedule-adapters` /
 * `team-adapters`: only `.mjs` files load at runtime, and tsc (NodeNext)
 * resolves THESE declarations for typed importers).
 *
 * SCOPE HONESTY: the MINIMAL surface consumed by the shared PAIRED
 * registration writer and `test/a5m2-subagent-adapters.test.ts`. The SERVICE
 * VALUES (Agent, SessionId, MessageId, SubagentCatalogEntry,
 * SubagentDescendantListEntry, the projected list rows) stay structurally
 * opaque here — their bytes are published by the host package's own d.ts and
 * this surface deliberately does NOT restate them. Never `any`.
 *
 * @module @dsh-agent-team/runtime/src/plugin/live/governed-families/subagent-adapters (type surface)
 */

/** One B-SUBAGENT control-trio record spec (census recordIndex + operation). */
export interface BSubagentRecordSpec {
  readonly recordIndex: number
  readonly operation: string
}

/** The mandatory output face of a registration-ready definition. */
export interface BSubagentOutputFace {
  readonly schema: unknown
  readonly render: (...args: never[]) => unknown
  readonly presentationMeta?: (...args: never[]) => unknown
}

/** One placed definition: the COMPLETE captured native with ONLY `execute`
 *  replaced; the send_message placed definition additionally carries the
 *  re-applied standard adjacent-Agent messaging mark (L3b). The replaced
 *  execute PASSES NON-RECORD arguments (null/undefined/array/string) to the
 *  captured native uncoerced — its compiled object-root validator answers
 *  the Host's own ToolArgsError before any body (581-1 FIX 1); records enter
 *  the governed classify → admit → delegate pipeline. */
export interface BSubagentDefinition {
  readonly [face: string]: unknown
  readonly name: string
  readonly description: string
  readonly output: BSubagentOutputFace
  readonly parameters?: Record<string, unknown>
  readonly timeoutMs?: number
  readonly execute: (args: unknown, exec: Record<string, unknown>) => Promise<unknown>
}

/** The captured native face — a COMPLETE registration-ready defineTool
 *  product plus the CAPTURE identity (never the family key). */
export interface BSubagentNativeCapture {
  readonly native: {
    readonly [face: string]: unknown
    readonly name: string
    readonly description: string
    readonly output: BSubagentOutputFace
    readonly parameters?: unknown
    readonly timeoutMs?: number
    readonly execute: (args: unknown, exec: unknown) => Promise<unknown>
  }
  readonly definitionIdentity: string
}

/** The ctx.subagents-shaped REAL-SERVICE port (the four methods the three
 *  published bodies call; everything else the published face carries stays
 *  outside this seam). ERROR REALITY (measured, 581-1 FIX 4): this face HAS
 *  a published error class — SubagentError (dsh-subagent package index,
 *  exported by the same published runtime bundle whose throw sites
 *  instantiate it). The row maps nothing: interrupt answers absent/one-shot/
 *  unknown targets with an ACCEPTED NO-OP and only live cross-authority
 *  targets with SubagentError(UNAUTHORIZED); such throws propagate verbatim
 *  through `delegate`/`execute` and stay instanceof-able against the real
 *  published class. */
export interface BSubagentServicePort {
  readonly sendMessage: (sender: unknown, targetId: string, content: readonly unknown[], options: { readonly signal?: unknown }) => Promise<unknown>
  readonly interrupt: (targetSessionId: string, authority: { readonly kind: 'ancestor'; readonly agent: unknown }) => void
  readonly listChildren: (parentSessionId: unknown, signal?: unknown) => Promise<readonly Record<string, unknown>[]>
  readonly listDescendants: (rootSessionId: unknown, signal?: unknown) => Promise<readonly Record<string, unknown>[]>
}

/** The ctx.agents-shaped live Agent registry the list projection reads.
 *  Its `get` function is a CAPTURED HANDLE (581-1 FIX 2): the assembly
 *  captures it at bind time, the dispatch edge re-verifies it, and the
 *  projection / adjacency pre-check invoke exactly that handle. Entries
 *  carry the live Agent facts the row reads: `status` (list projection)
 *  and the recorded lineage (`session.header.parentSession`, measured
 *  Agent shape — the send_message adjacency pre-check reads it). */
export interface BSubagentAgentsRegistry {
  readonly get: (id: unknown) => {
    readonly status?: unknown
    readonly id?: unknown
    readonly session?: { readonly header?: { readonly parentSession?: unknown } }
  } | undefined
}

/** The contract §B-SUBAGENT target facts every plan carries. The relation
 *  is the measured ADJACENT law (send: direct child OR, for a resident
 *  continuable child, the direct parent — child→parent is legal; interrupt:
 *  the caller's live ancestry; list: the caller's own tree), never a
 *  universal parent→child quantifier (581-1 FIX 3). */
export interface BSubagentPlanTarget {
  readonly contract: string
  readonly caller: string
  readonly address: {
    readonly claim: string | null
    readonly relation: string
    readonly adjudication: string
  }
  readonly action: string
  readonly revision: string
  readonly effect: string
  readonly depth: string
  readonly budget: string
}

/** One frozen classify plan (the ONLY thing delegate ever runs). */
export interface BSubagentPlan {
  readonly rowName: string
  readonly recordIndex: number
  readonly operation: string
  readonly target: BSubagentPlanTarget
  readonly args: Readonly<Record<string, unknown>>
  readonly parametersFingerprint: string
  readonly namedGaps: Readonly<Record<string, string>>
}

/** Typed refusal (closed P_B_SUBAGENT_* codes). */
export interface BSubagentRefusal {
  readonly ok: false
  readonly code: string
  readonly detail: string
}

/** The presentation row (ACTIVE or honest DECLARED-INACTIVE). */
export interface BSubagentRow {
  readonly name: string
  readonly familyId: 'B-SUBAGENT'
  readonly recordIndex: number
  readonly mountCondition: 'always'
  readonly active: boolean
  readonly capturePresent: boolean
  readonly description: string | null
  readonly parameters: Record<string, unknown> | null
  readonly outputSchema: unknown
  readonly definitionIdentity: string | null
  readonly effectDelta?: string
  readonly portMethods?: readonly string[]
  readonly namedGaps: Readonly<Record<string, string>>
  readonly classify: (rawArgs: unknown) => { ok: true; plan: BSubagentPlan } | BSubagentRefusal
  readonly delegate: (
    plan: BSubagentPlan,
    ctx: { readonly exec?: unknown },
  ) => Promise<{ ok: true; settled: 'service'; value: unknown } | BSubagentRefusal>
}

export interface BSubagentAdmitContext {
  readonly name: string
  readonly recordIndex: number
  readonly familyId: 'B-SUBAGENT'
  readonly classified: { ok: true; plan: BSubagentPlan } | BSubagentRefusal
  readonly exec: unknown
}
export type BSubagentAdmitAnswer = { ok: boolean; code?: string; detail?: string }
export type BSubagentAdmit = (ctx: BSubagentAdmitContext) => Promise<BSubagentAdmitAnswer>

/** Factory input — everything REQUIRED when a capture is presented:
 *  liveNative, liveSubagentService, liveAgentsRegistry, the REAL marker
 *  predicate/marker pair, placementFeed, admit. */
export interface BSubagentAssemblyInput {
  readonly providerId?: string
  readonly captured?: Readonly<Record<string, BSubagentNativeCapture>>
  readonly liveNative?: (name: string) => unknown
  readonly subagentService?: BSubagentServicePort
  readonly liveSubagentService?: () => unknown
  readonly agentsRegistry?: BSubagentAgentsRegistry
  readonly liveAgentsRegistry?: () => unknown
  readonly isAdjacentAgentSendMessageTool?: (definition: unknown) => boolean
  readonly markAdjacentAgentSendMessageTool?: (definition: unknown) => unknown
  readonly placementFeed?: (
    name: string,
  ) => { readonly definitionIdentity?: string; readonly realmId?: string } | undefined
  readonly admit?: BSubagentAdmit
  readonly observe?: (row: unknown) => void
}

/** One mount-moment registration entry (paired writer -> registerA5GovernedFamily). */
export interface BSubagentFamilyRegistration {
  readonly name: string
  readonly recordIndex: number
  readonly definitionIdentity: string
  readonly entry: {
    readonly familyId: 'B-SUBAGENT'
    readonly adapterRevision: number
    readonly providerIdentity: string
  }
}

export interface BSubagentAssembly {
  readonly ok: true
  readonly familyId: 'B-SUBAGENT'
  readonly revision: number
  readonly mountCondition: 'always'
  readonly providerId: string
  readonly subset: string
  readonly placementNames: readonly string[]
  readonly definitions: readonly BSubagentDefinition[]
  readonly rows: Readonly<Record<string, { readonly status: string; readonly row: BSubagentRow }>>
  readonly declared: readonly {
    readonly name: string
    readonly recordIndex: number
    readonly familyId: 'B-SUBAGENT'
    readonly status: 'DECLARED-INACTIVE'
    readonly reason: string
    readonly captureReportedIgnored: boolean
  }[]
  readonly rowOf: (name: string) => BSubagentRow | undefined
  readonly drain: () => { readonly event: string; readonly semantics: string }
  readonly inFlight: () => { readonly dispatches: number; readonly refuses: number }
  readonly familyRegistrations: () => readonly BSubagentFamilyRegistration[]
}

export type BSubagentAssemblyResult =
  | BSubagentAssembly
  | { readonly ok: false; readonly code: string; readonly message: string }

export declare const A5_B_SUBAGENT_FAMILY_ID: 'B-SUBAGENT'
export declare const A5_B_SUBAGENT_ADAPTER_REVISION: number
export declare const A5_B_SUBAGENT_MOUNT_CONDITION: 'always'
export declare const A5_B_SUBAGENT_RECORD_SPECS: Readonly<Record<string, BSubagentRecordSpec>>
export declare const A5_B_SUBAGENT_TOOL_NAMES: readonly string[]
export declare const A5_B_SUBAGENT_SERVICE_METHODS: Readonly<Record<string, { readonly arity: number; readonly signature: string }>>
export declare const A5_B_SUBAGENT_EFFECT_LABELS: Readonly<Record<string, string>>
export declare const A5_B_SUBAGENT_CODES: Readonly<Record<string, string>>
export declare const A5_B_SUBAGENT_NAMED_GAPS: Readonly<Record<string, string>>

export declare function createSubagentAdapterAssembly(input?: BSubagentAssemblyInput): BSubagentAssemblyResult
