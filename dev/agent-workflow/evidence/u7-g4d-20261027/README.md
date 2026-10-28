# G4-D — ARC-D native disk effect and overall-PASS pair closure

## Diagnosis FIRST (before harness changes / before any boot)

Input: origin/master `a8bdfd752`, PR #400 merge `6058bf3cb`; recorded ARC-D R2 `dev/agent-workflow/evidence/u7-w0b-20261026/c2/arc-d-r2/run-record.json`.

The last ARC-D RUN has exactly one non-PASS case: `arcd:ci03-native-parity` FAIL. All ten other `arcd:*` cases PASS (mounted, positive, spoof, swap, unbound, replay, restrict-veto, lift-control, marker-ledger, teardown-honest); cleanup also PASS. Consequently overall FAIL is caused solely by CI-03, not by the working restrict/lift pair.

Recorded data: nativeEvidence `{readFromDisk:true,present:true,contentMatches:false}`; native grep occurrence count 3; all laneDone booleans true. `u6arcdDigest.effectNotes.heads` contains the actual native settlements: bash redirect reports `Permission denied` then prints `PENDING_U6ARCD_EFFECT`; edit reports `file has not been read — read the file`. The mock recipe in makeArcDDecide drives grep(notes) → bash redirect(effect) → edit(effect) → DONE. Neither grep of another file nor shell cat establishes the native filesystem observation required by edit. The native write genuinely did not happen: the placeholder remained unchanged. This is a mis-driven mock, not encoding/newline/path mismatch, and not evidence of a product defect.

The recorded host log reports a healthy Host boot on test port 3183, enforcing placement feed, and census `selectedRunner=none enforcement=confine-unset (host sandbox default)`. No host crash or product stack error. Its native sandbox refusal is expected, and substituting a plugin writer would not prove native parity. Correct recipe: native grep → native read of the exact effect placeholder → native edit of that observed file → DONE. Keep disk bytes as the decisive oracle and native grep as a separate parity fact.

## Scope / resource disclosure

Single writer, branch `task/u7-g4d-arcd-native-20261027`, worktree `.worktrees/u7-g4d`. CORE PATCH BUDGET=0; no packages changes; no GATE-LEDGER edits; no stable instance access.

Root dependency installation: `pnpm install --frozen-lockfile --store-dir .tmp-pnpm-store`. Independent pristine runtime cloned from root test-use with `git clone --local --no-hardlinks` (Git disclosed shallow source: --local ignored), detached at `639ed015397290b3745d163aafe02ffee4aa3f84`, porcelain empty. Runtime install/build: `pnpm install --ignore-scripts --frozen-lockfile`, then `DSH_CLIENT_COMMIT_HASH=639ed01539 ESBUILD_WORKER_THREADS=1 pnpm run build`. This is test-use build only, no upstream source patch.

Live budget: one boot; at most one retry only after ENV failure or a fixed harness defect. No boot has occurred at diagnosis time.

## Boot 1 / authorized retry disclosure

Boot 1 at committed `e286081b7` completed: overall FAIL, CI-03 FAIL, all ten other ARC-D cases and cleanup PASS. Native read now occurred (recorded line-numbered PENDING placeholder), but effect remained unchanged. Further harness inspection identified missing public `defaultWorkspace`: Team defaults cwd to Host launch checkout, while fixture is in World workspace. Native workspace-write confinement cannot mutate that out-of-cwd file. Correction explicitly binds teamRowConfig.defaultWorkspace to workspaceDir; C1 pins this. No sandbox relaxation or product edit. Diagnostic capture now includes sandbox denial strings. Runner additionally records `teamTreeClean` from tracked porcelain at startup (untracked generated evidence is excluded, as it is not executable input). Boot 1 had no such field; it must not be retrospectively claimed present.

The single authorized retry is used ONLY after fixing that concrete harness workspace defect, not to retry unchanged. Both raw boot records remain.

## Final live result

`c2-retry/run-record.json`: schema u5-run-record/1, finalized 2026-10-28T03:44:10.677Z, **overall PASS**. Team SHA `752e713a2b43899ab76183b1cbd247fae8a0b022`, teamTreeClean=true; pristine Host SHA `639ed015397290b3745d163aafe02ffee4aa3f84`, porcelain empty before/after. All eleven ARC-D cases PASS: mounted, positive, spoof-zero-authority, swap-refused, unbound-refused, replay-refused, ci03-native-parity, restrict-veto, lift-control, marker-ledger, teardown-honest. Stable-instance-unchanged PASS (existing runner performs only its documented read-only status check; no stable state mutation). Disk oracle readFromDisk=true, present=true, contentMatches=true. Native grep parity remains separately recorded. Native effect is now a real native edit, not the pair's test-only writer. World homes were fresh and removed by normal teardown. Total starts=2 (initial plus authorized harness-fixed retry); no further boots.

## Gates / delivery boundary

World-factory tests PASS; ARC-D adversarial/matrix 17/17 PASS; regression RED→GREEN and actual no-read mutation RED. Local `node scripts/ci-pr-gate.mjs --store-dir .tmp-pnpm-store` PASS (7 pass, 0 fail; census explicitly skipped by default and delegated to CI full). Run-manifest and evidence-guard PASS; final checks repeated after evidence commit. Evidence whitespace normalized only, no verdict edits. No product paths changed, no new canonical authority writer, no GATE-LEDGER edits. E1 and strict R-U6P6-1 now have the requested named overall-PASS receipt; independent full-G4 ruling and integrated-candidate qualification remain the parent/integrator's work.

## Harness fix and C1 (pre-boot)

Actual mock drive now emits grep → read(exact effect path) → edit → DONE. No dry-run or alternate IO implementation was added. Pure C1 consumes bounded recorded data and runs makeArcDDecide itself against simulated public observation receipts; historical unchanged placeholder judges FAIL, corrected drive judges PASS, no-read mutation judges FAIL. Regression RED recorded before fix, actual source mutation (replace read with grep) RED, restored source GREEN. Judge additionally requires readFromDisk=true, refusing tool-return-only claims. World-factory C1 and ARC-D adversarial/matrix C1 pass.

Runtime first install (default store) failed ERR_SQLITE_ERROR unable to open database; retried with workspace-local `--store-dir ../../.tmp-pnpm-store`, install and full build PASS. No Host boot used for this setup failure. Pristine source remains unmodified.
