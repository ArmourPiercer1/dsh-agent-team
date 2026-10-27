# UNTRACKED captures here — deliberately kept, deliberately not in git

Eight vitest JSON reports from the round-45/46 CI-gate lanes (~31 MB total) sit here as `??` in
porcelain. They are **not** ignored, and they are **not** to be committed.

Why kept: raw captures settle disputes that summaries cannot. The round-47 erratum exists because a
summary was read instead of the bytes; had the bytes been discarded, the correction would have rested
on a different summary. Why untracked: they are reproducible machine output whose derived facts are
already published in `../population-baseline/` and the round records, and 31 MB of captures in git is a
cost the repository should not pay twice per lane.

Do NOT add a blanket `scratch/` ignore rule: 437 files under an evidence `scratch/` path ARE tracked
today, and a blanket rule would silently swallow the next lane's evidence on `git add` — silent
evidence loss is the failure this directory exists to prevent.

| file | size |
| --- | --- |
| `DIAGNOSTIC-G-stale.txt` | 2 KiB |
| `README.md` | 3 KiB |
| `census-20261008T132731Z-78-1.json` | 2844 KiB |
| `census-20261008T132731Z-78-2.json` | 2845 KiB |
| `census-20261008T133117Z-6893-1.json` | 2846 KiB |
| `census-20261008T153924Z-4-1.json` | 2845 KiB |
| `census-20261008T153924Z-4-2.json` | 2845 KiB |
| `census-20261008T165310Z-4-1.json` | 2853 KiB |
| `census-20261008T165310Z-4-2.json` | 2853 KiB |
| `census-20261008T170051Z-138-1.json` | 2854 KiB |
| `census-32-1.json.gz` | 373 KiB |
| `census-32-2.json.gz` | 374 KiB |
| `census-39-1.json.gz` | 373 KiB |
| `census-39-2.json.gz` | 374 KiB |
| `census-47-1.json.gz` | 372 KiB |
| `census-47-2.json.gz` | 374 KiB |
| `census-comparison-20261008T132502Z-4.json` | 8 KiB |
| `census-comparison-20261008T132731Z-78.json` | 12 KiB |
| `census-comparison-20261008T133117Z-6893.json` | 9 KiB |
| `census-comparison-20261008T133247Z-9917.json` | 8 KiB |
| `census-comparison-20261008T133247Z-9936.json` | 9 KiB |
| `census-comparison-20261008T142810Z-3.json` | 5 KiB |
| `census-comparison-20261008T143028Z-3431.json` | 5 KiB |
| `census-comparison-20261008T143208Z-6419.json` | 5 KiB |
| `census-comparison-20261008T153924Z-4.json` | 7 KiB |
| `census-comparison-20261008T165310Z-4.json` | 7 KiB |
| `census-comparison-20261008T170051Z-138.json` | 5 KiB |
| `census-comparison-2936.json` | 8 KiB |
| `census-comparison-32.json` | 12 KiB |
| `census-comparison-38.json` | 8 KiB |
| `census-comparison-39.json` | 8 KiB |
| `census-comparison-4.json` | 8 KiB |
| `census-comparison-46.json` | 8 KiB |
| `census-comparison-47.json` | 13 KiB |
| `census-comparison-56.json` | 10 KiB |
| `census-comparison-57.json` | 9 KiB |
| `census-comparison-58.json` | 9 KiB |
| `census-comparison-62.json` | 12 KiB |
| `census-raise-timeout.json` | 2844 KiB |
| `diagnostic-G.sh` | 3 KiB |
| `final-battery-output.txt` | 2 KiB |
| `final-battery.sh` | 3 KiB |
| `install.log` | 0 KiB |
| `red-D-escalated.json` | 2971 KiB |
| `red-control.sh` | 11 KiB |
| `reproduce-tokenless-crash.mjs` | 2 KiB |
| `setup.log` | 2 KiB |

## 2026-10-26 correction: nine U7 captures were committed by accident, then untracked

Between `d41168bd0` and `30ed4ec0b`, nine `census-20261026T*.json` captures (32.1 MB total) were
swept into commits by `git add -A` in three U7 lanes (U7-6, U7-4a) — against this file's own rule.
Found by the U7-3 lane while re-verifying its manuals, reported up, and untracked in one dedicated
commit (`git rm --cached`, no history rewrite, files still present on disk where they were captured).

The rule is unchanged and now states its own test: **a capture is committed only if the commit that
adds it also cites the fact derived from it.** A 3.7 MB vitest report whose derived numbers already
live in `../population-baseline/` is scratch; the derived numbers are the evidence.

`git add -A` is the mechanism that broke this twice. Lane commits should name their paths.

## 2026-10-27: raw captures no longer land here; a CI leg refuses them

The rule above was prose, and prose lost three times in two days (PR #396, then lanes re-committing
6–8 captures each, e.g. one commit adding 3 × 3.8 MB captures next to their 3 sidecars). Two
mechanical changes replace it:

1. **Separation at the source.** `scripts/ci-pr-gate.mjs` now writes raw census captures
   (`census-<stamp>-<pid>-<n>.json`) and load-family re-samples (`resample-*.json`) to
   `.artifacts/census/` at the repository root, which is gitignored (`.artifacts/`). Only the
   comparison sidecar `census-comparison-<stamp>-<pid>.json` is written here, and the leg line
   still cites it by path. The sidecar's `reports[].jsonPath` names the capture's
   `.artifacts/census/…` location. `--census-json` reads a capture from wherever you point it.
2. **Machine guard.** `scripts/eb3-evidence-guard.mjs` runs as a declared `ci-integration` leg
   (`--new-since "$CI_BASE"`). Over files a PR **adds** under `dev/agent-workflow/evidence/`, it
   refuses any raw-capture or resample name anywhere (`EVIDENCE_RAW_CAPTURE`, no exemption).
   It also refuses any file over 1 MiB that `dev/ci/evidence-large-allowlist.json` does not
   list with a reason (`EVIDENCE_OVERSIZED`). The negative controls are C15–C19 in
   `scripts/eb3-ci-negative-controls.mjs`.

The files listed in the table above and in the 2026-10-26 correction still sit untracked on
disk where they were captured, and none of them is affected. A capture that has to be committed
because a document cites a fact derived from it is still refused by name. Gzip it
(`.json.gz`, as with `census-32-1.json.gz`) or, better, commit the derived numbers.
