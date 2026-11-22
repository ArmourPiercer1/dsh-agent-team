# D3 — four D items measured live (round 63)

Branch `vnext/a1-cut`, HEAD at run start `b779d9fab86be64154b8d9a2de81ea1a8c2baa4e`, host pin
`639ed015397290b3745d163aafe02ffee4aa3f84` (porcelain empty before and after every boot). Record class
**DEV-LIVE**: development evidence only, never candidate evidence, and never a `V@B=yes` claim.

Driver: `tests/world-factory/drivers/d-boot-feasibility/run-boot-d3.mjs` (a COPY of the D2 skeleton with
its own probes; the round-61/round-62 drivers are untouched).

```
node tests/world-factory/drivers/d-boot-feasibility/run-boot-d3.mjs --boots 2
```

Two boots, identical (`agreeing=true`, `differing=[]`):

| fact | boot1 | boot2 |
| --- | --- | --- |
| overall | FAIL (1 of 4 judges refutes) | FAIL |
| `d3:persistent-subprocess` | **REFUTED** | **REFUTED** |
| `d3:crash-cold-recovery` | **PROVEN** | **PROVEN** |
| `d3:work-delivery` | **PROVEN** | **PROVEN** |
| `d3:alpha6` | **PROVEN** | **PROVEN** |
| aAdmissions / bAdmissions | 4 / 3 | 4 / 3 |
| in-flight at SIGKILL | RUNNING | RUNNING |
| in-flight after recovery | UNKNOWN | UNKNOWN |
| collect status | succeeded | succeeded |
| bash turn-1 / turn-2 settlement | REFUSED / REFUSED | REFUSED / REFUSED |

`overall=FAIL` is the honest aggregate: the runner maps a REFUTED judge to case FAIL by design, so a run
whose evidence collection COMPLETED still exits non-zero when any proposition is refuted. Both facts are
logged separately (`RESULT evidence-complete=true allProven=false`).

Every one of the four judges ran in BOTH boots — none is single-boot by nature. The Alpha.6 arm boots its
own separate World inside the same budgeted lease thunk; its proposition is a CONFIG-EVALUATION, so its two
runs are two independent evaluations of the same row.

## `d3:persistent-subprocess` — REFUTED (the required direction is absent)

A governed Member's model-visible surface DOES carry `bash`, and the Member DOES call it twice, in two
different turns, in the same Member session. Both calls are refused at the ONE admission point:

```
Error: ADMISSION_AXIS_UNSUPPORTED: tool "bash" needs a subprocess lane, which this binding does not
compile; a call the centre cannot judge is refused
```

Disk facts (`centre/inst-*.facts.jsonl`, fresh readers), identical in both turns:

```
{ "callId": "call-d3-a-bash1", "toolName": "bash", "axis": "process.exec",
  "decision": "deny", "refusalCode": "ADMISSION_AXIS_UNSUPPORTED" }
```

Settlement, fresh reader: `ADMITTED → REFUSED` (a terminal refusal at birth, never `RUNNING`, never a
body). The probe's state file `team-a/d3-persistent-state.txt` therefore does not exist, and the second
turn's tool result carries the same typed refusal. The shipped governed preset mounts exactly ONE shell
row, `tool-bash` (the ONE-SHOT confined terminal face), and NOT `dsh-tool-bash-persistent`
(`preset mounts tool-bash-persistent=false; mounted shell rows=["tool-bash"]`); the host tree ships
`packages/shell/tool-bash-persistent/package.json` but the profile never mounts it (`--plan`:
`present=true mounted=false`).

So the product's answer to "a Member runs a persistent subprocess whose session survives across turns" is
a REFUSAL, not a session. **What the process lane would need** (`CONTRACT-CHANGE-REQUEST-process-lane.md`,
unchanged): there is no declaration source for it. The v4 member ceiling is a CLOSED io shape —
`packages/domain/blueprint/src/blueprint-v4.ts:187-197` — measured live by feeding a `process` member
ceiling to the shipped parser:

```
{"accepted":false,"code":"MALFORMED_DTO",
 "details":{"problems":[{"code":"unknown-field",
   "path":"$.memberIoCeilings[0].io.process",
   "detail":"field 'process' is outside the closed io shape (read | write | network)"}]}}
```

The two lawful shapes are unchanged: (A) add `process` to the v4 ceiling family (contract change) so the
centre can compile a subprocess lane and the preset can mount `tool-bash-persistent` behind it; or (B) a
v5 schema that declares the process lane; or (C) rule subprocess/PTY/PTC unsupported by ruling and keep
the typed refusal as the shipped behaviour. No driver can pass this judge by faking a shell.

