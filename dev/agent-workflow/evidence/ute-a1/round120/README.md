# Round 120 — the real-model acceptance run: capture at the provider seam, discovery by predicate

Worktree `.worktrees/vnext-a1-cut`, branch `vnext/a1-cut`, base `1a3a79c4c`. Sole writer; no history
rewrite, no merge, no non-topic push. PR **#822 stays DRAFT**. `:3080` and its `DSH_HOME` were never
touched. **CORE PATCH BUDGET = 0**: both pinned hosts were read-only; nothing upstream was patched.

**The one sentence:** with the model route captured at the provider boundary and every judge-discovered
call located by predicate over the OBSERVED transcript, the real model (`deepseek-v4-flash` on legacy,
`deepseek-flash` on next) drove **all 20 judges to PROVEN on both boots of both pinned hosts**
(`agreeing pair=true`, RUN records `DEV-LIVE` / `overall: PASS`), with the four negative controls
observed (deny / Stop / duplicate approval / restart-no-replay) and the scripted positive control still
20/20. The level is **`DEV-LIVE-real-model`** — development evidence, **never** PRODUCT-PROVEN.

## A. Credential discipline

- The key lives only in the repo-root `.env` (outside this worktree). It was loaded per shell with
  `set -a; . /home/armourpiercer/projects/dsh-agent-team/.env; set +a`, never `cat`-ed, never `echo`-ed,
  never `set -x`-ed, and unset at the end of every invocation.
- The driver reads it **by name** (`DEEPSEEK_API_KEY`). The recorder at the provider boundary records
  request/response **bodies** and a `systemHead` — **never headers**, so no `x-api-key`/`authorization`
  value can reach the sink.
- Mechanical self-check at the end of the round: `git grep` for the literal value over the worktree,
  over `dev/agent-workflow/evidence/` and over `.artifacts/` → no match; `git ls-files` → no `.env`;
  `git status --porcelain` → no `.env`.

## B. The capture seam (what changed, and why not a proxy)

Round 119 proved both hosts answer a real model turn, and that the driver could not see it: its only
transcript was `world.mock.requests`, which is empty under `--model real`. Round 120 captures the real
route at the **same seam the host itself uses** — the public `DEEPSEEK_BASE_URL` override — with an
in-process, pass-through recorder (`tests/world-factory/lib/model-call-recorder.mjs`):

```
host  →  http://127.0.0.1:<ephemeral>/anthropic  →  https://api.deepseek.com/anthropic
                (recorder: forwards req.url verbatim, then parses the reply)
```

- **No proxy was written from scratch.** It is a `node:http` server in the driver process, not a
  separate service, not a MITM certificate, not a copy of the host's transport.
- **Forwarding is verbatim**: the incoming path (`/anthropic/v1/messages`) is appended to the upstream
  origin as-is; the round-119 diagnostic had measured that `new URL(req.url, upstream)` drops the
  `/anthropic` prefix. Response bytes are relayed unchanged except for `accept-encoding: identity`
  (gzip bodies lost the reply text in round 119) and the transfer headers that no longer apply.
- **Per call it records**: `seq`, `at`, `method`, `path`, `model`, `stream`, `toolNames`/`toolCount`
  (the advertised surface), `systemHead`, a per-message **summary** (`role`, `text`, `toolUses`,
  `toolResults` with `toolUseId`/`isError`/`text`), the assistant reply (`text`, `thinking`, `toolUses`
  with **name + full input**, `stopReason`, `usage`). It never records request headers.
- The sink is JSONL per boot (`runs/bootNN/model-calls-positive.jsonl`,
  `model-calls-negative-ask-denied.jsonl`, `…-ask-stopped.jsonl`) plus a `model-calls.snapshot.json`
  in `finally`; `model-transcript.json` is the judged snapshot (called tools, advertised tools, an
  excerpt, the discovery table).
