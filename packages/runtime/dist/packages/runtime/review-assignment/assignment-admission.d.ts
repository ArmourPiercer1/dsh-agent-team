/**
 * Alpha.6 PR-I1b (Lane 2) — the ENTRY ADMISSION layer for `ReviewAssignment` decisions.
 *
 * WHY THIS FILE EXISTS. PR-I1a shipped the one governed durable WRITER; the user ruling of 2026-10-31 (裁决二,
 * PR #513) named the other half of the split PR-I1: a ControlService-side ADMISSION that decides WHO may make a
 * decision enter that writer, while deciding NOTHING else. This module is that admission. It is not a second
 * resolution authority (memo §0): the role closure it applies is the existing `CONTROL_RESOLVER_ROLES` (its kind →
 * role lists live in `packages/runtime/control/types.ts:193-197`; the resolve path reads them at
 * `packages/runtime/control/service.ts:2622` and `:4852`, `:5228`, `:5495`), the identity it trusts is whatever the
 * existing caller-resolution entry point resolved, and the persistence it triggers is entirely
 * `applyReviewAssignment`'s. It reads the ledger read-only and appends nothing (D-5); `control/**` is untouched.
 *
 * WHAT IS ENFORCED (this file refuses) vs STATED (a reader must still believe it):
 *  ENFORCED here: feature-off and unknown feature values produce NO gate (D-8); a closed request field set that
 *  refuses any identity/role key (D-3); the decision-kind → control-kind mapping is frozen and kinds outside it are
 *  refused, never default-allowed (D-2/S-3); team existence is checked before caller resolution (D-4/S-5); the
 *  injected resolver is the only source of a role, and a resolution that did not happen (or names another team)
 *  cannot act (S-1); claims that contradict the resolved role or the frozen kind mapping are refused with both
 *  compared terms in the message (D-3/§9); the kernel pre-flight answers with its own codes VERBATIM (D-9).
 *  STATED ONLY here (bound elsewhere, or not at all): the byte-identity of non-enabling teams is bound by DORMANCY —
 *  `ALLOWED_CONSUMERS` is empty and `a6-pr2-lane-hygiene.test.ts` walks the tree for importers on every run — not by
 *  anything this file can observe; the equivalence with the real ControlService resolve path (a real host process)
 *  is pinned only to source text, and the real-host legs are ENV-REFUSED in `a6-pr-i1b-admission.test.ts`.
 *
 * BLOCKED-WIRING — the two authority imports this lane cannot reach, and what that changed (dated 2026-10-31,
 * memo §9: 「复用 resolveCaller 或其等价公开面；接不上就拒绝接线并点名原因」):
 *  1. `CONTROL_RESOLVER_ROLES` — memo D-2 said IMPORT the constant. The lane's own hygiene law convicts any file
 *     under this directory that even contains a `control/` relative specifier (`a6-pr2-lane-hygiene.test.ts`,
 *     `PROTECTED_PREFIXES` + the leg "imports nothing from the ARC-A protected centre"). The constant IS exported
 *     from the center's public barrel (`packages/runtime/control/index.ts:141`) — reachable-but-forbidden, which is
 *     worse than unreachable, so the lane does what PR0's lane did in the identical position: a frozen MIRROR
 *     below, and a spec leg that reads the protected source and refuses silently-diverged copies
 *     (`a6-pr0-mandate-admission.test.ts` "mirrors CONTROL_RESOLVER_ROLES exactly" is that precedent). No new kind
 *     lives here: the mirror's key set is pinned EQUAL, both directions, against the real table.
 *  2. The existing caller-resolution entry point — `resolveCaller` at `packages/runtime/admission/resolve.ts:230`
 *     (public re-export at `packages/runtime/admission/index.ts`). It is pure, same-package, cycle-free, and its
 *     leader branch is EXACTLY the §9 triple (TeamSession row + team-root binding + `LEADER_INSTANCE_ID`), so it is
 *     the lawful authority. But the lane's purity allow-list (`a6-pr2-lane-hygiene.test.ts`, the leg "does no I/O
 *     and reads no clock") admits only shared contracts, PR0's frozen vocabulary, and this lane's own modules —
 *     widening that closed regex is not one of the two amendments §7 sanctioned, and D-3's withdrawn fallback
 *     ("derive Leader from the member row") is forbidden, not deferred. So the resolver enters as an INJECTED PORT
 *     whose only lawful provider is that function, called per `admit()` — never its cached output, never a
 *     reconstruction, and the lane never imports it. The wiring file that would supply it lives outside this lane
 *     and does not exist yet: PR-I1b's wiring is BLOCKED on that named Center-Interface act, `ALLOWED_CONSUMERS`
 *     stays `[]`, and the lane ships dark exactly as PR-I1a did. A dark admission admits nothing, which is the
 *     correct default-off: the memo's own terminal ruling is that PR-I1b not landing is acceptable; two
 *     contradictory answers to "who counts as Leader" is not.
 *
 * THE FIVE RULES EVERY BRANCH FOLLOWS:
 *  - CLAIMS ARE NOT IDENTITIES (D-3, as amended by §9). A request may CARRY claims (`claimedActorKind`,
 *    `controlRequestKind`); claims never decide. Authority is the resolver's output — the durable triple, not a
 *    profile that looks leader-like. The V-1 discovery (round 1 of this PR's design) killed the earlier habit of
 *    comparing against "the Leader row", because the §9 fact is that the leader row may legitimately not exist
 *    while the leader exists; the lane keeps no such comparison and asks no such question.
 *  - NO RAW CALLER IS EVER AUTHORITY. A hand-written authority without a resolved role — including a perfectly
 *     well-shaped `ActionCaller` — is refused with `ADMISSION_CALLER_UNRESOLVED`. A resolution that THREW surfaces
 *     with its own words carried verbatim into the detail (the resolver's code is the diagnosis; this layer does
 *     not relabel it).
 *  - THE ANSWER IS NOT A CREDENTIAL (D-9). `admit()` re-runs the whole predicate on CURRENT injected state; the
 *     dispatcher must call it again at execution, and the writer re-folds and re-runs `checkAssignmentMutation`
 *     inside its own lock. If state moved between admission and execution, the refusal code is the kernel's own
 *     code — this module never invents a nicer one for someone else's rule.
 *  - NOTHING DURABLE, NO HANDLE TO MAKE IT DURABLE (D-5). `AssignmentAdmissionPorts` has no sequence handle, no
 *     put, no lock, no clock. A stray "log one admission row" cannot be typed, let alone compiled.
 *  - REFUSALS ARE ANSWERS, NEVER EXCEPTIONS. Every failure is a typed code from the closed set below (or a verbatim
 *     kernel code on pass-through); the only throw paths are inside try/catch, over ports this module does not own.
 *
 * NO I/O, NO CLOCK, NO HOST: no timestamps are read (D-7 — a `team_sessions.generation` read buys nothing here and
 * the ledger read is the fresher source), no calendar is touched, nothing outside this lane's allow-listed
 * specifiers is imported. The ledger input is the writer's OWN reader-port type, so the D-6 full-ledger law
 * (lie-by-omission is the adapter's failure and this layer cannot self-rescue) is inherited, not re-declared.
 *
 * @module review-assignment/assignment-admission
 */
