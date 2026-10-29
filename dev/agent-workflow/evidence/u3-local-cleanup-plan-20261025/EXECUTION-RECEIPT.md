# U3-B local cleanup — execution receipt (main agent, 2026-10-25T10:58:44Z)

Runs (all logs here + store-side `.artifacts/evidence/cleanup-log-*.tsv`):
- run-1 (execute-run-1.txt): 23 worktrees removed, then rc=255 — `git worktree remove` Permission denied on read-only
  install dirs inside .worktrees/a5m2-imgverify (its 31 salvage items had already been copied+verified; git metadata pruned,
  directory residue left).
- fix v1→v2: `chmod -R u+rwX` before `worktree remove` (diff: execute.v1.sh vs execute.v2.sh).
- run-2: aborted fail-closed — re-copy of an already-salvaged dir mismatched (source half-deleted). fix v2→v3: skip salvage
  item if destination already exists (idempotent resume).
- run-3: rc=128 — residue dir not a worktree anymore. Manual action (manual-actions.tsv): verified 31/31 salvage present and
  packages-pins 27/27 == tracked files of branch feat/a5m2-imgverify, then removed residue dir.
- run-4: rc=0. 20 more worktrees removed, 258 salvage items, 2 patches, 61 scratch deleted, 82 moved (root EVIDENCE/UNKNOWN/recovery),
  552 homes/locks deleted.

Main-agent change to plan before execution: root-scratch.tsv excluded active evidence lines (s1-*/s2-*/u1-*/u2-*/u3-*)
from MOVE (they are inputs of running agents; original kept as root-scratch.orig.tsv).

Result: worktrees 50 → 7 (6 KEEP + u3-evidence-reloc created by the U3-C executor); every planned salvage destination exists;
bundle re-verified OK; tests/homes keeps .playwright-browsers + 7 referenced worlds.
df free: 31 GiB (10:21Z) → 56 GiB (59,325,313,024 B at run-4 end). Used 47 GiB, of which .worktrees 9.6G, .artifacts 8.3G,
tests/homes 1.4G, test-use 2.7G, references/.git/node_modules remainder.
Branch refs: none deleted (local-only commits additionally in .artifacts/git/local-only-20261025.bundle).
Note: feat/s2-authority-snapshot-iso-20261025 advanced after bundling — it is pushed by the U2 executor; not a loss risk.
