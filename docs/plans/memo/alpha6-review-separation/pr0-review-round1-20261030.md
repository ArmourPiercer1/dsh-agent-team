# Alpha.6 PR0 — review round 1 (2026-10-30 real UTC)

Reviewer: an independent review subagent (`75a6e69b-0059-4107-8ff3-32bfd781311d`), not the implementer,
run against `alpha6/lane2-s0-20261030` at head `fe551196ed1d8bd3b8f644c2865c61bf081432af`.
Method: executed, not read — mutations planted in the lane and reverted, probes run, CI logs pulled.
Tree left clean (the one dirty file it reported was my own concurrent G-4 edit, disclosed by it under N-3).

This file is the settlement-relevant record for round 1: what was found, what was changed, and how each
change is pinned. Findings are the reviewer's; the dispositions and the fix claims are the implementer's
and each carries the leg that proves it.

## BLOCKER — both real, both fixed

| id | finding | proof it was real | disposition |
| --- | --- | --- | --- |
| B-1 | `tsconfig.build.json` names `review-mandate` but the PR committed **zero** `packages/runtime/dist/**` artifacts, so the install surface was stale. | The reviewer reproduced it locally (`verdict=stale compared=1899 drift=16`); PR #501's own hosted CI failed the same way (`pr-gate`, `census-runtime`, `ci-full`, `ci-security` all red on `drift=16`). Precedent checked: the dormant `sandbox-provider` lane commits its dist. | Fixed. `pnpm build` + `place-dist-glue`, the emitted lane artifacts committed in the same commit set as the source that changed them. The law is now written into G-4 of `alpha6-lane2-execution-plan-20261030.md` so PR2′/PR3′ do not rediscover it. |
| B-2 | The `//` comments this PR added to `tsconfig.build.json` broke `a4p3-intervention-lane-hygiene` — that leg does `JSON.parse(buildConfig.replace(/:\/\/.*/g,''))` (a4p3-intervention-lane-hygiene.test.ts:328), which strips `://`, not `//`. An existing master-green test went RED. | Reproduced: `1 failed | 8 passed`, `SyntaxError: Unexpected token '/'`. | Fixed by removing the comments from `tsconfig.build.json` (the rationale stays in `tsconfig.json`, which no test `JSON.parse`s). `npx vitest run packages/runtime/test/a4p3-intervention-lane-hygiene.test.ts` → **9 passed**. Disclosed here rather than quietly: my earlier "full suite green" claim did not cover this leg, because a locally unbuilt tree hides it. |

## MAJOR — all three were over-admission or contract breaches; all closed in code

**M-1 · the fail-closed law was only enforced at the parser, not at the admission door.**
`ReviewPlan` is structural, so a hand-built object that never met `parseReviewPlan` got the parser's
benefits without its refusals. The reviewer executed two opens: `expiresAtIso: 'expired-yesterday-probably'`
made `now > Date.parse(x)` equal `now > NaN` = false, so **expiry silently stopped firing** and the reviewer
was admitted; `{form:'exact-fingerprint', value:'*'}` put a wildcard effect scope through a door whose own
parser comment says "never a wildcard".
*Fix:* `plan.ts` now brands its output in a `WeakSet` (`isParsedReviewPlan`), and `evaluateReviewAdmission`
refuses an unbranded plan with the new closed code `REVIEW_PLAN_UNBRANDED` before it reads any plan field.
A NaN expiry is additionally refused with `REVIEW_CLOCK_INVALID` rather than degrading to `false`.
*Pinned by:* `a6-pr0-review-round1.test.ts` — brand carried by parser output and by nothing that merely
looks like it (`{...parsed}` is false), both reviewer probes refused, and a tampered-expiry leg. The two
existing fixtures were rewritten to build plans **through the parser**: a fixture that spread a parsed plan
would have tested the unbranded path in every leg, which is exactly the kind of false green worth naming.

**M-2 · `delegationApplicable` (the predicate PR-I1 will route on) was a second copy of the admission gate
and was unpinned.** Widening it alone to accept `envelope-mutation` left **all 84 legs green** — routing
would then hand cases to a reviewer `resolveControl` always refuses: a lying reviewer path.
*Fix:* admission now calls `delegationApplicable` and maps the failure to a specific code via
`nonDelegableRefusal`, so there is one rule, not two.
*Pinned by:* the nine-shape agreement matrix in round-1 (a delegable shape must reach the grant check; a
non-delegable shape must answer with one of exactly three routing codes), plus explicit legs for
`envelope-mutation` and a member-rung leg, and `approvalCaseId: '   '` → `REVIEW_CASE_UNBOUND` (whitespace
is not an id).

