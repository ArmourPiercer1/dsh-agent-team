# R440 delta review (og) — de49f503c → origin/task/u7-g4r2-promotion-20261028

- Worktree: `.worktrees/u7-sync2` (branch `task/u7-routing-sync2` @ `9c4c97dfb`); `git fetch -q origin` → OK.
- Target head: `90cd044ca` (= `origin/task/u7-g4r2-promotion-20261028`); reviewed base: `de49f503c`.
- Mode: read-only except this report.

## Delta contents (`git log --oneline de49f503c..target`)

```
90cd044ca docs(gates): move carried-residual filing out of the hash-pinned backlog (census gate red root cause) …
45934dfb5 Merge origin/master — resolve lane-README append conflict keeping both dated addenda
a9638af04 Merge pull request #439
da6b913b6 docs(gates): R440 package-review adoption — M1 scoping, M2 wording, R440 report tracked
e7655a2a5 / eb0ab1fa5 Merge origin/master (base refresh, track-analysis branch)
fa1de82cc docs(evidence): track the crash-sequencing RCA + parallel-lanes decision (analysis/ + README addendum)
```

Files: 8 (+365/−10). Excluded-from-main-diff file `dev/agent-workflow/evidence/review-routing-20261028/R440-og.md`
is a **new 117-line review report** of the same PR at `de49f503c` (verdict 补充内容; findings M1/M2/L1, spot-check
table, citation audit). It is evidence only — not hash-pinned, not a gate doc, cites no new claims about the
post-delta head; it is the *reason* for the M1/M2 fixes that follow it. No issue with tracking it.

## Checks

| # | Check | Result | Evidence |
|---|---|---|---|
| 1 | Backlog == master bytes | **PASS** | `git diff origin/master <target> -- docs/plans/active/alpha5-tool-io-governance/ALPHA5-EFFECTIVE-BACKLOG.md` → **empty**; blob id identical on both sides: `55d548c844ae2f99d7bab51869469a2e10362c70`. The 4 BL-20..BL-23 rows are the only thing reverted (delta view: `−4` lines). |
| 2 | Generator `--check` green | **PASS** | `node dev/engineering/tool-obligations/build-expected-tool-obligations.mjs --check` → `CHECK OK — committed artifacts are the byte-exact replay of the generator` (rc=0, run in `.worktrees/u7-sync2`). Validity of running it at *this* tree: `git diff --stat HEAD <target> -- dev/engineering/tool-obligations packages/testkit dev/engineering/current-authority.json dev/engineering/authority-snapshots scripts/current-authority.mjs` → **empty**, and the backlog blob is identical, so the check is byte-equivalent to the target head. Cross-check: `sha256(backlog@target)` = `cd296c623b4d707d7d710248b833336adc42c5b0967fd9caa3de47ee7b132387` == pinned `backlog_sha256` in `dev/engineering/tool-obligations/expected-tool-obligations.v1.json:20` and `manifest.json:19`. No `packages/**` / `tests/**` / `dev/engineering/**` file appears in the delta at all. |
| 3 | Gate claim substance unchanged | **PASS with one disclosed deviation** | `GATE-LEDGER.md` line 103 (currency row) and 104 (G4-PASS row), plus `G4-PROMOTION-REVIEW-R2.md` "Post-promotion state". Unchanged verbatim: verdict `G4-PASS (投机通过, conditional)`, candidate `5d0c8ff58…`, both reviewers' verdicts + 0 CRIT/0 HIGH/3MED·3LOW and 0/0/2MED·1LOW, boot 12/25 accounting, citations (`arc-b/c2-verdicts-boot1-…json`, `jobs/u7g4r3-jobs-1.…json`, both crash records, `#429`), "release unlock queued, not assumed; G5 PRODUCT-GATE remains §4 reserved", B-G4R-5 expiry. Changed: BL-20→R-CRASH-1, BL-21→R-G4R-1a, BL-22→R-ORACLE-1, BL-23→(dropped; #439 landed), **plus** two *downward* qualifications: "digest persisted in **every** candidate record" → "the four canary-runner records; ARC-B c-suite schema emits no digest cells (R2-B MEDIUM-1, folded into R-G4R-1a)", and per-record `sandboxPreflight` → "canary-runner records; the arc-b record predates that cell, argument rests on ARC-D/Jobs + provisioning". Direction is exclusively disclaiming (no claim strengthened, nothing unlocked). **This is more than the "identifier-only rewiring" characterisation**: it is the adopted R440 M1 fix and is correct, but the delta's own wording under-describes it. |
| 4 | Every former BL-2x has a named home | **PASS** | `REVIEW-REMEDIATION-20261028.md`: `:21` R-CRASH-1 (pre-existing, untouched), `:22` R-G4R-1a (trustedSources null in 4 canary records, arc-b schema), `:23` R-ORACLE-1 (`host-sandbox-assets.mjs:223`, `complete=false`), `:24` R-BL-QUEUE (reserves the literal BL-20..BL-23 backlog rows with the exact pin-bump procedure: regenerate + manifest + `packages/testkit/test/u7-0-census-reconcile.test.ts` PINNED bump in one package commit, `--check` green + independent review, post-freeze first priority). RCA copy: PR #439 merge `a9638af04` is an ancestor of the target, and `dev/agent-workflow/evidence/u7-g4r3-20261028/analysis/crash-sequencing-rca-20261028.md` (+ `parallel-lanes-decision-20261028.md`) both PRESENT at the target head. No residual lost its name; nothing is filed only in a scratch path (except the pre-existing R-CRASH-1 "RCA" cell, now also satisfied by the tracked copy). |
| 5 | Remediation table row format | **PASS** | Header `:8` = `| ID | 严重度 | 位置 | 问题 | 来源 | 何时可做 |` (6 cols, `:9` separator). New rows `:22`,`:23`,`:24` each parse to exactly 6 fields; R-CRASH-1 `:21` likewise. Cell style consistent with neighbours (severity as 中/低 + parenthetical, repo-relative paths, `何时可做` carries the freeze/post-freeze scheduling). |
| 6 | `git diff --check` | **PASS** | `git diff --check origin/master...<target>` → no output, rc=0. |

