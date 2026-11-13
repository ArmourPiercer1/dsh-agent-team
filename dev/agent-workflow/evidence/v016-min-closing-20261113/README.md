# v0.1.6 Preview — the three MINIMUM CLOSING MEASUREMENTS

**Date:** 2026-11-13 (owner ruling of 2026-11-13)
**Record class:** **DEV-LIVE** — a real `dsh web` Host, a fresh `DSH_HOME`, the
pinned test runtime, the shipped governed Member preset, the OS refusing the
write. **Never** CANDIDATE-C2, never V@B. `osLevelNetworkIsolationClaimed:false`.
**Product tree measured:** branch `task/v016-min-closing-20261113` at
`76a86d6e923efa291350a32d1c1eb70e3754a684` (`origin/master` at branching time).
**Host pin:** `0.2.0-rc.2 @ 639ed015397290b3745d163aafe02ffee4aa3f84`
(`tests/deepseek-harness-test-use`, pristine, porcelain empty).
**Instrument:** `tests/kits/a1-bash-governance-20261112/a1-bash-governance.mjs
--min-closing=<mode>`, two fresh worlds per proposition, comparator
`tests/kits/a1-bash-governance-20261112/compare-min-closing-runs.mjs`.

## Verdicts

| # | proposition | verdict | one-line result |
|---|---|---|---|
| 1 | **PD-42** — an **approved** governed `bash` call does not widen the Member filesystem ceiling; the ledger records the refusal (not `succeeded`) | **FAIL** | OS refused the out-of-lane write (zero bytes, tool text `Read-only file system`), approval chain complete, but the durable `control-execution-result` says **`succeeded`** even though the tool text records exit code 1. Defect: `packages/runtime/operation-permission/pre-execute-adapter.ts:868`. Typed code `PD42_EXECUTION_RESULT_SUCCEEDED`. Reproduced identically twice. |
| 2 | **Goal ∧ plane takeover ∧ A6-off** — ≥2 automatic rounds and the Goal Stop works | **PASS** | durable Goal row, revision 2 (`active`, `roundsStarted=2`, `activation=armed`), then Stop (`session/cancel` 200) → revision 3 (`paused`, `activation=disarmed`); no round 3 in the 12 s window. Identical in both runs. |
| 3 | **Operator re-issue of an abandoned request** | **PASS (with disclosed gaps)** | crash window `allow`+0 consumptions reproduced on attempt 1; boot settlement wrote `control-request-abandoned reason=invocation-abandoned`; old request resolve → typed `CONTROL_REQUEST_ABANDONED`, excluded from pending; new ask → new request/correlation, allow, consumption, `succeeded`, exactly one file effect. **The new decision was made by the operator, not by a reviewer wake** (a post-restart wake did not arrive; `team_follow_up` was admitted but produced no turn) — see Gaps. Identical in both runs. |

Two-run agreement (verdict **and** normalized detail, per mode): all three
`verdictsAgree=true detailsAgree=true compositionAgree=true`:

```text
= PD-42       FAIL / FAIL
= GOAL-A6OFF  PASS / PASS
= REISSUE     PASS / PASS
```

## Method (what makes these runs real)

