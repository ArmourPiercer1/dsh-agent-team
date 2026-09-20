/**
 * Async work completion (wake-up) — the notification types
 * (work-completion-wakeup plan §3; architecture plan §3.3).
 *
 * Authority boundary (frozen design):
 * - the completion identity is the WORK UNIT — `(rootSessionId,
 *   requestToken)` — never the Member lifecycle transition (one member
 *   may carry several overlapping work units; the durable settlement
 *   FACT of the requestToken is the completion source);
 * - the notification carries MINIMAL metadata only: it never carries
 *   the member result body, a transcript, or any unbounded text — the
 *   durable result stays the `team_collect` (work-status) read-back;
 * - the target set is a closed UNION even though only `leader` is
 *   supported this round: consumers take `targets[]` (never a
 *   Leader-only method) so future `caller` / `instance` kinds can be
 *   added without refactoring the completion-notification main chain
 *   (architecture plan §3.3).
 */
export {};
//# sourceMappingURL=types.js.map