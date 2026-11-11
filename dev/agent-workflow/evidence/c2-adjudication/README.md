CANDIDATE-C2

# C2 independent adjudication — frozen candidate `cand-v0.1.6-1`

Adjudicator: independent session (did not author, edit or build any product code for this
candidate — see the signature block). Date: 2026-11-10. Scope: **C2-A** and **C2-B** per
owner ruling D15 (`docs/plans/active/alpha5-sandbox-first/OWNER-DECISIONS-2026-11-09.md`,
lines ~190).

## 0. Frozen identity (what was measured)

| field | value |
| --- | --- |
| candidate id | `cand-v0.1.6-1` |
| candidate ref | `refs/heads/candidate/v0.1.6-1` |
| candidate commit | `168266dbfe7f2de091d998431bd56ce4dba0dbb5` |
| candidate sha (same) | `168266dbfe7f2de091d998431bd56ce4dba0dbb5` |
| manifest | `dev/engineering/candidates/cand-v0.1.6-1.json` @ `f31e3d9e2` |
| manifest content digest | `sha256:7a6c8dbd512d8ef7ba29668dcdd06342a1f665904aed13f284f7b3700c0518bd` |
| Authority | pointer `dev/engineering/current-authority.json` → snapshot `as20261109r1`, baseline `cb2e41483af8447700fb3c2a25c2686705320692` |
| Authority content digest | `sha256:d85fdc1a78f055dc460799a6ff560daab541d0d7f96bb48294ff3dee76a398b3` |
| host pin | `tests/deepseek-harness-test-use` @ `639ed015397290b3745d163aafe02ffee4aa3f84` (DSH `0.2.0-rc.2`, read from `tests/paths.mjs`) |
| measurement worktree | `.worktrees/c2` at `168266dbf` on `task/c2-adjudication-20261109` |

The pointer and the candidate ref were **not** moved. No `packages/**` or `scripts/**`
product file was touched by this adjudication. Two boots concurrent at most; WorldFactory
leased every port; every World was torn down by identity (`tests/homes/` count = 0 after
the runs); `:3080` was never contacted.

### Reading the manifest from the candidate tree — disclosed deviation

