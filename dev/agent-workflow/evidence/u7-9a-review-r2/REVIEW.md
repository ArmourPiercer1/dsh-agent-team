# U7-9a FS family adversarial review R2 (final)

## Verdict

**BLOCKED**

The R1 blocker is fixed in code and the mutation probe is genuinely RED when the requested attachment effect is removed. The M-04 overclaim is withdrawn honestly and the matrix is not recoloured. However, the final committed C2 evidence still contains a non-PASS native parity cell (`fsm:ctl-native-write` = `FAIL`), and the proposed repair was not re-run after the harness fix because the six-boot budget was exhausted. A FAIL is not delivery under U7's explicit rules, even where disk truth is suggestive. The final C2 record therefore cannot support merge.

## R1 findings

| R1 finding | R2 disposition | Evidence checked |
|---|---|---|
| BLOCKER: `read_image` declared attachment-store effect absent from per-call PA requested-effects set | **FIXED** | `packages/tools/fs-family/src/image-executor.mjs:157-169` now adds `{kind:'domain-ref', domainAuthorityId: ATTACHMENT_STORE_DOMAIN_AUTHORITY}` to the exact `effects` array passed through `parseRequestedEffectSet` and into `paCall.requestedEffects` at lines 198-204. The contribution declares the same constant at `fs-family-contribution.mjs:181-185`. C1 I-12 proves the real kernel refuses the ungrantable domain arm with zero store writes; I-13 asserts the PA request contains `tool-invoke`, `read`, and `domain-ref('attachment-store')`. I ran the targeted C1 suite: 35 tests passed. I also performed a mutation probe by deleting only the domain-ref arm; the suite went RED (`2 failed | 33 passed`, I-13 failed at `expect(kinds).toContain('domain-ref')`, exit 1). This is a real negative mutation, and the source was restored afterward. The attachment commit is now either represented in the requested set or refused before commit; no native-body fallback was introduced. |
| MAJOR: `str_replace_editor` OUT_OF_SCOPE/NONE_SHIPPED contradicted matrix | **FIXED / DISCLOSED-ACCEPTABLE** | `M04-STR-REPLACE-EDITOR-INVENTORY.md` explicitly withdraws `OUT_OF_SCOPE / NONE_SHIPPED`, leaves the matrix unchanged, records pinned-host native registration, booted-world surface absence, no plane takeover row, and keeps the load-condition/M-04 obligation OPEN. README and PR body repeat the withdrawal. This is the required honest open-row disposition, not matrix recolouring. |
| MAJOR: three C2 controls were non-PASS | **NOT FIXED** | `c2/run-6.log` and the committed README record `fsm:refusal-zero-effect` PASS and `fsm:image-lane-honest` PASS on boot 6. But `fsm:ctl-native-write` remains `FAIL` in `run-6.log` and `run-6` evidence: `oracleBytesEqual:false`, `oracleBytesHead:""`, `governedRanSawCtlPath:false`. The separate `run-6.ctl-native-disk-truth.txt` proves a run-unique native file was found on disk, but it does not change the recorded case verdict. The README expressly says the corrected oracle was not re-run because the boot budget was exhausted. Under the universal rule, FAIL is not delivery. ENV_BLOCK is not claimed, and no verbatim sandbox message is supplied for the final cell; therefore this cannot be accepted as an ENV_BLOCK exemption. |
| MINOR: golden digest stamped at an earlier head | **FIXED** | `golden-recording.txt:12-31` rebinds the recorder to fix head `0632c1629...`, states the 1440-vector digest is unchanged, and proves the canonicalization file hash equals current `origin/master`. Later commits are evidence/docs only for the golden surface, as disclosed. The targeted golden test passed (4 tests). |

## New / remaining findings

### BLOCKER — final C2 native parity result remains FAIL

- **Evidence:** `dev/agent-workflow/evidence/u7-9a-fs-20261026/c2/run-6.log:6` and `run-6` record.
- **Issue:** The harness oracle was fixed after the final boot, but the corrected case was not executed. The disk-truth sidecar is useful supporting evidence, not a PASS receipt. U7 requires final C2 dispositions and says `FAIL/SKIP/ENV_BLOCK/UNDECIDED` never count as delivery. Merge requires a new permitted run (or an explicit authority ruling changing/removing the parity obligation); do not recolor this cell.

