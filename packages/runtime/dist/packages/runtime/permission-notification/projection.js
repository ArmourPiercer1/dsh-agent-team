/**
 * Alpha.3 PR5 — the permission READ PROJECTION over the durable overlay
 * snapshots + their history audit (plan PR5; ADR §2 "History: audit only").
 *
 * The projection is a pure read surface with exactly two views, both
 * reached through the EXISTING access boundaries of the PR1 port:
 *
 * - {@link PermissionReadProjection.readAuthority} mirrors the CURRENT
 *   AUTHORITY (the highest-generation durable snapshot that `latest`
 *   returns — the port never folds or replays, and neither does the
 *   projection);
 * - {@link PermissionReadProjection.readHistoryAudit} mirrors the
 *   ascending audit rows of `history` — presented as audit, NEVER folded
 *   into an effective state (a fold would fork the read model away from
 *   the durable authority, which ADR §2 forbids for execution).
 *
 * Boundaries pinned by `test/a3p5-permission-read-projection.test.ts`:
 * - the injected port type is `Pick<PermissionOverlayRepositoryPort,
 *   'latest' | 'history'>` — `append` is not nameable here; the spec wraps
 *   the real port in a Proxy that THROWS on any member beyond the two, so
 *   the walk is pinned at runtime too;
 * - every returned view is a deep-frozen COPY: no caller can mutate a
 *   projection into a write, and the durable medium is never reached past
 *   the port;
 * - the projection answers questions, it decides nothing: nothing exported
 *   here is consumable as an authorization/decision/mutation input (the
 *   hygiene spec pins the closed export vocabulary and the import graph).
 *
 * @module @dsh-agent-team/runtime/permission-notification/projection
 */
/** Deep-freeze a value reachable only through plain data (views built here). */
function deepFreeze(value) {
    if (value !== null && typeof value === 'object') {
        for (const nested of Object.values(value))
            deepFreeze(nested);
        Object.freeze(value);
    }
    return value;
}
/** Copy the provenance section into a frozen view (field-by-field: the
 *  view has its own closed shape, never the durable row object identity). */
function provenanceView(provenance) {
    return deepFreeze({
        actor: provenance.actor,
        mutationId: provenance.mutationId,
        timestamp: provenance.timestamp,
        reason: provenance.reason,
    });
}
/** Copy one snapshot into its ascending history-audit entry. */
function historyEntry(snapshot) {
    return deepFreeze({
        snapshotId: snapshot.snapshotId,
        generation: snapshot.metadata.generation,
        previousSnapshotId: snapshot.metadata.previousSnapshotId,
        ruleCount: snapshot.state.rules.length,
        provenance: provenanceView(snapshot.provenance),
    });
}
/**
 * Build the read projection over one durable overlay world.
 * @param deps - the two-member read seam.
 * @returns the two pure-read views; frozen outputs; zero writes; zero
 *   decision output.
 */
export function createPermissionReadProjection(deps) {
    return {
        async readAuthority(identity) {
            const snapshot = await deps.overlay.latest(identity);
            if (snapshot === undefined) {
                const absent = { present: false, identity: { ...identity } };
                return deepFreeze(absent);
            }
            const view = {
                present: true,
                identity: {
                    teamSessionId: snapshot.identity.teamSessionId,
                    memberInstanceId: snapshot.identity.memberInstanceId,
                },
                snapshotId: snapshot.snapshotId,
                generation: snapshot.metadata.generation,
                previousSnapshotId: snapshot.metadata.previousSnapshotId,
                ruleCount: snapshot.state.rules.length,
                rules: snapshot.state.rules.map((rule) => ({
                    operation: rule.operation,
                    resource: rule.resource,
                    effect: rule.effect,
                })),
                provenance: provenanceView(snapshot.provenance),
            };
            return deepFreeze(view);
        },
        async readHistoryAudit(identity) {
            const snapshots = await deps.overlay.history(identity);
            // Presentation only, in the port's own ascending order: the entries
            // are listed as audit; nothing here computes a state from them.
            const entries = snapshots.map(historyEntry);
            const view = {
                identity: {
                    teamSessionId: identity.teamSessionId,
                    memberInstanceId: identity.memberInstanceId,
                },
                entries,
            };
            return deepFreeze(view);
        },
    };
}
//# sourceMappingURL=projection.js.map