# A6 COLD-WAKE: Leader→Officer restart briefing — measured as an operator procedure (PD-44)

**Lane** `task/a6-cold-wake-nudge-20261113` · **base** `1f31539bd` (PR #755, `task/a6-cold-wake-20261113`, which itself merged `origin/master` `28b083d9a`) · **host baseline** `0.2.0-rc.2 @ 639ed015397290b3745d163aafe02ffee4aa3f84` · **evidence class** DEV-LIVE · **CORE PATCH BUDGET = 0** (product code unchanged; this lane is instrument + documentation only) · **date** 2026-11-13.

**Question.** PD-44 `COLD-WAKE` measured that after a SIGKILL with a live wake-intent row, the create-or-open restart recovers every durable fact but the wake plane goes silent: a new governed ask stays `pending`, no `[team-review-wake]` names it, `team_follow_up` to the crashed Member is admitted-but-inert, and only the operator can decide. The owner's question for this lane is **not** "is there a wake" — that is settled — but whether the **restart procedure the owner proposes actually recovers approvals**, measured as an **operator procedure**, step by step:

1. the Leader prompts the user to handle `user-approval` requests (surfaced first, not silently waited on);
2. the Leader resolves every ask it can resolve itself;
3. the Leader sends a restart briefing to the Officer;
4. the Leader messages members normally to pull work back up.

**What "works" means here.** A leg is recovered only when it is **durably decided** (`control-decision-recorded`) with the **intended decider** as `decider` — never merely answer text, never merely an admitted message.

---

## 1. Verdict

**The flow works — all four steps, each measured on a real Host, two runs per arm.** After a cold restart:

| step | measured outcome (two runs unless noted) | verdict |
| --- | --- | --- |
| 1. surface `user-approval` to the human | leg durably listed after the restart (`count: 1`, `kind: user-approval`); the **Leader's** `team_resolve_control` is **refused** with `CONTROL_RESOLVER_NOT_AUTHORIZED … role 'leader' is not a resolver for kind 'user-approval' (allowed: [human])`; the **human** decides (`decider.kind: human`) | **PASS** (2/2) |
| 2. Leader closes what it can | post-restart `leader-approval` leg: Leader `team_resolve_control` → **`200`, no refusal**, `control-decision-recorded` with the **Leader instance** as `decider`; the leg class needs **no** Officer | **PASS** (2/2) |
| 3. Leader briefs the Officer | `team_send_message` → Officer: admitted (`status: delivered`), starts a real model-visible turn (`nudgeTurns: 3`), `team_list_pending_control` → `team_resolve_control`, durable decision with the **Officer instance** as `decider` in **253 / 251 ms** | **PASS** (2/2) |
| 4. message members, pull work up | `team_send_message` to the **crashed** Member: admitted (`delivered`), a real turn runs the governed bash probe, and a **new durable ask** is minted for that member | **PASS** (2/2) |
| control (a) same nudge, no restart | healthy settled Host: message admitted, relay turn runs, decision lands with the **Officer** in **503 / 502 ms** — **but** the approval wake also fires and wins the race (`wakeNamedNew: true`, the relay's own resolve is refused `CONTROL_REQUEST_DECIDED`) | **PASS** (2/2, disclosed) |
| control (b) restart, no nudge | **starves**: 65 173 / 65 194 ms window, **no** decision, no turn for the new leg, `decidedBy: operator` | **PASS** (2/2, PD-44 reproduced) |

**The authority does not drift.** The pre-crash request row is **byte-identical** after the restart (`sameRowIdentical: true`), and the post-restart leg carries the same `kind`, `reviewAuthority`, `perEffectRequiredAuthorities`, `blueprintContentHash`, `blueprintRevision`, `authorityGeneration` and `operationToolDefinitionIdentity` (§3). What goes silent is the **wake**, not the authority — so the owner's hypothesis "the authority an ask requires may change after a cold start" is **not supported** for this leg class: the post-restart leg (a) still names the same decider class, it does not (b) become operator-only and it has not (c) lost the information needed to decide who may decide.

**Severity: PD-44 drops from "approval unreachable" to "requires a deliberate restart briefing".** The gap is *automatic* re-driving; the four steps above close it with the human in the loop exactly where the durable rules require the human.

---

## 2. The four-step flow, step by step, with what each guarantees

The sequence below is what a Leader should actually do after a cold boot. Each step names **what is guaranteed**, **what needs the human**, and **what may refuse** — the last column is the measurement that made step 1 and step 2 a *split* instead of one "Leader closes everything" move.

### Step 1 — surface the human's legs first

```
team_list_pending_control                       # read the durable pending set
# for every entry with kind == "user-approval":
#   tell the user, by exact requestId, that ONLY they can decide it
# do NOT call team_resolve_control on it as the Leader
```

* **Guaranteed:** the leg is durably listed after the restart, with its `requestId`, `kind`, `targetInstanceId` and `approvalCaseId`.
* **Needs the human:** the decision. `user-approval` is resolvable by `human` only.
* **Refuses:** the Leader's resolve → `CONTROL_RESOLVER_NOT_AUTHORIZED ControlService: role 'leader' is not a resolver for kind 'user-approval' (allowed: [human])` (measured, both runs).
* **Falls through to the human:** every `user-approval` leg, and any escalation leg (`control-escalation-recorded`) — by construction, not by restart.

### Step 2 — close every leg the Leader is allowed to close

```
team_resolve_control { requestId: <pending leader-approval id>, decision: "allow" }
```

* **Guaranteed:** accepted (`200`, no refusal) and durably recorded **with the Leader instance as `decider`**; the same durable authority the leg carried before the crash (the request row is not rewritten by the boot).
* **Needs the human:** nothing for this class.
* **May refuse:** a kind the Leader is not a resolver for — `user-approval` (step 1) and escalation legs. Measured: **0** refusals on `leader-approval`, **1/1** refusal on `user-approval`.
* **Quantified:** in both step-2 runs the Leader closed **1 of 1** pending `leader-approval` legs itself (`nudge` never needed: `nudge.tool: "skipped"`, `nudgeTurns: 0`).

### Step 3 — brief the Officer for whatever is left

```
team_send_message {
  recipientInstanceId: <officer instance>,
  subject: "restart briefing — pending control request",
  body: "…pending request <requestId> is still undecided… process it now…
         1. Was that sudden stop caused by something going wrong in the trajectory?
         2. How should the next approval go?"
}
```

* **Guaranteed:** admitted (`status: delivered`, `deliveredToInstanceId` = the addressed instance), a real **model-visible** turn starts (`nudgeTurns: 3` model requests; the relay header is `[team-relay] from=inst-leader (label: leader) to=<officer>`), the Officer reads `team_list_pending_control`, calls `team_resolve_control` with the exact id, and the decision is durable with the **Officer instance** as `decider` — **253 / 251 ms** after the message.
* **Needs the human:** nothing extra. If the Officer does not decide, the operator remains the fallback — and that outcome is a finding, not a silent success.
* **May refuse:** nothing measured; the message path does not depend on the wake plane.
* **Note (attribution):** on a *healthy* Host (control (a)) the wake also fires and decides first; after a restart the wake names only the **old** leg (`wakeTurns: 1`, `namesNewRequest: false`) so the nudge's decision is sole-caused by the message in the restart arms.

### Step 4 — pull the work back up by messaging the members

```
team_send_message {
  recipientInstanceId: <crashed member instance>,
  subject: "restart: pull the work back up",
  body: "<new unit of work — NOT a follow-up on the dead unit>"
}
```

* **Guaranteed:** the message cold-resumes the member session, starts a real turn, and the new governed bash ask mints a **new durable request** (`control-request-recorded` for the same member template, measured `ctrl-1o4q…` in run `mw-1`).
* **Needs the human:** nothing.
* **May mislead:** `team_follow_up` on the **old** unit stays admitted (`200`) and starts **no** turn — its `200` is not "the work continued" (measured in every restart arm: `followUpProducedTurn: false` before a fresh unit is created).
* **Falls through to the human:** none at this step.

---

## 3. Authority drift — field-by-field, same leg, pre-crash vs post-restart

The direct test of the hypothesis. `authorityComparison` is captured in every restart run: the **same** request row is read from the ledger before the SIGKILL (`preCrashLeg1`) and after the restart (`leg1AfterRestart`), and the **post-restart new leg** of the same class is compared next to it (`postRestartLeg2`). Values below are from `run-lm-1` and are identical in `run-lm-2`, `run-none-1/2`, `run-probe-1/2` (the `sameRowIdentical` flag is `true` in all eight restart runs).

| field | pre-crash leg 1 | leg 1 after restart | post-restart leg 2 |
| --- | --- | --- | --- |
| `kind` | `leader-approval` | `leader-approval` | `leader-approval` |
| `toolName` | `bash` | `bash` | `bash` |
| `actionName` | `parameter-permission` | `parameter-permission` | `parameter-permission` |
| `reviewAuthority` | `leader` | `leader` | `leader` |
| `perEffectRequiredAuthorities` | `["leader"]` | `["leader"]` | `["leader"]` |
| `blueprintContentHash` | `sha256:15810fa8…` | `sha256:15810fa8…` | `sha256:15810fa8…` |
| `blueprintRevision` | `1` | `1` | `1` |
| `authorityGeneration` | `0` | `0` | `0` |
| `operationToolDefinitionIdentity` | `def#36` | `def#36` | `def#36` |
| `operationOwnerTemplateId` | `w-probe` | `w-probe` | `w-probe` |
| `legOrdinal` | `1` | `1` | `1` |
| `targetInstanceId` | `inst-1nlynn819ptz` | `inst-1nlynn819ptz` | `inst-0uur2xg1rruk` (always a per-run id) |
| `approvalCaseId` | `case-1ihuv8z0…` | `case-1ihuv8z0…` | `case-1qr5q4j1…` (per request) |

**Reading:** the durable row is **untouched by the boot** (`sameRowIdentical: true` — every field, including `sequence` and `createdAt`), and a leg of the same class minted *after* the restart carries the **same** decider class and the same `perEffectRequiredAuthorities`. `targetInstanceId`/`approvalCaseId` differ only because they identify a different member instance and a different request. The post-restart leg therefore **(a) still names the same decider class**; it does **not** become operator-only and it does **not** lose the information needed to decide who may decide. The `team_list_pending_control` view carries the same fields (`reviewAuthority: "leader"`), so the Leader's own view agrees.

**Where the authority split actually is:** not `pre-crash vs post-restart` but **by leg kind** — `leader-approval` → the Leader *and* the assigned reviewer may decide; `user-approval` → the human only, before and after any restart. That is why step 1 and step 2 are separate steps.

---

## 4. Arm table (12 runs, DEV-LIVE, 2 per arm, fresh `DSH_HOME`, ports 13010/13060 or 13020/13070)

| # | dir | arm | kill point | expectation | verdict | `decidedBy` | decision within window | notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `run-none-1` | control (b) | `after-decision` | starves | **PASS** | `operator` (after the window) | no (65 173 ms) | PD-44 reproduced |
| 2 | `run-none-2` | control (b) | `after-decision` | starves | **PASS** | `operator` | no (65 194 ms) | PD-44 reproduced |
| 3 | `run-nr-1` | control (a) | none | nudge path sound | **PASS** | `officer-instance` | yes (503 ms) | wake also fired (`wakeNamedNew: true`) and won |
| 4 | `run-nr-2` | control (a) | none | nudge path sound | **PASS** | `officer-instance` | yes (502 ms) | wake also fired and won |
| 5 | `run-lm-1` | step 3 | `after-decision` | Officer decides via message | **PASS** | `officer-instance` | yes (253 ms) | `nudgeTurns: 3`; wake named only the OLD leg |
| 6 | `run-lm-2` | step 3 | `after-decision` | Officer decides via message | **PASS** | `officer-instance` | yes (251 ms) | same |
| 7 | `run-probe-1` | step 2 | `after-decision` | Leader decides | **PASS** | `leader-instance:inst-leader` | yes (0 ms) | nudge skipped |
| 8 | `run-probe-2` | step 2 | `after-decision` | Leader decides | **PASS** | `leader-instance:inst-leader` | yes (1 ms) | nudge skipped |
| 9 | `run-ua-1` | step 1 | `after-decision` | Leader refused, human decides | **PASS** | `operator` (`kind: human`) | n/a (operator call) | `CONTROL_RESOLVER_NOT_AUTHORIZED` |
| 10 | `run-ua-2` | step 1 | `after-decision` | Leader refused, human decides | **PASS** | `operator` (`kind: human`) | n/a | same |
| 11 | `run-mw-1` | step 4 | `after-decision` | crashed member does new work | **PASS** | `officer-instance` (step 3) then new ask | yes (253 ms) | `turnStarted: true`, new ask `ctrl-1o4q…` |
| 12 | `run-mw-2` | step 4 | `after-decision` | crashed member does new work | **PASS** | `officer-instance` then new ask | yes (251 ms) | `turnStarted: true`, new ask `ctrl-15k4hv…` |

**Instrument validity (clause `N-1`, every restart arm):** the pre-crash leg is decided by the **Officer** after a real review wake (`preCrashWakeTurns: 3`), so the lane is proven healthy before the kill — a starved post-restart leg is the restart, not a broken world.

**Exit codes.** `0` = the arm's pre-registered expectation was met (for control (b) that means *starved*), `2` = expectation violated, `1` = fatal.

---

## 5. Copy-pasteable operator sequence after a cold boot

```text
# 0. the boot is up; nothing will wake on its own — do not wait for a [team-review-wake]
team_list_pending_control

# 1. human legs first (refused to you, by design)
#    for each pending { kind: "user-approval" }:
#      "Please decide <requestId> — only you can; I am not a resolver for this kind."
#      (operator: team.resolveControl)

# 2. close what you may close, yourself
team_resolve_control { requestId: "<leader-approval id>", decision: "allow" }

# 3. brief the assigned reviewer with the remaining ids (and the two questions)
team_send_message { recipientInstanceId: "<officer>", subject: "restart briefing …",
                    body: "pending <requestId> … #1 was the stop a trajectory problem? #2 how should the next approval go?" }

# 4. pull the work back up — new unit, not a follow_up on the dead one
team_send_message { recipientInstanceId: "<member>", subject: "restart: pull the work back up", body: "<new work>" }
```

Then wait for `control-decision-recorded` (durable), not for reply text. `team_follow_up` on a dead unit returns `200` and starts nothing.

---

## 6. What the Officer can and cannot do after the restart

**Can:** receive an ordinary `team_send_message`/`team_follow_up` addressed to its instance, run a real model-visible turn, read `team_list_pending_control`, and record `control-decision-recorded` for a `leader-approval` leg with itself as `decider` — measured in ~0.25 s.

**Cannot:** be re-driven by the wake plane for a **new** leg (the wake names only the pre-crash leg: `wakeTurns: 1`, `namesNewRequest: false`, and the intent directory is `[]` after the first wake), and cannot resolve a `user-approval` leg (nobody but the human can). It also does not resume the **crashed member's** work — that is step 4, and it is addressed to the member, not the Officer.

---

## 7. Residual limits (disclosed, not solved here)

1. **No automatic re-drive.** This lane changes documentation and adds an instrument; the wake plane is untouched. PD-44 stays open until the ARC-A centre override plus its crash-semantics review lands.
2. **Control (a) cannot isolate causation on a healthy Host.** With a live Host, both delivery paths exist and the wake wins the decision race; the relay turn still starts and still attempts the resolve (and is refused `CONTROL_REQUEST_DECIDED`). Sole causation for the message path is carried by the restart arms, where the wake names only the old leg.
3. **One leg class per arm.** `leader-approval` and `user-approval` are measured; escalation legs are reasoned from the resolver table (`allowed: [human]`) and not driven live here.
4. **Mock-model turns.** The Officer/Member turns are produced by the mock model (`packages/tools/harness/mock-deepseek.mjs`), so this measures the **routing/delivery/durability** path, not a real model's judgement; the two briefing questions are carried in the message body and their answers are not graded.
5. **`status` is not on the ledger request row** (`null` in the field table); pending state is derived by the service and read through `team_list_pending_control`.
6. **Two runs per arm** (one run per arm is a spot check, not a measurement). Both runs of every arm agreed.

---

## 8. Evidence layout and budget

```
dev/agent-workflow/evidence/a6-cold-wake-nudge-20261113/
  README.md               this file
  nudge-arms.json         THE one committed .json: every run's facts + per-arm agreement table
  build-aggregate.mjs     generator: reads run-*/cw-facts.md → nudge-arms.json
  run-*/                  one dir per run: run.log, stdout.log, cw-facts.md (facts as a fenced
                          JSON block), cw-blueprint.yaml, a6-officer-wakes.log,
                          a6-nudge-turns.log, a6-member-work-turns.log, boot-preflight.json.md,
                          a1-sandbox-backend.json.md, a6-cold-wake-run-summary.json.md
```

**Per-run artifacts are `.json.md`, never `.json`** — the repository-wide committed-evidence cap counts tracked `.json` under `dev/agent-workflow/evidence/`; the aggregate `nudge-arms.json` is the only JSON this lane adds (**5 995 / 6 000** after it, from 5 994 on the base).

**Instrument:** `tests/kits/a6-cold-wake-nudge-20261113/a6-cold-wake-nudge.mjs`, derived from `tests/kits/a6-cold-wake-20261113/a6-cold-wake.mjs` (blob `858a84304947bf7159884536b8d6289713e96d79`). Flags: `--cw-kill {none,after-decision,after-completion}`, `--cw-nudge {none,leader-message,follow-up,leader-to-member}`, `--cw-leader-probe on`, `--cw-user-approval on`, `--cw-member-work on`, `--cw-window-ms` (default 65 000).

**Reproduce one arm** (ports must be free; never `:3080`):

```bash
node tests/kits/a6-cold-wake-nudge-20261113/a6-cold-wake-nudge.mjs \
  --cold-wake --cw-kill after-decision --cw-nudge leader-message \
  --worktree "$PWD" --testuse "$PWD/tests/deepseek-harness-test-use" \
  --host-port 13010 --mock-port 13060 \
  --evidence-dir "$PWD/dev/agent-workflow/evidence/a6-cold-wake-nudge-20261113/run-<name>"
node dev/agent-workflow/evidence/a6-cold-wake-nudge-20261113/build-aggregate.mjs
```
