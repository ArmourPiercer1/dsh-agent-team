/**
 * schedule-adapters.d.mts — the tsc type surface of `schedule-adapters.mjs`
 * (the same `.mjs` + adjacent `.d.mts` pattern as `g1-query-wiring`,
 * `g5-goal-service`, and `g6-session-query`: only `.mjs` files load at
 * runtime, and tsc (NodeNext) resolves THESE declarations for typed
 * importers of the `.mjs`).
 *
 * SCOPE HONESTY: this is the MINIMAL surface actually consumed by the shared
 * PAIRED registration writer and `test/a5m2-schedule-adapters.test.ts` — NOT
 * the module's full runtime shape. The SERVICE VALUES (ScheduleRecord,
 * ScheduleView, the tool-error union, the CAS results) stay structurally
 * opaque here: their bytes are published by the host package's own d.ts and
 * this surface deliberately does NOT restate them. Widening beyond the
 * consumed members requires real signatures (never `any`).
 *
 * @module @dsh-agent-team/runtime/src/plugin/live/governed-families/schedule-adapters (type surface)
 */

/** One B-SCHEDULE record spec (census recordIndex + closed operation). */
export interface BScheduleRecordSpec {
  readonly recordIndex: number
  readonly operation: string
}

/** The mandatory canonical output face of a registration-ready definition
 *  (the REAL registration minimum entry, core/tools register() @ 639 —
 *  `output: {schema, render, presentationMeta?}`; schema SEMANTICS stay owned
 *  by the host's own validator, never restated here). */
export interface BScheduleOutputFace {
  readonly schema: unknown
  readonly render: (...args: never[]) => unknown
  readonly presentationMeta?: (...args: never[]) => unknown
}

/** One placed definition: the COMPLETE captured native definition — every
 *  presentation face (`output`, `parameters`, present/finalize hooks,
 *  `timeoutMs`, any future face) riding VERBATIM by reference — with ONLY
 *  `execute` replaced by the wired classify -> admit -> dispatch body
 *  (root 8b4 law). The open index stands for "every captured face travels";
 *  the named members are the real registration minimum-entry law the
 *  assembly gate mirrors. */
export interface BScheduleDefinition {
  readonly [face: string]: unknown
  readonly name: string
  readonly description: string
  readonly output: BScheduleOutputFace
  readonly parameters?: Record<string, unknown>
  readonly timeoutMs?: number
  readonly execute: (args: unknown, exec: Record<string, unknown>) => Promise<unknown>
}

/** The captured native face — a COMPLETE registration-ready definition (the
 *  real minimum-entry shape law is mirrored at assembly; the placed def
 *  spreads it and replaces ONLY execute) — plus the identity the integrator
 *  minted for the CAPTURE, which is NEVER the family key (placed vs captured
 *  stay visibly separate). */
export interface BScheduleNativeCapture {
  readonly native: {
    readonly [face: string]: unknown
    readonly name: string
    readonly description: string
    readonly output: BScheduleOutputFace
    readonly parameters?: unknown
    readonly timeoutMs?: number
    readonly execute: (args: unknown, exec: unknown) => Promise<unknown>
  }
  readonly definitionIdentity: string
}

/** The frozen plan classify mints and delegate alone may run (L8). */
export interface BSchedulePlan {
  readonly rowName: string
  readonly recordIndex: number
  readonly operation: string
  readonly args: Readonly<Record<string, unknown>>
  readonly toolError?: { readonly code: string; readonly message: string }
  readonly parametersFingerprint: string
  readonly namedGaps: Readonly<Record<string, string>>
}

export type BScheduleClassifyResult =
  | { readonly ok: true; readonly plan: BSchedulePlan }
  | { readonly ok: false; readonly code: string; readonly detail: string }

export type BScheduleDelegateResult =
  | { readonly ok: true; readonly settled: string; readonly value: unknown }
  | { readonly ok: false; readonly code: string; readonly detail: string }

