# EXCLUDE-FROM-PUBLISH - boot auth tokens in captured live logs (root urgent security order)

- TRacked copies at HEAD are now FORWARD-COMMIT REDACTED (same-shape
  `?token=<value>` -> `?token=REDACTED-AUTH-URL`; structure stays auditable).
  No force-push, no history rewrite, no file deletion (root law).
- The captured value = the host's BOOT-ONLY auth URL for the loopback test
  world (127.0.0.1:3186). Every recorded world is STOPPED (probe: connection
  refused on every port in every summary.json); boot tokens die with their
  instance and are never reused (each boot mints fresh) -> NOT usable.
  Repo visibility = private (parent-verified line).
- RAW VALUES persist ONLY in git HISTORY BLOBS (pre-redaction commits,
  incl. the local .git objects; per root order history is NOT rewritten).
  The homes/ raw copies were already gone under the TEST_METHODS §7 world
  cleanup protocol - this note records that the working tree contains zero
  raw values after this commit and history retains them by decision.
- ANY export / package / attachment / public paste must exclude the tracked paths below
  (pre-redaction blobs in history are equally in scope):
- dev/agent-workflow/evidence/alpha5/jobs-isolation/dev-runs/runs/live-2026-10-19T08-12-57/instance-z1.log (L2)
- dev/agent-workflow/evidence/alpha5/jobs-isolation/dev-runs/runs/live-2026-10-19T08-12-57/instance-z1.tail.log (L2)
- dev/agent-workflow/evidence/alpha5/jobs-isolation/dev-runs/runs/live-2026-10-19T08-13-25/instance-z1.log (L2)
- dev/agent-workflow/evidence/alpha5/jobs-isolation/dev-runs/runs/live-2026-10-19T08-13-25/instance-z1.tail.log (L2)
- dev/agent-workflow/evidence/alpha5/jobs-isolation/dev-runs/runs/live-2026-10-19T08-13-55/instance-z1.log (L2)
- dev/agent-workflow/evidence/alpha5/jobs-isolation/dev-runs/runs/live-2026-10-19T08-13-55/instance-z1.tail.log (L2)
- dev/agent-workflow/evidence/alpha5/jobs-isolation/dev-runs/runs/live-2026-10-19T08-14-39/instance-z1.log (L2)
- dev/agent-workflow/evidence/alpha5/jobs-isolation/dev-runs/runs/live-2026-10-19T08-14-39/instance-z1.tail.log (L2)
- dev/agent-workflow/evidence/alpha5/jobs-isolation/dev-runs/runs/live-2026-10-19T08-14-53/instance-z1.log (L2)
- dev/agent-workflow/evidence/alpha5/jobs-isolation/dev-runs/runs/live-2026-10-19T08-14-53/instance-z1.tail.log (L2)
- dev/agent-workflow/evidence/alpha5/jobs-isolation/dev-runs/runs/live-2026-10-19T08-16-23/instance-jobs.log (L2)
- dev/agent-workflow/evidence/alpha5/jobs-isolation/dev-runs/runs/live-2026-10-19T08-16-23/instance-jobs.tail.log (L2)
- dev/agent-workflow/evidence/alpha5/jobs-isolation/dev-runs/runs/live-2026-10-19T08-16-23/instance-z1.log (L2)
- dev/agent-workflow/evidence/alpha5/jobs-isolation/dev-runs/runs/live-2026-10-19T08-16-23/instance-z1.tail.log (L2)
- dev/agent-workflow/evidence/alpha5/jobs-isolation/dev-runs/runs/live-2026-10-19T08-16-47/instance-jobs.log (L2)
- dev/agent-workflow/evidence/alpha5/jobs-isolation/dev-runs/runs/live-2026-10-19T08-16-47/instance-jobs.tail.log (L2)
- dev/agent-workflow/evidence/alpha5/jobs-isolation/dev-runs/runs/live-2026-10-19T08-16-47/instance-z1.log (L2)
- dev/agent-workflow/evidence/alpha5/jobs-isolation/dev-runs/runs/live-2026-10-19T08-16-47/instance-z1.tail.log (L2)
- dev/agent-workflow/evidence/alpha5/jobs-isolation/dev-runs/runs/live-2026-10-19T08-17-44/instance-jobs.log (L2)
- dev/agent-workflow/evidence/alpha5/jobs-isolation/dev-runs/runs/live-2026-10-19T08-17-44/instance-jobs.tail.log (L2)
- dev/agent-workflow/evidence/alpha5/jobs-isolation/dev-runs/runs/live-2026-10-19T08-17-44/instance-z1.log (L2)
- dev/agent-workflow/evidence/alpha5/jobs-isolation/dev-runs/runs/live-2026-10-19T08-17-44/instance-z1.tail.log (L2)
- dev/agent-workflow/evidence/alpha5/jobs-isolation/runs/jobs-live-2026-10-20/live-2026-10-20T06-44-58/instance.log (L2)
- dev/agent-workflow/evidence/alpha5/jobs-isolation/runs/jobs-live-2026-10-20/live-2026-10-20T06-46-10/instance.log (L2)
- dev/agent-workflow/evidence/alpha5/jobs-isolation/runs/jobs-live-2026-10-20/live-2026-10-20T06-46-55/instance.log (L2)
- dev/agent-workflow/evidence/alpha5/jobs-isolation/runs/jobs-live-2026-10-20/live-2026-10-20T07-14-02/instance.log (L2)