- The recorder is pointed at with `startRealProvider({ baseUrl: http://127.0.0.1:<port>/anthropic })`,
  a public seam of the host test kit. **Scripted mode does not start it** and still reads
  `world.mock.requests` — byte-for-byte the old behaviour.

Evidence shape (real, boot 1 legacy, abridged):

```json
{"seq":4,"at":"2026-11-25T19:47:0x.xxxZ","path":"/anthropic/v1/messages","model":"deepseek-v4-flash",
 "toolCount":43,"messageRoles":["user","assistant","user"],
 "messages":[{"index":2,"role":"user","toolResults":[{"toolUseId":"call_00_…","isError":false,"text":"…"}]}],
 "reply":{"text":"","toolUses":[{"id":"call_00_…","name":"team_delegate","input":{"delegationTemplateId":"officer",…}}]}}
```

## C. Turn gates — from vacuous to non-vacuous

| | round 119 (broken) | round 120 |
| --- | --- | --- |
| `sawReply(marker)` scripted | `requests().some(r => reply.startsWith(marker))` | unchanged (byte-identical) |
| `sawReply(marker)` real | `true` **unconditionally** | `observed().assistantTurnsWithToolUse({afterTurn: promptMark-1}) > 0` |
| `promptTurn` real | returned after the HTTP 200 | waits for the durable assistant message **and** re-checks the observed tool-use turn; a zero-turn prompt throws `REAL-TURN-MISS: prompt(<tag>) produced no observed assistant turn with a tool-use block` |
| officer turn | judged the instant the tool result landed | waits for the officer's own final text (30 s) before judging, so `finalAssistant=""` cannot fail a turn that did happen |

A zero-turn prompt can therefore never pass: it aborts with a **named reason**, and the self-test
(`discovery-self-test.json`, 6/6) pins `turn-gate-zero-tool-use expected=0 observed=0`.

## D. Discovery — before and after

Round 119 keyed every judge to the scripted mock's fixed ids (`call-d4-worker-write`,
`call-rm-leader-collect`, …), which do not exist under a real provider.

**After:** each judge names *what it needs* as a predicate over the observed transcript
(`tests/world-factory/lib/model-transcript.mjs`):

```js
matchToolUse({ name: 'write', argPath: 'file_path', argValue: paths.workerFile })
matchToolUse({ name: 'team_resolve_control', argPath: 'requestId', argValue: ids.pendingRequestId, nth: 2 })
matchToolUse({ name: 'team_collect', argPath: 'requestToken', argValue: 'rm-collect-1' })
```

