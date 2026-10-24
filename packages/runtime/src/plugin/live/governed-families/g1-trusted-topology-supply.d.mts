/**
 * g1-trusted-topology-supply.d.mts — the tsc type surface of
 * `g1-trusted-topology-supply.mjs` (same pattern as the wiring/assembly
 * `.d.mts` siblings). MINIMAL consumed surface: the two mount faces, the
 * supply, and the answered face shape. Never `any`.
 *
 * @module @dsh-agent-team/runtime/src/plugin/live/governed-families/g1-trusted-topology-supply (type surface)
 */

/** One authorized inspect triple: FULL VALUES from the same-read intersection
 *  of the live directory and the mount's authorized scope. */
export interface G1TopologyTriple {
  readonly platform: string
  readonly provider: string
  readonly method: string
}

/** The answered face — exactly what the adapter's signed consumption law
 *  reads (classify :621-643 synchronous; edge :824-838 equality on the
 *  revision+digest PAIR). `topologyRevision` is the deterministic
 *  content-version companion (non-negative safe int) of the canonical
 *  content the digest summarizes in full; equality of the PAIR means
 *  "same normalized content" and nothing more (no monotonic/ABA claim). */
export interface G1TrustedTopologyFace {
  readonly topologyRevision: number
  readonly topologyDigest: string
  readonly allowed: readonly G1TopologyTriple[]
}

export interface G1TrustedTopologySupply {
  readonly revision: number
  /** Fresh same-read answer per call. `undefined` = a source is absent or
   *  ill-shaped (the adapter's own fail-closed P_G1_TRUSTED_TOPOLOGY_ABSENT
   *  path); the face = complete, well-shaped CURRENT facts. */
  current(): G1TrustedTopologyFace | undefined
}

export interface G1TrustedTopologySupplyInput {
  /** The PUBLIC cordisInspect face (ctx.cordisInspect at the mount). */
  readonly inspect: { list(): unknown }
  /** LIVE reader of the mount's authorized scope (exact triples). */
  readonly authorized: () => unknown
  readonly observe?: (row: unknown) => void
}

export type G1TrustedTopologySupplyResult =
  | { readonly ok: true; readonly supply: G1TrustedTopologySupply }
  | { readonly ok: false; readonly code: string; readonly message: string }

export declare const A5_G1_TRUSTED_TOPOLOGY_SUPPLY_REVISION: number
export declare const A5_G1_TRUSTED_TOPOLOGY_SUPPLY_CODES: Readonly<{
  INSPECT_ABSENT: 'P_G1_TOPO_INSPECT_ABSENT'
  AUTHORIZED_ABSENT: 'P_G1_TOPO_AUTHORIZED_ABSENT'
}>

/** The supply factory — semantics in the `.mjs`. */
export declare function createG1TrustedTopologySupply(
  input?: { inspect?: unknown; authorized?: unknown; observe?: (row: unknown) => void },
): G1TrustedTopologySupplyResult
