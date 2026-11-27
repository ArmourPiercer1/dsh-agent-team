**[dated settlement, 2026-11-24T23:39Z — round 115: ONE reviewable candidate report, and the hosted `devex-diag` red fixed with a measurement] head `71454d710539a4797585a6095e38ccdf6b1f3d99`**

Settlement for **`71454d710539a4797585a6095e38ccdf6b1f3d99`** on `vnext/a1-cut` (PR #822, **still DRAFT —
not ready, not merged, not a release**).

Chain: `974c643de` (round-114 postcommit logs) → `5f79acb73` (round 115: the candidate report + the
measured bound fix + gate logs + `docs/STATUS.md` + `graph.yaml` + the log entry) → `71454d71` (this
postcommit-logs + body-row commit). Fast-forward push `974c643de..71454d710`, no history rewrite, no
merge, no non-topic push, no upstream patch. `:3080` and its `DSH_HOME` were never touched.

**The deliverable — one document a reviewer reads first:**
[`dev/agent-workflow/evidence/ute-a1/CANDIDATE-REPORT.md`](https://github.com/ArmourPiercer1/dsh-agent-team/blob/71454d710539a4797585a6095e38ccdf6b1f3d99/dev/agent-workflow/evidence/ute-a1/CANDIDATE-REPORT.md).
Ten sections: identity (branch / `974c643de` / base `master @ a19d1df01` / PR #822 DRAFT / the A0 contract /
the one-paragraph claim); static closure (148 deleted, 12 retired surfaces, `prodRefs=0`,
`distResiduals=0`, `cut(0/148)` & `cut(148/148)`, 35 dist placements, 37/180/69,512) **and exactly what
those numbers do not prove**; the `SINGLE-AUTHORITY` audit verdict (53 surfaces, 0 findings) with its
counts and map pointers; the P1–P5 ladder with the six rungs (mechanism arm / live judge with host+boots+
verdict / OS negative control / exception) and the three declared exceptions (PTC unsupported by ruling;
per-call process ask unsupported by ruling with `d4:ask-execute-process` preserved as REFUTED; the
`ENV-LIMITED` arms); Required CI (last fully green hosted set **with census** = run `45429461306` @
`a4a00fc816`, plus the mechanism by which `ci-census` skips on a draft); the C1–C18 summary (**21 rows:
MECHANISM 7 / DEV-LIVE 8 / ENV-LIMITED 1 / UNSUPPORTED BY PRODUCT RULING 5 / NOT PROVEN 0 /
PRODUCT-PROVEN 0**) with every UNSUPPORTED and the ENV-LIMITED row named; host-modification authority
(`CORE PATCH BUDGET = 0`, both pins pristine, the two rc.5 shape differences resolved by public
capability); the candid limits list; the reviewer's exact commands with expected verdict lines; and the
boundaries in force.

`D-ACCEPTANCE-REPORT.md` keeps **every round section byte-for-byte** and gains only an entry-point header
pointing at the candidate report. The PR body points at the report and keeps the round-113 content intact
and secondary. `docs/STATUS.md` gains a dated CURRENT block scoped to the candidate branch.
`graph.yaml` gains one appended block `ute_vnext_a1_candidate_20261124`; `state_pointers` was **not**
touched (the legacy round pointer is not a phase counter).

**The standing hosted Required-CI red, named and fixed.** `ci-integration` failed at `974c643de` in one
step — `EB4-B/D/E tooling suites` → `tests/u7-3-devex/devex-integration.test.mjs` E4/E5 — with
`BOUND HIT: more than maxRecords 600 committed run records … REFUSED, no partial report is produced`
(run `45508260944`, job `138849199239`, step 19; reproduces locally, so not a runner defect). Measured
cause: **602** committed `u5-run-record/1` records exceed `scripts/integration-order.mjs`'s *capacity
budget* (a bound the script's own header says must be raised **with a measurement**, never trimmed by
deleting evidence — done twice before). `BOUNDS.maxRecords` **600 → 900**, with the measurement recorded
in the header and at the declaration: 10,440 tracked evidence `.json` (12 over the 512 KiB cap, unread),
623 mention the schema, **602 parse**; `maxCandidates` unchanged at 12,000 vs 10,440. **No assertion
weakened:** E4 still requires `--strict` to fail while any record does not bind the candidate head, E7
still builds `maxRecords + 1` fixture records and still requires BOUND HIT, E8 still requires a late
record to be graded without BOUND HIT. No committed evidence trimmed; no timeout, retry or skip widened;
no product behaviour changed.

**Gates at `5f79acb73`** (`dev/agent-workflow/evidence/ute-a1/round115/`, pre- and post-commit):
`ute-vnext-a1` leg **255 tests / 252 pass / 0 fail / 3 disclosed skips** (`sha256:edd4f1c4…` unchanged);
`devex-diag` **44/44/0** after the fix; `test-catalog` **786 tests / 734 collected / 38 uncollected / 14
excluded**, digest `sha256:8982e6e9…` unchanged, **delta 0 new scannable files**; `ute-cut-closure`
`cut(0/148)`; `ute-p0-assets` `37/180/69512` `cut(148/148)`; `docs-sync` `193 docs / 0 findings`;
`place-dist-glue` 35 placements byte-identical; `eb3-ci-required` `11/0`; bound vitest `15 suites / 76
describes / 238 passed / 0 failed` (`clock_ms=20000` unchanged); UTE G1 nine-file argv **89/89**;
`EB3-RUN-MANIFEST` `records=602 strict=0 incomplete=11 findings=0`; **`ci-pr-gate --full
--census-captures 2` PASS 10/10** (294.9 s pre-commit, **282.4 s post-commit**, census `599f/7424l`
captured twice each time with identical identity sets; `artifacts-at-head` confirms the commit carries
its own build, `compared=1950 drift=0`).

**Required CI at this head — stated honestly, not inflated.** The hosted set at `974c643de` is **red** for
two named reasons: `ci-census: skipped` because the PR is a draft (`.github/workflows/ci-required.yml:150`,
so `ci-required` cannot be green until the owner flips ready) and the `devex-diag` bound (fixed here
locally; the hosted leg can only be re-earned after this push, in the coordinator's separate run). **This
settlement claims no hosted green at this head.** The last fully green hosted set with census remains run
`45429461306` @ `a4a00fc816` (2026-11-24T15:46:52Z).

**No capability row moves.** No row becomes PRODUCT-PROVEN; every live claim remains `DEV-LIVE`; the
candidate acceptance gate remains NON-REQUIRED by owner ruling and its recorded verdict is bound to
`41d579119`, so it does not describe this head's product code. The draft stays draft.

**Owner decisions still open before any merge:** (1) live layer required or permanently non-required;
(2) the draft→ready flip (which is what unlocks census); (3) `DEEPSEEK_API_KEY` supply, or rule that
real-model evidence ships `ENV-LIMITED`; (4) accept SEC-03/SEC-04 as declared boundaries or commission the
lane work; (5) approve the measured capacity-budget raise (or rule that the devex evidence audit must not
gate Required CI).
