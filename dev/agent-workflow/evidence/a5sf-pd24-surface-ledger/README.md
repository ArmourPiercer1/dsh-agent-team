# PD-24 — the governed Member surface ledger (DEV-LIVE)

**Task**: PD24-SURFACE-LEDGER · **lane base**: `6cfc67b76` (= `origin/master` at lane start) ·
**booted heads**: pre-fix + ask pairs on `6cfc67b76`, post-fix pair on `4d4e68abc` (same composition) ·
**pinned Host**: `639ed015397290b3745d163aafe02ffee4aa3f84` (0.2.0-rc.2, read-only
`tests/deepseek-harness-test-use`) · **composition**: the shipped
`cordis.patch.yml`, opt-in preset `a5sf-governed-member` ·
**record class**: DEV-LIVE, `candidateClaimEligibility: false` (no `V@B`, no merge
evidence — a boot is not merge evidence) · **CORE PATCH BUDGET = 0**.

This directory is the evidence for **one question**: a governed Member's
model-visible tool surface was 34 names, and only ~7 of them had ever been
classified by measurement. What is on that surface, what does each name actually
do, which ones cross a boundary **silently**, and how many truly governed native
tools does a governed Member have today?

The answer is a **ledger**, not prose: `ledger.json` (machine, every row with its
measured facts inline), `ledger.txt` (the same rows as a table), `roster.json`
(the measured surface of each boot). `tests/world-factory/drivers/a5sf-pd24-surface-ledger/build-ledger.mjs`
DERIVES the ledger from the boot artefacts and **refuses to emit** if a name is
unclassified, if the two boots disagree on the roster, or if the bucket counts do
not add up — the numbers cannot drift from the rows.

---

## 1. Headline numbers

```
measured roster (pre-fix)  34  =  2 World fixtures (u5_canary, u6fs_probe)
                                 + 32 shipped names
shipped 32 = GOVERNED 7 + SESSION-LOCAL 9 + OTHER-AUTHZ 15 + FAIL-CLOSED 1 (`present`)

identity: 7 + 9 + 15 + 11 + 0 = 42 = 32 (shipped) + 10 (removed by earlier lanes)
          the FAIL-CLOSED bucket (11) = 1 on-roster row (`present`) + 10 earlier removals

post-fix roster 33 = 34 − `present`   (shipped 31)
GOVERNED with LIVE execution evidence: 6 of 7   (`read_image` is host-free only)
```

**One sentence**: a governed Member today has **six** governed native tools it
can actually run (bash, read, write, edit, grep, glob — each one executes on a
confined face and emits an `a5sf-guard-consult` fact), a **seventh** (`read_image`)
that is governed at the face but unreachable on the measured model route, **nine**
session-local tools that write only its own session (one of which — `ask_user_question`
— blocks its turn), **fifteen** `team_*` tools on a different authorization plane,
and **eleven** names that are typed `unknown tool`: ten removed by PD-18/21/22/23
and `present`, removed here.

---

## 2. Method (and why the ASK tool is its own arm)

Two arms, each an agreeing pair of boots (`--boots 2`), plus a third arm for the
one tool that cannot appear in the main turn:

| arm | composition | boots | purpose |
|---|---|---|---|
| `postfix` | shipped `cordis.patch.yml` (HEAD of the lane branch) | `runs/boot01`, `runs/boot02` | the surface as it SHIPS after this lane |
| `prefix` | `archive/pre-fix/cordis.patch.yml` = `git show 6cfc67b76:cordis.patch.yml` | `archive/pair-prefix/boot01..02` | the `present` defect, measured on the SAME code with only the row restored |
| `ask` | shipped composition | `runs-ask/boot01..02` | `ask_user_question`: the call is issued and never settles |

A boot is: a real Host (`dsh web`, port in the 3180 family, `DSH_HOME` under
`tests/homes/`), a real Team (`team.create` with a Leader blueprint), a real
**delegated Member** (`team_delegate`, template `worker`, workspace = the world's
workspace), and a **scripted model** that answers each Member step with exactly one
tool call, in a deliberate order. Everything below is the Member's own session:

* `runs/bootNN/member-surface.json` — the tool names in the Member's **last**
  model request (the surface is measured from the request, not from the preset);
* `runs/bootNN/member-probes.json` — every probe's `call` and its `result`
  (`isError`, `text`) as recorded in the Member's durable session;
* `runs/bootNN/guard-facts.json` — the `a5sf-guard-consult` facts the turn produced;
* `runs/bootNN/counters.json` — surface count, guard facts by tool, goal rounds,
  `deliverables/presented` events by session, proc observations;
