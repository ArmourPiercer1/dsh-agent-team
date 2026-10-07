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
import type { AuthorityEnvelope, AuthorityEnvelopeAst } from '../../../domain/authority-envelope/src/index.js';
import type { AuthorityDocumentRead } from '../../governance/authority-ceiling.js';
import type { PermissionAuthorityCeilingContext } from '../../governance/types.js';
import type { MemberLifecycleReaderPort, PermissionDecisionLane, PermissionLifecycleMutationLane, PermissionLifecycleRestorePort } from '../../permission-lifecycle/index.js';
import type { PermissionOverlayRepositoryPort } from '../../permission-governance/port.js';
import type { OperationApprovalFactsReader } from '../../operation-permission/index.js';
import type { ControlAuthorityRecheckPort } from '../../control/types.js';
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
    readonly isLifecycleRefusal?: GovernancePermissionLaneDeps['isLifecycleRefusal'];
    /** A4-PR2 lane C: the v3 authority-ceiling context reader, wired by the
     *  production root from {@link createAuthorityCeilingReader}. Absent = the
     *  deployment wired no ceiling reader, which is a WIRING fact and never the v3
     *  signal (that decision is the reader's, in this module — ADR A5-12). */
    readonly authorityCeiling?: GovernancePermissionLaneDeps['authorityCeiling'];
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
    /**
     * The THREE-STATE twin of {@link PermissionAuthorityFacts.permissionEnvelope}
     * for the governance start gate (A4-PR6 review round 1, BLOCKER 2).
     *
     * For the approval/expansion LANES an abstained read MUST mean zero
     * authority (`NO_ENVELOPE`) — a documented polarity, deliberately left
     * untouched. The envelope COMPARATOR needs the distinction the flag-dropping
     * wrapper destroys: a DECLARED envelope (including a legally empty one,
     * consistent with a declared-empty hard ceiling) versus a FAULTED read
     * (unknown binding, canonicalization fault, or binding drift across the
     * await). Collapsing the fault into `{ rules: [] }` makes
     * `compareEnvelopes` answer `consistent` — an unreadable authority document
     * would open the start gate (the review's wire-reachable blocker).
     */
    readonly permissionEnvelopeState: (teamSessionId: string, memberInstanceId: string) => Promise<PermissionEnvelopeStateRead>;
    /**
     * The v3 Human User hard ceiling for one addressed member (A4-PR1, spec §3.2).
     *
     * THREE outcomes, never a document-or-undefined: on the approval plane an
     * absent document means NO NARROWING, so a read that answered `undefined` for
     * a FAULT would widen approval authority exactly when the storage layer is
     * least trustworthy. See {@link AuthorityHardCeilingRead}.
     *
     * PR1 adds the READ and nothing else: no production decision consults it, and
     * {@link PermissionAuthorityFacts.refresh} does not warm it (warming would
     * fold a brand-new document into `healthy()` semantics that every v1/v2 Team
     * still drives — that is PR2's call with a caller in front of it).
     */
    readonly teamHardEnvelope: (teamSessionId: string, memberInstanceId: string) => Promise<AuthorityHardCeilingRead>;
    /**
     * The bound Blueprint's `schemaVersion` for one team session, or `undefined`
     * when the binding is UNKNOWN (no resolvable bound Blueprint). A4-PR2 added
     * this because the v3 switch MUST live in this module (ADR A5-12): the
     * governance service is forbidden from deciding v3 itself, and the only honest
     * source of the version is the SAME bound-Blueprint resolution every other
     * permission fact is read through — never a document-shape inference.
     */
    readonly blueprintSchemaVersion: (teamSessionId: string) => number | undefined;
    /** A4-PR5 (rebase round): the machine content identity of the SAME bound
     *  Blueprint the version switch above resolves — `TeamBlueprint.contentHash`
     *  is the value the POLICY_STATE_SNAPSHOT_MISMATCH law compares against, so
     *  a proposal fingerprint built from it binds to exactly the Blueprint the
     *  Team is bound to. `undefined` = no resolvable bound Blueprint (UNKNOWN),
     *  never a stand-in. */
    readonly blueprintContentHash: (teamSessionId: string) => string | undefined;
}
/**
 * The outcome of the THREE-STATE envelope read consumed by the governance
 * start gate (A4-PR6 review round 1, BLOCKER 2) — see
 * {@link PermissionAuthorityFacts.permissionEnvelopeState}. `unavailable` is
 * UNKNOWN (the read faulted): never a document, never a zero-authority stand-in.
 */
export type PermissionEnvelopeStateRead = {
    readonly status: 'declared';
    readonly document: PermissionMutationEnvelope;
} | {
    readonly status: 'unavailable';
};
/**
 * Build the addressed-team, per-member authority readers (see the section
 * header for the three bindings and the fail-closed rules).
 * @param deps - the injected bound-Blueprint / member / canonicalizer sources.
 */
