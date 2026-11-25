# REAL-MODEL ACCEPTANCE — the probe, the harness, and the level actually reached

**Driver:** `tests/world-factory/drivers/d-boot-feasibility/run-real-model.mjs`
**Evidence:** this directory (`probe.json`, `runs/`, `run-ledger.jsonl`, `diagnostic/`, `archive/`).
**Latest round:** 2026-11-26, branch `vnext/a1-cut` @ `b2f4b1a08` (sole-writer worktree).
**Previous round (kept verbatim below):** 2026-11-25, `82da9ca9f` — `ENV-LIMITED`.

> ## THE LEVEL: the real route is AVAILABLE; REAL-MODEL ACCEPTANCE IS **NOT ACHIEVED**.
> The owner-supplied key was present, **both** hosts booted on a **real endpoint** and answered a real
> model turn, and the driver exited **1** on both hosts because its real-mode instrument aborts before
> the first judge: `world.mock.requests` is `null` when no mock exists. All 20 judges are recorded
> `FAIL` / not-run. This is **not** acceptance, **not** `DEV-LIVE-real-model`, and **not** `ENV-LIMITED`
> either — the environment precondition is satisfied and the blocker is in the driver.

---

## 0. Dated result — 2026-11-26 (review `20261125-0058` Stage B follow-up)

### 0.1 The two required runs

```
set -a; . /home/armourpiercer/projects/dsh-agent-team/.env; set +a
TEAM_TEST_HOST=legacy node tests/world-factory/drivers/d-boot-feasibility/run-real-model.mjs --model real --boots 2
TEAM_TEST_HOST=next   node tests/world-factory/drivers/d-boot-feasibility/run-real-model.mjs --model real --boots 2
```

The key is read by NAME inside the driver (`DEEPSEEK_API_KEY`); it is never printed, echoed or hashed.

| host | pin | exit | boots | per-boot overall | agreement | duration |
| --- | --- | --- | --- | --- | --- | --- |
| legacy (rc.2) | `639ed01539` | **1** | 2/2 booted, both aborted after the first real turn | `ERROR` → RUN record `FAIL` | `agreeing=true differing=[]` | **200 s** |
| next (rc.5) | `9c2670d3bc` | **1** | 2/2 booted, both aborted after the first real turn | `ERROR` → RUN record `FAIL` | `agreeing=true differing=[]` | **31 s** |

Probe: the 2026-11-26 run wrote `level: "REAL-ROUTE-AVAILABLE"`, `available: true`, `missing: null`; that
record is preserved as `diagnostic/diagnostic3-root-artifacts/probe.json` because the **root** `probe.json`
remains the committed round-111 `ENV-LIMITED` record (the root `runs/` are likewise the scripted baseline).
`ENV-LIMITED.txt` is the 2026-11-25 artifact and is **not** the current level.

Preserved evidence: `archive/2026-11-25T16-15Z-real-legacy/` (the legacy run's root artifacts — probe,
results, agreement, run.log — plus its console log) with the two legacy RUN records in
`archive/2026-11-25T16-15-36-219Z/`; and `archive/2026-11-25T16-15Z-real-next-artifacts/` (the next host's
root artifacts) with its two RUN records in `archive/2026-11-25T16-16-34-959Z/` and its console log at this
evidence root (`console-next-20261125T161536Z.log`). Both hosts therefore have their own probe, results,
agreement and RUN records; the diagnostic passes that overwrote the root files are archived separately
(§0.4).

### 0.2 Model id and route (measured, not assumed)

- The driver has **no model-id option**: it reads `DEEPSEEK_API_KEY` and an optional base URL
  (`--base-url` / `DEEPSEEK_BASE_URL`, `run-real-model.mjs:280-290`). The model is chosen by the host
  composition — `cordis.patch.yml:169-171` `staticModel { provider: deepseek-official, model:
  deepseek-v4-flash }` and the pinned bundle's `agent-default-model` — not by the driver.
- On the wire (diagnostic, §0.4) the host requested **`deepseek-v4-flash`** at
  `POST https://api.deepseek.com/anthropic/v1/messages` → HTTP **200**.
