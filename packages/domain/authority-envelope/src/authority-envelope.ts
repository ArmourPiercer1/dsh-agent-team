/**
 * The SHARED authority-envelope grammar and effective-ceiling algebra
 * (ADR A3-9, spec §5.2/§5.3/§24.2; plan Task 1 lane B).
 *
 * WHY THIS MODULE EXISTS AS A LEAF. Alpha.3 grew the same envelope grammar
 * twice — once in `runtime/governance/permission-mutation.ts` (the canonical
 * runtime shape, `{ kind, resource }`) and once in `domain/blueprint` (the
 * config/AST shape, `{ kind, path | fingerprint }`) — and Alpha.4 adds a THIRD
 * carrier (`teamHardEnvelope`). ADR A3-9 places the shared grammar in
 * `packages/domain/authority-envelope/`, never in `runtime/governance/`,
 * because the Blueprint domain layer must not import the runtime layer to
 * describe its own document. This module is therefore a LEAF: it imports
 * nothing at all — no runtime, no storage, no `node:*`, not even a sibling
 * domain module. `packages/runtime` consumes IT (the direction ADR A2-3
 * allows), and the direction is pinned by `a3p3-governance-lane-hygiene.test.ts`.
 *
 * THE LAW THIS FILE ENCODES (ADR A1-4, the one that decides the phase):
 *
 *   the EXPANSION plane answers "does this document AUTHORIZE it?" —
 *     no matching rule ⇒ NO AUTHORITY (`no-authority`);
 *   the APPROVAL plane answers "does this document RESTRICT it?" —
 *     no matching rule ⇒ NO NARROWING (the identity, `decided(allow)`).
 *
 * The two functions below share the matching walk and differ in exactly one
 * decision — what absence means — because that is the only place they may
 * differ. Folding them into one function, or `min()`-ing their results, makes a
 * documented `teamHardEnvelope: { rules: [] }` dead-lock every Leader approval
 * (ADR A1-4, "explicitly rejected alternative").
 *
 * WHAT LIVES ELSEWHERE, deliberately:
 *  - canonical key manufacture and the AST→runtime mapping: `domain` performs
 *    no filesystem work and manufactures no canonical key (ADR A2-3), so the
 *    ONE canonicalization is `buildAuthorityEnvelope` in
 *    `runtime/src/plugin/permission-plane.ts` (ADR A3-9 correction X5-E2);
 *  - document field closedness, length bounds, and the version gate: the
 *    Blueprint validator, which owns the hash-bound document;
 *  - `mayReview`: spec §7.4's other function consumes approval-case data that
 *    does not exist until PR2/PR4 (correction X5-E1), so it is absent here
 *    rather than faked.
 *
 * @module @dsh-agent-team/domain/authority-envelope/authority-envelope
 */

// ---------------------------------------------------------------------------
// The vocabularies (mirrored from their owners, pinned by test — see below)
// ---------------------------------------------------------------------------

/**
 * The effect ladder, ordered as its owners order it (storage's
 * `PERMISSION_OVERLAY_EFFECT_VALUES` declares `allow, ask, deny`).
 *
 * MIRRORED, NOT IMPORTED: `packages/domain` may not reach into
 * `packages/storage`, so the re-declaration is pinned structurally by
 * `a4p1-authority-envelope.test.ts` (mutual assignability both ways) and by
 * identity on the precedence object. A constraint that is not an identity is
 * allowed to be mirrored when the mirror is checked — the rule
 * `a3p3-governance-lane-hygiene.test.ts:331-343` records.
 */
export const AUTHORITY_EFFECT_VALUES = ['allow', 'ask', 'deny'] as const

/** One effect on the `deny < ask < allow` ladder. */
export type AuthorityEffect = (typeof AUTHORITY_EFFECT_VALUES)[number]

/**
 * The ladder's rank, and THE most load-bearing object in the governance lane:
 * `PERMISSION_EFFECT_PRECEDENCE` in the runtime kernel is an ALIAS of this
 * exact object, and `a3p3-governance-lane-hygiene.test.ts:77` pins them by
 * `toBe` (object identity). Freezing it is what makes the pin meaningful: a
 * module that re-created the table could no longer pass.
 */
