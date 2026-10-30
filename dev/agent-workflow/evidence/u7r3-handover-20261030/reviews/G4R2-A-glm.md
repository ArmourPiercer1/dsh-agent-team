# G4 promotion re-review R2 — independent stage review A (glm, tier R3, 2026-10-28)

Worktree: `.worktrees/rr-g4-a`, detached @ `7a789a91de13ba2f05317de68c84828bf7ec900d` ("Merge pull request #438", master tip).
Self-check: `git rev-parse HEAD` → `7a789a91de13ba2f05317de68c84828bf7ec900d`; `git status --porcelain` → 0 lines (clean). READ-ONLY review; no Host booted; `:3080` and `~/.dsh` untouched; nothing pushed.

Claim under test: five live legs (ARC-A, ARC-D, Jobs, ARC-B, crash-survivor) each have `overall=PASS` records bound to frozen candidate `5d0c8ff5830271b7e2ab3e7c855bb85fb2090bf3`, receipts green, boot accounting honest → G4 may move from `G4-CORE-PASS/BRIDGE-BLOCKED` to full `G4-PASS`.

(This file is written incrementally; sections appended after each numbered check.)

## Check 1 — recompute every equivalence claim

No row in **this** packet is closed by equivalence. All five legs carry **live** records; I read `bindings.teamSha` out of each JSON myself (python dump, not the README):

- `arc-a/run-record-attempt1-envfail.json`, `arc-a/run-record.json`, `arc-d/run-record.json`, `jobs/u7g4r3-jobs-1.u74a-run-record.json`, `arc-b/c2-verdicts-boot1-u7tb-c2-mvshku2s.json` (also `bootDeclaration.teamSha`), `crash/run-…-19-09-04-633Z.json` + `-A.json`, `crash/run-…-19-27-56-518Z.json` + `-A.json` — **all nine** read `teamSha = 5d0c8ff5830271b7e2ab3e7c855bb85fb2090bf3`, i.e. the frozen candidate itself, so there is no reference-commit diff to reproduce and no prose "diff is empty" to trust.
- The crash-survivor row (the one R1 got wrong) is closed by a **live rerun** on the candidate, not by equivalence: attempt-1 FAIL record preserved unedited; retry on a fresh ledger, both records binding the candidate SHA.
- The only equivalence sentence in the governing chain is R1's historical one for R-G3-1/R-REM-1; the ledger's newest relevant row (G4-R takeover reconciliation) already re-opens it (34-file diff, AFFECTED) — consistent with the brief's warning; historical text kept, not laundered.
- ARC-A is also rerun live on the candidate (10/10 PASS), satisfying R1 item 5's "rerun if the candidate moves".

**Result: no open equivalence claim to recompute; nothing fails this check.**

## Check 2 — one candidate, no mixing

- Every record (list above) binds the **same** `teamSha=5d0c8ff58…` and `hostSha=hostTreeSha=639ed015397290b3745d163aafe02ffee4aa3f84` (0.2.0-rc.2 baseline pin). No mixing.
- `CANDIDATE.md` is committed **inside** the candidate commit at `dev/agent-workflow/evidence/u7-g4r3-20261028/CANDIDATE.md` (`git show 5d0c8ff583…:dev/agent-workflow/evidence/u7-g4r3-20261028/CANDIDATE.md` → "# G4-R phase 3 — frozen candidate (recorded BEFORE any Host boot)…"). Candidate commit date `2026-10-28T15:29:29+00:00` (`git show -s --format='%H %cI %s' 5d0c8ff58…` → "docs(evidence): G4-R phase 3 candidate freeze (pre-boot)") **predates every run** (earliest `startedAt` = 2026-10-28T17:15:44.291Z, arc-a attempt 1).
- Runtime clone porcelain-clean: `bindings.sandboxPreflight.porcelainEmpty=true` and `bindings.hostPorcelainEmptyAtStartup=true` in every canary/crash record; `globalPostChecks.hostBasePost.porcelainEmpty=true` in every record; jobs/arc-b use different record schemas (disclosed in README) and carry `hostBasePost.porcelainEmpty=true` / `teamTreeClean=true` respectively.

**Result: satisfied.**

## Check 3 — binding cells (R-G4R-1)

Per record, as the bytes say (python dump over all nine records):

