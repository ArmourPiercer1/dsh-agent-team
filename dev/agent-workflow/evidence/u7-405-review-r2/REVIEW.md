# PR #405 Security Review — Round 2

## Verdict

**PASS-WITH-FINDINGS**.

This is the round-2 review that PR #405 should have received. The PR was **MERGED to `master` at `fde550fa2` before its round-2 review was run**, a process error disclosed by the coordinating agent. That timing does not soften this review. The coordinator must fix forward or revert any blocker-level issue.

**Fix-forward needed: yes. Revert recommended: no**, provided the hardlink finding is fixed forward before this governed UI surface is treated as security-complete. The current merged code closes the round-1 check-then-open race for the tested replacement/escape cases, but it still presents an outside inode through an in-root hardlink.

## Reviewed commits and setup

- Round-1 fix head: `287b38c32`.
- Merged result reviewed: `fde550fa2` (`origin/master`).
- `gh pr view 405`: state `MERGED`, merge commit `fde550fa2`, merged `2026-10-27T11:37:44Z`.
- No Host was booted; `:3080` and `~/.dsh` were not touched.
- Focused C1 run on merged master: `pnpm exec vitest run packages/runtime/test/u7-f-ui-c1.test.ts` — **41/41 passed**.

## Round-1 findings

| Finding | Result | Evidence / reproduction |
|---|---|---|
| H-1 present check-then-open race | **FIXED for the required five legs** | `present-executor.mjs:119-166` snapshots with `statSync`, performs one `fsOpen(path, O_RDONLY|O_NOFOLLOW)`, calls `verifyOpenedHandle` at line 141, re-checks regularity on the fd at line 151, and meters cap+1 on that same handle at lines 152-163. The merged C1 suite R-1..R-5 passed. The executor has no second path-based open for presented bytes. |
| H-1 public fs-family export deduplication | **FIXED** | `packages/tools/fs-family/src/index.mjs:69` has exactly one `verifyOpenedHandle` export. `present-executor.mjs:38-43` imports it through `../../fs-family/src/index.mjs`, the public face. |
| M-1 turn-less receipt | **FIXED** | `present-executor.mjs:338-351` requires a safe integer `receipt.turn`, returns typed `UI_PRESENT_RECEIPT_INVALID`, and sets `sideEffectPossible: true`. Pinned host law verified at `tests/deepseek-harness-test-use/packages/deliverables/tool-present/src/index.ts:61` (`turn` required) and `:77-79` (open-turn failure). R-4 passed. |
| L-1 closed-world parsing | **FIXED as disclosed deviation** | Host `ask_user_question` legacy and timed schemas use `additionalProperties: true` at `tests/deepseek-harness-test-use/packages/interaction/tool-ask-user/src/index.ts:48,61` and `timed.ts:116,129`; host `present` uses `false` at `tool-present/src/index.ts:49,59,65`. Governed UI parsing intentionally remains closed. Every unknown-parameter refusal names the offending field(s) and accepted set: `ui-mechanics.mjs:108-110`, `126-128`, `164`, `201-217`. |

## Race table

| Row | Attack driven | Answer |
|---|---|---|
| R-1 | Final component replaced with a different inode during open window | **GREEN / refused `ANCHOR-DRIFT`; no publication.** |
| R-2 | Final component replaced with symlink to outside file during open window | **GREEN / refused `NOT_A_FILE`; outside canary was not presented.** |
| R-3 | Parent directory swapped to symlink to outside directory during open window | **GREEN / refused `ANCHOR-ESCAPE`; no publication.** The prior RED log's cleanup `ENOENT` was a test-fixture cleanup defect; the merged focused suite now passes. |
| R-4 | Port returns receipt without `turn` | **GREEN / refused `UI_PRESENT_RECEIPT_INVALID`, `sideEffectPossible: true`.** |
| R-5 | File is one byte over cap; exact-cap file | **GREEN / over-cap refused `FILE_TOO_LARGE`; exact cap succeeds.** |
| X-1 | In-root hardlink whose inode is also linked from an outside directory | **RED / NOT FIXED.** The executor accepts and presents the outside canary through the in-root hardlink. Reproduced with a scratch Vitest test: result was `kind: 'ok'` and the publication port was called. See new finding F-405-R2-1. |
| X-2 | FIFO at requested path | **REFUSED before open** by `statSync`/`!st.isFile()`; no hang observed in code path. |
| X-3 | File grows after snapshot | **Bounded by cap+1 read on the verified fd**; growth beyond cap returns `FILE_TOO_LARGE`. No separate path read exists. |
| X-4 | Requested path replaced by directory | **REFUSED** by snapshot regularity and fd regularity checks. |
| X-5 | `..` segment after normalization | **REFUSED lexically** by `lexicalAnchor`; no PA/open/port effect. |
| X-6 | Parent directory is already a symlink | **REFUSED** by post-consume `resolveAnchoredPath`/anchor-drift law; no publication. |

