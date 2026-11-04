# a5sf-search-live — the live half of P2-03 / BL-16 (`grep`), the six-row search acceptance

**Status (2026-11-05, second re-grant): FOUR OF SIX ROWS ARE JUDGED PASS.** The owner
granted 4 further boots (pool 10, 9 spent, 1 unspent). Rows **2, 3, 5 and 4 PASS** live;
row **1 REFUTED with bytes** (`rg` reads the repo's ancestor `.git`, is refused by the
ceiling and exits 2); row **6 FAIL** on a real question (an archived member's tool route
still executes and spawns). `M-06` stays `ENFORCE-PARTIAL` — now with four measured
clauses and one refuted clause — and `M-07`'s two glob arms are PROVEN live for the first
time. Nothing is promoted in the matrix: that file is the owner's.

| attempt | when | port | got to | died at |
|---|---|---|---|---|
| 1 | 15:36:59–15:39:18Z | 3183 | Host booted, authenticated, health never answered | **composition** — the driver emitted the four World rows but never gave them to the World |
| 2 | 15:56:53–16:00:00Z | 3182 | composition verified, health 200 in 3 s, surface 24 tools, negative control ran | **team-create** — the product's permission coverage gate refused `grep`/`glob` on the leader |
| 3 | 17:04:45–17:05:05Z | 3183 | composition verified, health 200 in 0.3 s, **the control's `rg` launched** | **killed** — the driver's own process group, 230 ms after the discovery turn |
| 4 | 18:51:35–18:55:58Z | 3184 | probe artifact + control + `team.create` ok | **member-install** — the search module was mounted with an empty config |
| 5 | 18:58:10–19:05:32Z | 3184 | control **PROVEN** (leak), `team.create` ok, delegate answer captured | **member-install** — `SERVICE_MOUNT_FAILED … $.sampleOverCapGlobResults missing` |
| 6 | 19:07:58–19:17:21Z | 3184 | **member realm installed**, 3 confined spawns, 7 guard facts | **cancellation-window** — the FIFO operand was outside the read lane, refused at admission |
| 7 | 20:01:20–20:07:01Z | 3182 | **rows 2/3/5 judged PASS**; row 1 REFUTED with stderr | completed — row 4 refused by arithmetic, row 6 a finding |
| 8 | 20:10:19–20:15:30Z | 3182 | the cancel was accepted **4 ms** after the FIFO spawned | completed — row 4's three clauses were mis-reads |
| 9 | 20:17:23–20:22:33Z | 3182 | **row 4 PASS** (`CANCELLED_SEARCH_ABORTED_WITH_KILLED_CHILD_NO_RESULT`) | completed — 4 PASS / 2 FAIL |

- base: `origin/master` @ `a2c56fb8457a2729289a6d11ba975ac8eeb0c3a9`
- branch: `task/a5sf-search-live-20261104`; draft PR #588
- pinned host: `tests/deepseek-harness-test-use` @ `639ed015397290b3745d163aafe02ffee4aa3f84`, porcelain empty at each gate
- CORE PATCH BUDGET = 0; `packages/` byte-identical to `origin/master` (asserted host-free)
- budget: `lane-ruling.json` authorises 2 starts, both with a named ruling; the driver and
  `go-no-go.mjs` both refuse a third, and `go-no-go.mjs` currently prints `NO-GO`

## 1. What is proven, and what is not

| | |
|---|---|
| **Proven host-free (0 boots)** | 52 `node:test` arms on the six judges + the partial-run contract (`tests/world-factory/a5sf-search-live.test.mjs`), 59 dry-run checks (`dry-run.mjs`), 14 mutation controls (`negative-controls.mjs`), the `--plan` handoff identity, and the offline re-judgement of attempt 6 (`rejudge-attempt6.mjs`). All green at the commit this file lands on. |
| **Proven live (6 boots)** | The World **composition** carries the rows it is given (attempts 2 and 3: all six `presentRowIds`, `missingRowIds=[]`), the p6t6 health route answers in 0.3–3 s, the anchor preset exposes a **24-tool surface including `grep` and `glob`**, the evidence row's base spawn launches the packaged `rg` (attempt 3), the anchor's **unconfined control leaks both out-of-lane tokens** (attempt 5, PROVEN), and — attempt 6 — the **Member realm installs and serves three confined `rg` processes** plus seven guard facts (§3c). |
| **Measured but not judged: the six rows** | 0/6 judged. Attempt 6 observed the guard facts, spawns and exits for rows 1/2/3/5, then aborted in `cancellation-window`; the result *bytes* were never persisted, so no row has a complete sample (`rejudge-attempt6.json`). The old record's `6/6 FAIL` was a driver-level bulk assignment, not six refutations (§3d); the correct case status is `NOT_REACHED` + `driver-aborted`, and the run is `FAIL` + `partial`. |
| **NOT proven: the negative control** | ~~refuted~~ — **PROVEN** in attempt 5 (§3c): one base spawn, both out-of-lane secrets in the result, zero confined spawns. |
| **Grade that follows** | `grep`/`glob`: `ENFORCE-PARTIAL`, `V@B=no`, `tested` unchanged. The host-free half of BL-16 (`evidence/a5sf-bl16-grep/`) still stands on its own evidence. |

## 2. Attempt 1: a driver defect, and the net that now guards it

The Host booted and authenticated, then `p6t6 health=false hostAlive=true` after
the 120 s poll. The profile it booted from (`attempt-1-composed-profile.patch.yml`)
carried only the base rows. The driver had logged that it built the four rows and
`emitPatchLayer` returned their text, but it never pushed them into the World:
`harness.boot` composes `world.u6Fs.rows`, which was empty. `--plan` was green
because it judged the **emitted text**, not the **handoff**.

Fixed, and the class is guarded in three ways (all required by the retry ruling):

1. `handOverRows(world, rows)` is the single place the rows reach the World;
2. `--plan` runs that same function against a probe and writes `plan-rows.json`
   (`emittedRowIds` vs `worldRowIds`, ordered identity, health-probe row present);
3. `go-no-go.mjs` evaluates the artifact **and** re-reads the source for the call
   before `harness.boot(`, so a gate that cannot see the handoff cannot say GO.

A mutation control rewrites the call to `void rows` and requires the dry run to go
RED on exactly that check, then restores the bytes and verifies the sha256.

## 3. Attempt 2: composition verified, then the coverage gate

