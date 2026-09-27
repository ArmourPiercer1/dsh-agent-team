# run 10 probe events (boot 3) — reconstructed

The original `fence-probe-events.jsonl` was cleared by run 11's boot-1
attempts (the spike clears it per boot) before run 11's fatal
`ERR_MODULE_NOT_FOUND` (the host-hook import path pointed at the worktree,
where `diag-hook.mjs` does not live).

`fence-probe-events-boot3.jsonl` is reconstructed from the full console
dump of all 9 boot-3 events taken immediately after run 10 (fields shown
in that dump: t, kind, sessionId, veto, source, message). Fields that were
not displayed in the dump (`armed`, `agentId`, `permitted`) are marked as
reconstructed: `agentId` mirrors `sessionId` (probe behavior), the
post-permit `agent/created` (05:07:12.077) carried `permitted:true`
(takeover passed via the B6 one-shot permit), the final `armed` at
05:07:12.350 is Leg C's manual re-arm (C0), and the last `agent/created
source=startup` (05:07:12.361) is the ordinary-session create (C1).
