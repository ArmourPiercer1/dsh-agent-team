# A4-PR4 — RED captures and mutation proofs

Task 4 / A4-PR4 ("Concrete Operation Approval Routing and Single-Shot Execution"),
worktree `.worktrees/a4-pr4`, branch `feat/a4-pr4-approval-reachability` off
`origin/master` @ `a90a30404b3fcd201632c7ee14932f79f92e4b1d`.

Two kinds of artifact live here, and the difference matters:

* **`lane-*-red-*.txt`** — a spec run against production WITHOUT the feature
  (the classic RED). Only two lanes could produce one: the adapter-side lane-A
  cases (the production adapter was `git stash`ed, so the v3 arm did not exist)
  and lane B (the capability preflight seam did not exist).
* **`mutation-lane-*.txt`** — a spec run against production with **one
  production line flipped and no test touched**. The pure-routing and
  vocabulary cases (A1-A9, A14-A16, C5-C6) were authored in the same step as
  their module, so they have no RED run; their falsifiability is HERE. A flip
  that stayed green would be a finding to report, not a pass — every capture
  below reddens, and the number of reddened cases is stated.

Every mutation was reverted in the same command that applied it, and the
reverted state was re-run green before the next step. Residue check after the
last one: `grep -c MUTATED` = 0 in `approval-routing.ts`,
`pre-execute-adapter.ts`, `tools.ts`, `root.ts`, `agent-bindings.mjs`.

## Lane RED

| File | What was missing in production | Result |
| --- | --- | --- |
| `lane-a-red-before-wiring.txt` | the v3 arm of the ask path (adapter stashed) | `4 failed \| 9 passed (13)` — A10, A11, A12 + the port-typed harness case |
| `lane-b-capability-vs-permission.txt` | the capability preflight seam and the refusal family | `6 failed \| 1 passed (7)` |
| `lane-a-adapter.patch` | the lane-A adapter diff at the moment of the RED capture | patch, for review |

