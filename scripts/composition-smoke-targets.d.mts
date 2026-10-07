/**
 * The type surface for `composition-smoke-targets.mjs` (A4-PR7 7.6, the
 * skip-fails round).
 *
 * The arm list is the thing the gate's own test must DERIVE from, so it is
 * typed rather than `any`: a test that reads the list as `any` cannot tell a
 * renamed label from a missing one, which is the difference between "the client
 * leg printed PASS by name" and "some line printed".
 */

export interface CompositionSmokeTarget {
  /** The name the step prints by, in every state. */
  readonly label: string
  /** Repository-relative path of the BUILT entry the gate imports. */
  readonly rel: string
  /** The plugin `name` export the entry must carry. */
  readonly expectedName: string
  /** How the entry fails loud on a degenerate context. */
  readonly contract: 'ready-rejection' | 'throw'
  /** For `ready-rejection`: the typed code `ready` must reject with. */
  readonly expectCode?: string
  /** Set only on the entry whose load is gated on the host module closure. */
  readonly closureGate?: boolean
}

export const PLUGIN_TARGETS: readonly CompositionSmokeTarget[]