- Endpoint probe (names only): `GET /models` advertises `deepseek-flash`, `deepseek-v4-pro`;
  `POST /anthropic/v1/messages` accepted `deepseek-flash`, `deepseek-v4-flash`, `deepseek-v4-pro`
  (200 each) and refused `deepseek-v4.1-flash-1017` (400 — "supported API model names are
  deepseek-flash, deepseek-v4-pro"). The owner-named id is the **seat** model of the coding session,
  not an API model name; the host's own default is valid.

### 0.3 Per-judge result — 20 judges × 2 boots × 2 hosts

Every judge is recorded `FAIL` with `detail.reason = "selected case produced no verdict
(fail-closed)"`, because the probe threw in the discovery stage of each boot:

| judge | legacy b1 / b2 | next b1 / b2 |
| --- | --- | --- |
| `rm:enablement` | FAIL / FAIL | FAIL / FAIL |
| `rm:officer-up` | FAIL / FAIL | FAIL / FAIL |
| `rm:officer-binding` | FAIL / FAIL | FAIL / FAIL |
| `rm:routed-wake` | FAIL / FAIL | FAIL / FAIL |
| `rm:case-created` | FAIL / FAIL | FAIL / FAIL |
| `rm:router-officer` | FAIL / FAIL | FAIL / FAIL |
| `rm:wake-delivered` | FAIL / FAIL | FAIL / FAIL |
| `rm:officer-decides` | FAIL / FAIL | FAIL / FAIL |
| `rm:ask-executes-after-review` | FAIL / FAIL | FAIL / FAIL |
| `rm:duplicate-route` | FAIL / FAIL | FAIL / FAIL |
| `rm:sticky-stop` | FAIL / FAIL | FAIL / FAIL |
| `rm:refusal` | FAIL / FAIL | FAIL / FAIL |
| `rm:ask-execute` | FAIL / FAIL | FAIL / FAIL |
| `rm:ask-execute-2` | FAIL / FAIL | FAIL / FAIL |
| `rm:ask-denied` | FAIL / FAIL | FAIL / FAIL |
| `rm:ask-stopped` | FAIL / FAIL | FAIL / FAIL |
| `rm:leader-creates-worker` | FAIL / FAIL | FAIL / FAIL |
| `rm:collect` | FAIL / FAIL | FAIL / FAIL |
| `rm:duplicate-approval` | FAIL / FAIL | FAIL / FAIL |
| `rm:restart-no-replay` | FAIL / FAIL | FAIL / FAIL |

**The four negative controls — deny, Stop, duplicate-approval, restart-no-replay — were NOT REACHED.**
There is no typed reply to record for any of them: the run stopped before the ask, the wake, the
decision, the duplicate attempt and the restart. Their reply cells are therefore *not observed*, not
*preserved as absent*.

### 0.4 The exact blocker (driver, not product; environment, not model)

`run-real-model.mjs:2156` selects the Leader surface from `requests()`, and `requests()` is
`world.mock?.requests ?? []` (`:1913`). Under `--model real` there is no mock (`world.mock === null`),
so the array is `[]`, `leaderSurface` is `[]`, and `:2160` throws
`the Leader surface lost 'team_delegate'`. Two further real-mode gaps would be hit immediately after it:
`sawReply()` returns `true` unconditionally in real mode (so the discovery/officer/worker "answered"
gates assert nothing), and every judge below is keyed to the scripted mock's fixed call ids
(`call-d4-worker-write`, `call-rm-leader-collect`, …), which a real model never emits. The real branch of
this driver was written but never executed end to end.

That the **product route itself is sound** was measured separately, with the driver UNCHANGED:

- pass-through recorder, `diagnostic/real-request-capture.json`: two real requests, both **200**; the
  second carried **43 tools**, including all six the judge requires — `team_delegate`, `team_collect`,
  `team_resolve_control`, `team_list_pending_control`, `team_create_member`, `team_archive_member` —
  plus nine more `team_*` tools;
- the durable Leader session of the same boot: one real assistant turn with reasoning and two tool calls
  (`bash`, `grep`); the real model ran and tool-called, but it does not perform the scripted
  choreography the bare markers encode;
- session title event names the route: `provider deepseek-official, model deepseek-v4-flash`.

Commands (recorder is a diagnostic file, NOT part of the driver; it forwards to the real endpoint and
records request BODIES only — never headers):

```
node .artifacts/tmp/d4-rec-proxy.mjs            # PORT=13270, UPSTREAM=https://api.deepseek.com/anthropic
DEEPSEEK_BASE_URL=http://127.0.0.1:13270/anthropic TEAM_TEST_HOST=legacy \
  node tests/world-factory/drivers/d-boot-feasibility/run-real-model.mjs --model real --boots 1
```

Disclosed diagnostic attempts: the first used a `/tmp` recorder file the shell could not see (no
provider contact — `diagnostic/attempt1-proxy-missing-console.log`); the second had a recorder
path-prefix bug that forwarded `/v1/messages` instead of `/anthropic/v1/messages` and produced a 404
(a recorder bug, not a model error — `archive/2026-11-25T16-21Z-diagnostic-attempt2-proxy404/`). The third is
the 200 / 43-tools record above.

### 0.5 Leakage self-check (mechanical)

- `git grep -l "$DEEPSEEK_API_KEY" -- .` over the tracked tree → **no output** (the value is held only
  in a shell variable and never echoed).
- `git status --porcelain` → **no `.env` entry**; `.env` stays untracked and ignored at the repo root.
- No key value or fragment was written into an evidence artifact, console log, commit message or PR
  comment; the probe records NAMES only, the recorder records request bodies (no headers).

### 0.6 Verdict

Neither host is PROVEN. The pair "agrees" only in that both boots fail identically; agreement on an
aborted probe is not agreement of the judged behaviour. **No status row moves** and no
`DEV-LIVE-real-model` level is claimed. Still unproven: all 20 judges on a real model, the four negative
controls, and every model-behaviour row they cover. Completing it needs the driver's real branch
finished (real request capture + call-id discovery + real prompts), not a different environment.

---

# HISTORY — the 2026-11-25 `ENV-LIMITED` round (status superseded; kept verbatim)

> As originally recorded:
>
> **Round:** review `20261125-0058` Stage B, second item ("a controlled real-model scenario, not a scripted model").
> **Driver:** `tests/world-factory/drivers/d-boot-feasibility/run-real-model.mjs`
> **Evidence:** this directory (`probe.json`, `ENV-LIMITED.txt`, `runs/`, `run-ledger.jsonl`).
> **Branch / HEAD at probe time:** `vnext/a1-cut` @ `82da9ca9f` (probe recorded its own HEAD).
>
> > **THE LEVEL CLAIMED: `ENV-LIMITED`.** The harness is complete and executable; the ENVIRONMENT has no
> > real model route for a test host. Nothing in this round is a real-model run, and no run is labelled as
> > one. The scripted self-validation below is labelled **SCRIPTED-ONLY** in the artifact and in every RUN
> > record.



## 1. Probe — what was asked of the environment, and what it answered

The probe is part of the driver (`inspectModelRoute()`), so it cannot drift from what the driver would
consume: it runs before any boot, in both modes, and writes `probe.json`. It reads **record NAMES only**
and never a secret value, never hashes one, never echoes one.

| checked | what it would be used by | result |
| --- | --- | --- |
| `DEEPSEEK_API_KEY` in the launch environment | the pinned hosts' `llm-deepseek-api-key` adapter (`apiKeyEnv` defaults to this ref) | **absent** |
| `DEEPSEEK_BASE_URL` in the launch environment | the same adapter's endpoint override | **absent** |
| every `tests/homes/<world>/.credentials.yaml` (45 worlds, 21 files) | the per-World credential store a test host would read | every file carries exactly one record, `client-connection/browser-session`; **no provider/api-key record** in any World |
| the mock-model deployment `packages/tools/harness/mock-deepseek.mjs` | the WorldFactory's default route (`startMock` sets `DEEPSEEK_BASE_URL` → in-process mock, `DEEPSEEK_API_KEY=u5-fake-key`) | **present, and the only route wired by default** — which is exactly why it is not evidence of a real model |
| rc.2 host wiring (`tests/deepseek-harness-test-use`) | the selected host's provider plugin | provider `deepseek-official`, `apiKeyEnv` default `DEEPSEEK_API_KEY` |
| rc.5 host wiring (`tests/deepseek-harness-next`) | the same, for the next generation | provider `deepseek-official`, `apiKeyEnv` default `DEEPSEEK_API_KEY` |
| any local OpenAI-compatible/model server on the test bands | an alternative route | none listening |


> **`archive/`** holds the two superseded attempts from THIS round's driver development (each stopped by
> a driver-side bug — a wrongly-scoped judge reference and a settlement counter that matched substring
> ids; both are fixed and the fixes are visible in the diff). They are kept as the honest trail of what was
> run and are **not** evidence: the evidence is the two completed boots in `runs/` and `results.json`.

