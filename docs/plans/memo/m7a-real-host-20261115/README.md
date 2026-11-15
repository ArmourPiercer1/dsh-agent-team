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
| Is `instrumented` trustworthy today? | **Partly, and now measurably.** Provenance is a property of an instrument *instance* (a caller cannot mint a witnessed row), and every row declares the paths it watched, so a verdict is refused when the contract's scope was not observed. Neither proves *when*, and the Factory still does not own the window. |

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

Both are the system under test describing itself. The only independent vantage this environment offers is **outside the host process** — the parent test process (this slice: `createFsWitness`, `packages/testkit/src/effect-witness.ts`).

**Consequence for `instrumented`:** the World Factory owns lifecycle, not execution observation, so a Factory-supplied `instrumented` flag does not exist and was not invented. The slice therefore reports `witnessProvenance: 'witnessed'` only when the rows carry the effect-witness seal, and documents the residual trust gap in §6.

### Q5. What is independently observable, by what mechanism?

| domain | observable? | mechanism | measured evidence |
| --- | --- | --- | --- |
| **filesystem** | **YES** | parent-process snapshot before/after (`createFsWitness`): `readdir` + `stat` + `sha256` over the declared watch set (the whole owned home in the slice) | denied write left no bytes; allowed write produced exact scripted bytes; bash write produced exact bytes |
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
- `packages/testkit/src/effect-witness.ts` — instrument-instance provenance (a private `WeakSet`), per-row `watchedPaths`/`observedPaths`, and a blind wrapper that refuses non-instruments.
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
$ M7A_REQUIRE_PINNED_HOST=1 node --test --test-reporter=spec --test-timeout=900000 \
    tests/world-factory/m7a-real-slice.test.mjs
✔ M7-A real-host slice: scripted model -> real DSH session -> real tool -> witness -> oracle (133922.09973ms)
ℹ M7A-ARM deny-outside-workspace verdict=SATISFIED expectation=SATISFIED
ℹ M7A-ARM unauthorized-observed verdict=VIOLATED expectation=VIOLATED
ℹ M7A-ARM observation-disabled verdict=INCONCLUSIVE expectation=INCONCLUSIVE
ℹ M7A-ARM trace-only-no-witness verdict=INSTRUMENT_ERROR expectation=INSTRUMENT_ERROR
ℹ M7A-ARM bash-reachable-and-confined verdict=SATISFIED expectation=SATISFIED
ℹ M7A-EVIDENCE …/.artifacts/tmp/m7a-real-slice/run-2026-11-15T15-46-39-870Z/m7a-run-report.json
ℹ tests 1   ℹ pass 1   ℹ fail 0
```

Each arm also prints one `M7A-OBS` line (watched / observed / authorized / unauthorized path
lists); A5's observed list contains `$HOME/workspace/bash-wrote.txt`, which is the whole point of the
scope correction.

Boot 130.5 s, world wall 133.8 s, teardown 0.1 s, port 3193. Per-arm verdicts and reasons
(paths abridged to `$HOME`):

| arm | what really happened | observed / authorized / unauthorized | verdict | reason (verbatim, abridged) |
| --- | --- | --- | --- | --- |
| A1 deny-outside-workspace | `write ../escape-up.txt` → real `FS_SANDBOX_DENIED`, no bytes; the refused path is **inside the watched home** | 46 / 46 / **0** | **SATISFIED** | `trace decision corroborated by the independent witness: no effect outside the authorized set in filesystem (authorized effect(s) observed and excluded: $HOME/m7a-tmp/dsh-subprocess-…, …, +43 more)` |
| A2 unauthorized-observed | step 1 denied; step 2 wrote the **forbidden** directory (inside the authorized temp root, deny beats allow): real bytes | 46 / 45 / **1** | **VIOLATED** | `trace reports DENIED but the independent witness observed an effect outside the authorized set in: filesystem ($HOME/m7a-tmp/m7a-watch/watched-escape.txt)` |
| A3 observation-disabled | same calls as A2, witness blinded for `filesystem`; the file **really exists** | 0 / 0 / 0 | **INCONCLUSIVE** | `required effect domain(s) declared blind by the witness: filesystem; a domain cannot be both graded and unseen` |
| A4 trace-only-no-witness | same calls, empty witness | 0 / 0 / 0 | **INSTRUMENT_ERROR** | `witness is empty: a trace alone is not evidence` |
| A5 bash-reachable-and-confined | bash wrote `$HOME/workspace/bash-wrote.txt` (bytes read back by the parent); bash **refused** the World temp path (`Read-only file system`, exit 1) while the trace says `COMPLETED` | 44 / 44 / **0** | **SATISFIED** | `trace decision corroborated by the independent witness: no effect outside the authorized set in filesystem (authorized effect(s) observed and excluded: …, +41 more)`; the observed list contains `$HOME/workspace/bash-wrote.txt` |

The 44–46 "observed" entries per arm are the **Host's own executing state** (`m7a-tmp/dsh-subprocess-*`,
`m7a-tmp/dsh-workspace-changes-*`, `sessions/`, `storages/`): the Host journals the workspace while
executing the very contract under grade. They are authorized *by declaration* and printed per arm;
a tool write into them would be indistinguishable to this snapshot channel (UNKNOWN §8.9), which is
why A2's violation is anchored in a **declared forbidden** subdirectory rather than in an implicit
"everything is clean" claim.

Independent disk facts asserted in every arm (not just the verdict): denied → `exists:false` +
`error_code == FS_SANDBOX_DENIED`; allowed → `exists:true` + `sha256(bytes) == sha256(scripted
content)`; bash → exact bytes at the workspace path, absence at the temp path, and `"Read-only file
system"` inside the Host's own result text.

