# PD-34 — MEMBER-STOP: the team view can now stop ONE Member, and the stop is the one PD-30 measured

Lane `PD34-MEMBER-STOP`. Branch `task/pd34-member-stop-20261115`, worktree
`.worktrees/pd34-member-stop`. Base `origin/master` = **`3101ca08f`** (`PD32-INSTRUMENT-GRAPH`, #681; the
tree also carries PD-30 #679, PD-31 #680 and the web preview #678). Host pin **0.2.0-rc.2 @
`639ed01539`**, read-only. Evidence class **DEV-LIVE** (two agreeing boots, slot-leased `MemberStop`
face on the 3180 family, `DSH_HOME` under `tests/homes/`, `:3080` never touched, host tree
porcelain `empty` before/after). **`CORE PATCH BUDGET = 0`** — no upstream file is imported for
modification, patched or vendored.

**What this lane did NOT change.** The stop MECHANISM is PD-30's (#679): `interrupt` cancels and
performs the durable CAS `goals.pause` + `goals.disarm`, and the host goal-round driver aborts a
turn whose goal the host paused. This lane adds the missing **operable entry** in the Team view and
the client sequence behind it. It introduces **no new host method**, changes **no goal-driver logic**
and does not touch the §40 lifecycle matrix.

## 1. What was missing

The Preview verdict is `PREVIEW-NO-GO`, and this is one of its two must-fix items: a governed
Member's goal is real and stoppable (PD-30 measured 0 rounds / 0 calls / 0 model requests in a
20 000 ms window after the right RPCs), but the Team view had **no first-class "stop this Member"
control**. The only per-Member controls were the §40 lifecycle actions — `发送消息 / 发送跟进 /
归档 / 处置` — and Archive *ends* the Member (drains, then `ARCHIVED`) instead of pausing its goal.
A human could therefore not exercise the measured mechanism at all, and the only path that looked
like "stop" was Leader-wide: stopping the Leader's turn, which PD-30's S5 measured does **not**
propagate to already-delegated Members (+14/+13/+13 rounds on three Members after the root turn
aborted).

## 2. What this lane adds (client-side, no product mechanism change)

