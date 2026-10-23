/**
 * schedule-wiring.d.mts — the tsc type surface of `schedule-wiring.mjs`
 * (the same `.mjs` + adjacent `.d.mts` pattern as `g1-query-wiring`,
 * `schedule-adapters` and `g5-goal-service`: only `.mjs` files load at
 * runtime, and tsc (NodeNext) resolves THESE declarations for typed
 * importers of the `.mjs`).
 *
 * SCOPE HONESTY: this is the MINIMAL surface actually consumed by the shared
 * mount writer and `test/a5m2-schedule-wiring.test.ts` — NOT the module's
 * full runtime shape. The adapter ROW face and the plan/refusal machinery
 * stay structurally opaque here: those bytes are owned by
 * `schedule-adapters.mjs` (+ its own `.d.mts`) and its spec, and this surface
 * deliberately does NOT restate them. Widening beyond the consumed members
 * requires real signatures (never `any`).
 *
 * @module @dsh-agent-team/runtime/src/plugin/live/governed-families/schedule-wiring (type surface)
 */

import type {
  BScheduleDeclaredEntry,
  BScheduleDefinition,
  BScheduleErrorConstructor,
  BScheduleNativeCapture,
  BScheduleRow,
} from './schedule-adapters.mjs'

export type {
  BScheduleDeclaredEntry,
  BScheduleDefinition,
  BScheduleNativeCapture,
  BScheduleRow,
}

/** One controlled-wiring subset entry (the root ruling's closed two). */
export interface BScheduleWiringSubsetEntry {
  readonly name: string
  readonly recordIndex: number
  readonly familyId: string
}

/** Provider-side placement feed (the settled registration law): the runtime
 *  identity the seam minted for the PLACED definition. */
export type BScheduleWiringPlacementFeed = (
  name: string,
) => { definitionIdentity?: string; realmId?: string } | undefined

/** The admission seat the wiring forwards, enriched with the minted family
 *  claim. `{ ok: true }` is the only answer that reaches the delegate; the
 *  durable consumed-proof stays the plane's consume-for-execution edge. */
export interface BScheduleWiringClaimFamily {
  readonly familyId: string
  readonly adapterRevision: number
  readonly providerIdentity: string
  readonly targetManifest: BScheduleWiringTargetManifest
}

/** The lossless flat projection of the adapter's measured plan.target —
 *  taskId rides EXACTLY as measured (null for list / id-law-refused delete,
 *  the validated non-empty id for an admitted delete). */
export interface BScheduleWiringTargetManifest {
  readonly contract: string
  readonly ownerKind: 'bound-live-agent-reference'
  readonly ownerSessionId: string
  readonly action: string
  readonly taskId: string | null
  readonly revision: string
  readonly timerNamespace: string
  readonly timerEffect: string
  readonly destinationSessionId: string
  readonly destinationPath: string
  readonly destinationWake: string
}

export interface BScheduleWiringAdmitContext {
  readonly name: string
  readonly recordIndex: number
  readonly familyId: string
  readonly classified: { ok: true } & Record<string, unknown>
  readonly exec: unknown
  readonly targetManifest: BScheduleWiringTargetManifest
  readonly family: BScheduleWiringClaimFamily
}
export type BScheduleWiringAdmitAnswer = { ok: boolean; code?: string; detail?: string }
export type BScheduleWiringAdmit = (ctx: BScheduleWiringAdmitContext) => Promise<BScheduleWiringAdmitAnswer>

/** The three capture laws (capturedAgent, liveScheduleService,
 *  ScheduleInputError) are REQUIRED here and forwarded VERBATIM: an omission
 *  answers the ADAPTER's own P_B_SCHEDULE_INPUT_INVALID — this layer holds no
 *  second gate and no defaults for them. */
export interface BScheduleWiringInput {
  readonly providerId?: string
  readonly declaredService?: { present?: boolean }
  /** ONLY schedule_list / schedule_delete may be presented; a create/update
   *  capture refuses P_B_SCHEDULE_WIRE_NON_SUBSET_CAPTURE before the
   *  adapter sees it. */
  readonly captured?: Partial<Record<'schedule_list' | 'schedule_delete', BScheduleNativeCapture>>
  readonly liveNative: (name: string) => unknown
  readonly scheduleService: Record<string, unknown>
  readonly liveScheduleService: () => Record<string, unknown>
  readonly capturedAgent: { session: { id: string } } & Record<string, unknown>
  readonly ScheduleInputError: BScheduleErrorConstructor
  readonly placementFeed: BScheduleWiringPlacementFeed
  readonly admit: BScheduleWiringAdmit
  readonly observe?: (row: unknown) => void
}

/** One mount-moment family registration produced through the adapter's own
 *  familyRegistrations() face (silent/moved feeds THROW, per the registry
 *  law, before anything is written). */
export interface BScheduleWiringRegistration {
  readonly name: string
  readonly recordIndex: number
  readonly definitionIdentity: string
  readonly entry: {
    readonly familyId: string
    readonly adapterRevision: number
    readonly providerIdentity: string
  }
}

export interface BScheduleWiringClaimStats {
  readonly admits: number
  readonly admissionRefusals: number
  readonly admittedOnce: number
  readonly claimMintRefusals: number
}

