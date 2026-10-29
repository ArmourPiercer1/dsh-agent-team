# U3-B local cleanup plan — DRY-RUN only (2026-10-25T10:44Z)
Nothing was deleted, moved, or created outside this evidence dir + the (unmodified) store dirs.
Re-verification vs u1a: worktree set identical (50, none created after 2026-10-25T10:00Z — the
only post-cutoff-touched worktrees `s2-authority-iso`/`u1-audit-master` are KEEP); homes 542 all
present, none modified after cutoff; bundle `.artifacts/git/local-only-20261025.bundle`
sha256 `abf9ae3b…8f51` re-verified (`git bundle verify` OK, 25 refs = all 24 local-only
branches + refs/stash; live recount 385 local-only commits vs u1a 384: `feat/s2-authority-
snapshot-iso-20261025` gained 1 commit — it is a KEEP branch, never deleted; re-bundle advised).

## Counts / bytes per action
| Action | items | bytes |
|---|---|---|
| salvage copies (`cp -a --parents`, sha256-verified pre-removal) | 357 (186 file + 16 file-mod + 155 dir) | 625,892,627 |
| tracked-mods.patch (`git diff HEAD`, evidence paths excluded) | 3 | 115,577 |
| worktrees removed (`git worktree remove --force`) — 28 REUSE-CANDIDATE + 16 REGENERABLE | 44 | 26,392,876,883 live du |
| root SCRATCH → DELETE | 61 | 692,309,459 live du |
| root EVIDENCE(47)+RECOVERY(1)+UNKNOWN(52) → MOVE (rename, same disk) | 100 | 5,865,855,651 (0 reclaim) |
| homes worlds DELETE / orphan-or-companion .lock DELETE | 534 / 18 | per u1a du 8,035,678,483 apparent |
| KEEP: root checkout + 5 active worktrees; homes .playwright-browsers + 7 referenced (+1 world-kept lock) | 6 / 8 | — |
| branches.tsv: refs of removed worktrees kept (38 branches + 6 detached heads) | 44 | — |

## df (B free): before 32,881,397,760 → expected after ≈ 53.6–58.1e9
Range is hardlink-honest (nlink analysis): worktrees 19.71–22.77 GB, homes 1.49–2.39 GB
(29.4 GB raw .worktrees du overstates: pnpm node_modules share inodes with the kept stores),
scratch 0.14–0.69 GB, minus 0.63 GB salvage copies; root MOVEs are renames = 0.

## Deviations / interpretations (recorded)
1. Salvage includes untracked+modified **evidence** files inside removed worktrees (they exist
   only there); only *deletions* under dev/agent-workflow/evidence are excluded (recoverable
   from the preserved branch refs). Patches likewise exclude evidence paths.
2. Worktree-local pnpm/npm content stores (`.pnp-store`, `.pnpm-store`, `.npm-probe-cache`,
   `.npm-cache`) treated as regenerable (like node_modules); u1a classifies root equivalents SCRATCH.
3. `reviewb-rgsem-NrPx` (u1a NOT_OBSERVED, mode-000 `locked/` fixture, mtime 10-18, no lock
   sibling, no test-port listeners) → DELETE with chmod-fallback; if the locked dir is non-empty
   it may surface as residual. df fluctuates (other agents active) — numbers are point-in-time.
4. `git status` untracked directories are salvaged as whole-dir items (git's own collapse
   granularity); dir sha256 = sorted per-file manifest hash (algorithm embedded in execute.sh).

## Residuals (kept, why)
`.artifacts/` store itself; this plan dir; `dev/agent-workflow/evidence/u2-g2-review-r1` +
`u3-evidence-inventory-20261025` (post-u1a, other agents active); `.pnpm-store` (kept per
ruling); 6 KEEP worktrees; 8 KEEP homes + 2 stray unknown files + 1 KEEP-world lock;
unregistered `.worktrees/pack-int/{install,logs,out}-*` scratch dirs (not registered worktrees
— out of `git worktree remove` scope; propose follow-up U3-c sweep); root
`SESSION_ROUTER_LOG.md` +17 incident entry untouched (sha `e3e49b13…`).

## Run
`./execute.sh` = dry-run (verified this pass: exit 0, 1073 planned actions, writes nothing);
real cleanup requires explicit `./execute.sh --execute` (log → .artifacts/evidence/cleanup-log-<UTC>.tsv, df before/after).
