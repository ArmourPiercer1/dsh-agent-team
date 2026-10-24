/**
 * lsp-realm-supply.d.mts — the tsc type surface of `lsp-realm-supply.mjs`
 * (the same `.mjs` + adjacent `.d.mts` pattern; see
 * `g3-lsp-wiring.d.mts` for the scope-honesty law).
 *
 * @module @dsh-agent-team/runtime/src/plugin/live/governed-families/lsp-realm-supply (type surface)
 */

/** The published LspRealmAssembly face (sandbox-provider/lsp-assembly.ts:
 *  94-107). Structurally typed here — the REAL product is its own module's
 *  bytes; the supply consumes this shape and never widens it. */
export interface LspRealmAssemblyFace {
  ensure: (memberId: string, generation: string) => Promise<{ ok: boolean, value?: unknown, error?: { code?: string, message?: string } }>
  policyChange: (memberId: string, generation: string) => Promise<{ ok: boolean, value?: unknown, error?: { code?: string, message?: string } }>
  dispose?: (memberId: string) => Promise<{ ok: boolean, value?: unknown, error?: { code?: string, message?: string } }>
  disposeAll: () => Promise<{ ok: boolean, value?: unknown, error?: { code?: string, message?: string } }>
  current: (memberId: string) => { memberId: string, generation: string, realmId: string, pid: number } | undefined
  size: () => number
}

/** The §5.2 fact surface consumed by buildG3LspWiring's `lspFacts` input. */
export interface LspSupplyFacts {
  server: () => { binaryIdentity: string; generation: string } | null
  document: (filePath: string, workspaceRoot: string) =>
    | { kind: 'workspace' | 'absolute-path'; canonicalLocator: string; revision: string }
    | null
  documentRealm: (canonicalLocator: string, workspaceRoot: string) => string | null
  documentScope: (canonicalLocator: string, workspaceRoot: string) => 'inside' | 'outside'
}

export interface LspRealmSupplyInput {
  assembly: LspRealmAssemblyFace
  memberId: string
  /** THE APPROVED GENERATION (root LSP-review ruling 2026-10-25, P1-b): the
   *  query backend ensures/syncs exactly this (member x generation) tuple. */
  generation: string
  serverIdentityOf: (memberId: string, generation: string) => string | null
  extensionToLanguage?: Readonly<Record<string, string>>
}

/** The 639 public closed-union query answer (packages/lsp/lsp/src/types.ts:
 *  85-87): navigation lands `locations`, hover lands `hover` (or null). */
export type LspSupplyQueryResult =
  | { readonly kind: 'locations'; readonly locations: readonly { readonly uri: string; readonly range: unknown }[]; readonly resolvedWorkspaceUri: string }
  | { readonly kind: 'hover'; readonly hover: { readonly contents: string; readonly range?: unknown } | null }

/** THE delegate-port face (the adapter's own prepare/drift/handleStatus/
 *  cancelCleanup/liveHandles law — the createHostTerminalControlPort shape
 *  precedent). prepare is the effect entry AND the REAL lifecycle trigger;
 *  the handle invokes the approved realm's governed round-trip. */
export interface LspSupplyControlPort {
  prepare: (spec: Record<string, unknown>) => Promise<Record<string, unknown>>
  drift: (canonical: Record<string, unknown>) => (handle: Record<string, unknown>) => { ok: false, code: string, detail: string } | null
  handleStatus: (handle: Record<string, unknown>) => Record<string, unknown>
  cancelCleanup: (live: Record<string, unknown> | null, context: Record<string, unknown>) => Promise<Record<string, unknown>>
  liveHandles: (memberId: string) => readonly Record<string, unknown>[]
}

export interface LspRealmSupply {
  ok: true
  revision: number
  memberId: string
  generation: string
  facts: LspSupplyFacts
  controlPort: LspSupplyControlPort
  query: (request: { operation: string, file_path: string, workspaceRoot: string, line: number, character: number, callId?: string }) => Promise<LspSupplyQueryResult>
  realmIdOf: (generation: string) => string
  ensure: (generation: string) => Promise<{ ok: boolean, value?: unknown, error?: { code?: string, message?: string } }>
  policyChange: (generation: string) => Promise<{ ok: boolean, value?: unknown, error?: { code?: string, message?: string } }>
  syncGeneration: (generation: string) => Promise<{
    ok: boolean
    status: 'hot-reuse' | 'policy-changed' | 'policy-change-REFUSED' | 'assembled' | 'assemble-REFUSED'
    instance?: unknown
    result?: unknown
  }>
  drainAll: () => Promise<{ ok: boolean, value?: unknown, error?: { code?: string, message?: string } }>
}

export interface LspSupplyRefusal { ok: false; code: string; detail: string }

export declare const A5_LSP_REALM_SUPPLY_REVISION: number
export declare const A5_LSP_SUPPLY_CODES: Readonly<Record<string, string>>

/** The realm spelling (the assembly's law at lsp-assembly.ts:113-115). */
export declare function a5LspRealmId(memberId: string, generation: string): string

/** Build the member-scoped B-LSP realm supply over an EXISTING assembly. */
export declare function createA5LspRealmSupply(input?: LspRealmSupplyInput): LspRealmSupply | LspSupplyRefusal
