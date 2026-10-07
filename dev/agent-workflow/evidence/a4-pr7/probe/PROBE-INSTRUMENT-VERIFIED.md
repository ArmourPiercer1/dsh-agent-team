# Task 7.4 — the probe instrument, run and proven in BOTH directions (coordinator, 2026-10-08)

X12 says a coordinator runs a gate step before telling a writer to run it. 7.4's ruling made
"live" depend on a probe (`schemaVersion` -> `9`), so the probe was executed here first, at
`origin/master bfdf1141`, in a throwaway worktree (`.worktrees/a4-74-probe`, deps installed
`--offline` from the in-workspace store). Every file was restored with `git checkout --`; the
worktree ended with an empty porcelain.

## The procedure, as lanes should run it

    sed -i 's/schemaVersion: 1/schemaVersion: 9/g; s/schemaVersion: 2/schemaVersion: 9/g;
            s/schemaVersion: "1"/schemaVersion: "9"/g; s/schemaVersion: "2"/schemaVersion: "9"/g' <file>
    # run the owning lane's tests; collect the FAILING IDENTITIES, not a count
    pnpm --filter @dsh-agent-team/<pkg> run test         # or: pnpm exec vitest run <file>
    git checkout -- <file>

**The edit must be textual, and it must cover four spellings.** This is not a detail: the highest-
fan-out fixture factory, `packages/domain/blueprint/testdata/fixtures.ts`, carries its version as a
**YAML string fragment** (`'schemaVersion: 1'` at `:26`, `:72`, `:242`, `:264`) and as a quoted
string (`schemaVersion: "1"` at `:286`), so a property-level or AST-based probe would have edited
nothing in the file that the probe most needs to edit. 33 of its occurrences were text forms.

## Measured, in the red direction (the instrument fires)

`packages/domain/blueprint/testdata/fixtures.ts` bumped to `9`, `pnpm --filter @dsh-agent-team/domain run test`:

    Test Files  9 failed | 16 passed (25)
         Tests  94 failed | 385 passed (479)
     FAIL a1-permission-policy · bp1-blueprint-inspector · t1-capability-schema · t2-blueprint-catalog [collection]
     FAIL t2-blueprint-hash · t2-blueprint-immutability [collection] · t2-blueprint-parse
     FAIL t2-blueprint-revision [collection] · t2-blueprint-validation

Against the recorded baseline, which fails only `t1-capability-schema` and `t2-blueprint-hash` in
this package, the probe added 7 red files and ~84 red tests. **Verdict: the factory is live**, and
its 248-importer fan-out is exactly why it is on the human-review-before-merge list; nobody
migrates this file by hand without reading it.

## Measured, in the green direction (the instrument discriminates, and it indicts a test)

    PROBE packages/runtime/test/p01-team-scoped-overlay.test.ts        literals_bumped=1 -> Tests 6 passed (6)
    PROBE packages/runtime/test/policy-state-multi-team-bound-blueprint.test.ts literals_bumped=3 -> Tests 11 passed (11)

Two readings, both wanted:

1. `p01-team-scoped-overlay.test.ts` stamps a `schemaVersion` in the **overlay** namespace, not the
   Blueprint one. The probe stayed green because that number is not a document version at all —
   which is the instrument behaving correctly in a tree where `schemaVersion` lives in at least
   eight namespaces (the mistake that invalidated the 217-file inventory).
2. `policy-state-multi-team-bound-blueprint.test.ts` stayed green with **three** blueprint-shaped
   literals set to an unsupported version. Its name says "bound blueprint"; its assertions survive
   a document nothing supports. That is the "green while lying" class caught in the act, and it is
   the reason policy C is the default: **this file's version literals carry no asserted meaning, so
   authoring two authority documents for it would be ceremony that manufactures a false green.**

## What lanes may conclude from this

Probe-red is the only admissible evidence that a fixture is live; probe-green is the only admissible
evidence that a version literal is decorative. Neither is a judgement about the file's importance —
`p01` is a perfectly good test whose version field simply belongs to another namespace. A probe-green
file is treated as `delete-lie` or `invert-to-refusal`, and if its author believes the literal should
be load-bearing, the remedy is an assertion that fails when the version is unsupported, not a
migrated fixture.

## The five mandated-review factories, all probed (raw: `FACTORY-PROBE-RAW.txt`)

Method, bounded: bump the factory's version literals to `9`, run **only its direct importers'** test
files. That is a deliberate **lower bound** on redness — transitive consumers are not run.

| factory | direct importer files | result | verdict |
| --- | --- | --- | --- |
| `packages/domain/blueprint/testdata/fixtures.ts` | (whole package run) | 9 files / **94** tests red vs a 2-file baseline | **live** |
| `packages/runtime/test/p6t1-helpers.ts` | 98 | **83 failed / 48 passed** | **live** |
| `packages/runtime/test/p6t2-helpers.ts` | 49 | **120 failed / 21 passed** | **live** |
| `packages/runtime/test/p6t4-helpers.ts` | 55 | **60 failed / 43 passed** | **live** |
| `packages/remote/test/p8t3-helpers.ts` | 14 | **2 failed / 204 passed** | live, narrowly |

Three consequences for the dispatch, none of them visible from the file counts in the plan:

1. **All five are live, so all five are policy-A work and human-reviewed** — the probe never had to
   overrule the mandate here, which is worth stating because it means the mandate was correct rather
   than merely cautious.
2. **`p6t2-helpers` is the single riskiest file in Task 7.** 120 tests fail when its version changes —
   more red than any other instrument in this inventory — and it is one file. Whatever Team Hard rules
   get typed into that factory are asserted, in some form, by 120 tests: a widened rule there is not a
   local mistake, and the suite will not catch it (an over-wide grant is precisely what no test
   fails for).
3. **`p8t3-helpers` is the counter-example that keeps the probe honest**: 14 consumers, 204 tests
   pass with an unsupported version and only 2 fail. A naive "high fan-out ⇒ high risk" heuristic
   ranks it with the others; the measurement says its consumers mostly never parse the document it
   builds. It is on the human-review list because the rule says so, and the rule is right — but for a
   different reason than the number of importers suggests.
4. Most of the red is **collection-level** (`FAIL <file>` with a bracketed file and no test name): the
   factory throws while the world is being built. That matters for effort estimates — migrating a
   factory is usually one edit plus whatever golden hashes and version assertions the consumers pin,
   not 98 or 120 separate edits. The hashes are the real hand-work: 7.3 already lists the golden
   `contentHash` literals that must be re-pinned.
