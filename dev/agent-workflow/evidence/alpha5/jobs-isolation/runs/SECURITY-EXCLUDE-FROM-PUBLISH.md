# EXCLUDE-FROM-PUBLISH - boot auth URLs in captured live logs (root urgent security order)

EXECUTIVE SUMMARY (root-corrected in place; values never printed):
- REPO = PUBLIC. Anything pushed here is exposed; this ledger bounds the
  sanitized lane face and names what remains exposed (history blobs).
- Tracked copies at HEAD are FORWARD-COMMIT REDACTED (same-shape
  `?token=<value>` -> `?token=REDACTED-AUTH-URL`; structure stays
  auditable). No force-push, no history rewrite, no file deletion (root
  law). RAW VALUES PERSIST IN GIT HISTORY BLOBS (pre-redaction commits,
  local and remote) - nothing here claims history is cleared; the scope
  certified is the 34-file sanitized face + this lane's subtree scan,
  NOT "the repo/history is clean".
- TOKEN SEMANTICS (root same-source review): the URL boot token lives in a
  WeakMap root-context (not written to disk) and is **reusable within the
  same root context - NOT one-shot**. The session cookie rides a **durable
  signing secret (default 30 days)** held in the world home. Therefore a
  STOPPED process is **NOT a universal revocation**: stopping removes only
  the live listener; material validity is scoped to its home/context, and
  for the historical runs that context's validity state is UNKNOWN.
- LIVE-STATE EVIDENCE (current reality only, no revocation claims): the
  only distinct port across recorded runs is 3186; ss shows NO listener;
  recorded-PID alive checks are silent; no matching process exists in this
  container's process space. The effective SOCKET BIND of the historical
  runs is UNKNOWN (a 127.0.0.1 boot URL is not proof of the bind; host
  webserver takes host as REQUIRED config - '127.0.0.1' | '0.0.0.0'
  closed union, packages/host/webserver/src/index.ts:61,:127, listen :295;
  the kit never set it). Future kit runs record child PID + the ACTUAL
  listen line (address only) into metadata; unknown stays 'unconfirmed'.
- HOMES = RETIRED, with LIMITED historical proof: the 13 recorded homes no
  longer exist (tombstone/absence is a CURRENT-STATE fact, NOT proof of
  runtime isolation while they lived - runtime isolation status is
  UNKNOWN; isolated-launch is source-supported only, not runtime-proven
  for those past runs). Paths are retired below; future runs use FRESH
  homes.
- EXPOSURE WINDOWS are per-head (f739 approx 07:15Z per root; earlier
  heads per reflog/CI where evidenced, else UNKNOWN - no blanket
  minute-counts).
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

SCAN LAW (S2 iron wording): forward sanitization does NOT erase history
tokens; "history cleared" wording is BANNED in this lane's ledgers and
commit messages (repo is PUBLIC - history exposure is real exposure).
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

Guard correction (root sanitizer source-review BLOCK, recorded): the first
guard commit shipped an unwired sink (writeRedactedLine defined, pipes
never consumed = empty logs + full-pipe stall risk; "redact-before-write"
was NOT true of that interim shape - claim corrected here and there). The
RECOVERED shape (this head): line-sanitizer.mjs - one independent
line-buffered sink PER STREAM, cross-chunk split credentials buffered until
line completion, trailing partial flushed REDACTED at close; unit-tested
with FAKE credentials only (5 cases: stdout, stderr, split-token,
close-flush, per-stream isolation) without ever running the launcher or
touching real raws. The launcher remains FROZEN per the jobs-live HOLD.

Third-pass corrections (root d35 review, wording held to evidence):
- DRAIN IS VERIFIED, NOT TIMED: stop -> await child EXIT + BOTH stream
  CLOSES (bounded 15s); budget expiry is recorded as an EXPLICIT
  DRAIN-INCOMPLETE (late output possibly missing) before the fd closes.
  No fixed sleep stands anywhere as a "clean close" - that phrasing is
  removed; the honest names are 'verified drain' and 'DRAIN-INCOMPLETE'.
- RUNTIME BIND IS RUNTIME: hostPid + the ACTUAL listen line are captured
  while the host is ALIVE (post-stop ss only proves post-stop absence) and
  ride facts-<era>.json written AFTER those values exist; the stop receipt
  (stop-receipt-<era>.json: pid, drain verdict, post-stop listener state)
  is a SEPARATE artifact.
- Test face extended to lifecycle truth: CASE6 real spawned child through
  attach -> split writes -> DELAYED partial -> exit -> close (fully
  redacted, verified drain true); CASE7 non-draining child -> bounded
  timeout -> explicit incomplete. 7/7 PASS, fake credentials only; the
  launcher remains FROZEN and unrun.

Full-lifecycle batch (root 9abd review, six items, this head):
1. BOOTSTRAP: the boot line is parsed ONLY from the CURRENT child's
   complete stdout lines IN MEMORY (sink onLine hook), exact expected
   127.0.0.1 + our port; the old file re-read is GONE - it could only ever
   hand authenticate a REDACTED value. The parsed token feeds
   authenticate and is nulled immediately; it never touches disk or the
   log face.
2. DRAIN closes strictly on ACTUAL stream 'close' (destroyed/readableEnded
   no longer count), so the fd closes after the sink's final flush.
3. FAILURE SEMANTICS: J8.0 (sink/spawn errors) and J9.0 (stop verdict via
   the single evaluateStopOutcome) land in criteria; any failure sets
   facts.ok=false, and an unproven stop HALTS the round (EX.1, no next
   era). An incomplete stop cannot ride an ALL GREEN.
4. NO-DELETE HOLD: the finally-block rmSync(HOME) cleanup CODE is removed
   (deleting code, not data). Every world home is RETAINED (facts
   .homesRetained; summary verdict H3.0 restated accordingly); the kit
   deletes nothing. The fd closes in a NESTED finally so even receipt-write
   failure cannot strand it; async spawn errors are captured.
5. SINK ERRORS are sticky and explicit (sink.errors), criteria-fed, with a
   '[REDACTION-FAILED: line dropped, never written raw]' marker - no
   silent swallow, no raw fallback, ever.
6. J7 now requires the feed-rows WITNESS LINE TO EXIST before any
   presence/absence claim; an empty log can never PASS either era.
Tests: 11/11 (added CASE8 synthetic bootstrap->auth->streams->exit -
in-memory exact fake-token handoff, redacted-only disk, immediate discard;
CASE9 early destroy; CASE10 sticky write failure, never raw; CASE11 stop
verdict fail-closed). Fake credentials only; launcher remains FROZEN,
unrun.
