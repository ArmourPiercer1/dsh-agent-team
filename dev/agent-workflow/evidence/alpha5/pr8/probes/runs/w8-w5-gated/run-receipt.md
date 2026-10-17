# a5w5 gated run 2026-10-17T03-07-30Z

- host: /srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/a5-w8/tests/deepseek-harness-test-use @ 639ed01539 (pinned 0.2.0-rc.2)
- port 3186 · mock 3493 · world deleted at teardown
- lane build: /srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/a5-w8/tests/homes/.a5w8-build · dist: /srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/a5-w8/packages/runtime/dist/packages
- criteria: 34/34 pass

- [x] L-W5-PIN: the test-use host is the pinned pristine 0.2.0-rc.2 runtime @639ed01539 — head=639ed01539 porcelain=0 at /srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/a5-w8/tests/deepseek-harness-test-use
- [x] L-W5-IF5: IF-5 shared surface (packages/, scripts/, root vitest.config) is byte-untouched by this lane — porcelain empty
- [x] L-W5-LANE: the lane ESM build + runtime dist are present — lane=/srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/a5-w8/tests/homes/.a5w8-build
- [x] L-W5-PORTS: host port 3186 (IF-2: W5) free and a mock port from the 349x family free — hostFree=true mock=3493
- [x] L-W5-BOOT: the test Host booted on port 3183 with the token gate live (303 + set-cookie) — status=303
- [x] L-W5-CREATE: the host public session/create entry returned a real sessionId — status=200 sid=session-df3ae6ea-5640-41
- [x] L-W5-TURN1: the real session ran a setup turn to a model reply (an Agent now exists behind the session) — status=200
- [x] L-W5-AGENT: the session Agent is reachable through the PUBLIC ctx.agents seam (core-plugin pattern) — agent={"id":"session-df3ae6ea-5640-4110-b1af-805ae17e13e9","session":"session-df3ae6ea-5640-4110-b1af-805ae17e13e9","hasCtx":t
- [x] L-W5-ASSEMBLE: the live assembly started on the real Agent — {"ok":true,"started":true,"label":"session-df3ae6ea-5640-4110-b1af-805ae17e13e9"}
- [x] L-W5-PROMPT: the real session accepted the scripted turn — status=200
- [x] L-W5-TURN: the scripted six-call tool chain ran to its terminal reply — mockRequests=10
- [x] L-W5-ASSEMBLED: the row observed a REAL session Agent and ran the live assembly on it — agents=session-df3ae6ea-5640-4110-b1af-805ae17e13e9
- [x] L-W5-GUARD: the PR1 guard installed, bound its two tool names and PUBLISHED armed on the real Agent scope; the live change-channel later reads proven (the post-assembly registration DELIVERED on the live subscription) — {"installOk":true,"installError":null,"bindOwnOk":true,"publishedOk":true,"channel":"proven","channelAtPublish":"armed","probeRegisteredAfterPublish":true,"pendingCalls":[]}
- [x] L-W5-REG: the aliased tool names a5w5_search + a5w5_bash (+ the post-assembly probe) are on the live scoped registry — ["a5w5_search","a5w5_bash","a5w5_unbound_probe"]
- [x] L-W5-E2E-SEARCH: a REAL model-driven search ran the FULL PR2 flow in the dispatch path: bind→grant (grantId minted) → admitted → exec=1 → presented with the lane footer — grant=grant:cbe6e08c313802528adf91db34ddd63e execDelta=1 kind=presented
- [x] L-W5-E2E-BASH: a REAL model-driven shell call ran bind→grant→exec and presented bash · exit=0 — kind=presented
- [x] L-W5-TRANSCRIPT: both presentations rode the REAL dispatch path into the model transcript (tool_result bytes seen by the model) — transcriptRows=6
- [x] L-W5-SPILL-POINTER: the big shell output presented a spill pointer whose file exists on disk with matching bytes (world-bound controlled path) — pointer={"spillId":"bash-w5-bash-4","bytes":18893} disk=18893
- [x] L-W5-ONESHOT: every admitted call consumed its grant at the exec edge EXACTLY ONCE (first consume ok, deliberate replay typed-refused, ledger consumed=1) — search={"ok":true,"replay":false}|{"ok":false,"replay":true,"code":"APPROVAL_STALE","message":"grant \"grant:cbe6e08c313802528adf91db34ddd63e\" refused at the consumption edge: grant-consumed (frozen PR0 precedence; no retry, no fallback, design §4.3)"} bash={"ok":true,"replay":false}|{"ok":false,"replay":true,"code":"APPROVAL_STALE","message":"grant \"grant:bed8e6e956e96d3fed3539c7a2798ddd\" refused at the consumption edge: grant-consumed (frozen PR0 precedence; no retry, no fallback, design §4.3)"} consumed=1/1
- [x] L-W5-LIFE-OPENWRITE: spill lifecycle LIVE: openSink + ACTIVE writes (all port facts live) — {"open":{"ok":true},"written":{"ok":true,"bytes":1856}}
- [x] L-W5-LIFE-READ: spill read (authorized) returned byte-identical payload with attribution — {"ok":true,"matches":true,"attribution":{"realmId":"a5w5-realm","tool":"w5-lifecycle","callId":"life-1"}}
- [x] L-W5-LIFE-RECHECK: authorization RE-CHECK at read time: deny → typed spill-read-denied with ZERO payload reads — {"refused":true,"refusal":{"code":"spill-read-denied","detail":"authorization at read time refused spill w5-life-1: w5 re-check refused","class":"denied"},"payloadReadDelta":0,"totalPortDelta":{"ensureDir":0,"writeFile":0,"appendFile":0,"readText":0,"sizeBytes":0,"list":0,"remove":0,"exists":0}}
- [x] L-W5-LIFE-CLOSE: settle→finalize→close ran across the settled edge; a write after close is typed spill-write-after-close — {"settledOk":true,"finalizedOk":true,"closedOk":true,"state":"closed","writeAfterClose":{"code":"spill-write-after-close","detail":"spill w5-life-1: the lease is closed","class":"denied"}}
- [x] L-W5-LIFE-IDINUSE: id-in-use REPLAY: re-opening the settled spillId is typed spill-id-in-use BEFORE any write-port call; payload + meta byte-identical (terminal fact preserved) — {"refused":true,"refusal":{"code":"spill-id-in-use","detail":"spill w5-life-1 already exists on disk — a settled record is read through readSpill, never re-opened for append","class":"denied"},"writePortDelta":0,"payloadUnchanged":true,"metaUnchanged":true}
- [x] L-W5-LIFE-FRESH: a FRESH store handle enumerates the residue with attribution + settlement (law 3, disk-not-memory) — [{"spillId":"w5-life-1","bytes":1856,"attribution":{"realmId":"a5w5-realm","tool":"w5-lifecycle","callId":"life-1"},"settlement":{"kind":"completed"}}]
- [x] L-W5-EVENTS6-SETTLE: all six master full-prefix settlement names settle a live lease (verbatim), the retired short form is refused spill-settlement-event-unknown — {"accepted":6,"off":"spill-settlement-event-unknown"}
- [x] L-W5-EVENTS6-STREAM: every dispatcher-call-* name on the LIVE observation stream is a master-emitted full-prefix name (six settlement names + begin/end/refused); NO retired short form appears; settlement-six stream counts recorded — settlementSix={"dispatcher-call-cancelled-before-body":0,"dispatcher-call-terminated-after-body-start":0,"dispatcher-call-completed-after-abort":0,"dispatcher-call-outcome-unreadable":0,"dispatcher-call-cancelled-by-others":0,"dispatcher-call-executed-unvalidated":0} streamCallNames={"dispatcher-call-begin":7,"dispatcher-call-end":5,"dispatcher-call-refused":2} guardDenial=2 callRefused=2
- [x] L-W5-OVERPRIV: ungranted call (policy-outside read): the PR2 kernel refused with its OWN typed vocabulary, verbatim, and NOTHING executed (grant null, presented null, backend exec delta 0) — stage=requires-approval code={"kind":"requires-approval","requestedEffects":{"effects":[{"kind":"list","resource":{"realmId":"a5w5-realm","kind":"directory","canonicalLocator":"/srv/workspa
- [x] L-W5-DENY-ZERO: denied presentation is ZERO-BYTES payload with ZERO spill residue (live re-test of the parity-suite law) — payloadBytes=0 spillDelta=0
- [x] L-W5-UNBOUND: the post-assembly probe name is refused at the call edge by the live guard (TOOL_BINDING_UNVERIFIED face in the transcript) and its BODY never ran — probeBodyCount=0 transcriptHit=true
- [x] L-W5-PARITY-SHELL: shell parity (governed vs RAW, same inputs): stdout/stderr sha + exit IDENTICAL for printf / stderr+exit3 / big-seq — [{"l":"printf","eq":true},{"l":"stderr-exit3","eq":true},{"l":"big-seq","eq":true}]
- [x] L-W5-PARITY-SEARCH: search parity byte-leg: the governed spill payload is BYTE-IDENTICAL to the raw grep leg stdout (same argv), presentation is the renderer layer over the same bytes — {"spillBytes":299,"rawBytes":299}
- [x] L-W5-STABLE: the stable :3080 instance was only probed, never operated, status unchanged — before=401 after=401
- [x] L-W5-PRISTINE: the test-use runtime stayed pristine (porcelain empty, HEAD unmoved) — porcelain=0

token: launch token redacted at capture (REDACTED-<sha8>); raw instance log deleted after redaction.