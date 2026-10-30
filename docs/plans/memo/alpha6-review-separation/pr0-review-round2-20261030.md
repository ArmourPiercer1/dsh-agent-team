# Alpha.6 PR0 — review round 2 (2026-10-30 real UTC)

Same independent reviewer as round 1 (subagent `75a6e69b-0059-4107-8ff3-32bfd781311d`), same method
(execute, don't read), graded at head `60016ed2be9e51d3f0eba2ba57559283c08f67e6` — the SHA round 1's fixes
produced. This file records its verdicts, the residue it found in my fixes, and what I did about the
residue. Round 1's record is `pr0-review-round1-20261030.md`; the two together are the review trail for
PR #501.

## Reviewer's verdicts on round 1's findings

| finding | verdict | the evidence it produced |
| --- | --- | --- |
| B-1 dist co-commit | **CLOSED** | `check-artifacts-at-head` → `verdict=ok compared=1899 drift=0`; 16 dist files tracked. It noted the check is stronger than what it asked for: a rebuild-into-worktree comparison, not a tree match. |
| B-2 `tsconfig.build.json` comments | **CLOSED** | `a4p3-intervention-lane-hygiene` → 9/9; file strict-JSON again and still naming the lane. |
| M-1 plan brand | **CLOSED** | Both round-1 probes → `REVIEW_PLAN_UNBRANDED`; ten forgery routes tried (`Object.assign`, spread, `structuredClone`, JSON round-trip, `Object.create` + descriptor copy + `setPrototypeOf`, re-freeze) all land unbranded and are refused; deleting the brand line turns 5 legs RED. |
| M-2 one delegability rule | **CLOSED** | Its own mutation replayed **both directions**: widening the routing predicate → RED; narrowing it → RED. Disagreement is now impossible by construction because admission calls the predicate. |
| M-3 closed codes, no exception path | **PARTIAL** | Every malformed *value* answers a closed code, including its two round-1 probes; prototypeless inputs behave correctly. Still throwing: an **absent container** (`caseView: null`, `caller: null`, `input: null`), a throwing getter on a guard-read field, a hostile Proxy. Fail-closed throughout — nothing over-admits — but the header's absolute claim was wider than the code. |
| m-1 dormancy detector | **CLOSED** | All three round-1 bypasses now RED; RED also for `.cjs` require, `export * from`, directory-prefix concatenation; **GREEN (undetected)** only for token-split `'../review' + '-mandate/index.js'`. Its judgement: acceptable-with-disclosure, since surviving that needs a module-graph check and the realistic adversary is accident, not obfuscation. |
| m-2 purity screen | **CLOSED as a disclosed floor** | `process.hrtime` RED, obfuscated `Date.now` codegen RED; `Atomics.wait` and `'per'.concat('formance.now()')` evade; `new Date(callerString)` allowed **by design** because it reads no clock. Agrees the in-code comment now states the screen is a floor and the injected-clock legs are the proof. |
| m-3 booking honesty | **CLOSED** | Moved my booking aside and reproduced `scanner counts 1401, ledger derives 983 + 410 = 1393` verbatim, restored, 20/20; per-file leg counts match the text; the false "no hosted CI" claim is publicly corrected rather than quietly edited out. One stale number left (NEW-3). |
| m-4 file inventory | **CLOSED** | Fifth file → RED; named in the allow-list → GREEN; both restored. |
| round-1 NOTEs | **CLOSED** | Frozen shared answer; whitespace case id; the renamed leader-flag guard is reachable (deleting it → 1 RED); the digest-binding deferral is a recorded PR-I1 obligation, not a silent drop. |

## What the reviewer found in my fixes, and my disposition

| id | finding | disposition |
| --- | --- | --- |
| NEW-1 (MAJOR, PR-I1-gating) | The absolute "no exception path" claim is disproved in one line by `caseView: null` — `TypeError: Cannot read properties of null (reading 'requestKind')` — because the presence check cannot live below the destructure that reads the field. | **Fixed in code, not deferred.** `evaluateReviewAdmission` now checks container presence *before* destructuring: `REVIEW_INPUT_MALFORMED` (new code), `REVIEW_CASE_MALFORMED`, `REVIEW_CALLER_MALFORMED`. Pinned by eight `not.toThrow()` legs plus a leg naming which container was refused. |
| NEW-2 (MINOR) | A throwing getter on a guard-read field, or a hostile Proxy, still throws. | **Not fixable by code, so not claimed.** Any field read in any module on earth can be made to throw. The header now states the promise at the precision the code holds — *for any input whose containers exist, every value-level malformation answers a closed code* — and names hostile containers as a caller obligation, which is exactly what a fold projection read inside the team lock produces. Disclosed rather than papered over. |
| NEW-3 (MINOR) | The booking still said "closed **28**-code refusal table" after the list grew to 31. | Fixed twice over: the text says 32 (the count after NEW-1's code) **and** the count can no longer rot silently, because the list is now pinned as a runtime ordered list (NEW-5). |
| NEW-4 (NOTE) | Guard ordering changed an observable: a Leader on a malformed row now gets `REVIEW_CASE_MALFORMED` where round 1 returned the role-table answer. | Intended, and now **explicitly pinned rather than incidental**: a leg asserts both halves — malformed refuses a Leader, and the same Leader on a well-formed row still gets `basis: 'role-table'`, unchanged. Flagged for PR-I1 in the record: role-admitting callers can observe lane codes. |
| NEW-5 (NOTE) | The 31-code vocabulary was closed in types only; no runtime list. | **Fixed.** One leg pins the exact ordered 32-code list plus a no-duplicates assertion; a second leg drives ~30 real refusal-producing inputs and requires every produced code to be in the published list. |
| NEW-6 (NOTE) | Token-split concatenation evades the dormancy regex. | Carried with disclosure. Closing it means walking a module graph in a hygiene test; the eight other planted consumer shapes are RED and the detector has six positive controls so it cannot be vacuous. Recorded as a known limit, not as "the lane has no consumers". |
| NEW-7 (NOTE) | `Atomics.wait` and obfuscated codegen evade the purity screen. | Carried with disclosure, for the reason the reviewer accepted: the screen is a floor; the law is the injected-clock legs. |
| NEW-8 (NOTE) | The brand controls only produced refusal-code mismatches — deleting the brand never flipped an input to `admitted: true`, so the pin was syntactic. | **Fixed, and it was a real gap.** New input: a hand-built plan with a wildcard scope *matched all the way through* (attempt, case view and grant all carrying `'*'`). With the brand it refuses `REVIEW_PLAN_UNBRANDED`; delete the brand and this leg returns `admitted: true` — a Member authorised over an unbounded effect scope. The paired leg proves the same case shape admits with a legitimate plan, so the input genuinely reaches the door. |
| NEW-9 (NOTE) | Concurrent external writers land in this repo mid-review (round 1's G-4 edit, this round's untracked design doc). | Accurate and disclosed: both were my own concurrent edits in this lane, made while the reviewer was running. The reviewer left them untouched rather than reverting someone else's work — the right call, and the reason the round-2 record is a separate file with its own timestamp. |

## Settlement, and what it does and does not authorise

The reviewer's signed sentence, verbatim:

> Independent review round 2, head `60016ed2be9e51d3f0eba2ba57559283c08f67e6`, 2026-10-30: I sign PR #501
> as safe to merge and ship DORMANT — round-1 B-1, B-2, M-1, M-2, m-1–m-4 and all NOTE findings verified
> CLOSED by executed probes and planted mutations (112/112 legs green; 10/10 brand forgeries refused; M-2
> caught widening AND narrowing; 7/8 planted dormancy shapes RED; census reproduced verbatim `scanner
> counts 1401, ledger derives 983 + 410 = 1393`, restored 20/20; install surface rebuilds to itself,
> drift=0); M-3 PARTIAL, signed with a PR-I1 gate: before `evaluateReviewAdmission` is wired, add the two
> container-presence guards and scope the 'no exception path' claim to what the code guarantees (plain
> non-null containers, fold-derived inside the team lock); NEW-2–NEW-8 carried as disclosed.

Two things it does **not** mean, stated because they are the ones a reader would otherwise assume:

1. **It is not a merge authorisation.** Merging Alpha.6 into `master`, and any product enablement, is
   outside what I was granted and stays with the user. PR #501 keeps its `DO-NOT-MERGE` marker; the
   `pr-settlement-gate` leg will keep reporting BLOCKED-BY-MARKER, which is the mechanism working.
2. **It grades `60016ed2b`, not the head that follows.** NEW-1, NEW-3, NEW-5 and NEW-8 are closed on the
   commit that carries this file — one container-guard trio, one booking text correction, and
   `a6-pr0-review-round2.test.ts` (15 legs), 127 lane legs green in total — which is *more* than what was
   signed, and this lane's law is that a settlement names the exact SHA it graded. Before that marker
   could ever come off, a reviewer re-verifies the delta on the new head. The PR-I1 gate the settlement
   carries (container guards + a narrowed claim) is already closed there; what survives is NEW-2's
   disclosure, which cannot be closed by code.
   The PR-I1 gate the settlement carries — the container guards and the narrowed claim — is already closed
   in that head, so the gate that survives is only NEW-2's disclosure: hostile containers are a caller
   obligation, and PR-I1 must supply fold-derived plain data read inside the team lock.

## Where PR0 stands after round 2

`packages/runtime/review-mandate/` — 32 refusal codes, one entry point, **zero production consumers**,
127 legs, install surface rebuilt to itself, `pnpm typecheck` clean, security negatives `exit=0`, local C1
gate `DSH-CI-VERDICT pass pass=8 fail=0 skip=1` (the skip is `census`, named for its opt-in host-tree
dependency, not hidden), `docs-sync --check findings=0`. Nothing is wired to `allow`; nothing is enabled
by default; C2 real-Host legs remain ENV_BLOCK on this machine and must be re-run at the final merged HEAD.