import { type ReviewAssignmentFactKind, type ReviewAssignmentRefusal } from './types.js';
import type { ReviewAssignmentLedgerReaderPort } from './writer.js';
/**
 * This module's own refusal codes, closed. The memo drafted six; four were added during implementation, each with
 * a driving leg in `a6-pr-i1b-admission.test.ts` (the census leg asserts named == produced, both directions),
 * because PR-I1a's round-1 lesson is that a code a branch asserts in prose but never produces is a bug in the
 * prose. Every name keeps the `ADMISSION_` prefix so a caller can tell "admission refused" from "the kernel
 * refused" by prefix — and pass-through kernel codes deliberately keep THEIR prefix (D-9: never relabelled).
 */
export declare const ASSIGNMENT_ADMISSION_REFUSAL_CODES: readonly ["ADMISSION_DISABLED_FOR_TEAM", "ADMISSION_FEATURE_VALUE_UNKNOWN", "ADMISSION_REQUEST_MALFORMED", "ADMISSION_ROOT_UNMINTABLE", "ADMISSION_TEAM_UNKNOWN", "ADMISSION_CALLER_UNRESOLVED", "ADMISSION_CLAIM_CONTRADICTION", "ADMISSION_ROLE_NOT_RESOLVER", "ADMISSION_KIND_UNSUPPORTED", "ADMISSION_LEDGER_UNREADABLE", "ADMISSION_STALE_INTENT"];
/** One of this module's own refusal codes. */
export type AssignmentAdmissionRefusalCode = (typeof ASSIGNMENT_ADMISSION_REFUSAL_CODES)[number];
/** Kernel codes this module may return VERBATIM (D-9 pass-through): never rewritten, never wrapped. The list is
 *  exactly what `checkAssignmentMutation` can answer — the pre-flight's own vocabulary, not the kernel's whole
 *  (a code listed here that no path produces is a named-but-never-produced bug; the census leg proved this
 *  line by red on the draft's sixth entry, which the pre-flight cannot emit). */
export declare const ASSIGNMENT_ADMISSION_PASSTHROUGH_CODES: readonly string[];
/** The caller roles the caller-resolution entry point may resolve (closed three). The spec pins this list against
 *  `CALLER_ROLE_VALUES` at `packages/runtime/admission/types.ts:93`, the surface that produced it. */
