# R1 Verdict — provenance & product identity (int/P9-master-product-closure, merge 232316d)

Reviewer: R1 (independent read-only reviewer, provenance & product identity)
Date: 2026-09-04
Repo: `D:\AgentDev\dsh-plugins\dsh-agent-team`, worktree `.worktrees/P9-MC` (branch tip `8cf9fcb76636c81397be698d89f0463ccb0334ec`)
Scope: merge `232316db0e395fc8e616e9c67f4eaac0496f133a` = `master`(2c1c200) + `task/upstream-rc1-compat`(bd38827); int-delta commit 8cf9fcb. Strictly read-only; no tests/builds run.

## VERDICT: GO

---

## Per-check table

| # | Check | Command | Expected | Observed | Pass/Fail |
|---|-------|---------|----------|----------|-----------|
| 1a | Merge identity — parents | `git log -1 --format='%H %P %s' 232316d` | parents exactly `2c1c200…` (1st), `bd38827…` (2nd) | `232316d… 2c1c2002687eb257c70c01f82d96c51e346bbcda bd388272a5b46386a8f5315d38a2f00f575cbc4a Merge branch 'task/upstream-rc1-compat' into int/P9-master-product-closure` | PASS |
| 1b | Merge identity — base | `git merge-base 2c1c200 bd38827` | `959e36358ee7244ff8c7e1e0b8396e70dfef4562` | `959e36358ee7244ff8c7e1e0b8396e70dfef4562` | PASS |
| 1c | Merge identity — ancestry | `git merge-base --is-ancestor 959e363 2c1c200` | exit 0 | exit 0 | PASS |
| 1d | Branch tip | `git rev-parse HEAD int/P9-master-product-closure` | both `8cf9fcb…` | both `8cf9fcb76636c81397be698d89f0463ccb0334ec` | PASS |
| 2a | Product identity — surface diff | `git diff --stat bd38827 232316d -- packages scripts tests pnpm-lock.yaml package.json tsconfig.json vitest.config.ts eslint.config.mjs .github` | EMPTY output | EMPTY output | PASS |
| 2b | Product identity — all changed paths under `dev/agent-workflow/evidence/` | `git diff --name-only bd38827 232316d` | every path under `dev/agent-workflow/evidence/` | 804 paths: 790 under `dev/agent-workflow/evidence/`, **14 NOT** (AGENTS.md, README.md, docs/ROUTER_RULES.md, docs/TEST_METHODS.md, docs/STATUS.md, dev/agent-workflow/graph.yaml, dev/agent-workflow/SESSION_ROUTER_LOG.md, 7× dev/agent-workflow/briefs/*.md). Zero product-surface paths. The 14 are exactly master's post-base bookkeeping doc changes (see tree comparison below); master side won on all 804. | FAIL (literal) — non-blocking, see observations O1 |
| 3a | Conflict resolution — blob hashes (3 files, `dev/agent-workflow/evidence/P8-S/`) | `git rev-parse bd38827:<f> / 2c1c200:<f> / 232316d:<f>` | merged == 2c1c200 (master) side, all 3 | tc-s6-chain-dist.log: `8c644c0e…`(bd38827) / `4d3d951c…`(2c1c200) / `4d3d951c…`(232316d) ✓; tc-s6-chain-fresh.log: `ea4819ae…` / `43c89672…` / `43c89672…` ✓; tc-s6-live-17-scenarios.log: `02ef34ee…` / `e4d23484…` / `e4d23484…` ✓ | PASS |
| 3b | Conflict nature — add/add (no base version) | `git rev-parse 959e363:<f>` ×3 | all fail (path absent at base) | all 3 fail: "exists on disk, but not in '959e363…'" | PASS |
| 3c | Encoding spot-check — branch side | `git show bd38827:…/tc-s6-chain-dist.log` first bytes (raw via temp-file redirect) | `FF FE` (UTF-16LE BOM) | `FF FE 50 00 41 00 53 00 53 00 20 00` (= "PASS " in UTF-16LE); blob size 23176 B | PASS |
| 3d | Encoding spot-check — master side | `git show 2c1c200:…/tc-s6-chain-dist.log` first bytes | UTF-8, no BOM, plain ASCII | `50 41 53 53 20 70 61 63 6B 61 67 65` (= "PASS package", ASCII, no BOM); blob size 11407 B; first line `PASS packages\client\test\client.test.ts (3 tests)` | PASS |
| 4 | Int-branch delta | `git diff --name-status 232316d 8cf9fcb` | exactly: M .gitignore, A docs/INSTALL.md, M eslint.config.mjs, M package.json, A scripts/build-client-composition.mjs, A scripts/place-dist-glue.mjs | exactly those 6 entries, nothing else | PASS |
| 5a | Red line — references untouched by merge | `git diff --name-only 2c1c200 232316d -- references` | EMPTY | EMPTY | PASS |
| 5b | Branch side = P9 tip + rc.1 compat work | `git log --format='%H %s' 2c1c200..232316d` | P9 tip + rc.1 compat commits; no foreign work | 104 commits = 102-commit P8→T12→P9 implementation lineage (ends at P9 tip dc056d5 "P9-F2") + 2 R122 rc.1 compat commits (c6bae9c build-pin 0.1.2-rc.1, bd38827 sessions.flush seam) + the merge itself. No unexpected/foreign subjects | PASS |
| 5c | Not pushed (audit §6 cross-check) | `git for-each-ref refs/remotes` | no remote ref for the int branch | remote refs: only origin/int/P8-S-backend-closure, origin/int/P8-remote-projection, origin/int/T12-production-closure, origin/task/P9-ui-legacy-reuse | PASS |
| 6 | merge-audit.md factual claims | read + re-verification of each claim | all claims match independent observation | see claim-by-claim below | PASS with 2 non-blocking findings (F1, F2) |

### Check 6 — merge-audit.md claim-by-claim

| Audit claim | Independent verification | Result |
|---|---|---|
| §1 merge/parent/base values; parent2 = P9 tip `dc056d5` + `c6bae9c` + `bd38827` | 1a/1b/1c PASS; `git log -3 bd38827` chain = bd38827←c6bae9c←dc056d5(P9-F2)←d199d4d6(P9-F1) | TRUE |
| §2 product surface byte-identical to bd38827 | re-ran exact command, empty output (2a) | TRUE |
| §3 conflict table: 9 blob hashes, merged = master side | 3a: all 9 hashes exact match | TRUE |
| §3 "add/add, no common-ancestor version" | 3b: all 3 files absent at base | TRUE |
| §3 encoding: branch UTF-16LE BOM FF FE 23176 B; master UTF-8 no-BOM 11407 B, first line `PASS packages\client\test\client.test.ts (3 tests)`, normalized by `5c7145a` | 3c/3d: bytes, sizes, first line all match; `git log 959e363..2c1c200 -- <file>` = exactly one commit, `5c7145a` ("evidence archive (UTF-16->UTF-8)") | TRUE |
| §3 "untouched any product-surface path" | 2a/5a | TRUE |
| §4 branch side zero changes to AGENTS.md/README.md/docs/ROUTER_RULES.md/docs/TEST_METHODS.md/graph.yaml/SESSION_ROUTER_LOG.md | `git diff --name-only 959e363 bd38827 -- <those 6 paths>` = EMPTY | TRUE |
| §5 int delta = exactly 6 files | check 4 | TRUE |
| §5 `build-client-composition.mjs` verbatim from `dev/agent-workflow/evidence/P9/s8/s8-bundle.mjs` (header/usage/log-prefix changes + unused import removed; "see byte-compare.md") | `s8-bundle.mjs` does NOT exist at 8cf9fcb, at HEAD, in any ref's history (`git log --all -- <path>` empty), or on disk; `evidence/P9/s8/` absent entirely. `byte-compare.md` exists only as an untracked local file in the closure dir. Claim not verifiable from the repo (finding F1) | UNVERIFIABLE (dangling reference) |
| §6 not pushed; references/ untouched; CORE PATCH BUDGET = 0 | 5c (no remote ref), 5a (references empty), compat-side changes confined to this repo's packages/scripts/… (K non-evidence = 372 product files, all in-repo) | TRUE |

### Independent tree-level corroboration (beyond the brief)

Full `git ls-tree -r` comparison of the three trees (merged/compat/master, 3550/2755/3063 paths):

- **EVIL-merge set = 0**: every path in the merged tree is byte-identical to exactly one parent's blob; the union of parent path sets equals the merged tree (nothing added, nothing dropped by the merge itself). D1∩D2 = ∅.
- Counts reconcile exactly: master post-base C = 967 = 804 master-won (790 evidence + 14 docs) + 163 identical-both; compat post-base K = 797 = 631 compat-won (372 product + 259 evidence) + 163 identical-both + 3 master-won conflicts. D1 = 804, D2 = 631.
- The 163 identical-both paths are ALL under `dev/agent-workflow/evidence/` (P8-S archives: S5B/S6 results, S7R1-live JSON/logs, etc.) — both lineages independently archived byte-identical content; trivial merge, no loss.
- Master post-base = 51 bookkeeping commits (R50–R91, R122, R123, R124) with **zero** product-surface changes (C product = 0) — consistent with repo git discipline (implementation lives on int/compat lineage, master carries evidence/bookkeeping). The merge therefore takes the compat (rc.1-green) product tree wholesale with no product conflict.
- Merge commit message independently corroborates: "Conflict resolution: 3 evidence/P8-S logs add/add … kept master UTF-8 versions … Master-side post-base changes were docs-only; no product file touched by the merge from the master side." (count "102 P9 UI commits" exact; label loose — lineage includes P8/T12 commits too, see O4)

## Blocking findings

None.

## Non-blocking observations

- **O1 (brief wording vs. reality — check 2b literal FAIL):** `git diff --name-only bd38827 232316d` contains 14 paths outside `dev/agent-workflow/evidence/`: AGENTS.md, README.md, docs/ROUTER_RULES.md, docs/TEST_METHODS.md, docs/STATUS.md, dev/agent-workflow/graph.yaml, dev/agent-workflow/SESSION_ROUTER_LOG.md, and 7 briefs under dev/agent-workflow/briefs/. All 14 are master's own post-base bookkeeping/doc changes (verified: identical set to `git diff --name-only 959e363 2c1c200` outside evidence; tree comparison shows master side won on all 804, compat side won on zero master-changed files). None is product surface (2a is empty). The brief's parenthetical intent ("docs/evidence only, no product surface") is satisfied; the literal "under dev/agent-workflow/evidence/" expectation is not. merge-audit.md makes no false claim here (§4 actually documents the doc-face resolution). Non-blocking.
- **F1 (audit evidence gap — §5 provenance):** `merge-audit.md` §5 states `scripts/build-client-composition.mjs` was taken verbatim from `dev/agent-workflow/evidence/P9/s8/s8-bundle.mjs`. That file does not exist in any commit of any ref, nor on disk; `evidence/P9/s8/` is absent entirely (also referenced by TEST_METHODS.md R122 note as holding state.json/gentry-report.json). The byte-match provenance claim is currently unverifiable from the repository; the cited `byte-compare.md` exists only as an untracked local file. Does not affect merge identity or the verified 6-file int-delta, but the s8 evidence (or the bundle source) should be committed so the R125(1/2) provenance claim is auditable.
- **F2 (evidence not yet committed):** at 8cf9fcb the entire `dev/agent-workflow/evidence/P9-master-closure/` directory (merge-audit.md, gate-*.log ×16, gate-summary.md, byte-compare.md, reviewer-*) is untracked (`git status --porcelain`: `?? dev/agent-workflow/evidence/P9-master-closure/`). Expected while this gate review is in flight, but per ROUTER_RULES §7 / TEST_METHODS §3.5 the R125 evidence (including reviewer verdicts) must be committed with the R125 round before the branch is eligible for master.
- **O3 (five-gates claim not re-run):** the audit/merge-message claim "R122 five gates all green on this tree (typecheck 8/8, vitest 2532, build 9/9, lint 0, 3180 boot S8-READY)" and the fresh-tree re-run gate logs were NOT re-executed by R1 (read-only, no tests per constraints). They rest on the recorded evidence files, which exist locally (untracked, see F2).
- **O4 (minor wording):** merge commit message says "102 P9 UI commits" for the branch-side lineage; the 102-commit span (count exact: 104 − 2 rc.1 compat) includes P8 backend and T12 commits as well as P9. Label loose, count correct, no semantic impact.
- **O5 (no red-line concerns):** references/ frozen fork and test DSH source untouched by the merge (5a); no upstream source modifications on either side (compat work entirely in-repo, packages/runtime seam migration); no push of the int branch (5c); merge is a plain 3-way merge (not squash/rebase), matching audit §1.

## Verdict rationale

All hard gates of the review brief hold: (1) merge identity exact; (2) product surface byte-identical to the rc.1-green tree bd38827 (the binding invariant — master had zero product changes post-base, so the merge takes the compat product tree with no product conflict); (3) the 3 add/add evidence conflicts resolved to the master UTF-8 side with matching blob hashes and verified encodings; (4) int-delta exactly the 6 expected files; (5) no references/ or upstream red-line violation; (6) merge-audit.md is factually accurate on every independently verifiable claim (blob hashes, diff results, file counts), with two non-blocking evidence-hygiene findings (F1 dangling s8-bundle.mjs reference; F2 untracked R125 evidence).

**VERDICT: GO**
