# G4-R phase-3 boot lane — u7-g4r3 (2026-10-28)

Frozen candidate: `5d0c8ff5830271b7e2ab3e7c855bb85fb2090bf3` (branch `task/u7-g4r3-live-20261028`, PR #432).
Runtime: pristine `tests/deepseek-harness-test-use` @ `639ed01539…` (0.2.0-rc.2), porcelain empty at every
boot (`hostTreeClean`/`hostPorcelainEmptyAtStartup` cells below). Lane team-root `node_modules` installed
with `pnpm install --frozen-lockfile` (lock unchanged; setup note in `setup/SETUP-NOTES.md`, install recorded
runtime-tree only — the team-root gap caused leg 1 attempt 1 and is fixed per ruling B-G4R-4).
Budget law: B-G4R-3 (planned six, ceiling), B-G4R-4 (boot 10 = ARC-A ENV retry, disclosed),
B-G4R-5 (user pre-authorization: 25 total incl. ENV failures, stop-on-same-class law NOT exempted,
per-cell named-ruling + independent-review + disclosure for every cell beyond R1's envelope of 6).
Every start is declared in its leg ledger BEFORE spawn (`host-starts.jsonl`), no post-hoc counting.
:3080 probes below read `404` on `/health` — route does not exist on the stable instance; 404 (not
connection-refused) proves the instance is live and untouched; each leg's `stable-instance-unchanged`
runner case is the authoritative guard verdict.

## Leg 1 — ARC-A — attempt 1: FAIL (ENV class) — boot 4

- Command: `node tests/world-factory/u5-canary-runner.mjs --suite u6-arc-a --line g4r3a --evidence
  dev/agent-workflow/evidence/u7-g4r3-20261028/arc-a --run-record …/arc-a/run-record.json
  --budget-ledger …/arc-a/host-starts.jsonl --max-host-starts 1`
- Port 3184 · world `u5g4r3a-20261028T17-15-44Z` · run `u5-u6-arc-a-g4r3a-2026-10-28T17-15-44-158Z`
  (booted 2026-10-28T17:15:44Z) · record preserved at `arc-a/run-record-attempt1-envfail.json`
- overall=**FAIL** — 9 FAIL / 1 PASS (`stable-instance-unchanged` PASS, :3080 guard intact)
- Root cause (ENV/harness): lane setup omitted team-root `node_modules`; mounted seam
  (`packages/runtime/root-binding/harness/seam.mjs:33`) bare-imports `@deepseek-ai/dsh-storage-domain`;
  resolution failed and checkout-fallback re-parent could not answer either
  (`logs/u5g4r3a-20261028T17-15-44Z/setup-failure.json`). Product never reached.
- Boot declared pre-spawn (ledger line 1). Fix between attempts: team-root
  `pnpm install --frozen-lockfile` (zero tracked change; HEAD stayed `5d0c8ff58`).
- Authorization for the retry: ruling **B-G4R-4** (named, +1, disclosed over-budget; independent review
  PASS by og `deepseek-v4.1-flash`, `.artifacts/reviews/R434-og.md` in main checkout) + user
  pre-authorization **B-G4R-5**. Deviation disclosed: B-G4R-4/5 land via PR #434 (CI in flight at spawn
  time); the spawn rests on the user's directly-issued pre-authorization, effective on issue.

## Leg 1 — ARC-A — attempt 2 (retry): PASS — boot 10 by the reviewer's envelope count / boot 5 chronologically

- Command: identical to attempt 1 with `--max-host-starts 1 → 2` on the SAME ledger (1 consumed + 1
  declared by B-G4R-4; attempt-1 record `cp`-preserved first). **disclosed** per-cell beyond envelope:
  B-G4R-4 (named) + og review PASS (independent signature) + this line (disclosure).
- Port 3184 · world `u5g4r3a-20261028T18-52-21Z` · run
  `u5-u6-arc-a-g4r3a-2026-10-28T18-52-21-046Z` · 2026-10-28T18:52:21.320Z → 18:58:24.978Z (6m 04s) ·
  exit 0 · runner cleaned the world (`tests/homes` back to 0)
- overall=**PASS** — 10/10:

| case | verdict |
| --- | --- |
| arca:mounted | PASS |
| arca:probe-positive | PASS |
| arca:probe-unbound-refused-zero-effect | PASS |
| arca:probe-replay-refused-zero-effect | PASS |
| arca:probe-unload-settles | PASS |
| arca:search-grep-live | PASS |
| arca:search-glob-live | PASS |
| arca:search-refusal-zero-effect | PASS |
| arca:native-grep-control | PASS |
| stable-instance-unchanged | PASS |

- Bindings (`arc-a/run-record.json`): `teamSha=5d0c8ff5830271b7e2ab3e7c855bb85fb2090bf3` ✓ ·
  `hostSha=hostTreeSha=639ed015397290b3745d163aafe02ffee4aa3f84` ✓ · `hostPorcelainEmptyAtStartup=true` ✓ ·
  `composedProfileDigest={"u5g4r3a-20261028T18-52-21Z":["09e75ff1da3b8668…"]}` (artifact
  `logs/u5g4r3a-20261028T18-52-21Z/composed-profile-09e75ff1….patch.yml`) ·
  `worldOracleDigest=6455a2cd898968ef…` (artifact `arc-a/u5-u6-arc-a-g4r3a-….oracle.json`) ·
  `canaryPluginSha256=037cfbea364a8031…` · sandbox `nativeConfinementBackend=partial` (disclosed:
  native confinement legs ran under PARTIAL Landlock enforcement; no partial⇒full equivalence claimed) ·
  `trustedSourcesDigest=null` with machine-readable `trustedSourcesUnavailableReason` (runner public
  World/HTTP surface exposes no plane TrustSources digest — pre-existing runner disclosure, same as
  phase-2 records, not new drift).
- `teamTreeClean=false` — honest readout: the ONLY tracked change at spawn was this lane's own
  append-only boot ledger `arc-a/host-starts.jsonl` (attempt-1's pre-spawn declaration); zero source
  files differ from the candidate (`git status --porcelain -uall` shows only evidence/log additions).
  Phase-2 recorded `true` because its first boot preceded any ledger append. Not a candidate-integrity
  issue; disclosed rather than laundered.
- Ledger after leg: `arc-a/host-starts.jsonl` = 2 lines (cap 2 — this leg can spend no more).
- :3080 pre/post probes 404/404 (live, untouched) + guard case PASS.

## Leg 2 — ARC-D: PASS — single boot, within envelope

- Command: `node tests/world-factory/u5-canary-runner.mjs --suite u6-arc-d --line g4r3d --evidence
  dev/agent-workflow/evidence/u7-g4r3-20261028/arc-d --run-record …/arc-d/run-record.json
  --budget-ledger …/arc-d/host-starts.jsonl --max-host-starts 1` (no deviation)
- Port (runner lease) 3184 family · world `u5g4r3d-20261028T18-58-54Z` · run
  `u5-u6-arc-d-g4r3d-2026-10-28T18-58-54-017Z` · 2026-10-28T18:58:54.167Z → 18:59:54.582Z (60s) · exit 0
- overall=**PASS** — 12/12: mounted, positive, spoof-zero-authority, swap-refused, unbound-refused,
  replay-refused, ci03-native-parity, restrict-veto, lift-control, marker-ledger, teardown-honest,
  stable-instance-unchanged — all PASS (table in `arc-d/run-record.json`)
- Bindings: team `5d0c8ff58…` ✓ host `639ed01539…` ✓ `hostPorcelainEmptyAtStartup=true` ✓
  `worldOracleDigest=0b365975820a…` `composedProfileDigest{u5g4r3d…:934fe63283ad…}` ✓
  sandbox `partial` (same standing disclosure as leg 1) · `teamTreeClean=false` (same single cause:
  leg-1 append-only boot ledger; zero source drift — see leg 1 note) ·
  `trustedSourcesDigest=null` (pre-existing runner-surface disclosure)
- Ledger: `arc-d/host-starts.jsonl` = 1/1. :3080 pre/post 404/404 + guard PASS. World cleaned (homes 0).

## Leg 3 — Jobs (Bridge) — PASS, single boot — PRIORITY native-ctl cell: PASS (not ENV_BLOCK)

- Command (corrected per parser): `node tests/world-factory/u7-4a-jobs-suite.mjs --run-id u7g4r3-jobs-1
  --line g4r3j --evidence …/jobs --budget-ledger …/jobs/host-starts.jsonl --max-host-starts 1`.
  **Deviation disclosed:** brief's `--run-record` does not exist in the suite parser
  (`u7-4a-jobs-suite.mjs:107-113`); the suite auto-writes its record at :260 to
  `jobs/u7g4r3-jobs-1.u74a-run-record.json` — the path the brief intended.
- World `u5g4r3j-20261028T19-00-10Z` · run `u7g4r3-jobs-1` · exit 0 · ledger 1/1 · world cleaned (homes 0)
- overall=**PASS** 12/12: mounted, bg-receipt-carries-host-job-id, attributed-server-side,
  ring-bytes-via-job-output-wait, list-shows-owner, kill-live-requested, kill-finished-honest,
  foreign-cross-scope-refusal, planted-unattributed, **native-ctl-unaffected**, exactly-once-approvals,
  stable-instance-unchanged (`status":401` read-only probe cell) — all PASS.
- Priority readout verbatim: `bindings.nativeConfinementBackend="partial"`;
  `u74a:native-ctl-unaffected` case `ctlHead`:
  `U74A_CTL_CLAIM_u5g4r3j-20261028t19-00-10z` + stderr `landlock-run: partial enforcement (older Landlock ABI)`
  — the native control leg RAN and PASSED under partial Landlock enforcement (no partial⇒full
  equivalence claimed; standing disclosure `bindings.nativeConfinementDisclosure` recorded verbatim in
  the record). Per the R1-review rule, the Bridge verdict does not rest on ENV_BLOCK anywhere — the
  cell is a real PASS.
- Bindings: team `5d0c8ff58…` host `639ed01539…` ✓ · `composedProfileDigest{u5g4r3j…:d1b128b177df…}` ·
  `worldOracleDigest=32d2b9409244f4…` · attribution counts (record tail): attributed host lines 5,
  ask rows 10, kernelHits job_output 8. Note: this suite's bindings emit no `teamTreeClean`/
  `hostPorcelainEmptyAtStartup` cells (schema difference vs canary runner, not drift).

## Leg 4 — ARC-B (tbash governed approval lane): PASS — single boot; reuse-flag deviation disclosed

- Attempt 1 (no reuse flag) refused at config time with the verbatim F3 error:
  `--evidence dir is not empty: 1 existing entries (boot-budget.jsonl)` — **zero boots consumed**
  (refusal precedes any spawn; ledger stayed 0 lines).
- Attempt 2 = same command + `--allow-reused-dir`. **Deviation disclosed (never silent):** the only
  file in the evidence dir is the lane's own PRE-DECLARED boot-budget.jsonl (0 bytes, 0 declared
  boots) — exactly the pre-declared-ledger reason the flag exists for; nothing else was in the dir.
- Command: `node dev/agent-workflow/evidence/u7-tbash-l4-20261027/c2/run-c2.mjs --evidence
  dev/agent-workflow/evidence/u7-g4r3-20261028/arc-b --budget-ledger …/arc-b/boot-budget.jsonl
  --budget 1 --allow-reused-dir` (driver read from CLOSED lane read-only; writes only into own dir)
- World `u5u7tb-20261028T19-07-21Z` · 2026-10-28T19:07:21.070Z → 19:08:50.642Z (90s) · exit 0
- overall=**PASS** 6/6: tbash:mounted (launcher pin `1264ea584e3438d6…`), approve-spawn-once,
  replay-refused (spent-row seam re-allow refused `CONTROL_REQUEST_D…`), other-command-refused
  (command-hash mismatch denied, zero effect), deny-zero-effect, leak-check
  (`inCorpus:false, bytesUnchanged:true, allowsIssued:1`) — all PASS; approval ledger: 1 allow / 3
  reasoned denies.
- Bindings: team `5d0c8ff58…` host `639ed01539…` · **`teamTreeClean=true`** (this suite's own
  measurement at spawn) · `:3080 401 -> 401` verbatim from the record line — stable instance live and
  untouched. Schema note: this suite's record emits no profile/oracle digest cells (c-suite schema,
  same as its phase-2 ancestor record; not drift).