export interface BScheduleWiring {
  readonly ok: true
  readonly familyId: string
  readonly wiringRevision: number
  readonly adapterRevision: number
  readonly providerId: string
  readonly subset: readonly BScheduleWiringSubsetEntry[]
  readonly definitions: readonly BScheduleDefinition[]
  readonly rows: Readonly<Record<string, {
    status: 'ACTIVE' | 'DECLARED-INACTIVE'
    reason?: string
    row: BScheduleRow
    definition?: BScheduleDefinition
    captureDefinitionIdentity?: string
  }>>
  readonly declared: readonly BScheduleDeclaredEntry[]
  rowOf: (name: string) => BScheduleRow | undefined
  drain: () => { event: string; semantics: string }
  inFlight: () => { dispatches: number; refuses: number }
  /** Call at the mount moment (AFTER publish). Throws
   *  P_B_SCHEDULE_PLACEMENT_KEY_ABSENT / P_B_SCHEDULE_PLACEMENT_KEY_MOVED
   *  (the adapter's own bytes) instead of guessing or skipping. */
  familyRegistrations: () => readonly BScheduleWiringRegistration[]
  /** THE mount-moment write (AFTER publish): familyRegistrations() →
   *  registerA5GovernedFamily, list/delete rows ONLY; a throw leaves the
   *  registry untouched. */
  mountGovernedFamilies: () => readonly BScheduleWiringRegistration[]
  claimStats: () => BScheduleWiringClaimStats
}

export type BScheduleWiringResult =
  | BScheduleWiring
  | { ok: false; code: string; message: string }

export declare const A5_B_SCHEDULE_WIRING_REVISION: number
export declare const A5_B_SCHEDULE_WIRING_CODES: Readonly<{
  INPUT_INVALID: 'P_B_SCHEDULE_WIRE_INPUT_INVALID'
  NON_SUBSET_CAPTURE: 'P_B_SCHEDULE_WIRE_NON_SUBSET_CAPTURE'
  TARGET_MINT: 'P_B_SCHEDULE_WIRE_TARGET_MINT'
  ALREADY_ADMITTED: 'P_B_SCHEDULE_WIRE_ALREADY_ADMITTED'
}>
export declare const A5_B_SCHEDULE_WIRING_SUBSET: readonly BScheduleWiringSubsetEntry[]

/** The assembly-time controlled wiring factory — semantics in the `.mjs`. */
export declare function createScheduleWiring(input?: BScheduleWiringInput): BScheduleWiringResult

/* ── PRODUCTION ARM SURFACE (root 18:11 continuation) ─────────────────────
 * Types for the production-reachability exports; the semantics (native-body
 * law, inert-port law, real-error-class mirror) live in the `.mjs`. */

/** The production-legal inert port: shape-legal for the adapter factory,
 *  every call REFUSES loudly (production dispatches NATIVE, never a port). */
export declare function createScheduleInertPort(): Readonly<{
  create: (...args: never[]) => Promise<never>
  list: (...args: never[]) => Promise<never>
  catalog: (...args: never[]) => Promise<never>
  history: (...args: never[]) => Promise<never>
  delete: (...args: never[]) => Promise<never>
  update: (...args: never[]) => Promise<never>
}>

/** The ONE production claim face: the 11-leaf measured projection (taskId
 *  rides null-or-exact as measured; the nullable kind is root's column). */
export declare function mintScheduleTargetManifest(
  plan: unknown,
): BScheduleWiringTargetManifest | { ok: false; code: string; message: string }

/** One arm classify answer: the adapter plan plus the claim bytes the plane
 *  walk embeds (targetManifest + effects + the four-P-add reviewPayload). */
export type BScheduleArmClassifyResult =
  | {
      readonly ok: true
      readonly plan: Record<string, unknown>
      readonly targetManifest: BScheduleWiringTargetManifest
      readonly effects: readonly unknown[]
      readonly reviewPayload: BScheduleWiringClaimFamily
    }
  | { readonly ok: false; readonly code: string; readonly detail: string }

export type BScheduleArmExecuteResult =
  | { readonly ok: true; readonly value: unknown; readonly settled?: string }
  | { readonly ok: false; readonly code: string; readonly detail: string; readonly sideEffectPossible?: boolean }

export interface BScheduleProductionArm {
  readonly name: string
  readonly familyId: string
  readonly adapterRevision: number
  readonly providerId: string
  readonly definitionIdentity: string
  classify: (raw: unknown) => BScheduleArmClassifyResult
  execute: (plan: Record<string, unknown>, exec: { agent?: unknown; signal?: unknown }) => Promise<BScheduleArmExecuteResult>
  drain: () => void
}

export interface BScheduleProductionArmInput {
  readonly name: string
  readonly assembly: BScheduleWiring
  readonly nativeDefinition: Record<string, unknown>
  readonly capturedAgent: { session: { id: string } } & Record<string, unknown>
  readonly ScheduleInputError: BScheduleErrorConstructor
  readonly definitionIdentity: string
  readonly providerId?: string
  readonly observe?: (row: unknown) => void
}

export type BScheduleProductionArmResult =
  | { readonly ok: true; readonly arm: BScheduleProductionArm }
  | { readonly ok: false; readonly code: string; readonly message: string }

/** Build one governed production arm at the PLACEMENT moment (the plane
 *  passes the definition it ACTUALLY places; identity binds off that def). */
export declare function createGovernedScheduleArm(input?: BScheduleProductionArmInput): BScheduleProductionArmResult
