# `tests/ute-g1-process/` — UTE-3 / G1 PROCESS family, stage B1

The PROCESS family (`bash`, `pwsh`) is one retirement unit. **B1 records the OLD
PATH only**: the product route-C composition serving the native `bash` name
through the confined `subprocess` face. There is no new path yet, and this
directory deliberately contains no new-path runner.

```
node tests/ute-g1-process/probe-composition.mjs      # stage 0: reachability + the pwsh verdict
node tests/ute-g1-process/capture-old-path.mjs --write   # (re)write the golden
node tests/ute-g1-process/capture-old-path.mjs           # verify: OLD-PATH-GOLDEN compare=identical
node tests/ute-g1-process/negative-controls.mjs          # NC-VERDICT GREEN controls=9 failed=0
node --test tests/ute-g1-process/lane-suite.test.mjs     # the lane's own gates
```

Every command is also collected by the existing post-build CI leg
("UTE G1 FS binding product lane"), because the C1 world imports this repo's own
packages through `packages/runtime/src/plugin/live/a5sf-realm-row.mjs`.

## Files

| path | role |
|---|---|
| `lib/world.mjs` | the host-free C1 world: product route-C mount, a counting confined provider, a real base (unconfined) subprocess service, a counting bash-local executor, and the realm's guard-fact sink |
| `lib/corpus.mjs` | the fourteen vectors (`PB-B…`): id, entry, lane, cwd, setup, steps, expect, note |
| `lib/scenario.mjs` | one execution of one vector → the normalized record |
| `lib/effect-oracle.mjs` | the witnesses (parsed confined record, tree digest, provider counters, guard facts) and the CLOSED refusal classification |
| `lib/compare.mjs` | the graded fields + the reviewed TSV serializer/parser |
| `lib/old-path.mjs` | the old-path identity + the capture facade |
| `lib/semantic-differences.mjs` | the five measured, blocking, UNAPPROVED differences |
| `capture-old-path.mjs` | write / verify the golden fixture (prints the exclusion set) |
| `negative-controls.mjs` | nine controls; each mutated arm must go RED |
| `lane-suite.test.mjs` | the gates (7 checks, one verdict line) |
| `golden/old-path.tsv` | the reviewed fixture (14 rows) |
| `golden/old-path.meta.txt` | what the fixture is, its identity, and what is excluded |
| `golden/COVERAGE.md` | member → vector → control mapping, and WHY `pwsh` is excluded |

## The composition (measured)

`probe-composition.mjs` (transcript:
`dev/agent-workflow/evidence/ute3-process-b1-20261120/composition-probe.txt`):

* the attach places the PD-12 bash shadow over the preset definition and the
  call reaches the confined provider (`confined=1`, `inheritedServiceCalls=0`);
* `pwsh` is unreachable (no binary, no shadow, no preset row) — a DECLARED
  exclusion, so the unit is 1/2;
* the legacy governed plane ACCEPTS the native `bash` name on a complete map
  and cannot express `pwsh` at all (`PLANE_NAMES_INVALID`).

## What B1 does NOT prove (§UNKNOWN)

* a governed `team_bash` dispatch (the plane's name ledger is measured; its
  dispatch needs the governed kernel/PA mount);
* the persistent-PTY `bash` definition (`SD-PROCESS-3`);
* `pwsh` semantics (nothing can run it on this host);
* read confinement as a negative (a refusal is pinned; the absence of an
  unauthorized read is not proven);
* anything about a NEW path — `newPathVerified` is false with an absence
  evidence file, so the retirement gate prints `unit=0/2`.
