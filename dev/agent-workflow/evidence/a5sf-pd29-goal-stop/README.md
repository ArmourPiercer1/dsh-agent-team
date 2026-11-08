# PD-30 — GOAL-STOP: the goal tools are back, and a governed Member's goal actually stops

Lane `PD29-GOAL-STOP`. Branch `task/pd29-goal-stop-20261114`, worktree `.worktrees/pd29-goal-stop`.
Base `origin/master` = **`da6cc7ba2`** (`PD28-SERVICE-SEAM`, #677). This lane was rebased **twice** — onto
`1879e3ebc` (#678, the web preview) and then onto `da6cc7ba2` — and every number below was **re-measured on each
merged tree**; the pair reported here is the one taken on `da6cc7ba2`. Host pin **0.2.0-rc.2 @
`639ed01539`**, read-only. **Row-id note, two numbers and why (2026-11-14):** this window originally allocated **PD-31** to this lane
(`1879e3ebc` took PD-28, `da6cc7ba2` took PD-29, the read_image lane was to take PD-30), but the register's
contiguity gate (`PD-1…PD-n`, sequential, gate-enforced) admits only **the next free id on the base**, which is
**PD-30**; the owner corrected the other lane instead, so **read_image yields to PD-31** and this row is **PD-30**.
The lane labels stay `pd29` (branch, evidence directory, driver, test arms) because those are the identifiers the
runs were taken under — the PD-25-from-PD-24 / PD-28-from-PD-30 convention, and the phase's fifth renumber: the
discipline that makes renumbering survivable is that every move is dated and explained, not that we never move.
Evidence class **DEV-LIVE** (two agreeing boots, slot-leased, 3180-family ports, `DSH_HOME` under
`tests/homes/`). **`CORE PATCH BUDGET = 0`** — no upstream file is imported for modification, patched or vendored;
the pinned host tree stayed porcelain-clean on both boots (`runs/*/host-tree-porcelain-2.txt`).

**What this lane did NOT change:** it is a Team-owned lifecycle fix plus one preset row. The `interrupt` defect
below is *invisible to any test that only asserts `interrupt` returned ok* — the function returned normally, the
archive reported `executed`, the lifecycle reported `ARCHIVED`, and the goal kept running. Every arm here is
therefore judged on the Member's own durable event log; the return value is never the oracle.

**The general form of the defect, which is the thing to remember:** a stop that returned normally, with the
archive saying `executed` and the lifecycle saying `ARCHIVED`, while the goal stayed `active` and five more rounds
ran — i.e. **every layer reported success except the one that mattered.** That shape is worse than an error,
because every check an operator or a test would naturally make comes back green; only the durable record of the
thing that was supposed to stop shows it never stopped. The `childSessionId` fallback is how *this* instance was
fixed; the shape is what a reviewer should look for in the next one.

Owner rulings this lane executes (`docs/plans/active/alpha5-sandbox-first/PRODUCT-DEBT-REGISTER.md` PD-25):

1. **restore** `get_goal` / `create_goal` / `update_goal` on the governed preset;
2. **reuse** the upstream goal service, goal tools and goal-round driver — do not fork the goal package;
3. accept that Preview has **no trustworthy global round budget** (the caller edits `maxGoalRounds`), so do not
   delete the tools over PD-25's finding and do not invent a Member-immutable total limit;
4. make the **Stop** semantics real: after an explicit stop, that Member's goal must never start another round,
   and it must never revive on its own — including a cancel race and a cold session re-materialisation.

## 1. What was true before this lane

PD-25 removed `tool-goal` and `tool-ask-user` from the governed preset. The goal *service* and the goal-round
*driver* were still in the bundle (`command-goal` was even retained), so the product kept a continuous-goal
machine that **no governed Member could reach** — and no measured evidence existed that the machine stops when a
Team lifecycle action stops the Member. Two concrete gaps came out of reading the shipped code before booting:

* `interrupt(target)` (the lifecycle's step 2) called `agent.cancel({kind:'user'})` and nothing else. Upstream's
  own contract says a cancel with no active activity **is a no-op that arms nothing** — so a Member sitting
  *between* two goal rounds kept `phase: active` and the driver's next `drive()` would start the next round.
* `interrupt()` looked the live handle up by `row.childSessionId`. Some writers leave that column empty (the id is
  **derived** — `childSessionIdFor(root, instance)` = `session-team-child-<sha256[0:32]>`), so the lookup missed
  the handle and the function returned before cancelling anything: a stop that returns, logs nothing and does
  nothing. This lane's first two boots measured exactly that shape (archive "succeeded", 5 rounds later, goal
  still `active`); it is the **success-shaped no-op** this phase is about.

## 2. What this lane changed (3 production edits, no core patch)

| File | Change |
| --- | --- |
| `cordis.patch.yml` | re-insert the upstream row `- id: tool-goal / name: '@deepseek-ai/dsh-tool-goal'` after `command-goal` in `preset-a5sf-governed-member` (16 rows total; `tool-ask-user` stays out). |
| `packages/runtime/src/plugin/live/agent-bindings.mjs` | `interrupt(target)`: resolve the child session id **with the derived fallback**, look the handle up by it, `agent.cancel({kind:'user'})`, then `disarmStoppedGoal(handle.agent, target)`. `disarmStoppedGoal` (new, closure-local) reads the goal through the lazily-resolved public `goals` service, performs the **durable CAS `pause`** (`{id, revision}` — the same transition the goal bar's `goals/pause` performs) when the phase is `active`, then `goals.disarm(agent)` to withdraw the process-local activation. Every branch pushes a `pd29:` observation, including "found NO live agent". |
| `packages/runtime/src/plugin/host.ts` | the lazy dependency `goals: () => ctx.get('goals')` (plus its deps type), so the row uses the public service and never a private import. |

`dist/` was rebuilt with `scripts/place-dist-glue.mjs` and is committed (the changed files are the two
`host.*` and `agent-bindings.mjs` outputs).

Why pause **and** disarm: `pause` is the truthful durable state (a member the Leader just archived must not keep
reporting `phase: active` while nothing can run — a *label without a mechanism*), `disarm` is what stops an
in-flight activation from starting a new round. Both are upstream public API; no second state machine, no
admission-stamp duplication, and the durable `revision`/CAS contract is untouched.

## 3. The measured acceptance (agreeing two-boot pair)

`agreement.txt` / `agreement.json`: **10/10 cases, both boots, all agree** (`runs/boot01`, `runs/boot02`).
Each arm judges the Member's **own durable session log** plus the Host's mock-request log — never a return value.

| Arm | Condition | boot01 | boot02 |
| --- | --- | --- | --- |
| S8-continue | no stop at all: the goal must keep driving rounds (also proves the restored tools reach a governed Member on the same tree that ships the `skill`/`present` service seam) | totals: s2 **198**, s3 100, s4 43, `lead` **159**, cold 205, s1 2, pz 1 | s2 **204**, s3 100, s4 42, `lead` **161**, cold 209, s1 2, pz 1 |
| **S1** | user `POST /api/session/cancel` **mid-round** (round 2 running `bash sleep 4`) | stop at round 2 / call 3 → **0 rounds, 0 tool calls, 0 model requests** in a 20 000 ms window; durable `pause` rev 1→2; `turn/end aborted`; Member `SETTLED` | identical |
| **S2** | explicit stop **between rounds** (the goal bar's `goals/pause`, per-round `bash sleep 0.15` pacing) | pause at **99 rounds** → **0 rounds / 0 requests** in 20 000 ms | pause at 100 → 0/0 |
| S2-race | 24 raw cancels fired at round boundaries | 0 rounds after the last stop, `lost = false` (no stop mis-attributed) | same |
| **S3** | idle-window probe: observe the durable `turn/end`, cancel immediately, classify landed/dropped, re-arm between attempts via `goals/resume` | **6/6 landed, 0 dropped** (the window is microsecond-wide; every attempt the driver could aim at a boundary landed) | 6/6 |
| **S4** | **Leader** stops a Member with `team_archive_member` while it runs a round — the lifecycle module #677 rewrote | **43 rounds / 44 calls** before → **0 rounds, 0 calls** after; lifecycle `SETTLED → ARCHIVED`; durable goal **`paused`** (`pd29:` observation: paused=paused@2, activation armed→disarmed) | 42 rounds → 0/0, same |
| **S5** | user stops the **Leader** (root session cancel) | root `turn/end aborted`; Members are **not** cancelled: s2 +14, `lead` +13, cold +13 rounds, s1/s3/s4/pz 0 — measured as non-propagation, not as a pass for Member stops | identical (+14/+13/+13) |
| **S6** | **cold recovery**: `SIGTERM` the Host mid-round, reboot the same `DSH_HOME` (`bootPhase: create-or-open`), re-materialise the member through a real `team_follow_up`, then 20 000 ms of silence | kill at **204 rounds** (durable), restart healthy with all 7 members `SETTLED`, follow-up `work-admitted` → **0 rounds**, `revived = false`; the S1 member's durable goal is still `paused` | kill at 208 → 0 rounds, same |
| **S7** | explicit authorised restore after recovery (`goals/resume`, CAS on the durable ref) | `ok`, **1 round** resumed, phase `active` | same |
| S8-terminal | `max_goal_rounds: 1` Member | `roundsStarted 1` → `phase blocked`, `code round-limit`, 0 further rounds | same |
| S8-pause | pause an active Member at 159 rounds | `paused` observed, **0 rounds** in 20 000 ms | pause at 161 → 0 |
| **S8-complete** | user `goals/complete` on the resumed goal | durable `complete`, **0 rounds** afterwards | same |

**Instrument rule this lane learned the hard way:** *assert the composition loaded before asserting anything about
behaviour.* Both merged-tree first pairs created **zero Members** (`tool-web (dsh-agent-team/web-tool): never
started`) and would have been reported as "no goal / no rounds" — a behavioural symptom of a preset that never
loaded. The driver now links the production install graph, asserts the four shipped exports resolve before any arm,
and fails with **`members created=N of 7`**, never with a downstream symptom. Any World booting the shipped preset
needs the same two steps.

The merged preset the pair booted carries **21 rows**: `persona, agent-instructions, tool-bash, tool-fs,
tool-fs-search, tool-jobs, tool-skill, tool-present, tool-web, command-goal, tool-goal, planning, plan-mode,
compaction, compaction-basic, command-compact, tool-result-pruner, tool-todo, tool-plugin-manager,
team-spill-local, dsh-agent-team-client` — the restored `tool-goal` **coexists with the web lane's `tool-web`**,
`tool-skill`/`tool-present` are now served by the `da6cc7ba2` **service seam** (a Team `skills` provider plus a
direct mount of the pinned `present` package) rather than by the two Team tool forks, and `tool-ask-user` is still
absent. The lifecycle module that PR rewrote is exactly what S4 drives.

Round cadence note (honest): every probe round is paced with `bash sleep 0.15` (~6 rounds/s) so an arm can
observe a boundary; the earlier unpaced shape ran ~68 rounds/s and hit the Member-chosen `100000` cap inside one
arm, which would have made "no round after the stop" true for the wrong reason. `s8Continue` therefore reports
the round counts above (not a rate), and `pz` is the only Member with a small cap (1) — the cap itself is the
Member-editable upstream parameter, unchanged by this lane.

**Deployment disclosure (found while rebasing):** the shipped preset now names subpath rows
(`dsh-agent-team/web-tool`, `dsh-agent-team/web-transport`, the root `dsh-agent-team/host`), and a preset row is
resolved by the **profile's** module graph. A World that boots the shipped bundle must therefore provide the
production install graph — `profiles/web/node_modules/dsh-agent-team -> <repo root>` — exactly as #678 does for its
own World. The first merged-tree pair failed at `tool-web (dsh-agent-team/web-tool): never started` → every
`team_delegate` rejected with `TEAM_RUNTIME_DURABLE_WRITE_FAILED` → **zero Members created**; the driver now links
the package and asserts that `./host`, `./web-tool`, `./web-transport` and `./client` resolve before any arm, and
fails with "members created=N of 7" instead of "no goal" when a delegation was refused. This is a deployment
property of the test World, not a composition edit — no row name is rewritten.

## 4. What is still NOT true (disclosed, not fixed)

1. **No global round budget.** `maxGoalRounds` is a per-goal parameter the Member can set and raise
   (`update_goal edit`), so "continuous goals" really are continuous. The owner accepted this for Preview;
   this lane adds no Member-immutable limit and no token/cost budget. "Unlimited Goal" means *the absence of an
   extra trusted total-round limit*, not `Infinity`.
2. **Stopping the Leader does not stop the Members' goals** (S5). They are runtime roots with their own goals.
   The callable per-member channels are `team_archive_member` (Leader) and `POST /api/session/cancel` on the
   member child session (user) — both measured here. A single "stop the whole team" gesture does not exist.
3. **The idle-window stop is still a race**, now withdrawn deterministically *when reached*: the driver's
   `disarm` (and the durable pause) run on the same interrupt, so a landed stop cannot leave an armed goal. Six
   of six aimed attempts landed and none was dropped, but a cancel that arrives while the agent is idle is an
   upstream no-op that emits **no event** — the Team cannot *observe* it, it can only withdraw authority when it
   is the one performing the stop.
4. **The goal bar's own RPC surface is `/api/goals/*`**, not `/team-remote/*`: `/team-remote` is a closed
   contract that answers `unknown-method` for `goals/get`. This lane drives pause/resume/complete through
   `/api/goals/{get,pause,resume,complete}` with the `{args:{agentId, ref}}` envelope — the same method names and
   CAS the web client uses.
5. **A World that does not provision the production install graph cannot boot the shipped preset at all**, and the
   failure does not surface as a dead preset: the first pairs on both merged trees created **zero Members**
   (`tool-web (dsh-agent-team/web-tool): never started` → every `team_delegate` rejected
   `TEAM_RUNTIME_DURABLE_WRITE_FAILED`), and the arm would have reported it as "no goal / no rounds" — a downstream
   symptom of an instrument that never reached the product. This lane's driver now links
   `profiles/web/node_modules/dsh-agent-team -> <repo root>` and asserts `./host`, `./web-tool`, `./web-transport`,
   `./client` resolve before any arm, and fails with "members created=N of 7" when a delegation was refused. The
   same fix is implemented privately in the `da6cc7ba2` lane's driver (`provisionInstallGraph()` +
   `TT_INSTRUMENT_PRESET_DEAD`); it belongs in the shared world-factory, and this local copy is dropped the moment
   that lands. No row name is rewritten either way — the composition under test is the shipped one.
6. `tool-ask-user` remains out of the governed preset (PD-25's decision, untouched).

## 5. Files

```
pair-console.log              the pair's console transcript (both boots, incl. the install-graph line)
driver/                       launcher stdout kept as run evidence (2 worlds)
driver.log                    the pair's narrative log
driver-digest.json            driver + plan-patch digests
plan-patch.yml                the composed patch layer this run booted
run-ledger.jsonl              host-start ledger (2 starts, DEV-LIVE)
run-record.json               final record (DEV-LIVE, candidate head/host bindings)
agreement.txt|json            the two-boot agreement table
runs/boot01|boot02/           arms.json (the measured arms), member-facts.json (per-member durable extract),
                              mock-requests.json (model-request log), state-final.json, verdicts.json,
                              run-record.json, summary.txt, host-tree-porcelain-2.txt, teardown.json
```

Host-free guard: `tests/world-factory/a5sf-pd29-goal-stop.test.mjs` (4 arms: the preset row, the stop sequence
`cancel → disarm → CAS pause` looked up by the derived child id, a `git show 24d2cf760:` pin that the
pre-fix tree has no disarm seam, and a mutation arm that deletes the call and must redden the sequence). The governed-surface
expectations in `a5sf-pd25-unbounded-turn.test.mjs` / `a5sf-pd25-mutation-controls.mjs` /
`a5sf-pd26-confined-skill.test.mjs` were updated from "goal family closed" to "goal family reopened, ask-user
still closed".

## 6. Verdict

**Preview-acceptable for the Stop contract, with the two disclosures above.** A governed Member can run a
continuous goal today (S8-continue; the restored tools are reachable and the driver runs the rounds), and after an
explicit stop by the user **or** by the Leader that Member's goal starts **no** further round — mid-round,
between rounds, at the boundary, and after a cold restart — while an authorised `resume` still works. The
remaining defects (no global round budget; Leader stop does not propagate) are product decisions already logged,
not Stop-contract failures.
