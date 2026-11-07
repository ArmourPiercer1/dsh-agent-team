# Integration line state

| Item | Value |
| --- | --- |
| Integration branch | `alpha6/int-20261103` (local worktree `.worktrees/alpha6-int`) |
| PR #585 final merge | `23b5061a6` — "merge: Alpha.6 PR #585 root wiring into the isolated integration line" |
| Rollback tag | `a6-int-pre-585-20261105`, peeled `ccc9294f4e37c230841924713a9624e1553c545a` |
| Gated HEAD | `f05de98ea` (9/9 local, 313.1 s, census 677/8833; adds the A6-gated undetermined-allow lifecycle fix; `gate.md`) |
| Evidence HEAD at this record | `28b61d4b2` for gate; closing-round real-Host runs carry `run-manifest.json` at `28b61d4b2`. Earlier full-arc runs were collected at `fb6ccb4f4`. |
| Exact-HEAD real Host loops | `a6-normal-r9` (Officer allow), `a6-timeout-r9` (abandoned invocation, no decision rewrite), `a6-crash-allow-r4`, `a6-crash-consume-r8` (execution-outcome-unknown), `a6-inbox-r14` (exactly one replacement wake) — all at `28b61d4b2`. Earlier: `a6-handoff-r9`, `a6-human-r15`, `a6-sticky-stop-r14` at `fb6ccb4f4`. |
| Working tree | tracked tree clean at `28b61d4b2`; `.drill/`, test homes and run evidence are untracked |
| Hosted CI | not run; repository CI triggers on `master` only. The disclosed local gate is the CI evidence. |
| PR state | #585 remains DRAFT; not merged to master; Alpha.6 default remains off. |

Product delta since `a1868f878`: bounded wait (`803daf85a`, ARC override
`81f78db39`), trusted Stop/resume (`a4453050f`), then the durable-marker/resume
rebuild + provenance law (`f68dc137c`, ARC override for the named bindings seam)
the resume/Inbox round (`fb6ccb4f4`). No push was made in this round.
