# Reference checkout record — pristine 0.2.0-rc.2 host tree at `639ed015`

Round: `task/dsh-020rc2-upgrade-20261003` (PR #62, draft). Created 2026-10-03T15:4xZ.

## Why

This worktree arrived without a read-only copy of the host source under
`references/`, so every "what does 0.2 actually do" question had to be answered
through the *test runtime* checkout (`tests/deepseek-harness-test-use/`), which is
also the tree the kits execute against. Keeping one tree for both roles is how a
test runtime quietly becomes an authority source. Per `docs/TEST_METHODS.md` §2
("fresh-worktree 情形") this round therefore materialized a **separate pristine
reference checkout**, for reading only.

## What was created (and what deliberately was not)

| path | state | role |
| --- | --- | --- |
| `references/deepseek-harness-0.2.0-rc.2/` | **created this round**, gitignored, read-only in practice (no install, no build, no edits) | 0.2.0-rc.2 host source, for reading only |
| `tests/deepseek-harness-test-use/` | pre-existing, untouched by this record | the only permitted **test runtime** |
| `references/deepseek-harness/` | **NOT created, NOT moved** — absent in this environment | the frozen legacy fork reference (`AGENTS.md`: read-only, must not move, must never be a test runtime) |

Naming is deliberately distinct from the frozen legacy path: creating a 0.2 tree
*at* `references/deepseek-harness` would have overwritten the meaning of a frozen
anchor with a moving baseline. `/srv/workspace/dsh-plugins/dsh-agent-team/references/`
(the original root's reference directory) does not exist in this environment at
all, so no frozen working tree was disturbed.

## Provenance and verification (all local, no network)

Command, exactly as documented in `docs/TEST_METHODS.md` §2 for a fresh worktree
(`--no-hardlinks` because the worktree and the baseline are on different devices):

```
git clone --local --no-hardlinks \
  /srv/workspace/dsh-stable-3-0.2.0-rc.2/deepseek-harness \
  references/deepseek-harness-0.2.0-rc.2
git -C references/deepseek-harness-0.2.0-rc.2 checkout --detach \
  639ed015397290b3745d163aafe02ffee4aa3f84
```

| check | observed |
| --- | --- |
| HEAD | `639ed015397290b3745d163aafe02ffee4aa3f84` ("Merge pull request #5479 … release-dsh-0.2.0-rc.2") |
| branch | **detached** (`git branch --show-current` empty) — checked out `stable-3-0.2.0-rc.2` after clone, then detached so the reference cannot advance |
| `git status --porcelain` | empty (0 lines), before and after detach |
| `origin` | `/srv/workspace/dsh-stable-3-0.2.0-rc.2/deepseek-harness` (the read-only shared baseline; the baseline's own origin URL is `https://github.com/ArmourPiercer1/deepseek-harness.git`, **not contacted**) |
| baseline tree before/after | `639ed015…`, `git status --porcelain` 0 lines, branch `stable-3-0.2.0-rc.2` — the shared baseline is a **clone source**, never a writer target |
| size | 440M (285M `.git`), no `node_modules`, never `pnpm install`ed |
| pin consistency | equals `TEST_USE_BASELINE_SHA` in [`tests/paths.mjs`](../../../tests/paths.mjs) and the state of `tests/deepseek-harness-test-use/` (detached @ `639ed015…`, porcelain 0) |

## Frozen anchors, as re-verified from this checkout (read-only)

- `refs/tags/legacy-agent-team-pre-vnext` → tag object `276b3f8b8e4f03c8ebd70bf9d90cc7c7461e23b9`
  → **peels to commit `a3ab31992762c5d6560797eabc7e0885a9320ade`** = the frozen anchor
  of record. Unmoved.
- Refs present in the reference clone (27 total, inherited from the baseline tree):
  1 head `stable-3-0.2.0-rc.2` @ `639ed015…`, its remote-tracking mirror plus
  `origin/HEAD` / `origin/master` (`master` @ `5badb15009ae1756c3afe0ae0cef1faafc290ccc`),
  and 23 `dsh-v*` tags.
- **Observations, recorded rather than "fixed"** (this is the part a reviewer
  should read, because it narrows what earlier documents may be quoted as proving):
  1. `dsh-v0.2.0-rc.2` **does not exist as a tag** anywhere in this tree
     (`git tag --points-at HEAD` is empty; the 23 tags stop at the 0.1.x line). The
     0.2.0-rc.2 baseline is therefore pinned by **branch + SHA**, not by a release
     tag — matching `AGENTS.md` ("锚点 = fork 分支 `stable-3-0.2.0-rc.2` tip，fork 无
     该 tag"). Any prose calling `639ed015…` "the official release tag" is imprecise.
  2. The branch refs `feat/team-vnext-integration-20260829`, `stable-1-0.1.5-rc.2`
     and `stable-2-0.1.7-rc.1` are **absent from the local baseline tree**, so this
     environment cannot re-verify the frozen legacy **branch tip** locally. What it
     can verify locally is the **tag**: `legacy-agent-team-pre-vnext` → object
     `276b3f8b…` → commit `a3ab3199…` (present in the object store, and **not** an
     ancestor of `stable-3-0.2.0-rc.2` or `master` — a separate history line, as a
     frozen fork branch should be). The branch-side claim in `AGENTS.md`
     (2026-10-03, `= a3ab319927… 未移动`) rests on the earlier **remote** `ls-remote`
     of the fork, which this round did not repeat (no network, no credential helper).
  3. Nothing was created, renamed, deleted or pushed anywhere: no fetch, no push,
     no ref write, and the shared baseline remains pristine.

## Rules this checkout is under

1. Read-only: no edits, no installs, no builds, no `git checkout` forward, no fetch.
2. Never a test runtime and never an import target — kits and tests execute against
   `tests/deepseek-harness-test-use/` only (`docs/TEST_METHODS.md` §3).
3. It is gitignored and re-creatable: deleting it loses nothing but a clone step.
