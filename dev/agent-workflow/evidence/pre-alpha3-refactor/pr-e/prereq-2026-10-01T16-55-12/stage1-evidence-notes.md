# PR #54 stage-1 (flag-off) real-host run — evidence notes (evidence-only commit)

## Run facts (external stage-1, env-owned live host; tested head f70072cf53bd6a542c58e09fa7a809602d5e3dbe, tree 143336a44d64458e5bd82a8a948fcb73da71855c)
- Kit: `tests/kits/pr-e-requirement-recovery-smoke/pr-e-requirement-recovery-smoke.mjs`, FLAGS OFF (default argv) — the flag-off byte-identity run.
- TestUse baseline: `46a7f68b0922371ce7144b668b90e377d8e799f4` (pre AND post identical, status empty, diff empty).
- Run window: 2026-10-01T16:55:12.259Z → 16:59:02.031Z; PID 418532 / job bash-1739; **exit 0**.
- Verdict: **16/16 criteria pass, 59 assertions PASS, 0 FAIL** (`summary.json`: "16/16 criteria pass; worldCleaned=true").
- Ports 3182 (host) / 3497 (mock model) / 3491-3493 (mini-MCP): all reclaimed after the run (ss 0, residue 0). Stable dev instance :3080 untouched (pre/post 401).
- The successful world was cleaned by the kit's OWN H2 PASS path — NOT manual deletion.
- **Stage-2 (UI observe) and the browser lane were NOT run. No merge.**

## Import manifest (7 sources; hashes verified against the coordinator's manifest at copy time)
Already living in this worktree tree (imported by explicit `git add`, not copied):
| File | sha256 |
| --- | --- |
| run.log | c02d41f3d4b182d3ab8c73a6559541fcc8e3274659b91a791a224d94ca5f40e7 |
| summary.json | 6102b6cae991220719ccdd88d6b948bf6fd0bc2ec89dc0d0d3c9347c66068739 |
| stable-pre.json | 5ccc3770c49c50cfbc56f58923a71e3a96a8b57b60e6b7e1a2850a527522881b |
| stable-post.json | 5ccc3770c49c50cfbc56f58923a71e3a96a8b57b60e6b7e1a2850a527522881b (IDENTICAL bytes to stable-pre — boot stability) |
| scenario-s9-reviewed-payload.json | 2b77e8de72592b944dcb5b81ba0350e101de52e0ddc026d745a14bb7fd75a1ec (behavior-chain review) |
| scenario-b3a.json | a321ebb8ab8d51787ae4adf35fe7f4ffadd13f57f5dc54ba4cf7ed0de0cd9449 (behavior-chain review) |
Copied explicitly from the scratch area (.worktrees/.scratch-logs/, gitignored):
| Source | Imported as | sha256 |
| --- | --- | --- |
| pr54-stage1-console.log | stage1-attempt1-console.log | d6ba158fb70e6cac7b9ac49884b930a31d8a2c5d6339e08641316809c0ef333f |
| pr54-stage1-attempt2-install.log | stage1-attempt2-install.log | d555a6e9816a41085e8e2a49d6aa911b126ae75b47974ab90d6927f6ba3ec1ef |
Cross-reference (deliberate NON-copy): scratch `pr54-stage1-attempt2-console.log` is **byte-identical** to `run.log` (same sha256 c02d41f3d4b182d3ab8c73a6559541fcc8e3274659b91a791a224d94ca5f40e7) — no duplicate imported.

## Deviations recorded, NOT erased
1. **Env-prep phase**: one offline 51-test suite run (`node --test` ui-observe.test.mjs) ran under the environment-prep phase WITHOUT a zero-tests restriction (this was preparation, not a stage run).
2. **First-launch dependency misjudgment (attempt 1)**: the launch aborted with a `yaml` package-resolution failure (exit 1, 16 criteria NOT_RUN) — retained verbatim in `stage1-attempt1-console.log`, no concealment. Followed by the coordinator-approved **offline frozen `ignore-scripts` install** (exit 0; `stage1-attempt2-install.log`) and a worktree module-import preflight per runbook step 1b. Attempt 2 produced the run above.
3. **File-count correction**: the run dir is **76 files recursive** (top-level `ls` shows 36; subdirs git-pre/git-post/instances account for the rest). The earlier "36" was a miscount — 76 is correct.

## Redaction & hygiene
- Raw launch/auth tokens were **redacted AT SOURCE** by the kit's scrubbing (REDACTED markers, e.g. `token=REDACTED`, `sk-REDACTED`, `lt-v1-REDACTED`); other raw logs are kept verbatim.
- Pattern scan (sk-[A-Za-z0-9]{24,} / lt-v1-[0-9a-f]{16,} / [?&]token=[A-Za-z0-9_-]{20,}) across all 7 imported files AND the full swept 76-file run dir: **0 hits** (verified at import time; REDACTION-marker presence confirmed in 15 files).
- Evidence-only commit: zero code/test/product changes; no host started by this commit; no merge.
