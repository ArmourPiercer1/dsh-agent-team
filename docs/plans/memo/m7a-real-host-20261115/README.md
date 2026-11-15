# M7-A — real-host capability recon + first vertical slice

- **Task**: M7-A. Base `origin/master` @ `6aba7365f`. Branch `task/m7a-real-host-20261115`, worktree `.worktrees/m7a-20261115`.
- **Question asked**: what would it take to put the Contract Oracle in front of a *real* DSH execution chain, and can one vertical slice be built **without touching upstream** (`CORE PATCH BUDGET = 0`)?
- **Answer**: yes for one narrow chain — `Scripted model (on the provider wire) → real DSH Host → real Agent Session → real tool resolution → real execution → independent FS observation → judgeContract()`. It runs today, on the pinned pristine host `0.2.0-rc.2 @ 639ed01539`, with **zero upstream source patches**, in ~2m13s wall time for five arms.
- **What it does not answer**: process, PTY and network effects are **not observable** by anything built here. Every green verdict produced by this slice is a statement about **filesystem effects only**.
- **Nature of this document**: recon first (six questions, `file:line`), then the slice, then the honest limits. Anything not measured is listed as `UNKNOWN` in §8 — nothing in this memo is inferred from a green run that the run does not actually prove.

---

## 1. Verdict summary

| Question | Answer |
| --- | --- |
| Is there a World Factory? | **Yes** — `TestWorldFactory` is the single creation point and the lifecycle owner. |
| Can a scripted model drive a **real** host? | **Yes**, through a public deployment seam (`DEEPSEEK_BASE_URL`), not through a patch. |
| Do real tool calls reach the OS? | **Yes**, and the filesystem effect is readable by the parent process. |
| Is there a public **effect** observation seam? | **No.** The public channels (`session.event`, the durable session log) are the system's *claims*; independent observation must come from outside the host process. |
| What can be independently observed? | Filesystem only (parent-process snapshot). Process / PTY / network: **not observed**. |
| What does the oracle need that witnesses do not provide? | Process/network/PTY instruments; a per-call authority decision; pairing of a decision to the execution it concerns. |
| Is `instrumented` trustworthy today? | **Not from the Factory.** M7-A adds a provenance seal so a witness row can prove it came from a testkit instrument — it still cannot prove *which directory* was watched or *when*. |

---

## 2. The six questions, with evidence

### Q1. How is a DSH world started in tests, and what is the cheapest proven recipe?

The chain is the same one `docs/TEST_METHODS.md` §2 describes, wrapped in code:

- `tests/world-factory/lib/world-factory.mjs:226` — `class TestWorldFactory` (the only creation point; see Q2).
- `tests/world-factory/lib/world-factory.mjs:333` — `createWorld()` allocates a world id, a `DSH_HOME` under `tests/homes/<world>`, and the workspace.
- `tests/world-factory/lib/world-factory.mjs:622` — `startHost()` leases a host port and launches the host.
- `tests/characterization/lib/instance.mjs:89-95` — the actual spawn: `node apps/cli/lib/bin.js web --port <port> --no-open` with `DSH_HOME` (and the client commit hash) in the child env.
- `tests/characterization/lib/instance.mjs:23` — the readiness marker the launcher waits for: `/dsh web: http:\/\/127\.0\.0\.1:(\d+)\/\?token=[A-Za-z0-9_-]+/`.

**Cheapest proven recipe** (measured, not estimated):

