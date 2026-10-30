# u7r3-uif4 — ask_user_question L4 through PUBLIC faces only (C2, real UTC 2026-10-30)

Lane `u7r3-uif4` · pool **C2** · **2 of 3 starts consumed** · subject team SHA
`e2f14c71bd65e3671ed72bffe9b7092db8d1b3b8` (origin/master tip at spawn) · Host
`639ed01539…` (pristine 0.2.0-rc.2) · CORE PATCH BUDGET = 0 respected (no product
or host tracked file touched: tree tracked-porcelain 0 before/after both starts).

## The one-paragraph answer

**The public answering face is live, and the governed team-member path cannot reach
it.** In one World boot, the runner played the Human over public faces only
(`GET /?token` cookie → `/api/remote.mux` `$events` stream →
`POST /api/$events/result`) and a real `ask_user_question` came back
**`{"answers":[{"id":"uif4-nq1","selected":["Native A"]}]}` inside its tool_result,
`is_error:false`** — that ask was the Host's OWN tool in a plain session (its call
site passes `exec.agent`). The governed member row did everything else right: its
`default: ask` template created a durable Control row, the runner allowed it through
`team.resolveControl` v4 with `decider.kind:"human"`, the allow was consumed — and
then the UI family's interaction port refused:
`governed-ask port-failed detail=no user-questions answerer accepted the request`
(→ `refused-io UI_INTERACTION_PORT_FAILED`). The gap is located, not speculative:
`packages/tools/families/ui.mjs:82` builds the port as
`createUserQuestionsPort(service)` with **no Agent binding**, `CAPABILITY_KEYS` has
no live-agent handle to give it one, and the Host only forwards a `waterfall` event
when the carrier has a scope key **and** `request.agent === carrierAgent`
(`packages/api/remotes/src/index.ts:57-67`). No Agent ⇒ `next()` ⇒ no answerer ⇒
`NO_PROVIDER`. Closing that needs a product change, i.e. it is out of reach at
CORE PATCH BUDGET = 0 — which is itself the decisive result this lane was asked for.

## Per-cell verdicts (exactly as the run recorded them — no softening)

| cell | verdict | the witness that earns it |
| --- | --- | --- |
| `ui:ask-approved-ran` | **FAIL** | `governed-ask RAN` count = **0**; instead `governed-ask port-failed detail=no user-questions answerer accepted the request` + tool_result `Error: refused-io UI_INTERACTION_PORT_FAILED …` (product law, located above) |
| `ui:ask-approval-chain` | **PASS** | two `control-request-recorded` rows `toolName=ask_user_question` (fingerprint `tadm:…:inst-09jazg31pjap:sha256:ac507b38…`) → `allow` (`decider.kind:"human"`, HTTP 200) → `control-allow-consumed`; second row `deny` → `governed-ask pa-refused code=APPROVAL_DENIED …`. Leader template carried **no** control tool |
| `ui:ask-replay-refused` | **PASS** | second `team.resolveControl` on the settled `ctrl-0hye522136a…` → `result.ok:false, code:CONTROL_REQUEST_DECIDED` ("already carries a durable decision"); `governed-ask RAN` still 0 |
| `ui:answer-wire` | **PASS** | 101 upgrade → `open $events {args:{}}` → **item-wrapped** `ready{clientId:4388b3ed-67cb-…,host:{home:"/home/user"}}` → `waterfall{event:"user-questions/request",eventId:425456fa-…,agentId:session-ee6fa6c7-…,request.questions[]}` → `POST /api/$events/result {clientId,eventId,outcome}` → `{"result":{"ok":true}}`; 75 transport frames, all `item` |
| `ui:live-root-law` | **NOT_REACHED** | `assertLiveRoot` (user-questions `index.ts:295,131-141`) is only entered when the request carries an Agent — the governed path never attaches one, so L2 is un-exercisable there; the native arm succeeded instead of being refused, so no `CALLER_NOT_LIVE`/`DELEGATED_CALLER` surfaced. NOT_RUN-safe by lane order: **no extra start burned** |
| `ui:present-env-truth` | **PASS** | `governed-present port-refusal` + tool_result `refused-admission UI_PRESENT_PORT_ABSENT …`; planted file SHA unchanged `5abaf195…`; zero extra boots for this cell |
| `ui:leak-check` | **FAIL** | the run's own cell failed on **the lane's own** `cleanup()` scope bug (`world is not defined`), not on a leak. Kept as FAIL; the same audit done by hand is in [`c2/LEAK-AUDIT-manual.md`](c2/LEAK-AUDIT-manual.md) (ports 3191/3192/13056/13057 closed, `:3080` 401 throughout, `~/.dsh` mtime 2026-10-28 untouched, 0 lane World homes left, tracked porcelain 0) |