**The exact missing item:** a real credential for the provider the pinned hosts already ship —
**`DEEPSEEK_API_KEY`** (optionally with `DEEPSEEK_BASE_URL` for a non-default endpoint). It is resolved
by `packages/llm/llm-deepseek-api-key` (`apiKeyEnv`, default `DEEPSEEK_API_KEY`) in **both** pinned
generations (`deepseek-official`). It may be supplied either:
- to the driver process: `DEEPSEEK_API_KEY=<real key>` (and optionally `DEEPSEEK_BASE_URL=<endpoint>`), or
- as a `DEEPSEEK_API_KEY` record in the test World's `.credentials.yaml`.

The stable `:3080` profile and its DSH_HOME are **out of scope** (never touched); a credential living
there is not reachable by this driver by design. No other provider is invented, and no mock is relabelled.

`probe.json` is the machine record of the same table (`level: "ENV-LIMITED"`, `missing.item`).

---

## 2. The harness — interface

```
node tests/world-factory/drivers/d-boot-feasibility/run-real-model.mjs \
  --model real|scripted            # default: real
  --boots N                        # default: 2; two agreeing boots
  [--base-url <endpoint>]          # real mode only; defaults to the provider's own default
  [--plan]                         # host-free: validates the v5 documents + the enablement rule
```