## Findings (all LOW; none blocking)

- **L1 — README addendum missing blank line.** In `dev/agent-workflow/evidence/u7-g4r3-20261028/README.md` the new
  "Dated addendum (2026-10-28 late)" block ends `…append-only.` and the very next line is the pre-existing
  `## Dated addendum (2026-10-28, with the G4-R2 promotion review)` heading with no blank line between. Renders
  fine in most Markdown, invisible to `git diff --check`; cosmetic. Fixable in the merge-time tidy commit.
- **L2 — addendum ordering/staleness.** `G4-PROMOTION-REVIEW-R2.md` addendum 1 ("M2 … BL-23's closed-by claim
  now states the merge-order dependency") was written before addendum 2 reverted the backlog rows, so at the
  target no BL-23 row exists at all; read in order the two addenda are coherent (addendum 2 explains the
  revert), but addendum 1 alone describes a row that is no longer there. Consider a one-line pointer, or leave
  as a dated history trail (acceptable).
- **L3 — L1 from the adopted review is accepted-but-open** (mixed citation styles across historical ledger rows):
  new rows use repo-relative paths consistently, so the delta does not add new mixed style; historical rows
  untouched as stated. No action.
- **Non-finding.** The reverted-back backlog does **not** retract any gate statement (the BL rows were the *only*
  place those residuals were also filed) because the ledger rows and R2 doc now name them; gate verdict text was
  rewired in the same commit.

## Verdict (DELTA de49f503c → 90cd044ca): **通过**

All six checks pass. The census-runtime red is correctly root-caused and cured at the right layer (backlog
reverted to master bytes; residual filing moved to a tracked, non-pinned ledger; the pinned-regeneration work is
explicitly reserved as R-BL-QUEUE rather than dropped). Gate substance is intact — `G4-PASS (投机通过,
conditional)` with the same candidate, same reviewer counts, same citations, release unlock still queued — and
the only substantive wording deltas are downward disclaimers adopted from the R440 review. Findings are cosmetic
(L1/L2) and carry no gate consequence; the one thing a merge reviewer should not silently accept is the PR's own
"identifier-only rewiring" phrasing, which understates the M1 scoping change.
