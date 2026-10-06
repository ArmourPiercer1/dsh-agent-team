# A4-PR2 pre-flight rulings (X7) — coordinator rulings before the PR2 writer is dispatched

Date 2026-10-07. Produced by a read-only pre-flight audit of Task 2 against the real tree
(`master@48bfbc35`; the PR1 branch tip `3c310342` supplied X5/X6, which are **not yet on master**).

**Numbering note:** these are **X7**. They are recorded here rather than appended to the ADR's
"Execution-round corrections" block because X5 and X6 already occupy that file's tail on
`feat/a4-pr1-authority-envelope`, and appending here would create an avoidable merge conflict for a
docs-only change. They are to be folded into the ADR verbatim once PR1 merges; the plan and spec
reference this path in the meantime.

## R1 — Task 2's Files list was incomplete; each omission is an uneditable file

Under the plan's one-writer rule a file absent from the Files list cannot be touched by the task that
needs it. Added to Task 2:

| added | why it is mandatory | evidence |
| --- | --- | --- |
| Modify `packages/runtime/test/a3p3-governance-lane-hygiene.test.ts` | PR2's production files import `permission-mutation.ts` (at minimum `PermissionResourceMatcher`, even type-only); the consumer walk flags **`import type` too** | walk `:107-157`, skip-list `:134-141` |
| Test create `packages/runtime/test/a4p2-ceiling-reachability.test.ts` | spec §7.4.1 names this file and its owning PR as PR2 lane A; **X5-E1** removed the §7.4.1 ceiling-test duty from PR1 (this row originally cited "X5-B1", a label that does not exist anywhere in X5 — corrected 2026-10-07 when an independent review checked my own citations, per Global Precedence rule 4) | spec `:311`; ADR X5-E1 |
| Modify `packages/testkit/test/p4t6-session-event-scan.test.ts` + receipt | rule 8 / A5-17 continuous recompute authority; PR2 adds ≥3 scannable files over the pinned value | pin **978** at `p4t6-session-event-scan.test.ts:52` |
| dist co-commit expectation line | PR2 wires `service.ts` → `authority-ceiling.ts`/`runtime-authority.ts`; transitive emission applies even though the runtime build include omits `governance` | A5-19 mechanism |

**Not** added to any allow-list: the lane→storage edge. The scan at `:360-373` covers every `.ts` in
`governance/` including new files, and PR2 needs no storage edge. Its allow-list today is exactly
`{proposal-store.ts → storage/schema/permission-overlay.js, slot.ts → storage/schema/index.js}`.

## R2 — `mayReview`'s signature

PR2 ships `mayReview(reviewer, beneficiary, requiredAuthority)`, all parameters required, **no defaults**.
A defaulted or optional `requiredAuthority` is silently permissive, which is the failure direction this
phase exists to eliminate. PR2 must **not** invent an `ApprovalCase` type: PR3 owns that shape, whose legs
carry `reviewAuthority` / `beneficiaryAuthority` / `requiredAuthorityAtCreation` and map onto these three
parameters 1:1. (X5-E1 removed `mayReview` from PR1 for exactly this reason, but the plan never fixed
PR2's signature: Task 2's Files line said PR2 adds it while its Produces list omitted it entirely.)

## R3 — how X2's debt is actually paid, and how it is faked

`runtime-authority.ts` must be `import type { ProposalAuthorityPosition } from './proposal-store.js'`
aliased as `RuntimeAuthority`. Today `proposal-store.ts:148` exports the `as const` array and `:151`
derives the element type from it, and `a4pr0-proposal-store.test.ts:460` pins the order (ran green during
the audit).

**Four ways the contract can be violated while every type test passes** — the reason R3 requires two extra
test legs:

1. a locally re-spelled `'member' | 'leader' | 'human-user' | 'human-admin'` is *structurally* assignable
   both directions **with no import at all**;
2. a one-directional assignability assertion hides divergence in the unchecked direction;
3. a cast hidden in a helper (`(r: RuntimeAuthority) => r as ProposalAuthorityPosition`) compiles under any divergence;
4. `as const satisfies readonly ProposalAuthorityPosition[]` on a local array passes with a **subset** and
   silently creates a second ordering.

Required beyond mutual assignability: a **source-scan leg** (the file imports `./proposal-store.js` and
contains no re-spelled ladder literals) and a **positive containment leg** (rank-map keys ≡
`PROPOSAL_AUTHORITY_POSITIONS`). `authorityRank` is an exhaustive `Record` map: the array order is
*pinned-consistent with* ranking, never the definition of it (A5-16 non-vacuity).

## R4 — `packages/tools/src/tools.ts` ownership is genuinely undecidable in the plan