- Ledger: `arc-b/boot-budget.jsonl` = 1/1. World cleaned (homes 0).

## Leg 5 — crash survivor pair: FAIL (sequencing cells) — boots 9+10 declared, NO retry before root cause

- Command: `node tests/world-factory/u5-parallel-supervisor.mjs --evidence …/crash --mode crash-reclaim
  --survivor-suite core --max-host-starts 2 --budget-ledger …/crash/host-starts.jsonl` (no deviation)
- Run `u5-crash-2026-10-28T19-09-04-633Z` · victim world `u5cbv-20261028T19-09-05Z` + survivor world
  `u5ca-20261028T19-10-46Z` · ledger 2/2 (both declared pre-spawn; budget spent honestly)
- Records: `crash/run-…-A.json` (survivor suite) overall=**PASS** 7/7 incl. `stable-instance-unchanged`;
  `crash/run-….json` (supervisor) overall=**FAIL** 4 PASS / 1 FAIL:
  abnormal-kill-reclaim PASS · crash-simulation-reclaim PASS · pristine-host-and-stable-untouched PASS ·
  sibling-homes-untouched PASS · **other-world-unaffected FAIL**.
- The FAIL cell verbatim: product-side observables all good (`aAliveWhileBCrashedAndReclaimed:true`,
  survivor `aOverall:"PASS"` 7/7, `survivorHostIdentityContinuous:true`, `reclaimVictimOnly:true`), but
  the supervisor's own sequencing gate failed:
  `{"killInsideSurvivorWindow":false,"survivorHeldUntilReclaim":false,"preKillProbeSucceeded":false,
  "postReclaimProbeSucceeded":true,"failedProbeInWindow":false,"pass":false}`.
