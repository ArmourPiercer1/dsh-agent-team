/**
 * g6-session-query-wiring.d.mts — the tsc type surface of
 * `g6-session-query-wiring.mjs` (the same `.mjs` + adjacent `.d.mts` pattern
 * as `g1-query-wiring.d.mts`: only `.mjs` files load at runtime, and tsc
 * (NodeNext) resolves THESE declarations for typed importers).
 *
 * SCOPE HONESTY: this is the MINIMAL surface actually consumed by the paired
 * registration writer (the `familyRegistrations` entries flow to
 * `registerA5GovernedFamily`) and by `test/a5m2-g6-session-query-wiring.test.ts`
 * — NOT the module's full runtime shape. The adapter ROW face (classify/
 * invoke and the refusal objects) stays the opaque structural type below:
 * those bytes are owned by `g6-session-query.mjs` (rev.4, released) and its
 * spec, and this surface deliberately does NOT restate them. Widening beyond
 * the consumed members requires real signatures (never `any`).
 *
 * @module @dsh-agent-team/runtime/src/plugin/live/governed-families/g6-session-query-wiring (type surface)
 */

/** The plane's published split-path PA seat methods (paAdmit.open / .edge /
 *  .closePlan, team-tool-plane.mjs:1214/:1679/:1713/:1714). Answers are typed
 *  structurally only — the kernel owns their shapes. */
export interface G6WirePaSeat {
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
 *  three methods (team-tool-plane.mjs:1214 defines it as
 *  `const paAdmit = async (...) => {...}` with `.open`/:1679, `.closePlan`
 *  /:1713 and `.edge`/:1714 attached), so the input accepts exactly a
 *  callable-with-those-methods or an equivalent plain methods object —
 *  nothing else poses as the admission seat. */
export type G6WirePaSeatInput = G6WirePaSeat | (G6WirePaSeat & ((
  input: Readonly<Record<string, unknown>>,
) => Promise<{ kind?: string, cancelled?: boolean, code?: string, detail?: string }>))

/** The adapter row face AS CONSUMED here: identity members typed, the plan
 *  machinery structurally opaque (owned by g6-session-query.mjs rev.4). */
export interface G6WireAdapterRow {
  readonly active: boolean
  readonly familyId: string
  readonly adapterRevision: number
  readonly toolName: string
  readonly realmId: string
  readonly providerId: string
  readonly description: string | null
  readonly definitionIdentity: string | null
  readonly captured: () => boolean
  readonly classify: (args: unknown) => {
    ok: boolean
    code?: string
    detail?: string
    correlation?: string
    effects?: unknown
    parametersFingerprint?: string
    targetManifest?: Record<string, unknown>
    reviewPayload?: Record<string, unknown>
    plan?: unknown
  }
  readonly invoke: (args: unknown, exec?: { signal?: unknown }) => Promise<{
    ok?: boolean
    code?: string
    detail?: string
    value?: unknown
    plan?: unknown
  }>
  readonly drain: () => void
  readonly draining: () => boolean
}

/** One per-tool wiring report entry. */
export type G6WireRowReport =
  | { readonly status: 'ACTIVE'; readonly row: G6WireAdapterRow; readonly definition: Readonly<Record<string, unknown>>; readonly captureDefinitionIdentity: string | null }
  | { readonly status: 'DECLARED-INACTIVE'; readonly reason: string; readonly row: G6WireAdapterRow }

/** One mount-moment registration entry: the RUNTIME placement identity is the
 *  key; the shared writer feeds it to `registerA5GovernedFamily`. */
export interface G6WireFamilyRegistration {
  readonly name: string
  readonly definitionIdentity: string
  readonly entry: Readonly<{
    familyId: string
    adapterRevision: number
    providerIdentity: string
  }>
}

export interface G6SessionQueryWiringInput {
  readonly realmId: string
  readonly providerId: string
  readonly readNative: (name: string) => Record<string, unknown> | undefined | null
  readonly queryPorts: Readonly<Record<string, unknown>>
  readonly readCaller: () => Record<string, unknown> | undefined | null
  /** INJECTED Team-plane decision port; the wiring REFUSES to assemble
   *  without it (no permissive stand-in). */
  readonly teamCeiling: (targetSessionId: string, caller: Readonly<Record<string, unknown>>) => boolean
  readonly declaredMount: Readonly<{
    searchBackend: Readonly<{ present: true }> | Readonly<{ present: false; evidence: string }>
  }>
  readonly maxSearchResults?: number
  readonly definitionIdentityOf?: (definition: Readonly<Record<string, unknown>>) => string
  /** The ISSUED call identity seam (the plane's mount law: per-mount nonce +
   *  seq + execution-token single-flight, register.ts:196-226). Absent, only
   *  an exec answering a non-empty `callId` is admitted; nothing is guessed. */
  readonly correlationOf?: (exec: unknown, toolName: string) => string | null
  readonly placementFeed: (name: string) => { definitionIdentity?: string, realmId?: string } | undefined | null
  readonly pa: G6WirePaSeatInput
  readonly observe?: (event: Record<string, unknown>) => void
}

export interface G6SessionQueryWiringAssembly {
  readonly ok: true
  readonly familyId: 'B-SESSION-QUERY'
  readonly revision: number
  readonly adapterRevision: number
  readonly providerId: string
  readonly placementNames: readonly string[]
  readonly definitions: readonly Readonly<Record<string, unknown>>[]
  readonly rows: Readonly<Record<string, G6WireRowReport>>
  readonly declared: readonly Readonly<{ name: string, familyId: string, status: string, reason: string }>[]
  readonly rowOf: (name: string) => G6WireAdapterRow | undefined
  readonly drain: () => Readonly<Record<string, unknown>>
  /** Call at the mount moment (AFTER publish). Throws
   *  P_G6_WIRE_PLACEMENT_KEY_ABSENT / P_G6_WIRE_PLACEMENT_KEY_MOVED
   *  instead of guessing or skipping. */
  readonly familyRegistrations: () => readonly G6WireFamilyRegistration[]
}

export interface G6SessionQueryWiringRefusal {
  readonly ok: false
  readonly code: string
  readonly detail: string
}

export declare const A5_G6_QUERY_WIRING_REVISION: number

export declare const A5_G6_QUERY_WIRING_CODES: Readonly<{
  INPUT_INVALID: 'P_G6_WIRE_INPUT_INVALID'
  CALL_ID_ABSENT: 'P_G6_WIRE_CALL_ID_ABSENT'
  EFFECTS_UNPARSABLE: 'P_G6_WIRE_EFFECTS_UNPARSABLE'
  ADMISSION_CANCELLED: 'P_G6_WIRE_ADMISSION_CANCELLED'
  APPROVAL_NOT_LANDED: 'P_G6_WIRE_APPROVAL_NOT_LANDED'
  EDGE_CANCELLED: 'P_G6_WIRE_EDGE_CANCELLED'
  CONSUME_PROOF_MISSING: 'P_G6_WIRE_CONSUME_PROOF_MISSING'
  PLAN_DRIFT: 'P_G6_WIRE_PLAN_DRIFT'
  PLAN_INTEGRITY: 'P_G6_WIRE_PLAN_INTEGRITY'
  PLACEMENT_KEY_ABSENT: 'P_G6_WIRE_PLACEMENT_KEY_ABSENT'
  PLACEMENT_KEY_MOVED: 'P_G6_WIRE_PLACEMENT_KEY_MOVED'
}>

export declare function buildG6SessionQueryWiring (
  input?: G6SessionQueryWiringInput,
): G6SessionQueryWiringAssembly | G6SessionQueryWiringRefusal
