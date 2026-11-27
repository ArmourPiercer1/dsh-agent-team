# rc.5 acceptance — the three D drivers, both hosts, every judge verdict

Round 78 (2026-11-22). Worktree `vnext-a1-cut`, branch `vnext/a1-cut`, HEAD
`8faf1c8f3` before this round's commit. Sole writer. Ports: legacy 3181-3199,
next 13000-13049, mocks 3491-3500 / 13050-13099; the stable development
instance (`:3080`) and its DSH_HOME were never touched. Record class DEV-LIVE
for every boot (`recordClass=DEV-LIVE (not candidate evidence)`); these are
acceptance measurements, not candidate evidence.

Hosts, exactly as the drivers printed them:

| | legacy | next |
| --- | --- | --- |
| selector input | `TEAM_TEST_HOST` unset | `TEAM_TEST_HOST=next` |
| candidate | `host:"legacy"`, `source:"tests/paths.mjs#TEST_USE_BASELINE_SHA"` | `host:"next"`, `source:"tests/paths.mjs#NEXT_HOST"` |
| pin | `639ed015397290b3745d163aafe02ffee4aa3f84` | `9c2670d3bce5275e0d1610272958121af87787bb` (`dsh-v0.2.2-rc.5`) |
| tree | `tests/deepseek-harness-test-use` (0.2.0-rc.2) | `tests/deepseek-harness-next` (0.2.2-rc.5) |
| port band | 3181-3199 | 13000-13049 |
| DSH_HOME | `tests/homes/<world>` | `tests/homes/<world>-next` |

`asserted:true` in every candidate row means the driver re-verified the tree's
HEAD before booting (`git … rev-parse HEAD` == pin, porcelain empty); the
porcelain was empty before and after every boot.

## 1. Host-selector change (task 1)

One selection authority, no second mechanism:

- `tests/next-host/host-select.mjs` gained `selectedHostPin(repoRoot, mode)`
  (`host`, `version`, `sha`, `clientCommitHash`, `tag`, `tree`),
  `selectedHostPortBands(mode)` and `selectedHostHomeSuffix(mode)`; `next`
  calls the existing `assertNextHostTree`, so the pin is only reported after
  the tree is verified. `testHostMode` / `resolveSelectedHostModule` /
  `selectedHostTree` are unchanged.
- `tests/next-host/host-loader.mjs` (new) is a one-line
  `module.register('../../scripts/run-tests-hooks.mjs', import.meta.url)`
  preload. `tests/characterization/lib/instance.mjs` adds
  `--import=<host-loader.mjs>` to the child `NODE_OPTIONS` **only** under
  `next`, so a booted rc.5 product resolves every bare `@deepseek-ai/*` from
  the rc.5 tree instead of the repo's rc.2 `node_modules`. Legacy children get
  no `NODE_OPTIONS` change.
- `tests/world-factory/lib/world-factory.mjs` leases ports from the selected
  band, appends the selected home suffix, and compares the booted host's base
  against the selected pin; `a5sf-harness.mjs` reports `host`/`pin`/`source`.
- The three drivers (`run-boot.mjs`, `run-boot-d2.mjs`, `run-boot-d3.mjs`)
  now take their pin and tree from the selector (d3 no longer hardcodes
  `tests/deepseek-harness-test-use`) and print the candidate row before boot.
  `--keep-home` is a diagnostic-only flag (never used for the rows below).
