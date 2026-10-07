# A4-PR4 — Concrete Operation Approval Routing and Single-Shot Execution

Branch `feat/a4-pr4-approval-reachability` (worktree `.worktrees/a4-pr4`), off
`origin/master` @ `a90a30404b3fcd201632c7ee14932f79f92e4b1d`. **Not pushed, no
PR opened, nothing merged** (writer scope).

## What shipped

**Lane A — minimum-authority routing for a concrete operation.**
`packages/runtime/operation-permission/approval-routing.ts` (new) answers
"which rung must sign this `ask`" through `evaluateAuthorityCeiling` — the one
walk, the one ordering. Four arms: `legacy` (no facts = not v3 → the frozen
routing), `direct` (the acting rung already holds it → **no case opened**,
because §21.4 forbids a same-level allow and `guard.ts` proceeds on
`no-request`), `approval-required` (a named rung; the legacy request kind rides
as a **carrier** derived from it, never as semantic authority), and
`authority-undetermined` (**carries no position at all** — the arm exists to
name nobody). `createOperationApprovalFactsReader` is the lane's only port-
touching export: it adapts the injected ceiling-context reader, returns
`undefined` for a pre-v3 read, and **refuses to route a Leader install off a
member-beneficiary document set** (that is the under-ask direction).
`desiredEffect` is fixed to `allow`: the effect asked about is the effect, not
the lane that raised the question.