```
15:56:53.720Z  boot sequence: 2 of 2 authorised P2-04 start(s) (ledger boot rows=1; rulings:
               1x direct task instruction | 1x coordinator ruling, session-76eeddd5…)
15:56:53.720Z  grant materialised: grant-a5sf-search-098f445f51ee-b2 boundCommit=098f445f51ee…
15:56:55.361Z  mock started on 3491
15:56:58.699Z  composed profile: presentRowIds=[u5-canary,u6-fs-probe-host,a5sf-search-realm,
               dsh-agent-team,p6t6-team-tools,preset-a5sf-search-base] missingRowIds=[]
15:56:58.700Z  BOOTED port=3182
15:56:59.067Z  p6t6 health=true hostAlive=true
15:56:59.088Z  discovery prompt status=200
15:59:59.925Z  NEGATIVE CONTROL: verdict=REFUTED reason=NEGATIVE_CONTROL_CLAUSE_FAILED
               failed=["controlSucceeded","controlLeaked"]
15:59:59.926Z  model-visible surface (24): bash,edit,glob,grep,read,read_image,team_*…,write
16:00:00.021Z  team.create status=200 ok=false
               TEAM_REMOTE_TEAM_CREATE_ROOT_START_FAILED: starting the root (leader) agent for
               'session-a5sf-acceptance-team' failed: permission coverage gate failed for
               instance 'inst-leader': 2 unmanaged tool(s) on the final model-facing surface:
               glob (known-sensitive-unmanaged), grep (known-sens…)
16:00:00.021Z  FAILURE at stage team-create (team.create must accept the main blueprint …)
16:00:00.115Z  RUN-SUMMARY overall=FAIL cases=6 FAIL:6 worlds=none
```

`stage-diagnosis.json` records the stage probe: `rows` (the four ids),
`composedProfile` (all present), `counter` (`base-spawn=2`, `confined-spawn=0`,
`install-*=0`), `laneReport` (present: the evidence row applied and computed the
two-axis lane), `member: null`, `mockRequests`, `memberTurnSeen: false`.

## 3b. Attempt 3: the last start, killed at the control

This is the run the last-start ruling bought. It is recorded here in full because
its loss is **the lane's own**, and because it still produced the one artifact the
ruling asked for that we did not already have: proof, inside the World, that the
base spawn launches `rg` after the F1 fix.

```
17:04:45.249Z  budget intent appended (plannedStarts=1)
17:04:51.680Z  boot row appended (lease bootsSpent=1); mock on 3493
17:05:03.869Z  instrumentation installed (fs + base subprocess counters)
17:05:04.318Z  composed profile: six rows, missingRowIds=[]
17:05:04.405Z  BOOTED port=3183
17:05:04.750Z  p6t6 health=true hostAlive=true
17:05:04.769Z  discovery prompt status=200
17:05:04.800Z  base-spawn  git add --all --ignore-errors      (workspace-changes)
17:05:04.873Z  base-spawn  rg --json --regexp=A5SF_SEARCH_OUTSIDE -- <ceiling-outside>
17:05:04.950Z  base-spawn  git write-tree
17:05:05Z      KILLED — mock down, host down, teardown never ran, home left behind
```

`attempt-3-counter.jsonl` is the raw artifact (8 rows: 2 installs, 5 `base-spawn`,
**0 `base-spawn-failed`**). `attempt-3-lane-report.json` is the row's two-axis lane
report. The composed profile was archived by the driver; the home was harvested and
then deleted; port 3183 is closed; no orphan.

**What killed it:** the driver was started as `nohup node … &` inside a foreground
shell call. When that call returned, the harness tore down the call's process group
and took the driver, the mock and the Host with it, 230 ms after the first turn.
The correct launch is the harness's own background-job mechanism. This is the
**second self-inflicted instrument defect** of this lane (the first was the
`original.apply(this, spec)` wrapper behind F1), and both are recorded as such: an
instrument that is not itself tested — for correctness *and* for how it is run — is
not an instrument.

**What it still proves:** through the evidence row, in a real World, the packaged
`rg` was launched on the control's operand with no failure row. Attempt 2's counter
had no such line and the tool errored; attempt 3 has the line and no failure. F1 is
therefore closed **in the composition under test**, not only host-free.

**What it does not prove:** the control's result (the tool result went to the mock
and died with it; the on-disk session transcript holds only the session header), any
of the six rows, the leader grep probe (the kill came during the control turn), the
fact realm, row 3's binding restriction, cancellation. No abort row is claimed: the
boot really happened, so the intent's `1 = 1 − 0` stands and the start is honestly
counted as spent.

## 3c. The 2026-11-05 round: three fresh starts, the Member reached, the window missed

The owner granted three more starts on a fresh branch off master. The round is the
first one in which the **Member** half of the vertical actually ran.

| start | what it added | why it stopped |
|---|---|---|
| 4 | the leader grep probe (18:53Z) and a `team.create` that passed the coverage gate | `MEMBER_INSTALL_NO_WORKER`; the delegate answer was not captured yet |
| 5 | the **negative control PROVEN** and the delegate answer captured | `team_delegate` → `TEAM_RUNTIME_DURABLE_WRITE_FAILED`: `SERVICE_MOUNT_FAILED: native tool module re-mount failed: invalid config: $.sampleOverCapGlobResults missing required value` |
| 6 | member realm installed, `member turn dispatched=true`, 3 `confined-spawn` + 3 `confined-exit`, 7 guard facts | `CANCELLATION_WINDOW_NO_CONFINED_SPAWN` after 240 s |

### The leader grep artifact (start 4, `probe-leader-grep.json`)

```
success=true   baseSpawn=1   base-spawn-failed=0   factsBeforeRealm=0
toolResult: { isError:false,
  text: "Found 2 matches …/workspace/lane/inside/glob/needle.txt
         Line 1: A5SF_SEARCH_NEEDLE_u5a5sfsrch-20261104T18-51-35Z" }
```

This is the artifact the previous round never produced, and it settles F1 for good:
the same composition, the same row, one base spawn, a real `rg` match, no failure row.

### The negative control (start 5)

```
verdict=PROVEN  reason=UNCONFINED_CONTROL_LEAKS
leakedTokens=[A5SF_SEARCH_OUTSIDE_SECRET_…, A5SF_SEARCH_OUTSIDE_SECOND_…]
baseSpawns=11  confinedSpawns=0  guardFactsBeforeRealm=0
```

The anchor leader's *unconfined* search returns both out-of-lane secrets. That is the
baseline that makes row 2 discriminating; attempt 2's `REFUTED` was the F1 instrument.

### The Member, live (start 6)

Seven facts, in order, all from `realm: "member"` / `memberIdentity:
inst-14xcgx11i3lu` / `toolBindingIdentity: null`:

