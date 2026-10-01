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
 * 2. **THE STATIC FACTS OF THE MUTATION PLANE ARE DERIVED, NEVER INVENTED.**
 *    The kernel compares a Leader's expansion against the LOWER static
 *    layers expressed in the SAME canonical identity space as the overlay
 *    rules; turning a blueprint PATH into a canonical key is the fs
 *    provider's job (A2), not this module's. The production entry therefore
 *    builds the facts documents through {@link createPermissionAuthorityFacts}
 *    (below): ONE frozen, identity-bound build at the root's post-boot async
 *    boundary — every template rule canonicalized by the SAME A2 provider —
 *    consumed SYNCHRONOUSLY by the pure kernel, which abstains (UNKNOWN /
 *    zero envelope → typed refusal, never a stale answer) when the bound
 *    snapshot drifts. When NO caller injects a provider (test/legacy roots)
 *    the reader stays ABSENT (= UNKNOWN facts) and the regions that depend
 *    on lower facts refuse typed (`PERMISSION_EFFECT_CONTEXT_
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
import type { GovernanceMutationService, GovernancePermissionLaneDeps } from '../../governance/types.js';
import type { MemberLifecycleState } from '../../../contracts/src/index.js';
import type { TemplatePermissionPolicy } from '../../../domain/blueprint/src/index.js';
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
 *   service's zero-authority default).
 */
export declare function createPermissionGovernanceLane(deps: {
    readonly overlay: PermissionOverlayRepositoryPort;
    readonly fsContainsKeys?: CanonicalKeyContains;
    readonly staticLayers?: GovernancePermissionLaneDeps['staticLayers'];
    readonly permissionEnvelope?: GovernancePermissionLaneDeps['permissionEnvelope'];
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
/** The inputs of {@link createPermissionAuthorityFacts} (all injected). */
export interface PermissionAuthorityFactsDeps {
    /** Every template id of the bound snapshot (leader included). */
    readonly templateIds: readonly string[];
    /** The template's permission policy (`undefined` = declares none). */
    readonly policyOf: (templateId: string) => TemplatePermissionPolicy | undefined;
    /** The leader position's template id (from the bound snapshot). */
    readonly leaderTemplateId: () => string;
    /** The member row's template id (`undefined` = no durable row). */
    readonly memberTemplateId: (teamSessionId: string, memberInstanceId: string) => string | undefined;
    /** The A2 canonicalizer (the row's fs provider; the ONLY legal key source). */
    readonly canonicalize: (path: string) => Promise<string>;
    /** The CURRENT bound-snapshot identity (re-verified on every sync read). */
    readonly identity: () => PermissionFactsIdentity;
}
/** The built authority: one async build, two sync kernel readers. */
export interface PermissionAuthorityFacts {
    /** The async build boundary (host: after `builtRoot.boot()`). Idempotent;
     *  a repeat REBUILDS from the current identity (a rebind re-canonicalizes). */
    refresh(): Promise<void>;
    /** `true` while the last build succeeded against its bound identity. */
    readonly healthy: () => boolean;
    readonly staticLayers: GovernancePermissionLaneDeps['staticLayers'];
    readonly permissionEnvelope: GovernancePermissionLaneDeps['permissionEnvelope'];
}
/**
 * Build the identity-bound authority documents (see the section header).
 * @param deps - the injected policy/identity/canonicalizer sources.
 */
export declare function createPermissionAuthorityFacts(deps: PermissionAuthorityFactsDeps): PermissionAuthorityFacts;
//# sourceMappingURL=permission-plane.d.ts.map