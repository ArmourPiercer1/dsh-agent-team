# PR #444 Cross-Family Review — R444-B (v4pro)

**Reviewer:** R444-B, independent cross-family reviewer (model family matches the implementer's;
fresh session, no shared context — every conclusion below is re-derived from bytes, not inherited).

**Verdict: 通过 (PASS)** — no blocking or severity findings. Two advisory observations below.

---

## 0. Scope & adversarial method

I reviewed the RUN_PROVEN / CASE_PROVEN change on branch `task/u7r1-acceptance-levels-20261029`
(HEAD `c129d50b1`), diff vs `origin/master` (`880de10ca`). Diff touches exactly 3 files:
`scripts/eb3-tool-acceptance.mjs` (+122), `scripts/eb3-tool-acceptance.test.mjs` (+128, new),
`dev/agent-workflow/ledgers/u7-tool-acceptance.json` (+66). `loadRecord` (finalisation/schema/tracked
gate) is byte-identical to master — only the PROVEN post-case-check branch grew.

Mutations were constructed in a scratch in-memory harness importing `checkToolAcceptance`
(host-free, synthetic ledgers/records). The worktree ledger was never edited. Temp worktree
`.worktrees/rr-444b` was created, symlinked to `node_modules`, and removed at the end.

---

## 1. Mutation matrix results (re-derived, in-memory)

| # | Mutation | Expected | Observed |
|---|---|---|---|
| (a) | PROVEN, overall=FAIL + case PASS (RUN default) | ACCEPT_PROVEN_NOT_PASS_OVERALL | ✅ exact |
| (b) | overall missing / unfinalised, case PASS | ACCEPT_PROVEN_UNBACKED | ✅ exact |
| (c) | overall=PASS, bindings.hostSha='' , no --candidate-sha | ACCEPT_PROVEN_NO_HOST_PROVENANCE | ✅ exact |
| (d) | overall=PASS, teamSha=old, --candidate-sha SET | ACCEPT_PROVEN_CANDIDATE_MISMATCH | ✅ exact |
| (e) | proof:'CASE' on L4-positive | ACCEPT_CASE_PROVEN_ON_L4 | ✅ exact |
| (f1) | CASE L2 empty caseIndependence | ACCEPT_CASE_PROVEN_UNDISCLOSED | ✅ exact |
| (f2) | CASE L2 wrong runOverall verbatim (FAIL vs REFUSED) | ACCEPT_CASE_PROVEN_UNDISCLOSED | ✅ exact |
| (f3) | CASE L2 failedScope=[] | ACCEPT_CASE_PROVEN_UNDISCLOSED | ✅ exact |
| (g) | CASE citing a record whose overall **IS 'PASS'** | passes (see §2) | ✅ no finding (advisory gap) |
| (h) | CASE on L3, cited case verdict=FAIL | ACCEPT_PROVEN_UNBACKED | ✅ exact |
| (i1) | proof='CASEE' (unknown) | ACCEPT_SCHEMA (no default-open) | ✅ exact |
| (i2) | proof='RUN' (explicit valid) | green | ✅ no finding |
| (i3/i4) | proof=123 / proof='' | ACCEPT_SCHEMA | ✅ exact |
| (j) | proof='case' (lowercase) | ACCEPT_SCHEMA (case-sensitive) | ✅ exact |
| X1 | bindings.provider.kind='mock-deepseek' (sanctioned live C2) | NOT mock/offline | ✅ no finding |
| X2 | bootStarted=false | ACCEPT_PROVEN_MOCK_OR_OFFLINE | ✅ exact |
| X3 | failedScope=['nonexistent-failure'] (non-empty, fabricated) | passes (see §2) | ✅ no finding (advisory gap) |

Every enforcement axis fails loudly and specifically. No default-open: unknown/non-string/empty
`proof` values all route to `ACCEPT_SCHEMA`; only literal `'CASE'`/`'RUN'`/absent are valid.

---

## 2. Findings (advisory only)

**A1 (advisory) — CASE_PROVEN does not reject a record whose `overall === 'PASS'` (mutation g).**
A level `{proof:'CASE', runOverall:'PASS', failedScope:[...], caseIndependence:...}` citing a
record that *could* claim the stronger RUN_PROVEN passes with **zero** findings — the judge says
nothing. `proof:'CASE'`'s stated contract is "may cite a **non-PASS** / old-binding / mock record",
but the branch never asserts `rec.overall !== 'PASS'`. Consequence: a PASS-capable run can be
silently down-graded to CASE, and its `failedScope` disclosure then misstates that something failed
when nothing did. This under-reports strength (opposite of over-claiming), so it is **not** an
honesty/merge-blocker — but the judge should emit a *non-failing* advisory when `proof:'CASE'`
cites `overall==='PASS'` (or the doc should state that CASE is permitted there).

