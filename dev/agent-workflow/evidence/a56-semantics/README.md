# A56-SEMANTICS — Alpha.5 Goal authority × Alpha.6 message identity

Gateway 2 of the joint Alpha.5 + Alpha.6 close-out (target `v0.1.6`).
Base: `origin/integration/v0.1.6` @ **`356993d2d`** (PR #691). Branch
`task/a56-semantics-20261109`, worktree `.worktrees/a56-semantics`.

This directory is DEV-LIVE evidence for the ONE question the two Alphas answer
differently: **what does a Team delivery mean to the two authorities that read
it?** It records the measurement, the resolution, and what each test proves.

---

## 1. The conflict, in one paragraph

Upstream `tool-goal/src/authority.ts` (@ `639ed01539`) authorizes `create_goal`
only for the exact live calling agent inside its active driver, on a runtime
ROOT, whose captured **open turn contains a `user/message` event with
`data.source.kind === 'user'`** (`hasDirectHumanInput`). A Team Member is a
top-level agent (`agents.roots()` = "created without an owning agent context"),
so the **source kind of the delivery that started its turn** is the whole
decision. Alpha.6 moved every Team delivery to `plugin:dsh-agent-team` so that
**no machine relay could clear a human Sticky Stop** — the durable marker is
cleared only by `agent/inbox/claimed` with `source.kind === 'user'`. The two
requirements therefore pull on the same two-valued wire, and the integration
base satisfied A6 by breaking A5.

## 2. Measurement A — the base behaviour (the tree's own attribution)

Instrument: the A5 Preview E2E (`tests/world-factory/drivers/a5sf-pd33-preview-e2e/run-boot.mjs`)
with `A5SF_PD29_KEEP_HOME=1` so the Member session log survives. The **only**
difference from HEAD is the two attribution expressions, restored to the base
bytes (`02-attribution-only-diff.txt`); everything else — world, blueprint,
mock model, arms — is identical.

| | base attribution (`plugin:dsh-agent-team`) | HEAD (this branch) |
|---|---|---|
| Member B's inbound work turn | `source.kind = "plugin:dsh-agent-team"` (`01-…txt`) | `source.kind = "user"` (`06-…txt`, `05-…log`) |
| `create_goal` result | **refused**: `GOAL_TOOL_AUTHORITY_REQUIRED`, text *"this goal operation requires a direct human turn on a top-level agent"* (`01-…txt`, `03-…jsonl`) | accepted, `maxGoalRounds=100000` |
| goal rounds reached | **0** (`b.rounds=0 b.phase=null`) | **3** then `complete` |
| preview cases | the run **dies at S1c** ("never reached round 2") — no Member goal can start, so the stop arms cannot even be exercised (`00-…txt`) | **19/19 PASS** |

Exact session lines (verbatim from the session log):

```
{"type":"user/message","seq":8,"data":{"source":{"kind":"plugin:dsh-agent-team"},
 "content":[{...,"text":"[team-work requestToken=a5sf-pd33-b-delegate] a5sf-pd33-b: …"}]}}
{"type":"tool/result","seq":36,"data":{"message":{"role":"tool","toolCallId":"call-pd33-b-create-goal",
 "content":[{"type":"text","text":"Error: this goal operation requires a direct human turn on a top-level agent"}],
 "isError":true},"error":{"name":"HarnessError","code":"GOAL_TOOL_AUTHORITY_REQUIRED"}}}
```

So the integration tree did **not** merely weaken a preference: it removed
`create_goal` from every governed Member, and the A5 preview could not complete
at all.

## 3. Where Sticky Stop is cleared, and which sources are human

Measured in `packages/runtime/src/plugin/host.ts` (base): the **only** resume
producer is `agent/inbox/claimed` → `alpha6WakeUserResume`, gated on
`payload.message.source.kind === 'user'`. The **only** stop producer is
`turn/end` with `reason.kind === 'aborted' && reason.reason.kind === 'user'`,
which the host emits for the user's own `session/cancel`.

Is work delivery a clearing path? **Yes, once it carries `user`** — an
`agent/inbox/claimed` for a work message is indistinguishable from a human one
by source kind alone. That is exactly why resolution (a) cannot be "just switch
the kind back": the Team must tell the truth about its own input.

The `interrupt` cancel cause is **not** on the human Stop path: `interrupt` is
called only by the lifecycle quiesce step (`packages/runtime/lifecycle/quiesce.ts:128`
→ archive/dispose), and the goal-round driver only distinguishes `turn/end`
`reason.kind` (`aborted` / `max-tokens`), not the inner cause. The branch keeps
the base's `{ kind: 'hook', reason: 'team-member-interrupt' }` (a machine stop,
never a human one) alongside PD-29's durable `pause` + `disarm`; the live
`pd29:leader-archive-stops-goal` case (durable `paused`, 0 rounds after archive,
0 tool calls) is green on this branch (`04-…log`), and `pd34:control-stops-member`
is green too.

