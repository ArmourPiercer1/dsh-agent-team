#!/usr/bin/env bash
# U1-A: du -sb per worktree (read-only). Output: raw/worktrees_du.tsv
set -u
cd /srv/workspace/dsh-plugins/dsh-agent-team
U=dev/agent-workflow/evidence/u1-closure-20261025/u1a
: > "$U/raw/worktrees_du.tsv"
xargs -d '\n' -a "$U/raw/worktree_paths.txt" -P 4 -I{} sh -c '
  p="{}"
  if [ -d "$p" ]; then
    du -sb -- "$p" 2>/dev/null || printf "ERR\t%s\n" "$p"
  else
    printf "MISSING\t%s\n" "$p"
  fi' >> "$U/raw/worktrees_du.tsv"
echo DONE_WORKTREE_DU $(wc -l < "$U/raw/worktrees_du.tsv")