`matchToolUse` supports `name`, `argPath`/`argValue`, `argIncludes`, `anyArgIncludes`, `nth` (1-based
occurrence), `afterTurn`/`beforeTurn`. Discovery is **by tool name + argument shape + ordering**, and a
miss raises `DiscoveryMissError` → the judge's own named REFUTED (`DISCOVERY-MISS(<slot>): <predicate>
matched no observed tool_use block in N observed turn(s)`), never a silent pass and never a
`selected case produced no verdict`. The discovered id is written into `model-transcript.json`'s
`discovery` table (`matchedId`, `turnIndex`, input excerpt) so the evidence shows *which* real call the
judge read.

**No judge assertion changed.** The ids that remain literal are *arguments* the scenario itself names
(the `requestToken`s `dboot-d4-delegate-officer` / `-worker`, `rm-collect-1`), which the real model is
instructed to send verbatim.

## E. The scripted positive control (unchanged behaviour) and the discovery self-test

The scripted arm is the proof the refactor did not weaken anything:

- 2 boots, both `overall: PASS`, **20/20 PASS**, `agreeing=true differing=[]`, exit 0, both RUN records
  valid (`scripted-control/`).
- The discovery self-test runs before every real run and writes `discovery-self-test.json`; 6/6:
  `zero-turns` → `DISCOVERY-MISS`, `right-tool-wrong-argument` → `DISCOVERY-MISS`,
  `right-tool-wrong-occurrence` → `DISCOVERY-MISS`, `right-tool-right-argument` → `MATCH`,
  `turn-gate-zero-tool-use` → 0, `turn-gate-one-tool-use` → 1. The three negative cases are the
  mechanical proof that discovery **cannot pass vacuously**.

## F. The two required runs

```
set -a; . /home/armourpiercer/projects/dsh-agent-team/.env; set +a
TEAM_TEST_HOST=legacy node tests/world-factory/drivers/d-boot-feasibility/run-real-model.mjs --model real --boots 2
TEAM_TEST_HOST=next   node tests/world-factory/drivers/d-boot-feasibility/run-real-model.mjs --model real --boots 2
```

| host | pin | model id the host chose | exit | boots | per-boot overall | agreement | duration |
| --- | --- | --- | --- | --- | --- | --- | --- |
| legacy (rc.2) | `639ed01539` | `deepseek-v4-flash` | **0** | 2/2 | `PASS`, `PASS` | `agreeing=true differing=[]` | **892 s** (14 min 52 s) |
| next (rc.5) | `9c2670d3bc` | `deepseek-flash` | **0** | 2/2 | `PASS`, `PASS` | `agreeing=true differing=[]` | **180 s** |

Both runs: `evidence-complete=true allBooted=true blocked=false runRecordsValid=true (2/2 boots;
agreeing pair=true)`; each boot's RUN record is `recordClass: DEV-LIVE`, `overall: PASS`, 20/20 cases
`PASS`. The advertised tool surface differs by host pin (43 tools on legacy, 49 on next; member
sessions 34) and the host-chosen model id differs — the *judged facts* did not.

### Per-judge result (both hosts, both boots)

| judge | legacy b1 | legacy b2 | next b1 | next b2 | what it holds |
| --- | --- | --- | --- | --- | --- |
| `rm:enablement` | PROVEN | PROVEN | PROVEN | PROVEN | the v5 row enables; host boots; TeamSession served |
| `rm:officer-up` | PROVEN | PROVEN | PROVEN | PROVEN | Officer member row + own child session + its turn's exact token |
| `rm:officer-binding` | PROVEN | PROVEN | PROVEN | PROVEN | Officer's own read admitted under the officer binding, settlement COMPLETED, not the Leader |
| `rm:routed-wake` | PROVEN | PROVEN | PROVEN | PROVEN | routed → delivered workload end-to-end, machine-attributed |
| `rm:case-created` | PROVEN | PROVEN | PROVEN | PROVEN | a real durable approval case for the ordinary ask |
| `rm:router-officer` | PROVEN | PROVEN | PROVEN | PROVEN | unique lawful Officer; self-ask routes to Leader |
| `rm:wake-delivered` | PROVEN | PROVEN | PROVEN | PROVEN | one intent, one correlated delivery, zero management-plane executions |
| `rm:officer-decides` | PROVEN | PROVEN | PROVEN | PROVEN | Officer's own `team_resolve_control` admitted under its binding |
| `rm:ask-executes-after-review` | PROVEN | PROVEN | PROVEN | PROVEN | decision precedes execution; bytes land |
| `rm:duplicate-route` | PROVEN | PROVEN | PROVEN | PROVEN | duplicate route → exactly one wake |
| `rm:sticky-stop` | PROVEN | PROVEN | PROVEN | PROVEN | a wake does not clear a human Sticky Stop; held ask survives |
| `rm:refusal` | PROVEN | PROVEN | PROVEN | PROVEN | incoherent row refused |
| `rm:ask-execute` | PROVEN | PROVEN | PROVEN | PROVEN | first write: ask → real control → execute (bytes+sha) |
| `rm:ask-execute-2` | PROVEN | PROVEN | PROVEN | PROVEN | second write, own request, own decision |
| `rm:ask-denied` | PROVEN | PROVEN | PROVEN | PROVEN | deny → zero bytes, REFUSED / not-started, deny fact |
| `rm:ask-stopped` | PROVEN | PROVEN | PROVEN | PROVEN | cancel while pending → `ADMISSION_STOPPED`, zero bytes |
| `rm:leader-creates-worker` | PROVEN | PROVEN | PROVEN | PROVEN | worker activated through the product's delegation path |
| `rm:collect` | PROVEN | PROVEN | PROVEN | PROVEN | `team_collect` returns the work unit |
| `rm:duplicate-approval` | PROVEN | PROVEN | PROVEN | PROVEN | second decision rejected `CONTROL_REQUEST_DECIDED`, one execution |
| `rm:restart-no-replay` | PROVEN | PROVEN | PROVEN | PROVEN | restart: same bytes, one decision, one execution, no replay |

Nothing is not-run; nothing is fail-closed; `knownRefuted` is **not** used for any of the 20.

## G. The four negative controls — the observed replies

These are the model's own tool calls and the product's own results, read from the recorder transcript
(`ask-denied.json`, `ask-stopped.json`, `duplicate-approval.json`, `restart-no-replay.json` each carry
an `observed` excerpt).

**Deny (legacy; next identical in shape, ids differ):** the Leader called

```json
{"rootSessionId":"session-real-model-root","requestToken":"dboot-d4-resolve-ctrl-020wbu71jgo8vg07ny0ih0fs",
 "requestId":"ctrl-020wbu71jgo8vg07ny0ih0fs","decision":"deny"}
