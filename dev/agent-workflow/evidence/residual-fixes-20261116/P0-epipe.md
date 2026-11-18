# P0 — the EPIPE seam: a reader that closes the pipe must not turn a clean candidate into DRIFT
# utc: 2026-11-18T15:34:20Z  head-before-this-commit: ce642dae2

## BEFORE (head ce642dae2, `| head -1`, clean candidate cand-v0.1.6-1)
$ node scripts/freeze-candidate.mjs --check --manifest dev/engineering/candidates/cand-v0.1.6-1.json | head -1
  measured 3/3: rc=1, stdout 1 line, stderr 1203 bytes:
    node:events:505
        throw er; // Unhandled 'error' event
        ^
    
  (exit 1 is the documented DRIFT code — false drift plus a Node stack trace)

## BEFORE, base commit (46a53ac56^) for comparison
  measured 3/3: rc=0, stderr 0 bytes (process.exit() pre-empts the EPIPE, but also truncates)

## AFTER (this commit, same command, 3/3)
  clean run1: rc=0 stderr=0 first_line=OK    ancestry.bring_back_to_master = "only 
  clean run2: rc=0 stderr=0 first_line=OK    ancestry.bring_back_to_master = "only 
  clean run3: rc=0 stderr=0 first_line=OK    ancestry.bring_back_to_master = "only 

## AFTER, tampered candidate (content_digest mismatch), 3/3
  tampered run1: rc=1 stderr=0 line=OK    ancestry.bring_back_to_master = "only by a real merge 
  tampered run2: rc=1 stderr=0 line=OK    ancestry.bring_back_to_master = "only by a real merge 
  tampered run3: rc=1 stderr=0 line=OK    ancestry.bring_back_to_master = "only by a real merge 

## (c) The flush guarantee is NOT reintroduced as a truncation

`node .artifacts/tmp/repro-freeze-candidate-flush.mjs scripts/freeze-candidate.mjs 100 20 <tampered>`
(the harness reads each child's stdout through a PIPE — the harness shape, not `| head`):

```
RUNS 100 concurrency=20
EMPTY_STDOUT 0
EMPTY_STDOUT_EXIT1 0
MISSING_DIGEST_LINE 0
MISSING_DRIFT_SUMMARY 0
WRONG_EXIT 0
```

Same pool against the CLEAN candidate (the line the suite asserts on is `CLEAN`):

```
RUNS 100 concurrency 20
MISSING_CLEAN_LINE 0
WRONG_EXIT 0
```

And the suite itself, 20 runs at concurrency 10:

```
RUNS 20 concurrency=10
GREEN 20
RED 0
GREEN_WITH_SUMMARY_LINE 20
OUTPUT_WITHOUT_VERDICT_LINE 0
```

## What the fix is (scripts/freeze-candidate.mjs:553-575)

`keepSemanticExitCodeOnClosedReader(stream)` installs an `error` listener on stdout and
stderr that swallows **only** `EPIPE`/`ECONNRESET` and rethrows everything else, then
`process.exitCode = main(...)` keeps draining. It is a narrow exemption, not
`process.on('uncaughtException')`: a closed reader cannot change the candidate's verdict, and
a real stream error stays fatal. The base commit is *not* the reference here — it exits 0 by
pre-empting the write, which is the original truncation.
