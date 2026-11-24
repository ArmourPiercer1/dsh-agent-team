# Round 100 — the D4 RUN-record P0 (review 20261124-1341) is closed at the emitter

**Dated**: 2026-11-24 (real UTC), branch `vnext/a1-cut`, PR #822 (DRAFT, unmerged).

## 1. What was wrong

Hosted `ci-integration` failed the `EB3-D: RUN Manifest` step with 22 `RUN_SCHEMA` findings
(18 of them in auto-archived copies). Every finding came from the D4 probe's RECORD EMITTER, not
from a measurement:

| finding | records |
| --- | --- |
| `cases[4].id is not a non-empty string` | `d4/runs/boot0{1,2}/run-record.json` + archived copies |
| `subset=true but arms is not a non-empty array` | the same records |

Root cause (`probe-d4-routed-wake.mjs`): `CASE_ID` omitted eight judges — the seven round-97
routed-wake propositions (`caseCreated`, `routerOfficer`, `wakeDelivered`, `officerDecides`,
`askExecutesAfterReview`, `duplicateRoute`, `stickyStop`) and `askExecuteProcess`. `addCase()`
was called with `CASE_ID[id] === undefined`, so run-record's `Map` collapsed all eight into ONE
row whose `id` was `undefined`, and the extra rows pushed `totalCases` past `selected`; `finalize()`
therefore wrote `subset: true` with no `arms`. The record's `selectedCases` was also narrower than
the judge set the probe actually runs.

## 2. The contract that had to be satisfied (`scripts/eb3-run-manifest.mjs`)

* `schema === 'u5-run-record/1'`, non-empty `runId`, `finishedAt` + `overall` present;
* every `cases[i].id` a non-empty string; every verdict in the shared `VERDICTS` set;
* `selectedCases` ⊆ produced verdicts, and no selected case filed `NOT_SELECTED`;
* `subset === true` ⇒ non-empty `arms`, `selectedCases` array, `selected === selectedCases.length`,
  `totalCases > selected`; `subset === false` ⇒ `selected === selectedCases.length` and
  `totalCases === selected`;
* `overall` = the worst-of rule over the cases (NOT_SELECTED excluded);
* bindings: `teamSha` a commit in this repo, `hostSha` one of the `tests/paths.mjs` pins, authority
  pointer/snapshot consistent when declared; named evidence must exist with matching digests.

## 3. The fix (commit `931711c98`, re-measured by `1ecb7ec3d`)

1. **Total id map**: `D4_JUDGES` is the declared set and `CASE_ID` maps every one of the 17 judges
   to a stable id; the emitter THROWS on an unmapped judge instead of writing an anonymous case.
2. **Truthful set metadata**: `selectedCases === allCases === D4_CASE_IDS` (17 judges), so the
   record is a FULL run — `subset=false`, `selected=totalCases=17`, no `arms`.
3. **Producer-side self-check**: after writing a record the probe runs the SAME
   `validateRunRecord()` the hosted step runs, writes `run-record-check.json` per boot and
   `run-record-self-check.json` per run, and exits `1` (not `0`/`3`) when the contract refuses it.
4. **Historical residue, not rewritten**: pre-fix records in `d4/archive/` are renamed to
   `run-record.json.superseded` with their bytes UNCHANGED and listed in
   `d4/archive/P0-SUPERSEDED-RUN-RECORDS.json`. `EB3-RUN-MANIFEST` itself is untouched.

## 4. Re-run: `node tests/world-factory/drivers/d-boot-feasibility/probe-d4-routed-wake.mjs --boots 2`

Host pin rc.2 `639ed015397290b3745d163aafe02ffee4aa3f84`. Exit `3` = BLOCKED (the refuted process
arm), which is the honest outcome. `allBooted=true evidence-complete=true runRecordsValid=true`,
two-run agreement `agreeing=true differing=[]`.