export declare const ASSIGNMENT_ADMISSION_CALLER_ROLES: readonly string[];
/** The actor-kind claim vocabulary of the request layer — same words the remote params layer parses as CLAIMS
 *  (`packages/remote/src/contracts/params.ts:111`). A claim in these words is accepted, compared, and never
 *  believed. The spec pins equality against `REMOTE_MUTATION_ACTOR_KINDS`. */
export declare const ASSIGNMENT_ADMISSION_CLAIMABLE_ACTOR_KINDS: readonly string[];
/**
 * The FROZEN MIRROR of the center's `CONTROL_RESOLVER_ROLES` — see BLOCKED-WIRING 1 for why a mirror and not the
 * import D-2 wished for. The spec pins this table against the protected source BOTH ways (key set equality in both
 * directions and per-kind role lists), so a kind drift in the center turns this lane red instead of quietly
 * narrowing or widening who may decide. `user-approval → ['human']` is copied deliberately: an assignment decision
 * does not map there (see the mapping table), but the closed set is mirrored whole, not filtered to the row this
 * PR needs — filtering the mirror would be re-deciding the closed set, which D-2 forbids.
 */
export declare const ASSIGNMENT_ADMISSION_ROLE_CLOSURE: Readonly<Record<string, readonly string[]>>;
/**
 * The frozen mapping from an assignment DECISION to the control kind it is resolved under (D-2): every
 * ReviewAssignment decision is a `leader-approval` decision; no decision kind maps to `user-approval` (a reviewer
 * standing in for the user's own approval is a different product, and a request claiming it is refused as a
 * contradiction, not silently re-mapped). Keys are the decision keys of `REVIEW_ASSIGNMENT_FACT_TYPES` — NOT the
 * durable row values — and the mapping is total over those keys, so a new decision kind is a compile failure here.
 */
export declare const ASSIGNMENT_DECISION_CONTROL_KIND: Readonly<Record<ReviewAssignmentFactKind, string>>;
/** The closed request field set (D-3a). It has NO identity or role key by construction: an injected
 *  `role`/`resolverRole` is not "the wrong value of a known field", it is a refused field name, and the runtime
 *  check below enforces the set the type cannot express (the JSON arrives from the wire). The spec pins this list
 *  against the declared interface (the anti-drift pattern PR-I1a established). */
export declare const ASSIGNMENT_ADMISSION_REQUEST_FIELDS: readonly string[];
/** The closed feature values (D-8). There is no third value and no default: absence never opens the gate, and a
 *  value outside the set fails assembly rather than being read as off. */
export declare const ASSIGNMENT_ADMISSION_FEATURE_VALUES: readonly ["off", "on"];
/** The identity the transport asserted (the same closed shape the control facade validates with `isActionCaller`,
 *  `packages/runtime/control/service.ts:1033-1042` — identity has NO role field, and this module is the lane's
 *  mechanical expression of why: the role is looked up from this, never carried with it). */
export type AssignmentCallerIdentity = {
    readonly kind: 'human';
    readonly humanId: string;
} | {
    readonly kind: 'instance';
    readonly instanceId: string;
};
/** The RESOLVED caller — the output shape of the caller-resolution entry point (structural mirror of its
 *  `ResolvedCaller`; the lane cannot type-import it, same allow-list as BLOCKED-WIRING 2). A value of this shape
 *  with no resolved `role` is not "a caller with an unknown role", it is a caller that was never resolved, and it
 *  cannot act. `callerMember` is carried because the resolver carries it; this module reads exactly one fact from
 *  it — that it names the same team root the decision is addressed to. */
export interface AssignmentCallerAuthority {
    readonly role: string;
    readonly humanId?: string;
    readonly callerMember?: {
        readonly instanceId: string;
        readonly rootSessionId?: string;
    };
}
/** One proposed ReviewAssignment decision, as claimed by the requesting layer. Claims ride here; authority does
 *  not. Deep command well-formedness is deliberately NOT re-validated here — the writer's own screens remain the
 *  one shape law (a decision that passes admission and fails the writer answers with the writer's code, D-9). */
