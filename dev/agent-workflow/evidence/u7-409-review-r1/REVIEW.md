# PR #409 Security Review — Round 1

## Verdict

**BLOCKED. Merge recommendation: NO.**

The patch closes the original hardlink-alias acceptance when the alias exists at the instant of `verifyOpenedHandle`, and the shipped build contains the new law. However, the requested attack case “hardlink created AFTER the open but before the read/write” remains exploitable on the write path: `nlink` is checked once, then the same already-open descriptor is truncated/written without a second link-count check or an atomic kernel confinement primitive. An attacker can add an outside hardlink during that interval and the governed write then mutates the outside name's inode.

## Reviewed setup

- PR #409 head confirmed: `13bbe0f5373788b89e289bdc35a309a43fc4e35b` (`13bbe0f53`).
- Worktree: `.worktrees/rv-409`, detached at the requested head.
- `gh pr view 409`: OPEN; all reported hosted checks SUCCESS, including candidate-protection, census-runtime, pr-gate, ci-fast, ci-integration, ci-security, ci-full, and ci-required.
- No Host booted; `:3080` and `~/.dsh` were not touched.

## Shared law and caller review

`hardlinkAliasVerdict` is defined once in `packages/runtime/controlled-fs/src/open-at-exec.ts:82-90`; `verifyOpenedHandle` applies it after escape and drift at `:134-136`. No caller re-derives the link-count law. All direct production call sites were searched with `grep -rn verifyOpenedHandle packages/` and read for branching behavior.

| Caller | Branching on verdict | Hardlink leg |
|---|---|---|
| `packages/tools/fs-family/src/read-executor.mjs:422-430` | `verdict !== 'confirmed'` refuses; hardlink becomes `exec-time-hardlink-alias` before byte stage | GREEN; H-read refused, `execCount=0` |
| `packages/tools/fs-family/src/image-read-port.mjs:75-83` | `verdict !== 'confirmed'` returns `{ok:false}` before bytes/store | GREEN; H-image refused, no attachment saved |
| `packages/tools/inspect-family/src/skill-executor.mjs:228-236` | `verdict !== 'confirmed'` refuses before loading content | GREEN; H-skill refused, no skill execution |
| `packages/tools/ui-family/src/present-executor.mjs:141-148, 314-318` | generic opened-handle branch refuses; outer mapper explicitly maps hardlink to `ANCHOR-ESCAPE` | GREEN; H-present refused, presenter calls 0 |
| `packages/tools/search-family/src/search-mechanics.mjs:193-204` | `verdict !== 'confirmed'` refuses before sink; class is denied only for escape, otherwise undetermined | GREEN; H-grep refused, zero bytes to sink |
| `packages/runtime/controlled-fs/src/controlled-fs.ts:352-382` (`safeOpen`) | only `confirmed` admits; non-destructive hardlink has explicit denied branch; destructive hardlink falls into `write-side-effect-unconfirmed` | GREEN through shared suite / refusal path |
| `packages/runtime/controlled-fs/src/post-consume-write.ts:381-408` | explicit hardlink denial before truncation; other non-confirmed verdicts refuse | GREEN for alias existing at verify; **RACE NOT CLOSED** (see finding) |
| `packages/runtime/controlled-fs/src/post-consume-edit.ts:268-291` | explicit hardlink denial before read half; other non-confirmed verdicts refuse | GREEN; H-edit refused pre-read |
| `packages/runtime/controlled-fs/src/post-consume-create.ts:356-369` | only `confirmed` proceeds; hardlink verdict falls into undetermined after creation; separate `fresh.nlink` belt-and-braces remains at `:384-396` | Refusal path present; no new alias admitted |

`packages/tools/search-family/src/search-backend.mjs` does not directly call `verifyOpenedHandle`; its separate shared-law result mapper at `:1095-1109` also refuses every non-confirmed/shared-law failure, and the file-target hardlink leg is GREEN through `search-mechanics`.

## RED → GREEN evidence

`pnpm exec vitest run packages/runtime/test/u7-fixfwd-hardlink-alias.test.ts`:

- **14/14 passed** at the reviewed head.
- Evidence committed under `dev/agent-workflow/evidence/u7-fixfwd-20261027/`: `A-red-before-fix.log` shows the eight hardlink legs RED; `B-green-after-fix.log` shows all 14 GREEN; `C-mutation-nlink-removed.log` shows removing the nlink clause makes all 8 hardlink legs RED while positive controls remain green.

## Attack table

| Attack | Result | Evidence / assessment |
|---|---|---|
| Hardlink exists before open; in-root name aliases outside inode | **GREEN / refused** | 14-leg suite: shared verdict is `hardlink-alias`; read/image/skill/present/grep refuse; write/edit canary remains byte-identical. |
| Hardlink created after open/verification but before read | **NOT fully verified; residual read race** | `verifyOpenedHandle` checks `stats.nlink` once. Read callers then consume the same FD. If an outside link is added after verification, the inode gains an outside name after the check. The bytes are still the already-open inode; this is a residual provenance TOCTOU. No deterministic scheduler hook was available without changing production code. |
| Hardlink created after open/verification but before WRITE truncation | **RED / HIGH residual vulnerability** | In `post-consume-write.ts:381-422`, verdict is checked once; after cancellation check at `:411-418`, `handle.truncate(0)` starts at `:422`, followed by same-FD writes. No `fstat`/nlink re-check occurs immediately before truncation. A hardlink can be created in this window, and truncation/write mutates the outside name's inode. This is a real code-level bypass of the requested attack. |
| Outside inode's other name deleted after check so nlink drops to 1 | **Not a useful escape for the preexisting outside-file case** | Deleting the outside name does not move the inode or make its bytes governed; the opened FD still refers to the same inode. The check is conservative and may admit only after the external alias is gone. It does not repair the “outside hardlink added after check” case. |
| Directory at target | **REFUSED / exempt from hardlink rule** | `verifyOpenedHandle` applies nlink only when `stats.isFile()`; callers reject non-files. Directory link counts represent subdirectory entries, not file aliases. |
| Symlink to hardlink / symlink alias | **REFUSED** | `O_NOFOLLOW` and existing escape/not-a-file branches run before the hardlink verdict; no symlink is admitted as a regular file. |
| WRITE outside canary unchanged for preexisting alias | **GREEN** | H-write leg refuses before truncation; outside canary is byte-identical. This does not cover a link created after verification. |
| EDIT outside canary unchanged for preexisting alias | **GREEN** | H-edit refuses before read half; outside canary is byte-identical and not disclosed. |

