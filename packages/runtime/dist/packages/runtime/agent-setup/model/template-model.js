/**
 * The bound Blueprint template's INITIAL STATIC model grant — the SINGLE
 * derivation shared by every consumer of the template model layer (the
 * live request-boundary consumption, the activation step-8 frozen policy,
 * the read-side `readTemplatePolicy`, and the projection/modelState views
 * that assemble through it; the model-preference routing fix):
 *
 * - the template's `modelPreference` is a TEMPLATE-STATIC policy value,
 *   not a deployment default and not a durable override: it sits at the
 *   resolver's `template` value layer (provenance template/static, no
 *   record id) — above the PolicyState, below the record-backed
 *   templateOverlay / instanceOverlay / humanOverride layers and the
 *   external hard facts;
 * - a QUALIFIED route (`provider/model`) produces an allow grant with the
 *   route UNCHANGED (the template's explicit provider is never replaced
 *   by the deployment default's);
 * - a MODEL-ONLY shorthand produces an allow grant whose provider is the
 *   deployment default's (`baseline.provider`) — the documented Blueprint
 *   semantics: a bare model inherits the staticModel's provider;
 * - an ABSENT `modelPreference` contributes NOTHING (the model cell stays
 *   `unspecified` -> the `baseline` applies at the consumer, the
 *   deployment fallback);
 * - a MALFORMED token (only possible via a template that bypassed the
 *   Blueprint strong validation) contributes NOTHING — fail closed, never
 *   a guessed provider/model, never a silent staticModel fallback.
 *
 * NO synthetic durable record is ever created: the bound Blueprint
 * snapshot itself is the durable, immutable source of the grant (it
 * survives a host restart by re-derivation from the same snapshot).
 *
 * Pure module: no I/O, no live Agent, no ambient state.
 * @module @dsh-agent-team/runtime/agent-setup/model/template-model
 */
import { parseModelPreferenceToken } from './route.js';
/**
 * Derive the bound template's initial static `model` PolicyEntry for the
 * policy resolver's `template` value layer.
 *
 * @param template - the bound Blueprint template (leader or member — the
 *   two shapes are isomorphic on `modelPreference`).
 * @param baseline - the deployment default (the `staticModel`): its
 *   provider fills the MODEL-ONLY shorthand; it is NEVER substituted for
 *   a qualified route and never emitted when no preference is declared.
 * @returns the `model` PolicyEntry to feed `templateValues.model`, or
 *   `undefined` when the template declares no usable initial model grant.
 */
export function initialTemplateModelGrantOf(template, baseline) {
    const token = template.modelPreference;
    if (token === undefined)
        return undefined;
    const parsed = parseModelPreferenceToken(token);
    if (parsed === undefined)
        return undefined;
    const item = parsed.provider === undefined ? `${baseline.provider}/${parsed.model}` : token;
    return { kind: 'allow', items: [item] };
}
//# sourceMappingURL=template-model.js.map