- `teamSha` / `hostSha` / `hostTreeSha`: populated, identical values above.
- `teamTreeClean`: `true` on arc-a attempt-1 and arc-b; `false` on arc-a retry, arc-d, crash ×4 — with `teamTreeDirtyPaths` listing **only this lane's own append-only ledgers/evidence** (verified in the crash records' dirty-path lists). README discloses this honestly as the ledger-append cause, not a candidate-integrity issue. Not laundered.
- `composedProfileDigest` + `profileArtifacts` (digest + artifact path per world): populated in arc-a ×2, arc-d, jobs, crash-A ×2.
- `trustedSourcesDigest`: **null in every record that has the cell** (arc-a ×2, arc-d, jobs, crash-A ×2), each with machine-readable `trustedSourcesUnavailableReason` ("runner public World/HTTP surface exposes no plane TrustedSources/admission source document or digest…"). Phase-2 arc-d record also `null` → pre-existing surface gap, not new drift. **No null is described as satisfied anywhere** → not HIGH by the brief's rule, but R1 closure item 4 demanded the binding "complete instead of null" → **Finding F1 (MEDIUM)**.
- `worldOracle` (+ `complete`, `oracleArtifactPath`): populated everywhere with digest + sha256'd artifact. `complete=true` on arc-a ×2 and crash-A ×2; **`complete=false` on arc-d and jobs** (`unresolvedDynamicImports=["tests/world-factory/lib/host-sandbox-assets.mjs:223"]`; jobs additionally `unresolvedLiteralReads=["tests/world-factory/lib/run-record.mjs:196"]`, `literalReadsComplete=false`). Honest in bytes; the README quotes only the digest and does **not** disclose `complete=false` → **Finding F2 (MEDIUM)**. Phase-2 arc-d was `complete=true` with no unresolved imports.
- `authority`: populated in all records (pointer `as20261026r1`, `snapshotDigest=1982287…`, pointerSha256).
- `sandboxPreflight` / `nativeConfinementBackend`: populated in all five legs' records (schema `u7-sbx-sandbox-preflight/1`, `probed=true`, `backend="partial"`, `usable=true`, pinned `launcherSha256=a752bc72…`, `porcelainEmpty=true`, before/after-provision verdicts). `nativeConfinementBackend="partial"` with the standing `nativeConfinementDisclosure` verbatim in each record — pre-flight verdict, never a product PASS; no partial⇒full equivalence claimed.

**Result: no null-as-satisfied (no HIGH); two MEDIUM findings F1/F2 on residual binding gaps.**

## Check 4 — verdict vocabulary

- `tests/world-factory/lib/run-record.mjs:26-42`: `VERDICTS` frozen `['PASS','FAIL','REFUSED','ENV_BLOCK','SKIP','TIMEOUT','START_FAILED']`; `VERDICT_SEVERITY = {PASS:0, SKIP:1, REFUSED:2, ENV_BLOCK:3, …}` — **not softened**; header comment (:13-14) states SKIP/REFUSED/ENV_BLOCK are disclosures, never colours (plan §3).
- `overallVerdict` (:44-52): worst case by severity; `cases.length===0 → 'FAIL'`. `exitCodeFor` (:174-178): **0 only for all-PASS, else 1**; runners exit `exitCodeFor(rec)` (u5-canary-runner.mjs:1060, u7-4a-jobs-suite.mjs:262, u5-parallel-supervisor via same lib). Therefore a record containing ENV_BLOCK (severity 3) can never reach `overall: PASS` nor exit 0.
- `docs/TEST_METHODS.md` §9 clause 3 states the severity order is unchanged this round — matches the code.
- Bytes re-checked: arc-a attempt-1 = 9 FAIL + 1 PASS (`stable-instance-unchanged`) → `overall=FAIL` ✓; crash attempt-1 supervisor = 4 PASS + 1 FAIL (`other-world-unaffected`) → `overall=FAIL` ✓; every `overall=PASS` record has all-case-PASS verdicts (arc-a 10/10, arc-d 12/12, jobs 12/12, arc-b 6/6, crash retry supervisor 5/5 + survivor 7/7) ✓.

**Result: satisfied — worst-case law intact in code and in the records.**

## Check 5 — boot accounting

