# Alpha.6 recipient probes — real Host (2026-11-05)

Product HEAD for the handoff rerun: `fd7a5d6c1` (the transfer-sink fix below); the earlier
self-review runs used `b4d4d21e3fa9cef9db5ead895a47c479d925e7f4`. The Host is real
`0.2.0-rc.2 @ 639ed015397290b3745d163aafe02ffee4aa3f84`, mock model only.

## Officer self-review — PASS

Run: `C1_ALPHA6_OFFICER=1 C1_PLANE_TAKEOVER=1 C1_A6_RECIPIENTS=1`, evidence
`a6-recipients-r6/` (root `session-c1-smoke-a6-2026-11-05T14-18-07`), reproduced in
`a6-recipients-r12/` (`...14-57-47`) and in the clean final run `a6-recipients-r13/`
(`...15-08-37`, exit 0): `A6-1..A6-7 PASS`, final self request
`ctrl-1xt8vtg1mids4f1kjpp921m8` decided by the Leader seq 19, executed once.

The Officer's own governed `bash` produced, in order:

1. guard `parameter-permission` `ctrl-1kxo7gl15uljum02qhw3z1ss` (r6) — Leader notification,
   Leader `allow` seq 16, consumed seq 17;
2. PA `team-tool-execute` `ctrl-1lc9fk11mqfnfy168muob00k` — target/OperationOwner
   `inst-15fuult1qf2p` (the Officer), decision seq 19 by
   `{kind:'instance', instanceId:'inst-leader', role:'leader'}`, consumed seq 20;
3. the original command executed once: workspace file
   `c1-a6-self-2026-11-05T14-18-07.txt` contains `c1-a6-self-2026-11-05T14-18-07`.

The self-ask therefore routes to the **Leader**, never back to the Officer. The recipient
evidence is the durable Leader decision, not the legacy notification turn count
(`leaderNotifications=7` counts the list/resolve model turns, not seven independent notices).

## Officer handoff — PASS (clean run), successor was previously never woken

Run: `C1_ALPHA6_OFFICER=1 C1_PLANE_TAKEOVER=1 C1_A6_HANDOFF=1`, evidence
`a6-handoff-only-r6/` (root `session-c1-smoke-a6-2026-11-05T17-10-52`, exit 0).
The Leader created a **fresh** worker `w-a6-ho` and delegated the handoff ask to it.

Durable facts for PA `ctrl-0i9xjnj1kx69341ewupe51le`:

- guard `parameter-permission`: Leader allow, consumed;
- PA `team-tool-execute`: `operationOwnerTemplateId=worker`, `reviewAuthority=leader`,
  `legOrdinal=1`;
- `control-current-leg-transferred` **seq 22**, cause `officer-handoff`, actor the Officer,
  `target:'leader'`, same `approvalCaseId` / `currentLegRequestId`;
- `control-decision-recorded` **seq 23**, `decision:'allow'`, decider
  `{kind:'instance', instanceId:'inst-leader', role:'leader'}`;
- allow consumed, original command executed once:
  `c1-a6-handoff-2026-11-05T17-10-52` in `c1-a6-handoff-2026-11-05T17-10-52.txt`;
- `A6-8 PASS`, `executed=true`.

### The defect this run proved and the fix

Before `fd7a5d6c1`, the same clean scenario (`a6-handoff-only-r3`) wrote the transfer (seq 22)
but **no successor notification, no Leader decision and no execution**: the old Officer latch
was retired and the durable leg was stranded. Root cause: `ControlService` emits
`reviewEvents.current-leg-transferred` / `human-current-leg`, but **production had no consumer
at all** (`grep reviewEvents packages/runtime/src/plugin` was empty). The fix wires the
production root's `reviewEvents` to re-read the moved leg and run the **same trusted
notifier/route** used at creation, so a transferred leg reaches its new recipient instead of
the former reviewer. This is the "successor current-leg notification reachability, not just
persistence" requirement.

### Cross-scenario limit (not a handoff failure)

Running self-review and then handoff **in the same Host lifetime** (`a6-recipients-r22`) still
leaves the second PA pending with no model turn even though the native handle reported
`idle` and `followup` set it `running`. The handoff path itself is green in the clean run; the
open item is a **same-session queued wake after a direct prompt to the Officer**, recorded
under row 15, not a failure of the transfer/recipient logic. It is not waived.

## Re-run commands

```bash
# self-review only
C1_ALPHA6_OFFICER=1 C1_PLANE_TAKEOVER=1 C1_A6_RECIPIENTS=1 \
  node tests/kits/c1-leader-approval-smoke/c1-leader-approval-smoke.mjs \
  --host-port 3628 --mock-port 3629 --evidence-dir "$PWD/dev/agent-workflow/evidence/a6-recipients-r13" --keep

# handoff probe (clean flow; no direct Officer prompt first)
C1_ALPHA6_OFFICER=1 C1_PLANE_TAKEOVER=1 C1_A6_HANDOFF=1 \
  node tests/kits/c1-leader-approval-smoke/c1-leader-approval-smoke.mjs \
  --host-port 3650 --mock-port 3651 --evidence-dir "$PWD/dev/agent-workflow/evidence/a6-handoff-only-r4" --keep
```
