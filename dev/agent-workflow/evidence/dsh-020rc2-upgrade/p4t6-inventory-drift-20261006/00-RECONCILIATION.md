# p4t6 scanner inventory drift 968 -> 971 (PR #62 maintenance, U4/U5 pin)

Base for this correction: HEAD `355d7385e04751b76044ea90a6aa9b8a47dfa13c`
(tree `8d7faa97b5c5a2905c803f7bc129f16f4a0b6e24`), original PR base
`6b2f401bbc2f82e1eb3e561f71069d5aad2350fc`; test-use pin
`639ed015397290b3745d163aafe02ffee4aa3f84` (porcelain 0). Nothing was pushed.

## What the gate said, unmodified first

`npx vitest run packages/testkit/test/p4t6-session-event-scan.test.ts` before any edit:
**exit 1**, `Tests 1 failed | 9 passed (10)`, `AssertionError: expected 971 to be 968`
at the `filesScanned`/`files.length` equality pair (raw: `p4t6-RED-20261006.log`).
That is inventory drift in the maintenance pin, not a denylist hit: the scanner
still reports the frozen 15 quarantine hits and zero violations outside quarantine
(the nine other cases in the same file passed unchanged, before and after).

## Inventory proof (existing scanner, unmodified, emitted once)

`p4t6-scanner-inventory-20261006.txt` = the sorted file list of
`scanSessionEventVocabulary()` on this worktree: `filesScanned=971`,
`files.length=971`, `excludedSelfFiles` still exactly the two self-referential
files (`packages/testkit/fault-injection/session-event-scan.mjs`,
`packages/testkit/test/p4t6-session-event-scan.test.ts`).

* every one of the 971 paths is under `packages/` and ends `.ts` / `.mts` / `.mjs`
  (919 / 14 / 38); zero `dist`, `dev/`, `node_modules` or evidence paths;
* removing exactly these three leaves **968**:
  `packages/runtime/root-binding/harness/blueprint-source.mjs` (blob `3f9ddfb002654986280826c849ddd3650e2dfaed`),
  `packages/runtime/root-binding/harness/bounded-run.mjs` (blob `f28727661bd130fbb48bb57931aa6e83d556c248`),
  `packages/runtime/root-binding/harness/bounded-run.regression.test.mjs` (blob `01d3600f5e4701f8b039cab7d4d5289400e9cde9`)
  — all three tracked (`git ls-files` yes), all intended harness/test source,
  already inside the scanner's pre-existing `packages/**/*.mjs` scope;
* ancestry, not arithmetic: the 968 pin was written by `b5becb03`; the three files
  were introduced by `3fb2a729` and `65adf3ab`, and `git merge-base --is-ancestor`
  reports each add-commit is **NOT** an ancestor of `b5becb03`, so they joined the
  scan after the pin was written;
* committed-tree comparison against the original base accounts for 13 added
  scannable files and zero removals: 7 rc2 tests (958 -> 965) + 3 persona files
  (965 -> 968) + these 3 (968 -> 971); `958 + 7 + 3 + 3 = 971`.

## The edit and what stayed untouched

Only `packages/testkit/test/p4t6-session-event-scan.test.ts` changed: both
equalities `968` -> `971` (exact equality kept, no `>=`, no skip, no dynamic
self-computed expectation), the case title and the comment block gained the
`968 -> 971` increment with the three paths and their blobs, the nearby stale
prose is now scoped as the rc2 sub-delta rather than the complete committed
delta, and the three paths are additionally asserted present by path. The scanner
module, denylist, extensions, skip/self-exclusion rules, quarantine membership,
the 15-hit count and every control are byte-identical (they are not in the diff).

## Receipts

| command | exit | result |
| --- | --- | --- |
| `npx vitest run packages/testkit/test/p4t6-session-event-scan.test.ts` (before edit) | 1 | RED `expected 971 to be 968`, 1 failed / 9 passed — `p4t6-RED-20261006.log` |
| same command after the edit | 0 | GREEN, **10 passed (10)** — `p4t6-GREEN-20261006.log` |
| `npx vitest run packages/testkit/test/rc2-kit-pin-hygiene.test.ts` | 0 | **7 passed (7)** — `rc2-kit-pin-hygiene-20261006.log` |
| `npx eslint packages/testkit/test/p4t6-session-event-scan.test.ts` | 0 | clean (npm config notice only) — `eslint-changed-file-20261006.log` |

Not claimed: the full root suite. It was **20 failing tests + 3 collection-failing
files** at `355d7385` and this narrow correction addresses only this one row; no
new full-suite number is asserted here, and a fresh full suite must be compared by
failure names, not totals. The retained real-Chrome v5 evidence
(`.rt-_0gbddsv`, packaged under `.private-raw-evidence/ui-gate-2/2026-10-06T04-33-36Z/`)
is untouched; the kit driver SHA256
`ec210ae729e6f78d121ba7f3ac9562134e4a70a6ad8b3d46a69fa5df499d1164` is unchanged by
this commit, so that run stays evidence for unchanged executable inputs rather
than a claim of a new browser run at the new HEAD.
