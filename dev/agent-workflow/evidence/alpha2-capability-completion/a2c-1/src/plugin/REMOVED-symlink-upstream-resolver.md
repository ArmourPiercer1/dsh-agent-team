# removed: upstream-resolver.mjs was a tracked symlink into a gitignored worktree

**What it was.** `mode 120000` — the only tracked symlink in the repository — targeting:

```
/home/user/dsh-plugins/dsh-agent-team/.worktrees/a2c-1/packages/runtime/src/plugin/upstream-resolver.mjs
```

**Why it is gone.** The target lives inside `.worktrees/a2c-1/`, which is gitignored and per-machine: the link resolved on the machine that created it and dangles in every other checkout, while `git status` stayed clean and said nothing. Its real cost was to tooling — `npx eslint <path>` **exits 2** on this path (measured on `4a11694a`), which is exactly how the §7.6 lint-identity universe was observed to break during the `fix/a4-instrument-tree-shape` review: that scan reported `1 skipped: <dangling symlink>` and had to filter it. **Evidence must not be able to break the gates that audit the tree it documents.**

**Why a note instead of a copy.** The pointed-to file is an upstream host source file; copying it into tracked evidence would create a vendored upstream copy, which `AGENTS.md` forbids (CORE PATCH BUDGET = 0). Recover the original from history instead: `git log --all --format=%H -- dev/agent-workflow/evidence/alpha2-capability-completion/a2c-1/src/plugin/upstream-resolver.mjs`, then `git show <commit>:<path>`, or check out the alpha2 evidence round on a machine where that worktree exists. Nothing in this directory depends on the link — `a2c1-live-runner.mjs`, `build.log`, `gate-plain-node.log` and `gate-focused-vitest.log` are regular files alongside it.
