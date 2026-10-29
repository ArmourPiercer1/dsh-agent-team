# U4 · G1F-SUP-A — H0 guard redesign (next()-passing), Host-equivalence suite, PoC-5/PoC-6 negatives

Executor: **G1F-SUP-A** · gate **G1-F** round-1 补充内容 · date 2026-10-25 (UTC) ·
Host pin `tests/deepseek-harness-test-use` @ `639ed015397290b3745d163aafe02ffee4aa3f84`
(pristine, porcelain-empty verified before and after **each** run; CORE PATCH BUDGET respected: 0 core edits, public seams only).

Inputs honored: `REVIEW.md` round-1 findings (esp. [W] self-dispatch bypass of
`dispatchToolBody` and the `legsOkFor >= 0` oracle bug), sealed U4-H0 package
(bytes re-verified every preflight — `sealed-unchanged:*`), obligations
(PoC-5 / PoC-6 in `feasibility.json` / `mechanism-groups.json` / SUMMARY.md).

**VERDICT: the reviewer's [W] finding is closed — the guard no longer self-dispatches; it
verifies identity and CALLS `next()`, delegating all execution/cancellation mechanics to the
Host — and the redesigned guard is Host-equivalent on every one of the 42 oracle cells,
including the full H0 a–f matrix re-run (sensitivity plant still shows the B Body executing
when the guard is off), the Host-equivalence suite (cancellation classes, signal fuse/restore,
in-guard-window swap, post-execute value/block paths, finalize/project capture, scheduler
classification race, nested parent-token dispatch), PoC-5 (late dynamic registration refused
before any Body unless explicitly bound by the center table) and PoC-6 (cross-agent
`send_message`/`interrupt_agent` spoof and `plugin_manager` call denied before the Body for a
governed session with zero observable effects, while a non-governed session keeps native
behavior). Primary evidence: `runs/g1fa-2026-10-25T14-29-16Z/` (42/42 cells,
`outcome=host-equivalent-guard-passes-all-cells`).

---

## 1. The redesigned guard — what it is and why

### 1.1 Review round-1 finding being fixed
H0's guard verified the binding and then executed `approved.def.execute(...)` **itself**
without calling `next()`. That bypasses `dispatchToolBody` and every settlement mechanism
around it (Host `packages/core/tools/src/index.ts` @639ed015): the pre-dispatch abort check
`:1564-1575`, `bodyInvoked`, cancellation-class selection `:1549-1557`/`:1623-1627`, the
post-execute abort check `:1803-1810`, and result normalization `:1865-1883`.

### 1.2 The design now used (Host-equivalent, verified sufficient — no fallback needed)
One prepended `tools/execute` listener (center plugin `g1fa-center`):

1. **Identity verification** — compare what the Host *will* resolve
   (`ctx.tools.get(name, exec.agent)`, the same scoped resolution as `:1578`) against the
   center-owned approval table. Mismatch or hidden ⇒ return an error result **without calling
   `next()`** — the error path never reaches `resolveExecution` and never executes a Body.
2. **Approve ⇒ `await next()`** — the *Host's* built-in dispatch resolves the definition and
   invokes the Body (`resolveExecution :1578`, `bodyInvoked=true :1580`, `:1581`). Zero
   re-implementation.
3. **Armed signal fuse** — before `next()`, wrap `exec.signal` as
   `AbortSignal.any([callerSignal, guardAbortController.signal])`. The Host's
   `dispatchToolBody` fuses this wrapper with the caller signal (`:1569`) and re-checks abort
   **before invoking the Body** (`:1572`), and its `finally` restores `exec.signal` (`:1590`).
   A prepended `tools/change` watcher aborts the guard controller **synchronously** when the
   visible binding of a governed name changes while a call is armed — so a swap in the
   guard→resolve window (`:1511` verify → `:1578` resolve, the residual TOCTOU window F3) is
   converted into the Host's *own* pre-dispatch abort (`ABORTED_BEFORE_DISPATCH`), and a
   mid-Body swap is delivered through the fused signal (`ABORTED`, `bodyInvoked=true`).
4. **Settlement post-check** — after `next()` resolves, re-resolve the binding: identity drift
   on a *success* result is converted to the guard's veto (fail-closed); the signal is
   asserted restored to the guard wrapper; every settlement is classified.
5. **Nested dispatch** — sub-dispatches (`exec.parent` via the public `exec.token`) re-enter
   the same listener and are re-verified (proven both directions: approved-nested runs,
   poisoned-nested vetoes).

