/**
 * pre-alpha3 PR-E (plan §E.3) — the persona requirement vocabulary for the
 * cutover: the `RequiredPersonaKind` CLOSED set (what a Team MAY REQUIRE of
 * its runtime substrate's persona) and the shipped-state observation
 * adapter that stands in for the LIVE production probe.
 *
 * Ruling (parent, session-d7d89f77, this increment): the live
 * `observePersonaKind` production probe — reading the LIVE DSH composition
 * of the actually-mounted preset — is a FOLLOW-UP, not part of this PR
 * (it is a potential CORE_SEAM_BLOCKER and the same item as graph.yaml
 * `pr_c` known_debt "live persona probe"). For THIS increment the
 * observation is the SHIPPED-STATE kind: the deployment default preset is
 * `standard` (the web bundle's default preset carries a composable persona
 * row), and the shipped row deploys with that default. The adapter below is
 * therefore a TYPED, NAMED value — never a silent inline hardcode — and
 * carries the known_debt marker documenting the follow-up seam.
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
import { isRequiredPersonaKind, REQUIRED_PERSONA_KINDS, REQUIRED_PERSONA_KIND_VALUES, } from '../../domain/compatibility/src/requirement.js';
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
export { isRequiredPersonaKind, REQUIRED_PERSONA_KINDS, REQUIRED_PERSONA_KIND_VALUES };
/**
 * The deployment default preset id of the SHIPPED state (the web bundle's
 * default preset — the deployment default the shipped row mounts when no
 * explicit preset id is configured).
 *
 * @known_debt The LIVE production persona probe (observing the
 * actually-mounted preset's effective persona composition through the DSH
 * public seam) is a documented FOLLOW-UP seam (parent ruling,
 * session-d7d89f77; same item as graph.yaml `pr_c` known_debt "live
 * persona probe" / a potential CORE_SEAM_BLOCKER). Until it lands, the
 * observation of the shipped state is the deployment default kind below —
 * expressed through the TYPED, NAMED {@link shippedStatePersonaObserver}
 * (never a silent inline hardcode), and the resolver's
 * `personaObservation.source` reports `none` (no composition read was
 * performed) with this reason.
 */
export const SHIPPED_STATE_DEPLOYMENT_DEFAULT_PRESET_ID = 'standard';
/**
 * The SHIPPED-STATE persona observation adapter: the TYPED, NAMED value
 * wired to the `RuntimeSubstrateResolver`'s `observePersonaKind` port for
 * this increment (plan §E.3, parent ruling).
 *
 * It returns the observed kind of the SHIPPED state for ANY preset id:
 * `standard` (the deployment default's composable persona) with provenance
 * `source: 'none'` (no live composition read was performed — the provenance
 * vocabulary is closed and `none` is the honest value for an observation
 * taken from deployment knowledge rather than a composition source) and a
 * deterministic reason string carrying the known_debt marker.
 *
 * @param presetId - the preset id being observed (echoed into the reason
 *   string for deterministic diagnostics; the shipped state observes
 *   `standard` for every id — see {@link SHIPPED_STATE_DEPLOYMENT_DEFAULT_PRESET_ID}).
 * @returns the frozen observation.
 *
 * @known_debt FOLLOW-UP (not this PR): the live production probe replacing
 * this shipped-state observation (observing the actually-mounted preset's
 * effective persona through the DSH public seam). The resolver plan's
 * `personaObservation` carries this reason verbatim for diagnostics.
 */
export function shippedStatePersonaObserver(presetId) {
    if (presetId === null || presetId === undefined || typeof presetId !== 'string' || presetId === '') {
        throw new TypeError('shippedStatePersonaObserver: presetId must be a non-empty string');
    }
    const kind = REQUIRED_PERSONA_KINDS.standard;
    return Object.freeze({
        kind,
        source: 'none',
        reason: `shipped-state observation for preset '${presetId}': the deployment default ` +
            `(${SHIPPED_STATE_DEPLOYMENT_DEFAULT_PRESET_ID}) carries a composable (standard) persona; ` +
            `the live production persona probe (observing the actually-mounted preset composition) ` +
            `is a documented follow-up seam (known_debt: live persona probe)`,
    });
}
//# sourceMappingURL=observed-persona.js.map