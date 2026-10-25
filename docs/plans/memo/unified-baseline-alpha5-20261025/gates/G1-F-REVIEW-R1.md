> **Tracked copy (2026-10-26, FIX-D / external-audit finding D3).** Verbatim copy of `dev/agent-workflow/evidence/u4-g1-f-review-r1/REVIEW.md`
> (local evidence, untracked at copy time). Content below unchanged; the machine-checkable index of what
> these records say is [./GATE-LEDGER.md](./GATE-LEDGER.md).

# G1-F Security Review Round 1

**Verdict: 补充内容**

## Findings

1. **Self-dispatch is not Host-equivalent.** `tools/execute` waterfall short-circuit is a documented public behavior: returning without `next()` vetoes built-in dispatch (`tests/deepseek-harness-test-use/vendor/cordis/src/events.ts:224-243`). However, directly calling `approved.def.execute(...)` is only a callback invocation, not a supported substitute for `ToolRuntime` dispatch. It bypasses `dispatchToolBody`'s signal fusion, pre-body abort check, `cancellationStates.bodyInvoked` bookkeeping, and Host-owned success/error settlement (`tests/deepseek-harness-test-use/packages/core/tools/src/index.ts:1564-1591`).

2. **Concrete cancellation bug is untested and safety-relevant.** The guard can enter the body even when the caller signal is already aborted: the PoC self-dispatch path has no equivalent of the Host check at `index.ts:1572-1575`. It also never sets Host `bodyInvoked`; if cancellation arrives during the body, `cancellationResult()` can classify a started body as `ABORTED_BEFORE_DISPATCH` (`index.ts:1549-1557`, `1623-1627`) and permit incorrect settlement semantics. This is a correctness defect even when no unverified body executes.

3. **Host signal lifecycle is bypassed.** `dispatchToolBody` fuses the original caller signal and wrapper signal and restores `exec.signal` in `finally` (`index.ts:1568-1591`). The PoC replaces `exec.signal` but calls the body outside that fuse/restore machinery (`u4h0-probe-plugin.mjs:314-338`). A center implementation must either preserve these semantics with explicit tests or obtain a public identity-pinning seam; it cannot claim that self-dispatch preserves Host lifecycle by construction.

4. **P8 is not the only late-resolution consequence.** `normalizeDispatchResult` re-resolves a successful wrapper result at `index.ts:1865-1883`; post-execute value replacement re-resolves at `index.ts:1803-1810`. The PoC's `{ value: returned }` intentionally triggers this path (`u4h0-probe-plugin.mjs:326-329`). Equal A/B schemas make the result cell pass, but do not prove output-schema identity, post-execute replacement, or concurrent swap behavior. Condition 4 is necessary but insufficient; guarded calls must test/require stable schema and post-execute behavior.

5. **Scheduler classification remains unpinned.** `executionMode()` resolves a definition before dispatch and may classify it parallel/exclusive (`index.ts:1297-1311`). H0 only tests around-dispatch identity. A same-name replacement between scheduling classification and guard/dispatch can change concurrency properties without being covered by the PoC. This is a missing H0 residual path and requires a negative test or an explicit conservative exclusive policy for governed names.

6. **Finalizer/projector capture is also pre-guard.** `createExecution()` captures `finalizeContent` and `projectContent` from the visible definition before policy/dispatch (`index.ts:1407-1439`). A guard that verifies one identity but self-dispatches another lifecycle may produce a result finalized by a stale or swapped definition. No cell covers this.

7. **Nested/transport dispatch is not demonstrated.** The Host distinguishes model-direct and nested transport calls using `exec.parent` (`index.ts:1247-1251`, `1351-1353`, `1578`). The PoC uses ordinary model-facing calls and never proves a governed nested call reaches the same guard without bypassing PTC/transport semantics. Add a nested case or mark PTC/transport as unverified.

8. **The guard depends on composition trust, not only public mechanics.** `prepend` is order-sensitive (`events.ts:254-259`); a later prepended `tools/execute` listener can run before and suppress the guard, and a later prepended `tools/change` listener can suppress the watcher through a throwing listener. The README condition says the center can audit listener order, but no public listener-enumeration API is shown. This is enforceable only by a closed, center-owned composition and explicit prohibition of later third-party prepends—not by the guard plugin itself.

