/**
 * pre-alpha3 PR-E (plan §E.3) — the persona requirement vocabulary for the
 * cutover: the `RequiredPersonaKind` CLOSED set (what a Team MAY REQUIRE of
 * its runtime substrate's persona) and the shipped-state observation
 * adapter (the FACTORY-WORLD persona observation).
 *
 * pre-alpha3 W3-A (review fix F1, guide §2.3) — the production cutover:
 * the LIVE `observePersonaKind` production probe is NOW IN TREE (pre-alpha3
 * W2-A, review fix F14 — the production host's persona observer reads the
 * actually-mounted preset's effective composition through the DSH public
 * `agentPresets` seam, fail-closed typed `unresolved`, never a kind
 * guess). The PRODUCTION persona path is that live observer (the host's
 * `resolveSubstratePlan` + `observePersonaKind` — see the
 * `RequirementFactsAuthority` surface in `src/plugin/types.ts`); the
 * shipped-state adapter below is NO LONGER the production path. It remains
 * the TYPED, NAMED observation of FACTORY worlds (no host entry, no live
 * seam): the deployment default preset is `standard` (the web bundle's
 * default preset carries a composable persona row), and the factory row
 * deploys with that default — expressed through the adapter, never a
 * silent inline hardcode.
 *
 * `RequiredPersonaKind` is a NEW closed set, SEPARATE from PR-C's
 * `ObservedPersonaKind` (absent | standard | complete | unresolved):
 *
 * - `ObservedPersonaKind` — what the world REPORTS (a four-state
 *   observation, including `unresolved` when no source is available);
 * - `RequiredPersonaKind` — what a blueprint REQUIREMENT may demand. This
 *   increment allows exactly `standard` (a composable persona): a Team
 *   needs a composable persona section to install its scoped identity
 *   (Architecture §13.5). Requiring `absent` / `complete` as the REQUIRED
 *   kind has no product semantics yet and needs an ADR before it enters
 *   the closed set (plan §E.3).
 *
 * The SUBJECT convention for persona requirements and persona environment
 * facts is the persona KIND (not the preset id — the PR #22 donor's
 * correct intent, absorbed here): the requirement's subjects name the
 * required kind(s); the world facts report the observed kind. A preset
 * whose persona is composable (the bundled `standard` / `ptc` / `cordis`
 * presets) OBSERVES as `standard`; a preset with a `complete:true` persona
 * section observes as `complete` and can therefore never satisfy a
 * required `standard` (the frozen structural FATAL, no downgrade).
 *
 * Pure module: no I/O, no `node:` builtins.
 * @module @dsh-agent-team/runtime/requirements/observed-persona
 */

import type { ObservedPersonaKind } from '../agent-setup/preset/types.js'
import type { PersonaKindObservation } from '../agent-setup/preset/substrate-resolver.js'
import {
  isRequiredPersonaKind,
  REQUIRED_PERSONA_KINDS,
  REQUIRED_PERSONA_KIND_VALUES,
} from '../../domain/compatibility/src/requirement.js'
import type { RequiredPersonaKind } from '../../domain/compatibility/src/requirement.js'

/**
 * The closed set of persona kinds a Team requirement may REQUIRE (plan
 * §E.3). This increment: exactly `standard` (a composable persona).
 * `absent` / `complete` as REQUIRED kinds are outside the closed set until
 * an ADR gives them product semantics (they remain valid OBSERVED kinds —
 * see `ObservedPersonaKind`).
 *
 * The SINGLE source of truth for this vocabulary lives in the domain
 * compatibility layer (`@dsh-agent-team/domain/compatibility` →
 * `requirement.ts`), so the blueprint v2 validator (which restricts
 * persona-type requirement subjects to this set) and this runtime module
 * (which names the required kind as the persona requirement's subject)
 * consume the same frozen set. Re-exported here to keep the runtime API
 * surface stable.
 */
export { isRequiredPersonaKind, REQUIRED_PERSONA_KINDS, REQUIRED_PERSONA_KIND_VALUES }
export type { RequiredPersonaKind }

/**
 * The deployment default preset id of the SHIPPED state (the web bundle's
 * default preset — the deployment default the factory row mounts when no
 * explicit preset id is configured).
 *
 * pre-alpha3 W3-A (review fix F1, guide §2.3): the live production persona
 * probe is in tree (pre-alpha3 W2-A — the production host's observer over
 * the DSH public `agentPresets` seam); this constant + the
 * {@link shippedStatePersonaObserver} adapter below serve the FACTORY
 * world's shipped-state observation only (never the production path).
 */
export const SHIPPED_STATE_DEPLOYMENT_DEFAULT_PRESET_ID = 'standard'

/**
 * The SHIPPED-STATE persona observation adapter: the TYPED, NAMED
 * deployment-knowledge observation of FACTORY worlds (no host entry, no
 * live seam — plan §E.3). NOT the production path: the production host
 * observes the actually-mounted preset through the DSH public
 * `agentPresets` seam (pre-alpha3 W2-A, review fix F14 — the
 * `RequirementFactsAuthority`'s `observePersonaKind` /
 * `resolveSubstratePlan`), never through this adapter.
 *
 * It returns the observed kind of the SHIPPED state for ANY preset id:
 * `standard` (the deployment default's composable persona) with provenance
 * `source: 'none'` (no live composition read was performed — the provenance
 * vocabulary is closed and `none` is the honest value for an observation
 * taken from deployment knowledge rather than a composition source) and a
 * deterministic reason string.
 *
 * @param presetId - the preset id being observed (echoed into the reason
 *   string for deterministic diagnostics; the shipped state observes
 *   `standard` for every id — see {@link SHIPPED_STATE_DEPLOYMENT_DEFAULT_PRESET_ID}).
 * @returns the frozen observation.
 */
export function shippedStatePersonaObserver(presetId: string): PersonaKindObservation {
  if (presetId === null || presetId === undefined || typeof presetId !== 'string' || presetId === '') {
    throw new TypeError('shippedStatePersonaObserver: presetId must be a non-empty string')
  }
  const kind: ObservedPersonaKind = REQUIRED_PERSONA_KINDS.standard
  return Object.freeze({
    kind,
    source: 'none',
    reason:
      `shipped-state observation for preset '${presetId}': the deployment default ` +
      `(${SHIPPED_STATE_DEPLOYMENT_DEFAULT_PRESET_ID}) carries a composable (standard) persona; ` +
      `the live production persona probe (observing the actually-mounted preset composition) ` +
      `is a documented follow-up seam (known_debt: live persona probe)`,
  })
}
