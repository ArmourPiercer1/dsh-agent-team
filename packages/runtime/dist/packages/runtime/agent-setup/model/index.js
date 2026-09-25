/**
 * Team model overlay public facade — the P5-T3 deliverable surface
 * (TaskDoc §11.5; DevPlan §18.4).
 *
 * Re-exports the complete P5-T3 model overlay module set (the mock-first
 * public ModelSelection seam contract, the session-scoped resolution core,
 * and the binder `model` overlay slot). T5/T6 bind the REAL DSH public
 * model-selection seam through this same surface; the injected
 * `ModelSelectionSource` stays the only contact point to the selection
 * state until then (ruling R28: "真实 DSH 公开面绑定属 T5/T6; T1 一律
 * mock-first").
 *
 * P8-S4B addition: the durable CONSUMPTION of the model cell — the bridge
 * from the durable governance overrides (backend truth) to the actual
 * future Agent model selection (DevPlan P8-S §18.1).
 *
 * Model-preference routing fix additions: the pure route grammar
 * (`parseModelItem` — now sourced from ./route.js, the single parse site;
 * the public name is unchanged) and the bound template's INITIAL STATIC
 * model grant derivation (`initialTemplateModelGrantOf`).
 *
 * @module @dsh-agent-team/runtime/agent-setup/model
 */
export { TeamModelOverlaySlot, TeamModelSelectionAdapter, } from './overlay.js';
export { parseModelItem, parseModelPreferenceToken, } from './route.js';
export { initialTemplateModelGrantOf } from './template-model.js';
export { modelConsumptionView, resolveDurableModelSelection, } from './durable-consumption.js';
//# sourceMappingURL=index.js.map