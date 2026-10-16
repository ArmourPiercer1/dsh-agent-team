# Seam record (PoC-1 format) — the post-door Definition resolution

Recorded by the Alpha.5 **PR1 residual-boundary** round (`alpha5-pr1r-residual-boundaries`,
base `db5cb5f7` = merged PR1). Host: DSH `0.2.0-rc.2` @ `639ed015397290b3745d163aafe02ffee4aa3f84`,
pins from [`tests/paths.mjs`](../../../../tests/paths.mjs). CORE PATCH BUDGET = 0: this file
records a **missing** public seam; it does not patch, shim or reason around it.

Threat-model note, stated once and not re-worded anywhere in this round: the scenario measured
here is an **ordinary, non-malicious concurrent re-registration** by a legal contributor
(a plugin or MCP bridge replacing its own same-name Definition while a call is in flight). It is
inside the supported scope. It is **not** the excluded "attacker rewrites Host memory" class, and
this record does not move either boundary.

```
seam asked for         : a public, per-call hook that runs AFTER the registry has resolved the
                         Body of THIS call and BEFORE that Body is invoked — i.e. a place where
                         "the Definition I am about to run" can be re-verified and the call
                         refused before it runs.
where resolution       : packages/core/tools/src/index.ts @ 639ed01539
  actually happens       - `scheduleExecution` → `ctx.waterfall(carrier, 'tools/pre-execute', …)`
                             (:1505-1508), then the Guard stage `this.guardReason(exec)` (:1519)
                         - `dispatchScheduledExecution` →
                             `ctx.waterfall(carrier, 'tools/execute', exec,
                                            () => this.dispatchToolBody(mutableExec))` (:1605-1608)
                         - `dispatchToolBody` (:1564) →
                             `this.resolveExecution(exec.name, exec.agent, …)` (:1578)
                             → `tool.execute(...)`
                           The Body's Definition is therefore chosen INSIDE the innermost step,
                           after the Guard stage and after EVERY listener any plugin can mount.
what the existing       : `tools/pre-execute` (before the Guard stage), the Guard stage itself
public seams give       : (not a listener seam: `tools.guard(...)` is a guard, not a waterfall),
                          `tools/execute` (the innermost WATERFALL a plugin can join),
                          `tools/post-execute` / `tools/result` (both AFTER the Body),
                          `tools/change` (an event about the registry, not about this call),
                          `tools.get(name, scope)` (a read, at any moment, of a value that can
                          change again before the Body is chosen).
                        Every one of them is before `resolveExecution` or after `tool.execute`.
what it does NOT give   : nothing observable, and no refusal point, in the interval between the
                          last `tools/execute` listener's `next()` and `resolveExecution` at :1578.
                          A legal `register()` landing in that interval — performed by a listener
                          mounted after ours, or by any code the registry itself runs there — is
                          invisible to every seam this lane owns, and its Body runs.
measured, not argued    : `tests/kits/a5-pr1-guard-dispatch/a5p1r-rereg-window.mjs`, arm
                          `inner-after-ours` (deterministic park at `tools/pre-execute`, the
                          re-registration performed by a third-party `tools/execute` listener
                          mounted AFTER the lane's door):
                            v1=0 v2=1  (the un-validated Body RAN)
                            obs=third-party-execute-listener>legal-re-register>body:V2
                          RED/GREEN logs: `runs/Rb-rereg-window-RED.log`,
                          `runs/Rb-rereg-window-GREEN.log`. The same runner's arm
                          `inner-before-ours` shows the half of the interval a public seam DOES
                          cover (our door refuses: v1=0 v2=0), and arm
                          `guarded-pre-execute-no-change` isolates F2's per-call read with the
                          `tools/change` channel unavailable (deny / `definition-drift`, no body).
what a Core-side        : ANY of these closes it, in rough order of preference; the lane needs
change would have       : one, not all. They are REGISTERED IN THIS PROJECT as seam demands:
                        : nothing is filed outside this repository by this round, and any
                        : external submission would itself require the user's separate
                        : authorisation.
  this lane to close it   1. a `tools/pre-dispatch` (or `tools/resolve`) waterfall step invoked
                            with the resolved `ToolDefinition` between `resolveExecution` (:1578)
                            and `tool.execute` — the refusal shape already exists (`deny` ⇒
                            typed result), so no new vocabulary is needed;
                          2. OR a resolution-stable call: `createExecution` pins the resolved
                            Definition into the execution and `dispatchToolBody` runs THAT
                            instead of re-resolving by name (this also removes the pre-execute
                            window entirely, which today F2 covers by re-reading);
                          3. OR the resolved Definition exposed on the exec the innermost
                            listener receives, so the door nearest the Body can compare
                            `exec.resolvedDefinition` against the Binding it validated — without
                            a refusal point this only makes the gap visible, not closable.
status of the gap       : **机制已按裁决记录；运行接线与安全验收挂 G-a 冻结，解除须用户裁决。**
  (mechanism recorded   This entry describes what was built and what it leans on — not what has
   per ruling (ii),       been accepted. Until G-a is lifted by a user ruling, neither this file
   acceptance frozen)     nor any other document in this repository may be read as calling it
                         closed or compliant. The lane does NOT
  in this round          refuse from inside the door — the rejected design (a door that never
  (was: "fail-closed     calls `next()`) is not used anywhere. It uses the seam the Host already
  posture")              advertises to a wrapper: "wrappers may change only `exec.signal`, while
                         call identity remains immutable. The registry re-fuses the original
                         caller signal before the body, so replacement cannot detach caller
                         cancellation" (`index.ts:155-159`). At `:1572` the Host refuses a raised
                         fused signal BEFORE `resolveExecution` (`:1578`), so `bodyInvoked` stays
                         false and no Body is resolved, invoked, or reported as executed.
                         (1) The Guard re-read stays: a Body re-registered before the Guard stage
                         never runs (`RW-PRE-EXECUTE-COVERED`). (2) The `tools/execute` door re-ask
                         stays (`RW-INNER-DOOR`). (3) A Body re-registered AFTER our door is now
                         CANCELLED before dispatch: the door arms a watch on the identity it
                         validated, the `tools/change` notification moves that watch, and the
                         watch's cancellation is what the Host reads at `:1572` — measured by
                         `RW-AFTER-DOOR-BODY-ZERO`: `v1=0 v2=0`, code
                         `ABORTED_BEFORE_DISPATCH`, `secondCall v2=0`.
RETRACTION (this        : the previous text of this record claimed "(3) A Body re-registered
  round, by ruling)      AFTER our door runs exactly once … The exposure is therefore ONE call
                         per move, never a standing state", and the kit criterion
                         `RW-RESIDUAL-RECORDED` asserted `v2 === 1` as its pass condition. THAT
                         CLAIM IS WITHDRAWN. It rested on two things that do not hold: (a) the
                         settled-edge withdrawal was attributed to the call edge but came from the
                         `tools/change` channel (`callEdgeWithdrawal: 0` in the same-arm raw json);
                         (b) `secondCallV2` is a CUMULATIVE counter, so `secondCallV2 === 1` did
                         not show "the next call ran nothing". Redone against the pinned Host with
                         body-count criteria, the un-validated exposure of one move was measured at
                         1 Body (`runs/B3-after-door-RED.json`: `v1=0 v2=1
                         secondCallV2=1`) and is now measured at 0 (`runs/B3-after-door-GREEN.json`:
                         `v1=0 v2=0 secondCallV2=0`). "One call, then withdrawn" is not a
                         fail-closed posture and may not be cited as one.
what is still open      : the channel is a capability, and one configuration cannot be proven at
                         assembly time: a `tools/change` subscription that is ACCEPTED but never
                         delivered is undetectable from outside. That case is not covered over: the
                         lane reports `changeChannel: 'armed'|'proven'`, and every call that
                         completes with a moved Definition while the channel is unproven raises
                         `dispatcher-call-executed-unvalidated` at alarm severity (kit
                         `RW-CHANGE-INERT-LOUD`) — an assembly whose channel stays like this is
                         reported as not-shown-to-be-closed, never as closed. A subscription that
                         THROWS, or an `on` that does not exist, is a typed
                         `IO_POLICY_UNSUPPORTED` refusal naming `tools/change`
                         (`RW-NO-CHANGE-CHANNEL-UNSUPPORTED`): unsupported, not silently weaker.
retirement condition    : the record retires when seam demand (1) or (2) is MET by a future Host
                         release (a pre-dispatch seam, or a resolution-stable call) — an event
                         this project waits on and does not request externally. Then the watch ledger and
                         the signal wrapper both degrade to assertions and this record retires.
                         Until then `RW-AFTER-DOOR-BODY-ZERO` asserts the body count is zero, so
                         the boundary cannot silently be re-labelled a pass OR a residual.
```

