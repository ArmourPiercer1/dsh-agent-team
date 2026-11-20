# UTE-2 evidence — Execution Settlement S1

Branch `task/ute2-settlement-20261120`, worktree `.worktrees/ute2-settlement-20261120`.
Base `origin/master 06de9751a` (merged into this branch; round-3 changes sit on top).
Memo: `docs/plans/memo/ute2-settlement-20261120/README.md`.

Everything here is the run's own output, captured with `tee`/redirection; nothing was
retyped by hand. Commands are recorded in the capture file itself.

| File | What it is |
| --- | --- |
| `SUITE.txt` | Full `node --test --test-reporter=spec tests/ute2-settlement/settlement.test.mjs` output, **20/20 pass**, including every `UTE2-*` property line (adapter, projection, crash-window, fsync, lock). |
| `MUTANTS.txt` | The negative-control transcript only: **15×** `UTE2-CONTROL … GREEN` (real module) then **15×** `UTE2-MUTANT … RED` (one behaviour removed each), plus `UTE2-MUTANTS total=15 red=15 scenarios=15`. |
| `CRASH-WINDOW.txt` | Real child process: `recordAdmission` returns → marker on fd 1 → SIGKILL before any dispatch; a cold store finds the ADMITTED fact, `listUnsettled` sees the gap, recovery yields `UNKNOWN`, and a late COMPLETED is `SETTLEMENT_CONFLICT`. |
| `WRITER-LOCK.txt` | Real second processes: a live foreign writer is `SETTLEMENT_WRITER_CONFLICT`; a dead owner's lock is reclaimed with `previousPid` evidence; an evicted lock stops the writer. |
| `FSYNC-ORDERING.txt` | Injected directory-fsync witness proves `rename → parent-dir fsync → return` for ADMITTED/RUNNING/COMPLETED, and a failing fsync is the named `SETTLEMENT_DIRECTORY_FSYNC_FAILED`. |
| `P4T6.txt` | The frozen-denylist scan on this tree: **20/20**, booking lane `UTE2SETTLEMENT` with 3 paths (`1519 → 1522`). |
| `GATES.txt` | Every gate, verbatim, with `$ command` and `[exit N]`: suite, test-catalog ratchet, test-catalog.test.mjs, dispatch `--check`, `eb3-ci-required`, `eb3-ci-negative-controls` (33/33 incl. C-NH1), `docs-sync --check`, `lint-identities --diff`, repo-wide `pnpm typecheck`, `check-artifacts-committed` (`verdict=ok`), `git diff --check`. |
| `LEGACY-IDENTICAL.txt` | Proof that no legacy test file moved: `git diff --name-status` lists only the new suite (`A tests/ute2-settlement/settlement.test.mjs`); all **848** test files tracked at `origin/master` are byte-identical in the worktree (0 changed); plus a re-run of the existing host-free legacy suite (`tests/world-factory/tinf-observer-closeout.test.mjs`, 27/27) to show it still passes untouched. |

## Environment of these runs

WSL2, Node `v24.21.0` (native TS type-stripping is what lets the suite import
`packages/runtime/settlement/execution-settlement.ts` directly, with no build step),
pnpm `11.7.0`. Scratch state lives under `.artifacts/tmp/ute2-settlement/<pid>-<ts>/`
(gitignored) and is deleted by the suite's `after()` hook. The subprocesses are all
real `node --input-type=module -e` children: the SIGKILL tests (hard death after
dispatch, and after `recordAdmission` returns) plus two writer-lock children (live-owner
refusal and dead-owner reclaim). Every other test is in-process, host-free, port-free.

`lint-identities` needs `npx eslint`; in this fresh worktree the shared `node_modules`
shims pointed at a deleted `.worktrees/tinf-m2` path, so they were re-pointed locally
(gitignored, no tracked byte) before the gate produced the recorded output.

## Disclosures that belong next to the green

- The module is **not wired** into any production path. This evidence proves the
  recorder's properties, not that a real Host dispatch writes such a record (see memo §8).
- `GATES.txt` proves these gates on this machine at this commit; the hosted L2 run of the
  census lane is not part of this file.
- The mutation transcript's recovery mutant uses the store's cold-reader seam (a second
  store over the same directory) rather than spawning seven SIGKILL children; the real
  SIGKILL is exercised once, by `SUITE.txt`, and the seam is the same code path
  (`recoverUnsettled` → `settle`). This is stated in `lib/mutations.mjs`'s header too.