```
scrubProviderEnv()
factory = new TestWorldFactory({ repoRoot, evidenceRoot })
world   = await factory.createWorld({ line: 'm7a' })      // DSH_HOME + workspace
await world.startMock({ decide })                          // in-process model endpoint
await world.startHost({ bootTimeoutMs: 180_000 })          // ~130 s here
origin  = `http://127.0.0.1:${port}`
cookie  = await authenticate(origin, world.token)          // GET /?token=… → 303 + cookie
session = await apiSessionCreate(origin, cookie, world.workspaceDir, 'm7a')
await apiPrompt(origin, cookie, sessionId, text, 'm7a-t1')
…
await world.teardown({ keepHome: false })
```

Cost structure measured in this slice (canonical run `run-2026-11-15T13-48-31-313Z`):

| phase | measured |
| --- | --- |
| mock + host boot + auth + first session (`bootMs`) | **129 908 ms** |
| one prompt → durable `turn/end` (tool call + follow-up) | **258–518 ms** |
| five arms, one host, five sessions, wall incl. teardown | **133 165 ms** |
| teardown | **101 ms** |

So: **boot dominates; never boot per arm.** One host serves many sessions (`apiSessionCreate` is cheap), which is exactly how the five-arm slice fits in one boot.

Provisioning preconditions (also a host-state contract, §5): the host tree `tests/deepseek-harness-test-use` is `gitignored` and must exist at the pinned SHA; it is absent in a fresh worktree. In this worktree it was copied (`cp -a`, 2.6 GB, 41 s) from the main checkout. When absent, the suite prints a machine-readable refusal and skips — never green.

### Q2. Does a World Factory exist, and who owns the lifecycle?

Yes. `TestWorldFactory` / `TestWorld` (`tests/world-factory/lib/world-factory.mjs:226`, `:471`). It owns:

- **port leases** — host band `3181-3199` then `13000-13049`; mock `3491-3500` then `13050-13099` (leased by the factory, released by teardown; this run leased host `3193`, mock `13056`);
- **`DSH_HOME` composition** — profile patch layer at `<home>/profiles/web/cordis.patch.yml`, written by the factory;
- **ownership markers** — `.u5-ownership.json` written at `:760` (`#writeOwnership`);
- **teardown** — `:844`: kills only pids recorded in the ownership marker *and* verified on Linux, releases ports, deletes the home only when the marker matches;
- **host-base hygiene** — `:299` `assertHostBase()` runs `git -C <hostTree> status --porcelain` and refuses a dirty/patched host tree.

The M7-A harness never spawns a process, never opens a port, and never constructs a `DSH_HOME` by hand: it calls `createWorld` / `startMock` / `startHost` / `teardown`. That is deliberate — see §6 for why `instrumented` still cannot be attributed to this owner.

### Q3. How is a scripted model injected into a *real* DSH session?

There is **no public adapter-injection seam into a child `dsh web` process** (the `ScriptedModelAdapter` is an in-process `LlmAdapter` object; a child process is a different composition). What exists, and is public, is the **provider endpoint**:

- `tests/deepseek-harness-test-use/packages/llm/llm-deepseek/src/config.ts:109` — `const BASE_URL_ENV = 'DEEPSEEK_BASE_URL'`.
- `…/config.ts:290` — `const baseURL = config.baseURL ?? environment?.get(BASE_URL_ENV)?.value ?? PUBLIC_BASE_URL` — the endpoint can come from the environment.
- `tests/deepseek-harness-test-use/packages/boot/app-boot/src/index.ts:148` — `DEEPSEEK_BASE_URL` is in the **trusted env allowlist** (it is only honoured from a trusted layer, not from any discovered file).
- `tests/world-factory/lib/world-factory.mjs:548-550` — `startMock()` starts the in-process OpenAI-compatible mock (`packages/tools/harness/mock-deepseek.mjs:145`), which records every request.
- `tests/world-factory/lib/world-factory.mjs:665-666` — `startHost()` sets `process.env.DEEPSEEK_BASE_URL = http://127.0.0.1:<mock>` and `DEEPSEEK_API_KEY = 'u5-fake-key'` **before** spawning the host.

The script itself is `createWireScriptDriver` (`packages/testkit/src/wire-script.ts:96`): it applies the **same `agent-script/1` law** as the in-process adapter (`validateAgentScript`, structural `expect_request` matching, `SCRIPT_EXHAUSTED` / `SCRIPT_UNEXPECTED_REQUEST` / `SCRIPT_UNCONSUMED_TURN`), and emits the mock provider's reply vocabulary (`{kind:'text'}` / `{kind:'tool-call'}`). Auxiliary requests (title generation, compaction) carry no tool list and are answered without consuming a turn (`wire-script.ts:74/85` discriminate structurally).

This is a **deployment seam, not a monkeypatch**: no upstream file is read-write, the env var is the documented one, and the same seam a developer would use to point DSH at any OpenAI-compatible gateway.

### Q4. Where does a real tool call cross agent → OS, and is there a public observation seam?

**The crossing (write path):**

