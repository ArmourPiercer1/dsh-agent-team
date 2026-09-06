# T4 D4-A — Projection invalidation

- task_id: T4 D4-A
- model_route: qiyuan-self/qwen3.8-27b
- base_sha: 6b81a4743de6ea08ed476287fc414622340633bd
- branch: task/team-d4-projection-invalidation
- scope: existing-seam-only projection liveness repair

## Decision

**DEFERRED — `D4-A DEFERRED: existing invalidation seam insufficient`.**

C2 established `d4_existing_invalidation_seam: no`. The client has a generation-safe pull path (`TeamProjectionStore.pull()` and `team-mount-core.pullProjection()`), but no mutation-success invalidation callback/event covering Agent/tool/host/remote mutation sources. The only reusable generation callback is connection restoration; it cannot discover an authoritative generation advance after a successful mutation.

The existing UI command callbacks do call `pullProjection()` after their own successful commands, but Agent/tool and other host-side mutation paths bypass those React callbacks. Completing D4-A therefore requires a cross-layer mutation signal or response hook. Adding that would be protocol/architecture expansion, explicitly outside this task.

## Constraints honored

- No host push added.
- No remote method added.
- No connection event added.
- No timer polling added.
- No generation guard bypass or projection-store contract change.
- No product code or focused tests changed because the allowed seam is absent.

## Evidence

- `dev/agent-workflow/evidence/team-d1-d6-repair/C2/C2Result.md`, lines 31–51: existing invalidation seam is insufficient and recommendation is DEFERRED.
- `packages/client/src/state/team-projection-store.ts`: pull/generation safety only.
- `packages/client/src/plugin/team-mount-core.ts`: restoration subscription and explicit `pullProjection()` only.
- `packages/client/src/transport/team-remote-client.ts`: unary request/response; no mutation event or push channel.
- `docs/local-issues/team-projection-not-live.md`: Agent/tool mutations bypass UI callbacks and remain stale until F5.

## Tests

- Not run; this is a read-only/deferred outcome and no implementation was authorized by the seam findings.

## TaskResult

- task_id: T4 D4-A
- model_route: qiyuan-self/qwen3.8-27b
- elapsed_minutes: ~15
- base_sha: 6b81a4743de6ea08ed476287fc414622340633bd
- changed_files: `dev/agent-workflow/evidence/team-d1-d6-repair/T4-d4/T4Result.md` only
- tests_run: none (DEFERRED; no product code changed)
- evidence_paths: `dev/agent-workflow/evidence/team-d1-d6-repair/T4-d4/T4Result.md`, `dev/agent-workflow/evidence/team-d1-d6-repair/C2/C2Result.md`
- self_verdict: DEFERRED
- blocker_type: CONTRACT_CHANGE_REQUEST
- remaining_risks: Agent/tool/host/remote mutation success remains unable to invalidate an open client projection; future work needs an explicitly owned cross-layer invalidation design and focused concurrency tests.
- commit_sha: pending
