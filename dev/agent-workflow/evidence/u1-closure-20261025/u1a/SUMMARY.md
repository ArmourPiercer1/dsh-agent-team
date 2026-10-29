# U1-A / F0 completion (EB0-4) — asset classification summary
Captured 2026-10-25, root master @ `6259cf4b` (796 behind origin/master `4aaaa7b2a`, 0 ahead).
All bytes = `du -b` apparent sizes as measured; NOT_OBSERVED marked where true.

## Totals per class (du bytes)
| Class | items | du sum | note |
|---|---|---|---|
| worktrees KEEP-ACTIVE | 5 | 4,090,327,337 | s2-authority-iso, u1-audit-master, eb-e0-e1, pr363-docs-review, a5-m2-int(#360) |
| worktrees REUSE-CANDIDATE | 29 | 61,260,611,189 | incl. ROOT-master 43,142,359,115 (= whole repo, not reclaimable as a unit); REUSE-minus-root = **18,118,252,074** |
| worktrees REGENERABLE | 16 | 8,274,624,809 | per-dir sum; `.worktrees` single-pass du = 29,398,280,966 |
| worktrees UNKNOWN | 0 | 0 | — |
| homes REGENERABLE | 534 | 8,035,678,483 per-dir | hardlinked worlds; tree single-pass 3,744,809,488 |
| homes KEEP / KEEP-REFERENCED | 1 / 7 | per-dir 674,466,361 / 1,086,903,794 | `.playwright-browsers` KEEP; 7 evidence-referenced KEEP-REFERENCED; KEEP-set single-pass 1,741,616,318. `.dsh-test` **absent** (NOT_OBSERVED) |
| root-untracked SCRATCH | 61 | 692,309,459 | .tmp-*/.rt-*/.probe-*/.bteam-*-msg/tmp-*/.npm-cache*/.pnpm-store-* |
| root-untracked EVIDENCE | 47 | 7,515,861,541 | s1-*/s2-*/u1-* = KEEP-PROTECTED; others EVIDENCE-only |
| root-untracked RECOVERY | 1 | 3,237,070,160 | recovery/ |
| root-untracked UNKNOWN | 52 | 577,216,057 | list below |
| local-only branches | 24 | 384 commits total | tip shas+dates in local-only-branches.json |
| stash | 1 | 1 file (+78/−4) | stash@{0} "wrong-grammar-8788-attempt" on feat/a5m2-wire-g1 @85db7fb6 |

## Estimated reclaimable bytes per class
- REGENERABLE worktrees (all 16 deleted): ≈ **8.27 GB** per-dir sum (slight overcount from cross-worktree hardlinks; `.worktrees` single-pass total 29.40 GB).
- homes REGENERABLE (534 worlds deleted, KEEP 8 kept): ≈ **2.00 GB** upper bound (tree 3,744,809,488 − KEEP single-pass 1,741,616,318); inodes shared with KEEP are not freed.
- root SCRATCH: **0.69 GB**; plus REUSE-minus-root worktrees if later cleared: up to 18.12 GB.
- NOT reclaimable: evidence 7.52 GB (KEEP-PROTECTED subsets), recovery/ 3.24 GB, .git 0.78 GB, KEEP-ACTIVE worktrees 4.09 GB.
- Disk: filesystem /srv/... has 35,155,697,664 B free (68% used) — df in runtime.json.

## Top-20 largest items (du -b)
5.10G evidence/u1-closure-20261025 (grew during capture; KEEP) · 3.01G recovery/ · 2.46G wt a5-m2-int · 1.61G wt a5m2-wire-g6 · 1.56G evidence/retired-trees-2026-10-23 · 1.10G wt a5m2-wire-schedule · 1.10G wt a5m2-wire-team · 1.10G wt a5m2-g1asm · 1.10G wt a5m2-wire-g3a · 1.10G wt a5m2-wire-g2 · 1.09G wt a5m2-provider-id · 1.09G wt a5m2-newfam · 1.06G wt a5m2-wire-g1 · 0.91G wt a5m2-subagent-fix · 0.84G home a5m2-sched-c2-dry-…203ZZ · 0.82G wt a5-lsp-keyfix · 0.79G wt int-alpha3-stage2 · 0.79G wt a5-read-slice · 0.76G wt u1-audit-master · 0.63G home .playwright-browsers

## deletion-readiness (user ruling 2026-10-25T1004Z: no raw-data backup; loss accepted; bundle first)
Irrecoverable-from-GitHub **if deleted, unless listed in bundle-refs.txt / copied out**:
- Local-only commits — **bundle-refs.txt** lists all 24 branches + refs/stash; a `git bundle` of those refs preserves them. Biggest: a5-read-pilot 161 (tip 4f08204c9), a5poc7-gbj5-distfix 73, a5-jobs-guard-fix 65, feat/a5m2-wire-g5 4 (tip ff421cf25), task/int-alpha3-stage2 12 (tip e63da1256), backup/pre-rebase-55bd5e78 12, alpha5-ptc-stack 9, feat/s2-authority-snapshot-iso-20261025 8 (tip 2e10100a5, KEEP-ACTIVE wt). All tips+shas in local-only-branches.json.
- Stash@{0} (refs/stash in bundle-refs): 1 file +78/−4 (05-control-window-runner.mjs).
- Uncommitted non-evidence tracked mods NOT in any commit (bundle does NOT carry them — copy out before delete):
  wt a5-mcp-binding 5 files (incl. packages/*, live-assembly docs); a5-read-slice 3; alpha5-gap-c0405 6; wt a5-jobs-iso-96e-pinned 2 + a5-jobs-isolation 2 (evidence-dir mods too); wt a5-docs-realign / a5-jobs-iso-int2 / a5-m0-docs-pr / r352-lintfix / a5-m0-contract / a5m2-subagent-fix / a5-jobs-iso-int / a5m2-joint-cand-probe: 1 each; root master: SESSION_ROUTER_LOG.md **+17 incident entry — KEEP-PROTECTED, sha256 e3e49b13…** (root-untracked.json).
- Untracked non-evidence files that look like work, not scratch (copy out or accept loss):
  wt a5-m2-auth-vocab `AUTH-candidate-3a3c2a076.patch` (+26 rc-logs); wt a5-mcp-binding `a5-mcp-binding.patch`; wt a5m2-joint-cand-probe `zz-temp-…validator-probe.test.ts`+`tmp-joint-validator-probe.mts`; wt a5m2-wire-schedule `packages-pins/<sha>/manifest-*-hashes.txt` ×2; wt a5-m0-contract `docs/plans/active/alpha5-tool-io-governance/M0-PREP-*.md`; wt a5m2-newfam/.a5m2-bmcp/.a5m2-job-family/.a5m2-subagent-fix/.a5m2-wire-g1: tmp logs/commitmsg dirs (loss OK).
- All other REUSE-CANDIDATE untracked = run logs/patches regenerable-by-rerun; evidence-dir untracked = evidence, KEEP per U3 ruling.
- Homes REGENERABLE, root SCRATCH, REGENERABLE worktrees: nothing irrecoverable (commits all on remotes; content regenerable).

## UNKNOWN list (owner / next action)
- 52 root-untracked UNKNOWN (577 MB): h*.log/handoff/kernel/pack/p6t3/rc11b/tsc2/ci-*.log (~*.log runs, owner=U3, propose SCRATCH after U1 owner confirms); `.candidate-efb5`, `.census-diag-tmp`, `.center-tmp`, `.gate`, `.df0`, `.glob-flake-diag`, `.merge-scratch-g3a`, `.selftest.out`, `.vitest-revfix.json`, `FAIL` (probe/gate artifacts, owner=U3 delete-or-confirm); `1f405968…`,`b5c06f09…`,`c3780bb9…` (sha-named dirs, likely pnpm-store copies, owner=U3), `a5m2-kiit.msg`/`a5m2-kitfix.msg`/`.plan-msg.txt`/`.bteam`-adjacent (commit-msg drafts), `center-fs-subtool-entry-audit.md` (audit note — owner main agent, candidate evidence), `dev-verify-pack`, `packages-pins`, `kit.diff`, `full-run-final.txt`, `kernel-full2.summary` (build/verify artifacts, owner=U3), `docs/memo` (owner=main agent — docs placement ruling), `tests/checks`, `tests/kits/lib`, `tests/kits/a5m2-todo-c2`, `dev/agent-workflow/tools/evidence.mjs` (code-like, **owner=main agent: keep-in-git or delete**, tracked-file candidates), `.gate` in wt a5-m2-int/a5m2-wire-g1.
- Homes: 1 dir NOT_OBSERVED (`reviewb-rgsem-NrPx`, locked/, EPERM — owner=U3, may contain live lock); 19 orphan `.lock` files (homes already gone) — safe delete candidates, recorded.
- `.dsh-test` durable home missing on disk — owner=main agent (recreate lazily per TEST_METHODS §7; nothing to preserve).

Details: worktrees.json / local-only-branches.json / root-untracked.json / homes.json / runtime.json; raw inputs under raw/.
