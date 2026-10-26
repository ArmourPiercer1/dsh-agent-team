/**
 * family-assembly.d.mts — the declaration half of `family-assembly.mjs` (an
 * untyped `.mjs` SOURCE module), so typed consumers reach the seam without
 * `any` (the pa-mount-registry.d.mts precedent). Described from the
 * implementation; see the module header for the descriptor law.
 */
export declare const FAMILY_ASSEMBLY_SCHEMA: 'u7-family-assembly/1'
export declare const CAPABILITY_KEYS: readonly string[]
export declare const FORBIDDEN_CAPABILITY_KEYS: readonly string[]

export type FamilyCapabilities = Readonly<Record<string, unknown>>

export interface FamilyBuilt {
  readonly definitions: readonly { readonly name: string }[]
  readonly contribution: { readonly familyId: string; readonly visibility: { readonly nativeNames: readonly string[] } } & Record<string, unknown>
  readonly diagnostics?: Readonly<Record<string, unknown>>
  readonly handoff?: { readonly name: string; open(args: unknown, opts: unknown): unknown; close(token: unknown): unknown }
  readonly teardown?: () => void
}

export interface FamilyAssemblyDescriptor {
  readonly schema: 'u7-family-assembly/1'
  readonly familyId: string
  readonly order: number
  readonly placement: number
  readonly config: Readonly<Record<string, 'boolean'>>
  claims(cap: FamilyCapabilities): string[]
  enabled(cap: FamilyCapabilities): boolean
  disabledOwned(cap: FamilyCapabilities): string[]
  backends?(cap: FamilyCapabilities): Readonly<Record<string, unknown>>
  build(cap: FamilyCapabilities): FamilyBuilt | { readonly refused: { readonly code: string; readonly message: string } }
  readonly refusalCode: string
}

export type SeamCheck = { readonly ok: true } | { readonly ok: false; readonly detail: string }

export declare function makeFamilyCapabilities(fields: Record<string, unknown>): FamilyCapabilities
export declare function validateFamilyDescriptor(d: unknown): SeamCheck
export declare function checkFamilyConfig(descriptor: FamilyAssemblyDescriptor, planeConfig: unknown):
  { readonly ok: true } | { readonly ok: false; readonly code: string; readonly message: string }
export declare function checkBuiltFamily(descriptor: FamilyAssemblyDescriptor, claims: readonly string[], built: unknown): SeamCheck
export declare function verifyReviewedFamilies(input: {
  readonly manifestPath: string
  readonly entries: readonly { readonly module: string; readonly familyAssembly: unknown }[]
}):
  | { readonly ok: true; readonly descriptors: readonly FamilyAssemblyDescriptor[]; readonly kernelCapabilities: Readonly<Record<string, unknown>> }
  | { readonly ok: false; readonly detail: string }
