# Phase 0 spike run history — 0.1.7-rc.1 restart-recovery characterization

All runs: fresh world under `tests/homes/rst017-spike-<stamp>`, mock model on
3497, host on 3492 (3491 blocked by the pre-existing orphan host, see
`orphan-host.md`), test-use @ 46a7f68b09 pristine (verified per run). Evidence
per run: `run<N>/{install,legA,legB,legC,probe-events,summary,world,diagnostics}`.

## Confirmed host facts (stable across runs)

- ONE EventsService per root Context; `{ global: true }` patch-layer listeners
  capture `agent/created` for boot-root AND dynamic roots (source=startup at
  create, source=resume at restart). C1 fence listener placement is viable.
- **The TEAM glue's boot-resume loop re-adopts every Team root at boot**
  (boot root first, then the dynamic roots, ≈ +150–500 ms after the boot
  marker; source=resume) — run 8/9 + repro2 probe JSONL. CORRECTION to an
  earlier claim: this is the dsh-agent-team glue (its `bootPhase: resume`
  domain walk), NOT a stock-host recovery pass — a stock-only boot of the
  same world does not re-adopt the dynamic root (repro3 W4; and the earlier
  ws-diag standalone boot). The writer steal is therefore a BOOT-TIME event
  (glue boot-resume), with the browser `session/follow` background promote
  (see below) as a second opportunity — the fence must be armed at row load
  (autoArm, proven in run 9) to catch the boot-resume.
