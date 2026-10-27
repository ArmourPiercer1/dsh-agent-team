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
- **Atomicity**: a write goes to an `O_EXCL|O_NOFOLLOW` temp file in the
  same (pinned) directory, is `fsync`ed, `rename`d, and then the directory
  descriptor is `fsync`ed.
- **Containment on every operation (review round 1, B-1)**: no cached
  readiness. Every read and write re-walks home → `team-state` →
  `agent-state` → realm → subdir, opening each component
  `O_DIRECTORY|O_NOFOLLOW` relative to the previous descriptor
  (`/proc/self/fd/<n>/<seg>`, openat semantics on Linux). It then checks that
  the pinned descriptor's realpath equals the expected location. A component
  swapped for a symlink fails with `AGENT_STATE_STORE_PATH_REFUSED`, and bytes
  only ever land in the directory whose identity was just proven. Without
  `/proc/self/fd` the walk falls back to per-component `lstat` + realpath on
  every operation (residual check-to-use window).
- **Serialisation (review round 1, B-2)**: each apply holds an exclusive
  per-scope lock (`locks/<scope-digest>.lock`, `O_EXCL`, shared across
  instances and processes) across read → CAS → commit. Creating a new scope
  also holds the realm lock while counting (lock order: scope, then realm).
  - Stale owner: if the holder pid is dead on this host, or the lock is older
    than 30 s, the lock is broken by rename-aside. If the breaker grabbed a
    fresh lock, it restores it.
  - Timeout: 10 s, then a typed `AGENT_STATE_STORE_LOCK_TIMEOUT` with zero
    write.
- **Replay / applyId order**: the committed record carries the applyId (the
  last 256 per scope) in the same atomic rename, and the global `applied/`
  marker is written only after the commit. A replay is refused if either
  witness has the id.
  - Crash before the rename: no witness exists, so the grant is not consumed
    (C1 M1).
  - Crash after the rename but before the marker: the replay is still refused
    (C1 M2).
  - CAS and already-exists answers mirror the recording fake verbatim.
- **Scope cap**: 1024 scope records per realm. A new scope past the cap fails
  with `AGENT_STATE_STORE_SCOPE_LIMIT` and zero write. Concurrent creators
  cannot overshoot (C1 N2).
- **Ledgers**: `ledger/writes.jsonl` gets a line only when a write commits.
  `ledger/attempts.jsonl` gets one line per apply, with its outcome.
- **Bounds**: 256 KiB per scope, enforced on both read and write, with a
  typed refusal on overflow. Corrupt, unknown-schema or foreign-key records
  fail closed with a typed refusal.
- **Read law**: `O_NOFOLLOW` open, then `fstat` on the descriptor; anything
  other than a regular file with `nlink === 1` within the bound is refused,
  and the bytes are read from the same descriptor. #409's
  `hardlinkAliasVerdict` (on master since a264d2df0) is **not imported**:
  - It is not on controlled-fs's public face. `index.ts:40-48` exports only
    `NO_RECHECK`, `isBeneath` and `verifyOpenedHandle`.
  - It lives in a compiled `.ts` lane that this `node:*`-only lane has no
    booked edge to (eb3-family-boundaries LANE_EDGES).

  The same rule is applied in-lane with the shared law's detail sentence,
  pinned by C1 K1.
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

## C2 (real Host, pin 639ed01539) — budget 3 boots, 3 spent + boots 4 and 5 granted

Budget ledger: `c2/host-start-budget.jsonl` (5 lines). **Boot 4 — over budget, granted by main agent for get_goal L4 after the bridge-shape fix** (`c2/boot4-grant.txt`; no 5th boot authorised). :3080 returned 401
before and after every boot (read-only probe, no other contact).

| boot | record | overall | notes |
| --- | --- | --- | --- |
| 1 | `c2/run-ast1.json` | REFUSED (7 PASS / 1 REFUSED) | create_goal / todo_write / cross-scope PASS. **Found**: every family refusal reached the model as host `invalid output` (an extra `refusal` field against the closed `{text}` face); fixed in `0cff7979e`. get_goal REFUSED. |
| 2 | `c2/run-ast2.json` | REFUSED (8 PASS / 2 REFUSED) | update_goal(edit) PASS. The exit_plan_mode plan-mode plant failed (runner imported the lane barrel, which pulls a dist-only `.js` edge) → exit_plan_mode REFUSED `PLAN_MODE_NOT_ACTIVE`; fixed in `61a49e362`. |
| 3 | `c2/run-ast3.json` | REFUSED (9 PASS / 1 REFUSED) | get_goal still APPROVAL_DENIED (bridge shape, see below). |
| 4 | `c2/run-ast4.json` | PASS (10 / 10) | after `eee67dafd` (get_goal tool-invoke arm). Bound the PRE-round-1 store code; superseded by boot 5. `RUN-SUMMARY run=u5-u7-astore-ast4-2026-10-27T16-22-47-523Z suite=u7-astore overall=PASS cases=10 PASS:10` |
| 5 | `c2/run-ast5.json` | **PASS (10 / 10)** | round-1 store code `e319513fa`. **Grades the ledger.** Over budget, granted (`c2/boot5-grant.txt`). `RUN-SUMMARY run=u5-u7-astore-ast5-2026-10-27T17-36-16-958Z suite=u7-astore overall=PASS cases=10 PASS:10` |

