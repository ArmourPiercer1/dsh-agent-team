# run13 probe-events

- `fence-probe-events.jsonl` — run 13's boot-3 probe events (world
  `rst017-spike-2026-09-26T05-20-32`, armed @05:21:14.535Z autoArm +
  BOOT_ROOT re-adopt @05:21:14.810Z source=resume veto=false). Captured
  from the shared probe dir before run 14's per-run evidence dirs took
  over.
- run 12's own boot-3 probe JSONL (veto @05:15:55.434Z, full field
  fidelity) was LOST: the probe JSONL is a single shared file, cleared
  per boot, and run 13's boot cleared it before it was archived. Its
  key events are recorded in `run-history.md` (run 12 entry) and in the
  run-12 console dump (spike-run12.log).
- From run 14 on, each spike run writes probe JSONL into its own
  `run<stamp>/probe-events/` (per-run evidence dirs; see spike.mjs
  RUN-14 FIX comment) — no more cross-run clearing.
