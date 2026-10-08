# 7.8 — install-surface re-baseline (evidence index)

Lane: `install-surface re-baseline`. Base `origin/master` = `f0485b15f5be2a3afc8834c4f148bf951dce20aa`.
Branch `feat/a4-dist-rebase`, worktree `.worktrees/a4-dist-rebase`. **Not pushed.**

| commit | what |
| --- | --- |
| `2683653a` | `build(a4-pr7)`: re-base the committed install surface onto HEAD source — 20 tracked `packages/runtime/dist` files, 34 insertions / 20 deletions, **zero source change** |
| `e75e1821` | `feat(a4-pr7/7.8)`: `scripts/check-artifacts-at-head.mjs` + `pnpm check:artifacts:head` + the 27th merge-gate leg |
| `b3d9edd6` | `docs(a4-pr7/7.8)`: this evidence directory |
| (this commit) | the fourth `p6t1-parallel` load identity, and the `check:artifacts` /
`smoke:composition` / `check:artifacts:head` / merge-gate captures re-taken on the final tree |

| document | the one question it answers |
| --- | --- |
| [`STALENESS.md`](STALENESS.md) | **how did 20 files get stale** — the drift list grouped by emitting source, each group attributed to the merged change that should have rebuilt it, verified rather than assumed; what the stale surface actually said after the §7.3 flip; and why three separate instruments could not see it |
| [`BATTERY.md`](BATTERY.md) | what broke and what did not — population red-**identities** and registered legs (never a red count) per capture, the 14-file/263-leg named battery, the gate before/after with literals, fence/lint/typecheck/smoke literals |
| [`MECHANISM.md`](MECHANISM.md) | how freshness stops rotting — four candidate shapes priced in wall time and in what each can still miss, one implemented, plus the end-to-end teeth proof |
| [`FINDINGS.md`](FINDINGS.md) | every instrument that lied, including this lane's own five errors, and how each was caught |

`logs/` holds the raw captures behind those claims: five population runs
(`pop-BASE-f0485b15.log` … `pop-FINAL-e75e1821.log`) and their identity diffs, three merge-gate
runs plus the drifted-unstaged single-leg refusal, the pre/post batteries, the fence output
after each `git add`, the lint identity diffs, `smoke:composition`, both typecheck flavours,
the three `p6t1-parallel` solo runs, the teeth probe, the scratch pricing timings, and
`check-artifacts` in its three states (clean-and-stale → `OK: 1508 files` exit 0;
drifted-and-unstaged → 20 `C content-drift` exit 1; fresh → `OK` exit 0).

Reproduce the finding in four commands: `STALENESS.md` §5.
