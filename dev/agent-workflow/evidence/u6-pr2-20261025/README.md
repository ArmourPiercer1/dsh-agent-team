# U6 PR2 evidence — FS/read family on the governance kernel

Branch `task/u6-pr2-fs-read-family-20261025` → PR **#373** (base master @
`2db321f63`). Head commits: `e96fb9628` (feat) + `7e31157dd` (shadow-row
minter rebind, the PR1-disclosed close-out). Worktree
`.worktrees/u6-pr2`. DO-NOT-MERGE directive respected.

## RESUMED ROUND (remediation gate — FIX-D/K/T + gate record on master)

Master `c6cfec890` merged into the branch (merge `11c214f28`, NO rebase, NO
force-push — #373 was published). The read lane migrated to the FIXED
kernel per R-REM-2; new C1 `u6-pr2-rrem2-read-lane.test.ts` (RR1–RR6,
6/6). Receipts for this round in `c2r2/`:

| Gate | Result |
| --- | --- |
| C2 `--suite u6-fs` (merged+migrated head) | **overall=PASS, 10/10 cases** run `u5-u6-fs-u6fsb9-2026-10-25T19-44-50-334Z` (`c2r2/u6-fs-u6fsb9.out`), ONE boot (`budget-u6fsb9.jsonl` phase u6fs-boot1) |
| R-REM-3 cap-hit (same run) | `fs:shadow-ledger-cap` PASS — product shadow row on a 5-row K5 budget, 2 terminal `shadow-ledger-capped` markers, hostAlive, post-cap governed read still answering (`c2r2/…u6fs-evidence.json` + case line) |
| C2 `--suite core` re-run | **overall=PASS 7/7** run `u5-core-u6cr3-2026-10-25T19-45-02-380Z` (`c2r2/core-u6cr3.out`), ONE boot — **2 Host starts total, ≤4** |
| Kernel call-site migration | plane + install.ts + agent-bindings on the FIX-K API; enforcing+lifecycle port; scoped bind-once; pre-body table gate; consumeOnce-only (no retry site exists) |
| p4t6 on the merged tree | 10/10, MEASURED 1251 (pre-booking run `expected 1251 to be 1250`) |
| Golden vectors AFTER migration | 4/4 — digest `7fbb3ab9…` byte-identical still |
| audit / a5p0 / lint | OK (27 consumers incl. center-shadow-row) / 4/4 / new 0 |
| typecheck (`pnpm -r`) | exit 0 |
| ci-pr-gate (required legs) | pass 7 fail 0, census = named skip (graded by CI) |
| docs:sync --check / docs:probe --base origin/master | findings=0 blocking=0 / blocking=0 non_blocking=0 (checkCitedPaths green) |

Disclosure: the resumed C2 ran WITHOUT `--keep-home` (leak-check asserts
`homeReleased`), so the raw per-world probe ledger and the host instance
logs did not survive/belong in this set by mandate — the verdict-carrying
receipts are the runner console records, budget ledgers and
`…u6fs-evidence.json`, and every case verdict is fully stated in them.

## Headline results

| Gate | Result |
| --- | --- |
| Golden-vector corpus (877 vectors, recorded from master pre-move) | digest `sha256:7fbb3ab9ae48451fc8ab41489491dfcf4d0420bfaa0f596dd09c949124a7987c` reproduced BYTE-IDENTICAL after the move (`golden-vectors-after-pr2.json`; pinned in `packages/runtime/test/u6-pr2-read-golden-vectors.test.ts`) |
| C1 new suites | u6-pr2-read-golden-vectors 4/4, u6-pr2-kernel-flow 4/4, u6-pr2-kernel-guard-plants 4/4 |
| Moved read suites (identities/titles kept) | window 61, c1c2, a2c5, a3p5, seam-enforcement, artifact-read — green |
| C2 `--suite u6-fs` (real Host 0.2.0-rc.2 @ 639ed01539) | **9/9 PASS** run `u5-u6-fs-u6fsb8-2026-10-25T17-50-11-493Z` (`c2/`) |
| C2 `--suite core` re-run | **PASS 7/7** run `u5-core-u6cr2-2026-10-25T17-51-53-751Z` |
| world-factory offline gates | `node --test` 13/13 |
| p4t6 | 10/10 (`SCANNED_PATHS_U6PR2` measured 1238→1248 pre-merge; 1240→1251 on the merged tree — see RESUMED ROUND) |
| audit + a5p0 | OK (27 consumers: +read-executor booked, +center-shadow-row booked for the rebind, plane-effect-backends retired in place) / 4/4 |
| lint-identities | new 0, resolved 0 vs `a4-lint-baseline/lint-identities-0237d487.txt` |
| typecheck | `pnpm -r typecheck` exit 0 |
| docs | `docs:sync --check` blocking=0; `docs:probe --base origin/master` blocking=0 |
| dist mirror | `check-artifacts-committed` OK 1786 files / 19 glue; `check:artifacts:head` "HEAD carries its own build" |
| ci-pr-gate default legs | graph-parse / state-freshness / install / blueprint-fence / typecheck / artifacts-at-head PASS (`logs-gate-default.log` — pre-rebind run) |
| nine-root census | locally DECLARED-REFUSED (`--allow-refused census`: this worktree has no `tests/deepseek-harness-test-use`, the gate refuses pre-spawn by law); graded by the PR's CI census run |

## Boot ledger (C2)

12 Host starts total, all factory-leased (ports 3180-family, DSH_HOME under
`tests/homes/`, never :3080/~/.dsh): 8 for the u6-fs bring-up
(`c2/budget.jsonl`, the suite's final green pass booted 3) + 4 for the core
re-run (refusal attempt at cap is itself in the ledger:
`overall=REFUSED, worlds=none`). Slice-plan ask was ≤5 — overage disclosed.

## Repro

```
cd .worktrees/u6-pr2
node tests/world-factory/u5-canary-runner.mjs --suite u6-fs --line u6fsbN \
  --evidence .artifacts/tmp/u6pr2-evidence/c2 --max-host-starts 5
node tests/world-factory/u5-canary-runner.mjs --suite core --line u6crN \
  --evidence .artifacts/tmp/u6pr2-evidence/c2-core --max-host-starts 5
node --test tests/world-factory/world-factory.test.mjs
```

## Contents

- `golden-vectors-after-pr2.json` — post-move corpus (digest above);
  `golden-vectors-digest-before-surgery.txt` — pre-move recording protocol.
- `c2/` — u6-fs evidence JSONs (b5–b8), run records, budget ledgers, probe
  ledgers (incl. final-run `final-run-u6fsb8-probe-ledger.jsonl`), b1–b4
  console logs, `root-b6-forensics.jsonl.gz`, core re-run logs + summary,
  `u6fs-admission-repro.mjs` (offline repro).
- `u6pr2-final-vitest-*.log`, `logs-gate-default.log` — full-suite passes
  (failing set ⊆ master-baseline set measured on this machine) and gate legs.
- `z-u6pr2-golden-recorder.scratch.test.ts`, `cut-presentation.mjs`,
  `kernel-wiring.mjs`, `swap-rowdef.mjs` — the pre-move recorder and the
  surgery scratch scripts (kept for provenance).
- `pr-body-draft.md` — the PR body (identical to #373's).

manifest.json = sha256 of every file in this directory.