* `runs/bootNN/member-transcript.txt` — the rendered session (one line per event);
* `runs/bootNN/summary.txt`, `run-record.json` — the 12 case verdicts.

### 2.1 Why `ask_user_question` could not be in the main turn

The first development boot walked the roster in order and **stopped at
`ask_user_question`**: the call was recorded, no tool result followed, and
`team.create` (synchronous delegation) never returned — the driver's 300 s
transport timeout fired. The Member's session showed the call with no result and
no `turn/end`. That is the measured behaviour, and it is why the tool has its own
arm: a blocking call in the main turn would hide every probe after it.

The ASK arm therefore delegates **asynchronously**, waits for the ask call to
appear in the Member's session, holds a **60 s observation window**, and then
records:

* the in-lane `bash` control settled first (`isError: false`);
* the `ask_user_question` call is present with **no result**;
* `turn/end` count is **0** — the turn is still open;
* no `user/questions` event exists (the question never reached a queue);
* Team membership is still exactly 2 (Leader + worker): no Team state was written.

`runs-ask/bootNN/ask-blocked.json` is that artefact. The window is an
**observation** window, not a product timeout — the legacy `ask` path has none.

---

## 3. The ledger, row by row

The generated table is `ledger.txt`; it is reproduced in
`docs/plans/active/alpha5-sandbox-first/TOOL-ACCEPTANCE-MATRIX.md` §1.8. Read the
JSON for the per-row evidence (`facts`, `probe`, `goalLoop`, `preFix`/`postFix`).

### 3.1 GOVERNED — 7 (confined face + `a5sf-guard-consult` fact)

| tool | face | live? | measured |
|---|---|---|---|
| `bash` | confined terminal (one fresh child per call) | yes | in-lane `cat` ran; 3 allow facts for `bash` |
| `read` | confined `fs` | yes | in-lane read OK; 2 allow facts |
| `write` | confined `fs` | yes | wrote `written-by-member.txt`; 1 allow fact |
| `edit` | confined `fs` | yes | edited `edited-by-member.txt`; 1 allow fact |
| `grep` | confined search (ripgrep in the child) | yes | found the in-lane marker; 1 allow fact |
| `glob` | confined search | yes | listed `*.txt`; 1 allow fact |
| `read_image` | confined `fs` | **NO** | the **model route** refuses first: `model "deepseek-v4-flash" does not declare image input` — the face never runs. Host-free evidence only (PD-17 D5: 1 deny fact, 0 bytes) |

So **6 of 7** GOVERNED rows have live execution evidence; `read_image` is
governed **at the face** but its live branch is a residual (§5).

### 3.2 SESSION-LOCAL — 9 (writes only the Member's own session)

| tool | measured behaviour | boundary? |
|---|---|---|
| `todo_write` | `todo/write` lands in the Member's session only; the Leader's session carries none | none |
| `job_list` | `(no background jobs)` — owner-scoped registry, **no producer exists on this preset** | none |
| `job_output` | the Leader's real job id (`bash-1`) → `Error: job bash-1 belongs to another session` | none (typed) |
| `job_kill` | same refusal; the Leader's job kept running | none (typed) |
| `get_goal` | `{"goal":null}` before create; afterwards the Member's own goal | none |
| `create_goal` | opens a goal **in the calling session** and arms its round driver | none (see 3.2.1) |
| `update_goal` | `complete` accepted (`roundsStarted` 1 → 2) | none |
| `exit_plan_mode` | plan mode **inactive**: `Error: exit_plan_mode is only available in plan mode`, no `plan/mode` event | none (typed); the ACTIVE branch is a residual (§5) |
| `ask_user_question` | **blocks**: no result in 60 s, no `turn/end`, no question event, no Team write | none — but a turn-blocking hazard (§4.1) |

#### 3.2.1 The goal loop DOES start, in the Member's own session

Read straight out of the Member's tool results (both post-fix boots):

```
create_goal   -> {"phase":"active","roundsStarted":0,"maxGoalRounds":2},"activation":"armed"
<goal_round>  -> the mock is asked again inside A's own session
get_goal      -> {"phase":"active","roundsStarted":1,...}
update_goal complete -> {"phase":"complete","roundsStarted":2},"activation":"disarmed"
```

