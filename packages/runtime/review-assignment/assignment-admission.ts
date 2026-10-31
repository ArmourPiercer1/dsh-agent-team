/**
 * Alpha.6 PR-I1b (Lane 2) — the ENTRY ADMISSION layer for `ReviewAssignment` decisions.
 *
 * WHY THIS FILE EXISTS. PR-I1a shipped the one governed durable WRITER; the user ruling of 2026-10-31 (裁决二,
 * PR #513) named the other half of the split PR-I1: a ControlService-side ADMISSION that decides WHO may make a
 * decision enter that writer, while deciding NOTHING else. This module is that admission. It is not a second
 * resolution authority (memo §0): the role closure it applies is the existing `CONTROL_RESOLVER_ROLES` (its kind →
 * role lists live in `packages/runtime/control/types.ts:193-197`; and at this head the resolve path reads them at
 * `packages/runtime/control/service.ts:2622` and `:4852`, `:5228`, `:5495` — those four numbers are a dated MAP for
 * a reader (measured 2026-10-31), not a pin: no leg of this lane can distinguish a site from a file, and round 1 of
 * #522 (F-I1b1-3) measured exactly that gap — replacing the site at :2622 with a hand-copied `['leader', 'human']`
 * keeps every leg green because the other three sites still match the file-level pattern. What the pins DO pay for
 * is in the block below), the identity it trusts is whatever the
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
 *  STATED ONLY here (bound elsewhere, or not at all):
 *   - The byte-identity of non-enabling teams is bound by DORMANCY: `ALLOWED_CONSUMERS` is empty and
 *     `a6-pr2-lane-hygiene.test.ts` walks `packages/**` for importers on every run. The walk is LEXICAL and its
 *     claim stops where the instrument stops — corrected 2026-10-31, round 1 of #522 (F-I1b1-2), which found this
 *     header claiming more than the walk pays for. Precisely: it reads the file extensions it names, it matches
 *     LITERAL specifiers, and it convicts a production file whose literal relative specifier lands inside a
 *     package `test`/`tests` tree (the one hop a re-export glue needs — the shape the review planted and this
 *     file used to miss). It does NOT follow an import chain, and it cannot see a specifier held in a variable,
 *     concatenated, or rewritten by a bundler. The residual is named in the legs, not by this sentence.
 *   - The equivalence with the real ControlService resolve path is pinned in THREE ways now, and the third is a
 *     measurement rather than a comparison (round 1 of #522, F-I1b1-3, closed by the real-host run). VALUES: the
 *     mirror's kind → role tables are compared EQUAL to `CONTROL_RESOLVER_ROLES`, both directions, every kind.
 *     WORDS: the host's refusal message is pinned to the PRESENCE of the phrase `is not a resolver for kind` in
 *     `service.ts`, plus a `CONTROL_RESOLVER_ROLES [` read — not to the site that composes it, not to its format.
 *     LIVE: `tests/kits/pr-i1b-real-host/pr-i1b-real-host.mjs` boots the pinned host with this row through the
 *     public profile-patch seam and records, in `dev/agent-workflow/evidence/alpha6-pr-i1b-real-host/capture.json`,
 *     what a running host answered — `ControlService: role 'leader' is not a resolver for kind 'user-approval'
 *     (allowed: [human])` for a leader caller its own `resolveCaller` derived from durable rows, a durable decision
 *     for the human on every kind, and `TeamRuntime: no member instance 'inst-nobody' … the caller is unknown` for
 *     an unknown one. The spec compares the allowed list the host PRINTED against both tables, so this module's
 *     mirror, the center's table, and the host must now move together or a leg reddens.
 *     Residual, at its real size: on that host the leader's mutation envelope does not admit `resolve-control`, so
 *     `leader-approval` and `envelope-mutation` were answered by the envelope gate BEFORE the closure and are
 *     recorded as not-reached; the closure is measured on one (kind × role) cell and mirrored on the others. A
 *     member caller has no public ingress on a host with no model. And a host that keeps the phrase in
 *     `service.ts` while moving the composition elsewhere still passes the WORDS pin — the LIVE pin covers the
 *     cells it ran, not the file layout.
 *   - What this door does NOT do about the objects it is handed (round 1 of #522, F-I1b1-6/F-I1b1-7; each pinned
 *     by a leg, so a floor that moves has to be argued with): the `caller` argument is forwarded to
 *     `resolveCaller` EXACTLY as received — this module shape-checks nothing, while the screen that would
 *     (`isActionCaller`, `packages/runtime/control/service.ts:1033`) is module-private, upstream, and not on this
 *     path. And from the resolver's ANSWER the door reads a role and, when the member row carries one, its root:
 *     a `callerMember.instanceId` is never compared against the caller, a `humanId` echo is never compared against
 *     anything. Both belong to the wiring owner, who is the party that knows what a caller means on this host;
 *     the port doc below repeats it where the wiring gets written.
 *   - "Verbatim" is about words a thrown value CARRIES (round 1 of #522, F-I1b1-5). `describeFailure` renders an
 *     `Error` (with its `code` property when it has one), or a plain record carrying `code`/`problem`/`message`,
 *     and otherwise falls back to `typeof error` — so a resolver that throws a bare string has its words replaced
 *     by the word `string` in the detail, and the detail sentence's promise cannot be kept for a value that has
 *     no message. The leg pins the floor as it is, because the floor is a documented limit and not an aspiration.
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

import { parseRootSessionId } from '../../contracts/src/index.js'
import {
  checkAssignmentMutation,
  foldReviewAssignmentRows,
  isReviewAssignmentFactType,
} from './facts.js'
import {
  type ReviewAssignmentFactKind,
  type ReviewAssignmentRefusal,
  type ReviewAssignmentTarget,
} from './types.js'
import type { ReviewAssignmentLedgerReaderPort, ReviewAssignmentLedgerRow } from './writer.js'

// --- the closed vocabulary -------------------------------------------------------------------------------

/**
 * This module's own refusal codes, closed. The memo drafted six; four were added during implementation, each with
 * a driving leg in `a6-pr-i1b-admission.test.ts` (the census leg asserts named == produced, both directions),
 * because PR-I1a's round-1 lesson is that a code a branch asserts in prose but never produces is a bug in the
 * prose. Every name keeps the `ADMISSION_` prefix so a caller can tell "admission refused" from "the kernel
 * refused" by prefix — and pass-through kernel codes deliberately keep THEIR prefix (D-9: never relabelled).
 */
