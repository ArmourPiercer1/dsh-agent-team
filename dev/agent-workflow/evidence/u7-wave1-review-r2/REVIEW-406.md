# Independent adversarial review — PR #406 (round 2)

- Reviewed frozen head: `f7a4348f0bfaaf3a6a63080ad22d6bbfe8494405` (matches requested head).
- Verdict: **PASS-WITH-FINDINGS**. Merge recommendation: **NO** until evidence/provenance issue is resolved.
- No Host boot, no :3080 access, no ~/.dsh access.

## Round-1 verification

- **F-1 FIXED:** production `spawnChild` now carries exactly the pinned public face fields `name, description, prompt, context, provider, signal` and refuses with `agent-runtime-port-face-cannot-carry` before host reach when `model`, `reasoning_effort`, or `run_in_background` is supplied; it also refuses missing provider (no invented default) and missing signal (no never-aborted stand-in). AC-60..63 pass (targeted run: 11 tests passed). Deleting `provider: spec.provider` independently made AC-60 RED (`expected prov-a, received undefined`), then restored. Face mapping read: listAgents/listModels/steer/interrupt are explicit; forkChild/runWorkflow intentionally return unwired at this pinned host, typed fail-closed. `authorityBounded` still checks provider/model/tools/continuable before the port; no analogous silent field drop found on send/interrupt/fork/workflow.
- **F-2 FIXED:** AC-51 passes with exact per-row requested sets. Independently dropping workflow's `domain-ref` arm made AC-51 RED (workflow expected domain-ref + tool-invoke, received tool-invoke only), then restored.
- **F-3 FIXED and enforced at stated scope:** jsdoc/README/PR body state durable-roster membership over caller mount identity, exact verbatim id, not subtree and not liveness. AC-37/38/38b/39 pass in targeted run (11 tests). The sibling's child is refused because it is absent from the injected durable roster; this is roster membership enforcement, not a general lineage/subtree proof.
- **C2 disclosure:** PR body correctly states teamSha `0ea0848ac` is 10 commits behind and positive list/spawn cells remain DISCLOSED/NOT_VERIFIED; production unwired legs remain typed refusals.
- **Raw census captures:** required census filename grep is empty on frozen head.
- **Protected surfaces:** zero diff to team-tool-plane, family-assembly, binder, and protected-center ledger.

## New finding

### F-406-1 — MEDIUM — run-record/budget evidence is not byte-preserved as claimed

The PR body describes prior C2 run bytes as frozen and unchanged, but `git diff 5bb88870a..HEAD -- '*u7fa*.json' '*budget-ledger.jsonl'` is non-empty: the current head adds five `run-u7fa*.json`, three `*.u7fa-evidence.json`, and `budget-ledger.jsonl`, while deleting the prior pwsh budget ledger. This is not itself a product flaw, but contradicts provenance/immutability language and makes the advertised C2 receipt basis ambiguous. Correct the statement, or provide the exact intended baseline and an integrity receipt for the files actually reviewed.

## COULD-NOT-VERIFY

- Direct PR #408 evidence-guard invocation from this detached review worktree: the script hardcodes `git -C /` for its comparison and therefore refused before grading. The branch’s census filename grep itself is empty.
- Pinned upstream `SpawnTeammateRequest` source was unavailable in this worktree (test-use checkout is gitignored/not present); the PR’s cited six-field mapping was verified against the production code and AC-60..63 behavior, not independently against that source file.
- Live positive list/spawn, fork, workflow are intentionally not available at this host/pin and remain disclosed.

## Conclusion

Round-1 security fixes are real and mutation-sensitive. However, the evidence provenance claim is inconsistent with the actual diff range. **PASS-WITH-FINDINGS; do not merge until corrected/documented.**
