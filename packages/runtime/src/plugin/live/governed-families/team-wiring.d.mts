/**
 * governed-families/team-wiring.d.mts — declaration surface for the A5M2
 * B-TEAM controlled wiring bridge (team-wiring.mjs). The runtime module is
 * the source of truth; this file types its published face only.
 *
 * @module @dsh-agent-team/runtime/plugin/live/governed-families/team-wiring
 */
import type {
  BTeamAssemblyResult,
  BTeamDefinition,
  BTeamFamilyRegistration,
  BTeamRow,
} from './team-adapters.js'

export declare const A5_B_TEAM_WIRING_REVISION: number

export declare const A5_B_TEAM_WIRING_CODES: Readonly<{
  INPUT_INVALID: 'P_B_TEAM_WIRE_INPUT_INVALID'
  TARGET_MINT: 'P_B_TEAM_WIRE_TARGET_MINT'
  CALL_ID_ABSENT: 'P_B_TEAM_WIRE_CALL_ID_ABSENT'
  EFFECTS_UNPARSABLE: 'P_B_TEAM_WIRE_EFFECTS_UNPARSABLE'
  ADMISSION_CANCELLED: 'P_B_TEAM_WIRE_ADMISSION_CANCELLED'
  APPROVAL_NOT_LANDED: 'P_B_TEAM_WIRE_APPROVAL_NOT_LANDED'
  EDGE_CANCELLED: 'P_B_TEAM_WIRE_EDGE_CANCELLED'
  CONSUME_PROOF_MISSING: 'P_B_TEAM_WIRE_CONSUME_PROOF_MISSING'
  ALREADY_ADMITTED: 'P_B_TEAM_WIRE_ALREADY_ADMITTED'
}>

export type BTeamWiringCode = (typeof A5_B_TEAM_WIRING_CODES)[keyof typeof A5_B_TEAM_WIRING_CODES]

/** A refusal this layer owns, or an adapter refusal forwarded verbatim. */
export type BTeamWiringRefusal = { readonly ok: false; readonly code: string; readonly detail?: string; readonly message?: string }

/** The plane's published admission seat: the CALLABLE `paAdmit` carrying
 *  `open` / `edge` / `closePlan` (team-tool-plane.mjs:1214-area, :1874,
 *  :1908, :1909) — or an equivalent plain methods record. */
export interface BTeamAdmissionSeat {
  (input: Record<string, unknown>): Promise<unknown>
  readonly open: (walk: Record<string, unknown>) => Promise<unknown>
  readonly edge: (state: Record<string, unknown>) => Promise<unknown>
  readonly closePlan: (callId: string) => void
}

export interface BTeamWiringInput {
  readonly realmId: string
  readonly providerId: string
  /** ONE-CAPTURE member-scoped read seam (the owner memoizes it). */
  readonly readNative: (name: string) => unknown
  /** FRESH per-dispatch member-scoped re-read (adapter L7). */
  readonly liveNative: (name: string) => unknown
  /** The LIVE lane tool set (the SAME createTeamTools build the capture rode). */
  readonly teamSet: () => readonly unknown[] | undefined
  readonly placementFeed: (
    name: string,
  ) => { readonly definitionIdentity?: string; readonly realmId?: string } | undefined
  readonly definitionIdentityOf?: (definition: object) => string | null
  readonly pa: BTeamAdmissionSeat | {
    readonly open: (walk: Record<string, unknown>) => Promise<unknown>
    readonly edge: (state: Record<string, unknown>) => Promise<unknown>
    readonly closePlan: (callId: string) => void
  }
  readonly correlationOf?: (exec: unknown, toolName: string) => string | null
  readonly observe?: (event: Record<string, unknown>) => void
}

export interface BTeamWiringAssembly {
  readonly ok: true
  readonly familyId: 'B-TEAM'
  readonly wiringRevision: number
  readonly adapterRevision: number
  readonly providerId: string
  /** The family's closed ten (the adapter's own record table). */
  readonly familyNames: readonly string[]
  readonly placementNames: readonly string[]
  readonly definitions: readonly BTeamDefinition[]
  readonly rows: BTeamAssemblyResult extends { rows: infer R } ? R : never
  readonly declared: readonly unknown[]
  readonly captureCensus: ReadonlyArray<{ readonly name: string; readonly recordIndex: number; readonly reason: string }>
  readonly rowOf: (name: string) => BTeamRow | undefined
  readonly drain: () => unknown
  readonly inFlight: () => { readonly dispatches: number; readonly refuses: number }
  /** Mount-moment registration face; THROWS on an absent/moved feed key. */
  readonly familyRegistrations: () => readonly BTeamFamilyRegistration[]
  readonly claimStats: () => {
    readonly admits: number
    readonly admittedOnce: number
    readonly admissionRefusals: number
    readonly mintRefusals: number
    readonly toolLawValues: number
    readonly walks: number
    readonly edges: number
    readonly witnessed: number
  }
}

export type BTeamWiringResult = BTeamWiringAssembly | BTeamWiringRefusal

export declare function buildTeamOpsWiring(input?: BTeamWiringInput): BTeamWiringResult