export const ASSIGNMENT_ADMISSION_REFUSAL_CODES = [
  /** The team's closed config value is `off`: assembly refuses, and there is no constructed gate to short-circuit. */
  'ADMISSION_DISABLED_FOR_TEAM',
  /** The config value is outside the closed set. A typo must NOT be read as "off" (S-7): assembly fails loudly. */
  'ADMISSION_FEATURE_VALUE_UNKNOWN',
  /** The request is not a record, misses a required field, or carries a field outside the closed set — this is
   *  where an injected `role`/`resolverRole`/identity key dies (S-2/D-3), naming the field it refused. */
  'ADMISSION_REQUEST_MALFORMED',
  /** Screen 1 of D-4/V-3: the root is not even a root session id. Its own code because the writer's lane-syntax
   *  screen and the TeamSession screen each name their own layer; the three are NOT merged into one (R-5). */
  'ADMISSION_ROOT_UNMINTABLE',
  /** Screen 2 of D-4/V-3: a mintable id that carries no TeamSession record. The V-3 three-state question is
   *  answered by the port's shape: `teamRootExists` is boolean because a `TeamSessionRecordDto` has no lifecycle
   *  field to distinguish missing from archived from corrupt — merged state, disclosed, not papered over. */
  'ADMISSION_TEAM_UNKNOWN',
  /** The resolver refused the identity (its verbatim reason rides in the detail), or what came back was not a
   *  resolved caller — a missing role means the resolution step did not happen, which is exactly the raw-claim
   *  shape D-3 forbids — or the resolved member record names a different team than the decision is addressed to. */
  'ADMISSION_CALLER_UNRESOLVED',
  /** A claim contradicts the durable world. The detail MUST name both compared terms (D-3, §9, round-2 lesson):
   *  the claim as worded, and what the durable world (resolved role / frozen mapping) actually says. */
  'ADMISSION_CLAIM_CONTRADICTION',
  /** The resolved role is not a resolver of the mapped control kind, per the closed set. Message shape follows
   *  `packages/runtime/control/service.ts:2629`: role, kind, and the allowed list. */
  'ADMISSION_ROLE_NOT_RESOLVER',
  /** The decision kind is not in the frozen mapping table (keys are the decision keys of
   *  `REVIEW_ASSIGNMENT_FACT_TYPES`; the durable row VALUES are not decision kinds — the R-1 confusion from
   *  PR-I1a round 1 is refused with the three legal keys named). Never a default-allow. */
  'ADMISSION_KIND_UNSUPPORTED',
  /** The read-only ledger answer could not be walked at all. Mirrors the writer's `…_LEDGER_UNREADABLE` in the
   *  READ domain: admission claims a different durability (nothing was even folded), so it carries its own code
   *  (round-2 lesson from PR-I1a: one code, one durability claim). */
  'ADMISSION_LEDGER_UNREADABLE',
  /** The epoch the request claims to replace is not the epoch the fresh fold stands at. A work-saving pre-check
   *  (same law as the existence check: the exact code, plus work avoided), never a guarantee. */
  'ADMISSION_STALE_INTENT',
] as const

/** One of this module's own refusal codes. */
export type AssignmentAdmissionRefusalCode = (typeof ASSIGNMENT_ADMISSION_REFUSAL_CODES)[number]

/** Kernel codes this module may return VERBATIM (D-9 pass-through): never rewritten, never wrapped. The list is
 *  exactly what `checkAssignmentMutation` can answer — the pre-flight's own vocabulary, not the kernel's whole.
 *
 *  Dated correction, round 1 of #522 (F-I1b1-1 + F-I1b1-4, 2026-10-31). This block used to say "the census leg
 *  proved this line by red on the draft's sixth entry, which the pre-flight cannot emit". Re-measured at head
 *  4e9b20a62, that is not what the file does: adding `REVIEW_ASSIGNMENT_INPUT_MALFORMED` — a real kernel code the
 *  pre-flight never returns — as a sixth member leaves the whole file green (`Tests 158 passed (158)`), because
 *  the subset pin only asks whether a member is one of the kernel's, and the census only asks whether OBSERVED
 *  codes belong to a declared vocabulary. Declaring a code has no obligation attached, so nothing proved the
 *  sentence, and the sentence was load-bearing for exactly the bug class it named.
 *
 *  What backs the sentence now, in `a6-pr-i1b-admission.test.ts`: one leg per member below, each moving the real
 *  family through the real writer and reading the answer through `admit` (code by `toBe`, the kernel's own
 *  sentence as the tail of the detail), plus a census leg comparing this list with what those call sites were
 *  observed to produce AND with the codes `checkAssignmentMutation` is written to refuse, in both directions. A
 *  seventh member with no leg is red on the census, naming the code and both possible causes. */