| # | decision | decidedBy | locator (relative to the World home) |
|---|---|---|---|
| 1 | **allow** | `ALLOW` | `workspace/lane/inside` |
| 2 | **deny** | `IO_READ_DENIED` | `ceiling-outside` |
| 3 | **deny** | `IO_READ_DENIED` | `workspace/lane/outside-restriction.txt` |
| 4 | allow | `ALLOW` | `workspace/lane/inside/invalid` |
| 5 | allow | `ALLOW` | `workspace/lane/inside/glob` |
| 6 | deny | `IO_READ_DENIED` | `ceiling-outside-glob` |
| 7 | deny | `IO_READ_DENIED` | `workspace/lane/blocking.fifo` |

The confined face served three spawns and three exits (in-lane `grep`, invalid-pattern
`grep`, `glob`), and the two out-of-lane operands were refused **before** any process:
`confined-spawn` stayed at 3, so the denies cost no process and no bytes. This is the
first live evidence of rows 1, 2, 3 and 5's *guard* behaviour in the Member realm.

**Why no row is judged:** the seven facts happened inside 400 ms, so the driver's
cancellation stage — which waits for the FIFO grep to be *admitted* — found fact 7 was
a denial instead. The FIFO was at `lane/blocking.fifo`, i.e. inside the ceiling but
**outside** the tool restriction (`lane/inside`), so the guard correctly refused it.
The window needs an ADMITTED search that then blocks. The fixture now places the FIFO
inside the effective lane (`lane/inside/blocking.fifo`).

The run's own lane report names the cause, which is why this is a measurement and not
a hypothesis (`stage-diagnosis.json`, `probe.laneReport.probePaths[4]`):

```
locator …/workspace/lane/blocking.fifo
  ceilingRead: allow        ← inside the ceiling
  restrictionRead: deny     ← outside lane/inside
  effectiveRead: deny       ← so the guard refuses it at admission
```

**What attempt 6 got wrong about its own record** (corrected in §3d): the driver
judged nothing and then wrote all six rows as `FAIL / DRIVER_ABORTED_AT_cancellation-window`.
The run *is* a FAIL, but the rows were not refuted — they were never observed. The
record now distinguishes the two.

### The three instrument defects this round found and fixed

1. **The probe poisoned the control.** The control counted greps by name; the probe
   (now first) had already left one in the transcript, so the control answered without
   issuing its grep and was recorded `NOT_REACHED`. Both now key on their own operand
   via `tool_result.tool_use_id`.
2. **Tool-use counting does not work in this harness.** The follow-up request does not
   echo the assistant `tool_use` block, so every counter stayed 0, every turn re-issued
   its call and burned its full 120 s settle timeout (two `rg` spawns 121 s apart). The
   mock now sequences on `resultIdsOf(req)` — the `tool_result` ids.
3. **The module was mounted with an empty config.** `tool-fs-search`'s `Config`
   requires `sampleOverCapGlobResults`; a bare string entry mounts with `{}` and the
   realm install is refused. The row now passes `{ sampleOverCapGlobResults: false }`
   (deterministic head for an over-cap page).

## 3d. The 2026-11-05 correction round: judge what was measured (no boot)

Attempt 6's driver measured seven facts and then discarded them. Not by crashing —
by **deciding**. This round fixes that, and it fixes it without spending a start
(pool 6/6, no Host booted; everything below is host-free).

### The single line that threw the observations away

The success path judged rows **only in the final verdict loop**, after the
cancellation window:

```js
// old run-boot.mjs, end of boot(): the first and only judging site
if (oracleSamples[id] === undefined) add(id, 'NOT_REACHED', { reason: 'NO_SAMPLE' })
```

and the abort path then fail-closed every row that had no sample —

```js
// old abort path
for (const id of CASES) {
  if (oracleSamples[id] === undefined) add(id, 'FAIL', { reason: `DRIVER_ABORTED_AT_${abortStage}` })
}
```

Because `oracleSamples` was populated *downstream* of `cancellation-window`, the
abort found it empty and turned six rows into `FAIL`. The guard against laundering a
missing observation into a pass ("a live regression must never be NOT_REACHED") was
implemented as a bulk `FAIL`, which is the opposite error: it asserted a refutation
that had never been observed. Four rows had live facts at that moment; the driver
dropped them on the floor.

### The law that replaces it

| about | rule |
|---|---|
| a **case** | judged only from a COMPLETE sample, by that row's own judge; an incomplete sample is `NOT_REACHED` |
| a **case after an abort** | a complete sample keeps its real verdict (a PASS is a *case* PASS); an incomplete one is `NOT_REACHED` with `status: driver-aborted` |
| the **run** | an abort after the Host was reached is `FAIL`, `partial: true`, with the aborting stage recorded — a case PASS can never lift it |
| the record | names `judgedCases` and `neverObserved` separately, so no reader can mistake "not looked at" for "looked at and refuted" |

Machine-checkable statuses (`CASE_STATUS` in `tests/world-factory/lib/a5sf-search-live.mjs`):
`judged` / `not-reached` / `driver-aborted`. `sampleCompleteness(caseId, sample)` names
the missing channel per row (`result`, `laneReport`, `laneReportProbe`, `confinedSpawn`,
`interrupt`, `memberChildSessionId`, …), and `judgeCase` is the only judging entry.

**Three pinned cases** (`a5sf-search-live.test.mjs`, 52 arms) — and each one has a
mutation control that turns it RED (`negative-controls.mjs` 8–11):

| sample, after an abort | case verdict | must never be |
|---|---|---|
| complete, correct bytes | `PASS`, `status=judged` | — |
| incomplete (`result` null) | `NOT_REACHED`, `status=driver-aborted` | `PASS` |
| complete, wrong bytes | `FAIL`, `status=judged` | `PASS` |

and the run fold: `PASS` + `NOT_REACHED` cases under an abort ⇒ `overall: FAIL`,
`partial: true`. On a completed run the same pair folds to `NOT_REACHED` — the run
verdict is the worst case, the abort is the only thing that makes it `FAIL`.

### The driver now judges as it goes