- **Host-selectable, no second mechanism:** tree, pin, port band, home suffix and the native `tool-fs`
  module come from `tests/next-host/host-select.mjs` — rc.2 by default, rc.5 under `TEAM_TEST_HOST=next`.
- **`--model real` refuses to pretend:** with no route it writes `probe.json` + `ENV-LIMITED.txt`, exits
  `4`, boots nothing and writes **no RUN record**. With a route it calls
  `world.startRealProvider({ baseUrl, apiKey })` (the WorldFactory's one launcher) and never starts the mock.
- **`--model scripted`** drives the same scenario and the same judges on the shared scripted mock, and is
  labelled `SCRIPTED-ONLY` in the record bindings (`model.mode`), the summary title and this document.
- **Run record:** one `u5-run-record/1` per boot through `createRunRecord` / `addCase` / `finalize`, with
  DEV-LIVE bindings, the dev-live grant, the selected host pin, the real-model probe level and the model
  axis. Every record is validated against `scripts/eb3-run-manifest.mjs` before the run may pass.

## 3. The scenario

One coherent v5 world (Leader + `officer` and `worker` templates, an authored ordinary-ask default,
`reviewRouting.enabled`, centre state, an absolute wake-intent directory), one durable centre, the
shipped governed preset, the pinned host's own `tool-fs`.

| stage | what is driven | judge |
| --- | --- | --- |
| Leader → Worker | the Leader creates the worker through the product's own delegation-with-template path | `rm:leader-creates-worker` |
| Worker → Ask | the worker is asked to write into an `ask` lane; the ask raises the REAL Control case | `rm:case-created` / `rm:router-officer` |
| Officer Review | the product routes the case and wakes the Officer in its OWN session; its `team_resolve_control` is admitted under ITS binding | `rm:wake-delivered` / `rm:officer-decides` |
| Grant | the durable decision precedes the execution; one grant is consumed | `rm:ask-executes-after-review` |
| Worker Execution | the granted call executes; the exact bytes are read by the parent process OUTSIDE the sandbox | `rm:ask-execute` (sha256, not "file exists") |
| Collect | the Leader reads the work unit back with `team_collect` | `rm:collect` |
| Enablement / refusal | coherent row admitted; the same v5 document without `reviewRouting` refused by name | `rm:enablement` / `rm:refusal` |

### Negatives

| negative | control | judge |
| --- | --- | --- |
| **denied ask** | the same ask, decided `deny` through the real control path | `rm:ask-denied` — ZERO bytes, refusal settlement |
| **Stop while pending** | `session/cancel` on the worker's own session while the ask is pending | `rm:ask-stopped` — ZERO bytes, terminal `CANCELLED` |
| **duplicate approval** | a SECOND `team_resolve_control` for an already-settled leg | `rm:duplicate-approval` — ONE decision, ONE execution, bytes unchanged |
| **restart recovery** | stop the same World and reboot it on the SAME home (`create-or-open`) | `rm:restart-no-replay` — no second decision, settlement, wake or byte |
| duplicate route (product's own re-collection) | the notifier + reviewer `turn/end` re-collection | `rm:duplicate-route` — ONE intent, ONE confirmation, ONE input |
| human Sticky Stop outranks a machine wake | a real `session/cancel` then a routed wake | `rm:sticky-stop` |
| incoherent Alpha.6 row | the same v5 document without `reviewRouting` | `rm:refusal` — typed refusal, recorded, zero wakes |

**Declared scope, not a skipped judge.** The driver does **not** declare `d4:ask-execute-process` as one
of its 20 RUN cases. That arm measures the governed **PTY/subprocess** face, which this environment does
not provide (`Error: no PTY backend registered for "a5sf-governed-shell"`) and which the owner already
ruled `UNSUPPORTED BY PRODUCT RULING` for per-call `ask` (SCOPE-subprocess-ask.md; D-ACCEPTANCE row 30,
still `REFUTED` there and unchanged). The real-model scenario's execution stage is the **`write`** lane
(`rm:ask-execute` / `rm:ask-execute-2`), which is present and judged. The arm still runs as an
observation and its verdict is written to `runs/bootNN/ask-execute-process.json` — it is simply not part
of this driver's acceptance claim, because no judge is being passed by dropping it: the same product
limitation stays visible in the d4 row.

## 4. The scripted self-validation (SCRIPTED-ONLY)

When the level is `ENV-LIMITED`, the harness itself is validated against the scripted model, so the
SCENARIO LOGIC and the JUDGES are exercised even though the model is not real:

```
node tests/world-factory/drivers/d-boot-feasibility/run-real-model.mjs --model scripted --boots 2
```

**This is not real-model evidence.** Every RUN record says `model.mode = "scripted"`, every summary line
carries `[SCRIPTED-ONLY]`, and the judge set is identical to the real arm's — the script only plays the
turns; no control row, leg, fact or identity is fabricated by the driver.

### Outcome

*(measured in this round; see `runs/boot01/verdicts.json`, `runs/boot02/verdicts.json`, `agreement.txt`)*

### Outcome — measured, two agreeing boots, labelled SCRIPTED-ONLY

`node ... --model scripted --boots 2` at `82da9ca9f` (rc.2 `639ed01539`, host porcelain `[]` before and
after), 680.4 s + 680.8 s:

| boot | cases | PROVEN | non-PROVEN | overall | RUN record |
| --- | --- | --- | --- | --- | --- |
| 1 | 20 | **20** | 0 | **PASS** | self-check `cases=20 subset=false overall=PASS` |
| 2 | 20 | **20** | 0 | **PASS** | self-check `cases=20 subset=false overall=PASS` |

Agreement: `agreeing=true differing=[]` (both boots produced the same judge map and the same measured
values). The 20 declared judges are: `rm:enablement`, `rm:officer-up`, `rm:officer-binding`,
`rm:routed-wake`, `rm:case-created`, `rm:router-officer`, `rm:wake-delivered`, `rm:officer-decides`,
`rm:ask-executes-after-review`, `rm:duplicate-route`, `rm:sticky-stop`, `rm:refusal`, `rm:ask-execute`,
`rm:ask-execute-2`, `rm:ask-denied`, `rm:ask-stopped`, **`rm:leader-creates-worker`**, **`rm:collect`**,
**`rm:duplicate-approval`**, **`rm:restart-no-replay`**.

What the four new judges measured (boot1 values, boot2 identical):

- **`rm:leader-creates-worker`** — the worker member row exists with `templateId=worker`, and the
  product's own `team_delegate` result for the Leader's delegation is not an error.
- **`rm:collect`** — the Leader's `team_collect` call (`call-rm-leader-collect`) returned a result, and
  the collected work unit names the worker's completed leg. No model was asked to judge its own output.
- **`rm:duplicate-approval`** — a SECOND `team_resolve_control` for the already-settled request
  `ctrl-…` was **rejected by the product** with
  `CONTROL_REQUEST_DECIDED "already carries a durable decision (the first decision is authoritative)"`;
  durable decisions stayed **1**, the settlement's `ADMITTED` count stayed **1**, and the approved file
  stayed byte-identical (`sha256 ced10112…`, 27 bytes).
- **`rm:restart-no-replay`** — the same World was stopped and rebooted on the **same home**
  (`bootPhase=create-or-open`, `boot:2`, its own dev-live lease); the host came back ready with the same
  three live sessions, and across the restart the file (`sha256 ced10112…`, 27 B), durable decisions
  (**1**), settlement admissions (**1**) and the routed wake (**1**) were all unchanged. No grant was
  replayed.

The **negative controls** in the same boots: `rm:ask-denied` (a real deny through the control path —
zero bytes; refusal settlement), `rm:ask-stopped` (a real `session/cancel` while pending — zero bytes,
terminal `CANCELLED`), `rm:duplicate-approval`, `rm:restart-no-replay`, `rm:duplicate-route`,
`rm:sticky-stop`, and the incoherent-Alpha.6 `rm:refusal` — all PROVEN.

The one **observation-only** arm: `ask-execute-process` (the PTY/subprocess face) is still run and its
verdict written (`REFUTED`, `no PTY backend registered for "a5sf-governed-shell"`), but it is **not** one
of this driver's declared cases — see the scope note in §3. Its limitation is unchanged and remains
visible in the d4 row/C-matrix (`C-pty` / `C-subprocess`, owner ruling: per-call `ask` for process
execution is `UNSUPPORTED BY PRODUCT RULING`). Excluding it from this driver's case set therefore does
**not** turn a red into a green anywhere: the same red is still recorded where it belongs.

**Level: `ENV-LIMITED` (not `DEV-LIVE-real-model`).** The scenario and all 20 judges are exercised at
`DEV-LIVE` on a booted pinned host, but the MODEL was the scripted mock, so this is `SCRIPTED-ONLY`
harness validation and no real-model claim is made. `recordClass` stays `DEV-LIVE`; the model axis is
`mode=scripted`, `label=SCRIPTED-ONLY`.


## 5. What the owner must provide to complete real-model acceptance

Exactly one item: **a real `DEEPSEEK_API_KEY`** (and, only if the endpoint is not the provider default,
`DEEPSEEK_BASE_URL`) reachable by the driver process or by the test World's `.credentials.yaml`, as in §1.
With that, the same command becomes the acceptance run:

```
DEEPSEEK_API_KEY=... node tests/world-factory/drivers/d-boot-feasibility/run-real-model.mjs --model real --boots 2
```

Then the level may become `DEV-LIVE-real-model` only if every judge is `PROVEN` on both boots. A real
model that behaves differently from the script is reported as the finding; judges are not adjusted to it.