export const ASSIGNMENT_ADMISSION_PASSTHROUGH_CODES: readonly string[] = [
  'REVIEW_ASSIGNMENT_ROW_UNPARSEABLE',
  'REVIEW_ASSIGNMENT_ALREADY_ACTIVE',
  'REVIEW_ASSIGNMENT_NO_ACTIVE_ASSIGNMENT',
  'REVIEW_ASSIGNMENT_LEG_MISMATCH',
  'REVIEW_ASSIGNMENT_TARGET_UNCHANGED',
]

/** The caller roles the caller-resolution entry point may resolve (closed three). The spec pins this list against
 *  `CALLER_ROLE_VALUES` at `packages/runtime/admission/types.ts:93`, the surface that produced it. */
export const ASSIGNMENT_ADMISSION_CALLER_ROLES: readonly string[] = ['human', 'leader', 'member']

/** The actor-kind claim vocabulary of the request layer — same words the remote params layer parses as CLAIMS
 *  (`packages/remote/src/contracts/params.ts:111`). A claim in these words is accepted, compared, and never
 *  believed. The spec pins equality against `REMOTE_MUTATION_ACTOR_KINDS`. */
export const ASSIGNMENT_ADMISSION_CLAIMABLE_ACTOR_KINDS: readonly string[] = ['human', 'leader', 'member']

/**
 * The FROZEN MIRROR of the center's `CONTROL_RESOLVER_ROLES` — see BLOCKED-WIRING 1 for why a mirror and not the
 * import D-2 wished for. The spec pins this table against the protected source BOTH ways (key set equality in both
 * directions and per-kind role lists), so a kind drift in the center turns this lane red instead of quietly
 * narrowing or widening who may decide. `user-approval → ['human']` is copied deliberately: an assignment decision
 * does not map there (see the mapping table), but the closed set is mirrored whole, not filtered to the row this
 * PR needs — filtering the mirror would be re-deciding the closed set, which D-2 forbids.
 */
export const ASSIGNMENT_ADMISSION_ROLE_CLOSURE: Readonly<Record<string, readonly string[]>> = Object.freeze({
  'leader-approval': Object.freeze(['leader', 'human']),
  'user-approval': Object.freeze(['human']),
  'envelope-mutation': Object.freeze(['leader', 'human']),
})

/**
 * The frozen mapping from an assignment DECISION to the control kind it is resolved under (D-2): every
 * ReviewAssignment decision is a `leader-approval` decision; no decision kind maps to `user-approval` (a reviewer
 * standing in for the user's own approval is a different product, and a request claiming it is refused as a
 * contradiction, not silently re-mapped). Keys are the decision keys of `REVIEW_ASSIGNMENT_FACT_TYPES` — NOT the
 * durable row values — and the mapping is total over those keys, so a new decision kind is a compile failure here.
 */
export const ASSIGNMENT_DECISION_CONTROL_KIND: Readonly<Record<ReviewAssignmentFactKind, string>> = Object.freeze({
  created: 'leader-approval',
  transferred: 'leader-approval',
  retired: 'leader-approval',
})

/** The closed request field set (D-3a). It has NO identity or role key by construction: an injected
 *  `role`/`resolverRole` is not "the wrong value of a known field", it is a refused field name, and the runtime
 *  check below enforces the set the type cannot express (the JSON arrives from the wire). The spec pins this list
 *  against the declared interface (the anti-drift pattern PR-I1a established). */
export const ASSIGNMENT_ADMISSION_REQUEST_FIELDS: readonly string[] = [
  'rootSessionId',
  'approvalCaseId',
  'currentLegRequestId',
  'decisionKind',
  'targetKind',
  'targetInstanceId',
  'reasonCode',
  'basedOnCaseVersion',
  'expectedPreviousEpoch',
  'claimedActorKind',
  'controlRequestKind',
]

/** The closed feature values (D-8). There is no third value and no default: absence never opens the gate, and a
 *  value outside the set fails assembly rather than being read as off. */
export const ASSIGNMENT_ADMISSION_FEATURE_VALUES = ['off', 'on'] as const

// --- the closed shapes ------------------------------------------------------------------------------------

/** The identity the transport asserted (the same closed shape the control facade validates with `isActionCaller`,
 *  `packages/runtime/control/service.ts:1033-1042` — identity has NO role field, and this module is the lane's
 *  mechanical expression of why: the role is looked up from this, never carried with it). */
export type AssignmentCallerIdentity =
  | { readonly kind: 'human'; readonly humanId: string }
  | { readonly kind: 'instance'; readonly instanceId: string }