- `packages/fs/tool-fs/src/write.ts:61` — `applyWriteTool(ctx, sandbox)` registers the model-facing tool; schema at `:75-78` (`file_path`, `content`).
- `…/write.ts:111` — `await sandbox.resolvePolicy('write', args, exec)` resolves the **per-call** sandbox policy.
- `…/write.ts:112` — `await ctx.fs.resolve(input.filePath, …)` resolves the target.
- `…/write.ts:118` — `await ctx.fs.writeText(target, input.content, intent, exec.signal, sandboxPolicy)` — **this is the OS write**.
- `…/write.ts:120-123` — a sandbox denial is mapped to the shared `[sandbox: …]` marker.
- `packages/fs/fs-sandbox/src/index.ts:141` — the workspace-write refusal is thrown as `FsError(…, 'FS_SANDBOX_DENIED')`; `:127` is the read-only variant.

**The crossing (bash path):** `packages/shell/tool-bash/src/index.ts:376` defines the tool (`command`, required `description`, optional `timeoutMs`), executed through `ctx.shell` with its own OS sandbox.

**Public observation seam — for effects: none.** What is public is a *claim* channel:

- `packages/sdk/protocol/src/types.ts:108` — server→client notification `session.event` (plus `session.status`, `subagent.*`), i.e. the session event stream over the SDK protocol;
- the durable session log on disk, built by `packages/session/session-persistence-jsonl/src/format.ts:254` (`projectDir`), `:267` (`sessionDir`), `:280` (`generationLogPath`) in the documented v4 JSONL(+zstd) format.

Both are the system under test describing itself. The only independent vantage this environment offers is **outside the host process** — the parent test process (this slice: `createFsWitness`, `packages/testkit/src/effect-witness.ts:203`).

**Consequence for `instrumented`:** the World Factory owns lifecycle, not execution observation, so a Factory-supplied `instrumented` flag does not exist and was not invented. The slice therefore reports `witnessProvenance: 'witnessed'` only when the rows carry the effect-witness seal, and documents the residual trust gap in §6.

### Q5. What is independently observable, by what mechanism?

| domain | observable? | mechanism | measured evidence |
| --- | --- | --- | --- |
| **filesystem** | **YES** | parent-process snapshot before/after (`createFsWitness`): `readdir` + `stat` + `sha256`, scoped to a declared watch directory | denied write left no bytes; allowed write produced exact scripted bytes; bash write produced exact bytes |
| **process** | **NO** | — | host runs in its own process tree; no sampling, no pid census, bash children invisible except as shell text |
| **PTY** | **NO** | — | no PTY instrument; the shipped surface contains no terminal/PTY tool (see tool list below) |
| **network** | **NO** | — | the mock endpoint sees *model* traffic only; it says nothing about host egress |

The real tool surface the host advertised to the model in the canonical run — read from the World's own mock request records, **27 tools**:

```
ask_user_question, bash, create_goal, edit, exit_plan_mode, get_goal, glob, grep,
interrupt_agent, job_kill, job_list, job_output, list_agents, present, read,
read_image, send_message, skill, subagent, subagent_fork, todo_write, u5_canary,
update_goal, web_fetch, web_search, workflow, write
```

Sandbox boundary facts measured on this host (pinned rc.2), which is what makes the allow/deny pair discriminating:

- `write` may write the session workspace **and** the platform temp area (`TMPDIR` honoured): a write to `$TMPDIR/<world>/…` really created bytes.
- `write` to `<DSH_HOME>/../escape.txt` (outside the workspace, not temp) was **really refused**: `[sandbox: file access denied under workspace-write mode]`, `isError: true`, `error: {name:'FsError', code:'FS_SANDBOX_DENIED'}`, and no file appeared.
- `bash` may write the workspace, but the same World temp directory is **read-only to bash**: `bash: …: Read-only file system`, exit `1`. So the fs tool and the shell executor apply **different** confinement even on the same path.
- That bash failure still arrives as `tool/result` with `isError: false` (`COMPLETED`): **a nonzero shell exit is not a tool error**. Any oracle input derived only from `isError` would miss it.

### Q6. What does the Contract Oracle need, versus what today's witnesses provide?

Oracle input (`packages/testkit/src/contract-oracle.ts:64` `OracleInput`) and its rules (`:241` `judgeContract`):

- trace events with strictly increasing `event_seq`, `actor_id`, `authority_ref`, `outcome ∈ {COMPUTED, DENIED, DISPATCHED, COMPLETED}`;
- witness rows per domain (`observed`, `instrumented`, `evidence`), `blindDomains`, `requiredEffectDomains`;
- the new (M7-A) `witnessProvenance: 'declared' | 'witnessed'` (`:92`), enforced at `:162-167`.

