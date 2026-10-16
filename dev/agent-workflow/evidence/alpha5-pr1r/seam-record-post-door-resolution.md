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
fail-closed posture     : the lane refuses as early as a public seam allows and bounds what it
  taken in the meantime : cannot refuse. (1) The Guard re-reads the Definition on EVERY call
  :                       (:1519 territory) — a Body re-registered before the Guard stage never
                          runs. (2) The `tools/execute` door (the door NEAREST the Body that this
                          lane can own) re-asks the whole closed-world question after the Active
                          check — a Body re-registered after the Guard stage but before our door
                          is refused there (`RW-INNER-DOOR`, measured). (3) A Body re-registered
                          AFTER our door runs exactly once, and at that same call's settled edge
                          (`tools/result`) `noteCallEdgeDefinition` compares the pinned identity
                          with what the name now resolves and WITHDRAWS the verification
                          (`dispatcher-definition-change-at-call-edge`), so the next call is
                          refused and only an explicit re-bind by the trusted assembly restores
                          it — measured by `RW-RESIDUAL-RECORDED`: `v2=1` (one un-validated Body)
                          then `secondCall v2=1` (the next call ran nothing).
                          The exposure is therefore ONE call per move, never a standing state.
retirement condition    : when (1) or (2) exists at a public seam, `noteCallEdgeDefinition`
                          degrades to an assertion (a moved Definition at the settled edge becomes
                          impossible by construction) and this record retires. Until then the
                          kit's `RW-RESIDUAL-RECORDED` criterion asserts the HONEST fact — the
                          Body ran — so the boundary cannot silently be re-labelled a pass.
```