/** The RESOLVED caller — the output shape of the caller-resolution entry point (structural mirror of its
 *  `ResolvedCaller`; the lane cannot type-import it, same allow-list as BLOCKED-WIRING 2). A value of this shape
 *  with no resolved `role` is not "a caller with an unknown role", it is a caller that was never resolved, and it
 *  cannot act. `callerMember` is carried because the resolver carries it; this module reads exactly one fact from
 *  it — that it names the same team root the decision is addressed to. */
export interface AssignmentCallerAuthority {
  readonly role: string
  readonly humanId?: string
  readonly callerMember?: { readonly instanceId: string; readonly rootSessionId?: string }
}

/** One proposed ReviewAssignment decision, as claimed by the requesting layer. Claims ride here; authority does
 *  not. Deep command well-formedness is deliberately NOT re-validated here — the writer's own screens remain the
 *  one shape law (a decision that passes admission and fails the writer answers with the writer's code, D-9). */
export interface AssignmentAdmissionRequest {
  /** The team the decision targets. Addressing, not identity. */
  readonly rootSessionId: string
  readonly approvalCaseId: string
  /** The leg the decision replaces — the kernel's leg CAS input. */
  readonly currentLegRequestId: string
  /** Which ReviewAssignment decision this is: a key of `REVIEW_ASSIGNMENT_FACT_TYPES`. */
  readonly decisionKind: string
  readonly targetKind: string
  /** Required and non-empty when `targetKind` is `'instance'`; MUST be absent when it is `'leader'` — the
   *  kernel's own target law (`facts.ts:255`), restated at the door rather than discovered at the writer. */
  readonly targetInstanceId?: string
  readonly reasonCode: string
  readonly basedOnCaseVersion: string
  /** A CLAIM about which epoch the decision replaces; compared against the fresh fold (S-6), never trusted. */
  readonly expectedPreviousEpoch?: number
  /** A CLAIM in the request layer's actor vocabulary; compared against the resolved role, never trusted. */
  readonly claimedActorKind?: string
  /** A CLAIM about the control kind this decision is resolved under; compared against the frozen mapping. */
  readonly controlRequestKind?: string
}

/** The ports admission may reach through — all three READ-ONLY, none of them owned by this lane. */
export interface AssignmentAdmissionPorts {
  /** Team existence (D-4/V-3): implemented by the wiring as a `team_sessions.get(root)` existence read. Boolean
   *  because the record has no lifecycle column — missing and corrupt are MERGED STATE, disclosed here and bound
   *  by a spec leg, because pretending to three states would be the kind of overclaim this lane keeps being
   *  burned by. The wiring may NOT enrich this into any role statement. */
  readonly teamRootExists: (rootSessionId: string) => boolean | Promise<boolean>
  /** THE ONE LAWFUL PROVIDER: the existing caller-resolution entry point
   *  (`resolveCaller(repositories, root, caller)` at `packages/runtime/admission/resolve.ts:230`), wrapped as a
   *  closure. The wiring supplies THAT function — not a reconstruction, not a memoised answer, and not anything
   *  that consults the blueprint leader-template equality (D-3 fallback, withdrawn by §9). It receives the
   *  freshly-minted root string and must forward it verbatim. Its throws are admission's `ADMISSION_CALLER_UNRESOLVED`
   *  with the thrown reason carried verbatim.
   *
   *  HOW FAR "verbatim" REACHES, measured rather than promised (round 1 of #522, F-I1b1-5, 2026-10-31): an `Error`
   *  contributes its message, plus its `code` property when it has one (which is how `TeamRuntimeError` carries its
   *  diagnosis); a plain record contributes `code`/`problem`/`message`; ANYTHING ELSE contributes only its `typeof`
   *  — a resolver that throws `'no route'` is reported as `… verbatim: string`, and the words are gone. Throw
   *  Errors from this port, or accept that the diagnosis becomes a type name. `a6-pr-i1b-admission.test.ts` pins
   *  all of that as behaviour, including the primitive case, as a floor and not as a wish.
   *
   *  WHAT THE WIRING OWNS AND THIS DOOR DELIBERATELY DOES NOT CHECK (same round, F-I1b1-6 + F-I1b1-7). The door
   *  forwards the `caller` object to this function EXACTLY as it received it: it shape-checks nothing, because the
   *  validator for that (`isActionCaller`, `packages/runtime/control/service.ts:1033`) is module-private, sits
   *  upstream of the resolver, and no path out of this door reaches it. Measured consequence, pinned by its
   *  own leg: `{ kind: 'alien', instanceId: LEADER_INSTANCE_ID }` and `{ kind: 'human' }` with no `humanId` both
   *  resolve to a role through the real resolver, and this door admits them on the strength of the role. So the
   *  wiring MUST apply the transport's caller screen before it calls, or hand over a caller it built from a typed
   *  source — nobody downstream will notice. Symmetrically, from the ANSWER the door reads `role` (against the
   *  closed three), and `callerMember.rootSessionId` against the minted root when the row carries one, and nothing
   *  else: a `callerMember.instanceId` is not compared with the caller, a `humanId` echo is not compared with
   *  anything. Those comparisons need facts this lane does not have (what the caller claimed, what a member row
   *  means on this host), so they are the wiring's. If a floor below moves, move this paragraph with it and name
   *  the party that now owns the check. */
  readonly resolveCaller: (rootSessionId: string, caller: AssignmentCallerIdentity) => AssignmentCallerAuthority
  /** The full-ledger read. This is the WRITER's reader-port type, one contract for both doors (D-6): full,
   *  untruncated, un-filtered, or this fold and the writer's see different worlds and neither can tell. */
  readonly ledger: ReviewAssignmentLedgerReaderPort
}

