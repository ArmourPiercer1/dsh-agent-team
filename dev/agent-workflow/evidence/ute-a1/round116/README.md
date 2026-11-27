# Round 116 — the newest measurements folded into one candidate truth, and the rc.5 vitest population probed

Worktree `.worktrees/vnext-a1-cut`, branch `vnext/a1-cut`, HEAD at measurement
`5cb5c606203eaf07dd78a2a5c67b442899db2377` (base `master @ a19d1df01`). PR **#822 stays DRAFT** — unmerged,
not marked ready beyond the one hosted evaluation below, no history rewrite, no merge, no non-topic push, no
upstream patch. `:3080` and its `DSH_HOME` were never touched.

## What this round is

1. **The candidate truth now carries the newest measurements** (`CANDIDATE-REPORT.md`, `D-ACCEPTANCE-REPORT.md`
   entry pointer, `PR-BODY-draft.md` + the posted PR body):
   - the **final hosted Required set at `5cb5c6062`** — run `45517751283`: every layer plus synthetic
     `ci-required` **success**, with **`ci-census` actually executed** (2 live captures, `599f` / `7424l` each,
     11/11 tasks, 0 failed → identical graded identity sets), then the PR restored to **DRAFT**
     (`isDraft=true`, `autoMergeRequest=null`). The later draft-state re-evaluation is red **only** because
     census skips on a draft; that is stated, not hidden;
   - the **fresh dual-host candidate gate at `92be91dfb`** —
     `CANDIDATE-GATE pass hosts=legacy,next judges=62 proven=60 known-refuted=2 env-limited=0` — with the
     explicit proof that `git diff --stat 92be91dfb..5cb5c6062 -- 'packages/*/src'` is **empty**, so the verdict
     is representative of this head and is **not** claimed to have run at it;
   - the **two reds found and fixed in this stretch** — the devex `maxRecords` capacity bound (600 → 900, with
     the 602-record measurement) and the dispatch-parity evidence regeneration (union 77 → 78, `problems=0`);
     neither weakened an assertion, removed a suite, or widened a timeout;
   - the **rc.5 matrix outcome** — 18/18 B-ladder arms green on both hosts; the 40 host-importing vitest suites
     still not gradable through the one selector, now measured;
   - the **security findings' dispositions** — SEC-01 fixed, SEC-02 fixed with history retained, SEC-03/SEC-04
     declared; no finding open.
2. **The 40-suite question was probed as an experiment, not assumed** (`VITEST-HOST-PROBE.md`):
   **`ENV-LIMITED`, layer = Vite.** The one selector and the Node loader are correct (plain-Node control
   resolves `0.2.2-rc.5`); Vite resolves bare `@deepseek-ai/*` before the loader, so `NODE_OPTIONS=--import`
   and `server.deps.inline` are both inert (`0.2.0-rc.2`). A Vite redirect derived from the selector's mapping
   would work (`0.2.2-rc.5`) but is a **second selection mechanism** and is refused. 5 representative suites
   (2 client + 3 runtime) were run rc.2 and rc.5-selected: both green — a **false green** on rc.2 modules, so
   **0 of 40** counted as rc.5 coverage. No fabricated coverage.

## Evidence produced this round

| artifact | content |
| --- | --- |
| `hosted-check-runs-5cb5c6062.tsv` | every hosted check run at this head, with times and conclusions |
| `hosted-ci-census-45517751283.log` | the hosted census machine lines (population, both captures, summary) |
| `census-evidence-1.json` / `-2.json` | the two hosted capture evidence files |
| `hosted-census-identity-compare.json` | per-root equality across captures + the graded-identity-set reading |
| `candidate-gate-92be91dfb-verdict.json` / `-summary.txt` | the dual-host candidate-gate verdict |
| `product-diff-92be91dfb-5cb5c6062.txt` | `git diff --stat … -- 'packages/*/src'` — **empty** |
| `VITEST-HOST-PROBE.md` | the read of the resolvers and the 5 bounded experiments |
| `probe-*.log`, `suites-*.log` | raw probe and representative-suite outputs |
| `gate-*.log` | the round-116 gate block (below) |

