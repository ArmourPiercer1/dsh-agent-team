# U7-2 adversarial review round 2 (PR #395)

## Verdict

**BLOCKED**

The R1 substring defect is substantially fixed, and the hosted final run is green, but the new command recognizer still accepts executable-looking commands that do not prove the mandatory leg ran successfully. Three independently invented evasions satisfied a leg: a command in an `if false` branch, a backgrounded command, and `|| exit 0`. These are not merely unknown constructs that fail closed; they produce a passing leg result. A red merge can therefore remain green if a mandatory command is made unreachable, detached from the step status, or explicitly swallowed. This is a blocker for the future Required merge gate.

## Mandatory-leg evasions

The checker was exercised through `gradeLeg` with the real `node scripts/docs-sync.mjs --check` leg, and the nine executor/R1 controls were rerun through `node scripts/eb3-ci-negative-controls.mjs` (C9). `MISSING` means no invocation was accepted; `WEAKENED` means an invocation was found but rejected. `PASS/accepted` is a blocker.

| Evasion | Result | Checker verdict / evidence |
|---|---|---|
| a. `echo node scripts/docs-sync.mjs --check` | MISSING | `CI_LAYER_LEG_MISSING` |
| b. step name only; run replaced with `true` | MISSING | `CI_LAYER_LEG_MISSING` |
| c1. census plus `--allow-refused census` | WEAKENED | `CI_LAYER_LEG_WEAKENED` |
| c2. census without `--full` | WEAKENED | `CI_LAYER_LEG_WEAKENED` |
| c3. census plus `--skip census` | WEAKENED | `CI_LAYER_LEG_WEAKENED` |
| d1. shell comment in `run:` plus `true` | MISSING | `CI_LAYER_LEG_MISSING` |
| d2. commented-out YAML step | MISSING | `CI_LAYER_LEG_MISSING` |
| e. quoted command handed to `printf` | MISSING | `CI_LAYER_LEG_MISSING` |
| f. `node ... --check || true` | WEAKENED | `CI_LAYER_LEG_WEAKENED` |
| **new: `if false; then node ...; fi`** | **PASS / accepted** | **`gradeLeg` returned `null`; no conditional analysis** |
| **new: `node ... --check &`** | **PASS / accepted** | **`gradeLeg` returned `null`; `&` is not parsed as weakening** |
| new: command substitution `echo $(node ... --check)` | MISSING | `CI_LAYER_LEG_MISSING` (safe) |
| new: `bash -c 'node ... --check'` | MISSING | `CI_LAYER_LEG_MISSING` (safe; wrapper not understood) |
| **new: `node ... --check || exit 0`** | **PASS / accepted** | **`gradeLeg` returned `null`; only `|| true`/`|| :` are rejected** |
| new: `set +e` before command | PASS / accepted | `gradeLeg` returned `null`; this is a weaker shell mode but does not by itself swallow the command, so it is a defense-in-depth concern rather than counted as the primary blocker |
| new: step `if: false` | NOT separately accepted | step conditional is rejected when a matching command is present (`CI_LAYER_LEG_WEAKENED`) |
| new: step `if: ${{ false }}` | NOT separately accepted | same conditional check |
| new: step `if: github.event_name == 'never'` | NOT separately accepted | same conditional check |
| new: `continue-on-error: true` | static layer rule rejects | `CI_LAYER_CONTINUE_ON_ERROR` (not part of isolated `gradeLeg`) |
| new: `timeout-minutes: 0` | NOT separately accepted | no timeout mutation exercised in the command parser; workflow/job-level policy should be explicitly covered |
| new: `shell: bash {0} || true` | NOT separately accepted | shell override not exercised; command parser does not model shell metadata |
| new: command only on `push` | NOT separately accepted | workflow trigger/step reachability needs separate event-aware negative coverage |

The three bold accepted evasions are blockers. In particular, `if false` proves the documented “unknown constructs only fail” claim is false: this construct is partly understood by the shell but ignored by the recognizer, and the leg is satisfied anyway. Backgrounding detaches exit status from the step, and `|| exit 0` explicitly converts failure to success while evading the narrow `|| true` check.