/** The typed answer of an admitted decision. Fields are diagnostics of WHAT was admitted, not a token to show. */
export interface AssignmentAdmissionAnswer {
  readonly ok: true
  /** The control kind the decision mapped to (from the frozen mapping, never from a claim). */
  readonly controlRequestKind: string
  /** The role the resolver resolved. */
  readonly resolvedRole: string
  /** The epoch a successful execution would write, per the kernel pre-flight on the fold admission just read.
   *  Execution may legitimately refuse it anyway — see the module law "the answer is not a credential". */
  readonly nextAssignmentEpoch: number
}

/** A refusal. `refusal` is either one of this module's own codes or a VERBATIM kernel code (pass-through). */
export interface AssignmentAdmissionRefusal {
  readonly ok: false
  readonly refusal: AssignmentAdmissionRefusalCode | ReviewAssignmentRefusal
  readonly detail: string
}

export type AssignmentAdmissionOutcome = AssignmentAdmissionAnswer | AssignmentAdmissionRefusal

/** The gate. It exists exactly when the team's config said `on` — there is no constructed-but-short-circuited
 *  object, which is what makes D-8's "not enabled" observable rather than a promise. */
export interface AssignmentAdmissionGate {
  /** Always `'on'`. Present so "which config opened this gate" is a value a caller can assert, not a comment —
   *  same trick `handoff.ts` plays with its always-empty effect set. */
  readonly feature: 'on'
  admit(request: AssignmentAdmissionRequest, caller: AssignmentCallerIdentity): Promise<AssignmentAdmissionOutcome>
}

/** Assembly result: a gate, or the reason assembly refused. Open never throws and never half-opens. */
export type AssignmentAdmissionOpenResult =
  | { readonly ok: true; readonly gate: AssignmentAdmissionGate }
  | {
      readonly ok: false
      readonly refusal: 'ADMISSION_DISABLED_FOR_TEAM' | 'ADMISSION_FEATURE_VALUE_UNKNOWN'
      readonly detail: string
    }

// --- assembly (D-8) ---------------------------------------------------------------------------------------

/**
 * Open the admission gate for one team. This is the ONLY door to `admit`, and it is where the team's closed
 * config value is decided — an off team gets a typed refusal and NO gate, so "a non-enabling team's observable
 * behaviour is byte-identical" is structural: there is nothing to call. Unknown values refuse too (S-7): a typo
 * in a config is an operator defect to surface, not a silently-off team.
 */
export function openAssignmentAdmission(
  config: { readonly feature: unknown },
  ports: AssignmentAdmissionPorts,
): AssignmentAdmissionOpenResult {
  if (config.feature === 'off') {
    return {
      ok: false,
      refusal: 'ADMISSION_DISABLED_FOR_TEAM',
      detail: 'assignment admission is off for this team: no gate is constructed, and nothing in this process may route a ReviewAssignment decision through this lane',
    }
  }
  if (config.feature !== 'on') {
    return {
      ok: false,
      refusal: 'ADMISSION_FEATURE_VALUE_UNKNOWN',
      detail: `assignment admission feature value must be one of [${ASSIGNMENT_ADMISSION_FEATURE_VALUES.join(', ')}] (got ${JSON.stringify(config.feature) ?? typeof config.feature}): a value outside the closed set fails assembly rather than being read as off`,
    }
  }
  return { ok: true, gate: { feature: 'on', admit: (request, caller) => admit(ports, request, caller) } }
}

// --- the predicate ----------------------------------------------------------------------------------------

/**
 * Run the whole admission predicate against CURRENT injected state. Every call re-reads and re-resolves; nothing
 * is cached, because an answer is not a credential (D-9). The order is the disclosed law of this module and each
 * step's code names only its own layer:
 *
 *   1 request shape (closed field set) → 2 decision-kind mapping → 3 root mint → 4 team existence
 *   → 5 caller resolution → 6 claims vs durable world → 7 role closure → 8 kernel pre-flight (verbatim)
 *   → 9 stale-intent (epoch claim).
 *
 * Existence before resolution (S-5): against a root that is not a team, the resolver's answer is about a world
 * that does not exist; the exact code is the team's, and no resolver or ledger work is spent. Role closure before
 * the kernel (S-1): a non-resolver does not get a fold's worth of case state as a side effect of being refused.
 */
