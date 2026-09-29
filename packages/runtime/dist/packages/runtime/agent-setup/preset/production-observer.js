/**
 * pre-alpha3 PR-E / review fix F14 — the PRODUCTION persona-kind observer:
 * the real `observePersonaKind` port for the RuntimeSubstrateResolver
 * (plan §C.2/§C.3). It observes the preset's effective persona from the DSH
 * PUBLIC `agentPresets` seam — never a shipped-state guess (the historical
 * hardcoded `{ presetId: 'dsh-agent-team', personaKind: 'standard' }` is
 * closed by this observer).
 *
 * The two public seam reads (both are the registry's PUBLIC surface — no
 * upstream private/internal API, CORE PATCH BUDGET = 0):
 *
 * 1. `compositionInventory()` — the LIVE effective composition per preset:
 *    the persona row's PRESENCE + ENABLEMENT (a literal boolean on a mounted
 *    preset's rows — the Loader already evaluated any `!!js` disable — or
 *    `'conditional'` when a `!!js` disable could not be evaluated outside a
 *    mount). This answers: is there a persona at all, and is it enabled?
 * 2. `readDocument(presetId)` — the EFFECTIVE DECLARED COMPOSITION YAML
 *    (the same declaration the mounted generation composes from): the
 *    persona row's `config.complete` flag — the standard/complete DISTINCTION
 *    that the inventory rows do not carry.
 *
 * The derivation (the `./persona-composition.js` parser) is fail-closed:
 * ANY failure — the service absent/rejecting, an unknown or broken preset,
 * a conditional disable, a malformed/inconsistent document — resolves to a
 * TYPED `unresolved` (plan §C.3: "若 public seam 不足: unresolved → fail
 * closed. 不能继续 shipped-state guess."). The observer NEVER throws and
 * NEVER invents a kind.
 *
 * Source provenance (the closed `PERSONA_OBSERVATION_SOURCES` vocabulary):
 * - `effective-composition` — the live inventory row answered (absent via
 *   missing/disabled row; unresolved via a conditional disable);
 * - `composition-text` — the declared composition document answered the
 *   kind (standard/complete) or failed to answer it (parse/mismatch);
 * - `none` — no source could be asked (service failure) or it answered "no
 *   such preset / broken preset".
 *
 * Pure module: the seam is an injected port (a narrow structural mirror of
 * the public service surface — the production host binds it to
 * `ctx.get('agentPresets')` lazily, the sessionPersistence wrapper pattern).
 * @module @dsh-agent-team/runtime/agent-setup/preset/production-observer
 */
import { deepFreeze } from '../../../contracts/src/index.js';
import { PERSONA_PLUGIN_MODULE_NAME, parsePersonaKindFromCompositionDocument, } from './persona-composition.js';
import { PERSONA_OBSERVATION_SOURCES, } from './substrate-resolver.js';
/** Build one typed observation (the frozen, lossless-JSON form). */
function observation(kind, source, reason) {
    return deepFreeze({
        kind,
        source,
        ...(reason !== undefined ? { reason } : {}),
    });
}
function firstLine(text) {
    return text.split('\n')[0] ?? text;
}
/**
 * Create the production persona-kind observer over one public seam
 * (the review fix F14 — the real effective-composition observation).
 *
 * @param seam - the DSH `agentPresets` public seam (inventory + document).
 * @returns the observer (the resolver's `observePersonaKind` port).
 */
export function createProductionPersonaObserver(seam) {
    return {
        async observe(presetId) {
            // 1. the live effective composition (presence + enablement).
            let inventory;
            try {
                inventory = await seam.compositionInventory();
            }
            catch (error) {
                return observation('unresolved', PERSONA_OBSERVATION_SOURCES.none, `host preset service failure: compositionInventory rejected (${firstLine(String(error.message ?? error))})`);
            }
            const preset = inventory.find((entry) => entry.id === presetId);
            if (preset === undefined) {
                return observation('unresolved', PERSONA_OBSERVATION_SOURCES.none, `unknown preset '${presetId}' (not in the live inventory)`);
            }
            if (preset.broken !== undefined) {
                return observation('unresolved', PERSONA_OBSERVATION_SOURCES.none, `preset '${presetId}' is broken: ${preset.broken}`);
            }
            const row = preset.rows.find((entry) => entry.moduleName === PERSONA_PLUGIN_MODULE_NAME);
            if (row === undefined) {
                // No persona row: the preset has no effective persona (the bind-time
                // persona adapter treats `absent` as "nothing to compose").
                return observation('absent', PERSONA_OBSERVATION_SOURCES.effectiveComposition);
            }
            if (row.enabled === false) {
                return observation('absent', PERSONA_OBSERVATION_SOURCES.effectiveComposition, 'the persona row is disabled in the effective composition');
            }
            if (row.enabled === 'conditional') {
                return observation('unresolved', PERSONA_OBSERVATION_SOURCES.effectiveComposition, `the persona row carries a !!js conditional disable${row.condition !== undefined ? ` ('${row.condition}')` : ''} — not evaluatable outside a mount`);
            }
            // 2. the declared composition document (the standard/complete flag).
            let document;
            try {
                document = await seam.readDocument(presetId);
            }
            catch (error) {
                return observation('unresolved', PERSONA_OBSERVATION_SOURCES.none, `host preset service failure: readDocument('${presetId}') rejected (${firstLine(String(error.message ?? error))})`);
            }
            const derivation = parsePersonaKindFromCompositionDocument(document);
            if (derivation.kind === 'unresolved') {
                return observation('unresolved', PERSONA_OBSERVATION_SOURCES.compositionText, derivation.reason);
            }
            if (derivation.kind === 'absent') {
                // Inconsistent host state: the live row is enabled but the declared
                // composition has no (enabled) persona row. Fail closed.
                return observation('unresolved', PERSONA_OBSERVATION_SOURCES.compositionText, `inconsistent composition for '${presetId}': the live inventory reports the persona row enabled but the declared composition derives absent`);
            }
            return observation(derivation.kind, PERSONA_OBSERVATION_SOURCES.compositionText);
        },
    };
}
//# sourceMappingURL=production-observer.js.map