# keep-final reconstruction (host 4)

- **Reconstructed at**: 2026-09-26T07:22:21Z (driver `keepfinal.mjs`, job bash-107; log `spike-run20-keepfinal.log`)
- **Why**: the keep kit (PID 3 in job bash-105's bwrap namespace) never received its
  SIGTERM. `job_kill` destroyed the whole namespace (`bwrap --die-with-parent`), so the
  kit's `process.once('SIGTERM', resolveHold)` hold-release and the keep-final evidence
  block (spike.mjs :1549–1585) never executed. Host and mock died with the namespace
  (ports 3492/3497 freed — no orphans); the world home
  `tests/homes/rst017-spike-2026-09-26T07-03-12` SURVIVED on disk (workspace file),
  including the boot-3 patch layer (fence probe `reject=true, autoArm=true,
  teamSessions=[DYN_ROOT], reportDir = this run's probe-events/`).
- **What the driver did**: booted host 4 on the same world (world patch auto-loads the
  probe; the probe appended to the surviving JSONL), verified fence
  auto-arm (`armed=true reject=true teamSessions=[DYN]`), granted the one-shot permit
  (the C1 runOwned pass-through emulation for the Team's own post-restart activation),
  and called the missing live check:
  `team.ensureRootLive(DYN_ROOT)` → **status 200, ok=true,
  `{rootSessionId: DYN, mode: "team", live: true}`** (23 ms from permit: permit
  07:22:21.134Z → agent/created permitted 07:22:21.157Z).
  Then: SIGTERM host (port free), mock closed, teardown clean.
- **Boot-4 observations**: the glue boot-resume re-adopted ONLY the boot root
  (`session-rst017-boot-…`, source=resume, unvetoed — not in the fence's teamSessions);
  the DYN root was cold until the permitted ensureRootLive — the B1a finding
  reproduces exactly on the fourth boot of this world.
- **K1**: `PASS — {vetoes: 2, disposed: 2, teamResume: 2, apiErrors: 1, takeover: 200}`
  (teamResume events: 07:13:12.649Z browser takeover, 07:22:21.157Z host-4 ensureRootLive).
- **Lost (irrecoverable)**: the in-memory mock request logs of the boot-1..3 mock
  instances (died with the namespace, never flushed). Impact: none for the gates —
  the post-veto model-traffic question is answered by the browser leg (exactly one
  model request after the first veto: the 07:16Z Team-mode leader reply to the manual
  verification message; zero foreign ordinary-Agent requests). See `verdict/q1-q2.json`.
- **Driver bug note**: the first driver run crashed at `eventsK.filter` (the
  `GET /__fence/events` body is `{ok, events:[…]}`, not a bare array); the fix is in
  `keepfinal.mjs` (committed source). All evidence files were written before the crash
  except `verdict/q1-q2.json` + this note, which were completed offline from the
  authoritative probe JSONL + `keep-final-ensure-root-live.json`.
