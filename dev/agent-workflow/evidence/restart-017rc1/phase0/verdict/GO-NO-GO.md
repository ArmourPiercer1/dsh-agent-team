# Phase 0 Verdict — dsh-agent-team restart-recovery 0.1.7-rc.1 (C1 public fence)

**Task**: `task/team-restart-017rc1` · **Guide**: `docs/plans/active/dsh-agent-team-restart-recovery-0.1.7-rc.1-guide.md`
**Host baseline**: pristine upstream 0.1.7-rc.1 @ `46a7f68b0922371ce7144b668b90e377d8e799f4` (test-use, HEAD never moved)
**Date**: 2026-09-26 · **Evidence**: this directory's `../` tree (runs 5–20, repros 1–6, prof-run18) + `run-history.md`

## VERDICT: **GO** — proceed to Commit 2 (C1 activation core)

All seven §14 gates PASS on the published 0.1.7-rc.1 client + host, with one
documented client-side reconciliation gap that Commit 3's two-phase open must
close (gate 5 note). The §14 NO-GO condition (persistent user-visible
api-session/error that no public seam can clean) does NOT hold: the error is
recoverable, the server state is clean, and the recovery path (Team takeover +
one-shot permit) is exactly the flow C1 implements. B+ is NOT triggered.

## The 7 gates (§14)

| # | Gate | Required | Result | Evidence |
|---|------|----------|--------|----------|
| 1 | `agent/created` rejection | really rolls back | **PASS** — every veto is followed by `agent/disposed` (exact generation, agentId = sessionId): 06:43:10.852Z→.854Z (run 19); 07:12:23.148Z→.150Z and .180Z→.182Z (run 20 browser) | run19 `legB/probe-events*`; run20 `probe-events/fence-probe-events.jsonl` |
| 2 | `agent/disposed` | exact generation arrives | **PASS** — B4 PASS in runs 10/12/13/14/15/16/17/18/19; disposed events carry the vetoed agentId and no later event resurrects the generation | same probe JSONLs |
| 3 | writer | reclaimable after rollback | **PASS** — run 19 B7: `team.ensureRootLive` ok after veto+dispose+permit; **run 20 keepfinal**: ensureRootLive on host 4 (a REAL restart after the browser takeover) → 200 `{ok:true, mode:"team", live:true}` in 23 ms | run19 `legB/*-ensure-root-live*`; run20 `legB/keep-final-ensure-root-live.json` |
| 4 | first model request | foreign ordinary Agent = 0 | **PASS** — B10 PASS (run 19): exactly one model request total, the expected Team-root work; zero foreign ordinary-Agent requests after the first veto. Run 20 keep world: the only post-veto model request is the 07:16Z Team-mode leader reply to the manual verification message | run19 `legB/mock-requests.json`; run20 `verdict/q1-q2.json` |
| 5 | UI error | no unacceptable persistent error | **PASS (with note)** — Q2 (run 20 browser): the vetoed ordinary open locks the composer at `会话不可用`; the successful Team takeover does NOT clear it within the page load; ONE reload recovers (client re-opens in Team mode, composer enabled, session fully functional — leader answered a verification message). No data loss, no corruption, no stuck server state. **Note → Commit 3**: the C1 client two-phase open must reconcile the composer state on takeover success; otherwise the published-client sticky state ships with the fix | run20 `legB/q2-browser/Q2-FINDING.md` + screenshots |
| 6 | ordinary Session | completely unaffected | **PASS** — C3 PASS (run 19 Leg C): ordinary session snapshot +3.6 s, clean close frame +3.87 s, ordinary flow untouched by fence/probe; run 20 boot-2 (probeReject=false) A5: ordinary promotion fires unvetoed as stock | run19 `legC/*`; run20 `legA/*` |
| 7 | Team lifecycle | Team ends up holding a real AgentHandle | **PASS** — B7 ensureRootLive ok; B8 exactly-one permitted activation; B9 leader surface carries all 13 team tools; B11 session log intact (30 rows, multi-frame zstd); run 20: leader processed the post-takeover message (real handle, 2 rounds) | run19 checks; run20 browser leg + keepfinal |

**Q1 (does the public fence work end-to-end on the wire?) = YES.**

## Documented findings (not gate failures)