`counters.goalRounds = 2` `<goal_round>` requests, `goalRoundsInOtherSessions = 0`,
and no goal event appears in the Leader's or the other session's event types. The
self-continuation loop is real and **session-local**: it can create and start
rounds in the Member's own session, and `update_goal` can stop it. **Goal
semantics were not touched** (`maxGoalRounds`, pause/edit/complete logic, and the
round driver are PD-25's remit); this lane only established *that* the loop starts
and *where*.

### 3.3 OTHER-AUTHZ — 15 (`team_*`)

`team_archive_member`, `team_collect`, `team_create_member`, `team_delegate`,
`team_follow_up`, `team_grant_permission`, `team_inspect_config`,
`team_list_members`, `team_list_pending_control`, `team_list_templates`,
`team_report_progress`, `team_request_control`, `team_resolve_control`,
`team_revoke_permission`, `team_send_message`.

These mount on the Team tool plane with their own request-token + envelope
authorization; they are **not** on the confined face and do not emit
`a5sf-guard-consult` facts. By instruction this lane did not call them (a single
`team_list_members` sample is issued only to prove the plane answers — no
mutation). The plane's refusal is already characterized elsewhere:
`TEAM_RUNTIME_CALLER_AUTHORITY_DENIED` (PD-21 lane) and the envelope denials in
`evidence/a5sf-team-*`. **Not touched by this lane.**

### 3.4 FAIL-CLOSED — 11 (typed `unknown tool`, zero execution)

Measured in ONE Member turn, each name with `{}`-ish arguments:

| name | removed by | post-fix answer |
|---|---|---|
| `present` | **PD-24** | `unknown tool "present"` |
| `send_message`, `interrupt_agent`, `list_agents`, `skill`, `subagent`, `subagent_fork`, `web_fetch`, `web_search`, `workflow`, `pwsh` | PD-18/21/22/23 | `unknown tool "<name>"` |

---

## 4. The `present` defect, and the fix

### 4.1 What was measured (prefix arm, same code, pre-fix row only)

`present` resolves `fs` from the scope its preset row mounts on — the **registry
generation scope** — which is the **base** `fs`, not the Member's confined fork.
In one delegated Member turn (`archive/pair-prefix/boot01..02`, identical):

| probe | path | result |
|---|---|---|
| in-lane | `…/workspace/in-lane.txt` | `Presented …/in-lane.txt` (accepted) |
| **out-of-lane, existing** | `…/out-of-lane/secret-out-of-lane.txt` | **`Presented …/secret-out-of-lane.txt`** — ACCEPTED |
| **out-of-lane, missing** | `…/out-of-lane/does-not-exist-out-of-lane.txt` | `Error: Cannot present …: file not found. Check the path, create the file if needed, and retry.` |

* `guardFacts.byTool.present = 0` — **zero** `a5sf-guard-consult` facts for all
  three calls (the turn produced 9 facts, all attributed to bash/read/write/edit/grep/glob);
* `deliverables/presented` events: **2**, in **the Member's own session**;
* the Member could therefore (a) read a file outside its compiled read lane, (b)
  enumerate the existence of arbitrary host paths through the `file not found`
  oracle, and (c) write durable events for them — **silently**, because nothing
  refused and nothing was recorded as a boundary crossing.

This is a **governance hole** (`silent success + out-of-bounds`), the same class
as PD-23's `skill` loader.

### 4.2 Why removal, not a confined face (`CORE_SEAM_BLOCKER`)

`present` mounts as a preset row, and a preset row's `ctx` is the registry
generation scope. The Member's confined provider is a **fork in the Member's
isolate**; no composition-level row can be handed that fork's `fs`. Re-parenting
`present` needs a new route-C product row plus a realm-bound provider face
(`confined-present-tool` attached on the `a5sf-realm-row` seam) with its own
allow/deny contract tests — a new capability face, outside this lane's budget and
`CORE PATCH BUDGET = 0`. The honest disposition is therefore **fail-closed
removal**, disclosed as a **capability regression**: a governed Member can no
longer declare deliverables.

`cordis.patch.yml` change (surgical, one row):

```diff
-          - id: present
-            name: '@deepseek-ai/dsh-tool-present'
```

Nothing else in the preset moved: the retained rows are asserted untouched by
`PD24-SURFACE-POSITIVE-CONTROL`, and the **standard** preset still declares
`present` (`PD24-SURFACE-SURGICAL`) — this is a governed-row removal, not a
product removal.

### 4.3 What the Member sees now (post-fix pair)

* `present` is **not** on the surface (`counters.presentOnSurface: false`,
  roster 33);
* calling it → `Error: unknown tool "present"`, `isError: true`, **zero**
  `deliverables/presented` events in any session, **zero** facts (no face ran);
* the whole 11-name fail-closed set answers typed `unknown tool` in one turn.

### 4.4 Status of `ask_user_question` (measured, deliberately NOT removed)

`ask_user_question` **blocks a delegated Member turn indefinitely** (no result at
60 s; the first development boot held `team.create` for 300 s). It writes no Team
state and crosses no boundary, so it is **not** a silent-success-out-of-bounds
row; this lane's instruction is to act only on those. It is recorded as a
separate, measured hazard: a governed Member (or a Leader delegating to it) can
wedge its own turn forever with no timeout. Recommended follow-up (not done here):
have the ask path refuse with `DELEGATED_CALLER` when the caller is owned, or
bound the legacy wait. The source already contains `assertLiveRoot()` → 
`DELEGATED_CALLER` for the owned-caller case, so the question is whether the
delegated Member's execution context reaches it — the measured answer is that the
call does **not** refuse, it waits.

---

## 5. UNMEASURED — 0 rows, 3 residual branches

No name on the measured roster is unclassified. Three **branches** of classified
rows remain unmeasured, each with exactly what is missing:

| row | branch | what is missing to measure it |
|---|---|---|
| `read_image` | live execution through the confined face | a model route that **declares image input**. The measured route (`deepseek-v4-flash`) refuses before the face. Face behaviour is host-free evidence (PD-17 D5). |
| `exit_plan_mode` | plan-mode-**active** branch | a seam that can set `plan/mode` active on a **delegated** Member session. `/plan` is a session-level user command; the Team tool plane exposes no command route. |
| `ask_user_question` | answered branch | a human (or scripted) answerer bound to the Member session. Only the no-answerer branch is reachable for a delegated turn — and that is the branch that matters here. |

`team_*` is not "unmeasured" but **out of remit**: it is a different
authorization plane, already characterized, and this lane must not measure or fix it.

---

## 6. Agreement and mutation controls

`runs/agreement.json`, `archive/pair-prefix/agreement.json`,
`runs-ask/agreement.json` — every verdict and every measurement of the pair is
compared field by field. **Process-sighting counters**
(`confinedTurnLaunchers`, `baseBwrapWithMarkers`) are excluded from the agreement
test: they count short-lived launcher processes and are racy by construction;
they are recorded as observations, not as verdict inputs. (The first pre-fix pair
was re-run for exactly this reason, and its `differing: ["confinedTurnLaunchers"]`
is kept in `archive/prefix-*` rather than hidden.)

`tests/world-factory/a5sf-pd24-mutation-controls.mjs` drives four arms and asserts
each one's own colour (`mutation-controls.log`):

| arm | expectation | observed (`mutation-controls.log`) |
|---|---|---|
| CLEAN | all green | **PASS** (6/6 tests green) |
| M1 `A5SF_PD24_MUTATE_REGISTER=present` (register a dispatchable `present`) | **RED** on `PD24-TYPED-REFUSAL` only | **PASS**: exactly `PD24-TYPED-REFUSAL` red, the other five green |
| M2 `A5SF_PD24_COMPOSITION=archive/pre-fix/cordis.patch.yml` | **RED** on `PD24-SURFACE-CLOSED` only | **PASS**: exactly `PD24-SURFACE-CLOSED` red; the refusal arm stays green (it measures the router, not the composition) |
| PIN `A5SF_PD24_PIN=1` (read `6cfc67b76:cordis.patch.yml` from git) | green, and the archive is byte-identical to that file | **PASS**: `PD24-PIN` green, byte-identity asserted |

The `PIN` arm is what makes the prefix evidence reproducible after the row is
gone: the pre-fix composition is read out of git, not out of the working tree.

---

## 7. Residuals and limits (read this before citing the numbers)

1. **A boot is not merge evidence.** DEV-LIVE, `candidateClaimEligibility: false`.
   No `V@B` is derived from this directory.
2. **One Host, one model route, one workspace shape.** The surface is measured on
   the shipped preset; a different model route changes `read_image`'s live branch
   only.
3. **The scripted model drives the probes.** It answers one tool call per step
   from a fixed script; the *tool* behaviour measured is real, the *choice* of
   calls is scripted (and therefore reproducible).
4. **`bash`'s dynamic-read sub-path is ungoverned by design in L1**: values
   produced by `$(…)`/backticks are not lexically attributable, so a shell that
   reads a path computed at runtime is not stopped by the L1 admission check.
   That is a known, documented property of the L1 axis, not a PD-24 finding; the
   probe `cat`ed a literal in-lane path.
5. **`job_*` has no producer on this preset**: the confined face cannot hand a
   command to the job registry, so `job_list` is always empty for a Member. It is
   retained because it is owner-scoped and typed; removing it would be a
   capability regression with no security gain.
6. **`present` removal is a capability regression.** Restoring deliverables needs
   the confined face described in §4.2; until then a governed Member has no way
   to declare deliverables. Recorded in the product-debt register as PD-24.
7. **The ASK arm's 60 s window is an observation, not a timeout.** A slower
   answerer does not change the finding: the call did not settle and the turn
   stayed open.
8. **Two development iterations are kept, with their verdicts.** `archive/dev-ask-hang-300s/`
   is the FIRST boot of this lane: it ran the old probe order, reached
   `ask_user_question`, and `team.create` was still open when the driver's
   300 s transport timeout fired (`abortedAt=team-create`) — that is the 300 s
   number quoted in §2.1 and §4.4. `archive/dev-prefix-proc-disagreement/` is the
   first pre-fix pair, whose only disagreement was the racy process-sighting
   counter (`differing: ["confinedTurnLaunchers"]`), kept rather than hidden.
   Every other iteration was superseded and removed; the host instance logs of
   the two canonical pairs' first boots were pruned during that tidying (the
   Member-side artefacts — transcript, probes, facts, counters, run-record — are
   complete; no run record binds a log path).
