/**
 * Adjacent tsc type surface for the already-counted
 * `packages/runtime/src/plugin/live/governed-families/image-attachment.mjs`
 * (REVISION 2 — (namespace, attachmentId) entitlements + full-ref retention
 * + source/normalized dual hash). Minimal, consumed-only (the
 * plane-effect-backends.d.mts pattern): it types ONLY what the lane fixture
 * `packages/runtime/test/a5m2-readimg-arm-c2c3.test.ts` consumes.
 */

/** The durable ENTITLEMENT namespace: the leg's member identity — never a
 *  self-invented scope, never complete-by-default. */
export interface ImageAttachmentNamespace {
  realmId: string
  teamSessionId: string
  instanceId: string
}

export interface ImageAttachmentStoreRef {
  attachmentId?: string
  mediaType?: string
  bytes?: number
  width?: number
  height?: number
  name?: string
}

export interface ImageAttachmentStorePort {
  saveImage: (input: { data: Uint8Array; mediaType: string; name: string }) => Promise<ImageAttachmentStoreRef>
  /** pin639 fact: the store answers a re-validated `{ref, data}` PAIR, not bare bytes. */
  readImage: (ref: ImageAttachmentStoreRef, signal?: AbortSignal) => Promise<{ ref?: unknown; data?: Uint8Array } | Uint8Array>
  imageLimits: { maxImageBytes: number; maxMessageImageBytes: number; mediaTypes?: readonly string[] }
}

export interface ImageAttachmentReceipt {
  readonly attachmentId: string
  /** digest of the bytes AS READ (source) — separate from the store's
   *  normalized-object identity (attachmentId); never collapsed. */
  readonly sourceSha256: string
  readonly normalizedEqualsSource: boolean
  readonly mediaType: string
  readonly bytes: number
  readonly width?: number
  readonly height?: number
  readonly name?: string
  readonly namespace: Readonly<ImageAttachmentNamespace>
}

export interface ImageAttachmentReferenceOutcome {
  readonly ok: boolean
  readonly code?: string
  readonly detail?: string
  readonly bytes?: Uint8Array
  readonly attachmentId?: string
  readonly sourceSha256?: string
  readonly normalizedEqualsSource?: boolean
}

export interface ImageAttachmentAdapterHandle {
  readonly imageLimits: ImageAttachmentStorePort['imageLimits']
  commitImage: (input: { bytes: Uint8Array; mediaType: string; name: string; namespace: ImageAttachmentNamespace; correlation?: string }) => Promise<ImageAttachmentReceipt>
  referenceImage: (input: { attachmentId: string; namespace: ImageAttachmentNamespace; signal?: AbortSignal }) => Promise<ImageAttachmentReferenceOutcome>
  stats: () => { commits: number; recommits: number; references: number; storeCalls: number; refusedForeignNamespace: number; refusedUnknown: number; commitDrift: number }
}

export declare const A5_IMAGE_ATTACHMENT_CODES: Readonly<Record<string, string>>
export declare function createImageAttachmentAdapter(deps: { store: ImageAttachmentStorePort; observe?: (row: Record<string, unknown>) => void }): ImageAttachmentAdapterHandle
