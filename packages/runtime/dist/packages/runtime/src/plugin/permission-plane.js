/**
 * PR4 (pre-alpha3 permission lifecycle) — the production PERMISSION PLANE
 * assembly (implementation plan "PR4: Grant/Revoke/Lifecycle", "production
 * entry wiring"; ADR §2/§3/§8; parent ruling 2026-10-05: the canonical path
 * must be REACHABLE and FUNCTIONAL from the shipped root, not dormant).
 *
 * This module owns the ASSEMBLY of the PR4 lane at the single production
 * assembly point (`./root.js`), and nothing else:
 *
 *   - {@link createMemberLifecycleReader} — the ADR §8 execution facts, read
 *     straight off the durable `member-instances` rows (the same repository
 *     the lifecycle service commits through; `undefined` for an identity with
 *     no row, which the lane treats as its OWN state, never as RUNNING);
 *   - {@link createPermissionGovernanceLane} — the PR3 governance service's
 *     `permissionLane` deps (the persistence-only PR1 overlay port + the
 *     runtime containment predicate the subtree matcher REQUIRES);
 *   - {@link createTeamPermissionLanes} — the two PR4 lanes (the write
 *     entries into `mutatePermission` + the decision read plane).
 *
 * Two asymmetries of this assembly are deliberate and both are the merged
 * design, not an implementation shortcut:
 *
 * 1. **CONTAINMENT IS THE RUNTIME'S.** A `subtree` matcher is judged ONLY by
 *    the pinned public `FileSystem.contains` over the SAME provider that
 *    canonicalized the keys (plan §9.4: never `startsWith`, never key
 *    parsing, no consumer-side path arithmetic, no cache). The host entry
 *    therefore injects `fsContainsKeys`, built over its LAZY strict
 *    `ctx.get('fs')` accessor, and this module hands that predicate to the
 *    mutation plane as the kernel's whole-matcher `subtreeContains`. A fault
 *    of that predicate is reported as the kernel's OWN typed
 *    `PERMISSION_EFFECT_CONTEXT_UNAVAILABLE` — never as a `false` verdict
 *    (an fs fault must not silently relabel a covered region as uncovered),
 *    and never swallowed (unknown coverage is never labeled expansion or
 *    tightening — the round-2 PR3 ruling). When no predicate is injected the
 *    dep is simply ABSENT, and the merged PR3 gate refuses a subtree
 *    mutation typed instead of guessing.
 *
 * 2. **THE STATIC FACTS OF THE MUTATION PLANE ARE NOT INVENTED.** The kernel
 *    compares a Leader's expansion against the LOWER static layers expressed
 *    in the SAME canonical identity space as the overlay rules; the plugin
 *    root holds those policy rules only as blueprint PATHS, and turning a
 *    path into a canonical key is the fs provider's job (A2), not this
 *    module's. Comparing paths against canonical keys would produce a
 *    confidently WRONG answer, so the reader is ABSENT (= UNKNOWN facts)
 *    unless a caller injects a provider — and UNKNOWN makes the regions that
 *    depend on lower facts refuse typed (`PERMISSION_EFFECT_CONTEXT_
 *    UNAVAILABLE`), which is the sanctioned posture for a round whose facts
 *    are unavailable. This is the MUTATION plane's authority check ONLY: the
 *    DECISION plane (the lane below) never runs on absent facts — its static
 *    layers arrive freshly canonicalized by the pre-execute decision site
 *    itself (the A3/A5 canonicalization that produced the operation), which
 *    is why configured exact / subtree / exec decisions are reachable and
 *    functional in production.
 *
 * Purity: no `node:` builtins, no I/O, no clock. Everything durable arrives
 * through the injected ports.
 *
 * @module @dsh-agent-team/runtime/src/plugin/permission-plane
 */
import { parsePermissionResourceText, permissionEffectiveAnswer, PermissionMutationError } from '../../governance/index.js';
import { createPermissionDecisionLane, createPermissionLifecycleMutationLane } from '../../permission-lifecycle/index.js';
/**
 * The ADR §8 lifecycle reader over the durable member rows. A read that
 * FAULTS propagates (the decision lane fails closed on a throwing port —
 * a storage fault is never laundered into "no row").
 * @param rows - the `member-instances` repository read surface.
 */
export function createMemberLifecycleReader(rows) {
    return {
        readLifecycle: (teamSessionId, memberInstanceId) => rows.get(teamSessionId, memberInstanceId)?.lifecycle,
    };
}
/**
 * The `permissionLane` deps of {@link createGovernanceMutationService} — the
 * ONE durable write path of the permission plane (PR3). Absent `overlay`
 * there is no lane at all and `mutatePermission` refuses
 * `PERMISSION_MUTATION_NOT_CONFIGURED` (fail closed, zero write).
 * @param deps.overlay - the PR1 persistence-only port (`append`/`latest`/`history`).
 * @param deps.fsContainsKeys - the runtime containment predicate (see the
 *   module doc, asymmetry 1).
 * @param deps.staticLayers - the lower-layer facts reader; ABSENT by default
 *   (see the module doc, asymmetry 2).
 */
export function createPermissionGovernanceLane(deps) {
    const { overlay, fsContainsKeys, staticLayers } = deps;
    return {
        overlay,
        ...(staticLayers === undefined ? {} : { staticLayers }),
        ...(fsContainsKeys === undefined
            ? {}
            : {
                subtreeContains: (root, child) => {
                    try {
                        return fsContainsKeys(root, child);
                    }
                    catch (error) {
                        // The containment authority faulted: this is UNKNOWN coverage,
                        // not a negative verdict — the kernel's own typed refusal is
                        // the only honest channel (zero write, never a label).
                        throw new PermissionMutationError('PERMISSION_EFFECT_CONTEXT_UNAVAILABLE', `the runtime containment predicate could not judge ${JSON.stringify(root)} vs ${JSON.stringify(child)}: ${error instanceof Error ? error.message : String(error)}`);
                    }
                },
            }),
    };
}
/**
 * The two PR4 lanes over the already-assembled authority + lifecycle path.
 * @param deps.governance - the production `GovernanceMutationService`.
 * @param deps.overlay - the same PR1 port the governance lane appends through.
 * @param deps.members - the lifecycle reader ({@link createMemberLifecycleReader}).
 * @param deps.lifecycle - the restore port (the EXISTING single lifecycle
 *   path; absent = `restore` refuses typed `…_RESTORE_UNCONFIGURED`).
 */
export function createTeamPermissionLanes(deps) {
    const { governance, overlay, members, lifecycle } = deps;
    return {
        mutation: createPermissionLifecycleMutationLane({
            governance,
            overlay,
            members,
            ...(lifecycle === undefined ? {} : { lifecycle }),
        }),
        decisions: createPermissionDecisionLane({
            overlay,
            members,
            // The carrier grammar is the KERNEL's parser (never a second one).
            decodeResource: parsePermissionResourceText,
            // The exec (fingerprint) plane is the kernel's own pure effective
            // answer — the algebra that authorized the snapshot being read.
            effectiveAnswer: (query) => permissionEffectiveAnswer(query),
        }),
    };
}
//# sourceMappingURL=permission-plane.js.map