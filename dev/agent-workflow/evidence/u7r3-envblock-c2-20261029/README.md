# u7r3-envblock-c2-20261029 — live-Host C2 for the R-ENVBLOCK-1/2 three-way arm law (PR #446 obligation R446-27b)

Obligation (PR #446 body + review): run `070-u7-f-web` (three-way NOT_REACHED /
ENV_BLOCK / FAIL law + branded envSignal machinery) against the REAL pinned Host
on head `baa26f567`, and record whether (a) PASS arms still PASS live, (b) a
genuine NOT_REACHED arm grades NOT_REACHED on the real chain, (c) ENV_BLOCK only
appears via branded+re-derived signals (absence recorded if no honest condition
occurs — forging = verdict falsification), (d) no product refusal is laundered.

Budget: **USER-RULING-20261029B — max 4 Host starts for this package, zero
spent at lane start.** All 4 consumed, each pre-registered in
[`host-starts.jsonl`](host-starts.jsonl) (seq/purpose/branch/headSha/world/ts)
before its start; the runner's own fail-closed count is
[`budget.jsonl`](budget.jsonl) (`--max-host-starts 4`, would REFUSED any 5th).
Branch `task/u7r2-envblock-time-20261029` @ `baa26f567582ba10cc1c79dbf5cd04be3732a09e`;
Host = pristine 0.2.0-rc.2 @ `639ed01539`; every RUN record binds
`teamTreeClean=true`. Ports: test bands only (host 3188 leased, stub 3491);
`:3080` never operated on (401 pre == 401 post, see port probes).
DSH_HOME = `tests/homes/u5u7r3eb-*` (in-workspace, all removed at teardown).
Runner (each boot):
`node tests/world-factory/u5-canary-runner.mjs --suite u7-f-web --line u7r3eb --evidence dev/agent-workflow/evidence/u7r3-envblock-c2-20261029 --run-record …/run-record-run<N>.json --budget-ledger …/budget.jsonl --max-host-starts 4`

## Starts consumed (4/4)

| # | pre-reg | what happened | host starts | record |
|---|---------|---------------|-------------|--------|
| 1 | seq 1 | full suite, untouched | 1 | **overall=PASS 7/7** (`run-record-run1.json`) |
| 2 | seq 2 | harness-abort control v1 (kill after `__u7fweb/controls` answered `ok:true requests:[]`) — **miss**: that face answers ok:true even pre-create; kill truncated the in-flight `team.create` | 1 | induced-harness FAIL x6 + stable PASS (`run-record-run2.json`) |
| 3 | seq 3 | harness-abort control v2 (kill after placement-feed #2 + 1.5 s, guard = zero ask rows) — guard CORRECTLY abstained (2 asks already recorded); run completed untouched | 1 | **overall=PASS 7/7 again** (`run-record-run3.json`) |
| 4 | seq 4 | harness-abort control v3 (authenticated `team.getLedgerPage` poll; kill on first page with create row and zero ask rows) — kill landed while `team.create` was STILL in flight (see structural finding) | 1 | induced-harness FAIL x6 + stable PASS (`run-record-run4.json`) |

Controls were **harness-side only**: suite, product and law files byte-identical
at `baa26f567` across all four runs; the perturbation was an external SIGKILL of
the single lane-owned Host pid (port-owner + `/proc/<pid>/environ
DSH_HOME=` verified; kill-once, guard-first; watchers and their decision logs
committed: `harness-abort-watch*.py`, `harness-abort-control-run*.log`). This
mirrors the repo's classification-control precedent (u5 negatives
`interrupt-classified`/`timeout-classified`). Runs 2 and 4 are induced-harness
records: their FAIL verdicts are the committed law's own honest grading of a
drive the harness aborted, NOT product claims.

## Verdicts vs the four obligations

