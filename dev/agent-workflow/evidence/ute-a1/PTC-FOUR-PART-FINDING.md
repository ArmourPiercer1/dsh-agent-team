# PTC (`run_code`) — the four-part finding, round 85

**Branch:** `vnext/a1-cut` · **base HEAD:** `c13d12a50` · **pinned host:** `0.2.0-rc.2 @
639ed015397290b3745d163aafe02ffee4aa3f84` (`tests/deepseek-harness-test-use`, porcelain empty)
**Inputs:** `host-surface-refusal.mjs` (why PTC is refused today),
`packages/runtime/src/plugin/live/ptc-escalation-row.mjs`, the alpha5 PTC rows in `host.ts`,
`agent-bindings.mjs:393`, `admission.ts:405-407`, `CAPABILITY-MATRIX-C.md` C-ptc, and review
`20261122-2305 §4.3` (PTC is a SEPARATE mechanism, never safe by association with `run_code`'s axis).
**Order:** the four parts are decided in the order the round names them, and this file was written
BEFORE any product edit.

## Verdict

**REFUSED — `CORE_SEAM_BLOCKER` on part (a), the WORKER process's OS profile.** Three parts hold as
measured; one cannot be made to hold through an existing public seam without an upstream patch, so
the typed refusal stays. The refusal's reason is narrowed to the one failing part.

A truthful refusal is the outcome. No half-governed PTC was shipped: `run_code` is still refused
before the body, with its own code, on `process.exec`, and both durable shapes are still written.

## Four-part status

| part | verdict | what was measured |
| --- | --- | --- |
| (a) worker process | **FAILS** | The worker IS a fresh OS-confined Node child (not the host's own loop) **when** the resolved policy is not `danger-full-access`; but the policy PTC resolves is the HOST session's `{mode, workspaceRoot}`, **not** the Member's compiled read/write profile, and under `danger-full-access` the confinement step is skipped entirely. The executor the Member declaration names (`confined-subprocess` = the realm's confined subprocess face) is never the executor that runs this worker. |
| (b) nested tool calls | **HOLDS** (measurement, below) | The `run_code` binding does not call tools directly; it builds `{callId: "<outer>:ptc:<n>", agent: exec.agent, parent: exec.token, signal: runController.signal}` and calls the registry's own `TOOL_RUNTIME_SCHEDULER.prepare`, whose pre-execute waterfall is dispatched on `scopeTarget(this, exec.agent)` — the Member agent's scope, where the centre's `tools/pre-execute` listener is installed. Nested calls therefore meet the SAME admission point. They are separate executions with their own callIds; the parent link exists in the host's input (`rootCallId`, `parent`) but our durable facts do not yet project `rootCallId`/`parentCallId` (see "not proven"). |
| (c) escalation | **HOLDS** (measurement, below) | `approveEscalation` calls `ctx.approval.request` with the verbatim reason `escalate sandbox to <mode>: …`; the approval service dispatches that on the `approval/request` waterfall, where the surviving row is installed; the row opens a DURABLE ControlService request (`requestControl` + `awaitControlDecision`, leader → `user-approval`, member → `leader-approval`), mints exactly ONE one-shot operation grant on `decision === 'allow'`, and consumes it once. A non-allow decision mints nothing. |
| (d) Stop | **HOLDS** (measurement, below) | `exec.signal` is the host's Stop signal. The transport registers `exec.signal` → `runController.abort(exec.signal.reason)`, passes `runController.signal` to the runtime and to every nested dispatch, and the Node runtime's abort path calls `handle.terminate()` before resolving. Nested calls are aborted with the same run controller; the centre's execution facts map `signal.aborted` to `aborted`, which the settlement writer closes as `CANCELLED`. |

## Evidence per part (pinned host, `tests/deepseek-harness-test-use/`)

### (a) WORKER — the failing part

- `packages/core/tools/src/index.ts:947-951` — the `run_code` bridge is constructed with
  `peekApprover: () => this.ctx.get('approval')` and
  `resolveSandboxPolicy: (exec) => this.ctx.get('sandboxPolicy').resolve({session: exec.agent.session})`.
  The policy a PTC run receives is therefore the **host session's** policy; no Member binding, lane
  set, realm or compiled profile is consulted. `this.ctx` is the `ToolRuntime` service's context
  (`packages/core/tools/src/index.ts:812-820`), i.e. the host's root/composition scope, not the
  Member agent scope.
- `packages/sandbox/sandbox-policy/src/index.ts:164-169` — `resolve()` returns
  `{mode: override ?? defaultMode, workspaceRoot: session.header.cwd}`. `mode`/`workspaceRoot` is all
  the OS policy surface PTC can receive.
- `packages/sandbox/sandbox/src/index.ts:40-53` — `SandboxExecutionPolicy` is exactly
  `mode`, `workspaceRoot`, optional `sessionId`. It has **no per-path allow/deny rules**, so the
  Member's compiled three-lane policy (read-only subtrees, write-only subtrees, nested denies) cannot
  be expressed in it even if a caller could supply it. The product's compiled profile
  (`packages/runtime/team-sandbox/src/profile.ts:79-140`) is a Landlock `allowPaths` ruleset with
  per-path access bits — a different model.
- `packages/ptc-runtime/ptc-runtime-node/src/index.ts:212-239` — the child argv is built, then
  `confined = policy.mode === 'danger-full-access' ? undefined : await this.ctx.sandbox.confine(argv,
  { ...policy, mode: policy.mode }, signal)`; then `this.ctx.subprocess.spawn({ argv: confined?.argv
  ?? argv, cwd: spec.cwd, … })` (:239). `cwd` defaults to `sandboxPolicy.workspaceRoot`
  (`:113`). The process is therefore confined by the **host's `ctx.sandbox` provider** under the
  host's policy — a service the Member realm does not substitute — and is **not confined at all**
  under `danger-full-access`.
- The realm's compiled profile is enforced by the Member realm's own fs/subprocess providers
  (`packages/runtime/src/plugin/live/a5sf-realm-row.mjs`, `mountMemberA5sfRealm`), which PTC never
  uses: `NodePtcRuntime` statically injects `['fs','subprocess','sandbox','sandboxPolicy']`
  (`packages/ptc-runtime/ptc-runtime-node/src/index.ts:60`) from the root composition.
- Consequence: a Member whose compiled read/write lanes are narrower than its session workspace can
  read/write outside those lanes from a `run_code` program using Node's own `fs`, because the
  worker's OS rules are the session mode + workspace root. The centre would have admitted the call on
  the Member's `process.exec` declaration, but the effect is bounded by a DIFFERENT policy — a second
  execution authority in substance, even though it is called "the host sandbox".

**Negative control (structural).** Take a Member with `read: [<ws>/inside]`, `write: []`, and a
session workspace `<ws>`; the centre admits a process only under the compiled declaration, yet PTC's
worker receives `{mode: <session mode>, workspaceRoot: <ws>}`. Under `workspace-write` a direct
`await import('node:fs')` write to `<ws>/outside` is inside the worker's OS allowance and outside the
Member's write lane; under `danger-full-access` it is not confined at all. No test arm is added that
runs this with the centre's admission removed, because that arm would itself be the ungoverned code
path; the control is the wiring above: the Member policy has no carriage into
`resolveSandboxPolicy`, and the policy type cannot represent it. This is the exact seam to repair.

### (b) NESTED calls

- `packages/core/tools/src/ptc.ts:538-554` — the binding builds a sub-call identity
  (`${exec.callId}:ptc:${n}`), threads `agent: exec.agent`, `parent: exec.token`, and
  `signal: runController.signal`, and calls the registry.
- `packages/core/tools/src/ptc.ts:615-625` — it appends the dispatch-start event and awaits
  `scheduler.prepare(input)`, then `scheduler.dispatch(prepared.exec)`.
- `packages/core/tools/src/index.ts:816-822` — the scheduler IS the registry's own
  `prepareScheduledExecution` / `dispatchScheduledExecution` / `finalize` / `finish`.
- `packages/core/tools/src/index.ts:1504-1508` — `prepareExecution` dispatches
  `this.ctx.waterfall(scopeTarget(this, exec.agent), 'tools/pre-execute', exec, …)`. The Member
  agent's scope is the carrier, and `installAdmissionPoint` registers its listener on exactly that
  agent context (`packages/runtime/src/plugin/vnext/admission-port.mjs:787-806`). A nested call
  therefore reaches the centre's admission, fact writer, replay ledger and settlement.
- Sub-call `callId` is derived from the outer callId, so the tree is visible in the identity; the
  durable fact currently carries `callId`/`executionId` only (`execution-facts.mjs:96-137`), not the
  host's `rootCallId`/`parent`. That is a projection gap in OUR fact writer, not a host seam gap; it
  can be closed in-product. It does not change the verdict.

### (c) ESCALATION

- `packages/sandbox/sandbox/src/escalation.ts:171-226` — `approveEscalation` requires a strictly
  wider mode, refuses without an approver/agent, calls
  `approval.approver.request({agent, toolName, callId, reason: \`escalate sandbox to ${mode}:
  ${justification}\`, signal})`, and maps `allowed-once` to the widened mode; `rejected` /
  `cancelled` / `unavailable` throw before the run.
- `packages/interaction/user-approval/src/index.ts:270-285` — `ApprovalService.request` enters the
  `approval/request` waterfall on `scopeTarget(req.agent, req.agent)`; a throwing answerer fails the
  question closed.
- `packages/runtime/src/plugin/live/ptc-escalation-row.mjs:334-465` — the row's `adjudicate` parses
  the same verbatim prefix, then: `svc.requestControl(...)` with
  `kind: leader ? 'user-approval' : 'leader-approval'`, `correlation: callId`, an operation
  fingerprint that binds the mode; `awaitControlDecision(...)`; only `decision === 'allow'` mints;
  `mintOperationGrant` + `createGrantLedger().register/consume` give exactly one one-shot grant; a
  replay meets `CONSUMED`, a mode change meets the fingerprint, expiry precedes consumption.
- `packages/runtime/test/a5ptc-escalation-row.test.ts` already grades the five negative controls
  (replay / expiry / other-team / revocation-before-use / mode binding) through the real kernel.
- Also measured by the row itself: an unregistered/unroutable member is delegated to `next()`
  untouched; a governed ask with no ControlService fails CLOSED as `unavailable`, never silently
  through.
- **Scope note, not a part failure:** the one-shot grant is minted by the row, not by the centre, and
  the widened mode is handed straight to the PTC runtime. The Control decision is durable and
  one-shot; the centre does not re-admit the widened execution. This is the existing escalation
  design (the same row serves the fs/shell escalation), and it is the reason the row must not be
  described as "the centre's grant".

### (d) STOP

- `packages/core/tools/src/ptc.ts:412-414` — `runController` follows `exec.signal`:
  `exec.signal.addEventListener('abort', () => runController.abort(exec.signal.reason), {once:true})`.
- `packages/core/tools/src/ptc.ts:553-554` and `:697-705` — every nested dispatch gets
  `runController.signal`; the runtime's `run(resolve({... signal: runController.signal}))` gets the
  same signal.
- `packages/core/tools/src/ptc.ts:713-715` — on run settlement the controller is aborted and
  dispatches are drained, so a Stop cannot orphan an in-flight nested call.
- `packages/ptc-runtime/ptc-runtime-node/src/index.ts:153,195-201,166-180` — the runtime combines the
  caller signal with its own; abort calls `finish(...)`, which calls `handle.terminate()` and awaits
  `handle.done` / `waitForExit()` before resolving. A timeout or Stop therefore terminates the Node
  child.
- `packages/runtime/src/plugin/vnext/execution-facts.mjs:96-121` — `exec.signal?.aborted === true`
  becomes `outcome: 'aborted'`; `centre-install.mjs:239-247` maps that to `settlement.stop(...)` and
  `settlement.settled(...)'aborted'`; `settlement-port.mjs:44-50` maps `aborted` to `CANCELLED`.
  Nested calls have their own admission/execution records and follow the same path when the run
  controller aborts them.
- Caveat: the `CANCELLED` mapping is proven for the centre's existing pipeline; a live Stop of a
  `run_code` worker is NOT run in this round because the tool is still refused (see "NOT proven").

## The precise seam needed (`CORE_SEAM_BLOCKER`)

- **seam:** the `run_code` transport's policy resolution in the pinned tool registry
  (`@deepseek-ai/dsh-tools`, `createRunCodeTool`'s `resolveSandboxPolicy`) and the
  `SandboxExecutionPolicy` it can carry into `@deepseek-ai/dsh-ptc-runtime-node`.
- **host SHA:** `639ed015397290b3745d163aafe02ffee4aa3f84` (0.2.0-rc.2).
- **required behavior:** a governed caller must be able to supply, per execution, the Member's
  compiled OS profile (per-path read/write/deny rules, not only `{mode, workspaceRoot}`), or the
  runtime must be able to execute the worker through the Member's declared `confined-subprocess`
  executor so the declaration and the execution are the same thing.
- **observed public behavior:** `createRunCodeTool` resolves the policy from
  `ctx.get('sandboxPolicy').resolve({session})` (`core/tools/src/index.ts:948-951`), which returns
  only the session mode and `session.header.cwd` (`sandbox-policy/src/index.ts:164-169`);
  `SandboxExecutionPolicy` has no path rules (`sandbox/src/index.ts:40-53`); the runtime confines
  through the host `ctx.sandbox` and skips confinement under `danger-full-access`
  (`ptc-runtime-node/src/index.ts:224`). There is no public per-call hook from the tool layer to the
  Member realm's profile, and no public service substitution for `sandboxPolicy` that is scoped to
  one Member while the `ToolRuntime` is root-scoped.
- **minimal reproduction:** in the B-ladder world (`vnext-b-probe-ladder.test.mjs`), mount a realm
  whose compiled read/write lanes are `<ws>/inside` only, configure the host `sandboxPolicy` with
  `workspaceRoot: <ws>` and mode `workspace-write`, then dispatch `run_code` directly to the host
  registry (no centre listener) with `await import('node:fs').then(fs =>
  fs.writeFileSync('<ws>/outside/escape', 'x'))`; the write succeeds. The Member's lane never enters
  the decision. (Not committed as a live arm: with the centre installed the call is refused before
  the body, so the arm only measures the host seam, which the wiring above already proves.)
- **affected invariant:** "a Member with `run_code` allowed must not exceed its three-lane bounds or
  escape its OS profile through the worker" (round 85 security bar); round 75's process/execution
  authorization model (the declared executor must be the executor that runs).
- **upstream generic seam proposal (proposal only, CORE PATCH BUDGET = 0):** let
  `createRunCodeTool`'s policy resolver receive the execution's governing policy from the caller (a
  `ptcPolicy`/`policyProvider` face on the tool registration, or a scoped `sandboxPolicy` consulted
  through `scopeTarget(exec.agent)`), and widen `SandboxExecutionPolicy` with the per-path
  `allowPaths` ruleset the sandbox providers already accept (`ConfinedArgv` already carries the
  launcher argv; the product's `compileExecutionProfile` already produces `AllowPathEntry[]`).

## What this round did NOT prove

- No live `run_code` execution under the centre (it is still refused), so no live Stop arm and no
  live nested-call admission arm. (b)/(c)/(d) are established from the pinned host's own wiring plus
  the existing row suite, not from a booted governed PTC run.
- (b)'s "same ExecutionId tree" is currently only implied by the callId string; our durable facts do
  not project `rootCallId`/`parentCallId`. Closing that projection is product work for whenever (a)
  is repaired.
- The worker's OS enforcement was not measured on this kernel (no arm ran a worker). The finding does
  not claim the host sandbox is ineffective; it claims it is the WRONG policy for the Member lane
  invariant.
- No upstream patch was attempted; the seam is recorded, not worked around.
