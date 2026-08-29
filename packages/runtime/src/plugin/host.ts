/**
 * Host half of the dsh-agent-team Cordis plugin — P1-T4 empty skeleton.
 *
 * Public shape (Cordis composition plugin): a plain module whose named
 * exports form the plugin object — a stable `name` plus an
 * `apply(ctx, config?)` entrypoint (later phases may add `inject` /
 * `Config` metadata). This is fresh code written against the public Cordis
 * plugin interface: it imports no DSH internal API and no upstream-private
 * symbol (CORE PATCH BUDGET = 0).
 *
 * Verified by `test/plugin-host.test.ts` (source) and
 * `scripts/composition-smoke.mjs` (built output — fixture basis for the
 * P1-T5 zero-core check).
 * @module @dsh-agent-team/runtime/plugin/host
 */

/**
 * Minimal structural view of the Cordis plugin context handed to `apply`.
 *
 * Intentionally structural (not an import of any DSH context type): the
 * skeleton registers nothing, so it must not couple to the host at type
 * level before the P2 public-seam characterization fixes the seam surface.
 */
export interface TeamPluginHostContext {
  /** Optional service lookup by name; `undefined` when the service is absent. */
  get?: (serviceName: string) => unknown
  /** Subscribe to an event; returns an unsubscribe function. */
  on?: (event: string, handler: (...args: unknown[]) => void) => () => void
  /** Track a disposer in the owning fiber so stop/update removes it. */
  effect?: (disposer: () => void) => void
}

/** Stable Cordis plugin name of the dsh-agent-team host half. */
export const name = 'dsh-agent-team'

/**
 * Plugin entrypoint (skeleton): no side effects — it registers no services,
 * tools, timers, listeners, or effects. The P5+ runtime work replaces this
 * no-op with public-seam bindings.
 * @param _ctx - Cordis plugin context; unused while the skeleton is empty.
 */
export function apply(_ctx: TeamPluginHostContext): void {
  /* intentionally empty — see docs/plans/active (TaskDoc §11.2, P1-T4) */
}
