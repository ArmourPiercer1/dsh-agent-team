# PD-24 (UNBOUNDED-TURN) — the ceiling bounds one call; the Member can still execute a series, and the one number that would bound it is written by the party being bounded

> **Loudest fact first: `update_goal edit max_goal_rounds=9007199254740991` is ACCEPTED on a delegated governed
> Member turn.** The Alpha.5 ceiling is `EffectiveIo(member, tool, call) ⊆ ceiling ∩ restriction` — a bound on
> **one call**. Nothing in the product bounds the **series**, and the one mechanism that would
> (`maxGoalRounds`) is a number the constrained party writes: it arrives as a `create_goal` argument and can be
> raised by `update_goal edit`. **A limit the constrained party can raise is not a limit; it is a suggestion.**
> That sentence, not the specific number, is this row's generalisable finding. The disposition is **fail-closed
> removal** of the two rows that carry the unbounded/blocking tools from the opt-in governed preset —
> `tool-goal` (the `get_goal`/`create_goal`/`update_goal` trio) and `tool-ask-user` — which is a **capability
> regression**, disclosed as such, not an enforcement.

> **Lane identity and the renumber.** The lane, branch, worktree, commit subject and draft-PR first line are
> `pd25` / `task/pd25-unbounded-turn-20261114` / `.worktrees/pd25-unbounded-turn` / `PD25-UNBOUNDED-TURN`. The
> register row is **PD-24 (UNBOUNDED-TURN)**: `origin/master` (`6cfc67b76`, #672) carried 23 rows, so the next
> contiguous id was PD-24. A sibling lane may claim PD-24 first; per the PD-21/PD-22/PD-23 precedent the row
> then **renumbers to PD-25** and keeps the `pd25` lane name (renaming a booted lane would desync its logs and
> driver digest). The register's status note carries the same rule.

> **Evidence class.** `DEV-LIVE`: four boots in two agreeing pairs (pre-fix composition and post-fix tree),
> slot-leased via `tests/world-factory/lib/dev-live-slots.mjs`, ports from the 3180 family, `DSH_HOME` under
> `tests/homes/`, pinned host tree read-only (`git status --porcelain` empty before and after every boot, logged
> in `host-tree-porcelain-*.txt`). This is the lane's own boot evidence, **not merge evidence**; `eligible =
> false`; no `V@B`, no grade.

> **Observation caps are OURS, not the product's.** This lane set its own stop conditions before booting, so one
> lane could not saturate the machine: **at most 5 goal rounds** (`A5SF_PD25_MAX_ROUNDS`, recorded as
> `hardObservationCap: 5` in `self-continuation-rounds.json` and `driver-digest-*.json`), **at most 10 minutes**
> per boot chain, **at most 30 sequential** tool calls in the burst arm, and **45 s** of silence before a
> delegation with no result is called *blocked*. Every one of them is *our* decision to stop observing. Where a
> number below is 5, 30, or 45 s, that is the lane's cap; **the product did not stop anything** unless the text
> says it did (the `cap2` arm is the one place it does: `code=round-limit`).

---

## 1. The answer, in one sentence

**No: a governed Member can execute without a total bound today** — its ceiling bounds each call, one Member turn
executes an unbounded number of tool calls (30/30 sequential `bash` calls, no refusal, no truncation), and a goal
created on that turn drives **automatic rounds inside the Member's own session**, with the round budget settable
by the Member; on the shipped opt-in `a5sf-governed-member` preset that series is now **gone by capability
removal** (`tool-goal` and `tool-ask-user` are no longer declared), not by a bound.

## 2. Method

**Composition under test.** The shipped `cordis.patch.yml` layer, row `dsh-agent-team` + the opt-in preset
`preset-a5sf-governed-member` (`memberPresetId: a5sf-governed-member`, `a5sfGovernedRealm: true`) + the
`p6t6-team-tools` control mount. The pre-fix arm reads a **byte copy** of the composition as it stood at
`origin/master` `6cfc67b76` (`archive/pre-fix/cordis.patch.yml`, sha256 `758a9b5a…`); the post-fix arm reads the
tree. The tracked file is never mutated by a measurement.

**One Team, five Members, one ceiling.** A v4 blueprint with a Leader and five members, all carrying the same
`memberIoCeilings` (workspace-only read/write lane, no network). The model is a mock decider
(`startMock({decide})`) whose reply is a function of the request; every probe is a real tool call executed by the
real Host against the real preset. The Leader drives, in order:
`cap2` → `raise` → `plan` → `loop` (four synchronous delegations in the first Leader turn), then a **second**
Leader turn delegates `ask`. The `ask` arm is split out because a blocking `ask_user_question` would otherwise
hold the create RPC open (see §7.2 — that itself is one of the findings).

| arm | Member template | probes |
| --- | --- | --- |
| `cap2` | `cap2` | `create_goal {max_goal_rounds: 2}`, then answers two rounds |
| `raise` | `raise` | `create_goal` (no cap), `update_goal edit max_goal_rounds=9007199254740991`, `update_goal pause` |
| `plan` | `plan` | `exit_plan_mode` in a non-plan session |
| `loop` | `loop` | 30 sequential confined `bash` reads + `todo_write` + `create_goal` (no cap), then one tool call per automatic round: `bash`×3, `get_goal`, `update_goal complete` |
| `ask` | `ask` | `ask_user_question` once, unattended |

**Bounding the observation.** `A5SF_PD25_MAX_ROUNDS=5`, chain timeout 10 min, burst 30, ask-block threshold 45 s
(§ preamble). The `loop` Member's round-5 `update_goal complete` is the lane ending the series **on purpose**;
`cap2`'s 2-round stop is the **product** acting (`code=round-limit`).

**Control path.** `/__p6t6/health`, `/__p6t6/state` (real `childSessionId`s), `POST /api/session/prompt`,
`/team-remote/<method>` with the cookie from `authenticate(origin, world.token)`; mock requests, durable
`session.v4.jsonl.zstd` logs and `a5sf-guard-consult` facts are read after each boot.

**Commits under test.** Team `6cfc67b76` (`origin/master`), pinned Host `639ed01539` (0.2.0-rc.2); `packages/`
dist is tracked, so no build is part of this evidence.

## 3. What each arm measured (prefix arm, both boots identical — `agreement.txt`, `differing=[]`)

| # | fact | boot 1 | boot 2 |
| --- | --- | --- | --- |
| 1 | Member tool surface | **34** names (incl. `get_goal`, `create_goal`, `update_goal`, `ask_user_question`) | 34 |
| 2 | `create_goal` on the delegated turn | **ACCEPTED** `phase=active roundsStarted=0 maxGoalRounds=256 activation=armed` | same |
| 3 | automatic goal rounds observed (our cap 5) | **5** (`1,2,3,4,5`), first→last **0.899 s** | 5, **0.842 s** |
| 4 | product's default round budget | **256** (`defaultMaxGoalRounds`) | 256 |
| 5 | `update_goal edit max_goal_rounds=9007199254740991` | **ACCEPTED**, revision 2 | ACCEPTED |
| 6 | `create_goal {max_goal_rounds: 2}` → stop | exactly **2** rounds, goal **`blocked`** `code=round-limit`, `roundsStarted=2`, msg "Goal reached its configured limit of 2 rounds." | same |
| 7 | 30 sequential `bash` calls in one turn | **30/30 executed**, **1899 ms**, zero refusals | 30/30, 1898 ms |
| 8 | `ask_user_question` (unattended) | **no result at 45 s**, delegation never returned, Member `RUNNING` | same |
| 9 | `exit_plan_mode` outside plan mode | typed `Error: exit_plan_mode is only available in plan mode` | same |
| 10 | `todo_write` | only the calling Member's durable session (0 elsewhere) | same |
| 11 | Member model requests | `{loop:43, cap2:4, raise:4, plan:2, ask:1}`; 68 mock requests | same |

### 3.1 The round curve (`self-continuation-rounds.json`, boot 1)

Each row is one model request whose last user message is the driver's `<goal_round>` prompt; the timestamps are
the mock provider's receipt time, so the deltas are the **product's own** pacing, not a test harness delay:

| round | received at | Δ previous | `maxGoalRounds` | tool call in that round |
| --- | --- | --- | --- | --- |
| 1 | `04:44:21.470Z` | — | 256 | `bash` |
| 2 | `04:44:21.722Z` | +0.252 s | 256 | `bash` |
| 3 | `04:44:21.974Z` | +0.252 s | 256 | `bash` |
| 4 | `04:44:22.201Z` | +0.227 s | 256 | `get_goal` |
| 5 | `04:44:22.369Z` | +0.168 s | 256 | `update_goal complete` ← **the lane stops it** |

Round 5's `update_goal complete` returned `phase=complete roundsStarted=5 maxGoalRounds=256`. The Member's
durable session contains **5** goal-round user messages (`loopDurableRounds=5`), so the rounds are session
state, not a mock artefact. At the lane's cap the series was still running at ~4 rounds/s with 251 rounds of
budget left; **nothing in the product would have stopped it at 5, at 50, or at 255** — only the Member's own
`complete` or the 256th round would have.

## 4. Why the Member holds "direct human" goal authority (the mechanism, not a guess)

Two independent facts compose:

1. **The Member session is a runtime ROOT.** The Team runtime creates every member with
   `agents.create({sessionId, meta, setup})` and **no parent**, so `ctx.agents.roots()` contains it
   (`packages/runtime/src/plugin/live/agent-bindings.mjs`).
2. **The delegated work prompt arrives as a `user`-kind message.** Work delivery calls
   `createUserMessage({ source: { kind: 'user' } })` (`agent-bindings.mjs`, the `team-work requestToken=…`
   delivery), and `tool-goal`'s `requireDirectHuman` tests exactly `agents.roots().includes(agent)` **and** an
   open-turn `user/message` whose `source.kind === 'user'`.

A machine delegation therefore satisfies a predicate written for a human operator. This is the same root-ness
that makes §7.2's `ask_user_question` pass `assertLiveRoot` and block. **One root cause, two findings.**

## 5. Disposition and why

**Ruling: C-class enforcement gap** (the ceiling bounds a call, not the total), and the existing mechanism is
**effective but caller-writable**. The decision tree the task fixed:

- (a) *is there a product mechanism that could bound it?* Yes: `maxGoalRounds` (default 256). It **does** take
  effect on this preset — the `cap2` arm proves it at 2 (`code=round-limit`). But it is not a ceiling: it is a
  **goal parameter the Member sets and can raise** (row 5: 256 → 9007199254740991, accepted).
- (b) *if not effective, wire the existing mechanism without inventing a policy source.* There is **no
  preset-level pin** to wire: the `goal` service row lives in the base bundle, not in the preset, and
  `tool-goal` exposes no configuration that fixes the cap. Pinning it preset-side would require either a new
  policy source (forbidden: no new policy sources) or an upstream change that makes `maxGoalRounds`
  non-caller-settable (§5.1).
- (c) therefore **fail-closed**: remove the rows whose tools cause the unbounded/blocking behaviour, and
  disclose the regression.

**Removed from `preset-a5sf-governed-member` (this lane's only product change, 2 row deletions):**

- `tool-goal` — `get_goal`, `create_goal`, `update_goal` (the trio leaves as a set: a surviving reader would
  still let a Member inspect and, with a stale revision, steer a goal).
- `tool-ask-user` — `ask_user_question`, because on an unattended Member it **blocks the delegation
  indefinitely** (§7.2), which is an availability defect plus a held Member turn, not a governance capability.

**Kept, with the reason:** `plan-mode` (`exit_plan_mode` is a typed "only available in plan mode" error outside
plan mode, measured — harmless), `tool-todo` (session-local, measured), `command-goal` (a **command** row: it
registers `/goal` for a client, and a Member has no client; it is not a model-facing path, and removing it would
be a regression with no measured defect), and everything else (`bash`, `fs`, `fs-search`, `jobs`, `present`,
`tool-plugin-manager`, compaction, persona/instructions, the `team_*` rows — another authorization surface this
lane did not touch).

**Disclosed capability regression.** The opt-in governed preset's Member surface drops **34 → 30** names: a
governed Member can no longer create, read, or update a goal, and can no longer ask a human a question. That is a
regression, not an enforcement win; §5.1 says what would restore each capability and who could do it.

### 5.1 `CORE_SEAM_BLOCKER` — a preset-level goal cap (why (b) is not reachable here)

A real fix keeps the capability and bounds the series. It needs **one** of:

1. **A goal row that cannot be widened**: `maxGoalRounds` resolved from configuration the Member cannot write
   (a preset/host-level policy), with `create_goal`'s `max_goal_rounds` argument refused or floored, and
   `update_goal edit` refusing to raise it. Today `edit` may change `maxGoalRounds` — only
   `pause`/`resume`/`complete`/`block` require the same goal definition — so this is a change **inside the
   pinned upstream `tool-goal`/`goal` packages**, i.e. an upstream source patch: **forbidden** by
   `CORE PATCH BUDGET = 0`.
2. **A per-turn / per-delegation budget** at the Team seam: a `maxTurns`-class bound on a delegated Member's
   autonomous continuation, enforced by the Team runtime between rounds. The Host's agent loop has no such
   budget (see §7.3), so this is not a matter of "turn on an existing knob" — it is new Team-side policy with no
   budget in this phase, and it would be a **new policy source**, which the task forbids.

Neither is attempted; neither is claimed. The alternative — a governed cross-Member "ask" channel with its own
authority model and an unattended answerer policy — is likewise new product capability, not a fix.

## 6. Post-fix measurement (the same five arms, the tree's composition)

Post-fix agreeing pair (`runs/`, both boots identical — `agreement.txt`, `differing=[]`): Member surface **30**
names (`createGoalOnSurface=false`, `goalToolsAbsent=PROVEN`); `get_goal`/`create_goal`/`update_goal`/
`ask_user_question` are **absent from the tool catalog**, so every probe is the host router's typed
`Error: unknown tool "<name>"`; **zero** goal rounds (`loopRounds=0`, `cap2Rounds=0`, `raisedCap=null` — nothing
can be created, so nothing can be driven); the 30-call burst still executes **30/30** in **1774 / 1785 ms** (the
burst is `bash`, which is kept — the no-cap finding of §7.3 is unchanged and **deliberate**); `exit_plan_mode`
and `todo_write` behave exactly as in the prefix arm (`planError=true` in both arms). The `ask` delegation now
**returns**: `askBlockedSeconds=null`, `delegationsReturned` is `true` for all five, the Member's typed
`unknown tool` answer arrives after its two model requests (`memberModelRequests.ask=2`), and the whole pair
issues 58 mock requests versus the prefix arm's 68.

The surface roster change, name by name: `-get_goal -create_goal -update_goal -ask_user_question` (34 → 30).
`surfaceCount` and the full roster are in `runs/bootNN/member-surface.json` and `counters.json`.

## 7. Three residuals that are NOT this row

### 7.1 A synchronous `team_delegate` returns before the Member's automatic rounds (`delegation-return.json`)

**A distinct orchestration-semantics finding.** The Leader's sync delegation reports *completed* while the
Member keeps running: the first Leader model request whose history carries the `call-pd25-delegate-loop`
tool_result arrived at `04:44:21.532Z`, and **4 of the 5** goal rounds arrived **after** it
(`04:44:21.722Z` … `04:44:22.369Z`, `secondsResultToLastRound: 0.8`; boot 2 identical in shape: `04:46:35.668Z` →
4 rounds, 0.8 s). The Leader therefore cannot distinguish "the member finished" from "the member is still looping" — the
delegation's completion is the member's **turn** boundary, not its **goal** boundary. This is recorded as a
residual for the Team-runtime owner; it is not fixed here and no `team_*` behaviour was changed.

### 7.2 `ask_user_question` blocks the delegation indefinitely (`counters.askBlockedSeconds = 45` in both boots)

**The same root cause as §4.** The Member is a runtime root, so `assertLiveRoot` passes and the legacy
`tool-ask-user` path awaits `ctx.userQuestions.ask()`; the pinned host's `api-remotes` bridge
(`packages/api/remotes/src/index.ts#forwardWaterfall`) queues the question as a Gateway-owned pending event for a
**client that is not there**, and nothing ever settles it. Measured: `team_delegate` still had no result after
**45 s** (our cap), the ask Member stayed `RUNNING`, and the question never reached a human. It is not a typed
refusal, not a timeout — it is an unbounded wait holding a Member turn. Removing `tool-ask-user` is the
fail-closed disposition; a governed ask channel needs an answerer policy that does not exist (§5.1).

### 7.3 No tool-call cap in one Member turn (30/30) — stated, not fixed

**Measured:** 30 sequential confined `bash` calls in one turn, **30/30 executed**, 1899/1898 ms, no refusal, no
truncation, no typed error. **Cross-check, host-free:** the pinned host's agent loop iterates
`while (await this.turn()) {}` with an inner `while (true)` per step and carries **no** step/turn/tool-call
budget; the only per-step bounds are `maxTokens` per model output and `maxParallelToolCalls`. **Not fixed here,
deliberately:** a total call/turn budget is a **product-wide** question (it would apply to every session, not
only a governed Member), and inventing a per-Member cap would be a **new policy source**. Recorded as a residual
for the Host/product owner, with the number and the anchor, as such.

## 8. Surface roster change record

| | prefix (`archive/pre-fix/`, 34) | postfix (tree, 30) |
| --- | --- | --- |
| goal trio | `get_goal`, `create_goal`, `update_goal` present and **dispatchable** | absent; typed `unknown tool` |
| ask | `ask_user_question` present and **blocking** | absent; typed `unknown tool` |
| `team_*` (15) | present | present (untouched — another authorization surface) |
| `bash`/`fs`/`fs-search`/`jobs`/`todo`/`present`/plugin-manager | present | present |
| canaries (`u5_canary`, `u6fs_probe`) | present | present |

## 9. Mutation controls (`mutation-controls.log`, **9/9 PASS**)

`tests/world-factory/a5sf-pd25-mutation-controls.mjs` drives the host-free suite six times and asserts the exact
arm that reddens: **CLEAN** (5/5 green) · **M1-goal** (dispatchable trio → `PD25-TYPED-REFUSAL` RED, both SURFACE
arms stay GREEN) · **M2-ask** (dispatchable ask → RED) · **M3-partial** (**only** `get_goal` dispatchable → RED:
the trio must leave as a set) · **M4-row** (re-insert `tool-goal` + `tool-ask-user` into a temp copy of the
composition → `PD25-SURFACE-CLOSED` RED, `PD25-TYPED-REFUSAL` stays GREEN) · **PIN** (`git show
6cfc67b76:cordis.patch.yml` really carries both rows; the PIN arm is GREEN).

## 10. Residuals and disclosures

1. **The capability removal** (§5, §5.1): goals and asking are gone from the opt-in governed preset. A Member
   that needs either now has no tool; the Leader can still (mis)report a delegation as finished (§7.1).
2. **§7.1** (delegation returns before rounds) and **§7.3** (no tool-call cap) are **residuals for their
   owners**, not fixed by this row; §7.2 is fixed by removal.
3. **Observation caps are the lane's** (§ preamble). A reader must not read "5 rounds" as "the product stops at
   5". The product's number is **256** by default, **and the Member can raise it** (measured).
4. **Mock-model decider**: the *decisions* to create/raise/ask are scripted; every *execution*, every durable
   session record, every goal state transition and every guard fact is the real Host's. The lane measures
   product behaviour given those calls, not model compliance.
5. **`command-goal` is retained** while `tool-goal` is removed; a client-driven `/goal` is still declared. No
   Member has a client, so this is not a model path today — disclosed so a future reader does not read the
   removal as "goals are gone from the product".
6. **Boot evidence, not merge evidence**: `DEV-LIVE`, four boots, one machine, no candidate claim, no `V@B`, no
   grade, no Q7/Authority/CI change.

## 11. Gates (this lane, this machine)

| gate | result | log |
| --- | --- | --- |
| a5sf family (`node --test tests/world-factory/a5sf-*.test.mjs`) | **PASS** 599 tests, 589 pass, 0 fail, 10 skipped | `a5sf-family.log` |
| `pnpm -r typecheck` | **PASS** (all 9 projects) | `typecheck.log` |
| `pnpm run lint` | **129 errors / 32 warnings, all PRE-EXISTING** — byte-identical counts to PD-23's `eslint.log` on its own green branch; this lane's four files add **0** errors (the driver matches the repo's ignore pattern, 4 ignore warnings) | `eslint.log` |
| `node scripts/check-artifacts-committed.mjs` | **PASS** | `check-artifacts.log` |
| `node scripts/doc-checks.mjs` | **PASS** | `doc-checks.log` |
| register tests (`a5sf-debt-register.test.mjs`, part of the family) | **PASS** 10/10, PD-1…PD-24 contiguous, anchors resolve | `a5sf-family.log` |
| `node scripts/ci-pr-gate.mjs --only state-freshness` | **PASS** (pointer agrees both ways, records contiguous, contract ok) | `ci-pr-gate.log` |
| `node scripts/eb3-evidence-guard.mjs --new-since origin/master` | **PASS**, 0 findings, no file over the 1 MiB bound, nothing exempted | `eb3-evidence-guard.log` |

**One environment note, disclosed because it cost this lane two measurements.** The worktree's first `node_modules`
was a byte copy of the main checkout's, which left `node_modules/@deepseek-ai/dsh`'s relative symlink dangling and
made the a5sf family red with `SERVICE_MOUNT_FAILED: prompt section "tool:read" is already registered` (209
failures, **none** of them caused by this lane's change: a clean worktree at `6cfc67b76`, and the same worktree
with the master composition, both pass the same file). Replacing the copy with the shared
`node_modules -> ../a5sf-native-route-c/node_modules` symlink (the PD-23 precedent) plus per-package links made the
family green. **No product code was touched to make a gate pass.**

## 12. Reproducing

```bash
# host-free: pin (optional), surface, surgical, typed refusal
node --test tests/world-factory/a5sf-pd25-unbounded-turn.test.mjs
A5SF_PD25_PIN=1 node --test tests/world-factory/a5sf-pd25-unbounded-turn.test.mjs
node tests/world-factory/a5sf-pd25-mutation-controls.mjs          # 9/9

# live pre-fix pair (the recorded base composition; never mutates the tracked file)
A5SF_PD25_HOST_TREE=<pinned host tree> \
A5SF_PD25_COMPOSITION=$PWD/dev/agent-workflow/evidence/a5sf-pd25-unbounded-turn/archive/pre-fix/cordis.patch.yml \
node tests/world-factory/drivers/a5sf-pd25-unbounded-turn/run-boot.mjs --arm prefix --boots 2

# live post-fix pair (the tree)
A5SF_PD25_HOST_TREE=<pinned host tree> \
node tests/world-factory/drivers/a5sf-pd25-unbounded-turn/run-boot.mjs --arm postfix --boots 2
```

Artifacts per boot: `counters.json`, `self-continuation-rounds.json`, `delegation-return.json`,
`member-probes.json`, `member-surface.json`, `member-<template>-transcript.{txt,json}`, `member-<template>-session.v4.jsonl.zstd`,
`diagnostics-final.json`, `host-log-final.log`, `run-record.json`, `summary.txt`, `teardown.json`. The pair adds
`agreement.{json,txt}`. The driver records its own sha256, the composition sha256, the host tree sha256 and the
observation caps in `driver-digest-<arm>.json`.

## 13. Why there is no `PRODUCT-DEBT-REGISTER.md` §6 declaration

§6 exists for a row that cites evidence living on a **not-yet-merged** branch while the row itself is already
merged. Here the row and its evidence land together on `task/pd25-unbounded-turn-20261114` (draft PR #674, first
line `PD25-UNBOUNDED-TURN`), and the register gate reds if §6 declares a path that exists on the tree — so no
declaration is correct, and this note records that the omission is deliberate rather than forgotten. If a later
lane lands this row while the evidence path is missing, §6 gains the row then.