Runner summary line: `overall=FAIL cases=8 FAIL:2 NOT_REACHED:1 PASS:5`.

## Files here

| file | what it is |
| --- | --- |
| [`c2/run-uif4-p2-reconstructed.json`](c2/run-uif4-p2-reconstructed.json) | **lane reconstruction** of the start#2 record (the runner only writes a record with `--run-record`, which neither start passed — disclosed as a discipline miss); every field quotes the run's own artifacts |
| [`c2/run-p2.stdout.log`](c2/run-p2.stdout.log) | start#2 verbatim output: the wire/approval/answer lines and every `case …` verdict line |
| [`c2/u5-…p2-….uif4-evidence.json`](c2/u5-u7r3-uif4-pos-p2-2026-10-30T13-11-09-777Z.uif4-evidence.json) | the suite's machine-readable facts: raw frames, control rows/resolutions/consumption, member tool_result heads, oracle SHAs |
| [`c2/RCA-start1-abort.md`](c2/RCA-start1-abort.md) | why start#1 never reached a cell (unbounded `nextFrame()` await) + the wire-law finding that the mux transport wraps the event envelope inside `item.value` |
| [`c2/start1-p1-world-remnants/`](c2/start1-p1-world-remnants/) | start#1 World post-mortem witnesses (team-domain rows, shadow ledger, the 1-line ROOT session journal proving zero turns ran) |
| [`c2/u5p1-….host-log.redacted.txt`](c2/u5p1-20261030T12-47-29Z.host-log.redacted.txt) / [`…u5p2….txt`](c2/u5p2-20261030T13-11-09Z.host-log.redacted.txt) | bounded Host logs, boot token + auth cookies redacted |
| [`c2/LEAK-AUDIT-manual.md`](c2/LEAK-AUDIT-manual.md) | the hand redone leak audit with fresh probe output |
| [`host-start-budget.jsonl`](host-start-budget.jsonl) | per-spawn accounting, 2 lines, hard cap 3 |

## Budget and discipline

* p1 (12:47:29Z) aborted with no record → RCA first, then ONE fix-forward retry, as the lane order prescribes.
* p2 (13:11:09Z) produced the full verdict set above.
* **p3 NOT spent**: both failures were lane-kit class, and the third start was reserved for ENV; same-class rule → stop and report.
* Worlds: p2 torn down by the runner's registry, p1 removed by hand after its witnesses were copied out (TEST_METHODS §7).
* **No push** (AGENTS.md red line); this branch is local: `task/u7r3-uif4-20261030`, carrying the cherry-picked pre-registration row `fa756733d` + the actuals receipt.
* The answering client `tests/world-factory/lib/u7r3-uif4-answer.mjs` is this lane's dependency-free inline of the **unmerged** PR #489 fixture (`refs/heads/task/u7r3-uileg0-20261030` @ `ffeaf68d6…` at spawn) **plus** the live carrier that fixture left `NOT_VERIFIED` — lane test code only, never product. Its pinned predicates were corrected against the live Host protocol; the correction and the live frame capture are both in the record.

## What the coordinator should take from this lane

1. **Q1 flips for the governed path**: a governed `ask_user_question` cannot be answered through public faces today — `packages/tools/families/ui.mjs:82` hands the port no Agent, and the Host's waterfall law requires one. Anything in the ledger that assumed "L4 positive is reachable via the family port alone" needs re-reading.
2. **The public face itself needs no product work**: item-wrapped `ready`/`waterfall` + `POST /api/$events/result` works live end-to-end (75 frames, `result.ok:true`, answer verbatim in the tool_result). LEG-0's envelope pin is right; its **frame-layer** description is wrong for 0.2.0-rc.2, and any client written from it will hang silently — worth patching in the #489 fixture before merge.
3. The two lane-kit defects found here are fixed on this branch (bounded `nextFrame`, guaranteed `cleanup()`, bounded approver, drive deadlines inside the run-control watchdog), so a future lane can reuse `085-u7r3-uif4-pos.mjs` shape directly.
4. `ui:live-root-law` remains un-witnessed: to exercise `assertLiveRoot` from a team member, the member's ask must carry an Agent — same product gap as (1).