- One proposition per invocation, one **fresh `DSH_HOME`** per run
  (`tests/homes/c1-smoke-<stamp>/`, removed by the driver's verified teardown).
- Every run boots the pinned host (`639ed01539`) and mounts the same
  composition: `DSH_PERMISSION_MODE=danger-full-access` host default, the
  shipped `a5sf-governed-member` preset, the plane takeover that adopts the
  pinned native `bash`, and a **v5 Team document carrying `memberIoCeilings` +
  `reviewRouting` on one document**. The Member shell runs under the product's
  Alpha.5 confined provider (`landlock-prelauncher.py`, sha256
  `f4188319…`; the instance log records it as `census-boot selectedRunner=…
  enforcement=landlock-launcher pinned`).
- Approvals are exercised through the **production** team tools
  (`team_resolve_control` / `team_list_pending_control`) or the Alpha.6 Officer
  wake; the model is the repository's scripted mock (`mock-deepseek.mjs`), so
  turns are deterministic but *not* a real LLM.
- Ports are sanctioned host ports in `3180-3199` / mock ports in `3491-3500`,
  and no other world owns them during a run. `:3080` was touched only by the
  read-only stable pre-probe (`401`, as designed).

| mode | run | DSH_HOME world | host port | mock port |
|---|---|---|---|---|
| `pd42` | run1 | `c1-smoke-2026-11-13T07-16-14-h0-rfadd6f` | 3187 | 3496 |
| `pd42` | run2 | `c1-smoke-2026-11-13T07-46-55-h0-r7b39f2` | 3190 | 3491 |
| `goal-a6off` | run1 | `c1-smoke-2026-11-13T07-18-36-h0-rab8789` | 3188 | 3497 |
| `goal-a6off` | run2 | `c1-smoke-2026-11-13T07-47-18-h0-r20e325` | 3191 | 3492 |
| `reissue` | run1 | `c1-smoke-2026-11-13T07-43-17-h0-rf7788e` | 3189 | 3498 |
| `reissue` | run2 | `c1-smoke-2026-11-13T07-47-51-h0-rcccd51` | 3192 | 3493 |

Each run directory contains `run.log`, `min-closing-verdicts.json`,
`min-closing-arms.md`, `a1-sandbox-backend.json`, `instance.log`/`instance-tail.txt`,
`mock.log`, the mode-specific JSON named below, and `teardown.json`.

---

## 1. PD-42 — approved bash must not widen the Member filesystem ceiling

**Composition.** A1 v5 Team (`memberIoCeilings` + `reviewRouting`), one Officer,
one `w-probe`, A6 **on** (Officer review wake). The mock approves **both**
governed `bash` legs — the arm measures an *approved, out-of-lane* write, never
an unapproved refusal. Call 0 writes inside the Member ceiling
(`<workspace>/mc-pd42-inside-<stamp>.txt`, trailing success marker). Call 1
writes outside it (`<DSH_HOME>/mc-pd42-outside-<stamp>.txt`, no trailing
success, so its shell exits nonzero). The driver says from the OS (a real
`readFileSync` / stat, not the tool's word) and from the durable ledger.

**Exact durable rows — run 1** (`storages/team_domain.json`, `tables.ledger`,
`ctrl-…` ids per this run):

```text
 7  control-request-recorded   ctrl-1o2epzo0z4plop0hkfpdy1b7  …  allow
 8  control-decision-recorded  ctrl-1o2epzo0z4plop0hkfpdy1b7  allow
 9  control-allow-consumed     ctrl-1o2epzo0z4plop0hkfpdy1b7
14  control-execution-result   ctrl-1o2epzo0z4plop0hkfpdy1b7  outcome=succeeded   <-- WRONG
15  control-request-recorded   ctrl-0luwu621usai7f04805is1jj
16  control-decision-recorded  ctrl-0luwu621usai7f04805is1jj  allow
17  control-allow-consumed     ctrl-0luwu621usai7f04805is1jj
22  control-execution-result   ctrl-0luwu621usai7f04805is1jj  outcome=succeeded   <-- WRONG
```

**Exact durable rows — run 2** — identical sequence numbers and outcomes:
inside `7/8/9/14`, outside `15/16/17/22`; outside request
`ctrl-0o3435q0rsj5sj0p8kacs1uk`, outcome `succeeded`.

**OS truth, both runs:**

```text
inside : <workspace>/mc-pd42-inside-<stamp>.txt  size=14  bytes=="MC_PD42_INSIDE"  tool text "MC_PD42_INSIDE_OK … [Command finished with exit code 0]"
outside: <DSH_HOME>/mc-pd42-outside-<stamp>.txt  stat=ENOENT
         tool text: "bash: …/mc-pd42-outside-….txt: Read-only file system
                     [Command finished with exit code 1]"
```

So the refusal is real, the file never exists, the approval chain is complete,
the tool *text* carries the refusal and exit code 1 — and the durable execution
fact still says `succeeded`.

**Typed code:** `PD42_EXECUTION_RESULT_SUCCEEDED`
**Defect site:** `packages/runtime/operation-permission/pre-execute-adapter.ts:868`

```ts
function outcomeOfTerminalResult(result: unknown): 'succeeded' | 'failed' | 'unknown' {
  ...
  if (record.isError === false) return 'succeeded'   // L868 — the only success test
```

The terminal result is written at `pre-execute-adapter.ts:2649`
(`writeExecutionFact(pending, outcomeOfTerminalResult(result), 'terminal-result')`).
The governed `bash` tool result carries `isError:false` for a command that
*completed* with exit code 1; `outcomeOfTerminalResult` never consults the exit
code, and the `control-execution-result` row has **no field** for the command
exit code or the refusal text. The refusal is therefore not representable in the
durable execution fact at all — which is exactly what PD-42 forbids.

**What this measurement proves.**
- An **approved** governed `bash` write outside the Member ceiling is refused by
  the OS; the target path does not exist afterwards; the tool result shown to
  the model carries the refusal and exit code 1. The ceiling is not widened by
  approval.
- The approval chain is complete and in order: request → allow → consumption →
  execution-result.
- The durable execution fact is **wrong** for this execution (`succeeded`), on
  a fully deterministic, twice-reproduced run.

**What it does NOT prove.**
- It does not measure a *denied* request (A1-7 already does; a denial has no
  execution result, so this defect does not appear there).
- It does not show the same defect for other tools/lanes (`write`, `edit`,
  pipeline tools) — only governed `bash` through the terminal observer.
- It does not show the failure is *specific* to filesystem refusals versus any
  nonzero shell exit; the code path treats every `isError:false` terminal result
  as success, so a broader test would likely reproduce it, but that was not run.
- It does not prove the write was refused *by the Member ceiling* rather than
  by another layer: the evidence is the same call inside succeeding while the
  same call outside fails, the target path, the `Read-only file system` signal,
  and the configured ceiling; no syscall-level attribution was collected.
- It says nothing about network isolation (`osLevelNetworkIsolationClaimed:false`).

---

## 2. Goal ∧ plane takeover ∧ A6-off

**Composition.** A1 v5 Team plus ONE `goal-worker` template (string surgery on
the A1 document, so no new Blueprint literal): no `capabilities.permissions`
block, so the upstream goal tools stay on the Member surface; the arm measures
the product's own team authority, not a kit-side denial. A6 is explicitly
**off** (`alpha6ReviewRouting: false`, `--a6-off`): the row config printed
`mode: a6-off (alpha6ReviewRouting: false)` and the emitted record's
`composition.alpha6ReviewRouting=false`. Plane takeover is on. The human turn
is a real `member.send` from the Root principal (`{kind:'human'}`). The mock
runs the production `create_goal` → `get_goal` (revision 1) →
`update_goal(action=edit)` → then, after the human turn, the product's automatic
rounds (`<goal_round>`) up to round 2, where the driver **holds** the round
in flight (gate) and issues the Goal Stop.

**Durable Goal rows, run 1** (`goals/get` over the public Host RPC, the
product's own state, not the model's claim):

```text
goal-9ba7a345-b835-447a-9d54-b0ed9d54cbec
  revision 2  phase active   roundsStarted 2  maxGoalRounds 6  activation armed
  objective  "MC goal C1MK_MCGOAL_2026-11-13T07-18-36-h0-rab8789 edited"
  after Stop: revision 3  phase paused  roundsStarted 2  activation disarmed
```

Run 2: `goal-a02f2e46-b19c-441d-900b-de44123719fb`, the same revision/phase/
rounds/activation sequence; objective carries its own stamp.

**Rounds and phase transitions (both runs):**

| observation | run 1 | run 2 |
|---|---|---|
| rounds actually started (mock `<goal_round>` requests + `roundsStarted`) | 1, 2 | 1, 2 |
| phase transitions recorded | `active@r2` → `paused@r2` | `active@r2` → `paused@r2` |
| Stop request | `POST /api/session/cancel` → 200 `{accepted:true}` | same |
| stop was issued while round 2 was in flight | yes (`gateHeld=true`, released by driver after Stop) | yes |
| phase after Stop / after 12 s | `paused` / `paused` | `paused` / `paused` |
| roundsStarted after the 12 s window | 2 (no round 3) | 2 (no round 3) |

**What this measurement proves.** With plane takeover and A6 routing off, a real
Goal created by the Member runs at least two automatic rounds, its durable row
advances (revision 2, `roundsStarted=2`, `activation=armed`), and the Goal Stop
(`session/cancel`) is accepted and durably pauses it (`revision 3`, `phase=paused`,
`activation=disarmed`) with no further round in the observed 12 s window. The
goal tools were available (no `NOT_REACHED`).

**What it does NOT prove.**
- It does **not** prove natural convergence/completion: the arm stops at round 2;
  no final/succeeded goal phase was ever measured.
- It does **not** prove resume-after-stop, a second Goal, >2 rounds, the
  `max_goal_rounds` cap, or goal behaviour across a Host restart.
- It does **not** prove the A6-**on** Goal path (this arm is A6-off by design).
- It does **not** prove the UI Stop button; it uses the public
  `session/cancel` RPC.
- "No further round" is bounded to the 12 s window after the stop; it is not a
  forever claim.
- The `goal-worker` template is a **kit-authored** capability grant (no
  permissions block) — a release composition may declare goal tools
  differently; this measures the product's authority for that surface, not a
  shipped default template.

---

## 3. Operator re-issue of an abandoned request

**Composition.** A1 v5 Team (`memberIoCeilings` + `reviewRouting`), one Officer,
one `w-probe`; A6 **on** — required, because the boot settlement that writes
`control-request-abandoned` is `alpha6Wiring.mode === 'alpha6'`
(`packages/runtime/src/plugin/root.ts:2902`, `alpha6RecoverWakeLatches`). Had
this run used `--a6-off`, no settlement would exist and the arm would
"reproduce" nothing; the driver therefore refuses that substitution.

**Crash window (both runs, attempt 1).** The Member's governed `bash` ask gets
`allow`; the driver polls the durable ledger every 10 ms and `SIGKILL`s the Host
**before** `control-allow-consumed`:

```text
run 1: decision allow, consumptions 0 at kill, killed=true, window=DECIDED_BEFORE_CONSUMPTION
run 2: decision allow, consumptions 0 at kill, killed=true, window=DECIDED_BEFORE_CONSUMPTION
```

**Boot settlement + terminal refusal (run 1; run 2 identical sequence numbers):**

```text
 8  control-decision-recorded   ctrl-04ok8q31f1bixm0fhoged0j7  allow  decider=instance/member
 9  control-request-abandoned   ctrl-04ok8q31f1bixm0fhoged0j7  reason=invocation-abandoned
    consumptions=0   executionResults=0   old side-effect file absent=true
    operator team.resolveControl(old, allow) -> HTTP 200, typed code CONTROL_REQUEST_ABANDONED
    team_list_pending_control -> does NOT contain the old id
```

Run 2: abandoned request `ctrl-1ewxbwh0ir4wyg0to8f4j1y8`, also sequence 9,
reason `invocation-abandoned`, same refusal and pending exclusion.

**The re-issue (run 1; run 2 identical seq/outcome):**

```text
17  control-request-recorded   ctrl-1ngd5us1qmpswl1nsy7s61ag   actionName=parameter-permission
18  control-decision-recorded  ctrl-1ngd5us1qmpswl1nsy7s61ag   allow  decider=human  (operator)
19  control-allow-consumed     ctrl-1ngd5us1qmpswl1nsy7s61ag
24  control-execution-result   ctrl-1ngd5us1qmpswl1nsy7s61ag   outcome=succeeded
    distinct requestId vs old=true; distinct correlation vs old=true
    exactly one side effect: mc-reissue-C1MK_MCRNEW-<stamp>.txt (23 bytes,
    content MC_REISSUED_C1MK_MCRNEW, one consumption, one execution result)
    the old (crashed) token file does not exist
```

`vehicle = "new ask from a FRESH Member (follow_up was admitted but produced no
turn in 60s)"`, `newDecidedBy = operator` in both runs.

**What this measurement proves.**
- The decided-but-unconsumed crash window is reproducible on demand, and boot
  settlement closes it with a **durable non-authorizing** fact
  (`control-request-abandoned` / `invocation-abandoned`), leaving the old
  decision intact and **zero** consumptions/executions and no side effect.
- The abandoned request is terminal: the operator's `team.resolveControl` is
  refused with the typed `CONTROL_REQUEST_ABANDONED`, the pending list no longer
  lists it, and nothing is revived.
- The operator can re-issue: a **new** request with a new id and new
  correlation, decided, one allow consumed, one execution `succeeded`, exactly
  one visible side effect, with the old leg untouched and separate.

**What it does NOT prove — the disclosed gaps.**
- **No reviewer wake arrived after the restart.** The run's
  `a1-officer-wakes.log` contains exactly ONE wake — the pre-crash ask. After
  the cold resume, neither the re-issued ask (fresh Member) nor a follow-up got
  an Officer turn; the new request sat undecided for the 45 s window and was
  then decided by the **operator** through `team.resolveControl` (decider
  `human`). The arm is therefore a proof of the **operator-decided** re-issue
  path, not of an unattended reviewer wake after a crash.
- **`team_follow_up` on the crashed Member was admitted but never ran**:
  `200 {status:'executed', action:'follow-up', effect:{kind:'work-admitted',
  fromLifecycle:'RUNNING', settled:false}}` and then **no model request** for
  that Member within 60 s. A fresh-Member `team_delegate` did run. The likely
  cause is the crashed invocation's in-flight work never being settled on the
  Member's lifecycle, so the admitted follow-up queues behind it — **not
  proven** here (no member-row snapshot was archived; the world is removed by
  teardown). This is a liveness gap, not a ledger-correctness gap.
- It does not prove redelivery/second-restart behaviour (the runbook forbids
  relying on another restart), does not measure Outcome A (pending, never
  decided), and does not measure other crash points (before decision, after
  consumption).
- It does not prove exactly-one side effect for a *different* re-issue content
  or for `write`/other tools; the one-file count is for this `bash` shape.
- The new decision being `human` means the "reaches the reviewer" step is only
  proven at the level of the **durable pending row** (the runbook's §3.4 allows
  that), not of a reviewer turn.

---

## Two-run agreement

`compare-min-closing-runs.mjs` normalizes only identifiers/counters that
necessarily differ (stamp, control/instance/session/correlation ids, home path,
blueprint hash, ledger sequence numbers, ISO times) and compares everything
else verbatim:

```text
pd42-two-run-agreement.json      verdictsAgree=true detailsAgree=true compositionAgree=true
goal-two-run-agreement.json      verdictsAgree=true detailsAgree=true compositionAgree=true
reissue-two-run-agreement.json   verdictsAgree=true detailsAgree=true compositionAgree=true
```

No semantic field moved between run 1 and run 2. In particular the PD-42 defect
is stable (same clause fails, same `outcome=succeeded`), and the reissue rows
have the same sequence numbers (8/9 old; 17/18/19/24 new) in both worlds.

## Disclosures (complete list)

1. **DEV-LIVE only.** These records can never produce a V@B=yes or any frozen
   candidate claim; no tags, candidate refs, Authority pointer, upstream tree,
   shared baseline or `:3080` were modified. CORE PATCH BUDGET stayed 0 — only
   `tests/kits/**` and `dev/agent-workflow/evidence/**` changed.
2. **The model is the scripted mock** (`mock-deepseek.mjs`), deterministic and
   not an LLM. A real model would change turn content, not the durable control
   or goal semantics measured here.
3. **`origin/master` moved during the measurement campaign** (`76a86d6e9` at
   branching and at PD-42 run 1 → `c6c96534c` observed from the next run on).
   The measured product SHA is the **branch HEAD**, `76a86d6e9`, identical in
   all six runs (`min-closing-verdicts.json tree.productSha`); each run's
   `tree.masterTipAtRun` records the remote tip at that moment as a fact.
4. **Two independent OS boundaries exist here; do not conflate them.** The
   product's Alpha.5 confined provider is the Python `landlock-prelauncher.py`
   (`sha256 f418831915c624…`, recorded as `selectedRunner` in the instance log).
   The provisioner's `--check` line also reports the DSH host's native sandbox
   asset `landlock-run` (`sha256 a752bc72f111…`, pinned by
   `tests/world-factory/lib/host-sandbox-assets-manifest.json`). The Host default
   is `danger-full-access`, so the host native sandbox is not the refuser; the
   refusal under test came from the product provider's Member realm.
5. **Kit-side capability grants in two arms (disclosed, not shipped defaults):**
   the goal arm adds one `goal-worker` template with no `permissions` block; the
   reissue arm adds `team_follow_up` to the created Leader's `teamTools` allow
   list (otherwise the production closed-world guard refuses it). The A1
   document and the seven-clause path are unchanged when `--min-closing` is
   absent.
6. **`PD42` measures an APPROVED out-of-lane write**, not an unapproved refusal;
   both legs are approved by the Officer wake. This is the previously unmeasured
   conjunction.
7. **The reissue arm requires A6-on** for the settlement path
   (`alpha6RecoverWakeLatches` is defined only when `alpha6Wiring.mode ===
   'alpha6'`). Running it with `--a6-off` would remove the measured behaviour.
8. **Worlds are removed.** Every `DSH_HOME` was torn down by the driver's
   verified path (host + mock stopped; world deleted). The evidence keeps the
   logs and the extracted durable rows, not the live worlds. `tests/homes/` was
   empty after the six runs.
9. **`osLevelNetworkIsolationClaimed:false`**; no network-isolation claim is
   made by any of the three propositions.
10. **No gate movement.** The v4/v5 Blueprint fence is unchanged (the same four
    A1 sites at L761/L1001/L1657/L2045; all new code is after them), and
    `lint-identities --diff` reports no new identity.
11. Run 1 of PD-42 was rerun once: the first invocation ran the A1 path because
    `--min-closing=pd42` was not parsed (instrument bug); that failed attempt is
    **not** in this evidence — the recorded run1 is the corrected invocation.
    The first reissue attempts (no Officer member; then `team_follow_up` not
    bound) are likewise instrument fixes, not product measurements; the
    recorded runs are the ones whose composition is printed in each
    `min-closing-verdicts.json`.

## Reproduction

```bash
K=tests/kits/a1-bash-governance-20261112/a1-bash-governance.mjs
E=dev/agent-workflow/evidence/v016-min-closing-20261113
node "$K" --worktree "$PWD" --testuse "$PWD/tests/deepseek-harness-test-use" \
  --host-port 3187 --mock-port 3496 --min-closing=pd42 --evidence-dir "$PWD/$E/pd42-run1"
node "$K" --worktree "$PWD" --testuse "$PWD/tests/deepseek-harness-test-use" \
  --host-port 3190 --mock-port 3491 --min-closing=pd42 --evidence-dir "$PWD/$E/pd42-run2"
node "$K" --worktree "$PWD" --testuse "$PWD/tests/deepseek-harness-test-use" \
  --a6-off --host-port 3188 --mock-port 3497 --min-closing=goal-a6off --evidence-dir "$PWD/$E/goal-run1"
node "$K" --worktree "$PWD" --testuse "$PWD/tests/deepseek-harness-test-use" \
  --a6-off --host-port 3191 --mock-port 3492 --min-closing=goal-a6off --evidence-dir "$PWD/$E/goal-run2"
node "$K" --worktree "$PWD" --testuse "$PWD/tests/deepseek-harness-test-use" \
  --host-port 3189 --mock-port 3498 --min-closing=reissue --evidence-dir "$PWD/$E/reissue-run1"
node "$K" --worktree "$PWD" --testuse "$PWD/tests/deepseek-harness-test-use" \
  --host-port 3192 --mock-port 3493 --min-closing=reissue --evidence-dir "$PWD/$E/reissue-run2"
for m in pd42 goal reissue; do
  node tests/kits/a1-bash-governance-20261112/compare-min-closing-runs.mjs "$E/$m-run1" "$E/$m-run2"
done
```

## File map

```text
pd42-run1/  pd42-run2/      min-closing-verdicts.json, min-closing-arms.md,
                            mc-pd42-{blueprint,create,delegate,ledger,sandbox-profile}.json
goal-run1/  goal-run2/      min-closing-verdicts.json, min-closing-arms.md, mc-goal.json
reissue-run1/ reissue-run2/ min-closing-verdicts.json, min-closing-arms.md,
                            mc-reissue.json, mc-reissue-ledger.json, a1-officer-wakes.log
*-two-run-agreement.json    the comparator output per mode
```
