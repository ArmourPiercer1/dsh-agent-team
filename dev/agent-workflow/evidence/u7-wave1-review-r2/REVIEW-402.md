# Independent adversarial review — PR #402 (round 2)

- Reviewed frozen head: `5a79664551c08feea0efbd94715fab9011faf32d` (matches requested head).
- Verdict: **PASS-WITH-FINDINGS**. Merge recommendation: **NO** until the finding below is closed.
- No Host boot, no :3080 access, no ~/.dsh access.

## Round-1 verification

- **R1-1 FIXED (with reproduction):** `DECLARED_TO_REQUESTED` is a frozen data-only table in `packages/tools/process-family/src/bash-contribution.mjs`; both executors remain unchanged in requested-arm construction: bash uses its existing `tool-invoke(bash)` path and pwsh uses `tool-invoke(pwsh)`. The mapping suite passes `6/6`. Independently deleting the pwsh `tool-invoke` arm made the mapping suite RED (`1 failed, 5 passed`), then the file was restored. The table is not imported/read by executor or kernel code (only exported via index and referenced by tests); the contribution's requested sets remain byte-identical to the master implementation paths.
- **R1-2 FIXED:** all three required prose locations (`c2/README.md`, `tests/world-factory/README.md`, PR body) state: “C2 6/6 PASS over the refusal/lifecycle arms; positive spawn DISCLOSED (pwsh absent; matrix M-07 stays NOT_VERIFIED)”.
- **R1-3 PARTIALLY FIXED / COULD-NOT-VERIFY as same-head C2:** the three `*.u7pwsh-evidence.json` files are custom evidence payloads with no `schema`, `overall`, `finishedAt`, or `bindings.authority`; they are not `u5-run-record/1` records, so EB3’s RUN-record field rule does not apply to those files. `node scripts/eb3-run-manifest.mjs --new-since origin/master` passes (`records=56 strict=0 incomplete=11 findings=0`), but the new C2 payloads remain custom/non-run records. The positive spawn remains honestly disclosed and M-07 remains NOT_VERIFIED.
- **Raw census captures:** required census filename grep is empty on the frozen head.

## New finding

### F-402-1 — MEDIUM — committed C2 evidence bytes changed relative to the frozen run baseline

`git diff 5bb88870a..HEAD -- '*u7pwsh-evidence.json' '*budget-ledger.jsonl'` is **not empty** (exit 1), contrary to the stated “run-record bytes unchanged” claim. The three custom evidence files are newly added/changed in the reviewed range, and the budget ledger is also changed. This undermines the claimed frozen-byte provenance; either correct the claim/document the intentional provenance change and re-run the relevant evidence-integrity check.

## Shared checks

Protected center and seam files have zero diff. Hosted PR checks from `gh pr view 402 --json headRefOid,statusCheckRollup` are all SUCCESS. Evidence-guard script could not be run directly from a detached worktree because its implementation hardcodes `git -C /` for the comparison; this is recorded as COULD-NOT-VERIFY, not treated as pass.

## COULD-NOT-VERIFY

- Real PowerShell positive execution (lawful `pwsh` executable absent on this Linux host).
- Evidence-guard script direct run (script's hardcoded checkout path is incompatible with this detached worktree invocation).

## Conclusion

The round-1 semantic fixes are present and sensitive to mutation, but the contradictory evidence-byte claim is still unresolved. **PASS-WITH-FINDINGS; do not merge.**
