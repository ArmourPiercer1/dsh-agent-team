# u7-w0b evidence index

| File | What |
| --- | --- |
| [S1-MAP.md](S1-MAP.md), `s1-ensure-diff.txt`, `baseline-vitest.log` | S1 per-family site map, five-copy diff, baseline 14 suites / 178 tests |
| [DESIGN.md](DESIGN.md) | design note, what a new family must add, disclosed limits |
| [S4-JOBS.md](S4-JOBS.md), `s4-jobs-byte-pins.txt` | jobs stays a named bridge; three byte pins hold |
| [s3-identity.md](s3-identity.md), `fp-base-88107ad71.json`, `fp-s3-*.json`, `z-u7w0b-mount-fingerprint.scratch.test.ts` | mount-fingerprint identity proofs + the probe (scratch config) |
| `s2-red-plant1.log`, `s2-red-plant2.log`, `s2-green.log` | S2 RED-first plants in the shipped binder |
| `s5-c1.log`, `s5-named-suites.txt`, `s5-goldens.txt`, `s5-world-factory.log` | S5 C1: 45 files / 725 tests; goldens 22/22; world-factory 57/57 |
| `p4t6-RED-unbooked*.log` | every measured p4t6 delta (in-file era and the #397 drop-in era) |
| [c2/BUDGET.md](c2/BUDGET.md), `c2/boot-ledger.jsonl`, `c2/*` | S6 live C2, 6/6 boots, receipts |
| `s7-*.log` / `s7-*.txt` | S7 gates |
| [KNOWN-FLAKE-a5g6.md](KNOWN-FLAKE-a5g6.md) | disclosed cold-import timeout |

Plane line count (`team-tool-plane.mjs`): 2635 at base → 2483 (S2) → 2406 (S3a
search) → 2235 (S3b fs) → 2131 (S3c process) → 2119 (S4) → 2118 (head).
`git diff --stat 88107ad71 -- team-tool-plane.mjs`: +191 / −708.