Why this satisfies the reviewer: every cancellation/side-effect mechanism that H0 had to
*assert by trace* is now *used by construction* — the guard adds verification, never an
alternative execution path.

### 1.3 Mechanism anchors (all exercised — see §4)
| Seam | Host line(s) | Cell(s) proving behavior |
| --- | --- | --- |
| caller-cancel before waterfall | `:1500`/`:1532` → `ABORTED_BEFORE_DISPATCH` | eq1 |
| around-dispatch waterfall (`tools/execute`) | `:1609` (listener not calling `next()` vetoes dispatch) | c2, d1, p5a, eq9, eq11, p6-* |
| pre-Body abort check fed by watcher | `:1572` | eq4, e1, e2 |
| late resolve / `bodyInvoked` | `:1578`/`:1580` | eq2, e3, c1 |
| signal fuse + restore | `:1569`, `:1590` | eq3 (fuse ⇒ `ABORTED`; `signalRestored=true`) |
| post-execute abort + cancellation class | `:1583`, `:1624`/`:1652` | eq2/eq3/c1/b2 (`ABORTED`), eq1/eq4 (`ABORTED_BEFORE_DISPATCH`) |
| post-execute waterfall value re-resolve + `createSuccessResult` | `:1646-1651` (P8) | eq5 (replace@parity), eq6a (swapped schema validated+rendered), eq6b (`INVALID_TOOL_OUTPUT`), eq7 (block→`ERROR`) |
| finalize/project captured at `createExecution` | `:1407-1439` (`:1436-1437`) | fin-eq8 (B's Body ran; finalize/project = A) |
| scheduler classification race | `:1297-1311` (`executionMode` public) | eq9 (parallel→exclusive advisory; dispatch then guard-vetoed) |
| `normalizeDispatchResult` | `:1865-1883` | eq6b + `global_bdiv_never_ran` |
| nested `parent: ToolExecutionToken` | `:316-349` | eq10 (approve+run), eq11 (veto) |

## 2. Oracle fix (review round-1 requirement 2) — and its disclosure
- `legsOkFor(tag, expected)` now requires the **exact expected leg set per cell, each row
  `ok===true`** (an unexpected leg row — even `ok:true` — fails the cell; zero-leg cells
  require zero rows). Negative-tested: `mutation-unexpected-leg-rejected` in
  `g1fa-selfcheck.mjs`.
- Every cell asserts the **exact settlement class** from `tools/result` rows
  (`error.info.code`) + ctl-side `equiv` rows; marker set is asserted **exactly**
  (`global_markers_exact`, got=expected=30).
- **Disclosure (oracle corrected between run 1 and run 2; both sealed):** run
  `g1fa-2026-10-25T14-26-12Z` failed 5 cells. (a) `c_preguard_veto`/`d_restrict_veto`: the
  assertion read the veto *message* from the result row instead of the fine-grained
  `reason` from the guard's own ledger row (field transcription; class was correct).
  (b) `e_races`/settlement/markers: the pre-run expectation assumed microtask-timed swaps
  interleave mid-Body; observation (run-1 ledger: `guard approve` → `arm fired
  micro-shadow` → `change-watch abort` → `guard settled ABORTED_BEFORE_DISPATCH`, zero
  `body-start` rows) shows the swap lands **before Body invocation** and the Host's `:1572`
  check prevents it — a *stronger* outcome. Expectations corrected to the prevented form;
  e3/c1/eq2/eq3/b2 retain true mid-Body coverage. No fixture/plugin behavior changed between
  runs (plugin SHAs identical); the correction is assertion-side and documented here.

## 3. Runs, budget ledger, hygiene
| Experiment | What | Host starts | Result |
| --- | --- | --- | --- |
| E1 | dry-run + `g1fa-selfcheck.mjs` (synthetic ledger + 4 mutation tests) | 0 | all green |
| E2 | run `g1fa-2026-10-25T14-26-12Z` (start #1) | 1 | 26/31 → §2 disclosure |
| E3 | run `g1fa-2026-10-25T14-29-16Z` (start #2) | 1 | **42/42 PASS** |

Budget: **2/2 Host starts, 3/6 experiments**. Runs 7.6 s each (≤30 min bound), evidence
2.4 MiB (≤2 GiB). Port **3185 only** (`ss -ltn` verified free pre/post; 3186 = G1F-SUP-B
lane never touched; `:3080`/`~/.dsh` untouched). Worlds `tests/homes/g1fa-2026-10-25T14-26-12Z`
+ `g1fa-2026-10-25T14-29-16Z` deleted after sealing (nothing material un-mirrored:
patch text reproducible via `buildPatchText()`, all observation under `runs/`). Only
own-PID teardown (`teardown-host killed:true portFree:true`); token redaction
(`host-instance-log.log.redacted`); HTU porcelain-empty + HEAD==pin after every run
(`post-check-htu` ok in both `steps.jsonl`). No commits; writes only under this directory.

## 4. Cell table (run `runs/g1fa-2026-10-25T14-29-16Z/`, all PASS)
Evidence per cell: `ledger.jsonl` rows by tag/callId + `markers/` files + `summary.json`
cell details; classes from `tools/result` rows.

| Cell | Property | Exact class asserted |
| --- | --- | --- |
| `a_stable` | quiet window: A runs | SUCCESS, legs {read,process} |
| `b_regen_at_rest` | regen-same at rest | SUCCESS, legs {read,process} |
| `c_preguard_veto` | agent-scoped B shadow before dispatch | veto `identity-mismatch`, **U4_GUARD_VETO**, 0 body rows |
| `c_restore_control` | after unshadow | SUCCESS |
| `d_restrict_veto` | scoped `restrict` hides target | veto `not-visible`, **U4_GUARD_VETO**, 0 body rows |
| `d_lift_control` | after lift | SUCCESS |
| `c1_foreign_midbody` | shadow swap mid-Body | watcher aborted, **ABORTED**, legs {} , zero B markers |
| `b2_regen_inflight` | regen-same mid-flight | **ABORTED**, A-only |
| `e_races` | micro-shadow ×2 + timer shadow ×1 | e1/e2 **ABORTED_BEFORE_DISPATCH** 0 body rows (prevented pre-dispatch, `:1572`); e3 **ABORTED** mid-Body; zero B rows/markers |
| `f_plant_executes` | sensitivity plant (guard off, fence-window swap) | **B executes**: marker+echo+process leg, `disabled-passthrough` |
| `f_after_restore` | after guard back on | SUCCESS |
| `eq1_pre_aborted_signal` | caller signal aborted pre-dispatch | **ABORTED_BEFORE_DISPATCH** (equiv+result), 0 body rows, guard never reached |
| `eq2_cancel_during_body` | caller aborts during Body | **ABORTED** + body-start (bodyInvoked true) |
| `eq3_signal_fuse_restore` | mid-flight swap under guard | **ABORTED**, `signalRestored=true`, post-check `drift` |
| `eq4_swap_in_guard_window` | swap inside guard listener | **ABORTED_BEFORE_DISPATCH**, 0 body rows — Host `:1572` prevented Body via synchronous watcher abort |
| `eq5_post_value_parity` | post-execute value replacement | SUCCESS, value note replaced |
| `eq6a_post_value_swapped_parity` | post-execute swap-then-accept | SUCCESS with `B-render:` content — swapped def schema-validated+rendered (P8 leak shape; parity rule required) |
| `eq6b_post_value_divergent` | divergent schema via post-execute swap | **INVALID_TOOL_OUTPUT**, Bdiv Body never ran |
| `eq7_post_block` | post-execute `block()` | **ERROR** containing `G1A-POST-BLOCKED` |
| `eq8_finalize_project_capture` | swap before finalize on aborted call | finalize/project rows **A-only**, content `FINALIZED-BY-A`, **ABORTED** (capture at `createExecution`) |
| `eq9_execmode_race_failclosed` | mode race | `executionMode` parallel→**exclusive** after swap (advisory), dispatch **U4_GUARD_VETO**, 0 body rows |
| `eq10_nested_approved` | nested dispatch via `exec.token` | guard approve nested=true, Body nested=true, **SUCCESS** |
| `eq11_nested_veto` | nested dispatch poisoned | guard veto nested=true, **U4_GUARD_VETO**, 0 body rows |
| `p5a_late_shadow_veto` | **PoC-5**: late registration by non-center plugin | veto `identity-mismatch`, **U4_GUARD_VETO**, Bp never ran |
| `p5b_explicit_bind_runs` | after center-table explicit bind | Bp SUCCESS, legs {read,process} |
| `p6_send_message_veto` | **PoC-6**: spoof cross-session send | **U4_GUARD_VETO** `agent-control-deny`, pre-Body |
| `p6_interrupt_agent_veto` | spoof interrupt | **U4_GUARD_VETO** |
| `p6_plugin_manager_veto` | install_bundle attempt | **U4_GUARD_VETO** |
| `p6_plant_native_when_guard_off` | same call, ctl-guard off | **NOT_RESUMABLE** (native Body ran; not a veto) |
| `p6_spoof_zero_effects` | wire grep of all 90 mock requests | spoof payload never appears in session-N history |
| `p6_profile_zero_effects` | profile-tree sha256 digest pre/post PoC-6 | **unchanged** (673d08953fbe=) — no process spawn/profile mutation |
| `n_native_plugin_manager_list` | non-Team session `plugin_manager list_plugins` | native dispatch **UNKNOWN_TOOL** (see §6 limit), not a veto |
| `n_native_list_agents` | non-Team session | **SUCCESS** native |
| `n_native_send_message` | non-Team session bogus target | **NOT_RESUMABLE** native — behavior kept |
| `global_b_exactly_plant` | B executed iff guard-off plant | starts=[f1] only |
| `global_bp_exactly_bound` | Bp only after bind | 1 row |
| `global_bdiv_never_ran` / `global_never_zero` / `global_markers_exact` | absence invariants | 0 / 0 / 30=30 |
| `global_guard_vetoes_seen` | veto trail | c2:identity-mismatch, d1:not-visible, eq9:identity-mismatch, eq11:identity-mismatch/nested, p5a:identity-mismatch |
| `fixture_heal` · `protocol` | per-group heal; 401 gate + 2 sessions + 12×HTTP 200 | ok |
| `wire_secondary` (non-gating) | tool announcement observed | target/ctl/send/list_agents on wire; **plugin_manager absent** (→ §6) |

## 5. Merged conditions for U6 — center-enforceable invariants (updated from H0 §6 + this round)
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

## 6. Stated limits (non-claims)
- **Nested dispatch is simulated** via the public `execute({parent: exec.token})` path (the
  same `ToolExecutionToken` an agent-control tool passes). PTC `run_code` transport is not
  mountable in native headless mode; the shared-funnel property is what is proven.
- **PoC-5 simulation**: the real browser client-plugin cannot be loaded headless; the late
  registration arrives from an unrelated plugin row through the identical
  `ctx.tools.register` seam host-runner uses for client-contributed tools (`sandboxRegisterTool`,
  host-runner `guard.ts` cited). Seam fidelity is asserted at the registration choke point.
- **plugin_manager native positive control is degraded by the environment**: the web-profile
  default session does not mount `plugin_manager` (wire probes: absent; call resolves as the
  native dispatcher's `UNKNOWN_TOOL`). The governed-session **veto is mount-independent**
  (proven pre-Body, zero effects); the "native behavior kept" positive is proven for
  `list_agents` (SUCCESS) and `send_message` (NOT_RESUMABLE). Nothing was ever installed.
- PoC-6 governance here is the fixture's `ctl-guard` layer (per-agent governed set via public
  `govern-self`); Team/blueprint-driven scoping is U6's integration question, not claimed.
- Results bind to this Host pin, this oracle (markers + ledger rows written **inside** Bodies
  + `/bin/echo` process legs + settlement rows), single-process Host.

## 7. Files
- `g1fa-shared.mjs` — fixture library (Bodies with ground-truth legs; registry ops; state; ctl schema).
- `g1fa-plugin.mjs` — center plugin: redesigned guard (next()-passing), `tools/change` watcher,
  `tools/result` classifier, ctl driver for the 12 equivalence cells, fence/fence2 plants.
- `g1fa-registrant.mjs` — separate plugin row: Bp late registrant + control tool (registers nothing at boot).
- `g1fa-run.mjs` — runner: preflight, 2-plugin patch, two-session mock (T governed / N non-Team),
  12 groups (G1–G12), fixed oracle, teardown, HTU post-check. `--go` gate; dry-run default.
- `g1fa-selfcheck.mjs` — zero-Host unit checks: decide routing, tree digest, synthetic-pass oracle,
  4 mutation tests (incl. the `legsOkFor >= 0` regression guard).
- `instance.mjs` / `util.mjs` / `mock-deepseek.mjs` / `s1m1-session-client.mjs` — byte-identical
  copies of the sealed `s1-h0-m1` harness (SHAs asserted in every preflight).
- `make-manifest.mjs` / `manifest.json` — sha256 of everything here.
- `runs/g1fa-2026-10-25T14-26-12Z/` — run 1 (sealed, 26/31, basis of §2 disclosure).
- `runs/g1fa-2026-10-25T14-29-16Z/` — **primary evidence** (42/42; `ledger.jsonl`, `markers/`,
  `wire/` probe fixtures, `steps.jsonl`, `summary.json`, redacted host log).
- `runs/go-20261025T142612Z.out` / `runs/go2-20261025T142916Z.out` — console seals.