/** One row, ACTIVE (mounted capture + declared proof) or the honest
 *  DECLARED/INACTIVE row (typed refusal bytes verbatim, zero port entry). */
export interface BScheduleRow {
  readonly name: string
  readonly familyId: string
  readonly recordIndex: number
  readonly mountCondition: string
  readonly active: boolean
  readonly capturePresent: boolean
  readonly description: string | null
  readonly parameters: Record<string, unknown> | null
  readonly outputSchema: unknown
  readonly definitionIdentity: string | null
  readonly namedGaps: Readonly<Record<string, string>>
  readonly classify: (args: unknown) => BScheduleClassifyResult
  readonly delegate: (plan: BSchedulePlan, ctx?: { exec?: unknown }) => Promise<BScheduleDelegateResult>
}

/** Provider-side placement feed: the runtime identity the seam minted
 *  (`definitionIdentityOf`) for the PLACED definition. */
export type BSchedulePlacementFeed = (
  name: string,
) => { definitionIdentity?: string; realmId?: string } | undefined

/** The plane's PA seat handed to every placed execute; `{ ok: true }` is the
 *  only answer that reaches the dispatch (L10). */
export interface BScheduleAdmitContext {
  readonly name: string
  readonly recordIndex: number
  readonly familyId: string
  readonly classified: { readonly ok: true; readonly plan: BSchedulePlan }
  readonly exec: unknown
}
export type BScheduleAdmitAnswer = { ok: boolean; code?: string; detail?: string }
export type BScheduleAdmit = (ctx: BScheduleAdmitContext) => Promise<BScheduleAdmitAnswer>

export interface BScheduleAssemblyInput {
  readonly providerId?: string
  /** The TRUSTED declared schedule-service proof (mountCondition
   *  declared_mount): only `present === true` activates rows. */
  readonly declaredService?: { readonly present?: boolean; readonly facts?: Record<string, unknown> }
  readonly captured?: Readonly<Record<string, BScheduleNativeCapture>>
  /** REQUIRED whenever a capture is presented (L7). */
  readonly liveNative?: (name: string) => unknown
  /** The ctx.schedule-shaped REAL-SERVICE port (production: the live
   *  ctx.schedule); this module holds no schedule implementation. */
  readonly scheduleService: Record<string, unknown>
  /** Mount-time CONFIG: the two independent live-caller pairing facts (L4). */
  readonly trusted: { readonly memberAgentId: string; readonly sessionHeaderId: string }
  readonly placementFeed: BSchedulePlacementFeed
  readonly admit: BScheduleAdmit
  readonly observe?: (row: unknown) => void
}

/** One mount-moment family registration: the PAIRED writer hands
 *  `{ definitionIdentity, entry }` to the registry's own
 *  `registerA5GovernedFamily` (the settled registration law). */
export interface BScheduleFamilyRegistration {
  readonly name: string
  readonly recordIndex: number
  readonly definitionIdentity: string
  readonly entry: {
    readonly familyId: string
    readonly adapterRevision: number
    readonly providerIdentity: string
  }
}

export interface BScheduleDeclaredEntry {
  readonly name: string
  readonly recordIndex: number
  readonly familyId: string
  readonly status: 'DECLARED-INACTIVE'
  readonly reason: string
  readonly captureReportedIgnored: boolean
}

export interface BScheduleAssembly {
  readonly ok: true
  readonly familyId: string
  readonly revision: number
  readonly mountCondition: string
  readonly providerId: string
  readonly declaredProof: boolean
  readonly placementNames: readonly string[]
  readonly definitions: readonly BScheduleDefinition[]
  readonly rows: Readonly<Record<string, {
    status: 'ACTIVE' | 'DECLARED-INACTIVE'
    reason: string
    row: BScheduleRow
    definition?: BScheduleDefinition
    captureDefinitionIdentity?: string
  }>>
  readonly declared: readonly BScheduleDeclaredEntry[]
  rowOf: (name: string) => BScheduleRow | undefined
  /** L9: new-call prohibition ONLY — settles nothing, rolls nothing back. */
  drain: () => { readonly event: string; readonly semantics: string }
  inFlight: () => { readonly dispatches: number; readonly refuses: number }
  /** Call at the mount moment (AFTER publish). Throws
   *  P_B_SCHEDULE_PLACEMENT_KEY_ABSENT / P_B_SCHEDULE_PLACEMENT_KEY_MOVED. */
  familyRegistrations: () => readonly BScheduleFamilyRegistration[]
}