export const AUTHORITY_EFFECT_PRECEDENCE = Object.freeze({
  deny: 0,
  ask: 1,
  allow: 2,
} as const satisfies Record<AuthorityEffect, number>)

/** The closed matcher kinds (no `any` in this grammar, ever). */
export const AUTHORITY_MATCHER_KINDS = ['exact', 'subtree', 'fingerprint'] as const

/** One matcher kind. */
export type AuthorityMatcherKind = (typeof AUTHORITY_MATCHER_KINDS)[number]

/**
 * The operation classes an authority rule may name. MIRRORED from
 * `domain/blueprint/src/schema.ts` (`PERMISSION_TOOL_NAMES`) and pinned against
 * it by `a4p1-authority-envelope.test.ts` — mirrored so this module stays the
 * dependency leaf (the Blueprint schema may not be reachable from the grammar
 * that describes it), pinned so a drift is red rather than a silent widening.
 */
export const AUTHORITY_OPERATION_CLASSES = [
  'read',
  'read_image',
  'write',
  'edit',
  'lsp',
  'bash',
  'pwsh',
] as const

/** One operation class. */
export type AuthorityOperationClass = (typeof AUTHORITY_OPERATION_CLASSES)[number]

/**
 * The shell classes: the resource is a canonical operation FINGERPRINT carried
 * verbatim, never a path (spec §3.3 — exec stays exact, no subtree, no `any`).
 */
export const AUTHORITY_SHELL_OPERATION_CLASSES = ['bash', 'pwsh'] as const

/** Whether one operation class is a shell class (and so fingerprint-only). */
export function isShellOperationClass(operationClass: string): boolean {
  return (AUTHORITY_SHELL_OPERATION_CLASSES as readonly string[]).includes(operationClass)
}

// ---------------------------------------------------------------------------
// TWO shapes, TWO names (correction X5-E2)
// ---------------------------------------------------------------------------

/**
 * The AST/config matcher — the shape a HASH-BOUND DOCUMENT carries: a file
 * matcher declares a `path`, a shell matcher declares a `fingerprint`.
 *
 * Mutually assignable with PR0's frozen durable node
 * `GovernanceProposalEnvelopeAst` (`runtime/governance/proposal-store.ts:184-187`)
 * IN BOTH DIRECTIONS — the pin lives in `a4p1-authority-envelope.test.ts`.
 */
export type AuthorityEnvelopeAstMatcher =
  | { readonly kind: 'exact'; readonly path: string }
  | { readonly kind: 'subtree'; readonly path: string }
  | { readonly kind: 'fingerprint'; readonly fingerprint: string }

/** One rule in its DECLARED (AST) shape. */
export interface AuthorityEnvelopeRuleAst {
  readonly operationClass: string
  readonly matcher: AuthorityEnvelopeAstMatcher
  readonly maximumEffect: AuthorityEffect
}

/** One authority document in its DECLARED (AST) shape. */
export interface AuthorityEnvelopeAst {
  readonly rules: readonly AuthorityEnvelopeRuleAst[]
}

/**
 * The RUNTIME matcher — the shape the overlay chain and the kernel store, over
 * OPAQUE canonical identities. Structurally identical to the runtime kernel's
 * `PermissionResourceMatcher`, which is now an ALIAS of this type (ADR A1-18
 * keeps the PR0 names alive as aliases until PR7 deletes them).
 *
 * It is NOT interchangeable with {@link AuthorityEnvelopeAstMatcher}: `path`
 * and `fingerprint` have collapsed into `resource`, and nothing may re-derive
 * the difference. That collapse happens exactly ONCE, in
 * `buildAuthorityEnvelope` (plan Task 1: "the single AST→runtime
 * canonicalization").
 */
export type AuthorityResourceMatcher =
  | { readonly kind: 'exact'; readonly resource: string }
  | { readonly kind: 'subtree'; readonly resource: string }
  | { readonly kind: 'fingerprint'; readonly resource: string }