| judge | boot01 | boot02 | vs the superseded run |
| --- | --- | --- | --- |
| `d4:enablement` | PASS (PROVEN) | PASS (PROVEN) | unchanged |
| `d4:officer-up` | PASS (PROVEN) | PASS (PROVEN) | unchanged |
| `d4:officer-binding` | PASS (PROVEN) | PASS (PROVEN) | unchanged |
| `d4:routed-wake` | PASS (PROVEN) | PASS (PROVEN) | unchanged |
| `d4:case-created` | PASS (PROVEN) | PASS (PROVEN) | unchanged |
| `d4:router-officer` | PASS (PROVEN) | PASS (PROVEN) | unchanged |
| `d4:wake-delivered` | PASS (PROVEN) | PASS (PROVEN) | unchanged |
| `d4:officer-decides` | PASS (PROVEN) | PASS (PROVEN) | unchanged |
| `d4:ask-executes-after-review` | PASS (PROVEN) | PASS (PROVEN) | unchanged |
| `d4:duplicate-route` | PASS (PROVEN) | PASS (PROVEN) | unchanged |
| `d4:sticky-stop` | PASS (PROVEN) | PASS (PROVEN) | unchanged |
| `d4:refusal` | PASS (PROVEN) | PASS (PROVEN) | unchanged |
| `d4:ask-execute` | PASS (PROVEN) | PASS (PROVEN) | unchanged |
| `d4:ask-execute-2` | PASS (PROVEN) | PASS (PROVEN) | unchanged |
| `d4:ask-execute-process` | FAIL (REFUTED) | FAIL (REFUTED) | unchanged — known backend gap |
| `d4:ask-denied` | PASS (PROVEN) | PASS (PROVEN) | unchanged |
| `d4:ask-stopped` | PASS (PROVEN) | PASS (PROVEN) | unchanged |

The refuted clause set is the same three fail-closed facts as round 99:
`bash-tool-result-not-an-error` (`no PTY backend registered for "a5sf-governed-shell"`),
`in-lane-write-lands` (zero bytes), `settlement-completed` (`state=FAILED`).

## 5. Gates at `1ecb7ec3d` (this directory's `.log` files)

| gate | result |
| --- | --- |
| `dispatch-tests --run --leg ute-vnext-a1` | 248 tests / 245 pass / 0 fail / 3 skipped |
| `test-catalog --max-uncollected 41 --max-excluded 7` | tests=785 refused=0 uncollected=38 excluded=14 |
| `ute-cut-closure --check` | pass, `cut(0/148)` |
| `ute-p0-assets --check` | pass, 37 modules / 180 files / 69512 lines, `cut(148/148)` |
| `docs-sync --check` | pass, findings=0 blocking=0 |
| `place-dist-glue` | done, 35 placements, byte-identical |
| `eb3-ci-required` | pass workflows=10 findings=0 |
| `eb3-security-run --layer ci-security` | PASS 222 / 0 |
| `eb3-security-run --layer ci-integration --list-file tests/checks/eb3-ute-migrated-suites.txt` | PASS 238 / 0 |
| UTE G1 argv (`node --test` 9 files) | 89 / 89 pass |
| `ci-pr-gate --full --census-captures 2` | pass=10 fail=0 (census identity set identical, 599f/7422l) |
| `eb3-run-manifest` (and `--new-since a19d1df01`, the CI base) | pass records=516 strict=144 incomplete=11 findings=0 |
| `eb3-ci-negative-controls` | 35/35 controls behaved as required |
| `ute-a1-window --check` | pass red=0/0 cut=(148/52) |

`git diff 1ecb7ec3d <final head> -- . ':!dev/agent-workflow/evidence'` is EMPTY: the final commit
adds only this directory's logs and the settlement comment, so every number above is that tree.

## 6. Still open

* `ci-required` is RED on a DRAFT PR because `ci-census` is `skipped` — the documented draft tier,
  not a product red. The PR stays DRAFT and unmerged.
* `d4:ask-execute-process` remains REFUTED by the named assembly gap (the `bash` face has no
  governed PTY backend in this host): owner decision, unchanged by this round.
* The superseded archive records are auditable but are no longer RUN records of this contract;
  they live in git history at `5f1d2d9de` too.