**A2 (advisory) — `failedScope` / `caseIndependence` are shape-checked, not cross-checked (mutation X3).**
`runOverall` is correctly verified verbatim against `rec.overall`; but `failedScope` is only enforced
as "non-empty list of non-empty strings" and `caseIndependence` as "non-empty string". Their *content*
is never matched against the record's actual non-PASS cases / stale binding, so a fabricated
`failedScope:['nonexistent-failure']` passes. The judge's own comment claims it enforces "naming what
failed / the stale binding" — the code enforces non-emptiness only. Recommend either (i) cross-check
that `failedScope` overlaps the record's real failures ∪ the stale `teamSha`, or (ii) soften the
comment to "non-empty list". Low risk (the cited *case* verdict is still independently PASS-checked),
hence advisory.

No regression vs master found: master accepted PROVEN on any record whose cited *case* was PASS
(no `overall`, `hostSha`, `mock`, or `candidate` checks). The new judge preserves every master
rejection (case-verdict, finalisation, schema, tracked, DISCLOSED, row/claim integrity) and only
*adds* strictness — `loadRecord` is unchanged. The 8 relabeled rows are the only ones that master
would also have accepted; the new judge correctly forces them into CASE with disclosure.

---

## 3. Independent ledger recount (origin/master vs branch)

Exactly **8 changed rows**, all `PROVEN` relabels citing `dev/agent-workflow/evidence/u7-f-agentA-20261026/c2/run-u7fa5.json`:

- **7 × L2-mounted `ac:mounted`**: subagent, subagent_fork, send_message, interrupt_agent, list_agents, list_subagent_models, workflow
- **1 × L3-refusal `ac:interrupt-foreign-zero`**: interrupt_agent

Disclosure content vs the actual record — all verified verbatim:
- record `overall = "REFUSED"`; ledger `runOverall = "REFUSED"` (matches) ✅
- failed cases `ac:enumerate-governed = REFUSED`, `ac:spawn-failclosed = REFUSED`; ledger `failedScope` names both + `"old teamSha 0ea0848acd"` ✅
- record `bindings.teamSha = "0ea0848acd22b5c2a78f1219781c844b89164531"` (prefix `0ea0848acd`) ✅
- cited case verdicts `ac:mounted=PASS`, `ac:interrupt-foreign-zero=PASS` (required) ✅
- record is NOT mock/offline-marked (no `mode`/`bootStarted=false`/`offlineJudge`/`mock`/`offline`); `bindings.provider.kind='mock-deepseek'` correctly not flagged ✅

## 4. Run-record churn

`git diff --stat origin/master...task/u7r1-acceptance-levels-20261029 -- dev/agent-workflow/evidence/`
→ **empty** (zero evidence/run-record churn). ✅

## 5. Gate & census

- `node dev/engineering/tool-obligations/build-expected-tool-obligations.mjs --check` → `CHECK OK` ✅
- `node scripts/eb3-tool-acceptance.mjs` → **0 findings**; `CASE-proof levels: 8`; tools=31, L4-proven=19/31 ✅
- `node scripts/eb3-tool-acceptance.mjs --candidate-sha 5d0c8ff5830271b7e2ab3e7c855bb85fb2090bf3` → **56 findings, all `ACCEPT_PROVEN_CANDIDATE_MISMATCH`; `caseProofs=8`** (8 CASE exempt) ✅
- `node --test scripts/eb3-tool-acceptance.test.mjs` → **9/9 pass** ✅
- `node scripts/eb3-ci-negative-controls.mjs` → **24/24** ✅

---

## 6. Exact commands run

```text
git worktree add -f .worktrees/rr-444b task/u7r1-acceptance-levels-20261029
ln -sfn <repo>/node_modules .worktrees/rr-444b/node_modules
git diff --stat origin/master...task/u7r1-acceptance-levels-20261029
git diff origin/master...task/u7r1-acceptance-levels-20261029 -- scripts/eb3-tool-acceptance.mjs
git diff origin/master...task/u7r1-acceptance-levels-20261029 -- dev/agent-workflow/ledgers/u7-tool-acceptance.json
node --test scripts/eb3-tool-acceptance.test.mjs                                  # 9/9
node scripts/eb3-ci-negative-controls.mjs                                         # 24/24
git diff --stat origin/master...task/u7r1-acceptance-levels-20261029 -- dev/agent-workflow/evidence/   # empty
node dev/engineering/tool-obligations/build-expected-tool-obligations.mjs --check # CHECK OK
node scripts/eb3-tool-acceptance.mjs                                              # 0 findings, 8 CASE
node scripts/eb3-tool-acceptance.mjs --json --candidate-sha 5d0c8ff5830271b7e2ab3e7c855bb85fb2090bf3  # 56 mismatch, 8 exempt
# mutation matrix: in-memory harness importing checkToolAcceptance (host-free), 16 probes (§1)
git worktree remove --force .worktrees/rr-444b
```

**Bottom line:** honest, strictly-tightening change; both advisory gaps are documentation/strength
niceties, not merge-blockers. Recommend merging with the two advisories optionally recorded.
