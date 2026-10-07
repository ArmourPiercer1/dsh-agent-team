# Does deleting `leaderEnvelopeCoverage` loosen the limit? — measured (2026-10-08)

Question put to the probe: Task 7.5's **only sanctioned deletion** is the Alpha.3 existential
authorization aggregate `leaderEnvelopeCoverage`
(`packages/runtime/governance/permission-mutation.ts:1368-1391`, called at `:1339`). Is it
redundant with PR2's ceiling judge, so that deleting it changes nothing?

**Answer: no. Removing it loosens the limit.** The full argument, the three-wiring outcome
matrix and the mutation proof are in `FINDINGS.md`; the operative plan change is
`docs/plans/active/alpha4-permission-governance/alpha4-implementation-plan.md` §7.5, where the
deletion is now conditional on three prerequisites landing inside 7.3.

## Provenance

- Worktree `.worktrees/rr-ceil`, branch `probe/a4-ceiling-coverage` @ `991348e0` (= `origin/master`
  at probe time). **Nothing was pushed and no branch was created from this probe**; the mutant was
  reverted and the worktree returned to baseline (102 tests green across the five hottest files).
- Mutant: `probeNeuterLeaderCoverage()` reads an env var through a `globalThis` cast and swaps the
  judge for `() => 'covered'` at the call site — non-constant-foldable on purpose, because an
  `if (false)` is erased by esbuild and would silently have measured the baseline. `probe-mutant.patch`
  is the patch; flag-off runs are byte-identical to baseline (identity sets identical).
- Identity sets: `root-base*.ids.txt` (three baseline repeats — the spread is the declared
  `p6t1-parallel` ±1-3 flake plus `p4t6`, which fails in **both** directions because it pins the
  scanned-file count), `*-mutant*.ids.txt`, and `new-identities-38.txt` (the 38 identities the
  mutant creates: 37 named Alpha.3 guards + the delivered pin test).
- `lanes-base.ids.txt` is **empty by fact, not by loss**: the lane-scoped baseline run of that
  repeat produced no failing identities. Kept rather than deleted so the file set matches the
  command list that produced it.

## The deliverable left unlanded, and why it is `.inert` here

`a4p7-carrier-width-under-ceiling.test.ts` is the red/green-observable width pin the plan now
requires. It is green today, red under the mutant, and **it is not landed as a test in this
commit on purpose**: it is a runtime test file, so landing it is a writer lane's edit, and it also
needs one entry added to `p4t6-session-event-scan`'s `SCANNED_PATHS_A4PRn` list in the same commit.
The `.inert` suffix keeps the tree's own scanners (vitest include globs, the session-event scan)
from treating an evidence copy as a live test. A writer restores the real name and adds the pin
entry together — the pin must bite both ways when it lands.

## Reproducing

`rr-probe-ceiling-width.test.ts` is the probe's own harness copy (three wirings per case, plus the
abstaining-ceiling-reader probe against the production `createAuthorityCeilingReader`). The scratch
harnesses themselves lived under `/tmp` and are gone — this harness gives every shell a private
`/tmp` — which is the reason this directory, not a scratch path, is the record.
