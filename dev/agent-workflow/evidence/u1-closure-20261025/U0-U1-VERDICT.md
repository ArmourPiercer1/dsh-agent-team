# U0 / U1 verdict — PR #364 unified plan (main agent, 2026-10-25T10:3xZ)

Plan: PR #364 merged to origin/master @ `95fbe95cf` (2026-10-25, guarded `--match-head-commit 6e4ada1b`), user ruling
(a) = sole implementation plan; S1 execution ratified (`USER-RULING-20261025T1004Z.json`).

## U0 — **PASS (with user waiver)**

| exit item | status | evidence |
|---|---|---|
| stop product writes / no bulk kill | MET | no product writes this line; no kill issued |
| new F0 observed/excluded/unknown | MET | `u1a/` (50 worktrees, 24 local-only branches/384 commits, 161 root untracked, 542 homes, ports/df) + prior `s1-f0-issued-20261025/` |
| irreplaceable assets have recoverable copy | **USER-WAIVED** (10h backup; recovery = git) | `USER-RULING-20261025T1004Z.json`; mitigation: `.artifacts/git/local-only-20261025.bundle` (25 refs, `git bundle verify` rc=0, sha256 `abf9ae3b…8f51`, 308 MB) |
| forbidden-ops list | MET | :3080, user DSH_HOME, pristine Host, s1-*/s2-*/u1-* evidence, root SESSION_ROUTER_LOG incident entry (sha256 `e3e49b13…`) |
| capacity for U1 | MET | 31 GiB free |

Correction to u1a: "Host pin anomaly" is an artefact of reading the stale root checkout (`6259cf4b`, paths.mjs pin
46a7f68b09). origin/master `tests/paths.mjs:69` pin = `639ed015…` = test-use HEAD. No drift.

## U1 — **PASS** (G1-I incremental check holds; residuals carried as named items)

| item | result | evidence |
|---|---|---|
| EB0-1 authority/consumers | MET | `s2-authority-map-20261025/` (18 consumers MC-01..18), U1-THREE-AXIS |
| EB0-2 nine-package tests | MET | `u1b/`: typecheck 0; vitest ×2 identical: 7733 pass / 20 fail; 9 deterministic = exact tolerated census-9; 11 ENV (clock 2 / checkout-resolution 8 / build 1); 0 flaky; 0 new product reds |
| EB0-2 historical reds | MET | census-9 → 9/9 still red; Root-22 → 9 still red, 13 retired |
| EB0-3 93-seed diff | MET | `u1c/`: 93/90/4/86/3 re-verified (independently recounted by main agent); 86/86 resolve (68 host, 18 team); absent 1 = obligation marker; new 1 = `structured_output` → UNKNOWN |
| EB0-4 asset classes | MET | `u1a/` KEEP-ACTIVE 5 / REUSE 29 / REGENERABLE 16 worktrees; homes hardlinked (real reclaim ≈2 GB) |
| EB0-5 p50/p95 | NOT_VERIFIED (plan allowance) | only n=2 full-suite walls (345 s / 310 s); dependent claims stay blocked |
| EB1 controls via negatives | MET | 94 controls, same 8 historical positive-fixture failures (pre-existing, carried) |
| cold read | PARTIAL → fed to U2 | `u1d/` 25 defects; top: frozen-doc path wrong (they live in `docs/plans/finished/`), stale README SHAs, registry "not merged" read from master, no owner roster, C/T tier namespace |

Carried into U2: u1d defects 1–4 (entry-doc fixes inside the switchover PR); docs-probe CI wiring defect (G2-R1).
Carried open: owner roster (no human roster exists — record as UNKNOWN owner, not invented); `structured_output`
UNKNOWN; 8 docs:controls positive failures; EB0-5.

## G2 round 1 (gpt-6.1-sol) = 补充内容 → main-agent decision: **fix on top of candidate** (round 2 is the last)

Candidate sound (no dual-write, fail-closed, 6 suites green). Required: Authority Migration Map completion,
`dev/engineering/current-authority.json` pointer + guarded switchover transaction, rollback drill, entry-doc
alignment, docs-probe `--base` wiring fix.
