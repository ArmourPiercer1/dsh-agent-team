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

/** The REAL PA execution credential the trusted face holds in EITHER
 *  world: the durable leg's minted grant (ask) or the policy-admitted
 *  decision.grant (all-allow; team-tool-plane.mjs :1166-1168). The unified
 *  PA final edge (CENTER's consumeForExecution, :1406) consumes it — the
 *  arm never builds, widens, or synthesizes one (root re-review on
 *  f3864b24-fix3: no empty-object shape, no placeholder id, no omission). */
export interface ImagePaGrant { grantId: string, [key: string]: unknown }

export interface ImageReadBoundedGrantRef {
  /** Required and REAL in EVERY world: a missing grant is a TYPE error
   *  here AND a runtime refusal in the arm (fail-closed in both shapes). */
  grant: ImagePaGrant
  realmId: string
  canonicalLocator: string
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
export interface ImageCallFactsBase {
  member: { teamSessionId: string, instanceId: string }
  callId: string
  authorityGeneration: number
  definitionIdentity: string
  /** The plane's PER-CALL answer of the SAME live binding authority the arm
   *  reads (A5M2 provider-identity supply, site 3): it is never a constant and
   *  never copied off a row. The production plane is a `.mjs` and may therefore
   *  hand `undefined` when the authority answers nothing — the arm refuses that
   *  consumption with its own code (zero port reads, zero attachment writes).
   *  A typed caller passes the live answer; there is nothing to fall back to. */
  providerIdentity: string
}

/** THE CONSUMPTION EXECUTION CONTEXT — a DISCRIMINATED pair (root
 *  re-review on f3864b24-fix3): 'ask' rides the durable receipt (its
 *  credential comes ON the receipt — `grant?: undefined` keeps the
 *  discrimination honest); 'all-allow' has NO Control row but MUST carry
 *  the real PA grant the trusted face holds. A missing all-allow grant is
 *  a type error here, mirroring the arm's runtime refusal (fail-closed in
 *  both shapes; the former "approval flag only" flat interface is dead). */
export type ImageCallFacts = ImageCallFactsBase & (
  | { approval: 'ask', grant?: undefined }
  | { approval: 'all-allow', grant: ImagePaGrant }
)

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
      /** Present ONLY when the store NORMALIZED (reduced) the raster: the
       *  input size before the scale (pin639 attachment types). Carried
       *  verbatim from the store receipt for original-frame coordinate math. */
      readonly originalDimensions?: { readonly width: number; readonly height: number }
      readonly name?: string
    }
  }
}

/** Result of the image-capability route gate (root narrow review on 233ba,
 *  item ①): the placing assembly builds it over the PUBLIC llm service + the
 *  exec route and calls it at the top of execute, BEFORE any resource is
 *  resolved/read/saved — mirroring native read-image.ts assertImageCapableRoute.
 *  `ok:true` admits the read; `ok:false` carries one of the two native
 *  refusals (route unresolvable / model not image-capable). */
export interface ImageCapabilityRefusal {
  readonly code?: string
  readonly detail?: string
}
export type ImageCapabilityProbe = (
  signal: AbortSignal | undefined,
) => Promise<{ readonly ok: true } | { readonly ok: false; readonly refusal?: ImageCapabilityRefusal }>

export interface GovernedReadImageArmDeps {
  definitionIdentity: string
  /** The arm's provider identity, in ONE of two mutually exclusive shapes
   *  (A5M2 provider-identity supply, candidate 2026-10-23):
   *  - `providerId` — a NON-EMPTY CONSTANT the arm may honestly carry (the
   *    unit-world shape: an arm whose authority cannot change under it);
   *  - `provider` — a READER that resolves the LIVE binding authority's
   *    providerId at every read (the production mount shape: the arm is built
   *    at the PLACEMENT moment, BEFORE `bindOwnTools`, so no constant there can
   *    be honest).
   *  Supplying BOTH or NEITHER is a config defect refused at assembly — the law
   *  is the same family as the `realmId` requirement below. In the reader world
   *  the arm stores NO provider value: `providerId` and `resolveProviderId()`
   *  answer LIVE, and `undefined` (authority absent / unverified / not ACTIVE /
   *  non-string / a reader that throws) refuses every consumption with the
   *  arm's own code — never a fallback constant, never the row's value. */
  providerId?: string
  provider?: () => string | undefined
  realmId: string
  namespaceRoot: string
  readBounded: ImageReadBoundedPort
  attachments: ImageAttachmentAdapterHandle
  imageCapability: ImageCapabilityProbe
  observe?: (row: Record<string, unknown>) => void
}

export interface GovernedReadImageArmHandle {
  readonly familyId: string
  readonly adapterRevision: number
  readonly definitionIdentity: string
  /** LIVE answer of this arm's provider source AT THIS MOMENT: the constant in
   *  the constant world; in the reader world whatever the live binding
   *  authority answers NOW (`undefined` when it answers nothing). The reader
   *  world never exposes a construction-time value — the arm is built before
   *  the Guard binds. */
  readonly providerId: string | undefined
  /** The same answer as an explicit read, for the consumption points that want
   *  the read named (the plane's per-call callFacts assembly). */
  resolveProviderId: () => string | undefined
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