Judging happens at **every point where a sample becomes complete**, not once at the
end: after the member turn is dispatched (`delegate-dispatch`), after each row's
evidence arrives (`evidence-collection`), after teardown (`teardown`), and again on
the abort path (`abort:<stage>`). `judgeSettledRows()` skips incomplete samples rather
than freezing their incompleteness, so a later flush can still judge them. The abort
path re-judges from the channels that exist, records `markAborted({stage, detail,
error})`, and writes the same `oracle-samples.json` (now with `partial`, `abortedAt`
and each sample's `missing` list) so the next failure is re-judgeable offline.

The **third channel** is now persisted: `mock-requests.json` carries the model-visible
transcript, i.e. the tool-result bytes every row judge compares against. Attempt 6's
sink and counter were copied out; its results were not, and that single omission is
why the run below cannot be re-judged.

### Offline re-judgement of attempt 6 (`rejudge-attempt6.mjs` → `rejudge-attempt6.json`)

| row | archived | re-judged | status | on disk | named gap |
|---|---|---|---|---|---|
| 1 in-lane grep | FAIL | **NOT_REACHED** | driver-aborted | 1 fact, 1 spawn, exit **2** | `result` |
| 2 ceiling deny | FAIL | **NOT_REACHED** | driver-aborted | 1 deny fact, 1 spawn, 0 exits | `result` |
| 3 restriction deny | FAIL | **NOT_REACHED** | driver-aborted | 1 deny fact, lane report | `result` |
| 4 cancel on FIFO | FAIL | **NOT_REACHED** | driver-aborted | 1 deny fact, **0 spawns** | `confinedSpawn`, `interrupt` |
| 5 invalid pattern | FAIL | **NOT_REACHED** | driver-aborted | 1 fact, 1 spawn, exit 2 | `result` |
| 6 teardown | FAIL | **NOT_REACHED** | driver-aborted | nothing | `sample` |

`judgeable offline: 0 of 6`. The archived record's six `FAIL`s are all withdrawn as
*case* verdicts — it claimed six refutations and made zero observations. The **run**
stays FAIL, because the driver aborted after reaching the Host.

**The one row with a refutation signal is row 1**, and it is reported as a risk, not a
verdict: its in-lane `grep` exited **2**, and the pinned module maps any exit ∉ {0,1}
to `SearchError(SEARCH_FAILED)` (`tests/deepseek-harness-test-use/packages/fs/tool-fs-search/lib/index.js:201`),
i.e. `isError: true`, which would fail row 1's `resultNotError` clause. The same
binary, cwd and tree produced exit 0 for the `--no-ignore` glob and exit 2 for the
invalid pattern (correct), so the discriminating difference for row 1 is the missing
`--no-ignore`: ripgrep then discovers ignore/git metadata in the **ancestors** of the
search root (`lane/`, `workspace/`, the World home), and the restriction admits only
`lane/inside`. `stderr` was never persisted, so the cause cannot be named from what
survived — that is the named gap, and the smallest next measurement in this lane.

### Row 4's window, and the gate that would have caught the placement

The FIFO moved to `lane/inside/blocking.fifo`, and the dry run now decides its
placement with the **product algebra**, not a regex: it reads `plan-paths.json`
(written by `--plan`, so the paths the boot will actually compose), builds
ceiling/restriction/effective from the product `path-rules`, and requires
`matchLocator(effective, fifo) === 'allow'`. The same inputs must return `deny` for
the attempt-6 operand (`<ceiling>/lane/blocking.fifo`), so the check cannot be green
for "any FIFO anywhere". A mutation control rewrites the placement to
`join(inLane, '..', 'blocking.fifo')` and requires the dry run RED.

## 3d. The second re-grant: four rows judged, and what the two failures are

Four boots were granted on 2026-11-05 (pool 10). Three were spent; the fourth is
unspent. The verdicts below are from run 9 (`2026-11-04T20-17-23Z`), the only run in
which all six rows reached a judge with a complete sample.

| row | verdict | reason | evidence |
|---|---|---|---|
| 1 | **FAIL (refuted)** | `ROW1_CLAUSE_FAILED` (`resultNotError`, `matchReturned`, `fileNamed`) | `confined-exit code=2`, `stderr="rg: …/.git: Permission denied (os error 13)"` |
| 2 | **PASS** | `OUT_OF_LANE_REFUSED_BEFORE_ANY_PROCESS` | one `deny` fact `IO_READ_DENIED`, `confined-spawn` unchanged |
| 3 | **PASS** | `RESTRICTION_NARROWER_THAN_CEILING_REFUSED_AT_ADMISSION` | `allow` for the ceiling, `deny` for the restriction, effective `deny` |
| 4 | **PASS** | `CANCELLED_SEARCH_ABORTED_WITH_KILLED_CHILD_NO_RESULT` | interrupt `result.ok=true, accepted=true`; child `code=143` (SIGTERM) 4 ms later; no result delivered |
| 5 | **PASS** | `INVALID_PATTERN_SURFACED_AS_TOOL_ERROR` | tool error, never "no matches" |
| 6 | **FAIL (finding)** | `ROW6_CLAUSE_FAILED` (`noSuccessAfterStop`, `noCallableShadow`, `noProcessAfterStop`, …) | `postStopGrep=200`, `postStopGlob=200`, a `confined-spawn` 55 ms after `stopInstant` |

### Row 1 is refuted by the repository, not by the ceiling

```
row 1 confined-exit code=2 signal= stderrBytes=115
stderr="rg: /home/armourpiercer/projects/dsh-agent-team/.worktrees/a5sf-search-live2/.git: Permission denied (os error 13)
"
tool text: "Error: grep search failed (exit 2): rg: …/.git: Permission denied (os error 13)"
```

`rg` discovers VCS state by walking the **ancestors** of its search root. The World's
workspace lives inside this repository, so it finds the worktree's `.git`, the ceiling
refuses it (correctly — it is out of lane), and `rg` exits 2; the pinned module maps
exit ∉ {0,1} to `SearchError`. The row therefore fails for a reason that is neither the
ceiling nor the guard: **a confined `grep` cannot run inside a git work tree.** Two
remedies are possible and both are policy decisions, not driver fixes: give the module
`--no-ignore`/`--no-ignore-vcs` (argv is the shipped allow-list's to decide), or place
the World's workspace outside any repository. The second would make the row measure a
different environment, so it is disclosed rather than taken.

### Row 6: an archived member is still callable

`hostDead=true portReleased=true homeDeleted=true noOrphanProcess=true` — the teardown
itself is clean. What fails is the **window between archiving and the Host's death**:
`team_archive_member` returns `lifecycle-changed SETTLED→ARCHIVED`, and the tool route
still executes (`postStopGrep=200`, `postStopGlob=200`) and even spawns a new confined
process 55 ms after the stop instant. So `archive` does not revoke the member's tool
surface. Whether it should (row 6's reading) or whether the surface is only revoked when
the child session closes (the product's apparent reading) is a contract question for the
owner; it is not something a re-run answers, which is why the fourth boot was not spent.

### Row 4 needed the interrupt to be issued INSIDE `team.create`

Run 7 failed row 4 with a child exit 143 that came from the module's own 30 s tool
timeout: `team.create` waits for the leader's first turn, that turn is the synchronous
delegate, and the delegate waits for the member's turn — the blocking FIFO grep. The
driver therefore had no control during the only window in which the search was in
flight. Run 8 fixed that (`createPromise` + a concurrent watcher that reads the FIFO's
`confined-spawn` and the worker's `childSessionId`, then calls the shipped cancel route):
the interrupt was accepted **4 ms** after the spawn. Three clauses still failed, and all
three were mis-reads of the product's own evidence:

1. `interruptAcknowledged` read `body.ok`; the route answers `{result:{ok:true,
   value:{accepted:true}}}`, so an accepted cancel was recorded `ok:false`.
2. `childTerminatedBySignal` demanded a non-empty `signal`; the launcher reports a
   signal-killed payload as `code = 128 + signum` with an empty signal string —
   `provider.ts`'s documented convention, and the record said `143`.
3. `settlementIsCancelled` falls back to the termination evidence when no result is
   delivered, so it inherited (2).

Run 9, with those three reads corrected, judged row 4 **PASS**.

## 4. The two live findings

### F1 — WITHDRAWN: it was the lane's own instrumentation, not a product finding

> `165059eea` captured the cause host-free. `a5sf-search-realm-provider-row.mjs` did
> `return original.apply(this, spec)`; `apply` takes an array-like argument list, so
> the pinned service ran as `spawn(undefined)` and `validateSubprocessSpec` threw on
> `spec.graceMs`. `search-core` turns any synchronous launch throw into
> `"grep could not start its search command (ripgrep launch failed)"`. The fix
> (`original.call(this, spec)`, plus a `base-spawn-failed` row that records the Node
> cause before rethrowing) is evidence-layer only. `f1-cause.mjs` reproduces the
> World's exact failure pre-fix (5/5 arms, `F1-ROW-SPAWN` RED before / GREEN after),
> and attempt 3 observed the same spawn succeed inside a real World.

The original text is kept below as the record of what was believed at the time; it
is **not** a product finding.

#### (as recorded after attempt 2) the unconfined base `subprocess` cannot launch the packaged `rg` in a World

Negative control result, verbatim:

```
{"result":{"isError":true,"text":"Error: grep could not start its search command (ripgrep launch failed)"},
 "leakedTokens":[],"baseSpawns":2,"confinedSpawns":0,"guardFactsBeforeRealm":0}
```

The message is the search module's synchronous-catch text, i.e.
`ctx.subprocess.spawn({argv:[await resolveRgPath(), …]})` threw before returning a
handle. Host-free eliminations, all run at this commit:

- **not module resolution**: `import('@vscode/ripgrep')` resolves and returns the
  binary from the host-tree module path *and* from the pnpm package path;
- **not the Linux scope launch**: `probeLinuxScope()` is false here (`systemd-run
  --user --scope … → status 1, "Failed to connect to user scope bus via local
  transport: No data available"`), so `subprocess-local` selects the plain
  `spawnSubprocess` fallback, not `launchLinuxScope`.

So the throw is inside `validateSubprocessSpec` or `spawnSubprocess`, and the cause
object is not recoverable from this attempt: the module wraps it in a `SearchError`,
the harness printed only the message, and the World home (which would carry the
plugin's own log) is deleted by teardown. **This is not isolated** — it is recorded
as the top item for the next start.

**Why it matters:** the confined class delegates to the same base spawn. If the base
cannot launch `rg`, the Member's `grep` cannot either, so BL-16's live half is
blocked on this independently of any confinement question — and the negative control
that makes row 2 discriminating cannot run until it is fixed.

### F2 — the acceptance preset exposes `grep`/`glob` to the leader, where they are unmanaged (VERIFIED host-free)

The native attach that makes `grep`/`glob` "managed" runs on a **Member** realm.
The leader is the root session and has no realm, so the same tools are
`known-sensitive-unmanaged` on its surface and the product's permission coverage
gate refuses `team.create`. That gate is behaving correctly; the composition is
wrong. The driver now denies `grep`/`glob` on the leader (`LEADER_MANAGED_TOOL_NAMES`)
while the Member still receives them through its realm. **Verified host-free** by
`f2-deny-unit.mjs` (4/4) against the real `evaluatePermissionCoverage` gate and the
World's own recorded 24-tool surface: the computed deny passes on 20 tools, and a
mutation control that re-admits `grep`/`glob` reproduces the World's refusal prefix
character for character. Not yet observed live (attempt 3 died before `team.create`).

This is also the composition-surface answer the external review asked for, now
measured rather than read: the preset supplies the *plugin*, the evidence row
supplies the confined `subprocess` face, and the leader gets neither — so the
preset alone cannot produce a confined search on any agent.

## 5. Row 3, and the realm

**Row 3 is now `SUPPORTED` as a genuine restriction-lane refusal, and remains
`UNSUPPORTED` only for *preset-expression*.** Those are two different claims and the
earlier note ran them together.

What attempt 6 measured (`stage-diagnosis.json` → `probe.laneReport.probePaths[1]`),
for the exact restricted file:

```
locator …/workspace/lane/outside-restriction.txt
  ceilingRead: allow        ← the workspace ceiling ADMITS it
  restrictionRead: deny     ← only the narrower tool restriction denies it
  effectiveRead: deny
```

`rejudge-attempt6.mjs` re-runs the **product** algebra (`intersectPathRuleSets` /
`matchLocator` from `dist`) over the report's *recorded* allow lists and reproduces
the same triple (`recomputedMatchesRecord: true`); widening the restriction to the
ceiling flips the effective answer to `allow`. So the deny is **not** ceiling-derived:
it is the two-axis restriction doing the work. The earlier `UNSUPPORTED` note was
over-pessimistic, and an over-pessimistic record is its own inaccuracy — the
correction is recorded in `rejudge-attempt6.json#corrections`.

What stays `UNSUPPORTED` is only this: a **binding realm** has no `subprocess` face
today (BL-17 refuses the module with `SUBPROCESS_UNCONFINED_REALM`), so the
restriction is *composed by the evidence fixture* with the product algebra rather
than expressed by the preset. `judgeRow3` records
`presetExpressesBindingRestriction: false` + `presetLimit` in the verdict, so no
reader can mistake the fixture's composition for a preset capability. The live fact
is `realm='member'`, `toolBindingIdentity=null`. The matrix/backlog note should read:
*row 3 deny = restriction-lane (measured); preset-expression of a binding restriction
= unsupported (unchanged)*.

## 6. The budget, honestly

`lane-ruling.json` holds four named rulings: the original task, the retry, the
"last start" ruling, and the owner's **3-start re-grant** of 2026-11-05 (pool 3 spent +
3 fresh = 6). `run-ledger.jsonl` holds 6 intents and 6 boot rows; the invariant
`bootRows === plannedStarts − aborts` holds per run (`1 = 1 − 0` six times). Pool item
`P2-04 grep (BL-16)`: **10 allocated, 9 spent, 1 remaining** (`go-no-go` prints GO — the
pool is not exhausted, but the lane stops here on purpose: the two remaining failures are
findings a re-run cannot change). 5 ruling entries: the original task, the retry, the
"last start" ruling, the owner's 3-start re-grant, and the owner's 4-start re-grant of
2026-11-05. `go-no-go.mjs` now prints:

```
PASS budget: the lane ruling is well-formed (entries sum to authorisedStarts, each names by + reason):
     {"authorisedStarts":3,"entries":3}
PASS budget: this start is authorised by the rulings and is NOT a third:
     authorised=3 spent=2 — a further start needs a NEW ruling entry appended to
     lane-ruling.json, not an edit to authorisedStarts
REFUSE the same check after the third boot  →  NO-GO  (spent=3, remaining=0)
```

### The cost line the retry ruling asked for

**This vertical has spent 9 of 10 starts and judged 4 of 6 rows PASS** (rows 2, 3, 5, 4),
with row 1 refuted by a byte-level cause and row 6 open on a contract question. The
first three starts: a handoff the gate could not see, a composition gap (F2) plus the
lane's own instrument (F1, withdrawn), and a launch method that killed its own run. The
next three bought the leader probe, the PROVEN control, the member realm install and
seven live guard facts, then stopped on a FIFO one directory outside the lane. The last
three bought the judging itself: rows 2/3/5 at dispatch, row 4 after the interrupt was
moved inside `team.create`, and the two findings above. Every loss is attributable, and
each start moved the failure forward by exactly one handoff — which is the only thing
that makes the spend defensible.

The composed-profile gap was invisible to a green `--plan`. The reusable lesson for every later live lane (P3-00
inventory will hit the same handoff): *a host-free gate must run the handoff, not
just render it* — emit-and-pray passes every text-level check. Concretely: the plan
artifact must compare the rows the runtime will actually compose against the rows
the patch text names, by identity and in order; and the boot must read the composed
profile before it waits on health.

Attempt 3's lesson is about the instrument's **operating discipline**: a driver that
takes 90 s to boot and one second to kill must be started as a background job that
outlives the call which starts it. Nothing in the code was wrong; the run was killed
by the shell.

Attempt 2's second lesson: **stage attribution earns its keep.** The generic
`post-boot` of attempt 1 became, in attempt 2, `composition` → verified in 3 s,
`team-create` → refused with the product's own error code, plus a probe that
records what the world looked like. Two starts bought two named handoffs, not two
"it didn't work".

## 7. Gates, verbatim (current)

```
DRY RUN GREEN — 53 checks, head=e17f0cec… digest=cfb61761…
NEGATIVE CONTROLS GREEN — 9 controls, every guarded check went RED on the broken property and the bytes were restored
```

`go-no-go.go-before-boot.json` (attempt 1), `go-no-go.retry-go.json` (attempt 2) and
`go-no-go.last-start-go.json` (attempt 3) are the three `GO` authorisations.
`go-no-go.json` (current) is the post-spend refusal. Both `GO`s are quoted in
`go-no-go.retry-go.log` / `go-no-go.go-before-boot.log`, including:

```
PASS handoff: the rows the World composes EQUAL the emitted rows, by identity and in order:
     {"emitted":["a5sf-search-realm","dsh-agent-team","p6t6-team-tools","preset-a5sf-search-base"],
      "world":["a5sf-search-realm","dsh-agent-team","p6t6-team-tools","preset-a5sf-search-base"],
      "identityHolds":true}
PASS handoff: the driver CALLS the handoff before harness.boot( (independent source read)
```

## 8. Files

| file | what it is |
|---|---|
| `run-boot.mjs` | the driver (`--plan` host-free; boot mode is the one shot). `handOverRows`, the ruling-based budget, the stage taxonomy, the composed-profile probe. |
| `a5sf-search-realm-provider-row.mjs` | the evidence row: composes ceiling ∩ restriction with the product algebra, `compiledFor()` returns the confined `subprocess` face, counts installs/spawns at the prototype boundary, writes the lane report. |
| `dry-run.mjs` | 59 host-free checks: driver, row, product seam, premises, dist provenance, handoff, budget 0, the partial-run cases, and the FIFO's placement decided by the product algebra. |
| `negative-controls.mjs` | 14 mutation controls (break the property, require RED, restore bytes, verify sha256, restore the committed dry-run artifacts the mutated runs overwrite), including one per partial-run law and one for the attempt-6 FIFO placement. |
| `rejudge-attempt6.mjs` / `.json` | offline re-judgement of the 2026-11-04T19:17Z run from the harvested channels only: per-row verdict, `missing` channels, named gaps, the row-1 refutation risk, and the row-3 attribution cross-check. No Host. |
| `mock-requests.json` | the mock transcript (tool-result bytes) persisted OUTSIDE the World home; written at dispatch, at each settled row and on the abort path. Absent for attempt 6 — that absence is why it cannot be re-judged. |
| `plan-paths.json` | the paths `--plan` composed (ceiling/restriction allow lists, in-lane dir/file, the restricted and outside operands, the FIFO); the FIFO placement check reads it. |
| `go-no-go.mjs` | the boot authorisation gate (dry run, controls, handoff identity, digest, clean tree, branch, ledger invariant, pool, ruling, pinned host). |
| `lane-ruling.json` | the two authorised starts, each with `by` + `reason`; the driver and the gate both read it. |
| `plan-rows.json` | the handoff proof: `emittedRowIds` vs `worldRowIds`, ordered identity, health-probe row. |
| `attempt-1-defect.json`, `attempt-1-composed-profile.patch.yml`, `attempt-1-instance.log` | the spent first attempt: defect, proof, host console. |
| `stage-diagnosis.json` | the attempt-2 stage probe (stage, rows, composed profile, counter legs, lane report, member state). |
| `attempt-3-killed.json`, `attempt-3-counter.jsonl`, `attempt-3-lane-report.json`, `attempt-3-home-cordis.patch.yml` | the spent last start: the timeline, the raw counter rows that show `rg` launched with no failure row, the lane report, and the World's input patch. |
| `f1-cause.mjs`, `f1-cause.red.log`, `f2-deny-unit.mjs`, `f2-deny.json` | `165059eea`: F1's cause captured host-free (5 arms, `F1-ROW-SPAWN` RED→GREEN) and F2 verified against the real coverage gate (4 arms). |
| `run.log`, `run-record.json`, `run-ledger.jsonl`, `grant.json`, `negative-control.json` | append-only run log, the 6/6 FAIL record, the budget ledger, the grant, the control result. |
| `logs/…`, `runs/…` | per-world console/profile and the previous-run archive. |

Re-run host-free: `node dev/agent-workflow/evidence/a5sf-search-live/dry-run.mjs &&
node dev/agent-workflow/evidence/a5sf-search-live/negative-controls.mjs`. Boot mode
is gated by `go-no-go.mjs` and by `lane-ruling.json`.

## 9. What is NOT proven (complete list)

1. **All six live rows** — unmeasured. The Member half is *reached*: the guard facts,
   the confined spawns and the denies for rows 1/2/3/5 were observed live on
   2026-11-04T19:13Z (§3c); what is missing is the *complete sample* for any row, so no
   row can be judged (§3d). Row 1 additionally carries a measured refutation signal
   (its in-lane `grep` exited 2) that must not be read as a pass.
2. ~~The negative control~~ — **PROVEN** on 2026-11-05 (§3c): the unconfined search
   leaks both out-of-lane tokens.
3. ~~F1's exact cause~~ — **resolved and withdrawn** (`165059eea`): the lane's own
   wrapper called `spawn(undefined)`.
4. **The leader-deny fix (F2)** — verified host-free against the real gate, not yet
   observed live.
4b. **The leader grep probe (last-start condition 2)** — implemented and gated; it has
   not run since the kill came during the control turn of attempt 3 (attempt 6 ran it
   green: `probe-leader-grep.json`).
5. **The fact realm for search** — observed: `member` with `toolBindingIdentity:null`
   (all seven attempt-6 facts).
6. **Preset-expression of the two-axis restriction** — `UNSUPPORTED` (the *deny itself*
   is now supported as restriction-lane: §5).
7. **Cancellation semantics** — the FIFO window is proven for the *packaged* `rg`, and
   the operand is now inside the effective lane; the end-to-end timing is still
   unmeasured.
8. **`>cap` clipping, streaming mid-read cancel, atomic replace/version conflict** —
   out of scope, untouched. **M-07 `glob`** — equally unmeasured.

## 10. The handoff that is left, and who may run it

The pool is spent, so this is a handoff to whoever buys the next start, not a plan
this lane can execute. The composition, the rows, the driver, the gate and both
fixes are in the tree and green host-free; the composition has been proven live
three times. What has never been reached is the **member-install → delegate-dispatch
→ confined consult** chain, because attempt 2 stopped at `team-create` and attempt 3
was killed one turn earlier.

So the next person should run **the same tree, unchanged**, with exactly two
additions, both already implemented here:

1. start the driver as a **harness background job** (never `nohup … &` inside a
   foreground call — §3b);
2. let the leader grep probe (condition 2 of the last-start ruling) run: it is one
   unconfined `grep` on the in-lane fixture before `team.create`, and it writes
   `probe-leader-grep.json` with the counter rows for that operand.

The first new stage after that is `member-install`. The stage taxonomy already
discriminates it (`member-install`, `delegate-dispatch`, `cancellation-window`), each
with its own error code, so if it breaks the report will name the handoff rather
than say `post-boot`.

## 11. F1 closed (host-free): the cause was our own counter, and F2's deny is verified

**F1 is found, reproduced and fixed without a Host start.** `f1-cause.mjs` drives the
real pinned `@deepseek-ai/dsh-tool-fs-search` module through the product tool seam
over the real pinned `subprocess-local` service and the real packaged `rg`
(`f1-cause.json`, `f1-cause.log`; RED run `f1-cause.red.log`).

**The cause.** `a5sf-search-realm-provider-row.mjs` wrapped the base spawn with

```js
return original.apply(this, spec)        // ← the whole of F1
```

`Function.prototype.apply` takes an **array-like argument list**. `spec` is an
object without a `length`, so the pinned service was called as `spawn(undefined)`,
`validateSubprocessSpec` read `spec.graceMs` (`subprocess-local/src/spawn.ts:165`)
and threw a **synchronous** `TypeError`. `search-core.ts`'s launch catch turns every
synchronous throw into its one text — `grep could not start its search command
(ripgrep launch failed)` — so the World reported a ripgrep launch failure for a
ripgrep that was present, executable and never started. The **same** wrapper broke
the `git rev-parse` spawn of `workspace-changes` (warned, never surfaced), which is
why the World ledger carries exactly two `base-spawn` rows and zero successful
unconfined searches: both rows are failures, not a successful git call plus a failed
rg call. The message was never about confinement, the spec shape, the session cwd or
the packaged binary — the negative control was broken by the instrument that was
supposed to observe it, and the leak it was supposed to prove could not happen.

Captured cause fields (mutation arm, verbatim):

```
name   TypeError
message Cannot read properties of undefined (reading 'graceMs')
at     validateSubprocessSpec (…/subprocess-local/lib/runner-launch-*.js)
surface Error: grep could not start its search command (ripgrep launch failed)
```

**The fix, at the right layer.** One line in the evidence row: `original.call(this,
spec)`. The pinned tree is untouched (`CORE PATCH BUDGET = 0`), and no product code
changed. The row now also records a `base-spawn-failed` row (cause fields + whether
`argv[0]` / the cwd existed) before rethrowing, so a launch failure can never again
be recorded as a successful spawn.

**Arms** (all in-process, no port, no `DSH_HOME`, no `tests/homes`):

| arm | what it measures | state |
| --- | --- | --- |
| `F1-SYNC-MATRIX` | which `spawn()` failures are synchronous (the message's whole cause surface) | measured |
| `F1-SPEC-REPLAY` | the World's recorded spec (`negative-control.json` verbatim) exits 0 and matches here | PASS |
| `F1-MUTATION` | the pre-fix `apply(this, spec)` reproduces F1's exact text + the TypeError (mutation control) | PASS |
| `F1-ROW-SPAWN` | **regression arm**: through the fixed row the same grep returns an `rg` match | RED before / GREEN after (`f1-cause.red.log`) |
| `F1-CAPTURE` | a synchronous launch failure now leaves an attributable `base-spawn-failed` row | PASS |

The arm that would have caught F1 without a boot is `F1-ROW-SPAWN` itself: it asserts
a real base spawn of the packaged `rg` **through the evidence row**, which is exactly
the composition the World ran. (`F1-CAPTURE` is the forward-looking half: had it
existed, the World's ledger would have carried the TypeError and the F1 row would
never have been misread as a product finding.) Note the boundary: a *synchronous*
launch failure is captured; an asynchronous one settles through `handle.done` and
surfaces as the module's distinct "provider failure" text.

**F2 verified host-free** (`f2-deny-unit.mjs`, `f2-deny.json`), against the REAL
`evaluatePermissionCoverage` gate and the World's **own recorded final surface**
(24 tools, from `run.log`):

1. with the leader deny computed exactly as the driver computes it
   (`[glob, grep, u5_canary, u6fs_probe]`), the gate returns `ok: true` on the 20
   remaining tools — `read/read_image/write/edit/bash` are managed vocabulary, the 15
   `team_*` names are managed Team tools;
2. **mutation control**: re-admitting `grep`/`glob` makes the gate refuse with exactly
   `glob (known-sensitive-unmanaged), grep (known-sensitive-unmanaged)`, and the
   reproduced typed detail continues the World's recorded refusal prefix character
   for character (the driver persisted that text truncated to 300 chars, so the
   comparison is on the surviving prefix);
3. the deny is **leader-only**: the Member preset still expects `['grep', 'glob']`
   from the search module, and the executed proof that a Member realm exposes and
   confines them is the BL-16 arm suite (`bl16-grep-arms.log`), unchanged and green.

**Gates this round** (all host-free): `f1-cause.mjs` 5/5, `f2-deny-unit.mjs` 4/4,
`dry-run.mjs` 47/47, `negative-controls.mjs` 9/9, world-factory `node --test`
(see `wf-suite.log`), `pnpm -r run typecheck` and
`tsc -p packages/runtime/tsconfig.json --noEmit` clean (the branch changes no `.ts`
source: the delta vs `origin/master` is evidence `.mjs`/`.json`/`.md` only),
`git diff --check origin/master...HEAD` rc=0.

**What is left for a judged row.** F1 no longer blocks the negative control: a boot
should now record a *successful* unconfined base spawn and the out-of-lane leak, and
`team.create` should clear the coverage gate (F2) and reach the member-install stage.
The next thing to test is therefore the **member-install / realm-dispatch stage** —
whether the Member's confined `grep` is served by the confined face (one
`confined-spawn` row, one deny fact for the out-of-lane operand, no secret bytes) —
followed by the cancellation window on the FIFO. The one instrumentation to add
before the next start is nothing new: `base-spawn-failed` now covers the F1 class, and
the ledger's `confined-spawn` rows already discriminate the confined face.

## 12. What the next lane must know

Four rules this vertical earned by losing three starts. They are written for whoever
builds the next live acceptance lane (P3-00 inventory will hit the same handoff), and
each one is backed by a specific loss here.

1. **A host-free gate must RUN the handoff, not render it.** Attempt 1's `--plan`
   was green because it judged the *emitted patch text*; the World booted a bare
   profile because the rows never reached `world.u6Fs.rows`. Emit-and-pray passes
   every text-level check. The gate must execute the same function the boot executes.
2. **The plan artifact must compare composed rows to named rows by identity and in
   order.** A length check would have passed attempt 1. `plan-rows.json` now carries
   `emittedRowIds` and `worldRowIds`, and both the plan and the boot authorisation
   compare them element by element; a mutation control that drops the handoff turns
   the gate RED.
3. **The boot must read the composed profile before it waits on health.** The
   profile file is the only evidence of what the runtime actually mounted; polling
   health first turns a composition defect into a 120 s timeout with no diagnosis.
   The driver now reads `composed-profile-*.patch.yml` and refuses on a missing row
   id before it asks the Host anything.
4. **A driver that instruments a service must be tested for the instrumentation
   itself — and for how it is run.** F1 was self-inflicted: `original.apply(this,
   spec)` called the service as `spawn(undefined)`, and the resulting TypeError was
   reported for two rounds as a product launch failure. `F1-ROW-SPAWN` now asserts a
   real spawn *through the evidence row* (RED before the fix, GREEN after), and
   `F1-MUTATION` proves the pre-fix code still reproduces the exact wrong text. The
   operating half of the same rule: attempt 3 was killed at 230 ms by the shell that
   launched it, so a long-running driver must be started as a background job that
   outlives the call — and it must copy its counter and fact sink **out of the World
   home before teardown**, because the home is deleted and that is what swallowed
   F1's cause twice.

5. **The mock model must sequence on TOOL RESULTS, not on echoed tool_use blocks.**
   This harness does not echo the assistant `tool_use`; a counter over it never
   advances, so every turn re-issues its call and burns the whole settle timeout.
   `resultIdsOf(req)` over `tool_result.tool_use_id` is the reliable key.
6. **A native module's `Config` is a contract.** `tool-fs-search` requires
   `sampleOverCapGlobResults` with no default; mounting it as a bare string entry
   refuses the realm install with `SERVICE_MOUNT_FAILED`. Read the module's `Config`
   schema before mounting it, and give the deployment choice explicitly.
7. **A cancellation fixture must be ADMITTED before it can block.** A FIFO inside the
   ceiling but outside the tool restriction is refused at admission (`IO_READ_DENIED`)
   and the window never opens; the blocking operand has to sit inside the effective
   read lane. This is now checked by the product algebra over `plan-paths.json`, and
   the check is pinned by a mutation that restores the attempt-6 placement (§3d).
8. **An abort must judge what it measured, and only that.** The rule that must
   survive is "never launder a missing observation into a pass". The over-correction
   that must not is "discard the observations you made": attempt 6 measured seven
   facts, then fail-closed six rows to `FAIL`, asserting refutations it had never
   observed (§3d). A run verdict and a case verdict are different claims; an aborted
   run is `FAIL` + `partial`, its judged cases keep their own verdicts, and every
   unobserved case is `NOT_REACHED` with a named missing channel.
9. **Persist the bytes, not just the decisions.** The sink (facts) and the counter
   (spawns/exits) survived attempt 6; the mock transcript (the tool results) did not,
   and without it no row is judgeable. `mock-requests.json` is written outside the
   World home at dispatch, at each settled row and on the abort path — the same lesson
   as rule 4's counter, one channel further out.

Two smaller ones, already enforced: an instrument records and rethrows, it never
decides; and a driver that reports a *run* verdict must never do so by bulk-assigning
*case* verdicts it did not measure.
