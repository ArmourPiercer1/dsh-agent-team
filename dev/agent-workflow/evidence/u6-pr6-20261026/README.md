# U6 PR6 evidence index — 2026-10-26

Branch `task/u6-pr6-arc-d-g4-20261026` @ base `acb50dcc41791c5b5b5eda8e172821ec2f93104a`
(origin/master `1ee8c4e53` + merged PR #380). Host pin 0.2.0-rc.2 @ `639ed01539`,
porcelain-empty at boot. One writer.

## Scope A — ARC-D adversarial suite + 42-cell matrix (C1)

* `packages/runtime/test/u6-pr6-arc-d-adversarial.test.ts` — AD1..AD11, 13/13.
* `packages/runtime/test/u6-pr6-arc-d-matrix.test.ts` — sup-a §5 42-cell ledger:
  37 offline legs PASS, 3 live-mapped, 3 carried named (R-U6P6-1 ×2, R-G3-1 ×1).
* Both files green standalone and together (16/16).

## Scope C2 — live suite (ONE boot of ≤6 budget)

`c2/` — run `u5-u6-arc-d-arc-d1-2026-10-26T08-30-55-354Z`:
`--suite u6-arc-d --max-host-starts 2` → **all nine `arcd:*` cases PASS**,
1 host start (`budget-ledger.json`, phase `u6arcd-boot1`), leased port 3182,
stable :3080 probed unchanged (`stable-instance-unchanged`).
Verdict inputs: probe-ledger rows (embedded in `*.evidence.json`:
`spoof-1 NO_APPROVAL_ENTRY`, `swap-1 IDENTITY_MISMATCH`,
`unbound-1 outcome:defer`, `replay-1 GRANT_REPLAY`, post-teardown
`KERNEL_NOT_ACTIVE`), marker dir (exactly one marker, nonce match), wire
claim scan (`nativeClaimFound:true`). Host log under `c2/logs/` (world and
its port are gone; the ephemeral GUI session token in the boot line is
REDACTED in the committed copy — sanitized receipts). Offline counterpart:
`tests/world-factory/u6-arc-d.test.mjs` 7/7 (`node --test`).

## Scope B — legacy center-path removal

* `legacy-path-removal.md` — per-name ledger (read / bash / grep+glob / jobs
  bridge / probe family): old path → single home → census row → C1 suite →
  C2 suite → proof.
* `legacy-path-removal-machine.json` — ARC-A L1–L4 = 0/0/0/0 on this tree,
  hub paths absent ×3, all remaining `plane-effect-backends` mentions with
  their code/comment classification.
* `p4t6-UNBOOKED-RED.log` → `p4t6-GREEN.log` — the first REMOVAL ROUND of the
  census law, RED-first then booked (measured 1277 = booked 1277).

## Gates run here

* `ci-pr-gate.log` — graph-parse PASS, state-freshness PASS, blueprint-fence
  PASS, lint-identities PASS (0 new identities), artifacts-at-head PASS
  (1800 files, drift 0), census **DECLARED-REFUSED** (`--allow-refused
  census`): the gitignored pristine host tree is absent from this task
  worktree, exactly the u6-pr2/u6-pr3 recorded precedent — CI's checkout
  provisions it and grades the leg there.
* `install-leg-ENVIRONMENT-repro.log` — the install leg's failure is the
  sandbox pnpm store (`ERR_SQLITE_ERROR unable to open database file`,
  PNPM_EXIT 1) reproduced directly, unrelated to this diff; likewise the
  typecheck leg fails ONLY on `@deepseek-ai/*` module-resolution in test
  files this PR does not touch (the known worktree link gap; `tsc -p
  tsconfig.json` locally shows 64 errors, ALL pre-existing: this PR's files
  contribute 0). CI installs normally.
* docs:sync --check blocking=0; docs:probe --base origin/master blocking=0
  (re-run before commit).
* Full `packages/runtime` vitest: `full-runtime-vitest.tail.log` +
  `full-runtime-vitest-fails.txt` — **13 files / 8 tests, exactly the booked
  baseline, identity-matched**: a2c1-pwsh-permission, a2c2-permission-
  coverage, a4pr0a-fact-type-closed-set, a5p4-lane-hygiene (@types link gap),
  f1-webserver-shim-isolation, h1a-pre-execute-endcap, issue2-capability-
  permission-precedence, issue2-real-preset-restriction, p6t3-mediation,
  p6t3-restart, rc2-persona-probe, team-skills, team-spill-local-composition.
  None is a file this PR touched; the @deepseek-ai/* and p6t3 families are
  the recorded worktree-environment reds. No NEW reds.

## Live-carried named items (nothing hidden)

R-U6P3-1, R-U6P4-1..3, R-U6P5-1/GLUE-4 (unchanged, PR3/PR4/PR5 rows in
gates/GATE-LEDGER.md), R-U6P6-1 (NEW: live deny restrict/lift pair not
re-run — offline counterpart legs documented in the matrix file), R-G3-1
(eq9 leg lineage). §10.6 recommendation lives in
`docs/plans/memo/unified-baseline-alpha5-20261025/u6/G4-CORE-EVIDENCE.md`:
**G4-CORE-PASS with BRIDGE-BLOCKED standing — not full G4.**