/**
 * THE one AST→runtime canonicalization of an authority document (plan Task 1:
 * "single AST→runtime canonicalization"; ADR A2-3, correction X5-E2).
 *
 * Both v3 documents (`permissionMutationEnvelope`, `teamHardEnvelope`) pass
 * through THIS function, which is what "one grammar, two documents" means at the
 * boundary: identical mapping, identical provider discipline, one place for a
 * reviewer to audit. The input is the DECLARED shape a hash-bound Blueprint
 * carries; the output is the canonical `{ kind, resource }` document the kernel
 * consumes, validated and frozen by `parsePermissionMutationEnvelope` — the same
 * validation the mutation envelope has always had, so v1/v2 behavior is
 * unchanged to the byte (ADR A2-4).
 *
 * THE PROVIDER DISCIPLINE, because it is the security-relevant part:
 *  - a `fingerprint` matcher travels VERBATIM with ZERO provider calls — it
 *    already IS the canonical operation identity, and passing it through a path
 *    canonicalizer would let a filesystem answer rename an exec identity;
 *  - an `exact`/`subtree` matcher is canonicalized AT THE GIVEN WORKSPACE BASIS,
 *    and a provider that answers with nothing is a THROWN error, never an empty
 *    key: an empty key would silently turn a rule into one that covers the wrong
 *    (or every) resource.
 *
 * Exported so the discipline is testable directly
 * (`a4p1-authority-envelope.test.ts` counts the provider calls); the production
 * readers below are its only callers.
 */
export declare function buildAuthorityEnvelope(document: AuthorityEnvelopeAst, cwd: string, canonicalizer: {
    readonly canonicalize: (path: string, cwd: string) => Promise<string>;
}): Promise<AuthorityEnvelope>;
/**
 * The read outcome for the v3 `teamHardEnvelope` — an ALIAS of the ceiling
 * adapter's {@link AuthorityDocumentRead}, so there is ONE name for the three
 * facts a document read can report and, more importantly, so the reader's
 * output can be handed to `grantCeiling`/`bindingDocs` WITHOUT an intermediate
 * `undefined`. That intermediate is the hole this alias closes: on the approval
 * plane absence means "narrows nothing" (ADR A1-4), and an empty bound set meets
 * to the identity, so a `declared | absent` -or-`undefined` seam would let
 * `unavailable → undefined` grant a Leader or a Human User UNLIMITED approval
 * authority on a storage fault — with every test green, because `undefined` is
 * the correct spelling of the OTHER fact (`absent`). The ceiling adapter
 * refuses on `unavailable` instead, and its type does not accept `undefined`
 * at all (review SF1 on PR1).
 *
 * The three facts:
 *  - `declared` — a document exists (possibly declaring `rules: []`, which is a
 *    legal v3 declaration, not an absence);
 *  - `absent` — the bound Blueprint does not carry the field, exactly the v1/v2
 *    case through the bridge (ADR A2-4/A2-11); NEVER synthesized from a missing
 *    read;
 *  - `unavailable` — the binding is unknown or a provider faulted: unknown, not
 *    absent. A consumer must fail closed (ADR A1-7 keeps
 *    `authority-unavailable` distinct from `authority-undetermined`).
 */
export type AuthorityHardCeilingRead = AuthorityDocumentRead;
export declare function createPermissionAuthorityFacts(deps: PermissionAuthorityFactsDeps): PermissionAuthorityFacts;
/**
 * THE v3 AUTHORITY-CEILING READER (A4-PR2 lane C, ADR A5-12, spec §7.4.1).
 *
 * Assembles the ceiling CONTEXT the governance service evaluates for one mutation
 * target. It is a DATA assembler and nothing more: the ladder, the two planes and
 * every refusal law live in the authority-ceiling lane, and the decision whether
 * this Team is v3 lives HERE and nowhere else.
 *
 * THE VERSION SWITCH IS `schemaVersion === 3`, EXACTLY. Not "the reader was
 * wired", not "the hard ceiling declares rules", not "the envelope is non-empty":
 * a `{ rules: [] }` hard ceiling is a v3 Team that authorized NOTHING, and
 * reading its emptiness as "must be a pre-v3 Team, skip the gate" is a relaxation
 * in the forbidden direction, in the most restrictive Team in the fleet. The two
 * branches — the v1/v2 existential (return `undefined`, Alpha.3 behaviour
 * byte-identical) and the v3 branch — are both pinned in
 * `test/a4p2-dual-envelope-mutation.test.ts` (A5-12: one file, so the existential
 * leg cannot be deleted when the v3 leg starts passing).
 *
 * THREE ANSWERS, AND THE MIDDLE ONE IS THE ONE THAT MATTERS.
 *  1. `schemaVersion` is 1 or 2 — a DECIDED pre-v3 Team: `undefined`, the
 *     existential branch, Alpha.3 behaviour byte-identical. That answer is a fact
 *     about the DOCUMENT, and it dies with the cutover, when no document below 3
 *     can be bound at all.
 *  2. `schemaVersion` is `undefined`, or it is 3 but the content hash no longer
 *     resolves: `unreadableAuthorityCeilingContext` above — a refusal. `undefined`
 *     from this seam has ALWAYS meant "no resolvable bound Blueprint" (a resolvable
 *     v1/v2 document answers 1 or 2), so it never meant "pre-v3 Team" and cannot be
 *     allowed to keep buying a skipped gate. Post-cutover it is the ONLY thing the
 *     branch can mean, which is why it must not be carrying a silent commit into
 *     the window where the ceiling gate is the last law standing.
 *  3. `schemaVersion === 3` with a resolvable hash: the real v3 context, unchanged.
 *
 * The distinction the old two-answer shape erased is the one A5-12 exists to keep:
 * "this Team is not governed by the v3 ceiling" and "nobody can tell" are different
 * facts with different remedies, and only the first is allowed to skip a gate.
 */
