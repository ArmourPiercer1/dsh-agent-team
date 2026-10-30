# P1 measurement table (u7r3-xval, real-UTC 2026-10-30, NO ACCEPTANCE CREDIT)

Set A = `node --test tests/world-factory/binding-digests.test.mjs tests/world-factory/registries.test.mjs` (cwd xval-a; sub-second by design — the brief names it as the LIGHT set).
Set B = `pnpm exec vitest run packages/runtime/test` (cwd xval-b; targeted single-package C1 family, 466 files/5777 tests; selection smokes in `logs/p1-set-selection.log` — the brief's example single u7-9a file runs in 2.6s and gives no contention signal).
Parallel rows run BOTH at once; the light A is deliberately delayed 30s into B's window (measure.mjs `--delay-a-ms`) so the overlap is real.
`p2-fold-a` = the P2 co-rotation fold-in: set A ran while BOTH real Host worlds (x1 @3189, x2 @3190) were live (P0 overlap window).
peakRSS = /usr/bin/time -v whole-tree MaxRSS. amb.load = /proc/loadavg 1-min at row gate-clear / row end. minMemAvail = MemAvailable min during the row. diskDelta_du_kB = du -sk delta of the set's own worktree.

| row | mode | set | exit | wall_s | user_s | sys_s | peakRSS_MiB | amb.load pre(1m) | amb.load post(1m) | minMemAvail_MiB | diskDelta_du_kB | gateWaits | porcelain A/B |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| a-serial-1 | a-serial | a | 0 | 0.39 | 0.58 | 0.15 | 91 | 0.72 | 0.74 | 22590 | 0 | 0 | 0/0 |
| a-serial-2 | a-serial | a | 0 | 0.39 | 0.59 | 0.13 | 92 | 0.78 | 0.80 | 22521 | 0 | 0 | 0/0 |
| b-serial-1 | b-serial | b | 0 | 249.65 | 459.22 | 135.45 | 1559 | 0.81 | 1.79 | 20854 | 52 | 0 | 0/0 |
| b-serial-2 | b-serial | b | 0 | 253.13 | 463.72 | 139.16 | 1641 | 1.72 | 1.41 | 20834 | 52 | 0 | 0/0 |
| a+b-parallel-1 | a+b | a | 0 | 0.50 | 0.64 | 0.16 | 90 | 1.34 | 1.42 | 20741 | 0 | 0 | 0/0 |
| a+b-parallel-1 | a+b | b | 0 | 251.74 | 463.59 | 139.43 | 1705 | 1.34 | 1.42 | 20741 | 52 | 0 | 0/0 |
| a+b-parallel-2 | a+b | a | 0 | 0.44 | 0.60 | 0.15 | 90 | 1.35 | 1.44 | 20862 | 0 | 0 | 0/0 |
| a+b-parallel-2 | a+b | b | 1 | 250.36 | 457.08 | 136.64 | 1619 | 1.35 | 1.44 | 20862 | 52 | 0 | 0/0 |
| p2-fold-a (co-rotated) | a-serial | a | 0 | 0.39 | 0.57 | 0.16 | 91 | 0.26 | 0.37 | 22036 | 0 | 0 | 0/0 |
| b-rca3 | b-serial | b | 1 | 251.52 | 452.17 | 138.72 | 1855 | 0.16 | 1.24 | 20595 | 52 | 0 | 0/0 |

## Exit-code notes (failures are NOT washed out)
a+b-parallel-2 set B exit=1 and b-rca3 (standalone RCA re-run, nothing else in flight) exit=1: two DIFFERENT wall-clock-sensitive tests flaked once each (u7as N2, a5-m1 B4-D3); single-file re-runs after each: 6/6 and 3/3 green. Full RCA with the R-413-1 risk-ledger precedent in FLAKE-RCA.md — conclusion: pre-existing suite-internal timing sensitivity, reproduced SERIAL/standalone, not caused by co-rotation. Timings in the table are unaffected (per-run /usr/bin/time facts).

## Run-to-run spread (per set, serial vs parallel)
- Set A serial walls: 0.40 / 0.40 s | parallel walls: 0.50 / 0.44 s | parallel/serial(min): x1.11
- Set B serial walls: 249.66 / 253.14 s | parallel walls: 251.74 / 250.36 s | parallel/serial(min): x1.00
- Co-rotated A (both hosts live): 0.42 s vs A serial min 0.40 s
