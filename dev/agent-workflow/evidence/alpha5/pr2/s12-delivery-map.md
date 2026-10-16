# Alpha.5 PR2 — §12 evidence set (Operation Admission + multi-effect ApprovalCase + one-shot Grant)

Branch `alpha5-pr2-admission-grant` (stacked on PR1). This file is the delivery
map required by §12 (a)–(h). Raw captures live in `runs/` next to this file.
Author: the PR2 implementation agent (model `qwen3.8-flash-next`). Independent
review is the coordinator's to schedule (§12(f) below states what is ready for it).

## (a) Plan / DoD → delivery mapping

PR2 plan section + the three hard clauses (user verbatim, 05:4x/07:0xZ), each with its pin:

| clause | law as landed | code pin | test pin |
| --- | --- | --- | --- |
| **H1** — Admission owns clock finiteness | every clock entering an authorization/expiry decision is verified FINITE by Admission FIRST; NaN/±∞ = typed `APPROVAL_STALE` (`details.refusal='clock-not-finite'`) with **body=0** (zero call side effects); PR0's strict `>` expiry UNCHANGED; the gate re-stands at the consumption edge (a non-finite refuse never spends the grant) | `packages/runtime/tool-admission/clock.ts:57` (`requireFiniteClock`); first-leg call `admission-kernel.ts:304-311` (`admit` runs the gate before identity/probe/plan/mint — `observe('admission-clock-refused')` is the only event); re-gate `grant-mint.ts:136` | `a5p2-admission-clock.test.ts` (gate refuses every non-finite; kernel body=0 pinned by port counters `sequence:[]`; consumption edge gated + grant stays spendable; PR0 `>` semantics re-pinned: `now===expiresAt` ok, `5001` expired) |
| **H2** — assurance runtime verification BEFORE hard-profile | a level NEVER redeems capability alone: each demanded dimension needs REAL mechanism/trustRoot/evidence + realmId matching a probe record; `enforced`+null mechanism = `TOOL_BINDING_UNVERIFIED` refusal; level-below-demand = `IO_POLICY_UNSUPPORTED`; probe is an injected port (stub until PR4, semantics pinned in the lane README); ordering probe-then-mint | `packages/runtime/tool-admission/assurance-runtime.ts:74` (`createStubAssuranceProbe`), `:117` (`verifyAssuranceForHardProfile`); kernel order `admission-kernel.ts:315` (assurance gate before the expansion plane and any mint) | `a5p2-assurance-probe.test.ts` (full matrix incl. realmId mismatch, blank strings, every-failing-dimension report, stub fail-closed on unobserved dimension); ordering `a5p2-admission-kernel.test.ts:191` (`sequence = ['probe:content-read','register']`) |
| **H3** — PR-freeze checklist | landed in the PR body as a checklist: (1) level↔evidence cross-law (PR0 MINOR-1) — RECOMMEND (可裁): `verifyAssuranceForHardProfile` IS its landing site (enforced+null = refusal implements the claim→evidence direction; the reverse direction is the PR4 probe's contract), close MINOR-1 by erratum pointing here; (2) effect-outside-grant mapping — RECOMMEND (可裁): KEEP the frozen `TOOL_BINDING_UNVERIFIED` (recorded in the lane README; `TEAM_TOOL_UNGOVERNED` would be sharper but §5's table is frozen); the policy-deny mapping stays `IO_POLICY_UNSUPPORTED` with a §5-erratum proposal `TEAM_POLICY_DENY` marked 可裁 | PR body §"PR-freeze checklist"; README "error-code rulings" section | `a5p2-grant-oneshot.test.ts` (effect-outside-grant keeps `TOOL_BINDING_UNVERIFIED`); kernel denial tests pin the rest |
| plan §5 — ONE logical ApprovalCase, multi-Effect | case identity = member + effect-set fingerprint + authority generation (NEVER a callId); opens at the highest per-effect rung (Alpha.4 all-or-nothing batching); LEGALITY per effect at execution via the A3-2 equation (`mayReview` ∧ `grantCeiling` on THAT effect's realm-qualified scope) — the max-rung shortcut is unrepresentable; deny/undetermined poisons the whole set; partial coverage refuses the WHOLE execution | `approval-case.ts` (`toolAskApprovalCaseId`, `planEffectSetApproval`, `verifyEffectSetApproval` — reuses `evaluateAuthorityCeiling`/`mayReview`/`grantCeiling`, no second ladder) | `a5p2-approval-case.test.ts` (17 tests: per-effect rungs A5-1 envelope families, escalation "required rung rose", leader-leg partial coverage refuses whole set while effect-0-alone passes, self-approval refused, `unavailable` doc slot = stale-never-legal, fingerprint/generation mismatch) |
| plan §5 — one-shot ExecutionGrant | mint runs through the frozen `parseOperationGrant` (`singleUse:true`) or never; validate-then-mark in ONE synchronous step; the ledger stores ONLY consumption (no second authorization fact); reuse/theft/expiry answers are PR0's frozen `grantRefusalErrorCode` mapping | `grant-mint.ts` (`mintOperationGrant`, `createGrantLedger.consume`) | `a5p2-grant-oneshot.test.ts` (12 tests incl. interleaved async consumers → exactly ONE winner, cross-Member theft `TOOL_BINDING_UNVERIFIED`, grantId-reuse refused, stranger-ledger refusal) |
| plan §5 — Cancel before/during/after | cancel-before-edge refuses with the grant UNspent; during → PR0 lease algebra (`cancelling` → settlement; `termination-unconfirmed` never refunds the one-shot); after → terminated never reopens | `admission-kernel.ts` (`consumeForExecution`, pass-through `requestCancellation`/`settleTermination`) | `a5p2-admission-kernel.test.ts` "Cancel before / during / after" (3 tests) |
| plan §5 — PR1 composition | Guard stays the OUTER door (deny never reaches Admission); a kernel refusal ends the Dispatcher call `refused` and drain still counts to zero; one call never spends another's grant | `a5p2-composition.test.ts` assembly (dispatcher decide → beginCall → admit → consume → endCallById) | 4 tests, incl. the throwing-admit self-count leg |

Lane reuse audit (no second judgment implementation): `deny<ask<allow` appears
ONLY via `planes.ts`'s dual-plane functions and Alpha.4's
`evaluateAuthorityCeiling`/`mayReview`/`grantCeiling` — the governance-hygiene
SURFACE rows were amended to name the two importing lane files per symbol
(`a3p3-governance-lane-hygiene.test.ts`, reviewed-amendment comments mark the
rows), and `a5p0-layer-audit` pins the exact consumer set (now 9 files).
`node scripts/audit-a5-tool-governance-imports.mjs` → `OK … 9 consumer file(s)`.

## (b) Base / HEAD / diff

- base = `45425a303a0170d194b8ecb78751145ebff282e4` (tip of `origin/alpha5-pr1-onto-master`, PR #255 head).
  Observation for the coordinator: **#255 merged into master 2026-10-16T08:06:56Z** (merge commit `db5cb5f7`)
  during this implementation round — this branch remains content-stacked on that exact tree; retargeting
  is the coordinator's call, this PR's base stays `alpha5-pr1-onto-master` as instructed.
- head = `4f2dfd0823673e6463d194e4d7ecbf8d8b2b4785` (commits `81c060f7` lane+tests, `4f2dfd08` p4t6 tie).
  F-6 口径 note: this is the **code head** as of this manifest's first capture — the branch head legitimately
  moves with evidence/docs/review-fix commits (router-log + evidence `7ab7599d`, PR1r freeze-hold `7a2998bb`,
  review round 1 below); the authoritative current head is `gh pr view 256`'s `headRefOid`, not this line.
- `git diff --stat 45425a30..HEAD` → 45 files, +4634 / −16 (lane 6 sources + README, 8 test artifacts,
  2 tsconfigs, audit script, layer-audit + hygiene + p4t6 pins, rebuilt `packages/runtime/dist` for the lane).
- CORE patch budget consumed: **0** (no upstream file touched; public seams only).

## (c) Incremental test artifacts

- RED-first: `runs/red-first-a5p2.log` — the six specs + harness with the lane sources REMOVED:
  `Test Files 6 failed (6) / Tests no tests` (module-absent collection failures; before any implementation existed in the room).
- GREEN (targeted): `runs/a5p2-green-targeted.log` — 6 files / **76 passed** (73 + the review-round F-1 pair and F-2 isolation test).
- p4t6 scanner: PRE-EXTEND RED `runs/p4t6-PRE-EXTEND-RED.log` (`expected 1087 to be 1073`, both endpoints
  MEASURED) → tie added → 10/10 green.
- Full suites: `runs/base-suite.log` (base 45425a30, EXIT=1: 22 known failures / 6651 passed),
  `runs/after-suite.log` (head: 21 failed / **6728 passed**, 528 files), JSON censuses beside them —
  recaptured after review round 1 on the COMMITTED tree (an interim capture, taken while the rebuilt dist
  sat uncommitted, correctly lit a4p7-merge-gate's install-surface-freshness leg RED; committing dist with
  its source turned it green again, and the final table shows NEW=0).
- Review round 1 (coordinator relay, F-1/F-2): F-1 foreign-member ApprovalCase presentation — RED
  `runs/red-F1-foreign-member.log` (2 failed: A's presentation issued for B, and a forged caseId, both minted
  before the fix) → kernel recomputes the case identity from the request's own member/fingerprint at the
  claimed generation → 23/23 GREEN. F-2 envelope-coverage isolation: a one-shot ~1080-input probe (script
  deliberately not kept in the repo) showed the DECIDED-not-allow coverage arm unreachable while one
  `documents` input feeds both half-legs (positional binding ⇒ rung leg implies coverage); the honest
  isolation point is subtree containment — new test pins refusal on the envelope arm with the rung arms
  explicitly excluded, and the SAME presentation legalizing once the containment seam answers.
- Fail-set table primary source: `runs/fail-set-diff.txt` (terminal, post-tie). The pre-tie `fail-set-diff.json`
  draft (it still carried NEW=1 from before the p4t6 tie landed) was removed to keep one master — the .txt
  is authoritative, any future .json is a derived convenience copy.
- CI: NOT_RUN (stacked). Session discipline (coordination 08:2xZ): the census-runtime is not
  terminal, so NO claim of "all CI green" is made anywhere in this PR or its evidence —
  every number above is a local run.

## (d) real-Host Run Receipt — N/A with reason

PR2 claims NO OS/Host capability and ships NO live wiring: the lane has zero production consumers
(audit shows `runtime/src/plugin/live/agent-bindings.mjs` untouched), the assurance probe is an injected
stub port, and the composition test is an in-process seam algebra (no spawn, no port, no DSH_HOME).
A Host run would certify a wiring that does not exist; the receipt rides with PR3/PR4, the first PRs
that execute through Admission. What IS pinned instead: probe-then-mint ordering, body=0 on every
refusal, and one-winner consumption.

## (e) baseline failure-set identity table

`scripts/fail-set.mjs` — base captured on pristine 45425a30 BEFORE any edit (`runs/failing-identities-base-45425a30.txt`, 22),
after captured on the final tree (`runs/failing-identities-after.txt`, 21):

| set | count | contents |
| --- | --- | --- |
| `only_in_after` (new red) | **0 (empty — the gate)** | — |
| `only_in_base` (resolved) | 1 | `a4p7-merge-gate::…static legs the scratch…cannot change another instrument's measurement` — a build-state leg of ANOTHER instrument: at base capture the worktree had no built dist, its scratch lint universe read 1159 vs 1158; after this branch rebuilt the committed runtime dist the leg measures itself green (the base census carries its raw message verbatim). No PR2 code path is under this leg; recorded, not chased. |

Corroboration: `scripts/lint-identities.mjs` identity diff (base worktree @ 45425a30 vs head):
universe 1158 → 1172 (= +14 = exactly the files this PR adds), **new 0, resolved 0**.
Typecheck full workspace: clean (`runs/` logs in router entry).

## (f) independent review

NOT run by this agent (writer ≠ reviewer). Ready for it: the lane, its 73 tests,
this §12 map, and the hash manifest. The p4t6/hygiene/layer-audit edits are the
repo's own amendment mechanisms and each carries its reviewed-amendment comment.

## (g) public issues / recorded debt

1. Live assembly wiring deferred to PR3/PR4 (lane DORMANT; audit admits it as a reviewed consumer only).
2. §5-erratum proposals: `TEAM_POLICY_DENY` for policy-denied effect sets (landed as `IO_POLICY_UNSUPPORTED`);
   effect-outside-grant KEPT `TOOL_BINDING_UNVERIFIED`. Both marked 可裁 in the lane README + PR body.
3. PR0 MINOR-1 (level↔evidence cross-law): this lane implements the claim→evidence direction
   (`enforced`+null = refusal); the evidence→claim direction is PR4's probe contract. Recommend closing
   MINOR-1 by erratum at freeze (可裁).
4. Grant ledger is in-memory per assembly by plan §5 (no second durable authorization fact); durability,
   if ever needed, is a PR6 ledger question.
5. The two red composition-smoke legs in the base fail set (client dist not built in this worktree) remain
   red — pre-existing, named by PR1's `cbc98c1e`, untouched here.
6. **FREEZE-HOLD (coordination 2026-10-16 08:2xZ):** runtime-release semantics of the admission
   interface (`approval-case.ts` / `grant-mint.ts` provenance legs: what enters
   `parametersFingerprint` / call identity; which seam record proves the validate→late-resolution
   window) are NOT frozen pending the `alpha5-pr1r-residual-boundaries` closure (R-a trusted
   provenance — `schemas()` is not a trusted source, `tools.get` identity comparison, no explicit
   bind ⇒ refuse; R-b deterministic negative control / seam record for the window), based on master
   `db5cb5f7`. PR2 is pure preparation (contracts + tests + docs) until that close; the
   provenance-agnostic algebra (dual-plane expansion, per-effect A3-2, one-shot edge, H1/H2 gates)
   stands and is reviewable now. Pinned at the code in the lane README "NOT FROZEN" section and in
   the PR body. The §5 erratum items stay 可裁 untouched, awaiting the user.

## (h) token scrub

No Host stdout was captured in this PR (no Host run). Scan of every evidence file for
`sk-*/Bearer/ghp_/token=` patterns: **0 hits** (`grep -rIoE … | wc -l` = 0). Census JSONs carry only
test names/assertion text; push transport is SSH; `gh` tokens never enter any file in this tree.
