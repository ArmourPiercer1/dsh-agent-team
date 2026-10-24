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
  serverIdentityOf: (memberId: string, generation: string) => string | null
}

export interface LspRealmSupply {
  ok: true
  revision: number
  memberId: string
  facts: LspSupplyFacts
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
