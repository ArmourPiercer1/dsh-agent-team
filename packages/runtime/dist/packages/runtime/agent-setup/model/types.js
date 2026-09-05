/**
 * Team model overlay contract surface (TaskDoc §11.5 P5-T3; DevPlan §18.4).
 *
 * This module defines the CONTRACT of the P5-T3 model overlay slot:
 *
 * - the minimal public {@link ModelSelection} value — a mock-first
 *   structural mirror of the public DSH ModelSelection contract; the real
 *   DSH public seam binding lands in T5/T6 (ruling R28: "真实 DSH 公开面
 *   绑定属 T5/T6; T1 一律 mock-first"), and the frozen requirement
 *   "使用 public ModelSelection" (DevPlan §18.4) is honored at the type
 *   level by this lossless value contract;
 * - the injected {@link ModelSelectionSource} seam — the mock-first public
 *   model-selection source the overlay RESOLVES. The overlay never owns or
 *   writes the selection: a concurrent override is a mutation of the source
 *   by the operator / control plane, not an effect of the overlay;
 * - the {@link TeamModelRequest} handle — the per-request CAPTURE of the
 *   effective selection at request time (the frozen DevPlan §18.4
 *   sequence, verbatim: request N = model A; concurrent override -> B;
 *   request N remains A; request N+1 uses B).
 *
 * What this module does NOT define (and must never grow):
 *
 * - no Team SessionEvent vocabulary of any kind (vNext has no Team
 *   SessionEvents; the model overlay emits no session events at all — the
 *   binder is the single event emitter, P5-T1 contract);
 * - no TeamDomain record production (the overlay resolves the injected
 *   source; it never writes TeamDomain or the selection source);
 * - no legacy `packages/team` vocabulary (global forbidden block).
 *
 * Pure module: no I/O, no live Agent, no `node:` builtin, no runtime
 * environment assumptions.
 * @module @dsh-agent-team/runtime/agent-setup/model/types
 */
export {};
//# sourceMappingURL=types.js.map