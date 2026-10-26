# U6 PR3 evidence — process/bash family on the governance kernel (2026-10-26)

Single-writer slice 3/6 (ARC-B part 2). Branch `task/u6-pr3-process-family-20261026`.
Protected set untouched (`control/**`, `pa-mount-registry.mjs`, `tool-admission/**`);
CORE PATCH BUDGET = 0; Host pin 0.2.0-rc.2 @ `639ed01539`.

## C1 — golden-vector parity (the stop condition)

- `digest-master.txt` / `digest-family.txt` + `golden-vectors-master.json` /
  `golden-vectors-family.json`: 299 vectors, ok=154 / err=145, IDENTICAL
  digests — `sha256:efb096a6140530d913ab2b5483d59c981843aa4b57e599fac451c93ae1d02964`.
  Family (governed bash row through the Kernel) is byte-for-byte the master
  (old center path) on every vector.
- `golden-recorder.scratch.test.ts.txt` — the recorder, preserved as
  `.txt` (scratch files must not live in the lint universe; deleted from
  `packages/runtime/test/` before commit).

## C1 — gates

- `p4t6-RED-unbooked.log` / `p4t6-GREEN.log` — the census gate: unbooked
  rows-1263 RED, booked 10 rows GREEN (10/10). Booking 1263−1253=10 = the
  new `packages/tools/process-family` + world-factory lane files.
- `lint-identities-final.txt` — 76 distinct identities, baseline delta
  new=0 resolved=0. Scratch files were MOVED OUT of the lint universe first
  (this dir preserves them as `.txt`).
- `dualgate-offline-probe.test.ts.txt` — the vitest probe proving the dual
  gate's blueprint-side inputs parse correctly: parsed blueprint carries the
  teamEnvelope `bash` token and `leaderExecEnvelopeOps → ["bash"]` + the
  leader allow-lane shell rule. (Deleted from `packages/runtime/test/`
  before commit — its finding is disclosed in the PR body.)
- `sim-u6proc-brain.mjs.txt` — the offline phase-machine simulation of the
  C2 brain router (drives the full phase ladder + wake cadence against a
  synthetic decide script; SIM OK).
- vitest: all suites green (17 PR3 tests; patched-plane 106; glue7 12;
  a5b2/a5b3 23; plants 5; bash-c1 7; u6-fs pin tests 22/22 incl. the
  offline judge fixture over `c2/u5-u6-proc-u6prc5-*.u6proc-evidence.json`);
  `pnpm -r typecheck` clean; docs gates 0 (`docs:sync --check`,
  `docs:probe --worktree-only` blocking=0).
- `root-vitest-final.txt` — the DEFINITIVE full-tree run (quiet tree):
  failing set ⊆ the PR2-recorded machine baseline
  (`t2-blueprint-hash`, `p6t3-mediation`, `p6t3-restart`, `a4p7-merge-gate`,
  `p6t6-actions`), and one baseline red (a4p7's whole-tree typecheck leg)
  turned GREEN through this PR's typecheck fixes. NO NEW REDS.
  Two full-run-only reds found and fixed en route, both disclosed:
  (1) `a5p5-dormant-audit` + `a3p3` consumer census flagged the lane's
  import of the DORMANT a5p5 lane — the design was corrected to
  ASSEMBLY-INJECTED transport (`buildBashRowDefinition(input, rowFactory)`);
  the plane's one form-pinned barrel edge stays the dormant lane's only
  consumer (form pin updated, `a5p5-dormant-audit` 9/9, `a3p3` 21/21).
  (2) `a3p3`'s consumer-set leg re-read every `.ts` of five packages once
  PER policed name (52 full walks); PR3's new files tipped it over the 5 s
  default under full-suite CPU load (`Test timed out in 5000ms`; green
  standalone at 3.6 s). Fixed with a per-run source cache (disk+comment-
  strip once per file; all regexes/teeth untouched): leg 3.6 s → 0.73 s,
  plus an explicit 30 s leg margin.

## C2 — one governed Team World (`c2/`)

- `host-starts.jsonl` — the shared budget ledger: 6 starts,
  `--max-host-starts 6` (u6-proc boots 1-5 = u6prc1..u6prc5, u6-fs re-run
  boot 6 = u6fsr1). The core-suite re-run was SKIPPED for budget and is
  disclosed in the PR body (PR3 touches no surface core exercises; PR2
  core evidence `../u6-pr2-20261025/c2r2/core-u6cr3.out` remains baseline).
- `u6proc-console-run3/4/5.log` + `logs/u5u6prc*-*` — the live drives.
  Run 4's `*.run-abort.json` records the (test-infra) watchdog kill of a
  HEALTHY host mid-drive; the watchdog lifetime was raised afterwards.
- `u5-u6-proc-u6prc5-*.u6proc-evidence.json` — the final live drive's
  evidence digest (9/9 boot time: 6 PASS / 4 FAIL under the OLD spawn-based
  verdicts — the 4 FAILs are the spawn arms that this Host baseline cannot
  reach: the shell-class ask is fingerprint-pinned to `human-admin`
  (pinned grammar a4p7-v3-cutover-acceptance:1797) with no Admin resolver
  (ADR A1-12) → born-terminal for EVERY rung, and the leader exec allow
  downgrades to that ask when the dual-gate token is absent at bind time).
- `u6proc-console-recon.log` + `run-u6proc-recon.json` — the ZERO-BOOT
  reconstruction of the final verdicts through the SHARED judge
  (`judgeU6Proc`, the same function live runs use; the evidence digest is
  its entire input; `proc:mounted` carried verbatim from the live record):
  `overall=PASS cases=9 PASS:9`. The judge's law is disclosed case-by-case
  in `tests/world-factory/README.md`.
- `run-u6proc.json` — the live-run records (all five boots).
- `u6fs-console-rerun.log` + `run-u6fs-rerun.json` +
  `u5-u6-fs-u6fsr1-*.u6fs-evidence.json` — the u6-fs re-run (boot 6):
  `overall=PASS cases=10 PASS:10`, now with the REAL marker-dir channel
  (the PR2-era missing `readdirSync` import — silently `[]` — is fixed;
  PR2's `spoofBodyMarkers: []` was blind, u6fsr1's is a genuine read;
  verdicts unchanged).
- `c2/logs/<world>/instance-port*.log` — per-world Host logs. They contain
  the per-world boot URLs including `?token=...`: these are throwaway
  per-world tokens for torn-down homes on leased ports (never :3080, never
  `~/.dsh`), matching the PR2 evidence precedent (`u6-pr2-20261025`
  records carry the same).

## Hygiene

No secrets, no live-instance material (:3080 / `~/.dsh` never touched);
absolute paths are workspace-local world dirs (test infra, disclosed);
per-world tokens as disclosed above. Test homes `tests/homes/u5u6prc*`,
`tests/homes/u5u6fsr1` were removed after teardown (ownership receipts
checked; all owned PIDs dead — `fs:leak-check` PASS).
