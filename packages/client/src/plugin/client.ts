/**
 * Client half of the dsh-agent-team Cordis plugin — the P9-S6 unique
 * client mount (P9-T9; plan §P9-S6, the L1568–1604 block of
 * docs/plans/active/DSH_Agent_Team_vNext_P9_UI_T12_T24_Legacy_Reuse_
 * Implementation_Test_Plan.md).
 *
 * Public shape (Cordis composition plugin): a plain module whose named
 * exports form the plugin object — a stable `name`, the `inject` service
 * list, a `Config` type, and the `apply(ctx, config?)` entrypoint.
 * Browser-safe by construction: no Node.js builtins, no DOM assumptions,
 * no DSH internal API (CORE PATCH BUDGET = 0).
 *
 * This module is the thin glue of the D-T9-13 core/glue split: it is the
 * ONLY module in the package that value-imports a `.tsx` component. The
 * whole mount (seam bindings, store wiring, slot registrations) lives in
 * `./team-mount-core.js` (pure `.ts`), so the package's executed tests
 * (plain-node runner: `.test.ts` only, no `.tsx`/`.css` resolution) can
 * load and drive the mount through the core without the component value
 * imports.
 *
 * Registrations (expected by P9-S6):
 *   - `conversation.view`       -> the TeamView "团队" tab (id `team`, order 20);
 *   - `conversation.input.dock` -> the TeamDock (id `team`, order 15);
 *   - `settings.section`        -> the minimal Team settings/help page
 *     (id `team`, order 50);
 *   - `sidebar.footer.action`   -> the global New Team entry (id `team-new`,
 *     order 10; the session-independent creation entry — R118 / frozen UI
 *     design §3.1 MUST).
 * Explicit non-registrations (P9-S6): NO `conversation.chat.node` team
 * marker and NO synthetic trajectory — a native Chat/Trajectory/fork stays
 * exactly what native DSH renders. New Team enters through the actual
 * public surface (the S0 seam map: `ctx.sessions.create` for the native
 * root, `ctx.remote.agentPresets.list` for the runtime presets, the
 * workspace bound through the plugin row config); Seam 4 (cross-entry view
 * activation) is ABSENT, so the dock's jump degrades to a CLIENT_LOCAL
 * no-op (D-T9-4 — no DOM hack, no private store reach).
 *
 * D-T9-1: `dshHome` arrives through the plugin row config
 * (`apply(ctx, config?)`); absent or blank after trim -> the parameterless
 * `legacyInspect` face is omitted (the T8 degraded zero-state path).
 * D-T9-11: the package.json carries no `./client` export subpath — the
 * composition wiring is S8/main-agent territory, not widened in T9.
 *
 * Verified by `test/client.test.ts` (identity/shape),
 * `test/client-plugin-mount.test.ts` (behavior, through the core), and
 * `scripts/composition-smoke.mjs` (built output).
 * @module @dsh-agent-team/client/plugin/client
 */
import { NewTeamEntry } from '../ui/NewTeamEntry.js'
import { TeamDock } from '../ui/TeamDock.js'
import { TeamSettingsSection } from '../ui/TeamSettingsSection.js'
import { TeamView } from '../ui/TeamView.js'
import {
  applyTeamMount,
  type Config,
  type TeamPluginClientContext,
} from './team-mount-core.js'

export { inject, name } from './team-mount-core.js'
export type { Config, TeamPluginClientContext } from './team-mount-core.js'

/**
 * Plugin entrypoint (the P9-S6 unique client mount): registers the team
 * locale dictionaries and the four slot entries on the public seams,
 * wires the per-team projection/ledger stores to the frozen Remote
 * channel, and returns nothing — every side effect is fiber-tracked and
 * removed on stop/update.
 * @param ctx - the Cordis client plugin context (the five public seams +
 *   the fiber `effect`).
 * @param config - the plugin row config (the `dshHome` bind; D-T9-1).
 */
export function apply(ctx: TeamPluginClientContext, config?: Config): void {
  applyTeamMount(ctx, {
    config,
    components: {
      view: TeamView,
      dock: TeamDock,
      settings: TeamSettingsSection,
      newTeamEntry: NewTeamEntry,
    },
  })
}
