# A4-PR6 gate receipts (committed at the integration round)

Receipts for every number the PR body / ledger cites (the PR6 writer moved
them out of the worktree-local `.tmp-a4pr6/` at the parent's integration
instruction, so a worktree prune cannot destroy them):

- `root-run1.txt` / `root-run2.txt` / `root-run3.txt` — the three root
  `pnpm test` runs at/near `173326b7` state: run1/run3 = the 22 baseline
  identities EXACTLY; run2 = baseline + the `p6t1-parallel` flake legs
  (the file is green standalone; see the PR body).
- `run1-identities.txt` / `run2-identities.txt` / `run3-raw.txt` — the
  extracted FAIL identity lists the diff ran against
  `evidence/a4-pr1/baseline-closure/failing-identities-pr1-run2.txt`.
- `root-base-run1.json|.log` / `root-base-run2.json|.log` /
  `identities-base-run*.txt` / `client-before.log` / `baseline.sh` — the
  6.B-era HEAD(stash)-run baselines proving the 20 per-package runtime
  reds and the 3 client failures are PRE-EXISTING artifacts.
- `lint-full.txt` (129-error tree, pre-636fe58f) / `lint-full2.txt`
  (post-fix) / `lint-*-sorted.txt` / `lint-identities-now.txt` /
  `probe2.mjs` — the lint-identity extraction vs
  `evidence/a4-lint-baseline/lint-identities-0237d487.txt` (160): zero
  NEW identities at the head; the one new entry (s6-remote
  `InterventionItem`) is fixed in 636fe58f.
- `build.txt` / `build-comp.txt` / `check-art.txt` — the build chain;
  `check-art.txt` shows the STALE state the artifacts co-commit (173326b7)
  closed. `smoke.txt` — the INHERITED clsx failure, reproduced
  identically on master 77292870 (7.5-owned).

- Review round 1 receipts (the `.tmp-a4pr6/` dir is DELETED at the
  round-1 close — no gate receipt lives worktree-local anymore; this
  directory is the only capture target, per the 1f8d4e73 law):
  `root-66a5b5d0-runA.json`/`runB.json` + the matching
  `root-66a5b5d0-identities-runA/runB.txt` (the x2 closure at head
  66a5b5d0 = the 22 baseline identities EXACTLY both runs);
  `root-orderflaw-identities-interference.txt`/`-44.txt` (the ordering
  flaw exposed: 44 identities incl. the 18 collection failures before
  a4140137 — the first also documents my own parallel-run interference
  with the suite, disclosed); `lint-round-full.txt` +
  `lint-round-identities.txt` (final head: 128 occurrences, ZERO new
  identities vs the 160 baseline — reached with NO mutes anywhere in
  the round's files after the parent's no-new-mutes ruling: the six
  entrances-file mutes became typed doubles);
  `build-round.txt`/`build-comp-round.txt`/`check-art-round.txt` +
  `drift-round-list.txt` (the 23-file artifacts co-commit).
- `root-1ee69e45-runA.json`/`runB.json` + identities — the x2 closure
  at the ZERO-MUTE head: baseline EXACTLY in both runs plus the known
  `p6t1-parallel` timing flake only (5 lines / 2 lines; standalone
  green; the parent saw the same flake in their own verification run).
- `typecheck-round.txt` — the TREE-WIDE `pnpm -r run typecheck` receipt
  at the type-fix head (the earlier per-package `--filter
  @deepseek-ai/...` form matched no package and proved nothing —
  disclosed): 8 `typecheck: Done`, zero `error TS`.
