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
what upstream would     : ANY of these closes it, in rough order of preference; the lane needs
have to provide for     : one, not all:
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
how the gap is closed   : by user ruling (option (ii)) in the B3 fix round. The lane does NOT
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
retirement condition    : the mechanism retires when upstream offers option (1) or (2) above: a
                         pre-dispatch seam, or a resolution-stable call. Then the watch ledger and
                         the signal wrapper both degrade to assertions and this record retires.
                         Until then `RW-AFTER-DOOR-BODY-ZERO` asserts the body count is zero, so
                         the boundary cannot silently be re-labelled a pass OR a residual.
```
