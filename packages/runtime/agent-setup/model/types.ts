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

/**
 * The minimal public ModelSelection value (DevPlan §18.4 "使用 public
 * ModelSelection").
 *
 * Mock-first structural mirror of the public DSH ModelSelection contract
 * (provider route + provider-owned model id + optional adapter-owned
 * reasoning effort). Readonly by contract: a selection is a VALUE — a
 * mutation of the in-effect selection is always a REPLACEMENT of the
 * source's current value (a future-boundary mutation), never an in-place
 * edit of a shared object.
 */
export interface ModelSelection {
  /** Registered provider route. */
  readonly provider: string
  /** Provider-owned model id. */
  readonly model: string
  /** Adapter-owned reasoning effort, or provider/default behavior when absent. */
  readonly reasoningEffort?: string
}

/**
 * The injected public ModelSelection seam (mock-first; the real DSH public
 * seam binding lands in T5/T6).
 *
 * The source is the SOLE owner of the in-effect selection. The model
 * overlay RESOLVES it at request time; it never writes it. The two members
 * are the only contact points:
 *
 * 1. `current` — the selection in effect for the NEXT request that enters
 *    prompt assembly. Read at request time by the adapter's
 *    `beginRequest` (the frozen DevPlan §18.4 resolution moment).
 * 2. `select` — the future-boundary mutation: switching the in-effect
 *    selection. An in-flight request that has already entered prompt
 *    assembly keeps its CAPTURED selection; the switch takes effect from
 *    the next request that enters prompt assembly (DevPlan §18.4 "request
 *    N remains A; request N+1 uses B").
 */
export interface ModelSelectionSource {
  /**
   * The selection in effect for the next request.
   * @returns the current selection, or `undefined` when none is set (the
   *   request proceeds with provider/default behavior — an undefined
   *   capture is losslessly carried, never defaulted away).
   */
  current(): ModelSelection | undefined
  /**
   * Switch the in-effect selection (the future-boundary mutation).
   * @param next - the replacement selection value.
   */
  select(next: ModelSelection): void
}

/**
 * One in-flight request's CAPTURED effective selection (the per-request
 * snapshot; DevPlan §18.4 "request N = model A").
 *
 * The capture is taken when the request enters prompt assembly (the
 * adapter's `beginRequest`) and is IMMUTABLE for the request's lifetime:
 * a concurrent source mutation never changes it (future-boundary
 * mutation). The handle is lossless-JSON-derivable: `selection` carries no
 * live references.
 */
export interface TeamModelRequest {
  /**
   * The selection captured when this request began (the request's model).
   * `undefined` when the source had no selection at the capture moment.
   */
  readonly selection: ModelSelection | undefined
  /**
   * Release this request's in-flight capture (the request finished).
   * Idempotent: a second call is a no-op.
   */
  complete(): void
}
