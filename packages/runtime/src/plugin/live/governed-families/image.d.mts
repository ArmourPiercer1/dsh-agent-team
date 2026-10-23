/**
 * Adjacent tsc type surface for the already-counted
 * `packages/runtime/src/plugin/live/governed-families/image.mjs` — minimal,
 * consumed-only (the plane-effect-backends.d.mts / persona-probe.d.mts /
 * pa-mount-registry.d.mts pattern booked by the root 9e CI test-declaration
 * round). It types ONLY what the lane fixture
 * `packages/runtime/test/a5m2-readimg-arm-c2c3.test.ts` consumes; the runtime
 * law lives in the `.mjs`.
 */
export interface GovernedReadImageArmHandle {
  readonly familyId: string
  readonly adapterRevision: number
  readonly definitionIdentity: string
  readonly providerId: string
  readonly byteCap: number
  classify: (args: unknown, ctx: unknown) => ImageArmOutcome
  prepare: (plan: object) => ImageArmOutcome
  execute: (ticket: object, exec: unknown) => Promise<ImageArmOutcome>
  cancel: (planOrTicket: object) => ImageArmOutcome
  drain: () => void
}

export interface ImageArmOutcome {
  readonly ok?: boolean
  readonly code?: string
  readonly detail?: string
  readonly plan?: unknown
  readonly effects?: readonly unknown[]
  readonly manifest?: Record<string, unknown>
  readonly ticket?: unknown
  readonly value?: { readonly path?: string; readonly image?: Record<string, unknown> }
  readonly settled?: string
  readonly attachmentOutcome?: string
  readonly sideEffectPossible?: boolean
  readonly note?: string
}

export interface GovernedReadImageArmDeps {
  readonly definitionIdentity: string
  readonly providerId: string
  readonly realmId: string
  readonly namespaceRoot: string
  readonly resolveNamespaceRoot?: (rawPath: string) => string | null
  readonly readPort: {
    stat: (path: string, opts: { signal?: AbortSignal }) => Promise<{ size: number; isFile: boolean }>
    readFile: (path: string, opts: { maxBytes?: number; signal?: AbortSignal }) => Promise<Uint8Array>
  }
  readonly attachments: {
    commitImage: (input: { bytes: Uint8Array; mediaType: string; name: string; namespace: { realmId: string; sessionIncarnation: string }; correlation?: string }) => Promise<{ attachmentId: string; fingerprint: string; mediaType: string; bytes: number; width?: number; height?: number; name?: string }>
    imageLimits: { maxImageBytes: number; maxMessageImageBytes: number; mediaTypes?: readonly string[] }
  }
  readonly trustedIdentities: readonly string[]
  readonly observe?: (row: Record<string, unknown>) => void
}

export declare const A5_IMAGE_FAMILY_ID: string
export declare const A5_IMAGE_TOOL_NAME: string
export declare const A5_IMAGE_OPERATION: string
export declare const A5_IMAGE_ADAPTER_REVISION: number
export declare const A5_IMAGE_TYPED_CODES: Readonly<Record<string, string>>
export declare function createGovernedReadImageArm(deps: GovernedReadImageArmDeps): GovernedReadImageArmHandle