| File | Change |
| --- | --- |
| `packages/client/src/model/member-stop.ts` | **NEW.** The pure stop sequence: `goals/get` → `goals/pause` (only when `active`, with the `{id, revision}` CAS from the first read) → `session/cancel` → `goals/get`. Typed outcomes (`stopped` / `no-goal` / `already-inactive` / `read-refused` / `pause-refused` / `unavailable`), and a separate `stopLeaderTurn` that is **cancel-only**. No React, no I/O. |
| `packages/client/src/plugin/team-mount-core.ts` | injects the two **public** namespaces the sequence rides (`remote.goals`, `remote.session` — the goal bar's own proxies) and exposes `memberCommands.memberStop` / `memberCommands.leaderStopTurn`. No private `/team-remote` method. |
| `packages/client/src/ui/TeamMembers.tsx` (+ `.module.css`) | the per-Member control (`data-member-stop`, "停止此成员 / Stop this Member") below a **live** row that has a bound `childSessionId`, and the **distinct** Leader control (`data-leader-stop`, "停止 Leader 当前回合 / Stop the Leader's current turn") on the Leader row with copy that says delegated Members are unaffected. The note renders the phase the **second read** observed, or the typed refusal verbatim. No optimistic local patch; the §40 command state is untouched. |
| `packages/client/src/ui/locales.ts` | both dictionaries (zh + en) for the two semantics; the Leader keys are deliberately different keys, not shared copy. |
| `packages/client/test/member-stop-model.test.ts` | **NEW.** The wire sequence, the CAS ref, and the negative controls (refused pause → no claim and no cancel; refused read → no cancel; re-read `active` is reported as `active`; detach/refusal on the cancel still keeps the durable stop). |
| `packages/client/test/team-member-stop.client.spec.tsx` | **NEW.** jsdom, real component: the control exists only on live rows with a child session, the click calls the face with the Member's own `childSessionId`, the note shows the observed phase, the Leader entry calls only `leaderStopTurn`, and a missing face renders no control. |
| `packages/client/test/client-plugin-mount.test.ts` | a mount-level test that the face reaches the public `goals`/`session` doubles (get → pause → cancel → get) and never the frozen `/team-remote` carrier. |
| `tests/world-factory/drivers/a5sf-pd34-member-stop/run-boot.mjs` | **NEW.** The live arm, cut from the PD-30 driver (same harness, blueprints and scripted mock), with S1 rewritten to issue the UI's four RPCs and to judge the Member's own durable log. |
| `tests/world-factory/a5sf-pd34-member-stop.test.mjs` | **NEW.** Host-free pins: sequence order, inject list, both controls + distinct copy, driver order, no local patch, a mutation control, and the base pin. |

Why `pause` **before** `cancel`: pausing withdraws continuation authority (so the next round cannot
start) and the host driver aborts a host-paused live turn; the explicit `session/cancel` then covers
the turn still winding down. The reverse order leaves the "next round starts between the cancel and
the pause" race open. `pause` after a refused pause is never issued — a cancel-only path would let a
still-active goal continue, which is the failure the entry exists to prevent.

## 3. The measured acceptance (agreeing two-boot pair)

`agreement.txt` / `agreement.json`: **6/6 cases, both boots (`--arms s8,s1,s6,s7 --boots 2`), all
agree** — the stop, its resume, the cold-recovery survival, the two controls and the terminal
phases in ONE pair. Runs `runs/boot01` / `runs/boot02`, started `20:57:16Z`, driver finished
`21:04:07Z` (real UTC 2026-11-08), composition `cordis.patch.yml` sha256 `0774297f7e90b2…`,
instrument commit **`dc797c038`** (the merged head; the earlier stop-only pair was taken at
`3101ca08f` and its numbers are unchanged). Every arm is judged on the **Member's own durable
session log** plus the mock's request log — never on an RPC's 200.

| Arm | Condition | boot01 | boot02 |
| --- | --- | --- | --- |
| S8-continue | control: an **un-stopped** goal keeps driving automatic rounds | rounds on `lead` = 3 | 3 |
| **S1-UISTOP** | a governed Member at **round 3** (`callsBefore=4`, long 4 s round in flight); the UI's four RPCs from outside the Member: `goals/get` (active rev1) → `goals/pause` (CAS rev1→rev2) → `session/cancel` (200) → `goals/get` | pause **200 / ok**, cancel **200**, second read **`paused` rev2**, activation **armed → disarmed**; **0 rounds / 0 tool calls / 0 model requests** in **20 000 ms**; phase after the window **`paused`**; `revived=false`; Member lifecycle **`SETTLED`** (not archived) | identical (goal rev1→2, `paused`, 0/0/0, `revived=false`, `SETTLED`) |
| **S1-RESUME** | one explicit `goals/resume` (CAS rev2→rev3) after the window | **200 / ok**, phase `active` rev3, activation **armed**, **exactly 1 round** resumed | identical (rev2→3, `active`, 1 round) |
| S8-terminal | control: the round-limited (`max_goal_rounds: 1`) Member blocks and starts nothing | blocked after 1 round, 0 rounds after a pause | same |
| **S6-cold** | the anti-revival requirement: stop a **different** Member (`s2`, never resumed) through the same four RPCs, then SIGTERM + restart on the same `DSH_HOME` | durable **`paused`** after restart (rev2, same goal id), **0 rounds** after the restart, `revived=false` — see §3.2 | same |
| **S7-resume** | one explicit `goals/resume` on the recovered `cold` Member | accepted, exactly 1 round, then `complete` ends it | same |

Durable trail (both boots): goal `create` rev1 `active` `activation:armed` `roundsStarted:3` → goal
`pause` rev2 `paused` `activation:disarmed` at the stop → goal `resume` rev3 `active`
`activation:armed`, and the second `goals/get` (the value the UI renders) read rev2 `paused`.
`runs/boot01|02/arms.json` carries every field the table quotes; `member-facts.json` is the durable
session log and `mock-requests.json` the request log the filters ran over.

### 3.1 Honest limits of THIS measurement (disclosed, not implied)

1. **The DOM was NOT clicked in a real browser.** The driver has no browser. It issues the **exact
   four wire calls** the button's handler issues, through the same public client namespaces
   (`packages/client/src/model/member-stop.ts`), and the host-free `PD34-DRIVER-WIRE` pin asserts
   the driver block and the model spell the same order. The **click itself** is covered by
   `packages/client/test/team-member-stop.client.spec.tsx` (real component + jsdom + fireEvent):
   the button renders, the handler runs, the face is called with the Member's `childSessionId`, and
   the observed phase is rendered. What is *not* proven is a browser→Host click end to end; nobody
   should read this README as that claim.
2. **The model is the shared scripted mock**, not a live LLM. The goal machine, the host goal
   service, the goal-round driver, the preset row, the confined terminal face and the Team
   lifecycle are real; the turns are scripted.
3. **Instrumentation disclosure.** The first (single-boot) attempt of this driver reported
   `rounds after stop = 1`: that counter was read **after** the resume, so the resumed round was
   counted as a post-stop round. The driver now snapshots the window-scoped counters **before** the
   resume (`roundsAfterWindow` / `callsAfterWindow` / `requestsInWindow`) and the verdict reads
   those. A later full-arms boot on the merged head then failed `pd34:cold-recovery-no-revival`
   because that clause still read the **resumed** `s1` (§3.2); the arm was fixed, and two
   intermediate runs afterwards are also in `run-ledger.jsonl`. All superseded runs are append-only
   rows; no number above comes from them, and `runs/` holds only the reported pair.
4. **Leader non-propagation is cited from PD-30, not re-measured here.** This lane's S5 is not run;
   the measured +14/+13/+13 rounds is PD-30's (#679) evidence, and the Leader entry's copy is built
   on it.

### 3.2 Cold recovery: the stop survives SIGTERM + re-materialisation (and the first version of this clause was mis-wired)

The phase forbids one regression above all: **after an explicit stop, no automatic round ever
starts again, including cold session re-materialisation.** Measured on the merged head
(`edca478bd` + this lane, forward-merged, not rebased), both boots agree:

| Step | boot01 | boot02 |
| --- | --- | --- |
| Member `s2`, **not** previously stopped, at round 94 / 95, stopped through the SAME four RPCs (`get` → `pause` → `cancel` → `get`) immediately before the SIGTERM | `active` → pause 200/ok (rev2) → `paused` | same (rev2) |
| SIGTERM, Host re-booted on the SAME `DSH_HOME` (`bootPhase: resume`, team domain adopted) | members all `SETTLED` | same |
| durable goal projection after restart | **`paused`** (rev2, `roundsStarted` 94, id unchanged — no new goal) | **`paused`** (rev2, 95) |
| live `goals/get` after restart | `null` — the re-materialised child is `SETTLED` and has **no live agent** until its first post-restart turn, so there is nothing to read; `null` cannot mean "active" | same |
| goal rounds after the restart (`cold` follow-up turn + 20 000 ms) | **0** | **0** |
| `revived` (the recovered `cold` Member's own active goal) | **false** | false |

**The failure the main agent saw on `dc797c038` was my arm, not the control.** This arm used to
read `sessionFacts(sessionOf.s1)` as its "still stopped" witness — a leftover from the PD-29
layout, where `s1` was stopped and **never resumed**. When this lane rewrote S1 into the UI stop,
it also added the required resume clause (`goals/resume` restores exactly 1 round), so by the time
S6 ran, `s1`'s last durable change was the **resume** — phase `active`, by design. The clause then
reported `phase=active` and called it a defect: it was measuring a Member its own driver had
deliberately resumed. Exactly the "most important clause was wrong" case, and it reproduced on
both boots, deterministically, at `3101ca08f` too — it is not merge-induced and not flaky.

**The rule this is an instance of: a clause inherited from another driver carries that driver's
preconditions with it.** This clause carried "s1 is never resumed". Copying a verdict clause is
copying a scenario, and when the scenario changes underneath it, the clause does not fail loudly —
it keeps passing or starts failing about a Member that is no longer the subject. Two consequences
for future arms: state a clause's preconditions next to the clause (here: "the witness Member is
stopped and never resumed"), and when an arm's own behaviour changes, re-read every inherited
clause that reads that arm's Member.

**The rule about live reads after a restart (do not re-learn it):** a re-materialised child is
`SETTLED` and has **no live agent** until its first post-restart turn, so a live `goals/get` on it
legitimately returns "no goal". **`null` must never be read as `active`; only an observed `active`
may refute a stop.** Future cold-recovery clauses should assert the durable projection plus the
round count, and treat the live read as refutation-only.

The fix stops a Member **inside** S6 through the same four RPCs, **never resumes it**, and asserts
the durable phase plus the round count after restart; `s1` is still recorded, marked
`informational only — the S1 arm resumes it by design`, and is never asserted. Two intermediate
runs are in `run-ledger.jsonl` (append-only): the first exposed the mis-wiring, the second exposed
a second-order version of the same mistake (the live `goals/get` returned `null` for a `SETTLED`
child and the clause demanded the string `paused`). The reported pair is the third, and the only
one whose clauses are the ones in the driver today.

## 4. Gates

| Gate | Result |
| --- | --- |
| `packages/client` `tsc -p tsconfig.json` (src + test) | clean |
| `packages/client` vitest, full package | 937/940 pass; the 3 failures (`team-creation-panel` ×2, `team-governance` ×1) reproduce **identically on the lane base with this lane's changes stashed** — pre-existing, not caused here |
| `member-stop-model.test.ts` / `team-member-stop.client.spec.tsx` / `client-plugin-mount.test.ts` / `client.test.ts` | pass (10 / 6 / 51 / 3) |
| `npx eslint` on every changed file | 0 errors |
| `packages/testkit` p4t6 session-event scan | **20/20** after booking `packages/testkit/test/p4t6-bookings/a5sfpd34.json` (`expectedDelta` 1449 → 1451; the measured unbooked reading `scanner counts 1451, ledger derives 983 + 466 = 1449` is in the booking's `tieNote`) |
| `node --test tests/world-factory/a5sf-pd34-member-stop.test.mjs` | 8/8 |
| live pair | **RESULT PASS (2/2 boots; agreeing pair=true)**; host porcelain `empty`; slot released |
| `--plan` | `PLAN OK` (governed preset 17 plugins incl. `tool-goal`, `tool-ask-user` absent; both blueprints parse) |

## 5. Reproduce

```bash
# host-free shape pins + the plan
node --test tests/world-factory/a5sf-pd34-member-stop.test.mjs
node tests/world-factory/drivers/a5sf-pd34-member-stop/run-boot.mjs --plan

# the measured pair (slot-leased; ~3 min/boot; :3080 untouched)
node tests/world-factory/drivers/a5sf-pd34-member-stop/run-boot.mjs --arms s8,s1 --boots 2

# the client half
cd packages/client && npx vitest run test/member-stop-model.test.ts test/team-member-stop.client.spec.tsx
```

## 6. Remaining product limits (also in `docs/PREVIEW-STOP-SEMANTICS.md`)

1. **Stopping the Leader's turn does not stop delegated Members.** Preview's Stop is per-Member;
   the Leader control is turn-only, and its copy says so.
2. **The idle window between rounds is a race.** Aiming a stop at the boundary is microsecond-wide;
   PD-30's S3 landed 6/6 aimed attempts, but that is a measurement, not a synchronization
   guarantee. Pausing first narrows the window; it does not remove it.
3. **No trustworthy global round budget.** Preview accepts the absence of a trusted total-round
   limit; the Member keeps upstream's editable `maxGoalRounds`, and Stop is the hard stop.
4. **Stop ≠ Archive.** Stop pauses the goal and keeps the Member; Archive ends the Member. The
   §40 lifecycle matrix is unchanged, and the two entries are intentionally different.
5. **No control without a live row.** A Member with no bound `childSessionId`, or an
   `ARCHIVED`/`DISPOSED` row, renders no stop entry (the client does not derive an id and does not
   pretend to act on a Member it cannot address).
6. **Resume is explicit.** A stopped goal stays paused; one `goals/resume` restarts exactly one
   round (measured), and then the goal continues by the normal rules.

## 7. Register / row id

Register row **PD-34** (`docs/plans/active/alpha5-sandbox-first/PRODUCT-DEBT-REGISTER.md`,
`### PD-34 (MEMBER-STOP)`). The register's gate enforces contiguous ids in document order; on the
lane base the rows end at **PD-32** because the **PD-33** row lived on PR **#682**
(`task/pd33-preview-e2e-20261115`), open at evidence time. This lane therefore wrote **PD-34** and
**did not renumber or fake a gap**. **#682 has since merged as `edca478bd`** and this branch
**forward-merged** `origin/master` — a merge, not a rebase, so the six-boot evidence binding to
`3101ca08f` survives — and the gate's contiguity leg is now **green (10/10 register legs)**.

## 8. Timing guarantee (added after external review)

Stop is **not instantaneous**: between the click and the durable `pause` landing there is a
millisecond-scale window in which a call can be admitted, and a call admitted before the pause can
complete after it. The only defensible guarantee is **"no new round after `goals/pause` is
acknowledged"**, not "no execution after the click" — the closure condition is the pause ACK plus
the durable `paused` read by the second `goals/get`, which is also what the UI renders. The UI copy
says exactly that and promises nothing earlier. `docs/PREVIEW-STOP-SEMANTICS.md` §2.1 states it, and
the E2E lane (#682) measured the same window independently.
