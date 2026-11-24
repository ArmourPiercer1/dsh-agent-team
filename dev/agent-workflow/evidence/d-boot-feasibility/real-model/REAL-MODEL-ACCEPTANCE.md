# REAL-MODEL ACCEPTANCE — the probe, the harness, and the level actually reached

**Round:** review `20261125-0058` Stage B, second item ("a controlled real-model scenario, not a scripted model").
**Driver:** `tests/world-factory/drivers/d-boot-feasibility/run-real-model.mjs`
**Evidence:** this directory (`probe.json`, `ENV-LIMITED.txt`, `runs/`, `run-ledger.jsonl`).
**Branch / HEAD at probe time:** `vnext/a1-cut` @ `82da9ca9f` (probe recorded its own HEAD).

> **THE LEVEL CLAIMED: `ENV-LIMITED`.** The harness is complete and executable; the ENVIRONMENT has no
> real model route for a test host. Nothing in this round is a real-model run, and no run is labelled as
> one. The scripted self-validation below is labelled **SCRIPTED-ONLY** in the artifact and in every RUN
> record.

---

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
