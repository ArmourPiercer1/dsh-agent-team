# R125 Gate Review — Reviewer 2 (R2: build & gate evidence)

- **Role**: Independent Gate reviewer 2 of 3 — build & gate-evidence audit + independent re-runs.
- **Tree**: `int/P9-master-product-closure` @ `8cf9fcb` (`.worktrees/P9-MC`).
- **Date**: 2026-09-04.
- **Method**: Read `docs/ROUTER_RULES.md` + `docs/TEST_METHODS.md` first (house rule). Audited every gate log in `dev/agent-workflow/evidence/P9-master-closure/`, then **independently re-ran** the build/lint/hash/provenance subset in the worktree (allowed writes only: composition-shim regen, place-dist-glue, this verdict file). This verdict rests on R2's own re-runs and file inspection, not on other reviewers' opinions or the main agent's summaries.

---

## VERDICT: NO-GO

**Nature of the NO-GO (read before acting): this is an *evidence-completeness* NO-GO (ROUTER_RULES §3.2 "补充内容 / supplement" category), NOT a technical/code block.** R2 independently re-ran and confirmed that **every underlying technical claim is TRUE** — the 9-package build/typecheck is clean (9/9 exit 0), lint is clean (exit 0, no output), tests are green (root 2395/2395; per-package 2630/2630 with the documented p6t1 flake isolated to 9/9), both install-face byte-matches reproduce, the composition builder is a verbatim provenance lift with zero semantic change, and the test-count reconciliation holds. There is **no code, test, or semantic defect found.**

The gate does **not** pass on the *submitted evidence record* because **three of the five non-smoke gates are not correctly demonstrated by their cited evidence files**:

1. `gate-build.log` (cited for BOTH the typecheck and build gates) does **not** contain "typecheck 8/8 + build 9/9 exit 0". It contains only an abandoned, **failed** `pnpm -r run build` (spawn `EPERM`, `[ELIFECYCLE] Command failed with exit code 1`). The actual successful per-package `tsc` build output for this tree is **not recorded anywhere** (searched the whole evidence tree).
2. `gate-lint.log` (cited for the lint gate) **does not exist** anywhere in the evidence tree.

Remediation is cheap and purely re-packaging (no re-development): re-capture the two logs (see §Remediation). After that, the gate is technically sound (already independently verified by R2) and the record is complete/auditable → re-review.

---

## Per-check table

Legend: PASS = observed matches expected. FAIL = observed does not match expected. "Indep." = R2 independently re-ran/verified (not taken from the submitted logs).

### Task 1 — Log audit

| # | Check | Expected | Observed | Pass/Fail |
|---|-------|----------|----------|-----------|
| 1.1 | `gate-test.log` (root vitest) ends with `Test Files 219 passed (219)` + `Tests 2395 passed (2395)`, exit 0 | Both summary lines, all green | File is **UTF-16LE** (BOM `FF FE`; read tool flags "binary"). UTF-16 decode: all test files `✓`, ends exactly `Test Files  219 passed (219)` / `Tests  2395 passed (2395)`, `Duration 15.20s`. No failures. Exit 0 is *implied* by the all-green summary (no explicit EXIT marker in the log). | **PASS** (content) — see N1/N2 |
| 1.2 | `gate-test-perpkg.log` has 9 package lines + isolated p6t1 re-run | 9 pkg lines + runtime-iso line | 9 package lines (contracts/domain/storage/runtime/tools/remote/client/legacy/testkit) + `runtime-iso` p6t1-parallel line + `TOTAL … 2630`. | **PASS** |
| 1.3 | Each `gate-test-perpkg-<pkg>.log` ends with matching `Tests N passed (N)` + exit 0 (except runtime) | All-green summary per pkg | contracts 150/150, domain 312/312, storage 269/269, tools 35/35, remote 92/92, client 480/480, legacy 98/98, testkit 124/124 — all end `Tests N passed (N)`, no `failed` markers. Exit 0 implied by all-green. | **PASS** — see N3 |
| 1.4 | `gate-test-perpkg-runtime.log` shows known p6t1-parallel load-flake (2 failed) | 2 failed in p6t1-parallel | `Test Files 1 failed | 115 passed (116)`, `Tests 2 failed | 1068 passed (1070)`. Both failures in `p6t1-parallel.test.ts` › "N=2 same-template parallel activations both succeed". Matches the documented flake. | **PASS** (expected exception) |
| 1.5 | `gate-test-perpkg-runtime-p6t1-iso.log` re-runs 9/9 green | 9/9 | `Test Files 1 passed (1)`, `Tests 9 passed (9)`. (R122 r122d precedent.) | **PASS** |
| 1.6 | `gate-lint.log` exists and corresponds to exit 0 (empty = clean) | File present, clean | **File does NOT exist** (absent from `P9-master-closure/` and from the entire `evidence/` tree; only unrelated older lint logs exist). *Indep.:* R2 re-ran `node node_modules/eslint/bin/eslint.js .` → **EXIT 0, empty output (clean)**. Underlying claim TRUE; evidence file missing. | **FAIL** (evidence file missing) — see B2 |
| 1.7 | `gate-build.log` shows typecheck 8/8 + build 9/9 exit 0 | typecheck 8/8 + build 9/9, exit 0 | File is UTF-16LE; contains ONLY a **failed** `pnpm -r run build` — `spawn EPERM`, `[ELIFECYCLE] Command failed with exit code 1` (44 lines, all one aborted pnpm run). No typecheck section, no successful per-package tsc section. *Indep.:* R2 re-ran `tsc -p packages/<p>/tsconfig.build.json` for **all 9 packages → 9/9 EXIT 0** (contracts/domain/storage/runtime/tools/remote/client/legacy/testkit). Underlying build claim TRUE; cited log is the wrong/stale artifact. | **FAIL** (evidence content contradicts claim) — see B1 |