async function admit(
  ports: AssignmentAdmissionPorts,
  request: AssignmentAdmissionRequest,
  caller: AssignmentCallerIdentity,
): Promise<AssignmentAdmissionOutcome> {
  // 1. The closed request shape (S-2). An identity/role key is refused BY NAME, and the refusal says so.
  const malformed = screenRequest(request)
  if (malformed !== null) return { ok: false, refusal: 'ADMISSION_REQUEST_MALFORMED', detail: malformed }

  // 2. The frozen decision-kind mapping (S-3). Kinds outside it refuse — never default-allow.
  if (!Object.prototype.hasOwnProperty.call(ASSIGNMENT_DECISION_CONTROL_KIND, request.decisionKind)) {
    return {
      ok: false,
      refusal: 'ADMISSION_KIND_UNSUPPORTED',
      detail: `decision kind '${request.decisionKind}' is not in the frozen mapping (keys: ${Object.keys(ASSIGNMENT_DECISION_CONTROL_KIND).join(', ')}); these are decision keys, not durable row values — 'review-assignment-…' names rows, this table maps decisions`,
    }
  }
  const decisionKind = request.decisionKind as ReviewAssignmentFactKind
  const controlRequestKind = ASSIGNMENT_DECISION_CONTROL_KIND[decisionKind]

  // 3. Screen 1 (V-3): an id this repository can never own.
  let root: string
  try {
    root = parseRootSessionId(request.rootSessionId)
  } catch (error) {
    return {
      ok: false,
      refusal: 'ADMISSION_ROOT_UNMINTABLE',
      detail: `the root is not a root session id, so it can be no team's root: ${describeFailure(error)}`,
    }
  }

  // 4. Screen 2 (V-3): a mintable id carrying no TeamSession record. Before any resolver or ledger work (S-5).
  let teamKnown: boolean
  try {
    teamKnown = await ports.teamRootExists(root)
  } catch (error) {
    return {
      ok: false,
      refusal: 'ADMISSION_TEAM_UNKNOWN',
      detail: `the team-existence read refused, and an answer this module cannot get is not an answer it may assume: ${describeFailure(error)}`,
    }
  }
  if (!teamKnown) {
    return {
      ok: false,
      refusal: 'ADMISSION_TEAM_UNKNOWN',
      detail: `no TeamSession record exists for root '${root}': admission refuses before the caller-resolution entry point runs, so the caller is neither trusted nor accused — the root is the problem (the writer's lane-syntax screen already passed, this is the existence screen, and only the existence screen)`,
    }
  }

  // 5. The existing caller-resolution entry point — the only source of a role this layer believes (S-1, §9).
  let resolved: AssignmentCallerAuthority
  try {
    resolved = ports.resolveCaller(root, caller)
  } catch (error) {
    return {
      ok: false,
      refusal: 'ADMISSION_CALLER_UNRESOLVED',
      detail: `the caller-resolution entry point refused this caller, and its words travel verbatim: ${describeFailure(error)}`,
    }
  }
  if (!isPlainRecord(resolved) || !(ASSIGNMENT_ADMISSION_CALLER_ROLES as readonly string[]).includes(
    typeof resolved['role'] === 'string' ? (resolved['role'] as string) : '',
  )) {
    return {
      ok: false,
      refusal: 'ADMISSION_CALLER_UNRESOLVED',
      detail: 'the injected resolver returned a caller with no role from the closed set — identity without a resolved role is a claim that never went through the caller-resolution entry point, and a raw ActionCaller (which has no role field at all) is never authority here',
    }
  }
  const role = resolved.role as string
  const member = isPlainRecord(resolved['callerMember']) ? (resolved['callerMember'] as Record<string, unknown>) : undefined
  if (member !== undefined && typeof member['rootSessionId'] === 'string' && member['rootSessionId'] !== root) {
    return {
      ok: false,
      refusal: 'ADMISSION_CALLER_UNRESOLVED',
      detail: `the resolved caller's member record names root '${member['rootSessionId']}' but the decision is addressed to root '${root}': a caller resolved for one team is not a caller of another (S-4)`,
    }
  }

  // 6. Claims vs the durable world (D-3/§9). Both refusals MUST name both compared terms.
  if (request.claimedActorKind !== undefined && request.claimedActorKind !== role) {
    return {
      ok: false,
      refusal: 'ADMISSION_CLAIM_CONTRADICTION',
      detail: `compared the request's own claim claimedActorKind='${request.claimedActorKind}' against the role '${role}' the caller-resolution entry point resolved: a claim is not an identity, and the durable world wins`,
    }
  }
  if (request.controlRequestKind !== undefined && request.controlRequestKind !== controlRequestKind) {
    return {
      ok: false,
      refusal: 'ADMISSION_CLAIM_CONTRADICTION',
      detail: `compared the request's own claim controlRequestKind='${request.controlRequestKind}' against the frozen mapping for decision kind '${decisionKind}', which is '${controlRequestKind}': the kind is decided by the mapping table, not by the request`,
    }
  }

  // 7. Role closure from the mirrored closed set (S-1). Message follows the resolve path's shape.
  const allowed = Object.prototype.hasOwnProperty.call(ASSIGNMENT_ADMISSION_ROLE_CLOSURE, controlRequestKind)
    ? ASSIGNMENT_ADMISSION_ROLE_CLOSURE[controlRequestKind]
    : undefined
  if (allowed === undefined) {
    return {
      ok: false,
      refusal: 'ADMISSION_ROLE_NOT_RESOLVER',
      detail: `the frozen mapping names control kind '${controlRequestKind}' but the closed role set has no entry for it: the two pinned tables disagree, and disagreement refuses`,
    }
  }
  if (!allowed.includes(role)) {
    return {
      ok: false,
      refusal: 'ADMISSION_ROLE_NOT_RESOLVER',
      detail: `role '${role}' is not a resolver for kind '${controlRequestKind}' (allowed: [${allowed.join(', ')}])`,
    }
  }

  // 8. Kernel pre-flight on a fresh fold (D-9): the same pure rules the writer will apply, and THEIR codes.
  let rows: readonly unknown[]
  try {
    rows = ports.ledger.list()
  } catch (error) {
    return { ok: false, refusal: 'ADMISSION_LEDGER_UNREADABLE', detail: `the read-only ledger refused to answer: ${describeFailure(error)}` }
  }
  if (!Array.isArray(rows)) {
    return {
      ok: false,
      refusal: 'ADMISSION_LEDGER_UNREADABLE',
      detail: `the read-only ledger did not answer with an array (got ${typeof rows}): an answer that cannot be walked folds nothing, and this module reports that instead of assuming an empty world`,
    }
  }
  const familyRows: ReviewAssignmentLedgerRow[] = []
  for (const row of rows) {
    if (!isPlainRecord(row)) {
      return {
        ok: false,
        refusal: 'ADMISSION_LEDGER_UNREADABLE',
        detail: `the ledger answer contained a non-record entry at index ${String(rows.indexOf(row))}: this module reads the ledger the writer reads it, and an unwalkable answer folds nothing`,
      }
    }
    const record = row as { readonly sequence: unknown; readonly rootSessionId: unknown; readonly factType: unknown; readonly payload: unknown }
    if (typeof record.factType !== 'string' || !isReviewAssignmentFactType(record.factType)) continue
    if (record.rootSessionId !== root) continue
    // A row filed under this root whose payload names another team is NOT screened away here: the fold already
    // answers for that shape with its own `REVIEW_ASSIGNMENT_CROSS_TEAM_ROW` diagnostic, which makes the state
    // unreconciled and reaches execution as the kernel's own refusal. Screening it here with an admission-shaped
    // code would be the relabelling D-9 forbids, and it would also let a lying adapter look honest: only the
    // full-ledger read this port demands (D-6) makes the fold see the foreign row at all.
    familyRows.push({
      sequence: record.sequence as number,
      rootSessionId: record.rootSessionId as string,
      factType: record.factType,
      payload: record.payload as Record<string, unknown>,
    })
  }
  const target: ReviewAssignmentTarget = request.targetKind === 'leader' ? { kind: 'leader' } : { kind: 'instance', instanceId: request.targetInstanceId as string }
  const state = foldReviewAssignmentRows(
    familyRows.map((row) => ({ ledgerSequence: row.sequence, factType: row.factType, payload: row.payload })),
    root,
    request.approvalCaseId,
  )
  const preflight = checkAssignmentMutation(state, decisionKind, target, request.currentLegRequestId)
  if (!preflight.ok) {
    // Verbatim pass-through (D-9), enriched the way PR-I1a round 2 demanded: an unreconciled fold says WHICH
    // diagnostic codes and WHICH rows made it so — a caller told only "the fold is unreconciled" would have to
    // re-read the whole ledger to find the row to repair.
    const diagnosis = state.unreconciled
      ? ` (${[...new Set(state.diagnostics.map((diagnostic) => diagnostic.refusal))].join(', ')} at [${foldHandles(state.diagnostics)}])`
      : ''
    return { ok: false, refusal: preflight.refusal, detail: `the kernel pre-flight (the same rule the writer applies inside its lock) refused${diagnosis}: ${preflight.detail}` }
  }

  // 9. The epoch claim (S-6's pre-check twin of D-4's existence check): exact code, work avoided, no guarantee.
  if (request.expectedPreviousEpoch !== undefined && request.expectedPreviousEpoch !== preflight.value.expectedPreviousEpoch) {
    return {
      ok: false,
      refusal: 'ADMISSION_STALE_INTENT',
      detail: `compared the request's claimed expectedPreviousEpoch ${String(request.expectedPreviousEpoch)} against the epoch the fresh fold stands at, ${String(preflight.value.expectedPreviousEpoch)}: the state this decision was drafted against has moved`,
    }
  }

  return { ok: true, controlRequestKind, resolvedRole: role, nextAssignmentEpoch: preflight.value.assignmentEpoch }
}

