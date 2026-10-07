/**
 * The per-root BOUND Blueprint resolver (pre-alpha3 W1a F11 — review round 2
 * extraction, the production glue's per-Team Blueprint authority).
 *
 * WHY THIS MODULE EXISTS — the B1 hole (independent review of PR #43): the
 * production `policyState.get` / `policyState.set` wire resolved the closed
 * set through a resolver INLINED in the host entry (host.ts), so no test
 * could drive the REAL production code path against bound rows the authority
 * would reject — the multi-team test injected its own mirror resolver and
 * could not see what the production path does with a bound row. The
 * resolver is now an exported factory wired exactly like the host (real
 * durable rows + real authority + the row anchor), and the
 * production-wiring suite (`policy-state-bound-blueprint-production-wiring`)
 * drives `policyState.get` / `policyState.set` through it.
 *
 * The contract is EXACTLY three cases — no more, no less:
 *
 * 1. **Missing row → THROW (fail closed).** The domain carries no durable
 *    TeamSession row for this root: a programming error (the glue must
 *    never set up an agent for a root without a row). The resolver throws
 *    synchronously; nothing downstream is constructed for that root.
 *
 * 2. **Row WITHOUT a bound snapshot ref → the row anchor — BY DEFINITION,
 *    not a fallback.** Pre-repair legacy rows predate per-team binding
 *    (the `blueprint` field was added by the repair): for them the team's
 *    bound blueprint IS the host boot Blueprint (the row anchor) — every
 *    such team was created from that one source. Resolving case-2 rows to
 *    the anchor is therefore the CORRECT legacy binding (the documented
 *    legacy contract), not a boot-fallback: the same resolver feeds the
 *    glue's dynamic Team authority (an agent MUST be set up for legacy
 *    roots, not refused), and rejecting case-2 rows would be a
 *    legacy-compatibility regression.
 *
 * 3. **Row WITH a bound ref → the Blueprint authority's
 *    `resolveSnapshot` — and the anchor is NEVER consulted for it.** An
 *    unresolvable identity fails typed (the static catalog's closed
 *    `MALFORMED_DTO` `blueprint-not-found` wording); a content hash the
 *    authority cannot reproduce fails typed
 *    (`TEAM_BLUEPRINT_SNAPSHOT_MISMATCH`). This is where the B1 hole is
 *    closed: the production wire goes through THIS resolver, so a team
 *    WITH a bound ref can never silently fall back to the boot Blueprint.
 *
 * The resolver is the single production source of the per-team bound
 * Blueprint: the glue's per-Team dynamic authority (host.ts, the BP-F
 * wiring) and the Governance service's closed-`policyStates` dep (root.ts)
 * both feed from it. The remote plane's closed-set precheck is
 * shape-only (F11) — the semantic closed set is this resolver's output.
 *
 * @module @dsh-agent-team/runtime/src/plugin/bound-blueprint
 */
import { classifyBlueprintAnchor } from './blueprint-authority.js';
import { TeamPluginError } from './types.js';
/**
 * The production bound-Blueprint resolver (see the module contract —
 * exactly three cases: missing row → throw; no-ref legacy row → the row
 * anchor BY DEFINITION (the documented legacy binding); bound ref → the
 * authority's `resolveSnapshot`, NEVER the anchor).
 */
export function createBoundBlueprintResolver(options) {
    return (teamRootSid) => {
        const row = options.teamSessions.get(teamRootSid);
        if (row === undefined) {
            throw new Error(`resolveBoundBlueprint(${String(teamRootSid)}): the domain carries no durable TeamSession row for this root — the glue must never set up an agent for a root without a row`);
        }
        const ref = row.blueprint;
        if (ref === undefined) {
            // Case 2 (the documented legacy binding, NOT a boot fallback):
            // pre-repair legacy rows predate per-team binding, so their bound
            // blueprint is the row anchor BY DEFINITION.
            //
            // A4-PR7 Task 7.2 (A1-20(c) + A1-21): "by definition the anchor" also
            // means "by definition it inherits the anchor's version state" — and this
            // is the ONE resolver arm that never touched the Blueprint authority, so it
            // is the arm where a v1/v2 Team could still be walked into a running
            // Team (or into the domain parser's generic `SCHEMA_VERSION_UNSUPPORTED`,
            // which names a broken document instead of a owed migration). Classifying
            // the anchor here, rather than strong-parsing it blind, makes case 2
            // refuse with the SAME typed name case 3 gets from the authority — one
            // contract, two arms, no operator-visible fork.
            const anchor = classifyBlueprintAnchor(options.anchorBlueprintSource);
            if (anchor.status === 'refused') {
                throw new TeamPluginError(anchor.code, anchor.headline, {
                    teamRootSessionId: teamRootSid,
                    reason: 'bound-anchor-refused',
                    migrationState: anchor.migrationState,
                    ...(anchor.migrationState === 'migration-required'
                        ? { ...anchor.identity, schemaVersion: anchor.schemaVersion }
                        : {}),
                });
            }
            return anchor.blueprint;
        }
        // Case 3: the bound ref resolves through the authority — an
        // unresolvable identity or a content hash the authority cannot
        // reproduce fails typed; the anchor is never consulted.
        return options.resolveSnapshot(ref);
    };
}
//# sourceMappingURL=bound-blueprint.js.map