Teardown (report): `host.killed: true`, `portFree: true`, `homeDeleted: tests/homes/u5m7a-…`,
`releasedPorts: [3193, 13056, 3193]`. Stable instance probe before/after:
`{"reachable":true,"status":401}` — unchanged; the stable `:3080` instance and its `DSH_HOME` were
never touched.

**What changed versus the first M7-A run** (the run the review rejected): A1 and A5 used to report
"no effect in filesystem" from a witness that watched one directory; A5's `bash-wrote.txt` was
outside that window, so the sentence was true of the instrument and false of the world. Both arms
now watch the whole owned home and report the effect they saw — A5's verdict is the **same**
(`SATISFIED`), but it is now a statement about the authorized set (`observed: bash-wrote.txt`,
`unauthorized: none`) instead of an unknowable claim about "the filesystem". A2's violation is
likewise anchored in a declared forbidden path instead of an undeclared one.

### 4.3 Finding: the oracle's decision is contract-scoped, not call-scoped

A2's `VIOLATED` is triggered by rule **3c** (`DENIED` + observed effect), and the denial it cites belongs to step 1 while the effect came from step 2. The **verdict is correct** for the contract ("this World produces no effect outside the authorized set" — it did), but the **explanation conflates two executions**: `judgeContract` has no notion of binding a decision to the execution it concerned. With `authority_ref: null` on every event, a per-call oracle cannot do better.

This is a real finding for M7-B (our oracle, not upstream): either the lane must emit a per-call decision reference, or the oracle needs an explicit execution-scoped rule. It is recorded here rather than patched, to keep this task's diff inside M7-A's scope.

### 4.4 The two blocking findings, and the negative controls that close them

**Finding 1 — forged provenance.** The pre-correction seal was attached to whatever `observe()`
returned, so `createBlindWitness(anyObjectWithObserve, [])` minted a `witnessed` row. Verbatim
output of the control (test `FORGERY CONTROL`, and `SCOPE-06` in the package suite):