## 4. Resolution (a), with the measured refinement

`source.kind` cannot express both properties at once, and the upstream
authority rule may not be re-implemented by the party it constrains. So the
branch **splits the two paths and gives the Team its own provenance law**:

1. **Work delivery / root work keep `source.kind: 'user'`** — the A5 authority
   (goal) reads the turn and grants it, unchanged upstream.
2. **Messaging relays (machine), control/completion notifications and review
   wakes keep `plugin:dsh-agent-team`** — they never authorize a goal and are
   machine by construction.
3. **`packages/runtime/src/plugin/live/input-provenance.mjs`** (new, placed
   into `dist` by `scripts/dist-placements/220-a56-input-provenance.json`) is
   the ONE law: the frozen `[team-work]` / `[team-root-work]` envelopes (the
   only deliveries that carry the human attribution), the producer-owned
   machine kind, and a bounded process-local **machine-input ledger** the
   producer writes for every machine delivery it makes.
4. The Alpha.6 **resume arbour asks the producer**, not the wire: the claim is
   human only when it is not a Team delivery (`isHumanInteractionClaim`).
   **Fail-closed**: a throwing arbiter is treated as machine, so an exception
   can never widen the Stop.

Nothing upstream is patched (`CORE PATCH BUDGET = 0`), the goal state machine
is not re-implemented, and no Team-owned Goal tool adapter was needed — so
resolution (b)/(c) were not used.

## 5. What the live A6 boot proves (A6 ON, `--keep`)

Instrument: `tests/kits/c1-leader-approval-smoke/c1-leader-approval-smoke.mjs`
with `C1_ALPHA6_OFFICER=1 C1_PLANE_TAKEOVER=1 C1_A6_STICKY_STOP=1` on a real
Host (v5 blueprint + approval routing + governed I/O, `05-a6-kit-run.log`):

- **A6-1** — the v5 blueprint is admitted with the Officer + routing on the real
  Host (the same blueprint carries the **v4 I/O ceilings**: `TeamBlueprintV5Core
  extends Omit<TeamBlueprintV4Core,'schemaVersion'>`, so **one Team carries
  both** — no "v4 vs v5" choice is needed).
- **A6-22** — a real Host user Stop leaves a durable `stopped-*.json`, withdraws
  the queued wake row, does not re-deliver.
- **A6-26** — a **CLAIMED** machine relay (`member.send`, `caller.kind:'instance'`)
  to the stopped reviewer: marker still there, wake count unchanged, and the
  mock model really saw the relay (`relayClaimed=true`) — i.e. the Inbox
  claimed it and the arbour refused it.
- **A6-27** — a **CLAIMED** machine **WORK** delivery (`member.followup`,
  `caller.kind:'instance'`): same result, while that very delivery is the one
  carrying `source.kind:'user'` (`workClaimed=true`). **This is the leg that
  would have failed on the base-resolution ("switch the kind back") design.**
- **A6-23** — the marker survives a real Host SIGKILL + restart.
- **A6-24** — a HUMAN `member.send` still clears it and re-plans the wake
  without reviving the historical call (Scheme A).

Live source kinds from that boot's session logs (`06-…txt`) — the whole split,
measured in one real-Host run with Alpha.6 ON:

```
[team-root-work requestToken=team-create:initial-work:…]  source.kind = user
[team-work requestToken=c1-a6-delegate-…]                 source.kind = user                    <- A5 authority
[team-review-wake wakeId=review-wake:…]                   source.kind = plugin:dsh-agent-team
[team-control requestId=ctrl-…]                           source.kind = plugin:dsh-agent-team
[team-relay] from=human:<root> …                          source.kind = user                    <- the human resume
```

