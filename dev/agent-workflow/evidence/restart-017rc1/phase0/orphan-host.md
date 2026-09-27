# Orphan host on port 3491 — record of state + user decision

## What is running

- Process: a `dsh web` host from **run 5's world**
  (`tests/homes/rst017-spike-2026-09-25T16-26-55`), pid **671881**
  (pid as seen from the host PID namespace; the sandbox shell's PID
  namespace does not show host processes).
- Port: **3491** LISTEN (verified via `ss -ltnp` from inside the sandbox).
- Cause: run 5's kit crashed (boot-2 WS close frame threw through the socket
  data handler) before its teardown ran, leaving the boot-1 host alive.

## Why it was not killed (binding user decision)

Killing it requires signal delivery outside the sandbox PID namespace
(danger-full-access escalation). One such escalation attempt was made and
**the user rejected it and required that NO global/out-of-sandbox escalation
be attempted again**. Per that decision the orphan is left in place; all
subsequent kit runs use port **3492** (host) / **3497** (mock) —
env-overridable in `spike.mjs`.

## Impact + workaround

- Port 3491 is blocked for test hosts; 3492/3497 used instead (no conflict:
  the orphan holds no DSH_HOME lock on any later world — each run gets a
  fresh world).
- The orphan world (`rst017-spike-2026-09-25T16-26-55`) must NOT be deleted
  while the host runs.
- Resolution path (when the user allows it): `kill -TERM 671881` from the
  host side, or let it die naturally; then the world can be cleaned per
  TEST_METHODS.md §7.
