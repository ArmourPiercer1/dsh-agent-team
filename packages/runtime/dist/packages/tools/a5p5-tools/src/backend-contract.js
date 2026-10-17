/**
 * `a5p5-tools` Phase 2 — the BACKEND CONTRACT this lane consumes: the closed
 * execution shape a Search/Shell provider (PR3 FS / PR4 confined process)
 * will speak, plus the scenario-fixture table that lets the lane develop its
 * PARITY claim now, against a stub, instead of waiting for those lanes
 * (INTERFACES-v1.md 集成规则: 上游未合 = 契约 fixture 开发；the claim is
 * "verified against the fixture", never "the whole chain is verified").
 *
 * C-PROC LAW (INTERFACES-v1.md): the stage set is the CLOSED sequence
 * probe → prepare → execute → terminate; `terminate ≠ cancel` — the terminal
 * fact of a run is carried SEPARATELY by the settlement (the PR1r/lease
 * plane in `spill.ts`), never by abusing the stage walk.
 *
 * C-FS LAW: every normalized backend failure carries the typed error class
 * from the closed triad denied / hidden / undetermined — a hidden leg is
 * still typed, never a silent result.
 *
 * Purity: no `node:*`, no I/O, no clock.
 *
 * @module @dsh-agent-team/tools/a5p5-tools/backend-contract
 */
/** The C-PROC closed stage set, in transition order. */
export const BACKEND_STAGES = ['probe', 'prepare', 'execute', 'terminate'];
/** The settlement of a backend that never produced an outcome (C-PROC honest fact). */
export const UNREADABLE_SETTLEMENT = { kind: 'cancelled', event: 'dispatcher-call-outcome-unreadable' };
//# sourceMappingURL=backend-contract.js.map