/** One rule in its canonical RUNTIME shape. */
export interface AuthorityEnvelopeRule {
  readonly operationClass: string
  readonly matcher: AuthorityResourceMatcher
  readonly maximumEffect: AuthorityEffect
}

/** One authority document in its canonical RUNTIME shape. */
export interface AuthorityEnvelope {
  readonly rules: readonly AuthorityEnvelopeRule[]
}

// ---------------------------------------------------------------------------
// Coverage: does one matcher stand in for another? (delegated from PR0)
// ---------------------------------------------------------------------------

/**
 * The containment predicate over two canonical identities of the SAME backend
 * namespace. Production injects the pinned public containment seam; tests
 * inject a deterministic algebra; ABSENT means subtree coverage fails CLOSED
 * (never guessed). Declared here so the algebra below needs no runtime import.
 */
export type SubtreeContains = (root: string, child: string) => boolean

/** The outcome of one coverage question (the refusal stays explainable). */
export interface CoverageVerdict {
  readonly covers: boolean
  /** True when a subtree envelope matcher needed a containment verdict no
   *  injected predicate could give — a fail-closed refusal, never a guess. */
  readonly undeterminable: boolean
}

/**
 * Does an envelope matcher cover a target matcher?
 *
 * THE ORDER IS THE CONTRACT, and it is delegated — not reimplemented — so the
 * kernel's consumption sites keep distinguishing "no match" from "undetermined"
 * (`PERMISSION_EXPANSION_OUTSIDE_ENVELOPE` vs `PERMISSION_EFFECT_CONTEXT_-
 * UNAVAILABLE`, a fold that behaves differently for each):
 *
 *  1. any fingerprint involved ⇒ exact fingerprint identity only (exec is
 *     exact-only in BOTH documents; no subtree, no `any`, no prefix reading of
 *     an opaque `sha256:`);
 *  2. `exact` envelope ⇒ identical `exact` only;
 *  3. `subtree` envelope ⇒ **identity FIRST** (provable with no predicate at
 *     all: a root covers itself and the exact point at its root), and only then
 *     the injected predicate, and only then `{covers:false, undeterminable:true}`.
 *
 * Step 3's ordering is a round-2 external review correction: the original
 * ordering returned `undeterminable` even for the identity pair whenever the
 * predicate was absent, and the consumption sites then dropped the rule as a
 * plain non-match — a fail-closed path that silently became a fail-open one.
 */
export function matcherCovers(
  envelope: AuthorityResourceMatcher,
  target: AuthorityResourceMatcher,
  subtreeContains?: SubtreeContains,
): CoverageVerdict {
  if (envelope.kind === 'fingerprint' || target.kind === 'fingerprint') {
    const covers =
      envelope.kind === 'fingerprint' && target.kind === 'fingerprint' && envelope.resource === target.resource
    return { covers, undeterminable: false }
  }
  if (envelope.kind === 'exact') {
    return { covers: target.kind === 'exact' && envelope.resource === target.resource, undeterminable: false }
  }
  // envelope.kind === 'subtree' — identity BEFORE the seam, then the seam, then
  // the typed refusal. Never a guess.
  if (envelope.resource === target.resource) return { covers: true, undeterminable: false }
  if (subtreeContains === undefined) return { covers: false, undeterminable: true }
  return { covers: subtreeContains(envelope.resource, target.resource), undeterminable: false }
}

// ---------------------------------------------------------------------------
// The effective ceiling: a total lattice (ADR A1-5, spec §24.2)
// ---------------------------------------------------------------------------

/**
 * Why a scope's ceiling could not be computed. A closed set, and the reason is
 * carried rather than implied — the terminal vocabulary keeps
 * `authority-undetermined` DISTINCT from `denied` and from
 * `authority-unavailable` (ADR A1-7), and an fs failure must never be reported
 * as a governance escalation.
 */
export const AUTHORITY_UNDETERMINED_REASONS = ['containment-undetermined'] as const

/** One reason a ceiling is undetermined. */
export type AuthorityUndeterminedReason = (typeof AUTHORITY_UNDETERMINED_REASONS)[number]

