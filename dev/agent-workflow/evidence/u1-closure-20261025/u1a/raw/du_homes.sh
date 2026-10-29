#!/usr/bin/env bash
# U1-A: du -sb per tests/homes dir (read-only). Output: raw/homes_du.tsv
set -u
cd /srv/workspace/dsh-plugins/dsh-agent-team
U=dev/agent-workflow/evidence/u1-closure-20261025/u1a
: > "$U/raw/homes_du.tsv"
xargs -a "$U/raw/home_names.txt" -P 6 -I{} sh -c '
  p="tests/homes/{}"
  du -sb -- "$p" 2>/dev/null || printf "ERR\t%s\n" "$p"' >> "$U/raw/homes_du.tsv"
echo DONE_HOMES_DU $(wc -l < "$U/raw/homes_du.tsv")
