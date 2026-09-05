/**
 * P8-T2 Projection Service — the read ports and the durable source
 * vocabulary (TaskDoc §11.9 P8-T2; DevPlan §21).
 *
 * The whole projection is produced from EXACTLY TWO inputs (DevPlan §21.2):
 *
 *   1. the **durable TeamDomain** state (invariant 41 — the TeamDomain is
 *      the durable authority), read through {@link TeamDomainReadPort} as a
 *      BOUNDED projection source: the identity core, the root facts, the
 *      template rows, the member rows, and the ledger summary. The port
 *      exposes **no session-log or child-log read surface** — so "scan
 *      `Root + all child Session logs` to rebuild Team control truth" is
 *      impossible by construction (the §21.2 red line). The projection's
 *      complexity is therefore O(team members + templates), never O(child
 *      Session log volume).
 *   2. an **optional live residency/activity overlay** (UI §24), read
 *      read-only through {@link LiveResidencyOverlayPort} as a single
 *      snapshot of the current per-member live state. A member absent from
 *      the snapshot has no live facts (the fold maps it to
 *      `liveActivity: null` — the nullable overlay, DevPlan §21.2).
 *
 * The durable source types mirror the frozen P8-T1 projection input shapes
 * (so the fold can hand them straight to `createTeamProjection`) but keep
 * the TeamDomain's own optionality where the DTO resolves it (the member
 * `workspace` may be inherited from the team default; the ledger is the
 * summary, never the entries). The service is the ONLY place that reads;
 * the fold is a pure function of the source + the already-materialized
 * overlay snapshot (see `fold.ts`).
 *
 * Pure module: no I/O, no `node:` builtins, no runtime environment
 * assumptions.
 * @module @dsh-agent-team/runtime/projection/types
 */
export {};
//# sourceMappingURL=types.js.map