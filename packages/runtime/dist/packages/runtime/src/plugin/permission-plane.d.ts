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
 * 2. **THE STATIC FACTS AND THE §6 ENVELOPE OF THE MUTATION PLANE READ THE
 *    ADDRESSED TEAM'S OWN BOUND BLUEPRINT, ANCHORED AT THE TARGET'S
 *    WORKSPACE.** The kernel compares a Leader's expansion against the LOWER
 *    static layers and the §6 envelope, all expressed in the SAME canonical
 *    identity space as the overlay rules; turning a blueprint PATH into a
 *    canonical key is the fs provider's job (A2), not this module's. The
 *    production entry therefore builds them through
 *    {@link createPermissionAuthorityFacts} (below): every document is read
 *    through `resolveBlueprint(teamSessionId)` (the SAME three-case bound-
 *    Blueprint authority the team identity binds to — a bound ref NEVER falls
 *    back to the row anchor), the file paths canonicalized against the TARGET
 *    member's effective workspace (its runtime cwd), and the §6 envelope taken
 *    from the bound Blueprint's EXPLICIT `permissionMutationEnvelope` carrier
 *    (never a derivation of the leader's static lanes). The kernel awaits
 *    these readers, which re-validate team/member/binding/cwd/provider across
 *    their await and abstain on drift (UNKNOWN / zero envelope → typed
 *    refusal, never a stale answer). When NO caller injects a provider (test/
 *    legacy roots) the reader stays ABSENT (= UNKNOWN facts) and the regions
 *    that depend on lower facts refuse typed (`PERMISSION_EFFECT_CONTEXT_
 *    UNAVAILABLE`) — the sanctioned posture for a round whose facts are
 *    unavailable. This is the MUTATION plane's authority check ONLY: the
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
import type { PermissionMutationEnvelope, PermissionStaticLayerFacts } from '../../governance/index.js';
import type { GovernanceMutationService, GovernancePermissionLaneDeps } from '../../governance/types.js';
import type { MemberLifecycleState } from '../../../contracts/src/index.js';
import type { TeamBlueprint } from '../../../domain/blueprint/src/index.js';
import type { MemberLifecycleReaderPort, PermissionDecisionLane, PermissionLifecycleMutationLane, PermissionLifecycleRestorePort } from '../../permission-lifecycle/index.js';
import type { PermissionOverlayRepositoryPort } from '../../permission-governance/port.js';
/** The durable member-instance read surface the lifecycle facts come from. */
export interface MemberInstanceRowReader {
    get(rootSessionId: string, instanceId: string): {
        readonly lifecycle: MemberLifecycleState;
    } | undefined;
}
/** The durable TeamSession read surface the LEADER liveness fact comes from. */
export interface TeamSessionRowReader {
    get(rootSessionId: string): unknown;
}
/** The whole-matcher containment predicate over two canonical keys. */
export type CanonicalKeyContains = (parentKey: string, childKey: string) => boolean;
/** The PR4 plane as the production root exposes it. */
export interface TeamPermissionPlane {
    /** The write entries (grant / revoke / restore) into the ONE authority. */
    readonly mutation: PermissionLifecycleMutationLane;
    /** The execution read plane (the ADR §8 gate + the merged decision lanes). */
    readonly decisions: PermissionDecisionLane;
}
/**
 * The ADR §8 lifecycle reader over the durable member rows. A read that
 * FAULTS propagates (the decision lane fails closed on a throwing port —
 * a storage fault is never laundered into "no row").
 *
 * The LEADER exception (PR4 round 3, BLOCK-4): v2 carries NO leader member
 * row — the real host boot NEVER seeds one (only fixture worlds do), and
 * the artifact identity port confirms the doctrine (`host.ts lifecycleOf`:
 * the leader position resolves to 'leader' with no row). Reading member
 * rows blindly therefore answers "unknown execution state" for every Leader
 * tool call. This reader reuses the ONE existing authority semantics for
 * leader liveness in this codebase — `control/service.ts` (leader live ⇔ the
 * durable TeamSession row exists; the member-row lifecycle check EXPLICITLY
 * excludes {@link LEADER_INSTANCE_ID}) — and nothing else: the leader answers
 * `RUNNING` exactly while its TeamSession row exists, `undefined` (no state —
 * the lane's own typed refusal) when it does not. NO lifecycle field is
 * fabricated and NO member-row semantics change: with the second argument
 * absent the reader is byte-identical to its pre-PR4 shape.
 * @param rows - the `member-instances` repository read surface.
 * @param teamSessions - the `team-sessions` read surface enabling the
 *   leader-aware branch (absent = pre-PR4 member-rows-only reader).
 */
export declare function createMemberLifecycleReader(rows: MemberInstanceRowReader, teamSessions?: TeamSessionRowReader): MemberLifecycleReaderPort;
/**
 * The `permissionLane` deps of {@link createGovernanceMutationService} — the
 * ONE durable write path of the permission plane (PR3). Absent `overlay`
 * there is no lane at all and `mutatePermission` refuses
 * `PERMISSION_MUTATION_NOT_CONFIGURED` (fail closed, zero write).
 * @param deps.overlay - the PR1 persistence-only port (`append`/`latest`/`history`).
 * @param deps.fsContainsKeys - the runtime containment predicate (see the
 *   module doc, asymmetry 1).
 * @param deps.staticLayers - the lower-layer facts reader; ABSENT by default
 *   (see the module doc, asymmetry 2; production injects the document built
 *   by {@link createPermissionAuthorityFacts}).
 * @param deps.permissionEnvelope - the bound §6 expansion ceiling for the
 *   Leader; forwarded VERBATIM (this module grants nothing — absent = the
 *   service's zero-authority default). ROUND 5: the round-4
 *   leaderAuthorityFacts forward is REMOVED (the ceiling gate was a second
 *   policy ADR §6 does not carry).
 */
export declare function createPermissionGovernanceLane(deps: {
    readonly overlay: PermissionOverlayRepositoryPort;
    readonly fsContainsKeys?: CanonicalKeyContains;
    readonly staticLayers?: GovernancePermissionLaneDeps['staticLayers'];
    readonly permissionEnvelope?: GovernancePermissionLaneDeps['permissionEnvelope'];
    /** ROUND 7 (parent BLOCK-1): the target lifecycle guard awaited INSIDE the
     *  serialized mutation section (the post-await revalidation position). The
     *  production root wires the SAME shared assertion the mutation lane
     *  pre-checks — one lifecycle law, never a second gate. */
    readonly targetGuard?: GovernancePermissionLaneDeps['targetGuard'];
}): GovernancePermissionLaneDeps;
/**
 * The two PR4 lanes over the already-assembled authority + lifecycle path.
 * @param deps.governance - the production `GovernanceMutationService`.
 * @param deps.overlay - the same PR1 port the governance lane appends through.
 * @param deps.members - the lifecycle reader ({@link createMemberLifecycleReader}).
 * @param deps.lifecycle - the restore port (the EXISTING single lifecycle
 *   path; absent = `restore` refuses typed `…_RESTORE_UNCONFIGURED`).
 */
export declare function createTeamPermissionLanes(deps: {
    readonly governance: GovernanceMutationService;
    readonly overlay: PermissionOverlayRepositoryPort;
    readonly members: MemberLifecycleReaderPort;
    readonly lifecycle?: PermissionLifecycleRestorePort;
}): TeamPermissionPlane;
/** The snapshot identity the derived documents are bound to. */
export interface PermissionFactsIdentity {
    readonly blueprintId: string;
    readonly revision: string;
    readonly contentHash: string;
}
/** One warmed (team, member) target for {@link PermissionAuthorityFacts.refresh}. */
export interface PermissionFactsWarmTarget {
    readonly teamSessionId: string;
    readonly memberInstanceId: string;
}
/** The inputs of {@link createPermissionAuthorityFacts} (all injected). */
export interface PermissionAuthorityFactsDeps {
    /** The ADDRESSED team's real bound Blueprint (the SAME three-case authority
     *  the team identity binds to; `undefined` = unresolvable → UNKNOWN). */
    readonly resolveBlueprint: (teamSessionId: string) => TeamBlueprint | undefined;
    /** The member row's template id (`undefined` = no durable row → UNKNOWN). */
    readonly memberTemplateId: (teamSessionId: string, memberInstanceId: string) => string | undefined;
    /** The target member's EFFECTIVE workspace = its actual runtime cwd (the
     *  canonicalization anchor; `undefined` = UNKNOWN). The leader position is
     *  the team's default workspace. NEVER the acting row/anchor cwd. */
    readonly memberWorkspace: (teamSessionId: string, memberInstanceId: string) => string | undefined;
    /** The A2 canonicalizer (the row's fs provider — the ONLY legal key
     *  source), anchored at the caller-supplied cwd. */
    readonly canonicalize: (path: string, cwd: string) => Promise<string>;
    /** A token identifying the CURRENT fs provider instance/epoch. ROUND 5:
     *  a DRIFT field of the revalidated binding tuple — NOT a cache epoch (no
     *  cache exists); a mid-read change discards the in-flight build. Default
     *  = a constant, honest for a single-provider host (a constant is NOT a
     *  version — which is exactly why nothing may be cached on it). */
    readonly providerVersion?: () => string;
    /** The boot warm targets (leader + existing members of the boot team). */
    readonly bootWarmTargets?: () => readonly PermissionFactsWarmTarget[];
}
/** The built authority: a warm build + two kernel readers (async-capable). */
export interface PermissionAuthorityFacts {
    /** The async warm boundary (host: after `builtRoot.boot()`, before
     *  readiness). Best-effort: builds the boot warm targets; a fault marks the
     *  authority unhealthy and the readers RETRY lazily on the next read (never
     *  a cached failure). Idempotent; a repeat rebuilds from CURRENT bindings. */
    refresh(): Promise<void>;
    /** `true` while the last warm/read against the current bindings succeeded. */
    readonly healthy: () => boolean;
    /** EXACT (non-optional) signatures: the builder ALWAYS wires these —
     *  the LANE deps may omit them (legacy), the production surface may not. */
    readonly staticLayers: (teamSessionId: string, memberInstanceId: string) => Promise<PermissionStaticLayerFacts | undefined>;
    readonly permissionEnvelope: (teamSessionId: string, memberInstanceId: string) => Promise<PermissionMutationEnvelope>;
}
/**
 * Build the addressed-team, per-member authority readers (see the section
 * header for the three bindings and the fail-closed rules).
 * @param deps - the injected bound-Blueprint / member / canonicalizer sources.
 */
export declare function createPermissionAuthorityFacts(deps: PermissionAuthorityFactsDeps): PermissionAuthorityFacts;
//# sourceMappingURL=permission-plane.d.ts.map