9. **What could make THIS evidence wrong (two classes, both observed here).**
   *An artefact can look authoritative while describing an ARM that no longer
   exists.* The first pass wrote every arm's `agreement.json` to the evidence
   root, so the post-fix pair's file was silently replaced by the ask arm's; the
   file was well-formed, stamped, and about the wrong pair. That is why each arm
   now writes `<runs>/agreement.json` next to the boots it compares (and only a
   per-arm copy at the root).
   *A record can bind a COMMIT nobody can check out.* This lane amended its
   commit after the post-fix pair had booted, which rewrote the commit the two
   `runs/boot0*/run-record.json` files named: locally the object still existed,
   on the remote it did not, and `eb3-run-manifest` refused it
   (`RUN_SOURCE_UNRESOLVED … is not a commit in this repository`). The records
   were **re-bound by re-running the pair at `4d4e68abc`** and committing them
   WITHOUT amending (an amend would have rewritten that commit too); every
   committed record now names a commit that exists on the remote:
   `runs/*` → `4d4e68abc`, `runs-ask/*` + `archive/pair-prefix/*` +
   the two dev iterations → `6cfc67b76`. **Never hand-edit `teamSha`**: a
   rewritten binding is worth less than no binding.
   The same rule is why this README quotes numbers that a reader can re-derive:
   if a cited digest, roster or fact count cannot be recomputed from the
   committed artefacts, the artefacts are wrong, not the prose.