`mutation-lane-d-old-carrier-filter-restored.txt` doubles as the **c1 inversion
RED** the plan predicts ("this suite is red the moment the duty is done
correctly"): production keeps the old `kind === 'leader-approval'` filter while
the suite carries the A1-11 inversion → `2 failed \| 9 passed (11)` (cases 4
and 5, the two former exclusion pins). An intermediate run of the same state
was observed mid-session as `2 failed | 8 passed` before case 10 was added.

## Mutation proofs

| File | The single production flip (production only) | Reddened |
| --- | --- | --- |
| `mutation-lane-b-drop-preflight.txt` | preflight: drop the early return (the probe result is computed then ignored) | 2 — B1, B5 (and the a2c4 G2 stage pin): the refusal is still emitted, but at the wrong STAGE, so a row is written for a host that cannot execute |
| `mutation-lane-b-drop-lastmile-recheck.txt` | drop the last-mile recheck on the artifact- and static-allow paths | 2 — the allow path stops re-asking the host, so a capability lost after the decision executes |
| `mutation-lane-bc-guard-external-mapping.txt` | stop mapping the guard's `EXTERNAL_POLICY` verdict into the capability family | 1 (`external-policy`/B6) — a host restriction is reported as a Team permission denial |
| `mutation-lane-a-wrong-carrier.txt` | derive the carrier from the wrong rung (`leader` → `user-approval`) | A2, A10 |
| `mutation-lane-a-wrong-desired-effect.txt` | pass the permission lane's `ask` as `desiredEffect` instead of `allow` | A2, A3, A10, A12 — the evaluator is asked "may a reviewer be asked?" and answers with a reviewer |
| `mutation-lane-a-undetermined-mints-position.txt` | give the `authority-undetermined` arm a position (`'leader'`) | A6, A7, A11 — the arm exists precisely to name nobody |
| `mutation-lane-a-legacy-arm-computed.txt` | compute the legacy arm instead of returning the frozen routing | A8, A13 — A13's reddening is what proves "no v1/v2 behavior change" is enforced, not asserted |
| `mutation-lane-a-initiator-dropped.txt` | drop `initiatorAuthority` from the evaluation (default to the beneficiary) | A9 — `direct` disappears when the acting rung is not passed |
| `mutation-lane-a-adapter-carrier-as-authority.txt` | the adapter routes on the CARRIER instead of the derived rung | A10, A12 |
| `mutation-lane-a-leader-routed-off-member-documents.txt` | `if (false && input.actingAsLeader)` in the facts reader | A15 — a Leader's own ask evaluated against a member-beneficiary document set: the under-ask direction |
| `mutation-lane-a-facts-reader-reconstructs-documents.txt` | `{...context.documents}` instead of the plane's own pair | A14 — a reconstructed pair is a second answer (ADR A5-12) |
| `mutation-lane-c-drop-stale-refusal.txt` | the fresh recheck answers `still-covered` on `stale` | C1, C5 |
| `mutation-lane-c-inverted-ladder-comparison.txt` | compare with `>=`/reversed arguments instead of `isHigherAuthority` | C1, C5, C6 |
| `mutation-lane-c-terminal-vocabulary-drift.txt` | emit an outcome outside `TERMINAL_OPERATION_OUTCOMES` | C5 — the membership assertion is what pins the adapter's literals to the intervention vocabulary the adapter may not import (ADR A1-17) |
| `mutation-lane-c-claim-success-on-failed-body.txt` | report `execution-succeeded` even when `next()` denied | C5 |
| `mutation-lane-d-old-carrier-filter-restored.txt` | restore `filter(kind === 'leader-approval')` in `team_list_pending_control` | c1 cases 4, 5 (the inversion RED) |
| `mutation-lane-d-drop-case-source.txt` | drop the `listOpenApprovalCases` source from the pending list | c1 case 10 — a case is listed at its CURRENT leg; a closed leg never appears |
| `mutation-lane-b-drop-artifact-lastmile-recheck.txt` | neutralize the artifact-grant last-mile recheck (`if (false && …)`) | G4 only — proves the re-anchored G4 really tests that recheck (`expected 'allow' to be 'deny'`) |
| `mutation-lane-b-artifact-refusal-in-permission-vocabulary.txt` | route the artifact-grant refusal back through `permission denied:` | G4 only — proves the capability-family assertion is load-bearing |

## What the pins do NOT cover (reported, not hidden)

* **Guard-side A1-14 re-check is unenforced.** The fresh authority recheck lives
  in the pre-execute adapter (`(4c')`, cases C1/C2/C3). The consumption write
  inside `ControlService.guardOperation` still has no authority re-check. The
  fix needs an injected facts port on the control service, whose type belongs
  in `packages/runtime/control/types.ts` — not in Task 4's `Files:`, and
  re-deriving the ceiling from `teamDomain.repositories` inside the service
  would be a second reader of the authority documents (the A5-12 shape).
  `packages/runtime/control/service.ts` was therefore **not edited at all**.
* **`escalate` is not reachable from the tool** (the other half of A1-11):
  `resolveControl` accepts `allow | deny` only, and advertising `escalate`
  needs `{status:'control-escalated'}` in `packages/tools/src/types.ts` — a
  closed union outside Task 4's `Files:`. The tool description does not
  advertise it; the revert is byte-identical.
* **`CAPABILITY_UNAVAILABLE`** (spec §13's name) has **no producer**: emitting
  it from the guard-side mapping needs a `ControlExternalVerdict` shape change
  in `control/types.ts`. The lane emits the frozen
  `PRE_EXECUTE_CAPABILITY_ERROR_CODES` family behind the
  `"execution unavailable:"` reason prefix instead.
* **Production wiring is live but thin-pinned.** `host.ts` already injects
  `permissionAuthorityCeiling` into the root (`host.ts:2446`) and already hands
  the root's `permissionPlaneRef` to the glue (`host.ts:2434`), so
  `root.ts` publishing the facts reader on the plane object and
  `live/agent-bindings.mjs` splicing `operationApprovalRouting` into the
  listener is a COMPLETE path — no host line is missing. Two consequences are
  stated rather than glossed: (a) for a **v3** Team a MEMBER install now routes
  its asks off the authority documents (this is the point of the task; v1/v2
  Teams read `undefined` and keep today's routing byte-identically, pinned by
  A13), while a **Leader** install keeps the frozen routing by design (A15);
  (b) the splice path itself has **no boot test** — the established harness for
  booting a production root (`a3p4-production-permission-plane.test.ts`) leans
  on `as any` + `eslint-disable`, which this task's rules forbid and whose file
  is not in Task 4's `Files:`. The reader's mapping rules (A14-A16) and the
  absent-port behavior (A13) are pinned; the ~10 lines of conditional glue are
  pinned only by the type-checker and by the 42 existing root/glue suites
  staying green.
* **`subtreeContains` in production** comes from the glue's own
  `containOverlayKeys` (the pinned public `FileSystem.contains`), and a
  provider without that seam THROWS → `authority-undetermined` → deny with zero
  durable rows. That is fail-closed by construction, but it means a v3 subtree
  rule on such a provider cannot be decided — reported rather than guessed.
* **`artifact-read-permission-lane.test.ts` G4 was RED, and is now RESOLVED by
  an authorized assertion amendment** (the only file touched outside Task 4's
  `Files:`; authorization and the full record — the law the case protects, where
  it is enforced now, and the two mutation proofs — are in
  `../PR-DESCRIPTION.md`, disclosure 1). Summary of what happened: lane B's
  capability preflight `(2b)` answers a statically-denied world before any Team
  question, so the Alpha.3 sentence `:338` pinned could no longer be produced by
  the path the case is named for. Rather than edit the pin through the file
  boundary, I reported it; the coordinator authorized the edit; the case now
  tightens the policy **after** the preflight and pins **which** check denied
  (no `capability-preflight-denied`, an `external-recheck-denied` with
  `via: 'artifact-grant'`), so it still tests its own name — and it asserts the
  capability family. Invariant 34's remaining edges: C2 (single-shot lane) for
  the review-allow side, B6 + a2c4 G5 for the shared-evaluator side. No other
  case in that file used an externally-denied world, so no sibling subject moved
  silently.
* **`packages/runtime/action-router/router.ts:619`** — the plan's no-touch
  ruling is recorded here: A3 assigned the branch to PR4, A5-5 requires no
  functional change, and PR4 records the decision instead of editing.
