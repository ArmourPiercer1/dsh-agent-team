# Re-labelled pre-finish snapshots (EB3 RUN rule, PR #400 R1)

The arc-a / arc-d suites wrote a PRE-FINISH copy of the run record as `<runId>.evidence.json` under schema `u5-run-record/1` (no finishedAt/overall), so `eb3-run-manifest` graded them as unfinalised RUNs (RUN_INCOMPLETE). They are digests, not runs: the finalized RUN of each is the sibling `run-record.json`. The suites now write `<runId>.digest.json` under `u6arca-digest/1` / `u6arcd-digest/1` with the snapshot verbatim under `snapshot`. The three committed files were re-serialized mechanically to that form (parsed `snapshot` asserted deep-equal to the old object); no field was added, removed or changed inside the snapshot.

| old file | old sha256 | new file | new sha256 |
| --- | --- | --- | --- |
| `arc-a/u5-u6-arc-a-u7w0b-2026-10-26T21-00-38-643Z.evidence.json` | `ce5e2433b6a0cfc75445820c3fa93096ba139b8b840f1aff99c1e3b19992b1f2` | `arc-a/u5-u6-arc-a-u7w0b-2026-10-26T21-00-38-643Z.digest.json` | `ff8fceba150a410a53b84f8a5c6f9f87df6c17ac71850bc10868ed34d89b312f` |
| `arc-d-master/u5-u6-arc-d-u7w0bmaster-2026-10-26T21-14-06-283Z.evidence.json` | `d51ea5c4bd3d201a5652e6629abdaf5d90a3b14981c0912f6b714c7d4010c9fa` | `arc-d-master/u5-u6-arc-d-u7w0bmaster-2026-10-26T21-14-06-283Z.digest.json` | `9b6ada74d75b57d55264cd959884eddb5376a7f389adaec956a220569989b6c7` |
| `arc-d-r2/u5-u6-arc-d-u7w0br2-2026-10-26T21-16-07-428Z.evidence.json` | `f7db72e1c19d19111e88202ff8efe4f741453521e8c883689c1bf4e2a61c0789` | `arc-d-r2/u5-u6-arc-d-u7w0br2-2026-10-26T21-16-07-428Z.digest.json` | `8f0d88229fc6166bfdbd3f581218310d51bd5f5e5dd2505fd0765498d64ae71f` |