export type BScheduleAssemblyResult =
  | (BScheduleAssembly & { ok: true })
  | { ok: false; code: string; message: string }

export declare const A5_B_SCHEDULE_FAMILY_ID: 'B-SCHEDULE'
export declare const A5_B_SCHEDULE_ADAPTER_REVISION: number
export declare const A5_B_SCHEDULE_MOUNT_CONDITION: 'declared_mount'
export declare const A5_B_SCHEDULE_RECORD_SPECS: Readonly<Record<string, BScheduleRecordSpec>>
export declare const A5_B_SCHEDULE_TOOL_NAMES: readonly string[]
export declare const A5_B_SCHEDULE_SERVICE_METHODS: Readonly<Record<string, { readonly arity: number; readonly signature: string }>>
export declare const A5_B_SCHEDULE_TOOL_ERROR_CODES: readonly string[]
export declare const A5_B_SCHEDULE_CODES: Readonly<{
  INPUT_INVALID: 'P_B_SCHEDULE_INPUT_INVALID'
  DECLARED_MOUNT_ABSENT: 'P_B_SCHEDULE_DECLARED_MOUNT_ABSENT'
  CAPTURE_ABSENT: 'P_B_SCHEDULE_CAPTURE_ABSENT'
  CAPTURE_INCOMPLETE: 'P_B_SCHEDULE_CAPTURE_INCOMPLETE'
  NON_FAMILY_CAPTURE: 'P_B_SCHEDULE_NON_FAMILY_CAPTURE'
  LIVE_NATIVE_ABSENT: 'P_B_SCHEDULE_LIVE_NATIVE_ABSENT'
  PORT_ABSENT: 'P_B_SCHEDULE_PORT_ABSENT'
  PORT_METHOD_ABSENT: 'P_B_SCHEDULE_PORT_METHOD_ABSENT'
  PORT_DRIFT: 'P_B_SCHEDULE_PORT_DRIFT'
  DEFINITION_DRIFT: 'P_B_SCHEDULE_DEFINITION_DRIFT'
  ADMISSION_ABSENT: 'P_B_SCHEDULE_ADMISSION_ABSENT'
  NOT_OWN_PLAN: 'P_B_SCHEDULE_NOT_OWN_PLAN'
  PLAN_STALE: 'P_B_SCHEDULE_PLAN_STALE'
  ALREADY_DISPATCHED: 'P_B_SCHEDULE_ALREADY_DISPATCHED'
  DRAINING: 'P_B_SCHEDULE_DRAINING'
  PLACEMENT_KEY_ABSENT: 'P_B_SCHEDULE_PLACEMENT_KEY_ABSENT'
  PLACEMENT_KEY_MOVED: 'P_B_SCHEDULE_PLACEMENT_KEY_MOVED'
}>
export declare const A5_B_SCHEDULE_NAMED_GAPS: Readonly<Record<string, string>>

/** Canonical projection mirror of the published `scheduleView`
 *  (domain.ts:1850 @639ed01539): {...record, state, deliveryMode:'host'}. */
export declare function scheduleView(record: Record<string, unknown>, now: number): {
  readonly [member: string]: unknown
  readonly state: 'overdue' | 'scheduled'
  readonly deliveryMode: 'host'
}

/** The assembly-time factory for the four B-SCHEDULE rows — semantics in
 *  the `.mjs`. */
export declare function createScheduleAdapterAssembly(input?: BScheduleAssemblyInput): BScheduleAssemblyResult