export declare function createAuthorityCeilingReader(deps: {
    readonly facts: Pick<PermissionAuthorityFacts, 'teamHardEnvelope' | 'permissionEnvelope' | 'blueprintSchemaVersion' | 'blueprintContentHash'>;
}): (teamSessionId: string, memberInstanceId: string, actor: 'leader' | 'human') => Promise<PermissionAuthorityCeilingContext | undefined>;
/**
 * THE CONSUMPTION-POINT AUTHORITY RECHECK (A4-PR7 Task 7.0, ADR A1-14).
 *
 * The Control service calls this INSIDE the per-team lock, immediately before
 * it writes the `control-allow-consumed` fact, to answer one question: does the
 * rung that signed the leg STILL cover the authority point recorded on that
 * leg? An approval is not a standing grant (A1-14), so the answer must come
 * from the documents as they are NOW, and the only reader of those documents in
 * this process is the ceiling context this plane already builds (A5-12: a
 * reader in every judge is a second answer).
 *
 * WHY THE MAPPING LIVES HERE AND NOT IN THE CONTROL LANE. The control lane
 * deliberately consumes a CLOSED VERDICT PORT: it must not reach the ladder, the
 * document slot, or the ceiling question, because a lane that can evaluate a
 * ceiling is a lane that can widen one, and `a3p3-governance-lane-hygiene`
 * states the consumer set of that question in full. So the plane composes: the
 * operation lane's `recheckPersistedOperationAuthority` asks the persisted
 * question against the fresh facts, and this adapter only TRANSLATES the
 * vocabulary (`still-covered` → `still-sufficient`, `stale` → `authority-risen`,
 * `undetermined` → `undetermined`) and supplies the facts. It adds no authority
 * reasoning: no rung is named here, no ordering is consulted, and the one thing
 * it reads off the row beyond the facts (`requestedEffect`) is the question the
 * operation lane's `desiredEffect` law can actually answer.
 *
 * EVERY FAILURE IS `undetermined`, INCLUDING A THROWN FACTS READ. `undetermined`
 * is the arm the guard refuses with and consumes NOTHING on; a fault that
 * reported `still-sufficient` would execute an operation whose authority is
 * unknown, and a fault that THREW out of here would surface in the guard as a
 * generic guard failure instead of the named reason the durable verdict
 * deserves. There is no permissive default anywhere in this function.
 *
 * `actingAsLeader` is DERIVED FROM THE DURABLE ROW's beneficiary, never from a
 * re-read of who is holding the keyboard: the facts reader is valid exactly when
 * the beneficiary is the member instance the row names, and the reader's own law
 * (pinned in `test/a4p4-operation-approval-authority.test.ts`) refuses to route a
 * Leader-beneficiary ask off a member-beneficiary document set. A leader-
 * beneficiary row therefore answers with no facts, hence `undetermined`, hence a
 * refusal with zero consumption — the fail-closed direction. No v3 operation case
 * row is minted for a Leader install today: its routing takes the pre-v3 arm,
 * which creates no approval case at all.
 *
 * @param deps.operationApprovalFacts - the plane's operation-facts reader (the
 *   same reader the pre-execute pipeline routes the ask with, so the ask and the
 *   consumption point cannot read two different document sets).
 * @returns the port for `createControlService`'s `authorityRevalidation`.
 */
export declare function createControlAuthorityRevalidation(deps: {
    readonly operationApprovalFacts: OperationApprovalFactsReader;
}): ControlAuthorityRecheckPort;
//# sourceMappingURL=permission-plane.d.ts.map