# A4-PR0a — baseline closure capture (A1.2.3, only-downward proof)

Branch `fix/a4-pr0a-ledger-category-closure`, base `master@840db608` (PR #63 merged),
commit under review `9c6edb42`. Environment: 32 cores, node v24.21.0, vitest 4.1.11,
`CI=true`, workspace `XDG_*`, root suite (`pnpm vitest run`, include = `packages/*/test/**/*.test.ts`).
The suite needs no `tests/deepseek-harness-test-use` checkout (no root-suite file spawns the host),
so the worktree ran the full scale: **458 files / 5431 tests** = baseline 456/5418 + the 2 files and
13 tests this PR adds (arithmetic exact).

## Protocol

Per A1.2.3 the scratch world is deleted before every capture and the capture is taken TWICE:

```
rm -rf packages/testkit/test/.tmp-fault/
pnpm vitest run --reporter=json --outputFile=root-vitest-a4pr0a-<i>.json
node dev/agent-workflow/evidence/alpha4/baseline/fail-set-normalize.mjs root-vitest-a4pr0a-<i>.json
```

## Result

| capture | identities | files | vs citable baseline (`failing-identities-2b86ee42.txt`) |
| --- | --- | --- | --- |
| run 1 | 23 (20 TEST + 3 FILE) | 10 | **byte-for-byte identical** (`diff` empty) |
| run 2 | 25 (22 TEST + 3 FILE) | 11 | + exactly the two `p6t1-parallel.test.ts` identities |

`run1-vs-run2.diff` is retained beside this file and contains only those two `p6t1-parallel` lines.
Both are inside the baseline's **named flake allowance** (additive-only), so the failing set moved
**only downward** — in fact nowhere: the same 23 identities, the same 10 files, no new identity
anywhere in the tree.

Totals: `Tests 21 failed | 5410 passed (5431)` on the run that also carried the two flake
identities, against the baseline's `20 failed | 5398 passed (5418)`. The +1 delta is entirely the
allowanced `p6t1-parallel` pair (one of whose two tests passed in run 2), never a new file.

## PR0a gate evidence

- **RED executed before the fix** (verbatim, captured in `SESSION_ROUTER_LOG.md`):
  `TEAM_PROJECTION_SOURCE_LEDGER_CATEGORY_UNKNOWN: ledger sequence 2 of TeamSession
  'session-root-p6t1' carries fact type 'control-request-abandoned' with no mapping to the eight
  frozen …` — produced by `a4pr0a-abandon-projection-closure.test.ts` driving the production
  `requestControl` → `abandonControlRequest` path and reading through
  `createTeamDomainReadPort`, with C2 as the control leg (the same control world without an
  abandonment projects fine).
- **GREEN after the two registrations**: `a4pr0a-abandon-projection-closure` + `a4pr0a-fact-type-closed-set`
  = 13 tests passed; `p4t6-session-event-scan` = 10 passed with the pin recomputed 971 → 973.
- **Mutation proof (plan Gate: "prove it once by mutation")**: the guard's C6 deletes this commit's
  own `control-request-abandoned` entry from the parsed map in-process and asserts the same
  predicate C2 uses reports it, then asserts the unmutated map reports nothing.
- **Artifacts**: `pnpm build` green for every package; `pnpm run check:artifacts` →
  `OK: 1444 files; committed install-surface artifacts match the fresh build`; the drifted
  `client/composition-shim/client-bundle.js` and `runtime/dist/.../projection-source.{js,js.map,d.ts.map}`
  are committed in the same commit as their source.

## Housekeeping this capture produced

The two `p6t1-parallel` identities reconfirm the allowance is real and not a stale note; no
previously-clean identity broke, and no identity disappeared (which would have meant a fix landed
without a test noticing).
