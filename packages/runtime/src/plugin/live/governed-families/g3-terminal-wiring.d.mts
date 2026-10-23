/**
 * g3-terminal-wiring.d.mts — the tsc type surface of
 * `g3-terminal-wiring.mjs` (the same `.mjs` + adjacent `.d.mts` pattern as
 * `g6-session-query-wiring.d.mts`: only `.mjs` files load at runtime, and tsc
 * (NodeNext) resolves THESE declarations for typed importers).
 *
 * SCOPE HONESTY: this is the MINIMAL surface actually consumed by the plane's
 * B-TERMINAL block (`team-tool-plane.mjs`) and by
 * `test/a5m2-g3-terminal-wiring.test.ts` / `test/a5m2-g3-plane-mount-c1.test.ts`
 * — NOT the module's full runtime shape. The adapter ROW face (classify/
 * prepare/execute and the refusal objects) stays the opaque structural type
 * below: those bytes are owned by `g3-fsproc-adapters.mjs` (rev.3, released)
 * and its spec, and this surface deliberately does NOT restate them.
 * Widening beyond the consumed members requires real signatures (never
 * `any`).
 *
 * @module @dsh-agent-team/runtime/src/plugin/live/governed-families/g3-terminal-wiring (type surface)
 */

/** The plane's published split-path PA seat methods (paAdmit.open / .edge /
 *  .closePlan). The seat is the CALLABLE face with these attached — the
 *  wiring checks the CALLABLE SHAPE (a frozen duck `{ ok: true }` is refused
 *  at assembly, never a stand-in). Answers are typed structurally only —
 *  the kernel owns their shapes. */
export interface G3WirePaSeat {
  open: (walk: Readonly<Record<string, unknown>>) => Promise<{
    kind?: string
    cancelled?: boolean
    code?: string
    detail?: string
    grant?: unknown
    paDurableMint?: unknown
    request?: unknown
  }>
  edge: (input: Readonly<Record<string, unknown>>) => Promise<{
    kind?: string
    cancelled?: boolean
    code?: string
    detail?: string
    consumedProof?: { grant?: unknown } | undefined
  }>
  closePlan: (callId: string) => void
}

export interface G3WireFamilyRegistration {
  readonly name: string
  readonly definitionIdentity: string
  readonly entry: {
    familyId: string
    adapterRevision: number
    providerIdentity: string
  }
}

export interface G3TerminalWiringInput {
  readonly realmId: string
  readonly providerId: string
  /** The REAL member identity (exec.agent.id / .session.header.id shapes). */
  readonly memberAgentId: string
  readonly sessionHeaderId: string
  /** The MEMBER-SCOPED native capture seam — read exactly ONCE per name. */
  readonly readNative: (name: string) => Record<string, unknown> | undefined | null
  /** §5.1 declared_mount: the DECLARED public backend types. */
  readonly declaredBackends: readonly string[]
  /** The §5.1 governance interface: target identity/incarnation AND the
   *  per-open CONTROLLED EXECUTION PLAN are SERVICE facts. */
  readonly ptyService: Readonly<{
    backend: (type: string) => unknown
    session: (ownerAgentId: string, sessionId: string) => unknown
    approvedOpenPlan: (callId: string) => unknown
  }>
  /** THE REAL handle route (§5.1): the adapter's own hard-visit law
   *  validates every member; a control-plane-only pose refuses the mount. */
  readonly controlPortDeps: Readonly<Record<string, unknown>>
  /** The CURRENT dispatcher binding of THAT tool's entry, read LIVE
   *  (bindingIds are per-tool facts; a snapshot never substitutes). */
  readonly bindingFacts: (toolName: string) => {
    bindingId: string
    bindingRevision: number
    policyGeneration: number
    authorityGeneration: number
  }
  /** The ISSUED call identity seam (the plane's mount law: per-mount nonce +
   *  seq + execution-token single-flight). Absent, only an exec answering a
   *  non-empty `callId` is admitted; nothing is guessed. */
  readonly correlationOf?: (exec: unknown, toolName: string) => string | null
  readonly placementFeed: (name: string) => { definitionIdentity?: string, realmId?: string } | undefined | null
  /** The placement-moment identity mint (pb §6 `definitionIdentityOf`). */
  readonly identityOf: (definition: unknown) => string | null
  readonly pa: G3WirePaSeat
  readonly observe?: (event: Record<string, unknown>) => void
}

export interface G3TerminalWiringAssembly {
  readonly ok: true
  readonly familyId: 'B-TERMINAL'
  readonly revision: number
  readonly adapterRevision: number
  readonly providerId: string
  readonly placementNames: readonly string[]
  readonly definitions: readonly Readonly<Record<string, unknown>>[]
  readonly rows: Readonly<Record<string, unknown>>
  readonly declared: readonly Readonly<{ name: string, familyId: string, status: string, reason: string }>[]
  readonly rowOf: (name: string) => Record<string, unknown> | undefined
  /** L9 new-call prohibition ONLY — the adapter's own drain law per arm. */
  readonly drain: () => Readonly<Record<string, unknown>>
  /** Call at the mount moment (AFTER publish). Throws
   *  P_TERM_WIRE_PLACEMENT_KEY_ABSENT / P_TERM_WIRE_PLACEMENT_KEY_MOVED
   *  instead of guessing or skipping. */
  readonly familyRegistrations: () => readonly G3WireFamilyRegistration[]
}

export interface G3TerminalWiringRefusal {
  readonly ok: false
  readonly code: string
  readonly detail: string
}

export declare const A5_G3_TERMINAL_WIRING_REVISION: number

export declare const A5_G3_TERMINAL_TOOL_NAMES: readonly string[]

export declare const A5_G3_TERMINAL_WIRING_CODES: Readonly<{
  INPUT_INVALID: 'P_TERM_WIRE_INPUT_INVALID'
  CALL_ID_ABSENT: 'P_TERM_WIRE_CALL_ID_ABSENT'
  EFFECTS_UNPARSABLE: 'P_TERM_WIRE_EFFECTS_UNPARSABLE'
  ADMISSION_CANCELLED: 'P_TERM_WIRE_ADMISSION_CANCELLED'
  APPROVAL_NOT_LANDED: 'P_TERM_WIRE_APPROVAL_NOT_LANDED'
  EDGE_CANCELLED: 'P_TERM_WIRE_EDGE_CANCELLED'
  CONSUME_PROOF_MISSING: 'P_TERM_WIRE_CONSUME_PROOF_MISSING'
  PREPARE_REFUSED: 'P_TERM_WIRE_PREPARE_REFUSED'
  IDENTITY_UNBOUND: 'P_TERM_WIRE_IDENTITY_UNBOUND'
  PLACEMENT_KEY_ABSENT: 'P_TERM_WIRE_PLACEMENT_KEY_ABSENT'
  PLACEMENT_KEY_MOVED: 'P_TERM_WIRE_PLACEMENT_KEY_MOVED'
}>

export declare function buildG3TerminalWiring (
  input?: G3TerminalWiringInput,
): G3TerminalWiringAssembly | G3TerminalWiringRefusal
