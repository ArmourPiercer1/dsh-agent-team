#!/usr/bin/env bash
# U1-A: du -sb totals for key trees + root untracked top-level paths (read-only).
set -u
cd /srv/workspace/dsh-plugins/dsh-agent-team
U=dev/agent-workflow/evidence/u1-closure-20261025/u1a
: > "$U/raw/du_totals.tsv"
for t in .worktrees tests/homes recovery dev/agent-workflow/evidence .git; do
  du -sb -- "$t" 2>/dev/null >> "$U/raw/du_totals.tsv" || printf "ERR\t%s\n" "$t" >> "$U/raw/du_totals.tsv"
done
# root untracked top-level paths (strip trailing slash, dedupe)
sed 's:/*$::' "$U/raw/root_untracked_raw.txt" | sort -u > "$U/raw/root_untracked_paths.txt"
: > "$U/raw/root_untracked_du.tsv"
xargs -d '\n' -a "$U/raw/root_untracked_paths.txt" -P 4 -I{} sh -c '
  p="{}"
  if [ -e "$p" ]; then du -sb -- "$p" 2>/dev/null || printf "ERR\t%s\n" "$p"; else printf "MISSING\t%s\n" "$p"; fi' >> "$U/raw/root_untracked_du.tsv"
echo DONE_DU_TOTALS