The manifest and `scripts/verify-candidate.mjs` / `scripts/freeze-candidate.mjs` /
`scripts/authority-snapshot.mjs` **do not exist at the candidate commit**; they landed later
on master (`f31e3d9e2`, PR #706). The verifier was therefore run from a detached helper
worktree `.worktrees/c2-verify` at `f31e3d9e2`, with `--root` pointed at the measurement
worktree `.worktrees/c2` (so every git read and every digest is recomputed against the
frozen candidate tree, not against master). The helper worktree contains no product change.
This is a tooling-availability deviation, not a candidate-tree deviation.

## 1. Instruments (what produced the observations)

All instruments are **tracked in-tree instruments**, used unmodified except for the
relocated copies noted below; each run records its own `runBindings` (team sha
`168266dbf…`, host sha `639ed015…`, Authority `as20261109r1`).

| instrument | source | sha256 | runs |
| --- | --- | --- | --- |
| governed E2E driver `a5sf-pd33-preview-e2e` | `tests/world-factory/drivers/a5sf-pd33-preview-e2e/run-boot.mjs` @ candidate | tracked | C2-A `c2a-pd33-e2e-r1.log` |
| FS/Search 14-row driver | relocated copy of `dev/agent-workflow/evidence/g2-live/fs/run-boot.mjs` (byte-identical) | `ad1e4a4dfc82d6737e53c2f2d7aa04d6b7b2d45eaa12bb09ad71fb52dd766633` | C2-A boots 1–2 |
| A6 approval-plane kit | `tests/kits/c1-leader-approval-smoke/c1-leader-approval-smoke.mjs` @ candidate | tracked | C2-B all arms |

Relocated FS copy lives at `dev/agent-workflow/evidence/c2-adjudication/fs/` (same
directory depth as `g2-live/fs/`, so `REPO_ROOT` resolution is unchanged). The FS driver writes its own `dev-live-grant.json` (scope `DEV-LIVE`, grantId
`devlive-fs-search-1`) when absent; it is kept here for transparency and is **not** a candidate
record. The `c2-adjudication/fs/` directory also holds the redacted host stdout for its two
boots. The pd33 driver
was run **from its shipped path**, so its evidence landed in the tracked
`dev/agent-workflow/evidence/a5sf-pd33-preview-e2e/` tree first and was then copied to
`c2a-pd33-e2e-pair/`; the tracked tree was restored with `git checkout --` + `git clean -fd`
and reports zero porcelain.

### Oracle policy actually applied

The tool return value is never its own correctness evidence. Per case the oracle is stated
in the tables below; the channels are:

- **FS/Search rows**: durable guard-consult facts (`a5sf-consult.jsonl`), the confined-spawn
  counter (a process was or was not spawned), the on-disk marker (`diskMatches`,
  `diskUnchanged`, `outsideFileExists`), and the host loopback connection counter. The
  driver's `--plan`/preflight 18/18 check runs before boot.
- **pd33 E2E**: durable `a5sf-guard-consult/1` facts per tool, the World transcript /
  `delegations` map, mock-connection counters, on-disk artefact content, and a
  `/proc`-based tripwire for `no-base-web`.
- **A6 kit**: the durable control ledger (`team_domain.json#tables.ledger`), the
  `sessions/` files, the wake-transcript text, the effect file on disk, host-pid liveness
  across the SIGKILL/restart, and the remote public surface (`team_list_pending_control` /
  projection / recovery RPC) for the A6-26 discovery claim.

`tests/world-factory/lib/oracle.mjs` (marker + ledger `body-ran`/`marker-ran` + host-pid
liveness) was **not directly wired** into these three drivers: their evidence layouts are
not the `oracle.mjs` World shape, and their Worlds are torn down by identity at driver exit.
The same three channels (disk marker, durable ledger, host-pid liveness) are read directly
from driver artefacts and are cited per case. See §7.

## 2. C2-A — governed preset, Alpha.6 OFF

Preset `a5sf-governed-member`; `a5sfGovernedRealm` on; `alpha6ReviewRouting` absent/false.
Two boots of the governed E2E driver (one invocation, `--boots 2`) **and** two boots of
the FS/Search axis-detail driver.

Run directories:

- `c2a-pd33-e2e-pair/runs/boot01`, `c2a-pd33-e2e-pair/runs/boot02`,
  `c2a-pd33-e2e-pair/agreement.json` (driver `RESULT PASS (2/2 boots; agreeing pair=true)`)
  - boot01 `a5sf-pd33-preview-e2e-2026-11-10T15-57-16-605Z-b1`, world `u5u5a5sfpd33-20261110T15-57-16Z`
  - boot02 `a5sf-pd33-preview-e2e-2026-11-10T15-59-33-124Z-b2`, world `u5u5a5sfpd33-20261110T15-59-33Z`
- `c2a-fs-boot1/` (`runId a5sf-fs-devlive-2026-11-10T16-03-12-138Z`) and
  `c2a-fs-boot2/` (`runId a5sf-fs-devlive-2026-11-10T16-12-41-682Z`), each 13 PASS +
  1 NOT_REACHED (`read_image`, model declares no image input — outside C2-A scope).
- `agreement/C2-A.json` — machine-readable per-case agreement of the two FS boots and the
  two pd33 boots; `agreeing: true`, `disagreements: []`.

| # | case | boot1 | boot2 | adjudicator verdict | decisive line (raw) | oracle | falsifier that would overturn it |
| --- | --- | --- | --- | --- | --- | --- | --- |
| A1 | `read` positive — in-lane read allowed, bytes returned | PROVEN | PROVEN | **PASS** | `live:row1-read-a-inside-both-allowed PASS {"reason":"READ_A_ALLOWED_AND_CONFINED",...,"bindingAllowFact":true,"providerServed":true,"providerConfined":true}` + pd33 `counts={"read":3,...}` | guard-allow fact + confined provider counter + returned bytes; not the tool text alone | an allow decision without a provider spawn, or bytes returned without a guard fact |
| A2 | `read` minimal-permission negative — out-of-lane/binding deny, zero bytes | PROVEN | PROVEN | **PASS** | `live:row2-read-b-binding-deny-on-read-path PASS {"reason":"BINDING_DENY_ON_READ_PATH","readPathDecisions":["deny"],"counterRows":0}` and `live:row3-read-c-refused-no-widening PASS {"exactlyOneBindingDeny":true,"noProviderRead":true}`; pd33 `out-of-lane-read-typed True codes=["IO_READ_DENIED"] facts=1` | one binding deny fact on the read path + zero provider reads/bytes | any allow fact, any provider read, or a leaked byte |
| A3 | `write` positive — ceiling write in lane | PROVEN | PROVEN | **PASS** | `live:row4a-write-in-lane-readable-allowed-ceiling-only PASS {"diskMatches":true,"everyWriteFactOnCeiling":true,"counterRows":1}`; pd33 `artefact-on-disk True content=probe line\nA5SF_PD33_A_EDIT_AFTER` | on-disk bytes equal the expected marker + write fact on the ceiling lane | disk mismatch or no write fact |
| A4 | `write` minimal-permission negative | PASS | PASS | **PARTIAL — not a lane-level deny** | `live:row4b-write-b-ceiling-allowed-read-not-implied PASS {"ceilingWriteAllowed":true,"noReadLaneWriteAllow":true}` but `observed="Error: cannot modify … file has not been read — read the file, then retry"` | guard facts: 1 write decision (`allow`, ceiling lane); the refusal came **after** the guard, from the host read-before-write observation policy | a refusal whose locus is the lane algebra (deny fact / zero write fact) would be needed for a clean lane negative |
| A5 | `edit` positive — in-lane edit | PROVEN | PROVEN | **PASS** | `fs:edit-in-lane PASS {"isError":false,"writeCalls":1,"facts":3}`; pd33 `counts={...,"edit":1}` | edit write fact + 3 guard facts + updated file text | no write fact / no file change |
| A6 | `edit` minimal-permission negative | PASS | PASS | **PARTIAL — locus is the host policy** | `fs:edit-outside-ceiling PASS {"isError":true,"locus":"host-read-before-write-observation-policy","guardFacts":0,"writeCalls":0}` | the request never reached the Team guard (`guardFacts:0`); host read-before-write refused it | a lane deny fact on the edit path would be needed for a clean lane negative |
| A7 | `grep` positive — in-lane search allowed and confined | PROVEN | PROVEN | **PASS** | `live:search-row1-grep-in-lane-allowed PASS` (`IN_LANE_GREP_ALLOWED_AND_CONFINED`) + pd33 `counts={"grep":1}` | allow consult fact + confined spawn counter + match text | base-spawn instead of confined, or no fact |
| A8 | `grep` minimal-permission negative — out-of-lane refused before any process | PROVEN | PROVEN | **PASS** | `live:search-row2-grep-outside-ceiling-refused PASS` (`OUT_OF_LANE_REFUSED_BEFORE_ANY_PROCESS`); `live:search-row3-grep-outside-restriction-refused PASS` (`RESTRICTION_NARROWER_THAN_CEILING_REFUSED_AT_ADMISSION`) | deny fact **plus** zero confined/base spawn for that call | any spawn or a success result |
| A9 | `glob` positive — in-lane glob lists the file | PROVEN | PROVEN | **PASS** | `glob-face.json "inLane" {"verdict":"PROVEN","checks":{"matchReturned":true,"fileNamed":true,"exactlyOneAllowFact":true,"allowDecidedByALLOW":true}}`; pd33 `counts={"glob":1}` | allow fact for the declared root + exactly one `rg --files` spawn + named match | match with no allow fact, or a spawn outside the lane |
| A10 | `glob` minimal-permission negative — outside root denied, zero process | PROVEN | PROVEN | **PASS** | `glob-face.json "outside" {"verdict":"PROVEN","checks":{"exactlyOneDenyFact":true,"denyDecidedByReadDenied":true,"noConfinedProcess":true}}` | one `IO_READ_DENIED` deny fact and no confined/base spawn | any returned path, any spawn |
| A11 | `web_fetch`/`web_search` positive — governed web works | PROVEN | PROVEN | **PASS** | pd33 `fetch-body-verbatim True … A5SF_PD33_KNOWN_BODY_BYTES`, `fetch-one-connection True connections=1`, `fetch-allow-fact True facts=1`; `search-post-count-matches-branch … POST /search=0 facts=1` | mock connection counter + verbatim body + web allow fact; search is the documented typed-unavailable branch | a second connection, or a fetch body not equal to the served bytes |
| A12 | `web` minimal-permission negative — out-of-lane destination | PROVEN | PROVEN | **PASS** | pd33 `out-of-lane-host-refused True codes=["WEB_DESTINATION_FORBIDDEN"]`, `out-of-lane-host-zero-connections True search-origin /known hits=0` | typed refusal + zero host connections | any connection or a body |
| A13 | full E2E ledger flow — Leader creates two Members, delegation, per-tool facts, collection, goal, no-base-web | PROVEN | PROVEN | **PASS** | `RUN-SUMMARY … overall=PASS cases=19 NOT_SELECTED:9 PASS:10 … arms=e2e selected=10/19`; `facts-per-tool True factless=[] counts={"read":3,"grep":1,"web_fetch":2,"glob":1,"web_search":1,"write":1,"skill":2,"edit":1,"bash":64,"present":2}`; `no-base-web host-web-calls-zero True` | durable facts per tool + transcript + mock counters + `/proc` tripwire | a dispatch with no fact (`factless` non-empty) or a base web call |

C2-A adjudicator verdict: **PASS**, with A4/A6 as **partial** (refused, but not by the lane
algebra). The driver's own `overall=PASS` is not the verdict; the decisive per-case lines
above and the 2-boot agreement are.

## 3. C2-B — governed preset, Alpha.6 ON

Opt-in `a5sf-governed-member`, `alpha6ReviewRouting` true, Officer allow/deny plane. Ten
single-boot kit runs, two per arm, all on `168266dbf` / `639ed015…`:

| arm | boot 1 dir / runId | boot 2 dir / runId |
| --- | --- | --- |
| allow + deny + exec negatives | `c2b-a6-allowdeny-r1` / `2026-11-10T15-57-52` | `c2b-a6-allowdeny-r1b` / `2026-11-10T16-03-12` |
| Stop | `c2b-a6-stop-r1` / `2026-11-10T16-07-49` | `c2b-a6-stop-r2` / `2026-11-10T16-09-24` |
| Sticky Stop | `c2b-a6-sticky-r1` / `2026-11-10T16-10-01` | `c2b-a6-sticky-r2` / `2026-11-10T16-12-41` |
| cold recovery (SIGKILL) | `c2b-a6-crash-r1` / `2026-11-10T16-15-28` | `c2b-a6-crash-r2` / `2026-11-10T16-16-50` |
| A6-26 accepted-not-claimed | `c2b-a6-unclaimed-r1` / `2026-11-10T16-19-11` | `c2b-a6-unclaimed-r2` / `2026-11-10T16-21-22` |

**Run 1 of the allow/deny arm was repeated as `r1b`.** The first run (`r1`) had contended
with a pd33 boot and produced A6-28/A6-29 failures; `r1b` ran with no other boot and
reproduced the identical failure, so the repetition confirms rather than replaces run 1.
Both are kept; `r1b` is the clean measurement, `r1` the contention double-check.

| # | case | boot1 | boot2 | adjudicator verdict | decisive line (raw) | oracle | falsifier |
| --- | --- | --- | --- | --- | --- | --- | --- |
| B1 | Officer **allow** — Member ask routed to Officer, model-visible wake, Officer resolves, original command executes, Leader not woken | PASS | PASS | **PASS** | `PASS A6-2 … wakes=3 notifications=0 requests=17` (r1) / `requests=16` (r1b); `PASS A6-3 resolveCalls=1`; `PASS A6-4 file=…/c1-a6-allow-….txt`; `PASS A6-5 wakes=3 leaderWakes=0` | durable request/decision + on-disk effect file + wake transcript | Leader woken, no file, no decision |
| B2 | single consumption + single execution on the allow path | PASS | PASS | **PASS** | `PASS A6-6 every durable request at the end is settled … requests=2 decisions=2 consumptions=2 pending=`; `PASS A6-27 executed=true pa=ctrl-… callId=… outcome=succeeded facts=1` | ledger counts (1 consumption, 1 execution-result) + `succeeded` fact | 2 consumptions, 2 execution facts, or a missing result |
| B3 | Officer **deny** — a denied call is refused after a durable decision, zero consumption, zero side effect, no execution-result | FAIL | FAIL | **FAIL (as instrumented) — the durable-request precondition never existed** | `FAIL A6-28 … request=none decision=none consumed=false execFacts=0 file=false done=true` in **both** boots; `a6-exec-negatives.json` `"deny":{"request":null,…}`; the throw leg saw `Error: permission denied: exec fingerprint … answered deny from the fallback` | control ledger: no `control-request-recorded` row for the deny prompt; the ask was answered by the base permission fallback, so the A6 plane was never engaged | a durable `control-request-recorded` row would be needed before any deny verdict is meaningful |
| B4 | post-consumption negative — a backend that throws records one terminal `failed`, never `succeeded` | FAIL | FAIL | **FAIL (as instrumented) — precondition not established** | `FAIL A6-29 … request=none consumed=false execFacts=none callId=none done=true`, same `permission denied … fallback` tool result | ledger execution-results for the call | a consumed request with a `succeeded` fact |
| B5 | Goal authorisation — governed `create_goal` → automatic rounds → terminal `complete` | PROVEN (A5, A6 off) | PROVEN | **PASS for A5-governed; NOT ESTABLISHED for the exact A6-on conjunction** | pd33 `three-automatic-rounds True rounds=3`, `terminal-complete True finalPhase=complete`, `complete-call-accepted True call=true`; A6-on A5-authority leg: `PASS A6-27 … outcome=succeeded` (work delivery stays human-attributed) | goal-phase transcript (`rounds=3`, `finalPhase=complete`) + create_goal result; A6-27's durable execution fact for attribution | a goal that never reaches `complete`, or a refused `create_goal` under the A6-on composition |
| B6 | Stop — `session/cancel` after the human allow, before consumption; a late allow must not revive the call | PASS A6-11 / **FAIL A6-12** (`consumed=true`, `file=""`) | PASS A6-11 / **PASS A6-12** (`consumed=false`, `file=""`) | **DISAGREE — not established; see §4** | r1: `FAIL A6-12 … lateStatus=200 lateDecision={"decision":"allow",…} consumed=true file=""`; r2: `PASS A6-12 … consumed=false file=""` | late-allow decision + consumption ledger entries + effect file (`file=""` in both) | a consumption entry for a post-Stop allow is the failing observation; its absence is the pass |
| B7 | Sticky Stop — durable marker, withdrawn wake, machine relay/work does not clear it, survives restart, explicit user clear | FAIL | FAIL | **FAIL — reproduced limit, no durable marker is written** | both boots: `FAIL A6-22 … cancel=true markers= wakeRows= wakes=1->1`; `FAIL A6-23 … restart=ok markers= wakes=1->1`; `FAIL A6-24 … markers= wakes=1->1 historicalExecuted=false`; `FAIL A6-26/A6-27 … markers=`; `a6-sticky-stop.json {"rows":[],"stoppedRows":[],"wakeRows":[],"markersAfterRestart":[],"markersAfterResume":[]}` | marker file existence + wake rows + wake counter + restart | a `stopped-*.json` marker would flip this; none exists in either boot |
| B8 | cold recovery after real SIGKILL — request recoverable, no execution before/after restart, dead invocation settled without deny rewrite | PASS | PASS | **PASS** | `PASS A6-13 … exited=true pa=ctrl-… restart=ok decision=null consumed=false file=false`; `PASS A6-14 … abandon=invocation-abandoned consumed=false file=false` | host-pid liveness across kill/restart + durable request row + consumption/effect absence | an execution before restart, or a `deny` rewrite |
| B9 | A6-26 known path — accepted-but-never-claimed wake, SIGKILL, restart | `verdict=abandoned-terminal` | `verdict=abandoned-terminal` | **REPRODUCED-AS-DOCUMENTED** (not PASS) | both boots: `… pendingBefore=1 pendingAfter=0 discoverable=true pendingCount=0 abandoned=1 recoveryCode=CONTROL_REQUEST_ABANDONED restart=ok verdict=abandoned-terminal` | `a6-inbox-unclaimed.json`: `abandonedAfter=[control-request-abandoned:invocation-abandoned]`, `discoveryAfter.requestFactVisible=true`, `requestIdOccurrences=2` | `wakesAfterRestart>0` (exactly-once) or `discoverable=false` |

C2-B adjudicator verdict: **NOT PASS.** The allow path, single consumption/execution, and
cold recovery pass in both boots; the deny path never reaches a durable decision on this
candidate (both boots), Sticky Stop writes no durable marker (both boots), the A6-26 path
is the documented abandonment, and the Stop case disagrees between its two boots.

## 4. Disagreements (not averaged)

- **A6-12 / B6 (Stop)**: boot 1 `consumed=true` (`FAIL`), boot 2 `consumed=false` (`PASS`).
  Both boots had `file=""` (no Side effect) and both accepted the late allow
  (`lateStatus=200`). The disagreement is whether a consumption entry for the late allow
  exists — i.e. the Stop-vs-consumption window is a **race** on this candidate, not a stable
  property. The kit's own text wants "a second allow is rejected as already decided"; boot 1
  shows the second allow recorded and consumed, boot 2 shows the same decision recorded but
  not consumed. No average is taken; the case is recorded as not established.
- No other case disagreed across its two boots: allow/deny, Sticky, crash and A6-26 each
  produced identical case tables in both boots.

## 5. A6-26 outcome (D11 surface)

Both boots reproduce the documented limit exactly: an accepted-but-never-claimed wake is
abandoned after restart (`verdict=abandoned-terminal`,
`recoveryCode=CONTROL_REQUEST_ABANDONED`, `reason=invocation-abandoned`), the durable request
stays discoverable by id (`requestFactVisible=true`, `requestIdOccurrences=2`,
`pendingControlCount=0`), and there is no duplicate claim (`wakes=0->0->0`). Under owner
ruling D11 / release note §5 this is **REPRODUCED-AS-DOCUMENTED**, not PASS and not a new
defect. The kit's own `check('A6-26', …)` is FAIL because its `ok` predicate accepts only
`exactly-once` or `stranded-discoverable`; the verdict string itself is the evidence.

## 6. Independent verification output

Run from `.worktrees/c2-verify` (scripts + manifest @ `f31e3d9e2`) with `--root` =
`.worktrees/c2` (candidate tree):

```
(node scripts/verify-candidate.mjs --manifest dev/engineering/candidates/cand-v0.1.6-1.json --root ../c2 \
   --record ../c2/dev/agent-workflow/evidence/c2-adjudication/records/C2-A.json \
   --record ../c2/dev/agent-workflow/evidence/c2-adjudication/records/C2-B.json)
```

The two records deliberately do **not** set `candidateClaimEligibility.eligible=true`: the
C2-B scope is NOT PASS, so no candidate-level eligibility is claimed. They are
`recordClass: CANDIDATE-C2` records bound to the frozen commit; the verifier accepts them
as candidate-bound evidence without an eligibility claim.

Verbatim output (exit 0; 146 PASS edges; 122/122 judge/driver files pinned; both C2 records PASS):

```
manifest /home/armourpiercer/projects/dsh-agent-team/.worktrees/c2-verify/dev/engineering/candidates/cand-v0.1.6-1.json
PASS         manifest.shape: cand-v0.1.6-1 / 168266dbfe7f2de091d998431bd56ce4dba0dbb5
PASS         candidate_commit.resolves: 168266dbfe7f2de091d998431bd56ce4dba0dbb5 is a commit in this repository
PASS         candidate_ref.tip: refs/heads/candidate/v0.1.6-1 = 168266dbfe7f2de091d998431bd56ce4dba0dbb5 (frozen)
PASS         content_digest: sha256:7a6c8dbd512d8ef7ba29668dcdd06342a1f665904aed13f284f7b3700c0518bd (F0, digest fields removed)
PASS         product.trees.packages: fa5a18143079065b0fba77ff283abe88193e1390
PASS         product.trees.scripts: e23d2d1e2e05f0f98d87eeeb92da9234f3bcee61
PASS         product.trees.tests/paths.mjs: 1bf4829eb8709a0121c80f9e91cb00855e0db7eb
PASS         product.trees.package.json: f9ab4bc9ae3a7039ceca9d64f0280473cfeb9f1f
PASS         product.trees.pnpm-lock.yaml: 93f4f1dde45d4f965a354272b9a10f89363d8c50
PASS         product.equality: product 168266dbfe7f2de091d998431bd56ce4dba0dbb5 == candidate 168266dbfe7f2de091d998431bd56ce4dba0dbb5 on every product path (exit 0)
PASS         product.judges.tests/world-factory/a5sf-acceptance-preflight.test.mjs: c437984e801318ebbcca6b6720d7bd72e12de62e
PASS         product.judges.tests/world-factory/a5sf-ask-precedence.test.mjs: 09cfc964ea73ec2e0b195aa97a198add98bea294
PASS         product.judges.tests/world-factory/a5sf-assembly.test.mjs: 8deea9fca1900d3753790152c3fd64725bef887e
PASS         product.judges.tests/world-factory/a5sf-bash.test.mjs: 4687ad7ac0daa73d8e8fd9ee01e61d5556325881
PASS         product.judges.tests/world-factory/a5sf-bl42-netdeny.test.mjs: 7c1544c7a551dfcc51904b85ace7a4b19d609648
PASS         product.judges.tests/world-factory/a5sf-capability-defaults.test.mjs: 15055b46a03b13f2899ecdae316180ff1662c110
PASS         product.judges.tests/world-factory/a5sf-debt-register.test.mjs: 4bfe4dbbf9aae50f93c485f2d3914efb16592a93
PASS         product.judges.tests/world-factory/a5sf-dev-live-slots.test.mjs: d45252d7020e05f3bd7f570ef728cea746a42ef4
PASS         product.judges.tests/world-factory/a5sf-dev-live.test.mjs: 1535f7994a46928f013b56991ffc798981140696
PASS         product.judges.tests/world-factory/a5sf-dual-plane.test.mjs: 8463f9055c7986386d1fba032883c01c41161d6e
PASS         product.judges.tests/world-factory/a5sf-evidence.test.mjs: 224e0b4579105cafc04e3f0cfefe57c4dd60c877
PASS         product.judges.tests/world-factory/a5sf-f1-ctx.test.mjs: d30ff649dea2c456da422cdf7f4ed9aa43b98fef
PASS         product.judges.tests/world-factory/a5sf-fs-contract.test.mjs: 90d16e02a55d41bf22d3450edd1e92519be22999
PASS         product.judges.tests/world-factory/a5sf-governed-preset.test.mjs: 39ce3e79439b3fe9733cef660346198d9fccea9d
PASS         product.judges.tests/world-factory/a5sf-harness.test.mjs: 2b9fa70b49fd719f5f50e60e81ffcd4ba787190d
PASS         product.judges.tests/world-factory/a5sf-instrument-graph.test.mjs: 161075df14c8b2a786947e86af1e3625b636b86d
PASS         product.judges.tests/world-factory/a5sf-native-route-c.test.mjs: 3d1c32a022db62e2c7c26689932bafa192d5c5d9
PASS         product.judges.tests/world-factory/a5sf-p2-seam.test.mjs: 0740c3cf2b5aba313d4022d2505450def076a19c
PASS         product.judges.tests/world-factory/a5sf-p2-wiring.test.mjs: caaa64c4b4dd1c82088802ac9cdbbb5a8e26df3d
PASS         product.judges.tests/world-factory/a5sf-pd1-revocation-escape.test.mjs: 149cde96b14b04d2d2e748c7059f56dfaf38efcc
PASS         product.judges.tests/world-factory/a5sf-pd12-bash-governance.test.mjs: d82d4da110d5acf85680445b00dda96dc3c63ad9
PASS         product.judges.tests/world-factory/a5sf-pd13-terminal-read-axis.test.mjs: 0d4e2727d02f16620fb350759baf677df1e957a2
PASS         product.judges.tests/world-factory/a5sf-pd14-sandbox-root.test.mjs: 08185eac9dacdf30260411b8d2630d53c0fbef90
PASS         product.judges.tests/world-factory/a5sf-pd15-face-bound-proof.test.mjs: 66c1ee966d7b681497f03a52e1bf21f11305757e
PASS         product.judges.tests/world-factory/a5sf-pd16-search-read-axis.test.mjs: 8c425acc92604609979e909da646f0d350706da0
PASS         product.judges.tests/world-factory/a5sf-pd17-fs-read-axis.test.mjs: 6dc56f32ca6bc3916e7d770382392223c2595d3d
PASS         product.judges.tests/world-factory/a5sf-pd18-web-ptc.test.mjs: 9be5d013bd48ceea52f8e7ded83c8e9def4bb5e3
PASS         product.judges.tests/world-factory/a5sf-pd19-fact-attribution.test.mjs: efc796360f4e1a7f4466d449421db838fb451a0b
PASS         product.judges.tests/world-factory/a5sf-pd21-mutation-controls.mjs: a638199820936f788f5a95b32276188436865097
PASS         product.judges.tests/world-factory/a5sf-pd21-subagent.test.mjs: e8c726722630ab4375e296cc91550f8df3f6a404
PASS         product.judges.tests/world-factory/a5sf-pd23-control-surface.test.mjs: 50bba944b3363dc1550dd3f7325c5c1e3343d913
PASS         product.judges.tests/world-factory/a5sf-pd23-mutation-controls.mjs: 0f715a7b7af5a15048b19a0ce3ad2c06da35ad9e
PASS         product.judges.tests/world-factory/a5sf-pd24-mutation-controls.mjs: 93d4d2f0fcae1afd2af902a92fcafd0793620986
PASS         product.judges.tests/world-factory/a5sf-pd24-surface-ledger.test.mjs: 59186368390ee0e8bc51a230051318317d2603de
PASS         product.judges.tests/world-factory/a5sf-pd25-mutation-controls.mjs: cc9b17d5c4125013e0c04487eee03cba363f9ad7
PASS         product.judges.tests/world-factory/a5sf-pd25-unbounded-turn.test.mjs: faff3371a058627329f0406e1ad6cf405d85c25d
PASS         product.judges.tests/world-factory/a5sf-pd26-confined-skill.test.mjs: bdf4793594e96e61059cfea141b91ce8289ebc5d
PASS         product.judges.tests/world-factory/a5sf-pd26-mutation-controls.mjs: 757cf22515a3af8dd95a3b8358263afb6c83363d
PASS         product.judges.tests/world-factory/a5sf-pd27-confined-web.test.mjs: 4682bf0000d8a4fcc48ee5ad015aaa111700c334
PASS         product.judges.tests/world-factory/a5sf-pd27-mutation-controls.mjs: ae535177c56ffeec5cca5e6a338247c6ab699102
PASS         product.judges.tests/world-factory/a5sf-pd29-goal-stop.test.mjs: 1417e71be3825c477b5631fbc1f15a1fed5b8e2b
PASS         product.judges.tests/world-factory/a5sf-pd29-mutation-controls.mjs: d7db1bdd93dc60436c7a321f7a78530d187b9acd
PASS         product.judges.tests/world-factory/a5sf-pd29-service-seam.test.mjs: 7408a2f1a0d99ddc684d148ad1d6116a1453c162
PASS         product.judges.tests/world-factory/a5sf-pd30-mutation-controls.mjs: 2b79c8ce6c626f0c1193b51e0ff2aaa04fe89838
PASS         product.judges.tests/world-factory/a5sf-pd30-web-preview.test.mjs: ec70f99eb70bed9cb80157fe14c8856f2552d81e
PASS         product.judges.tests/world-factory/a5sf-pd31-read-image.test.mjs: f874d778151fd1f705af6b81e8510a794fcffc15
PASS         product.judges.tests/world-factory/a5sf-pd33-preview-e2e.test.mjs: f7163367e63558250ad9dec7185ffbeba7e33c41
PASS         product.judges.tests/world-factory/a5sf-pd34-member-stop.test.mjs: cd9bd31b4800af62a33fffdc7d80da5acaaeb945
PASS         product.judges.tests/world-factory/a5sf-product-assembly.test.mjs: d5b21bcef432b5816e9c41e3188b4386cd89b9ac
PASS         product.judges.tests/world-factory/a5sf-pty-contract.test.mjs: 63b043d91be5a190352ee3e8f9393155a1400e1f
PASS         product.judges.tests/world-factory/a5sf-read-gate.test.mjs: cea06f870e7233639491c76188444ef5202ab223
PASS         product.judges.tests/world-factory/a5sf-run-record-binding.test.mjs: 212ef8249fc62fe1bfffd539db74ec112da97920
PASS         product.judges.tests/world-factory/a5sf-search-live.test.mjs: 60ad0b3df0ccb362c49c623f2b4e82e5dea250cb
PASS         product.judges.tests/world-factory/a5sf-sub-contract.test.mjs: 0ba0bc952d131d7f17278a8a0971888f77d1ed9f
PASS         product.judges.tests/world-factory/a5sf-tool-axis.test.mjs: bcae6b35239ad7ebfc05dd725b72805a5b40e0e3
PASS         product.judges.tests/world-factory/a5sf-web-contract.test.mjs: b6c82f50b979abf8e44d3636173d5e91ab030261
PASS         product.judges.tests/world-factory/a5sf-web-row.test.mjs: 805326ec133aca354fa0b3244f204f918b142cc8
PASS         product.judges.tests/world-factory/a5sf-web.test.mjs: 4ca6093ded39d32866fd0c92f851eb98bfa98a2e
PASS         product.judges.tests/world-factory/a5sf-window-taxonomy.test.mjs: 8a7b7a8039055680a310750822e02809905f54a1
PASS         product.judges.tests/world-factory/drivers/a5sf-live-member/run-boot.mjs: 7e877e3c65bca2e7c92cb95bfdea97ea32b64d4e
PASS         product.judges.tests/world-factory/drivers/a5sf-pd18-web-ptc/run-boot.mjs: 23bbf75fc9cc00897bd268f37166bb6a6cdac99c
PASS         product.judges.tests/world-factory/drivers/a5sf-pd21-subagent/run-boot.mjs: f1e7d4b50ae478c457ae57ff61196738bb6db445
PASS         product.judges.tests/world-factory/drivers/a5sf-pd23-control-surface/run-boot.mjs: 65fdf433d8eb5863f679e1ad5a152ec6c4c41577
PASS         product.judges.tests/world-factory/drivers/a5sf-pd24-surface-ledger/build-ledger.mjs: 1d234167bcb0937724da8d307fcfd9a3fc850767
PASS         product.judges.tests/world-factory/drivers/a5sf-pd24-surface-ledger/run-boot.mjs: a1c5602b34b11185f2c1943e9f40a4b2a1b06ff6
PASS         product.judges.tests/world-factory/drivers/a5sf-pd25-unbounded-turn/run-boot.mjs: 532191c1d644f9919826a5a0cfd0eed9a109c5be
PASS         product.judges.tests/world-factory/drivers/a5sf-pd26-confined-skill/run-boot.mjs: d5d3d85726cb9fd52f20fa33270caecd953e5981
PASS         product.judges.tests/world-factory/drivers/a5sf-pd27-web-egress/pd27-web-offer-row.mjs: fb6f781e9214db3cfd0e2ac448a48f45957a13e9
PASS         product.judges.tests/world-factory/drivers/a5sf-pd27-web-egress/run-boot.mjs: 80e32a24876e8457277c6979cf204bd32f1e16f0
PASS         product.judges.tests/world-factory/drivers/a5sf-pd29-goal-stop/run-boot.mjs: d134a59ce4de8e757b359ea0f69dba479989cd75
PASS         product.judges.tests/world-factory/drivers/a5sf-pd29-service-seam/run-boot.mjs: 419f5d37639c39adb3f13154c2da8d73ce3772c7
PASS         product.judges.tests/world-factory/drivers/a5sf-pd30-web-preview/pd30-base-web-tripwire.mjs: 9aaceaae5901cb505437ac3bff74bd3f1cb3b7ec
PASS         product.judges.tests/world-factory/drivers/a5sf-pd30-web-preview/run-boot.mjs: f998878324e3d124a3fc6f741487badf0893ae13
PASS         product.judges.tests/world-factory/drivers/a5sf-pd31-read-image/run-boot.mjs: 431b29e31f92acba06b9e0b1b6fa8dc12ac64ff8
PASS         product.judges.tests/world-factory/drivers/a5sf-pd33-preview-e2e/pd33-base-web-tripwire.mjs: 4aa2fa001e18557c7f07c4246cbe59ed4bf79c4b
PASS         product.judges.tests/world-factory/drivers/a5sf-pd33-preview-e2e/run-boot.mjs: 85bf2d3d2a17e398d0fd0e9a665660196a86f95d
PASS         product.judges.tests/world-factory/drivers/a5sf-pd34-member-stop/run-boot.mjs: e52dcd488a8c7a55a07b7e802030e467bba6755f
PASS         product.judges.tests/world-factory/lib/a5sf-acceptance-preflight.mjs: 0e34f0fe6f246e933922ef1f681cb527039844fb
PASS         product.judges.tests/world-factory/lib/a5sf-bash-arms.mjs: 0cce7b9cf9e0e023a3b4627ebe32e92540f8bd18
PASS         product.judges.tests/world-factory/lib/a5sf-dual-plane-oracle.mjs: 9f4d6cd86e866a8d1cac63ee795d27b9939b96d3
PASS         product.judges.tests/world-factory/lib/a5sf-dual-plane.mjs: fa686f8152dc479c4c12ede4c9e361d8b08db8c4
PASS         product.judges.tests/world-factory/lib/a5sf-evidence.mjs: 914c90c30ad108c2e21deb246110e6f1ba7e6ef1
PASS         product.judges.tests/world-factory/lib/a5sf-fs-contract-world.mjs: 216a808f89ca979bfc4d0189082af46ed5202316
PASS         product.judges.tests/world-factory/lib/a5sf-harness.mjs: 89c48955008faa59b0f5ae9c30b2eb2bbd260379
PASS         product.judges.tests/world-factory/lib/a5sf-pty-contract-world.mjs: 8573c826b02e04b5f942fbb47aafe4f2fdbe09f0
PASS         product.judges.tests/world-factory/lib/a5sf-search-live.mjs: e386ab796116c39525063da2fc31a712a02a12b4
PASS         product.judges.tests/world-factory/lib/a5sf-sub-contract-world.mjs: ea084394b6b3fbd38e330ce64f2f5bd346fd8bb0
PASS         product.judges.tests/world-factory/lib/a5sf-web-arms.mjs: 1bd3393271fb7273b764286d3d2e36b5b066ede7
PASS         product.judges.tests/world-factory/lib/a5sf-web-contract-world.mjs: e30067a739815e9bf9111fa7403e4a39429d6fd4
PASS         product.judges.tests/world-factory/lib/acceptance-claim.mjs: 1eadf27f211a1401efad23bb87ab39086f1b2acd
PASS         product.judges.tests/world-factory/lib/arm-verdict.mjs: 4fe4d48d1d3d674f765a4048a24eb22707ff1e0b
PASS         product.judges.tests/world-factory/lib/binding-digests.mjs: 9f3176d3e3f73aaa5c518d2c9146f8008d0e944a
PASS         product.judges.tests/world-factory/lib/dev-live-slots.mjs: 374c5e40d3463c7330a06f611750512a02974a1c
PASS         product.judges.tests/world-factory/lib/host-sandbox-assets-manifest.json: a68a6302f4c1305a5b0778fdc791d06f562090a7
PASS         product.judges.tests/world-factory/lib/host-sandbox-assets.mjs: 5242f221907d50dca486008ce71f9c417717c62a
PASS         product.judges.tests/world-factory/lib/mock-script.mjs: d8a15bf076b1f8e43487cf248736514c29d176d4
PASS         product.judges.tests/world-factory/lib/oracle.mjs: 237c165473ac46e93b4772054d62ced6cfc4c21b
PASS         product.judges.tests/world-factory/lib/port-lease.mjs: fc940cf9e988c5184e51a4bd36fb748e250ae9d8
PASS         product.judges.tests/world-factory/lib/profile-module-graph.mjs: 0c8b7e365a048d1e19b4d14bef2afd7530ea7f35
PASS         product.judges.tests/world-factory/lib/run-record.mjs: b955b69ca51cd748f666644b9bbe4b58b391096a
PASS         product.judges.tests/world-factory/lib/suites.mjs: 74797d51ab28872a70961e353301811cc7356590
PASS         product.judges.tests/world-factory/lib/team-workspace.mjs: 3d0b55d434d3ede7d78bd780bba7fb628f049126
PASS         product.judges.tests/world-factory/lib/u6-arc-a-assembly.mjs: d922cfaaac347993bd8bc366b5b2ded14965c9de
PASS         product.judges.tests/world-factory/lib/u6-arc-d-assembly.mjs: 21321216f0d135d1e069e74703b09ff87c7cb404
PASS         product.judges.tests/world-factory/lib/u6-fs-assembly.mjs: 3ecbadc12fdda214cb26244015a7473eefa4db40
PASS         product.judges.tests/world-factory/lib/u6-jobs-assembly.mjs: 8294ed36ad7ae58af1e28ed0e13a07fae97bcdee
PASS         product.judges.tests/world-factory/lib/u6-proc-assembly.mjs: 9d8609ce5fd5f59d5a09b4e819d037fa986fbb5c
PASS         product.judges.tests/world-factory/lib/u7-census-assembly.mjs: 9381e161a65025f495986d049546aaa4c178a147
PASS         product.judges.tests/world-factory/lib/u7-fsmut-assembly.mjs: 5cc6227fda808f45642973c89b4035ec80b183fc
PASS         product.judges.tests/world-factory/lib/u7-fui-assembly.mjs: c64d18a59e65dac198e8600f26a6f522c73dd9e3
PASS         product.judges.tests/world-factory/lib/u7-pwsh-assembly.mjs: dff522913b52267936e83ae7ae75431caff0e5d1
PASS         product.judges.tests/world-factory/lib/u7-tbash-assembly.mjs: be368a6142f196caa590e4b66fcb50b7a6ce8b85
PASS         product.judges.tests/world-factory/lib/u7-uileg0-answer.mjs: 3032d243a81433d7f7006173e3288fc8be3371a4
PASS         product.judges.tests/world-factory/lib/u74a-jobs-assembly.mjs: dacd800de79243b9ecb3665d69b20842cc64808e
PASS         product.judges.tests/world-factory/lib/u7astore-assembly.mjs: 609b1dad9d225a4d0518a5c68a47ace160566b09
PASS         product.judges.tests/world-factory/lib/u7f-web-assembly.mjs: b2ca2bddec2f541811a0d05964ea07970260bed7
PASS         product.judges.tests/world-factory/lib/u7fa-assembly.mjs: 2384dd0870031566b3adf6c69f8779b328356b4a
PASS         product.judges.tests/world-factory/lib/u7fagentb-assembly.mjs: 618321f9adcfb1a9ef522b28035ebd0368ca69b6
PASS         product.judges.tests/world-factory/lib/u7r3-uif4-answer.mjs: 55fa598ae4bb823c76d23b76fa45283a71fbe473
PASS         product.judges.tests/world-factory/lib/u7r3-uif4-assembly.mjs: b2823997d30a5cb7c5fb4d8a8884b4f2225f5ee1
PASS         product.judges.tests/world-factory/lib/world-factory.mjs: 56fb4cbd7e07606e535524457beae9f8e1ec69cb
PASS         product.judges.tests/world-factory/lib/world-kinds.mjs: 76b49f22dd88252da9910cbf5f5db91523c0fa28
PASS         product.judges.coverage: all 122 judge/driver files at 168266dbfe7f2de091d998431bd56ce4dba0dbb5 are pinned
PASS         authority.pointer: dev/engineering/current-authority.json
PASS         authority.snapshot_version: as20261109r1
PASS         authority.content_digest: sha256:d85fdc1a78f055dc460799a6ff560daab541d0d7f96bb48294ff3dee76a398b3
PASS         authority.snapshot_baseline: cb2e41483af8447700fb3c2a25c2686705320692
PASS         dependencies.host_baseline_version: 0.2.0-rc.2
PASS         dependencies.host_sha: 639ed015397290b3745d163aafe02ffee4aa3f84
PASS         dependencies.lockfile_tree: 93f4f1dde45d4f965a354272b9a10f89363d8c50
PASS         dependencies.package_json_tree: f9ab4bc9ae3a7039ceca9d64f0280473cfeb9f1f
PASS         dependencies.host_checkout: tests/deepseek-harness-test-use is absent (gitignored); the pin is verified from tests/paths.mjs at the candidate commit, which is the single source of truth for it
PASS         ancestry.candidate_is_ancestor_of_origin_master: live merge-base --is-ancestor 168266dbfe7f2de091d998431bd56ce4dba0dbb5 refs/remotes/origin/master => true (exit 0)
PASS         ancestry.product_is_ancestor_of_candidate: live merge-base --is-ancestor 168266dbfe7f2de091d998431bd56ce4dba0dbb5 168266dbfe7f2de091d998431bd56ce4dba0dbb5 => true (exit 0)
PASS         evidence.../c2/dev/agent-workflow/evidence/c2-adjudication/records/C2-A.json: runId=c2-a-2026-11-10T15-57-16Z recordClass=CANDIDATE-C2 eligible=false candidateCommit=168266dbfe7f2de091d998431bd56ce4dba0dbb5 — no candidate claim, preserved reference only
PASS         evidence.../c2/dev/agent-workflow/evidence/c2-adjudication/records/C2-B.json: runId=c2-b-2026-11-10T15-57-52Z recordClass=CANDIDATE-C2 eligible=false candidateCommit=168266dbfe7f2de091d998431bd56ce4dba0dbb5 — no candidate claim, preserved reference only
VERIFIED cand-v0.1.6-1 @ 168266dbfe7f2de091d998431bd56ce4dba0dbb5 — PASS=146
```


## 7. What I could not establish

1. **A clean lane-level negative for `write` and `edit`.** Both refusals are real
   (`diskUnchanged`, no file change) but their locus is the host read-before-write
   observation policy (`guardFacts:0` for edit; the write row's own `observed` text is the
   read-before-write error). They do not exercise the Alpha.5 lane algebra. On this
   instrument the write/edit minimal-permission bound is **not** established, only the
   end-to-end refusal.
2. **The Officer deny path as a human decision.** The deny prompt's tool ask is answered
   `permission denied … answered deny from the fallback` before any durable
   `control-request-recorded` row exists, in both boots. I can state that the candidate, as
   instrumented by the shipped A6 kit, does not reach the approval plane for that ask. I
   cannot state that a human `deny` on a durable request is broken — the precondition never
   existed. Likewise A6-29 (post-consumption throw) is unmeasured, not refuted.
3. **The exact A6-on ∧ governed conjunction for Goal authorisation.** No shipped instrument
   composes `alpha6ReviewRouting: true` with `create_goal` on the governed preset. I measured
   the A5-governed goal convergence (pd33, A6 off) and the A6-on human-attribution leg
   (A6-27), but not `create_goal` under A6 on. The `RuntimeRoot ∧ SourceKindUser` rule is
   therefore evidenced in two halves, not as one joint case.
4. **`read_image`** — the model declares no image input, so the route is typed-refused
   (`NOT_REACHED`); outside the six C2-A tools, not counted.
5. **Attribution of the A6 differences to a product change.** The v016-acceptance evidence
   that shows A6-12/A6-22/A6-28 passing was measured on `c66fa8b03` (integration/v0.1.6),
   which is **not an ancestor** of the frozen candidate. The only source-level delta I can
   see between that tree and the candidate on the plugin path is the a56 input-provenance
   law (`input-provenance.mjs`, `agent-bindings.mjs`, `root.ts` comment) — but I did not
   bisect, and I did not run c66fa8b03 myself. **I do not claim a regression**; I claim only
   what the frozen SHA did in these ten runs.
6. **`tests/world-factory/lib/oracle.mjs` as a live oracle.** Not applicable to the three
   drivers' Worlds (different evidence layout; Worlds torn down by identity). I read the
   same three channels directly and cite them per case; an independent re-boot of one World
   with `oracle.mjs` attached was not performed.

## 8. What a reader should not conclude

- **"C2-A PASS means the candidate is releasable."** C2-A is one scope on one preset with
  Alpha.6 off; it says nothing about the approval plane, and A4/A6 are partial. Candidate
  PASS ≠ master PASS ≠ V@B=yes.
- **"C2-B FAIL means the Alpha.6 plane is wholly broken."** The allow path, single
  consumption/execution and cold recovery passed in both boots. The failures are specific:
  the deny ask never reaches a durable request, Sticky Stop writes no durable marker, and
  Stop-vs-consumption is a race.
- **"The deny failures are a product denial bug."** They are a measurement-precondition
  failure: no durable request exists to deny. The same sentence applies to A6-29.
- **"A6-26 FAIL is a new defect."** It is the documented D11/§5 abandonment,
  reproduced twice; the kit's PASS predicate deliberately excludes it.
- **"The Sticky Stop failures contradict the release notes."** Release note §4.7 already
  documents the latch-scoped marker (no coordinator ⇒ no marker). These boots are consistent
  with that limit; they do not add a new claim about its severity, only that the shipped
  kit's A6-22/23/24/26/27 all fail on the frozen SHA.
- **"The records are candidate evidence because they say CANDIDATE-C2."** They are my
  adjudication records; the subordinate driver records are `DEV-LIVE` and are cited as raw
  artefacts, never fed to the verifier as candidate records.

## 9. Deliverables in this directory

- `README.md` — this report.
- `agreement/C2-A.json`, `agreement/C2-B.json` — per-scope, per-case two-boot agreement.
- `records/C2-A.json`, `records/C2-B.json` — the `CANDIDATE-C2` records (bindings,
  per-case verdicts, evidence paths, oracle statements, falsifiers).
- `c2a-pd33-e2e-pair/`, `c2a-fs-boot1/`, `c2a-fs-boot2/`, `c2b-a6-*/` — raw driver artefacts
  (case tables, guard facts, ledgers, run logs). Ephemeral bearer tokens in host logs were
  redacted to `<redacted>`; `tests/homes/` is empty (every World torn down by identity).

## 10. Signature

I am an independent adjudicator for `CANDIDATE-C2`. I did **not** author, modify, build or
merge any product code (`packages/**`, `scripts/**`, `.github/workflows/**`) for this
candidate, did not move the Authority pointer or the candidate ref, and did not merge
anything. I ran tracked instruments (plus byte-identical relocated copies for the FS driver)
from the measurement worktree `.worktrees/c2` at the frozen commit, with at most two boots
concurrent, and I report the two-boot disagreements rather than averaging them.

Signed: DSH independent C2 adjudicator, session `c2-adjudication-20261109`, 2026-11-10.

## 11. Update 2026-11-10 (revision 2) — corrected deny invocation and the A6-12 distribution

Appended after PR review; §2–§10 are **not** rewritten. This section supersedes exactly:
**§3 B3** (officer deny), **§3 B4** (post-consumption throw), **§3 B6** (Stop), the A6-12
bullet in **§4**, and the two deny-related bullets in **§8**. Everything else (allow, single
execution, cold recovery, Sticky Stop, A6-26, Goal authorisation) stands unchanged.

### 11.1 The deny arm is PASS — my earlier invocation was incomplete

The earlier `A6-28`/`A6-29` failure was **an incomplete recorded invocation, not the product and
not flakiness**. In the kit, the Officer template's `permissions.ask: [bash any]` rule and the
Officer member-envelope `request-control` admission are emitted only when
`A6_EXTRA = C1_A6_RECIPIENTS || C1_A6_HANDOFF` (`c1-leader-approval-smoke.mjs:330`,
`:817-819`, `:833-843`). Without that flag the Officer's bash is `default: deny` with
`ask: []`, so the static fallback answers before any approval lane exists and `request=none` is
structurally guaranteed. I reproduced the flags **as recorded** in
`dev/agent-workflow/evidence/v016-acceptance/README.md:45` (`C1_A6_EXEC_NEG=1` only); that
recorded column is incomplete — the acceptance deny boots did carry the flag (their `A6-7` is
recipient-gated). The independent diagnosis
(`dev/agent-workflow/evidence/a6-deny-diagnosis/`, commit `c92b7b9cf`, PR #708) ran the 2×2 on
`c66fa8b03` and `168266dbf`: FAIL without the flag and PASS with it on **both** trees, so the
candidate delta is not the cause.

Corrected invocation: `C1_ALPHA6_OFFICER=1 C1_PLANE_TAKEOVER=1 C1_A6_EXEC_NEG=1
C1_A6_RECIPIENTS=1`. Two fresh boots on `168266dbf` / `639ed015…`, both `EXIT=0`, both
**10/10 checks PASS**, each with four `admission-requires-approval` events (the same count as
the recorded acceptance boot):

| check | `c2b-a6-denyfix-r1` | `c2b-a6-denyfix-r2` |
| --- | --- | --- |
| A6-28 | PASS `request=ctrl-0h0jf3d1nmbzde0p3zjwf19f decision=deny consumed=false execFacts=0 file=false done=true` | PASS `request=ctrl-06pc7ad0inarny11ylrgf0n4 decision=deny consumed=false execFacts=0 file=false done=true` |
| A6-29 | PASS `request=ctrl-1kji77e1kdhh791c3ag1k1n1 consumed=true execFacts=failed` (`…hexec:22fa3339-…-2`) | PASS `request=ctrl-02oml390nrka3q06l3gj70hs consumed=true execFacts=failed` (`…hexec:2f03be29-…-2`) |
| A6-7 | PASS `selfReq=ctrl-1bgnr7s1akeqrz1nqoaju1qb leaderDecided=true executed=true` | PASS `selfReq=ctrl-1oaw7c61lij3r11cxznwg1sx leaderDecided=true executed=true` |

The deny leg records a durable request, a durable `deny` decision, **zero** consumption, **zero**
execution facts and no effect file; the throw leg records exactly one terminal `failed`
execution-result after a real consumption, never `succeeded`. **B3 and B4 are therefore PASS**
on the corrected invocation, and the earlier `FAIL` lines are withdrawn as measurement error
(the diagnosis was right; the record must now say the arm passes when invoked as the acceptance
invoked it).

### 11.2 A6-12 over six boots — a product race between the Stop ack and consumption

Four fresh boots (`r3`–`r6`) plus the original `r1`/`r2`; same kit, same flags, sequential
(`r3` ran with no other boot). The late allow is **rejected with
`CONTROL_REQUEST_DECIDED` in 6/6 boots**, so the "second allow is rejected as already decided"
half is satisfied everywhere; the kit's `!revived` predicate fails only when a consumption fact
exists for the pre-Stop allow.

| run | A6-11 | late allow | consumption for the human leg | effect file | A6-12 |
| --- | --- | --- | --- | --- | --- |
| r1 | PASS | 200 `CONTROL_REQUEST_DECIDED` | **yes** (seq 15, +83 ms) | `""` | FAIL |
| r2 | PASS | 200 `CONTROL_REQUEST_DECIDED` | no | `""` | PASS |
| r3 | PASS | 200 `CONTROL_REQUEST_DECIDED` | **yes** (seq 15, +81 ms) | `""` | FAIL |
| r4 | PASS | 200 `CONTROL_REQUEST_DECIDED` | no | `""` | PASS |
| r5 | PASS | 200 `CONTROL_REQUEST_DECIDED` | **yes** (seq 15, +83 ms) | `""` | FAIL |
| r6 | PASS | 200 `CONTROL_REQUEST_DECIDED` | **yes** (seq 15, +83 ms) | `""` | FAIL |

**Distribution over the four fresh runs: 3 FAIL / 1 PASS; over all six: 4 consumed / 2 not
consumed (67% consumed).** The consumption fact lands ~83–110 ms after the allow decision. The
kit issues the cancel immediately after resolving the human allow and then waits 2.5 s, so the
block's own fixed waits put the cancel at `checkTime − 5 s` — i.e. the consumption and the cancel
land in the **same ~10 ms**. What the disagreement is a race *between* is the **Stop/cancel
acknowledgement** and the **consume-and-execute step of the allow that preceded it**: in 4/6
boots that step had already run (or was not fenced) when the Stop arrived; in 2/6 it had not.
No side effect was observed in any of the six (`file=""`), so execution was prevented even when
consumption was recorded. This is a genuine product Stop-semantics finding — a ~100 ms window in
which a human Stop cannot prevent consumption of an allow that precedes it — and it is recorded
as such, with the observed rate, not averaged and not called "flaky".

### 11.3 Corrected C2-B table (supersedes §3 B3/B4/B6)

| arm | verdict | decisive line | boots |
| --- | --- | --- | --- |
| Officer allow | PASS | `A6-2 wakes=3 requests=17/16`, `A6-4` effect file, `A6-5 leaderWakes=0` | 2/2 (`allowdeny-r1`, `r1b`) |
| single consumption + single execution | PASS | `A6-6 requests=2 decisions=2 consumptions=2 pending=`, `A6-27 outcome=succeeded facts=1` | 2/2 |
| **Officer deny** | **PASS** (corrected invocation) | `A6-28 request=ctrl-0h0jf3d1nmbzde0p3zjwf19f decision=deny consumed=false execFacts=0 file=false` | 2/2 (`denyfix-r1/r2`), 10/10 each |
| **post-consumption throw** | **PASS** (corrected invocation) | `A6-29 request=ctrl-1kji77e1kdhh791c3ag1k1n1 consumed=true execFacts=failed` | 2/2 (`denyfix-r1/r2`) |
| **Stop** | **FAIL as a race** (4/6 consumed, no side effect) | `A6-11 PASS 6/6`; `A6-12 consumed=true` in r1/r3/r5/r6, `consumed=false` in r2/r4; late allow `CONTROL_REQUEST_DECIDED` 6/6 | 6 boots |
| Sticky Stop | FAIL — documented limit, no durable marker | `A6-22/23/24/26/27 markers=` | 2/2 |
| cold recovery after SIGKILL | PASS | `A6-13 restart=ok consumed=false file=false`, `A6-14 abandon=invocation-abandoned` | 2/2 |
| A6-26 accepted-not-claimed | REPRODUCED-AS-DOCUMENTED | `verdict=abandoned-terminal recoveryCode=CONTROL_REQUEST_ABANDONED discoverable=true abandoned=1` | 2/2 |
| Goal authorisation | NOT ESTABLISHED for the exact A6-on conjunction | pd33 `rounds=3 finalPhase=complete`; `A6-27 outcome=succeeded` | 2+2 |

**C2-B overall remains NOT PASS**, but no longer because of the deny arm: the remaining grounds
are the A6-12 Stop consumption race (4/6), Sticky Stop writing no durable marker (both boots;
documented §4.7 limit), and the exact A6-on ∧ governed Goal-authorisation conjunction having no
shipped instrument. The records still do not assert `candidateClaimEligibility.eligible=true`
because not every arm in this table is a pass.

Re-run verifier after this revision: `exit 0`, `PASS=146` (records unchanged in class/binding;
`verifier-output.txt` regenerated below).

## 12. Update 2026-11-11 — instrument state (the kit needs `C1_PLANE_TAKEOVER=1`)

Asked to say whether the stop arm still boots and what state the instrument needs. It does; the
requirement is **`C1_PLANE_TAKEOVER=1`**, not `node_modules` and not the tree.

A run that omits it fails before any A6 case:

```
PASS L0 … saved blueprints X + Y + Z written (deny list = 0 names)
FAIL A6-1: … MALFORMED_DTO "blueprint not found in catalog: team.c1-a6-officer"
```

That is not a catalog or module-resolution fault. The base YAML emitter's worker `deny` block
(`tests/kits/c1-leader-approval-smoke/c1-leader-approval-smoke.mjs:747-752`) indents the
`resource:` key of its `- tool: read` item at 10 spaces instead of 12 **in the
`PLANE_TAKEOVER=false` branch only**, so `c1-x/y/z.yaml` and `c1-a6.yaml` are invalid YAML and the
saved-source index classifies every one of them `rejected` (`yaml-invalid`, "All mapping items
must start at the same column"); the anchor alone parses, and every `team.create` reports
`blueprint-not-found`. Verified with the tree's own index:

```
c1-a6.yaml {"status":"rejected","diagnostics":[{"reason":"yaml-invalid", … "line 79"}]}
c1-anchor.yaml {"status":"ok","identity":{… "team.c1-anchor" …}}
```

Exact working invocation (candidate worktree; `node_modules` absent; `--keep` optional):

```
C1_ALPHA6_OFFICER=1 C1_PLANE_TAKEOVER=1 C1_A6_STOP=1 \
  node tests/kits/c1-leader-approval-smoke/c1-leader-approval-smoke.mjs \
  --worktree <tree> --testuse <repo>/tests/deepseek-harness-test-use \
  --host-port 1302x --mock-port 1307x --evidence-dir <dir>
```

`PLANE_TAKEOVER` also sets the leader/worker `permissions.deny` to `[]`, which is the shape the
recorded acceptance boots used. One missing-flag run and one corrected run are kept in
`instrument-2026-11-11/`. This is a kit defect, not a product one; the
two-character fix is `'            resource:'` at line 750. It is reported here, not patched —
the kit is tracked test infrastructure and its owner should decide.
