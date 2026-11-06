# Integration line state

| Item | Value |
| --- | --- |
| Integration branch | `alpha6/int-20261103` (local worktree `.worktrees/alpha6-int`) |
| PR #585 final merge | `23b5061a6` — "merge: Alpha.6 PR #585 root wiring into the isolated integration line" |
| Rollback tag | `a6-int-pre-585-20261105`, peeled `ccc9294f4e37c230841924713a9624e1553c545a` |
| Gated HEAD | `212c4fba2` (9/9 local, 375.9 s, census 677/8830; `gate.md`) |
| Evidence HEAD at this record | `212c4fba2` (normal/handoff/timeout/human/Sticky Stop runs below) |
| Exact-HEAD real Host loops | `a6-normal-r5` (Officer allow), `a6-handoff-r7` (transfer→successor), `a6-timeout-r4`, `a6-human-r12`, `a6-sticky-stop-r3` |
| Working tree | clean except `.drill/` and untracked scratch evidence; no product diff after `f2d74da4a` |
| Hosted CI | not run; repository CI triggers on `master` only. The disclosed local gate is the CI evidence. |
| PR state | #585 remains DRAFT; not merged to master; Alpha.6 default remains off. |

Product delta since `a1868f878`: bounded wait (`803daf85a`, ARC override
`81f78db39`), trusted user Stop/resume (`a4453050f`). Test/evidence commits follow
the reviewed product bytes. No push was made in this round.
