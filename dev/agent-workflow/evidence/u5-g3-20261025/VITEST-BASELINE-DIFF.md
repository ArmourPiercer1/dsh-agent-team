# Root vitest vs U1b tolerated baseline (worktree @ task branch)

Pass 1 (`vitest-worktree.json`, since removed) reported 12 reds, 1 of them NOT in
`../u1-closure-20261025/u1b/scratch/run2.ids.txt`:

    packages/runtime/test/fix-control-authz-c-abandon-terminal.test.ts :: c9-16:
      delegate x pre-flight-provider-lock x already-abandoned
    TeamDomainError: team_domain already exists (schema_meta holds 10 stamp row(s))

Cause: scratch-dir residue under `packages/testkit/test/.tmp-fault/authz-*` left by
that SAME earlier pass in this worktree (`createP6T1World` calls `createTeamDomain`,
which refuses an existing stamped domain; the failing path returns before the
per-test `destroyDir`). It is an artifact of running the suite twice in one
worktree, not a product regression:

* the file alone, with a clean scratch base: 74/74 PASS;
* pass 2 (`vitest-worktree2.json`), clean scratch base: 10 reds,
  **0 new vs baseline**, 10 baseline items no longer red (the flip is the
  tolerated ENV class — `plugin-dsh-compat` / `rc2-persona-probe` /
  `sanitize-evidence` need paths this worktree now provides).

Baseline red set (10 remaining) is the U1b census class, unchanged in identity.
