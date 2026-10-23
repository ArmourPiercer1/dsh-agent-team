/**
 * team-adapters.d.mts — the tsc type surface of `team-adapters.mjs` (the
 * same `.mjs` + adjacent `.d.mts` pattern as `schedule-adapters`,
 * `g1-query-wiring`, `g5-goal-service`, `g6-session-query`: only `.mjs`
 * files load at runtime, and tsc (NodeNext) resolves THESE declarations for
 * typed importers of the `.mjs`).
 *
 * SCOPE HONESTY: this is the MINIMAL surface actually consumed by the shared
 * PAIRED registration writer and `test/a5m2-team-adapters.test.ts` — NOT the
 * module's full runtime shape. The LANE VALUES (TeamToolsResult, the facade
 * outcomes, guard/blocked shapes) stay structurally opaque here: their bytes
 * are published by `packages/tools/src/types.ts` and this surface
 * deliberately does NOT restate them (contract §B-TEAM: no synonymous
 * service layer — that law covers the TYPE surface too). Widening beyond the
 * consumed members requires real signatures (never `any`).
 *
 * @module @dsh-agent-team/runtime/src/plugin/live/governed-families/team-adapters (type surface)
 */

/** One B-TEAM record spec (census recordIndex + closed operation). */
export interface BTeamRecordSpec {
  readonly recordIndex: number
  readonly operation: string
}

/** The mandatory output face of a registration-ready definition (the
 *  makeDefinition product carries `output: {schema, render}`; schema
 *  SEMANTICS stay owned by the lane's own types, never restated here). */
export interface BTeamOutputFace {
  readonly schema: unknown
  readonly render: (...args: never[]) => unknown
  readonly presentationMeta?: (...args: never[]) => unknown
}

/** The lane execution context (TeamToolExecContext): the row holds it
 *  OPEN — it never reads or restates it (the delegated chain resolves the
 *  live caller from it per call, L4). */
export type BTeamExec = Record<string, unknown>

/** One placed definition: the COMPLETE captured governed definition — every
 *  presentation face (`parameters`, `output`, any future face) riding
 *  VERBATIM by reference — with ONLY `execute` replaced by the wired
 *  classify -> admit -> delegate body (root 8b4 law). The open index stands
 *  for "every captured face travels"; the named members are the real
 *  registration minimum-entry law the assembly gate mirrors. */
export interface BTeamDefinition {
  readonly [face: string]: unknown
  readonly name: string
  readonly description: string
  readonly output: BTeamOutputFace
  readonly parameters?: Record<string, unknown>
  readonly timeoutMs?: number
  readonly execute: (args: unknown, exec: BTeamExec) => Promise<unknown>
}

/** The captured governed face — a COMPLETE registration-ready
 *  createTeamTools definition plus the identity the integrator minted for
 *  the CAPTURE, which is NEVER the family key (placed vs captured stay
 *  visibly separate). */
export interface BTeamNativeCapture {
  readonly native: {
    readonly [face: string]: unknown
    readonly name: string
    readonly description: string
    readonly output: BTeamOutputFace
    readonly parameters?: unknown
    readonly timeoutMs?: number
    readonly execute: (args: unknown, exec: unknown) => Promise<unknown>
  }
  readonly definitionIdentity: string
}

/** The name -> CURRENT governed implementation port. At assembly each entry
 *  MUST BE the captured native execute (L3 pairing — one createTeamTools
 *  set); per dispatch `liveTeamDelegates()` must answer this SAME object. */
export type BTeamDelegates = {
  readonly [name: string]: (args: unknown, exec: BTeamExec) => Promise<unknown>
}

/** The contract §B-TEAM target facts every plan carries: the durable object
 *  the operation addresses, the root/member CLAIMS with where each is
 *  ADJUDICATED (always the delegated chain — never the row), the request-
 *  token revision law, and the effect delta label. */
export interface BTeamPlanTarget {
  readonly contract: string
  readonly root: { readonly claim: string | null; readonly adjudication: string }
  readonly member: unknown
  readonly object: string
  readonly action: string
  readonly revision: string
  readonly effect: string
  readonly face: string
}

/** One frozen classify plan (the ONLY thing delegate ever runs). */
export interface BTeamPlan {
  readonly rowName: string
  readonly recordIndex: number
  readonly operation: string
  readonly target: BTeamPlanTarget
  readonly args: Readonly<Record<string, unknown>>
  readonly toolError?: {
    readonly status: 'rejected'
    readonly code: string
    readonly message: string
    readonly details?: Record<string, unknown>
  }
  readonly parametersFingerprint: string
  readonly namedGaps: Readonly<Record<string, string>>
}

/** Typed refusal (the module's own closed codes, P_B_TEAM_*). */
export interface BTeamRefusal {
  readonly ok: false
  readonly code: string
  readonly detail: string
}