/**
 * The outcome of one ceiling lookup. TOTAL, by construction: every lookup
 * below returns exactly one of these three, and `meet` over any pair is defined
 * by the §24.2 table.
 *
 * `matchedRules` carries the indices of the rules that produced a `decided`
 * answer, because "which rule said so" is a governance answer, not a debug
 * detail — a decision the audit ledger can neither show nor reconstruct without
 * it. It is `[]` for the identity (nothing narrowed) and absent for the two
 * non-decided statuses, where there is no answer to attribute.
 */
export type EffectiveCeiling =
  | { readonly status: 'decided'; readonly effect: AuthorityEffect; readonly matchedRules: readonly number[] }
  | { readonly status: 'no-authority' }
  | { readonly status: 'undetermined'; readonly reason: AuthorityUndeterminedReason }

/**
 * The meet IDENTITY: full reach, no narrowing. It is what the approval plane
 * returns when no rule matches, and what a meet over no documents returns, so
 * the two are the SAME value rather than two ideas that happen to agree
 * (`grantCeiling` over an empty binding set must not need a special case).
 */
export const CEILING_IDENTITY: EffectiveCeiling = Object.freeze({
  status: 'decided',
  effect: 'allow',
  matchedRules: Object.freeze([]) as readonly number[],
})

/**
 * The meet BOTTOM: the document authorizes nothing. NOT `deny` — `deny` is an
 * answer to a request that was considered, `no-authority` is the absence of any
 * authority to consider one (spec §24.2 keeps them as separate rows/columns, and
 * ADR A1-7 forbids routing either into an admin-required case by default).
 */
export const CEILING_NO_AUTHORITY: EffectiveCeiling = Object.freeze({ status: 'no-authority' })

/** One undetermined ceiling with the standard reason. */
const UNDETERMINED: EffectiveCeiling = Object.freeze({
  status: 'undetermined',
  reason: 'containment-undetermined',
})

function decided(effect: AuthorityEffect, matchedRules: readonly number[]): EffectiveCeiling {
  return { status: 'decided', effect, matchedRules }
}

/**
 * `meet(A, B)` over the §24.2 table, implemented rather than tabulated — and
 * the table is asserted cell-by-cell (and for symmetry) in
 * `a4p1-authority-envelope.test.ts`, which is what makes the implementation
 * checked rather than aspirational:
 *
 * | meet      | deny | ask | allow | no-authority | undetermined |
 * |-----------|------|-----|-------|--------------|--------------|
 * | deny      | deny | deny| deny  | no-authority | undetermined |
 * | ask       | deny | ask | ask   | no-authority | undetermined |
 * | allow     | deny | ask | allow | no-authority | undetermined |
 * | no-authority | …  | …   | …     | no-authority | undetermined |
 * | undetermined | …  | …   | …     | …            | undetermined |
 *
 * `undetermined` ABSORBS; `no-authority` is the bottom of the decided chain;
 * otherwise the lower effect wins. Note what is NOT here: no availability
 * answer (A1-5's "the evaluator never returns resolver availability").
 */
export function meetAuthorityCeilings(a: EffectiveCeiling, b: EffectiveCeiling): EffectiveCeiling {
  if (a.status === 'undetermined') return UNDETERMINED
  if (b.status === 'undetermined') return UNDETERMINED
  if (a.status === 'no-authority') return CEILING_NO_AUTHORITY
  if (b.status === 'no-authority') return CEILING_NO_AUTHORITY
  const [left, right] = [a, b] as const
  const leftRank = AUTHORITY_EFFECT_PRECEDENCE[left.effect]
  const rightRank = AUTHORITY_EFFECT_PRECEDENCE[right.effect]
  if (leftRank < rightRank) return decided(left.effect, left.matchedRules)
  if (rightRank < leftRank) return decided(right.effect, right.matchedRules)
  // A TIE: both documents decided the same ceiling, so both are the reason.
  // `matchedRules` are indices INTO their own document, so the union is a SET of
  // indices, not a provenance chain — PR2's caller knows which documents it
  // passed and tags them at the audit boundary (ADR A1-14's recheck site owns
  // that), which is why the domain type stays document-local and document-free.
  return decided(left.effect, [...new Set([...left.matchedRules, ...right.matchedRules])].sort((x, y) => x - y))
}