## `d3:crash-cold-recovery` — PROVEN

Sequence, both boots: Leader discovery → `team_delegate` worker A → A's turn (admitted `read`, refused
`bash`, unit delivered) → `team_collect` A → `team_follow_up` A (second `bash` turn, refused) →
`team_delegate` worker B → B's turn: admitted `read`, a `grep` probe (see the extra finding below), then
an ADMITTED **`edit`** of a 256 MiB in-lane file (unique needle as its last line; a ~60-byte tool call,
so the settlement stays open for a measurable window) → the driver polls the settlement file every 10 ms
and, once open, **SIGKILLs the host pid** → cold restart on the SAME `DSH_HOME` and the SAME port lease,
row `bootPhase: create-or-open`.

Measured, from fresh disk readers on both sides of the kill:

| fact | boot1 | boot2 |
| --- | --- | --- |
| kill | `pid=89`, `signal=SIGKILL`, `exit={code:null,signal:"SIGKILL"}`, pid gone, port free | same, `pid=89` |
| in-flight settlement at kill | `RUNNING` (`ADMITTED,RUNNING`) | `RUNNING` |
| in-flight settlement after recovery | `UNKNOWN` (`ADMITTED,UNKNOWN`) | `UNKNOWN` |
| execution fact for the crashed call | none (never `COMPLETED`) | none |
| admission facts for the crashed call | 1 before, 1 after (never replayed) | 1 / 1 |
| A's completed `read` fact | 1 before, 1 after, byte-identical | 1 / 1 |
| A's completed `read` settlement | `COMPLETED` before and after | `COMPLETED` |
| new call after recovery (`call-d3-a-after-recovery`) | `allow`, `fs.read`, settlement `ADMITTED→RUNNING→COMPLETED` | same |
| restart home | identical to the pre-crash home | identical |

The recovery is the product's own `recoverUnsettled` at member bind
(`packages/runtime/settlement/execution-settlement.ts:1846`,
`packages/runtime/src/plugin/vnext/member-execution.mjs:171`): a non-terminal record becomes UNKNOWN and
is never replayed. No driver code writes `UNKNOWN`; the driver only reads the file.

## `d3:work-delivery` — PROVEN

Through the product's real team tools on the governed Member:

* `team_delegate` → `{"status":"executed","action":"delegate", … "effect":{"kind":"member-activated",
  "instanceId":"inst-…","templateId":"worker-a","childSessionId":"session-team-child-…"}}`;
* the delegated prompt arrives VERBATIM as the Member's first user message (`[team-work requestToken=
  dboot-d3-work-a]` … `DBOOT_D3_DELIVERED_UNIT_ALPHA`);
* the Member's turn-1 final text is exactly `DBOOT_D3_DELIVERED_UNIT_ALPHA`;
* `team_collect` → `{"requestToken":"dboot-d3-work-a","status":"succeeded","instanceId":"inst-…",
  "admittedSequence":2,"settledSequence":5,"memberResult":{"body":"DBOOT_D3_DELIVERED_UNIT_ALPHA",
  "requestToken":"dboot-d3-work-a","status":"succeeded"}}` — terminal, and byte-identical when collected
  AGAIN after the cold restart;
* the unit is on disk in the team domain store (fresh scan finds it in `storages/…`);
* the Member's own calls sit in ITS ledger: every admission fact for A's `read` names A's
  `instanceId`/`childSessionId`, and NO admission fact for any of A's callIds appears in any other
  centre ledger file. The only other ledger file, `remote.host-surface.facts.jsonl`, is the Leader-side
  REMOTE-PLANE refusal fact (a host-surface refusal, not a member call) — recorded as evidence, not
  counted as a violation.

## `d3:alpha6` — PROVEN (the typed-refusal shape)

The arm boots a SEPARATE World whose row sets `alpha6ReviewRouting: true`. MEASURED shape, both boots:
the host PROCESS BOOTS (`reachable=true`) and the ROW is refused inside the plugin bootstrap:

```
[dsh-agent-team] bootstrap FAILED: TeamPluginError: dsh-agent-team row config:
ADMISSION_ALPHA6_UNAVAILABLE: alpha6ReviewRouting is explicitly unavailable in this cut.
no review-routing axis exists: Alpha.6 decides who may review whom from the trusted review facts
before any tool call, so there is no locator or lane for the centre to judge, and the decision would
otherwise be made by a second governance authority. A row that enables it would run a second review
authority beside the centre, so the row is refused rather than booted with an unrecorded governance claim
```

and NOTHING is live: `/__p6t6/state` answers **404** (no team root), `teamSession present=false`,
`liveMembers=0`, no Alpha.6 decision, no wake-intent file, no fact file. The typed refusal is a product
rule, not a driver string: `centreConfigViolation` (`packages/runtime/src/plugin/vnext/centre-config.ts:
62-70`) at row validation (`host.ts:723`), over the closed refusal table
(`host-surface-refusal.mjs:50`, `code=ADMISSION_ALPHA6_UNAVAILABLE, axis=host.service`).

**The recorded-fact half is UNREACHABLE at this entry, and the driver says so instead of faking it.** The
config gate runs BEFORE root construction, so `createHostSurfaceRefusalPoint` (the fact writer) is never
built; the refusal is typed in the host log and the host keeps running without the team row. In-process
ADM-85/ADM-98/ADM-99 cover the fact/settlement shapes; a host-boot path that can write the fact would need
the gate moved below root construction (a product change, not a driver change).

## EXTRA measured finding (not a judge): a governed Member's `grep` is REFUSED by the durable overlay

B's in-lane `grep` (search root inside B's own compiled lane) is refused even though the LANE allows it:

```
{ "callId": "call-d3-b-grep-probe", "toolName": "grep", "axis": "fs.read",
  "decision": "deny", "laneDecision": "allow",
  "refusalCode": "ADMISSION_OVERLAY_FAULT",
  "reason": "the durable overlay could not be consulted (canonicalization failed for tool \"grep\":
             tool-unsupported); a fault is a refusal, never an absence of opinion" }