// --- request screen -----------------------------------------------------------------------------------------

/**
 * The closed-shape screen (D-3a/S-2). Unknown fields are refused BY NAME — `role` and `resolverRole` get an extra
 * sentence because the honest interpretation of those two names is not "malformed" but "someone tried to hand
 * authority through the request". Required fields must be non-empty strings; the target follows the kernel's
 * closed target law (`instance` names a member and needs the id, `leader` forbids one);
 * `expectedPreviousEpoch` is a non-negative safe integer when present; claims are screened to the claim
 * vocabulary so a claim in NO known vocabulary is malformed rather than silently unmatched. Deep
 * well-formedness is the writer's law, not this module's (D-9).
 */
function screenRequest(request: AssignmentAdmissionRequest): string | null {
  if (!isPlainRecord(request)) return 'the request is not a plain record, so no field set can be checked'
  const fields = Object.keys(request)
  const unknown = fields.filter((field) => !ASSIGNMENT_ADMISSION_REQUEST_FIELDS.includes(field))
  if (unknown.length > 0) {
    const identityAttempt = unknown.some((field) => field === 'role' || field === 'resolverRole' || field === 'actor' || field === 'identity')
    return `fields outside the closed request set: [${unknown.join(', ')}] — this layer accepts no field outside [${ASSIGNMENT_ADMISSION_REQUEST_FIELDS.join(', ')}]${
      identityAttempt
        ? ', and identity or role is not a request field at all: it is resolved by the caller-resolution entry point, never claimed here'
        : ''
    }`
  }
  for (const field of ['rootSessionId', 'approvalCaseId', 'currentLegRequestId', 'decisionKind', 'targetKind', 'reasonCode', 'basedOnCaseVersion'] as const) {
    if (typeof request[field] !== 'string' || request[field].length === 0) return `field '${field}' must be a non-empty string`
  }
  // The target follows the kernel's closed target law, not a narrower habit: `instance` names a member,
  // `leader` names the Leader and carries NO instance id (`facts.ts` refuses a leader row that names one,
  // line 255-256) — an admission that demanded an instance here would refuse a legal leader-targeted
  // retirement and answer for it with a malformed-request code, which is this layer contradicting the layer
  // it exists to admit into.
  if (request.targetKind !== 'instance' && request.targetKind !== 'leader') {
    return `field 'targetKind' must be 'instance' or 'leader', the kernel's closed target kinds (got ${JSON.stringify(request.targetKind) ?? typeof request.targetKind})`
  }
  if (request.targetKind === 'instance' && (typeof request.targetInstanceId !== 'string' || request.targetInstanceId.length === 0)) {
    return `field 'targetInstanceId' is required and non-empty when targetKind is 'instance'`
  }
  if (request.targetKind === 'leader' && request.targetInstanceId !== undefined) {
    return `field 'targetInstanceId' must be absent when targetKind is 'leader' — the durable row for a leader target carries a null instance id, and a claim that names both is a contradiction before it is a request`
  }
  if (request.expectedPreviousEpoch !== undefined && (!Number.isSafeInteger(request.expectedPreviousEpoch) || request.expectedPreviousEpoch < 0)) {
    return `field 'expectedPreviousEpoch' must be a non-negative safe integer when present (got ${JSON.stringify(request.expectedPreviousEpoch) ?? typeof request.expectedPreviousEpoch})`
  }
  if (request.claimedActorKind !== undefined && !(ASSIGNMENT_ADMISSION_CLAIMABLE_ACTOR_KINDS as readonly string[]).includes(request.claimedActorKind)) {
    return `field 'claimedActorKind' is a claim in the request layer's closed actor vocabulary [${ASSIGNMENT_ADMISSION_CLAIMABLE_ACTOR_KINDS.join(', ')}] — a value outside it is not a weaker claim, it is a malformed one`
  }
  if (request.controlRequestKind !== undefined && typeof request.controlRequestKind !== 'string') {
    return `field 'controlRequestKind', when present, must be a string claim compared against the frozen mapping`
  }
  return null
}