### MAJOR — current `origin/master` moved the protected center and creates a mechanical merge conflict

- **Evidence:** My 33-file hash sweep against current `origin/master` reports `checked=33 mismatches=1`, specifically `packages/runtime/tool-admission/admission-kernel.ts`. The PR itself has no diff for that file (`git diff origin/master...HEAD -- packages/runtime/tool-admission/admission-kernel.ts` is empty), so PR #390 did not modify the center. A real `git merge --no-commit --no-ff origin/master` failed only with `CONFLICT (content): Merge conflict in tests/world-factory/u5-canary-runner.mjs`; no protected center file conflicted. This is a mechanical integration conflict in the test harness, but it must be resolved and revalidated before merge; the PR's CA-01 claim remains zero diff relative to its reviewed base, not byte-identical to the moved master for that one protected file.

## VERIFIED

1. **Targeted C1 and golden tests**
   - Command: `pnpm exec vitest run packages/runtime/test/u7-9a-fs-mutation-c1.test.ts packages/runtime/test/u7-9a-mutation-golden-vectors.test.ts --config vitest.config.ts`
   - Verbatim tail:
     ```
      ✓ packages/runtime/test/u7-9a-mutation-golden-vectors.test.ts (4 tests) 74ms
      ✓ packages/runtime/test/u7-9a-fs-mutation-c1.test.ts (35 tests) 1034ms

      Test Files  2 passed (2)
      Tests  39 passed (39)
     ```

2. **R1 attachment-effect mutation probe**
   - Command: temporarily remove only the `domain-ref` element from `image-executor.mjs`, run `pnpm exec vitest run packages/runtime/test/u7-9a-fs-mutation-c1.test.ts --config vitest.config.ts`, then restore the source.
   - Verbatim tail:
     ```
     702|     expect(kinds).toContain('read')
     703|     expect(kinds).toContain('domain-ref')
           |                   ^
     ...
     Test Files  1 failed (1)
         Tests  2 failed | 33 passed (35)
     mutation_exit=1
     ```

3. **Protected center and current master movement**
   - Command: hash sweep over paths in `arc-a-protected-center.json` against `git rev-parse origin/master:<path>`.
   - Verbatim tail: `checked=33 mismatches=1` / `packages/runtime/tool-admission/admission-kernel.ts`.
   - Command: `git diff --name-only origin/master...HEAD -- packages/runtime/tool-admission/admission-kernel.ts`.
   - Verbatim result: empty (PR #390 does not touch the moved center file).

4. **Merge conflict check**
   - Command: `git merge --no-commit --no-ff origin/master` followed by `git merge --abort`.
   - Verbatim tail:
     ```
     Auto-merging tests/world-factory/u5-canary-runner.mjs
     CONFLICT (content): Merge conflict in tests/world-factory/u5-canary-runner.mjs
     Automatic merge failed; fix conflicts and then commit the result.
     ```
   - This is mechanical, but not yet resolved on the reviewed branch.

5. **Final C2 disposition**
   - `run-6.log` verbatim case: `fsm:ctl-native-write: FAIL {"oracleBytesEqual":false,"oracleBytesHead":"","ctlFoundPath":null,"governedRanSawCtlPath":false,"laneCtlDone":true,"hostAlive":true}`.
   - `run-6.ctl-native-disk-truth.txt` contains the run-unique native marker, but the recorded verdict remains FAIL and no rerun occurred.

## COULD-NOT-VERIFY

- A final post-fix C2 `fsm:ctl-native-write` PASS: the committed record says FAIL and the evidence says the corrected oracle was not rerun because the six-boot budget was exhausted.
- A current-master byte-identical 33/33 CA-01 certificate: current master moved `packages/runtime/tool-admission/admission-kernel.ts`; PR #390 itself has zero diff there, but the branch cannot truthfully claim 33/33 identity against current master without resolving/revalidating the moved-base integration.
- A successful `gh pr view 390`: GitHub GraphQL returned `EOF` in this environment; local committed `PR-BODY.md` was inspected instead.

## Review tree hygiene

The mutation probe source was restored. `packages/`, `tests/`, and `scripts/` are clean; the only untracked file is this review evidence log/REVIEW.md under `dev/agent-workflow/evidence/u7-9a-review-r2/`.