/**
 * `meet` over a list. The empty list is the IDENTITY, which is exactly the
 * Human Admin row of `bindingDocs` (bound by no envelope at all, spec §7.4:302)
 * — no special case is needed anywhere that calls this.
 */
export function meetAllAuthorityCeilings(ceilings: readonly EffectiveCeiling[]): EffectiveCeiling {
  return ceilings.reduce(meetAuthorityCeilings, CEILING_IDENTITY)
}

// ---------------------------------------------------------------------------
// The shared matching walk, and the one place the two planes differ
// ---------------------------------------------------------------------------

/** One scope a ceiling is asked about. */
export interface AuthorityScope {
  readonly operationClass: string
  readonly matcher: AuthorityResourceMatcher
}

/** The three outcomes the shared walk can produce before "absence" is read. */
type MatchOutcome =
  | { readonly kind: 'undetermined' }
  | { readonly kind: 'no-match' }
  | { readonly kind: 'matched'; readonly effect: AuthorityEffect; readonly matchedRules: readonly number[] }

/**
 * The ONE matching walk (spec §5.2 steps 1-2 and 4):
 *
 *  1. evaluate EVERY rule of the same `operationClass` — never filter by a
 *     guess about which ones are relevant (ADR A1-6: relevance filtering is
 *     forbidden, because "probably irrelevant" is how a degraded filesystem
 *     seam quietly turns into authority);
 *  2. if ANY same-class rule's containment cannot be decided, the WHOLE SCOPE
 *     is `undetermined` — including when the target sits under a rule that
 *     decided just fine;
 *  3. otherwise the lowest `maximumEffect` among the covering rules wins.
 *
 * What step 3's "otherwise nothing matched" MEANS is supplied by the caller,
 * which is the entire difference between the two planes (ADR A1-4).
 */
function evaluateMatches(
  envelope: AuthorityEnvelope,
  scope: AuthorityScope,
  subtreeContains?: SubtreeContains,
): MatchOutcome {
  let undeterminable = false
  let lowest: AuthorityEffect | undefined
  const matched: number[] = []
  envelope.rules.forEach((rule, index) => {
    // Step 1: same class only, and the class is compared, never inferred from
    // the matcher's shape (a file-shaped matcher under a shell class is a
    // document defect the validator refuses; it is never read as "no rule").
    if (rule.operationClass !== scope.operationClass) return
    const verdict = matcherCovers(rule.matcher, scope.matcher, subtreeContains)
    // Step 2: collect, do not filter. A single undecidable verdict decides the
    // whole scope, and no rule evaluated afterwards can un-decide it.
    if (verdict.undeterminable) {
      undeterminable = true
      return
    }
    if (!verdict.covers) return
    matched.push(index)
    if (lowest === undefined || AUTHORITY_EFFECT_PRECEDENCE[rule.maximumEffect] < AUTHORITY_EFFECT_PRECEDENCE[lowest]) {
      lowest = rule.maximumEffect
    }
  })
  if (undeterminable) return { kind: 'undetermined' }
  if (lowest === undefined) return { kind: 'no-match' }
  return { kind: 'matched', effect: lowest, matchedRules: matched }
}

/**
 * The Durable-Mutation / EXPANSION lookup (spec §5.2, ADR A1-4 strict reading).
 *
 * `no-authority` on no match. `rules: []` therefore means "this actor may
 * expand nothing", which is the fail-closed default the design wants on the
 * plane where a document is the ONLY source of authority.
 */
export function effectiveAuthorityCeiling(
  envelope: AuthorityEnvelope,
  operationClass: string,
  matcher: AuthorityResourceMatcher,
  subtreeContains?: SubtreeContains,
): EffectiveCeiling {
  const outcome = evaluateMatches(envelope, { operationClass, matcher }, subtreeContains)
  switch (outcome.kind) {
    case 'undetermined':
      return UNDETERMINED
    case 'no-match':
      return CEILING_NO_AUTHORITY
    case 'matched':
      return decided(outcome.effect, outcome.matchedRules)
  }
}