export interface AssignmentAdmissionRequest {
    /** The team the decision targets. Addressing, not identity. */
    readonly rootSessionId: string;
    readonly approvalCaseId: string;
    /** The leg the decision replaces — the kernel's leg CAS input. */
    readonly currentLegRequestId: string;
    /** Which ReviewAssignment decision this is: a key of `REVIEW_ASSIGNMENT_FACT_TYPES`. */
    readonly decisionKind: string;
    readonly targetKind: string;
    /** Required and non-empty when `targetKind` is `'instance'`; MUST be absent when it is `'leader'` — the
     *  kernel's own target law (`facts.ts:255`), restated at the door rather than discovered at the writer. */
    readonly targetInstanceId?: string;
    readonly reasonCode: string;
    readonly basedOnCaseVersion: string;
    /** A CLAIM about which epoch the decision replaces; compared against the fresh fold (S-6), never trusted. */
    readonly expectedPreviousEpoch?: number;
    /** A CLAIM in the request layer's actor vocabulary; compared against the resolved role, never trusted. */
    readonly claimedActorKind?: string;
    /** A CLAIM about the control kind this decision is resolved under; compared against the frozen mapping. */
    readonly controlRequestKind?: string;
}
/** The ports admission may reach through — all three READ-ONLY, none of them owned by this lane. */
export interface AssignmentAdmissionPorts {
    /** Team existence (D-4/V-3): implemented by the wiring as a `team_sessions.get(root)` existence read. Boolean
     *  because the record has no lifecycle column — missing and corrupt are MERGED STATE, disclosed here and bound
     *  by a spec leg, because pretending to three states would be the kind of overclaim this lane keeps being
     *  burned by. The wiring may NOT enrich this into any role statement. */
    readonly teamRootExists: (rootSessionId: string) => boolean | Promise<boolean>;
    /** THE ONE LAWFUL PROVIDER: the existing caller-resolution entry point
     *  (`resolveCaller(repositories, root, caller)` at `packages/runtime/admission/resolve.ts:230`), wrapped as a
     *  closure. The wiring supplies THAT function — not a reconstruction, not a memoised answer, and not anything
     *  that consults the blueprint leader-template equality (D-3 fallback, withdrawn by §9). It receives the
     *  freshly-minted root string and must forward it verbatim. Its throws are admission's `ADMISSION_CALLER_UNRESOLVED`
     *  with the thrown reason carried verbatim. */
    readonly resolveCaller: (rootSessionId: string, caller: AssignmentCallerIdentity) => AssignmentCallerAuthority;
    /** The full-ledger read. This is the WRITER's reader-port type, one contract for both doors (D-6): full,
     *  untruncated, un-filtered, or this fold and the writer's see different worlds and neither can tell. */
    readonly ledger: ReviewAssignmentLedgerReaderPort;
}
/** The typed answer of an admitted decision. Fields are diagnostics of WHAT was admitted, not a token to show. */
export interface AssignmentAdmissionAnswer {
    readonly ok: true;
    /** The control kind the decision mapped to (from the frozen mapping, never from a claim). */
    readonly controlRequestKind: string;
    /** The role the resolver resolved. */
    readonly resolvedRole: string;
    /** The epoch a successful execution would write, per the kernel pre-flight on the fold admission just read.
     *  Execution may legitimately refuse it anyway — see the module law "the answer is not a credential". */
    readonly nextAssignmentEpoch: number;
}
/** A refusal. `refusal` is either one of this module's own codes or a VERBATIM kernel code (pass-through). */
export interface AssignmentAdmissionRefusal {
    readonly ok: false;
    readonly refusal: AssignmentAdmissionRefusalCode | ReviewAssignmentRefusal;
    readonly detail: string;
}
export type AssignmentAdmissionOutcome = AssignmentAdmissionAnswer | AssignmentAdmissionRefusal;
/** The gate. It exists exactly when the team's config said `on` — there is no constructed-but-short-circuited
 *  object, which is what makes D-8's "not enabled" observable rather than a promise. */
export interface AssignmentAdmissionGate {
    /** Always `'on'`. Present so "which config opened this gate" is a value a caller can assert, not a comment —
     *  same trick `handoff.ts` plays with its always-empty effect set. */
    readonly feature: 'on';
    admit(request: AssignmentAdmissionRequest, caller: AssignmentCallerIdentity): Promise<AssignmentAdmissionOutcome>;
}
/** Assembly result: a gate, or the reason assembly refused. Open never throws and never half-opens. */
export type AssignmentAdmissionOpenResult = {
    readonly ok: true;
    readonly gate: AssignmentAdmissionGate;
} | {
    readonly ok: false;
    readonly refusal: 'ADMISSION_DISABLED_FOR_TEAM' | 'ADMISSION_FEATURE_VALUE_UNKNOWN';
    readonly detail: string;
};
/**
 * Open the admission gate for one team. This is the ONLY door to `admit`, and it is where the team's closed
 * config value is decided — an off team gets a typed refusal and NO gate, so "a non-enabling team's observable
 * behaviour is byte-identical" is structural: there is nothing to call. Unknown values refuse too (S-7): a typo
 * in a config is an operator defect to surface, not a silently-off team.
 */
export declare function openAssignmentAdmission(config: {
    readonly feature: unknown;
}, ports: AssignmentAdmissionPorts): AssignmentAdmissionOpenResult;
//# sourceMappingURL=assignment-admission.d.ts.map