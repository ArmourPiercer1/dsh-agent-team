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
 * @module @dsh-agent-team/runtime/agent-setup/model
 */

export type {
  ModelSelection,
  ModelSelectionSource,
  TeamModelRequest,
} from './types.js'
export {
  TeamModelOverlaySlot,
  TeamModelSelectionAdapter,
} from './overlay.js'
