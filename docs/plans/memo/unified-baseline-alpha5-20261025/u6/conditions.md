# U6 center conditions — the ten center-enforceable invariants (G1-F carried set)

> **Provenance (2026-10-26, FIX-D).** Verbatim extraction of `dev/agent-workflow/evidence/u4-g1f-sup-a-20261025/README.md`
> §5 "Merged conditions for U6 — center-enforceable invariants (updated from H0 §6 + this round)" (G1-F supplement-A
> evidence, 2026-10-25). These ten conditions are the center-enforceable invariant set the U6 kernel must satisfy
> (risk-ledger item R-G1F-3 in [../gates/GATE-VERDICTS.md](../gates/GATE-VERDICTS.md) points here); the enforcement flip
> additionally requires the K1–K5 amendments listed in [./U6-SLICE-PLAN.md](./U6-SLICE-PLAN.md).

1. **Center-owned approval table** (H0 1): verification is only meaningful against a table the
   composing center owns; the guard's `next()` design adds no new trust.
2. **Composition-order control** (H0 2): guard must hold first-precedence delivery for governed
   names; center must be able to enumerate `tools/execute` listeners/registrants. A later
   prepender running arbitrary code is composition-membership trust, not a TOCTOU hole.
3. **Governed-name visibility discipline** (H0 3) **+ PoC-5 generalization**: any runtime
   registration of a governed name by a non-center plugin (incl. client-plugin dynamic
   registration — it lands on the same `ctx.tools.register` seam, `sandboxRegisterTool` →
   `tools.register`, host-runner `guard.ts`) is refused before any Body **unless the center
   table explicitly binds it** (p5a→p5b). Center needs bind/unbind as first-class actions.
4. **Result-path schema parity (P8), now measured** (H0 4): with parity, a post-execute swap
   makes the *swapped* Definition schema-validate and render the result (eq6a — binding leak,
   never a Body execution); with divergence, `INVALID_TOOL_OUTPUT` (eq6b). Rule: admitted
   Definitions for a governed name share I/O schemas exactly; block-path veto always available
   (eq7). Finalize/project callbacks bind at `createExecution` (eq8) — post-dispatch
   finalizer swaps are inert.
5. **In-Body grant is defense-only** (H0 5): unchanged.
6. **No transactional registration-time veto** (H0 6), now operationalized: synchronous
   `tools/change` watcher + guard-armed signal converts post-commit observations into the
   Host's own pre-dispatch abort (eq4, e1/e2) or mid-Body abort (c1, b2, e3) — the center
   promises "zero dispatch of unverified Body", not atomic swap prevention.
7. **NEW — Cancellation semantics are the Host's.** A center guard must not self-dispatch:
   it must call `next()` and use signal fusion only. Self-dispatch loses `bodyInvoked`, the
   ABORTED vs ABORTED_BEFORE_DISPATCH distinction, the post-execute/finalize/notify pipeline
   and `normalizeDispatchResult` (the round-1 [W] finding; closed by eq1/eq2/eq3).
8. **NEW — Scheduler classification is advisory at dispatch time** (eq9): `executionMode`
   computed from the live table can be raced by a swap between classification and dispatch;
   no re-check happens before the Body. Governance must fail closed in the guard (it did);
   the center must not present `executionMode` as a security boundary.
9. **NEW — Nested dispatch shares the governed funnel** (eq10/eq11): sub-dispatches via the
   public `exec.token`/`parent` path pass through the same guard and must be handled
   explicitly; the center guard must be nested-aware (identity re-verified per nesting level).
10. **NEW — Agent-control-plane names are governable in the same seam** (PoC-6):
    `send_message`/`interrupt_agent`/`plugin_manager` refusals happen before any Body, with
    zero effects (wire-grep + profile-tree digest), and non-governed sessions keep native
    behavior (SUCCESS/NOT_RESUMABLE/UNKNOWN_TOOL, never a veto). The governed name set must be
    profile-aware (mounting varies) and refusals must not depend on the name being mounted.