Ledger lines (cat, all small): `arc-a/host-starts.jsonl`=2, `arc-d`=1, `jobs`=1, `arc-b/boot-budget.jsonl`=1, `crash/host-starts.jsonl`=2, `crash/retry-host-starts.jsonl`=2 → **9 phase-3 boots**; phase-2 lane `u7-g4r-live-20261028` ledgers = 3 (arc-d 1 + arc-d retry 1 + jobs 1) → **12 total consumed**, matching the packet's 12/25 claim and ≤ the user ceiling 25 (B-G4R-5). Every consumed boot has a ledger line whose `at` precedes/equal its record's boot entry (e.g. arc-b `declaredAt 19:08:03.759Z` < spawn entry `19:08:42.453Z`; arc-a attempt-1 `17:16:12.348Z` = record `hostStarts.thisRunEntries.at`); arc-a/jobs/crash ledgers carry pre-spawn empty stubs committed in the freeze (verified: `git show 5d0c8ff583…:…/arc-a/host-starts.jsonl` = empty), the retry ledger fresh (disclosed). README per-leg readouts match the ledgers (2/2 cap 2, 1/1, 1/1, 1/1, 2/2, 2/2 fresh). Over-budget starts **disclosed as over-budget**: B-G4R-4 (ARC-A ENV retry, +1, named ruling + og review + B-G4R-5) and B-G4R-6 (crash retry, +2, named ruling + og review + disclosure). ARC-B attempt-1 refusal consumed **zero** boots (config-time refusal, ledger stayed 0, disclosed). Chronological numbering consistent: phase-2 3 + phase-3 9 = arc-a a1 boot 4 … crash retry boots 11+12. No consumed boot is unaccounted for.

**Result: satisfied — 12/25, honest, no unaccounted boot.**


## Check 6 — the ENV-native question (my ruling)

The Jobs Bridge record's `u74a:native-ctl-unaffected` is a **real PASS, not ENV_BLOCK** — there is no non-PASS case in the Jobs record at all (12/12 PASS, exit 0). Evidence from the JSON: case verdict PASS; `ctlHead` claim `U74A_CTL_CLAIM_u5g4r3j-20261028t19-00-10z` found + stderr `landlock-run: partial enforcement (older Landlock ABI)` — the native control leg **ran**; `bindings.nativeConfinementBackend="partial"` + `nativeConfinementDisclosure` recorded verbatim.

Fabrication resistance: `isSandboxPreflightRecord` (`tests/world-factory/lib/host-sandbox-assets.mjs:640-646`) requires membership in the module-private `PREFLIGHT_RECORDS` brand set (minted only by `preflightHostSandbox()` in-process; the brand does not survive JSON) **plus** shape (`schema=u7-sbx-sandbox-preflight/1`, `probed===true`, string `backend`) — a JSON-forged pre-flight cannot qualify. `nativeConfinementEnvBlock` (:661+) gates ENV_BLOCK on a conjunctive **unusable** probe **and** the host's typed unavailable signal on a leg that already failed its functional assertions; everything else stays FAIL — there is no ENV laundering path.

**Ruling:** G4 may pass on the remaining cases **without any ENV_BLOCK carve-out** — the never-PASS law (SKIP/REFUSED/ENV_BLOCK/UNKNOWN are never PASS) is simply not invoked, because nothing in this packet claims ENV_BLOCK. R1 item 3's caveat ("the native-ctl leg is recorded as ENV_BLOCK with the bwrap evidence; the Bridge verdict must not depend on it") was written under the now-corrected host-limit scoping; the ledger's newest wording (B-G4R-3 reconciliation) re-scopes R-G4R-2 to the gitignored-launcher provisioning gap, fixed by #429 + `docs/TEST_METHODS.md` §9; the actual packet result is **strictly stronger than what R1 demanded**: a real PASS on a real, branded, pinned pre-flight (launcher sha `a752bc72…`, porcelain empty, before/after-provision verdicts) under partial Landlock enforcement, disclosed as a standing pre-flight disclosure with no partial⇒full equivalence claimed. I accept the pre-flight record as proof the environment was real.

## Check 7 — the ARC-B leg

