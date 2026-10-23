/**
 * g1-query-wiring.d.mts — the tsc type surface of `g1-query-wiring.mjs`
 * (the same `.mjs` + adjacent `.d.mts` pattern as `plane-effect-backends`,
 * `a2-canonical-operation-realfs`, and `t12a-live-bridge`: only `.mjs` files
 * load at runtime, and tsc (NodeNext) resolves THESE declarations for typed
 * importers of the `.mjs`).
 *
 * SCOPE HONESTY: this is the MINIMAL surface actually consumed by the shared
 * plane/glue writer and `test/a5m2-g1-query-wiring.test.ts` — NOT the module's
 * full runtime shape. The adapter ROW face (classify/delegate and the refusal
 * objects) stays the opaque structural type below: those bytes are owned by
 * `g1-surface-adapters.mjs` and its spec, and this surface deliberately does
 * NOT restate them. Widening beyond the consumed members requires real
 * signatures (never `any`).
 *
 * @module @dsh-agent-team/runtime/src/plugin/live/governed-families/g1-query-wiring (type surface)
 */

/** One derived pure-query subset entry (ordered by recordIndex). */
export interface G1QuerySubsetEntry {
  readonly name: string
  readonly recordIndex: number
  readonly familyId: string
}

/** The adapter row face AS CONSUMED here: identity members typed, the plan
 *  machinery structurally opaque (owned by g1-surface-adapters.mjs). */
export interface G1QueryAdapterRow {
  readonly name: string
  readonly familyId: string
  readonly recordIndex: number
  readonly capturePresent: boolean
  readonly descriptionFrom: string
  readonly description: string | null
  readonly parameters: Record<string, unknown> | null
  readonly nativeFaceRef: string
  readonly definitionIdentity: string | null
  readonly classify: (args: unknown, callId: unknown) => { ok: boolean; code?: string; detail?: string; plan?: unknown }
  readonly delegate: (plan: unknown, ctx?: { exec?: unknown }) => Promise<{ ok?: boolean; code?: string; detail?: string; settled?: string; value?: unknown }>
}

/** One mounted definition face the plane places verbatim (the CAPTURED
 *  native description bytes + the captured parameters face + the wired
 *  classify -> admit -> delegate body). */
export interface G1QueryDefinition {
  readonly name: string
  readonly description: string
  readonly parameters?: Record<string, unknown>
  readonly execute: (args: unknown, exec: Record<string, unknown>) => Promise<unknown>
}

/** Provider-side placement feed (pb §6): the runtime identity the seam
 *  minted (`definitionIdentityOf`) for the PLACED definition. */
export type G1QueryPlacementFeed = (
  name: string,
) => { definitionIdentity?: string; realmId?: string } | undefined

/** The captured native face + the identity the integrator minted for the
 *  CAPTURE (provider@commit@entry#params-hash) — NOT the family key: the
 *  family key is always the placement feed's runtime identity. */
export interface G1QueryNativeCapture {
  readonly native: {
    readonly name: string
    readonly description: string
    readonly parameters?: unknown
    execute: (args: unknown, exec: unknown) => Promise<unknown>
  }
  readonly definitionIdentity: string
}

/** The plane's PA seat handed to the wiring: the classify output the walk
 *  must carry; `{ ok: true }` is the only answer that reaches the delegate. */
export interface G1QueryAdmitContext {
  readonly name: string
  readonly recordIndex: number
  readonly familyId: string
  readonly classified: { ok: true } & Record<string, unknown>
  readonly exec: unknown
}
export type G1QueryAdmitAnswer = { ok: boolean; code?: string; detail?: string }
export type G1QueryAdmit = (ctx: G1QueryAdmitContext) => Promise<G1QueryAdmitAnswer>

export interface G1QueryWiringInput {
  readonly providerId?: string
  readonly captured?: Record<string, G1QueryNativeCapture>
  readonly placementFeed: G1QueryPlacementFeed
  readonly trusted: Record<string, unknown>
  readonly bindingFacts: () => Record<string, unknown>
  /** Whitelisted CURRENT-facts sources: `trustedTopology` ONLY. Every other
   *  key is another family's face or a refused resource arm. */
  readonly ports?: { readonly trustedTopology?: { current: () => unknown } }
  readonly admit: G1QueryAdmit
  readonly observe?: (row: unknown) => void
}

/** One mount-moment family registration: hand `{ definitionIdentity, entry }`
 *  to the registry's own `registerA5GovernedFamily` (agent-bindings law). */
export interface G1QueryFamilyRegistration {
  readonly name: string
  readonly recordIndex: number
  readonly definitionIdentity: string
  readonly entry: {
    readonly familyId: string
    readonly adapterRevision: number
    readonly providerIdentity: string
  }
}

export interface G1QueryDeclaredEntry {
  readonly name: string
  readonly recordIndex: number
  readonly familyId: string
  readonly status: 'DECLARED-INACTIVE'
  readonly reason: string
}

export interface G1QueryWiring {
  readonly ok: true
  readonly group: string
  readonly revision: number
  readonly adapterRevision: number
  readonly providerId: string
  readonly subset: readonly G1QuerySubsetEntry[]
  readonly placementNames: readonly string[]
  readonly definitions: readonly G1QueryDefinition[]
  readonly rows: Readonly<Record<string, {
    status: 'ACTIVE' | 'DECLARED-INACTIVE'
    reason?: string
    row: G1QueryAdapterRow
    definition?: G1QueryDefinition
    captureDefinitionIdentity?: string
  }>>
  readonly declared: readonly G1QueryDeclaredEntry[]
  rowOf: (name: string) => G1QueryAdapterRow | undefined
  /** Call at the mount moment (AFTER publish). Throws
   *  P_G1_WIRE_PLACEMENT_KEY_ABSENT / P_G1_WIRE_PLACEMENT_KEY_MOVED. */
  familyRegistrations: () => readonly G1QueryFamilyRegistration[]
}

export type G1QueryWiringResult =
  | (G1QueryWiring & { ok: true })
  | { ok: false; code: string; message: string }

export declare const A5_G1_QUERY_WIRING_GROUP: string
export declare const A5_G1_QUERY_WIRING_REVISION: number
export declare const A5_G1_QUERY_WIRING_CODES: Readonly<{
  INPUT_INVALID: 'P_G1_WIRE_INPUT_INVALID'
  ARM_NOT_ACCEPTED: 'P_G1_WIRE_ARM_NOT_ACCEPTED'
  NON_SUBSET_CAPTURE: 'P_G1_WIRE_NON_SUBSET_CAPTURE'
  ADMISSION_ABSENT: 'P_G1_WIRE_ADMISSION_ABSENT'
  PLACEMENT_KEY_ABSENT: 'P_G1_WIRE_PLACEMENT_KEY_ABSENT'
  PLACEMENT_KEY_MOVED: 'P_G1_WIRE_PLACEMENT_KEY_MOVED'
}>

/** The DERIVED pure-query subset of the frozen G1 spec table. */
export declare function g1PureQuerySubset(): readonly G1QuerySubsetEntry[]

/** The assembly-time wiring factory — semantics in the `.mjs`. */
export declare function createG1QueryWiring(input?: G1QueryWiringInput): G1QueryWiringResult
