# Integration line state

| Item | Value |
| --- | --- |
| Integration branch | `alpha6/int-20261103` (local worktree `.worktrees/alpha6-int`) |
| PR #585 final merge | `23b5061a6` — "merge: Alpha.6 PR #585 root wiring into the isolated integration line" |
| Rollback tag | `a6-int-pre-585-20261105`, peeled `ccc9294f4e37c230841924713a9624e1553c545a` |
| Gated product/test HEAD | `f2d74da4a` (9/9 local, `gate.md`) |
| Evidence HEAD at this record | `e3e3e15bb` + the exact-HEAD base run below |
| Exact-HEAD real Host core run | `a6-final-base-r1`, root `session-c1-smoke-a6-2026-11-05T20-13-11`, 3 wakes, 2 requests / 2 decisions / 2 consumptions / 0 pending, executed once |
| Working tree | clean except `.drill/` and untracked scratch evidence; no product diff after `f2d74da4a` |
| Hosted CI | not run; repository CI triggers on `master` only. The disclosed local gate is the CI evidence. |
| PR state | #585 remains DRAFT; not merged to master; Alpha.6 default remains off. |

`git diff f2d74da4a..HEAD -- packages` is empty at the time of this record; all
later commits are test/evidence/docs or the already-gated comment/source-map
change. No push was made in this round.
