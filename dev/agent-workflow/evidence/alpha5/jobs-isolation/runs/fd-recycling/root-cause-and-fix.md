# #349 census fd-recycling - deterministic repro, root cause, determinisation (B route, round C)

## Incident (facts, extract kept at ../ci-39235428022/census-failure-extract.txt)
- census-runtime #349 run **39235428022** X; twin **39235441274** green, same head.
- Union grading named exactly ONE new red:
  `packages/runtime/controlled-fs/test/poc3-probes.test.ts::PoC3-E fd continued-use after close GUARDED: fd-number RECYCLING - raw fd trust silently misreads (naive); the lane refuses (guarded)`.
- Non-deterministic / environment-sensitive: one capture red, one green; pr-gate/candidate green.

## Deterministic minimal repro (no CI luck)
`./repro-starvation.mjs` - runs red EVERY time on any Linux:
1. open+close a file (the lane stand-in publishing its number);
2. a LONG-LIVED holder opens - POSIX lowest-free hands it exactly that number;
3. run the leg's own held-open retry (500 attempts, cap 128): every probe lands ABOVE
   the number (trace: captured=21, probes 22,23,24,25,26,...), recycling never observed;
4. the moment the holder closes, the next open returns 21 - the number only comes back
   when the HOLDER closes; in-process waiting cannot force it.
Exit 0 prints `STARVED-as-diagnosed`. Identity of the holder is irrelevant (the fd table
is process-wide), so the sync in-process holder reproduces exactly what a concurrent
worker thread does in census.

## Root cause (file:line at 79988daa tree = a0187704 unchanged for this file)
`packages/runtime/controlled-fs/test/poc3-probes.test.ts` PoC3-E leg, probe loop
(lines 358-373 at the incident tree) + its premise comment (344-357).
- Mechanism: the leg WITS for the OS to recycle the captured fd number back to it.
  The nine-root census (`scripts/ci-pr-gate.mjs --full --only census`, root vitest
  config, worker_threads pool) runs ALL nine roots' test files in ONE process, and the
  fd table is PROCESS-WIDE. A long-lived fd in any other file's leg, alive for the
  probe's window, makes every attempt miss (each held miss can only shrink the FREE
  set, never take a HELD slot). The old comment's own measurement (6/96 closed, 0/96
  held) was true under ITS assumption "a thread that MOMENTARILY owns the number" -
  census violates that assumption with long-lived handles (log sockets, world files
  kept open across whole legs in sibling files).
- Why only census shows it: single-file dev runs have no concurrent long-lived holders;
  pr-gate legs do not run the nine-root union; census runs 2 captures and grades the
  UNION, so one starved capture is enough.

## Determinisation (this commit)
The leg's LAW moved into a child process with a FRESH, single-threaded fd table:
`packages/runtime/controlled-fs/test/poc3-fd-recycling-leg.mjs` (plain node, imports
the COMMITTED dist surfaces: tool-governance parsers + controlled-fs lane - check-
artifacts keeps those fresh; fixtures are the poc3-harness shapes verbatim).
- After the lane closes its read, the child's NEXT openSync is the lowest free number
  BY LAW (it is the only opener in that process) - recycling is OBSERVED, not waited
  for; a mismatch exits 1 naming the stage, so "observed, never assumed" holds harder
  than before (no retry loop that can quietly burn 500 misses).
- The claim is byte-for-byte the original: naive raw trust of the recycled number
  silently reads the bytes of the NEW owner (`RECYCLED-BYTES\n`), while the lane
  refuses the same stale descriptor with cfClass=denied / cfReason=fd-recycled and
  the refusal body never leaks.
- Census-condition NEGATIVE CONTROL lives in the in-file leg: the test holds a
  long-lived fd in the PARENT's shared table for the child's whole run (exactly the
  shape that starved the old leg) - the child cannot see it, the leg stays green.
- Test title strings UNCHANGED (census identity sets pin them); p4t6 census file-count
  booked 1208 -> 1209 in the SAME commit (the new .mjs is a scannable file; pre-booking
  RED `expected 1209 to be 1208` archived at ./p4t6-RED-unbooked.log).

## RED -> GREEN record
- RED: ./p4t6-RED-unbooked.log (`expected 1209 to be 1208`, file present, clause unbooked);
  the starvation mechanism RED = ./repro-starvation.mjs (deterministic, every run).
- GREEN: poc3-probes 13/13 (3 consecutive solo runs + co-scheduled runs with the a5p7
  family); p4t6 10/10 booked at 1209; the full family gate below.

## Two landing shapes (root to choose; the diff is identical, only the vehicle differs)
- **A. inside the #349 PR**: rides the still-open branch; census re-runs over the same
  PR artifacts; booking chain continues on this branch (1209 here).
- **B. standalone flake-fix PR off master**: cherry-pick ONE commit (this one) onto a
  fresh branch; #349 stays exactly as reviewed (PASS 必办零 untouched); census re-dispatch
  independent. Files touched under BOTH: `packages/runtime/controlled-fs/test/
  poc3-probes.test.ts` (rewire), `packages/runtime/controlled-fs/test/poc3-fd-recycling-leg.mjs`
  (new, scannable+booked), `packages/testkit/test/p4t6-session-event-scan.test.ts`
  (booking 1209), evidence under `dev/agent-workflow/evidence/alpha5/jobs-isolation/runs/
  fd-recycling/` + `ci-39235428022/`. NO src/dist edits (mirror law untouched), zero
  new event names, zero denylist vocabulary.
