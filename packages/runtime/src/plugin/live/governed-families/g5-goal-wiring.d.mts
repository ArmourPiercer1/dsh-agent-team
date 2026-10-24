/**
 * g5-goal-wiring.d.mts — the tsc type surface of `g5-goal-wiring.mjs` (the
 * same `.mjs` + adjacent `.d.mts` pattern as `g6-session-query-wiring.d.mts`:
 * only `.mjs` files load at runtime, and tsc (NodeNext) resolves THESE
 * declarations for typed importers).
 *
 * SCOPE HONESTY: this is the MINIMAL surface actually consumed by the plane's
 * G5 block, the paired registration writer (the `familyRegistrations` entries
 * flow to `registerA5GovernedFamily`) and
 * `test/a5m2-g5-goal-wiring.test.ts` — NOT the module's full runtime shape.
 * The adapter ROW face stays the imported structural type from
 * `g5-goal-service.d.mts`: those bytes are owned by the released adapter and
 * its spec, and this surface deliberately does NOT restate them. Widening
 * beyond the consumed members requires real signatures (never `any`).
 *
 * @module @dsh-agent-team/runtime/src/plugin/live/governed-families/g5-goal-wiring (type surface)
 */
import type { G5ExecutionFacts, G5GoalRow, GoalServicePort, GoalToolValue } from './g5-goal-service.mjs'

/** The plane's published split-path PA seat methods (paAdmit.open / .edge /
 *  .closePlan). Answers are typed structurally only — the kernel owns their
 *  shapes. */
export interface G5WirePaSeat {
  open: (walk: Readonly<Record<string, unknown>>) => Promise<{
    kind?: string
    cancelled?: boolean
    code?: string
    detail?: string
    grant?: unknown
    paDurableMint?: unknown
    request?: unknown
    placementName?: unknown
    paConstructionBinding?: unknown
  }>
  edge: (state: Readonly<Record<string, unknown>>) => Promise<{
    kind?: string
    cancelled?: boolean
    code?: string
    detail?: string
    consumedProof?: { grant?: { grantId?: string } }
  }>
  closePlan: (callId: string) => void
}

/** The seat AS IT ARRIVES in production: `paAdmit` is a CALLABLE carrying the
 *  three methods, so the input accepts exactly a callable-with-those-methods
 *  or an equivalent plain methods object — nothing else poses as the
 *  admission seat. */
export type G5WirePaSeatInput = G5WirePaSeat | (G5WirePaSeat & ((
  input: Readonly<Record<string, unknown>>,
) => Promise<{ kind?: string, cancelled?: boolean, code?: string, detail?: string }>))

/** One per-tool wiring report entry. ACTIVE rows carry the placed definition
 *  (captured native with ONLY `execute` replaced); DECLARED-INACTIVE rows are
 *  the honest census — no def, no registration, native untouched. */
export interface G5WireRowEntry {
  readonly status: 'ACTIVE' | 'DECLARED-INACTIVE'
  readonly reason?: string
  readonly row: G5GoalRow
  readonly definition?: Readonly<Record<string, unknown>>
  readonly captureIdentity?: string
}

/** The placement feed answer (the pb §6 runtime identity of the PLACED
 *  definition, resolved LAZILY by the plane). */
export interface G5WirePlacementFeedEntry {
  readonly definitionIdentity?: string
  readonly realmId?: string
}

/** One family-registration entry the mount writer hands to
 *  `registerA5GovernedFamily` AFTER publish. */
export interface G5WireRegistrationEntry {
  readonly name: string
  readonly definitionIdentity: string
  readonly entry: { readonly familyId: string, readonly adapterRevision: number, readonly providerIdentity: string }
}

/** Factory input — the CLOSED key set the bridge validates. */
export interface G5GoalWiringInput {
  realmId: string
  providerId: string
  /** Capture seam — production: `name => ctx.tools.get(name, scope)`. Read AT
   *  MOST once per tool name. */
  readNative(name: string): unknown
  /** The LIVE ctx.goals GoalService face (port law decides per-record). */
  goals: GoalServicePort
  /** Tool-Config mirror; host default 3 (tool-goal/src/index.ts:38-40). */
  blockedAfterConsecutiveRounds?: number
  /** Authority seam; ABSENT = the row's UNOBSERVED fact, never a pass. */
  readExecutionFacts?: () => G5ExecutionFacts
  /** The version the PUBLISHED family registration carries (root ⑤). */
  registrationOf?: () => { adapterRevision: number, providerIdentity: string }
  /** The ISSUED call identity seam (the plane's a5p5 mount law). */
  correlationOf?: (exec: unknown, toolName: string) => string | null
  /** The plane's placement feed (LAZY, pb §6). */
  placementFeed: (name: string) => G5WirePlacementFeedEntry | undefined
  pa: G5WirePaSeatInput
  observe?: (event: Record<string, unknown>) => void
}

/** The typed mount refusal (the plane turns it into its own GOAL_ARM_REFUSED
 *  message). */
export interface G5GoalWiringRefusal {
  readonly ok: false
  readonly code: string
  readonly detail: string
}

/** The wiring assembly (frozen). */
export interface G5GoalWiringAssembly {
  readonly ok: true
  readonly familyId: string
  readonly revision: number
  readonly adapterRevision: number
  readonly providerId: string
  readonly placementNames: readonly string[]
  readonly definitions: readonly Readonly<Record<string, unknown>>[]
  readonly rows: Readonly<Record<string, G5WireRowEntry>>
  readonly declared: readonly { readonly name: string, readonly familyId: string, readonly status: 'DECLARED-INACTIVE', readonly reason: string }[]
  rowOf(name: string): G5GoalRow | undefined
  stats(): { dispatches: number; refuses: number; driftRejects: number }
  drain(): { readonly event: string, readonly semantics: string }
  /** Call AFTER publish; THROWS PLACEMENT_KEY_ABSENT / PLACEMENT_KEY_MOVED
   *  instead of guessing or skipping. */
  familyRegistrations(): readonly G5WireRegistrationEntry[]
}

export declare function buildG5GoalWiring (input?: G5GoalWiringInput): G5GoalWiringAssembly | G5GoalWiringRefusal

export declare const A5_G5_GOAL_WIRING_REVISION: number
export declare const A5_G5_GOAL_WIRING_CODES: Readonly<{
  INPUT_INVALID: string
  CALL_ID_ABSENT: string
  EFFECTS_UNPARSABLE: string
  ADMISSION_CANCELLED: string
  APPROVAL_NOT_LANDED: string
  EDGE_CANCELLED: string
  CONSUME_PROOF_MISSING: string
  PLAN_INTEGRITY: string
  PLACEMENT_KEY_ABSENT: string
  PLACEMENT_KEY_MOVED: string
}>

/** Re-export for the test's serve-pairing assertions only — the served value
 *  IS the adapter's canonical projection (owned type, restated not). */
export type { GoalToolValue }
