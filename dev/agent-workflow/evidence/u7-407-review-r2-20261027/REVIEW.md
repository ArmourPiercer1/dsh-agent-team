# PR #407 Security Review R2

Verdict: **PASS-WITH-FINDINGS**

Reviewed frozen implementation head: `96472965a68ba5ae847669526b65da762e1d0cea` (`task/u7-f-agentcontrol-b-20261026`). Review branch: `task/u7-407-review-r2-20261027`.

## Reproduction summary

- Focused C1: `pnpm exec vitest run packages/runtime/test/u7-f-agentb-agent-state-c1.test.ts --reporter=dot` → **1 file, 52 tests passed**.
- Store audit reproduction against `packages/tools/agent-state-family/src/state-store.mjs`: a committed goal apply increases `log.writes` once; replay (`STATE_APPLY_REPLAY`), stale CAS (`GOAL_STALE_REVISION`), already-exists (`GOAL_ALREADY_EXISTS`), and inactive plan exit (`PLAN_MODE_NOT_ACTIVE`) each leave `log.writes` unchanged and append a typed `log.attempts` refusal. The production path is the injected state-store port; no separate production file-backed adapter exists in this PR, and the live record honestly reports `PLANE_AGENT_STATE_STORE_MISSING`.
- The old ordering control is committed as `R1-F1-store-writes-RED.txt`; source ordering now records attempts before checks and writes only after commit.
- Scope reproduction: `scopeOf` is exactly `agent:${id}` with no trim/fold. C1 S2 distinguishes `a`, `a `, and ` a`; source comments cite host minting at `commands.ts:109`/`:266` and exact `Map.get` at `:450`. A lane grep found no normalization of the caller id, goal scope, store key, or todo identity. The planted trim control is committed in `R1-F2-scope-trim-RED.txt`. The implementation preserves raw `goal_id`; parser trimming is used only for validation/content fields, not identity.
- Per-row effects: E2 observes each PA request against `AGENT_STATE_EFFECT_ARMS`; the union is derived from that table. Both planted controls are present and RED (`R1-F3-mc-executor-RED.txt`, `R1-F3-mc-table-RED.txt`). `contribution-schema.ts:154` fixes `EFFECTS_KEYS` to `declared,kinds,targets`, so a `byRow` contribution field is rejected by the closed schema rather than representable.
- C2 record `u5-u7-fagentb-x-2026-10-27T11-11-55-455Z.u7fagentb-run-record.json` is `u5-run-record/1`, has `overall=PASS`, `finishedAt`, `bindings.authority.snapshot_version=as20261026r1`, `teamSha=d435db6559dd372789fe2803bbc2de1668ea1d19`, and host pin `639ed015397290b3745d163aafe02ffee4aa3f84`. The five older evidence JSON files remain unedited: their `git log --follow` ends at the original pre-review commit `5076a150f`; the new run record is the only later evidence JSON commit. `node scripts/eb3-run-manifest.mjs --new-since origin/master` passes (`records=64`, `findings=0`; unrelated older incomplete records disclosed). `node scripts/eb3-evidence-guard.mjs --new-since origin/master` passes (`findings=0`).
- Zero diff to `team-tool-plane.mjs`, `family-assembly.mjs`, `approval-entry-binder.mjs`, `agent-bindings.mjs`, and protected center paths was verified from the PR diff. No raw census capture is tracked.
- Positive live arms are correctly **DISCLOSED-NO-SEAM**: the production binder does not wire an agent-state store, and the live enabled path fails closed with `PLANE_AGENT_STATE_STORE_MISSING`; no positive delivery claim is made.

## Round-1 findings

| Finding | Result | Evidence |
|---|---|---|
| F-1 refused calls logged as writes | **FIXED** | `state-store.mjs:119-148,155-187`; replay/CAS/already-exists/inactive-plan reproductions above; attempts carry typed codes and committed writes remain unchanged. The production-facing path is the same injected port contract; no alternate production store can be claimed by this PR. |
| F-2 `scopeOf` trim aliasing | **FIXED** | `executors.mjs:105-115`; byte-exact identity and C1 S2 plus planted RED control. Five requested identities are distinct in the implementation; no id normalization path was found. |
| F-3 per-row declared/requested effect drift | **FIXED** | `contribution.mjs:31-37,107-121`; C1 E2 and both RED controls. Closed center schema confirmed at `contribution-schema.ts:154`. |
| F-4 C2 run record fields / older digest integrity | **FIXED** | New `u5-run-record/1` record contains required completion, authority, team, and host bindings; five older `*.u7fagentb-evidence.json` files were not edited and are labelled non-record digests in README. EB3 manifest and evidence guard pass. |

## New finding

### [Medium] `update_goal` permits `complete` from a blocked goal, contrary to the requested transition law

File: `packages/tools/agent-state-family/src/agent-state-law.mjs:285-289`.

The implementation's `goalStateLeg` explicitly allows `complete` from `['active', 'paused', 'blocked']`. The C1 transition table does not include a `complete from blocked` negative leg, and the positive table only exercises completion from active. The review request explicitly names `complete a blocked goal` as an illegal transition requiring a typed refusal and zero write. The host citation does not resolve this review requirement: the pinned host implementation currently allows completion from blocked (`tests/deepseek-harness-test-use/packages/goal/goal/src/index.ts:390-399`), but the PR's stated governed-agent transition law is stricter and must be tested/implemented as specified if that is the governing contract. This is a user-observable state transition and should block merge until the contract is reconciled: either change the lane to refuse it with a typed code and add a zero-write test, or provide an explicit authoritative decision that the host law (blocked→complete allowed) supersedes the review requirement and add the corresponding positive test.

Related gap: no explicit C1 leg currently exercises `resume` from `complete`; add it and assert a typed `GOAL_INVALID_TRANSITION` refusal with zero durable writes. The existing `complete from complete` leg tests the reverse direction only.

## Hardlink dependency disclosure

The agent-state family does not read files and does not call `verifyOpenedHandle`; its current injected store is in-memory/port-based, and the production store seam is absent. Therefore the post-merge hardlink alias gap in the shared read-side `verifyOpenedHandle` is not a direct PR #407 vulnerability. It remains a dependency for any future file-backed agent-state store: `verifyOpenedHandle` currently checks path containment and `(dev, ino)` drift but does not reject `nlink > 1`, so a file-backed implementation must either add the hardlink refusal in the shared seam or establish an equivalent store-specific defense before claiming secure file-backed reads.

## COULD-NOT-VERIFY

- GitHub hosted status checks: `gh pr view 407` could not be used in this environment because GitHub GraphQL returned the deprecated classic Projects error (exit 1); no hosted SUCCESS list was independently available.
- A positive live agent-state read/write cannot be verified because the production binder intentionally has no agent-state store adapter; this is disclosed and fail-closed, not counted as a false positive.

## Merge recommendation

**No, not yet.** Resolve the new blocked→complete transition-law discrepancy (and add the missing completed→resume negative leg), then rerun the focused C1 and the required gates. Round-1 findings are fixed.