## Gate logs at this head

| log | result |
| --- | --- |
| `gate-dispatch-tests.log` | `ute-vnext-a1` 255 tests / 252 pass / 0 fail / 3 skipped, `exit=0`, set `sha256:edd4f1c4…` |
| `gate-devex-diag.log` | `devex-diag` 44 tests / 44 pass / 0 fail, `exit=0`, set `sha256:08ea4246…` (the round-115 bound fix re-run) |
| `gate-test-catalog.log` | `tests=786` collected `734` / excluded `14` / uncollected `38` (node=147 none=7 vitest=632), digest `sha256:8982e6e9…`, `refused=0 findings=0` |
| `gate-ute-cut-closure.log` | `UTE-CUT-CLOSURE pass deleted=148 references=3 prodRefs=0 distResiduals=0 cut=cut(0/148) dupNames=0 retiredSurfaces=12 findings=0` |
| `gate-ute-p0-assets.log` | `UTE-P0-ASSETS pass modules=37 files=180 lines=69512 delete=146 replace=2 keep=32 wave1=146 wave2=0 cut=cut(148/148) findings=0` |
| `gate-docs-sync.log` | `docs=193 notes=4 plans=152(0 declaring) findings=0 blocking=0 contracts=20 pairs compared` |
| `gate-place-dist-glue.log` | `place-dist-glue: done (35 placement(s))`, every line `(byte-identical)` |
| `gate-eb3-ci-required.log` | `EB3-CI-REQUIRED pass workflows=11 findings=0` |
| `gate-bound-vitest.log` | `EB3-LAYER layer=ci-integration verdict=PASS suites=15 files=15 describes=76 passed=238 failed=0 clock_ms=20000` |
| `gate-ute-g1-argv.log` | UTE G1 nine-file argv (the exact CI argv): 89 tests / 89 pass / 0 fail / 0 skip |
| `gate-eb3-run-manifest.log` | `EB3-RUN-MANIFEST pass records=634 strict=0 incomplete=11 findings=0` (634 = 602 at round 115 + the 32 tracked run records of the dual-host `92be91dfb` candidate-gate evidence; bound 900) |
| `gate-ci-pr-gate.log` | `DSH-CI-VERDICT pass pass=10 fail=0 skip=0 skipped=none legs=10 refused=0 refusedlegs=none seconds=286.4`; census `599f/7424l` twice, identical identity sets, identity set IDENTICAL to the published baseline |

Every log ends with its own `EXIT=0`.

## New scannable-surface delta — measured, not assumed

**Zero new test files, zero new collected tests.** `test-catalog` is unchanged at `tests=786`, collected
`734`, digest `sha256:8982e6e9…`; the round-114 `d4-evidence-consistency.test.mjs` remains the last addition.
`docs-sync` stays `docs=193` (the new evidence documents live under `dev/agent-workflow/evidence/`, which it
does not count). `ute-cut-closure` and `ute-p0-assets` are unchanged; `place-dist-glue` is still 35 placements;
`lint-identities` is unchanged (`new 0, resolved 13` vs the same baseline). The one count that moved is
`EB3-RUN-MANIFEST` **602 → 634** tracked run records, and that is the committed dual-host candidate-gate
evidence of `92be91dfb` — evidence, not a test surface; the raised `maxRecords` bound (900) accommodates it and is recorded
in §5.3a of the candidate report. `ci-pr-gate`'s `artifacts-at-head` leg reports `1950` compared files,
`drift=0`.

## What this round does NOT do

No capability level moves; no row becomes PRODUCT-PROVEN; the PR stays DRAFT; no product code changes
(`packages/*/src` untouched by this commit set); the candidate gate is not re-run beyond the recorded
`92be91dfb` verdict, whose transfer to this head rests on the empty product diff, not on a new run.

`ci-pr-gate` also reports `DSH-CI-RUN head=5cb5c6062 mode=full … workers=4`; the full gate is a **local** verdict, not Required CI, which only exists hosted.
