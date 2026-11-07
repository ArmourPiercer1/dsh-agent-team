# boot01 — instrument iteration (NOT a basis for any conclusion)

This directory keeps the raw artefacts of the FIRST boot of the review driver,
because they disclose two instrument defects that the review then fixed; the
corrected measurement is `runs/boot02/` + `runs/boot03/` (agreeing pair).

## Defect 1 — the positive control's `workdir` was outside the ceiling

Both Members sent `bash` with `workdir = <workspace>` while their compiled
ceiling was `<workspace>/lane-a` / `<workspace>/lane-b`. The confined terminal
face admits the SPAWN axis against the cwd, so every `bash` call — including
the in-lane control — was refused with
`IO_READ_DENIED: authored locator '<workspace>' is outside every allow subtree
of the lane`. The cross-lane deny therefore could not be distinguished from
"everything is denied". Fixed in boot02/boot03 by passing the Member's own lane
as `workdir`; the control now returns lane bytes with `exitCode: 0`.

## Defect 2 — the `read`-fact predicate matched bash deny facts

The judge counted guard facts whose `locator` ended with `b.txt`, which also
matched the bash `shellRead deny` facts at that same locator. It therefore
reported FAIL for a `read` that actually succeeded with zero fs facts. Fixed by
matching the realm `fs` METHOD set (`readText`/`stat`/...) instead of a locator
suffix.

## What is missing from this directory, and why

The driver's abort/finally path still wrote `run-record.json` and
`teardown.json` into a hard-coded `runs/boot01/`, so the boot02 run overwrote
them. They were removed rather than left mislabelled. Everything that IS here
(`member-*-transcript.*`, `guard-facts.json`, `cross-dispatch.json`,
`recon-review.json`, `state.json`) is the untouched boot01 output and still
shows the two defects above (7 guard facts, no `spawn:write` allows, and the
in-lane control refused).
