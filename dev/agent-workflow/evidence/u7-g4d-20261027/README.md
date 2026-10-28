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

## Harness fix and C1 (pre-boot)

Actual mock drive now emits grep → read(exact effect path) → edit → DONE. No dry-run or alternate IO implementation was added. Pure C1 consumes bounded recorded data and runs makeArcDDecide itself against simulated public observation receipts; historical unchanged placeholder judges FAIL, corrected drive judges PASS, no-read mutation judges FAIL. Regression RED recorded before fix, actual source mutation (replace read with grep) RED, restored source GREEN. Judge additionally requires readFromDisk=true, refusing tool-return-only claims. World-factory C1 and ARC-D adversarial/matrix C1 pass.

Runtime first install (default store) failed ERR_SQLITE_ERROR unable to open database; retried with workspace-local `--store-dir ../../.tmp-pnpm-store`, install and full build PASS. No Host boot used for this setup failure. Pristine source remains unmodified.

