# G4 promotion re-review R2 — independent reviewer B (deepseek-v4-pro)

Self-check: worktree `/srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/rr-g4-b`, detached.
- HEAD = `7a789a91de13ba2f05317de68c84828bf7ec900d` (master tip short `7a789a91d` — matches brief)
- `git status --porcelain` = empty (0 bytes) — clean


---

## Check 1 — Equivalence claims recomputed

Command: `git diff --name-only d8f40c0d origin/master -- packages scripts | wc -l` → **34**
Command: `git merge-base --is-ancestor e6589ef5f d8f40c0d; echo $?` → **1**

Result: the R1 review's equivalence sentence for R-G3-1/R-REM-1 (`git diff d8f40c0d..HEAD -- packages scripts` empty) does **not** reproduce — 34 files, exactly as RULING-B-G4R-3 records. This packet carries **no row closed by equivalence**: all five gate items were re-run live on the candidate (B-G4R-3 "Ruling" table), and every one of the five PASS records below is a live run-record whose `teamSha == 5d0c8ff58…`, not a diff argument. RULING-B-G4R-3's evidence rule (read teamSha out of the JSON, name the reference commit, paste verbatim diff) is satisfied for every row in this packet by the live records themselves. No unchecked prose-diff equivalence remains. **PASS.**

## Check 2 — One candidate, no mixing

Every live record's `bindings.teamSha` read out of the JSON (python, not prose):

| record | overall | teamSha |
|---|---|---|
| arc-a/run-record.json | PASS | 5d0c8ff5830271b7e2ab3e7c855bb85fb2090bf3 |
| arc-d/run-record.json | PASS | 5d0c8ff5830271b7e2ab3e7c855bb85fb2090bf3 |
| jobs/u7g4r3-jobs-1.u74a-run-record.json | PASS | 5d0c8ff5830271b7e2ab3e7c855bb85fb2090bf3 |
| arc-b/c2-verdicts-boot1-u7tb-c2-mvshku2s.json | PASS | 5d0c8ff5830271b7e2ab3e7c855bb85fb2090bf3 |
| crash/run-u5-crash-…19-27-56-518Z.json (supervisor) | PASS | 5d0c8ff5830271b7e2ab3e7c855bb85fb2090bf3 |
| crash/run-u5-crash-…19-27-56-518Z-A.json (survivor) | PASS | 5d0c8ff5830271b7e2ab3e7c855bb85fb2090bf3 |

Attempt-1 FAIL records (arc-a attempt 1, crash attempt 1) also bind the same SHA and stand unedited. All `hostSha=639ed01539…` (0.2.0-rc.2 pin). Candidate commit `5d0c8ff58…` @ 2026-10-28T15:29:29Z contains `CANDIDATE.md` (`git ls-tree -r … | grep CANDIDATE.md` → present) and **predates every run** (first run 17:15:44Z). Runtime clone porcelain-clean: `hostPorcelainEmptyAtStartup=true` (arc-a/arc-d/crash-A) and `sandboxPreflight.porcelainEmpty=true` everywhere; `teamTreeClean=false` in 4 records is honestly disclosed and `teamTreeDirtyPaths` names ONLY the lane's own append-only boot ledgers (zero source drift). **PASS.**

## Check 3 — Binding cells (R-G4R-1)

Read from each record's `bindings`: teamSha, hostSha/hostTreeSha, teamTreeClean/hostPorcelainEmptyAtStartup — all present and as stated. `composedProfileDigest` and `worldOracleDigest` are **persisted non-null** in arc-a, arc-d, jobs, crash-A (with `worldOracle.complete` + `sources[]` + `hashLaw`). `authority` is stamped in all six records (snapshot `as20261026r1`, pointerSha256 `42465659…`, snapshotDigest `19822870…`). `sandboxPreflight` + `nativeConfinementBackend=partial` present in the canary-runner records.

