# U7 agent-state production store — evidence

Branch `task/u7-agentstate-store-20261027` (worktree `.worktrees/u7-astore`,
off origin/master `50da6c464`). Solo writer. CORE PATCH BUDGET = 0: zero lines
in `team-tool-plane.mjs`, `family-assembly.mjs`, `agent-bindings.mjs` and the
33 ARC-A protected paths. The store is supplied through the family
descriptor's existing `build` capability.

## Why

The U7 stop condition in `docs/plans/memo/unified-baseline-alpha5-20261025/execution-plan.md` §U7
is "功能必交项仅『拒绝所有调用』": a required tool that can only refuse.
`packages/tools/families/agent-state.mjs` refused the whole mount
(`PLANE_AGENT_STATE_STORE_MISSING`) unless a store was injected, and
production injects none. As a result every L4-positive arm of the five
agent-state tools was DISCLOSED.

## Design (`packages/tools/agent-state-family/src/fs-state-store.mjs`)

- **Home**: read at `build` from `$DSH_HOME` only, because the capability
  object carries no home path and `cap.hostService('dshHomePath')` binds only
  at `mount` (after `build`); precedent `packages/tools/harness/plugin.mjs:166`.
  The home is refused (keeping `PLANE_AGENT_STATE_STORE_MISSING`) when it is
  absent, blank, relative, missing, or when its realpath equals or sits under
  the operator's live `~/.dsh`. There is never a default location.
  **Named follow-up**: a `homePath` family capability (center interface,
  `family-assembly.mjs:60-74` + `team-tool-plane.mjs:1610-1632`).
- **Root**: `<DSH_HOME>/team-state/agent-state/<realmId>/`. The realm is one
  path-safe segment, and every store directory is realpath-contained under
  the home before any write.
- **Scoping**: the record file is named by the sha256 of the exact
  `agent:<id>` bytes. The key is stored verbatim and re-compared on every
  read. There is no trim or fold, and a mismatch is CORRUPT.
- **Atomicity**: a write goes to a temp file in the same directory, is
  `fsync`ed, `rename`d, and then the directory is `fsync`ed.
- **Replay/CAS**: `applyId` is consumed through an exclusive-create (`wx`)
  marker, which is durable across restart. A refusal rolls the marker back.
  CAS and already-exists answers mirror the recording fake verbatim.
- **Ledgers**: `ledger/writes.jsonl` gets a line only when a write commits.
  `ledger/attempts.jsonl` gets one line per apply, with its outcome.
- **Bounds**: 256 KiB per scope, enforced on both read and write, with a
  typed refusal on overflow. Corrupt, unknown-schema or foreign-key records
  fail closed with a typed refusal.
- **Read law**: `O_NOFOLLOW` open, then `fstat` on the descriptor; anything
  other than a regular file with `nlink === 1` within the bound is refused,
  and the bytes are read from the same descriptor. `TODO(#409)`: swap to
  `hardlinkAliasVerdict` once #409 is on master (it is not, at this branch
  point). The behaviour is pinned by C1 K1.
- **Arm** (`armFor`): resolved lazily through `cap.hostService` (`agents`,
  `sessionProjections`) and mirrors `tool-goal/src/authority.ts:81-117`.
  Anything unresolvable falls back to `{kind:'model'}` (fail closed).

## C1

- `packages/runtime/test/u7-agentstate-fs-store-c1.test.ts`: 25 cases over
  the real plane mount with no injected port. Groups: H (home guards,
  including a `.dsh` home → refused), P (positives re-read after a simulated
  restart), R (every refusal has a byte-measured zero write plus an attempts
  line), S (byte-exact scoping), B (bounds/corrupt), K (nlink>1 / symlink),
  C (crash atomicity + in-test control), A (arm provider), O (closed `{text}`
  envelope).
- The existing `u7-f-agentb-agent-state-c1.test.ts` (54 cases) still passes.
  M2 now clears `DSH_HOME` explicitly.
- **Mutation control**: removing the atomic rename in the source (writing the
  target in place) turns C1 RED: `mutation-control-atomic-rename.txt`.
- **O1 RED on the old envelope**: `O1-RED-old-envelope.txt`.

## C2 (real Host, pin 639ed01539) — budget 3 boots, 3 spent

Budget ledger: `c2/host-start-budget.jsonl` (3 lines). :3080 returned 401
before and after every boot (read-only probe, no other contact).