```

and the product answered
`{"status":"control-resolved","decision":{"requestId":"ctrl-020wbu71jgo8vg07ny0ih0fs","decision":"deny","decider":{"kind":"instance","instanceId":"inst-leader","role":"leader"},…}}`;
the worker's write then returned
`Error: ADMISSION_APPROVAL_DENIED: the durable control decision for "ctrl-020wbu71jgo8vg07ny0ih0fs" is deny; the call is refused`,
the file does not exist, and the settlement is `REFUSED` / `not-started`.

**Stop (both hosts):** `session/cancel` → **200**; the durable deny fact carries
`{"refusalCode":"ADMISSION_STOPPED","decision":"deny"}`; file does not exist; settlement
`REFUSED` / `not-started`, transitions `["ADMITTED","REFUSED"]`.

**Duplicate approval (legacy shown):** the model called `team_resolve_control` a second time for an
already-settled request —

```json
{"decision":"allow","requestId":"ctrl-0r00tkx1icxid016uosxn15f",
 "requestToken":"rm-dup-resolve-ctrl-0r00tkx1icxid016uosxn15f","rootSessionId":"session-real-model-root"}
```

— and the product rejected it:
`{"status":"rejected","code":"CONTROL_REQUEST_DECIDED","message":"ControlService: request 'ctrl-0r00tkx1icxid016uosxn15f' already carries a durable decision (the first decision is authoritative)"}`.
One decision, one execution.

**Restart-no-replay (both hosts, identical bytes):** after stopping and re-booting the same World,
`before` and `after` are equal — `fileSha256=ced10112e5b8…`, `decisions=1`, `executions=1`,
`wakeRouted=1`, `wakeDelivered=0`: the restart replays nothing.

## H. The one measured non-judge row

`d4:ask-execute-process` is measured and logged but is **not one of the 20**: it is the single
enumerated `knownRefuted` fact (the confined shell has no PTY backend in this world:
`Error: no PTY backend registered for "a5sf-governed-shell"`), REFUTED on both hosts, exactly as in
the scripted baseline. It is reported as REFUTED, not hidden and not moved.

## I. The attempt trail (every red is preserved, none was weakened)

No judge assertion, timeout or retry was changed to flip a red. Every attempt directory is committed
under `../d-boot-feasibility/real-model/archive/` with the defect it exposed:

| attempt | defect it exposed | disposition |
| --- | --- | --- |
| `2026-11-25T18-59Z-…-census-overstrict` | the durable-reader census demanded exactly four control requests; the real model legitimately raised a fifth (a second observed `bash sleep 45`) | census now classifies extras by **observed tool_use id**; the four judged asks are still required and still counted distinct |
| `2026-11-25T19-07Z-…-wake-prompt-self-taint` | the driver's own officer prompt contained the literal `[team-review-wake` marker, so `rm:wake-delivered` saw a *human*-attributed wake | the prompts name the event, not its bytes; the judge is unchanged; re-measured all-machine |
| `2026-11-25T19-15Z-…-raw-marker-arm` | the negative arm still sent the raw scripted marker in real mode; the model grepped the repo instead of delegating | the arm sends the same real scenario prompt as the positive flow |
| `2026-11-25T19-33Z-…-deny-no-team-resolve` | the Leader's own exploration loop queued the deny prompt; zero `team_resolve_control` in 30 turns | the driver interrupts the Leader's in-flight turn first (a real user's next prompt would); the model then called the tool |
| `2026-11-25T19-45Z-…-delegate-result-early` | the delegation tool result was read one turn before the follow-up request carried it → `rm:leader-creates-worker` REFUTED while the ledger held the whole delegation | wait for the observed tool result, then judge |
| `2026-11-25T20-13Z-…-next-boot2-worker-text-only` | next boot 2's worker answered the task with TEXT and never called `write`, so the deny arm raised no ask | prompt amendment (below), then both hosts re-run |
| `2026-11-25T20-03Z-…-delegate-result-fix` | not a defect: legacy went 20/20 with the pre-amendment worker prompt | superseded by amendment 2b and re-run on both hosts so the committed evidence matches the committed driver |

### Prompt amendment (dated 2026-11-26)

The real-mode scenario prompts differ from the scripted markers and the difference is disclosed:
`../../../../evidence/d-boot-feasibility/real-model/PROMPT-AMENDMENT.md` retains the old prompt text.
Two amendments are dated in this round: (1) the initial real-mode rewrite (the markers named no tool,
argument or success token); (2) the worker task's opening line, after the next boot-2 worker answered
with text instead of calling `write` — *"Do NOT answer with text. Your first action MUST be the Step 1
tool call; do not run bash, do not read files, do not explore the repository."* The scenario is the
same; **no judge changed**.

## J. What remains unproven

- This is **`DEV-LIVE-real-model`**, not candidate acceptance: the *version gate* (`ute-cut-closure` /
  candidate acceptance gate) has not been run with a real model at a frozen version SHA, and the
  two-run agreement is over two boots on each host, not over two independent model sessions across
  time.
- The real model is non-deterministic: the same driver produced one flaky negative-arm boot (attempt
  above). The judged positive path reproduced on 2/2 boots on both hosts in the accepted runs, and the
  flake is preserved rather than retried away.
- The `deepseek-flash` vs `deepseek-v4-flash` difference is the **host pin's** choice, not the
  driver's: the driver names no model.
- `d4:ask-execute-process` remains the single known-refuted measurement (no PTY backend in the
  governed-shell world).
- No row is **PRODUCT-PROVEN**; no `knownRefuted` entry was added or removed.

## K. Evidence map

| path | contents |
| --- | --- |
| `real-legacy/` | legacy run: `results.json`, `agreement.*`, `run.log`, `boot01/`, `boot02/` (verdicts, RUN record + self-check, per-judge json, recorder JSONL, discovery table) |
| `real-next/` | next run: same set |
| `scripted-control/` | the scripted 2-boot positive control (20/20, agreeing) with its run records |
| `probe.json`/`../…/real-model/probe.json` | `REAL-ROUTE-AVAILABLE`, `available: true` |
| `../…/real-model/PROMPT-AMENDMENT.md` | dated prompt history |
| `../…/real-model/archive/` | every attempt, named by the defect it exposed |