## Claims A–I

| Claim | Verdict | Evidence |
|---|---|---|
| A. Concrete leg invocation and nine evasions | **FALSE** | C9 passes all nine listed controls, but the new `if false`, background `&`, and `|| exit 0` mutations were accepted by `gradeLeg`. Unknown/unmodeled constructs are not uniformly fail-closed. |
| B. `workflow_call.outputs` boundary and wrong-job refusal | **VERIFIED** | C12 removes the boundary from each layer and gets `CI_WORKFLOW_CALL_OUTPUT_MISSING`; direct boundary logic requires `jobs.<declared-job>.outputs.verdict`, and a wrong job id is refused. |
| C. Grader fail-closed | **VERIFIED** | Synthetic needs cases (success/no verdict, PASS+failure, cancelled, skipped, neutral, invented result, synthesize=failure, missing layer) all exit 1. Extra unknown need is reported `info-undeclared-need` and ignored for the verdict; this is safe because every declared layer and `synthesize` must still be green. |
| D. Synthetic merge-tree identity | **VERIFIED** | `synthesizeMergeTree` uses `git merge-tree --write-tree` then `git commit-tree`; all four layers compare `HEAD^{tree}` to `inputs.merge_tree` on pull_request. Divergent tree is rejected by the shell assertion. |
| E. Universal digest binding | **VERIFIED** | C3 3d and the current fs-family contribution rule are universal over bound rows; dropping one row’s execute binding is detected as `DEF_EXECUTION_REPLACED`. |
| F. `always()` / `job.status` holes | **VERIFIED** | C11 rejects `always() && false`, comment-only `job.status`, echoed synthesize/grader, and unbound needs. |
| G. Host-dependent suite guard | **VERIFIED** | C10 re-lists `a5-pindir-reserved-native.test.ts` in host-free ci-security and gets `CI_HOST_DEPENDENT_SUITE_IN_HOST_FREE_LAYER`; current runner reports 20 files and checks each listed suite. |
| H. Hosted evidence | **VERIFIED** | `gh api` shows run `40360511280` has head `3af623b2e13d...`, status completed, conclusion success; all six jobs are success. The ci-required log contains `EB3-REQUIRED pass layers=5 green=5 nongreen=none`. This equals PR head `3af623b2e13d...`. |
| I. No weakening elsewhere | **VERIFIED** | No `packages/**/src/**` files changed; `pr-gate.yml` is unchanged relative to origin/master; no executable `continue-on-error`, `|| true`, or `--allow-refused` appears in the new layer implementations (the grep hits are comments only). |

## Findings

### F-2 — BLOCKER — mandatory leg recognizer accepts unreachable/background/swallowed commands

**Files:** `scripts/eb3-ci-required.mjs:205-226,240-269`.

`commandsOf` does not model `if` compound commands or `&`; `gradeLeg` only marks failure swallowed for `|| true` and `|| :`. Consequently, a command in `if false; then ... fi`, a background command (`... &`), and `... || exit 0` all satisfy a mandatory leg. This violates EB3-A/B/C/D fail-closed intent and directly permits a mandatory CI job/leg to be removed or weakened while the Required summary remains green.

**Required fix:** make unsupported shell/control-flow constructs fail closed, and explicitly reject background operators and all success-forcing `||` tails (or parse a restricted shell grammar whose only accepted form is a foreground, status-propagating invocation). Add negative controls for these exact three cases before merge.

## COULD-NOT-VERIFY

- No Host was booted, per task prohibition.
- The hosted run was verified through GitHub API/logs, but branch-protection settings were not changed or verified; PR body itself says `ci-required` is not yet the configured branch-protection context.
- Timeout/shell override/push-only trigger mutations were inspected but not fully staged as workflow-level controls; they do not reduce the blocker above.

## Recommendation

**Do not merge.** Fix F-2, add the three negative controls, rerun the complete negative-control suite and hosted `ci-required` on the fixed head. Any accepted evasion that can make a mandatory leg non-executing or non-gating is a merge blocker.