## Additional required checks

- **No second path-based open for presented bytes:** verified by source inspection. The only present-file open is `fsOpen(path, READ_NO_FOLLOW)` at `present-executor.mjs:132`; all subsequent stat/read operations use `handle`. Other `openSync`/`readFile*` matches in the repository are unrelated test/tooling code, not the present executor.
- **Ask timed expiry:** typed pending is preserved; `ask-executor.mjs` checks pending before answer conversion and never fabricates an answer. Focused C1 T-4/T-5 passed.
- **Answers are data, not authority:** `toModelAnswers` copies answer fields only; no authority/grant object is reachable from answer data. C1 A-1/A-9 and timed tests passed.
- **Two concurrent in-flight asks and replay of consumed grant:** C1 A-7/A-8/T-8 passed; per-token ledger rejects in-flight replay and settled replay is cancelled without a second port call or grant consumption.
- **Declared == requested per row:** contribution declares `read`, `domain-ref`, and matching targets; executor request sets are covered by C1 E-1/E-2/E-3. Mutation evidence `mutation-1-drop-anchor-check-RED.log` and `mutation-2-pending-merge-RED.log` is present. No new mutation was needed for this finding: the hardlink control is a missing security case, not a vacuous control.
- **No authority handle in capability object:** contribution is data-only with `kernel` ownership for admission/grant operations; no kernel/registry/grant handle is exposed.
- **Protected center:** no PR diff to `team-tool-plane.mjs`, `family-assembly.mjs`, approval-entry binder, or the protected center paths. `verifyOpenedHandle` has exactly one fs-family barrel export.
- **C2:** positive live arms are explicitly disclosed; no trusted mount injects a UI port and the PR does not claim positive delivery. `C2-VERDICTS.md` records `overall=PASS`, `finishedAt`/authority-bearing run records were checked in the C2 evidence set, and `bindings.authority` is present in committed run records. No raw census capture path was found in the PR tree; the tracked census is the ledger, not a raw capture.

## New finding

### F-405-R2-1 — HIGH: in-root hardlink permits presenting an outside inode

**Location:** `packages/tools/ui-family/src/present-executor.mjs:119-163`, especially lines 129 and 141-163.

The new one-FD law proves that the opened fd is beneath `rootReal` and has the same `(dev, ino)` as the pre-open snapshot. That is sufficient for symlink/ancestor substitution, but it cannot distinguish an inode reachable through the governed root from the same inode hard-linked from an outside directory. A hardlink created at `root/link.txt` to `outside/secret.txt` has `/proc/self/fd` resolving to the in-root pathname and identical snapshot identity, so `verifyOpenedHandle` confirms it; the cap read then meters the outside file's bytes and the port receives the path. My scratch reproduction produced `kind: 'ok'` and invoked the publication port with an outside-canary hardlink.

This violates the requested adversarial case “hardlink to an outside file”: an outside file can be read/presented through a governed-root name. It is a **HIGH** boundary bypass whenever the governed root is intended to confine files created/owned within that root.

**Fix-forward requirement:** use a confinement policy that rejects hardlinks to inodes with an external link, or adopt a stronger trusted-directory/openat policy plus an explicit ownership/allowlist invariant that makes hardlink provenance impossible. If the intended contract cannot distinguish inode provenance on this platform, change the governed-root contract to state that hardlinks are accepted and add an explicit security decision; do not claim the requested hardlink race is covered by `/proc/self/fd` containment alone. Add a regression test that plants an outside canary, hardlinks it into the root, and asserts no publication/canary disclosure.

## COULD-NOT-VERIFY

- I did not boot a Host, use browser UI, touch `:3080`, or access `~/.dsh`, per instructions.
- I did not independently rerun the live C2 suite because doing so would consume Host-start budget and the requested review forbids booting a Host; I reviewed committed C2 records and their schema instead.
- A direct standalone Node import of `present-executor.mjs` was unavailable because the source-plane `.js` generated dependency path requires the repository test runner/aliases; the hardlink reproduction was run as a temporary Vitest test and was removed afterward.
- No mutation was left in the scratch worktree; the temporary hardlink test was deleted and scratch artifacts removed.