### Required fix for the blocker

The implementation must close the post-verification interval for destructive operations. At minimum, the write path needs a security decision and an actual check immediately before the first byte-changing operation; a robust fix should use an atomic kernel-grade confined open (the file itself documents `openat2`/`RESOLVE_BENEATH` as the intended seam) or otherwise prove that aliases cannot be introduced between the final check and truncation. Merely checking `nlink` once after open is insufficient for the explicit attack requested by this review.

## Trade-off and governed roots

The submitted evidence reports 0 multi-link regular files in tracked files, the worktree excluding `node_modules`, and persisted test worlds; 36,815 of 37,455 files under `node_modules` are multi-link pnpm-store files. Source inspection confirms governed roots are resolved from instance `rootDir` (`fs-family`, UI, controlled-fs) or configured `skillRoots` (`inspect-family`), not automatically from `node_modules`. A root explicitly pointed at `node_modules` would fail closed, which is an acceptable disclosed trade-off.

## Shipped-build check

**PASS for the committed dist mirror.**

`git show HEAD:packages/runtime/dist/packages/runtime/controlled-fs/src/open-at-exec.js | grep -n hardlink` returns the compiled `hardlinkAliasVerdict`, `hardlink-alias` verdict, and `stats.nlink !== 1` check (compiled lines 63-111). The corresponding compiled post-consume write/edit and UI present files also contain their new refusal branches. Therefore production's shipped JS is not stale relative to the TypeScript law.

## Defect B and eslint-node-globals

**PASS / non-vacuous.**

`node --test tests/checks/dist-placements.test.mjs tests/checks/eslint-node-globals.test.mjs` passed **19/19**. The tests derive placement totals and extension sets from disk, but retain independent structural and mutation controls: removed placement (`N-1`), new placement (`N+1`), stray/malformed/duplicate/empty ledgers, mirror parity, and a planted new lane / stale collector drift. The eslint suite retains the frozen historical nine, checks inline additions, duplicate entries, missing collected entries, stale patterns, malformed/empty docs, and planted new-lane/drift cases. The PR also adds both test paths to the CI integration leg; hosted `ci-integration` is SUCCESS.

## Protected paths and guards

- `git diff origin/master...HEAD -- dev/agent-workflow/ledgers/arc-a-protected-center.json` is empty; the 33 protected paths are unchanged.
- Submitted evidence reports evidence guard, CI-required, family boundaries, typecheck, artifact-at-head, and related gates passing; hosted checks are SUCCESS at `13bbe0f53`.

## Findings

### F-409-R1-1 — HIGH — post-verification hardlink creation can redirect governed WRITE side effect

**Location:** `packages/runtime/controlled-fs/src/post-consume-write.ts:381-422` (especially `:411-422`); shared check `packages/runtime/controlled-fs/src/open-at-exec.ts:129-136`.

`verifyOpenedHandle` samples `fstat.nlink` once and returns `confirmed` for `nlink === 1`. The write closure then performs cancellation logic and calls `handle.truncate(0)` with no second link-count/identity confinement check. If an attacker creates an outside hardlink to that inode after the sample and before truncation, the same FD remains valid and the write mutates the inode now reachable through the outside name. This is exactly the requested “hardlink created AFTER the open but before the read/write” attack for the destructive path. The existing eight-leg suite only plants the alias before opening, so it cannot detect this race.

**Severity: HIGH.** This is a governed write crossing its intended root boundary, despite the preexisting-alias case being fixed.

### F-409-R1-2 — MEDIUM — read-side nlink provenance is also sampled only once

**Location:** `packages/runtime/controlled-fs/src/open-at-exec.ts:129-136` and direct read callers listed above.

A hardlink can be added after the one-time verification and before the FD is read/presented. This does not expose a preexisting outside file through a newly created in-root alias, but it means the claimed “nlink law” is not stable for the whole operation. If the contract requires the inode to remain single-linked throughout the governed read, callers need a final check immediately before consumption or a kernel-grade atomic confinement guarantee. The write finding is the merge blocker; this read residual should be fixed or explicitly documented in the security contract.

## COULD-NOT-VERIFY

- I did not boot a Host, use browser UI, touch `:3080`, or access `~/.dsh`.
- I did not run the complete PR gate locally; I relied on the successful hosted checks reported by `gh pr view 409` and the targeted suites run above.
- I did not obtain a deterministic scheduler-controlled reproduction of the post-verification hardlink race without adding a test hook/mutation to production code; the vulnerability is established by the unguarded code interval and operation ordering.
- The nlink population counts and test-world census were reviewed from the submitted evidence (`dev/agent-workflow/evidence/u7-fixfwd-20261027/README.md` / `pr-body.md`), not independently recounted in this review.