A2-18 assigns description-string updates to "the PR that changes the algebra" (= PR2); A5-11 assigns
`tools.ts` to PR4. **No test pins those strings** (verified: zero test hits), so this is not self-policing.
Ruled: `tools.ts` stays out of PR2's scope, and whatever model-facing wording eventually ships must be
positively pinned by the test that ships it. Recorded as an open ownership question rather than resolved by
silence, because silently editing a file assigned to another PR is how two writers end up on one file.

## R5 — v3 gate placement and refusal typing (the hazard only PR2's own tests can see)

- the dual-ceiling evaluation runs **after** the existing pre-classification context gate and rise
  classification. Placing it before relabels `EFFECT_CONTEXT_UNAVAILABLE` as a ceiling refusal — the
  deny-masquerade class (`permission-mutation.ts:1107-1185` is the order that must be preserved);
- ceiling-**undetermined** stays a CONTEXT-typed refusal; a **decided** insufficient ceiling gets a **new
  additive** code. Reusing `EXPANSION_OUTSIDE_ENVELOPE` for "Human User outside Team Hard" would make PR5's
  proposal routing key on a knowingly mislabeled code. (Today the Human path skips the envelope check
  entirely, `service.ts:546`/`:574`.)
- v3 selection keys on `schemaVersion === 3` **only** — never reader presence, never `rules.length`, because
  v3 `{rules: []}` is a legal zero-expansion-authority document (§3.4; the A5-4 lesson);
- all of it must be pinned by a blocking RED in `a4p2-dual-envelope-mutation.test.ts`: **no existing test can
  see this ordering**, because the v3 gate does not exist yet.

## Which frozen risks have a red test (measured, not assumed)

| frozen surface | red test exists? |
| --- | --- |
| `createGovernanceMutationService` method keyset | yes — hygiene `:287-313` (a deps-shape extension does *not* trip it) |
| barrel one-instantiation | **partial** — the leg pins only the five `permission-mutation` re-exports; a *new* double-instantiated module reds nothing |
| lane→storage value edge | yes, closed (scan `:360-373`; only a dynamic `import()` would slip) |
| `permission-mutation.ts` consumers | yes — and it fires on `import type`, which is why R1 adds the hygiene test to the list |
| A5-13 proposal payload | yes for record/vocabulary change (the three `a4pr0-*` suites); **adding a helper to `proposal-store.ts` reds nothing** — that is a review duty, not a test duty |
| v1/v2 blueprint byte-identity | yes. **Update after PR1 landed:** the "exactly one in-gate literal" fact this row recorded is superseded — PR1 added two more literal goldens (`sha256:d25ea1cf…`, `sha256:d6368916…`) plus a v3 projection JSON literal, so drift in the hashable shape now has three in-gate literals. PR1 also proved the honest-provenance technique for literals: the golden legs pass **in the RED capture on the pre-change tree** (`red-captures/lane-a-red.txt:20`), which is the only way to show a literal was measured before the code it pins |
| CONTEXT-before-EXPANSION ordering for the **new** v3 gate | **no** — only PR2's own RED can see it (R5) |

## Stale text repaired in place by this ruling (Global Precedence rule 3)

- **plan Task 2 lane A**: "Pin Leader ceiling = min(Leader envelope, Team Hard envelope)" survived the X5-E3
  repair and is expansion-plane `min` wording — it is now explicit about which plane it means and forbids
  reusing that result for approvals.
- **plan Task 2 lane A** first checkbox keyed the matrix by **beneficiaries** and had no `human-admin` row;
  the A5 addendum says the matrix is **positional** (binding by reviewer position, Admin bound by nothing).
- **spec §26.1** read "evaluates both ceiling documents for every reviewer and beneficiary" — over-broad
  unless *evaluated* is distinguished from *bound*, which would cap Human Admin operations A5-1 leaves
  uncapped. Now stated as evaluated ≠ bound.
- **spec §26.3** still legislated A3-4's withdrawn exec rule ("an envelope with no shell-class rule imposes no
  narrowing"), which A5-4 says would have **reversed production behaviour**. Repaired in place.

## Not verified by the audit (carried forward honestly)

PR1's shipped signatures (`narrowingForApproval` parameter list, `EffectiveCeiling` variant labels, barrel
exports) did not exist when the audit ran, so R2/R5's parameter names may need a one-line adjustment once PR1
lands; the approval-plane **meet identity encoding** (`decided('allow', matchedRules: [])` vs a new status) is
stated nowhere and PR1 must choose and document it; PR2's exact dist delta and final `p4t6` value depend on
PR1's wiring; the full-suite baseline was not re-run (only `a3p3-governance-lane-hygiene` and
`a4pr0-proposal-store`: 2 files / 25 tests green).
