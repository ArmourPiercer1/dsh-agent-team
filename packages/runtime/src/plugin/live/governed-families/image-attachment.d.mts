/**
 * Adjacent tsc type surface for the already-counted
 * `packages/runtime/src/plugin/live/governed-families/image-attachment.mjs` —
 * minimal, consumed-only (the plane-effect-backends.d.mts pattern). It types
 * ONLY what the lane fixture
 * `packages/runtime/test/a5m2-readimg-arm-c2c3.test.ts` consumes.
 */
export interface ImageAttachmentStorePort {
  saveImage: (input: { data: Uint8Array; mediaType: string; name: string }) => Promise<{ attachmentId?: string; mediaType?: string; bytes?: number; width?: number; height?: number; name?: string }>
  /** pin639 fact: the store answers a re-validated `{ref, data}` PAIR, not bare bytes. */
  readImage: (ref: { attachmentId?: string; mediaType?: string; bytes?: number; width?: number; height?: number }, signal?: AbortSignal) => Promise<{ ref?: unknown; data?: Uint8Array } | Uint8Array>
  imageLimits: { maxImageBytes: number; maxMessageImageBytes: number; mediaTypes?: readonly string[] }
}

export interface ImageAttachmentReceipt {
  readonly attachmentId: string
  readonly fingerprint: string
  readonly mediaType: string
  readonly bytes: number
  readonly width?: number
  readonly height?: number
  readonly name?: string
  readonly namespace: { readonly realmId: string; readonly sessionIncarnation: string }
}

export interface ImageAttachmentReferenceOutcome {
  readonly ok: boolean
  readonly code?: string
  readonly detail?: string
  readonly bytes?: Uint8Array
  readonly fingerprint?: string
  readonly attachmentId?: string
}

export interface ImageAttachmentAdapterHandle {
  readonly imageLimits: ImageAttachmentStorePort['imageLimits']
  commitImage: (input: { bytes: Uint8Array; mediaType: string; name: string; namespace: { realmId: string; sessionIncarnation: string }; correlation?: string }) => Promise<ImageAttachmentReceipt>
  referenceImage: (input: { attachmentId: string; namespace: { realmId: string; sessionIncarnation: string }; signal?: AbortSignal }) => Promise<ImageAttachmentReferenceOutcome>
  stats: () => { commits: number; references: number; storeCalls: number, refusedForeignNamespace: number }
}

export declare const A5_IMAGE_ATTACHMENT_CODES: Readonly<Record<string, string>>
export declare function createImageAttachmentAdapter(deps: { store: ImageAttachmentStorePort; observe?: (row: Record<string, unknown>) => void }): ImageAttachmentAdapterHandle