| oracle needs | today's real run provides |
| --- | --- |
| trace with a decision event (`DENIED`/`COMPUTED`) | the Host's durable trace has a real `DENIED` with `FS_SANDBOX_DENIED` — but **no per-call authority decision** exists to cite, so every event this lane emits carries `authority_ref: null` (honest: this lane computes none) |
| independent witness for the required domain | filesystem only; `process`/`network` rows are `observed:false, instrumented:false` and the verdict says so in `limitations` |
| no-effect corroboration (rule 4) | available: the deny arm passes only because the witness also saw nothing |
| DENIED + effect (rule 3c) | available: the sensitivity arm produces a real denial in the same contract and a real escaping effect |
| per-execution pairing of a decision | **missing** — see the finding in §5.3 |

---

## 3. Capability matrix

| | observed | mechanism | can a verdict rely on it? |
| --- | --- | --- | --- |
| filesystem (workspace) | **yes** | parent stat/digest | yes, for the watched paths |
| filesystem (platform temp) | **yes** | same, with `TMPDIR` re-pointed into the World | yes, for the watched paths |
| process / children / exits | **no** | — | no |
| PTY | **no** | — | no |
| network | **no** | mock sees model traffic only | no |
| session events (claims) | yes | durable log / `session.event` | only as claims; never as effect evidence |

---

## 4. The slice

### 4.1 Shape

```
agent-script/1 (wire driver)
  → mock provider :mock_port            (public env seam DEEPSEEK_BASE_URL)
    → dsh web (pinned rc.2, World Factory)
      → POST /api/session/create + /api/session/prompt   (public RPC)
        → real tool resolution (27 shipped tools)
          → real execution (fs provider + fs sandbox / shell sandbox)
            → durable session log (claims)  +  parent FS witness (independent)
              → judgeContract() → SATISFIED | VIOLATED | INCONCLUSIVE | INSTRUMENT_ERROR
```

Files:

- `tests/world-factory/lib/m7a-real-run.mjs` — harness: session-log reader (`decompressSessionLog`, `findSessionLog`, `traceEventsFromSessionRows`), observer (`createWorldObserver`, armed/blinded by the observer object, never by the test caller), run driver (`startRealRun`, `runTurn`), judging (`judgeRealRun`), census (`mockRequestCensus`).
- `tests/world-factory/m7a-real-slice.test.mjs` — the live slice (5 arms, one host, 5 sessions). Runs in **ci-census**, as its own workflow step, with `M7A_REQUIRE_PINNED_HOST=1`.
- `tests/world-factory/m7a-real-slice-unit.test.mjs` — host-free C1 complement (10 cases). Runs in **ci-integration** on every PR: it is declared in the `tinf-instruments` leg (`scripts/dispatch-tests.mjs --run --leg tinf-instruments`), the repo's host-free node:test instrument leg — a *new* leg would have no `node --test` argv on the M6 base and would therefore be a permanent `UNCONVERTED` problem in the dispatch-parity gate.
- `tests/world-factory/m7a-real-slice-host-state.test.mjs` — the live suite's host-state contract (2 cases): an absent host refuses in words and skips; `M7A_REQUIRE_PINNED_HOST=1` turns that into a hard failure. Same leg, same run.
- `packages/testkit/src/agent-script.ts`, `wire-script.ts` — the script law + wire driver.
- `packages/testkit/src/effect-witness.ts` — provenance seal.
- `packages/testkit/src/contract-oracle.ts` — `witnessProvenance`.
- `packages/testkit/test/m2-effect-witness.test.ts` and `packages/testkit/test/m2-scripted-model.test.ts` — the in-package tests for the above live *in the existing files* (one law, one home): the provenance seal and the oracle's `witnessed` mode beside the witness negative controls, the wire driver beside the in-process scripted adapter. Folding them in is deliberate: a new `packages/*/test/**/*.test.ts` file would move the reviewed census population (705 files), and this task's diff must not move it.

The trace is built from the Host's own durable log: `<DSH_HOME>/sessions/<cwd-slug>/session-<id>/session.v4.jsonl.zstd`, which is a sequence of **concatenated zstd frames** (one per append). A single `zstdDecompressSync` call decodes only the first; the reader splits on the zstd magic and drops an undecodable partial tail. Mapping (explicit, in code):