---

## 8. Repro

```bash
# post-fix agreeing pair (needs the pinned host tree + the dev-live slot lease)
node tests/world-factory/drivers/a5sf-pd24-surface-ledger/run-boot.mjs --boots 2

# pre-fix pair: ONLY the removed row is restored, from git, not hand-edited
git show 6cfc67b76:cordis.patch.yml > dev/agent-workflow/evidence/a5sf-pd24-surface-ledger/archive/pre-fix/cordis.patch.yml
A5SF_PD24_COMPOSITION="$PWD/dev/agent-workflow/evidence/a5sf-pd24-surface-ledger/archive/pre-fix/cordis.patch.yml" \
  node tests/world-factory/drivers/a5sf-pd24-surface-ledger/run-boot.mjs --arm prefix --boots 2

# the blocking-ask arm (deliberately ends with an open turn)
node tests/world-factory/drivers/a5sf-pd24-surface-ledger/run-boot.mjs --arm ask --boots 2

# derive the ledger/roster/table from the boots; it REFUSES inconsistent counts
node tests/world-factory/drivers/a5sf-pd24-surface-ledger/build-ledger.mjs

# host-free pins + mutation controls
node --test tests/world-factory/a5sf-pd24-surface-ledger.test.mjs
A5SF_PD24_PIN=1 node --test tests/world-factory/a5sf-pd24-surface-ledger.test.mjs
node tests/world-factory/a5sf-pd24-mutation-controls.mjs
```

Digests: `ledger.json#digests` pins the pre-fix composition, the post-fix
composition, and the driver that produced the boots.
