# a5live g6 run 2026-10-16T22-06-50Z

- host: /srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/dsh-020rc2-upgrade/tests/deepseek-harness-test-use @ 639ed01539 (pinned 0.2.0-rc.2)
- port 3186 · mock 3499 · world deleted at teardown
- dist: /srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/a5-live-pr3/packages/runtime/dist/packages
- criteria: 19/19 pass

- [x] L-PIN: test-use runtime is the pinned pristine baseline — head=639ed01539 porcelain=0 at /srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/dsh-020rc2-upgrade/tests/deepseek-harness-test-use
- [x] L-DIST: the worktree dist carries the gated face + kernel + install — /srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/a5-live-pr3/packages/runtime/dist/packages
- [x] L-PORTS: host port 3186 free and a mock port from the 349x family free — hostFree=true mock=3499
- [x] L-BOOT: the test Host booted on the recorded port with the token gate live (303 + set-cookie) — status=303
- [x] L-CREATE: the host public session/create entry returned a real sessionId — status=200 sid=session-63bb587b-f91a-43
- [x] L-TURN1: the real session ran a setup turn to a model reply (an Agent now exists behind the session) — status=200
- [x] L-AGENT: the session Agent is reachable through the PUBLIC ctx.agents seam (core-plugin pattern) — agent={"id":"session-63bb587b-f91a-4392-9f9a-4fe354746d1b","session":"session-63bb587b-f91a-4392-9f9a-4fe354746d1b","hasCtx":t
- [x] L-ASSEMBLE-START: the live assembly started on the real Agent — {"ok":true,"started":true,"label":"session-63bb587b-f91a-4392-9f9a-4fe354746d1b"}
- [x] L-PROMPT: the real session accepted the scripted turn (the model reached the mock or the turn completed) — status=200 body={"type":"server-response","rpcId":"a5live-run-mguzv7jt","result":{"ok":true,"value":{"accepted":true}}}
- [x] L-TURN: the scripted tool chain ran to its terminal reply — mockRequests=6
- [x] L-ASSEMBLED: the row observed a REAL session Agent (agent/created) and ran the live assembly on it — agents=session-63bb587b-f91a-4392-9f9a-4fe354746d1b
- [x] L-G6-INSTALL: the PR1 guard installed, published and armed on the REAL session Agent scope (changeChannelStatus reads "armed" pre-change) — install=true publish=true before=armed
- [x] L-G6-LEGAL-CHANGE: one LEGAL registry change (a same-row re-registration of its own Definition) ran inside the live session — reRegistrations=1
- [x] L-G6-PROVEN: G-6 live: after the first delivered registry-change notification handle.changeChannelStatus() reads "proven" (test-face live read) — changeChannelStatus=proven
- [x] L-G6-ABORT-EVENT: the delivered configuration shows the targeted cancellation path live: dispatcher-change-abort-issued carries the event originals — issued=1 cancelledBeforeBody=1 bodyV1=0
- [x] L-G6-NO-ALARM: the delivered configuration produced NO executed-unvalidated alarm (cancellation, not loud-withdrawal, covered it) — unvalidated=0
- [x] L-G6-RECOVERY: the refused next call re-bound by the trusted assembly executes again (same arm, no extrapolation) — rebind={"attempted":true,"ok":true,"error":null} v2=1 v3=1
- [x] L-STABLE: the stable :3080 instance was only probed, never operated, status unchanged — before=401 after=401
- [x] L-PRISTINE: the test-use runtime stayed pristine (porcelain empty, HEAD unmoved) — porcelain=0

token: launch token redacted at capture (REDACTED-<sha8>); raw instance log deleted after redaction.