// --- local helpers ------------------------------------------------------------------------------------------

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Fold row handles for the refusal string, capped at eight — the writer's rule (`rowHandles`), restated here
 *  rather than imported because it is not exported and the lane's module law is that shared helpers get
 *  exported when a second caller appears, which this comment is reporting. */
function foldHandles(diagnostics: readonly { factType: string; ledgerSequence: number }[]): string {
  const shown = diagnostics.slice(0, 8).map((diagnostic) => `${diagnostic.factType}@${String(diagnostic.ledgerSequence)}`)
  return shown.length < diagnostics.length ? `${shown.join(', ')}, …` : shown.join(', ')
}

/**
 * Render an unknown thrown value readably — the writer learned this the hard way (PR-I1a round 2, INFO-1):
 * `error.message` alone prints "(object)" for the composed adapters that refuse with a `code` and a `problem`
 * rather than an `Error`, and the verbatim-transport promise this module makes is worth nothing at the one moment
 * a human is reading the string.
 *
 * The last line is the floor, and it is stated as a floor (round 1 of #522, F-I1b1-5, 2026-10-31): a thrown value
 * with no message, no code and no problem — a bare string, a number, `null` — renders as its `typeof`, so the
 * detail carries the WORDS `string` or `object` instead of whatever the port tried to say. There is nothing to
 * extract from a primitive, and inventing a diagnosis for somebody else's throw is not this layer's to do; the
 * `resolveCaller` port doc tells the wiring to throw Errors, and the spec pins this behaviour as it is.
 */
function describeFailure(error: unknown): string {
  if (error instanceof Error) {
    // The typed errors this port's lawful provider throws carry their diagnosis in a closed `code` PROPERTY,
    // not in the message (`TeamRuntimeError` at `packages/runtime/admission/errors.ts:187` is one), and the
    // verbatim-transport promise is worth nothing if the transport drops the only stable token.
    const code = (error as { code?: unknown }).code
    return typeof code === 'string' ? `${code}: ${error.message}` : error.message
  }
  if (isPlainRecord(error)) {
    const parts = ['code', 'problem', 'message']
      .map((field) => (typeof error[field] === 'string' ? (error[field] as string) : undefined))
      .filter((part): part is string => part !== undefined && part.length > 0)
    if (parts.length > 0) return parts.join(' — ')
  }
  return typeof error
}
