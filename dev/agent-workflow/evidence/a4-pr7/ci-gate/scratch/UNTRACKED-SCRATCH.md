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