- Closed lane untouched: `git log -- dev/agent-workflow/evidence/u7-tbash-l4-20261027/` last commit `ce4ca22b4 2026-10-28T13:56:28+00:00` ("cap and bind the ARC-B seam…") — **predates** the lane's first boot (17:15Z); HEAD = master tip with porcelain 0, so the closed lane's committed bytes **are** master's (byte-identical). The packet wrote nothing there.
- New seam used: driver `run-c2.mjs` read from the CLOSED lane read-only, invoked with `--evidence …/u7-g4r3-20261028/arc-b --budget-ledger …/arc-b/boot-budget.jsonl --budget 1 --allow-reused-dir`; writes only into its own dir. The reuse-flag deviation is disclosed in the README (dir contained only the lane's own pre-declared 0-byte ledger, 0 declared boots; attempt-1 without the flag refused at config time — verbatim F3 error — consuming **zero** boots, ledger 0 lines).
- Boot evidence is a real boot, no dry-run artefact cited: `c2-verdicts-boot1-u7tb-c2-mvshku2s.json` carries `bootDeclaration.teamSha=5d0c8ff58…`, `teamTreeClean=true`, teardown receipts `killedPids=[74]`, `releasedPorts=[3188,13053,3188]`, host log + mock excerpt; approval ledger 1 allow / 3 reasoned denies; `seamReAllow.ok=false` (`CONTROL_REQUEST_DECIDED`); leak-check `inCorpus:false, bytesUnchanged:true`. 6/6 PASS matches R1 item 1 (allow-once / replay refusal / other-command refusal / deny zero-effect / cleanup-leak).

**Result: satisfied.**

## Check 8 — judge immutability (laundering check)

`git diff --stat 5d0c8ff5830271b7e2ab3e7c855bb85fb2090bf3..HEAD -- packages/ tests/world-factory/ scripts/ dev/agent-workflow/evidence/u7-tbash-l4-20261027/` → **EMPTY** (zero bytes changed in any judge/assembly/suite/runner/package file after the candidate freeze). Full `git diff --stat 5d0c8ff58…..HEAD` = 78 files, **+12561 / −0**, all docs/evidence/gates (RULING-B-G4R-5/6, ledger rows, landed review reports, the lane evidence). The crash `--kill-after 6000` is a runtime argument — zero source bytes. **No leg PASSed because a judge was relaxed; no laundering finding.**

## Check 9 — receipts

PR #432 merge commit on master: `git log --oneline --grep '432' -5` → `5410faa33` "Merge pull request #432 from ArmourPiercer1/task/u7-g4r3-live-20261028"; first parent `4fd9c51ab290939362b972fd43de670300bbfdb5` (Merge PR #435). Re-runs from the worktree:

- `node scripts/eb3-run-manifest.mjs --new-since 4fd9c51ab` → `EB3-RUN-MANIFEST pass records=110 strict=9 incomplete=11 findings=0` (11 unfinalised records disclosed and graded NOT-A-RESULT). **Matches the claimed records=110 findings=0.**
- `node scripts/eb3-evidence-guard.mjs --new-since 4fd9c51ab` (evaluated at HEAD) → `pass added=60 bound=1048576 exempted=0 findings=0`. The claimed **added=56** reproduces exactly **at the #432 merge scope**: `git diff --name-status 4fd9c51ab..5410faa33 -- dev/agent-workflow/evidence/ | grep -c '^A'` = **56**; base..HEAD = 60. The +4 delta is precisely the four review reports landed after #432 by `fa265309` (R433-og, R433-closure-og, R435-og, R438-og under `dev/agent-workflow/evidence/review-routing-20261028/`), all guard-green (findings=0 at HEAD too). Claim explained and reproduced, not contradicted.
- `git diff --check 4fd9c51ab...5410faa33` → clean (**whitespace-clean** ✓).
- Size bound: `find dev/agent-workflow/evidence/u7-g4r3-20261028 -type f -size +1M` → none; guard `bound=1048576 exempted=0 findings=0`. **Nothing exceeds 1 MiB.**
- `packages/**` unchanged: covered by the empty candidate..HEAD diff on `packages/` (check 8).

Note (Finding F6): the tracked README does **not** itself quote the 110/56/whitespace values — they live in the PR #432 body (per the packet note); `setup/SETUP-NOTES.md:65` records only the setup-time `added=6`. I reproduced them independently, so this is a packet-documentation gap, not a receipt failure.

**Result: satisfied — all three receipts reproduce green at the specified base; F6 (LOW) for the untracked-quote gap.**

## Check 10 — carried-risk currency

- **R-U6P3-1** (governed-bash positive effect NOT live-proven — U6 PR3 row, latest wording): the ARC-B leg on the candidate now proves it live — `tbash:approve-spawn-once` PASS with real marker effect (pinned `ranEcho` markers), ledger consumption of the single allow, `tbash:replay-refused` (`CONTROL_REQUEST_DECIDED`), deny zero-effect, leak-check `bytesUnchanged:true`. **Row is stale — no post-lane ledger row closes it → F3.**
- **R-U6P4-1..3** (attribution producer absent / Team-lane stall / effect legs never measured positive live — U6 PR4 R2 + G4 gate rows): the Jobs record shows `u74a:attributed-server-side`, `bg-receipt-carries-host-job-id`, `list-shows-owner`, `kill-live-requested` + `kill-finished-honest`, `foreign-cross-scope-refusal`, `planted-unattributed`, `exactly-once-approvals` all PASS live on the candidate (attribution counts in record tail: attributed host lines 5, ask rows 10, kernelHits job_output 8); `notes:["lanes: asker=true leader=true"]`, honest teardown, exit 0 — no stall reproduced. **Rows stale → F3.**
- **R-G4R-1** (runner does not persist profile/source/oracle digests — R1 row, latest wording): now **partially closed by the packet** — `composedProfileDigest`+`profileArtifacts`, `worldOracleDigest`+artifact, `authority`, `sandboxPreflight` are persisted in every record; `trustedSourcesDigest` remains null-with-reason (F1). **No ledger row records even the partial closure → F3.**
- **R-G4R-2** (re-scoped to "gitignored launcher not provisioned in a fresh worktree" — B-G4R-3 row, latest wording; the old host-blame wording is superseded, not current): the packet resolves it — every record's `sandboxPreflight` shows `launcherPresent=true`, `backend=partial`, `usable=true`, pinned launcher sha, porcelain empty. **No closure row → F3.**
- **R-REM-1 / R-G3-1**: re-opened by the reconciliation row (the R1 equivalence sentence indeed did not reproduce — 34 files; consistent with the brief's instruction to distrust R1's carried statements). Closed **live** by the crash pair on the candidate: supervisor `overall: PASS` 5/5 including `other-world-unaffected`, survivor 7/7, both binding `5d0c8ff58…`; B-G4R-6's dated follow-up section records it. The PASS carries the knob caveat (F4).
- Per the brief's suspicion rule I re-derived R1's carried claims from bytes where they matter: the crash 1174 ms violation reproduces from attempt-1 record bytes (`probeRows[0].at=1793214751820` − `killAt=1793214750646` = 1174 ms); the phase-2 "passed by only 401 ms" reproduces from `u7-g4t-20261027/live/crash-reclaim-1/run-u5-crash-2026-10-28T05-53-32-928Z.json` (firstProbe 1793166976011 vs killAt 1793166976412, margin −401, overall PASS, teamSha d8f40c0d); the retry's all-true sequencing cells read directly from the retry JSON.

**Result: no row is stated untruthfully as of its own date, but six carried rows lack a post-lane closure row → documentation-currency findings (F3), not evidence defects.**

## Verdict

**投机通过（有条件通过）— G4 may move from `G4-CORE-PASS / BRIDGE-BLOCKED` to full `G4-PASS`.**

The packet's claim reproduces from committed bytes on every axis the brief tests: five live legs, each `overall: PASS` computed by an unsoftened worst-case law, all bound to the single frozen candidate `5d0c8ff5830271b7e2ab3e7c855bb85fb2090bf3` (read from each JSON's `bindings.teamSha`), host pin `639ed01539…`, porcelain-clean runtime, judge/suite/package bytes byte-identical to the candidate, receipts green at the PR #432 first-parent base, boot accounting 12/25 with every consumed boot pre-declared in its ledger and every over-budget start covered by a named ruling + independent review + disclosure. No null is described as satisfied; no leg PASSed because a judge was relaxed; no ENV_BLOCK is laundered anywhere (the native-ctl cell is a real PASS on a branded, unfakeable pre-flight). The crash-survivor closure is live (not equivalence), with the PASS-by-knob honestly disclosed and the durable fix carried.