**M-3 · a malformed case view threw a TypeError where the module header promised no exception path.**
`requestKind: 'banana'` broke on the mirror lookup; a missing `actedCallerRefs` broke on `.includes`.
Fail-**closed** (a throw can never admit) but outside the closed-code contract, and in PR-I1 the thrower
would be inside the one decision write path — a stuck case with no typed reason.
*Fix:* `malformedCaseView` / `malformedCaller` run **first** (before the role-table lookup, which is itself
indexed by a vocabulary field) and answer `REVIEW_CASE_MALFORMED` / `REVIEW_CALLER_MALFORMED`.
*Pinned by:* ten round-1 legs including `expect(...).not.toThrow()` forms and a leg proving a malformed row
is refused **for a Leader too** — malformed must never degrade into "just take the old path".

*Under-stated trust, now spelled out:* `ReviewCaseView` is wholly trusted, and the consequence is written
into `types.ts` — a forged case view makes a Member the resolver of anything, so **invariant 37 ultimately
rests on PR-I1 supplying fold-derived data read inside the team lock**, and *this lane's unit tests are not
evidence about that boundary*; only an integration test driving the real fold is. That is a PR-I1 exit
criterion, not a PR0 one, and PR-I1 must not treat a green PR0 as cover.

## MINOR — fixed, with the reason each was wrong

- **m-1 dormancy detector had three bypasses** (`.ts` only; `.js` extension required; three packages
  outside the scan). Executed: a `.mjs` file under `src/plugin/live/` — the plane PR-I2 stands in — importing
  the lane left the law GREEN. Now scans every package directory for `.ts/.mjs/.cjs/.js`, matches
  extensionless, bare-directory and dynamic specifiers, skips derived output, and carries **six positive
  controls plus a negative control** so the detector cannot be vacuous.
- **m-2 the purity screen was a token list.** Now also refuses `performance.now`/`process.hrtime`,
  `setTimeout|setInterval|setImmediate`, `require(`, `import(`, `node:fs|net|http`, `child_process`.
  Labelled in place for what it is: a floor, not the proof — the proof is the injected-clock legs.
- **m-3 this booking's own text was dishonest in two ways** ("26 legs" for a 34-leg spec; a tieNote
  claiming a Lane-2 PR carries no hosted CI when #501 is based on master and its CI ran and was red).
  Corrected, with the corrected CI sentence naming the `drift=16` run as the reason the dist co-commit
  and this booking land together. Leg counts are vitest-measured: 34 + 45 + 12 + 21 = **112**.
- **m-4 the file-inventory leg over-pinned four filenames**, so a legitimate fifth module would break an
  unrelated hygiene leg. Now: the four founding modules must be present, and anything beyond them must be
  named in an explicit `EXTRA_MODULES_ALLOWED` list — a one-line amendment that says what landed.

## NOTE-level

`ADMITTED_BY_ROLE_TABLE` is frozen (it was a shared mutable answer object); whitespace-only `approvalCaseId`
no longer passes the L-2 gate; the guard that read the **caller's** Leader flag was renamed
`REVIEW_CALLER_IS_LEADER_INSTANCE` (its name said "plan") and moved ahead of any plan read — and pinned by
a leg, because the leg that used to cover it no longer reached it after M-1 landed; the
`planCoversEffectScope` action-name guard got a direct pin with a comment explaining why admission
structurally cannot observe it (an unlisted action is refused earlier by `ACTION_NOT_DELEGATED`).
Not done here, deliberately: grants bind `planEpoch` but not `reviewPlanDigest` — plan immutability inside
an epoch is a convention until PR-I1 folds the grant fact, which is where the digest pin belongs. Recorded
as a PR-I1 obligation in the execution plan rather than half-implemented here.

## What survived, and matters for the next round

The reviewer's mutation sweep found the existing suite resistant: dropping the grant case gate, the
requester self-check, or the parser's unknown-key refusal, and widening the role-closure mirror, each turn
legs RED (mirror-only widening: 37 RED, including both legs that read `control/types.ts`). Its (D) and (E)
sections found the booking reproducible verbatim and **no wrong or overstated claim** in the S0 audit across
20+ spot-checks, including the live GitHub branch-protection state and the upstream `inbox.ts` throw site.
That is the part of the review that says the lane's *claims* can be trusted; the M-findings say the lane's
*door* could not be, and that is what round 1 changed.

**Round-1 state:** 112 lane legs green, `a4p3-intervention-lane-hygiene` 9/9, `p4t6` census 20/20 with the
corrected 1393 → 1401 booking, install-surface artifacts committed. Re-review of these findings only, per
the lane's own rule that a fix is verified by the reviewer who asked for it.