```

The closed permission vocabulary is `read/read_image/write/edit` + `bash/pwsh`
(`packages/runtime/operation-permission/types.ts:59-64`, `:90-93`), and
`classifyPermissionTool` (`canonical-operation.ts:260-267`) returns `unsupported` for everything else, so
the overlay cannot canonicalize a search tool and the adapter turns that fault into a deny. This is why the
crash judge's in-flight call is an `edit` and not a `grep`: the crash judge must never fake an in-flight
call, so it uses a call the product actually admits. Two lawful shapes: (A) add the search face
(`grep`, `glob`) to the closed permission vocabulary with a subtree resource so the overlay can canonicalize
it; or (B) rule that the overlay judges only the six canonicalizable tools and the lane alone judges the
search face (then the adapter must not map "unsupported" to a fault for a lane-allowed call).

## Files

| path | content |
| --- | --- |
| `driver.log` | the whole run, both boots, all stage lines |
| `run-ledger.jsonl` | the RUN record ledger (host starts, cases, result) |
| `runs/boot01/`, `runs/boot02/` | per-boot evidence: `verdicts.json` (every clause), `before-crash.json`, `after-restart.json`, `crash.json`, `crash-call.json`, `centre-facts-a.json`, `centre-facts-b.json`, `collect*.json`, `member-*-transcript.txt`, `member-*-session.v4.jsonl.zstd` (raw session files), `state-after-restart.json`, `alpha6-arm.json` + `alpha6-host.log`, `leader-surface.json`, `member-surface.json`, `host-log-before-crash.log`, `counters.json`, `run-record.json` |
| `agreement.json` / `agreement.txt` | the two-boot agreement (identical rows) |
| `plan-patch.yml` | the composed profile patch of the last boot (what actually mounted) |
| `plan.log`, `plan/plan-patch.yml` | the HOST-FREE `--plan` probe: the CCR refusal on `$.memberIoCeilings[0].io.process`, the 14 mounted preset plugins (no `tool-bash-persistent`) and the patch the plan would compose. `--plan` writes ONLY these two paths — it never touches `driver.log` or the measured `runs/` (a plan run that rewrote the run record was measured and fixed in this round; the record was then re-measured so `driver-digest.json` binds the committed driver byte-for-byte). |
| `driver-digest.json` | the driver file digest bound into the RUN record |
| `host-tree-porcelain.txt` | the pristine host tree's porcelain (empty) |
| `archive/` | EARLIER iterations from the same development session (each `runs/` is archived before a new run starts, never overwritten). They are the repair trail of the driver itself, not part of the two-boot measured record; the measured record is `runs/boot01` + `runs/boot02` and `agreement.*`. |

## What this round does NOT prove

Any candidate/product-proven status (all DEV-LIVE). A persistent subprocess session (refused). A process
lane declaration (no declaration source in v4; CCR unchanged). The Alpha.6 recorded-fact/wake path at a
host entry (unreachable before root construction; in-process only). A search-capable governed Member
(`grep`/`glob` refused by the overlay). A real-model interleaving (the model is the product's scripted
mock provider). The 256 MiB `edit` window is a timing aid, not a claim about long-running tools: the
settlement is open at the kill in both boots, but the driver kills as soon as it observes the open state.