The verdict is 投机通过 rather than clean 通过 because three MEDIUM residuals attach to the promotion itself: (a) R1 closure item 4 is only 2/3 satisfied (`trustedSourcesDigest` still null-with-reason), (b) two legs' world-oracle honestly records `complete=false` while the README omits it, and (c) the GATE-LEDGER still carries, as its latest wording, the very rows (R-U6P3-1, R-U6P4-1..3, R-G4R-1, R-G4R-2) that the G4 gate row names as "Blocks full G4" — with no dated post-lane row recording their closure by this packet. The evidence is complete; the bookkeeping must catch up **in the promotion commit itself**, otherwise the gate would move while its own ledger still says blocked.

**Conditions of promotion (all documentation/bookkeeping, no new boots, no code changes):**
1. The promotion commit must append dated GATE-LEDGER rows closing, with record citations: R-U6P3-1 (arc-b `c2-verdicts-boot1-u7tb-c2-mvshku2s.json`), R-U6P4-1..3 (jobs `u7g4r3-jobs-1.u74a-run-record.json`), R-G4R-1 partial (profile/oracle persisted in all records; `trustedSources` carried as named residual), R-G4R-2 re-scoped (resolved by #429 + per-record `sandboxPreflight`), and the crash pair as live closure of R-G3-1/R-REM-1 with the PASS-by-knob caveat.
2. The carried residuals must be filed in the effective backlog by name: R-CRASH-1 (handshake + split aliased sequencing cells), trustedSources digest exposure, oracle dynamic-import edge (`host-sandbox-assets.mjs:223`), tracked copy of the crash RCA.

If condition 1 is refused, the verdict degrades to 补充内容 (evidence complete, ledger not promotable as-is). No re-run of any leg is required.

## Findings

| # | Severity | Location | Established by | Closure condition |
| --- | --- | --- | --- | --- |
| F1 | MEDIUM | `dev/agent-workflow/evidence/u7-g4r3-20261028/{arc-a/run-record.json:bindings.trustedSourcesDigest, arc-d/run-record.json, jobs/u7g4r3-jobs-1.u74a-run-record.json, crash/run-…-A.json}` — null in every record, machine-readable reason, identical to phase-2 | python dump of all nine records; phase-2 arc-d comparison | R1 item 4 ("complete instead of null") only 2/3 met. Close by exposing a plane TrustSources digest on the runner's public World/HTTP surface and rebinding, or an explicit ruling that census inventory substitutes — then persist it |
| F2 | MEDIUM | `arc-d/run-record.json` + `jobs/u7g4r3-jobs-1.u74a-run-record.json`: `bindings.worldOracle.complete=false` (`unresolvedDynamicImports=["tests/world-factory/lib/host-sandbox-assets.mjs:223"]`; jobs also `unresolvedLiteralReads`, `literalReadsComplete=false`); README (lines 83–115) quotes only the digest | python dump; `README.md` grep | Resolve/whitelist the dynamic-import edge so the oracle covers it, and disclose the `complete=false` cell in the lane README. Mitigated now: candidate..HEAD judge diff is empty, so the uncovered edge cannot have drifted post-freeze |
| F3 | MEDIUM | `docs/plans/memo/unified-baseline-alpha5-20261025/gates/GATE-LEDGER.md` — latest wording of R-U6P3-1 (PR3 row), R-U6P4-1..3 (PR4-R2/gate rows), R-G4R-1/R-G4R-2 (R1 + reconciliation rows) still states them open; the G4 gate row still names them "Blocks full G4" | `grep -n 'R-U6P3-1\|R-U6P4-1\|R-G4R-1\|R-G4R-2' GATE-LEDGER.md` + ledger tail | Append dated closure rows in the promotion commit (see Verdict condition 1) |
| F4 | LOW | crash retry PASS-by-knob: `crash/run-…-19-27-56-518Z.json` obtained with `--kill-after 6000`; assertion `u5-parallel-supervisor.mjs:92` structurally non-deterministic (3 red cells alias one boolean) | `sed -n '85,100p' u5-parallel-supervisor.mjs`; RULING-B-G4R-6.md §residual; retry JSON sequencing cells | Land R-CRASH-1 (hold/probe handshake + split aliased cells) post-freeze; one clean re-run then retires the caveat. Disclosed, not laundered — no action needed for promotion |
| F5 | LOW | `.artifacts/findings/crash-sequencing-rca-20261028.md` untracked (tracked-copy PR pending); the ruling text (`RULING-B-G4R-6.md`) stands on its own — I reproduced both timing claims from record bytes | `head -40` of the RCA; python on attempt-1 + phase-2 records | Land the tracked copy (packet cites an out-of-tree path) |
| F6 | LOW | `README.md` does not quote the PR #432 receipt values (records=110 / added=56 / whitespace-clean); they live only in the PR body; `setup/SETUP-NOTES.md:65` records setup-time `added=6` only | grep of the evidence dir; my independent re-runs (110 ✓, 56 at merge scope ✓, diff --check clean ✓) | Restate the final receipts in the tracked README |

No CRITICAL, no HIGH: no null-as-satisfied, no unaccounted boot, no judge relaxation, no ENV_BLOCK laundering, no candidate mixing.

## Commands and results (decisive lines only)

- `git rev-parse HEAD` → `7a789a91de13ba2f05317de68c84828bf7ec900d`; `git status --porcelain` → 0 lines.
- python dump of `bindings.*` over all nine run records → all `teamSha=5d0c8ff58…`, `hostSha=639ed01539…`; case verdicts per leg (10/10, 12/12, 12/12, 6/6, 5/5+7/7); `overall` worst-case matches bytes; pre-flight populated everywhere.
- `git show -s --format='%H %cI %s' 5d0c8ff58…` → `2026-10-28T15:29:29+00:00 docs(evidence): G4-R phase 3 candidate freeze (pre-boot)`; `git show 5d0c8ff58…:dev/agent-workflow/evidence/u7-g4r3-20261028/CANDIDATE.md` → present; candidate ledger stubs committed empty.
- `grep -n 'VERDICT_SEVERITY\|overallVerdict\|exitCodeFor' tests/world-factory/lib/run-record.mjs` → PASS 0 / SKIP 1 / REFUSED 2 / ENV_BLOCK 3; worst-case; `exitCodeFor` 0 only all-PASS.
- `grep -n -A6 'isSandboxPreflightRecord' tests/world-factory/lib/host-sandbox-assets.mjs` → WeakSet-brand + shape; JSON-forged records cannot qualify.
- ledger `cat` + line counts → 2/1/1/1/2/2 (+3 phase-2) = 12; timestamps precede spawns.
- `git log -- dev/agent-workflow/evidence/u7-tbash-l4-20261027/` → last touch `ce4ca22b4 2026-10-28T13:56:28Z` (closed lane untouched).
- `git diff --stat 5d0c8ff58…..HEAD -- packages/ tests/world-factory/ scripts/ <closed lane>` → **empty**; full range 78 files +12561/−0 (docs/evidence only).
- `git log --oneline --grep '432' -5` → merge `5410faa33`, first parent `4fd9c51ab`.
- `node scripts/eb3-run-manifest.mjs --new-since 4fd9c51ab` → `pass records=110 strict=9 incomplete=11 findings=0`.
- `node scripts/eb3-evidence-guard.mjs --new-since 4fd9c51ab` → `pass added=60 bound=1048576 exempted=0 findings=0` (at HEAD); at merge scope `git diff --name-status … | grep -c '^A'` = **56**.
- `git diff --check 4fd9c51ab...5410faa33` → clean; `find … -size +1M` → none.
- crash timings: attempt-1 `probeRows[0].at − killAt = 1174 ms`; phase-2 `firstProbe − killAt = −401 ms`; retry sequencing cells all true — read from the JSONs.
- `head -40 .artifacts/findings/crash-sequencing-rca-20261028.md` → read-only RCA, mechanism matches ruling + record bytes.

## Residual risk

1. **trustedSources binding stays null** (F1): the candidate's admission-source binding rests on the authority stamp + census inventory, not a plane TrustSources digest; a future plane that changes admission sources would not be caught by this binding cell. Carried residual, disclosed.
2. **ARC-D/Jobs oracle coverage gap** (F2): one unresolved dynamic-import edge (`host-sandbox-assets.mjs:223`) is outside the oracle's vouched closure. Today covered by the empty candidate..HEAD judge diff; if any post-promotion commit touches that file, these two legs' immutability argument must be re-derived.
3. **Crash sequencing remains flaky** (F4): the crash row's PASS is empirical (6 s knob vs observed ~2.7 s), not structural; until R-CRASH-1 lands, a slower machine can still produce a false red on the same edge.
4. **Native confinement is partial, not full** (standing disclosure): all native legs ran under partial Landlock (older ABI); no partial⇒full equivalence is claimed, and full enforcement remains unproven on this host.
5. **Ledger currency** (F3): until the promotion commit appends the closure rows, the ledger's latest wording and the gate state disagree — the promotion must not be recorded anywhere else first.
