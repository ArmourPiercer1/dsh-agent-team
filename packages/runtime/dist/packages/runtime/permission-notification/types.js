/**
 * Alpha.3 PR5 — the closed type surface of the permission NOTIFICATION and
 * READ PROJECTION layer (plan PR5 "notification and the read projection";
 * ADR §9: notification is awareness only, NEVER authorization evidence).
 *
 * This module is the pure awareness layer over the merged PR1–PR3 durable
 * surface:
 *
 * - the NOTIFICATION half turns ONE committed `PermissionOverlaySnapshot`
 *   (the PR3 mutation result's durable row, ADR §2) into one generation-
 *   tagged, model-visible notice delivered best-effort to ACTIVE Agents
 *   only — it never wakes idle Agents, never retries, never records a
 *   ledger, and its success or failure NEVER touches the mutation result
 *   or the mutation ack (the commit-before-ack path of
 *   `GovernanceMutationService.mutatePermission` stays untouched: this
 *   layer is called AFTER the ack and observes it, never wraps it);
 * - the PROJECTION half is a READ view over the durable overlay snapshots
 *   and their history, reached through the EXISTING access boundaries only
 *   (the PR1 `PermissionOverlayRepositoryPort` members `latest` /
 *   `history` — never `append`, which the injected type narrows away).
 *
 * Authority boundary (the reason this module imports NOTHING at runtime):
 * - every vocabulary type here is TYPE-ONLY (the PR1 overlay vocabulary
 *   through `../permission-governance/*`), so this lane carries no runtime
 *   edge to governance, storage, the resolver, or the host;
 * - nothing here is an input to any decision: the notification renders
 *   metadata (identity / generation / provenance / rule COUNT — never the
 *   rule set), the projection mirrors durable rows as frozen read views,
 *   and the module exposes no authorize / resolve / assemble / mutate /
 *   grant / revoke / envelope member (pinned structurally by
 *   `test/a3p5-permission-notification-lane-hygiene.test.ts`);
 * - a stale notification only MARKS its generation (and the superseding
 *   generation when known); permissions live in the durable store and this
 *   lane can neither read-modify nor write them.
 *
 * WIRED VS PENDING (current state, see the module README): the notification
 * emitter is WIRED at exactly ONE production point — `src/plugin/root.ts`,
 * the governance-mutation completion point (post-COMMIT, detached,
 * inject-only receipt gate). The READ PROJECTION remains a library until a
 * production read surface consumes it. The layer's outputs are consumed by
 * NOTHING else — awareness, never authorization evidence (ADR §9).
 *
 * @module @dsh-agent-team/runtime/permission-notification/types
 */
export {};
//# sourceMappingURL=types.js.map