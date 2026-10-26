# U7-9a FS family adversarial review R3 (final)

## Verdict

**PASS-WITH-FINDINGS**

The sole R2 blocker is closed: boot 7 records `fsm:ctl-native-write` PASS with run-unique bytes read from disk by the corrected oracle, and the run is `overall=PASS` with 8/8 cases. The implementation and evidence support merge. Two provenance/documentation findings remain: the checked-in CA-01 certificate is bound to the former master `c5e43f1d5` although `origin/master` has moved, and the boot-7 authorization record is committed together with the run evidence, so its pre-run existence is not independently timestamp-proven. Recomputed facts nevertheless show the branch remains zero-contribution and byte-identical to current `origin/master` across all 33 protected paths.

## Per-claim table

| Claim | Verdict | Evidence |
|---|---|---|
| 1. `fsm:ctl-native-write` PASS on boot 7, budget 7/7, disk oracle, overall 8/8; boots 5/6 were oracle path bug | **VERIFIED** | `c2/run-7.json` records run `u5-u7-fs-mut-ctl7-2026-10-26T14-11-27-544Z`, `fsm:ctl-native-write` PASS, `oracleBytesEqual:true`, exact run-unique bytes, `ctlFoundPath`, `governedRanSawCtlPath:false`, `laneCtlDone:true`, and all 8/8 rows PASS. `tests/world-factory/lib/u7-fsmut-assembly.mjs` opens files with `readFileSync` while walking `home` and the supplied `sessionRoot`; it compares exact whole-file bytes and returns the path, then removes the found file. Diff of fix commit `0632c1629` shows only path resolution to the measured `sessionRoot` plus cleanup; no acceptance loosening. The authorization states budget 7/7 and boot-7 selection. The record's content is sufficient for the budget claim, but independent pre-run timestamp provenance is noted below. |
| 2. No matrix recolor; M-04 remains NOT_IMPLEMENTED | **VERIFIED** | `git diff origin/master HEAD -- docs/plans/` is empty. Current matrix still has `str_replace_editor (M-04)` as `NOT_IMPLEMENTED` and explicitly says Host registration is not read. |
| 3. CA-01 zero contribution/current protected equality | **VERIFIED (recomputed); certificate stale** | Current `origin/master` is `68287d1e42f900841163637a148e6d0164ddc4fc`; merge-base is `c5e43f1d5`. Recomputed against current master: ledger contains 33 files, `git diff --name-only origin/master...HEAD` intersected with those paths is empty, and per-file HEAD/current-master blob comparison is 33/33 equal. The checked-in certificate is bound to old `c5e43f1d5`, but the branch contribution remains zero against the moved current master. |
| 4. Merge-conflict resolution preserved both sides and only three ledger overrides | **VERIFIED** | `team-tool-plane.mjs` retains `backgroundJobs` closed-key validation and the `names.bash === 'bash'` CREATING-LANE PIN LAW. The protected ledger has exactly three overrides, and its overrides array is byte-equal to current master's (`true`, 3 vs 3): #377, #391, #392; no fourth entry. |
| 5. Golden digest 91fee9a6… / 1440 vectors | **VERIFIED** | Re-ran `pnpm exec vitest run packages/runtime/test/u7-9a-mutation-golden-vectors.test.ts --config vitest.config.ts`: 4 tests passed, including 1440-vector digest `91fee9a6ff7ea6db450e49b7fd2b39b142a3fc06d4f924664521a69329da332b`. |
| 6. Root vitest and hosted checks | **VERIFIED** | Committed `root-vitest-final.log` records 630 test files passed, 8037 tests passed, exit 0. `gh run view` for candidate-protection, census-runtime, and pr-gate reports SUCCESS with `headSha=5f1a21fd1fd59b13a324b44cc9c7dbcb56f185c2`, exactly this reviewed HEAD. |
| 7. `read_image` attachment-effect mutation remains RED | **VERIFIED** | `image-executor.mjs` requests `tool-invoke`, `read`, and `domain-ref(attachment-store)` in the exact set passed through `parseRequestedEffectSet` and `paCall.requestedEffects`. C1 contains I-12/I-13 controls; I-13 requires the domain-ref and is designed to fail if that arm is removed. R2 evidence records the deletion mutation as RED (2 failures), with source restored. |

## Findings

### F1 — CA-01 certificate is stale against current `origin/master` (non-blocking provenance finding)

`ca01-zero-diff-proof-r2-final.txt` is explicitly bound to `c5e43f1d5`, while current `origin/master` is `68287d1e42f900841163637a148e6d0164ddc4fc`. This is not a merge blocker because an independent recomputation against current master finds zero protected-path contribution and 33/33 blob equality. The evidence should be refreshed or amended before the next audit so the checked-in certificate itself names the current baseline.

### F2 — Boot-7 authorization pre-run timing is not independently machine-proven (non-blocking)

`boot7-authorization.md` states that boot 7 was authorized under the remaining budget and that the runner used `--max-host-starts 7`; the run JSON records `thisRunCount:1` and the budget ledger supports 7/7. However, the authorization file and run JSON are introduced in the same evidence commit after the run, so Git history does not independently prove that the authorization file existed before the boot began. This is an evidence-chain limitation, not a product or gate failure, because the prior R2 review explicitly granted one remaining boot and the record states the chosen path and budget.

## COULD-NOT-VERIFY

- Independent wall-clock/file-creation proof that `boot7-authorization.md` existed before the 14:11:27Z boot; the committed artifact contains the authorization statement but no pre-run timestamped receipt.
- A checked-in CA-01 certificate newly stamped to current `origin/master` 68287d1e; recomputation performed in this review supplies the current-master result.
- The user's exact hosted census-flake disclosure wording beyond the committed CI/PR evidence; hosted checks themselves are green for this HEAD.

## Review tree hygiene

No product files were modified. `git status --porcelain packages/ tests/` is empty. The only added file is this review artifact.
