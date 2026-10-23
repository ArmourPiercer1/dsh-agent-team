/**
 * Adjacent tsc type surface for the already-counted
 * `packages/runtime/src/plugin/live/governed-families/image.mjs` (REVISION 2
 * — receipt-driven consumption over the strict-manifest chain). Minimal,
 * consumed-only (the plane-effect-backends.d.mts pattern): it types ONLY
 * what the lane fixture `packages/runtime/test/a5m2-readimg-arm-c2c3.test.ts`
 * consumes; the runtime law lives in the `.mjs`. The manifest is typed
 * STRUCTURALLY (a runtime .mjs never imports the host .ts class; the arm
 * pins `schema` by literal at runtime).
 */
import type { ImageAttachmentAdapterHandle } from './image-attachment.d.mts'

export interface ImageReadBoundedGrantRef {
  /** The minted grant (ask world) — an explicitly EMPTY object in the
   *  all-allow world (nothing was ever minted; never a fabricated id). */
  grant: { grantId?: string } & Record<string, unknown>
  realmId: string
  canonicalLocator: string
  /** Present only when there is no grant to ride: the trusted this-call id. */
  callId?: string
}

export interface ImageReadBoundedValue {
  bytes: Uint8Array
  observedKind: string
  byteLength: number
}

export type ImageReadBoundedOutcome =
  | { ok: true, value: ImageReadBoundedValue }
  | { ok: false, code?: string, detail?: string, drift?: boolean }

/** The CENTER-owned FS-PROC port (root ruling): the M1-verified read binary
 *  boundary — same-FD re-anchor, O_NOFOLLOW, final-FD check, cap+1 stop,
 *  cancellation honored inside the port. The production implementation is
 *  CENTER's shared face; the arm only ever consumes this shape. */
export type ImageReadBoundedPort = (
  grantRef: ImageReadBoundedGrantRef,
  opts: { maxBytes: number, signal?: AbortSignal },
) => Promise<ImageReadBoundedOutcome>

/** The durable strict manifest as projected by control/types.ts TODAY:
 *  parsePaManifestFamilyBlock (f696e6f2) KEEPS the four family fields at
 *  full value when the row carries them (all-or-nothing; a partial block
 *  fails the whole manifest), and createPaControlLeg refuses a registered
 *  family's missing/incomplete carrier BEFORE the durable row. The fields
 *  are typed optional here because UNBOUND (pre-A5M2) families legitimately
 *  bear no block; a BOUND call missing it fails closed in the arm
 *  (RECEIPT_INCOMPLETE) — no pending release. */
export interface ImageConsumptionManifest {
  schema: string
  approvalCaseId: string
  requiredAuthority: string
  perEffectRequired: readonly string[]
  deniedEffects: readonly { effectIndex: number, requiredAuthority: string }[]
  authorityGeneration: number
  realmId: string
  callId: string
  parametersFingerprint: string
  effects: { fingerprint: string, effects: readonly Record<string, unknown>[] }
  binding: Record<string, unknown> & { bindingId: string, toolName: string, definitionIdentity: string, providerId: string }
  member: { teamSessionId: string, instanceId: string }
  familyId?: string
  adapterRevision?: number
  providerIdentity?: string
  targetManifest?: Record<string, unknown>
}

/** The strict-chain `approve` result (PaControlLegResult approve arm,
 *  structural mirror — the bridge .ts is never imported by the .mjs). */
export interface ImageConsumptionReceipt {
  decision: 'approve' | 'deny' | 'unsettled'
  requestId?: string
  grant?: { grantId?: string } & Record<string, unknown>
  manifest?: ImageConsumptionManifest
}

/** The plane's trusted per-call facts (the same trusted source that built
 *  the leg input; the arm re-checks them at the consumption point).
 *  `approval` is the CONSUMPTION EXECUTION CONTEXT (root ruling on
 *  f3864b24): 'ask' demands the durable approve receipt; 'all-allow' is the
 *  world where policy admitted every effect, so no Control row and no
 *  requestId ever existed. The arm never guesses it. */
export interface ImageCallFacts {
  member: { teamSessionId: string, instanceId: string }
  callId: string
  authorityGeneration: number
  definitionIdentity: string
  providerIdentity: string
  approval: 'ask' | 'all-allow'
}

export interface ImageTargetManifest {
  readonly familyId: string
  readonly adapterRevision: number
  readonly operation: string
  readonly realmId: string
  readonly canonicalTarget: string
  readonly declaredMediaType: string
  readonly byteCap: number
  readonly byteCapSource: string
  readonly businessObligations: readonly Record<string, string>[]
}

export interface ImageArmOutcome {
  readonly ok: boolean
  readonly code?: string
  readonly detail?: string
  readonly sideEffectPossible?: boolean
  readonly portCode?: string
  readonly classifyRefused?: boolean
  readonly value?: {
    readonly path: string
    readonly image: {
      readonly attachmentId: string
      readonly sourceSha256: string
      readonly normalizedEqualsSource: boolean
      readonly mediaType: string
      readonly bytes: number
      readonly width?: number
      readonly height?: number
      readonly name?: string
    }
  }
}

export interface GovernedReadImageArmDeps {
  definitionIdentity: string
  providerId: string
  realmId: string
  namespaceRoot: string
  readBounded: ImageReadBoundedPort
  attachments: ImageAttachmentAdapterHandle
  observe?: (row: Record<string, unknown>) => void
}

export interface GovernedReadImageArmHandle {
  readonly familyId: string
  readonly adapterRevision: number
  readonly definitionIdentity: string
  readonly providerId: string
  readonly byteCap: number
  classify: (args: unknown) => { ok: true, effects: unknown, targetManifest: ImageTargetManifest } | { ok: false, code: string, detail: string }
  execute: (args: unknown, receipt: ImageConsumptionReceipt | undefined, callFacts: ImageCallFacts, signal?: AbortSignal) => Promise<ImageArmOutcome>
  reference: (attachmentId: string, namespace: { realmId: string, teamSessionId: string, instanceId: string }, signal?: AbortSignal) => Promise<Record<string, unknown>>
  drain: () => void
  stats: () => { classifyRefused: number, consumptionRefused: number, consumed: number, portCalls: number, commits: number, lawRefused: number, boundaryUnknown: number }
}

export declare const A5_IMAGE_FAMILY_ID: 'B-IMAGE'
export declare const A5_IMAGE_TOOL_NAME: 'read_image'
export declare const A5_IMAGE_OPERATION: 'read-exact-file'
export declare const A5_IMAGE_ADAPTER_REVISION: 2
export declare const A5_IMAGE_MANIFEST_SCHEMA: 'a5m1.pa-control-manifest.v2'
export declare const A5_IMAGE_TYPED_CODES: Readonly<Record<string, string>>
export declare function createGovernedReadImageArm(deps: GovernedReadImageArmDeps): GovernedReadImageArmHandle
