# Round 115 — the single reviewable candidate report, and the one hosted red fixed

Worktree `.worktrees/vnext-a1-cut`, branch `vnext/a1-cut`, HEAD at measurement
`974c643de747d846a9ebeb2edb82677813ade467` (base `master @ a19d1df01`). PR #822 stays **DRAFT** — unmerged,
not marked ready, no history rewrite, no merge, no non-topic push, no upstream patch. `:3080` and its
`DSH_HOME` were never touched.

## What this round is

1. **`dev/agent-workflow/evidence/ute-a1/CANDIDATE-REPORT.md`** — the one document a reviewer reads first.
   It replaces the chronological record as the *current truth*; `D-ACCEPTANCE-REPORT.md` keeps its history
   verbatim and its header now points at the candidate report. The candidate report carries the identity, the
   static closure (with what the numbers do **not** prove), the single-authority verdict, the P1–P5 ladder with
   the OS negative controls and the three declared exceptions, Required CI, the C1–C18 summary, host-modification
   authority, the candid limits list, the reviewer's reproduction commands, and the boundaries in force.
2. **The one hosted Required-CI red is fixed, with a measurement.** `ci-integration`'s
   `EB4-B/D/E tooling suites` step failed on `tests/u7-3-devex/devex-integration.test.mjs` **E4/E5** with
   `BOUND HIT: more than maxRecords 600 committed run records … REFUSED, no partial report is produced`
   (run `45508260944`, job `138849199239`, step 19; the same failure reproduces locally). Cause: the branch now
   carries **602** committed `u5-run-record/1` records, so `scripts/integration-order.mjs`'s *capacity budget*
   was exceeded. `BOUNDS.maxRecords` is raised **600 → 900** with the measurement recorded in the file's own
   BOUNDS header (this is the script's declared procedure, used twice before in 2026-11-13 and 2026-11-22/24):

   | measure at `974c643de` | value |
   | --- | --- |
   | tracked `.json` under `dev/agent-workflow/evidence/**` | 10,440 (12 over the 512 KiB cap, never read) |
   | mention `u5-run-record/1` | 623 |
   | **parse as `u5-run-record/1`** | **602** |
   | `maxCandidates` (unchanged) | 12,000 vs 10,440 measured |

   **No assertion weakened:** `E4` still requires `--strict` to fail while any record does not bind the
   candidate head, `E7` still builds `BOUNDS.maxRecords + 1` fixture records and still requires `BOUND HIT`,
   `E8` still requires a late record to be graded without `BOUND HIT`. No committed evidence was deleted or
   trimmed; no timeout, retry or skip was widened.

## Gate logs at this head

| log | result |
| --- | --- |
| `gate-ute-cut-closure.log` | `UTE-CUT-CLOSURE pass deleted=148 references=3 prodRefs=0 distResiduals=0 cut=cut(0/148) dupNames=0 retiredSurfaces=12 findings=0` |
| `gate-ute-p0-assets.log` | `UTE-P0-ASSETS pass modules=37 files=180 lines=69512 delete=146 replace=2 keep=32 wave1=146 wave2=0 cut=cut(148/148) findings=0` |
| `gate-place-dist-glue.log` | `place-dist-glue: done (35 placement(s))`, every line `(byte-identical)` |
| `gate-docs-sync.log` | `docs=193 notes=4 plans=152(0 declaring) findings=0 blocking=0 contracts=20 pairs compared` |
| `gate-eb3-ci-required.log` | `EB3-CI-REQUIRED pass workflows=11 findings=0` |
| `gate-test-catalog.log` | `tests=786 … collected 734 / excluded 14 / uncollected 38` (node=147 none=7 vitest=632), `refused=0 findings=0` |
| `gate-dispatch-tests.log` | `ute-vnext-a1` 255 tests / 252 pass / 0 fail / 3 skipped, `exit=0`, set `sha256:edd4f1c4…` |
| `gate-devex-diag.log` | `devex-diag` 44 tests / 44 pass / 0 fail, `exit=0` (the round-115 fix) |
| `gate-bound-vitest.log` | `EB3-LAYER layer=ci-integration verdict=PASS suites=15 files=15 describes=76 passed=238 failed=0 clock_ms=20000` |
| `gate-eb3-run-manifest.log` | `EB3-RUN-MANIFEST pass records=602 strict=0 incomplete=11 findings=0` |
| `gate-ute-g1-argv.log` | UTE G1 nine-file argv (exact CI argv): 89 tests / 89 pass / 0 fail / 0 skip |
| `gate-ci-pr-gate.log` | see the verdict line in the file (full gate, 2 census captures) |

## New scannable-surface delta — measured, not assumed

**Zero new test files, zero new collected tests.** `test-catalog` is unchanged at `tests=786`,
`collected=734`, digest `sha256:8982e6e9…`; the round-114 `d4-evidence-consistency.test.mjs` is still the last
addition. `docs-sync` stays `docs=193` (the new evidence documents live under `dev/agent-workflow/evidence/`,
which it does not count). `ute-p0-assets` and `ute-cut-closure` are unchanged. `place-dist-glue` is still 35
placements (`scripts/` is not dist-glued, so the round-115 edit creates no placement).

## What this round does NOT do

No capability level moves; no row becomes PRODUCT-PROVEN; the draft stays draft; the candidate gate is not run
(its recorded verdict is bound to `41d579119`, and only the coordinator's hosted run can re-earn the set).
