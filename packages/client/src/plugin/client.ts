/**
 * Client half of the dsh-agent-team Cordis plugin — P1-T4 empty skeleton.
 *
 * Public shape (Cordis composition plugin): a plain module whose named
 * exports form the plugin object — a stable `name` plus an
 * `apply(ctx, config?)` entrypoint. Browser-safe by construction: no
 * Node.js builtins, no DOM assumptions, no DSH internal API (CORE PATCH
 * BUDGET = 0). The P9 UI work adds slot registrations on the public client
 * surface here.
 *
 * Verified by `test/plugin-client.test.ts` (source) and
 * `scripts/composition-smoke.mjs` (built output).
 * @module @dsh-agent-team/client/plugin/client
 */

/**
 * Minimal structural view of the Cordis client plugin context handed to
 * `apply`. Intentionally structural (not an import of any DSH context
 * type): the skeleton registers nothing, so it must not couple to the
 * host at type level before the P2 public-seam characterization.
 */
export interface TeamPluginClientContext {
  /** Optional service lookup by name; `undefined` when the service is absent. */
  get?: (serviceName: string) => unknown
  /** Subscribe to a client event; returns an unsubscribe function. */
  on?: (event: string, handler: (...args: unknown[]) => void) => () => void
  /** Track a disposer in the owning fiber so stop/update removes it. */
  effect?: (disposer: () => void) => void
}

/** Stable Cordis plugin name of the dsh-agent-team client half. */
export const name = 'dsh-agent-team-client'

/**
 * Plugin entrypoint (skeleton): no side effects — it registers no slots,
 * tools, listeners, or effects.
 * @param _ctx - Cordis client plugin context; unused while the skeleton is empty.
 */
export function apply(_ctx: TeamPluginClientContext): void {
  /* intentionally empty — see docs/plans/active (TaskDoc §11.2, P1-T4) */
}