Boot 3 verdicts (verbatim from `c2/run-ast3.json`; boot 4 is identical except `ast:get-goal-readback` = PASS, the model saw `{"goal":{"goal_id":…,"objective":"U7AS_GOAL_CLAIM_…","revision":1,…}}` through a settled Control ask):

- `ast:mounted` PASS: the five rows are on the placement feed; host log shows `agent-state store=fs`.
- `ast:store-under-world-home` PASS: the World home realpath is under `tests/homes/`; store base `team-state/agent-state/<realm>`.
- `ast:create-goal-positive` PASS: a PA ask was settled once through `team.resolveControl`. The disk record (nlink 1) and the `writes.jsonl` entry are present, and a fresh store re-read equals the disk record.
- `ast:update-goal-positive` PASS: the direct-human edit moved the revision from 1 to 2 on disk; two `goal/apply` writes in the leader scope.
- `ast:exit-plan-mode-positive` PASS: plan mode off on disk, plan recorded, one `plan-mode/apply` write. **Plant disclosed**: plan mode was set active on disk before boot by the runner, because the family has no plan-mode entry tool.
- `ast:todo-write-positive` PASS: the whole list is on disk in the member scope, one `todos/apply` write.
- `ast:cross-scope-zero-effect` PASS: the member named the leader's `goal_id` and revision and got `refused: GOAL_NOT_FOUND — no current goal`. The leader record is unchanged and there are 0 member goal writes.
- `ast:get-goal-readback` REFUSED: `refused: APPROVAL_DENIED — durable Control request uncreated answered deny`.
- `ast:leak-check` PASS.

## Review round 1 (reviewer 75bae2c8): B-1 / B-2 fixes, `e319513fa`

- **RED-first**: the new tests run against the pre-fix store
  (`git show 53e292b56:…/fs-state-store.mjs`) give 12 RED
  (`round1/RED-prefix-store.txt`): the X swap matrix, L1/L2, M2 and N1/N2.
- **Mutation controls** (each one source edit, restored afterwards):
  - Cached readiness re-introduced: all 6 X swap cases RED
    (`round1/MC1-cache-reintroduced.txt`).
  - Scope lock dropped: L1 (4 instances × 25 rounds) and L2 RED
    (`round1/MC2-lock-dropped.txt`).
  - Marker before commit (the old order): M2 and N1 RED
    (`round1/MC3-marker-before-commit.txt`).
- **C1 suite**: `u7-agentstate-fs-store-c1.test.ts` now has 40 cases, all
  passing; the existing 54-case suite also passes.
- **p4t6**: re-measured after merging origin/master a264d2df0: 1382 → 1384,
  still exactly the two paths (`round1/p4t6-RED-unbooked-postmerge.txt`).
- **C2 boot 5** (over budget, granted by the main agent for round 1): run at
  `e319513fa`, `RUN-SUMMARY run=u5-u7-astore-ast5-2026-10-27T17-36-16-958Z
  suite=u7-astore overall=PASS cases=10 PASS:10`. The ledger now cites
  `c2/run-ast5.json`; `run-ast4.json` bound the pre-fix store and backs
  nothing. Budget ledger: 5 lines.

## get_goal — the C1/live gap and its fix

Boots 1 to 3 refused get_goal with `refused: APPROVAL_DENIED — durable Control
request uncreated answered deny`. The production PA approval bridge
(`packages/runtime/operation-permission/pa-control-bridge.ts:358-361`,
protected) denies an ask whose effect set names no `tool-invoke` tool, and
get_goal requested only the `meta` arm. **Root cause: C1's stand-in control
leg approved any ask and never enforced the production bridge's tool-invoke
requirement.**

Fix (`eee67dafd`, main-agent ruling): get_goal now carries its own
`tool-invoke` arm, which is the shape every governed read row already has
(fs read, read_image, inspect list). `tool-invoke` is not a mutation kind, so
the get_goal set stays mutation-free (E1 pins `['meta','tool-invoke']` and no
write/list/connect/read). The other four rows already carried the arm. A new
C1 leg G1 drives all five rows through a faithful model of the bridge shape.
G2 and `mutation-control-get-goal-tool-invoke.txt` show that dropping the arm
in the source turns G1/E1/E2 RED.

## What remains DISCLOSED / NOT_VERIFIED

- exit_plan_mode L4 uses a planted precondition: plan mode is set active on
  disk before boot, because no family tool enters plan mode.
- L3 live (typed refusal with zero effect) is graded only for update_goal
  (cross-scope). For the other four tools L3 stays NOT_VERIFIED live; their
  refusal arms with zero durable write are proven at C1 over the production
  store.
- The home comes from `$DSH_HOME` at build. This is interim until a
  `homePath` family capability exists (a named center-interface follow-up).
- #409's `hardlinkAliasVerdict` is applied in-lane, not imported (see
  Read law).
- Two over-budget boots (4 and 5), each granted explicitly by the main agent.

## Files

- `packages/tools/agent-state-family/src/fs-state-store.mjs` (new),
  `index.mjs` (exports), `executors.mjs` (closed `{text}` envelope; get_goal tool-invoke arm), `contribution.mjs` (get_goal arms)
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