- **Every Session RESUME appends a plain `session/end-seed {}` row** to the
  log (core/session constructor, index.ts:618 — "restore retains that durable
  marker and appends only the ordinary resume marker"). A log ending in a
  plain end-seed = its last incarnation ended. Run 9/repro2 veto-rollback
  leaves the marker in place, so a vetoed root's log ends terminal-looking
  even though the rollback only undid the agent, not the session history.
- **`session/follow` promotion is FIRE-AND-FORGET** (session-controller
  index.ts:201–212): the follow generator yields the snapshot FIRST, then
  kicks the resume as a background task; a failing promote surfaces as a
  broadcast `api-session/error` (`resume failed for session "…": …`) and the
  follow stream keeps streaming durable events — the stream (and socket)
  should survive the rejection.
- **The 0.1.7 mux host terminates heart-beat-dead clients**: `PING`
  every 2000 ms (config `websocketHeartbeatIntervalMs`, default 2 s);
  after 2 consecutive missed PONGs the host `terminate()`s the socket
  (frameless TCP close — no WS close frame, no log line). A raw client
  that does not answer PING with PONG therefore dies ~6 s after
  upgrade. (ws@8-based clients answer automatically; the spike's raw
  client answers in isolation but evidently not in the full run — run
  13 isolates the stop point.)
- The re-adopted foreign agent is NOT in the Team glue's `liveAgents`, so
  `team.ensureRootLive` after the steal fails with the stock
  `SessionAlreadyOwnedError` message: `session "…" is already owned by an
  active write handle` (wrapped in `TEAM_REMOTE_TEAM_ROOT_LIVE_START_FAILED`)
  — run 8 Leg A baseline, `legA/ensure-root-live-baseline.json`.
- Session logs (`session.v4.jsonl.zstd`) are CONCATENATED multi-frame zstd
  (frame 1 = header line, one frame per durable append batch). Node's
  `zstdDecompressSync` decodes only the first frame — the spike's
  `countAssistantRows` uses a ported frame scanner (upstream
  `scanZstdFrames`, read-only reference) + per-frame decode. Run 7 dyn log:
  12 frames, 34 rows, 2 assistant rows (initial-work turn + takeover turn).
- `session/follow` wire shape: `payload.args.request.address` (a flat
  `args.address` → `gateway/arguments-invalid: missing "request"`).
- Raw WS client→server frames MUST set the RFC 6455 mask bit on the second
  header byte; the real ws@8.21.0 receiver closes 1002 otherwise. Fixed in
  the kit (run 7+).
- Mock traffic on a fresh team leader: request #1 = session title-generation
  call (tools=0, needle embedded in JSON user text); request #2 = the leader
  turn (39 tools incl. team_*). The initial-work model request arrives BEFORE
  the `team.create` HTTP response → never filter on post-response `sinceAt`.

## Runs

- **run 1–4** (archived earlier rounds): kit bring-up — install chain
  (S1–S3), boot gating, `team.create` v1 with inline `initialWork` working,
  raw WS client against the real gateway.
- **run 5**: first real-host run of the full legs. Crashed at boot 2 (WS
  close frame threw through the socket data handler — kit teardown gap).
  Fence probe recorded events (agentId null — payload reads `agent.id`, not
  `agentId`; fixed). Left the orphan host on 3491 (see `orphan-host.md`).
- **run 6**: kit hardened (`_safeFrame`, close-frame recording, main() catch
  with host teardown). WS 1002 closes on boot 2/3 — root cause: missing mask
  bit on client frames (lenient fake-gateway smoke had hidden it).
- **run 7**: mask fixed; `session/follow` shape fixed to `args.request`;
  A2/A3 finally PASS (title-call vs leader-call needle pollution resolved via
  user-text prefix matching, no sinceAt). 10 FAILs all from the follow shape
  (pre-fix builds) + B3–B5 cascades (no veto ever fired — see run 8 root
  cause). `countAssistantRows` undercount discovered (single-frame zstd).
- **run 8** (`2026-09-26T04-16-18`, 24 PASS / 10 FAIL):
  - **A6 PASS — BASELINE BLOCKER REPRODUCED**: after the stock re-adopt,
    `team.ensureRootLive` fails with the writer-held wording (above).
  - B3/B4/B5 null — the armed fence NEVER vetoed. Root cause found in the
    written `cordis.patch.yml`: the kit's `yamlEmitItem` serialized the
    string array `teamSessions: [DYN_ROOT]` as a numeric-keyed character map
    (`{0: "s", 1: "e", …}`) — the probe's `Array.isArray` guard saw a non-array
    → empty set → veto unreachable. Fixed (scalar sequence elements).
  - A4/B2/C2 "ws closed by host" (no close frame) — see `ws-diag-findings.md`:
    client protocol proven sound (100 s hold, all PONGs). [SUPERSEDED: the
    follow-close isolation below RESOLVED this — no host-side socket kill;
    the spike's A4/B2 closes are a kit/boot-sequence artifact, C2/C3 a
    socket-reuse cascade.]
  - A6b detection string updated to the real writer-held wording.
  - B11 now meaningful (multi-frame reader: 31 rows / 1 assistant).
- **ws-diag** (standalone instrumented client, run-8 world): protocol sound;
  follow on a NOT-live session → `session/not-found` error frame, socket
  survives. Side finding: dead `DEEPSEEK_BASE_URL` port hangs a standalone
  boot pre-URL (model-provider init retry); spike unaffected (live mock).
- **run 9** (`2026-09-26T04-32-14`, 30 PASS / 5 FAIL):
  - B1 PASS — fence auto-armed at row load (YAML char-map fix holds).
  - **Q1 ANSWERED = YES**: the armed fence VETOED the glue boot-resume of
    DYN (04:33:00.385, source=resume) → AgentLoop rollback
    (`agent/disposed` +2 ms) → `api-session/error` broadcast with the exact
    production wording → `team.ensureRootLive` then SUCCEEDED (B7: the writer
    was released by the rollback).
  - B8 exactly one permitted activation (one-shot permit consumed by the
    glue's own takeover, 04:33:06.388); B9 takeover turn with 13 team tools;
    B10 exactly one model request since the veto; B11 log intact (30 rows /
    1 assistant row).
  - A6/A6b baseline blocker reproduced (writer-held wording).
  - B1a FAIL = kit timing bug: the boot-gate event snapshot landed ≈ 180 ms
    BEFORE the glue's DYN boot-resume veto; the veto itself DID fire (it is
    the B3 event). Run 10 must settle-wait before the B1a snapshot.
  - A4/B2/C2 "ws closed by host" (frameless TCP close) — see below.
- **follow-close isolation — repro shapes exonered, spike-kit shape still
  reproduces** (`follow-repro.mjs`, `follow-repro2.mjs`,
  `repro3-bisect.mjs`, `repro4-hook.mjs`, `repro5-spike-shape.mjs`,
  `diag-hook.mjs`):
  - **Every "host close" in the repro scripts was the script's own
    `socket.destroy()` teardown.** repro4-run2 with client forensics:
    `closeCode=null peerFIN=false destroyedByUs=true` — the host sent no
    FIN/RST/close-frame; the socket stayed alive 6 s post-snapshot with
    clean PING/PONG. repro5-runA S1/S2: same (`destroyedByUs=true`).
  - **Host-side runtime hook** (`NODE_OPTIONS --import diag-hook.mjs`,
    zero source modification): over the whole follow lifetime the host
    logged NO ws `terminate()`/`close()` call, NO net `error`, NO host
    `destroy()`; the only ws-level close was the post-close no-op
    `bindPeer` disposer (`close(1001, 'peer left')` — that is the
    CONSEQUENCE of the socket's 'close' event settling the mux
    connection's `run()`, i.e. `done.then(() => release())`, not the
    cause). The webserver attaches a raw-socket `error → destroy()`
    handler on upgrade (host/webserver index.ts:258-263) — it never
    fired in any run.
  - Shapes proven host-stable (snapshot delivered, stream + socket
    survive indefinitely): cold DYN (W4 stock-only, repro2-V1, repro4),
    live DYN via glue boot-resume (W3), $events+follow on one socket
    racing the glue boot-veto (repro5-runA S1 — the exact spike B2
    shape; the follow's background promote DEDUPES with the in-flight
    glue resume: ONE veto, ONE `api-session/error`, stream survives),
    follow-only control (repro5-runA S2), ORD session with $events
    (repro1).
    - **Consequence for the spike's A4/B2/C2 "ws closed by host"**: not
    reproducible in any ISOLATED repro shape, but run 10 REPRODUCED it on
    the spike's own 3-boot cycle (A4 on boot 2, B2 on boot 3). The spike
    client's op-0x8 branch records the close code (`ws closed by host
    (code=...: reason)`) and closes gracefully; run 10's trace shows the
    BARE string (no code) and zero rx frames after the follow open =>
    frameless TCP close, host-side. repro5-runA/B (same $events+follow
    shape, older world) did NOT reproduce it; run 9's C2/C3 were cascade
    artifacts of the dead wsB (the kit reused it). The discriminator is
    the fresh-world 3-boot sequence / exact follow timing, not the wire
    shape. Run 12 attaches the host hook to the spike's own boots to
    capture the host-side mechanism.
- Keep-mode run + browser Q2 leg (error-lane persistence after takeover) —
  still pending.

## Runs (cont.)

- **run 10** (2026-09-26T05-05-16, world `rst017-spike-2026-09-26T05-05-16`;
  fixed kit: B1a settle-wait, B2 reframed + B2b/B2c, A4b, Leg C own socket,
  `RST017_WS_TRACE=1`; evidence `run10/`): 27 PASS / 6 FAIL.
  - S1–S3, A1–A3, A5–A6b all PASS; A6 baseline blocker reproduced
    (writer-held wording, exact).
  - **A4/A4b FAIL AGAIN on the fresh world**: boot-2 (passive) DYN follow —
    "ws closed by host", `closed=true`. Trace: $events open → ready →
    follow open → SILENCE (no snapshot, no error, no close frame). So the
    frameless close REPRODUCES in the spike's 3-boot cycle but NOT in any
    isolated repro (repro2/4/5 on the older world). DYN log at A4 time
    ENDS IN a plain end-seed (boot-1 teardown appended it, seq 22 @
    turn 1 completion +1.5 s) — same terminal-looking state as the
    repro5 world, so log shape is NOT the discriminator.
  - B0/B1 PASS (boot 3: fence armed at row load @05:06:01.841; the
    05:06:02.122 `agent/created source=resume veto=false` is the BOOT
    ROOT re-adopt — 181 ms after arm — NOT the DYN root; sids share a
    20-char suffix so the raw dump is ambiguous, the full-sid analysis
    settles it). **B1a FAIL (REAL FINDING)**: the glue did NOT re-adopt
    the DYN root at boot 3 — the 60 s settle-wait saw no DYN
    agent/created at all; the first DYN event is the B2 follow's own
    promote veto @05:07:02.547 (+ disposed + api-session/error).
    NOTE: the promote ran despite the socket dying before the snapshot
    reached the client — so the follow handler had already yielded the
    snapshot and kicked the background resume (detached) before the
    frameless close landed. (Run 9's boot 3 DID get a glue DYN re-adopt
    veto @04:33:00.385 — boot-state discriminator unknown; run 12
    instruments the host to see both the re-adopt decision and the
    socket teardown.) B2/A4b FAIL (socket dead before snapshot), B2b/B2c
    FAIL (cascade). B3–B5 PASS via the q1 probe loop (veto/disposed/
    error all present), B6–B11 all PASS (permit → glue takeover
    05:07:12.077 permitted=true → takeover turn 2 with team tools →
    log 34 rows / 2 assistant rows intact).
  - **C2 PASS on its own socket** (fix works); C2b socket-alive; **C3 FAIL
    = second kit timing bug**: the ORD `agent/created source=startup`
    fires at C1's `session/create` (05:07:12.361) — BEFORE the
    post-create baseline — so the post-baseline slice is `[]`. Fixed in
    the kit (baseline now pre-create; C3 asserts the creation event).
- **run 11** (2026-09-26T05-10-27; aborted): FATAL at boot 1 — the
  host-hook import path pointed at the WORKTREE phase0 dir, where
  `diag-hook.mjs` does not live (it lives in the MAIN repo phase0).
  Side effect: the spike cleared the shared probe JSONL during its
  boot-1 preparation — the run-10 boot-3 JSONL was lost and is
  reconstructed at `run10/probe-events/fence-probe-events-boot3.jsonl`
  (see the README there for field provenance). Kit fix: hook path now
  `KIT_DIR` (main phase0).

- **run 12** (2026-09-26T05-14-10, world `…05-14-10`; host hook
  attached, C3 fix live; evidence `run12/`): 33 PASS / 6 FAIL — same six
  (A4, A4b, B1a, B2, B2b, B2c). B1a confirmed as a REAL finding (the glue
  did not re-adopt DYN at boot 3; the first DYN event is the B2 follow
  promote veto @05:15:55.434). C3/C2/C2b now PASS. Q1 chain (B3–B10) all
  PASS again (veto → disposed → api-session/error → permit →
  ensureRootLive → exactly-one permitted takeover → 13 team tools → log
  intact).
- **run 12 host-hook result — the frameless close MECHANISM is the mux
  heartbeat** (`RemoteStreamMuxServer.startHeartbeat`, gateway lib
  index.js): PING every `websocketHeartbeatIntervalMs` (default
  **2000 ms**); a client missing **2** consecutive PONGs
  (`MAX_MISSED_HEARTBEATS = 2`) gets `socket.terminate()` (no close
  frame) via `setImmediate` at index.js:244. The hook captured exactly
  this: `ws terminate() … at Immediate._onImmediate
  (gateway/lib/index.js:244:78)` on the follow socket (boot 2 S3, boot 3
  S4), with NO net error, NO ws close() before it. So: a socket that
  never PONGs dies ~6 s after upgrade.
  - **repro6** (`repro6-spike-client.mjs` + `repro6-driver.mjs`): the
    SPIKE'S OWN `RemoteMuxSocket` class, run standalone against a live
    host, receives the PINGs (`RAW 2B b0=0x89` at +2.0/+4.0/…s) and the
    class's `op-9 → _rawFrame(0xA)` PONG path keeps it alive for 12 s.
    **The client class is innocent.**
  - **run 13 ROOT CAUSE (kit parser bug — the socket-close mystery is
    CLOSED)**: with `RST017_RAW_LOG=1`, the spike socket DOES receive
    the PINGs (2B chunks `b0=0x89` at +1999/+3996ms) — but never PONGs.
    The rawlog shows the real desync: after the $events ready frame the
    follow SNAPSHOT arrives as one WS text frame of ~73 KB
    (`b0=0x81 b1=0x7f` — 64-bit extended length, because the payload
    exceeds 65535 B) split across four 'data' chunks (14480+24616+4344
    +29590 B). `RemoteMuxSocket._pump` read the 64-bit length at the
    WRONG offset — `readBigUInt64BE(need - 2)` = bytes 8..15 (first 8
    bytes of the JSON payload) instead of bytes 2..9 — so
    `payloadLen` became ~8.7e18. The parser then waits for exabytes
    forever: the snapshot is never delivered, every later rx chunk
    (including the $events api-session/error emit and both heartbeat
    PINGs) is swallowed into the buffer, no PONG is ever sent, and the
    host's heartbeat terminate lands at ~+6 s. That single bug is the
    mechanism behind every A4/A4b/B2/B2b/B2c "ws closed by host"
    failure in runs 8–13.
  - Why the other shapes never reproduced it: repro2/4/5 (older world,
    small DYN snapshot < 65536 B → 16-bit length path) and repro6
    standalone (only small frames) never exercise the 64-bit path.
  - **Kit fix (spike.mjs, RUN-14 FIX comment)**:
    `readBigUInt64BE(this.fragPayload === null ? 2 : 1)`. Regression
    test `pump-regression.mjs` (class extracted, synthetic frames):
    70KB frame in 4 chunks + PING → snapshot delivered AND PONG sent
    (PASS); small + 3KB frames PASS.
  - **run 14** = same full spike with the fixed parser (expecting
    A4/A4b/B2/B2b/B2c to PASS; B1a is a separate real finding — the
    fresh-world boot-3 glue did not re-adopt DYN). Per-run evidence
    dirs introduced (run 9's legA/legB and run 12's probe JSONL were
    lost to the shared-dir/clear-per-boot pattern; see `run13/README`).

## Pending

- **Run 14 (2026-09-26T05-25-55; fixed parser; per-run evidence dir
  `run2026-09-26T05-25-55/`)**: **37 PASS / 2 FAIL** — A4, A4b, B2, B2c
  now PASS (the 73 KB follow snapshot is delivered; sockets survive).
  Full Q1 chain PASS again (B3 veto @05:27:35.711Z with the exact fence
  wording in the wire frame, B4 disposed, B5 api-session/error, B6
  permit, B7 ensureRootLive succeeds, B8 exactly one permitted
  activation, B9 13/13 team tools on the takeover turn, B10 exactly one
  model request since veto, B11 log intact 30 rows). Leg C all PASS.
  FAILs:
  - **B1a** — confirmed real finding (3rd consecutive fresh world):
    the stock glue's boot-resume re-adopts ONLY the patch root
    (BOOT_ROOT, source=resume, unvetoed — the glue's own domain root);
    it does NOT re-adopt dynamic Team roots (DYN). The DYN root's
    first activation after a restart is always the client's
    session/follow promote — which the fence vetoes (B3). B1a is
    therefore EXPECTED on fresh worlds; keep it as a documented
    finding, not a regression. (Refines the C1 threat model: the
    fence's boot-time arm matters for the patch root; DYN steals
    happen at follow/promote time and are covered at the
    agent/created barrier.)
  - **B2b** — (was: NEW MYSTERY, client-side "30 s stall") — **CLOSED
    in run 19, root cause = kit bug in `waitForEventFrame` +
    `RemoteMuxSocket.next()` microtask semantics — see RUN-19 below.**
 - **Run 15 (2026-09-26T05-31-01; lag watchdog added)**: **37 PASS /
   2 FAIL** (B1a + B2b). New `RST017_LAG=1` watchdog reported
   `EVENT-LOOP BLOCKED 30041ms; lastActivity=q1 poll
   @1790400791652` → block window [05:32:41.613 → 05:33:11.654Z],
   i.e. it started ~T0+0.03 s (right as the snapshot/emit#1 landed)
   and lasted exactly the 30 s B2b wait window. Rawlog: the burst
   (2257 B = added 1759 + removed 148 + error 346 + 2 PINGs) arrived
   as ONE chunk at +30016 ms. At the time the block was attributed to
   "client-side, undiagnosed".
 - **Run 16 (2026-09-26T05-44-39)**: 37/2. Identical 30 s signature
   (`[lag] 30086ms`) in a QUIET window (no concurrent agent activity)
   → starvation-by-own-work ruled out.
 - **Run 17 (2026-09-26T05-57-14)**: 37/2. (First attempt died on a
   transient startup MODULE_NOT_FOUND; an accidental foreground re-run
   materialized world `…05-55-59`, died on EPIPE with clean self-
   cleanup, world removed.) First run with the external CPU sampler
   (`cpu-sampler.mjs`, /proc/<pid>/stat utime+stime @100 ms): during
   the exact [lag] window the spike process accumulated **299.6 s of
   CPU in 30.1 s of wall (≈10× real time)** while the sampler (a
   separate process in the same sandbox) ticked flawlessly throughout
   → the machine was alive; the spike process itself was BURNING CPU.
   The Leg A window was clean (max 100 ms CPU / 100 ms).
 - **Run 18 (2026-09-26T06-16-35; `node --prof`)**: 37/2. V8 CPU
   profile (40 341 ticks, `isolate-0x2299a000-5-v8.log`, processed via
   `node --prof-process`) → hottest JS: `waitForEventFrame
   spike.mjs:820` (2551 ticks), `isTarget spike.mjs:822` (965), plus
   `StringEqual` (1235), `ArrayPrototypeUnshift` (728),
   `ArrayPrototypeShift` (383), `RunMicrotasks` (724),
   `PromiseResolve`/`EnqueueMicrotask`/`ResumeGeneratorTrampoline` —
   the fingerprint of a synchronous **microtask spin loop**.
 - **ROOT CAUSE (kit bug — my code, RUN-19)**: `RemoteMuxSocket.next()`
   (spike.mjs:514) resolves queued frames as IMMEDIATE microtasks
   (`if (this.frames.length > 0) return Promise.resolve(
   this.frames.shift())`). The old `waitForEventFrame` drained the
   queue, re-unshifted every NON-matching frame, then awaited
   `next()` — which instantly handed back the very frame just
   re-queued → unshift → loop top: a closed microtask loop that
   starves the socket pump, every timer (incl. the 30 s deadline) and
   the whole event loop. The loop only exits through
   `Date.now() >= deadline` — hence the "stall" duration = the wait
   timeout, exactly (30.041/30.086/30.123/30.136 s across runs).
   The spin only arms when a non-matching frame is parked in the queue
   while waiting — i.e. only AFTER the RUN-14 parser fix started
   delivering the 73 KB snapshot into the queue (runs 8–13: the queue
   stayed empty → no spin, just timeout + host heartbeat kill). Leg A
   A4 was never affected (its first queued frame WAS the target).
   Every "anomaly" retro-explains: the +30016 ms rawlog line, the
   console-order oddities, the "21 ms late" error frame — all are the
   same event-loop turn right after the deadline exit. The host was
   innocent in every run (it wrote the full burst at +17..28 ms).
 - **RUN-19 FIX (spike.mjs, waitForEventFrame)**: scan the queue
   (`findIndex`/`splice` — non-destructive) instead of drain+requeue;
   while awaiting, PARK the queue (`ws.frames.splice(0, len)`) so
   `next()` registers a REAL waiter and the pump stays free; on wake,
   restore held frames + the new frame in FIFO order; on
   close/timeout the queue is preserved for later waiters. Regression
   test `waitfor-regression.mjs` (class+function extracted, real HTTP
   upgrade server: non-matching frame parked, match arrives at +300
   ms): 5/5 PASS — match at 301 ms (old code: 5 s hang → null),
   preserved frames stay FIFO, a later waiter receives them.
 - **Run 19 (2026-09-26T06-41-30; the fix)**: **38 PASS / 1 FAIL
   (B1a only)**. B2b PASS: the full veto burst (added 1759 B +
   removed+error coalesced 494 B) delivered at **+27..28 ms**; PING
   answered at +2 s; the socket survives through Leg C's reuse (C2
   ordinary snapshot at +3.6 s, clean close frame at +3.87 s). Q1
   chain all PASS again (veto @06:43:10.852Z, exact fence wording).
   The B2b mystery is CLOSED: host exonerated, kit bug fixed,
   regression-protected.
 - **Run 20 — KEEP MODE (2026-09-26T07-03-12; the browser Q2 leg)**:
   `node spike.mjs --keep` (job bash-105): boots the world, Leg A +
   boot 3 (resume, probeReject+autoArm, DETACHED), prints the banner
   and HOLDS. B0 PASS (boot root re-adopted unvetoed), B1 PASS (fence
   auto-armed at row load), B1a FAIL (expected finding — boot-resume
   does not re-adopt the dynamic root; its first post-restart
   activation is always the client's ordinary promote → veto).
   Browser leg (Agent Window tab 757204183, published 0.1.7-rc.1
   client `0.1.7-rc.1-46a87f68`):
   - The cold DYN team root appears in the sidebar as
     `RST017_DONE RST017DONE_…` (title derives from the team.create
     initial-work prompt); the boot root is not listed as an ordinary
     session.
   - Ordinary open of the cold DYN session → fence veto
     (07:12:23.148Z, source=resume) → disposed + api-session/error
     with the EXACT C1 fence wording → composer locked at
     `会话不可用` (screenshot `legB/q2-browser/01-vetoed-…png`).
     The client fired a SECOND promote attempt at +32 ms (vetoes = 2).
   - Kit watcher saw the browser-triggered veto (banner+15 s guard
     respected) → one-shot permit (07:12:23.365Z,
     `keep-permit-after-veto.json`).
   - 团队 tab → `以 Team 模式打开 / 回到 Leader` → agent/created
     07:13:12.649Z **veto=false permit=TRUE** — takeover consumed the
     permit and PASSED; no further api-session/error.
   - **Q2 ANSWER**: immediately after the successful takeover the
     composer is STILL `会话不可用` [disabled] (same page load) — the
     client does NOT reconcile the veto error state on takeover
     success. After a full page reload the session re-opens directly
     in Team mode, composer ENABLED, fully functional (verification
     message answered by the leader, 2nd round completed, 4K tok).
     → persistent WITHIN the veto page load, recoverable by ONE
     reload, no data loss, no corruption. Full timeline +
     accessibility-tree evidence: `legB/q2-browser/Q2-FINDING.md`.
   - Teardown anomaly: `job_kill` on bash-105 destroyed the bwrap
     namespace (`--die-with-parent`) — the kit's SIGTERM handler never
     ran, so the keep-final evidence block never executed. Host+mock
     died with the namespace (ports freed, no orphans); the world home
     survived on disk.
 - **Run 20-keepfinal — K1 reconstruction (host 4, 07:22Z)**:
   `keepfinal.mjs` (job bash-107) booted host 4 on the surviving
   world; the world's boot-3 patch auto-loaded the fence probe
   (reject+autoArm); one-shot permit granted; **team.ensureRootLive
   (DYN) → status 200 ok=true `{mode:"team", live:true}`** (23 ms
   permit→created). **K1 PASS**: vetoes=2, disposed=2, teamResume=2,
   apiErrors=1, takeover=200. Boot-4 reproduced B1a exactly (only the
   boot root re-adopted). Lost: boot-1..3 in-memory mock logs (never
   flushed) — no gate impact (see `legB/keep-final-reconstruction.md`,
   `verdict/q1-q2.json`). Driver bug fixed in committed source
   (`events` envelope of `GET /__fence/events`).

## Pending

- ~~Keep-mode run + browser Q2 leg~~ **DONE** (run 20 + keepfinal):
  Q2 = persistent within the veto page load, one-reload recovery, no
  corruption. `verdict/GO-NO-GO.md` written (verdict GO — 7 gates,
  gate 5 with the client-reconciliation note for Commit 3).
- Commit 1 (characterization only): consolidate the MAIN workspace
  phase0 kit sources + artifacts into the worktree phase0 evidence
  tree (spike.mjs + RUN-14/RUN-19 fixes, repro6-*, pump-regression.mjs,
  waitfor-regression.mjs, cpu-sampler.mjs, diag-hook.mjs, zstd-tail.mjs,
  run-history.md, verdict/, spike-run*.log, repro dirs, orphan-host.md;
  spike worlds inventoried incl. run-14 `…05-25-55`, run-15 `…05-31-01`,
  run-16 `…05-44-39`, run-17 `…05-57-14`, run-18 `…06-16-35`, run-19
  `…06-41-30`; scratch `…05-55-59` already removed; orphan world
  `…16-26-55` + host pid 671881 recorded, untouched).
- Commits 2–4 (activation core / ordinary permit / real-host kit
  Worlds A–E) + §17 verification + bookkeeping per the guide's
  mandated order.
