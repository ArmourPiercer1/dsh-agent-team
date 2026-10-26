/**
 * approval-entry-binder.d.mts — the declaration half of
 * `approval-entry-binder.mjs` (the pa-mount-registry.d.mts precedent).
 */
export interface ApprovalEntryLike { readonly definitionIdentity: string; readonly familyId: string; readonly scopeKey: string; readonly addedGeneration: number }
export declare function createApprovalEntryBinder(deps: {
  readonly approvalFor: (scopeKey: string, nativeName: string) => ApprovalEntryLike | undefined
  readonly bindEntry: (entry: { scopeKey: string; nativeName: string; definitionIdentity: string; familyId: string }) => { readonly ok: boolean }
  readonly scopeKey: string
  readonly claimOf: (name: string) => string | undefined
  readonly placedDefinition: (name: string) => object | undefined
  readonly identityOf: (definition: object) => string | null
}): (name: string) => ApprovalEntryLike | null
export declare function claimTableOf(registry: unknown): ReadonlyMap<string, string>
