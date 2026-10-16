# a5live g7 run 2026-10-16T22-06-58Z

- host: /srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/dsh-020rc2-upgrade/tests/deepseek-harness-test-use @ 639ed01539 (pinned 0.2.0-rc.2)
- port 3186 · mock 3499 · world deleted at teardown
- dist: /srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/a5-live-pr3/packages/runtime/dist/packages
- criteria: 18/18 pass

- [x] L-PIN: test-use runtime is the pinned pristine baseline — head=639ed01539 porcelain=0 at /srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/dsh-020rc2-upgrade/tests/deepseek-harness-test-use
- [x] L-DIST: the worktree dist carries the gated face + kernel + install — /srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/a5-live-pr3/packages/runtime/dist/packages
- [x] L-PORTS: host port 3186 free and a mock port from the 349x family free — hostFree=true mock=3499
- [x] L-BOOT: the test Host booted on the recorded port with the token gate live (303 + set-cookie) — status=303
- [x] L-CREATE: the host public session/create entry returned a real sessionId — status=200 sid=session-3a667f32-2d28-4b
- [x] L-TURN1: the real session ran a setup turn to a model reply (an Agent now exists behind the session) — status=200
- [x] L-AGENT: the session Agent is reachable through the PUBLIC ctx.agents seam (core-plugin pattern) — agent={"id":"session-3a667f32-2d28-4bb0-af6f-9dd0f149e1f8","session":"session-3a667f32-2d28-4bb0-af6f-9dd0f149e1f8","hasCtx":t
- [x] L-ASSEMBLE-START: the live assembly started on the real Agent — {"ok":true,"started":true,"label":"session-3a667f32-2d28-4bb0-af6f-9dd0f149e1f8"}
- [x] L-PROMPT: the real session accepted the scripted turn (the model reached the mock or the turn completed) — status=200 body={"type":"server-response","rpcId":"a5live-run-199uhu5h","result":{"ok":true,"value":{"accepted":true}}}
- [x] L-TURN: the scripted tool chain ran to its terminal reply — mockRequests=6
- [x] L-ASSEMBLED: the row observed a REAL session Agent (agent/created) and ran the live assembly on it — agents=session-3a667f32-2d28-4bb0-af6f-9dd0f149e1f8
- [x] L-G7-INSTALL: the guard installed on the REAL session Agent scope with the SWALLOWED tools/change subscription (assembly indistinguishable: install/publish ok, channel "armed") — install=true publish=true channel=armed
- [x] L-G7-EMISSION-PROVEN: the REAL registry emitted while the lane stayed silent: the row-owned control subscription moved AND the swallow proxy absorbed deliveries — control=2 proxy=2
- [x] L-G7-LOUND-PIECE: the five-piece loud posture on the LIVE observation stream: executedUnvalidated>=1 AND alarms(severity=alarm)>=1 AND callEdgeDrift(reason=definition-drift)>=1 AND bindingRevised(verified=false)>=1 AND issued===0 AND cancelled===0 — unvalidated=1 alarms=1 drift=1 revised=1 issued=0 cancelled=0
- [x] L-G7-ARMED-VERIFIED-FALSE: the silent configuration: the channel stayed "armed" end of run and a call edge showed the drifted name unverified — channel=armed verifiedFalseObserved=true
- [x] L-G7-MOVED-BODY-RAN: the moved Body DID run under the swallowed channel (a body ran — the loud report exists because it could not be cancelled) — movedBodyExecutions=2
- [x] L-STABLE: the stable :3080 instance was only probed, never operated, status unchanged — before=401 after=401
- [x] L-PRISTINE: the test-use runtime stayed pristine (porcelain empty, HEAD unmoved) — porcelain=0

token: launch token redacted at capture (REDACTED-<sha8>); raw instance log deleted after redaction.