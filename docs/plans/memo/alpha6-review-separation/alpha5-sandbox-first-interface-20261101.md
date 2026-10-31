# Alpha.5 Sandbox-First ↔ Alpha.6 Review-Separation — Interface Memo (2026-11-01)

> **Filename date** is the Alpha.5-side naming of the ruling and of PR #531 (its four documents are
> dated 2026-11-01). **This memo was authored and measured at real UTC 2026-10-31T18:46Z–18:51Z** (ROUTER_RULES
> §8.5.8 clock-anchor law: new dated anchors carry the `date -u` instant of writing, so the two clocks
> are named separately rather than blended).
>
> **Status**: Lane-2 governance record, docs-only. NOT current authority, NOT a merge/enablement
> authorization. Every number, line, and value set below was measured at a named commit in this file
> (never copied from prose); the commits are named in §2.

## 0. Status, honestly scoped

- **PR #531** (`ArmourPiercer1/dsh-agent-team`, measured via `gh pr view 531`):
  title `DRAFT: Alpha.5 Sandbox-First redesign — native immutable, generic Service/OS execution, PoC gates`;
  `state=OPEN`, `isDraft=true`, `baseRefName=master`, `headRefName=design/alpha5-sandbox-first-20261101`,
  head `32b81fcd8b3b5ab8d2c2089d743425438edf3ad8`; `changedFiles=4`, `additions=406`, `deletions=0`.
  Its own status banner: **DRAFT · DESIGN / POC ONLY · DO NOT MERGE OR ACTIVATE**.
  The four changed files are the only product of the PR:
  `docs/plans/memo/alpha5-sandbox-first-20261101/ADR.md`, `ARCHITECTURE.md`, `POC-PLAN.md`,
  `TRANSITION-PLAN.md` (verified by `gh pr diff 531 --name-only`). **Zero code files. Zero tests.**
- **It does not move the machine authority.** `gh pr diff 531 --name-only | grep -c current-authority.json`
  → `0`. Measured in this checkout at governance-branch head `991faacc4`,
  `dev/engineering/current-authority.json` is still `{"snapshot_version":"as20261026r1",
  "content_digest":"sha256:93692d7aeb3b097c3b3467e0a9207f1da5f05c2c1cb324c74d25168b1516a4d4"}` and
  `node scripts/current-authority.mjs` resolves it to phase `alpha5-tool-io-governance`,
  `active_plan = docs/plans/active/unified-baseline-alpha5/current-implementation-plan.md` — the PR #364
  unified-baseline plan the user ruled on 2026-10-25 to be the sole implementation-plan 正本.
  **PR #364's plan remains the machine-active contract.** Nothing in #531 may be treated as current
  contract for its proposed execution interfaces; its own TRANSITION-PLAN §1 and ADR §7 say the same.
- **The user's 2026-11-01 ruling, as relayed with the external design review** (recorded here so it is
  durable, not conversational): **Alpha.6 continues** — it is not rebuilt, not paused as a work package —
  but **no new reviewer-approval capability may be wired into a production execution path until the
  authorization/execution interface contract between the two projects is re-confirmed.** Under the same
  ruling, **large real execution under the current regime is deliberately paused** pending that
  interface re-confirmation (see §6 — future rounds must not read the pause as a stall).
- **External design review verdict (relayed 2026-11-01)** — two contracts must be re-examined:
  (1) the **identity and scope of an approval object**; (2) **how an approval result composes with the
  new `MemberPolicy` I/O enforcement**. Plus four keep-rules: `ControlService` stays the single
  decision authority; `ControlService` / `TeamDomain` / durable facts live in the trusted Host and
  never inside the Member's confined execution environment; a Member may submit approval requests only
  through a strictly limited Host interface; the Review Officer is itself an ordinary Member and must
  gather evidence under its own permissions.
  **Cross-check result, stated explicitly instead of copying:** none of these claims is contradicted by
  the code or by PR #531 as read. The keep-rules are *consistent* with the design docs — ADR §7 keeps
  "Alpha.4 准入与 ApprovalCase" and TRANSITION-PLAN T1 names "以 Alpha.4 原始审批权威为唯一工具调用准入源"
  — and consistent with this lane's measured code (§2). But two of them (trusted-Host placement of
  durable facts; evidence-gathering under the reviewer's own I/O permissions) are **forward-looking
  requirements, not sentences #531 currently states verbatim**: ARCHITECTURE.md places enforcement
  outside the tool body (A5-BOUNDARY-01) and says approvals complete before managed effects (§4), yet
  no sentence there or in ADR.md pins where the approval *ledger* lives once an os-confined realm exists.
  That gap is exactly open question 1/2 territory (§3, §4) and is why this memo exists.

## 1. The boundary split, as Alpha.6 will hold itself to it

