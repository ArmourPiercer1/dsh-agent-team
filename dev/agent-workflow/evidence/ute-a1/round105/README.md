# Round 105 — the candidate acceptance gate (review `20261124-1341` §4.4)

**Dated**: 2026-11-24 (real UTC) · branch `vnext/a1-cut` · PR #822 (DRAFT, unmerged) · measured at
`65481f2f6eb0bd684e83cfa1e43e3c5268eb9de9`. Worktree `.worktrees/vnext-a1-cut` only; `:3080` and its
DSH_HOME untouched.

## What this round is

The review's fourth threshold: "put the key DEV-LIVE scenarios into an executable, reviewable
candidate gate". This round adds ONE runner, ONE non-required workflow, and the documentation that
says exactly what those do and do not change. It adds **no product behaviour, no test assertion, no
upstream patch**, and it does **not** touch Required CI's layer set.

## The interface

```
node scripts/candidate-acceptance-gate.mjs [--hosts legacy|next|both] [--out <dir>]
```

* drivers, each with `--boots 2`, run **sequentially**: `run-boot.mjs`, `run-boot-d2.mjs`,
  `run-boot-d3.mjs`, `probe-d4-routed-wake.mjs`;
* host selection goes through the existing `TEAM_TEST_HOST` machinery
  (`tests/next-host/host-select.mjs`): `legacy` = 0.2.0-rc.2, `next` = 0.2.2-rc.5. `--hosts both`
  runs both generations; the default is whatever the selector resolves;
* it parses the drivers' OWN artifacts — `run-record.json`, `agreement.json`, `results.json`,
  `routed-judges.json` — and never re-implements a judge;
* it validates every RUN record with `scripts/eb3-run-manifest.mjs`'s own `validateRunRecord`
  (the same validator the hosted `EB3-RUN-MANIFEST` leg runs), requires `agreement=true` and
  explicitly refuses a stale artifact (`mtime` must be from this run);
* output: one machine-readable `verdict.json`, one `summary.txt`, and per-host driver snapshots under
  `dev/agent-workflow/evidence/candidate-acceptance-gate/<stamp>/<host>/<driver>/`;
* the verdict lines name the level explicitly:
  `CANDIDATE-GATE pass host=… proven=… known-refuted=… env-limited=…`;
* **no retries, no timeout widening**: the single timeout is `DRIVER_TIMEOUT_MS` = 2,700,000 ms
  (45 min); a hung driver is killed and is a FAIL naming that value.

## The known-refuted enumeration

The gate accepts exactly one non-PROVEN judge, by **literal id** (never a pattern):

```js
const KNOWN_REFUTED = Object.freeze({
  'd4:ask-execute-process': Object.freeze({
    citation: 'dev/agent-workflow/evidence/ute-a1/SCOPE-subprocess-ask.md §2 (what is explicitly NOT promised) and §4 (the exact current refusal evidence, both hosts)',
    review: 'docs/reviews/20261124-1341.txt §3.1 (the declared-scope ask) and §4.3 (product-scope close-out)',
    reason: 'This generation promises `allow`/`deny` for Subprocess/PTY; per-call `ask` for process execution is NOT supported and remains fail-closed. …',
  }),
})
```

The rc.5 `d2:remote-delivery` refutation below is **not** in that map, so it is an unexpected
verdict and the gate FAILS. That is the point of the enumeration: a new red cannot inherit an
exemption.

## Round-105 verdicts (the first time the whole set is one gate)

```
CANDIDATE-GATE pass host=legacy judges=31 proven=30 known-refuted=1 env-limited=0 drivers=4 records=8 agreement=true
CANDIDATE-GATE fail host=next  judges=31 proven=29 known-refuted=1 env-limited=0 drivers=4 records=8 agreement=true
  d2: d2:remote-delivery REFUTED — archived-member-refused-typed: lifecycle=SETTLED code=null requestsAdded=0 (both boots)
CANDIDATE-GATE fail hosts=legacy,next judges=62 proven=59 known-refuted=2 env-limited=0
```

Per-driver rc.2: `d` 6/6, `d2` 4/4, `d3` 4/4, `d4` 16/17 (the one known refutation), all `pass`.
Per-driver rc.5: `d` 6/6, `d2` 3/4 with `d2:remote-delivery` REFUTED (exit 1), `d3` 4/4,
`d4` 16/17 (the one known refutation), so `d2` alone fails the host.

**The rc.5 red is a new measured fact.** `d2:remote-delivery` was previously **NOT RECORDED** on
rc.5. On rc.5 the archived-member send does not produce the typed refusal the judge asserts
(`archived-member-refused-typed`: `lifecycle=SETTLED code=null requestsAdded=0`), while every other
clause passes and the two boots agree. This round does **not** decide whether the product or the
clause expectation is wrong; it records the refutation and leaves it visible. No allowance was
added.