### Task 2 — Independent re-runs (all executed by R2 in the worktree)

| # | Check | Expected | Observed | Pass/Fail |
|---|-------|----------|----------|-----------|
| 2a | `tsc -p packages/domain/tsconfig.build.json` | exit 0 | **EXIT 0** | **PASS** |
| 2b | `node scripts/build-client-composition.mjs packages/client packages/client/composition-shim` | exit 0, regenerates gitignored shim | **EXIT 0**; `85 modules, 11 css files`, entry=`plugin/client.js`, wrote `client-bundle.js` (845581 B) + `index.js` + `package.json` | **PASS** |
| 2c | SHA-256 of regenerated `client-bundle.js` = `2097CE5E…3CB86997` AND = reference `references/.dsh-test-s8-…/s8-client-row/client-bundle.js` | both equal | Regenerated = `2097CE5E570B187F4F163DD09C8FBEE9BF2E04298120B7EA221229423CB86997`; reference = same. Pre-state (before regen) was already equal → build is byte-reproducible/deterministic. | **PASS** |
| 2d | SHA-256 of `packages/runtime/dist/…/agent-bindings.mjs` = `D50D3B3F…B40225B`; `node scripts/place-dist-glue.mjs` → exit 0, idempotent byte-identical | both | Pre-hash = `D50D3B3FBE371078B31208DC1E87F2DA1D5DE309D243E99E6AE9BB452B40225B`; place-dist-glue **EXIT 0**; post-hash identical to pre and to expected (idempotent). | **PASS** |

### Task 3 — Count reconciliation

| # | Check | Expected | Observed | Pass/Fail |
|---|-------|----------|----------|-----------|
| 3.1 | per-package sum 2630 − R122 2532 = 98 = legacy test count | 98 = legacy | Sum 150+312+269+1070+35+92+480+98+124 = **2630**; 2630−2532 = **98**; `gate-test-perpkg-legacy.log` = 7 files / **98** tests. | **PASS** |
| 3.2 | `packages/legacy` has no `vitest.config.ts` while the other 8 packages do | legacy absent, 8 present | legacy: **no** `vitest.config.*`; the other 8 (contracts/domain/storage/runtime/tools/remote/client/testkit) each have `vitest.config.ts`. | **PASS** |
| 3.3 | (corroboration) root run 2395 = 2630 − 235 client UI spec | arithmetic | 2630−235 = 2395; consistent with gate-test.log (2395) and the client `.client.spec.ts(x)` suite included only by `packages/client/vitest.config.ts`. | **PASS** |

