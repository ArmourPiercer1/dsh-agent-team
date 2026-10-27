# PR #411 adversarial gate review (r1)

**Verdict: PASS-WITH-FINDINGS**  
**Merge recommendation: YES, conditional on the findings being accepted / follow-up evidence recorded.**

Scope: `origin/task/u7-ci-cost-20261027` (`a580af7a2897e605f902118266cf7e57f3725f83`) against `origin/master`. This review addresses whether a deferred run can satisfy the Required `ci-required` context or allow merge without a green full aggregate on the final head.

Branch protection was read with `gh api`: `strict: true`; required contexts are `pr-gate` and `ci-required` (GitHub app 15368).

## 1. Deferred `ci-full` and Required job

**Pass.** In `.github/workflows/ci-required.yml`, the `ci-full` caller alone has the deferral `if:` (line 131), while `ci-required` has `if: always()` (line 145) and explicitly `needs: [synthesize, ci-fast, ci-integration, ci-security, ci-full]` (line 147). Therefore a skipped `ci-full` remains visible to the Required grader; the Required job itself is not skipped. `gradeNeeds` accepts only `result === 'success'` plus `outputs.verdict === 'PASS'` (scripts/eb3-merge-tree.mjs:90-105), and names skipped layers red.

Local reproduction:

```text
ci-full          skipped                needs.ci-full.result=skipped
EB3-REQUIRED fail layers=5 green=4 nongreen=ci-full:skipped
```

The exact CLI exited 1. C21 and C22 both pass on the unmodified tree; a scratch mutation that made `gradeNeeds` tolerate `skipped` made C21 fail (it reported `ci-full:skipped is not named in the rows`), then the mutation was restored and the worktree is clean.

This is consistent with GitHub's documented behavior that a job skipped due to a condition reports `skipped`, and skipped required checks may be treated as successful for branch protection; the workflow correctly places the condition on a dependency, not on the Required job. See [GitHub: using conditions to control job execution](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-jobs-with-conditions) and [GitHub: handling skipped but required checks](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches#require-status-checks-before-merging).

## 2. Deferred check name

**Pass.** The deferred job is `required-deferred` with `name: ci-required-deferred` (`.github/workflows/ci-required.yml:186-189`), while the Required job is `ci-required` (`:142`). The manifest independently declares `job: required-deferred` and `context: ci-required-deferred` (`dev/ci/eb3-ci-manifest.json:18-24`). There is no matrix and no reusable-workflow naming path that can turn this into `ci-required`. C21 also asserts the names differ.

## 3. Label removal and same-head rerun

**Pass by workflow shape; hosted label-removal transition not independently observed.** The trigger explicitly includes `labeled` and `unlabeled` (`.github/workflows/ci-required.yml:43-51`). Removing `ci-defer-full` therefore schedules a new `ci-required` run for the same PR head, with `ci-full` no longer skipped. The new run's check conclusion for the same SHA supersedes the stale deferred run for the context; the deferred job remains a separate non-required context. The contract is documented in `docs/PARALLEL-INTEGRATION.md:223-231`.

## 4. Races, final head, and strict protection

**Pass, with the expected race judgment.**

* Adding the label after a full green `ci-required` on the same head does not invalidate that full green result: the full aggregate did run green on that exact head. The label event schedules a new run, but it cannot make the already-completed full result cease being evidence that the head was fully tested. If policy instead requires the label itself to forbid merging even after a prior full green, that is a separate policy change not implemented here.
* A green `ci-required` from a previous head cannot satisfy the new head. Check runs/status contexts are attached to a commit SHA; strict required checks also require the PR head to be up to date with the base. The branch-protection API confirms strict mode. A new head carrying the label has no valid old-SHA Required success to borrow; its current run must produce the Required context, and this workflow makes that run red when `ci-full` is skipped.

## 5. `eb3-ci-required.mjs` deferral allowance

**Pass.** The checker sanctions only a caller whose layer equals the manifest's declared deferral layer and whose parsed `if` equals the manifest's exact `callerIf` after trimming (`scripts/eb3-ci-required.mjs:605-612`; manifest `callerIf` at `dev/ci/eb3-ci-manifest.json:21`). Scratch mutations were tested against the checker:

| mutation | result |
|---|---|
| `if: false` | `CI_LAYER_SKIPPABLE` |
| exact condition plus `|| true` | `CI_LAYER_SKIPPABLE` |
| different label (`skip-full`) | `CI_LAYER_SKIPPABLE` |
| whitespace changed inside expression | `CI_LAYER_SKIPPABLE` |
| quoted YAML scalar with the same expression | accepted because YAML parsing normalizes it to the same exact scalar; it is semantically identical, not a weaker condition |

The first four cannot smuggle a weaker condition. The quote-only form is not weaker and is correctly equivalent after parsing. C14's allowlist controls also pass.

## 6. C21/C22 and planted grader bug

**Pass.** `node scripts/eb3-ci-negative-controls.mjs C21` and `... C22` both pass on the clean PR tree (the command runs the full control ledger and reports 24/24). A planted one-line mutation changing the grader's non-success test to tolerate `skipped` caused C21 to fail; the mutation was then restored exactly and `git status` was clean.

## 7. Hosted proof

**Could not verify labelled path.** I did not open a throwaway PR or apply `ci-defer-full`, so there is no hosted labelled run ID to report. The author's PR #411 hosted run was inspected with `gh pr view`: its labels were empty and it showed `ci-full / ci-full` SUCCESS and `ci-required` SUCCESS on head `a580af7...`; it is not evidence of the deferred path. The hosted run did show a separate `ci-required-deferred` check as SKIPPED on the unlabeled run, with the distinct name, which supports item 2 only.

## Findings

### F1 — Medium: labelled hosted proof is absent

**Severity: medium (evidence gap, not a demonstrated gate bypass).** The PR changes the CI gate and the author did not verify the labelled path on hosted runners. Static analysis and C21/C22 establish the intended fail-closed topology, but hosted Actions expression evaluation and check-run naming for a real `labeled` event remain unobserved. Evidence: `.github/workflows/ci-required.yml:43-51,131,145-147,186-189`; no throwaway run IDs are available.

Recommended follow-up: run a disposable docs-only PR from the PR head, apply `ci-defer-full`, record that `ci-full` is SKIPPED, `ci-required` is FAILURE, and `ci-required-deferred` is SUCCESS, then close/delete the disposable PR and branch.

### F2 — Low: `CI_DEFERRAL_CONFLICT` is an offline/injected-input checker

`checkDeferralConflict` is correctly fail-closed for the supplied labels/conclusion pair and C21 exercises it, but the workflow shown does not itself query GitHub check runs or pass `EB3_PR_LABELS_JSON` / `EB3_CI_REQUIRED_CONCLUSION`. Thus this rule is a checker API/CI integration contract, not an independently active hosted assertion in this PR. This is defense-in-depth only; it does not create a bypass because the Required grader already fails on skipped `ci-full`.

## COULD-NOT-VERIFY

* No hosted `ci-defer-full` labelled run was observed; no run IDs exist for that path.
* No independent observation of the label-removal rerun was made.
* The race judgment relies on GitHub's documented SHA-attached check semantics and strict branch protection, not a live old-SHA merge experiment.
