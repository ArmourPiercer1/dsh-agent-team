# CI census run 39235428022 (#349 census-runtime, X) - evidence accounting (parent 06:0xZ item 2)

The raw 800KB job log (joblogs.txt, pulled via `gh api .../actions/jobs/118003226559/logs`
for diagnosis) is SELF-CLEARED from the reviewed tree per the reviewer note - it is a
transient pull, not an authored artifact, and re-pullable with that one command against
run 39235428022. What the diagnosis rests on is kept here as the extract:

- `census-failure-extract.txt` - the step's `detail[census]` line, verbatim: union grading
  named exactly ONE new red - `packages/runtime/controlled-fs/test/poc3-probes.test.ts::
  PoC3-E fd continued-use after close GUARDED: fd-number RECYCLING ...` - while twin run
  39235441274 (same head) was green: the non-deterministic shape.
- `../fd-recycling/repro-starvation.mjs` - the deterministic mechanism repro (root cause).
- `../fd-recycling/root-cause-and-fix.md` - root cause file:line + the determinisation.

A debug scratch (debug-trace.mjs, worker-holder variant, superseded by the sync-holder
repro) was also removed; it contributed no kept claim.