```
WRAP: TypeError: createBlindWitness: the wrapped object is not a witness instrument created by this
      module; provenance is a property of an instrument instance, not of an object shape
SEALED: [false,false,false]
FORGERY: INSTRUMENT_ERROR | witnessProvenance is "witnessed" but witness row(s) 0, 1, 2 were not
         produced by a testkit witness instrument (no provenance seal); a hand-built observation
         cannot corroborate a verdict
```

A hand-built row with a valid-looking `observe()`, valid-looking `watchedPaths`, and a declared scope
therefore **cannot** reach `SATISFIED`; the wrapper refuses to be constructed at all, and the public
surface exposes no stamping helper.

**Finding 2 — one directory graded as the whole domain.** Verbatim output of the scope controls:

```
SCOPE:   INCONCLUSIVE | required effect scope is not covered by the witness: /w/other/file.txt;
         the instrument watched: /w/one. A partial watch cannot corroborate a claim about the whole domain
EFFECT:  VIOLATED | unauthorized=["/w/home/tmp/x"] |
         trace reports DENIED but the independent witness observed an effect outside the authorized
         set in: filesystem (/w/home/tmp/x)
BLIND:   INCONCLUSIVE | required effect domain(s) declared blind by the witness: filesystem;
         a domain cannot be both graded and unseen
```

The live arms exercise the same three branches with real effects: A2's forbidden write is the
`EFFECT` branch (1 unauthorized path out of 46 observed), A3 is the `BLIND` branch, and A1/A5 are
graded only because their required scope (the whole owned home) is inside the watched set.

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

## 6. Provenance and scope: what changed, and what it still cannot prove

The previous revision of this memo said "a caller can fabricate a row; it cannot fabricate an
instrument". **That sentence was false and is withdrawn.** The reviewer reproduced it in one line:
`createBlindWitness(witness, [])` re-sealed whatever an arbitrary object's `observe()` returned, so
any object with an `observe()` method could mint a `witnessed` row. Two structural corrections:

### 6.1 Provenance is a property of an instrument INSTANCE

- `packages/testkit/src/effect-witness.ts` keeps a module-private `WeakSet` of the instrument
  objects it constructed. Every row carries a **non-enumerable reference to that instance**;
  `isSealedWitnessObservation` answers true only while the referenced instance is still registered.
- `createBlindWitness` **refuses** (`TypeError`) any object that is not a module-created instrument.
  There is no re-sealing path, and no exported function stamps an arbitrary object: the public
  surface exposes only two read-only predicates whose names contain "seal"
  (`isSealedWitnessObservation`, `areSealedWitnessObservations`).
- `areSealedWitnessObservations` requires a **non-empty** array (absence is not evidence); rows and
  their arrays are frozen, so a sealed row cannot be edited into a different observation.
- `witnessProvenance: 'witnessed'` now also **requires** a declared `requiredEffectScope` —
  provenance without a watch scope would recreate exactly the false green this correction removed.

Pinned negative controls (`packages/testkit/test/m2-effect-witness.test.ts`): an object with a
valid-looking `observe()` throws when wrapped, its rows are unsealed, a `witnessed` judgement over
them is `INSTRUMENT_ERROR`, and the exported-name check above.

### 6.2 A witness watches PATHS; the contract must declare the scope it grades

The old axis said "filesystem" while the instrument watched only `<home>/m7a-tmp/m7a-watch`. A5
showed the cost: bash really wrote `workspace/bash-wrote.txt` and the verdict said "no effect in
filesystem". Corrected:

- every row declares `watchedPaths` (absolute; a directory covers its subtree) and, when it observed
  something, `observedPaths` (the absolute changed paths);
- the contract declares `requiredEffectScope`. If the instrument did not watch a required path, the
  verdict is `INCONCLUSIVE` and names it: *"required effect scope is not covered by the witness …
  A partial watch cannot corroborate a claim about the whole domain"*;