- Readout both records: `teamSha=5d0c8ff5830271b7e2ab3e7c855bb85fb2090bf3` ✓ (survivor binding to THIS
  candidate present), `hostSha=639ed01539…` ✓. World cleaned (homes 0); :3080 pre 404 + guard PASS.
- Disposition: NO re-run, no relabel. Root-cause analysis (read-only) recorded at
  `.artifacts/findings/crash-sequencing-rca-20261028.md` (main checkout) BEFORE any further boot;
  any retry needs a named ruling + independent review + disclosure per B-G4R-5 §3.

## Leg 5 (retry) — crash survivor pair: PASS — boots 11+12 on fresh ledger; PASS-by-knob DISCLOSED

- Authorization (all three of B-G4R-5 §3, none skipped): named ruling **B-G4R-6** (pre-spawn, PR #438) +
  independent review **PASS-WITH-FINDINGS** by og `deepseek-v4.1-flash` (artifact
  `.artifacts/reviews/R438-og.md`, nothing blocking; F2 wording adopted in b273d4fd4) + this disclosure line.
  Spawn deviation (as leg-1): boot rests on the user's directly-issued pre-authorization (effective on
  issue); B-G4R-6 lands via PR #438 (#436/B-G4R-5 merges first per reviewer F1).
- Command: `node tests/world-factory/u5-parallel-supervisor.mjs --evidence …/crash --mode crash-reclaim
  --survivor-suite core --max-host-starts 2 --kill-after 6000
  --budget-ledger …/crash/retry-host-starts.jsonl` (**fresh ledger**, attempt-1 ledger untouched at 2/2).