| durable row | event |
| --- | --- |
| `tool/call {callId, name, arguments}` | `DISPATCHED`, `authority_ref: null` |
| `tool/result` with `error` / `isError:true` | `DENIED` + `error_code` + `denial_kind: 'tool-error'` |
| `tool/result` otherwise | `COMPLETED` |

`result_text` is carried as evidence text only — never as a verdict input (see the bash finding).

### 4.2 Canonical run (transcript lines, verbatim)

```
$ node --test --test-reporter=spec --test-timeout=900000 tests/world-factory/m7a-real-slice.test.mjs
✔ M7-A real-host slice: scripted model -> real DSH session -> real tool -> witness -> oracle (133258.653718ms)
ℹ M7A-ARM deny-outside-workspace verdict=SATISFIED expectation=SATISFIED
ℹ M7A-ARM unauthorized-observed verdict=VIOLATED expectation=VIOLATED
ℹ M7A-ARM observation-disabled verdict=INCONCLUSIVE expectation=INCONCLUSIVE
ℹ M7A-ARM trace-only-no-witness verdict=INSTRUMENT_ERROR expectation=INSTRUMENT_ERROR
ℹ M7A-ARM bash-reachable-and-confined verdict=SATISFIED expectation=SATISFIED
ℹ M7A-EVIDENCE …/.artifacts/tmp/m7a-real-slice/run-2026-11-15T13-48-31-313Z/m7a-run-report.json
ℹ tests 1  ℹ pass 1  ℹ fail 0
```

Per-arm verdict + reasons from the report:

| arm | what really happened | verdict | reason (verbatim) |
| --- | --- | --- | --- |
| A1 deny-outside-workspace | `write ../escape-up.txt` → real `FS_SANDBOX_DENIED`, no bytes | **SATISFIED** | `trace decision corroborated by the independent witness: no effect in filesystem` |
| A2 unauthorized-observed | step 1 denied; step 2 wrote the **watched, non-authorized** path: real bytes, witness saw them | **VIOLATED** | `trace reports DENIED but the independent witness observed an effect in: filesystem` |
| A3 observation-disabled | same calls as A2, witness blinded for `filesystem`; the file **really exists** | **INCONCLUSIVE** | `required effect domain(s) declared blind by the witness: filesystem; a domain cannot be both graded and unseen` |
| A4 trace-only-no-witness | same calls, empty witness | **INSTRUMENT_ERROR** | `witness is empty: a trace alone is not evidence` |
| A5 bash-reachable-and-confined | bash wrote the workspace (bytes read back by the parent); bash **refused** the World temp path (`Read-only file system`, exit 1) but the trace says `COMPLETED` | **SATISFIED** | `trace decision corroborated by the independent witness: no effect in filesystem` |

Independent disk facts asserted in every arm (not just the verdict): denied → `exists:false` + `error_code == FS_SANDBOX_DENIED`; allowed → `exists:true` + `sha256(bytes) == sha256(scripted content)`; bash → exact bytes at the workspace path, absence at the temp path, and `"Read-only file system"` inside the Host's own result text.

Teardown (report): `host.killed: true`, `portFree: true`, `homeDeleted: tests/homes/u5m7a-…`, `releasedPorts: [3193, 13056, 3193]`. Stable instance probe before/after: `{"reachable":true,"status":401}` — unchanged; the stable `:3080` instance and its `DSH_HOME` were never touched.

### 4.3 Finding: the oracle's decision is contract-scoped, not call-scoped

A2's `VIOLATED` is triggered by rule **3c** (`DENIED` + observed effect), and the denial it cites belongs to step 1 while the effect came from step 2. The **verdict is correct** for the contract ("this World produces no effect outside the authorized set" — it did), but the **explanation conflates two executions**: `judgeContract` has no notion of binding a decision to the execution it concerned. With `authority_ref: null` on every event, a per-call oracle cannot do better.

This is a real finding for M7-B (our oracle, not upstream): either the lane must emit a per-call decision reference, or the oracle needs an explicit execution-scoped rule. It is recorded here rather than patched, to keep this task's diff inside M7-A's scope.

---

## 5. Where the two suites run, and what a green CI run proves

Both suites are **collected**, and the uncollected ratchet stays at **91** (the count the gate
opened with); neither is baselined as "host-required, uncollected". They are split because one half
must never be allowed to excuse the other:

| suite | layer / step | what it needs | frequency | if the host is absent |
| --- | --- | --- | --- | --- |
| `tests/world-factory/m7a-real-slice-unit.test.mjs` (C1, 10 cases, ~0.2 s) **and** `tests/world-factory/m7a-real-slice-host-state.test.mjs` (the refusal/failure contract, 2 cases) | **ci-integration**, step `test catalog + TINF instruments`, leg `tinf-instruments` (`scripts/dispatch-tests.mjs --run --leg tinf-instruments`; population declared once in `dev/ci/eb3-ci-manifest.json` as `suites[]`) | nothing but the repo: no port, no `DSH_HOME`, no host tree | every PR | n/a — they never resolve the host |
| `tests/world-factory/m7a-real-slice.test.mjs` (C2, 5 arms, one boot, ~133 s locally) | **ci-census** (`census-runtime.yml`), its own step after the census and its transcript re-grade: `node --test --test-timeout=900000 --test-reporter=spec tests/world-factory/m7a-real-slice.test.mjs`, with `M7A_REQUIRE_PINNED_HOST=1` and `M7A_BOOT_TIMEOUT_MS=600000` in `env:` | the pinned pristine host **and its build**, plus the repo build — exactly what this job already provisions | every PR (the layer is Required; drafts defer it as a whole, they do not skip this step inside a run) | **hard failure** (`M7A-REAL-SLICE-HOST-INCOMPLETE`), never a skip |

**What a green C1 run proves.** The three mappings the C2 arms rest on are themselves tested on
every PR, with no host to hide behind: a real DSH session log is concatenated zstd frames and the
reader decodes all of them (dropping only an undecodable tail); the durable rows map to
`DISPATCHED` / `DENIED` / `COMPLETED` honestly (a refusal keeps the Host's typed `error_code`, a
success claims none, `authority_ref` is `null` because this lane computes none); the wire driver
accepts exactly the document `validateAgentScript` accepts and refuses exhaustion / mismatch /
unconsumed turns; and the oracle's `witnessed` mode rejects a hand-built row (`INSTRUMENT_ERROR`),
a blinded instrument is `INCONCLUSIVE`, a real effect with a decision is `VIOLATED`, and the seal
does not survive JSON. It does **not** prove the reader still matches a *live* Host's row shapes —
only C2 does that.

**What a green C2 run proves.** On the pinned host, in one run: a real tool call was dispatched by a
real session, its effect was read back by an independent parent process, and the oracle's verdict
matched the pre-registered expectation in all five arms — including the two that must not be green
(`VIOLATED` for a real unauthorized effect, `INCONCLUSIVE` when observation is disabled) and the one
that must not be evidence at all (`INSTRUMENT_ERROR` with an empty witness). Because the step runs
with `M7A_REQUIRE_PINNED_HOST=1`, that run cannot be reported as green from a job that failed to
provision the host. It still says nothing about process, PTY or network (§7), and nothing about the
seal's trust limits (§6).

**Cost, and the job's timeout.** Locally one boot + five arms = **133 s** (boot 130 s, teardown
0.1 s). At the census job's own conservative 4× hosted factor that is a **~9 min** delta on top of
its ~8–10 min measured floor, inside the job's `timeout-minutes: 60`. The step changes neither the
census argv nor the plan: it is a separate step, so the census population, its two captures and its
`--census-test-timeout` are untouched, and a failure here fails the job (and its layer verdict)
without altering what the census graded.

**Three-state contract** (the `a5sf-fs-contract` idiom, kept for local runs and for a host-free
checkout): complete host → the arms run; absent → one machine-readable
`M7A-REAL-SLICE-HOST-REFUSED host=… reason=apps/cli/lib/bin.js is absent …` line and every case
**skipped** (never green); `M7A_REQUIRE_PINNED_HOST=1` and absent → hard `FAIL`. The wording is
pinned by `tests/world-factory/m7a-real-slice-host-state.test.mjs`, which runs the live suite
against an empty `M7A_HOST_TREE` and asserts both the skip and the hard failure — in CI, not only
by hand.

---

## 6. `instrumented` provenance: what changed and what it still cannot prove

Today `instrumented` was a boolean the witness *implementation* set, but the oracle accepted any caller-built array. M7-A closes the cheapest hole:

