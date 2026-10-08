# `scratch/` — what this lane left here, and why it has this shape

Everything in this directory is machine-written by `scripts/ci-pr-gate.mjs` or by the three driver
scripts here. It is committed because three of the published claims are re-runnable *from these bytes*
rather than by re-running a ~100 s vitest capture.

## Driver scripts (the part worth reading)

| File | What it is |
| --- | --- |
| `red-control.sh` | the five deliberate RED controls (A test-file TS error, B the PR #195 `graph.yaml` bytes, C a new red identity inside an already-red file, D counts-moved/escalation, E the verdict channel). Each one plants, runs, grades, and reverts inside its own transcript. Run one at a time: `bash red-control.sh A`. |
| `diagnostic-G.sh` | the raised-budget census capture behind `transcripts/DIAGNOSTIC-G-timeout-not-assertion.txt`. |
| `reproduce-tokenless-crash.mjs` | reproduces, against the current module, the crash that motivated the missing-token rule. |

## Raw vitest reports — retention rule, stated rather than applied silently

A nine-root vitest JSON report is ~2.9 MB, and this lane produced ten of them. The rule used:

1. **Kept uncompressed** iff a reader is meant to feed it back to the gate as an input:
   - `census-raise-timeout.json` — the Diagnostic G capture, graded by
     `node scripts/ci-pr-gate.mjs --only census --census-json scratch/census-raise-timeout.json`
     (the capture that yields exactly the published 22 identities at a 20 s clock);
   - `red-D-escalated.json` — the doctored report RED control D grades to prove an escalation is not
     a decrease (`--census-json scratch/red-D-escalated.json` must fail). It is derived from
     `evidence/a4-pr7/7-6-closure/scratch/root-census-after-1.json` by deleting that file's titled
     assertion and setting `status: 'failed'`; the derivation is printed verbatim in
     `../transcripts/RED-D-escalation-not-a-decrease.txt`.
2. **Gzipped** (`.json.gz`, ~380 KB) when a published document quotes a *number* out of it and nothing
   else: `census-{32,39,47}-{1,2}.json.gz` are the two captures each of the three pre-fix `--full`
   runs, and `FINDING-F.txt`'s per-capture duration table is drawn from them. Citations elsewhere in
   this lane use the ungzipped names — `gunzip` restores the exact bytes.
3. **Deleted**, with the reason named here, when the run it belonged to was withdrawn or its claims
   are fully carried by a sidecar:
   - `census-62-{1,2}.json` — the two captures of `GREEN-full-run-1-self-interference.txt`, a run this
     lane supersedes (FINDINGS F3). Its transcript stays precisely so the defect stays visible; the
     5.8 MB of payload behind a withdrawn claim does not.
   - `census-56-1.json` — RED control C's capture. Every claim made from it (three new identities,
     zero resolved, zero escalations, the counts pair) is in `census-comparison-56.json`, which is
     10 KB, and the capture itself is reproducible in ~100 s with the command printed at the top of
     `../transcripts/RED-C-new-red-identity.txt`.

## Sidecars

`census-comparison-<pid>.json` is what the census leg writes on every run: the baseline id set, the
captured id set, and the four diff classes (`newReds` / `resolved` / `escalations` / `totals`).
These are the small, greppable record of what the leg actually compared; the transcripts quote them.

## Regenerating anything here

```bash
# a fresh nine-root capture at the suite's own clock (~100 s):
node scripts/ci-pr-gate.mjs --only census --census-captures 1 \
  --transcript-dir dev/agent-workflow/evidence/a4-pr7/ci-gate/transcripts
# …or at a stated clock, which the leg line then discloses:
node scripts/ci-pr-gate.mjs --only census --census-captures 1 --census-test-timeout 20000
```

Reports land here as `census-<pid>-<n>.json`; the leg names the exact path in its detail. Nothing here
is consumed by CI — the workflow runs the legs, it does not read this directory.