| obligation | live evidence | verdict |
|---|---|---|
| (a) PASS arms PASS live | runs 1 + 3: mounted / fetch-positive (stub claimHits=1, RAN dest+status=200, claim read back) / approval-chain-live (2 durable ask rows, allow→deny via public seam) / deny-leg-zero-wire (victimHits=0 + APPROVAL_DENIED witness) / search-no-provider / leak-check — 7/7 twice | **MET** |
| (b) genuine NOT_REACHED graded live | **NOT MET — recorded as zero-progress, not fabricated.** Both honest external windows (create-returned→first-ask) proved unreachable (finding below); every abort landed in the suite's `failRest` (all-FAIL) leg. NOT_REACHED remains graded only in its offline home (`arm-verdict.test.mjs` 16/16 incl. T15 suite wire; see `offline-receipts.log`) | **NOT MET (honest)** |
| (c) ENV_BLOCK only via branded+re-derived signals | ENV_BLOCK appeared in **zero** arms across 4 live runs — no honest ENV_BLOCK condition occurred naturally; absence recorded, nothing forged. Every verdict (including all induced FAILs) passed the suite's `gateEnvBlock()` door; no signal was ever offered, so no ENV_BLOCK could mint | **MET (absence recorded)** |
| (d) no product refusal laundered | `APPROVAL_DENIED` + `WEB_SEARCH_NO_PROVIDER` graded as arm WITNESSES (PASS) in runs 1/3, never as ENV_BLOCK; the two host-death runs — the maximal "blame the environment" temptation — produced **zero** ENV_BLOCK (everything FAIL with the verbatim `team.create failed` reason) | **MET** |

## Structural finding (why (b) is unreachable via external abort on this head)

`team.create` with `initialWork` runs the drive **synchronously through
first-ask-recording**: run 4 observed the durable create row appear on the
ledger face while the create HTTP call had not returned; run 3 observed both
durable ask rows already recorded within 1.5 s of placement-feed #2. So there is
NO externally observable window in which `team.create` has returned to the suite
and the first `control-request-recorded` row is still absent. Killing anywhere
earlier truncates the in-flight create → the suite's `failRest` pre-empts
`classifyUnwitnessedArm` (all arms FAIL). Consequence: on the committed head the
live NOT_REACHED leg of R-ENVBLOCK-1 is not exercisable by external harness
aborts; grading it live needs an in-suite perturbation knob (e.g. an
approver-stall / drive-starvation flag) — deliberately NOT built here, as it
would change the subject under test (out of this lane's ownership). Recommend a
follow-up lane if boot-level NOT_REACHED evidence is required for settlement.

Adjacent infra observation (harness-relevant, product-neutral): BOTH public
faces read pre-session answer *ok-with-zero-rows* (`/__u7fweb/controls` →
`{ok:true, requests:[]}`, `team.getLedgerPage` → ok/empty) rather than
session-not-found. A watcher or future writer cannot distinguish "session
absent" from "session live, zero rows" — this exact trap produced the run-2
miss. Recorded so no lane re-derives it.

## Files

- `run-record-run{1,2,3,4}.json` — RUN records (schema u5-run-record/1; bindings incl. teamSha/hostSha/oracle digests)
- `runner-run{1..4}.log`, `logs/<world>/instance-port3188.log` — runner + boot logs (launch tokens present in dead, deleted worlds — precedent `u7-f-web-20261026/c2-run3/logs/`)
- `host-starts.jsonl` — lane pre-registration (4 entries, ts-before-start) · `budget.jsonl` — runner machine count (4 lines)
- `harness-abort-watch{,-run1attempt,-v2,-v3}.py` + `harness-abort-control-run{2,3,4}.log(.stdout.log)` — controls, RCAs, guard decisions
- `port-probe-pre.txt` / `port-probe-post.txt` — :3080 untouched (401 == 401), test bands empty pre/post
- `offline-receipts.log` — arm-verdict 16/16, registries 12/12, `pnpm -r build` exit 0, `check-artifacts-at-head` **drift=0** (1883 files)

## Cleanup disclosure

All four worlds torn down (runs 1/3 leak-check PASS); runs 2/4 carry the
`failRest`-stamped leak-check FAIL, so cleanup was re-verified MANUALLY post-run:
no host/watcher process alive, no 3181-3199/3491-3500 listeners, no
`tests/homes/u7r3eb-*` remaining, `:3080` state unchanged. Raw worlds deleted
(gitignored per TEST_METHODS §7); no `--keep-home` used.