## 增补（后续修复轮，文档 only）— 机制所依赖的三条实现事实、三个候选修法、两处口径限定

> **G-d 纪律标注（先说适用范围）**：本文所描述的 (ii) 机制，其**运行接线验收挂 G-a**——
> 用户尚未裁 (ii) 的语义（必改点 2 已上报，G-a 冻结该保证的运行接线验收）。本节**不构成**
> 对该接线的验收，也不改变任何实现；它只把"文档口径"补到与机制实际所依赖的东西一致。

```
fact 1 — the raise has    : packages/runtime/tool-dispatch/pending-calls.ts:148-157.
  no body gate            `onRegistryChange` walks every `watched` record and calls `raise(...)`
                          for each one whose identity moved (or cannot be read). There is NO
                          "has this call's Body started?" test — and the ledger CANNOT have one:
                          nothing it can observe says so (fact 3). So the lane's action is
                          uniformly "abort", and what separates a cancellation from a termination
                          is decided entirely by the Host's own check at `:1572`, not by anything
                          the lane knows at the moment it raises.
fact 2 — the propagation  : packages/core/tools/src/index.ts:1576, `exec.signal = signal`.
  point and what rides      The fused signal is installed on the execution AFTER the `:1572`
  on it                     refusal check, and it is the same object that check consulted. Two
                          consequences the record must own: (a) the wrapper-signal route works
                          because `:1572` consults the fused signal — the guarantee is `:1572`'s
                          and only `:1572`'s; (b) if a future Host revision moves that check
                          after the Body starts, or re-derives the signal instead of fusing it,
                          every "cancellation" here silently becomes a "termination" — with the
                          lane still reporting accurately (it reads the resulting codes) and the
                          property it was installed for gone. That is an implementation dependency
                          no public contract currently pins.
fact 3 — body start is    : packages/core/tools/src/index.ts:1580, `state.bodyInvoked = true`.
  not publicly observable   This is a private field of the registry's cancellation state. No public
                          event fires when the Body starts. The lane therefore learns
                          "the Body ran" only RETROSPECTIVELY, from the two canonical codes on the
                          settled edge. Its cancel/terminate distinction is RESULT-shaped, not
                          event-shaped — which is exactly why `dispatcher-call-outcome-unreadable`
                          exists: when the codes cannot be read, the lane declines both claims
                          instead of promoting an inference into a fact.
status wording, not     : this record says neither "closed" nor "compliant". It says: MECHANISM
  a claim of closure      RECORDED PER RULING (ii); its run wiring and its safety acceptance are
                          FROZEN AT G-a, and only a user ruling lifts that. What was measured
                          (`RW-AFTER-DOOR-BODY-ZERO`, `RW-CHANGE-INERT-LOUD`) is a property of
                          THIS build on THIS Host implementation, resting on the three facts
                          above — a measurement is not an acceptance, and keeping the two apart is
                          exactly what G-a is for. Two sub-cases are outside the mechanism and are
                          not smuggled in by any wording here: (a) a Definition move that races an
                          already-started Body — by design a TERMINATION, reported as executed;
                          (b) a subscribed-but-silent notification channel — its own open item,
                          recorded immediately below, which does NOT close together with G-a.
g-g — independent open  : the configuration "subscribing to `tools/change` SUCCEEDS but the
  item, not covered by    notification is never delivered" is recorded as its own open item, not a
  G-a by default          footnote of the G-a question. Its support-matrix position is
                          **未收口 / not settled**: what this build does in that configuration
                          (name-level withdrawal + a loud per-call alarm; in-flight calls
                          unaffected) is a MEASURED FACT with filed evidence, not a supported
                          posture. Acceptance is handled as UNSUPPORTED / 待证; closing it is a
                          contract action of its own, later and separate. Position statement and
                          evidence pointers: `s12-residual-evidence.md` §(j).
candidate seam demand 1 : a public pre-body step — a `tools/pre-body` (or making `:1572`'s
  (registered in this     decision point a waterfall step) invoked after resolution and before
                          invocation. Then refusal is a first-class act, the lane needs no signal
                          proxy, and "did the Body start" becomes observable rather than inferred.
                          Needs a Core-side change, so it is
                          REGISTERED IN THIS PROJECT as a seam demand of the `CORE_SEAM_BLOCKER`
                          class — an inventory entry, nothing more: this round files nothing
                          anywhere outside this repository, and any submission to the Host's
                          upstream would itself be a future action requiring the user's separate
                          authorisation. This lane does not route around the gap.
candidate seam demand 2 : resolution-pinned execution — `createExecution` pins the resolved
  (registered in this     Definition into the execution and `dispatchToolBody` runs THAT instead
                          of `resolveExecution(exec.name, …)`. The whole window disappears (and the
                          pre-execute window stops depending on F2's re-read). Needs a Core-side change; same
                          registered-class note as demand 1 (nothing is filed externally by this
                          round). It is strictly better than demand 1 for the threat model because
                          it removes the re-resolution rather than gating it.
candidate route 3       : adjudication semantics — treat "the Definition moved and this call's
  (this side, no Core)     Body may already have started" as a governance decision rather than a
                          dispatch one: e.g. an in-flight move forces a turn-level abort/re-drive of
                          the affected member, or the result is marked untrusted and adjudicated.
                          Reachable without Core (it lives in runtime/team semantics), at the cost
                          of moving cancellation semantics up to the Session layer — and it needs
                          the user ruling that G-a is holding. It is recorded here as a candidate
                          route, not as an action this branch takes.
precision note on the     : when `tools/change` is subscribed but delivers nothing, what the lane
  silent channel           degrades to is NAME-LEVEL, not call-level. Measured (`RW-CHANGE-INERT-
                           LOUD`: `v2=1` + `dispatcher-call-executed-unvalidated` + alarm): the
                           in-flight call is NOT cancelled — nothing can cancel it — and what the
                           lane does instead is withdraw that NAME's Binding at the settled edge,
                           so the name's FURTHER calls are refused until an explicit re-bind. The
                           defensible sentence is therefore: "the moved name is pinned out before
                           its next call". NOT: "in-flight calls of the moved name are cancelled"
                           (that claim belongs only to the case where the channel actually spoke).
```

Cited lines were re-read at the pinned baseline (`0.2.0-rc.2` @ `639ed01539`) and at this
branch's own `packages/runtime/tool-dispatch/pending-calls.ts`; the two Host facts are quoted with
their line numbers as they appear there, not paraphrased from the previous round's notes.
