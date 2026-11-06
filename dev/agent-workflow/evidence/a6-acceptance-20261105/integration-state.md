# Integration line state

| Item | Value |
| --- | --- |
| Integration branch | `alpha6/int-20261103` (local worktree `.worktrees/alpha6-int`) |
| PR #585 final merge | `23b5061a6` — "merge: Alpha.6 PR #585 root wiring into the isolated integration line" |
| Rollback tag | `a6-int-pre-585-20261105`, peeled `ccc9294f4e37c230841924713a9624e1553c545a` |
| Gated HEAD | `1e50d55fc` (9/9 local, 362.8 s, census 677/8830; `gate.md`) |
| Evidence HEAD at this record | `1e50d55fc` (normal/handoff/timeout/human/Sticky Stop runs below) |
| Exact-HEAD real Host loops | `a6-normal-r6` (Officer allow), `a6-handoff-r8` (transfer→successor), `a6-timeout-r5`, `a6-human-r13` (remote-only discovery), `a6-sticky-stop-r12` (durable Stop + restart + explicit resume) |
| Working tree | tracked tree clean at `1e50d55fc`; `.drill/`, test homes and run evidence are untracked |
| Hosted CI | not run; repository CI triggers on `master` only. The disclosed local gate is the CI evidence. |
| PR state | #585 remains DRAFT; not merged to master; Alpha.6 default remains off. |

Product delta since `a1868f878`: bounded wait (`803daf85a`, ARC override
`81f78db39`), trusted Stop/resume (`a4453050f`), then the durable-marker/resume
rebuild + provenance law (`f68dc137c`, ARC override for the named bindings seam)
and the fence/dist/docs follow-up (`1e50d55fc`). No push was made in this round.
