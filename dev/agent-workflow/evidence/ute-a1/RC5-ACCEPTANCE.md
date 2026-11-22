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

## 3. rc.5 drifts and how they were resolved (task 2/3)

Four genuine host drifts surfaced. Each is a host-contract change, not a
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

## 4. Everything NOT proven

- Only these three scripted drivers were run on rc.5. The rest of the vitest
  population (238) and the other node:test slices were NOT executed on rc.5;
  ADM-100 is the only in-process test re-run on rc.5 (and it was re-run
  individually, not as part of a full rc.5 test leg).
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
