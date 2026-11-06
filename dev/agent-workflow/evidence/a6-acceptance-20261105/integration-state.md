# Integration line state

| Item | Value |
| --- | --- |
| Integration branch | `alpha6/int-20261103` (local worktree `.worktrees/alpha6-int`) |
| PR #585 final merge | `23b5061a6` — "merge: Alpha.6 PR #585 root wiring into the isolated integration line" |
| Rollback tag | `a6-int-pre-585-20261105`, peeled `ccc9294f4e37c230841924713a9624e1553c545a` |
| Gated HEAD | `fb6ccb4f4` (9/9 local, 290.6 s, census 677/8832; `gate.md`) |
| Evidence HEAD at this record | `fb6ccb4f4` for gate; the real-Host runs below were collected on the same product code as `fb6ccb4f4` |
| Exact-HEAD real Host loops | `a6-normal-r8` (Officer allow), `a6-handoff-r9` (transfer→successor), `a6-timeout-r6`, `a6-human-r15` (remote-only discovery), `a6-sticky-stop-r14` (durable Stop + restart + real re-plan resume), `a6-inbox-r9` (claimed-wake reconcile, no duplicate) |
| Working tree | tracked tree clean at `fb6ccb4f4`; `.drill/`, test homes and run evidence are untracked |
| Hosted CI | not run; repository CI triggers on `master` only. The disclosed local gate is the CI evidence. |
| PR state | #585 remains DRAFT; not merged to master; Alpha.6 default remains off. |

Product delta since `a1868f878`: bounded wait (`803daf85a`, ARC override
`81f78db39`), trusted Stop/resume (`a4453050f`), then the durable-marker/resume
rebuild + provenance law (`f68dc137c`, ARC override for the named bindings seam)
the resume/Inbox round (`fb6ccb4f4`). No push was made in this round.
