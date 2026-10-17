# a5c08 ungated run 2026-10-17T04-40-41Z

- host: /srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/alpha5-gap-c08/tests/deepseek-harness-test-use @ 639ed01539 (pinned 0.2.0-rc.2, read-only reuse)
- port 3186 · mock 3491 · world deleted at teardown
- dist: /srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/alpha5-gap-c08/packages/runtime/dist/packages
- criteria: 18/23 pass (RED: L-C08-GUARD, L-C08-CHAIN, L-C08-ONESHOT, L-C08-THUMB-DENY, L-C08-UNBOUND-DENY)

- [x] L-C08-PIN: the test-use host is the pinned pristine 0.2.0-rc.2 runtime @639ed01539 (read-only reuse) — head=639ed01539 porcelain=0 at /srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/alpha5-gap-c08/tests/deepseek-harness-test-use
- [x] L-C08-IF5: IF-5 shared surface (packages/, scripts/, root vitest.config) is byte-untouched by this lane — porcelain empty
- [x] L-C08-ARTS: the runtime dist barrels (tool-governance/tool-admission/tool-dispatch/controlled-fs) are present — dist=/srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/alpha5-gap-c08/packages/runtime/dist/packages
- [x] L-C08-PORTS: host port 3186 free (self-proved) and a mock port from the 349x family free — hostFree=true mock=3491
- [x] L-C08-BOOT: the test Host booted on port 3186 with the token gate live (303 + set-cookie) — status=303
- [x] L-C08-CREATE: the host public session/create entry returned a real sessionId (attachment-read tool host) — A=session-adaf7843-b7c
- [x] L-C08-TURN1: the real session ran a setup turn to a model reply (an Agent now exists behind the session) — status=200
- [x] L-C08-AGENT: the session Agent is reachable through the PUBLIC ctx.agents seam — agent={"id":"session-adaf7843-b7ca-475a-ad79-482039df494d","session":"session-adaf7843-b7ca-475a-ad79-482039df494d","hasCtx":t
- [x] L-C08-ASSEMBLE-REQ: the live assembly started on the real Agent — {"ok":true,"started":true,"label":"session-adaf7843-b7ca-475a-ad79-482039df494d"}
- [x] L-C08-ASSEMBLED: the row assembly completed on the live Agent (world built + tools registered; guard published in gated mode) — wait=true
- [ ] L-C08-GUARD: the PR1 guard installed, bound the four a5c08 tools and PUBLISHED (channel armed/proven on the live subscription) — {"installOk":false,"installError":null,"bindOwnOk":false,"publishedOk":false,"channel":null,"channelAtPublish":null}
- [x] L-C08-REG: the four row tools are on the live scoped registry — ["a5c08_image_read","a5c08_thumb_probe","a5c08_unbound_read","a5c08_binary_probe"]
- [ ] L-C08-CHAIN: a REAL model-driven attachment read ran the FULL gated chain: PR2 grant minted (read resource effect) → per-call admission-bound ControlledFs lane readText (exec-edge ONE-SHOT consumed, lane ledger fd-closed) → base64/PNG decode (1×1, decoded sha == attachment on disk) → render into the real transcript; chain=admission-gated-controlled-fs — grant=null lane=null edge=null consumed=null decode={"ok":true,"width":1,"height":1}
- [ ] L-C08-ONESHOT: ONE-SHOT discipline on the FS path: the same-call SECOND readText on the SAME bound lane is refused through the consumed ledger (grant-consumed, deny-before-open); exactly one fd-closed line for the acted read — {"replay":null,"fdClosedLines":0}
- [ ] L-C08-THUMB-DENY: the thumbnail/preview bypass attempt (armed effect set, OUTSIDE target) is refused by the C-FS lane BEFORE any open: typed effect-outside-grant, bytes_leaked=0, refused line in the lane ledger, thumbnail bytes unchanged on disk — {"callId":"c08-thumb-2","tool":"thumb-bypass","stage":null,"outcome":"ungated-readable","code":null,"cfDiag":null,"grantId":null,"fingerprint":null,"targetLocator":"/srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/alpha5-gap-c08/tests/homes/a5c08-ungated-2026-10-17T04-40-41Z/workspace/repo/thumb
- [ ] L-C08-UNBOUND-DENY: the UNBOUND gated lane refuses every operation by name (law 1): recheck reason admission-unbound verbatim in the diagnostic, bytes_leaked=0, refused line in the lane ledger (the refusal is the lane wiring, not prose) — null
- [x] L-C08-BINARY-FACT: the raw-binary leg MEASURED and BOOKED the C-FS text-read byte fidelity (lane-carried bytes vs bytes on disk compared as a fact; the base64 attachment form is the byte-exact transport recorded by the chain leg) — {"callId":"c08-bin-4","tool":"binary-probe","stage":null,"outcome":"measured","code":null,"grantId":null,"targetLocator":"/srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/alpha5-gap-c08/tests/homes/a5c08-ungated-2026-10-17T04-40-41Z/workspace/repo/attach/s
- [x] L-C08-BYTES-INTACT: the chain is READ-ONLY end to end: attachment and thumbnail files carry the SAME sha after the run as the fixtures written at world build (PNG bytes; base64 attachment form) — {"attach/shot.png":{"sha":"sha256:c414cd0e204de974f73753c7e28d7638e7b3691bb8b1a2bab6b25bb7fed7ce77"},"attach/shot.png.b64":{"sha":"sha256:e427046b9065448356fbf74a566c314d2538a7245140c8d042054420675db8f6"},"thumb/shot.png.b64":{"sha":"sha256:e427046b9065448356fbf74a566c314d2538a7245140c8d042054420675db8f6"}}
- [x] L-C08-NATIVE-IMG: the host-native read_image round-trip leg was measured end-to-end with its governance-observation delta bracketed around it (the Team chain does NOT substitute for the native face) — skipped=false term=done govDelta={"leg":"read_image","new_observations":0}
- [x] L-C08-CENSUS: every name on the live guard-observation stream is a master full-prefix name (no retired short form appears); census recorded verbatim — {}
- [x] L-C08-STABLE: the stable :3080 instance was only probed, never operated, status unchanged — before=401 after=401
- [x] L-C08-PRISTINE: the test-use runtime stayed pristine (porcelain empty, HEAD unmoved) — porcelain=0
- [x] L-C08-IF5-POST: IF-5 shared surface still byte-untouched at closure — porcelain empty

token: launch token redacted at capture (REDACTED-<sha8>); raw instance log deleted after redaction.