- `tests/next-host/host-next-lib.mjs` resolves a bare workspace package that no
  fixed anchor declares by the package that declares it (needed for
  `@deepseek-ai/dsh-storage-domain` on the booted product's import graph);
  still one resolution mechanism, still refusing an out-of-tree escape.

rc.2 remains the default: with `TEAM_TEST_HOST` unset every row above reports
`legacy`/`639ed015…`, ports 3181-3199, no home suffix, no loader preload.

## 2. Judges, side by side (task 2)

Every command below was run twice (`--boots 2`); the two-boot agreement table
is reproduced in §2.4. A judge is a `PROVEN`/`PASS` verdict; counters are the
measured facts the verdicts are computed from.

### 2.1 `run-boot.mjs --boots 2`

| judge / fact | rc.2 (both boots) | rc.5 (both boots) |
| --- | --- | --- |
| overall | PASS 2/2 | PASS 2/2 |
| `d:member-read-admitted` | PASS | PASS |
| `d:member-read-denied` | PASS | PASS |
| `d:native-read-surface` | PASS | PASS |
| `d:guard-facts` | PASS | PASS |
| `d:centre-facts` | PASS | PASS |
| `d:remote-creation` | PASS | PASS |
| admittedVerdict / deniedVerdict / surfaceVerdict | PROVEN | PROVEN |
| factsVerdict / centreVerdict | PROVEN | PROVEN |
| allowFacts | 2 | 2 |
| denyFacts | 0 | 0 |
| centreAdmissions / centreExecutions | 2 / 2 | 2 / 2 |
| governedSurface | true | true |
| admittedBytes | true | true |
| deniedSecretAbsent | true | true |
| transcriptSourceCount | 2 | 2 |
| agreeing pair | true, differing `[]` | true, differing `[]` |

The denied read is refused by the CENTRE on the live path (`denyFacts` 0 is the
rc.2 baseline too: the centre decides before the provider); the provider-channel
refusal is measured in its own in-process population, ADM-100, which passes on
both hosts (§3.3).

### 2.2 `run-boot-d2.mjs --boots 2`

| judge / fact | rc.2 | rc.5 |
| --- | --- | --- |
| overall | PASS 2/2 | PASS 2/2 |
| `d2:multi-member-concurrency` | PASS / PROVEN | PASS / PROVEN |
| `d2:revocation` | PASS / PROVEN | PASS / PROVEN |
| `d2:stop` | PASS / PROVEN | PASS / PROVEN |
| aAdmissions / bAdmissions | 9 / 9 | 9 / 9 |
| aGuardFacts / bGuardFacts | 14 / 14 | 14 / 14 |
| windowsOverlap / crossRefused | true / true | true / true |
| stopSettlementState | REFUSED | REFUSED |
| revocationDenyRefused / restored / wideningNotMinted | true / true / true | true / true / true |
| bAfterStopCompleted | true | true |
| agreeing pair | true, differing `[]` | true, differing `[]` |

### 2.3 `run-boot-d3.mjs --boots 2`

| judge / fact | rc.2 | rc.5 |
| --- | --- | --- |
| overall | PASS `evidence-complete=true allProven=true` 2/2 | PASS `evidence-complete=true allProven=true` 2/2 |
| `d3:persistent` | PROVEN | PROVEN |
| `d3:crash` | PROVEN | PROVEN |
| `d3:work` | PROVEN | PROVEN |
| `d3:alpha6` | PROVEN | PROVEN |
| aAdmissions / bAdmissions | 4 / 3 | 4 / 3 |
| inflightBefore / inflightAfter | open / UNKNOWN | open / UNKNOWN |
| collectStatus | succeeded | succeeded |
| bash1State / bash2State | COMPLETED / COMPLETED | COMPLETED / COMPLETED |
| agreeing pair | true, differing `[]` | true, differing `[]` |

`inflightAfter=UNKNOWN` and `alpha6` are the driver's existing contractual
verdicts, not degradations: Alpha.6 review routing is explicitly unavailable in
this cut (`ADMISSION_ALPHA6_UNAVAILABLE`, the alpha6 judge asserts the refusal
mode), and the cross-process in-flight read is contractually UNKNOWN.

### 2.4 Two-boot agreement

All three drivers: `agreeing=true differing=[]` on both hosts; the full tables
are in the driver logs kept at `dev/agent-workflow/evidence/ute-a1/rc5/`
(rc.5) and in the current `dev/agent-workflow/evidence/d-boot-feasibility/`
trees (rc.2, the last run). No row differs between the two boots of a host, and
no row differs between the hosts.

### 2.5 Round 79 re-run of all three drivers on both hosts

The B6 change (§3.5) is observation-only, but it touches the centre every driver exercises, so all
six combinations were re-run at the code commit `274aec2cc` with `--boots 2`. Transcripts:
`dev/agent-workflow/evidence/ute-a1/rc5/round79/*.log`.

| driver | rc.2 | rc.5 |
| --- | --- | --- |
| `run-boot.mjs` | PASS 2/2, `agreeing pair=true`, `differing=[]` | PASS 2/2, `agreeing pair=true`, `differing=[]` |
| `run-boot-d2.mjs` | PASS 2/2, `d2:multi-member-concurrency` / `d2:revocation` / `d2:stop` all PROVEN | identical |
| `run-boot-d3.mjs` | PASS 2/2, `evidence-complete=true allProven=true` | identical |

Every counted fact is identical to §2's round-78 table on both hosts: allowFacts 2 / denyFacts 0 /
centreAdmissions 2 / centreExecutions 2 / transcriptSourceCount 2; aAdmissions 9 / bAdmissions 9 /
aGuardFacts 14 / bGuardFacts 14 / windowsOverlap true / crossRefused true /
stopSettlementState REFUSED / bAfterStopCompleted true; aAdmissions 4 / bAdmissions 3 /
inflightAfter UNKNOWN / collectStatus succeeded / both bash states COMPLETED. No assertion, timeout
or judge was touched for this re-run, and the host trees' porcelain was empty before and after every
boot (`asserted:true` on every candidate row).

## 3. rc.5 drifts and how they were resolved (task 2/3)

Five genuine host drifts surfaced (the fifth, §3.5, is round 79's Stop-semantics drift). Each is a host-contract change, not a
weakened judge: no assertion was relaxed, no timeout widened, no judge skipped,
no retry loop added, no upstream patch.

### 3.1 Model selection must exist at Agent creation (`agentDefaultModel`)

- **rc.5 does**: `installModelSelection(agentCtx)` no longer accepts the rc.2
  `ModelSelectionRef`; the loop reads `agent.model.current()` at the FIRST
  pre-step and throws `agent "<id>" has no provider/model: set
  AgentOptions.provider and AgentOptions.model or record a model selection`
  (`packages/core/agent-loop/src/agent.ts:296`). The session-controller's rc.2
  per-request default does not cover an Agent a plugin created directly.
- **observed**: rc.5 boot 1 served the discovery prompt
  (`{accepted:true}`) with `requestCount:0`; the leader tool surface was empty
  (no model request could be assembled).
- **resolution (product)**: `packages/runtime/src/plugin/host.ts:347` adds the
  optional `agentDefaultModel` dependency and passes the host service at
  `host.ts:2527`; `packages/runtime/src/plugin/vnext/agent-bindings.mjs:1041`
  builds `teamAgentOptions()` as live getters over
  `currentSelection()` and passes `agentOptions` on both
  `createTeamAgent`/`resumeTeamAgent` (`:1055`, `:1073`). This is exactly the
  rc.5 creation contract (the host's own session-controller passes the same
  options); rc.2 accepts the same options object. Getters, not a snapshot,
  keep live-config semantics.
- **after**: leader surface `(49)` including all 15 `team_*` tools; discovery,
  root work and member work all reach the mock; all judges above pass.

### 3.2 `{{cwd}}` is no longer a prompt variable

- **rc.5 does**: the agent-loop registers only `provider` and `model` as
  system-prompt variables (`packages/core/agent-loop/src/index.ts:336-337`);
  rc.2 additionally registered `cwd`
  (`packages/core/agent-loop/src/index.ts:370-372`). An unregistered
  `{{…}}` group is a hard render error in both generations.
- **observed (exact error, from the child session's `turn/end`)**:
  `unknown prompt variable "{{cwd}}" in section "deployment:persona-suffix";
  registered variables: provider, model` — which made the member turn end in
  error before any `user/message` was committed, and the work reader then
  correctly reported `WORK_TURN_UNREADABLE` (the reader was not the bug; it
  was the first observable downstream of the turn error). The earlier
  hypothesis of a `followup`/`whenIdle`/`ownEvents` semantics drift was
  disproved by the dumped child event log (spliced → turn/start → claim →
  step/start → turn/end{error}).
- **resolution (deployment composition)**: `cordis.patch.yml` persona suffix no
  longer interpolates `{{cwd}}`; it says "the session workspace" (the runtime
  context already states it). `{{model}}` stays: it is registered on both.
  No product code and no host change. Deployment truth recorded in the patch
  comment at the same site.

### 3.3 rc.5 needs `workingDirectory` + an executor; dispatch is a batch

This one is a HARNESS-world drift (the in-process ADM-100 population the
denied judge cites), not a live-product failure.

- **rc.5 does**: `@deepseek-ai/dsh-tool-fs` statically injects
  `workingDirectory`, so without that service Cordis defers the whole module
  and the world has no `read` at all; dispatch goes through a selected
  `ToolExecutor` service, and `execute` takes
  `{calls:[{id,name,arguments}], signal, agent}` and returns
  `{results:[{callId,result}]}` (`packages/core/tools/lib/pipeline.js`). The
  legacy host has neither seam: it executes one `{name,arguments,callId}`
  call and returns the settled result.
- **observed**: ADM-100 failed at `assert.notEqual(mounted, undefined, 'a
  governed member with a preset native module must mount by default')`
  (no `read` on the surface). After adding the executor and the
  working-directory double it failed one stage later with
  `ToolBatchExecutionError … TypeError: Cannot read properties of undefined
  (reading 'map')` (the legacy single-call shape).
- **resolution (harness world, host-conditional)**:
  `packages/runtime/test/vnext-admission.test.mjs` `buildShapeAWorld` mounts
  `NativeToolExecutor` and `provideWorkingDirectoryDouble` only when
  `seams.hostMode === 'next'`, and its `dispatch` helper uses the rc.5 batch
  shape only under `next`. The assertions are untouched. This mirrors the
  already-existing B3/B4 composition in
  `tests/world-factory/lib/a5sf-fs-contract-world.mjs:628,639`.
- **after**: ADM-100 passes on rc.5 and on rc.2 (both re-run individually);
  the live driver's `d:member-read-denied` passes on rc.5.

### 3.4 Deployment composition (task 4)

Measured requirements for a real rc.5 deployment of the governed preset:

1. **`@deepseek-ai/dsh-terminal` on an ancestor scope** — the preset's
   `tool-bash-persistent` row injects `terminals`; a preset binds only when
   every enabled row is active, so a deployment without the service refuses
   the preset (`agent-preset/invalid … waiting for terminals`). The drivers
   compose it as the `persistent-shell-terminals` row (host's own PTY service,
   no backend: inert on the preset scope, the Member's `bash` is the realm
   mount on the governed face). This requirement predates rc.5 (round 76) and
   is unchanged.
2. **rc.5 base bundle supplies `working-directory`, `tool-working-directory`
   and a `toolExecutor`** (`packages/bundle/base/cordis.patch.yml:166-170` and
   the executor row). A deployment that does not compose the base bundle must
   provide both; the in-process worlds above show the exact failure when it
   does not. The test worlds compose the host's `web` profile (base bundle +
   this patch), so the drivers measure the real deployment shape.
3. **No `{{cwd}}` prompt group** (§3.2). Any deployment persona that keeps it
   fails every turn on rc.5.
4. **Team-created Agents pass provider/model AgentOptions at creation**
   (§3.1). A plugin that creates Agents directly cannot rely on the
   session-controller's per-request default on rc.5.
5. **Batch dispatch** (§3.3) for any in-process consumer of `tools.execute`.

### 3.5 Pre-dispatch cancellation has no `tools/result` on rc.5 (round 79, B6)

- **rc.2 does**: a cancellation before the body still travels the tool pipeline, so the host emits
  `tools/result` and the centre's event observer writes the execution fact.
- **rc.5 does**: `executeToolBatch` drains the started calls and calls `BatchSettlement.skip()` for
  every call that was never started (`tests/deepseek-harness-next/packages/core/tools/src/batch.ts:225-229`,
  `:271-280`). The synthetic result carries the host's own
  `code: ABORTED_BEFORE_DISPATCH` (`contracts.ts:268` — exported as `TOOL_ABORTED_BEFORE_DISPATCH`,
  valued `ABORTED_BEFORE_DISPATCH`) and the batch is returned from `ToolsService.execute`
  (`index.ts:375-377`). **The pipeline never runs and no `tools/result` fires.** Measured with one
  probe, one call, both hosts (round 77, kept as the drift record):

  ```
  ABORT-PROBE mode=legacy isError=true code=ABORTED_BEFORE_DISPATCH toolsResultEvents=1
  ABORT-PROBE mode=next   isError=true code=ABORTED_BEFORE_DISPATCH toolsResultEvents=0
  ```

- **consequence for the centre**: a product that keys its durable Stop evidence off `tools/result`
  observes NOTHING for a call cancelled before dispatch on rc.5 — no fact, no settlement, no report.
- **resolution (product, round 79)**: the centre reads the abort where the host announces it, at the
  **executor completion boundary**:
  `packages/runtime/src/plugin/vnext/pre-dispatch-abort.mjs` (new) normalises the value
  `tools.execute` returns for both host generations and selects ONLY results carrying the host's own
  pre-dispatch code; `execution-facts.mjs` writes the SAME canonical fact through the SAME
  ExecutionId-keyed dedupe map (`observeExecutorCompletion`); `centre-install.mjs` /
  `member-execution.mjs` expose the observer and wire its settlement side; `settlement-port.mjs`'s
  `stoppedBeforeBody()` records the Stop and settles `CANCELLED` when a record exists and otherwise
  reports `SETTLEMENT_NO_RECORD_BEFORE_ADMISSION` **visibly**. The native scheduler is not
  intercepted, replaced or re-entered: the product only reads the value it already returns. No
  `tools/result` is fabricated and no allow/deny is invented.
- **durable facts written for a pre-dispatch abort**:
  - no admission record (aborted before the admission point): ONE execution fact
    (`outcome: 'aborted'`, `abortPhase: 'pre-dispatch'`, product `executionId`); **no** settlement
    record (inventing one would attribute an admission nobody made); a visible
    `SETTLEMENT_NO_RECORD_BEFORE_ADMISSION` report naming the ExecutionId. This is the case both
    slice arms drive.
  - admission record exists: the same fact plus `recordStop({phase:'pre-dispatch'})` and
    `settle(CANCELLED)`.
- **dedupe by ExecutionId**: `SLICE-37` re-delivers the same completion (the both-paths-fire case —
  on rc.2 the pipeline reports it as well) and requires `observed:1, recorded:0, deduped:1`, one
  fact, zero settlement; a completed (pipeline) call makes the observer report `observed:0` and is
  settled once by the pipeline path.
- **the durable edge, measured**: `SLICE-38` runs the same abort against a centre WITH the product
  ledger. The ledger refuses an execution it cannot join to an authority record
  (`LEDGER_EXECUTION_UNBOUND`), so the arm requires exactly that: no durable execution record, no
  settlement, no invented admission record, the refusal REPORTED with the callId, and the host's
  dispatch unbroken — while a control call that reached admission is recorded and `COMPLETED`.
- **after**: `SLICE-21` and `SLICE-30` are GREEN on rc.5 **and** rc.2 with their assertions
  unchanged (`vnext-fs-slice.test.mjs` full suite: 38/38 on both hosts). No assertion weakened, no
  timeout widened, no retry loop, no mocked host, no upstream patch.
- **NOT proven**: the production `tools.execute` call site is the host agent loop's, which the
  product does not own. The observer is exported by the product composition and driven end to end in
  the slice composition, but no booted rc.5 member's pre-dispatch cancel is recorded by production
  wiring yet — that leg needs an upstream seam (`CORE_SEAM_BLOCKER` for it), and it is not claimed
  here. Also not proven: a real rc.5 interleaving that aborts between admission and dispatch (the
  pinned `startCall` prepares and dispatches in one step).

## 4. Everything NOT proven

- Only these three scripted drivers were run on rc.5. The rest of the vitest
  population (238) and the other node:test slices were NOT executed on rc.5;
  ADM-100 is the only in-process test re-run on rc.5 (and it was re-run
  individually, not as part of a full rc.5 test leg). **Superseded in part by §8
  (round 102): the D4 probe is now a fourth scripted driver measured on rc.5;
  the vitest/node:test statement still stands as written.**
- The model is the scripted mock on both hosts; no real model, provider
  routing, retries, token accounting or streaming behaviour is exercised.
- Two-boot agreement proves determinism of these scripted scenarios on this
  machine only; it is not a general concurrency or crash-recovery proof.
- `d3` records `inflightAfter=UNKNOWN` by contract; the cross-process in-flight
  truth is not established. Alpha.6 review routing is unavailable in this cut;
  the judge asserts the refusal, not a working review plane.
- The deployment requirements in §3.4 are measured for the DSH `web` profile +
  this patch in the test worlds; no production/hosted deployment, no Windows,
  no PTY backend, no real terminal process, and no MCP server was exercised on
  rc.5.
- The `{{cwd}}` removal changes the persona text on BOTH hosts; rc.2 verdicts
  are unchanged (§2), but that the runtime context states the same working
  directory on rc.5 was assumed, not asserted by a judge.
- No upstream patch was needed and none was made; the rc.5 tree stayed clean
  (porcelain empty before/after every boot). If a future acceptance needs a
  seam rc.5 genuinely lacks, that is a `CORE_SEAM_BLOCKER`, not a patch.

## 5. Gates at the round-78 commit

Run in this worktree, in this order, after the rc.2 and rc.5 driver runs:

```
$ node scripts/place-dist-glue.mjs
place-dist-glue: done (28 placement(s))

$ node scripts/dispatch-tests.mjs --run --leg ute-vnext-a1
ℹ tests 204
ℹ pass 202
ℹ fail 0
ℹ skipped 2
DSH-TEST-DISPATCH mode=run leg=ute-vnext-a1 suites=7 files=7 exit=0 set=sha256:edd4f1c494a777b941baa47a286d29455f79eb71d20ae7e48cf46a5580c8a975

$ node scripts/test-catalog.mjs --max-uncollected 41 --max-excluded 7
DSH-TEST-CATALOG tests=785 digest=sha256:da8a452d65130a3a7f62ef90b549a5289909e689e1ff619c4b3e0c45d5f5ed32 refused=0 findings=0
  (by runner: node=146 none=7 vitest=632)

$ node scripts/ute-cut-closure.mjs --check
UTE-CUT-CLOSURE pass deleted=148 references=3 prodRefs=0 distResiduals=0 cut=cut(0/148) dupNames=0 findings=0

$ node scripts/ute-p0-assets.mjs --check
UTE-P0-ASSETS pass modules=37 files=180 lines=69512 delete=146 replace=2 keep=32 wave1=146 wave2=0 cut=cut(148/148) findings=0

$ node scripts/docs-sync.mjs --check
docs:sync --check: docs=193 notes=4 plans=152(0 declaring) findings=0 blocking=0 contracts=20 pairs compared

$ node scripts/eb3-ci-required.mjs
EB3-CI-REQUIRED pass workflows=10 findings=0

$ node scripts/eb3-security-run.mjs --layer ci-integration --list-file tests/checks/eb3-ute-migrated-suites.txt
EB3-LAYER layer=ci-integration verdict=PASS suites=15 files=15 describes=76 passed=238 failed=0 clock_ms=20000

$ node scripts/ci-pr-gate.mjs --full --census-captures 2
DSH-CI-VERDICT pass pass=10 fail=0 skip=0 skipped=none legs=10 refused=0 refusedlegs=none seconds=299.5
```

The vitest population is unchanged at **238**. `ci-pr-gate --full` was run once
BEFORE the commit and failed the census leg for two non-product reasons: (a)
`A4-PR7 §7.6` asserts the committed install surface is fresh against the tree,
which is red by construction while the round-78 changes are still uncommitted;
(b) `u6-mcp-017` timed out connecting to its own in-process mini-MCP listener on
`127.0.0.1:3985`, which was momentarily held; the same file passes in 76 ms when
re-run, and both census captures are identical and red-free at the commit
(`identity set IDENTICAL to the published baseline`). No assertion, timeout or
suite was changed for either.

The full gate was re-run at the round-78 code commit and again at
`dfbc00ab2` (the commit that added this record and the first census
comparison artifact): `DSH-CI-VERDICT pass pass=10 fail=0` both times, census
`2 captures, identical identity sets`, `identity set IDENTICAL to the published
baseline`. The run at `dfbc00ab2` wrote
`scratch/census-comparison-20261122T153050Z-3.json`; it is committed with this
paragraph as a third evidence-only commit (it changes no install surface, no
test, no source), so the tree is clean at the pushed HEAD. The earlier
pre-commit census reds are explained above and none was papered over.

## 6. Round-79 gates at the code commit

Run in this worktree after the B6 change, in this order; the two host re-runs above were done before
the gate block so the acceptance face and the unit face measure the same code.

```
$ node scripts/place-dist-glue.mjs
place-dist-glue: done (29 placement(s))

$ node scripts/dispatch-tests.mjs --run --leg ute-vnext-a1
ℹ tests 206
ℹ pass 204
ℹ fail 0
ℹ skipped 2
DSH-TEST-DISPATCH mode=run leg=ute-vnext-a1 suites=7 files=7 exit=0 set=sha256:edd4f1c494a777b941baa47a286d29455f79eb71d20ae7e48cf46a5580c8a975

$ node scripts/test-catalog.mjs --max-uncollected 41 --max-excluded 7
DSH-TEST-CATALOG tests=785 digest=sha256:da8a452d65130a3a7f62ef90b549a5289909e689e1ff619c4b3e0c45d5f5ed32 refused=0 findings=0
  (by runner: node=146 none=7 vitest=632)

$ node scripts/ute-cut-closure.mjs --check
UTE-CUT-CLOSURE pass deleted=148 references=3 prodRefs=0 distResiduals=0 cut=cut(0/148) dupNames=0 findings=0

$ node scripts/ute-p0-assets.mjs --check
UTE-P0-ASSETS pass modules=37 files=180 lines=69512 delete=146 replace=2 keep=32 wave1=146 wave2=0 cut=cut(148/148) findings=0

$ node scripts/docs-sync.mjs --check
docs:sync --check: docs=193 notes=4 plans=152(0 declaring) findings=0 blocking=0 contracts=20 pairs compared
AUTHORITY_SOURCE_BINDING {"kind":"authority-pointer",…,"pointer_digest_verified":true,…}

$ node scripts/eb3-ci-required.mjs
EB3-CI-REQUIRED pass workflows=10 findings=0

$ node scripts/eb3-security-run.mjs --layer ci-integration --list-file tests/checks/eb3-ute-migrated-suites.txt --timeout 30000
EB3-LAYER layer=ci-integration verdict=PASS suites=15 files=15 describes=76 passed=238 failed=0 clock_ms=30000
```

The vitest population is unchanged at **238**; the new arms are node:test arms in the
`ute-vnext-a1` leg (204 pass, was 202). `ci-pr-gate --full --census-captures 2` and its census
artifact are recorded in §7 below, which is committed after this paragraph so the gate runs against
a committed tree (the round-78 §5 disclosure applies identically: an uncommitted install surface is
red by construction for the A4-PR7 freshness fence, and that red was NOT papered over). Its first
run at the code commit was RED on the p4t6 scannable-surface ledger (one unbooked new module); §7
records that red, its booking fix and the passing re-run rather than hiding it.

## 7. `ci-pr-gate --full --census-captures 2` at the committed tree

```
$ node scripts/ci-pr-gate.mjs --full --census-captures 2
DSH-CI-LEG leg=census verdict=pass seconds=257.6 detail=roots: nine (packages/*/test) via the root
  vitest config; baseline … = 0 titled reds + 0 collection files; captured 599f/7412l, 599f/7412l
  vs baseline-declared 626 / 7936; 2 captures, identical identity sets — COUNTS MOVED, SET DID NOT
  — identity set IDENTICAL to the published baseline — comparison written to
  dev/agent-workflow/evidence/a4-pr7/ci-gate/scratch/census-comparison-20261122T161736Z-3.json
DSH-CI-VERDICT pass pass=10 fail=0 skip=0 skipped=none legs=10 refused=0 refusedlegs=none seconds=301.9
```

**One honest red before this pass, not papered over.** The FIRST run at the code commit
(`274aec2cc`, census artifact `census-comparison-20261122T161119Z-3.json`) was
`pass=9 fail=1`: the census leg reported six new reds in
`packages/testkit/test/p4t6-session-event-scan.test.ts` — the p4t6 scannable-surface ledger counts
every `packages/**` source and the round-79 module `vnext/pre-dispatch-abort.mjs` was not booked
(`scanner counts 1312, ledger derives 0 + 1311 = 1311`). That is the ledger's job: a new file
reddens the population until it is booked. The fix is the established, boring one — a booking file
(`p4t6-bookings/round79predispatch.json`, measured delta 1311 -> 1312) and the coverage title's
literal updated to the measured population; no assertion was relaxed, and the ledger's own
RED-first sensitivity controls still pass (20/20 in that file). After the booking commit
`64a841c72` the full gate passed as pasted above, with the census artifact
`census-comparison-20261122T161736Z-3.json` committed alongside this paragraph.

The census counts note (`COUNTS MOVED, SET DID NOT`) is the standing condition the gate itself
resolves: the counts are context, the identity set is the verdict, and the set is IDENTICAL to the
published baseline in both captures.

## 8. Round 102 — the D4 acceptance probe on rc.5 (the fourth driver joins the first three)

Round 78 migrated `run-boot.mjs`, `run-boot-d2.mjs` and `run-boot-d3.mjs` (§2). The D4 acceptance
probe (`probe-d4-routed-wake.mjs`) stayed rc.2-only until now, so the D4 evidence behind the R3
receipt and the Alpha.6 routed wake was measured on the WRONG host generation for acceptance.
Round 102 closes that. Measured at `10d8a67aeb7e189011faf2c131a73aa33b76fac3`; evidence
`dev/agent-workflow/evidence/ute-a1/round102/`; the single current status table is the first section
of `D-ACCEPTANCE-REPORT.md`; the per-judge detail and the drift resolution are `RC5-MIGRATION.md` §13.

| | rc.2 | rc.5 |
| --- | --- | --- |
| command | `node …/probe-d4-routed-wake.mjs --boots 2` | `TEAM_TEST_HOST=next node … --boots 2` |
| candidate/source | `host:"legacy"`, `tests/paths.mjs#TEST_USE_BASELINE_SHA` | `host:"next"`, `tests/paths.mjs#NEXT_HOST` |
| pin | `639ed01539…` | `9c2670d3bc…` |
| world / port | `u5u5a5sfdev1-…`, 3195 | `u5u5a5sfdev1-…-next`, 13000 |
| result line | `evidence-complete=true allBooted=true blocked=true runRecordsValid=true (2/2; agreeing pair=true)` | identical |
| judges | 16 of 17 PROVEN + 1 REFUTED | **identical** (same clause ok-flags, same failing ids) |
| counters | 8 wake facts, 4 routed / 4 delivered, 0 management executions, 0 wake-intent files, 27 B `ced10112…`, 29 B `2d71ffdd…`, deny/Stop 0 B / `REFUSED` | **byte-identical** (`agreement.txt` diff = empty) |

**P0-2 (pre-dispatch abort) is NOT closed by this round.** The observer
(`packages/runtime/src/plugin/vnext/pre-dispatch-abort.mjs`) is still not production-wired, because
the host agent loop owns `tools.execute`. It is classified **OPEN TARGET-HOST ACCEPTANCE BLOCKER**:
it closes with a public batch-completion observation seam, or an owner ruling that defines the
lawful "no settlement" boundary for a call that never entered admission and never started a body.
The visible `SETTLEMENT_NO_RECORD_BEFORE_ADMISSION` report is a report, not a settlement.

**One measurement fix, disclosed.** `d4:case-created`'s `case-has-no-decision-yet` read the ledger
AFTER the capture, so it measured the Officer's decision speed: at `5952c84` boot 2 the decision
landed 176 ms after creation, faster than the probe's 300 ms poll, and the clause refuted a correct
product. It is now `captured-case-precedes-any-decision` (append-only-ledger ordering). No wake,
byte, settlement or negative-arm clause changed.

**What §3's "NOT proven" list loses and keeps.** It loses "only these three scripted drivers were
run on rc.5" — the D4 probe is now a fourth. It keeps everything else: the wider vitest/node:test
population is still not re-run on rc.5 (only `ADM-100` and the slice arms are), the model is still
the scripted mock, and `d4:ask-execute-process` is still REFUTED on BOTH hosts for the product
assembly gap named in `RC5-MIGRATION.md` §13.4.