- **B1a — boot-resume does not re-adopt dynamic Team roots** (reproduced on 7
  fresh worlds: runs 10/12/13/14/15/19 + run 20 boots 3 and 4): the stock glue
  boot-resume re-adopts ONLY the patch root (`source=resume`, unvetoed). A cold
  dynamic Team root's first post-restart activation is always the client's
  ordinary promote → fence veto → Team recovers via 以 Team 模式 打开 + one-shot
  permit. This is precisely the failure mode the guide targets; C1's permit
  flow handles it. Expected FAIL on fresh worlds, not a regression.
- **B2b — 30 s "socket stall" (runs 14–18) = KIT BUG, CLOSED**: `RemoteMuxSocket.next()`
  resolves queued frames as immediate microtasks; old `waitForEventFrame`
  drain→requeue→`next()` formed a closed microtask spin that starved the pump,
  all timers (hence the stall = the 30 s wait timeout, exactly) and the event
  loop. Diagnosed via quiet-window lag (run 16), per-process CPU (run 17:
  299.6 s CPU / 30.1 s wall ≈10×), `--prof` (run 18: 40341 ticks in the
  waitForEventFrame spin). Fixed in RUN-19 (non-destructive scan + queue
  parking); regression `waitfor-regression.mjs` 5/5; run 19 B2b PASS
  (+27..28 ms burst delivery). Host was innocent in every run.
- **Run-20 teardown anomaly**: `job_kill` destroys the bwrap namespace
  (`--die-with-parent`) — the kit's SIGTERM keep-final handler cannot run when
  the job is killed that way. Reconstructed via `keepfinal.mjs` (host 4 on the
  surviving world; `legB/keep-final-reconstruction.md`). Kit note for future
  keep runs: kill the KIT PID from INSIDE the namespace, or accept
  reconstruction.
- **64-bit WS length bug (runs 8–13, RUN-14 fix)**: frames >65535 B (the
  ~73 KB follow snapshot) use 64-bit length; the old parser mis-framed →
  socket death. Fixed + regression `pump-regression.mjs` 3/3.
- **0.1.7 mux heartbeat kills PONG-less clients framelessly** (2 s × 2 misses,
  gateway `lib/index.js:244`, `MAX_MISSED_HEARTBEATS=2` at :172) — a
  client-side observation constraint, documented in `run-history.md`.

## Scorecard summary

| run | result | milestone |
|---|---|---|
| 10 | 27/6 | first full leg-A/B structure |
| 12 | 33/6 | per-run evidence dirs |
| 13 | 6 FAIL | 64-bit root cause isolated |
| 14 | 37/2 | RUN-14 parser fix; B2b stall appears |
| 15 | 37/2 | lag watchdog |
| 16 | 37/2 | quiet-window starvation ruling |
| 17 | 37/2 | per-process CPU ≈10× |
| 18 | 37/2 | `--prof` microtask-spin fingerprint |
| 19 | **38/1 (B1a only)** | RUN-19 fix; B2b CLOSED |
| 20 keep | B0/B1 PASS, B1a expected | browser Q2 leg; Q2 answered |
| 20-keepfinal | **K1 PASS** | ensureRootLive after real restart: 200 team/live |

## Conditions / follow-ups carried into Commits 2–4

1. **Commit 3 (C1 ordinary-mode permit) MUST include** the client composer-state
   reconciliation on takeover success (gate 5 note) — test: veto → takeover →
   composer enabled WITHOUT reload.
2. Commit 2 implements the fence exactly as characterized: rejection = the ONLY
   veto path; exact wording
   `dsh-agent-team: intercepted foreign Agent activation for Team-managed session "<sid>"`;
   writer-held detection via "already owned by an active write handle";
   exactly-one-retry recovery; `mapEnsureRootLiveError` p6t6-keyed;
   `sessionPersistence.stat()` seam; delete `sessionIsDurable`; 9-site wrappers
   in `live/agent-bindings.mjs`.
3. B1a remains a characterization fact: C1 must make the FIRST post-restart
   activation of a cold dynamic root a permitted Team activation (the client
   two-phase open does this in the product flow).
4. Keep-mode kit: add a `--keep` teardown that works from OUTSIDE the namespace
   (or document the kill-the-kit-PID-inside procedure) so keep-final evidence
   no longer needs reconstruction.
5. NO-GO papering-over rule honored: the Q2 sticky error is NOT addressed by
   client-side error swallowing; it is a state-reconciliation gap closed by the
   designed two-phase open (Commit 3), with the wire-level veto behavior kept
   exactly as characterized.
