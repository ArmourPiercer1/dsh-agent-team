# Aborted AFTER the intent row — 2026-11-04T08:11Z

**No Host was started, but a ledger row was written.** The driver threw
`ReferenceError: homePin is not defined` at `run-boot.mjs:1004`, after the BL-14 gate had
written this run's pre-registration row (`gate lease: … rowsAfterIntent=3`).

That makes this the first attempt whose cost is visible in the ledger without a start:
one intent row, no boot row. The boot counter (rows phased `a5sf-acceptance-boot*`) is
therefore still 1, and the next run is boot 2 of the 3 dedicated starts.

## The second instance of the same class

`relative` (07:19Z) was the same defect shape: a binding that only the boot path touches.
`--plan` cannot reach either, and neither can any host-free test of the *product*. The class is
now covered by a `no-undef` lint over the driver and oracle, added to `dry-run.mjs` as a check —
which immediately found a **third** one (`oracleSamples`, used in the finally block, declared
inside the try) that would have thrown *after* the Host was up, i.e. it would have cost a real
start. All three are fixed.

## What this attempt also destroyed, and why that is now impossible

The crash's `finally` block rewrote `run.log` / `run-record.json` and (after the `oracleSamples`
hoist) would have written an empty `oracle-samples.json`, overwriting boot 1's replay fixture.
The driver now (a) writes samples only when there are samples, and (b) archives the previous run's
mutable evidence into `runs/<stamp>/` **before** starting a new one. Boot 1's record was restored
from `1465d3ef7`.
