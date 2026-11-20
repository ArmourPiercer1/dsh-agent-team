# UTE-2 evidence — Execution Settlement S1

Branch `task/ute2-settlement-20261120`, worktree `.worktrees/ute2-settlement-20261120`.
Base `origin/master ef7e3af0088bf3af8fc765ce27951f9dbad92892`.
Memo: `docs/plans/memo/ute2-settlement-20261120/README.md`.

Everything here is the run's own output, captured with `tee`/redirection; nothing was
retyped by hand. Commands are recorded in the capture file itself.

| File | What it is |
| --- | --- |
| `SUITE.txt` | Full `node --test --test-reporter=spec tests/ute2-settlement/settlement.test.mjs` output, 13/13 pass, including every `UTE2-*` property line. |
| `MUTANTS.txt` | The negative-control transcript only: 7× `UTE2-CONTROL … GREEN` (real module) then 7× `UTE2-MUTANT … RED` (one behaviour removed each), plus `UTE2-MUTANTS total=7 red=7 scenarios=7`. |
| `GATES.txt` | Every gate, verbatim, with `$ command` and `[exit N]`: suite, test-catalog ratchet, test-catalog.test.mjs, dispatch `--check`, `eb3-ci-required`, `eb3-ci-negative-controls` (33/33 incl. C-NH1), `docs-sync --check`, `lint-identities --diff`, repo-wide `pnpm typecheck`, `check-artifacts-committed` (`verdict=ok`), `git diff --check`. |
| `LEGACY-IDENTICAL.txt` | Proof that no legacy test file moved: `git diff --name-status` lists only the new suite (`A tests/ute2-settlement/settlement.test.mjs`); all **848** test files tracked at `origin/master` are byte-identical in the worktree (0 changed); plus a re-run of the existing host-free legacy suite (`tests/world-factory/tinf-observer-closeout.test.mjs`, 27/27) to show it still passes untouched. |

## Environment of these runs

WSL2, Node `v24.21.0` (native TS type-stripping is what lets the suite import
`packages/runtime/settlement/execution-settlement.ts` directly, with no build step),
pnpm `11.7.0`. Scratch state lives under `.artifacts/tmp/ute2-settlement/<pid>-<ts>/`
(gitignored) and is deleted by the suite's `after()` hook. The only subprocess is the
real `node --input-type=module -e` SIGKILL child in the SIGKILL test; every other test
is in-process, host-free, port-free.

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