- `packages/testkit/src/effect-witness.ts:76` — a module-private `Symbol('…/effect-witness/seal')`;
- `:203` `createFsWitness` and `:253` `createBlindWitness` return rows carrying the seal as a **non-enumerable** property;
- `:92` / `:102` — `isSealedWitnessObservation` / `areSealedWitnessObservations` (empty array is *not* sealed: absence is not evidence);
- `packages/testkit/src/contract-oracle.ts:92` — `witnessProvenance?: 'declared' | 'witnessed'`, default `'declared'` (existing callers unchanged); with `'witnessed'`, an unsealed row is an `INSTRUMENT_ERROR` naming its index (`:162-167`).

What the seal **proves**: these rows were produced by a testkit witness instrument in this process, not hand-built.

What it **does not prove** (stated, tested, and reported by the verdict's `limitations`):

1. **Which directory** was watched, or that it was the right one. A caller can instantiate `createFsWitness({root, outside})` with a directory the effect will never touch and get a sealed "no effect" row.
2. **When** the window opened/closed relative to the execution. The seal is not a signature over time.
3. **Survival through serialization.** JSON / `structuredClone` drop the seal, so a replayed evidence file cannot be re-graded as `witnessed` (pinned by `M7A-U7` and the package test).
4. **That the caller did not misuse the instrument.** The seal attests identity, not intent.

What would make `instrumented` genuinely trustworthy (not built here): the **World Factory** owning the observation window and stamping it with world/pid/lease identity, so a verdict could require "the observer belongs to this world and was armed before this execution". That is a World-Factory change, not an upstream change — a candidate M7-B item.

**Where provenance came from in this slice:** the observer object (`createWorldObserver`) arms the witness; the test caller receives rows, and `judgeRealRun` sets `witnessProvenance: 'witnessed'` only for arms judged with the real observer. No caller writes `instrumented`.

---

## 7. What a green run may and may not conclude

A1's `SATISFIED` may conclude: **for the watched filesystem domain, on this host, in this run, the real execution produced no effect outside the authorized set, and the Host's own claim of refusal is corroborated by an independent observation.**

It may **not** conclude:

1. that process, PTY or network effects were absent — they were not observed;
2. that the product *computed* an authority decision — this lane emits `authority_ref: null` because none is exposed;
3. anything about model behaviour — the model is scripted, so this grades the *harness's ability to grade real executions*, not an agent's compliance;
4. that A5's bash command succeeded — it exited 1 while the trace said `COMPLETED`;
5. that the durable trace is untampered — it is the system's account; only the filesystem witness is independent;
6. that the evidence file can be re-graded later as `witnessed` — the seal does not survive serialization.

---

## 8. UNKNOWNs

1. Whether an approval-gated tool (`ask` lane) can be driven to a real approval decision deterministically over the public RPC — **not probed**.
2. Whether `session.event` over the SDK transport gives ordering/completeness guarantees suitable as a second channel — **not probed** (this slice reads the durable log instead).
3. Whether the fs tool's write access to the platform temp area is *intended* policy or an implementation side effect — **observed behaviour only**.
4. Whether any public seam exposes the bash child process's pid tree — **not found; not proven absent**.
5. Whether two hosts / parallel worlds behave identically in this slice — only one host was exercised per run.
6. Whether the wire driver's "no tool list ⇒ auxiliary request" rule holds for every provider feature (forced tool choice, streaming retries) — only observed on this host's traffic.
7. Whether the temp-area write allowance survives a `TMPDIR` that is *inside* the workspace or a different platform — not tested.
8. Exact timing on a loaded machine (boot 130 s here is machine-specific, not a budget).

---

## 9. Reproduce

```bash
cd .worktrees/m7a-20261115

# C1 — the same invocation ci-integration runs (no boot; both host-free suites)
node scripts/dispatch-tests.mjs --run --leg tinf-instruments

# C2 — the same argv ci-census runs, with the pin required so a missing
# host cannot become a skip (one boot, five arms, ~2m15s)
M7A_REQUIRE_PINNED_HOST=1 node --test --test-timeout=900000 --test-reporter=spec \
  tests/world-factory/m7a-real-slice.test.mjs

# in-package tests for the new testkit surface (the existing files they joined)
node <vitest.mjs> run --root packages/testkit test/m2-effect-witness.test.ts test/m2-scripted-model.test.ts
```

Evidence lands in `.artifacts/tmp/m7a-real-slice/run-<utc>/m7a-run-report.json` (gitignored) and is summarised in §4.2. Host tree absent → the refusal line + skips in §5; set `M7A_REQUIRE_PINNED_HOST=1` to fail instead.
