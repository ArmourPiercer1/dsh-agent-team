# a5l1 C-12 L1 PoC run 2026-10-17T05-08-04Z

- host: /srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/dsh-020rc2-upgrade/tests/deepseek-harness-test-use @ 639ed01539 (pinned 0.2.0-rc.2, reused read-only)
- port 3182 · mock 3491 · world KEPT: /srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/a5-l1/tests/homes/a5l1-2026-10-17T05-08-04Z
- dist: /srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/a5-l1/packages/runtime/dist/packages

- [x] C01-PIN: the reused test-use runtime is the pinned pristine 0.2.0-rc.2 build (HEAD == paths.mjs baseline, porcelain 0) — tree=/srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/dsh-020rc2-upgrade/tests/deepseek-harness-test-use
- [x] C02-DIST: the worktree committed dist carries the tool-dispatch install face — /srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/a5-l1/packages/runtime/dist/packages
- [x] C03-PORTS: host port 3182 self-proved free and a 349x mock port free — hostFree=true mock=3491
- [x] C04-WORLD-FRESH: world /srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/a5-l1/tests/homes/a5l1-2026-10-17T05-08-04Z does not pre-exist — /srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/a5-l1/tests/homes/a5l1-2026-10-17T05-08-04Z
- [x] C05-BOOT: the test Host booted on :3182 with the token gate live (303 + set-cookie) — status=303
- [x] C06-CREATE: public session/create returned a real sessionId — status=200
- [x] C07-SETUP: the setup turn completed (a real Agent now exists behind the session) — status=200
- [x] C08-ASSEMBLE: the row resolved the Agent via the PUBLIC ctx.agents seam and started the assembly — {"ok":true,"started":true,"label":"session-4faef50e-b86b-4e19-b5dd-848afb3d0ea6"}
- [x] C21-ARMED-PRESENT: ②a subscription present at startup: the install took the wrapped tools/change face (forwarder in the real table) and the channel reads "armed" — sub=true before=armed now=armed
- [x] C10-REREG-RAN: ① the same-name NO-OP re-registration ran through the public change face (disposer + register of the SAME Definition object) — {"ok":true,"action":"reregister-noop","channel":"proven"}
- [x] C11-EVENT-RAW: ① the Host REALLY emitted: raw tools/change event originals captured on BOTH the guard-forwarded lane and the control subscription — laneRaw=2 controlRaw=2
- [x] C12-ZERO-WORLD: ① world delta 0: no content-changed/added file in the operation window beyond the control-window noise baseline (disclosed) — opChanged=0 opAdded=0 controlChanged=1 noiseNet=0 []
- [x] C13-ZERO-LEDGER: ① execution-side ledger delta 0: no alarm/abort/cancel/drift/call rows and no body execution caused by the no-op (pendingCalls 0; admission ledger N/A on this arm — disclosed) — alarmClass=0 bodies={} pending=0
- [x] C14-ZERO-PORT: ① listening-port delta 0 across the operation window (control window also 0) — opDelta=[] ctlDelta=[]
- [x] C22-PROVEN-FLIP: ② startup self-prove: after the FIRST delivered synthetic change the live read handle.changeChannelStatus() === "proven" — channel=proven laneDeliveries=2
- [x] C30-SWALLOW-SET: ③ the time-shifted G-7 swallow engaged post-proof (real-table entry kept; the disposer the install received was never called) and the drifted same-name re-registration ran — disposerCalled=false drifted=true
- [x] C31-LOSS-CREATED: ③ subsequent delivery LOST: control subscription moved (registry still emits) while guard-forwarded deliveries did NOT move and the forwarder absorbed them — control 2→4 laneDeliveries 2→2 absorbed 0→2
- [x] C32-STALE-PROVEN: ③ the startup proof is STALE: changeChannelStatus STILL reads "proven" while subsequent deliveries are lost (startup-time health does not describe current delivery) — channel=proven
- [x] C33-PROMPT: the run turn entered the real dispatch path (model-driven call) — status=200
- [ ] C33-LOUD-DELTA: ③ loud five-piece delta after the lost delivery, with ZERO delivered cancellation: executedUnvalidated +>=1, alarm-severity +>=1, callEdgeDrift +>=1, bindingRevised(verified=false) +>=1, abortIssued +0, cancelledBeforeBody +0, drifted body RAN — dUnvalidated=0 dAlarms=0 dDrift=0 dRevised=1 dAbort=0 dCancel=0 bodies={}
- [x] C34-STILL-STALE: ③ end-of-run: the channel still reads "proven" and the drifted name shows unverified at the call edge (the proof said healthy while the call ran unverified) — channel=proven verifiedFalse=true
- [x] C90-STABLE: the stable :3080 instance was only probed (read-only), status unchanged — before=401 after=401
- [x] C91-PRISTINE: the reused pinned runtime stayed pristine (porcelain empty, HEAD unmoved) — porcelain=0

token: launch token redacted at capture (REDACTED-<sha8>); raw instance log deleted after redaction.