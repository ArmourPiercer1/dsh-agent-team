# a5live s1s2 run 2026-10-16T21-55-55Z

- host: /srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/dsh-020rc2-upgrade/tests/deepseek-harness-test-use @ 639ed01539 (pinned 0.2.0-rc.2)
- port 3186 · mock 3499 · world deleted at teardown
- dist: /srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/a5-live-pr3/packages/runtime/dist/packages
- criteria: 17/18 pass

- [x] L-PIN: test-use runtime is the pinned pristine baseline — head=639ed01539 porcelain=0 at /srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/dsh-020rc2-upgrade/tests/deepseek-harness-test-use
- [x] L-DIST: the worktree dist carries the gated face + kernel + install — /srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/a5-live-pr3/packages/runtime/dist/packages
- [x] L-PORTS: host port 3186 free and a mock port from the 349x family free — hostFree=true mock=3499
- [x] L-BOOT: the test Host booted on the recorded port with the token gate live (303 + set-cookie) — status=303
- [x] L-CREATE: the host public session/create entry returned a real sessionId — status=200 sid=session-1544064a-664b-48
- [x] L-TURN1: the real session ran a setup turn to a model reply (an Agent now exists behind the session) — status=200
- [x] L-AGENT: the session Agent is reachable through the PUBLIC ctx.agents seam (core-plugin pattern) — agent={"id":"session-1544064a-664b-48c5-a101-f1ffe976ec91","session":"session-1544064a-664b-48c5-a101-f1ffe976ec91","hasCtx":t
- [x] L-ASSEMBLE-START: the live assembly started on the real Agent — {"ok":true,"started":true,"label":"session-1544064a-664b-48c5-a101-f1ffe976ec91"}
- [x] L-PROMPT: the real session accepted the scripted turn (the model reached the mock or the turn completed) — status=200 body={"type":"server-response","rpcId":"a5live-run-ncvr11jv","result":{"ok":true,"value":{"accepted":true}}}
- [x] L-TURN: the scripted tool chain ran to its terminal reply — mockRequests=2
- [x] L-ASSEMBLED: the row observed a REAL session Agent (agent/created) and ran the live assembly on it — agents=session-1544064a-664b-48c5-a101-f1ffe976ec91
- [x] L-S1-UNBOUND: UNBOUND gated lane refused with the typed C-FS denial naming admission-unbound (live session; the raw file WAS readable) — code=TOOL_BINDING_UNVERIFIED cfClass=denied cfReason=effect-outside-grant stage=refused:denied:effect-outside-grant
- [x] L-S2-GRANT: bind→grant: PR2 admit returned an admitted grant in the live session — stage=flow-complete grant=grant:879f53c5b438055de69173ef6c5815c3
- [x] L-S2-READ: one controlled read executed through the gated lane; content matches; the exec-time port saw the BOUND fingerprint; the ledger shows exactly one consumption — firstOk=true matches=true port=2 fpBound=true consumed=1
- [x] L-S2-ONESHOT: the one-shot grant refuses a second exec at the live exec edge — secondRefusal={"code":"TOOL_BINDING_UNVERIFIED","cfClass":"denied","cfReason":"effect-outside-grant"}
- [ ] L-S3-E2E: the refusal and the read ALSO ran E2E through a model-driven tool call (body executed in the real dispatch path) — unbound={"kind":"e2e-unbound","ok":false,"cfReason":"effect-outside-grant","code":"TOOL_BINDING_UNVERIFIED"} bound=null
- [x] L-STABLE: the stable :3080 instance was only probed, never operated, status unchanged — before=401 after=401
- [x] L-PRISTINE: the test-use runtime stayed pristine (porcelain empty, HEAD unmoved) — porcelain=0

token: launch token redacted at capture (REDACTED-<sha8>); raw instance log deleted after redaction.