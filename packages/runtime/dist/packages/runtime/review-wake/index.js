/**
 * Alpha.6 PR3′ (Lane 2) — `review-wake`, the single-flight review-wake scheduler kernel. Public surface of
 * the package, and the place its dormancy is declared.
 *
 * WHAT THIS PACKAGE IS: the transition law that turns "a hundred review requests arrived" into "at most one
 * reviewer wake, then re-read". Scheduling state and nothing else — no decision, no mandate, no case, no
 * permission, no `allow` anywhere in its types or effects (L-1). The reviewer's own turn re-reads the
 * authoritative case list; this package only ever says "go look", and it is allowed to be lost.
 *
 * WHAT IT IS NOT, and where the missing halves live:
 *  - It does not deliver anything. Delivery (`deliverReviewWake`, the acceptance-only enqueue path in
 *    `src/plugin/live/agent-bindings.mjs`) is **PR-I2**, a named Center-Interface PR. There is no function
 *    exported here that can reach a Session, so PR3′ cannot wake anything by construction rather than by
 *    configuration.
 *  - It does not know whether review work exists. `hasReadyWork` is an injected question whose answer comes
 *    from the ControlService/TeamDomain read path (PR-I1's side). The kernel treats a wrong-but-successful
 *    "no" as unrecoverable-by-design and relies on re-arming from the next request — the window is named in
 *    `docs/plans/memo/alpha6-review-separation/pr3-wake-scheduler-design-20261030.md` §4, not hidden.
 *  - It does not store or fence anything for real. `hydrateWakeSlot` is the only front door for a persisted
 *    row, and the storage adapter (KvTables, CAS on the slot-triple key) is later wiring. The store key IS
 *    the triple — one row per `(rootSessionId, reviewerInstanceId, sessionGeneration)` — because the
 *    single-flight invariant is store-atomic only while creation and update of a triple contend on one key.
 *  - It cannot authenticate who told it something. `claimed` / `turn-ended` / `resume` arrive with a
 *    `wakeId` that is a sha256 over a public tuple, so PR-I2 must source those events from host facts only.
 *    The blast radius of ignoring that is scheduling damage and nothing else, because no authority exists
 *    here to be forged.
 *
 * DORMANT: zero production consumers. Nothing in `src/plugin/` imports this package; the lane's hygiene
 * suite (`packages/runtime/test/a6-pr0-lane-hygiene.test.ts` for PR0, `a6-pr3-lane-hygiene` for this lane)
 * fails if a consumer appears before its interface PR lands. Nothing here is wired to `allow`, nothing is
 * enabled by default, and no Alpha.5 permission, refusal, EffectSet or Grant semantics are touched.
 */
export { WAKE_PHASES, WAKE_OUTSTANDING_PHASES, WAKE_EVENT_KINDS, WAKE_DELIVERY_FAILURES, WAKE_SUSPEND_REASONS, WAKE_INBOX_OBSERVATIONS, WAKE_EFFECT_KINDS, WAKE_REFUSALS, isOutstandingWake, } from './types.js';
export { deriveWakeId, composeWakeText, sameWakeTurn, wakeSlotRowKey } from './identity.js';
export { reduceWakeSlot, createWakeSlot, hydrateWakeSlot, isBrandedWakeSlot } from './slot.js';
export { reconcileWakeSlots } from './recovery.js';
//# sourceMappingURL=index.js.map