- Run `u5-crash-2026-10-28T19-27-56-518Z` · victim `u5cbv-20261028T19-27-57Z` + survivor
  `u5ca-20261028T19-29-36Z` · retry ledger 2/2 declared pre-spawn · exit 0 · homes cleaned (0)
- Supervisor overall=**PASS** 5/5 (abnormal-kill-reclaim, crash-simulation-reclaim, other-world-unaffected,
  pristine-host-and-stable-untouched, sibling-homes-untouched); survivor suite overall=**PASS** 7/7;
  sequencing cells now all true: `killInsideSurvivorWindow/survivorHeldUntilReclaim/preKillProbeSucceeded/
  postReclaimProbeSucceeded/survivorHostIdentityContinuous/reclaimVictimOnly = true, failedProbeInWindow=false`.
- Both records bind `teamSha=5d0c8ff5830271b7e2ab3e7c855bb85fb2090bf3` + `hostSha=639ed01539…` ✓.
  :3080 pre 404 / post 404 (live, untouched) + guard PASS.
- **PASS-by-knob, disclosed:** this PASS was obtained with `--kill-after 6000`; the underlying assertion
  (`u5-parallel-supervisor.mjs:92`) remains structurally non-deterministic — durable fix **R-CRASH-1**
  (hold/probe handshake + split aliased cells) scheduled post-freeze. Attempt-1 FAIL stands unedited.