**Lane B — capability/environment vs Team permission.** A preflight `(2b)` asks
the host's live external hard policy **before** any Team question is answered
and **before** any durable case opens: a refusal there writes nothing durable
and never awaits `next()`. The last-mile rechecks on the artifact-grant and
static-allow paths are **retained** (a policy that tightens after the decision
still blocks). Refusals land in the new typed family
(`PRE_EXECUTE_CAPABILITY_ERROR_CODES` behind the `"execution unavailable:"`
reason prefix), never in `permission denied:`. No capability check was added to
the durable permission-mutation lane (lane B's explicit "do not").

**Lane C — single-shot terminal semantics.** A reviewer allow is not a standing
grant: at execution time the routing is **recomputed from fresh documents** and
compared against the rung that actually signed with `isHigherAuthority`; a rise
denies ("rose to '<rung>' after the approval was given at …") **without
consuming the one-shot allow**; an unreadable fresh document denies for the same
reason; the guard's `EXTERNAL_POLICY` verdict is emitted as
`execution-unavailable`; a tool body that itself denies is recorded as
`execution-unavailable` and never as success; success consumes **exactly once**
and a replay is refused (`no-request`, because the allow's row is closed by its
own consumption). Terminal outcomes are emitted as literals plus a test that
asserts membership in `TERMINAL_OPERATION_OUTCOMES` — the executing path may not
import `intervention/**` (ADR A1-17).

**Lane D — the pending list spans cases (A1-11 half).**
`team_list_pending_control` no longer filters on `kind === 'leader-approval'`;
it lists the **current leg of every open approval case** (case-derived, so a leg
an escalation closed can never appear as actionable work) unioned with
**pending rows that carry no case identity** (the v1/v2 rows keep appearing
until PR7), deduped by `requestId`, sorted by durable `requestSequence`.

**Wiring.** `root.ts` publishes the facts reader on the plane object the live
glue already reads (host.ts already injects `permissionAuthorityCeiling` at
`host.ts:2446` and already hands the same `permissionPlaneRef` to the glue at
`:2434`), and `live/agent-bindings.mjs` splices `operationApprovalRouting` into
the listener with `subtreeContains` bound to the glue's own pinned public
`FileSystem.contains`. **Effect: a v3 Team's member installs now route asks off
the authority documents. v1/v2 Teams and every Leader install are unchanged.**

## Files (Task 4's `Files:` + one coordinator-authorized test file)

Created: `operation-permission/approval-routing.ts`,
`test/a4p4-operation-approval-authority.test.ts` (16),
`test/a4p4-operation-single-shot.test.ts` (6),
`test/a4p4-capability-vs-permission.test.ts` (7).
Modified: `operation-permission/pre-execute-adapter.ts`, `…/errors.ts`,
`…/index.ts`, `src/plugin/root.ts`,
`src/plugin/live/agent-bindings.mjs`, `packages/tools/src/tools.ts`,
`packages/tools/test/c1-list-pending-control.test.ts`,
`packages/testkit/test/p4t6-session-event-scan.test.ts`,
`test/a2c4-external-lastmile.test.ts`,
`test/a3p3-governance-lane-hygiene.test.ts`,
**`test/artifact-read-permission-lane.test.ts`** — the one file outside Task 4's
`Files:`; the coordinator authorized this specific edit in writing after I
reported the collision instead of editing through the boundary (see disclosure
1 for what changed and why the law survives it).
Plus `dev/agent-workflow/evidence/a4-pr4/**` and the co-committed `dist/**`.
`packages/runtime/control/service.ts` was **not edited at all** (see blockers).

## Gate results (all measured on this tree)

| Gate | Result |
| --- | --- |
| `pnpm -r run typecheck` | **8 Done** |
| root `pnpm test` (pass A, after `rm -rf packages/testkit/test/.tmp-fault/`) | `Test Files 10 failed / 463 passed (473)`, `Tests 20 failed / 5728 passed (5748)` |
| root `pnpm test` (pass B) | `11 failed / 462 passed`, `22 failed / 5726 passed` — the delta is `p6t1-parallel.test.ts` ×2, the recorded flake |
| failing identities (both passes) | baseline 6 real files (`t1-capability-schema` ×9, `p6t3-mediation` ×5, `p6t3-restart` ×2, `t2-blueprint-hash`, `d3-member-identity-context`, `p6t6-actions`) + the 3 worktree collection-error files (`p8s3b-result-effects`, `t12a-b2-child-identity`, `t12a-glue-handoff-ports`) — **plus one new identity: `artifact-read-permission-lane.test.ts` G4**, reported below and deliberately not silenced |
| `pnpm --filter @dsh-agent-team/client run test` | `3 failed / 853 passed` — the three recorded pre-existing failures (`team-creation-panel` ×2, `team-governance` ×1) |
| `pnpm build` + `pnpm build:composition` + `pnpm check:artifacts` | build 8× Done; artifacts **OK: 1472 files**, dist co-committed (4 new `dist/**/approval-routing.*` paths) |
| `pnpm lint` | **162 identities, byte-identical to the `11e1609c` baseline** (sha256 match) — zero new diagnostic identities, zero mutes added |
| governance batch | 124 green across `a4p4-operation-approval-authority`, `a4p4-operation-single-shot`, `a4p4-capability-vs-permission`, `a2c4-external-lastmile`, `a5a-pre-execute`, `p6t4-allow-once`, `control-guard-leader`, `a3p3-governance-lane-hygiene` |
| root/glue consumers | 109 green across `a3p4-production-permission-plane`, `a3p4-pr4-production-entry-regression`, `a3p4-pr4-decision-routing-regression`, `a3p4-pr7-entry-exec-contract-regression`, `a3p4-permission-lifecycle-e2e`, `a3p5-permission-splice`, `a3p5-permission-read-wiring`, `c1-production-wiring` |

## Disclosures and unenforced items

1. **`artifact-read-permission-lane.test.ts` G4 — assertion amended (the one
   out-of-list file, authorized in writing by the coordinator).**
   *What moved:* the old body configured a world that was **statically**
   hard-denied and asserted the Alpha.3 sentence
   `toContain('the external hard policy no longer allows read')`. Lane B's
   capability preflight answers that world three steps earlier, so the case was
   about to go green while no longer exercising the recheck it is named for.
   *The amended assertion:* the world now **tightens after the preflight** (new
   `tightenAfterGrant` harness option — the flip happens inside the grant-port
   call, the last `await` before the last-mile recheck), and the case asserts
   the capability family (`startsWith('execution unavailable:')` +
   `alpha4-external-runtime-restriction` + the external reason text survives in
   the detail + **not** the `permission denied:` vocabulary), plus **which
   check answered**: no `capability-preflight-denied` observation, and an
   `external-recheck-denied` observation with `via: 'artifact-grant'` and that
   code.
   *The law the case was protecting* (invariant 34): there is **one**
   external-policy evaluator and the artifact-grant path runs the **same**
   last-mile recheck as the static-allow path — a grant is a floor, never a
   ceiling override, so no Team authority authorizes what the host refuses.
   *Where that law is enforced now:* the same shared evaluator is the only
   reader at all four sites; **this case** still exercises the last-mile site on
   the grant path (and its name is now self-verifying via the stage pins);
   **C2 in `a4p4-operation-single-shot.test.ts`** enforces it on the
   ask/allow-after-reviewer-approval side (capability lost after the allow →
   capability family, one-shot allow **not** consumed); B6 and `a2c4` G5 pin the
   shared-evaluator half. Two mutation proofs back it:
   `mutation-lane-b-drop-artifact-lastmile-recheck` (drop the artifact recheck →
   `expected 'allow' to be 'deny'`, G4 only) and
   `mutation-lane-b-artifact-refusal-in-permission-vocabulary` (route that
   refusal back through `permission denied:` → G4's family assertion fails).
   Suite: `artifact-read-permission-lane` 9/9 green; no other case in the file
   used an externally-denied world, so no sibling subject moved silently.
2. **Guard-side A1-14 re-check is unenforced** — *disclosed-unenforced, accepted
   by the coordinator, not a defect in this commit.* The fresh authority re-check
   lives in the adapter (`(4c')`, cases C1/C2/C3); the consumption write inside
   `guardOperation` still has no authority re-check. **Seam it needs:** an
   injected facts port typed in `packages/runtime/control/types.ts`
   (`ControlServiceOptions` at `:1140`) — that file is not in Task 4's `Files:`.
   Re-deriving the ceiling from `teamDomain.repositories` inside the service was
   **refused**: a second reader of the authority documents is the worse bug
   (ADR A5-12). `control/service.ts` was not edited at all.
   **Inheriting PR:** A4-PR5 (Durable Permission Mutation Proposals) already
   edits `control/types.ts` for mutation proposals and is the natural owner;
   A4-PR7's acceptance gate must not close while A1-14's guard-side half is
   unenforced.
3. **`escalate` remains unreachable from the tool** — *disclosed-unenforced,
   accepted.* (This is the other half of A1-11.) `resolveControl` accepts
   `allow | deny`, and advertising `escalate` needs `{status:'control-escalated'}`
   in the closed `TeamToolsResult` union in `packages/tools/src/types.ts`,
   outside Task 4's `Files:`. The whole escalate change was reverted
   byte-identically and the tool description does not advertise it. **Until that
   union admits the status, escalation is service-only and "a member can
   escalate" stays unproven.** **Seam:** that one union member. **Inheriting
   PR:** A4-PR5 (its Inline-Approval surface is where a reviewer acts).
4. **`CAPABILITY_UNAVAILABLE` (spec §13's name) has no producer** —
   *disclosed-unenforced, accepted.* Emitting that name from the guard mapping
   needs a `ControlExternalVerdict` shape change in
   `packages/runtime/control/types.ts`. So **spec §13's name is aspirational in
   this commit and the family prefix carries the meaning**: the lane emits
   `alpha4-external-runtime-restriction` / `alpha4-host-environment-unavailable`
   behind `execution unavailable:`. **Inheriting PR:** A4-PR6 (Intervention
   Remote v8 vocabulary) / A4-PR7 (cutover) own that shape change.
5. **No boot test covers the root→glue→adapter splice** — *disclosed-unenforced,
   accepted.* The splice (~10 conditional lines in `root.ts` +
   `live/agent-bindings.mjs`) is **type-pinned only**, plus the 109 existing
   root/glue tests staying green. The established harness for booting a
   production root leans on `as any` + `eslint-disable`, and reaching it that way
   was refused — **a lint mute is a forbidden way to buy a gate** — and the file
   is not in Task 4's `Files:` anyway. The reader's rules (A14-A16) and the
   absent-port path (A13, mutation-proven) are pinned. **Seam:** a boot-level
   test that can construct a production root without a mute. **Inheriting PR:**
   A4-PR7, whose cold-resume gate boots a real root and is where this belongs.
6. **Lane C reuses PR3-registered fact types**, so per the PR0a/A5-6 rule
   ("the writer of a fact type owns both category maps in the same PR") the two
   conditional files — `src/plugin/projection-source.ts` and
   `packages/client/src/model/ledger-adapter.ts:89-142` — are **deliberately not
   edited**, and this line is the record that replaces the edit.
7. **`c1-list-pending-control` cases 4 and 5 were inverted** (they pinned the
   exclusion A1-11 removes) and **case 10 was added** (a case is listed at its
   current leg and rung; a closed leg never appears). Restoring the old filter
   reddens 4 and 5 (`mutation-lane-d-old-carrier-filter-restored`); dropping the
   case source reddens 10 (`mutation-lane-d-drop-case-source`). Case 10 also
   records two laws found in the frozen service: a **risen leg keeps its
   carrier** (`service.ts:3966`) and a **carrier fixes its fingerprint
   vocabulary** (`mutation-proposal-fingerprint-required`).
8. **Five `a3p3` hygiene SURFACE rows were amended** (adding
   `AuthorityEnvelopeDocuments`, `AUTHORITY_CEILING_ERROR_CODES`,
   `AuthorityEvaluationEvidence`, `evaluateAuthorityCeiling`,
   `isHigherAuthority`) plus a narrow `BARREL_TYPE_ADMISSIONS` for
   `SubtreeContains` in `approval-routing.ts` only, with three non-vacuity
   cases. These are **stated amendments to the allow-list**, not barrel evasion:
   the barrel route is the sanctioned one (X12) and the amendment says so in
   the same commit.
9. **`a5a-pre-execute`, `p6t4-allow-once`, `control-guard-leader` needed no
   change** although the plan lists them as test updates: the v1/v2 path is
   byte-identical, and that claim is enforced, not asserted — the
   `mutation-lane-a-legacy-arm-computed` flip reddens A13, which is the case
   that pins "no v1/v2 behavior change".
10. **p4t6 pin moved 995 → 999** for four **named** files
    (`SCANNED_PATHS_A4PR4`), with the tie `length === 999 - 995` and per-path
    presence assertions. No existing entry was renumbered; the stale `it()`
    title at `:52` (reads 978) is left as the plan instructs.
11. **Lane A's pure cases have no RED run** — the module and its cases were
    authored in the same step. Their falsifiability is the 19 mutation captures
    in `red-captures/` (README table); the adapter-level lane-A cases and lane B
    do have real RED runs (`4 failed | 9 passed`, `6 failed | 1 passed`).
12. **"Server-derived legal actions" stay in the intervention projection lane**
    (A1-17 forbids the executing path from importing it). The executing path
    uses the control service's own role gates; nothing in `intervention/**` is
    imported from an executing path, and the hygiene walk enforces that.
13. **`packages/runtime/action-router/router.ts:619` — no-touch ruling
    recorded.** A3 assigned the branch to PR4, A5-5 requires no functional
    change; PR4 records the decision instead of editing the file.
14. **One correction against my own earlier reporting:** the runtime
    typecheck was reported clean earlier in this session while
    `a4p4-operation-single-shot.test.ts` still carried a wrong
    `abandonments` record shape (a real `TS2345`). It was found and fixed in
    this final pass; the current `8 Done` is the observed state, the earlier
    claim was premature.
