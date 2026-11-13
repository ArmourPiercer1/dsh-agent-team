# eng-candidate-status-20261113 — raw output of the frozen-candidate state report

> Captured 2026-11-13 from `origin/master` @ `6361185d8` + `task/eng-candidate-status-20261113`.
> Regenerate with the commands in §2; nothing here is hand-edited.

## 1. What the run says

```
cand-a5sf-fs-search-1  FROZEN  RECORDED_RUN_PASS  root=none  ref=ok  lineage=-
cand-v0.1.6-1  FROZEN  C2_NOT_RUN  root=MISSING  ref=ok  lineage=cand-a5sf-fs-search-1
  note RECORD_ROOT_NOT_YET_CREATED (AWAITING_C2)
cand-v0.1.6-2  FROZEN  C2_NOT_RUN  root=MISSING  ref=ok  lineage=cand-v0.1.6-1
  DEFECT LINEAGE_UNRECORDED
  DEFECT RECORD_ROOT_STALE_PATH
cand-v0.1.6-3  FROZEN  C2_A_AND_B  root=MISSING  ref=ok  lineage=cand-v0.1.6-2
  DEFECT LINEAGE_UNRECORDED
  DEFECT RECORD_ROOT_STALE_PATH
  note EVIDENCE_AT_DERIVED_ROOT
cand-v0.1.6-4  FROZEN  C2_A_AND_B  root=MISSING  ref=ok  lineage=cand-v0.1.6-3
  DEFECT LINEAGE_UNRECORDED
  DEFECT RECORD_ROOT_STALE_PATH
  note EVIDENCE_AT_DERIVED_ROOT
cand-v0.1.6-5  FROZEN  C2_NOT_RUN  root=MISSING  ref=ok  lineage=cand-v0.1.6-4
  DEFECT LINEAGE_UNRECORDED
  note RECORD_ROOT_NOT_YET_CREATED
candidate-status: candidates=6 frozen=6 accepted=0 c2_not_run=3 defects=7
DSH-CANDIDATE-STATUS candidates=6 defects=7 codes=LINEAGE_UNRECORDED,RECORD_ROOT_STALE_PATH
```

Full output: `status.txt` (human table + defect lines, exit 1) and `status.json`
(same result, machine-readable).

## 2. Reproduce

```bash
node --test scripts/candidate-status.test.mjs                        # 13/13
node scripts/candidate-status.mjs --self-test                       # 5/5
node scripts/candidate-status.mjs | tee status.txt                  # exit 1, 7 defects
node scripts/candidate-status.mjs --json > status.json
```

## 3. Reading the numbers

- **frozen=6, accepted=0.** Every manifest is `FROZEN` (identity locked) and none
  reaches `CANDIDATE_ELIGIBLE`. The two C2 records that exist for `-3`/`-4` both carry
  `candidateClaimEligibility.eligible: false`; `-5` was frozen before C2 by D12.
  "Frozen" is an identity statement, never an acceptance statement.
- **c2_not_run=3** — `-1`, `-2`, `-5`. For `-1`/`-5` the record directory does not
  exist yet because D12 freezes before adjudication (reported as a pending note, not a
  defect). `-2` never received C2 records.
- **`-3`/`-4` report `C2_A_AND_B` even though their manifests point at `-1`.** The
  records exist under `candidate-v0.1.6-3` / `-4`; the tool reads the derived root and
  reports `EVIDENCE_AT_DERIVED_ROOT`. The manifest defect (`RECORD_ROOT_STALE_PATH`) is
  still reported: metadata pointing at another candidate's directory is exactly what two
  independent C2 adjudicators refused in `-3`/`-4`.
- **LINEAGE_UNRECORDED ×4** (`-2..-5`): `immutability.supersedes` is hardcoded `null`
  by `scripts/freeze-candidate.mjs`, while the real predecessor is only written as prose
  inside the C2 records. The version chain cannot be reconstructed from manifests.
- **7 defects is metadata debt, not product failure.** Manifests are immutable; the fix
  is a new manifest commit, never an edit. The proposal is in
  `docs/plans/memo/candidate-metadata-20261113/PLAN.md`.

## 4. Limitations

- The report derives `record_root` through `freeze-candidate.mjs#recordRootFor`; if that
  mapping changes, the report changes with it (single source of truth by design).
- Lineage is *ordered by `frozen_at_utc`*, not stored; a candidate frozen out of order
  would be reported as an ancestry defect rather than silently accepted.
- `origin/master` is used as the ancestry reference; in a checkout without that ref the
  comparison degrades to `null` (no verdict) rather than a false pass.
- Nothing here proves a C2 record's measurements are honest — that is `verify-candidate.mjs`
  and the adjudicator's job. This tool only reports which records exist and what they claim.