**Gap (see Finding 1):** `trustedSourcesDigest = null` in arc-a, arc-d, jobs, crash-A (carries `trustedSourcesUnavailableReason`, disclosed, not "satisfied"). ARC-B record emits **no** `composedProfileDigest`/`worldOracleDigest`/`trustedSources`/`sandboxPreflight` cells (c-suite schema; README:115,134 discloses this). R1 "What closes it" item 4 ("persists composed-profile / trusted-source / world-oracle … binding complete instead of null") is therefore only **2/3** met. No `null` is described as satisfied → no HIGH under the brief's rule, but the closure condition is partial.

## Check 4 — Verdict vocabulary not softened

`tests/world-factory/lib/run-record.mjs`: `VERDICTS = [PASS, FAIL, REFUSED, ENV_BLOCK, SKIP, TIMEOUT, START_FAILED]` (:26); `VERDICT_SEVERITY` PASS=0 < SKIP=1 < REFUSED=2 < ENV_BLOCK=3 < TIMEOUT=4 < START_FAILED=5 < FAIL=6 (:29-37); `overallVerdict` takes worst-of (:44-52) — a record containing ENV_BLOCK (severity 3 > 0) can never reach `overall: PASS`; `exitCodeFor` returns 0 only when `overall === 'PASS'` (:175-178). Docstring :11-14 hard-codes "SKIP/REFUSED/ENV_BLOCK are disclosures, never colours … 不是 PASS". `bindSandboxPreflight` (:157-166) never recolorises a verdict. No softening. **PASS.**

## Check 5 — Boot accounting

Ledger line counts (in-packet): arc-a 2, arc-d 1, jobs 1, arc-b 1, crash 2, crash-retry 2 = **9**, all declared pre-spawn (arc-a ledger entries 17:16:12Z / 18:52:54Z; arc-b `boot-budget.jsonl` `{"boot":1,"budget":1,"declaredAt":…}`; crash retry ledger has victim+core lines). Plus 3 phase-2 starts (B-G4R-3) = **12 chronological**, against ceiling **25** (RULING-B-G4R-5:11). Over-budget starts are disclosed by named rulings B-G4R-4 (ARC-A retry +1) and B-G4R-6 (crash retry +2), each with independent-review signature + disclosure line. Record count (6 PASS + 2 FAIL/ENV) agrees with README legs 1-5. No undeclared/unaudited boot found. **PASS.**

## Check 6 — The ENV-native question (R1 item 3)

The Jobs Bridge native cell is **no longer ENV_BLOCK — it runs and PASSes**: `u74a:native-ctl-unaffected` verdict `PASS`, `ctlHead` = `U74A_CTL_CLAIM_…` + `landlock-run: partial enforcement (older Landlock ABI)`, `rootKernelMentions:0`. Backend `partial` (usable), so per §9 the leg legitimately ran rather than ENV_BLOCK (ENV_BLOCK needs `unusable` + typed refusal — `nativeConfinementEnvBlock` :661-682 requires both). Pre-flight is a **real measurement**: `isSandboxPreflightRecord` is identity-branded (`PREFLIGHT_RECORDS.has`) so a JSON round-trip/spread clone is refused (host-sandbox-assets.test.mjs:928-936); the persisted record additionally pins `launcherSha256=a752bc72f111…` matching the tracked manifest pin in CANDIDATE.md, so a fabricated "partial" would also have to reproduce the launcher digest. I accept the pre-flight as proof the environment was real, and I accept the native leg as a genuine product PASS under partial Landlock (no partial⇒full equivalence claimed — disclosed in `nativeConfinementDisclosure`). **PASS.**

## Check 7 — ARC-B leg seam + closed ledger

