/**
 * g1-query-assembly.d.mts — the tsc type surface of `g1-query-assembly.mjs`
 * (the same `.mjs` + adjacent `.d.mts` pattern as `g1-query-wiring` and
 * `plane-effect-backends`).
 *
 * SCOPE HONESTY: the MINIMAL surface the mount-arm block (lane 44ece) and
 * `test/a5m2-g1-query-assembly.test.ts` actually consume — the wiring face
 * stays the wiring module's own exported types (imported, never restated);
 * the plane seam faces are structural (their semantics are owned by the
 * plane and its spec). Never `any`.
 *
 * @module @dsh-agent-team/runtime/src/plugin/live/governed-families/g1-query-assembly (type surface)
 */
import type { G1QueryDefinition, G1QueryWiring } from './g1-query-wiring.d.mts'

export type { G1QueryDefinition }

/** One PA walk as the mount seam must answer it (the production shape the
 *  signed todo row carries into `paAdmit` — effects ALREADY parsed). */
export interface G1AssemblyPaWalk {
  readonly realmId: string
  readonly callId: string
  readonly parametersFingerprint: unknown
  readonly requestedEffects: unknown
  readonly toolName: string
  readonly family: {
    readonly familyId: string
    readonly adapterRevision: number
    readonly providerIdentity: string
    readonly targetManifest: Record<string, unknown>
  }
  readonly signal: AbortSignal | undefined
}

/** The live plane handle, read lazily (a5PlaneValue law). */
export interface G1AssemblyPlane {
  placementFeed(name: string): { definitionIdentity?: string; realmId?: string } | undefined
  paAdmit?: (walk: G1AssemblyPaWalk) => Promise<{ kind?: string; code?: string; detail?: string; cancelled?: boolean }>
}

/** The live host registry face the captures read and placement registers
 *  through (agentCtx.tools shape — the REAL registration entry). */
export interface G1AssemblyRegistry {
  get(name: string, agent?: unknown): unknown
  register?(definition: G1QueryDefinition): () => void
}

export interface G1QueryAssemblyMount {
  readonly providerId: string
  readonly registry: G1AssemblyRegistry
  readonly runtimeAgent?: unknown
  readonly plane: () => G1AssemblyPlane | null | undefined
  readonly trusted: Record<string, unknown> & { readonly realmId: string }
  readonly bindingFacts: () => Record<string, unknown>
  readonly topology?: { readonly current: () => unknown }
  readonly observe?: (row: unknown) => void
}

/** One capture-side identity record: the minted observation stamp (NEVER a
 *  family key) beside the subset facts it was minted from. */
export interface G1AssemblyCaptureEntry {
  readonly status: 'CAPTURED'
  readonly definitionIdentity: string
  readonly recordIndex: number
  readonly familyId: string
}

export interface G1AssemblyRegistration {
  readonly name: string
  readonly recordIndex: number
  readonly definitionIdentity: string
  readonly entry: {
    readonly familyId: string
    readonly adapterRevision: number
    readonly providerIdentity: string
  }
}

export interface G1QueryAssembly {
  readonly ok: true
  readonly revision: number
  readonly providerId: string
  readonly wiring: G1QueryWiring
  readonly definitions: readonly G1QueryDefinition[]
  readonly placementNames: readonly string[]
  readonly declared: readonly unknown[]
  readonly rowOf: G1QueryWiring['rowOf']
  readonly captures: Readonly<Record<string, G1AssemblyCaptureEntry>>
  readonly topologyMounted: boolean
  /** Place the emitted defs through the live registry.register face (the
   *  REAL minimum entry). Idempotent; returns the disposers. */
  place(): readonly (() => void)[]
  unplace(): void
  /** Post-publish production registration: feed-read keys, one fill point,
   *  the production registry's own law. Throws (never guesses) when the
   *  placement identity is absent or moved. Idempotent re-register per the
   *  registry's same-entry law. */
  registerAfterPublish(): readonly G1AssemblyRegistration[]
}

export type G1QueryAssemblyResult =
  | (G1QueryAssembly & { ok: true })
  | { ok: false; code: string; message: string }

export declare const A5_G1_QUERY_ASSEMBLY_REVISION: number
export declare const A5_G1_QUERY_ASSEMBLY_CODES: Readonly<{
  EVIDENCE_ABSENT: 'P_G1_ASM_EVIDENCE_ABSENT'
  CAPTURE_HALF_FACE: 'P_G1_ASM_CAPTURE_HALF_FACE'
  PLANE_ABSENT: 'P_G1_ASM_PLANE_ABSENT'
  PA_FUNNEL_ABSENT: 'P_G1_ASM_PA_FUNNEL_ABSENT'
  EFFECTS_UNPARSABLE: 'P_G1_ASM_EFFECTS_UNPARSABLE'
  CALL_FACTS_ABSENT: 'P_G1_ASM_CALL_FACTS_ABSENT'
}>

/** The mount-side assembly — semantics in the `.mjs`. */
export declare function createG1QueryAssembly(mount?: G1QueryAssemblyMount): G1QueryAssemblyResult