/** The presentation row (ACTIVE rows carry the captured faces; DECLARED rows
 *  are honest inactive placeholders). */
export interface BTeamRow {
  readonly name: string
  readonly familyId: 'B-TEAM'
  readonly recordIndex: number
  readonly mountCondition: 'always'
  readonly active: boolean
  readonly capturePresent: boolean
  readonly description: string | null
  readonly parameters: Record<string, unknown> | null
  readonly outputSchema: unknown
  readonly definitionIdentity: string | null
  readonly effectDelta?: string
  readonly namedGaps: Readonly<Record<string, string>>
  readonly classify: (rawArgs: unknown) => { ok: true; plan: BTeamPlan } | BTeamRefusal
  readonly delegate: (
    plan: BTeamPlan,
    ctx: { readonly exec?: BTeamExec },
  ) => Promise<{ ok: true; settled: 'tool-law-value' | 'delegated'; value: unknown } | BTeamRefusal>
}

export interface BTeamAdmitContext {
  readonly name: string
  readonly recordIndex: number
  readonly familyId: 'B-TEAM'
  readonly classified: { ok: true; plan: BTeamPlan } | BTeamRefusal
  readonly exec: unknown
}
export type BTeamAdmitAnswer = { ok: boolean; code?: string; detail?: string,
  /** The ONE private settled-value return (root 24:2x): a seam holding the
   *  shared caller/root rule answers the call by handing back, by reference,
   *  the typed rejected VALUE it holds. Reachable only as the exact shape
   *  `{ ok: true, settled: true, value }`; execute returns it immediately and
   *  never enters the delegate. Ordinary refusals keep `ok: false` + the
   *  exception path. */
  settled?: boolean; value?: unknown }
export type BTeamAdmit = (ctx: BTeamAdmitContext) => Promise<BTeamAdmitAnswer>

/** Factory input (everything REQUIRED that a capture is presented:
 *  liveNative, teamDelegates, liveTeamDelegates, placementFeed, admit). */
export interface BTeamAssemblyInput {
  readonly providerId?: string
  readonly captured?: Readonly<Record<string, BTeamNativeCapture>>
  readonly liveNative?: (name: string) => unknown
  readonly teamDelegates?: BTeamDelegates
  readonly liveTeamDelegates?: () => unknown
  readonly placementFeed?: (
    name: string,
  ) => { readonly definitionIdentity?: string; readonly realmId?: string } | undefined
  readonly admit?: BTeamAdmit
  readonly observe?: (row: unknown) => void
}

/** One mount-moment registration entry (paired writer -> registerA5GovernedFamily). */
export interface BTeamFamilyRegistration {
  readonly name: string
  readonly recordIndex: number
  readonly definitionIdentity: string
  readonly entry: {
    readonly familyId: 'B-TEAM'
    readonly adapterRevision: number
    readonly providerIdentity: string
  }
}

export interface BTeamAssembly {
  readonly ok: true
  readonly familyId: 'B-TEAM'
  readonly revision: number
  readonly mountCondition: 'always'
  readonly providerId: string
  readonly placementNames: readonly string[]
  readonly definitions: readonly BTeamDefinition[]
  readonly rows: Readonly<Record<string, { readonly status: string; readonly row: BTeamRow }>>
  readonly declared: readonly {
    readonly name: string
    readonly recordIndex: number
    readonly familyId: 'B-TEAM'
    readonly status: 'DECLARED-INACTIVE'
    readonly reason: string
    readonly captureReportedIgnored: boolean
  }[]
  readonly rowOf: (name: string) => BTeamRow | undefined
  readonly drain: () => { readonly event: string; readonly semantics: string }
  readonly inFlight: () => { readonly dispatches: number; readonly refuses: number }
  readonly familyRegistrations: () => readonly BTeamFamilyRegistration[]
}

export type BTeamAssemblyResult = BTeamAssembly | { readonly ok: false; readonly code: string; readonly message: string }

export declare const A5_B_TEAM_FAMILY_ID: 'B-TEAM'
export declare const A5_B_TEAM_ADAPTER_REVISION: number
export declare const A5_B_TEAM_MOUNT_CONDITION: 'always'
export declare const A5_B_TEAM_RECORD_SPECS: Readonly<Record<string, BTeamRecordSpec>>
export declare const A5_B_TEAM_TOOL_NAMES: readonly string[]
export declare const A5_B_TEAM_EFFECT_LABELS: Readonly<Record<string, string>>
export declare const A5_B_TEAM_CODES: Readonly<Record<string, string>>
export declare const A5_B_TEAM_NAMED_GAPS: Readonly<Record<string, string>>

export declare function createTeamAdapterAssembly(input?: BTeamAssemblyInput): BTeamAssemblyResult