Command used the new seam (`run-c2.mjs --evidence …/arc-b --budget-ledger …/arc-b/boot-budget.jsonl --budget 1 --allow-reused-dir`). `git ls-files -m dev/agent-workflow/evidence/u7-tbash-l4-20261027/` → **empty** (closed lane ledger byte-identical to master, nothing written into it). The lane's own `arc-b/boot-budget.jsonl` = 1 line (within budget 1); `c2-verdicts-boot1-….json` is a real boot record (6 cases PASS, `schema`, `hostStarts`, `tbashDigest`, `mockDigest`), not a dry-run artefact. The `--allow-reused-dir` deviation (config-time refusal at attempt 1, zero boots consumed) is disclosed (README:117-127). **PASS.**

## Check 8 — Judge immutability

`git diff --name-only a23f11a3b… 5d0c8ff58… -- packages scripts tests/world-factory` → **empty** (candidate = base + evidence only).
`git diff --name-only 5d0c8ff58… 7a789a91d… -- packages scripts tests/world-factory` → **empty** (no judge/suite/assembly byte changed between the candidate the records bind and master tip; the 78 changed files are all docs/evidence/rulings). No leg PASSed because a judge was relaxed. **PASS — no laundering.**

## Check 9 — Receipts

PR #432 merge = `5410faa33…`, first parent `4fd9c51ab…` (base). Re-ran:
- `node scripts/eb3-run-manifest.mjs --new-since 4fd9c51ab…` → `EB3-RUN-MANIFEST pass records=110 strict=9 incomplete=11 findings=0` (matches claimed records=110 findings=0).
- `node scripts/eb3-evidence-guard.mjs --new-since 4fd9c51ab…` → `EB3-EVIDENCE-GUARD pass added=60 bound=1048576 exempted=0 findings=0` (findings=0 ✓; added=60 vs claimed 56 explained — see below).
- `git diff --check 4fd9c51ab...5410faa33` → **exit 0** (whitespace-clean, the #432 scope).

Discrepancy reconciliation: PR #432's own evidence additions base→merge = **56** (matches claimed added=56); post-#432 merges (#436/#437/#438) add 6 more evidence files (4 review reports + ROUTING-LEDGER + REVIEW-REMEDIATION), so re-running at master tip yields 60. `packages/**` changed in the receipt window (base→tip) = **0**; `scripts` = 0. Largest added evidence file = 314 358 B < 1 MiB. **PASS**, with one LOW nit (Finding 3).

## Check 10 — Carried-risk currency

- **R-G4R-2**: re-scoped correctly in RULING-B-G4R-3 (bwrap unusable but Landlock launcher works; the FAIL was a gitignored-launcher provisioning gap, not a host limit). Truthful. No ledger row still blames the host.
- **R-G3-1 / R-REM-1**: re-opened on the candidate (B-G4R-3) and now closed by the live crash retry record (RULING-B-G4R-6 dated follow-up + README leg 5). Truthful.
- **R-U6P3-1 / R-U6P4-1..3**: their U6 rows still read "NOT live-proven / carried to U7" (historical, dated 2026-10-26 — accurate then). The closure is established by the ARC-B and Jobs live records here; the ledger has no *superseding* "closed" row yet, but the promotion verdict itself is the closure record. Not a defect; flagged as a residual that the promotion application must append the closure row.
- **R-G4R-1**: see Finding 1 — binding digests only 2/3 persisted. The carried risk is honestly still partially open.

---

## Verdict

**投机通过** (speculative pass — gate may open with a risk ledger), NOT clean 通过 and NOT 阻塞.

The core fixed-SHA C2 conjunction (ARC-A + ARC-B + ARC-D + real named Bridge + crash-survivor, all live, all bound to `5d0c8ff58…`) is genuinely satisfied; receipts are green; boot accounting is honest; the judge/suite/assembly bytes are unchanged; verdict vocabulary is intact. What prevents clean 通过 is two honestly-disclosed residuals: (a) the crash-survivor leg is a **PASS-by-knob** (`--kill-after 6000`, empirically obtained, structurally non-deterministic assertion, durable fix R-CRASH-1 deferred post-freeze), and (b) R-G4R-1 binding completeness is only 2/3 (trustedSourcesDigest still null; ARC-B lacks profile/oracle digests). These are the kind of disclosed residuals ROUTER_RULES §6 requires a risk ledger for — hence 投机通过, not 通过. The RULING-B-G4R-6 text stands on its own (self-contained mechanism + knob + conditional-PASS caveat) despite the untracked RCA.

## Findings

1. **MEDIUM — R-G4R-1 binding completeness 2/3.** `bindings.trustedSourcesDigest = null` in arc-a/arc-d/jobs/crash-A run-records (disclosed via `trustedSourcesUnavailableReason`; not described as satisfied, so not HIGH), and `arc-b/c2-verdicts-boot1-….json` emits no `composedProfileDigest`/`worldOracleDigest`/`sandboxPreflight`. R1 "What closes it" item 4 ("binding complete instead of null") not fully met. Command: python read of each record's `bindings` (above). Closure: persist a plane TrustSources digest (or record a tracked ruling that the runner surface genuinely cannot, and stop carrying it as a closure item) + emit profile/oracle digests from the c-suite.
2. **MEDIUM — crash-survivor leg is PASS-by-knob.** Supervisor `overall: PASS` 5/5 rests on `--kill-after 6000`; `u5-parallel-supervisor.mjs:92` assertion is structurally non-deterministic; durable fix R-CRASH-1 deferred post-freeze. Disclosed (RULING-B-G4R-6, README:161-181), authorized, not laundered — but the PASS is empirical/conditional, the primary reason for 投机通过. Closure: land R-CRASH-1 (hold/probe handshake + split aliased cells) and re-run clean.
3. **LOW — whitespace nit outside the #432 scope.** `git diff --check 4fd9c51ab...7a789a91d` → exit 2: `dev/agent-workflow/evidence/review-routing-20261028/R438-og.md:52: new blank line at EOF` (a post-#432 review report). The packet's claimed "whitespace-clean" is scoped to `base...merge` (#432), which IS clean (exit 0). Closure: strip the trailing blank line.

## Commands and results

- `git rev-parse HEAD` → `7a789a91d…`; `git status --porcelain` → empty.
- `git diff --name-only d8f40c0d origin/master -- packages scripts | wc -l` → 34 (R1 equivalence false).
- teamSha dump (python) over 8 records → all 5 live PASS legs = `5d0c8ff58…`.
- `git ls-tree -r 5d0c8ff58… | grep CANDIDATE.md` → present; commit 15:29Z < first run 17:15Z.
- `grep VERDICT_SEVERITY …/run-record.mjs` + read :26-178 → no softening.
- ledger `wc -l` → 9 in-packet + 3 phase-2 = 12 vs 25 (B-G4R-5:11).
- `git ls-files -m …/u7-tbash-l4-20261027/` → empty (closed ledger untouched).
- `git diff --name-only 5d0c8ff58… 7a789a91d… -- packages scripts tests/world-factory` → empty (judge immutability).
- `node scripts/eb3-run-manifest.mjs --new-since 4fd9c51ab…` → records=110 findings=0.
- `node scripts/eb3-evidence-guard.mjs --new-since 4fd9c51ab…` → added=60 findings=0 bound=1048576.
- `git diff --check 4fd9c51ab...5410faa33` → exit 0.

## Residual risk

- R-CRASH-1 (harness crash-sequencing handshake + aliased-cell split) deferred post-freeze → crash leg remains empirically-passed, re-run required on the fix.
- R-G4R-1 binding not fully closed (trustedSources null; ARC-B profile/oracle absent).
- The packet note's "RULING-B-G4R-{1..6}" is imprecise (only RULING-B-G4R-{3,4,5,6}.md exist; R-G4R-1/2/3 are risk IDs, not ruling files) — cosmetic.
- R-U6P3-1 / R-U6P4-1..3 have no *superseding* "closed" ledger row yet; the promotion application should append the closure rows to keep the ledger current.
