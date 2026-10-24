/**
 * g3-lsp-wiring.d.mts — the tsc type surface of `g3-lsp-wiring.mjs` (the
 * same `.mjs` + adjacent `.d.mts` pattern as `g3-terminal-wiring.d.mts`:
 * only `.mjs` files load at runtime; tsc (NodeNext) resolves THESE
 * declarations for typed importers).
 *
 * SCOPE HONESTY: this is the MINIMAL surface consumed by
 * `test/a5m2-lsp-wiring-c1.test.ts` (and, at the mount card, by the plane's
 * B-LSP block) — NOT the module's full runtime shape. The delegate-arm ROW
 * face (classify/prepare/execute, the refusal objects) stays the opaque
 * structural type: those bytes are owned by `g3-fsproc-adapters.mjs` and its
 * spec and are deliberately NOT restated here. Widening beyond the consumed
 * members requires real signatures (never `any`).
 *
 * @module @dsh-agent-team/runtime/src/plugin/live/governed-families/g3-lsp-wiring (type surface)
 */

/** The plane's published split-path PA seat methods (paAdmit.open / .edge /
 *  .closePlan). The wiring checks the CALLABLE SHAPE; answers are typed
 *  structurally only — the kernel owns their shapes. */
export interface G3LspWirePaSeat {
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
    consumedProof?: { grant?: Record<string, unknown> } | undefined
    [key: string]: unknown
  }>
  closePlan: (callId: string) => void
}

/** The §5.2 fact surface (the delegate arm's own contract, hard-visited by
 *  the adapter): server identity/generation, document revision, and the
 *  REALM + cross-file SCOPE answers. Supplied by the integrator (the realm-
 *  scoped document resolver over the assembly seam — the mount card's leg). */
export interface G3LspFacts {
  server: () => { binaryIdentity: string; generation: string } | null
  document: (filePath: string, workspaceRoot: string) =>
    | { canonicalLocator: string; kind: 'workspace' | 'absolute-path'; revision?: string | null }
    | null
  documentRealm: (canonicalLocator: string, workspaceRoot: string) => string | null
  documentScope: (canonicalLocator: string, workspaceRoot: string) => string | null
}

export interface G3LspWiringInput {
  realmId: string
  providerId: string
  memberAgentId: string
  sessionHeaderId: string
  readNative: (name: string) => Record<string, unknown> | undefined | null
  lspFacts: G3LspFacts
  controlPort?: Readonly<Record<string, unknown>> | null
  bindingFacts: (toolName: string) => {
    bindingId: string
    bindingRevision: number
    policyGeneration: number
    authorityGeneration: number
  }
  correlationOf?: (exec: unknown, toolName: string) => string | null
  placementFeed: (name: string) => { definitionIdentity?: string; realmId?: string } | undefined
  identityOf: (placedDef: Readonly<Record<string, unknown>>) => string | null
  pa: G3LspWirePaSeat | ((walk: Readonly<Record<string, unknown>>) => never)
  observe?: (event: Readonly<Record<string, unknown>>) => void
}

export type G3LspWiringRefusal = { ok: false; code: string; detail: string }

export interface G3LspWiringAssembly {
  ok: true
  familyId: 'B-LSP'
  revision: number
  adapterRevision: number
  providerId: string
  placementNames: readonly string[]
  definitions: ReadonlyArray<Readonly<Record<string, unknown>>>
  rows: Readonly<Record<string, Readonly<Record<string, unknown>>>>
  declared: ReadonlyArray<Readonly<Record<string, unknown>>>
  rowOf: (name: string) => Readonly<Record<string, unknown>> | undefined
  drain: () => Readonly<Record<string, unknown>>
  familyRegistrations: () => ReadonlyArray<Readonly<{
    name: string
    definitionIdentity: string
    entry: Readonly<{ familyId: string; adapterRevision: number; providerIdentity: string }>
  }>>
}

export declare const A5_G3_LSP_WIRING_REVISION: number
export declare const A5_G3_LSP_TOOL_NAME: 'lsp'
export declare const A5_G3_LSP_WIRING_CODES: Readonly<Record<string, string>>

/** The B-LSP closed-table flat view (counterpart of PA_FAMILY_TARGET_RULES
 *  ['B-LSP'] in control/types.ts). An unrecognized manifest passes THROUGH
 *  unchanged — the table's grammar refusal stays the verdict. */
export declare function a5LspPaTargetFlat(manifest: unknown): unknown

/** Build the B-LSP wiring for ONE mount (closed input surface; a defective
 *  inject answers a typed refusal, never a partial mount). */
export declare function buildG3LspWiring(input?: G3LspWiringInput): G3LspWiringAssembly | G3LspWiringRefusal