- **Alpha.5 owns I/O permission enforcement**: `MemberPolicy` → invocation authority →
  service-mediated and/or OS-confined execution (PR #531 ADR §2–§3, ARCHITECTURE §2). Which bytes a
  Member may read, write, or reach over the network is decided by the compiled policy at the execution
  boundary — never by a reviewer's sentence, never by a tool body's good intentions.
- **Alpha.6 owns the decision side**: *who* decides an approval and *who may approve* (the role
  closure plus the case-scoped admission check), **wake de-duplication** (the single-flight
  review-wake kernel), and the **durability of approval facts** (the governed durable writer).
- **The frozen cross-project invariant, in words**: an operation executes only if it is authorized by
  the approval/authorization plane **and** permitted by the enforced I/O authority. Both must hold,
  independently, at execution time. One project's answer never becomes the other's input data.
- **And as a formula**:

  `EffectivePermission = OperationAuthorization ∩ EnforcedI/OAuthority`

  `∩` means **both must hold** — two independent gates ANDed at the point of execution. It does **not**
  mean the two data models must match, share identity, or be unified: `ApprovalCase`/`ReviewPlan` and
  `MemberPolicy`/`InvocationAuthority` are allowed — and today are — disjoint vocabularies. A future
  adapter may translate between them; it may not merge their authorities.
- **Derived prohibition 1 (approval ⇒ no policy write)**: an Alpha.6 approval **must never** modify OS
  sandbox or Blueprint policy configuration. An approval is a decision fact about one case leg; it is
  not, and cannot be made into, a write to `MemberPolicy`, Blueprint, or any sandbox profile.
- **Derived prohibition 2 (allow ⇒ no I/O bypass)**: an Alpha.6 `allow` **must never** be interpreted
  as bypassing a Blueprint file or network restriction. Enforcement-side denial wins regardless of any
  approval-side allow; the guard's `allow` is a *necessary*, never a *sufficient*, condition for I/O.

## 2. The frozen contract surface — measured, not transcribed

**Measured commits (name these when citing any line below):**

| Ref | Commit | Used for |
| --- | --- | --- |
| `GOV` | `991faacc4f373485b7d810de16a35518214a9301` (branch `alpha6/lane2-governance-20261031`, porcelain 0) | everything not listed otherwise |
| `P531` | `32b81fcd8b3b5ab8d2c2089d743425438edf3ad8` (`design/alpha5-sandbox-first-20261101`, PR #531 head) | the four design docs |
| `P517` | `3d06d52a9bb9791620ae1038dfd2561acff514d9` (PR #517 head, `alpha6/lane2-pri1a-writer-20261031`) | the durable writer |
| `P522` | `f1f19277ba759a87dd34424251ed872db7c77385` (PR #522 head, `alpha6/lane2-pri1b-admission-20261031`) | the assignment-admission closure |

`P517` is mid-work by another agent; it may advance after this writing. Every claim below is at the
named sha — a later reader re-measures rather than trusts the line.

> **Dated re-check of every pin above, written and measured at real UTC 2026-10-31T21:14Z–21:24Z (`date -u`;
> §8.5.8 clock-anchor law: a new dated anchor carries the instant of writing, so this line is stamped by the
> clock, not by this memo's filename date). No pin moved. Three of the four "…head" labels went stale, and one
> published line locator moved with real content behind it — reported, not retyped.** Round-6 review of PR #522
> (finding **F-I1b6-11**, report left in the lane's scratch, not in tracked content) caught the `P522` row
> labelling a pinned measurement point as a live head. That is the defect class this note exists to close: a
> **sha pin is a measurement point and stays**; what can rot is the parenthetical that claims it is the current
> head. So each row was re-read against `gh pr view <n> --repo ArmourPiercer1/dsh-agent-team --json
> headRefOid,headRefName,baseRefName,state,isDraft,changedFiles,additions,deletions`, then the *content the row
> anchors* was re-diffed `git fetch origin <branch>` + `git diff --name-only <pinned sha> <live head> -- <the
> paths this memo actually claims>` (Appendix A.1 carries the commands verbatim; nothing here retypes a pin or a
> line number above):
>
> - **`GOV` → live head `f559ff2ec98522e5c14e5fdda592e16caa20b7fb`**, 1 commit later — and that one commit is this
>   memo's own publication commit. `gh pr view 513` names the live referent the old wording only implied: PR **#513**
>   is this branch (`headRefName=alpha6/lane2-governance-20261031`, `baseRefName=alpha6/lane2-pr2-assignment-20261031`,
>   `state=OPEN`, `isDraft=true`). Re-diffed pinned → live for every file whose line numbers §2.1–§2.4/§2.6/§3/§4
>   publish (`control/types.ts`, `control/service.ts`, `review-mandate/types.ts`, `review-mandate/mandate.ts`,
>   `review-mandate/plan.ts`, `review-assignment/types.ts`, `a6-pr0-mandate-admission.test.ts`, and the
>   `a6-pr0`/`a6-pr2`/`a6-pr3` lane-hygiene specs, plus `dev/engineering/current-authority.json`):
>   **empty — 0 changed files**, so every published locator still reads true at the live head (re-spotted:
>   `CONTROL_REQUEST_KINDS` `:163`, `CONTROL_RESOLVER_ROLES` `:193`, the four stations `:2622 / :4852 / :5228 / :5495`,
>   `CONTROL_ROLE_CLOSURE_MIRROR` `:82`, `SCOPE_FORM_UNKNOWN` `:209-210`, `ReviewCaseView` `:217`, `ALLOWED_CONSUMERS`
>   `[]` at `a6-pr2…:47` and `a6-pr3…:38`, `[runtime/review-assignment/router.ts]` at `a6-pr0…:62`). The row's
>   "(branch …, porcelain 0)" described the measuring checkout, not a head — a governance branch moves with every
>   governance commit, this note's own included, which is precisely why the claims above are pinned by sha.
> - **`P531` → live head `32b81fcd8b3b5ab8d2c2089d743425438edf3ad8` — unchanged**, so its diff is empty by identity and
>   there is **nothing to correct**. Re-read anyway, because §0 quotes more than the sha: `state=OPEN`, `isDraft=true`,
>   `baseRefName=master`, `headRefName=design/alpha5-sandbox-first-20261101`, `changedFiles=4`, `additions=406`,
>   `deletions=0`, the same four document paths, and `gh pr diff 531 --name-only | grep -c current-authority.json` →
>   `0`. This bullet exists so a reader knows all four pins were freshness-checked, not only the one the reviewer
>   happened to catch.
> - **`P517` → live head `3ac9fd52e102720413c1105b2f78debf3f018af7`**, 2 commits later (PR-I1a round-2 / round-3 review
>   fixes). Re-diffed pinned → live for `packages/runtime/review-assignment/writer.ts`, for
>   `packages/runtime/test/a6-pr2-lane-hygiene.test.ts`, and as the wider sweep for all of `packages/`:
>   **empty — 0 changed files**; `writer.ts` byte-identical, `ALLOWED_CONSUMERS` still `readonly string[] = []` at
>   `:48`, so §2.5's measured dark-writer fact is untouched. Repo-wide those two commits moved 88 files — real-host
>   evidence, the execution log, the PR-I1a design memo, `tests/kits/pr-i1a-real-host/pr-i1a-real-host.mjs` — none of
>   which is a §2.5 claim. Round-6 named only `P522`; this label had moved too, so it is reported here instead of being
>   left for the next reader to trip over.
> - **`P522` → live head `f773d160371037672855f5401b4999c14c1b0128`**, 2 commits later (PR-I1b round-5: the P-1
>   instrument moved from a per-line regex to a compiler-AST instrument plus two allow-lists, and the P-2 closed set
>   was re-graded). Re-diffed pinned → live over the same four path sets F-I1b6-11 used —
>   `packages/runtime/review-assignment`, `packages/runtime/review-mandate`, `packages/runtime/dist`,
>   `packages/contracts/src` — **empty — 0 changed files**, an independent reproduction of that measurement;
>   `assignment-admission.ts` is byte-identical pinned → live with `ASSIGNMENT_ADMISSION_ROLE_CLOSURE` still at `:229`,
>   and the module is still absent at the live `P517`, `P531` and `GOV` heads, so "exists only on `P522`" (§2.3) holds
>   at every live head.
>
> **The one locator whose file really did change — reported, not retyped.** Between `P522` and its live head only
> 2 files moved: this lane's PR-I1b design memo and `packages/runtime/test/a6-pr-i1b-admission.test.ts`, and §2.3
> cites the latter for the two-way pin at `:1034-1036`. At the live head those three assertion lines sit at
> `:1045-1047` (the enclosing `it(…)` header moved `:1030 → :1041`); the three lines are **byte-identical** at
> both places — sha256 of the three lines is `17c7a23e18b628fbf0fccdd81d5d54bc27784e191e7c3685b18913e89908ca28`
> at `P522:1034-1036` and at the live head `:1045-1047`. So the claim ("the same closed three rows, mirrored
> whole, with a two-way pin against the center's table") is true at both commits, while the *locator* published
> above is true only at the pinned commit. Neither the sha nor the locator is being retyped here: retyping would
> erase the record of what was measured where, which is the whole value of a pinned measurement.
>
> **The machine-authority pin in §0 was re-checked too, because it is the pin that matters most and it is not a
> commit label.** `dev/engineering/current-authority.json` is byte-identical at `GOV` and at the live PR #513
> head — still `as20261026r1` / `sha256:93692d7aeb3b097c3b3467e0a9207f1da5f05c2c1cb324c74d25168b1516a4d4` — and
> `node scripts/current-authority.mjs` at the live head still resolves it to `phase_id=alpha5-tool-io-governance`
> with `active_plan=docs/plans/active/unified-baseline-alpha5/current-implementation-plan.md`, i.e. §0's
> "PR #364's plan remains the machine-active contract" is not a stale sentence. For completeness, and so that no
> reader goes looking for a pin that is not here: this memo pins **no** host/baseline commit sha — no
> `tests/paths.mjs` value (`DSH_BASELINE_VERSION` / `TEST_USE_BASELINE_SHA`) appears anywhere in it, so that
> class of pin has nothing to re-check in this document, and the live referent of the `GOV` label is PR #513's
> head, named in the first row.

> **Second dated re-check of every pin above, written and measured at real UTC 2026-10-31T22:32Z–22:42Z
> (`date -u`) — the closure round of PR #517 and PR #522.** Same method, same rule: a **pin is a measurement point
> and stays**; only the parenthetical claiming currency can rot. Trigger for re-running it: both lanes closed for
> themselves this round (§7), so both published "live head" labels above were already stale — that is the expected
> behaviour of a label over a moving branch, and it is reported, not argued with. Method per pin: `gh pr view <n>
> --repo ArmourPiercer1/dsh-agent-team --json number,headRefOid,headRefName,baseRefName,state,isDraft,changedFiles,
> additions,deletions` for the live head → `git fetch origin <branch>` (objects only — no checkout, no HEAD move, no
> worktree touch) → `git diff --name-only <pinned sha> <live head> -- <the paths the claim actually anchors>`, with
> the repo-wide range reported too so a reader can see what was *not* anchored. Commands verbatim in Appendix A.2.
> **Nothing moved: zero pins changed, zero locators retyped, zero measurements deleted.**
>
> - **`GOV` → live PR #513 head `fe8918209a94c03bedd15f334135b11670301861`**, 2 commits after the `f559ff2ec…` label
>   above (that memo-publication commit, plus the previous round's pin re-check commit). Re-diffed pinned → live for
>   the same 11 files whose locators §2.1–§2.4/§2.6/§3/§4 publish: **empty — 0 changed files**; repo-wide the range is
>   3 files, all of them this lane's own prose (`dev/agent-workflow/SESSION_ROUTER_LOG.md`, this memo, and the
>   execution-plan memo). So every published locator above still reads true at the live head, and the row's currency
>   label is stale in the only way a governance branch's can be — by governance commits happening. The live referent
>   of this label moves again with **this** round's commit, which is disclosed here rather than chased.
> - **`P531` → live head `32b81fcd8b3b5ab8d2c2089d743425438edf3ad8` — unchanged**; the pinned→live diff is empty by
>   identity. Re-read anyway because §0 quotes more than the sha: `state=OPEN`, `isDraft=true`, `baseRefName=master`,
>   `changedFiles=4`, `+406 / −0`. Nothing to correct, and this bullet is here so the reader knows the freshness check
>   ran on all four pins, not on the two that moved.
> - **`P517` → live head `199e18cc45f81d3b2b8fa757c78418b7da744ac4`**, 4 commits after the `3ac9fd52e…` label above
>   (that round's fixes plus round-4 and round-5 fixes). Re-diffed pinned → live for
>   `packages/runtime/review-assignment/writer.ts`, for `packages/runtime/test/a6-pr2-lane-hygiene.test.ts` and for all
>   of `packages/`: **empty — 0 changed files**; `writer.ts` byte-identical (sha256
>   `6c1d5ee469df6b80e4ee162d3ff25a2d7215134da2752ddb4677659eaa1964ec` at both endpoints), the writer spec
>   `packages/runtime/test/a6-pri1a-writer.test.ts` byte-identical (`2e6412b0c7a0b224c53dce08c0db8afb1a1dc789b45aaa5806f974d90c5932ed`
>   at both), and `const ALLOWED_CONSUMERS: readonly string[] = []` still at `:48` — §2.5's measured dark-writer fact
>   is untouched. Repo-wide the range is **128 files**: 126 under `dev/agent-workflow` (real-host evidence), the PR-I1a
>   design memo, and one kit file. **The guardrail instrument on this PR did move**, and saying so is the point of
>   this bullet: `tests/kits/pr-i1a-real-host/pr-i1a-real-host.mjs` went from sha256 `1e34a06880b478b3…` at the pin to
>   `16887de54cbc1322…` at the live head (+538 / −21, 539 → 1055 lines) — the driver whose FAIL header §2.5's family
>   of claims grew around. **This memo cites no line number inside that driver**, so no locator here moves; what the
>   move does prove is the general rule for anyone quoting that lane: a sentence naming a line in that file is true
>   only at the commit it names, and the lane's own record already says the byte-identical FAIL header holds from
>   `64f005cde` onward, not from the pin.
> - **`P522` → live head `aee7cec18d69c2144d57ce62c0fc31fe55a33397`**, 4 commits after the `f773d1603…` label above
>   (`cb7c961f6`, `f773d1603`, `afc17dd63`, `aee7cec18` — rounds 5 through 8 of that PR). Re-diffed pinned → live over
>   the same four path sets the previous round used — `packages/runtime/review-assignment`,
>   `packages/runtime/review-mandate`, `packages/runtime/dist`, `packages/contracts/src` — **empty — 0 changed
>   files**, so **the content claim recorded in the block above still holds, two commits further out**: the door
>   `assignment-admission.ts` is byte-identical at all three commits (sha256 `1d0195f3cc309c6d4825c3ecc6ad0f1b364cce226d2b4a92497b709c4cdd763f`)
>   with `ASSIGNMENT_ADMISSION_ROLE_CLOSURE` still at `:229`, the lane `dist` and `packages/contracts/src` moved not
>   at all, and the module is still **absent** at live `P517`, `P531` and `GOV` (`git cat-file -e` → ABSENT three
>   times), so §2.3's "exists only on `P522`" holds at every live head. `const ALLOWED_CONSUMERS: readonly string[] =
>   []` is still an empty list at `:56` of that branch's copy of the PR2 hygiene spec.
>
> **What genuinely moved on `P522` — the guardrail spec itself, and what that does to line-number sentences.**
> Repo-wide, `P522 → live` moved exactly 2 files: that lane's design memo (`+107 / −0`) and
> `packages/runtime/test/a6-pr-i1b-admission.test.ts` — **the guardrail spec, `+1428 / −2`, 2051 → 3477 lines**. That
> file is the one §2.3 cites for the two-way role-closure pin, so the sentence in the block above that published
> `:1045-1047` as the live position is now itself a stale measurement, and it stays visible: the same three assertion
> lines are at **`:1100-1102`** at `aee7cec18` (the enclosing `it('the role-closure mirror equals
> CONTROL_RESOLVER_ROLES…')` header sits at `:1096` there, having travelled `:1030` → `:1041` → `:1096`), and the
> three-line slice is byte-identical at all three places — sha256
> `17c7a23e18b628fbf0fccdd81d5d54bc27784e191e7c3685b18913e89908ca28` at `P522:1034-1036`, at `f773d1603:1045-1047`,
> and at `aee7cec18:1100-1102`. Recorded **beside** both older numbers, not instead of them. The plain statement the
> user asked for: **the guardrail spec moved (its spec and its memo moved on both PRs), and any sentence that cites a
> line number in those files — in this memo, in the execution log, or in a future report — is true only of the commit
> it names.** Nothing in §2.3's *claim* changed; the locator's currency did. Both moved lanes' spec-plus-memo pairs
> are the same shape: prose and instrument advance together, so a locator is worth exactly what its commit label is
> worth.
>
> **Machine-authority pin, re-checked again because it outranks the commit labels.**
> `dev/engineering/current-authority.json` is byte-identical at `GOV`, at the live PR #513 head `fe8918209…` and in
> this worktree (sha256 `42465659edeb03d85f42975969c77b2790827ee91228c7e48ef13ee438ffb0ae`) — still `as20261026r1` /
> `sha256:93692d7aeb3b097c3b3467e0a9207f1da5f05c2c1cb324c74d25168b1516a4d4` — and `node scripts/current-authority.mjs`
> still answers `"ok":true, "status":"POINTER"` with `phase_id=alpha5-tool-io-governance` and
> `active_plan=docs/plans/active/unified-baseline-alpha5/current-implementation-plan.md`, `two_current_findings=[]`.
> So §0's "PR #364's plan remains the machine-active contract" is measured, not remembered. This memo still pins no
> host/baseline commit sha, so that class has nothing to re-check here — no value of `DSH_BASELINE_VERSION` /
> `TEST_USE_BASELINE_SHA` appears in this document, and that is stated rather than left for a reader to discover.

**2.1 `CONTROL_REQUEST_KINDS` — the closed request vocabulary (GOV).**
`packages/runtime/control/types.ts:163` —
`{ LEADER_APPROVAL: 'leader-approval', USER_APPROVAL: 'user-approval', ENVELOPE_MUTATION: 'envelope-mutation' }`
(closed, `as const`; the union type at `:173`, the values array at `:176`). The resolver-role closure
`CONTROL_RESOLVER_ROLES` is at `control/types.ts:193`:
`leader-approval → ['leader','human']`, `user-approval → ['human']`, `envelope-mutation → ['leader','human']`;
its doc comment (`:190-192`) states invariant 37 — **a Member is never a resolver for any kind**; the
role closure is checked before the envelope.

**2.2 `ApprovalCase` and the view fields Alpha.6 consumes (GOV).**
The durable Alpha.4 objects live in the protected center: `ApprovalCaseIdentity`
(`control/types.ts:453`; every field derived server-side, `approvalCaseId` is the deterministic
identity hash of the frozen fields), `ApprovalCaseState` (`:548`; legs, escalations, current leg,
status, `reviewedBy` as a principal set). Alpha.6 never imports those; it consumes a **folded view**,
`ReviewCaseView` (`packages/runtime/review-mandate/types.ts:217`), produced by the caller from
`buildApprovalCaseState` (`control/service.ts:4363`) — fields, at `types.ts`: `approvalCaseId` `:220`
(`string | undefined` — absent on leg-less rows, and absence alone disqualifies a row from delegation,
the L-2 gate), `requestKind` `:221`, `legReviewAuthority` `:224`, `legOrdinal` `:225`,
`currentLegOrdinal` `:227`, `actedCallerRefs` `:229`, `requesterCallerRef` `:231`,
`beneficiaryCallerRef` `:232`, `subjectCallerRef` `:235`, **`actionName` `:237`**,
**`effectScopeFingerprint` `:239`**. Both bold fields are enforced well-formed at the admission entry:
`packages/runtime/review-mandate/mandate.ts:120-121` refuses a non-string or empty `actionName` /
`effectScopeFingerprint` as `REVIEW_CASE_MALFORMED` — a malformed row is a closed-code refusal, never a
TypeError inside the decision write path. Closed vocabularies the view is built from
(`review-mandate/types.ts`): `REVIEW_RUNGS = ['member','leader','human-user','human-admin']` `:67`;
`REVIEW_REQUEST_KINDS = ['leader-approval','user-approval','envelope-mutation']` `:71`;
`DELEGABLE_REVIEW_RUNG = 'leader'` `:80`; `DELEGABLE_REQUEST_KIND = 'leader-approval'` `:83`;
`REVIEW_CALLER_ROLES = ['leader','member','human']` `:86`;
`REVIEW_MANDATE_DECISIONS = ['allow','deny']` `:91` (escalate/stale-denied are entrances, not choices).
The grant-shaped derived view `ReviewMandate` (`:182`) carries `approvalCaseId`/`legOrdinal`/
`reviewerInstanceId`/`planEpoch`/`actionName`/`decisions`/`effectScopeFingerprint`/`revoked`/`generation`.

**2.3 The role/resolver closure Alpha.6 mirrors — two sites, one law.**
- `CONTROL_ROLE_CLOSURE_MIRROR` — `review-mandate/mandate.ts:82-86` (GOV): the frozen three-row table,
  identical to `CONTROL_RESOLVER_ROLES`. **Mirrored, not imported**, for the reason stated at
  `mandate.ts:75-81`: `control/types.ts` sits inside the ARC-A digest-pinned protected center and a
  lane module must not put the kernel into its compile graph for a 3-key table. The duplication is
  policed, not assumed: the PR0 test reads the protected source text and asserts the mirror still
  agrees (`packages/runtime/test/a6-pr0-mandate-admission.test.ts:34,144,153`).
- `ASSIGNMENT_ADMISSION_ROLE_CLOSURE` — exists only on `P522` (PR #522 head), at
  `packages/runtime/review-assignment/assignment-admission.ts:229-233`, the same closed three rows,
  mirrored whole (even the deliberately unmapped `user-approval → ['human']` row) rather than filtered,
  with a two-way pin against the center's table
  (`packages/runtime/test/a6-pr-i1b-admission.test.ts:1034-1036`). The governing hygiene rule is why:
  the lane tests forbid any module of the lane to import a protected prefix — `PROTECTED_PREFIXES`
  starts with `control/` (`a6-pr0-lane-hygiene.test.ts:68`, law 2 at `:13-16`; `a6-pr2-lane-hygiene.test.ts:54`).
  The execution log recorded what that meant in practice (SESSION_ROUTER_LOG entry「PR #522（PR-I1b）实现落地」,
  :7607-7608): `CONTROL_RESOLVER_ROLES` is reachable through the center's public barrel but the hygiene
  law convicts the `control/` relative specifier, so it became **reachable-but-forbidden** and the
  frozen mirror with bidirectional pins replaced the import. **Disclosure against my own brief**: the
  task named this mirrored symbol as the one at `mandate.ts`; at GOV the mirrored closure is
  `CONTROL_ROLE_CLOSURE_MIRROR` — `ASSIGNMENT_ADMISSION_ROLE_CLOSURE` exists only on `P522`. Both are
  published above so no reader has to guess which symbol a given line was measured on.

**2.4 The `ControlService` sole-entry claim (GOV).**
`packages/runtime/control/service.ts:10-11` — "the control module NEVER executes tool operations; it
only durably authorizes and refuses them" (Development Plan 19.4); `:23-24` — durable writes go ONLY
through the injected TeamDomain repositories (invariant 41: TeamDomain is the Team control-plane
durable authority). The one decision write path is `resolveControl` (`service.ts:2555`), where "the
first decision is authoritative" (`:2615`). The four role-closure stations Alpha.6's PR-I1b design
targets measure, at GOV, at `control/service.ts:2622 / :4852 / :5228 / :5495` — each line is a
`CONTROL_RESOLVER_ROLES[...]` lookup (re-measured here; the same four numbers as execution-plan §1).
The lane's own restatement: a reviewer acting on an assignment "still passes the single ControlService
write path, which re-reads the latest leg, the live mandate and the rung"
(`packages/runtime/review-assignment/types.ts:13`). This is the review's "single decision authority"
keep-rule, and it is true as measured — with the honest qualifier that Alpha.6's *admission* function
is today consulted by no production caller (§2.6), so the sole entrance is sole in both name and fact.

**2.5 The durable writer's governed-writer fact (`P517`).**
The one module that appends `review-assignment-*` rows is
`packages/runtime/review-assignment/writer.ts`, which exists only on `P517` — its header: "the one
durable writer of `ReviewAssignment` facts"; law D-1 makes a second writer a test failure. The
governed-writer fact is the pin that today **nothing may call it**:
`packages/runtime/test/a6-pr2-lane-hygiene.test.ts:48` (at `P517`; `:47` at GOV) —
`const ALLOWED_CONSUMERS: readonly string[] = []`. The sibling wake-kernel lane pins the same empty
list (`a6-pr3-lane-hygiene.test.ts:38` at GOV). The only admitted consumer in the whole lane family is
`runtime/review-assignment/router.ts` for PR0's vocabulary (`a6-pr0-lane-hygiene.test.ts:62` at GOV),
and that router is itself unreachable because the assignment list is empty. **Zero production callers
today — that is a measured `[]`, not a claim.**

**2.6 What Alpha.6 does NOT have today.** No path from a reviewer decision to `allow` exists
(`mandate.ts` module header; execution-plan G-5). No Alpha.6 module touches a file, a socket, or a
sandbox. The Review Officer is bound as an ordinary Member instance — a caller wearing Member clothes
while `isLeaderInstance` is refused outright (`mandate.ts:258`), identity is bound once and never
travels (`:270`) — so the review's "itself an ordinary Member" keep-rule already matches the law as
measured; what it does **not** yet have is any statement of what "gathering evidence under its own
permissions" means once a `MemberPolicy` regime ships, because today a reviewer's evidence-gathering
I/O is governed by exactly nothing Alpha.6 owns. That is §3/§4.

## 3. Open interface question 1 — fingerprint identity (decision, not code)

**Current behaviour, exactly (GOV).** `ReviewPlan.effectScopes` admits exactly two forms —
`exact-fingerprint` and `by-action-name` — and the parser refuses anything else at parse time:
`packages/runtime/review-mandate/plan.ts:209-210` (`SCOPE_FORM_UNKNOWN`: "there is no wildcard"; code
in the closed failure list at `:61`). An `exact-fingerprint` value must be 16–128 lowercase hex — never
a prefix, never a glob (`:214-216`); a `by-action-name` value must name an action the plan itself
lists (`:218-219`). Then the covering law: `planCoversEffectScope` (`plan.ts:333-344`) matches exact
fingerprints byte-for-byte, and **a `by-action-name` scope covers *every* fingerprint of that action**
(header at `:328-331`, code at `:341-342`) — always still scoped to a listed action, so a plan listing
only `fs:write` answers false for `net:fetch` even at a coinciding fingerprint. Grant agreement
re-derives the same coverage at every call (`mandate.ts:205-212`).

**Why the redesign touches it.** Under the Alpha.4/Alpha.5 per-tool `EffectSet` execution model,
"every fingerprint of `fs:write`" was a *bounded* scope, because the fingerprint space was the
Alpha.4 effect-set identity. Under MemberPolicy-based I/O the identity of an "effect" is no longer
pinned by this repo's contract: if an I/O-expansion request reuses the mandate grammar, a
`by-action-name` mandate can silently widen into a blanket approval for arbitrary writes (over-delegation),
or a changed fingerprint derivation can make previously-matching scopes silently stop matching
(failure-to-match) — and both failure modes are *silent* in the current code because equality is
plain string equality against whatever the caller folded in.

**Options on the table (recorded as decisions to be made, none taken now):**

1. **Keep Alpha.4 fingerprints for Alpha.4 approval objects.** `operationFingerprint` /
   `effectScopeFingerprint` keep their Alpha.4 semantics for existing cases and plans — an Alpha.4
   approval object remains identified exactly as today.
2. **Any future I/O-expansion request is a separate, versioned request type** with its own identity
   and its own policy delta — it never reuses an existing mandate's fingerprint space, because sharing
   the space is precisely how "approve this write" drifts into "approve all writes".
3. **A thin adapter between the two identity spaces** — possible in principle, explicitly deferred to
   the later differential review, **not decided here**.

**No code change in this round**, and the reason is recorded with the decision: the machine authority
is unchanged (§0), and inventing an adapter against an unfrozen contract is how two projects end up
with a fake interface — a translation layer whose two ends both change underneath it.

## 4. Open interface question 2 — version binding (decision, not code)

**Current behaviour, exactly (GOV).** `ReviewPlan` binds `blueprintDigest` (a 64-hex content hash the
live blueprint is verified against, `review-mandate/types.ts:124`) and `epoch` (`:127`); the plan is
immutable for `(rootSessionId, blueprint digest, epoch)` (header `:115-119`). A mandate must carry the
runtime's current epoch (`mandate.ts:201`, `REVIEW_MANDATE_EPOCH_MISMATCH`), a plan whose epoch is not
current is refused live-check (`mandate.ts:177`, `REVIEW_PLAN_EPOCH_STALE`), and expiry is a *separate*
law from epoch by design (`types.ts:137-143` — if both were epochs, expiry could never fire).

**The requirement the redesign imposes.** When policy changes, **neither an existing mandate nor a
not-yet-executed approval may remain valid without re-validation.** Today's epoch machinery proves the
shape for blueprint changes; a `MemberPolicy.revision` (PR #531 ADR §3: "immutable authority
generation") is a third clock nobody has reconciled with the other two.

**What must be decided (named, not answered):**

1. How `blueprintDigest` and `epoch` **relate to a future `MemberPolicy.revision`** — same generation
   counter, cross-referenced generations, or a composite validity token. Any of the three is coherent;
   silently *none* of the three (two projects each assuming the other re-validates) is the failure mode.
2. **Which component refuses when they disagree** — the admission check (Alpha.6's entrance), the
   execution-side provider (Alpha.5's boundary), or both independently. Per §1's invariant both gates
   AND, so "both independently" is the default posture; the open half is which one *names* the
   disagreement with a typed refusal rather than a generic deny.

**No code change in this round** — same recorded reason as §3: the machine authority is unchanged and
the contract this would bind against is unfrozen.

## 5. Capability-graded enablement gate (for eventual production)

Three explicit rules. Until the interface contract of §3/§4 is re-confirmed, these bind this lane:

1. **Authorization-loop completeness is the entry ticket.** Only operations whose Alpha.4
   authorization loop is complete (request → decision → guard consumption, end to end) may enter the
   restricted Alpha.6 approval-integration validation at all.
2. **A Review Officer's ability to approve confers no execution clearance.** A tool that has not
   passed the new I/O execution-boundary verification gets no production clearance from the fact that
   a Review Officer can approve it — approval reach and execution readiness are different gates (§1's
   ∩, applied to enablement).
3. **Unfrozen expansion ⇒ no auto-approve.** While `MemberPolicy` expansion is unfrozen, Alpha.6 must
   not auto-approve any new I/O-expansion request type; when §3 option 2 creates one, its default is
   human decision until the differential review says otherwise.

## 6. What Alpha.6 keeps, and what is held

**Keeps (continues under the ruling):**

- The case-scoped mandate law and its hierarchy/ordering (PR0, #501) — the admission law as measured
  in §2.2/§2.3.
- The review router and its non-authorizing assignment facts (PR2′, #507).
- The single-flight wake kernel — wake de-duplication is Alpha.6's owned half of §1 and is unaffected
  by which component eventually executes I/O (PR3′, #503).
- The PR-I1a governed durable writer (#517, `P517`) — **orthogonal to the redesign**: it performs no
  file or network operation of its own; it appends ledger rows through the existing TeamDomain
  surfaces. The review's "durable facts in the trusted Host" keep-rule is satisfied by construction
  here — the writer is a Host-side module, and §2.5's `ALLOWED_CONSUMERS=[]` pins it dark.
- PR-I2's **immediate (event-driven) notification subset** — delivered and real-host measured; the
  timed-wake blocker does not touch it.

**Held (explicitly, with the record):**

- **Production wiring of approval into an execution path.** PR #522 (PR-I1b admission design, head
  `f1f19277b…`) **stays Draft + DO-NOT-MERGE and enables nothing**: its diff adds the dark
  `assignment-admission.ts` module, its tests, docs, and evidence — no protected-center file
  (`control/service.ts` is not in its diff), and the lane's `ALLOWED_CONSUMERS` stays `[]`. Under the
  ruling it may be reviewed and finished, but it must not reach a production execution path until the
  interface contract is re-confirmed.
  - *Dated correction to that label, written and measured at real UTC 2026-10-31T21:14Z–21:24Z (`date -u`)*: the
    sha above was the live head at authoring and has since advanced — live PR #522 head at re-check is
    `f773d160371037672855f5401b4999c14c1b0128` (`state=OPEN`, `isDraft=true`, `baseRefName` =
    `alpha6/lane2-pri1a-writer-20261031`, 2 commits later), so the sha above stands as **what was measured**, not
    as what is current. This bullet's own claims were re-measured at that live head against its merge-base with
    live `P517` (`a2bc18d783046c62db3f9db41a8d22dc716e5fa0`): files under `packages/runtime/control/` in its diff
    = **0**; `dev/engineering/current-authority.json` in its diff = **0**; `const ALLOWED_CONSUMERS: readonly
    string[] = []` still an empty list there (at `:56` of that branch's copy of the PR2 hygiene spec — that copy
    carries PR-I1b's added legs, which is why its number is not §2.5's `:48` at `P517` or `:47` at `GOV`; each
    number stays labelled by its own commit). Draft + DO-NOT-MERGE + "enables nothing" re-read true; the §2
    dated re-check carries the content diffs behind this line.
  - *Second dated correction to that label, written and measured at real UTC 2026-10-31T22:32Z–22:42Z (`date -u`)*:
    the correction above names `f773d1603…` as the live head and it is two commits behind — live PR #522 head at this
    re-check is `aee7cec18d69c2144d57ce62c0fc31fe55a33397` (`state=OPEN`, `isDraft=true`, `baseRefName` =
    `alpha6/lane2-pri1a-writer-20261031`, 28 files, `+7441 / −28`). Both shas stand as **what was measured at their
    own moment**, and neither is the pin. This bullet's claims were re-measured at the new head: the diff adds no
    protected-centre file (`packages/runtime/control/` → 0 files across `P522 → live`, and `dev/engineering/
    current-authority.json` untouched there), `const ALLOWED_CONSUMERS: readonly string[] = []` is still empty at
    `:56` of that branch's hygiene copy, and the admission module is still absent at every other live head. What
    *did* move between the two labels is the lane's own **guardrail spec**
    (`packages/runtime/test/a6-pr-i1b-admission.test.ts`, +1428 / −2) plus its design memo — measured content, not a
    label — and §7 records what that means for the guardrail's status (nothing: it is a tripwire whose backing facts
    are the three above, and those three are unchanged) while the §2 second re-check records what it means for line
    numbers (every one of them is bound to its commit). The PR closed for itself at this head as
    instrument-plus-honest-disclosure, with `F-I1b5-7` (symlink-into-`dist`) left open pending a build — this bullet
    does not claim that gap closed.
  - *Same round, PR #517's label*: the Keep bullet above names `P517` only as a pin and never claimed currency, so
    there is nothing to correct there; for the record, live PR #517 head at this re-check is
    `199e18cc45f81d3b2b8fa757c78418b7da744ac4` (`state=OPEN`, `isDraft=true`, base =
    `alpha6/lane2-pr2-assignment-20261031`, 173 files, `+28834 / −55`), it closed for itself as
    instrument-plus-honest-disclosure with the `F-I1a3-3` meta-ceiling **left open by design**, and §2.5's
    dark-writer facts (`writer.ts` byte-identical, `ALLOWED_CONSUMERS = []` at `:48`) were re-measured there.
- **PR-I2's floor-delayed timed-wake carrier.** `CORE_SEAM_BLOCKER` unchanged — status OPEN, scope
  strictly the floor-delayed carrier sub-capability
  (`dev/agent-workflow/blockers/alpha6-pr-i2-timed-wake-carrier-20261031.md`). The external review's
  point is recorded and accepted here: **bwrap or a new OS runner does not remove this blocker** — the
  missing public seam is a *time-triggered wake port*, which no filesystem/network sandbox primitive
  provides; the blocker's closure condition stays a host-provided `TimedWakePort`-semantic public
  primitive (or a user-ruled public carrier).
- **Any cross-system C2 regression run against the old execution chain**, until the new execution
  chain passes PoC — running it now would burn boot budget on a chain the redesign may replace.

**And, so future rounds do not misread the record**: *a large real-host test campaign under the
current regime is deliberately paused by user ruling* (§0). The pause is a decision with a named
restart condition (interface re-confirmation), not a stall, not a blocker, and not evidence that the
lane has stopped: docs, design reviews, dark-lane kernel work, and this memo's class of governance
work continue.

## 7. Scope rulings recorded at the closure of the two guardrail PRs

> **Dated 2026-11-01, written at real UTC 2026-10-31T22:32Z (`date -u`; ROUTER_RULES §8.5.8 clock-anchor law —
> this banner carries the writing instant, not a filename date).** PR #517 and PR #522 were each **closed for
> themselves** this round — closed *for that PR*, as **instrument-plus-honest-disclosure**, not merged: both stay
> Draft + DO-NOT-MERGE and §6's holds are unchanged by this section. Sources, named so a reader can re-read them:
> closure comment `6549996923` on #517 (head `199e18cc45f81d3b2b8fa757c78418b7da744ac4`, round-5 review
> `0 BLOCKER / 0 MAJOR / 1 MINOR / 3 INFO`) and closure comment `6549996746` on #522 (head
> `aee7cec18d69c2144d57ce62c0fc31fe55a33397`, round-8 review `0 BLOCKER / 0 MAJOR / 1 MINOR / 5 INFO`). The two
> review reports themselves live in lane scratch and a reader does **not** have them, so everything a ruling leans
> on is quoted here rather than pointed at. Still open after both closures, by design and not by oversight:
> **`F-I1a3-3`** — the quoting instrument cannot certify the *meaning* of its own self-check (measured
> meta-ceiling; open by design, and no sentence in this repository may claim it closed) — and **`F-I1b5-7`** — a
> symlink planted into the shipped `dist` is out of the instrument's reach until a build exists to plant into.
> One recorded nit rides the next touch: `F-I1b8-1` (`spec:2064`, "the one path" is false; understating direction).

**7.1 A static scan over source text is not a capability boundary.** Both lanes' guardrails are **review-time
tripwires**, and their real load is carried by measured facts and by code review, not by the scan:

- In the lane's own words (PR #522 design memo §12, `pri1b-admission-design-20261031.md`): 「按名字的 AST 规则不是
  能力边界——名字往后一跳、能力按成员带走，都还在名字规则之外。于是 P-1 发布的身份是**对本 lane 自己源码的
  review-time tripwire**；这条边界的真实承重是三件实测事实：`ALLOWED_CONSUMERS = []`（S-9，零调用方）、不发布任何
  入口、外加代码评审。」 The closure comment says the same in English: this file is 「a **tripwire over the lane's
  own source**, backed by `ALLOWED_CONSUMERS = []`, no shipped entry point, and review」.
- The same reading applies to PR #517's instrument: a span-signature quoting instrument certifies that printed
  bytes are **live and locally placed**, and certifies nothing else. A green scan or a green `--self-test` is a
  statement about the file, not about the product.
- **What the backing facts are, measured this round at the live heads** (Appendix A.2):
  `const ALLOWED_CONSUMERS: readonly string[] = []` at `packages/runtime/test/a6-pr2-lane-hygiene.test.ts:48` at
  live `P517` and at `:56` of that branch's copy at live `P522` (each number labelled by its own commit);
  `git grep` at live `P522` for any import of a `review-assignment` path outside `packages/runtime/test` and the
  lane's own `dist` → **zero production importers** (and the same grep without the two excludes answers only test
  files, which is the control proving the first grep is not silently empty); the module's only non-test reachability is the lane's own barrel
  (`packages/runtime/review-assignment/index.ts:35 export * from './assignment-admission.js'`), whose header `:11`
  states 「NOTHING calls either」; and `assignment-admission.ts` is **absent** at live `P517`, `P531` and `GOV`
  (`cat-file -e` → ABSENT three times). So: the file catches a human edit; the **empty consumer list, the missing
  entry point and the review** are what keep it from being a capability at all. Any future sentence that reads the
  scan itself as the boundary has mis-scoped the guardrail — and it is the sentence that is wrong, not the scan.

**7.2 The re-scope trigger: a tripwire becomes a boundary before its consumer merges.** Quoted from the #522
closure comment, because this is the sentence a future lane must obey: 「**the moment a consumer enters that list or
an entry point ships, P-1 must be re-graded as a boundary before that consumer merges**, with per-path runtime
closed-shape grading living in the issue #502 interface contract rather than in another static rule.」 Stated as
governance, the trigger is any one of three facts changing: (i) a name enters `ALLOWED_CONSUMERS`; (ii) an entry
point ships (the module gains a caller outside `packages/runtime/test`, including through the lane barrel); (iii) a
build or tooling consumer appears — a compiled artifact, a kit, or a script that imports the lane's `dist` rather
than its source. When any of them happens, the guardrail **stops being a tripwire at that moment**, and the
re-grading is owed **before that consumer merges**, not after: behavioural checks — live per-path `Object.keys`
closed-shape assertions on every verdict path, discriminated-union exhaustiveness — go into the **issue #502
interface contract**, and adding another static rule where a runtime check belongs is refused. Owner = the lane
introducing the consumer, in that PR (not the governance lane, later). The reviewer's own re-open list, quoted
(round-8 report, Duty 3): 「(1) a consumer enters `ALLOWED_CONSUMERS` or an entry point is exposed — then per-path
runtime exact-shape assertions become owed at the #502 interface (owed at spec:729-730); (2) any P-1 backing fact
changes — then P-1 is re-graded as a boundary with behavioural legs (memo §12.1); (3) the fold learns flow
tracking — the 0/0 pin breaks and its sentence must move in the same edit.」 This clause is the third named entry
in §5's enablement gate's family: §5 gates *enabling* a capability, this gates *reading* one as bounded.

**7.3 Quoted diagnostic bytes may never become evidence for a product claim.** Quoted from the #517 closure comment
`6549996923` — the sentence the reviewer took forward, and the half of that closure that is a rule rather than a
celebration: quoted bytes 「may be a diagnostic and must never become evidence for a product claim, because
containment certifies liveness and locality and nothing about semantics」. The same law is written into the
instrument's own re-open list, quoted verbatim from the round-5 report's §Duty 3 (scratch
`.artifacts/alpha6-s0/pri1a-rev5/round5-report.md`; mirrored into the PR-I1a memo banner and the Round-20 evidence
README section at `199e18cc4`):

> "(1) any leg's descriptor set is edited (spans/signatures change — the per-plant disclosures are plant-scoped,
> exactly as the disposition insists); (2) quoted bytes are ever used as **evidence for a product claim** rather
> than a diagnostic — containment certifies liveness and locality, never semantics; (3) the grade path absorbs
> file-wide uniqueness into the span rule (it would refuse the byte-correct A2 quote) or the sweep is weakened back
> into the span rule; (4) any quote path ever renders a stored line number instead of bytes read at grade time."

Trigger (4) is the one this memo has to obey directly: every locator in §2 and in its dated re-checks is a
*published measurement point*, labelled by the commit it was measured at, and none of them is what a quote is
evidence of. A `PASS` line that prints source bytes proves the leg is live and located; a claim about what the
product does needs a leg that runs the thing.

**7.4 Standing parity discipline — re-plant or retract, every round.** Every completeness word in a leg name or a
claim sentence (`every`, `all`, `at all`, `cannot`, `never`, `only`, `guarantee`, `boundary`, `closed`,
`independent`) gets **re-planted with a leg or retracted**, every round, against the bytes that are actually being
shipped. Where no rule exists to carry the sentence, **the sentence is deleted rather than defended** — the lane's
own precedent (PR #522 memo §12.1, F-I1b7-1): 「撤去 "cannot be dodged" 与 "only by leaving the file"，收窄到真实被
定级的键语法」, and round-8's sweep verdict: 「**Survivors: exactly one** — spec:2064, quoted verbatim above
(F-I1b8-1). Understating direction.」 The
discipline has a second half, and it is not optional: **shrinking a claim must never shrink coverage.** Round 8
recorded the arithmetic so the pairing is checkable — 「**No check deleted while prose deleted:** expect-count
arithmetic `afc17dd63 → aee7cec18`: **0 expect()s removed, 8 added**.」 Deleting a check is a separate, named act
with its own justification; it is not a side effect of honest wording.

**7.5 The process lesson, recorded honestly.** Nine review rounds were spent on PR #522 and twenty on PR #517 —
the lanes' own counts, quoted below. (Precise framing, so the number is not inflated either: rounds are counted on
the PR, so they include the fix rounds; the review that closed #522 was its round-8 review and the one that closed
#517 was its round-5 review.) Neither axis closed because the rule grew; **the guardrail axis closed when the claim
shrank.** The lanes' own
words, quoted: 「Twenty rounds on this PR; the instrument stopped improving at round 4 and started telling the truth
at round 4, and only the claim-attacks kept paying.」 (#517 closure) and 「Nine rounds on this module: the capability
axis closed when the claim shrank, not when the rule grew.」 (#522 closure). On #522, rounds 5–7 bought a compiler-AST
instrument, a value-conviction closed set and a computed-key fold — and then *retreated two sentences* to reach the
end state, whose text says the axis buys no more rules. On #517 the plants kept paying precisely because they
attacked the wording, not the mechanism. **So, for the next lane: scope the claim at tripwire size from the first
draft.** Name the backing facts inside the sentence, let a rule's ambition stop at what a leg actually executes,
put runtime shape guarantees in the #502 contract instead of in a scan, and say "detected, not certified" where
that is the truth. That costs far less than twenty rounds. It is not an argument for reviewing less — both axes
needed the plants that were thrown at them; it is an argument for not writing a sentence the plants will take away
in round five.

**Ledger consequence.** The trigger in §7.2 is recorded on the risk row that already owns the fact it consumes —
`R-7` in `alpha6-lane2-execution-plan-20261030.md`, dated extension of 2026-11-01, with an owner and re-runnable
checks. No new row was created: `R-7`'s controllability rests on `ALLOWED_CONSUMERS = []`, so a consumer appearing
is `R-7` becoming live, and a second row would have been the same risk written twice.

---

### Appendix A — measurement commands (reproducible at the named commits)

```
gh pr view 531 --repo ArmourPiercer1/dsh-agent-team \
  --json title,body,headRefName,baseRefName,changedFiles,additions,deletions,isDraft,state,headRefOid
gh pr diff 531 --repo ArmourPiercer1/dsh-agent-team --name-only      # the 4 doc paths; grep -c current-authority.json → 0
git fetch origin design/alpha5-sandbox-first-20261101                 # then git show FETCH_HEAD:<path> — HEAD untouched
node scripts/current-authority.mjs                                    # as20261026r1 / alpha5-tool-io-governance
grep -n CONTROL_REQUEST_KINDS packages/runtime/control/types.ts       # :163
grep -n CONTROL_RESOLVER_ROLES packages/runtime/control/types.ts      # :193 (definition)
grep -n "CONTROL_RESOLVER_ROLES\[" packages/runtime/control/service.ts # stations incl. :2622 :4852 :5228 :5495
grep -n "CONTROL_ROLE_CLOSURE_MIRROR" packages/runtime/review-mandate/mandate.ts      # :82 (GOV)
git show f1f19277ba759a87dd34424251ed872db7c77385:packages/runtime/review-assignment/assignment-admission.ts | grep -n ASSIGNMENT_ADMISSION_ROLE_CLOSURE
grep -n "exact-fingerprint\|by-action-name\|planCoversEffectScope" packages/runtime/review-mandate/plan.ts
grep -n "ALLOWED_CONSUMERS" packages/runtime/test/a6-pr0-lane-hygiene.test.ts packages/runtime/test/a6-pr2-lane-hygiene.test.ts packages/runtime/test/a6-pr3-lane-hygiene.test.ts
```

Every published line number above came from these or equivalent greps run in this checkout at
`991faacc4`, or via read-only `git show`/`git grep` at the named PR heads; the gov worktree's HEAD and
porcelain (0) were unchanged by the measurement (`git show FETCH_HEAD:<path>` reads objects, never the
worktree).

### Appendix A.1 — dated re-check commands (written and measured at real UTC 2026-10-31T21:14Z–21:24Z)

The §2 dated re-check is reproducible with exactly these; every line was run in the gov worktree, HEAD and
porcelain (0) untouched, GitHub reads only.

```
# 1. Live heads and labels, read-only.
for n in 531 522 517 513; do gh pr view $n --repo ArmourPiercer1/dsh-agent-team \
  --json number,headRefOid,headRefName,baseRefName,state,isDraft,changedFiles; done
#   → 531 32b81fcd8… (= pinned P531) | 522 f773d1603… | 517 3ac9fd52e… | 513 f559ff2ec… (= GOV's branch head)

# 2. Fetch each live head into objects only (no checkout, no HEAD move), then diff the CLAIMED paths.
git fetch origin alpha6/lane2-pri1b-admission-20261031     # P522 pin → f773d1603…
git diff --name-only f1f19277ba759a87dd34424251ed872db7c77385 f773d160371037672855f5401b4999c14c1b0128 \
  -- packages/runtime/review-assignment packages/runtime/review-mandate packages/runtime/dist packages/contracts/src
#   → empty (0 files). Wider, for the record: the same range touches 2 files repo-wide —
#     docs/plans/memo/alpha6-review-separation/pri1b-admission-design-20261031.md and
#     packages/runtime/test/a6-pr-i1b-admission.test.ts (the §2.3 locator: :1034-1036 → :1045-1047,
#     three lines byte-identical, sha256 of the 3-line slice 17c7a23e18b628fbf0fccdd81d5d54bc27784e191e7c3685b18913e89908ca28)

git fetch origin alpha6/lane2-pri1a-writer-20261031        # P517 pin → 3ac9fd52e…
git diff --name-only 3d06d52a9bb9791620ae1038dfd2561acff514d9 3ac9fd52e102720413c1105b2f78debf3f018af7 \
  -- packages/runtime/review-assignment/writer.ts packages/runtime/test/a6-pr2-lane-hygiene.test.ts packages/
#   → empty (0 files); repo-wide the range is 88 files, all evidence/log/design-memo/kit

git diff --name-only 991faacc4f373485b7d810de16a35518214a9301 f559ff2ec98522e5c14e5fdda592e16caa20b7fb \
  -- packages/runtime/control/types.ts packages/runtime/control/service.ts \
     packages/runtime/review-mandate/types.ts packages/runtime/review-mandate/mandate.ts \
     packages/runtime/review-mandate/plan.ts packages/runtime/review-assignment/types.ts \
     packages/runtime/test/a6-pr0-mandate-admission.test.ts packages/runtime/test/a6-pr0-lane-hygiene.test.ts \
     packages/runtime/test/a6-pr2-lane-hygiene.test.ts packages/runtime/test/a6-pr3-lane-hygiene.test.ts \
     dev/engineering/current-authority.json
#   → empty (0 files); repo-wide the range is 3 files (this memo, the execution-plan memo, the log)

# 3. The §6 re-measurements at live P522, and the authority pin.
git merge-base 3ac9fd52e102720413c1105b2f78debf3f018af7 f773d160371037672855f5401b4999c14c1b0128   # a2bc18d78…
git diff --name-only a2bc18d783046c62db3f9db41a8d22dc716e5fa0 f773d160371037672855f5401b4999c14c1b0128 \
  | grep -c '^packages/runtime/control/'                                                                  # → 0
git show f773d160371037672855f5401b4999c14c1b0128:packages/runtime/test/a6-pr2-lane-hygiene.test.ts \
  | grep -n "const ALLOWED_CONSUMERS"                                                                     # → :56, []
node scripts/current-authority.mjs   # as20261026r1 / sha256:93692d7a… / alpha5-tool-io-governance — unchanged
```


### Appendix A.2 — second dated re-check commands (written and measured at real UTC 2026-10-31T22:32Z–22:42Z)

The §2 second dated re-check and §6's second dated corrections are reproducible with exactly these. Run in the gov
worktree; `git fetch` lands objects only (no checkout, no HEAD move, worktree untouched), GitHub access read-only,
porcelain 0 before and after the measurement run. Scratch logs under `.artifacts/alpha6-s0/gov-closure/` (gitignored,
so the evidence guard's `added=0` is not disturbed).

```
# 1. Live heads and labels, read-only (all four pins).
for n in 531 522 517 513; do gh pr view $n --repo ArmourPiercer1/dsh-agent-team \
  --json number,headRefOid,headRefName,baseRefName,state,isDraft,changedFiles,additions,deletions; done
#   → 531 32b81fcd8… (= pinned P531, unchanged) | 522 aee7cec18d… | 517 199e18cc45… | 513 fe8918209a… (= GOV's branch head)
#     every one: state=OPEN, isDraft=true

# 2. Fetch each live head into objects only, then diff the CLAIMED paths (empty / non-empty as reported).
git fetch origin alpha6/lane2-pri1b-admission-20261031        # P522 pin → aee7cec18… (+4 commits)
git diff --name-only f1f19277ba759a87dd34424251ed872db7c77385 aee7cec18d69c2144d57ce62c0fc31fe55a33397 \
  -- packages/runtime/review-assignment packages/runtime/review-mandate packages/runtime/dist packages/contracts/src
#   → empty (0 files). Repo-wide the same range is 2 files: the PR-I1b design memo (+107/−0) and the guardrail spec
#     packages/runtime/test/a6-pr-i1b-admission.test.ts (+1428/−2, 2051 → 3477 lines)
git show aee7cec18d69c2144d57ce62c0fc31fe55a33397:packages/runtime/test/a6-pr-i1b-admission.test.ts \
  | grep -n "role-closure mirror equals CONTROL_RESOLVER_ROLES"                                               # → :1096 (it header)
git show aee7cec18d69c2144d57ce62c0fc31fe55a33397:packages/runtime/test/a6-pr-i1b-admission.test.ts \
  | sed -n '1100,1102p' | sha256sum   # → 17c7a23e… = same slice sha as at P522:1034-1036 and f773d1603:1045-1047
git show aee7cec18d69c2144d57ce62c0fc31fe55a33397:packages/runtime/review-assignment/assignment-admission.ts \
  | sha256sum                                                                                                 # → 1d0195f3… unchanged
git show aee7cec18d69c2144d57ce62c0fc31fe55a33397:packages/runtime/test/a6-pr2-lane-hygiene.test.ts \
  | grep -n "const ALLOWED_CONSUMERS"                                                                         # → :56, []

git fetch origin alpha6/lane2-pri1a-writer-20261031           # P517 pin → 199e18cc4… (+4 commits)
git diff --name-only 3d06d52a9bb9791620ae1038dfd2561acff514d9 199e18cc45f81d3b2b8fa757c78418b7da744ac4 \
  -- packages/runtime/review-assignment/writer.ts packages/runtime/test/a6-pr2-lane-hygiene.test.ts packages/
#   → empty (0 files); repo-wide 128 files = 126 under dev/agent-workflow + the PR-I1a design memo
#     + tests/kits/pr-i1a-real-host/pr-i1a-real-host.mjs (the guardrail driver — see §2's second re-check)
git show 199e18cc45f81d3b2b8fa757c78418b7da744ac4:packages/runtime/review-assignment/writer.ts | sha256sum   # → 6c1d5ee4… identical
git show 199e18cc45f81d3b2b8fa757c78418b7da744ac4:packages/runtime/test/a6-pr2-lane-hygiene.test.ts \
  | grep -n "const ALLOWED_CONSUMERS"                                                                         # → :48, []
git show 3d06d52a9bb9791620ae1038dfd2561acff514d9:tests/kits/pr-i1a-real-host/pr-i1a-real-host.mjs | sha256sum | cut -c1-12
git show 199e18cc45f81d3b2b8fa757c78418b7da744ac4:tests/kits/pr-i1a-real-host/pr-i1a-real-host.mjs | sha256sum | cut -c1-12
#   → 1e34a06880b4 (539 lines) → 16887de54cbc (1055 lines) — the instrument moved; no locator in this memo cites it

git diff --name-only 991faacc4f373485b7d810de16a35518214a9301 fe8918209a94c03bedd15f334135b11670301861 \
  -- packages/runtime/control/types.ts packages/runtime/control/service.ts \
     packages/runtime/review-mandate/types.ts packages/runtime/review-mandate/mandate.ts \
     packages/runtime/review-mandate/plan.ts packages/runtime/review-assignment/types.ts \
     packages/runtime/test/a6-pr0-mandate-admission.test.ts packages/runtime/test/a6-pr0-lane-hygiene.test.ts \
     packages/runtime/test/a6-pr2-lane-hygiene.test.ts packages/runtime/test/a6-pr3-lane-hygiene.test.ts \
     dev/engineering/current-authority.json
#   → empty (0 files); repo-wide 3 files, all this lane's prose (the log, this memo, the execution-plan memo)

# 3. Existence and reachability of the admission module (§7.1's backing facts).
for c in 199e18cc45f81d3b2b8fa757c78418b7da744ac4 32b81fcd8b3b5ab8d2c2089d743425438edf3ad8 fe8918209a94c03bedd15f334135b11670301861; do
  git cat-file -e $c:packages/runtime/review-assignment/assignment-admission.ts 2>/dev/null && echo "$c PRESENT" || echo "$c ABSENT"; done
#   → ABSENT ×3 — "exists only on P522" still true at every other live head
git grep -n -E "(from|import\()\s*['\"][^'\"]*review-assignment" aee7cec18d69c2144d57ce62c0fc31fe55a33397 \
  -- packages ':!packages/runtime/dist' ':!packages/runtime/test'
#   → no output = zero production importers of the lane at live P522 (the same grep WITHOUT the excludes answers only
#     test files, which is the control that shows the grep is not silently empty)

# 4. The machine-authority pin.
git show 991faacc4f373485b7d810de16a35518214a9301:dev/engineering/current-authority.json | sha256sum | cut -c1-12
git show fe8918209a94c03bedd15f334135b11670301861:dev/engineering/current-authority.json | sha256sum | cut -c1-12
#   → 42465659edeb at both, and identical to the worktree copy
node scripts/current-authority.mjs   # ok=true / POINTER / as20261026r1 / alpha5-tool-io-governance / PR #364 plan
```