S2 WORDING (iron law, root round F): forward sanitization does NOT erase
history tokens - the pre-redaction blobs REMAIN in git history (local; and in
remote history for pushed heads). NOTHING here claims history is cleared.
The three load-bearing facts, PENDING until each is evidenced per root order:
(1) boot-only token, (2) world stopped, (3) bind scope. EVIDENCE STATE NOW:
(2) STOPPED = evidenced for the CURRENT reality (zero LISTEN on the recorded
port 3186 via ss; every summary-recorded port probes connection-refused; no
matching process in this container's process space) - stated as observed
now, not as a historical claim. (1) boot-only = PENDING source-level proof
(host token generation site not yet pinned file:line in this lane's records).
(3) BIND SCOPE = UNKNOWN for the historical runs: the boot URL says
127.0.0.1 but a URL is NOT proof of the socket bind; the host webserver takes
host as REQUIRED config ('127.0.0.1' | '0.0.0.0' closed union,
packages/host/webserver/src/index.ts:61,:127; listen at :295) and the kit's
spawn args never set it - the effective bind of past runs is therefore
unconfirmed. The kit NOW records child PID + the ACTUAL listen line
(address only) into run metadata for every future run (round F addition).
EXPOSURE WINDOWS (root-corrected, per-head, no blanket minutes): f7390f7f
pushed approx 07:15Z per root (minute-level); earlier heads (515b3805,
eff55c87, 96e199b9 and the 2026-10-19 dev-runs heads) = per-head push times
per reflog/CI evidence where available, else UNKNOWN - this lane records:
UNKNOWN except where the root's ledger evidences them.
- dev-runs/runs/live-2026-10-19T08-18-07/instance-jobs.log (L2)
- dev-runs/runs/live-2026-10-19T08-18-07/instance-z1.log (L2)

Round-F supplements (root merge-order, path-level only):
- SCOPE CORRECTION: the root list said 26; an exact detached-@f7390f7f-tree
  git grep over the PR-ADDED file set found 28 value-bearing files - the two
  additions are live-2026-10-19T08-18-07/instance-{jobs,z1}.tail.log (now
  also redacted; candidate re-scan over all 28 = ZERO value-bearing).
- TREE CONTEXT (fact, this lane does not own them): the SAME pattern matches
  1107 PRE-EXISTING evidence files from other tasks' rounds (G1/G2/F3 boot
  logs) across the tracked evidence tree - NOT PR-added by this lane, NOT
  sanitized here (out of my write window); recorded for a root-level global
  ledger. History blobs remain unsanitized by design (no rewrite).
- WORLD HOMES (from run metadata, exact): 13 homes under
  .worktrees/a5-jobs-isolation/tests/homes/a5jobs-{z1,jobs}-2026-10-19T08-*
  - ALL ABSENT today (cleaned under TEST_METHODS §7 before this order; zero
  a5jobs* residue in either tests/homes per directory inventory), so no
  RETIRED-DO-NOT-REUSE.md could be placed IN a home; this ledger entry IS
  the retirement marker for all 13 (never recreate/reuse those paths as
  DSH_HOME). The 2026-10-20 batch summaries carry no home field (unknown).
  Per root order: ALL future runs of this lane use FRESH homes.
- TOKEN SEMANTICS (root same-source conclusion, adopted): the boot token is
  a WeakMap root-context (not written to disk) but REUSABLE ACROSS RELOADS
  (not one-shot); the session cookie rides a persistent signing secret
  (default 30 days) that can RESURRECT on same-home restart - STOPPED IS
  NOT REVOKED. No rotation performed (out of scope per order); the 13
  homes' persistent signing material is gone with their deletion, and the
  paths are retired above.
- runs/jobs-live-2026-10-20/live-2026-10-20T06-44-58/instance.tail.log (L2)
- runs/jobs-live-2026-10-20/live-2026-10-20T06-46-10/instance.tail.log (L2)
- runs/jobs-live-2026-10-20/live-2026-10-20T06-46-55/instance.tail.log (L2)
- runs/jobs-live-2026-10-20/live-2026-10-20T07-14-02/instance.tail.log (L2)