**Measured limit of A6-26/27 (disclosed, and stronger than expected):** on a
stopped latch the machine relay and the machine work delivery are **accepted**
by the native Inbox (remote status 200) but **not claimed** at all — the mock
model never sees them (`relayClaimed=false`, `workClaimed=false`, recorded in
`a56-machine-relay.json` / `a56-machine-work.json`). The human Stop therefore
holds one boundary EARLIER than the arbour: the suspended latch refuses to
start the turn. The arbour's provenance check stays as the fail-closed guard
for the paths where a claim DOES happen (a claim racing the marker write, or a
claim on a session whose latch is not the one being stopped); its classification
half is pinned by `packages/runtime/test/a56-input-provenance.test.ts`.

## 6. Regression discipline

- **A6 off (default) ⇒ Alpha.5 behaviour**: the A5 Preview E2E above ran on a
  tree where **A6 is not loaded at all**, not merely configured off: the
  effective preset for that row declares no `alpha6*` key
  (`grep -c alpha6 plan-patch.yml preset-effective.json` = 0 in the run's
  artifacts), and `host.ts` registers **zero** Sticky-Stop listeners unless
  `builtRoot.alpha6WakeUserStop/Resume` are present (`host.ts`, the
  `(alpha6WakeUserStop !== undefined || alpha6WakeUserResume !== undefined)`
  guard) — so with A6 off no wake coordinator, no durable marker writer and no
  inbox-claim listener exist, and the provenance port is not consulted.
  Result: **19/19** (`04-…log`).
- **A6 on ⇒ approval + Goal both work**: A6-1..A6-27 green (approval routed to
  the Officer, governed bash executed after allow) and the A5 goal families are
  green in the same tree (`pd29:goal-continuous-rounds`, `pd33:member-b-goal-converges`,
  `pd29:*` stop family, `pd34:*`).
- **Host-free contract suite**: `packages/runtime/test/a56-input-provenance.test.ts`
  (9 legs) pins each half — the law, the envelope list, the ledger, and the
  glue's actual source kind for work/root-work/notification/relay. It would
  have caught the integration merge that dropped the Alpha.6 hunks.
- `#689` profile closure: the manifest change from #689 keeps
  `@deepseek-ai/dsh-tools` out of a clean profile install; this branch does not
  touch the manifest (`package.json` unchanged), and the check is re-run and
  recorded in the PR body.

## 7. Known limits (disclosed)

1. The provenance ledger is **process-local**; after a restart it is empty, so
   the durable classification of an unclaimed `user`-attributed machine input
   rests on the frozen `[team-work]` / `[team-root-work]` envelopes. A new
   producer that renders a different text shape must add its envelope (the law
   test pins the list).
2. The relay envelope is deliberately **not** in the law: a human `member.send`
   produces the same `[team-relay…]` text, so an envelope rule would classify
   the human interaction as machine. Machine relays are covered by their
   producer kind instead.
3. A6-26/27 prove the Stop holds for **claimed** machine inputs on a real Host;
   they do not prove that a machine input can never race the marker write
   (the arbour is fail-closed for that case, which is what the unit legs pin).

## 8. Proposed debt-register row (owner to book — a worker may not edit `docs/plans/active/`)

**PD-A56 (SEMANTICS)** · cross-face (Alpha.5 Goal authority × Alpha.6 message
identity) · category: behavioural divergence / correctness.

On the integration tree `agent-bindings.mjs` delivered work input with the
Alpha.6 producer kind, so upstream `hasDirectHumanInput` refused every governed
Member's `create_goal` (`GOAL_TOOL_AUTHORITY_REQUIRED`, 0 rounds) and the A5
Preview E2E could not pass at all (it died at the first stop arm). Root cause is
a genuine cross-semantic conflict, not a bug in either Alpha: one two-valued
`source.kind` was being asked to carry both "this turn is authorized to start a
goal" and "this turn is not a human interaction". Resolution (a) splits the
paths (work keeps `user`; machine relays/wakes/notifications keep the producer
kind) and adds the Team-owned provenance law (`input-provenance.mjs`) that the
Sticky Stop arbour consults, fail-closed. Evidence:
`dev/agent-workflow/evidence/a56-semantics/`. Row number must be booked after
`#689` merges (PD-37 is still a draft on this base).