### Task 4 — Provenance of `scripts/build-client-composition.mjs`

| # | Check | Expected | Observed | Pass/Fail |
|---|-------|----------|----------|-----------|
| 4.1 | Body is a verbatim lift from `dev/agent-workflow/evidence/P9/s8/s8-bundle.mjs` except: file-header provenance block, usage line, log prefix `s8-bundle:`→`build-client-composition:`, removed unused imports (`readdirSync`/`statSync`). No semantic change. | only the 4 allowed diffs | Canonicalized line-diff of the code body (537 lines each, after the imports) = **0 differing lines** after normalizing exactly (a) log prefix and (b) usage-line filename. fs import differs by exactly the removal of `readdirSync, statSync`; path import identical. Header block replaced by the R125 provenance comment. Emitted-into-bundle strings (e.g. `"s8-team-bundle: unresolved module"`, the `S8 composition adapter` comment) are **unchanged** — confirming only harness-side log prefix changed, not output bytes. | **PASS** (no semantic change) |

---

## Blocking findings (drive the NO-GO)

**B1 — `gate-build.log` does not evidence the typecheck/build gates (content contradicts the claim).**
`gate-summary.md` cites `gate-build.log（typecheck 段）` for "8/8 EXIT 0" and `gate-build.log（build 段）` for "9/9 EXIT 0 (BUILD-ALL-FAIL=0)". The actual `gate-build.log` (44 lines, UTF-16LE) contains **only** a single **failed** `pnpm -r run build`: it starts 4 package builds then dies with `Error: spawn EPERM … code: 'EPERM', syscall: 'spawn'` and ends `[ELIFECYCLE] Command failed with exit code 1.` There is **no** typecheck section and **no** successful build section in the file. R2 searched the entire `evidence/` tree: **no per-package `tsc -p …/tsconfig.build.json` build log for this tree exists anywhere** (all other tsc logs belong to earlier gates/tasks and are against `tsconfig.json`, not this closure's build face). So the typecheck and build gates — two of the five non-smoke gates — are **not demonstrated by any submitted evidence file**, and the one file that is cited actively shows `exit 1`.
*Risk / why it blocks:* an auditor (or a future re-runner) reading `gate-build.log` sees a failed build, which directly contradicts the "9/9 exit 0" claim and undermines the auditability the gate relies on. This is an evidence-integrity defect, not a code defect — **R2 independently confirmed the build is actually 9/9 exit 0** (see 2a + the 9-package tsc batch).

**B2 — `gate-lint.log` is missing (no lint evidence file exists).**
`gate-summary.md` cites `gate-lint.log` for "EXIT 0 (0 error 0 warning)". The file is **absent** from `P9-master-closure/` and from the whole `evidence/` tree (broad glob for `*lint*` finds only unrelated older logs under `G1-REVIEW/`, `P1-T5/`, and a `P9/s9-lint-fixes.md` doc). The lint gate therefore has **no evidence file**.
*Risk / why it blocks:* same evidence-integrity class as B1 — the gate's lint demonstration is not present in the record. **R2 independently confirmed lint is actually clean** (`eslint .` → EXIT 0, empty output).

> Both blocking findings are **evidence-recording defects**, not product defects. R2's independent re-runs establish the underlying facts are true. The NO-GO is on the completeness/correctness of the submitted gate evidence, per R2's mandate as the build & gate-evidence reviewer and the repo's evidence-留痕 discipline (ROUTER_RULES §7; red line 影响面必须可逆/留痕).

## Non-blocking observations

- **N1 — All gate logs are UTF-16LE (BOM `FF FE`)**, which is why the `read` tool reports them as "binary". Content is valid when decoded as UTF-16. Note: `merge-audit.md` §3 records the repo's log discipline as **UTF-8** ("仓库日志纪律 = UTF-8"; UTF-16 was treated there as a "历史捕获瑕疵" to be normalized). The R125 gate logs regressed to UTF-16LE — a hygiene inconsistency worth normalizing to UTF-8 on re-capture.
- **N2 — `gate-test.log` has no explicit exit-code marker.** Exit 0 is implied by the all-green `2395/2395` summary (vitest exits 0 on all-pass). Consider appending an explicit `EXIT=0` line on re-capture.
- **N3 — Per-package logs are raw vitest output with no explicit `EXIT 0` line, and the saved `gate-perpkg.ps1` does not match the saved `gate-test-perpkg.log`.** The runner script emits `{pkg} EXIT={code} …` lines and a specific header, but the saved master log has **no** `EXIT=` field and a **different** header text (`@ 8cf9fcb … legacy via root config filter` vs the script's `<date> … @ HEAD`). The runner script and the master log appear to be **different versions**; the saved script would not have produced the saved log. Minor provenance inconsistency in the evidence tooling.
- **N4 — "8/8 typecheck" is conservative but not wrong; build is genuinely 9/9.** `gate-summary.md` says typecheck covers "8 包；legacy 无 tsconfig.json". Indeed `packages/legacy` has **no** `tsconfig.json`, but it **does** have `tsconfig.build.json`, and R2 confirmed `tsc -p packages/legacy/tsconfig.build.json` → EXIT 0. So the build face is 9/9 (confirmed), and typecheck could also be stated as 9/9. Not a defect; note for accuracy.
- **N5 — p6t1-parallel flake is a documented known load flake, not a regression.** 2 failures appear only under per-package parallel load; the suite is 9/9 in the root run (`gate-test.log`) and 9/9 in the isolated re-run (`…-p6t1-iso.log`), matching the R122 `r122d` precedent. No test/product code changed.
- **N6 (positive) — Provenance verified clean.** `scripts/build-client-composition.mjs` is a verbatim lift of `evidence/P9/s8/s8-bundle.mjs`; the only differences are the four allowed ones (header provenance block, usage line, log prefix `s8-bundle:`→`build-client-composition:`, removed unused `readdirSync`/`statSync` imports). Canonicalized body diff = 0 lines; **no semantic change**; output-affecting strings unchanged.
- **N7 (positive) — Both install-face byte-matches independently reproduced.** Regenerated `client-bundle.js` = `2097CE5E…` = the verified `references/…/s8-client-row/client-bundle.js`; `agent-bindings.mjs` dist glue = `D50D3B3F…` and is idempotent under `place-dist-glue.mjs`. Consistent with `byte-compare.md`.
- **N8 (positive) — Count reconciliation holds and the legacy coverage fix is sound.** 2630 = 2532 + 98 (legacy); legacy has no `vitest.config.ts` (rooted the R122 under-count); root run 2395 = 2630 − 235 (client UI spec). This round's test gate is strictly stronger than R122 (adds legacy 98).

## Remediation (cheap; re-packaging only — no re-development needed)

1. **Fix `gate-build.log` (B1):** re-capture the actual per-package build as the log — for `p` in `contracts domain storage runtime tools remote client legacy testkit`, run `node node_modules/typescript/bin/tsc -p packages/<p>/tsconfig.build.json` and record each `EXIT=0` (R2 confirmed all 9 are exit 0). Clearly separate the typecheck and build sections as `gate-summary.md` describes. (Optionally keep the failed `pnpm -r run build` EPERM attempt in a *separate* annotated file, not as `gate-build.log`.)
2. **Add `gate-lint.log` (B2):** capture `node node_modules/eslint/bin/eslint.js .` → `EXIT=0` with its (empty) output (R2 confirmed exit 0 / clean).
3. *(Hygiene, recommended while re-capturing)* write the new logs as **UTF-8** (not UTF-16LE) per the repo's log discipline, and append an explicit `EXIT=0` line to each.

After (1) and (2), the five-gate evidence record will be complete and consistent with the (already independently verified) green technical outcome, and the gate can proceed to re-review.

---

## Independence note

This review was performed by R2 alone, from R2's own reading of the frozen docs, the evidence files, and R2's own re-runs in the worktree. R2 did not rely on other reviewers' verdicts or on the main agent's narrative for any pass/fail determination. All "Indep." items above were executed by R2 in this session.

**Writes performed by R2 (within the allowed set):** regenerated `packages/client/composition-shim/` (gitignored build output, step 2b); re-ran `scripts/place-dist-glue.mjs` (dist output, step 2d); created this `reviewer-2/verdict.md`. No tracked source file was modified; no git commit/push/branch; no network; `references/` only read/hashed; `D:\deepseek-harness\` and :3080 untouched.
