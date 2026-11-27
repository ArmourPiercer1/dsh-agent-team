# The hosted `ci-integration` red at `92be91dfb` — parity evidence not regenerated

## What failed

`scripts/test-catalog.test.mjs` → `dispatch: the committed parity evidence still describes the resolved set`:

```
AssertionError: the dispatched set moved away from the committed parity evidence — regenerate it deliberately
  + sha256:b5b99294…
  - sha256:f8488aa9…
```

## Cause

Round 114 added `tests/checks/d4-evidence-consistency.test.mjs` and wired it into a dispatch leg, so the resolved
dispatch union grew by exactly one suite (77 → 78 files). The committed parity evidence
(`dev/agent-workflow/evidence/tinf-m6-dispatch-parity/old-vs-new-argv.txt`) still pinned the previous union digest.

It is NOT a product or workflow defect, and the test is the control that exists to force this review — it refused
rather than let the dispatched set drift away from its evidence.

## The deliberate regeneration

The evidence was regenerated with the repo's own generator and its base:

```
node scripts/dispatch-tests.mjs --parity --old-ref e5bf05670   # base: the M5 merge point named in the file
union old=25 new=78 set=sha256:b5b992944b59753bf4afb1f4ddff0e872bd1e5bf4c520b7bd25bd49caae92da2
DISPATCH-PARITY mode=inspect DIFFERS steps=19 old_files=25 new_files=78 problems=0
```

The only added file is `tests/checks/d4-evidence-consistency.test.mjs`; `problems=0` and nothing is `missing`.
No assertion was relaxed, no suite removed, no timeout touched — the union digest and the file count moved together.

Local: `scripts/test-catalog.test.mjs` 28/28, `tinf-instruments` 807 tests / 801 pass / 0 fail / 6 skipped.