9. **Empty approval state is fail-closed but not an ownership proof.** `approved === undefined` causes a veto (`u4h0-probe-plugin.mjs:303-313`), which is good, but the PoC does not test center registration/disposal races, partial table population, or a stale table entry after replacement. Condition 1 needs generation-bound registration and atomic center-owned table updates, not merely a private Map.

10. **The sensitivity oracle is real and non-vacuous.** The plant disables the guard and proves B executes with marker and process effects (`README.md:13-17`, `README.md:85-105`; primary `summary.json:68-78`). The 17 cells are not all vacuous: stable A controls, veto cells, mid-body aborts, restore controls, and the B-only plant are independently observable. Syntax checks also pass for both PoC modules.

11. **One oracle helper is vacuous, although global checks repair much of it.** `legsOkFor()` returns `legRows.length >= 0 && ...`, so an absent leg set passes (`u4h0-run.mjs:220-221`). Positive cells separately require A body-start/body-end, and the plant requires B process evidence, so the primary verdict is not wholly vacuous; nevertheless the helper must require the expected read and process rows explicitly.

12. **The evidence does not prove post-execute hooks and result semantics.** The ledger proves Body markers/effects, but no assertion covers `tools/post-execute` accept/block/value replacement, content finalization, `tools/result`, or cancellation result classification. These are Host behaviors the question explicitly asks about and must be added to H0 or called out as unverified.

13. **The 22 UNKNOWN obligations are not all credible routes.** `feasibility.json:199-306` records client-plugin dynamic tools, domain family, subagent/workflow/goal/interaction/deliverable tools, plugin_manager, inspect/MCP-resource tools as UNKNOWN, often with “route presumed” or “admission route undefined.” A presumed ordinary-family route is not a credible route under G1-F, especially for `plugin_manager` (build scripts/profile-global effects) and dynamic client/MCP sources.

14. **H0 legitimately generalizes only the shared name-dispatch identity mechanism.** It does not establish Family effect enforcement, dynamic-source admission, Bridge lifecycle, or team control semantics. The 12 `blocked_by_H0` labels in `mechanism-groups.json` are therefore a dependency relation, not evidence that H0 closes all group obligations.

15. **No CORE_SEAM_BLOCKER is proven by this evidence.** The Host public waterfall can veto built-in dispatch, and the sensitivity plant demonstrates the late-resolve hazard. The present issue is an incomplete/semantically lossy adapter and missing PoCs, not proof that no safe public route exists.

## Minimal required additions

1. Add an H0 guard-equivalence suite covering: pre-aborted caller signal; cancellation during body with expected `bodyInvoked`/settlement; signal fuse and restoration; post-execute value replacement/block; finalizer/projector capture; `tools/result`; scheduler `executionMode` race; and one nested/transport dispatch. If the public seam cannot preserve these, record a formal `CORE_SEAM_BLOCKER` for the affected guarantee rather than treating self-dispatch as equivalent.
2. Fix the oracle helper to require expected leg rows and assert exact result/settlement classes.
3. Before G1-F, run the minimum group feasibility set: **PoC-1 FS-write/ARC-A**, **PoC-2 read/search/process shared lifecycle**, **PoC-3 one named Bridge (Jobs or PTC)**, **PoC-4b MCP dynamic binding/no-auto-authorize** (PoC-4a positive web remains ENV-BLOCKED), **PoC-5 client-plugin dynamic negative**, and **PoC-6 agent-control/team-native plus plugin_manager zero-effect denial**. These can share up to four Host starts and remain within the stated 11-experiment/4-start residual budget.
4. Convert the remaining UNKNOWN entries into named blockers or credible per-group routes with owner, acceptance test, and next gate; do not carry “route presumed” as G1-F satisfaction. Keep ENV-BLOCKED pwsh/web positive legs explicitly marked and do not call them PASS.
5. Turn conditions 1–3 into center-enforceable composition rules: closed composition membership, no later prepended listeners for governed events, center-owned registration/table generation binding, and generation/schema parity. State that registration-time mutation is observable post-commit, not atomically vetoed.