| boot | record | overall | notes |
| --- | --- | --- | --- |
| 1 | `c2/run-ast1.json` | REFUSED (7 PASS / 1 REFUSED) | create_goal / todo_write / cross-scope PASS. **Found**: every family refusal reached the model as host `invalid output` (an extra `refusal` field against the closed `{text}` face); fixed in `0cff7979e`. get_goal REFUSED. |
| 2 | `c2/run-ast2.json` | REFUSED (8 PASS / 2 REFUSED) | update_goal(edit) PASS. The exit_plan_mode plan-mode plant failed (runner imported the lane barrel, which pulls a dist-only `.js` edge) → exit_plan_mode REFUSED `PLAN_MODE_NOT_ACTIVE`; fixed in `61a49e362`. |
| 3 | `c2/run-ast3.json` | **REFUSED (9 PASS / 1 REFUSED)** | grades the ledger. |

Boot 3 verdicts (verbatim from `c2/run-ast3.json`):

- `ast:mounted` PASS: the five rows are on the placement feed; host log shows `agent-state store=fs`.
- `ast:store-under-world-home` PASS: the World home realpath is under `tests/homes/`; store base `team-state/agent-state/<realm>`.
- `ast:create-goal-positive` PASS: a PA ask was settled once through `team.resolveControl`. The disk record (nlink 1) and the `writes.jsonl` entry are present, and a fresh store re-read equals the disk record.
- `ast:update-goal-positive` PASS: the direct-human edit moved the revision from 1 to 2 on disk; two `goal/apply` writes in the leader scope.
- `ast:exit-plan-mode-positive` PASS: plan mode off on disk, plan recorded, one `plan-mode/apply` write. **Plant disclosed**: plan mode was set active on disk before boot by the runner, because the family has no plan-mode entry tool.
- `ast:todo-write-positive` PASS: the whole list is on disk in the member scope, one `todos/apply` write.
- `ast:cross-scope-zero-effect` PASS: the member named the leader's `goal_id` and revision and got `refused: GOAL_NOT_FOUND — no current goal`. The leader record is unchanged and there are 0 member goal writes.
- `ast:get-goal-readback` REFUSED: `refused: APPROVAL_DENIED — durable Control request uncreated answered deny`.
- `ast:leak-check` PASS.

## What remains DISCLOSED

get_goal live L4 positive: the production PA approval bridge refuses an ask whose effect set carries no tool-invoke effect (packages/runtime/operation-permission/pa-control-bridge.ts:358-361, a protected center path), and get_goal deliberately requests only the metadata meta arm (executors.mjs get_goal effectsFor, the reviewed #407 read/mutation split), so on the real host the read is denied before any Control row exists (C2 run-ast3 ast:get-goal-readback REFUSED, verbatim "refused: APPROVAL_DENIED — durable Control request uncreated answered deny").

Named center-interface need: the bridge needs an approval carrier for a
read-only (no tool-invoke) ask. The alternative is a reviewed family law
change that adds a `tool-invoke(get_goal)` arm. Neither is made here. The
get_goal read path is PROVEN at C1 over the real store (P1 and others).

## Files

- `packages/tools/agent-state-family/src/fs-state-store.mjs` (new),
  `index.mjs` (exports), `executors.mjs` (closed `{text}` envelope)
- `packages/tools/families/agent-state.mjs` (build supplies the production
  store) + `manifest.json` digest
- `scripts/dist-placements/110-agent-state.json` + dist mirrors
- `packages/runtime/test/u7-agentstate-fs-store-c1.test.ts` (new),
  `u7-f-agentb-agent-state-c1.test.ts` (M2 env)
- `packages/testkit/test/p4t6-bookings/u7astore.json` (measured 1381→1383:
  `p4t6-RED-unbooked.txt`)
- `tests/world-factory/{lib/u7astore-assembly.mjs,suites/120-u7-astore.mjs,world-kinds/090-u7-astore.mjs}`
  + `registries.test.mjs`
- `dev/agent-workflow/ledgers/u7-tool-acceptance.json`

Test runtime: `tests/deepseek-harness-test-use` in this worktree was cloned
`--no-hardlinks` from the repo-root pristine checkout. The shared baseline
`/srv/workspace/dsh-stable-3-0.2.0-rc.2/deepseek-harness` is no longer a git
repo in this environment. The checkout is at `639ed015…` with empty
porcelain before and after.