/**
 * The CONCRETE-OPERATION APPROVAL narrowing (ADR A1-4, spec §7.4:303).
 *
 * The IDENTITY on no match: "a matching envelope rule can only LOWER what a
 * given reviewer may approve, never raise it; ABSENCE OF A MATCHING RULE IMPOSES
 * NO NARROWING" (A1-4). The source of approval authority is the ladder plus the
 * permission rule's own lanes — an envelope is a restriction on it, so an
 * envelope that says nothing about a scope restricts nothing about it.
 *
 * This is the half of the pair that makes the documented
 * `teamHardEnvelope: { rules: [] }` survivable: it removes nothing, and the
 * Leader's approvable set stays whatever the ladder grants.
 */
export function narrowingForApproval(
  document: AuthorityEnvelope,
  scope: AuthorityScope,
  subtreeContains?: SubtreeContains,
): EffectiveCeiling {
  const outcome = evaluateMatches(document, scope, subtreeContains)
  switch (outcome.kind) {
    case 'undetermined':
      return UNDETERMINED
    case 'no-match':
      return CEILING_IDENTITY
    case 'matched':
      return decided(outcome.effect, outcome.matchedRules)
  }
}

// ---------------------------------------------------------------------------
// The parser: unknown input → the DECLARED AST (never the runtime shape)
// ---------------------------------------------------------------------------

/** A closed structural problem of an authority document. */
export const AUTHORITY_ENVELOPE_PROBLEMS = [
  'envelope-not-a-record',
  'rules-not-an-array',
  'rule-not-a-record',
  'operation-class-unknown',
  'maximum-effect-outside-closed-set',
  'matcher-not-a-record',
  'matcher-kind-unknown',
  'matcher-class-mismatch',
  'matcher-identity-missing',
  'duplicate-envelope-pair',
] as const

/** One structural problem code. */
export type AuthorityEnvelopeProblem = (typeof AUTHORITY_ENVELOPE_PROBLEMS)[number]

/** One located problem. */
export interface AuthorityEnvelopeProblemEntry {
  readonly problem: AuthorityEnvelopeProblem
  readonly ruleIndex: number | null
  readonly detail: string
}

