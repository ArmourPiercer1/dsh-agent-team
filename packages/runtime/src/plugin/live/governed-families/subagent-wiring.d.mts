/**
 * Types for governed-families/subagent-wiring.mjs — the REAL PA wiring of
 * the B-SUBAGENT control trio (root 20:02). The adapter types are REUSED
 * verbatim from './subagent-adapters.d.mts'; NOTHING here redefines a row,
 * plan or definition shape.
 *
 * @module runtime/plugin/live/governed-families/subagent-wiring
 */
import type {
  BSubagentAssembly,
  BSubagentAssemblyInput,
  BSubagentDefinition,
  BSubagentFamilyRegistration,
} from './subagent-adapters.d.mts'

/** The ONE production PA funnel's answer (plane paAdmit :1214/:1449/:1660):
 *  kind 'allow' carries the one-shot `consumedProof` witness ONLY on the
 *  consume-ok branch; a deny carries the funnel's OWN code+detail; a
 *  cancellation says `cancelled: true` and is NOT permission. */
export type BSubagentPaAnswer = {
  readonly kind?: string
  readonly cancelled?: boolean
  readonly code?: string
  readonly detail?: string
  readonly consumedProof?: unknown
}

/** The frozen walk input (plane write-row shape :2365-2378): realmId + live
 *  callId + the FROZEN PLAN's parametersFingerprint (the same value the row
 *  re-checks at delegate — one value across open→edge) + the PARSED
 *  canonical `RequestedEffectSet` (`parseRequestedEffectSet().value`, the
 *  plane's own requestedEffects shape — { effects, fingerprint }) + the
 *  family block. The signal rides BY REFERENCE and is NEVER frozen. */
export interface BSubagentPaWalk {
  readonly realmId: string
  readonly callId: string
  readonly parametersFingerprint: string
  /** parseRequestedEffectSet's canonical value (domain effects.ts
   *  RequestedEffectSet): the plane reads `requestedEffects.effects`. */
  readonly requestedEffects: {
    readonly effects: readonly { readonly kind: string; readonly toolName?: string; readonly resource: unknown }[]
    readonly fingerprint: string
  }
  readonly toolName: string
  readonly family: {
    readonly familyId: string
    readonly adapterRevision: number
    readonly providerIdentity: string
    /** UNION ENCODING (root 21:20 joint card, control-mint side): the ONE
     *  operation-discriminated entry's control shape — common required
     *  strings (operation/contract/action/revision/effect/depth/
     *  argsCanonical/namedGapsCanonical) + control additions
     *  (caller/addressRelation/addressAdjudication/budget/effectDelta
     *  strings, addressClaim NULLABLE, recordIndex nonNegativeInt).
     *  argsCanonical/namedGapsCanonical are FULL canonical JSON (never
     *  digests); the complete plan.target is losslessly reconstructible
     *  from the leaves. `effect` and `effectDelta` carry the SAME single
     *  census fact (disclosed — the seam holds one effect truth per record). */
    readonly targetManifest: {
      readonly operation: string
      readonly contract: string
      readonly action: string
      readonly revision: string
      readonly effect: string
      readonly depth: string
      readonly argsCanonical: string
      readonly namedGapsCanonical: string
      readonly caller: string
      readonly addressRelation: string
      readonly addressAdjudication: string
      readonly addressClaim: string | null
      readonly budget: string
      readonly effectDelta: string
      readonly recordIndex: number
    }
  }
  readonly signal?: AbortSignal
}

/** The injected real PA face: ONE call per invocation runs Part A + the
 *  consumeForExecution edge; `closePlan` ends a never-completed leg's plan
 *  fact (plane :1713). This wiring calls it exactly once per call. */
export type BSubagentPaFunnel = ((walk: BSubagentPaWalk) => Promise<BSubagentPaAnswer>) & {
  closePlan?: (callId: string) => void
}

/** Factory inputs: the adapter inputs MINUS `admit` (the seat is owned by
 *  the wiring's real walk — presenting one is P_B_SUBAGENT_WIRE_ADMISSION_
 *  SEAT_OWNED, the fabricated admit-ok this card forbids) PLUS `pa`. */
export type BSubagentWiringInput =
  Omit<BSubagentAssemblyInput, 'admit' | 'observe'> & {
    readonly pa: BSubagentPaFunnel
    readonly observe?: (row: Record<string, unknown>) => void
  }

export type BSubagentWiringAssembly = Pick<
  BSubagentAssembly,
  'familyId' | 'providerId' | 'subset' | 'definitions' | 'placementNames' | 'rows' | 'declared' | 'rowOf' | 'familyRegistrations' | 'inFlight'
>

/** Mount result (jobs-row law): success carries the shared dispose; a
 *  register failure already rolled back reversed+best-effort and names the
 *  refused tool; a SECOND mount is refused outright (the first mount's
 *  disposers are the only ones dispose() runs — no re-registration leak). */
export type BSubagentWiringMount =
  | { readonly ok: true; readonly dispose: () => { readonly event: string } }
  | { readonly ok: false; readonly code: string; readonly name?: string; readonly message: string }

export interface BSubagentWiringValue extends BSubagentWiringAssembly {
  readonly ok: true
  readonly wiringRevision: number
  readonly adapterRevision: number
  readonly definitions: readonly BSubagentDefinition[]
  readonly familyRegistrations: () => readonly BSubagentFamilyRegistration[]
  readonly mount: (agentCtx: { tools: { register: (definition: BSubagentDefinition) => unknown } }) => BSubagentWiringMount
  readonly dispose: () => { readonly event: string; readonly disposers?: number; readonly semantics?: string }
}

export type BSubagentWiringResult =
  | BSubagentWiringValue
  | { readonly ok: false; readonly code: string; readonly message: string; readonly name?: string }

export declare const A5_B_SUBAGENT_WIRING_REVISION: number
export declare const A5_B_SUBAGENT_WIRING_CODES: Readonly<Record<string, string>>
export declare function createBSubagentControlWiring(input?: BSubagentWiringInput): BSubagentWiringResult