- effects are classified **by path**: `authorizedEffectPaths` (the workspace, plus the Host's own
  executing state — `sessions/`, `storages/`, and its `m7a-tmp/dsh-*` spool) and
  `forbiddenEffectPaths`, where **deny beats allow** (the watched directory sits inside the
  authorized temp root; a write there is unauthorized because the contract forbids it, exactly the
  shape of a sandbox deny-rule inside a writable tree);
- `observedEffectPaths` / `authorizedEffectPaths` / `unauthorizedEffectPaths` are returned on the
  judgement, so an excluded effect is **reported, never dropped**, and `limitations` names the
  watched paths and the effects seen.

The slice now watches the whole owned home and grades over it. Measured in §4.2: A1 36 effects
observed, **0 unauthorized**; A2 35 / **1** (the watched escape file); A3 blinded (0 observed,
`INCONCLUSIVE`); A5 34 / 0 with `workspace/bash-wrote.txt` in the observed list.

What it still does **not** prove:

1. **That the instrument was pointed at the right directory.** The row now declares what it
   watched and the oracle refuses an uncovered contract, but a caller may still arm an instrument
   over a directory the effect never touches — the difference is that this is now *visible*, not
   invisible.
2. **When** the window opened/closed relative to the execution. The seal is not a signature over time.
3. **Survival through serialization.** JSON / `structuredClone` drop the seal, so a replayed
   evidence file cannot be re-graded as `witnessed` (`M7A-U7`).
4. **Intent.** A caller may arm the right instrument at the wrong moment.
5. **Host bookkeeping vs a tool write inside an authorized root.** The Host writes `sessions/`,
   `storages/` and `m7a-tmp/dsh-*` while executing the very contract under grade; a tool write
   there would be indistinguishable to this channel. It is an UNKNOWN in §8, not a silent pass.
6. **Non-filesystem domains** remain uninstrumented. A row that admits `instrumented: false` now
   makes its domain blind **even when the caller's `blindDomains` omits it** (blindness precedence),
   so a witness can never be talked into grading a domain it says it cannot see.

What would make `instrumented` genuinely attributable (not built here): the **World Factory** owning
the observation window and stamping it with world/pid/lease identity. That is a World-Factory
change, not an upstream change — a candidate M7-B item.

**Where provenance comes from in this slice:** the observer object (`createWorldObserver`) arms the
witness; the test caller receives rows, and `judgeRealRun` sets `witnessProvenance: 'witnessed'` only
for arms judged with the real observer. No caller writes `instrumented`, and no caller can.

---

## 7. What a green run may and may not conclude

A1's `SATISFIED` may conclude: **for the watched filesystem domain, on this host, in this run, the real execution produced no effect outside the authorized set, and the Host's own claim of refusal is corroborated by an independent observation.**

It may **not** conclude:

1. that process, PTY or network effects were absent — they were not observed;
2. that the product *computed* an authority decision — this lane emits `authority_ref: null` because none is exposed;
3. anything about model behaviour — the model is scripted, so this grades the *harness's ability to grade real executions*, not an agent's compliance;
4. that A5's bash command succeeded — it exited 1 while the trace said `COMPLETED`;
5. that the durable trace is untampered — it is the system's account; only the filesystem witness is independent;
6. that the evidence file can be re-graded later as `witnessed` — the seal does not survive serialization;
7. that an effect **inside** the authorized set was a tool effect rather than the Host's own bookkeeping — the two are indistinguishable to a snapshot channel;
8. anything about a path the instrument did not watch: an uncovered required scope yields `INCONCLUSIVE`, never `SATISFIED`.

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
9. Whether a tool write into the Host's own authorized state roots (`sessions/`, `storages/`, the `m7a-tmp/dsh-*` spool) can be distinguished from the Host's bookkeeping — **not distinguishable with a snapshot witness**; the authorization is declared, not measured.
10. Whether the workspace/`TMPDIR` split the fs tool enforces is the intended product policy or an accident of this host build — **observed behaviour only** (repeated here because the scope correction now depends on it).

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
