# C2 — D2/D4 existing seam characterization

- task_id: C2
- model_route: qiyuan-self/qwen3.8-27b
- base_sha: 6b81a4743de6ea08ed476287fc414622340633bd
- scope: read-only seam characterization; no product code modified

## D2: Leader-facing minimal result

**判定：`d2_existing_result_seam: no` for the requested success/failure body closure.**

The Team-owned runtime path has a real completion seam, but it is completion-only:

1. `packages/runtime/action-router/work-execution.ts:419-444` calls `deps.workDelivery.deliver(...)`, awaits it, and then settles the member lifecycle. The returned value is discarded.
2. `packages/runtime/admission/types.ts:280-298` defines `WorkDeliveryPort.deliver(...): Promise<void>`. Its documented output is only successful observation of turn completion; no assistant body, status, truncation, cancellation, or failure-result value exists.
3. `packages/runtime/src/plugin/live/agent-bindings.mjs:1089-1144` submits the model-visible request, waits for `whenIdle()`, materializes the session, and returns no result. The code explicitly treats contained turn failure as non-rejection once the turn is over; therefore reaching the end cannot be interpreted as business success.
4. `packages/runtime/action-router/effects.ts:434-458` maps `WorkChainResult` only to control-plane fields (`sequence`, `settled`, `settledSequence`, replay flag). `RuntimeActionEffect` in `packages/runtime/admission/types.ts:122-186` has no member result body/status variant.
5. The existing top-level `TeamRuntimeActionOutcome` already carries an effect and requestToken (`types.ts:212-228`), so the outer result envelope is reusable, but the member result producer and effect payload are absent.

Therefore a minimal result implementation would require a **Team-owned result contract change** (at minimum a non-void `WorkDeliveryPort` result plus a new/extended `RuntimeActionEffect` payload and glue extraction/normalization). It does not appear to require a new remote channel or storage schema: the existing action outcome/remote response envelope can carry an additive structured value. However, this C2 task must not implement that protocol. Full result semantics remain deferred, including explicit failed/cancelled/timed-out/unavailable states, requestToken correlation, and duplicate/replay non-duplication. `settled: true` is not business success.

- d2_minimal_files (if later approved):
  - `packages/runtime/admission/types.ts` (Team-owned port/effect shape; contract owner review required)
  - `packages/runtime/action-router/work-execution.ts`
  - `packages/runtime/action-router/effects.ts`
  - `packages/runtime/src/plugin/live/agent-bindings.mjs`
  - focused Team-owned tests
- d2_contract_change_required: yes (Team-owned runtime contract; no new remote/storage schema identified)
- d2 recommendation: `DEFERRED` pending explicit result-protocol design/owner approval; do not start T3 from this evidence alone.

## D4-A: projection invalidation

**判定：`d4_existing_invalidation_seam: no` for all Team mutation sources.**

The existing client seam is a safe pull mechanism, not a mutation notification mechanism:

1. `packages/client/src/state/team-projection-store.ts:115-133` exposes `pull`, `markConnectionLost`, and `markConnectionRestored`; no mutation invalidation method/event is present.
2. `packages/client/src/plugin/team-mount-core.ts:518-520` exposes `pullProjection(teamSessionId)` and `:608-619` subscribes only to connection generation changes. Restoration triggers a pull; ordinary successful host/tool mutations do not emit a generation callback to this client mount.
3. The same mount wires UI command callbacks (`team-mount-core.ts:557-580`) to `memberCommands`/`governance`, but those are only command faces. The D4 diagnostic's observed UI callback is local to React command completion; Agent/tool/host-side mutations bypass it.
4. `packages/client/src/transport/team-remote-client.ts:78-106,175-245` is unary request/response over `/team-remote`; it has no push/open stream and no mutation-completed event. `packages/client/src/transport/host-seams.ts:28-34,53-78` confirms the public connection face is unary and explicitly documents invalidation+pull rather than a stream.
5. The generation-safe store can reject stale/duplicate responses (`team-projection-store.ts:259-329`), but that is ordering protection only; it cannot discover that a host mutation advanced the authoritative generation.

Thus the existing invalidation callback is reusable **only for connection restoration**, not for D4-A's required mutation-success invalidation. The UI's existing `pullProjection()` callback can be reused by a future T4 adapter for mutations that already pass through that callback, but it does not cover Agent/tool/remote mutation sources.

- d4_minimal_files (only if a missing callback is later identified in an allowed UI path):
  - `packages/client/src/plugin/team-mount-core.ts`
  - the specific existing Team UI command callback
  - focused client tests
- d4_existing_callback_reusable: connection-generation restoration callback only; insufficient for mutation liveness
- cross_layer_change_required: yes for complete D4-A coverage (a shared mutation invalidation signal/response hook must connect host/remote success to client pull)
- d4 recommendation: `DEFERRED` — do not add host push, new remote method, connection event, timer polling, or bypass generation guards in this task.

## C2Result

- d2_existing_result_seam: no (completion seam exists; result-body seam does not)
- d2_minimal_files: runtime admission/effects/work-execution/live glue + focused tests; remote/storage schema not currently required, but Team-owned contract change is required
- d2_contract_change_required: yes
- d4_existing_invalidation_seam: no (restoration callback exists, mutation callback does not)
- d4_minimal_files: mount/UI callback only for already-covered paths; complete Agent/tool coverage needs a cross-layer invalidation hook
- cross_layer_change_required: yes for D4-A complete coverage
- recommendation: `D2 DEFERRED (CONTRACT_CHANGE_REQUEST); D4-A DEFERRED (existing invalidation seam insufficient)`

## TaskResult

- task_id: C2
- model_route: qiyuan-self/qwen3.8-27b
- elapsed_minutes: ~35
- base_sha: 6b81a4743de6ea08ed476287fc414622340633bd
- changed_files: `dev/agent-workflow/evidence/team-d1-d6-repair/C2/C2Result.md` only
- tests_run: none (read-only characterization; no runtime needed)
- evidence_paths: `dev/agent-workflow/evidence/team-d1-d6-repair/C2/C2Result.md`
- self_verdict: DEFERRED
- blocker_type: CONTRACT_CHANGE_REQUEST
- remaining_risks: result extraction/status normalization and mutation invalidation ownership must be designed and independently tested; no claim is made for D2/D4 implementation or user-visible closure
- commit_sha: pending
