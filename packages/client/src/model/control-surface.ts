/**
 * F9U (F3/F11/F9/T1.4 repair round r1, gate-review supplements) — the
 * client-local model of the human control-resolution SURFACE: the closed
 * resolver-role map (who may resolve a request kind — the kind-aware
 * human-affordance rule, UI §26.2 "requested authority") and the
 * served-version probe interpretation (a pre-v4 served host → the §26
 * pending state renders READ-ONLY; a v4 served host → the command
 * surface is enabled).
 *
 * Two client-local mirrors ride here, both by the established discipline
 * (the `FACT_TYPE_CATEGORY` mirror precedent in `ledger-adapter`): the
 * client may not value-import the host package (`packages/runtime` is
 * host-side authority), so the FROZEN closed sets are mirrored here with
 * their provenance, and every read is fail-safe — a kind absent from the
 * mirror has NO human resolver role and NO displayed authority (the
 * panel shows, the command does not; never a guessed value).
 *
 * Pure module: no React, no node: builtins, no I/O. Erasable TS only.
 * @module @dsh-agent-team/client/model/control-surface
 */

import {
  REMOTE_CONTRACT_ERROR_CODES,
  type RemoteResponse,
} from '../../../remote/src/index.js'

/**
 * CLIENT-LOCAL frozen mirror of the host's `CONTROL_RESOLVER_ROLES`.
 * PROVENANCE: `packages/runtime/control/types.ts` (the closed resolver
 * ROLE SET per request kind — Architecture 25 / DevPlan 19.4:
 * `leader-approval` → { leader, human }; `user-approval` → { human };
 * `envelope-mutation` → { leader, human }; the human may always stand in
 * for a closed kind — invariant 34). A kind ABSENT from this map (an
 * unknown / future wire value, or an absent leaf) carries NO closed
 * resolver roles: the affordance and the displayed authority both fail
 * closed.
 */
export const CONTROL_RESOLVER_ROLES: Readonly<Record<string, readonly string[]>> = {
  'leader-approval': ['leader', 'human'],
  'user-approval': ['human'],
  'envelope-mutation': ['leader', 'human'],
}

/** The closed resolver role the human UI speaks (the human principal). */
export const HUMAN_RESOLVER_ROLE = 'human' as const

/**
 * The kind-aware affordance rule: the human may resolve the request kind
 * ONLY when the closed mirror names the kind AND its role set includes
 * 'human'. Unknown / absent kinds → false (fail-closed: the detail
 * panel shows, the Allow/Deny command does not).
 * @param kind - the request kind leaf (the closed wire value; absent when
 *   the fact names none).
 * @returns true when the closed role set grants the human.
 */
export function humanMayResolveControlKind(kind: string | undefined): boolean {
  if (kind === undefined) return false
  const roles = CONTROL_RESOLVER_ROLES[kind]
  if (roles === undefined) return false
  return roles.includes(HUMAN_RESOLVER_ROLE)
}

/**
 * The requested authority of one request kind (UI §26.2 "requested
 * authority"): the closed resolver role set for a closed kind; undefined
 * for an unknown / absent kind (nothing displayed — never invented).
 * @param kind - the request kind leaf.
 * @returns the closed role set, or undefined when the kind is not closed.
 */
export function requestedAuthorityForKind(kind: string | undefined): readonly string[] | undefined {
  if (kind === undefined) return undefined
  return CONTROL_RESOLVER_ROLES[kind]
}

/**
 * The served-version-gated command surface mode:
 *
 * - `'read-only'` — the served host does not serve the v4-only
 *   `team.resolveControl` (a pre-v4 build): the UI §26.2 detail panel
 *   stays visible for the pending state, the Allow/Deny commands do not;
 * - `'enabled'` — the served host serves the v4 method (the command
 *   surface is live).
 */
export type ControlSurfaceMode = 'read-only' | 'enabled'

/**
 * The side-effect-free served-version probe's closed `requestId`: an
 * empty string — the FIRST value that fails the closed 1..255 opaque-
 * token rule. A v4 host answers the probe with a TYPED `malformed-params`
 * BEFORE any port work (the dispatcher validates the closed params before
 * the handler runs — the probe never reaches the control service, never
 * resolves a request, and never writes anything). A pre-v4 host never
 * parses the method at all (its closed catalog lacks the v4-only
 * `team.resolveControl` — the probe answers `unknown-method` before the
 * envelope is read).
 */
export const RESOLVE_CONTROL_PROBE_REQUEST_ID = '' as const

/**
 * Interpret ONE side-effect-free probe response into the surface mode
 * (the closed classification over the frozen Remote boundary codes):
 *
 * - a success, or any typed error that REACHED the v4 method (the
 *   `malformed-params` on the probe's empty `requestId`, a control-
 *   vocabulary error, …) → the host serves v4 → `'enabled'`;
 * - `unknown-method` (a pre-v4 build's catalog has no v4-only method),
 *   `contract-version-unsupported` (the v4 envelope version is outside
 *   the build's supported set) or `method-version-unsupported` (the
 *   method is unavailable at the request's version) → the host is
 *   pre-v4 → `'read-only'`.
 *
 * A transport-level channel loss is NOT a response (the promise
 * rejects); the caller keeps the mode unresolved (fail-closed) and may
 * re-probe on the next ledger publish.
 * @param response - the typed probe response.
 * @returns the surface mode.
 */
export function interpretResolveControlProbe(response: RemoteResponse): ControlSurfaceMode {
  if (response.ok) return 'enabled'
  const code = response.error.code
  if (
    code === REMOTE_CONTRACT_ERROR_CODES.UNKNOWN_METHOD
    || code === REMOTE_CONTRACT_ERROR_CODES.CONTRACT_VERSION_UNSUPPORTED
    || code === REMOTE_CONTRACT_ERROR_CODES.METHOD_VERSION_UNSUPPORTED
  ) {
    return 'read-only'
  }
  return 'enabled'
}
