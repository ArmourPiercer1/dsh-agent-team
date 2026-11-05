# Alpha.6 recipient probes — real Host (2026-11-05)

All product code is the already-gated integration HEAD `b4d4d21e3fa9cef9db5ead895a47c479d925e7f4`
(branch docs/evidence HEAD `49abe7e10976e85a18a2b935963617deb9884ac6`). The only worktree
change for these probes is the env-gated C1 kit extension
(`tests/kits/c1-leader-approval-smoke/c1-leader-approval-smoke.mjs`); no product file changed.
The Host is real `0.2.0-rc.2 @ 639ed015397290b3745d163aafe02ffee4aa3f84`, mock model only.

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

## Officer handoff — BLOCKED (candidate lost wake)

Run: `C1_ALPHA6_OFFICER=1 C1_PLANE_TAKEOVER=1 C1_A6_RECIPIENTS=1 C1_A6_HANDOFF=1`, evidence
`a6-recipients-r12/` (same root as above). The Leader created a **fresh** worker
`inst-07tbm2t1f1jz` (`w-a6-ho`) and delegated the handoff ask to it (a previously settled
worker cannot resume its suspended call after approval).

Durable facts:

- guard `parameter-permission` `ctrl-0w41dmx03jbioi0mi5jyz0rc`: Leader `allow` seq 25,
  consumed seq 26;
- PA `team-tool-execute` `ctrl-1ww7pw714asytc0ouvpbt1az`: `operationOwnerTemplateId=worker`,
  `reviewAuthority=leader`, `legOrdinal=1`, **status still pending**; no decision, no
  transfer (`control-current-leg-transferred` absent), no consumption, no command file.

No Officer review wake and no Leader notification turn was observed for that PA leg
(`a6-handoff-mock.json`; the last observed mock turn is the self-review tail). The base
single-worker A6 flow does wake the Officer for the same kind of PA leg, so this is
**BLOCKED with a candidate lost-wake/lost-pending defect for a post-boot-created second
worker**, not merely a missing assertion. It is not yet labelled P1 until the trigger is
isolated (new worker vs. second case under one root vs. timing); it must not be waived.
`A6-8` is red and the handoff row stays BLOCKED.

## Re-run commands

```bash
# self-review only
C1_ALPHA6_OFFICER=1 C1_PLANE_TAKEOVER=1 C1_A6_RECIPIENTS=1 \
  node tests/kits/c1-leader-approval-smoke/c1-leader-approval-smoke.mjs \
  --host-port 3628 --mock-port 3629 --evidence-dir "$PWD/dev/agent-workflow/evidence/a6-recipients-r13" --keep

# handoff probe (expected to expose the pending leg until fixed)
C1_ALPHA6_OFFICER=1 C1_PLANE_TAKEOVER=1 C1_A6_RECIPIENTS=1 C1_A6_HANDOFF=1 \
  node tests/kits/c1-leader-approval-smoke/c1-leader-approval-smoke.mjs \
  --host-port 3630 --mock-port 3631 --evidence-dir "$PWD/dev/agent-workflow/evidence/a6-handoff-r13" --keep
```