/** A strict parse outcome — never a partial document, never a silent default. */
export type AuthorityEnvelopeParseResult =
  | { readonly ok: true; readonly envelope: AuthorityEnvelopeAst }
  | { readonly ok: false; readonly problems: readonly AuthorityEnvelopeProblemEntry[] }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Parse one authority document into its DECLARED AST shape (correction X5-E2).
 *
 * The return type is the whole point: the parser hands back `{kind, path}` /
 * `{kind, fingerprint}` and CANNOT hand back `{kind, resource}`, because
 * canonicalizing here would put a second AST→runtime mapping next to the plane's
 * one. A caller that wants the runtime shape goes through
 * `buildAuthorityEnvelope` (ADR A3-9's single canonicalization).
 *
 * It is STRICT and TOTAL: every problem is reported (not just the first), the
 * document is never partially accepted, and an empty `rules` list is a legal
 * declaration rather than an error. Length bounds and field closedness are the
 * Blueprint validator's, which owns the hash-bound document; what is decided
 * HERE is the grammar every carrier shares, so a hand-built document (a runtime
 * read, a test fixture, a proposal node) cannot bypass the pairing law.
 */
export function parseAuthorityEnvelope(raw: unknown): AuthorityEnvelopeParseResult {
  const problems: AuthorityEnvelopeProblemEntry[] = []
  if (!isRecord(raw)) {
    return {
      ok: false,
      problems: [{ problem: 'envelope-not-a-record', ruleIndex: null, detail: 'an authority document must be a record { rules }' }],
    }
  }
  const rulesRaw = raw['rules']
  if (!Array.isArray(rulesRaw)) {
    return {
      ok: false,
      problems: [{ problem: 'rules-not-an-array', ruleIndex: null, detail: '`rules` must be an array (possibly empty)' }],
    }
  }
  const rules: AuthorityEnvelopeRuleAst[] = []
  const seen = new Set<string>()
  rulesRaw.forEach((item, ruleIndex) => {
    if (!isRecord(item)) {
      problems.push({ problem: 'rule-not-a-record', ruleIndex, detail: 'a rule must be a record { operationClass, matcher, maximumEffect }' })
      return
    }
    const operationClass = item['operationClass']
    const maximumEffect = item['maximumEffect']
    const matcherRaw = item['matcher']
    if (typeof operationClass !== 'string' || !(AUTHORITY_OPERATION_CLASSES as readonly string[]).includes(operationClass)) {
      problems.push({ problem: 'operation-class-unknown', ruleIndex, detail: `operationClass must be one of ${AUTHORITY_OPERATION_CLASSES.join(' | ')}` })
      return
    }
    if (typeof maximumEffect !== 'string' || !(AUTHORITY_EFFECT_VALUES as readonly string[]).includes(maximumEffect)) {
      problems.push({ problem: 'maximum-effect-outside-closed-set', ruleIndex, detail: `maximumEffect must be one of ${AUTHORITY_EFFECT_VALUES.join(' | ')}` })
      return
    }
    if (!isRecord(matcherRaw)) {
      problems.push({ problem: 'matcher-not-a-record', ruleIndex, detail: 'matcher must be a record { kind, … }' })
      return
    }
    const kind = matcherRaw['kind']
    if (typeof kind !== 'string' || !(AUTHORITY_MATCHER_KINDS as readonly string[]).includes(kind)) {
      problems.push({ problem: 'matcher-kind-unknown', ruleIndex, detail: `matcher.kind must be one of ${AUTHORITY_MATCHER_KINDS.join(' | ')} (no 'any')` })
      return
    }
    const shell = isShellOperationClass(operationClass)
    // THE PAIRING LAW, enforced by construction: a shell class pairs with
    // `fingerprint` ONLY, a file class with `exact`/`subtree` ONLY. A
    // mispairing is a typed refusal, never a silently inert rule — an inert
    // rule reads as "the document says nothing about this scope", which on the
    // approval plane means NO narrowing.
    if (shell && kind !== 'fingerprint') {
      problems.push({ problem: 'matcher-class-mismatch', ruleIndex, detail: `a shell-class rule (${operationClass}) pairs with a fingerprint matcher only` })
      return
    }
    if (!shell && kind === 'fingerprint') {
      problems.push({ problem: 'matcher-class-mismatch', ruleIndex, detail: `a file-class rule (${operationClass}) pairs with exact/subtree only` })
      return
    }
    const identityField = kind === 'fingerprint' ? 'fingerprint' : 'path'
    const identity = matcherRaw[identityField]
    if (typeof identity !== 'string' || identity.length === 0) {
      problems.push({ problem: 'matcher-identity-missing', ruleIndex, detail: `matcher.${identityField} must be a non-empty string` })
      return
    }
    // The membership check above is the runtime guarantee; TypeScript cannot
    // see through `readonly string[]`.includes, so the narrow is stated (the
    // kernel does the same at its own matcher validation).
    const matcherKind = kind as AuthorityMatcherKind
    // The DECLARED shape is carried out verbatim — no canonicalization, no
    // normalization, no trimming: this document is hash-bound upstream.
    const matcher: AuthorityEnvelopeAstMatcher =
      matcherKind === 'fingerprint'
        ? { kind: matcherKind, fingerprint: identity }
        : { kind: matcherKind, path: identity }
    // One pair, one ceiling: two rules for the same (class, matcher) would make
    // the coverage question ambiguous.
    const pairKey = `${operationClass}\u0000${kind}\u0000${identity}`
    if (seen.has(pairKey)) {
      problems.push({ problem: 'duplicate-envelope-pair', ruleIndex, detail: `duplicate (${operationClass}, ${kind} ${identity}) — one pair carries one ceiling` })
      return
    }
    seen.add(pairKey)
    rules.push({ operationClass, matcher, maximumEffect: maximumEffect as AuthorityEffect })
  })
  if (problems.length > 0) return { ok: false, problems }
  return { ok: true, envelope: { rules } }
}