**Disclosed discarded run**: the first dual-host invocation (console in `gate-console.log`, run dir
`2026-11-24T11-26-46-029Z`) completed, but its grader short-circuited a non-PASS driver before
counting its judges, so the rc.5 line under-counted (`judges=27`). That run directory was discarded;
the corrected run is `2026-11-24T12-48-43-516Z` and is the evidence quoted above. The drivers' bytes
were not re-judged — only the gate's aggregation bug was fixed — and the corrected run re-ran every
driver from scratch (no reuse of the discarded artifacts).

## Files

| file | what it is |
| --- | --- |
| `../../../../scripts/candidate-acceptance-gate.mjs` | the gate: driver orchestration, artifact parsing, record validation, ONE verdict |
| `../../../../.github/workflows/candidate-acceptance.yml` | the NON-REQUIRED workflow (manual + `candidate-acceptance` PR label); it only provisions the two pinned hosts and runs the gate |
| `../../../../dev/ci/eb3-ci-manifest.json` | one new `knownNonRequired` entry with the reason; `ci-required`'s `layers` untouched |
| `gate-console.log` | the discarded first invocation's console (see above) |
| `gate-console-final.log` | the accepted dual-host console, including all three `CANDIDATE-GATE` lines |
| `../D-ACCEPTANCE-REPORT.md` | the candidate-gate section: what the layer does/does not change, and the updated rows 5/9 |
| `../CAPABILITY-MATRIX-C.md` | the "candidate-gate coverage" note (coverage, not a level) |
| `../MIGRATED-SUITE-STATUS.md` | round-105 suite-status delta |
| `*.log` (below) | the round's required-gate outputs, pasted by the settlement comment |

## What moved, and what did not

* **Moved**: rc.5 now has a recorded `d:remote-creation` verdict (PROVEN), and `d2:remote-delivery`
  is now recorded as REFUTED (one clause). The acceptance set is one command/one verdict.
* **Did not move**: no capability level; no PRODUCT-PROVEN row; Required CI's layer list; the
  `ute-vnext-a1` dispatch leg's file set; the test catalog's file set (785, digest unchanged).
* **A row becomes gate-backed only if the gate is REQUIRED by branch protection AND green.** That
  is an owner decision. This round makes the layer executable and reviewable; it does not make it
  required, and it does not upgrade a row.

## Required-gate outputs at `e716d906b` (`*-postcommit.log`)

| gate | measured |
| --- | --- |
| `dispatch-tests --run --leg ute-vnext-a1` | **248 tests / 245 pass / 0 fail / 3 skipped**, digest `sha256:edd4f1c494a777b941baa47a286d29455f79eb71d20ae7e48cf46a5580c8a975` |
| `test-catalog --max-uncollected 41 --max-excluded 7` | tests=785, uncollected=38, excluded=14, digest `sha256:da8a452d65130a3a7f62ef90b549a5289909e689e1ff619c4b3e0c45d5f5ed32`, findings=0 |
| `ute-cut-closure --check` | **pass** deleted=148 references=3 prodRefs=0 distResiduals=0 `cut(0/148)` |
| `ute-p0-assets --check` | **pass** modules=37 files=180 lines=69512 `cut(148/148)` |
| `docs-sync --check` | docs=193 findings=0 blocking=0 (authority pointer verified) |
| `place-dist-glue` | **35 placements** byte-identical |
| `eb3-ci-required` | **pass workflows=11 findings=0** (was 10; the +1 is this workflow, registered non-required) |
| bound vitest (`ci-integration`, 15 suites) | **PASS 15 suites / 238 passed / 0 failed** — measured twice in isolation |
| UTE G1 nine-file argv | **89 tests / 89 pass / 0 fail** |
| `eb3-run-manifest` | **pass records=546** strict=0 incomplete=11 findings=0 (round 104: 520; +26 = the live modified records + the 16 committed per-host snapshots) |
| `ci-pr-gate --full --census-captures 2` | **PASS 10/10** (316.3 s), census **599f/7422l**, 2 captures identical identity sets |
| `ute-a1-window --check` | **pass** red=0/0 `cut=(148/52)` |

Two disclosures about the log set:

* The first `ci-pr-gate --full` attempt (`ci-pr-gate.log`, committed with the first commit) failed
  `lint-identities` on `scripts/candidate-acceptance-gate.mjs`: the file carried four unused
  `eslint-disable no-console` directives, and this repo's linter reports an unused directive with
  `ruleId=null`, which `lint-identities` labels `(parse-fatal)`. The directives were removed (no
  assertion or behaviour changed), `lint-identities` went green, and the post-commit full gate above
  is **10/10**. The failed log is kept rather than deleted.
* A first post-commit bound-vitest attempt failed one `a3p5-permission-splice` RESTORE assertion
  while `ci-pr-gate`'s own vitest was running **concurrently**; the same command run alone passed
  238/238, and a second isolated run passed 238/238 again. The failure is recorded here rather than
  hidden; the gate claims only the isolated runs.
